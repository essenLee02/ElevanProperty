/**
 * sendRetryOn5xx.test.js — M77 regression.
 *
 * Reported bug: a WhatsApp reply was lost with
 *   [KIRIMI SEND] HTTP 500 error: "Internal Server Error"
 *   Send Status: ❌ Gagal: Request failed with status code 500
 * and it was NEVER retried, despite KIRIMI_RETRY_COUNT=3.
 *
 * Cause: every send path retried only on NETWORK error codes
 * (`ETIMEDOUT`, `ECONNRESET`, …). An HTTP error response gives
 * `err.code === 'ERR_BAD_RESPONSE'` (axios 1.x) with the status on
 * `err.response.status` — so `RETRYABLE.has(err.code)` was false and the loop
 * broke on attempt 1. A transient upstream blip therefore lost the customer's
 * reply permanently. Proven transient: the exact 271-char payload that got a
 * 500 in production returned HTTP 200 on replay.
 *
 * These tests drive the REAL send functions against a local mock server, so
 * they exercise the actual retry loop rather than a reimplementation of it.
 *
 * Run: node tests/sendRetryOn5xx.test.js
 */

'use strict';

require('dotenv').config();
const http = require('http');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

/** Mock upstream: fails with `status` for the first `failTimes` calls, then 200. */
function startMock({ status, failTimes, okBody }) {
  const state = { hits: 0 };
  const server = http.createServer((req, res) => {
    state.hits++;
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (state.hits <= failTimes) {
        res.writeHead(status, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(okBody));
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, state, port: server.address().port }));
  });
}

const quietRetries = () => {
  process.env.KIRIMI_RETRY_COUNT    = '3';
  process.env.KIRIMI_RETRY_DELAY_MS = '10';   // keep the suite fast
  process.env.KIRIMI_TIMEOUT_MS     = '5000';
  process.env.FONNTE_RETRY_COUNT    = '3';
  process.env.FONNTE_RETRY_DELAY_MS = '10';
};

(async () => {
  quietRetries();

  console.log('── Group 1: Kirimi retries a transient 500 and succeeds ──');
  {
    const { server, state, port } = await startMock({
      status: 500, failTimes: 1,
      okBody: { success: true, data: { messageId: 'X1' }, message: 'Berhasil mengirim pesan' },
    });
    process.env.KIRIMI_API_URL   = `http://127.0.0.1:${port}`;
    process.env.KIRIMI_USER_CODE = 'TESTCODE';
    process.env.KIRIMI_SECRET    = 'testsecret';

    delete require.cache[require.resolve('../controllers/kirimiChatController')];
    const { sendViaKirimi } = require('../controllers/kirimiChatController');

    let err = null, out = null;
    try { out = await sendViaKirimi('6282233556796', 'Tes pesan properti', 'D-TEST'); }
    catch (e) { err = e; }

    ok('send eventually SUCCEEDS after a 500', !err && !!out, err && err.message);
    ok('the 500 WAS retried (2 upstream hits)', state.hits === 2, `hits=${state.hits}`);
    server.close();
  }

  console.log('\n── Group 2: gives up after exhausting retries ──');
  {
    const { server, state, port } = await startMock({ status: 500, failTimes: 99, okBody: {} });
    process.env.KIRIMI_API_URL = `http://127.0.0.1:${port}`;

    delete require.cache[require.resolve('../controllers/kirimiChatController')];
    const { sendViaKirimi } = require('../controllers/kirimiChatController');

    let err = null;
    try { await sendViaKirimi('6282233556796', 'Tes', 'D-TEST'); } catch (e) { err = e; }

    ok('persistent 500 still throws', !!err);
    ok('tried exactly KIRIMI_RETRY_COUNT times', state.hits === 3, `hits=${state.hits}`);
    server.close();
  }

  console.log('\n── Group 3: 4xx must NOT be retried (permanent) ──');
  {
    for (const status of [400, 401]) {
      const { server, state, port } = await startMock({ status, failTimes: 99, okBody: {} });
      process.env.KIRIMI_API_URL = `http://127.0.0.1:${port}`;

      delete require.cache[require.resolve('../controllers/kirimiChatController')];
      const { sendViaKirimi } = require('../controllers/kirimiChatController');

      try { await sendViaKirimi('6282233556796', 'Tes', 'D-TEST'); } catch (_) { /* expected */ }
      ok(`HTTP ${status} tried ONCE (no wasted retries)`, state.hits === 1, `hits=${state.hits}`);
      server.close();
    }
  }

  console.log('\n── Group 4: 429 rate limit IS retried ──');
  {
    const { server, state, port } = await startMock({
      status: 429, failTimes: 1,
      okBody: { success: true, message: 'Berhasil mengirim pesan' },
    });
    process.env.KIRIMI_API_URL = `http://127.0.0.1:${port}`;

    delete require.cache[require.resolve('../controllers/kirimiChatController')];
    const { sendViaKirimi } = require('../controllers/kirimiChatController');

    let err = null;
    try { await sendViaKirimi('6282233556796', 'Tes', 'D-TEST'); } catch (e) { err = e; }
    ok('429 retried then succeeded', !err && state.hits === 2, `hits=${state.hits} err=${err && err.message}`);
    server.close();
  }

  console.log('\n── Group 5: sibling terminals carry the same guard ──');
  {
    const fs = require('fs');
    const files = [
      ['controllers/fonnteChatController.js',      'FONNTE'],
      ['services/fonnteService.js',                'FONNTE SERVICE'],
      ['controllers/timelinesAIChatController.js', 'TIMELINESAI'],
      ['controllers/kirimiChatController.js',      'KIRIMI'],
    ];
    for (const [rel, label] of files) {
      const src = fs.readFileSync(require('path').join(__dirname, '..', rel), 'utf8');
      const hasServer = /isServerSide\s*=\s*httpStatus\s*>=\s*500/.test(src);
      const hasRate   = /isRateLimit\s*=\s*httpStatus\s*===\s*429/.test(src);
      const wired     = /isServerSide\s*\|\|\s*isRateLimit/.test(src);
      ok(`${label} retries 5xx + 429`, hasServer && hasRate && wired,
         `5xx=${hasServer} 429=${hasRate} wired=${wired}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });

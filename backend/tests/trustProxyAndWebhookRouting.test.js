/**
 * trustProxyAndWebhookRouting.test.js
 *
 * M101 — TIGA CACAT DEPLOYMENT PRODUKSI (Hostinger, log 20 Agu 2026).
 *
 *  (a) `trust proxy` TIDAK PERNAH DI-SET → RATE LIMIT SALAH ORANG.
 *      Log produksi:
 *        ValidationError: The 'X-Forwarded-For' header is set but the Express
 *        'trust proxy' setting is false (default).
 *      Hostinger menaruh app Node di belakang reverse proxy, jadi SETIAP request
 *      membawa X-Forwarded-For.
 *      ⚠️ KOREKSI PENTING atas dugaan awal: request TIDAK gagal — tetap HTTP 200,
 *      webhook tetap diproses. Kerusakan sesungguhnya lebih halus: `req.ip`
 *      selalu menjadi IP PROXY (`::ffff:127.0.0.1`), sehingga SELURUH customer
 *      berbagi SATU bucket rate-limit (webhookLimiter: 120/menit). Saat beberapa
 *      customer chat bersamaan, customer yang sah kena HTTP 429 — pesan hilang
 *      tanpa error yang jelas.
 *      Fix: app.set('trust proxy', TRUST_PROXY_HOPS ?? 1).
 *      ⛔ SENGAJA BUKAN `true` — `true` = percaya buta seluruh rantai XFF,
 *      siapa pun bisa memalsukannya dan lolos rate limit.
 *
 *  (b) BANNER WEBHOOK FONNTE MENUNJUK ENDPOINT LEGACY YANG TIDAK PUNYA AI.
 *      publicUrlService memetakan FONNTE → `/api/fonnte/webhook`
 *      (fonnteWebhookController — LEGACY, TIDAK PERNAH memanggil
 *      generateWhatsAppAIReply). Jalur multi-agent yang benar — sama dengan
 *      Kirimi & TimelinesAI — ada di `/api/fonnte-chat/webhook`
 *      (fonnteChatController.handleInboundMessage).
 *      Dampak: begitu MASSEGE_TERMINAL diganti ke FONNTE, banner menyuruh isi
 *      endpoint yang menerima pesan tapi TIDAK PERNAH membalas. Gagal SENYAP
 *      (HTTP 200, tanpa error) — kelas yang sama dengan placeholder <ngrok-url>.
 *
 *  (c) DB_PORT ADA DI .env TAPI TIDAK PERNAH DIBACA config/database.js.
 *      Selama DB di 3306 tidak terasa; begitu port non-standar dipakai,
 *      koneksi gagal padahal .env terlihat benar.
 *
 * Semua tes OFFLINE (server ephemeral di 127.0.0.1, tanpa DB/jaringan luar).
 */

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const publicUrlSvc = require('../services/publicUrlService');

let pass = 0, total = 0;
const ok = (n, c, extra) => {
  total++;
  if (c) { pass++; console.log(`  ✅ ${n}`); }
  else { console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); }
};

/** App minimal yang meniru susunan middleware produksi (limiter di /api). */
function makeApp(trustProxy) {
  const app = express();
  if (trustProxy !== null) app.set('trust proxy', trustProxy);
  app.use(express.json());
  app.use('/api', rateLimit({
    windowMs: 60 * 1000, max: 3,
    standardHeaders: true, legacyHeaders: false, skip: () => false
  }));
  app.post('/api/kirimi/webhook', (req, res) => res.json({ ok: true, ip: req.ip }));
  return app;
}

async function withServer(app, fn) {
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  try { return await fn(srv.address().port); }
  finally { srv.close(); }
}

const post = (port, xff) => fetch(`http://127.0.0.1:${port}/api/kirimi/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': xff },
  body: '{}'
});

(async () => {
  // ─── (a) trust proxy ────────────────────────────────────────────────────────
  console.log('\n[M101a] trust proxy — tiap customer harus punya bucket sendiri');

  // 4 customer di JARINGAN BERBEDA. IPv4 dipakai sengaja: express-rate-limit v7
  // mengelompokkan IPv6 per-subnet /56, sehingga IPv6 dari subnet yang sama
  // memang SEHARUSNYA berbagi bucket (anti-bypass) dan akan mengaburkan tes ini.
  const CUSTOMERS = ['114.10.1.5', '36.72.200.9', '182.253.44.7', '103.47.132.2'];

  const runAll = (trustProxy) => withServer(makeApp(trustProxy), async (port) => {
    const out = [];
    for (const ip of CUSTOMERS) {
      const res = await post(port, ip);
      let body = null; try { body = await res.json(); } catch { /* 429 → bukan JSON */ }
      out.push({ status: res.status, ip: body && body.ip });
    }
    return out;
  });

  const before = await runAll(null);   // default Express: trust proxy = false
  const after  = await runAll(1);      // perbaikan

  ok('KONTROL (sebelum): semua request terlihat dari IP proxy yang sama',
    before.slice(0, 3).every((r) => String(r.ip).includes('127.0.0.1')),
    JSON.stringify(before.map((r) => r.ip)));
  ok('KONTROL (sebelum): customer ke-4 yang SAH kena 429',
    before[3].status === 429, `status=${before[3].status}`);

  ok('sesudah: req.ip = IP customer sungguhan, bukan proxy',
    after.map((r) => r.ip).join(',') === CUSTOMERS.join(','),
    JSON.stringify(after.map((r) => r.ip)));
  ok('sesudah: keempat customer lolos (bucket terpisah)',
    after.every((r) => r.status === 200),
    JSON.stringify(after.map((r) => r.status)));

  // Rate limit HARUS tetap bekerja per-IP — perbaikan ini bukan "matikan limiter".
  const sameIp = await withServer(makeApp(1), async (port) => {
    const out = [];
    for (let i = 0; i < 5; i += 1) out.push((await post(port, '114.10.1.5')).status);
    return out;
  });
  ok('KONTROL NEGATIF: satu IP spam tetap DIBLOKIR setelah melewati batas',
    sameIp.filter((s) => s === 429).length >= 2, sameIp.join(','));

  // ─── (b) routing webhook per-terminal ───────────────────────────────────────
  console.log('\n[M101b] URL webhook — Fonnte harus ke jalur multi-agent (ada AI)');

  const HOSTINGER = { NGROK_ENABLE: 'false', APP_URL: 'https://propmatches.fun' };

  const urlsFor = (terminals) => {
    const list = publicUrlSvc.webhookUrls({
      ngrokUrl: '',
      env: { ...HOSTINGER, MASSEGE_TERMINAL: terminals }
    });
    return Object.fromEntries(list.map((e) => [e.terminal, e.url]));
  };

  const fonnte = urlsFor('FONNTE');
  ok('FONNTE → /api/fonnte-chat/webhook (multi-agent, memanggil AI)',
    fonnte.FONNTE === 'https://propmatches.fun/api/fonnte-chat/webhook', fonnte.FONNTE);
  ok('KONTROL NEGATIF: FONNTE TIDAK menunjuk /api/fonnte/webhook (legacy, tanpa AI)',
    !/\/api\/fonnte\/webhook$/.test(String(fonnte.FONNTE)), fonnte.FONNTE);

  const all = urlsFor('FONNTE,KIRIMI,TIMELINESAI');
  ok('KIRIMI → /api/kirimi/webhook',
    all.KIRIMI === 'https://propmatches.fun/api/kirimi/webhook', all.KIRIMI);
  ok('TIMELINESAI → /api/timelinesai/webhook',
    all.TIMELINESAI === 'https://propmatches.fun/api/timelinesai/webhook', all.TIMELINESAI);
  ok('ketiga terminal muncul saat MASSEGE_TERMINAL multi-nilai',
    Object.keys(all).length === 3, Object.keys(all).join(','));

  // Mode ngrok tetap utuh — perbaikan hosting tidak boleh merusak alur dev lokal.
  const dev = Object.fromEntries(publicUrlSvc.webhookUrls({
    ngrokUrl: 'https://spotter-dragging-sporting.ngrok-free.dev',
    env: { NGROK_ENABLE: 'true', APP_URL: 'http://localhost', MASSEGE_TERMINAL: 'KIRIMI' }
  }).map((e) => [e.terminal, e.url]));
  ok('KONTROL NEGATIF: mode ngrok lokal tetap memakai URL ngrok, bukan APP_URL',
    dev.KIRIMI === 'https://spotter-dragging-sporting.ngrok-free.dev/api/kirimi/webhook',
    dev.KIRIMI);
  ok('KONTROL NEGATIF: mode ngrok tidak pernah mencetak placeholder <ngrok-url>',
    !String(dev.KIRIMI).includes('<ngrok-url>'), dev.KIRIMI);

  // ─── (c) DB_PORT terbaca ────────────────────────────────────────────────────
  console.log('\n[M101c] DB_PORT dibaca config/database.js');

  const dbSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'config', 'database.js'), 'utf8');
  ok('config/database.js membaca process.env.DB_PORT', dbSrc.includes('process.env.DB_PORT'));
  ok('KONTROL NEGATIF: DB_PORT kosong → undefined (pakai default dialect, perilaku lama)',
    /DB_PORT\s*\?\s*Number\(process\.env\.DB_PORT\)\s*:\s*undefined/.test(dbSrc));

  // ─── server.js memasang trust proxy ─────────────────────────────────────────
  console.log('\n[M101] server.js benar-benar memasang trust proxy');

  const srvSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
  ok('server.js memanggil app.set(\'trust proxy\', …)', /app\.set\(\s*['"]trust proxy['"]/.test(srvSrc));
  ok('nilainya dari TRUST_PROXY_HOPS (bisa dikonfigurasi)', srvSrc.includes('TRUST_PROXY_HOPS'));
  ok('KONTROL NEGATIF: TIDAK memakai `trust proxy` = true (bisa dipalsukan)',
    !/app\.set\(\s*['"]trust proxy['"]\s*,\s*true\s*\)/.test(srvSrc));

  console.log(`\nRESULT: ${pass}/${total}`);

  // ⚠️ JANGAN process.exit() di sini. express-rate-limit menyimpan timer
  // internal; memaksa exit saat handle-nya masih dalam proses close membuat
  // libuv di Windows melempar
  //   "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"
  // dan proses keluar dengan kode 127 — terbaca sebagai CRASH oleh runner suite
  // meski seluruh assertion lulus. Set exitCode saja lalu biarkan event loop
  // habis secara wajar (semua server sudah ditutup withServer()).
  process.exitCode = pass === total ? 0 : 1;
})();

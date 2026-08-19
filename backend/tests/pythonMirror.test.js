/**
 * pythonMirror.test.js — regresi M104.
 *
 * Menyalin webhook masuk ke python_backend supaya terminal Python bisa
 * menampilkan pesan customer NYATA (akun ngrok cuma punya SATU domain, dan
 * domain itu dipegang Node.js — lihat V8 §5 M97/M104).
 *
 * ⚠️ MODUL INI MENYENTUH JALUR PRODUKSI. Tes di bawah menjaga TIGA jaminan
 * yang kalau hilang bisa menjatuhkan layanan WhatsApp customer:
 *   1. TIDAK PERNAH MELEMPAR — walau URL sampah / Python mati.
 *   2. TIDAK PERNAH MEM-BLOK — `mirrorInbound()` balik seketika (bukan async).
 *   3. MATI SECARA DEFAULT — hanya jalan bila PYTHON_MIRROR_ENABLED=true.
 *
 * Run: node tests/pythonMirror.test.js
 */

'use strict';

require('dotenv').config();

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const mirror = require('../services/pythonMirrorService');

const BODY = { type: 'message', device_id: 'D-TEST', from: '628123456789', message: 'tes' };

/* ───────────────────────────────────────────────────────────────────────── */
console.log('── Group 1: default MATI (aman) ──');
{
  const orig = process.env.PYTHON_MIRROR_ENABLED;
  delete process.env.PYTHON_MIRROR_ENABLED;
  ok('tanpa PYTHON_MIRROR_ENABLED → isEnabled() false', mirror.isEnabled() === false);

  process.env.PYTHON_MIRROR_ENABLED = 'false';
  ok('PYTHON_MIRROR_ENABLED=false → isEnabled() false', mirror.isEnabled() === false);

  process.env.PYTHON_MIRROR_ENABLED = 'true';
  ok('PYTHON_MIRROR_ENABLED=true → isEnabled() true', mirror.isEnabled() === true);

  process.env.PYTHON_MIRROR_ENABLED = orig;
}

console.log('\n── Group 2: TIDAK PERNAH MELEMPAR ──');
{
  const origEnabled = process.env.PYTHON_MIRROR_ENABLED;
  const origUrl = process.env.PYTHON_MIRROR_URL;
  process.env.PYTHON_MIRROR_ENABLED = 'true';

  // Port yang dijamin tidak ada pendengarnya.
  process.env.PYTHON_MIRROR_URL = 'http://127.0.0.1:59999';
  let threw = false;
  try { mirror.mirrorInbound('kirimi', BODY); } catch (_) { threw = true; }
  ok('Python mati → TIDAK melempar', threw === false);

  // URL rusak total.
  process.env.PYTHON_MIRROR_URL = 'http://:::invalid:::';
  threw = false;
  try { mirror.mirrorInbound('kirimi', BODY); } catch (_) { threw = true; }
  ok('URL rusak → TIDAK melempar', threw === false);

  // Payload aneh tidak boleh meledak.
  process.env.PYTHON_MIRROR_URL = 'http://127.0.0.1:59999';
  threw = false;
  try {
    mirror.mirrorInbound('kirimi', null);
    mirror.mirrorInbound('kirimi', undefined);
    mirror.mirrorInbound('kirimi', 'bukan objek');
  } catch (_) { threw = true; }
  ok('payload null/undefined/string → TIDAK melempar', threw === false);

  process.env.PYTHON_MIRROR_ENABLED = origEnabled;
  process.env.PYTHON_MIRROR_URL = origUrl;
}

console.log('\n── Group 3: TIDAK MEM-BLOK jalur produksi ──');
{
  const origEnabled = process.env.PYTHON_MIRROR_ENABLED;
  const origUrl = process.env.PYTHON_MIRROR_URL;
  const origTo = process.env.PYTHON_MIRROR_TIMEOUT_MS;
  process.env.PYTHON_MIRROR_ENABLED = 'true';
  // IP non-routable → koneksi menggantung sampai timeout.
  process.env.PYTHON_MIRROR_URL = 'http://10.255.255.1:5056';
  process.env.PYTHON_MIRROR_TIMEOUT_MS = '4000';

  const t0 = Date.now();
  mirror.mirrorInbound('kirimi', BODY);
  const elapsed = Date.now() - t0;
  ok(`kembali seketika walau target menggantung (${elapsed}ms < 100ms)`, elapsed < 100, `${elapsed}ms`);

  ok('mirrorInbound() TIDAK mengembalikan promise (tak bisa di-await keliru)',
     typeof mirror.mirrorInbound('kirimi', BODY) === 'undefined');

  process.env.PYTHON_MIRROR_ENABLED = origEnabled;
  process.env.PYTHON_MIRROR_URL = origUrl;
  process.env.PYTHON_MIRROR_TIMEOUT_MS = origTo;
}

console.log('\n── Group 4: KONTROL NEGATIF — saat mati, tidak ada I/O sama sekali ──');
{
  const origEnabled = process.env.PYTHON_MIRROR_ENABLED;
  process.env.PYTHON_MIRROR_ENABLED = 'false';

  const axios = require('axios');
  const realPost = axios.post;
  let called = 0;
  axios.post = (...args) => { called += 1; return realPost.apply(axios, args); };

  mirror.mirrorInbound('kirimi', BODY);
  ok('PYTHON_MIRROR_ENABLED=false → axios.post TIDAK dipanggil', called === 0, `dipanggil ${called}x`);

  process.env.PYTHON_MIRROR_ENABLED = 'true';
  process.env.PYTHON_MIRROR_URL = 'http://127.0.0.1:59999';
  mirror.mirrorInbound('kirimi', BODY);
  ok('KONTROL POSITIF: saat aktif, axios.post MEMANG dipanggil', called === 1, `dipanggil ${called}x`);

  axios.post = realPost;
  process.env.PYTHON_MIRROR_ENABLED = origEnabled;
}

console.log('\n── Group 5: baseUrl() rapi ──');
{
  const orig = process.env.PYTHON_MIRROR_URL;
  process.env.PYTHON_MIRROR_URL = 'http://127.0.0.1:5056///';
  ok('trailing slash dibuang', mirror.baseUrl() === 'http://127.0.0.1:5056', mirror.baseUrl());
  delete process.env.PYTHON_MIRROR_URL;
  ok('default ke 127.0.0.1:5056', mirror.baseUrl() === 'http://127.0.0.1:5056');
  process.env.PYTHON_MIRROR_URL = orig;
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);

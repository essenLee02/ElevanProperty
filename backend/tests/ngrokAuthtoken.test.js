/**
 * ngrokAuthtoken.test.js — regresi M94.
 *
 * MASALAH: services/ngrokService.js TIDAK PERNAH membaca NGROK_AUTHTOKEN.
 * Tunnel hanya berhasil karena kebetulan ada authtoken di config file MESIN
 * (`%LOCALAPPDATA%\ngrok\ngrok.yml`, hasil `ngrok config add-authtoken` yang
 * pernah dijalankan manual). Akibatnya:
 *   - .env TERLIHAT mengatur token, padahal tidak berpengaruh sama sekali;
 *   - di mesin/server BARU (punya .env, belum pernah add-authtoken) tunnel
 *     gagal ERR_NGROK_105 walau tokennya jelas tertulis di .env.
 *
 * PRESEDENSI — DIUJI LANGSUNG pada ngrok v3.39.8, bukan diasumsikan:
 *   env var NGROK_AUTHTOKEN salah + config file benar → tunnel TETAP JALAN
 *   ⇒ CONFIG FILE MENANG atas env var.
 *   Maka satu-satunya cara menjadikan .env otoritatif adalah FLAG CLI
 *   (`--authtoken=…`), yang presedensinya di atas config file.
 *
 * Tes ini SENGAJA TIDAK memanggil ngrok sungguhan (suite proyek 100% offline,
 * dan memanggil ngrok akan membuat tunnel nyata). Yang diuji: pembentukan
 * ARGUMEN + REDAKSI token dari log — dua hal yang bisa diverifikasi murni.
 *
 * Run: node tests/ngrokAuthtoken.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'services', 'ngrokService.js'), 'utf8');

/* ───────────────────────────────────────────────────────────────────────── */
console.log('── Group 1: token .env benar-benar dibaca & dipakai ──');
{
  ok('NGROK_AUTHTOKEN dibaca dari process.env',
     /process\.env\.NGROK_AUTHTOKEN/.test(SRC));

  ok('dikirim sebagai FLAG CLI --authtoken (bukan env var)',
     /args\.push\(`--authtoken=\$\{authtoken\}`\)/.test(SRC));

  // Kalau seseorang "menyederhanakan" ini jadi env var lagi, presedensi
  // config-file akan diam-diam mengambil alih dan bug M94 kembali.
  ok('TIDAK memakai env child-process untuk authtoken (config file akan menang)',
     !/spawn\('ngrok',\s*args,\s*\{\s*env:/.test(SRC));

  ok('token opsional — ada cabang peringatan bila kosong',
     /NGROK_AUTHTOKEN kosong/i.test(SRC));

  ok('peringatan menyebut ERR_NGROK_105 (gejala di mesin baru)',
     /ERR_NGROK_105/.test(SRC));
}

console.log('\n── Group 2: token TIDAK PERNAH bocor ke log ──');
{
  ok('ada helper redact()', /const redact = \(text\)/.test(SRC));

  ok('redact() mengganti token dengan penanda',
     /REDACTED/.test(SRC));

  // Kedua jalur log ngrok (stdout JSON + stderr teks) harus lewat redact().
  ok('log [NGROK ERROR] diredaksi',
     /const msg = redact\(/.test(SRC));
  ok('log [NGROK STDERR] diredaksi',
     /const text = redact\(/.test(SRC));

  // ⚠️ Yang dilarang adalah mencetak NILAI variabel `authtoken`, bukan menyebut
  // KATA "authtoken" di dalam string pesan. Versi pertama asersi ini memakai
  // pola longgar `\bauthtoken\b` dan langsung salah-tuduh baris peringatan
  //   console.warn('[NGROK] NGROK_AUTHTOKEN kosong di .env — memakai authtoken …')
  // yang jelas tidak membocorkan apa pun. Pola di bawah hanya cocok bila
  // variabelnya benar-benar DIINTERPOLASI/DIRANGKAI ke argumen console.
  const LEAK_RE = /console\.(?:log|warn|error)\([^)]*(?:\$\{\s*authtoken\s*\}|[+,]\s*authtoken\b)[^)]*\)/;
  ok('tidak ada console.* yang mencetak NILAI authtoken',
     !LEAK_RE.test(SRC));

  // Kontrol positif: pola di atas HARUS menangkap kebocoran sungguhan —
  // tanpa ini, asersi di atas bisa lulus hanya karena regex-nya tidak pernah
  // cocok dengan apa pun (vacuous).
  ok('pola deteksi kebocoran terbukti bekerja (kontrol positif)',
     LEAK_RE.test('console.log(`token ${authtoken}`)') &&
     LEAK_RE.test('console.error("tok", authtoken)') &&
     !LEAK_RE.test("console.warn('NGROK_AUTHTOKEN kosong, memakai authtoken config')"));
}

console.log('\n── Group 3: perilaku redact() (logika murni) ──');
{
  // Replika persis implementasi di service — bila implementasinya berubah,
  // Group 2 yang menangkap; di sini kita kunci SEMANTIK-nya.
  const mk = (tok) => (text) => {
    const s = String(text ?? '');
    return tok ? s.split(tok).join('***REDACTED***') : s;
  };

  const TOK = 'SECRET_TOKEN_VALUE_123';
  const r = mk(TOK);

  ok('token tunggal disensor', r(`auth ${TOK} ok`) === 'auth ***REDACTED*** ok');
  ok('token muncul berkali-kali disensor semua',
     r(`${TOK} dan ${TOK}`) === '***REDACTED*** dan ***REDACTED***');
  ok('teks tanpa token tidak berubah',
     r('ERR_NGROK_334 endpoint already online') === 'ERR_NGROK_334 endpoint already online');
  ok('null/undefined aman (tidak melempar)', r(null) === '' && r(undefined) === '');

  // Kontrol negatif: tanpa token, redact() TIDAK boleh menyensor apa pun —
  // menyensor string kosong akan merusak seluruh log.
  const rEmpty = mk('');
  ok('tanpa token: log dibiarkan utuh',
     rEmpty('pesan biasa apa adanya') === 'pesan biasa apa adanya');
  ok('tanpa token: tidak menyisipkan REDACTED',
     !/REDACTED/.test(rEmpty('pesan biasa')));
}

console.log('\n── Group 4: argumen lain tidak rusak ──');
{
  ok('--log=stdout & --log-format=json tetap ada',
     /'--log=stdout',\s*'--log-format=json'/.test(SRC));
  ok('NGROK_DOMAIN masih didukung', /--domain=\$\{domain\}/.test(SRC));
  ok('NGROK_REGION masih didukung', /--region=\$\{region\}/.test(SRC));
  ok('reuse tunnel yang sudah aktif tetap ada (anti ERR_NGROK_334)',
     /findExistingTunnel/.test(SRC));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);

/**
 * providerTimeoutsConfigurable.test.js — regresi M126.
 *
 * Keluhan pemilik proyek (20-21 Agu 2026): balasan AI ke customer kadang baru
 * datang setelah LEBIH DARI 2 MENIT. AI_PRIMARY_PROVIDER aktual di .env adalah
 * `kimi` (BUKAN chatgpt — dokumen lama menyebut chatgpt, tapi nilai .env
 * SELALU yang menang, lihat catatan "SELALU cek AI_PRIMARY_PROVIDER aktual").
 * `services/kimiService.js` SUDAH punya KIMI_TIMEOUT_MS configurable sejak
 * M102 (komentar di kode itu sendiri sudah memperingatkan: prompt WhatsApp
 * ±67K token membuat Kimi kerap MELEBIHI 90 detik, dan menunggu 90 detik
 * "praktis sama dengan tidak dibalas") — tapi var itu TIDAK PERNAH diisi di
 * .env, jadi diam-diam memakai default 90000ms. Ditambah debounce respons
 * (AI_COOKIE_RESPONSE_TIMER, 12 detik) + waktu proses, >2 menit total masuk
 * akal sebagai penyebab paling mungkin.
 *
 * Fix M126: KIMI_TIMEOUT_MS diisi 30000 di .env (sesuai rekomendasi komentar
 * kode sendiri). Ditambah: 4 provider LAIN (chatgpt/claude/deepseek/qwen)
 * yang SEBELUMNYA hardcode `timeout: 90000`/`60000` langsung di axios.post()
 * — tanpa jalur .env sama sekali — sekarang punya pola configurable yang SAMA
 * (CHAT_CHAT_GPT_TIMEOUT_MS, CLAUDE_TIMEOUT_MS, DEEPSEEK_TIMEOUT_MS, QWEN_TIMEOUT_MS),
 * default TIDAK berubah, supaya siapa pun jadi AI_PRIMARY_PROVIDER berikutnya
 * tidak mewarisi masalah yang sama tanpa cara untuk mengaturnya.
 *
 * Run: node tests/providerTimeoutsConfigurable.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, total = 0;
const ok = (n, c, extra = '') => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); } };

const src = (file) => fs.readFileSync(path.join(__dirname, '..', 'services', file), 'utf8');

console.log('\n== openaiService.js (chatgpt) ==');
{
  const s = src('openaiService.js');
  /* ⚠️ ASERSI DIPERBAIKI (M183, 6 Sep 2026) — DULU MENGUNCI SALAH KETIK.
   * Dua baris ini dulu mewajibkan sumber memuat `CHAT_CHAT_GPT_TIMEOUT_MS`
   * (dobel "CHAT_"), nama yang TIDAK PERNAH ada di .env. Jadi tesnya hijau
   * sementara `CHAT_GPT_TIMEOUT_MS=30000` di .env tidak pernah terbaca dan
   * provider ini diam-diam memakai 90000ms — tes justru MENGUNCI bug-nya.
   * Nama yang benar (dan yang dipakai peta provider di bawah, baris ~98)
   * adalah CHAT_GPT_TIMEOUT_MS. */
  ok('membaca CHAT_GPT_TIMEOUT_MS (bukan CHAT_CHAT_GPT_TIMEOUT_MS)',
    /process\.env\.CHAT_GPT_TIMEOUT_MS/.test(s) && !/process\.env\.CHAT_CHAT_GPT_TIMEOUT_MS/.test(s));
  ok('default tetap 90000', /CHAT_GPT_TIMEOUT_MS\s*\|\|\s*90000/.test(s));
  ok('tidak ada lagi timeout: 90000 telanjang', !/timeout:\s*90000\s*$/m.test(s));
}

console.log('\n== claudeService.js ==');
{
  const s = src('claudeService.js');
  ok('membaca CLAUDE_TIMEOUT_MS', s.includes('CLAUDE_TIMEOUT_MS'));
  ok('default tetap 90000', /CLAUDE_TIMEOUT_MS\s*\|\|\s*90000/.test(s));
  ok('tidak ada lagi timeout: 90000 telanjang', !/timeout:\s*90000\s*$/m.test(s));
}

console.log('\n== deepseekService.js ==');
{
  const s = src('deepseekService.js');
  ok('membaca DEEPSEEK_TIMEOUT_MS', s.includes('DEEPSEEK_TIMEOUT_MS'));
  ok('default tetap 90000', /DEEPSEEK_TIMEOUT_MS\s*\|\|\s*90000/.test(s));
  ok('tidak ada lagi timeout: 90000, telanjang', !/timeout:\s*90000,\s*$/m.test(s));
}

console.log('\n== qwenService.js ==');
{
  const s = src('qwenService.js');
  ok('membaca QWEN_TIMEOUT_MS', s.includes('QWEN_TIMEOUT_MS'));
  ok('default tetap 60000', /QWEN_TIMEOUT_MS\s*\|\|\s*60000/.test(s));
  ok('tidak ada lagi timeout: 60000, telanjang', !/timeout:\s*60000,\s*$/m.test(s));
}

console.log('\n== kimiService.js — sudah dari M102, kontrol tetap utuh ==');
{
  const s = src('kimiService.js');
  ok('membaca KIMI_TIMEOUT_MS', s.includes('KIMI_TIMEOUT_MS'));
  ok('default tetap 90000', /KIMI_TIMEOUT_MS\s*\|\|\s*90000/.test(s));
}

/* ⚠️ M167 — DIJAGA UNTUK PROVIDER YANG SEDANG AKTIF, BUKAN UNTUK "kimi".
 *
 * Versi lama berkas ini hanya memeriksa KIMI_TIMEOUT_MS, karena saat ditulis
 * kimi memang provider primernya. Pada 29 Agu 2026 AI_PRIMARY_PROVIDER sudah
 * berpindah ke `qwen` — dan QWEN_TIMEOUT_MS tidak pernah di-set sama sekali,
 * jadi diam-diam memakai default 60 detik. Bug latensi yang sama persis
 * kembali di provider berbeda, sementara tes ini tetap hijau untuk kimi.
 *
 * Sekarang yang dikunci adalah SIFATNYA: provider mana pun yang sedang aktif
 * harus punya timeout EKSPLISIT dan wajar di .env.
 */
console.log('\n== .env — provider primer yang SEDANG AKTIF harus punya timeout eksplisit ==');
{
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    const primaryMatch = env.match(/^AI_PRIMARY_PROVIDER\s*=\s*(\S+)/m);
    const primary = primaryMatch ? primaryMatch[1].trim().toLowerCase() : null;
    console.log(`  (AI_PRIMARY_PROVIDER saat ini: ${primary})`);

    // Nama env timeout tidak selalu = nama provider (openai → CHAT_GPT_TIMEOUT_MS).
    const ENV_KEY = {
      qwen: 'QWEN_TIMEOUT_MS', kimi: 'KIMI_TIMEOUT_MS', deepseek: 'DEEPSEEK_TIMEOUT_MS',
      openrouter: 'OPENROUTER_TIMEOUT_MS', chatgpt: 'CHAT_GPT_TIMEOUT_MS', openai: 'CHAT_GPT_TIMEOUT_MS',
      claude: 'CLAUDE_TIMEOUT_MS',
    };
    const key = ENV_KEY[primary];
    ok(`provider aktif "${primary}" dikenali (punya env timeout)`, !!key, `primary=${primary}`);

    if (key) {
      const m = env.match(new RegExp(`^${key}\\s*=\\s*(\\d+)`, 'm'));
      ok(`${key} diisi eksplisit (tidak mewarisi default panjang diam-diam)`, !!m,
        `${key} tidak ditemukan di .env`);
      if (m) {
        ok(`${key} <= 30000 (customer WhatsApp tidak menunggu >30 detik)`,
          Number(m[1]) <= 30000, m[1]);
      }
    }

    // Semua provider yang punya kredensial juga sebaiknya eksplisit — supaya
    // mengganti AI_PRIMARY_PROVIDER besok tidak menghidupkan ulang bug ini.
    for (const k of ['QWEN_TIMEOUT_MS', 'KIMI_TIMEOUT_MS', 'DEEPSEEK_TIMEOUT_MS',
      'OPENROUTER_TIMEOUT_MS', 'CHAT_GPT_TIMEOUT_MS', 'CLAUDE_TIMEOUT_MS']) {
      const m = env.match(new RegExp(`^${k}\\s*=\\s*(\\d+)`, 'm'));
      ok(`${k} eksplisit`, !!m, `${k} belum di-set`);
    }
  } else {
    console.log('  (.env tidak ada di lingkungan ini — lewati, ini bukan lingkungan produksi)');
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${total} passed${pass === total ? ' ALL PASS' : ' (FAILURES)'}`);
process.exit(pass === total ? 0 : 1);

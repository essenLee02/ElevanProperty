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
 * (CHAT_GPT_TIMEOUT_MS, CLAUDE_TIMEOUT_MS, DEEPSEEK_TIMEOUT_MS, QWEN_TIMEOUT_MS),
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
  ok('membaca CHAT_GPT_TIMEOUT_MS', s.includes('CHAT_GPT_TIMEOUT_MS'));
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

console.log('\n== .env — provider primer aktual (kimi) diturunkan ke 30 detik ==');
{
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    const primaryMatch = env.match(/^AI_PRIMARY_PROVIDER\s*=\s*(\S+)/m);
    const primary = primaryMatch ? primaryMatch[1].trim() : null;
    console.log(`  (AI_PRIMARY_PROVIDER saat ini: ${primary})`);
    const kimiTimeoutMatch = env.match(/^KIMI_TIMEOUT_MS\s*=\s*(\d+)/m);
    ok('KIMI_TIMEOUT_MS diisi eksplisit (bukan diam-diam default 90000)', !!kimiTimeoutMatch,
      'KIMI_TIMEOUT_MS tidak ditemukan di .env');
    if (kimiTimeoutMatch) {
      ok('KIMI_TIMEOUT_MS <= 30000 (respons cepat, fallback tidak menunggu lama)',
        Number(kimiTimeoutMatch[1]) <= 30000, kimiTimeoutMatch[1]);
    }
  } else {
    console.log('  (.env tidak ada di lingkungan ini — lewati, ini bukan lingkungan produksi)');
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${total} passed${pass === total ? ' ALL PASS' : ' (FAILURES)'}`);
process.exit(pass === total ? 0 : 1);

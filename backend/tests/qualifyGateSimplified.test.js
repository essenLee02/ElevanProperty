/**
 * qualifyGateSimplified.test.js — regresi M125.
 *
 * ⚠️ TRANSKRIP NYATA (20 Agu 2026): gerbang pra-kualifikasi (buildQualifyReply,
 * whatsappAIService.js, dipakai saat RESPOND_CATALOG_RUN=ON) membundel DUA
 * pertanyaan sekaligus dalam satu pesan — kota DAN budget:
 *
 *   "Baik! Mau sewa Rumah. 📍
 *
 *   Di kota mana yang Anda inginkan?
 *   (Contoh: Surabaya, Malang, Bali, Jakarta Selatan)
 *   Kalau sudah ada area/kecamatan tertentu, boleh sekalian disebut ya.
 *
 *   Dan kisaran harga yang Anda siapkan? (Contoh: 5-10 juta/bulan, atau
 *   500 juta - 1 miliar) 💰"
 *
 * Permintaan pemilik proyek: SATU pertanyaan per pesan — tanya kota SAJA,
 * budget menyusul di giliran berikutnya. Berlaku untuk semua kombinasi
 * transaksi & tipe properti (KASUS 2/3/4 di buildQualifyReply — bukan hanya
 * lokasi, tapi juga saat transaksi atau tipe properti yang masih kosong).
 *
 * Run: node tests/qualifyGateSimplified.test.js
 */
'use strict';

require('dotenv').config();
const { buildQualifyReply } = require('../services/whatsappAIService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

// catalogMode='ON' → gerbang selalu jalan penuh (bukan hanya pesan pertama).
const CATALOG_ON = 'ON';

console.log('\n== Group 1: transkrip nyata — KASUS 4 (lokasi kosong) TIDAK lagi membundel budget ==');
{
  const filters = { buildingType: 'house', transactionType: 'rent', location: null, budget: null };
  const r = buildQualifyReply(filters, 'mau sewa rumah', 'Nigel', 'none', [], CATALOG_ON);
  ok('balasan ada', !!r);
  ok('menanyakan kota', /kota/i.test(r.reply));
  ok('TIDAK menanyakan budget di pesan yang sama', !/kisaran harga|budget/i.test(r.reply), r.reply);
  ok('TIDAK menyebut area/kecamatan tambahan (satu topik saja)', !/area\/kecamatan/i.test(r.reply), r.reply);
}

console.log('\n== Group 2: KASUS 2 (transaksi kosong, tipe & kota sudah ada) TIDAK lagi membundel budget ==');
{
  // loc sudah terisi supaya kondisi KASUS 1 (!tx && !loc && !bud) TIDAK
  // terpenuhi — jalur ini harus jatuh ke KASUS 2 (else if (!tx)).
  const filters = { buildingType: 'apartment', transactionType: null, location: 'Surabaya', budget: null };
  const r = buildQualifyReply(filters, 'mau apartemen di Surabaya', 'Nigel', 'none', [], CATALOG_ON);
  ok('balasan ada', !!r);
  ok('menanyakan sewa/beli', /sewa|beli/i.test(r.reply));
  ok('TIDAK ikut menanyakan budget sebagai bullet tambahan', !/kisaran harga|budget/i.test(r.reply), r.reply);
}

console.log('\n== Group 3: KASUS 3 (tipe properti kosong) TIDAK lagi membundel kota+budget ==');
{
  const filters = { buildingType: null, transactionType: 'sale', location: null, budget: null };
  const r = buildQualifyReply(filters, 'mau beli properti', 'Nigel', 'none', [], CATALOG_ON);
  ok('balasan ada', !!r);
  ok('menanyakan tipe properti', /tipe properti/i.test(r.reply));
  ok('TIDAK ikut menanyakan kota', !/kota/i.test(r.reply), r.reply);
  ok('TIDAK ikut menanyakan budget', !/kisaran harga|budget/i.test(r.reply), r.reply);
}

console.log('\n== Group 4: KASUS 5 (hanya budget kosong) TETAP bertanya budget — tidak dihapus ==');
{
  const filters = { buildingType: 'house', transactionType: 'rent', location: 'Surabaya', budget: null };
  const r = buildQualifyReply(filters, 'Surabaya', 'Nigel', 'none', [], CATALOG_ON);
  ok('balasan ada', !!r);
  ok('menanyakan budget (satu-satunya info yang kosong)', /kisaran harga/i.test(r.reply), r.reply);
  // M127: transkrip nyata menunjukkan pesan ini masih verbose ("Hampir
  // lengkap!" + paragraf "kalau belum ada angka pasti..."). Disederhanakan
  // jadi satu kalimat + contoh saja, sama seperti KASUS 2/3/4 (M125).
  ok('TIDAK ada basa-basi "Hampir lengkap!"', !/hampir lengkap/i.test(r.reply), r.reply);
  ok('TIDAK ada paragraf tambahan "kalau belum ada angka pasti"',
    !/belum ada angka pasti/i.test(r.reply), r.reply);
}

console.log('\n== Group 5: KONTROL — semua 4 info lengkap → tidak ada gate reply (lanjut ke AI) ==');
{
  const filters = { buildingType: 'house', transactionType: 'rent', location: 'Surabaya', budget: '5-10jt' };
  const r = buildQualifyReply(filters, 'oke', 'Nigel', 'none', [], CATALOG_ON);
  ok('return null (proceed to AI)', r === null, JSON.stringify(r));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

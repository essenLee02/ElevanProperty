/**
 * kosVariants.test.js — regresi M120.
 *
 * ⚠️ KEJADIAN NYATA (log Kirimi 19 Agu 2026 16:03:05):
 *
 *     Message : Hi.. Saya mau ngekos di Madiun
 *     Status  : ⏭️  Tidak disimpan ke DB, AI skip (bukan query properti)
 *
 * "ngekos" adalah cara PALING LAZIM orang Indonesia menyebut sewa kamar kos,
 * tapi gerbang masuk menolaknya: 'kos' ada di PROPERTY_TYPES_STRICT_BOUNDARY,
 * jadi dicocokkan dengan \bkos\b — dan itu TIDAK cocok di dalam "ngekos".
 * Pesan customer tidak disimpan, tidak dibalas, tanpa error apa pun.
 *
 * Kelas bug yang SAMA sudah pernah terjadi: 'booking' hilang dari ACTION_WORDS
 * sehingga seluruh alur booking tak terjangkau. Bentuk berimbuhan WAJIB
 * didaftarkan sendiri saat pencocokan memakai word-boundary.
 *
 * Run: node tests/kosVariants.test.js
 */

'use strict';

const f = require('../utils/propertyKeywordFilter');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

console.log('\n== Group 1: pesan customer yang DITOLAK di produksi ==');
{
  const msg = 'Hi.. Saya mau ngekos di Madiun';
  ok('lolos gerbang properti', f.hasPropertyKeyword(msg) === true, msg);
  ok('tipe = boarding_house', f.extractPropertyTypeFromMessage(msg) === 'boarding_house',
    f.extractPropertyTypeFromMessage(msg));
  ok('transaksi = rent', f.extractTransactionTypeFromMessage(msg) === 'rent',
    f.extractTransactionTypeFromMessage(msg));
  ok('kota = madiun', f.extractLocationFromMessage(msg) === 'madiun',
    f.extractLocationFromMessage(msg));
}

console.log('\n== Group 2: semua bentuk berimbuhan ==');
{
  for (const [text, why] of [
    ['saya mau ngekos di Madiun', 'ngekos'],
    ['mau ngekost dekat kampus', 'ngekost'],
    ['cari ngekosan murah', 'ngekosan'],
    ['mau indekos di Malang', 'indekos'],
    ['cari indekost putri', 'indekost'],
    ['cari kostan murah di Surabaya', 'kostan'],
    ['mau kos di Jogja', 'kos (bentuk dasar, sudah jalan)'],
    ['cari kost putri', 'kost (bentuk dasar, sudah jalan)'],
    ['ada kosan kosong?', 'kosan'],
  ]) {
    ok(`gerbang menerima: ${why}`, f.hasPropertyKeyword(text) === true, text);
    ok(`  tipe boarding_house: ${why}`,
      f.extractPropertyTypeFromMessage(text) === 'boarding_house',
      `${text} → ${f.extractPropertyTypeFromMessage(text)}`);
  }
}

console.log('\n== Group 3: KONTROL NEGATIF — kata mirip TIDAK boleh ikut ==');
{
  // Kata-kata ini mengandung "kos" sebagai potongan huruf, BUKAN kos-kosan.
  for (const text of ['beli kosmetik', 'kosong melompong', 'kosakata baru']) {
    ok(`ditolak: ${text}`, f.hasPropertyKeyword(text) === false, text);
  }
  // Bukan tipe kos, walau ada kata "kosong".
  ok('"kosong" tidak dibaca sebagai kos',
    f.extractPropertyTypeFromMessage('rumahnya kosong') !== 'boarding_house',
    f.extractPropertyTypeFromMessage('rumahnya kosong'));
  ok('"kosmetik" tidak dibaca sebagai kos',
    f.extractPropertyTypeFromMessage('beli kosmetik') !== 'boarding_house',
    f.extractPropertyTypeFromMessage('beli kosmetik'));
}

console.log('\n== Group 4: tipe lain tidak terganggu ==');
{
  ok('rumah tetap house',
    f.extractPropertyTypeFromMessage('mau beli rumah di Surabaya') === 'house');
  ok('apartemen tetap apartment',
    f.extractPropertyTypeFromMessage('sewa apartemen') === 'apartment');
  ok('gudang tetap warehouse',
    f.extractPropertyTypeFromMessage('beli gudang') === 'warehouse');
  ok('beli tetap sale',
    f.extractTransactionTypeFromMessage('mau beli rumah') === 'sale');
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

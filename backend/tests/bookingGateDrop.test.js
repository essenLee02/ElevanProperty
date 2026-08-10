/**
 * bookingGateDrop.test.js — regresi M87.
 *
 * Gejala produksi (KIRIMI, 7 Agu 2026):
 *   [KIRIMI] ⬇  PESAN MASUK (bukan query properti — tidak dibalas)
 *   [KIRIMI]    Message  : Saya booking hotel di Surabaya
 *   [KIRIMI]    Status   : ⏭️  Tidak disimpan ke DB, AI skip (bukan query properti)
 *
 * Pesan pembuka yang SEMPURNA — transaksi (booking) + tipe (hotel) + kota
 * (Surabaya) sekaligus — dibuang gate tanpa dibalas dan tanpa disimpan.
 *
 * AKAR: gate = (tipe properti) DAN (kata aksi). Q1 mengenal TIGA transaksi —
 * sewa / beli / **booking** — dan seluruh alur punya cabang `isBooking`
 * (hotel/kondotel), tapi kata "booking" TIDAK PERNAH ada di ACTION_WORDS.
 * Akibatnya gate hanya meloloskan kalimat booking yang KEBETULAN memuat kata
 * aksi lain: "Saya *mau* booking hotel" lolos, "Saya booking hotel" tidak.
 *
 * AKAR KEDUA (di balik gate): extractTransactionTypeFromMessage juga tidak
 * mengenal booking, padahal propertyRecommendationService sudah memetakan
 * booking→rent. Dua ekstraktor untuk konsep yang sama, isi berbeda.
 *
 * AKAR KETIGA: 'kondotel' tidak ada di PROPERTY_TYPES gate, padahal
 * findNextQuestion memakai (hotel|kondotel) untuk cabang booking.
 *
 * Run: node tests/bookingGateDrop.test.js
 */

'use strict';

require('dotenv').config();

const {
  hasPropertyKeyword,
  extractTransactionTypeFromMessage,
  extractPropertyTypeFromMessage,
  extractLocationFromMessage,
} = require('../utils/propertyKeywordFilter');
const { extractQualificationState, findNextQuestion } = require('../services/aiPromptBuilderService');
const { extractPropertyFilters } = require('../services/propertyRecommendationService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

// ───────────────────────────────────────────────────────────────────────────
console.log('── Group 1: pesan produksi PERSIS harus lolos gate ──');
{
  const M = 'Saya booking hotel di Surabaya';
  ok('gate meloloskan pesan yang dilaporkan user', hasPropertyKeyword(M) === true);
  ok('tipe terdeteksi = hotel',        extractPropertyTypeFromMessage(M) === 'hotel');
  ok('kota terdeteksi = surabaya',     /surabaya/i.test(extractLocationFromMessage(M) || ''));
  ok('transaksi terdeteksi = rent (booking = sewa)',
     extractTransactionTypeFromMessage(M) === 'rent', extractTransactionTypeFromMessage(M));
}

console.log('\n── Group 2: "booking" tidak lagi butuh kata aksi pendamping ──');
{
  // Perbedaan yang tidak masuk akal bagi customer: yang satu lolos, yang lain tidak.
  ok('"Saya mau booking hotel di Surabaya" lolos (dulu juga lolos)',
     hasPropertyKeyword('Saya mau booking hotel di Surabaya') === true);
  ok('"Saya booking hotel di Surabaya" lolos (dulu DIBUANG)',
     hasPropertyKeyword('Saya booking hotel di Surabaya') === true);
  ok('keduanya diperlakukan sama',
     hasPropertyKeyword('Saya mau booking hotel di Surabaya') ===
     hasPropertyKeyword('Saya booking hotel di Surabaya'));
}

console.log('\n── Group 3: variasi kalimat booking yang lazim ──');
{
  const should = [
    'booking hotel di Surabaya',
    'Booking hotel',
    'Saya booking apartemen di Surabaya',
    'Saya booking villa di Bali',
    'Saya booking kondotel di Batu',
    'booking condotel Bali',
    'reservasi hotel di Malang',
    'Mau menginap di villa Bali',
    'nginap di hotel surabaya',
    'check in hotel tanggal 10',
    'I want to book a hotel in Bali',
    'book villa in Seminyak',
  ];
  for (const m of should) ok(`lolos: "${m}"`, hasPropertyKeyword(m) === true);
}

console.log('\n── Group 4: KONTROL NEGATIF — booking non-properti tetap ditolak ──');
{
  // Gate tetap mewajibkan TIPE PROPERTI, jadi booking apa pun di luar properti
  // tidak boleh ikut lolos.
  const shouldNot = [
    'booking tiket pesawat',
    'booking tiket kereta ke Jakarta',
    'Saya mau booking meja restoran',
    'reservasi tempat makan malam',
    'saya buka facebook dulu',          // 'book' ⊂ facebook
    'ada notebook murah?',              // 'book' ⊂ notebook
    'km mau cari bebek goreng',
    'sewa mobil dong',
    'cari kunci motor hilang',
  ];
  for (const m of shouldNot) ok(`ditolak: "${m}"`, hasPropertyKeyword(m) === false);
}

console.log('\n── Group 5: dua ekstraktor transaksi harus SEPAKAT ──');
{
  // propertyRecommendationService sudah memetakan booking→rent sejak lama;
  // propertyKeywordFilter tidak. Kunci keduanya agar tidak menyimpang lagi.
  for (const m of ['Saya booking hotel di Surabaya', 'reservasi hotel di Malang', 'nginap di villa Bali']) {
    const a = extractTransactionTypeFromMessage(m);
    const b = extractPropertyFilters(m, []).transactionType;
    ok(`sepakat untuk "${m}" (${a} / ${b})`, a === b && a === 'rent');
  }
  // Kontrol negatif: beli tetap sale di kedua sisi.
  const buy = 'Saya mau beli rumah di Malang';
  ok('beli tetap "sale" di kedua ekstraktor',
     extractTransactionTypeFromMessage(buy) === 'sale' &&
     extractPropertyFilters(buy, []).transactionType === 'sale');
}

console.log('\n── Group 6: alur kualifikasi benar-benar berjalan sesudah gate ──');
{
  const M = 'Saya booking hotel di Surabaya';
  const s = extractQualificationState([{ role: 'user', message: M }], M);
  ok('Q1 transaksi ✅ (rent)', s.transactionType === 'rent', s.transactionType);
  ok('tipe ✅ (hotel)',        s.buildingType === 'hotel',  s.buildingType);
  ok('Q2 kota ✅ (Surabaya)',  /surabaya/i.test(s.city || ''), s.city);

  const n = findNextQuestion(s, {});
  ok('ada pertanyaan berikutnya (bukan buntu)', !!n, JSON.stringify(n));
  ok('TIDAK bertanya ulang Q1/Q2 yang sudah dijawab',
     !!n && !['Q1', 'Q2'].includes(n.q), `q=${n && n.q}`);
  // Booking = hotel → Q2c dan Q2b memang sengaja dilewati (isBooking).
  ok('booking hotel melewati Q2c/Q2b sesuai desain',
     !!n && !['Q2c', 'Q2b'].includes(n.q), `q=${n && n.q}`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);

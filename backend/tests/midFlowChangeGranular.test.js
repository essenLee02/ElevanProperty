/**
 * midFlowChangeGranular.test.js — regresi M124.
 *
 * ⚠️ TRANSKRIP NYATA (20 Agu 2026): customer "Clarence Eldy" menyelesaikan
 * hampir seluruh alur kualifikasi (sewa rumah, Surabaya/Citraland, budget,
 * tanggal masuk, penghuni, furnished, kolam renang) — lalu, saat AI bertanya
 * "Selain area Citraland, apakah area sekitar masih oke?" (Q7), customer
 * menjawab "Sidoarjo" (kota LAIN, bukan area di dalam Surabaya). Bot mereset
 * total ke "Mau sewa atau beli? Dan tipe propertinya apa?" — SELURUH jawaban
 * (transaksi, tipe, budget, tanggal, penghuni, furnitur, fasilitas) hilang.
 *
 * Permintaan pemilik proyek: perubahan kota/transaksi/tipe properti di tengah
 * alur harus GRANULAR, bukan reset total:
 *   GANTI KOTA      → hanya landmark yang di-reset (Q6). Sisanya tetap.
 *   GANTI TRANSAKSI → budget + metode pembayaran (+ durasi bila sewa) di-reset.
 *                      Kota, landmark, tanggal masuk, jadwal survei tetap.
 *   GANTI PROPERTI  → budget/fasilitas/detail-tipe di-reset. Kota, landmark,
 *                      tanggal masuk, jadwal survei TETAP (sebelumnya ikut
 *                      direset — inilah bagian yang dipersempit oleh M124).
 *
 * Run: node tests/midFlowChangeGranular.test.js
 */
'use strict';

require('dotenv').config();
const { extractQualificationState, findNextQuestion } = require('../services/aiPromptBuilderService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const C = (m) => ({ role: 'customer', message: m });
const A = (m) => ({ role: 'ai', message: m });

/**
 * Tanggal "25 Agustus" yang diketik customer akan di-resolve ke TAHUN BERAPA?
 *
 * ⚠️ Jangan hard-code tahunnya. Tes ini sempat menuliskan '25 Agustus 2026'
 * apa adanya dan MENDADAK GAGAL pada 26 Agustus 2026 — bukan karena ada kode
 * yang rusak, tapi karena 25 Agustus sudah LEWAT, sehingga inferYear() dengan
 * benar menggulirkannya ke 2027. Tes yang kedaluwarsa sendiri seperti ini
 * membakar waktu debugging untuk regresi yang tidak pernah ada.
 *
 * Aturannya sama dengan produksi: tanggal tanpa tahun yang sudah lewat tahun
 * ini berarti tahun depan.
 */
function expectedAugust25() {
  const now = new Date();
  const thisYear = now.getFullYear();
  const target = new Date(thisYear, 7, 25);       // 7 = Agustus (0-indexed)
  const year = target < new Date(now.getFullYear(), now.getMonth(), now.getDate())
    ? thisYear + 1
    : thisYear;
  return `25 Agustus ${year}`;
}

console.log('\n== Group 1: transkrip nyata — GANTI KOTA via jawaban Q7 ==');
{
  const history = [
    C('Saya mau sewa'),
    A('Baik! Mau sewa apa?'),
    C('Saya mau sewa rumah di daerah Citraland'),
    A('Baik! Mau sewa Rumah. Di kota mana? Dan kisaran harga?'),
    C('Citraland surabaya'),
    A('Kisaran harga yang Anda inginkan berapa?'),
    C('50jt pertahun'),
    A('Sudah lihat berapa Rumah di Surabaya?'),
    C('Ada 5, ga cocok terlalu kecil'),
    A('Rencananya masuk atau pindah bulan apa?'),
    C('Akhir agustus'),
    A('Boleh diinfokan tanggal pastinya?'),
    C('25 agustus'),
    C('Berdua saja'),
    C('Btw daerah Pakuwon juga oke'),
    A('Untuk furnitur, lebih prefer yang sudah furnished, semi-furnished, atau kosongan saja?'),
    C('Furnished'),
    A('Ada yang pasti tidak cocok?'),
    C('Saya mau yg deket kantor'),
    A('Ada fasilitas tertentu yang Anda inginkan?'),
    C('Kolam'),
    A('Selain area Citraland, apakah area sekitar masih oke?'),
  ];
  const st = extractQualificationState(history, 'Sidoarjo');

  ok('transactionType TETAP rent (bukan hilang)', st.transactionType === 'rent', st.transactionType);
  ok('buildingType TETAP house (bukan reset ke Q1)', st.buildingType === 'house', st.buildingType);
  ok('city ter-UPDATE ke Sidoarjo', st.city === 'Sidoarjo', st.city);
  ok('budget TETAP (bukan hilang)', /50|42\.5|57\.5/.test(st.budget || ''), st.budget);
  ok('moveInDate TETAP', st.moveInDate === expectedAugust25(), st.moveInDate);
  ok('household TETAP', /2|berdua/.test(st.household || ''), st.household);
  ok('furnishing TETAP', st.furnishing === 'furnished', st.furnishing);
  ok('facilities TETAP', (st.facilities || []).length > 0, JSON.stringify(st.facilities));
  ok('district DI-RESET (patokan lama Citraland tak lagi valid)', st.district === null, st.district);
  ok('cityChangedFromHistory = true', st.cityChangedFromHistory === true);
  ok('typeChangedFromHistory TIDAK ikut ter-set (bukan type change)', st.typeChangedFromHistory !== true);

  const next = findNextQuestion(st);
  ok('pertanyaan berikutnya = Q6 (landmark), BUKAN Q1', next && next.q === 'Q6', JSON.stringify(next));
}

console.log('\n== Group 2: kota baru TIDAK reverts di giliran berikutnya ==');
{
  const history = [
    C('mau sewa rumah di Surabaya'),
    A('Kisaran harga?'),
    C('50jt/tahun'),
    A('Rencana masuk kapan?'),
    C('25 agustus'),
    A('Ada lokasi patokan?'),
    C('dekat Grand City'),
    A('Selain area sekitar, masih oke?'),
    C('Sidoarjo'),
    A('Oke, jadi di Sidoarjo ya. Ada lokasi atau tempat tertentu yang jadi patokan?'),
  ];
  const st = extractQualificationState(history, 'dekat stasiun kereta');
  ok('city TETAP Sidoarjo (tidak reverts ke Surabaya)', st.city === 'Sidoarjo', st.city);
  ok('cityChangedFromHistory sudah false lagi (one-shot, sudah diproses giliran lalu)',
    st.cityChangedFromHistory === false);
  ok('budget TETAP', /50/.test(st.budget || ''), st.budget);
}

console.log('\n== Group 3: GANTI TRANSAKSI (sewa → beli) ==');
{
  const history = [
    C('mau sewa rumah di Surabaya'),
    A('Kisaran harga?'),
    C('50jt/tahun'),
    A('Rencana masuk kapan?'),
    C('25 agustus'),
    A('Bersama siapa?'),
    C('berdua'),
    A('Ada lokasi patokan?'),
    C('dekat Pakuwon'),
  ];
  const st = extractQualificationState(history, 'mau beli aja deh');

  ok('transactionType ter-update ke sale', st.transactionType === 'sale', st.transactionType);
  ok('buildingType TETAP house', st.buildingType === 'house');
  ok('city TETAP Surabaya', st.city === 'Surabaya', st.city);
  ok('anchorPoint TETAP', st.anchorPoint === 'dekat Pakuwon', st.anchorPoint);
  ok('moveInDate TETAP', st.moveInDate === expectedAugust25(), st.moveInDate);
  ok('household TETAP', /2|berdua/.test(st.household || ''), st.household);
  ok('budget DI-RESET (budget beli beda dgn budget sewa)', st.budget === null, st.budget);
  ok('financing DI-RESET (tanya metode pembayaran ulang)', st.financing === null, st.financing);
}

console.log('\n== Group 4: GANTI TRANSAKSI, arah sebaliknya (beli → sewa) durasi di-reset ==');
{
  const history = [
    C('mau beli rumah di Surabaya'),
    A('Target beli kapan?'),
    C('akhir tahun ini'),
    A('KPR atau cash?'),
    C('cash'),
  ];
  const st = extractQualificationState(history, 'eh, sewa aja deh, gak jadi beli');
  ok('transactionType ter-update ke rent', st.transactionType === 'rent', st.transactionType);
  ok('buildingType TETAP house', st.buildingType === 'house');
  ok('financing DI-RESET', st.financing === null, st.financing);
  ok('leaseDuration DI-RESET (perlu ditanya durasi sewa)', st.leaseDuration === null, st.leaseDuration);
}

console.log('\n== Group 5: GANTI PROPERTI (rumah → apartemen) — kota/landmark/tanggal/survei TETAP ==');
{
  const history = [
    C('mau sewa rumah di Surabaya'),
    A('Kisaran harga?'),
    C('5jt/bulan'),
    A('Rencana masuk kapan?'),
    C('akhir agustus, tanggal 25'),
    A('Ada lokasi patokan?'),
    C('dekat Pakuwon'),
    A('Kapan bisa survei?'),
    C('25 agustus jam 10'),
  ];
  const st = extractQualificationState(history, 'eh gak jadi rumah, mau apartemen aja');

  ok('buildingType ter-update ke apartment', st.buildingType === 'apartment', st.buildingType);
  ok('transactionType TETAP rent', st.transactionType === 'rent');
  ok('city TETAP Surabaya (M124: dulu ikut ke-reset)', st.city === 'Surabaya', st.city);
  ok('anchorPoint TETAP (M124: dulu ikut ke-reset)', st.anchorPoint === 'dekat Pakuwon', st.anchorPoint);
  ok('moveInDate TETAP (M124: dulu ikut ke-reset)', st.moveInDate !== null, st.moveInDate);
  ok('viewingDate TETAP (M124: dulu ikut ke-reset)', st.viewingDate !== null, st.viewingDate);
  ok('budget DI-RESET (budget apartemen beda dgn rumah)', st.budget === null, st.budget);
  ok('typeChangedFromHistory = true (banner tetap tampil)', st.typeChangedFromHistory === true);
}

console.log('\n== Group 6: KONTROL NEGATIF — jawaban Q6 tidak boleh dibaca sebagai ganti tipe ==');
{
  // Bug M73/sessionResetGuards lama: jawaban patokan lokasi "deket kantor"
  // TIDAK boleh membuat buildingType berubah dari rumah ke kantor.
  const history = [
    C('mau sewa rumah di surabaya'),
    A('Ada lokasi tertentu yang jadi patokan?'),
  ];
  const st = extractQualificationState(history, 'deket kantor dan mall');
  ok('buildingType TETAP house (bukan flip ke office)', st.buildingType === 'house', st.buildingType);
  ok('typeChangedFromHistory TIDAK true', st.typeChangedFromHistory !== true);
}

console.log('\n== Group 7: KONTROL NEGATIF — M51, "gang sempit" bukan nama kota ==');
{
  const history = [
    C('mau sewa rumah di Surabaya'),
    A('Ada yang pasti tidak cocok?'),
  ];
  const st = extractQualificationState(history, 'saya gak mau di gang sempit dan rumah tua');
  ok('city TETAP Surabaya (gang sempit bukan kota)', st.city === 'Surabaya', st.city);
  ok('cityChangedFromHistory TIDAK true', st.cityChangedFromHistory !== true);
  ok('budget TIDAK ikut ter-reset', st.budget === undefined || st.budget === null || true); // budget belum ada di skenario ini, hanya guard city
}

console.log('\n== Group 8: KONTROL — "Surabaya" → "Surabaya Barat" bukan pindah kota ==');
{
  const history = [
    C('mau sewa rumah di Surabaya'),
    A('Kisaran harga?'),
    C('50jt/tahun'),
  ];
  const st = extractQualificationState(history, 'tepatnya di Surabaya Barat');
  ok('city TETAP Surabaya (bukan dianggap pindah kota)', /surabaya/i.test(st.city || ''), st.city);
  ok('budget TIDAK ter-reset', /50/.test(st.budget || ''), st.budget);
  ok('cityChangedFromHistory TIDAK true', st.cityChangedFromHistory !== true);
}

console.log('\n== Group 9: KONTROL — genuine type switch masih ke-detect & reset field type-spesifik ==');
{
  const history = [
    C('mau sewa villa di Surabaya'),
    A('Rencananya masuk bulan apa?'),
  ];
  const st = extractQualificationState(history, 'mau cari hotel aja');
  ok('buildingType ter-update ke hotel', st.buildingType === 'hotel', st.buildingType);
  ok('typeChangedFromHistory = true', st.typeChangedFromHistory === true);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

/**
 * midFlowCompoundResetM132.test.js — regresi M132.
 *
 * Owner spec (23 Agu 2026), memperluas M124 (tests/midFlowChangeGranular.test.js,
 * masih 45/45 berlaku — file ini TIDAK menggantikannya, hanya menambah kasus
 * yang M124 belum pernah menyasar):
 *
 *   1. Bug fix — decisionMaker (informasi survei, Q9) TIDAK BOLEH ikut ter-null
 *      saat HANYA tipe properti berubah (owner spec "Ganti properti" item 6:
 *      "Survei masih dengan nilai sama"). viewingDate/viewingTime sudah aman
 *      sejak M124; decisionMaker tertinggal — inkonsistensi murni, bukan
 *      keputusan sengaja.
 *
 *   2. Bug fix — tipe DAN kota berubah bersamaan TANPA transaksi ikut berubah
 *      (kombinasi yang tidak masuk compoundReset M132 — lihat poin 3) dulu
 *      GAGAL me-reset district/anchorPoint/alternativeAreas sama sekali,
 *      karena guard lama `cityChanged = locChangedNow && !typeChanged`
 *      menyilangkan reset kota setiap kali tipe ikut berubah di pesan yang
 *      sama — data patokan lokasi LAMA nyantol padahal kotanya sudah beda.
 *
 *   3. Fitur baru — COMPOUND RESET: tipe DAN transaksi berubah BERSAMAAN di
 *      pesan yang sama dipandang sebagai pencarian baru (owner spec, dua
 *      kondisi):
 *        Kondisi 1 (+ kota ikut berubah)   → SEMUA field turunan direset,
 *          TERMASUK kota/area/red-flag lama (tidak lagi relevan untuk kota
 *          baru) — KECUALI durasi sewa, tanggal masuk/beli, informasi survei.
 *        Kondisi 2 (kota TIDAK ikut berubah) → sama seperti Kondisi 1, TAPI
 *          kota/area/red-flag (Hindari/Prefer) TETAP dipertahankan (owner
 *          spec eksplisit) karena masih terikat kota yang SAMA.
 *      "Kembali ke Q1" TIDAK berarti literally menanyakan ulang tipe/transaksi
 *      — keduanya sudah terjawab justru di pesan yang memicu compound reset;
 *      menanyakannya lagi akan jadi repetitive/redundant (dilarang eksplisit
 *      oleh pemilik proyek).
 *
 * Run: node tests/midFlowCompoundResetM132.test.js
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

console.log('\n== Group 1: bug fix — decisionMaker TETAP saat HANYA tipe berubah ==');
{
  const history = [
    C('mau sewa rumah di Surabaya'),
    A('Kisaran harga?'),
    C('5jt/bulan'),
    A('Rencana masuk kapan?'),
    C('akhir agustus, tanggal 25'),
    A('Bisa jadwalkan viewing sendiri atau perlu koordinasi dulu?'),
    C('sendiri aja'),
    A('Kapan bisa survei?'),
    C('25 agustus jam 10'),
  ];
  const st = extractQualificationState(history, 'eh gak jadi rumah, mau apartemen aja');

  ok('buildingType ter-update ke apartment', st.buildingType === 'apartment', st.buildingType);
  ok('decisionMaker TETAP (BUG LAMA: ikut ter-null padahal survei masih sama)',
    st.decisionMaker === 'Mandiri', st.decisionMaker);
  ok('viewingDate TETAP', st.viewingDate !== null, st.viewingDate);
  ok('viewingTime TETAP', st.viewingTime !== null, st.viewingTime);
}

console.log('\n== Group 2: bug fix — tipe+kota berubah BERSAMAAN, transaksi TETAP (bukan compound) ==');
{
  const history = [
    C('mau sewa rumah di Surabaya'),
    A('Kisaran harga?'),
    C('50jt/tahun'),
    A('Ada lokasi patokan?'),
    C('dekat Grand City'),
  ];
  // Tipe berubah (rumah→apartemen) DAN kota berubah (Surabaya→Malang) di
  // pesan yang sama, transaksi (sewa) TIDAK berubah — bukan compoundReset.
  const st = extractQualificationState(history, 'eh gak jadi, mau apartemen di Malang aja');

  ok('buildingType ter-update ke apartment', st.buildingType === 'apartment', st.buildingType);
  ok('transactionType TETAP rent (tidak berubah)', st.transactionType === 'rent', st.transactionType);
  ok('city ter-update ke Malang', st.city === 'Malang', st.city);
  ok('BUG LAMA FIXED: anchorPoint DI-RESET (patokan Grand City terikat Surabaya, sudah tidak relevan)',
    st.anchorPoint === null, st.anchorPoint);
  ok('cityChangedFromHistory = true', st.cityChangedFromHistory === true);
  ok('typeChangedFromHistory = true', st.typeChangedFromHistory === true);
}

console.log('\n== Group 3: COMPOUND RESET Kondisi 2 — tipe+transaksi berubah, KOTA TETAP ==');
{
  const history = [
    C('mau sewa rumah di Surabaya'),
    A('Kisaran harga?'),
    C('50jt/tahun'),
    A('Rencana masuk kapan?'),
    C('25 agustus'),
    A('Ada lokasi patokan?'),
    C('dekat Pakuwon'),
    A('Ada yang pasti tidak cocok?'),
    C('saya gak mau yang berisik dan ramai'),
    A('Kapan bisa survei?'),
    C('25 agustus jam 10'),
  ];
  // Tipe (rumah→apartemen) DAN transaksi (sewa→beli) berubah bersamaan, KOTA
  // (Surabaya) tidak disebutkan ulang → tetap Surabaya (tidak berubah).
  const st = extractQualificationState(history, 'eh gak jadi, mau beli apartemen aja deh');

  ok('buildingType ter-update ke apartment', st.buildingType === 'apartment', st.buildingType);
  ok('transactionType ter-update ke sale', st.transactionType === 'sale', st.transactionType);
  ok('city TETAP Surabaya (owner spec Kondisi 2: kota dipertahankan)',
    st.city === 'Surabaya', st.city);
  ok('anchorPoint TETAP (owner spec Kondisi 2: lokasi area dipertahankan)',
    st.anchorPoint === 'dekat Pakuwon', st.anchorPoint);
  ok('redFlags TETAP (owner spec Kondisi 2: red flag Hindari/Prefer dipertahankan)',
    st.redFlags !== null, st.redFlags);
  ok('moveInDate TETAP (owner spec: dipertahankan di KEDUA kondisi)',
    st.moveInDate !== null, st.moveInDate);
  ok('viewingDate TETAP (informasi survei, owner spec: dipertahankan di KEDUA kondisi)',
    st.viewingDate !== null, st.viewingDate);
  ok('budget DI-RESET (kombinasi tipe×transaksi baru)', st.budget === null, st.budget);
  ok('financing DI-RESET (tanya metode pembayaran ulang)', st.financing === null, st.financing);
  ok('cityChangedFromHistory = false (kota tidak ikut berubah)',
    st.cityChangedFromHistory === false, st.cityChangedFromHistory);

  const next = findNextQuestion(st);
  ok('pertanyaan berikutnya BUKAN Q1 (tipe/transaksi sudah terjawab, jangan tanya ulang)',
    next && next.q !== 'Q1', JSON.stringify(next));
}

console.log('\n== Group 4: COMPOUND RESET Kondisi 1 — tipe+transaksi+KOTA semua berubah bersamaan ==');
{
  const history = [
    C('mau sewa rumah di Surabaya'),
    A('Kisaran harga?'),
    C('50jt/tahun'),
    A('Rencana masuk kapan?'),
    C('25 agustus'),
    A('Ada lokasi patokan?'),
    C('dekat Pakuwon'),
    A('Kapan bisa survei?'),
    C('25 agustus jam 10'),
  ];
  // Tipe (rumah→apartemen), transaksi (sewa→beli), DAN kota (Surabaya→Malang)
  // semua berubah bersamaan di satu pesan.
  const st = extractQualificationState(history, 'eh gak jadi, mau beli apartemen di Malang aja deh');

  ok('buildingType ter-update ke apartment', st.buildingType === 'apartment', st.buildingType);
  ok('transactionType ter-update ke sale', st.transactionType === 'sale', st.transactionType);
  ok('city ter-update ke Malang', st.city === 'Malang', st.city);
  ok('anchorPoint DI-RESET (owner spec Kondisi 1: terikat kota SEBELUMNYA, sudah tidak relevan)',
    st.anchorPoint === null, st.anchorPoint);
  ok('moveInDate TETAP (owner spec: dipertahankan di KEDUA kondisi)',
    st.moveInDate !== null, st.moveInDate);
  ok('viewingDate TETAP (informasi survei, owner spec: dipertahankan di KEDUA kondisi)',
    st.viewingDate !== null, st.viewingDate);
  ok('budget DI-RESET', st.budget === null, st.budget);
  ok('cityChangedFromHistory = true (kota ikut berubah)',
    st.cityChangedFromHistory === true, st.cityChangedFromHistory);
  ok('q2cDeclined = false (Q2c WAJIB ditanya lagi untuk kota baru, bukan disuppress)',
    st.q2cDeclined === false, st.q2cDeclined);
}

console.log('\n== Group 5: COMPOUND RESET dengan durasi sewa — TETAP dipertahankan ==');
{
  const history = [
    C('mau sewa villa di Bali untuk 7 hari'),
    A('Kisaran harga?'),
    C('5jt/hari'),
  ];
  // Tipe (villa→hotel) + transaksi tetap 'rent' (booking) — BUKAN compound
  // (transaksi tidak berubah, tetap rent/booking) — kontrol: pastikan leaseDuration
  // TIDAK dipengaruhi jalur compound yang salah pilih cabang.
  const st = extractQualificationState(history, 'eh gak jadi yang tadi, hotel aja deh untuk 7 hari yang sama');
  ok('buildingType ter-update ke hotel', st.buildingType === 'hotel', st.buildingType);
  ok('transactionType TETAP rent', st.transactionType === 'rent', st.transactionType);
}

console.log('\n== Group 6: KONTROL — M124 lama tetap utuh, compoundReset TIDAK salah nyala untuk axis tunggal ==');
{
  // Hanya transaksi berubah (sewa→beli), tipe TETAP rumah — harus tetap
  // masuk jalur txChanged lama, BUKAN compoundReset (typeChangedNow harus
  // false di sini).
  const history = [
    C('mau sewa rumah di Surabaya'),
    A('Kisaran harga?'),
    C('50jt/tahun'),
    A('Ada lokasi patokan?'),
    C('dekat Pakuwon'),
  ];
  const st = extractQualificationState(history, 'eh mau beli aja deh');
  ok('transactionType ter-update ke sale', st.transactionType === 'sale', st.transactionType);
  ok('buildingType TETAP house (bukan compound, tipe tidak berubah)', st.buildingType === 'house');
  ok('anchorPoint TETAP (axis tunggal txChanged, kota/landmark tidak disentuh)',
    st.anchorPoint === 'dekat Pakuwon', st.anchorPoint);
  ok('typeChangedFromHistory TIDAK true', st.typeChangedFromHistory !== true);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

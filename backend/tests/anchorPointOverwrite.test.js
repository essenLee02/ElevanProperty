/**
 * anchorPointOverwrite.test.js
 *
 * Bug produksi (4 Agu 2026): Q6 (patokan lokasi) ditanya ulang berkali-kali
 * (gejala terpisah — race condition debounce, lihat responseDebounceConcurrency
 * .test.js). Setiap kali ditanya ulang, jawaban BAIK yang sudah ada
 * ("Di Dinoyo") bisa TERTIMPA jawaban yang LEBIH BURUK ("Tdk ada") karena
 * ekstraktor Q6 tidak punya guard "sudah terjawab, jangan timpa" — beda
 * dengan field lain yang sudah dilindungi pola serupa. Summary akhir salah
 * menampilkan "Patokan lokasi: Bebas" padahal customer sudah jelas menyebut
 * landmark di awal percakapan.
 *
 * Sekaligus: jawaban Q6 berbentuk "Di <Tempat>" (tanpa kata "dekat") kini
 * disalurkan ke `district` (Area/Q2c) — dulu hilang total begitu anchorPoint
 * sudah terisi oleh landmark lain (mis. dari jawaban Q5).
 */
const { extractQualificationState } = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });

console.log('\n── Kasus asli: Q6 ditanya ulang tidak boleh menimpa jawaban baik ──');
{
  const H = [
    u('booking hotel di malang'),
    a('Ada yang pasti tidak cocok atau ingin dihindari?'),
    u('Tdk banjir, tdk panas, dkt pasar, dkt mall, dkt stasiun kereta'), u('Akses jln lancar'), u('Gang yg lebar'),
    a('Ada lokasi atau tempat tertentu yang jadi patokan?'), u('Di Dinoyo'),
    a('Selain lokasi Malang, apakah Anda mau pilihan lokasi lainnya?'), u('Tdk mau'), u('Tetap di Malang'),
    a('Ada lokasi atau tempat tertentu yang jadi patokan?'), u('Ada lokasi atau tempat tertentu yang jadi patokan?'),
    a('Ada lokasi atau tempat tertentu yang jadi patokan?'),
  ];
  const st = extractQualificationState(H, 'Tdk ada');
  ok('anchorPoint = landmark asli dari Q5 (BUKAN "Bebas"/"Tdk ada")',
     /pasar/.test(st.anchorPoint) && /mall/.test(st.anchorPoint) && /stasiun/.test(st.anchorPoint));
  ok('district = "Dinoyo" (disalurkan dari jawaban Q6, bukan hilang)', st.district === 'Dinoyo');
  ok('city = "Malang" tetap benar', st.city === 'Malang');
}

console.log('\n── Q6 dijawab sekali, TIDAK diulang → nilai apa adanya ──');
{
  const st = extractQualificationState([
    u('sewa apartemen surabaya'),
    a('Ada lokasi atau tempat tertentu yang jadi patokan?'),
  ], 'dekat kampus ubaya');
  ok('anchorPoint tertangkap normal', /kampus ubaya/i.test(st.anchorPoint || ''));
}

console.log('\n── Ralat eksplisit TETAP boleh menimpa Q6 ──');
{
  const H = [
    u('sewa apartemen surabaya'),
    a('Ada lokasi atau tempat tertentu yang jadi patokan?'), u('dekat kampus ubaya'),
    a('Oke, dekat kampus Ubaya ya. Ada lagi?'),
  ];
  const st = extractQualificationState(H, 'ralat, maksud saya dekat kampus unair');
  ok('ralat eksplisit menimpa anchorPoint lama', /unair/i.test(st.anchorPoint || ''));
}

console.log('\n── Q6 "Di X" saat district SUDAH terisi → tidak menimpa district ──');
{
  const H = [
    u('sewa apartemen di surabaya, area gubeng'),
    a('Ada lokasi atau tempat tertentu yang jadi patokan?'),
  ];
  const st = extractQualificationState(H, 'Di Dinoyo');
  ok('district lama (dari pesan pembuka) tidak tertimpa', st.district !== 'Dinoyo');
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

/**
 * distanceEstimation.test.js — regresi M130.
 *
 * Permintaan pemilik proyek: AI (jalur LLM/platform API DAN Private Agent
 * fallback) harus bisa menjawab pertanyaan customer soal JARAK & WAKTU
 * TEMPUH dari lokasi mereka ke alamat properti yang dijual/disewakan.
 *
 * ⚠️ KEPUTUSAN ARSITEKTUR (disepakati pemilik proyek sesi ini):
 *   - GOOGLE_ENABLED tetap FALSE — estimasi HANYA dari tabel koordinat kota
 *     statis (utils/cityGeoData.js), jarak garis lurus (haversine), BUKAN
 *     rute jalan presisi.
 *   - Rute penyeberangan pulau HANYA disebut untuk rute MAYOR yang diyakini
 *     akurat; pulau lain → arahkan ke agent, JANGAN menebak nama pelabuhan.
 *
 * ⚠️ BUG SERIUS DITEMUKAN & DIPERBAIKI SAAT MEMBANGUN FITUR INI: mencocokkan
 * rute feri HANYA berdasarkan pasangan pulau (tanpa peduli jarak aktual)
 * salah menyarankan Merak-Bakauheni untuk Surabaya→Banda Aceh (~2400 km!) —
 * jelas menyesatkan. Fix: rute mayor hanya disarankan bila jarak garis lurus
 * TOTAL masih masuk akal (≤1300 km) untuk perjalanan darat+feri.
 *
 * Run: node tests/distanceEstimation.test.js
 */
'use strict';

require('dotenv').config();
const {
  haversineKm, estimateDistanceAndTime, tryAnswerDistanceQuery, looksLikeDistanceQuestion,
} = require('../services/distanceEstimationService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

console.log('\n== Group 1: haversine dasar (Surabaya-Malang, jarak dikenal ~80km) ==');
{
  const km = haversineKm(-7.2575, 112.7521, -7.9666, 112.6326);
  ok('Surabaya-Malang haversine masuk akal (70-90 km)', km > 70 && km < 90, km);
}

console.log('\n== Group 2: transkrip nyata — Surabaya ke Jakarta (satu pulau, >350km) ==');
{
  const r = estimateDistanceAndTime('Surabaya', 'Jakarta');
  ok('hasil ada', !!r);
  ok('sameIsland = true (keduanya Jawa)', r.sameIsland === true);
  ok('menyarankan pesawat sebagai opsi utama (jarak jauh)', /pesawat/i.test(r.text));
  ok('tetap sertakan estimasi mobil', /mobil/i.test(r.text));
  ok('teks menyebut kata "estimasi" (bukan klaim presisi)', /estimasi/i.test(r.text));
}

console.log('\n== Group 3: satu pulau, <200km → mobil saja ==');
{
  const r = estimateDistanceAndTime('Surabaya', 'Malang');
  ok('hasil ada', !!r);
  ok('menyebut mobil', /mobil/i.test(r.text));
  ok('TIDAK menyebut kereta (jarak dekat, tidak perlu)', !/kereta/i.test(r.text));
}

console.log('\n== Group 4: satu pulau, 201-350km → kereta + mobil + tawaran pesawat ==');
{
  const r = estimateDistanceAndTime('Bandung', 'Semarang'); // ~309km lurus
  ok('hasil ada', !!r);
  if (r) {
    ok(`jarak di rentang 200-350km (aktual: ${r.distanceKm})`, r.distanceKm >= 195 && r.distanceKm <= 350, r.distanceKm);
    ok('menyebut kereta', /kereta/i.test(r.text));
    ok('menyebut mobil', /mobil/i.test(r.text));
  }
}

console.log('\n== Group 5: beda pulau, rute MAYOR dikenal (Jakarta-Denpasar via Ketapang-Gilimanuk) ==');
{
  const r = estimateDistanceAndTime('Jakarta', 'Denpasar');
  ok('hasil ada', !!r);
  ok('sameIsland = false', r.sameIsland === false);
  ok('menyebut Pelabuhan Ketapang', /ketapang/i.test(r.text));
  ok('menyebut Pelabuhan Gilimanuk', /gilimanuk/i.test(r.text));
}

console.log('\n== Group 6: KONTROL KEAMANAN — beda pulau JAUH, TIDAK boleh menyarankan pelabuhan yang salah ==');
{
  // Surabaya (Jawa Timur) -> Banda Aceh (ujung utara Sumatra): pasangan pulau
  // "jawa-sumatra" ADA di tabel rute mayor, tapi jarak totalnya (~2400km)
  // membuat rute Merak-Bakauheni sama sekali tidak relevan/menyesatkan.
  const r = estimateDistanceAndTime('Surabaya', 'Banda Aceh');
  ok('hasil ada', !!r);
  ok('sameIsland = false', r.sameIsland === false);
  ok('TIDAK menyebut Merak/Bakauheni (rute tidak relevan utk jarak sejauh ini)',
    !/merak/i.test(r.text) && !/bakauheni/i.test(r.text), r.text);
  ok('mengarahkan ke agent untuk info penyeberangan', /agent/i.test(r.text));
  ok('menawarkan opsi pesawat', /pesawat/i.test(r.text));
}

console.log('\n== Group 7: KONTROL — rute mayor lain (Bandar Lampung-Serang) TETAP disarankan ==');
{
  const r = estimateDistanceAndTime('Bandar Lampung', 'Serang');
  ok('hasil ada', !!r);
  ok('menyebut Merak/Bakauheni (rute genuinely relevan, jarak dekat)',
    /merak/i.test(r.text) || /bakauheni/i.test(r.text));
}

console.log('\n== Group 8: kota tidak dikenal → null (bukan tebakan) ==');
{
  const r = estimateDistanceAndTime('Kota Fiktif Antah Berantah', 'Surabaya');
  ok('return null (fail-open, bukan mengarang koordinat)', r === null);
}

console.log('\n== Group 9: parsing pertanyaan bebas dari transkrip nyata (2 kota disebut) ==');
{
  const r1 = tryAnswerDistanceQuery('berapa jarak yang dibutuhkan dari rumah saya di Surabaya ke Apartemen anda yang ada di Jakarta, di Jalan Meruya Selatan No.36');
  ok('transkrip 1 (Surabaya->Jakarta) menghasilkan jawaban', !!r1);

  const r2 = tryAnswerDistanceQuery('dari Surabaya ke apartemen di Aceh di alamat Jl. Near Beach No. 36, Banda Aceh, Aceh, maka platform AI harus bisa jawab');
  ok('transkrip 2 (Surabaya->Banda Aceh) menghasilkan jawaban, TANPA salah sebut pelabuhan',
    !!r2 && !/merak/i.test(r2) && !/bakauheni/i.test(r2));
}

console.log('\n== Group 10: KONTROL NEGATIF — pesan biasa (bukan pertanyaan jarak) tidak terpicu ==');
{
  ok('"Saya mau sewa rumah di Surabaya" bukan pertanyaan jarak', !looksLikeDistanceQuestion('Saya mau sewa rumah di Surabaya'));
  ok('tryAnswerDistanceQuery return null untuk pesan biasa', tryAnswerDistanceQuery('Saya mau sewa rumah di Surabaya') === null);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

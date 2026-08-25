/**
 * certificateExposureAndSameCityDistance.test.js — regresi M137.
 *
 * DUA cacat kode nyata yang ditemukan saat menelusuri skenario percakapan
 * pemilik proyek (24 Agu 2026, "Puri Surya Jaya / Pondok Candra"):
 *
 * 1. `properties.certificate_type` ADA di tabel sejak M129, tapi TIDAK PERNAH
 *    dibaca satu baris kode pun di luar models/Property.js (diverifikasi grep:
 *    nol hit di services/, utils/, controllers/). Artinya saat customer
 *    bertanya "apakah rumah ini sudah SHM?", AI TIDAK PUNYA CARA untuk tahu —
 *    satu-satunya pilihan adalah MENGARANG, kelas bug M84/M96 yang sudah
 *    berkali-kali mahal di proyek ini.
 *
 * 2. `tryAnswerDistanceQuery()` menjawab "sekitar 0 km" untuk pertanyaan
 *    dalam-kota ("dari Sidoarjo ke Sidoarjo") — benar secara matematis (tabel
 *    hanya punya SATU koordinat per kota) tapi omong kosong bagi customer yang
 *    menanyakan jarak antar-KAWASAN. Guard lama hanya melindungi cabang
 *    `cities.length === 1`; cabang >= 2 lolos begitu saja.
 *
 * Run: node tests/certificateExposureAndSameCityDistance.test.js
 */
'use strict';

require('dotenv').config();
const { formatPropertyRecommendation } = require('../services/propertyRecommendationService');
const { tryAnswerDistanceQuery, looksLikeDistanceQuestion } = require('../services/distanceEstimationService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

/** Baris properti minimal berbentuk normalized (sama seperti _queryProperties). */
function row(over = {}) {
  return {
    title: 'Rumah Contoh', location: 'SIDOARJO', city: 'SIDOARJO', district: '',
    price: '1.15 miliar', buildingType: 'house', transactionType: 'sale',
    buildingArea: '90 m2', landArea: '120 m2', address: 'Jl. Contoh No. 1',
    bedrooms: 3, bathrooms: 2, furnishedStatus: '', facilities: 'AC, CARPORT',
    nearbyLocations: '', description: '-', ...over,
  };
}

console.log('\n== Group 1: certificate_type SAMPAI ke teks katalog yang dilihat LLM ==');
{
  const shm = formatPropertyRecommendation([row({ certificateType: 'SHM' })]);
  ok('sertifikat SHM dirender eksplisit', /Certificate:\s*SHM/.test(shm), shm.slice(0, 200));

  const shgb = formatPropertyRecommendation([row({ certificateType: 'SHGB' })]);
  ok('sertifikat SHGB dirender apa adanya (tidak diratakan jadi "SHM")',
    /Certificate:\s*SHGB/.test(shgb) && !/Certificate:\s*SHM\b/.test(shgb));

  const kosong = formatPropertyRecommendation([row({ certificateType: 'KOSONG' })]);
  ok('KOSONG (tercatat belum terbit) dirender apa adanya', /Certificate:\s*KOSONG/.test(kosong));
}

console.log('\n== Group 2: KEADAAN KETIGA — null ≠ KOSONG, LLM harus tahu bedanya ==');
{
  const nul = formatPropertyRecommendation([row({ certificateType: null })]);
  ok('null tetap merender baris Certificate (bukan menghilang diam-diam)',
    /Certificate:/.test(nul), nul.slice(0, 250));
  ok('null ditandai "BELUM DIISI" — BUKAN dipetakan jadi "KOSONG"',
    /BELUM DIISI/i.test(nul) && !/Certificate:\s*KOSONG/.test(nul), nul.slice(0, 250));
  ok('null membawa instruksi eksplisit jangan menyimpulkan',
    /jangan simpulkan|arahkan ke tim/i.test(nul), nul.slice(0, 250));
}

console.log('\n== Group 3: SEWA tidak menampilkan sertifikat (tidak relevan bagi penyewa) ==');
{
  const rent = formatPropertyRecommendation([row({ transactionType: 'rent', certificateType: null })]);
  ok('listing sewa TIDAK punya baris Certificate sama sekali',
    !/Certificate:/.test(rent), rent.slice(0, 250));
}

console.log('\n== Group 4: jarak DALAM-KOTA tidak lagi dijawab "0 km" ==');
{
  const same = tryAnswerDistanceQuery('dari Sidoarjo ke Sidoarjo berapa jauh?');
  ok('asal == tujuan → null (diserahkan ke platform AI, bukan "0 km")',
    same === null, String(same).slice(0, 80));
  ok('kontrol: pesannya MEMANG terdeteksi sebagai pertanyaan jarak (bukan lolos karena tidak terdeteksi)',
    looksLikeDistanceQuestion('dari Sidoarjo ke Sidoarjo berapa jauh?') === true);

  const sameCtx = tryAnswerDistanceQuery('ke sana berapa lama dari Sidoarjo?', { propertyCity: 'Sidoarjo' });
  ok('asal == kota properti (via context) juga → null', sameCtx === null, String(sameCtx).slice(0, 80));
}

console.log('\n== Group 5: KONTROL NEGATIF — jarak ANTAR-KOTA tetap dijawab deterministik ==');
{
  const cross = tryAnswerDistanceQuery('jarak dari Surabaya ke Malang berapa?');
  ok('Surabaya→Malang tetap dijawab (fitur M130 tidak rusak)',
    typeof cross === 'string' && /km/i.test(cross), String(cross).slice(0, 80));
  ok('jawabannya BUKAN 0 km', !/sekitar 0 km/i.test(String(cross)));
}

console.log('\n== Group 6: KONTROL — pesan non-jarak tidak terpengaruh ==');
{
  ok('pesan properti biasa → null', tryAnswerDistanceQuery('Saya mau beli rumah di Sidoarjo') === null);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

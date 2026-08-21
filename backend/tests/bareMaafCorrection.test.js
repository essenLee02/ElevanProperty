/**
 * bareMaafCorrection.test.js — regresi M127.
 *
 * ⚠️ TRANSKRIP NYATA (Case 3, 21 Agu 2026): customer "Saya mau beli rumah di
 * Surabaya" → AI tanya budget → customer "Saya cari harga 2-3 juta/hari"
 * (angka yang tidak masuk akal untuk BELI rumah — satuan booking, bukan
 * harga beli) → SATU pesan kemudian, customer meralat: "Maaf... Saya cari
 * harga 400-800 juta". Summary akhir TETAP menampilkan budget PERTAMA
 * ("Rp 2.000.000 - Rp 3.000.000/malam") — koreksi customer diabaikan total.
 *
 * Akar: CORRECTION_RE mensyaratkan "maaf salah" (persis, diikuti kata
 * "salah") — "Maaf..." (basa-basi + langsung angka baru, TANPA kata "salah")
 * tidak match pola ralat manapun, jadi budget tetap sticky first-wins.
 *
 * Fix: "maaf" TELANJANG (tanpa perlu "salah") ditambahkan ke CORRECTION_RE.
 * Aman diperlonggar karena SEMUA pemanggil isCorrectionMsg/CORRECTION_RE
 * mensyaratkan pesan JUGA berisi nilai baru yang valid sebelum menimpa apa
 * pun — "maaf" basa-basi tanpa angka baru tidak mengubah apa pun.
 *
 * Run: node tests/bareMaafCorrection.test.js
 */
'use strict';

require('dotenv').config();
const { extractQualificationState } = require('../services/aiPromptBuilderService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const C = (m) => ({ role: 'customer', message: m });
const A = (m) => ({ role: 'ai', message: m });

console.log('\n== Group 1: transkrip nyata — "Maaf..." meralat budget ==');
{
  const hist = [
    C('Saya mau beli rumah di Surabaya'),
    A('Untuk beli Rumah di Surabaya, kisaran harga berapa?'),
    C('Saya cari harga 2-3 juta/hari'),
  ];
  const st = extractQualificationState(hist, 'Maaf... Saya cari harga 400-800 juta');
  ok('budget ter-koreksi ke 400-800 juta (BUKAN 2-3jt/hari lama)',
    /400\.000\.000/.test(st.budget || '') && /800\.000\.000/.test(st.budget || ''), st.budget);
  ok('satuan lama (/malam) TIDAK ikut ke nilai baru', !/malam/.test(st.budget || ''), st.budget);
}

console.log('\n== Group 2: budget & moveInDate lain juga bisa dikoreksi "maaf" ==');
{
  const hist = [
    C('mau sewa rumah di Malang'),
    A('Rencananya masuk bulan apa?'),
    C('bulan Juni'),
  ];
  const st = extractQualificationState(hist, 'Maaf, maksudnya bulan Juli');
  ok('moveInDate ter-update (sudah match "maksud" juga, kontrol tambahan)',
    /juli/i.test(st.moveInDate || ''), st.moveInDate);
}

console.log('\n== Group 3: KONTROL — "maaf" basa-basi TANPA angka baru tidak menghapus apa pun ==');
{
  const hist = [
    C('mau beli rumah di Surabaya'),
    A('Kisaran harga?'),
    C('500-700 juta'),
  ];
  const st = extractQualificationState(hist, 'Maaf baru balas ya, lagi sibuk tadi');
  ok('budget TETAP 500-700 juta (maaf tanpa angka baru tidak menghapus)',
    /500\.000\.000/.test(st.budget || '') && /700\.000\.000/.test(st.budget || ''), st.budget);
}

console.log('\n== Group 4: KONTROL — kata kunci ralat LAMA masih berfungsi (tidak rusak) ==');
{
  const hist = [
    C('mau sewa rumah di Malang'),
    A('Kisaran harga?'),
    C('3-5 juta/bulan'),
  ];
  const st = extractQualificationState(hist, 'ralat, budget 8-10 juta/bulan aja');
  ok('kata "ralat" (sudah ada sebelumnya) masih meng-koreksi budget',
    /8\.000\.000/.test(st.budget || ''), st.budget);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

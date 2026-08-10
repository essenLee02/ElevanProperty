/**
 * q2cAnswerGateDrop.test.js — regresi M88.
 *
 * Transkrip produksi 9 Agu 2026:
 *   19:58 cust : Saya ingin booking apartemen di Surabaya
 *   20:01 AI   : Di area atau kawasan mana di Surabaya yang Anda pertimbangkan? 📍
 *                Misalnya Pakuwon, Darmo, Rungkut, Gubeng, atau area lainnya?
 *   20:02 cust : Daerah Gubeng      ← tidak dibalas
 *   20:10 cust : Daerah Gubeng      ← tidak dibalas
 *   20:11 cust : Daerah Gubeng      ← tidak dibalas  (5× total, senyap total)
 *
 * AI MENGAJUKAN pertanyaannya sendiri, lalu MEMBUANG jawabannya.
 *
 * TIGA CACAT PADA JALUR YANG SAMA:
 *
 *  (1) Pertanyaan Q2c INVISIBLE bagi gate. PROPERTY_QUESTION_PATTERNS punya
 *      /area\s+(mana|apa)/ — tapi kalimat Q2c berbunyi "area ATAU KAWASAN
 *      mana", sehingga "area" dan "mana" tidak pernah bersebelahan; kata
 *      "kawasan" tidak terdaftar sama sekali. Akibatnya hasRecentPropertyQ
 *      DAN isInPropertyFlow sama-sama false.
 *
 *  (2) Tidak ada pola jawaban AREA. Pola lokasi hanya mengenali nama KOTA
 *      (_locationCache) dan bentuk "di <kata>". Nama KECAMATAN tidak ada di
 *      cache mana pun, jadi "Daerah Gubeng" tidak cocok pola apa pun.
 *
 *  (3) Jalur bypass context-aware menuntut `inPropertyFlow`, yang butuh
 *      MINIMAL DUA pertanyaan properti — sehingga jawaban atas pertanyaan
 *      PERTAMA tidak pernah bisa lolos lewat jalur itu.
 *
 * ⚠️ Cacat (2) makin sering terpicu sejak M84 membuat Q2c berlaku untuk SEMUA
 * kota: pertanyaannya jauh lebih sering diajukan, gate-nya tidak ikut diperluas.
 *
 * Run: node tests/q2cAnswerGateDrop.test.js
 */

'use strict';

require('dotenv').config();

const {
  isPropertyContextContinuation,
  isInPropertyFlow,
  hasPropertyKeyword,
} = require('../utils/propertyKeywordFilter');
const { extractQualificationState, findNextQuestion } = require('../services/aiPromptBuilderService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

// Kalimat Q2c PERSIS seperti yang dihasilkan findNextQuestion.
const Q2C_SBY = 'Di area atau kawasan mana di *Surabaya* yang Anda pertimbangkan? 📍 Misalnya Pakuwon, Darmo, Rungkut, Gubeng, atau area lainnya?';
const Q2C_MLG = 'Di area atau kawasan mana di *Malang* yang Anda pertimbangkan? 📍 Misalnya Soekarno Hatta, Ijen, Dinoyo, Lowokwaru, atau area lainnya?';

const HIST = [
  { role: 'customer', message: 'Saya ingin booking apartemen di Surabaya' },
  { role: 'ai',       message: Q2C_SBY },
];

// ───────────────────────────────────────────────────────────────────────────
console.log('── Group 1: kalimat Q2c dikenali sebagai pertanyaan properti ──');
{
  // Dua pertanyaan Q2c → isInPropertyFlow harus true. Sebelum fix, kalimat Q2c
  // tidak cocok pola mana pun sehingga hitungannya 0.
  const twoQ = [
    { role: 'customer', message: 'Saya ingin booking apartemen di Surabaya' },
    { role: 'ai',       message: Q2C_SBY },
    { role: 'customer', message: 'hmm' },
    { role: 'ai',       message: Q2C_MLG },
  ];
  ok('kalimat Q2c dihitung sebagai pertanyaan properti', isInPropertyFlow(twoQ) === true);
}

console.log('\n── Group 2: jawaban Q2c dari transkrip produksi harus lolos ──');
{
  ok('"Daerah Gubeng" (pesan yang dibuang 5×)', isPropertyContextContinuation('Daerah Gubeng', HIST) === true);
  for (const a of ['Area Ijen', 'Kawasan Dinoyo', 'Kecamatan Lowokwaru', 'Wilayah Rungkut',
                   'Di Gubeng', 'Gubeng saja', 'Pakuwon', 'daerah gubeng']) {
    ok(`lolos: "${a}"`, isPropertyContextContinuation(a, HIST) === true);
  }
}

console.log('\n── Group 3: jawaban atas pertanyaan PERTAMA tidak butuh 2 pertanyaan ──');
{
  // Inti cacat (3): dulu bypass menuntut inPropertyFlow (≥2 pertanyaan AI).
  ok('history hanya punya SATU pertanyaan AI', isInPropertyFlow(HIST) === false);
  ok('jawaban tetap diterima meski baru satu pertanyaan',
     isPropertyContextContinuation('Daerah Gubeng', HIST) === true);
}

console.log('\n── Group 4: KONTROL NEGATIF — off-topic tetap ditolak ──');
{
  // Melonggarkan gate TIDAK boleh meloloskan obrolan non-properti, termasuk
  // tepat sesudah pertanyaan properti pertama.
  const shouldNot = [
    'kasi makan dulu ya',
    'Saya mau pesan makanan dulu ya',
    'beli laptop 10 juta',
    'nonton film dulu',
    'mau ke bioskop',
    'booking tiket pesawat',
    'resep masakan apa ya',
  ];
  for (const m of shouldNot) ok(`ditolak: "${m}"`, isPropertyContextContinuation(m, HIST) === false);
}

console.log('\n── Group 5: KONTROL NEGATIF — tanpa konteks properti tetap ditolak ──');
{
  // Tanpa history properti sama sekali, "Daerah Gubeng" bukan urusan kita.
  ok('tanpa history → ditolak', isPropertyContextContinuation('Daerah Gubeng', []) === false);
  const chit = [{ role: 'customer', message: 'halo' }, { role: 'ai', message: 'Halo juga!' }];
  ok('history basa-basi → ditolak', isPropertyContextContinuation('Daerah Gubeng', chit) === false);
  ok('"Daerah Gubeng" bukan query properti mandiri', hasPropertyKeyword('Daerah Gubeng') === false);
}

console.log('\n── Group 6: jawaban benar-benar mengisi slot & alur maju ──');
{
  const s = extractQualificationState(
    [{ role: 'user', message: 'Saya ingin booking apartemen di Surabaya' },
     { role: 'assistant', message: Q2C_SBY },
     { role: 'user', message: 'Daerah Gubeng' }],
    'Daerah Gubeng'
  );
  ok('district tercatat = Gubeng', /gubeng/i.test(s.district || ''), `district=${s.district}`);
  const n = findNextQuestion(s, {});
  ok('Q2c TIDAK ditanya ulang', !!n && n.q !== 'Q2c', `q=${n && n.q}`);
  ok('alur maju ke pertanyaan berikutnya', !!n, JSON.stringify(n));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);

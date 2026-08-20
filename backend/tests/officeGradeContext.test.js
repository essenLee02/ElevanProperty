/**
 * officeGradeContext.test.js — regresi M122.
 *
 * ⚠️ KEJADIAN NYATA (transkrip Kirimi 19-20 Agu 2026, Case 2 dilaporkan user):
 *
 *     19:52 AI   : Preferensi gedung Grade A (premium), Grade B (mid), atau
 *                  Grade C (ekonomis)? 🏢
 *     19:54 Cust : Grade C
 *     19:56 AI   : Baik, Kak — tercatat untuk gedung Grade C, ya 👍 ...
 *     19:58 AI   : Preferensi gedung Grade A/B/C? 🏢          ← DITANYA LAGI
 *     19:58 Cust : Saya mau grade C
 *     20:00 AI   : Preferensi gedung Grade A/B/C? 🏢          ← DITANYA LAGI (3x)
 *     20:20 AI   : Preferensi gedung Grade A/B/C? 🏢          ← DITANYA LAGI (4x)
 *     20:22 AI   : Preferensi gedung Grade A/B/C? 🏢          ← DITANYA LAGI (5x)
 *     20:23 Cust : Stop diulang. Saya dari awal sudah pilih grade C, hindari
 *                  berulang
 *
 * ⚠️ AI SENDIRI SEMPAT BENAR ("tercatat Grade C") lalu KEHILANGANNYA dua
 * giliran kemudian. Sebabnya: Q14 kantor (grade, fit-out, headcount, dll)
 * TIDAK PUNYA state eksplisit sama sekali — hanya teks hint bebas yang
 * menyuruh LLM "CEK history dulu" tanpa bantuan apa pun. Fakta yang sudah
 * dikonfirmasi hilang begitu LLM harus menurunkannya ulang dari history yang
 * makin panjang tiap giliran — pola yang SAMA dengan bug durasi (M103) dan
 * bug switch-latch (M112), diselesaikan dengan cara yang SAMA: state eksplisit,
 * bukan instruksi "jangan lupa".
 *
 * Run: node tests/officeGradeContext.test.js
 */

'use strict';

require('dotenv').config();
const {
  extractQualificationState,
  findNextQuestion,
  buildQualificationStateBlock,
} = require('../services/aiPromptBuilderService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const u = (m) => ({ role: 'user', message: m });
const a = (m) => ({ role: 'ai', message: m });

// Transkrip PERSIS dari laporan user, dari awal sampai "Grade C" PERTAMA.
const TRANSCRIPT_TO_FIRST_ANSWER = [
  u('Hello... Mau booking office di Solo'),
  a('Sudah lihat berapa Kantor di Surakarta? Apa yang membuat belum cocok dari yang sudah dilihat?'),
  u('Cma sy cri yang dekat dengan pusat kota'),
  u('Akses jalan lancar dan tdk banjir'),
  a('Baik, Kak — tercatat untuk preferensi lokasinya ya. Di Surakarta ada kantor kisaran Rp 40-80 juta per tahun dan ada juga yang Rp 150-250 juta per tahun. Kira-kira yang mana lebih sesuai?'),
  u('Saya cari yang murah saja, yang badget 2-4 juta/hari. Saya butuh booking selama 4 hari saja'),
  a('Kapan rencananya mulai operasional?'),
  u('3 Minggu lagi'),
  a('Selain Surakarta, apakah area sekitar masih oke?'),
  u('Tidak ada, Kak.'),
  a('Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?'),
  u('Tidak perlu survei, saya minta listing saja'),
  a('Untuk furnitur, lebih prefer yang sudah furnished, semi-furnished, atau kosongan saja?'),
  u('Kosongan'),
  a('Ada fasilitas tertentu yang Anda inginkan? Misalnya AC, kolam renang, gym, carport/garasi, keamanan 24 jam, atau yang lainnya?'),
  u('Fasilitas terserah aja, pokok bisa one gate sistem, AC, ada playground'),
  a('Berapa orang yang akan bekerja di kantor ini? (untuk tentukan luas & grade gedung)'),
  u('Saya dan 3 anak saya saja'),
  a('Preferensi gedung Grade A (premium), Grade B (mid), atau Grade C (ekonomis)? 🏢'),
  u('Grade C'),
];

console.log('\n== Group 1: "Grade C" tertangkap pada giliran PERTAMA ==');
{
  const st = extractQualificationState(TRANSCRIPT_TO_FIRST_ANSWER, '');
  ok('officeGrade = C', st.officeGrade === 'C', JSON.stringify(st.officeGrade));
}

console.log('\n== Group 2: fakta BERTAHAN setelah AI mengonfirmasi & lanjut ke fit-out ==');
{
  // Persis giliran 19:56 di transkrip nyata: AI mengonfirmasi, lalu tanya fit-out.
  const hist = [
    ...TRANSCRIPT_TO_FIRST_ANSWER,
    a('Baik, Kak — tercatat untuk gedung Grade C, ya 👍 Untuk kondisi interiornya, prefer yang sudah fit-out atau shell & core saja? 🏢'),
    u('fit-out saja'),
  ];
  const st = extractQualificationState(hist, '');
  ok('officeGrade TETAP C (tidak hilang)', st.officeGrade === 'C', JSON.stringify(st.officeGrade));
  ok('officeFitOut = fit-out', st.officeFitOut === 'fit-out', JSON.stringify(st.officeFitOut));
}

console.log('\n== Group 3: fakta BERTAHAN walau riwayat terus bertambah panjang ==');
{
  // Simulasikan giliran² BERIKUTNYA (topik lain) — Grade TIDAK BOLEH luntur
  // hanya karena history makin panjang. Ini persis kegagalan nyata: bug
  // muncul di giliran ke-4/ke-5 SETELAH grade dijawab, bukan di giliran pertama.
  let hist = [
    ...TRANSCRIPT_TO_FIRST_ANSWER,
    a('Baik, Kak — tercatat untuk gedung Grade C, ya 👍 Untuk kondisi interiornya, prefer yang sudah fit-out atau shell & core saja? 🏢'),
    u('fit-out saja'),
  ];
  for (let i = 0; i < 5; i++) {
    hist = [...hist, a(`Pertanyaan tambahan ke-${i}, tidak berkaitan dengan grade`), u(`Jawaban ke-${i}, juga tidak berkaitan`)];
  }
  const st = extractQualificationState(hist, '');
  ok('officeGrade tetap C setelah 5 giliran tambahan',
    st.officeGrade === 'C', JSON.stringify(st.officeGrade));
}

console.log('\n== Group 4: Q14 hint BERHENTI menanyakan setelah dijawab ==');
{
  const base = {
    transactionType: 'rent', buildingType: 'office', city: 'Surakarta',
    budget: '2-4 juta/hari', household: 'saya + 3 anak', redFlags: 'akses jalan lancar, tidak banjir',
    moveInDate: '3 minggu lagi', decisionMaker: 'Mandiri', viewingDate: 'Minta listing',
    leaseDuration: '4 hari', furnishing: 'unfurnished/kosongan', facilities: 'one gate system, AC, playground',
    aiAskedQ2b: true, anchorPoint: 'dekat pusat kota', alternativeAreas: 'Tidak ada, fokus Surakarta saja',
    q2cDeclined: true, isBooking: true,
  };

  const before = findNextQuestion({ ...base, officeGrade: null, officeFitOut: null });
  ok('SEBELUM dijawab: hint menanyakan Grade A/B/C',
    /Grade A\/B\/C/.test(before.hint), before.hint);

  const afterGrade = findNextQuestion({ ...base, officeGrade: 'C', officeFitOut: null });
  ok('SETELAH grade dijawab: hint TIDAK lagi menanyakan grade',
    !/Grade A\/B\/C\?/.test(afterGrade.hint), afterGrade.hint);
  ok('SETELAH grade dijawab: hint eksplisit menyebut "SUDAH DIJAWAB: C"',
    /SUDAH DIJAWAB: C/.test(afterGrade.hint), afterGrade.hint);
  ok('SETELAH grade dijawab: fit-out MASIH ditanyakan (belum dijawab)',
    /fit-out atau shell/.test(afterGrade.hint), afterGrade.hint);

  const afterBoth = findNextQuestion({ ...base, officeGrade: 'C', officeFitOut: 'fit-out' });
  ok('SETELAH keduanya dijawab: TIDAK ADA lagi pertanyaan grade/fit-out di hint',
    !/Grade A\/B\/C\?|fit-out atau shell/.test(afterBoth.hint), afterBoth.hint);
}

console.log('\n== Group 5: state block — tampil untuk kantor, TERSEMBUNYI untuk tipe lain ==');
{
  const officeBlock = buildQualificationStateBlock({
    buildingType: 'office', transactionType: 'rent', officeGrade: 'C', officeFitOut: 'fit-out',
  });
  ok('kantor: baris Grade tampil sebagai ✅',
    /✅ Grade gedung \[Q14\]: C/.test(officeBlock), officeBlock.match(/.*Grade.*/)?.[0]);
  ok('kantor: baris Fit-out tampil sebagai ✅',
    /✅ Fit-out\/shell \[Q14\]: fit-out/.test(officeBlock));

  const officeUnanswered = buildQualificationStateBlock({ buildingType: 'office', transactionType: 'rent' });
  ok('kantor belum dijawab: tampil ❓ (bukan hilang)',
    /❓ Grade gedung \[Q14\]: BELUM DIJAWAB/.test(officeUnanswered));

  const houseBlock = buildQualificationStateBlock({ buildingType: 'house', transactionType: 'sale' });
  ok('rumah: TIDAK ADA baris Grade sama sekali (bukan ❓ palsu)',
    !/Grade gedung/.test(houseBlock), houseBlock.match(/.*Grade.*/)?.[0] || '(tidak ada)');
}

console.log('\n== Group 6: variasi frasa pertanyaan grade ==');
{
  const short = extractQualificationState([a('Grade A, B, atau C?'), u('B')], '');
  ok('frasa singkat "Grade A, B, atau C?" + "B" → officeGrade=B',
    short.officeGrade === 'B', JSON.stringify(short.officeGrade));

  const withGedung = extractQualificationState(
    [a('Untuk gedungnya prefer yang mana — A, B, atau C?'), u('grade c aja')], '');
  ok('frasa "gedungnya ... A, B, atau C?" + "grade c aja" → officeGrade=C',
    withGedung.officeGrade === 'C', JSON.stringify(withGedung.officeGrade));
}

console.log('\n== Group 7: "terserah" → default masuk akal, BUKAN loop selamanya ==');
{
  const st = extractQualificationState(
    [a('Preferensi gedung Grade A (premium), Grade B (mid), atau Grade C (ekonomis)? 🏢'), u('terserah aja, Kak')],
    '',
  );
  ok('"terserah" pada grade menghasilkan nilai (bukan null)',
    st.officeGrade !== null, JSON.stringify(st.officeGrade));
  ok('nilai default terlihat sebagai default, bukan pilihan customer yang dikarang',
    /default/i.test(st.officeGrade), st.officeGrade);
}

console.log('\n== Group 8: KONTROL NEGATIF — false positive guards ==');
{
  const cash = extractQualificationState(
    [a('Untuk pembiayaan, rencananya cash, KPR komersial, atau kombinasi?'), u('cash aja')], '');
  ok('"cash" TIDAK memicu grade (huruf "c" di dalam kata lain)',
    cash.officeGrade === null, JSON.stringify(cash.officeGrade));

  const unrelatedABC = extractQualificationState(
    [a('Mau pilihan A, B, atau C untuk paket promo?'), u('C aja')], '');
  ok('pertanyaan A/B/C TANPA kata grade/gedung tidak memicu',
    unrelatedABC.officeGrade === null, JSON.stringify(unrelatedABC.officeGrade));

  const shellCafe = extractQualificationState(
    [a('Ada resto seafood nama Shell Cafe dekat sana, cocok utk makan siang?'), u('oh oke')], '');
  ok('kata "shell" di luar konteks fit-out TIDAK memicu officeFitOut',
    shellCafe.officeFitOut === null, JSON.stringify(shellCafe.officeFitOut));

  const noAiQuestion = extractQualificationState([u('Saya mau grade C dari awal')], '');
  ok('customer menyebut "grade C" TANPA AI pernah bertanya → tidak dipaksa cocok (butuh konteks pertanyaan AI)',
    noAiQuestion.officeGrade === null, JSON.stringify(noAiQuestion.officeGrade));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

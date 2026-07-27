/**
 * decisionMakerParaphrase.test.js — Q9 (decision maker) must be recognized even
 * when the PRIMARY provider paraphrases the canonical question wording.
 *
 * Live bug (27 Jul 2026, transcript "Nigel beli rumah Surabaya"): DeepSeek asked
 * Q9 as "...apakah langsung bisa Bapak putuskan sendiri atau perlu diskusi dulu
 * sama istri?" instead of the canonical "...jadwalkan viewing atau perlu
 * koordinasi dulu sama keluarga lain?". The aiText-matching regex only recognized
 * the canonical sentence, so `decisionMaker` stayed null even after the customer
 * answered clearly ("saya akan diskusi dengan istri untuk deal pembeliannya").
 * The next turn's state block still showed Q9 ❓, and the bot re-asked something
 * instead of progressing — the customer-visible symptom the user reported.
 *
 * Run: node tests/decisionMakerParaphrase.test.js
 */

'use strict';

const { extractQualificationState } = require('../services/aiPromptBuilderService');

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
}

console.log('── Q9 detected across paraphrased AI question wordings ──');
{
  const paraphrases = [
    'Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?', // canonical
    'apakah langsung bisa Bapak putuskan sendiri atau perlu diskusi dulu sama istri? 📅',                          // real DeepSeek wording
    'Kalau ada rumah yang cocok, Bapak bisa langsung memutuskan atau perlu tanya dulu sama pasangan?',
    'Apakah bisa langsung diputuskan atau perlu izin dulu dari suami?',
  ];
  for (const q of paraphrases) {
    const history = [{ role: 'assistant', message: q }];
    const qs = extractQualificationState(history, 'saya akan diskusi dengan istri untuk deal pembeliannya');
    ok(`"${q.slice(0, 50)}..." → decisionMaker set`, !!qs.decisionMaker);
  }
}

console.log('\n── decisionMaker normalizes "diskusi" the same as "koordinasi" ──');
{
  const history = [{ role: 'assistant', message: 'apakah langsung bisa Bapak putuskan sendiri atau perlu diskusi dulu sama istri?' }];
  const qs = extractQualificationState(history, 'saya akan diskusi dengan istri untuk deal pembeliannya');
  ok('normalized to "Koordinasi dengan pasangan"', qs.decisionMaker === 'Koordinasi dengan pasangan');
}

console.log('\n── FULL live-transcript repro: Q8 stays resolved, Q9 no longer loops ──');
{
  const turn1Q = 'Ada target kapan proses belinya mau selesai? 📅';
  const turn1A = 'Untuk kapan proses beli, saya belum pasti. Saya infokan selanjutnya ya';
  const turn1Response = 'Baik, Kak, saya catat. Untuk target waktu belinya, nanti Bapak infokan lagi ya, tidak masalah 😊\n\n'
    + 'Kalau begitu, sekarang — untuk proses pengambilan keputusannya, kalau nanti ada rumah yang cocok, '
    + 'apakah langsung bisa Bapak putuskan sendiri atau perlu diskusi dulu sama istri? 📅';
  const historyBeforeTurn2 = [
    { role: 'assistant', message: turn1Q },
    { role: 'user', message: turn1A },
    { role: 'assistant', message: turn1Response },
  ];
  const turn2A = 'saya akan diskusi dengan istri untuk deal pembeliannya';
  const qs2 = extractQualificationState(historyBeforeTurn2, turn2A);

  ok('Q8 (target beli) still resolved as "Waiting the update"', qs2.moveInDate === 'Waiting the update');
  ok('Q9 (decision maker) now resolved, not null', !!qs2.decisionMaker);
  ok('Q9 normalized correctly', qs2.decisionMaker === 'Koordinasi dengan pasangan');
}

console.log('\n── CONTROL: Q9 must NOT false-fire on unrelated questions ──');
{
  const nonQ9 = [
    'Nanti akan tinggal bersama siapa saja? Biar saya bisa carikan yang pas jumlah kamarnya.', // Q4
    'Untuk pembeliannya, rencana pakai KPR atau cash?',                                         // Q_KPR
    'Ada yang pasti tidak cocok atau ingin dihindari?',                                          // Q5
    'Ada target kapan proses belinya mau selesai?',                                              // Q8
    'Sudah lihat berapa rumah di Surabaya? Apa yang membuat belum cocok?',                        // Q2b
  ];
  for (const q of nonQ9) {
    const history = [{ role: 'assistant', message: q }];
    // An answer containing "istri" but to a DIFFERENT question must not get
    // mis-filed as decisionMaker just because the broadened regex is more lenient.
    const qs = extractQualificationState(history, 'sama istri, budget 2 juta');
    ok(`"${q.slice(0, 40)}..." → does NOT false-fire Q9`, qs.decisionMaker == null);
  }
}

console.log(`\nRESULT: ${pass}/${pass + fail} passed ${fail ? '❌ FAILURES' : '✅'}`);
process.exit(fail ? 1 : 0);

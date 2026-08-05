/**
 * volunteeredAnswersKept.test.js — M75 regression.
 *
 * ONE principle, three slots: information the customer has ALREADY given must never be
 * discarded just because the question queue hasn't reached that slot yet. Discarding it
 * makes the AI re-ask something already answered — the exact complaint in the 5–6 Aug 2026
 * transcript ("customer sudah jawab, namun AI bertanya lagi").
 *
 *  (A) Q9c VIEWING TIME volunteered with the date in one message.
 *      AI asked Q9 (decision maker); customer replied "Saya mau servei 5 hari lagi. Jam 4
 *      sore". The date was captured (the Q9 wording contains "jadwalkan viewing", which
 *      matches the date trigger) but the TIME was dropped because the time extractor only
 *      ran when the AI had literally just asked "jam berapa". The AI then asked for the
 *      hour the customer had already stated.
 *
 *  (B) Q9 DECISION MAKER when nobody else is named.
 *      Q9 is a CHOICE ("schedule viewing directly OR coordinate with family first?").
 *      A customer who schedules the survey themselves and names no wife/family/friend has
 *      chosen the first branch = Mandiri. Previously left null → Q9 re-asked.
 *
 *  (C) Q5 RED FLAGS volunteered while answering a different question.
 *      "Saya pingin cari rmh yg tdk banjir, tdk panas, tdk bau" was given as the Q2b answer,
 *      so it was stored ONLY as searchHistory — Q5 stayed empty and the summary shipped with
 *      NO "Hindari" line, even though the AI had verbally acknowledged the avoidances.
 *
 * Run: node tests/volunteeredAnswersKept.test.js
 */

'use strict';

require('dotenv').config();
const { extractQualificationState } = require('../services/aiPromptBuilderService');
const { expandAbbreviations, ABBR_DICT } = require('../utils/lazyChatNormalizer');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const C = (m) => ({ role: 'customer', message: m });
const A = (m) => ({ role: 'ai', message: m });

const Q9_ASK = 'Siap, Pak. Kalau nanti ada yang cocok, langsung bisa dijadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?';

console.log('── Group 1: date + time volunteered together (A) ──');
{
  const hist = [
    C('Saya ingin beli rumah di Surabaya dengan harga 600 juta - 3 miliar'),
    A('Di area atau kawasan mana di Surabaya yang Anda pertimbangkan? 📍'),
    C('Area Pakuwon'),
    A(Q9_ASK),
  ];
  const s = extractQualificationState(hist, 'Saya mau servei 5 hari lagi. Jam 4 sore');
  ok('viewingDate captured', !!s.viewingDate, `got ${s.viewingDate}`);
  ok('viewingTime captured from the SAME message', !!s.viewingTime, `got ${s.viewingTime}`);
  ok('viewingTime reads as 4 sore', /4/.test(s.viewingTime || '') && /sore/i.test(s.viewingTime || ''),
     `got ${s.viewingTime}`);

  // "servei" is a real typo from the transcript — it must normalize to "survei".
  ok('typo "servei" expands to "survei"', expandAbbreviations('servei') === 'survei');
}

console.log('\n── Group 2: Q9 → Mandiri when nobody else is named (B) ──');
{
  const base = [C('beli rumah di Surabaya'), A(Q9_ASK)];

  const soloAnswers = [
    'Saya mau servei 5 hari lagi. Jam 4 sore',
    'besok bisa',
    'saya mau lihat minggu depan',
  ];
  for (const ans of soloAnswers) {
    const s = extractQualificationState(base, ans);
    ok(`"${ans}" → Mandiri`, s.decisionMaker === 'Mandiri', `got ${s.decisionMaker}`);
  }

  // NEGATIVE CONTROL — naming another person must NOT silently become Mandiri.
  const withOthers = [
    'besok saya lihat sama istri',
    'saya cek dulu sama keluarga',
    'nanti saya tanya orang tua dulu',
  ];
  for (const ans of withOthers) {
    const s = extractQualificationState(base, ans);
    ok(`CONTROL: "${ans}" is NOT Mandiri`, s.decisionMaker !== 'Mandiri', `got ${s.decisionMaker}`);
  }
}

console.log('\n── Group 3: red flags volunteered out of turn (C) ──');
{
  const hist = [C('beli rumah Surabaya'), A('Sudah lihat berapa Rumah di Surabaya? Apa yang membuat belum cocok?')];

  const s = extractQualificationState(hist, 'Saya pingin cari rmh yg tdk banjir, tdk panas, tdk bau');
  ok('red flags captured even though Q5 was not the question', !!s.redFlags, `got ${s.redFlags}`);
  ok('abbreviations expanded inside the stored value', /tidak/.test(s.redFlags || ''), `got ${s.redFlags}`);

  for (const [msg, want] of [
    ['jangan yang dekat rel kereta', true],
    ['saya mau jauh dari pemakaman', true],
    // NEGATIVE CONTROLS — ordinary answers must not be mistaken for red flags.
    ['Belum pernah lihat', false],
    ['sudah lihat 3 rumah', false],
    ['tidak tahu', false],
    ['Area Pakuwon', false],
  ]) {
    const r = extractQualificationState(hist, msg);
    ok(`${want ? 'red flag' : 'CONTROL not a red flag'}: "${msg}"`, !!r.redFlags === want, `got ${r.redFlags}`);
  }
}

console.log('\n── Group 4: newly requested abbreviations ──');
{
  const wanted = {
    msh: 'masih', msih: 'masih', krn: 'karena', krna: 'karena',
    dgn: 'dengan', tmpt: 'tempat', utk: 'untuk',
  };
  for (const [abbr, full] of Object.entries(wanted)) {
    ok(`"${abbr}" → "${full}"`, ABBR_DICT[abbr] === full, `got ${ABBR_DICT[abbr]}`);
  }
  ok('expands in a full sentence',
     expandAbbreviations('msh cari tmpt utk keluarga dgn akses bagus krna butuh') ===
     'masih cari tempat untuk keluarga dengan akses bagus karena butuh');
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);

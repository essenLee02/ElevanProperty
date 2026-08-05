/**
 * altAreaAnchorsOnArea.test.js — M76 regression.
 *
 * Q7 asks for ANOTHER AREA / kecamatan INSIDE the same city. The city is settled at Q2
 * and must never be reopened.
 *
 *   ❌ "Selain *Surabaya*, area sekitar yang masih oke?"   ← reads as "want a different CITY?"
 *   ✅ "Selain area *Pakuwon*, apakah area sekitar masih oke?"
 *
 * The old wording anchored on `state.city`, so a customer who had already chosen Surabaya
 * was implicitly offered a move out of Surabaya. The refusal normaliser had the matching
 * flaw: declining produced "Fokus di Surabaya saja" (whole city) instead of
 * "Fokus di Pakuwon saja" (the area they actually picked).
 *
 * Run: node tests/altAreaAnchorsOnArea.test.js
 */

'use strict';

require('dotenv').config();
const { findNextQuestion, extractQualificationState } = require('../services/aiPromptBuilderService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const C = (m) => ({ role: 'customer', message: m });
const A = (m) => ({ role: 'ai', message: m });

// A state where every slot before Q7 is filled, so Q7 is the next question.
const READY_FOR_Q7 = {
  transactionType: 'sale', buildingType: 'house', city: 'Surabaya',
  budget: 'Rp 600.000.000 - Rp 3.000.000.000', searchHistory: 'belum pernah lihat',
  moveInDate: '01 Desember 2026', household: 'investasi', useCase: 'investasi',
  redFlags: 'tidak banjir, tidak panas', anchorPoint: 'dekat sekolah, cafe',
  alternativeAreas: null,
};

console.log('── Group 1: Q7 anchors on the AREA, not the city ──');
{
  const n = findNextQuestion({ ...READY_FOR_Q7, district: 'Pakuwon' });
  ok('next question is Q7', n && n.q === 'Q7', `got ${n && n.q}`);
  ok('wording anchors on the area name', /Selain area \*Pakuwon\*/i.test(n.hint || ''), n && n.hint);
  ok('does NOT offer to leave the city', !/Selain\s+\*?Surabaya/i.test(n.hint || ''), n && n.hint);
  ok('still mentions "area sekitar"', /area sekitar/i.test(n.hint || ''), n && n.hint);

  // A different area must be reflected verbatim — no hardcoding.
  const n2 = findNextQuestion({ ...READY_FOR_Q7, district: 'Rungkut' });
  ok('area name is dynamic (Rungkut)', /Selain area \*Rungkut\*/i.test(n2.hint || ''), n2 && n2.hint);
}

console.log('\n── Group 2: fallback when no area is known ──');
{
  // Without a district, Q2c fires first to obtain the area — so Q7 normally has an
  // anchor by the time it runs. Assert that Q2c (area question) comes before Q7.
  const n = findNextQuestion({ ...READY_FOR_Q7, district: null });
  ok('asks for the AREA (Q2c) before Q7', n && n.q === 'Q2c', `got ${n && n.q}`);
  ok('Q2c keeps the city as the container', /di \*Surabaya\*/i.test(n.hint || ''), n && n.hint);
}

console.log('\n── Group 3: refusal is recorded against the AREA ──');
{
  const hist = [
    C('beli rumah di Surabaya'),
    A('Di area atau kawasan mana di Surabaya yang Anda pertimbangkan? 📍'),
    C('Area Pakuwon'),
    A('Selain area *Pakuwon*, apakah area sekitar masih oke? 🗺️'),
  ];

  for (const refusal of ['Tidak ada, Kak', 'tetap di Pakuwon saja', 'gak usah']) {
    const s = extractQualificationState(hist, refusal);
    ok(`"${refusal}" → focuses on the AREA`, /Pakuwon/i.test(s.alternativeAreas || ''),
       `got ${s.alternativeAreas}`);
    ok(`"${refusal}" does NOT say "Fokus di Surabaya"`,
       !/Fokus di Surabaya/i.test(s.alternativeAreas || ''), `got ${s.alternativeAreas}`);
  }

  // A real alternative area is still stored verbatim.
  const s2 = extractQualificationState(hist, 'Area Ciputra masih ok');
  ok('a real alternative area is kept verbatim', /Ciputra/i.test(s2.alternativeAreas || ''),
     `got ${s2.alternativeAreas}`);
}

console.log('\n── Group 4: new wording is still detected as a Q7 question ──');
{
  // If the detector stopped matching the new phrasing, Q7 answers would never
  // register and the question would loop — the exact failure mode of M52.
  const hist = [
    C('beli rumah di Surabaya'), A('Di area mana? 📍'), C('Area Pakuwon'),
    A('Selain area *Pakuwon*, apakah area sekitar masih oke? 🗺️'),
  ];
  const s = extractQualificationState(hist, 'Area Ciputra masih ok');
  ok('answer to the NEW wording is captured', !!s.alternativeAreas, `got ${s.alternativeAreas}`);

  // Private Agent phrasing ("Di *Surabaya*, ada area lain…") must also register.
  const histPA = [
    C('beli rumah di Surabaya'), A('Di area mana? 📍'), C('Area Pakuwon'),
    A('Di *Surabaya*, apakah ada area lain yang masih oke buat Kak pertimbangkan? 🗺️'),
  ];
  const sPA = extractQualificationState(histPA, 'Tidak ada, Kak');
  ok('answer to Private Agent wording is captured', !!sPA.alternativeAreas, `got ${sPA.alternativeAreas}`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);

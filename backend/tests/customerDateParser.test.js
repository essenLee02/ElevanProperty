/**
 * customerDateParser.test.js — 35 date rules + 24-combination BELI flow tests.
 * Runs against the REAL modules (not a local copy).
 *
 * Reference "today" for all date cases: 12 Juni 2026 (per spec).
 * Run: node tests/customerDateParser.test.js
 */

const { parseCustomerDate, isDontKnowDateAnswer } = require('../utils/customerDateParser');
const { extractQualificationState, findNextQuestion } = require('../services/aiPromptBuilderService');

const NOW = new Date(2026, 5, 12); // 12 Juni 2026

let pass = 0, fail = 0;
function assert(label, actual, expected) {
  const okk = JSON.stringify(actual) === JSON.stringify(expected);
  if (okk) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual  : ${JSON.stringify(actual)}`); }
}
const fmtOf = (txt) => { const r = parseCustomerDate(txt, NOW); return r && r.status === 'ok' ? r.formatted : (r ? r.status : null); };

console.log('── Group 1: 35 date rules (today = 12 Juni 2026) ──');
assert('1.  minggu depan → +7 hari',      fmtOf('minggu depan'), '19 Juni 2026');
assert('2.  besok',                        fmtOf('besok'), '13 Juni 2026');
assert('3.  bulan depan',                  fmtOf('bulan depan'), '12 Juli 2026');
assert('4.  19 Agustus',                   fmtOf('19 Agustus'), '19 Agustus 2026');
assert('5.  12 Mei (lewat → tahun depan)', fmtOf('12 Mei'), '12 Mei 2027');
assert('6.  tahun depan → +1 tahun',       fmtOf('tahun depan'), '12 Juni 2027');
assert('7.  11 September 2026',            fmtOf('11 September 2026'), '11 September 2026');
assert('8.  11 September 26',              fmtOf('11 September 26'), '11 September 2026');
assert('9.  11 Sep 2026',                  fmtOf('11 Sep 2026'), '11 September 2026');
assert('10. 9 Feb 2027',                   fmtOf('9 Feb 2027'), '09 Februari 2027');
assert('11. Maret, 12 → tahun depan',      fmtOf('Maret, 12'), '12 Maret 2027');
assert('12. Desember, 28 → tahun ini',     fmtOf('Desember, 28'), '28 Desember 2026');
assert('13. Dec, 28 2026',                 fmtOf('Dec, 28 2026'), '28 Desember 2026');
assert('14. Dec, 28 2027',                 fmtOf('Dec, 28 2027'), '28 Desember 2027');
assert('15. 13/06/2026 (DD/MM)',           fmtOf('13/06/2026'), '13 Juni 2026');
assert('16. 02/07/2026 (ambigu → DD/MM)',  fmtOf('02/07/2026'), '02 Juli 2026');
assert('17. 06/15/2026 (MM/DD, day>12)',   fmtOf('06/15/2026'), '15 Juni 2026');
assert('18. 09/13/2026 (MM/DD)',           fmtOf('09/13/2026'), '13 September 2026');
assert('19. 01/15/2027 (MM/DD)',           fmtOf('01/15/2027'), '15 Januari 2027');
assert('20. 02/13/2027 (MM/DD)',           fmtOf('02/13/2027'), '13 Februari 2027');
assert('21. 01/05/2027 (ambigu → DD/MM)',  fmtOf('01/05/2027'), '01 Mei 2027');
assert('22. 11/12/2026 (ambigu → DD/MM)',  fmtOf('11/12/2026'), '11 Desember 2026');
assert('23. 2026 Agustus → tgl 1',         fmtOf('2026 Agustus'), '01 Agustus 2026');
assert('24. Mei (lewat) → 01 Mei 2027',    fmtOf('Mei'), '01 Mei 2027');
assert('25. Juni (bulan berjalan) → ASK',  fmtOf('Juni'), 'ask_current_month');
assert('25b. Juni 2026 → ASK juga',        fmtOf('Juni 2026'), 'ask_current_month');
assert('26. Juli → 01 Juli 2026',          fmtOf('Juli'), '01 Juli 2026');
assert('27. Agustus → 01 Agustus 2026',    fmtOf('Agustus'), '01 Agustus 2026');
assert('28. Feb → 01 Februari 2027',       fmtOf('Feb'), '01 Februari 2027');
assert('29. Jan → 01 Januari 2027',        fmtOf('Jan'), '01 Januari 2027');
assert('30. 18 Jan → 18 Januari 2027',     fmtOf('18 Jan'), '18 Januari 2027');
assert('31. Aug 2 → 02 Agustus 2026',      fmtOf('Aug 2'), '02 Agustus 2026');
assert('32a. hari ini',                    fmtOf('hari ini'), '12 Juni 2026');
assert('32b. sekarang',                    fmtOf('sekarang'), '12 Juni 2026');
assert('33. June 12 2026',                 fmtOf('June 12 2026'), '12 Juni 2026');
assert('34. Lusa',                         fmtOf('Lusa'), '14 Juni 2026');
assert('35. Segera → ASK',                 fmtOf('Segera'), 'ask_soon');

console.log('\n── Group 2: parser guards ──');
assert('budget "2-4 juta/seminggu" bukan tanggal', parseCustomerDate('budget 2-4 juta/seminggu', NOW), null);
assert('"sama istri dan 2 anak" bukan tanggal',    parseCustomerDate('sama istri dan 2 anak', NOW), null);
assert('isDontKnowDateAnswer("belum tahu")',       isDontKnowDateAnswer('belum tahu kak'), true);
assert('isDontKnowDateAnswer("13 Juni") false',    isDontKnowDateAnswer('13 Juni'), false);

console.log('\n── Group 3: extractQualificationState date integration ──');
{
  const st = extractQualificationState([], 'Saya mau sewa rumah di Surabaya, masuk 19 Agustus');
  assert('moveInDate dinormalkan "19 Agustus 20xx"', /^19 Agustus 20\d{2}$/.test(st.moveInDate || ''), true);
}
{
  const st = extractQualificationState([], 'Saya mau sewa rumah di Surabaya, masuknya segera');
  assert('"segera" → moveInDate null + ask soon', { d: st.moveInDate, a: st.moveInDateAsk }, { d: null, a: 'soon' });
}
{
  const st = extractQualificationState([
    { role: 'customer',  message: 'Saya mau sewa rumah di Surabaya, masuknya segera' },
    { role: 'assistant', message: 'Kak, boleh tau kira-kira tanggal masuknya?' },
  ], 'belum tahu kak, belum pasti');
  assert('segera + belum tahu → "Waiting the update"', st.moveInDate, 'Waiting the update');
}
{
  const st = extractQualificationState([], 'Saya mau beli rumah di Surabaya, pakai KPR');
  assert('beli + KPR → financing KPR', st.financing, 'KPR');
  assert('KPR alias → transactionType sale', st.transactionType, 'sale');
}

console.log('\n── Group 4: BELI flow (24 kombinasi) via findNextQuestion ──');
const beliBase = {
  buildingType: 'house', transactionType: 'sale', location: 'Surabaya',
  searchHistory: 'yes', budget: '1M', moveInDate: '12 Juli 2026',
  household: 'keluarga', redFlags: 'tidak ada', anchorPoint: 'dekat sekolah',
  alternativeAreas: 'boleh', decisionMaker: 'Mandiri',
};
assert('house beli tanpa financing → Q_KPR', findNextQuestion({ ...beliBase }).q, 'Q_KPR');
assert('house beli + KPR → Q_KPR-a',         findNextQuestion({ ...beliBase, financing: 'KPR' }).q, 'Q_KPR-a');
assert('house beli + cash → Q_COND',         findNextQuestion({ ...beliBase, financing: 'cash' }).q, 'Q_COND');
assert('house beli + kondisi → Q11 furnitur', findNextQuestion({ ...beliBase, financing: 'cash', propertyCondition: 'second' }).q, 'Q11');
assert('house beli lengkap → null (summary)', findNextQuestion({ ...beliBase, financing: 'cash', propertyCondition: 'second', furnishing: 'kosongan' }), null);
assert('hotel beli → Q14 akuisisi',          findNextQuestion({ ...beliBase, buildingType: 'hotel', financing: 'cash' }).hint.includes('operasional'), true);
assert('kos beli → Q14 investasi kos',       findNextQuestion({ ...beliBase, buildingType: 'boarding_house', financing: 'cash' }).hint.includes('pengelola'), true);
assert('ruko beli → Q14 tenant status',      findNextQuestion({ ...beliBase, buildingType: 'shophouse', financing: 'cash' }).hint.includes('tenant'), true);
assert('gudang beli → Q14 zonasi',           findNextQuestion({ ...beliBase, buildingType: 'warehouse', financing: 'cash' }).hint.includes('zona'), true);
assert('toko beli → Q14 trade center/yield', findNextQuestion({ ...beliBase, buildingType: 'store', financing: 'cash' }).hint.includes('trade center'), true);
assert('kantor beli → Q14 SHMSRS',           findNextQuestion({ ...beliBase, buildingType: 'office', financing: 'cash' }).hint.includes('SHMSRS'), true);
assert('others beli → Q14 sertifikat+zonasi', findNextQuestion({ ...beliBase, buildingType: 'others', financing: 'cash' }).hint.includes('zonasi'), true);
assert('apartemen beli → Q_COND dulu',       findNextQuestion({ ...beliBase, buildingType: 'apartment', financing: 'cash', apartmentPref: 'lantai tinggi' }).q, 'Q_COND');
assert('mansion beli → Q14 multi-generasi',  findNextQuestion({ ...beliBase, buildingType: 'mansion', financing: 'cash', propertyCondition: 'baru/ready', furnishing: 'semi' }).hint.includes('multi-generasi'), true);
assert('kondotel beli → Q14 ROI',            findNextQuestion({ ...beliBase, buildingType: 'kondotel', financing: 'cash' }).hint.includes('ROI'), true);
assert('beli Q8 wording = target beli',      findNextQuestion({ buildingType: 'house', transactionType: 'sale', location: 'Surabaya', searchHistory: 'y', budget: '1M' }).hint.includes('target'), true);
assert('beli Q4 investasi → target penyewa', findNextQuestion({ ...beliBase, household: null, useCase: 'investasi' }).hint.includes('disewakan ke siapa'), true);

console.log('\n── Group 5: Q8 klarifikasi (rule 25/35) via findNextQuestion ──');
const sewaBase = { buildingType: 'house', transactionType: 'rent', location: 'Surabaya', searchHistory: 'y', budget: '5jt' };
assert('moveInDateAsk=current_month → Q8 hint Waiting the update',
  findNextQuestion({ ...sewaBase, moveInDateAsk: 'current_month' }).hint.includes('Waiting the update'), true);
assert('moveInDateAsk=soon → Q8 hint tanya tanggal',
  findNextQuestion({ ...sewaBase, moveInDateAsk: 'soon' }).hint.includes('boleh tau kira-kira tanggalnya'), true);
assert('sewa komersial Q8 = mulai operasional',
  findNextQuestion({ ...sewaBase, buildingType: 'warehouse' }).hint.includes('operasional'), true);

console.log('\n═══════════════════════════════════');
console.log(`RESULT: ${pass}/${pass + fail} passed ${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}`);
console.log('═══════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);

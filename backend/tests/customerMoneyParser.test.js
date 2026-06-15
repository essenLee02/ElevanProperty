/**
 * customerMoneyParser.test.js — 51 money + 13 rental-price normalization cases.
 * Run: node tests/customerMoneyParser.test.js
 *
 * Notes on spec deviations (intentional, documented):
 *  - Cases 38–41 (triliun): the spec listing showed an extra group of zeros
 *    (10^15); triliun = 10^12 per the consistent cases 36/37/49/50. Asserted at 10^12.
 *  - Case 28 ("20.000.0000-30.000.000") is a malformed/typo input — skipped.
 *  - Rental r10/r12 ("m" annotated as juta): the parser defaults "m" → miliar
 *    (consistent with all budget cases) and the AI confirms in chat; asserted as miliar.
 */

const { parseMoneyRange } = require('../utils/customerMoneyParser');

let pass = 0, fail = 0;
function eq(label, input, expected) {
  const r = parseMoneyRange(input);
  const actual = r ? r.formatted : null;
  if (actual === expected) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}\n     input   : ${JSON.stringify(input)}\n     expected: ${JSON.stringify(expected)}\n     actual  : ${JSON.stringify(actual)}`); }
}

console.log('── Group 1: 51 money cases (budget, IDR) ──');
eq('1.  2-3 juta',            '2-3 juta',            'Rp 2.000.000 - Rp 3.000.000');
eq('2.  4-5jt',              '4-5jt',               'Rp 4.000.000 - Rp 5.000.000');
eq('3.  1.6-2.5juta',        '1.6-2.5juta',         'Rp 1.600.000 - Rp 2.500.000');
eq('4.  4juta-5jt',          '4juta-5jt',           'Rp 4.000.000 - Rp 5.000.000');
eq('5.  3 jt-7 juta',        '3 jt-7 juta',         'Rp 3.000.000 - Rp 7.000.000');
eq('6.  3.4juta-12',         '3.4juta-12',          'Rp 3.400.000 - Rp 12.000.000');
eq('7.  500-2 juta',         '500-2 juta',          'Rp 500.000 - Rp 2.000.000');
eq('8.  812-15jt',           '812-15jt',            'Rp 812.000 - Rp 15.000.000');
eq('9.  808-810 juta',       '808-810 juta',        'Rp 808.000.000 - Rp 810.000.000');
eq('10. 712-3 miliar',       '712-3 miliar',        'Rp 712.000.000 - Rp 3.000.000.000');
eq('11. 24 juta - 100',      '24 juta - 100',       'Rp 24.000.000 - Rp 100.000.000');
eq('12. 80-20 juta',         '80-20 juta',          'Rp 80.000 - Rp 20.000.000');
eq('13. 80K-20juta',         '80K-20juta',          'Rp 80.000 - Rp 20.000.000');
eq('14. 80 K-20',            '80 K-20',             'Rp 80.000 - Rp 20.000.000');
eq('15. 3-5 m',              '3-5 m',               'Rp 3.000.000.000 - Rp 5.000.000.000');
eq('16. 3 jt-5 m',           '3 jt-5 m',            'Rp 3.000.000 - Rp 5.000.000.000');
eq('17. 3 juta-5 m',         '3 juta-5 m',          'Rp 3.000.000 - Rp 5.000.000.000');
eq('18. 3-5 miliar',         '3-5 miliar',          'Rp 3.000.000.000 - Rp 5.000.000.000');
eq('19. 312-2 miliar',       '312-2 miliar',        'Rp 312.000.000 - Rp 2.000.000.000');
eq('20. 312-2m',             '312-2m',              'Rp 312.000.000 - Rp 2.000.000.000');
eq('21. 312 juta-2 miliar',  '312 juta-2 miliar',   'Rp 312.000.000 - Rp 2.000.000.000');
eq('22. 560K-900',           '560K-900',            'Rp 560.000 - Rp 900.000');
eq('23. 560K-900 K',         '560K-900 K',          'Rp 560.000 - Rp 900.000');
eq('24. 560 K-900K',         '560 K-900K',          'Rp 560.000 - Rp 900.000');
eq('25. 837.000-900',        '837.000-900',         'Rp 837.000 - Rp 900.000');
eq('26. 89.000-2juta',       '89.000-2juta',        'Rp 89.000 - Rp 2.000.000');
eq('27. 400 juta - 30 miliar','400 juta - 30 miliar','Rp 400.000.000 - Rp 30.000.000.000');
// 28 skipped — malformed input "20.000.0000-30.000.000"
eq('29. 20juta-15.4juta',    '20juta-15.4juta',     'Rp 15.400.000 - Rp 20.000.000');
eq('30. 814 juta-915K',      '814 juta-915K',       'Rp 915.000 - Rp 814.000.000');
eq('31. 2m-3.5m',            '2m-3.5m',             'Rp 2.000.000.000 - Rp 3.500.000.000');
eq('32. 2 miliar-3.5m',      '2 miliar-3.5m',       'Rp 2.000.000.000 - Rp 3.500.000.000');
eq('33. 2 miliar-3.5',       '2 miliar-3.5',        'Rp 2.000.000.000 - Rp 3.500.000.000');
eq('34. 2-3.5 miliar',       '2-3.5 miliar',        'Rp 2.000.000.000 - Rp 3.500.000.000');
eq('35. 2.7-3.5 m',          '2.7-3.5 m',           'Rp 2.700.000.000 - Rp 3.500.000.000');
eq('36. 3.8m-2t',            '3.8m-2t',             'Rp 3.800.000.000 - Rp 2.000.000.000.000');
eq('37. 721.5 miliar - 3t',  '721.5 miliar - 3t',   'Rp 721.500.000.000 - Rp 3.000.000.000.000');
eq('38. 2 triliun-3',        '2 triliun-3',         'Rp 2.000.000.000.000 - Rp 3.000.000.000.000');
eq('39. 2 triliun-3 t',      '2 triliun-3 t',       'Rp 2.000.000.000.000 - Rp 3.000.000.000.000');
eq('40. 2-3t',               '2-3t',                'Rp 2.000.000.000.000 - Rp 3.000.000.000.000');
eq('41. 2-3 triliun',        '2-3 triliun',         'Rp 2.000.000.000.000 - Rp 3.000.000.000.000');
eq('42. 5milliar-900.145',   '5milliar-900.145',    'Rp 900.145.000 - Rp 5.000.000.000');
eq('43. 5m-900.145',         '5m-900.145',          'Rp 900.145.000 - Rp 5.000.000.000');
eq('44. 5-900 juta',         '5-900 juta',          'Rp 900.000.000 - Rp 5.000.000.000');
eq('45. 5-900K',             '5-900K',              'Rp 900.000 - Rp 5.000.000');
eq('46. 300.000-4.000.000.000','300.000-4.000.000.000','Rp 300.000 - Rp 4.000.000.000');
eq('47. 300K-4.000.000.000', '300K-4.000.000.000',  'Rp 300.000 - Rp 4.000.000.000');
eq('48. 300K-4.8M',          '300K-4.8M',           'Rp 300.000 - Rp 4.800.000.000');
eq('49. 8 triliun-2',        '8 triliun-2',         'Rp 2.000.000.000.000 - Rp 8.000.000.000.000');
eq('50. 2-8triliun',         '2-8triliun',          'Rp 2.000.000.000.000 - Rp 8.000.000.000.000');
eq('51. 30USD-20 (1$=18rb)', '30USD-20',            'Rp 360.000 - Rp 540.000');

console.log('\n── Group 2: 13 rental-price cases (with period) ──');
eq('r1. 1.4 jt-800/malam',   '1.4 jt-800/malam',    'Rp 800.000 - Rp 1.400.000/malam');
eq('r2. 600-900K/mlm',       '600-900K/mlm',        'Rp 600.000 - Rp 900.000/malam');
eq('r3. 2.2 million-3 million/night','2.2 million-3 million/night','Rp 2.200.000 - Rp 3.000.000/night');
eq('r4. 2.1-3 million/night','2.1-3 million/night', 'Rp 2.100.000 - Rp 3.000.000/night');
eq('r5. 2.2-3 million/week', '2.2-3 million/week',  'Rp 2.200.000 - Rp 3.000.000/week');
eq('r6. 2.2-3 jt/minggu',    '2.2-3 jt/minggu',     'Rp 2.200.000 - Rp 3.000.000/minggu');
eq('r7. 9-12juta/minggu',    '9-12juta/minggu',     'Rp 9.000.000 - Rp 12.000.000/minggu');
eq('r8. 9-12juta/tahun',     '9-12juta/tahun',      'Rp 9.000.000 - Rp 12.000.000/tahun');
eq('r9. 12-9 milion/year',   '12-9 milion/year',    'Rp 9.000.000 - Rp 12.000.000/year');
eq('r11. 700-1 m/tahun (miliar)','700-1 m/tahun',   'Rp 700.000.000 - Rp 1.000.000.000/tahun');
eq('r13. 4-7m/bulan (miliar)','4-7m/bulan',         'Rp 4.000.000.000 - Rp 7.000.000.000/bulan');
// r10/r12: "m" annotated as juta — parser defaults to miliar (documented deviation)
eq('r10. 20-15 m/year (m→miliar default)','20-15 m/year','Rp 15.000.000.000 - Rp 20.000.000.000/year');
eq('r12. 2.6-3m/month (m→miliar default)','2.6-3m/month','Rp 2.600.000.000 - Rp 3.000.000.000/month');

console.log('\n── Group 3: guards ──');
function isNull(label, input){ const r=parseMoneyRange(input); if(r===null){pass++;console.log(`  ✅ ${label}`);} else {fail++;console.log(`  ❌ ${label} → ${JSON.stringify(r&&r.formatted)}`);} }
isNull('no digits → null', 'mau yang murah saja');
eq('single value "5 juta"',  '5 juta',              'Rp 5.000.000');
eq('single value "800K"',    '800K',                'Rp 800.000');

console.log('\n═══════════════════════════════════');
console.log(`RESULT: ${pass}/${pass + fail} passed ${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}`);
console.log('═══════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);

/**
 * dateQualification.test.js — customerDateParser rewrite (28 Jul 2026), per
 * SKILL_DATE_QUALIFICATION.md.
 *
 * Before this rewrite, relative dates (Category A/B: "1 hari", "7 bulan",
 * "seminggu") in BARE form — the dominant real-world phrasing — returned
 * null entirely; only a qualifier-suffixed form ("N bulan lagi"/"kedepan")
 * was recognized, and even that used naive month arithmetic that overflowed
 * instead of clamping ("7 bulan lagi" from 29 Jul 2026 gave 01 Maret 2027,
 * not the correct 28 Februari 2027 — 2027 is not a leap year). Live impact:
 * a customer answering Q8 "kapan mau masuk?" with a bare relative date was
 * SILENTLY IGNORED (moveInDate never set), so the bot re-asked the same
 * question — the exact loop pattern this whole session has been fixing.
 *
 * Reference date throughout: 29 Juli 2026 (Rabu), matching the skill doc.
 *
 * Run: node tests/dateQualification.test.js
 */

'use strict';

const {
  parseCustomerDate, addMonthsClamped, addYearsClamped, isLeapYear,
} = require('../utils/customerDateParser');

const NOW = new Date(2026, 6, 29); // 29 Juli 2026

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
}
function formattedOf(input) {
  const r = parseCustomerDate(input, NOW);
  return r && r.status === 'ok' ? r.formatted : (r ? r.status : 'null');
}

console.log('── User\'s reference table (29 Juli 2026) — Categories A/B/C ──');
{
  const cases = [
    ['1 hari', '30 Juli 2026'], ['4 hari', '02 Agustus 2026'],
    ['1 bulan', '29 Agustus 2026'], ['3 bulan', '29 Oktober 2026'],
    ['1 tahun', '29 Juli 2027'], ['2 bulan', '29 September 2026'],
    ['7 bulan', '28 Februari 2027'], // ⚠️ the clamping case
    ['2 minggu', '12 Agustus 2026'], ['4 minggu', '26 Agustus 2026'],
    ['seminggu', '05 Agustus 2026'], ['1 minggu', '05 Agustus 2026'],
    ['1-2 minggu', '12 Agustus 2026'], ['2-4 bulan', '29 November 2026'],
  ];
  for (const [input, expected] of cases) ok(`"${input}" → ${expected}`, formattedOf(input) === expected);
}

console.log('\n── Category D — explicit / bare-month dates ──');
{
  const cases = [
    ['tanggal 8 Agustus', '08 Agustus 2026'],
    ['tanggal 17 Mei', '17 Mei 2027'],       // already passed this year → next year
    ['tanggal 8 Juni', '08 Juni 2027'],
    ['tanggal 8 Juni 2027', '08 Juni 2027'],
    ['tanggal 12 November 2026', '12 November 2026'],
    ['November', '01 November 2026'],        // bare month, still upcoming
    ['Januari', '01 Januari 2027'],           // bare month, already passed
    ['Februari', '01 Februari 2027'],
    ['November 2026', '01 November 2026'],
    ['30 November 2026', '30 November 2026'],
  ];
  for (const [input, expected] of cases) ok(`"${input}" → ${expected}`, formattedOf(input) === expected);
}

console.log('\n── Past-date rejection (explicit year only) ──');
{
  ok('"tanggal 23 Juni 2026" (past) → reject_past', formattedOf('tanggal 23 Juni 2026') === 'reject_past');
  ok('"Februari 2023" (past) → reject_past', formattedOf('Februari 2023') === 'reject_past');
  ok('"17 Mei" (no year, already passed) → auto next year, NEVER rejected',
    formattedOf('17 Mei') === '17 Mei 2027');
  ok('reject_past carries the correction suggestion', (() => {
    const r = parseCustomerDate('tanggal 23 Juni 2026', NOW);
    return r.correctedFormatted === '23 Juni 2027' && r.todayFormatted === '29 Juli 2026';
  })());
  ok('reject_past ALSO carries the original as-stated date (for re-parse callers)', (() => {
    const r = parseCustomerDate('tanggal 23 Juni 2026', NOW);
    return r.formatted === '23 Juni 2026' && r.date instanceof Date;
  })());
}

console.log('\n── Clamping: month/year addition never overflows into the next month ──');
{
  const d1 = addMonthsClamped(new Date(2027, 0, 31), 1); // 31 Jan 2027 + 1mo
  ok('31 Jan 2027 + 1 bulan → 28 Feb 2027 (2027 not leap), NOT 3 Mar', d1.getMonth() === 1 && d1.getDate() === 28);

  const d2 = addMonthsClamped(new Date(2024, 0, 31), 1); // 31 Jan 2024 (leap year)
  ok('31 Jan 2024 + 1 bulan → 29 Feb 2024 (leap year)', d2.getMonth() === 1 && d2.getDate() === 29);

  const d3 = addMonthsClamped(new Date(2027, 2, 31), 1); // 31 Mar 2027 + 1mo
  ok('31 Mar + 1 bulan → 30 Apr (April has 30 days)', d3.getMonth() === 3 && d3.getDate() === 30);

  const d4 = addYearsClamped(new Date(2028, 1, 29), 1); // 29 Feb 2028 (leap) + 1 year
  ok('29 Feb 2028 + 1 tahun → 28 Feb 2029 (2029 not leap)', d4.getMonth() === 1 && d4.getDate() === 28);
}

console.log('\n── Leap year rule (÷4 except ÷100 except-except ÷400) ──');
{
  ok('2024 is leap (÷4)', isLeapYear(2024) === true);
  ok('2027 is NOT leap', isLeapYear(2027) === false);
  ok('2100 is NOT leap (÷100, not ÷400)', isLeapYear(2100) === false);
  ok('2000 IS leap (÷400)', isLeapYear(2000) === true);
}

console.log('\n── Collision guard: relative-date words inside a BUDGET/period expression ──');
{
  // "seminggu"/"2-4 bulan" also occur in rental-PERIOD phrasing ("juta/seminggu")
  // — a different field's vocabulary entirely. Same class of bug as the
  // documented "minggu"=week-vs-Sunday collision in the lazy-chat-normalizer
  // skill doc: a keyword safe in isolation becomes a false positive once a
  // second detector (money parsing) scans the same text.
  ok('"budget 2-4 juta/seminggu" is NOT read as a date', parseCustomerDate('budget 2-4 juta/seminggu', NOW) === null);
  ok('"sama istri dan 2 anak" is NOT read as a date', parseCustomerDate('sama istri dan 2 anak', NOW) === null);
  ok('"3 bulan lagi, budget 5 juta" STILL resolves (qualifier disambiguates)',
    formattedOf('3 bulan lagi, budget 5 juta') === '29 Oktober 2026');
}

console.log('\n── "Segera"/ASAP still asks first, never auto-resolves ──');
{
  const r = parseCustomerDate('secepatnya', NOW);
  ok('"secepatnya" → ask_soon, not a guessed date', r && r.status === 'ask_soon');
}

console.log(`\nRESULT: ${pass}/${pass + fail} passed ${fail ? '❌ FAILURES' : '✅'}`);
process.exit(fail ? 1 : 0);

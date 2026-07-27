/**
 * sessionResetGuards.test.js — regression guards for FALSE-POSITIVE session resets.
 *
 * Both bugs below shared one root cause: the Phase-0 type/tx detectors in
 * chatbotPrivateController.js and aiPromptBuilderService.js were written twice
 * (twin logic) and applied a WEAKER strip chain than detectBuildingType() in
 * propertyRecommendationService. When a detector disagreed with the one that
 * filled `filters`, the disagreement was read as a type/transaction switch —
 * firing the M35 switch-boundary reset and DISCARDING the customer's location
 * mid-search, so the bot asked "Di kota mana?" again.
 *
 * Customer-visible symptom (both cases): the bot forgets the city and loops.
 *
 * Run: node tests/sessionResetGuards.test.js
 */

'use strict';

const { ConversationQualifier: CQ } = require('../controllers/chatbotPrivateController');

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
}

const profileFor = (history, message, filters) => CQ.buildProfile(history, message, filters);
const kept = (p, loc) => p.location === loc && !p.buildingTypeChanged;

/* ── Bug 1: a Q6 anchor naming a property-type word must not reset ────────── */
console.log('── Q6 anchor answers must NOT trigger a type switch ──');
{
  const history = [
    { role: 'user', message: 'mau sewa rumah di surabaya' },
    { role: 'ai', message: 'Ada lokasi tertentu yang jadi patokan?' },
  ];
  const filters = { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' };

  for (const answer of [
    'deket kantor dan mall',
    'dekat kantor saya',
    'deket gudang',
    'dekat toko kelontong',
    'dekat pasar besar',
    'deket rumah sakit',
    'di sekitar ruko blok M',
  ]) {
    const p = profileFor(history, answer, filters);
    ok(`"${answer}" → type stays house, location kept`,
       p.buildingType === 'house' && kept(p, 'Surabaya'));
  }
}

/* ── Bug 2: a BUYER's investment plan must not read as a tx flip ──────────── */
console.log('\n── BELI investment intent must NOT flip sale→rent ──');
{
  const history = [
    { role: 'user', message: 'mau beli rumah di surabaya' },
    { role: 'ai', message: 'Apa yang membuat cari rumah sekarang?' },
  ];
  const filters = { buildingType: 'house', transactionType: 'sale', location: 'Surabaya' };

  for (const answer of [
    'buat investasi, mau disewakan lagi',
    'mau disewakan lagi',
    'untuk disewakan ke karyawan',
    'nanti disewakan ke mahasiswa',
    'rencananya disewakan',
  ]) {
    const p = profileFor(history, answer, filters);
    ok(`"${answer}" → location kept, no reset`, kept(p, 'Surabaya'));
  }
}

/* ── Controls: REAL switches must still reset (guards over-stripping) ─────── */
console.log('\n── CONTROL: genuine switches must STILL reset ──');
{
  const villaHist = [
    { role: 'user', message: 'mau sewa villa di surabaya' },
    { role: 'ai', message: 'Rencananya masuk bulan apa?' },
  ];
  const p1 = profileFor(villaHist, 'mau cari hotel aja', { buildingType: 'hotel', transactionType: 'rent' });
  ok('villa → "mau cari hotel aja" still resets', p1.buildingTypeChanged === true);

  const houseHist = [
    { role: 'user', message: 'mau sewa rumah di surabaya' },
    { role: 'ai', message: 'Budget berapa?' },
  ];
  const p2 = profileFor(houseHist, 'mau sewa kantor aja', { buildingType: 'office', transactionType: 'rent' });
  ok('rumah → "mau sewa kantor aja" still resets (real office request)',
     p2.buildingType === 'office' && p2.buildingTypeChanged === true);

  const beliHist = [
    { role: 'user', message: 'mau beli rumah di surabaya' },
    { role: 'ai', message: 'Target kapan?' },
  ];
  const p3 = profileFor(beliHist, 'eh bukan beli, mau sewa aja', { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' });
  ok('beli → "eh bukan beli, mau sewa aja" still resets (real tx flip)',
     p3.buildingTypeChanged === true && p3.transactionType === 'rent');

  // A renter genuinely looking at rented-out listings must still read as rent.
  const p4 = profileFor([], 'cari rumah yang disewakan di malang',
    { buildingType: 'house', transactionType: 'rent', location: 'Malang' });
  ok('"cari rumah yang disewakan" still detected as rent', p4.transactionType === 'rent');
}

console.log(`\nRESULT: ${pass}/${pass + fail} passed ${fail ? '❌ FAILURES' : '✅'}`);
process.exit(fail ? 1 : 0);

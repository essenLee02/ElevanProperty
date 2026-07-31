/**
 * facilitiesAndPremium.test.js — comprehensive standard-facilities table
 * (28 Jul 2026 update, 11 property types) + the new PREMIUM tier signal.
 *
 * Design note: the deterministic Private Agent brief deliberately does NOT
 * mechanically dump the full ~28-item premium list into the customer summary
 * (measured 573 chars, mostly irrelevant items like "Basketball Court" on a
 * random villa) — it only flags `wantsPremium` for the agent. Full premium
 * item selection is the judgment-capable LLM providers' job (skill docs).
 *
 * Run: node tests/facilitiesAndPremium.test.js
 */

'use strict';

const { getStandardFacilitiesByType, getPremiumFacilities, wantsPremiumFacilities } = require('../utils/standardFacilities');
const { ConversationQualifier: CQ } = require('../controllers/chatbotPrivateController');

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
}

console.log('── All 11 property types have a standard-facilities entry ──');
{
  const types = ['house', 'apartment', 'condo', 'boarding_house', 'villa', 'hotel',
    'kondotel', 'mansion', 'shophouse', 'office', 'warehouse', 'store'];
  for (const t of types) {
    ok(`"${t}" returns a non-null facility list`, !!getStandardFacilitiesByType(t));
  }
  ok('unknown type returns null', getStandardFacilitiesByType('nonexistent_type') === null);
}

console.log('\n── Furnishing tiers still work for residential types ──');
{
  const base = getStandardFacilitiesByType('house');
  const semi = getStandardFacilitiesByType('house', 'semi');
  const full = getStandardFacilitiesByType('house', 'full');
  ok('semi has MORE items than bare', semi.split(',').length > base.split(',').length);
  ok('full has MORE items than semi', full.split(',').length > semi.split(',').length);
  ok('commercial types ignore furnishing (office same regardless)',
    getStandardFacilitiesByType('office', 'full') === getStandardFacilitiesByType('office', ''));
}

console.log('\n── wantsPremiumFacilities: trigger words ──');
{
  ok('"villa mewah" triggers', wantsPremiumFacilities('mau villa mewah di bali'));
  ok('"eksklusif" triggers', wantsPremiumFacilities('cari yang eksklusif'));
  ok('"premium" triggers', wantsPremiumFacilities('condo premium dong'));
  ok('"luxury" triggers', wantsPremiumFacilities('luxury apartment'));
  ok('"fully furnished" triggers (per product spec)', wantsPremiumFacilities('fully furnished ya'));
  ok('budget tier "eksklusif" alone triggers (reuses Q3 signal)', wantsPremiumFacilities('', 'eksklusif'));
  ok('ordinary message does NOT trigger', !wantsPremiumFacilities('mau sewa rumah biasa aja'));
  ok('budget tier "menengah" does NOT trigger', !wantsPremiumFacilities('', 'menengah'));
}

console.log('\n── getPremiumFacilities: reference list ──');
{
  const list = getPremiumFacilities();
  ok('list is a non-empty comma-joined string', typeof list === 'string' && list.length > 0);
  ok('includes "Private Pool"', list.includes('Private Pool'));
  ok('includes "Ocean View"', list.includes('Ocean View'));
  ok('has ~28 items', list.split(', ').length >= 25);
}

console.log('\n── Private Agent brief: premium is FLAGGED, not dumped ──');
{
  const history = [
    { role: 'user', message: 'mau sewa villa di bali' },
    { role: 'ai', message: 'Fasilitas apa yang diinginkan?' },
  ];
  const msg = 'fasilitas standar aja, tapi maunya villa yang mewah';
  const filters = { buildingType: 'villa', transactionType: 'rent', location: 'Bali' };
  const profile = CQ.buildProfile(history, msg, filters);
  const brief = CQ.buildAgentBrief(profile, filters, history, msg);

  ok('facilities.wantsPremium is true', brief.facilities.wantsPremium === true);
  ok('facilities.value stays reasonably sized (standard list only, no 28-item dump)',
    brief.facilities.value.length < 250);
  ok('facilities.value does NOT contain unrelated premium noise ("Basketball Court")',
    !brief.facilities.value.includes('Basketball Court'));

  // Control: no premium intent → flag stays false, standard behavior unaffected.
  const historyPlain = [
    { role: 'user', message: 'mau sewa rumah di surabaya' },
    { role: 'ai', message: 'Fasilitas apa yang diinginkan?' },
  ];
  const profilePlain = CQ.buildProfile(historyPlain, 'standar aja', { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' });
  const briefPlain = CQ.buildAgentBrief(profilePlain, { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' }, historyPlain, 'standar aja');
  ok('CONTROL: no premium words → wantsPremium false', briefPlain.facilities.wantsPremium === false);
}

console.log(`\nRESULT: ${pass}/${pass + fail} passed ${fail ? '❌ FAILURES' : '✅'}`);
process.exit(fail ? 1 : 0);

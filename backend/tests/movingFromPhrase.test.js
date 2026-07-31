/**
 * movingFromPhrase.test.js — "pindah dari [tipe]" must not be read as the
 * DESIRED building type.
 *
 * Live bug found while building the listing-referral house pilot (28 Jul 2026):
 * "buat keluarga, mau pindah dari apartemen" (customer explaining they're
 * leaving their current apartment) was detected as buildingType='apartment'.
 * Since the search had started as buildingType='house' (from "minat rumah
 * citraland..."), this false type mismatch fired the switch-boundary reset —
 * discarding the location and looping the transaction-type question forever.
 *
 * Same family as the "deket kantor" / "mau disewakan lagi" false-positive
 * resets fixed earlier this session (see sessionResetGuards.test.js) — a
 * detector reading a word out of context as the desired type/transaction.
 *
 * Run: node tests/movingFromPhrase.test.js
 */

'use strict';

const { extractPropertyFilters } = require('../services/propertyRecommendationService');
const { ConversationQualifier: CQ } = require('../controllers/chatbotPrivateController');

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
}

console.log('── "pindah dari X" must NOT detect building type = X ──');
{
  const cases = [
    'buat keluarga, mau pindah dari apartemen',
    'capek pindah dari kos terus',
    'saya mau keluar dari kontrakan',
    'lagi hijrah dari rumah kontrakan lama',
  ];
  for (const msg of cases) {
    const filters = extractPropertyFilters(msg, []);
    ok(`"${msg}" → buildingType empty`, !filters.buildingType);
  }
}

console.log('\n── CONTROL: a genuine type mention still detects correctly ──');
{
  const cases = [
    ['mau apartemen di surabaya', 'apartment'],
    ['sewa rumah di malang', 'house'],
    ['cari kos deket kampus', 'boarding_house'],
  ];
  for (const [msg, expected] of cases) {
    const filters = extractPropertyFilters(msg, []);
    ok(`"${msg}" → ${expected}`, filters.buildingType === expected);
  }
}

console.log('\n── FULL live-transcript repro: no false reset, no loop ──');
{
  const history = [
    { role: 'user', message: 'minat rumah citraland 1.2M yg di rumah123 masih ada?' },
    { role: 'ai', message: 'Halo Kak! Noted 👍 Ini rencananya mau disewa atau beli Kak?' },
  ];
  const msg = 'buat keluarga, mau pindah dari apartemen';
  const filters = extractPropertyFilters(msg, history);
  const profile = CQ.buildProfile(history, msg, filters);

  ok('building type stays house (not flipped to apartment)', profile.buildingType === 'house');
  ok('NOT flagged as a type switch', !profile.buildingTypeChanged);
  ok('aiCount NOT reset to 0 (no false session reset)', profile.aiCount > 0);
  ok('tx-type question NOT re-asked (aiAskedTxType still true)', profile.aiAskedTxType === true);
}

console.log(`\nRESULT: ${pass}/${pass + fail} passed ${fail ? '❌ FAILURES' : '✅'}`);
process.exit(fail ? 1 : 0);

/**
 * housePilot.test.js — House v2 pilot qualifier (Clarence Skills) flow + scoring.
 * Run: node tests/housePilot.test.js
 */

const { ConversationQualifier: CQ, ResponseBuilderWhatsApp: RB } = require('../controllers/chatbotPrivateController');
const { extractPropertyFilters } = require('../services/propertyRecommendationService');

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
}
const Q = (p) => CQ.getNextQuestionHousePilot(p, 'id', null, 'Andy', 'Brighton') || '';
const has = (q, s) => q.toLowerCase().includes(s.toLowerCase());

console.log('── Group 1: gating ──');
ok('house + default ON → enabled', CQ.housePilotEnabled({ buildingType: 'house' }) === true);
ok('non-house → disabled',         CQ.housePilotEnabled({ buildingType: 'apartment' }) === false);

console.log('\n── Group 2: BELI question order ──');
ok('opener greets as unnamed assistant of Andy (Brighton)',
   has(Q({ buildingType: 'house', aiCount: 0 }), 'asisten dari *Andy* (*Brighton*)'));
ok('opener never names a persona (no LEO)',
   !has(Q({ buildingType: 'house', aiCount: 0 }), 'leo'));
ok('tx known → ask location',
   has(Q({ buildingType: 'house', transactionType: 'sale', aiCount: 1, aiAskedTxType: true }), 'kota atau area'));

const base = {
  buildingType: 'house', transactionType: 'sale', location: 'Citraland', aiCount: 3,
  aiAskedTxType: true, aiAskedLocation: true,
};
ok('location → MOTIVATION (why now)',     has(Q(base), 'apa yang membuat'));
const mot = { ...base, hasMotivation: true, aiAskedMotivation: true };
ok('motivation → search history',          has(Q(mot), 'sudah sempat lihat'));
const sh = { ...mot, hasSearchHistory: true, aiAskedSearchHist: true };
ok('search history → budget two-option',   has(Q(sh), 'kisaran') && has(Q(sh), 'mendekati rencana'));
ok('budget question never asks "berapa budget" directly', !has(Q(sh), 'berapa budget'));
const bud = { ...sh, budget: '1.8-2.2M', aiAskedBudget: true };
ok('budget → occupants (infer rooms)',     has(Q(bud), 'ditinggali bersama siapa'));
ok('never asks bedroom count directly',    !has(Q(bud), 'berapa kamar'));
const occ = { ...bud, hasHouseholdInfo: true, aiAskedHousehold: true };
ok('occupants → FINANCING method (KPR/cash)', has(Q(occ), 'kpr') && has(Q(occ), 'cash'));

const kpr = { ...occ, hasFinancing: true, financingIsKPR: true, aiAskedFinancing: true };
ok('KPR → approval + DP readiness',        has(Q(kpr), 'ajukan ke bank') && has(Q(kpr), 'dp'));
const cashSale = { ...occ, hasFinancing: true, financingCash: true, financingFromSale: true, aiAskedFinancing: true };
ok('cash-from-sale → contingency status',  has(Q(cashSale), 'sudah terjual atau masih proses'));
const fin = { ...occ, hasFinancing: true, financingCash: true, aiAskedFinancing: true };
ok('financing done → target timeline',     has(Q(fin), 'target') && has(Q(fin), 'beli'));
const tl = { ...fin, hasMoveInDate: true, aiAskedMoveIn: true };
ok('timeline → decision maker (indirect)', has(Q(tl), 'jadwalkan survey'));
ok('decision maker never asks "siapa yang putuskan"', !has(Q(tl), 'siapa yang putuskan'));
const dm = { ...tl, hasDecisionMaker: true, aiAskedDecisionMaker: true };
ok('decision → red flags',                 has(Q(dm), 'hindari'));
const rf = { ...dm, hasRedFlags: true, aiAskedRedFlags: true };
ok('red flags → alternative areas',        has(Q(rf), 'area lain'));
const alt = { ...rf, hasAlternativeArea: true, aiAskedAltArea: true };
ok('alt areas → condition (baru/second/inden)', has(Q(alt), 'baru') && has(Q(alt), 'inden'));
ok('all captured → null (HANDOFF)',        Q({ ...alt, hasPropertyCondition: true, aiAskedPropertyCondition: true }) === '');

console.log('\n── Group 3: SEWA path ──');
const sewa = {
  buildingType: 'house', transactionType: 'rent', location: 'Surabaya Barat', aiCount: 5,
  aiAskedTxType: true, aiAskedLocation: true, hasMotivation: true, aiAskedMotivation: true,
  hasSearchHistory: true, aiAskedSearchHist: true, budget: '8-10jt', aiAskedBudget: true,
  hasHouseholdInfo: true, aiAskedHousehold: true,
};
ok('sewa: occupants → move-in date',        has(Q(sewa), 'masuk bulan apa'));
const sewaDate = { ...sewa, hasMoveInDate: true, aiAskedMoveIn: true, hasDecisionMaker: true, aiAskedDecisionMaker: true, hasRedFlags: true, aiAskedRedFlags: true, hasAlternativeArea: true, aiAskedAltArea: true };
ok('sewa: → lease duration',                has(Q(sewaDate), 'berapa lama'));
ok('sewa: duration → furnishing',           has(Q({ ...sewaDate, hasLeaseDuration: true, aiAskedLeaseDuration: true }), 'furnished'));
const sewaFurn = { ...sewaDate, hasLeaseDuration: true, aiAskedLeaseDuration: true, hasFurnishing: true, aiAskedFurnish: true };
ok('sewa: furnishing → FACILITIES (wajib)',  has(Q(sewaFurn), 'fasilitas'));
ok('sewa: facilities asked → null (ready)',  Q({ ...sewaFurn, aiAskedFacilities: true }) === '');

console.log('\n── Group 4: scoring & priority ──');
const hot = CQ.buildHousePilotBrief({
  ...alt, transactionType: 'sale', hasPropertyCondition: true,
  hasFinancing: true, financingIsKPR: true, hasKprDetails: true,
}, { location: 'Citraland', budget: { text: '1.8-2.2M' } }, [], '');
ok('KPR pre-approved + full → HOT (9)',     hot.priority === 'HOT' && hot.score === 9);

const incomplete = CQ.buildHousePilotBrief({
  buildingType: 'house', transactionType: 'sale', location: 'Sby Barat',
  hasMotivation: true, hasHouseholdInfo: true, budget: '1.5M',
  hasFinancing: true, financingIsKPR: true, // KPR but no DP/approval
}, { location: 'Sby Barat', budget: { text: '1.5M' } }, [], '');
ok('KPR with unknown DP/approval → NOT HOT', incomplete.priority !== 'HOT');
ok('KPR not-started → agent note flagged',   /qualify financing|not-started/i.test(incomplete.agentNote || ''));

const capped = CQ.buildHousePilotBrief({
  ...alt, transactionType: 'sale', hasPropertyCondition: true,
  hasFinancing: true, financingCash: true, financingFromSale: true, // cash from unsold asset
}, { location: 'Citraland', budget: { text: '2.5M' } }, [], '');
ok('cash from unsold asset → capped at WARM', capped.priority === 'WARM');
ok('cash contingency → agent flagged',        /unsold asset|cash-ready/i.test(capped.agentNote || ''));

console.log('\n── Group 5: visible house SUMMARY (✓ answered / ✗ belum ditanyakan) ──');
{
  // The exact reported conversation: sewa rumah, budget+furnished+location volunteered,
  // motivation + move-in + household given; facilities & anchor NEVER asked.
  const C = (m) => ({ role: 'customer', message: m });
  const A = (m) => ({ role: 'assistant', message: m });
  const hist = [
    C('Mau cari sewa rumah'), A('Halo Kak, saya asisten dari LEO FELIX (Elevan Property). Rumahnya di kota mana?'),
    C('Saya mau badget 9-10 juta/tahun.. Yang Sudah full furnished aja. Deket Surabaya'), A('Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang?'),
    C('Saya mau pindah kontrakan rumah, saya pindah 19 Agustus ini'), A('Nanti akan ditinggali bersama siapa saja, Kak?'),
  ];
  const last = 'Saya mau pindahan sama keluarga, tanggal 19 Agustus ini. Karena kontrakan lama sudah habis';
  const filters = extractPropertyFilters(last, hist);
  const profile = CQ.buildProfile(hist, last, filters);
  const brief = CQ.buildAgentBrief(profile, filters, hist, last);
  const out = new RB('id', 'LEO FELIX', 'Elevan Property').houseSummary(brief);

  ok('summary header present',          /Baik, semua sudah saya catat!/.test(out));
  ok('✓ Rencana: Sewa',                 /✓ Rencana: \*Sewa\*/.test(out));
  ok('✓ Tipe humanized: Rumah',         /✓ Tipe: \*Rumah\*/.test(out));
  ok('✓ Lokasi: Surabaya',              /✓ Lokasi: \*Surabaya\*/.test(out));
  ok('✓ Masuk: 19 Agustus 2026',        /✓ Masuk: \*19 Agustus 2026\*/.test(out));
  ok('✓ Furnitur: Full furnished',      /✓ Furnitur: \*Full furnished\*/.test(out));
  ok('✓ Budget normalized',             /✓ Budget: \*Rp 9\.000\.000 - Rp 10\.000\.000\*/.test(out));
  ok('✗ Fasilitas belum ditanyakan',    /✗ Fasilitas: \*\(Belum ditanyakan\)\*/.test(out));
  ok('✗ Patokan belum ditanyakan',      /✗ Patokan lokasi: \*\(Belum ditanyakan\)\*/.test(out));
  ok('no garbage anchor (city leak)',   !/deket surabaya saya mau/i.test(out));
  ok('dynamic signature present',       /Salam hangat,\n\*LEO FELIX\*\n\*Elevan Property\*/.test(out));
  ok('it is a summary, NOT silent handoff', !/teruskan ke \*LEO FELIX\* sekarang/.test(out));
}

console.log('\n═══════════════════════════════════');
console.log(`RESULT: ${pass}/${pass + fail} passed ${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}`);
console.log('═══════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);

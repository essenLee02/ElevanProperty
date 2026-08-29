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
// ⚠️ M169: dulu mengunci kata-kata persis versi lama ("kisaran" + "mendekati
// rencana"). Pertanyaan budget sudah berpindah ke bentuk KATEGORI
// (terjangkau / menengah / eksklusif) bersama fitur budget-tier — perilaku baru
// yang disengaja, tapi tes ini tetap menuntut kalimat lama sehingga gagal atas
// perubahan yang benar. Yang dijaga sekarang adalah MAKSUDNYA: pada langkah ini
// budget memang ditanyakan, dan ditanyakan tanpa menodong angka.
{
  const q = Q(sh);
  const asksBudget = /terjangkau|menengah|eksklusif|kisaran|budget/i.test(q);
  const offersChoice = /\*terjangkau\*|\*menengah\*|\*eksklusif\*|mendekati rencana/i.test(q);
  ok('search history → pertanyaan BUDGET berbentuk pilihan', asksBudget && offersChoice);
}
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
  // Label Q2 = "Kota" (bukan "Lokasi") — "lokasi" ambigu bagi customer.
  ok('✓ Kota: Surabaya',                /✓ Kota: \*Surabaya\*/.test(out));
  // ⚠️ M169: tahun TIDAK boleh dikunci. "19 Agustus ini" yang diucapkan pada
  // 20 Agustus dan seterusnya memang seharusnya digulung ke tahun berikutnya —
  // perilaku parser yang BENAR, tapi versi lama tes ini menuliskan "2026" apa
  // adanya dan mulai gagal sendiri begitu tanggal itu lewat (bom waktu).
  // Yang dijaga: tanggal & bulannya persis seperti yang customer sebut.
  ok('✓ Masuk: 19 Agustus (tahun mengikuti kalender berjalan)',
    /✓ Masuk: \*0?19 Agustus \d{4}\*/.test(out) || /✓ Masuk: \*19 Agustus \d{4}\*/.test(out),
    (out.match(/✓ Masuk: \*[^*]*\*/) || ['(tidak ada baris Masuk)'])[0]);
  ok('✓ Furnitur: Full furnished',      /✓ Furnitur: \*Full furnished\*/.test(out));
  ok('✓ Budget normalized + period',    /✓ Budget: \*Rp 9\.000\.000 - Rp 10\.000\.000\/tahun\*/.test(out));
  ok('✗ Fasilitas belum ditanyakan',    /✗ Fasilitas: \*\(Belum ditanyakan\)\*/.test(out));
  ok('✗ Patokan belum ditanyakan',      /✗ Patokan lokasi: \*\(Belum ditanyakan\)\*/.test(out));
  ok('no garbage anchor (city leak)',   !/deket surabaya saya mau/i.test(out));
  ok('dynamic signature present',       /Salam hangat,\n\*LEO FELIX\*\n\*Elevan Property\*/.test(out));
  ok('it is a summary, NOT silent handoff', !/teruskan ke \*LEO FELIX\* sekarang/.test(out));
}

console.log('\n── Group 6: group-size household ("N orang") detection ──');
{
  const { extractQualificationState } = require('../services/aiPromptBuilderService');
  for (const m of ['Saya bersama 15 orang', 'dengan 15 orang', 'cari yang cukup untuk 15 orang', 'rombongan 15 orang']) {
    const filters = extractPropertyFilters(m, []);
    const profile = CQ.buildProfile([], m, filters);
    ok(`profile.hasHouseholdInfo true: ${JSON.stringify(m)}`, profile.hasHouseholdInfo === true);
    const st = extractQualificationState([], m);
    ok(`state.household captures group: ${JSON.stringify(m)}`, /15 orang/.test(st.household || ''));
  }
  // Small household still works
  const sf = extractPropertyFilters('sendiri saja', []);
  ok('sendiri → household', CQ.buildProfile([], 'sendiri saja', sf).hasHouseholdInfo === true);
}

console.log('\n── Group 7: motivation already volunteered → do NOT re-ask QM ──');
{
  const C = (m) => ({ role: 'customer', message: m });
  const A = (m) => ({ role: 'ai', message: m });
  const hist = [
    C('Mau cari rumah'),
    A('Halo Kak, saya asisten dari LEO FELIX (Elevan Property). Untuk rumahnya, rencananya mau beli atau sewa, Kak? 🏠'),
  ];
  // "kerja dinas sebentar … sewa selama 2 minggu" — motivation + duration sudah disebut
  const last = 'Saya rencana sewa rumah di surabaya, mau kerja dinas sebentar di Surabaya. Saya butuh sewa selama 2 minggu';
  const f = extractPropertyFilters(last, hist);
  const p = CQ.buildProfile(hist, last, f);
  ok('hasMotivation true (kerja dinas)', p.hasMotivation === true);
  ok('hasLeaseDuration true (2 minggu)', p.hasLeaseDuration === true);
  const nq = CQ.getNextQuestionHousePilot(p, 'id', null, 'LEO FELIX', 'Elevan Property') || '';
  ok('NEXT does NOT re-ask motivation', !/apa yang membuat|mulai cari rumah sekarang/i.test(nq));

  // Other motivation phrasings recognized
  for (const m of ['mau pindah kerja ke jakarta', 'buat liburan keluarga', 'rumah buat investasi', 'lagi ditugaskan dinas']) {
    const pf = CQ.buildProfile([], m, extractPropertyFilters(m, []));
    ok(`hasMotivation true: ${JSON.stringify(m)}`, pf.hasMotivation === true);
  }
  // Duration phrasings (weeks/days/months) recognized
  for (const m of ['sewa 2 minggu', 'butuh 10 hari', 'selama 3 bulan', '1 tahun']) {
    const pf = CQ.buildProfile([], m, extractPropertyFilters(m, []));
    ok(`hasLeaseDuration true: ${JSON.stringify(m)}`, pf.hasLeaseDuration === true);
  }
}

console.log('\n── Group 8: summary brief field accuracy (full dinas transcript) ──');
{
  const C = (m) => ({ role: 'customer', message: m });
  const A = (m) => ({ role: 'ai', message: m });
  const hist = [
    C('Mau cari rumah'), A('beli atau sewa?'),
    C('Saya rencana sewa rumah di surabaya, mau kerja dinas sebentar. Saya butuh sewa selama 2 minggu'), A('apa yang membuat cari sekarang?'),
    C('Saya ada kerja dinas sebentar selama 2 Minggu'), A('sudah lihat beberapa rumah?'),
    C('Belum pernah lihat, cuma cari badget 2-4 juta/2 minggu'), A('ditinggali bersama siapa?'),
    C('Saya sendirian saja'), A('masuk bulan apa?'),
    C('Rencana 3 September ini'), A('perlu koordinasi?'),
    C('Enggak perlu koordinasi, saya minta listing saja'), A('ada yang dihindari?'),
    C('Saya mau jalan lebar, access strategis. Dekat dengan banyak cafe, resto dan warung.'), A('area lain?'),
    C('Saya maunya di surabaya saja'), A('furnitur prefer apa?'),
    C('semi'), A('ada fasilitas tertentu?'),
  ];
  const last = 'Iya.. Mau AC, kitchen set, lemari, kasur dan kulkas';
  const f = extractPropertyFilters(last, hist);
  const p = CQ.buildProfile(hist, last, f);
  const brief = CQ.buildAgentBrief(p, f, hist, last);
  // ⚠️ M169: dulu mengunci string persis '3 September 2026'. Dua hal salah di
  // situ: (a) TAHUN-nya hardcode, jadi berkas ini jadi bom waktu — begitu
  // 3 September lewat, parser (benar) menggulung ke tahun berikutnya dan tes
  // gagal tanpa ada yang rusak; (b) formatnya ber-nol-di-depan ("03") di jalur
  // ini, sementara jalur jadwal survei mencetak tanpa nol — ketidakseragaman
  // yang nyata tapi terpisah dari yang diuji di sini.
  // Yang benar-benar dijaga: TANGGAL & BULAN yang customer sebut, bukan
  // durasi sewa "2 minggu" yang dulu menimpanya (jadi 12 September).
  ok('Masuk = 3 September (dari kalimat customer, BUKAN durasi 2 minggu)',
    /^0?3 September \d{4}$/.test(brief.moveInDate.value), brief.moveInDate.value);
  ok('Masuk TIDAK diambil dari durasi sewa (bukan hari-ini + 14)',
    !/12 September/.test(brief.moveInDate.value), brief.moveInDate.value);
  ok('Furnitur = Semi furnished (bare "semi")', brief.furnishing.value === 'Semi furnished');
  ok('Budget appends period /2 minggu', /\/2\s*minggu$/.test(brief.budget.value));
  ok('Facilities keep all items', ['AC','Lemari','Kasur','Kulkas'].every(x => brief.facilities.value.includes(x)));
  ok('Facilities keep kitchen set', /Kitchen set/i.test(brief.facilities.value));
  // detectFacilities directly
  const fac = extractPropertyFilters('Mau AC, kitchen set, lemari, kasur dan kulkas', []).facilities;
  ok('detectFacilities captures lemari/kasur/kulkas', ['Lemari','Kasur','Kulkas'].every(x => fac.includes(x)));
}

console.log('\n═══════════════════════════════════');
console.log(`RESULT: ${pass}/${pass + fail} passed ${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}`);
console.log('═══════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);

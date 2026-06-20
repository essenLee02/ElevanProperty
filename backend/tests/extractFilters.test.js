/**
 * extractFilters.test.js — guards for the qualification-gate filter accumulation.
 * Regression: a long (≥9-message) qualification conversation must NOT lose the
 * opening message's type/tx/location/budget — otherwise the pre-qualification gate
 * loops back to the opening greeting at the end of the flow.
 * Run: node tests/extractFilters.test.js
 */

const { extractPropertyFilters } = require('../services/propertyRecommendationService');

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
}
const C = (m) => ({ role: 'customer', message: m });

console.log('── Group 1: long apartment flow keeps opener fields (the reported bug) ──');
{
  const hist = [
    C('Saya cari sewa apartemen yang ada kids zone dan tempat gym.. budgetnya di 2-3 juta sj.. Cari sewa di surabaya'),
    C('Iya'),
    C('Saya bersama 2 anak saya saja. Tolong kasih info selengkapnya ya'),
    C('Saya terserah hadapnya, pokok tempat nyaman'),
    C('Dekat PTC saja'),
    C('Boleh.. Tapi tetep usahakan dpt yg dkt PTC'),
    C('Boleh.. Tapi tetep usahakan dapat yang dekat PTC'),
    C('Tanggal 15 Juli ini'),
    C('Saya survei sendiri saja, atau bisa kirim foto bentuk apartemennya'),
  ];
  const f = extractPropertyFilters('Saya minta semi furnish', hist);
  ok('type retained = apartment', f.buildingType === 'apartment');
  ok('tx retained = rent',        f.transactionType === 'rent');
  ok('location retained = Surabaya', /surabaya/i.test(f.location || ''));
  ok('budget retained (2–3 juta)', !!f.budget && /2\.000\.000.*3\.000\.000/.test(f.budget.text || ''));
}

console.log('\n── Group 2: cross-type switch still resets stale fields ──');
{
  // Old abandoned search (hotel Malang) then a new apartment Surabaya search.
  const hist = [
    C('mau sewa hotel di Malang budget 500rb-1jt'),
    C('untuk 2 malam'),
    C('mau sewa apartemen di Surabaya'),   // type switch hotel → apartment
    C('budget 2-3 juta'),
  ];
  const f = extractPropertyFilters('dekat PTC', hist);
  ok('type = apartment (new search)', f.buildingType === 'apartment');
  ok('tx = rent', f.transactionType === 'rent');
  ok('location = Surabaya (not Malang)', /surabaya/i.test(f.location || '') && !/malang/i.test(f.location || ''));
}

console.log('\n── Group 3: current message still wins ──');
{
  const hist = [C('mau beli rumah di Bandung')];
  const f = extractPropertyFilters('eh di Surabaya saja', hist);
  ok('location overridden to Surabaya', /surabaya/i.test(f.location || ''));
  ok('type stays house', f.buildingType === 'house');
  ok('tx stays sale', f.transactionType === 'sale');
}

console.log('\n── Group 4: budget detection (decimal ranges, Rp-prefix, period) ──');
{
  const { detectBudget } = require('../services/propertyRecommendationService');
  const b = (m) => { const r = detectBudget(m); return r ? (r.ambiguous ? 'AMBIGUOUS' : r.text) : null; };
  ok('decimal range "1.4-3.5 juta/malam"',        b('Saya mau 1.4-3.5 juta/malam') === 'Rp 1.400.000 - Rp 3.500.000');
  ok('no-space "1.4-3.5juta/malam"',              b('Saya mau harga 1.4-3.5juta/malam') === 'Rp 1.400.000 - Rp 3.500.000');
  ok('Rp-prefix range "Rp1.4 - Rp 3.5 juta"',     b('Saya mau Rp1.4 - Rp 3.5 juta/malam') === 'Rp 1.400.000 - Rp 3.500.000');
  ok('Rp on both + juta on both',                 b('Rp 1.4 juta - Rp 3.5 juta') === 'Rp 1.400.000 - Rp 3.500.000');
  ok('idr-prefix range',                          b('idr 2-3 juta') === 'Rp 2.000.000 - Rp 3.000.000');
  ok('period night captured',                     detectBudget('1.4-3.5 juta/malam').period === 'night');
  ok('malformed "1.4-3-5" stays ambiguous',       b('1.4-3-5 juta/malam') === 'AMBIGUOUS');
  ok('plain "2-3 juta"',                          b('2-3 juta') === 'Rp 2.000.000 - Rp 3.000.000');
  // single-value paths still work after rp-strip
  ok('single "harga 5 juta"',                     b('budget harga 5 juta') === 'Rp 5.000.000');
  ok('affordable preference',                     detectBudget('yang terjangkau saja').preference === 'affordable');
}

console.log('\n── Group 5: facilities+anchor answer must NOT reset type (rumah makan / lainnya) ──');
{
  const { extractQualificationState, findNextQuestion } = require('../services/aiPromptBuilderService');
  const { isPropertyContextContinuation } = require('../utils/propertyKeywordFilter');
  const C = (m) => ({ role: 'customer', message: m });
  const A = (m) => ({ role: 'ai', message: m });
  const msg = 'Saya mau AC, kolam renang, kids zone, play ground, gym.. Saya mau yang deket resturan atau rumah makan lainnya';

  // "rumah makan" / "lainnya" must not be mis-detected as a building type
  ok('"rumah makan lainnya" not house/others (inherits villa)',
     extractPropertyFilters(msg, [C('sewa villa di malang')]).buildingType === 'villa');
  ok('"deket rumah makan" alone → no type', extractPropertyFilters('yang deket rumah makan', []).buildingType === '');
  ok('"properti lainnya" still → others', extractPropertyFilters('mau sewa properti lainnya', []).buildingType === 'others');

  // gate must NOT drop the facilities+anchor answer deep in the flow
  const deep = [
    A('Rencananya masuk bulan apa? 📅'), C('checkin 12 Juli'),
    A('Untuk furnitur prefer furnished, semi, atau kosongan? 🛋️'), C('furnished saja'),
    A('Ada fasilitas tertentu yang Anda inginkan? 🏊'),
  ];
  ok('gate passes facilities+anchor answer', isPropertyContextContinuation(msg, deep) === true);

  // full state: type intact, facilities + anchor captured, not back to Q1
  const hist = [
    C('sewa villa di malang 15 orang'), A('sudah lihat berapa properti?'),
    C('Belum pernah, kapasitas 15 orang'), A('Di Malang ada Villa kisaran 1-3 juta/malam dan 5-15 juta/malam. Mana yang sesuai? 💰'),
    C('Saya mau harga 1.4-3.5juta/malam'), A('Rencananya masuk bulan apa? 📅'),
    C('checkin 12 Juli'), A('Untuk furnitur prefer furnished, semi, atau kosongan? 🛋️'),
    C('furnished saja'), A('Ada fasilitas tertentu yang Anda inginkan? 🏊'),
  ];
  const st = extractQualificationState(hist, msg);
  ok('state type stays villa (no reset)', st.buildingType === 'villa');
  ok('state facilities captured',         Array.isArray(st.facilities) && st.facilities.includes('Gym') && st.facilities.includes('Kids zone'));
  ok('state anchor captured (deket restoran)', /resturan|restoran|rumah makan/i.test(st.anchorPoint || ''));
  ok('NEXT is not Q1 (flow continues)',   (function(){ const n = findNextQuestion(st); const q = n && (n.q || n); return q !== 'Q1' && q !== 'Q0'; })());
}

console.log('\n── Group 6: short preference answers to a property question (Q5/Q6) ──');
{
  const { isPropertyContextContinuation } = require('../utils/propertyKeywordFilter');
  const A = (m) => ({ role: 'ai', message: m });
  const rf = [A('Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua? 🚫')];
  ok('"Saya mau jalan raya lebar" passes',     isPropertyContextContinuation('Saya mau jalan raya lebar', rf) === true);
  ok('"yang tenang dan tidak bising" passes',  isPropertyContextContinuation('yang tenang dan tidak bising', rf) === true);
  ok('"jalan raya lebar" (bare) passes',       isPropertyContextContinuation('jalan raya lebar', rf) === true);
  ok('"hadap timur aja" passes',               isPropertyContextContinuation('hadap timur aja', rf) === true);
  // guards — off-topic short replies after a property question still rejected
  ok('"mau makan bakso dulu ah" rejected',     isPropertyContextContinuation('mau makan bakso dulu ah', rf) === false);
  ok('"mau pesan tiket pesawat" rejected',     isPropertyContextContinuation('mau pesan tiket pesawat', rf) === false);
  ok('"mau beli hp baru" rejected',            isPropertyContextContinuation('mau beli hp baru', rf) === false);
  ok('no recent property question → rejected', isPropertyContextContinuation('Saya mau jalan raya lebar', [A('halo'), { role: 'customer', message: 'hai' }]) === false);
}

console.log('\n── Group 7: deep-flow answers when property TYPE has scrolled out of window ──');
{
  const { isPropertyContextContinuation } = require('../utils/propertyKeywordFilter');
  const A = (m) => ({ role: 'ai', message: m });
  const C = (m) => ({ role: 'customer', message: m });
  // Last 6 msgs have NO property-type word; only a furnishing QUESTION provides context.
  const deep = [
    A('Saya mau pindah bulan apa? 📅'), C('24 agustus'),
    A('Nanti akan tinggal bersama siapa saja? 🛏️'), C('4 orang'),
    A('Untuk furnitur, lebih prefer yang sudah furnished, semi-furnished, atau kosongan saja? 🛋️'),
  ];
  ok('"Saya mau full furnished" passes (recent Q = context)', isPropertyContextContinuation('Saya mau full furnished', deep) === true);
  ok('"furnished" passes',                                    isPropertyContextContinuation('furnished', deep) === true);
  ok('"kosongan saja" passes',                                isPropertyContextContinuation('kosongan saja', deep) === true);
  // budget question as context
  const budQ = [A('Tinggal bersama siapa? 🛏️'), C('4 orang'), A('Di Malang ada Apartemen kisaran 2-5 juta/bln dan 8-20 juta/bln. Mana yang sesuai? 💰')];
  ok('"1.2-2 juta/malam" passes (budget Q context)', isPropertyContextContinuation('Harga 1.2-2juta/malam', budQ) === true);
  // guards: off-topic still rejected even with a recent property question
  ok('"mau makan bakso dulu" rejected', isPropertyContextContinuation('mau makan bakso dulu', deep) === false);
  ok('no context + no recent Q → rejected', isPropertyContextContinuation('Saya mau full furnished', [A('halo'), C('hai')]) === false);
}

console.log('\n── Group 8: financing follow-ups & recommendation requests (Q_KPR/Q_KPR-a) ──');
{
  const { isPropertyContextContinuation } = require('../utils/propertyKeywordFilter');
  const A = (m) => ({ role: 'ai', message: m });
  const C = (m) => ({ role: 'customer', message: m });
  const kprQ = [
    A('Tinggal bersama siapa? 🛏️'), C('keluarga'),
    A('Untuk pembeliannya, rencana pakai KPR atau cash, Kak?'), C('Cash KPR better mana?'),
    A('Untuk KPR-nya, sudah sempat cek atau ajukan ke bank, atau masih rencana, Kak? DP-nya kira-kira berapa persen?'),
  ];
  ok('"kasi rekom DP" passes',        isPropertyContextContinuation('kasi rekom DP', kprQ) === true);
  ok('"Cash KPR better mana?" passes',isPropertyContextContinuation('Cash KPR better mana?', kprQ) === true);
  ok('"summarize pls" passes',        isPropertyContextContinuation('summarize pls', kprQ) === true);
  ok('"DP 20 persen" passes',         isPropertyContextContinuation('DP 20 persen', kprQ) === true);
  ok('"cash aja" passes',             isPropertyContextContinuation('cash aja', kprQ) === true);
  // guards
  ok('"kasi makan dulu ya" rejected', isPropertyContextContinuation('kasi makan dulu ya', kprQ) === false);
  ok('no context → "kasi rekom DP" rejected', isPropertyContextContinuation('kasi rekom DP', [A('halo'), C('hai')]) === false);
}

console.log('\n── Group 9: house used as office (commercial use ≠ type change) ──');
{
  const svc = require('../services/propertyRecommendationService');
  const { extractQualificationState } = require('../services/aiPromptBuilderService');
  const C = (m) => ({ role: 'customer', message: m });
  const A = (m) => ({ role: 'ai', message: m });
  // Use-phrases must NOT be detected as a type
  ok('"digunakan sebagai kantor" → no type', svc.detectBuildingType('Utk digunakan sebagai kantor') === '');
  ok('"yang buat usaha" → no type',          svc.detectBuildingType('mau yang buat usaha') === '');
  ok('"rumah ini buat usaha" → house (rumah wins, use stripped)', svc.detectBuildingType('rumah ini buat usaha') === 'house');
  ok('detectCommercialUse → kantor',         svc.detectCommercialUse('Utk digunakan sebagai kantor') === 'kantor');
  ok('detectCommercialUse → usaha',          svc.detectCommercialUse('mau dipakai untuk usaha UMKM') === 'usaha');
  // Genuine office request still works
  ok('"mau sewa kantor di sudirman" → office', svc.detectBuildingType('mau sewa kantor di sudirman') === 'office');
  ok('"cari ruko untuk kantor" → shophouse (ruko wins)', svc.extractPropertyFilters('cari ruko untuk kantor', []).buildingType === 'shophouse');

  // Full flow: house-for-office must NOT reset the house search
  const hist = [
    C('Rumah utk dibeli'), A('apa yang membuat cari sekarang?'),
    C('Investasi'), A('sudah lihat beberapa rumah?'),
    C('Belum'), A('Nanti akan ditinggali bersama siapa saja, Kak? 🛏️'),
  ];
  const last = 'Utk digunakan sebagai kantor';
  const f = svc.extractPropertyFilters(last, hist);
  ok('filters stay house (no reset)', f.buildingType === 'house');
  const st = extractQualificationState(hist, last);
  ok('state stays house, not office',  st.buildingType === 'house');
  ok('state typeChanged = false',      st.typeChangedFromHistory === false);
}

console.log('\n── Group 10: use-case decides whether "tinggal bersama siapa" is asked ──');
{
  const svc = require('../services/propertyRecommendationService');
  const { extractQualificationState, findNextQuestion } = require('../services/aiPromptBuilderService');
  const C = (m) => ({ role: 'customer', message: m });
  const A = (m) => ({ role: 'ai', message: m });

  // detectUseCase categories
  ok('"untuk investasi" → investasi',        svc.detectUseCase('beli rumah untuk investasi') === 'investasi');
  ok('"didiamkan sbg aset" → investasi',     svc.detectUseCase('mau didiamkan saja sebagai aset') === 'investasi');
  ok('"buka warung" → investasi',            svc.detectUseCase('rumahnya mau buka warung makan') === 'investasi');
  ok('"untuk tempat ibadah" → ibadah',       svc.detectUseCase('disewa untuk tempat ibadah') === 'ibadah');
  ok('"buat mushola" → ibadah',              svc.detectUseCase('mau buat mushola') === 'ibadah');
  ok('"untuk liburan" → liburan',            svc.detectUseCase('villa untuk liburan keluarga') === 'liburan');
  ok('"dinas sementara" → liburan',          svc.detectUseCase('buat dinas kerja sementara') === 'liburan');
  ok('"dipakai kantor" → kantor',            svc.detectUseCase('dipakai sebagai kantor') === 'kantor');
  ok('residential "sama keluarga" → ""',     svc.detectUseCase('mau ditinggali sama keluarga') === '');

  ok('isNonResidentialUse(investasi)=true',  svc.isNonResidentialUse('untuk investasi') === true);
  ok('isNonResidentialUse(ibadah)=true',     svc.isNonResidentialUse('untuk tempat ibadah') === true);
  ok('isNonResidentialUse(liburan)=false',   svc.isNonResidentialUse('untuk liburan') === false); // liburan masih ada tamu (Q14)
  ok('isNonResidentialUse(keluarga)=false',  svc.isNonResidentialUse('sama keluarga') === false);

  // build-kos must NOT flip the bought house's type, but DOES set investasi + rent-out
  ok('"rumah utk bangun kos" → house', svc.detectBuildingType('beli rumah untuk bangun kos') === 'house');
  ok('"dibangun kos-kosan" stripped → house',
    extractQualificationState([C('Beli rumah di malang'), A('kenapa?')], 'mau dibangun kos-kosan').buildingType === 'house');

  // Flow: beli rumah + motivasi investasi → JANGAN tanya "tinggal bersama siapa"
  const invHist = [
    C('Beli rumah di darmo 2M'), A('Boleh tahu apa yang membuat Kak cari rumah sekarang?'),
  ];
  const invSt = extractQualificationState(invHist, 'Untuk investasi');
  ok('investasi → useCase set',           invSt.useCase === 'investasi');
  ok('investasi (didiamkan) → not asking Q4 occupants', (function(){
    const n = findNextQuestion(invSt); return !(n && n.q === 'Q4' && /tinggal bersama|ditempati bersama/.test(n.hint || ''));
  })());

  // Flow: sewa ruko untuk ibadah → JANGAN tanya penghuni, tipe tetap ruko
  const ibHist = [ C('Sewa ruko di surabaya'), A('untuk apa rencananya?') ];
  const ibSt = extractQualificationState(ibHist, 'untuk tempat ibadah');
  ok('ibadah → tipe tetap shophouse',     ibSt.buildingType === 'shophouse');
  ok('ibadah → useCase non-hunian',       /ibadah/.test(ibSt.useCase || ''));

  // Flow: sewa villa untuk LIBURAN → TETAP tanya kapasitas, framing "menginap berapa orang"
  const libHist = [
    C('Sewa villa di batu buat liburan'), A('Sudah lihat berapa villa?'), C('Belum pernah'),
    A('Di Batu kisaran 2jt dan 8jt/malam, mana mendekati?'), C('sekitar 3jt/malam'),
    A('Ada yang pasti tidak cocok? 🚫'), C('nggak ada'),
    A('Rencananya check-in bulan apa? 📅'), C('Juli 2026'),
  ];
  const libSt = extractQualificationState(libHist, 'Juli 2026');
  const libNext = findNextQuestion(libSt);
  ok('liburan → tetap tanya penghuni (Q4)',      libNext && libNext.q === 'Q4');
  ok('liburan → framing kapasitas "menginap"',   libNext && /menginap berapa orang/.test(libNext.hint || ''));
}

console.log('\n═══════════════════════════════════');
console.log(`RESULT: ${pass}/${pass + fail} passed ${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}`);
console.log('═══════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);

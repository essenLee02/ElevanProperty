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

console.log('\n═══════════════════════════════════');
console.log(`RESULT: ${pass}/${pass + fail} passed ${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}`);
console.log('═══════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);

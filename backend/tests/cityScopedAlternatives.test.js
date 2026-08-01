/**
 * cityScopedAlternatives.test.js — M64 regression: catalog alternatives must never
 * cross to a different city, and budget expansion must follow the ±15% → ±30% →
 * reasonable-cap ladder (not the old ±35% → ±70%).
 *
 * Reported bug: "Saya mau booking hotel di Surabaya" with no Surabaya hotel in
 * stock returned alternatives from KOTA JAMBI, Rokan Hilir, Medan, Banda Aceh —
 * cross-island results the customer never asked for. Root cause: getAlternatives()
 * dropped `location` from the filter whenever result.length < 4, even though the
 * customer HAD named a city. Fix: location-relaxation (dropping the city filter)
 * only fires when the customer did NOT name a city at all; if they did, the
 * catalog either narrows within that city or returns empty — never another city.
 *
 * Run: node tests/cityScopedAlternatives.test.js
 */

'use strict';

require('dotenv').config();
const { buildRecommendationContextForLLM, findWithExpandedBudget } = require('../services/propertyRecommendationService');

let pass = 0, fail = 0;
function ok(label, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
}

const citiesOf = (rows) => [...new Set((rows || []).map(p => String(p.city || p.location || '?').toUpperCase()))];

(async () => {
  console.log('── Group 1: catalog alternatives never cross to a different city ──');
  {
    // A city with (assumed) no matching stock at all in the fixture catalog.
    // Whatever comes back, every city label must match the requested one.
    const queries = [
      { msg: 'Saya mau sewa hotel di Madiun',  city: 'madiun'  },
      { msg: 'Saya mau sewa hotel di Jember',  city: 'jember'  },
      { msg: 'Saya cari gudang sewa di Surabaya', city: 'surabaya' },
    ];
    for (const { msg, city } of queries) {
      const ctx = await buildRecommendationContextForLLM(msg, [], { userId: 'LFGKT49002' });
      const all = citiesOf(ctx.exactMatches).concat(citiesOf(ctx.alternatives));
      const leaked = all.filter(c => c !== '?' && !c.toLowerCase().includes(city));
      ok(`"${msg}" — no cross-city leak`, leaked.length === 0, `leaked: ${JSON.stringify(leaked)}`);
    }
  }

  console.log('\n── Group 2: budget expansion ladder is ±15% → ±30% → reasonable cap ──');
  {
    const filters = {
      buildingType: 'hotel', transactionType: 'rent', location: 'Surabaya',
      budget: { min: 1000000, max: 1800000, period: 'week', text: '1-1.8jt/minggu' },
    };
    // Fixture priced just outside the base range but inside ±15%.
    // Field names must match filterProperties()'s expectations (camelCase),
    // which differ from the DB column names (building_type, transaction_type).
    const src = [{
      id: 'FX1', title: 'Fixture Hotel', city: 'SURABAYA', buildingType: 'hotel',
      transactionType: 'rent', priceValue: 2000000, priceType: 'Weekly',
    }];
    const r = findWithExpandedBudget(src, filters);
    ok('step 1 (±15%) finds a price just outside the base range', r.expansionStep === 1, `got step ${r.expansionStep}`);
    if (r.expandedBudget) {
      ok('±15% min = 850,000', r.expandedBudget.min === Math.round(1000000 * 0.85), `got ${r.expandedBudget.min}`);
      ok('±15% max = 2,070,000', r.expandedBudget.max === Math.round(1800000 * 1.15), `got ${r.expandedBudget.max}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('ERR:', e); process.exit(1); });

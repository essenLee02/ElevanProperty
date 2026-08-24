/**
 * agentCoverageAndGuardrailProfile.test.js — regresi M133.
 *
 * DUA fitur yang lahir dari satu directive pemilik proyek (24 Agu 2026):
 *
 * 1. agentCoverageService — backend MENYEDIAKAN FAKTA katalog agent (kota/area/
 *    harga nyata) sebagai konteks, supaya platform AI bisa menjawab "saya punya
 *    listing di kota mana saja?" / "area X kosong, adanya Y" tanpa MENGARANG
 *    (kelas bug M84/M96). Backend TIDAK memutuskan balasannya.
 *
 * 2. guardrailPolicy — dua profil: 'local' (primary=private → backend penuh,
 *    boleh menyusun redirect sendiri) vs 'platform' (primary=LLM → gerbang
 *    hanya penyaring awal murah; keputusan balas/diam diserahkan ke platform
 *    AI lewat sentinel M131).
 *
 * Run: node tests/agentCoverageAndGuardrailProfile.test.js
 */
'use strict';

require('dotenv').config();
const { buildAgentCoverageContext } = require('../services/agentCoverageService');
const {
  resolveGuardrailProfile, backendMayComposeOffTopicRedirect, screenForPlatform,
} = require('../utils/guardrailPolicy');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

/** Coverage sintetis — tidak menyentuh DB (disiplin suite 100% offline). */
function fakeCoverage() {
  const areas = new Map([
    ['Kebomas', { count: 2, min: 650_000_000, max: 8_450_000_000 }],
    ['GKB',     { count: 8, min: 753_000_000, max: 9_250_000_000 }],
  ]);
  const types = new Map([
    ['apartment|Sale', {
      buildingType: 'apartment', transactionType: 'Sale', count: 68,
      min: 386_500_000, max: 9_350_000_000, priceTypes: new Set(['Cash']), areas,
    }],
  ]);
  return {
    agentUserId: 'TEST_M133',
    cities: new Map([
      ['Gresik',   { total: 118, types }],
      ['Surabaya', { total: 210, types: new Map() }],
    ]),
  };
}

console.log('\n== Group 1: coverage context — kota yang ADA vs TIDAK ADA ==');
{
  const ctx = buildAgentCoverageContext(fakeCoverage(), { buildingType: 'apartment', transactionType: 'sale', location: 'Gresik' });
  ok('menyebut kota yang ada stoknya (Gresik & Surabaya)', /Gresik \(118\)/.test(ctx) && /Surabaya \(210\)/.test(ctx), ctx.slice(0, 120));
  ok('menyatakan eksplisit kota lain TIDAK ada listing', /TIDAK punya listing/i.test(ctx));
  ok('menyebut jumlah unit + rentang harga NYATA', /68 unit/.test(ctx) && /Rp 386\.500\.000/.test(ctx), ctx.slice(0, 300));
  ok('menyebut area yang ADA isinya (Kebomas, GKB)', /Kebomas/.test(ctx) && /GKB/.test(ctx));
  ok('menyatakan eksplisit area LAIN kosong (anti-mengarang area, M84/M96)',
    /Area SELAIN yang disebut di baris ini: kosong/i.test(ctx));
}

console.log('\n== Group 2: coverage context — kota yang diminta TIDAK dilayani ==');
{
  const ctx = buildAgentCoverageContext(fakeCoverage(), { buildingType: 'house', transactionType: 'sale', location: 'Malang' });
  ok('tetap menyebut daftar kota yang dilayani (bahan jawaban jujur AI)', /Gresik \(118\)/.test(ctx));
  ok('TIDAK mengarang data untuk Malang', !/Malang/.test(ctx), ctx);
}

console.log('\n== Group 3: coverage context — fail-open, nol token saat tak ada data ==');
{
  ok('coverage null → string kosong (nol token tambahan)', buildAgentCoverageContext(null, {}) === '');
  ok('coverage tanpa kota → string kosong', buildAgentCoverageContext({ cities: new Map() }, {}) === '');
}

console.log('\n== Group 4: guardrail profile — local vs platform ==');
{
  const orig = process.env.AI_PRIMARY_PROVIDER;

  process.env.AI_PRIMARY_PROVIDER = 'private';
  ok("env private → profil 'local'", resolveGuardrailProfile() === 'local');
  ok('profil local BOLEH menyusun redirect sendiri', backendMayComposeOffTopicRedirect() === true);

  process.env.AI_PRIMARY_PROVIDER = 'chatgpt';
  ok("env chatgpt → profil 'platform'", resolveGuardrailProfile() === 'platform');
  ok('profil platform TIDAK boleh menyusun redirect (keputusan milik platform AI)',
    backendMayComposeOffTopicRedirect() === false);

  process.env.AI_PRIMARY_PROVIDER = 'kimi';
  ok("env kimi → profil 'platform'", resolveGuardrailProfile() === 'platform');

  // Override per-agent MENGALAHKAN env (users.ai_primary), sejalan dengan
  // getPrimaryAIProvider() di aiProviderService.js.
  process.env.AI_PRIMARY_PROVIDER = 'chatgpt';
  ok("agent ai_primary='Private' mengalahkan env chatgpt → 'local'", resolveGuardrailProfile('Private') === 'local');
  ok("agent ai_primary='Default' ikut env → 'platform'", resolveGuardrailProfile('Default') === 'platform');
  ok("agent ai_primary='Chat GPT' (label UI, ada spasi) → 'platform'", resolveGuardrailProfile('Chat GPT') === 'platform');

  process.env.AI_PRIMARY_PROVIDER = orig;
}

console.log('\n== Group 5: penyaring awal platform — hemat token tanpa menahan jawaban sah ==');
{
  ok('pesan kosong TIDAK diteruskan (hemat token)', screenForPlatform('   ').forward === false);
  ok('hanya tanda baca TIDAK diteruskan', screenForPlatform('???').forward === false);
  ok('ack telanjang di LUAR alur TIDAK diteruskan', screenForPlatform('makasih').forward === false);

  // ⛔ KONTROL PALING PENTING: di DALAM alur kualifikasi, jawaban pendek WAJIB
  // diteruskan — menahannya adalah kelas bug M87/M88/M95 (jawaban customer
  // dibuang gerbang masuk), yang sudah berulang tiga kali di proyek ini.
  ok('"ya" DI DALAM alur aktif TETAP diteruskan', screenForPlatform('ya', { inActiveFlow: true }).forward === true);
  ok('"2 bulan" DI DALAM alur aktif diteruskan', screenForPlatform('2 bulan', { inActiveFlow: true }).forward === true);
  ok('"SHM" DI DALAM alur aktif diteruskan', screenForPlatform('SHM', { inActiveFlow: true }).forward === true);
  ok('"makasih" DI DALAM alur aktif diteruskan (biar AI yang menilai)',
    screenForPlatform('makasih', { inActiveFlow: true }).forward === true);

  ok('pesan properti biasa diteruskan', screenForPlatform('Saya cari apartemen di Gresik').forward === true);
  ok('pesan ambigu diteruskan (fail-open by design)', screenForPlatform('gimana ya kak').forward === true);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

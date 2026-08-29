'use strict';
/**
 * q2cAreasFromCatalog.test.js — M170
 * ------------------------------------
 * Bug Madiun (M164) SATU TINGKAT DI BAWAHNYA.
 *
 * M164 menutup kasus "kota tidak ada di katalog agent". Yang tersisa: kotanya
 * BENAR-BENAR ada, tapi contoh AREA di pertanyaan Q2c tetap diambil dari
 * utils/locationLandmarks.js — daftar statis 45 kota yang tidak tahu apa pun
 * tentang stok agent.
 *
 * Terukur untuk agent uji (29 Agu 2026, Surabaya):
 *   disarankan (statis) : Pakuwon, Darmo, Rungkut, Gubeng
 *   dimiliki  (katalog) : Dukuh Pakis, Waterplace, Mulyorejo, Pakuwon City,
 *                         Citraland, MERR
 * Hanya Citraland yang beririsan → AI mengundang customer ke area dengan NOL
 * listing, lalu meminta maaf. Persis keluhan pemilik proyek: "area tidak boleh
 * hardcode, AI cek database".
 *
 * ⚠️ Private Agent SUDAH benar sejak M164 (memakai agentAreaOptions). Yang
 * tertinggal justru jalur LLM — kelas bug M52/M54: fitur dipasang di satu jalur,
 * produksi berjalan di jalur yang lain. Berkas ini menguji KEDUANYA.
 */
require('dotenv').config();

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`); }
}

const { findNextQuestion } = require('../services/aiPromptBuilderService');
const { getCityLandmarks } = require('../utils/locationLandmarks');

async function main() {
  console.log('\n=== M170 · Contoh area Q2c berasal dari katalog agent ===\n');

  const BASE = {
    buildingType: 'house', transactionType: 'sale', city: 'Surabaya',
    searchHistory: 'y', budget: '1M',
  };

  /* ── 1. Dengan area nyata → dipakai, statis diabaikan ─────────────────── */
  console.log('1) agentAreas tersedia → contoh diambil dari katalog');
  const REAL = ['Dukuh Pakis', 'Waterplace', 'Mulyorejo'];
  const withReal = findNextQuestion({ ...BASE, agentAreas: REAL });
  ok('tetap bertanya Q2c', withReal && withReal.q === 'Q2c', JSON.stringify(withReal));
  ok('menyebut area NYATA milik agent',
    REAL.every((a) => withReal.hint.includes(a)), withReal.hint);

  // Nama statis yang agent TIDAK punya harus hilang sepenuhnya.
  const staticOnly = getCityLandmarks('Surabaya').filter((a) => !REAL.includes(a));
  const leaked = staticOnly.filter((a) => withReal.hint.includes(a));
  ok('⭐ TIDAK ada nama dari daftar statis yang bocor', leaked.length === 0,
    `bocor: ${leaked.join(', ')}`);

  ok('maksimal 3 contoh (spec pemilik proyek)',
    (withReal.hint.match(/,/g) || []).length <= 3, withReal.hint);

  /* ── 2. Tanpa area nyata → cadangan statis, JANGAN diam ───────────────── */
  console.log('\n2) agentAreas kosong → cadangan statis (fail-open, tetap bertanya)');
  const noReal = findNextQuestion({ ...BASE });
  ok('tetap bertanya Q2c (bukan slot dibiarkan kosong)', noReal && noReal.q === 'Q2c');
  ok('masih memberi contoh (mengundang jawaban, bukan pertanyaan telanjang)',
    /Misalnya/.test(noReal.hint), noReal.hint);

  const empty = findNextQuestion({ ...BASE, agentAreas: [] });
  ok('agentAreas array kosong diperlakukan sama dengan tidak ada',
    empty && empty.q === 'Q2c' && /Misalnya/.test(empty.hint));

  /* ── 3. Kota tak dikenal → contoh generik, tetap bertanya ─────────────── */
  console.log('\n3) Kota di luar daftar statis');
  const unknown = findNextQuestion({ ...BASE, city: 'Kotabaru Antah Berantah' });
  ok('tetap bertanya Q2c', unknown && unknown.q === 'Q2c');
  ok('memakai contoh generik', /pusat kota|kawasan tertentu/i.test(unknown.hint), unknown.hint);

  /* ── 4. Sumber kebenaran katalog benar-benar hidup ────────────────────── */
  console.log('\n4) getAgentAreaNames() memulangkan area NYATA dari DB');
  try {
    const { getAgentCoverage, getAgentAreaNames } = require('../services/agentCoverageService');
    const AGENT = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
    const cov = await getAgentCoverage(AGENT);
    const areas = getAgentAreaNames(cov, 'Surabaya', '', '', 3);
    if (!cov || !cov.cities || !cov.cities.size) {
      console.log('  ⏭️  dilewati (katalog/DB tidak tersedia)');
    } else {
      ok('memulangkan hingga 3 area', Array.isArray(areas) && areas.length > 0 && areas.length <= 3,
        JSON.stringify(areas));
      // Area nyata agent tidak boleh sekadar menyalin daftar statis.
      const statics = getCityLandmarks('Surabaya');
      ok('area katalog BERBEDA dari daftar statis (bukti bukan hardcode)',
        areas.some((a) => !statics.includes(a)),
        `katalog=${JSON.stringify(areas)} statis=${JSON.stringify(statics.slice(0, 4))}`);
    }
  } catch (err) {
    console.log(`  ⏭️  dilewati (${err.message})`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

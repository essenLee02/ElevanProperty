/**
 * agentScopedCatalogLoad.test.js — regresi M136.
 *
 * Laporan produksi pemilik proyek (24 Agu 2026, transkrip Kirimi nyata):
 * pesan "Mau cari rumah di Citraland Surabaya" untuk agent NATASHA memicu
 *   [PropertyRecommendationService] Loaded 9120 fallback properties from extended_v3 JSON
 * padahal katalog Natasha hanya ±1.042 listing. Katalog JSON itu TIDAK punya
 * kolom user_id sama sekali — tidak satu pun barisnya boleh direkomendasikan
 * agent mana pun. Memuatnya = kerja + memori sia-sia, DAN risiko bocor bila ada
 * jalur yang lupa mengoper userId.
 *
 * Tes ini MURNI fungsi-level (tanpa DB) supaya tetap 100% offline: yang dikunci
 * adalah KONTRAK getSourceProperties(userId) — dengan userId, katalog JSON
 * TIDAK PERNAH ikut.
 *
 * Run: node tests/agentScopedCatalogLoad.test.js
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const SRC = fs.readFileSync(path.join(__dirname, '..', 'services', 'propertyRecommendationService.js'), 'utf8');

console.log('\n== Group 1: kontrak getSourceProperties(userId) ==');
{
  ok('getSourceProperties menerima parameter userId',
    /async function getSourceProperties\(userId\s*=\s*null\)/.test(SRC));
  ok('jalur per-agent memakai getDbPropertiesForAgent (query di-scope SQL, bukan filter JS)',
    /if \(userId\)\s*\{[\s\S]{0,400}getDbPropertiesForAgent\(userId\)/.test(SRC));

  // Kontrol NEGATIF paling penting: cabang userId TIDAK BOLEH memanggil
  // mergePropertyCatalog / loadJsonProperties.
  const branch = SRC.slice(SRC.indexOf('async function getSourceProperties('), SRC.indexOf('async function getSourceProperties(') + 900);
  const agentBranch = branch.slice(branch.indexOf('if (userId)'), branch.indexOf('const dbProperties'));
  ok('cabang per-agent TIDAK memanggil mergePropertyCatalog()', !/mergePropertyCatalog/.test(agentBranch), agentBranch.slice(0, 200));
  ok('cabang per-agent TIDAK memanggil loadJsonProperties()', !/loadJsonProperties/.test(agentBranch));
}

console.log('\n== Group 2: semua call-site mengoper userId ==');
{
  const callSites = SRC.match(/await getSourceProperties\([^)]*\)/g) || [];
  ok(`ada ${callSites.length} pemanggilan getSourceProperties`, callSites.length >= 3, JSON.stringify(callSites));
  ok('TIDAK ADA pemanggilan tanpa argumen (akan diam-diam memuat katalog publik)',
    callSites.every((c) => !/getSourceProperties\(\s*\)/.test(c)), JSON.stringify(callSites));
  ok('semuanya meneruskan filters.userId',
    callSites.every((c) => /filters\.userId/.test(c)), JSON.stringify(callSites));
}

console.log('\n== Group 3: query per-agent WAJIB menyaring status aktif ==');
{
  ok('getDbPropertiesForAgent memakai where { user_id, status: 1 }',
    /_queryProperties\(\{\s*user_id:\s*userId,\s*status:\s*1\s*\}\)/.test(SRC));
  ok('ada cache TERPISAH per-agent (bukan menimpa cache global)',
    /_agentPropsCache/.test(SRC) && /_agentPropsCache\.get\(userId\)/.test(SRC));
  ok('tersedia clearAgentPropertiesCache() untuk invalidasi setelah seed/import',
    /function clearAgentPropertiesCache/.test(SRC) && /clearAgentPropertiesCache,/.test(SRC));
}

console.log('\n== Group 4: normalisasi baris TIDAK diduplikasi (kelas bug M27/M77) ==');
{
  // Dua jalur (global & per-agent) harus memakai SATU fungsi query+normalisasi.
  const occurrences = (SRC.match(/buildingType\s*:\s*\(d\.building_type/g) || []).length;
  ok('blok normalisasi properti hanya ada SATU kali di file ini', occurrences === 1, `ditemukan ${occurrences}x`);
  ok('_queryProperties dipakai oleh KEDUA jalur',
    (SRC.match(/_queryProperties\(/g) || []).length >= 3);
}

console.log('\n== Group 5: kosa-kata detectLocation() tidak tercemar nama landmark ==');
{
  // Regresi yang SEMPAT terjadi saat membangun M136: memasukkan nama dari tabel
  // `locations` ke getKnownLocations() membuat "CITRALAND SURABAYA" (18 huruf)
  // mengalahkan "Surabaya" (8) pada sort-terpanjang → kota salah, 0 hasil.
  const fnStart = SRC.indexOf('function getKnownLocations()');
  const fnRaw = SRC.slice(fnStart, SRC.indexOf('\n}', fnStart));
  // ⚠️ Buang KOMENTAR dulu. Versi pertama tes ini gagal palsu karena komentar
  // penjelasnya sendiri menyebut "_landmarkCache" saat menerangkan kenapa
  // cache itu TIDAK dipakai — tes harus menilai KODE, bukan prosa.
  const fn = fnRaw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('getKnownLocations TIDAK memakai _landmarkCache (di kode, bukan komentar)',
    !/_landmarkCache/.test(fn), fn.slice(0, 200));
  // ⭐ DIPERBARUI M144: assertion lama mensyaratkan cabang cold-start
  // `_dbCities.length === 0` TETAP ADA — cabang itu SATU-SATUNYA gunanya
  // adalah menyalakan kosakata lokasi dari katalog JSON. Karena JSON kini
  // dihapus total dari kode produksi (directive pemilik proyek), cabang itu
  // ikut hilang dan assertion lama menjadi usang. Yang HARUS tetap dijaga
  // sekarang: getKnownLocations() tidak menyentuh JSON sama sekali, dan
  // fallback statis tetap ada (baris berikutnya).
  ok('getKnownLocations TIDAK menyentuh katalog JSON sama sekali',
    !/loadJsonProperties|getFallbackProperties/.test(fn), fn.slice(0, 300));
  ok('daftar statis + kota DB tetap DIGABUNG (pelajaran M92, bukan menggantikan)',
    /\[\.\.\._dbCities,\s*\.\.\.FALLBACK_LOCATION_KEYWORDS\]/.test(SRC));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

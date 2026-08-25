'use strict';
/**
 * repair-location-types.js — PERBAIKAN location_type menyeluruh (M147b)
 * ---------------------------------------------------------------------------
 * ⚠️ KENAPA SKRIP INI ADA — JUJUR, SUPAYA TIDAK TERULANG:
 * Saat mengimpor 800 lokasi dari Excel, saya (agent) menjalankan skrip impor
 * secara TIDAK SENGAJA lewat `require()` tanpa flag --dry, memakai klasifikasi
 * versi awal yang belum diperbaiki. Perbaikan susulan yang saya jalankan
 * berikutnya justru merusak lebih jauh: jumlah baris bertipe 'landmark' anjlok
 * dari 443 → 15, dan 377 baris bertipe 'area' berakhir TANPA city_id — padahal
 * models/Location.js mensyaratkan area WAJIB punya city_id.
 *
 * Skrip ini MENGHITUNG ULANG location_type untuk SETIAP baris secara
 * deterministik dari namanya, jadi hasilnya tidak bergantung pada urutan
 * eksekusi sebelumnya dan aman dijalankan berulang (idempoten).
 *
 * DUA ATURAN YANG DITEGAKKAN:
 *   1. Tipe dihitung dari nama memakai classifier yang sama dengan
 *      import-excel-locations.js (satu sumber kebenaran — di-require, bukan
 *      disalin, supaya tidak melenceng lagi di kemudian hari).
 *   2. INVARIAN MODEL: 'area' WAJIB punya city_id. Baris generik lintas-kota
 *      (city_id NULL) TIDAK BOLEH bertipe area — dijatuhkan ke 'landmark'
 *      bila namanya berbau tempat publik/rekreasi, selain itu 'commercial'.
 *      Inilah yang mengembalikan INDOMARET/TUNJUNGAN PLAZA/PASAR ke tempatnya.
 *
 * Usage:
 *   node scripts/repair-location-types.js --dry
 *   node scripts/repair-location-types.js
 */
require('dotenv').config();
const { Op } = require('sequelize');
const { Location, User } = require('../models');
const { classify, LANDMARK_RE } = require('./import-excel-locations');

const DRY   = process.argv.includes('--dry');
const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Tipe final untuk satu baris, dengan invarian city_id ditegakkan.
 * @param {string} name
 * @param {string|null} cityId
 */
function resolveType(name, cityId) {
  let t = classify(name);
  if (t === 'area' && !cityId) {
    // Nama generik tanpa kota tidak boleh jadi 'area' (hook validate menolaknya,
    // dan secara makna "kawasan" selalu milik satu kota).
    t = LANDMARK_RE.some((re) => re.test(String(name || ''))) ? 'landmark' : 'commercial';
  }
  return t;
}

async function main() {
  console.log('='.repeat(74));
  console.log(`  REPAIR location_type  ${DRY ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(74));

  const owner = await User.findOne({ where: { username: 'nigel123' }, raw: true })
             || await User.findOne({ raw: true });
  const { City } = require('../models');

  /* SCOPE 1 - baris yang berasal dari Excel: tipe harus == classify(nama).
     Ini baris ber-city_id, jadi 'area' sah untuknya. */
  const recs = require('../asset/json_data/excel_locations_800.json');
  const cityMap = new Map();
  for (const cn of [...new Set(recs.map((r) => r['Kota/Kabupaten']))]) {
    const c = await City.findOne({ where: { name: String(cn).trim().toUpperCase() }, raw: true });
    if (c) cityMap.set(cn, c.city_id);
  }

  let fixedExcel = 0;
  const exSamples = [];
  for (const r of recs) {
    const name = String(r['Area / Landmark Populer'] || '').trim();
    const cid = cityMap.get(r['Kota/Kabupaten']);
    if (!name || !cid) continue;
    const inst = await Location.findOne({ where: { city_id: cid, name: { [Op.like]: name } } });
    if (!inst) continue;
    const want = classify(name);
    if (inst.location_type === want) continue;
    if (!DRY) await inst.update({ location_type: want, updated_date: TODAY, updated_by: owner.user_id });
    fixedExcel++;
    if (exSamples.length < 8) exSamples.push(`${inst.name}: ${inst.location_type} -> ${want}`);
  }

  /* SCOPE 2 - PELANGGARAN INVARIAN: 'area' tanpa city_id.
     models/Location.js: area SELALU milik satu kota. Baris generik lintas-kota
     (INDOMARET, TAMAN KOTA, TUNJUNGAN PLAZA) tidak boleh bertipe area.
     SENGAJA tidak menyentuh baris lain: tipe kurasi lama (KUIL BUDDHA,
     WISATA MANGROVE, dst.) lebih tepat daripada tebakan classifier saya. */
  const orphans = await Location.findAll({
    where: { status: { [Op.ne]: 3 }, location_type: 'area',
             [Op.or]: [{ city_id: null }, { city_id: '' }] },
  });
  let fixedOrphan = 0;
  const orSamples = [];
  for (const row of orphans) {
    const want = LANDMARK_RE.some((re) => re.test(String(row.name || ''))) ? 'landmark' : 'commercial';
    if (!DRY) await row.update({ location_type: want, updated_date: TODAY, updated_by: owner.user_id });
    fixedOrphan++;
    if (orSamples.length < 8) orSamples.push(`${row.name}: area -> ${want}`);
  }

  console.log(`\n  [1] baris Excel diselaraskan : ${fixedExcel}`);
  exSamples.forEach((x) => console.log('        ' + x));
  console.log(`  [2] 'area' tanpa city_id     : ${fixedOrphan}`);
  orSamples.forEach((x) => console.log('        ' + x));

  console.log('\n' + '='.repeat(74));
  console.log(DRY ? '  (DRY RUN - tidak ada perubahan disimpan)' : '  SELESAI');
  console.log('='.repeat(74) + '\n');
}
main().then(() => process.exit(0)).catch((e) => { console.error('\n❌ ERROR:', e); process.exit(1); });

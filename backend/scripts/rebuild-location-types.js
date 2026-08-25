'use strict';
/**
 * rebuild-location-types.js — HITUNG ULANG location_type untuk SEMUA baris
 * ---------------------------------------------------------------------------
 * ⚠️ KENAPA ADA: saat mengimpor 800 lokasi Excel, saya (agent) merusak kolom
 * `location_type` lewat beberapa update beruntun yang cakupannya lebih luas
 * dari yang saya kira — berakhir dengan area=0, commercial=1778.
 *
 * YANG TIDAK RUSAK (sudah diverifikasi): location_id, name, city_id, status,
 * 25.723 baris property_locations (0 FK menggantung), dan 1.046
 * properties.area_location_id. Jadi kerusakannya HANYA di kolom tipe, dan tipe
 * bisa dihitung ulang sepenuhnya dari nama + ada/tidaknya city_id.
 *
 * ATURAN (deterministik, idempoten):
 *   1. Punya city_id  -> classify(name)  [area | landmark | commercial]
 *   2. TANPA city_id  -> tidak boleh 'area' (invarian models/Location.js:
 *      kawasan selalu milik satu kota). Jatuh ke 'landmark' bila namanya
 *      berbau tempat publik/rekreasi, selain itu 'commercial'.
 *
 * SELALU jalankan --dry dulu dan BACA ringkasannya sebelum menerapkan.
 *
 * Usage:
 *   node scripts/rebuild-location-types.js --dry
 *   node scripts/rebuild-location-types.js
 */
require('dotenv').config();
const { Op } = require('sequelize');
const { Location, User } = require('../models');
const { classify, LANDMARK_RE } = require('./import-excel-locations');

const DRY   = process.argv.includes('--dry');
const TODAY = new Date().toISOString().slice(0, 10);

function wantedType(name, cityId) {
  if (cityId) return classify(name);
  return LANDMARK_RE.some((re) => re.test(String(name || ''))) ? 'landmark' : 'commercial';
}

async function main() {
  console.log('='.repeat(70));
  console.log('  REBUILD location_type' + (DRY ? '  (DRY RUN)' : ''));
  console.log('='.repeat(70));

  const owner = await User.findOne({ where: { username: 'nigel123' }, raw: true })
             || await User.findOne({ raw: true });

  const rows = await Location.findAll({ where: { status: { [Op.ne]: 3 } } });

  const after  = { area: 0, landmark: 0, commercial: 0 };
  const before = { area: 0, landmark: 0, commercial: 0 };
  const todo   = [];

  for (const row of rows) {
    before[row.location_type] = (before[row.location_type] || 0) + 1;
    const want = wantedType(row.name, row.city_id);
    after[want]++;
    if (row.location_type !== want) todo.push({ row, want });
  }

  console.log('\n  SEBELUM :', Object.entries(before).map(([k, v]) => `${k}=${v}`).join(', '));
  console.log('  SESUDAH :', Object.entries(after).map(([k, v]) => `${k}=${v}`).join(', '));
  console.log(`  perlu diubah: ${todo.length} baris`);

  // Sanity gate: 'area' tanpa city_id TIDAK BOLEH ADA di rencana.
  const illegal = todo.filter((t) => t.want === 'area' && !t.row.city_id).length
                + rows.filter((r) => wantedType(r.name, r.city_id) === 'area' && !r.city_id).length;
  console.log(`  cek invarian (area tanpa city_id direncanakan): ${illegal} (harus 0)`);
  if (illegal > 0) { console.error('  ABORT: rencana melanggar invarian.'); process.exit(1); }

  console.log('\n  contoh perubahan:');
  todo.slice(0, 12).forEach((t) => console.log(`    ${t.row.name}: ${t.row.location_type} -> ${t.want}`));

  if (DRY) {
    console.log('\n' + '='.repeat(70));
    console.log('  (DRY RUN - tidak ada perubahan disimpan)');
    console.log('='.repeat(70) + '\n');
    return;
  }

  let done = 0, failed = 0;
  for (const { row, want } of todo) {
    try {
      await row.update({ location_type: want, updated_date: TODAY, updated_by: owner.user_id });
      done++;
    } catch (e) {
      failed++;
      if (failed <= 3) console.warn(`  gagal: ${row.name} -> ${want}: ${e.message}`);
    }
  }
  console.log(`\n  diterapkan: ${done} | gagal: ${failed}`);
  console.log('='.repeat(70) + '\n');
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error('ERROR:', e); process.exit(1); });
}
module.exports = { wantedType };

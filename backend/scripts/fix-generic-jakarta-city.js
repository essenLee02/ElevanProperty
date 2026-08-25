'use strict';
/**
 * fix-generic-jakarta-city.js — kawasan yang nyangkut di kota generik "JAKARTA" (M150)
 * -----------------------------------------------------------------------------------
 * Temuan pemilik proyek (25 Agu 2026):
 *   "Ada location di Provinsi DKI Jakarta, namun belum ada isinya di kota
 *    Jakarta mana."
 *
 * MASALAHNYA
 * Tabel `cities` memuat "JAKARTA" (setingkat provinsi) BERDAMPINGAN dengan lima
 * kota administrasi yang sebenarnya (JAKARTA BARAT/PUSAT/SELATAN/TIMUR/UTARA).
 * Validasi model hanya menuntut area punya city_id — dan "JAKARTA" memenuhi
 * syarat itu secara teknis — sehingga 10 kawasan mendarat di kota payung ini.
 *
 * AKIBATNYA DI PICKER
 * Aturan picker: area & landmark harus sekota dengan properti. Properti di
 * Jakarta Selatan tidak akan pernah melihat "Kemang" yang tersimpan di kota
 * "JAKARTA", padahal Kemang memang ada di Jakarta Selatan. Datanya ada, tapi
 * tidak pernah muncul.
 *
 * PENANGANAN
 * Setiap kawasan dipindahkan ke kota administrasi yang sebenarnya. Bila di kota
 * tujuan sudah ada baris bernama sama (sangat mungkin — inilah kembaran yang
 * lolos dari M149 karena city_id-nya berbeda, jadi tidak bentrok di unique
 * index), baris generik DILEBUR: link property_locations dipindah, lalu
 * di-nonaktifkan (status = 3).
 *
 * Usage:
 *   node scripts/fix-generic-jakarta-city.js --dry
 *   node scripts/fix-generic-jakarta-city.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DRY = process.argv.includes('--dry');
const cfg = (k) => String(process.env[k] || '').split('#')[0].trim();

/**
 * Kawasan → kota administrasi sebenarnya (DKI Jakarta).
 * Dipetakan per kelurahan/kawasan bisnis yang lazim dipakai pasar properti.
 */
const JAKARTA_AREA_CITY = {
  'KELAPA GADING'      : 'JAKARTA UTARA',
  'PANTAI INDAH KAPUK' : 'JAKARTA UTARA',
  'KEMANG'             : 'JAKARTA SELATAN',
  'KUNINGAN'           : 'JAKARTA SELATAN',
  'SCBD'               : 'JAKARTA SELATAN',
  'SENAYAN'            : 'JAKARTA SELATAN',   // kelurahan Senayan, Kebayoran Baru
  'TEBET'              : 'JAKARTA SELATAN',
  'MENTENG'            : 'JAKARTA PUSAT',
  'SUDIRMAN'           : 'JAKARTA PUSAT',     // koridor CBD Jl. Jend. Sudirman
  'THAMRIN'            : 'JAKARTA PUSAT',
};

async function main() {
  console.log('='.repeat(72));
  console.log(`  PERBAIKAN KOTA GENERIK "JAKARTA" (M150)${DRY ? '  [DRY RUN]' : ''}`);
  console.log('='.repeat(72));

  const c = await mysql.createConnection({
    host: cfg('DB_HOST'), user: cfg('DB_USER'),
    password: cfg('DB_PASSWORD'), database: cfg('DB_NAME'),
  });

  const [cities] = await c.query('SELECT city_id, name FROM cities WHERE status = 1');
  const cityId = new Map(cities.map((x) => [String(x.name).toUpperCase(), x.city_id]));
  const generic = cityId.get('JAKARTA');
  if (!generic) { console.log('Kota generik "JAKARTA" tidak ada — tidak ada yang perlu diperbaiki.'); await c.end(); return; }

  const [rows] = await c.query(
    'SELECT location_id, name, location_type FROM locations WHERE status = 1 AND city_id = ?',
    [generic]
  );

  const [occupied] = await c.query(
    'SELECT location_id, name, city_id FROM locations WHERE status = 1 AND city_id IS NOT NULL'
  );
  const byNameCity = new Map(
    occupied.map((r) => [`${String(r.name).trim().toUpperCase()}::${r.city_id}`, r])
  );

  const move = [];       // [location_id, targetCityId, name, targetName]
  const merge = [];      // [location_id, name, canonId, targetName]
  const skipped = [];

  for (const r of rows) {
    const key = String(r.name).trim().toUpperCase();
    const target = JAKARTA_AREA_CITY[key];
    if (!target) { skipped.push(r.name); continue; }
    const tid = cityId.get(target);
    if (!tid) { skipped.push(`${r.name} (kota "${target}" tidak ada)`); continue; }

    const clash = byNameCity.get(`${key}::${tid}`);
    if (clash) merge.push([r.location_id, r.name, clash.location_id, target]);
    else { move.push([r.location_id, tid, r.name, target]); byNameCity.set(`${key}::${tid}`, r); }
  }

  console.log(`\nDipindahkan ke kota administrasi: ${move.length}`);
  move.forEach(([, , n, t]) => console.log(`   ${n} → ${t}`));
  console.log(`\nDilebur (sudah ada di kota tujuan): ${merge.length}`);
  merge.forEach(([, n, cid, t]) => console.log(`   ${n} → ${t} (lebur ke ${cid})`));
  if (skipped.length) console.log(`\nDilewati (tidak dipetakan): ${skipped.join(', ')}`);

  if (DRY) { console.log('\n(DRY RUN - tidak menulis)\n'); await c.end(); return; }

  for (const [lid, tid] of move) {
    await c.query('UPDATE locations SET city_id = ? WHERE location_id = ?', [tid, lid]);
  }
  let moved = 0;
  for (const [lid, , canonId] of merge) {
    const [links] = await c.query('SELECT property_id FROM property_locations WHERE location_id = ?', [lid]);
    for (const l of links) {
      await c.query(
        'INSERT IGNORE INTO property_locations (property_id, location_id, created_date) VALUES (?,?,NOW())',
        [l.property_id, canonId]
      );
      moved++;
    }
    await c.query('DELETE FROM property_locations WHERE location_id = ?', [lid]);
    await c.query('UPDATE locations SET status = 3 WHERE location_id = ?', [lid]);
  }

  console.log(`\nSELESAI — dipindah: ${move.length}, dilebur: ${merge.length} (link dipindah: ${moved})\n`);
  await c.end();
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}

'use strict';
/**
 * recycle-dead-locations.js — pakai ulang baris status=3 jadi area nyata (M151)
 * ----------------------------------------------------------------------------
 * Directive pemilik proyek (25 Agu 2026):
 *   "Yang location.status = 3, ganti nama aja sesuai area lain dengan lokasi
 *    kota yang sedang digunakan di properties.city_id"
 *
 * LATAR
 * M149/M150 menonaktifkan 87 baris kembaran (status = 3). Baris-baris itu masih
 * memakai location_id yang sah, jadi daripada jadi sampah, dipakai ulang untuk
 * menambal kekurangan yang jauh lebih besar: banyak kota yang PUNYA properti
 * justru NOL area terdaftar — KEDIRI 77 properti / 3 area, GUNUNGKIDUL 50 / 0,
 * KULON PROGO 55 / 0. Tanpa area, picker "Lokasi/Patokan Terdekat" di kota itu
 * praktis kosong.
 *
 * ATURAN PENGISIAN
 *   • Hanya kota yang benar-benar dipakai properties.city_id.
 *   • Hanya nama kecamatan/kelurahan/kawasan NYATA. Tidak ada nama karangan —
 *     kalau slot habis sebelum daftar nyata habis, ya berhenti; kalau daftar
 *     nyata habis lebih dulu, sisa baris dibiarkan status = 3.
 *   • Nama yang sudah ada di kota itu dilewati (unique index name+city_id).
 *   • Diprioritaskan ke kota dengan properti terbanyak & area paling sedikit.
 *
 * Usage:
 *   node scripts/recycle-dead-locations.js --dry
 *   node scripts/recycle-dead-locations.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DRY = process.argv.includes('--dry');
const cfg = (k) => String(process.env[k] || '').split('#')[0].trim();

/**
 * Kecamatan / kawasan nyata per kota, diurut sesuai prioritas kebutuhan
 * (properti banyak, area terdaftar sedikit).
 */
const AREA_POOL = {
  'KEDIRI'           : ['Mojoroto', 'Pesantren', 'Ngasem', 'Pare', 'Wates', 'Gurah', 'Papar', 'Plosoklaten', 'Kandangan', 'Semen'],
  'KULON PROGO'      : ['Wates', 'Pengasih', 'Sentolo', 'Nanggulan', 'Galur', 'Lendah', 'Panjatan', 'Temon', 'Kokap', 'Girimulyo'],
  'GUNUNGKIDUL'      : ['Wonosari', 'Playen', 'Karangmojo', 'Semanu', 'Ponjong', 'Patuk', 'Nglipar', 'Ngawen', 'Semin', 'Tanjungsari'],
  'YOGYAKARTA'       : ['Gondokusuman', 'Umbulharjo', 'Mergangsan', 'Kotagede', 'Jetis', 'Tegalrejo', 'Wirobrajan', 'Mantrijeron', 'Danurejan', 'Gedongtengen'],
  'BANTUL'           : ['Kasihan', 'Sewon', 'Banguntapan', 'Jetis', 'Imogiri', 'Pleret', 'Piyungan', 'Sedayu', 'Pajangan', 'Pandak'],
  'SLEMAN'           : ['Depok', 'Ngaglik', 'Mlati', 'Gamping', 'Godean', 'Kalasan', 'Berbah', 'Pakem', 'Ngemplak', 'Tempel'],
  'DENPASAR'         : ['Denpasar Barat', 'Denpasar Timur', 'Denpasar Selatan', 'Denpasar Utara', 'Renon', 'Sesetan', 'Panjer', 'Ubung', 'Peguyangan', 'Sidakarya'],
  'BADUNG'           : ['Kuta Utara', 'Kuta Selatan', 'Mengwi', 'Abiansemal', 'Petang', 'Legian', 'Kerobokan', 'Tuban', 'Pecatu', 'Ungasan'],
  'TANGERANG SELATAN': ['Serpong', 'Serpong Utara', 'Pondok Aren', 'Ciputat', 'Ciputat Timur', 'Pamulang', 'Setu', 'BSD City', 'Bintaro', 'Alam Sutera'],
};

async function main() {
  console.log('='.repeat(72));
  console.log(`  DAUR ULANG LOKASI status=3 → area nyata (M151)${DRY ? '  [DRY RUN]' : ''}`);
  console.log('='.repeat(72));

  const c = await mysql.createConnection({
    host: cfg('DB_HOST'), user: cfg('DB_USER'),
    password: cfg('DB_PASSWORD'), database: cfg('DB_NAME'),
  });

  const [dead] = await c.query('SELECT location_id, name FROM locations WHERE status = 3 ORDER BY location_id');
  console.log(`\nBaris status=3 tersedia: ${dead.length}`);

  // Hanya kota yang betul-betul dipakai properti.
  const [used] = await c.query(
    'SELECT cy.city_id, cy.name, COUNT(*) props FROM properties p ' +
    'JOIN cities cy ON cy.city_id = p.city_id WHERE p.status = 1 GROUP BY cy.city_id, cy.name'
  );
  const cityByName = new Map(used.map((r) => [String(r.name).toUpperCase(), r]));

  // Nama yang sudah terpakai per kota → jangan tabrak unique index.
  const [taken] = await c.query(
    'SELECT name, city_id FROM locations WHERE status = 1 AND city_id IS NOT NULL'
  );
  const takenKey = new Set(taken.map((r) => `${String(r.name).trim().toUpperCase()}::${r.city_id}`));

  // Susun antrian (kota, nama) sesuai urutan prioritas di AREA_POOL.
  const queue = [];
  const skippedCity = [];
  for (const [cityName, areas] of Object.entries(AREA_POOL)) {
    const city = cityByName.get(cityName);
    if (!city) { skippedCity.push(`${cityName} (tidak dipakai properti)`); continue; }
    for (const a of areas) {
      const key = `${a.toUpperCase()}::${city.city_id}`;
      if (takenKey.has(key)) continue;          // sudah ada, lewati
      queue.push({ cityId: city.city_id, cityName, area: a });
      takenKey.add(key);
    }
  }

  const n = Math.min(dead.length, queue.length);
  console.log(`Kandidat area nyata    : ${queue.length}`);
  console.log(`Akan dipakai ulang     : ${n}`);
  if (dead.length > n) console.log(`Tetap status=3 (kehabisan nama nyata, tidak dikarang): ${dead.length - n}`);
  if (skippedCity.length) console.log(`Kota dilewati          : ${skippedCity.join(', ')}`);

  const plan = [];
  for (let i = 0; i < n; i++) plan.push({ ...queue[i], id: dead[i].location_id, old: dead[i].name });

  const perCity = plan.reduce((m, p) => { m[p.cityName] = (m[p.cityName] || 0) + 1; return m; }, {});
  console.log('\nRencana per kota:');
  Object.entries(perCity).forEach(([k, v]) => console.log(`   ${k.padEnd(20)}${v}`));
  console.log('\nContoh:');
  plan.slice(0, 6).forEach((p) => console.log(`   ${p.id}  "${p.old}" → "${p.area}" (${p.cityName})`));

  if (DRY) { console.log('\n(DRY RUN - tidak menulis)\n'); await c.end(); return; }

  for (const p of plan) {
    await c.query(
      "UPDATE locations SET name = ?, city_id = ?, location_type = 'area', status = 1 WHERE location_id = ?",
      [p.area, p.cityId, p.id]
    );
  }
  console.log(`\nSELESAI — ${plan.length} baris dipakai ulang jadi area aktif\n`);
  await c.end();
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}

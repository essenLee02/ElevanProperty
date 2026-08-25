'use strict';
/**
 * seed-natasha-property-locations.js — 5-8 patokan per properti Natasha (M148)
 * ---------------------------------------------------------------------------
 * Directive pemilik proyek (25 Agu 2026):
 *   "Untuk properti milik Natasha, tambahkan location-nya 5-8 lokasi area,
 *    komersial dan landmark secara random di PropertyLocation.js. Namun isian
 *    landmark dan area harus sesuai informasi Property.area dan Property.city_id
 *    sesuai informasi data lokasi secara online."
 *
 * ATURAN YANG DITEGAKKAN (sama dengan endpoint picker /location/nearby-options):
 *   • area      -> HANYA dari kota properti itu. Area yang SAMA dengan
 *                  properties.area dipasang LEBIH DULU (itu identitas
 *                  lingkungannya sendiri), sisanya area lain sekota.
 *   • landmark  -> HANYA dari kota properti itu (patokan lintas kota tidak
 *                  membantu customer menemukan properti).
 *   • commercial-> boleh lintas kota. Indomaret/Alfamart/sekolah/stasiun memang
 *                  generik (di DB ini 572 baris commercial ber-city_id NULL).
 *
 * Idempoten: hanya MENAMBAH sampai jumlah target tercapai; baris yang sudah ada
 * tidak diduplikasi (unique index property_id+location_id juga menjaganya).
 *
 * Usage:
 *   node scripts/seed-natasha-property-locations.js --dry
 *   node scripts/seed-natasha-property-locations.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DRY   = process.argv.includes('--dry');
const AGENT = process.env.SEED_AGENT_USER_ID || 'NA40D8N007';
const MIN_LOC = 5;
const MAX_LOC = 8;

const cfg = (k) => String(process.env[k] || '').split('#')[0].trim();
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

/** Ambil n elemen acak tanpa pengulangan. */
function pickN(arr, n) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

async function main() {
  console.log('='.repeat(72));
  console.log(`  SEED property_locations Natasha (5-8 per properti)${DRY ? '  [DRY RUN]' : ''}`);
  console.log('='.repeat(72));

  const c = await mysql.createConnection({
    host: cfg('DB_HOST'), user: cfg('DB_USER'),
    password: cfg('DB_PASSWORD'), database: cfg('DB_NAME'),
  });

  // Master lokasi, dipisah per peran.
  const [locs] = await c.query(
    "SELECT location_id, name, city_id, location_type FROM locations WHERE status = 1"
  );
  const areaByCity     = new Map();   // city_id -> [loc]
  const landmarkByCity = new Map();
  const commercialAll  = [];
  const commercialByCity = new Map();   // commercial YANG punya kota
  for (const l of locs) {
    if (l.location_type === 'commercial') {
      // ⚠️ "commercial tidak perlu cocok kota" hanya berlaku untuk yang GENERIK
      // (city_id NULL): INDOMARET, ALFAMART, STASIUN KRL, SEKOLAH — memang ada
      // di setiap kota. Commercial yang PUNYA city_id adalah tempat BERNAMA
      // (Plaza Senayan, Cilandak Town Square, Tunjungan Plaza); memasangnya ke
      // properti di kota lain menghasilkan patokan yang MENYESATKAN customer
      // ("dekat Plaza Senayan" untuk rumah di Gresik). Ketahuan saat verifikasi
      // seed pertama: 353 pasangan lintas kota seperti itu.
      if (l.city_id) {
        if (!commercialByCity.has(l.city_id)) commercialByCity.set(l.city_id, []);
        commercialByCity.get(l.city_id).push(l);
      } else {
        commercialAll.push(l);            // generik → boleh di kota mana pun
      }
      continue;
    }
    const bucket = l.location_type === 'area' ? areaByCity : landmarkByCity;
    if (!l.city_id) continue;                       // area/landmark wajib punya kota
    if (!bucket.has(l.city_id)) bucket.set(l.city_id, []);
    bucket.get(l.city_id).push(l);
  }
  console.log(`\nMaster: commercial=${commercialAll.length}, kota dengan area=${areaByCity.size}, kota dengan landmark=${landmarkByCity.size}`);

  const [props] = await c.query(
    "SELECT property_id, city_id, area, area_location_id FROM properties WHERE user_id = ? AND status = 1",
    [AGENT]
  );
  const [existing] = await c.query(
    `SELECT pl.property_id, pl.location_id
       FROM property_locations pl
       JOIN properties p ON p.property_id = pl.property_id
      WHERE p.user_id = ?`, [AGENT]
  );
  const have = new Map();
  for (const e of existing) {
    if (!have.has(e.property_id)) have.set(e.property_id, new Set());
    have.get(e.property_id).add(e.location_id);
  }

  console.log(`Properti: ${props.length}`);

  const rows = [];
  const stats = { area: 0, landmark: 0, commercial: 0, skippedFull: 0, noCity: 0 };

  for (const p of props) {
    const own = have.get(p.property_id) || new Set();
    const target = randInt(MIN_LOC, MAX_LOC);
    if (own.size >= target) { stats.skippedFull++; continue; }

    const cityAreas     = (areaByCity.get(p.city_id) || []).filter((l) => !own.has(l.location_id));
    const cityLandmarks = (landmarkByCity.get(p.city_id) || []).filter((l) => !own.has(l.location_id));
    // Commercial yang boleh dipakai properti ini: yang GENERIK (lintas kota)
    // + yang bernama TAPI berada di kota yang sama.
    const commercials = [
      ...commercialAll,
      ...(commercialByCity.get(p.city_id) || []),
    ].filter((l) => !own.has(l.location_id));
    if (!cityAreas.length && !cityLandmarks.length && !commercials.length) { stats.noCity++; continue; }

    const need = target - own.size;
    const chosen = [];

    // 1) Area yang SAMA dengan properties.area lebih dulu — identitas lingkungan
    //    properti itu sendiri, paling relevan sebagai patokan.
    if (p.area_location_id && !own.has(p.area_location_id)) {
      const self = cityAreas.find((l) => l.location_id === p.area_location_id);
      if (self) chosen.push(self);
    }

    // 2) Sisanya: campuran area sekota + landmark sekota + commercial lintas kota.
    //    Proporsi kasar 2 : 2 : sisanya, tapi selalu dibatasi stok yang ada.
    const remaining = need - chosen.length;
    if (remaining > 0) {
      const wantArea = Math.min(Math.max(1, Math.round(remaining * 0.35)), cityAreas.length);
      const wantLm   = Math.min(Math.max(1, Math.round(remaining * 0.30)), cityLandmarks.length);
      const picked = [
        ...pickN(cityAreas.filter((l) => !chosen.includes(l)), wantArea),
        ...pickN(cityLandmarks, wantLm),
      ];
      const wantComm = Math.max(0, remaining - picked.length);
      picked.push(...pickN(commercials, Math.min(wantComm, commercials.length)));
      chosen.push(...picked.slice(0, remaining));
    }

    for (const l of chosen) {
      rows.push([p.property_id, l.location_id, AGENT]);
      stats[l.location_type]++;
    }
  }

  console.log(`\nAkan ditambahkan: ${rows.length} baris`);
  console.log(`  area=${stats.area}, landmark=${stats.landmark}, commercial=${stats.commercial}`);
  console.log(`  properti sudah cukup: ${stats.skippedFull} | tanpa stok lokasi: ${stats.noCity}`);

  if (DRY) {
    console.log('\n(DRY RUN - tidak menulis)\n');
    await c.end();
    return;
  }

  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    await c.query(
      'INSERT IGNORE INTO property_locations (property_id, location_id, created_date, created_by) VALUES ' +
      chunk.map(() => '(?,?,NOW(),?)').join(','),
      chunk.flat()
    );
  }
  console.log(`\nSELESAI - ${rows.length} baris ditulis`);
  await c.end();
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}

#!/usr/bin/env node
/**
 * backfill-location-types.js — M129.
 *
 * Dua tugas, keduanya IDEMPOTEN (aman dijalankan berkali-kali):
 *
 * 1. RECLASSIFY: 587 baris `locations` yang sudah ada semuanya mendapat
 *    default location_type='commercial' saat kolomnya baru ditambahkan
 *    (lihat models/Location.js). Mayoritas memang benar commercial (RS,
 *    minimarket, sekolah, bank, terminal) — tapi sebagian jelas LANDMARK
 *    (taman, pantai, candi, monumen, gunung, danau, tugu, alun-alun, tempat
 *    ibadah bersejarah, museum, wisata). Script ini mencocokkan nama baris
 *    terhadap daftar kata kunci landmark dan meng-update location_type
 *    menjadi 'landmark' HANYA untuk yang cocok — sisanya TETAP 'commercial'.
 *
 * 2. AREA IMPORT: utils/locationLandmarks.js punya daftar kawasan per-kota
 *    (Citraland, Pakuwon, Wiyung, dst — ~45 kota) yang SEBELUM M129 hanya
 *    hidup sebagai file statis, tidak pernah masuk tabel `locations` sama
 *    sekali. Script ini meng-insert setiap nama itu sebagai baris BARU
 *    dengan location_type='area' dan city_id yang dicocokkan dari tabel
 *    `cities` (pencarian case-insensitive by name). Kota yang namanya tidak
 *    ditemukan di tabel cities (mis. alias "solo" vs "surakarta" sudah
 *    ditangani) di-skip dengan peringatan, TIDAK menghentikan seluruh proses.
 *
 * PEMAKAIAN: node scripts/backfill-location-types.js
 *   --dry-run   : hanya tampilkan apa yang AKAN dilakukan, tidak menulis DB
 */
'use strict';

require('dotenv').config();
const { Location, City, User } = require('../models');
const { LOCATION_LANDMARKS } = require('../utils/locationLandmarks');

const DRY_RUN = process.argv.includes('--dry-run');

// Kata kunci landmark — tempat publik/rekreasi/bersejarah yang jadi PATOKAN
// LOKASI, bukan fasilitas komersial sehari-hari. Sengaja daftar POSITIF
// (harus cocok eksplisit), bukan negatif — menghindari salah reklasifikasi
// baris commercial yang samar (mis. "TAMAN BERMAIN ANAK" di mal tetap
// commercial secara fungsi, walau mengandung kata "taman").
const LANDMARK_KEYWORDS = [
  /\btaman\b/i, /\bpantai\b/i, /\bcandi\b/i, /\bmonumen\b/i, /\btugu\b/i,
  /\balun[\s-]?alun\b/i, /\bmuseum\b/i, /\bwisata\b/i, /\bgunung\b/i,
  /\bdanau\b/i, /\bbukit\b/i, /\bair terjun\b/i, /\bkawah\b/i, /\bgoa\b/i,
  /\bpura\b/i, /\bvihara\b/i, /\bkuil\b/i, /\bkeraton\b/i, /\bbenteng\b/i,
  /\bkebun binatang\b/i, /\bzoo\b/i, /\bsafari\b/i, /\bwaterbom\b/i,
  /\bdunia fantasi\b/i, /\bjatim park\b/i, /\bmangrove\b/i, /\bjembatan\b/i,
  /\bpelabuhan\b/i, /\bcar free day\b/i, /\bruang terbuka hijau\b/i,
  /\bfarm house\b/i, /\bheha sky\b/i, /\bpasar seni\b/i, /\brice terrace\b/i,
];

// Fasilitas yang MENGANDUNG kata landmark tapi FUNGSINYA commercial —
// dikecualikan eksplisit supaya tidak salah reklasifikasi.
const LANDMARK_EXCEPTIONS = new Set([
  'TAMAN BERMAIN ANAK', 'TAMAN KANAK-KANAK', 'AREA BERMAIN ANAK',
]);

function isLandmarkByName(name) {
  const n = String(name || '').toUpperCase();
  if (LANDMARK_EXCEPTIONS.has(n)) return false;
  return LANDMARK_KEYWORDS.some((re) => re.test(name));
}

function _generateLocationId(name, total) {
  const prefix = String(name || 'LO').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase().padEnd(2, 'X');
  const rand = Array.from({ length: 5 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
  ).join('');
  return `${prefix}${rand}${String((total || 0) + 1).padStart(3, '0')}`.toUpperCase();
}

function _todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  console.log(`\n=== M129 backfill-location-types.js ${DRY_RUN ? '(DRY RUN — tidak menulis DB)' : ''} ===\n`);

  // ── Tugas 1: reklasifikasi commercial → landmark ──────────────────────
  console.log('── Tugas 1: reklasifikasi landmark dari baris commercial lama ──');
  const commercialRows = await Location.findAll({ where: { location_type: 'commercial' } });
  const toReclassify = commercialRows.filter((row) => isLandmarkByName(row.name));
  console.log(`  ${commercialRows.length} baris commercial diperiksa, ${toReclassify.length} cocok pola landmark.`);
  for (const row of toReclassify) {
    console.log(`    → "${row.name}" : commercial → landmark`);
    if (!DRY_RUN) await row.update({ location_type: 'landmark', updated_date: _todayDate() });
  }

  // ── Tugas 2: import AREA per-kota dari locationLandmarks.js ───────────
  console.log('\n── Tugas 2: import kawasan/area per-kota dari locationLandmarks.js ──');
  const allCities = await City.findAll({ attributes: ['city_id', 'name'], raw: true });
  const cityByName = new Map(allCities.map((c) => [c.name.toLowerCase().trim(), c]));

  // created_by acak dari user_id nyata (bukan placeholder tetap) — konsisten
  // dengan konvensi seed-area-landmark-2026-08.js.
  const userIds = (await User.findAll({ attributes: ['user_id'], raw: true })).map((u) => u.user_id);
  const randomUserId = () => userIds[Math.floor(Math.random() * userIds.length)];

  let totalLoc = await Location.count();
  let inserted = 0, skippedCityNotFound = 0, skippedAlreadyExists = 0;
  const citiesNotFound = new Set();

  for (const [cityKey, areas] of Object.entries(LOCATION_LANDMARKS)) {
    const city = cityByName.get(cityKey.toLowerCase().trim());
    if (!city) { citiesNotFound.add(cityKey); skippedCityNotFound += areas.length; continue; }

    for (const areaName of areas) {
      const existing = await Location.findOne({ where: { name: areaName, city_id: city.city_id } });
      if (existing) { skippedAlreadyExists++; continue; }

      totalLoc++;
      console.log(`    + "${areaName}" (area) → kota "${city.name}"`);
      if (!DRY_RUN) {
        await Location.create({
          location_id: _generateLocationId(areaName, totalLoc),
          name: areaName,
          city_id: city.city_id,
          location_type: 'area',
          status: 1,
          created_date: _todayDate(),
          created_by: randomUserId(),
        });
      }
      inserted++;
    }
  }

  if (citiesNotFound.size) {
    console.log(`\n  ⚠️  ${citiesNotFound.size} kota di locationLandmarks.js TIDAK ditemukan di tabel cities (di-skip):`);
    console.log(`      ${[...citiesNotFound].join(', ')}`);
  }

  console.log(`\n=== RINGKASAN ===`);
  console.log(`  Landmark direklasifikasi : ${toReclassify.length}`);
  console.log(`  Area baru di-insert      : ${inserted}`);
  console.log(`  Area sudah ada (skip)    : ${skippedAlreadyExists}`);
  console.log(`  Area di-skip (kota N/A)  : ${skippedCityNotFound}`);
  if (DRY_RUN) console.log('\n  (DRY RUN — tidak ada perubahan ditulis ke DB. Jalankan tanpa --dry-run untuk menerapkan.)');

  process.exit(0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

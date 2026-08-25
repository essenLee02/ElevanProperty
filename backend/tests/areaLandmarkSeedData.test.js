/**
 * areaLandmarkSeedData.test.js — regresi M129 follow-up (seed-area-landmark-2026-08.js).
 *
 * Verifikasi data yang di-insert untuk Surabaya, Sidoarjo, Gresik, dan 5
 * wilayah Jakarta: setiap baris area punya city_id valid, created_by adalah
 * user_id NYATA (bukan placeholder tetap seperti "SYSTEM_..."), dan tidak ada
 * duplikat (name, city_id).
 *
 * Run: node tests/areaLandmarkSeedData.test.js
 */
'use strict';

require('dotenv').config();
const { Location, City, User } = require('../models');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const TARGET_CITIES = [
  'SURABAYA', 'SIDOARJO', 'GRESIK',
  'JAKARTA PUSAT', 'JAKARTA UTARA', 'JAKARTA BARAT', 'JAKARTA SELATAN', 'JAKARTA TIMUR',
];

async function main() {
  const realUserIds = new Set((await User.findAll({ attributes: ['user_id'], raw: true })).map((u) => u.user_id));
  ok('setidaknya 1 user nyata ada di DB (prasyarat test)', realUserIds.size > 0);

  console.log('\n== Setiap kota target punya lokasi area DAN landmark baru ==');
  for (const cityName of TARGET_CITIES) {
    const city = await City.findOne({ where: { name: cityName } });
    ok(`kota "${cityName}" ada di tabel cities`, !!city);
    if (!city) continue;

    const rows = await Location.findAll({ where: { city_id: city.city_id }, raw: true });
    const areaCount = rows.filter((r) => r.location_type === 'area').length;
    const landmarkCount = rows.filter((r) => r.location_type === 'landmark').length;
    ok(`${cityName}: punya minimal 1 baris area`, areaCount >= 1, `got ${areaCount}`);
    ok(`${cityName}: punya minimal 1 baris landmark`, landmarkCount >= 1, `got ${landmarkCount}`);

    // Semua baris area WAJIB city_id terisi (aturan model M129).
    const areaRows = rows.filter((r) => r.location_type === 'area');
    ok(`${cityName}: semua baris area punya city_id terisi (bukan null)`,
      areaRows.every((r) => !!r.city_id));

    // created_by harus salah satu user_id NYATA, bukan placeholder tetap.
    const badCreatedBy = rows.filter((r) => !realUserIds.has(r.created_by));
    ok(`${cityName}: SEMUA created_by adalah user_id nyata (bukan placeholder)`,
      badCreatedBy.length === 0, JSON.stringify(badCreatedBy.map((r) => r.created_by)));
  }

  console.log('\n== KONTROL — contoh spesifik dari permintaan pemilik proyek ==');
  {
    const surabaya = await City.findOne({ where: { name: 'SURABAYA' } });
    const ptc = await Location.findOne({ where: { name: 'Pakuwon Trade Center (PTC)', city_id: surabaya.city_id }, raw: true });
    // M147: PTC adalah MALL -> 'commercial'. Assertion lama (landmark) justru
    // mengunci salah-kategori yang diminta pemilik proyek untuk diperbaiki:
    // models/Location.js menaruh fasilitas komersial (mall/pasar/kampus/RS) di
    // 'commercial', dan 'landmark' untuk patokan wisata/publik.
    ok('Surabaya: "Pakuwon Trade Center (PTC)" ada, location_type=commercial', ptc && ptc.location_type === 'commercial');

    const sidoarjo = await City.findOne({ where: { name: 'SIDOARJO' } });
    const japfa = await Location.findOne({ where: { name: 'PT Japfa Comfeed Indonesia Tbk', city_id: sidoarjo.city_id }, raw: true });
    // M147: pabrik/perusahaan = fasilitas komersial, bukan patokan wisata.
    ok('Sidoarjo: "PT Japfa Comfeed Indonesia Tbk" ada, location_type=commercial', japfa && japfa.location_type === 'commercial');

    const jaksel = await City.findOne({ where: { name: 'JAKARTA SELATAN' } });
    const kemang = await Location.findOne({ where: { name: 'Kemang', city_id: jaksel.city_id }, raw: true });
    ok('Jakarta Selatan: "Kemang" ada, location_type=area', kemang && kemang.location_type === 'area');
    const senayanCity = await Location.findOne({ where: { name: 'Senayan City', city_id: jaksel.city_id }, raw: true });
    // M147: Senayan City adalah MALL -> 'commercial'.
    ok('Jakarta Selatan: "Senayan City" ada, location_type=commercial', senayanCity && senayanCity.location_type === 'commercial');
  }

  console.log('\n== KONTROL NEGATIF — tidak ada duplikat (name, city_id) ==');
  {
    const allRows = await Location.findAll({ attributes: ['name', 'city_id'], raw: true });
    const seen = new Map();
    let dupes = 0;
    for (const r of allRows) {
      const key = `${r.name}|${r.city_id}`;
      if (seen.has(key)) dupes++;
      seen.set(key, true);
    }
    ok('tidak ada baris (name, city_id) yang terduplikasi', dupes === 0, `${dupes} duplikat ditemukan`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

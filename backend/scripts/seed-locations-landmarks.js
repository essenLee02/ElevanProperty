'use strict';
/**
 * seed-locations-landmarks.js
 * ---------------------------------------------------------------------------
 * Mengisi master data `locations` dengan LANDMARK NYATA (mall, kampus, stasiun,
 * pasar, wisata, cafe, area/kawasan) dan melengkapi `cities` dengan kota payung
 * yang belum ada.
 *
 * LATAR BELAKANG (M92/M93):
 *   Tabel `locations` sebelumnya berisi label GENERIK — "PASAR TRADISIONAL",
 *   "MALL PREMIUM", "SUPERMARKET BESAR". Label seperti itu tidak berguna sebagai
 *   patokan lokasi (Q6): customer menyebut "deket Pakuwon", "deket Ciputra World",
 *   "deket Stasiun Gubeng" — nama ASLI, bukan kategori.
 *
 *   Tabel `cities` juga memuat JAKARTA PUSAT/UTARA/BARAT/SELATAN/TIMUR tetapi
 *   TIDAK memuat "JAKARTA" polos, sehingga "Di kota Jakarta" tidak pernah cocok
 *   (pencocokan memakai word-boundary; "jakarta pusat" tidak match "Jakarta").
 *   Customer mengetiknya lima kali berturut-turut tanpa pernah dikenali.
 *
 * Jalankan:
 *   node backend/scripts/seed-locations-landmarks.js         # tulis ke DB
 *   node backend/scripts/seed-locations-landmarks.js --dry   # pratinjau saja
 *
 * IDEMPOTEN: hanya menyisipkan nama yang BELUM ada (perbandingan
 * case-insensitive, spasi dirapatkan). Aman dijalankan berulang; data yang
 * sudah diubah admin tidak pernah ditimpa atau dihapus.
 */

require('dotenv').config();

const path = require('path');
const { Op } = require('sequelize');
const { Location, City, Province } = require('../models');
const GeneralController = require('../controllers/GeneralController');

const DRY = process.argv.includes('--dry');
const SEED = require(path.join(__dirname, '..', 'data', 'landmarks-seed.json'));

/**
 * Kota payung yang WAJIB ada agar penyebutan umum dikenali.
 *
 * `province` harus SAMA PERSIS dengan `provinces.name` di DB — bukan pola LIKE.
 * ⚠️ Versi pertama skrip ini mencari provinsi dengan `LIKE '%JAKARTA%'` dan
 * mendapat "DAERAH ISTIMEWA JOGJAKARTA" (karena "JOG-JAKARTA" memuat "JAKARTA"),
 * sehingga kota Jakarta nyaris tersimpan di bawah provinsi Yogyakarta.
 * Tertangkap saat --dry; itulah gunanya dry run dijalankan lebih dulu.
 */
const UMBRELLA_CITIES = [
  { name: 'JAKARTA', province: 'DKI JAKARTA' },
];

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_]+/g, ' ').trim();
const today = () => new Date().toISOString().slice(0, 10);
const SEEDER = 'SEEDER';

/** Semua nama landmark dari berkas seed, sudah dedupe & dirapikan. */
function collectLandmarks() {
  const out = [];
  const seen = new Set();
  for (const [group, list] of Object.entries(SEED)) {
    if (group.startsWith('_') || !Array.isArray(list)) continue;
    for (const raw of list) {
      const name = String(raw || '').trim().toUpperCase();
      if (!name || name.length > 100) continue;
      const key = norm(name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

async function seedLandmarks() {
  const wanted = collectLandmarks();
  const existing = await Location.findAll({ attributes: ['name'], raw: true });
  const have = new Set(existing.map((r) => norm(r.name)));

  const missing = wanted.filter((n) => !have.has(norm(n)));

  console.log(`\n📍 LANDMARK (tabel locations)`);
  console.log(`   di berkas seed : ${wanted.length}`);
  console.log(`   sudah ada di DB: ${wanted.length - missing.length}`);
  console.log(`   akan disisipkan: ${missing.length}`);

  if (!missing.length) return 0;
  if (DRY) {
    console.log('   contoh:', missing.slice(0, 12).join(' · '));
    return missing.length;
  }

  let inserted = 0;
  // generateRandomId(name, count) bersifat SINKRON dan memakai count untuk
  // sufiks 3 digit. Hitung sekali lalu naikkan per sisipan — memanggil
  // Location.count() di dalam loop akan lambat dan tetap bisa bertabrakan.
  let seq = await Location.count();

  for (const name of missing) {
    try {
      // ID dibuat lewat generator kanonik yang sama dengan master controller
      // lain, supaya format ID konsisten di seluruh sistem.
      const location_id = GeneralController.generateRandomId(name, seq++);
      await Location.create({
        location_id,
        name,
        status: 1,
        created_date: today(),
        created_by: SEEDER,
      });
      inserted++;
    } catch (err) {
      // Nama unik → tabrakan berarti sudah ada (race/ejaan beda). Lewati saja.
      if (err?.name === 'SequelizeUniqueConstraintError') continue;
      console.warn(`   ⚠️  gagal "${name}": ${err.message}`);
    }
  }
  console.log(`   ✅ tersisip: ${inserted}`);
  return inserted;
}

async function seedUmbrellaCities() {
  console.log(`\n🏙️  KOTA PAYUNG (tabel cities)`);
  let inserted = 0;

  for (const { name, province } of UMBRELLA_CITIES) {
    const already = await City.findOne({
      where: { name: { [Op.like]: name } },
      raw: true,
    });
    if (already) { console.log(`   • ${name}: sudah ada`); continue; }

    // Pencocokan TEPAT (bukan LIKE) — lihat catatan di UMBRELLA_CITIES.
    const prov = await Province.findOne({
      where: { name: province, status: 1 },
      raw: true,
    });
    if (!prov) {
      console.warn(`   ⚠️  ${name}: provinsi "${province}" tidak ditemukan — dilewati`);
      continue;
    }

    console.log(`   • ${name}: AKAN DISISIPKAN (provinsi ${prov.name})`);
    if (DRY) { inserted++; continue; }

    try {
      const city_id = GeneralController.generateRandomId(name, await City.count());
      await City.create({
        city_id,
        // `cities` menyimpan country_id JUGA (denormalisasi) dan kolomnya NOT
        // NULL — diambil dari provinsi induk, bukan ditebak.
        country_id: prov.country_id,
        province_id: prov.province_id,
        name,
        status: 1,
        created_date: today(),
        created_by: SEEDER,
      });
      inserted++;
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError') continue;
      console.warn(`   ⚠️  gagal "${name}": ${err.message}`);
    }
  }
  if (!DRY) console.log(`   ✅ tersisip: ${inserted}`);
  return inserted;
}

(async () => {
  console.log(DRY ? '=== DRY RUN (tidak menulis ke DB) ===' : '=== SEED LOCATIONS & CITIES ===');
  try {
    const cities = await seedUmbrellaCities();
    const marks = await seedLandmarks();

    const totalLoc = await Location.count({ where: { status: 1 } });
    const totalCity = await City.count({ where: { status: 1 } });
    console.log(`\n📊 SETELAH SEED: ${totalCity} kota aktif · ${totalLoc} landmark aktif`);
    console.log(DRY ? '(dry run — tidak ada perubahan)' : `Selesai. +${cities} kota, +${marks} landmark.`);
    process.exit(0);
  } catch (err) {
    console.error('FATAL:', err.message);
    process.exit(1);
  }
})();

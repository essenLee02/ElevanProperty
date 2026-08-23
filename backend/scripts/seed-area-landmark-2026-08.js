#!/usr/bin/env node
/**
 * seed-area-landmark-2026-08.js — M129 follow-up.
 *
 * Menambahkan lokasi AREA (kawasan/distrik terkenal) dan LANDMARK (institusi/
 * venue/perusahaan spesifik yang jadi patokan lokasi) untuk 8 kota/wilayah:
 * Surabaya, Sidoarjo, Gresik, Jakarta Pusat/Utara/Barat/Selatan/Timur.
 *
 * ⚠️ HANYA nama REAL yang diyakini akurat dari pengetahuan umum — TIDAK ADA
 * placeholder/karangan untuk mengejar kuantitas (permintaan awal 500/kota
 * SENGAJA tidak dipenuhi apa adanya; lihat diskusi sesi ini). Setiap kota
 * realistis mendapat puluhan entri, bukan ratusan — kualitas di atas kuantitas.
 *
 * created_by: dipilih ACAK dari users.user_id yang benar-benar ada di DB
 * (sesuai permintaan pemilik proyek), bukan string tetap seperti sesi
 * sebelumnya ("SYSTEM_M129_BACKFILL").
 *
 * IDEMPOTEN: dedup lewat (name, city_id) — sama seperti unique constraint
 * `uq_locations_name_city`. Aman dijalankan berkali-kali.
 *
 * PEMAKAIAN: node scripts/seed-area-landmark-2026-08.js [--dry-run]
 */
'use strict';

require('dotenv').config();
const { Location, City, User } = require('../models');

const DRY_RUN = process.argv.includes('--dry-run');

// name → location_type ('area' | 'landmark')
const DATA_BY_CITY = {
  'SURABAYA': {
    area: [
      'Pakuwon Indah', 'Ngagel', 'Jemursari', 'Klampis', 'Sukolilo', 'Nginden',
      'Gunung Anyar', 'Margorejo', 'Ketintang', 'Semolowaru', 'Pucang',
      'Lakarsantri', 'Benowo', 'Tandes', 'Rungkut Industri', 'Sememi',
    ],
    landmark: [
      'Universitas Airlangga (UNAIR)', 'Universitas Surabaya (UBAYA)',
      'Institut Sains dan Teknologi Terpadu Surabaya (ISTTS)',
      'Pakuwon Trade Center (PTC)', 'Universitas Ciputra',
      'Kenjeran Park (Kenpark)', 'Monumen Kapal Selam (Monkasel)',
      'Balai Pemuda Surabaya', 'Gedung Grahadi', 'Masjid Al Akbar Surabaya',
      'Jembatan Merah', 'Kya-Kya Kembang Jepun',
    ],
  },
  'SIDOARJO': {
    area: [
      'Waru', 'Gedangan', 'Buduran', 'Krian', 'Taman Sidoarjo', 'Sukodono',
      'Candi Sidoarjo', 'Tulangan', 'Porong', 'Tanggulangin',
    ],
    landmark: [
      'Bandara Internasional Juanda', 'PT Maspion',
      'PT Integra Indocabinet', 'PT Japfa Comfeed Indonesia Tbk',
      'PT Ecco Tannery Indonesia', 'Kawasan Industri Berbek',
      'Pasar Larangan Sidoarjo', 'Kampung Batik Jetis',
      'Alun-Alun Sidoarjo', 'Museum Mpu Tantular',
    ],
  },
  'GRESIK': {
    area: [
      'Kebomas', 'Driyorejo', 'Cerme', 'Manyar Gresik', 'Gresik Kota Baru (GKB)',
    ],
    landmark: [
      'PT Semen Indonesia (Semen Gresik)', 'PT Petrokimia Gresik',
      'Makam Sunan Giri', 'Makam Sunan Maulana Malik Ibrahim',
      'Petrokimia Gresik Sport Club',
    ],
  },
  'JAKARTA SELATAN': {
    area: [
      'Kemang', 'Pondok Indah', 'Kebayoran Baru', 'Kebayoran Lama',
      'Pasar Minggu', 'Lebak Bulus', 'Cipete', 'Cilandak', 'Fatmawati',
      'Tebet', 'Blok M', 'Senayan',
    ],
    landmark: [
      'Senayan City', 'Pondok Indah Mall (PIM)', 'Gandaria City',
      'Pacific Place', 'Plaza Senayan', 'Cilandak Town Square (Citos)',
      'Gelora Bung Karno (GBK)', 'Ragunan Zoo',
    ],
  },
  'JAKARTA UTARA': {
    area: [
      'Kelapa Gading', 'Sunter', 'Pantai Indah Kapuk (PIK)', 'Tanjung Priok',
      'Muara Angke', 'Marunda',
    ],
    landmark: [
      'Mall of Indonesia (MOI)', 'Kelapa Gading Mall', 'Ancol Dreamland',
      'Sunda Kelapa', 'Pelabuhan Tanjung Priok',
    ],
  },
  'JAKARTA BARAT': {
    area: [
      'Tanjung Duren', 'Kebon Jeruk', 'Puri Indah', 'Grogol', 'Cengkareng',
      'Kalideres', 'Season City', 'Citra Garden',
    ],
    landmark: [
      'Taman Anggrek Mall', 'Central Park Mall', 'Kota Tua Jakarta',
      'Bandara Soekarno-Hatta',
    ],
  },
  'JAKARTA TIMUR': {
    area: [
      'Cakung', 'Duren Sawit', 'Kalimalang', 'Pulomas', 'Rawamangun',
      'Cipinang', 'Jatinegara', 'Pondok Kelapa', 'Pulo Gadung',
    ],
    landmark: [
      'Taman Mini Indonesia Indah (TMII)', 'Terminal Kampung Rambutan',
      'Velodrome Rawamangun',
    ],
  },
  'JAKARTA PUSAT': {
    area: [
      'Menteng', 'Kemayoran', 'Cikini', 'Senen', 'Sawah Besar', 'Tanah Abang',
    ],
    landmark: [
      'Monumen Nasional (Monas)', 'Grand Indonesia', 'Plaza Indonesia',
      'Istana Merdeka', 'Stasiun Gambir',
    ],
  },
};

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

function _pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log(`\n=== seed-area-landmark-2026-08.js ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  const users = await User.findAll({ attributes: ['user_id'], raw: true });
  if (!users.length) throw new Error('Tabel users kosong — tidak ada user_id untuk created_by.');
  const userIds = users.map((u) => u.user_id);
  console.log(`  ${userIds.length} user_id tersedia untuk created_by acak: ${userIds.join(', ')}`);

  let totalLoc = await Location.count();
  let inserted = 0, skippedExists = 0, skippedCityNotFound = 0;

  for (const [cityName, buckets] of Object.entries(DATA_BY_CITY)) {
    const city = await City.findOne({ where: { name: cityName } });
    if (!city) {
      console.log(`  ⚠️  Kota "${cityName}" tidak ditemukan di tabel cities — dilewati.`);
      skippedCityNotFound += buckets.area.length + buckets.landmark.length;
      continue;
    }
    console.log(`\n── ${cityName} (${city.city_id}) ──`);

    for (const [locationType, names] of Object.entries(buckets)) {
      for (const name of names) {
        const existing = await Location.findOne({ where: { name, city_id: city.city_id } });
        if (existing) { skippedExists++; continue; }

        totalLoc++;
        const createdBy = _pickRandom(userIds);
        console.log(`    + [${locationType}] "${name}" (created_by=${createdBy})`);
        if (!DRY_RUN) {
          await Location.create({
            location_id: _generateLocationId(name, totalLoc),
            name,
            city_id: city.city_id,
            location_type: locationType,
            status: 1,
            created_date: _todayDate(),
            created_by: createdBy,
          });
        }
        inserted++;
      }
    }
  }

  console.log(`\n=== RINGKASAN ===`);
  console.log(`  Baru di-insert       : ${inserted}`);
  console.log(`  Sudah ada (skip)     : ${skippedExists}`);
  console.log(`  Kota tidak ditemukan : ${skippedCityNotFound}`);
  if (DRY_RUN) console.log('\n  (DRY RUN — tidak ada perubahan ditulis ke DB.)');

  process.exit(0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

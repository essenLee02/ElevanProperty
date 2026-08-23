#!/usr/bin/env node
/**
 * seed-missing-facilities-2026-08.js — M129 follow-up.
 *
 * Fasilitas yang ditemukan HILANG saat membandingkan 277 baris `facilities`
 * yang sudah ada terhadap listing rumah123.com nyata (screenshot yang
 * dilampirkan pemilik proyek — Giva 10 Grand Wisata, Klaska Residence, Cosmo
 * Terrace, dll). Semua nama di bawah adalah fasilitas GENERIK yang benar-benar
 * umum di listing developer Indonesia — bukan tebakan/karangan.
 *
 * IDEMPOTEN: dedup lewat `name` (facilities.name masih unique global, TIDAK
 * berubah di M129 — beda dengan locations yang jadi per-kota).
 * created_by: acak dari users.user_id nyata, sama seperti seed lokasi.
 *
 * PEMAKAIAN: node scripts/seed-missing-facilities-2026-08.js [--dry-run]
 */
'use strict';

require('dotenv').config();
const { Facility, User } = require('../models');

const DRY_RUN = process.argv.includes('--dry-run');

const NEW_FACILITIES = [
  {
    name: 'CLUB HOUSE',
    description: 'Fasilitas komunitas terpusat di kompleks perumahan/apartemen (biasanya berisi kolam renang, gym, ruang serbaguna)',
    icon: '🏛️',
    keywords: ['club house', 'clubhouse', 'club-house'],
  },
  {
    name: 'AMPHITHEATER',
    description: 'Area pertunjukan/berkumpul terbuka bertingkat di kawasan perumahan/apartemen',
    icon: '🎭',
    keywords: ['amphiteather', 'amphitheater', 'amfiteater', 'amphitheatre'],
  },
  {
    name: 'BASKETBALL COURT',
    description: 'Lapangan basket di kawasan perumahan/apartemen',
    icon: '🏀',
    keywords: ['lapangan basket', 'basketball court', 'basket court', 'sport center'],
  },
  {
    name: 'FOODHALL',
    description: 'Area kuliner terpusat berisi banyak tenant makanan di kawasan/mal komersial properti',
    icon: '🍽️',
    keywords: ['foodhall', 'food hall', 'pujasera', 'food court kawasan'],
  },
  {
    name: 'JOGGING TRACK',
    description: 'Jalur khusus lari/jalan kaki di kawasan perumahan/apartemen',
    icon: '🏃',
    keywords: ['jogging track', 'jalur lari', 'running track', 'lintasan lari'],
  },
  {
    name: 'ACCESS CARD',
    description: 'Kartu akses masuk kawasan/gedung (sistem keamanan berbasis kartu, biasa disebut bareng one gate system)',
    icon: '💳',
    keywords: ['kartu akses', 'access card', 'access keycard', 'kartu kompleks'],
  },
  {
    name: 'COMMUNITY ROOM',
    description: 'Ruang komunitas/serbaguna untuk kegiatan warga penghuni',
    icon: '🏢',
    keywords: ['ruang komunitas', 'community room', 'ruang serbaguna warga'],
  },
];

function _generateFacilityId(name, total) {
  const prefix = String(name || 'FA').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase().padEnd(2, 'X');
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
  console.log(`\n=== seed-missing-facilities-2026-08.js ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  const users = await User.findAll({ attributes: ['user_id'], raw: true });
  if (!users.length) throw new Error('Tabel users kosong — tidak ada user_id untuk created_by.');
  const userIds = users.map((u) => u.user_id);
  const randomUserId = () => userIds[Math.floor(Math.random() * userIds.length)];

  let total = await Facility.count();
  let inserted = 0, skipped = 0;

  for (const fac of NEW_FACILITIES) {
    const existing = await Facility.findOne({ where: { name: fac.name } });
    if (existing) { console.log(`  SKIP (sudah ada): ${fac.name}`); skipped++; continue; }

    total++;
    const createdBy = randomUserId();
    console.log(`  + ${fac.name} (created_by=${createdBy})`);
    if (!DRY_RUN) {
      await Facility.create({
        facility_id: _generateFacilityId(fac.name, total),
        name: fac.name,
        description: fac.description,
        icon: fac.icon,
        keywords: fac.keywords,
        status: 1,
        created_date: _todayDate(),
        created_by: createdBy,
      });
    }
    inserted++;
  }

  console.log(`\n=== RINGKASAN ===`);
  console.log(`  Baru di-insert   : ${inserted}`);
  console.log(`  Sudah ada (skip) : ${skipped}`);
  if (DRY_RUN) console.log('\n  (DRY RUN — tidak ada perubahan ditulis ke DB.)');

  process.exit(0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

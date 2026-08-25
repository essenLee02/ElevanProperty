'use strict';
/**
 * seed-developer-properties.js — master developer/brand agensi + pemetaan agent (M138)
 *
 * Mengisi tabel `developer_properties` dengan brand agensi properti NYATA yang
 * beroperasi di Indonesia, lalu memetakan setiap user ke salah satunya lewat
 * `users.developer_property_id`.
 *
 * Pemetaan EKSPLISIT (permintaan pemilik proyek):
 *   NATASHA AUWLIANDY (tasha)  → BRIGHTON
 *   LEO FELIX                   → XAVIER MARKS
 *   NIGEL KUNCORO               → PROPMATCHES
 *   user lainnya                → acak dari daftar brand
 *
 * ⚠️ IDEMPOTEN: aman dijalankan berulang. Brand yang sudah ada TIDAK
 * diduplikasi (dicocokkan via GeneralController.normalizeName), dan user yang
 * SUDAH punya developer_property_id TIDAK ditimpa kecuali `--force`.
 * Tanpa sifat ini, menjalankan ulang skrip akan mengacak ulang pemetaan agent
 * yang mungkin sudah dirapikan manual lewat UI.
 *
 * Usage:
 *   node scripts/seed-developer-properties.js          # seed + map yang kosong
 *   node scripts/seed-developer-properties.js --dry    # tampilkan rencana saja
 *   node scripts/seed-developer-properties.js --force  # timpa pemetaan lama juga
 */
require('dotenv').config();
const { DeveloperProperty, User } = require('../models');
const GeneralController = require('../controllers/GeneralController');

const DRY   = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');
const TODAY = GeneralController.todayDate();

/** Brand agensi/brokerage NYATA yang beroperasi di Indonesia. */
const BRANDS = [
  'RAY WHITE',
  'ERA PROPERTY',
  'XAVIER MARKS',
  'GALAXY PROPERTY',
  'BRIGHTON',
  'PROPNEX',
  'PROPMATCHES',
];

/** Pemetaan wajib: username → nama brand. */
const EXPLICIT_BY_USERNAME = {
  tasha:    'BRIGHTON',
  leon123:  'XAVIER MARKS',
  nigel123: 'PROPMATCHES',
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function main() {
  console.log('═'.repeat(70));
  console.log(`  🌱  SEED DEVELOPER PROPERTIES ${DRY ? '(DRY RUN)' : ''}${FORCE ? ' [FORCE]' : ''}`);
  console.log('═'.repeat(70));

  // Pembuat baris master: pakai admin/user pertama yang ada, JANGAN hardcode
  // string placeholder — created_by adalah FK informasional ke users.user_id,
  // dan baris dengan pemilik palsu sudah pernah jadi masalah data di M129.
  const owner = await User.findOne({ where: { username: 'nigel123' }, raw: true })
             || await User.findOne({ raw: true });
  if (!owner) throw new Error('Tidak ada user sama sekali — seed user dulu.');
  const ownerId = owner.user_id;
  console.log(`\n[1/3] created_by = ${ownerId} (${owner.name})`);

  /* ── Brand master ─────────────────────────────────────────────────────── */
  console.log('\n[2/3] Memastikan brand master ada...');
  const existing = await DeveloperProperty.findAll({ raw: true });
  const byNorm = new Map(existing.map(r => [GeneralController.normalizeName(r.name), r]));
  const idByName = new Map();
  let total = existing.length;

  for (const brand of BRANDS) {
    const norm = GeneralController.normalizeName(brand);
    const hit = byNorm.get(norm);
    if (hit) {
      idByName.set(brand, hit.developer_property_id);
      console.log(`   = ${brand.padEnd(18)} sudah ada (${hit.developer_property_id})`);
      continue;
    }

    const id = GeneralController.generateRandomId(brand, total).toUpperCase();
    total++;
    if (!DRY) {
      await DeveloperProperty.create({
        developer_property_id: id,
        name: brand,
        status: 1,
        created_date: TODAY,
        created_by: ownerId,
        updated_date: null,
        updated_by: null,
      });
    }
    idByName.set(brand, id);
    console.log(`   + ${brand.padEnd(18)} DIBUAT (${id})`);
  }

  /* ── Pemetaan user ────────────────────────────────────────────────────── */
  console.log('\n[3/3] Memetakan users.developer_property_id...');
  const users = await User.findAll({ order: [['id', 'ASC']] });
  let mapped = 0, skipped = 0;

  for (const u of users) {
    if (u.developer_property_id && !FORCE) {
      console.log(`   · ${u.name.padEnd(24)} SUDAH dipetakan (${u.developer_property_id}) — dilewati`);
      skipped++;
      continue;
    }

    const explicitBrand = EXPLICIT_BY_USERNAME[u.username];
    const brand = explicitBrand || pick(BRANDS);
    const devId = idByName.get(brand);
    if (!devId) { console.warn(`   ⚠️ brand "${brand}" tidak punya id — dilewati`); continue; }

    if (!DRY) {
      await u.update({
        developer_property_id: devId,
        updated_date: new Date(),
        update_by: 'seed-developer-properties',
      });
    }
    const tag = explicitBrand ? 'EKSPLISIT' : 'acak';
    console.log(`   → ${u.name.padEnd(24)} ${brand.padEnd(18)} (${devId}) [${tag}]`);
    mapped++;
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`  ✅ SELESAI — ${mapped} user dipetakan, ${skipped} dilewati${DRY ? ' (DRY, tidak disimpan)' : ''}`);
  console.log('═'.repeat(70) + '\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error('\n❌ SEED ERROR:', e); process.exit(1); });

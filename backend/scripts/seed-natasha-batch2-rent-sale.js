'use strict';
/**
 * seed-natasha-batch2-rent-sale.js — BATCH 2 untuk agent Natasha (M135)
 * ---------------------------------------------------------------------------
 * Melengkapi seed-natasha-agent-2026-08.js (batch 1 = 521 properti, SEMUA Sale).
 * Batch ini menambah ±521 properti lagi yang mencakup **JUAL DAN SEWA**, di
 * area-area BARU yang belum ada di tabel `locations`.
 *
 *   Surabaya : 120 rumah + 90 apartemen  (210)
 *   Sidoarjo : 120 rumah + 73 apartemen  (193)
 *   Gresik    :  50 rumah + 68 apartemen  (118)
 *   TOTAL     : 521  → gabungan dengan batch 1 ≈ 1.042 properti
 *
 * ⚠️ PERUBAHAN PROFIL AGENT (keputusan pemilik proyek 24 Agu 2026):
 * Natasha diubah dari trans_type='Sale'/payment_type='KPR' menjadi
 * trans_type='Both'/payment_type='Both'. WAJIB, bukan pilihan gaya:
 * `utils/agentScopeGuard.js` (M90) MEMBLOKIR pertanyaan sewa sebelum AI
 * dipanggil bila agent hanya melayani Sale — listing sewa yang di-seed akan
 * jadi data mati yang tidak pernah bisa direkomendasikan. Aturan
 * `utils/userBusinessRules.js` memaksa Both→payment_type 'Both' (KPR tetap
 * tercakup di dalamnya, jadi alur KPR tidak hilang).
 *
 * ⚠️ ATURAN MODEL YANG DIPATUHI (bukan asumsi — lihat hook validate):
 *   • Property.certificate_type: untuk transaction_type='Rent' HANYA boleh
 *     null/KOSONG/LAINNYA. SHM/SHGB/SHSRS EKSKLUSIF untuk Sale
 *     (CERTIFICATE_TYPES_BY_TX di models/Property.js).
 *   • Location.location_type='area' WAJIB punya city_id.
 *   • Location unique per (name, city_id) — nama sama boleh di kota berbeda.
 *   • kpr_status 'Y' hanya masuk akal untuk Sale (sewa tidak dibiayai KPR).
 *
 * Nama area SEMUANYA kecamatan/kawasan/perumahan NYATA di masing-masing kota —
 * TIDAK ADA yang dikarang. Disiplin yang sama dengan M129: menolak memfabrikasi
 * nama lokasi hanya untuk mengejar jumlah.
 *
 * Usage: node scripts/seed-natasha-batch2-rent-sale.js [--dry]
 */
require('dotenv').config();
const {
  User, Property, PropertyFacility, PropertyImage, PropertyLocation,
  Facility, Location, City,
} = require('../models');
const GeneralController = require('../controllers/GeneralController');
const { validateUserBusinessFields } = require('../utils/userBusinessRules');
const { resolveBudgetTierRange } = require('../services/propertyRecommendationService');
const { clearAgentCoverageCache } = require('../services/agentCoverageService');

const DRY = process.argv.includes('--dry');
const TODAY = GeneralController.todayDate();

/* ══════════════════════════════════════════════════════════════════════════
   1) AREA BARU — kecamatan/kawasan/perumahan NYATA yang belum ada di DB
══════════════════════════════════════════════════════════════════════════ */
const NEW_AREAS = {
  Surabaya: [
    // Kecamatan nyata Surabaya yang belum terdaftar
    { name: 'Tambaksari',        premium: false },
    { name: 'Sawahan',           premium: false },
    { name: 'Tegalsari',         premium: false },
    { name: 'Genteng',           premium: true  },
    { name: 'Bubutan',           premium: false },
    { name: 'Krembangan',        premium: false },
    { name: 'Simokerto',         premium: false },
    { name: 'Kenjeran',          premium: false },
    { name: 'Bulak',             premium: false },
    { name: 'Asemrowo',          premium: false },
    { name: 'Pabean Cantian',    premium: false },
    { name: 'Wonocolo',          premium: false },
    { name: 'Karang Pilang',     premium: false },
    { name: 'Jambangan',         premium: false },
    { name: 'Gayungan',          premium: false },
    { name: 'Dukuh Menanggal',   premium: false },
    { name: 'Sambikerep',        premium: false },
    { name: 'Pakal',             premium: false },
    { name: 'Sukomanunggal',     premium: false },
    // Kawasan perumahan nyata Surabaya Barat/Timur
    { name: 'Graha Family',      premium: true  },
    { name: 'Bukit Darmo Golf',  premium: true  },
    { name: 'Darmo Permai',      premium: true  },
    { name: 'Darmo Satelit',     premium: true  },
    { name: 'Dharmahusada',      premium: true  },
    { name: 'Kalijudan',         premium: false },
    { name: 'Medokan Ayu',       premium: false },
    { name: 'Penjaringan Sari',  premium: false },
    { name: 'Kutisari',          premium: false },
    { name: 'Siwalankerto',      premium: false },
    { name: 'Rungkut Menanggal', premium: false },
  ],
  Sidoarjo: [
    { name: 'Sedati',            premium: false },
    { name: 'Jabon',             premium: false },
    { name: 'Prambon',           premium: false },
    { name: 'Wonoayu',           premium: false },
    { name: 'Balongbendo',       premium: false },
    { name: 'Tarik',             premium: false },
    { name: 'Krembung',          premium: false },
    { name: 'Sidoarjo Kota',     premium: true  },
    { name: 'Sepanjang',         premium: false },
    { name: 'Suko',              premium: false },
    { name: 'Bluru Kidul',       premium: false },
    { name: 'Banjarkemantren',   premium: false },
    { name: 'Ketajen',           premium: false },
    // Perumahan nyata Sidoarjo
    { name: 'Pondok Jati',       premium: true  },
    { name: 'Pondok Candra',     premium: true  },
    { name: 'Delta Sari Indah',  premium: true  },
    { name: 'Kahuripan Nirwana', premium: true  },
    { name: 'Rewwin',            premium: false },
    { name: 'Wisma Tropodo',     premium: false },
    { name: 'Puri Indah Sidoarjo', premium: false },
  ],
  Gresik: [
    // ⭐ Jalan Veteran — jalan utama Gresik, DISEBUT EKSPLISIT di skenario uji
    // percakapan pemilik proyek ("Badget 2.1-2.4 juta/bulan, di jalan Veteran").
    { name: 'Veteran',           premium: false },
    { name: 'Randuagung',        premium: false },
    { name: 'Sidomoro',          premium: false },
    { name: 'Sukomulyo',         premium: false },
    { name: 'Roomo',             premium: false },
    { name: 'Bunder',            premium: false },
    { name: 'Segoromadu',        premium: false },
    { name: 'Suci',              premium: false },
    { name: 'Prambangan',        premium: false },
    { name: 'Ngipik',            premium: false },
    // Kecamatan nyata Gresik
    { name: 'Sidayu',            premium: false },
    { name: 'Bungah',            premium: false },
    { name: 'Panceng',           premium: false },
    { name: 'Ujungpangkah',      premium: false },
    { name: 'Dukun',             premium: false },
    { name: 'Balongpanggang',    premium: false },
    { name: 'Benjeng',           premium: false },
    { name: 'Kedamean',          premium: false },
    { name: 'Sangkapura',        premium: false },
    { name: 'Tambak',            premium: false },
    // Perumahan nyata Gresik
    { name: 'Perumnas GKB',      premium: false },
    { name: 'Green Garden Gresik', premium: true },
    { name: 'Bukit Randuagung',  premium: false },
  ],
};

const CITY_COUNTS = {
  Surabaya: { house: 120, apartment: 90 },
  Sidoarjo: { house: 120, apartment: 73 },
  Gresik:   { house: 50,  apartment: 68 },
};

/** Porsi SEWA per kota/tipe. Sisanya Sale. */
const RENT_SHARE = 0.5;

/* ══════════════════════════════════════════════════════════════════════════
   2) HELPERS
══════════════════════════════════════════════════════════════════════════ */
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function pickN(a, n) {
  const p = [...a]; const o = [];
  n = Math.min(n, p.length);
  for (let i = 0; i < n; i++) o.push(p.splice(Math.floor(Math.random() * p.length), 1)[0]);
  return o;
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function roundNice(v) {
  const step = v >= 1e9 ? 50_000_000 : v >= 1e8 ? 5_000_000 : v >= 1e6 ? 100_000 : 10_000;
  return Math.round(v / step) * step;
}
function weightedTier(premium) {
  const r = Math.random();
  if (premium) return r < 0.20 ? 'terjangkau' : r < 0.70 ? 'menengah' : 'eksklusif';
  return r < 0.55 ? 'terjangkau' : r < 0.88 ? 'menengah' : 'eksklusif';
}

const FACILITY_POOL = {
  house: ['AC', 'CARPORT', 'GARDEN', 'KITCHEN SET', 'SECURITY', 'WATER HEATER', 'CCTV 24 JAM', 'PLN ELECTRICITY', 'GARAGE'],
  apartment: ['AC', 'GYM', 'YOGA', 'KOLAM RENANG', 'SWIMMING POOL', 'LIFT', 'SECURITY', 'WI-FI', 'PARKING', 'CCTV 24 JAM', 'MINIMARKET'],
};
const IMAGE_URL = {
  house: '/assets/image_data/properties/house.png',
  apartment: '/assets/image_data/properties/apartment.png',
};

/**
 * certificate_type yang SAH untuk kombinasi tipe+transaksi.
 * ⛔ Rent HANYA null/KOSONG/LAINNYA — hook validate() Property.js akan menolak
 * SHM/SHGB/SHSRS pada sewa. Ini alasan batch 1 (semua Sale) tidak menemui
 * masalah ini sama sekali.
 */
function certificateFor(buildingType, tx) {
  if (tx === 'rent') return Math.random() < 0.5 ? null : pick(['KOSONG', 'LAINNYA']);
  if (buildingType === 'house') {
    const r = Math.random();
    return r < 0.70 ? 'SHM' : r < 0.95 ? 'SHGB' : 'LAINNYA';
  }
  const r = Math.random();
  return r < 0.50 ? 'SHGB' : r < 0.90 ? 'SHSRS' : 'LAINNYA';
}

/** price_type sesuai tipe + transaksi (period budget-tier: house/year, apt/month). */
function priceTypeFor(buildingType, tx) {
  if (tx === 'sale') return pick(['Cash', 'Negotiable']);
  return buildingType === 'house' ? 'Yearly' : 'Monthly';
}

/* ══════════════════════════════════════════════════════════════════════════
   3) MAIN
══════════════════════════════════════════════════════════════════════════ */
async function upgradeNatashaToBoth() {
  const user = await User.findOne({ where: { username: 'tasha' } });
  if (!user) throw new Error('Agent "tasha" tidak ditemukan — jalankan seed-natasha-agent-2026-08.js dulu.');

  if (user.trans_type === 'Both' && user.payment_type === 'Both') {
    console.log(`  ↪ Sudah Both/Both — tidak diubah (${user.user_id}).`);
    return user.user_id;
  }

  const business = validateUserBusinessFields(
    { trans_type: 'Both', payment_type: 'Both', ai_primary: user.ai_primary },
    user.toJSON()
  );
  if (!business.ok) throw new Error(`validateUserBusinessFields menolak: ${business.error}`);

  console.log(`  ↪ ${user.trans_type}/${user.payment_type} → ${business.values.trans_type}/${business.values.payment_type}`
    + `${DRY ? '  [DRY, tidak disimpan]' : ''}`);
  if (!DRY) {
    await user.update({ ...business.values, updated_date: new Date(), update_by: 'seed-batch2' });
  }
  return user.user_id;
}

async function ensureNewAreas(cityRows, agentId) {
  const map = new Map();
  let total = await Location.count();

  for (const [cityLabel, areas] of Object.entries(NEW_AREAS)) {
    const city = cityRows[cityLabel];
    const existing = await Location.findAll({ where: { city_id: city.city_id }, raw: true });
    const byName = new Map(existing.map((r) => [r.name.toLowerCase(), r]));
    let added = 0;

    for (const { name } of areas) {
      const hit = byName.get(name.toLowerCase());
      if (hit) { map.set(`${cityLabel}|${name}`, hit.location_id); continue; }

      const id = GeneralController.generateRandomId(name, total).toUpperCase();
      total++;
      if (!DRY) {
        await Location.create({
          location_id: id, name, city_id: city.city_id, location_type: 'area',
          status: 1, created_date: TODAY, created_by: agentId, updated_date: null, updated_by: null,
        });
      }
      map.set(`${cityLabel}|${name}`, id);
      added++;
    }
    console.log(`  ${cityLabel}: +${added} area baru (dari ${areas.length} dalam daftar)`);
  }
  return map;
}

async function main() {
  console.log('═'.repeat(70));
  console.log(`  🌱  SEED NATASHA BATCH 2 — JUAL + SEWA ${DRY ? '(DRY RUN)' : ''}`);
  console.log('═'.repeat(70));

  console.log('\n[1/5] Profil agent → Both/Both (wajib agar listing sewa terjangkau AI)...');
  const agentId = await upgradeNatashaToBoth();

  const cityRows = {};
  for (const label of ['Surabaya', 'Sidoarjo', 'Gresik']) {
    const row = await City.findOne({ where: { name: label.toUpperCase() }, raw: true });
    if (!row) throw new Error(`Kota ${label} tidak ditemukan`);
    cityRows[label] = row;
  }

  console.log('\n[2/5] Menambah area BARU ke tabel locations...');
  const locationMap = await ensureNewAreas(cityRows, agentId);

  console.log('\n[3/5] Memuat fasilitas & landmark...');
  const facRowsAll = await Facility.findAll({ where: { status: 1 }, attributes: ['facility_id', 'name'], raw: true });
  const facByName = new Map();
  for (const f of facRowsAll) {
    const k = f.name.toUpperCase();
    if (!facByName.has(k)) facByName.set(k, f.facility_id);
  }
  const facilityIds = (names) => names.map((n) => facByName.get(n.toUpperCase())).filter(Boolean);

  const landmarksByCity = {};
  for (const label of ['Surabaya', 'Sidoarjo', 'Gresik']) {
    const rows = await Location.findAll({
      where: { city_id: cityRows[label].city_id, location_type: ['landmark', 'commercial'] },
      attributes: ['location_id'], raw: true,
    });
    landmarksByCity[label] = rows.map((r) => r.location_id);
  }

  console.log('\n[4/5] Membangun rencana (jual + sewa)...');
  const plan = [];
  for (const [cityLabel, counts] of Object.entries(CITY_COUNTS)) {
    const areas = NEW_AREAS[cityLabel];
    for (const [buildingType, qty] of Object.entries(counts)) {
      const rentCount = Math.round(qty * RENT_SHARE);
      for (let i = 0; i < qty; i++) {
        plan.push({ cityLabel, buildingType, area: pick(areas), tx: i < rentCount ? 'rent' : 'sale' });
      }
    }
  }

  // ⭐ Jaminan skenario uji: apartemen SEWA di Veteran, Gresik, pada rentang
  // 2,1-2,4 juta/bulan (angka persis dari transkrip skenario pemilik proyek).
  const veteranSlots = plan.filter((p) => p.cityLabel === 'Gresik' && p.buildingType === 'apartment' && p.tx === 'rent').slice(0, 4);
  veteranSlots.forEach((p) => { p.area = NEW_AREAS.Gresik.find((a) => a.name === 'Veteran'); p.forcePrice = randInt(2_100_000, 2_400_000); });
  console.log(`   ⭐ ${veteranSlots.length} apartemen sewa Veteran/Gresik dipaksa ke 2,1-2,4 jt/bulan (skenario uji)`);

  const summary = {};
  plan.forEach((p) => { const k = `${p.cityLabel}/${p.buildingType}/${p.tx}`; summary[k] = (summary[k] || 0) + 1; });
  console.log(`   Total: ${plan.length}`);
  Object.entries(summary).sort().forEach(([k, v]) => console.log(`     ${k.padEnd(30)} ${v}`));

  if (DRY) { console.log('\n--dry aktif — tidak menulis ke DB.'); return; }

  let baseCount = await Property.count();
  const propRows = [], facRows = [], imgRows = [], locRows = [];

  for (const item of plan) {
    const { cityLabel, buildingType, area, tx, forcePrice } = item;
    const city = cityRows[cityLabel];
    const tier = weightedTier(area.premium);
    const range = resolveBudgetTierRange(buildingType, tx, tier, '');
    if (!range) { console.warn(`  ⚠️ tier hilang: ${buildingType}/${tx}/${tier} — skip`); continue; }
    const price = forcePrice || roundNice(randInt(range.min, range.max));

    const typeLabel = buildingType === 'house' ? 'House' : 'Apartment';
    const txLabel = tx === 'rent' ? 'Rent' : 'Sale';
    const txWordId = tx === 'rent' ? 'disewakan' : 'dijual';
    const title = `${area.name} ${typeLabel} ${txLabel} ${cityLabel}`.substring(0, 100);

    const property_id = GeneralController.generateRandomId(title, baseCount);
    baseCount++;

    const isApt = buildingType === 'apartment';
    const bedrooms = isApt ? randInt(1, 3) : randInt(2, 5);
    const bathrooms = randInt(1, Math.max(1, bedrooms));

    propRows.push({
      property_id,
      city_id: city.city_id,
      province_id: city.province_id,
      country_id: city.country_id,
      user_id: agentId,
      title,
      description: `${typeLabel} ${txWordId} di kawasan ${area.name}, ${cityLabel}. Lingkungan strategis, siap huni.`,
      price,
      price_type: priceTypeFor(buildingType, tx),
      address: `Jl. ${area.name} No. ${randInt(1, 99)}, ${cityLabel}`,
      area: area.name,
      district: null,
      postal_code: String(randInt(60000, 61500)),
      // Sewa hampir selalu menyebut status furnish (relevan bagi penyewa);
      // jual sering tidak. Mengikuti pola batch 1.
      furnished_status: tx === 'rent' ? pick(['Full Furnished', 'Semi Furnished', 'Unfurnished'])
        : (isApt ? pick(['Semi Furnished', 'Unfurnished', null]) : null),
      bed_rooms: bedrooms,
      bath_rooms: bathrooms,
      electricity_capacity: pick([1300, 2200, 3500, 4400, 6600]),
      building_area: `${randInt(isApt ? 28 : 60, isApt ? 140 : 350)} m2`,
      land_area: isApt ? null : `${randInt(72, 400)} m2`,
      floor_location: isApt ? `Lantai ${randInt(2, 25)}` : null,
      floor_quantity: isApt ? null : randInt(1, 2),
      kpr_status: tx === 'sale' ? 'Y' : 'N',   // sewa tidak dibiayai KPR
      certificate_type: certificateFor(buildingType, tx),
      building_type: buildingType,
      transaction_type: txLabel,
      status: 1,
      created_date: TODAY,
      created_by: agentId,
      updated_date: null,
      updated_by: null,
    });

    for (const fid of facilityIds(pickN(FACILITY_POOL[buildingType], randInt(4, 7)))) {
      facRows.push({ property_id, facility_id: fid, facility_qty: null, created_date: TODAY, created_by: agentId, updated_date: null, updated_by: null });
    }

    imgRows.push({ property_id, name: `${typeLabel} Main Image`, url: IMAGE_URL[buildingType] });

    const own = locationMap.get(`${cityLabel}|${area.name}`);
    const ids = own ? [own] : [];
    const lm = landmarksByCity[cityLabel];
    if (lm.length && Math.random() < 0.6) ids.push(pick(lm));
    for (const lid of ids) {
      locRows.push({ property_id, location_id: lid, created_date: new Date(), created_by: agentId, updated_date: null, updated_by: null });
    }
  }

  const chunk = (a, n) => { const r = []; for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i + n)); return r; };
  console.log(`\n[5/5] Menulis ke DB...`);
  console.log(`  [1/4] ${propRows.length} properties...`);
  for (const b of chunk(propRows, 100)) await Property.bulkCreate(b, { ignoreDuplicates: true });
  console.log(`  [2/4] ${facRows.length} property_facilities...`);
  for (const b of chunk(facRows, 500)) await PropertyFacility.bulkCreate(b, { ignoreDuplicates: true });
  console.log(`  [3/4] ${imgRows.length} property_images...`);
  for (const b of chunk(imgRows, 500)) await PropertyImage.bulkCreate(b, { ignoreDuplicates: true });
  console.log(`  [4/4] ${locRows.length} property_locations...`);
  for (const b of chunk(locRows, 500)) await PropertyLocation.bulkCreate(b, { ignoreDuplicates: true });

  clearAgentCoverageCache();   // coverage lama sudah basi setelah seed

  console.log('\n' + '═'.repeat(70));
  console.log(`  ✅ BATCH 2 SELESAI — ${propRows.length} properti (jual + sewa) untuk ${agentId}`);
  console.log('═'.repeat(70) + '\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error('\n❌ SEED ERROR:', e); process.exit(1); });

'use strict';
/**
 * seed-leo-felix-properties.js
 * ---------------------------------------------------------------------------
 * Seed 336 properti baru untuk agent LEO FELIX (user_id LFGKT49002) di 4 kota:
 *
 *   Surabaya : 20 hotel, 7 villa, 20 rumah, 16 apartemen   (63)
 *   Kediri   : 10 hotel, 7 villa, 20 rumah, 20 apartemen   (57)
 *   Bali     : 70 hotel, 20 villa, 9 rumah, 30 apartemen   (129) — disebar ke 16 kota/kab Bali
 *   Jakarta  : 40 hotel, 8 villa, 9 rumah, 30 apartemen    (87) — semua di Jakarta Selatan
 *
 * Populates: properties, property_facilities, property_images, property_locations
 * (lihat models/Property.js, PropertyFacility.js, PropertyImage.js, PropertyLocation.js).
 *
 * Harga dihasilkan lewat resolveBudgetTierRange() (propertyRecommendationService) —
 * SAMA PERSIS dengan tabel _BUDGET_TIERS yang dipakai filter katalog live, sehingga
 * data seed ini otomatis konsisten dengan budget tier "terjangkau/menengah/eksklusif"
 * dan langsung berguna untuk menguji alur rekomendasi Q1-Q12.
 *
 * ASUMSI (tidak diminta eksplisit oleh user, didesain agar realistis + berguna utk
 * pengujian budget-tier & price_type periode ganda):
 *   - hotel & villa : 100% Rent (booking). hotel: night 85% / kontrak tahunan 15%.
 *                     villa: night 60% / sewa bulanan 40%.
 *   - rumah (house) : 55% Sale / 45% Rent (kontrak tahunan — sesuai _BUDGET_TIERS.house).
 *   - apartemen     : 50% Sale / 50% Rent (bulanan — sesuai _BUDGET_TIERS.apartment).
 *   - tier campuran : 45% terjangkau, 35% menengah, 20% eksklusif per properti.
 *
 * Usage: node scripts/seed-leo-felix-properties.js
 *   --dry     Hanya tampilkan ringkasan rencana insert, tidak menulis ke DB.
 */
require('dotenv').config();
const { Op } = require('sequelize');
const { Property, PropertyFacility, PropertyImage, PropertyLocation,
        Facility, Location, City, Province, Country, User } = require('../models');
const GeneralController = require('../controllers/GeneralController');
const { resolveBudgetTierRange } = require('../services/propertyRecommendationService');

const DRY = process.argv.includes('--dry');
const TODAY = GeneralController.todayDate();
const AGENT_ID = 'LFGKT49002'; // LEO FELIX — user_id & created_by (agent adds own listings)

/* ══════════════════════════════════════════════════════════════════════════
   1) SPESIFIKASI KOTA + JUMLAH PER TIPE (persis permintaan user)
══════════════════════════════════════════════════════════════════════════ */
// Nama percakapan ID → building_type kanonik DB.
const TYPE_MAP = { hotel: 'hotel', villa: 'villa', rumah: 'house', apartemen: 'apartment' };

const CITY_COUNTS = {
  Surabaya: { hotel: 20, villa: 7, rumah: 20, apartemen: 16 },
  Kediri:   { hotel: 10, villa: 7, rumah: 20, apartemen: 20 },
  Bali:     { hotel: 70, villa: 20, rumah: 9, apartemen: 30 },   // disebar ke 16 kota Bali
  Jakarta:  { hotel: 40, villa: 8, rumah: 9, apartemen: 30 },    // semua di Jakarta Selatan
};

/* ══════════════════════════════════════════════════════════════════════════
   2) TABEL VARIASI KONTEN (judul, fitur lokasi, fasilitas kurasi per tipe)
══════════════════════════════════════════════════════════════════════════ */
const FEATURES = [
  'Near Market', 'Near Mall', 'Near Airport', 'Near Beach', 'Near Campus',
  'Near School', 'Green Zone', 'Business District', 'Suburban Area',
  'Tourism Area', 'City Center', 'Near Hospital', 'Heritage Zone', 'Near Beach Resort',
];
const TYPE_LABEL = { hotel: 'Hotel', villa: 'Villa', house: 'House', apartment: 'Apartment' };

// Fasilitas kurasi per tipe (nama kanonik DB) — 4-7 dipilih acak per properti.
const FACILITY_POOL = {
  hotel:     ['AC', 'WI-FI', 'SECURITY', 'SWIMMING POOL', 'BREAKFAST', 'MEETING ROOM',
              'ROOM SERVICE', 'SPA', 'RESTAURANT', 'CONCIERGE', 'GYM', 'CCTV'],
  villa:     ['AC', 'WI-FI', 'PRIVATE POOL', 'KOLAM RENANG', 'GARDEN', 'SECURITY',
              'CARPORT', 'JACUZZI', 'BALCONY', 'WASHING MACHINE'],
  house:     ['AC', 'GARAGE', 'CARPORT', 'GARDEN', 'KITCHEN SET', 'SECURITY',
              'WATER HEATER', 'MUSHOLA', 'CCTV 24 JAM'],
  apartment: ['AC', 'GYM', 'YOGA', 'KOLAM RENANG', 'LIFT', 'SECURITY', 'WI-FI',
              'PARKING', 'BALCONY', 'PILATES STATION', 'CCTV 24 JAM'],
};

const IMAGE_URL = {
  hotel: '/assets/image_data/properties/hotel.png',
  villa: '/assets/image_data/properties/villa.png',
  house: '/assets/image_data/properties/house.png',
  apartment: '/assets/image_data/properties/apartment.png',
};

/* ══════════════════════════════════════════════════════════════════════════
   3) HELPERS
══════════════════════════════════════════════════════════════════════════ */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const pool = [...arr];
  const out = [];
  n = Math.min(n, pool.length);
  for (let i = 0; i < n; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function weightedTier() {
  const r = Math.random();
  return r < 0.45 ? 'terjangkau' : r < 0.80 ? 'menengah' : 'eksklusif';
}
/** Bulatkan ke kelipatan yang wajar (100rb utk nilai kecil, 1jt utk besar) agar tidak "acak digit". */
function roundNice(v) {
  const step = v >= 1e9 ? 50_000_000 : v >= 1e6 ? 100_000 : 10_000;
  return Math.round(v / step) * step;
}

/**
 * Tentukan transactionType + period-hint + price_type utk satu properti,
 * mengikuti asumsi distribusi di header file. Mengembalikan {tx, periodHint, priceType}.
 */
function decideTxAndPeriod(buildingType) {
  if (buildingType === 'hotel') {
    const longStay = Math.random() < 0.15;
    return longStay
      ? { tx: 'rent', periodHint: 'year', priceType: 'Yearly' }
      : { tx: 'rent', periodHint: '',     priceType: pick(['Night', 'Daily']) };
  }
  if (buildingType === 'villa') {
    const monthly = Math.random() < 0.40;
    return monthly
      ? { tx: 'rent', periodHint: 'month', priceType: 'Monthly' }
      : { tx: 'rent', periodHint: '',      priceType: pick(['Night', 'Daily']) };
  }
  if (buildingType === 'house') {
    const sale = Math.random() < 0.55;
    return sale
      ? { tx: 'sale', periodHint: '', priceType: pick(['Cash', 'Negotiable']) }
      : { tx: 'rent', periodHint: '', priceType: 'Yearly' }; // house rent = kontrak tahunan (period 'year' fixed)
  }
  // apartment
  const sale = Math.random() < 0.50;
  return sale
    ? { tx: 'sale', periodHint: '', priceType: pick(['Cash', 'Negotiable']) }
    : { tx: 'rent', periodHint: '', priceType: 'Monthly' }; // apartment rent = bulanan (period 'month' fixed)
}

/** Distribusi round-robin: bagi `count` slot ke daftar `items` (mis. 16 kota Bali). */
function roundRobin(count, items) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(items[i % items.length]);
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   4) MAIN
══════════════════════════════════════════════════════════════════════════ */
async function main() {
  console.log('═'.repeat(64));
  console.log(`  🌱  SEED PROPERTI LEO FELIX ${DRY ? '(DRY RUN)' : ''}`);
  console.log('═'.repeat(64));

  const agent = await User.findOne({ where: { user_id: AGENT_ID } });
  if (!agent) throw new Error(`Agent ${AGENT_ID} (LEO FELIX) tidak ditemukan`);

  const country = await Country.findOne({ where: { name: 'INDONESIA' } });
  if (!country) throw new Error('Negara INDONESIA tidak ditemukan');

  // Resolve kota target.
  const [surabaya] = await City.findAll({ where: { name: 'SURABAYA' }, raw: true });
  const [kediri]   = await City.findAll({ where: { name: 'KEDIRI' },   raw: true });
  const [jaksel]   = await City.findAll({ where: { name: 'JAKARTA SELATAN' }, raw: true });
  const baliProv   = await Province.findOne({ where: { name: 'BALI' }, raw: true });
  if (!surabaya || !kediri || !jaksel || !baliProv) {
    throw new Error('Salah satu kota/provinsi target (Surabaya/Kediri/Jakarta Selatan/Bali) tidak ditemukan');
  }
  const baliCities = await City.findAll({ where: { province_id: baliProv.province_id }, raw: true });
  if (!baliCities.length) throw new Error('Tidak ada kota di bawah provinsi Bali');

  // Load facility_id per nama (ambil yang pertama bila ada duplikat nama).
  const facilityRows = await Facility.findAll({ where: { status: 1 }, attributes: ['facility_id', 'name'], raw: true });
  const facilityIdByName = new Map();
  for (const f of facilityRows) {
    const key = f.name.toUpperCase();
    if (!facilityIdByName.has(key)) facilityIdByName.set(key, f.facility_id);
  }
  const missingFacility = new Set();
  const facilityIds = (names) => names.map((n) => facilityIdByName.get(n.toUpperCase())).filter((id) => {
    if (!id) missingFacility.add(names.find((n) => !facilityIdByName.get(n.toUpperCase())));
    return !!id;
  });

  // Load semua location_id aktif utk "patokan lokasi" acak.
  const locationRows = await Location.findAll({ where: { status: 1 }, attributes: ['location_id'], raw: true });
  const locationIds = locationRows.map((l) => l.location_id);

  // Bangun daftar "target" per kota: { cityId, cityName, provinceId, countryId }.
  const targetsByCity = {
    Surabaya: [{ cityId: surabaya.city_id, cityName: 'Surabaya', provinceId: surabaya.province_id, countryId: surabaya.country_id }],
    Kediri:   [{ cityId: kediri.city_id,   cityName: 'Kediri',   provinceId: kediri.province_id,   countryId: kediri.country_id }],
    Jakarta:  [{ cityId: jaksel.city_id,   cityName: 'Jakarta Selatan', provinceId: jaksel.province_id, countryId: jaksel.country_id }],
    Bali:     baliCities.map((c) => ({ cityId: c.city_id, cityName: c.name.replace(/\b\w/g, (ch) => ch.toUpperCase()), provinceId: c.province_id, countryId: c.country_id })),
  };

  /* ── Bangun rencana insert: satu entri per properti ─────────────────── */
  const plan = []; // { cityLabel, target, buildingType }
  for (const [cityLabel, counts] of Object.entries(CITY_COUNTS)) {
    const targets = targetsByCity[cityLabel];
    for (const [labelId, qty] of Object.entries(counts)) {
      const buildingType = TYPE_MAP[labelId];
      // Bali → round-robin ke 16 kota; kota tunggal lain → semua ke target[0].
      const assigned = targets.length > 1 ? roundRobin(qty, targets) : Array(qty).fill(targets[0]);
      for (const target of assigned) plan.push({ cityLabel, target, buildingType });
    }
  }

  console.log(`\nTotal properti direncanakan: ${plan.length}`);
  const byCityType = {};
  for (const p of plan) {
    const k = `${p.cityLabel}/${p.buildingType}`;
    byCityType[k] = (byCityType[k] || 0) + 1;
  }
  for (const [k, c] of Object.entries(byCityType)) console.log(`   ${k.padEnd(24)} ${c}`);

  if (DRY) { console.log('\n--dry aktif — tidak menulis ke DB.'); process.exit(0); }

  /* ── Generate baris Property + Facility + Image + Location ──────────── */
  let baseCount = await Property.count();
  const propRows = [];
  const facRows = [];
  const imgRows = [];
  const locRows = [];

  for (const item of plan) {
    const { target, buildingType, cityLabel } = item;
    const { tx, periodHint, priceType } = decideTxAndPeriod(buildingType);
    const tier = weightedTier();
    const range = resolveBudgetTierRange(buildingType, tx, tier, periodHint);
    if (!range) { console.warn(`  ⚠️  Tidak ada tier utk ${buildingType}/${tx}/${tier} — skip`); continue; }
    const price = roundNice(randInt(range.min, range.max));

    const feature = pick(FEATURES);
    const typeLabel = TYPE_LABEL[buildingType];
    const txLabel = tx === 'rent' ? 'Rent' : 'Sale';
    const title = `${target.cityName} ${feature} ${typeLabel} ${txLabel}`.substring(0, 100);

    const property_id = GeneralController.generateRandomId(title, baseCount);
    baseCount++;

    const isFloorPosType = buildingType === 'apartment' || buildingType === 'hotel';
    const floor_location = isFloorPosType ? `Lantai ${randInt(1, 25)}` : null;
    const floor_quantity = !isFloorPosType ? randInt(1, 3) : null;

    const isRentUnit = tx === 'rent';
    const furnished_status = (buildingType === 'hotel' || buildingType === 'villa')
      ? 'Full Furnished'
      : isRentUnit ? pick(['Full Furnished', 'Semi Furnished', 'Unfurnished']) : null;

    const kpr_status = (tx === 'sale' && (buildingType === 'house' || buildingType === 'apartment')) ? 'Y' : 'N';

    const bedrooms = buildingType === 'hotel' ? randInt(10, 60)
      : buildingType === 'apartment' ? randInt(0, 4)
      : randInt(2, 6);
    const bathrooms = buildingType === 'hotel' ? null : randInt(1, Math.max(1, bedrooms));

    const buildingArea = `${randInt(buildingType === 'hotel' ? 800 : 45, buildingType === 'hotel' ? 6000 : 400)} m2`;
    const landArea = (buildingType === 'house' || buildingType === 'villa' || buildingType === 'hotel')
      ? `${randInt(60, buildingType === 'hotel' ? 8000 : 600)} m2` : null;

    propRows.push({
      property_id,
      city_id: target.cityId,
      province_id: target.provinceId,
      country_id: target.countryId,
      user_id: AGENT_ID,
      title,
      description: `${typeLabel} ${txLabel === 'Rent' ? 'disewakan' : 'dijual'} di ${target.cityName}, dekat ${feature.replace(/^Near\s*/i, '').toLowerCase() || 'kawasan strategis'}.`,
      price,
      price_type: priceType,
      address: `Jl. ${feature.replace(/^Near\s*/i, '')} No. ${randInt(1, 99)}, ${target.cityName}`,
      area: feature.replace(/^Near\s*/i, ''),
      district: null,
      postal_code: String(randInt(10000, 99999)),
      furnished_status,
      bed_rooms: bedrooms,
      bath_rooms: bathrooms,
      electricity_capacity: pick([900, 1300, 2200, 3500, 4400, 6600]),
      building_area: buildingArea,
      land_area: landArea,
      floor_location,
      floor_quantity,
      kpr_status,
      building_type: buildingType,
      transaction_type: txLabel,
      status: 1,
      created_date: TODAY,
      created_by: AGENT_ID,
      updated_date: null,
      updated_by: null,
    });

    // Fasilitas: 4-7 acak dari pool kurasi tipe ini.
    const chosenFacilities = facilityIds(pickN(FACILITY_POOL[buildingType], randInt(4, Math.min(7, FACILITY_POOL[buildingType].length))));
    for (const fid of chosenFacilities) {
      facRows.push({ property_id, facility_id: fid, facility_qty: null, created_date: TODAY, created_by: AGENT_ID, updated_date: null, updated_by: null });
    }

    // Gambar: satu placeholder generik per tipe.
    imgRows.push({ property_id, name: `${typeLabel} Main Image`, url: IMAGE_URL[buildingType] });

    // Patokan lokasi: 2-4 acak.
    if (locationIds.length) {
      for (const lid of pickN(locationIds, randInt(2, 4))) {
        locRows.push({ property_id, location_id: lid, created_date: new Date(), created_by: AGENT_ID, updated_date: null, updated_by: null });
      }
    }
  }

  if (missingFacility.size) {
    console.warn(`\n⚠️  Fasilitas tanpa padanan DB (dilewati): ${[...missingFacility].filter(Boolean).join(', ')}`);
  }

  /* ── Tulis ke DB (chunked bulkCreate) ────────────────────────────────── */
  const chunk = (arr, n) => { const r = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n)); return r; };

  console.log(`\n[1/4] Insert ${propRows.length} properties...`);
  for (const batch of chunk(propRows, 100)) await Property.bulkCreate(batch, { ignoreDuplicates: true });

  console.log(`[2/4] Insert ${facRows.length} property_facilities...`);
  for (const batch of chunk(facRows, 500)) await PropertyFacility.bulkCreate(batch, { ignoreDuplicates: true });

  console.log(`[3/4] Insert ${imgRows.length} property_images...`);
  for (const batch of chunk(imgRows, 500)) await PropertyImage.bulkCreate(batch, { ignoreDuplicates: true });

  console.log(`[4/4] Insert ${locRows.length} property_locations...`);
  for (const batch of chunk(locRows, 500)) await PropertyLocation.bulkCreate(batch, { ignoreDuplicates: true });

  console.log('\n' + '═'.repeat(64));
  console.log(`  ✅  SELESAI — ${propRows.length} properti, ${facRows.length} fasilitas, ${imgRows.length} gambar, ${locRows.length} patokan lokasi`);
  console.log('═'.repeat(64) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('\n❌ SEED ERROR:', err); process.exit(1); });

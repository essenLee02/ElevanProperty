'use strict';
/**
 * seed-natasha-agent-2026-08.js
 * ---------------------------------------------------------------------------
 * Membuat agent baru "Natasha Auwliandy" (Sale-only, KPR) + katalog properti
 * SALE di Surabaya, Sidoarjo, Gresik, untuk uji coba chatbot AI:
 *
 *   Surabaya : 120 rumah + 90 apartemen   (210)
 *   Sidoarjo : 120 rumah + 73 apartemen   (193)
 *   Gresik   :  50 rumah + 68 apartemen   (118)
 *   TOTAL    : 521 properti
 *
 * Semua properti transaction_type=Sale (mengikuti users.trans_type Natasha —
 * dikonfirmasi pemilik proyek: skenario "sewa apartemen di PTC" dibuat SEBAGAI
 * listing SALE juga, bukan rental sungguhan, supaya konsisten dengan agent
 * yang hanya melayani jual).
 *
 * TIGA properti "showcase" (disisipkan di antara data acak, bukan tambahan
 * di luar hitungan di atas) memakai nama/area PERSIS sesuai skenario uji:
 *   1. Rumah di Citraland/Ciputra, Surabaya
 *   2. Apartemen "Anderson Waterplace" dekat PTC, Surabaya
 *   3. Rumah di Alam Djuanda, Sidoarjo
 *
 * Location (locations table): area yang BELUM ada di DB untuk kota terkait
 * dibuat dulu (location_type='area', city_id wajib) — termasuk beberapa nama
 * kawasan Gresik TAMBAHAN di luar contoh singkat yang diberikan user, memakai
 * nama kecamatan/kawasan Gresik yang benar-benar dikenal (Menganti,
 * Wringinanom, Duduksampeyan) — BUKAN nama fiktif, mengikuti disiplin proyek
 * (§5 M129: jangan fabrikasi nama lokasi tanpa dasar).
 *
 * Harga: resolveBudgetTierRange() (propertyRecommendationService.js) — SAMA
 * PERSIS dengan tabel budget-tier yang dipakai filter katalog live, supaya
 * data ini otomatis relevan untuk pengujian alur Q1-Q12 & budget expansion.
 * Area "premium" (Pakuwon Indah/City, Citraland, Waterplace, dst.) dibobotkan
 * ke tier lebih tinggi (menengah/eksklusif); area biasa condong terjangkau.
 *
 * Populates: users (1 baris), properties, property_facilities, property_images,
 * property_locations, locations (baris baru bila belum ada).
 *
 * Usage: node scripts/seed-natasha-agent-2026-08.js
 *   --dry     Hanya tampilkan ringkasan rencana insert, tidak menulis ke DB.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const {
  User, Property, PropertyFacility, PropertyImage, PropertyLocation,
  Facility, Location, City, Country,
} = require('../models');
const GeneralController = require('../controllers/GeneralController');
const { validateUserBusinessFields } = require('../utils/userBusinessRules');
const { resolveBudgetTierRange } = require('../services/propertyRecommendationService');

const DRY = process.argv.includes('--dry');
const TODAY = GeneralController.todayDate();

/* ══════════════════════════════════════════════════════════════════════════
   1) AGENT NATASHA — data persis dari permintaan user
══════════════════════════════════════════════════════════════════════════ */
const NATASHA = {
  name: 'Natasha Auwliandy',
  phone: '6282230587711',
  trans_type: 'Sale',
  payment_type: 'KPR',
  username: 'tasha',
  password: 'tasha',
  birthdate: '2000-02-17',
  kirimi_device_id: 'D-31CZ6',
};

/* ══════════════════════════════════════════════════════════════════════════
   2) AREA PER KOTA — nama dari user + kawasan nyata tambahan (Gresik)
      { name, premium } — premium mempengaruhi bobot budget tier saja.
══════════════════════════════════════════════════════════════════════════ */
const AREAS = {
  Surabaya: [
    { name: 'Pakuwon Indah',      premium: true  }, // sudah ada di DB
    { name: 'Dukuh Pakis',        premium: true  }, // BARU
    { name: 'Pakuwon City',       premium: true  }, // BARU
    { name: 'Mulyorejo',          premium: false }, // BARU
    { name: 'MERR',               premium: false }, // sudah ada
    { name: 'Wiyung',             premium: false }, // sudah ada
    { name: 'Wonokromo',          premium: false }, // sudah ada
    { name: 'Wisata Bukit Mas',   premium: true  }, // BARU
    { name: 'Citraland',          premium: true  }, // sudah ada (= "Ciputra")
    { name: 'Waterplace',         premium: true  }, // BARU (dekat PTC)
  ],
  Sidoarjo: [
    { name: 'Candramas',          premium: false }, // BARU
    { name: 'Alana Cemandi',      premium: false }, // BARU
    { name: 'Permata Kwangsan',   premium: false }, // BARU
    { name: 'Djuanda',            premium: true  }, // BARU (dekat bandara)
    { name: 'Tropodo',            premium: false }, // BARU
    { name: 'Alam Djuanda',       premium: true  }, // BARU (skenario khusus)
  ],
  Gresik: [
    { name: 'Kebomas',                premium: false }, // sudah ada
    { name: 'Manyar',                 premium: false }, // sudah ada
    { name: 'GKB',                    premium: true  }, // sudah ada
    { name: 'Driyorejo',              premium: false }, // sudah ada
    { name: 'Cerme',                  premium: false }, // sudah ada
    { name: 'Greenland Residence',    premium: true  }, // BARU (perbaikan ejaan "Greeland")
    { name: 'Alana Cerme',            premium: false }, // BARU
    { name: 'Menganti',               premium: false }, // BARU (kecamatan nyata)
    { name: 'Puri Safira',            premium: false }, // BARU
    { name: 'Mitra Wonokoyo',         premium: false }, // BARU
    { name: 'Wringinanom',            premium: false }, // BARU (kecamatan nyata, tambahan)
    { name: 'Duduksampeyan',          premium: false }, // BARU (kecamatan nyata, tambahan)
  ],
};

const CITY_COUNTS = {
  Surabaya: { house: 120, apartment: 90 },
  Sidoarjo: { house: 120, apartment: 73 },
  Gresik:   { house: 50,  apartment: 68 },
};

/* ══════════════════════════════════════════════════════════════════════════
   3) SHOWCASE — 3 properti spesifik untuk skenario uji percakapan
══════════════════════════════════════════════════════════════════════════ */
const SHOWCASE = [
  {
    city: 'Surabaya', area: 'Citraland', buildingType: 'house',
    title: 'Rumah 2 Lantai Citraland Ciputra Surabaya',
    description: 'Rumah 2 lantai di kawasan Citraland (Ciputra), Surabaya Barat — lingkungan tertata, dekat Universitas Ciputra.',
    tier: 'eksklusif', certificate_type: 'SHM',
  },
  {
    city: 'Surabaya', area: 'Waterplace', buildingType: 'apartment',
    title: 'Anderson Waterplace Apartment dekat PTC Surabaya',
    description: 'Apartemen Anderson Waterplace, kawasan Waterplace — dekat Pakuwon Trade Center (PTC) dan Universitas Ciputra, Surabaya Barat.',
    tier: 'menengah', certificate_type: 'SHSRS',
  },
  {
    city: 'Sidoarjo', area: 'Alam Djuanda', buildingType: 'house',
    title: 'Rumah Alam Djuanda Sidoarjo',
    description: 'Rumah di perumahan Alam Djuanda, Sidoarjo — dekat Bandara Internasional Juanda.',
    tier: 'menengah', certificate_type: 'SHM',
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   4) HELPERS
══════════════════════════════════════════════════════════════════════════ */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const pool = [...arr]; const out = [];
  n = Math.min(n, pool.length);
  for (let i = 0; i < n; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function roundNice(v) {
  const step = v >= 1e9 ? 50_000_000 : v >= 1e6 ? 100_000 : 10_000;
  return Math.round(v / step) * step;
}
/** Area premium → condong tier lebih tinggi; area biasa → condong terjangkau. */
function weightedTier(premium) {
  const r = Math.random();
  if (premium) return r < 0.20 ? 'terjangkau' : r < 0.70 ? 'menengah' : 'eksklusif';
  return r < 0.55 ? 'terjangkau' : r < 0.88 ? 'menengah' : 'eksklusif';
}

const FACILITY_POOL = {
  house: ['AC', 'CARPORT', 'GARDEN', 'KITCHEN SET', 'SECURITY', 'WATER HEATER', 'CCTV 24 JAM', 'PLN ELECTRICITY'],
  apartment: ['AC', 'GYM', 'YOGA', 'KOLAM RENANG', 'SWIMMING POOL', 'LIFT', 'SECURITY', 'WI-FI', 'PARKING', 'CCTV 24 JAM'],
};
const IMAGE_URL = {
  house: '/assets/image_data/properties/house.png',
  apartment: '/assets/image_data/properties/apartment.png',
};
const CERT_POOL = {
  // Rumah tapak Indonesia lazim SHM; sebagian SHGB (mis. beli dari developer
  // kompleks tertentu); jarang "LAINNYA". Apartemen lazim SHGB/SHSRS (unit
  // strata), SHM tidak berlaku untuk unit vertikal.
  house:     () => { const r = Math.random(); return r < 0.70 ? 'SHM' : r < 0.95 ? 'SHGB' : 'LAINNYA'; },
  apartment: () => { const r = Math.random(); return r < 0.50 ? 'SHGB' : r < 0.90 ? 'SHSRS' : 'LAINNYA'; },
};

/* ══════════════════════════════════════════════════════════════════════════
   5) MAIN
══════════════════════════════════════════════════════════════════════════ */
async function ensureNatashaUser() {
  const existing = await User.findOne({ where: { username: NATASHA.username } });
  if (existing) {
    console.log(`  ↪ User "${NATASHA.username}" sudah ada (${existing.user_id}) — dipakai apa adanya.`);
    return existing.user_id;
  }

  const business = validateUserBusinessFields({
    trans_type: NATASHA.trans_type,
    payment_type: NATASHA.payment_type,
    ai_primary: 'Default',
  });
  if (!business.ok) throw new Error(`validateUserBusinessFields gagal: ${business.error}`);

  const totalUsers = await User.count();
  const userId = GeneralController.generateRandomId(NATASHA.name, totalUsers).toUpperCase();
  const salt = await bcrypt.genSalt(Number(process.env.BCRYPT_SALT_ROUNDS || 10));
  const hashedPassword = await bcrypt.hash(NATASHA.password, salt);

  if (DRY) {
    console.log(`  ↪ [DRY] Akan membuat user "${NATASHA.username}" → user_id ${userId}`);
    return userId;
  }

  const user = await User.create({
    user_id: userId,
    name: NATASHA.name.toUpperCase(),
    birthdate: NATASHA.birthdate,
    phone: NATASHA.phone,
    username: NATASHA.username,
    password: hashedPassword,
    email: null,
    catalog_summary: 'ON', // agar AI langsung menampilkan katalog setelah brief (untuk uji coba)
    ...business.values,
    kirimi_device_id: NATASHA.kirimi_device_id,
    refresh_token: null,
    updated_date: null,
    update_by: null,
    created_date: new Date(),
    created_by: 'Self-Register',
    status: 1,
    privilege: 'agent',
  });
  console.log(`  ✅ User baru dibuat: ${user.user_id} (${user.name})`);
  return user.user_id;
}

/** Pastikan semua area di AREAS ada di tabel locations; return { "Surabaya|Pakuwon Indah": location_id }. */
async function ensureAreaLocations(cityRows, createdByUserId) {
  const map = new Map();
  let totalLocations = await Location.count();

  for (const [cityLabel, areaList] of Object.entries(AREAS)) {
    const city = cityRows[cityLabel];
    const existingRows = await Location.findAll({ where: { city_id: city.city_id }, raw: true });
    const existingByName = new Map(existingRows.map((r) => [r.name.toLowerCase(), r]));

    for (const { name } of areaList) {
      const found = existingByName.get(name.toLowerCase());
      if (found) {
        map.set(`${cityLabel}|${name}`, found.location_id);
        continue;
      }
      const locationId = GeneralController.generateRandomId(name, totalLocations).toUpperCase();
      totalLocations++;
      if (!DRY) {
        await Location.create({
          location_id: locationId,
          name,
          city_id: city.city_id,
          location_type: 'area',
          status: 1,
          created_date: TODAY,
          created_by: createdByUserId,
          updated_date: null,
          updated_by: null,
        });
      }
      map.set(`${cityLabel}|${name}`, locationId);
      console.log(`  ${DRY ? '[DRY] ' : ''}➕ Location baru: "${name}" (${cityLabel}) → ${locationId}`);
    }
  }
  return map;
}

async function main() {
  console.log('═'.repeat(70));
  console.log(`  🌱  SEED AGENT NATASHA AUWLIANDY ${DRY ? '(DRY RUN)' : ''}`);
  console.log('═'.repeat(70));

  const country = await Country.findOne({ where: { name: 'INDONESIA' }, raw: true });
  if (!country) throw new Error('Negara INDONESIA tidak ditemukan');

  const cityNames = ['SURABAYA', 'SIDOARJO', 'GRESIK'];
  const cityRowsRaw = await City.findAll({ where: {}, raw: true });
  const cityRows = {};
  for (const label of ['Surabaya', 'Sidoarjo', 'Gresik']) {
    const row = cityRowsRaw.find((c) => c.name === label.toUpperCase());
    if (!row) throw new Error(`Kota ${label} tidak ditemukan di DB`);
    cityRows[label] = row;
  }

  console.log('\n[Step 1/5] Agent Natasha...');
  const agentId = await ensureNatashaUser();

  console.log('\n[Step 2/5] Memastikan area/location...');
  const locationMap = await ensureAreaLocations(cityRows, agentId);

  console.log('\n[Step 3/5] Menyiapkan fasilitas & landmark per kota...');
  const facilityRows = await Facility.findAll({ where: { status: 1 }, attributes: ['facility_id', 'name'], raw: true });
  const facilityIdByName = new Map();
  for (const f of facilityRows) {
    const key = f.name.toUpperCase();
    if (!facilityIdByName.has(key)) facilityIdByName.set(key, f.facility_id);
  }
  const facilityIds = (names) => names.map((n) => facilityIdByName.get(n.toUpperCase())).filter(Boolean);

  const landmarksByCity = {};
  for (const label of ['Surabaya', 'Sidoarjo', 'Gresik']) {
    const rows = await Location.findAll({
      where: { city_id: cityRows[label].city_id, location_type: ['landmark', 'commercial'] },
      attributes: ['location_id'], raw: true,
    });
    landmarksByCity[label] = rows.map((r) => r.location_id);
  }

  console.log('\n[Step 4/5] Membangun rencana properti (521 acak + 3 showcase)...');
  const plan = []; // { cityLabel, buildingType, area:{name,premium}, showcase? }
  for (const [cityLabel, counts] of Object.entries(CITY_COUNTS)) {
    const areaList = AREAS[cityLabel];
    for (const [buildingType, qty] of Object.entries(counts)) {
      for (let i = 0; i < qty; i++) {
        plan.push({ cityLabel, buildingType, area: pick(areaList) });
      }
    }
  }
  // Sisipkan 3 showcase: ganti SATU slot acak yang cocok kota+tipe supaya
  // total per kota/tipe TETAP PERSIS seperti diminta (bukan tambahan).
  for (const sc of SHOWCASE) {
    const idx = plan.findIndex((p) => p.cityLabel === sc.city && p.buildingType === sc.buildingType && !p.showcase);
    if (idx === -1) throw new Error(`Tidak ada slot tersedia untuk showcase: ${sc.title}`);
    plan[idx] = { cityLabel: sc.city, buildingType: sc.buildingType, area: AREAS[sc.city].find((a) => a.name === sc.area), showcase: sc };
  }

  console.log(`Total properti direncanakan: ${plan.length}`);
  const byCityType = {};
  for (const p of plan) { const k = `${p.cityLabel}/${p.buildingType}`; byCityType[k] = (byCityType[k] || 0) + 1; }
  for (const [k, c] of Object.entries(byCityType)) console.log(`   ${k.padEnd(24)} ${c}`);

  if (DRY) { console.log('\n--dry aktif — tidak menulis ke DB.'); return; }

  let baseCount = await Property.count();
  const propRows = []; const facRows = []; const imgRows = []; const locRows = [];

  for (const item of plan) {
    const { cityLabel, buildingType, area, showcase } = item;
    const city = cityRows[cityLabel];
    const tier = showcase ? showcase.tier : weightedTier(area.premium);
    const range = resolveBudgetTierRange(buildingType, 'sale', tier, '');
    if (!range) { console.warn(`  ⚠️ Tidak ada tier untuk ${buildingType}/sale/${tier} — skip`); continue; }
    const price = roundNice(randInt(range.min, range.max));

    const typeLabel = buildingType === 'house' ? 'House' : 'Apartment';
    const title = showcase ? showcase.title : `${area.name} ${typeLabel} Sale ${cityLabel}`.substring(0, 100);
    const description = showcase ? showcase.description
      : `${typeLabel} dijual di kawasan ${area.name}, ${cityLabel}. Lingkungan strategis, siap huni.`;

    const property_id = GeneralController.generateRandomId(title, baseCount);
    baseCount++;

    const isApartment = buildingType === 'apartment';
    const bedrooms = isApartment ? randInt(1, 3) : randInt(2, 5);
    const bathrooms = randInt(1, Math.max(1, bedrooms));
    const buildingArea = `${randInt(isApartment ? 28 : 60, isApartment ? 140 : 350)} m2`;
    const landArea = isApartment ? null : `${randInt(72, 400)} m2`;

    propRows.push({
      property_id,
      city_id: city.city_id,
      province_id: city.province_id,
      country_id: city.country_id,
      user_id: agentId,
      title,
      description,
      price,
      price_type: 'Cash',
      address: `Jl. ${area.name} No. ${randInt(1, 99)}, ${cityLabel}`,
      area: area.name,
      district: null,
      postal_code: String(randInt(60000, 61500)), // rentang kode pos Jawa Timur (Surabaya/Sidoarjo/Gresik)
      furnished_status: isApartment ? pick(['Full Furnished', 'Semi Furnished', 'Unfurnished']) : null,
      bed_rooms: bedrooms,
      bath_rooms: bathrooms,
      electricity_capacity: pick([1300, 2200, 3500, 4400, 6600]),
      building_area: buildingArea,
      land_area: landArea,
      floor_location: isApartment ? `Lantai ${randInt(2, 25)}` : null,
      floor_quantity: isApartment ? null : randInt(1, 2),
      kpr_status: 'Y', // agent Natasha payment_type=KPR — semua listing sale mendukung KPR
      certificate_type: showcase ? showcase.certificate_type : CERT_POOL[buildingType](),
      building_type: buildingType,
      transaction_type: 'Sale',
      status: 1,
      created_date: TODAY,
      created_by: agentId,
      updated_date: null,
      updated_by: null,
    });

    const chosenFacilities = facilityIds(pickN(FACILITY_POOL[buildingType], randInt(4, Math.min(7, FACILITY_POOL[buildingType].length))));
    for (const fid of chosenFacilities) {
      facRows.push({ property_id, facility_id: fid, facility_qty: null, created_date: TODAY, created_by: agentId, updated_date: null, updated_by: null });
    }

    imgRows.push({ property_id, name: `${typeLabel} Main Image`, url: IMAGE_URL[buildingType] });

    // Patokan lokasi: area sendiri (WAJIB) + 0-1 landmark kota yang SAMA
    // (bukan acak lintas-kota — beda dari pola seed-leo-felix-properties.js,
    // supaya patokan lokasi selalu masuk akal untuk kota properti ini).
    const ownAreaLocationId = locationMap.get(`${cityLabel}|${area.name}`);
    const locIdsForProperty = [ownAreaLocationId];
    const cityLandmarks = landmarksByCity[cityLabel];
    if (cityLandmarks.length && Math.random() < 0.6) locIdsForProperty.push(pick(cityLandmarks));
    for (const lid of locIdsForProperty) {
      if (!lid) continue;
      locRows.push({ property_id, location_id: lid, created_date: new Date(), created_by: agentId, updated_date: null, updated_by: null });
    }
  }

  const chunk = (arr, n) => { const r = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n)); return r; };

  console.log(`\n[Step 5/5] Menulis ke DB...`);
  console.log(`  [1/4] Insert ${propRows.length} properties...`);
  for (const batch of chunk(propRows, 100)) await Property.bulkCreate(batch, { ignoreDuplicates: true });

  console.log(`  [2/4] Insert ${facRows.length} property_facilities...`);
  for (const batch of chunk(facRows, 500)) await PropertyFacility.bulkCreate(batch, { ignoreDuplicates: true });

  console.log(`  [3/4] Insert ${imgRows.length} property_images...`);
  for (const batch of chunk(imgRows, 500)) await PropertyImage.bulkCreate(batch, { ignoreDuplicates: true });

  console.log(`  [4/4] Insert ${locRows.length} property_locations...`);
  for (const batch of chunk(locRows, 500)) await PropertyLocation.bulkCreate(batch, { ignoreDuplicates: true });

  console.log('\n' + '═'.repeat(70));
  console.log(`  ✅ SELESAI — agent ${agentId}, ${propRows.length} properti, ${facRows.length} fasilitas,`);
  console.log(`     ${imgRows.length} gambar, ${locRows.length} patokan lokasi.`);
  console.log('  Showcase properties:');
  for (const sc of SHOWCASE) console.log(`   - [${sc.city}] ${sc.title}`);
  console.log('═'.repeat(70) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('\n❌ SEED ERROR:', err); process.exit(1); });

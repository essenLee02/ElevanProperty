/**
 * seed-properties.js
 *
 * Seed master properti dari JSON ke database.
 * Source: asset/json_data/indonesia_property_extended_v3.json (9120 records)
 *
 * Usage: node scripts/seed-properties.js
 * Options:
 *   --limit=N   Hanya insert N record pertama (untuk testing)
 *   --clear     Hapus semua property lama sebelum seed (HATI-HATI!)
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Op }                   = require('sequelize');
const { Property, PropertyImage, PropertyFacility,
        Country, Province, City, Facility }  = require('../models');
const GeneralController        = require('../controllers/GeneralController');

/* ── Konfigurasi ────────────────────────────────────────────────────────── */
const JSON_PATH   = path.join(__dirname, '../asset/json_data/indonesia_property_extended_v3.json');
const CREATED_BY  = 'SA6EDRU001';   // nigel123 — user pertama (aktif)
const CHUNK_PROP  = 100;            // properti per batch bulkCreate
const CHUNK_FAC   = 500;            // facility-rows per batch
const TODAY       = GeneralController.todayDate();

/* ── Argumen CLI ─────────────────────────────────────────────────────────── */
const args    = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT   = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const CLEAR   = args.includes('--clear');

/* ══════════════════════════════════════════════════════════════════════════
   MAPPING TABLES
══════════════════════════════════════════════════════════════════════════ */

/** Alias nama provinsi JSON → nama di DB */
const PROVINCE_ALIAS = {
  'DI YOGYAKARTA': 'DAERAH ISTIMEWA JOGJAKARTA',
};

/** Furnished status JSON → nilai valid DB */
const FURNISHED_MAP = {
  'full furnished': 'Full Furnished',
  'semi furnished': 'Semi Furnished',
  'unfurnished':    'Unfurnished',
  'minimalist':     'Semi Furnished',
  'partial':        'Semi Furnished',
};

/** Nama fasilitas JSON (lowercase) → facility_id di DB */
const FACILITY_MAP = {
  'ac':                   'ACZKE0T001',
  'security':             'SERZTB4002',
  'security 24h':         'SERZTB4002',
  'guard house':          'SERZTB4002',
  'kitchen set':          'KSH6GIX004',
  'kolam renang':         'KRQNLSG005',
  'cctv 24 jam':          'CJ2POEZ006',
  'cctv':                 'CCTXE3L000',
  'kids zone':            'KZVVS0X007',
  'gym':                  'GYFW2BB008',
  'yoga':                 'YOFYIK4009',
  'spring bed':           'SB0KAIO010',
  'laundry':              'LA29XXD011',
  'wi-fi':                'WIMLCYO012',
  'wifi':                 'WIMLCYO012',
  'breakfast':            'BRN2QOZ013',
  'breakfast included':   'BRN2QOZ013',
  'lunch':                'LUO5SSN014',
  'dinner':               'DIF4AJQ015',
  'smart home':           'SHTZIRG016',
  'smart home system':    'SHTZIRG016',
  'water heater':         'WHXZCX1017',
  'smart door':           'SD1NUPW019',
  'bar':                  'BAPHJKO020',
  'infinity pool':        'IPZVQAW021',
  'fence':                'FEN96JI001',
  'smart tv':             'SMAZ6YB002',
  'parking':              'PARKWCB003',
  'parking 4+ cars':      'PARKWCB003',
  'garden':               'GAR3SYQ004',
  'kitchen':              'KITM8EW005',
  'shared kitchen':       'KITM8EW005',
  'living room':          'LIVY7AF006',
  'pln electricity':      'PLN6VXA007',
  'electricity':          'PLN6VXA007',
  'balcony':              'BALY8K6008',
  'storage room':         'STO1EZV009',
  'storage':              'STO1EZV009',
  'storage area':         'STO1EZV009',
  'private pool':         'PRIA2IH010',
  'dining room':          'DINZDBN011',
  'carport':              'CAROH76012',
  'guest room':           'GUEU5LY013',
  'washing machine':      'WASSFPH014',
  'pdam water':           'PDA8RAB015',
  'water access':         'PDA8RAB015',
  'laundry room':         'LAUIZ4R016',
  'laundry area':         'LAUIZ4R016',
  'laundry service':      'LAUUA1J017',
  'atm center':           'ATMPE84018',
  'atm':                  'ATMPE84018',
  'swimming pool':        'SWIPNKS019',
  'rooftop garden':       'ROOQ3CH020',
  'rooftop':              'ROOQ3CH020',
  'concierge':            'CONI5UP021',
  'meeting room':         'MEEIHU6022',
  'lift':                 'LIFLFY4023',
  'private elevator':     'LIFLFY4023',
  'minimarket':           'MINTO8P024',
  'reception':            'REC4YWA025',
  'restaurant':           'RESFOM5026',
  'breakfast area':       'BRE5JWR027',
  'spa':                  'SPAIC91028',
  'sauna':                'SPAIC91028',
  'room service':         'ROOQJ2O029',
  'ballroom':             'BAL75QW030',
  'business center':      'BUS9YUL031',
  'conference room':      'CON5S6H032',
  'home theater':         'HOMAR5X033',
  'jacuzzi':              'JACWO5N034',
  'butler service':       'BUTNADQ035',
  'outdoor shower':       'OUTSIR0036',
  'private chef':         'PRIV710037',
  'yoga deck':            'YOG52KP038',
};

/** Tipe bangunan yang floor = posisi lantai (bukan jumlah lantai) */
const FLOOR_POSITION_TYPES = new Set(['apartment', 'hotel', 'condo', 'office']);

/* ══════════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
══════════════════════════════════════════════════════════════════════════ */

/** Parse harga string IDR → number. Contoh: "Rp 21.1 Juta / month" → 21100000 */
function parsePrice(priceStr) {
  if (!priceStr) return null;
  const s = priceStr
    .replace(/rp\s*/i, '')
    .replace(/\s*\/\s*(month|year|week|minggu|bulan|tahun).*/i, '')
    .trim();

  const miliar = /([0-9.]+)\s*miliar/i.exec(s);
  if (miliar) return Math.round(parseFloat(miliar[1]) * 1_000_000_000);

  const juta = /([0-9.]+)\s*juta/i.exec(s);
  if (juta) return Math.round(parseFloat(juta[1]) * 1_000_000);

  const ribu = /([0-9.]+)\s*ribu/i.exec(s);
  if (ribu) return Math.round(parseFloat(ribu[1]) * 1_000);

  const plain = parseFloat(s.replace(/[,]/g, ''));
  return isNaN(plain) ? null : plain;
}

/** Normalisasi area string: "N/A" atau kosong → null */
function parseArea(v) {
  if (!v || v === 'N/A' || v === '-') return null;
  return String(v).trim();
}

/** Ekstrak bed_rooms & bath_rooms dari spec sesuai building_type */
function extractRooms(buildingType, spec) {
  let bed_rooms  = null;
  let bath_rooms = null;

  if (spec?.bedrooms  != null) bed_rooms  = parseInt(spec.bedrooms,  10) || 0;
  if (spec?.bathrooms != null) bath_rooms = parseInt(spec.bathrooms, 10) || 0;

  // apartment/condo: "unit_type" = "2 Bedrooms", "Studio"
  if (spec?.unit_type && bed_rooms === null) {
    const m = /(\d+)\s*bed/i.exec(spec.unit_type);
    if (m) bed_rooms = parseInt(m[1], 10);
    else if (/studio/i.test(spec.unit_type)) bed_rooms = 0;
  }

  // hotel/boarding_house: total_rooms → bed_rooms (best-effort)
  if (spec?.total_rooms != null && bed_rooms === null) {
    bed_rooms = parseInt(spec.total_rooms, 10) || null;
  }

  return { bed_rooms, bath_rooms };
}

/** Ekstrak floor_location / floor_quantity sesuai building_type */
function extractFloor(buildingType, spec) {
  if (FLOOR_POSITION_TYPES.has(buildingType)) {
    return { floor_location: spec?.floor ? String(spec.floor).trim() : null, floor_quantity: null };
  }
  // shophouse: spec.floors adalah integer (jumlah lantai)
  if (buildingType === 'shophouse' && spec?.floors != null) {
    const qty = parseInt(spec.floors, 10);
    return { floor_location: null, floor_quantity: isNaN(qty) ? null : qty };
  }
  return { floor_location: null, floor_quantity: null };
}

/** Normalisasi furnished_status */
function parseFurnished(val) {
  if (!val) return null;
  return FURNISHED_MAP[String(val).toLowerCase().trim()] || null;
}

/** Chunk array menjadi sub-arrays berukuran n */
function chunk(arr, n) {
  const result = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN SEED
══════════════════════════════════════════════════════════════════════════ */

async function seed() {
  console.log('═'.repeat(60));
  console.log('  🌱  SEED PROPERTIES — mulai');
  console.log('═'.repeat(60));

  /* ── 1. Baca JSON ───────────────────────────────────────────────── */
  console.log('\n[1/6] Membaca JSON...');
  const jsonData = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  let records = jsonData.properties || [];
  if (LIMIT < Infinity) {
    records = records.slice(0, LIMIT);
    console.log(`      ⚡ --limit=${LIMIT} aktif — hanya ${records.length} record`);
  } else {
    console.log(`      Total record: ${records.length}`);
  }

  /* ── 2. Load lookup maps dari DB ────────────────────────────────── */
  console.log('\n[2/6] Load lookup data dari DB...');

  const country = await Country.findOne({ where: { name: 'INDONESIA', status: { [Op.ne]: 3 } } });
  if (!country) throw new Error('Negara INDONESIA tidak ditemukan di DB');
  const COUNTRY_ID = country.country_id;

  const provinces = await Province.findAll({ where: { status: { [Op.ne]: 3 } }, attributes: ['province_id', 'name'] });
  const provinceMap = new Map(); // UPPERCASE_NAME → province_id
  provinces.forEach(p => {
    const key = p.name.toUpperCase().trim();
    provinceMap.set(key, p.province_id);
  });

  const cities = await City.findAll({ where: { status: { [Op.ne]: 3 } }, attributes: ['city_id', 'name', 'province_id'] });
  // Map: "PROVINCE_ID::CITY_NAME_UPPER" → city_id
  const cityMap = new Map();
  cities.forEach(c => {
    const key = `${c.province_id}::${c.name.toUpperCase().trim()}`;
    cityMap.set(key, c.city_id);
  });

  console.log(`      ✅  ${provinces.length} provinsi, ${cities.length} kota`);

  /* ── 3. Clear (opsional) ────────────────────────────────────────── */
  if (CLEAR) {
    console.log('\n[3/6] ⚠️  --clear aktif: hapus semua data property lama...');
    await PropertyFacility.destroy({ where: {}, truncate: true });
    await PropertyImage.destroy({ where: {}, truncate: true });
    await Property.destroy({ where: {}, truncate: true });
    console.log('      ✅  Tabel dikosongkan');
  } else {
    console.log('\n[3/6] Hitung existing properties...');
  }

  /* ── 4. Proses & insert Properties ─────────────────────────────── */
  console.log('\n[4/6] Proses & insert properties...');

  let baseCount = await Property.count();
  const insertedProps = [];   // { property_id, image, facilities[] }
  let skipped = 0;

  for (const batch of chunk(records, CHUNK_PROP)) {
    const propRows = [];

    for (const rec of batch) {
      /* Resolve province */
      const rawProvince = String(rec.location?.province || '').toUpperCase().trim();
      const dbProvince  = PROVINCE_ALIAS[rawProvince] || rawProvince;
      const province_id = provinceMap.get(dbProvince);
      if (!province_id) {
        console.warn(`  ⚠️  Provinsi tidak ditemukan: "${rec.location?.province}" → skip`);
        skipped++;
        continue;
      }

      /* Resolve city */
      const rawCity = String(rec.location?.city || '').toUpperCase().trim();
      const city_id = cityMap.get(`${province_id}::${rawCity}`);
      if (!city_id) {
        console.warn(`  ⚠️  Kota tidak ditemukan: "${rec.location?.city}" (${rec.location?.province}) → skip`);
        skipped++;
        continue;
      }

      /* Parse harga */
      const price = parsePrice(rec.price);

      /* transaction_type */
      const transaction_type = rec.transaction_type === 'rent' ? 'Rent' : 'Sale';
      const kpr_status       = transaction_type === 'Rent' ? 'N' : 'Y';

      /* Floor */
      const { floor_location, floor_quantity } = extractFloor(rec.building_type, rec.specifications);

      /* Rooms */
      const { bed_rooms, bath_rooms } = extractRooms(rec.building_type, rec.specifications);

      /* Generate ID — pakai counter lokal */
      const property_id = GeneralController.generateRandomId(rec.title || 'PR', baseCount);
      baseCount++;

      propRows.push({
        property_id,
        city_id,
        province_id,
        country_id:           COUNTRY_ID,
        title:                String(rec.title || '').trim().substring(0, 100),
        description:          rec.description ? String(rec.description).trim() : null,
        price,
        address:              rec.address      ? String(rec.address).trim().substring(0, 255)  : null,
        area:                 rec.location?.area ? String(rec.location.area).trim().substring(0, 255) : null,
        district:             null,
        postal_code:          rec.location?.postal_code ? String(rec.location.postal_code).trim() : null,
        furnished_status:     parseFurnished(rec.specifications?.furnished),
        bed_rooms:            bed_rooms,
        bath_rooms:           bath_rooms,
        electricity_capacity: null,
        building_area:        parseArea(rec.building_area),
        land_area:            parseArea(rec.land_area),
        floor_location,
        floor_quantity,
        kpr_status,
        building_type:        rec.building_type,
        transaction_type,
        status:               1,
        created_date:         TODAY,
        created_by:           CREATED_BY,
        updated_date:         null,
        updated_by:           null
      });

      insertedProps.push({
        property_id,
        image:      rec.image      || null,
        facilities: rec.facilities || []
      });
    }

    if (propRows.length > 0) {
      await Property.bulkCreate(propRows, { ignoreDuplicates: true });
    }

    const done = insertedProps.length;
    process.stdout.write(`\r      Progress: ${done}/${records.length} (${Math.round(done/records.length*100)}%)`);
  }

  console.log(`\n      ✅  Inserted: ${insertedProps.length}, Skipped: ${skipped}`);

  /* ── 5. Insert PropertyImages ───────────────────────────────────── */
  console.log('\n[5/6] Insert property images...');
  const imageRows = insertedProps
    .filter(p => p.image)
    .map(p => ({
      property_id: p.property_id,
      name:        'Main Image',
      url:         p.image
    }));

  let imgCount = 0;
  for (const batch of chunk(imageRows, CHUNK_FAC)) {
    await PropertyImage.bulkCreate(batch, { ignoreDuplicates: true });
    imgCount += batch.length;
    process.stdout.write(`\r      Progress: ${imgCount}/${imageRows.length} images`);
  }
  console.log(`\n      ✅  ${imgCount} gambar diinsert`);

  /* ── 6. Insert PropertyFacilities ───────────────────────────────── */
  console.log('\n[6/6] Insert property facilities...');
  const facilityRows = [];
  for (const p of insertedProps) {
    for (const fName of p.facilities) {
      const fid = FACILITY_MAP[String(fName).toLowerCase().trim()];
      if (!fid) continue;
      facilityRows.push({
        property_id:  p.property_id,
        facility_id:  fid,
        facility_qty: null,
        created_date: TODAY,
        created_by:   CREATED_BY,
        updated_date: null,
        updated_by:   null
      });
    }
  }

  let facCount = 0;
  for (const batch of chunk(facilityRows, CHUNK_FAC)) {
    await PropertyFacility.bulkCreate(batch, { ignoreDuplicates: true });
    facCount += batch.length;
    process.stdout.write(`\r      Progress: ${facCount}/${facilityRows.length} facility rows`);
  }
  console.log(`\n      ✅  ${facCount} facility rows diinsert`);

  /* ── Ringkasan ──────────────────────────────────────────────────── */
  const totalProp = await Property.count();
  console.log('\n' + '═'.repeat(60));
  console.log('  ✅  SEED SELESAI');
  console.log(`     Properties inserted : ${insertedProps.length}`);
  console.log(`     Images inserted     : ${imgCount}`);
  console.log(`     Facilities inserted : ${facCount}`);
  console.log(`     Total di DB         : ${totalProp}`);
  console.log('═'.repeat(60) + '\n');
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌  SEED ERROR:', err.message);
    process.exit(1);
  });

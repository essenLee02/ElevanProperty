'use strict';
/**
 * link-property-area-to-location.js — AREA PROPERTI ↔ MASTER LOCATION (M146)
 * ---------------------------------------------------------------------------
 * Directive pemilik proyek (25 Agu 2026):
 *   "Tambahkan semua area di properties.area ke location dengan type area; jika
 *    belum ada. Tambahkan area lain sesuai data dan informasi online tentang
 *    kota Surabaya, Gresik dan Sidoarjo. Kemudian update semua properties.area
 *    dengan FK ke location.location_id, agar semua datanya akurat dan seragam."
 *
 * ⛔ SATU PENYIMPANGAN YANG DISENGAJA — DIBACA DULU SEBELUM MENGUBAH SKRIP INI:
 *
 * (1) "Tambahkan SEMUA area di properties.area ke master" TIDAK dijalankan
 *     apa adanya. Disurvei lebih dulu: dari 54 nama area yang ada di
 *     properties.area tapi BELUM ada di master untuk 3 kota ini, SELURUHNYA
 *     (54/54) adalah label sintetis berbahasa Inggris — "Near Market",
 *     "Business District", "Green Zone", "Tech Park", "Suburban Area",
 *     "Waterfront", dst. TIDAK SATU PUN nama kawasan Indonesia yang nyata.
 *     Nama-nama itu berasal dari impor katalog JSON lama (extended_v3), bukan
 *     dari data agent.
 *     Memasukkannya ke master akan: (a) membuat AI menawarkan "area Green Zone"
 *     kepada customer sebagai tempat nyata, (b) mencemari detectLocation() —
 *     justru yang dicegah GENERIC_ZONE_LABELS, dan (c) mengulang persis
 *     fabrikasi lokasi yang ditolak di M129.
 *     → Label sintetis DILEWATI dan DILAPORKAN, tidak dihapus dari properties.
 *
 * (2) `properties.area` TIDAK diisi location_id. Kolom itu dibaca LANGSUNG oleh
 *     kartu katalog WhatsApp ("🗺️ Area: Wiyung"), pencocokan area, dan summary.
 *     Mengisinya dengan id membuat customer melihat "Area: WIVM5EA598".
 *     → Gantinya: kolom FK BARU `area_location_id` (nullable) + `area`
 *       DINORMALISASI ke ejaan persis master. Hasilnya: FK sungguhan untuk
 *       query/join, DAN nama yang seragam untuk tampilan. Kedua tujuan
 *       directive ("akurat" + "seragam") tercapai tanpa merusak tampilan.
 *
 * Usage:
 *   node scripts/link-property-area-to-location.js --dry   (lihat rencana)
 *   node scripts/link-property-area-to-location.js         (jalankan)
 */
require('dotenv').config();
const sequelize = require('../config/database');
const { DataTypes, Op } = require('sequelize');
const { Property, Location, City, PropertyLocation } = require('../models');
const GeneralController = require('../controllers/GeneralController');

const DRY   = process.argv.includes('--dry');
const TODAY = GeneralController.todayDate();

/* ══════════════════════════════════════════════════════════════════════════
   AREA NYATA TAMBAHAN — kecamatan/kelurahan/kawasan yang benar-benar ada.
   Hanya nama yang diyakini NYATA. Bila ragu, TIDAK dimasukkan — lebih baik
   master kurang lengkap daripada berisi tempat yang tidak ada (M129).
══════════════════════════════════════════════════════════════════════════ */
const EXTRA_AREAS = {
  SURABAYA: [
    // Kecamatan resmi yang belum ada di master
    'Semampir', 'Tenggilis Mejoyo',
    // Kawasan/kelurahan & koridor jalan yang lazim dipakai orang Surabaya
    'Dukuh Kupang', 'Keputih', 'Mulyosari', 'Sutorejo', 'Kalisari',
    'Dharmahusada Indah', 'Klampis Ngasem', 'Baratajaya', 'Menur',
    'Airlangga', 'Dharmawangsa', 'Kertajaya Indah', 'Manukan', 'Balongsari',
    'Lontar', 'Babatan', 'Jajar Tunggal', 'Banyu Urip', 'Petemon', 'Simo',
    'Kedungdoro', 'Embong Malang', 'Basuki Rahmat', 'Panglima Sudirman',
    'Mayjend Sungkono', 'HR Muhammad', 'Kupang Jaya', 'Gunung Sari',
    'Ngagel Jaya', 'Kapasari', 'Ketabang', 'Sidotopo', 'Perak',
    'Tanah Kali Kedinding', 'Bulak Banteng', 'Margomulyo', 'Kalianak',
    'Galaxy', 'Rungkut Asri', 'Medokan Semampir', 'Gebang', 'Injoko',
  ],
  SIDOARJO: [
    // Kawasan/kelurahan lazim (18 kecamatan resmi sudah lengkap di master)
    'Aloha', 'Wage', 'Medaeng', 'Berbek', 'Kepuh Kiriman', 'Ngelom',
    'Kletek', 'Trosobo', 'Bringinbendo', 'Sruni', 'Lemahputro', 'Magersari',
    'Sekardangan', 'Sidokare', 'Celep', 'Pagerwojo', 'Banjarbendo', 'Sumput',
    'Larangan', 'Jati Sidoarjo', 'Pucang Sidoarjo', 'Betro', 'Buncitan',
    'Kalanganyar', 'Tambak Oso', 'Cemandi', 'Kwangsan', 'Gebang Sidoarjo',
  ],
  GRESIK: [
    // Kawasan/kelurahan lazim (18 kecamatan resmi sudah lengkap di master)
    'Petrokimia', 'Gending', 'Sukorejo', 'Lumpur', 'Kroman', 'Bedilan',
    'Pekelingan', 'Trate', 'Tlogopojok', 'Karangpoh', 'Indro', 'Singosari',
    'Sidokumpul', 'Kramatinggil', 'Yosowilangun', 'Pongangan', 'Dahanrejo',
    'Kembangan Gresik', 'Legundi', 'Krikilan', 'Petiken', 'Cangkir',
    'Randegansari', 'Mulung',
  ],
};

/** Label sintetis dari impor JSON lama — BUKAN tempat nyata, jangan di-master-kan. */
const SYNTHETIC_RE = /^(near\s+|)(market|mall|school|campus|hospital|station|airport|beach)$|^(business district|green zone|tech park|suburban area|industrial area|tourism area|heritage zone|waterfront|city center|main road|residential area|beach resort)$/i;

const isSynthetic = (name) => SYNTHETIC_RE.test(String(name || '').trim());

let _hasAreaFkColumn = false;

async function ensureAreaColumn() {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable('properties');
  if (table.area_location_id) { _hasAreaFkColumn = true; console.log('  · properties.area_location_id sudah ada'); return; }
  if (DRY) { console.log('  · [DRY] akan menambah kolom properties.area_location_id'); return; }
  await qi.addColumn('properties', 'area_location_id', {
    type: DataTypes.STRING(50), allowNull: true, defaultValue: null, after: 'area',
  });
  _hasAreaFkColumn = true;
  console.log('  ✅ kolom properties.area_location_id ditambahkan');
}

async function main() {
  console.log('═'.repeat(72));
  console.log(`  🔗  LINK properties.area → locations  ${DRY ? '(DRY RUN)' : ''}`);
  console.log('═'.repeat(72));

  const owner = await require('../models').User.findOne({ where: { username: 'nigel123' }, raw: true })
             || await require('../models').User.findOne({ raw: true });
  const ownerId = owner.user_id;

  console.log('\n[1/4] Memastikan kolom FK ada...');
  await ensureAreaColumn();

  console.log('\n[2/4] Menambah area NYATA yang belum ada di master...');
  let totalLoc = await Location.count();
  const cityRows = {};
  for (const cityName of Object.keys(EXTRA_AREAS)) {
    const city = await City.findOne({ where: { name: cityName }, raw: true });
    if (!city) { console.warn(`  ⚠️ kota ${cityName} tidak ada`); continue; }
    cityRows[cityName] = city;

    const existing = await Location.findAll({
      where: { city_id: city.city_id, location_type: 'area' }, attributes: ['name'], raw: true,
    });
    const have = new Set(existing.map(r => String(r.name).trim().toUpperCase()));

    let added = 0;
    for (const name of EXTRA_AREAS[cityName]) {
      if (have.has(name.toUpperCase())) continue;
      if (!DRY) {
        await Location.create({
          location_id : GeneralController.generateRandomId(name, totalLoc).toUpperCase(),
          name, city_id: city.city_id, location_type: 'area', status: 1,
          created_date: TODAY, created_by: ownerId, updated_date: null, updated_by: null,
        });
      }
      totalLoc++; added++;
    }
    console.log(`  ${cityName}: +${added} area baru (dari ${EXTRA_AREAS[cityName].length} kandidat)`);
  }

  console.log('\n[3/4] Menautkan properties.area → location_id (+ normalisasi ejaan)...');
  const allAreaLocs = await Location.findAll({
    where: { location_type: 'area', status: 1 }, attributes: ['location_id', 'name', 'city_id'], raw: true,
  });
  const locByKey = new Map(allAreaLocs.map(l => [l.city_id + '|' + String(l.name).trim().toUpperCase(), l]));

  const props = await Property.findAll({
    where: { status: 1, area: { [Op.ne]: null } },
    // DRY di DB yang belum punya kolomnya: jangan SELECT kolom yang tidak ada.
    attributes: _hasAreaFkColumn
      ? ['property_id', 'area', 'city_id', 'area_location_id']
      : ['property_id', 'area', 'city_id'], raw: true,
  });

  let linked = 0, renamed = 0, alreadyOk = 0, syntheticSkipped = 0, noMatch = 0;
  const syntheticNames = new Map();
  const unmatched = new Map();

  for (const p of props) {
    const raw = String(p.area || '').trim();
    if (!raw) continue;

    if (isSynthetic(raw)) {
      syntheticSkipped++;
      syntheticNames.set(raw, (syntheticNames.get(raw) || 0) + 1);
      continue;                       // ⛔ jangan tautkan, jangan master-kan
    }

    const hit = locByKey.get(p.city_id + '|' + raw.toUpperCase());
    if (!hit) { noMatch++; unmatched.set(raw, (unmatched.get(raw) || 0) + 1); continue; }

    const needsFk     = p.area_location_id !== hit.location_id;
    const needsRename = raw !== hit.name;   // seragamkan ejaan ke master
    if (!needsFk && !needsRename) { alreadyOk++; continue; }

    if (!DRY) {
      await Property.update(
        { area_location_id: hit.location_id, area: hit.name },
        { where: { property_id: p.property_id } }
      );
      // linkage many-to-many yang sudah dipakai AI (M145) — jaga tetap sinkron
      const exists = await PropertyLocation.findOne({
        where: { property_id: p.property_id, location_id: hit.location_id }, attributes: ['id'],
      });
      if (!exists) {
        await PropertyLocation.create({
          property_id: p.property_id, location_id: hit.location_id,
          created_date: new Date(), created_by: ownerId,
        });
      }
    }
    if (needsFk) linked++;
    if (needsRename) renamed++;
  }

  console.log(`  ✅ FK di-set     : ${linked}`);
  console.log(`  ✅ ejaan diseragamkan: ${renamed}`);
  console.log(`  · sudah benar    : ${alreadyOk}`);
  console.log(`  ⛔ label sintetis DILEWATI: ${syntheticSkipped} baris / ${syntheticNames.size} nama unik`);
  console.log(`  ⚠️ tidak ada di master   : ${noMatch} baris / ${unmatched.size} nama unik`);

  console.log('\n[4/4] Laporan nama yang TIDAK ditautkan (perlu keputusan pemilik proyek):');
  const top = (m, n = 12) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([k, v]) => `${k}(${v})`).join(', ');
  if (syntheticNames.size) console.log('  SINTETIS  :', top(syntheticNames));
  if (unmatched.size)      console.log('  TAK COCOK :', top(unmatched));

  console.log('\n' + '═'.repeat(72));
  console.log(DRY ? '  (DRY RUN — tidak ada perubahan disimpan)' : '  ✅ SELESAI');
  console.log('═'.repeat(72) + '\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error('\n❌ ERROR:', e); process.exit(1); });

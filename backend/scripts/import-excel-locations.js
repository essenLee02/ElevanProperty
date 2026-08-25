'use strict';
/**
 * import-excel-locations.js — impor 800 area/landmark dari Excel + rapikan tipe (M147)
 * ---------------------------------------------------------------------------
 * Sumber: 800_Area_Landmark_Populer_DKI_Jakarta_Jawa_Barat_Jawa_Timur.xlsx
 *         (di-parse ke asset/json_data/excel_locations_800.json)
 *
 * ⛔ TEMUAN PENTING SEBELUM MENULIS KODE INI — BACA DULU:
 * Kolom "Kategori" di Excel TIDAK BISA DIPAKAI. Ke-800 barisnya berisi nilai
 * yang SAMA PERSIS: "Area/landmark populer". Jadi file itu tidak pernah
 * membedakan area vs landmark vs commercial sama sekali — bukan sebagian salah
 * kategori, tapi NOL informasi kategori. Klasifikasi di bawah karena itu
 * DISIMPULKAN DARI NAMA-nya, dan HARUS ditinjau manusia (skrip mencetak
 * ringkasan per tipe supaya bisa diperiksa cepat).
 *
 * Aturan tipe mengikuti models/Location.js:
 *   area       — kawasan/kompleks yang jadi IDENTITAS lingkungan properti
 *                (Citraland, Pakuwon Indah, Wiyung, Menteng, Dago).
 *                Termasuk koridor jalan ("Jalan Darmo") karena di iklan
 *                properti Indonesia itu dipakai sebagai identitas lokasi
 *                ("rumah di Jalan Darmo"), konsisten dengan Mayjend Sungkono /
 *                HR Muhammad yang sudah lebih dulu bertipe 'area'.
 *   landmark   — tempat publik/rekreasi sebagai PATOKAN (taman, museum,
 *                monumen, masjid, pantai, jembatan, alun-alun, candi).
 *   commercial — fasilitas komersial/publik yang jadi nilai jual (mall, plaza,
 *                trade center, pasar, kampus/sekolah, rumah sakit, bank,
 *                terminal, stasiun, bandara, hotel).
 *
 * Selain impor, skrip ini juga MEMPERBAIKI baris LAMA yang salah tipe —
 * ditemukan saat survei: "Pakuwon Trade Center (PTC)" dan 4 universitas
 * Surabaya tersimpan sebagai 'landmark', padahal mall & kampus masuk
 * 'commercial' menurut definisi model.
 *
 * Usage:
 *   node scripts/import-excel-locations.js --dry
 *   node scripts/import-excel-locations.js
 */
require('dotenv').config();
const path = require('path');
const { Op } = require('sequelize');
const { Location, City, User } = require('../models');
const GeneralController = require('../controllers/GeneralController');

const DRY   = process.argv.includes('--dry');
const TODAY = GeneralController.todayDate();
const SRC   = path.join(__dirname, '..', 'asset', 'json_data', 'excel_locations_800.json');

/* ══════════════════════════════════════════════════════════════════════════
   KLASIFIKASI — urutan dicek dari yang PALING SPESIFIK ke paling umum.
   Pola dipilih supaya tidak saling menelan: "Taman Anggrek" (mall di Jakarta)
   HARUS commercial, bukan landmark, walau diawali "Taman" — karena itu pola
   mall dicek LEBIH DULU daripada pola taman.
══════════════════════════════════════════════════════════════════════════ */
const COMMERCIAL_RE = [
  /\b(mall|mal|plaza|plazza|square|trade\s*center|trade\s*centre|town\s*square|city\s*walk|walk|junction|point|itc|wtc|emporium|pacific\s*place|grand\s*indonesia)\b/i,
  /\b(pasar|market|supermarket|hypermarket|hypermart|carrefour|giant|indomaret|alfamart|alfamaret)\b/i,
  /\b(universitas|university|kampus|institut|politeknik|sekolah|school|akademi|stikom|unair|ubaya|itb|ui|unpad)\b/i,
  /\b(rumah\s*sakit|\brs\b|rsud|rsup|hospital|klinik)\b/i,
  /\b(bank|terminal|stasiun|station|bandara|airport|pelabuhan|hotel)\b/i,
  /\b(g-?walk|east\s*coast\s*center|lenmarc|ciputra\s*world|grand\s*city)\b/i,
  // Perusahaan/pabrik = fasilitas komersial, bukan patokan wisata.
  // ⚠️ SENGAJA memakai "^pt " / "tbk" / "pabrik" dan BUKAN kata "industri":
  // "Rungkut Industri" adalah nama KAWASAN (area) di Surabaya — memakai
  // /industri/ akan salah memindahkannya ke commercial.
  /^pt\s|\btbk\b|\bpabrik\b/i,
];

const LANDMARK_RE = [
  /\b(taman|park|waterpark|kebun\s*binatang|zoo|hutan\s*kota|ragunan)\b/i,
  /\b(museum|monumen|monas|tugu|patung|prasasti)\b/i,
  /\b(masjid|mesjid|gereja|katedral|klenteng|vihara|pura|kuil|makam|candi)\b/i,
  /\b(pantai|beach|danau|waduk|situ|air\s*terjun|gunung|bukit\s*wisata)\b/i,
  /\b(jembatan|benteng|istana|keraton|alun-?alun|balai|gedung\s*sate|grahadi|planetarium|observatorium)\b/i,
  /\b(kota\s*tua|pecinan|kya-?kya|braga)\b/i,
  // Ruang publik hijau & objek wisata alam — ini PATOKAN lokasi, bukan
  // fasilitas komersial. Ditambahkan setelah rebuild pertama salah menaruh
  // "RUANG TERBUKA HIJAU" / "WISATA MANGROVE" / "KUIL BUDDHA" di commercial.
  /\b(ruang\s*terbuka\s*hijau|wisata|mangrove|hutan\s*raya|cagar\s*alam)\b/i,
];

/* ══════════════════════════════════════════════════════════════════════════
   OVERRIDE EKSPLISIT — nama yang pola regex-nya SALAH TEBAK.
   Diverifikasi satu per satu dengan meninjau SELURUH 72 hasil 'landmark' dan
   menyaring bucket 'area' untuk nama mall/tempat terkenal. Pattern matching
   saja tidak cukup di sini: nama administratif Indonesia sering memakai kata
   yang juga berarti tempat wisata.
══════════════════════════════════════════════════════════════════════════ */

/* Kelurahan/kecamatan/koridor jalan yang TERTANGKAP pola landmark padahal
   sebenarnya nama WILAYAH (identitas properti), bukan patokan wisata. */
const FORCE_AREA = new Set([
  'TAMAN SARI',          // kecamatan Jakarta Barat, bukan taman
  'JEMBATAN BESI',       // kelurahan Tambora, bukan jembatan
  'JEMBATAN LIMA',       // kelurahan Tambora, bukan jembatan
  'GUNUNG SAHARI',       // kawasan/koridor Jakarta Pusat, bukan gunung
  'JALAN GUNUNG SAHARI',
  'GUNUNG ANYAR',        // KECAMATAN Surabaya, bukan gunung
  'BRAGA',               // kawasan Bandung
  'JALAN BRAGA',
  // Perumahan/kompleks yang memakai kata 'Taman' - bukan taman kota:
  'TAMAN PALEM', 'TAMAN PALEM LESTARI', 'TAMAN RATU', 'TAMAN SEMANAN INDAH',
  // KELURAHAN Jakarta Utara, bukan tugu/monumen:
  'TUGU UTARA', 'TUGU SELATAN',
  // Kawasan hunian/komersial besar, bukan pantai wisata:
  'PANTAI INDAH KAPUK', 'PANTAI MUTIARA',
  // Kelurahan; kebun binatangnya terdaftar terpisah sbg 'Taman Margasatwa Ragunan':
  'RAGUNAN',
  // PERUMAHAN Surabaya — bukan objek wisata, walau namanya diawali "Wisata".
  // Tertangkap pola /wisata/ yang baru ditambahkan; ketahuan karena 15 properti
  // menunjuk ke sini lewat properties.area_location_id (FK area).
  'WISATA BUKIT MAS',
]);

/* Mall/pusat belanja yang TIDAK tertangkap pola commercial (namanya tidak
   memuat kata 'mall'/'plaza'), atau tertangkap pola landmark lebih dulu. */
const FORCE_COMMERCIAL = new Set([
  'CENTRAL PARK',        // mall Jakarta Barat (bukan taman)
  'TAMAN ANGGREK',       // mall Jakarta Barat (bukan taman)
  'KOTA KASABLANKA', 'KUNINGAN CITY', 'SENAYAN CITY', 'BLOK M HUB',
  'THAMRIN CITY', 'SARINAH',
  'TRANS STUDIO CIBUBUR', 'TRANS STUDIO BANDUNG',
  'PARIS VAN JAVA', '23 PASKAL', 'FESTIVAL CITYLINK',
]);

/* Koridor jalan & nama berawalan "Jalan" SELALU 'area': di iklan properti
   Indonesia itu identitas lokasi ("rumah di Jalan Darmo"), bukan patokan
   wisata. Tanpa aturan ini "Jalan Danau Sunter" tertangkap pola /danau/ dan
   "Jalan Pantai Indah Utara" tertangkap pola /pantai/ - keduanya salah. */
const ROAD_OR_CORRIDOR_RE = /^jalan\s|\bkoridor$/i;

function classify(name) {
  const key = String(name || '').trim().toUpperCase();
  if (FORCE_AREA.has(key))       return 'area';
  if (FORCE_COMMERCIAL.has(key)) return 'commercial';
  if (ROAD_OR_CORRIDOR_RE.test(String(name || '').trim())) return 'area';
  const n = String(name || '').trim();
  for (const re of COMMERCIAL_RE) if (re.test(n)) return 'commercial';
  for (const re of LANDMARK_RE)   if (re.test(n)) return 'landmark';
  return 'area';   // default: kawasan/kelurahan/koridor jalan
}

/* Baris LAMA yang tipenya perlu dikoreksi (ditemukan saat survei manual). */
const RETYPE_RULES = [
  { match: /trade\s*center|\bptc\b|mall|plaza|ciputra\s*world|grand\s*city|lenmarc|g-?walk|east\s*coast\s*center/i, to: 'commercial' },
  { match: /universitas|university|institut|kampus|politeknik|\bunair\b|\bubaya\b|\bistts\b/i, to: 'commercial' },
];

const norm = (s) => String(s || '').trim().toUpperCase();

async function main() {
  console.log('═'.repeat(74));
  console.log(`  📍  IMPOR 800 AREA/LANDMARK DARI EXCEL  ${DRY ? '(DRY RUN)' : ''}`);
  console.log('═'.repeat(74));

  const recs = require(SRC);
  const owner = await User.findOne({ where: { username: 'nigel123' }, raw: true })
             || await User.findOne({ raw: true });
  const ownerId = owner.user_id;

  /* ── 1. Klasifikasi + ringkasan untuk ditinjau manusia ─────────────────── */
  console.log('\n[1/4] Klasifikasi (DISIMPULKAN dari nama — kolom Kategori Excel tidak informatif)');
  const tally = { area: 0, landmark: 0, commercial: 0 };
  const samples = { area: [], landmark: [], commercial: [] };
  for (const r of recs) {
    const name = r['Area / Landmark Populer'];
    const t = classify(name);
    tally[t]++;
    if (samples[t].length < 8) samples[t].push(name);
  }
  for (const t of ['area', 'landmark', 'commercial']) {
    console.log(`  ${t.padEnd(11)}: ${String(tally[t]).padStart(3)}  contoh -> ${samples[t].join(', ')}`);
  }

  /* ── 2. Petakan kota Excel → cities.city_id ────────────────────────────── */
  console.log('\n[2/4] Memetakan kota Excel → tabel cities');
  const cityNames = [...new Set(recs.map(r => r['Kota/Kabupaten']))];
  const cityMap = new Map();
  for (const cn of cityNames) {
    const row = await City.findOne({ where: { name: norm(cn) }, raw: true });
    if (row) cityMap.set(cn, row);
    console.log(`  ${cn.padEnd(18)} -> ${row ? row.city_id : '⚠️ TIDAK ADA (baris kota ini dilewati)'}`);
  }

  /* ── 3. Sisipkan yang belum ada ────────────────────────────────────────── */
  console.log('\n[3/4] Menyisipkan lokasi yang BELUM ada di database');
  let total = await Location.count();
  const perCity = {};
  let added = 0, skipped = 0, noCity = 0;

  for (const r of recs) {
    const cityName = r['Kota/Kabupaten'];
    const name = String(r['Area / Landmark Populer'] || '').trim();
    if (!name) continue;
    const city = cityMap.get(cityName);
    if (!city) { noCity++; continue; }

    // Duplikat dicek per (nama, kota) — sesuai unique index uq_locations_name_city.
    const dupe = await Location.findOne({
      where: { city_id: city.city_id, name: { [Op.like]: name } },
      attributes: ['location_id'],
    });
    if (dupe) { skipped++; continue; }

    const type = classify(name);
    if (!DRY) {
      await Location.create({
        location_id : GeneralController.generateRandomId(name, total).toUpperCase(),
        name, city_id: city.city_id, location_type: type, status: 1,
        created_date: TODAY, created_by: ownerId, updated_date: null, updated_by: null,
      });
    }
    total++; added++;
    perCity[cityName] = perCity[cityName] || { area: 0, landmark: 0, commercial: 0 };
    perCity[cityName][type]++;
  }

  console.log(`  ✅ ditambahkan : ${added}`);
  console.log(`  · sudah ada    : ${skipped}`);
  if (noCity) console.log(`  ⚠️ kota tak dikenal: ${noCity} baris`);
  for (const [cn, d] of Object.entries(perCity)) {
    console.log(`     ${cn.padEnd(18)} area:${d.area} landmark:${d.landmark} commercial:${d.commercial}`);
  }

  /* ── 4. Koreksi tipe baris LAMA yang salah kategori ────────────────────── */
  console.log('\n[4/4] Mengoreksi tipe baris LAMA yang salah kategori');
  let retyped = 0;
  const retypedNames = [];
  for (const rule of RETYPE_RULES) {
    const rows = await Location.findAll({
      where: { status: 1, location_type: { [Op.ne]: rule.to } },
      attributes: ['location_id', 'name', 'location_type'], raw: true,
    });
    for (const row of rows) {
      if (!rule.match.test(row.name)) continue;
      if (!DRY) {
        await Location.update(
          { location_type: rule.to, updated_date: TODAY, updated_by: ownerId },
          { where: { location_id: row.location_id } }
        );
      }
      retyped++;
      if (retypedNames.length < 12) retypedNames.push(`${row.name} (${row.location_type}→${rule.to})`);
    }
  }
  console.log(`  ✅ tipe dikoreksi: ${retyped}`);
  if (retypedNames.length) console.log('     ' + retypedNames.join('\n     '));

  console.log('\n' + '═'.repeat(74));
  console.log(DRY ? '  (DRY RUN — tidak ada perubahan disimpan)' : '  ✅ SELESAI');
  console.log('═'.repeat(74) + '\n');
}

/* JANGAN auto-jalan saat di-require. Pelajaran mahal: skrip ini sempat
   ter-eksekusi PENUH (tanpa --dry) DUA KALI hanya karena di-require untuk
   memakai ulang classify(), menulis ratusan baris ke DB dengan klasifikasi
   versi lama. require.main === module membuat impor untuk reuse jadi aman. */
if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error('\n❌ ERROR:', e); process.exit(1); });
}

module.exports = { classify, COMMERCIAL_RE, LANDMARK_RE, FORCE_AREA, FORCE_COMMERCIAL };

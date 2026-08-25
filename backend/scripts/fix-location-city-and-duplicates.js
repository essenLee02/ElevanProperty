'use strict';
/**
 * fix-location-city-and-duplicates.js — rapikan master `locations` (M149)
 * ----------------------------------------------------------------------
 * Directive pemilik proyek (25 Agu 2026):
 *   "Pada query tersebut, ada data kembar seperti Wiyung, update salah satu
 *    kembar itu ke area kota lain. Saya menemukan data area dan landmark di
 *    Bali, namun kotanya kosong, update untuk diisi kotanya. Cek lokasi lain,
 *    agar lebih menyesuaikan lagi."
 *
 * KENAPA PICKER BUTUH INI
 * Aturan picker yang baru: area & landmark HARUS sekota dengan properti, dan
 * hanya baris TANPA kota + bertipe commercial yang boleh muncul di mana saja.
 * Akibatnya landmark tanpa kota (CANDI BOROBUDUR, PURA TANAH LOT) TIDAK PERNAH
 * muncul di picker mana pun — datanya ada tapi mati. Skrip ini memperbaiki
 * sumbernya, bukan menambal query-nya.
 *
 * TIGA PERLAKUAN
 *  1. NAMED  → landmark bernama yang nyata dapat city_id sebenarnya
 *              (CANDI BOROBUDUR → MAGELANG, PURA TANAH LOT → TABANAN).
 *  2. GENERIC→ kategori umum (MASJID SETEMPAT, TAMAN KOTA, VIHARA) diubah
 *              jadi 'commercial' tanpa kota, sederajat dengan ALFAMART:
 *              memang ada di setiap kota, jadi memang harus bebas kota.
 *  3. DUP    → sisa impor Excel HURUF BESAR tanpa kota yang namanya sudah ada
 *              sebagai area/landmark ber-kota → dinonaktifkan (status = 3),
 *              link property_locations-nya dipindah ke baris kanonik.
 *
 * ⚠️ CATATAN JUJUR SOAL "PINDAHKAN KEMBARAN KE MADIUN/KEDIRI"
 * Untuk kembaran sejati, memindahkan salah satunya ke Madiun/Kediri akan
 * MENULIS DATA GEOGRAFIS PALSU: tidak ada kawasan bernama Wiyung di Madiun,
 * dan tabel ini dipakai chatbot untuk menjawab customer. Tujuan sebenarnya —
 * "jangan ada kembar di picker" — dicapai lebih benar dengan menonaktifkan
 * duplikatnya. Itu yang dilakukan di sini.
 * Nama sama yang SAH di beberapa kota (Jalan Ahmad Yani di Bandung/Jakarta/
 * Surabaya, Manyar di Gresik & Surabaya) BUKAN kembaran — jangan disentuh.
 *
 * Usage:
 *   node scripts/fix-location-city-and-duplicates.js --dry
 *   node scripts/fix-location-city-and-duplicates.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DRY = process.argv.includes('--dry');
const cfg = (k) => String(process.env[k] || '').split('#')[0].trim();

/**
 * Landmark/tempat bernama nyata → kota sebenarnya.
 * Hanya diisi bila lokasinya memang tunggal & tidak ambigu. Yang membentang di
 * banyak kabupaten (DANAU TOBA) sengaja DIKOSONGKAN daripada ditebak.
 */
const NAMED_CITY = {
  'BALI SAFARI PARK'          : 'GIANYAR',
  'CANDI BOROBUDUR'           : 'MAGELANG',
  'CANDI PRAMBANAN'           : 'SLEMAN',
  'CANDI SEMARANG'            : 'SEMARANG',
  'GEDUNG SATE'               : 'BANDUNG',
  'GUNUNG BROMO'              : 'PROBOLINGGO',
  'ISTANA MAIMUN'             : 'MEDAN',
  'JALAN BRAGA'               : 'BANDUNG',
  'JATIM PARK 1'              : 'BATU',
  'JATIM PARK 2'              : 'BATU',
  'JATIM PARK 3'              : 'BATU',
  'JEMBATAN AMPERA'           : 'PALEMBANG',
  'JEMBATAN SITI NURBAYA'     : 'PADANG',
  'JEMBATAN SURAMADU'         : 'SURABAYA',
  'KEBUN BINATANG RAGUNAN'    : 'JAKARTA SELATAN',
  'KEBUN BINATANG SURABAYA'   : 'SURABAYA',
  'KERATON YOGYAKARTA'        : 'YOGYAKARTA',
  'KOTA TUA JAKARTA'          : 'JAKARTA BARAT',
  'MASJID AGUNG JAWA TENGAH'  : 'SEMARANG',
  'MASJID AL AKBAR'           : 'SURABAYA',
  'MASJID RAYA MEDAN'         : 'MEDAN',
  'MONUMEN NASIONAL'          : 'JAKARTA PUSAT',
  'MUSEUM ANGKUT'             : 'BATU',
  'MUSEUM FATAHILLAH'         : 'JAKARTA BARAT',
  'PANTAI ANCOL'              : 'JAKARTA UTARA',
  'PANTAI BALEKAMBANG'        : 'MALANG',
  'PANTAI CANGGU'             : 'BADUNG',
  'PANTAI JIMBARAN'           : 'BADUNG',
  'PANTAI KEMALA'             : 'BALIKPAPAN',
  'PANTAI KUTA'               : 'BADUNG',
  'PANTAI LOSARI'             : 'MAKASSAR',
  'PANTAI NUSA DUA'           : 'BADUNG',
  'PANTAI PADANG'             : 'PADANG',
  'PANTAI PANDAWA'            : 'BADUNG',
  'PANTAI PARANGTRITIS'       : 'BANTUL',
  'PANTAI SANUR'              : 'DENPASAR',
  'PANTAI SEMINYAK'           : 'BADUNG',
  'PANTAI ULUWATU'            : 'BADUNG',
  'PURA BESAKIH'              : 'KARANGASEM',
  'PURA TANAH LOT'            : 'TABANAN',
  'PURA ULUN DANU BERATAN'    : 'TABANAN',
  'PURA ULUWATU'              : 'BADUNG',
  'STASIUN TUGU'              : 'YOGYAKARTA',
  'TAMAN BUNGKUL'             : 'SURABAYA',
  'TAMAN FLORA'               : 'SURABAYA',
  'TAMAN MINI INDONESIA INDAH': 'JAKARTA TIMUR',
  'TERMINAL UBUNG'            : 'DENPASAR',
  'TUGU JOGJA'                : 'YOGYAKARTA',
  'TUGU KHATULISTIWA'         : 'PONTIANAK',
  'TUGU PAHLAWAN'             : 'SURABAYA',
  'UBUD'                      : 'GIANYAR',
  'WATERBOM BALI'             : 'BADUNG',
  'WISATA MANGROVE WONOREJO'  : 'SURABAYA',
  'ZOO/KEBUN BINATANG SURABAYA': 'SURABAYA',
  // mall bernama yang sempat tersimpan sebagai landmark tanpa kota
  'CENTRAL PARK MALL'         : 'JAKARTA BARAT',
  'MALL TAMAN ANGGREK'        : 'JAKARTA BARAT',
  'TUNJUNGAN PLAZA (TP)'      : 'SURABAYA',
};

/**
 * Kategori umum: ada di hampir setiap kota, jadi diperlakukan seperti
 * ALFAMART/INDOMARET → commercial, city_id NULL, bebas kota.
 */
const GENERIC = new Set([
  'BALAI PERTEMUAN', 'GEREJA KATOLIK', 'GEREJA PROTESTAN', 'GEREJA SETEMPAT',
  'KUIL BUDDHA', 'KUIL HINDU', 'MASJID BESAR', 'MASJID KECIL', 'MASJID SETEMPAT',
  'MUSEUM SENI', 'PANTAI PUBLIK', 'PURA SETEMPAT', 'RUANG TERBUKA HIJAU',
  'TAMAN BERMAIN ANAK', 'TAMAN BOTANI', 'TAMAN HIBURAN', 'TAMAN KANAK-KANAK',
  'TAMAN KOTA', 'TAMAN RT/RW', 'VIHARA', 'VIHARA SETEMPAT', 'WISATA MANGROVE',
]);

async function main() {
  console.log('='.repeat(72));
  console.log(`  PERBAIKAN MASTER LOCATIONS (M149)${DRY ? '  [DRY RUN]' : ''}`);
  console.log('='.repeat(72));

  const c = await mysql.createConnection({
    host: cfg('DB_HOST'), user: cfg('DB_USER'),
    password: cfg('DB_PASSWORD'), database: cfg('DB_NAME'),
  });

  const [cities] = await c.query('SELECT city_id, name FROM cities WHERE status = 1');
  const cityId = new Map(cities.map((x) => [String(x.name).toUpperCase(), x.city_id]));

  // Nama kanonik = baris yang SUDAH punya kota (area/landmark).
  const [canon] = await c.query(
    "SELECT location_id, name, city_id, location_type FROM locations " +
    "WHERE status = 1 AND city_id IS NOT NULL AND location_type IN ('area','landmark')"
  );
  const canonByName = new Map();
  for (const r of canon) {
    const k = String(r.name).trim().toUpperCase();
    if (!canonByName.has(k)) canonByName.set(k, r);
  }

  // Ada unique index uq_locations_name_city pada (name, city_id). Jadi mengisi
  // kota bisa BENTROK dengan baris yang sudah ada — dan kalau bentrok, artinya
  // baris tanpa kota itu memang KEMBARAN, bukan sekadar kurang kota. Peta ini
  // dipakai untuk mengalihkannya ke jalur merge. (Ketahuan saat eksekusi:
  // CENTRAL PARK MALL sudah ada di Jakarta Barat.)
  const [allRows] = await c.query(
    'SELECT location_id, name, city_id FROM locations WHERE status = 1 AND city_id IS NOT NULL'
  );
  const byNameCity = new Map(
    allRows.map((r) => [`${String(r.name).trim().toUpperCase()}::${r.city_id}`, r])
  );

  // Kandidat: semua baris aktif TANPA kota.
  const [cand] = await c.query(
    'SELECT location_id, name, location_type FROM locations WHERE status = 1 AND city_id IS NULL'
  );

  const setCity = [];     // [location_id, city_id, name, cityName]
  const toGeneric = [];   // [location_id, name]
  const dups = [];        // [location_id, name, canonId, canonCity]
  const unresolved = [];

  for (const r of cand) {
    const key = String(r.name).trim().toUpperCase();

    if (GENERIC.has(key)) { toGeneric.push([r.location_id, r.name]); continue; }

    if (NAMED_CITY[key]) {
      const cid = cityId.get(NAMED_CITY[key]);
      if (!cid) { unresolved.push(`${r.name} → kota "${NAMED_CITY[key]}" tidak ada di master`); continue; }
      // Sudah ada baris bernama sama di kota itu → ini kembaran, bukan sekadar
      // kurang kota. Lebur ke baris yang sudah ada, jangan tabrak unique index.
      const clash = byNameCity.get(`${key}::${cid}`);
      if (clash) { dups.push([r.location_id, r.name, clash.location_id, cid]); continue; }
      setCity.push([r.location_id, cid, r.name, NAMED_CITY[key]]);
      byNameCity.set(`${key}::${cid}`, r);   // cegah dua kandidat rebutan slot sama
      continue;
    }

    // Kembaran sisa impor: namanya sudah ada sebagai area/landmark ber-kota.
    const hit = canonByName.get(key);
    if (hit) { dups.push([r.location_id, r.name, hit.location_id, hit.city_id]); continue; }

    if (r.location_type === 'landmark') unresolved.push(`${r.name} (landmark tanpa kota, belum dipetakan)`);
  }

  console.log(`\nDiisi kotanya      : ${setCity.length}`);
  setCity.slice(0, 8).forEach(([, , n, cy]) => console.log(`   ${n} → ${cy}`));
  if (setCity.length > 8) console.log(`   ... dan ${setCity.length - 8} lagi`);

  console.log(`\nJadi generik (commercial, bebas kota): ${toGeneric.length}`);
  console.log('   ' + toGeneric.slice(0, 10).map(([, n]) => n).join(', '));

  console.log(`\nKembaran dinonaktifkan: ${dups.length}`);
  dups.slice(0, 10).forEach(([, n, cid]) => console.log(`   ${n} → dilebur ke ${cid}`));

  console.log(`\nBelum terpetakan (dibiarkan, tidak ditebak): ${unresolved.length}`);
  unresolved.forEach((u) => console.log(`   ${u}`));

  if (DRY) { console.log('\n(DRY RUN - tidak menulis)\n'); await c.end(); return; }

  // 1) isi kota
  for (const [lid, cid] of setCity) {
    await c.query('UPDATE locations SET city_id = ? WHERE location_id = ?', [cid, lid]);
  }
  // 2) generik → commercial tanpa kota
  for (const [lid] of toGeneric) {
    await c.query("UPDATE locations SET location_type = 'commercial', city_id = NULL WHERE location_id = ?", [lid]);
  }
  // 3) kembaran: pindahkan link dulu, baru nonaktifkan (jangan sampai
  //    property_locations menunjuk baris mati).
  let moved = 0;
  for (const [lid, , canonId] of dups) {
    const [links] = await c.query('SELECT property_id FROM property_locations WHERE location_id = ?', [lid]);
    for (const l of links) {
      // INSERT IGNORE: properti bisa saja sudah punya baris kanoniknya.
      await c.query(
        'INSERT IGNORE INTO property_locations (property_id, location_id, created_date) VALUES (?,?,NOW())',
        [l.property_id, canonId]
      );
      moved++;
    }
    await c.query('DELETE FROM property_locations WHERE location_id = ?', [lid]);
    await c.query('UPDATE locations SET status = 3 WHERE location_id = ?', [lid]);
  }

  console.log(`\nSELESAI — kota diisi: ${setCity.length}, generik: ${toGeneric.length}, ` +
              `kembaran dinonaktifkan: ${dups.length} (link dipindah: ${moved})\n`);
  await c.end();
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}

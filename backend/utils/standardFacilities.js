/**
 * standardFacilities.js
 *
 * Fasilitas STANDAR per tipe properti (hotel, villa, kos, house, dll.) —
 * satu sumber kebenaran, dipakai oleh:
 *   - chatbotPrivateController.js  → mengisi summary saat customer bilang "standar"
 *   - propertyRecommendationService → fallback rekomendasi saat katalog agent
 *     TIDAK menemukan data (perluas dengan fasilitas standar sesuai tipe).
 *
 * Basis: tabel "Fasilitas Standar per Tipe Properti" di skill docs
 * (12-facilities-reference.md). Untuk tipe hunian (house/apartment/villa/condo/
 * boarding_house/mansion), furnishing full/semi menambah perabot/elektronik.
 * Tipe komersial (ruko/kantor/gudang/toko) tidak bergantung furnishing.
 *
 * PREMIUM TIER (28 Jul 2026): fasilitas tambahan yang HANYA muncul ketika
 * customer menyebut kata premium/eksklusif (lihat wantsPremiumFacilities) —
 * di-APPEND setelah fasilitas standar, tidak pernah menggantikannya.
 */

'use strict';

/**
 * @param {string} buildingType - key katalog (house, apartment, villa, hotel, …)
 * @param {string} [furnishing] - 'full' | 'semi' | '' (opsional; hanya untuk hunian)
 * @returns {string|null} daftar fasilitas dipisah koma, atau null bila tipe tak dikenal
 */
function getStandardFacilitiesByType(buildingType, furnishing = '') {
  const type = (buildingType || '').toLowerCase();
  const furn = (furnishing || '').toLowerCase();
  const isFull = /fully|full/.test(furn);
  const isSemi = /semi/.test(furn);

  if (type === 'house' || type === 'kontrakan') {
    const base = 'Kamar Tidur, Kamar Mandi, Ruang Tamu, Ruang Keluarga, Dapur, Ruang Makan, '
      + 'Listrik, Air PDAM/Sumur, Carport/Garasi, Halaman Depan, Halaman Belakang, Pagar, '
      + 'Tempat Jemuran, Instalasi TV, Keamanan Lingkungan, Akses Kendaraan Roda Empat';
    if (isFull) return `AC, Kitchen Set, Lemari, Tempat Tidur, TV, Kulkas, CCTV, Water Heater, Internet/Wi-Fi, ${base}`;
    if (isSemi) return `AC, Kitchen Set, Lemari, Kulkas, CCTV, ${base}`;
    return base;
  }
  if (type === 'apartment') {
    const base = 'Kamar Tidur, Kamar Mandi, Ruang Tamu, Pantry/Kitchen Set, AC, Water Heater, '
      + 'Listrik, Air, Wi-Fi, TV, Lift, Parkir, Lobby, Keamanan 24 Jam, CCTV, Akses Kartu';
    if (isFull) return `Lemari Pakaian, Tempat Tidur, Sofa, Meja Makan, Kulkas, Kompor, Microwave, Mesin Cuci, ${base}`;
    if (isSemi) return `Lemari Pakaian, Kulkas, Kompor, ${base}`;
    return base;
  }
  if (type === 'condo') {
    const base = 'Kamar Tidur, Kamar Mandi, Ruang Tamu, Dapur, Kitchen Set, AC, Water Heater, Wi-Fi, TV, '
      + 'Balkon, Lift, Parkir, Keamanan 24 Jam, CCTV, Access Card, Gym, Kolam Renang, Jogging Track, Taman';
    if (isFull) return `Kulkas, Kompor, Microwave, Oven, Mesin Cuci, Sofa, Meja Makan, Tempat Tidur, Lemari Pakaian, ${base}`;
    if (isSemi) return `Kulkas, Kompor, Lemari Pakaian, ${base}`;
    return base;
  }
  if (type === 'boarding_house') {
    const base = 'Tempat Tidur, Kasur, Lemari Pakaian, Meja Belajar, Kursi, Kamar Mandi Dalam/Luar, '
      + 'Listrik, Air, Jendela, Jemuran, Parkir Motor, CCTV, Keamanan, Ruang Tamu Bersama';
    if (isFull) return `AC, Wi-Fi, Akses Dapur Bersama, Dispenser Bersama, Kulkas Bersama, Parkir Mobil, Akses 24 Jam, Laundry, ${base}`;
    if (isSemi) return `AC, Wi-Fi, Akses Dapur Bersama, ${base}`;
    return base;
  }
  if (type === 'villa') {
    const base = 'Kamar Tidur, Kamar Mandi, Ruang Keluarga, Ruang Makan, Dapur Lengkap, Kitchen Set, '
      + 'AC, Wi-Fi, TV, Taman, Balkon, Teras, Parkir Mobil, Keamanan, CCTV';
    if (isFull) return `Kulkas, Kompor, Microwave, Dispenser, Mesin Cuci, Gazebo, Kolam Renang Pribadi, BBQ Area, Garasi, Pemandangan Alam, Housekeeping, ${base}`;
    if (isSemi) return `Kulkas, Kompor, Dispenser, Kolam Renang Pribadi, ${base}`;
    return base;
  }
  if (type === 'hotel') {
    return 'Tempat Tidur, Kamar Mandi Dalam, Shower, Water Heater, AC, TV, Wi-Fi Gratis, Meja Kerja, '
      + 'Lemari Pakaian, Telepon, Ketel Listrik, Air Mineral, Kopi & Teh, Perlengkapan Mandi, Handuk, '
      + 'Sandal Hotel, Housekeeping, Resepsionis 24 Jam, Restoran, Area Parkir, Lift, Keamanan 24 Jam, CCTV';
  }
  if (type === 'kondotel') {
    return 'Tempat Tidur, Kamar Mandi Dalam, Shower, Water Heater, AC, TV, Wi-Fi, Kitchenette, '
      + 'Lemari Pakaian, Housekeeping, Resepsionis, Lift, Parkir, Keamanan 24 Jam, CCTV, Kolam Renang, Gym';
  }
  if (type === 'mansion') {
    return 'Banyak Kamar Tidur, Beberapa Kamar Mandi, Master Bedroom, Walk-in Closet, Ruang Tamu Besar, '
      + 'Ruang Keluarga, Ruang Makan, Dapur Utama, Dapur Bersih, Dapur Kotor, Ruang Kerja, AC Sentral, '
      + 'Water Heater, Wi-Fi, CCTV, Alarm, Garasi Beberapa Mobil, Carport, Taman Depan, Taman Belakang, '
      + 'Kolam Renang Pribadi, Balkon, Gudang, Kamar ART, Kamar Sopir, Keamanan 24 Jam';
  }
  if (type === 'shophouse' || type === 'ruko') {
    return 'Bangunan Utama, Area Usaha, Toilet, Listrik, Air, Area Parkir, Rolling Door, Gudang Kecil, '
      + 'Lantai Usaha, Jaringan Internet, Telepon, Keamanan, Akses Kendaraan Besar, Area Loading, Papan Nama Usaha';
  }
  if (type === 'office' || type === 'kantor') {
    return 'Ruang Kerja, Ruang Meeting, Ruang Resepsionis, Pantry, Toilet, AC, Listrik, Air, Internet, '
      + 'Wi-Fi, Telepon, Lift, Parkir Mobil, Parkir Motor, Keamanan 24 Jam, CCTV, Akses Kartu, Lobby';
  }
  if (type === 'warehouse' || type === 'gudang') {
    return 'Area Gudang, Toilet, Listrik, Air, Akses Truk, Loading Dock, Area Bongkar Muat, '
      + 'Parkir Truk, Parkir Mobil, Parkir Motor, Plafon Tinggi, Ventilasi, CCTV, Keamanan 24 Jam, Pagar, Jalan Beton';
  }
  if (type === 'store' || type === 'toko') {
    return 'Area Display, Gudang Kecil, Toilet, Listrik, Air, Lampu, Rolling Door, Internet, '
      + 'Parkir Pelanggan, Papan Nama Toko, Akses Kendaraan';
  }
  return null;
}

/**
 * Fasilitas PREMIUM — hanya ditambahkan (di-APPEND, tidak menggantikan
 * fasilitas standar) ketika customer secara eksplisit meminta properti
 * mewah/eksklusif (lihat wantsPremiumFacilities). Daftar ini generik lintas
 * tipe properti — bukan semuanya relevan untuk setiap tipe (mis. "Private
 * Beach Access" jarang untuk apartemen kota), jadi AI harus memilih yang
 * masuk akal untuk tipe+lokasi yang dibicarakan, bukan mendaftar semuanya
 * mentah-mentah.
 * @returns {string} daftar fasilitas premium, dipisah koma
 */
function getPremiumFacilities() {
  return [
    'Smart Home System', 'Smart Door Lock', 'Fingerprint Access', 'Lift Pribadi',
    'Private Pool', 'Jacuzzi', 'Sauna', 'Gym', 'Rooftop Garden', 'BBQ Area',
    'Playground', 'Jogging Track', 'Tennis Court', 'Basketball Court',
    'Function Hall', 'Ballroom', 'Concierge', 'Shuttle Service',
    'EV Charging Station', 'Solar Panel', 'Backup Generator (Genset)',
    'Water Treatment System', 'Pet Friendly', 'Ocean View', 'Mountain View',
    'City View', 'Lake View', 'River View', 'Private Beach Access',
  ].join(', ');
}

/**
 * Does the customer's message signal they want a PREMIUM/exclusive property?
 * Triggers: mewah, eksklusif, premium, luxury, "fully furnished" (per product
 * spec — a deliberate choice, even though "fully furnished" alone is also a
 * normal furnishing-tier answer for an ordinary unit; the AI is expected to
 * use judgement about whether premium facilities are actually relevant to
 * suggest, not blindly append the whole premium list every time).
 * Also fires when the customer already picked the "eksklusif" BUDGET tier
 * (Q3) — reuses that existing signal rather than a second, separate keyword
 * check for essentially the same intent.
 * @param {string} text - customer message (or accumulated session text)
 * @param {string} [budgetTier] - e.g. profile's resolved budget tier/preference text
 * @returns {boolean}
 */
function wantsPremiumFacilities(text = '', budgetTier = '') {
  const t = String(text).toLowerCase();
  const tier = String(budgetTier).toLowerCase();
  return /\b(mewah|eksklusif|premium|luxury|fully\s*furnished|full\s*furnished)\b/i.test(t)
    || /\beksklusif\b/i.test(tier);
}

/** Marker internal yang disimpan state saat customer menjawab "standar/terserah". */
const STANDARD_MARKER = 'standar';

/** Fallback bila tipe properti belum diketahui saat marker perlu diekspansi. */
const GENERIC_STANDARD = 'Kamar Tidur, Kamar Mandi, Listrik, Air, Parkir, Keamanan';

/**
 * Ganti marker `'standar'` dengan daftar fasilitas NYATA sesuai tipe properti.
 *
 * BUG PRODUKSI (Surabaya beli-rumah, 5 Agu 2026): customer menjawab "Fasilitas
 * standar", ekstraktor menyimpan marker internal `['standar']`, dan marker itu
 * tampil apa adanya di summary sebagai "✓ Fasilitas: Standar" — satu kata tanpa
 * isi, tidak berguna bagi agent maupun customer.
 *
 * ⚠️ Marker tetap DISIMPAN di state; ekspansi hanya saat RENDER. Tipe properti
 * bisa berganti di tengah sesi (rumah → apartemen), jadi menyimpan marker
 * menjaga jawaban customer tetap utuh ("dia bilang standar") sambil membiarkan
 * daftarnya mengikuti tipe terakhir.
 *
 * Urutan: item SPESIFIK customer lebih dulu, standar menyusul — yang ia sebut
 * sendiri adalah yang paling ia pedulikan. Dedup case-insensitive supaya item
 * yang kebetulan ada di kedua daftar ("AC") tidak tampil dua kali.
 *
 * @param {string[]|null} facilities daftar dari state (boleh mengandung marker)
 * @param {string|null} buildingType enum tipe properti
 * @param {string} [furnishing] diteruskan ke getStandardFacilitiesByType()
 * @returns {string[]} daftar siap tampil (tanpa marker internal)
 */
function expandStandardFacilities(facilities, buildingType, furnishing = '') {
  const list = Array.isArray(facilities) ? facilities : [];
  if (!list.length) return [];

  const isMarker = (f) => String(f || '').trim().toLowerCase() === STANDARD_MARKER;
  if (!list.some(isMarker)) return list.slice();   // tak ada marker → apa adanya

  const specific = list.filter(f => !isMarker(f));
  const standardStr = getStandardFacilitiesByType(buildingType, furnishing) || GENERIC_STANDARD;

  const out = [];
  const seen = new Set();
  for (const item of [...specific, ...standardStr.split(',')]) {
    const val = String(item).trim();
    if (!val) continue;
    const key = val.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(val);
  }
  return out;
}

module.exports = {
  getStandardFacilitiesByType,
  getPremiumFacilities,
  wantsPremiumFacilities,
  expandStandardFacilities,
  STANDARD_MARKER,
};

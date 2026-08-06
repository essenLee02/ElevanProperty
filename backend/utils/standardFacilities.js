/**
 * standardFacilities.js — SINGLE SOURCE OF TRUTH untuk fasilitas per tipe properti.
 *
 * Dipakai saat customer menjawab pertanyaan fasilitas (Q_FAC) dengan
 * "standar saja" / "terserah" / "bebas", dan sebagai fallback saat katalog
 * kosong (propertyRecommendationService).
 *
 * Konsumen:
 *   • controllers/chatbotPrivateController.js → getStandardFacilitiesByType(),
 *     wantsPremiumFacilities()
 *   • services/propertyRecommendationService.js → getStandardFacilitiesByType()
 *   • services/aiPromptBuilderService.js → expandStandardFacilities()
 *
 * ⛔ JANGAN meng-inline ulang daftar per-tipe di konsumen mana pun — duplikasi
 * itulah yang dulu membuat daftar di Private Agent melenceng dari tabel kanonik.
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════════
   TABEL KANONIK — fasilitas standar per tipe properti
   Item "(opsional)" pada tabel sumber SENGAJA tidak masuk daftar inti: yang
   ditampilkan adalah fasilitas yang lazim ADA, bukan yang mungkin ada.
   Menjanjikan fasilitas opsional sebagai "standar" berisiko jadi ekspektasi
   yang tidak terpenuhi saat viewing.
══════════════════════════════════════════════════════════════════════════════ */

const STANDARD_FACILITIES = {
  house: [
    'Kamar Tidur', 'Kamar Mandi', 'Ruang Tamu', 'Ruang Keluarga', 'Dapur',
    'Ruang Makan', 'Listrik', 'Air PDAM/Sumur', 'Carport/Garasi',
    'Halaman Depan', 'Halaman Belakang', 'Pagar', 'Tempat Jemuran',
    'Instalasi TV', 'Keamanan Lingkungan', 'Akses Mobil',
  ],
  apartment: [
    'Kamar Tidur', 'Kamar Mandi', 'Ruang Tamu', 'Pantry/Kitchen Set', 'AC',
    'Water Heater', 'Listrik', 'Air', 'Wi-Fi', 'TV', 'Lemari Pakaian',
    'Tempat Tidur', 'Sofa', 'Meja Makan', 'Kulkas', 'Kompor', 'Lift',
    'Parkir', 'Lobby', 'Keamanan 24 Jam', 'CCTV', 'Access Card', 'Gym',
    'Kolam Renang', 'Taman', 'Minimarket',
  ],
  hotel: [
    'Tempat Tidur', 'Kamar Mandi Dalam', 'Shower', 'Water Heater', 'AC', 'TV',
    'Wi-Fi Gratis', 'Meja Kerja', 'Lemari Pakaian', 'Telepon', 'Ketel Listrik',
    'Air Mineral', 'Kopi & Teh', 'Perlengkapan Mandi', 'Handuk',
    'Sandal Hotel', 'Housekeeping', 'Resepsionis 24 Jam', 'Restoran',
    'Area Parkir', 'Lift', 'Keamanan 24 Jam', 'CCTV',
  ],
  villa: [
    'Kamar Tidur', 'Kamar Mandi', 'Ruang Keluarga', 'Ruang Makan',
    'Dapur Lengkap', 'Kitchen Set', 'AC', 'Wi-Fi', 'TV', 'Kulkas', 'Kompor',
    'Microwave', 'Dispenser', 'Taman', 'Balkon', 'Teras', 'Parkir Mobil',
    'Keamanan',
  ],
  boarding_house: [
    'Tempat Tidur', 'Kasur', 'Lemari Pakaian', 'Meja Belajar', 'Kursi',
    'Kamar Mandi (Dalam/Luar)', 'Listrik', 'Air', 'Wi-Fi',
    'AC atau Kipas Angin', 'Jendela', 'Jemuran', 'Parkir Motor', 'CCTV',
    'Keamanan', 'Ruang Tamu Bersama',
  ],
  shophouse: [
    'Bangunan Utama', 'Area Usaha', 'Toilet', 'Listrik', 'Air', 'Area Parkir',
    'Rolling Door', 'Gudang Kecil', 'Lantai Usaha', 'Tangga',
    'Jaringan Internet', 'Telepon', 'Keamanan', 'Akses Kendaraan Besar',
    'Area Loading', 'Papan Nama Usaha',
  ],
  office: [
    'Ruang Kerja', 'Ruang Meeting', 'Ruang Resepsionis', 'Pantry', 'Toilet',
    'AC', 'Listrik', 'Air', 'Internet', 'Wi-Fi', 'Telepon', 'Lift',
    'Parkir Mobil', 'Parkir Motor', 'Keamanan 24 Jam', 'CCTV', 'Access Card',
    'Genset', 'Cleaning Service', 'Lobby',
  ],
  warehouse: [
    'Area Gudang', 'Toilet', 'Listrik', 'Air', 'Akses Truk', 'Loading Dock',
    'Area Bongkar Muat', 'Parkir Truk', 'Parkir Mobil', 'Parkir Motor',
    'Plafon Tinggi', 'Ventilasi', 'CCTV', 'Keamanan 24 Jam', 'Pagar',
    'Jalan Beton', 'Akses Kontainer',
  ],
  store: [
    'Area Display', 'Gudang Kecil', 'Toilet', 'Listrik', 'Air', 'Lampu',
    'Rolling Door', 'Internet', 'Parkir Pelanggan', 'Papan Nama Toko',
    'Akses Kendaraan',
  ],
  condo: [
    'Kamar Tidur', 'Kamar Mandi', 'Ruang Tamu', 'Dapur', 'Kitchen Set', 'AC',
    'Water Heater', 'Wi-Fi', 'TV', 'Kulkas', 'Kompor', 'Microwave',
    'Mesin Cuci', 'Balkon', 'Sofa', 'Meja Makan', 'Tempat Tidur',
    'Lemari Pakaian', 'Lift', 'Parkir', 'Keamanan 24 Jam', 'CCTV',
    'Access Card', 'Gym', 'Kolam Renang', 'Jogging Track', 'Taman',
    'Playground',
  ],
  mansion: [
    'Banyak Kamar Tidur', 'Beberapa Kamar Mandi', 'Master Bedroom',
    'Walk-in Closet', 'Ruang Tamu Besar', 'Ruang Keluarga', 'Ruang Makan',
    'Dapur Utama', 'Dapur Bersih', 'Dapur Kotor', 'Ruang Kerja',
    'Ruang Hiburan', 'AC Sentral', 'Water Heater', 'Smart Home', 'Wi-Fi',
    'CCTV', 'Alarm', 'Garasi Beberapa Mobil', 'Carport', 'Taman Depan',
    'Taman Belakang', 'Kolam Renang Pribadi', 'Gazebo', 'Balkon', 'Gudang',
    'Kamar ART', 'Kamar Sopir', 'Keamanan 24 Jam',
  ],
  kondotel: [
    'Tempat Tidur', 'Kamar Mandi Dalam', 'Shower', 'Water Heater', 'AC', 'TV',
    'Wi-Fi', 'Kitchenette', 'Lemari Pakaian', 'Housekeeping', 'Resepsionis',
    'Lift', 'Parkir', 'Keamanan 24 Jam', 'CCTV', 'Kolam Renang', 'Gym',
  ],
};

/** Fallback saat tipe properti belum diketahui (dipakai expandStandardFacilities). */
const GENERIC_STANDARD = [
  'Kamar Tidur', 'Kamar Mandi', 'Listrik', 'Air', 'Parkir', 'Keamanan',
];

/* ══════════════════════════════════════════════════════════════════════════════
   FURNISHING — hanya menambah PERABOT untuk tipe HUNIAN
   Tipe komersial (ruko/kantor/gudang/toko) tidak bergantung furnishing:
   "kantor full furnished" tidak mengubah daftar fasilitas gedungnya.
══════════════════════════════════════════════════════════════════════════════ */

const RESIDENTIAL_TYPES = new Set([
  'house', 'apartment', 'villa', 'condo', 'boarding_house', 'mansion',
  'hotel', 'kondotel',
]);

/** Perabot yang ditambahkan tier "semi furnished". */
const SEMI_FURNISHED_EXTRA = ['AC', 'Kitchen Set', 'Lemari Pakaian', 'Kulkas'];

/** Tambahan tier "full furnished" (di atas semi). */
const FULL_FURNISHED_EXTRA = [
  'Tempat Tidur', 'Sofa', 'Meja Makan', 'TV', 'Water Heater', 'Mesin Cuci',
  'Kompor', 'Dispenser',
];

/* ══════════════════════════════════════════════════════════════════════════════
   PREMIUM — hanya ditawarkan bila customer memang minta properti eksklusif
══════════════════════════════════════════════════════════════════════════════ */

const PREMIUM_FACILITIES = [
  'Fully Furnished', 'Semi Furnished', 'Smart Home System', 'Smart Door Lock',
  'Fingerprint Access', 'Lift Pribadi', 'Private Pool', 'Jacuzzi', 'Sauna',
  'Gym', 'Rooftop Garden', 'BBQ Area', 'Playground', 'Jogging Track',
  'Tennis Court', 'Basketball Court', 'Function Hall', 'Ballroom', 'Concierge',
  'Shuttle Service', 'EV Charging Station', 'Solar Panel', 'Backup Generator',
  'Water Treatment System', 'Pet Friendly', 'Ocean View', 'Mountain View',
  'City View', 'Lake View', 'River View', 'Private Beach Access',
];

/** Marker internal yang disimpan state saat customer bilang "standar/terserah". */
const STANDARD_MARKER = 'standar';

const _isMarker = (f) => String(f || '').trim().toLowerCase() === STANDARD_MARKER;
const _dedupPush = (arr, seen, items) => {
  for (const it of items) {
    const k = String(it).trim().toLowerCase();
    if (!seen.has(k)) { seen.add(k); arr.push(it); }
  }
};

/**
 * Daftar fasilitas standar untuk sebuah tipe properti, sebagai STRING siap tampil.
 *
 * @param {string} buildingType key katalog ('house', 'hotel', …)
 * @param {string} [furnishing] 'full' | 'semi' | '' — hanya berlaku tipe hunian
 * @returns {string|null} daftar dipisah ", ", atau null bila tipe tidak dikenal
 */
function getStandardFacilitiesByType(buildingType, furnishing = '') {
  const key = String(buildingType || '').trim().toLowerCase();
  const base = STANDARD_FACILITIES[key];
  if (!base) return null;

  const out = [];
  const seen = new Set();
  _dedupPush(out, seen, base);

  if (RESIDENTIAL_TYPES.has(key)) {
    const f = String(furnishing || '').trim().toLowerCase();
    if (/semi/.test(f))      _dedupPush(out, seen, SEMI_FURNISHED_EXTRA);
    else if (/full/.test(f)) _dedupPush(out, seen, [...SEMI_FURNISHED_EXTRA, ...FULL_FURNISHED_EXTRA]);
  }
  return out.join(', ');
}

/** Daftar fasilitas premium sebagai string siap tampil (referensi, ~31 item). */
function getPremiumFacilities() {
  return PREMIUM_FACILITIES.join(', ');
}

/**
 * Apakah customer meminta properti premium/eksklusif?
 *
 * Dipakai sebagai FLAG saja — pemilihan item premium diserahkan ke LLM yang
 * punya konteks. Membuang seluruh daftar premium ke summary menghasilkan baris
 * yang bloated & tidak relevan (mis. "Basketball Court" pada villa).
 *
 * @param {string} custText teks pesan customer
 * @param {string} [budgetPreference] tier Q3 ('terjangkau'|'menengah'|'eksklusif')
 * @returns {boolean}
 */
function wantsPremiumFacilities(custText = '', budgetPreference = '') {
  const t = String(custText || '').toLowerCase();
  if (/\b(mewah|eksklusif|exclusive|premium|luxury|luxurious|fully\s*furnished)\b/i.test(t)) return true;
  return String(budgetPreference || '').trim().toLowerCase() === 'eksklusif';
}

/**
 * Ganti marker `'standar'` dengan daftar fasilitas nyata sesuai tipe properti.
 *
 * BUG PRODUKSI (Surabaya beli-rumah, 5 Agu 2026): customer menjawab "Fasilitas
 * standar", ekstraktor menyimpan MARKER INTERNAL `['standar']`, dan marker itu
 * tampil apa adanya di summary sebagai "✓ Fasilitas: Standar" — satu kata tanpa
 * isi, tidak berguna bagi agent maupun customer.
 *
 * ⚠️ Marker tetap DISIMPAN di state; ekspansi hanya terjadi saat RENDER. Tipe
 * properti bisa berganti di tengah sesi (rumah → apartemen), dan menyimpan
 * marker menjaga jawaban customer tetap utuh ("dia bilang standar") sambil
 * membiarkan daftarnya mengikuti tipe terakhir.
 *
 * Urutan hasil: item SPESIFIK customer lebih dulu, standar menyusul — yang ia
 * sebut sendiri adalah yang paling ia pedulikan. Dedup case-insensitive supaya
 * item yang kebetulan ada di kedua daftar ("AC") tidak tampil dua kali.
 *
 * @param {string[]|null} facilities daftar dari state (boleh mengandung marker)
 * @param {string|null} buildingType enum tipe properti
 * @returns {string[]} daftar siap tampil (tanpa marker internal)
 */
function expandStandardFacilities(facilities, buildingType) {
  const list = Array.isArray(facilities) ? facilities : [];
  if (!list.length) return [];
  if (!list.some(_isMarker)) return list.slice();   // tak ada marker → apa adanya

  const specific = list.filter(f => !_isMarker(f));
  const key = String(buildingType || '').trim().toLowerCase();
  const standard = STANDARD_FACILITIES[key] || GENERIC_STANDARD;

  const out = [];
  const seen = new Set();
  _dedupPush(out, seen, specific);
  _dedupPush(out, seen, standard);
  return out;
}

module.exports = {
  STANDARD_FACILITIES,
  GENERIC_STANDARD,
  PREMIUM_FACILITIES,
  STANDARD_MARKER,
  getStandardFacilitiesByType,
  getPremiumFacilities,
  wantsPremiumFacilities,
  expandStandardFacilities,
};

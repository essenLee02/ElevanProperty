const path = require('path');
const fs = require('fs');

const { getStandardFacilitiesByType } = require('../utils/standardFacilities');

// DB models — loaded lazily inside getDbProperties() to avoid circular-import issues
// at module load time. Require is cached by Node, so repeated calls are free.

// URUTAN PENTING: Tipe lebih spesifik harus dicek SEBELUM tipe yang lebih umum.
// Contoh masalah jika urutan salah:
//   'house' keyword matches "warehouse" (substring!)
//   'shop' keyword matches "shophouse" prefix
// Solusi: letakkan 'warehouse' dan 'shophouse' SEBELUM 'house'.
// URUTAN PENTING (lihat catatan di atas). Penambahan tipe 12-kategori:
//   - kondotel SEBELUM hotel & apartment ("condo hotel" ⊃ "hotel"; kondotel = apartemen+hotel)
//   - mansion  SEBELUM house ("rumah mewah" ⊃ "rumah")
//   - store    terpisah dari shophouse ('toko' dipindah ke store; ruko = bangunan, toko = unit retail)
const PROPERTY_TYPES = {
  kondotel      : ['kondotel', 'condotel', 'condo hotel', 'kondo hotel', 'condo'], // ← SEBELUM hotel/apartment
  hotel         : ['hotel', 'hotels', 'penginapan', 'motel'],
  villa         : ['villa', 'vila'],
  apartment     : ['apartemen', 'apartment', 'apart'],
  boarding_house: ['kos', 'kost', 'kosan', 'boarding house', 'boarding_house', 'indekos'],
  mansion       : ['mansion', 'rumah mewah'],        // ← SEBELUM house (rumah mewah ⊃ "rumah")
  warehouse     : ['gudang', 'warehouse'],           // ← SEBELUM house (warehouse ⊃ "house")
  shophouse     : ['ruko', 'shophouse', 'rukan'],    // ← SEBELUM house (shophouse ⊃ "house")
  store         : ['toko', 'store', 'retail', 'kios'],
  office        : ['kantor', 'office'],
  house         : ['rumah', 'house', 'home', 'kontrakan', 'residential'], // ← SETELAH warehouse/shophouse/mansion
  // NOTE: bare 'lainnya'/'other'/'others' removed — they false-match natural phrases
  // like "rumah makan lainnya" / "atau yang lainnya" and wrongly flip type → reset.
  // Use explicit "properti lainnya" instead.
  others        : ['properti lainnya', 'properti lain', 'other property', 'tanah', 'kavling', 'kaveling', 'lahan', 'spbu', 'pabrik']
};

// Tipe percakapan baru (mansion/kondotel/store) belum tentu ada di katalog JSON
// yang hanya berisi 8 tipe dasar. Saat pencarian katalog, petakan ke tipe dasar
// terdekat sebagai fallbackType otomatis agar listing tetap muncul:
//   mansion  → house     (rumah mewah dicari di antara rumah)
//   kondotel → apartment (unit kondotel mirip apartemen)
//   store    → shophouse (unit toko dicari di antara ruko/shophouse)
const CATALOG_TYPE_ALIAS = {
  mansion : 'house',
  kondotel: 'apartment',
  store   : 'shophouse'
};

const TRANSACTION_TYPES = {
  // Termasuk alias booking untuk hotel/villa/kondotel (master flow Q2: booking = sewa).
  rent: ['sewa', 'rent', 'rental', 'kontrak', 'menginap', 'nginap', 'booking', 'book', 'reservasi', 'harian', 'bulanan', 'tahunan', 'per tahun', 'per bulan', 'per malam', 'per minggu'],
  // 'beli' / 'buy' = purchase intent = sale transaction. Digabung ke 'sale' supaya
  // konsisten dengan nilai di katalog properti dan txWord di whatsappAIService.
  sale: ['jual', 'sale', 'sell', 'dijual', 'beli', 'buy', 'purchase', 'membeli']
};

// Static fallback — dipakai HANYA sebelum initCityCache() berhasil memuat data
// dari tabel `cities` saat startup, atau bila query DB gagal. Sumber kebenaran
// lokasi adalah database (model City.js), bukan daftar ini. Fallback ini
// mencakup 200+ kota major di Indonesia terorganisir per region.
const FALLBACK_LOCATION_KEYWORDS = [
  // DKI Jakarta
  'Jakarta', 'Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Barat',
  'Jakarta Timur', 'Jakarta Utara', 'Bekasi', 'Depok', 'Bogor',
  'Tangerang', 'Tangerang Selatan',

  // Jawa Barat
  'Bandung', 'Cimahi',
  'Karawang', 'Purwakarta', 'Subang',
  'Cirebon', 'Sukabumi', 'Tasikmalaya',
  'Garut', 'Sumedang',

  // Jawa Tengah
  'Semarang', 'Surakarta', 'Solo',
  'Salatiga', 'Magelang', 'Pekalongan',
  'Tegal', 'Purwokerto', 'Cilacap',
  'Kudus', 'Jepara', 'Klaten',

  // DI Yogyakarta
  'Yogyakarta', 'Sleman', 'Bantul',
  'Kulon Progo', 'Gunungkidul',

  // Jawa Timur
  'Surabaya', 'Malang', 'Batu',
  'Sidoarjo', 'Gresik', 'Mojokerto',
  'Pasuruan', 'Probolinggo',
  'Kediri', 'Madiun', 'Jember',
  'Banyuwangi', 'Lamongan',

  // Banten
  'Serang', 'Cilegon',
  'Pandeglang', 'Lebak',

  // Bali
  'Denpasar', 'Badung',
  'Gianyar', 'Tabanan',
  'Buleleng', 'Karangasem',
  'Ubud', 'Kuta', 'Sanur',

  // Sumatera Utara
  'Medan', 'Binjai',
  'Pematangsiantar', 'Tebing Tinggi',
  'Tanjungbalai',

  // Sumatera Barat
  'Padang', 'Bukittinggi',
  'Payakumbuh', 'Solok',

  // Riau
  'Pekanbaru', 'Dumai',
  'Siak', 'Bangkinang',

  // Kepulauan Riau
  'Batam', 'Tanjung Pinang',
  'Bintan',

  // Jambi
  'Jambi', 'Muaro Jambi',

  // Sumatera Selatan
  'Palembang', 'Prabumulih',
  'Lubuklinggau',

  // Lampung
  'Bandar Lampung',
  'Metro',

  // Aceh
  'Banda Aceh', 'Lhokseumawe',
  'Langsa', 'Sabang',
  'Meulaboh',

  // Kalimantan Barat
  'Pontianak', 'Singkawang',

  // Kalimantan Tengah
  'Palangkaraya',
  'Sampit',

  // Kalimantan Selatan
  'Banjarmasin',
  'Banjarbaru',

  // Kalimantan Timur
  'Samarinda',
  'Balikpapan',
  'Bontang',

  // Kalimantan Utara
  'Tanjung Selor',
  'Tarakan',

  // Sulawesi Selatan
  'Makassar',
  'Parepare',
  'Maros',

  // Sulawesi Utara
  'Manado',
  'Bitung',
  'Tomohon',

  // Sulawesi Tengah
  'Palu',

  // Sulawesi Tenggara
  'Kendari',

  // Gorontalo
  'Gorontalo',

  // Sulawesi Barat
  'Mamuju',

  // Nusa Tenggara Barat
  'Mataram',
  'Lombok',

  // Nusa Tenggara Timur
  'Kupang',
  'Labuan Bajo',

  // Maluku
  'Ambon',

  // Maluku Utara
  'Sofifi',
  'Ternate',

  // Papua
  'Jayapura',
  'Timika',
  'Merauke',

  // Papua Barat
  'Manokwari',
  'Sorong'
];

// Alias mapping — shorthand/informal names yang dicocokkan ke kota formal.
// Dipakai di detectLocation() sebelum pencarian di daftar kota formal.
const LOCATION_ALIAS = {
  'solo': 'Surakarta',
  'jogja': 'Yogyakarta',
  'yk': 'Yogyakarta',
  'jkt': 'Jakarta',
  'bdg': 'Bandung',
  'sby': 'Surabaya',
  'mlg': 'Malang',
  'bpn': 'Balikpapan',
  'smg': 'Semarang',
  'dps': 'Denpasar',
  'medan': 'Medan',
  'plg': 'Palembang',
  'pkb': 'Pekanbaru',
  'pdg': 'Padang',
  'jmb': 'Jambi',
  'btm': 'Batam'
};

// Runtime cache — diisi oleh initCityCache() dari tabel `cities` (status=1) saat
// server startup (lihat server.js). Sampai cache ini terisi, getKnownLocations()
// jatuh ke FALLBACK_LOCATION_KEYWORDS di atas.
let _dbCities = [];

/**
 * Muat/refresh daftar kota dari database (model City.js, status=1) sebagai
 * sumber lokasi UTAMA untuk detectLocation(). Dipanggil sekali saat startup
 * (mirror pola initFacilityCache() / propertyKeywordFilter.initLocationCache()).
 * Gagal secara halus ke FALLBACK_LOCATION_KEYWORDS bila query DB error/kosong.
 */
async function initCityCache() {
  try {
    const { City } = require('../models');
    const rows = await City.findAll({ where: { status: 1 }, attributes: ['name'], raw: true });
    // DB menyimpan nama kota UPPERCASE (mis. "SURABAYA"). Title-case di sini agar
    // tampilan summary/chat tetap konsisten dengan sebelumnya ("Surabaya"), sementara
    // pencocokan regex tetap case-insensitive.
    _dbCities = rows
      .map((r) => String(r.name || '').trim())
      .filter(Boolean)
      .map((name) => name.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()));
    console.log(`[CityCache] Loaded ${_dbCities.length} cities from DB (for detectLocation()).`);
  } catch (err) {
    console.warn('[CityCache] initCityCache() failed — using hardcoded fallback:', err.message);
  }
}

/**
 * Frasa DESKRIPTIF pada judul/area listing yang BUKAN nama tempat.
 *
 * ⚠️ BUG PRODUKSI (12 Agu 2026): `getKnownLocations()` meratakan `district` /
 * `location` dari katalog, dan data seed memakai label zona berbahasa Inggris
 * ("Business District", "Near Airport", "Green Zone", …) di kolom itu. Label
 * tersebut lalu diperlakukan sebagai NAMA KOTA oleh `detectLocation()`.
 * Karena daftar diurut dari yang TERPANJANG, "Business District" (17 huruf)
 * bahkan MENGALAHKAN kota aslinya "Bengkulu Tengah" (15 huruf) pada judul
 * "Bengkulu Tengah Business District House" — sehingga chatbot bertanya
 * "Di area atau kawasan mana di *Business District*?" kepada customer.
 *
 * Ini murni soal DETEKSI LOKASI dari teks bebas; nilainya tetap sah sebagai
 * data `area` untuk filter katalog, jadi yang disaring hanya daftar ini.
 */
const GENERIC_ZONE_LABELS = new Set([
  'business district', 'industrial area', 'heritage zone', 'near airport',
  'city center', 'city centre', 'near beach', 'green zone', 'waterfront',
  'near mall', 'downtown', 'near station', 'near hospital', 'near school',
]);

function getKnownLocations() {
  const dynamicLocations = loadJsonProperties().flatMap((property) => [
    property.province,
    property.city,
    property.district,
    property.location
  ]).filter(Boolean)
    .filter(loc => !GENERIC_ZONE_LABELS.has(String(loc).trim().toLowerCase()));

  // Kota dari DATABASE bersifat OTORITATIF, tetapi MENAMBAH — tidak pernah
  // MENGGANTIKAN daftar statis.
  //
  // ⚠️ BUG PRODUKSI (13 Agu 2026, M92). Dulu baris ini berbunyi
  //     const cityNames = _dbCities.length ? _dbCities : FALLBACK_LOCATION_KEYWORDS;
  // sehingga begitu tabel `cities` terisi APA PUN, seluruh daftar statis
  // DIBUANG. Kota yang belum sempat dimasukkan ke master data jadi TIDAK
  // DIKENALI sama sekali — customer mengetik "Di kota Jakarta" lima kali
  // berturut-turut dan tiap kali dijawab pertanyaan kota yang sama, karena
  // Jakarta tidak ada di tabel `cities` meski ADA di daftar statis.
  // Gejalanya terlihat seperti AI "tidak mengerti Jakarta itu kota"; akarnya
  // justru DB yang menutupi pengetahuan yang sudah dimiliki sistem.
  //
  // Modul saudaranya sudah benar sejak awal:
  // `utils/propertyKeywordFilter.initLocationCache()` MENGGABUNG
  // (`[...dbNames, ...extras]`). Dua modul untuk konsep yang sama dengan
  // semantik merge BERLAWANAN — kelas desync yang sama dengan M87/M88.
  const cityNames = [..._dbCities, ...FALLBACK_LOCATION_KEYWORDS];

  return [...new Set([...cityNames, ...dynamicLocations])]
    .sort((a, b) => String(b).length - String(a).length);
}

// ─── Landmark Cache & Nearest-Landmark Filtering ─────────────────────────────
// Model `Location` (tabel `locations`) menyimpan referensi landmark terdaftar
// (mis. PAKUWON MALL, GRAND CITY MALL, TUNJUNGAN PLAZA, WISATA MANGROVE, BANK BCA)
// yang di-link ke properti via tabel join `property_locations` (many-to-many).
// Cache ini memungkinkan detectLandmark() mengenali landmark yang disebut customer,
// dan getPropertyIdsForLandmark() mengembalikan properti yang benar-benar ter-tag
// ke landmark tsb — sehingga pencarian "dekat Pakuwon" bisa memfilter/mem-prioritaskan
// listing yang SECARA NYATA tercatat dekat Pakuwon, bukan cuma cocok di level kota.
let _landmarkCache = new Map(); // nama landmark (UPPERCASE) → location_id

/**
 * Muat/refresh daftar landmark dari tabel `locations` (status=1). Dipanggil sekali
 * saat server startup (mirror pola initCityCache() / initFacilityCache()).
 */
async function initLandmarkCache() {
  try {
    const { Location } = require('../models');
    const rows = await Location.findAll({ where: { status: 1 }, attributes: ['location_id', 'name'], raw: true });
    _landmarkCache = new Map(
      rows.map((r) => [String(r.name || '').trim().toUpperCase(), r.location_id]).filter(([name]) => name)
    );
    console.log(`[LandmarkCache] Loaded ${_landmarkCache.size} landmarks from DB (for detectLandmark()).`);
  } catch (err) {
    console.warn('[LandmarkCache] initLandmarkCache() failed:', err.message);
  }
}

/** Daftar nama landmark yang dikenal (untuk debug/skill doc generation). */
function getKnownLandmarks() {
  return [..._landmarkCache.keys()];
}

/**
 * Deteksi landmark yang disebut customer di pesan bebas (mis. "dekat Pakuwon",
 * "deket Tunjungan Plaza", "sekitar Grand City Mall"). Substring match case-insensitive,
 * nama TERPANJANG dicek lebih dulu supaya "TUNJUNGAN PLAZA (TP)" tidak ke-shadow oleh
 * substring generik seperti "MALL PUSAT KOTA".
 *
 * @param {string} message
 * @returns {string} nama landmark kanonik (UPPERCASE, sesuai DB) atau '' bila tidak ada match
 */
function detectLandmark(message = '') {
  if (!message || _landmarkCache.size === 0) return '';
  const text = normalizeText(message);
  const names = [..._landmarkCache.keys()].sort((a, b) => b.length - a.length);
  for (const name of names) {
    // Nama landmark bisa punya singkatan dalam kurung (mis. "TUNJUNGAN PLAZA (TP)").
    // Coba nama penuh dulu, lalu bagian SEBELUM kurung saja — supaya customer yang
    // menyebut "tunjungan plaza" (tanpa "(TP)") tetap match ke nama kanonik penuh.
    const core = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const candidates = core === name ? [name] : [name, core];
    const matched = candidates.some((c) => new RegExp(`\\b${escapeRegExp(c.toLowerCase())}\\b`, 'i').test(text));
    if (matched) return name;
  }
  return '';
}

/**
 * Resolve property_id yang ter-tag ke sebuah landmark (via tabel join `property_locations`).
 * Return `null` bila landmark tidak dikenal ATAU query gagal — caller HARUS menganggap
 * `null` sebagai "tidak ada info landmark" (fallback ke filter kota-saja), BUKAN "nol hasil".
 *
 * @param {string} landmarkName - nama landmark (case-insensitive, cocok hasil detectLandmark())
 * @returns {Promise<Set<string>|null>} Set of property_id, atau null bila tidak resolvable
 */
async function getPropertyIdsForLandmark(landmarkName) {
  const locationId = _landmarkCache.get(String(landmarkName || '').trim().toUpperCase());
  if (!locationId) return null;
  try {
    const { PropertyLocation } = require('../models');
    const rows = await PropertyLocation.findAll({ where: { location_id: locationId }, attributes: ['property_id'], raw: true });
    return new Set(rows.map((r) => r.property_id).filter(Boolean));
  } catch (err) {
    console.warn('[LandmarkFilter] getPropertyIdsForLandmark() failed:', err.message);
    return null;
  }
}

// ─── JSON Property Loader (FALLBACK ONLY) ────────────────────────────────────
// Reads indonesia_property_extended_v3.json from backend/asset/json_data/.
//
// PENTING: Ini HANYA fallback contoh data. Sumber utama adalah database
// (model Property + PropertyImage + PropertyFacility + PropertyLocation) yang
// merupakan salinan dari indonesia_property_extended_v3.json. Loader ini
// dipanggil LAZY (saat dibutuhkan saja), tidak di-load saat server start —
// sehingga tidak ada lagi "Loaded N properties" saat startup. Trigger pemuatan:
//   1. Halaman /about (aboutController → searchProperties)
//   2. Chatbot setelah "Start Chat" (chatbotController → buildRecommendationContextForLLM)
//   3. Terminal message saat pemberian summary (fonnte/kirimi/timelinesAI controllers)
// Hasil di-cache setelah pemuatan pertama.

const JSON_DATA_PATH = path.resolve(
  __dirname,
  '../asset/json_data/indonesia_property_extended_v3.json'
);

let _jsonPropertiesCache = null;

function loadJsonProperties() {
  if (_jsonPropertiesCache) return _jsonPropertiesCache;

  try {
    const raw = fs.readFileSync(JSON_DATA_PATH, 'utf8');
    const json = JSON.parse(raw);
    const records = json.properties || [];

    _jsonPropertiesCache = records.map((p, index) => ({
      id: p.id || index + 1,
      title: p.title || '',
      description: p.description || '',
      price: p.price || '',
      // Normalise location object → flat fields expected by filterProperties.
      location: p.location?.city || p.location?.province || '',
      province: p.location?.province || '',
      city: p.location?.city || '',
      district: p.location?.area || '',
      address: p.address || '',
      buildingArea: p.building_area || '',
      landArea: p.land_area || '',
      buildingType: p.building_type || '',
      transactionType: p.transaction_type || '',
      facilities: Array.isArray(p.facilities) ? p.facilities.join(', ') : (p.facilities || ''),
      imageUrl: p.image || '',
      status: 'available'
    }));

    console.log(`[PropertyRecommendationService] Loaded ${_jsonPropertiesCache.length} fallback properties from extended_v3 JSON (lazy).`);
    return _jsonPropertiesCache;
  } catch (err) {
    console.error('[PropertyRecommendationService] Failed to load JSON file:', err.message);
    return [];
  }
}

// LAZY fallback accessor. TIDAK di-load saat module-load (server start) — hanya
// terpanggil saat about/chatbot/terminal benar-benar butuh contoh data & DB kosong.
function getFallbackProperties() {
  return loadJsonProperties();
}



function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function includesAny(text, words = []) {
  return words.some((word) => text.includes(word));
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip "dekat/deket/near X" fragments so location anchors don't trigger
 * building-type detection. e.g. "deket kantor dan mall" → "dan mall"
 * → prevents false-positive office/warehouse type detection.
 */
function stripNearPhrases(text) {
  // Buang KESELURUHAN daftar landmark setelah kata kedekatan, bukan hanya token
  // pertama. Customer lazim menyebut beberapa patokan sekaligus:
  //   "Saya mau dekat indomaret, warung, resto"
  // Dulu hanya "dekat indomaret" yang dibuang, menyisakan ", warung, resto" —
  // lalu "warung" terbaca sebagai TIPE PROPERTI (store) dan memicu reset sesi
  // ke Q1. Akibatnya setiap jawaban patokan lokasi menghapus seluruh sesi dan
  // customer diputar dari awal berulang kali (bug produksi 3 Agu 2026).
  //
  // Daftar dianggap berlanjut selama dipisah koma / "dan" / "atau" / "&".
  // Berhenti di tanda baca akhir kalimat supaya kalimat berikutnya tetap utuh.
  return text.replace(
    /\b(?:dekat|deket|dkt|near|di\s+dekat|di\s+sekitar|sekitar|samping|sebelah)\s+[^.!?;\n]*/gi,
    ''
  );
}

/**
 * Strip "pindah/keluar/hijrah dari X" fragments so the ORIGIN property a
 * customer is leaving doesn't get read as the DESIRED type — e.g. "mau
 * pindah dari apartemen" (customer's current home, moving away) must not
 * detect building type = apartment. Same shape as stripNearPhrases: strip
 * the trigger word + whatever follows, generically — no type-word list to
 * keep in sync with PROPERTY_TYPES.
 */
function stripMovingFromPhrases(text) {
  // Consume up to 2 words after "dari" — some type names are two words
  // ("rumah kontrakan"), and a single-token strip left the second word
  // ("kontrakan") behind, still matching PROPERTY_TYPES.
  return text.replace(/\b(pindah|keluar|hijrah|migrasi|cabut)\s+dari\s+(?:\S+\s+){0,1}\S+/gi, '');
}

/**
 * Remove ambiguous "rumah X" phrases that are NOT a house ("rumah makan",
 * "rumah sakit", "rumah tangga", …). Without this, a customer saying they want to
 * be near a "rumah makan" (restaurant) gets mis-detected as building type house,
 * which then flips the type mid-flow and resets the whole qualification state.
 */
function stripAmbiguousRumah(text) {
  let out = text.replace(/\brumah\s+(makan|sakit|tangga|ibadah|duka|produksi|tahanan|kos|kost|susun|potong)\b/gi, '');

  // ── "rumah" DI DALAM JAWABAN RED FLAG bukan permintaan ganti tipe (M92) ──
  // Bug produksi 13 Agu 2026: customer sedang mencari APARTEMEN, lalu menjawab
  // Q5 dengan "Saya tidak ingin rumah hadap utara, gang sempit atau rumah tua".
  // Kata "rumah" di situ menggambarkan hal yang DIHINDARI, tapi terbaca sebagai
  // tipe properti → buildingType apartment→house → sessionAnchors.reconcile()
  // menganggap customer ganti pencarian → clearAnchors() → transaksi & lokasi
  // TERHAPUS → gerbang kualifikasi mengulang dari awal ("Untuk Rumah yang Anda
  // cari — sewa atau beli? kota mana? harga?") padahal semua itu sudah dijawab.
  // Seluruh konteks hilang di satu giliran.
  //
  // Dua bentuk yang dibuang:
  //   (a) "rumah tua/lama/kuno/bekas/butut/jelek/kumuh" — sifat yang dihindari.
  //   (b) "<negasi> … rumah" — "tidak ingin rumah …", "jangan rumah …".
  // Keduanya SEMPIT: "mau beli rumah" / "cari rumah" tetap terdeteksi normal.
  out = out.replace(/\brumah\s+(tua|lama|kuno|bekas|butut|jelek|kumuh|rusak|bobrok)\b/gi, '');
  out = out.replace(
    /\b(?:tidak|tdk|ga|gak|gk|nggak|ngga|enggak|engga|jangan|hindari|dihindari|anti|bukan|selain)\s+(?:\w+\s+){0,2}?rumah\b/gi,
    ''
  );
  return out;
}

/**
 * Remove "use-case" phrases where a property is bought/rented to be USED AS another
 * type — e.g. a house bought "untuk dipakai kantor" / "digunakan sebagai kantor" /
 * "buat usaha" (software house, UMKM). The trailing type word there is a USE, not a
 * request to change the property type, so it must not trigger type detection (which
 * would flip house→office and reset the whole search). The established type is kept;
 * the commercial use is captured separately (see detectCommercialUse).
 */
const _USE_LEAD = '(?:untuk|buat|dipakai|dipake|digunakan|dijadikan|jadikan|jadiin|jadi|sebagai|bangun|dibangun|membangun|bikin|dibikin|dibuat|buka|membuka|dibuka)';
const _USE_TYPE = '(?:kantor|perkantoran|usaha|bisnis|umkm|startup|software\\s*house|softwarehouse|co[\\s-]?working|coworking|workshop|office|toko|ruko|gudang|warehouse|store|klinik|salon|cafe|kafe|resto|restoran|restaurant|warung|kos[\\s-]?kosan|kontrakan|kontrakkan|kost|kos|studio|ibadah|masjid|mushola|musholla|gereja|pura|vihara)';
function stripCommercialUsePhrases(text) {
  return text.replace(new RegExp(`\\b${_USE_LEAD}\\s+(?:${_USE_LEAD}\\s+)?${_USE_TYPE}\\b`, 'gi'), '');
}

/**
 * Remove INVESTMENT-INTENT phrases where a BUYER explains they will rent the property
 * out — "buat investasi, mau disewakan lagi", "untuk disewakan ke karyawan".
 *
 * Indonesian marks this with the causative form: `sewa` = "I rent", but
 * `disewakan`/`menyewakan`/`sewakan` = "rent it out". Without this strip, a buyer's
 * investment plan is read as a transaction flip sale→rent, which fires the
 * switch-boundary reset and discards their location mid-search.
 *
 * Deliberately narrow: only strips when preceded by a plan/intent lead word, so a
 * genuine renter saying "cari rumah yang disewakan" ("yang" is not a lead) is
 * untouched and still detected as rent.
 */
const _INVEST_LEAD = '(?:mau|ingin|untuk|buat|rencana(?:nya)?|akan|bakal|nanti|sekalian|terus|lalu|kemudian)';
function stripInvestmentIntentPhrases(text) {
  return text.replace(
    new RegExp(`\\b${_INVEST_LEAD}\\s+(?:\\w+\\s+){0,2}?(?:di)?sewa(?:kan)\\w*\\b`, 'gi'),
    ''
  );
}

/**
 * Detect that the customer intends to USE the property commercially (as an office /
 * business). Returns 'kantor' | 'usaha' | '' . Kept for backward compatibility.
 */
function detectCommercialUse(text = '') {
  const t = normalizeText(text);
  if (new RegExp(`\\b${_USE_LEAD}\\s+(?:${_USE_LEAD}\\s+)?(kantor|perkantoran|office|software\\s*house|softwarehouse|co[\\s-]?working|coworking|startup|workshop)\\b`, 'i').test(t))
    return 'kantor';
  if (new RegExp(`\\b${_USE_LEAD}\\s+(?:${_USE_LEAD}\\s+)?(usaha|bisnis|umkm|toko|ruko|store|klinik|salon)\\b`, 'i').test(t))
    return 'usaha';
  return '';
}

/**
 * Detect the property USE-CASE so the flow can decide whether the "who will live
 * there?" (occupants) question even applies. The occupants/bedrooms question is ONLY
 * relevant for residential own-living use. Returns one of:
 *   'ibadah'    — worship (masjid, gereja, mushola, pengajian, …)
 *   'investasi' — investment / rent-out / income (disewakan, warung, cafe, kos,
 *                 kontrakan, didiamkan sebagai aset, yield, ROI)
 *   'kantor'    — office / commercial (software house, UMKM, coworking, …)
 *   'usaha'     — other business (toko, salon, klinik, …)
 *   'liburan'   — vacation / temporary stay (liburan, dinas, staycation, honeymoon)
 *   ''          — unknown → assume residential
 */
function detectUseCase(text = '') {
  const t = normalizeText(text);
  if (/\b(ibadah|tempat\s+ibadah|rumah\s+ibadah|masjid|mushola|musholla|surau|langgar|gereja|kapel|pura|vihara|klenteng|kelenteng|sinagoga|pengajian|kebaktian|misa|sembahyang|rumah\s+doa|tpa|tpq|madrasah)\b/.test(t))
    return 'ibadah';
  // Istilah investasi MURNI — aman berdiri sendiri.
  if (/\b(investasi|investment|invest|disewakan|sewakan|disewain|dikontrakkan|dikontrakan|didiamkan|didiemin|dibiarkan|aset|asset|yield|roi|capital\s+gain|passive\s+income|flipping|disewa\s*kan|usaha\s+sewa|rental\s+income|bangun\s+kos)\b/.test(t))
    return 'investasi';
  // Kata bisnis (warung/cafe/resto/kos-kosan/kontrakan/jualan) HANYA dihitung
  // bila menempel verba niat usaha. Dulu kata polos "cafe|resto|warung" ikut
  // alternation → "Dekat pasar, resto atau cafe" (patokan lokasi Q6!) salah
  // terbaca "Untuk investasi (non-hunian)" → Q4 penghuni di-skip + summary
  // menampilkan use-case fiktif. Kata "kontrakan" polos juga dihapus — "cari
  // kontrakan murah" adalah pencarian rumah sewa, bukan investasi.
  if (/\b(buka|bangun|bikin|dijadikan|jadikan|dijadiin|buat|untuk)\s+(?:\w+\s+){0,2}?(warung|kafe|cafe|resto|restoran|restaurant|kos[\s-]?kosan|kontrakan|jualan)\b/.test(t))
    return 'investasi';
  const comm = detectCommercialUse(t);
  if (comm) return comm;
  // 'liburan' — kata lemah TIDAK boleh berdiri sendiri. "wisata" adalah deskriptor
  // TEMPAT ("dekat wisata BNS" = jawaban patokan lokasi Q6!), "dinas" muncul di nama
  // kantor ("dekat kantor dinas pendidikan"), "sementara" adalah konjungsi umum
  // ("sementara saya masih kerja di..."). Dulu semuanya polos di alternation →
  // jawaban landmark "dekat lowokwaru dan wisata BNS" membajak use-case jadi
  // 'liburan' → summary beli rumah menulis "Penghuni: Untuk liburan/menginap
  // sementara" (menimpa jawaban asli "tinggal sendirian") + Q4 bisa ter-skip.
  // Kini: verba/frasa kuat boleh sendiri; kata lemah wajib menempel frasa niat.
  if (
    // Kuat — hampir mustahil muncul dalam konteks lokasi/landmark:
    /\b(berlibur|berwisata|staycation|honeymoon|bulan\s+madu|workation|perjalanan\s+dinas|tugas\s+dinas|dinas\s+luar\s+kota|business\s+trip|short\s*stay)\b/.test(t)
    // Lemah + anchor niat: "untuk/buat/mau liburan", "buat dinas kerja", dst.
    // ("dinas" polos tetap TIDAK match — "dekat kantor dinas pendidikan" aman;
    //  "untuk kantor dinas" tertangkap detectCommercialUse('kantor') lebih dulu.)
    || /\b(?:untuk|buat|keperluan|mau|pengen|pingin|rencana)\s+(?:\w+\s+){0,2}?(?:liburan|wisata|vacation|holiday|menginap|nginap|dinas)\b/.test(t)
    || /\bliburan\s+(?:keluarga|bersama|panjang|akhir\s+tahun)\b/.test(t)
    // "sementara" hanya bila menempel kata hunian: "tinggal/menginap sementara".
    || /\b(?:tinggal|menginap|nginap|hunian|tempat)\s+sementara\b|\bsementara\s+waktu\b/.test(t)
    // Jawaban langsung super-pendek atas pertanyaan motivasi ("Liburan", "buat liburan aja").
    || /^\s*(?:untuk\s+|buat\s+)?(?:liburan|staycation|vacation|holiday)\s*(?:aja|saja|sih|kak|pak|bu)?\s*[.!]?\s*$/.test(t)
  )
    return 'liburan';
  return '';
}

const _NON_RESIDENTIAL_USES = new Set(['ibadah', 'investasi', 'kantor', 'usaha']);
/** True when the property is NOT for own-living → skip the occupants question. */
function isNonResidentialUse(text = '') {
  return _NON_RESIDENTIAL_USES.has(detectUseCase(text));
}
/** Human-readable label for the use-case (for summaries). */
function useCaseLabel(use = '') {
  return ({
    ibadah   : 'Untuk ibadah (non-hunian)',
    investasi: 'Untuk investasi (non-hunian)',
    kantor   : 'Untuk kantor/usaha (non-hunian)',
    usaha    : 'Untuk usaha/komersial (non-hunian)',
    liburan  : 'Untuk liburan/menginap sementara',
  })[use] || '';
}

/**
 * Word-bounded keyword match.
 * Multi-word keywords (contain space) → simple substring (already unambiguous).
 * Single-word keywords → require word boundary so "kosongan" ≠ "kos",
 * "indomaret" ≠ "maret", etc.
 */
function matchesWordBounded(text, word) {
  if (word.includes(' ')) return text.includes(word);
  return new RegExp(`\\b${escapeRegExp(word)}\\b`).test(text);
}

function includesAnyWordBounded(text, words = []) {
  return words.some((word) => matchesWordBounded(text, word));
}

function detectBuildingType(message = '') {
  const text = normalizeText(message);
  // Strip "dekat X" anchors, ambiguous "rumah makan/…", commercial use-phrases
  // ("dipakai kantor", "buat usaha"), AND "pindah dari X" origin phrases so none
  // pollutes building-type detection (a restaurant anchor must not become house;
  // a house used as office stays house; "pindah dari apartemen" — the home being
  // LEFT — must not become the desired type).
  const textForType = stripCommercialUsePhrases(stripMovingFromPhrases(stripAmbiguousRumah(stripNearPhrases(text))));
  return Object.entries(PROPERTY_TYPES).find(([, keywords]) => includesAnyWordBounded(textForType, keywords))?.[0] || '';
}

function detectTransactionType(message = '') {
  const text = normalizeText(message);
  return Object.entries(TRANSACTION_TYPES).find(([, keywords]) => includesAny(text, keywords))?.[0] || '';
}

function cleanLocationCandidate(value = '') {
  return String(value || '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\b(saya|mau|ingin|cari|sewa|beli|jual|ada|apa|saja|dong|tolong|yang|dengan|fasilitas|harga|berapa|budget|badget|range|antara|dan|full|furnish|furnished)\b.*$/i, '')
    .trim();
}

// Kata yang sering muncul setelah "di" tapi BUKAN lokasi (patokan lantai/posisi/dll).
// Tanpa guard ini, "Di lantai 27" salah terbaca sebagai lokasi "lantai" dan
// menimpa kota yang sudah benar (mis. Surabaya) di akumulasi filter.
const NON_LOCATION_AFTER_DI = new RegExp(
  '^(lantai|lantainya|tower|menara|gedung|unit|kamar|lt|atas|bawah|tengah|pojok|sudut|' +
  'sini|sana|situ|dalam|luar|depan|belakang|samping|sebelah|tengahnya|mana|manapun|' +
  'mana[\\s-]*saja|mana[\\s-]*aja|sekitar|area|' +
  // Kata generik tempat/lingkungan yang BUKAN nama kota. Tanpa guard ini,
  // "villa di kawasan yang tidak banjir" salah terbaca lokasi "kawasan" dan
  // menimpa kota asli (mis. Surabaya) yang sudah tertangkap di pesan sebelumnya.
  'kawasan|daerah|wilayah|lingkungan|komplek|kompleks|perumahan|cluster|klaster|' +
  'tempat|lokasi|kota|kotanya|pinggir|pinggiran|pusat|dekat|deket|situasi|suasana|' +
  // Kata RED-FLAG (jawaban Q5 "apa yang ingin dihindari?"). Tanpa guard ini,
  // "saya gak mau di gang sempit dan rumah tua" salah terbaca lokasi "gang sempit"
  // → dianggap PINDAH KOTA → seluruh state sesi (transaksi/budget/tanggal/penghuni)
  // TERHAPUS karena location-flip me-reset sesi. Lihat M51.
  'gang|gangnya|jalan|jln|tusuk|sate|tusuk[\\s-]*sate|hook|tikungan|' +
  'rumah|ruko|bangunan|hunian|properti|apartemen|apartment|villa|vila|hotel|kos|kost)\\b', 'i'
);

/**
 * Apakah frasa "di X" berada dalam konteks NEGASI / MENGHINDARI?
 * Jawaban Q5 (red flags) hampir selalu berbentuk "gak mau di …", "hindari …",
 * "jangan yang di …". Frasa setelah "di" di situ adalah hal yang DIHINDARI,
 * BUKAN kota yang dicari — jadi fallback bebas "di X" tidak boleh dipakai.
 */
const AVOIDANCE_CONTEXT = new RegExp(
  '\\b(?:' +
  '(?:g(?:a|ak|k)?|nggak|ngga|enggak|engga|tidak|tak|bukan|jangan|no|not|don\'?t)\\s*' +
  '(?:mau|ingin|pengen|suka|minat|cocok|usah|perlu|di|yang|kalau)?' +
  '|hindari|dihindari|menghindari|avoid|kurang\\s+suka|anti|alergi|ogah|males|malas' +
  ')\\b', 'i'
);

function detectLocation(message = '') {
  const text = normalizeText(message);

  // "kisaran" sebagai kata keterangan harga ("kisaran 900K", "kisaran Rp 1,5 juta",
  // "kisaran 2M") BUKAN nama kota Kisaran (Sumatera Utara). Strip sebelum deteksi
  // agar tidak salah-match kota dari JSON catalog.
  let textForLoc = text.replace(/\bkisaran\s+(?:rp\.?\s*)?\d[\d.,kKmMjJ]*/gi, '');

  // Idiom ASAL-USUL "orang <kota>" / "asli <kota>" = tempat customer BERASAL,
  // BUKAN lokasi properti yang dicari. "Karena saya orang Surabaya" tidak boleh
  // menjadikan Surabaya lokasi pencarian (padahal dia cari rumah di Jakarta).
  textForLoc = textForLoc.replace(/\b(?:orang|asli|warga|penduduk)\s+[a-z]+(?:\s+(?:selatan|utara|barat|timur|pusat))?/gi, ' ');

  // ──── ALIAS MATCHING (prioritas tertinggi) ────
  // Cocokkan informal names / shorthand dulu. Misal "sby" → "Surabaya", "jogja" → "Yogyakarta".
  const lowerText = textForLoc.toLowerCase();
  for (const [alias, canonical] of Object.entries(LOCATION_ALIAS)) {
    if (new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i').test(lowerText)) {
      return canonical;
    }
  }

  // ──── FORMAL LOCATION MATCHING ────
  const found = getKnownLocations().find((location) => new RegExp(`\\b${escapeRegExp(location.toLowerCase())}\\b`, 'i').test(textForLoc));
  if (found) return found;

  // ──── PATTERN MATCHING ("di X") ────
  // ⚠️ Fallback bebas — HANYA dipakai bila tidak ada nama kota dikenal & tidak
  // dalam konteks menghindari. Frasa "gak mau di gang sempit" / "hindari di
  // pinggir jalan" adalah jawaban RED FLAG (Q5), bukan kota tujuan. Dulu tanpa
  // guard ini "gang sempit" menjadi lokasi → dianggap ganti kota → seluruh state
  // sesi ter-reset (M51).
  if (AVOIDANCE_CONTEXT.test(textForLoc)) return '';

  const afterDi = textForLoc.match(/\bdi\s+([a-zA-Z\s]{3,35})/i);
  if (afterDi && afterDi[1]) {
    const candidate = afterDi[1].trim();
    if (NON_LOCATION_AFTER_DI.test(candidate)) return '';  // "di lantai 27" dst → bukan lokasi
    return cleanLocationCandidate(candidate);
  }

  return '';
}

/**
 * Apakah string ini nama lokasi/kota yang DIKENAL (ada di katalog/alias)?
 * Dipakai sebagai syarat sebelum sebuah "perpindahan kota" diizinkan me-reset
 * state sesi — teks bebas hasil fallback TIDAK BOLEH pernah menghapus state.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isKnownLocationName(name = '') {
  const n = String(name || '').trim().toLowerCase();
  if (n.length < 3) return false;
  if (Object.prototype.hasOwnProperty.call(LOCATION_ALIAS, n)) return true;
  if (Object.values(LOCATION_ALIAS).some(v => String(v).toLowerCase() === n)) return true;
  return getKnownLocations().some((loc) => {
    const l = String(loc).toLowerCase();
    // Cocok penuh, atau kota + arah mata angin ("surabaya barat" ≡ "surabaya").
    return l === n || n === l
      || new RegExp(`^${escapeRegExp(l)}(\\s+(selatan|utara|barat|timur|pusat))?$`, 'i').test(n);
  });
}

// Facility keyword → customer-facing display label. Each entry: [label, [keywords...]].
// Ordered so the most distinctive amenities surface first in the summary.
const _FACILITY_MAP = [
  ['Kids zone',      ['kids zone', 'kids club', 'kid zone', 'kods zone', 'area bermain anak', 'playground', 'kidzone']],
  ['Gym',            ['gym', 'fitness', 'fitnes']],
  ['Yoga',           ['yoga', 'tempat yoga', 'studio yoga', 'ruang yoga']],
  ['Kolam renang',   ['kolam renang', 'swimming pool', 'pool', 'kolam']],
  ['Keamanan 24 jam',['security', 'keamanan 24', 'keamanan', 'satpam', 'cctv', '24 jam', 'one gate', 'one-gate']],
  ['AC',             ['ac', 'air conditioner']],
  ['WiFi',           ['wifi', 'wi-fi', 'internet']],
  ['Lift',           ['lift', 'elevator']],
  ['Parkir',         ['parkir', 'parking']],
  ['Carport',        ['carport']],
  ['Garasi',         ['garasi', 'garage']],
  ['Taman',          ['taman', 'garden']],
  // "Perlengkapan dapur" (peralatan/alat masak) dicek SEBELUM 'Dapur' & 'Kitchen set'
  // supaya jawaban "ada perlengkapan dapur" tampil utuh, bukan dipangkas jadi "Dapur".
  ['Perlengkapan Dapur', ['perlengkapan dapur', 'peralatan dapur', 'alat dapur', 'alat masak', 'perabot dapur', 'perkakas dapur']],
  ['Kitchen set',    ['kitchen set', 'kichen set', 'kitchenset', 'kitchen']],
  ['Dapur',          ['dapur', 'pantry']],
  // Perabot / elektronik (relevan utk sewa furnished/semi)
  ['Lemari',         ['lemari', 'wardrobe', 'closet']],
  ['Kasur',          ['kasur', 'tempat tidur', 'ranjang', 'spring bed', 'springbed', 'bed']],
  ['Kulkas',         ['kulkas', 'lemari es', 'fridge', 'refrigerator']],
  ['Mesin cuci',     ['mesin cuci', 'washing machine', 'washer']],
  ['TV',             ['tv', 'televisi', 'television']],
  ['Sofa',           ['sofa']],
  ['Kompor',         ['kompor', 'stove', 'cooktop']],
  ['Microwave',      ['microwave']],
  ['Dispenser',      ['dispenser', 'water dispenser']],
  ['Water heater',   ['water heater', 'pemanas air']],
  ['Balkon',         ['balkon', 'balcony']],
  ['Rooftop',        ['rooftop']],
  ['Jogging track',  ['jogging track', 'jogging']],
  ['Mushola',        ['mushola', 'musholla', 'masjid']],
  ['Concierge',      ['concierge']],
  ['Laundry',        ['laundry']],
  // ── Ditambahkan sesuai 11 fasilitas baru di database (2026-07-03) ──────────
  // DB augmentation (_dbFacilities) hanya cocokkan substring NAMA INGGRIS-nya
  // (mis. "bedroom", "yard"), jadi sinonim Indonesia berikut wajib ada di sini
  // supaya chatbotPrivateController.js (via detectFacilities) tetap mengenali
  // jawaban customer dalam Bahasa Indonesia.
  ['Kamar Tidur',    ['kamar tidur', 'bedroom']],
  ['Halaman',        ['halaman', 'yard', 'halaman kecil']],
  ['Perlengkapan Mandi', ['perlengkapan mandi', 'toiletries', 'sabun mandi', 'shampo hotel']],
  ['Handuk',         ['handuk', 'towel', 'towels']],
  ['Ruang Keluarga', ['ruang keluarga', 'family room']],
  ['Meja',           ['meja belajar', 'meja makan', 'meja', 'table']],
  ['Area Usaha',     ['area usaha', 'business area']],
  ['Area Toko',      ['area toko', 'retail area']],
  ['Lampu',          ['lampu', 'lighting', 'penerangan']],
  // ── Fasilitas kantor / meeting & meal plan (booking office/hotel) ──────────
  // Typo-tolerant: "projectktor"/"projektor" adalah salah ketik umum "proyektor".
  ['LCD',            ['lcd']],
  ['Proyektor',      ['proyektor', 'projector', 'projektor', 'projectktor', 'projecktor']],
  ['Pilates',        ['pilates', 'pilates station']],
  ['Breakfast',      ['breakfast', 'sarapan', 'makan pagi']],
  ['Lunch',          ['lunch', 'makan siang']],
  ['Dinner',         ['dinner', 'makan malam']],
  ['Ruang Meeting',  ['ruang meeting', 'meeting room', 'ruang rapat']],
];

// ─── DB-DRIVEN facility vocabulary ───────────────────────────────────────────
// SUMBER KEBENARAN sinonim fasilitas kini di DATABASE (kolom facilities.keywords,
// JSON). _FACILITY_MAP di atas berperan sebagai (a) layer LABEL kurasi yang menang
// duluan agar teks summary stabil ("Kolam renang" bukan "Kolam Renang"), dan (b)
// FALLBACK penuh bila DB tak terjangkau. Master `facilities` (277+ baris) memuat
// long-tail (PILATES STATION, TREADMILL, GYM EQUIPMENT, …) yang tak ada di map;
// initFacilityCache() meng-expand tiap fasilitas menjadi token yang bisa dicocokkan
// (nama + semua keyword JSON-nya) sehingga admin cukup mengisi sinonim di master,
// tanpa menyentuh kode. Kolom keywords null → fallback ke NAMA fasilitas.
let _dbFacilities = [];       // [{ lower, label }] token, diurutkan terpanjang dulu
let _dbFacilityLoaded = false;

// Label tampilan bergaya "sentence case" (huruf pertama kapital, sisanya kecil) agar
// selaras dengan gaya label map ("Kolam renang", "Water heater", "Pilates station").
function _sentenceCaseFacility(s) {
  const t = String(s || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
}

/** Ekstrak array keyword dari kolom DB (JSON array, string JSON, atau null). */
function _parseKeywordsColumn(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch (_) { /* ignore */ }
  }
  return [];
}

async function initFacilityCache() {
  try {
    const { Facility } = require('../models');
    const rows = await Facility.findAll({ where: { status: 1 }, attributes: ['name', 'keywords'], raw: true });
    const tokens = [];
    for (const r of rows) {
      const name = String(r.name || '').trim();
      if (!name) continue;
      const label = _sentenceCaseFacility(name);
      // Keyword dari kolom DB; bila kosong → pakai nama fasilitas sebagai satu-satunya token.
      let kws = _parseKeywordsColumn(r.keywords);
      if (!kws.length) kws = [name];
      for (const kw of kws) {
        const lower = String(kw || '').trim().toLowerCase();
        // ≥3 char: token 1-2 huruf (AC/TV) rawan salah-tangkap & sudah dicakup map ID.
        if (lower.length < 3) continue;
        tokens.push({ lower, label });
      }
    }
    // Dedup per token (yang pertama menang), urut terpanjang dulu agar frasa spesifik
    // ("backup generator") menang atas kata umum ("generator") yang jadi substring-nya.
    const seen = new Set();
    _dbFacilities = tokens
      .filter((t) => { if (seen.has(t.lower)) return false; seen.add(t.lower); return true; })
      .sort((a, b) => b.lower.length - a.lower.length);
    _dbFacilityLoaded = true;
    console.log(`[FacilityCache] Loaded ${rows.length} facilities → ${_dbFacilities.length} keyword tokens from DB.`);
  } catch (err) {
    console.warn('[FacilityCache] initFacilityCache() failed — using hardcoded map only:', err.message);
  }
}

function detectFacilities(message = '') {
  const text = normalizeText(message);
  const out  = [];
  const coveredKeywords = new Set();  // keyword ID/EN yang sudah match dari map (untuk dedup DB)

  for (const [label, keywords] of _FACILITY_MAP) {
    let matched = false;
    for (const k of keywords) {
      // Word-boundary match so short tokens like "ac" don't match "macet"/"kapasitas".
      const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(^|\\W)${esc}(\\W|$)`, 'i').test(text)) {
        matched = true;
        coveredKeywords.add(k.toLowerCase());
      }
    }
    if (matched) out.push(label);
  }

  // Augmentasi DB: kenali fasilitas master (Inggris) yang tidak ada di map ID.
  // Lewati yang sudah terwakili keyword map (mis. "balcony"→Balkon, "pool"→Kolam renang)
  // agar tidak dobel ID/EN. Diurutkan terpanjang dulu; frasa spesifik ("backup generator")
  // menang atas kata umum ("generator") yang jadi substring-nya.
  const addedDbLowers = [];
  for (const { lower, label } of _dbFacilities) {
    if (out.includes(label) || coveredKeywords.has(lower)) continue;
    // Lewati jika istilah ini hanya bagian dari fasilitas DB yang sudah dipilih.
    if (addedDbLowers.some((sel) => sel.includes(lower))) continue;
    // Cocokkan token utuh (word-boundary). Bentuk PENDEK/parsial ("pilates" untuk
    // "PILATES STATION") disediakan lewat kolom keywords admin — BUKAN via tebakan
    // kata-pertama, yang dulu salah menangkap kata umum ("tempat" dari "tempat
    // tidur", "equipment" dari "equipment storage").
    const esc = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|\\W)${esc}(\\W|$)`, 'i').test(text)) {
      out.push(label);
      addedDbLowers.push(lower);
    }
  }

  // "Perlengkapan Dapur" sudah mencakup dapur & kitchen set — buang label generik
  // yang ikut ter-match dari kata "dapur"/"kitchen" agar tidak dobel di summary.
  let result = out.includes('Perlengkapan Dapur')
    ? out.filter((l) => l !== 'Dapur' && l !== 'Kitchen set')
    : out;
  return [...new Set(result)];
}

function parseNumberToken(token = '') {
  const raw = String(token || '').toLowerCase().trim();
  if (!raw) return null;
  const numberPart = raw.match(/[0-9]+(?:[.,][0-9]+)?/);
  if (!numberPart) return null;
  let number = Number(numberPart[0].replace(',', '.'));
  if (!Number.isFinite(number)) return null;
  if (/miliar|billion/.test(raw)) number *= 1000000000;
  else if (/juta|jt|million/.test(raw)) number *= 1000000;
  else if (/ribu|rb|thousand/.test(raw)) number *= 1000;
  return Math.round(number);
}

// ─── Smart budget range parsing ─────────────────────────────────────────────
// Input formats supported:
//   Full IDR dot notation : 5.000.000 / 412.567.000 / 569.210.000 (dots = thousands sep)
//   Suffix units          : K/k, rb/ribu, jt/juta, m/miliar/milyar, t/triliun + EN aliases
//   Mixed                 : 569.210.000 - 5m / 678 jt - 900m / 5.000.000 - 412.567.000
// Output format: full Indonesian dot notation → "Rp 5.000.000 - Rp 412.567.000"
//
// Unit inference rules (when one side of a range has no suffix unit):
//   Only-right-has-unit (X - Yunit): loRaw <= hiRaw → same unit; loRaw > hiRaw → step down
//   Only-left-has-unit  (Xunit - Y): hiRaw >= loRaw → same unit; hiRaw < loRaw → step up
//   fullIDR + bare OR bare + fullIDR → ambiguous (ask customer)
//   Neither side has unit             → ambiguous (ask customer)

const _BUDGET_UNIT_MULT = {
  k: 1e3, rb: 1e3, ribu: 1e3, thousand: 1e3,
  jt: 1e6, juta: 1e6, million: 1e6,
  m: 1e9, miliar: 1e9, milyar: 1e9, billion: 1e9,
  t: 1e12, triliun: 1e12, trilion: 1e12, trillion: 1e12,
};
const _BUDGET_LEVELS = [1e3, 1e6, 1e9, 1e12];

function _budgetResolveMult(unitStr) {
  return unitStr ? (_BUDGET_UNIT_MULT[unitStr.toLowerCase()] || null) : null;
}
function _budgetStepUp(mult) {
  const i = _BUDGET_LEVELS.indexOf(mult);
  return i >= 0 && i < _BUDGET_LEVELS.length - 1 ? _BUDGET_LEVELS[i + 1] : null;
}
function _budgetStepDown(mult) {
  const i = _BUDGET_LEVELS.indexOf(mult);
  return i > 0 ? _BUDGET_LEVELS[i - 1] : null;
}

// Full IDR dot notation: 5.000.000, 412.567.000 (Indonesian thousands separator)
// Requires digit(s) followed by one or more groups of exactly ".NNN"
const _FULL_IDR_RE = /^\d{1,3}(?:\.\d{3})+$/;

// Parse a raw decimal coefficient ("1.3", "2,6", "900") — NOT full IDR
function _parseRawNum(s) {
  if (!s) return null;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Tokenize one budget token.
//   Full IDR (5.000.000)  → { raw: 5000000, mult: 1,   isFullIDR: true  }
//   With unit (2.6juta)   → { raw: 2.6,     mult: 1e6, isFullIDR: false }
//   Bare (900)            → { raw: 900,      mult: null, isFullIDR: false }
const _BUDGET_TOKEN_RE = /^(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m|miliar|milyar|t|triliun|trilion|thousand|million|billion|trillion)?$/i;
function _tokenizeBudget(str) {
  const s = (str || '').trim();
  if (!s) return null;
  // Full IDR check MUST come before generic decimal to avoid "5.000" → 5.0
  if (_FULL_IDR_RE.test(s)) {
    const raw = parseInt(s.replace(/\./g, ''), 10);
    return Number.isFinite(raw) ? { raw, mult: 1, isFullIDR: true } : null;
  }
  const m = s.match(_BUDGET_TOKEN_RE);
  if (!m) return null;
  const raw = _parseRawNum(m[1]);
  if (raw === null) return null;
  return { raw, mult: _budgetResolveMult(m[2]), isFullIDR: false };
}

// Format resolved IDR value as full Indonesian dot notation: "Rp 5.000.000"
function _formatRpFull(n) {
  if (!n || !Number.isFinite(n)) return null;
  return `Rp ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

// Bangun rentang ±15% dari satu nilai budget ABSOLUT yang ditembak customer.
// Contoh: "40.750.000.000" → Rp 34.637.500.000 - Rp 46.862.500.000.
// Dipakai agar customer yang memberi 1 harga pasti (tanpa range) tetap punya
// batas bawah & atas yang wajar untuk pencarian + summary.
// Deteksi KATEGORI budget kualitatif dari jawaban customer.
// Urutan cek: eksklusif → menengah → terjangkau (paling spesifik dulu agar
// "menengah ke atas" tidak salah jadi eksklusif, dan "mahal" → eksklusif).
// Mengembalikan 'terjangkau' | 'menengah' | 'eksklusif' | null.
function _detectBudgetTier(text) {
  const t = ' ' + String(text || '').toLowerCase() + ' ';
  if (/\b(eksklusif|ekslusif|mewah|premium|luxur(y|ious)|high\s*end|elit|elite|kelas\s*atas|paling\s*(bagus|mahal|mewah)|termahal|sultan|the\s*best|mahal)\b/.test(t)) return 'eksklusif';
  if (/\b(menengah|sedang|medium|mid(?:dle)?|menengah\s*ke\s*atas|lumayan|kompetitif|competitive|moderate)\b/.test(t)) return 'menengah';
  if (/\b(terjangkau|ekonomis|murah|termurah|hemat|low\s*budget|affordable|cheap(?:est)?|economy|low\s*(cost|price)|paling\s*murah|standar\s*bawah|budget\s*friendly|seadanya)\b/.test(t)) return 'terjangkau';
  return null;
}

// ─── Canonical budget-tier reference table (SINGLE SOURCE OF TRUTH) ──────────
// Tabel HARGA WAJAR Indonesia 2025–2026 per tipe+transaksi. Dulu tabel ini
// HANYA ada di chatbotPrivateController.getBudgetTiers() dan hanya dipakai untuk
// menampilkan range di summary — sehingga jawaban KATEGORI ("terjangkau") tidak
// pernah membatasi katalog (detectBudget mengembalikan min/max null → filter
// meloloskan semua harga, katalog jadi campur periode). Sekarang tabel dipindah
// ke service agar bisa dipakai extractPropertyFilters() untuk mengisi min/max
// konkret sebelum filterProperties. Controller mendelegasikan ke sini (DRY).
// period: 'month'=/bln, 'night'=/malam, 'year'=/thn, ''=harga jual absolut.
const _BT_M = 1e6, _BT_B = 1e9, _BT_K = 1e3;
const _BUDGET_TIERS = {
  house: {
    rent: { terjangkau: [20*_BT_M, 60*_BT_M],   menengah: [60*_BT_M, 180*_BT_M],  eksklusif: [180*_BT_M, 600*_BT_M], period: 'year' },
    sale: { terjangkau: [350*_BT_M, 900*_BT_M], menengah: [900*_BT_M, 3*_BT_B],   eksklusif: [3*_BT_B, 15*_BT_B],    period: '' },
  },
  apartment: {
    rent: { terjangkau: [2*_BT_M, 5*_BT_M],     menengah: [5*_BT_M, 15*_BT_M],    eksklusif: [15*_BT_M, 50*_BT_M],   period: 'month' },
    sale: { terjangkau: [350*_BT_M, 800*_BT_M], menengah: [800*_BT_M, 2.5*_BT_B], eksklusif: [2.5*_BT_B, 10*_BT_B],  period: '' },
  },
  condo: {
    rent: { terjangkau: [4*_BT_M, 10*_BT_M],    menengah: [10*_BT_M, 30*_BT_M],   eksklusif: [30*_BT_M, 100*_BT_M],  period: 'month' },
    sale: { terjangkau: [700*_BT_M, 1.5*_BT_B], menengah: [1.5*_BT_B, 5*_BT_B],   eksklusif: [5*_BT_B, 20*_BT_B],    period: '' },
  },
  hotel: {
    rent: { byPeriod: {
      night: { terjangkau: [200*_BT_K, 800*_BT_K], menengah: [800*_BT_K, 2*_BT_M],  eksklusif: [2*_BT_M, 10*_BT_M],  period: 'night' },
      year:  { terjangkau: [100*_BT_M, 500*_BT_M], menengah: [500*_BT_M, 3*_BT_B],  eksklusif: [3*_BT_B, 50*_BT_B],  period: 'year' },
    } },
    sale: { terjangkau: [5*_BT_B, 20*_BT_B],    menengah: [20*_BT_B, 100*_BT_B],  eksklusif: [100*_BT_B, 500*_BT_B], period: '' },
  },
  villa: {
    rent: { byPeriod: {
      night: { terjangkau: [1*_BT_M, 3*_BT_M],   menengah: [3*_BT_M, 8*_BT_M],     eksklusif: [8*_BT_M, 30*_BT_M],   period: 'night' },
      month: { terjangkau: [10*_BT_M, 30*_BT_M], menengah: [30*_BT_M, 100*_BT_M],  eksklusif: [100*_BT_M, 500*_BT_M], period: 'month' },
    } },
    sale: { terjangkau: [800*_BT_M, 3*_BT_B],   menengah: [3*_BT_B, 10*_BT_B],    eksklusif: [10*_BT_B, 100*_BT_B],  period: '' },
  },
  boarding_house: {
    rent: { byPeriod: {
      month: { terjangkau: [600*_BT_K, 1.8*_BT_M], menengah: [1.8*_BT_M, 3.5*_BT_M], eksklusif: [3.5*_BT_M, 10*_BT_M], period: 'month' },
      year:  { terjangkau: [30*_BT_M, 80*_BT_M],   menengah: [80*_BT_M, 300*_BT_M],  eksklusif: [300*_BT_M, 2*_BT_B],  period: 'year' },
    } },
    sale: { terjangkau: [500*_BT_M, 2*_BT_B],   menengah: [2*_BT_B, 8*_BT_B],     eksklusif: [8*_BT_B, 50*_BT_B],    period: '' },
  },
  shophouse: {
    rent: { terjangkau: [30*_BT_M, 100*_BT_M],  menengah: [100*_BT_M, 300*_BT_M], eksklusif: [300*_BT_M, 1.5*_BT_B], period: 'year' },
    sale: { terjangkau: [1*_BT_B, 2.5*_BT_B],   menengah: [2.5*_BT_B, 7*_BT_B],   eksklusif: [7*_BT_B, 25*_BT_B],    period: '' },
  },
  office: {
    rent: { terjangkau: [4*_BT_M, 15*_BT_M],    menengah: [15*_BT_M, 60*_BT_M],   eksklusif: [60*_BT_M, 500*_BT_M],  period: 'month' },
    sale: { terjangkau: [1*_BT_B, 5*_BT_B],     menengah: [5*_BT_B, 20*_BT_B],    eksklusif: [20*_BT_B, 200*_BT_B],  period: '' },
  },
  warehouse: {
    rent: { terjangkau: [30*_BT_M, 100*_BT_M],  menengah: [100*_BT_M, 500*_BT_M], eksklusif: [500*_BT_M, 5*_BT_B],   period: 'year' },
    sale: { terjangkau: [1*_BT_B, 4*_BT_B],     menengah: [4*_BT_B, 15*_BT_B],    eksklusif: [15*_BT_B, 100*_BT_B],  period: '' },
  },
  store: {
    rent: { terjangkau: [1*_BT_M, 8*_BT_M],     menengah: [8*_BT_M, 30*_BT_M],    eksklusif: [30*_BT_M, 200*_BT_M],  period: 'month' },
    sale: { terjangkau: [500*_BT_M, 2*_BT_B],   menengah: [2*_BT_B, 6*_BT_B],     eksklusif: [6*_BT_B, 25*_BT_B],    period: '' },
  },
  mansion: {
    rent: { terjangkau: [30*_BT_M, 100*_BT_M],  menengah: [100*_BT_M, 300*_BT_M], eksklusif: [300*_BT_M, 2*_BT_B],   period: 'month' },
    sale: { terjangkau: [5*_BT_B, 20*_BT_B],    menengah: [20*_BT_B, 100*_BT_B],  eksklusif: [100*_BT_B, 500*_BT_B], period: '' },
  },
  land: {
    rent: { terjangkau: [50*_BT_M, 150*_BT_M],  menengah: [150*_BT_M, 500*_BT_M], eksklusif: [500*_BT_M, 2*_BT_B],   period: 'year' },
    sale: { terjangkau: [300*_BT_M, 1*_BT_B],   menengah: [1*_BT_B, 4*_BT_B],     eksklusif: [4*_BT_B, 20*_BT_B],    period: '' },
  },
  kondotel: {
    rent: { terjangkau: [500*_BT_K, 1.5*_BT_M], menengah: [1.5*_BT_M, 3*_BT_M],   eksklusif: [3*_BT_M, 8*_BT_M],     period: 'night' },
    sale: { terjangkau: [500*_BT_M, 900*_BT_M], menengah: [900*_BT_M, 1.5*_BT_B], eksklusif: [1.5*_BT_B, 4*_BT_B],   period: '' },
  },
  others: {
    rent: { terjangkau: [5*_BT_M, 20*_BT_M],    menengah: [20*_BT_M, 60*_BT_M],   eksklusif: [60*_BT_M, 200*_BT_M],  period: 'month' },
    sale: { terjangkau: [500*_BT_M, 2*_BT_B],   menengah: [2*_BT_B, 7*_BT_B],     eksklusif: [7*_BT_B, 25*_BT_B],    period: '' },
  },
};

/**
 * Kembalikan tier-set {terjangkau,menengah,eksklusif,period} untuk tipe+transaksi.
 * Menangani byPeriod (hotel/villa/kost) dengan memilih night/month/year via hint.
 * @returns {object|null}
 */
function getBudgetTiers(buildingType = '', transactionType = '', periodHint = '') {
  const type = (buildingType || '').toLowerCase();
  const tx   = (transactionType || '').toLowerCase();
  const txKey = (tx === 'rent') ? 'rent' : (tx === 'sale' || tx === 'purchase') ? 'sale' : null;
  if (!txKey) return null;

  const row = _BUDGET_TIERS[type] || _BUDGET_TIERS.others;
  let entry = row[txKey] || _BUDGET_TIERS.others[txKey] || null;
  if (!entry) return null;

  if (entry.byPeriod) {
    const bp = entry.byPeriod;
    const hint = String(periodHint || '');
    if (/year|tahun|thn|kontrak|tahunan/i.test(hint) && bp.year)   entry = bp.year;
    else if (/month|bulan|bulanan/i.test(hint) && bp.month)        entry = bp.month;
    else                                                           entry = bp.night || bp.month || bp.year;
  }
  return entry;
}

/**
 * Resolusi KATEGORI budget (terjangkau/menengah/eksklusif) → {min,max,period}
 * konkret untuk tipe+transaksi tertentu. Dipakai extractPropertyFilters agar
 * jawaban kategori ikut MEMBATASI katalog (bukan hanya tampil di summary).
 * @returns {{min:number,max:number,period:string}|null}
 */
function resolveBudgetTierRange(buildingType, transactionType, tier, periodHint = '') {
  const tiers = getBudgetTiers(buildingType, transactionType, periodHint);
  if (!tiers || !tiers[tier]) return null;
  const [min, max] = tiers[tier];
  return { min, max, period: tiers.period || '' };
}

const _BUDGET_BAND_PCT = 0.15;
function _budgetBand(value, period) {
  const lo = Math.round(value * (1 - _BUDGET_BAND_PCT));
  const hi = Math.round(value * (1 + _BUDGET_BAND_PCT));
  return {
    text    : `${_formatRpFull(lo)} - ${_formatRpFull(hi)}`,
    min     : lo,
    max     : hi,
    period,
    absolute: Math.round(value),   // nilai asli yang ditembak customer (untuk referensi)
  };
}

// Regex building blocks
const _FULL_IDR_PAT = '\\d{1,3}(?:\\.\\d{3})+';
const _BU = 'k|rb|ribu|jt|juta|m|miliar|milyar|t|triliun|trilion|thousand|million|billion|trillion';
const _DEC_UNIT_PAT = `\\d+(?:[.,]\\d+)?\\s*(?:(?:${_BU})(?![a-z]))?`;
const _RANGE_TOKEN = `(?:${_FULL_IDR_PAT}|${_DEC_UNIT_PAT})`;
const _BUDGET_RANGE_RE = new RegExp(
  `(${_RANGE_TOKEN})\\s*(?:-|sampai|sd|s\\/d|to|hingga)\\s*(${_RANGE_TOKEN})`,
  'i'
);

function detectBudget(message = '') {
  // Strip currency markers that sit directly before a number ("rp1.4", "rp 3.5",
  // "idr 5jt"). Without this, a ranged answer like "Rp1.4 - Rp 3.5 juta" breaks the
  // range regex (the inner "rp" isn't part of a number token) and only the max value
  // gets captured → the budget question loops. Removing the marker leaves clean
  // "1.4 - 3.5 juta" which parses as a proper range.
  const text = normalizeText(message).replace(/\b(?:rp|idr)\s*(?=\d)/gi, '');

  const period = /tahun|year|annual|per tahun|\/tahun/.test(text) ? 'year'
    : /bulan|month|monthly|per bulan|\/bulan/.test(text) ? 'month'
    : /malam|night|daily|hari|harian|\/malam/.test(text) ? 'night'
    : /minggu|week|weekly|per minggu|\/minggu|seminggu/.test(text) ? 'week'
    : '';

  // Buang konteks LANTAI/TOWER sebelum parsing angka budget. Tanpa ini, jawaban Q12
  // "Antara lantai 15-20 aja" ATAU "Lantai antara 12-15 aja" salah terbaca sebagai
  // budget "15-20"/"12-15" dan menimpa budget asli (mis. "1-1.6 juta") atau memicu
  // pertanyaan klarifikasi budget yang keliru ("Untuk harga 12-15 — maksudnya ribu/
  // juta/miliar?"). Mencakup: "lantai 15", "lt 27", "tower 3", "floor 15-20",
  // "lantai 15 sampai 20", "lantai 15 - 20", DAN "lantai antara 12-15" (konektor
  // "antara"/"di" boleh muncul di ANTARA kata kunci & angka, bukan cuma sebelumnya).
  let budgetText = text.replace(
    /\b(lantai|lt|tower|menara|floor|lvl|level)\s*(?:antara|di)?\s*\d+(?:\s*(?:-|–|sampai|s\/d|hingga|ke)\s*\d+)?/gi,
    ' '
  );

  // Buang konteks TANGGAL sebelum parsing angka budget. "beli 20-30 Mei tahun depan"
  // atau "tanggal 20-30 Mei" adalah rentang TANGGAL, bukan harga — tanpa strip ini
  // "20-30" salah terbaca sebagai budget ambigu → memicu "Untuk harga 20-30 —
  // maksudnya ribu/juta/miliar?" dan menimpa budget asli yang sudah jelas ("2-5 miliar").
  const _MONTH_RE = '(?:jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun[i]?|jul[i]?|agu(?:stus)?|agt|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?|january|february|march|april|june|july|august|september|october|november|december)';
  budgetText = budgetText
    // "(tanggal) 20-30 Mei" / "20 mei" → hapus (angka+bulan)
    .replace(new RegExp(`\\b(?:tanggal\\s*)?\\d{1,2}(?:\\s*(?:-|–|sampai|s\\/d|hingga|ke)\\s*\\d{1,2})?\\s+${_MONTH_RE}\\b`, 'gi'), ' ')
    // "Mei 20-30" / "mei 2027" → hapus (bulan+angka)
    .replace(new RegExp(`\\b${_MONTH_RE}\\s+\\d{1,4}(?:\\s*(?:-|–|sampai|s\\/d|hingga|ke)\\s*\\d{1,4})?\\b`, 'gi'), ' ')
    // "tanggal 20-30" tanpa bulan (dalam konteks jadwal) → hapus
    .replace(/\btanggal\s*\d{1,2}(?:\s*(?:-|–|sampai|s\/d|hingga|ke)\s*\d{1,2})?/gi, ' ');

  // Apakah budget berupa PLAFON/CEILING ("maksimal 5jt", "di bawah 5jt", "max 5jt")?
  // Jika ya → simpan sebagai batas atas saja. Jika TIDAK (customer tembak harga absolut,
  // mis. "40.750.000.000" / "5 juta") → bangun rentang ±15% (lihat _budgetBand).
  const isCeiling = /\b(maksimal|maksimum|max|di\s*bawah|dibawah|kurang\s*dari|gak?\s*lebih\s*dari|nggak\s*lebih\s*dari|tidak\s*lebih\s*dari|under|below|paling\s*mahal)\b/i.test(text);

  // ── Range match ──────────────────────────────────────────────────────────
  const rangeMatch = budgetText.match(_BUDGET_RANGE_RE);
  if (rangeMatch) {
    const lo = _tokenizeBudget(rangeMatch[1]);
    const hi = _tokenizeBudget(rangeMatch[2]);
    if (lo && hi) {
      const loResolved = lo.mult !== null;
      const hiResolved = hi.mult !== null;
      let minVal, maxVal;

      if (!loResolved && !hiResolved) {
        // Neither side has unit → ask for clarification
        return { ambiguous: true, rawMin: lo.raw, rawMax: hi.raw, period, text: rangeMatch[0].trim() };
      } else if (loResolved && hiResolved) {
        // Both resolved — use as-is
        minVal = Math.round(lo.raw * lo.mult);
        maxVal = Math.round(hi.raw * hi.mult);
      } else if (!loResolved && hiResolved) {
        // Only right side resolved
        if (hi.isFullIDR) {
          return { ambiguous: true, rawMin: lo.raw, rawMax: hi.raw, period, text: rangeMatch[0].trim() };
        }
        const loMult = lo.raw <= hi.raw ? hi.mult : (_budgetStepDown(hi.mult) || hi.mult);
        minVal = Math.round(lo.raw * loMult);
        maxVal = Math.round(hi.raw * hi.mult);
      } else {
        // Only left side resolved
        if (lo.isFullIDR) {
          return { ambiguous: true, rawMin: lo.raw, rawMax: hi.raw, period, text: rangeMatch[0].trim() };
        }
        const hiMult = hi.raw >= lo.raw ? lo.mult : (_budgetStepUp(lo.mult) || lo.mult);
        minVal = Math.round(lo.raw * lo.mult);
        maxVal = Math.round(hi.raw * hiMult);
      }

      const [minFinal, maxFinal] = [Math.min(minVal, maxVal), Math.max(minVal, maxVal)];
      return {
        text   : `${_formatRpFull(minFinal)} - ${_formatRpFull(maxFinal)}`,
        min    : minFinal,
        max    : maxFinal,
        period,
      };
    }
  }

  // ── Single value: explicit budget prefix ─────────────────────────────────
  const _STOK = `(?:${_FULL_IDR_PAT}|\\d+(?:[.,]\\d+)?\\s*(?:${_BU})?)`;
  const prefixedMatch = budgetText.match(
    new RegExp(`(?:budget|badget|harga|rp|idr|range|sekitar|maksimal|max)\\s*[:=]?\\s*(?:rp\\s*)?(${_STOK})`, 'i')
  );
  if (prefixedMatch) {
    const tok = _tokenizeBudget(prefixedMatch[1]);
    if (tok && tok.mult) {
      const value = Math.round(tok.raw * tok.mult);
      // Plafon ("maksimal 5jt") → batas atas. Absolut ("sekitar 5jt", "harga 5jt") → band ±15%.
      return isCeiling
        ? { text: _formatRpFull(value), min: null, max: value, period }
        : _budgetBand(value, period);
    }
  }

  // ── Single value: monetary unit required (prevents matching bare dates/counts) ──
  // The (?![a-z]) after the unit stops "2 kali" → "2 k", "3 kamar" → "3 k",
  // "10 menit" → "10 m" etc. from being mis-read as a currency amount.
  const unitReqMatch = budgetText.match(
    new RegExp(`(?:rp\\s*)?(${_FULL_IDR_PAT}|\\d+(?:[.,]\\d+)?\\s*(?:${_BU})(?![a-z]))`, 'i')
  );
  if (unitReqMatch) {
    const tok = _tokenizeBudget(unitReqMatch[1]);
    if (tok && tok.mult) {
      const value = Math.round(tok.raw * tok.mult);
      // Customer tembak 1 harga absolut (mis. "40.750.000.000", "5 juta") tanpa range →
      // bangun rentang ±15%. Kalau "maksimal/di bawah" → batas atas saja.
      return isCeiling
        ? { text: _formatRpFull(value), min: null, max: value, period }
        : _budgetBand(value, period);
    }
  }

  // ── Kategori budget kualitatif: terjangkau / menengah / eksklusif ─────────
  // Customer boleh jawab kategori, bukan angka. Range harga konkret per tipe+tx
  // di-resolve nanti di buildAgentBrief (butuh buildingType+transactionType).
  const tier = _detectBudgetTier(text);
  if (tier) {
    return { text: tier, min: null, max: null, period, preference: tier };
  }

  return null;
}

/**
 * Build cumulative property profile by processing each user message individually.
 * Setiap field diisi oleh nilai terbaru yang ditemukan (pesan terbaru wins per field).
 * Ini lebih akurat daripada join semua teks → satu deteksi, karena:
 *   - Pesan "Beli" tidak akan ter-overlap dengan "hotel" dari turn lain
 *   - Setiap jawaban kualifikasi diterapkan tepat pada field-nya
 */
// Role pesan customer bisa berbeda tergantung controller yang menyimpan:
//   fonnteChatController / kirimiChatController / timelinesAIChatController → 'customer'
//   sessionService.saveUserMessage (website chatbot)               → 'user'
// Keduanya harus diikutsertakan dalam ekstraksi history.
const CUSTOMER_ROLES = new Set(['user', 'customer']);
const AI_ROLES       = new Set(['assistant', 'ai']);

function extractFromHistory(history = []) {
  // Window harus cukup besar untuk menampung SATU sesi kualifikasi penuh (Q1–Q12 +
  // Q14). Sebelumnya .slice(-8) terlalu kecil: pada percakapan ≥9 pesan, pesan
  // pembuka yang membawa tipe/transaksi/lokasi/budget bisa keluar dari window,
  // sehingga gate keliru menganggap semua field kosong dan mengulang pertanyaan
  // pembuka di akhir alur. History sudah dibatasi ~24 pesan oleh pemanggil; di sini
  // kita pakai 24 pesan customer terakhir (deteksi ganti-tipe per-pesan tetap jalan
  // di loop untuk mencegah warisan dari pencarian lama).
  const recentUserMsgs = (history || [])
    .filter((item) => CUSTOMER_ROLES.has(item.role))
    .slice(-40);   // ≤40 pesan customer: cukup untuk kualifikasi terpanjang (customer sering 1–3 kata/pesan)

  const accumulated = {
    buildingType:   '',
    transactionType:'',
    location:       '',
    budget:         null,
    facilities:     [],
    fallbackTypes:  [],
    landmark:       '',
  };

  for (const histMsg of recentUserMsgs) {
    const h = extractSingleMessageFilters(histMsg.message || '');

    // Jika tipe properti berubah ke tipe yang berbeda dalam percakapan yang sama,
    // reset transactionType supaya tidak mewarisi tx dari konteks pencarian lama.
    // Contoh: riwayat "sewa hotel" lalu customer berubah ke "mau rumah"
    //         → tx 'rent' dari hotel tidak boleh diwarisi ke pencarian rumah.
    if (h.buildingType && accumulated.buildingType && h.buildingType !== accumulated.buildingType) {
      accumulated.transactionType = '';
      accumulated.location        = '';  // lokasi lama juga direset — bisa jadi beda kota
      accumulated.budget          = null;
      accumulated.facilities      = [];  // fasilitas pencarian lama tidak diwarisi
      accumulated.landmark        = '';  // patokan lama juga direset — beda kota, beda landmark
    }

    if (h.buildingType)          accumulated.buildingType    = h.buildingType;
    if (h.transactionType)       accumulated.transactionType = h.transactionType;
    // LOKASI — first-wins + overwrite hanya bila pesan punya CUE ganti lokasi.
    // Tanpa guard ini, kota yang kebetulan disebut dalam konteks non-pencarian
    // menimpa lokasi asli: "Karena saya orang surabaya" (asal-usul) atau "survei
    // bareng" (bareng=bersama, tapi 'Bareng' juga nama tempat) → lokasi Jakarta
    // customer hilang. Cue = di/ke/area/kawasan/daerah/lokasi/pindah/cari/nyari.
    if (h.location && _shouldOverwriteLocation(accumulated.location, h.location, histMsg.message || '')) {
      accumulated.location = h.location;
    }
    // BUDGET — pakai _mergeBudget (bukan last-wins): budget RESOLVED ("2-5 miliar")
    // tidak boleh ditimpa oleh angka ambigu yang muncul belakangan (mis. sisa
    // "20-30" bila strip tanggal meleset). Budget resolved baru tetap menang.
    if (h.budget)                accumulated.budget          = _mergeBudget(h.budget, accumulated.budget);
    // Fasilitas AKUMULATIF (union) — customer bisa menyebut "kolam renang, gym"
    // di satu pesan dan "dapur lengkap" di pesan lain; semuanya diinginkan.
    // Sebelumnya pakai '=' sehingga pesan terakhir menimpa yang sebelumnya
    // (mis. "Dapur" menghapus "Kolam renang, Gym" → summary tidak lengkap).
    if (h.facilities?.length)    accumulated.facilities      = [...new Set([...accumulated.facilities, ...h.facilities])];
    if (h.fallbackTypes?.length) accumulated.fallbackTypes   = h.fallbackTypes;
    if (h.landmark)              accumulated.landmark        = h.landmark;
  }

  return accumulated;
}

/**
 * Deteksi tipe properti fallback yang eksplisit disebutkan customer.
 *
 * Pattern yang dikenali:
 *   "kalau tidak ada hotel, villa saja"      → fallbackTypes: ['villa']
 *   "jika gak ada rumah, apartemen juga oke" → fallbackTypes: ['apartment']
 *   "hotel atau villa"                        → primaryType: hotel, fallbackTypes: ['villa']
 *
 * @param {string} message
 * @returns {string[]} Array of fallback buildingType keys
 */
function detectFallbackTypes(message = '') {
  const text    = normalizeText(message);
  const results = [];

  // Pattern 1: "kalau/jika tidak/enggak ada [type]..." — conditional fallback
  // Covers: "kalau tidak ada villa", "kalau enggak ada hotel", "kalo ga ada rumah"
  const fallbackRegex = /(?:kalau|jika|bila|kalo)\s+(?:tidak|gak|ga|ngga|enggak|kagak|ndak|ga ada|tidak ada|enggak ada)\s+(?:ada\s+)?([a-z\s]+?)(?:,|\.|;|$|\s+(?:kasih|berikan|saran|aja|saja|juga|ok|oke|bisa|boleh))/gi;
  let m;
  while ((m = fallbackRegex.exec(text)) !== null) {
    const t = detectBuildingType(m[1].trim());
    if (t) results.push(t);
  }

  // Pattern 2: "[type] atau [type]" / "[type] dan [type]"  (multi-type explicit)
  const multiTypeRegex = /\b([a-z]+)\s+(?:atau|or|dan|and|\/)\s+([a-z]+)\b/gi;
  while ((m = multiTypeRegex.exec(text)) !== null) {
    const t = detectBuildingType(m[2].trim());
    if (t) results.push(t);
  }

  // Pattern 3: "sewa/beli [type] saja/aja" — direct fallback statement
  // Covers: "Saya sewa apartemen saja", "beli rumah aja"
  // These indicate the customer's fallback when primary type is unavailable.
  const directFallbackRegex = /\b(?:sewa|beli|kontrak)\s+([a-z]+)\s+(?:saja|aja)\b/gi;
  while ((m = directFallbackRegex.exec(text)) !== null) {
    const t = detectBuildingType(m[1].trim());
    if (t) results.push(t);
  }

  // Deduplicate
  return [...new Set(results)];
}

function extractSingleMessageFilters(message = '') {
  return {
    buildingType  : detectBuildingType(message),
    transactionType: detectTransactionType(message),
    location      : detectLocation(message),
    budget        : detectBudget(message),
    facilities    : detectFacilities(message),
    fallbackTypes : detectFallbackTypes(message),  // tipe-tipe alternatif eksplisit
    landmark      : detectLandmark(message),        // patokan/landmark terdekat (mis. "Pakuwon")
  };
}

/**
 * Gabungkan budget current vs accumulated dengan PRIORITAS pada budget yang RESOLVED.
 * Mencegah jawaban kemudian yang ambigu/tanpa unit (mis. "15-20" dari "lantai 15-20",
 * atau angka telanjang) MENIMPA budget asli yang sudah jelas ("Rp 1jt - Rp 1.6jt").
 *
 * Aturan:
 *  - current resolved (punya min/max & tidak ambiguous)  → pakai current (budget baru sah).
 *  - current ambigu/null TAPI accumulated resolved        → pertahankan accumulated.
 *  - selain itu                                           → current || accumulated || null.
 */
function _mergeBudget(current, accumulated) {
  const isResolved = (b) => !!b && !b.ambiguous && (b.min != null || b.max != null || !!b.preference);
  if (isResolved(current)) return current;
  if (isResolved(accumulated) && (!current || current.ambiguous)) return accumulated;
  return current || accumulated || null;
}

// Cue bahwa pesan memang MENGGANTI lokasi pencarian (bukan sekadar menyebut kota
// dalam konteks lain: "orang surabaya", "kota bandung bagus ya", "survei bareng").
const _LOCATION_CHANGE_CUE = /\b(di|ke|area|kawasan|daerah|lokasi|pindah|cari(?:kan|in)?|nyari|prefer|mau)\b/i;

/**
 * Haruskah lokasi baru (next) menimpa lokasi yang sudah ada (prev)?
 * - prev kosong                     → ya (lokasi pertama)
 * - next kosong / sama              → tidak
 * - REFINEMENT (Jakarta↔Jakarta Selatan, salah satu memuat yang lain) → ya
 * - kota BERBEDA                    → hanya bila pesan punya cue ganti lokasi
 * Mencegah kota yang kebetulan disebut (asal-usul, small talk) menghapus lokasi asli.
 */
function _shouldOverwriteLocation(prev, next, msg = '') {
  if (!prev) return true;
  if (!next || next === prev) return false;
  const p = prev.toLowerCase(), n = next.toLowerCase();
  if (p.includes(n) || n.includes(p)) return true;   // refinement
  return _LOCATION_CHANGE_CUE.test(msg);
}

function extractPropertyFilters(message = '', history = []) {
  const current    = extractSingleMessageFilters(message);
  const accumulated = extractFromHistory(history);

  // Current message wins on each field.
  // Transactiontype dari history TIDAK dibuang kecuali current message secara eksplisit
  // mengganti tipe properti ke tipe yang BERBEDA (indikasi pencarian baru).
  // Contoh yang diizinkan untuk inherit tx:
  //   history: "beli rumah"   → tx=sale
  //   current: "di Surabaya"  → current.tx='', current.type=''  → masih inherit 'sale'
  // Contoh yang direset:
  //   history: "sewa hotel"   → tx=rent, type=hotel
  //   current: "mau rumah"    → current.type=house (berbeda!) → tx direset ke ''
  const typeChangedToNew = Boolean(
    current.buildingType &&
    accumulated.buildingType &&
    current.buildingType !== accumulated.buildingType
  );

  const merged = {
    buildingType:   current.buildingType    || accumulated.buildingType    || '',
    transactionType:current.transactionType || (typeChangedToNew ? '' : accumulated.transactionType) || '',
    // Lokasi current hanya menang bila memang mengganti/merinci lokasi (punya cue
    // atau refinement); kota yang kebetulan disebut di pesan terakhir tidak menimpa
    // lokasi pencarian yang sudah mapan. Lihat _shouldOverwriteLocation.
    location:       (current.location && _shouldOverwriteLocation(accumulated.location, current.location, message))
                      ? current.location
                      : (accumulated.location || current.location || ''),
    budget:         _mergeBudget(current.budget, accumulated.budget),
    facilities:     current.facilities?.length ? current.facilities : accumulated.facilities || [],
    fallbackTypes:  current.fallbackTypes   || accumulated.fallbackTypes   || [],
    landmark:       current.landmark        || accumulated.landmark        || '',
  };

  // Resolusi KATEGORI budget → range konkret. Bila customer jawab tier
  // ("terjangkau") tanpa angka, detectBudget mengembalikan min/max null +
  // preference='terjangkau'. Tanpa langkah ini filterProperties meloloskan
  // SEMUA harga (budgetMatches: min&max null → true), sehingga katalog "sewa
  // apartemen terjangkau" ikut menampilkan listing 3.9jt/hari & 8.4jt/tahun
  // bercampur. Begitu tipe+transaksi diketahui, isi min/max dari tabel wajar.
  if (merged.budget && merged.budget.preference
      && merged.budget.min == null && merged.budget.max == null
      && merged.buildingType && merged.transactionType) {
    const range = resolveBudgetTierRange(
      merged.buildingType, merged.transactionType,
      merged.budget.preference, merged.budget.period || ''
    );
    if (range) {
      merged.budget = {
        ...merged.budget,
        min: range.min,
        max: range.max,
        period: merged.budget.period || range.period || '',
      };
    }
  }

  // Auto-alias tipe percakapan baru ke tipe dasar katalog. Tipe percakapan
  // (mansion/kondotel/store) tetap dipakai untuk Q14 + budget anchor di
  // controller, sedangkan alias-nya memastikan pencarian katalog tetap berisi.
  const catalogAlias = CATALOG_TYPE_ALIAS[merged.buildingType];
  if (catalogAlias && !merged.fallbackTypes.includes(catalogAlias)) {
    merged.fallbackTypes = [...merged.fallbackTypes, catalogAlias];
  }

  return merged;
}

/**
 * Deteksi apakah user minta properti dengan harga tertentu.
 *
 * @param {string} message
 * @returns {'asc'|'desc'|''}
 *   'asc'  = user minta termurah (cheap, murah, affordable)
 *   'desc' = user minta termahal (expensive, mewah, luxury)
 *   ''     = tidak ada preferensi harga
 */
function detectPriceSort(message = '') {
  const text = normalizeText(message);
  const cheapWords = [
    'cheap', 'cheaper', 'cheapest', 'affordable', 'low price', 'low cost',
    'budget', 'low budget', 'economy', 'economical',
    'murah', 'termurah', 'paling murah', 'terjangkau', 'hemat', 'ekonomis',
  ];
  const expensiveWords = [
    'expensive', 'luxury', 'premium', 'high end', 'most expensive',
    'mahal', 'termahal', 'paling mahal', 'mewah',
  ];

  if (cheapWords.some(w => text.includes(w))) return 'asc';
  if (expensiveWords.some(w => text.includes(w))) return 'desc';
  return '';
}

/**
 * Sort properties by parsed price value.
 * Properties without a parseable price are pushed to the end.
 *
 * @param {object[]} properties
 * @param {'asc'|'desc'} direction
 * @returns {object[]}
 */
// Harga yang bisa dibandingkan lintas periode: nilai sewa dinormalisasi ke
// per-hari (2.7jt/bulan → 90rb/hari) supaya "3.9 juta/HARI" tidak terurut
// sebagai "lebih murah" daripada "8.4 juta/TAHUN". Harga absolut (jual) tetap apa adanya.
// Hari per periode sewa — dideklarasikan SEBELUM pemakaian pertama (_sortablePrice)
// agar tidak berada di Temporal Dead Zone. Lihat catatan kelas bug M62/M63.
const _PERIOD_DAYS = { night: 1, week: 7, month: 30, year: 360 };

function _sortablePrice(property) {
  const parsed = parsePropertyPrice(property);
  if (!parsed || parsed.value == null) return null;
  const days = _PERIOD_DAYS[parsed.period];
  return days ? parsed.value / days : parsed.value;
}

function sortByPrice(properties = [], direction = 'asc') {
  return [...properties].sort((a, b) => {
    const pA = _sortablePrice(a);
    const pB = _sortablePrice(b);

    // Null values go to end regardless of sort direction
    if (pA === null && pB === null) return _titleCompare(a, b);
    if (pA === null) return 1;
    if (pB === null) return -1;

    if (pA !== pB) return direction === 'asc' ? pA - pB : pB - pA;
    return _titleCompare(a, b); // tie-break by title (ORDER BY price, title)
  });
}

/** Bandingkan judul (case-insensitive) untuk tie-break sort ORDER BY …, title. */
function _titleCompare(a = {}, b = {}) {
  return String(a.title || '').localeCompare(String(b.title || ''), 'id', { sensitivity: 'base' });
}

/**
 * Urutan katalog DEFAULT: harga termurah dulu, lalu judul (ORDER BY price, title).
 * Dipakai saat customer TIDAK secara eksplisit minta termurah/termahal.
 */
function sortByPriceThenTitle(properties = []) {
  return sortByPrice(properties, 'asc');
}

function isRecommendationRequest(message = '') {
  const text = normalizeText(message);
  return [
    'saran', 'rekomendasi', 'recommend', 'pilihan', 'opsi', 'ada apa', 'apa saja',
    'langsung', 'bingung', 'tolong berikan', 'cari', 'mau', 'butuh', 'need', 'find',
    'hotel di', 'rumah di', 'villa di', 'apartemen di', 'kos di'
  ].some((keyword) => text.includes(keyword));
}

function mergePropertyCatalog(dbProperties = []) {
  const source = [...dbProperties, ...getFallbackProperties()];
  const seen = new Set();
  const merged = [];

  source.forEach((property) => {
    const key = [property.title, property.city || property.location, property.buildingType, property.transactionType, property.price]
      .map((value) => String(value || '').toLowerCase().trim())
      .join('|');
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(property);
    }
  });

  return merged;
}

/**
 * Format a numeric price + price_type (from `properties` table) to an Indonesian
 * human-readable string that parsePropertyPrice() can later parse back to a value.
 *
 * price_type values: Night | Daily | Weekly | Monthly | Yearly | Cash | Negotiable | Others
 */
function formatDbPrice(price, priceType) {
  if (!price) return '';
  const num = parseFloat(String(price));
  if (!num || isNaN(num)) return '';

  let formatted;
  if (num >= 1_000_000_000) {
    const v = num / 1_000_000_000;
    formatted = parseFloat(v.toFixed(2)) + ' miliar';
  } else if (num >= 1_000_000) {
    const v = num / 1_000_000;
    formatted = parseFloat(v.toFixed(1)) + ' juta';
  } else if (num >= 1_000) {
    const v = num / 1_000;
    formatted = parseFloat(v.toFixed(0)) + ' ribu';
  } else {
    formatted = String(num);
  }

  switch ((priceType || '').toLowerCase()) {
    case 'monthly':    return formatted + '/bulan';
    case 'yearly':     return formatted + '/tahun';
    case 'night':      return formatted + '/malam';
    case 'daily':      return formatted + '/hari';
    case 'weekly':     return formatted + '/minggu';
    case 'negotiable': return formatted + ' nego';
    default:           return formatted;
  }
}

/**
 * Query active (status=1) properties from the database, including city/province
 * names, first image URL, and facility names. Returns the same normalized shape as
 * loadJsonProperties() so all downstream filter/sort functions work unchanged.
 *
 * Falls back to [] on any DB error so getSourceProperties() can then use the JSON catalog.
 *
 * Cache: results are cached in-memory for DB_PROPS_CACHE_TTL_MS (5 min) to prevent
 * repeated heavy JOIN queries on every chat message. Call clearDbPropertiesCache()
 * after admin creates/updates a property to force refresh.
 */
let _dbPropertiesCache = null;
let _dbPropertiesCacheTime = 0;
const DB_PROPS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function clearDbPropertiesCache() {
  _dbPropertiesCache = null;
  _dbPropertiesCacheTime = 0;
}

async function getDbProperties() {
  const now = Date.now();
  if (_dbPropertiesCache !== null && (now - _dbPropertiesCacheTime) < DB_PROPS_CACHE_TTL_MS) {
    return _dbPropertiesCache;
  }

  try {
    const { Property, PropertyImage, PropertyFacility, Facility, PropertyLocation, Location, City, Province } = require('../models');

    const rows = await Property.findAll({
      where: { status: 1 },
      include: [
        { model: City,     as: 'city',     attributes: ['name'], required: false },
        { model: Province, as: 'province', attributes: ['name'], required: false },
        { model: PropertyImage,    as: 'images',    attributes: ['url'], required: false },
        {
          model: PropertyFacility, as: 'facilities', attributes: ['facility_id'], required: false,
          include: [
            { model: Facility, as: 'facility', attributes: ['name'], required: false, where: { status: 1 } }
          ]
        },
        {
          model: PropertyLocation, as: 'locations', attributes: ['location_id'], required: false,
          include: [
            { model: Location, as: 'location', attributes: ['name'], required: false, where: { status: 1 } }
          ]
        }
      ]
    });

    const normalized = rows.map(p => {
      const d = p.toJSON();
      // Nilai harga MENTAH (numeric) untuk budget BETWEEN yang akurat — hindari
      // re-parse dari string "450 juta". priceType disimpan mentah (night/monthly/…).
      const rawPrice = (d.price !== null && d.price !== undefined && d.price !== '')
        ? Number(d.price) : null;
      return {
        id             : d.property_id,
        // Pemilik/agent properti (users.user_id). Dipakai untuk scoping katalog
        // per-agent di terminal WhatsApp: tiap agent hanya merekomendasikan
        // listing miliknya sendiri (lihat filterProperties → filters.userId).
        userId         : d.user_id || '',
        title          : d.title || '',
        description    : d.description || '',
        price          : formatDbPrice(d.price, d.price_type),
        priceValue     : Number.isFinite(rawPrice) ? rawPrice : null,
        priceType      : (d.price_type || '').toLowerCase(),
        location       : d.city?.name || '',
        province       : d.province?.name || '',
        city           : d.city?.name || '',
        district       : d.district || '',
        area           : d.area || '',
        address        : d.address || '',
        buildingArea   : d.building_area || '',
        landArea       : d.land_area || '',
        buildingType   : (d.building_type || '').toLowerCase(),
        transactionType: (d.transaction_type || '').toLowerCase(),
        facilities     : (d.facilities || []).map(f => f.facility?.name).filter(Boolean).join(', '),
        // Lokasi/landmark terdekat (mis. "Pasar Besar, PTC") — dari property_locations
        // (FK ke locations). Dipakai untuk baris "Lokasi Terdekat" di catalog listing.
        nearbyLocations: (d.locations || []).map(l => l.location?.name).filter(Boolean).join(', '),
        imageUrl       : (d.images || [])[0]?.url || '',
        status         : 'available',
        bedrooms       : d.bed_rooms   || 0,
        bathrooms      : d.bath_rooms  || 0,
        furnishedStatus: d.furnished_status || ''
      };
    });

    _dbPropertiesCache = normalized;
    _dbPropertiesCacheTime = now;
    console.log(`[PropertyRecommendationService] Loaded ${normalized.length} properties from database.`);
    return normalized;
  } catch (err) {
    console.error('[PropertyRecommendationService] getDbProperties() failed:', err.message);
    return [];
  }
}

async function getSourceProperties() {
  const dbProperties = await getDbProperties();
  if (dbProperties.length > 0) {
    // DB has live data: DB first (priority), JSON catalog as gap-fill fallback (deduped)
    return mergePropertyCatalog(dbProperties);
  }
  // DB empty or unreachable → fall back to JSON catalog only
  return loadJsonProperties();
}

// Map raw DB price_type (night/daily/weekly/monthly/yearly/cash/…) → period vocab.
function _periodFromPriceType(priceType = '') {
  switch (String(priceType).toLowerCase()) {
    case 'yearly':  return 'year';
    case 'monthly': return 'month';
    case 'weekly':  return 'week';
    case 'night':
    case 'daily':   return 'night';
    default:        return ''; // cash / negotiable / others → harga absolut
  }
}

function parsePropertyPrice(property = {}) {
  // Properti dari DB membawa nilai MENTAH (priceValue numeric + priceType) —
  // pakai itu agar budget BETWEEN akurat, tanpa re-parse string "450 juta".
  // Properti dari JSON catalog tidak punya priceValue → fallback parse string.
  let value, period;
  if (Number.isFinite(property.priceValue) && property.priceValue > 0) {
    value  = property.priceValue;
    period = _periodFromPriceType(property.priceType);
  } else {
    const text = normalizeText(property.price);
    value  = parseNumberToken(text);
    period = /tahun|year|annual|\/tahun/.test(text)
      ? 'year'
      : /bulan|month|monthly|\/bulan/.test(text)
        ? 'month'
        : /minggu|week|weekly|\/minggu/.test(text)
          ? 'week'
          : /malam|night|daily|hari|harian|\/malam/.test(text)
            ? 'night'
            : '';
  }

  if (!value) return { value: null, period, annualValue: null };
  const annualValue = period === 'year' ? value : period === 'month' ? value * 12 : null;
  return { value, period, annualValue };
}

// Konversi periode sewa → hari, untuk menyamakan satuan sebelum membandingkan
// harga. year=360 & month=30 dipilih supaya rasio year/month tepat 12 (konsisten
// dengan konversi tahunan↔bulanan yang lama).
// (_PERIOD_DAYS dipindahkan ke atas _sortablePrice — hindari TDZ)

function budgetMatches(property = {}, budget = null) {
  if (!budget || (!budget.min && !budget.max)) return true;
  const parsed = parsePropertyPrice(property);
  if (!parsed.value) return true;

  // Normalisasi LINTAS PERIODE: budget "5-7 juta/minggu" vs listing "8.3 juta/malam"
  // dulu dibandingkan angka mentah (8.3 vs 7 → beda tipis) padahal per-minggu
  // listing itu ≈58 juta. Konversi harga listing ke periode budget dulu, baru
  // bandingkan. Bila salah satu tanpa periode (harga jual absolut) → bandingkan
  // mentah seperti semula.
  let comparable = parsed.value;
  const bDays = _PERIOD_DAYS[budget.period] || null;
  const pDays = _PERIOD_DAYS[parsed.period] || null;
  if (bDays && pDays && bDays !== pDays) {
    comparable = parsed.value * (bDays / pDays);
  } else if (bDays && !pDays) {
    // Budget per-periode tapi harga listing absolut/tanpa periode — tidak sebanding.
    // Perilaku lama untuk budget tahunan adalah menolak (annualValue null); kini
    // konsisten untuk semua periode: tolak agar listing salah-satuan tidak lolos.
    return false;
  }

  if (!comparable) return false;
  if (budget.min && comparable < budget.min) return false;
  if (budget.max && comparable > budget.max) return false;
  return true;
}

/**
 * @param {object} filters - filters.landmark (opsional) memfilter/mem-prioritaskan
 *   properti yang ter-tag ke landmark tsb via tabel `property_locations`. Bila
 *   filter landmark menghasilkan NOL properti (data tagging landmark yang sparse
 *   untuk kota/tipe tsb), kita FALLBACK ke hasil TANPA landmark constraint —
 *   customer tetap dapat listing kota-wide, bukan kosong sama sekali.
 */
async function searchProperties(filters = {}) {
  const source = await getSourceProperties();
  let landmarkPropertyIds = null;
  if (filters.landmark) {
    landmarkPropertyIds = await getPropertyIdsForLandmark(filters.landmark);
  }
  const results = filterProperties(source, { ...filters, landmarkPropertyIds });
  if (filters.landmark && results.length === 0) {
    // Tidak ada properti ter-tag ke landmark ini (atau landmark tak dikenal) —
    // fallback ke filter kota/tipe/tx/budget saja, tetap konsisten dengan
    // desain "nearest landmark" sebagai BOOST, bukan constraint keras.
    return filterProperties(source, { ...filters, landmarkPropertyIds: null });
  }
  return results;
}

function filterProperties(properties, filters = {}) {
  const transactionType = normalizeText(filters.transactionType);
  const buildingType = normalizeText(filters.buildingType);
  const location = normalizeText(filters.location || filters.city);
  const landmarkPropertyIds = filters.landmarkPropertyIds || null;
  // Scoping per-agent (terminal WhatsApp): hanya listing milik agent ini.
  // Kosong/null → tidak difilter (chatbot web publik = katalog global).
  const userId = filters.userId ? String(filters.userId).trim() : '';

  return properties.filter((property) => {
    const propertyText = [property.province, property.location, property.city, property.district, property.address].map(normalizeText).join(' ');
    const matchesUser = userId ? String(property.userId || '').trim() === userId : true;
    const matchesTransaction = transactionType ? normalizeText(property.transactionType) === transactionType : true;
    const matchesBuilding = buildingType ? normalizeText(property.buildingType) === buildingType : true;
    const matchesLocation = location ? propertyText.includes(location) : true;
    const matchesBudget = budgetMatches(property, filters.budget);
    const matchesLandmark = landmarkPropertyIds ? landmarkPropertyIds.has(property.id) : true;
    return matchesUser && matchesTransaction && matchesBuilding && matchesLocation && matchesBudget && matchesLandmark;
  });
}

function propertyMatchesCoreVisibleRequest(property = {}, filters = {}) {
  const buildingType = normalizeText(filters.buildingType);
  const location = normalizeText(filters.location || filters.city);
  const transactionType = normalizeText(filters.transactionType);

  const propertyText = [property.province, property.location, property.city, property.district, property.address]
    .map(normalizeText)
    .join(' ');

  const matchesBuilding = buildingType ? normalizeText(property.buildingType) === buildingType : true;
  const matchesLocation = location ? propertyText.includes(location) : true;
  const matchesTransaction = transactionType ? normalizeText(property.transactionType) === transactionType : true;

  return matchesBuilding && matchesLocation && matchesTransaction;
}

function getVisibleMatchesFromAlternatives(alternatives = [], filters = {}) {
  return (alternatives || []).filter((property) => propertyMatchesCoreVisibleRequest(property, filters));
}


/**
 * Cari properti dengan memperlebar range harga secara bertahap — DIBATASI oleh
 * "harga wajar" (reasonable price). Tidak lagi tanpa-limit: menampilkan properti
 * dengan harga jauh di luar anggaran customer (mis. 60 M untuk budget 800 rb)
 * tidak membantu dan menyesatkan.
 *
 * Jika customer minta gudang di Semarang harga 8-15 jt tapi tidak ada:
 *   Tahap 1: coba 5-18 jt   (±35%)
 *   Tahap 2: coba 2-21 jt   (±70%)
 *   Tahap 3: coba 1.6-37 jt  (harga wajar: min ×0.20, max ×2.5 — batas akhir)
 *
 * buildingType, transactionType, dan location TIDAK pernah dilonggarkan.
 * Jika tahap 3 (batas wajar) pun kosong → return kosong; caller lalu memakai
 * fallback "fasilitas standar per tipe" (bukan memaksakan properti tak wajar).
 *
 * @param {object[]} source  - Semua properti dari catalog
 * @param {object}   filters - Filters asli (harus punya filters.budget)
 * @returns {{ results: object[], expandedBudget: object|null, expansionStep: number }}
 */
// Batas "harga wajar" untuk ekspansi budget terakhir — jangan tampilkan properti
// > 2.5× anggaran maksimum (atau < 0.20× minimum) customer.
const REASONABLE_MIN_FACTOR = 0.20;
const REASONABLE_MAX_FACTOR = 2.5;

function findWithExpandedBudget(source, filters) {
  const budget = filters.budget;
  if (!budget || (!budget.min && !budget.max)) {
    return { results: [], expandedBudget: null, expansionStep: 0 };
  }

  const min = budget.min || 0;
  const max = budget.max || 0;

  // Tangga pelebaran budget — SENGAJA halus (±15% lalu ±30%), bukan lompat ±35%/±70%.
  // Lompatan besar membuat AI menawarkan properti yang jauh di luar anggaran sehingga
  // rekomendasi terasa tidak relevan. Pola: turun 15% & naik 15%; bila masih kosong,
  // ulangi sekali lagi (jadi ±30%); baru kemudian batas wajar sebagai upaya terakhir.
  // ⚠️ location & buildingType SELALU dipertahankan di setiap langkah — pelebaran
  // hanya menyentuh HARGA, tidak pernah memindahkan pencarian ke kota lain.
  const expansions = [
    // Step 1: ±15%
    { min: min ? Math.round(min * 0.85) : null, max: max ? Math.round(max * 1.15) : null, step: 1 },
    // Step 2: ±30% (mengulang langkah 1 sekali lagi)
    { min: min ? Math.round(min * 0.70) : null, max: max ? Math.round(max * 1.30) : null, step: 2 },
    // Step 3: batas WAJAR (bukan tanpa-limit) — min ×0.20, max ×2.5
    {
      min: min ? Math.round(min * REASONABLE_MIN_FACTOR) : null,
      max: max ? Math.round(max * REASONABLE_MAX_FACTOR) : null,
      step: 3,
    },
  ];

  for (const { min: newMin, max: newMax, step } of expansions) {
    const results = filterProperties(source, {
      userId         : filters.userId || null,
      buildingType   : filters.buildingType,
      transactionType: filters.transactionType,
      location       : filters.location,
      budget         : (newMin || newMax) ? { ...budget, min: newMin, max: newMax } : null,
    });

    if (results.length > 0) {
      return {
        results,
        expandedBudget: { min: newMin, max: newMax, period: budget.period },
        expansionStep : step,
      };
    }
  }

  return { results: [], expandedBudget: null, expansionStep: 0 };
}

/**
 * Get alternative properties ketika tidak ada exact match.
 *
 * ATURAN STRICT TYPE MATCHING:
 *   Jika buildingType ditetapkan, alternatif HANYA dari tipe yang sama.
 *   Tidak pernah cross-type (misal: minta rumah → jangan tampil apartemen/gudang).
 *
 *   Urutan relaksasi (satu per satu, bukan sekaligus):
 *     1. Type + transaction + location (remove budget only)
 *     2. Type + transaction (remove location constraint)
 *     3. Type only (remove transaction constraint)
 *
 *   Jika customer eksplisit sebut fallback type (filters.fallbackTypes):
 *     Misal "hotel, kalau tidak ada villa saja"
 *     → Cari hotel dulu, jika tidak ada → cari villa
 *
 * @param {object} filters
 * @returns {Promise<object[]>}
 */
async function getAlternatives(filters = {}) {
  const source = await getSourceProperties();
  const seen   = new Set();
  const result = [];

  const add = (items = []) => {
    for (const item of items) {
      const key = item.id || item.title;
      if (!seen.has(key)) { seen.add(key); result.push(item); }
    }
  };

  const bt           = filters.buildingType;
  const tt           = filters.transactionType;
  const loc          = filters.location;
  const fallbackTypes = filters.fallbackTypes || [];
  // Scoping per-agent ikut ke SEMUA relaksasi — alternatif pun harus listing
  // milik agent yang sama (terminal WhatsApp). Null → tidak difilter (web publik).
  const uid          = filters.userId || null;
  const fp           = (extra) => filterProperties(source, { userId: uid, ...extra });

  // ── KASUS A: buildingType ditetapkan ────────────────────────────────────
  // Strict: HANYA tipe yang diminta + fallback eksplisit dari customer.
  if (bt) {
    // A1: Type + transaction + location (tanpa budget — relaksasi harga saja)
    add(fp({ buildingType: bt, transactionType: tt, location: loc }));

    // A1b: Type + location (relaksasi transaksi TAPI tetap di kota yang diminta).
    // Prioritas: pertahankan KOTA customer dulu sebelum melebar ke kota lain.
    // Contoh: "sewa hotel di Madiun" tak ada → tawarkan hotel di Madiun (jual/booking),
    // BUKAN langsung hotel di kota lain.
    if (result.length < 4 && loc) {
      add(fp({ buildingType: bt, location: loc }));
    }

    // ⚠️ RELAKSASI LOKASI = BENAR-BENAR LANGKAH TERAKHIR.
    // Dulu syaratnya `result.length < 4`, sehingga ketika kota customer hanya punya
    // 1–3 listing, sistem menambahkan listing dari KOTA LAIN ke daftar yang sama —
    // customer minta hotel di Surabaya, ikut muncul hotel di Jambi (M64).
    // Aturan doc 03 tegas: "Always keep type + location intact". Jadi kota lain hanya
    // boleh dipakai bila kota yang diminta benar-benar KOSONG (0 hasil), bukan sekadar
    // sedikit. Lebih baik menampilkan 2 pilihan yang RELEVAN daripada 4 yang salah kota.
    // A1c: masih di KOTA yang sama, longgarkan tipe transaksi & sisanya.
    // Semua relaksasi di bawah TETAP mengunci `location: loc`.
    if (result.length < 4 && loc) {
      add(fp({ location: loc, transactionType: tt }));
    }

    // A2 & A3: relaksasi LOKASI — HANYA bila customer TIDAK menyebut kota.
    // ⛔ Bila customer menyebut kota, kota lain TIDAK PERNAH ditawarkan.
    // Dulu blok ini berjalan setiap kali hasil < 4 (bahkan tanpa syarat kota),
    // sehingga "sewa hotel di Madiun" menghasilkan daftar hotel di KOTA JAMBI,
    // Rokan Hilir, Medan, Banda Aceh — lintas pulau dan sama sekali tidak berguna
    // bagi customer (M64). Katalog JSON fallback berisi 9.120 properti se-Indonesia,
    // jadi tanpa kunci lokasi hasilnya selalu "ada", tapi selalu salah kota.
    // Perilaku benar saat kota diminta tidak punya stok: kembalikan KOSONG, biar AI
    // menjawab jujur memakai template "No Match Response" (doc 03) — bukan mengarang
    // relevansi dengan menawarkan kota acak.
    if (!loc) {
      if (result.length < 4) add(fp({ buildingType: bt, transactionType: tt }));
      if (result.length < 4) add(fp({ buildingType: bt }));
    }

    // A4: Fallback types eksplisit dari customer ("kalau tidak ada rumah, apartemen juga boleh")
    if (result.length < 4 && fallbackTypes.length > 0) {
      for (const fbt of fallbackTypes) {
        // Tipe fallback pun WAJIB di kota yang sama.
        add(fp({ buildingType: fbt, transactionType: tt, location: loc }));
        if (result.length >= 8) break;
        // Lintas kota hanya bila customer memang tidak menyebut kota.
        if (!loc) {
          add(fp({ buildingType: fbt, transactionType: tt }));
          if (result.length >= 8) break;
        }
      }
    }

    // Return HANYA tipe yang sesuai (tidak campuran dengan tipe lain)
    return result.slice(0, 8);
  }

  // ── KASUS B: tidak ada buildingType — lebih fleksibel ───────────────────
  if (tt || loc) {
    add(fp({ transactionType: tt, location: loc }));
    add(fp({ transactionType: tt }));
  }
  if (loc) {
    add(fp({ location: loc }));
  }

  // Fallback types eksplisit (meski tanpa primary buildingType)
  if (fallbackTypes.length > 0) {
    for (const fbt of fallbackTypes) {
      add(fp({ buildingType: fbt, transactionType: tt, location: loc }));
      add(fp({ buildingType: fbt, transactionType: tt }));
    }
  }

  // Last resort: contoh acak — tetap hormati scoping agent bila ada.
  if (!result.length) {
    add((uid ? fp({}) : source).slice(0, 8));
  }
  return result.slice(0, 8);
}

function humanBuildingType(type = '') {
  const map = {
    hotel: 'hotel',
    villa: 'villa',
    house: 'rumah',
    apartment: 'apartemen',
    boarding_house: 'kos-kosan',
    shophouse: 'ruko',
    store: 'toko',
    mansion: 'mansion',
    kondotel: 'kondotel',
    office: 'kantor',
    warehouse: 'gudang',
    others: 'properti lainnya'
  };
  return map[type] || type || 'properti';
}

function humanTransactionType(type = '') {
  const map = {
    rent: 'sewa',
    sale: 'jual',
    purchase: 'beli'
  };
  return map[type] || type || 'tersedia';
}

function formatPropertyItem(item, index) {
  return {
    no: index + 1,
    title: item.title,
    location: `${item.location || item.city || '-'}${item.district ? `, ${item.district}` : ''}`,
    price: item.price || '-',
    buildingType: item.buildingType || '-',
    transactionType: item.transactionType || '-',
    buildingArea: item.buildingArea || '-',
    landArea: item.landArea || '-',
    address: item.address || '-',
    bedrooms: item.bedrooms || '-',
    bathrooms: item.bathrooms || '-',
    furnishedStatus: item.furnishedStatus || '-',
    facilities: item.facilities || '-',
    nearbyLocations: item.nearbyLocations || '',
    description: item.description || '-'
  };
}

function formatPropertyRecommendation(properties = [], options = {}) {
  if (!properties.length) return 'No matching property options are available.';
  const limit = options.limit || 6;
  return properties.slice(0, limit).map((item, index) => {
    const formatted = formatPropertyItem(item, index);
    const nearbyLine = formatted.nearbyLocations ? `\n   Nearby Landmarks: ${formatted.nearbyLocations}` : '';
    return `${formatted.no}. ${formatted.title}\n   Location: ${formatted.location}\n   Price: ${formatted.price}\n   Type: ${humanBuildingType(formatted.buildingType)} - ${humanTransactionType(formatted.transactionType)}\n   Area: building ${formatted.buildingArea}, land ${formatted.landArea}\n   Address: ${formatted.address}\n   Facilities: ${formatted.facilities}${nearbyLine}`;
  }).join('\n\n');
}

function summarizeFilters(filters = {}) {
  return {
    requestedTransactionType: filters.transactionType || 'not specified',
    requestedBuildingType: filters.buildingType || 'not specified',
    requestedLocation: filters.location || 'not specified',
    requestedBudget: filters.budget ? {
      text: filters.budget.text,
      min: filters.budget.min,
      max: filters.budget.max,
      period: filters.budget.period || 'not specified'
    } : 'not specified',
    requestedFacilities: filters.facilities || []
  };
}

async function buildRecommendationContextForLLM(message = '', history = [], opts = {}) {
  // opts.userId → scoping katalog per-agent (terminal WhatsApp). Null/absent =
  // katalog global (chatbot web publik). Diselipkan ke filters agar ikut ke
  // searchProperties → filterProperties dan semua jalur relaksasi/alternatif.
  const filters   = { ...extractPropertyFilters(message, history), userId: opts.userId || null };
  const priceSort = detectPriceSort(message);  // 'asc' | 'desc' | ''

  let exactMatches    = await searchProperties(filters);
  let budgetExpanded  = null;  // null = tidak ada ekspansi harga

  // ── Budget expansion: jika exact matches kosong karena budget terlalu ketat ─
  // Tetap jaga buildingType + location. Hanya budget yang dilonggarkan.
  if (!exactMatches.length && filters.budget) {
    const source = await getSourceProperties();

    // Cek apakah ada properti tipe+lokasi yang sama (tanpa constraint harga)
    const typeLocMatch = filterProperties(source, {
      userId         : filters.userId || null,
      buildingType   : filters.buildingType,
      transactionType: filters.transactionType,
      location       : filters.location,
    });

    if (typeLocMatch.length > 0) {
      // Ada properti yang cocok tipe+lokasi — coba ekspansi harga
      const expanded = findWithExpandedBudget(source, filters);
      if (expanded.results.length > 0) {
        exactMatches   = expanded.results;
        budgetExpanded = expanded.expandedBudget;
        console.log(`[PropertyRecommendation] Budget expanded (step ${expanded.expansionStep}):`, expanded.expandedBudget);
      }
    }
  }

  let alternatives = exactMatches.length ? [] : await getAlternatives(filters);

  // ── Guard "harga wajar" pada alternatif ────────────────────────────────────
  // getAlternatives() melonggarkan tipe/lokasi TANPA batas harga. Bila customer
  // menyebut budget, jangan tampilkan alternatif dengan harga di luar batas wajar
  // (min ×0.20 … max ×2.5) — mis. hotel 60 M untuk anggaran 800 rb/malam.
  if (alternatives.length && filters.budget && (filters.budget.min || filters.budget.max)) {
    const reasonableBudget = {
      ...filters.budget,
      min: filters.budget.min ? Math.round(filters.budget.min * REASONABLE_MIN_FACTOR) : null,
      max: filters.budget.max ? Math.round(filters.budget.max * REASONABLE_MAX_FACTOR) : null,
    };
    const capped = alternatives.filter(p => budgetMatches(p, reasonableBudget));
    console.log(`[PropertyRecommendation] Reasonable-price cap on alternatives: ${alternatives.length} → ${capped.length}`);
    alternatives = capped;
  }

  // Safety correction:
  // Sometimes a previous conversation can make the strict filter too narrow.
  // If strict exactMatches is empty, but alternatives still match the visible
  // customer request (for example buildingType=house and location=Sidoarjo),
  // promote those alternatives into exactMatches so the AI does not say
  // "no exact match" while listing matching properties.
  if (!exactMatches.length && alternatives.length) {
    const visibleMatches = getVisibleMatchesFromAlternatives(alternatives, filters);
    if (visibleMatches.length) {
      exactMatches = visibleMatches;
      alternatives = alternatives.filter((item) => !visibleMatches.some((match) => (match.id || match.title) === (item.id || item.title)));
      console.warn('[PROPERTY MATCH CORRECTION]', {
        reason: 'Promoted visible matching alternatives into exactMatches.',
        visibleMatches: visibleMatches.length,
        filters
      });
    }
  }

  // ── Ordering ──────────────────────────────────────────────────────────────
  // Customer minta termurah/termahal → hormati arah itu (lalu tie-break title).
  // Selain itu → urutan katalog DEFAULT: harga termurah dulu, lalu judul
  // (ORDER BY price, title) — sesuai spesifikasi query katalog RESPOND_CATALOG_RUN=ON.
  if (priceSort) {
    exactMatches = sortByPrice(exactMatches, priceSort);
    alternatives = sortByPrice(alternatives, priceSort);
  } else {
    exactMatches = sortByPriceThenTitle(exactMatches);
    alternatives = sortByPriceThenTitle(alternatives);
  }

  const priceSortNote = priceSort === 'asc'
    ? '(Sorted by price: cheapest first — customer requested affordable/cheap options)'
    : priceSort === 'desc'
      ? '(Sorted by price: most expensive first — customer requested luxury/premium options)'
      : '';

  const budgetExpandNote = budgetExpanded
    ? `(NOTE: No properties found at original budget. Budget range was expanded to find the closest matches. Inform customer that exact budget is unavailable but present these as the nearest alternatives.)`
    : '';

  // ── FALLBACK "fasilitas standar per tipe" ──────────────────────────────────
  // Bila katalog (agent) TIDAK menemukan data — exact match kosong DAN alternatif
  // (setelah cap harga wajar) kosong — jangan biarkan respons hampa. Sediakan:
  //   (a) fasilitas standar sesuai tipe properti (hotel/villa/kos/house/…), dan
  //   (b) rentang harga WAJAR (budget diperluas dalam batas) sebagai acuan,
  // supaya AI/Private Agent bisa menawarkan penyesuaian kriteria, bukan sekadar
  // "tidak ada". Hanya dibangun saat memang nihil hasil.
  let standardFallback = null;
  if (!exactMatches.length && !alternatives.length && filters.buildingType) {
    const stdFacilities = getStandardFacilitiesByType(filters.buildingType, filters.furnishing || '');
    let reasonableRange = null;
    if (filters.budget && (filters.budget.min || filters.budget.max)) {
      reasonableRange = {
        min: filters.budget.min ? Math.round(filters.budget.min * REASONABLE_MIN_FACTOR) : null,
        max: filters.budget.max ? Math.round(filters.budget.max * REASONABLE_MAX_FACTOR) : null,
        period: filters.budget.period || '',
      };
    }
    if (stdFacilities || reasonableRange) {
      standardFallback = { buildingType: filters.buildingType, standardFacilities: stdFacilities, reasonableRange };
    }
  }

  const fmtRp = (n) => (n ? 'Rp ' + Number(n).toLocaleString('id-ID') : '');
  const stdFallbackNote = standardFallback
    ? [
        'NO CATALOG MATCH — STANDARD-FACILITIES FALLBACK (rumusan saat data katalog tidak ditemukan):',
        `- Tidak ada listing yang cocok untuk permintaan ini di katalog (dalam batas harga wajar).`,
        standardFallback.standardFacilities
          ? `- Fasilitas standar untuk tipe "${humanBuildingType(standardFallback.buildingType)}": ${standardFallback.standardFacilities}.`
          : '',
        standardFallback.reasonableRange && (standardFallback.reasonableRange.min || standardFallback.reasonableRange.max)
          ? `- Rentang harga WAJAR sebagai acuan (jangan tawarkan di luar ini): ${fmtRp(standardFallback.reasonableRange.min)} – ${fmtRp(standardFallback.reasonableRange.max)}${standardFallback.reasonableRange.period ? '/' + standardFallback.reasonableRange.period : ''}.`
          : '',
        `- Sampaikan dengan jujur bahwa belum ada unit yang pas, sebutkan fasilitas standar tipe ini sebagai gambaran, lalu tawarkan penyesuaian (naikkan budget dalam batas wajar, ganti lokasi/area terdekat, atau longgarkan fasilitas). JANGAN mengarang listing.`,
      ].filter(Boolean).join('\n')
    : '';

  // ── DYNAMIC STRICT RESPONSE RULES ─────────────────────────────────────────
  // Aturan TIDAK boleh hardcode kota/tipe contoh (mis. Surabaya→Malang, house→hotel).
  // Dibangun dari permintaan NYATA customer (tipe + transaksi + lokasi) supaya AI
  // fokus & relevan: "sewa hotel di Madiun" → saran hotel sewa di Madiun, BUKAN Bali.
  const rules = buildDynamicResponseRules(filters, { hasExactMatches: exactMatches.length > 0 });

  return {
    filters,
    exactMatches,
    alternatives,
    priceSort,
    budgetExpanded,
    standardFallback,
    contextText: [
      'PROPERTY SEARCH RESULT FROM BACKEND CATALOG',
      `Detected customer request: ${JSON.stringify(summarizeFilters(filters), null, 2)}`,
      priceSortNote,
      budgetExpandNote,
      '',
      exactMatches.length
        ? `Exact matching properties (${exactMatches.length}). The assistant must present these as available matching options and must NOT say there is no exact match:`
        : 'No exact match was found for the requested filters. The assistant must clearly say that no exact match is available before offering alternatives.',
      exactMatches.length ? formatPropertyRecommendation(exactMatches, { limit: 8 }) : '',
      '',
      alternatives.length ? `Alternative properties from backend catalog (${alternatives.length}):` : '',
      alternatives.length ? formatPropertyRecommendation(alternatives, { limit: 8 }) : '',
      stdFallbackNote ? '\n' + stdFallbackNote : '',
      '',
      ...rules,
    ].filter(Boolean).join('\n')
  };
}

/**
 * Bangun STRICT RESPONSE RULES yang DINAMIS dari permintaan customer.
 * Tidak ada kota/tipe hardcode — semua mengacu ke filters aktual sehingga saran
 * yang dihasilkan AI fokus pada tipe + transaksi + kota yang benar-benar diminta.
 *
 * Contoh output untuk "sewa hotel di Madiun":
 *   - Customer meminta: sewa hotel di Madiun. Semua rekomendasi WAJIB fokus ke ini.
 *   - Hanya rekomendasikan tipe "hotel" ...
 *   - Hanya rekomendasikan properti di "Madiun" ...
 *
 * @param {object} filters
 * @param {{hasExactMatches:boolean}} opts
 * @returns {string[]}
 */
function buildDynamicResponseRules(filters = {}, opts = {}) {
  const typeLabel = filters.buildingType    ? humanBuildingType(filters.buildingType)      : '';
  const txLabel   = filters.transactionType ? humanTransactionType(filters.transactionType) : '';
  const locLabel  = (filters.location || '').trim();

  const requestLabel = [txLabel, typeLabel, locLabel ? `di ${locLabel}` : '']
    .filter(Boolean).join(' ').trim() || 'properti yang diminta customer';

  const rules = [
    'STRICT RESPONSE RULES (dynamic — fokus pada permintaan customer ini, JANGAN pakai contoh kota/tipe lain):',
    `- Customer meminta: ${requestLabel}. SEMUA rekomendasi WAJIB fokus pada permintaan ini.`,
  ];

  if (typeLabel) {
    rules.push(
      `- Hanya rekomendasikan properti bertipe "${typeLabel}". JANGAN tawarkan tipe lain ` +
      `kecuali BENAR-BENAR tidak ada "${typeLabel}" di katalog, dan Anda jelaskan alasannya secara eksplisit.`
    );
  }
  if (locLabel) {
    rules.push(
      `- Hanya rekomendasikan properti di kota/area "${locLabel}". JANGAN tawarkan properti di kota lain ` +
      `kecuali tidak ada satu pun di "${locLabel}"; jika terpaksa, sebutkan JELAS bahwa itu di luar "${locLabel}".`
    );
  }
  if (txLabel) {
    rules.push(
      `- Hanya untuk transaksi "${txLabel}". JANGAN campur dengan transaksi lain (mis. jual vs sewa/booking).`
    );
  }

  rules.push(
    '- Jawaban HANYA boleh memakai properti yang tercantum di "Exact matching properties" atau "Alternative properties" di atas. DILARANG mengarang listing.',
    opts.hasExactMatches
      ? '- Karena ada Exact matching properties: JANGAN katakan "tidak ada"/"no exact match". Tampilkan exact matches lebih dulu, jangan tampilkan alternatif tak relevan.'
      : `- Tidak ada exact match: minta maaf singkat, nyatakan dengan jelas bahwa "${requestLabel}" belum tersedia, lalu tawarkan alternatif TERDEKAT yang mempertahankan tipe & kota yang sama bila memungkinkan.`,
    '- Pesan customer TERBARU lebih diprioritaskan daripada riwayat lama.',
    '- Jika customer memberi rentang budget: hormati budget saat ada exact match; jika alternatif di luar budget, katakan dengan jujur.',
    '- Setelah menampilkan opsi, ajukan tepat SATU pertanyaan lanjutan yang singkat.'
  );

  return rules;
}

module.exports = {
  getFallbackProperties,
  loadJsonProperties,
  mergePropertyCatalog,
  searchProperties,
  formatPropertyRecommendation,
  extractPropertyFilters,
  isRecommendationRequest,
  buildRecommendationContextForLLM,
  detectBuildingType,
  detectLocation,
  detectTransactionType,
  detectPriceSort,
  sortByPrice,
  getBudgetTiers,
  resolveBudgetTierRange,
  detectFallbackTypes,
  findWithExpandedBudget,
  detectBudget,
  detectFacilities,
  initFacilityCache,
  getFacilityFallbackMap: () => _FACILITY_MAP,  // dipakai scripts/seed-facility-keywords.js
  initCityCache,
  getKnownLocations,
  isKnownLocationName,
  initLandmarkCache,
  getKnownLandmarks,
  detectLandmark,
  getPropertyIdsForLandmark,
  stripCommercialUsePhrases,
  // Exported so the Phase-0 type detectors in chatbotPrivateController.js and
  // aiPromptBuilderService.js can apply the SAME strip chain used by
  // detectBuildingType() below — otherwise a Q6 anchor answer such as
  // "deket kantor" is read as a type switch and resets the whole search.
  stripNearPhrases,
  stripAmbiguousRumah,
  stripInvestmentIntentPhrases,
  stripMovingFromPhrases,
  detectCommercialUse,
  detectUseCase,
  isNonResidentialUse,
  useCaseLabel,
  parsePropertyPrice,
  budgetMatches,
  propertyMatchesCoreVisibleRequest,
  getVisibleMatchesFromAlternatives,
  clearDbPropertiesCache
};

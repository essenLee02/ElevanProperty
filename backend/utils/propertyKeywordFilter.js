/**
 * propertyKeywordFilter.js
 *
 * Deteksi apakah pesan WhatsApp adalah pertanyaan/permintaan terkait PROPERTI.
 *
 * LOGIKA DETEKSI (dua kondisi, bukan satu frasa):
 *
 *   TRIGGER jika salah satu dari:
 *   A) Mengandung kata TIPE PROPERTI + kata AKSI/PERTANYAAN
 *      Contoh: "sewa rumah", "cari apartemen", "ada villa kosong?"
 *   B) Mengandung KATA KUNCI PROPERTI KHUSUS yang tidak ambigu
 *      Contoh: "KPR", "kavling", "perumahan", "over kredit"
 *
 *   TIDAK TRIGGER jika:
 *   - Hanya ada kata aksi tanpa tipe properti
 *     "mau cari bebek goreng" → ada "cari" tapi tidak ada properti → ❌
 *   - Hanya ada kata "sewa/cari/beli" untuk non-properti
 *     "sewa mobil", "cari wisata", "beli nasi" → ❌
 *   - "rumah" dalam konteks bukan properti
 *     "rumah makan", "rumah sakit" → dikecualikan ❌
 *
 * Digunakan oleh: fonnteChatController, kirimiChatController, timelinesAIChatController
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════════
   1. TIPE PROPERTI — Kata yang menunjuk ke jenis properti
      Hanya kata-kata ini yang VALID sebagai "property type" untuk deteksi.
══════════════════════════════════════════════════════════════════════════════ */

const PROPERTY_TYPES = [
  // ── Bahasa Indonesia ──────────────────────────────────────────────────────
  // Hunian — apartemen & semua variasi ejaan umum
  'apartemen', 'apartmen',
  'villa', 'vila',
  // ⚠️ BENTUK BERIMBUHAN WAJIB DIDAFTARKAN SENDIRI (M120). Pencocokan memakai
  // word-boundary, jadi 'kos' TIDAK cocok di dalam "ngekos" — customer nyata
  // menulis "Hi.. Saya mau ngekos di Madiun" dan pesannya DITOLAK gerbang
  // ("bukan query properti"), tidak disimpan, tidak dibalas. Padahal "ngekos"
  // adalah cara paling lazim orang Indonesia menyebut sewa kamar kos.
  // 'ngekost' sudah ada sejak awal; 'ngekos' (tanpa t) justru yang terlewat.
  'kost', 'kos', 'kosan', 'kostan', 'ngekos', 'ngekosan',
  'indekos', 'indekost', 'boarding house', 'boarding',
  'kontrakan', 'kontrakkan', 'bedeng',
  // Komersial
  'ruko', 'rukan', 'shophouse', 'shop house',
  'kantor', 'perkantoran',
  'gudang', 'pergudangan',
  'toko', 'pertokoan',
  'penginapan', 'resort',
  'klinik', 'kios',
  // Kondotel/kondominium: tipe hunian yang dipakai cabang `isBooking` di
  // findNextQuestion (hotel|kondotel) dan punya slot Q12 tower/lantai sendiri,
  // tapi sempat TIDAK ada di daftar tipe gate — "Saya booking kondotel di Batu"
  // ikut dibuang bersama bug booking (7 Agu 2026).
  'kondotel', 'condotel', 'kondominium', 'condominium', 'kondo',
  // Tanah / kavling
  'kavling', 'kapling', 'tanah kavling',
  'lahan', 'tanah',
  // Istilah properti umum
  'properti', 'perumahan',
  'cluster', 'residensial',
  'townhouse', 'town house',
  'hunian', 'tempat tinggal',

  // ── English (bilingual support) ───────────────────────────────────────────
  // Residential
  'house', 'home', 'apartment', 'apt',
  'room', 'bedroom',
  // Commercial
  'office', 'warehouse', 'store',
  'hotel', 'motel',
  // Land / property
  'property', 'residential', 'land', 'lot',
  // Lifestyle
  'studio', 'loft', 'penthouse',
  // "rumah" ditangani secara khusus (lihat fungsi hasPropertyType)
];

// "rumah" bisa ambigu: "rumah makan", "rumah sakit", "rumah tangga"
// Jika "rumah" diikuti kata-kata ini, BUKAN properti
const RUMAH_EXCLUSIONS = [
  'rumah makan', 'rumah sakit', 'rumah tangga', 'rumah ibadah',
  'rumah tahanan', 'rumah duka', 'rumah produksi',
  'warung', // "mau cari warung"
];

/* ══════════════════════════════════════════════════════════════════════════════
   2. KATA AKSI / PERTANYAAN — Hanya valid BERSAMA kata tipe properti
      Tanpa property type, kata-kata ini TIDAK cukup untuk trigger.
══════════════════════════════════════════════════════════════════════════════ */

const ACTION_WORDS = [
  // ── Bahasa Indonesia ──────────────────────────────────────────────────────
  // Transaksi
  'sewa', 'sewain', 'rental', 'ngontrak', 'kontrak',
  'beli', 'purchase',
  'jual', 'dijual', 'disewakan', 'dikontrakkan',
  'cari', 'nyari', 'mencari',
  // ── BOOKING — transaksi KETIGA, sempat hilang dari daftar ini ──────────────
  // Bug produksi 7 Agu 2026: "Saya booking hotel di Surabaya" DIBUANG gate
  // ("bukan query properti") padahal ada tipe properti (hotel) DAN kota.
  // Sebabnya: Q1 mengenal TIGA transaksi — sewa / beli / **booking** — dan
  // seluruh alur punya cabang `isBooking` (hotel/kondotel/villa), tapi kata
  // "booking" tidak pernah masuk ACTION_WORDS. Jadi gate hanya meloloskan
  // kalimat booking yang KEBETULAN memuat kata aksi lain ("Saya *mau* booking
  // hotel" lolos, "Saya booking hotel" tidak) — perbedaan yang tidak masuk akal
  // bagi customer. Seluruh alur booking praktis tidak bisa dimulai secara alami.
  // Aman: tetap WAJIB bersama tipe properti, jadi "booking tiket pesawat" /
  // "booking meja restoran" tidak punya tipe properti → tetap TIDAK memicu.
  'booking', 'bookingan', 'membooking', 'reservasi', 'reservation',
  'menginap', 'nginap', 'nginep', 'inap',
  'check in', 'check-in', 'checkin',
  // Ketersediaan
  'ada', 'tersedia', 'kosong', 'ready',
  'masih ada', 'masih kosong', 'masih available',
  // Harga / transaksi
  'harga', 'berapa', 'cicilan', 'dp',
  'uang muka', 'biaya',
  // Harga relatif
  'murah', 'termurah', 'terjangkau', 'ekonomis', 'hemat',
  'mahal', 'premium', 'mewah',
  // Pertanyaan umum
  'mau', 'ingin', 'pengen', 'butuh', 'perlu',
  'tanya', 'nanya',
  'rekomendasi', 'rekomen',
  'listing', 'unit', 'stok', 'stock',
  // Perubahan / koreksi pencarian — "ganti villa", "ubah ke rumah", "ralat apartemen"
  // Hanya valid BERSAMA tipe properti (tidak bisa standalone)
  'ganti', 'ubah', 'ralat', 'cancel', 'batal', 'edit',
  // ── TUJUAN / USE-CASE ─────────────────────────────────────────────────────
  // Bug produksi 7 Agu 2026: "Rumahnya untuk investasi" DIBUANG gate ("bukan
  // query properti") padahal jelas soal properti. Sebabnya: ada tipe properti
  // ("rumah") tapi TIDAK ada kata aksi — customer menyebut TUJUAN, bukan aksi.
  // Pesan itu adalah jawaban Q4 (rumah tidak ditinggali), dan saat sesi sudah
  // kedaluwarsa (TTL 90 menit — customer membalas 9 jam kemudian) history
  // kosong, sehingga isPropertyContextContinuation() juga ikut gagal dan pesan
  // hilang tanpa jejak: tidak disimpan, tidak dibalas.
  // Aman: tetap WAJIB bersama tipe properti — "investasi saham" tidak punya
  // tipe properti sehingga tetap TIDAK memicu.
  'investasi', 'invest', 'investment',
  'ditinggali', 'ditempati', 'dihuni', 'huni', 'hunian',
  'disewakan lagi', 'dikost', 'dikoskan', 'kos-kosan',
  'untuk usaha', 'buat usaha', 'untuk kantor', 'buat kantor',

  // ── English (bilingual support) ───────────────────────────────────────────
  // Transactions
  'buy', 'sell', 'rent', 'lease', 'book',
  // Search intent
  'get', 'find', 'search', 'look for', 'looking for', 'looking',
  'want', 'need', 'require',
  // Price / availability
  'available', 'price', 'cost', 'how much',
  'cheap', 'cheaper', 'cheapest', 'affordable', 'budget',
  'expensive', 'luxury',
  // Query words
  'recommend', 'suggestion', 'suggest', 'show',
  'list', 'info', 'information', 'details',
];

// Kata aksi PENDEK/ambigu yang sering muncul sebagai SUBSTRING di dalam kata lain.
// Wajib word-boundary agar tidak salah-match. Contoh bug nyata:
//   "list"  ⊂ "listrik"   → "rumahku mati listrik" PALSU terdeteksi sbg query properti
//   "get"   ⊂ "budget"/"target"   ·  "rent" ⊂ "parent"/"current"  ·  "ada" ⊂ "kepada"/"pada"
//   "ready" ⊂ "already"   ·  "cost" ⊂ "costume"   ·  "lease" ⊂ "please"   ·  "show" ⊂ "shower"
const ACTION_WORDS_STRICT_BOUNDARY = new Set([
  // English short words yang bisa nyangkut di kata Indonesia/Inggris lain
  'get', 'rent', 'cost', 'show', 'info', 'edit', 'sell', 'buy', 'want', 'need',
  'lease', 'ready', 'price', 'unit', 'list', 'find', 'search', 'rental', 'available',
  // 'book' ⊂ "facebook"/"bookmark"/"notebook"; 'inap' ⊂ "menginapkan" (aman) tapi
  // juga ⊂ "sinapsis" — keduanya wajib word-boundary.
  'book', 'inap',
  // Indonesian
  'ada', 'dp',
]);

function matchesActionWord(lower, action) {
  if (ACTION_WORDS_STRICT_BOUNDARY.has(action)) {
    return new RegExp(`\\b${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower);
  }
  return lower.includes(action);
}

/* ══════════════════════════════════════════════════════════════════════════════
   3. KATA KUNCI MANDIRI — Tidak ambigu, selalu properti, tidak perlu kondisi lain
══════════════════════════════════════════════════════════════════════════════ */

const STANDALONE_KEYWORDS = [
  // Pembiayaan properti
  'kpr', 'kredit pemilikan',
  'over kredit', 'overkred',
  'uang muka rumah', 'dp rumah', 'cicilan rumah',
  'inden', 'inden rumah', 'pre-launch',
  // Istilah properti spesifik
  'kavling', 'kapling',
  'perumahan',
  'real estate',
  'siap huni',
  'ready unit', 'ready stok', 'ready stock',
  'unit ready', 'unit available', 'unit kosong',
  'ada unit', 'ada listing',
  'sertifikat hak milik', 'shm', 'hgb', 'imb', 'pbg',
  // Developer / agen
  'agen properti', 'developer properti', 'developer',
  'properti dijual', 'properti disewakan', 'properti available',
  'listing properti', 'listing property',
  // Pertanyaan spesifik properti
  'berapa kamar', 'berapa lantai', 'luas bangunan', 'luas tanah',
  'fasilitas perumahan', 'akses tol', 'dekat sekolah', 'dekat mall',
  // Site visit / jadwal kunjungan — selalu konteks properti
  'jadwal viewing', 'jadwal survey', 'jadwal survei', 'jadwal kunjungan',
  'bisa viewing', 'bisa survey', 'bisa survei',
  'kapan viewing', 'kapan survey', 'kapan survei',
  'mau viewing', 'mau survey', 'mau survei',
  'site visit', 'open house',
];

/* ══════════════════════════════════════════════════════════════════════════════
   4. FUNGSI DETEKSI
══════════════════════════════════════════════════════════════════════════════ */

// Kata pendek/ambigu yang perlu word-boundary agar tidak match substring.
// Contoh: "apt" bisa ada di "laptop", "lot" di "pilot", "room" di "classroom".
const PROPERTY_TYPES_STRICT_BOUNDARY = new Set([
  // Bahasa Indonesia
  'apt', 'toko', 'kos', 'loft', 'studio', 'vila', 'unit',
  'villa', 'hotel', 'motel', 'kios',
  // English — semua kata pendek wajib word-boundary
  'house', 'home', 'room', 'lot', 'land', 'store',
  // Prevent false match inside file paths / technical text
  // e.g. "Elevan_Property\skills\" → 'elevan_property' contains 'property' as substring,
  // but '_' is \w so \bproperty\b does NOT match "elevan_property". ✅
  'property', 'properti',
]);

/**
 * Cek apakah kata properti cocok dalam teks.
 * - Kata pendek/ambigu → pakai word boundary regex
 * - Kata panjang/spesifik → pakai includes() biasa (cukup aman)
 */
function matchesPropertyType(lower, type) {
  if (PROPERTY_TYPES_STRICT_BOUNDARY.has(type)) {
    return new RegExp(`\\b${type}\\b`).test(lower);
  }
  return lower.includes(type);
}

/**
 * Cek apakah teks mengandung tipe properti yang valid.
 * Menangani kasus "rumah" yang ambigu.
 *
 * @param {string} lower - Pesan lowercase
 * @returns {boolean}
 */
function hasPropertyType(lower) {
  // Cek "rumah" dengan pengecualian
  if (lower.includes('rumah')) {
    const isExcluded = RUMAH_EXCLUSIONS.some(exc => lower.includes(exc));
    if (!isExcluded) return true;
  }

  // Cek semua tipe properti lainnya (dengan word boundary untuk kata pendek)
  return PROPERTY_TYPES.some(type => matchesPropertyType(lower, type));
}

/**
 * Cek apakah teks mengandung kata aksi/pertanyaan.
 *
 * @param {string} lower - Pesan lowercase
 * @returns {boolean}
 */
function hasActionWord(lower) {
  return ACTION_WORDS.some(action => matchesActionWord(lower, action));
}

/**
 * Cek apakah teks mengandung kata kunci mandiri yang pasti properti.
 *
 * @param {string} lower - Pesan lowercase
 * @returns {boolean}
 */
function hasStandaloneKeyword(lower) {
  return STANDALONE_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Deteksi apakah pesan terkait properti.
 *
 * Logika:
 *   (Tipe Properti + Kata Aksi) ATAU Kata Kunci Mandiri
 *
 * Contoh TRIGGER (✅):
 *   "sewa rumah di surabaya"     → ada "sewa" + "rumah" ✅
 *   "cari apartemen murah"       → ada "cari" + "apartemen" ✅
 *   "harga villa bali berapa"    → ada "harga"/"berapa" + "villa" ✅
 *   "ada kost dekat kampus?"     → ada "ada" + "kost" ✅
 *   "KPR berapa persen?"         → standalone "kpr" ✅
 *   "mau tanya soal perumahan"   → ada "tanya"/"mau" + "perumahan" ✅
 *
 * Contoh TIDAK TRIGGER (❌):
 *   "km mau cari bebek goreng"   → ada "mau"/"cari" tapi TIDAK ada property type ❌
 *   "sewa mobil dong"            → ada "sewa" tapi TIDAK ada property type ❌
 *   "cari kunci motor hilang"    → ada "cari" tapi TIDAK ada property type ❌
 *   "mau tanya dimana makan"     → ada "tanya"/"mau" tapi TIDAK ada property type ❌
 *   "rumah makan enak dimana"    → ada "rumah" tapi dikecualikan (rumah makan) ❌
 *   "cari wisata bali"           → ada "cari" tapi TIDAK ada property type ❌
 *
 * @param {string} message - Isi pesan WhatsApp
 * @returns {boolean}
 */
function hasPropertyKeyword(message) {
  if (!message || typeof message !== 'string') return false;

  const lower = message.toLowerCase().trim();
  if (!lower || lower.length < 3) return false;

  // Kondisi A: Kata kunci mandiri (tidak perlu kondisi lain)
  if (hasStandaloneKeyword(lower)) return true;

  // Kondisi B: Tipe properti + kata aksi/pertanyaan
  return hasPropertyType(lower) && hasActionWord(lower);
}

/* ══════════════════════════════════════════════════════════════════════════════
   5. EKSTRAKSI LOKASI, TIPE, TRANSAKSI
══════════════════════════════════════════════════════════════════════════════ */

// Static fallback — used before initLocationCache() loads DB data on startup.
// Sorted longest-first so multi-word names ("jakarta selatan") match before
// their sub-strings ("jakarta") in linear scans.
const _LOCATION_FALLBACK = [
  // Jabodetabek
  'jakarta selatan', 'jakarta utara', 'jakarta barat', 'jakarta timur', 'jakarta pusat',
  'jakarta', 'tangerang selatan', 'bogor', 'depok', 'tangerang', 'bekasi',
  'cibubur', 'karawang', 'purwakarta', 'sukabumi', 'cirebon', 'serang', 'cilegon',
  // BSD & Alam Sutera area
  'alam sutera', 'tangerang selatan', 'lebak bulus', 'pondok indah', 'kelapa gading',
  'serpong', 'bintaro', 'kemang', 'menteng', 'bsd',
  // Jawa
  'surabaya', 'bandung', 'semarang', 'yogyakarta', 'malang', 'surakarta',
  'sidoarjo', 'mojokerto', 'madiun', 'kediri', 'solo',
  // Bali & NTB
  'nusa dua', 'denpasar', 'seminyak', 'canggu', 'jimbaran', 'mataram',
  'bali', 'kuta', 'ubud', 'sanur', 'lombok',
  // Sumatra
  'banda aceh', 'bandar lampung', 'pekanbaru', 'palembang', 'padang', 'medan', 'batam',
  'jambi', 'bengkulu',
  // Kalimantan
  'balikpapan', 'samarinda', 'pontianak', 'banjarmasin',
  // Sulawesi
  'makassar', 'manado', 'gorontalo', 'kendari', 'palu',
  // Lainnya
  'jayapura', 'ambon', 'sorong', 'kupang',
];

// Runtime cache — replaced by initLocationCache() after DB connects.
// Mutable let so all consumers (extractLocationFromMessage, etc.) pick up
// the refreshed list without needing to be re-required.
let _locationCache = [..._LOCATION_FALLBACK];

/**
 * Refresh _locationCache from the `cities` table (status=1).
 * Called once at server startup after sequelize.sync().
 * Falls back silently to the static list if the DB query fails.
 */
async function initLocationCache() {
  try {
    const { City } = require('../models');
    const rows = await City.findAll({ where: { status: 1 }, attributes: ['name'] });
    if (rows.length === 0) return; // table empty → keep static fallback

    // Normalize to lowercase, deduplicate, sort longest-first so multi-word
    // names always match before their substrings in linear scans.
    const dbNames = [...new Set(rows.map(r => r.name.toLowerCase().trim()))];
    dbNames.sort((a, b) => b.length - a.length);

    // Merge: DB names first (authoritative), then any fallback entry not already covered.
    const covered = new Set(dbNames);
    const extras = _LOCATION_FALLBACK.filter(f => !covered.has(f));
    _locationCache = [...dbNames, ...extras];

    console.log(`[LocationCache] Loaded ${dbNames.length} cities from DB (${extras.length} fallback extras kept).`);
  } catch (err) {
    console.warn('[LocationCache] initLocationCache() failed — using static fallback:', err.message);
  }
}


/**
 * Ekstrak lokasi dari pesan.
 * @param {string} message
 * @returns {string} nama lokasi atau ''
 */
function extractLocationFromMessage(message) {
  if (!message) return '';
  const lower = message.toLowerCase();

  // Pola "di [kota]"
  const diPattern = /\bdi\s+(?:daerah\s+|kawasan\s+|area\s+|kota\s+|wilayah\s+)?([a-z\s]{3,25})(?:\s+yang|\s+ada|\s+dong|\s+ya|\s+yg|\s+nih|\?|$|,)/i;
  const match = lower.match(diPattern);
  if (match) {
    const candidate = match[1].trim();
    const found = _locationCache.find(loc =>
      candidate.includes(loc) || loc.includes(candidate.substring(0, 8))
    );
    if (found) return found;
  }

  // Cek langsung nama kota dalam pesan
  for (const loc of _locationCache) {
    if (lower.includes(loc)) return loc;
  }

  return '';
}

/**
 * Ekstrak tipe properti dari pesan.
 * @param {string} message
 * @returns {string}
 */
function extractPropertyTypeFromMessage(message) {
  if (!message) return '';
  const lower = message.toLowerCase();

  if (lower.match(/\b(apartemen|apartment|apt)\b/i))          return 'apartment';
  if (lower.match(/\b(villa|vila)\b/i))                        return 'villa';
  if (lower.match(/\b(tanah|kavling|kapling|lahan)\b/i))       return 'land';
  if (lower.match(/\b(ruko|shophouse|kios|toko|store)\b/i))   return 'commercial';
  if (lower.match(/\b(kantor|office)\b/i))                     return 'office';
  if (lower.match(/\b(gudang|warehouse)\b/i))                  return 'warehouse';
  if (lower.match(/\b(hotel|motel|penginapan)\b/i))            return 'hotel';
  // ⚠️ Bentuk berimbuhan ikut dicantumkan (M120). Gerbang masuk sudah menerima
  // "ngekos"/"indekos", tapi kalau TIPE-nya tidak ikut terbaca, pesan lolos
  // gerbang lalu diproses sebagai properti tanpa tipe — AI menanyakan "tipe
  // properti apa?" padahal customer sudah mengatakannya.
  if (lower.match(/\b(kost|kos|kosan|kostan|ngekos|ngekost|ngekosan|indekos|indekost|boarding)\b/i)) return 'boarding_house';
  if (lower.match(/\b(rumah|house|perumahan|residensial)\b/i)) return 'house';

  return '';
}

/**
 * Ekstrak tipe transaksi dari pesan.
 * @param {string} message
 * @returns {'sale'|'rent'|''}
 */
function extractTransactionTypeFromMessage(message) {
  if (!message) return '';
  const lower = message.toLowerCase();

  // ⚠️ BOOKING = SEWA. Master flow Q2 memperlakukan booking (hotel/kondotel/
  // villa, tarif per malam) sebagai cabang sewa — lihat propertyRecommendation
  // Service TRANSACTION_KEYWORDS.rent yang sudah memuat 'booking'/'menginap'.
  // Fungsi ini sempat TIDAK memuatnya, sehingga "Saya booking hotel di Surabaya"
  // menghasilkan transactionType kosong dan katalog dicari tanpa filter
  // transaksi — dua ekstraktor untuk konsep yang sama, berbeda isi (7 Agu 2026).
  // "ngekos"/"indekos" SELALU berarti menyewa kamar — tidak ada bentuk "beli
  // ngekos". Tanpa entri ini transaksi tetap kosong, dan AI menanyakan
  // "sewa atau beli?" untuk hal yang sudah jelas (M120).
  if (lower.match(/\b(sewa|rental|ngontrak|kontrak|disewakan|kost|kos|kosan|kostan|ngekos|ngekost|ngekosan|indekos|indekost|boarding|rent|lease|booking|book|reservasi|menginap|nginap|nginep)\b/i)) return 'rent';
  if (lower.match(/\b(beli|jual|dijual|purchase|buy|sell|kpr|inden|dp|cicilan|over kredit)\b/i)) return 'sale';

  return '';
}

/* ══════════════════════════════════════════════════════════════════════════════
   6. CONTEXT CONTINUATION — Deteksi jawaban singkat sebagai lanjutan properti
══════════════════════════════════════════════════════════════════════════════ */

// Pola pertanyaan properti dari AI (Q1–Q12 + Q_FAC). Jika pesan AI TERAKHIR cocok
// salah satu pola ini, percakapan jelas sedang in-flow → cukup sebagai konteks
// properti walau kata TIPE (apartemen/villa/…) sudah keluar dari window pesan.
// Module-level agar tidak dibuat ulang tiap panggilan + bisa dipakai sebelum gate.
const PROPERTY_QUESTION_PATTERNS = [
  // ── Bahasa Indonesia ──────────────────────────────────────────────────────
  /sewa\s+atau\s+beli/, /beli\s+atau\s+sewa/, /kisaran\s+harga/, /budget/,
  /harga\s+berapa/, /berapa\s+harga/, /di\s+kota\s+(apa|mana)/,
  /lokasi\s+(apa|mana|yang|di)/, /area\s+(mana|apa)/, /wilayah\s+(mana|apa)/,
  // ⚠️ Q2c ditanyakan dengan kalimat "Di area atau kawasan mana di *Kota* yang
  // Anda pertimbangkan?" — dan TIDAK SATU PUN pola di atas mencocokinya
  // ("area mana" tidak pernah bersebelahan; "kawasan" tidak terdaftar sama
  // sekali). Akibatnya pertanyaan Q2c INVISIBLE bagi gate: hasRecentPropertyQ
  // dan isInPropertyFlow sama-sama false, sehingga jawaban customer
  // ("Daerah Gubeng") dibuang sebagai "bukan query properti" (M88, 9 Agu 2026).
  /\barea\b.{0,20}\bmana\b/, /\bkawasan\b.{0,20}\bmana\b/, /\bdaerah\b.{0,20}\bmana\b/,
  /\bkecamatan\b.{0,20}\bmana\b/,
  /tipe\s+properti/, /jenis\s+properti/, /furnished|furnish|furnitur/,
  /kamar\s+(tidur|mandi)/, /berapa\s+kamar/, /luas\s+(berapa|bangunan|tanah)/,
  /\bfasilitas\b/, /ada\s+fasilitas/,
  /kapan\s+(masuk|pindah|rencan)/, /bulan\s+apa/, /ada\s+yang\s+ingin.*tanyakan/,
  /masih\s+(ada|butuh|perlu)/, /selain\s+itu/, /rencananya\s+masuk/,
  /masuk\s+bulan/, /pindah\s+bulan/, /sewa\s+untuk\s+berapa/, /berapa\s+lama/,
  /tinggal\s+bersama/, /bersama\s+(siapa|siapa\s+saja)/, /tinggal\s+dengan/,
  /akan\s+tinggal/, /living\s+with/, /live\s+with/,
  // ── English equivalents ─────────────────────────────────────────────────────
  /rent\s+or\s+buy/, /buy\s+or\s+rent/, /price\s+range/, /budget\s+range/,
  /which\s+(city|area|location)/, /what\s+type\s*(of\s*)?property/,
  /planning\s+to\s+move/, /move[\s-]in/, /what\s+month/, /when.*plan/,
  /how\s+long.*(?:rent|lease|plan)/, /lease\s+duration/, /who\s+will\s+be\s+living/,
  /living\s+with\s+you/, /furnish(?:ing|ed)?\s+prefer/, /prefer.*furnish/,
  /tower\s+or\s+floor/, /floor\s+prefer/, /have\s+you\s+seen/, /how\s+many\s+prop/,
  /any.*(?:specific|prefer)/, /would\s+you\s+like.*(?:more|know|detail)/,
  /what.*looking\s+for/, /are\s+you\s+looking\s+to/, /do\s+you\s+have\s*(a\s*)?budget/,
  // ── Q2b search history ──────────────────────────────────────────────────────
  /sudah\s+lihat\s+berapa/, /apa\s+yang\s+membuat\s+belum\s+cocok/,
  /yang\s+sudah\s+dilihat/, /berapa\s+properti.*sudah/,
  // ── Q5 red flags ────────────────────────────────────────────────────────────
  /pasti\s+tidak\s+cocok/, /ada\s+yang.*tidak\s+cocok/,
  /hadap\s+barat|gang\s+sempit|rumah\s+tua/, /definitely\s+want\s+to\s+avoid/, /anything.*avoid/,
  // ── Q6 anchor point ─────────────────────────────────────────────────────────
  /patokan/, /jadi\s+patokan/, /ada\s+lokasi.*tertentu/, /lokasi.*jadi\s+patokan/,
  /dekat\s+sekolah|dekat\s+kantor|dekat\s+mall/, /specific\s+landmark/,
  /near\s+a\s+(school|office|mall|station)/,
  // ── Q7 alternative areas ────────────────────────────────────────────────────
  /selain\s+\S.{0,30}area\s+sekitar/, /area\s+sekitar\s+(yang|masih)/,
  /area.*lain.*oke/, /area.*lain.*pertimbangkan/, /besides\s+\S.{0,30}(area|city)/,
  /other\s+(area|city|location)/,
  // real phrasing AI: "Selain lokasi Surabaya, apakah Anda mau pilihan lokasi lainnya?"
  /selain\s+lokasi/, /pilihan\s+lokasi/, /lokasi\s+lain(nya)?/, /area\s+lain(nya)?/,
  /wilayah\s+lain(nya)?/, /kota\s+lain(nya)?/, /daerah\s+lain(nya)?/,
  /mau\s+pilihan\s+lain/, /pertimbangkan\s+lokasi\s+lain/, /lokasi\s+alternatif/,
  // ── Q9 decision maker ───────────────────────────────────────────────────────
  /jadwalkan\s+(viewing|survey|survei|kunjungan)/, /perlu\s+koordinasi/, /koordinasi\s+dulu/, /keluarga\s+lain/,
  /schedule\s+(a\s+)?(viewing|survey|visit)/, /check\s+with\s+(family|spouse|partner)/,
  /langsung\s+bisa\s+jadwalkan/, /langsung\s+jadwalkan/,
  // ── Q8: move-in / start-rent date ──────────────────────────────────────────
  // Needed so "Kak, kira-kira tanggalnya?" (rule-25/35 path) counts as a property
  // question → inPropertyFlow reaches ≥2 → customer clarifications ("Ini tanggal apa ya?")
  // are not dropped by isPropertyContextContinuation.
  /kira-kira\s+tanggalnya/, /info\s+tanggalnya/, /mohon.*info.*tanggal/,
  /kapan\s+rencananya\s+masuk/, /tanggal\s+berapa\s+rencananya\s+masuk/,
  /when.*planning\s+to\s+move\s+in/,
  // ── Q12 apartment tower / floor ─────────────────────────────────────────────
  /tower\s+atau\s+lantai/, /preferensi\s+tower/, /lantai\s+(rendah|tinggi|tertentu|berapa)/,
  /tower\s+or\s+floor/, /floor\s+(prefer|choice)/,
  // ── Q kondisi ruang kantor (office fit-out) & kondisi properti ──────────────
  // "Kondisi ruang yang diinginkan: fitted out (siap pakai) atau bare shell?"
  // "prefer yang baru/ready, second kondisi baik, atau inden?"
  /fitted\s*[\s-]?out/, /bare\s*[\s-]?shell/, /kondisi\s+ruang/, /siap\s+pakai/,
  /kondisi\s+(baik|baru)/, /baru\/ready/, /second\s+kondisi/, /atau\s+inden/,
  // ── Q jam viewing ────────────────────────────────────────────────────────────
  /viewing\s+jam\s+berapa/, /jam\s+berapa.*viewing/, /mau\s+viewing\s+jam/,
  // Q2b — "Sudah lihat berapa properti/villa/rumah di X? Apa yang membuat belum cocok?"
  // Q4 house pilot — "Sebelumnya sudah sempat lihat beberapa rumah, Kak?"
  /sudah\s+lihat\s+berapa/, /sudah\s+sempat\s+lihat/, /sebelumnya\s+sudah\s+sempat/,
  /apa\s+yang\s+membuat\s+belum\s+cocok/, /belum\s+cocok\s+dari\s+yang/,
  // Q3 — price anchor format: "ada ... yang di kisaran ... dan ada juga yang ... Kira-kira yang mana lebih sesuai?"
  /kira-kira\s+yang\s+mana/, /yang\s+mana\s+lebih\s+sesuai/, /ada\s+yang\s+di\s+kisaran/,
  /di\s+kisaran\s+\d/, /lebih\s+sesuai\s+dengan\s+rencana/, /sesuai\s+dengan\s+rencana\s+anda/,
  // Q3 — KATEGORI budget: "...prefer yang terjangkau, menengah, atau eksklusif?"
  /prefer\s+yang\s+(terjangkau|menengah|eksklusif)/, /terjangkau.*(menengah|eksklusif)/,
  /menengah.*eksklusif/, /budget[\s-]*friendly.*(mid[\s-]*range|exclusive)/,
  // QM (house pilot) — motivation / why now: "Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang?"
  /apa\s+yang\s+(membuat|bikin).*(cari|mulai)/, /mulai\s+cari\s+(rumah|properti)/,
  /what'?s?\s+prompting.*search/, /what\s+made\s+you/, /why.*looking.*now/,
  // QF (house pilot) — financing: "rencana pakai KPR atau cash?"
  /kpr\s+atau\s+cash/, /cash\s+atau\s+kpr/, /mortgage.*or.*cash/, /cash.*or.*mortgage/,
  // Q_NAME / Q_EMAIL — identitas customer sebelum summary (registrasi customer).
  // Jawaban polos ("Rina", "budi@gmail.com") wajib dianggap lanjutan properti.
  /boleh\s+(?:saya\s+)?tahu\s+nama/, /may\s+i\s+know\s+your\s+name/,
  /boleh\s+minta\s+(?:alamat\s+)?email/, /alamat\s+email/, /your\s+email\s+address/,
];

// Obrolan harian / kondisi sehari-hari (mati listrik, banjir, macet, wifi mati, dll).
// Ini BUKAN query properti meski kebetulan menyebut "rumah" atau kata yang juga dipakai
// sebagai fasilitas/patokan ("wifi", "di jalan"). Dicek TANPA SYARAT (mengabaikan sinyal
// fasilitas/landmark yang kebetulan ada) supaya AI tidak menjawab obrolan pribadi dengan
// pertanyaan kualifikasi. Contoh nyata: "Rumahku barusan mati listrik".
// Catatan: 'banjir' dikecualikan jika diikuti "kanal" (Banjir Kanal = nama tempat asli).
// "banjir" / "macet" generik (obrolan harian), KECUALI bila dipakai sebagai PREFERENSI
// red-flag (tidak macet, bebas banjir, hindari kemacetan) — itu jawaban Q5 yang valid.
const BANJIR_DAILY = /\bbanjir\b(?!\s*kanal)/;
// Negasi termasuk bentuk singkat informal WA: "gk", "gak", "ga", "nggak", "ngga",
// "ndak" (standalone, tanpa "mau") — "gk banjir" / "ga panas" adalah jawaban Q5 valid.
const FLOOD_AVOID_PREFERENCE = /\b(bebas|tidak|tdk|anti|hindari|terhindar(?:i)?|menghindari|jauh\s+dari|aman\s+dari|rawan|jangan|gk|gak|ga|nggak|ngga|enggak|ndak|ga\s+mau|gak\s+mau|nggak\s+mau|enggak\s+mau)\b[\s\w]*\bbanjir\b/i;

// "macet"/"kemacetan" sebagai preferensi (jawaban Q5) bukan obrolan kemacetan.
// Contoh valid Q5: "tidak macet", "bebas macet", "hindari kemacetan", "anti macet", "gk macet".
const MACET_DAILY = /\b(macet|kemacetan)\b/;
const MACET_AVOID_PREFERENCE = /\b(bebas|tidak|tdk|anti|hindari|terhindar(?:i)?|menghindari|jauh\s+dari|aman\s+dari|jangan|gk|gak|ga|nggak|ngga|enggak|ndak|ga\s+mau|gak\s+mau|nggak\s+mau|enggak\s+mau)\b[\s\w]*\b(macet|kemacetan)\b/i;

// "panas" sebagai preferensi red-flag Q5 ("gk panas", "tidak panas", "area panas",
// "jangan yang panas") — jawaban valid, bukan obrolan cuaca.
const PANAS_AVOID_PREFERENCE = /\b(bebas|tidak|tdk|anti|hindari|terhindar(?:i)?|menghindari|jauh\s+dari|jangan|gk|gak|ga|nggak|ngga|enggak|ndak|area|tempat)\b[\s\w]*\bpanas\b/i;

const DAILY_LIFE_OFFTOPIC = [
  /\b(mati\s+listrik|listrik\s+(mati|padam)|pemadaman|\bpln\b|byar\s*pet|mati\s+lampu|lampu\s+(mati|padam))\b/,
  /\b(wifi\s+(mati|lemot|lambat|lelet)|internet\s+(mati|lemot|lambat|down)|sinyal\s+(jelek|hilang|ilang|lemah)|pulsa\s+habis|kuota\s+habis)\b/,
  MACET_DAILY,
  /\b(gempa|longsor|kebakaran|kebanjiran|badai|angin\s+kencang)\b/,
  BANJIR_DAILY,
  // ── Broadcast/group-order "PO" (Pre-Order / Purchase Order) — sangat umum di grup
  // WhatsApp jualan makanan/jajanan ("Open PO untuk Rabu Sore, Degan jelly Rp16.000,
  // yang mau order tolong list nama"). Dicek UNCONDITIONAL (seperti item lain di atas)
  // supaya harga (Rp16.000) di dalamnya tidak salah tertangkap sebagai jawaban budget
  // properti (yang biasanya BYPASS gate panjang-pesan via hasBudgetAnswer/hasStrongAnswerCue).
  /\bopen\s*po\b|\bpre[\s-]?order\b|\btutup\s*po\b|\bpo\s+(dibuka|closed?|ditutup|tutup)\b/i,
  /\byang\s+mau\s+order\b|\btolong\s+list\s+nama\b|\blist\s+nama\s+(di\s*bawah|yang\s+mau)\b/i,
  // ── Beli/pesan MAKANAN-MINUMAN — "Saya mau beli nasi jagung" ────────────────
  // Kata "beli/pesan" di kalimat makanan pernah lolos gate (via context-bypass
  // in-flow) lalu MEM-FLIP transaksi sewa→beli ("Untuk beli Hotel di surabaya").
  // Dicek unconditional: verba beli/pesan/order + kata kuliner = bukan properti.
  /\b(beli|pesan|order|mau\s+makan|lagi\s+makan)\s+(?:\w+\s+){0,2}?(nasi|bakso|mie|mi\b|bubur|ayam|sate|soto|rawon|rendang|pecel|gado[\s-]?gado|martabak|roti|kue|gorengan|jajan(an)?|snack|c[ae]milan|kopi|teh|es\s+\w+|jus|boba|seblak|batagor|siomay|pentol|lontong|ketoprak|nasgor|makanan|minuman)\b/i,
];

/** Pesan adalah obrolan harian non-properti (mati listrik, banjir, macet, dll)? */
function isDailyLifeOffTopic(lower) {
  for (const p of DAILY_LIFE_OFFTOPIC) {
    if (!p.test(lower)) continue;
    // Pengecualian: "banjir"/"macet" sebagai preferensi menghindari (red-flag Q5)
    // bukan obrolan harian — "tidak macet, tidak banjir" = jawaban kualifikasi valid.
    if (p === BANJIR_DAILY && FLOOD_AVOID_PREFERENCE.test(lower)) continue;
    if (p === MACET_DAILY  && MACET_AVOID_PREFERENCE.test(lower)) continue;
    return true;
  }
  return false;
}

/**
 * DORMAN PASCA-SUMMARY — siklus responsivitas AI:
 *   Q1-4 terpenuhi → AI responsif → interview Q1-Q12 → summary terkirim →
 *   AI DORMAN (tidak membalas apa pun) → customer mengirim query properti BARU
 *   (hasPropertyKeyword true → tidak lewat fungsi ini) → responsif lagi.
 *
 * Return true bila pesan AI TERAKHIR yang mengandung summary brief
 * ("✓ Rencana:") belum disusul query properti baru dari customer. Selama
 * dorman: jawaban lanjutan pendek ("oke", "makasih") dan obrolan off-topic
 * sama-sama TIDAK dibalas (redirect off-topic hanya berlaku saat responsif).
 * History yang sudah dilupakan TTL (getConversationHistory → []) otomatis
 * membuat fungsi ini false → evaluasi gate mulai dari nol.
 *
 * @param {Array} history - [{role, message}] history sesi aktif
 * @returns {boolean}
 */
function isPostSummaryDormant(history) {
  if (!Array.isArray(history) || history.length === 0) return false;
  const SUMMARY_RE = /[✓✔]\s*Rencana\s*:/i;
  let lastSummaryIdx = -1;
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    if ((m.role === 'ai' || m.role === 'assistant') && SUMMARY_RE.test(m.message || '')) {
      lastSummaryIdx = i;
    }
  }
  if (lastSummaryIdx === -1) return false;
  // Query properti baru dari customer SETELAH summary → sudah reaktivasi.
  for (let i = lastSummaryIdx + 1; i < history.length; i++) {
    const m = history[i];
    if ((m.role === 'user' || m.role === 'customer') && hasPropertyKeyword(m.message || '')) {
      return false;
    }
  }
  return true;
}

/**
 * Topik yang JELAS bukan properti. Dipakai dua kali di isPropertyContextContinuation:
 * (a) jalur normal, dan (b) jalur bypass ketika sinyalnya hanya "AI baru bertanya"
 * (lemah) — supaya obrolan harian tidak lolos hanya karena timing pertanyaan.
 * Sengaja di module scope agar kedua jalur memakai daftar yang SAMA (satu sumber).
 */
const CLEAR_NON_PROPERTY = [
  /\b(makanan|minuman|kuliner|restoran|cafe|kafe|masak|resep|menu|makan|bakso|mie|nasi|ayam|sate|soto|jajan|ngopi|kopi|camilan|gorengan|warteg)\b/,
  /\b(kendaraan|mobil|motor|sepeda|tiket|travel|wisata|hotel liburan|penginapan wisata)\b/,
  /\b(elektronik|laptop|hp|handphone|gadget|komputer|printer)\b/,
  /\b(pakaian|baju|sepatu|tas|fashion|belanja online)\b/,
  /\b(obat|dokter|sakit|rumah sakit|klinik kesehatan|apotik)\b/,
  /\b(film|movie|bioskop|drakor|drama korea|anime|kartun|lagu|musik|music|konser|game|gaming|netflix|youtube|tiktok|medsos|sosmed|artis|selebriti|seleb|gosip)\b/,
];

/** Apakah salah satu dari ≤2 pesan AI terakhir adalah pertanyaan properti? */
function hasRecentPropertyQuestionIn(recentHistory) {
  const lastAI = (recentHistory || [])
    .filter(item => item.role === 'ai' || item.role === 'assistant')
    .slice(-2);
  return lastAI.some(item =>
    PROPERTY_QUESTION_PATTERNS.some(p => p.test((item.message || '').toLowerCase()))
  );
}

/**
 * Apakah pesan AI TERAKHIR mengajukan PERTANYAAN (apa pun bentuknya)?
 *
 * Guard STRUKTURAL, bukan berbasis daftar frasa. PROPERTY_QUESTION_PATTERNS adalah
 * daftar yang harus terus ditambah setiap kali AI memakai kalimat baru — dan setiap
 * frasa yang belum terdaftar membuat JAWABAN customer dianggap off-topic. Kasus
 * nyata (M51): AI bertanya "Untuk berapa orang yang akan menginap?" (tidak ada di
 * daftar) → jawaban "Untuk 3 orang sih" dibalas "saya asisten khusus properti".
 *
 * Logikanya sederhana & benar secara percakapan: kalau AI baru saja BERTANYA, maka
 * pesan pendek berikutnya dari customer adalah JAWABAN — titik. Tidak perlu tahu
 * pertanyaannya tentang apa.
 *
 * @param {Array} history - [{role, message}]
 * @returns {boolean}
 */
function lastAiMessageAsksQuestion(history) {
  if (!Array.isArray(history)) return false;
  const lastAi = [...history]
    .reverse()
    .find(item => item.role === 'ai' || item.role === 'assistant');
  if (!lastAi) return false;

  const msg = String(lastAi.message || '');
  if (!msg.trim()) return false;

  // Tanda tanya = sinyal terkuat. Footer "> Sent via …" & tanda tangan dibuang dulu.
  const body = msg
    .replace(/>\s*_?sent\s+via[^\n]*/gi, '')
    .replace(/salam\s+hangat[\s\S]*$/i, '')
    .trim();

  if (/\?/.test(body)) return true;

  // Pertanyaan tanpa "?" — bentuk imperatif yang tetap menuntut jawaban.
  return /\b(boleh\s+(tahu|info|minta)|mohon\s+info|silakan\s+(sebut|pilih|info)|kira-kira|apakah|bagaimana|gimana)\b/i.test(body);
}

/**
 * Deteksi customer JENGKEL / mengeluh karena pertanyaan berulang.
 *
 * WAJIB ditangani khusus: pesan seperti "kok ditanya-tanya terus? udah dijawab tadi"
 * TIDAK mengandung kata properti, sehingga dulu jatuh ke balasan off-topic
 * ("saya asisten khusus properti") — respons paling buruk yang mungkin, karena
 * customer justru sedang mengeluh TIDAK didengarkan (M51 Case 1).
 *
 * @param {string} message
 * @returns {{frustrated:boolean, kind:'repetition'|'ignored'|'general'|null}}
 */
function detectCustomerFrustration(message = '') {
  const t = String(message || '').toLowerCase();
  if (!t.trim()) return { frustrated: false, kind: null };

  // (a) Mengeluh PERTANYAAN BERULANG — paling sering & paling penting.
  const REPETITION = [
    /\b(udah|sudah|kan\s+udah|kan\s+sudah)\b.{0,20}\b(jawab|bilang|kasih\s+tau|sebut|info)/i,
    /\b(ditanya|nanya|tanya)\b.{0,15}\b(terus|lagi|ulang|melulu|mulu|berkali|berulang)/i,
    /\b(kok|kenapa|ngapain|napa)\b.{0,25}\b(ditanya|nanya|tanya|ulang)/i,
    /\b(berapa\s+kali|dari\s+tadi|tadi\s+udah|itu\s+udah)\b/i,
    /\b(muter|muter-muter|bolak-balik|balik\s+lagi|ulang\s+terus|loop)\b/i,
    /\bpertanyaan\b.{0,15}\b(sama|itu|ulang|berulang)/i,
    /\b(same|already)\s+(question|answered|told|said)\b/i,
    /\bagain\b.{0,15}\b(asking|question)|\basking\b.{0,15}\bagain\b/i,
  ];
  if (REPETITION.some(p => p.test(t))) return { frustrated: true, kind: 'repetition' };

  // (b) Merasa TIDAK DIBACA / tidak didengarkan.
  const IGNORED = [
    /\b(dibaca|baca\s+dong|baca\s+lah|dibaca\s+lah|gak\s+dibaca|tidak\s+dibaca|ga\s+baca)\b/i,
    /\b(nyimak|simak|didengar|didengerin|dengerin|merhatiin|perhatiin)\b.{0,10}\b(gak|ga|nggak|tidak|dong)?/i,
    /\b(gak|ga|nggak|tidak)\s+(nyambung|paham|ngerti|connect)\b/i,
    /\b(read|listen)\b.{0,12}\b(please|properly)\b/i,
  ];
  if (IGNORED.some(p => p.test(t))) return { frustrated: true, kind: 'ignored' };

  // (c) Kesal umum / kecewa pada layanan (bukan sekadar kata kasar acak).
  const GENERAL = [
    /\b(capek|cape|bosen|bosan|jengkel|kesal|kesel|sebel|ribet|lama\s+banget|lelet|payah|parah)\b/i,
    /\b(gak|ga|nggak|tidak)\s+(jelas|beres|bener|profesional|membantu|guna)\b/i,
    /\b(bot|robot)\b.{0,20}\b(gak|ga|nggak|tidak|bego|bodoh|error)\b/i,
    /\b(useless|annoying|frustrating|ridiculous)\b/i,
  ];
  if (GENERAL.some(p => p.test(t))) return { frustrated: true, kind: 'general' };

  return { frustrated: false, kind: null };
}

/**
 * Apakah percakapan JELAS sedang dalam alur kualifikasi properti (Q1–Q12)?
 *
 * Lebih robust daripada hasRecentPropertyQuestionIn / hasPropertyCtx untuk alur
 * PANJANG: tidak bergantung pada kata TIPE (apartemen/villa/…) yang sudah keluar
 * window, juga tidak bergantung pada frasa PERSIS pertanyaan AI terakhir. Cukup
 * hitung berapa banyak pesan AI di SELURUH history yang berupa pertanyaan properti
 * (PROPERTY_QUESTION_PATTERNS). ≥2 → percakapan sudah pasti in-flow, sehingga
 * jawaban PENDEK apa pun ("Boleh..", "Terserah", "Ya kak") = lanjutan yang valid.
 *
 * @param {Array} history - [{role, message}] (boleh seluruh history, bukan window)
 * @returns {boolean}
 */
function isInPropertyFlow(history) {
  if (!Array.isArray(history)) return false;
  let aiPropertyQuestions = 0;
  for (const item of history) {
    if (item.role !== 'ai' && item.role !== 'assistant') continue;
    const msg = (item.message || '').toLowerCase();
    if (PROPERTY_QUESTION_PATTERNS.some(p => p.test(msg))) {
      if (++aiPropertyQuestions >= 2) return true;
    }
  }
  return false;
}

/**
 * Pola jawaban singkat yang bisa merupakan lanjutan percakapan properti.
 *
 * Kasus pakai:
 *   AI   → "Untuk Gudang yang Anda cari — rencananya untuk sewa atau beli?"
 *   User → "saya beli"           ← hasPropertyKeyword = false, TAPI ini lanjutan!
 *
 * Logika:
 *   1. Message singkat (≤ 70 karakter)
 *   2. Pesan tidak memperkenalkan topik non-properti baru
 *   3. History 5 pesan terakhir mengandung konteks properti
 *   4. Pesan AI terakhir mengandung pertanyaan tentang properti
 *   5. Message saat ini cocok dengan pola jawaban (transaksi, harga, lokasi, dll)
 *
 * @param {string}   message - Pesan customer saat ini
 * @param {Array}    history - Riwayat percakapan [{role, message}]
 * @returns {boolean}
 */
function isPropertyContextContinuation(message, history = []) {
  if (!message || typeof message !== 'string') return false;
  if (!Array.isArray(history) || history.length === 0) return false;

  const lower = message.toLowerCase().trim();

  // ── Sinyal konteks dihitung lebih awal — dibutuhkan oleh smart CLEAR_NON_PROPERTY ──
  // Dipindah ke sini agar bypass CLEAR_NON_PROPERTY bisa menggunakannya.
  // Catatan: `hasPropertyCtx` (panggil hasPropertyKeyword per item history) masih
  // dihitung di bawah karena lebih mahal dan tidak dibutuhkan di sini.
  const recentHistory      = history.slice(-6);
  const inPropertyFlow     = isInPropertyFlow(history);
  const hasRecentPropertyQ = hasRecentPropertyQuestionIn(recentHistory);
  // Guard struktural: AI baru saja BERTANYA (bentuk apa pun) → pesan pendek
  // berikutnya adalah JAWABAN, walau frasa pertanyaannya belum terdaftar.
  const aiJustAsked        = lastAiMessageAsksQuestion(recentHistory);

  // ── Customer JENGKEL / mengeluh pertanyaan berulang ──────────────────────────
  // SELALU lanjutan percakapan properti — keluhan tentang alur kualifikasi jelas
  // masih dalam konteks properti. Membalasnya dengan "saya asisten khusus properti"
  // (perilaku lama) memperburuk kekesalan customer secara drastis.
  if (inPropertyFlow && detectCustomerFrustration(message).frustrated) return true;

  // ── Obrolan harian non-properti → tolak SEGERA (sebelum cek fasilitas/landmark) ──
  // Frasa seperti "mati listrik", "wifi mati", "macet", "rumahku banjir" adalah
  // obrolan pribadi, bukan jawaban kualifikasi — walau menyebut "rumah"/"wifi"/"di jalan".
  if (isDailyLifeOffTopic(lower)) return false;

  // ── Deteksi konten properti sebelum cek panjang ───────────────────────────
  // Jawaban Q2b ("Sudah lihat berapa properti?") dan Q5/Q6 bisa panjang dan
  // berisi fasilitas / landmark. Contoh valid yang harus LOLOS:
  //   "saya ingin ada fasilitas gym dan kolam renangnya, lalu dekat dengan PTC"
  //   "hadap timur, tidak mau dekat jalan tol, ada taman bermain untuk anak"
  // Permintaan jadwal kunjungan / viewing / survey — selalu konteks properti.
  // Dua tier:
  //   (a) Kata-kata sangat spesifik properti → cukup sendirian
  //   (b) Kata umum (survey/survei/jadwal) → perlu pasangan sinyal properti/timing
  // Contoh: "Boleh.. kapan saya bisa viewing?", "kapan bisa survei?", "jadwal site visit"
  const isSchedulingRequest =
    /\b(viewing|site\s+visit|open\s+house|lihat\s+unit|lihat\s+rumah|lihat\s+properti)\b/i.test(lower)
    || (/\b(survey|survei)\b/i.test(lower) && /\b(kapan|jadwal|bisa|mau|boleh|properti|rumah|unit)\b/i.test(lower))
    || (/\b(jadwalkan|jadwal\s+kunjungan)\b/i.test(lower) && /\b(properti|rumah|unit|viewing|survey|survei)\b/i.test(lower));

  const hasPropertyFacility = /\b(fasilitas|gym|fitness|kolam\s*renang|kolam|renang|parkir|garasi|carport|taman|playground|play\s*ground|kids?\s*zone|kids?\s*club|keamanan|cctv|ac|wifi|internet|lift|elevator|rooftop|balkon|balcony|view|pemandangan|clubhouse|sport|olahraga|water\s*heater|mushola|jogging|jacuzzi|bathtub|bak\s+mandi|yoga|sauna|steam|spa|dapur|kitchen|laundry|mesin\s+cuci|teras|terrace|shower|tennis|badminton|futsal|basket|barbecue|bbq|gerbang|smart\s+home|smart\s+tv|lemari|wardrobe|kasur|sofa|kompor|kulkas|springbed|dispenser|game\s+room|billiard|private\s+pool|infinity\s+pool|kolam\s+ikan|taman\s+bermain|genset|generator|security\s+guard|satpam|intercom|gate\s+system|one\s+gate|bar\s+lounge|wine\s+cellar)\b/i.test(lower);
  const isLandmarkAnswer    = /\b(dekat|deket|near|close\s+to|di\s+jalan|di\s+sekitar|samping|next\s+to|beside|sebelah)\b/i.test(lower);
  // Jawaban QM (motivation / why now — house pilot). Frasa life-event ini bukan kata
  // properti, tapi jelas jawaban atas "apa yang membuat Kak mulai cari rumah?".
  // Contoh valid yang harus LOLOS (sebelumnya ter-drop karena > 70 char):
  //   "Saya pindahan karena ada pindahan kerja, sekalian mau menetap di Jakarta"
  const isMotivationAnswer  = /\b(pindah|pindahan|mutasi|relokasi|relocat|kontrak\s+(habis|abis)|ngontrak|keluarga\s+(nambah|bertambah)|nambah\s+anak|anak\s+(masuk|sekolah)|sekolah\s+anak|investasi|invest|disewakan|pensiun|menikah|nikah|kerja\s+baru|pindah\s+kerja|mutasi\s+kerja|menetap|growing\s+family|relocation|moving|job\s+(relocat|transfer)|dinas|perjalanan\s+dinas|ditugaskan|penugasan|tugas\s+(kerja|dinas|kantor)|kerja\s+(dinas|sementara|sebentar)|pindah\s+tugas|liburan|berlibur|vacation|holiday|staycation|wisata|honeymoon|bulan\s+madu|business\s+trip|work\s+trip|workation)\b/i.test(lower);
  // Jawaban preferensi Q5/Q6 (red-flags / lokasi): jalan, akses, orientasi, suasana.
  // Contoh: "Saya mau jalan lebar, access strategis", "yang tenang tidak bising".
  const isPreferenceAnswer  = /\b(jalan\s+(raya|lebar|besar|utama|kecil)|akses|access|strategis|hook|pojok|sudut|menghadap|hadap\s+(timur|barat|utara|selatan|matahari)|jalan\s+ramai|bising|tenang|sepi|ramai|rame|hidup|aman|nyaman|asri|sejuk|adem|dingin|rindang|pepohonan|pohon|hijau|teduh|gelap|terang|pencahayaan|panas|gerah|pengap)\b/i.test(lower)
                              || FLOOD_AVOID_PREFERENCE.test(lower)
                              || MACET_AVOID_PREFERENCE.test(lower)
                              || PANAS_AVOID_PREFERENCE.test(lower);
  // Jawaban preferensi TOWER / LANTAI / ORIENTASI (khusus apartemen/kondotel/kondominium).
  // Pertanyaan AI: "ada preferensi tower atau lantai tertentu? hadap timur, lantai rendah/tengah/tinggi?"
  // Contoh valid yang harus LOLOS (sebelumnya ter-drop karena > 70 char & tanpa sinyal):
  //   "Hadap menghindari sinar matahari terbenam dan terbit.. Lantai antara 12-15 aja"
  //   "Tower selatan, lantai tinggi, hadap timur biar dapat sunrise"
  //   "Lantai rendah aja, hindari matahari sore yang silau"
  // Catatan: orientasi "hindari matahari terbit+terbenam" = customer ingin unit SEJUK
  // (tidak kena sinar langsung pagi & sore) — sekaligus red-flag "hindari silau/panas".
  const isTowerFloorAnswer  = /\b(lantai|tower|penthouse)\b/i.test(lower)
                              || /\b(hadap|menghadap|menghindari|hindari)\b.{0,30}\b(timur|barat|utara|selatan|matahari|sinar|terbit|terbenam|sunrise|sunset|silau|sore|pagi)\b/i.test(lower)
                              || /\b(sinar\s+matahari|matahari\s+(terbit|terbenam)|sunrise|sunset)\b/i.test(lower);
  // Preferensi LINGKUNGAN/amenity di sekitar (positif): "banyak cafe, resto dan warung",
  // "dekat mall/kampus/pasar". Kata kuliner di sini = patokan lokasi, BUKAN pesan makanan.
  const isAmenityVicinity   = /\b(banyak|dekat|deket|near|area|kawasan|lingkungan|sekitar|deketan|berdekatan|akses\s+ke)\b/i.test(lower) &&
                              /\b(cafe|kafe|resto|restoran|restaurant|warung|warteg|mall|plaza|kampus|sekolah|universitas|pasar|minimarket|indomaret|alfamart|rumah\s+sakit|stasiun|halte|terminal|tol|gym|taman|kantor)\b/i.test(lower);
  // Jawaban BUDGET (Q3) — angka + satuan mata uang, termasuk range "9-10 juta/bln",
  // "Rp 2.000.000", "5jt per bulan". Ini sinyal properti yang KUAT: jawaban harga
  // yang sah sering > 70 char saat customer menambah konteks ("...yg bisa dinego ya kak").
  const hasBudgetAnswer     = /\b\d[\d.,]*\s*(?:-\s*\d[\d.,]*\s*)?(juta|jutaan|jt|ribu|rb|miliar|milyar)\b/i.test(lower)
                              || /\brp\.?\s*\d/i.test(lower)
                              // Angka IDR penuh tanpa satuan: "40.750.000.000", "1.600.000",
                              // "Coba yang 40.750.000.000" (≥2 grup ribuan = minimal jutaan).
                              // Jawaban pilih anchor harga — customer ketik angka mentah.
                              || /\b\d{1,3}(?:[.,]\d{3}){2,}\b/.test(lower);
  // Permintaan / preferensi NEGOSIASI harga — "bisa dinego", "nego dong", "minta yg
  // nego", "negotiable", "bisa kurang harganya", "ditawar". Khas obrolan properti.
  const hasNegotiationCue   = /\b(nego|dinego|dinegokan|dinegosiasi|negosiasi|negotiable|nawar|ditawar|menawar|tawar[\s-]?menawar|kurang\s+harganya|harga\s+bisa\s+kurang|bisa\s+kurang)\b/i.test(lower);
  // Jawaban FURNISHING (Q11) — status perabotan + perabot/peralatan rumah. Sering > 70
  // char saat customer merinci ("semi furnished, pokok ada peralatan dapur, lemari,
  // ranjang"). Kosakata furnitur tidak ada di hasPropertyFacility, jadi perlu sendiri.
  const hasFurnishingAnswer = /\b(furnished|unfurnished|furnish|furnitur|furniture|semi[\s-]?furnish\w*|full[\s-]?furnish\w*|fully[\s-]?furnish\w*|kosongan|perabot(?:an)?|peralatan\s+(dapur|rumah|masak|elektronik)|lemari|ranjang|kasur|tempat\s+tidur|spring\s*bed|springbed|sofa|kompor|kulkas|mesin\s+cuci|dispenser|kitchen\s+set|wardrobe)\b/i.test(lower);
  // Jawaban KONDISI (Q_COND, beli) — baru/ready/second/bekas/inden, atau "kondisi
  // bagus/baik/prima/mulus/terawat". Sering > 70 char saat customer merinci ("second
  // atau baru, cuma untuk second. Saya mau kondisi bagus") → tanpa sinyal ini ter-drop
  // oleh gate 70-char, lalu SALAH dibalas off-topic ("saya asisten khusus properti")
  // atau di-skip total ("bukan query properti"). Kondisi = kosakata kualifikasi properti.
  const hasConditionAnswer  = /\b(second|bekas|inden|indent)\b/i.test(lower)
                              || /\bkondisi\s+(bagus|baik|prima|terawat|mulus|oke|ok|siap|baru|second|layak|ready)\b/i.test(lower);
  const hasPropertyContent  = hasPropertyFacility || isLandmarkAnswer || isMotivationAnswer || isPreferenceAnswer || isAmenityVicinity || isSchedulingRequest || isTowerFloorAnswer;
  // Sinyal jawaban kualifikasi yang KUAT (budget/nego Q3, furnishing Q11) cukup untuk
  // MELEWATI batas panjang 70-char, tapi SENGAJA tidak melewati screening
  // CLEAR_NON_PROPERTY di bawah — supaya "beli laptop 10 juta" tetap tersaring.
  // Jawaban KATEGORI budget (Q3): terjangkau / menengah / eksklusif / mahal / murah /
  // kompetitif. Customer boleh jawab kategori daripada angka. Sinyal properti yang KUAT.
  const hasBudgetCategory   = /\b(terjangkau|ekonomis|murah|termurah|hemat|menengah|sedang|standar|eksklusif|ekslusif|mewah|premium|luxur(y|ious)|mahal|kompetitif|competitive|low\s*budget|affordable|mid[\s-]*range|budget[\s-]*friendly|exclusive)\b/i.test(lower);
  // Jawaban PENGHUNI / KAPASITAS (Q4) — "tinggal bersama siapa?" / "berapa orang?".
  // ⚠️ Sebelumnya TIDAK ADA detektor untuk ini sama sekali, padahal Q4 adalah
  // pertanyaan WAJIB. Jawaban Q4 yang panjang otomatis jatuh ke gate 70-char lalu
  // dibalas "saya asisten khusus properti" — customer melihat jawabannya yang
  // BENAR ditolak sebagai off-topic. Kasus produksi 18 Agu 2026 (booking villa
  // Malang): "Rencana checkin 2 minggu lagi. Saya stay bersama keluarga besar,
  // butuh 5 kamar" = 78 char, ditolak DUA KALI berturut-turut.
  // Tiga kelas sinyal, masing-masing cukup sendiri:
  //   (a) jumlah kamar     — "butuh 5 kamar", "3 kt", "2 bedroom"
  //   (b) komposisi rumah  — "keluarga besar", "sama istri", "bertiga", "4 orang"
  //   (c) tanggal check-in — "checkin 2 minggu lagi" (booking; sepadan dgn M87)
  const hasOccupancyAnswer  = /\b\d+\s*(kamar|kt\b|bedroom|bed\s*room|br\b)/i.test(lower)
                              || /\b(kamar|bedroom)\s*\d+/i.test(lower)
                              || /\b(keluarga\s+(besar|kecil|inti)|sekeluarga|serumah|rombongan)\b/i.test(lower)
                              // Verba HUNIAN saja (stay/tinggal/menginap/ditempati) — sengaja
                              // TIDAK memakai "bareng/sama/dengan" telanjang: "makan bareng
                              // keluarga" bukan jawaban Q4. Verba huniannya yang membedakan.
                              || /\b(stay|tinggal|menetap|nginap|menginap|ditempati|dihuni|huni|nempatin|ditinggali)\b.{0,25}\b(istri|suami|pasangan|anak|anak-anak|orang\s*tua|ortu|mertua|keluarga|teman|temen|kawan|rekan|saudara|adik|kakak|art|asisten)\b/i.test(lower)
                              || /\b(ber(dua|tiga|empat|lima|enam|tujuh|delapan)|sendiri|sendirian|solo)\b/i.test(lower)
                              || /\b\d+\s*(orang|pax|tamu|guest|dewasa|anak)\b/i.test(lower)
                              || /\bcheck-?\s?in\b/i.test(lower);
  const hasStrongAnswerCue  = hasBudgetAnswer || hasNegotiationCue || hasFurnishingAnswer || hasBudgetCategory || hasConditionAnswer || hasOccupancyAnswer;

  // Pesan pendek (≤ 70 karakter) → proses normal
  // Pesan medium (71–200) dengan konten properti / sinyal budget-nego-furnishing → jawaban Q2b/Q3/Q5/Q6/Q11
  // Pesan sangat panjang (> 200) → selalu topik baru, bukan continuation
  if (!hasPropertyContent && !hasStrongAnswerCue && lower.length > 70) return false;
  if (lower.length > 200) return false;

  // ── Cek apakah pesan memperkenalkan topik NON-PROPERTY yang jelas ───────
  // Skip jika pesan sudah punya konten properti (landmark/fasilitas/motivasi/preferensi/
  // amenity sekitar) — mis. "banyak cafe, resto dan warung" = patokan lokasi, bukan kuliner.
  if (!hasPropertyContent) {
    // ── CONTEXT-AWARE BYPASS ─────────────────────────────────────────────────
    // Ketika percakapan JELAS sudah dalam Q-flow properti (≥2 pertanyaan AI) DAN AI
    // baru saja mengajukan pertanyaan properti, jawaban customer tentang fasilitas /
    // preferensi TIDAK boleh diblokir walau mengandung kata seperti "restoran/cafe/gym".
    // Contoh valid yang harus LOLOS:
    //   "Ada gym dan restoran di dalam?"    → preferensi fasilitas, bukan pesan makanan
    //   "Mau yang ada kolam renang + yoga"  → preferensi fasilitas
    //   "Ada kitchen set, jacuzzi, teras?"  → preferensi fasilitas (jacuzzi, teras baru ditambah)
    //   "Yang banyak cafe di sekitarnya"    → preferensi lokasi/lingkungan
    // Hanya blokir jika JELAS-JELAS bukan properti (order makanan, beli tiket, dll.)
    // Widened: cukup AI TERAKHIR BERTANYA (struktural, lastAiMessageAsksQuestion)
    // — tidak lagi menuntut frasa pertanyaannya terdaftar di PROPERTY_QUESTION_PATTERNS.
    // Ini menutup seluruh kelas bug "AI bertanya, customer jawab, jawaban dianggap
    // off-topic" untuk pertanyaan baru yang belum pernah didaftarkan (M51).
    // ⚠️ DULU: `inPropertyFlow && (hasRecentPropertyQ || aiJustAsked)`.
    // `inPropertyFlow` menuntut MINIMAL DUA pertanyaan properti dari AI, jadi
    // jawaban atas pertanyaan PERTAMA tidak pernah bisa lolos jalur ini —
    // padahal justru di situ konteksnya paling tipis (kata tipe/kota baru
    // muncul sekali). Kasus nyata M88: AI menanyakan Q2c sebagai pertanyaan
    // pertama, customer menjawab "Daerah Gubeng" lima kali, tidak pernah
    // dibalas. Syarat dilonggarkan: pertanyaan properti yang DIKENALI
    // (hasRecentPropertyQ) sudah cukup kuat sendiri — jumlahnya tidak relevan.
    // `aiJustAsked` (sinyal LEMAH) TETAP menuntut inPropertyFlow.
    if ((hasRecentPropertyQ || (inPropertyFlow && aiJustAsked)) && lower.length <= 150) {
      const OBVIOUSLY_OFF_TOPIC = [
        /\b(pesan\s+makanan|order\s+makanan|gofood|grabfood|shopeefood|mau\s+makan\s+di|lagi\s+di\s+restoran)\b/i,
        /\b(tiket\s+(pesawat|kereta|bus|kapal)|booking\s+tiket|paket\s+wisata|tur\s+wisata)\b/i,
        /\b(beli\s+(hp|laptop|iphone|gadget)|harga\s+(hp|laptop|iphone|samsung))\b/i,
        /\b(nonton\s+film|bioskop|tiket\s+konser|nonton\s+drakor)\b/i,
        /\b(resep\s+(masakan|kue)|cara\s+masak\s+|masak\s+(apa|gimana))\b/i,
      ];
      if (OBVIOUSLY_OFF_TOPIC.some(p => p.test(lower))) return false;

      // ⚠️ GRADASI KEKUATAN SINYAL — penting.
      // hasRecentPropertyQ = frasa pertanyaan properti DIKENALI (sinyal KUAT) →
      //   jawaban boleh memakai kosakata yang biasanya non-properti
      //   ("ada restoran & gym di dalam?" = pertanyaan fasilitas yang sah).
      // aiJustAsked SAJA = hanya tahu "AI mengakhiri pesan dengan tanda tanya"
      //   (sinyal LEMAH) → tetap saring CLEAR_NON_PROPERTY, supaya obrolan seperti
      //   "kasi makan dulu ya" tidak lolos hanya karena kebetulan AI baru bertanya.
      // ⚠️ Bypass CLEAR_NON_PROPERTY hanya sah bila percakapan SUDAH mapan
      // (inPropertyFlow) DAN frasa pertanyaannya dikenali. Saat baru ada SATU
      // pertanyaan (kasus M88), sinyalnya belum cukup untuk meloloskan kosakata
      // non-properti: "kasi makan dulu ya" tepat sesudah pertanyaan properti
      // pertama tetap harus ditolak.
      const strongEnoughToBypass = hasRecentPropertyQ && inPropertyFlow;
      if (!strongEnoughToBypass && CLEAR_NON_PROPERTY.some(p => p.test(lower))) return false;
      return true;
    }

    for (const pattern of CLEAR_NON_PROPERTY) {
      if (pattern.test(lower)) return false;
    }
  }

  // ── Periksa 5 pesan terakhir apakah ada konteks properti ─────────────────
  // ── PRIORITY fast paths — sebelum cek hasPropertyCtx ─────────────────────
  // Pola ini sangat spesifik sebagai jawaban Q10 (durasi sewa), sehingga aman
  // dilewatkan bahkan jika AI message belum tersimpan ke DB (race condition).
  // Syarat: sudah ada minimal 2 pesan sebelumnya (percakapan sudah dimulai).
  //
  // Contoh kasus: customer jawab "1 tahun" untuk Q10 "Rencananya sewa berapa lama?"
  // tapi pesan AI belum tersimpan → hasPropertyCtx = false → tanpa fix ini,
  // "1 tahun" difilter sebagai "bukan query properti".
  if (recentHistory.length >= 2) {
    // Durasi sewa singkat — jawaban Q10 ("1 tahun", "6 bulan", "2 minggu", "10 hari", "3 months")
    if (/^\d+\s*(hari|minggu|bulan|tahun|day|week|month|year)s?$/.test(lower.trim())) return true;

    // Fasilitas / patokan lokasi / motivasi / scheduling — konten properti KUAT & tidak
    // ambigu, aman dilewatkan tanpa cek konteks (mis. saat pesan AI belum tersimpan /
    // kata TIPE sudah keluar window).
    // Catatan: preferensi/amenity (jalan lebar, banyak cafe) SENGAJA tidak di sini —
    // sinyalnya lebih lemah, diverifikasi via konteks dulu (pattern 15a di bawah).
    if (hasPropertyFacility || isLandmarkAnswer || isMotivationAnswer || isSchedulingRequest || isTowerFloorAnswer) return true;
  }

  // Context (3 sinyal, salah satu cukup) — dirancang agar alur PANJANG tidak putus:
  //  1. hasPropertyCtx     : ada kata properti di SELURUH history (bukan cuma window 6).
  //     Penting karena kata TIPE (apartemen/villa) ada di awal & sering keluar window.
  //  2. hasRecentPropertyQ : pesan AI terakhir = pertanyaan properti (frasa cocok).
  //  3. inPropertyFlow     : ≥2 pesan AI di history adalah pertanyaan properti →
  //     percakapan jelas in-flow walau frasa pertanyaan terakhir tak terdaftar &
  //     kata TIPE sudah keluar window. Ini safety net untuk jawaban pendek malas
  //     ("Boleh..", "Terserah") di tengah Q-flow.
  // hasRecentPropertyQ + inPropertyFlow sudah dihitung di awal fungsi
  const hasPropertyCtx = history.some(item => hasPropertyKeyword(item.message || ''));
  if (!hasPropertyCtx && !hasRecentPropertyQ && !inPropertyFlow) return false;

  // ── Fast path: Jawaban yang SANGAT jelas sebagai lanjutan — tidak perlu cek AI question ──
  // Ini menghindari race condition di mana AI message belum tersimpan ke DB.
  //
  // Bulan Bahasa Indonesia ("Juni 2026", "Januari", "bulan depan Maret")
  if (/\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i.test(lower)) return true;
  // Bulan Bahasa Inggris
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(lower)) return true;
  // Singkatan bulan ("sep", "jan", "feb", "aug", dll.) — "Tanggal 18 sep ini"
  if (/\b(jan|feb|mar|apr|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)\b/i.test(lower)) return true;
  // Pola tanggal eksplisit: "tanggal 18", "tgl 5" — jawaban Q8
  if (/\b(tanggal|tgl)\s+\d{1,2}\b/i.test(lower)) return true;
  // Tahun referensi (e.g. "Juni 2026", "2027", "tahun depan 2027")
  if (/\b(202[4-9]|203[0-9])\b/.test(lower)) return true;
  // Jawaban tipe transaksi murni (satu kata / frasa pendek)
  if (/^(sewa|beli|jual|beli\s+aja|mau\s+sewa|mau\s+beli|untuk\s+sewa|untuk\s+beli|rent|buy|purchase)$/.test(lower.trim())) return true;
  // Durasi sewa singkat — juga cek di sini (setelah hasPropertyCtx) untuk kelengkapan
  if (/^\d+\s*(hari|minggu|bulan|tahun|day|week|month|year)s?$/.test(lower.trim())) return true;
  // Harga dengan satuan — jawaban Q3 ("2-4 juta/seminggu", "5 jt per bulan")
  if (/\b\d[\d.,]*\s*(juta|ribu|miliar|rb|jt)\b/i.test(lower)) return true;
  // Angka IDR penuh tanpa satuan — jawaban pilih anchor harga ("Coba yang 40.750.000.000",
  // "1.600.000"). ≥2 grup ribuan = minimal jutaan → pasti harga, bukan tanggal/jumlah kamar.
  if (/\b\d{1,3}(?:[.,]\d{3}){2,}\b/.test(lower)) return true;
  // Jawaban KATEGORI budget (Q3) — "terjangkau", "menengah", "eksklusif", "mahal", "murah",
  // "harga kompetitif", "menengah ke atas". Customer jawab kategori, bukan angka.
  if (hasBudgetCategory) return true;
  // Q2b answer fast-path: "Saya belum pernah lihat", "sudah lihat 3", "belum pernah survey",
  // "Belum pernah." (standalone — customer never searched before).
  // These are ALWAYS Q2b answers and must pass even before hasRecentPropertyQuestion check.
  if (/\b(belum\s+pernah\s+lihat|belum\s+pernah\s+survey|belum\s+pernah\s+cek|belum\s+pernah|pernah\s+lihat|sudah\s+lihat\s+\d|belum\s+lihat|sudah\s+survey|belum\s+ada\s+yang\s+cocok)\b/i.test(lower)) return true;
  // Hotel/penginapan keywords — meal plan & room type answers ("tanpa breakfast", "deluxe", "suite")
  if (/\b(breakfast|sarapan|makan\s+pagi|deluxe|suite|family\s+room|standard\s+room|check.?in|check.?out)\b/i.test(lower)) return true;

  // Note: context (hasPropertyCtx OR hasRecentPropertyQ) was already verified above.
  // We do NOT re-require a recent question here — that used to drop valid answers in
  // long flows. The answer-pattern checks below (+ final fallback) decide acceptance.

  // ── Cek apakah message saat ini terlihat seperti jawaban ─────────────────

  // 1) Jawaban tipe transaksi
  if (/\b(sewa|beli|jual|beli\s+aja|mau\s+sewa|mau\s+beli|disewa|dibeli|rent|buy|purchase|sale)\b/.test(lower))
    return true;

  // 2) Jawaban harga / budget
  if (/\b(\d[\d.,]*\s*(juta|ribu|miliar|rb|jt|m|k|rupiah))\b/.test(lower))
    return true;
  if (/\b(di\s+bawah|max|maksimal|minimal|range|antara|sekitar|kurang\s+dari|lebih\s+dari)\b/.test(lower) &&
      /\d/.test(lower))
    return true;

  // 3) Jawaban lokasi / area
  for (const loc of _locationCache) {
    if (lower.includes(loc)) return true;
  }
  if (/\b(di\s+\w+)\b/.test(lower)) return true;  // "di jakarta", "di mana saja"

  // 4) Jawaban singkat afirmatif / negatif dalam konteks (toleran terhadap pesan MALAS)
  // Tokenisasi: tanda baca → spasi, buang filler/vocative/intensifier ("kak", "dong",
  // "deh", "sekali", dll.), lalu cek apakah SISA kata semuanya afirmasi / semuanya negasi.
  // Mendukung "Boleh..", "boleh dong", "ya kak", "oke deh", "iya, boleh", "baik sekali",
  // "gak dulu", "nanti aja" — TANPA salah-loloskan "boleh pesan pizza".
  const _IGNORE  = new Set(['kak','ya','yah','iya','dong','deh','aja','saja','sih','kok','nih','loh','lah','banget','sekali','nya','ya,','dulu']);
  const _AFFIRM  = new Set(['ya','iya','iyaa','ok','oke','okay','okai','sip','siap','boleh','bisa','mau','setuju','sepakat','baik','lanjut','gas','gaskan','yup','yoi','yes','show','lihat','tampilkan','rekomendasikan','silakan','silahkan']);
  const _NEGATE  = new Set(['tidak','belum','ga','gak','nggak','ngga','blum','blom','enggak','engga','gamau','gakmau','nanti','skip','lewati','lewat','ada','usah','perlu']);
  const _toks = lower.replace(/[.,!?…]+/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const _core = _toks.filter(t => !_IGNORE.has(t));
  if (_toks.length > 0 && _core.length === 0) return true;                              // murni filler: "oke deh", "ya kak"
  if (_core.length > 0 && _core.every(t => _AFFIRM.has(t))) return true;                // "boleh", "iya boleh", "mau"
  if (_core.length > 0 && _core.every(t => _NEGATE.has(t) || _AFFIRM.has(t))) return true; // "gak dulu", "belum ada"

  // 4b) Jawaban identitas (Q_NAME/Q_EMAIL pra-summary — registrasi customer):
  //     email valid di pesan mana pun, atau jawaban PENDEK huruf-saja ("Rina",
  //     "Budi Santoso") tepat setelah AI menanyakan nama.
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(lower)) return true;
  {
    const lastAiMsg = [...(history || [])].reverse()
      .find(m => m.role === 'ai' || m.role === 'assistant');
    if (lastAiMsg && /boleh\s+(?:saya\s+)?tahu\s+nama|may\s+i\s+know\s+your\s+name|minta\s+(?:alamat\s+)?email/i
        .test(lastAiMsg.message || '')) {
      if (/^[a-z][a-z'.\s-]{1,40}$/i.test(lower.trim()) || /\b(lewati|skip|tidak\s+usah|ga\s+usah)\b/i.test(lower)) return true;
    }
  }

  // 5) Jawaban spesifikasi properti (luas, kamar, furnishing, dll)
  if (/\b(furnished|unfurnished|kosong|semi|ac|wifi|parkir|garasi|kolam|renang)\b/.test(lower))
    return true;
  // 5a) Jawaban KONDISI ruang/properti — "Kondisi yang fitted out, Kak", "bare shell
  //     saja", "yang siap pakai", "second aja", "inden tidak masalah", "ready stock".
  //     Jawaban Q kondisi kantor (fitted out/bare shell) & Q kondisi rumah (baru/second/inden).
  if (/\b(fitted\s*[\s-]?out|bare\s*[\s-]?shell|siap\s+pakai|bangun\s+interior|inden|indent|ready\s*(stock)?|second|bekas|renovasi|kondisi\s+(baru|baik|apa\s*adanya))\b/i.test(lower))
    return true;
  if (/\b(\d+\s*(kamar|km|lt|lb|m2|meter|lantai))\b/.test(lower))
    return true;
  if (/\b(besar|kecil|luas|sempit|bagus|mewah|sederhana|ekonomis|murah|mahal)\b/.test(lower))
    return true;

  // 6) Angka murni (kemungkinan jawaban harga atau ukuran)
  if (/^\d+[\d.,]*$/.test(lower.trim()))
    return true;

  // 7) Jawaban bulan/tahun masuk — menjawab pertanyaan move-in date
  if (/\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i.test(lower))
    return true;
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(lower))
    return true;
  // Referensi tahun (e.g. "Juni 2026", "next year 2027")
  if (/\b(202[4-9]|203[0-9])\b/.test(lower))
    return true;

  // 8) Durasi sewa singkat (jawaban Q10) — termasuk minggu/hari
  if (/\b(\d+\s*(hari|minggu|bulan|tahun|day|week|month|year)s?)\b/i.test(lower))
    return true;

  // 9) Jawaban komposisi keluarga / rumah tangga (Q4 — "tinggal bersama siapa?")
  //    Contoh: "saya tinggal sendiri", "sama istri aja", "ada 4 orang", "dengan anak-anak"
  if (/\b(sendiri|sendiran|sendirian|aja|aj|saja|sama\s+\w+|dengan\s+\w+|bersama|keluarga|orang\s+tua|istri|suami|anak|ayah|ibu|orangtua)\b/i.test(lower))
    return true;
  if (/^(iya|ya|setuju|baik|ok|boleh)[\s,]*\d+\s*(orang|person|orang\s+saja|orang\s+aja)$/i.test(lower))
    return true;  // "iya 4 orang", "ok 3 orang"
  if (/\b(just\s+me|just\s+us|me\s+alone|family|husband|wife|children|kids|parents|siblings)\b/i.test(lower))
    return true;  // English variants

  // 10) Jawaban preferensi furnishing / spesifikasi lebih detail
  //     Contoh: "semi furnish dong", "yang ada ac sama wifi", "minimal ada kamar mandi"
  if (/\b(furnish|ac\s+penuh|wifi|internet|kamar\s+mandi|parkir|garasi|kolam|renang|taman|keamanan|cctv|penjaga)\b/i.test(lower))
    return true;

  // 11) Jawaban patokan lokasi Q6 — "dekat pasar", "dekat jalan Dukuh Kupang",
  //     "dekat cafe", "dekat PT Jaya Putra", "near the train station", dll.
  //     Customer bebas menyebut nama apapun sebagai patokan — yang penting ada
  //     kata penunjuk jarak/lokasi di depannya.
  if (/\b(dekat|deket|near|close\s+to|di\s+jalan|di\s+sekitar|samping|next\s+to|beside)\b/i.test(lower))
    return true;

  // 11a) Jawaban AREA/DISTRIK Q2c — "Daerah Gubeng", "Area Ijen", "Kawasan
  //      Dinoyo", "Kecamatan Lowokwaru". Pola 3 di atas hanya mengenali nama
  //      KOTA (dari _locationCache) dan bentuk "di <kata>"; nama KECAMATAN
  //      tidak ada di cache mana pun, jadi jawaban Q2c yang sah tidak cocok
  //      pola apa pun dan ikut terbuang (M88).
  //      Aman: penanda area (daerah/area/kawasan/…) HARUS diikuti nama, dan
  //      konteks properti sudah diverifikasi jauh di atas (baris hasPropertyCtx).
  if (/\b(daerah|area|kawasan|wilayah|kecamatan|kelurahan|district)\s+[a-z]/i.test(lower))
    return true;

  // 12) Jawaban fleksibel / tidak ada preferensi (valid untuk Q5/Q6/Q7/Q11)
  //     "bebas saja", "terserah", "tidak ada preferensi", "tidak masalah", "flexible"
  if (/\b(bebas|fleksibel|flexible|terserah|tidak\s+masalah|ga\s+masalah|tidak\s+ada\s+preferensi|no\s+preference|whatever)\b/i.test(lower))
    return true;

  // 13) Jawaban negatif singkat — "tidak ada", "ga mau", "nggak mau", "tidak perlu", dll.
  //     Perlu ada history property context (sudah dicek di atas)
  if (/^(tidak|ga|gak|ngga|enggak|nggak|no)\s*(ada|masalah|preferensi|mau|perlu|usah|ingin|bisa|boleh|apa|tahu)?$/i.test(lower.trim()))
    return true;
  // Negasi pendek ≤ 30 chars — boleh diawali "saya/aku" — mencakup "tidak mau deh",
  // "ga mau ke sana", "saya enggak mau", "engga", "gamau", "gakmau", dll.
  // (Jawaban "tidak" untuk Q5/Q7/Q11; konteks properti sudah diverifikasi di atas.)
  if (lower.length <= 30 &&
      /^(saya\s+|aku\s+)?(tidak|ga|gak|ngga|enggak|engga|nggak|gak\s*mau|gamau|gakmau|nggamau|no)\b/.test(lower.trim()))
    return true;

  // 14) Jawaban Q2b (riwayat pencarian) — "Saya belum pernah lihat", "sudah lihat 3",
  //     "belum ada yang cocok", "sudah lihat tapi belum cocok"
  //     (Also covered in fast-path above for robustness)
  if (/\b(belum\s+pernah|pernah\s+lihat|sudah\s+lihat|belum\s+cocok|tidak\s+cocok|kurang\s+cocok|belum\s+ada\s+yang\s+cocok)\b/i.test(lower))
    return true;

  // 15) Jawaban preferensi jalan/akses/orientasi (Q5 red-flags / Q6) —
  //     "jalan raya lebar", "akses mudah", "hook/pojok", "hadap timur", "menghadap".
  if (/\b(jalan\s+(raya|lebar|besar|utama|kecil)|akses\s+(mudah|jalan|tol)|hook|pojok|sudut|menghadap|hadap\s+(timur|barat|utara|selatan|matahari)|bebas\s+banjir|tidak\s+banjir|jalan\s+ramai|bising)\b/i.test(lower))
    return true;

  // 15a) Preferensi lokasi/lingkungan (Q5/Q6) — strategis/akses, suasana (tenang/asri),
  //      atau amenity di sekitar ("banyak cafe, resto dan warung", "dekat mall/kampus").
  //      Konteks properti sudah diverifikasi di atas → aman. (Komputasi di awal fungsi.)
  if (isPreferenceAnswer || isAmenityVicinity)
    return true;

  // 15b) Jawaban / pertanyaan FINANCING (Q_KPR / Q_KPR-a) — "cash", "KPR", "DP",
  //      "cicilan", "tenor", "bunga", "uang muka". Konteks sudah diverifikasi di atas
  //      (mis. AI baru tanya cash/KPR). Mencakup "Cash KPR better mana?", "kasi rekom DP".
  if (/\b(kpr|dp|cash|tunai|cicilan|angsuran|tenor|bunga|uang\s+muka|down\s+payment|kredit)\b/i.test(lower))
    return true;

  // 15b-2) Permintaan / preferensi NEGOSIASI harga — "bisa dinego", "nego dong",
  //        "cari yg bisa ditawar", "negotiable". Konteks properti sudah diverifikasi
  //        di atas. Sering menyertai jawaban budget Q3 ("9-10 juta, tolong yg nego").
  if (hasNegotiationCue)
    return true;

  // 15b-3) Permintaan/persetujuan SCHEDULING — "Boleh.. kapan saya bisa viewing?",
  //        "kapan bisa survey?", "jadwal kunjungan", "mau viewing", "bisa survei".
  //        isSchedulingRequest sudah dihitung di atas sebagai fast-path (sebelum
  //        hasPropertyCtx), tapi sengaja diulangi di sini sebagai safety net.
  if (isSchedulingRequest)
    return true;

  // 15b-4) Jawaban WAKTU survey/viewing (Q9/Q9b/Q9c) — "Boleh siang?", "besok pagi",
  //        "nanti sore", "siang ini", "jam 2", "hari ini", "Sabtu". Konteks properti
  //        SUDAH diverifikasi di atas (AI baru tanya jadwal survey). Pendek & khas
  //        jawaban penjadwalan; tanpa ini, "Boleh siang, Kak?" ter-skip karena "siang"
  //        bukan kata afirmasi/properti. Dibatasi ≤ 40 char agar tetap aman.
  if (lower.length <= 40 &&
      (/\b(pagi|siang|sore|malam|subuh|petang)\b/i.test(lower)
       || /\b(besok|lusa|nanti|hari\s+ini|sekarang|akhir\s+pekan|weekend)\b/i.test(lower)
       || /\b(jam|pukul)\s*\d{1,2}/i.test(lower)
       || /\b(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|ahad)\b/i.test(lower)))
    return true;

  // 15c) Permintaan rekomendasi / saran / keputusan dalam konteks properti —
  //      "kasi rekom DP", "rekomendasi", "saran", "better mana", "yang mana",
  //      "gimana", "summarize", "ringkas". Pendek (≤ 60) + konteks properti aktif.
  if (lower.length <= 60 &&
      /\b(rekom|rekomendasi|rekomen|saran|sarankan|kasi|kasih|tolong|gimana|bagaimana|better|lebih\s+baik|yang\s+mana|mana\s+(yang|lebih)|pilih\s+mana|summar(y|ize|kan)|ringkas|simpulkan)\b/i.test(lower))
    return true;

  // 15d) Customer meminta klarifikasi tentang pertanyaan AI (meta-pertanyaan
  //      dalam alur aktif, bukan jawaban properti langsung).
  //      Contoh: "Ini tanggal apa ya?", "Maksud gimana?", "Yang mana yang dimaksud?"
  //      Guard: pesan pendek ≤ 80 char + ada tanda tanya + ada kata interogatif.
  //      CLEAR_NON_PROPERTY sudah diblokir di atas sehingga "Film apa yang bagus?"
  //      tidak akan lolos ke sini.
  if (lower.length <= 80 && /\?/.test(lower) &&
      /\b(apa|maksud|gimana|bagaimana|yang\s+mana|mana\s+yang|dimaksud|maksudnya|artinya|ini\s+apa|itu\s+apa)\b/.test(lower))
    return true;

  // 16) ── FINAL FALLBACK ──────────────────────────────────────────────────────
  //     Sampai titik ini sudah terbukti: (a) ada konteks properti di history,
  //     (b) pesan AI terakhir adalah PERTANYAAN properti, (c) pesan bukan topik
  //     non-properti (CLEAR_NON_PROPERTY sudah dicek di atas). Maka balasan PENDEK
  //     (≤ 70 char) yang diawali "mau/ingin/prefer/yang/butuh/jangan/hindari" pasti
  //     jawaban atas pertanyaan itu (mis. "Saya mau jalan raya lebar", "yang tenang").
  //     Ini mencegah jawaban kualifikasi yang sah ter-drop hanya karena tidak match
  //     salah satu pola spesifik di atas.
  if (lower.length <= 70 &&
      /^(saya\s+|aku\s+)?(mau|ingin|pengen|prefer|butuh|perlu|suka|lebih\s+suka|maunya|yang|jangan|hindari|tidak\s+mau|gak\s+mau|ga\s+mau|nggak\s+mau|enggak\s+mau|engga\s+mau|gamau|gakmau|tanpa|tidak\s+include|tidak\s+termasuk)\b/i.test(lower.trim()))
    return true;

  return false;
}

module.exports = {
  hasPropertyKeyword,
  isPropertyContextContinuation,
  isInPropertyFlow,
  lastAiMessageAsksQuestion,
  detectCustomerFrustration,
  isPostSummaryDormant,
  extractLocationFromMessage,
  extractPropertyTypeFromMessage,
  extractTransactionTypeFromMessage,
  initLocationCache,
  PROPERTY_TYPES,
  STANDALONE_KEYWORDS,
  // Getter so callers always read the live cache, not a stale snapshot.
  get INDONESIA_LOCATIONS() { return _locationCache; },
};

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
 * Digunakan oleh: fonnteChatController, watiChatController, dialogChatController
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
  'kost', 'kos', 'kosan', 'boarding house', 'boarding',
  'kontrakan', 'kontrakkan', 'bedeng',
  // Komersial
  'ruko', 'rukan', 'shophouse', 'shop house',
  'kantor', 'perkantoran',
  'gudang', 'pergudangan',
  'toko', 'pertokoan',
  'penginapan', 'resort',
  'klinik', 'kios',
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

  // ── English (bilingual support) ───────────────────────────────────────────
  // Transactions
  'buy', 'sell', 'rent', 'lease',
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
  return ACTION_WORDS.some(action => lower.includes(action));
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

const INDONESIA_LOCATIONS = [
  // Jabodetabek
  'jakarta', 'jakarta selatan', 'jakarta utara', 'jakarta barat',
  'jakarta timur', 'jakarta pusat',
  'bogor', 'depok', 'tangerang', 'tangerang selatan', 'bekasi',
  'cibubur', 'karawang', 'purwakarta', 'sukabumi',
  'cirebon', 'serang', 'cilegon',
  // BSD & Alam Sutera area
  'serpong', 'bsd', 'alam sutera', 'bintaro', 'lebak bulus',
  'pondok indah', 'kemang', 'menteng', 'kelapa gading',
  // Jawa
  'surabaya', 'bandung', 'semarang', 'yogyakarta', 'malang', 'solo',
  'surakarta', 'sidoarjo', 'mojokerto', 'madiun', 'kediri',
  // Bali & NTB
  'bali', 'denpasar', 'seminyak', 'kuta', 'ubud', 'sanur',
  'canggu', 'nusa dua', 'jimbaran', 'lombok', 'mataram',
  // Sumatra
  'medan', 'palembang', 'pekanbaru', 'padang', 'batam',
  'banda aceh', 'bandar lampung', 'jambi', 'bengkulu',
  // Kalimantan
  'balikpapan', 'samarinda', 'pontianak', 'banjarmasin',
  // Sulawesi
  'makassar', 'manado', 'palu', 'kendari', 'gorontalo',
  // Lainnya
  'ambon', 'jayapura', 'sorong', 'kupang',
];

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
    const found = INDONESIA_LOCATIONS.find(loc =>
      candidate.includes(loc) || loc.includes(candidate.substring(0, 8))
    );
    if (found) return found;
  }

  // Cek langsung nama kota dalam pesan
  for (const loc of INDONESIA_LOCATIONS) {
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
  if (lower.match(/\b(kost|kos|kosan|boarding)\b/i))           return 'boarding_house';
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

  if (lower.match(/\b(sewa|rental|ngontrak|kontrak|disewakan|kost|kos|boarding|rent|lease)\b/i)) return 'rent';
  if (lower.match(/\b(beli|jual|dijual|purchase|buy|sell|kpr|inden|dp|cicilan|over kredit)\b/i)) return 'sale';

  return '';
}

/* ══════════════════════════════════════════════════════════════════════════════
   6. CONTEXT CONTINUATION — Deteksi jawaban singkat sebagai lanjutan properti
══════════════════════════════════════════════════════════════════════════════ */

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

  // Pesan terlalu panjang → kemungkinan topik baru, bukan jawaban singkat
  if (lower.length > 70) return false;

  // ── Cek apakah pesan memperkenalkan topik NON-PROPERTY yang jelas ───────
  const CLEAR_NON_PROPERTY = [
    /\b(makanan|minuman|kuliner|restoran|cafe|kafe|masak|resep|menu)\b/,
    /\b(kendaraan|mobil|motor|sepeda|tiket|travel|wisata|hotel liburan|penginapan wisata)\b/,
    /\b(elektronik|laptop|hp|handphone|gadget|komputer|printer)\b/,
    /\b(pakaian|baju|sepatu|tas|fashion|belanja online)\b/,
    /\b(obat|dokter|sakit|rumah sakit|klinik kesehatan|apotik)\b/,
  ];
  for (const pattern of CLEAR_NON_PROPERTY) {
    if (pattern.test(lower)) return false;
  }

  // ── Periksa 5 pesan terakhir apakah ada konteks properti ─────────────────
  const recentHistory   = history.slice(-6);
  const hasPropertyCtx  = recentHistory.some(item => hasPropertyKeyword(item.message || ''));
  if (!hasPropertyCtx) return false;

  // ── Periksa apakah pesan AI terakhir berisi pertanyaan tentang properti ──
  const lastAIMessages = recentHistory
    .filter(item => item.role === 'ai' || item.role === 'assistant')
    .slice(-2);

  const PROPERTY_QUESTION_PATTERNS = [
    /sewa\s+atau\s+beli/,
    /beli\s+atau\s+sewa/,
    /rent\s+or\s+buy/,
    /kisaran\s+harga/,
    /budget/,
    /harga\s+berapa/,
    /berapa\s+harga/,
    /di\s+kota\s+(apa|mana)/,
    /lokasi\s+(apa|mana|yang|di)/,
    /area\s+(mana|apa)/,
    /wilayah\s+(mana|apa)/,
    /tipe\s+properti/,
    /jenis\s+properti/,
    /furnished|furnish/,
    /kamar\s+(tidur|mandi)/,
    /berapa\s+kamar/,
    /luas\s+(berapa|bangunan|tanah)/,
    /fasilitas\s+(apa|yang)/,
    /kapan\s+(masuk|pindah|rencan)/,
    /bulan\s+apa/,
    /ada\s+yang\s+ingin.*tanyakan/,
    /masih\s+(ada|butuh|perlu)/,
    /selain\s+itu/,
  ];

  const hasRecentPropertyQuestion = lastAIMessages.some(item => {
    const msg = (item.message || '').toLowerCase();
    return PROPERTY_QUESTION_PATTERNS.some(p => p.test(msg));
  });

  if (!hasRecentPropertyQuestion) return false;

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
  for (const loc of INDONESIA_LOCATIONS) {
    if (lower.includes(loc)) return true;
  }
  if (/\b(di\s+\w+)\b/.test(lower)) return true;  // "di jakarta", "di mana saja"

  // 4) Jawaban singkat afirmatif / negatif dalam konteks
  if (/^(ya|iya|ok|oke|siap|boleh|bisa|setuju|oke\s+dong|iya\s+dong|baik|baik\s+sekali|lanjut|kasih\s+list|tampilkan|rekomendasikan|show|lihat)$/.test(lower))
    return true;
  if (/^(tidak|belum|ga|gak|nggak|ngga|blum|blom|enggak|tidak\s+dulu|belum\s+ada|nanti)$/.test(lower))
    return true;

  // 5) Jawaban spesifikasi properti (luas, kamar, furnishing, dll)
  if (/\b(furnished|unfurnished|kosong|semi|ac|wifi|parkir|garasi|kolam|renang)\b/.test(lower))
    return true;
  if (/\b(\d+\s*(kamar|km|lt|lb|m2|meter|lantai))\b/.test(lower))
    return true;
  if (/\b(besar|kecil|luas|sempit|bagus|mewah|sederhana|ekonomis|murah|mahal)\b/.test(lower))
    return true;

  // 6) Angka murni (kemungkinan jawaban harga atau ukuran)
  if (/^\d+[\d.,]*$/.test(lower.trim()))
    return true;

  return false;
}

module.exports = {
  hasPropertyKeyword,
  isPropertyContextContinuation,
  extractLocationFromMessage,
  extractPropertyTypeFromMessage,
  extractTransactionTypeFromMessage,
  PROPERTY_TYPES,
  STANDALONE_KEYWORDS,
  INDONESIA_LOCATIONS,
};

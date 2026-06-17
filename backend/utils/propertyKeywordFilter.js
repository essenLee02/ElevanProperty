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
  // Perubahan / koreksi pencarian — "ganti villa", "ubah ke rumah", "ralat apartemen"
  // Hanya valid BERSAMA tipe properti (tidak bisa standalone)
  'ganti', 'ubah', 'ralat', 'cancel', 'batal', 'edit',

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

// Pola pertanyaan properti dari AI (Q1–Q12 + Q_FAC). Jika pesan AI TERAKHIR cocok
// salah satu pola ini, percakapan jelas sedang in-flow → cukup sebagai konteks
// properti walau kata TIPE (apartemen/villa/…) sudah keluar dari window pesan.
// Module-level agar tidak dibuat ulang tiap panggilan + bisa dipakai sebelum gate.
const PROPERTY_QUESTION_PATTERNS = [
  // ── Bahasa Indonesia ──────────────────────────────────────────────────────
  /sewa\s+atau\s+beli/, /beli\s+atau\s+sewa/, /kisaran\s+harga/, /budget/,
  /harga\s+berapa/, /berapa\s+harga/, /di\s+kota\s+(apa|mana)/,
  /lokasi\s+(apa|mana|yang|di)/, /area\s+(mana|apa)/, /wilayah\s+(mana|apa)/,
  /tipe\s+properti/, /jenis\s+properti/, /furnished|furnish|furnitur/,
  /kamar\s+(tidur|mandi)/, /berapa\s+kamar/, /luas\s+(berapa|bangunan|tanah)/,
  /fasilitas\s+(apa|yang|tertentu|tambahan|khusus|wajib)/, /ada\s+fasilitas/,
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
  // ── Q9 decision maker ───────────────────────────────────────────────────────
  /jadwalkan\s+viewing/, /perlu\s+koordinasi/, /koordinasi\s+dulu/, /keluarga\s+lain/,
  /schedule\s+(a\s+)?viewing/, /check\s+with\s+(family|spouse|partner)/,
  // ── Q12 apartment tower / floor ─────────────────────────────────────────────
  /tower\s+atau\s+lantai/, /preferensi\s+tower/, /lantai\s+(rendah|tinggi|tertentu|berapa)/,
  /tower\s+or\s+floor/, /floor\s+(prefer|choice)/,
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

  // ── Deteksi konten properti sebelum cek panjang ───────────────────────────
  // Jawaban Q2b ("Sudah lihat berapa properti?") dan Q5/Q6 bisa panjang dan
  // berisi fasilitas / landmark. Contoh valid yang harus LOLOS:
  //   "saya ingin ada fasilitas gym dan kolam renangnya, lalu dekat dengan PTC"
  //   "hadap timur, tidak mau dekat jalan tol, ada taman bermain untuk anak"
  const hasPropertyFacility = /\b(fasilitas|gym|fitness|kolam\s*renang|kolam|renang|parkir|garasi|carport|taman|playground|play\s*ground|kids?\s*zone|kids?\s*club|keamanan|cctv|ac|wifi|internet|lift|elevator|rooftop|balkon|balcony|view|pemandangan|clubhouse|sport|olahraga|water\s*heater|mushola|jogging)\b/i.test(lower);
  const isLandmarkAnswer    = /\b(dekat|deket|near|close\s+to|di\s+jalan|di\s+sekitar|samping|next\s+to|beside|sebelah)\b/i.test(lower);
  const hasPropertyContent  = hasPropertyFacility || isLandmarkAnswer;

  // Pesan pendek (≤ 70 karakter) → proses normal
  // Pesan medium (71–200) dengan konten properti → masih bisa jawaban Q2b/Q5/Q6
  // Pesan sangat panjang (> 200) → selalu topik baru, bukan continuation
  if (!hasPropertyContent && lower.length > 70) return false;
  if (lower.length > 200) return false;

  // ── Cek apakah pesan memperkenalkan topik NON-PROPERTY yang jelas ───────
  // Skip jika sudah terdeteksi sebagai landmark/facility answer
  if (!isLandmarkAnswer && !hasPropertyFacility) {
    const CLEAR_NON_PROPERTY = [
      /\b(makanan|minuman|kuliner|restoran|cafe|kafe|masak|resep|menu|makan|bakso|mie|nasi|ayam|sate|soto|jajan|ngopi|kopi|camilan|gorengan|warteg)\b/,
      /\b(kendaraan|mobil|motor|sepeda|tiket|travel|wisata|hotel liburan|penginapan wisata)\b/,
      /\b(elektronik|laptop|hp|handphone|gadget|komputer|printer)\b/,
      /\b(pakaian|baju|sepatu|tas|fashion|belanja online)\b/,
      /\b(obat|dokter|sakit|rumah sakit|klinik kesehatan|apotik)\b/,
    ];
    for (const pattern of CLEAR_NON_PROPERTY) {
      if (pattern.test(lower)) return false;
    }
  }

  // ── Periksa 5 pesan terakhir apakah ada konteks properti ─────────────────
  const recentHistory   = history.slice(-6);

  // ── PRIORITY fast paths — sebelum cek hasPropertyCtx ─────────────────────
  // Pola ini sangat spesifik sebagai jawaban Q10 (durasi sewa), sehingga aman
  // dilewatkan bahkan jika AI message belum tersimpan ke DB (race condition).
  // Syarat: sudah ada minimal 2 pesan sebelumnya (percakapan sudah dimulai).
  //
  // Contoh kasus: customer jawab "1 tahun" untuk Q10 "Rencananya sewa berapa lama?"
  // tapi pesan AI belum tersimpan → hasPropertyCtx = false → tanpa fix ini,
  // "1 tahun" difilter sebagai "bukan query properti".
  if (recentHistory.length >= 2) {
    // Durasi sewa singkat — jawaban Q10 ("1 tahun", "6 bulan", "2 bulan", "3 months")
    if (/^\d+\s*(tahun|year|bulan|month)s?$/.test(lower.trim())) return true;

    // Fasilitas / patokan lokasi (Q_FAC / Q6) — konten properti yang kuat.
    // AMAN walau kata TIPE properti (villa/rumah/dll) sudah keluar dari window 6 pesan
    // terakhir di percakapan panjang — yang membuat hasPropertyCtx di bawah jadi false
    // dan men-drop jawaban yang valid. Contoh:
    //   "AC, kolam renang, kids zone, gym.. deket restoran/rumah makan"
    // Percakapan sudah berjalan (≥2 pesan) → ini pasti lanjutan kualifikasi.
    if (hasPropertyContent) return true;
  }

  // Context = a property keyword in recent history OR (crucially) the LAST AI message
  // being a property question. The latter keeps long flows alive: by the time the
  // customer answers furnishing/budget/date, the property TYPE word has scrolled out
  // of the window, so hasPropertyCtx alone would be false and the answer dropped.
  const hasPropertyCtx        = recentHistory.some(item => hasPropertyKeyword(item.message || ''));
  const hasRecentPropertyQ    = hasRecentPropertyQuestionIn(recentHistory);
  if (!hasPropertyCtx && !hasRecentPropertyQ) return false;

  // ── Fast path: Jawaban yang SANGAT jelas sebagai lanjutan — tidak perlu cek AI question ──
  // Ini menghindari race condition di mana AI message belum tersimpan ke DB.
  //
  // Bulan Bahasa Indonesia ("Juni 2026", "Januari", "bulan depan Maret")
  if (/\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i.test(lower)) return true;
  // Bulan Bahasa Inggris
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(lower)) return true;
  // Tahun referensi (e.g. "Juni 2026", "2027", "tahun depan 2027")
  if (/\b(202[4-9]|203[0-9])\b/.test(lower)) return true;
  // Jawaban tipe transaksi murni (satu kata / frasa pendek)
  if (/^(sewa|beli|jual|beli\s+aja|mau\s+sewa|mau\s+beli|untuk\s+sewa|untuk\s+beli|rent|buy|purchase)$/.test(lower.trim())) return true;
  // Durasi sewa singkat — juga cek di sini (setelah hasPropertyCtx) untuk kelengkapan
  if (/^\d+\s*(tahun|year|bulan|month)s?$/.test(lower.trim())) return true;
  // Harga dengan satuan — jawaban Q3 ("2-4 juta/seminggu", "5 jt per bulan")
  if (/\b\d[\d.,]*\s*(juta|ribu|miliar|rb|jt)\b/i.test(lower)) return true;
  // Q2b answer fast-path: "Saya belum pernah lihat", "sudah lihat 3", "belum pernah survey"
  // These are ALWAYS Q2b answers and must pass even before hasRecentPropertyQuestion check.
  if (/\b(belum\s+pernah\s+lihat|pernah\s+lihat|sudah\s+lihat\s+\d|belum\s+lihat|sudah\s+survey|belum\s+ada\s+yang\s+cocok|belum\s+pernah\s+survey)\b/i.test(lower)) return true;

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

  // 7) Jawaban bulan/tahun masuk — menjawab pertanyaan move-in date
  if (/\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i.test(lower))
    return true;
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(lower))
    return true;
  // Referensi tahun (e.g. "Juni 2026", "next year 2027")
  if (/\b(202[4-9]|203[0-9])\b/.test(lower))
    return true;

  // 8) Durasi sewa singkat (jawaban Q10)
  if (/\b(\d+\s*(tahun|year|bulan|month)s?)\b/i.test(lower))
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

  // 12) Jawaban fleksibel / tidak ada preferensi (valid untuk Q5/Q6/Q7/Q11)
  //     "bebas saja", "terserah", "tidak ada preferensi", "tidak masalah", "flexible"
  if (/\b(bebas|fleksibel|flexible|terserah|tidak\s+masalah|ga\s+masalah|tidak\s+ada\s+preferensi|no\s+preference|whatever)\b/i.test(lower))
    return true;

  // 13) Jawaban negatif singkat — "tidak ada", "ga mau", "nggak mau", "tidak perlu", dll.
  //     Perlu ada history property context (sudah dicek di atas)
  if (/^(tidak|ga|gak|ngga|enggak|nggak|no)\s*(ada|masalah|preferensi|mau|perlu|usah|ingin|bisa|boleh|apa|tahu)?$/i.test(lower.trim()))
    return true;
  // Negasi pendek ≤ 30 chars — mencakup "tidak mau deh", "ga mau ke sana", dll.
  if (lower.length <= 30 && /^(tidak|ga|gak|ngga|enggak|nggak)\b/.test(lower.trim()))
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

  // 16) ── FINAL FALLBACK ──────────────────────────────────────────────────────
  //     Sampai titik ini sudah terbukti: (a) ada konteks properti di history,
  //     (b) pesan AI terakhir adalah PERTANYAAN properti, (c) pesan bukan topik
  //     non-properti (CLEAR_NON_PROPERTY sudah dicek di atas). Maka balasan PENDEK
  //     (≤ 70 char) yang diawali "mau/ingin/prefer/yang/butuh/jangan/hindari" pasti
  //     jawaban atas pertanyaan itu (mis. "Saya mau jalan raya lebar", "yang tenang").
  //     Ini mencegah jawaban kualifikasi yang sah ter-drop hanya karena tidak match
  //     salah satu pola spesifik di atas.
  if (lower.length <= 70 &&
      /^(saya\s+)?(mau|ingin|pengen|prefer|butuh|perlu|suka|lebih\s+suka|maunya|yang|jangan|hindari|tidak\s+mau|gak\s+mau|ga\s+mau|nggak\s+mau)\b/i.test(lower.trim()))
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

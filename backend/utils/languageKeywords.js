/**
 * languageKeywords.js
 *
 * Keyword banks used by chatbotPrivateController.js's LanguageDetector to decide reply
 * language ('id'/'en') and to distinguish property vs off-topic messages. Moved out of
 * the controller into its own module so the class body isn't dominated by static data.
 */

// ── Indonesian keyword bank ──────────────────────────────────────────────
// Grouped for readability; all checked via text.includes() after normalize().
const INDONESIAN_WORDS = [
  // Core pronouns & intent
  'saya', 'aku', 'kamu', 'anda', 'mau', 'ingin', 'cari', 'tolong', 'mohon',
  'silakan', 'boleh', 'bisa', 'tidak', 'belum', 'sudah', 'pernah', 'ada',
  // Property types (ID)
  'rumah', 'vila', 'apartemen', 'kos', 'kost', 'kosan', 'indekos', 'ruko',
  'kantor', 'gudang', 'tanah', 'kavling', 'kaveling', 'lahan', 'properti',
  'mansion', 'kondotel', 'toko', 'warung', 'spbu', 'pabrik', 'klinik',
  // Transaction verbs (ID)
  'sewa', 'beli', 'jual', 'sewakan', 'menyewa', 'membeli', 'kontrakan',
  'kontrak', 'ngontrak', 'numpang',
  // Price & budget (ID)
  'harga', 'berapa', 'budget', 'badget', 'anggaran', 'biaya', 'bayar',
  'juta', 'ribu', 'miliar', 'rp', 'rupiah', 'dp', 'cicilan', 'kpr',
  'terjangkau', 'murah', 'ekonomis', 'hemat', 'mahal', 'mewah', 'premium',
  // Time / date (ID)
  'seminggu', 'sebulan', 'setahun', 'bulan', 'minggu', 'tahun', 'hari',
  'besok', 'lusa', 'segera', 'secepatnya', 'kapan', 'pindah', 'masuk',
  // Month names (ID)
  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
  // Location & place (ID)
  'di ', 'dekat', 'deket', 'sekitar', 'wilayah', 'area', 'daerah',
  'jalan', 'gang', 'perumahan', 'komplek', 'kawasan',
  // Location anchor / wisata (valid property context)
  'mangrove', 'wonorejo', 'kenjeran', 'pakuwon', 'citraland',
  'grand city', 'galaxy mall', 'tunjungan', 'ciputra', 'darmo',
  // Facilities (ID)
  'fasilitas', 'kamar', 'dapur', 'parkir', 'garasi', 'kolam', 'taman',
  'furnished', 'furnish', 'kosongan', 'perabot',
  // Household composition / Q4 answers (ID)
  'sendiri', 'sendiran', 'sendirian', 'tinggal', 'bersama', 'istri', 'suami',
  'anak', 'orangtua', 'orang tua', 'keluarga', 'ayah', 'ibu', 'berdua',
  'bertiga', 'berempat', 'pasangan',
  // Qualifier words (ID)
  'rekomendasi', 'saran', 'pilihan', 'cek', 'lihat', 'tunjukkan', 'bantu',
  'cocok', 'sesuai', 'bagus', 'bagaimana', 'gimana', 'gimana',
  // Common informal conjunctions / fillers (confirms Indonesian)
  'aja', 'nih', 'dong', 'sih', 'deh', 'lah', 'yuk', 'yah', 'udah', 'udah',
  'kayak', 'kayaknya', 'kira-kira', 'kira kira', 'emang', 'memang',
];

// ── US English indicator patterns ────────────────────────────────────────
// Used to distinguish clearly English messages and lock language = 'en'.
const US_ENGLISH_PATTERNS = [
  /\bi\s+(want|need|am\s+looking|would\s+like|am\s+searching|am\s+interested)\b/i,
  /\b(i'm|i've|i'd|i'll|i'm|we're|we've|we'd)\b/i,
  /\b(can\s+you|could\s+you|please|kindly|looking\s+for|show\s+me)\b/i,
  /\b(how\s+much|what'?s\s+the\s+price|do\s+you\s+have|any\s+available)\b/i,
  /\b(bedroom|bathroom|living\s+room|studio|lease|monthly|yearly|per\s+month)\b/i,
  /\b(affordable|budget-friendly|spacious|furnished|unfurnished|move[\s-]in)\b/i,
  /\b(neighborhood|nearby|within\s+\d|close\s+to|walking\s+distance)\b/i,
  /\b(price\s+range|square\s+feet|sq\.?\s*ft|sqm|square\s+meter)\b/i,
  /\b(east\s+java|west\s+java|central\s+java|bali|jakarta|surabaya)\b.*\b(house|villa|apt|apartment)\b/i,
  /\b(rent|buy|purchase|sell|sale)\b.{0,30}\b(house|villa|apartment|property)\b/i,
];

/** Keywords for clearly off-topic subjects (non-property domains) */
const OFF_TOPIC_WORDS = [
  // ── Kuliner & Makanan (Food & Drinks) ─────────────────────────────────────
  'kuliner', 'makanan', 'masakan', 'resep masak', 'memasak',
  'bebek', 'ayam goreng', 'bakso', 'soto', 'rendang', 'nasi goreng',
  'restaurant', 'restoran', 'cafe', 'kafe', 'warung makan',
  'snack', 'camilan', 'keripik', 'coklat', 'permen', 'biskuit',
  'buah-buahan', 'mangga', 'pisang', 'durian', 'sayuran', 'wortel',
  'daging sapi', 'daging ayam', 'steak', 'barbeque', 'seafood masak',
  'kopi', 'teh', 'madu', 'boba', 'bubble tea',
  'bir', 'beer', 'wine', 'whisky', 'cocktail', 'alkohol', 'minuman keras',
  // ── Film, Musik & Hiburan (Entertainment) ─────────────────────────────────
  'film', 'movie', 'bioskop', 'sinema', 'netflix', 'streaming video',
  'serial tv', 'episode serial', 'trailer film', 'nonton film',
  'musik', 'music', 'konser', 'lagu', 'album musik',
  'game online', 'video game', 'gaming', 'esports', 'playstation', 'xbox', 'nintendo',
  'karaoke', 'club malam', 'dugem', 'pesta malam',
  // ── Olahraga & Aktivitas Fisik (Sports & Physical Activities) ─────────────
  'olahraga', 'sports', 'sepak bola', 'futsal', 'basket', 'badminton',
  'tenis', 'lari pagi', 'maraton', 'liga', 'pertandingan', 'stadion',
  'hiking', 'mendaki', 'pendakian', 'trekking', 'berkemah', 'jalur pendakian',
  'memancing', 'fishing', 'pancing ikan', 'kolam pemancingan',
  'pertarungan', 'baku hantam', 'boxing', 'ufc', 'mma',
  'lomba', 'kompetisi olahraga', 'turnamen',
  // ── Wisata & Perjalanan (Travel & Tourism) ─────────────────────────────────
  'wisata', 'tourism', 'tourist', 'travelling', 'traveling', 'backpacker',
  'tiket pesawat', 'itinerary', 'destinasi wisata', 'paket wisata', 'tur wisata',
  'pantai', 'beach', 'surfing', 'snorkeling', 'diving',
  'kebun binatang', 'zoo', 'candi', 'borobudur', 'prambanan',
  'kuil', 'vihara', 'pura',
  // ── Pendidikan & Ilmu Pengetahuan (Education & Science) ───────────────────
  'pendidikan', 'education', 'sekolah', 'universitas',
  'kuliah', 'semester', 'ujian sekolah', 'skripsi', 'beasiswa', 'pelajar',
  'biologi', 'fotosintesis', 'genetika',
  'fisika', 'gravitasi', 'quantum', 'fisika nuklir',
  'sains', 'penelitian ilmiah', 'laboratorium', 'eksperimen',
  'sejarah', 'arkeologi', 'peninggalan sejarah',
  // ── Politik & Konflik (Politics & Conflict) ────────────────────────────────
  'politik', 'politics', 'pemilu', 'pilpres', 'partai politik', 'kampanye politik',
  'kondisi ekonomi', 'inflasi', 'gdp', 'pertumbuhan ekonomi',
  'perang', 'konflik bersenjata', 'militer tempur', 'pasukan perang', 'senjata api',
  // ── Teknologi & Komputer (Technology & Computing) ─────────────────────────
  'komputer', 'laptop', 'gadget', 'hardware komputer', 'spesifikasi laptop',
  'coding', 'programming', 'pemrograman', 'javascript', 'python',
  'html', 'css', 'debugging', 'algoritma', 'source code', 'github',
  'robot', 'robotika', 'drone',
  'blockchain', 'nft', 'defi', 'web3', 'metaverse',
  'forex', 'foreign exchange', 'mata uang asing', 'kurs valuta',
  'crypto', 'saham', 'stock', 'trading saham', 'day trading', 'reksa dana',
  'komoditas', 'commodity', 'crude oil', 'perdagangan internasional',
  // ── Sosial Media & Kehidupan Pribadi (Social & Personal Life) ─────────────
  'instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'snapchat',
  'follower', 'viral media', 'konten kreator', 'influencer', 'sosial media',
  'kencan', 'tinder', 'bumble', 'jomblo', 'gebetan', 'pdkt',
  'romantis', 'percintaan', 'patah hati', 'putus cinta',
  'ulang tahun pesta', 'pesta ulang', 'acara pesta',
  'rokok', 'merokok', 'nikotin', 'vape', 'elektrik rokok',
  // ── Kesehatan & Kedokteran (Health & Medicine) ────────────────────────────
  'kesehatan umum', 'dokter spesialis', 'penyakit', 'gejala sakit', 'diagnosa',
  'kedokteran', 'obat-obatan', 'resep dokter', 'klinik kesehatan',
  'rumah sakit', 'hospital',
  // ── Hewan & Alam (Animals & Nature) ──────────────────────────────────────
  'hewan peliharaan', 'anjing', 'kucing', 'hamster', 'kelinci',
  'hewan liar', 'singa', 'harimau', 'gajah', 'buaya',
  'hutan rimba', 'satwa liar', 'ekosistem alam',
  // ── Profesi & Pekerjaan Spesifik (Specific Professions) ──────────────────
  'tukang ledeng', 'plumber', 'pipa bocor', 'saluran air bocor',
  'tukang kayu', 'carpenter', 'tukang bangunan lepas',
  'insinyur mesin', 'teknik mesin', 'teknik elektro',
  'lowongan kerja', 'loker', 'rekrutmen', 'gaji karyawan', 'karir profesional',
  'menerjemahkan', 'penerjemah', 'jasa terjemahan',
  // ── Seni, Desain & Kreativitas (Arts, Design & Creativity) ───────────────
  'desain grafis', 'graphic design', 'logo design', 'photoshop', 'figma',
  'menggambar', 'melukis', 'lukisan', 'ilustrasi', 'sketsa',
  'fashion model', 'model fotografi', 'catwalk', '3d modeling',
  'mainan', 'toy', 'action figure', 'lego',
  'boneka', 'wayang', 'sihir', 'sulap', 'santet', 'dukun', 'mistis',
  // ── Agama & Spiritual (Religion & Spirituality) ──────────────────────────
  'dewa-dewi', 'teologi', 'ibadah agama',
  // ── Transportasi & Logistik (Transportation & Logistics) ─────────────────
  'beli mobil', 'kredit mobil', 'mobil baru', 'motor baru', 'beli motor',
  'angkutan barang', 'freight', 'logistik', 'jasa angkut barang',
  'pengiriman barang', 'jasa kurir', 'ekspedisi barang',
  // ── Belanja & E-commerce (Shopping & E-commerce) ─────────────────────────
  'belanja online', 'tokopedia', 'shopee', 'lazada', 'bukalapak',
  'e-commerce', 'marketplace online',
  // ── Lain-lain (Miscellaneous) ─────────────────────────────────────────────
  'cuaca', 'weather', 'ramalan cuaca',
  'pembunuhan', 'kasus kriminal', 'polisi kriminal',
  'cucian piring', 'cuci piring', 'cucian baju',
  'perpustakaan', 'library', 'arsip buku',
  'elektronik', 'handphone', 'smartphone',
  'biologi', 'kimia pelajaran', 'fisika pelajaran',
];

/** Keywords that anchor a message to the property domain */
const PROPERTY_WORDS = [
  'property', 'properti', 'rumah', 'house', 'home', 'villa', 'vila', 'hotel',
  'apartment', 'apartemen', 'kos', 'kost', 'boarding', 'ruko', 'shophouse',
  'office', 'kantor', 'warehouse', 'gudang', 'sewa', 'rent', 'rental',
  'beli', 'buy', 'purchase', 'jual', 'sale', 'sell', 'kontrak', 'kontrakan',
  'tanah', 'land', 'investasi',
  // Extended property types
  'mansion', 'kondotel', 'condotel', 'toko', 'store', 'retail',
  'kavling', 'lahan', 'pabrik', 'klinik', 'spbu',
  // Household composition (Q4 property-related qualifier)
  'kamar', 'bedroom', 'furnished', 'furnish', 'fasilitas', 'facilities',
  'tinggal', 'sendiri', 'keluarga', 'family', 'masuk', 'pindah', 'move',
];

module.exports = { INDONESIAN_WORDS, US_ENGLISH_PATTERNS, OFF_TOPIC_WORDS, PROPERTY_WORDS };

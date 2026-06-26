/**
 * chatbotPrivateController.js
 *
 * Fallback chatbot controller — activated when ChatGPT and Claude are both unavailable.
 * Provides property recommendations sourced from Rumah123 live data and the static catalog.
 *
 * Architecture:
 *  LanguageDetector   — detect reply language and property/off-topic intent from user text
 *  PropertyFormatter  — pure static methods that format property objects into markdown strings
 *  ResponseBuilder    — assembles full reply strings from formatted sections (language-aware)
 *  ChatbotPrivateService — orchestrates data fetching and response generation
 */

const { validateChatbotMessage }              = require('../services/validationService');
const { findOrCreateSession,
        getConversationHistory,
        saveUserMessage,
        saveAssistantMessage }                = require('../services/sessionService');
const { buildRecommendationContextForLLM,
        extractPropertyFilters,
        getVisibleMatchesFromAlternatives,
        stripCommercialUsePhrases,
        detectCommercialUse,
        detectUseCase,
        isNonResidentialUse,
        useCaseLabel,
        searchProperties }                    = require('../services/propertyRecommendationService');
const { getRumah123Listings,
        mapBuildingTypeToApify,
        mapTransactionTypeToApify }           = require('../services/rumah123ContextService');
const { loadResponseSkillPrompt,
        getSkillRegistryStatus }              = require('../services/skillPromptService');
const { hasPropertyKeyword,
        isPropertyContextContinuation }       = require('../utils/propertyKeywordFilter');
const { extractQualificationState }           = require('../services/aiPromptBuilderService');

// ─── LanguageDetector ─────────────────────────────────────────────────────────

class LanguageDetector {
  // ── Indonesian keyword bank ──────────────────────────────────────────────
  // Grouped for readability; all checked via text.includes() after normalize().
  static #INDONESIAN_WORDS = [
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
  static #US_ENGLISH_PATTERNS = [
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
  static #OFF_TOPIC_WORDS = [
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
  static #PROPERTY_WORDS = [
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

  /**
   * Lowercase + trim a string for keyword matching.
   */
  static #normalize(text = '') {
    return String(text || '').toLowerCase().trim();
  }

  /**
   * Detect the reply language from the user's latest message.
   *
   * Strategy:
   *  1. If the message contains clear Indonesian keywords → 'id'
   *  2. If the message matches clear US/British English patterns → 'en'
   *  3. Ambiguous short answer (number, date, yes/no) → fall back to
   *     the last 4 customer messages in history
   *  4. Default → 'en'
   *
   * The return value drives template strings (Q1-Q12 questions, summary brief).
   * The AI provider receives the full language instruction in the system prompt
   * and handles 30+ language responses natively.
   *
   * @param {string}  message
   * @param {Array}   history - conversation history [{role, message}]
   * @returns {'id'|'en'}
   */
  static detect(message = '', history = []) {
    const text = this.#normalize(message);

    // 1. Indonesian signals — check substring keywords
    if (this.#INDONESIAN_WORDS.some(word => text.includes(word))) return 'id';

    // 2. Clear US/British English signals — regex patterns
    if (this.#US_ENGLISH_PATTERNS.some(re => re.test(text))) return 'en';

    // 3. Ambiguous — fall back to history (last 4 customer messages)
    if (Array.isArray(history) && history.length > 0) {
      const recent = history
        .filter(h => h.role === 'user' || h.role === 'customer')
        .slice(-4)
        .map(h => this.#normalize(h.message || ''));

      // Indonesian found in history → stay Indonesian
      if (recent.some(msg => this.#INDONESIAN_WORDS.some(w => msg.includes(w)))) return 'id';
      // English pattern found in history → stay English
      if (recent.some(msg => this.#US_ENGLISH_PATTERNS.some(re => re.test(msg)))) return 'en';
    }

    // 4. Default to English (LLM will still handle other languages via system prompt)
    return 'en';
  }

  /**
   * Return true when the message appears to be entirely off-topic
   * (contains off-topic keywords AND no property keywords).
   *
   * @param {string} message
   * @returns {boolean}
   */
  static isOffTopic(message = '') {
    const text = this.#normalize(message);
    // Landmark/anchor answers (Q6) use place names that may appear in OFF_TOPIC_WORDS.
    // "dekat cafe", "dekat restoran", "di jalan Dukuh Kupang" are valid Q6 answers —
    // never block them as off-topic even if "cafe" / "restoran" is in the off-topic list.
    const isLandmarkAnswer = /\b(dekat|deket|near|di\s+jalan|di\s+sekitar|samping|next\s+to|beside)\b/.test(text);
    if (isLandmarkAnswer) return false;

    // Developer/tech keyword lists: 8+ hyphenated-word tokens AND no property words.
    // Pattern: "memory-management search-strategy build-dashboard incident-response
    // system-design crm-maintenance customer-pulse-check ..." (>= 8 hyphenated tokens).
    // Property answers ("semi-furnished, garden-view, near-station") rarely exceed 7.
    const hyphenTokens = (text.match(/\b\w+-\w+\b/g) || []);
    if (hyphenTokens.length >= 8 && !this.#PROPERTY_WORDS.some(w => text.includes(w))) return true;

    return (
      this.#OFF_TOPIC_WORDS.some(w => text.includes(w)) &&
      !this.#PROPERTY_WORDS.some(w => text.includes(w))
    );
  }

  /**
   * Return true when the message or extracted filters indicate clear property intent.
   * Uses advanced propertyKeywordFilter untuk deteksi akurat (tipe properti + aksi).
   *
   * @param {string} message
   * @param {object} filters  - Extracted filters from propertyRecommendationService
   * @returns {boolean}
   */
  static hasPropertyIntent(message = '', filters = {}, history = []) {
    // Check 1: Extracted filters dari recommendation service
    if (filters.transactionType || filters.buildingType || filters.location || filters.budget) {
      return true;
    }

    // Check 2: Advanced keyword filter (propertyKeywordFilter.js)
    //          Deteksi: (Tipe Properti + Aksi) ATAU Kata Kunci Mandiri
    if (hasPropertyKeyword(message)) {
      return true;
    }

    // Check 3: Short continuation answers ("tidak mau", "terserah", "sendirian", dll.)
    //          Valid only when there is recent property context in history
    if (history.length > 0 && isPropertyContextContinuation(message, history)) {
      return true;
    }

    // Check 4: Fallback ke regex untuk backward compatibility
    return /saran|rekomendasi|recommend|pilihan|opsi|cari|mau|ingin|butuh|need|find|ada apa|apa saja/i.test(message);
  }
}

// ─── PropertyFormatter ────────────────────────────────────────────────────────

class PropertyFormatter {
  /**
   * Build a readable location string from district, city/location, and province fields.
   *
   * @param {object} item - Property object with optional location fields
   * @returns {string}
   */
  static formatLocation(item = {}) {
    return [item.district, item.city || item.location, item.province]
      .filter(Boolean).join(', ') || '-';
  }

  /**
   * Format a facilities value — normalises both array and string inputs.
   *
   * @param {string|string[]} value
   * @returns {string}
   */
  static formatFacilities(value = '') {
    if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '-';
    return String(value || '-');
  }

  /**
   * Build a wa.me deep-link from a raw phone number string.
   * Strips all non-digit characters before constructing the URL.
   *
   * @param {string} phone
   * @returns {string|null} WhatsApp URL, or null when phone is empty
   */
  static buildWaLink(phone = '') {
    const digits = String(phone).replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  }

  /**
   * Human-readable building type label, localised to the given language.
   *
   * @param {string} type - Internal building type key
   * @param {'id'|'en'} lang
   * @returns {string}
   */
  static humanBuildingType(type = '', lang = 'en') {
    const MAP = {
      house:          lang === 'id' ? 'Rumah'               : 'House',
      apartment:      lang === 'id' ? 'Apartemen'           : 'Apartment',
      hotel:          'Hotel',
      villa:          'Villa',
      boarding_house: lang === 'id' ? 'Kos-Kosan'           : 'Boarding House',
      shophouse:      lang === 'id' ? 'Ruko'                : 'Shophouse',
      office:         lang === 'id' ? 'Kantor'              : 'Office',
      warehouse:      lang === 'id' ? 'Gudang'              : 'Warehouse',
      store:          lang === 'id' ? 'Toko'                : 'Store',
      mansion:        lang === 'id' ? 'Mansion / Rumah Mewah': 'Mansion',
      kondotel:       lang === 'id' ? 'Kondotel'            : 'Condotel',
      others:         lang === 'id' ? 'Properti Lainnya'    : 'Other Property',
    };
    return MAP[type] || type || (lang === 'id' ? 'Properti' : 'Property');
  }

  /**
   * Human-readable transaction type label, localised to the given language.
   *
   * @param {string} type - Internal transaction type key
   * @param {'id'|'en'} lang
   * @returns {string}
   */
  static humanTransactionType(type = '', lang = 'en') {
    const MAP = {
      rent:     lang === 'id' ? 'Sewa'  : 'For Rent',
      sale:     lang === 'id' ? 'Dijual': 'For Sale',
      purchase: lang === 'id' ? 'Beli'  : 'For Purchase',
    };
    return MAP[type] || type || (lang === 'id' ? 'Tersedia' : 'Available');
  }

  /**
   * Format a single Rumah123 listing as a numbered markdown block.
   * Includes: image, location, price, type, specs, agent contact, and Rumah123 URL.
   * Any field that is empty or falsy is silently omitted.
   *
   * @param {object}   item  - Transformed Rumah123 listing
   * @param {number}   index - Zero-based list index (displayed as 1-based)
   * @param {'id'|'en'} lang
   * @returns {string}
   */
  static rumah123Item(item, index, lang = 'en') {
    const isId    = lang === 'id';
    const waLink  = this.buildWaLink(item.agentWhatsapp);
    const imgTag  = item.mediaUrls?.[0]
      ? `\n   ![${item.title || 'Properti'}](${item.mediaUrls[0]})`
      : '';

    const specs = [
      item.bedrooms  ? `🛏️ ${item.bedrooms} KT`  : null,
      item.bathrooms ? `🚿 ${item.bathrooms} KM` : null,
    ].filter(Boolean).join(' | ');

    const lines = [
      `${index + 1}. **${item.title || (isId ? 'Properti' : 'Property')}**${imgTag}`,
      `   📍 ${isId ? 'Lokasi'  : 'Location'}: ${this.formatLocation(item)}`,
      `   💰 ${isId ? 'Harga'   : 'Price'}: **${item.price || '-'}**`,
      `   🏠 ${isId ? 'Tipe'    : 'Type'}: ${item.propertyType || '-'} — ${item.listingType || '-'}`,
    ];

    if (item.buildingSize || item.landSize)
      lines.push(`   📐 ${isId ? 'Luas'      : 'Area'}: ${isId ? 'bangunan' : 'building'} ${item.buildingSize || '-'}m², ${isId ? 'tanah' : 'land'} ${item.landSize || '-'}m²`);
    if (specs)
      lines.push(`   ${specs}`);
    if (item.certificate)
      lines.push(`   📜 ${isId ? 'Sertifikat': 'Certificate'}: ${item.certificate}`);
    if (item.furnishing)
      lines.push(`   🛋️ ${isId ? 'Furnitur'  : 'Furnishing'}: ${item.furnishing}`);
    if (item.facilities)
      lines.push(`   🏷️ ${isId ? 'Fasilitas' : 'Facilities'}: ${item.facilities}`);
    if (item.agentName)
      lines.push(`   👤 ${isId ? 'Agen'      : 'Agent'}: **${item.agentName}**${item.agencyName ? ` (${item.agencyName})` : ''}`);
    if (waLink)
      lines.push(`   📱 WhatsApp: [${isId ? 'Chat Agen' : 'Contact Agent'}](${waLink})`);
    if (item.url)
      lines.push(`   🔗 [${isId ? 'Lihat di Rumah123' : 'View on Rumah123'}](${item.url})`);

    return lines.join('\n');
  }

  /**
   * Format a single static catalog property as a numbered markdown block.
   *
   * @param {object}   item  - Static catalog property
   * @param {number}   index - Zero-based list index
   * @param {'id'|'en'} lang
   * @returns {string}
   */
  static catalogItem(item, index, lang = 'en') {
    const isId   = lang === 'id';
    const imgTag = item.imageUrl
      ? `\n   ![${item.title || 'Properti'}](${item.imageUrl})`
      : '';

    return [
      `${index + 1}. **${item.title || (isId ? 'Properti' : 'Property')}**${imgTag}`,
      `   📍 ${isId ? 'Lokasi'    : 'Location'}: ${this.formatLocation(item)}`,
      `   💰 ${isId ? 'Harga'     : 'Price'}: **${item.price || '-'}**`,
      `   🏠 ${isId ? 'Tipe'      : 'Type'}: ${this.humanBuildingType(item.buildingType, lang)} — ${this.humanTransactionType(item.transactionType, lang)}`,
      `   📐 ${isId ? 'Luas'      : 'Area'}: ${isId ? 'bangunan' : 'building'} ${item.buildingArea || '-'}, ${isId ? 'tanah' : 'land'} ${item.landArea || '-'}`,
      `   🏷️ ${isId ? 'Fasilitas' : 'Facilities'}: ${this.formatFacilities(item.facilities)}`,
    ].join('\n');
  }

  /**
   * Format up to `limit` Rumah123 listings as a markdown list block.
   *
   * @param {object[]}  listings
   * @param {'id'|'en'} lang
   * @param {number}    limit     Maximum items to show (default: 20)
   * @returns {string}
   */
  static rumah123List(listings = [], lang = 'en', limit = 20) {
    return listings.slice(0, limit)
      .map((item, i) => this.rumah123Item(item, i, lang))
      .join('\n\n');
  }

  /**
   * Format up to `limit` catalog properties as a markdown list block.
   *
   * @param {object[]}  properties
   * @param {'id'|'en'} lang
   * @param {number}    limit     Maximum items to show (default: 6)
   * @returns {string}
   */
  static catalogList(properties = [], lang = 'en', limit = 6) {
    return properties.slice(0, limit)
      .map((item, i) => this.catalogItem(item, i, lang))
      .join('\n\n');
  }
}

// ─── ResponseBuilder ──────────────────────────────────────────────────────────

class ResponseBuilder {
  /** @type {'id'|'en'} */
  #lang;

  /**
   * @param {'id'|'en'} lang - Language for all generated reply strings
   */
  constructor(lang = 'en') {
    this.#lang = lang;
  }

  /**
   * Build a short human-readable summary of the requested property
   * (e.g. "Sewa Rumah Jakarta Selatan") from the extracted filter set.
   *
   * @param {object} filters - Extracted property filters
   * @returns {string}
   */
  #summarizeRequest(filters = {}) {
    const parts = [];
    if (filters.transactionType) parts.push(PropertyFormatter.humanTransactionType(filters.transactionType, this.#lang));
    if (filters.buildingType)    parts.push(PropertyFormatter.humanBuildingType(filters.buildingType, this.#lang));
    if (filters.location)        parts.push(filters.location);
    if (filters.budget?.text)    parts.push(filters.budget.text);
    return parts.length
      ? parts.join(' ')
      : (this.#lang === 'id' ? 'kebutuhan properti Anda' : 'your property request');
  }

  /**
   * Reply for messages not related to property (off-topic guard).
   * @returns {string}
   */
  offTopic() {
    return this.#lang === 'id'
      ? 'Maaf, saya hanya dapat membantu pertanyaan seputar jual, beli, atau sewa properti. Silakan tanyakan kebutuhan properti seperti rumah, villa, hotel, apartemen, kos-kosan, ruko, kantor, atau gudang yang ingin Anda cari.'
      : 'Sorry, I can only help with questions about buying, selling, or renting property. Please ask me about the property type, location, budget, or facilities you are looking for.';
  }

  /**
   * Reply asking the user to clarify their property intent.
   * @returns {string}
   */
  clarification() {
    return this.#lang === 'id'
      ? 'Boleh saya pastikan, Anda mencari properti untuk **sewa**, **beli**, atau **jual**? Silakan sebutkan juga lokasi dan budget agar saya bisa mencarikan pilihan terbaik dari Rumah123 dan katalog saya.'
      : 'May I confirm whether you are looking to **rent**, **buy**, or **sell** a property? You can also mention the location and budget so I can find the best options from Rumah123 and my catalog.';
  }

  /**
   * Build a reply showing Rumah123 live listings first, with optional catalog supplement.
   * Used when at least one data source has results.
   *
   * @param {object}   params
   * @param {object[]} params.rumah123Listings - Live Rumah123 results
   * @param {object[]} params.catalogMatches   - Static catalog exact matches
   * @param {object}   params.filters          - Extracted property filters
   * @returns {string}
   */
  exactMatch({ rumah123Listings = [], catalogMatches = [], filters = {} }) {
    const summary  = this.#summarizeRequest(filters);
    const hasR123  = rumah123Listings.length > 0;
    const hasCat   = catalogMatches.length > 0;
    const isId     = this.#lang === 'id';
    const lines    = [];

    if (hasR123) {
      const count = Math.min(rumah123Listings.length, 20);
      lines.push(isId
        ? `Berikut **${count} pilihan ${summary}** terbaik dari **Rumah123** (data terkini):\n`
        : `Here are the **top ${count} ${summary}** listings from **Rumah123** (live data):\n`
      );
      lines.push(PropertyFormatter.rumah123List(rumah123Listings, this.#lang, 20));
    }

    if (hasCat) {
      lines.push(hasR123
        ? (isId ? '\n---\n**Pilihan Lain dari Katalog Saya:**\n' : '\n---\n**More Options from My Catalog:**\n')
        : (isId ? `Berikut pilihan **${summary}** dari katalog properti saya:\n` : `Here are matching **${summary}** options from my catalog:\n`)
      );
      lines.push(PropertyFormatter.catalogList(catalogMatches, this.#lang, 6));
    }

    lines.push(isId
      ? '\n\nApakah ada yang ingin Anda tanyakan lebih lanjut tentang salah satu properti di atas?'
      : '\n\nWould you like more details on any of the listings above?'
    );

    return lines.join('\n');
  }

  /**
   * Build a reply for cases where only Rumah123 data is available
   * (no matching catalog entries).
   *
   * @param {object}   params
   * @param {object[]} params.rumah123Listings
   * @param {object}   params.filters
   * @returns {string}
   */
  rumah123Only({ rumah123Listings = [], filters = {} }) {
    const summary = this.#summarizeRequest(filters);
    const count   = Math.min(rumah123Listings.length, 20);
    const isId    = this.#lang === 'id';

    return [
      isId
        ? `Berikut **${count} pilihan ${summary}** terbaik langsung dari **Rumah123** (data terkini):\n`
        : `Here are the **top ${count} ${summary}** listings from **Rumah123** (live data):\n`,
      PropertyFormatter.rumah123List(rumah123Listings, this.#lang, 20),
      isId
        ? '\n\nIngin saya bantu cari lebih spesifik berdasarkan harga, fasilitas, atau area tertentu?'
        : '\n\nWould you like me to narrow down by price, facilities, or a specific area?',
    ].join('\n');
  }

  /**
   * Build a reply for cases with no exact catalog match.
   * Shows available Rumah123 listings and/or catalog alternatives.
   *
   * @param {object}   params
   * @param {object[]} params.alternatives    - Catalog alternatives (no exact match)
   * @param {object[]} params.rumah123Listings
   * @param {object}   params.filters
   * @returns {string}
   */
  /**
   * Filter alternatives to only include those matching the requested location.
   * CRITICAL: Ensures we never show properties from unrelated cities.
   *
   * @param {object[]} alternatives
   * @param {string}   location - The location the user requested
   * @returns {object[]} Filtered alternatives
   */
  #filterAlternativesByLocation(alternatives = [], location = '') {
    if (!location) return alternatives;

    const normLoc = location.toLowerCase().trim();
    return alternatives.filter(item => {
      const itemLoc = [item.location, item.city, item.district, item.province]
        .filter(Boolean)
        .map(s => String(s).toLowerCase())
        .join(' ');
      return itemLoc.includes(normLoc);
    });
  }

  /**
   * Build a reply when no exact catalog match exists.
   * Prioritises Rumah123 live data, then shows location-filtered catalog alternatives.
   *
   * CRITICAL: Respects location filters — only shows alternatives from the requested location.
   * Never shows results from unrelated cities.
   *
   * @param {{ alternatives, rumah123Listings, filters }} params
   * @returns {string}
   */
  alternative({ alternatives = [], rumah123Listings = [], filters = {} }) {
    const summary    = this.#summarizeRequest(filters);
    const location   = filters.location || '';
    const hasR123    = rumah123Listings.length > 0;

    // Filter alternatives to ONLY match requested location
    const filteredAlt = location
      ? this.#filterAlternativesByLocation(alternatives, location)
      : alternatives;
    const hasAlt     = filteredAlt.length > 0;
    const isId       = this.#lang === 'id';

    // Nothing found anywhere
    if (!hasR123 && !hasAlt) {
      const locationNote = location
        ? (isId ? ` di **${location}**` : ` in **${location}**`)
        : '';
      return isId
        ? `Maaf, saat ini belum ada properti yang sesuai dengan **${summary}**${locationNote} di katalog maupun Rumah123. Apakah Anda ingin mencoba lokasi, tipe properti, atau range harga lain?`
        : `Sorry, there is currently no property matching **${summary}**${locationNote} in my catalog or Rumah123. Would you like to try another location, property type, or price range?`;
    }

    const lines = [];

    // Show Rumah123 results if available
    if (hasR123) {
      const count = Math.min(rumah123Listings.length, 20);
      lines.push(isId
        ? `Berikut **${count} listing terbaik** dari **Rumah123** untuk **${summary}** (data terkini):\n`
        : `Here are the **top ${count} listings** from **Rumah123** for **${summary}** (live data):\n`
      );
      lines.push(PropertyFormatter.rumah123List(rumah123Listings, this.#lang, 20));
    } else if (location) {
      // No Rumah123 results for this location — state it explicitly
      lines.push(isId
        ? `⚠️ Maaf, belum ada listing yang tersedia di **${location}** dari Rumah123 untuk **${summary}**.\n`
        : `⚠️ Sorry, no listings are currently available in **${location}** from Rumah123 for **${summary}**.\n`
      );
    }

    // Show catalog alternatives (filtered by location)
    if (hasAlt) {
      if (hasR123) {
        lines.push(isId ? '\n---\n**Alternatif dari Katalog Saya:**\n' : '\n---\n**Alternatives from My Catalog:**\n');
      } else {
        lines.push(isId
          ? `Namun berikut pilihan alternatif dari katalog saya untuk **${summary}**:\n`
          : `Here are some alternative options from my catalog for **${summary}**:\n`
        );
      }
      lines.push(PropertyFormatter.catalogList(filteredAlt, this.#lang, 6));
    }

    // Add follow-up question
    if (hasR123 || hasAlt) {
      lines.push(isId
        ? '\n\nApakah ada yang ingin Anda tanyakan lebih lanjut?'
        : '\n\nWould you like to know more details?'
      );
    }

    return lines.join('\n');
  }
}

// ─── ResponseBuilderWhatsApp ──────────────────────────────────────────────────
// Format khusus untuk WhatsApp terminal message (Fonnte, Kirimi, TimelinesAI)
// Dengan property images, agent name, dan bolder formatting untuk readability

class ResponseBuilderWhatsApp {
  /** @type {'id'|'en'} */
  #lang;
  /** @type {string} */
  #agentName;
  /** @type {string} - App/agency name, sourced from APP_NAME env (never hardcoded) */
  #appName;

  constructor(lang = 'en', agentName = '', appName = '') {
    this.#lang      = lang;
    // Agent name selalu dari database (di-pass via param); fallback ke appName bila kosong.
    this.#appName   = appName || process.env.APP_NAME || 'Elevan Property';
    this.#agentName = agentName || this.#appName;
  }

  #summarizeRequest(filters = {}) {
    const parts = [];
    if (filters.transactionType) parts.push(PropertyFormatter.humanTransactionType(filters.transactionType, this.#lang));
    if (filters.buildingType)    parts.push(PropertyFormatter.humanBuildingType(filters.buildingType, this.#lang));
    if (filters.location)        parts.push(filters.location);
    if (filters.budget?.text)    parts.push(filters.budget.text);
    return parts.length
      ? parts.join(' ')
      : (this.#lang === 'id' ? 'kebutuhan properti Anda' : 'your property request');
  }

  offTopic() {
    return this.#lang === 'id'
      ? 'Maaf, saya hanya dapat membantu pertanyaan seputar jual, beli, atau sewa properti. Silakan tanyakan kebutuhan properti seperti rumah, villa, hotel, apartemen, kos-kosan, ruko, kantor, atau gudang yang ingin Anda cari.'
      : 'Sorry, I can only help with questions about buying, selling, or renting property. Please ask me about the property type, location, budget, or facilities you are looking for.';
  }

  clarification() {
    return this.#lang === 'id'
      ? 'Boleh saya pastikan, Anda mencari properti untuk *sewa*, *beli*, atau *jual*? Silakan sebutkan juga lokasi dan budget agar saya bisa mencarikan pilihan terbaik dari Rumah123 dan katalog saya.'
      : 'May I confirm whether you are looking to *rent*, *buy*, or *sell* a property? You can also mention the location and budget so I can find the best options from Rumah123 and my catalog.';
  }

  /**
   * Filter alternatives by location (existing helper — kept for backward compat).
   * @deprecated Use #filterByTypeAndLocation instead.
   */
  #filterAlternativesByLocation(alternatives = [], location = '') {
    if (!location) return alternatives;
    const normLoc = location.toLowerCase().trim();
    return alternatives.filter(item => {
      const itemLoc = [item.location, item.city, item.district, item.province]
        .filter(Boolean).map(s => String(s).toLowerCase()).join(' ');
      return itemLoc.includes(normLoc);
    });
  }

  /**
   * Filter alternatives dengan STRICT TYPE + GRACEFUL LOCATION.
   *
   * TIPE: Selalu strict — jika buildingType ditetapkan, hanya tampilkan tipe yang sama.
   *        Fallback types eksplisit (user bilang "atau villa") juga diperbolehkan.
   *
   * LOKASI: Prefer lokasi yang diminta, tapi tidak mandatory:
   *   - Tahap 1: Tipe yang sama DI lokasi yang diminta (ideal)
   *   - Tahap 2: Tipe yang sama di kota/kab yang sama (area berbeda)
   *   - Tahap 3: Tipe yang sama dari mana saja (last resort, semua kota)
   *
   * Perbedaan dengan behavior lama:
   *   Lama: type + location keduanya strict → empty jika tidak ada di kota itu
   *   Baru: type strict, location graceful → tetap tampil meski dari kota lain
   *
   * @param {object[]} alternatives
   * @param {object}   filters - { buildingType, location, fallbackTypes }
   * @returns {{ items: object[], locationScope: 'exact'|'city'|'national' }}
   */
  #filterByTypeAndLocation(alternatives = [], filters = {}) {
    // ── Step 1: Filter by TYPE (strict — always enforced) ─────────────────
    let byType = alternatives;
    if (filters.buildingType) {
      const allowedTypes = [filters.buildingType, ...(filters.fallbackTypes || [])].filter(Boolean);
      byType = alternatives.filter(item =>
        allowedTypes.some(t =>
          String(item.buildingType || '').toLowerCase() === t.toLowerCase()
        )
      );
    }

    if (!byType.length) return { items: [], locationScope: 'exact' };

    if (!filters.location) return { items: byType, locationScope: 'national' };

    const normLoc = filters.location.toLowerCase().trim();

    // ── Step 2: Prefer same location (exact city/area match) ──────────────
    const atExactLoc = byType.filter(item => {
      const itemLoc = [item.location, item.city, item.district, item.province, item.address]
        .filter(Boolean).map(s => String(s).toLowerCase()).join(' ');
      return itemLoc.includes(normLoc);
    });

    if (atExactLoc.length > 0) return { items: atExactLoc, locationScope: 'exact' };

    // ── Step 3: Try city-level match (for district-level requests) ─────────
    // e.g. "Ngagel Jaya Selatan Surabaya" → fall back to any part of Surabaya
    const cityWords = normLoc.split(/\s+/).filter(w => w.length >= 4);
    for (const cityWord of cityWords) {
      const atCity = byType.filter(item => {
        const itemLoc = [item.city, item.province, item.location]
          .filter(Boolean).map(s => String(s).toLowerCase()).join(' ');
        return itemLoc.includes(cityWord);
      });
      if (atCity.length > 0) return { items: atCity, locationScope: 'city' };
    }

    // ── Step 4: National fallback — same type, any city ───────────────────
    return { items: byType, locationScope: 'national' };
  }

  #catalogItemWhatsApp(item, index, lang = 'en') {
    const isId   = lang === 'id';
    const imgTag = item.imageUrl
      ? `\n   ![${item.title || 'Properti'}](${item.imageUrl})`
      : '';

    return [
      `${index + 1}. *${item.title || (isId ? 'Properti' : 'Property')}*${imgTag}`,
      `   📍 Lokasi: ${PropertyFormatter.formatLocation(item)}`,
      `   💰 Harga: *${item.price || '-'}*`,
      `   🏠 Tipe: ${PropertyFormatter.humanBuildingType(item.buildingType, lang)} — ${PropertyFormatter.humanTransactionType(item.transactionType, lang)}`,
      `   📐 Luas: bangunan ${item.buildingArea || '-'}, tanah ${item.landArea || '-'}`,
      `   🏷️ Fasilitas: ${PropertyFormatter.formatFacilities(item.facilities)}`,
    ].join('\n');
  }

  #catalogListWhatsApp(properties = [], lang = 'en', limit = 6) {
    return properties.slice(0, limit)
      .map((item, i) => this.#catalogItemWhatsApp(item, i, lang))
      .join('\n\n');
  }

  #addFooter() {
    const isId = this.#lang === 'id';
    return isId
      ? `\n\nSaya siap membantu Anda menemukan rumah, villa, apartemen, atau properti lainnya yang cocok untuk Anda.\nApakah ada yang ingin Anda tanyakan lebih lanjut?\n\n\nSalam hangat,\n*${this.#agentName}*\n*${this.#appName}*`
      : `\n\nI am ready to help you find a house, villa, apartment, or other property that suits you.\nWould you like to know more details?\n\n\nWarm regards,\n*${this.#agentName}*\n*${this.#appName}*`;
  }

  exactMatch({ rumah123Listings = [], catalogMatches = [], filters = {} }) {
    const summary  = this.#summarizeRequest(filters);
    const hasR123  = rumah123Listings.length > 0;
    const hasCat   = catalogMatches.length > 0;
    const isId     = this.#lang === 'id';
    const lines    = [];

    if (hasR123) {
      const count = Math.min(rumah123Listings.length, 6); // WhatsApp limit: max 6
      lines.push(isId
        ? `Berikut *${count} pilihan ${summary}* terbaik dari *Rumah123* (data terkini):\n`
        : `Here are the *top ${count} ${summary}* listings from *Rumah123* (live data):\n`
      );
      lines.push(PropertyFormatter.rumah123List(rumah123Listings, this.#lang, 6));
    }

    if (hasCat && !hasR123) {
      lines.push(isId
        ? `Berikut pilihan *${summary}* dari katalog properti saya:\n`
        : `Here are matching *${summary}* options from my catalog:\n`
      );
      lines.push(this.#catalogListWhatsApp(catalogMatches, this.#lang, 6));
    }

    lines.push(this.#addFooter());
    return lines.join('\n');
  }

  /**
   * Build alternative reply dengan STRICT TYPE MATCHING.
   *
   * Aturan:
   * - Jika buildingType ditetapkan → HANYA tampilkan tipe yang sama (+ fallbackTypes jika ada)
   * - Jika ada fallbackTypes eksplisit (user bilang "kalau tidak ada hotel, villa oke") →
   *   tampilkan tipe-tipe tersebut saja
   * - TIDAK tampilkan campuran tipe berbeda tanpa persetujuan user
   * - Jelaskan kepada customer mengapa ini ditampilkan (beda area / beda harga / dll)
   */
  /**
   * Build alternative reply dengan STRICT TYPE + GRACEFUL LOCATION.
   *
   * Tipe selalu dijaga strict. Lokasi degradasi bertahap:
   *   'exact'    → properti TEPAT di lokasi yang diminta (mungkin beda district)
   *   'city'     → properti di kota yang sama (district berbeda)
   *   'national' → properti tipe yang sama dari kota lain
   */
  alternative({ alternatives = [], rumah123Listings = [], filters = {}, budgetExpanded = null }) {
    const summary  = this.#summarizeRequest(filters);
    const location = filters.location || '';
    const hasR123  = rumah123Listings.length > 0;
    const isId     = this.#lang === 'id';

    // ── Filter: strict type, graceful location ──────────────────────────────
    const { items: filteredAlt, locationScope } = this.#filterByTypeAndLocation(alternatives, filters);
    const hasAlt = filteredAlt.length > 0;

    // ── Tidak ada sama sekali (tipe tidak tersedia di mana pun) ────────────
    if (!hasR123 && !hasAlt) {
      const typeNote = filters.buildingType
        ? (isId
            ? ` *${PropertyFormatter.humanBuildingType(filters.buildingType, 'id')}*`
            : ` *${PropertyFormatter.humanBuildingType(filters.buildingType, 'en')}*`)
        : '';
      const locNote  = location ? (isId ? ` di *${location}*` : ` in *${location}*`) : '';

      return (isId
        ? `Maaf, saat ini belum ada${typeNote} yang tersedia${locNote} di katalog maupun Rumah123.\n\nApakah Anda ingin mencoba lokasi atau range harga yang berbeda?`
        : `Sorry, there is currently no${typeNote} available${locNote} in my catalog or Rumah123.\n\nWould you like to try a different location or price range?`
      ) + this.#addFooter();
    }

    const lines = [];

    // ── Rumah123 results ────────────────────────────────────────────────────
    if (hasR123) {
      const count = Math.min(rumah123Listings.length, 6);
      lines.push(isId
        ? `Berikut *${count} listing terbaik* dari *Rumah123* untuk *${summary}* (data terkini):\n`
        : `Here are the *top ${count} listings* from *Rumah123* for *${summary}* (live data):\n`
      );
      lines.push(PropertyFormatter.rumah123List(rumah123Listings, this.#lang, 6));
    }

    // ── Catalog alternatives ────────────────────────────────────────────────
    if (hasAlt) {
      if (hasR123) {
        lines.push(isId ? '\n---\n*Pilihan Lain dari Katalog:*\n' : '\n---\n*More from My Catalog:*\n');
      } else {
        // Konteks berbeda tergantung alasan mengapa ini alternatif
        let contextMsg;

        if (budgetExpanded) {
          contextMsg = isId
            ? `⚠️ Tidak ada *${summary}* yang sesuai budget tersebut. Berikut pilihan *${PropertyFormatter.humanBuildingType(filters.buildingType, 'id')}* terdekat dengan range harga yang disesuaikan:\n`
            : `⚠️ No *${summary}* found at that budget. Here are the closest *${PropertyFormatter.humanBuildingType(filters.buildingType, 'en')}* options at a nearby price range:\n`;

        } else if (locationScope === 'city') {
          // Kota sama, district berbeda — persis seperti kasus Ngagel Jaya Selatan → Dukuh Kupang
          contextMsg = isId
            ? `⚠️ Tidak ada *${summary}* di area tersebut. Berikut pilihan *${PropertyFormatter.humanBuildingType(filters.buildingType, 'id')}* di bagian lain kota *${location}*:\n`
            : `⚠️ No *${summary}* at that specific area. Here are *${PropertyFormatter.humanBuildingType(filters.buildingType, 'en')}* options in other parts of *${location}*:\n`;

        } else if (locationScope === 'national' && location) {
          contextMsg = isId
            ? `⚠️ Belum ada *${PropertyFormatter.humanBuildingType(filters.buildingType, 'id')}* sewa di *${location}* saat ini. Berikut pilihan terdekat di kota lain:\n`
            : `⚠️ No *${PropertyFormatter.humanBuildingType(filters.buildingType, 'en')}* for rent in *${location}* right now. Here are the closest options from other cities:\n`;

        } else {
          contextMsg = isId
            ? `Berikut pilihan *${summary}* yang tersedia dari katalog saya:\n`
            : `Here are available *${summary}* options from my catalog:\n`;
        }

        lines.push(contextMsg);
      }

      lines.push(this.#catalogListWhatsApp(filteredAlt, this.#lang, 6));
    }

    lines.push(this.#addFooter());
    return lines.join('\n');
  }

  /**
   * Wrap a single qualification question with the agent footer.
   * Used during the conversation qualification phase (Q0–Q12).
   *
   * @param {string} question - The question text (already formatted)
   * @returns {string}
   */
  qualificationQuestion(question) {
    // Signature (Salam hangat / Warm regards) appears ONLY in the final summary (agentBrief).
    // Qualification questions Q1–Q12 must NOT include the agent signature.
    return question;
  }

  /**
   * Build the customer-facing closing message (RESPOND_CATALOG_RUN=OFF summary mode).
   * Shows a structured recap of what was collected, then hands off to agent.
   *
   * @param {object} brief - From ConversationQualifier.buildAgentBrief()
   * @returns {string}
   */
  agentBrief(brief) {
    const isId = this.#lang === 'id';

    // ── Build summary bullets (only show fields that are known) ──────────────
    const lines = [];

    const fmt = (label, field) => {
      if (!field || field.value === 'UNKNOWN' || field.value === null) return null;
      const src = field.source === 'inferred' ? (isId ? ' _(terkonfirmasi nanti)_' : ' _(to reconfirm)_') : '';
      return `✓ ${label}: *${field.value}*${src}`;
    };

    const txLabel = brief.transactionType?.value === 'rent'
      ? (isId ? 'Sewa' : 'Rent')
      : brief.transactionType?.value === 'sale'
        ? (isId ? 'Beli' : 'Buy')
        : brief.transactionType?.value;

    if (txLabel && brief.transactionType?.value !== 'UNKNOWN') {
      lines.push(`✓ ${isId ? 'Rencana' : 'Plan'}: *${txLabel}*`);
    }
    // Humanize the building type key (apartment → Apartemen / Apartment).
    if (brief.buildingType && brief.buildingType.value !== 'UNKNOWN' && brief.buildingType.value != null) {
      const typeHuman = PropertyFormatter.humanBuildingType(brief.buildingType.value, this.#lang);
      lines.push(`✓ ${isId ? 'Tipe' : 'Type'}: *${typeHuman}*`);
    }
    const locL = fmt(isId ? 'Lokasi' : 'Location', brief.location);
    if (locL) lines.push(locL);
    const budL = fmt(isId ? 'Budget' : 'Budget', brief.budget);
    if (budL) lines.push(budL);
    const movL = fmt(isId ? 'Masuk' : 'Move-in', brief.moveInDate);
    if (movL) lines.push(movL);
    const durL = fmt(isId ? 'Durasi sewa' : 'Lease duration', brief.leaseDuration);
    if (durL) lines.push(durL);
    const dmL  = fmt(isId ? 'Keputusan bersama' : 'Decision maker', brief.decisionMaker);
    if (dmL) lines.push(dmL);
    const furL = fmt(isId ? 'Furnitur' : 'Furnishing', brief.furnishing);
    if (furL) lines.push(furL);
    const facL = fmt(isId ? 'Fasilitas' : 'Facilities', brief.facilities);
    if (facL) lines.push(facL);
    const altL = fmt(isId ? 'Area alternatif' : 'Alt. areas', brief.alternativeAreas);
    if (altL) lines.push(altL);
    const rfL  = fmt(isId ? 'Hindari' : 'Avoid', brief.redFlags);
    if (rfL) lines.push(rfL);
    const ancL = fmt(isId ? 'Patokan lokasi' : 'Anchor', brief.anchorPoint);
    if (ancL) lines.push(ancL);
    const viewL = fmt('Viewing', brief.viewingPreference);
    if (viewL) lines.push(viewL);

    const bulletBlock = lines.join('\n');

    // ── Priority badge ────────────────────────────────────────────────────────
    const priorityBadge = {
      HIGH      : isId ? '🔥 Prioritas Tinggi'   : '🔥 High Priority',
      NORMAL    : isId ? '📋 Prioritas Normal'   : '📋 Normal Priority',
      INCOMPLETE: isId ? '⚠️ Data Belum Lengkap' : '⚠️ Incomplete Data',
    }[brief.priority] || '';

    // ── Compose full message ──────────────────────────────────────────────────
    const header = isId
      ? `Baik, semua sudah saya catat! 📝 ${priorityBadge}`
      : `Got it, I've noted everything! 📝 ${priorityBadge}`;

    const summary = isId
      ? `${header}\n\n${bulletBlock}\n\nSaya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠\nTerima kasih sudah menghubungi saya. 🙏`
      : `${header}\n\n${bulletBlock}\n\nI will reach out to you with the best property recommendations soon! 🏠\nThank you for contacting me. 🙏`;

    const signature = isId
      ? `\n\nSalam hangat,\n*${this.#agentName}*\n*${this.#appName}*`
      : `\n\nWarm regards,\n*${this.#agentName}*\n*${this.#appName}*`;

    return summary + signature;
  }

  /**
   * House v2 pilot — customer-facing HANDOFF message (no sourcing promise, no summary).
   * The structured [BRIEF_READY] is internal (returned in metadata), never in this text.
   */
  houseHandoff() {
    const isId = this.#lang === 'id';
    return isId
      ? `Siap, Kak! Semua sudah saya catat lengkap. Saya teruskan ke *${this.#agentName}* sekarang ya — beliau yang akan lanjut hubungi Kak langsung untuk pilihan dan langkah berikutnya. Terima kasih! 🙏`
      : `All set, Kak! I've noted everything. I'm handing this over to *${this.#agentName}* now — they'll reach out to you directly with options and next steps. Thank you! 🙏`;
  }

  /**
   * House — customer-facing SUMMARY (visible recap, then handoff).
   * Shows the CORE fields always: ✓ when answered, "X … (Belum ditanyakan)" when a
   * field was never asked — so both customer and agent see exactly what's covered and
   * what's still missing. Closes with the dynamic agent signature.
   *
   * @param {object} brief - From ConversationQualifier.buildAgentBrief()
   */
  houseSummary(brief) {
    const isId = this.#lang === 'id';
    const known = (f) => f && f.value !== 'UNKNOWN' && f.value != null && String(f.value).trim() !== '';
    const notAsked = isId ? '(Belum ditanyakan)' : '(Not asked yet)';
    // ✓ label: *value*   OR   X label: *(Belum ditanyakan)*
    const row = (label, field) => known(field)
      ? `✓ ${label}: *${field.value}*`
      : `✗ ${label}: *${notAsked}*`;

    const txLabel = brief.transactionType?.value === 'rent'
      ? (isId ? 'Sewa' : 'Rent')
      : brief.transactionType?.value === 'sale'
        ? (isId ? 'Beli' : 'Buy')
        : null;
    const typeHuman = (brief.buildingType && brief.buildingType.value !== 'UNKNOWN' && brief.buildingType.value != null)
      ? PropertyFormatter.humanBuildingType(brief.buildingType.value, this.#lang)
      : null;

    const lines = [];
    if (txLabel) lines.push(`✓ ${isId ? 'Rencana' : 'Plan'}: *${txLabel}*`);
    if (typeHuman) lines.push(`✓ ${isId ? 'Tipe' : 'Type'}: *${typeHuman}*`);
    lines.push(row(isId ? 'Lokasi' : 'Location',            brief.location));
    lines.push(row(isId ? 'Masuk' : 'Move-in',              brief.moveInDate));
    lines.push(row(isId ? 'Keputusan bersama' : 'Decision', brief.decisionMaker));
    lines.push(row(isId ? 'Furnitur' : 'Furnishing',        brief.furnishing));
    lines.push(row(isId ? 'Fasilitas' : 'Facilities',       brief.facilities));
    lines.push(row(isId ? 'Budget' : 'Budget',              brief.budget));
    lines.push(row(isId ? 'Patokan lokasi' : 'Anchor',      brief.anchorPoint));
    // Preferensi positif & hal yang dihindari — hanya tampil bila customer menyebutnya
    // (opsional, jadi tidak ditandai ✗ "Belum ditanyakan" saat kosong).
    if (known(brief.preferences)) lines.push(`✓ ${isId ? 'Preferensi' : 'Preferences'}: *${brief.preferences.value}*`);
    if (known(brief.redFlags))    lines.push(`✓ ${isId ? 'Hindari' : 'Avoid'}: *${brief.redFlags.value}*`);

    const priorityBadge = {
      HIGH      : isId ? '📋 Prioritas Tinggi'   : '📋 High Priority',
      NORMAL    : isId ? '📋 Prioritas Normal'   : '📋 Normal Priority',
      INCOMPLETE: isId ? '⚠️ Data Belum Lengkap' : '⚠️ Incomplete Data',
    }[brief.priority] || '';

    const header = isId
      ? `Baik, semua sudah saya catat! 📝 ${priorityBadge}`
      : `Got it, I've noted everything! 📝 ${priorityBadge}`;
    const closing = isId
      ? `Saya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠\n\nTerima kasih sudah menghubungi saya. 🙏`
      : `I'll reach out soon with the most suitable property recommendations! 🏠\n\nThank you for contacting me. 🙏`;
    const signature = isId
      ? `Salam hangat,\n*${this.#agentName}*\n*${this.#appName}*`
      : `Warm regards,\n*${this.#agentName}*\n*${this.#appName}*`;

    return `${header}\n\n${lines.join('\n')}\n\n${closing}\n\n${signature}`;
  }
}

// ─── ConversationQualifier ────────────────────────────────────────────────────
//
// Implementasi CUSTOMER FLOW skill untuk WhatsApp chatbot.
//
// Tujuan: daripada langsung tampilkan daftar properti, tanyakan kebutuhan
// customer dulu secara sistematis (Q0–Q12) sehingga rekomendasi yang
// diberikan benar-benar sesuai kebutuhan.
//
// KAPAN TAMPILKAN LISTING:
//   a) Customer eksplisit minta list/katalog/rekomendasi
//   b) Sudah cukup info: transactionType + buildingType + location terkumpul
//   c) AI sudah tanya 4+ pertanyaan (hindari over-qualifying)
//
// REFERENSI: CUSTOMER (RENTER/BUYER) FLOW — Q0 s/d Q12

class ConversationQualifier {

  /* ─── Internal text helpers ──────────────────────────────────────────────── */

  static #allText(history, userMessage) {
    return [...history.map(h => h.message || ''), userMessage].join(' ').toLowerCase();
  }

  static #aiText(history) {
    // AI messages bisa tersimpan sebagai 'assistant' (sessionService) atau 'ai' (fonnteChatController)
    return history.filter(h => h.role === 'assistant' || h.role === 'ai')
      .map(h => h.message || '').join(' ').toLowerCase();
  }

  static #customerText(history, userMessage) {
    // Customer messages bisa tersimpan sebagai 'user' (sessionService) atau 'customer' (fonnte/wati/dialog)
    return [
      ...history.filter(h => h.role === 'user' || h.role === 'customer').map(h => h.message || ''),
      userMessage
    ].join(' ').toLowerCase();
  }

  static #has(text, keywords) {
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  }

  /* ─── Public: does customer want a listing RIGHT NOW? ───────────────────── */

  /**
   * Returns true when customer's latest message explicitly requests
   * a listing, catalog, or recommendations — skip qualification, show list.
   *
   * @param {string} userMessage
   * @returns {boolean}
   */
  static wantsListingNow(userMessage) {
    const lower = userMessage.toLowerCase();
    return this.#has(lower, [
      // Bahasa Indonesia
      'kasih', 'tampilkan', 'carikan', 'tolong cari', 'cari dong',
      'lihatkan', 'lihat dong', 'ada apa', 'apa ada', 'pilihan apa',
      'rekomendasikan', 'rekomen', 'rekomendasi', 'daftar', 'katalog',
      'ada berapa', 'ada yang', 'tunjukkan', 'langsung',
      'ada apa saja', 'apa saja yang', 'info properti',
      // English
      'show me', 'show list', 'give me', 'send me', 'find me', 'get me',
      "what do you have", "what's available", 'any available', 'any listing',
      'recommend', 'suggestion', 'options', 'catalog', 'list me',
    ]);
  }

  /* ─── Public: build customer profile from conversation ─────────────────── */

  /**
   * Analyze the full conversation (history + current message + extracted filters)
   * and return a "CustomerProfile" object that drives the qualification flow.
   *
   * @param {object[]} history    - [{role, message}] conversation history
   * @param {string}   userMessage- Latest customer message
   * @param {object}   filters    - Extracted filters from propertyRecommendationService
   * @returns {object} CustomerProfile
   */
  static buildProfile(history = [], userMessage = '', filters = {}) {
    // ── Phase 0: Find active session start ──────────────────────────────────
    // Same logic as aiPromptBuilderService.js Phase 0.
    // If a summary brief was sent in a previous turn, all Q answers from BEFORE
    // that summary are stale (belong to the old search). Scope custText/aiText/
    // aiCount/histCustMsgs to only messages AFTER the last summary so that old
    // session data (e.g. "bersama istri", "semi-furnished", "Agustus" from a
    // previous villa search) never pollutes the current search's profile.
    //
    // Why this matters:
    //   - Without this, hasMoveInDate/hasHouseholdInfo/hasFurnishing pick up
    //     old answers → getNextQuestion() skips Q8/Q4/Q11 → summary shown
    //     after only Q1+Q2 are answered in the new session.
    //   - With this, custText only has active session messages → flags are
    //     correctly false for questions never asked in the current session.
    const SUMMARY_RE_P0 = /[✓✔]\s*Rencana\s*:/i;

    // Word-boundary type / tx detectors (used by both boundaries below).
    const _typeOfP0 = (txt) => {
      // Strip commercial use-phrases ("dipakai kantor", "buat usaha") so a house
      // used as an office isn't read as a type switch house→office.
      const w = stripCommercialUsePhrases((txt || '').toLowerCase());
      if (/\bvill?a\b/.test(w))                                              return 'villa';
      if (/\bapartemen\b|\bapartment\b/.test(w))                             return 'apartment';
      if (/\bmansion\b|\brumah mewah\b/.test(w))                            return 'mansion';
      if (/\brumah\b(?!\s+(?:makan|sakit|tangga|ibadah|duka|produksi|tahanan|susun|potong|kos))|\bhouse\b|\bkontrakan\b/.test(w))                      return 'house';
      if (/\bhotel\b|\bpenginapan\b/.test(w))                               return 'hotel';
      if (/\bkondotel\b|\bcondo\b/.test(w))                                 return 'kondotel';
      if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(w))                return 'boarding_house';
      if (/\bruko\b|\brukan\b/.test(w))                                     return 'shophouse';
      if (/\bkantor\b/.test(w))                                             return 'office';
      if (/\bgudang\b/.test(w))                                             return 'warehouse';
      if (/\btoko\b|\bretail\b/.test(w))                                  return 'store';
      if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(w))  return 'others';
      return null;
    };
    const _txOfP0 = (txt) => {
      const w = (txt || '').toLowerCase();
      if (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|rent|rental|lease)\b/.test(w)) return 'rent';
      if (/\b(beli|membeli|pembelian|dibeli|jual|dijual|buy|purchase)\b/.test(w))                     return 'sale';
      return null;
    };

    // ── Boundary A: first customer message after the last summary brief ──────
    const lastSumIdxP0 = history.reduce(
      (idx, m, i) =>
        (m.role === 'assistant' || m.role === 'ai') && SUMMARY_RE_P0.test(m.message || '')
          ? i : idx,
      -1
    );
    let summaryStart = 0;
    if (lastSumIdxP0 >= 0) {
      summaryStart = history.length;   // no customer reply yet → only current msg active
      for (let i = lastSumIdxP0 + 1; i < history.length; i++) {
        if (history[i].role === 'user' || history[i].role === 'customer') {
          summaryStart = i;
          break;
        }
      }
    }

    // ── Boundary B: latest message that switches building type or flips tx ───
    // Handles the abandoned-search case: customer half-fills a villa search,
    // then types "Mau cari hotel" with no summary in between. Everything before
    // the switch is stale. The current userMessage is included as the final node.
    let switchStart = 0;
    {
      const seq = [
        ...history.map((m, i) => ({ i, role: m.role, message: m.message })),
        { i: history.length, role: 'customer', message: userMessage },
      ];
      let runType = null;
      let runTx   = null;
      for (const m of seq) {
        if (!(m.role === 'user' || m.role === 'customer')) continue;
        const t  = _typeOfP0(m.message);
        const tx = _txOfP0(m.message);
        if ((t && runType && t !== runType) || (tx && runTx && tx !== runTx)) {
          switchStart = m.i;
        }
        if (t)  runType = t;
        if (tx) runTx   = tx;
      }
    }

    const activeSessionStart = Math.max(summaryStart, switchStart);
    const activeHistory = history.slice(activeSessionStart);

    // True when the active session began because of a type/tx switch (not a
    // summary). Forces the Q2–Q12 reset below, since the now-trimmed segment can
    // no longer see the pre-switch type. Business rule: any type OR transaction
    // change → restart from Q1.
    const switchBoundaryHit = switchStart > 0 && switchStart >= summaryStart;

    // custText / aiText / aiCount — scoped to ACTIVE session only
    const custText = this.#customerText(activeHistory, userMessage);
    const aiText   = this.#aiText(activeHistory);
    const aiCount  = activeHistory.filter(h => h.role === 'assistant' || h.role === 'ai').length;

    // ── Pre-compute: summary-already-shown detection ─────────────────────────
    // Same logic as aiPromptBuilderService.js Phase 3A.
    // Uses FULL history (not activeHistory) to find the last summary — we need
    // to know if the current message is the FIRST message after a summary.
    const SUMMARY_SENT_RE = /[✓✔]\s*Rencana\s*:/i;
    const lastSummaryIdx = history.reduce(
      (idx, m, i) =>
        (m.role === 'assistant' || m.role === 'ai') && SUMMARY_SENT_RE.test(m.message || '')
          ? i : idx,
      -1
    );
    const custAfterSummary = lastSummaryIdx >= 0
      ? history.slice(lastSummaryIdx + 1).filter(m => m.role === 'user' || m.role === 'customer')
      : [];
    const summaryAlreadyShown = lastSummaryIdx >= 0 && custAfterSummary.length === 0;

    // ── Pre-compute: building-type-change detection ──────────────────────────
    // RULES: building type change → reset Q2–Q12 (show ⚠️ in summary mode).
    //        tx-only change (same building type) → just update tx, no reset.
    // Uses activeHistory so we only detect type changes WITHIN the current
    // search session, not between the current and a pre-summary session.
    const histCustMsgs = activeHistory.filter(m => m.role === 'user' || m.role === 'customer');
    // Strip commercial use-phrases ("dipakai kantor", "buat usaha") so a house used
    // as an office isn't mis-read as a type change house→office (which would reset).
    const histCustJoined = stripCommercialUsePhrases(histCustMsgs.map(m => (m.message || '').toLowerCase()).join(' '));
    let histBuildingType = null;
    if      (/\bvill?a\b/.test(histCustJoined))                                             histBuildingType = 'villa';
    else if (/\bapartemen\b|\bapartment\b/.test(histCustJoined))                            histBuildingType = 'apartment';
    else if (/\bmansion\b|\brumah mewah\b/.test(histCustJoined))                           histBuildingType = 'mansion';
    else if (/\brumah\b(?!\s+(?:makan|sakit|tangga|ibadah|duka|produksi|tahanan|susun|potong|kos))|\bhouse\b|\bkontrakan\b/.test(histCustJoined))                     histBuildingType = 'house';
    else if (/\bhotel\b|\bpenginapan\b/.test(histCustJoined))                              histBuildingType = 'hotel';
    else if (/\bkondotel\b|\bcondo\b/.test(histCustJoined))                                histBuildingType = 'kondotel';
    else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(histCustJoined))               histBuildingType = 'boarding_house';
    else if (/\bruko\b|\brukan\b/.test(histCustJoined))                                    histBuildingType = 'shophouse';
    else if (/\bkantor\b/.test(histCustJoined))                                            histBuildingType = 'office';
    else if (/\bgudang\b/.test(histCustJoined))                                            histBuildingType = 'warehouse';
    else if (/\btoko\b|\bretail\b/.test(histCustJoined))                                  histBuildingType = 'store';
    else if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(histCustJoined)) histBuildingType = 'others';

    const curMsgLower = stripCommercialUsePhrases((userMessage || '').toLowerCase());
    let curBuildingType = null;
    if      (/\bvill?a\b/.test(curMsgLower))                                             curBuildingType = 'villa';
    else if (/\bapartemen\b|\bapartment\b/.test(curMsgLower))                            curBuildingType = 'apartment';
    else if (/\bmansion\b|\brumah mewah\b/.test(curMsgLower))                           curBuildingType = 'mansion';
    else if (/\brumah\b(?!\s+(?:makan|sakit|tangga|ibadah|duka|produksi|tahanan|susun|potong|kos))|\bhouse\b|\bkontrakan\b/.test(curMsgLower))                     curBuildingType = 'house';
    else if (/\bhotel\b|\bpenginapan\b/.test(curMsgLower))                              curBuildingType = 'hotel';
    else if (/\bkondotel\b|\bcondo\b/.test(curMsgLower))                                curBuildingType = 'kondotel';
    else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(curMsgLower))               curBuildingType = 'boarding_house';
    else if (/\bruko\b|\brukan\b/.test(curMsgLower))                                    curBuildingType = 'shophouse';
    else if (/\bkantor\b/.test(curMsgLower))                                            curBuildingType = 'office';
    else if (/\bgudang\b/.test(curMsgLower))                                            curBuildingType = 'warehouse';
    else if (/\btoko\b|\bretail\b/.test(curMsgLower))                                  curBuildingType = 'store';
    else if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(curMsgLower)) curBuildingType = 'others';

    let histTx = null;
    if      (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|rent|rental|lease)\b/.test(histCustJoined)) histTx = 'rent';
    else if (/\b(beli|membeli|pembelian|dibeli|jual|dijual|buy|purchase)\b/.test(histCustJoined))                     histTx = 'sale';

    let curTx = null;
    if      (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|rent|rental|lease)\b/.test(curMsgLower)) curTx = 'rent';
    else if (/\b(beli|membeli|pembelian|dibeli|jual|dijual|buy|purchase)\b/.test(curMsgLower))                     curTx = 'sale';

    // A switch detected at Phase 0 (across the now-trimmed segment) forces the
    // full Q2–Q12 reset — covers both type changes and transaction flips.
    const buildingTypeChanged = Boolean(
      switchBoundaryHit ||
      (histBuildingType && curBuildingType && histBuildingType !== curBuildingType)
    );
    const txOnlyChanged = Boolean(
      !buildingTypeChanged && histTx && curTx && histTx !== curTx
    );

    // ── Tx / type recovery: if extractPropertyFilters lost tx due to an edge-case
    // (ambiguous message, race-condition history, or period-mismatch budget),
    // scan custText directly as a safety net so Q1 never re-fires mid-flow.
    let recoveredTx   = filters.transactionType || '';
    let recoveredType = filters.buildingType    || '';
    if (!recoveredTx) {
      if (/\b(sewa|menyewa|ngontrak|kontrak|rent|rental|lease)\b/i.test(custText))   recoveredTx = 'rent';
      else if (/\b(beli|membeli|buy|purchase)\b/i.test(custText))                    recoveredTx = 'sale';
    }
    if (!recoveredType) {
      if (/\bvill?a\b/i.test(custText))                                              recoveredType = 'villa';
      else if (/\bapartemen\b|\bapartment\b/i.test(custText))                        recoveredType = 'apartment';
      else if (/\bmansion\b|\brumah mewah\b/i.test(custText))                       recoveredType = 'mansion';
      else if (/\brumah\b|\bhouse\b|\bkontrakan\b/i.test(custText))                 recoveredType = 'house';
      else if (/\bhotel\b|\bpenginapan\b/i.test(custText))                          recoveredType = 'hotel';
      else if (/\bkondotel\b|\bcondo\b/i.test(custText))                            recoveredType = 'kondotel';
      else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/i.test(custText))           recoveredType = 'boarding_house';
      else if (/\bruko\b|\brukan\b/i.test(custText))                                recoveredType = 'shophouse';
      else if (/\bkantor\b/i.test(custText))                                         recoveredType = 'office';
      else if (/\bgudang\b/i.test(custText))                                         recoveredType = 'warehouse';
      else if (/\btoko\b|\bretail\b/i.test(custText))                               recoveredType = 'store';
    }

    const profile = {
      /* ── Core filters (from propertyRecommendationService) ── */
      transactionType : recoveredTx,
      buildingType    : recoveredType,
      location        : filters.location        || '',   // 'malang'|'surabaya'|...
      budget          : filters.budget?.ambiguous ? null : (filters.budget || null), // { min, max, text } | null
      budgetAmbiguous : filters.budget?.ambiguous ? filters.budget : null, // { rawMin, rawMax } needs unit clarification

      /* ── Derived from customer messages ── */
      hasFurnishing: this.#has(custText, [
        'furnished', 'semi-furnished', 'semifurnished', 'unfurnished',
        'kosongan', 'full furnish', 'sudah ada furnitur', 'mau yang kosong',
        'perabot', 'furniture', 'furnish',
      ]) || /\b(semi|full)\b/i.test(custText) || /\bkosong\b/i.test(custText),

      /* ── Q_FAC: Facilities/amenities (WAJIB ditanyakan untuk transaksi SEWA) ──
       * Captured via filters.facilities (detectFacilities accumulates across the
       * session). hasFacilities is true once the customer has named ≥1 amenity. */
      hasFacilities: Array.isArray(filters.facilities) && filters.facilities.length > 0,
      aiAskedFacilities: this.#has(aiText, [
        'fasilitas tertentu', 'fasilitas yang', 'fasilitas apa', 'fasilitas yang diinginkan',
        'fasilitas wajib', 'ada fasilitas', 'amenities', 'facilities', 'fasilitas khusus',
      ]),

      /* ── Q_KPR: Financing (beli only — pengganti durasi sewa) ── */
      hasFinancing: this.#has(custText, [
        'cash', 'tunai', 'kpr', 'kredit', 'cicil', 'kombinasi', 'kpr komersial',
        'kpt', 'pembiayaan', 'dp ', 'down payment', 'mortgage', 'installment',
      ]),
      aiAskedFinancing: this.#has(aiText, [
        'cash atau kpr', 'kpr atau cash', 'pembiayaannya', 'rencananya cash',
        'cash, kpr', 'pembiayaan', 'financing', 'pay cash or',
      ]),
      // Whether customer's financing answer indicates KPR/kredit (→ ask Q_KPR-a)
      financingIsKPR: this.#has(custText, ['kpr', 'kredit', 'cicil', 'kombinasi', 'kpt', 'mortgage']),

      /* ── Q_KPR-a: KPR readiness (bank + DP) ── */
      hasKprDetails: this.#has(custText, [
        'bca', 'mandiri', 'bni', 'bri', 'btn', 'cimb', 'danamon', 'permata',
        'dp 10', 'dp 15', 'dp 20', 'dp 25', 'dp 30', 'dp 40', 'dp 50',
        'persen', '%', 'sudah approve', 'pre-approved', 'pre approval', 'preapproval',
        'sudah cek bank', 'sudah ajukan', 'belum cek', 'belum ajukan', 'masih rencana', 'blm',
      ]),
      aiAskedKprDetails: this.#has(aiText, [
        'bank mana', 'dp berapa', 'berapa persen', 'which bank', 'down payment',
        'rekomendasikan bank', 'sudah ada bank', 'sudah sempat cek', 'sudah sempat ajukan',
        'cek atau ajukan',
      ]),

      /* ── QM: Motivation / why now (house pilot) ── */
      hasMotivation: this.#has(custText, [
        'pindah', 'pindahan', 'mutasi', 'kontrak abis', 'kontrak habis', 'ngontrak',
        'keluarga nambah', 'nambah anak', 'anak masuk', 'tahun ajaran', 'sekolah anak',
        'investasi', 'invest', 'disewakan', 'pensiun', 'menikah', 'nikah', 'kerja baru',
        'relokasi', 'butuh rumah', 'numpang', 'pisah', 'cerai', 'growing family',
        'relocation', 'lease ending', 'moving',
        // Penugasan kerja / tinggal sementara / liburan = alasan (motivasi) yang sah
        'dinas', 'perjalanan dinas', 'tugas', 'ditugaskan', 'penugasan', 'pindah kerja',
        'pindah tugas', 'kerja sementara', 'kerja sebentar', 'sementara', 'proyek',
        'kuliah', 'study', 'liburan', 'berlibur', 'vacation', 'holiday', 'staycation',
        'wisata', 'honeymoon', 'bulan madu', 'business trip', 'work trip', 'kerja di',
      ]) || !!detectUseCase(custText),   // menyebut PENGGUNAAN (investasi/usaha/ibadah/liburan/dinas) = motivasi terjawab
      aiAskedMotivation: this.#has(aiText, [
        'apa yang membuat', 'apa yang bikin cari', 'kenapa cari', 'mulai cari rumah sekarang',
        'why now', 'what made you', 'apa yang bikin kak cari',
      ]),

      /* ── QF: Financing — cash from sale-of-asset contingency (house pilot) ── */
      financingCash: this.#has(custText, ['cash', 'tunai', 'dana siap', 'dana pribadi']),
      financingFromSale: this.#has(custText, [
        'jual rumah', 'jual aset', 'rumah lama', 'penjualan aset', 'dari jual',
        'hasil penjualan', 'jual properti', 'sell my', 'sale of',
      ]),
      hasContingencyStatus: this.#has(custText, [
        'sudah terjual', 'sudah laku', 'sold', 'masih proses', 'masih dipasarkan',
        'belum laku', 'belum terjual', 'in-progress', 'belum dijual', 'belum dipasarkan',
      ]),
      aiAskedContingency: this.#has(aiText, [
        'sudah terjual atau masih proses', 'asetnya sudah', 'rumah lamanya sudah',
        'dari dana siap atau dari penjualan', 'cash-nya dari', 'cashnya dari',
      ]),

      /* ── Q_COND: Property condition (beli residensial) ── */
      hasPropertyCondition: this.#has(custText, [
        'baru', 'ready', 'ready stock', 'primary', 'second', 'bekas', 'secondary',
        'inden', 'indent', 'pre-order', 'kondisi baik', 'siap huni',
      ]),
      aiAskedPropertyCondition: this.#has(aiText, [
        'baru/ready', 'baru, second', 'ready, second', 'second, atau inden',
        'kondisi rumah', 'primary atau secondary', 'baru atau second', 'new or second',
      ]),

      /* ── Q14 beli: tenant status (ruko/toko investasi) ── */
      hasTenantStatus: this.#has(custText, [
        'ada tenant', 'sudah ada penyewa', 'tenant existing', 'kosong',
        'ada penyewa', 'sudah disewa', 'tenant berjalan', 'tanpa tenant',
      ]),
      aiAskedTenantStatus: this.#has(aiText, [
        'sudah ada tenant', 'ada penyewa berjalan', 'tenant existing', 'kosong atau',
        'unit kosong atau',
      ]),

      /* ── Q14 beli: zonasi / legalitas (gudang/others) ── */
      hasZonasi: this.#has(custText, [
        'zona industri', 'zonasi', 'shm', 'shgb', 'imb', 'legalitas', 'sertifikat',
        'pergudangan', 'peruntukan', 'zona perumahan', 'zona komersial',
      ]),
      aiAskedZonasi: this.#has(aiText, [
        'zona industri', 'pengecekan legalitas', 'zonasi', 'peruntukan', 'sertifikat',
        'due diligence',
      ]),
      // Use word-boundary regex for month names so brand names like "indomaret"
      // don't falsely trigger hasMoveInDate (indomaret.includes("maret") = true).
      hasMoveInDate: (() => {
        const MONTH_ID_WB = /\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i;
        const MONTH_EN_WB = /\b(january|february|march|may|june|july|august|october|november|december)\b/i;
        const OTHER_DATE  = /\b(bulan ini|bulan depan|next month|this month|segera|soon|asap|secepatnya|besok|minggu ini|this week|next week|langsung masuk|immediate|sudah mau|ingin segera|ready to move)\b/i;
        return MONTH_ID_WB.test(custText) || MONTH_EN_WB.test(custText) || OTHER_DATE.test(custText);
      })(),
      hasHouseholdInfo: this.#has(custText, [
        'keluarga', 'suami', 'istri', 'anak', 'orang tua',
        'sendiri', 'pasangan', 'berdua', 'bertiga', 'berempat',
        'family', 'wife', 'husband', 'children', 'parents', 'alone', 'partner',
        'couple', 'anak-anak', 'ortu', 'rombongan', 'grup', 'group', 'gathering',
        'reuni', 'arisan',
      ]) || /\b\d{1,3}\s*(orang|pax|people|tamu|peserta)\b/.test(custText)
        || isNonResidentialUse(custText),   // non-hunian (kantor/usaha/investasi/ibadah) = penghuni N/A

      /* ── Use-case properti: rumah/ruko/villa dipakai untuk selain ditinggali —
       *    ibadah, investasi (disewakan/warung/kos/didiamkan), kantor/usaha, atau
       *    liburan/dinas. Bukan ganti tipe — hanya catatan penggunaan. Dipakai
       *    untuk MELEWATI pertanyaan "tinggal bersama siapa" bila non-hunian. ── */
      useCase: detectUseCase(custText) || null,
      isNonResidential: isNonResidentialUse(custText),
      commercialUse: detectCommercialUse(custText) || null,
      // NOTE: bare 'sudah'/'pernah' removed — they false-matched "kontrakan sudah
      // habis" (a motivation phrase) as a search-history answer. Require the
      // specific "sudah lihat / pernah lihat / sudah survey" phrasings instead.
      hasSearchHistory: this.#has(custText, [
        'sudah lihat', 'pernah lihat', 'sudah survey', 'pernah survey', 'sudah cari',
        'belum cocok', 'tidak cocok', 'kurang cocok', 'belum pernah lihat',
        'belum pernah', 'tidak pernah', 'baru mulai', 'belum survey', 'belum cek',
        'have seen', 'already visited', 'viewed', "haven't found", 'not a match',
      ]) || /\b0\s*(?:kali|x|properti|property|villa|rumah|unit)\b/.test(custText),
      /* ── Q5: Red flags (yang tidak diinginkan) ── */
      hasRedFlags: this.#has(custText, [
        'tidak mau', 'jangan', 'avoid', 'tidak suka', 'kurang suka',
        'hadap barat', 'west facing', 'bising', 'noisy', 'gang sempit',
        'banjir', 'jauh', 'lorong', 'tua banget', 'tidak cocok', 'kurang cocok',
        'yang pasti', 'yang jelas tidak', 'nggak mau yang',
      ]),
      aiAskedRedFlags: this.#has(aiText, [
        'tidak cocok', 'pasti tidak', 'yang harus dihindari', 'hadap barat',
        'dekat jalan ramai', 'gang sempit', 'rumah tua', 'anything you want to avoid',
      ]),

      /* ── Q6: Anchor point (patokan lokasi) ── */
      // Customer bisa menjawab nama apapun sebagai patokan: "dekat pasar",
      // "dekat cafe", "di jalan Dukuh Kupang", "dekat PT Jaya Putra", dll.
      // Cek generic "dekat/deket/near/di jalan" OR fixed keyword list.
      hasAnchorPoint: this.#has(custText, [
        'dekat sekolah', 'dekat kantor', 'dekat mall', 'dekat kampus', 'dekat rs',
        'dekat rumah sakit', 'dekat tol', 'dekat stasiun', 'dekat pasar', 'dekat cafe',
        'dekat terminal', 'dekat pabrik', 'dekat pelabuhan', 'dekat bandara',
        'patokan', 'landmark', 'di jalan', 'di sekitar',
        'near school', 'near office', 'near mall', 'near campus', 'near hospital',
        'near market', 'near station', 'near factory', 'near port',
      ]) || /\b(dekat|deket|near|di\s+jalan|di\s+sekitar)\s+\w/.test(custText),
      aiAskedAnchorPoint: this.#has(aiText, [
        'lokasi patokan', 'ada patokan', 'dekat apa', 'near any', 'specific landmark',
        'dekat sekolah', 'dekat kantor', 'dekat mall',
        // Q6 exact question text
        'ada lokasi tertentu yang jadi patokan',
        'ada lokasi tertentu',
        'lokasi tertentu yang jadi patokan',
      ]),

      /* ── Q7: Area alternatif ── */
      hasAlternativeArea: this.#has(custText, [
        'atau di', 'bisa juga di', 'juga oke', 'juga boleh', 'sekitarnya',
        'alternatif', 'wilayah lain', 'area lain', 'other area', 'nearby area',
        'bisa juga', 'selain itu', 'manapun', 'fleksibel', 'flexible',
        'or also', 'alternatively',
      ]),
      aiAskedAltArea: this.#has(aiText, [
        'selain', 'area sekitar', 'besides', 'other neighborhoods', 'area lain',
        'wilayah sekitar', 'area yang masih oke',
      ]),

      /* ── Q9: Decision maker / viewing logistics ── */
      hasDecisionMaker: this.#has(custText, [
        'langsung bisa', 'bisa langsung', 'perlu koordinasi', 'perlu diskusi',
        'sama suami', 'sama istri', 'sama pasangan', 'sama keluarga', 'sendiri saja',
        'solo decision', 'joint decision', 'discuss with', 'check with',
        'suami dulu', 'istri dulu', 'koordinasi dulu', 'minta persetujuan',
        'izin dulu', 'keputusan bersama', 'decide together',
      ]),
      aiAskedDecisionMaker: this.#has(aiText, [
        'jadwalkan viewing', 'bisa jadwalkan', 'koordinasi dulu', 'keluarga lain',
        'schedule a viewing', 'coordinate with family', 'check with',
      ]),

      /* ── Q10: Lease duration (sewa only) ── */
      hasLeaseDuration: this.#has(custText, [
        '1 tahun', '2 tahun', '3 tahun', '6 bulan', 'setahun', 'dua tahun',
        'tiga tahun', 'per tahun', '/tahun', 'satu tahun', 'yearly',
        '1 year', '2 years', '3 years', '6 months',
        'seminggu', 'sebulan', 'semalam',
      ]) || /\b\d+\s*(hari|minggu|bulan|tahun|day|week|month|year)s?\b/i.test(custText),
      aiAskedLeaseDuration: this.#has(aiText, [
        'sewa untuk berapa lama', 'berapa tahun', 'durasi sewa', 'lease duration',
        'how long', 'berapa lama',
      ]),

      /* ── Q10a: Payment terms (long lease) ── */
      hasPaymentTerms: this.#has(custText, [
        'di muka', 'cicil', 'installment', 'upfront', 'bayar penuh',
        'full payment', 'bayar di awal', 'full upfront', 'monthly', 'bulanan',
        'per bulan', 'bayar bertahap',
      ]),
      aiAskedPaymentTerms: this.#has(aiText, [
        'bayar di muka', 'bisa cicil', 'payment terms', 'pembayaran',
        'full payment', 'installment',
      ]),

      /* ── Q12: Apartment specific ── */
      hasApartmentPrefs: this.#has(custText, [
        'tower', 'lantai', 'floor', 'hadap', 'facing', 'high floor', 'low floor',
        'tinggi', 'rendah', 'tengah', 'mid floor', 'view',
      ]),
      aiAskedApartmentPrefs: this.#has(aiText, [
        'preferensi tower', 'lantai berapa', 'floor preference', 'tower mana',
        'hadap mana', 'facing direction',
      ]),

      /* ── Q14: Hotel / Kondotel booking slots ── */
      hasCheckInDate: this.#has(custText, [
        'check-in', 'checkin', 'check in', 'tanggal masuk', 'tgl masuk',
        'tanggal check',
      ]) || /\b\d{1,2}\s*(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i.test(custText),
      aiAskedCheckIn: this.#has(aiText, ['check-in tanggal', 'tanggal check-in', 'rencananya check-in']),

      hasCheckOutDate: this.#has(custText, [
        'check-out', 'checkout', 'check out', 'tanggal keluar', 'malam', 'nights',
      ]),
      aiAskedCheckOut: this.#has(aiText, ['check-out tanggal', 'berapa malam', 'check-out']),

      hasRoomType: this.#has(custText, [
        'standard', 'deluxe', 'suite', 'family room', 'tipe kamar', 'room type',
        'studio', '1 kamar', '2 kamar', 'superior',
      ]),
      aiAskedRoomType: this.#has(aiText, ['tipe kamar', 'room type', 'studio', 'suite', 'tipe unit']),

      hasBreakfastPref: this.#has(custText, [
        'breakfast', 'sarapan', 'tanpa breakfast', 'include makan', 'include sarapan',
        'room only', 'dengan makan',
      ]),
      aiAskedBreakfast: this.#has(aiText, ['breakfast', 'sarapan']),

      /* ── Q14: Villa specific ── */
      hasPrivatePool: this.#has(custText, [
        'private pool', 'kolam pribadi', 'kolam sendiri', 'pool pribadi',
        'shared pool', 'kolam bersama',
      ]),
      aiAskedPrivatePool: this.#has(aiText, ['private pool', 'kolam pribadi']),

      hasRentalPeriod: this.#has(custText, [
        'per malam', 'per minggu', 'per bulan', 'semalam', 'seminggu',
        'bulanan', 'mingguan', 'harian',
      ]) || /\/(?:malam|minggu|bulan|hari|week|night|month|day)\b/i.test(custText),
      aiAskedRentalPeriod: this.#has(aiText, ['per malam', 'per minggu', 'per bulan', 'sewa villa']),

      /* ── Q14: Kos specific ── */
      hasKosType: this.#has(custText, [
        'putra', 'putri', 'campur', 'kos putra', 'kos putri', 'kos campur',
        'cowok', 'cewek', 'laki', 'perempuan', 'mixed',
      ]),
      aiAskedKosType: this.#has(aiText, ['putra', 'putri', 'campur', 'kos type']),

      hasBathroomType: this.#has(custText, [
        'kamar mandi dalam', 'kamar mandi luar', 'en-suite', 'shared bathroom',
        'bathroom dalam', 'bathroom luar', 'km dalam', 'km luar',
      ]),
      aiAskedBathroomType: this.#has(aiText, ['kamar mandi dalam', 'kamar mandi luar', 'bathroom type']),

      /* ── Q14: Commercial (Ruko/Kantor/Gudang/Toko) ── */
      hasBusinessType: this.#has(custText, [
        'restoran', 'restaurant', 'cafe', 'retail', 'fashion', 'butik', 'toko',
        'kantor', 'startup', 'pabrik', 'gudang', 'logistik', 'distribusi',
        'klinik', 'apotek', 'minimarket', 'f&b', 'food', 'beauty', 'salon',
        'bisnis', 'usaha', 'bisnis apa', 'jenis usaha',
      ]),
      aiAskedBusinessType: this.#has(aiText, ['bisnis apa', 'jenis usaha', 'usaha apa', 'business type']),

      hasHeadcount: this.#has(custText, [
        'karyawan', 'pegawai', 'orang', 'staff', 'headcount', 'tim', 'team',
        'kapasitas', '10 orang', '20 orang', '50 orang',
      ]) && (filters.buildingType === 'office'),
      aiAskedHeadcount: this.#has(aiText, ['berapa orang', 'headcount', 'kapasitas karyawan']),

      /* ── Q14: Kondotel beli (investasi) ── */
      hasRoiExpectation: this.#has(custText, [
        'roi', 'return', 'investasi', 'yield', 'keuntungan', 'persen', '%',
        'balik modal',
      ]),
      aiAskedRoi: this.#has(aiText, ['roi', 'return', 'target roi', 'ekspektasi']),

      /* ── Q14: Properti Lainnya ── */
      hasPropertyPurpose: this.#has(custText, [
        'parkir', 'event', 'glamping', 'pertanian', 'sawah', 'kebun',
        'spbu', 'pabrik', 'klinik', 'sekolah', 'olahraga', 'lapangan',
        'tujuan', 'peruntukan', 'kegunaan',
      ]),
      aiAskedPropertyPurpose: this.#has(aiText, ['tujuan', 'peruntukan', 'bisnis apa', 'digunakan untuk']),

      /* ── AI conversation state (what AI already asked) ── */
      aiCount,
      aiAskedTxType     : this.#has(aiText, ['sewa atau beli', 'rent or buy', 'beli atau sewa', 'buy or rent']),
      aiAskedPropType   : this.#has(aiText, ['tipe properti', 'property type', 'jenis properti', 'rumah, apartemen']),
      aiAskedLocation   : this.#has(aiText, ['daerah', 'kota mana', 'which area', 'which city', 'lokasi mana']),
      aiAskedSearchHist : this.#has(aiText, ['sudah lihat berapa', 'how many properties', 'belum cocok', 'sudah survey']),
      aiAskedBudget     : this.#has(aiText, ['kisaran', 'anggaran', 'budget', 'harga yang', 'price range', 'ribu, juta', 'thousand, million', 'maksudnya dalam', 'kira-kira yang mana', 'yang mana lebih sesuai']),
      // True when customer text contains any number+unit that looks like a budget.
      // Guards Q3 from repeating even if filters.budget came back null (edge case).
      customerStatedBudget: /\b\d[\d.,]*\s*(?:juta|ribu|miliar|rb|jt)\b/i.test(custText),
      // Guards Q2b from looping when a buildingTypeChanged reset clears hasSearchHistory.
      // Regex survives the reset because it is NOT in resetFields — computed fresh each call.
      customerStatedSearchHistory:
        /\b(belum pernah|tidak pernah|belum cek|belum survey|pernah lihat|sudah lihat|sudah survey|belum ada yang|baru mulai)\b/.test(custText)
        || /\b0\s*(?:kali|x|properti|property|villa|rumah|unit)\b/.test(custText),
      // Guards Q4 from repeating when customer already stated household composition
      // in any message (e.g. "bersama istri", "saya sendiri", "berdua").
      customerStatedHousehold: /\b(sendiri|seorang\s+diri|sendirian|berdua|bertiga|berempat|berlima|bersama|sama\s+\w+|dengan\s+\w+|istri|suami|anak|keluarga|pasangan|partner|couple|alone|family)\b/i.test(custText)
        || /\b\d{1,2}\s*(orang|pax|people|tamu)\b/i.test(custText),
      aiAskedMoveIn     : this.#has(aiText, [
        'masuk bulan', 'pindah bulan', 'rencananya masuk', 'move in', 'moving',
        'target kapan proses belinya', 'kapan rencananya mulai operasional',
        // Rule 25/35 clarification phrasings
        'kira-kira tanggalnya', 'tanggal berapa rencananya', 'info tanggalnya',
        'around which date', 'which date are you planning', 'target date to close',
      ]),
      aiAskedHousehold  : this.#has(aiText, ['tinggal bersama', 'akan tinggal', 'living with', 'who will be']),
      aiAskedFurnish    : this.#has(aiText, ['furnished', 'furnitur', 'furnishing', 'semi-furnished']),
    };

    // `filters` are extracted across FULL history, so on a reset (summary or
    // type/tx switch) filters.location may still hold the OLD search's city.
    // Only trust it when it actually appears in the active session text —
    // otherwise drop it so Q2 (location) is asked fresh for the new search.
    const activeLocation =
      (filters.location && custText.includes(String(filters.location).toLowerCase()))
        ? filters.location
        : '';

    // ── Post-processing: summary-already-shown → full reset ──────────────────
    // Customer is starting a new search. Wipe all Q answers so getNextQuestion
    // returns Q0/Q1 instead of a summary or mid-flow question.
    if (summaryAlreadyShown) {
      const resetFields = [
        'hasFurnishing', 'hasMoveInDate', 'hasHouseholdInfo', 'hasSearchHistory',
        'hasRedFlags', 'hasAlternativeArea', 'hasAnchorPoint', 'hasDecisionMaker',
        'hasLeaseDuration', 'hasPaymentTerms', 'hasApartmentPrefs',
        'aiAskedTxType', 'aiAskedPropType', 'aiAskedLocation', 'aiAskedSearchHist',
        'aiAskedBudget', 'aiAskedMoveIn', 'aiAskedHousehold', 'aiAskedFurnish',
        'aiAskedRedFlags', 'aiAskedAnchorPoint', 'aiAskedAltArea',
        'aiAskedDecisionMaker', 'aiAskedLeaseDuration', 'aiAskedPaymentTerms',
        'aiAskedApartmentPrefs',
        // Q14 type-specific slots
        'hasCheckInDate', 'hasCheckOutDate', 'hasRoomType', 'hasBreakfastPref',
        'hasPrivatePool', 'hasRentalPeriod', 'hasKosType', 'hasBathroomType',
        'hasBusinessType', 'hasHeadcount', 'hasRoiExpectation', 'hasPropertyPurpose',
        'aiAskedCheckIn', 'aiAskedCheckOut', 'aiAskedRoomType', 'aiAskedBreakfast',
        'aiAskedPrivatePool', 'aiAskedRentalPeriod', 'aiAskedKosType', 'aiAskedBathroomType',
        'aiAskedBusinessType', 'aiAskedHeadcount', 'aiAskedRoi', 'aiAskedPropertyPurpose',
        // BELI flow (Q_KPR / Q_KPR-a / Q_COND + per-type Q14 beli)
        'hasFinancing', 'aiAskedFinancing', 'financingIsKPR', 'hasKprDetails',
        'aiAskedKprDetails', 'hasPropertyCondition', 'aiAskedPropertyCondition',
        'hasTenantStatus', 'aiAskedTenantStatus', 'hasZonasi', 'aiAskedZonasi',
        // House v2 pilot (motivation + financing contingency)
        'hasMotivation', 'aiAskedMotivation', 'financingCash', 'financingFromSale',
        'hasContingencyStatus', 'aiAskedContingency',
        'hasFacilities', 'aiAskedFacilities',
      ];
      resetFields.forEach(f => { profile[f] = false; });
      // Keep only what the CURRENT message explicitly says
      profile.transactionType    = filters.transactionType || '';
      profile.buildingType       = filters.buildingType    || '';
      profile.location           = activeLocation;
      profile.budget             = null;
      profile.aiCount            = 0;
      profile.summaryAlreadyShown = true;
      profile.buildingTypeChanged = false;
    }
    // ── Post-processing: building-type / transaction switch ──────────────────
    // IMPORTANT: every has*/aiAsked* flag above is derived from custText/aiText,
    // which are ALREADY scoped to `activeHistory` (Phase 0 trims everything before
    // the switch). So those flags reflect ONLY the new post-switch search — the
    // pre-switch answers were already discarded by the trim.
    //
    // ⛔ We must therefore NOT blanket-clear the answer flags here. Doing so wiped
    // the customer's NEW answers (motivation, household, …) on EVERY turn for as
    // long as the old search stayed inside the 24-message window, so the AI looped
    // on the same question (e.g. re-asking QM after the customer already answered
    // "pindah karena kerja"). Phase 0 already guarantees a clean Q1 restart.
    //
    // The only fields that can still leak the OLD search are those extracted from
    // FULL history by extractPropertyFilters — location and budget — so we re-scope
    // just those to the active session.
    else if (buildingTypeChanged) {
      profile.location  = activeLocation;
      // Keep budget only if a price token actually appears in the active session
      // text; otherwise it belongs to the abandoned search → drop so Q5 re-asks.
      const activeHasPrice = /\b\d[\d.,]*\s*(juta|jt|miliar|m|ribu|rb|k)\b/i.test(custText);
      profile.budget    = activeHasPrice ? profile.budget : null;
      profile.buildingTypeChanged = true;
    }
    // ── Post-processing: tx-only change → quietly update transaction type ─────
    else if (txOnlyChanged && curTx) {
      profile.transactionType = curTx;
    }

    return profile;
  }

  /* ─── Public: budget anchor table per property type ────────────────────── */

  /**
   * Returns { low, high } price anchor strings for the two-option Q3 budget question.
   * These anchors expose a price range contrast so the customer reveals their budget
   * without being asked directly ("budget berapa?" is forbidden).
   *
   * @param {string} buildingType   - 'house'|'apartment'|'hotel'|'villa'|...
   * @param {string} transactionType- 'rent'|'sale'
   * @param {'id'|'en'} lang
   * @returns {{ low: string, high: string } | null}
   */
  static getBudgetAnchors(buildingType = '', transactionType = '', lang = 'id') {
    const isId  = lang === 'id';
    const tx    = (transactionType || '').toLowerCase();
    const type  = (buildingType    || '').toLowerCase();

    const TABLE = {
      house: {
        rent: { low: isId ? '2–5 juta/bln' : '2–5M/month', high: isId ? '10–25 juta/bln' : '10–25M/month' },
        sale: { low: isId ? '300–800 juta' : '300–800M',    high: isId ? '1–5 miliar'     : '1–5B'         },
      },
      apartment: {
        rent: { low: isId ? '2–5 juta/bln'   : '2–5M/month', high: isId ? '8–20 juta/bln' : '8–20M/month' },
        sale: { low: isId ? '300–700 juta'   : '300–700M',   high: isId ? '1–3 miliar'     : '1–3B'        },
      },
      hotel: {
        rent: { low: isId ? '400–800 ribu/malam' : '400–800K/night', high: isId ? '2–6 juta/malam'  : '2–6M/night' },
        sale: null,
      },
      villa: {
        rent: { low: isId ? '1–3 juta/malam' : '1–3M/night',  high: isId ? '5–15 juta/malam' : '5–15M/night' },
        sale: { low: isId ? '1–3 miliar'     : '1–3B',         high: isId ? '5–20 miliar'     : '5–20B'       },
      },
      boarding_house: {
        rent: { low: isId ? '500rb–1,5 juta/bln' : '500K–1.5M/month', high: isId ? '2–5 juta/bln' : '2–5M/month' },
        sale: null,
      },
      shophouse: {
        rent: { low: isId ? '15–40 juta/bln' : '15–40M/month', high: isId ? '60–150 juta/bln' : '60–150M/month' },
        sale: { low: isId ? '1–3 miliar'     : '1–3B',          high: isId ? '5–20 miliar'     : '5–20B'         },
      },
      office: {
        rent: { low: isId ? '50–100 rb/m²/bln' : '50–100K/m²/month', high: isId ? '150–300 rb/m²/bln' : '150–300K/m²/month' },
        sale: { low: isId ? '2–5 miliar' : '2–5B', high: isId ? '10–30 miliar' : '10–30B' },
      },
      warehouse: {
        rent: { low: isId ? '20–50 juta/bln' : '20–50M/month', high: isId ? '80–200 juta/bln' : '80–200M/month' },
        sale: { low: isId ? '1–3 miliar'     : '1–3B',          high: isId ? '5–15 miliar'     : '5–15B'         },
      },
      store: {
        rent: { low: isId ? '10–30 juta/bln' : '10–30M/month', high: isId ? '50–150 juta/bln' : '50–150M/month' },
        sale: { low: isId ? '500 juta–2 M'  : '500M–2B',       high: isId ? '5–15 miliar'     : '5–15B'         },
      },
      mansion: {
        rent: { low: isId ? '5–15 juta/bln'  : '5–15M/month', high: isId ? '30–100 juta/bln'  : '30–100M/month' },
        sale: { low: isId ? '5–15 miliar'    : '5–15B',         high: isId ? '30–100 miliar'   : '30–100B'       },
      },
      kondotel: {
        rent: { low: isId ? '500rb–1,5 juta/malam' : '500K–1.5M/night', high: isId ? '3–8 juta/malam'  : '3–8M/night' },
        sale: { low: isId ? '500–900 juta'          : '500M–900M',       high: isId ? '1,5–4 miliar'    : '1.5–4B'     },
      },
      others: {
        rent: { low: isId ? '10–30 juta/bln' : '10–30M/month', high: isId ? '50–200 juta/bln' : '50–200M/month' },
        sale: { low: isId ? '500 juta–3 M'  : '500M–3B',       high: isId ? '5–25 miliar'     : '5–25B'         },
      },
    };

    const txKey = (tx === 'rent') ? 'rent' : (tx === 'sale' || tx === 'purchase') ? 'sale' : null;
    const row = TABLE[type];
    if (!row || !txKey) return null;
    return row[txKey] || null;
  }

  /* ─── Public: readiness score ───────────────────────────────────────────── */

  /**
   * Compute how much key info we have (0–5).
   * Score ≥ 3 (transactionType + buildingType + location) = ready to show listings.
   *
   * @param {object} profile - From buildProfile()
   * @returns {number}
   */
  static readinessScore(profile) {
    let s = 0;
    if (profile.transactionType) s++;
    if (profile.buildingType)    s++;
    if (profile.location)        s++;
    if (profile.budget)          s++;
    if (profile.hasMoveInDate)   s++;
    return s;
  }

  /* ─── Public: determine next qualification question ────────────────────── */

  /**
   * Returns the text of the next question to ask, or null when enough info
   * has been collected and we should switch to showing property listings.
   *
   * Questions follow the CUSTOMER FLOW order (Q0–Q12).
   * Already-answered and already-asked questions are skipped automatically.
   *
   * @param {object}      profile      - From buildProfile()
   * @param {'id'|'en'}   lang
   * @param {object|null} priceAnchors - { low, high } price strings from catalog
   * @returns {string|null}
   */
  /**
   * mode = 'catalog' → Ask only core Q0–Q4 + Q8 (fast path to listings)
   * mode = 'summary' → Ask full Q0–Q12 (complete lead brief before handoff)
   */
  static getNextQuestion(profile, lang = 'id', priceAnchors = null, mode = 'catalog') {
    const isId = lang === 'id';
    const tx   = profile.transactionType;  // 'rent' | 'sale' | ''
    const type = profile.buildingType;     // 'house' | 'apartment' | ...
    const loc  = profile.location;

    const txLabel   = tx === 'rent' ? (isId ? 'sewa'  : 'rent')  : (isId ? 'beli'  : 'buy');
    const txLabelPP = tx === 'rent' ? (isId ? 'sewa'  : 'rent')  : (isId ? 'dibeli': 'buy');
    const typeLabel = type ? PropertyFormatter.humanBuildingType(type, lang) : null;

    /* ── Priority 0: Summary already shown → restart Q1 for a new search ── */
    if (profile.summaryAlreadyShown) {
      if (tx && type) {
        // Customer already specified type+tx in this message → ask location (Q2)
        return isId
          ? `Baik! 😊 Untuk pencarian *${txLabel} ${typeLabel}* yang baru — di kota atau area mana yang Anda pertimbangkan? 📍`
          : `Sure! 😊 For your new *${txLabel} ${typeLabel}* search — which city or area are you considering? 📍`;
      }
      // Type/tx not stated yet → ask Q0/Q1
      return isId
        ? `Baik! 😊 Untuk pencarian baru, mau *sewa* atau *beli*? Dan tipe properti apa yang dicari?\n\nSaya punya: *rumah, apartemen, villa, kos-kosan, ruko, kantor, gudang*, dan banyak lagi 🏡`
        : `Sure! 😊 For your new search — looking to *rent* or *buy*? And what type of property?\n\nI have: *house, apartment, villa, boarding house, shophouse, office, warehouse*, and more 🏡`;
    }

    /* ── Q0/Q1 combined: both transaction type AND property type unknown ── */
    if (!tx && !type) {
      return isId
        ? `Halo! 😊 Saya siap bantu carikan properti yang cocok untuk Anda.\n\nBoleh saya tanya dulu — Anda sedang cari untuk *sewa* atau *beli*? Dan tipe properti apa yang diinginkan?\n\nSaya punya: *rumah, apartemen, villa, kos-kosan, ruko, kantor, gudang*, dan banyak lagi 🏡`
        : `Hello! 😊 I'm here to help you find the right property.\n\nMay I ask first — are you looking to *rent* or *buy*? And what type of property do you have in mind?\n\nI have: *house, apartment, villa, boarding house, shophouse, office, warehouse*, and more 🏡`;
    }

    /* ── Q1: transaction type missing (property type known) ── */
    if (!tx && !profile.aiAskedTxType) {
      return isId
        ? `Untuk *${typeLabel}* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠`
        : `For the *${typeLabel}* you're looking for — are you planning to *rent* or *buy*? 🏠`;
    }

    /* ── Q0b: property type missing (transaction type known) ── */
    if (!type && !profile.aiAskedPropType) {
      return isId
        ? `Oke, mau *${txLabel}* properti. Tipe apa yang Anda cari? 🏡\n\nSaya punya: *rumah, apartemen, villa, kos-kosan, ruko, kantor, gudang*, dan banyak pilihan lainnya.`
        : `Got it, looking to *${txLabel}* a property. What type are you looking for? 🏡\n\nI have: *house, apartment, villa, boarding house, shophouse, office, warehouse*, and many more.`;
    }

    /* ── Location: not yet established ── */
    if (!loc && !profile.aiAskedLocation) {
      return typeLabel
        ? (isId
            ? `Oke, mau *${txLabel} ${typeLabel}*. 📍\n\nDi kota atau area mana yang Anda pertimbangkan?`
            : `Got it, looking to *${txLabel} a ${typeLabel}*. 📍\n\nWhich city or area are you considering?`)
        : (isId
            ? `Properti untuk *${txLabel}* — di kota atau area mana yang Anda inginkan? 📍`
            : `Looking to *${txLabel}* — which city or area do you have in mind? 📍`);
    }

    /* ── Q2: search history (highest-value question — fire early, once) ── */
    if (!profile.hasSearchHistory && !profile.aiAskedSearchHist && !profile.customerStatedSearchHistory && profile.aiCount <= 3 && loc) {
      const typeWord = typeLabel
        ? (isId ? typeLabel : PropertyFormatter.humanBuildingType(type, 'en'))
        : (isId ? 'properti' : 'property');
      return isId
        ? `Sudah lihat berapa ${typeWord} di *${loc}*? Apa yang membuat belum cocok dari yang sudah dilihat?`
        : `How many ${typeWord} options have you seen in *${loc}*? What hasn't quite worked about the ones you've viewed?`;
    }

    /* ── Q3-pre: ambiguous budget — no unit given, ask to clarify ── */
    if (profile.budgetAmbiguous && !profile.aiAskedBudget) {
      const { rawMin, rawMax } = profile.budgetAmbiguous;
      return isId
        ? `Untuk harga *${rawMin}-${rawMax}* — maksudnya dalam *ribu*, *juta*, *miliar*, atau *triliun*? 💰\n(Contoh: "${rawMin}-${rawMax} juta")`
        : `When you say *${rawMin}-${rawMax}* — do you mean *thousand*, *million*, or *billion*? 💰\n(Example: "${rawMin}-${rawMax} million")`;
    }

    /* ── Q3: budget via two price anchors (NEVER a direct ask) ── */
    // Skip if: budget in filters, AI already asked Q3, or customer already stated a number+unit amount.
    // The customerStatedBudget guard prevents Q3 from looping when filters.budget is null
    // for any reason (period mismatch, DB timing, edge case) but customer DID give a number.
    if (!profile.budget && !profile.aiAskedBudget && !profile.customerStatedBudget && loc) {
      // Use passed-in anchors first, then fall back to built-in type-specific table
      const anchors = priceAnchors || ConversationQualifier.getBudgetAnchors(type, tx, lang);
      if (anchors) {
        return isId
          ? `Di *${loc}* ada *${type ? PropertyFormatter.humanBuildingType(type, 'id') : 'properti'}* yang di kisaran *${anchors.low}* dan ada juga yang *${anchors.high}*. Kira-kira yang mana lebih sesuai dengan rencana Anda? 💰`
          : `In *${loc}* I have *${type ? PropertyFormatter.humanBuildingType(type, 'en') : 'property'}* options around *${anchors.low}* and others around *${anchors.high}*. Which range feels closer to your plans? 💰`;
      }
      return isId
        ? `Di *${loc}* saya punya pilihan dengan berbagai kisaran harga. Apakah Anda lebih prefer yang *terjangkau/ekonomis* atau yang *menengah ke atas*? 💰`
        : `In *${loc}* I have options across different price ranges. Do you prefer something more *affordable/economy* or *mid-to-premium range*? 💰`;
    }

    /* ── Q8: move-in / target date (MANDATORY — never skipped) ──
     * Wording adapts to the combination:
     *   beli            → target tanggal proses beli selesai
     *   sewa komersial  → kapan mulai operasional (ruko/kantor/gudang/toko/others)
     *   sewa hunian     → masuk/pindah bulan apa
     * (hotel/kondotel booking pakai check-in via Q14, bukan Q8 ini)
     */
    // Rule 25 (bulan berjalan "Juni") & Rule 35 ("Segera"): WAJIB tanya tanggal
    // pastinya dulu sebelum lanjut. Hanya jika belum di-resolve & belum ditanya.
    if (profile.moveInDateAsk && !profile.moveInDateValue && !profile.aiAskedMoveIn) {
      if (profile.moveInDateAsk === 'soon') {
        return isId
          ? `Kak, boleh tau kira-kira tanggalnya? Mohon segera info tanggalnya ya 📅`
          : `Could you let me know roughly which date? Please share it soon 📅`;
      }
      // current_month — tanggal harus ≥ hari ini
      return isId
        ? `Untuk bulan ini, kira-kira tanggal berapa rencananya, Kak? 📅`
        : `For this month, around which date are you planning? 📅`;
    }

    if (!profile.hasMoveInDate && !profile.aiAskedMoveIn) {
      const isCommercial = ['shophouse', 'office', 'warehouse', 'store', 'others'].includes(type);
      if (tx === 'sale') {
        return isId
          ? `Ada target kapan proses belinya mau selesai? 📅`
          : `Is there a target date to close the purchase? 📅`;
      }
      if (isCommercial) {
        return isId
          ? `Kapan rencananya mulai operasional? 📅`
          : `When do you plan to start operations? 📅`;
      }
      return isId
        ? `Rencananya masuk atau pindah bulan apa? 📅`
        : `What month are you planning to move in? 📅`;
    }

    /* ── Q4: household composition (infers bedrooms, reveals decision maker) ── */
    if (!profile.hasHouseholdInfo && !profile.aiAskedHousehold && !profile.customerStatedHousehold) {
      return isId
        ? `Nanti akan tinggal bersama siapa saja? Biar saya bisa carikan yang pas jumlah kamarnya 🛏️`
        : `Who will be living there with you? That helps me find the right number of bedrooms 🛏️`;
    }

    /* ── Q11: furnishing preference (sewa only) ── */
    if (!profile.hasFurnishing && !profile.aiAskedFurnish && tx === 'rent') {
      return isId
        ? `Untuk furnitur, lebih prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan* saja? 🛋️`
        : `For furnishing, do you prefer *fully furnished*, *semi-furnished*, or *unfurnished*? 🛋️`;
    }

    /* ── Q_FAC: facilities/amenities (WAJIB untuk SEWA — tanyakan sebelum summary) ── */
    if (tx === 'rent' && !profile.hasFacilities && !profile.aiAskedFacilities) {
      return isId
        ? `Ada fasilitas tertentu yang Anda inginkan? Misalnya AC, kolam renang, gym, keamanan 24 jam, atau yang lainnya? 🏊`
        : `Any specific facilities you'd like? For example AC, swimming pool, gym, 24-hour security, or others? 🏊`;
    }

    /* ══════════════════════════════════════════════════════════════════════
     * BELI FLOW — pengganti durasi sewa (Q_KPR → Q_KPR-a → Q_COND)
     * Membedakan 24 kombinasi: untuk transaksi BELI, financing + kondisi
     * menggantikan durasi sewa + payment terms.
     * ══════════════════════════════════════════════════════════════════════ */
    if (tx === 'sale') {
      const isCommercial = ['shophouse', 'office', 'warehouse', 'store', 'hotel', 'kondotel', 'others'].includes(type);

      /* ── Q_KPR: pembiayaan (MANDATORY beli) ── */
      if (!profile.hasFinancing && !profile.aiAskedFinancing) {
        if (type === 'others') {
          return isId
            ? `Untuk pembiayaan, rencananya *cash* atau *KPR*? (untuk tanah biasanya KPT — Kredit Pemilikan Tanah) 💳`
            : `For financing, will it be *cash* or a *loan*? (land usually uses a Land Ownership Credit/KPT) 💳`;
        }
        if (isCommercial) {
          return isId
            ? `Untuk pembiayaan, rencananya *cash*, *KPR komersial*, atau *kombinasi*? 💳`
            : `For financing, *cash*, *commercial mortgage*, or a *combination*? 💳`;
        }
        return isId
          ? `Untuk pembiayaan, rencananya *cash* atau *KPR*? 💳`
          : `For financing, will it be *cash* or a *mortgage (KPR)*? 💳`;
      }

      /* ── Q_KPR-a: kesiapan KPR (bank + DP) — hanya jika KPR/kombinasi ── */
      if (profile.financingIsKPR && !profile.hasKprDetails && !profile.aiAskedKprDetails) {
        return isId
          ? `Sudah ada gambaran bank yang dituju, atau perlu saya bantu rekomendasikan? Dan DP-nya kira-kira berapa persen yang disiapkan? 🏦`
          : `Do you already have a target bank, or should I recommend one? And roughly what down-payment percentage are you preparing? 🏦`;
      }

      /* ── Q_COND: kondisi properti (beli residensial: rumah/apartemen/mansion) ── */
      if (['house', 'apartment', 'mansion'].includes(type)
          && !profile.hasPropertyCondition && !profile.aiAskedPropertyCondition) {
        return type === 'apartment'
          ? (isId
              ? `Untuk kondisi unit, prefer yang *baru/primary* dari developer, atau *secondary* yang sudah jadi? 🏢`
              : `For condition, do you prefer *new/primary* from the developer, or *secondary* (ready) units? 🏢`)
          : (isId
              ? `Untuk kondisi, lebih prefer yang *baru/ready*, *second* kondisi baik, atau *inden* tidak masalah? 🏠`
              : `For condition, do you prefer *new/ready*, a good-condition *second-hand*, or is *off-plan/inden* okay? 🏠`);
      }

      /* ── Q11-beli: furnishing (residensial beli, if not stated) ── */
      if (['house', 'apartment', 'mansion'].includes(type)
          && !profile.hasFurnishing && !profile.aiAskedFurnish) {
        return isId
          ? `Untuk furnitur, prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan*? 🛋️`
          : `For furnishing, do you prefer *furnished*, *semi-furnished*, or *unfurnished*? 🛋️`;
      }
    }

    /* ══════════════════════════════════════════════════════════════════════
     * SUMMARY MODE ONLY (Q5–Q9, Q10–Q10a, Q12)
     * Pertanyaan di bawah ini HANYA ditanyakan ketika mode = 'summary'
     * (RESPOND_CATALOG_RUN=OFF) untuk membangun lead brief yang lengkap.
     * Pada catalog mode, kita langsung tampilkan listing setelah Q4.
     * ══════════════════════════════════════════════════════════════════════ */
    if (mode === 'summary') {

      /* ── Q5: Red flags (only if not captured in Q2 answer) ── */
      if (!profile.hasRedFlags && !profile.aiAskedRedFlags && profile.aiAskedSearchHist) {
        return isId
          ? `Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua? 🚫`
          : `Anything you want to avoid? Like west-facing, noisy streets, narrow alleys, or older buildings? 🚫`;
      }

      /* ── Q6: Anchor point (only if not surfaced in Q2) ── */
      if (!profile.hasAnchorPoint && !profile.aiAskedAnchorPoint && loc) {
        return isId
          ? `Ada lokasi tertentu yang jadi patokan? Misalnya dekat sekolah anak, kantor, atau mall tertentu? 📍`
          : `Any specific landmark that matters? Like near a school, office, or certain mall? 📍`;
      }

      /* ── Q7: Alternative areas (always unless already volunteered) ── */
      if (!profile.hasAlternativeArea && !profile.aiAskedAltArea && loc) {
        return isId
          ? `Selain lokasi *${loc}*, apakah Anda mau pilihan lokasi lainnya? 🗺️`
          : `Besides *${loc}*, are there nearby neighborhoods you'd consider? 🗺️`;
      }

      /* ── Q9: Decision maker / viewing logistics (never ask directly) ── */
      if (!profile.hasDecisionMaker && !profile.aiAskedDecisionMaker && profile.hasMoveInDate) {
        return isId
          ? `Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain? 📅`
          : `If I find a match, can you schedule a viewing on the spot, or would you need to coordinate with family first? 📅`;
      }

      /* ── Q10: Lease duration (sewa only, duration not volunteered) ── */
      if (tx === 'rent' && !profile.hasLeaseDuration && !profile.aiAskedLeaseDuration) {
        return isId
          ? `Rencananya sewa untuk berapa lama? ⏱️`
          : `How long are you planning to lease? ⏱️`;
      }

      /* ── Q10a: Payment terms (only when lease duration ≥ 1 year) ── */
      if (tx === 'rent' && profile.hasLeaseDuration && !profile.hasPaymentTerms && !profile.aiAskedPaymentTerms) {
        // Only ask if customer mentioned multi-year lease
        const custText = profile._custText || '';
        const isLongLease = /\b[1-9]\d*\s*(tahun|year)/i.test(custText) || /\bsetahun\b|\bsatu tahun\b/i.test(custText);
        if (isLongLease) {
          return isId
            ? `Untuk pembayaran, biasanya lebih cocok bayar di muka penuh atau ada yang bisa cicil? 💳`
            : `For payment, would you prefer lump-sum upfront or is there flexibility for installments? 💳`;
        }
      }

      /* ── Q12: Apartment-specific branching ── */
      if (type === 'apartment' && !profile.hasApartmentPrefs && !profile.aiAskedApartmentPrefs) {
        return isId
          ? `Untuk apartemen, ada preferensi tower atau lantai tertentu? Misalnya hadap timur, lantai rendah/tengah/tinggi? 🏢`
          : `For the apartment, any tower or floor preference? Like east-facing, low/mid/high floor? 🏢`;
      }

      /* ── Q14: Type-specific slots (one slot per message, skip if already answered) ── */

      // Hotel / Kondotel booking: dates + room type + breakfast
      if ((type === 'hotel' || (type === 'kondotel' && tx === 'rent'))) {
        if (!profile.hasCheckInDate && !profile.aiAskedCheckIn)
          return isId ? `Rencananya check-in tanggal berapa? 📅` : `What is your planned check-in date? 📅`;
        if (!profile.hasCheckOutDate && !profile.aiAskedCheckOut)
          return isId ? `Check-out tanggal berapa? (atau berapa malam?) 🌙` : `Check-out date? (or how many nights?) 🌙`;
        if (!profile.hasRoomType && !profile.aiAskedRoomType)
          return isId ? `Tipe kamar yang diinginkan? *Standard*, *Deluxe*, *Suite*, atau *Family room*? 🛏️` : `Preferred room type? *Standard*, *Deluxe*, *Suite*, or *Family room*? 🛏️`;
        if (!profile.hasBreakfastPref && !profile.aiAskedBreakfast)
          return isId ? `Termasuk *breakfast* ya? Atau tanpa breakfast juga oke? ☕` : `Do you want *breakfast included*, or room only is fine? ☕`;
      }

      // Villa sewa: rental period + private pool
      if (type === 'villa' && tx === 'rent') {
        if (!profile.hasRentalPeriod && !profile.aiAskedRentalPeriod)
          return isId ? `Sewa villa-nya per *malam*, per *minggu*, atau per *bulan*? ⏱️` : `Renting the villa per *night*, per *week*, or per *month*? ⏱️`;
        if (!profile.hasPrivatePool && !profile.aiAskedPrivatePool)
          return isId ? `Perlu villa dengan *private pool*? Atau shared pool juga oke? 🏊` : `Do you need a villa with a *private pool*, or is a shared pool okay? 🏊`;
        if (!profile.hasCheckInDate && !profile.aiAskedCheckIn && profile.hasRentalPeriod)
          return isId ? `Tanggal check-in? 📅` : `Check-in date? 📅`;
      }

      // Villa beli: private pool mandatory check
      if (type === 'villa' && tx === 'sale') {
        if (!profile.hasPrivatePool && !profile.aiAskedPrivatePool)
          return isId ? `Untuk villa, wajib ada *private pool*? Ini biasanya jadi standar villa premium. 🏊` : `For the villa, is a *private pool* a must? It's usually a standard for premium villas. 🏊`;
      }

      // Kos: type + bathroom
      if (type === 'boarding_house') {
        if (!profile.hasKosType && !profile.aiAskedKosType)
          return isId ? `Kos yang dicari untuk *putra*, *putri*, atau *campur*? 🏠` : `Looking for *male-only*, *female-only*, or *mixed* boarding house? 🏠`;
        if (!profile.hasBathroomType && !profile.aiAskedBathroomType)
          return isId ? `Kamar mandi *dalam* (en-suite) atau *luar* (shared) oke? 🚿` : `*Private bathroom* (en-suite) or *shared bathroom* is okay? 🚿`;
      }

      // Ruko / Shophouse: business type + floors
      if (type === 'shophouse') {
        if (!profile.hasBusinessType && !profile.aiAskedBusinessType)
          return isId ? `Bisnis apa yang akan dijalankan di sana? 🏪` : `What kind of business will be run there? 🏪`;
        // Beli: tenant status (langsung cashflow jika sudah ada tenant)
        if (tx === 'sale' && !profile.hasTenantStatus && !profile.aiAskedTenantStatus)
          return isId ? `Prefer ruko *kosong* atau yang sudah ada *tenant* berjalan? (tenant existing = langsung cashflow) 🏪` : `Do you prefer an *empty* shophouse or one with an *existing tenant*? (existing tenant = instant cashflow) 🏪`;
      }

      // Toko / Store: business type + (beli) mal-prime vs trade center + tenant status
      if (type === 'store') {
        if (!profile.hasBusinessType && !profile.aiAskedBusinessType)
          return isId ? `Bisnis apa yang akan dibuka di toko ini? Dan lebih prefer di *mal/pusat perbelanjaan* atau *standalone*? 🛍️` : `What business will open here? And do you prefer a *mall* unit or *standalone*? 🛍️`;
        if (tx === 'sale' && !profile.hasTenantStatus && !profile.aiAskedTenantStatus)
          return isId ? `Prefer unit *mal prime* (stabil) atau *trade center* (yield lebih tinggi)? Dan unit kosong atau sudah ada penyewa? 🛍️` : `Prefer a *prime mall* unit (stable) or *trade center* (higher yield)? And empty or with an existing tenant? 🛍️`;
      }

      // Kantor / Office: headcount + building grade
      if (type === 'office') {
        if (!profile.hasHeadcount && !profile.aiAskedHeadcount)
          return isId ? `Berapa orang yang akan bekerja di kantor ini? (untuk tentukan luas & grade gedung) 👥` : `How many people will work in this office? (to determine size & building grade) 👥`;
        if (!profile.hasBusinessType && !profile.aiAskedBusinessType)
          return isId ? `Preferensi gedung *Grade A* (premium), *Grade B* (mid), atau *Grade C* (ekonomis)? 🏢` : `Preference: *Grade A* (premium), *Grade B* (mid), or *Grade C* (economy) building? 🏢`;
      }

      // Mansion: private pool check
      if (type === 'mansion') {
        if (!profile.hasPrivatePool && !profile.aiAskedPrivatePool)
          return isId ? `Untuk mansion, wajib ada *private pool*? Ini hampir selalu jadi standar mansion premium. 🏊` : `Is a *private pool* mandatory for the mansion? It's nearly always standard for premium properties. 🏊`;
      }

      // Kondotel beli: ROI expectation
      if (type === 'kondotel' && tx === 'sale') {
        if (!profile.hasRoiExpectation && !profile.aiAskedRoi)
          return isId ? `Target ROI per tahun berapa? (misalnya 7%, 10%, atau lebih?) 📈` : `What's your target annual ROI? (e.g. 7%, 10%, or higher?) 📈`;
        if (!profile.hasRoomType && !profile.aiAskedRoomType)
          return isId ? `Tipe unit yang paling laku disewakan? *Studio* atau *1 kamar* biasanya ROI terbaik. 🛏️` : `Which unit type rents best? *Studio* or *1-bedroom* usually gives the best ROI. 🛏️`;
      }

      // Gudang / Warehouse: purpose + (beli) zonasi/legalitas
      if (type === 'warehouse') {
        if (!profile.hasBusinessType && !profile.aiAskedBusinessType)
          return isId ? `Gudangnya untuk apa — *produksi*, *distribusi*, atau *penyimpanan*? 📦` : `What is the warehouse for — *production*, *distribution*, or *storage*? 📦`;
        if (tx === 'sale' && !profile.hasZonasi && !profile.aiAskedZonasi)
          return isId ? `Perlu pengecekan legalitas *zona industri/pergudangan* sebelum deal? (agar tidak salah peruntukan) 📋` : `Should we verify the *industrial/warehouse zoning* legality before the deal? 📋`;
      }

      // Properti Lainnya: purpose first + (beli) sertifikat & zonasi
      if (type === 'others') {
        if (!profile.hasPropertyPurpose && !profile.aiAskedPropertyPurpose)
          return isId ? `Properti ini rencananya untuk tujuan apa? (parkir, event, pertanian, pabrik, klinik, dll) 🏗️` : `What is the planned purpose of this property? (parking, events, farming, factory, clinic, etc.) 🏗️`;
        if (tx === 'sale' && !profile.hasZonasi && !profile.aiAskedZonasi)
          return isId ? `Perlu pengecekan *sertifikat (SHM)* dan *zonasi* sebelum deal? (agar peruntukannya sesuai rencana) 📋` : `Should we verify the *certificate (SHM)* and *zoning* before the deal? 📋`;
      }
    }
    /* ── End summary-only questions ── */

    /* ── All applicable questions asked → ready to proceed ── */
    return null;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * HOUSE v2 PILOT — agent-representative qualifier (building_type=house only)
   *   - Unnamed assistant: "asisten dari ${agentName} (${appName})"
   *   - Adds MOTIVATION (QM) + FINANCING READINESS (QF: method/DP/approval/contingency)
   *   - Ends with a HANDOFF (no "saya carikan") + an internal [BRIEF_READY]
   * Enabled when HOUSE_PILOT_V2 !== 'OFF' and buildingType === 'house'.
   * Returns the next question text, or null when ready to hand off.
   * ═══════════════════════════════════════════════════════════════════════════ */
  static housePilotEnabled(profile) {
    return String(process.env.HOUSE_PILOT_V2 || 'ON').toUpperCase() !== 'OFF'
      && profile.buildingType === 'house';
  }

  static getNextQuestionHousePilot(profile, lang = 'id', priceAnchors = null, agentName = '', appName = '') {
    const isId  = lang === 'id';
    const tx    = profile.transactionType;            // 'rent' | 'sale' | ''
    const loc   = profile.location;
    const agent = agentName || appName || (isId ? 'agen kami' : 'our agent');
    const greet = profile.aiCount === 0
      ? (isId
          ? `Halo Kak, saya asisten dari *${agent}*${appName ? ` (*${appName}*)` : ''}. Saya bantu catat kebutuhannya dulu ya. `
          : `Hi Kak, I'm the assistant for *${agent}*${appName ? ` (*${appName}*)` : ''}. Let me note your needs first. `)
      : '';

    /* ── New search after handoff → restart ── */
    if (profile.summaryAlreadyShown) {
      return isId
        ? `Baik, Kak! Untuk pencarian rumah yang baru — rencananya *beli* atau *sewa*?`
        : `Sure! For your new house search — looking to *buy* or *rent*?`;
    }

    /* ── Transaction type ── */
    if (!tx && !profile.aiAskedTxType) {
      return greet + (isId
        ? `Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠`
        : `For the house, are you looking to *buy* or *rent*, Kak? 🏠`);
    }

    /* ── Q3: Location ── */
    if (!loc && !profile.aiAskedLocation) {
      return greet + (isId
        ? `Rumahnya di kota atau area mana yang Kak incar? 📍`
        : `Which city or area are you looking at, Kak? 📍`);
    }

    /* ── QM: Motivation / why now (HIGH VALUE) ── */
    if (!profile.hasMotivation && !profile.aiAskedMotivation) {
      return isId
        ? `Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang? Misalnya mau pindah, keluarga nambah, pindah kerja, atau untuk investasi?`
        : `May I ask what's prompting your house search now, Kak? E.g. moving, growing family, a job relocation, or investment?`;
    }

    /* ── Q4: Search history (gold-mine) ── */
    if (!profile.hasSearchHistory && !profile.aiAskedSearchHist && !profile.customerStatedSearchHistory && profile.aiCount <= 4) {
      return isId
        ? `Sebelumnya sudah sempat lihat beberapa rumah, Kak? Kalau sudah, biasanya apa yang bikin belum cocok?`
        : `Have you viewed a few houses already, Kak? If so, what usually hasn't quite fit?`;
    }

    /* ── Q5: Budget via two options (never direct) ── */
    if (!profile.budget && !profile.aiAskedBudget && !profile.customerStatedBudget && loc) {
      const anchors = priceAnchors || ConversationQualifier.getBudgetAnchors('house', tx, lang);
      if (anchors) {
        return isId
          ? `Di *${loc}* ada yang di kisaran *${anchors.low}* dan ada yang lebih di *${anchors.high}*. Kira-kira yang mana lebih mendekati rencana Kak? 💰`
          : `In *${loc}* there are options around *${anchors.low}* and others higher at *${anchors.high}*. Which is closer to your plan, Kak? 💰`;
      }
      return isId
        ? `Untuk budget rumah di *${loc}*, Kak lebih prefer yang *terjangkau* atau yang *menengah ke atas*? 💰`
        : `For your house budget in *${loc}*, do you prefer *affordable* or *mid-to-upper* range? 💰`;
    }

    /* ── Q6: Occupants → infer bedrooms (never ask rooms directly) ── */
    if (!profile.hasHouseholdInfo && !profile.aiAskedHousehold) {
      return isId
        ? `Nanti akan ditinggali bersama siapa saja, Kak? Biar saya catat jumlah kamar yang pas 🛏️`
        : `Who will be living there with you, Kak? So I can note the right number of bedrooms 🛏️`;
    }

    if (tx === 'sale') {
      /* ── QF: Financing method (WAJIB, ranks the lead) ── */
      if (!profile.hasFinancing && !profile.aiAskedFinancing) {
        return isId
          ? `Untuk pembeliannya, rencana pakai *KPR* atau *cash*, Kak?`
          : `For the purchase, are you planning *mortgage (KPR)* or *cash*, Kak?`;
      }
      /* ── QF-a (KPR): approval + DP readiness ── */
      if (profile.financingIsKPR && !profile.hasKprDetails && !profile.aiAskedKprDetails) {
        return isId
          ? `Untuk KPR-nya, sudah sempat cek atau ajukan ke bank, atau masih rencana, Kak? Biar *${agent}* bisa bantu siapkan dari awal. (Sekalian, DP-nya kira-kira berapa persen?)`
          : `For the mortgage, have you checked or applied with a bank yet, or still planning, Kak? So *${agent}* can help prepare early. (And roughly what DP percentage?)`;
      }
      /* ── QF-b (cash from sale): contingency status ── */
      if (profile.financingCash && profile.financingFromSale
          && !profile.hasContingencyStatus && !profile.aiAskedContingency) {
        return isId
          ? `Oh, dananya dari hasil penjualan aset ya — asetnya sudah terjual atau masih proses, Kak? Ini penting untuk timing-nya.`
          : `Ah, the funds come from selling an asset — is it already sold or still in progress, Kak? This matters for timing.`;
      }
      /* ── Q8: Target timeline ── */
      if (!profile.hasMoveInDate && !profile.aiAskedMoveIn) {
        return isId
          ? `Ada target kapan rencananya proses belinya, Kak? 📅`
          : `Is there a target timeline to close the purchase, Kak? 📅`;
      }
    } else {
      /* ── Q8: Move-in date (sewa) ── */
      if (!profile.hasMoveInDate && !profile.aiAskedMoveIn) {
        return isId
          ? `Rencananya masuk bulan apa, Kak? 📅`
          : `Which month are you planning to move in, Kak? 📅`;
      }
    }

    /* ── Q9: Decision maker (indirect) ── */
    if (!profile.hasDecisionMaker && !profile.aiAskedDecisionMaker) {
      return isId
        ? `Kalau nanti ada yang cocok, langsung bisa jadwalkan survey, atau perlu koordinasi dulu dengan keluarga, Kak?`
        : `When something fits, can you schedule a viewing right away, or coordinate with family first, Kak?`;
    }

    /* ── Q7: Red flags (if not captured at Q4) ── */
    if (!profile.hasRedFlags && !profile.aiAskedRedFlags && profile.aiAskedSearchHist) {
      return isId
        ? `Ada yang pasti Kak hindari? Misalnya rawan banjir, hadap barat, gang sempit, atau dekat jalan terlalu ramai? 🚫`
        : `Anything you definitely want to avoid? E.g. flood-prone, west-facing, narrow alley, or too-busy road? 🚫`;
    }

    /* ── QA: Alternative areas ── */
    if (!profile.hasAlternativeArea && !profile.aiAskedAltArea && loc) {
      return isId
        ? `Selain *${loc}*, ada area lain yang masih oke buat Kak pertimbangkan? 🗺️`
        : `Besides *${loc}*, any other areas you'd consider, Kak? 🗺️`;
    }

    if (tx === 'sale') {
      /* ── Q11: Condition (beli) ── */
      if (!profile.hasPropertyCondition && !profile.aiAskedPropertyCondition) {
        return isId
          ? `Kondisinya Kak prefer yang *baru*, *second* yang terawat, atau *inden* tidak masalah?`
          : `For condition, do you prefer *new*, a well-kept *second-hand*, or is *off-plan* okay?`;
      }
    } else {
      /* ── Q10: Lease duration (sewa) ── */
      if (!profile.hasLeaseDuration && !profile.aiAskedLeaseDuration) {
        return isId
          ? `Sewa rencananya berapa lama, Kak? ⏱️`
          : `How long do you plan to rent, Kak? ⏱️`;
      }
      /* ── Q10a: Payment terms (lease ≥ 1 year) ── */
      if (profile.hasLeaseDuration && !profile.hasPaymentTerms && !profile.aiAskedPaymentTerms) {
        const longLease = /\b[1-9]\d*\s*(tahun|year)/i.test(profile._custText || '') || /\bsetahun\b/i.test(profile._custText || '');
        if (longLease) {
          return isId
            ? `Untuk pembayaran, lebih cocok bayar di muka penuh atau ada yang bisa cicil per 6 bulan, Kak? 💳`
            : `For payment, full upfront or installments every 6 months work better, Kak? 💳`;
        }
      }
      /* ── Q11: Furnished (sewa) ── */
      if (!profile.hasFurnishing && !profile.aiAskedFurnish) {
        return isId
          ? `Furniturnya prefer *Full Furnished*, *Semi*, atau *Kosongan*, Kak? 🛋️`
          : `For furnishing, do you prefer *Fully Furnished*, *Semi*, or *Unfurnished*, Kak? 🛋️`;
      }
      /* ── Q_FAC: facilities/amenities (WAJIB untuk SEWA) ── */
      if (!profile.hasFacilities && !profile.aiAskedFacilities) {
        return isId
          ? `Ada fasilitas tertentu yang Kak inginkan? Misalnya AC, kolam renang, gym, keamanan 24 jam, atau lainnya? 🏊`
          : `Any specific facilities you'd like, Kak? E.g. AC, swimming pool, gym, 24-hour security, or others? 🏊`;
      }
    }

    /* ── All captured → hand off ── */
    return null;
  }

  /**
   * Build the internal [BRIEF_READY] object + score/priority for the house pilot.
   * Never shown to the customer — returned in response metadata for the agent.
   */
  static buildHousePilotBrief(profile, filters = {}, history = [], userMessage = '') {
    const qs = (() => { try { return extractQualificationState(history, userMessage); } catch (_e) { return {}; } })();
    const isSale = profile.transactionType === 'sale';

    const method = !profile.hasFinancing ? 'unknown'
      : profile.financingIsKPR ? 'KPR'
      : (profile.financingCash && profile.financingFromSale) ? 'cash'
      : profile.financingCash ? 'cash' : 'unknown';
    const contingency = profile.financingFromSale ? 'sale-of-current-property' : (profile.hasFinancing ? 'none' : 'unknown');
    const contingencyStatus = profile.financingFromSale
      ? (profile.hasContingencyStatus ? 'in-progress' : 'unknown') : 'n/a';
    const approval = profile.financingIsKPR
      ? (profile.hasKprDetails ? 'applied/pre-approved' : 'not-started') : (profile.financingCash ? 'n/a' : 'unknown');
    const dpReady = profile.hasKprDetails ? 'ready/partial' : 'unknown';

    // financing_readiness = 2 only if method known AND (dp or approval known) AND contingency surfaced
    const financingReady = (method !== 'unknown')
      && (profile.hasKprDetails || profile.financingCash)
      && (contingency !== 'unknown');

    // Scoring (beli weighting; sewa skips financing, leans on motivation+timeline)
    let score = 0;
    if (profile.budget) score += 2;
    if (isSale) { if (financingReady) score += 2; }
    else        { if (profile.hasLeaseDuration || profile.hasFurnishing) score += 1; }
    if (profile.location) score += 1;
    if (profile.hasMoveInDate) score += 1;
    if (profile.hasHouseholdInfo) score += 1;
    if (profile.hasDecisionMaker) score += 1;
    if (profile.hasMotivation) score += 1;
    score = Math.min(score, 9);

    let priority = score >= 7 ? 'HOT' : score >= 4 ? 'WARM' : 'INCOMPLETE';
    // Cash-from-unsold-asset → cap at WARM and flag
    let agentNote = null;
    if (isSale && profile.financingFromSale && contingencyStatus !== 'sold') {
      if (priority === 'HOT') priority = 'WARM';
      agentNote = 'Cash dependent on an unsold asset — do NOT treat as cash-ready; timing depends on the sale.';
    }
    if (isSale && method === 'KPR' && approval === 'not-started') {
      agentNote = agentNote || 'KPR not-started / DP unknown — qualify financing before viewing.';
    }

    const tag = (v) => (v ? 'stated' : 'unknown');
    const brief = {
      property_type: 'rumah',
      transaction: isSale ? 'beli' : 'sewa',
      market: profile.hasPropertyCondition ? 'primary|secondary' : 'unknown',
      motivation_source: tag(profile.hasMotivation),
      location_city: filters.location || (qs.location || null),
      location_source: tag(!!profile.location),
      budget: filters.budget?.text || qs.budget || null,
      budget_source: tag(!!profile.budget),
      financing: isSale ? {
        method, dp_readiness: dpReady, approval_status: approval,
        contingency, contingency_status: contingencyStatus,
      } : undefined,
      occupants_source: tag(profile.hasHouseholdInfo),
      target_timeline: qs.moveInDate || null,
      timeline_source: tag(profile.hasMoveInDate),
      decision_maker_source: tag(profile.hasDecisionMaker),
      condition_pref_source: isSale ? tag(profile.hasPropertyCondition) : undefined,
      furnished_source: !isSale ? tag(profile.hasFurnishing) : undefined,
      red_flags_captured: !!profile.hasRedFlags,
      anchor_captured: !!profile.hasAnchorPoint,
      search_stage: profile.hasSearchHistory ? 'active' : 'early',
      score, priority,
      agent_note: agentNote,
    };
    return { score, priority, brief, agentNote };
  }

  /* ─── Public: build agent brief from profile ────────────────────────────── */

  /**
   * Builds a structured agent brief object from the conversation profile.
   * Used to generate the summary shown to customer + the data sent to agent.
   *
   * Fields are tagged as 'stated' (customer said it) or 'inferred' (AI read it).
   *
   * @param {object}   profile     - From buildProfile()
   * @param {object}   filters     - Extracted property filters
   * @param {object[]} history     - Conversation history
   * @param {string}   userMessage - Latest customer message
   * @returns {object} Agent brief
   */
  static buildAgentBrief(profile, filters = {}, history = [], userMessage = '') {
    // ── Use extractQualificationState for authoritative field values ──────────
    // Applies Phase 0 (active-session scoping) + Phase 2 (AI→Customer pair matching).
    // This prevents stale data from old sessions from polluting move-in dates,
    // anchor points, decision-maker labels, and lease durations.
    const qualState = extractQualificationState(history, userMessage);

    const custText = this.#customerText(history, userMessage);

    // Helper: detect if a field was stated (explicit keywords) or inferred
    const wasStated = (text, keywords) => this.#has(text, keywords);

    const brief = {
      // ─ Core 4 ─
      transactionType: {
        value : filters.transactionType || 'UNKNOWN',
        source: wasStated(custText, ['sewa', 'beli', 'rent', 'buy', 'jual']) ? 'stated' : 'inferred',
      },
      buildingType: {
        value : filters.buildingType || 'UNKNOWN',
        source: wasStated(custText, ['rumah', 'apartemen', 'apartment', 'villa', 'kos', 'ruko', 'gudang', 'kantor', 'hotel'])
          ? 'stated' : 'inferred',
      },
      location: {
        value : filters.location || 'UNKNOWN',
        source: 'stated', // location always stated
      },
      budget: {
        // Append the rental period basis the customer stated ("/2 minggu", "/bulan").
        // Skip budget yang AMBIGU (mis. "15-20" tanpa unit dari "lantai 15-20") —
        // jangan tampilkan sebagai budget asli.
        value : (filters.budget?.text && !filters.budget?.ambiguous)
          ? filters.budget.text + ConversationQualifier.#budgetPeriodSuffix(custText)
          : 'UNKNOWN',
        source: wasStated(custText, ['juta', 'ribu', 'miliar', 'jt', 'm ', 'rb', 'budget', 'harga'])
          ? 'stated' : 'inferred',
      },

      // ─ Extended fields ─
      moveInDate: {
        // Prefer qualState.moveInDate (Phase 0+Phase 1 scoped, full date string e.g. "7 juli 2026")
        // over regex extraction which may pick up stale month names from old sessions.
        value : qualState.moveInDate
          ? this.#capitalizeDate(qualState.moveInDate)
          : (profile.hasMoveInDate ? this.#extractMoveInDate(custText) : 'UNKNOWN'),
        source: (qualState.moveInDate || profile.hasMoveInDate) ? 'stated' : 'UNKNOWN',
      },
      decisionMaker: {
        // Prefer qualState.decisionMaker (Phase 2 normalized: "Sendirian", "Mandiri",
        // "Koordinasi dengan pasangan", etc.) over extraction from full custText.
        // Gate fallback by profile flags to prevent stale Q4 data from old sessions.
        value : qualState.decisionMaker
          ? qualState.decisionMaker
          : ((profile.hasDecisionMaker || profile.hasHouseholdInfo)
              ? this.#extractDecisionMaker(custText, profile)
              : 'UNKNOWN'),
        source: (qualState.decisionMaker || profile.hasDecisionMaker || profile.hasHouseholdInfo) ? 'stated' : 'UNKNOWN',
      },
      household: {
        value : profile.hasHouseholdInfo
          ? this.#extractHouseholdSummary(custText)
          : 'UNKNOWN',
        source: profile.hasHouseholdInfo ? 'stated' : 'UNKNOWN',
      },
      furnishing: {
        value : profile.hasFurnishing
          ? this.#extractFurnishing(custText)
          : 'UNKNOWN',
        source: profile.hasFurnishing ? 'stated' : 'inferred',
      },
      leaseDuration: {
        // Prefer qualState.leaseDuration (exact customer response to Q10). Jika customer
        // menyebut durasi LANGSUNG di awal ("butuh sewa 2 minggu") tanpa Q10 ditanya,
        // tetap tangkap via #extractLeaseDuration(custText) — tidak bergantung flag profil.
        // Null saat transaksi bukan rent (menyembunyikan baris di summary).
        value : filters.transactionType === 'rent'
          ? (qualState.leaseDuration || this.#extractLeaseDuration(custText))
          : null,
        source: (qualState.leaseDuration || profile.hasLeaseDuration
                 || this.#extractLeaseDuration(custText) !== 'UNKNOWN') ? 'stated' : 'UNKNOWN',
      },
      viewingPreference: {
        // Q9 — preferensi survey/viewing. Customer bisa minta langsung lihat katalog
        // tanpa survei ("Mau lihat katalognya aja, gak ada waktu survei"), atau minta
        // dijadwalkan viewing. UNKNOWN → baris disembunyikan.
        value : this.#extractViewingPreference(custText),
        source: this.#extractViewingPreference(custText) !== 'UNKNOWN' ? 'stated' : 'UNKNOWN',
      },
      alternativeAreas: {
        value : profile.hasAlternativeArea
          ? this.#extractAlternativeAreas(custText)
          : 'UNKNOWN',
        source: profile.hasAlternativeArea ? 'stated' : 'UNKNOWN',
      },
      redFlags: {
        value : profile.hasRedFlags
          ? this.#extractRedFlags(custText)
          : 'UNKNOWN',
        source: profile.hasRedFlags ? 'stated' : 'UNKNOWN',
      },
      preferences: {
        // Preferensi POSITIF lingkungan/suasana (sejuk, rindang, asri, tenang, dll).
        // Beda dari redFlags (yang dihindari) — ini yang DIINGINKAN customer.
        value : this.#extractPreferences(custText),
        source: this.#extractPreferences(custText) !== 'UNKNOWN' ? 'stated' : 'UNKNOWN',
      },
      anchorPoint: {
        // Prefer qualState.anchorPoint (Phase 2 — exact full customer reply to Q6,
        // e.g. "deket indomaret, cafe dan ubaya"). The raw #extractAnchorPoint fallback
        // is gated on the anchor having actually been ASKED (aiAskedAnchorPoint) —
        // otherwise "deket <kota>" (a location phrase) and joined multi-message text
        // produce a garbage anchor. If never asked → UNKNOWN (shown as "Belum ditanyakan").
        value : qualState.anchorPoint
          ? this.#capitalizeFirst(qualState.anchorPoint)
          : ((profile.hasAnchorPoint && profile.aiAskedAnchorPoint) ? this.#extractAnchorPoint(custText) : 'UNKNOWN'),
        source: (qualState.anchorPoint || (profile.hasAnchorPoint && profile.aiAskedAnchorPoint)) ? 'stated' : 'UNKNOWN',
      },
      facilities: {
        // Customer-requested amenities (gym, kids zone, kolam renang, etc.), accumulated
        // across the session by extractPropertyFilters → detectFacilities.
        value : (Array.isArray(filters.facilities) && filters.facilities.length)
          ? filters.facilities.join(', ')
          : 'UNKNOWN',
        source: (Array.isArray(filters.facilities) && filters.facilities.length) ? 'stated' : 'UNKNOWN',
      },

      // ─ Meta ─
      score        : this.#calcBriefScore(profile, filters),
      aiCount      : profile.aiCount,
    };

    brief.priority = brief.score >= 7 ? 'HIGH' : brief.score >= 4 ? 'NORMAL' : 'INCOMPLETE';
    return brief;
  }

  /* ─── Private: brief field extractors ──────────────────────────────────── */

  static #extractMoveInDate(custText) {
    // Prefer full date expression: "7 Juli 2026", "Juli 2026", or just "Juli"
    // Uses regex to capture day+month+year instead of first-match month scan,
    // which could pick up stale month names from earlier messages.
    const MONTH_ID = 'januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember';
    const MONTH_EN = 'january|february|march|april|may|june|july|august|september|october|november|december';
    // \\b word boundaries prevent "indomaret" from matching "maret", etc.
    const DATE_RE  = new RegExp(`(\\d{1,2})?\\s*\\b(${MONTH_ID}|${MONTH_EN})\\b(?:\\s+(\\d{4}))?`, 'i');
    const dm = custText.match(DATE_RE);
    if (dm) {
      const day   = dm[1] ? dm[1].trim() : '';
      const month = dm[2];
      // Append inferred year when the customer omitted it ("3 September" → "3 September 2026").
      const year  = dm[3] ? dm[3] : String(this.#inferYear(month, day));
      return this.#capitalizeDate(`${day ? day + ' ' : ''}${month} ${year}`.trim());
    }
    if (/bulan depan|next month/.test(custText)) return 'Bulan depan';
    if (/bulan ini|this month/.test(custText))   return 'Bulan ini';
    if (/secepatnya|asap|segera/.test(custText)) return 'Secepatnya (urgent)';
    return 'UNKNOWN';
  }

  /** Infer the year for a bare "DD Month" date: this year if still upcoming, else next year. */
  static #inferYear(monthName, day) {
    const MONTHS = {
      januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5, juli: 6,
      agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
      january: 0, february: 1, march: 2, may: 4, june: 5, july: 6,
      august: 7, october: 9, december: 11, // april/september/november share ID spelling
    };
    const now = new Date();
    const mi  = MONTHS[String(monthName).toLowerCase()];
    if (mi == null) return now.getFullYear();
    const d         = day ? parseInt(day, 10) : 1;
    const candidate = new Date(now.getFullYear(), mi, d);
    const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return candidate < today ? now.getFullYear() + 1 : now.getFullYear();
  }

  /**
   * Rental period basis for the budget, e.g. "/2 minggu", "/bulan", "/malam".
   * Anchored on "/" or "per" so it picks the BUDGET period ("2-4 juta/2 minggu")
   * and NOT a lease-duration phrase ("sewa selama 2 minggu"). '' if none stated.
   */
  static #budgetPeriodSuffix(custText) {
    const UNIT = 'hari|minggu|bulan|tahun|malam|day|week|month|year|night|seminggu|sebulan|setahun|semalam';
    const m = custText.match(new RegExp(`\\/\\s*(\\d+\\s*)?(${UNIT})\\b`, 'i'))
           || custText.match(new RegExp(`\\bper\\s+(\\d+\\s*)?(${UNIT})\\b`, 'i'));
    if (!m) return '';
    const n    = m[1] ? m[1].trim() + ' ' : '';
    const unit = m[2].toLowerCase().replace(/^se/, ''); // seminggu → minggu
    return `/${n}${unit}`;
  }

  static #extractDecisionMaker(custText, profile) {
    if (/sendiri|alone|solo/.test(custText))              return 'Sendirian';
    if (/sama suami|bersama suami|with husband/.test(custText)) return 'Bersama suami';
    if (/sama istri|bersama istri|with wife/.test(custText))    return 'Bersama istri';
    if (/sama pasangan|with partner/.test(custText))      return 'Bersama pasangan';
    if (/sama keluarga|with family/.test(custText))       return 'Bersama keluarga';
    if (/langsung bisa|bisa langsung/.test(custText))     return 'Solo (bisa langsung jadwalkan)';
    if (/koordinasi dulu|perlu diskusi/.test(custText))   return 'Perlu koordinasi (joint decision)';
    if (profile.hasHouseholdInfo) return 'Disebutkan di Q4';
    return 'UNKNOWN';
  }

  static #extractHouseholdSummary(custText) {
    // Non-residential / temporary use (worship, investment, office/business, or a
    // vacation/temporary stay) — not a residential occupancy, so show the USE instead
    // of a bedroom-oriented label. We never asked "tinggal bersama siapa" here.
    const use = detectUseCase(custText);
    if (use) return useCaseLabel(use);
    const childM = custText.match(/(\d+)\s*anak/);
    if (childM) return `Keluarga dengan ${childM[1]} anak`;
    // Explicit headcount of any size (e.g. "15 orang") — a group (≥6) is flagged.
    const headM = custText.match(/\b(\d{1,3})\s*(?:orang|pax|people|tamu|peserta)\b/);
    if (headM) {
      const n = parseInt(headM[1], 10);
      return n >= 6 ? `${n} orang (rombongan/grup)` : `${n} orang`;
    }
    if (/sendiri|alone/.test(custText))          return 'Sendiri';
    if (/berdua|pasangan|couple/.test(custText)) return 'Berdua (pasangan)';
    if (/bertiga/.test(custText))                return '3 orang';
    if (/berempat/.test(custText))               return '4 orang';
    if (/rombongan|grup|group|reuni|arisan|gathering/.test(custText)) return 'Rombongan/grup';
    if (/keluarga besar/.test(custText))         return 'Keluarga besar';
    if (/keluarga/.test(custText))               return 'Keluarga';
    return 'Disebutkan';
  }

  static #extractFurnishing(custText) {
    // Semua varian jawaban customer untuk "semi" dianggap sama:
    //   "semi", "Semi", "semi-furnished", "semi-furnish", "semi furnish" → "Semi furnished".
    if (/full\s*furnish|fully\s*furnished|\bfull\b/.test(custText))            return 'Full furnished';
    if (/semi[\s-]*furnish(?:ed)?|\bsemi\b/.test(custText))                    return 'Semi furnished';
    if (/kosongan|unfurnished|tanpa\s+perabot|\bkosong\b/.test(custText))      return 'Kosongan';
    return 'Disebutkan';
  }

  static #extractLeaseDuration(custText) {
    // Tangkap durasi sewa untuk SEMUA satuan: hari/malam/minggu/bulan/tahun (+ Inggris).
    // Sebelumnya hanya 'tahun' yang ditangkap → "2 minggu", "10 hari", "6 bulan" hilang
    // dari summary. Cari angka+satuan eksplisit (mis. "butuh sewa 2 minggu").
    const m = custText.match(/(\d+)\s*(hari|malam|minggu|bulan|tahun|day|night|week|month|year)s?\b/i);
    if (m) {
      const unitMap = {
        hari: 'hari', day: 'hari', malam: 'malam', night: 'malam',
        minggu: 'minggu', week: 'minggu', bulan: 'bulan', month: 'bulan',
        tahun: 'tahun', year: 'tahun',
      };
      const unit = unitMap[m[2].toLowerCase()] || m[2].toLowerCase();
      return `${m[1]} ${unit}`;
    }
    if (/setahun|satu tahun|1 year/.test(custText))   return '1 tahun';
    if (/sebulan|satu bulan|1 month/.test(custText))  return '1 bulan';
    if (/seminggu|satu minggu|1 week/.test(custText)) return '1 minggu';
    // Return 'UNKNOWN' (not 'Disebutkan') so the summary line is suppressed
    // when no specific duration was stated by the customer.
    return 'UNKNOWN';
  }

  /**
   * Preferensi VIEWING/SURVEY (Q9). Customer sering minta langsung lihat katalog tanpa
   * survei ("Mau lihat katalognya aja, gak ada waktu survei") ATAU minta dijadwalkan
   * viewing. Ditangkap agar agent tahu langkah berikutnya. UNKNOWN → baris disembunyikan.
   */
  static #extractViewingPreference(custText) {
    const wantsCatalogOnly =
      /(lihat|liat)\s+(katalog|listing|pilihan)/.test(custText) ||
      /katalog\s*(nya)?\s*(aja|saja|dulu)/.test(custText) ||
      /langsung\s+(katalog|listing|rekomendasi)/.test(custText) ||
      /tanpa\s+(survey|survei|viewing|lihat\s+lokasi)/.test(custText) ||
      /(ga|gak|engga|enggak|nggak|tidak|tdk|ndak)\s*(ada|punya|sempat)?\s*waktu\s*(untuk|buat)?\s*(survey|survei|viewing|lihat)/.test(custText);
    if (wantsCatalogOnly) return 'Butuh lihat katalog saja';

    const wantsScheduled =
      /(jadwal(kan)?|atur|booking)\s+(viewing|survey|survei|kunjungan)/.test(custText) ||
      /(mau|pengen|ingin|bisa)\s+(viewing|survey|survei|lihat\s+unit|lihat\s+lokasi)/.test(custText);
    if (wantsScheduled) return 'Mau dijadwalkan viewing';

    return 'UNKNOWN';
  }

  static #extractAlternativeAreas(custText) {
    // Return the raw text fragment around "atau", "juga oke", etc.
    const patterns = [/selain .+?, (.+?) juga/i, /atau(?:\s+di)?\s+(\w+)/i, /(\w+) juga oke/i, /(\w+) juga boleh/i];
    for (const p of patterns) {
      const m = custText.match(p);
      if (m) return m[1];
    }
    return 'Disebutkan';
  }

  static #extractRedFlags(custText) {
    const flags = [];
    if (/hadap barat|west facing/.test(custText))    flags.push('Tidak mau hadap barat');
    if (/bising|noisy|ramai/.test(custText))         flags.push('Tidak mau bising/ramai');
    if (/gang sempit|narrow/.test(custText))         flags.push('Tidak mau gang sempit');
    if (/banjir|flood/.test(custText))               flags.push('Tidak mau banjir');
    if (/tua|old building/.test(custText))           flags.push('Tidak mau bangunan tua');
    // Return 'UNKNOWN' (not 'Disebutkan') so the brief suppresses the "Hindari"
    // line when no specific red flag pattern is matched from the customer text.
    return flags.length ? flags.join(', ') : 'UNKNOWN';
  }

  /**
   * Preferensi POSITIF lingkungan/suasana yang DIINGINKAN customer (Q5/Q6).
   * Mis. "lokasinya sejuk dan rindang banyak pepohonan" → "Sejuk & rindang".
   * Dipakai agar keinginan customer tidak hilang dari summary (≠ redFlags).
   */
  static #extractPreferences(custText) {
    const prefs = [];
    if (/\b(sejuk|adem|rindang|pepohonan|pohon|hijau|teduh|asri)\b/.test(custText)) prefs.push('Lingkungan sejuk & asri');
    if (/\b(tenang|sepi|tidak\s+bising|tidak\s+ramai|jauh\s+dari\s+keramaian)\b/.test(custText)) prefs.push('Suasana tenang');
    if (/\b(strategis|akses\s+(mudah|gampang)|dekat\s+(tol|jalan\s+(raya|utama)))\b/.test(custText)) prefs.push('Lokasi strategis');
    if (/\b(jalan\s+(raya\s+)?(lebar|besar|luas))\b/.test(custText)) prefs.push('Jalan lebar');
    if (/\b(aman|keamanan\s+baik|lingkungan\s+aman)\b/.test(custText)) prefs.push('Lingkungan aman');
    return prefs.length ? prefs.join(', ') : 'UNKNOWN';
  }

  static #extractAnchorPoint(custText) {
    // Specific named landmarks — short normalized form
    if (/dekat sekolah|near school/.test(custText))  return 'Dekat sekolah';
    if (/dekat kantor|near office/.test(custText))   return 'Dekat kantor';
    if (/dekat mall|near mall/.test(custText))       return 'Dekat mall';
    if (/dekat kampus|near campus/.test(custText))   return 'Dekat kampus';
    if (/dekat rs|near hospital/.test(custText))     return 'Dekat RS';
    if (/dekat tol|near highway/.test(custText))     return 'Dekat tol';
    if (/dekat stasiun|near station/.test(custText)) return 'Dekat stasiun';
    if (/dekat pasar|near market/.test(custText))    return 'Dekat pasar';
    if (/dekat terminal/.test(custText))             return 'Dekat terminal';
    if (/dekat pelabuhan|near port/.test(custText))  return 'Dekat pelabuhan';
    if (/dekat bandara|near airport/.test(custText)) return 'Dekat bandara';
    if (/dekat pabrik|near factory/.test(custText))  return 'Dekat pabrik';
    // Generic: capture the FULL "dekat X, Y dan Z" chain up to sentence boundary.
    // Stop at [.!?\n] so multi-landmark answers like
    // "dekat dengan cafe, indomaret dan dekat dengan jalan Demak" are captured whole.
    // Previously stopped at commas — that truncated to "dekat dengan cafe," only.
    const m = custText.match(
      /\b(?:dekat|deket|near|di\s+jalan|di\s+sekitar)\s+[^\n.!?]{4,150}/i
    );
    if (m) return m[0].trim();
    // Suppress "Patokan lokasi" line in brief when nothing specific is extractable
    return 'UNKNOWN';
  }

  /** Capitalize the first letter of a string (used for anchor points, raw responses). */
  static #capitalizeFirst(str = '') {
    if (!str) return str;
    const s = str.trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /**
   * Capitalize the month name in a date string.
   * "7 juli 2026" → "7 Juli 2026"
   * "juli 2026"   → "Juli 2026"
   * "juli"        → "Juli"
   */
  static #capitalizeDate(dateStr = '') {
    if (!dateStr) return dateStr;
    // Match optional day prefix, then month name, then optional year
    return dateStr.trim().replace(/^(\d{1,2}\s+)?(\w+)/, (_, day, month) =>
      (day || '') + month.charAt(0).toUpperCase() + month.slice(1)
    );
  }

  static #calcBriefScore(profile, filters) {
    let s = 0;
    if (filters.budget)                   s += 2; // budget = 2 pts (hardest to get)
    if (filters.location)                 s += 1;
    if (filters.buildingType)             s += 1;
    if (filters.transactionType)          s += 1;
    if (profile.hasMoveInDate)            s += 1;
    if (profile.hasLeaseDuration)         s += 1;
    if (profile.hasDecisionMaker || profile.hasHouseholdInfo) s += 1;
    if (profile.hasFurnishing)            s += 1;
    return Math.min(s, 9);
  }
}

// ─── ChatbotPrivateService ────────────────────────────────────────────────────

class ChatbotPrivateService {
  /**
   * Load skill registry metadata and prompt statistics for status reporting.
   *
   * @returns {object} Skill info summary
   */
  static loadSkillInfo() {
    const registry = getSkillRegistryStatus();
    const prompt   = loadResponseSkillPrompt('private_agent', { maxCharacters: 12000 });
    return {
      skillSource:          'skills/chat_gpt_responds + skills/claude_responds',
      skillPromptLoaded:    Boolean(prompt),
      skillPromptCharacters:prompt.length,
      chatGPTSkill:         registry.groups.chat_gpt_responds,
      claudeSkill:          registry.groups.claude_responds,
    };
  }

  /**
   * Normalize location by extracting the city name from district+city combinations.
   * Example: "PTC surabaya" → "Surabaya" (matches known locations)
   *          "Gunawangsa Surabaya" → "Surabaya"
   *
   * @param {string} location - Raw location string from filters
   * @returns {string} Normalized location (city name)
   * @private
   */
  static #normalizeLocation(location = '') {
    if (!location) return '';

    const text = String(location).toLowerCase().trim();

    // Known cities/provinces that should be extracted from compound locations
    const knownCities = [
      'surabaya', 'jakarta', 'bandung', 'semarang', 'yogyakarta', 'malang',
      'medan', 'palembang', 'pekanbaru', 'padang', 'makassar', 'denpasar',
      'bali', 'batu', 'bogor', 'depok', 'tangerang', 'bekasi', 'solo',
      'serang', 'cilegon', 'cirebon', 'tasikmalaya', 'sukabumi', 'karawang'
    ];

    // If location is already a known city, return it as-is
    if (knownCities.includes(text)) {
      return location; // preserve original capitalization
    }

    // Try to extract known city from compound location (e.g., "PTC surabaya" → "surabaya")
    for (const city of knownCities) {
      if (text.includes(city)) {
        // Find the original capitalization from the input
        const words = location.split(/\s+/);
        for (const word of words) {
          if (word.toLowerCase() === city) {
            return word; // return with original capitalization
          }
        }
        return city;
      }
    }

    return location; // no normalization possible
  }

  /**
   * Fetch live Rumah123 listings based on property filters.
   * Returns an empty array (non-fatal) when:
   *   - RUMAH123_DATA environment variable is OFF
   *   - Apify is not configured or the fetch fails
   *
   * Automatically normalizes location (e.g., "PTC surabaya" → "Surabaya") to match
   * Apify's location search requirements.
   *
   * @param {object} filters          - Extracted property filters
   * @param {string} sessionLocation  - Fallback location from the chat session
   * @returns {Promise<object[]>}
   */
  static async fetchRumah123Listings(filters = {}, sessionLocation = '') {
    // Check if Rumah123 data is enabled
    const rumah123DataEnabled = String(process.env.RUMAH123_DATA || 'ON').toUpperCase() === 'ON';
    if (!rumah123DataEnabled) {
      console.log('[PrivateController] Rumah123 data disabled (RUMAH123_DATA=OFF) — using catalog only');
      return [];
    }

    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken || apifyToken === 'isi_apify_token_anda') return [];

    try {
      const propertyType = mapBuildingTypeToApify(filters.buildingType);
      const listingType  = mapTransactionTypeToApify(filters.transactionType);
      let location       = filters.location || sessionLocation || '';

      // Normalize location to extract city name from compound locations
      if (location) {
        const originalLocation = location;
        location = this.#normalizeLocation(location);
        if (originalLocation !== location) {
          console.log(`[PrivateController] Location normalized: "${originalLocation}" → "${location}"`);
        }
      }

      console.log(`[PrivateController] Fetching Rumah123: location="${location}", type="${propertyType}", listing="${listingType}"`);

      if (!location && !propertyType) {
        console.log('[PrivateController] Skipping Rumah123 fetch: no location or propertyType provided');
        return [];
      }

      const listings = await getRumah123Listings({ location, propertyType, listingType });
      console.log(`[PrivateController] Rumah123 fetched: ${listings.length} listings for location="${location}"`);
      return listings;
    } catch (err) {
      console.error('[PrivateController] Rumah123 fetch failed (non-fatal):', err.message);
      return [];
    }
  }

  /**
   * Resolve the best-available catalog matches from the recommendation context.
   * When no exact match exists, promotes visible-matching alternatives.
   *
   * @param {object} context - Recommendation context from propertyRecommendationService
   * @returns {object[]}     Catalog matches to display
   */
  static resolveCatalogMatches(context = {}) {
    const { exactMatches = [], alternatives = [] } = context;
    if (exactMatches.length) return exactMatches;

    const visible = getVisibleMatchesFromAlternatives(alternatives, context.filters);
    if (visible.length) {
      console.warn('[PrivateController] Promoted visible alternatives to catalog matches.');
      return visible;
    }
    return [];
  }

  /**
   * Core response generation logic.
   *
   * 1. Detect language
   * 2. Guard against off-topic / unclear intent
   * 3. Fetch Rumah123 live data and catalog context in parallel
   * 4. Select the best reply strategy and build the response
   *
   * @param {object} params
   * @param {object} params.session                - Chat session object
   * @param {object[]} params.history              - Recent conversation history
   * @param {string}   params.userMessage          - Latest user message
   * @param {object}   params.recommendationContext - Pre-built recommendation context (or null)
   * @param {Error}    params.externalError         - Error from the failed AI provider
   * @returns {Promise<object>}                     Result object with reply + metadata
   */
  /**
   * Generate response untuk chatbot web.
   * Menggunakan ResponseBuilder (format web biasa).
   */
  static async generateResponseForChatbot({ session, history = [], userMessage = '', recommendationContext = null, externalError = null }) {
    const skillInfo = this.loadSkillInfo();
    const lang      = LanguageDetector.detect(userMessage, history);
    const builder   = new ResponseBuilder(lang);

    console.warn('[CHATBOT PRIVATE CONTROLLER ACTIVE]', {
      reason:    externalError?.message || 'External AI provider unavailable.',
      sessionId: session?.id            || null,
      language:  lang,
    });

    // Resolve filters — use provided context or extract on the fly
    const filters = recommendationContext?.filters || extractPropertyFilters(userMessage, history);

    // Guard: reject off-topic messages immediately
    if (LanguageDetector.isOffTopic(userMessage)) {
      return this.#wrap(builder.offTopic(), { skillInfo, filters });
    }

    // Guard: ask for clarification when intent is unclear
    if (!LanguageDetector.hasPropertyIntent(userMessage, filters)) {
      return this.#wrap(builder.clarification(), { skillInfo, filters });
    }

    // Fetch Rumah123 live data and build catalog context in parallel for speed
    const [rumah123Listings, context] = await Promise.all([
      this.fetchRumah123Listings(filters, session?.location),
      recommendationContext
        ? Promise.resolve(recommendationContext)
        : buildRecommendationContextForLLM(userMessage, history),
    ]);

    const catalogMatches = this.resolveCatalogMatches(context);

    // Select reply strategy
    let reply;
    if (rumah123Listings.length > 0 || catalogMatches.length > 0) {
      reply = builder.exactMatch({ rumah123Listings, catalogMatches, filters: context.filters });
    } else {
      reply = builder.alternative({ alternatives: context.alternatives, rumah123Listings, filters: context.filters });
    }

    return this.#wrap(reply, {
      skillInfo,
      filters:         context.filters,
      exactMatches:    catalogMatches.length,
      rumah123Listings:rumah123Listings.length,
      alternatives:    context.alternatives.length,
      fallbackReason:  externalError?.message || 'External AI provider unavailable.',
    });
  }

  /**
   * Generate response untuk WhatsApp terminal message (Fonnte, Kirimi, TimelinesAI).
   * Menggunakan ResponseBuilderWhatsApp (format WhatsApp dengan images + agent name).
   *
   * @param {object} params
   * @param {object} params.session
   * @param {string[]} params.history
   * @param {string} params.userMessage
   * @param {string} params.agentName - Agent name untuk footer (e.g., "LEO FELIX")
   * @param {object} params.recommendationContext
   * @param {Error} params.externalError
   * @returns {Promise<{reply, source, controller, fallbackUsed, ...}>}
   */
  /**
   * Generate response untuk WhatsApp terminal message (Fonnte, Kirimi, TimelinesAI).
   *
   * QUALIFICATION FLOW (sebelum tampil listing):
   *   Implements CUSTOMER (RENTER/BUYER) FLOW Q0–Q12.
   *   Menanyakan kebutuhan customer terlebih dahulu; baru tampilkan listing
   *   ketika cukup info terkumpul.
   *
   * KAPAN LANGSUNG TAMPILKAN LISTING:
   *   a) Customer eksplisit minta list/katalog/rekomendasi, ATAU
   *   b) readiness >= 3 (transactionType + buildingType + location semua ada), ATAU
   *   c) AI sudah bertanya 4+ kali (hindari over-qualifying).
   *
   * @param {object} params
   * @param {object}   params.session
   * @param {object[]} params.history
   * @param {string}   params.userMessage
   * @param {string}   params.agentName      - Untuk footer (misal "LEO FELIX")
   * @param {object}   params.recommendationContext
   * @param {Error}    params.externalError
   */
  static async generateResponseForTerminalMassege({
    session, history = [], userMessage = '', agentName = '',
    recommendationContext = null, externalError = null
  }) {
    const skillInfo = this.loadSkillInfo();
    const lang      = LanguageDetector.detect(userMessage, history);
    const builder   = new ResponseBuilderWhatsApp(lang, agentName);

    console.warn('[WHATSAPP PRIVATE AGENT ACTIVE]', {
      reason   : externalError?.message || 'External AI provider unavailable.',
      sessionId: session?.id || null,
      language : lang,
      agent    : agentName,
    });

    // ── Guard: off-topic pesan (bukan properti sama sekali) ──────────────────
    if (LanguageDetector.isOffTopic(userMessage)) {
      return this.#wrap(builder.offTopic(), { skillInfo });
    }

    // ── Guard: pesan tidak memiliki intent properti (tech keywords, random text, dll.) ──
    // Mirrors gate di timelinesAIChatController: hanya respons jika pesan adalah
    // query properti nyata ATAU lanjutan percakapan properti yang sedang berjalan.
    // Tanpa guard ini, pesan seperti "memory-management search-strategy..." yang
    // lolos isOffTopic() langsung masuk ke Q1–Q12 qualification karena loc/type
    // sudah tersimpan dari percakapan sebelumnya.
    if (!hasPropertyKeyword(userMessage) && !isPropertyContextContinuation(userMessage, history)) {
      return this.#wrap(builder.offTopic(), { skillInfo });
    }

    // ── Resolve filters dari context atau extract baru ───────────────────────
    const filters = recommendationContext?.filters
      || extractPropertyFilters(userMessage, history);

    // ── Build customer profile dari seluruh percakapan ───────────────────────
    const profile = ConversationQualifier.buildProfile(history, userMessage, filters);

    // ── Date ask-directive (rules 25/35) from deterministic customerDateParser ──
    // The qualification-state extractor runs parseCustomerDate() on the move-in /
    // target date. When the customer gives an ambiguous date ("Juni" = bulan
    // berjalan, rule 25) or "segera" (rule 35), it returns an ask-directive that
    // the private flow must honor (WAJIB tanya dulu before summary). When the date
    // is resolvable it returns the normalized "DD Bulan YYYY" string (or
    // "Waiting the update" once the customer says they don't know).
    try {
      const _qs = extractQualificationState(history, userMessage);
      profile.moveInDateAsk   = _qs.moveInDateAsk || null;  // 'current_month' | 'soon' | null
      profile.moveInDateValue = _qs.moveInDate   || null;   // normalized date | 'Waiting the update' | null
      // A resolved value (real date or "Waiting the update") satisfies Q8.
      if (profile.moveInDateValue) profile.hasMoveInDate = true;
    } catch (_e) { /* non-fatal — fall back to regex hasMoveInDate */ }

    console.log('[PrivateAgent/Qualifier]', {
      tx       : profile.transactionType || '(unknown)',
      type     : profile.buildingType    || '(unknown)',
      location : profile.location        || '(unknown)',
      readiness: ConversationQualifier.readinessScore(profile),
      aiCount  : profile.aiCount,
    });

    // ── CHECK MODE: RESPOND_CATALOG_RUN ─────────────────────────────────────
    // OFF (default) → Full Q1–Q12 qualification flow → show structured brief
    // ON            → Ask core Q0–Q4 only → show catalog listing
    const showCatalogDirect = String(process.env.RESPOND_CATALOG_RUN || 'OFF').toUpperCase() === 'ON';

    // ── Shared: fetch price anchors for Q3 (needed in both modes) ────────────
    let priceAnchors = null;
    if (filters.location || filters.buildingType) {
      try {
        const catalogProps = await searchProperties(filters);
        const withPrice    = catalogProps.filter(p => p.price && p.price !== '-');
        if (withPrice.length >= 2) {
          const sorted = [...withPrice].sort((a, b) =>
            this.#roughPrice(a.price) - this.#roughPrice(b.price)
          );
          priceAnchors = { low: sorted[0].price, high: sorted[sorted.length - 1].price };
        }
      } catch (_err) { /* non-fatal */ }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  MODE A — SUMMARY (RESPOND_CATALOG_RUN=OFF, default)
    //  Run FULL Q1–Q12 qualification, then show structured agent brief.
    //  Catalog is NEVER shown in this mode.
    // ════════════════════════════════════════════════════════════════════════
    if (!showCatalogDirect) {

      // ── HOUSE v2 PILOT (building_type=house) — unnamed assistant, motivation +
      //    financing readiness, handoff + INTERNAL [BRIEF_READY] (no customer summary).
      if (ConversationQualifier.housePilotEnabled(profile)) {
        const resolvedAppName = process.env.APP_NAME || 'Elevan Property';
        const pilotQ = ConversationQualifier.getNextQuestionHousePilot(
          profile, lang, priceAnchors, agentName, resolvedAppName
        );
        if (pilotQ) {
          console.log(`[PrivateAgent/HousePilot] Asking Q (aiCount=${profile.aiCount})`);
          return this.#wrap(builder.qualificationQuestion(pilotQ), {
            skillInfo, filters, qualificationMode: true, housePilot: true,
          });
        }
        // Ready → show the customer a VISIBLE summary (✓ answered / ✗ belum ditanyakan),
        // then the internal [BRIEF_READY] rides in metadata for the agent.
        const pilot = ConversationQualifier.buildHousePilotBrief(profile, filters, history, userMessage);
        const custBrief = ConversationQualifier.buildAgentBrief(profile, filters, history, userMessage);
        console.log('[PrivateAgent/HousePilot] ✅ Summary', { score: pilot.score, priority: pilot.priority });
        return this.#wrap(builder.houseSummary(custBrief), {
          skillInfo, filters, responseMode: 'house_pilot_summary', housePilot: true,
          briefReady: pilot.brief, briefScore: pilot.score, briefPriority: pilot.priority,
          agentNote: pilot.agentNote, agentName,
        });
      }

      const nextQuestion = ConversationQualifier.getNextQuestion(
        profile, lang, priceAnchors, 'summary'
      );

      if (nextQuestion) {
        console.log(`[PrivateAgent/SummaryMode] Asking Q (aiCount=${profile.aiCount})`);
        return this.#wrap(builder.qualificationQuestion(nextQuestion), {
          skillInfo, filters, qualificationMode: true, summaryMode: true,
        });
      }

      // All Q1–Q12 answered → generate structured brief
      console.log('[PrivateAgent/SummaryMode] ✅ All Q answered → generating agent brief');
      const brief = ConversationQualifier.buildAgentBrief(profile, filters, history, userMessage);
      const reply = builder.agentBrief(brief);

      console.log('[PrivateAgent/SummaryMode] Brief generated:', {
        score   : brief.score,
        priority: brief.priority,
        budget  : brief.budget?.value,
        location: brief.location?.value,
        moveIn  : brief.moveInDate?.value,
      });

      return this.#wrap(reply, {
        skillInfo,
        filters,
        responseMode    : 'summary',
        showCatalogDirect,
        briefScore      : brief.score,
        briefPriority   : brief.priority,
        fallbackReason  : externalError?.message || 'External AI provider unavailable.',
        agentName,
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  MODE B — CATALOG (RESPOND_CATALOG_RUN=ON)
    //  Ask core Q0–Q4 + Q8 only, then show property listings.
    // ════════════════════════════════════════════════════════════════════════

    // ── Core 4 gate: keep asking until basic info collected ──────────────────
    const hasAllFour = !!(
      profile.buildingType && profile.transactionType &&
      profile.location     && profile.budget
    );
    const shouldList = hasAllFour || profile.aiCount >= 5;

    if (!shouldList) {
      const nextQuestion = ConversationQualifier.getNextQuestion(
        profile, lang, priceAnchors, 'catalog'
      );
      if (nextQuestion) {
        console.log(`[PrivateAgent/CatalogMode] Asking Q (aiCount=${profile.aiCount})`);
        return this.#wrap(builder.qualificationQuestion(nextQuestion), {
          skillInfo, filters, qualificationMode: true,
        });
      }
    }

    // ── Fetch listings (Rumah123 + catalog) ──────────────────────────────────
    const [rumah123Listings, context] = await Promise.all([
      this.fetchRumah123Listings(filters, session?.location),
      recommendationContext
        ? Promise.resolve(recommendationContext)
        : buildRecommendationContextForLLM(userMessage, history),
    ]);

    const catalogMatches = this.resolveCatalogMatches(context);

    let reply;
    if (rumah123Listings.length > 0 || catalogMatches.length > 0) {
      reply = builder.exactMatch({ rumah123Listings, catalogMatches, filters: context.filters });
    } else {
      reply = builder.alternative({
        alternatives : context.alternatives,
        rumah123Listings,
        filters      : context.filters,
        budgetExpanded: context.budgetExpanded || null,
      });
    }

    // ── Q8 mandatory: append move-in question before signature ───────────────
    if (!profile.hasMoveInDate && !profile.aiAskedMoveIn) {
      const moveInQ   = lang === 'id'
        ? '\n\nOmong-omong, rencananya masuk atau pindah bulan apa? 📅'
        : '\n\nBy the way, what month are you planning to move in? 📅';
      const insertBefore = lang === 'id' ? '\n\nSalam hangat,' : '\n\nWarm regards,';
      reply = reply.includes(insertBefore)
        ? reply.replace(insertBefore, moveInQ + insertBefore)
        : reply + moveInQ;
    }

    return this.#wrap(reply, {
      skillInfo,
      filters          : context.filters,
      responseMode     : 'catalog',
      showCatalogDirect,
      exactMatches     : catalogMatches.length,
      rumah123Listings : rumah123Listings.length,
      alternatives     : context.alternatives.length,
      fallbackReason   : externalError?.message || 'External AI provider unavailable.',
      agentName,
    });
  }

  /**
   * Rough price parser untuk sorting price anchors.
   * Tidak perlu presisi — hanya untuk membandingkan low vs high.
   *
   * @param {string} priceStr
   * @returns {number}
   * @private
   */
  static #roughPrice(priceStr = '') {
    const text = String(priceStr).toLowerCase().replace(/[.,]/g, '');
    const num  = (text.match(/\d+/) || ['0'])[0];
    let   val  = Number(num) || 0;
    if (/miliar|billion/.test(text)) val *= 1_000_000_000;
    else if (/juta|jt|million/.test(text)) val *= 1_000_000;
    else if (/ribu|thousand/.test(text)) val *= 1_000;
    return val || Infinity;
  }

  /**
   * Wrap a reply string with standard source/controller metadata.
   * All API responses use this shape to ensure consistency.
   *
   * @param {string} reply - The generated reply text
   * @param {object} meta  - Additional metadata fields
   * @returns {object}
   */
  static #wrap(reply, meta = {}) {
    return {
      reply,
      source:       'private_agent',
      controller:   'chatbotPrivateController',
      fallbackUsed: true,
      exactMatches:     meta.exactMatches     ?? 0,
      rumah123Listings: meta.rumah123Listings ?? 0,
      alternatives:     meta.alternatives     ?? 0,
      ...meta,
    };
  }

  /**
   * Generate a professional WhatsApp follow-up reply for a Contact Form submission.
   *
   * This is the private-agent fallback used when ChatGPT and Claude are both unavailable.
   * Produces a warm, empathetic, property-focused CS reply — matching the same tone and
   * structure defined in aiPromptBuilderService.buildContactReplyPrompt().
   *
   * @param {object} contactPayload
   * @param {string} contactPayload.name     - Customer's full name
   * @param {string} contactPayload.phone    - Customer's phone number
   * @param {string} contactPayload.subject  - Form subject / inquiry topic
   * @param {string} contactPayload.message  - Customer's detailed message
   * @returns {{ reply: string, source: string }}
   */
  static generateContactFormReply({ name = '', phone = '', subject = '', message = '', agentName = '', appName = '' } = {}) {
    const firstName   = (name || '').split(' ')[0] || name || 'Bapak/Ibu';
    const combinedMsg = `${subject} ${message}`.toLowerCase();
    const lang        = LanguageDetector.detect(combinedMsg);
    const isId        = lang === 'id';

    // Nama agent & nama app SELALU dinamis — agent dari database, app dari APP_NAME env.
    const resolvedAppName   = appName || process.env.APP_NAME || 'Elevan Property';
    const resolvedAgentName = agentName || process.env.AGENT_NAME || resolvedAppName;

    // Detect inquiry intent from subject + message
    const isRent      = /sewa|rent|kontrak|kost|boarding/i.test(combinedMsg);
    const isBuy       = /beli|buy|purchase|jual|invest/i.test(combinedMsg);
    const isSell      = /jual|sell|pasarkan|listing/i.test(combinedMsg);
    const isApartment = /apartemen|apartment|apart/i.test(combinedMsg);
    const isHotel     = /hotel/i.test(combinedMsg);
    const isVilla     = /villa|vila/i.test(combinedMsg);
    const isHouse     = /rumah|house|home|kontrakan|residential/i.test(combinedMsg);

    // Build intent-aware follow-up question
    let followUp;
    if (isId) {
      if (isRent)      followUp = `Boleh saya tanyakan, kira-kira *kapan* Bapak/Ibu berencana untuk pindah, dan apakah ada preferensi lokasi atau fasilitas tertentu yang menjadi prioritas?`;
      else if (isBuy)  followUp = `Agar saya bisa memberikan pilihan terbaik, boleh saya tahu *kisaran anggaran* yang Bapak/Ibu siapkan, dan apakah ada preferensi lokasi atau tipe properti tertentu?`;
      else if (isSell) followUp = `Untuk membantu proses pemasaran properti Bapak/Ibu, boleh saya ketahui *lokasi dan tipe properti* yang ingin dijualkan, beserta harga yang diharapkan?`;
      else             followUp = `Agar saya dapat memberikan informasi yang paling sesuai, boleh saya tahu lebih lanjut mengenai *kebutuhan atau preferensi properti* Bapak/Ibu?`;
    } else {
      if (isRent)      followUp = `To help us find the perfect match for you, may I ask *when you're planning to move in*, and do you have any specific location or facility preferences?`;
      else if (isBuy)  followUp = `To tailor our recommendations, could you share your *approximate budget* and any preferred location or property type?`;
      else if (isSell) followUp = `To assist you in listing your property effectively, could you share the *property location, type, and your expected price*?`;
      else             followUp = `To better assist you, could you share more about your *specific property needs or preferences*?`;
    }

    // Build property type mention
    let propType = '';
    if (isId) {
      if (isApartment) propType = 'apartemen';
      else if (isHotel) propType = 'hotel';
      else if (isVilla) propType = 'villa';
      else if (isHouse) propType = 'properti';
      else propType = 'properti';
    } else {
      if (isApartment) propType = 'apartment';
      else if (isHotel) propType = 'hotel';
      else if (isVilla) propType = 'villa';
      else if (isHouse) propType = 'property';
      else propType = 'property';
    }

    // Compose the WhatsApp reply in the detected language
    let reply;
    if (isId) {
      const greeting   = `Halo *${firstName}*, terima kasih telah menghubungi *${resolvedAppName}*! 🏡`;
      const ack        = subject
        ? `Saya sudah menerima pesan Anda mengenai *"${subject}"* dan dengan senang hati akan membantu Anda menemukan ${propType} yang paling sesuai dengan kebutuhan Anda.`
        : `Saya sudah menerima pesan Anda dan dengan senang hati akan membantu Anda menemukan ${propType} yang paling sesuai dengan kebutuhan Anda.`;
      const value      = `Saya siap mendampingi Bapak/Ibu mulai dari pencarian hingga proses penyelesaian transaksi dengan nyaman dan profesional.`;
      const signOff    = `Silakan lanjutkan percakapan ini kapan saja — saya siap membantu!\n\nSalam hangat,\n*${resolvedAgentName}*\n*${resolvedAppName}* 🌟`;
      reply = [greeting, ack, value, followUp, signOff].join('\n\n');
    } else {
      const greeting   = `Hello *${firstName}*, thank you for reaching out to *${resolvedAppName}*! 🏡`;
      const ack        = subject
        ? `I've received your inquiry regarding *"${subject}"* and I'd be delighted to help you find the perfect ${propType} that fits your needs.`
        : `I've received your message and I'd be delighted to help you find the right ${propType} for your needs.`;
      const value      = `I am here to guide you every step of the way — from property search to a smooth, stress-free transaction.`;
      const signOff    = `Feel free to continue this conversation anytime — I'm always here to help!\n\nWarm regards,\n*${resolvedAgentName}*\n*${resolvedAppName}* 🌟`;
      reply = [greeting, ack, value, followUp, signOff].join('\n\n');
    }

    console.log(`[PrivateAgent/ContactForm] Reply generated (lang=${lang}, firstName="${firstName}")`);

    return {
      reply,
      source:   'private_agent',
      provider: 'private_agent',
      primaryProvider: 'private_agent',
      fallbackUsed: true,
    };
  }
}

// ─── Express Endpoints ────────────────────────────────────────────────────────

/**
 * GET /api/chatbot/private-status
 * Reports the configuration and Rumah123 integration status of the private controller.
 */
exports.privateAgentStatus = (_req, res) => {
  const skillInfo  = ChatbotPrivateService.loadSkillInfo();
  const enabled    = String(process.env.ENABLE_CHATBOT_PRIVATE_CONTROLLER || 'true').toLowerCase() !== 'false';
  const apifyReady = Boolean(process.env.APIFY_API_TOKEN && process.env.APIFY_API_TOKEN !== 'isi_apify_token_anda');
  const rumah123DataEnabled = String(process.env.RUMAH123_DATA || 'ON').toUpperCase() === 'ON';

  return res.json({
    success: true,
    enabled,
    controller: 'chatbotPrivateController',
    source:     'private_agent',
    behavior:   'Activated when ChatGPT and Claude cannot generate a response.',
    dataSource: {
      rumah123Enabled: rumah123DataEnabled,
      rumah123Status:  rumah123DataEnabled ? 'ON (live Rumah123 data)' : 'OFF (static JSON catalog)',
      catalogEnabled:  true,
      catalogPath:     'backend/asset/json_data/indonesia_property_36_provinces_flat.json',
    },
    rumah123Integration: {
      enabled:     apifyReady && rumah123DataEnabled,
      apiTokenConfigured: apifyReady,
      maxListings: 20,
      features: rumah123DataEnabled ? [
        'live Rumah123 data',
        'property images',
        'agent contacts',
        'WhatsApp links',
        'direct Rumah123 URL per listing',
        'top 20 ranking',
      ] : [],
    },
    skillInfo,
  });
};

/**
 * POST /api/chatbot/private-message
 * Direct access endpoint for the private chatbot (for testing without ChatGPT/Claude).
 */
exports.sendPrivateMessage = async (req, res) => {
  const payload = {
    name:     String(req.body.name     || '').trim(),
    phone:    String(req.body.phone    || '').trim(),
    location: String(req.body.location || '').trim(),
    message:  String(req.body.message  || '').trim(),
  };

  const validation = validateChatbotMessage(payload);
  if (!validation.valid) {
    return res.status(process.env.HTTP_BAD_REQUEST).json({ success: false, message: validation.message });
  }

  try {
    const session = await findOrCreateSession(payload.name, payload.phone, payload.location, 'website_chatbot_private');
    await saveUserMessage(session.id, payload.message, 'website_chatbot_private', {
      location: payload.location,
      source:   'private_agent_direct',
    });

    const history               = await getConversationHistory(session.id, 12);
    const recommendationContext = await buildRecommendationContextForLLM(payload.message, history);

    const result = await ChatbotPrivateService.generateResponse({
      session,
      history,
      userMessage:          payload.message,
      recommendationContext,
      externalError: new Error('Direct private chatbot endpoint used.'),
    });

    await saveAssistantMessage(session.id, result.reply, 'website_chatbot_private', {
      source:               'private_agent',
      controller:           'chatbotPrivateController',
      directPrivateEndpoint:true,
      exactMatches:         result.exactMatches,
      rumah123Listings:     result.rumah123Listings,
      alternatives:         result.alternatives,
      filters:              result.filters,
    });

    return res.json({
      success:              true,
      reply:                result.reply,
      sessionId:            session.id,
      source:               'private_agent',
      controller:           'chatbotPrivateController',
      fallbackUsed:         true,
      directPrivateEndpoint:true,
      exactMatches:         result.exactMatches,
      rumah123Listings:     result.rumah123Listings,
      alternatives:         result.alternatives,
    });
  } catch (error) {
    console.error('[CHATBOT PRIVATE CONTROLLER ERROR]', { message: error.message, stack: error.stack });
    return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({
      success:    false,
      source:     'private_agent',
      controller: 'chatbotPrivateController',
      message:    error.message || 'Private chatbot controller failed.',
    });
  }
};

/**
 * GET /api/chatbot/debug/test-rumah123
 * Debug endpoint to test Rumah123 fetch with location normalization.
 *
 * Query params:
 *   ?location=Surabaya (or "PTC Surabaya", "Gunawangsa Surabaya")
 *   &propertyType=apartment (optional)
 *   &listingType=rent (optional, default: sale)
 *
 * This endpoint logs detailed debug info to server console.
 */
exports.debugTestRumah123 = async (req, res) => {
  try {
    const { location = 'Surabaya', propertyType = '', listingType = 'sale' } = req.query;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`DEBUG: Testing Rumah123 Fetch`);
    console.log(`Input: location="${location}", propertyType="${propertyType}", listingType="${listingType}"`);
    console.log(`${'='.repeat(60)}`);

    // Test the private fetch method which includes location normalization
    const filters = { location, buildingType: propertyType, transactionType: listingType };
    const listings = await ChatbotPrivateService.fetchRumah123Listings(filters);

    console.log(`Final result: ${listings.length} listings returned\n`);

    return res.json({
      success: true,
      debug: {
        input: { location, propertyType, listingType },
        resultCount: listings.length,
        listings: listings.slice(0, 2).map(item => ({
          title: item.title,
          location: `${item.district || ''} ${item.city || ''}`.trim(),
          price: item.price,
          url: item.url
        }))
      },
      note: 'Check server console logs for detailed fetch trace'
    });
  } catch (err) {
    console.error(`[DEBUG] Error:`, err.message);
    return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
      hint: 'Check server logs for detailed debug output'
    });
  }
};

// ─── Shared exports (used by chatbotController.js as fallback) ────────────────

module.exports.generatePrivateChatbotResponse  = (params)  => ChatbotPrivateService.generateResponseForChatbot(params);
module.exports.generatePrivateTerminalMassege  = (params)  => ChatbotPrivateService.generateResponseForTerminalMassege(params);
module.exports.generatePrivateContactReply     = (payload) => ChatbotPrivateService.generateContactFormReply(payload);

/**
 * Generate private WhatsApp reply for WhatsApp controllers (Fonnte, Kirimi, TimelinesAI).
 * Simplified version with agent name.
 */
module.exports.generatePrivateWhatsappReply = (payload) => {
  const { name, phone, message, agentName = 'Property Consultant' } = payload;
  const appName = process.env.APP_NAME || 'Elevan Property';

  const isIndonesian = String(message || '').toLowerCase().includes('saya') ||
                      String(message || '').toLowerCase().includes('mau') ||
                      String(message || '').toLowerCase().includes('cari');

  if (isIndonesian) {
    const reply = `Halo ${name}, terima kasih telah menghubungi saya! 🏠

Pesan Anda sudah saya terima. Saya akan segera membalas dengan informasi properti yang sesuai dengan kebutuhan Anda.

Saya siap membantu Anda menemukan rumah, villa, apartemen, atau properti lainnya yang sempurna.

Salam hangat,
*${agentName}*
*${appName}*`;

    return { reply };
  } else {
    const reply = `Hello ${name}, thank you for reaching out! 🏠

I've received your message. I will get back to you shortly with property information tailored to your needs.

I'm here to help you find the perfect house, villa, apartment, or property.

Warm regards,
*${agentName}*
*${appName}*`;

    return { reply };
  }
};

module.exports.loadPrivateChatbotSkillInfo     = ()        => ChatbotPrivateService.loadSkillInfo();

// Exposed for unit tests (deterministic qualification flow — 24 combinations + dates)
module.exports.ConversationQualifier = ConversationQualifier;
module.exports.ResponseBuilderWhatsApp = ResponseBuilderWhatsApp;

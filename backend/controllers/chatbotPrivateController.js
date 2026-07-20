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
const City                                    = require('../models/City');
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
        getBudgetTiers: svcGetBudgetTiers,
        detectBuildingType,
        detectBudget,
        searchProperties }                    = require('../services/propertyRecommendationService');
const { getRumah123Listings,
        mapBuildingTypeToApify,
        mapTransactionTypeToApify }           = require('../services/rumah123ContextService');
const { loadResponseSkillPrompt,
        getSkillRegistryStatus }              = require('../services/skillPromptService');
const { hasPropertyKeyword,
        isPropertyContextContinuation }       = require('../utils/propertyKeywordFilter');
const { extractQualificationState, isConditionalFallbackMessage, isCorrectionMessage } = require('../services/aiPromptBuilderService');

// Per-city landmark reference (Q2c sub-area & Q6 anchor point examples) — moved to its
// own module so this controller file isn't dominated by static data. See file for docs.
const { getCityLandmarks } = require('../utils/locationLandmarks');
const _languageKeywords = require('../utils/languageKeywords');
const { getStandardFacilitiesByType } = require('../utils/standardFacilities');
const { splitCatalogReply } = require('../utils/replySplitter');

// Google Places enrichment — supplies live landmark data for cities NOT in the curated
// LOCATION_LANDMARKS map. Claude/ChatGPT (third-party LLM providers) already have broad,
// current world knowledge of places; this fallback controller does not, so it leans on
// Google Places API to close that gap. See services/googlePlacesService.js for the
// cache-then-async-refresh design (never blocks the synchronous qualification flow).
const { getCachedCityLandmarks, warmCityLandmarksCache } = require('../services/googlePlacesService');

/**
 * Landmark examples for a city, preferring the curated static map (fast, hand-picked)
 * and falling back to a Google Places-sourced cache when the city isn't curated.
 *
 * SYNCHRONOUS — safe to call from getNextQuestion() and other sync code paths. On a
 * Google-cache miss, fires an async background fetch (not awaited) so the NEXT turn
 * for this city has real landmark data; this turn still falls back to the generic
 * "pusat kota, area selatan" phrasing exactly as before Google Places was wired in.
 *
 * @param {string} loc
 * @returns {string[]|null}
 */
function getCityLandmarksEnriched(loc) {
  const curated = getCityLandmarks(loc);
  if (curated) return curated;

  const fromGoogle = getCachedCityLandmarks(loc);
  if (fromGoogle) return fromGoogle;

  if (loc) warmCityLandmarksCache(loc).catch(() => {}); // fire-and-forget, never blocks
  return null;
}

// ─── LanguageDetector ─────────────────────────────────────────────────────────

class LanguageDetector {
  // Keyword banks moved to utils/languageKeywords.js so this class body isn't
  // dominated by static data. Static private fields still reference them here so
  // all `this.#INDONESIAN_WORDS` etc. usage below is unchanged.
  static #INDONESIAN_WORDS = _languageKeywords.INDONESIAN_WORDS;
  static #US_ENGLISH_PATTERNS = _languageKeywords.US_ENGLISH_PATTERNS;
  static #OFF_TOPIC_WORDS = _languageKeywords.OFF_TOPIC_WORDS;
  static #PROPERTY_WORDS = _languageKeywords.PROPERTY_WORDS;

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
  // ── Location anchor keywords — place names customers use as "dekat X" references ──
  // These override OFF_TOPIC_WORDS: if the message contains any of these AND a proximity
  // preposition (dekat/deket/near/etc.), it's a valid Q6 location anchor, NOT off-topic.
  static #LOCATION_ANCHOR_WORDS = [
    // Malls & shopping (named)
    'grand city', 'galaxy mall', 'delta plaza', 'ptc', 'pakuwon trade', 'ciputra world',
    'wtc', 'plasa marina', 'bg junction', 'marvell city', 'pakuwon mall', 'tunjungan plaza',
    'gwalk', 'suncity', 'pasar atom', 'jembatan merah plaza',
    // Tourist & wisata
    'mangrove', 'wonorejo', 'kebun binatang', 'kbs', 'kenjeran', 'taman bungkul',
    'house of sampoerna', 'monkasel', 'monumen kapal selam', 'kalimas', 'waterpark',
    'carnival night', 'thr', 'taman hiburan', 'pantai', 'taman botani',
    // Named kawasan
    'pakuwon city', 'citraland', 'graha family', 'darmo permai',
    // Named schools
    'sekolah ciputra', 'sd petra', 'smp petra', 'sma petra', 'sekolah petra',
    'santa klara', 'darul muttaqin',
    // Named universities
    'unair', 'its', 'unesa', 'ubaya', 'airlangga',
    // Named hospitals
    'rs mitra', 'rs siloam', 'rs brawijaya', 'rs national', 'dr soetomo', 'rkz',
    // Named restaurants
    'gacoan', 'depot bu rudy', 'embong malang',
    // Named banks
    'bank bca', 'bank bni', 'bank mandiri',
    // Generic wisata words that appear in off-topic list but are valid anchors
    'wisata', 'pantai', 'taman', 'kebun', 'museum',
  ];

  static isOffTopic(message = '') {
    const raw = String(message || '').trim();

    // Guard 0: URL / file path detection — REJECT immediately (not property context)
    // Covers: "http://...", "https://...", "C:\path\to\file", "/path/to/file", "git@..."
    if (/^(https?:\/\/|file:\/\/|[a-zA-Z]:\\|\/|git@)/i.test(raw)) return true;
    if (/\.(js|ts|jsx|tsx|py|java|cpp|sql|json|yml|yaml|env|md|txt)$/i.test(raw)) return true;

    const text = this.#normalize(message);

    // Guard 1: Proximity preposition → always a location anchor answer (Q6), never off-topic.
    // Covers: "dekat cafe", "deket wisata mangrove", "di jalan Dukuh Kupang", etc.
    const hasProximityWord = /\b(dekat|deket|near|di\s+jalan|di\s+sekitar|samping|next\s+to|beside|sekitar|area)\b/.test(text);
    if (hasProximityWord) return false;

    // Guard 2: Named location anchor present (mall, wisata, kawasan, university, hospital)
    // Even without "dekat", "Pakuwon City", "Grand City Mall", "KBS" etc. are property context.
    if (this.#LOCATION_ANCHOR_WORDS.some(w => text.includes(w))) return false;

    // Guard 3: Developer/tech keyword spam — 8+ hyphenated tokens with no property words.
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
   * Format a nearby-locations/landmarks value (from property_locations → locations
   * FK join) — normalises both array and string inputs. Empty/unset → '' (caller
   * decides whether to omit the line entirely, unlike facilities which always shows).
   *
   * @param {string|string[]} value
   * @returns {string}
   */
  static formatNearbyLocations(value = '') {
    if (Array.isArray(value)) return value.filter(Boolean).join(', ');
    return String(value || '');
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

  /** Tipe yang transaksi sewanya adalah "booking" (menginap jangka pendek). */
  static isBookingType(buildingType = '') {
    return ['hotel', 'kondotel', 'villa'].includes((buildingType || '').toLowerCase());
  }

  /**
   * Verba rencana untuk summary/pertanyaan. Untuk hotel/kondotel/villa yang disewa,
   * gunakan "Booking" (bukan "Sewa") supaya cocok dengan kata customer ("booking hotel").
   * @returns {string} "Booking" | "Sewa" | "Beli" | ""
   */
  static planLabel(buildingType = '', transactionType = '', lang = 'en') {
    if (transactionType === 'rent') {
      return this.isBookingType(buildingType) ? 'Booking' : (lang === 'id' ? 'Sewa' : 'Rent');
    }
    if (transactionType === 'sale' || transactionType === 'purchase') {
      return lang === 'id' ? 'Beli' : 'Buy';
    }
    return '';
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

    // 📍 Lokasi: utamakan landmark terdekat (property_locations → locations FK);
    // fallback ke kota/kecamatan bila properti tak punya tag lokasi.
    const landmarks = this.formatNearbyLocations(item.nearbyLocations);
    const lokasi    = landmarks || this.formatLocation(item);

    // 🏠 Tipe: booking (hotel/kondotel/villa sewa) → "booking"; selain itu label transaksi biasa.
    const isBooking = this.isBookingType(item.buildingType) && item.transactionType === 'rent';
    const txLabel   = isBooking
      ? 'booking'
      : this.humanTransactionType(item.transactionType, lang).toLowerCase();

    // 📐 Luas: booking → "kamar X"; selain itu "bangunan X, tanah Y".
    const luas = isBooking
      ? `${isId ? 'kamar' : 'room'} ${item.buildingArea || '-'}`
      : `${isId ? 'bangunan' : 'building'} ${item.buildingArea || '-'}, ${isId ? 'tanah' : 'land'} ${item.landArea || '-'}`;

    return [
      `${index + 1}. **${item.title || (isId ? 'Properti' : 'Property')}**${imgTag}`,
      `   📍 ${isId ? 'Lokasi'    : 'Location'}: ${lokasi}`,
      `   💰 ${isId ? 'Harga'     : 'Price'}: **${item.price || '-'}**`,
      `   🏠 ${isId ? 'Tipe'      : 'Type'}: ${this.humanBuildingType(item.buildingType, lang)} — ${txLabel}`,
      `   📐 ${isId ? 'Luas'      : 'Area'}: ${luas}`,
      `   ✨ ${isId ? 'Fasilitas' : 'Facilities'}: ${this.formatFacilities(item.facilities)}`,
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
  alternative({ alternatives = [], rumah123Listings = [], filters = {}, standardFallback = null }) {
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

      // FALLBACK "fasilitas standar per tipe" — sebutkan fasilitas standar tipe ini
      // + rentang harga wajar sebagai acuan saat katalog tidak menemukan data.
      let fallbackNote = '';
      if (standardFallback) {
        const parts = [];
        if (standardFallback.standardFacilities) {
          parts.push(isId
            ? ` Sebagai gambaran, **${PropertyFormatter.humanBuildingType(standardFallback.buildingType, 'id')}** umumnya punya fasilitas standar: ${standardFallback.standardFacilities}.`
            : ` For reference, a **${PropertyFormatter.humanBuildingType(standardFallback.buildingType, 'en')}** typically includes standard facilities: ${standardFallback.standardFacilities}.`);
        }
        const rr = standardFallback.reasonableRange;
        if (rr && (rr.min || rr.max)) {
          const fmtRp = (n) => (n ? 'Rp ' + Number(n).toLocaleString('id-ID') : '');
          const rangeStr = `${fmtRp(rr.min)} – ${fmtRp(rr.max)}${rr.period ? '/' + rr.period : ''}`;
          parts.push(isId
            ? ` Kisaran harga wajar untuk tipe ini sekitar ${rangeStr}.`
            : ` A reasonable price range for this type is around ${rangeStr}.`);
        }
        fallbackNote = parts.join('');
      }

      return isId
        ? `Maaf, saat ini belum ada properti yang sesuai dengan **${summary}**${locationNote} di katalog maupun Rumah123.${fallbackNote} Apakah Anda ingin menyesuaikan lokasi, tipe properti, atau range harga?`
        : `Sorry, there is currently no property matching **${summary}**${locationNote} in my catalog or Rumah123.${fallbackNote} Would you like to adjust the location, property type, or price range?`;
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
    // Strategy: Extract city name (last word >= 4 chars is usually the city name)
    const cityWords = normLoc.split(/\s+/).filter(w => w.length >= 3);

    // Try to match using the longest/last word (usually the city name)
    for (let i = cityWords.length - 1; i >= 0; i--) {
      const cityWord = cityWords[i];
      const atCity = byType.filter(item => {
        const itemCity = String(item.city || '').toLowerCase();
        const itemLoc  = String(item.location || '').toLowerCase();
        // Strict city matching: exact word match, not just substring
        return itemCity === cityWord || itemCity.endsWith(' ' + cityWord) ||
               itemLoc === cityWord || itemLoc.endsWith(' ' + cityWord);
      });
      if (atCity.length > 0) {
        console.log(`[PrivateController] City-level match found for "${cityWord}": ${atCity.length} items`);
        return { items: atCity, locationScope: 'city' };
      }
    }

    // ── Step 3b: Substring fallback for compound city names ─────────────────
    // Last resort within city filtering: substring match (case-insensitive)
    for (const cityWord of cityWords) {
      const atCity = byType.filter(item => {
        const itemLoc = [item.city, item.location]
          .filter(Boolean).map(s => String(s).toLowerCase()).join(' ');
        return itemLoc.includes(cityWord);
      });
      if (atCity.length > 0) {
        console.log(`[PrivateController] Substring city-level match found for "${cityWord}": ${atCity.length} items`);
        return { items: atCity, locationScope: 'city' };
      }
    }

    // ── Step 4: National fallback — ONLY if customer explicitly asked for alternatives ──
    // or if we've exhausted city-level options.
    // Log this as a fallback so the response builder can explain why we're showing
    // properties from other cities.
    console.warn(`[PrivateController] NO city-level match for location "${filters.location}" — falling back to national alternatives`);
    return { items: byType, locationScope: 'national' };
  }

  #catalogItemWhatsApp(item, index, lang = 'en') {
    const isId   = lang === 'id';
    const imgTag = item.imageUrl
      ? `\n   ![${item.title || 'Properti'}](${item.imageUrl})`
      : '';

    // 📍 Lokasi: utamakan landmark terdekat (property_locations → locations FK),
    // sesuai patokan lokasi customer; fallback ke kota/kecamatan bila tak ada tag.
    const landmarks = PropertyFormatter.formatNearbyLocations(item.nearbyLocations);
    const lokasi    = landmarks || PropertyFormatter.formatLocation(item);

    // 🏠 Tipe: untuk booking (hotel/kondotel/villa sewa) → "booking"; selain itu
    // pakai label transaksi biasa (sewa/dijual/beli).
    const isBooking = PropertyFormatter.isBookingType(item.buildingType) && item.transactionType === 'rent';
    const txLabel   = isBooking
      ? (isId ? 'booking' : 'booking')
      : PropertyFormatter.humanTransactionType(item.transactionType, lang).toLowerCase();

    // 📐 Luas: booking (hotel/kondotel/villa) → "kamar X"; selain itu "bangunan X, tanah Y".
    const luas = isBooking
      ? `${isId ? 'kamar' : 'room'} ${item.buildingArea || '-'}`
      : `${isId ? 'bangunan' : 'building'} ${item.buildingArea || '-'}, ${isId ? 'tanah' : 'land'} ${item.landArea || '-'}`;

    return [
      `${index + 1}. *${item.title || (isId ? 'Properti' : 'Property')}*${imgTag}`,
      `   📍 Lokasi: ${lokasi}`,
      `   💰 Harga: *${item.price || '-'}*`,
      `   🏠 Tipe: ${PropertyFormatter.humanBuildingType(item.buildingType, lang)} — ${txLabel}`,
      `   📐 Luas: ${luas}`,
      `   ✨ Fasilitas: ${PropertyFormatter.formatFacilities(item.facilities)}`,
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

  /**
   * Render baris "Hindari" (avoid) + "Prefer" sebagai numbered list berpasangan.
   * Dipakai bersama oleh agentBrief() dan houseSummary() supaya format konsisten.
   * Contoh output:
   *   ✓ Hindari:
   *   1. *Tempat yang sejuk* : Hindari tempat yang panas
   *   2. *Lokasi kamar yang hadap sinar matahari terbenam dan terbit*
   *
   *   ✓ Prefer:
   *   1. *Tempat yang sejuk*
   *
   * @param {object} brief - brief.avoidItems / brief.preferItems dari buildAgentBrief()
   * @returns {string[]} - baris siap di-push ke array `lines` (bisa kosong)
   */
  #renderAvoidPreferBlock(brief) {
    const isId = this.#lang === 'id';
    const out = [];
    if (Array.isArray(brief.avoidItems) && brief.avoidItems.length) {
      out.push(`✓ ${isId ? 'Hindari' : 'Avoid'}:`);
      brief.avoidItems.forEach((item, i) => {
        const reasonPart = item.reason ? ` : ${item.reason}` : '';
        out.push(`${i + 1}. *${item.label}*${reasonPart}`);
      });
    }
    if (Array.isArray(brief.preferItems) && brief.preferItems.length) {
      out.push(`✓ Prefer:`);
      brief.preferItems.forEach((item, i) => {
        out.push(`${i + 1}. *${item.label}*`);
      });
    }
    return out;
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
  alternative({ alternatives = [], rumah123Listings = [], filters = {}, budgetExpanded = null, standardFallback = null }) {
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

      // FALLBACK "fasilitas standar per tipe" (rumusan saat katalog tidak menemukan
      // data): sebutkan fasilitas standar tipe ini + rentang harga wajar sebagai
      // acuan, lalu tawarkan penyesuaian kriteria — bukan sekadar "tidak ada".
      let fallbackNote = '';
      if (standardFallback) {
        const parts = [];
        if (standardFallback.standardFacilities) {
          parts.push(isId
            ? `\n\nSebagai gambaran, *${PropertyFormatter.humanBuildingType(standardFallback.buildingType, 'id')}* umumnya memiliki fasilitas standar: ${standardFallback.standardFacilities}.`
            : `\n\nFor reference, a *${PropertyFormatter.humanBuildingType(standardFallback.buildingType, 'en')}* typically includes standard facilities: ${standardFallback.standardFacilities}.`);
        }
        const rr = standardFallback.reasonableRange;
        if (rr && (rr.min || rr.max)) {
          const fmtRp = (n) => (n ? 'Rp ' + Number(n).toLocaleString('id-ID') : '');
          const rangeStr = `${fmtRp(rr.min)} – ${fmtRp(rr.max)}${rr.period ? '/' + rr.period : ''}`;
          parts.push(isId
            ? `\nKisaran harga yang wajar untuk tipe ini sekitar ${rangeStr}.`
            : `\nA reasonable price range for this type is around ${rangeStr}.`);
        }
        fallbackNote = parts.join('');
      }

      return (isId
        ? `Maaf, saat ini belum ada${typeNote} yang tersedia${locNote} di katalog maupun Rumah123.${fallbackNote}\n\nApakah Anda ingin saya sesuaikan budget, lokasi, atau fasilitasnya?`
        : `Sorry, there is currently no${typeNote} available${locNote} in my catalog or Rumah123.${fallbackNote}\n\nWould you like me to adjust the budget, location, or facilities?`
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
          // Customer specifically asked for a city, but we have no properties there.
          // Be explicit about why we're showing alternatives from other cities.
          // filters.budget adalah OBJEK {text,min,max,period} — interpolasi langsung
          // menghasilkan "budget [object Object]". Pakai .text (string terformat).
          const budgetText = filters.budget?.text
            || (typeof filters.budget === 'string' ? filters.budget : '');
          contextMsg = isId
            ? `⚠️ Maaf, saat ini belum ada *${PropertyFormatter.humanBuildingType(filters.buildingType, 'id')}* tersedia di *${location}* dengan kriteria yang Anda minta (${filters.transactionType === 'rent' ? 'sewa' : 'jual'}, budget ${budgetText || 'fleksibel'}).\n\n📍 Berikut pilihan *${PropertyFormatter.humanBuildingType(filters.buildingType, 'id')}* terdekat dari kota lain yang mungkin sesuai:\n`
            : `⚠️ Unfortunately, there are currently no *${PropertyFormatter.humanBuildingType(filters.buildingType, 'en')}* available in *${location}* matching your criteria (${filters.transactionType === 'rent' ? 'for rent' : 'for sale'}, budget ${budgetText || 'flexible'}).\n\n📍 Here are the closest *${PropertyFormatter.humanBuildingType(filters.buildingType, 'en')}* options from nearby cities:\n`;

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

    // Booking-aware plan label: hotel/villa/kondotel + rent → "Booking" (sesuai kata customer).
    const txLabel = ['rent', 'sale', 'purchase'].includes(brief.transactionType?.value)
      ? PropertyFormatter.planLabel(brief.buildingType?.value, brief.transactionType?.value, this.#lang)
      : brief.transactionType?.value;
    const isBookingPlan = txLabel === 'Booking';

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
    const durLabel = isBookingPlan ? (isId ? 'Durasi menginap' : 'Stay duration')
                                    : (isId ? 'Durasi sewa'    : 'Lease duration');
    const durL = fmt(durLabel, brief.leaseDuration);
    if (durL) lines.push(durL);
    // Penghuni (Q4) — sebelumnya TIDAK ada di template ini sama sekali, sehingga
    // jawaban "bersama keluarga" hanya bisa bocor lewat jalur salah (Q9 decision
    // maker). Baris ini yang benar untuk komposisi penghuni.
    const hhL = fmt(isId ? 'Penghuni' : 'Occupants', brief.household);
    if (hhL) lines.push(hhL);
    const dmL  = fmt(isId ? 'Keputusan bersama' : 'Decision maker', brief.decisionMaker);
    if (dmL) lines.push(dmL);
    const furL = fmt(isId ? 'Furnitur' : 'Furnishing', brief.furnishing);
    if (furL) lines.push(furL);
    // Kondisi (Q_COND, beli) — jawaban customer atas baru/ready | second | inden,
    // termasuk gabungan ("baru atau second"). Tersembunyi bila tidak dijawab.
    const condL = fmt(isId ? 'Kondisi' : 'Condition', brief.propertyCondition);
    if (condL) lines.push(condL);
    const facL = fmt(isId ? 'Fasilitas' : 'Facilities', brief.facilities);
    if (facL) lines.push(facL);
    const altL = fmt(isId ? 'Area alternatif' : 'Alt. areas', brief.alternativeAreas);
    if (altL) lines.push(altL);
    if (brief.apartmentPref && brief.apartmentPref.value !== 'UNKNOWN' && brief.apartmentPref.value != null) {
      lines.push(`✓ ${isId ? 'Tower/Lantai' : 'Tower/Floor'}: *${brief.apartmentPref.value}*`);
    }
    lines.push(...this.#renderAvoidPreferBlock(brief));
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

    const txLabel = ['rent', 'sale', 'purchase'].includes(brief.transactionType?.value)
      ? PropertyFormatter.planLabel(brief.buildingType?.value, brief.transactionType?.value, this.#lang)
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
    // Fasilitas — tiga kasus:
    //   ✓ Fasilitas: *[spesifik]*          ← customer minta fasilitas tertentu
    //   ✗ Fasilitas: *[standar] (Fasilitas standar)* ← customer jawab "standar"
    //   ✗ Fasilitas: *(Belum ditanyakan)*  ← belum ditanya sama sekali
    if (known(brief.facilities)) {
      if (brief.facilities.isStandard) {
        lines.push(`✗ ${isId ? 'Fasilitas' : 'Facilities'}: *${brief.facilities.value} (Fasilitas standar)*`);
      } else {
        lines.push(`✓ ${isId ? 'Fasilitas' : 'Facilities'}: *${brief.facilities.value}*`);
      }
    } else {
      lines.push(row(isId ? 'Fasilitas' : 'Facilities', brief.facilities));
    }
    lines.push(row(isId ? 'Budget' : 'Budget',              brief.budget));
    lines.push(row(isId ? 'Patokan lokasi' : 'Anchor',      brief.anchorPoint));
    // Preferensi tower/lantai/orientasi — hanya tampil untuk apartemen/kondotel bila disebut.
    if (brief.apartmentPref && known(brief.apartmentPref))
      lines.push(`✓ ${isId ? 'Tower/Lantai' : 'Tower/Floor'}: *${brief.apartmentPref.value}*`);
    // Hindari (avoid) & Prefer — numbered list berpasangan (lihat #renderAvoidPreferBlock).
    lines.push(...this.#renderAvoidPreferBlock(brief));
    // Viewing — opsional, tampil hanya jika jadwal survey sudah dikonfirmasi
    if (known(brief.viewingPreference)) lines.push(`✓ Viewing: *${brief.viewingPreference.value}*`);

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
      if (/\bkantor\b|\boffice\b/.test(w))                                             return 'office';
      if (/\bgudang\b|\bwarehouse\b/.test(w))                                             return 'warehouse';
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
        // A hedge message ("kalau gak ada apartemen, villa juga boleh") names a
        // fallback type without confirming a switch — don't let it flip runType.
        const t  = isConditionalFallbackMessage(m.message) ? null : _typeOfP0(m.message);
        const tx = _txOfP0(m.message);
        if ((t && runType && t !== runType) || (tx && runTx && tx !== runTx)) {
          switchStart = m.i;
        }
        if (t)  runType = t;
        if (tx) runTx   = tx;
      }
    }

    // ── Boundary C: a fresh GREETING + property intent = new conversation ────
    // "Hi.. mau sewa apartemen di malang" — even with the SAME type as a prior
    // abandoned search — is a restart. Without this, stale budget/answers (e.g. an
    // old ambiguous "0-1600000") leak in and the AI asks a confusing question.
    // Conservative: requires greeting at the start + intent word + a property type.
    let greetingStart = 0;
    {
      const GREET_RE  = /^[\s.…,!-]*(hi|hai|halo+|hello|hey|pagi|siang|sore|malam|selamat\s+(pagi|siang|sore|malam)|permisi|assalamualaikum|asalamualaikum|met\s+(pagi|siang|sore|malam))\b/i;
      const INTENT_RE = /\b(sewa|menyewa|ngontrak|kontrak|beli|membeli|cari|nyari|mau|pengen|butuh|rent|buy|looking|cariin|carikan)\b/i;
      const seq = [
        ...history.map((m, i) => ({ i, role: m.role, message: m.message })),
        { i: history.length, role: 'customer', message: userMessage },
      ];
      for (const m of seq) {
        if (!(m.role === 'user' || m.role === 'customer')) continue;
        if (m.i === 0) continue; // pesan pertama = awal alami, bukan restart
        const msg = m.message || '';
        if (GREET_RE.test(msg) && INTENT_RE.test(msg) && _typeOfP0(msg)) {
          greetingStart = m.i;
        }
      }
    }

    const activeSessionStart = Math.max(summaryStart, switchStart, greetingStart);
    const activeHistory = history.slice(activeSessionStart);

    // True when the active session began because of a type/tx switch OR a fresh
    // greeting restart (not just a summary). Forces the Q2–Q12 reset below, since
    // the now-trimmed segment can no longer see the pre-switch context.
    // Business rule: any type/transaction change OR a greeting restart → Q1.
    const switchBoundaryHit = (switchStart > 0 && switchStart >= summaryStart)
                           || (greetingStart > 0 && greetingStart >= summaryStart);

    // custText / aiText / aiCount — scoped to ACTIVE session only
    const custText = this.#customerText(activeHistory, userMessage);
    const aiText   = this.#aiText(activeHistory);
    const aiCount  = activeHistory.filter(h => h.role === 'assistant' || h.role === 'ai').length;

    // ── RALAT JADWAL VIEWING ─────────────────────────────────────────────────
    // Bila ada pesan customer berisi kata ralat + topik viewing/jam/jadwal
    // ("ralat, viewingnya jam 2 siang aja"), semua field viewing di bawah dibaca
    // HANYA dari pesan ralat terakhir ke belakang — nilai lama ("jam 11") yang
    // muncul lebih dulu di custText tidak boleh menang lagi di summary.
    const viewingText = (() => {
      const msgs = [
        ...activeHistory.filter(m => m.role === 'user' || m.role === 'customer').map(m => m.message || ''),
        userMessage || '',
      ];
      const VIEW_TOPIC_RE = /\b(viewing\w*|survei\w*|survey\w*|jadwal\w*|jam|pukul)\b/i;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (isCorrectionMessage(msgs[i]) && VIEW_TOPIC_RE.test(msgs[i])) {
          return msgs.slice(i).join('\n').toLowerCase();
        }
      }
      return null;   // tidak ada ralat viewing → pakai custText penuh
    })();
    const vText = viewingText || custText;

    // Field viewing dihitung dari vText DULU (nilai pasca-ralat menang); bagian
    // yang TIDAK ikut diralat (mis. customer ralat jam saja, harinya tetap "rabu
    // minggu depan") di-fallback ke custText penuh supaya tidak hilang dari summary.
    // Sufiks -an kolokial ikut dikenali: "sorean"/"siangan"/"pagian"/"malaman"
    // ("Saya bisa sorean" = preferensi sore) — \bsore\b polos gagal match "sorean".
    const _todOf = (s) =>
      /\bmalam(?:an)?\b|\bmalem(?:an)?\b/i.test(s) ? 'malam'
      : /\bpagi(?:an)?\b/i.test(s) ? 'pagi'
      : /\bsiang(?:an)?\b/i.test(s) ? 'siang'
      : /\bsore(?:an)?\b/i.test(s) ? 'sore' : null;
    const _viewingTod = _todOf(vText) || (viewingText ? _todOf(custText) : null);
    const _dayRefOf = (s) => {
      const M = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const dateNDaysFromNow = (n) => {
        const d = new Date(); d.setDate(d.getDate() + n);
        return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
      };
      const nDays = s.match(/\b(\d{1,2})\s*hari\s*(?:lagi|kedepan|ke\s+depan|mendatang|besok(?:\s+ini)?|dari\s+sekarang)\b/i);
      if (nDays) return dateNDaysFromNow(parseInt(nDays[1], 10));
      if (/\bnanti\b|\bhari\s+ini\b|\bsekarang\b|(?:pagi|siang|sore|malam)\s+ini\b|\bini\s+(?:pagi|siang|sore|malam)\b/i.test(s)) return dateNDaysFromNow(0);
      if (/\bbesok\s+lusa\b|\blusa\b/i.test(s)) return dateNDaysFromNow(2);
      if (/\bbesok\b/i.test(s)) return dateNDaysFromNow(1);
      // Nama hari + depan/minggu depan → resolve ke HARI ITU yang benar, bukan
      // flat +7. Bug nyata: "rabu minggu depan" diucap Kamis 16 Juli → dulu
      // dijawab "23 Juli" (Kamis lagi!), harusnya Rabu 22 Juli.
      const DOW = { minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6 };
      const wd = s.match(/\b(senin|selasa|rabu|kamis|jumat|sabtu|ahad)\s+(?:minggu\s+)?depan\b/i)
              || s.match(/\bminggu\s+depan\s+(?:hari\s+)?(senin|selasa|rabu|kamis|jumat|sabtu|ahad)\b/i);
      if (wd) {
        const target = DOW[wd[1].toLowerCase()];
        const todayDow = new Date().getDay();
        const ahead = ((target - todayDow + 7) % 7) || 7;   // hari sama → +7
        return dateNDaysFromNow(ahead);
      }
      if (/\bminggu\s+depan\b/i.test(s)) return dateNDaysFromNow(7);
      return null;
    };
    const _viewingDayRef = _dayRefOf(vText) || (viewingText ? _dayRefOf(custText) : null);

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
    // NOTE: _typeOfP0/_txOfP0 already lowercase + stripCommercialUsePhrases internally,
    // so histCustJoined/curMsgLower here are pre-lowercased raw text (double-stripping
    // is harmless/idempotent, but we keep the join step since _typeOfP0 expects a string).
    const histCustJoined = histCustMsgs.map(m => (m.message || '').toLowerCase()).join(' ');
    const histBuildingType = _typeOfP0(histCustJoined);
    const curMsgLower = (userMessage || '').toLowerCase();
    // A hedge message ("kalau gak ada apartemen, villa juga boleh") names a fallback
    // type without confirming a switch — don't let it force a Q2-Q12 reset.
    const curBuildingType = isConditionalFallbackMessage(userMessage) ? null : _typeOfP0(curMsgLower);
    const histTx = _txOfP0(histCustJoined);
    const curTx = _txOfP0(curMsgLower);

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
      else if (/\bkantor\b|\boffice\b/i.test(custText))                                         recoveredType = 'office';
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
        // Subsidi / FLPP
        'subsidi', 'flpp', 'rumah subsidi', 'kpr subsidi',
        // KPR Syariah
        'syariah', 'murabahah', 'kpr syariah',
        // Cash variants
        'cash keras', 'cash bertahap', 'tanpa dp', 'dp 0',
      ]),
      aiAskedFinancing: this.#has(aiText, [
        'cash atau kpr', 'kpr atau cash', 'pembiayaannya', 'rencananya cash',
        'cash, kpr', 'pembiayaan', 'financing', 'pay cash or',
      ]),
      // Whether customer's financing answer indicates KPR/kredit (→ ask Q_KPR-a)
      financingIsKPR: this.#has(custText, ['kpr', 'kredit', 'cicil', 'kombinasi', 'kpt', 'mortgage', 'syariah', 'murabahah', 'flpp', 'subsidi']),
      // Whether customer uses KPR subsidi/FLPP (lower DP, income limit)
      financingIsSubsidi: this.#has(custText, ['subsidi', 'flpp', 'rumah subsidi', 'kpr subsidi']),

      /* ── Q_KPR-a: KPR readiness (bank + DP) ── */
      hasKprDetails: this.#has(custText, [
        'bca', 'mandiri', 'bni', 'bri', 'btn', 'cimb', 'danamon', 'permata',
        'dp 10', 'dp 15', 'dp 20', 'dp 25', 'dp 30', 'dp 40', 'dp 50',
        'persen', '%', 'sudah approve', 'pre-approved', 'pre approval', 'preapproval',
        'sudah cek bank', 'sudah ajukan', 'belum cek', 'belum ajukan', 'masih rencana', 'blm',
        'belum pernah',
      ]),
      // Bank name explicitly mentioned — separate from "has approved" status
      kprBankPreference: (() => {
        const lower = custText.toLowerCase();
        const banks = ['BCA', 'Mandiri', 'BNI', 'BRI', 'BTN', 'CIMB', 'Danamon', 'Permata'];
        return banks.find(b => lower.includes(b.toLowerCase())) || null;
      })(),
      // Customer said application is not yet started ("belum pernah", "masih rencana", etc.)
      kprApprovalNotStarted: this.#has(custText, [
        'belum pernah', 'belum cek', 'belum ajukan', 'masih rencana', 'belum ada bank',
        'blm cek', 'blm ajukan', 'not started', "haven't applied", 'not applied yet',
      ]),
      // DP% mentioned (separate from bank name alone)
      hasDpInfo: this.#has(custText, [
        'dp 10', 'dp 15', 'dp 20', 'dp 25', 'dp 30', 'dp 40', 'dp 50',
        'persen dp', 'dp persen', '% dp', 'dp %', 'down payment',
        'uang muka',
      ]) || /\bdp\s*\d{2,}\s*(?:%|persen)/.test(custText.toLowerCase())
         || /\b\d{2,}\s*(?:%|persen)\s*dp\b/.test(custText.toLowerCase()),
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
        'banjir', 'rawan banjir', 'genangan', 'tergenang',
        'panas', 'terlalu panas', 'kurang rindang', 'tidak teduh',
        'rel kereta', 'dekat rel', 'kereta api lewat',
        'polusi', 'bau pabrik', 'dekat industri',
        'padat', 'terlalu ramai', 'macet banget',
        'jauh', 'lorong', 'tua banget', 'tidak cocok', 'kurang cocok',
        'yang pasti', 'yang jelas tidak', 'nggak mau yang',
      ]),
      aiAskedRedFlags: this.#has(aiText, [
        'tidak cocok', 'pasti tidak', 'yang harus dihindari', 'hadap barat',
        'dekat jalan ramai', 'gang sempit', 'rumah tua', 'anything you want to avoid',
        'rawan banjir', 'banjir', 'panas', 'want to avoid',
      ]),

      /* ── Q2c: District/area dalam kota besar ── */
      hasDistrict: (() => {
        const SURABAYA_AREAS = [
          'rungkut', 'pakuwon', 'darmo', 'wonokromo', 'kenjeran', 'gubeng',
          'sukolilo', 'mulyorejo', 'tenggilis', 'gayungan', 'benowo', 'lakarsantri',
          'sambikerep', 'sukomanunggal', 'dukuh pakis', 'sawahan', 'genteng', 'bubutan',
          'simokerto', 'krembangan', 'asemrowo', 'tandes', 'wiyung', 'karangpilang',
          'wonocolo', 'jambangan', 'dukuh kupang', 'ngagel', 'nginden', 'citraland',
          'graha family', 'kembang jepun', 'surabaya selatan', 'surabaya utara',
          'surabaya barat', 'surabaya timur', 'surabaya pusat',
        ];
        const JAKARTA_AREAS = [
          'menteng', 'kebayoran', 'kemang', 'kuningan', 'sudirman', 'thamrin',
          'kelapa gading', 'pluit', 'pantai indah kapuk', 'pik', 'sunter', 'tebet',
          'senayan', 'fatmawati', 'jakarta selatan', 'jakarta utara',
          'jakarta barat', 'jakarta timur', 'jakarta pusat',
        ];
        const BANDUNG_AREAS = [
          'dago', 'buah batu', 'antapani', 'cicaheum', 'pasteur', 'setrasari',
          'setiabudi', 'sukajadi', 'lembang', 'bandung selatan', 'bandung utara',
        ];
        const ALL_AREAS = [...SURABAYA_AREAS, ...JAKARTA_AREAS, ...BANDUNG_AREAS,
          'banyumanik', 'tembalang', 'gajahmungkur', // Semarang
          'panakkukang', 'tamalate', 'biringkanaya', // Makassar
          'medan baru', 'medan sunggal', 'medan petisah', // Medan
        ];
        return ALL_AREAS.some(a => custText.toLowerCase().includes(a));
      })(),
      aiAskedDistrict: this.#has(aiText, [
        'area mana di', 'kawasan mana di', 'daerah mana di', 'wilayah mana di',
        'di bagian mana', 'area atau kawasan mana', 'mana di surabaya',
        'mana di jakarta', 'mana di bandung', 'which area or neighbourhood',
        'which neighbourhood', 'which area',
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
      // Frasa kekerabatan POLOS ('sama keluarga', 'sama istri', dst.) sengaja
      // TIDAK ada di daftar: itu kosakata jawaban Q4 penghuni ("Saya bersama
      // keluarga saja" match substring 'sama keluarga') dan dulu memicu false
      // hasDecisionMaker → Q9 di-skip + summary menampilkan "Keputusan bersama"
      // fiktif. Kin words hanya dihitung lewat frasa berkata-kerja keputusan.
      hasDecisionMaker: this.#has(custText, [
        'langsung bisa', 'bisa langsung', 'perlu koordinasi', 'perlu diskusi',
        'koordinasikan', 'koordinasiin', 'koordinasi sama', 'koordinasi dengan',
        'solo decision', 'joint decision', 'discuss with', 'check with',
        'suami dulu', 'istri dulu', 'koordinasi dulu', 'minta persetujuan',
        'izin dulu', 'keputusan bersama', 'decide together', 'putuskan sendiri',
        'keputusan sendiri',
      ]),
      aiAskedDecisionMaker: this.#has(aiText, [
        'jadwalkan viewing', 'bisa jadwalkan', 'koordinasi dulu', 'keluarga lain',
        'schedule a viewing', 'coordinate with family', 'check with',
      ]),

      /* ── Q9b: Viewing/survey date — customer asked "kapan bisa viewing?" ── */
      // Flags whether customer signalled they WANT a viewing and asked about timing.
      wantsViewingScheduled: (() => {
        // If customer explicitly said they don't need a viewing (catalog only)
        const noViewing =
          /(lihat|liat)\s+(katalog|listing|pilihan)/i.test(custText) ||
          /katalog\s*(nya)?\s*(aja|saja|dulu)/i.test(custText) ||
          /(ga|gak|engga|enggak|nggak|tidak|tdk|ndak)\s*(ada|punya|sempat)?\s*waktu\s*(untuk|buat)?\s*(survey|survei|viewing|lihat)/i.test(custText) ||
          /(ga|gak|engga|enggak|nggak|tidak|tdk|ndak)\s*mau\s*(viewing|survey|survei)/i.test(custText) ||
          /(minta|kasih|kirim|send)\s*(list|listing|katalog|daftar)/i.test(custText) ||
          /(list|listing|katalog|daftar)\s*(aja|saja|only|dulu)/i.test(custText);
        if (noViewing) return false;
        return /\b(viewing|survey|survei|kunjungan)\s+kapan\b/i.test(custText) ||
               /\bkapan\s+(?:bisa|boleh|mau)\s*(?:viewing|survey|survei|kunjungan)\b/i.test(custText) ||
               /\bboleh\s+(?:viewing|survey|survei)\b/i.test(custText) ||
               /\bmau\s+dijadwalkan\s+(?:viewing|survey|survei)\b/i.test(custText) ||
               /\bjadwalkan\s+(?:viewing|survey|survei)\b/i.test(custText) ||
               /\bschedule.{0,20}(?:viewing|survey)\b/i.test(custText);
      })(),
      // Customer gave a specific day/date for the viewing after AI asked.
      hasViewingDate: (() => {
        return /\bbesok\b|\blusa\b/i.test(custText) ||
               /\b(senin|selasa|rabu|kamis|jumat|sabtu|ahad|minggu)\s*(ini|depan)?\b/i.test(custText) ||
               /\b\d{1,2}\s*(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i.test(custText) ||
               /\btanggal\s*\d{1,2}\b/i.test(custText) ||
               // Offset relatif "N hari/minggu/bulan lagi" juga = tanggal survei diberikan
               // (mis. "survei 3 minggu lagi") — tanpa ini flow bisa terus menanyakan tanggal.
               /\b\d{1,3}\s*(hari|minggu|bulan|tahun)\s+(lagi|kedepan|ke\s+depan|mendatang|dari\s+sekarang)\b/i.test(custText) ||
               /\bjam\s*\d{1,2}(?:[.:]\d{2})?\b/i.test(custText);
      })(),
      aiAskedViewingDate: this.#has(aiText, [
        'kapan mau dijadwalkan survey', 'kapan mau survey', 'kapan mau survei',
        'kapan mau viewing', 'dijadwalkan survey-nya', 'dijadwalkan viewing-nya',
        'schedule the viewing', 'when would you like to schedule',
        'kapan survey-nya', 'kapan viewing-nya',
      ]),

      /* ── Q9c: Viewing time-of-day & specific hour ──
       * Saat customer mengusulkan waktu survey ("boleh siang", "besok pagi",
       * "nanti sore", "tanggal 5"), AI menanyakan JAM spesifik. Aturan tafsir:
       *  - ada "ini"/"nanti"/"hari ini"  → HARI INI
       *  - ada "besok"/"lusa"            → sesuai kata itu
       *  - hanya time-of-day (mis. "boleh siang") tanpa hari → default BESOK
       *  - "malam" → di luar jam survey (pagi–sore), AI tolak halus + minta jam pagi–sore
       */
      // Dihitung di atas (helper _todOf/_dayRefOf): vText (pasca-ralat) menang,
      // fallback ke custText penuh untuk bagian yang tidak ikut diralat.
      viewingTimeOfDay: _viewingTod,
      viewingIsNight: _viewingTod === 'malam',
      viewingDayRef: _viewingDayRef,
      hasViewingHour: /\b(jam|pukul)\s*\d{1,2}(?:[.:]\d{2})?\b/i.test(vText)
                   || /\b(jam|pukul)\s*(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua\s*belas)\b/i.test(vText),
      aiAskedViewingHour: this.#has(aiText, [
        'mau viewing jam berapa', 'survey jam berapa', 'survei jam berapa',
        'viewing jam berapa', 'jam berapa', 'pukul berapa', 'what time',
      ]),

      /* ── Q10: Lease duration (sewa only) ── */
      // Lookahead negatif: "3 hari LAGI" / "3 minggu KEDEPAN" adalah offset
      // tanggal (jawaban Q8/viewing), BUKAN durasi — tanpa guard ini flag
      // hasLeaseDuration aktif palsu → Q10 (durasi sewa/booking) tidak pernah
      // ditanya padahal customer belum menyebut durasi sama sekali.
      hasLeaseDuration: this.#has(custText, [
        '1 tahun', '2 tahun', '3 tahun', '6 bulan', 'setahun', 'dua tahun',
        'tiga tahun', 'per tahun', '/tahun', 'satu tahun', 'yearly',
        '1 year', '2 years', '3 years', '6 months',
        'seminggu', 'sebulan', 'semalam',
      ]) || /\b\d+\s*(hari|minggu|bulan|tahun|day|week|month|year)s?\b(?!\s*(?:lagi|kedepan|ke\s+depan|mendatang|besok|dari\s+sekarang))/i.test(custText),
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

      hasPaymentPeriod: this.#has(custText, [
        'per hari', 'harian', 'per minggu', 'mingguan', 'per bulan', 'bulanan',
        'per 3 bulan', '3 bulanan', 'per 6 bulan', '6 bulanan', 'per tahun', 'tahunan',
        'bayar harian', 'bayar mingguan', 'bayar bulanan', 'bayar tahunan',
        'daily', 'weekly', 'monthly', 'quarterly', 'annually',
      ]),
      aiAskedPaymentPeriod: this.#has(aiText, ['bayarnya', 'payment period', 'bayar per', 'bulanan atau', 'per hari, per minggu']),

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

      hasFitOut: this.#has(custText, [
        'fitted', 'fit out', 'fit-out', 'fitout', 'shell', 'bare shell',
        'siap pakai', 'bangun sendiri', 'renovasi sendiri', 'interior sendiri',
      ]),
      aiAskedFitOut: this.#has(aiText, ['fitted out', 'bare shell', 'fit out', 'kondisi ruang', 'siap pakai atau']),

      /* ── Q14: Warehouse specific ── */
      hasCeilingHeight: this.#has(custText, [
        'tinggi langit', 'ceiling', 'ketinggian gudang', 'tinggi gudang',
      ]) || /\b\d+(?:[.,]\d+)?\s*m(?:eter)?\s+(tinggi|height)\b/i.test(custText),
      aiAskedCeilingHeight: this.#has(aiText, ['tinggi langit-langit', 'ceiling height', 'tinggi gudang']),

      hasLoadingDock: this.#has(custText, [
        'loading dock', 'dock', 'bongkar muat', 'pintu truk', 'akses truk',
        'truk masuk', 'forklift',
      ]),
      aiAskedLoadingDock: this.#has(aiText, ['loading dock', 'bongkar muat', 'akses truk', 'forklift']),

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
      aiAskedBudget     : this.#has(aiText, ['kisaran', 'anggaran', 'budget', 'harga yang', 'price range', 'ribu, juta', 'thousand, million', 'maksudnya dalam', 'kira-kira yang mana', 'yang mana lebih sesuai', 'terjangkau', 'menengah', 'eksklusif', 'budget-friendly', 'mid-range', 'exclusive']),
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
        // Rule 25/35 clarification phrasings — old & new wording
        'kira-kira tanggalnya', 'tanggal berapa rencananya', 'info tanggalnya',
        'kapan rencananya masuk', 'tanggal berapa rencananya masuk',
        'planning to move in', 'when you\'re planning to move',
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
        'hasDistrict', 'aiAskedDistrict',
        'hasRedFlags', 'hasAlternativeArea', 'hasAnchorPoint', 'hasDecisionMaker',
        'hasLeaseDuration', 'hasPaymentTerms', 'hasApartmentPrefs',
        'aiAskedTxType', 'aiAskedPropType', 'aiAskedLocation', 'aiAskedSearchHist',
        'aiAskedBudget', 'aiAskedMoveIn', 'aiAskedHousehold', 'aiAskedFurnish',
        'aiAskedRedFlags', 'aiAskedAnchorPoint', 'aiAskedAltArea',
        'aiAskedDecisionMaker', 'aiAskedLeaseDuration', 'aiAskedPaymentTerms',
        'aiAskedApartmentPrefs',
        'wantsViewingScheduled', 'hasViewingDate', 'aiAskedViewingDate',
        'viewingTimeOfDay', 'viewingIsNight', 'viewingDayRef', 'hasViewingHour', 'aiAskedViewingHour',
        // Q14 type-specific slots
        'hasCheckInDate', 'hasCheckOutDate', 'hasRoomType', 'hasBreakfastPref',
        'hasPrivatePool', 'hasRentalPeriod', 'hasKosType', 'hasBathroomType',
        'hasPaymentPeriod', 'hasFitOut', 'hasCeilingHeight', 'hasLoadingDock',
        'hasBusinessType', 'hasHeadcount', 'hasRoiExpectation', 'hasPropertyPurpose',
        'aiAskedCheckIn', 'aiAskedCheckOut', 'aiAskedRoomType', 'aiAskedBreakfast',
        'aiAskedPrivatePool', 'aiAskedRentalPeriod', 'aiAskedKosType', 'aiAskedBathroomType',
        'aiAskedPaymentPeriod', 'aiAskedFitOut', 'aiAskedCeilingHeight', 'aiAskedLoadingDock',
        'aiAskedBusinessType', 'aiAskedHeadcount', 'aiAskedRoi', 'aiAskedPropertyPurpose',
        'financingIsSubsidi',
        // BELI flow (Q_KPR / Q_KPR-a / Q_COND + per-type Q14 beli)
        'hasFinancing', 'aiAskedFinancing', 'financingIsKPR', 'hasKprDetails',
        'kprBankPreference', 'kprApprovalNotStarted', 'hasDpInfo',
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

    // Store active-session custText on profile so buildAgentBrief can reuse it
    // without re-reading FULL history (which would leak stale data from old sessions).
    profile._custText = custText;
    // Teks scope viewing (dari ralat viewing terakhir bila ada) — dipakai
    // #extractViewingPreference agar jam/hari hasil RALAT yang tampil di summary.
    profile._viewingText = vText;
    // Pesan customer SAAT INI — dipakai #buildViewingHourQuestion untuk mendeteksi
    // pertanyaan balik soal ketersediaan agen ("Kakak bisa kapan?") di giliran ini.
    profile._currentMsg = userMessage || '';
    // Pesan AI TERAKHIR (yang sedang dijawab customer) — dipakai untuk memastikan
    // sub-dialog viewing memang topik BERJALAN, bukan flag "pernah ditanya" yang
    // bocor dari pencarian lama di sesi yang sama (mis. "sorean" & pertanyaan jam
    // viewing dari flow sebelumnya yang ditinggalkan lalu customer memulai pencarian
    // baru). Tanpa ini, AI tiba-tiba tanya "Sore jam berapa?" padahal sedang tanya
    // fasilitas/furnitur.
    {
      const _lastAi = [...activeHistory].reverse().find(m => m.role === 'ai' || m.role === 'assistant');
      profile._lastAiText = (_lastAi?.message || '').toLowerCase();
    }

    // ── Re-scope budget to the ACTIVE session (anti-leak) ─────────────────────
    // `filters` di atas diisi extractPropertyFilters() yang membaca FULL history,
    // sehingga budget angka/ambigu dari pencarian LAMA (mis. "0-1600000") bocor ke
    // pencarian baru — bahkan saat sesi aktif cuma berisi durasi "2 bulan" (digit
    // "2" BUKAN budget). Hitung ulang budget HANYA dari sesi aktif (activeHistory +
    // pesan saat ini) supaya nilai basi tidak pernah terlihat.
    // Catatan: budget KATEGORI (preference terjangkau/menengah/eksklusif) tetap
    // tertangkap karena ia memang muncul di sesi aktif bila customer menyebutnya.
    const activeBudget = extractPropertyFilters(userMessage, activeHistory).budget || null;
    if (activeBudget && activeBudget.ambiguous) {
      profile.budget          = null;
      profile.budgetAmbiguous = activeBudget;
    } else if (activeBudget) {
      profile.budget          = activeBudget;
      profile.budgetAmbiguous = null;
    } else {
      profile.budget          = null;
      profile.budgetAmbiguous = null;
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

  /* ─── Public: 3-tier budget table (terjangkau / menengah / eksklusif) ────── */

  /**
   * Range harga WAJAR per tipe properti × transaksi × kategori budget.
   * Dipakai untuk: (a) menjawab Q3 secara KATEGORI (bukan tembak angka absolut), dan
   * (b) mengisi summary Budget saat customer hanya memilih kategori (terjangkau/
   * menengah/eksklusif) — diberi perkiraan range harga yang masuk akal.
   *
   * Nilai disimpan sebagai [min, max] IDR + period ('month'|'night'|''), agar bisa
   * diformat ke "Rp X - Rp Y /bln" tanpa duplikasi teks per bahasa.
   *
   * @returns {{terjangkau:number[], menengah:number[], eksklusif:number[], period:string}|null}
   */
  static getBudgetTiers(buildingType = '', transactionType = '', periodHint = '') {
    // Tabel HARGA WAJAR (single source of truth) kini di propertyRecommendationService
    // agar extractPropertyFilters bisa memakainya untuk MEMBATASI katalog, bukan
    // sekadar tampil di summary. Metode ini mendelegasikan supaya tidak ada dua
    // salinan tabel yang bisa menyimpang.
    return svcGetBudgetTiers(buildingType, transactionType, periodHint);
  }

  /** Format angka IDR penuh: 5000000 → "Rp 5.000.000". */
  static #rpFull(n) {
    if (!Number.isFinite(n)) return '';
    return `Rp ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  /**
   * Resolve KATEGORI budget (terjangkau/menengah/eksklusif) → string range harga wajar
   * untuk tipe+transaksi tertentu, mis. "Rp 350.000.000 - Rp 900.000.000" atau
   * "Rp 2.000.000 - Rp 6.000.000 /bln". Tier eksklusif open-ended → akhiri "+".
   * Dipakai di summary saat customer jawab kategori (bukan angka).
   *
   * @param {string} periodHint - 'month'|'night'|'year'|'' untuk memilih mode villa sewa.
   * @returns {string|null}
   */
  static getBudgetRangeForTier(buildingType, transactionType, tierName, lang = 'id', periodHint = '') {
    const tiers = this.getBudgetTiers(buildingType, transactionType, periodHint);
    if (!tiers || !tiers[tierName]) return null;
    const [min, max] = tiers[tierName];
    const suffix = tiers.period === 'month' ? (lang === 'id' ? ' /bln' : ' /month')
      : tiers.period === 'night' ? (lang === 'id' ? ' /malam' : ' /night')
      : tiers.period === 'year'  ? (lang === 'id' ? ' /thn'   : ' /year') : '';
    const plus = tierName === 'eksklusif' ? '+' : '';   // luxury = open-ended
    return `${this.#rpFull(min)} - ${this.#rpFull(max)}${plus}${suffix}`;
  }

  /* ─── Public: skill "harga wajar" — jawab pertanyaan terbuka kapan saja ──────
   * Sebelumnya tabel _BUDGET_TIERS hanya dipakai di 2 momen sempit: (a) render
   * ringkasan setelah Q3 dijawab kategori, (b) fallback saat katalog 0 hasil.
   * Pertanyaan TERBUKA di luar dua momen itu ("berapa harga wajar sewa rumah di
   * surabaya?", "booking villa di bali biasanya berapa?") tidak terjawab. Skill
   * ini mendeteksi pertanyaan semacam itu KAPAN SAJA (termasuk di tengah Q1-Q12)
   * dan menjawab dari tabel yang SAMA dipakai filter katalog — tanpa mereset
   * progress qualifikasi (jawaban di-PREPEND ke pertanyaan Q berikutnya, bukan
   * menggantikannya). Berlaku utk 3 mode: sewa (bulanan/tahunan), booking
   * (per malam), beli (harga jual absolut).
   */

  static #PRICE_QUESTION_RE = /\b(harga\s+wajar|kisaran\s+harga|range\s+harga|harga\s+pasaran|harga\s+umum|harga\s+normal|estimasi\s+harga|berapa(?:an)?\s+(?:kira-?kira\s+)?(?:harga|budget|biaya)|harga(?:nya)?\s+(?:sekitar\s+)?berapa|biasanya\s+berapa|price\s+range|reasonable\s+price|typical\s+price|how\s+much\s+(?:is|does)|around\s+how\s+much)\b/i;

  /**
   * True bila pesan customer adalah pertanyaan TERBUKA soal harga wajar
   * (bukan jawaban Q3 numerik/kategori — dijaga dengan syarat detectBudget()
   * TIDAK menemukan angka konkret dalam pesan yang sama).
   * @returns {boolean}
   */
  static isReasonablePriceQuestion(text = '') {
    if (!this.#PRICE_QUESTION_RE.test(text)) return false;
    const b = detectBudget(text);
    // Kalau customer sekaligus menyebut angka pasti ("berapa ya kalau budget 5 juta")
    // itu jawaban Q3, bukan pertanyaan terbuka — jangan tangani di sini.
    return !(b && (b.min != null || b.max != null));
  }

  /**
   * Deteksi mode transaksi dari framing pertanyaan itu sendiri:
   *   sewa/kontrak/kontrakan   → 'rent' + periodHint bulanan/tahunan
   *   booking/nginap/per malam → 'rent' + periodHint malam (night)
   *   beli/jual/beli putus     → 'sale'
   * Return null bila tidak disebutkan (→ caller tampilkan ketiganya).
   */
  static #detectPriceQuestionMode(text = '') {
    const t = text.toLowerCase();
    if (/\b(beli|jual|dijual|membeli|pembelian|beli\s*putus)\b/.test(t)) return { tx: 'sale', periodHint: '' };
    if (/\b(booking|nginap|menginap|per\s*malam|semalam|check-?in)\b/.test(t)) return { tx: 'rent', periodHint: '' };
    if (/\b(sewa|kontrak|kontrakan|menyewa|disewa|nyewa)\b/.test(t)) {
      return { tx: 'rent', periodHint: /\btahun|kontrak\s*tahunan\b/.test(t) ? 'year' : 'month' };
    }
    return null;
  }

  /** Format satu blok tier (Terjangkau/Menengah/Eksklusif) untuk satu period tertentu. */
  static #formatTierBlock(buildingType, tx, periodHint, lang, modeLabel) {
    const tiers = this.getBudgetTiers(buildingType, tx, periodHint);
    if (!tiers) return null;
    const isId = lang === 'id';
    const rt = (name) => this.getBudgetRangeForTier(buildingType, tx, name, lang, periodHint);
    return `${modeLabel}${modeLabel ? ' — ' : ''}${isId ? 'Terjangkau' : 'Affordable'}: ${rt('terjangkau')}\n`
         + `   ${isId ? 'Menengah' : 'Mid-range'}: ${rt('menengah')}\n`
         + `   ${isId ? 'Eksklusif' : 'Premium'}: ${rt('eksklusif')}`;
  }

  /**
   * Bangun jawaban "harga wajar" lengkap untuk satu tipe properti, mencakup
   * SEWA (bulanan/tahunan), BOOKING (per malam, bila tipe mendukung), dan BELI —
   * atau hanya mode yang diminta bila mode terdeteksi dari pertanyaan.
   *
   * @param {string}      buildingType
   * @param {object|null} modeHint - { tx, periodHint } dari #detectPriceQuestionMode(), atau null (semua mode)
   * @param {'id'|'en'}   lang
   * @returns {string}
   */
  static buildReasonablePriceAnswer(buildingType, modeHint, lang = 'id') {
    const isId = lang === 'id';
    const typeLabel = PropertyFormatter.humanBuildingType(buildingType, lang);
    const BOOKING_TYPES = new Set(['hotel', 'villa', 'kondotel', 'boarding_house']);
    const blocks = [];

    const wantRent = !modeHint || modeHint.tx === 'rent';
    const wantSale = !modeHint || modeHint.tx === 'sale';

    if (wantRent) {
      // PENTING: cek `modeHint` (objeknya), BUKAN `modeHint.periodHint` — periodHint
      // booking/malam bernilai '' (falsy) yang tadinya salah dianggap "tak ada mode
      // spesifik" dan jatuh ke cabang dual-block, menampilkan blok booking DUA KALI
      // (identik) saat customer eksplisit minta mode booking saja.
      if (modeHint && modeHint.tx === 'rent') {
        // Mode spesifik diminta (mis. "booking" → periodHint '', "sewa tahunan" → 'year').
        const b = this.#formatTierBlock(buildingType, 'rent', modeHint.periodHint, lang, '');
        if (b) blocks.push(b);
      } else if (BOOKING_TYPES.has(buildingType)) {
        // Tipe booking-capable & mode tak spesifik → tampilkan BOOKING (malam) + SEWA PANJANG.
        const booking = this.#formatTierBlock(buildingType, 'rent', '', lang, isId ? '📅 Booking (per malam)' : '📅 Booking (per night)');
        const longStay = this.#formatTierBlock(buildingType, 'rent', buildingType === 'boarding_house' ? 'year' : 'month', lang, isId ? '📆 Sewa jangka panjang' : '📆 Long-stay rent');
        if (booking) blocks.push(booking);
        if (longStay && longStay !== booking) blocks.push(longStay);
      } else {
        const b = this.#formatTierBlock(buildingType, 'rent', '', lang, isId ? '🏠 Sewa' : '🏠 Rent');
        if (b) blocks.push(b);
      }
    }
    if (wantSale) {
      const b = this.#formatTierBlock(buildingType, 'sale', '', lang, isId ? '💵 Beli' : '💵 Buy');
      if (b) blocks.push(b);
    }

    if (!blocks.length) {
      return isId
        ? `Maaf, saya belum punya acuan harga wajar untuk tipe ${typeLabel}.`
        : `Sorry, I don't have a reasonable-price reference for ${typeLabel} yet.`;
    }

    const header = isId
      ? `💰 Kisaran harga wajar *${typeLabel}* di Indonesia:`
      : `💰 Reasonable price range for *${typeLabel}* in Indonesia:`;
    return `${header}\n\n${blocks.join('\n\n')}`;
  }

  /**
   * Q_NAME / Q_EMAIL — pertanyaan identitas customer TEPAT sebelum summary.
   * - NAMA: dibutuhkan registrasi customer (tabel customers). TIDAK ditanya bila
   *   customer sudah memperkenalkan diri ("Hi saya Rina, ...", "Perkenalkan, saya
   *   Rizal", "Nama saya Kezia") — atau sudah pernah ditanya (tanya SEKALI saja;
   *   tidak dijawab pun summary tetap lanjut, fallback nama profil WhatsApp).
   * - EMAIL: hanya bila jadwal viewing sudah disepakati (undangan kalender) dan
   *   belum ada email di chat — juga maksimal SEKALI.
   * Return teks pertanyaan, atau null bila tidak perlu bertanya (lanjut summary).
   */
  static buildIdentityQuestion(history, userMessage, profile, lang = 'id') {
    const isId = lang === 'id';
    try {
      const {
        extractIdentityFromChat, aiAlreadyAskedName, aiAlreadyAskedEmail,
      } = require('../services/customerRegistrationService');
      const identity = extractIdentityFromChat(history, userMessage);

      // Q_NAME — belum kenal nama & belum pernah tanya
      if (!identity.name && !aiAlreadyAskedName(history)) {
        return isId
          ? 'Sebelum saya buatkan ringkasannya — boleh saya tahu nama Kakak? 😊'
          : 'Before I prepare your summary — may I know your name? 😊';
      }

      // Q_EMAIL — viewing sudah dijadwalkan, email belum ada & belum pernah tanya
      const viewingPlanned = !!(profile?.hasViewingHour || profile?.hasViewingDate
                               || profile?.wantsViewingScheduled);
      if (viewingPlanned && !identity.email && !aiAlreadyAskedEmail(history)) {
        return isId
          ? 'Untuk undangan jadwal viewing-nya, boleh minta alamat email Kakak? 📧\n(Kalau tidak berkenan, balas "lewati" saja — tidak wajib 😊)'
          : 'For the viewing invitation, may I have your email address? 📧\n(Reply "skip" if you prefer not to — it\'s optional 😊)';
      }
    } catch (err) {
      console.warn('[PrivateAgent/Q_NAME] identity check failed (non-fatal):', err.message);
    }
    return null;
  }

  /**
   * Balasan pengakuan RALAT — supaya AI terasa responsif & adaptif saat customer
   * memperbaiki jawaban ("ralat, budget 1-2 miliar", "ganti viewingnya jam 2").
   * Return teks singkat berisi nilai yang diperbarui (di-prepend ke balasan
   * berikutnya), atau null bila pesan bukan ralat / tidak ada nilai baru dikenali.
   * Nilai state-nya sendiri sudah di-overwrite oleh extractQualificationState
   * (budget/moveInDate) dan scope _viewingText (jam/hari viewing) — helper ini
   * hanya membuat pengakuannya eksplisit ke customer.
   */
  static buildCorrectionAck(userMessage = '', lang = 'id') {
    if (!isCorrectionMessage(userMessage)) return null;
    const isId = lang === 'id';
    const updated = [];

    const isViewingTopic = /\b(viewing\w*|survei\w*|survey\w*|jadwal\w*)\b/i.test(userMessage);

    // Budget baru di pesan ralat?
    const b = detectBudget(userMessage);
    if (b && !b.ambiguous) {
      updated.push(isId ? `Budget → *${b.preference === 'affordable' ? 'terjangkau' : b.text}*`
                        : `Budget → *${b.preference === 'affordable' ? 'affordable' : b.text}*`);
    }

    // Jam/hari viewing baru?
    const hourM = userMessage.match(/\b(?:jam|pukul)\s*(\d{1,2}(?:[.:]\d{2})?)\b/i);
    if (isViewingTopic && hourM) {
      const tod = (userMessage.match(/\b(pagi|siang|sore)\b/i) || [])[1] || '';
      updated.push(isId ? `Jadwal viewing → *jam ${hourM[1]}${tod ? ' ' + tod : ''}*`
                        : `Viewing time → *${hourM[1]}${tod ? ' ' + tod : ''}*`);
    }

    // Tanggal target/masuk baru? (bukan konteks viewing)
    if (!isViewingTopic) {
      try {
        const { parseCustomerDate } = require('../utils/customerDateParser');
        const parsed = parseCustomerDate(userMessage, new Date());
        if (parsed && parsed.status === 'ok') {
          updated.push(isId ? `Tanggal target → *${parsed.formatted}*` : `Target date → *${parsed.formatted}*`);
        }
      } catch (_e) { /* non-fatal */ }
    }

    if (!updated.length) return null;
    return isId
      ? `✏️ Siap, sudah saya perbarui ya:\n${updated.map(u => `• ${u}`).join('\n')}\nTerima kasih koreksinya! 🙏`
      : `✏️ Got it, I have updated:\n${updated.map(u => `• ${u}`).join('\n')}\nThanks for the correction! 🙏`;
  }

  /**
   * Entry point dipanggil dari alur utama: kalau pesan customer adalah
   * pertanyaan harga wajar terbuka, kembalikan teks jawabannya (untuk di-PREPEND
   * ke pertanyaan Q berikutnya); else null (tidak relevan, lanjutkan seperti biasa).
   *
   * @param {string} userMessage
   * @param {object} profile - Dari buildProfile() — dipakai sbg fallback tipe/tx
   *                            bila tidak disebut eksplisit di pesan ini.
   * @param {'id'|'en'} lang
   * @returns {string|null}
   */
  static maybeAnswerReasonablePriceQuestion(userMessage, profile, lang = 'id') {
    if (!this.isReasonablePriceQuestion(userMessage)) return null;

    const mentionedType = detectBuildingType(userMessage);
    const buildingType = mentionedType || profile?.buildingType || '';
    if (!buildingType) {
      return lang === 'id'
        ? '💰 Tentu! Tipe properti apa yang ingin Anda ketahui kisaran harganya? (rumah, apartemen, villa, hotel, dll.)'
        : "💰 Sure! Which property type would you like the price range for? (house, apartment, villa, hotel, etc.)";
    }

    const modeHint = this.#detectPriceQuestionMode(userMessage);
    return this.buildReasonablePriceAnswer(buildingType, modeHint, lang);
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
   * mode = 'summary' → Ask full Q0–Q12 (used by both catalog and summary modes)
   * mode = 'catalog' → (legacy, no longer used) same as 'summary' but skips Q5–Q12
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

    /* ── Q2c: District/area sub-question for cities with known landmarks ── */
    // Fires when location has a landmark entry (LOCATION_LANDMARKS) and no specific
    // area/district yet mentioned. Not fired for commercial types, bookings, or when
    // district is already known. Landmark examples are city-specific (Q2c & Q6 share
    // the same LOCATION_LANDMARKS map — see top of file — so adding a new city there
    // automatically wires up both questions).
    const isCommercialType  = ['shophouse', 'office', 'warehouse', 'store'].includes(type);
    const cityLandmarks     = getCityLandmarksEnriched(loc);
    // Booking (hotel/kondotel/villa) & customer yang sudah menyebut patokan lokasi
    // (anchorPoint, mis. "dekat PTC") TIDAK ditanya area lagi — redundant dengan Q6.
    if (loc && !profile.hasDistrict && !profile.aiAskedDistrict
        && !isCommercialType
        && !PropertyFormatter.isBookingType(type)
        && !profile.hasAnchorPoint
        && cityLandmarks) {
      const sample = cityLandmarks.slice(0, 4).join(', ');
      const exDistrict = isId
        ? `Misalnya ${sample}, atau area lainnya?`
        : `For example ${sample}, or another area?`;
      return isId
        ? `Di area atau kawasan mana di *${loc}* yang Anda pertimbangkan? 📍\n${exDistrict}`
        : `Which area or neighbourhood in *${loc}* are you considering? 📍\n${exDistrict}`;
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

    /* ── Q3: budget via KATEGORI (terjangkau/menengah/eksklusif) — NEVER tembak angka ── */
    // Hindari menyebut range harga absolut (mis. "Rp 40 M dan Rp 67 M") — kurang ramah.
    // Tanyakan kategori; range konkret di-resolve di summary (getBudgetRangeForTier).
    if (!profile.budget && !profile.aiAskedBudget && !profile.customerStatedBudget && loc) {
      const typeHuman = type ? PropertyFormatter.humanBuildingType(type, isId ? 'id' : 'en') : (isId ? 'properti' : 'property');
      const txWord = isId
        ? (tx === 'rent' ? 'sewa' : tx === 'sale' ? 'beli' : '')
        : (tx === 'rent' ? 'to rent' : tx === 'sale' ? 'to buy' : '');
      const forType = isId ? `Untuk *${typeHuman}*${txWord ? ' ' + txWord : ''} di *${loc}*` : `For *${typeHuman}*${txWord ? ' ' + txWord : ''} in *${loc}*`;
      return isId
        ? `${forType}, Kak lebih prefer yang *terjangkau*, *menengah*, atau *eksklusif*? 💰`
        : `${forType}, would you prefer *budget-friendly*, *mid-range*, or *exclusive*? 💰`;
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
          ? `Kak, kira-kira *kapan rencananya masuk / pindah*? (mohon info bulan & tanggalnya 📅)`
          : `Could you let me know roughly *when you're planning to move in*? (month & date please 📅)`;
      }
      // current_month — tanggal harus ≥ hari ini
      return isId
        ? `Untuk bulan ini, kira-kira *tanggal berapa rencananya masuk*, Kak? 📅`
        : `For this month, around *which date* are you planning to move in? 📅`;
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

    /* ── Q_FAC: facilities/amenities (WAJIB untuk SEWA, OPSIONAL untuk BELI hunian) ── */
    const isBuyResidential = tx === 'sale' && ['house', 'apartment', 'villa', 'mansion'].includes(type);
    if ((tx === 'rent' || isBuyResidential) && !profile.hasFacilities && !profile.aiAskedFacilities) {
      if (type === 'apartment') {
        return isId
          ? `Ada fasilitas apartemen tertentu yang Anda inginkan? Misalnya kolam renang, gym, rooftop, keamanan 24 jam, atau yang lainnya? 🏊`
          : `Any specific apartment facilities you'd like? For example swimming pool, gym, rooftop, 24-hour security, or others? 🏊`;
      }
      if (type === 'villa') {
        return isId
          ? `Ada fasilitas villa yang diinginkan? Misalnya kolam renang pribadi, dapur lengkap, BBQ area, atau yang lainnya? 🏊`
          : `Any specific villa facilities you'd like? For example private pool, full kitchen, BBQ area, or others? 🏊`;
      }
      return isId
        ? `Ada fasilitas tertentu yang Anda inginkan? Misalnya AC, kolam renang, gym, carport/garasi, keamanan 24 jam, atau yang lainnya? 🏊`
        : `Any specific facilities you'd like? For example AC, swimming pool, gym, carport/garage, 24-hour security, or others? 🏊`;
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
          ? `Ada yang pasti tidak cocok atau ingin dihindari? Misalnya rawan banjir, area panas, hadap barat, dekat jalan ramai, gang sempit, atau dekat rel kereta? 🚫`
          : `Anything you definitely want to avoid? Like flood-prone areas, hot/west-facing, noisy streets, narrow alleys, or near train tracks? 🚫`;
      }

      /* ── Q6: Anchor point (only if not surfaced in Q2) ── */
      if (!profile.hasAnchorPoint && !profile.aiAskedAnchorPoint && loc) {
        // Sebut landmark LOKAL kota customer (mal, kawasan, wisata) bila tersedia di
        // LOCATION_LANDMARKS — jauh lebih relevan daripada contoh generik untuk semua kota.
        const marks = getCityLandmarksEnriched(loc);
        if (marks && marks.length) {
          const sample = marks.slice(0, 3).join(', ');
          return isId
            ? `Ada lokasi atau tempat tertentu yang jadi patokan? Misalnya dekat ${sample}, sekolah anak, atau jalan tertentu? 📍`
            : `Any specific location or landmark you'd like to be near? For example ${sample}, a school, or a specific street? 📍`;
        }
        return isId
          ? `Ada lokasi atau tempat tertentu yang jadi patokan? Misalnya dekat sekolah anak, mal, wisata, kawasan tertentu, atau jalan tertentu? 📍`
          : `Any specific location or landmark you'd like to be near? For example a school, mall, tourist spot, residential estate, or street? 📍`;
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

      /* ── Q9b: Viewing/survey date — fires when customer asked "kapan bisa viewing?" ──
       * Fires only when:
       *  (a) customer signalled they want to schedule (wantsViewingScheduled)
       *  (b) AI hasn't asked for the date yet (!aiAskedViewingDate)
       *  (c) customer hasn't volunteered a specific date (!hasViewingDate)
       * NOT fired when customer prefers catalog only (wantsCatalogOnly). */
      if (profile.wantsViewingScheduled && !profile.hasViewingDate && !profile.aiAskedViewingDate
          && !profile.viewingTimeOfDay) {
        const ct = profile._custText || '';
        // Personalize: extract who they're bringing to the viewing
        const withM = ct.match(/koordinasikan?\s+sama\s+([\w\s-]+?)(?:\s*\.|,|\?|$)/i)
                   || ct.match(/sama\s+(istri|suami|pasangan|teman(?:-teman)?|keluarga|orang\s+tua)\b/i);
        const withWhom = withM ? withM[1].trim().replace(/\s*saya\s*$/i, '').trim() : '';
        const bersama = withWhom ? ` bersama ${withWhom} Anda` : '';
        return isId
          ? `Baik, Kak. Kira-kira kapan mau dijadwalkan survey-nya${bersama}? 📅`
          : `Got it! When would you like to schedule the viewing${bersama}? 📅`;
      }

      /* ── Q9c: Viewing hour — customer usulkan hari/waktu, minta JAM spesifik ── */
      {
        const q9c = ConversationQualifier.#buildViewingHourQuestion(profile, isId);
        if (q9c) return q9c;
      }

      /* ── Q10: Lease duration (sewa only, duration not volunteered) ──
         Booking (hotel/kondotel/villa) TIDAK ditanya durasi sewa generik di sini —
         durasi menginap ditangani lewat check-in/check-out (jumlah malam) di Q14. */
      if (tx === 'rent' && !PropertyFormatter.isBookingType(type)
          && !profile.hasLeaseDuration && !profile.aiAskedLeaseDuration) {
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
        // Skip check-out kalau check-in DAN durasi/malam sudah diketahui — check-out
        // dihitung otomatis (mis. check-in 16 Juli + 1 minggu = 23 Juli). Jangan tanya lagi.
        if (!profile.hasCheckOutDate && !profile.aiAskedCheckOut
            && !(profile.hasCheckInDate && profile.hasLeaseDuration))
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

      // Kos: type + bathroom + payment period
      if (type === 'boarding_house') {
        if (!profile.hasKosType && !profile.aiAskedKosType)
          return isId ? `Kos yang dicari untuk *putra*, *putri*, atau *campur*? 🏠` : `Looking for *male-only*, *female-only*, or *mixed* boarding house? 🏠`;
        if (!profile.hasBathroomType && !profile.aiAskedBathroomType)
          return isId ? `Kamar mandi *dalam* (en-suite) atau *luar* (shared) oke? 🚿` : `*Private bathroom* (en-suite) or *shared bathroom* is okay? 🚿`;
        if (!profile.hasPaymentPeriod && !profile.aiAskedPaymentPeriod)
          return isId ? `Untuk pembayaran kos, prefer *harian*, *mingguan*, *bulanan*, atau *tahunan*? 💳` : `For payment, do you prefer *daily*, *weekly*, *monthly*, or *annual*? 💳`;
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

      // Kantor / Office: headcount + building grade + fit-out condition
      if (type === 'office') {
        if (!profile.hasHeadcount && !profile.aiAskedHeadcount)
          return isId ? `Berapa orang yang akan bekerja di kantor ini? (untuk tentukan luas & grade gedung) 👥` : `How many people will work in this office? (to determine size & building grade) 👥`;
        if (!profile.hasBusinessType && !profile.aiAskedBusinessType)
          return isId ? `Preferensi gedung *Grade A* (premium), *Grade B* (mid), atau *Grade C* (ekonomis)? 🏢` : `Preference: *Grade A* (premium), *Grade B* (mid), or *Grade C* (economy) building? 🏢`;
        if (!profile.hasFitOut && !profile.aiAskedFitOut)
          return isId ? `Kondisi ruang yang diinginkan: *fitted out* (siap pakai, tinggal kerja) atau *bare shell* (bangun interior sendiri)? 🏢` : `Office condition: *fitted out* (move-in ready) or *bare shell* (build your own interior)? 🏢`;
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

      // Gudang / Warehouse: purpose + ceiling height + loading dock + (beli) zonasi
      if (type === 'warehouse') {
        if (!profile.hasBusinessType && !profile.aiAskedBusinessType)
          return isId ? `Gudangnya untuk apa — *produksi*, *distribusi*, atau *penyimpanan*? 📦` : `What is the warehouse for — *production*, *distribution*, or *storage*? 📦`;
        if (!profile.hasCeilingHeight && !profile.aiAskedCeilingHeight)
          return isId ? `Tinggi langit-langit dibutuhkan berapa meter? (penting untuk penyimpanan bertingkat & forklift) 📏` : `What ceiling height is needed? (important for stacked storage & forklift use) 📏`;
        if (!profile.hasLoadingDock && !profile.aiAskedLoadingDock)
          return isId ? `Perlu berapa *loading dock*? Dan akses forklift di dalam? 🚛` : `How many *loading docks* are needed? And forklift access inside? 🚛`;
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
      // KATEGORI, bukan tembak angka absolut (lebih ramah & sopan).
      const txWord = isId ? (tx === 'rent' ? 'sewa' : 'beli') : (tx === 'rent' ? 'to rent' : 'to buy');
      return isId
        ? `Untuk rumah ${txWord} di *${loc}*, Kak lebih prefer yang *terjangkau*, *menengah*, atau *eksklusif*? 💰`
        : `For a house ${txWord} in *${loc}*, would you prefer *budget-friendly*, *mid-range*, or *exclusive*? 💰`;
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

    /* ── Q9b: Viewing date (same logic as summary mode) ── */
    if (profile.wantsViewingScheduled && !profile.hasViewingDate && !profile.aiAskedViewingDate
        && !profile.viewingTimeOfDay) {
      const ct = profile._custText || '';
      const withM = ct.match(/koordinasikan?\s+sama\s+([\w\s-]+?)(?:\s*\.|,|\?|$)/i)
                 || ct.match(/sama\s+(istri|suami|pasangan|teman(?:-teman)?|keluarga|orang\s+tua)\b/i);
      const withWhom = withM ? withM[1].trim().replace(/\s*saya\s*$/i, '').trim() : '';
      const bersama = withWhom ? ` bersama ${withWhom} Anda` : '';
      return isId
        ? `Baik, Kak. Kira-kira kapan mau dijadwalkan survey-nya${bersama}? 📅`
        : `Got it! When would you like to schedule the viewing${bersama}? 📅`;
    }

    /* ── Q9c: Viewing hour — customer sudah usulkan hari/waktu, minta JAM spesifik ── */
    {
      const q9c = ConversationQualifier.#buildViewingHourQuestion(profile, isId);
      if (q9c) return q9c;
    }

    /* ── Q7: Red flags (if not captured at Q4) ── */
    if (!profile.hasRedFlags && !profile.aiAskedRedFlags && profile.aiAskedSearchHist) {
      return isId
        ? `Ada yang pasti Kak hindari? Misalnya rawan banjir, area panas, hadap barat, gang sempit, atau dekat rel kereta? 🚫`
        : `Anything you definitely want to avoid? E.g. flood-prone, hot area, west-facing, narrow alley, or near train tracks? 🚫`;
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
      /* ── Q_FAC: facilities/amenities (WAJIB untuk SEWA, OPSIONAL untuk BELI hunian) ── */
      if (!profile.hasFacilities && !profile.aiAskedFacilities) {
        const profileType = profile.buildingType || type || '';
        if (profileType === 'apartment') {
          return isId
            ? `Ada fasilitas apartemen yang Kak inginkan? Misalnya kolam renang, gym, rooftop, atau keamanan 24 jam? 🏊`
            : `Any specific apartment facilities you'd like, Kak? E.g. swimming pool, gym, rooftop, or 24-hour security? 🏊`;
        }
        return isId
          ? `Ada fasilitas tertentu yang Kak inginkan? Misalnya AC, kolam renang, gym, carport/garasi, keamanan 24 jam, atau lainnya? 🏊`
          : `Any specific facilities you'd like, Kak? E.g. AC, swimming pool, gym, carport/garage, 24-hour security, or others? 🏊`;
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
      ? (profile.kprApprovalNotStarted ? 'not-started'
         : profile.hasKprDetails ? 'applied/pre-approved'
         : 'not-started')
      : (profile.financingCash ? 'n/a' : 'unknown');
    const dpReady = profile.hasDpInfo ? 'ready/partial' : 'unknown';

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
      const bankHint = profile.kprBankPreference ? ` (prefers ${profile.kprBankPreference})` : '';
      agentNote = agentNote || `KPR not-started${bankHint} / DP unknown — qualify financing before viewing.`;
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
        method,
        bank_preference: profile.kprBankPreference || null,
        dp_readiness: dpReady,
        approval_status: approval,
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

    // Use the active-session custText stored by buildProfile() — it is scoped to
    // activeHistory only, so stale data from prior sessions (e.g. "2 bulan" from
    // an old Malang search) never leaks into the current search's brief.
    const custText = profile._custText || this.#customerText(history, userMessage);

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
        // Title-case per kata: customer sering ketik lowercase ("di jakarta")
        // dan summary menampilkannya mentah ("✓ Lokasi: jakarta").
        value : filters.location
          ? String(filters.location).replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          : 'UNKNOWN',
        source: 'stated', // location always stated
      },
      budget: (() => {
        const b = filters.budget;
        const TIER_LABEL = { terjangkau: 'Terjangkau', menengah: 'Menengah', eksklusif: 'Eksklusif', affordable: 'Terjangkau' };
        const periodHint = (b && b.period) || ConversationQualifier.#periodHintFromText(custText);

        // (0) qualState.budget takes priority — it's first-captured and session-scoped,
        //     immune to later messages (e.g. "fasilitas standar") triggering a wrong tier.
        const qb = qualState.budget || '';
        if (/^terjangkau/.test(qb)) {
          const range = ConversationQualifier.getBudgetRangeForTier(
            filters.buildingType, filters.transactionType, 'terjangkau', 'id', periodHint
          );
          return { value: range ? `Terjangkau (${range})` : 'Terjangkau', source: 'stated' };
        }
        if (/^menengah/.test(qb)) {
          const range = ConversationQualifier.getBudgetRangeForTier(
            filters.buildingType, filters.transactionType, 'menengah', 'id', periodHint
          );
          return { value: range ? `Menengah (${range})` : 'Menengah', source: 'stated' };
        }
        if (/^eksklusif/.test(qb)) {
          const range = ConversationQualifier.getBudgetRangeForTier(
            filters.buildingType, filters.transactionType, 'eksklusif', 'id', periodHint
          );
          return { value: range ? `Eksklusif (${range})` : 'Eksklusif', source: 'stated' };
        }

        // (a) Customer jawab KATEGORI (terjangkau/menengah/eksklusif) → tampilkan
        //     kategori + perkiraan range harga wajar untuk tipe+transaksi tsb.
        if (b && b.preference && TIER_LABEL[b.preference]) {
          const tierKey = b.preference === 'affordable' ? 'terjangkau' : b.preference;
          const range = ConversationQualifier.getBudgetRangeForTier(
            filters.buildingType, filters.transactionType, tierKey, 'id', periodHint
          );
          return {
            value : range ? `${TIER_LABEL[b.preference]} (${range})` : TIER_LABEL[b.preference],
            source: 'stated',
          };
        }
        // (b) Angka / range konkret dari qualState (mis. "Rp 2.000.000 - Rp 4.000.000/bulan")
        if (qb && !qb.startsWith('terjangkau') && !qb.startsWith('menengah') && !qb.startsWith('eksklusif')) {
          return { value: qb, source: 'stated' };
        }
        // (c) Angka / range konkret dari filters. Skip yang AMBIGU ("15-20" dari "lantai 15-20").
        return {
          value : (b?.text && !b?.ambiguous)
            ? b.text + ConversationQualifier.#budgetPeriodSuffix(custText)
            : 'UNKNOWN',
          source: wasStated(custText, ['juta', 'ribu', 'miliar', 'jt', 'm ', 'rb', 'budget', 'harga'])
            ? 'stated' : 'inferred',
        };
      })(),

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
        // Prefer qualState.decisionMaker (Phase 2 normalized: "Mandiri", "Koordinasi
        // dengan pasangan", etc.) over extraction from full custText. Fallback is
        // gated ONLY by hasDecisionMaker (a real Q9 decision-signal keyword hit) —
        // household composition (Q4) has no bearing on who decides and must NOT
        // gate this field (previously caused "Disebutkan di Q4" to appear even when
        // Q9 was never asked/answered).
        value : qualState.decisionMaker
          ? qualState.decisionMaker
          : (profile.hasDecisionMaker
              ? this.#extractDecisionMaker(custText, profile)
              : 'UNKNOWN'),
        source: (qualState.decisionMaker || profile.hasDecisionMaker) ? 'stated' : 'UNKNOWN',
      },
      household: {
        // Prefer qualState.household (Phase-2 per-message extraction, anchored ke
        // jawaban Q4 asli: "Saya tinggal sendirian" → "1 orang (sendiri)"). Fallback
        // #extractHouseholdSummary memindai SELURUH custText — kata nyasar dari
        // jawaban lain ("dekat wisata BNS" di patokan lokasi Q6) pernah membajak
        // baris ini jadi "Untuk liburan/menginap sementara" pada transaksi BELI,
        // menimpa jawaban penghuni yang sebenarnya.
        value : qualState.household
          ? qualState.household
          : (profile.hasHouseholdInfo ? this.#extractHouseholdSummary(custText) : 'UNKNOWN'),
        source: (qualState.household || profile.hasHouseholdInfo) ? 'stated' : 'UNKNOWN',
      },
      furnishing: {
        value : profile.hasFurnishing
          ? this.#extractFurnishing(custText)
          : 'UNKNOWN',
        source: profile.hasFurnishing ? 'stated' : 'inferred',
      },
      // Q_COND (beli): kondisi unit — baru/ready | second | inden | gabungan
      // ("baru atau second"). Diambil dari qualState (extractor multi-pilih);
      // null bila tidak pernah dijawab → baris disembunyikan oleh renderer.
      propertyCondition: {
        value : qualState.propertyCondition || null,
        source: qualState.propertyCondition ? 'stated' : 'UNKNOWN',
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
        value : this.#extractViewingPreference(custText, profile),
        source: this.#extractViewingPreference(custText, profile) !== 'UNKNOWN' ? 'stated' : 'UNKNOWN',
      },
      alternativeAreas: {
        value : profile.hasAlternativeArea
          ? this.#extractAlternativeAreas(custText)
          : 'UNKNOWN',
        source: profile.hasAlternativeArea ? 'stated' : 'UNKNOWN',
      },
      // ─ Hindari (avoid) & Prefer — pasangan berpasangan dari jawaban bebas Q5/Q6/Q12.
      // Menggantikan dump mentah qualState.redFlags (yang sering berupa kalimat POSITIF,
      // bukan larangan) dengan interpretasi Hindari↔Prefer yang benar. Lihat
      // #buildAvoidPreferPairs untuk detail logika pemasangan.
      ...(() => {
        // Gabungkan jawaban Q5 eksplisit DENGAN seluruh teks customer sesi aktif:
        // preferensi sering di-volunteer di luar pertanyaan Q5 (mis. "Saya cari yang
        // sepi / akses jalan lancar / tempat yang rindang" sebagai lanjutan jawaban
        // Q2b) — dulu hilang total dari summary karena sumber pairs hanya
        // qualState.redFlags (yang bisa berisi jawaban lain, mis. landmark).
        // #buildAvoidPreferPairs berbasis regex kata-kunci sehingga aman menerima
        // teks yang lebih luas.
        const redFlagsSource   = [qualState.redFlags || '', custText].filter(Boolean).join(' ');
        const apartmentPrefRaw = qualState.apartmentPref || '';
        const { avoid, prefer } = ConversationQualifier.#buildAvoidPreferPairs(redFlagsSource, apartmentPrefRaw);
        return {
          avoidItems : avoid,
          preferItems: prefer,
          // Legacy single-string fields kept for any other consumer / backward-compat.
          redFlags: {
            value : avoid.length ? avoid.map(a => a.label).join(', ') : 'UNKNOWN',
            source: avoid.length ? 'stated' : 'UNKNOWN',
          },
          preferences: {
            value : prefer.length ? prefer.map(p => p.label).join(', ') : 'UNKNOWN',
            source: prefer.length ? 'stated' : 'UNKNOWN',
          },
        };
      })(),
      apartmentPref: (() => {
        // Q12 — preferensi TOWER / LANTAI / ORIENTASI (khusus apartemen/kondotel/kondominium).
        // Jawaban customer ke "ada preferensi tower atau lantai? hadap timur, lantai rendah/
        // tengah/tinggi?". Hanya relevan untuk tipe hunian bertingkat. Untuk tipe lain → null
        // (baris disembunyikan di summary). Di-normalisasi agar lantai & orientasi terbaca rapi
        // plus insight (hindari matahari terbit+terbenam = ingin unit sejuk).
        const isVerticalType = ['apartment', 'condo', 'kondotel'].includes(filters.buildingType);
        if (!isVerticalType) return { value: null, source: 'UNKNOWN' };
        // ⚠️ custText fallback is gated on aiAskedApartmentPrefs (Q12 actually asked) —
        // without this, ANY earlier mention of "hadap"/"matahari terbenam" answered to
        // a DIFFERENT question (e.g. Q5 red flags) gets misattributed here as if it
        // were a Q12 tower/floor answer. Mirrors the anchorPoint gating pattern below.
        const raw = qualState.apartmentPref
          || ((profile.hasApartmentPrefs && profile.aiAskedApartmentPrefs) ? custText : '');
        const norm = this.#normalizeApartmentPref(raw);
        return {
          value : norm || 'UNKNOWN',
          source: norm ? 'stated' : 'UNKNOWN',
        };
      })(),
      anchorPoint: {
        // Prefer qualState.anchorPoint (Phase 2 — exact full customer reply to Q6,
        // e.g. "deket indomaret, cafe dan ubaya"). The raw #extractAnchorPoint fallback
        // is gated on the anchor having actually been ASKED (aiAskedAnchorPoint) —
        // otherwise "deket <kota>" (a location phrase) and joined multi-message text
        // produce a garbage anchor. If never asked → UNKNOWN (shown as "Belum ditanyakan").
        // Jawaban negatif ("enggak ada", "bebas", "terserah") dinormalkan jadi
        // "Bebas (jawaban asli)" agar agent tahu customer fleksibel soal patokan.
        value : qualState.anchorPoint
          ? this.#normalizeAnchorPoint(qualState.anchorPoint)
          : ((profile.hasAnchorPoint && profile.aiAskedAnchorPoint) ? this.#extractAnchorPoint(custText) : 'UNKNOWN'),
        source: (qualState.anchorPoint || (profile.hasAnchorPoint && profile.aiAskedAnchorPoint)) ? 'stated' : 'UNKNOWN',
      },
      facilities: (() => {
        // Gabungkan fasilitas SPESIFIK (yang customer sebut eksplisit) dengan fasilitas
        // STANDAR (bila customer bilang "fasilitas standar"). Contoh nyata:
        //   "pokok fasilitas standar, tambahin kulkas & 10 spring bed" + "private pool"
        //   → Kolam renang, Kulkas, Kasur + [standar villa: AC, WiFi, Peralatan dapur, …]
        const specific = [];
        const pushUnique = (arr) => {
          (arr || []).forEach(f => {
            const v = String(f).trim();
            if (!v || v.toLowerCase() === 'standar') return; // 'standar' = penanda, bukan nama fasilitas
            if (!specific.some(x => x.toLowerCase() === v.toLowerCase())) specific.push(v);
          });
        };
        pushUnique(filters.facilities);
        pushUnique(qualState.facilities);

        // Apakah customer minta fasilitas standar (penanda 'standar' di qualState)?
        const wantsStandard = Array.isArray(qualState.facilities)
          && qualState.facilities.some(f => String(f).toLowerCase() === 'standar');

        let stdItems = [];
        if (wantsStandard) {
          // Furnishing hint: qualState (Phase 1) sering null saat customer bilang
          // "semi aja" tanpa kata "furnish". Fallback ke #extractFurnishing(custText)
          // yang mengenali "semi"/"full"/"kosongan" agar tier standar sesuai.
          const furnHint = qualState.furnishing || filters.furnishing
            || (profile.hasFurnishing ? this.#extractFurnishing(custText) : '');
          const stdList = ConversationQualifier.#getStandardFacilitiesByType(
            filters.buildingType, furnHint
          );
          if (stdList) stdItems = stdList.split(',').map(s => s.trim()).filter(Boolean);
        }

        // Item spesifik DULU (prioritas kata customer), lalu standar yang belum tercakup.
        const merged = [...specific];
        stdItems.forEach(s => {
          if (!merged.some(x => x.toLowerCase() === s.toLowerCase())) merged.push(s);
        });

        if (merged.length) {
          // isStandard = true HANYA bila murni standar (customer tak sebut item spesifik).
          return {
            value     : merged.join(', '),
            isStandard: wantsStandard && specific.length === 0,
            source    : 'stated',
          };
        }
        return { value: 'UNKNOWN', isStandard: false, source: 'UNKNOWN' };
      })(),

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
  /** Tebak periode dari teks customer untuk memilih band villa sewa (bulanan vs harian). */
  /**
   * Standard facility list by building type + furnishing level.
   * Shown when customer answers Q_FAC with "standar/biasa/terserah".
   * Returns null when no meaningful standard list exists for the type.
   */
  /**
   * Fasilitas STANDAR per tipe properti saat sewa/booking.
   * Dipakai saat customer bilang "fasilitas standar / biasa / terserah / tidak tahu".
   * Basis: tabel fasilitas standar Elevan Property (per tipe). Untuk tipe hunian
   * (house/apartment/villa/condo/boarding_house/mansion), furnishing full/semi
   * menambah perabot/elektronik. Tipe komersial (ruko/kantor/gudang/toko) tidak
   * bergantung furnishing.
   *
   * @param {string} buildingType - key katalog (house, apartment, villa, dst.)
   * @param {string} furnishing   - 'full'/'semi'/'' (opsional)
   * @returns {string|null} daftar fasilitas dipisah koma, atau null bila tak dikenali
   */
  static #getStandardFacilitiesByType(buildingType, furnishing) {
    // Delegasi ke util bersama (utils/standardFacilities.js) — satu sumber
    // kebenaran, juga dipakai propertyRecommendationService untuk fallback
    // rekomendasi saat katalog agent tidak menemukan data.
    return getStandardFacilitiesByType(buildingType, furnishing);
  }

  static #periodHintFromText(custText) {
    if (/\bmalam\b|\bnight\b|harian|per\s+malam|\/\s*malam/i.test(custText)) return 'night';
    if (/\bbulan\b|\bmonth\b|bulanan|per\s+bulan|\/\s*bulan/i.test(custText)) return 'month';
    if (/\btahun\b|\byear\b|tahunan|per\s+tahun|\/\s*tahun|\bthn\b/i.test(custText)) return 'year';
    if (/\bminggu\b|\bweek\b|mingguan/i.test(custText)) return 'night'; // short-stay → band harian
    return '';
  }

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
    // Urutan: sinyal keputusan SPESIFIK dulu. Frasa kekerabatan polos ("bersama
    // keluarga", "sama istri") TIDAK boleh match sendirian — itu kosakata jawaban
    // Q4 (penghuni: "tinggal bersama siapa?"), bukan jawaban Q9 (siapa yang
    // memutuskan). Substring /sama keluarga/ dulu match di dalam "berSAMA KELUARGA"
    // → summary salah menampilkan "Keputusan bersama: Bersama keluarga" padahal Q9
    // tidak pernah ditanya. Kin words kini hanya dihitung saat menempel pada kata
    // kerja keputusan (koordinasi/diskusi/tanya/izin/persetujuan/putuskan).
    if (/langsung bisa|bisa langsung/.test(custText))     return 'Solo (bisa langsung jadwalkan)';
    if (/koordinasikan?|koordinasi dulu|perlu diskusi/.test(custText)) return 'Perlu koordinasi (joint decision)';
    const kin = custText.match(/\b(?:koordinasi(?:kan|in)?|diskusi(?:kan)?|tanya|izin|persetujuan|putus(?:kan)?|keputusan)\b[^.!?\n]{0,40}?\b(suami|istri|pasangan|keluarga|orang\s*tua|teman)\b/i);
    if (kin) return `Koordinasi dengan ${kin[1].toLowerCase()}`;
    if (/\b(?:putus(?:kan)?|keputusan|decide)\b[^.!?\n]{0,20}\bsendiri\b|\bsendiri\b[^.!?\n]{0,20}\byang\s+(?:putus|memutuskan)\b/i.test(custText)) return 'Sendirian';
    // NOTE: previously had `if (profile.hasHouseholdInfo) return 'Disebutkan di Q4';`
    // here — REMOVED. Household composition (Q4: "siapa saja yang tinggal") has no
    // bearing on WHO decides (Q9) — that fallback fabricated a decision-maker value
    // any time Q4 was answered, even when Q9 was never asked or answered with a pure
    // scheduling reply ("Boleh kak, kapan ya?"). Q9 must stay UNKNOWN until a real
    // decision-maker signal is found.
    return 'UNKNOWN';
  }

  static #extractHouseholdSummary(custText) {
    // URUTAN PENTING: jawaban penghuni EKSPLISIT ("tinggal sendirian", "berdua",
    // "2 anak") diperiksa DULUAN — itu jawaban langsung atas Q4 dan harus menang.
    // Label use-case (liburan/investasi/dll) hanya fallback bila customer tidak
    // pernah menjawab komposisi penghuni — dulu use-case dicek duluan sehingga
    // kata nyasar dari jawaban lain menimpa jawaban Q4 yang sebenarnya.
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
    // Fallback: non-residential / temporary use (ibadah, investasi, kantor/usaha,
    // liburan) — bukan komposisi penghuni, tampilkan PENGGUNAANNYA. Hanya sampai
    // sini bila tidak ada satu pun jawaban komposisi penghuni di atas.
    const use = detectUseCase(custText);
    if (use) return useCaseLabel(use);
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
    //
    // Lookahead negatif: "N unit lagi/kedepan/besok/mendatang/dari sekarang" adalah
    // OFFSET TANGGAL ("checkin 3 minggu lagi" = tanggal check-in +3 minggu), BUKAN
    // durasi menginap — jangan tangkap sebagai durasi.
    const m = custText.match(/(\d+)\s*(hari|malam|minggu|bulan|tahun|day|night|week|month|year)s?\b(?!\s*(?:lagi|kedepan|ke\s+depan|mendatang|besok|dari\s+sekarang))/i);
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
   * Q9c — Pertanyaan JAM viewing. Dipanggil setelah customer mengusulkan hari/waktu
   * survey (mis. "boleh siang", "besok pagi", "tanggal 5") tapi belum sebut JAM spesifik.
   * Aturan tafsir hari (lihat profile.viewingDayRef):
   *   - "ini"/"nanti"/"hari ini"      → hari ini
   *   - "besok"/"lusa"                → sesuai kata
   *   - hanya time-of-day tanpa hari  → default BESOK ("boleh siang" = besok siang)
   * "malam" = di luar jam survey → tolak halus, minta jam pagi–sore.
   * Return string pertanyaan, atau null jika belum waktunya bertanya.
   */
  static #buildViewingHourQuestion(profile = {}, isId = true) {
    // Jangan tanya jam viewing jika customer eksplisit menolak viewing / minta listing saja
    const ct = profile._custText || '';
    const viewingRefused =
      /(ga|gak|engga|enggak|nggak|tidak|tdk|ndak)\s*mau\s*(viewing|survey|survei)/i.test(ct) ||
      /(minta|kasih|kirim|send)\s*(list|listing|katalog|daftar)/i.test(ct) ||
      /(list|listing|katalog|daftar)\s*(aja|saja|only|dulu)/i.test(ct) ||
      /(lihat|liat)\s+(katalog|listing|pilihan)/i.test(ct) ||
      /katalog\s*(nya)?\s*(aja|saja|dulu)/i.test(ct) ||
      /(ga|gak|engga|enggak|nggak|tidak|tdk|ndak)\s*(ada|punya|sempat)?\s*waktu\s*(untuk|buat)?\s*(survey|survei|viewing|lihat)/i.test(ct);
    if (viewingRefused) return null;

    // Hanya dalam konteks viewing (AI sudah tanya decision-maker / tanggal survey)
    const inViewingCtx = profile.aiAskedDecisionMaker || profile.aiAskedViewingDate;
    if (!inViewingCtx) return null;

    // ⚠️ Viewing harus jadi topik BERJALAN, bukan sekadar "pernah ditanya". Flag
    // aiAskedDecisionMaker/aiAskedViewingDate bernilai true bila AI PERNAH menanyakannya
    // di mana pun sepanjang sesi — sehingga bisa bocor dari pencarian LAMA yang
    // ditinggalkan (customer lalu mulai pencarian baru tanpa greeting/ganti tipe →
    // boundary tak reset). Gejala nyata: setelah AI tanya "Untuk furnitur…?", AI malah
    // nyeletuk "Sore jam berapa?" (sore & jam bocor dari flow sebelumnya). Guard:
    // topik viewing dianggap berjalan HANYA bila pesan AI terakhir memang soal
    // viewing/survei/jadwal/koordinasi/jam, ATAU pesan customer saat ini menyinggung
    // viewing/survei/jadwal.
    const _lastAi = profile._lastAiText || '';
    const _curMsgLo = (profile._currentMsg || '').toLowerCase();
    const viewingIsCurrentTopic =
      /\b(viewing|survei|survey|jadwalkan|jadwal|koordinasi|check.?in)\b/i.test(_lastAi)
      || /\bjam\s+berapa\b/i.test(_lastAi)
      || /\b(viewing|survei|survey|jadwal|ketemu|janjian|ketemuan)\b/i.test(_curMsgLo);
    if (!viewingIsCurrentTopic) return null;

    // ── Customer BALIK BERTANYA ketersediaan agen ─────────────────────────────
    // "Kakak bisa survei dengan saya, kapan bisa ya?" / "Tanggal berapa bisa?" /
    // "Sebaiknya enak kapan ya kita survei bareng?" — customer sedang bertanya ke
    // KITA, bukan menjawab. Dulu dijawab robotik "Itu jam berapa, Kak? 📅" (pertanyaan
    // diabaikan). Kini: jawab adaptif — tawarkan 2 tanggal konkret + kisaran jam
    // yang mengikuti preferensi waktu yang sudah disebut ("Saya bisa sorean" → sore).
    const curMsg = profile._currentMsg || '';
    const asksAvailability =
      /\b(?:kapan|tanggal\s+berapa|hari\s+apa)\b[^.!?\n]{0,30}\b(?:bisa|kosong|luang|available|free)\b/i.test(curMsg) ||
      /\b(?:bisa|kosong|luang)\b[^.!?\n]{0,30}\b(?:kapan|tanggal\s+berapa|hari\s+apa)\b/i.test(curMsg) ||
      /\benak(?:nya)?\s+kapan\b/i.test(curMsg) ||
      /\bkapan\s+(?:bisa|enak(?:nya)?|ya)\b/i.test(curMsg);
    if (asksAvailability && !profile.hasViewingHour) {
      const M = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const dLabel = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getDate()} ${M[d.getMonth()]}`; };
      const todPref = profile.viewingTimeOfDay;
      const hourHint = todPref === 'sore'  ? (isId ? 'sore — sekitar jam 3 atau jam 4' : 'in the afternoon — around 3 or 4 PM')
        : todPref === 'siang' ? (isId ? 'siang — sekitar jam 12 atau jam 1' : 'midday — around 12 or 1 PM')
        : todPref === 'pagi'  ? (isId ? 'pagi — sekitar jam 9 atau jam 10' : 'in the morning — around 9 or 10 AM')
        : (isId ? '— jam 10 pagi atau jam 3 sore' : '— 10 AM or 3 PM');
      return isId
        ? `Saya fleksibel kok, Kak — tinggal menyesuaikan jadwal Kakak 😊\nBagaimana kalau *besok (${dLabel(1)})* atau *lusa (${dLabel(2)})* ${hourHint}?\nKalau kurang pas, sebut saja tanggal & jam yang paling nyaman ya 📅`
        : `I'm flexible, Kak — happy to follow your schedule 😊\nHow about *tomorrow (${dLabel(1)})* or *the day after (${dLabel(2)})* ${hourHint}?\nIf that doesn't suit, just tell me any date & time 📅`;
    }

    // Customer sudah usulkan hari ATAU time-of-day, tapi belum sebut jam
    const proposedTiming = profile.viewingTimeOfDay || profile.hasViewingDate;
    // ⚠️ WAJIB: jangan return null hanya karena aiAskedViewingHour sudah true — itu
    // dulu menyebabkan AI "menyerah" dan lompat ke pertanyaan lain begitu customer
    // menjawab vague ("besok sore?" tanpa jam spesifik). Jam viewing WAJIB dikonfirmasi
    // sebelum lanjut — kalau masih belum ada jam spesifik, tanya ULANG dengan follow-up
    // singkat, bukan diam-diam melanjutkan ke pertanyaan berikutnya.
    if (!proposedTiming || profile.hasViewingHour) return null;

    // Malam → di luar jam survey (pagi–sore)
    if (profile.viewingIsNight) {
      return isId
        ? `Mohon maaf, Kak — survey biasanya hanya bisa pagi sampai sore. Kira-kira Kakak bisanya jam berapa (pagi–sore)? ⏰`
        : `Apologies, Kak — viewings are usually only available from morning to evening. What time (morning–evening) works for you? ⏰`;
    }

    const tod = profile.viewingTimeOfDay; // pagi/siang/sore/null

    // Sudah pernah tanya jam sebelumnya TAPI customer masih jawab vague (mis. "besok
    // sore?" tanpa jam) → follow-up singkat menegaskan waktu yang sudah disebut,
    // JANGAN ulang pertanyaan penuh (terasa robotic) dan JANGAN pindah topik.
    if (profile.aiAskedViewingHour) {
      const todLabel = tod ? this.#capitalizeFirst(tod) : (isId ? 'Itu' : 'That');
      return isId ? `${todLabel} jam berapa, Kak? 📅` : `What time exactly, Kak? 📅`;
    }

    // Susun frasa hari + waktu. Default hari = besok bila hanya time-of-day disebut.
    const dayRef = profile.viewingDayRef || (tod ? 'besok' : '');
    const phraseId = [dayRef, tod].filter(Boolean).join(' ');  // "besok siang"
    const forId    = phraseId ? ` untuk ${phraseId}` : '';
    const forEn    = phraseId ? ` for ${phraseId}`   : '';
    return isId
      ? `Baik, Kak${forId} — kira-kira mau viewing jam berapa? ⏰`
      : `Got it, Kak${forEn} — what time would you like the viewing? ⏰`;
  }

  /**
   * Preferensi VIEWING/SURVEY (Q9). Customer sering minta langsung lihat katalog tanpa
   * survei ("Mau lihat katalognya aja, gak ada waktu survei") ATAU minta dijadwalkan
   * viewing. Ditangkap agar agent tahu langkah berikutnya. UNKNOWN → baris disembunyikan.
   */
  static #extractViewingPreference(custText, profile = {}) {
    const wantsCatalogOnly =
      /(lihat|liat)\s+(katalog|listing|pilihan)/.test(custText) ||
      /katalog\s*(nya)?\s*(aja|saja|dulu)/.test(custText) ||
      /langsung\s+(katalog|listing|rekomendasi)/.test(custText) ||
      /tanpa\s+(survey|survei|viewing|lihat\s+lokasi)/.test(custText) ||
      /(ga|gak|engga|enggak|nggak|tidak|tdk|ndak)\s*(ada|punya|sempat)?\s*waktu\s*(untuk|buat)?\s*(survey|survei|viewing|lihat)/.test(custText) ||
      /(ga|gak|engga|enggak|nggak|tidak|tdk|ndak)\s*mau\s*(viewing|survey|survei)/i.test(custText) ||
      /(minta|kasih|kirim|send)\s*(list|listing|katalog|daftar)/i.test(custText) ||
      /(list|listing|katalog|daftar)\s*(aja|saja|only|dulu)/i.test(custText);
    if (wantsCatalogOnly) return 'Minta listing';

    // AI asked for viewing HOUR and customer gave a specific time ("jam 1 siang")
    // Triggered by Q9c "mau viewing jam berapa?" — builds "Besok siang jam 1" label,
    // or "Jam 7 pagi, 9 Juli 2026" when dayRef is a resolved calendar date.
    if ((profile.aiAskedViewingHour || profile.aiAskedDecisionMaker) && profile.hasViewingHour) {
      const tod    = profile.viewingTimeOfDay;
      const dayRef = profile.viewingDayRef || (tod ? 'besok' : '');
      const dayRefCap = dayRef ? dayRef.charAt(0).toUpperCase() + dayRef.slice(1) : '';
      // Scope ke teks pasca-ralat bila ada, dan ambil match jam TERAKHIR — customer
      // yang meralat ("ralat, jam 2 aja") harus menang atas jam pertama ("jam 11").
      const hourSrc = profile._viewingText || custText;
      const hourMs  = [...hourSrc.matchAll(/\b(?:jam|pukul)\s*(\d{1,2}(?:[.:]\d{2})?)\b/gi)];
      const hourM   = hourMs.length ? hourMs[hourMs.length - 1] : null;
      const hourStr = hourM ? `jam ${hourM[1]}` : '';
      // Resolved date (contains month name, e.g. "9 Juli 2026") → "Jam 7 pagi, 9 Juli 2026"
      const MONTHS_LO = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
      const isResolvedDate = dayRef && MONTHS_LO.some(m => dayRef.toLowerCase().includes(m));
      if (isResolvedDate && hourStr) {
        const hourCap = hourStr.charAt(0).toUpperCase() + hourStr.slice(1);
        const todPart = tod ? ` ${tod}` : '';
        return `${hourCap}${todPart}, ${dayRefCap}`;
      }
      const parts  = [dayRefCap, tod, hourStr].filter(Boolean);
      return parts.length ? parts.join(' ') : 'Sudah dikonfirmasi';
    }

    // Waktu survei RELATIF menempel konteks survei → resolve ke tanggal konkret.
    // "Saya mau survei 3 minggu lagi" = hari ini + 21 hari → "Survey dijadwalkan:
    // 7 Agustus 2026". Ambil offset HANYA dari klausa yang menyebut survei/viewing
    // (dipisah per kalimat) supaya tidak salah pakai tanggal MASUK (Q8, "20-30 Mei").
    {
      const viewSrc = [profile._currentMsg, profile._viewingText, custText].filter(Boolean).join('  ');
      const relRe = /\b(\d{1,3})\s*(hari|minggu|bulan|tahun)\s+(?:lagi|kedepan|ke\s+depan|mendatang|dari\s+sekarang)\b/i;
      const survClause = viewSrc.split(/[.!?\n]+/)
        .find(s => /\b(survei|survey|viewing|lihat\s+(?:unit|rumah|properti|lokasi))\b/i.test(s) && relRe.test(s));
      if (survClause) {
        const rm = survClause.match(relRe);
        const n = parseInt(rm[1], 10);
        const unit = rm[2].toLowerCase();
        const d = new Date();
        if (unit === 'hari')        d.setDate(d.getDate() + n);
        else if (unit === 'minggu') d.setDate(d.getDate() + n * 7);
        else if (unit === 'bulan')  d.setMonth(d.getMonth() + n);
        else                        d.setFullYear(d.getFullYear() + n);
        const M = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        return `Survey dijadwalkan: ${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
      }
    }

    // AI already asked for viewing date — check if customer confirmed a date
    if (profile.aiAskedViewingDate) {
      if (profile.hasViewingDate) {
        const datePatterns = [
          /\b(besok|lusa)\b/i,
          /\b(senin|selasa|rabu|kamis|jumat|sabtu|ahad|minggu)(?:\s+(?:ini|depan))?\b/i,
          /\b(\d{1,2}\s*(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember))\b/i,
          /\b(tanggal\s*\d{1,2})\b/i,
          /\b(jam\s*\d{1,2}(?:[.:]\d{2})?)\b/i,
        ];
        for (const p of datePatterns) {
          const m = custText.match(p);
          if (m) return `Survey dijadwalkan: ${m[1]}`;
        }
        return 'Mau viewing (tanggal dikonfirmasi)';
      }
      return 'Mau viewing (tanggal belum dikonfirmasi)';
    }

    // Customer perlu koordinasi dulu sebelum viewing — tangkap dengan siapa.
    // Contoh: "saya koordinasikan sama teman saya" → "koordinasikan sama teman (Belum ditanyakan)"
    const coordMatch = custText.match(/koordinasikan?\s+sama\s+([\w\s-]+?)(?:\s*\.|,|\?|$)/i);
    if (coordMatch) {
      const withWhom = coordMatch[1].trim().replace(/\s*saya\s*$/i, '').trim();
      return `koordinasikan sama ${withWhom} (Belum ditanyakan)`;
    }
    if (/koordinasikan?|perlu\s+koordinasi|koordinasi\s+dulu/.test(custText))
      return 'Perlu koordinasi dulu (tanggal belum ditanyakan)';

    const wantsScheduled =
      /(jadwal(kan)?|atur|booking|boleh)\s+(viewing|survey|survei|kunjungan)/.test(custText) ||
      /(mau|pengen|ingin|bisa)\s+(viewing|survey|survei|lihat\s+unit|lihat\s+lokasi)/.test(custText) ||
      /\bboleh\s+viewing\b/.test(custText) ||
      /\b(viewing|survey|survei)\s+kapan\b/.test(custText);
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
    // "tidak panas / tidak gerah / jangan panas / no heat" — customer wants a cool
    // spot; capture as an avoid-item so it isn't dropped from the summary.
    if (/(?:tidak|gak|ga|ngga|enggak|jangan|anti|hindari|bukan)\s+(?:yang\s+)?panas|\bgerah\b|\bpengap\b|too hot|not hot/.test(custText))
                                                     flags.push('Tidak mau panas');
    if (/tua|old building/.test(custText))           flags.push('Tidak mau bangunan tua');
    if (/tidak\s+macet|bebas\s+macet|anti\s+macet|hindari\s+macet|sering\s+macet|macet\s+(banget|parah)|kemacetan/.test(custText))
                                                     flags.push('Tidak mau macet');
    if (/tidak\s+gelap|gelap.{0,15}jalan|jalan.{0,15}gelap|tidak\s+terang/.test(custText))
                                                     flags.push('Jalan tidak gelap');
    if (/\bdekat\s+rel\b|\brel\s+kereta\b|train\s+track/.test(custText))
                                                     flags.push('Tidak mau dekat rel kereta');
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

  /**
   * Bangun daftar berpasangan "Hindari" (avoid) + "Prefer" (positive) dari jawaban
   * bebas customer di Q5/Q6 (redFlags) DAN Q12 (apartmentPref, orientasi matahari).
   *
   * MASALAH SEBELUMNYA: qualState.redFlags berisi jawaban MENTAH customer apa adanya
   * (mis. "Tempat yang sejuk, akses jalan lancar dan tidak banjir..") — ini sering
   * berupa kalimat POSITIF (apa yang DIINGINKAN), bukan kalimat "Hindari X" yang
   * sebenarnya. Menampilkannya mentah-mentah di baris "Hindari" salah kaprah: agent
   * jadi mengira customer bilang "hindari tempat sejuk" (padahal sebaliknya —
   * customer INGIN tempat sejuk, jadi yang harus dihindari adalah tempat PANAS).
   *
   * Setiap preferensi POSITIF yang punya lawan alami (sejuk↔panas, akses lancar↔macet,
   * dst.) menghasilkan SATU pasangan: baris Hindari pakai kalimat asli customer sebagai
   * label + anotasi "Hindari [lawannya]"; baris Prefer pakai label yang sama tanpa anotasi.
   * Statement yang SUDAH berupa larangan eksplisit (banjir, hadap barat, gang sempit, dll.)
   * masuk Hindari apa adanya, tanpa pasangan Prefer (tidak ada "lawan positif" alami).
   *
   * Orientasi matahari (Q12): jika customer minta hindari sinar matahari TERBIT *dan*
   * TERBENAM sekaligus, itu berarti ingin unit sejuk & bebas silau — dapat SATU pasangan
   * khusus: Hindari = deskripsi kamar yang dihindari, Prefer = kenyamanan yang dicari.
   *
   * @param {string} redFlagsRawText - qualState.redFlags atau custText (jawaban Q5/Q6)
   * @param {string} apartmentPrefRawText - qualState.apartmentPref (jawaban mentah Q12)
   * @returns {{avoid: Array<{label:string, reason:string|null}>, prefer: Array<{label:string}>}}
   */
  static #buildAvoidPreferPairs(redFlagsRawText = '', apartmentPrefRawText = '') {
    const avoid = [];
    const prefer = [];
    const lower = String(redFlagsRawText || '').toLowerCase();

    // ── Preferensi POSITIF dengan lawan (avoid) alami ─────────────────────────
    // Baris Hindari memakai lawan NEGATIF sebagai label ("Suasana ramai"), BUKAN
    // menggandakan label Prefer ("Suasana tenang : Hindari tempat bising/ramai" —
    // format lama yang membingungkan karena label Hindari = hal yang justru
    // diinginkan). Anotasi reason opsional memakai frasa "Tidak [keinginan]".
    const PAIRS = [
      { test: /\b(sejuk|adem|dingin|rindang|teduh|asri)\b/,               preferLabel: 'Tempat yang sejuk',   avoidLabel: 'Tempat panas',        avoidReason: 'Tidak sejuk' },
      { test: /\bakses\s+(jalan\s+)?(lancar|mudah|gampang)\b/,            preferLabel: 'Akses jalan lancar',  avoidLabel: 'Akses jalan lancar',  avoidReason: null },
      { test: /\b(tenang|sepi)\b/,                                       preferLabel: 'Suasana tenang',      avoidLabel: 'Suasana ramai',       avoidReason: 'Tidak sepi' },
      { test: /\baman\b/,                                                preferLabel: 'Lingkungan aman',     avoidLabel: 'Lingkungan rawan',    avoidReason: 'Tidak aman' },
      { test: /\bjalan\s+(raya\s+)?(lebar|besar|luas)\b/,                 preferLabel: 'Jalan lebar',         avoidLabel: 'Gang sempit',         avoidReason: 'Jalan tidak lebar' },
      { test: /\b(?:per)?air(?:an)?\s+(lancar|bersih|bagus|jernih)\b/,   preferLabel: 'Perairan lancar',     avoidLabel: 'Perairan bermasalah', avoidReason: 'Air tidak lancar' },
      { test: /\bstrategis\b/,                                           preferLabel: 'Lokasi strategis',    avoidLabel: null,                   avoidReason: null },
    ];
    // "Mau/suka/cari yang RAMAI" — customer justru INGIN suasana ramai/hidup
    // (kebalikan dari pair tenang/sepi). Hindari-nya adalah tempat sepi.
    const wantsRamai = /\b(mau|suka|cari|pengen|pgn|ingin|prefer)\b[^.!?\n]{0,40}?\b(ramai|rame)\b/.test(lower);
    if (wantsRamai) {
      avoid.push({ label: 'Tidak mau tempat yang sepi', reason: null });
    }

    PAIRS.forEach(p => {
      if (p.test.test(lower)) {
        // Pair tenang/sepi tidak berlaku bila customer justru minta ramai.
        if (wantsRamai && p.preferLabel === 'Suasana tenang') return;
        prefer.push({ label: p.preferLabel });
        if (p.avoidLabel) avoid.push({ label: p.avoidLabel, reason: p.avoidReason });
      }
    });

    // ── Statement yang SUDAH avoid-framed, tanpa lawan Prefer alami ──────────
    const AVOID_ONLY = [
      { test: /\bbanjir\b|flood/,                                        label: 'Tidak mau banjir' },
      { test: /hadap\s+barat|west\s+facing/,                             label: 'Tidak mau hadap barat' },
      { test: /gang\s+sempit|narrow/,                                    label: 'Tidak mau gang sempit' },
      // "bising/ramai" hanya avoid bila TIDAK diminta positif ("mau yang ramai").
      { test: /\bbising\b|noisy|\bramai\b/,                              label: 'Tidak mau bising/ramai', skipIfWantsRamai: true },
      { test: /\btua\b|old\s+building/,                                  label: 'Tidak mau bangunan tua' },
      { test: /dekat\s+rel\b|rel\s+kereta|train\s+track/,                label: 'Tidak mau dekat rel kereta' },
      { test: /(?:tidak|gak|ga|ngga|enggak|jangan|anti|hindari|bukan)\s+(?:yang\s+)?panas|\bgerah\b|\bpengap\b|too hot|not hot/, label: 'Tidak mau panas' },
      { test: /(?:tidak\s+macet|bebas\s+macet|anti\s+macet|hindari\s+macet|sering\s+macet|macet\s+(?:banget|parah)|kemacetan)/, label: 'Tidak mau macet' },
    ];
    AVOID_ONLY.forEach(p => {
      if (p.skipIfWantsRamai && wantsRamai) return;
      if (p.test.test(lower) && !avoid.some(a => a.label === p.label)) {
        avoid.push({ label: p.label, reason: null });
      }
    });

    // ── Orientasi matahari — avoid + prefer reframe ──────────────────────────
    // Checked across BOTH sources: the customer may state this as a Q5 red-flag
    // answer ("tidak mau hadap matahari terbenam") — no Q12 ever needed — OR as a
    // genuine Q12 apartment tower/floor answer. Either way it belongs in Hindari.
    // Typo-tolerant: "terbena[mr]" catches the common "terbenam"/"terbenar" slip.
    const aptLower = String(apartmentPrefRawText || '').toLowerCase();
    const sunText = `${lower} ${aptLower}`;
    const AVOID_VERB = '(?:hindari|menghindari|tidak\\s+mau|gak?\\s+mau|nggak\\s+mau|enggak\\s+mau|jangan)';
    const avoidTerbit    = new RegExp(`${AVOID_VERB}\\b.{0,40}?(?:sinar\\s+)?(?:matahari\\s+)?terbit\\b`, 'i').test(sunText);
    const avoidTerbenam  = new RegExp(`${AVOID_VERB}\\b.{0,40}?(?:sinar\\s+)?(?:matahari\\s+)?terbena[mr]\\b`, 'i').test(sunText);
    if (avoidTerbit && avoidTerbenam) {
      avoid.push({ label: 'Lokasi kamar yang hadap sinar matahari terbenam dan terbit', reason: null });
      prefer.push({ label: 'Tempat yang nyaman dari sinar matahari yang membuat mata terasa silau' });
    } else if (avoidTerbenam) {
      avoid.push({ label: 'Hindari sinar matahari terbenam (hadap non-barat)', reason: null });
    } else if (avoidTerbit) {
      avoid.push({ label: 'Hindari sinar matahari terbit (hadap non-timur)', reason: null });
    }

    return { avoid, prefer };
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
   * Normalisasi jawaban patokan lokasi (Q6). Jika customer menjawab NEGATIF /
   * fleksibel ("enggak ada", "tidak ada", "bebas", "terserah", "gak ada patokan"),
   * tampilkan cukup "Bebas" (tanpa membubuhkan jawaban mentah customer — itu
   * hanya menduplikasi arti "tidak ada" dan bikin baris summary berantakan).
   * Selain kasus negatif, kembalikan jawaban apa adanya (kapital awal).
   */
  static #normalizeAnchorPoint(raw = '') {
    let s = String(raw).trim();
    if (!s) return 'UNKNOWN';
    const NEG = /^(?:eng?gak?|ngga|nggak|tidak|gak|ga|kagak|ndak|blm|belum|no|none|nope|bebas|terserah|fleksibel|flexible|free)\b|(?:ga|gak|tidak|enggak|belum|tanpa|no)\s+ada|tidak\s+ada\s+patokan|bebas\s+(?:aja|saja)?|terserah/i;
    if (NEG.test(s)) return 'Bebas';
    // Buang frasa INSTRUKSI ke AI ("tolong carikan", "carikan yang", "mohon cari") —
    // ini perintah customer ke bot, BUKAN bagian dari patokan lokasi itu sendiri.
    // Contoh: "dekat pakuwon, tolong carikan tempat yang dingin dan asri"
    //       → "dekat pakuwon, tempat yang dingin dan asri" (instruksi dibuang, sisanya dipertahankan).
    s = s.replace(/\b(?:tolong|mohon|bisa|boleh|coba)?\s*(?:carikan|cariin|cari(?:kan)?in?)\b\s*/gi, ' ')
         .replace(/\s{2,}/g, ' ')
         .replace(/^[,\s]+|[,\s]+$/g, '')
         .trim();
    if (!s) return 'UNKNOWN';
    return this.#capitalizeFirst(s);
  }

  /**
   * Normalisasi jawaban Q12 (preferensi tower/lantai/orientasi apartemen). Merangkum
   * jawaban customer jadi baris ringkas yang berguna untuk agent, dengan 2 komponen:
   *   (a) LANTAI  — "lantai antara 12-15" → "Lantai 12-15"; "lantai tinggi"/"rendah"/"tengah".
   *   (b) ORIENTASI — "hadap timur" → "Hadap timur"; deteksi hindari-matahari.
   *
   * Insight khusus: bila customer minta HINDARI sinar matahari TERBIT **dan** TERBENAM,
   * maksudnya unit tidak kena sinar langsung pagi & sore → customer ingin unit SEJUK.
   * Ini juga sinyal red-flag "hindari silau/panas" yang perlu agent ketahui.
   *
   * @param {string} raw — jawaban mentah customer
   * @returns {string} ringkasan rapi, atau '' bila tak ada info tower/lantai/orientasi
   */
  static #normalizeApartmentPref(raw = '') {
    const s = String(raw).trim();
    if (!s) return '';
    const lower = s.toLowerCase();
    const parts = [];

    // ── (a) LANTAI ──────────────────────────────────────────────────────────
    // Range angka: "lantai antara 12-15", "lantai 12 sampai 15", "lantai 12-15"
    const rangeM = lower.match(/lantai\s*(?:antara\s*)?(\d{1,3})\s*(?:-|–|s\/d|sampai|sd|hingga|ke)\s*(\d{1,3})/i);
    // Angka tunggal: "lantai 12", "di lantai 8"
    const singleM = lower.match(/lantai\s*(?:ke[-\s]?)?(\d{1,3})\b/i);
    // Kata kualitatif: tinggi / rendah / tengah / atas / bawah / dasar
    const qualM = lower.match(/lantai\s*(tinggi|rendah|tengah|atas|bawah|dasar|paling\s+atas|paling\s+bawah)|(high|low|mid)\s*floor/i);
    if (rangeM) {
      parts.push(`Lantai ${rangeM[1]}-${rangeM[2]}`);
    } else if (singleM) {
      parts.push(`Lantai ${singleM[1]}`);
    } else if (qualM) {
      const q = (qualM[1] || qualM[2] || '').toLowerCase();
      const map = { high: 'tinggi', low: 'rendah', mid: 'tengah' };
      parts.push(`Lantai ${this.#capitalizeFirst(map[q] || q)}`.replace('Lantai L', 'Lantai '));
    } else if (/\btower\s+([a-z0-9]+)\b/i.test(lower)) {
      const t = lower.match(/\btower\s+([a-z0-9]+)\b/i);
      parts.push(`Tower ${t[1].toUpperCase()}`);
    }

    // ── (b) ORIENTASI ───────────────────────────────────────────────────────
    const avoidSunrise  = /(?:hindari|menghindari|tidak\s+mau|gak?\s+mau|anti|bukan)\b.{0,40}?(?:sinar\s+)?(?:matahari\s+)?(?:terbit|pagi|sunrise|timur)/i.test(lower)
                          || /(?:matahari|sinar)\s+terbit/i.test(lower) && /(?:hindari|menghindari|tidak|gak?|jangan)/i.test(lower);
    const avoidSunset   = /(?:hindari|menghindari|tidak\s+mau|gak?\s+mau|anti|bukan)\b.{0,40}?(?:sinar\s+)?(?:matahari\s+)?(?:terbenam|sore|sunset|barat)/i.test(lower)
                          || /(?:matahari|sinar)\s+terbenam/i.test(lower) && /(?:hindari|menghindari|tidak|gak?|jangan)/i.test(lower);
    // Deteksi "menghindari ... terbit dan terbenam" bersama (satu klausa)
    const avoidBothClause = /(?:hindari|menghindari)\b.{0,50}?(?:terbit\s+(?:dan|&|,)?\s*terbenam|terbenam\s+(?:dan|&|,)?\s*terbit)/i.test(lower);

    if (avoidBothClause || (avoidSunrise && avoidSunset)) {
      parts.push('Hindari sinar matahari terbit & terbenam (ingin unit sejuk)');
    } else if (avoidSunrise) {
      parts.push('Hindari sinar matahari terbit (hadap non-timur)');
    } else if (avoidSunset) {
      parts.push('Hindari sinar matahari terbenam (hadap non-barat)');
    } else {
      // Orientasi eksplisit: "hadap timur/barat/utara/selatan", "east facing", "facing west"
      const faceM = lower.match(/(?:meng)?hadap\s+(timur|barat|utara|selatan|east|west|north|south)/i)
                    || lower.match(/(east|west|north|south)[\s-]*facing/i)
                    || lower.match(/facing\s+(east|west|north|south)/i);
      if (faceM) {
        const dir = faceM[1].toLowerCase();
        const map = { east: 'timur', west: 'barat', north: 'utara', south: 'selatan' };
        parts.push(`Hadap ${map[dir] || dir}`);
      }
    }

    // Fallback: tidak ada komponen terstruktur tapi ada teks → tampilkan mentah (kapital awal)
    if (!parts.length) return this.#capitalizeFirst(s);
    return parts.join(', ');
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

// Module-level cache for city names loaded from DB (populated once per process lifetime)
let _cityNamesCache = null;

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
   * Load city names from DB, cached for the lifetime of this process.
   * Returns lowercase city names for case-insensitive matching.
   */
  static async #loadCityNames() {
    if (_cityNamesCache) return _cityNamesCache;
    try {
      const rows = await City.findAll({ where: { status: 1 }, attributes: ['name'] });
      _cityNamesCache = rows.map(r => r.name.toLowerCase().trim());
      console.log(`[PrivateController] City cache loaded: ${_cityNamesCache.length} cities from DB`);
    } catch (err) {
      console.error('[PrivateController] Failed to load cities from DB:', err.message);
      _cityNamesCache = [];
    }
    return _cityNamesCache;
  }

  static async #normalizeLocation(location = '') {
    if (!location) return '';

    const text = String(location).toLowerCase().trim();
    const knownCities = await this.#loadCityNames();

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
        // Capitalize the city name from DB
        return city.charAt(0).toUpperCase() + city.slice(1);
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
        location = await this.#normalizeLocation(location);
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
      reply = builder.alternative({ alternatives: context.alternatives, rumah123Listings, filters: context.filters, standardFallback: context.standardFallback || null });
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
    session, history = [], userMessage = '', agentName = '', agentUserId = null,
    recommendationContext = null, externalError = null
  }) {
    const skillInfo = this.loadSkillInfo();
    const lang      = LanguageDetector.detect(userMessage, history);
    const builder   = new ResponseBuilderWhatsApp(lang, agentName);
    // Scoping katalog per-agent (Mode B). Fallback ke session.agentUserId bila
    // dipanggil tanpa argumen eksplisit (mis. dari whatsappAIService via session).
    const scopedUserId = agentUserId || session?.agentUserId || null;

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

      // Q8 (move-in/pindah) and Q14's check-in date are the SAME real-world date —
      // just asked with different wording (hotel/kondotel/villa booking phrases it
      // "check-in", generic sewa phrases it "masuk/pindah"). Q8 fires unconditionally
      // ("MANDATORY — never skipped"), so once the customer gives a concrete date
      // there ("2 minggu lagi" → resolved), Q14 must not ask check-in again for the
      // same info. Skip when the value is just the "Waiting the update" placeholder
      // (customer didn't actually give a date yet).
      if (profile.moveInDateValue && profile.moveInDateValue !== 'Waiting the update'
          && !profile.hasCheckInDate) {
        profile.hasCheckInDate   = true;
        profile.checkInDateValue = profile.moveInDateValue;
      }
    } catch (_e) { /* non-fatal — fall back to regex hasMoveInDate */ }

    // ── Skill "harga wajar" — pertanyaan terbuka kapan saja (sewa/booking/beli) ──
    // Tidak mereset atau melompati Q-flow: jawabannya di-PREPEND ke pertanyaan Q
    // berikutnya (atau ke summary/brief bila Q-flow sudah selesai) di titik-titik
    // return di bawah. null bila pesan ini bukan pertanyaan harga terbuka.
    const priceAnswerNote = ConversationQualifier.maybeAnswerReasonablePriceQuestion(userMessage, profile, lang);
    if (priceAnswerNote) console.log('[PrivateAgent/HargaWajar] Pertanyaan harga wajar terdeteksi — jawaban di-prepend.');

    // ── RALAT (koreksi budget / tanggal / jadwal viewing) — akui secara eksplisit ──
    // Nilai barunya sudah otomatis menang di state (overwrite di extractor); catatan
    // ini membuat AI terasa responsif: customer tahu ralatnya diterima.
    const correctionNote = ConversationQualifier.buildCorrectionAck(userMessage, lang);
    if (correctionNote) console.log('[PrivateAgent/Ralat] Koreksi terdeteksi — pengakuan di-prepend.');

    // Catatan yang di-prepend ke balasan berikutnya (ralat dulu, lalu harga wajar).
    const preNote = [correctionNote, priceAnswerNote].filter(Boolean).join('\n\n') || null;

    console.log('[PrivateAgent/Qualifier]', {
      tx       : profile.transactionType || '(unknown)',
      type     : profile.buildingType    || '(unknown)',
      location : profile.location        || '(unknown)',
      readiness: ConversationQualifier.readinessScore(profile),
      aiCount  : profile.aiCount,
    });

    // ── CHECK MODE: users.catalog_summary (per-agent) ────────────────────────
    // OFF (default) → Full Q1–Q12 flow → show structured brief only
    // ON            → Full Q1–Q12 flow → show summary brief + catalog listing
    // Sumber kebenaran kini kolom users.catalog_summary milik agent (diubah agent
    // via chat "matikan/nyalakan summary"); env RESPOND_CATALOG_RUN tinggal fallback
    // saat kolom NULL / agent tidak dikenal.
    const { resolveCatalogMode } = require('../services/catalogModeService');
    const showCatalogDirect = (await resolveCatalogMode(scopedUserId)) === 'ON';

    // ── Shared: fetch price anchors for Q3 (needed in both modes) ────────────
    // Only fetch when BOTH location AND type are known — avoids a heavy DB query
    // on every early Q-flow message. getDbProperties() is now cached (5-min TTL)
    // so repeated calls after the first cache-warm are cheap.
    let priceAnchors = null;
    if (filters.location && filters.buildingType) {
      try {
        // Scope ke listing agent ini agar anchor harga Q3 mencerminkan inventori
        // agent yang bersangkutan (bukan katalog global).
        const catalogProps = await searchProperties({ ...filters, userId: scopedUserId });
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
          const qText = preNote ? `${preNote}\n\n${pilotQ}` : pilotQ;
          return this.#wrap(builder.qualificationQuestion(qText), {
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
        const qText = preNote ? `${preNote}\n\n${nextQuestion}` : nextQuestion;
        return this.#wrap(builder.qualificationQuestion(qText), {
          skillInfo, filters, qualificationMode: true, summaryMode: true,
        });
      }

      // ── Q_NAME/Q_EMAIL — identitas customer SEBELUM summary (tanya SEKALI) ──
      // Nama: wajib utk registrasi customer. Tidak ditanya bila customer sudah
      // memperkenalkan diri ("Hi saya Rina...") — extractIdentityFromChat mendeteksinya.
      // Email: hanya bila jadwal viewing sudah ada (untuk undangan kalender).
      // Masing-masing maksimal SEKALI — customer tidak menjawab → summary tetap lanjut.
      {
        const idQ = ConversationQualifier.buildIdentityQuestion(history, userMessage, profile, lang);
        if (idQ) {
          const qText = preNote ? `${preNote}\n\n${idQ}` : idQ;
          return this.#wrap(builder.qualificationQuestion(qText), {
            skillInfo, filters, qualificationMode: true, summaryMode: true,
          });
        }
      }

      // All Q1–Q12 answered → generate structured brief
      console.log('[PrivateAgent/SummaryMode] ✅ All Q answered → generating agent brief');
      const brief = ConversationQualifier.buildAgentBrief(profile, filters, history, userMessage);
      const briefText = builder.agentBrief(brief);
      const reply = preNote ? `${preNote}\n\n${briefText}` : briefText;

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
    //  Ask full Q1–Q12 (same depth as summary mode), then show summary + catalog.
    // ════════════════════════════════════════════════════════════════════════

    // ── Full Q flow — same question depth as summary mode ────────────────────
    const nextQuestion = ConversationQualifier.getNextQuestion(
      profile, lang, priceAnchors, 'summary'
    );
    if (nextQuestion) {
      console.log(`[PrivateAgent/CatalogMode] Asking Q (aiCount=${profile.aiCount})`);
      const qText = preNote ? `${preNote}\n\n${nextQuestion}` : nextQuestion;
      return this.#wrap(builder.qualificationQuestion(qText), {
        skillInfo, filters, qualificationMode: true,
      });
    }

    // ── Q_NAME/Q_EMAIL — identitas customer SEBELUM summary (tanya SEKALI) ──
    {
      const idQ = ConversationQualifier.buildIdentityQuestion(history, userMessage, profile, lang);
      if (idQ) {
        const qText = preNote ? `${preNote}\n\n${idQ}` : idQ;
        return this.#wrap(builder.qualificationQuestion(qText), {
          skillInfo, filters, qualificationMode: true,
        });
      }
    }

    // All Q answered → build summary brief + fetch listings in parallel
    const brief = ConversationQualifier.buildAgentBrief(profile, filters, history, userMessage);

    // ── Fetch listings (Rumah123 + catalog) ──────────────────────────────────
    // Katalog DB di-scope ke listing milik agent ini (scopedUserId) supaya
    // rekomendasi RESPOND_CATALOG_RUN=ON konsisten dengan query per-agent.
    const [rumah123Listings, context] = await Promise.all([
      this.fetchRumah123Listings(filters, session?.location),
      recommendationContext
        ? Promise.resolve(recommendationContext)
        : buildRecommendationContextForLLM(userMessage, history, { userId: scopedUserId }),
    ]);

    const catalogMatches = this.resolveCatalogMatches(context);

    let catalogReply;
    if (rumah123Listings.length > 0 || catalogMatches.length > 0) {
      catalogReply = builder.exactMatch({ rumah123Listings, catalogMatches, filters: context.filters });
    } else {
      catalogReply = builder.alternative({
        alternatives : context.alternatives,
        rumah123Listings,
        filters      : context.filters,
        budgetExpanded: context.budgetExpanded || null,
        standardFallback: context.standardFallback || null,
      });
    }

    // ── Combine: summary brief (body only) + catalog ─────────────────────────
    const summaryFull = builder.agentBrief(brief);
    const sigMarker   = lang === 'id' ? '\n\nSalam hangat,' : '\n\nWarm regards,';
    const briefBody   = summaryFull.includes(sigMarker)
      ? summaryFull.substring(0, summaryFull.lastIndexOf(sigMarker))
      : summaryFull;
    const reply = (preNote ? `${preNote}\n\n` : '') + briefBody + '\n\n---\n\n' + catalogReply;

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
      // One WhatsApp message per numbered catalog card (summary/lead-in as the
      // first part). Falls back to [reply] unsplit when no card is present —
      // e.g. the "no catalog match" apology, which stays combined with the
      // summary as a single message.
      replyParts:   meta.replyParts || splitCatalogReply(reply),
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

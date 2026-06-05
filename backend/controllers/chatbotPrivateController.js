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
        searchProperties }                    = require('../services/propertyRecommendationService');
const { getRumah123Listings,
        mapBuildingTypeToApify,
        mapTransactionTypeToApify }           = require('../services/rumah123ContextService');
const { loadResponseSkillPrompt,
        getSkillRegistryStatus }              = require('../services/skillPromptService');
const { hasPropertyKeyword }                  = require('../utils/propertyKeywordFilter');

// ─── LanguageDetector ─────────────────────────────────────────────────────────

class LanguageDetector {
  /** Keywords that indicate an Indonesian-language message */
  static #INDONESIAN_WORDS = [
    'saya', 'mau', 'ingin', 'cari', 'sewa', 'beli', 'jual', 'rumah', 'villa',
    'vila', 'apartemen', 'hotel', 'kos', 'kost', 'ruko', 'kantor', 'gudang',
    'harga', 'berapa', 'di ', 'ada', 'tolong', 'rekomendasi', 'saran',
    'fasilitas', 'budget', 'badget', 'tanah', 'properti',
  ];

  /** Keywords for clearly off-topic subjects (non-property domains) */
  static #OFF_TOPIC_WORDS = [
    'kuliner', 'makanan', 'masakan', 'minuman', 'bebek', 'ayam goreng',
    'restaurant', 'restoran', 'cafe', 'kafe', 'kopi', 'cuaca', 'weather',
    'wisata', 'tourism', 'tourist', 'olahraga', 'sports', 'politik',
    'politics', 'pendidikan', 'education', 'sekolah', 'universitas',
    'crypto', 'saham', 'stock', 'film', 'movie', 'musik', 'music',
  ];

  /** Keywords that anchor a message to the property domain */
  static #PROPERTY_WORDS = [
    'property', 'properti', 'rumah', 'house', 'home', 'villa', 'vila', 'hotel',
    'apartment', 'apartemen', 'kos', 'kost', 'boarding', 'ruko', 'shophouse',
    'office', 'kantor', 'warehouse', 'gudang', 'sewa', 'rent', 'rental',
    'beli', 'buy', 'purchase', 'jual', 'sale', 'sell', 'kontrak', 'kontrakan',
    'tanah', 'land', 'investasi',
  ];

  /**
   * Lowercase + trim a string for keyword matching.
   */
  static #normalize(text = '') {
    return String(text || '').toLowerCase().trim();
  }

  /**
   * Detect the reply language from the user's latest message.
   * Returns 'id' for Indonesian, 'en' otherwise.
   *
   * @param {string} message
   * @returns {'id'|'en'}
   */
  static detect(message = '') {
    const text = this.#normalize(message);
    return this.#INDONESIAN_WORDS.some(word => text.includes(word)) ? 'id' : 'en';
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
  static hasPropertyIntent(message = '', filters = {}) {
    // Check 1: Extracted filters dari recommendation service
    if (filters.transactionType || filters.buildingType || filters.location || filters.budget) {
      return true;
    }

    // Check 2: Advanced keyword filter (propertyKeywordFilter.js)
    //          Deteksi: (Tipe Properti + Aksi) ATAU Kata Kunci Mandiri
    if (hasPropertyKeyword(message)) {
      return true;
    }

    // Check 3: Fallback ke regex untuk backward compatibility
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
      boarding_house: lang === 'id' ? 'Kos / Boarding House': 'Boarding House',
      shophouse:      lang === 'id' ? 'Ruko / Shophouse'    : 'Shophouse',
      office:         lang === 'id' ? 'Kantor'              : 'Office',
      warehouse:      lang === 'id' ? 'Gudang'              : 'Warehouse',
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
      ? 'Boleh saya pastikan, Anda mencari properti untuk **sewa**, **beli**, atau **jual**? Silakan sebutkan juga lokasi dan budget agar saya bisa mencarikan pilihan terbaik dari Rumah123 dan katalog kami.'
      : 'May I confirm whether you are looking to **rent**, **buy**, or **sell** a property? You can also mention the location and budget so I can find the best options from Rumah123 and our catalog.';
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
        ? (isId ? '\n---\n**Pilihan Lain dari Katalog Kami:**\n' : '\n---\n**More Options from Our Catalog:**\n')
        : (isId ? `Berikut pilihan **${summary}** dari katalog properti kami:\n` : `Here are matching **${summary}** options from our catalog:\n`)
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
        : `Sorry, there is currently no property matching **${summary}**${locationNote} in our catalog or Rumah123. Would you like to try another location, property type, or price range?`;
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
        lines.push(isId ? '\n---\n**Alternatif dari Katalog Kami:**\n' : '\n---\n**Alternatives from Our Catalog:**\n');
      } else {
        lines.push(isId
          ? `Namun berikut pilihan alternatif dari katalog kami untuk **${summary}**:\n`
          : `Here are some alternative options from our catalog for **${summary}**:\n`
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
// Format khusus untuk WhatsApp terminal message (Fonnte, WATI, 360dialog)
// Dengan property images, agent name, dan bolder formatting untuk readability

class ResponseBuilderWhatsApp {
  /** @type {'id'|'en'} */
  #lang;
  /** @type {string} */
  #agentName;

  constructor(lang = 'en', agentName = 'Elevan Property') {
    this.#lang      = lang;
    this.#agentName = agentName;
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
      ? 'Boleh saya pastikan, Anda mencari properti untuk *sewa*, *beli*, atau *jual*? Silakan sebutkan juga lokasi dan budget agar saya bisa mencarikan pilihan terbaik dari Rumah123 dan katalog kami.'
      : 'May I confirm whether you are looking to *rent*, *buy*, or *sell* a property? You can also mention the location and budget so I can find the best options from Rumah123 and our catalog.';
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
      ? `\n\nKami siap membantu Anda menemukan rumah, villa, apartemen, atau properti lainnya yang cocok untuk Anda.\nApakah ada yang ingin Anda tanyakan lebih lanjut?\n\n\nSalam hangat,\n*${this.#agentName}*\n*Elevan Property*`
      : `\n\nWe are ready to help you find a house, villa, apartment, or other property that suits you.\nWould you like to know more details?\n\n\nWarm regards,\n*${this.#agentName}*\n*Elevan Property*`;
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
        ? `Berikut pilihan *${summary}* dari katalog properti kami:\n`
        : `Here are matching *${summary}* options from our catalog:\n`
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
        : `Sorry, there is currently no${typeNote} available${locNote} in our catalog or Rumah123.\n\nWould you like to try a different location or price range?`
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
        lines.push(isId ? '\n---\n*Pilihan Lain dari Katalog:*\n' : '\n---\n*More from Our Catalog:*\n');
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
            ? `Berikut pilihan *${summary}* yang tersedia dari katalog kami:\n`
            : `Here are available *${summary}* options from our catalog:\n`;
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
    const isId = this.#lang === 'id';
    const signature = isId
      ? `\n\nSalam hangat,\n*${this.#agentName}*\n*Elevan Property*`
      : `\n\nWarm regards,\n*${this.#agentName}*\n*Elevan Property*`;
    return question + signature;
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
    return history.filter(h => h.role === 'ai').map(h => h.message || '').join(' ').toLowerCase();
  }

  static #customerText(history, userMessage) {
    return [
      ...history.filter(h => h.role !== 'ai').map(h => h.message || ''),
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
    const custText = this.#customerText(history, userMessage);
    const aiText   = this.#aiText(history);
    const aiCount  = history.filter(h => h.role === 'ai').length;

    return {
      /* ── Core filters (from propertyRecommendationService) ── */
      transactionType : filters.transactionType || '',   // 'rent'|'sale'|''
      buildingType    : filters.buildingType    || '',   // 'house'|'apartment'|...
      location        : filters.location        || '',   // 'malang'|'surabaya'|...
      budget          : filters.budget          || null, // { min, max, text } | null

      /* ── Derived from customer messages ── */
      hasFurnishing: this.#has(custText, [
        'furnished', 'semi-furnished', 'semifurnished', 'unfurnished',
        'kosongan', 'full furnish', 'sudah ada furnitur', 'mau yang kosong',
        'perabot', 'furniture', 'furnish',
      ]),
      hasMoveInDate: this.#has(custText, [
        'januari', 'februari', 'maret', 'april', 'mei', 'juni',
        'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
        'january', 'february', 'march', 'may', 'june', 'july', 'august',
        'october', 'november', 'december',
        'bulan ini', 'bulan depan', 'next month', 'this month',
        'segera', 'soon', 'asap', 'secepatnya', 'besok', 'minggu ini',
        'this week', 'next week', 'langsung masuk', 'immediate',
        'sudah mau', 'ingin segera', 'ready to move',
      ]),
      hasHouseholdInfo: this.#has(custText, [
        'keluarga', 'suami', 'istri', 'anak', 'orang tua',
        'sendiri', 'pasangan', 'berdua', 'bertiga', 'berempat',
        'family', 'wife', 'husband', 'children', 'parents', 'alone', 'partner',
        'couple', '2 orang', '3 orang', '4 orang', 'anak-anak', 'ortu',
      ]),
      hasSearchHistory: this.#has(custText, [
        'sudah lihat', 'pernah lihat', 'sudah survey', 'sudah cari',
        'belum cocok', 'tidak cocok', 'kurang cocok', 'sudah', 'pernah',
        'have seen', 'already visited', 'viewed', "haven't found", 'not a match',
      ]),
      hasRedFlags: this.#has(custText, [
        'tidak mau', 'jangan', 'avoid', 'tidak suka', 'kurang suka',
        'hadap barat', 'west facing', 'bising', 'noisy', 'gang sempit',
        'banjir', 'jauh', 'lorong', 'tua banget',
      ]),
      hasAlternativeArea: this.#has(custText, [
        'atau', 'or', 'sekitar', 'nearby', 'area lain', 'wilayah lain',
        'bisa juga', 'bisa di', 'juga oke', 'juga boleh', 'sekitarnya',
      ]),

      /* ── AI conversation state (what AI already asked) ── */
      aiCount,
      aiAskedTxType     : this.#has(aiText, ['sewa atau beli', 'rent or buy', 'beli atau sewa', 'buy or rent']),
      aiAskedPropType   : this.#has(aiText, ['tipe properti', 'property type', 'jenis properti', 'rumah, apartemen']),
      aiAskedLocation   : this.#has(aiText, ['daerah', 'kota mana', 'which area', 'which city', 'lokasi mana']),
      aiAskedSearchHist : this.#has(aiText, ['sudah lihat berapa', 'how many properties', 'belum cocok', 'sudah survey']),
      aiAskedBudget     : this.#has(aiText, ['kisaran', 'anggaran', 'budget', 'harga yang', 'price range']),
      aiAskedMoveIn     : this.#has(aiText, ['masuk bulan', 'pindah bulan', 'rencananya masuk', 'move in', 'moving']),
      aiAskedHousehold  : this.#has(aiText, ['tinggal bersama', 'akan tinggal', 'living with', 'who will be']),
      aiAskedFurnish    : this.#has(aiText, ['furnished', 'furnitur', 'furnishing', 'semi-furnished']),
    };
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
  static getNextQuestion(profile, lang = 'id', priceAnchors = null) {
    const isId = lang === 'id';
    const tx   = profile.transactionType;  // 'rent' | 'sale' | ''
    const type = profile.buildingType;     // 'house' | 'apartment' | ...
    const loc  = profile.location;

    const txLabel   = tx === 'rent' ? (isId ? 'sewa'  : 'rent')  : (isId ? 'beli'  : 'buy');
    const txLabelPP = tx === 'rent' ? (isId ? 'sewa'  : 'rent')  : (isId ? 'dibeli': 'buy');
    const typeLabel = type ? PropertyFormatter.humanBuildingType(type, lang) : null;

    /* ── Q0/Q1 combined: both transaction type AND property type unknown ── */
    if (!tx && !type) {
      return isId
        ? `Halo! 😊 Saya siap bantu carikan properti yang cocok untuk Anda.\n\nBoleh saya tanya dulu — Anda sedang cari untuk *sewa* atau *beli*? Dan tipe properti apa yang diinginkan?\n\nKami punya: *rumah, apartemen, villa, kos-kosan, ruko, kantor, gudang*, dan banyak lagi 🏡`
        : `Hello! 😊 I'm here to help you find the right property.\n\nMay I ask first — are you looking to *rent* or *buy*? And what type of property do you have in mind?\n\nWe have: *house, apartment, villa, boarding house, shophouse, office, warehouse*, and more 🏡`;
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
        ? `Oke, mau *${txLabel}* properti. Tipe apa yang Anda cari? 🏡\n\nKami punya: *rumah, apartemen, villa, kos-kosan, ruko, kantor, gudang*, dan banyak pilihan lainnya.`
        : `Got it, looking to *${txLabel}* a property. What type are you looking for? 🏡\n\nWe have: *house, apartment, villa, boarding house, shophouse, office, warehouse*, and many more.`;
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
    if (!profile.hasSearchHistory && !profile.aiAskedSearchHist && profile.aiCount <= 3 && loc) {
      return isId
        ? `Sudah lihat berapa properti di *${loc}*? Apa yang membuat belum cocok dari yang sudah dilihat?`
        : `How many properties have you seen in *${loc}*? What hasn't quite worked about the ones you've viewed?`;
    }

    /* ── Q3: budget via two price anchors (NEVER a direct ask) ── */
    if (!profile.budget && !profile.aiAskedBudget && loc) {
      if (priceAnchors) {
        return isId
          ? `Di *${loc}* kami ada yang di kisaran *${priceAnchors.low}* dan ada yang *${priceAnchors.high}*. Kira-kira yang mana lebih sesuai dengan rencana Anda?`
          : `In *${loc}* we have options around *${priceAnchors.low}* and others around *${priceAnchors.high}*. Which range feels closer to your plans?`;
      }
      return isId
        ? `Di *${loc}* kami punya pilihan dengan berbagai kisaran harga. Apakah Anda lebih prefer yang *terjangkau/ekonomis* atau yang *menengah ke atas*? 💰`
        : `In *${loc}* we have options across different price ranges. Do you prefer something more *affordable/economy* or *mid-to-premium range*? 💰`;
    }

    /* ── Q8: move-in date (MANDATORY — never skipped) ── */
    if (!profile.hasMoveInDate && !profile.aiAskedMoveIn) {
      return isId
        ? `Rencananya masuk atau pindah bulan apa? 📅`
        : `What month are you planning to move in? 📅`;
    }

    /* ── Q4: household composition (infers bedrooms, reveals decision maker) ── */
    if (!profile.hasHouseholdInfo && !profile.aiAskedHousehold) {
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

    /* ── All key questions asked → ready to show listings ── */
    return null;
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
    const lang      = LanguageDetector.detect(userMessage);
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
   * Generate response untuk WhatsApp terminal message (Fonnte, WATI, 360dialog).
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
   * Generate response untuk WhatsApp terminal message (Fonnte, WATI, 360dialog).
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
    const lang      = LanguageDetector.detect(userMessage);
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

    // ── Resolve filters dari context atau extract baru ───────────────────────
    const filters = recommendationContext?.filters
      || extractPropertyFilters(userMessage, history);

    // ── Build customer profile dari seluruh percakapan ───────────────────────
    const profile = ConversationQualifier.buildProfile(history, userMessage, filters);

    console.log('[PrivateAgent/Qualifier]', {
      tx       : profile.transactionType || '(unknown)',
      type     : profile.buildingType    || '(unknown)',
      location : profile.location        || '(unknown)',
      readiness: ConversationQualifier.readinessScore(profile),
      aiCount  : profile.aiCount,
    });

    // ── Decision: langsung tampil listing atau tanya dulu? ───────────────────
    //
    //   a) Customer eksplisit minta list → listing
    //   b) AI sudah tanya 4+ kali        → listing (hindari frustrasi)
    //   c) readiness >= 3 (tx+type+loc)  → listing
    //   d) Semua else                     → qualification question
    const wantsListing  = ConversationQualifier.wantsListingNow(userMessage);
    const readiness     = ConversationQualifier.readinessScore(profile);
    const shouldList    = wantsListing || profile.aiCount >= 4 || readiness >= 3;

    if (!shouldList) {
      // ── QUALIFICATION FLOW ─────────────────────────────────────────────────
      // Coba dapatkan price anchors dari catalog lokal (cepat, tanpa Rumah123)
      let priceAnchors = null;

      if (filters.location || filters.buildingType) {
        try {
          const catalogProps = await searchProperties(filters);
          const withPrice    = catalogProps.filter(p => p.price && p.price !== '-');

          if (withPrice.length >= 2) {
            // Sort sederhana berdasarkan teks harga (untuk ambil low/high sample)
            const sorted = [...withPrice].sort((a, b) => {
              const pa = this.#roughPrice(a.price);
              const pb = this.#roughPrice(b.price);
              return pa - pb;
            });

            priceAnchors = {
              low : sorted[0].price,
              high: sorted[sorted.length - 1].price,
            };
          }
        } catch (_err) {
          // Non-fatal — lanjut tanpa price anchors
        }
      }

      const nextQuestion = ConversationQualifier.getNextQuestion(profile, lang, priceAnchors);

      if (nextQuestion) {
        const reply = builder.qualificationQuestion(nextQuestion);
        console.log(`[PrivateAgent/Qualifier] Asking Q (aiCount=${profile.aiCount})`);
        return this.#wrap(reply, { skillInfo, filters, qualificationMode: true });
      }
      // nextQuestion = null berarti semua pertanyaan sudah terjawab → lanjut ke listing
    }

    // ── LISTING FLOW ──────────────────────────────────────────────────────────
    // Fetch Rumah123 + catalog context secara paralel (speed optimization)
    const [rumah123Listings, context] = await Promise.all([
      this.fetchRumah123Listings(filters, session?.location),
      recommendationContext
        ? Promise.resolve(recommendationContext)
        : buildRecommendationContextForLLM(userMessage, history),
    ]);

    const catalogMatches = this.resolveCatalogMatches(context);

    // Pilih strategi reply
    let reply;
    if (rumah123Listings.length > 0 || catalogMatches.length > 0) {
      reply = builder.exactMatch({ rumah123Listings, catalogMatches, filters: context.filters });
    } else {
      reply = builder.alternative({
        alternatives    : context.alternatives,
        rumah123Listings,
        filters         : context.filters,
        budgetExpanded  : context.budgetExpanded || null,
      });
    }

    // ── Q8 mandatory follow-up (jika move-in date belum pernah ditanyakan) ───
    // Sisipkan sebelum tanda tangan agent agar tidak terlewat.
    if (!profile.hasMoveInDate && !profile.aiAskedMoveIn) {
      const moveInQ = lang === 'id'
        ? '\n\nOmong-omong, rencananya masuk atau pindah bulan apa? 📅'
        : '\n\nBy the way, what month are you planning to move in? 📅';
      // Sisipkan sebelum "Salam hangat" / "Warm regards"
      const insertBefore = lang === 'id' ? '\n\nSalam hangat,' : '\n\nWarm regards,';
      if (reply.includes(insertBefore)) {
        reply = reply.replace(insertBefore, moveInQ + insertBefore);
      } else {
        reply += moveInQ;
      }
    }

    return this.#wrap(reply, {
      skillInfo,
      filters          : context.filters,
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
  static generateContactFormReply({ name = '', phone = '', subject = '', message = '' } = {}) {
    const firstName   = (name || '').split(' ')[0] || name || 'Bapak/Ibu';
    const combinedMsg = `${subject} ${message}`.toLowerCase();
    const lang        = LanguageDetector.detect(combinedMsg);
    const isId        = lang === 'id';

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
      else if (isBuy)  followUp = `Agar kami bisa memberikan pilihan terbaik, boleh saya tahu *kisaran anggaran* yang Bapak/Ibu siapkan, dan apakah ada preferensi lokasi atau tipe properti tertentu?`;
      else if (isSell) followUp = `Untuk membantu proses pemasaran properti Bapak/Ibu, boleh kami ketahui *lokasi dan tipe properti* yang ingin dijualkan, beserta harga yang diharapkan?`;
      else             followUp = `Agar kami dapat memberikan informasi yang paling sesuai, boleh saya tahu lebih lanjut mengenai *kebutuhan atau preferensi properti* Bapak/Ibu?`;
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
      const greeting   = `Halo *${firstName}*, terima kasih telah menghubungi *Elevan Property*! 🏡`;
      const ack        = subject
        ? `Kami sudah menerima pesan Anda mengenai *"${subject}"* dan dengan senang hati akan membantu Anda menemukan ${propType} yang paling sesuai dengan kebutuhan Anda.`
        : `Kami sudah menerima pesan Anda dan dengan senang hati akan membantu Anda menemukan ${propType} yang paling sesuai dengan kebutuhan Anda.`;
      const value      = `Tim konsultan properti kami siap mendampingi Bapak/Ibu mulai dari pencarian hingga proses penyelesaian transaksi dengan nyaman dan profesional.`;
      const signOff    = `Silakan lanjutkan percakapan ini kapan saja — kami siap membantu!\n\nSalam hangat,\n*Elvan*\n*Elevan Property* 🌟`;
      reply = [greeting, ack, value, followUp, signOff].join('\n\n');
    } else {
      const greeting   = `Hello *${firstName}*, thank you for reaching out to *Elevan Property*! 🏡`;
      const ack        = subject
        ? `We've received your inquiry regarding *"${subject}"* and we'd be delighted to help you find the perfect ${propType} that fits your needs.`
        : `We've received your message and we'd be delighted to help you find the right ${propType} for your needs.`;
      const value      = `Our dedicated property consultants are here to guide you every step of the way — from property search to a smooth, stress-free transaction.`;
      const signOff    = `Feel free to continue this conversation anytime — we're always here to help!\n\nWarm regards,\n*Elvan*\n*Elevan Property* 🌟`;
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
    return res.status(400).json({ success: false, message: validation.message });
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
    return res.status(500).json({
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
    return res.status(500).json({
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
 * Generate private WhatsApp reply (used by watiChatController as fallback)
 * Simplified version for WhatsApp with agent name
 */
module.exports.generatePrivateWhatsappReply = (payload) => {
  const { name, phone, message, agentName = 'Property Consultant' } = payload;
  const appName = process.env.APP_NAME || 'Elevan Property';

  const isIndonesian = String(message || '').toLowerCase().includes('saya') ||
                      String(message || '').toLowerCase().includes('mau') ||
                      String(message || '').toLowerCase().includes('cari');

  if (isIndonesian) {
    const reply = `Halo ${name}, terima kasih telah menghubungi kami! 🏠

Pesan Anda sudah kami terima. ${agentName} dari ${appName} akan segera membalas dengan informasi properti yang sesuai dengan kebutuhan Anda.

Kami siap membantu Anda menemukan rumah, villa, apartemen, atau properti lainnya yang sempurna.

Salam hangat,
*${agentName}*
*${appName}*`;

    return { reply };
  } else {
    const reply = `Hello ${name}, thank you for reaching out! 🏠

We've received your message. ${agentName} from ${appName} will get back to you shortly with property information tailored to your needs.

We're here to help you find the perfect house, villa, apartment, or property.

Warm regards,
*${agentName}*
*${appName}*`;

    return { reply };
  }
};

module.exports.loadPrivateChatbotSkillInfo     = ()        => ChatbotPrivateService.loadSkillInfo();

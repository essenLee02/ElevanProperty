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
        getVisibleMatchesFromAlternatives }   = require('../services/propertyRecommendationService');
const { getRumah123Listings,
        mapBuildingTypeToApify,
        mapTransactionTypeToApify }           = require('../services/rumah123ContextService');
const { loadResponseSkillPrompt,
        getSkillRegistryStatus }              = require('../services/skillPromptService');

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
   *
   * @param {string} message
   * @param {object} filters  - Extracted filters from propertyRecommendationService
   * @returns {boolean}
   */
  static hasPropertyIntent(message = '', filters = {}) {
    return Boolean(
      filters.transactionType ||
      filters.buildingType    ||
      filters.location        ||
      filters.budget          ||
      /saran|rekomendasi|recommend|pilihan|opsi|cari|mau|ingin|butuh|need|find|ada apa|apa saja/i.test(message)
    );
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
  static async generateResponse({ session, history = [], userMessage = '', recommendationContext = null, externalError = null }) {
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
      catalogPath:     'frontend/public/json_data/indonesia_property_36_provinces_flat.json',
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

module.exports.generatePrivateChatbotResponse = (params) => ChatbotPrivateService.generateResponse(params);
module.exports.loadPrivateChatbotSkillInfo     = ()       => ChatbotPrivateService.loadSkillInfo();

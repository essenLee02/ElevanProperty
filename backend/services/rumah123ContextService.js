/**
 * rumah123ContextService.js
 *
 * Fetches and caches live property listings from Rumah123.com via Apify
 * for injection into the AI chatbot context.
 *
 * Architecture: single class Rumah123ContextService with all logic as static methods.
 *
 * Caching strategy:
 * - In-memory Map keyed by (location|propertyType|listingType)
 * - TTL: 30 minutes per cache entry
 * - Background fetch: first request triggers an async Apify run,
 *   waits up to 3 seconds for the first result, then returns immediately.
 *   Subsequent requests within TTL are served from cache with zero latency.
 *
 * Module exports maintain the same function names as before for backward compatibility.
 */

const { ApifyClient } = require('apify-client');

// ─── Rumah123ContextService ───────────────────────────────────────────────────

class Rumah123ContextService {
  // ── Configuration ─────────────────────────────────────────────────────────

  static #ACTOR_ID        = 'fatihtahta/rumah123-scraper';
  static #CACHE_TTL_MS    = 30 * 60 * 1000;  // 30 minutes
  static #FETCH_TIMEOUT   = 120 * 1000;       // 2 minutes — max wait per Apify run
  static #MAX_LISTINGS    = 20;               // cap returned per cache key
  static #FIRST_WAIT_MS   = 3000;             // wait time before returning empty on first fetch

  /**
   * In-memory cache.
   * Shape per entry: { items: object[], fetchedAt: number, fetching: boolean }
   */
  static #cache = new Map();

  // ── Cache Helpers ─────────────────────────────────────────────────────────

  /**
   * Build a deterministic string cache key from the three search dimensions.
   * All values are lowercased and joined with '|'.
   */
  static #makeKey(location, propertyType, listingType) {
    return [
      (location    || 'all').toLowerCase(),
      (propertyType|| 'all').toLowerCase(),
      (listingType || 'sale').toLowerCase(),
    ].join('|');
  }

  /**
   * Return true when a cache entry exists and is still within the TTL window.
   */
  static #isValid(entry) {
    return Boolean(entry) && (Date.now() - entry.fetchedAt) < this.#CACHE_TTL_MS;
  }

  // ── Apify Client ──────────────────────────────────────────────────────────

  /**
   * Create and return an ApifyClient using the environment token.
   * Returns null when the token is absent or is still the placeholder value.
   */
  static #createClient() {
    const token = process.env.APIFY_API_TOKEN;
    if (!token || token === 'isi_apify_token_anda') return null;
    return new ApifyClient({ token });
  }

  // ── Data Transformer ──────────────────────────────────────────────────────

  /**
   * Transform a raw Apify listing into a lean, chatbot-friendly object.
   * Converts array facilities to a comma-separated string for easier formatting.
   *
   * @param {object} item - Raw listing from Apify dataset
   * @returns {object}    Normalised listing
   */
  static #transform(item) {
    return {
      id:            item.id            || '',
      title:         item.title         || '',
      url:           item.url           || '',        // direct Rumah123 listing URL
      price:         item.price         || '',
      priceNumeric:  item.priceNumeric  || 0,
      currency:      item.currency      || 'IDR',
      propertyType:  item.propertyType  || '',
      listingType:   item.listingType   || '',
      location:      item.location      || '',
      city:          item.city          || '',
      district:      item.district      || '',
      province:      item.province      || '',
      bedrooms:      item.bedrooms      || 0,
      bathrooms:     item.bathrooms     || 0,
      landSize:      item.landSize      || 0,
      buildingSize:  item.buildingSize  || 0,
      furnishing:    item.furnishing    || '',
      condition:     item.condition     || '',
      certificate:   item.certificate   || '',
      facilities:    Array.isArray(item.facilities)
                       ? item.facilities.join(', ')
                       : (item.facilities || ''),
      mediaUrls:     item.mediaUrls     || [],
      agentName:     item.agentName     || '',
      agentPhone:    item.agentPhone    || '',
      agentWhatsapp: item.agentWhatsapp || '',
      agencyName:    item.agencyName    || '',
      publishedAt:   item.publishedAt   || '',
    };
  }

  // ── Apify Fetch ───────────────────────────────────────────────────────────

  /**
   * Run the Rumah123 actor on Apify and return transformed listings.
   * Enforces a 2-minute timeout to protect server response times.
   * Returns an empty array on any error (non-fatal — caller handles gracefully).
   *
   * @param {string} location      City/area search term
   * @param {string} propertyType  Apify property type string (e.g. "house")
   * @param {string} listingType   "sale" | "rent"
   * @returns {Promise<object[]>}  Transformed listings (max #MAX_LISTINGS)
   */
  static async #fetchFromApify(location, propertyType, listingType) {
    const client = this.#createClient();
    if (!client) {
      console.warn('[Rumah123Context] APIFY_API_TOKEN not configured — skipping live fetch.');
      return [];
    }

    const input = {
      listingType:           listingType   || 'sale',
      sortOrder:             'recommended',
      promotions:            [],
      'property-type':       propertyType  ? [propertyType] : [],
      furninshing_condition: [],
      property_facilities:   [],
      limit:                 this.#MAX_LISTINGS,
    };
    if (location) input.location = location;

    console.log(`[Rumah123Context] Fetching from Apify: location="${location}", type="${propertyType || 'any'}", listing="${listingType}"`);
    console.log(`[Rumah123Context] Apify input:`, JSON.stringify(input, null, 2));

    try {
      const startTime = Date.now();
      const run = await Promise.race([
        client.actor(this.#ACTOR_ID).call(input),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Apify fetch timeout')), this.#FETCH_TIMEOUT)
        ),
      ]);

      const fetchTime = Date.now() - startTime;
      console.log(`[Rumah123Context] Apify run completed in ${fetchTime}ms, runId="${run.id}", datasetId="${run.defaultDatasetId}"`);

      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      console.log(`[Rumah123Context] ✓ Apify returned ${items.length} listings for location="${location}"`);

      if (items.length === 0) {
        console.warn(`[Rumah123Context] ⚠️  No listings found on Apify for location="${location}". This may indicate: 1) Location not recognized by Rumah123, 2) No properties available at this location, 3) Cache issue.`);
      }

      return items.slice(0, this.#MAX_LISTINGS).map(item => this.#transform(item));
    } catch (err) {
      console.error('[Rumah123Context] ✗ Apify fetch error:', err.message);
      console.error('[Rumah123Context] Error details:', { location, propertyType, listingType, timeout: this.#FETCH_TIMEOUT });
      return [];
    }
  }

  // ── Background Fetch ──────────────────────────────────────────────────────

  /**
   * Trigger a background Apify fetch for the given cache key.
   * No-op if a fetch for this key is already running.
   * Updates the cache once the fetch completes (or marks it empty on failure).
   *
   * @param {string} cacheKey
   * @param {string} location
   * @param {string} propertyType
   * @param {string} listingType
   */
  static #triggerBackgroundFetch(cacheKey, location, propertyType, listingType) {
    const existing = this.#cache.get(cacheKey) || {};
    if (existing.fetching) {
      console.log(`[Rumah123Context] Background fetch already in progress for key="${cacheKey}", skipping duplicate`);
      return; // already in flight
    }

    // Mark as fetching (preserve existing items if any)
    this.#cache.set(cacheKey, { ...existing, fetching: true, fetchedAt: existing.fetchedAt || 0 });
    console.log(`[Rumah123Context] ⏳ Background fetch triggered: key="${cacheKey}", location="${location}"`);

    this.#fetchFromApify(location, propertyType, listingType)
      .then(items => {
        this.#cache.set(cacheKey, { items, fetchedAt: Date.now(), fetching: false });
        console.log(`[Rumah123Context] ✓ Cache updated: key="${cacheKey}", items=${items.length}`);
      })
      .catch(err => {
        console.error('[Rumah123Context] ✗ Background fetch failed:', err.message);
        this.#cache.set(cacheKey, { items: [], fetchedAt: Date.now(), fetching: false });
      });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Get Rumah123 listings for chatbot context injection.
   *
   * Returns cached data immediately if the entry is valid (within TTL).
   * Otherwise triggers a background Apify fetch and waits up to 3 seconds
   * for the first result before returning an empty array.
   *
   * @param {object} params
   * @param {string} [params.location]      City/area name (e.g. "Jakarta Selatan")
   * @param {string} [params.propertyType]  Apify property type key (e.g. "house")
   * @param {string} [params.listingType]   "sale" | "rent"
   * @returns {Promise<object[]>}           Transformed listings (max 20)
   */
  static async getListings({ location = '', propertyType = '', listingType = 'sale' } = {}) {
    const key   = this.#makeKey(location, propertyType, listingType);
    const entry = this.#cache.get(key);

    // Serve from cache when valid and populated
    if (this.#isValid(entry) && entry.items?.length > 0) {
      const ageMinutes = Math.round((Date.now() - entry.fetchedAt) / 60000);
      console.log(`[Rumah123Context] ✓ Cache HIT: key="${key}", items=${entry.items.length}, age=${ageMinutes}min`);
      return entry.items;
    }

    // Log cache miss
    if (entry && !this.#isValid(entry)) {
      console.log(`[Rumah123Context] Cache EXPIRED: key="${key}", triggering background refresh`);
    } else {
      console.log(`[Rumah123Context] Cache MISS: key="${key}", triggering fetch`);
    }

    // Start background fetch (no-op if already in flight)
    this.#triggerBackgroundFetch(key, location, propertyType, listingType);

    // Wait briefly for the first-ever result on cache miss
    if (!entry?.items) {
      console.log(`[Rumah123Context] Waiting up to ${this.#FIRST_WAIT_MS}ms for first Apify result...`);
      await new Promise(resolve => setTimeout(resolve, this.#FIRST_WAIT_MS));
      const fresh = this.#cache.get(key);
      if (fresh?.items?.length > 0) {
        console.log(`[Rumah123Context] ✓ First-fetch result received: ${fresh.items.length} items`);
        return fresh.items;
      } else {
        console.log(`[Rumah123Context] ⚠️  No results after ${this.#FIRST_WAIT_MS}ms wait (fetch may still be in progress)`);
      }
    }

    return entry?.items || [];
  }

  /**
   * Build a plain-text LLM context block from a list of Rumah123 listings.
   * Used by chatbotController.js to inject live data into ChatGPT/Claude prompts.
   * Includes property images, agent contacts, and direct Rumah123 listing URLs.
   *
   * @param {object[]} listings - Transformed listing objects
   * @returns {string}          Formatted text block for LLM prompt injection
   */
  static formatForLLM(listings = []) {
    if (!listings.length) return '';

    const lines = [
      `RUMAH123 LIVE LISTINGS (from Apify) — Top ${listings.length} listings:`,
      `Source: Rumah123.com (data fetched in real-time)`,
      `Note: Always include property images and direct Rumah123 URLs when presenting these listings.`,
      '',
    ];

    listings.forEach((item, i) => {
      const parts = [`${i + 1}. [R123] ${item.title}`];
      if (item.price)                         parts.push(`   Price: ${item.price}`);
      if (item.location || item.city)         parts.push(`   Location: ${[item.district, item.city, item.province].filter(Boolean).join(', ')}`);
      if (item.propertyType || item.listingType) parts.push(`   Type: ${item.propertyType} — ${item.listingType}`);
      if (item.bedrooms || item.bathrooms)    parts.push(`   Rooms: ${item.bedrooms} bedroom(s), ${item.bathrooms} bathroom(s)`);
      if (item.landSize || item.buildingSize) parts.push(`   Area: building ${item.buildingSize}m², land ${item.landSize}m²`);
      if (item.certificate)                   parts.push(`   Certificate: ${item.certificate}`);
      if (item.furnishing)                    parts.push(`   Furnishing: ${item.furnishing}`);
      if (item.facilities)                    parts.push(`   Facilities: ${item.facilities}`);
      if (item.mediaUrls?.[0])                parts.push(`   Image: ${item.mediaUrls[0]}`);
      if (item.agentName)                     parts.push(`   Agent: ${item.agentName}${item.agencyName ? ` (${item.agencyName})` : ''}`);
      if (item.agentWhatsapp)                 parts.push(`   WhatsApp: ${item.agentWhatsapp}`);
      if (item.url)                           parts.push(`   URL: ${item.url}`);  // direct Rumah123 listing page

      lines.push(parts.join('\n'), '');
    });

    lines.push('END OF RUMAH123 LIVE LISTINGS');
    return lines.join('\n');
  }

  /**
   * Map an internal building type key → Apify property type string.
   * Returns empty string for unknown types (Apify will return all property types).
   *
   * @param {string} buildingType - Internal key (e.g. "house", "boarding_house")
   * @returns {string}            Apify-compatible property type string
   */
  static mapBuildingType(buildingType = '') {
    const MAP = {
      house:          'house',
      apartment:      'apartment',
      hotel:          'hotel',
      villa:          'villa',
      boarding_house: 'boarding-house',
      shophouse:      'shophouse',
      office:         'office',
      warehouse:      'warehouse',
      others:         '',
    };
    return MAP[buildingType] || '';
  }

  /**
   * Map an internal transaction type → Apify listing type.
   * Defaults to "sale" for any non-rent value.
   *
   * @param {string} transactionType - "rent" | "sale" | "purchase"
   * @returns {string}               "rent" | "sale"
   */
  static mapTransactionType(transactionType = '') {
    return transactionType === 'rent' ? 'rent' : 'sale';
  }

  /**
   * Pre-warm the cache for a list of common locations immediately after server startup.
   * Staggers requests by 500 ms to avoid concurrent Apify invocations overloading the account.
   *
   * @param {string[]} locations - City/area names to pre-fetch
   */
  static async warmupCache(locations = ['Jakarta Selatan', 'Surabaya', 'Bandung', 'Bali']) {
    console.log(`[Rumah123Context] Starting cache warmup for ${locations.length} locations...`);
    for (const location of locations) {
      const key = this.#makeKey(location, '', 'sale');
      this.#triggerBackgroundFetch(key, location, '', 'sale');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Return a snapshot of all current cache entries for debugging and status endpoints.
   *
   * @returns {{ entries: object[], totalKeys: number, ttlMinutes: number }}
   */
  static getCacheStatus() {
    return {
      entries: Array.from(this.#cache.entries()).map(([key, entry]) => ({
        key,
        itemCount:  entry.items?.length || 0,
        fetching:   entry.fetching      || false,
        ageMinutes: entry.fetchedAt
          ? Math.round((Date.now() - entry.fetchedAt) / 60000)
          : null,
        valid: this.#isValid(entry),
      })),
      totalKeys:  this.#cache.size,
      ttlMinutes: this.#CACHE_TTL_MS / 60000,
    };
  }
}

// ─── Exports (backward-compatible wrappers) ───────────────────────────────────

/**
 * Apakah data Rumah123 boleh masuk ke KONTEKS AI (prompt LLM & Private Agent)?
 *
 * SATU-SATUNYA sumber kebenaran untuk keputusan ini. Sebelumnya tiap pemanggil
 * menuliskan sendiri `String(process.env.RUMAH123_DATA || 'ON') === 'ON'`, dengan
 * dua akibat buruk:
 *   1. `chatbotController.js` (chatbot WEB) TIDAK PERNAH mengeceknya sama sekali —
 *      jadi RUMAH123_DATA=OFF pun, chatbot web tetap memanggil Apify dan
 *      menyuntikkan listing Rumah123 ke prompt. Gerbang yang dikira menutup,
 *      ternyata bocor di satu jalur.
 *   2. Default-nya 'ON' (fail-OPEN). Menghapus satu baris di .env diam-diam
 *      menyalakan kembali Rumah123 di SEMUA jalur AI.
 *
 * ⚠️ DEFAULT SENGAJA 'OFF' (fail-CLOSED). Keputusan bisnis: terminal message &
 * AI hanya boleh merekomendasikan katalog milik agent sendiri (Property +
 * PropertyImage + PropertyFacility). Listing pihak ketiga yang bukan milik agent
 * tidak boleh muncul sebagai rekomendasi AI. Bila env hilang, yang aman adalah
 * TIDAK menampilkan data eksternal — bukan sebaliknya.
 *
 * ⚠️ INI TIDAK MEMATIKAN HALAMAN RUMAH123. Route /api/rumah123/* (rumah123
 * Controller.js) sengaja TIDAK memanggil fungsi ini — halaman Rumah123 tetap
 * berfungsi penuh seperti biasa. Yang dimatikan hanya injeksi ke konteks AI.
 *
 * @returns {boolean}
 */
function isRumah123EnabledForAI() {
  return String(process.env.RUMAH123_DATA || 'OFF').toUpperCase() === 'ON';
}

module.exports = {
  getRumah123Listings:      (params)    => Rumah123ContextService.getListings(params),
  formatRumah123ContextForLLM:(listings)=> Rumah123ContextService.formatForLLM(listings),
  mapBuildingTypeToApify:   (type)      => Rumah123ContextService.mapBuildingType(type),
  mapTransactionTypeToApify:(type)      => Rumah123ContextService.mapTransactionType(type),
  warmupCache:              (locations) => Rumah123ContextService.warmupCache(locations),
  getCacheStatus:           ()          => Rumah123ContextService.getCacheStatus(),
  isRumah123EnabledForAI,
};

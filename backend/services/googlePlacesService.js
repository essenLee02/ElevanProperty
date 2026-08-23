/**
 * googlePlacesService.js
 *
 * Wraps Google Places API (Text Search) + Geocoding API to give
 * chatbotPrivateController.js up-to-date location/area/landmark/address data.
 *
 * WHY THIS EXISTS: chatbotPrivateController.js is the DETERMINISTIC FALLBACK chatbot —
 * it only activates when Claude AND ChatGPT are both unavailable. Claude/ChatGPT are
 * third-party LLM platforms with broad, current world knowledge of places/landmarks —
 * the fallback controller has none of that, only the hardcoded LOCATION_LANDMARKS map
 * (utils/locationLandmarks.js, ~42 curated cities) and the DB `locations` table. This
 * service fills that gap for cities NOT in the curated map, using live Google data.
 *
 * DESIGN — cache-then-async-refresh (never blocks the qualification flow):
 *   getNextQuestion() and friends in chatbotPrivateController.js are SYNCHRONOUS and
 *   called from many places; converting them to async would be an invasive, high-risk
 *   change. Instead:
 *     1. `getCachedCityLandmarks(city)` — SYNC read of an in-memory cache. Returns
 *        `null` on a cache miss (never blocks, never calls the network).
 *     2. `warmCityLandmarksCache(city)` — fire-and-forget ASYNC fetch that populates
 *        the cache for the NEXT turn. Callers do not await it.
 *   First time a city outside the curated map comes up, the customer still sees the
 *   generic fallback question ("pusat kota, area selatan") for that ONE turn — but the
 *   cache is warmed in the background, so subsequent questions/turns for that city (or
 *   the same city asked by a different customer) get real, live landmark names.
 *
 * Fails silently (never throws) when GOOGLE_API_KEY is missing or the API errors —
 * the fallback controller must keep working with its existing static data either way.
 */

const axios = require('axios');

const PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

const CACHE_TTL_MS = Number(process.env.GOOGLE_PLACES_CACHE_TTL_MS || 24 * 60 * 60 * 1000); // 24h
const MAX_LANDMARKS = 6;

// city name (lowercase, trimmed) → { landmarks: string[], fetchedAt: number }
const _landmarkCache = new Map();
// city name (lowercase, trimmed) → Promise (in-flight dedup — avoid duplicate concurrent fetches)
const _inFlight = new Map();

function _sanitizeEnvValue(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '').replace(/[\r\n]/g, '').trim();
}

function _apiKey() {
  return _sanitizeEnvValue(process.env.GOOGLE_API_KEY);
}

/**
 * Master kill switch — GOOGLE_ENABLED=false mematikan SELURUH pemakaian Google
 * Maps Platform (Places Text Search + Geocoding) di service ini, terlepas dari
 * apakah GOOGLE_API_KEY masih terisi. Default AKTIF (true) bila var tidak
 * diisi sama sekali, supaya perilaku tidak berubah diam-diam bagi siapa pun
 * yang belum menyetelnya (pola sama dengan *_TIMEOUT_MS di provider AI).
 */
function _isEnabled() {
  const raw = String(process.env.GOOGLE_ENABLED ?? '').trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'off' && raw !== 'no';
}

function _isCacheFresh(entry) {
  return entry && (Date.now() - entry.fetchedAt) < CACHE_TTL_MS;
}

/**
 * Strip common suffixes Google appends to place names (", Surabaya, Jawa Timur" etc.)
 * so landmark names read cleanly in a customer-facing question, matching the style of
 * the curated LOCATION_LANDMARKS map (e.g. "Pakuwon Mall Surabaya" → "Pakuwon Mall").
 */
function _cleanPlaceName(name = '', cityName = '') {
  let s = String(name || '').trim();
  if (!s) return '';
  const city = String(cityName || '').trim();
  if (city) {
    s = s.replace(new RegExp(`\\s*,?\\s*${city}\\b.*$`, 'i'), '').trim();
  }
  return s;
}

/**
 * SYNC cache read — safe to call from any synchronous code path (e.g. inside
 * getNextQuestion()). Never touches the network. Returns null on cache miss OR
 * stale/expired entry (caller should then call warmCityLandmarksCache()).
 *
 * @param {string} cityName
 * @returns {string[]|null}
 */
function getCachedCityLandmarks(cityName) {
  const key = String(cityName || '').trim().toLowerCase();
  if (!key) return null;
  const entry = _landmarkCache.get(key);
  if (!entry || !_isCacheFresh(entry)) return null;
  return entry.landmarks.length ? entry.landmarks : null;
}

/**
 * Fire-and-forget async fetch that populates the landmark cache for `cityName`.
 * Callers should NOT await this from a synchronous flow — call it, ignore the
 * returned promise, and rely on getCachedCityLandmarks() on the NEXT turn.
 * Safe to call repeatedly (in-flight requests for the same city are deduplicated).
 *
 * @param {string} cityName
 * @returns {Promise<string[]>} resolves to the fetched landmark list (also cached)
 */
async function warmCityLandmarksCache(cityName) {
  const key = String(cityName || '').trim().toLowerCase();
  if (!key) return [];

  const cached = getCachedCityLandmarks(cityName);
  if (cached) return cached;

  if (_inFlight.has(key)) return _inFlight.get(key);

  const fetchPromise = (async () => {
    if (!_isEnabled()) {
      console.log('[GooglePlaces] GOOGLE_ENABLED=false — skipping landmark fetch for', cityName);
      _landmarkCache.set(key, { landmarks: [], fetchedAt: Date.now() });
      return [];
    }
    const apiKey = _apiKey();
    if (!apiKey) {
      console.warn('[GooglePlaces] GOOGLE_API_KEY missing — skipping landmark fetch for', cityName);
      _landmarkCache.set(key, { landmarks: [], fetchedAt: Date.now() });
      return [];
    }
    try {
      const query = `shopping mall OR university OR tourist attraction near ${cityName}, Indonesia`;
      const { data } = await axios.get(PLACES_TEXT_SEARCH_URL, {
        params: { query, key: apiKey },
        timeout: 8000,
      });
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn('[GooglePlaces] Text Search non-OK status:', data.status, data.error_message || '');
      }
      const names = (data.results || [])
        .map((r) => _cleanPlaceName(r.name, cityName))
        .filter(Boolean);
      const unique = [...new Set(names)].slice(0, MAX_LANDMARKS);
      _landmarkCache.set(key, { landmarks: unique, fetchedAt: Date.now() });
      console.log(`[GooglePlaces] Cached ${unique.length} landmarks for "${cityName}".`);
      return unique;
    } catch (err) {
      console.warn('[GooglePlaces] Landmark fetch failed for', cityName, '-', err.message);
      // Cache the miss briefly (shorter effective TTL via not overwriting fetchedAt=0)
      // so a single transient failure doesn't hammer the API every message.
      _landmarkCache.set(key, { landmarks: [], fetchedAt: Date.now() });
      return [];
    } finally {
      _inFlight.delete(key);
    }
  })();

  _inFlight.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Geocode a free-text location/address into a canonical formatted address + city.
 * Used to validate/enrich a customer's stated area or "Patokan lokasi" answer with
 * real address data. Returns null on failure (never throws) — callers must treat a
 * null result as "no enrichment available", not as an error.
 *
 * @param {string} address - e.g. "Pakuwon Mall Surabaya" or "Jl. Ahmad Yani, Malang"
 * @returns {Promise<{formattedAddress:string, city:string, province:string, lat:number, lng:number}|null>}
 */
async function geocodeAddress(address) {
  if (!_isEnabled()) return null;
  const apiKey = _apiKey();
  const query = String(address || '').trim();
  if (!apiKey || !query) return null;

  try {
    const { data } = await axios.get(GEOCODE_URL, {
      params: { address: `${query}, Indonesia`, key: apiKey },
      timeout: 8000,
    });
    if (data.status !== 'OK' || !data.results?.length) return null;

    const result = data.results[0];
    const components = result.address_components || [];
    const findComponent = (type) => components.find((c) => c.types.includes(type))?.long_name || '';

    return {
      formattedAddress: result.formatted_address || '',
      city: findComponent('administrative_area_level_2') || findComponent('locality') || '',
      province: findComponent('administrative_area_level_1') || '',
      lat: result.geometry?.location?.lat ?? null,
      lng: result.geometry?.location?.lng ?? null,
    };
  } catch (err) {
    console.warn('[GooglePlaces] geocodeAddress() failed for', query, '-', err.message);
    return null;
  }
}

module.exports = {
  getCachedCityLandmarks,
  warmCityLandmarksCache,
  geocodeAddress,
  isGoogleEnabled: _isEnabled,
};

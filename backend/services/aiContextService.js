/**
 * aiContextService.js
 *
 * Loads facility names and city names from the database, caches them,
 * and injects the data as context blocks into AI system prompts.
 *
 * Usage by AI controllers:
 *   const { buildFacilityContextBlock, buildCityContextBlock, detectCitiesInText } = require('./aiContextService');
 *
 * CACHE: Both datasets are refreshed every CACHE_TTL_MS (5 minutes) to avoid
 * hammering the DB on every message, while staying reasonably fresh.
 */

'use strict';

const { Op } = require('sequelize');

let City, Facility;
try {
  const models = require('../models');
  City     = models.City;
  Facility = models.Facility;
} catch (_) {
  // Models may not be available in some test contexts
}

/* ══════════════════════════════════════════════════════════════════════════════
   SIMPLE IN-PROCESS CACHE
══════════════════════════════════════════════════════════════════════════════ */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const _cache = {
  cities    : { data: null, ts: 0 },
  facilities: { data: null, ts: 0 },
};

function _isStale(key) {
  return !_cache[key].data || (Date.now() - _cache[key].ts) > CACHE_TTL_MS;
}

/* ══════════════════════════════════════════════════════════════════════════════
   CITY LOADER
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Load all active city names from DB (cached).
 * Returns an array of uppercase city name strings, e.g. ['SURABAYA', 'MALANG', ...]
 *
 * @returns {Promise<string[]>}
 */
async function getCityNames() {
  if (!_isStale('cities')) return _cache.cities.data;

  if (!City) return [];

  try {
    const rows = await City.findAll({
      attributes: ['name'],
      where     : { status: 1 },
      order     : [['name', 'ASC']],
      raw       : true,
    });

    const names = rows.map(r => String(r.name || '').toUpperCase().trim()).filter(Boolean);
    _cache.cities = { data: names, ts: Date.now() };
    return names;
  } catch (err) {
    console.warn('[aiContextService] getCityNames failed:', err.message);
    return _cache.cities.data || [];
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   FACILITY LOADER
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Load all active facility names from DB (cached).
 * Returns an array of facility name strings.
 *
 * @returns {Promise<string[]>}
 */
async function getFacilityNames() {
  if (!_isStale('facilities')) return _cache.facilities.data;

  if (!Facility) return [];

  try {
    const rows = await Facility.findAll({
      attributes: ['name'],
      where     : { status: 1 },
      order     : [['name', 'ASC']],
      raw       : true,
    });

    const names = rows.map(r => String(r.name || '').trim()).filter(Boolean);
    _cache.facilities = { data: names, ts: Date.now() };
    return names;
  } catch (err) {
    console.warn('[aiContextService] getFacilityNames failed:', err.message);
    return _cache.facilities.data || [];
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   CITY DETECTION IN TEXT
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Detect which city names (from DB) appear in the given text.
 * Matching is case-insensitive and word-boundary aware.
 *
 * @param {string}   text      - User message or conversation context
 * @param {string[]} cityNames - Array from getCityNames() (pass to avoid double-await)
 * @returns {string[]}         - Matched city names in DB casing
 */
function detectCitiesInText(text, cityNames = []) {
  if (!text || !cityNames.length) return [];

  const normalized = text.toUpperCase();
  return cityNames.filter(city => {
    // Word-boundary via surrounding non-alphanumeric or start/end
    const re = new RegExp(`(^|[^A-Z])${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Z]|$)`);
    return re.test(normalized);
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   FACILITY DETECTION IN TEXT
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Detect which facility names appear in the given text.
 * Used to confirm that a user's facility request maps to a known facility.
 *
 * @param {string}   text          - User message
 * @param {string[]} facilityNames - Array from getFacilityNames()
 * @returns {string[]}
 */
function detectFacilitiesInText(text, facilityNames = []) {
  if (!text || !facilityNames.length) return [];

  const normalized = text.toUpperCase();
  return facilityNames.filter(name => {
    const re = new RegExp(`(^|[^A-Z])${name.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Z]|$)`);
    return re.test(normalized);
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   LOCATION TOPIC DETECTOR
══════════════════════════════════════════════════════════════════════════════ */

const LOCATION_TRIGGER_WORDS = [
  // Indonesian
  'lokasi', 'kota', 'wilayah', 'area', 'daerah', 'di mana', 'dimana',
  'jalan', 'gang', 'perumahan', 'komplek', 'kawasan', 'dekat', 'deket',
  'sekitar', 'pindah', 'tinggal di', 'sewa di', 'cari di',
  // English
  'location', 'city', 'area', 'where', 'near', 'close to', 'around',
  'neighborhood', 'district', 'region',
];

/**
 * Returns true if the user's message contains location-related keywords,
 * suggesting that city context should be injected into the prompt.
 *
 * @param {string} text
 * @returns {boolean}
 */
function isLocationTopic(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return LOCATION_TRIGGER_WORDS.some(w => lower.includes(w));
}

/* ══════════════════════════════════════════════════════════════════════════════
   CONTEXT BLOCK BUILDERS — injected into AI system prompts
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Build facility skill context block for AI system prompt.
 *
 * Injected as a reference list so the AI:
 *  - Recognises facility names the customer mentions
 *  - Uses consistent terminology when describing amenities
 *  - Knows which facilities exist in the platform
 *
 * @returns {Promise<string>}
 */
async function buildFacilityContextBlock() {
  const names = await getFacilityNames();
  if (!names.length) return '';

  // Group roughly by category to help AI contextualise
  return `
## FACILITY REFERENCE (from database — ${names.length} facilities)

The following facilities are registered in the property platform. When a customer
mentions any of these by name or similar term, recognise it as a facility request.
If a customer asks for a facility NOT in this list, still attempt to help but flag
that it may not be searchable in the catalog.

Registered facilities (use these exact names when quoting):
${names.join(' | ')}

When a customer mentions facilities (e.g. "ada kolam renang?", "perlu parkir motor",
"mau yang ada gym"), acknowledge specifically which ones match from the list above.
`;
}

/**
 * Build city context block for AI system prompt.
 *
 * ONLY injected when the user's message is about location (isLocationTopic).
 * Sends matched cities (detected in message) + full city list for reference.
 *
 * If the customer mentions a city NOT in the DB, the AI is instructed to ask
 * for clarification / the nearest city.
 *
 * @param {string}   userMessage - Current customer message
 * @param {Array}    history     - Conversation history [{role, message}]
 * @returns {Promise<string>}
 */
async function buildCityContextBlock(userMessage, history = []) {
  const cityNames = await getCityNames();
  if (!cityNames.length) return '';

  // Combine current message + last 4 customer messages for detection
  const recentText = [
    userMessage,
    ...(history || [])
      .filter(m => m.role === 'user' || m.role === 'customer')
      .slice(-4)
      .map(m => m.message || ''),
  ].join(' ');

  const detectedCities = detectCitiesInText(recentText, cityNames);

  const matchedBlock = detectedCities.length
    ? `\nDetected city mentions in conversation: ${detectedCities.join(', ')}\n`
    : '';

  return `
## CITY REFERENCE (from database — ${cityNames.length} cities in Indonesia)

${matchedBlock}
All city names registered in the platform:
${cityNames.join(' | ')}

City matching rules:
1. If the customer mentions a city that MATCHES one in the list above → treat it as valid, proceed with property search.
2. If the customer mentions a city NOT in the list → politely ask them to clarify using the nearest city from the list.
   Example: "Maaf, kami belum memiliki data untuk kota [X]. Apakah Anda maksud salah satu dari: [nearby cities]?"
3. If the customer asks "kota apa saja?" or "coverage mana?" → share a summary of the major cities from the list.
4. Never assume a city name from outside the list without confirming with the customer.
`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMBINED CONTEXT LOADER — called once per incoming message
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Load both facility and city context blocks in parallel.
 * Only loads city block when the message is location-related.
 *
 * @param {string} userMessage
 * @param {Array}  history
 * @returns {Promise<{ facilityContext: string, cityContext: string, detectedCities: string[] }>}
 */
async function loadAIContextBlocks(userMessage, history = []) {
  const locationTopic = isLocationTopic(userMessage);

  const [facilityContext, cityContext, cityNames] = await Promise.all([
    buildFacilityContextBlock(),
    locationTopic ? buildCityContextBlock(userMessage, history) : Promise.resolve(''),
    getCityNames(),
  ]);

  const detectedCities = detectCitiesInText(
    [userMessage, ...(history || []).filter(m => m.role === 'user' || m.role === 'customer').slice(-4).map(m => m.message || '')].join(' '),
    cityNames,
  );

  return { facilityContext, cityContext, detectedCities };
}

/* ══════════════════════════════════════════════════════════════════════════════
   CACHE MANAGEMENT
══════════════════════════════════════════════════════════════════════════════ */

/** Force-expire both caches (e.g. after admin updates facility/city master data). */
function invalidateCache() {
  _cache.cities     = { data: null, ts: 0 };
  _cache.facilities = { data: null, ts: 0 };
}

module.exports = {
  getCityNames,
  getFacilityNames,
  detectCitiesInText,
  detectFacilitiesInText,
  isLocationTopic,
  buildFacilityContextBlock,
  buildCityContextBlock,
  loadAIContextBlocks,
  invalidateCache,
};

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

let City, Facility, Location;
try {
  const models = require('../models');
  City     = models.City;
  Facility = models.Facility;
  Location = models.Location;
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
  locations : { data: null, ts: 0 },
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
   LOCATION / LANDMARK LOADER (anchor points — Q6 patokan lokasi)
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Load all active landmark/anchor names from the `locations` table (cached).
 * These are the reference points customers use as anchors ("dekat Grand City Mall",
 * "dekat Alfamaret", "dekat Apotek") — mix of Indonesian & English terms.
 *
 * @returns {Promise<string[]>}
 */
async function getLocationNames() {
  if (!_isStale('locations')) return _cache.locations.data;

  if (!Location) return [];

  try {
    const rows = await Location.findAll({
      attributes: ['name'],
      where     : { status: 1 },
      order     : [['name', 'ASC']],
      raw       : true,
    });

    const names = rows.map(r => String(r.name || '').trim()).filter(Boolean);
    _cache.locations = { data: names, ts: Date.now() };
    return names;
  } catch (err) {
    console.warn('[aiContextService] getLocationNames failed:', err.message);
    return _cache.locations.data || [];
  }
}

/**
 * Detect which landmark/anchor names (from DB) appear in the given text.
 * Case-insensitive, word-boundary aware. Handles "GANG SEMPIT" from "ALLEY/GANG SEMPIT".
 *
 * @param {string}   text
 * @param {string[]} locationNames - Array from getLocationNames()
 * @returns {string[]}
 */
function detectLocationsInText(text, locationNames = []) {
  if (!text || !locationNames.length) return [];
  const normalized = text.toUpperCase();
  return locationNames.filter(name => {
    // Some DB names carry a slash alias ("ALLEY/GANG SEMPIT") — match any alias part.
    return String(name).toUpperCase().split('/').some(part => {
      const p = part.trim();
      if (p.length < 3) return false;
      const re = new RegExp(`(^|[^A-Z0-9])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Z0-9]|$)`);
      return re.test(normalized);
    });
  });
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

  // Bilingual glossary: DB stores facility names in ENGLISH; customers usually type
  // Indonesian. The AI must map BOTH languages to the same facility so recognition
  // works whether the customer says "balkon" or "balcony", "kolam renang" or "pool".
  return `
## FACILITY REFERENCE (from database — ${names.length} facilities) — BILINGUAL

Facility names below are stored in ENGLISH (DB casing). Customers may mention them in
**Indonesian OR English** — treat both as the SAME facility. Common ID↔EN mapping:
- kolam renang = swimming pool = pool · balkon = balcony · taman = garden
- keamanan/satpam/cctv = security/cctv · parkir = parking · lift = elevator
- dapur = kitchen · kulkas = refrigerator/fridge · mesin cuci = washing machine
- kasur/ranjang = bed · lemari = wardrobe/closet · pemanas air = water heater
- sarapan = breakfast · pusat kebugaran = gym/fitness · mushola = prayer room

Registered facilities (canonical DB names — quote these when confirming):
${names.join(' | ')}

Rules:
1. When a customer mentions a facility in Indonesian or English, match it to the
   canonical name above and confirm specifically (e.g. "Siap, yang ada kolam renang (pool) ✅").
2. If a requested facility is NOT in this list, still help but note it may not be
   searchable in the catalog.
3. Never invent facilities that are not registered.
`;
}

/**
 * Build landmark/anchor-point (locations) reference block for the AI prompt.
 *
 * Lets the AI recognise Q6 "patokan lokasi" answers ("dekat Grand City Mall",
 * "deket Alfamaret", "dekat apotek 24 jam") against the DB `locations` master.
 * Bilingual: DB mixes Indonesian & English landmark terms.
 *
 * @param {string} userMessage
 * @param {Array}  history
 * @returns {Promise<string>}
 */
async function buildLocationContextBlock(userMessage, history = []) {
  const names = await getLocationNames();
  if (!names.length) return '';

  const recentText = [
    userMessage,
    ...(history || [])
      .filter(m => m.role === 'user' || m.role === 'customer')
      .slice(-4)
      .map(m => m.message || ''),
  ].join(' ');

  const detected = detectLocationsInText(recentText, names);
  const matchedBlock = detected.length
    ? `\nDetected landmark/anchor mentions in conversation: ${detected.join(', ')}\n`
    : '';

  return `
## LANDMARK / ANCHOR REFERENCE (from database — ${names.length} anchor types) — BILINGUAL

These are valid "patokan lokasi" (anchor points) customers use to describe WHERE they
want a property, in Indonesian OR English (mall, sekolah/school, apotek/pharmacy,
bandara/airport, stasiun/station, pasar/market, rumah sakit/hospital, minimarket, etc.).
${matchedBlock}
Registered anchor types:
${names.join(' | ')}

Rules:
1. When a customer answers Q6 with any of these (or a similar term in either language),
   treat it as a VALID anchor point — do NOT re-ask the location/area question.
2. Preserve the customer's exact phrasing in the summary ("Patokan lokasi: dekat PTC").
3. A named place (e.g. "Grand City Mall", "PTC", "Tunjungan Plaza") also counts as an anchor.
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
## CITY REFERENCE (from database — ${cityNames.length} cities in Indonesia) — BILINGUAL

City names are Indonesian; accept English framing too ("in Surabaya" = "di Surabaya").
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

  const [facilityContext, cityContext, locationContext, cityNames] = await Promise.all([
    buildFacilityContextBlock(),
    locationTopic ? buildCityContextBlock(userMessage, history)     : Promise.resolve(''),
    locationTopic ? buildLocationContextBlock(userMessage, history) : Promise.resolve(''),
    getCityNames(),
  ]);

  const detectedCities = detectCitiesInText(
    [userMessage, ...(history || []).filter(m => m.role === 'user' || m.role === 'customer').slice(-4).map(m => m.message || '')].join(' '),
    cityNames,
  );

  return { facilityContext, cityContext, locationContext, detectedCities };
}

/* ══════════════════════════════════════════════════════════════════════════════
   CACHE MANAGEMENT
══════════════════════════════════════════════════════════════════════════════ */

/** Force-expire both caches (e.g. after admin updates facility/city master data). */
function invalidateCache() {
  _cache.cities     = { data: null, ts: 0 };
  _cache.facilities = { data: null, ts: 0 };
  _cache.locations  = { data: null, ts: 0 };
}

module.exports = {
  getCityNames,
  getFacilityNames,
  getLocationNames,
  detectCitiesInText,
  detectFacilitiesInText,
  detectLocationsInText,
  isLocationTopic,
  buildFacilityContextBlock,
  buildCityContextBlock,
  buildLocationContextBlock,
  loadAIContextBlocks,
  invalidateCache,
};

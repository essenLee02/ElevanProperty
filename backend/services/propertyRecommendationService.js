const path = require('path');
const fs = require('fs');

// URUTAN PENTING: Tipe lebih spesifik harus dicek SEBELUM tipe yang lebih umum.
// Contoh masalah jika urutan salah:
//   'house' keyword matches "warehouse" (substring!)
//   'shop' keyword matches "shophouse" prefix
// Solusi: letakkan 'warehouse' dan 'shophouse' SEBELUM 'house'.
const PROPERTY_TYPES = {
  hotel         : ['hotel', 'hotels', 'penginapan'],
  villa         : ['villa', 'vila'],
  apartment     : ['apartemen', 'apartment', 'apart'],
  boarding_house: ['kos', 'kost', 'boarding house', 'boarding_house', 'indekos'],
  warehouse     : ['gudang', 'warehouse'],           // ← SEBELUM house (warehouse ⊃ "house")
  shophouse     : ['ruko', 'shophouse', 'toko'],     // ← SEBELUM house (shophouse ⊃ "house")
  office        : ['kantor', 'office'],
  house         : ['rumah', 'house', 'home', 'kontrakan', 'residential'], // ← SETELAH warehouse/shophouse
  others        : ['lainnya', 'others', 'other']
};

const TRANSACTION_TYPES = {
  rent: ['sewa', 'rent', 'rental', 'kontrak', 'menginap', 'harian', 'bulanan', 'tahunan', 'per tahun', 'per bulan'],
  // 'beli' / 'buy' = purchase intent = sale transaction. Digabung ke 'sale' supaya
  // konsisten dengan nilai di katalog properti dan txWord di whatsappAIService.
  sale: ['jual', 'sale', 'sell', 'dijual', 'beli', 'buy', 'purchase', 'membeli']
};

// Base location keywords. The complete location list is expanded dynamically
// from indonesia_property_36_provinces_flat.json so chatbot search follows
// the same JSON catalog used by About Us.
const FALLBACK_LOCATION_KEYWORDS = [
  'Malang', 'Batu', 'Surabaya', 'Sidoarjo', 'Madiun', 'Semarang', 'Yogyakarta', 'Bandung',
  'Jakarta', 'Bogor', 'Depok', 'Tangerang', 'Bekasi', 'Solo', 'Serang', 'Cilegon',
  'Cirebon', 'Tasikmalaya', 'Sukabumi', 'Karawang', 'Medan', 'Palembang', 'Pekanbaru',
  'Padang', 'Bandar Lampung', 'Banda Aceh', 'Jambi', 'Bengkulu', 'Pangkal Pinang',
  'Tanjung Pinang', 'Pontianak', 'Banjarmasin', 'Samarinda', 'Balikpapan', 'Palangkaraya',
  'Tanjung Selor', 'Makassar', 'Manado', 'Kendari', 'Palu', 'Gorontalo', 'Mamuju',
  'Bali', 'Denpasar', 'Mataram', 'Kupang', 'Papua', 'Jayapura', 'Ambon', 'Sofifi',
  'Manokwari', 'Lhokseumawe', 'Langsa', 'Sabang', 'Meulaboh'
];

function getKnownLocations() {
  const dynamicLocations = loadJsonProperties().flatMap((property) => [
    property.province,
    property.city,
    property.district,
    property.location
  ]).filter(Boolean);

  return [...new Set([...FALLBACK_LOCATION_KEYWORDS, ...dynamicLocations])]
    .sort((a, b) => String(b).length - String(a).length);
}

// ─── JSON Property Loader ────────────────────────────────────────────────────
// Reads indonesia_property_36_provinces_flat.json from backend/asset/json_data/
// (single source of truth — backend serves this file, frontend proxies to it).
// Normalises each record to the camelCase shape expected by the downstream
// filter / search functions. Result is cached after first load.

const JSON_DATA_PATH = path.resolve(
  __dirname,
  '../asset/json_data/indonesia_property_36_provinces_flat.json'
);

let _jsonPropertiesCache = null;

function loadJsonProperties() {
  if (_jsonPropertiesCache) return _jsonPropertiesCache;

  try {
    const raw = fs.readFileSync(JSON_DATA_PATH, 'utf8');
    const json = JSON.parse(raw);
    const records = json.properties || [];

    _jsonPropertiesCache = records.map((p, index) => ({
      id: p.id || index + 1,
      title: p.title || '',
      description: p.description || '',
      price: p.price || '',
      // Normalise location object → flat fields expected by filterProperties.
      location: p.location?.city || p.location?.province || '',
      province: p.location?.province || '',
      city: p.location?.city || '',
      district: p.location?.area || '',
      address: p.address || '',
      buildingArea: p.building_area || '',
      landArea: p.land_area || '',
      buildingType: p.building_type || '',
      transactionType: p.transaction_type || '',
      facilities: Array.isArray(p.facilities) ? p.facilities.join(', ') : (p.facilities || ''),
      imageUrl: p.image || '',
      status: 'available'
    }));

    console.log(`[PropertyRecommendationService] Loaded ${_jsonPropertiesCache.length} properties from JSON file.`);
    return _jsonPropertiesCache;
  } catch (err) {
    console.error('[PropertyRecommendationService] Failed to load JSON file:', err.message);
    return [];
  }
}

// Expose as fallbackProperties for backward-compatible module.exports reference.
const fallbackProperties = loadJsonProperties();



function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function includesAny(text, words = []) {
  return words.some((word) => text.includes(word));
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectBuildingType(message = '') {
  const text = normalizeText(message);
  return Object.entries(PROPERTY_TYPES).find(([, keywords]) => includesAny(text, keywords))?.[0] || '';
}

function detectTransactionType(message = '') {
  const text = normalizeText(message);
  return Object.entries(TRANSACTION_TYPES).find(([, keywords]) => includesAny(text, keywords))?.[0] || '';
}

function cleanLocationCandidate(value = '') {
  return String(value || '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\b(saya|mau|ingin|cari|sewa|beli|jual|ada|apa|saja|dong|tolong|yang|dengan|fasilitas|harga|berapa|budget|badget|range|antara|dan|full|furnish|furnished)\b.*$/i, '')
    .trim();
}

function detectLocation(message = '') {
  const text = normalizeText(message);
  const found = getKnownLocations().find((location) => new RegExp(`\\b${escapeRegExp(location.toLowerCase())}\\b`, 'i').test(text));
  if (found) return found;

  const afterDi = text.match(/\bdi\s+([a-zA-Z\s]{3,35})/i);
  if (afterDi && afterDi[1]) {
    return cleanLocationCandidate(afterDi[1]);
  }

  return '';
}

function detectFacilities(message = '') {
  const text = normalizeText(message);
  return ['ac', 'wi-fi', 'wifi', 'parking', 'parkir', 'kitchen', 'dapur', 'full furnish', 'furnished', 'security']
    .filter((facility) => text.includes(facility));
}

function parseNumberToken(token = '') {
  const raw = String(token || '').toLowerCase().trim();
  if (!raw) return null;
  const numberPart = raw.match(/[0-9]+(?:[.,][0-9]+)?/);
  if (!numberPart) return null;
  let number = Number(numberPart[0].replace(',', '.'));
  if (!Number.isFinite(number)) return null;
  if (/miliar|billion/.test(raw)) number *= 1000000000;
  else if (/juta|jt|million/.test(raw)) number *= 1000000;
  else if (/ribu|rb|thousand/.test(raw)) number *= 1000;
  return Math.round(number);
}

function detectBudget(message = '') {
  const text = normalizeText(message);
  const unitMatch = text.match(/(juta|jt|miliar|ribu|rb|million|billion)/i);
  const unit = unitMatch ? unitMatch[1] : '';
  const period = /tahun|year|annual|per tahun|\/tahun/.test(text)
    ? 'year'
    : /bulan|month|monthly|per bulan|\/bulan/.test(text)
      ? 'month'
      : /malam|night|daily|hari|harian|\/malam/.test(text)
        ? 'night'
        : '';

  const rangeMatch = text.match(/([0-9]+(?:[.,][0-9]+)?\s*(?:juta|jt|miliar|ribu|rb|million|billion)?)\s*(?:-|sampai|sd|s\/d|to|hingga)\s*([0-9]+(?:[.,][0-9]+)?\s*(?:juta|jt|miliar|ribu|rb|million|billion)?)/i);
  if (rangeMatch) {
    const min = parseNumberToken(`${rangeMatch[1]} ${unit}`);
    const max = parseNumberToken(`${rangeMatch[2]} ${unit}`);
    return {
      text: rangeMatch[0].trim(),
      min: Math.min(min || 0, max || 0) || null,
      max: Math.max(min || 0, max || 0) || null,
      period
    };
  }

  // Case A: explicit budget prefix (budget/harga/rp/etc.) — monetary unit is optional
  // e.g. "budget 5", "harga 2 juta", "rp 500"
  const prefixedMatch = text.match(
    /(?:budget|badget|harga|rp|idr|range|sekitar|maksimal|max)\s*[:=]?\s*(rp\s*)?([0-9]+(?:[.,][0-9]+)?(?:\s*(?:juta|jt|miliar|ribu|rb|million|billion))?)/i
  );
  if (prefixedMatch) {
    const value = parseNumberToken(`${prefixedMatch[2]} ${unit}`);
    return { text: prefixedMatch[0].trim(), min: null, max: value, period };
  }

  // Case B: no prefix — monetary unit REQUIRED to avoid matching bare dates/counts
  // e.g. "2 juta/bulan" ✅   "1 Agustus" ❌   "25" ❌   "1 tahun" ❌
  const unitRequiredMatch = text.match(
    /(rp\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:juta|jt|miliar|ribu|rb|million|billion))/i
  );
  if (unitRequiredMatch) {
    const value = parseNumberToken(`${unitRequiredMatch[2]} ${unit}`);
    return { text: unitRequiredMatch[0].trim(), min: null, max: value, period };
  }

  // Deteksi preferensi harga tanpa angka (terjangkau / murah / affordable).
  // Ini dianggap sebagai budget "affordable" — qualification gate menerimanya
  // dan properti akan diurutkan dari termurah.
  const affordableWords = [
    'terjangkau', 'murah', 'termurah', 'hemat', 'ekonomis', 'low budget',
    'affordable', 'cheap', 'cheapest', 'economy', 'low cost', 'low price'
  ];
  if (affordableWords.some(w => text.includes(w))) {
    return { text: 'affordable', min: null, max: null, period: '', preference: 'affordable' };
  }

  return null;
}

/**
 * Build cumulative property profile by processing each user message individually.
 * Setiap field diisi oleh nilai terbaru yang ditemukan (pesan terbaru wins per field).
 * Ini lebih akurat daripada join semua teks → satu deteksi, karena:
 *   - Pesan "Beli" tidak akan ter-overlap dengan "hotel" dari turn lain
 *   - Setiap jawaban kualifikasi diterapkan tepat pada field-nya
 */
// Role pesan customer bisa berbeda tergantung controller yang menyimpan:
//   fonnteChatController / watiChatController / dialogChatController → 'customer'
//   sessionService.saveUserMessage (website chatbot)               → 'user'
// Keduanya harus diikutsertakan dalam ekstraksi history.
const CUSTOMER_ROLES = new Set(['user', 'customer']);
const AI_ROLES       = new Set(['assistant', 'ai']);

function extractFromHistory(history = []) {
  const recentUserMsgs = (history || [])
    .filter((item) => CUSTOMER_ROLES.has(item.role))
    .slice(-8); // ambil maks 8 pesan customer terakhir

  const accumulated = {
    buildingType:   '',
    transactionType:'',
    location:       '',
    budget:         null,
    facilities:     [],
    fallbackTypes:  []
  };

  for (const histMsg of recentUserMsgs) {
    const h = extractSingleMessageFilters(histMsg.message || '');

    // Jika tipe properti berubah ke tipe yang berbeda dalam percakapan yang sama,
    // reset transactionType supaya tidak mewarisi tx dari konteks pencarian lama.
    // Contoh: riwayat "sewa hotel" lalu customer berubah ke "mau rumah"
    //         → tx 'rent' dari hotel tidak boleh diwarisi ke pencarian rumah.
    if (h.buildingType && accumulated.buildingType && h.buildingType !== accumulated.buildingType) {
      accumulated.transactionType = '';
      accumulated.location        = '';  // lokasi lama juga direset — bisa jadi beda kota
      accumulated.budget          = null;
    }

    if (h.buildingType)          accumulated.buildingType    = h.buildingType;
    if (h.transactionType)       accumulated.transactionType = h.transactionType;
    if (h.location)              accumulated.location        = h.location;
    if (h.budget)                accumulated.budget          = h.budget;
    if (h.facilities?.length)    accumulated.facilities      = h.facilities;
    if (h.fallbackTypes?.length) accumulated.fallbackTypes   = h.fallbackTypes;
  }

  return accumulated;
}

/**
 * Deteksi tipe properti fallback yang eksplisit disebutkan customer.
 *
 * Pattern yang dikenali:
 *   "kalau tidak ada hotel, villa saja"      → fallbackTypes: ['villa']
 *   "jika gak ada rumah, apartemen juga oke" → fallbackTypes: ['apartment']
 *   "hotel atau villa"                        → primaryType: hotel, fallbackTypes: ['villa']
 *
 * @param {string} message
 * @returns {string[]} Array of fallback buildingType keys
 */
function detectFallbackTypes(message = '') {
  const text    = normalizeText(message);
  const results = [];

  // Pattern 1: "kalau/jika tidak/enggak ada [type]..." — conditional fallback
  // Covers: "kalau tidak ada villa", "kalau enggak ada hotel", "kalo ga ada rumah"
  const fallbackRegex = /(?:kalau|jika|bila|kalo)\s+(?:tidak|gak|ga|ngga|enggak|kagak|ndak|ga ada|tidak ada|enggak ada)\s+(?:ada\s+)?([a-z\s]+?)(?:,|\.|;|$|\s+(?:kasih|berikan|saran|aja|saja|juga|ok|oke|bisa|boleh))/gi;
  let m;
  while ((m = fallbackRegex.exec(text)) !== null) {
    const t = detectBuildingType(m[1].trim());
    if (t) results.push(t);
  }

  // Pattern 2: "[type] atau [type]" / "[type] dan [type]"  (multi-type explicit)
  const multiTypeRegex = /\b([a-z]+)\s+(?:atau|or|dan|and|\/)\s+([a-z]+)\b/gi;
  while ((m = multiTypeRegex.exec(text)) !== null) {
    const t = detectBuildingType(m[2].trim());
    if (t) results.push(t);
  }

  // Pattern 3: "sewa/beli [type] saja/aja" — direct fallback statement
  // Covers: "Saya sewa apartemen saja", "beli rumah aja"
  // These indicate the customer's fallback when primary type is unavailable.
  const directFallbackRegex = /\b(?:sewa|beli|kontrak)\s+([a-z]+)\s+(?:saja|aja)\b/gi;
  while ((m = directFallbackRegex.exec(text)) !== null) {
    const t = detectBuildingType(m[1].trim());
    if (t) results.push(t);
  }

  // Deduplicate
  return [...new Set(results)];
}

function extractSingleMessageFilters(message = '') {
  return {
    buildingType  : detectBuildingType(message),
    transactionType: detectTransactionType(message),
    location      : detectLocation(message),
    budget        : detectBudget(message),
    facilities    : detectFacilities(message),
    fallbackTypes : detectFallbackTypes(message),  // tipe-tipe alternatif eksplisit
  };
}

function extractPropertyFilters(message = '', history = []) {
  const current    = extractSingleMessageFilters(message);
  const accumulated = extractFromHistory(history);

  // Current message wins on each field.
  // Transactiontype dari history TIDAK dibuang kecuali current message secara eksplisit
  // mengganti tipe properti ke tipe yang BERBEDA (indikasi pencarian baru).
  // Contoh yang diizinkan untuk inherit tx:
  //   history: "beli rumah"   → tx=sale
  //   current: "di Surabaya"  → current.tx='', current.type=''  → masih inherit 'sale'
  // Contoh yang direset:
  //   history: "sewa hotel"   → tx=rent, type=hotel
  //   current: "mau rumah"    → current.type=house (berbeda!) → tx direset ke ''
  const typeChangedToNew = Boolean(
    current.buildingType &&
    accumulated.buildingType &&
    current.buildingType !== accumulated.buildingType
  );

  return {
    buildingType:   current.buildingType    || accumulated.buildingType    || '',
    transactionType:current.transactionType || (typeChangedToNew ? '' : accumulated.transactionType) || '',
    location:       current.location        || accumulated.location        || '',
    budget:         current.budget          || accumulated.budget          || null,
    facilities:     current.facilities?.length ? current.facilities : accumulated.facilities || [],
    fallbackTypes:  current.fallbackTypes   || accumulated.fallbackTypes   || []
  };
}

/**
 * Deteksi apakah user minta properti dengan harga tertentu.
 *
 * @param {string} message
 * @returns {'asc'|'desc'|''}
 *   'asc'  = user minta termurah (cheap, murah, affordable)
 *   'desc' = user minta termahal (expensive, mewah, luxury)
 *   ''     = tidak ada preferensi harga
 */
function detectPriceSort(message = '') {
  const text = normalizeText(message);
  const cheapWords = [
    'cheap', 'cheaper', 'cheapest', 'affordable', 'low price', 'low cost',
    'budget', 'low budget', 'economy', 'economical',
    'murah', 'termurah', 'paling murah', 'terjangkau', 'hemat', 'ekonomis',
  ];
  const expensiveWords = [
    'expensive', 'luxury', 'premium', 'high end', 'most expensive',
    'mahal', 'termahal', 'paling mahal', 'mewah',
  ];

  if (cheapWords.some(w => text.includes(w))) return 'asc';
  if (expensiveWords.some(w => text.includes(w))) return 'desc';
  return '';
}

/**
 * Sort properties by parsed price value.
 * Properties without a parseable price are pushed to the end.
 *
 * @param {object[]} properties
 * @param {'asc'|'desc'} direction
 * @returns {object[]}
 */
function sortByPrice(properties = [], direction = 'asc') {
  return [...properties].sort((a, b) => {
    const pA = parsePropertyPrice(a)?.value ?? null;
    const pB = parsePropertyPrice(b)?.value ?? null;

    // Null values go to end regardless of sort direction
    if (pA === null && pB === null) return 0;
    if (pA === null) return 1;
    if (pB === null) return -1;

    return direction === 'asc' ? pA - pB : pB - pA;
  });
}

function isRecommendationRequest(message = '') {
  const text = normalizeText(message);
  return [
    'saran', 'rekomendasi', 'recommend', 'pilihan', 'opsi', 'ada apa', 'apa saja',
    'langsung', 'bingung', 'tolong berikan', 'cari', 'mau', 'butuh', 'need', 'find',
    'hotel di', 'rumah di', 'villa di', 'apartemen di', 'kos di'
  ].some((keyword) => text.includes(keyword));
}

function mergePropertyCatalog(dbProperties = []) {
  const source = [...dbProperties, ...fallbackProperties];
  const seen = new Set();
  const merged = [];

  source.forEach((property) => {
    const key = [property.title, property.city || property.location, property.buildingType, property.transactionType, property.price]
      .map((value) => String(value || '').toLowerCase().trim())
      .join('|');
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(property);
    }
  });

  return merged;
}

async function getSourceProperties() {
  // JSON catalog is the single source for portfolio and chatbot recommendations.
  // No database or dummy generator is used here.
  return loadJsonProperties();
}

function parsePropertyPrice(property = {}) {
  const text = normalizeText(property.price);
  const value = parseNumberToken(text);
  const period = /tahun|year|annual|\/tahun/.test(text)
    ? 'year'
    : /bulan|month|monthly|\/bulan/.test(text)
      ? 'month'
      : /malam|night|daily|hari|harian|\/malam/.test(text)
        ? 'night'
        : '';

  if (!value) return { value: null, period, annualValue: null };
  const annualValue = period === 'year' ? value : period === 'month' ? value * 12 : null;
  return { value, period, annualValue };
}

function budgetMatches(property = {}, budget = null) {
  if (!budget || (!budget.min && !budget.max)) return true;
  const parsed = parsePropertyPrice(property);
  if (!parsed.value) return true;

  let comparable = parsed.value;
  if (budget.period === 'year') comparable = parsed.annualValue;
  if (budget.period === 'month' && parsed.period === 'year') comparable = Math.round(parsed.value / 12);
  if (budget.period === 'month' && parsed.period === 'month') comparable = parsed.value;
  if (budget.period === 'night' && parsed.period === 'night') comparable = parsed.value;

  if (!comparable) return false;
  if (budget.min && comparable < budget.min) return false;
  if (budget.max && comparable > budget.max) return false;
  return true;
}

async function searchProperties(filters = {}) {
  const source = await getSourceProperties();
  return filterProperties(source, filters);
}

function filterProperties(properties, filters = {}) {
  const transactionType = normalizeText(filters.transactionType);
  const buildingType = normalizeText(filters.buildingType);
  const location = normalizeText(filters.location || filters.city);

  return properties.filter((property) => {
    const propertyText = [property.province, property.location, property.city, property.district, property.address].map(normalizeText).join(' ');
    const matchesTransaction = transactionType ? normalizeText(property.transactionType) === transactionType : true;
    const matchesBuilding = buildingType ? normalizeText(property.buildingType) === buildingType : true;
    const matchesLocation = location ? propertyText.includes(location) : true;
    const matchesBudget = budgetMatches(property, filters.budget);
    return matchesTransaction && matchesBuilding && matchesLocation && matchesBudget;
  });
}

function propertyMatchesCoreVisibleRequest(property = {}, filters = {}) {
  const buildingType = normalizeText(filters.buildingType);
  const location = normalizeText(filters.location || filters.city);
  const transactionType = normalizeText(filters.transactionType);

  const propertyText = [property.province, property.location, property.city, property.district, property.address]
    .map(normalizeText)
    .join(' ');

  const matchesBuilding = buildingType ? normalizeText(property.buildingType) === buildingType : true;
  const matchesLocation = location ? propertyText.includes(location) : true;
  const matchesTransaction = transactionType ? normalizeText(property.transactionType) === transactionType : true;

  return matchesBuilding && matchesLocation && matchesTransaction;
}

function getVisibleMatchesFromAlternatives(alternatives = [], filters = {}) {
  return (alternatives || []).filter((property) => propertyMatchesCoreVisibleRequest(property, filters));
}


/**
 * Cari properti dengan memperlebar range harga secara bertahap.
 *
 * Jika customer minta gudang di Semarang harga 8-15 jt tapi tidak ada:
 *   Tahap 1: coba 5-18 jt  (±35%)
 *   Tahap 2: coba 2-21 jt  (±70%)
 *   Tahap 3: tanpa limit harga (tipe + lokasi tetap dijaga)
 *
 * buildingType, transactionType, dan location TIDAK pernah dilonggarkan.
 *
 * @param {object[]} source  - Semua properti dari catalog
 * @param {object}   filters - Filters asli (harus punya filters.budget)
 * @returns {{ results: object[], expandedBudget: object|null, expansionStep: number }}
 */
function findWithExpandedBudget(source, filters) {
  const budget = filters.budget;
  if (!budget || (!budget.min && !budget.max)) {
    return { results: [], expandedBudget: null, expansionStep: 0 };
  }

  const min = budget.min || 0;
  const max = budget.max || 0;

  const expansions = [
    // Step 1: ±35%
    { min: min ? Math.round(min * 0.65) : null, max: max ? Math.round(max * 1.35) : null, step: 1 },
    // Step 2: ±70%
    { min: min ? Math.round(min * 0.30) : null, max: max ? Math.round(max * 1.70) : null, step: 2 },
    // Step 3: tanpa limit budget (tipe + lokasi tetap dijaga)
    { min: null, max: null, step: 3 },
  ];

  for (const { min: newMin, max: newMax, step } of expansions) {
    const results = filterProperties(source, {
      buildingType   : filters.buildingType,
      transactionType: filters.transactionType,
      location       : filters.location,
      budget         : (newMin || newMax) ? { ...budget, min: newMin, max: newMax } : null,
    });

    if (results.length > 0) {
      return {
        results,
        expandedBudget: { min: newMin, max: newMax, period: budget.period },
        expansionStep : step,
      };
    }
  }

  return { results: [], expandedBudget: null, expansionStep: 0 };
}

/**
 * Get alternative properties ketika tidak ada exact match.
 *
 * ATURAN STRICT TYPE MATCHING:
 *   Jika buildingType ditetapkan, alternatif HANYA dari tipe yang sama.
 *   Tidak pernah cross-type (misal: minta rumah → jangan tampil apartemen/gudang).
 *
 *   Urutan relaksasi (satu per satu, bukan sekaligus):
 *     1. Type + transaction + location (remove budget only)
 *     2. Type + transaction (remove location constraint)
 *     3. Type only (remove transaction constraint)
 *
 *   Jika customer eksplisit sebut fallback type (filters.fallbackTypes):
 *     Misal "hotel, kalau tidak ada villa saja"
 *     → Cari hotel dulu, jika tidak ada → cari villa
 *
 * @param {object} filters
 * @returns {Promise<object[]>}
 */
async function getAlternatives(filters = {}) {
  const source = await getSourceProperties();
  const seen   = new Set();
  const result = [];

  const add = (items = []) => {
    for (const item of items) {
      const key = item.id || item.title;
      if (!seen.has(key)) { seen.add(key); result.push(item); }
    }
  };

  const bt           = filters.buildingType;
  const tt           = filters.transactionType;
  const loc          = filters.location;
  const fallbackTypes = filters.fallbackTypes || [];

  // ── KASUS A: buildingType ditetapkan ────────────────────────────────────
  // Strict: HANYA tipe yang diminta + fallback eksplisit dari customer.
  if (bt) {
    // A1: Type + transaction + location (tanpa budget — relaksasi harga saja)
    add(filterProperties(source, { buildingType: bt, transactionType: tt, location: loc }));

    // A2: Type + transaction (relaksasi lokasi — masih kota / area lain)
    if (result.length < 4) {
      add(filterProperties(source, { buildingType: bt, transactionType: tt }));
    }

    // A3: Type only (relaksasi transaction juga — last resort)
    if (result.length < 4) {
      add(filterProperties(source, { buildingType: bt }));
    }

    // A4: Fallback types eksplisit dari customer ("kalau tidak ada rumah, apartemen juga boleh")
    if (result.length < 4 && fallbackTypes.length > 0) {
      for (const fbt of fallbackTypes) {
        add(filterProperties(source, { buildingType: fbt, transactionType: tt, location: loc }));
        if (result.length >= 8) break;
        add(filterProperties(source, { buildingType: fbt, transactionType: tt }));
        if (result.length >= 8) break;
      }
    }

    // Return HANYA tipe yang sesuai (tidak campuran dengan tipe lain)
    return result.slice(0, 8);
  }

  // ── KASUS B: tidak ada buildingType — lebih fleksibel ───────────────────
  if (tt || loc) {
    add(filterProperties(source, { transactionType: tt, location: loc }));
    add(filterProperties(source, { transactionType: tt }));
  }
  if (loc) {
    add(filterProperties(source, { location: loc }));
  }

  // Fallback types eksplisit (meski tanpa primary buildingType)
  if (fallbackTypes.length > 0) {
    for (const fbt of fallbackTypes) {
      add(filterProperties(source, { buildingType: fbt, transactionType: tt, location: loc }));
      add(filterProperties(source, { buildingType: fbt, transactionType: tt }));
    }
  }

  if (!result.length) add(source.slice(0, 8));
  return result.slice(0, 8);
}

function humanBuildingType(type = '') {
  const map = {
    hotel: 'hotel',
    villa: 'villa',
    house: 'rumah',
    apartment: 'apartemen',
    boarding_house: 'kos / boarding house',
    shophouse: 'ruko / shophouse',
    office: 'kantor / office',
    warehouse: 'gudang / warehouse',
    others: 'properti lainnya'
  };
  return map[type] || type || 'properti';
}

function humanTransactionType(type = '') {
  const map = {
    rent: 'sewa',
    sale: 'jual',
    purchase: 'beli'
  };
  return map[type] || type || 'tersedia';
}

function formatPropertyItem(item, index) {
  return {
    no: index + 1,
    title: item.title,
    location: `${item.location || item.city || '-'}${item.district ? `, ${item.district}` : ''}`,
    price: item.price || '-',
    buildingType: item.buildingType || '-',
    transactionType: item.transactionType || '-',
    buildingArea: item.buildingArea || '-',
    landArea: item.landArea || '-',
    address: item.address || '-',
    bedrooms: item.bedrooms || '-',
    bathrooms: item.bathrooms || '-',
    furnishedStatus: item.furnishedStatus || '-',
    facilities: item.facilities || '-',
    description: item.description || '-'
  };
}

function formatPropertyRecommendation(properties = [], options = {}) {
  if (!properties.length) return 'No matching property options are available.';
  const limit = options.limit || 6;
  return properties.slice(0, limit).map((item, index) => {
    const formatted = formatPropertyItem(item, index);
    return `${formatted.no}. ${formatted.title}\n   Location: ${formatted.location}\n   Price: ${formatted.price}\n   Type: ${humanBuildingType(formatted.buildingType)} - ${humanTransactionType(formatted.transactionType)}\n   Area: building ${formatted.buildingArea}, land ${formatted.landArea}\n   Address: ${formatted.address}\n   Facilities: ${formatted.facilities}`;
  }).join('\n\n');
}

function summarizeFilters(filters = {}) {
  return {
    requestedTransactionType: filters.transactionType || 'not specified',
    requestedBuildingType: filters.buildingType || 'not specified',
    requestedLocation: filters.location || 'not specified',
    requestedBudget: filters.budget ? {
      text: filters.budget.text,
      min: filters.budget.min,
      max: filters.budget.max,
      period: filters.budget.period || 'not specified'
    } : 'not specified',
    requestedFacilities: filters.facilities || []
  };
}

async function buildRecommendationContextForLLM(message = '', history = []) {
  const filters   = extractPropertyFilters(message, history);
  const priceSort = detectPriceSort(message);  // 'asc' | 'desc' | ''

  let exactMatches    = await searchProperties(filters);
  let budgetExpanded  = null;  // null = tidak ada ekspansi harga

  // ── Budget expansion: jika exact matches kosong karena budget terlalu ketat ─
  // Tetap jaga buildingType + location. Hanya budget yang dilonggarkan.
  if (!exactMatches.length && filters.budget) {
    const source = await getSourceProperties();

    // Cek apakah ada properti tipe+lokasi yang sama (tanpa constraint harga)
    const typeLocMatch = filterProperties(source, {
      buildingType   : filters.buildingType,
      transactionType: filters.transactionType,
      location       : filters.location,
    });

    if (typeLocMatch.length > 0) {
      // Ada properti yang cocok tipe+lokasi — coba ekspansi harga
      const expanded = findWithExpandedBudget(source, filters);
      if (expanded.results.length > 0) {
        exactMatches   = expanded.results;
        budgetExpanded = expanded.expandedBudget;
        console.log(`[PropertyRecommendation] Budget expanded (step ${expanded.expansionStep}):`, expanded.expandedBudget);
      }
    }
  }

  let alternatives = exactMatches.length ? [] : await getAlternatives(filters);

  // Safety correction:
  // Sometimes a previous conversation can make the strict filter too narrow.
  // If strict exactMatches is empty, but alternatives still match the visible
  // customer request (for example buildingType=house and location=Sidoarjo),
  // promote those alternatives into exactMatches so the AI does not say
  // "no exact match" while listing matching properties.
  if (!exactMatches.length && alternatives.length) {
    const visibleMatches = getVisibleMatchesFromAlternatives(alternatives, filters);
    if (visibleMatches.length) {
      exactMatches = visibleMatches;
      alternatives = alternatives.filter((item) => !visibleMatches.some((match) => (match.id || match.title) === (item.id || item.title)));
      console.warn('[PROPERTY MATCH CORRECTION]', {
        reason: 'Promoted visible matching alternatives into exactMatches.',
        visibleMatches: visibleMatches.length,
        filters
      });
    }
  }

  // ── Apply price sort when customer requests cheap / expensive ─────────────
  if (priceSort) {
    exactMatches = sortByPrice(exactMatches, priceSort);
    alternatives = sortByPrice(alternatives, priceSort);
  }

  const priceSortNote = priceSort === 'asc'
    ? '(Sorted by price: cheapest first — customer requested affordable/cheap options)'
    : priceSort === 'desc'
      ? '(Sorted by price: most expensive first — customer requested luxury/premium options)'
      : '';

  const budgetExpandNote = budgetExpanded
    ? `(NOTE: No properties found at original budget. Budget range was expanded to find the closest matches. Inform customer that exact budget is unavailable but present these as the nearest alternatives.)`
    : '';

  return {
    filters,
    exactMatches,
    alternatives,
    priceSort,
    budgetExpanded,
    contextText: [
      'PROPERTY SEARCH RESULT FROM BACKEND CATALOG',
      `Detected customer request: ${JSON.stringify(summarizeFilters(filters), null, 2)}`,
      priceSortNote,
      budgetExpandNote,
      '',
      exactMatches.length
        ? `Exact matching properties (${exactMatches.length}). The assistant must present these as available matching options and must NOT say there is no exact match:`
        : 'No exact match was found for the requested filters. The assistant must clearly say that no exact match is available before offering alternatives.',
      exactMatches.length ? formatPropertyRecommendation(exactMatches, { limit: 8 }) : '',
      '',
      alternatives.length ? `Alternative properties from backend catalog (${alternatives.length}):` : '',
      alternatives.length ? formatPropertyRecommendation(alternatives, { limit: 8 }) : '',
      '',
      'STRICT RESPONSE RULES FOR CHATGPT / CLAUDE / PRIVATE AGENT:',
      '- If Exact matching properties contains one or more items, do NOT say "no exact match", "tidak ada exact match", or similar wording.',
      '- The final answer must be created using this backend catalog context.',
      '- Do not recommend properties that are not listed in Exact matching properties or Alternative properties.',
      '- If exact matches exist, list exact matches first and do not show unrelated alternatives.',
      '- The latest customer message has priority over older history.',
      '- If the requested building type is house, do not recommend hotel unless no house alternatives are provided and you clearly explain it.',
      '- If the requested location is Surabaya, do not recommend Malang unless no Surabaya alternatives are provided and you clearly explain it.',
      '- If the customer asks for rental houses in Surabaya, do not recommend hotels in Malang.',
      '- If no exact match exists, apologize briefly and then present the closest alternatives.',
      '- If the customer gives a budget range, respect the budget when exact matches exist; otherwise explain if alternatives are outside the range.',
      '- After listing options, ask one short follow-up question only.'
    ].filter(Boolean).join('\n')
  };
}

module.exports = {
  fallbackProperties,
  mergePropertyCatalog,
  searchProperties,
  formatPropertyRecommendation,
  extractPropertyFilters,
  isRecommendationRequest,
  buildRecommendationContextForLLM,
  detectBuildingType,
  detectLocation,
  detectTransactionType,
  detectPriceSort,
  sortByPrice,
  detectFallbackTypes,
  findWithExpandedBudget,
  detectBudget,
  parsePropertyPrice,
  budgetMatches,
  propertyMatchesCoreVisibleRequest,
  getVisibleMatchesFromAlternatives
};

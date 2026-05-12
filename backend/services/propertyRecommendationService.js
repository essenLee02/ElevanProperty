const path = require('path');
const fs = require('fs');

const PROPERTY_TYPES = {
  hotel: ['hotel', 'hotels', 'penginapan'],
  villa: ['villa', 'vila'],
  house: ['rumah', 'house', 'home', 'kontrakan', 'residential'],
  apartment: ['apartemen', 'apartment', 'apart'],
  boarding_house: ['kos', 'kost', 'boarding house', 'boarding_house', 'indekos'],
  shophouse: ['ruko', 'shophouse', 'toko'],
  office: ['kantor', 'office'],
  warehouse: ['gudang', 'warehouse'],
  others: ['lainnya', 'others', 'other']
};

const TRANSACTION_TYPES = {
  rent: ['sewa', 'rent', 'rental', 'kontrak', 'menginap', 'harian', 'bulanan', 'tahunan', 'per tahun', 'per bulan'],
  sale: ['jual', 'sale', 'sell', 'dijual'],
  purchase: ['beli', 'buy', 'purchase', 'membeli']
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
// Reads indonesia_property_36_provinces_flat.json from the frontend public
// folder and normalises each record to the camelCase shape expected by the
// downstream filter / search functions.  The result is cached after first load.

const JSON_DATA_PATH = path.resolve(
  __dirname,
  '../../frontend/public/json_data/indonesia_property_36_provinces_flat.json'
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

  const singleMatch = text.match(/(?:budget|badget|harga|rp|idr|range|sekitar|maksimal|max)?\s*[:=]?\s*(rp\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:juta|jt|miliar|ribu|rb|million|billion)?)/i);
  if (singleMatch) {
    const value = parseNumberToken(`${singleMatch[2]} ${unit}`);
    return {
      text: singleMatch[0].trim(),
      min: null,
      max: value,
      period
    };
  }

  return null;
}

function extractFromHistory(history = []) {
  const recentUserMessages = (history || [])
    .filter((item) => item.role === 'user')
    .slice(-4)
    .map((item) => item.message)
    .join(' ');
  return extractSingleMessageFilters(recentUserMessages);
}

function extractSingleMessageFilters(message = '') {
  return {
    buildingType: detectBuildingType(message),
    transactionType: detectTransactionType(message),
    location: detectLocation(message),
    budget: detectBudget(message),
    facilities: detectFacilities(message)
  };
}

function extractPropertyFilters(message = '', history = []) {
  const current = extractSingleMessageFilters(message);
  const previous = extractFromHistory(history);

  // Current message must always win over history. This prevents old queries such as
  // "hotel in Malang" from contaminating a new request such as "rental house in Surabaya".
  return {
    buildingType: current.buildingType || previous.buildingType || '',
    transactionType: current.transactionType || previous.transactionType || '',
    location: current.location || previous.location || '',
    budget: current.budget || previous.budget || null,
    facilities: current.facilities?.length ? current.facilities : previous.facilities || []
  };
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

async function getAlternatives(filters = {}) {
  const source = await getSourceProperties();
  const alternatives = [];
  const seen = new Set();
  const add = (items = []) => {
    items.forEach((item) => {
      const key = item.id || item.title;
      if (!seen.has(key)) {
        seen.add(key);
        alternatives.push(item);
      }
    });
  };

  // Priority alternatives: keep the requested type and transaction first.
  if (filters.buildingType || filters.transactionType) {
    add(filterProperties(source, {
      buildingType: filters.buildingType,
      transactionType: filters.transactionType,
      budget: filters.budget
    }));
  }

  // Then keep requested location and transaction.
  if (filters.location || filters.transactionType) {
    add(filterProperties(source, {
      location: filters.location,
      transactionType: filters.transactionType,
      budget: filters.budget
    }));
  }

  // Then requested type regardless of budget/location.
  if (filters.buildingType) {
    add(filterProperties(source, {
      buildingType: filters.buildingType,
      transactionType: filters.transactionType
    }));
  }

  // Then requested location regardless of type/budget.
  if (filters.location) {
    add(filterProperties(source, {
      location: filters.location,
      transactionType: filters.transactionType
    }));
  }

  if (!alternatives.length) add(source.slice(0, 8));
  return alternatives.slice(0, 8);
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
  const filters = extractPropertyFilters(message, history);
  const exactMatches = await searchProperties(filters);
  const alternatives = exactMatches.length ? [] : await getAlternatives(filters);

  return {
    filters,
    exactMatches,
    alternatives,
    contextText: [
      'PROPERTY SEARCH RESULT FROM BACKEND CATALOG',
      `Detected customer request: ${JSON.stringify(summarizeFilters(filters), null, 2)}`,
      '',
      exactMatches.length
        ? `Exact matching properties (${exactMatches.length}). The assistant should prioritize these and should not show unrelated property types or locations:`
        : 'No exact match was found for the requested filters. The assistant must clearly say that no exact match is available before offering alternatives.',
      exactMatches.length ? formatPropertyRecommendation(exactMatches, { limit: 8 }) : '',
      '',
      alternatives.length ? `Alternative properties from backend catalog (${alternatives.length}):` : '',
      alternatives.length ? formatPropertyRecommendation(alternatives, { limit: 8 }) : '',
      '',
      'STRICT RESPONSE RULES FOR CHATGPT:',
      '- The final answer must be created by ChatGPT using this backend catalog context.',
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
  detectBudget,
  parsePropertyPrice,
  budgetMatches
};

const path = require('path');
const fs = require('fs');

// URUTAN PENTING: Tipe lebih spesifik harus dicek SEBELUM tipe yang lebih umum.
// Contoh masalah jika urutan salah:
//   'house' keyword matches "warehouse" (substring!)
//   'shop' keyword matches "shophouse" prefix
// Solusi: letakkan 'warehouse' dan 'shophouse' SEBELUM 'house'.
// URUTAN PENTING (lihat catatan di atas). Penambahan tipe 12-kategori:
//   - kondotel SEBELUM hotel & apartment ("condo hotel" ⊃ "hotel"; kondotel = apartemen+hotel)
//   - mansion  SEBELUM house ("rumah mewah" ⊃ "rumah")
//   - store    terpisah dari shophouse ('toko' dipindah ke store; ruko = bangunan, toko = unit retail)
const PROPERTY_TYPES = {
  kondotel      : ['kondotel', 'condotel', 'condo hotel', 'kondo hotel', 'condo'], // ← SEBELUM hotel/apartment
  hotel         : ['hotel', 'hotels', 'penginapan', 'motel'],
  villa         : ['villa', 'vila'],
  apartment     : ['apartemen', 'apartment', 'apart'],
  boarding_house: ['kos', 'kost', 'kosan', 'boarding house', 'boarding_house', 'indekos'],
  mansion       : ['mansion', 'rumah mewah'],        // ← SEBELUM house (rumah mewah ⊃ "rumah")
  warehouse     : ['gudang', 'warehouse'],           // ← SEBELUM house (warehouse ⊃ "house")
  shophouse     : ['ruko', 'shophouse', 'rukan'],    // ← SEBELUM house (shophouse ⊃ "house")
  store         : ['toko', 'store', 'retail', 'kios'],
  office        : ['kantor', 'office'],
  house         : ['rumah', 'house', 'home', 'kontrakan', 'residential'], // ← SETELAH warehouse/shophouse/mansion
  // NOTE: bare 'lainnya'/'other'/'others' removed — they false-match natural phrases
  // like "rumah makan lainnya" / "atau yang lainnya" and wrongly flip type → reset.
  // Use explicit "properti lainnya" instead.
  others        : ['properti lainnya', 'properti lain', 'other property', 'tanah', 'kavling', 'kaveling', 'lahan', 'spbu', 'pabrik']
};

// Tipe percakapan baru (mansion/kondotel/store) belum tentu ada di katalog JSON
// yang hanya berisi 8 tipe dasar. Saat pencarian katalog, petakan ke tipe dasar
// terdekat sebagai fallbackType otomatis agar listing tetap muncul:
//   mansion  → house     (rumah mewah dicari di antara rumah)
//   kondotel → apartment (unit kondotel mirip apartemen)
//   store    → shophouse (unit toko dicari di antara ruko/shophouse)
const CATALOG_TYPE_ALIAS = {
  mansion : 'house',
  kondotel: 'apartment',
  store   : 'shophouse'
};

const TRANSACTION_TYPES = {
  // Termasuk alias booking untuk hotel/villa/kondotel (master flow Q2: booking = sewa).
  rent: ['sewa', 'rent', 'rental', 'kontrak', 'menginap', 'nginap', 'booking', 'book', 'reservasi', 'harian', 'bulanan', 'tahunan', 'per tahun', 'per bulan', 'per malam', 'per minggu'],
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

/**
 * Strip "dekat/deket/near X" fragments so location anchors don't trigger
 * building-type detection. e.g. "deket kantor dan mall" → "dan mall"
 * → prevents false-positive office/warehouse type detection.
 */
function stripNearPhrases(text) {
  return text.replace(/\b(dekat|deket|near|di\s+dekat|di\s+sekitar|sekitar|samping|sebelah)\s+\S+/gi, '');
}

/**
 * Remove ambiguous "rumah X" phrases that are NOT a house ("rumah makan",
 * "rumah sakit", "rumah tangga", …). Without this, a customer saying they want to
 * be near a "rumah makan" (restaurant) gets mis-detected as building type house,
 * which then flips the type mid-flow and resets the whole qualification state.
 */
function stripAmbiguousRumah(text) {
  return text.replace(/\brumah\s+(makan|sakit|tangga|ibadah|duka|produksi|tahanan|kos|kost|susun|potong)\b/gi, '');
}

/**
 * Remove "use-case" phrases where a property is bought/rented to be USED AS another
 * type — e.g. a house bought "untuk dipakai kantor" / "digunakan sebagai kantor" /
 * "buat usaha" (software house, UMKM). The trailing type word there is a USE, not a
 * request to change the property type, so it must not trigger type detection (which
 * would flip house→office and reset the whole search). The established type is kept;
 * the commercial use is captured separately (see detectCommercialUse).
 */
const _USE_LEAD = '(?:untuk|buat|dipakai|dipake|digunakan|dijadikan|jadikan|jadiin|jadi|sebagai|bangun|dibangun|membangun|bikin|dibikin|dibuat|buka|membuka|dibuka)';
const _USE_TYPE = '(?:kantor|perkantoran|usaha|bisnis|umkm|startup|software\\s*house|softwarehouse|co[\\s-]?working|coworking|workshop|office|toko|ruko|gudang|warehouse|store|klinik|salon|cafe|kafe|resto|restoran|restaurant|warung|kos[\\s-]?kosan|kontrakan|kontrakkan|kost|kos|studio|ibadah|masjid|mushola|musholla|gereja|pura|vihara)';
function stripCommercialUsePhrases(text) {
  return text.replace(new RegExp(`\\b${_USE_LEAD}\\s+(?:${_USE_LEAD}\\s+)?${_USE_TYPE}\\b`, 'gi'), '');
}

/**
 * Detect that the customer intends to USE the property commercially (as an office /
 * business). Returns 'kantor' | 'usaha' | '' . Kept for backward compatibility.
 */
function detectCommercialUse(text = '') {
  const t = normalizeText(text);
  if (new RegExp(`\\b${_USE_LEAD}\\s+(?:${_USE_LEAD}\\s+)?(kantor|perkantoran|office|software\\s*house|softwarehouse|co[\\s-]?working|coworking|startup|workshop)\\b`, 'i').test(t))
    return 'kantor';
  if (new RegExp(`\\b${_USE_LEAD}\\s+(?:${_USE_LEAD}\\s+)?(usaha|bisnis|umkm|toko|ruko|store|klinik|salon)\\b`, 'i').test(t))
    return 'usaha';
  return '';
}

/**
 * Detect the property USE-CASE so the flow can decide whether the "who will live
 * there?" (occupants) question even applies. The occupants/bedrooms question is ONLY
 * relevant for residential own-living use. Returns one of:
 *   'ibadah'    — worship (masjid, gereja, mushola, pengajian, …)
 *   'investasi' — investment / rent-out / income (disewakan, warung, cafe, kos,
 *                 kontrakan, didiamkan sebagai aset, yield, ROI)
 *   'kantor'    — office / commercial (software house, UMKM, coworking, …)
 *   'usaha'     — other business (toko, salon, klinik, …)
 *   'liburan'   — vacation / temporary stay (liburan, dinas, staycation, honeymoon)
 *   ''          — unknown → assume residential
 */
function detectUseCase(text = '') {
  const t = normalizeText(text);
  if (/\b(ibadah|tempat\s+ibadah|rumah\s+ibadah|masjid|mushola|musholla|surau|langgar|gereja|kapel|pura|vihara|klenteng|kelenteng|sinagoga|pengajian|kebaktian|misa|sembahyang|rumah\s+doa|tpa|tpq|madrasah)\b/.test(t))
    return 'ibadah';
  if (/\b(investasi|investment|invest|disewakan|sewakan|disewain|dikontrakkan|dikontrakan|jualan|warung|kafe|cafe|resto|restoran|restaurant|kos[\s-]?kosan|bangun\s+kos|kontrakan|kontrakkan|didiamkan|didiemin|dibiarkan|aset|asset|yield|roi|capital\s+gain|passive\s+income|flipping|disewa\s*kan|usaha\s+sewa|rental\s+income)\b/.test(t))
    return 'investasi';
  const comm = detectCommercialUse(t);
  if (comm) return comm;
  if (/\b(liburan|berlibur|vacation|holiday|staycation|wisata|honeymoon|bulan\s+madu|dinas|perjalanan\s+dinas|business\s+trip|sementara|transit|short\s*stay|workation)\b/.test(t))
    return 'liburan';
  return '';
}

const _NON_RESIDENTIAL_USES = new Set(['ibadah', 'investasi', 'kantor', 'usaha']);
/** True when the property is NOT for own-living → skip the occupants question. */
function isNonResidentialUse(text = '') {
  return _NON_RESIDENTIAL_USES.has(detectUseCase(text));
}
/** Human-readable label for the use-case (for summaries). */
function useCaseLabel(use = '') {
  return ({
    ibadah   : 'Untuk ibadah (non-hunian)',
    investasi: 'Untuk investasi (non-hunian)',
    kantor   : 'Untuk kantor/usaha (non-hunian)',
    usaha    : 'Untuk usaha/komersial (non-hunian)',
    liburan  : 'Untuk liburan/menginap sementara',
  })[use] || '';
}

/**
 * Word-bounded keyword match.
 * Multi-word keywords (contain space) → simple substring (already unambiguous).
 * Single-word keywords → require word boundary so "kosongan" ≠ "kos",
 * "indomaret" ≠ "maret", etc.
 */
function matchesWordBounded(text, word) {
  if (word.includes(' ')) return text.includes(word);
  return new RegExp(`\\b${escapeRegExp(word)}\\b`).test(text);
}

function includesAnyWordBounded(text, words = []) {
  return words.some((word) => matchesWordBounded(text, word));
}

function detectBuildingType(message = '') {
  const text = normalizeText(message);
  // Strip "dekat X" anchors, ambiguous "rumah makan/…", AND commercial use-phrases
  // ("dipakai kantor", "buat usaha") so none pollutes building-type detection
  // (a restaurant anchor must not become house; a house used as office stays house).
  const textForType = stripCommercialUsePhrases(stripAmbiguousRumah(stripNearPhrases(text)));
  return Object.entries(PROPERTY_TYPES).find(([, keywords]) => includesAnyWordBounded(textForType, keywords))?.[0] || '';
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

// Kata yang sering muncul setelah "di" tapi BUKAN lokasi (patokan lantai/posisi/dll).
// Tanpa guard ini, "Di lantai 27" salah terbaca sebagai lokasi "lantai" dan
// menimpa kota yang sudah benar (mis. Surabaya) di akumulasi filter.
const NON_LOCATION_AFTER_DI = new RegExp(
  '^(lantai|lantainya|tower|menara|gedung|unit|kamar|lt|atas|bawah|tengah|pojok|sudut|' +
  'sini|sana|situ|dalam|luar|depan|belakang|samping|sebelah|tengahnya|mana|manapun|' +
  'mana[\\s-]*saja|mana[\\s-]*aja|sekitar|area)\\b', 'i'
);

function detectLocation(message = '') {
  const text = normalizeText(message);
  const found = getKnownLocations().find((location) => new RegExp(`\\b${escapeRegExp(location.toLowerCase())}\\b`, 'i').test(text));
  if (found) return found;

  const afterDi = text.match(/\bdi\s+([a-zA-Z\s]{3,35})/i);
  if (afterDi && afterDi[1]) {
    const candidate = afterDi[1].trim();
    if (NON_LOCATION_AFTER_DI.test(candidate)) return '';  // "di lantai 27" dst → bukan lokasi
    return cleanLocationCandidate(candidate);
  }

  return '';
}

// Facility keyword → customer-facing display label. Each entry: [label, [keywords...]].
// Ordered so the most distinctive amenities surface first in the summary.
const _FACILITY_MAP = [
  ['Kids zone',      ['kids zone', 'kids club', 'kid zone', 'kods zone', 'area bermain anak', 'playground', 'kidzone']],
  ['Gym',            ['gym', 'fitness', 'fitnes']],
  ['Yoga',           ['yoga', 'tempat yoga', 'studio yoga', 'ruang yoga']],
  ['Kolam renang',   ['kolam renang', 'swimming pool', 'pool', 'kolam']],
  ['Keamanan 24 jam',['security', 'keamanan 24', 'keamanan', 'satpam', 'cctv', '24 jam', 'one gate', 'one-gate']],
  ['AC',             ['ac', 'air conditioner']],
  ['WiFi',           ['wifi', 'wi-fi', 'internet']],
  ['Lift',           ['lift', 'elevator']],
  ['Parkir',         ['parkir', 'parking']],
  ['Carport',        ['carport']],
  ['Garasi',         ['garasi', 'garage']],
  ['Taman',          ['taman', 'garden']],
  ['Kitchen set',    ['kitchen set', 'kichen set', 'kitchenset', 'kitchen']],
  ['Dapur',          ['dapur', 'pantry']],
  // Perabot / elektronik (relevan utk sewa furnished/semi)
  ['Lemari',         ['lemari', 'wardrobe', 'closet']],
  ['Kasur',          ['kasur', 'tempat tidur', 'ranjang', 'spring bed', 'springbed', 'bed']],
  ['Kulkas',         ['kulkas', 'lemari es', 'fridge', 'refrigerator']],
  ['Mesin cuci',     ['mesin cuci', 'washing machine', 'washer']],
  ['TV',             ['tv', 'televisi', 'television']],
  ['Sofa',           ['sofa']],
  ['Kompor',         ['kompor', 'stove', 'cooktop']],
  ['Microwave',      ['microwave']],
  ['Dispenser',      ['dispenser', 'water dispenser']],
  ['Water heater',   ['water heater', 'pemanas air']],
  ['Balkon',         ['balkon', 'balcony']],
  ['Rooftop',        ['rooftop']],
  ['Jogging track',  ['jogging track', 'jogging']],
  ['Mushola',        ['mushola', 'musholla', 'masjid']],
  ['Concierge',      ['concierge']],
  ['Laundry',        ['laundry']],
];

function detectFacilities(message = '') {
  const text = normalizeText(message);
  const out = [];
  for (const [label, keywords] of _FACILITY_MAP) {
    // Word-boundary match so short tokens like "ac" don't match "macet"/"kapasitas".
    const hit = keywords.some((k) => {
      const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|\\W)${esc}(\\W|$)`, 'i').test(text);
    });
    if (hit) out.push(label);
  }
  return out;
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

// ─── Smart budget range parsing ─────────────────────────────────────────────
// Input formats supported:
//   Full IDR dot notation : 5.000.000 / 412.567.000 / 569.210.000 (dots = thousands sep)
//   Suffix units          : K/k, rb/ribu, jt/juta, m/miliar/milyar, t/triliun + EN aliases
//   Mixed                 : 569.210.000 - 5m / 678 jt - 900m / 5.000.000 - 412.567.000
// Output format: full Indonesian dot notation → "Rp 5.000.000 - Rp 412.567.000"
//
// Unit inference rules (when one side of a range has no suffix unit):
//   Only-right-has-unit (X - Yunit): loRaw <= hiRaw → same unit; loRaw > hiRaw → step down
//   Only-left-has-unit  (Xunit - Y): hiRaw >= loRaw → same unit; hiRaw < loRaw → step up
//   fullIDR + bare OR bare + fullIDR → ambiguous (ask customer)
//   Neither side has unit             → ambiguous (ask customer)

const _BUDGET_UNIT_MULT = {
  k: 1e3, rb: 1e3, ribu: 1e3, thousand: 1e3,
  jt: 1e6, juta: 1e6, million: 1e6,
  m: 1e9, miliar: 1e9, milyar: 1e9, billion: 1e9,
  t: 1e12, triliun: 1e12, trilion: 1e12, trillion: 1e12,
};
const _BUDGET_LEVELS = [1e3, 1e6, 1e9, 1e12];

function _budgetResolveMult(unitStr) {
  return unitStr ? (_BUDGET_UNIT_MULT[unitStr.toLowerCase()] || null) : null;
}
function _budgetStepUp(mult) {
  const i = _BUDGET_LEVELS.indexOf(mult);
  return i >= 0 && i < _BUDGET_LEVELS.length - 1 ? _BUDGET_LEVELS[i + 1] : null;
}
function _budgetStepDown(mult) {
  const i = _BUDGET_LEVELS.indexOf(mult);
  return i > 0 ? _BUDGET_LEVELS[i - 1] : null;
}

// Full IDR dot notation: 5.000.000, 412.567.000 (Indonesian thousands separator)
// Requires digit(s) followed by one or more groups of exactly ".NNN"
const _FULL_IDR_RE = /^\d{1,3}(?:\.\d{3})+$/;

// Parse a raw decimal coefficient ("1.3", "2,6", "900") — NOT full IDR
function _parseRawNum(s) {
  if (!s) return null;
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Tokenize one budget token.
//   Full IDR (5.000.000)  → { raw: 5000000, mult: 1,   isFullIDR: true  }
//   With unit (2.6juta)   → { raw: 2.6,     mult: 1e6, isFullIDR: false }
//   Bare (900)            → { raw: 900,      mult: null, isFullIDR: false }
const _BUDGET_TOKEN_RE = /^(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m|miliar|milyar|t|triliun|trilion|thousand|million|billion|trillion)?$/i;
function _tokenizeBudget(str) {
  const s = (str || '').trim();
  if (!s) return null;
  // Full IDR check MUST come before generic decimal to avoid "5.000" → 5.0
  if (_FULL_IDR_RE.test(s)) {
    const raw = parseInt(s.replace(/\./g, ''), 10);
    return Number.isFinite(raw) ? { raw, mult: 1, isFullIDR: true } : null;
  }
  const m = s.match(_BUDGET_TOKEN_RE);
  if (!m) return null;
  const raw = _parseRawNum(m[1]);
  if (raw === null) return null;
  return { raw, mult: _budgetResolveMult(m[2]), isFullIDR: false };
}

// Format resolved IDR value as full Indonesian dot notation: "Rp 5.000.000"
function _formatRpFull(n) {
  if (!n || !Number.isFinite(n)) return null;
  return `Rp ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

// Regex building blocks
const _FULL_IDR_PAT = '\\d{1,3}(?:\\.\\d{3})+';
const _BU = 'k|rb|ribu|jt|juta|m|miliar|milyar|t|triliun|trilion|thousand|million|billion|trillion';
const _DEC_UNIT_PAT = `\\d+(?:[.,]\\d+)?\\s*(?:(?:${_BU})(?![a-z]))?`;
const _RANGE_TOKEN = `(?:${_FULL_IDR_PAT}|${_DEC_UNIT_PAT})`;
const _BUDGET_RANGE_RE = new RegExp(
  `(${_RANGE_TOKEN})\\s*(?:-|sampai|sd|s\\/d|to|hingga)\\s*(${_RANGE_TOKEN})`,
  'i'
);

function detectBudget(message = '') {
  // Strip currency markers that sit directly before a number ("rp1.4", "rp 3.5",
  // "idr 5jt"). Without this, a ranged answer like "Rp1.4 - Rp 3.5 juta" breaks the
  // range regex (the inner "rp" isn't part of a number token) and only the max value
  // gets captured → the budget question loops. Removing the marker leaves clean
  // "1.4 - 3.5 juta" which parses as a proper range.
  const text = normalizeText(message).replace(/\b(?:rp|idr)\s*(?=\d)/gi, '');

  const period = /tahun|year|annual|per tahun|\/tahun/.test(text) ? 'year'
    : /bulan|month|monthly|per bulan|\/bulan/.test(text) ? 'month'
    : /malam|night|daily|hari|harian|\/malam/.test(text) ? 'night'
    : /minggu|week|weekly|per minggu|\/minggu|seminggu/.test(text) ? 'week'
    : '';

  // Buang konteks LANTAI/TOWER sebelum parsing angka budget. Tanpa ini, jawaban Q12
  // "Antara lantai 15-20 aja" salah terbaca sebagai budget "15-20" dan menimpa budget
  // asli (mis. "1-1.6 juta"). Mencakup: "lantai 15", "lt 27", "tower 3", "floor 15-20",
  // "lantai 15 sampai 20", "lantai 15 - 20".
  const budgetText = text.replace(
    /\b(lantai|lt|tower|menara|floor|lvl|level)\s*\d+(?:\s*(?:-|–|sampai|s\/d|hingga|ke)\s*\d+)?/gi,
    ' '
  );

  // ── Range match ──────────────────────────────────────────────────────────
  const rangeMatch = budgetText.match(_BUDGET_RANGE_RE);
  if (rangeMatch) {
    const lo = _tokenizeBudget(rangeMatch[1]);
    const hi = _tokenizeBudget(rangeMatch[2]);
    if (lo && hi) {
      const loResolved = lo.mult !== null;
      const hiResolved = hi.mult !== null;
      let minVal, maxVal;

      if (!loResolved && !hiResolved) {
        // Neither side has unit → ask for clarification
        return { ambiguous: true, rawMin: lo.raw, rawMax: hi.raw, period, text: rangeMatch[0].trim() };
      } else if (loResolved && hiResolved) {
        // Both resolved — use as-is
        minVal = Math.round(lo.raw * lo.mult);
        maxVal = Math.round(hi.raw * hi.mult);
      } else if (!loResolved && hiResolved) {
        // Only right side resolved
        if (hi.isFullIDR) {
          return { ambiguous: true, rawMin: lo.raw, rawMax: hi.raw, period, text: rangeMatch[0].trim() };
        }
        const loMult = lo.raw <= hi.raw ? hi.mult : (_budgetStepDown(hi.mult) || hi.mult);
        minVal = Math.round(lo.raw * loMult);
        maxVal = Math.round(hi.raw * hi.mult);
      } else {
        // Only left side resolved
        if (lo.isFullIDR) {
          return { ambiguous: true, rawMin: lo.raw, rawMax: hi.raw, period, text: rangeMatch[0].trim() };
        }
        const hiMult = hi.raw >= lo.raw ? lo.mult : (_budgetStepUp(lo.mult) || lo.mult);
        minVal = Math.round(lo.raw * lo.mult);
        maxVal = Math.round(hi.raw * hiMult);
      }

      const [minFinal, maxFinal] = [Math.min(minVal, maxVal), Math.max(minVal, maxVal)];
      return {
        text   : `${_formatRpFull(minFinal)} - ${_formatRpFull(maxFinal)}`,
        min    : minFinal,
        max    : maxFinal,
        period,
      };
    }
  }

  // ── Single value: explicit budget prefix ─────────────────────────────────
  const _STOK = `(?:${_FULL_IDR_PAT}|\\d+(?:[.,]\\d+)?\\s*(?:${_BU})?)`;
  const prefixedMatch = budgetText.match(
    new RegExp(`(?:budget|badget|harga|rp|idr|range|sekitar|maksimal|max)\\s*[:=]?\\s*(?:rp\\s*)?(${_STOK})`, 'i')
  );
  if (prefixedMatch) {
    const tok = _tokenizeBudget(prefixedMatch[1]);
    if (tok && tok.mult) {
      const value = Math.round(tok.raw * tok.mult);
      return { text: _formatRpFull(value), min: null, max: value, period };
    }
  }

  // ── Single value: monetary unit required (prevents matching bare dates/counts) ──
  // The (?![a-z]) after the unit stops "2 kali" → "2 k", "3 kamar" → "3 k",
  // "10 menit" → "10 m" etc. from being mis-read as a currency amount.
  const unitReqMatch = budgetText.match(
    new RegExp(`(?:rp\\s*)?(${_FULL_IDR_PAT}|\\d+(?:[.,]\\d+)?\\s*(?:${_BU})(?![a-z]))`, 'i')
  );
  if (unitReqMatch) {
    const tok = _tokenizeBudget(unitReqMatch[1]);
    if (tok && tok.mult) {
      const value = Math.round(tok.raw * tok.mult);
      return { text: _formatRpFull(value), min: null, max: value, period };
    }
  }

  // ── Affordable preference (no number) ────────────────────────────────────
  const affordableWords = [
    'terjangkau', 'murah', 'termurah', 'hemat', 'ekonomis', 'low budget',
    'affordable', 'cheap', 'cheapest', 'economy', 'low cost', 'low price',
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
//   fonnteChatController / kirimiChatController / timelinesAIChatController → 'customer'
//   sessionService.saveUserMessage (website chatbot)               → 'user'
// Keduanya harus diikutsertakan dalam ekstraksi history.
const CUSTOMER_ROLES = new Set(['user', 'customer']);
const AI_ROLES       = new Set(['assistant', 'ai']);

function extractFromHistory(history = []) {
  // Window harus cukup besar untuk menampung SATU sesi kualifikasi penuh (Q1–Q12 +
  // Q14). Sebelumnya .slice(-8) terlalu kecil: pada percakapan ≥9 pesan, pesan
  // pembuka yang membawa tipe/transaksi/lokasi/budget bisa keluar dari window,
  // sehingga gate keliru menganggap semua field kosong dan mengulang pertanyaan
  // pembuka di akhir alur. History sudah dibatasi ~24 pesan oleh pemanggil; di sini
  // kita pakai 24 pesan customer terakhir (deteksi ganti-tipe per-pesan tetap jalan
  // di loop untuk mencegah warisan dari pencarian lama).
  const recentUserMsgs = (history || [])
    .filter((item) => CUSTOMER_ROLES.has(item.role))
    .slice(-24);

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
      accumulated.facilities      = [];  // fasilitas pencarian lama tidak diwarisi
    }

    if (h.buildingType)          accumulated.buildingType    = h.buildingType;
    if (h.transactionType)       accumulated.transactionType = h.transactionType;
    if (h.location)              accumulated.location        = h.location;
    if (h.budget)                accumulated.budget          = h.budget;
    // Fasilitas AKUMULATIF (union) — customer bisa menyebut "kolam renang, gym"
    // di satu pesan dan "dapur lengkap" di pesan lain; semuanya diinginkan.
    // Sebelumnya pakai '=' sehingga pesan terakhir menimpa yang sebelumnya
    // (mis. "Dapur" menghapus "Kolam renang, Gym" → summary tidak lengkap).
    if (h.facilities?.length)    accumulated.facilities      = [...new Set([...accumulated.facilities, ...h.facilities])];
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

/**
 * Gabungkan budget current vs accumulated dengan PRIORITAS pada budget yang RESOLVED.
 * Mencegah jawaban kemudian yang ambigu/tanpa unit (mis. "15-20" dari "lantai 15-20",
 * atau angka telanjang) MENIMPA budget asli yang sudah jelas ("Rp 1jt - Rp 1.6jt").
 *
 * Aturan:
 *  - current resolved (punya min/max & tidak ambiguous)  → pakai current (budget baru sah).
 *  - current ambigu/null TAPI accumulated resolved        → pertahankan accumulated.
 *  - selain itu                                           → current || accumulated || null.
 */
function _mergeBudget(current, accumulated) {
  const isResolved = (b) => !!b && !b.ambiguous && (b.min != null || b.max != null || b.preference === 'affordable');
  if (isResolved(current)) return current;
  if (isResolved(accumulated) && (!current || current.ambiguous)) return accumulated;
  return current || accumulated || null;
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

  const merged = {
    buildingType:   current.buildingType    || accumulated.buildingType    || '',
    transactionType:current.transactionType || (typeChangedToNew ? '' : accumulated.transactionType) || '',
    location:       current.location        || accumulated.location        || '',
    budget:         _mergeBudget(current.budget, accumulated.budget),
    facilities:     current.facilities?.length ? current.facilities : accumulated.facilities || [],
    fallbackTypes:  current.fallbackTypes   || accumulated.fallbackTypes   || []
  };

  // Auto-alias tipe percakapan baru ke tipe dasar katalog. Tipe percakapan
  // (mansion/kondotel/store) tetap dipakai untuk Q14 + budget anchor di
  // controller, sedangkan alias-nya memastikan pencarian katalog tetap berisi.
  const catalogAlias = CATALOG_TYPE_ALIAS[merged.buildingType];
  if (catalogAlias && !merged.fallbackTypes.includes(catalogAlias)) {
    merged.fallbackTypes = [...merged.fallbackTypes, catalogAlias];
  }

  return merged;
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
    boarding_house: 'kos-kosan',
    shophouse: 'ruko',
    store: 'toko',
    mansion: 'mansion',
    kondotel: 'kondotel',
    office: 'kantor',
    warehouse: 'gudang',
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
  detectFacilities,
  stripCommercialUsePhrases,
  detectCommercialUse,
  detectUseCase,
  isNonResidentialUse,
  useCaseLabel,
  parsePropertyPrice,
  budgetMatches,
  propertyMatchesCoreVisibleRequest,
  getVisibleMatchesFromAlternatives
};

const { Op } = require('sequelize');
const { Property } = require('../models');

const PROPERTY_TYPES = {
  hotel: ['hotel', 'hotels', 'penginapan'],
  villa: ['villa', 'vila'],
  house: ['rumah', 'house', 'home', 'kontrakan', 'residential'],
  apartment: ['apartemen', 'apartment', 'apart'],
  boarding_house: ['kos', 'kost', 'boarding house', 'boarding_house', 'indekos']
};

const TRANSACTION_TYPES = {
  rent: ['sewa', 'rent', 'rental', 'kontrak', 'menginap', 'harian', 'bulanan', 'tahunan', 'per tahun', 'per bulan'],
  sale: ['jual', 'sale', 'sell', 'dijual'],
  purchase: ['beli', 'buy', 'purchase', 'membeli']
};

const KNOWN_LOCATIONS = [
  'Malang', 'Batu', 'Surabaya', 'Sidoarjo', 'Madiun', 'Semarang', 'Yogyakarta', 'Bandung',
  'Jakarta', 'Bogor', 'Depok', 'Tangerang', 'Bekasi', 'Solo', 'Papua', 'Jayapura', 'Bali', 'Denpasar'
];

const baseProperties = [
  {
    title: 'Surabaya Rungkut Furnished House',
    description: 'Budget furnished rental house in Surabaya with AC and Wi-Fi, suitable for small families or staff accommodation.',
    price: 'Rp 8.500.000 / tahun',
    location: 'Surabaya',
    city: 'Surabaya',
    district: 'Rungkut',
    address: 'Jl. Rungkut Asri, Surabaya',
    buildingArea: '72 m²',
    landArea: '90 m²',
    bedrooms: 2,
    bathrooms: 1,
    floors: 1,
    parking: '1 car',
    garden: 'Small front yard',
    buildingType: 'house',
    transactionType: 'rent',
    facilities: 'Full furnished, AC, Wi-Fi, Kitchen set, Parking',
    furnishedStatus: 'Furnished',
    style: 'Simple modern',
    imageUrl: '/assets/images/blog/1.jpg',
    status: 'available'
  },
  {
    title: 'Surabaya Wonokromo Compact House',
    description: 'Compact yearly rental house in Surabaya, suitable for customers who need affordable access to central areas.',
    price: 'Rp 9.750.000 / tahun',
    location: 'Surabaya',
    city: 'Surabaya',
    district: 'Wonokromo',
    address: 'Jl. Wonokromo, Surabaya',
    buildingArea: '80 m²',
    landArea: '100 m²',
    bedrooms: 3,
    bathrooms: 1,
    floors: 1,
    parking: '1 car',
    garden: 'Not included',
    buildingType: 'house',
    transactionType: 'rent',
    facilities: 'Full furnished, AC, Wi-Fi, Parking, Security',
    furnishedStatus: 'Furnished',
    style: 'Family compact',
    imageUrl: '/assets/images/blog/2.jpg',
    status: 'available'
  },
  {
    title: 'Surabaya Mulyorejo Family House',
    description: 'Family rental house in Surabaya with larger space and residential neighborhood access.',
    price: 'Rp 18.000.000 / tahun',
    location: 'Surabaya',
    city: 'Surabaya',
    district: 'Mulyorejo',
    address: 'Jl. Mulyorejo Indah, Surabaya',
    buildingArea: '120 m²',
    landArea: '150 m²',
    bedrooms: 3,
    bathrooms: 2,
    floors: 2,
    parking: '1 car',
    garden: 'Available',
    buildingType: 'house',
    transactionType: 'rent',
    facilities: 'AC, Wi-Fi, Kitchen set, Parking, Garden',
    furnishedStatus: 'Semi furnished',
    style: 'Modern family',
    imageUrl: '/assets/images/blog/3.jpg',
    status: 'available'
  },
  {
    title: 'Jakarta Cibubur Furnished House',
    description: 'Yearly rental house in Jakarta area with furnished rooms, AC, and Wi-Fi.',
    price: 'Rp 9.500.000 / tahun',
    location: 'Jakarta',
    city: 'Jakarta',
    district: 'Cibubur',
    address: 'Jl. Cibubur Residence, Jakarta',
    buildingArea: '78 m²',
    landArea: '96 m²',
    bedrooms: 2,
    bathrooms: 1,
    floors: 1,
    parking: '1 car',
    garden: 'Small yard',
    buildingType: 'house',
    transactionType: 'rent',
    facilities: 'Full furnished, AC, Wi-Fi, Kitchen set, Parking',
    furnishedStatus: 'Furnished',
    style: 'Simple modern',
    imageUrl: '/assets/images/blog/1.jpg',
    status: 'available'
  },
  {
    title: 'Malang City Center Business Hotel',
    description: 'A practical hotel option near central Malang, suitable for business trips, family stays, and short rental needs.',
    price: 'Rp 450.000 / malam',
    location: 'Malang',
    city: 'Malang',
    district: 'Klojen',
    address: 'Jl. Basuki Rahmat, Klojen, Malang',
    buildingArea: '1.250 m²',
    landArea: '1.600 m²',
    bedrooms: 42,
    bathrooms: 42,
    floors: 5,
    parking: 'Available',
    garden: 'Not included',
    buildingType: 'hotel',
    transactionType: 'rent',
    facilities: 'AC, Wi-Fi, Parking, Security, Restaurant, Meeting room',
    furnishedStatus: 'Furnished',
    style: 'Modern',
    imageUrl: '/assets/images/blog/1.jpg',
    status: 'available'
  },
  {
    title: 'Malang Family Boutique Hotel',
    description: 'Comfortable boutique hotel in Malang with AC, Wi-Fi, and family-friendly room options.',
    price: 'Rp 650.000 / malam',
    location: 'Malang',
    city: 'Malang',
    district: 'Lowokwaru',
    address: 'Jl. Soekarno Hatta, Lowokwaru, Malang',
    buildingArea: '980 m²',
    landArea: '1.250 m²',
    bedrooms: 28,
    bathrooms: 28,
    floors: 4,
    parking: 'Available',
    garden: 'Small garden',
    buildingType: 'hotel',
    transactionType: 'rent',
    facilities: 'AC, Wi-Fi, Parking, Security, Breakfast area',
    furnishedStatus: 'Furnished',
    style: 'Modern tropical',
    imageUrl: '/assets/images/blog/2.jpg',
    status: 'available'
  },
  {
    title: 'Malang Syariah Budget Hotel',
    description: 'Affordable hotel option in Malang for customers who need simple rooms with AC and Wi-Fi.',
    price: 'Rp 275.000 / malam',
    location: 'Malang',
    city: 'Malang',
    district: 'Blimbing',
    address: 'Jl. Borobudur, Blimbing, Malang',
    buildingArea: '720 m²',
    landArea: '900 m²',
    bedrooms: 24,
    bathrooms: 24,
    floors: 3,
    parking: 'Limited',
    garden: 'Not included',
    buildingType: 'hotel',
    transactionType: 'rent',
    facilities: 'AC, Wi-Fi, Parking, Security',
    furnishedStatus: 'Furnished',
    style: 'Simple modern',
    imageUrl: '/assets/images/blog/3.jpg',
    status: 'available'
  },
  {
    title: 'Malang Ijen Residential House',
    description: 'Residential house in Malang suitable for family rental with spacious living area and parking.',
    price: 'Rp 55.000.000 / tahun',
    location: 'Malang',
    city: 'Malang',
    district: 'Ijen',
    address: 'Jl. Ijen Boulevard, Malang',
    buildingArea: '180 m²',
    landArea: '240 m²',
    bedrooms: 4,
    bathrooms: 3,
    floors: 2,
    parking: '2 cars',
    garden: 'Available',
    buildingType: 'house',
    transactionType: 'rent',
    facilities: 'AC, Parking, Kitchen set, Security, Garden',
    furnishedStatus: 'Semi furnished',
    style: 'Classic modern',
    imageUrl: '/assets/images/blog/2.jpg',
    status: 'available'
  },
  {
    title: 'Malang Lowokwaru Student Boarding House',
    description: 'Boarding house near campus area in Malang with simple furnished rooms and Wi-Fi.',
    price: 'Rp 1.500.000 / bulan',
    location: 'Malang',
    city: 'Malang',
    district: 'Lowokwaru',
    address: 'Jl. Sigura-gura, Lowokwaru, Malang',
    buildingArea: '420 m²',
    landArea: '520 m²',
    bedrooms: 18,
    bathrooms: 10,
    floors: 2,
    parking: 'Motorcycle parking',
    garden: 'Not included',
    buildingType: 'boarding_house',
    transactionType: 'rent',
    facilities: 'Wi-Fi, Bed, Wardrobe, Shared kitchen, Parking',
    furnishedStatus: 'Furnished',
    style: 'Simple',
    imageUrl: '/assets/images/blog/1.jpg',
    status: 'available'
  },
  {
    title: 'Batu Mountain View Villa',
    description: 'Villa near Batu and Malang with cool weather, mountain view, AC, Wi-Fi, and private parking.',
    price: 'Rp 1.800.000 / malam',
    location: 'Batu',
    city: 'Batu',
    district: 'Oro-Oro Ombo',
    address: 'Jl. Oro-Oro Ombo, Batu',
    buildingArea: '220 m²',
    landArea: '320 m²',
    bedrooms: 4,
    bathrooms: 3,
    floors: 2,
    parking: '2 cars',
    garden: 'Available',
    buildingType: 'villa',
    transactionType: 'rent',
    facilities: 'AC, Wi-Fi, Kitchen set, Parking, Water heater, Garden',
    furnishedStatus: 'Furnished',
    style: 'Modern mountain villa',
    imageUrl: '/assets/images/blog/3.jpg',
    status: 'available'
  },
  {
    title: 'Surabaya Business Hotel Darmo',
    description: 'Business hotel in Surabaya for rental and corporate accommodation needs.',
    price: 'Rp 600.000 / malam',
    location: 'Surabaya',
    city: 'Surabaya',
    district: 'Darmo',
    address: 'Jl. Darmo, Surabaya',
    buildingArea: '1.500 m²',
    landArea: '1.900 m²',
    bedrooms: 48,
    bathrooms: 48,
    floors: 6,
    parking: 'Available',
    garden: 'Not included',
    buildingType: 'hotel',
    transactionType: 'rent',
    facilities: 'AC, Wi-Fi, Parking, Security, Meeting room',
    furnishedStatus: 'Furnished',
    style: 'Business modern',
    imageUrl: '/assets/images/blog/1.jpg',
    status: 'available'
  },
  {
    title: 'Papua Jayapura Transit Hotel',
    description: 'Transit hotel option in Jayapura, Papua, suitable for business travelers and short stays.',
    price: 'Rp 520.000 / malam',
    location: 'Papua',
    city: 'Jayapura',
    district: 'Jayapura Selatan',
    address: 'Jl. Raya Entrop, Jayapura, Papua',
    buildingArea: '1.100 m²',
    landArea: '1.450 m²',
    bedrooms: 36,
    bathrooms: 36,
    floors: 4,
    parking: 'Available',
    garden: 'Not included',
    buildingType: 'hotel',
    transactionType: 'rent',
    facilities: 'AC, Wi-Fi, Parking, Security, Airport access',
    furnishedStatus: 'Furnished',
    style: 'Modern',
    imageUrl: '/assets/images/blog/2.jpg',
    status: 'available'
  }
];

const generatedProperties = Array.from({ length: 30 }, (_, index) => {
  const buildingTypes = ['villa', 'house', 'apartment', 'hotel', 'boarding_house'];
  const transactionTypes = ['sale', 'rent', 'purchase'];
  const cities = ['Surabaya', 'Malang', 'Sidoarjo', 'Batu', 'Madiun', 'Semarang', 'Yogyakarta', 'Bandung', 'Papua'];
  const buildingType = buildingTypes[index % buildingTypes.length];
  const transactionType = transactionTypes[index % transactionTypes.length];
  const city = cities[index % cities.length];
  const number = index + 20;

  return {
    id: number,
    title: `${city} ${buildingType.replace('_', ' ')} ${number}`,
    description: `Curated ${buildingType.replace('_', ' ')} option for ${transactionType} customers who need a reliable property in ${city}.`,
    price: transactionType === 'rent' ? `Rp ${(12 + (index % 20))} juta / bulan` : `Rp ${(650 + index * 85).toLocaleString('id-ID')} juta`,
    location: city,
    city,
    district: `District ${1 + (index % 5)}`,
    address: `Jl. Property ${number}, ${city}`,
    buildingArea: `${80 + index * 7} m²`,
    landArea: `${100 + index * 8} m²`,
    bedrooms: 2 + (index % 5),
    bathrooms: 1 + (index % 4),
    floors: 1 + (index % 3),
    parking: index % 2 === 0 ? 'Available' : 'Limited',
    garden: index % 3 === 0 ? 'Available' : 'Not included',
    buildingType,
    transactionType,
    facilities: ['AC', 'Parking', 'Security', index % 2 === 0 ? 'Wi-Fi' : 'Kitchen set'].join(', '),
    furnishedStatus: index % 2 === 0 ? 'Furnished' : 'Unfurnished',
    style: index % 2 === 0 ? 'Modern' : 'Classic',
    imageUrl: `/assets/images/blog/${(index % 3) + 1}.jpg`,
    status: 'available'
  };
});

const fallbackProperties = [...baseProperties, ...generatedProperties].map((property, index) => ({
  id: property.id || index + 1,
  ...property
}));

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function includesAny(text, words = []) {
  return words.some((word) => text.includes(word));
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
  const found = KNOWN_LOCATIONS.find((location) => new RegExp(`\\b${location.toLowerCase()}\\b`, 'i').test(text));
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
  try {
    const dbProperties = await Property.findAll({ where: { status: 'available' }, limit: 300 });
    return mergePropertyCatalog(dbProperties.map((p) => p.toJSON()));
  } catch (error) {
    return fallbackProperties;
  }
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
    const propertyText = [property.location, property.city, property.district, property.address].map(normalizeText).join(' ');
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
    boarding_house: 'kos / boarding house'
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

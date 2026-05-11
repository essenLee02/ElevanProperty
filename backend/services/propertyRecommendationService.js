const { Property } = require('../models');

const fallbackProperties = Array.from({ length: 40 }, (_, index) => {
  const buildingTypes = ['villa', 'house', 'apartment', 'hotel', 'boarding_house'];
  const transactionTypes = ['sale', 'rent', 'purchase'];
  const cities = ['Surabaya', 'Malang', 'Sidoarjo', 'Batu', 'Madiun', 'Semarang', 'Yogyakarta', 'Bandung'];
  const buildingType = buildingTypes[index % buildingTypes.length];
  const transactionType = transactionTypes[index % transactionTypes.length];
  const city = cities[index % cities.length];
  const number = index + 1;

  return {
    id: number,
    title: `${city} ${buildingType.replace('_', ' ')} ${number}`,
    description: `Curated ${buildingType.replace('_', ' ')} option for ${transactionType} customers who need a reliable property in ${city}.`,
    price: transactionType === 'rent' ? `Rp ${(8 + (index % 20))} juta / bulan` : `Rp ${(650 + index * 85).toLocaleString('id-ID')} juta`,
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

async function searchProperties(filters = {}) {
  try {
    const dbProperties = await Property.findAll({ where: { status: 'available' }, limit: 80 });
    const source = dbProperties.length ? dbProperties.map((p) => p.toJSON()) : fallbackProperties;
    return filterProperties(source, filters);
  } catch (error) {
    return filterProperties(fallbackProperties, filters);
  }
}

function filterProperties(properties, filters = {}) {
  const transactionType = String(filters.transactionType || '').toLowerCase();
  const buildingType = String(filters.buildingType || '').toLowerCase();
  const location = String(filters.location || filters.city || '').toLowerCase();

  return properties.filter((property) => {
    const matchesTransaction = transactionType ? String(property.transactionType).toLowerCase() === transactionType : true;
    const matchesBuilding = buildingType ? String(property.buildingType).toLowerCase() === buildingType : true;
    const matchesLocation = location ? String(property.location || property.city || '').toLowerCase().includes(location) : true;
    return matchesTransaction && matchesBuilding && matchesLocation;
  });
}

function rankProperties(properties) {
  return properties;
}

function getSimilarAlternatives(filters = {}) {
  return filterProperties(fallbackProperties, { buildingType: filters.buildingType }).slice(0, 5);
}

function formatPropertyRecommendation(properties = []) {
  if (!properties.length) return 'No matching property options are available yet.';
  return properties.slice(0, 5).map((item, index) => `${index + 1}. ${item.title} - ${item.location} - ${item.price} - ${item.buildingArea}`).join('\n');
}

module.exports = {
  fallbackProperties,
  searchProperties,
  rankProperties,
  getSimilarAlternatives,
  formatPropertyRecommendation
};

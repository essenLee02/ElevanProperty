'use strict';
/**
 * M204 (18 Sep 2026) — NAMA AREA / KAWASAN / LANDMARK → KOTA.
 *
 * Sim K3: "How far is Citraland from JIIPE by car?" tidak memuat satu pun nama kota,
 * jadi distanceEstimationService menyerah ("let me check"). Padahal Citraland = area
 * Surabaya (tabel locations) dan JIIPE = kawasan industri Gresik. Resolver ini
 * memetakan nama tempat ke kota yang dikenal utils/cityGeoData.js dari tiga sumber:
 *   1. kawasan industri / bandara / pelabuhan yang sering jadi patokan pekerja,
 *   2. tabel locations (location_type='area') lewat cache M146,
 *   3. peta landmark kurasi per kota (utils/locationLandmarks.js).
 * Fail-open: hanya nama yang dikenal yang dipetakan; urutan mengikuti posisi di teks.
 */

const PLACE_CITY_EXTRA = {
  'jiipe': 'gresik', 'kawasan industri gresik': 'gresik', 'kig': 'gresik', 'petrokimia': 'gresik', 'wilmar gresik': 'gresik',
  'sier': 'surabaya', 'rungkut industri': 'surabaya', 'pelabuhan tanjung perak': 'surabaya', 'tanjung perak': 'surabaya', 'teluk lamong': 'surabaya',
  'juanda': 'sidoarjo', 'bandara juanda': 'sidoarjo', 'ngoro industri': 'mojokerto', 'ngoro industrial park': 'mojokerto',
  'pier': 'pasuruan', 'kawasan industri pasuruan': 'pasuruan', 'bandara abdulrachman saleh': 'malang',
  'bandara soekarno hatta': 'tangerang', 'soekarno hatta airport': 'tangerang', 'jababeka': 'bekasi', 'mm2100': 'bekasi',
  'kiic': 'karawang', 'suryacipta': 'karawang', 'batamindo': 'batam',
};

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * @param {string} text pesan customer
 * @returns {{key:string,label:string,place:string}[]} kota (key CITY_GEO) per tempat, urut posisi
 */
function resolvePlacesToCities(text) {
  const { CITY_GEO, normalizeCityKey } = require('./cityGeoData');
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  const found = [];
  const push = (place, cityName) => {
    const key = normalizeCityKey(cityName);
    if (!key || !CITY_GEO[key]) return;
    const m = lower.match(new RegExp(`(?:^|[^a-z])(${escapeRe(place.toLowerCase())})(?![a-z])`));
    if (!m) return;
    const idx = m.index + m[0].length - m[1].length;
    if (found.some((f) => idx < f.idx + f.len && idx + place.length > f.idx)) return;
    found.push({ key, label: String(cityName).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), place: raw.substr(idx, place.length), idx, len: place.length });
  };
  for (const [place, city] of Object.entries(PLACE_CITY_EXTRA).sort((a, b) => b[0].length - a[0].length)) push(place, city);
  try {
    const { getAreaCityEntries } = require('../services/propertyRecommendationService');
    for (const [area, city] of getAreaCityEntries().sort((a, b) => b[0].length - a[0].length)) {
      if (area.length >= 4) push(area, city);
    }
  } catch (_) { /* cache belum siap — fail-open */ }
  try {
    const { LOCATION_LANDMARKS } = require('./locationLandmarks');
    for (const [city, marks] of Object.entries(LOCATION_LANDMARKS)) {
      for (const mark of marks) if (mark.length >= 4) push(mark, city);
    }
  } catch (_) { /* opsional */ }
  found.sort((a, b) => a.idx - b.idx);
  return found.map(({ key, label, place }) => ({ key, label, place }));
}

module.exports = { resolvePlacesToCities, PLACE_CITY_EXTRA };

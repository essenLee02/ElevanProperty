/**
 * cityGeoData.js — M130.
 *
 * Koordinat kota (lat/lng) + penugasan PULAU untuk kota-kota MAYOR Indonesia
 * — dipakai distanceEstimationService.js untuk menghitung jarak garis lurus
 * (haversine) dan menentukan apakah dua kota berada di pulau yang SAMA atau
 * BEDA (perlu penyeberangan).
 *
 * ⚠️ SENGAJA HANYA KOTA YANG DIYAKINI AKURAT — bukan daftar lengkap 650 kota
 * di tabel `cities`. Kota yang tidak ada di sini WAJIB dijawab "tidak bisa
 * dihitung, arahkan ke agent" oleh pemanggil — JANGAN PERNAH menebak
 * koordinat. Ini konsisten dengan keputusan sesi ini (lihat memory
 * property-schema-certificate-location-type.md): kuantitas tidak pernah
 * mengorbankan akurasi untuk data geografis yang dipakai customer.
 *
 * GOOGLE_ENABLED=false (keputusan pemilik proyek, sesi ini) — tabel statis
 * ini adalah SATU-SATUNYA sumber koordinat; TIDAK ADA geocoding live. Jarak
 * yang dihasilkan adalah estimasi GARIS LURUS kota-ke-kota, BUKAN jarak
 * jalan/alamat-ke-alamat sesungguhnya — selalu beri tahu customer ini
 * estimasi, bukan rute presisi.
 */
'use strict';

// name (lowercase, cocok dengan cities.name setelah di-lower) → { lat, lng, island }
const CITY_GEO = {
  // ── Jawa ──
  'jakarta pusat':   { lat: -6.1805, lng: 106.8284, island: 'jawa' },
  'jakarta utara':   { lat: -6.1214, lng: 106.7741, island: 'jawa' },
  'jakarta barat':   { lat: -6.1352, lng: 106.7595, island: 'jawa' },
  'jakarta selatan': { lat: -6.2615, lng: 106.8106, island: 'jawa' },
  'jakarta timur':   { lat: -6.2250, lng: 106.9004, island: 'jawa' },
  'jakarta':         { lat: -6.2088, lng: 106.8456, island: 'jawa' },
  'bogor':           { lat: -6.5971, lng: 106.8060, island: 'jawa' },
  'depok':           { lat: -6.4025, lng: 106.7942, island: 'jawa' },
  'tangerang':       { lat: -6.1783, lng: 106.6319, island: 'jawa' },
  'bekasi':          { lat: -6.2383, lng: 106.9756, island: 'jawa' },
  'bandung':         { lat: -6.9175, lng: 107.6191, island: 'jawa' },
  'cirebon':         { lat: -6.7063, lng: 108.5570, island: 'jawa' },
  'semarang':        { lat: -6.9667, lng: 110.4167, island: 'jawa' },
  'yogyakarta':      { lat: -7.7956, lng: 110.3695, island: 'jawa' },
  'surakarta':       { lat: -7.5755, lng: 110.8243, island: 'jawa' },
  'malang':          { lat: -7.9666, lng: 112.6326, island: 'jawa' },
  'surabaya':        { lat: -7.2575, lng: 112.7521, island: 'jawa' },
  'sidoarjo':        { lat: -7.4478, lng: 112.7183, island: 'jawa' },
  'gresik':          { lat: -7.1560, lng: 112.6522, island: 'jawa' },
  'banyuwangi':      { lat: -8.2192, lng: 114.3691, island: 'jawa' },
  'tegal':           { lat: -6.8694, lng: 109.1402, island: 'jawa' },
  'serang':          { lat: -6.1149, lng: 106.1503, island: 'jawa' },

  // ── Bali & Nusa Tenggara ──
  'denpasar':        { lat: -8.6705, lng: 115.2126, island: 'bali' },
  'mataram':         { lat: -8.5833, lng: 116.1167, island: 'lombok' },
  'kupang':          { lat: -10.1772, lng: 123.6070, island: 'timor' },

  // ── Sumatra ──
  'medan':           { lat: 3.5952, lng: 98.6722, island: 'sumatra' },
  'palembang':       { lat: -2.9761, lng: 104.7754, island: 'sumatra' },
  'banda aceh':      { lat: 5.5483, lng: 95.3238, island: 'sumatra' },
  'padang':          { lat: -0.9471, lng: 100.4172, island: 'sumatra' },
  'pekanbaru':       { lat: 0.5071, lng: 101.4478, island: 'sumatra' },
  'jambi':           { lat: -1.6101, lng: 103.6131, island: 'sumatra' },
  'bengkulu':        { lat: -3.7928, lng: 102.2608, island: 'sumatra' },
  'bandar lampung':  { lat: -5.4292, lng: 105.2610, island: 'sumatra' },
  'batam':           { lat: 1.0456, lng: 104.0305, island: 'batam' },

  // ── Kalimantan ──
  'balikpapan':      { lat: -1.2379, lng: 116.8529, island: 'kalimantan' },
  'pontianak':       { lat: -0.0263, lng: 109.3425, island: 'kalimantan' },
  'banjarmasin':     { lat: -3.3186, lng: 114.5944, island: 'kalimantan' },
  'samarinda':       { lat: -0.5022, lng: 117.1536, island: 'kalimantan' },

  // ── Sulawesi ──
  'makassar':        { lat: -5.1477, lng: 119.4327, island: 'sulawesi' },
  'manado':          { lat: 1.4748, lng: 124.8421, island: 'sulawesi' },
  'palu':            { lat: -0.8917, lng: 119.8707, island: 'sulawesi' },
  'kendari':         { lat: -3.9450, lng: 122.4989, island: 'sulawesi' },

  // ── Maluku & Papua ──
  'ambon':           { lat: -3.6954, lng: 128.1814, island: 'maluku' },
  'ternate':         { lat: 0.7833, lng: 127.3667, island: 'ternate' },
  'jayapura':        { lat: -2.5337, lng: 140.7181, island: 'papua' },
  'sorong':          { lat: -0.8762, lng: 131.2558, island: 'papua' },
  'manokwari':       { lat: -0.8615, lng: 134.0620, island: 'papua' },
  'merauke':         { lat: -8.4700, lng: 140.4000, island: 'papua' },
};

/** Rute penyeberangan MAYOR yang diyakini akurat (nama pelabuhan stabil,
 * bukan tebakan). Pulau A↔B → { from, to, note }. HANYA rute yang benar-benar
 * terkenal/stabil — pulau lain WAJIB diarahkan ke agent, bukan ditebak.
 */
const MAJOR_FERRY_ROUTES = [
  {
    islands: ['jawa', 'bali'],
    from: 'Pelabuhan Ketapang (Banyuwangi, Jawa)',
    to: 'Pelabuhan Gilimanuk (Bali)',
    crossingMinutes: 45,
    note: 'Penyeberangan tersibuk & terpendek Jawa-Bali, kapal reguler tiap ~30 menit.',
  },
  {
    islands: ['jawa', 'sumatra'],
    from: 'Pelabuhan Merak (Banten, Jawa)',
    to: 'Pelabuhan Bakauheni (Lampung, Sumatra)',
    crossingMinutes: 120,
    note: 'Penyeberangan utama Jawa-Sumatra, kapal reguler.',
  },
  {
    islands: ['bali', 'lombok'],
    from: 'Pelabuhan Padangbai (Bali)',
    to: 'Pelabuhan Lembar (Lombok)',
    crossingMinutes: 240,
    note: 'Penyeberangan utama Bali-Lombok.',
  },
];

function normalizeCityKey(name) {
  return String(name || '').trim().toLowerCase();
}

/** @returns {{lat:number,lng:number,island:string}|null} */
function getCityGeo(cityName) {
  return CITY_GEO[normalizeCityKey(cityName)] || null;
}

/** Cari rute feri mayor antara dua pulau (urutan tidak masalah), atau null bila tidak dikenal. */
function findMajorFerryRoute(islandA, islandB) {
  const a = String(islandA || '').toLowerCase();
  const b = String(islandB || '').toLowerCase();
  return MAJOR_FERRY_ROUTES.find((r) =>
    (r.islands[0] === a && r.islands[1] === b) || (r.islands[0] === b && r.islands[1] === a)
  ) || null;
}

module.exports = { CITY_GEO, MAJOR_FERRY_ROUTES, getCityGeo, findMajorFerryRoute, normalizeCityKey };

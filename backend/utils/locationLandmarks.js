/**
 * locationLandmarks.js
 *
 * Per-city landmark/kawasan reference used by chatbotPrivateController.js for:
 *   - Q2c: "Di area/kawasan mana di [kota]?" — gives city-relevant example areas
 *   - Q6:  "Ada patokan lokasi?" — gives city-relevant example landmarks
 *
 * Setiap kota di database `cities` bisa punya landmark/kawasan khasnya sendiri. Map ini
 * dipakai supaya AI bertanya contoh area yang RELEVAN untuk kota customer, bukan hanya
 * contoh generik ("pusat kota, area selatan") atau hardcode Surabaya-only.
 *
 * Key HARUS lowercase (dicocokkan via `loc.toLowerCase().includes(key)`).
 * Kota yang TIDAK ada di map ini tetap jalan normal — fallback ke contoh generik.
 */

const LOCATION_LANDMARKS = {
  // Jawa Timur
  'surabaya' : ['Pakuwon', 'Darmo', 'Rungkut', 'Gubeng', 'Tunjungan', 'Citraland', 'Manyar', 'Kertajaya', 'MERR', 'Wiyung', 'Wonokromo'],
  'malang'   : ['Soekarno Hatta', 'Ijen', 'Dinoyo', 'Lowokwaru', 'Suhat', 'UB', 'UM', 'Arjosari', 'Blimbing'],
  'batu'     : ['Jatim Park', 'Batu Night Spectacular', 'Selecta', 'Alun-Alun Batu', 'Songgoriti', 'Oro Oro Ombo'],
  'madiun'   : ['Pahlawan Street Center', 'Alun-Alun Madiun', 'Kartoharjo', 'Manguharjo', 'Mejayan'],
  'sidoarjo' : ['Gedangan', 'Waru', 'Buduran', 'Krian', 'Alun-Alun Sidoarjo'],
  'gresik'   : ['Kebomas', 'Manyar', 'GKB', 'Alun-Alun Gresik'],
  'kediri'   : ['Simpang Lima Gumul', 'Mojoroto', 'Pare'],
  'jember'   : ['Alun-Alun Jember', 'Sumbersari', 'Tanggul'],

  // DKI Jakarta & sekitar
  'jakarta'  : ['SCBD', 'Sudirman', 'Thamrin', 'Senayan', 'Kemang', 'Kelapa Gading', 'Pantai Indah Kapuk', 'Kuningan', 'Tebet', 'Menteng'],
  'bekasi'   : ['Grand Wisata', 'Summarecon Bekasi', 'Harapan Indah', 'Kemang Pratama', 'Jababeka'],
  'depok'    : ['Margonda', 'UI', 'Sawangan', 'Cinere', 'Cimanggis'],
  'bogor'    : ['Sentul City', 'Bogor Nirwana', 'Yasmin', 'Cibinong', 'Tajur'],
  'tangerang': ['BSD City', 'Alam Sutera', 'Gading Serpong', 'Bintaro', 'Serpong', 'Karawaci', 'Cikokol'],

  // Jawa Barat
  'bandung'  : ['Dago', 'Buah Batu', 'Antapani', 'Pasteur', 'Setiabudi', 'Ciumbuleuit', 'Kopo'],
  'cirebon'  : ['Alun-Alun Kejaksan', 'Kesambi', 'Plumbon'],

  // Jawa Tengah & DIY
  'semarang' : ['Banyumanik', 'Tembalang', 'Gajahmungkur', 'Simpang Lima', 'Candi'],
  'solo'     : ['Manahan', 'Solo Baru', 'Kartasura', 'Palur', 'Laweyan', 'Klewer'],
  'surakarta': ['Manahan', 'Solo Baru', 'Kartasura', 'Palur', 'Laweyan', 'Klewer'],
  'yogyakarta': ['Malioboro', 'UGM', 'Sleman', 'Kaliurang', 'Gejayan', 'Seturan', 'Bantul', 'Kotagede'],

  // Banten
  'serang'   : ['Cipocok', 'Ciruas', 'Kasemen', 'Alun-Alun Serang'],
  'lebak'    : ['Rangkasbitung', 'Sajira', 'Malingping', 'Sawarna'],
  'cilegon'  : ['Krakatau', 'Merak', 'Ciwandan', 'PCI'],

  // Bali & Nusa Tenggara
  'denpasar' : ['Sanur', 'Renon', 'Panjer', 'Sunset Road'],
  'badung'   : ['Kuta', 'Seminyak', 'Canggu', 'Nusa Dua', 'Jimbaran', 'Uluwatu'],
  'mataram'  : ['Cakranegara', 'Sekarbela', 'Ampenan'],

  // Sumatera
  'medan'    : ['Medan Baru', 'Medan Sunggal', 'Medan Petisah', 'Setiabudi Medan', 'Polonia'],
  'palembang': ['Ilir Barat', 'Ilir Timur', 'Jakabaring', 'Kemuning'],
  'jambi'    : ['Telanaipura', 'Mendalo', 'Paal Merah', 'Simpang Rimbo', 'Mayang'],
  'kerinci'  : ['Gunung Kerinci', 'Sungai Penuh', 'Kayu Aro'],
  'padang'   : ['Alun-Alun Padang', 'Pondok', 'Air Tawar'],
  'pekanbaru': ['Sudirman Pekanbaru', 'Panam', 'Rumbai'],
  'batam'    : ['Nagoya', 'Batam Center', 'Sekupang'],
  'bandar lampung': ['Rajabasa', 'Teluk Betung', 'Kemiling', 'Way Halim', 'Sukarame'],

  // Kalimantan
  'pontianak' : ['Alun-Alun Kapuas', 'Sungai Jawi', 'Siantan'],
  'banjarmasin': ['Sungai Jingah', 'Banjar Baru', 'Kuin'],
  'balikpapan': ['Klandasan', 'Sepinggan', 'Gunung Sari'],
  'samarinda' : ['Air Hitam', 'Sempaja', 'Karang Asam'],
  'amuntai'   : ['Alabio', 'Danau Panggang', 'Sungai Tabukan'],

  // Sulawesi
  'makassar' : ['Panakkukang', 'Tamalate', 'Rappocini'],
  'manado'   : ['Boulevard Manado', 'Malalayang', 'Tuminting'],
  'palu'     : ['Alun-Alun Palu', 'Tatura', 'Talise'],

  // Papua & Maluku (kota kecil sesuai contoh database)
  'agats'    : ['Pelabuhan Agats', 'Asmat', 'Bandara Ewer'],
  'aimas'    : ['Sorong Regency', 'Bandara DEO', 'Klamono'],
  'ambon'    : ['Alun-Alun Ambon', 'Batu Merah', 'Karang Panjang'],
  'jayapura' : ['Entrop', 'Abepura', 'Dok II'],
};

/**
 * Cari landmark/kawasan untuk sebuah kota (case-insensitive substring match).
 * Key terpanjang dicek lebih dulu agar "bandar lampung" tidak ke-shadow oleh
 * substring lain. Return null jika kota tidak ada di map (caller fallback ke
 * contoh generik "pusat kota, area selatan").
 *
 * @param {string} loc - nama kota/lokasi dari filters.location
 * @returns {string[]|null}
 */
function getCityLandmarks(loc) {
  if (!loc) return null;
  const lower = String(loc).toLowerCase();
  const keys = Object.keys(LOCATION_LANDMARKS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lower.includes(key)) return LOCATION_LANDMARKS[key];
  }
  return null;
}

module.exports = { LOCATION_LANDMARKS, getCityLandmarks };

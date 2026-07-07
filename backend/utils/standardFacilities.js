/**
 * standardFacilities.js
 *
 * Fasilitas STANDAR per tipe properti (hotel, villa, kos, house, dll.) —
 * satu sumber kebenaran, dipakai oleh:
 *   - chatbotPrivateController.js  → mengisi summary saat customer bilang "standar"
 *   - propertyRecommendationService → fallback rekomendasi saat katalog agent
 *     TIDAK menemukan data (perluas dengan fasilitas standar sesuai tipe).
 *
 * Basis: tabel "Fasilitas Standar per Tipe Properti" di skill docs
 * (16-facilities-reference.md). Untuk tipe hunian (house/apartment/villa/condo/
 * boarding_house/mansion), furnishing full/semi menambah perabot/elektronik.
 * Tipe komersial (ruko/kantor/gudang/toko) tidak bergantung furnishing.
 */

'use strict';

/**
 * @param {string} buildingType - key katalog (house, apartment, villa, hotel, …)
 * @param {string} [furnishing] - 'full' | 'semi' | '' (opsional; hanya untuk hunian)
 * @returns {string|null} daftar fasilitas dipisah koma, atau null bila tipe tak dikenal
 */
function getStandardFacilitiesByType(buildingType, furnishing = '') {
  const type = (buildingType || '').toLowerCase();
  const furn = (furnishing || '').toLowerCase();
  const isFull = /fully|full/.test(furn);
  const isSemi = /semi/.test(furn);

  if (type === 'house' || type === 'kontrakan') {
    const base = 'Kamar Tidur, Kamar Mandi, Listrik, Air, Dapur, Ruang Tamu, Carport/Garasi, One gate system';
    if (isFull) return `AC, Kitchen set, Lemari, Tempat Tidur, TV, Kulkas, CCTV, ${base}`;
    if (isSemi) return `AC, Kitchen set, Lemari, Kulkas, CCTV, ${base}`;
    return base;
  }
  if (type === 'apartment') {
    const base = 'Kamar Tidur, Kamar Mandi, AC, Dapur/Pantry, Listrik, Air, Lift, Keamanan 24 jam, Parkir';
    if (isFull) return `Kitchen set, Lemari, Tempat Tidur, TV, Kulkas, Microwave, ${base}`;
    if (isSemi) return `Kitchen set, Lemari, ${base}`;
    return base;
  }
  if (type === 'condo') {
    const base = 'Kamar Tidur, Kamar Mandi, AC, Dapur, WiFi, Parkir, Keamanan, Kolam renang/Gym';
    if (isFull) return `Kitchen set, Lemari, Tempat Tidur, TV, Kulkas, ${base}`;
    if (isSemi) return `Kitchen set, Lemari, ${base}`;
    return base;
  }
  if (type === 'boarding_house') {
    const base = 'Tempat Tidur, Lemari, Meja, Listrik, Air, WiFi, Kamar Mandi';
    if (isFull) return `AC, ${base}, Akses dapur`;
    if (isSemi) return `AC, ${base}`;
    return base;
  }
  if (type === 'villa') {
    const base = 'Kamar Tidur, Kamar Mandi, Peralatan Dapur, AC, WiFi, Ruang Keluarga, Parkir, Taman, CCTV, One gate system, Kolam renang';
    if (isFull) return `TV, Kulkas, Lemari, Tempat Tidur, ${base}`;
    if (isSemi) return `Kulkas, ${base}`;
    return base;
  }
  if (type === 'hotel' || type === 'kondotel') {
    return 'Tempat Tidur, Kamar Mandi, AC, TV, WiFi, Handuk, Perlengkapan mandi, Housekeeping, Resepsionis';
  }
  if (type === 'mansion') {
    return 'Banyak Kamar Tidur, Beberapa Kamar Mandi, Garasi, Taman, Ruang Keluarga Besar, Dapur, AC, Keamanan';
  }
  if (type === 'shophouse' || type === 'ruko') {
    return 'Bangunan Utama, Listrik, Air, Area Parkir, Toilet, Area Usaha';
  }
  if (type === 'office' || type === 'kantor') {
    return 'Ruang Kerja, Listrik, AC, Internet, Toilet, Parkir, Keamanan';
  }
  if (type === 'warehouse' || type === 'gudang') {
    return 'Area Gudang, Listrik, Air, Akses Kendaraan, Area Bongkar Muat, Keamanan';
  }
  if (type === 'store' || type === 'toko') {
    return 'Area Toko, Listrik, Lampu, Air, Toilet, Area Display';
  }
  return null;
}

module.exports = { getStandardFacilitiesByType };

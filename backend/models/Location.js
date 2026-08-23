const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model: locations
 *
 * Master data lokasi rujukan properti — TIGA kategori berbeda (M129), dibedakan
 * lewat `location_type`, karena masing-masing punya arti & penggunaan berbeda
 * di alur kualifikasi WhatsApp (aiPromptBuilderService.js):
 *
 *   'area'       — kawasan/kompleks yang jadi identitas lingkungan properti itu
 *                  sendiri (Citraland, Pakuwon, Wiyung, Dukuh Kupang, MERR).
 *                  Dipakai untuk Q2c ("Di area/kawasan mana di [kota]?").
 *                  SELALU terikat SATU kota tertentu — city_id WAJIB diisi.
 *   'landmark'   — tempat publik/rekreasi yang jadi PATOKAN LOKASI, bukan
 *                  identitas properti (Taman Bungkul, Kebun Binatang, Candi
 *                  Borobudur, pantai, tugu). Dipakai untuk Q6 ("Ada patokan
 *                  lokasi?"). Bisa terikat kota (city_id) atau generik lintas
 *                  kota (city_id null, mis. "Taman Kota" sebagai contoh umum).
 *   'commercial' — fasilitas komersial/publik di SEKITAR properti yang jadi
 *                  nilai jual, bukan patokan lokasi utama (RS, Alfamart,
 *                  Indomaret, sekolah, bank, terminal). Biasanya GENERIK
 *                  (city_id null) — nama toko/lembaga yang sama muncul di
 *                  banyak kota (mis. "INDOMARET"), kecuali untuk institusi
 *                  spesifik-kota (mis. "RS DR SOETOMO" → Surabaya).
 *
 * Default 'commercial' untuk baris LAMA (dibuat sebelum M129) — SEBAGIAN
 * BESAR data locations yang sudah ada memang institusi/toko generik, bukan
 * nama kawasan. Reklasifikasi tepat per baris adalah pekerjaan data terpisah
 * (lihat scripts/backfill-location-types.js), BUKAN dijamin akurat 100% hanya
 * dari default ini.
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 * FK created_by & updated_by → users.user_id
 */
const LOCATION_TYPES = ['area', 'landmark', 'commercial'];

const Location = sequelize.define('Location', {
  location_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Generated ID: prefix nama + random alphanumeric + count padded 3 digit'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Nama lokasi rujukan, mis. Pasar Besar, Kebun Binatang, Indomaret, Citraland. '
           + 'TIDAK LAGI unique global (M129) — sekarang unique per (name, city_id), lihat '
           + 'indexes di bawah, supaya nama area yang sama boleh muncul di kota berbeda.'
  },
  city_id: {
    type: DataTypes.STRING(30),
    allowNull: true,
    defaultValue: null,
    comment: 'FK ke cities.city_id. WAJIB diisi untuk location_type=area (kawasan selalu milik '
           + 'satu kota). Boleh NULL untuk landmark/commercial generik lintas kota (mis. '
           + '"Indomaret", "Taman Kota" sebagai contoh umum tanpa kota spesifik).'
  },
  location_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'commercial',
    comment: `area | landmark | commercial — lihat penjelasan di kepala berkas ini. Default `
           + `'commercial' untuk baris lama (M129).`
  },
  status: {
    type: DataTypes.INTEGER(1),
    allowNull: false,
    defaultValue: 1,
    comment: '1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)'
  },
  created_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Tanggal pembuatan data'
  },
  created_by: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'FK ke users.user_id — siapa yang membuat'
  },
  updated_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: null,
    comment: 'Tanggal update terakhir'
  },
  updated_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null,
    comment: 'FK ke users.user_id — siapa yang terakhir mengubah'
  }
}, {
  tableName: 'locations',
  timestamps: false,
  validate: {
    // M129: location_type=area WAJIB terikat kota (kawasan tidak masuk akal
    // tanpa kota) — landmark/commercial boleh generik (city_id null).
    areaRequiresCity() {
      if (this.location_type === 'area' && !this.city_id) {
        throw new Error('location_type="area" wajib mengisi city_id — kawasan selalu milik satu kota tertentu.');
      }
      if (this.location_type && !LOCATION_TYPES.includes(this.location_type)) {
        throw new Error(`location_type "${this.location_type}" tidak dikenal. Nilai yang sah: ${LOCATION_TYPES.join(', ')}.`);
      }
    },
  },
  indexes: [
    { fields: ['location_id'] },
    { fields: ['status'] },
    { fields: ['name'] },
    { fields: ['city_id'] },
    { fields: ['location_type'] },
    // Ganti unique lama (name saja, global) — sekarang per kota, supaya nama
    // area yang sama boleh dipakai ulang di kota berbeda (M129).
    { unique: true, fields: ['name', 'city_id'], name: 'uq_locations_name_city' },
  ]
});

Location.LOCATION_TYPES = LOCATION_TYPES;

module.exports = Location;

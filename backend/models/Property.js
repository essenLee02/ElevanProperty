const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model: properties  (HEADER master property)
 *
 * Header dari sebuah listing properti. Detail gambar disimpan di tabel
 * property_images, dan fasilitas di property_facilities (relasi 1-ke-banyak).
 *
 * Region hierarchy: country_id → province_id → city_id (FK informasional ke
 * countries/provinces/cities, mengikuti pola City.js).
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 * FK created_by & updated_by → users.user_id
 */
/**
 * M129: sertifikat yang boleh diisi TERGANTUNG transaction_type.
 *   Rent (sewa) → sertifikat kepemilikan tidak relevan bagi penyewa: hanya
 *     KOSONG/LAINNYA (atau null) yang masuk akal.
 *   Sale (beli) → tiga sertifikat kepemilikan resmi Indonesia ditambahkan:
 *     SHM (Hak Milik, tertinggi/selamanya), SHGB (Hak Guna Bangunan, masa
 *     berlaku tertentu), SHSRS (Hak Satuan Rumah Susun, untuk apartemen/
 *     kondominium) — lihat skills/claude_responds/docs/13-legalitas-pajak-kpr.md.
 * null selalu diperbolehkan di kedua transaksi (belum diisi/belum diketahui).
 */
const CERTIFICATE_TYPES_BY_TX = {
  rent: ['KOSONG', 'LAINNYA'],
  sale: ['KOSONG', 'LAINNYA', 'SHM', 'SHGB', 'SHSRS'],
};

const Property = sequelize.define('Property', {
  property_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Generated ID: prefix nama + random alphanumeric + count padded 3 digit'
  },
  city_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'FK ke cities.city_id — kota lokasi properti'
  },
  province_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'FK ke provinces.province_id — provinsi lokasi'
  },
  country_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'FK ke countries.country_id — negara lokasi'
  },
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: null,
    comment: 'FK ke users.user_id — pemilik/agent properti. Filter katalog per user login (/property & konteks AI).'
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Judul listing, mis. "Rumah 2 Lantai Citraland Surabaya"'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Deskripsi lengkap properti'
  },
  price: {
    type: DataTypes.DECIMAL(25, 4),
    allowNull: true,
    comment: 'Harga jual / sewa'
  },
  price_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Night, Daily, Weekly, Monthly, Yearly, Cash, Negotiable, Others : 300K/hari, 1.7 juta/bulan, 1 Milyar/cash, 1.2 Milyar/nego'
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Alamat lengkap'
  },
  area: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Area / kawasan, mis. "Citraland", "Pakuwon Indah"'
  },
  // M146 — FK informasional ke locations.location_id untuk AREA properti.
  // `area` (STRING) TETAP menyimpan NAMA yang dibaca kartu katalog & summary;
  // kolom ini menambah linkage yang bisa di-JOIN tanpa mengorbankan tampilan.
  // Nullable: area yang diketik bebas / label sintetis lama tidak punya master.
  area_location_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null,
    comment: 'FK ke locations.location_id (location_type=area) untuk kolom area'
  },
  district: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Kecamatan'
  },
  postal_code: {
    type: DataTypes.STRING(15),
    allowNull: true,
    defaultValue: null,
    comment: 'Kode pos'
  },
  furnished_status: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Full furnished, Semi-furnished, Unfurnished'
  },
  bed_rooms: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Jumlah kamar tidur'
  },
  bath_rooms: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Jumlah kamar mandi'
  },
  electricity_capacity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    comment: 'Kapasitas listrik (watt)'
  },
  building_area: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
    comment: 'Luas bangunan, mis. "120 m2"'
  },
  land_area: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
    comment: 'Luas tanah, mis. "150 m2"'
  },
  floor_location: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
    comment: 'Lokasi lantai (umumnya untuk apartment, hotel, office, condo, kos)'
  },
  floor_quantity: {
    type: DataTypes.INTEGER(4),
    allowNull: true,
    defaultValue: null,
    comment: 'Jumlah lantai (umumnya untuk rumah, villa, gudang, dan lain-lain)'
  },
  kpr_status: {
    type: DataTypes.STRING(1),
    allowNull: true,
    defaultValue: 'N',
    comment: 'Sale: Y/N. Default N karena tipe sewa tidak bisa KPR'
  },
  kpr_dp_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: null,
    comment: 'Estimasi DP KPR dalam persen (mis. 5.00, 10.00). Hanya relevan bila kpr_status=Y. '
           + 'Informasi MARKETING/perkiraan listing — BUKAN keputusan kredit bank, dan AI TIDAK '
           + 'PERNAH memakainya untuk menghitung kelayakan/cicilan customer (lihat skills/claude_responds/docs/13-legalitas-pajak-kpr.md).'
  },
  kpr_installment_estimate: {
    type: DataTypes.DECIMAL(25, 4),
    allowNull: true,
    defaultValue: null,
    comment: 'Estimasi cicilan per bulan (mis. "Cicilan per bulan mulai dari 24,7 Jutaan" di listing '
           + 'developer) — angka MARKETING dari developer/agent, bukan simulasi kredit resmi bank. '
           + 'Hanya relevan bila kpr_status=Y.'
  },
  certificate_type: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: null,
    comment: 'Sewa: NULL | KOSONG | LAINNYA saja. Beli: NULL | KOSONG | LAINNYA | SHM | SHGB | SHSRS. '
           + 'Divalidasi di hook validate() model ini terhadap transaction_type — lihat CERTIFICATE_TYPES_BY_TX.'
  },
  building_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'house, apartment, hotel, villa, boarding_house, shophouse, office, warehouse, store, condo, mansion, others'
  },
  transaction_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Rent | Sale'
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
  tableName: 'properties',
  timestamps: false,
  validate: {
    // M129: certificate_type harus cocok dengan transaction_type. Dicek di
    // level model (bukan cuma UI) supaya import/API mana pun tidak bisa
    // menyelundupkan kombinasi tidak masuk akal, mis. sewa dengan SHM.
    certificateMatchesTransactionType() {
      if (this.certificate_type == null) return; // null selalu boleh, kedua transaksi
      const tx = String(this.transaction_type || '').toLowerCase();
      const allowed = CERTIFICATE_TYPES_BY_TX[tx];
      if (!allowed) return; // transaction_type tidak dikenal — bukan tanggung jawab validator ini
      const cert = String(this.certificate_type).toUpperCase();
      if (!allowed.includes(cert)) {
        throw new Error(
          `certificate_type "${this.certificate_type}" tidak valid untuk transaction_type "${this.transaction_type}". ` +
          `Nilai yang diperbolehkan: ${allowed.join(', ')} (atau null).`
        );
      }
    },
  },
  indexes: [
    { fields: ['property_id'] },
    { fields: ['city_id'] },
    { fields: ['province_id'] },
    { fields: ['country_id'] },
    { fields: ['user_id'] },
    { fields: ['building_type'] },
    { fields: ['transaction_type'] },
    { fields: ['status'] },
    { fields: ['title'] }
  ]
});

// Static, tidak mengubah bentuk export (module.exports tetap model langsung,
// supaya semua `require('../models/Property')` yang sudah ada tidak rusak).
Property.CERTIFICATE_TYPES_BY_TX = CERTIFICATE_TYPES_BY_TX;

module.exports = Property;

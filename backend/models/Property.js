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

module.exports = Property;

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model: facilities
 *
 * Master data fasilitas properti.
 * Digunakan sebagai referensi fasilitas yang tersedia di properti
 * (mis. AC, kolam renang, CCTV, kamar mandi dalam, area parkir, dll.)
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 * FK created_by & updated_by → users.user_id
 */
const Facility = sequelize.define('Facility', {
  facility_id: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    comment: 'Generated ID: prefix nama + random alphanumeric + count padded 3 digit'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'Nama fasilitas, mis. AC, Kolam Renang, CCTV'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
    comment: 'Deskripsi singkat fasilitas'
  },
  icon: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null,
    comment: 'Icon identifier, mis. emoji atau CSS class (fa-wifi, 🏊, dll.)'
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
  tableName: 'facilities',
  timestamps: false,
  indexes: [
    { fields: ['facility_id'] },
    { fields: ['status'] },
    { fields: ['name'] }
  ]
});

module.exports = Facility;

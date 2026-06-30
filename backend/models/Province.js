const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model: provinces
 *
 * Master data provinsi untuk wilayah properti.
 * Struktur mengikuti referensi (Province.php) TANPA kolom `code`.
 * Terhubung ke negara via country_id.
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 * FK created_by & updated_by → users.user_id
 */
const Province = sequelize.define('Province', {
  province_id: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    comment: 'Generated ID: prefix nama + random alphanumeric + count padded 3 digit'
  },
  country_id: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'FK ke countries.country_id — negara induk'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'Nama provinsi, mis. Jawa Timur, DKI Jakarta'
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
  tableName: 'provinces',
  timestamps: false,
  indexes: [
    { fields: ['province_id'] },
    { fields: ['country_id'] },
    { fields: ['status'] },
    { fields: ['name'] }
  ]
});

module.exports = Province;

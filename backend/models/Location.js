const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model: locations
 *
 * Master data lokasi rujukan properti.
 * Digunakan sebagai referensi lokasi terdekat saat input/cari properti
 * (mis. Pasar, PTC, Café, Kebun Binatang, Indomaret, Stasiun, dll.)
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 * FK created_by & updated_by → users.user_id
 */
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
    unique: true,
    comment: 'Nama lokasi rujukan, mis. Pasar Besar, Kebun Binatang, Indomaret'
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
  indexes: [
    { fields: ['location_id'] },
    { fields: ['status'] },
    { fields: ['name'] }
  ]
});

module.exports = Location;

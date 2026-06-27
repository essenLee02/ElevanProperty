const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model: property_facilities  (DETAIL master property — fasilitas)
 *
 * Pivot antara properties.property_id dan facilities.facility_id, plus kuantitas
 * fasilitas (mis. 3 kamar AC). Relasi 1-ke-banyak dari properties.
 *
 * FK created_by & updated_by → users.user_id
 */
const PropertyFacility = sequelize.define('PropertyFacility', {
  property_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'FK ke properties.property_id — properti induk'
  },
  facility_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'FK ke facilities.facility_id — fasilitas yang dimiliki'
  },
  facility_qty: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    comment: 'Jumlah unit fasilitas (mis. 2 AC). Null jika tidak relevan'
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
  tableName: 'property_facilities',
  timestamps: false,
  indexes: [
    { fields: ['property_id'] },
    { fields: ['facility_id'] }
  ]
});

module.exports = PropertyFacility;

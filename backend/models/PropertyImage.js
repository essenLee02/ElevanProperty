const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Model: property_images  (DETAIL master property — gambar)
 *
 * Satu properti dapat memiliki beberapa gambar (relasi 1-ke-banyak ke
 * properties.property_id).
 */
const PropertyImage = sequelize.define('PropertyImage', {
  property_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'FK ke properties.property_id — properti induk'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nama / label gambar, mis. "Tampak depan"'
  },
  url: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Path / URL file gambar'
  }
}, {
  tableName: 'property_images',
  timestamps: false,
  indexes: [
    { fields: ['property_id'] }
  ]
});

module.exports = PropertyImage;

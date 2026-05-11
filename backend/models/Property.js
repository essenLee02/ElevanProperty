const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Property = sequelize.define('Property', {
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  price: { type: DataTypes.STRING, allowNull: true },
  location: { type: DataTypes.STRING, allowNull: true },
  city: { type: DataTypes.STRING, allowNull: true },
  district: { type: DataTypes.STRING, allowNull: true },
  address: { type: DataTypes.STRING, allowNull: true },
  buildingArea: { type: DataTypes.STRING, allowNull: true },
  landArea: { type: DataTypes.STRING, allowNull: true },
  bedrooms: { type: DataTypes.INTEGER, allowNull: true },
  bathrooms: { type: DataTypes.INTEGER, allowNull: true },
  floors: { type: DataTypes.INTEGER, allowNull: true },
  parking: { type: DataTypes.STRING, allowNull: true },
  garden: { type: DataTypes.STRING, allowNull: true },
  buildingType: { type: DataTypes.STRING, allowNull: false },
  transactionType: { type: DataTypes.STRING, allowNull: false },
  facilities: { type: DataTypes.TEXT, allowNull: true },
  furnishedStatus: { type: DataTypes.STRING, allowNull: true },
  style: { type: DataTypes.STRING, allowNull: true },
  imageUrl: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'available' }
}, {
  tableName: 'properties',
  timestamps: true
});

module.exports = Property;

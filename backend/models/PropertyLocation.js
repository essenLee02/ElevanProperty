const { DataTypes } = require('sequelize');
const db = require('../config/database');

const PropertyLocation = db.define('property_location', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  property_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: {
      model: 'properties',
      key: 'property_id',
    },
    onDelete: 'CASCADE',
  },
  location_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    references: {
      model: 'locations',
      key: 'location_id',
    },
  },
  created_date: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  created_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  updated_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  updated_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'property_locations',
  timestamps: false,
  indexes: [
    { fields: ['property_id'] },
    { fields: ['location_id'] },
    { fields: ['property_id', 'location_id'], unique: true },
  ],
});

module.exports = PropertyLocation;

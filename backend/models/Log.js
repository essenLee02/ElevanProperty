const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Log = sequelize.define('Log', {
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  level: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'info'
  }
}, {
  tableName: 'logs',
  timestamps: true
});

module.exports = Log;

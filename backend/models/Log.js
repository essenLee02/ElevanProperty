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
  }
}, {
  tableName: 'logs',
  timestamps: true
});

module.exports = Log;

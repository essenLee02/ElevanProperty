const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChatSession = sequelize.define('ChatSession', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  normalizedName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  normalizedPhone: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'website_chatbot'
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'chat_sessions',
  timestamps: true
});

module.exports = ChatSession;

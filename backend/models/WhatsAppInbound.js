const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WhatsAppInbound = sequelize.define('WhatsAppInbound', {
  agentName: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  agentPhone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  agentPhoneNormalized: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  senderName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  senderPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  senderPhoneNormalized: {
    type: DataTypes.STRING,
    allowNull: true,
    index: true
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  mediaType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mediaUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.STRING,
    allowNull: true
  },
  rawPayload: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'received',
    allowNull: false,
    index: true
  }
}, {
  tableName: 'whatsapp_inbound_messages',
  timestamps: true,
  indexes: [
    {
      fields: ['agentName']
    },
    {
      fields: ['senderPhoneNormalized']
    },
    {
      fields: ['status']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = WhatsAppInbound;

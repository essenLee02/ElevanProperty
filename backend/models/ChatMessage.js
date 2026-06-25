const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { redactSecrets } = require('../utils/secretRedactor');

/**
 * Sensor rahasia pada satu instance sebelum disimpan.
 * DILARANG menyimpan API key / token ke DB — ini lapisan terakhir yang menjamin
 * semua jalur penyimpanan (controller WhatsApp, sessionService, dll.) ikut bersih.
 */
function scrubInstance(instance) {
  if (instance.message  != null) instance.message  = redactSecrets(String(instance.message));
  if (instance.metadata != null) instance.metadata = redactSecrets(String(instance.metadata));
}

const ChatMessage = sequelize.define('ChatMessage', {
  chatSessionId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // Pemilik chat: FK ke users.user_id (agent WhatsApp yang menangani percakapan).
  // Null untuk chat tanpa agent (mis. website chatbot publik). Dipakai agar
  // log terminal & query bisa tahu chat ini milik user/agent yang mana.
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  channel: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'website_chatbot'
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'chat_messages',
  timestamps: true,
  hooks: {
    // Redaksi rahasia di SEMUA jalur tulis (create/update/bulkCreate).
    beforeSave: (instance) => scrubInstance(instance),
    beforeBulkCreate: (instances) => instances.forEach(scrubInstance)
  }
});

module.exports = ChatMessage;

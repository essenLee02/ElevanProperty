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
  // ⚠️ allowNull HARUS true — komentar di atas ("Null untuk chat tanpa agent")
  // kontradiktif dengan `allowNull: false` sebelumnya. sessionService.js
  // (jalur website chatbot publik) memanggil saveUserMessage/saveAssistantMessage
  // dengan `userId = null` sebagai DEFAULT PARAMETER — dengan allowNull:false ini
  // akan gagal INSERT (notNull Violation) begitu website chatbot dipakai tanpa
  // konteks agent. Diperbaiki 4 Agu 2026 sambil menambah kolom ai_responder di
  // bawah (kontradiksi yang sama, ditemukan bersamaan).
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  },
  customer_phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'Nomor WhatsApp customer (otomatis diisi saat customer chat lewat WhatsApp; kosong untuk website chatbot)'
  },
  // ⚠️ allowNull HARUS true — pesan customer (role='customer') TIDAK PERNAH
  // punya "responder AI", jadi tidak boleh dipaksa NOT NULL. Diisi HANYA untuk
  // baris role='ai', dengan nilai provider yang BENAR-BENAR menjawab (bukan
  // sekadar menyalin AI_PRIMARY_PROVIDER — lihat normalizeAiResponderLabel()
  // di whatsappAIService.js: saat primary gagal & fallback ke Private Agent,
  // nilainya 'private', BUKAN nama provider primary yang sebenarnya gagal).
  ai_responder: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: null,
    comment: 'chatgpt | claude | qwen | deepseek | kimi | private — HANYA diisi untuk role=ai; null untuk role=customer. "private" berarti fallback ke chatbotPrivateController.js (primary provider gagal/token habis), BUKAN berarti AI_PRIMARY_PROVIDER=private'
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

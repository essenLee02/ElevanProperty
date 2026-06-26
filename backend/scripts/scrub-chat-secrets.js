/**
 * scrub-chat-secrets.js
 *
 * One-off: bersihkan rahasia (API key / token / .env / private key) yang TERLANJUR
 * tersimpan di tabel chat_messages — mis. customer menempel isi .env atau perintah
 * curl berisi `x-api-key: sk-ant-...`.
 *
 * Aman dijalankan berulang (idempotent): baris yang sudah bersih dilewati.
 *
 * Usage: node scripts/scrub-chat-secrets.js
 */

require('dotenv').config();
const sequelize = require('../config/database');
const { ChatMessage } = require('../models');
const { redactSecrets, containsSecret } = require('../utils/secretRedactor');

(async () => {
  try {
    console.log('[SCRUB] Memindai chat_messages untuk rahasia yang tersimpan...');

    const rows = await ChatMessage.findAll({ attributes: ['id', 'message', 'metadata'] });
    let scanned = 0, cleaned = 0;

    for (const row of rows) {
      scanned++;
      const oldMessage  = row.message  == null ? null : String(row.message);
      const oldMetadata = row.metadata == null ? null : String(row.metadata);

      const hit = (oldMessage  && containsSecret(oldMessage))
               || (oldMetadata && containsSecret(oldMetadata));
      if (!hit) continue;

      const newMessage  = oldMessage  == null ? null : redactSecrets(oldMessage);
      const newMetadata = oldMetadata == null ? null : redactSecrets(oldMetadata);

      // Update langsung (hindari hook ganda — sudah diredaksi di sini).
      await ChatMessage.update(
        { message: newMessage, metadata: newMetadata },
        { where: { id: row.id }, hooks: false, silent: true }
      );
      cleaned++;
      console.log(`[SCRUB] ✓ id=${row.id} disensor`);
    }

    console.log(`[SCRUB] ✅ Selesai — ${scanned} baris dipindai, ${cleaned} baris disensor.`);
    process.exit(0);
  } catch (error) {
    console.error('[SCRUB ERROR]', error.message);
    process.exit(1);
  }
})();

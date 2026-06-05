/**
 * whatsappUtils.js
 *
 * Shared utility functions untuk semua WhatsApp platform controllers.
 * (Fonnte, WATI, 360dialog)
 *
 * Menghilangkan duplikasi kode di tiga controller dengan menyediakan:
 *  - normalizePhone / isValidPhone
 *  - findOrCreateSession
 *  - saveMessage
 *  - logTerminalSummary  ← format penuh setelah AI reply dikirim
 *  - logTerminalSkip     ← format ringkas untuk pesan non-properti
 */

'use strict';

const { ChatSession, ChatMessage } = require('../models');
const { isTerminalActive }         = require('./terminalSwitch');

/* ════════════════════════════════════════════════════════════════════
   PHONE UTILITIES
════════════════════════════════════════════════════════════════════ */

/**
 * Normalisasi nomor telepon ke format 628xxxxxxxxx
 *   +62 821-3311-936 → 628213311936
 *   0821-3311-936    → 628213311936
 *
 * @param {string|number} phone
 * @returns {string}
 */
function normalizePhone(phone) {
  return String(phone || '')
    .replace(/\+62/g, '62')
    .replace(/^0/, '62')
    .replace(/[\s\-()]/g, '');
}

/**
 * Cek apakah nomor telepon valid untuk format WhatsApp Indonesia.
 * Format yang valid: 628 diikuti minimal 8 digit.
 *
 * @param {string} phone
 * @returns {boolean}
 */
function isValidPhone(phone) {
  return /^628\d{8,}$/.test(normalizePhone(phone));
}

/* ════════════════════════════════════════════════════════════════════
   SESSION MANAGEMENT
════════════════════════════════════════════════════════════════════ */

/**
 * Find or create a ChatSession untuk customer.
 *
 * Source format: `{platform}_{agentSlug}`
 * Contoh: 'wati_leo_felix', 'dialog360_natasha'
 *
 * @param {object} params
 * @param {string} params.customerPhone - Nomor telepon customer (raw)
 * @param {string} params.customerName  - Nama customer
 * @param {string} params.agentName     - Nama agent (dipakai untuk source slug)
 * @param {string} params.platform      - 'fonnte' | 'wati' | 'dialog360'
 * @returns {Promise<ChatSession>}
 */
async function findOrCreateSession({ customerPhone, customerName, agentName, platform }) {
  const normPhone  = normalizePhone(customerPhone);
  const agentSlug  = agentName.toLowerCase().replace(/\s+/g, '_');
  const source     = `${platform}_${agentSlug}`;

  let session = await ChatSession.findOne({ where: { normalizedPhone: normPhone, source } });

  if (!session) {
    session = await ChatSession.create({
      name              : customerName,
      normalizedName    : customerName.toLowerCase(),
      phone             : customerPhone,
      normalizedPhone   : normPhone,
      source,
      location          : null,
      normalizedLocation: null
    });
  }

  return session;
}

/* ════════════════════════════════════════════════════════════════════
   MESSAGE PERSISTENCE
════════════════════════════════════════════════════════════════════ */

/**
 * Simpan satu chat message (customer atau AI) ke database.
 *
 * @param {ChatSession}        session
 * @param {'customer'|'ai'}   role
 * @param {string}             message
 * @param {object}             [metadata={}]  - Field tambahan (JSON)
 * @returns {Promise<ChatMessage>}
 */
async function saveMessage(session, role, message, metadata = {}) {
  return ChatMessage.create({
    chatSessionId : session.id,
    role,
    message,
    channel       : 'whatsapp',
    metadata      : JSON.stringify(metadata)
  });
}

/* ════════════════════════════════════════════════════════════════════
   TERMINAL LOGGING
════════════════════════════════════════════════════════════════════ */

/**
 * Log terminal lengkap setelah pesan properti dibalas AI.
 *
 * Format ini persis sama dengan yang ada di fonnteChatController.js
 * (sebagai referensi implementasi). Dipakai oleh WATI & 360dialog juga.
 *
 * @param {object} params
 * @param {'FONNTE'|'WATI'|'DIALOG'} params.platform   - Key untuk isTerminalActive()
 * @param {string}  params.tag         - Prefix label, misal '[WATI]'
 * @param {object}  params.agent       - { name, phone }
 * @param {string}  params.customerPhone
 * @param {string}  params.customerName
 * @param {string}  params.ts          - ISO timestamp
 * @param {string}  params.message     - Pesan customer
 * @param {string}  params.ctxSource   - Sumber konteks properti
 * @param {string}  params.aiProvider  - Nama provider AI
 * @param {string}  params.aiReply     - Teks balasan AI (full, tidak dipotong)
 * @param {string}  params.sendStatus  - '✅ Terkirim' atau '❌ Gagal: ...'
 */
function logTerminalSummary({
  platform, tag, agent, customerPhone, customerName,
  ts, message, ctxSource, aiProvider, aiReply, sendStatus
}) {
  if (!isTerminalActive(platform)) return;

  const D = '═'.repeat(80);

  console.log('');
  console.log(D);
  console.log(`${tag} ⬇  PESAN PROPERTI MASUK & DIBALAS`);
  console.log(D);
  console.log(`Agent    : ${agent.name} (${agent.phone || 'N/A'})`);
  console.log(`Customer : ${customerPhone} (${customerName})`);
  console.log(`Time     : ${ts}`);
  console.log(`Message  : ${message}`);
  console.log(`Context  : ${ctxSource}`);
  console.log(`AI       : ${aiProvider}`);
  console.log(D);
  console.log('RESPONSE:');
  console.log(D);
  console.log(aiReply);
  console.log(D);
  console.log(`Send Status: ${sendStatus}`);
  console.log(D);
  console.log('');
}

/**
 * Log ringkas untuk pesan non-properti (disimpan ke DB tapi AI skip).
 *
 * @param {object} params
 * @param {'FONNTE'|'WATI'|'DIALOG'} params.platform
 * @param {string}  params.tag
 * @param {object}  params.agent   - { name, phone }
 * @param {string}  params.customerPhone
 * @param {string}  params.customerName
 * @param {string}  params.ts
 * @param {string}  params.message
 */
function logTerminalSkip({ platform, tag, agent, customerPhone, customerName, ts, message }) {
  if (!isTerminalActive(platform)) return;

  const D = '─'.repeat(62);

  console.log('');
  console.log(D);
  console.log(`${tag} ⬇  PESAN MASUK (bukan query properti — tidak dibalas)`);
  console.log(`${tag}    Agent    : ${agent.name} (${agent.phone || 'N/A'})`);
  console.log(`${tag}    Customer : ${customerPhone} (${customerName})`);
  console.log(`${tag}    Time     : ${ts}`);
  console.log(`${tag}    Message  : ${message.substring(0, 100)}`);
  console.log(`${tag}    Status   : 📥 Disimpan ke DB, AI skip`);
  console.log(D);
  console.log('');
}

module.exports = {
  normalizePhone,
  isValidPhone,
  findOrCreateSession,
  saveMessage,
  logTerminalSummary,
  logTerminalSkip,
};

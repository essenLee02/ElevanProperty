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
   TERMINAL LOGGING — SECURITY UTILITIES
════════════════════════════════════════════════════════════════════ */

/**
 * Sanitasi string sebelum ditulis ke terminal.
 *
 * SECURITY: Mencegah tiga kelas serangan melalui pesan customer:
 *   1. Log injection  — customer mengirim "\n[FONNTE] FAKE_ENTRY" untuk memalsukan log
 *   2. ANSI injection — karakter escape \x1b[...m yang memanipulasi warna/cursor terminal
 *   3. Carriage-return injection — \r yang menyebabkan overwrite baris di terminal
 *
 * @param {string} str    - String yang akan di-log
 * @param {number} maxLen - Panjang maksimum (default 400)
 * @returns {string}      - String aman untuk console.log()
 */
function sanitizeLog(str, maxLen = 400) {
  return String(str || '')
    .replace(/\x1B\[[0-9;]*[mGKHFABCDJsulnhr]/g, '')  // strip ANSI escape codes
    .replace(/[\r\n\t]/g, ' ')                          // flatten newlines (prevent log injection)
    .replace(/\x00/g, '')                               // strip null bytes
    .substring(0, maxLen);
}

/**
 * Sensor nomor telepon untuk log terminal.
 * Hanya menampilkan 4 digit terakhir untuk melindungi privasi customer.
 *
 * @param {string} phone - Nomor telepon raw
 * @returns {string}     - Contoh: "628***7154"
 */
function maskPhone(phone) {
  const s = String(phone || '');
  if (s.length <= 4) return '****';
  return s.substring(0, 3) + '***' + s.slice(-4);
}

/**
 * Sensor nama customer — tampilkan nama depan + inisial saja.
 *
 * @param {string} name
 * @returns {string} - Contoh: "Agnes M."
 */
function maskName(name) {
  const s = sanitizeLog(String(name || 'Customer'), 50).trim();
  const parts = s.split(/\s+/);
  if (parts.length === 1) return s;
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

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

  // Sanitize semua user-controlled values sebelum di-log
  const safeAgentName   = sanitizeLog(agent.name || 'N/A', 80);
  const safeAgentPhone  = maskPhone(agent.phone);
  const safeCustomer    = `${maskPhone(customerPhone)} (${maskName(customerName)})`;
  const safeMessage     = sanitizeLog(message, 300);
  const safeCtx         = sanitizeLog(ctxSource, 60);
  const safeProvider    = sanitizeLog(aiProvider, 40);
  // aiReply dibolehkan multi-line (isi AI) tapi tetap strip ANSI/null
  const safeReply       = String(aiReply || '').replace(/\x1B\[[0-9;]*[mGKHFABCDJsulnhr]/g, '').replace(/\x00/g, '');
  const safeSendStatus  = sanitizeLog(sendStatus, 60);

  console.log('');
  console.log(D);
  console.log(`${sanitizeLog(tag, 20)} ⬇  PESAN PROPERTI MASUK & DIBALAS`);
  console.log(D);
  console.log(`Agent    : ${safeAgentName} (${safeAgentPhone})`);
  console.log(`Customer : ${safeCustomer}`);
  console.log(`Time     : ${ts}`);
  console.log(`Message  : ${safeMessage}`);
  console.log(`Context  : ${safeCtx}`);
  console.log(`AI       : ${safeProvider}`);
  console.log(D);
  console.log('RESPONSE:');
  console.log(D);
  console.log(safeReply);
  console.log(D);
  console.log(`Send Status: ${safeSendStatus}`);
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

  const D         = '─'.repeat(62);
  const safeTag   = sanitizeLog(tag, 20);
  const safeName  = sanitizeLog(agent.name || 'N/A', 60);
  const safeMsg   = sanitizeLog(message, 120);

  console.log('');
  console.log(D);
  console.log(`${safeTag} ⬇  PESAN MASUK (bukan query properti — tidak dibalas)`);
  console.log(`${safeTag}    Agent    : ${safeName} (${maskPhone(agent.phone)})`);
  console.log(`${safeTag}    Customer : ${maskPhone(customerPhone)} (${maskName(customerName)})`);
  console.log(`${safeTag}    Time     : ${ts}`);
  console.log(`${safeTag}    Message  : ${safeMsg}`);
  console.log(`${safeTag}    Status   : 📥 Disimpan ke DB, AI skip`);
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
  sanitizeLog,
  maskPhone,
  maskName,
};

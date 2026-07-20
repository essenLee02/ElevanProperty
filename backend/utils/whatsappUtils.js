/**
 * whatsappUtils.js
 *
 * Shared utility functions untuk semua WhatsApp platform controllers.
 * (Fonnte, Kirimi, TimelinesAI)
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
const { redactSecrets }            = require('./secretRedactor');

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
 * Contoh: 'fonnte_leo_felix', 'kirimi_natasha', 'timelinesai_budi'
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
 * @param {string|null}        [userId=null]  - users.user_id pemilik chat (agent)
 * @returns {Promise<ChatMessage>}
 */
async function saveMessage(session, role, message, metadata = {}, userId = null) {
  return ChatMessage.create({
    chatSessionId : session.id,
    user_id       : userId,
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
  return redactSecrets(String(str || ''))                // SECURITY: sensor API key/token dulu
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
 * @param {object} params
 * @param {'FONNTE'|'KIRIMI'|'TIMELINESAI'} params.platform   - Key untuk isTerminalActive()
 * @param {string}  params.tag         - Prefix label, misal '[FONNTE]'
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
  // aiReply dibolehkan multi-line (isi AI) tapi tetap sensor rahasia + strip ANSI/null
  const safeReply       = redactSecrets(String(aiReply || '')).replace(/\x1B\[[0-9;]*[mGKHFABCDJsulnhr]/g, '').replace(/\x00/g, '');
  const safeSendStatus  = sanitizeLog(sendStatus, 60);

  const safeOwner = sanitizeLog(agent.user_id || '-', 40);

  console.log('');
  console.log(D);
  console.log(`${sanitizeLog(tag, 20)} ⬇  PESAN PROPERTI MASUK & DIBALAS`);
  console.log(D);
  console.log(`Agent    : ${safeAgentName} (${safeAgentPhone})`);
  console.log(`Owner    : User ${safeOwner}`);
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
 * Log ringkas untuk pesan non-properti (gate-before-save: TIDAK disimpan ke DB, AI skip).
 * Format identik dengan blok skip inline fonnteChatController.
 *
 * @param {object} params
 * @param {'FONNTE'|'TIMELINESAI'|'KIRIMI'} params.platform
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
  console.log(`${safeTag}    Owner    : User ${sanitizeLog(agent.user_id || '-', 40)}`);
  console.log(`${safeTag}    Customer : ${maskPhone(customerPhone)} (${maskName(customerName)})`);
  console.log(`${safeTag}    Time     : ${ts}`);
  console.log(`${safeTag}    Message  : ${safeMsg}`);
  console.log(`${safeTag}    Status   : ⏭️  Tidak disimpan ke DB, AI skip (bukan query properti)`);
  console.log(D);
  console.log('');
}

/**
 * Tambahkan footer "> _Sent via <AI_PRIMARY_TAG>_" ke pesan keluar.
 * Diatur via .env: AI_PRIMARY_TAG (mis. propmatches.netlify.app). Jika kosong → tanpa footer.
 * Footer pakai format WhatsApp blockquote (>) + italic (_..._). Idempotent (tidak dobel).
 *
 * @param {string} message
 * @returns {string}
 */
function appendSentViaTag(message) {
  const tag = String(process.env.AI_PRIMARY_TAG || '').trim();
  const body = String(message == null ? '' : message).replace(/\s+$/, '');
  if (!tag) return body;
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`sent\\s+via\\s+${escaped}`, 'i').test(body)) return body; // sudah ada → jangan dobel
  return `${body}\n\n> _Sent via ${tag}_`;
}

/**
 * Balasan pengarahan singkat ketika customer mengirim pesan OFF-TOPIC di TENGAH
 * alur kualifikasi properti yang sedang aktif (mis. "Saya mau beli nasi jagung"
 * di sela pertanyaan Q1-Q12). Dulu pesan begini di-skip diam-diam — customer
 * merasa diabaikan; atau lebih buruk, lolos gate dan kata "beli"-nya mem-flip
 * transaksi. Kini: balas ramah, arahkan kembali ke pencarian properti, TANPA
 * menyimpan pesan off-topic ke DB (supaya tidak mencemari qualification state).
 * Dipakai fonnte/kirimi/timelinesAI dengan template yang sama.
 *
 * @param {string} agentName - nama agent untuk tanda tangan
 * @returns {string} pesan redirect (Bahasa Indonesia)
 */
function buildOffTopicRedirect(agentName = '') {
  const appName = process.env.APP_NAME || 'Elevan Property';
  const sig = agentName ? `\n\nSalam hangat,\n*${agentName}*\n*${appName}*` : '';
  return (
    `Hehe, maaf Kak — kalau soal itu saya belum bisa bantu 😄 ` +
    `Saya asisten khusus properti.\n\n` +
    `Kita lanjut pencarian properti Anda ya — boleh langsung dijawab pertanyaan saya sebelumnya 😊` +
    sig
  );
}

/**
 * Apakah pesan masuk ini sebenarnya GEMA dari pesan AI kita sendiri?
 * Pesan keluar AI diberi footer "Sent via <AI_PRIMARY_TAG>". Jika sebuah inbound
 * mengandung footer itu, berarti ia balikan dari pesan kita (mis. self-chat: nomor
 * agent = nomor customer, atau platform meng-echo pesan terkirim). Harus di-skip
 * agar AI tidak memproses/menjawab pesannya sendiri (loop & out-of-context).
 *
 * @param {string} message
 * @returns {boolean}
 */
function isOwnEcho(message) {
  const tag = String(process.env.AI_PRIMARY_TAG || '').trim();
  if (!tag) return false;
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`sent\\s+via\\s+${escaped}`, 'i').test(String(message || ''));
}

/**
 * Buang bagian GEMA pesan AI dari sebuah inbound, sisakan HANYA balasan asli
 * customer. Terjadi saat customer mengutip/menyalin pesan AI (mis. akibat kegagalan
 * kirim → customer paste ulang) sehingga body inbound = "[pesan AI + footer Sent via]
 * [balasan asli customer]". Tanpa ini, seluruh pesan ter-skip (isOwnEcho) → jawaban
 * asli customer HILANG → AI mengulang pertanyaan.
 *
 * Strategi: ambil teks SETELAH kemunculan footer "Sent via <tag>" TERAKHIR, buang
 * penanda kutipan (">"), rapikan. Jika tidak ada footer → kembalikan pesan apa adanya.
 * Jika setelah footer tidak ada teks bermakna → kembalikan '' (murni gema → skip).
 *
 * @param {string} message
 * @returns {string} balasan asli customer (atau pesan asli bila bukan gema)
 */
function stripOwnEcho(message) {
  const raw = String(message || '');
  const tag = String(process.env.AI_PRIMARY_TAG || '').trim();
  if (!tag) return raw.trim();
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`sent\\s+via\\s+${escaped}[^\\n]*`, 'gi');
  if (!re.test(raw)) return raw.trim();
  // Ambil segmen setelah footer TERAKHIR.
  const parts = raw.split(re);
  let tail = parts[parts.length - 1] || '';
  tail = tail
    .replace(/^[>\s_*·—–-]+/g, '')   // buang penanda kutipan / bullet di awal
    .replace(/\s{2,}/g, ' ')
    .trim();
  return tail;
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
  appendSentViaTag,
  isOwnEcho,
  stripOwnEcho,
  buildOffTopicRedirect,
};

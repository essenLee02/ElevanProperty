/**
 * kirimiChatController.js
 *
 * Multi-agent Kirimi WhatsApp handler.
 *
 * Dibuat agar KINERJANYA SAMA PERSIS dengan fonnteChatController.js dan
 * timelinesAIChatController.js — hanya arah platform-nya yang berbeda:
 *   - fonnteChatController.js     → Fonnte       (https://api.fonnte.com)
 *   - timelinesAIChatController   → TimelinesAI  (https://app.timelines.ai/integrations/api)
 *   - kirimiChatController        → Kirimi       (https://api.kirimi.id)
 *
 * ARSITEKTUR (identik dengan Fonnte/TimelinesAI):
 *   - Webhook masuk → deteksi event → cari agent → return 200 DULU → proses AI di
 *     background (setImmediate) → dedup → gate properti → AI chain → kirim balasan →
 *     log terminal ringkasan.
 *
 * MODEL KREDENSIAL KIRIMI:
 *   - user_code  : level AKUN  → .env KIRIMI_USER_CODE
 *   - secret     : level AKUN  → .env KIRIMI_SECRET
 *   - device_id  : per-AGENT   → kolom users.kirimi_device_id (mis. "D-3OCA6")
 *   Satu akun Kirimi memiliki banyak device; tiap agent memegang satu device.
 *   Identifikasi agent: dari device_id pada payload webhook → dicocokkan ke kolom
 *   users.kirimi_device_id. Fallback: nomor WA agent, lalu agent pertama.
 *
 * KONTRAK WEBHOOK KIRIMI (incoming "Pesan Masuk" — type: "message"):
 *   {
 *     type:"message", device_id:"D-3OCA6",
 *     from:"628xxx", pushName:"Nama", message:"teks",
 *     messageId:"...", fromMe:false, datetime_wib:"YYYY-MM-DD HH:mm:ss"
 *   }
 *   Event lain (diabaikan): "message.sent", "message.ack", "message.failed",
 *   "connection.connected", "connection.disconnected".
 *
 * SEND API (https://api.kirimi.id):
 *   POST /v1/send-message
 *   Body: { user_code, secret, device_id, phone:"628xxx", message, media_url? }
 *
 * ENDPOINT UTAMA:
 *   POST /api/kirimi/webhook  ← set ini di Kirimi Dashboard → Device → Webhook
 */

'use strict';

const axios  = require('axios');
const { User, ChatSession, ChatMessage } = require('../models');
const { safeLog }                       = require('../utils/safeLog');
const { isTerminalActive }              = require('../utils/terminalSwitch');
const { hasPropertyKeyword,
        isPropertyContextContinuation } = require('../utils/propertyKeywordFilter');
const { generateWhatsAppAIReply }       = require('../services/whatsappAIService');
const { getConversationHistory }        = require('../services/sessionService');
const { sanitizeLog, maskPhone, maskName, appendSentViaTag, isOwnEcho } = require('../utils/whatsappUtils');

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 0 — MESSAGE-ID DEDUP CACHE
   Mencegah double-processing saat Kirimi mengirim ulang webhook.
   Shared dengan Fonnte/TimelinesAI via utils/messageDedup.js (messageId stabil).
══════════════════════════════════════════════════════════════════════════════ */

const { isAlreadyProcessed: _isAlreadyProcessed,
        markProcessed:      _markProcessed,
        isContentAlreadyProcessed: _isContentDup,
        markContentProcessed:      _markContentDup } = require('../utils/messageDedup');

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 1 — UTILITY FUNCTIONS
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Normalisasi nomor telepon ke format 628xxxxxxxxx (untuk pencocokan & kirim).
 *   +62 821-3311-936 → 628213311936
 *   0821-3311-936    → 628213311936
 */
function normalizePhone(phone) {
  return String(phone || '')
    .replace(/\+62/g, '62')
    .replace(/^0/, '62')
    .replace(/[\s\-()]/g, '');
}

/** Base URL API Kirimi (boleh dioverride via env). */
function apiBase() {
  return String(process.env.KIRIMI_API_URL || 'https://api.kirimi.id').replace(/\/+$/, '');
}

/** Path endpoint kirim — default /v1/send-message, atau fast jika KIRIMI_SEND_FAST=true. */
function sendPath() {
  const fast = String(process.env.KIRIMI_SEND_FAST || '').toLowerCase() === 'true';
  return fast ? '/v1/send-message-fast' : '/v1/send-message';
}

/**
 * Ambil nilai pertama yang ada dari beberapa kemungkinan path (dot-notation).
 * Kirimi/Baileys memvariasikan bentuk payload (kadang flat, kadang nested di
 * `data.*` / `key.*`). Helper ini menelusuri semua kemungkinan letak field.
 */
function pick(obj, paths) {
  for (const p of paths) {
    const v = p.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

/**
 * Deteksi jenis event dari payload Kirimi.
 * Paralel dengan detectEventType() milik Fonnte/TimelinesAI.
 *
 * @param {object} body - req.body dari webhook Kirimi
 * @returns {'incoming'|'send'|'message_status'|'unknown'}
 */
function detectEventType(body) {
  if (!body || typeof body !== 'object') return 'unknown';

  const evt = String(body.type || body.event || body.event_type || '').toLowerCase();

  // status koneksi device → abaikan
  if (evt.startsWith('connection')) return 'message_status';
  // status pesan keluar (sent/ack/delivered/read/failed) → jangan dibalas (hindari loop)
  if (evt.includes('sent') || evt.includes('ack') || evt.includes('delivered') ||
      evt.includes('read') || evt.includes('failed') || evt.includes('status')) return 'send';
  // pesan masuk
  if (evt === 'message' || evt === 'message.received' ||
      evt.includes('received') || evt.includes('incoming')) {
    return 'incoming';
  }

  // Fallback via flag arah (fromMe true = pesan kita sendiri → bukan incoming)
  const fromMe = pick(body, ['fromMe', 'data.fromMe', 'key.fromMe', 'message.fromMe']);
  if (fromMe === true || String(fromMe).toLowerCase() === 'true') return 'send';

  // Fallback terakhir: ada teks + pengirim → anggap incoming
  const x = extractMessage(body);
  if (x.message && x.sender) return 'incoming';

  return 'unknown';
}

/**
 * Ekstrak field penting dari payload webhook — defensif terhadap variasi bentuk
 * Kirimi (flat root, nested `data.*`, atau `key.*`).
 * @param {object} body
 */
function extractMessage(body = {}) {
  return {
    sender    : normalizePhoneFromJid(pick(body, [
      'from', 'sender', 'phone', 'pengirim', 'sender_number', 'senderNumber',
      'data.from', 'data.sender', 'data.phone', 'key.remoteJid', 'remoteJid'
    ])),
    name      : pick(body, [
      'pushName', 'pushname', 'senderName', 'name', 'notify',
      'data.pushName', 'data.name', 'contact.name'
    ]) || 'Customer',
    message   : String(pick(body, [
      'message', 'text', 'body', 'pesan', 'content', 'caption',
      'data.message', 'data.text', 'data.body', 'message.text', 'message.body'
    ]) || '').trim(),
    messageId : pick(body, [
      'messageId', 'message_id', 'id', 'clientMsgId', 'key.id',
      'data.messageId', 'data.id'
    ]) || `kirimi_${Date.now()}`,
    deviceId  : String(pick(body, [
      'device_id', 'deviceId', 'device', 'data.device_id', 'data.deviceId'
    ]) || '').trim(),
    fromMe    : (() => {
      const f = pick(body, ['fromMe', 'data.fromMe', 'key.fromMe', 'message.fromMe']);
      return f === true || String(f).toLowerCase() === 'true';
    })(),
    isGroup   : (() => {
      const flag = pick(body, ['isGroup', 'is_group', 'data.isGroup', 'data.is_group']);
      if (flag === true || String(flag).toLowerCase() === 'true') return true;
      const jid = pick(body, ['from', 'sender', 'phone', 'data.from', 'data.sender', 'key.remoteJid', 'remoteJid']);
      return /@g\.us/i.test(String(jid || ''));
    })(),
  };
}

/**
 * Bersihkan kemungkinan JID WhatsApp ("628xxx@s.whatsapp.net") menjadi nomor murni.
 */
function normalizePhoneFromJid(value) {
  const raw = String(value || '').split('@')[0];
  return normalizePhone(raw);
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 2 — AGENT LOOKUP (dari database)
   Kirimi memakai device_id per-agent (kolom users.kirimi_device_id).
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Ambil semua agent aktif yang sudah punya kirimi_device_id di database.
 */
async function getAllAgentsWithKirimi() {
  const agents = await User.findAll({
    where      : { privilege: 'agent', status: 1 },
    attributes : ['id', 'user_id', 'name', 'phone', 'username', 'kirimi_device_id'],
    order      : [['created_date', 'ASC']]
  });
  return agents.filter(a => a.kirimi_device_id && String(a.kirimi_device_id).trim().length > 2);
}

/**
 * Cari agent berdasarkan device_id Kirimi pada payload (mis. "D-3OCA6").
 * Dicocokkan dengan kolom users.kirimi_device_id (case-insensitive).
 *
 * @param {string} deviceId
 * @returns {User|null}
 */
async function findAgentByDevice(deviceId) {
  if (!deviceId) return null;

  const target = String(deviceId).trim().toLowerCase();
  const agents = await getAllAgentsWithKirimi();

  for (const agent of agents) {
    if (agent.kirimi_device_id && String(agent.kirimi_device_id).trim().toLowerCase() === target) {
      console.log(`[KIRIMI AGENT] ✅ Match device: ${agent.name} (${agent.kirimi_device_id})`);
      return agent;
    }
  }

  console.warn(`[KIRIMI AGENT] Tidak ada match untuk device: ${deviceId}`);
  console.warn(`[KIRIMI AGENT] Device terdaftar:`,
    agents.map(a => `${a.name}: ${String(a.kirimi_device_id || '').trim()}`).join(', ')
  );
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 3 — KIRIM PESAN via KIRIMI (akun user_code+secret, device per-agent)
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Kirim pesan WhatsApp via Kirimi Public API.
 * Struktur retry identik dengan sendViaFonnte / sendViaTimelinesAI.
 *
 * @param {string} targetPhone - Nomor tujuan (customer)
 * @param {string} message     - Isi pesan
 * @param {string} deviceId    - users.kirimi_device_id milik agent
 */
async function sendViaKirimi(targetPhone, message, deviceId) {
  const userCode = String(process.env.KIRIMI_USER_CODE || '').trim();
  const secret   = String(process.env.KIRIMI_SECRET    || '').trim();
  if (!userCode || !secret) throw new Error('KIRIMI_USER_CODE / KIRIMI_SECRET belum di-set di .env');
  if (!deviceId)            throw new Error('Agent belum punya kirimi_device_id di database');

  const phone      = normalizePhone(targetPhone);
  const timeout    = parseInt(process.env.KIRIMI_TIMEOUT_MS    || '30000', 10);
  const maxRetries = parseInt(process.env.KIRIMI_RETRY_COUNT   || '3',     10);
  const retryDelay = parseInt(process.env.KIRIMI_RETRY_DELAY_MS || '3000', 10);

  const RETRYABLE = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ENETUNREACH', 'ECONNABORTED']);

  const url     = `${apiBase()}${sendPath()}`;
  const payload = {
    user_code : userCode,
    secret,
    device_id : String(deviceId).trim(),
    phone,
    message   : appendSentViaTag(String(message).trim())
  };

  console.log(`[KIRIMI SEND] → ${maskPhone(phone)} | device: ${payload.device_id} | len: ${payload.message.length}`);

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        headers : { 'Content-Type': 'application/json' },
        timeout,
      });

      const data = response.data || {};
      // Selalu log respons MENTAH Kirimi agar status kirim transparan (status ✅/❌
      // sebelumnya bisa keliru bila Kirimi memakai bentuk respons selain {success}).
      console.log(`[KIRIMI SEND] API response (${response.status}):`, JSON.stringify(data).substring(0, 300));

      // Deteksi GAGAL dari berbagai kemungkinan bentuk respons Kirimi — bukan hanya
      // success===false. Mencegah "✅ Terkirim" palsu saat pesan sebenarnya gagal
      // (device disconnect, nomor tidak terdaftar WA, kuota, dll.).
      const statusStr = String(data.status ?? data.state ?? '').toLowerCase();
      const failed =
        data.success === false ||
        data.status  === false ||
        data.sent    === false ||
        !!data.error ||
        /fail|gagal|error|invalid|reject|not[\s_-]*connect|disconnect|expired|unauthor/i.test(statusStr) ||
        /fail|gagal|error|invalid|tidak\s+terkirim|not\s+sent|reject/i.test(String(data.message || '').toLowerCase());
      if (failed) {
        throw new Error(data.message || data.error || statusStr || 'Kirimi: gagal kirim');
      }

      if (attempt > 1) {
        console.log(`[KIRIMI] Send succeeded on attempt ${attempt}/${maxRetries}`);
      }
      return data;

    } catch (err) {
      lastError = err;

      const httpStatus = err.response?.status;
      const httpBody   = JSON.stringify(err.response?.data || {}).substring(0, 200);
      if (httpStatus) {
        console.error(`[KIRIMI SEND] HTTP ${httpStatus} error: ${httpBody}`);
      }

      // 401 — user_code / secret salah, JANGAN retry
      if (httpStatus === 401) {
        console.error('[KIRIMI SEND] ❌ 401 — cek KIRIMI_USER_CODE / KIRIMI_SECRET di .env');
        break;
      }
      // 400 — validasi (device_id / phone salah), JANGAN retry
      if (httpStatus === 400) {
        console.error('[KIRIMI SEND] ❌ 400 — cek device_id / nomor tujuan');
        break;
      }

      const isRetryable = RETRYABLE.has(err.code) ||
        (err.code === 'ECONNABORTED' && /timeout/i.test(err.message));
      if (!isRetryable || attempt >= maxRetries) break;

      const delay = retryDelay * attempt;  // linear back-off: 3s, 6s, 9s …
      console.warn(`[KIRIMI] Send attempt ${attempt}/${maxRetries} failed (${err.code || err.message}). Retry in ${delay}ms…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  if (lastError && maxRetries > 1) {
    const code = lastError.code || '';
    lastError.message = `${lastError.message} (after ${maxRetries} attempts — check KIRIMI_RETRY_COUNT / KIRIMI_TIMEOUT_MS in .env)`;
    if (code) lastError.code = code;
  }
  throw lastError;
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 4 — AI REPLY (ChatGPT → Claude → Private Agent)
   Memakai whatsappAIService.generateWhatsAppAIReply (sama dengan Fonnte/TimelinesAI).
══════════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 5 — PROSES PESAN MASUK (background)
   Dipanggil setelah response 200 dikirim ke Kirimi. Identik dengan Fonnte/TimelinesAI.
══════════════════════════════════════════════════════════════════════════════ */

async function processIncomingMessage(body, agent) {
  const { sender, name, message, messageId, fromMe, isGroup } = extractMessage(body);
  const ts = new Date().toISOString();

  // ── Skip pesan kosong, grup & pesan kita sendiri ────────────────────
  if (!message) return;
  if (fromMe) {
    console.log(`[KIRIMI] Skip pesan keluar (fromMe) ke ${maskPhone(sender)}`);
    return;
  }
  if (isGroup) {
    console.log(`[KIRIMI] Skip pesan grup dari ${maskPhone(sender)}`);
    return;
  }
  // Gema pesan AI kita sendiri (footer "Sent via …") — jangan diproses (anti-loop).
  if (isOwnEcho(message)) {
    console.log(`[KIRIMI] Skip gema pesan AI sendiri (footer Sent via) dari ${maskPhone(sender)}`);
    return;
  }

  // ── Dedup guard layer 1: stable messageId (in-memory, cepat) ────────
  if (_isAlreadyProcessed(messageId)) {
    console.log(`[KIRIMI DEDUP] ⚠️  Pesan sudah diproses (ID cache), skip: ${messageId}`);
    return;
  }
  _markProcessed(messageId);

  // ── Dedup guard layer 2: DB check (survive server restart / nodemon) ──
  // Cek messageId di ChatMessage.metadata — mencegah double-process setelah restart.
  if (messageId && !/^sim_/.test(messageId)) {
    const safeId = String(messageId).replace(/[^A-Za-z0-9_\-]/g, '');
    if (safeId) {
      try {
        const { Op } = require('sequelize');
        const dbDup = await ChatMessage.findOne({
          where : { channel: 'whatsapp', metadata: { [Op.like]: `%"messageId":"${safeId}"%` } },
          attributes: ['id'],
        });
        if (dbDup) {
          console.log(`[KIRIMI DEDUP DB] ⚠️  messageId sudah ada di DB, skip: ${safeId}`);
          return;
        }
      } catch (dedupErr) {
        console.warn('[KIRIMI DEDUP DB] Query gagal, lanjut tanpa DB dedup:', dedupErr.message);
      }
    }
  }

  // ── Dedup guard layer 3: content-based (same sender+text within 5 min) ─
  const normSender = normalizePhone(sender);
  if (_isContentDup(normSender, message)) {
    console.log(`[KIRIMI DEDUP] ⚠️  Konten sama dari ${normSender} dalam 5 menit, skip.`);
    return;
  }
  _markContentDup(normSender, message);

  const source = `kirimi_${agent.name.toLowerCase().replace(/\s+/g, '_')}`;

  let session = await ChatSession.findOne({ where: { normalizedPhone: normSender, source } });
  if (!session) {
    session = await ChatSession.create({
      name              : name,
      normalizedName    : name.toLowerCase(),
      phone             : sender,
      normalizedPhone   : normSender,
      source,
      location          : null,
      normalizedLocation: null
    });
  }

  // ── Cek apakah pesan properti / lanjutan percakapan properti ──────────
  // (Identik dengan Fonnte: gate-before-save. Pesan non-properti tidak disimpan.)
  const isPropertyQuery = hasPropertyKeyword(message);

  let isContinuation = false;
  if (!isPropertyQuery) {
    try {
      // Window 12 (bukan 6): alur kualifikasi panjang (Q1–Q12) butuh history lebih
      // lebar agar kata TIPE properti & bukti in-flow (≥2 pertanyaan AI) tetap terlihat
      // saat customer jawab pendek ("Boleh..", "Terserah") di pertanyaan akhir.
      const history = await getConversationHistory(session.id, 12);
      isContinuation = isPropertyContextContinuation(message, history);
    } catch (_) { /* abaikan continuation check jika gagal ambil history */ }
  }

  if (!isPropertyQuery && !isContinuation) {
    if (isTerminalActive('KIRIMI')) {
      const D = '─'.repeat(62);
      console.log('');
      console.log(D);
      console.log(`[KIRIMI] ⬇  PESAN MASUK (bukan query properti — tidak dibalas)`);
      console.log(`[KIRIMI]    Agent    : ${sanitizeLog(agent.name, 60)} (${maskPhone(agent.phone)})`);
      console.log(`[KIRIMI]    Owner    : User ${sanitizeLog(agent.user_id || '-', 40)}`);
      console.log(`[KIRIMI]    Customer : ${maskPhone(sender)} (${maskName(name)})`);
      console.log(`[KIRIMI]    Time     : ${ts}`);
      console.log(`[KIRIMI]    Message  : ${sanitizeLog(message, 120)}`);
      console.log(`[KIRIMI]    Status   : ⏭️  Tidak disimpan ke DB, AI skip (bukan query properti)`);
      console.log(D);
      console.log('');
    }
    return; // Tidak kirim balasan, tidak simpan ke DB
  }

  // ── Simpan pesan customer ke DB (hanya untuk query properti / lanjutan) ─
  await ChatMessage.create({
    chatSessionId : session.id,
    user_id       : agent.user_id,
    role          : 'customer',
    message,
    channel       : 'whatsapp',
    metadata      : JSON.stringify({ agentName: agent.name, messageId, platform: 'kirimi' })
  });

  // ── Generate AI reply (dengan property context injection) ────────────
  let aiResult;
  let ctxSource = 'none';
  try {
    const result = await generateWhatsAppAIReply({
      session,
      message,
      agentName: agent.name,
    });
    aiResult  = result;
    ctxSource = result.contextSource || 'none';
  } catch (err) {
    const appName = process.env.APP_NAME || 'Elevan Property';
    aiResult = {
      reply    : `Halo ${name}, terima kasih menghubungi ${agent.name} dari ${appName}. Saya akan segera membantu mencari properti yang sesuai kebutuhan Anda. 🏠`,
      provider : 'fallback',
      contextSource: 'none'
    };
    ctxSource = 'none';
  }

  // ── Simpan AI reply ─────────────────────────────────────────────────
  await ChatMessage.create({
    chatSessionId : session.id,
    user_id       : agent.user_id,
    role          : 'ai',
    message       : aiResult.reply,
    channel       : 'whatsapp',
    metadata      : JSON.stringify({ aiProvider: aiResult.provider, contextSource: ctxSource })
  });

  // ── Kirim via Kirimi (device milik agent) ────────────────────────────
  let sent      = false;
  let sendError = null;

  try {
    await sendViaKirimi(sender, aiResult.reply, agent.kirimi_device_id);
    sent = true;
    safeLog('KIRIMI_REPLY_SENT', {
      sessionId  : session.id,
      agent      : agent.name,
      recipient  : sender,
      aiProvider : aiResult.provider,
      ctxSource
    });
  } catch (err) {
    sendError = err.message;
    safeLog('KIRIMI_REPLY_SEND_FAILED', { sessionId: session.id, agent: agent.name, error: err.message }, 'error');
  }

  // ── LOG RINGKASAN TERMINAL (FULL RESPONSE) ──────────────────────────
  if (isTerminalActive('KIRIMI')) {
    const D          = '═'.repeat(80);
    const sendStatus = sent ? `✅ Terkirim` : `❌ Gagal: ${sanitizeLog(sendError, 80)}`;

    const safeReply  = String(aiResult.reply || '')
      .replace(/\x1B\[[0-9;]*[mGKHFABCDJsulnhr]/g, '')
      .replace(/\x00/g, '');

    console.log('');
    console.log(D);
    console.log(`[KIRIMI] ⬇  PESAN PROPERTI MASUK & DIBALAS`);
    console.log(D);
    console.log(`Agent    : ${sanitizeLog(agent.name, 60)} (${maskPhone(agent.phone)})`);
    console.log(`Owner    : User ${sanitizeLog(agent.user_id || '-', 40)}`);
    console.log(`Customer : ${maskPhone(sender)} (${maskName(name)})`);
    console.log(`Time     : ${ts}`);
    console.log(`Message  : ${sanitizeLog(message, 300)}`);
    console.log(`Context  : ${sanitizeLog(ctxSource, 60)}`);
    console.log(`AI       : ${sanitizeLog(aiResult.provider, 40)}`);
    console.log(D);
    console.log('RESPONSE:');
    console.log(D);
    console.log(safeReply);
    console.log(D);
    console.log(`Send Status: ${sendStatus}`);
    console.log(D);
    console.log('');
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 6 — CONTROLLER CLASS
══════════════════════════════════════════════════════════════════════════════ */

class KirimiChatController {

  /* ─────────────────────────────────────────────────────────────────────
     POST /api/kirimi/webhook
     Endpoint utama. Set URL ini di Kirimi Dashboard → Device → Webhook.

     Alur (identik dengan Fonnte/TimelinesAI):
       1. Terima payload → log raw
       2. detectEventType
       3. Jika bukan incoming → langsung return 200
       4. Jika incoming → return 200 DULU, lalu proses background
  ───────────────────────────────────────────────────────────────────── */
  static async handleInboundMessage(req, res) {
    const body = req.body || {};

    // ── Log raw payload ─────────────────────────────────────────────
    console.log('\n╔════════════ KIRIMI WEBHOOK MASUK ═════════════╗');
    console.log(`║ Time  : ${new Date().toISOString().padEnd(31)} ║`);
    console.log(`║ Keys  : ${String(Object.keys(body).join(', ')).substring(0, 31).padEnd(31)} ║`);
    console.log('╚═══════════════════════════════════════════════╝');
    console.log('[KIRIMI RAW]', JSON.stringify(body).substring(0, 300));

    // ── Detect event type ───────────────────────────────────────────
    const eventType = detectEventType(body);
    console.log(`[KIRIMI EVENT] Type: ${eventType}`);

    // ── Handle status update (koneksi device) ──────────────────────
    if (eventType === 'message_status') {
      return res.status(process.env.HTTP_OK).json({ status: true, type: 'message_status', message: 'Status diterima' });
    }

    // ── Handle send notification (pesan keluar / ack / failed) ──────
    if (eventType === 'send') {
      return res.status(process.env.HTTP_OK).json({ status: true, type: 'send', message: 'Send event diterima' });
    }

    // ── Handle unknown ──────────────────────────────────────────────
    if (eventType !== 'incoming') {
      return res.status(process.env.HTTP_OK).json({ status: true, type: 'unknown', message: 'Event diterima' });
    }

    // ── INCOMING MESSAGE ────────────────────────────────────────────
    // Respond 200 SEKARANG sebelum proses AI (hindari Kirimi timeout)
    res.status(process.env.HTTP_OK).json({ status: true, type: 'incoming', message: 'Webhook diterima' });

    // Proses di background (tidak block response)
    setImmediate(async () => {
      try {
        const { deviceId } = extractMessage(body);

        // Strategi 1: cari agent by device_id (kirimi_device_id)
        let agent = null;
        if (deviceId) {
          agent = await findAgentByDevice(deviceId);
        }

        // Strategi 2: jika tidak cocok, pakai agent pertama yang punya device
        if (!agent) {
          const allAgents = await getAllAgentsWithKirimi();
          if (allAgents.length > 0) {
            agent = allAgents[0];
            console.log(`[KIRIMI AGENT] Auto-select: ${agent.name}`);
          }
        }

        if (!agent) {
          console.warn('[KIRIMI] Tidak ada agent dengan kirimi_device_id aktif di database');
          return;
        }

        await processIncomingMessage(body, agent);

      } catch (err) {
        console.error('[KIRIMI BACKGROUND ERROR]', err.message, err.stack);
        safeLog('KIRIMI_BACKGROUND_ERROR', { error: err.message }, 'error');
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     POST /api/kirimi/webhook-raw
     Debug endpoint — log semua payload mentah dari Kirimi
  ───────────────────────────────────────────────────────────────────── */
  static async webhookRawCatcher(req, res) {
    const body = req.body || {};
    const ts   = new Date().toISOString();

    console.log('\n╔════════════ KIRIMI RAW CATCHER ═════════════╗');
    console.log(`║ ${ts.padEnd(43)} ║`);
    console.log(`║ Keys: ${String(Object.keys(body).join(', ')).substring(0, 37).padEnd(37)} ║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('[KIRIMI RAW PAYLOAD]', JSON.stringify(body, null, 2));

    const eventType = detectEventType(body);
    console.log('[KIRIMI RAW CATCHER] Detected event:', eventType);

    if (eventType === 'incoming') {
      console.log('[KIRIMI RAW CATCHER] ✅ Ini incoming message → teruskan ke handler...');
      return KirimiChatController.handleInboundMessage(req, res);
    }

    return res.status(process.env.HTTP_OK).json({
      status     : true,
      caught     : true,
      eventType,
      payloadKeys: Object.keys(body),
      raw        : body
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     POST /api/kirimi/simulate
     Test endpoint — simulasi pesan masuk tanpa WA asli
  ───────────────────────────────────────────────────────────────────── */
  static async simulateInboundMessage(req, res) {
    const {
      sender   = '628999888777',
      message  = 'Halo, saya mau tanya properti',
      device   = null,            // device_id Kirimi (kirimi_device_id)
      name     = 'Test Customer',
      dry_run  = false
    } = req.body || {};

    console.log('\n[KIRIMI SIMULATE] 🧪 Simulasi pesan masuk');
    console.log(`  From   : ${sender} (${name})`);
    console.log(`  Device : ${device || '(auto)'}`);
    console.log(`  Message: ${message}`);
    console.log(`  Dry run: ${dry_run}`);

    if (!sender || !message) {
      return res.status(process.env.HTTP_BAD_REQUEST).json({ success: false, message: 'Wajib ada: sender dan message' });
    }

    let agent = device ? await findAgentByDevice(device) : null;
    if (!agent) {
      const all = await getAllAgentsWithKirimi();
      if (all.length > 0) agent = all[0];
    }

    if (!agent) {
      return res.status(process.env.HTTP_NOT_FOUND).json({
        success : false,
        message : 'Tidak ada agent dengan kirimi_device_id. Cek /api/kirimi/status'
      });
    }

    if (dry_run) {
      return res.json({
        success : true,
        dry_run : true,
        agent   : agent.name,
        sender,
        message,
        hint    : 'Dry run — tidak ada AI / tidak ada kirim'
      });
    }

    // Proses penuh — bentuk payload menyerupai webhook Kirimi
    try {
      const fakeBody = {
        type      : 'message',
        device_id : device || agent.kirimi_device_id || '',
        from      : sender,
        pushName  : name,
        message,
        messageId : `sim_${Date.now()}`,
        fromMe    : false
      };
      await processIncomingMessage(fakeBody, agent);

      return res.json({
        success : true,
        message : 'Simulate selesai. Lihat terminal untuk output.',
        agent   : agent.name,
        sender
      });

    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/kirimi/agents
  ───────────────────────────────────────────────────────────────────── */
  static async getAgentsWithKirimi(req, res) {
    try {
      const agents = await getAllAgentsWithKirimi();
      return res.json({
        success : true,
        data    : {
          agents: agents.map(a => ({
            user_id      : a.user_id,
            name         : a.name,
            phone        : a.phone,
            device_id    : a.kirimi_device_id,
            kirimi_ready : true
          })),
          total: agents.length
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/kirimi/agent-chats/:agentName
  ───────────────────────────────────────────────────────────────────── */
  static async getAgentChats(req, res) {
    try {
      const { agentName }              = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const source   = `kirimi_${agentName.toLowerCase().replace(/\s+/g, '_')}`;
      const sessions = await ChatSession.findAll({
        where  : { source },
        order  : [['updatedAt', 'DESC']],
        limit  : Math.min(parseInt(limit)  || 50, 200),
        offset : parseInt(offset) || 0
      });
      const total = await ChatSession.count({ where: { source } });

      return res.json({
        success: true,
        data   : { agent: agentName, sessions, pagination: { total, limit: parseInt(limit) || 50 } }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/kirimi/chat-history/:sessionId
  ───────────────────────────────────────────────────────────────────── */
  static async getChatHistory(req, res) {
    try {
      const { sessionId }   = req.params;
      const { limit = 100 } = req.query;

      const session = await ChatSession.findByPk(sessionId);
      if (!session) return res.status(process.env.HTTP_NOT_FOUND).json({ success: false, message: 'Sesi tidak ditemukan' });

      const messages = await ChatMessage.findAll({
        where : { chatSessionId: sessionId },
        order : [['createdAt', 'ASC']],
        limit : Math.min(parseInt(limit) || 100, 500)
      });

      return res.json({
        success: true,
        data   : {
          session : { id: session.id, name: session.name, phone: session.phone, source: session.source },
          messages,
          count   : messages.length
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/kirimi/status
  ───────────────────────────────────────────────────────────────────── */
  static async getKirimiStatus(req, res) {
    try {
      const allAgents = await User.findAll({
        where      : { privilege: 'agent', status: 1 },
        attributes : ['user_id', 'name', 'phone', 'kirimi_device_id']
      });

      const accountConfigured = !!String(process.env.KIRIMI_USER_CODE || '').trim()
                             && !!String(process.env.KIRIMI_SECRET    || '').trim();

      const ready = allAgents.filter(a => a.kirimi_device_id && String(a.kirimi_device_id).trim().length > 2);

      return res.json({
        success : true,
        data    : {
          account_configured: accountConfigured,    // boolean — JANGAN return user_code/secret
          api_base          : apiBase(),
          send_path         : sendPath(),
          terminal_active   : isTerminalActive('KIRIMI'),
          total             : allAgents.length,
          kirimi_ready      : ready.length,
          agents            : allAgents.map(a => ({
            user_id    : a.user_id,
            name       : a.name,
            phone      : a.phone,
            device_id  : a.kirimi_device_id,
            has_device : !!(a.kirimi_device_id && String(a.kirimi_device_id).trim().length > 2),
            ready      : !!(a.kirimi_device_id && String(a.kirimi_device_id).trim().length > 2) && accountConfigured
          }))
        },
        message: accountConfigured
          ? `${ready.length} dari ${allAgents.length} agent siap Kirimi`
          : 'KIRIMI_USER_CODE / KIRIMI_SECRET belum di-set di .env'
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/kirimi/debug-info
  ───────────────────────────────────────────────────────────────────── */
  static async getDebugInfo(req, res) {
    try {
      const agents = await User.findAll({
        where      : { privilege: 'agent', status: 1 },
        attributes : ['user_id', 'name', 'phone', 'kirimi_device_id']
      });

      return res.json({
        success: true,
        data   : {
          server: { port: process.env.PORT || 5005, webhookUrl: 'POST /api/kirimi/webhook' },
          api   : {
            base               : apiBase(),
            send_path          : sendPath(),
            account_configured : !!String(process.env.KIRIMI_USER_CODE || '').trim() && !!String(process.env.KIRIMI_SECRET || '').trim()
          },
          agents: agents.map(a => ({
            user_id          : a.user_id,
            name             : a.name,
            phone_raw        : a.phone,
            phone_normalized : normalizePhone(a.phone || ''),
            device_id        : a.kirimi_device_id,
            has_device       : !!(a.kirimi_device_id && String(a.kirimi_device_id).trim().length > 2)
          }))
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/kirimi/check-api
     Test apakah Kirimi API bisa dihubungi (paralel checkFonnteApi).
     Memakai /v1/device-status dengan device_id agent pertama.
  ───────────────────────────────────────────────────────────────────── */
  static async checkKirimiApi(req, res) {
    try {
      const userCode = String(process.env.KIRIMI_USER_CODE || '').trim();
      const secret   = String(process.env.KIRIMI_SECRET    || '').trim();
      if (!userCode || !secret) {
        return res.status(process.env.HTTP_NOT_FOUND).json({ success: false, message: 'KIRIMI_USER_CODE / KIRIMI_SECRET belum di-set di .env' });
      }

      const agents = await getAllAgentsWithKirimi();
      if (agents.length === 0) {
        return res.status(process.env.HTTP_NOT_FOUND).json({ success: false, message: 'Tidak ada agent dengan kirimi_device_id' });
      }

      const target  = agents[0];
      const results = {};

      // device-status — verifikasi konektivitas + auth + device terhubung
      try {
        const r = await axios.post(
          `${apiBase()}/v1/device-status`,
          { user_code: userCode, secret, device_id: String(target.kirimi_device_id).trim() },
          { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
        );
        results.device_status = { status: r.status, ok: true, preview: JSON.stringify(r.data).substring(0, 300) };
      } catch (err) {
        results.device_status = { status: err?.response?.status || 'error', ok: false, error: err.message, body: JSON.stringify(err?.response?.data || {}).substring(0, 200) };
      }

      return res.json({
        success  : true,
        agent    : target.name,
        device_id: target.kirimi_device_id,
        api_base : apiBase(),
        results
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }
}

module.exports = KirimiChatController;

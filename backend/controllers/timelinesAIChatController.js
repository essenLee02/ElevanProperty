/**
 * timelinesAIChatController.js
 *
 * Multi-agent TimelinesAI WhatsApp handler.
 *
 * Dibuat agar KINERJANYA SAMA PERSIS dengan fonnteChatController.js — hanya arah
 * platform-nya yang berbeda:
 *   - fonnteChatController.js   → Fonnte  (https://api.fonnte.com)
 *   - timelinesAIChatController → TimelinesAI (https://app.timelines.ai/integrations/api)
 *
 * ARSITEKTUR (identik dengan Fonnte):
 *   - Webhook masuk → deteksi event → cari agent → return 200 DULU → proses AI di
 *     background (setImmediate) → dedup → gate properti → AI chain → kirim balasan →
 *     log terminal ringkasan.
 *
 * PERBEDAAN TEKNIS DENGAN FONNTE:
 *   - Fonnte      : token per-agent (kolom users.fonnte_token), kirim via api.fonnte.com/send
 *   - TimelinesAI : SATU shared API key (.env TIMELINESAI_API_KEY) Bearer auth,
 *                   kirim via POST /integrations/api/messages { phone:"+62…", text }.
 *   - Identifikasi agent: dari nomor WA terhubung di payload (whatsapp_account.phone)
 *     → dicocokkan ke kolom users.phone. Fallback: agent pertama.
 *
 * KONTRAK WEBHOOK TIMELINESAI (incoming):
 *   {
 *     event_type:"message:received:new",
 *     chat:{ chat_id, phone, full_name, is_group, responsible_name, ... },
 *     whatsapp_account:{ phone, full_name, email },     // nomor agent yang terhubung
 *     message:{ text, direction:"received", message_uid, sender:{ phone, full_name }, ... }
 *   }
 *
 * ENDPOINT UTAMA:
 *   POST /api/timelinesai/webhook  ← set ini di TimelinesAI → Integrations → Webhooks
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
   Mencegah double-processing saat TimelinesAI mengirim ulang webhook.
   Shared dengan Fonnte/360dialog via utils/messageDedup.js (message_uid stabil).
══════════════════════════════════════════════════════════════════════════════ */

const { isAlreadyProcessed: _isAlreadyProcessed,
        markProcessed:      _markProcessed,
        isContentAlreadyProcessed: _isContentDup,
        markContentProcessed:      _markContentDup } = require('../utils/messageDedup');

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 0b — COOKIE RESPONSE TIMER (debounce pesan beruntun)
   Shared dengan Fonnte/Kirimi via utils/responseDebounce.js.
   AI menunggu AI_COOKIE_RESPONSE_TIMER ms (.env, default 20000) sejak pesan
   TERAKHIR customer sebelum diproses — menampung pesan susulan yang dikirim
   terpisah agar tidak dibalas terburu-buru.
══════════════════════════════════════════════════════════════════════════════ */

const { debounceMessage } = require('../utils/responseDebounce');

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 1 — UTILITY FUNCTIONS
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Normalisasi nomor telepon ke format 628xxxxxxxxx (untuk pencocokan agent).
 *   +62 881-036-588-874 → 62881036588874
 *   0881-036-588-874    → 62881036588874
 */
function normalizePhone(phone) {
  return String(phone || '')
    .replace(/\+62/g, '62')
    .replace(/^0/, '62')
    .replace(/[\s\-()]/g, '');
}

/** Nomor internasional untuk API TimelinesAI: "+62xxxxxxxxxx". */
function toIntlPlus(phone) {
  const digits = normalizePhone(phone);
  return digits ? `+${digits}` : '';
}

/** Base URL API TimelinesAI (boleh dioverride via env). */
function apiBase() {
  return String(process.env.TIMELINESAI_API_URL || 'https://app.timelines.ai/integrations/api')
    .replace(/\/+$/, '');
}

/**
 * Ambil nilai pertama yang ada dari beberapa kemungkinan path (dot-notation).
 * TimelinesAI memvariasikan bentuk payload: kadang FLAT (data.sender_phone) kadang
 * NESTED (message.sender.phone) tergantung versi/flavor event. Helper ini menelusuri
 * semua kemungkinan letak field tersebut.
 */
function pick(obj, paths) {
  for (const p of paths) {
    const v = p.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

/**
 * Deteksi jenis event dari payload TimelinesAI.
 * Paralel dengan detectEventType() milik Fonnte, tapi toleran terhadap penamaan
 * webhooks_v2: "chat:incoming:new" / "chat:outgoing:new" MAUPUN "message:received:new".
 *
 * @param {object} body - req.body dari webhook TimelinesAI
 * @returns {'incoming'|'send'|'message_status'|'unknown'}
 */
function detectEventType(body) {
  if (!body || typeof body !== 'object') return 'unknown';

  const evt = String(body.event_type || body.event || body.type || '').toLowerCase();

  // incoming: "chat:incoming:new", "message:received:new", "message:received:text", dll.
  if (evt.includes('incoming') || evt.includes('received')) return 'incoming';
  // send/keluar: "chat:outgoing:new", "message:sent:new" → jangan dibalas (hindari loop)
  if (evt.includes('outgoing') || evt.includes('sent'))     return 'send';
  // status: delivered/read/status
  if (evt.includes('status') || evt.includes('delivered') || evt.includes('read')) return 'message_status';

  // Fallback via direction (kadang ada di message.direction / data.direction)
  const dir = String(pick(body, ['message.direction', 'data.direction', 'direction'])).toLowerCase();
  if (dir === 'received' || dir === 'inbound')  return 'incoming';
  if (dir === 'sent'     || dir === 'outbound') return 'send';

  // Fallback terakhir: ada teks + pengirim → anggap incoming
  const x = extractMessage(body);
  if (x.message && x.sender) return 'incoming';

  return 'unknown';
}

/**
 * Ekstrak field penting dari payload webhook — defensif terhadap SEMUA variasi
 * bentuk TimelinesAI (flat `data.*`, nested `message.*` / `chat.*`, atau root-level).
 * @param {object} body
 */
function extractMessage(body = {}) {
  return {
    sender      : pick(body, [
      'data.sender_phone', 'message.sender.phone', 'data.sender.phone',
      'data.phone', 'chat.phone', 'data.chat.phone', 'sender_phone', 'phone'
    ]),
    name        : pick(body, [
      'data.sender_name', 'message.sender.full_name', 'data.sender.full_name',
      'chat.full_name', 'data.chat.full_name', 'data.full_name', 'sender_name', 'full_name'
    ]) || 'Customer',
    message     : String(pick(body, [
      'data.text', 'message.text', 'data.message', 'message.body', 'text', 'body'
    ]) || '').trim(),
    messageId   : pick(body, [
      'data.message_uid', 'message.message_uid', 'data.message_id',
      'message_uid', 'data.uid', 'message.id'
    ]) || `timelinesai_${Date.now()}`,
    accountPhone: pick(body, [
      'whatsapp_account.phone', 'data.whatsapp_account.phone', 'message.recipient.phone',
      'data.account_phone', 'data.connected_phone', 'account_phone'
    ]),
    isGroup     : !!pick(body, ['chat.is_group', 'data.is_group', 'data.chat.is_group', 'is_group']),
    fromMe      : (() => {
      const f = pick(body, ['message.fromMe', 'data.fromMe', 'fromMe', 'message.direction', 'data.direction', 'direction']);
      return f === true || String(f).toLowerCase() === 'true' ||
        String(f).toLowerCase() === 'sent' || String(f).toLowerCase() === 'outbound';
    })(),
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 2 — AGENT LOOKUP (dari database)
   TimelinesAI pakai shared API key; agent diidentifikasi dari nomor WA terhubung.
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Ambil semua agent aktif dari database.
 * (Tidak ada filter token per-agent seperti Fonnte — TimelinesAI shared key.)
 */
async function getAllAgents() {
  const agents = await User.findAll({
    where      : { privilege: 'agent', status: 1 },
    attributes : ['id', 'user_id', 'name', 'phone', 'username'],
    order      : [['created_date', 'ASC']]
  });
  return agents;
}

/**
 * Cari agent berdasarkan nomor WhatsApp terhubung (whatsapp_account.phone).
 * Dicocokkan dengan kolom users.phone setelah normalisasi (paralel findAgentByDevice).
 *
 * @param {string} accountPhone - Nomor WA terhubung di TimelinesAI
 * @returns {User|null}
 */
async function findAgentByAccount(accountPhone) {
  if (!accountPhone) return null;

  const normAcct = normalizePhone(accountPhone);
  const agents   = await getAllAgents();

  for (const agent of agents) {
    if (agent.phone && normalizePhone(agent.phone) === normAcct) {
      console.log(`[TIMELINESAI AGENT] ✅ Match: ${agent.name} (${agent.phone})`);
      return agent;
    }
  }

  console.warn(`[TIMELINESAI AGENT] Tidak ada match untuk akun: ${accountPhone} (normalized: ${normAcct})`);
  console.warn(`[TIMELINESAI AGENT] Agent terdaftar:`,
    agents.map(a => `${a.name}: ${normalizePhone(a.phone || '')}`).join(', ')
  );

  return null;
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 3 — KIRIM PESAN via TIMELINESAI (shared Bearer key)
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Kirim pesan WhatsApp via TimelinesAI Public API.
 * Struktur retry identik dengan sendViaFonnte (linear back-off, retry network error).
 *
 * @param {string} targetPhone - Nomor tujuan (customer)
 * @param {string} message     - Isi pesan
 */
async function sendViaTimelinesAI(targetPhone, message) {
  const apiKey = String(process.env.TIMELINESAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('TIMELINESAI_API_KEY belum di-set di .env');

  const phone      = toIntlPlus(targetPhone);
  const timeout    = parseInt(process.env.TIMELINESAI_TIMEOUT_MS     || '30000', 10);
  const maxRetries = parseInt(process.env.TIMELINESAI_RETRY_COUNT    || '3',     10);
  const retryDelay = parseInt(process.env.TIMELINESAI_RETRY_DELAY_MS || '3000',  10);

  const RETRYABLE = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ENETUNREACH', 'ECONNABORTED']);

  console.log(`[TIMELINESAI SEND] → ${toIntlPlus(targetPhone)} | len: ${String(message).trim().length}`);

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        `${apiBase()}/messages`,
        { phone, text: appendSentViaTag(String(message).trim()) },
        {
          headers : {
            'Authorization' : `Bearer ${apiKey}`,
            'Content-Type'  : 'application/json'
          },
          timeout,
        }
      );

      const data = response.data || {};
      console.log(`[TIMELINESAI SEND] API response (${response.status}):`, JSON.stringify(data).substring(0, 300));

      // Deteksi GAGAL dari berbagai kemungkinan bentuk respons TimelinesAI.
      const statusStr = String(data.status ?? data.state ?? '').toLowerCase();
      const failed =
        data.success === false ||
        data.status  === false ||
        data.sent    === false ||
        !!data.error  ||
        !!data.detail ||
        /fail|gagal|error|invalid|reject|not[\s_-]*connect|disconnect|expired|unauthor/i.test(statusStr) ||
        /fail|gagal|error|invalid|tidak\s+terkirim|not\s+sent|reject/i.test(String(data.message || '').toLowerCase());
      if (failed) {
        throw new Error(data.error || data.detail || data.message || statusStr || 'TimelinesAI: gagal kirim');
      }

      if (attempt > 1) {
        console.log(`[TIMELINESAI] Send succeeded on attempt ${attempt}/${maxRetries}`);
      }
      return data;

    } catch (err) {
      lastError = err;

      const httpStatus = err.response?.status;
      const httpBody   = JSON.stringify(err.response?.data || {}).substring(0, 200);
      if (httpStatus) {
        console.error(`[TIMELINESAI SEND] HTTP ${httpStatus} error: ${httpBody}`);
      }

      // 401 — API key salah, JANGAN retry
      if (httpStatus === 401) {
        console.error('[TIMELINESAI SEND] ❌ 401 — cek TIMELINESAI_API_KEY di .env');
        break;
      }
      // 400 — validasi (phone salah), JANGAN retry
      if (httpStatus === 400) {
        console.error('[TIMELINESAI SEND] ❌ 400 — cek format nomor tujuan');
        break;
      }

      const isRetryable = RETRYABLE.has(err.code) ||
        (err.code === 'ECONNABORTED' && /timeout/i.test(err.message));
      if (!isRetryable || attempt >= maxRetries) break;

      const delay = retryDelay * attempt;  // linear back-off: 3s, 6s, 9s …
      console.warn(`[TIMELINESAI] Send attempt ${attempt}/${maxRetries} failed (${err.code || err.message}). Retry in ${delay}ms…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  if (lastError && maxRetries > 1) {
    const code = lastError.code || '';
    lastError.message = `${lastError.message} (after ${maxRetries} attempts — check TIMELINESAI_RETRY_COUNT / TIMELINESAI_TIMEOUT_MS in .env)`;
    if (code) lastError.code = code;
  }
  throw lastError;
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 4 — AI REPLY (ChatGPT → Claude → Private Agent)
   Memakai whatsappAIService.generateWhatsAppAIReply (sama dengan Fonnte).
══════════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 5 — PROSES PESAN MASUK (background)
   Dipanggil setelah response 200 dikirim ke TimelinesAI. Identik dengan Fonnte.
══════════════════════════════════════════════════════════════════════════════ */

async function processIncomingMessage(body, agent) {
  const { sender, name, message, messageId, isGroup, fromMe } = extractMessage(body);

  // ── Skip media/non-teks, grup & pesan kita sendiri ───────────────────
  if (!message) return;
  if (fromMe) {
    console.log(`[TIMELINESAI] Skip pesan keluar (fromMe) ke ${maskPhone(sender)}`);
    return;
  }
  if (isGroup) {
    console.log(`[TIMELINESAI] Skip pesan grup dari ${maskPhone(sender)}`);
    return;
  }
  // Gema pesan AI kita sendiri (footer "Sent via …") → skip (anti-loop).
  if (isOwnEcho(message)) {
    console.log(`[TIMELINESAI] Skip gema pesan AI sendiri dari ${maskPhone(sender)}`);
    return;
  }

  // ── Dedup guard layer 1: stable message_uid (webhook retries) ───────
  if (_isAlreadyProcessed(messageId)) {
    console.log(`[TIMELINESAI DEDUP] ⚠️  Pesan sudah diproses (ID cache), skip: ${messageId}`);
    return;
  }
  _markProcessed(messageId);

  // ── Dedup guard layer 2: DB check (survive server restart / nodemon) ──
  // Cek messageId di ChatMessage.metadata — mencegah double-process setelah restart.
  if (messageId && !/^sim_/.test(String(messageId))) {
    const safeId = String(messageId).replace(/[^A-Za-z0-9_\-]/g, '');
    if (safeId) {
      try {
        const { Op } = require('sequelize');
        const dbDup = await ChatMessage.findOne({
          where : { channel: 'whatsapp', metadata: { [Op.like]: `%"messageId":"${safeId}"%` } },
          attributes: ['id'],
        });
        if (dbDup) {
          console.log(`[TIMELINESAI DEDUP DB] ⚠️  messageId sudah ada di DB, skip: ${safeId}`);
          return;
        }
      } catch (dedupErr) {
        console.warn('[TIMELINESAI DEDUP DB] Query gagal, lanjut tanpa DB dedup:', dedupErr.message);
      }
    }
  }

  // ── Dedup guard layer 3: content-based (same sender+text within 5 min) ─
  const normSender = normalizePhone(sender);
  if (_isContentDup(normSender, message)) {
    console.log(`[TIMELINESAI DEDUP] ⚠️  Konten sama dari ${normSender} dalam 5 menit, skip.`);
    return;
  }
  _markContentDup(normSender, message);
  const source = `timelinesai_${agent.name.toLowerCase().replace(/\s+/g, '_')}`;

  // ── Cookie response timer: tunggu jeda sebelum proses & balas ─────────
  // Customer sering kirim beberapa pesan terpisah dalam waktu singkat. Tunggu
  // AI_COOKIE_RESPONSE_TIMER ms (.env) sejak pesan TERAKHIR sebelum diproses,
  // supaya pesan susulan tergabung dalam satu balasan (bukan balas terburu-buru
  // ke pesan pertama). Tiap pesan baru me-reset jendela waktu ke penuh.
  debounceMessage(`${source}::${normSender}`, message, (combinedMessage) =>
    handleDebouncedBatch({ combinedMessage, sender, name, normSender, source, agent, messageId })
  );
}

async function handleDebouncedBatch({ combinedMessage, sender, name, normSender, source, agent, messageId }) {
  const message = combinedMessage;
  const ts      = new Date().toISOString();

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
      // Window 12 (bukan 6): alur kualifikasi panjang butuh history lebih lebar agar
      // kata TIPE properti & bukti in-flow tetap terlihat saat jawaban pendek.
      const history = await getConversationHistory(session.id, 12);
      isContinuation = isPropertyContextContinuation(message, history);
    } catch (_) {
      // Jika gagal ambil history, abaikan continuation check (fallthrough ke skip)
    }
  }

  if (!isPropertyQuery && !isContinuation) {
    if (isTerminalActive('TIMELINESAI')) {
      const D = '─'.repeat(62);
      console.log('');
      console.log(D);
      console.log(`[TIMELINESAI] ⬇  PESAN MASUK (bukan query properti — tidak dibalas)`);
      console.log(`[TIMELINESAI]    Agent    : ${sanitizeLog(agent.name, 60)} (${maskPhone(agent.phone)})`);
      console.log(`[TIMELINESAI]    Owner    : User ${sanitizeLog(agent.user_id || '-', 40)}`);
      console.log(`[TIMELINESAI]    Customer : ${maskPhone(sender)} (${maskName(name)})`);
      console.log(`[TIMELINESAI]    Time     : ${ts}`);
      console.log(`[TIMELINESAI]    Message  : ${sanitizeLog(message, 120)}`);
      console.log(`[TIMELINESAI]    Status   : ⏭️  Tidak disimpan ke DB, AI skip (bukan query properti)`);
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
    metadata      : JSON.stringify({ agentName: agent.name, messageId, platform: 'timelinesai' })
  });

  // ── Generate AI reply (dengan property context injection) ────────────
  let aiResult;
  let ctxSource = 'none';
  try {
    const result = await generateWhatsAppAIReply({
      session,
      message,
      agentName  : agent.name,
      agentUserId: agent.user_id,   // scoping katalog per-agent (RESPOND_CATALOG_RUN=ON)
    });
    aiResult = result;
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

  // ── Kirim via TimelinesAI (shared key) ────────────────────────────────
  // replyParts: summary/lead-in as one message, then one message per catalog
  // property card (RESPOND_CATALOG_RUN=ON). Falls back to a single message
  // when no cards are present (e.g. the "no catalog match" apology).
  let sent      = false;
  let sendError = null;
  const replyParts = aiResult.replyParts && aiResult.replyParts.length ? aiResult.replyParts : [aiResult.reply];

  try {
    for (const part of replyParts) {
      await sendViaTimelinesAI(sender, part);
    }
    sent = true;
    safeLog('TIMELINESAI_REPLY_SENT', {
      sessionId  : session.id,
      agent      : agent.name,
      recipient  : sender,
      aiProvider : aiResult.provider,
      parts      : replyParts.length,
      ctxSource
    });
  } catch (err) {
    sendError = err.message;
    safeLog('TIMELINESAI_REPLY_SEND_FAILED', { sessionId: session.id, agent: agent.name, error: err.message }, 'error');
  }

  // ── LOG RINGKASAN TERMINAL (FULL RESPONSE) ──────────────────────────
  if (isTerminalActive('TIMELINESAI')) {
    const D          = '═'.repeat(80);
    const sendStatus = sent ? `✅ Terkirim` : `❌ Gagal: ${sanitizeLog(sendError, 80)}`;

    const safeReply  = String(aiResult.reply || '')
      .replace(/\x1B\[[0-9;]*[mGKHFABCDJsulnhr]/g, '')
      .replace(/\x00/g, '');

    console.log('');
    console.log(D);
    console.log(`[TIMELINESAI] ⬇  PESAN PROPERTI MASUK & DIBALAS`);
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

class TimelinesAIChatController {

  /* ─────────────────────────────────────────────────────────────────────
     POST /api/timelinesai/webhook
     Endpoint utama. Set URL ini di TimelinesAI → Integrations → Webhooks.

     Alur (identik dengan Fonnte):
       1. Terima payload → log raw
       2. detectEventType
       3. Jika bukan incoming → langsung return 200
       4. Jika incoming → return 200 DULU, lalu proses background
  ───────────────────────────────────────────────────────────────────── */
  static async handleInboundMessage(req, res) {
    const body = req.body || {};

    // ── Log raw payload ─────────────────────────────────────────────
    console.log('\n╔══════════ TIMELINESAI WEBHOOK MASUK ══════════╗');
    console.log(`║ Time  : ${new Date().toISOString().padEnd(31)} ║`);
    console.log(`║ Keys  : ${String(Object.keys(body).join(', ')).substring(0, 31).padEnd(31)} ║`);
    console.log('╚═══════════════════════════════════════════════╝');
    console.log('[TIMELINESAI RAW]', JSON.stringify(body).substring(0, 300));

    // ── Detect event type ───────────────────────────────────────────
    const eventType = detectEventType(body);
    console.log(`[TIMELINESAI EVENT] Type: ${eventType}`);

    // ── Handle status update ────────────────────────────────────────
    if (eventType === 'message_status') {
      return res.status(process.env.HTTP_OK).json({ status: true, type: 'message_status', message: 'Status diterima' });
    }

    // ── Handle send notification (pesan keluar / kita sendiri) ──────
    if (eventType === 'send') {
      return res.status(process.env.HTTP_OK).json({ status: true, type: 'send', message: 'Send event diterima' });
    }

    // ── Handle unknown ──────────────────────────────────────────────
    if (eventType !== 'incoming') {
      return res.status(process.env.HTTP_OK).json({ status: true, type: 'unknown', message: 'Event diterima' });
    }

    // ── INCOMING MESSAGE ────────────────────────────────────────────
    // Respond 200 SEKARANG sebelum proses AI (hindari TimelinesAI timeout)
    res.status(process.env.HTTP_OK).json({ status: true, type: 'incoming', message: 'Webhook diterima' });

    // Proses di background (tidak block response)
    setImmediate(async () => {
      try {
        const { accountPhone } = extractMessage(body);

        // Strategi 1: cari agent by nomor WA terhubung (whatsapp_account.phone)
        let agent = null;
        if (accountPhone) {
          agent = await findAgentByAccount(accountPhone);
        }

        // Strategi 2: jika tidak cocok, pakai agent pertama
        if (!agent) {
          const allAgents = await getAllAgents();
          if (allAgents.length > 0) {
            agent = allAgents[0];
            console.log(`[TIMELINESAI AGENT] Auto-select: ${agent.name}`);
          }
        }

        if (!agent) {
          console.warn('[TIMELINESAI] Tidak ada agent aktif di database');
          return;
        }

        await processIncomingMessage(body, agent);

      } catch (err) {
        console.error('[TIMELINESAI BACKGROUND ERROR]', err.message, err.stack);
        safeLog('TIMELINESAI_BACKGROUND_ERROR', { error: err.message }, 'error');
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     POST /api/timelinesai/webhook-raw
     Debug endpoint — log semua payload mentah dari TimelinesAI
  ───────────────────────────────────────────────────────────────────── */
  static async webhookRawCatcher(req, res) {
    const body = req.body || {};
    const ts   = new Date().toISOString();

    console.log('\n╔════════════ TIMELINESAI RAW CATCHER ════════════╗');
    console.log(`║ ${ts.padEnd(46)} ║`);
    console.log(`║ Keys: ${String(Object.keys(body).join(', ')).substring(0, 39).padEnd(39)} ║`);
    console.log('╚═════════════════════════════════════════════════╝');
    console.log('[RAW PAYLOAD]', JSON.stringify(body, null, 2));

    const eventType = detectEventType(body);
    console.log('[TIMELINESAI RAW CATCHER] Detected event:', eventType);

    if (eventType === 'incoming') {
      console.log('[TIMELINESAI RAW CATCHER] ✅ Ini incoming message → teruskan ke handler...');
      return TimelinesAIChatController.handleInboundMessage(req, res);
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
     POST /api/timelinesai/simulate
     Test endpoint — simulasi pesan masuk tanpa WA asli
  ───────────────────────────────────────────────────────────────────── */
  static async simulateInboundMessage(req, res) {
    const {
      sender   = '628999888777',
      message  = 'Halo, saya mau tanya properti',
      account  = null,            // nomor WA agent terhubung (whatsapp_account.phone)
      name     = 'Test Customer',
      dry_run  = false
    } = req.body || {};

    console.log('\n[TIMELINESAI SIMULATE] 🧪 Simulasi pesan masuk');
    console.log(`  From    : ${sender} (${name})`);
    console.log(`  Account : ${account || '(auto)'}`);
    console.log(`  Message : ${message}`);
    console.log(`  Dry run : ${dry_run}`);

    if (!sender || !message) {
      return res.status(process.env.HTTP_BAD_REQUEST).json({ success: false, message: 'Wajib ada: sender dan message' });
    }

    let agent = account ? await findAgentByAccount(account) : null;
    if (!agent) {
      const all = await getAllAgents();
      if (all.length > 0) agent = all[0];
    }

    if (!agent) {
      return res.status(process.env.HTTP_NOT_FOUND).json({
        success : false,
        message : 'Tidak ada agent aktif. Cek /api/timelinesai/status'
      });
    }

    if (dry_run) {
      return res.json({
        success  : true,
        dry_run  : true,
        agent    : agent.name,
        sender,
        message,
        hint     : 'Dry run — tidak ada AI / tidak ada kirim'
      });
    }

    // Proses penuh — bentuk payload menyerupai webhook TimelinesAI
    try {
      const fakeBody = {
        event_type: 'message:received:new',
        chat   : { chat_id: `sim_${Date.now()}`, phone: sender, full_name: name, is_group: false },
        whatsapp_account: { phone: account || agent.phone },
        message: { text: message, direction: 'received', message_uid: `sim_${Date.now()}`, sender: { phone: sender, full_name: name } }
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
     GET /api/timelinesai/agents
  ───────────────────────────────────────────────────────────────────── */
  static async getRegisteredAgents(req, res) {
    try {
      const agents = await getAllAgents();
      return res.json({
        success : true,
        data    : {
          agents: agents.map(a => ({
            user_id : a.user_id,
            name    : a.name,
            phone   : a.phone
            // TIDAK return API key ke client (security)
          })),
          total: agents.length
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/timelinesai/agent-chats/:agentName
  ───────────────────────────────────────────────────────────────────── */
  static async getAgentChats(req, res) {
    try {
      const { agentName }              = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const source   = `timelinesai_${agentName.toLowerCase().replace(/\s+/g, '_')}`;
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
     GET /api/timelinesai/chat-history/:sessionId
  ───────────────────────────────────────────────────────────────────── */
  static async getChatHistory(req, res) {
    try {
      const { sessionId }  = req.params;
      const { limit = 100} = req.query;

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
     GET /api/timelinesai/status
  ───────────────────────────────────────────────────────────────────── */
  static async getStatus(req, res) {
    try {
      const agents     = await getAllAgents();
      const keyPresent = !!String(process.env.TIMELINESAI_API_KEY || '').trim();

      return res.json({
        success : true,
        data    : {
          api_key_configured: keyPresent,           // boolean saja — JANGAN return key
          api_base          : apiBase(),
          terminal_active   : isTerminalActive('TIMELINESAI'),
          total             : agents.length,
          agents            : agents.map(a => ({
            user_id   : a.user_id,
            name      : a.name,
            phone     : a.phone,
            has_phone : !!(a.phone && a.phone.trim()),
            ready     : !!(a.phone && a.phone.trim()) && keyPresent
          }))
        },
        message: keyPresent ? `${agents.length} agent siap TimelinesAI` : 'TIMELINESAI_API_KEY belum di-set di .env'
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/timelinesai/debug-info
  ───────────────────────────────────────────────────────────────────── */
  static async getDebugInfo(req, res) {
    try {
      const agents = await getAllAgents();

      return res.json({
        success: true,
        data   : {
          server: { port: process.env.PORT || 5005, webhookUrl: 'POST /api/timelinesai/webhook' },
          api   : { base: apiBase(), key_configured: !!String(process.env.TIMELINESAI_API_KEY || '').trim() },
          agents: agents.map(a => ({
            user_id          : a.user_id,
            name             : a.name,
            phone_raw        : a.phone,
            phone_normalized : normalizePhone(a.phone || '')
          }))
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/timelinesai/check-api
     Test apakah TimelinesAI API bisa dihubungi (paralel checkFonnteApi).
  ───────────────────────────────────────────────────────────────────── */
  static async checkTimelinesApi(req, res) {
    try {
      const apiKey = String(process.env.TIMELINESAI_API_KEY || '').trim();
      if (!apiKey) {
        return res.status(process.env.HTTP_NOT_FOUND).json({ success: false, message: 'TIMELINESAI_API_KEY belum di-set di .env' });
      }

      const results = {};
      // GET chats — endpoint baca untuk verifikasi konektivitas + auth
      try {
        const r = await axios.get(`${apiBase()}/chats`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          params : { page: 1, per_page: 1 },
          timeout: 8000
        });
        results.chats = { status: r.status, preview: JSON.stringify(r.data).substring(0, 300) };
      } catch (err) {
        results.chats = { status: err?.response?.status || 'error', error: err.message };
      }

      return res.json({ success: true, api_base: apiBase(), results });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }
}

module.exports = TimelinesAIChatController;

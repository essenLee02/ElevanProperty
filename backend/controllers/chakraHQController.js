/**
 * chakraHQController.js
 *
 * Multi-agent ChakraHQ WhatsApp handler.
 *
 * ARSITEKTUR:
 *   - Setiap agent punya chakra_hq_token sendiri (kolom chakra_hq_token di tabel users)
 *   - Webhook ChakraHQ masuk → deteksi event → cari agent by token / phone
 *   - Generate AI reply (ChatGPT → Claude → Private Agent)
 *   - Kirim balasan pakai ChakraHQ API dengan token milik agent itu sendiri
 *
 * DETECTION LOGIC:
 *   ChakraHQ mengirim webhook dengan format:
 *     - incoming : body.type === 'incoming' / body.event === 'message' / body.phone + body.message
 *     - status   : body.type === 'status' / body.event === 'status'
 *
 * ENDPOINT UTAMA:
 *   POST /api/chakrahq/webhook  ← set ini di ChakraHQ Dashboard → Chatbot → Webhook URL
 *
 * API REFERENCE:
 *   Base URL : https://api.chakrahq.com/v1/ext/
 *   Auth     : Authorization: Bearer {chakra_hq_token}
 *   Send msg : POST /v1/ext/message/send-text
 *   List chat: POST /v1/ext/chat
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
const { sanitizeLog, maskPhone, maskName } = require('../utils/whatsappUtils');

const { isAlreadyProcessed: _isAlreadyProcessed,
        markProcessed:      _markProcessed,
        isContentAlreadyProcessed: _isContentDup,
        markContentProcessed:      _markContentDup } = require('../utils/messageDedup');

const CHAKRA_BASE_URL = 'https://api.chakrahq.com/v1/ext';

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 1 — UTILITY FUNCTIONS
══════════════════════════════════════════════════════════════════════════════ */

function normalizePhone(phone) {
  return String(phone || '')
    .replace(/\+62/g, '62')
    .replace(/^0/, '62')
    .replace(/[\s\-()]/g, '');
}

/**
 * Deteksi jenis event dari payload ChakraHQ.
 *
 * ChakraHQ bisa mengirim format:
 *   - { type: 'incoming', phone, message, name, messageId }
 *   - { event: 'message',  data: { phone, message, name } }
 *   - { phone, message }  ← format sederhana
 *   - { type: 'status', ... } atau { event: 'status', ... }
 *
 * @param {object} body - req.body dari webhook ChakraHQ
 * @returns {'incoming'|'status'|'unknown'}
 */
function detectEventType(body) {
  if (!body || typeof body !== 'object') return 'unknown';

  // Format eksplisit dengan field type/event
  if (body.type === 'incoming' || body.event === 'message')  return 'incoming';
  if (body.type === 'status'   || body.event === 'status')   return 'status';
  if (body.type === 'read'     || body.event === 'read')     return 'status';
  if (body.type === 'sent'     || body.event === 'sent')     return 'status';

  // Format fallback: ada phone + message → incoming
  const phone = body.phone || body.from || body.sender || body.waId || '';
  const msg   = body.message || body.text || body.body || (body.data && body.data.message) || '';
  if (phone && msg !== undefined) return 'incoming';

  return 'unknown';
}

/**
 * Ekstrak field standar dari bermacam-macam format payload ChakraHQ.
 */
function extractFields(body) {
  const data    = body.data || body;
  const phone   = data.phone   || data.from   || data.sender || data.waId   || body.phone   || body.sender || '';
  const name    = data.name    || data.pushname || data.contact || body.name || 'Customer';
  const message = data.message || data.text    || data.body  || body.message || body.text   || '';
  const msgId   = data.messageId || data.id    || body.messageId || body.id  || `chakra_${Date.now()}`;
  // devicePhone: nomor WA agent yang menerima (dipakai untuk match token di DB)
  const devicePhone = data.devicePhone || data.device || body.devicePhone || body.device || '';

  return { phone, name, message: String(message).trim(), msgId, devicePhone };
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 2 — AGENT LOOKUP
══════════════════════════════════════════════════════════════════════════════ */

async function getAllAgentsWithChakra() {
  const agents = await User.findAll({
    where      : { privilege: 'agent', status: 1 },
    attributes : ['id', 'user_id', 'name', 'phone', 'username', 'chakra_hq_token'],
    order      : [['created_date', 'ASC']]
  });
  return agents.filter(a => a.chakra_hq_token && String(a.chakra_hq_token).trim().length > 10);
}

/**
 * Cari agent berdasarkan nomor device (phone agent) atau fallback ke agent pertama.
 */
async function findAgentByDevice(devicePhone) {
  if (!devicePhone) return null;
  const normDevice = normalizePhone(devicePhone);
  const agents     = await getAllAgentsWithChakra();

  for (const agent of agents) {
    if (agent.phone && normalizePhone(agent.phone) === normDevice) {
      console.log(`[CHAKRAHQ AGENT] ✅ Match: ${agent.name} (${agent.phone})`);
      return agent;
    }
  }

  console.warn(`[CHAKRAHQ AGENT] Tidak ada match untuk device: ${devicePhone} (normalized: ${normDevice})`);
  console.warn(`[CHAKRAHQ AGENT] Agent terdaftar:`,
    agents.map(a => `${a.name}: ${normalizePhone(a.phone || '')}`).join(', ')
  );
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 3 — KIRIM PESAN via CHAKRAHQ API
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Kirim pesan WhatsApp menggunakan Access Token ChakraHQ milik agent.
 *
 * @param {string} targetPhone  - Nomor tujuan (customer), format 628xxx
 * @param {string} message      - Isi pesan teks
 * @param {string} agentToken   - Token dari users.chakra_hq_token
 */
async function sendViaChakraHQ(targetPhone, message, agentToken) {
  const target     = normalizePhone(targetPhone);
  const timeout    = parseInt(process.env.CHAKRAHQ_TIMEOUT_MS    || '30000', 10);
  const maxRetries = parseInt(process.env.CHAKRAHQ_RETRY_COUNT   || '3',     10);
  const retryDelay = parseInt(process.env.CHAKRAHQ_RETRY_DELAY_MS || '3000', 10);

  const RETRYABLE = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ENETUNREACH', 'ECONNABORTED']);

  const payload = {
    phone  : target,
    message: String(message).trim()
  };

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        `${CHAKRA_BASE_URL}/message/send-text`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${String(agentToken).trim()}`,
            'Content-Type' : 'application/json'
          },
          timeout
        }
      );

      // ChakraHQ mengembalikan status error di body
      if (response.data && response.data.status === false) {
        const reason = response.data.message || response.data.error || 'ChakraHQ: gagal kirim';
        throw new Error(reason);
      }

      if (attempt > 1) {
        console.log(`[CHAKRAHQ] Send succeeded on attempt ${attempt}/${maxRetries}`);
      }
      return response.data;

    } catch (err) {
      lastError = err;

      const isRetryable = RETRYABLE.has(err.code) ||
        (err.code === 'ECONNABORTED' && /timeout/i.test(err.message));
      if (!isRetryable || attempt >= maxRetries) break;

      const delay = retryDelay * attempt;
      console.warn(`[CHAKRAHQ] Send attempt ${attempt}/${maxRetries} failed (${err.code || err.message}). Retry in ${delay}ms…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  if (lastError && maxRetries > 1) {
    const code = lastError.code || '';
    lastError.message = `${lastError.message} (after ${maxRetries} attempts — check CHAKRAHQ_RETRY_COUNT / CHAKRAHQ_TIMEOUT_MS in .env)`;
    if (code) lastError.code = code;
  }
  throw lastError;
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 4 — PROSES PESAN MASUK (background)
══════════════════════════════════════════════════════════════════════════════ */

async function processIncomingMessage(fields, agent) {
  const { phone: sender, name, message, msgId: messageId } = fields;
  const ts = new Date().toISOString();

  if (!message) return;

  // ── Dedup layer 1: message ID ─────────────────────────────────────────
  if (_isAlreadyProcessed(messageId)) {
    console.log(`[CHAKRAHQ DEDUP] ⚠️  Pesan sudah diproses (ID), skip: ${messageId}`);
    return;
  }
  _markProcessed(messageId);

  // ── Dedup layer 2: konten (sender+teks dalam 90s) ─────────────────────
  const normSender = normalizePhone(sender);
  if (_isContentDup(normSender, message)) {
    console.log(`[CHAKRAHQ DEDUP] ⚠️  Konten sama dari ${normSender} dalam 90s, skip.`);
    return;
  }
  _markContentDup(normSender, message);

  const source = `chakrahq_${agent.name.toLowerCase().replace(/\s+/g, '_')}`;

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

  // ── Property keyword check ────────────────────────────────────────────
  const isPropertyQuery = hasPropertyKeyword(message);
  let isContinuation = false;

  if (!isPropertyQuery) {
    try {
      const history  = await getConversationHistory(session.id, 6);
      isContinuation = isPropertyContextContinuation(message, history);
    } catch (_) { /* abaikan */ }
  }

  if (!isPropertyQuery && !isContinuation) {
    if (isTerminalActive('CHAKRAHQ')) {
      const D = '─'.repeat(62);
      console.log('');
      console.log(D);
      console.log(`[CHAKRAHQ] ⬇  PESAN MASUK (bukan query properti — tidak dibalas)`);
      console.log(`[CHAKRAHQ]    Agent    : ${sanitizeLog(agent.name, 60)} (${maskPhone(agent.phone)})`);
      console.log(`[CHAKRAHQ]    Customer : ${maskPhone(sender)} (${maskName(name)})`);
      console.log(`[CHAKRAHQ]    Time     : ${ts}`);
      console.log(`[CHAKRAHQ]    Message  : ${sanitizeLog(message, 200)}`);
      console.log(`[CHAKRAHQ]    Status   : ⏭️  Tidak disimpan ke DB, AI skip (bukan query properti)`);
      console.log(D);
      console.log('');
    }
    return;
  }

  // ── Simpan pesan customer ─────────────────────────────────────────────
  await ChatMessage.create({
    chatSessionId : session.id,
    role          : 'customer',
    message,
    channel       : 'whatsapp',
    metadata      : JSON.stringify({ agentName: agent.name, messageId, platform: 'chakrahq' })
  });

  // ── Generate AI reply ─────────────────────────────────────────────────
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
      reply    : `Halo ${name}, terima kasih menghubungi ${agent.name} dari ${appName}. Saya akan segera membantu mencari properti yang sesuai. 🏠`,
      provider : 'fallback',
      contextSource: 'none'
    };
    ctxSource = 'none';
  }

  // ── Simpan AI reply ───────────────────────────────────────────────────
  await ChatMessage.create({
    chatSessionId : session.id,
    role          : 'ai',
    message       : aiResult.reply,
    channel       : 'whatsapp',
    metadata      : JSON.stringify({ aiProvider: aiResult.provider, contextSource: ctxSource })
  });

  // ── Kirim via ChakraHQ ────────────────────────────────────────────────
  let chakraSent  = false;
  let chakraError = null;

  try {
    await sendViaChakraHQ(sender, aiResult.reply, agent.chakra_hq_token);
    chakraSent = true;
    safeLog('CHAKRAHQ_REPLY_SENT', {
      sessionId  : session.id,
      agent      : agent.name,
      recipient  : sender,
      aiProvider : aiResult.provider,
      ctxSource
    });
  } catch (err) {
    chakraError = err.message;
    safeLog('CHAKRAHQ_REPLY_SEND_FAILED', { sessionId: session.id, agent: agent.name, error: err.message }, 'error');
  }

  // ── Log terminal ──────────────────────────────────────────────────────
  if (isTerminalActive('CHAKRAHQ')) {
    const D          = '═'.repeat(80);
    const sendStatus = chakraSent ? `✅ Terkirim` : `❌ Gagal: ${sanitizeLog(chakraError, 80)}`;
    const safeReply  = String(aiResult.reply || '')
      .replace(/\x1B\[[0-9;]*[mGKHFABCDJsulnhr]/g, '')
      .replace(/\x00/g, '');

    console.log('');
    console.log(D);
    console.log(`[CHAKRAHQ] ⬇  PESAN PROPERTI MASUK & DIBALAS`);
    console.log(D);
    console.log(`[CHAKRAHQ] Agent    : ${sanitizeLog(agent.name, 60)} (${maskPhone(agent.phone)})`);
    console.log(`[CHAKRAHQ] Customer : ${maskPhone(sender)} (${maskName(name)})`);
    console.log(`[CHAKRAHQ] Time     : ${ts}`);
    console.log(`[CHAKRAHQ] Message  : ${sanitizeLog(message, 300)}`);
    console.log(`[CHAKRAHQ] Context  : ${sanitizeLog(ctxSource, 60)}`);
    console.log(`[CHAKRAHQ] AI       : ${sanitizeLog(aiResult.provider, 40)}`);
    console.log(D);
    console.log('[CHAKRAHQ] RESPONSE:');
    console.log(D);
    console.log(safeReply);
    console.log(D);
    console.log(`[CHAKRAHQ] Send Status: ${sendStatus}`);
    console.log(D);
    console.log('');
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 5 — CONTROLLER CLASS
══════════════════════════════════════════════════════════════════════════════ */

class FonnteChakraHQController {

  /* ─────────────────────────────────────────────────────────────────────
     POST /api/chakrahq/webhook
     ─────────────────────────────────────────────────────────────────────
     Alur:
       1. Terima payload → log raw
       2. detectEventType
       3. Bukan incoming → langsung return 200
       4. Incoming → return 200 DULU, lalu proses AI di background
  ───────────────────────────────────────────────────────────────────── */
  static async handleInboundMessage(req, res) {
    const body = req.body || {};

    console.log('\n╔══════════ CHAKRAHQ WEBHOOK MASUK ══════════╗');
    console.log(`║ Time  : ${new Date().toISOString().padEnd(33)} ║`);
    console.log(`║ Keys  : ${String(Object.keys(body).join(', ')).substring(0, 33).padEnd(33)} ║`);
    console.log('╚════════════════════════════════════════════╝');

    if (isTerminalActive('CHAKRAHQ')) {
      const fields = extractFields(body);
      if (fields.message) {
        console.log(`[CHAKRAHQ] 📩 From   : ${maskPhone(fields.phone)} (${maskName(fields.name)})`);
        console.log(`[CHAKRAHQ] 💬 Message: ${sanitizeLog(fields.message, 200)}`);
      }
    }
    console.log('[CHAKRAHQ RAW]', JSON.stringify(body).substring(0, 300));

    const eventType = detectEventType(body);
    console.log(`[CHAKRAHQ EVENT] Type: ${eventType}`);

    if (eventType === 'status') {
      return res.status(process.env.HTTP_OK).json({ status: true, type: 'status', message: 'Status diterima' });
    }

    if (eventType !== 'incoming') {
      return res.status(process.env.HTTP_OK).json({ status: true, type: 'unknown', message: 'Event diterima' });
    }

    // Respond 200 SEKARANG — jangan biarkan ChakraHQ timeout
    res.status(process.env.HTTP_OK).json({ status: true, type: 'incoming', message: 'Webhook diterima' });

    setImmediate(async () => {
      try {
        const fields      = extractFields(body);
        const devicePhone = fields.devicePhone;

        let agent = null;
        if (devicePhone) {
          agent = await findAgentByDevice(devicePhone);
        }

        if (!agent) {
          const allAgents = await getAllAgentsWithChakra();
          if (allAgents.length > 0) {
            agent = allAgents[0];
            console.log(`[CHAKRAHQ AGENT] Auto-select: ${agent.name}`);
          }
        }

        if (!agent) {
          console.warn('[CHAKRAHQ] Tidak ada agent dengan chakra_hq_token aktif di database');
          return;
        }

        await processIncomingMessage(fields, agent);

      } catch (err) {
        console.error('[CHAKRAHQ BACKGROUND ERROR]', err.message, err.stack);
        safeLog('CHAKRAHQ_BACKGROUND_ERROR', { error: err.message }, 'error');
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     POST /api/chakrahq/webhook-raw
     Debug endpoint — log semua payload mentah dari ChakraHQ
  ───────────────────────────────────────────────────────────────────── */
  static async webhookRawCatcher(req, res) {
    const body = req.body || {};
    const ts   = new Date().toISOString();

    console.log('\n╔══════════ CHAKRAHQ RAW CATCHER ══════════╗');
    console.log(`║ ${ts.padEnd(41)} ║`);
    console.log(`║ Keys: ${String(Object.keys(body).join(', ')).substring(0, 35).padEnd(35)} ║`);
    console.log('╚═══════════════════════════════════════════╝');
    console.log('[CHAKRAHQ RAW PAYLOAD]', JSON.stringify(body, null, 2));

    const eventType = detectEventType(body);
    console.log('[CHAKRAHQ RAW CATCHER] Detected event:', eventType);

    if (eventType === 'incoming') {
      console.log('[CHAKRAHQ RAW CATCHER] ✅ Incoming → teruskan ke handler...');
      return FonnteChakraHQController.handleInboundMessage(req, res);
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
     POST /api/chakrahq/simulate
     Test endpoint — simulasi pesan masuk tanpa WA asli
  ───────────────────────────────────────────────────────────────────── */
  static async simulateInboundMessage(req, res) {
    const {
      sender   = '628999888777',
      message  = 'Halo, saya mau tanya properti',
      device   = null,
      name     = 'Test Customer',
      dry_run  = false
    } = req.body || {};

    console.log('\n[CHAKRAHQ SIMULATE] 🧪 Simulasi pesan masuk');
    console.log(`  From   : ${sender} (${name})`);
    console.log(`  Device : ${device || '(auto)'}`);
    console.log(`  Message: ${message}`);
    console.log(`  Dry run: ${dry_run}`);

    if (!sender || !message) {
      return res.status(process.env.HTTP_BAD_REQUEST).json({ success: false, message: 'Wajib ada: sender dan message' });
    }

    let agent = device ? await findAgentByDevice(device) : null;
    if (!agent) {
      const all = await getAllAgentsWithChakra();
      if (all.length > 0) agent = all[0];
    }

    if (!agent) {
      return res.status(process.env.HTTP_NOT_FOUND).json({
        success : false,
        message : 'Tidak ada agent dengan chakra_hq_token. Cek /api/chakrahq/status'
      });
    }

    if (dry_run) {
      return res.json({
        success: true,
        dry_run: true,
        agent  : agent.name,
        sender,
        message,
        hint   : 'Dry run — tidak ada AI / tidak ada kirim'
      });
    }

    try {
      const fakeFields = {
        phone      : sender,
        name,
        message,
        msgId      : `sim_${Date.now()}`,
        devicePhone: device || agent.phone || ''
      };
      await processIncomingMessage(fakeFields, agent);

      return res.json({
        success: true,
        message: 'Simulate selesai. Lihat terminal untuk output.',
        agent  : agent.name,
        sender
      });

    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/chakrahq/agents
  ───────────────────────────────────────────────────────────────────── */
  static async getAgentsWithChakra(req, res) {
    try {
      const agents = await getAllAgentsWithChakra();
      return res.json({
        success: true,
        data   : {
          agents: agents.map(a => ({
            user_id      : a.user_id,
            name         : a.name,
            phone        : a.phone,
            chakra_ready : true
            // TIDAK return chakra_hq_token ke client (security)
          })),
          total: agents.length
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/chakrahq/agent-chats/:agentName
  ───────────────────────────────────────────────────────────────────── */
  static async getAgentChats(req, res) {
    try {
      const { agentName }              = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const source   = `chakrahq_${agentName.toLowerCase().replace(/\s+/g, '_')}`;
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
     GET /api/chakrahq/chat-history/:sessionId
  ───────────────────────────────────────────────────────────────────── */
  static async getChatHistory(req, res) {
    try {
      const { sessionId }   = req.params;
      const { limit = 100 } = req.query;

      const session = await ChatSession.findByPk(sessionId);
      if (!session) {
        return res.status(process.env.HTTP_NOT_FOUND).json({ success: false, message: 'Sesi tidak ditemukan' });
      }

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
     GET /api/chakrahq/status
  ───────────────────────────────────────────────────────────────────── */
  static async getChakraStatus(req, res) {
    try {
      const allAgents = await User.findAll({
        where      : { privilege: 'agent', status: 1 },
        attributes : ['user_id', 'name', 'phone', 'chakra_hq_token']
      });

      const ready = allAgents.filter(a => a.chakra_hq_token && a.chakra_hq_token.trim().length > 10);

      return res.json({
        success : true,
        data    : {
          total        : allAgents.length,
          chakra_ready : ready.length,
          agents       : allAgents.map(a => ({
            user_id        : a.user_id,
            name           : a.name,
            phone          : a.phone,
            has_phone      : !!(a.phone && a.phone.trim()),
            has_token      : !!(a.chakra_hq_token && a.chakra_hq_token.trim().length > 10),
            ready          : !!(a.phone && a.chakra_hq_token && a.chakra_hq_token.trim().length > 10)
          }))
        },
        message: `${ready.length} dari ${allAgents.length} agent siap ChakraHQ`
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/chakrahq/debug-info
  ───────────────────────────────────────────────────────────────────── */
  static async getDebugInfo(req, res) {
    try {
      const agents = await User.findAll({
        where      : { privilege: 'agent', status: 1 },
        attributes : ['user_id', 'name', 'phone', 'chakra_hq_token']
      });

      return res.json({
        success: true,
        data   : {
          server: { port: process.env.PORT || 5005, webhookUrl: 'POST /api/chakrahq/webhook' },
          agents: agents.map(a => ({
            user_id           : a.user_id,
            name              : a.name,
            phone_raw         : a.phone,
            phone_normalized  : normalizePhone(a.phone || ''),
            has_chakra_token  : !!(a.chakra_hq_token && a.chakra_hq_token.trim().length > 10),
            ready             : !!(a.phone && a.chakra_hq_token && a.chakra_hq_token.trim().length > 10)
          }))
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/chakrahq/check-api
     Test koneksi ke ChakraHQ API menggunakan token agent pertama
  ───────────────────────────────────────────────────────────────────── */
  static async checkChakraApi(req, res) {
    try {
      const agents = await getAllAgentsWithChakra();
      if (agents.length === 0) {
        return res.status(process.env.HTTP_NOT_FOUND).json({
          success: false, message: 'Tidak ada agent dengan chakra_hq_token'
        });
      }

      const target    = agents[0];
      const tokenStr  = `Bearer ${String(target.chakra_hq_token).trim()}`;
      const results   = {};

      // Test list chats (endpoint yang sudah diketahui dari API docs)
      try {
        const r = await axios.post(
          `${CHAKRA_BASE_URL}/chat`,
          { orderField: 'createdAt', limit: 1, page: 1 },
          { headers: { Authorization: tokenStr, 'Content-Type': 'application/json' }, timeout: 8000 }
        );
        results.list_chat = { status: r.status, preview: JSON.stringify(r.data).substring(0, 300) };
      } catch (err) {
        results.list_chat = { status: err?.response?.status || 'error', error: err.message };
      }

      return res.json({ success: true, agent: target.name, results });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }
}

module.exports = FonnteChakraHQController;

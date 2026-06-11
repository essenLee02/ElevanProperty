/**
 * watiChatController.js
 *
 * Multi-agent WhatsApp handler untuk platform WATI.
 *
 * ARSITEKTUR (mengikuti pola fonnteChatController.js):
 *  - Webhook masuk → return 200 DULU → proses AI di background (setImmediate)
 *  - Identifikasi agent dari payload (4 strategi, karena WATI pakai shared token)
 *  - Generate AI reply (ChatGPT → Claude → Private Agent)
 *  - Kirim balasan via WatiService (shared WATI_API_TOKEN dari .env)
 *  - Log ke terminal (format sama dengan Fonnte)
 *
 * PERBEDAAN DENGAN FONNTE:
 *  - Fonnte: per-agent token (fonnte_token di kolom users)
 *  - WATI: satu shared token dari WATI_API_TOKEN env
 *  - WATI: identifikasi agent dari payload (bukan dari field "device")
 *
 * PERBEDAAN PAYLOAD FORMAT:
 *  - Fonnte: { sender, message, device, name, ... }
 *  - WATI: { waId, text: { body }, owner, senderName, assignedOperator, ... }
 */

'use strict';

const { User, ChatSession, ChatMessage } = require('../models');
const WatiService                        = require('../services/watiService');
const { safeLog }                        = require('../utils/safeLog');
const { hasPropertyKeyword,
        isPropertyContextContinuation }  = require('../utils/propertyKeywordFilter');
const { generateWhatsAppAIReply }        = require('../services/whatsappAIService');
const { getConversationHistory }         = require('../services/sessionService');
const {
  normalizePhone,
  isValidPhone,
  findOrCreateSession,
  saveMessage,
  logTerminalSummary,
  logTerminalSkip,
} = require('../utils/whatsappUtils');

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 1 — AGENT LOOKUP (WATI-specific: 4-strategy identification)
   WATI pakai shared API token, agent diidentifikasi dari payload.
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Ambil semua agent aktif dari database.
 */
async function getAllAgents() {
  try {
    return await User.findAll({
      where      : { privilege: 'agent', status: 1 },
      attributes : ['id', 'user_id', 'name', 'phone', 'username'],
      order      : [['created_date', 'ASC']]
    });
  } catch (err) {
    console.error('[WATI GET AGENTS ERROR]', err.message);
    return [];
  }
}

/**
 * Cari agent berdasarkan nomor telepon (exact match lalu normalized match).
 *
 * @param {string} phoneNumber
 * @returns {Promise<User|null>}
 */
async function findAgentByPhone(phoneNumber) {
  if (!phoneNumber) return null;

  try {
    const normalized = normalizePhone(phoneNumber);

    // Exact match
    const agent = await User.findOne({
      where      : { phone: phoneNumber, privilege: 'agent', status: 1 },
      attributes : ['id', 'user_id', 'name', 'phone', 'username']
    });
    if (agent) {
      console.log(`[WATI AGENT] ✅ Exact match: ${agent.name} (${agent.phone})`);
      return agent;
    }

    // Normalized match — cek semua agent
    const allAgents = await getAllAgents();
    for (const a of allAgents) {
      if (normalizePhone(a.phone) === normalized) {
        console.log(`[WATI AGENT] ✅ Normalized match: ${a.name} (${a.phone}) → ${normalized}`);
        return a;
      }
    }

    console.warn(`[WATI AGENT] Tidak ada match untuk: ${phoneNumber} (normalized: ${normalized})`);
    console.warn(`[WATI AGENT] Agent terdaftar:`, allAgents.map(a => `${a.name}:${normalizePhone(a.phone)}`));
    return null;

  } catch (err) {
    console.error('[WATI AGENT LOOKUP ERROR]', err.message);
    safeLog('WATI_AGENT_LOOKUP_ERROR', { phone: phoneNumber, error: err.message }, 'error');
    return null;
  }
}

/**
 * Identifikasi agent dari payload WATI (4 strategi).
 *
 * WATI Webhook Fields:
 *   waId             = nomor pengirim (customer)
 *   owner            = nomor bisnis WATI (bukan nomor agent personal)
 *   assignedOperator = operator WATI yang handle percakapan
 *   agentPhone       = field custom untuk test payload (curl)
 *
 * Strategi:
 *   1. Field 'agentPhone' (custom test field)
 *   2. assignedOperator.name → match ke nama agent di DB
 *   3. owner field = nomor agent (jarang, tapi coba)
 *   4. Fallback: ambil agent pertama dari DB
 *
 * @param {object} payload - req.body dari WATI webhook
 * @returns {Promise<{ agent: User|null, source: string }>}
 */
async function identifyAgent(payload) {
  const assignedOp      = payload.assignedOperator || null;
  const assignedPhone   = payload.agentPhone        || null;  // Custom field untuk testing
  const businessPhone   = payload.owner             || null;  // Nomor bisnis WATI

  let agent  = null;
  let source = null;

  // Strategi 1: Field 'agentPhone' dari test payload
  if (assignedPhone && isValidPhone(assignedPhone)) {
    agent = await findAgentByPhone(assignedPhone);
    if (agent) source = 'agentPhone_field';
  }

  // Strategi 2: assignedOperator.name → match nama ke DB
  if (!agent && assignedOp?.name) {
    const allAgents = await getAllAgents();
    agent = allAgents.find(a =>
      a.name.toLowerCase().includes(assignedOp.name.toLowerCase()) ||
      assignedOp.name.toLowerCase().includes(a.name.toLowerCase())
    ) || null;
    if (agent) source = 'assignedOperator_name';
  }

  // Strategi 3: owner = nomor agent (jarang tapi coba)
  if (!agent && businessPhone && isValidPhone(businessPhone)) {
    agent = await findAgentByPhone(businessPhone);
    if (agent) source = 'owner_field';
  }

  // Strategi 4: Fallback — ambil agent pertama
  if (!agent) {
    const allAgents = await getAllAgents();
    if (allAgents.length > 0) {
      agent  = allAgents[0];
      source = 'fallback_first';
      console.log(`[WATI AGENT] Auto-select (fallback): ${agent.name}`);
    }
  }

  if (agent) {
    console.log(`[WATI AGENT] ✅ Identified: ${agent.name} (via ${source})`);
  }

  return { agent, source };
}

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 2 — PROSES PESAN MASUK (background)
   Dipanggil setelah response 200 dikirim ke WATI
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Proses lengkap untuk satu pesan WATI masuk:
 *   1. Simpan pesan customer ke DB
 *   2. Cek kata kunci properti
 *   3. Generate AI reply
 *   4. Simpan AI reply ke DB
 *   5. Kirim balasan via WATI
 *   6. Log ke terminal
 *
 * @param {object} payload - WATI webhook body
 * @param {User}   agent
 */
async function processWatiMessage(payload, agent) {
  const customerPhone   = String(payload.waId   || payload.from  || '').trim();
  const customerName    = String(payload.senderName || payload.name || 'Customer').trim();
  const customerMessage = String(payload.text?.body || payload.message || '').trim();
  const messageId       = payload.id || payload.messageId || `wati_${Date.now()}`;
  const ts              = new Date().toISOString();

  // Skip media / pesan kosong
  if (!customerMessage) return;

  // ── Find / create session ────────────────────────────────────────────────
  const session = await findOrCreateSession({
    customerPhone,
    customerName,
    agentName : agent.name,
    platform  : 'wati'
  });

  // ── Simpan pesan customer (selalu, terlepas dari keyword) ────────────────
  await saveMessage(session, 'customer', customerMessage, {
    agentName   : agent.name,
    agentUserId : agent.user_id,
    messageId,
    platform    : 'wati'
  });

  safeLog('WATI_INBOUND_MESSAGE', {
    sessionId     : session.id,
    agentName     : agent.name,
    messageLength : customerMessage.length
  });

  // ── Cek kata kunci properti / lanjutan percakapan ───────────────────────
  const isPropertyQuery = hasPropertyKeyword(customerMessage);

  let isContinuation = false;
  if (!isPropertyQuery) {
    try {
      const history = await getConversationHistory(session.id, 6);
      isContinuation = isPropertyContextContinuation(customerMessage, history);
    } catch (_) { /* skip jika history gagal */ }
  }

  if (!isPropertyQuery && !isContinuation) {
    logTerminalSkip({
      platform       : 'WATI',
      tag            : '[WATI]',
      agent,
      customerPhone,
      customerName,
      ts,
      message        : customerMessage
    });
    return;
  }

  // ── Generate AI reply (ChatGPT → Claude → Private Agent) ────────────────
  let aiResult;
  let ctxSource = 'none';

  try {
    const result = await generateWhatsAppAIReply({
      session,
      message  : customerMessage,
      agentName: agent.name,
    });
    aiResult  = result;
    ctxSource = result.contextSource || 'none';
  } catch (err) {
    const appName = process.env.APP_NAME || 'Elevan Property';
    aiResult = {
      reply         : `Halo ${customerName}, terima kasih menghubungi ${agent.name} dari ${appName}. Saya akan segera membantu mencari properti untuk Anda. 🏠`,
      provider      : 'fallback',
      contextSource : 'none'
    };
    ctxSource = 'none';
  }

  // ── Simpan AI reply ──────────────────────────────────────────────────────
  await saveMessage(session, 'ai', aiResult.reply, {
    aiProvider    : aiResult.provider,
    contextSource : ctxSource
  });

  // ── Kirim via WATI ───────────────────────────────────────────────────────
  let watiSent  = false;
  let watiError = null;

  try {
    await WatiService.sendMessage(customerPhone, aiResult.reply, agent.phone);
    watiSent = true;
    safeLog('WATI_REPLY_SENT', {
      sessionId  : session.id,
      agent      : agent.name,
      recipient  : customerPhone,
      aiProvider : aiResult.provider,
      ctxSource
    });
  } catch (err) {
    watiError = err.message;
    safeLog('WATI_REPLY_SEND_FAILED', { sessionId: session.id, agent: agent.name, error: err.message }, 'error');
  }

  // ── Log terminal (full response, format sama dengan Fonnte) ─────────────
  logTerminalSummary({
    platform      : 'WATI',
    tag           : '[WATI]',
    agent,
    customerPhone,
    customerName,
    ts,
    message       : customerMessage,
    ctxSource,
    aiProvider    : aiResult.provider,
    aiReply       : aiResult.reply,
    sendStatus    : watiSent ? '✅ Terkirim' : `❌ Gagal: ${watiError}`
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 3 — CONTROLLER CLASS
══════════════════════════════════════════════════════════════════════════════ */

class WatiChatController {

  /* ─────────────────────────────────────────────────────────────────────────
     POST /api/wati/webhook
     ─────────────────────────────────────────────────────────────────────────
     Endpoint utama. Konfigurasikan URL ini di WATI Dashboard.

     Alur (mengikuti pola Fonnte):
       1. Terima payload → log raw
       2. Return 200 DULU ke WATI (hindari timeout)
       3. Proses AI + DB di background (setImmediate)
  ───────────────────────────────────────────────────────────────────────── */
  static async handleInboundMessage(req, res) {
    const payload = req.body || {};

    // ── Log raw payload ───────────────────────────────────────────────────
    console.log('\n╔══════════ WATI WEBHOOK MASUK ═══════════════╗');
    console.log(`║ Time  : ${new Date().toISOString().padEnd(35)} ║`);
    console.log(`║ Keys  : ${String(Object.keys(payload).join(', ')).substring(0, 35).padEnd(35)} ║`);
    console.log('╚═════════════════════════════════════════════╝');
    console.log('[WATI RAW]', JSON.stringify(payload).substring(0, 300));

    // ── Return 200 SEGERA ─────────────────────────────────────────────────
    // WATI mengharapkan response cepat. Semua proses AI dilakukan di background.
    res.status(process.env.HTTP_OK).json({ status: true, type: 'incoming', message: 'Webhook diterima' });

    // ── Proses di background ──────────────────────────────────────────────
    setImmediate(async () => {
      try {
        const customerPhone   = String(payload.waId   || payload.from  || '').trim();
        const customerMessage = String(payload.text?.body || payload.message || '').trim();

        // Skip jika tidak ada pesan atau nomor pengirim
        if (!customerPhone || !customerMessage) {
          console.warn('[WATI BACKGROUND] Payload tidak lengkap — skip (waId atau message kosong)');
          return;
        }

        // Identifikasi agent dari payload
        const { agent } = await identifyAgent(payload);

        if (!agent) {
          console.warn('[WATI BACKGROUND] Tidak ada agent ditemukan, pesan tidak diproses');
          safeLog('WATI_AGENT_NOT_FOUND', {
            businessPhone : payload.owner,
            customerPhone,
            assignedOp    : payload.assignedOperator
          }, 'warn');
          return;
        }

        await processWatiMessage(payload, agent);

      } catch (err) {
        console.error('[WATI BACKGROUND ERROR]', err.message, err.stack);
        safeLog('WATI_BACKGROUND_ERROR', { error: err.message }, 'error');
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     POST /api/wati/webhook-raw
     Debug endpoint — log semua payload mentah dari WATI.
     Sama seperti fonnteChatController.webhookRawCatcher.
  ───────────────────────────────────────────────────────────────────────── */
  static async webhookRawCatcher(req, res) {
    const payload = req.body || {};
    const ts      = new Date().toISOString();

    console.log('\n╔════════════ WATI RAW CATCHER ════════════╗');
    console.log(`║ ${ts.padEnd(42)} ║`);
    console.log(`║ Keys: ${String(Object.keys(payload).join(', ')).substring(0, 37).padEnd(37)} ║`);
    console.log('╚═══════════════════════════════════════════╝');
    console.log('[WATI RAW PAYLOAD]', JSON.stringify(payload, null, 2));

    const customerPhone   = String(payload.waId   || payload.from  || '').trim();
    const customerMessage = String(payload.text?.body || payload.message || '').trim();
    const hasIncoming     = !!(customerPhone && customerMessage);

    console.log(`[WATI RAW CATCHER] has_incoming: ${hasIncoming}`);

    if (hasIncoming) {
      console.log('[WATI RAW CATCHER] ✅ Ini incoming message → teruskan ke handler...');
      return WatiChatController.handleInboundMessage(req, res);
    }

    return res.status(process.env.HTTP_OK).json({
      status      : true,
      caught      : true,
      hasIncoming : false,
      payloadKeys : Object.keys(payload),
      raw         : payload
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     POST /api/wati/simulate
     Test endpoint — simulasi pesan masuk tanpa WA asli.
     Membutuhkan autentikasi (dilindungi verifyToken di routes).
  ───────────────────────────────────────────────────────────────────────── */
  static async simulateInboundMessage(req, res) {
    const {
      sender   = '628999888777',
      message  = 'Halo, saya mau tanya properti',
      name     = 'Test Customer',
      agentPhone = null,
      dry_run  = false
    } = req.body || {};

    console.log('\n[WATI SIMULATE] 🧪 Simulasi pesan masuk');
    console.log(`  From    : ${sender} (${name})`);
    console.log(`  Agent   : ${agentPhone || '(auto)'}`);
    console.log(`  Message : ${message}`);
    console.log(`  Dry run : ${dry_run}`);

    if (!sender || !message) {
      return res.status(process.env.HTTP_BAD_REQUEST).json({ success: false, message: 'Wajib ada: sender dan message' });
    }

    // Cari agent
    let agent = agentPhone ? await findAgentByPhone(agentPhone) : null;
    if (!agent) {
      const all = await getAllAgents();
      if (all.length > 0) agent = all[0];
    }

    if (!agent) {
      return res.status(process.env.HTTP_NOT_FOUND).json({
        success : false,
        message : 'Tidak ada agent aktif di database. Cek /api/wati/status'
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

    // Buat fake payload WATI
    const fakePayload = {
      waId       : sender,
      senderName : name,
      text       : { body: message },
      id         : `sim_${Date.now()}`,
      agentPhone : agent.phone
    };

    try {
      await processWatiMessage(fakePayload, agent);
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

  /* ─────────────────────────────────────────────────────────────────────────
     GET /api/wati/agent-chats/:agentName
  ───────────────────────────────────────────────────────────────────────── */
  static async getAgentChats(req, res) {
    try {
      const { agentName }              = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!agentName) {
        return res.status(process.env.HTTP_BAD_REQUEST).json({ success: false, message: 'agentName wajib diisi' });
      }

      const source   = `wati_${agentName.toLowerCase().replace(/\s+/g, '_')}`;
      const sessions = await ChatSession.findAll({
        where  : { source },
        order  : [['updatedAt', 'DESC']],
        limit  : Math.min(parseInt(limit)  || 50, 200),
        offset : parseInt(offset) || 0
      });
      const total = await ChatSession.count({ where: { source } });

      return res.json({
        success: true,
        data   : {
          agent     : agentName,
          sessions,
          pagination: { total, limit: Math.min(parseInt(limit) || 50, 200), offset: parseInt(offset) || 0 }
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GET /api/wati/chat-history/:sessionId
  ───────────────────────────────────────────────────────────────────────── */
  static async getChatHistory(req, res) {
    try {
      const { sessionId }   = req.params;
      const { limit = 100 } = req.query;

      if (!sessionId) {
        return res.status(process.env.HTTP_BAD_REQUEST).json({ success: false, message: 'sessionId wajib diisi' });
      }

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
          session  : { id: session.id, name: session.name, phone: session.phone, source: session.source },
          messages,
          count    : messages.length
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GET /api/wati/agents/list
     Dilindungi verifyToken di routes.
  ───────────────────────────────────────────────────────────────────────── */
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
            // TIDAK return password / token ke client (security)
          })),
          total: agents.length
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GET /api/wati/status
  ───────────────────────────────────────────────────────────────────────── */
  static async getWatiStatus(req, res) {
    try {
      const config   = WatiService.checkWatiConfig();
      let profileOk  = false;
      let profileErr = null;

      if (config.enabled) {
        try {
          await WatiService.getProfile();
          profileOk = true;
        } catch (err) {
          profileErr = err.message;
        }
      }

      const statusCode = config.enabled && profileOk
        ? process.env.HTTP_OK
        : process.env.HTTP_INTERNAL_SERVER_ERROR;

      return res.status(statusCode).json({
        success : config.enabled && profileOk,
        wati    : {
          ...config,
          connected : profileOk,
          error     : profileErr || null
        },
        message : config.enabled && profileOk
          ? 'WATI API terhubung dan aktif'
          : 'Masalah konfigurasi WATI API'
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GET /api/wati/debug-info
     Dilindungi verifyToken di routes.
  ───────────────────────────────────────────────────────────────────────── */
  static async getDebugInfo(req, res) {
    try {
      const agents = await User.findAll({
        where      : { privilege: 'agent', status: 1 },
        attributes : ['user_id', 'name', 'phone']
      });

      return res.json({
        success: true,
        data   : {
          server : { port: process.env.PORT || 5005, webhookUrl: 'POST /api/wati/webhook' },
          wati   : WatiService.checkWatiConfig(),
          agents : agents.map(a => ({
            user_id          : a.user_id,
            name             : a.name,
            phone_raw        : a.phone,
            phone_normalized : normalizePhone(a.phone || ''),
            phone_valid      : isValidPhone(a.phone || ''),
            ready            : isValidPhone(a.phone || '')
          }))
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }
}

module.exports = WatiChatController;

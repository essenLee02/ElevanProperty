/**
 * fonnteChatController.js
 *
 * Multi-agent Fonnte WhatsApp handler.
 *
 * ARSITEKTUR:
 *   - Setiap agent punya fonnte_token sendiri (kolom fonnte_token di tabel users)
 *   - Webhook Fonnte masuk → deteksi event → cari agent by device phone
 *   - Generate AI reply (ChatGPT → Claude → Private Agent)
 *   - Kirim balasan pakai fonnte_token milik agent itu sendiri
 *
 * DETECTION LOGIC:
 *   Diambil PERSIS dari simple server (webhook-fonnte.zip) yang terbukti bekerja:
 *   - incoming      : body.sender && (body.message !== undefined || body.inboxid !== undefined)
 *   - message_status: body.status !== undefined || body.state !== undefined || body.stateid !== undefined
 *
 * ENDPOINT UTAMA:
 *   POST /api/fonnte-chat/webhook  ← set ini di Fonnte Dashboard
 */

'use strict';

const axios  = require('axios');
const { User, ChatSession, ChatMessage } = require('../models');
const { generateChatGPTWhatsappReply, isChatGPTFallbackEligibleError } = require('../services/openaiService');
const { generateClaudeWhatsappReply }   = require('../services/claudeService');
const { generatePrivateWhatsappReply }  = require('./chatbotPrivateController');
const { safeLog }                       = require('../utils/safeLog');

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 1 — UTILITY FUNCTIONS
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Normalisasi nomor telepon ke format 628xxxxxxxxx
 *   +62 821-3311-936  → 628213311936
 *   0821-3311-936     → 628213311936
 */
function normalizePhone(phone) {
  return String(phone || '')
    .replace(/\+62/g, '62')
    .replace(/^0/, '62')
    .replace(/[\s\-()]/g, '');
}

/**
 * Deteksi jenis event dari payload Fonnte.
 *
 * DIAMBIL PERSIS dari simple server (webhook-fonnte.zip) yang terbukti bekerja.
 * Jangan ubah urutan pengecekan.
 *
 * @param {object} body - req.body dari webhook Fonnte
 * @returns {'send'|'incoming'|'message_status'|'unknown'}
 */
function detectEventType(body) {
  if (!body || typeof body !== 'object') return 'unknown';

  // send event (kalau Fonnte kirim notif setelah send)
  if (body.eventType === 'send') return 'send';

  // incoming: ada sender DAN (message terdefinisi ATAU inboxid terdefinisi)
  // Penting: gunakan !== undefined, bukan !!, supaya message:"" (kosong) tetap detected
  if (body.sender && (body.message !== undefined || body.inboxid !== undefined)) return 'incoming';

  // message status (read receipt, delivered, dll)
  if (body.status !== undefined || body.state !== undefined || body.stateid !== undefined) return 'message_status';

  return 'unknown';
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 2 — AGENT LOOKUP (dari database)
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Ambil semua agent aktif yang sudah punya fonnte_token di database.
 */
async function getAllAgentsWithFonnte() {
  const agents = await User.findAll({
    where      : { privilege: 'agent', status: 1 },
    attributes : ['id', 'user_id', 'name', 'phone', 'username', 'fonnte_token'],
    order      : [['created_date', 'ASC']]
  });

  return agents.filter(a => a.fonnte_token && String(a.fonnte_token).trim().length > 5);
}

/**
 * Cari agent berdasarkan nomor device Fonnte (field "device" di payload).
 * Mencocokkan dengan kolom phone di database setelah normalisasi.
 *
 * @param {string} devicePhone - Nomor WA yang terdaftar di Fonnte (field "device")
 * @returns {User|null}
 */
async function findAgentByDevice(devicePhone) {
  if (!devicePhone) return null;

  const normDevice = normalizePhone(devicePhone);
  const agents     = await getAllAgentsWithFonnte();

  for (const agent of agents) {
    if (agent.phone && normalizePhone(agent.phone) === normDevice) {
      console.log(`[FONNTE AGENT] ✅ Match: ${agent.name} (${agent.phone})`);
      return agent;
    }
  }

  console.warn(`[FONNTE AGENT] Tidak ada match untuk device: ${devicePhone} (normalized: ${normDevice})`);
  console.warn(`[FONNTE AGENT] Agent terdaftar:`,
    agents.map(a => `${a.name}: ${normalizePhone(a.phone || '')}`).join(', ')
  );

  return null;
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 3 — KIRIM PESAN via FONNTE (per-agent token)
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Kirim pesan WhatsApp menggunakan token Fonnte milik agent.
 *
 * @param {string} targetPhone - Nomor tujuan (customer)
 * @param {string} message     - Isi pesan
 * @param {string} agentToken  - Token dari users.fonnte_token
 */
async function sendViaFonnte(targetPhone, message, agentToken) {
  const target = normalizePhone(targetPhone);

  const params = new URLSearchParams();
  params.append('target',      target);
  params.append('message',     String(message).trim());
  params.append('countryCode', '0');

  const response = await axios.post('https://api.fonnte.com/send', params, {
    headers : {
      'Authorization' : String(agentToken).trim(),
      'Content-Type'  : 'application/x-www-form-urlencoded'
    },
    timeout : 30000
  });

  if (response.data && response.data.status === false) {
    const reason = response.data.reason || response.data.detail || 'Fonnte: gagal kirim';
    throw new Error(reason);
  }

  return response.data;
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 4 — AI REPLY (ChatGPT → Claude → Private Agent)
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Generate AI reply dengan fallback chain.
 * Selalu berhasil (private_agent tidak bisa gagal).
 */
async function generateAIReply(session, message, agentName) {
  // Coba ChatGPT
  try {
    console.log('[FONNTE AI] Mencoba ChatGPT...');
    const reply = await generateChatGPTWhatsappReply(session, [], message, '');
    return { reply, provider: 'chatgpt' };
  } catch (err) {
    console.warn('[FONNTE AI] ChatGPT gagal:', err.message);
  }

  // Coba Claude
  try {
    console.log('[FONNTE AI] Mencoba Claude...');
    const reply = await generateClaudeWhatsappReply(session, [], message, '');
    return { reply, provider: 'claude' };
  } catch (err) {
    console.warn('[FONNTE AI] Claude gagal:', err.message);
  }

  // Private Agent (selalu berhasil)
  console.log('[FONNTE AI] Menggunakan Private Agent...');
  const result = generatePrivateWhatsappReply({
    name      : session.name || 'Valued Customer',
    phone     : session.phone,
    message,
    agentName : agentName || 'Property Consultant'
  });

  return { reply: result.reply, provider: 'private_agent' };
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 5 — PROSES PESAN MASUK (background)
   Dipanggil setelah response 200 dikirim ke Fonnte
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Proses lengkap untuk satu pesan masuk:
 *   1. Simpan pesan customer ke DB
 *   2. Generate AI reply
 *   3. Simpan AI reply ke DB
 *   4. Kirim balasan via Fonnte (pakai token agent)
 */
async function processIncomingMessage(body, agent) {
  const sender    = String(body.sender || '').trim();
  const name      = String(body.name || body.pushname || 'Customer').trim();
  const message   = String(body.message || '').trim();
  const messageId = body.inboxid || body.key || body.id || `fonnte_${Date.now()}`;

  // ── Print ke terminal ──────────────────────────────────────────────
  const divider = '─'.repeat(60);
  console.log('');
  console.log(divider);
  console.log(`[FONNTE] Agent    : ${agent.name} - ${agent.phone}`);
  console.log(`[FONNTE] Customer : ${sender} (${name})`);
  console.log(`[FONNTE] Message  : ${message.substring(0, 80) || '(media/non-teks)'}`);
  console.log(divider);
  console.log('');

  // ── Skip media/non-teks ─────────────────────────────────────────────
  if (!message) {
    console.log('[FONNTE] Pesan media/non-teks → skip AI');
    return;
  }

  // ── Find/create session ─────────────────────────────────────────────
  const normSender = normalizePhone(sender);
  const source     = `fonnte_${agent.name.toLowerCase().replace(/\s+/g, '_')}`;

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
    console.log(`[FONNTE SESSION] Sesi baru: ID ${session.id}`);
  }

  // ── Simpan pesan customer ───────────────────────────────────────────
  await ChatMessage.create({
    chatSessionId : session.id,
    role          : 'customer',
    message,
    channel       : 'whatsapp',
    metadata      : JSON.stringify({ agentName: agent.name, messageId, platform: 'fonnte' })
  });

  // ── Generate AI reply ───────────────────────────────────────────────
  let aiResult;
  try {
    aiResult = await generateAIReply(session, message, agent.name);
  } catch (err) {
    console.error('[FONNTE AI ERROR]', err.message);
    const appName = process.env.APP_NAME || 'Elevan Property';
    aiResult = {
      reply    : `Halo ${name}, terima kasih menghubungi ${agent.name} dari ${appName}. Pesan Anda sudah diterima. 🙏`,
      provider : 'fallback'
    };
  }

  console.log(`[FONNTE AI] Reply (${aiResult.provider}): ${aiResult.reply.substring(0, 60)}...`);

  // ── Simpan AI reply ─────────────────────────────────────────────────
  await ChatMessage.create({
    chatSessionId : session.id,
    role          : 'ai',
    message       : aiResult.reply,
    channel       : 'whatsapp',
    metadata      : JSON.stringify({ aiProvider: aiResult.provider })
  });

  // ── Kirim via Fonnte (pakai token agent sendiri) ─────────────────────
  try {
    await sendViaFonnte(sender, aiResult.reply, agent.fonnte_token);
    console.log(`[FONNTE SEND] ✅ Terkirim ke ${sender} via agent ${agent.name}`);

    safeLog('FONNTE_REPLY_SENT', {
      sessionId  : session.id,
      agent      : agent.name,
      recipient  : sender,
      aiProvider : aiResult.provider
    });

  } catch (err) {
    console.error(`[FONNTE SEND] ❌ Gagal kirim ke ${sender}: ${err.message}`);

    safeLog('FONNTE_REPLY_SEND_FAILED', {
      sessionId : session.id,
      agent     : agent.name,
      error     : err.message
    }, 'error');
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 6 — CONTROLLER CLASS
══════════════════════════════════════════════════════════════════════════════ */

class FonnteChatController {

  /* ─────────────────────────────────────────────────────────────────────
     POST /api/fonnte-chat/webhook
     ─────────────────────────────────────────────────────────────────────
     Endpoint utama. Konfigurasikan URL ini di Fonnte Dashboard.

     Alur:
       1. Terima payload → log raw
       2. detectEventType (persis dari simple server yang bekerja)
       3. Jika bukan incoming → langsung return 200
       4. Jika incoming → return 200 DULU ke Fonnte, lalu proses background
          (agar Fonnte tidak timeout menunggu AI/DB)
  ───────────────────────────────────────────────────────────────────── */
  static async handleInboundMessage(req, res) {
    const body = req.body || {};

    // ── Log raw payload ─────────────────────────────────────────────
    console.log('\n╔══════════ FONNTE WEBHOOK MASUK ══════════╗');
    console.log(`║ Time  : ${new Date().toISOString().padEnd(31)} ║`);
    console.log(`║ Keys  : ${String(Object.keys(body).join(', ')).substring(0, 31).padEnd(31)} ║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('[FONNTE RAW]', JSON.stringify(body).substring(0, 300));

    // ── Detect event type ───────────────────────────────────────────
    const eventType = detectEventType(body);
    console.log(`[FONNTE EVENT] Type: ${eventType}`);

    // ── Handle status update ────────────────────────────────────────
    if (eventType === 'message_status') {
      const info = `state=${body.state || '-'} status=${body.status || '-'} id=${body.id || body.stateid || '-'}`;
      console.log(`[FONNTE STATUS] ${info}`);
      return res.status(200).json({ status: true, type: 'message_status', message: 'Status diterima' });
    }

    // ── Handle send notification ────────────────────────────────────
    if (eventType === 'send') {
      return res.status(200).json({ status: true, type: 'send', message: 'Send event diterima' });
    }

    // ── Handle unknown ──────────────────────────────────────────────
    if (eventType !== 'incoming') {
      return res.status(200).json({ status: true, type: 'unknown', message: 'Event diterima' });
    }

    // ── INCOMING MESSAGE ────────────────────────────────────────────
    // Respond 200 SEKARANG sebelum proses AI (hindari Fonnte timeout)
    res.status(200).json({ status: true, type: 'incoming', message: 'Webhook diterima' });

    // Proses di background (tidak block response)
    setImmediate(async () => {
      try {
        const devicePhone = body.device || body.to || '';

        // Strategi 1: cari agent by device phone
        let agent = null;
        if (devicePhone) {
          agent = await findAgentByDevice(devicePhone);
        }

        // Strategi 2: jika device kosong/tidak cocok, pakai agent pertama
        if (!agent) {
          const allAgents = await getAllAgentsWithFonnte();
          if (allAgents.length > 0) {
            agent = allAgents[0];
            console.log(`[FONNTE AGENT] Auto-select: ${agent.name}`);
          }
        }

        if (!agent) {
          console.warn('[FONNTE] Tidak ada agent dengan fonnte_token aktif di database');
          return;
        }

        await processIncomingMessage(body, agent);

      } catch (err) {
        console.error('[FONNTE BACKGROUND ERROR]', err.message, err.stack);
        safeLog('FONNTE_BACKGROUND_ERROR', { error: err.message }, 'error');
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     POST /api/fonnte-chat/chaining
     ─────────────────────────────────────────────────────────────────────
     Untuk Fonnte "Webhook Chaining" mode.
     Fonnte mengirim pesan dan menunggu reply langsung di response body:
       { status: true, message: "teks balasan" }
  ───────────────────────────────────────────────────────────────────── */
  static async handleChainingWebhook(req, res) {
    const body = req.body || {};

    console.log('\n[FONNTE CHAINING] Payload masuk:', JSON.stringify(body).substring(0, 200));

    const eventType = detectEventType(body);

    // Status update → tidak perlu reply
    if (eventType === 'message_status' || eventType !== 'incoming') {
      return res.status(200).json({ status: true, message: '' });
    }

    const sender    = String(body.sender || '').trim();
    const name      = String(body.name || body.pushname || 'Customer').trim();
    const message   = String(body.message || '').trim();
    const devicePhone = body.device || body.to || '';

    if (!sender || !message) {
      return res.status(200).json({ status: true, message: '' });
    }

    // Cari agent
    let agent = devicePhone ? await findAgentByDevice(devicePhone) : null;
    if (!agent) {
      const all = await getAllAgentsWithFonnte();
      if (all.length > 0) agent = all[0];
    }

    if (!agent) {
      return res.status(200).json({ status: true, message: '' });
    }

    console.log(`[FONNTE CHAINING] Agent: ${agent.name} | Customer: ${sender} (${name})`);

    // Generate AI reply
    let aiReply = '';
    try {
      const normSender = normalizePhone(sender);
      const source     = `fonnte_${agent.name.toLowerCase().replace(/\s+/g, '_')}`;

      let session = await ChatSession.findOne({ where: { normalizedPhone: normSender, source } });
      if (!session) {
        session = await ChatSession.create({
          name: name, normalizedName: name.toLowerCase(),
          phone: sender, normalizedPhone: normSender,
          source, location: null, normalizedLocation: null
        });
      }

      await ChatMessage.create({
        chatSessionId: session.id, role: 'customer', message, channel: 'whatsapp',
        metadata: JSON.stringify({ platform: 'fonnte_chaining' })
      });

      const aiResult = await generateAIReply(session, message, agent.name);
      aiReply = aiResult.reply;

      await ChatMessage.create({
        chatSessionId: session.id, role: 'ai', message: aiReply, channel: 'whatsapp',
        metadata: JSON.stringify({ aiProvider: aiResult.provider })
      });

    } catch (err) {
      console.error('[FONNTE CHAINING ERROR]', err.message);
      const appName = process.env.APP_NAME || 'Elevan Property';
      aiReply = `Halo ${name}, terima kasih menghubungi ${agent.name} dari ${appName}. 🙏`;
    }

    // Kirim reply langsung di response (format Fonnte Chaining)
    return res.status(200).json({ status: true, message: aiReply });
  }

  /* ─────────────────────────────────────────────────────────────────────
     POST /api/fonnte-chat/webhook-raw
     Debug endpoint — log semua payload mentah dari Fonnte
  ───────────────────────────────────────────────────────────────────── */
  static async webhookRawCatcher(req, res) {
    const body = req.body || {};
    const ts   = new Date().toISOString();

    console.log('\n╔════════════ RAW CATCHER ════════════╗');
    console.log(`║ ${ts.padEnd(36)} ║`);
    console.log(`║ Keys: ${String(Object.keys(body).join(', ')).substring(0, 31).padEnd(31)} ║`);
    console.log('╚═════════════════════════════════════╝');
    console.log('[RAW PAYLOAD]', JSON.stringify(body, null, 2));

    const eventType = detectEventType(body);
    console.log('[RAW CATCHER] Detected event:', eventType);

    if (eventType === 'incoming') {
      console.log('[RAW CATCHER] ✅ Ini incoming message → teruskan ke handler...');
      return FonnteChatController.handleInboundMessage(req, res);
    }

    return res.status(200).json({
      status     : true,
      caught     : true,
      eventType,
      payloadKeys: Object.keys(body),
      raw        : body
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     POST /api/fonnte-chat/simulate
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

    console.log('\n[FONNTE SIMULATE] 🧪 Simulasi pesan masuk');
    console.log(`  From   : ${sender} (${name})`);
    console.log(`  Device : ${device || '(auto)'}`);
    console.log(`  Message: ${message}`);
    console.log(`  Dry run: ${dry_run}`);

    if (!sender || !message) {
      return res.status(400).json({ success: false, message: 'Wajib ada: sender dan message' });
    }

    let agent = device ? await findAgentByDevice(device) : null;
    if (!agent) {
      const all = await getAllAgentsWithFonnte();
      if (all.length > 0) agent = all[0];
    }

    if (!agent) {
      return res.status(404).json({
        success : false,
        message : 'Tidak ada agent dengan fonnte_token. Cek /api/fonnte-chat/status'
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

    // Proses penuh
    try {
      const fakeBody = { sender, message, name, device: device || agent.phone, inboxid: `sim_${Date.now()}` };
      await processIncomingMessage(fakeBody, agent);

      return res.json({
        success : true,
        message : 'Simulate selesai. Lihat terminal untuk output.',
        agent   : agent.name,
        sender
      });

    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/fonnte-chat/agents
  ───────────────────────────────────────────────────────────────────── */
  static async getAgentsWithFonnte(req, res) {
    try {
      const agents = await getAllAgentsWithFonnte();
      return res.json({
        success : true,
        data    : {
          agents: agents.map(a => ({
            user_id      : a.user_id,
            name         : a.name,
            phone        : a.phone,
            fonnte_ready : true
            // TIDAK return fonnte_token ke client (security)
          })),
          total: agents.length
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/fonnte-chat/agent-chats/:agentName
  ───────────────────────────────────────────────────────────────────── */
  static async getAgentChats(req, res) {
    try {
      const { agentName }              = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const source   = `fonnte_${agentName.toLowerCase().replace(/\s+/g, '_')}`;
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
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/fonnte-chat/chat-history/:sessionId
  ───────────────────────────────────────────────────────────────────── */
  static async getChatHistory(req, res) {
    try {
      const { sessionId }  = req.params;
      const { limit = 100} = req.query;

      const session = await ChatSession.findByPk(sessionId);
      if (!session) return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });

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
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/fonnte-chat/status
  ───────────────────────────────────────────────────────────────────── */
  static async getFonnteStatus(req, res) {
    try {
      const allAgents = await User.findAll({
        where      : { privilege: 'agent', status: 1 },
        attributes : ['user_id', 'name', 'phone', 'fonnte_token']
      });

      const ready = allAgents.filter(a => a.fonnte_token && a.fonnte_token.trim().length > 5);

      return res.json({
        success : true,
        data    : {
          total       : allAgents.length,
          fonnte_ready: ready.length,
          agents      : allAgents.map(a => ({
            user_id     : a.user_id,
            name        : a.name,
            phone       : a.phone,
            has_phone   : !!(a.phone && a.phone.trim()),
            has_token   : !!(a.fonnte_token && a.fonnte_token.trim().length > 5),
            ready       : !!(a.phone && a.fonnte_token && a.fonnte_token.trim().length > 5)
          }))
        },
        message: `${ready.length} dari ${allAgents.length} agent siap Fonnte`
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/fonnte-chat/debug-info
  ───────────────────────────────────────────────────────────────────── */
  static async getDebugInfo(req, res) {
    try {
      const agents = await User.findAll({
        where      : { privilege: 'agent', status: 1 },
        attributes : ['user_id', 'name', 'phone', 'fonnte_token']
      });

      return res.json({
        success: true,
        data   : {
          server: { port: process.env.PORT || 5005, webhookUrl: 'POST /api/fonnte-chat/webhook' },
          agents: agents.map(a => ({
            user_id          : a.user_id,
            name             : a.name,
            phone_raw        : a.phone,
            phone_normalized : normalizePhone(a.phone || ''),
            has_fonnte_token : !!(a.fonnte_token && a.fonnte_token.trim().length > 5),
            ready            : !!(a.phone && a.fonnte_token && a.fonnte_token.trim().length > 5)
          }))
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────
     GET /api/fonnte-chat/check-fonnte-api
     Test apakah Fonnte API bisa dihubungi (cek device info)
  ───────────────────────────────────────────────────────────────────── */
  static async checkFonnteApi(req, res) {
    try {
      const agents = await getAllAgentsWithFonnte();
      if (agents.length === 0) {
        return res.status(404).json({ success: false, message: 'Tidak ada agent dengan fonnte_token' });
      }

      const target    = agents.find(a => a.name === 'LEO FELIX') || agents[0];
      const tokenStr  = String(target.fonnte_token).trim();
      const results   = {};

      for (const ep of [
        { label: 'device',   method: 'get',  url: 'https://api.fonnte.com/device'  },
        { label: 'retrive',  method: 'get',  url: 'https://api.fonnte.com/retrive' },
        { label: 'receive',  method: 'get',  url: 'https://api.fonnte.com/receive' }
      ]) {
        try {
          const r = await axios({ method: ep.method, url: ep.url,
            headers: { Authorization: tokenStr }, timeout: 8000 });
          results[ep.label] = { status: r.status, preview: JSON.stringify(r.data).substring(0, 300) };
        } catch (err) {
          results[ep.label] = { status: err?.response?.status || 'error', error: err.message };
        }
      }

      return res.json({ success: true, agent: target.name, results });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   BAGIAN 7 — POLLER (Fallback jika Webhook tidak fire)

   Catatan: Fonnte tidak punya endpoint GET untuk ambil pesan masuk.
   Semua endpoint (retrive, receive, inbox) return 404 di Free plan.
   Poller tetap ada tapi tidak akan bisa ambil pesan baru.
   Solusi utama adalah webhook (Fonnte Dashboard).
══════════════════════════════════════════════════════════════════════════════ */

class FonntePoller {
  constructor() {
    this.handle    = null;
    this.isRunning = false;
    this.pollCount = 0;
    this.lastPoll  = null;
  }

  async start(intervalMs = 10000) {
    if (this.isRunning) {
      console.log('[FONNTE POLLER] Sudah berjalan');
      return;
    }
    this.isRunning = true;
    console.log(`[FONNTE POLLER] Start (interval: ${intervalMs / 1000}s)`);
    console.log('[FONNTE POLLER] ℹ️  Catatan: Fonnte Free tidak punya API polling.');
    console.log('[FONNTE POLLER] ℹ️  Gunakan webhook untuk terima pesan masuk.');
    this.handle = setInterval(() => this._tick(), intervalMs);
  }

  stop() {
    if (this.handle) clearInterval(this.handle);
    this.isRunning = false;
    console.log('[FONNTE POLLER] Stopped');
  }

  getStatus() {
    return { isRunning: this.isRunning, pollCount: this.pollCount, lastPoll: this.lastPoll };
  }

  async _tick() {
    this.pollCount++;
    this.lastPoll = new Date();
    // Fonnte tidak punya polling API — tidak ada yang bisa di-fetch
  }
}

const fonntePoller = new FonntePoller();
FonnteChatController.poller = fonntePoller;

// Poller control endpoints
FonnteChatController.getPollerStatus = async (req, res) => {
  return res.json({ success: true, data: fonntePoller.getStatus() });
};

FonnteChatController.startPoller = async (req, res) => {
  const ms = parseInt(req.body?.intervalMs || process.env.FONNTE_POLLING_INTERVAL_MS || '10000');
  await fonntePoller.start(ms);
  return res.json({ success: true, message: 'Poller dimulai', data: fonntePoller.getStatus() });
};

FonnteChatController.stopPoller = async (req, res) => {
  fonntePoller.stop();
  return res.json({ success: true, message: 'Poller dihentikan' });
};

module.exports = FonnteChatController;

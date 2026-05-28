/**
 * fonnteChatController.js
 *
 * Multi-agent WhatsApp chat handler untuk platform FONNTE.
 * Mirip dengan watiChatController.js, namun menggunakan infrastruktur Fonnte:
 *
 *  ─ Setiap agent punya token Fonnte sendiri (kolom fonnte_token di tabel users)
 *  ─ Setiap agent punya nomor WA sendiri (kolom phone di tabel users)
 *  ─ Fonnte webhook → backend identifikasi agent via field "device"
 *    ("device" = nomor WA agent yang terpasang di Fonnte)
 *  ─ Balas pesan menggunakan token Fonnte milik agent itu sendiri
 *
 * Architecture:
 *   Webhook → Identifikasi agent (by device phone) → Cek fonnte_token ada
 *   → Find/create session → Simpan pesan customer
 *   → Generate AI reply (ChatGPT → Claude → PrivateAgent)
 *   → Kirim balas via Fonnte API (pakai token agent) → Simpan AI reply
 *   → Log ke terminal
 *
 * Fonnte Webhook Payload:
 *   {
 *     "sender"   : "6281234567890",   ← nomor customer (yang kirim pesan)
 *     "message"  : "Halo, saya mau tanya...",
 *     "device"   : "628213311936",    ← nomor WA agent di Fonnte (KUNCI ROUTING)
 *     "pushname" : "Budi Santoso",    ← nama display customer
 *     "key"      : "ABCD1234",        ← message ID Fonnte (opsional)
 *     "timestamp": 1716800000         ← unix timestamp (opsional)
 *   }
 */

const axios = require('axios');
const { User, ChatSession, ChatMessage } = require('../models');
const { generateChatGPTWhatsappReply, isChatGPTFallbackEligibleError } = require('../services/openaiService');
const { generateClaudeWhatsappReply } = require('../services/claudeService');
const { generatePrivateWhatsappReply } = require('./chatbotPrivateController');
const { safeLog } = require('../utils/safeLog');

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — PHONE UTILITIES
═══════════════════════════════════════════════════════════════ */

class PhoneUtils {
  /**
   * Normalize phone ke format 628xxxxxxxxx
   *   +62 821-3311-936  → 628213311936
   *   0821-3311-936     → 628213311936
   *   6282133110936     → 628213311936
   */
  static normalize(phone = '') {
    return String(phone || '')
      .replace(/\+62/g, '62')
      .replace(/^0/, '62')
      .replace(/[\s\-()]/g, '');
  }

  /** Validasi format nomor WA Indonesia */
  static isValid(phone = '') {
    return /^628\d{8,}$/.test(this.normalize(phone));
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — AGENT LOOKUP (FONNTE-SPECIFIC)
   Hanya agent yang memiliki KEDUA field: phone DAN fonnte_token
═══════════════════════════════════════════════════════════════ */

class AgentFonnteeLookup {
  /**
   * Cari agent berdasarkan nomor WA device Fonnte.
   *
   * Hanya agent yang punya fonnte_token (tidak null/kosong) yang eligible.
   * Sehingga agent yang belum setup Fonnte tidak ikut diproses.
   *
   * @param {string} devicePhone - Nomor WA yang terpakai di Fonnte (field "device")
   * @returns {User|null}
   */
  static async findByDevicePhone(devicePhone) {
    if (!devicePhone) {
      console.warn('[FONNTE] Tidak ada devicePhone untuk agent lookup');
      return null;
    }

    try {
      const normalizedDevice = PhoneUtils.normalize(devicePhone);

      // Ambil semua agent aktif yang sudah punya fonnte_token
      const eligibleAgents = await User.findAll({
        where  : { privilege: 'agent', status: 1 },
        attributes: ['id', 'user_id', 'name', 'phone', 'username', 'fonnte_token']
      });

      // Filter hanya yang punya fonnte_token terisi
      const withFonnte = eligibleAgents.filter(
        a => a.fonnte_token && String(a.fonnte_token).trim().length > 5
      );

      if (withFonnte.length === 0) {
        console.warn('[FONNTE] Tidak ada agent dengan fonnte_token yang terdaftar di database');
        return null;
      }

      // Cari yang phone-nya cocok dengan devicePhone dari webhook
      for (const agent of withFonnte) {
        if (!agent.phone) continue;
        const agentNorm = PhoneUtils.normalize(agent.phone);
        if (agentNorm === normalizedDevice) {
          console.log(`[FONNTE AGENT] ✅ Ditemukan: ${agent.name} (${agent.phone}) via device phone match`);
          return agent;
        }
      }

      // Log debug kalau tidak ketemu
      console.warn(`[FONNTE AGENT] ⚠️ Tidak ada agent match untuk device: ${devicePhone} (normalized: ${normalizedDevice})`);
      console.warn(`[FONNTE AGENT] Agent dengan Fonnte aktif:`,
        withFonnte.map(a => `${a.name}: ${PhoneUtils.normalize(a.phone || '')}`)
      );

      return null;

    } catch (error) {
      console.error('[FONNTE AGENT LOOKUP ERROR]', error.message);
      safeLog('FONNTE_AGENT_LOOKUP_ERROR', { devicePhone, error: error.message }, 'error');
      return null;
    }
  }

  /**
   * Ambil semua agent aktif yang sudah setup Fonnte
   */
  static async getAllWithFonnte() {
    try {
      const agents = await User.findAll({
        where  : { privilege: 'agent', status: 1 },
        attributes: ['id', 'user_id', 'name', 'phone', 'username', 'fonnte_token', 'created_date'],
        order  : [['created_date', 'ASC']]
      });

      return agents.filter(a => a.fonnte_token && String(a.fonnte_token).trim().length > 5);
    } catch (error) {
      console.error('[FONNTE GET AGENTS ERROR]', error.message);
      return [];
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — SEND MESSAGE via FONNTE (Per-Agent Token)
   Berbeda dari fonnteService.js yang pakai env global FONNTE_TOKEN.
   Di sini kita pakai token milik agent (users.fonnte_token)
═══════════════════════════════════════════════════════════════ */

class FonnteApiSender {
  /**
   * Kirim pesan WhatsApp menggunakan token Fonnte milik agent.
   *
   * @param {string} targetPhone  - Nomor tujuan (customer) 628xxxxxxxxx
   * @param {string} message      - Isi pesan
   * @param {string} agentToken   - Token Fonnte dari users.fonnte_token
   * @returns {{ success, target, response }}
   */
  static async send(targetPhone, message, agentToken) {
    if (!agentToken || String(agentToken).trim().length < 5) {
      throw new Error('Token Fonnte agent tidak valid atau kosong');
    }

    const target = PhoneUtils.normalize(targetPhone);

    if (!PhoneUtils.isValid(target)) {
      throw new Error(`Nomor tujuan tidak valid: ${targetPhone}`);
    }

    // Fonnte API pakai form-urlencoded
    const payload = new URLSearchParams();
    payload.append('target',      target);
    payload.append('message',     String(message).trim());
    payload.append('countryCode', '0');
    payload.append('typing',      'true');

    try {
      const response = await axios.post('https://api.fonnte.com/send', payload, {
        headers: {
          'Authorization' : String(agentToken).trim(),
          'Content-Type'  : 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      // Fonnte kadang return status: false di body meski HTTP 200
      if (response.data && response.data.status === false) {
        const reason = response.data.reason || response.data.detail || 'Fonnte gagal kirim pesan';
        throw new Error(`Fonnte: ${reason}`);
      }

      return {
        success  : true,
        target,
        response : response.data
      };

    } catch (error) {
      const status    = error?.response?.status;
      const reason    = error?.response?.data?.reason
        || error?.response?.data?.detail
        || error?.message
        || 'Unknown Fonnte error';

      throw new Error(`Fonnte send error${status ? ` (${status})` : ''}: ${reason}`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — AI REPLY GENERATOR (ChatGPT → Claude → PrivateAgent)
═══════════════════════════════════════════════════════════════ */

class AiReplyGenerator {
  static async generate(session, customerMessage, agentName) {
    // Priority 1: ChatGPT
    try {
      console.log('[FONNTE AI] Mencoba ChatGPT...');
      const reply = await generateChatGPTWhatsappReply(session, [], customerMessage, '');
      return { reply, provider: 'chatgpt', primaryProvider: 'chatgpt', fallbackUsed: false };
    } catch (err) {
      const recoverable = isChatGPTFallbackEligibleError(err);
      console.warn(`[FONNTE AI] ChatGPT gagal: ${err.message} (recoverable: ${recoverable})`);
    }

    // Priority 2: Claude
    try {
      console.log('[FONNTE AI] Mencoba Claude...');
      const reply = await generateClaudeWhatsappReply(session, [], customerMessage, '');
      return { reply, provider: 'claude', primaryProvider: 'chatgpt', fallbackUsed: true, fallbackProvider: 'claude' };
    } catch (err) {
      console.warn(`[FONNTE AI] Claude gagal: ${err.message}`);
    }

    // Priority 3: Private Agent (selalu berhasil)
    console.log('[FONNTE AI] Menggunakan Private Agent...');
    const result = generatePrivateWhatsappReply({
      name      : session.name || 'Valued Customer',
      phone     : session.phone,
      message   : customerMessage,
      agentName : agentName || 'Property Consultant'
    });

    return {
      reply          : result.reply,
      provider       : 'private_agent',
      primaryProvider: 'chatgpt',
      fallbackUsed   : true,
      fallbackProvider: 'private_agent'
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 — MESSAGE PROCESSOR (ChatSession + ChatMessage)
   Source format: "fonnte_[agent_name_slug]"
   Contoh: "fonnte_leo_felix"
═══════════════════════════════════════════════════════════════ */

class MessageProcessor {
  static async findOrCreateSession(customerPhone, agentName, customerName = 'Customer') {
    try {
      const normalizedPhone = PhoneUtils.normalize(customerPhone);
      const agentSlug       = agentName.toLowerCase().replace(/\s+/g, '_');
      const source          = `fonnte_${agentSlug}`;

      let session = await ChatSession.findOne({ where: { normalizedPhone, source } });

      if (!session) {
        session = await ChatSession.create({
          name              : customerName,
          normalizedName    : customerName.toLowerCase(),
          phone             : customerPhone,
          normalizedPhone,
          source,
          location          : null,
          normalizedLocation: null
        });
        console.log(`[FONNTE SESSION] Sesi baru dibuat: ID ${session.id} → ${agentName}`);
      }

      return session;
    } catch (error) {
      console.error('[FONNTE SESSION ERROR]', error.message);
      throw error;
    }
  }

  static async saveCustomerMessage(session, message, metadata = {}) {
    try {
      const saved = await ChatMessage.create({
        chatSessionId: session.id,
        role          : 'customer',
        message,
        channel       : 'whatsapp',
        metadata      : JSON.stringify(metadata)
      });
      console.log(`[FONNTE MSG] Pesan customer disimpan: ID ${saved.id}`);
      return saved;
    } catch (error) {
      console.error('[FONNTE SAVE MESSAGE ERROR]', error.message);
      throw error;
    }
  }

  static async saveAiReply(session, reply, aiResult) {
    try {
      const saved = await ChatMessage.create({
        chatSessionId: session.id,
        role          : 'ai',
        message       : reply,
        channel       : 'whatsapp',
        metadata      : JSON.stringify({
          aiProvider      : aiResult.provider,
          primaryProvider : aiResult.primaryProvider,
          fallbackUsed    : aiResult.fallbackUsed,
          fallbackProvider: aiResult.fallbackProvider || null
        })
      });
      console.log(`[FONNTE MSG] AI reply disimpan: ID ${saved.id}`);
      return saved;
    } catch (error) {
      console.error('[FONNTE SAVE AI REPLY ERROR]', error.message);
      throw error;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 — LOGGER (Terminal Display)
═══════════════════════════════════════════════════════════════ */

class Logger {
  /**
   * Format terminal mirip watiChatController:
   *
   * ────────────────────────────────────────────────────────────
   * [FONNTE] Agent     : LEO FELIX - 628213311936
   *          Customer  : 6281234567890 (Budi Santoso)
   *          Timestamp : 2026-05-27T10:00:00.000Z
   *          Message   : Saya mau cari rumah di Surabaya...
   * ────────────────────────────────────────────────────────────
   */
  static logInbound(agentName, agentPhone, customerPhone, customerName, message, timestamp = null) {
    const divider = '─'.repeat(62);
    const ts      = timestamp ? new Date(Number(timestamp) * 1000).toISOString() : new Date().toISOString();

    console.log('');
    console.log(divider);
    console.log(`[FONNTE] Agent     : ${agentName} - ${agentPhone}`);
    console.log(`         Customer  : ${customerPhone} (${customerName})`);
    console.log(`         Timestamp : ${ts}`);
    console.log(`         Message   : ${String(message).trim()}`);
    console.log(divider);
    console.log('');
  }

  static logRaw(payload) {
    console.log('[FONNTE DEBUG] Raw webhook payload:');
    console.log(JSON.stringify(payload, null, 2));
  }

  static logResult(agentName, sent, aiProvider, error = null) {
    const status = sent ? '✅ TERKIRIM' : '❌ GAGAL KIRIM';
    console.log(`[FONNTE RESULT] ${agentName} → AI: ${aiProvider} → Send: ${status}${error ? ` | Error: ${error}` : ''}`);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 7 — MAIN CONTROLLER CLASS
═══════════════════════════════════════════════════════════════ */

class FonnteChatController {

  /**
   * POST /api/fonnte-chat/webhook
   *
   * Fonnte webhook payload (inbound message):
   * {
   *   "sender"   : "6281234567890",   ← nomor pengirim (customer)
   *   "message"  : "Halo, saya mau tanya...",
   *   "device"   : "628213311936",    ← nomor WA agent di Fonnte ← KUNCI ROUTING
   *   "pushname" : "Budi Santoso",    ← nama display customer
   *   "key"      : "ABCD1234",        ← message ID (opsional)
   *   "timestamp": 1716800000         ← unix timestamp (opsional)
   * }
   *
   * Syarat agar pesan diproses:
   *   1. Field "sender" ada (nomor customer)
   *   2. Field "message" ada
   *   3. Field "device" ada (nomor agent)
   *   4. Agent ditemukan di database (users.phone match device)
   *   5. Agent punya fonnte_token tidak kosong
   *
   * Jika agent tidak ditemukan atau tidak punya fonnte_token:
   *   → Tetap tampilkan pesan di terminal (JANGAN block)
   *   → Return 200 dengan warning
   */
  static async handleInboundMessage(req, res) {
    try {
      const payload = req.body;

      // Debug: tampilkan raw payload
      Logger.logRaw(payload);

      // ─── Parse payload ────────────────────────────────────────────────
      //
      // Fonnte field priority:
      //   customer phone → sender || from || phone
      //   device phone   → device || to || target
      //   message text   → message || text || body
      //   customer name  → pushname || name || senderName
      //   message id     → key || id || messageId
      //   timestamp      → timestamp

      const customerPhone   = payload.sender   || payload.from    || payload.phone   || '';
      const devicePhone     = payload.device   || payload.to      || payload.target  || '';
      const customerMessage = String(payload.message || payload.text || payload.body || '').trim();
      const customerName    = payload.pushname || payload.name    || payload.senderName || 'Customer';
      const messageId       = payload.key      || payload.id      || payload.messageId  || `fonnte_${Date.now()}`;
      const msgTimestamp    = payload.timestamp || null;

      // ─── Handle Fonnte status webhook (sent/delivered/read) ─────────
      // Fonnte mengirim status update terpisah: {device, id, state, stateid, status}
      // Ini BUKAN pesan masuk — cukup return 200 tanpa proses
      const isStatusUpdate = (
        !customerPhone &&
        !customerMessage &&
        (payload.status === 'sent' || payload.status === 'delivered' ||
         payload.status === 'read'  || payload.state  === 'sent'  ||
         payload.state  === 'delivered' || payload.state  === 'read')
      );
      if (isStatusUpdate) {
        console.log(`[FONNTE STATUS] 📬 Status update: device=${payload.device || '-'} status=${payload.status || payload.state || '-'} id=${payload.id || payload.stateid || '-'}`);
        return res.status(200).json({ success: true, message: 'Status update diterima' });
      }

      // ─── Validasi field wajib ────────────────────────────────────────
      if (!customerPhone || !customerMessage) {
        console.warn('[FONNTE WEBHOOK] ⚠️ Payload tidak lengkap:', {
          hasSender  : !!customerPhone,
          hasMessage : !!customerMessage,
          keys       : Object.keys(payload)
        });
        // Tetap return 200 agar Fonnte tidak retry terus-menerus
        return res.status(200).json({
          success : false,
          message : 'Payload tidak valid: harus ada sender dan message',
          hint    : 'Pastikan Fonnte mengirim field: sender, message, device'
        });
      }

      // ─── Cari agent dari database ────────────────────────────────────
      //
      // KUNCI ROUTING: field "device" = nomor WA agent yang terpasang di Fonnte
      // Cari di users.phone (setelah normalisasi)
      // Agent WAJIB punya fonnte_token (tidak null) untuk diproses

      let agent       = null;
      let agentSource = null;

      // Strategi 1: device field (nomor WA agent di Fonnte)
      if (devicePhone) {
        agent = await AgentFonnteeLookup.findByDevicePhone(devicePhone);
        if (agent) agentSource = 'device_field';
      }

      // Strategi 2 (fallback): coba customerPhone juga — mungkin agent yang kirim pesan
      // (misalnya dalam testing, pengirim adalah agent itu sendiri)
      if (!agent && customerPhone) {
        agent = await AgentFonnteeLookup.findByDevicePhone(customerPhone);
        if (agent) {
          agentSource = 'sender_is_agent';
          console.log(`[FONNTE AGENT] ℹ️ Pengirim (sender) adalah agent: ${agent.name}`);
        }
      }

      // ─── Selalu tampilkan di terminal (meski agent tidak ditemukan) ──
      const displayName  = agent?.name  || 'UNASSIGNED';
      const displayPhone = agent?.phone || devicePhone || 'N/A';

      Logger.logInbound(displayName, displayPhone, customerPhone, customerName, customerMessage, msgTimestamp);

      // ─── Jika agent tidak ditemukan / tidak punya fonnte_token ─────────
      if (!agent) {
        const reason = devicePhone
          ? `Nomor device "${devicePhone}" tidak cocok dengan agent manapun yang punya Fonnte API`
          : 'Field "device" tidak ada di payload Fonnte';

        console.warn(`[FONNTE WEBHOOK] ⚠️ ${reason}`);
        console.warn('[FONNTE WEBHOOK] 💡 Tips: Pastikan users.fonnte_token dan users.phone sudah diisi di halaman Profile.');

        safeLog('FONNTE_AGENT_NOT_FOUND', { devicePhone, customerPhone, reason }, 'warn');

        return res.status(200).json({
          success       : false,
          messageLogged : true,
          message       : 'Pesan ditampilkan di terminal, tapi agent tidak ditemukan atau belum setup Fonnte API.',
          hint          : reason
        });
      }

      // ─── Proses pesan ────────────────────────────────────────────────
      const result = await FonnteChatController._processMessage(
        agent,
        customerPhone,
        customerMessage,
        messageId,
        customerName
      );

      return res.json({
        success : true,
        data    : result,
        message : 'Pesan Fonnte berhasil diproses'
      });

    } catch (error) {
      console.error('[FONNTE WEBHOOK ERROR]', error.message);
      safeLog('FONNTE_WEBHOOK_ERROR', error.message, 'error');
      return res.status(500).json({
        success : false,
        message : 'Gagal memproses webhook Fonnte',
        error   : error.message
      });
    }
  }

  /**
   * Internal: Proses lengkap (simpan → AI → kirim balasan)
   */
  static async _processMessage(agent, customerPhone, customerMessage, messageId, customerName = 'Customer') {
    // 1. Buat / temukan sesi chat
    const session = await MessageProcessor.findOrCreateSession(customerPhone, agent.name, customerName);

    // 2. Simpan pesan customer
    await MessageProcessor.saveCustomerMessage(session, customerMessage, {
      agentName   : agent.name,
      agentUserId : agent.user_id,
      messageId,
      platform    : 'fonnte'
    });

    safeLog('FONNTE_INBOUND_MESSAGE', {
      sessionId     : session.id,
      agentName     : agent.name,
      messageLength : customerMessage.length
    });

    // 3. Generate AI reply (dengan fallback chain)
    let aiReply  = null;
    let aiResult = null;
    let aiError  = null;

    try {
      aiResult = await AiReplyGenerator.generate(session, customerMessage, agent.name);
      aiReply  = aiResult.reply;

      await MessageProcessor.saveAiReply(session, aiReply, aiResult);
      console.log(`[FONNTE AI] Reply generated (${aiResult.provider}), length: ${aiReply.length}`);

    } catch (error) {
      aiError = error.message;
      console.error('[FONNTE AI ERROR]', aiError);
      safeLog('FONNTE_AI_FAILED', { sessionId: session.id, error: aiError }, 'error');

      // Default fallback message
      const appName = process.env.APP_NAME || 'Elevan Property';
      aiReply  = `Halo, terima kasih telah menghubungi ${agent.name} dari ${appName}. Pesan Anda sudah kami terima dan akan segera dibalas. 🙏`;
      aiResult = { provider: 'default_fallback', primaryProvider: 'unknown', fallbackUsed: true };
    }

    // 4. Kirim balasan via Fonnte menggunakan token agent sendiri
    let fonnteSent  = false;
    let fonnteError = null;

    try {
      const sendResult = await FonnteApiSender.send(customerPhone, aiReply, agent.fonnte_token);
      fonnteSent = true;

      console.log(`[FONNTE SEND] ✅ Berhasil kirim ke ${customerPhone}`);
      safeLog('FONNTE_REPLY_SENT', {
        sessionId  : session.id,
        recipient  : customerPhone,
        agentName  : agent.name,
        aiProvider : aiResult.provider
      });

    } catch (error) {
      fonnteError = error.message;
      console.error('[FONNTE SEND ERROR]', fonnteError);
      safeLog('FONNTE_REPLY_SEND_FAILED', {
        sessionId : session.id,
        error     : fonnteError
      }, 'error');
    }

    // 5. Log ringkasan hasil ke terminal
    Logger.logResult(agent.name, fonnteSent, aiResult?.provider || 'unknown', fonnteError);

    return {
      sessionId     : session.id,
      agentName     : agent.name,
      agentPhone    : agent.phone,
      customerPhone,
      aiReply,
      aiProvider    : aiResult?.provider   || null,
      fallbackUsed  : aiResult?.fallbackUsed || false,
      fonnteSent,
      errors: {
        ai     : aiError     || null,
        fonnte : fonnteError || null
      }
    };
  }

  /* ─── GET Endpoints ─────────────────────────────────────────── */

  /**
   * GET /api/fonnte-chat/agents
   * Daftar semua agent yang sudah setup Fonnte API
   */
  static async getAgentsWithFonnte(req, res) {
    try {
      const agents = await AgentFonnteeLookup.getAllWithFonnte();

      return res.json({
        success : true,
        data    : {
          agents: agents.map(a => ({
            user_id      : a.user_id,
            name         : a.name,
            phone        : a.phone,
            fonnte_ready : !!(a.fonnte_token && a.fonnte_token.trim().length > 5),
            // JANGAN return fonnte_token token ke client untuk keamanan
          })),
          totalAgents    : agents.length
        }
      });

    } catch (error) {
      console.error('[FONNTE GET AGENTS ERROR]', error.message);
      return res.status(500).json({
        success : false,
        message : 'Gagal mengambil daftar agent',
        error   : error.message
      });
    }
  }

  /**
   * GET /api/fonnte-chat/agent-chats/:agentName
   * Daftar semua sesi chat untuk satu agent
   */
  static async getAgentChats(req, res) {
    try {
      const { agentName }          = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!agentName) {
        return res.status(400).json({ success: false, message: 'agentName parameter diperlukan' });
      }

      const agentSlug = agentName.toLowerCase().replace(/\s+/g, '_');
      const source    = `fonnte_${agentSlug}`;

      const sessions = await ChatSession.findAll({
        where  : { source },
        order  : [['updatedAt', 'DESC']],
        limit  : Math.min(parseInt(limit)  || 50, 200),
        offset : parseInt(offset) || 0
      });

      const total = await ChatSession.count({ where: { source } });

      return res.json({
        success : true,
        data    : {
          agent   : agentName,
          sessions,
          pagination: { total, limit: Math.min(parseInt(limit) || 50, 200), offset: parseInt(offset) || 0 }
        }
      });

    } catch (error) {
      console.error('[FONNTE GET AGENT CHATS ERROR]', error.message);
      return res.status(500).json({ success: false, message: 'Gagal mengambil chat agent', error: error.message });
    }
  }

  /**
   * GET /api/fonnte-chat/chat-history/:sessionId
   * Riwayat percakapan dalam satu sesi
   */
  static async getChatHistory(req, res) {
    try {
      const { sessionId } = req.params;
      const { limit = 100 } = req.query;

      if (!sessionId) {
        return res.status(400).json({ success: false, message: 'sessionId parameter diperlukan' });
      }

      const session = await ChatSession.findByPk(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });
      }

      const messages = await ChatMessage.findAll({
        where : { chatSessionId: sessionId },
        order : [['createdAt', 'ASC']],
        limit : Math.min(parseInt(limit) || 100, 500)
      });

      return res.json({
        success : true,
        data    : {
          session: {
            id           : session.id,
            customerName : session.name,
            customerPhone: session.phone,
            source       : session.source,
            createdAt    : session.createdAt
          },
          messages,
          messageCount : messages.length
        }
      });

    } catch (error) {
      console.error('[FONNTE GET CHAT HISTORY ERROR]', error.message);
      return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat chat', error: error.message });
    }
  }

  /**
   * GET /api/fonnte-chat/status
   * Status konfigurasi Fonnte untuk semua agent
   */
  static async getFonnteStatus(req, res) {
    try {
      const agentsWithFonnte = await AgentFonnteeLookup.getAllWithFonnte();
      const allAgents        = await User.findAll({
        where      : { privilege: 'agent', status: 1 },
        attributes : ['user_id', 'name', 'phone', 'fonnte_token']
      });

      const statusList = allAgents.map(a => ({
        user_id      : a.user_id,
        name         : a.name,
        has_phone    : !!(a.phone && a.phone.trim()),
        has_fonnte   : !!(a.fonnte_token && a.fonnte_token.trim().length > 5),
        fonnte_ready : !!(a.phone && a.phone.trim() && a.fonnte_token && a.fonnte_token.trim().length > 5)
      }));

      return res.json({
        success : true,
        data    : {
          totalAgents       : allAgents.length,
          fonnteReadyAgents : agentsWithFonnte.length,
          agents            : statusList
        },
        message : `${agentsWithFonnte.length} dari ${allAgents.length} agent sudah setup Fonnte API`
      });

    } catch (error) {
      console.error('[FONNTE STATUS ERROR]', error.message);
      return res.status(500).json({ success: false, message: 'Gagal cek status Fonnte', error: error.message });
    }
  }
}

module.exports = FonnteChatController;

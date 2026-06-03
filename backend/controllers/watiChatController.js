/**
 * watiChatController.js
 *
 * Multi-agent WhatsApp chat handler for WATI platform
 * Handles incoming webhooks, message routing, AI reply generation, and outbound sending
 *
 * Architecture:
 *  - Webhook receiver → Identify agent from phone number → Find/create session
 *  - Save message → Generate AI reply (with fallback) → Send via WATI → Save reply
 *  - Real-time updates via Socket.io
 */

const { User, ChatSession, ChatMessage } = require('../models');
const WatiService = require('../services/watiService');
const { generateChatGPTWhatsappReply, isChatGPTFallbackEligibleError } = require('../services/openaiService');
const { generateClaudeWhatsappReply } = require('../services/claudeService');
const { generatePrivateWhatsappReply } = require('./chatbotPrivateController');
const { safeLog } = require('../utils/safeLog');
const { isTerminalActive } = require('../utils/terminalSwitch');
const { hasPropertyKeyword } = require('../utils/propertyKeywordFilter');
const { getWhatsappPropertyContext } = require('../utils/whatsappPropertyContext');

/**
 * ═══════════════════════════════════════════════════════════════
 * SECTION 1: PHONE NUMBER UTILITIES
 * ═══════════════════════════════════════════════════════════════
 */

class PhoneUtils {
  /**
   * Normalize phone number to consistent format (628xxxxxxxxx)
   * Examples:
   *   +62 821-1136-7154 → 6282111367154
   *   0821 1136 7154    → 6282111367154
   *   6282111367154     → 6282111367154
   */
  static normalize(phone = '') {
    return String(phone || '')
      .replace(/\+62/g, '62')           // +62 → 62
      .replace(/^0/, '62')               // 0xxx → 62xxx
      .replace(/[\s\-()]/g, '');         // Remove spaces, dashes, parentheses
  }

  /**
   * Check if phone is in valid Indonesian WhatsApp format
   */
  static isValid(phone = '') {
    const normalized = this.normalize(phone);
    return /^628\d{8,}$/.test(normalized);
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SECTION 2: AGENT LOOKUP
 * ═══════════════════════════════════════════════════════════════
 */

class AgentLookup {
  /**
   * Find agent from User table by phone number
   * Tries exact match first, then normalized match
   */
  static async findByPhone(phoneNumber) {
    if (!phoneNumber) {
      console.warn('[WATI] No phone number provided for agent lookup');
      return null;
    }

    try {
      const normalized = PhoneUtils.normalize(phoneNumber);

      // Try exact match first
      let agent = await User.findOne({
        where: { phone: phoneNumber, privilege: 'agent', status: 1 },
        attributes: ['id', 'user_id', 'name', 'phone', 'username']
      });

      if (agent) {
        console.log(`[WATI AGENT] Found via exact match: ${agent.name} (${agent.phone})`);
        return agent;
      }

      // Try normalized match — check ALL agents, not just the first one
      const allAgents = await User.findAll({
        where: { privilege: 'agent', status: 1 },
        attributes: ['id', 'user_id', 'name', 'phone', 'username']
      });

      for (const a of allAgents) {
        const agentNormalized = PhoneUtils.normalize(a.phone);
        if (agentNormalized === normalized) {
          console.log(`[WATI AGENT] Found via normalized match: ${a.name} (${a.phone}) → ${agentNormalized}`);
          return a;
        }
      }

      console.warn(`[WATI AGENT] No agent found for phone: ${phoneNumber} (normalized: ${normalized})`);
      console.warn(`[WATI AGENT] Registered agents:`, allAgents.map(a => `${a.name}:${PhoneUtils.normalize(a.phone)}`));
      return null;
    } catch (error) {
      console.error('[WATI AGENT LOOKUP ERROR]', error.message);
      safeLog('WATI_AGENT_LOOKUP_ERROR', { phone: phoneNumber, error: error.message }, 'error');
      return null;
    }
  }

  /**
   * Get all active agents
   */
  static async getAll() {
    try {
      return await User.findAll({
        where: { privilege: 'agent', status: 1 },
        attributes: ['id', 'user_id', 'name', 'phone', 'username', 'created_date'],
        order: [['created_date', 'ASC']]
      });
    } catch (error) {
      console.error('[WATI GET AGENTS ERROR]', error.message);
      return [];
    }
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SECTION 3: AI REPLY GENERATION WITH FALLBACK
 * ═══════════════════════════════════════════════════════════════
 */

class AiReplyGenerator {
  /**
   * Generate AI reply with fallback chain: ChatGPT → Claude → PrivateAgent
   */
  static async generate(session, customerMessage, agentName, propertyCtx = '') {
    const appName = process.env.APP_NAME || 'Elevan Property';

    // Priority 1: ChatGPT (dengan property context)
    try {
      const reply = await generateChatGPTWhatsappReply(session, [], customerMessage, propertyCtx);
      return { reply, provider: 'chatgpt', primaryProvider: 'chatgpt', fallbackUsed: false };
    } catch (error) {
      const isRecoverable = isChatGPTFallbackEligibleError(error);
      console.warn('[WATI AI] ChatGPT failed:', error.message, `(Recoverable: ${isRecoverable})`);
    }

    // Priority 2: Claude (dengan property context)
    try {
      const reply = await generateClaudeWhatsappReply(session, [], customerMessage, propertyCtx);
      return { reply, provider: 'claude', primaryProvider: 'chatgpt', fallbackUsed: true, fallbackProvider: 'claude' };
    } catch (error) {
      console.warn('[WATI AI] Claude failed:', error.message);
    }

    // Priority 3: Private Agent (always succeeds)
    try {
      console.log('[WATI AI] Using private agent fallback...');
      const result = generatePrivateWhatsappReply({
        name: session.customerName || 'Valued Customer',
        phone: session.customerPhone,
        message: customerMessage,
        agentName: agentName || 'Property Consultant'
      });

      return {
        reply: result.reply,
        provider: 'private_agent',
        primaryProvider: 'chatgpt',
        fallbackUsed: true,
        fallbackProvider: 'private_agent'
      };
    } catch (error) {
      const errorMsg = `All AI providers failed: ${error.message}`;
      console.error('[WATI AI]', errorMsg);
      safeLog('WATI_ALL_AI_PROVIDERS_FAILED', {
        customerPhone: session.customerPhone,
        error: error.message
      }, 'error');

      throw new Error(errorMsg);
    }
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SECTION 4: MESSAGE PROCESSING
 * ═══════════════════════════════════════════════════════════════
 */

class MessageProcessor {
  /**
   * Find or create chat session
   * ChatSession fields: name, normalizedName, phone, normalizedPhone, source, location, normalizedLocation
   * Agent identity encoded in source: 'wati_leo_felix'
   */
  static async findOrCreateSession(customerPhone, agentName, customerName = 'Customer') {
    try {
      const normalizedPhone = PhoneUtils.normalize(customerPhone);
      const agentSlug = agentName.toLowerCase().replace(/\s+/g, '_');
      const source = `wati_${agentSlug}`;

      let session = await ChatSession.findOne({
        where: { normalizedPhone, source }
      });

      if (session) {
        return session;
      }

      session = await ChatSession.create({
        name: customerName,
        normalizedName: customerName.toLowerCase(),
        phone: customerPhone,
        normalizedPhone,
        source,
        location: null,
        normalizedLocation: null
      });

      console.log(`[WATI SESSION] Created new session: ID ${session.id} (${agentName})`);
      return session;
    } catch (error) {
      console.error('[WATI SESSION ERROR]', error.message);
      throw error;
    }
  }

  /**
   * Save customer message to database
   * ChatMessage fields: chatSessionId, role, message, channel, metadata (TEXT)
   */
  static async saveCustomerMessage(session, message, metadata = {}) {
    try {
      const saved = await ChatMessage.create({
        chatSessionId: session.id,
        role: 'customer',
        message: message,
        channel: 'whatsapp',
        metadata: JSON.stringify(metadata)
      });

      console.log(`[WATI MESSAGE] Saved customer message: ID ${saved.id}`);
      return saved;
    } catch (error) {
      console.error('[WATI SAVE MESSAGE ERROR]', error.message);
      throw error;
    }
  }

  /**
   * Save AI reply to database
   */
  static async saveAiReply(session, reply, aiResult) {
    try {
      const saved = await ChatMessage.create({
        chatSessionId: session.id,
        role: 'ai',
        message: reply,
        channel: 'whatsapp',
        metadata: JSON.stringify({
          aiProvider: aiResult.provider,
          primaryProvider: aiResult.primaryProvider,
          fallbackUsed: aiResult.fallbackUsed,
          fallbackProvider: aiResult.fallbackProvider || null
        })
      });

      console.log(`[WATI MESSAGE] Saved AI reply: ID ${saved.id}`);
      return saved;
    } catch (error) {
      console.error('[WATI SAVE AI REPLY ERROR]', error.message);
      throw error;
    }
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SECTION 5: LOGGING & FORMATTING
 * ═══════════════════════════════════════════════════════════════
 */

class Logger {
  /**
   * Log incoming WATI message in clean readable format
   *
   * Output example:
   * ────────────────────────────────────────────────────────────
   * Agent     : LEO FELIX - +62821-3311-936
   * Customer  : +62881-3370-135
   * Timestamp : 2026-05-26T10:00:00.000Z
   * Message   : Saya mau mencari sewa rumah di surabaya...
   * ────────────────────────────────────────────────────────────
   */
  static logInboundMessage(agentName, agentPhone, customerPhone, customerMessage, timestamp = null) {
    if (!isTerminalActive('WATI')) return;

    const divider = '─'.repeat(60);
    const ts = timestamp || new Date().toISOString();

    console.log('');
    console.log(divider);
    console.log(`[WATI] Agent     : ${agentName} - ${agentPhone}`);
    console.log(`[WATI] Customer  : ${customerPhone}`);
    console.log(`[WATI] Timestamp : ${ts}`);
    console.log(`[WATI] Message   : ${String(customerMessage).trim()}`);
    console.log(divider);
    console.log('');
  }

  /**
   * Log raw WATI webhook payload for debugging
   */
  static logRawPayload(payload) {
    console.log('[WATI DEBUG] Raw webhook payload:');
    console.log(JSON.stringify(payload, null, 2));
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SECTION 6: MAIN CONTROLLER CLASS
 * ═══════════════════════════════════════════════════════════════
 */

class WatiChatController {
  /**
   * POST /api/wati/webhook
   *
   * WATI actual webhook payload:
   * {
   *   "waId": "628xxxxxxxxx",              // Customer phone (sender)
   *   "senderName": "Budi Santoso",        // Customer display name
   *   "text": { "body": "Halo..." },       // Message content
   *   "owner": "62BISNIS",                 // WATI Business number (bukan nomor agent)
   *   "timestamp": "2026-05-25T10:00:00Z",
   *   "id": "msg_123456",
   *   "assignedOperator": {                // Agent yang ditugaskan di WATI (opsional)
   *     "email": "leo@company.com",
   *     "name": "Leo Felix"
   *   }
   * }
   *
   * CATATAN: field "owner" adalah NOMOR BISNIS, bukan nomor personal agent.
   * Agent diidentifikasi melalui "assignedOperator" atau database lookup.
   */
  static async handleInboundMessage(req, res) {
    try {
      const payload = req.body;

      // Log raw payload untuk debugging
      Logger.logRawPayload(payload);

      // ─── Parse payload (support WATI format + legacy/test format) ───────
      const customerPhone   = payload.waId || payload.from;
      const businessPhone   = payload.owner || payload.to;                      // Nomor bisnis WATI
      const customerMessage = String(payload.text?.body || payload.message || '').trim();
      const messageId       = payload.id || payload.messageId || `wati_${Date.now()}`;
      const customerName    = payload.senderName || payload.name || 'Customer';
      const msgTimestamp    = payload.timestamp || new Date().toISOString();

      // Identifikasi agent: prioritas assignedOperator → lookup by phone
      const assignedOp      = payload.assignedOperator || null;
      const assignedAgentPhone = payload.agentPhone || null;                    // Field custom untuk testing

      // ─── Validasi field wajib ────────────────────────────────────────────
      if (!customerPhone || !customerMessage) {
        console.warn('[WATI WEBHOOK] ⚠️ Missing required fields:', {
          hasCustomerPhone : !!customerPhone,
          hasMessage       : !!customerMessage,
          payloadKeys      : Object.keys(payload)
        });
        return res.status(400).json({
          success : false,
          message : 'Payload tidak valid: harus ada waId dan text.body',
          hint    : 'Pastikan WATI mengirim field: waId, text.body'
        });
      }

      if (!PhoneUtils.isValid(customerPhone)) {
        console.warn('[WATI WEBHOOK] ⚠️ Invalid customer phone:', customerPhone);
        return res.status(400).json({
          success : false,
          message : `Nomor customer tidak valid: ${customerPhone}`
        });
      }

      // ─── Cari agent dari database (4 strategi) ──────────────────────────
      //
      // WATI Webhook Fields:
      //   waId    = nomor yang kirim pesan ke WATI (customer ATAU agent yg balas)
      //   owner   = nomor bisnis WATI (bukan nomor agent)
      //   assignedOperator = operator WATI yang handle percakapan
      //
      // Kasus 1: Testing via curl  → gunakan field "agentPhone" custom
      // Kasus 2: WATI Contact balas → waId = nomor agent (LEO FELIX reply ke WATI)
      // Kasus 3: WATI Operator assigned → assignedOperator.name match ke database
      // Kasus 4: owner = agent phone → jarang, tapi tetap coba
      // Fallback: Tampilkan pesan meski tidak ada agent (JANGAN block)

      let agent        = null;
      let agentSource  = null;

      // Strategi 1: Field "agentPhone" dari test payload (curl testing)
      if (assignedAgentPhone && PhoneUtils.isValid(assignedAgentPhone)) {
        agent = await AgentLookup.findByPhone(assignedAgentPhone);
        if (agent) agentSource = 'agentPhone_field';
      }

      // Strategi 2: waId = nomor agent (terjadi ketika WATI Contact balas ke WATI)
      // Contoh: LEO FELIX (+62821-3311-936) ada di WATI Contacts
      // Leo membalas pesan dari WATI → waId = nomor Leo → match di database
      if (!agent && customerPhone) {
        agent = await AgentLookup.findByPhone(customerPhone);
        if (agent) {
          agentSource = 'waId_is_agent';
          // Dalam kasus ini, "customer" sebenarnya adalah agent
          // Swap: agent mengirim pesan, customerPhone perlu di-override
          console.log(`[WATI AGENT] ℹ️ Detected WATI Contact reply flow: ${agent.name} is the sender`);
        }
      }

      // Strategi 3: assignedOperator.name dari WATI → match nama ke database
      if (!agent && assignedOp?.name) {
        const allAgents = await AgentLookup.getAll();
        agent = allAgents.find(a =>
          a.name.toLowerCase().includes(assignedOp.name.toLowerCase()) ||
          assignedOp.name.toLowerCase().includes(a.name.toLowerCase())
        ) || null;
        if (agent) agentSource = 'assignedOperator_name';
      }

      // Strategi 4: owner = nomor agent (jarang, tapi coba)
      if (!agent && businessPhone && PhoneUtils.isValid(businessPhone)) {
        agent = await AgentLookup.findByPhone(businessPhone);
        if (agent) agentSource = 'owner_field';
      }

      if (agent) {
        console.log(`[WATI AGENT] ✅ Found agent: ${agent.name} (via ${agentSource})`);
      }

      // ─── Tampilkan pesan di terminal (SELALU tampil, agent tidak found = ok) ─
      const displayAgentName  = agent?.name  || assignedOp?.name  || 'UNASSIGNED';
      const displayAgentPhone = agent?.phone || businessPhone      || 'N/A';

      Logger.logInboundMessage(displayAgentName, displayAgentPhone, customerPhone, customerMessage, msgTimestamp);

      // ─── Jika agent tidak ditemukan, log warning tapi tetap return 200 ────
      if (!agent) {
        const hint = assignedOp?.name
          ? `assignedOperator "${assignedOp.name}" tidak ada di database`
          : `Nomor bisnis "${businessPhone}" tidak match ke agent manapun`;

        console.warn(`[WATI WEBHOOK] ⚠️ Agent tidak ditemukan. ${hint}`);
        console.warn('[WATI WEBHOOK] 💡 Tips: Daftarkan agent di website Anda, atau gunakan field "agentPhone" di test payload.');

        safeLog('WATI_AGENT_NOT_FOUND', { businessPhone, customerPhone, assignedOp }, 'warn');

        return res.status(200).json({
          success       : false,
          messageLogged : true,
          message       : `Pesan diterima & ditampilkan di terminal. Namun agent tidak ditemukan di database.`,
          hint          : hint,
          debug         : { businessPhone, assignedOp, customerPhone }
        });
      }

      // ─── Proses pesan (simpan ke DB, generate AI reply, kirim ke customer) ──
      const result = await WatiChatController._processMessage(
        agent,
        customerPhone,
        customerMessage,
        messageId,
        customerName
      );

      return res.json({
        success : true,
        data    : result,
        message : 'Pesan berhasil diproses'
      });

    } catch (error) {
      console.error('[WATI WEBHOOK ERROR]', error.message);
      safeLog('WATI_WEBHOOK_ERROR', error.message, 'error');
      return res.status(500).json({
        success : false,
        message : 'Gagal memproses webhook',
        error   : error.message
      });
    }
  }

  /**
   * Internal: Process message flow
   */
  static async _processMessage(agent, customerPhone, customerMessage, messageId, customerName = 'Customer') {
    // Create/find session
    const session = await MessageProcessor.findOrCreateSession(customerPhone, agent.name, customerName);

    // Save customer message (always)
    await MessageProcessor.saveCustomerMessage(session, customerMessage, {
      agentName: agent.name,
      agentUserId: agent.user_id,
      messageId: messageId
    });

    safeLog('WATI_INBOUND_MESSAGE', {
      sessionId: session.id,
      agentName: agent.name,
      messageLength: customerMessage.length
    });

    // ── Cek kata kunci properti ─────────────────────────────────────────────
    const isPropertyQuery = hasPropertyKeyword(customerMessage);
    if (!isPropertyQuery) {
      if (isTerminalActive('WATI')) {
        console.log(`[WATI] 📥 Pesan disimpan (bukan query properti — tidak dibalas): ${customerMessage.substring(0, 60)}`);
      }
      return {
        sessionId: session.id, agentName: agent.name, agentPhone: agent.phone,
        customerPhone, aiReply: null, aiProvider: null,
        skipped: true, skipReason: 'no_property_keyword'
      };
    }

    // ── Ambil property context ───────────────────────────────────────────────
    let propertyCtx = '';
    let ctxSource   = 'none';
    try {
      const ctxResult = await getWhatsappPropertyContext(customerMessage);
      propertyCtx = ctxResult.contextText || '';
      ctxSource   = ctxResult.source      || 'none';
      if (isTerminalActive('WATI')) {
        console.log(`[WATI CONTEXT] Source: ${ctxSource}`);
      }
    } catch (err) {
      console.warn('[WATI CONTEXT] Gagal ambil context:', err.message);
    }

    // Generate AI reply
    let aiReply = null;
    let aiResult = null;
    let aiError = null;

    try {
      aiResult = await AiReplyGenerator.generate(session, customerMessage, agent.name, propertyCtx);
      aiReply = aiResult.reply;

      // Save AI reply
      await MessageProcessor.saveAiReply(session, aiReply, aiResult);

      console.log('[WATI AI] Reply generated:', {
        provider: aiResult.provider,
        replyLength: aiReply.length
      });
    } catch (error) {
      aiError = error.message;
      console.error('[WATI AI ERROR]', aiError);
      safeLog('WATI_AI_FAILED', { sessionId: session.id, error: aiError }, 'error');

      // Use default fallback message
      aiReply = `Halo, terima kasih telah menghubungi ${agent.name} dari ${process.env.APP_NAME || 'Elevan Property'}. Pesan Anda sudah kami terima dan akan segera dibalas. 🙏`;
      aiResult = {
        provider: 'default_fallback',
        primaryProvider: 'unknown',
        fallbackUsed: true
      };
    }

    // Send reply via WATI
    let watiSent = false;
    let watiError = null;

    try {
      const sendResult = await WatiService.sendMessage(customerPhone, aiReply, agent.phone);
      watiSent = true;

      console.log('[WATI SEND] Reply sent successfully');
      safeLog('WATI_REPLY_SENT', {
        sessionId: session.id,
        recipient: customerPhone,
        messageId: sendResult.messageId
      });
    } catch (error) {
      watiError = error.message;
      console.error('[WATI SEND ERROR]', watiError);
      safeLog('WATI_REPLY_SEND_FAILED', {
        sessionId: session.id,
        error: watiError
      }, 'error');
    }

    return {
      sessionId: session.id,
      agentName: agent.name,
      agentPhone: agent.phone,
      customerPhone: customerPhone,
      aiReply: aiReply,
      aiProvider: aiResult?.provider || null,
      fallbackUsed: aiResult?.fallbackUsed || false,
      watiSent: watiSent,
      errors: {
        ai: aiError || null,
        wati: watiError || null
      }
    };
  }

  /**
   * GET /api/wati/agent-chats/:agentName
   * Get all active chats for a specific agent
   */
  static async getAgentChats(req, res) {
    try {
      const { agentName } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!agentName) {
        return res.status(400).json({
          success: false,
          message: 'agentName parameter required'
        });
      }

      const agentSlug = agentName.toLowerCase().replace(/\s+/g, '_');
      const source = `wati_${agentSlug}`;

      const sessions = await ChatSession.findAll({
        where: { source },
        order: [['updatedAt', 'DESC']],
        limit: Math.min(parseInt(limit) || 50, 200),
        offset: parseInt(offset) || 0
      });

      const total = await ChatSession.count({ where: { source } });

      return res.json({
        success: true,
        data: {
          agent: agentName,
          sessions: sessions,
          pagination: {
            total,
            limit: Math.min(parseInt(limit) || 50, 200),
            offset: parseInt(offset) || 0
          }
        }
      });
    } catch (error) {
      console.error('[WATI GET AGENT CHATS ERROR]', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve agent chats',
        error: error.message
      });
    }
  }

  /**
   * GET /api/wati/chat-history/:sessionId
   * Get conversation history for a session
   */
  static async getChatHistory(req, res) {
    try {
      const { sessionId } = req.params;
      const { limit = 100 } = req.query;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'sessionId parameter required'
        });
      }

      const session = await ChatSession.findByPk(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const messages = await ChatMessage.findAll({
        where: { chatSessionId: sessionId },
        order: [['createdAt', 'ASC']],
        limit: Math.min(parseInt(limit) || 100, 500)
      });

      return res.json({
        success: true,
        data: {
          session: {
            id: session.id,
            customerName: session.name,
            customerPhone: session.phone,
            agentSource: session.source,
            source: session.source,
            createdAt: session.createdAt
          },
          messages: messages,
          messageCount: messages.length
        }
      });
    } catch (error) {
      console.error('[WATI GET CHAT HISTORY ERROR]', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve chat history',
        error: error.message
      });
    }
  }

  /**
   * GET /api/wati/agents/list
   * Get all registered agents with WhatsApp numbers
   */
  static async getRegisteredAgents(req, res) {
    try {
      const agents = await AgentLookup.getAll();

      return res.json({
        success: true,
        data: {
          agents: agents,
          totalAgents: agents.length
        }
      });
    } catch (error) {
      console.error('[WATI GET AGENTS LIST ERROR]', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve agents',
        error: error.message
      });
    }
  }

  /**
   * GET /api/wati/status
   * Get WATI connection status & configuration
   */
  static async getWatiStatus(req, res) {
    try {
      const config = WatiService.checkWatiConfig();
      let profileOk = false;
      let profileError = null;

      if (config.enabled) {
        try {
          await WatiService.getProfile();
          profileOk = true;
        } catch (error) {
          profileError = error.message;
        }
      }

      return res.status(config.enabled && profileOk ? 200 : 500).json({
        success: config.enabled && profileOk,
        wati: {
          ...config,
          connected: profileOk,
          error: profileError || null
        },
        message: config.enabled && profileOk
          ? 'WATI API is configured and connected'
          : 'WATI API configuration issue'
      });
    } catch (error) {
      console.error('[WATI STATUS ERROR]', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to check WATI status',
        error: error.message
      });
    }
  }
}

module.exports = WatiChatController;

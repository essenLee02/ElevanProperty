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

      // Try normalized match if database might have normalized format
      agent = await User.findOne({
        where: { privilege: 'agent', status: 1 },
        attributes: ['id', 'user_id', 'name', 'phone', 'username']
      });

      if (agent) {
        const agentNormalized = PhoneUtils.normalize(agent.phone);
        if (agentNormalized === normalized) {
          console.log(`[WATI AGENT] Found via normalized match: ${agent.name} (${agent.phone})`);
          return agent;
        }
      }

      console.warn(`[WATI AGENT] No agent found for phone: ${phoneNumber} (normalized: ${normalized})`);
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
  static async generate(session, customerMessage, agentName) {
    const appName = process.env.APP_NAME || 'Elevan Property';

    // Priority 1: ChatGPT
    try {
      console.log('[WATI AI] Attempting ChatGPT...');
      const reply = await generateChatGPTWhatsappReply(session, [], customerMessage, '');
      return {
        reply,
        provider: 'chatgpt',
        primaryProvider: 'chatgpt',
        fallbackUsed: false
      };
    } catch (error) {
      const isRecoverable = isChatGPTFallbackEligibleError(error);
      console.warn('[WATI AI] ChatGPT failed:', error.message, `(Recoverable: ${isRecoverable})`);

      if (!isRecoverable) {
        console.error('[WATI AI] ChatGPT error not recoverable, skipping to Claude');
      }
    }

    // Priority 2: Claude
    try {
      console.log('[WATI AI] Attempting Claude...');
      const reply = await generateClaudeWhatsappReply(session, [], customerMessage, '');
      return {
        reply,
        provider: 'claude',
        primaryProvider: 'chatgpt',
        fallbackUsed: true,
        fallbackProvider: 'claude'
      };
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
   */
  static async findOrCreateSession(customerPhone, agentName) {
    try {
      let session = await ChatSession.findOne({
        where: {
          customerPhone: customerPhone,
          agentName: agentName
        }
      });

      if (session) {
        return session;
      }

      session = await ChatSession.create({
        customerName: 'Customer', // Will be updated from customer data if available
        customerPhone: customerPhone,
        normalizedPhone: PhoneUtils.normalize(customerPhone),
        agentName: agentName,
        source: 'whatsapp'
      });

      console.log(`[WATI SESSION] Created new session: ID ${session.id}`);
      return session;
    } catch (error) {
      console.error('[WATI SESSION ERROR]', error.message);
      throw error;
    }
  }

  /**
   * Save customer message to database
   */
  static async saveCustomerMessage(session, message, metadata = {}) {
    try {
      const saved = await ChatMessage.create({
        session_id: session.id,
        role: 'user',
        message: message,
        source: 'whatsapp',
        metadata: metadata
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
        session_id: session.id,
        role: 'assistant',
        message: reply,
        source: 'whatsapp',
        aiProvider: aiResult.provider,
        metadata: {
          primaryProvider: aiResult.primaryProvider,
          fallbackUsed: aiResult.fallbackUsed,
          fallbackProvider: aiResult.fallbackProvider || null
        }
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
   * Log incoming WATI message in pretty format
   */
  static logInboundMessage(agentName, agentPhone, customerPhone, customerMessage) {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                   📱 WATI INBOUND MESSAGE                  ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ Agent        : ${agentName} (${agentPhone.slice(-10)})`);
    console.log(`║ Customer     : ${customerPhone}`);
    console.log(`║ Timestamp    : ${new Date().toISOString()}`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ MESSAGE:');
    console.log('╟────────────────────────────────────────────────────────────╢');

    const maxWidth = 56;
    const lines = String(customerMessage).split('\n');

    lines.forEach(line => {
      if (line.length > maxWidth) {
        let current = '';
        line.split(' ').forEach(word => {
          if ((current + word).length > maxWidth) {
            console.log(`║ ${current}`);
            current = word + ' ';
          } else {
            current += word + ' ';
          }
        });
        if (current.trim()) console.log(`║ ${current}`);
      } else {
        console.log(`║ ${line}`);
      }
    });

    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
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
   * WATI webhook payload structure:
   * {
   *   "from": "628xxxxxxxxx",        // Customer phone
   *   "to": "6282111367154",         // Agent phone (Clarence)
   *   "message": "Halo...",
   *   "timestamp": "2026-05-25T10:00:00Z",
   *   "messageId": "msg_123456"
   * }
   */
  static async handleInboundMessage(req, res) {
    try {
      const payload = req.body;

      // Validate payload
      if (!payload || !payload.from || !payload.to || !payload.message) {
        console.warn('[WATI WEBHOOK] Invalid payload:', payload);
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook payload: missing required fields'
        });
      }

      const customerPhone = payload.from;
      const agentPhone = payload.to;
      const customerMessage = String(payload.message || '').trim();
      const messageId = payload.messageId || `wati_${Date.now()}`;

      // Validate phone numbers
      if (!PhoneUtils.isValid(customerPhone)) {
        console.warn('[WATI WEBHOOK] Invalid customer phone:', customerPhone);
        return res.status(400).json({
          success: false,
          message: 'Invalid customer phone number'
        });
      }

      if (!PhoneUtils.isValid(agentPhone)) {
        console.warn('[WATI WEBHOOK] Invalid agent phone:', agentPhone);
        return res.status(400).json({
          success: false,
          message: 'Invalid agent phone number'
        });
      }

      // Find agent from database
      const agent = await AgentLookup.findByPhone(agentPhone);
      if (!agent) {
        console.warn('[WATI WEBHOOK] Agent not found:', agentPhone);
        safeLog('WATI_AGENT_NOT_FOUND', { agentPhone, customerPhone }, 'warn');
        return res.status(404).json({
          success: false,
          message: `Agent with phone ${agentPhone} not found in database`
        });
      }

      // Log incoming message
      Logger.logInboundMessage(agent.name, agentPhone, customerPhone, customerMessage);

      // Process message
      const result = await WatiChatController._processMessage(
        agent,
        customerPhone,
        customerMessage,
        messageId
      );

      return res.json({
        success: true,
        data: result,
        message: 'Message processed successfully'
      });
    } catch (error) {
      console.error('[WATI WEBHOOK ERROR]', error.message);
      safeLog('WATI_WEBHOOK_ERROR', error.message, 'error');
      return res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message
      });
    }
  }

  /**
   * Internal: Process message flow
   */
  static async _processMessage(agent, customerPhone, customerMessage, messageId) {
    // Create/find session
    const session = await MessageProcessor.findOrCreateSession(customerPhone, agent.name);

    // Save customer message
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

    // Generate AI reply
    let aiReply = null;
    let aiResult = null;
    let aiError = null;

    try {
      aiResult = await AiReplyGenerator.generate(session, customerMessage, agent.name);
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

      const sessions = await ChatSession.findAll({
        where: { agentName },
        order: [['updatedAt', 'DESC']],
        limit: Math.min(parseInt(limit) || 50, 200),
        offset: parseInt(offset) || 0
      });

      const total = await ChatSession.count({ where: { agentName } });

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
        where: { session_id: sessionId },
        order: [['createdAt', 'ASC']],
        limit: Math.min(parseInt(limit) || 100, 500)
      });

      return res.json({
        success: true,
        data: {
          session: {
            id: session.id,
            customerName: session.customerName,
            customerPhone: session.customerPhone,
            agentName: session.agentName,
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

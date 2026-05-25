/**
 * watiChatController.js
 *
 * Handle incoming WhatsApp messages from WATI webhook.
 * Workflow:
 * 1. Receive webhook from WATI → message dari customer ke agent WhatsApp
 * 2. Identify agent dari nomor WhatsApp (query User.phone dari database)
 * 3. Extract customer info & message
 * 4. Generate AI reply (ChatGPT → Claude → private_agent fallback)
 * 5. Send reply balik ke customer via WATI API
 * 6. Store semua ke database (chat_sessions, chat_messages, whatsapp_inbound_messages)
 */

const { User, ChatSession, ChatMessage } = require('../models');
const WatiService = require('../services/watiService');
const {
  generateChatGPTWhatsappReply,
  isChatGPTFallbackEligibleError,
  checkChatGPTConfig
} = require('../services/openaiService');
const {
  generateClaudeWhatsappReply,
  checkClaudeConfig
} = require('../services/claudeService');
const { generatePrivateWhatsappReply } = require('./chatbotPrivateController');
const { safeLog } = require('../utils/safeLog');

class WatiChatController {
  /**
   * Normalize phone number untuk database query
   * +62 821-1136-7154 → 6282111367154
   * 082233556796     → 6282233556796
   */
  static #normalizePhone(phone = '') {
    return String(phone || '')
      .replace(/\+62/g, '62')
      .replace(/^0/, '62')
      .replace(/[\s\-()]/g, '');
  }

  /**
   * Find agent dari User table by phone number
   */
  static async #findAgentByPhone(phoneNumber) {
    if (!phoneNumber) return null;

    const normalized = WatiChatController.#normalizePhone(phoneNumber);

    try {
      const agent = await User.findOne({
        where: {
          phone: phoneNumber  // Try exact match first
        }
      });

      if (agent) return agent;

      // Try normalized match
      const agents = await User.findAll({
        where: { privilege: 'agent', status: 1 },
        attributes: ['id', 'user_id', 'name', 'phone', 'username']
      });

      for (const a of agents) {
        const agentNormalized = WatiChatController.#normalizePhone(a.phone);
        if (agentNormalized === normalized) {
          return a;
        }
      }

      return null;
    } catch (error) {
      console.error('[WATI FIND AGENT ERROR]', error.message);
      return null;
    }
  }

  /**
   * Generate AI reply dengan fallback chain
   * ChatGPT → Claude → Private Agent
   */
  static async #generateAiReply(session, customerMessage, agentName) {
    let aiResult = null;
    let primaryError = null;
    let usedFallback = false;

    // Try ChatGPT first
    try {
      const gptConfig = checkChatGPTConfig();
      if (gptConfig.hasApiKey && gptConfig.keyLooksValid) {
        console.log('[WATI AI] Trying ChatGPT...');
        aiResult = await generateChatGPTWhatsappReply(session, [], customerMessage, '');
        return {
          reply: aiResult,
          provider: 'chatgpt',
          primaryProvider: 'chatgpt',
          fallbackUsed: false
        };
      }
    } catch (error) {
      primaryError = error.message;
      console.warn('[WATI AI] ChatGPT failed:', primaryError);

      // Check if error is recoverable
      if (!isChatGPTFallbackEligibleError(error)) {
        console.error('[WATI AI] ChatGPT error not recoverable, skipping');
      }
    }

    // Try Claude
    try {
      const claudeConfig = checkClaudeConfig();
      if (claudeConfig.hasApiKey && claudeConfig.keyLooksValid) {
        console.log('[WATI AI] Trying Claude...');
        aiResult = await generateClaudeWhatsappReply(session, [], customerMessage, '');
        return {
          reply: aiResult,
          provider: 'claude',
          primaryProvider: 'chatgpt',
          fallbackUsed: true,
          primaryError
        };
      }
    } catch (error) {
      console.warn('[WATI AI] Claude failed:', error.message);
      primaryError = error.message;
    }

    // Fallback to private agent
    try {
      console.log('[WATI AI] Using private agent fallback...');
      aiResult = generatePrivateWhatsappReply({
        name: session.name || 'Valued Customer',
        phone: session.customerPhone,
        message: customerMessage,
        agentName: agentName || 'Property Consultant'
      });
      usedFallback = true;

      return {
        reply: aiResult.reply,
        provider: 'private_agent',
        primaryProvider: 'chatgpt',
        fallbackUsed: true,
        fallbackProvider: 'private_agent',
        primaryError,
        usedFallback: true
      };
    } catch (error) {
      console.error('[WATI AI] All providers failed:', error.message);
      safeLog('WATI_AI_ALL_PROVIDERS_FAILED', {
        customerPhone: session.customerPhone,
        error: error.message
      }, 'error');

      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  /**
   * POST /api/whatsapp/webhook
   * WATI webhook payload
   *
   * Webhook format dari WATI:
   * {
   *   "waNumber": "628xxxxxxxxx",        // Agent nomor WhatsApp
   *   "senderNumber": "628yyyyyyyyy",    // Customer nomor
   *   "senderName": "Customer Name",
   *   "messageText": "Halo, saya cari rumah",
   *   "messageTimeStamp": 1685012345,
   *   "messageId": "msg_123456",
   *   "messageType": "text" atau "image", dll
   * }
   */
  static async handleInboundMessage(req, res) {
    try {
      const payload = req.body;

      // Validate webhook payload
      if (!payload.waNumber || !payload.senderNumber || !payload.messageText) {
        console.warn('[WATI WEBHOOK] Invalid payload structure:', payload);
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook payload'
        });
      }

      const agentPhone = payload.waNumber;
      const customerPhone = payload.senderNumber;
      const customerName = payload.senderName || 'Unknown Customer';
      const messageText = String(payload.messageText || '').trim();
      const messageId = payload.messageId || null;
      const timestamp = payload.messageTimeStamp ? new Date(payload.messageTimeStamp * 1000) : new Date();

      // Find agent from User table
      const agent = await WatiChatController.#findAgentByPhone(agentPhone);
      if (!agent) {
        console.warn('[WATI WEBHOOK] Message from unknown agent phone:', agentPhone);
        safeLog('WATI_UNKNOWN_AGENT', { agentPhone, customerPhone }, 'warn');
        return res.status(400).json({
          success: false,
          message: 'Unknown agent phone number'
        });
      }

      // Log incoming message
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║                   📱 WATI INBOUND MESSAGE                  ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║ Agent        : ${agent.name} (${agentPhone})`);
      console.log(`║ Customer     : ${customerName} (${customerPhone})`);
      console.log(`║ Timestamp    : ${timestamp.toISOString()}`);
      console.log(`║ Message ID   : ${messageId || 'N/A'}`);
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║ MESSAGE:');
      console.log('╟────────────────────────────────────────────────────────────╢');
      const maxWidth = 56;
      messageText.split('\n').forEach(line => {
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

      // Find or create chat session
      let session = await ChatSession.findOne({
        where: {
          customerPhone: customerPhone,
          agentName: agent.name
        }
      });

      if (!session) {
        session = await ChatSession.create({
          customerName: customerName,
          customerPhone: customerPhone,
          normalizedPhone: WatiChatController.#normalizePhone(customerPhone),
          agentName: agent.name,
          source: 'whatsapp'
        });
        console.log(`[WATI] New session created: ID ${session.id}`);
      }

      // Save customer message
      await ChatMessage.create({
        session_id: session.id,
        role: 'user',
        message: messageText,
        source: 'whatsapp',
        metadata: {
          agentName: agent.name,
          agentUserId: agent.user_id,
          messageId: messageId,
          originalPhone: customerPhone
        }
      });

      safeLog('WATI_INBOUND_MESSAGE', {
        sessionId: session.id,
        agentName: agent.name,
        customerName: customerName,
        messageLength: messageText.length
      });

      // Generate AI reply
      let aiReply = null;
      let aiResult = null;
      let replyError = null;

      try {
        aiResult = await WatiChatController.#generateAiReply(session, messageText, agent.name);
        aiReply = aiResult.reply;

        // Save AI reply to database
        await ChatMessage.create({
          session_id: session.id,
          role: 'assistant',
          message: aiReply,
          source: 'whatsapp',
          aiProvider: aiResult.provider,
          metadata: {
            primaryProvider: aiResult.primaryProvider,
            fallbackUsed: aiResult.fallbackUsed,
            fallbackProvider: aiResult.fallbackProvider || null,
            primaryError: aiResult.primaryError || null,
            usedFallback: aiResult.usedFallback || false
          }
        });

        console.log('[WATI] AI reply generated:', {
          provider: aiResult.provider,
          fallbackUsed: aiResult.fallbackUsed,
          replyLength: aiReply.length
        });
      } catch (aiError) {
        replyError = aiError.message;
        console.error('[WATI AI ERROR]', replyError);
        safeLog('WATI_AI_GENERATION_FAILED', {
          sessionId: session.id,
          error: replyError
        }, 'error');

        // Use default reply if AI fails
        aiReply = `Halo ${customerName}, terima kasih telah menghubungi ${agent.name} dari Elevan Property. Tim kami akan segera membalas pesan Anda. Mohon ditunggu sebentar. 🙏`;
      }

      // Send reply via WATI
      let watiSent = false;
      let watiError = null;

      try {
        const watiResult = await WatiService.sendMessage(customerPhone, aiReply, agentPhone);
        watiSent = true;

        console.log('[WATI SEND] Reply sent successfully:', {
          recipient: customerPhone,
          messageId: watiResult.messageId
        });

        safeLog('WATI_REPLY_SENT', {
          sessionId: session.id,
          recipient: customerPhone,
          messageId: watiResult.messageId
        });
      } catch (error) {
        watiError = error.message;
        console.error('[WATI SEND ERROR]', watiError);
        safeLog('WATI_REPLY_SEND_FAILED', {
          sessionId: session.id,
          error: watiError
        }, 'error');
      }

      // Return response
      return res.json({
        success: true,
        message: 'Message received and processed',
        data: {
          sessionId: session.id,
          agentName: agent.name,
          customerName: customerName,
          messageId: messageId,
          aiReply: aiReply,
          aiProvider: aiResult?.provider || null,
          fallbackUsed: aiResult?.fallbackUsed || false,
          watiSent: watiSent,
          watiError: watiError || null,
          errors: {
            ai: replyError || null,
            wati: watiError || null
          }
        }
      });
    } catch (error) {
      console.error('[WATI WEBHOOK ERROR]', error);
      safeLog('WATI_WEBHOOK_ERROR', error.message, 'error');
      return res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message
      });
    }
  }

  /**
   * GET /api/whatsapp/agent-chats/:agentName
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
      console.error('[WATI GET AGENT CHATS ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve agent chats',
        error: error.message
      });
    }
  }

  /**
   * GET /api/whatsapp/chat-history/:sessionId
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
      console.error('[WATI GET CHAT HISTORY ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve chat history',
        error: error.message
      });
    }
  }

  /**
   * GET /api/whatsapp/agents/list
   * Get all registered agents with WhatsApp numbers
   */
  static async getRegisteredAgents(req, res) {
    try {
      const agents = await User.findAll({
        where: { privilege: 'agent', status: 1 },
        attributes: ['id', 'user_id', 'name', 'phone', 'username', 'created_date'],
        order: [['created_date', 'ASC']]
      });

      return res.json({
        success: true,
        data: {
          agents: agents,
          totalAgents: agents.length
        }
      });
    } catch (error) {
      console.error('[WATI GET AGENTS LIST ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve agents',
        error: error.message
      });
    }
  }

  /**
   * GET /api/whatsapp/status
   * Get WATI connection status & configuration
   */
  static async getWatiStatus(req, res) {
    try {
      const config = WatiService.checkWatiConfig();
      let profileOk = false;
      let profileError = null;

      // Try to verify WATI API token
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
      console.error('[WATI STATUS ERROR]', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check WATI status',
        error: error.message
      });
    }
  }
}

module.exports = WatiChatController;

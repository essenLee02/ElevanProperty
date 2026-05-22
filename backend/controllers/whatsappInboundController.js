/**
 * whatsappInboundController.js
 *
 * Handle incoming WhatsApp messages from Fonnte webhook.
 * Captures messages from 5 agents and logs them to terminal + database.
 *
 * Agents:
 * - Clarence: +62 821-1136-7154
 * - Desy: +62 821-1331-8191
 * - Nigel: 082233556796
 * - Natasha: +62 822-3058-7788
 * - Leo: 0813-3470-8691
 */

const { WhatsAppInbound } = require('../models');
const { safeLog } = require('../utils/safeLog');

/**
 * Normalize phone number to consistent format (remove +62, spaces, dashes)
 * +62 821-1136-7154 → 6282111367154
 * 082233556796 → 6282233556796
 */
function normalizePhoneNumber(phone = '') {
  let normalized = String(phone || '')
    .replace(/\+62/g, '62')      // +62 → 62
    .replace(/^0/, '62')          // 0 → 62 (if starts with 0)
    .replace(/[\s\-()]/g, '');    // remove spaces, dashes, parentheses

  return normalized;
}

/**
 * Map agent phone number to agent name and original number
 */
const AGENTS = {
  '6282111367154': { name: 'Clarence', original: '+62 821-1136-7154' },
  '6282113367154': { name: 'Clarence', original: '+62 821-1136-7154' }, // alternative format
  '6282113318191': { name: 'Desy', original: '+62 821-1331-8191' },
  '6282113318191': { name: 'Desy', original: '+62 821-1331-8191' },
  '6282233556796': { name: 'Nigel', original: '082233556796' },
  '6282223058788': { name: 'Natasha', original: '+62 822-3058-7788' },
  '6281334708691': { name: 'Leo', original: '0813-3470-8691' },
};

/**
 * Find agent by phone number (try multiple formats)
 */
function findAgent(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);

  // Try exact match
  if (AGENTS[normalized]) {
    return AGENTS[normalized];
  }

  // Try matching just the number part (without country code)
  for (const [key, agent] of Object.entries(AGENTS)) {
    if (key.includes(normalized.slice(-10))) {
      return agent;
    }
  }

  return null;
}

/**
 * POST /api/whatsapp/webhook
 * Webhook endpoint for Fonnte inbound messages
 *
 * Expected Fonnte webhook payload:
 * {
 *   "from": "+62 821-1136-7154",
 *   "message": "Halo? Saya boleh tanya rumah yang disewakan di surabaya?",
 *   "sender": "Lia (+62 881 0365 88874)",
 *   "timestamp": "2026-05-21 10:30:45",
 *   "media_type": null,
 *   "media_url": null,
 *   "device_id": "fonnte_device_123"
 * }
 */
exports.handleInboundMessage = async (req, res) => {
  try {
    const payload = req.body;

    // Validate webhook payload
    if (!payload.from || !payload.message) {
      console.warn('[WHATSAPP WEBHOOK] Invalid payload structure:', payload);
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload'
      });
    }

    const agentNumber = payload.from;
    const agent = findAgent(agentNumber);

    if (!agent) {
      console.warn('[WHATSAPP WEBHOOK] Message from unknown agent:', agentNumber);
      return res.status(400).json({
        success: false,
        message: 'Unknown agent number'
      });
    }

    // Parse sender info (e.g., "Lia (+62 881 0365 88874)")
    const senderMatch = (payload.sender || '').match(/^(.+?)\s*\(([^)]+)\)$/);
    const senderName = senderMatch ? senderMatch[1].trim() : 'Unknown';
    const senderPhone = senderMatch ? senderMatch[2].trim() : 'Unknown';

    // Display in terminal with requested format
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                   📱 WHATSAPP INBOUND MESSAGE              ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ From        : ${agent.name} (${agentNumber.slice(-10)})`);
    console.log(`║ From Full   : ${agentNumber}`);
    console.log(`║ Request     : ${senderName} (${senderPhone})`);
    console.log(`║ Timestamp   : ${payload.timestamp || new Date().toISOString()}`);
    console.log(`║ Device ID   : ${payload.device_id || 'N/A'}`);
    if (payload.media_type) {
      console.log(`║ Media Type  : ${payload.media_type}`);
      console.log(`║ Media URL   : ${payload.media_url || 'N/A'}`);
    }
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ MESSAGE:');
    console.log('╟────────────────────────────────────────────────────────────╢');

    // Display message with word wrapping
    const message = String(payload.message || '');
    const lines = message.split('\n');
    lines.forEach((line, idx) => {
      // Wrap long lines
      const maxWidth = 56;
      if (line.length > maxWidth) {
        const words = line.split(' ');
        let currentLine = '';
        words.forEach((word) => {
          if ((currentLine + word).length > maxWidth) {
            console.log(`║ ${currentLine}`);
            currentLine = word + ' ';
          } else {
            currentLine += word + ' ';
          }
        });
        if (currentLine.trim()) {
          console.log(`║ ${currentLine}`);
        }
      } else {
        console.log(`║ ${line}`);
      }
    });

    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    // Save to database
    let dbRecord = null;
    try {
      dbRecord = await WhatsAppInbound.create({
        agentName: agent.name,
        agentPhone: agentNumber,
        agentPhoneNormalized: normalizePhoneNumber(agentNumber),
        senderName,
        senderPhone,
        senderPhoneNormalized: normalizePhoneNumber(senderPhone),
        message,
        mediaType: payload.media_type || null,
        mediaUrl: payload.media_url || null,
        deviceId: payload.device_id || null,
        timestamp: payload.timestamp || new Date().toISOString(),
        rawPayload: JSON.stringify(payload),
        status: 'received'
      });

      safeLog('WHATSAPP_INBOUND_MESSAGE', {
        recordId: dbRecord.id,
        agentName: agent.name,
        senderName,
        messageLength: message.length
      });
    } catch (dbError) {
      console.error('[WHATSAPP WEBHOOK] Database save failed:', dbError.message);
      // Log error but don't fail the webhook response (Fonnte might retry)
      safeLog('WHATSAPP_INBOUND_DB_ERROR', {
        agentName: agent.name,
        error: dbError.message
      }, 'error');
    }

    // Return success response to Fonnte
    return res.json({
      success: true,
      message: 'Message received and processed',
      recordId: dbRecord?.id || null
    });
  } catch (error) {
    console.error('[WHATSAPP WEBHOOK ERROR]', error);
    safeLog('WHATSAPP_WEBHOOK_ERROR', error.message, 'error');

    return res.status(500).json({
      success: false,
      message: 'Failed to process webhook'
    });
  }
};

/**
 * GET /api/whatsapp/messages
 * Retrieve inbound messages (with optional filtering)
 *
 * Query params:
 * - agent=Nigel (filter by agent name)
 * - limit=50 (default 50)
 * - offset=0 (for pagination)
 */
exports.getInboundMessages = async (req, res) => {
  try {
    const { agent, limit = 50, offset = 0 } = req.query;

    const query = {};
    if (agent) {
      query.agentName = String(agent).trim();
    }

    const messages = await WhatsAppInbound.findAll({
      where: query,
      order: [['createdAt', 'DESC']],
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0
    });

    const total = await WhatsAppInbound.count({ where: query });

    return res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        limit: Math.min(parseInt(limit) || 50, 200),
        offset: parseInt(offset) || 0
      }
    });
  } catch (error) {
    console.error('[WHATSAPP GET MESSAGES ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages'
    });
  }
};

/**
 * GET /api/whatsapp/messages/:id
 * Get a single message with full details
 */
exports.getMessageDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await WhatsAppInbound.findByPk(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    return res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('[WHATSAPP GET MESSAGE ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve message'
    });
  }
};

/**
 * GET /api/whatsapp/agents/status
 * Get status of all 5 agents
 */
exports.getAgentsStatus = async (req, res) => {
  try {
    const agentStatuses = [];

    for (const [phoneNormalized, agentInfo] of Object.entries(AGENTS)) {
      const lastMessage = await WhatsAppInbound.findOne({
        where: { agentPhoneNormalized: normalizePhoneNumber(agentInfo.original) },
        order: [['createdAt', 'DESC']]
      });

      const messageCount = await WhatsAppInbound.count({
        where: { agentPhoneNormalized: normalizePhoneNumber(agentInfo.original) }
      });

      agentStatuses.push({
        name: agentInfo.name,
        phone: agentInfo.original,
        phoneNormalized: phoneNormalized,
        totalMessages: messageCount,
        lastMessageAt: lastMessage?.createdAt || null,
        lastMessageFrom: lastMessage?.senderName || null,
        status: messageCount > 0 ? 'active' : 'no_messages'
      });
    }

    return res.json({
      success: true,
      data: {
        agents: agentStatuses,
        totalMessages: await WhatsAppInbound.count(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[WHATSAPP AGENTS STATUS ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve agents status'
    });
  }
};

/**
 * whatsappInboundController.js
 *
 * Handle incoming WhatsApp messages from Fonnte webhook.
 * Captures messages from agent phone numbers and logs them to terminal + database.
 *
 * Agent lookup dilakukan ke tabel `users` berdasarkan field `phone` — tidak ada
 * data phone yang hardcode di sini.
 */

'use strict';

const { Op }             = require('sequelize');
const { WhatsAppInbound, User } = require('../models');
const { safeLog }        = require('../utils/safeLog');

class WhatsAppInboundController {

  /**
   * Normalize phone number ke format 628... (strip +, spaces, dashes, leading 0).
   * "+62 821-1136-7154" → "6282111367154"
   * "082233556796"      → "6282233556796"
   */
  static #normalize(phone = '') {
    return String(phone || '')
      .replace(/\+62/g, '62')
      .replace(/^0/, '62')
      .replace(/[\s\-()]/g, '');
  }

  /**
   * Cari user agent berdasarkan nomor telepon di tabel `users`.
   * Matching dilakukan dengan 10 digit terakhir (suffix) agar toleran terhadap
   * format simpan yang berbeda (0812xxx vs +62 812xxx vs 62812xxx).
   *
   * @param {string} phoneNumber  Nomor dari payload webhook (format apapun)
   * @returns {Promise<{name: string, phone: string}|null>}
   */
  static async #findAgent(phoneNumber) {
    const normalized = WhatsAppInboundController.#normalize(phoneNumber);
    const last10     = normalized.slice(-10);
    if (!last10) return null;

    try {
      const user = await User.findOne({
        where: {
          phone:  { [Op.like]: `%${last10}` },
          status: 1
        },
        attributes: ['name', 'phone']
      });

      if (!user) return null;
      return { name: user.name, phone: user.phone };
    } catch (_) {
      return null;
    }
  }

  /**
   * POST /api/whatsapp/webhook
   * Fonnte webhook payload:
   * { from, message, sender: "Name (+62 8xx)", timestamp, media_type, media_url, device_id }
   */
  static async handleInboundMessage(req, res) {
    try {
      const payload = req.body;

      if (!payload.from || !payload.message) {
        console.warn('[WHATSAPP WEBHOOK] Invalid payload structure:', payload);
        return res.status(process.env.HTTP_BAD_REQUEST).json({ success: false, message: 'Invalid webhook payload' });
      }

      const agentNumber = payload.from;
      const agent       = await WhatsAppInboundController.#findAgent(agentNumber);

      if (!agent) {
        console.warn('[WHATSAPP WEBHOOK] Message from unknown agent:', agentNumber);
        return res.status(process.env.HTTP_BAD_REQUEST).json({ success: false, message: 'Unknown agent number' });
      }

      const senderMatch = (payload.sender || '').match(/^(.+?)\s*\(([^)]+)\)$/);
      const senderName  = senderMatch ? senderMatch[1].trim() : 'Unknown';
      const senderPhone = senderMatch ? senderMatch[2].trim() : 'Unknown';

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

      const message  = String(payload.message || '');
      const maxWidth = 56;
      message.split('\n').forEach(line => {
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

      let dbRecord = null;
      try {
        dbRecord = await WhatsAppInbound.create({
          agentName:            agent.name,
          agentPhone:           agentNumber,
          agentPhoneNormalized: WhatsAppInboundController.#normalize(agentNumber),
          senderName,
          senderPhone,
          senderPhoneNormalized: WhatsAppInboundController.#normalize(senderPhone),
          message,
          mediaType:   payload.media_type  || null,
          mediaUrl:    payload.media_url   || null,
          deviceId:    payload.device_id   || null,
          timestamp:   payload.timestamp   || new Date().toISOString(),
          rawPayload:  JSON.stringify(payload),
          status:      'received'
        });

        safeLog('WHATSAPP_INBOUND_MESSAGE', {
          recordId:      dbRecord.id,
          agentName:     agent.name,
          senderName,
          messageLength: message.length
        });
      } catch (dbError) {
        console.error('[WHATSAPP WEBHOOK] Database save failed:', dbError.message);
        safeLog('WHATSAPP_INBOUND_DB_ERROR', { agentName: agent.name, error: dbError.message }, 'error');
      }

      return res.json({
        success:  true,
        message:  'Message received and processed',
        recordId: dbRecord?.id || null
      });

    } catch (error) {
      console.error('[WHATSAPP WEBHOOK ERROR]', error);
      safeLog('WHATSAPP_WEBHOOK_ERROR', error.message, 'error');
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to process webhook' });
    }
  }

  /**
   * GET /api/whatsapp/messages
   * Query params: agent, limit (default 50), offset
   */
  static async getInboundMessages(req, res) {
    try {
      const { agent, limit = 50, offset = 0 } = req.query;

      const query = {};
      if (agent) query.agentName = String(agent).trim();

      const messages = await WhatsAppInbound.findAll({
        where:  query,
        order:  [['createdAt', 'DESC']],
        limit:  Math.min(parseInt(limit) || 50, 200),
        offset: parseInt(offset) || 0
      });

      const total = await WhatsAppInbound.count({ where: query });

      return res.json({
        success: true,
        data:    messages,
        pagination: {
          total,
          limit:  Math.min(parseInt(limit) || 50, 200),
          offset: parseInt(offset) || 0
        }
      });
    } catch (error) {
      console.error('[WHATSAPP GET MESSAGES ERROR]', error);
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to retrieve messages' });
    }
  }

  /**
   * GET /api/whatsapp/messages/:id
   */
  static async getMessageDetail(req, res) {
    try {
      const message = await WhatsAppInbound.findByPk(req.params.id);

      if (!message) {
        return res.status(process.env.HTTP_NOT_FOUND).json({ success: false, message: 'Message not found' });
      }

      return res.json({ success: true, data: message });
    } catch (error) {
      console.error('[WHATSAPP GET MESSAGE ERROR]', error);
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to retrieve message' });
    }
  }
}

module.exports = WhatsAppInboundController;

/**
 * watiService.js
 *
 * WATI (WhatsApp Team Inbox) API service layer.
 * Handles all WATI API calls for sending messages, retrieving messages, etc.
 *
 * WATI API Docs: https://docs.wati.io/rest-api/
 */

const axios = require('axios');
const { sanitizeEnvValue, maskSecret } = require('./openaiService');
const { safeLog } = require('../utils/safeLog');

// WATI API URL harus account-specific, contoh: https://live-mt-server.wati.io/10167096/api/v1
// Set WATI_API_URL di .env sesuai account Anda (lihat WATI Dashboard → Settings → API)
const WATI_API_URL_DEFAULT = 'https://live-mt-server.wati.io/10167096/api/v1';

class WatiService {
  /**
   * Get WATI API token and base URL from .env
   */
  static #getWatiConfig() {
    const token = sanitizeEnvValue(process.env.WATI_API_TOKEN);
    const baseUrl = (process.env.WATI_API_URL || WATI_API_URL_DEFAULT).replace(/\/$/, '');
    return {
      token,
      baseUrl,
      enabled: Boolean(token && token.length > 20)
    };
  }

  /**
   * Check WATI configuration validity
   */
  static checkWatiConfig() {
    const config = WatiService.#getWatiConfig();
    return {
      hasToken: Boolean(config.token),
      keyLooksValid: Boolean(config.token && config.token.length > 20),
      maskedKey: maskSecret(config.token),
      enabled: config.enabled,
      provider: 'wati'
    };
  }

  /**
   * Normalize phone number to WATI format (628xxxxxxxxxx)
   * +62 821-1136-7154 → 6282111367154
   * 082233556796     → 6282233556796
   */
  static normalizePhone(phone = '') {
    return String(phone || '')
      .replace(/\+62/g, '62')
      .replace(/^0/, '62')
      .replace(/[\s\-()]/g, '');
  }

  /**
   * Send WhatsApp message via WATI API
   *
   * @param {string} recipientPhone - Recipient WhatsApp number (628xxxxxxx)
   * @param {string} messageText - Message content
   * @param {string} senderPhone - Sender agent WhatsApp number (optional, for logging)
   * @returns {Promise<{success: boolean, messageId: string, response: object}>}
   */
  static async sendMessage(recipientPhone, messageText, senderPhone = null) {
    const config = WatiService.#getWatiConfig();

    if (!config.enabled) {
      throw new Error('WATI_API_TOKEN is missing or invalid in backend/.env');
    }

    if (!recipientPhone || !messageText) {
      throw new Error('recipientPhone and messageText are required');
    }

    const normalizedPhone = WatiService.normalizePhone(recipientPhone);
    const normalizedMessageLength = String(messageText).trim().length;

    // WhatsApp message length limit: 1600 characters
    if (normalizedMessageLength > 1600) {
      throw new Error(`Message too long (${normalizedMessageLength} chars, max 1600)`);
    }

    // WATI sendSessionMessage: phone goes in URL path, not in body
    const body = { messageText: String(messageText).trim() };

    try {
      console.log('[WATI SEND MESSAGE]', {
        recipient: normalizedPhone,
        messageLength: normalizedMessageLength,
        sender: senderPhone || 'N/A',
        provider: 'wati'
      });

      const response = await axios.post(
        `${config.baseUrl}/sendSessionMessage/${normalizedPhone}`,
        body,
        {
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      safeLog('WATI_MESSAGE_SENT', {
        recipient: normalizedPhone,
        messageLength: normalizedMessageLength,
        sender: senderPhone || 'N/A'
      });

      return {
        success: true,
        messageId: response.data?.messageId || response.data?.id || null,
        response: response.data
      };
    } catch (error) {
      const status = error?.response?.status;
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Unknown WATI API error';

      console.error('[WATI SEND ERROR]', {
        recipient: normalizedPhone,
        status,
        error: errorMessage,
        sender: senderPhone || 'N/A'
      });

      safeLog('WATI_SEND_FAILED', {
        recipient: normalizedPhone,
        error: errorMessage,
        sender: senderPhone || 'N/A'
      }, 'error');

      const finalError = new Error(`WATI API error${status ? ` (${status})` : ''}: ${errorMessage}`);
      finalError.provider = 'wati';
      finalError.status = status;
      throw finalError;
    }
  }

  /**
   * Get WATI account profile/status
   * Verify API token is valid
   */
  static async getProfile() {
    const config = WatiService.#getWatiConfig();

    if (!config.enabled) {
      throw new Error('WATI_API_TOKEN is missing or invalid');
    }

    try {
      const response = await axios.get(`${config.baseUrl}/getProfile`, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        profile: response.data
      };
    } catch (error) {
      const status = error?.response?.status;
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Unknown error';

      throw new Error(`WATI getProfile failed: ${errorMessage} (${status})`);
    }
  }

  /**
   * Get conversation history for a customer
   * (Optional: not used yet, but available for future use)
   */
  static async getConversation(waNumber) {
    const config = WatiService.#getWatiConfig();

    if (!config.enabled) {
      throw new Error('WATI_API_TOKEN is missing or invalid');
    }

    const normalizedPhone = WatiService.normalizePhone(waNumber);

    try {
      const response = await axios.get(`${config.baseUrl}/getConversations`, {
        params: { waNumber: normalizedPhone },
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return {
        success: true,
        conversation: response.data
      };
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.message;
      throw new Error(`WATI getConversation failed: ${errorMessage}`);
    }
  }
}

module.exports = WatiService;

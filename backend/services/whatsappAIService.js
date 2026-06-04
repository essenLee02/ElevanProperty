/**
 * whatsappAIService.js
 *
 * Unified AI response service untuk semua WhatsApp controllers (Fonnte, WATI, 360dialog).
 *
 * Ini adalah wrapper yang menghubungkan WhatsApp controllers dengan chatbot AI logic:
 * - Chat GPT API (primary)
 * - Claude API (secondary fallback)
 * - Private Agent (tertiary fallback)
 *
 * Semua WhatsApp platforms menggunakan service ini untuk consistency.
 *
 * Flow:
 *   1. Keyword filter check (hasPropertyKeyword)
 *   2. Property context injection (getWhatsappPropertyContext)
 *   3. AI provider chain (ChatGPT → Claude → Private Agent)
 *   4. Response formatting untuk WhatsApp
 *   5. Save ke DB + kirim via platform API
 */

'use strict';

const { buildRecommendationContextForLLM,
        extractPropertyFilters,
        getVisibleMatchesFromAlternatives } = require('./propertyRecommendationService');

const { getRumah123Listings,
        mapBuildingTypeToApify,
        mapTransactionTypeToApify } = require('./rumah123ContextService');

const { getWhatsappPropertyContext } = require('../utils/whatsappPropertyContext');

const { generateChatGPTWhatsappReply,
        generateClaudeWhatsappReply } = require('./aiProviderService');

const { generatePrivateWhatsappReply } = require('../controllers/chatbotPrivateController');

/**
 * Generate AI reply untuk WhatsApp message dengan full provider chain.
 *
 * Digunakan oleh: fonnteChatController, watiChatController, dialogChatController
 *
 * @param {object} params
 *   @param {object} session - ChatSession object
 *   @param {string} message - Customer's message text
 *   @param {string} agentName - Name of WhatsApp agent
 *   @param {object} options - Optional: { context, location, propertyType, transactionType }
 * @returns {Promise<{ reply, provider, contextSource }>}
 *   @returns {string} reply - AI-generated response
 *   @returns {string} provider - 'chatgpt' | 'claude' | 'private_agent'
 *   @returns {string} contextSource - 'rumah123' | 'flat_json' | 'none'
 */
async function generateWhatsAppAIReply(params) {
  const { session, message, agentName, options = {} } = params;

  // ── Fetch property context (if not already provided) ──────────────────────
  let propertyCtx = options.context || '';
  let contextSource = 'none';

  if (!propertyCtx) {
    try {
      const ctxResult = await getWhatsappPropertyContext(message);
      propertyCtx = ctxResult.contextText || '';
      contextSource = ctxResult.source || 'none';
    } catch (err) {
      console.warn('[WhatsAppAI] Failed to fetch property context:', err.message);
    }
  } else {
    contextSource = options.contextSource || 'provided';
  }

  // ── AI Provider Chain ──────────────────────────────────────────────────────

  // [1] Try ChatGPT
  try {
    const reply = await generateChatGPTWhatsappReply(session, [], message, propertyCtx);
    return { reply, provider: 'chatgpt', contextSource };
  } catch (err) {
    console.warn('[WhatsAppAI] ChatGPT failed:', err.message);
  }

  // [2] Try Claude
  try {
    const reply = await generateClaudeWhatsappReply(session, [], message, propertyCtx);
    return { reply, provider: 'claude', contextSource };
  } catch (err) {
    console.warn('[WhatsAppAI] Claude failed:', err.message);
  }

  // [3] Fallback to Private Agent (always succeeds)
  try {
    const result = generatePrivateWhatsappReply({
      name:       session.name || 'Customer',
      phone:      session.phone,
      message,
      agentName:  agentName || 'Property Consultant',
    });
    return { reply: result.reply, provider: 'private_agent', contextSource };
  } catch (err) {
    console.error('[WhatsAppAI] All providers failed:', err.message);
    // Last resort: generic fallback
    return {
      reply: `Halo ${session.name || 'teman'}! 👋\n\nTerima kasih atas pertanyaan Anda. Tim kami sedang memproses informasi properti yang sesuai untuk Anda. Harap tunggu sebentar.\n\nSalam,\nElevan Property`,
      provider: 'fallback_generic',
      contextSource: 'none',
    };
  }
}

/**
 * Check apakah pesan adalah property query + fetch context.
 * Jika property query, return context untuk AI injection.
 * Jika bukan, return null.
 *
 * @param {string} message - Customer message
 * @returns {Promise<{ isPropertyQuery, context, contextSource, location, propertyType, transactionType } | null>}
 */
async function analyzePropertyMessage(message) {
  const { hasPropertyKeyword } = require('../utils/propertyKeywordFilter');

  // Check keyword filter
  if (!hasPropertyKeyword(message)) {
    return null; // Not a property query
  }

  // Fetch property context
  try {
    const result = await getWhatsappPropertyContext(message);
    return {
      isPropertyQuery: true,
      context: result.contextText,
      contextSource: result.source,
      location: result.location,
      propertyType: result.propertyType,
      transactionType: result.transactionType,
    };
  } catch (err) {
    console.warn('[WhatsAppAI] Property analysis failed:', err.message);
    // Return empty context but still mark as property query
    return {
      isPropertyQuery: true,
      context: '',
      contextSource: 'error',
      location: null,
      propertyType: null,
      transactionType: null,
    };
  }
}

/**
 * Format response untuk WhatsApp dengan metadata.
 * Digunakan untuk logging dan DB storage.
 *
 * @param {object} params
 *   @param {string} reply - AI response text
 *   @param {string} provider - AI provider name
 *   @param {string} contextSource - Context source (rumah123/flat_json/none)
 *   @param {string} agentName - WhatsApp agent name
 *   @param {string} customerPhone - Customer phone number
 * @returns {object} { text, metadata }
 */
function formatWhatsAppResponse(params) {
  const { reply, provider, contextSource, agentName, customerPhone } = params;

  return {
    text: reply,
    metadata: {
      aiProvider: provider,
      contextSource,
      agentName,
      timestamp: new Date().toISOString(),
      channel: 'whatsapp',
    },
  };
}

module.exports = {
  generateWhatsAppAIReply,
  analyzePropertyMessage,
  formatWhatsAppResponse,
};

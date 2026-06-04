/**
 * whatsappAIService.js
 *
 * Unified AI response service untuk semua WhatsApp controllers (Fonnte, WATI, 360dialog).
 *
 * Menghubungkan WhatsApp controllers dengan AI logic yang SAMA dengan chatbot:
 *   1. ChatGPT (primary)
 *   2. Claude (secondary fallback)
 *   3. Private Agent dengan property recommendations dari katalog/Rumah123 (tertiary fallback)
 *
 * PERBAIKAN:
 *   - Bug: Import generateChatGPTWhatsappReply dari aiProviderService → undefined
 *   - Fix: Gunakan generateWhatsappReplyWithProviderFallback (fungsi yang benar)
 *   - Bug: Private Agent fallback hanya template generic, tidak ada property data
 *   - Fix: Private Agent fallback menggunakan ChatbotPrivateService.generateResponse()
 *          yang sama dengan chatbot web (fetch Rumah123 + katalog JSON)
 */

'use strict';

// ── AI provider chain (ChatGPT → Claude dengan fallback otomatis) ──────────────
// BENAR: generateWhatsappReplyWithProviderFallback diekspor dari aiProviderService
// SALAH: generateChatGPTWhatsappReply & generateClaudeWhatsappReply TIDAK diekspor
const { generateWhatsappReplyWithProviderFallback } = require('./aiProviderService');

// ── Property context untuk WhatsApp ──────────────────────────────────────────
const { getWhatsappPropertyContext }                = require('../utils/whatsappPropertyContext');

// ── Untuk Private Agent fallback: sama dengan chatbot ─────────────────────────
const { buildRecommendationContextForLLM }         = require('./propertyRecommendationService');
const { getConversationHistory }                    = require('./sessionService');

/**
 * Generate AI reply untuk WhatsApp message dengan full provider chain.
 *
 * Chain: ChatGPT → Claude → Private Agent (dengan property data lengkap)
 *
 * Digunakan oleh: fonnteChatController, watiChatController, dialogChatController
 *
 * @param {object} params
 *   @param {object} session   - ChatSession object (id, name, phone, location, ...)
 *   @param {string} message   - Customer's message text
 *   @param {string} agentName - Name of WhatsApp agent
 *   @param {object} options   - Optional: { context, contextSource }
 * @returns {Promise<{ reply, provider, contextSource }>}
 */
async function generateWhatsAppAIReply(params) {
  const { session, message, agentName, options = {} } = params;

  // ── Step 1: Fetch property context ─────────────────────────────────────────
  let propertyCtx  = options.context || '';
  let contextSource = 'none';

  if (!propertyCtx) {
    try {
      const ctxResult  = await getWhatsappPropertyContext(message);
      propertyCtx      = ctxResult.contextText || '';
      contextSource    = ctxResult.source       || 'none';
    } catch (err) {
      console.warn('[WhatsAppAI] Context fetch failed:', err.message);
    }
  } else {
    contextSource = options.contextSource || 'provided';
  }

  // ── Step 2: Get conversation history (sama dengan chatbot) ─────────────────
  let history = [];
  try {
    history = await getConversationHistory(session.id, 10);
  } catch (err) {
    console.warn('[WhatsAppAI] History fetch failed:', err.message);
  }

  // ── Step 3: Try ChatGPT → Claude (unified fallback, defined in aiProviderService) ─
  try {
    const result = await generateWhatsappReplyWithProviderFallback(
      session,
      history,
      message,
      propertyCtx
    );
    return {
      reply:         result.reply,
      provider:      result.provider,
      contextSource,
    };
  } catch (err) {
    console.warn('[WhatsAppAI] ChatGPT + Claude both failed:', err.message);
  }

  // ── Step 4: Fallback to Private Agent dengan PROPERTY DATA LENGKAP ─────────
  // Gunakan generatePrivateTerminalMassege untuk format WhatsApp dengan images & agent name
  try {
    // Lazy require untuk hindari circular dependency
    const { generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');

    // Build recommendation context (same as chatbotController.js)
    const recommendationContext = await buildRecommendationContextForLLM(message, history);

    const result = await generatePrivateTerminalMassege({
      session,
      history,
      userMessage:           message,
      agentName:             agentName,  // Pass agent name untuk footer
      recommendationContext,
      externalError:         new Error('ChatGPT and Claude unavailable for WhatsApp reply'),
    });

    console.log(`[WhatsAppAI] Private Agent (terminal message) used (${result.exactMatches || 0} exact, ` +
                `${result.alternatives || 0} alt, ${result.rumah123Listings || 0} rumah123)`);

    return {
      reply:         result.reply,
      provider:      'private_agent',
      contextSource,
    };
  } catch (err) {
    console.error('[WhatsAppAI] Private Agent also failed:', err.message);

    // ── Last resort: minimal generic reply ────────────────────────────────────
    const name = session?.name || 'Pelanggan';
    const agent = agentName    || process.env.APP_NAME || 'Elevan Property';
    return {
      reply: `Halo *${name}*! 👋\n\nTerima kasih telah menghubungi kami. Tim *${agent}* akan segera membalas pesan Anda dengan informasi properti yang sesuai.\n\nMohon tunggu sebentar 🙏`,
      provider:      'fallback_generic',
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

  if (!hasPropertyKeyword(message)) {
    return null; // Not a property query
  }

  try {
    const result = await getWhatsappPropertyContext(message);
    return {
      isPropertyQuery:  true,
      context:          result.contextText,
      contextSource:    result.source,
      location:         result.location,
      propertyType:     result.propertyType,
      transactionType:  result.transactionType,
    };
  } catch (err) {
    console.warn('[WhatsAppAI] Property analysis failed:', err.message);
    return {
      isPropertyQuery:  true,
      context:          '',
      contextSource:    'error',
      location:         null,
      propertyType:     null,
      transactionType:  null,
    };
  }
}

/**
 * Format response untuk WhatsApp dengan metadata.
 *
 * @param {object} params
 *   @param {string} reply           - AI response text
 *   @param {string} provider        - AI provider name
 *   @param {string} contextSource   - Context source (rumah123/flat_json/none)
 *   @param {string} agentName       - WhatsApp agent name
 *   @param {string} customerPhone   - Customer phone number
 * @returns {{ text, metadata }}
 */
function formatWhatsAppResponse(params) {
  const { reply, provider, contextSource, agentName, customerPhone } = params;
  return {
    text: reply,
    metadata: {
      aiProvider:    provider,
      contextSource,
      agentName,
      timestamp:     new Date().toISOString(),
      channel:       'whatsapp',
    },
  };
}

module.exports = {
  generateWhatsAppAIReply,
  analyzePropertyMessage,
  formatWhatsAppResponse,
};

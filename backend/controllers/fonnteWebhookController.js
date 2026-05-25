const {
  findOrCreateSession,
  getConversationHistory,
  saveUserMessage,
  saveAssistantMessage
} = require('../services/sessionService');
const { generateWhatsappReplyWithProviderFallback } = require('../services/aiProviderService');
const { sendWhatsAppMessage } = require('../services/fonnteService');
const { buildRecommendationContextForLLM } = require('../services/propertyRecommendationService');
const chatbotPrivateController = require('./chatbotPrivateController');

class FonnteWebhookController {
  static #parsePayload(body = {}) {
    const sender  = body.sender || body.from || body.phone || body.target || body.number || '';
    const message = body.message || body.text || body.body || '';
    const name    = body.name || body.pushName || 'WhatsApp Customer';
    return {
      sender:  String(sender).trim(),
      name:    String(name).trim(),
      message: String(message).trim()
    };
  }

  static async handleWebhook(req, res) {
    const incoming = FonnteWebhookController.#parsePayload(req.body);

    if (!incoming.sender || !incoming.message) {
      return res.status(400).json({
        success: false,
        message: 'Webhook payload must include sender and message.'
      });
    }

    let session           = null;
    let history           = [];
    let recommendationContext = null;

    try {
      session = await findOrCreateSession(incoming.name, incoming.sender, 'whatsapp_fonnte');
      await saveUserMessage(session.id, incoming.message, 'whatsapp');

      history               = await getConversationHistory(session.id, 12);
      recommendationContext = await buildRecommendationContextForLLM(incoming.message, history);

      const aiResult = await generateWhatsappReplyWithProviderFallback(
        session,
        history,
        incoming.message,
        recommendationContext.contextText
      );

      const reply = aiResult.reply;

      await saveAssistantMessage(session.id, reply, 'whatsapp', {
        source:           aiResult.provider,
        primaryProvider:  aiResult.primaryProvider,
        fallbackUsed:     aiResult.fallbackUsed,
        fallbackProvider: aiResult.fallbackProvider || null,
        primaryError:     aiResult.primaryError || null,
        exactMatches:     recommendationContext.exactMatches.length,
        alternatives:     recommendationContext.alternatives.length,
        filters:          recommendationContext.filters
      });

      const fonnteResult = await sendWhatsAppMessage(incoming.sender, reply);

      return res.json({
        success:          true,
        message:          'Webhook processed successfully.',
        target:           fonnteResult.target,
        source:           aiResult.provider,
        aiProvider:       aiResult.provider,
        primaryProvider:  aiResult.primaryProvider,
        fallbackUsed:     aiResult.fallbackUsed,
        fallbackProvider: aiResult.fallbackProvider || null
      });

    } catch (error) {
      console.error('[FONNTE WEBHOOK] External AI failed, trying private agent:', error.message);

      const privateEnabled = String(process.env.ENABLE_CHATBOT_PRIVATE_CONTROLLER || 'true').toLowerCase() !== 'false';

      if (privateEnabled && session && history && recommendationContext) {
        try {
          const privateResult = await chatbotPrivateController.generatePrivateChatbotResponse({
            session,
            history,
            userMessage:           incoming.message,
            recommendationContext,
            externalError:         error
          });

          await saveAssistantMessage(session.id, privateResult.reply, 'whatsapp_private', {
            source:           'private_agent',
            fallbackUsed:     true,
            fallbackReason:   error.message
          });

          const fonnteResult = await sendWhatsAppMessage(incoming.sender, privateResult.reply);

          return res.json({
            success:      true,
            message:      'Webhook processed via private agent fallback.',
            target:       fonnteResult.target,
            source:       'private_agent',
            aiProvider:   'private_agent',
            fallbackUsed: true,
            fallbackReason: error.message
          });

        } catch (privateError) {
          console.error('[FONNTE WEBHOOK] Private agent fallback also failed:', privateError.message);
          return res.status(502).json({
            success:             false,
            message:             'All AI providers failed to process webhook.',
            externalProviderError: error.message,
            privateFallbackError:  privateError.message
          });
        }
      }

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to process Fonnte webhook through AI provider.'
      });
    }
  }
}

module.exports = FonnteWebhookController;

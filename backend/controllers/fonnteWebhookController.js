const { findOrCreateSession, getConversationHistory, saveUserMessage, saveAssistantMessage } = require('../services/sessionService');
const { generateWhatsappReply } = require('../services/openaiService');
const { sendWhatsAppMessage } = require('../services/fonnteService');
const { formatPropertyRecommendation, searchProperties } = require('../services/propertyRecommendationService');

function readIncomingPayload(body = {}) {
  const sender = body.sender || body.from || body.phone || body.target || body.number || '';
  const message = body.message || body.text || body.body || '';
  const name = body.name || body.pushName || 'WhatsApp Customer';
  return {
    sender: String(sender).trim(),
    name: String(name).trim(),
    message: String(message).trim()
  };
}

exports.handleWebhook = async (req, res) => {
  const incoming = readIncomingPayload(req.body);

  if (!incoming.sender || !incoming.message) {
    return res.status(400).json({ success: false, message: 'Webhook payload must include sender and message.' });
  }

  try {
    const session = await findOrCreateSession(incoming.name, incoming.sender, 'whatsapp_fonnte');
    await saveUserMessage(session.id, incoming.message, 'whatsapp');
    const history = await getConversationHistory(session.id, 12);
    const propertyContext = formatPropertyRecommendation(await searchProperties({}));
    const reply = await generateWhatsappReply(session, history, incoming.message, propertyContext);
    await saveAssistantMessage(session.id, reply, 'whatsapp');
    const fonnteResult = await sendWhatsAppMessage(incoming.sender, reply);

    return res.json({
      success: true,
      message: 'Webhook processed successfully.',
      target: fonnteResult.target
    });
  } catch (error) {
    console.error('Fonnte webhook processing failed:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process Fonnte webhook.'
    });
  }
};

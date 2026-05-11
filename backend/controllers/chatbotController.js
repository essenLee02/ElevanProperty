const { validateChatbotMessage } = require('../services/validationService');
const { findOrCreateSession, getConversationHistory, saveUserMessage, saveAssistantMessage } = require('../services/sessionService');
const { generateChatbotReply } = require('../services/openaiService');
const { formatPropertyRecommendation, searchProperties } = require('../services/propertyRecommendationService');

const PROPERTY_KEYWORDS = [
  'property', 'properti', 'rumah', 'house', 'villa', 'hotel', 'apartemen', 'apartment',
  'kos', 'boarding', 'kontrakan', 'sewa', 'rent', 'rental', 'jual', 'sell', 'beli', 'buy',
  'tanah', 'land', 'bangunan', 'building', 'kamar', 'bedroom', 'bathroom', 'malang', 'surabaya',
  'madiun', 'jakarta', 'bandung', 'semarang', 'yogyakarta', 'jawa'
];

function isProbablyPropertyRelated(message) {
  const text = String(message || '').toLowerCase();
  return PROPERTY_KEYWORDS.some((keyword) => text.includes(keyword));
}

function detectIndonesian(message) {
  const text = String(message || '').toLowerCase();
  const indonesianWords = ['saya', 'mau', 'ingin', 'cari', 'sewa', 'beli', 'jual', 'rumah', 'berapa', 'harga', 'dimana', 'yang', 'di', 'ada'];
  return indonesianWords.some((word) => new RegExp(`\\b${word}\\b`).test(text));
}

function buildLocalFallbackReply(message, reason = '') {
  const isIndonesian = detectIndonesian(message);

  if (!isProbablyPropertyRelated(message)) {
    return isIndonesian
      ? 'Maaf, saya khusus membantu kebutuhan jual, beli, dan sewa properti seperti rumah, villa, hotel, apartemen, dan boarding house. Boleh saya bantu carikan properti sesuai lokasi dan budget Anda?'
      : 'Sorry, I specifically help with buying, selling, and renting properties such as houses, villas, hotels, apartments, and boarding houses. May I help you find a property based on your preferred location and budget?';
  }

  return isIndonesian
    ? 'Baik, saya bisa bantu kebutuhan properti Anda. Agar rekomendasinya lebih tepat, mohon informasikan: ingin beli, jual, atau sewa; tipe properti; lokasi; budget; jumlah kamar; dan fasilitas yang dibutuhkan.'
    : 'Sure, I can help with your property needs. To recommend better options, please share whether you want to buy, sell, or rent; property type; location; budget; number of bedrooms; and required facilities.';
}

exports.sendMessage = async (req, res) => {
  const payload = {
    name: String(req.body.name || '').trim(),
    phone: String(req.body.phone || '').trim(),
    message: String(req.body.message || '').trim()
  };

  const validation = validateChatbotMessage(payload);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  try {
    const session = await findOrCreateSession(payload.name, payload.phone, 'website_chatbot');
    await saveUserMessage(session.id, payload.message, 'website_chatbot');

    if (!isProbablyPropertyRelated(payload.message)) {
      const localReply = buildLocalFallbackReply(payload.message, 'out_of_scope');
      await saveAssistantMessage(session.id, localReply, 'website_chatbot', { fallback: true, reason: 'out_of_scope' });
      return res.json({
        success: true,
        reply: localReply,
        sessionId: session.id,
        usedFallback: true,
        fallbackReason: 'out_of_scope'
      });
    }

    const history = await getConversationHistory(session.id, 12);
    const propertyContext = formatPropertyRecommendation(await searchProperties({}));

    try {
      const reply = await generateChatbotReply(session, history, payload.message, propertyContext);
      await saveAssistantMessage(session.id, reply, 'website_chatbot');
      return res.json({ success: true, reply, sessionId: session.id, usedFallback: false });
    } catch (openAIError) {
      const localReply = buildLocalFallbackReply(payload.message, openAIError.message);
      await saveAssistantMessage(session.id, localReply, 'website_chatbot', {
        fallback: true,
        reason: 'openai_failed',
        error: openAIError.message
      });

      console.warn('Chatbot OpenAI failed. Local fallback used:', openAIError.message);
      return res.json({
        success: true,
        reply: localReply,
        sessionId: session.id,
        usedFallback: true,
        fallbackReason: 'openai_failed'
      });
    }
  } catch (error) {
    console.error('Chatbot message failed:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Chatbot failed to generate a reply.'
    });
  }
};

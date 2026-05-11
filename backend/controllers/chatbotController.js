const { validateChatbotMessage } = require('../services/validationService');
const {
  findOrCreateSession,
  getConversationHistory,
  saveUserMessage,
  saveAssistantMessage
} = require('../services/sessionService');
const { generateChatbotReply } = require('../services/openaiService');
const { buildRecommendationContextForLLM } = require('../services/propertyRecommendationService');

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

    const history = await getConversationHistory(session.id, 12);
    const recommendationContext = await buildRecommendationContextForLLM(payload.message, history);

    // IMPORTANT: every chatbot message must go to OpenAI.
    // No local catalog fallback is returned as final answer, so the OpenAI dashboard logs will show each chatbot request.
    const reply = await generateChatbotReply(
      session,
      history,
      payload.message,
      recommendationContext.contextText
    );

    await saveAssistantMessage(session.id, reply, 'website_chatbot', {
      source: 'openai',
      exactMatches: recommendationContext.exactMatches.length,
      alternatives: recommendationContext.alternatives.length,
      filters: recommendationContext.filters
    });

    return res.json({
      success: true,
      reply,
      sessionId: session.id,
      source: 'openai',
      openAIStore: true,
      exactMatches: recommendationContext.exactMatches.length,
      alternatives: recommendationContext.alternatives.length
    });
  } catch (error) {
    console.error('Chatbot message failed:', error);
    return res.status(502).json({
      success: false,
      message: error.message || 'OpenAI failed to generate chatbot reply.',
      source: 'openai',
      note: 'No local fallback was used because chatbot replies must come from ChatGPT.'
    });
  }
};

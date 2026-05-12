const { validateChatbotMessage } = require('../services/validationService');
const {
  findOrCreateSession,
  getConversationHistory,
  saveUserMessage,
  saveAssistantMessage
} = require('../services/sessionService');
const { generateChatbotReply } = require('../services/openaiService');
const { buildRecommendationContextForLLM } = require('../services/propertyRecommendationService');

/**
 * Format the property context payload from the frontend (first-chat JSON data)
 * into a readable text block that can be appended to the LLM prompt.
 */
function formatFrontendPropertyContext(propertyContext) {
  if (!propertyContext || !Array.isArray(propertyContext.properties) || !propertyContext.properties.length) {
    return '';
  }

  const lines = [
    `PROPERTY CATALOG CONTEXT (sent by frontend from indonesia_property_36_provinces_flat.json):`,
    `Source file: ${propertyContext.sourceFile || 'frontend/public/json_data/indonesia_property_36_provinces_flat.json'}`,
    `Total records in dataset: ${propertyContext.totalRecords || 'unknown'}`,
    `Context records provided: ${propertyContext.sampleSize || propertyContext.properties.length} properties`,
    `Selection strategy: ${propertyContext.selectionStrategy || 'not specified'}`,
    ''
  ];

  propertyContext.properties.forEach((p, index) => {
    lines.push(
      `${index + 1}. [${p.id}] ${p.title}` +
      ` | Type: ${p.building_type} | Transaction: ${p.transaction_type}` +
      ` | Price: ${p.price}` +
      ` | Location: ${[p.city, p.province].filter(Boolean).join(', ')}` +
      (p.area ? ` (${p.area})` : '') +
      ` | Area: building ${p.building_area}, land ${p.land_area}` +
      (p.facilities ? ` | Facilities: ${p.facilities}` : '')
    );
  });

  return lines.join('\n');
}

exports.sendMessage = async (req, res) => {
  const payload = {
    name: String(req.body.name || '').trim(),
    phone: String(req.body.phone || '').trim(),
    message: String(req.body.message || '').trim()
  };

  // Optional: property context JSON sent from the frontend on the first chat message.
  const frontendPropertyContext = req.body.propertyContext || null;

  const validation = validateChatbotMessage(payload);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  try {
    const session = await findOrCreateSession(payload.name, payload.phone, 'website_chatbot');
    await saveUserMessage(session.id, payload.message, 'website_chatbot');

    const history = await getConversationHistory(session.id, 12);

    // Build recommendation context from backend property catalog.
    const recommendationContext = await buildRecommendationContextForLLM(payload.message, history);

    // If the frontend sent property context (first message), append it to the LLM context.
    let combinedContextText = recommendationContext.contextText;
    if (frontendPropertyContext) {
      const frontendBlock = formatFrontendPropertyContext(frontendPropertyContext);
      if (frontendBlock) {
        combinedContextText = [
          combinedContextText,
          '',
          frontendBlock
        ].join('\n');
      }
    }

    // IMPORTANT: every chatbot message must go to OpenAI.
    // No local catalog fallback is returned as final answer.
    const reply = await generateChatbotReply(
      session,
      history,
      payload.message,
      combinedContextText
    );

    await saveAssistantMessage(session.id, reply, 'website_chatbot', {
      source: 'openai',
      exactMatches: recommendationContext.exactMatches.length,
      alternatives: recommendationContext.alternatives.length,
      filters: recommendationContext.filters,
      frontendContextReceived: Boolean(frontendPropertyContext)
    });

    return res.json({
      success: true,
      reply,
      sessionId: session.id,
      source: 'openai',
      openAIStore: true,
      exactMatches: recommendationContext.exactMatches.length,
      alternatives: recommendationContext.alternatives.length,
      frontendContextReceived: Boolean(frontendPropertyContext)
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

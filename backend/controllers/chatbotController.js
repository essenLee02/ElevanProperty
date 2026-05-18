const { validateChatbotMessage } = require('../services/validationService');
const {
  findOrCreateSession,
  getConversationHistory,
  saveUserMessage,
  saveAssistantMessage
} = require('../services/sessionService');
const {
  generateChatbotReplyWithProviderFallback,
  checkAIProviderConfig
} = require('../services/aiProviderService');
const { buildRecommendationContextForLLM } = require('../services/propertyRecommendationService');
const chatbotPrivateController = require('./chatbotPrivateController');
const { getSkillRegistryStatus } = require('../services/skillPromptService');

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
    `Customer location provided from chatbot profile: ${propertyContext.userLocation || 'not provided'}`,
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


function getChatbotCookieTtlMinutes() {
  const value = Number(process.env.CHATBOT_COOKIE_TTL_MINUTES || 20);
  if (!Number.isFinite(value) || value <= 0) return 20;
  return Math.min(Math.max(Math.round(value), 1), 1440);
}

exports.getConfig = (_req, res) => {
  const cookieTtlMinutes = getChatbotCookieTtlMinutes();
  return res.json({
    success: true,
    cookieTtlMinutes,
    cookieTtlSeconds: cookieTtlMinutes * 60,
    requiredProfileFields: ['name', 'phone', 'location']
  });
};

exports.aiProviderStatus = (_req, res) => {
  const config = checkAIProviderConfig();
  const ready =
    (config.primaryProvider === 'chatgpt' && config.chatGPT.hasApiKey && config.chatGPT.keyLooksValid) ||
    (config.primaryProvider === 'claude' && config.claude.hasApiKey && config.claude.keyLooksValid) ||
    config.claudeFallbackReady ||
    String(process.env.ENABLE_CHATBOT_PRIVATE_CONTROLLER || 'true').toLowerCase() !== 'false';

  return res.status(ready ? 200 : 500).json({
    success: ready,
    ...config,
    skillRegistry: getSkillRegistryStatus(),
    privateController: {
      enabled: String(process.env.ENABLE_CHATBOT_PRIVATE_CONTROLLER || 'true').toLowerCase() !== 'false',
      name: 'chatbotPrivateController',
      statusRoute: '/api/chatbot/private-status',
      directTestRoute: '/api/chatbot/private-message'
    },
    message: ready
      ? 'AI provider configuration is ready. If ChatGPT and Claude fail, chatbotPrivateController can respond as local private agent.'
      : 'AI provider configuration is not ready. Check OPENAI_API_KEY, ANTHROPIC_API_KEY, or ENABLE_CHATBOT_PRIVATE_CONTROLLER in backend/.env.'
  });
};


exports.skillStatus = (_req, res) => {
  const registry = getSkillRegistryStatus();

  const chatGPTReady = registry.groups.chat_gpt_responds.exists && registry.groups.chat_gpt_responds.markdownFileCount > 0;
  const claudeReady = registry.groups.claude_responds.exists && registry.groups.claude_responds.markdownFileCount > 0;

  return res.status(chatGPTReady && claudeReady ? 200 : 500).json({
    success: chatGPTReady && claudeReady,
    message: chatGPTReady && claudeReady
      ? 'Registered response skills are loaded successfully.'
      : 'One or more response skill folders are missing. Check skills/chat_gpt_responds and skills/claude_responds.',
    registry
  });
};

exports.sendMessage = async (req, res) => {
  const payload = {
    name: String(req.body.name || '').trim(),
    phone: String(req.body.phone || '').trim(),
    location: String(req.body.location || '').trim(),
    message: String(req.body.message || '').trim()
  };

  // Optional: property context JSON sent from the frontend on the first chat message.
  const frontendPropertyContext = req.body.propertyContext || null;

  const validation = validateChatbotMessage(payload);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  let session = null;
  let history = [];
  let recommendationContext = null;

  try {
    session = await findOrCreateSession(payload.name, payload.phone, payload.location, 'website_chatbot');
    await saveUserMessage(session.id, payload.message, 'website_chatbot', { location: payload.location });

    history = await getConversationHistory(session.id, 12);

    // Build recommendation context from backend property catalog.
    recommendationContext = await buildRecommendationContextForLLM(payload.message, history);

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

    // IMPORTANT: every chatbot message must be generated by an AI provider.
    // Primary provider is ChatGPT. If ChatGPT has quota/billing/rate-limit issue,
    // backend automatically falls back to Claude when ENABLE_CLAUDE_FALLBACK=true.
    const aiResult = await generateChatbotReplyWithProviderFallback(
      session,
      history,
      payload.message,
      combinedContextText
    );

    const reply = aiResult.reply;

    await saveAssistantMessage(session.id, reply, 'website_chatbot', {
      source: aiResult.provider,
      primaryProvider: aiResult.primaryProvider,
      fallbackUsed: aiResult.fallbackUsed,
      fallbackProvider: aiResult.fallbackProvider || null,
      primaryError: aiResult.primaryError || null,
      exactMatches: recommendationContext.exactMatches.length,
      alternatives: recommendationContext.alternatives.length,
      filters: recommendationContext.filters,
      frontendContextReceived: Boolean(frontendPropertyContext)
    });

    return res.json({
      success: true,
      reply,
      sessionId: session.id,
      source: aiResult.provider,
      aiProvider: aiResult.provider,
      primaryProvider: aiResult.primaryProvider,
      fallbackUsed: aiResult.fallbackUsed,
      fallbackProvider: aiResult.fallbackProvider || null,
      primaryError: aiResult.primaryError || null,
      exactMatches: recommendationContext.exactMatches.length,
      alternatives: recommendationContext.alternatives.length,
      frontendContextReceived: Boolean(frontendPropertyContext)
    });
  } catch (error) {
    console.error('[CHATBOT EXTERNAL AI FAILED]', {
      message: error.message,
      provider: error.provider || 'ai_provider_router',
      providerErrors: error.providerErrors || null,
      stack: error.stack
    });

    const privateControllerEnabled = String(process.env.ENABLE_CHATBOT_PRIVATE_CONTROLLER || 'true').toLowerCase() !== 'false';

    if (privateControllerEnabled && session && history && recommendationContext) {
      try {
        const privateResult = await chatbotPrivateController.generatePrivateChatbotResponse({
          session,
          history,
          userMessage: payload.message,
          recommendationContext,
          externalError: error
        });

        await saveAssistantMessage(session.id, privateResult.reply, 'website_chatbot_private', {
          source: 'private_agent',
          controller: 'chatbotPrivateController',
          fallbackUsed: true,
          fallbackReason: error.message,
          externalProviderErrors: error.providerErrors || null,
          exactMatches: privateResult.exactMatches,
          alternatives: privateResult.alternatives,
          filters: privateResult.filters,
          frontendContextReceived: Boolean(frontendPropertyContext)
        });

        return res.json({
          success: true,
          reply: privateResult.reply,
          sessionId: session.id,
          source: 'private_agent',
          aiProvider: 'private_agent',
          controller: 'chatbotPrivateController',
          fallbackUsed: true,
          fallbackReason: error.message,
          externalProviderErrors: error.providerErrors || null,
          exactMatches: privateResult.exactMatches,
          alternatives: privateResult.alternatives,
          frontendContextReceived: Boolean(frontendPropertyContext)
        });
      } catch (privateError) {
        console.error('[CHATBOT PRIVATE CONTROLLER FAILED]', {
          message: privateError.message,
          stack: privateError.stack
        });

        return res.status(502).json({
          success: false,
          message: privateError.message || 'ChatGPT, Claude, and chatbotPrivateController failed.',
          source: 'private_agent',
          controller: 'chatbotPrivateController',
          externalProviderError: error.message
        });
      }
    }

    return res.status(502).json({
      success: false,
      message: error.message || 'AI provider failed to generate chatbot reply.',
      source: error.provider || 'ai_provider_router',
      note: 'Chatbot replies must come from ChatGPT or Claude. chatbotPrivateController was disabled or unavailable.'
    });
  }
};

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
const {
  getRumah123Listings,
  formatRumah123ContextForLLM,
  mapBuildingTypeToApify,
  mapTransactionTypeToApify,
} = require('../services/rumah123ContextService');
const chatbotPrivateController = require('./chatbotPrivateController');
const { getSkillRegistryStatus } = require('../services/skillPromptService');

class ChatbotController {
  static #cookieTtlMinutes() {
    const value = Number(process.env.CHATBOT_COOKIE_TTL_MINUTES || 20);
    if (!Number.isFinite(value) || value <= 0) return 20;
    return Math.min(Math.max(Math.round(value), 1), 1440);
  }

  static #formatPropertyContext(propertyContext) {
    if (!propertyContext || !Array.isArray(propertyContext.properties) || !propertyContext.properties.length) {
      return '';
    }

    const lines = [
      `PROPERTY CATALOG CONTEXT (from indonesia_property_36_provinces_flat.json):`,
      `Source file: ${propertyContext.sourceFile || 'backend/asset/json_data/indonesia_property_36_provinces_flat.json'}`,
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

  static #isPrivateControllerEnabled() {
    return String(process.env.ENABLE_CHATBOT_PRIVATE_CONTROLLER || 'true').toLowerCase() !== 'false';
  }

  static getConfig(_req, res) {
    const ttl = ChatbotController.#cookieTtlMinutes();
    return res.json({
      success: true,
      cookieTtlMinutes: ttl,
      cookieTtlSeconds: ttl * 60,
      requiredProfileFields: ['name', 'phone', 'location']
    });
  }

  static aiProviderStatus(_req, res) {
    const config = checkAIProviderConfig();
    const ready =
      (config.primaryProvider === 'chatgpt' && config.chatGPT.hasApiKey && config.chatGPT.keyLooksValid) ||
      (config.primaryProvider === 'claude' && config.claude.hasApiKey && config.claude.keyLooksValid) ||
      config.claudeFallbackReady ||
      ChatbotController.#isPrivateControllerEnabled();

    return res.status(ready ? 200 : 500).json({
      success: ready,
      ...config,
      skillRegistry: getSkillRegistryStatus(),
      privateController: {
        enabled: ChatbotController.#isPrivateControllerEnabled(),
        name: 'chatbotPrivateController',
        statusRoute: '/api/chatbot/private-status',
        directTestRoute: '/api/chatbot/private-message'
      },
      message: ready
        ? 'AI provider configuration is ready. If ChatGPT and Claude fail, chatbotPrivateController can respond as local private agent.'
        : 'AI provider configuration is not ready. Check OPENAI_API_KEY, ANTHROPIC_API_KEY, or ENABLE_CHATBOT_PRIVATE_CONTROLLER in backend/.env.'
    });
  }

  static skillStatus(_req, res) {
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
  }

  static async sendMessage(req, res) {
    const payload = {
      name:     String(req.body.name     || '').trim(),
      phone:    String(req.body.phone    || '').trim(),
      location: String(req.body.location || '').trim(),
      message:  String(req.body.message  || '').trim()
    };

    const frontendPropertyContext = req.body.propertyContext || null;

    const validation = validateChatbotMessage(payload);
    if (!validation.valid) {
      return res.status(process.env.HTTP_BAD_REQUEST).json({ success: false, message: validation.message });
    }

    let session = null;
    let history = [];
    let recommendationContext = null;

    try {
      session = await findOrCreateSession(payload.name, payload.phone, payload.location, 'website_chatbot');
      await saveUserMessage(session.id, payload.message, 'website_chatbot', { location: payload.location });

      history = await getConversationHistory(session.id, 12);
      recommendationContext = await buildRecommendationContextForLLM(payload.message, history);

      let rumah123Block = '';
      try {
        const filters = recommendationContext.filters;
        const apifyPropertyType = mapBuildingTypeToApify(filters.buildingType);
        const apifyListingType  = mapTransactionTypeToApify(filters.transactionType);
        const location = filters.location || payload.location || '';

        if (location || apifyPropertyType) {
          const rumah123Listings = await getRumah123Listings({
            location,
            propertyType: apifyPropertyType,
            listingType:  apifyListingType,
          });

          if (rumah123Listings.length > 0) {
            rumah123Block = formatRumah123ContextForLLM(rumah123Listings);
            console.log(`[Chatbot] Injected ${rumah123Listings.length} Rumah123 listings into context.`);
          }
        }
      } catch (rumah123Err) {
        console.warn('[Chatbot] Rumah123 context fetch failed (non-fatal):', rumah123Err.message);
      }

      let combinedContextText = recommendationContext.contextText;

      if (rumah123Block) {
        combinedContextText = [combinedContextText, '', rumah123Block].join('\n');
      }

      if (frontendPropertyContext) {
        const frontendBlock = ChatbotController.#formatPropertyContext(frontendPropertyContext);
        if (frontendBlock) {
          combinedContextText = [combinedContextText, '', frontendBlock].join('\n');
        }
      }

      const aiResult = await generateChatbotReplyWithProviderFallback(
        session, history, payload.message, combinedContextText
      );

      const reply = aiResult.reply;

      await saveAssistantMessage(session.id, reply, 'website_chatbot', {
        source:                  aiResult.provider,
        primaryProvider:         aiResult.primaryProvider,
        fallbackUsed:            aiResult.fallbackUsed,
        fallbackProvider:        aiResult.fallbackProvider || null,
        primaryError:            aiResult.primaryError || null,
        exactMatches:            recommendationContext.exactMatches.length,
        alternatives:            recommendationContext.alternatives.length,
        filters:                 recommendationContext.filters,
        frontendContextReceived: Boolean(frontendPropertyContext)
      });

      return res.json({
        success:                 true,
        reply,
        sessionId:               session.id,
        source:                  aiResult.provider,
        aiProvider:              aiResult.provider,
        primaryProvider:         aiResult.primaryProvider,
        fallbackUsed:            aiResult.fallbackUsed,
        fallbackProvider:        aiResult.fallbackProvider || null,
        primaryError:            aiResult.primaryError || null,
        exactMatches:            recommendationContext.exactMatches.length,
        alternatives:            recommendationContext.alternatives.length,
        frontendContextReceived: Boolean(frontendPropertyContext)
      });

    } catch (error) {
      console.error('[CHATBOT EXTERNAL AI FAILED]', {
        message:        error.message,
        provider:       error.provider || 'ai_provider_router',
        providerErrors: error.providerErrors || null,
        stack:          error.stack
      });

      if (ChatbotController.#isPrivateControllerEnabled() && session && history && recommendationContext) {
        try {
          const privateResult = await chatbotPrivateController.generatePrivateChatbotResponse({
            session,
            history,
            userMessage:           payload.message,
            recommendationContext,
            externalError:         error
          });

          await saveAssistantMessage(session.id, privateResult.reply, 'website_chatbot_private', {
            source:                  'private_agent',
            controller:              'chatbotPrivateController',
            fallbackUsed:            true,
            fallbackReason:          error.message,
            externalProviderErrors:  error.providerErrors || null,
            exactMatches:            privateResult.exactMatches,
            alternatives:            privateResult.alternatives,
            filters:                 privateResult.filters,
            frontendContextReceived: Boolean(frontendPropertyContext)
          });

          return res.json({
            success:               true,
            reply:                 privateResult.reply,
            sessionId:             session.id,
            source:                'private_agent',
            aiProvider:            'private_agent',
            controller:            'chatbotPrivateController',
            fallbackUsed:          true,
            fallbackReason:        error.message,
            externalProviderErrors: error.providerErrors || null,
            exactMatches:          privateResult.exactMatches,
            alternatives:          privateResult.alternatives,
            frontendContextReceived: Boolean(frontendPropertyContext)
          });

        } catch (privateError) {
          console.error('[CHATBOT PRIVATE CONTROLLER FAILED]', {
            message: privateError.message,
            stack:   privateError.stack
          });

          return res.status(process.env.HTTP_BAD_GATEWAY).json({
            success:             false,
            message:             privateError.message || 'ChatGPT, Claude, and chatbotPrivateController failed.',
            source:              'private_agent',
            controller:          'chatbotPrivateController',
            externalProviderError: error.message
          });
        }
      }

      return res.status(process.env.HTTP_BAD_GATEWAY).json({
        success:  false,
        message:  error.message || 'AI provider failed to generate chatbot reply.',
        source:   error.provider || 'ai_provider_router',
        note:     'Chatbot replies must come from ChatGPT or Claude. chatbotPrivateController was disabled or unavailable.'
      });
    }
  }
}

module.exports = ChatbotController;

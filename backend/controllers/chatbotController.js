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
  isRumah123EnabledForAI,
} = require('../services/rumah123ContextService');
const chatbotPrivateController = require('./chatbotPrivateController');
const { getSkillRegistryStatus } = require('../services/skillPromptService');
const { hasPropertyKeyword } = require('../utils/propertyKeywordFilter');
const {
  extractQualificationState,
  listMissingMandatory,
} = require('../services/aiPromptBuilderService');

// Matches all assistant/bot roles stored in chat history
const QS_AI_ROLE = /^(assistant|ai|bot)$/i;

// Jendela history untuk ekstraksi state kualifikasi — NILAI SAMA dengan
// whatsappAIService (AI_HISTORY_WINDOW, default 60). Disamakan supaya chatbot
// web dan terminal message berperilaku identik; lihat catatan di sendMessage().
const CHAT_HISTORY_WINDOW = (() => {
  const n = parseInt(process.env.AI_HISTORY_WINDOW || '', 10);
  return Number.isFinite(n) && n >= 24 ? n : 60;
})();

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
      `PROPERTY CATALOG CONTEXT (from backend database / indonesia_property_extended_v3.json):`,
      `Source file: ${propertyContext.sourceFile || 'backend database (indonesia_property_extended_v3.json)'}`,
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
        : 'AI provider configuration is not ready. Check CHAT_GPT_API_KEY, ANTHROPIC_API_KEY, or ENABLE_CHATBOT_PRIVATE_CONTROLLER in backend/.env.'
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

      // ⚠️ JENDELA HISTORY — harus sama besar dengan jalur WhatsApp. Dulu 12,
      // dan itu MEMOTONG input perhitungan QUALIFICATION STATE: pada percakapan
      // panjang, pesan pembuka (tipe/transaksi/kota) keluar scope sehingga
      // seluruh field kembali ❓ dan AI menanyakan ulang Q1 tanpa henti (bug
      // M35/M64 di jalur WhatsApp — jangan diulang di sini). Pemangkasan token
      // hanya boleh mengenai transkrip yang DITAMPILKAN, bukan input state;
      // buildWhatsappReplyPrompt() sudah memangkasnya sendiri lewat
      // AI_PROMPT_DISPLAY_TURNS.
      history = await getConversationHistory(session.id, CHAT_HISTORY_WINDOW);

      // ── Q1 Non-Property Gate ──────────────────────────────────────────────
      // If this is the very first message in the session (no prior AI turns)
      // and the message has zero property-related content, do NOT call the AI.
      // Respond with a single redirect and stop — avoid engaging off-topic chats.
      const priorAiTurns = history.filter(m => QS_AI_ROLE.test(m.role)).length;
      if (priorAiTurns === 0 && !hasPropertyKeyword(payload.message)) {
        const deflect = 'Halo! 😊 Saya khusus membantu pencarian properti — rumah, apartemen, villa, kos, ruko, dan lainnya. Silakan ceritakan properti apa yang Anda cari 🏠';
        await saveAssistantMessage(session.id, deflect, 'website_chatbot', { source: 'q1_gate' });
        return res.json({ success: true, reply: deflect, sessionId: session.id, source: 'q1_gate' });
      }

      // ── Katalog HANYA setelah kualifikasi lengkap ─────────────────────────
      // Bug nyata: katalog disuntikkan ke prompt pada SETIAP pesan, sehingga
      // pesan pertama "Saya mau booking rumah" langsung dibalas 8 listing acak
      // lintas provinsi (customer belum menyebut kota sama sekali), lalu "Boleh"
      // dibalas 8 listing yang PERSIS sama. Pelajaran yang sudah berulang di
      // repo ini: apa pun yang ADA di prompt bisa disalin model — melarangnya
      // lewat instruksi tidak cukup, MENGHILANGKANNYA yang menutup celah.
      //
      // Selama masih ada field wajib kosong, katalog tidak dibangun sama sekali:
      // AI hanya punya satu hal yang bisa dilakukan — bertanya. Bonus: menghemat
      // panggilan Apify/Rumah123 dan ribuan token pada tiap giliran tanya-jawab.
      const qualState  = extractQualificationState(history, payload.message);
      const stillMissing = listMissingMandatory(qualState || {});
      const catalogReady = stillMissing.length === 0;

      if (!catalogReady) {
        console.log(`[Chatbot] Kualifikasi belum lengkap (${stillMissing.join(', ')}) — katalog TIDAK disuntikkan.`);
      }

      // ⚠️ Konteks rekomendasi TETAP dibangun walau katalog belum boleh tampil.
      // Private Agent (fallback saat provider eksternal gagal) memakai OBJEK-nya
      // — `alternatives`, `exactMatches`, `filters` — bukan teksnya. Sempat
      // di-stub `{contextText:'',filters:{}}` di sini dan itu langsung membuat
      // Private Agent crash ("Cannot read properties of undefined (reading
      // 'length')"). Yang ditahan adalah TEKS yang masuk prompt LLM, bukan
      // datanya (lihat combinedContextText di bawah).
      recommendationContext = await buildRecommendationContextForLLM(payload.message, history);

      let rumah123Block = '';
      try {
        if (!isRumah123EnabledForAI()) {
          // ⚠️ Jalur ini DULU tidak punya pengecekan sama sekali: RUMAH123_DATA=OFF
          // tetap memanggil Apify dan menyuntikkan listing Rumah123 ke prompt LLM
          // chatbot web. Gerbang yang dikira sudah menutup, ternyata bocor di sini.
          // AI hanya boleh merekomendasikan katalog agent sendiri (Property +
          // PropertyImage + PropertyFacility).
        } else if (!catalogReady) {
          // Belum saatnya menampilkan listing — lewati juga panggilan Apify.
        } else {
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
        }
      } catch (rumah123Err) {
        console.warn('[Chatbot] Rumah123 context fetch failed (non-fatal):', rumah123Err.message);
      }

      // Inilah yang benar-benar masuk ke prompt LLM. Selama kualifikasi belum
      // lengkap teksnya dikosongkan: tidak ada listing di depan model = tidak
      // ada yang bisa dibuang sebelum waktunya.
      let combinedContextText = catalogReady ? recommendationContext.contextText : '';

      if (rumah123Block) {
        combinedContextText = [combinedContextText, '', rumah123Block].join('\n');
      }

      // Katalog kiriman frontend ikut ditahan — sumbernya berbeda, tapi efeknya
      // sama: listing yang hadir di prompt bisa langsung dibuang model.
      if (frontendPropertyContext && catalogReady) {
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
            externalError:         error,
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

const fs = require('fs');
const path = require('path');
const { validateChatbotMessage } = require('../services/validationService');
const {
  findOrCreateSession,
  getConversationHistory,
  saveUserMessage,
  saveAssistantMessage
} = require('../services/sessionService');
const {
  buildRecommendationContextForLLM,
  extractPropertyFilters,
  getVisibleMatchesFromAlternatives
} = require('../services/propertyRecommendationService');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CHAT_GPT_RESPONSE_SKILL_DIR = path.join(PROJECT_ROOT, 'skills', 'chat_gpt_reponds');

function readMarkdownFiles(directoryPath) {
  try {
    if (!fs.existsSync(directoryPath)) return [];

    return fs.readdirSync(directoryPath, { withFileTypes: true })
      .flatMap((entry) => {
        const fullPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) return readMarkdownFiles(fullPath);
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) return [fullPath];
        return [];
      });
  } catch (error) {
    console.error('[PRIVATE CHATBOT CONTROLLER SKILL READ ERROR]', {
      path: directoryPath,
      message: error.message
    });
    return [];
  }
}

function loadPrivateChatbotSkillInfo() {
  const files = readMarkdownFiles(CHAT_GPT_RESPONSE_SKILL_DIR);

  return {
    skillDirectory: CHAT_GPT_RESPONSE_SKILL_DIR,
    skillFileCount: files.length,
    skillFiles: files.map((file) => path.relative(PROJECT_ROOT, file))
  };
}

function normalizeText(value = '') {
  return String(value || '').toLowerCase().trim();
}

function isIndonesianMessage(message = '') {
  const text = normalizeText(message);

  return [
    'saya', 'mau', 'ingin', 'cari', 'sewa', 'beli', 'jual', 'rumah', 'villa',
    'vila', 'apartemen', 'hotel', 'kos', 'kost', 'ruko', 'kantor', 'gudang',
    'harga', 'berapa', 'di ', 'ada', 'tolong', 'rekomendasi', 'saran',
    'fasilitas', 'budget', 'badget'
  ].some((word) => text.includes(word));
}

function getReplyLanguage(message = '') {
  return isIndonesianMessage(message) ? 'id' : 'en';
}

function isOffTopicMessage(message = '') {
  const text = normalizeText(message);

  const propertyWords = [
    'property', 'properti', 'rumah', 'house', 'home', 'villa', 'vila', 'hotel',
    'apartment', 'apartemen', 'kos', 'kost', 'boarding', 'ruko', 'shophouse',
    'office', 'kantor', 'warehouse', 'gudang', 'sewa', 'rent', 'rental',
    'beli', 'buy', 'purchase', 'jual', 'sale', 'sell', 'kontrak', 'kontrakan'
  ];

  const offTopicWords = [
    'kuliner', 'makanan', 'masakan', 'minuman', 'bebek', 'ayam goreng',
    'restaurant', 'restoran', 'cafe', 'kafe', 'kopi', 'cuaca', 'weather',
    'wisata', 'tourism', 'tourist', 'olahraga', 'sports', 'politik',
    'politics', 'pendidikan', 'education', 'sekolah', 'universitas',
    'crypto', 'saham', 'stock', 'film', 'movie', 'musik', 'music'
  ];

  const hasPropertyWord = propertyWords.some((word) => text.includes(word));
  const hasOffTopicWord = offTopicWords.some((word) => text.includes(word));

  return hasOffTopicWord && !hasPropertyWord;
}

function humanBuildingType(type = '', language = 'en') {
  const map = {
    house: language === 'id' ? 'rumah' : 'house',
    apartment: language === 'id' ? 'apartemen' : 'apartment',
    hotel: 'hotel',
    villa: 'villa',
    boarding_house: language === 'id' ? 'kos / boarding house' : 'boarding house',
    shophouse: language === 'id' ? 'ruko / shophouse' : 'shophouse',
    office: language === 'id' ? 'kantor / office' : 'office',
    warehouse: language === 'id' ? 'gudang / warehouse' : 'warehouse',
    others: language === 'id' ? 'properti lainnya' : 'other property'
  };

  return map[type] || type || (language === 'id' ? 'properti' : 'property');
}

function humanTransactionType(type = '', language = 'en') {
  const map = {
    rent: language === 'id' ? 'sewa' : 'rent',
    sale: language === 'id' ? 'jual' : 'sale',
    purchase: language === 'id' ? 'beli' : 'purchase'
  };

  return map[type] || type || (language === 'id' ? 'tersedia' : 'available');
}

function formatLocation(item = {}) {
  return [
    item.location || item.city,
    item.district,
    item.province
  ].filter(Boolean).join(', ') || '-';
}

function formatFacilities(value = '') {
  if (Array.isArray(value)) return value.join(', ');
  return String(value || '-');
}

function formatPropertyList(properties = [], language = 'en', limit = 6) {
  return properties.slice(0, limit).map((item, index) => {
    if (language === 'id') {
      return `${index + 1}. **${item.title || 'Properti'}**
   Lokasi: ${formatLocation(item)}
   Harga: **${item.price || '-'}**
   Tipe: ${humanBuildingType(item.buildingType, language)} - ${humanTransactionType(item.transactionType, language)}
   Area: bangunan ${item.buildingArea || '-'}, tanah ${item.landArea || '-'}
   Alamat: ${item.address || '-'}
   Fasilitas: ${formatFacilities(item.facilities)}`;
    }

    return `${index + 1}. **${item.title || 'Property'}**
   Location: ${formatLocation(item)}
   Price: **${item.price || '-'}**
   Type: ${humanBuildingType(item.buildingType, language)} - ${humanTransactionType(item.transactionType, language)}
   Area: building ${item.buildingArea || '-'}, land ${item.landArea || '-'}
   Address: ${item.address || '-'}
   Facilities: ${formatFacilities(item.facilities)}`;
  }).join('\n\n');
}

function summarizeRequest(filters = {}, language = 'en') {
  const parts = [];

  if (filters.transactionType) parts.push(humanTransactionType(filters.transactionType, language));
  if (filters.buildingType) parts.push(humanBuildingType(filters.buildingType, language));
  if (filters.location) parts.push(filters.location);
  if (filters.budget?.text) parts.push(filters.budget.text);

  if (!parts.length) return language === 'id' ? 'kebutuhan properti Anda' : 'your property request';
  return parts.join(' - ');
}

function buildPrivateOffTopicReply(message = '') {
  const language = getReplyLanguage(message);

  if (language === 'id') {
    return 'Maaf, saya hanya dapat membantu pertanyaan seputar jual, beli, atau sewa properti. Silakan tanyakan kebutuhan properti seperti rumah, villa, hotel, apartemen, kos-kosan, ruko, kantor, atau gudang yang ingin Anda cari.';
  }

  return 'Sorry, I can only help with questions about buying, selling, or renting property. Please ask me about the property type, location, budget, or facilities you are looking for.';
}

function buildPrivateClarificationReply(message = '') {
  const language = getReplyLanguage(message);

  if (language === 'id') {
    return 'Boleh saya pastikan, Anda mencari properti untuk **sewa**, **beli**, atau **jual**? Anda juga bisa sebutkan lokasi dan budget agar saya bisa mencarikan dari katalog properti kami.';
  }

  return 'May I confirm whether you are looking to **rent**, **buy**, or **sell** a property? You can also mention the location and budget so I can search our property catalog.';
}

function buildPrivateExactMatchReply({ message, filters, exactMatches }) {
  const language = getReplyLanguage(message);

  if (language === 'id') {
    return [
      `Baik, berikut pilihan yang sesuai dengan **${summarizeRequest(filters, language)}** dari katalog properti kami:`,
      '',
      formatPropertyList(exactMatches, language, 6),
      '',
      'Apakah Anda ingin saya bantu pilihkan opsi yang paling sesuai?'
    ].join('\n');
  }

  return [
    `Sure, here are matching options for **${summarizeRequest(filters, language)}** from our property catalog:`,
    '',
    formatPropertyList(exactMatches, language, 6),
    '',
    'Would you like me to help choose the most suitable option?'
  ].join('\n');
}

function buildPrivateAlternativeReply({ message, filters, alternatives }) {
  const language = getReplyLanguage(message);

  if (!alternatives.length) {
    return language === 'id'
      ? 'Maaf, saat ini belum ada properti yang sesuai dengan kriteria tersebut di katalog kami. Apakah Anda ingin mencoba lokasi, tipe properti, atau range harga lain?'
      : 'Sorry, there is currently no property matching those criteria in our catalog. Would you like to try another location, property type, or price range?';
  }

  if (language === 'id') {
    return [
      `Maaf, saat ini belum ada exact match untuk **${summarizeRequest(filters, language)}** di katalog kami.`,
      '',
      'Berikut alternatif terdekat yang masih berasal dari katalog properti kami:',
      '',
      formatPropertyList(alternatives, language, 6),
      '',
      'Apakah Anda ingin saya carikan alternatif lokasi atau range harga lain?'
    ].join('\n');
  }

  return [
    `Sorry, there is currently no exact match for **${summarizeRequest(filters, language)}** in our catalog.`,
    '',
    'Here are the closest alternatives from our property catalog:',
    '',
    formatPropertyList(alternatives, language, 6),
    '',
    'Would you like me to check another location or price range?'
  ].join('\n');
}

function hasPropertyIntent(message = '', filters = {}) {
  return Boolean(
    filters.transactionType ||
    filters.buildingType ||
    filters.location ||
    filters.budget ||
    /saran|rekomendasi|recommend|pilihan|opsi|cari|mau|ingin|butuh|need|find|ada apa|apa saja/i.test(message)
  );
}

async function generatePrivateChatbotResponse({
  session,
  history = [],
  userMessage = '',
  recommendationContext = null,
  externalError = null
}) {
  const skillInfo = loadPrivateChatbotSkillInfo();

  console.warn('[CHATBOT PRIVATE CONTROLLER ACTIVE]', {
    reason: externalError?.message || 'External AI provider unavailable.',
    sessionId: session?.id || null,
    skillFileCount: skillInfo.skillFileCount
  });

  const filters = recommendationContext?.filters || extractPropertyFilters(userMessage, history);

  if (isOffTopicMessage(userMessage)) {
    return {
      reply: buildPrivateOffTopicReply(userMessage),
      source: 'private_agent',
      controller: 'chatbotPrivateController',
      fallbackUsed: true,
      fallbackReason: externalError?.message || 'Off-topic handled by private agent.',
      skillInfo,
      exactMatches: 0,
      alternatives: 0,
      filters
    };
  }

  if (!hasPropertyIntent(userMessage, filters)) {
    return {
      reply: buildPrivateClarificationReply(userMessage),
      source: 'private_agent',
      controller: 'chatbotPrivateController',
      fallbackUsed: true,
      fallbackReason: externalError?.message || 'Clarification handled by private agent.',
      skillInfo,
      exactMatches: 0,
      alternatives: 0,
      filters
    };
  }

  const context = recommendationContext || await buildRecommendationContextForLLM(userMessage, history);

  if (context.exactMatches.length) {
    return {
      reply: buildPrivateExactMatchReply({
        message: userMessage,
        filters: context.filters,
        exactMatches: context.exactMatches
      }),
      source: 'private_agent',
      controller: 'chatbotPrivateController',
      fallbackUsed: true,
      fallbackReason: externalError?.message || 'External AI provider unavailable.',
      skillInfo,
      exactMatches: context.exactMatches.length,
      alternatives: context.alternatives.length,
      filters: context.filters
    };
  }

  // Safety rule:
  // If the backend did not label items as exactMatches, but the listed alternatives
  // still visibly match the customer's core request (for example: house + Sidoarjo),
  // do NOT say "no exact match". Present them as available matching options.
  const visibleMatches = getVisibleMatchesFromAlternatives(context.alternatives, context.filters);
  if (visibleMatches.length) {
    console.warn('[CHATBOT PRIVATE CONTROLLER MATCH CORRECTION]', {
      reason: 'Alternatives matched the visible customer request, so response is corrected to exact-match wording.',
      visibleMatches: visibleMatches.length,
      filters: context.filters
    });

    return {
      reply: buildPrivateExactMatchReply({
        message: userMessage,
        filters: context.filters,
        exactMatches: visibleMatches
      }),
      source: 'private_agent',
      controller: 'chatbotPrivateController',
      fallbackUsed: true,
      fallbackReason: externalError?.message || 'External AI provider unavailable.',
      skillInfo,
      exactMatches: visibleMatches.length,
      alternatives: context.alternatives.length,
      filters: context.filters,
      matchCorrectionApplied: true
    };
  }

  return {
    reply: buildPrivateAlternativeReply({
      message: userMessage,
      filters: context.filters,
      alternatives: context.alternatives
    }),
    source: 'private_agent',
    controller: 'chatbotPrivateController',
    fallbackUsed: true,
    fallbackReason: externalError?.message || 'External AI provider unavailable.',
    skillInfo,
    exactMatches: context.exactMatches.length,
    alternatives: context.alternatives.length,
    filters: context.filters
  };
}

exports.privateAgentStatus = (_req, res) => {
  const skillInfo = loadPrivateChatbotSkillInfo();
  const enabled = String(process.env.ENABLE_CHATBOT_PRIVATE_CONTROLLER || 'true').toLowerCase() !== 'false';

  return res.json({
    success: true,
    enabled,
    controller: 'chatbotPrivateController',
    source: 'private_agent',
    behavior: 'Activated when ChatGPT and Claude cannot generate a response.',
    skillInfo
  });
};

exports.sendPrivateMessage = async (req, res) => {
  const payload = {
    name: String(req.body.name || '').trim(),
    phone: String(req.body.phone || '').trim(),
    location: String(req.body.location || '').trim(),
    message: String(req.body.message || '').trim()
  };

  const validation = validateChatbotMessage(payload);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message });
  }

  try {
    const session = await findOrCreateSession(payload.name, payload.phone, payload.location, 'website_chatbot_private');
    await saveUserMessage(session.id, payload.message, 'website_chatbot_private', {
      location: payload.location,
      source: 'private_agent_direct'
    });

    const history = await getConversationHistory(session.id, 12);
    const recommendationContext = await buildRecommendationContextForLLM(payload.message, history);

    const privateResult = await generatePrivateChatbotResponse({
      session,
      history,
      userMessage: payload.message,
      recommendationContext,
      externalError: new Error('Direct private chatbot endpoint used.')
    });

    await saveAssistantMessage(session.id, privateResult.reply, 'website_chatbot_private', {
      source: 'private_agent',
      controller: 'chatbotPrivateController',
      directPrivateEndpoint: true,
      exactMatches: privateResult.exactMatches,
      alternatives: privateResult.alternatives,
      filters: privateResult.filters
    });

    return res.json({
      success: true,
      reply: privateResult.reply,
      sessionId: session.id,
      source: 'private_agent',
      controller: 'chatbotPrivateController',
      fallbackUsed: true,
      directPrivateEndpoint: true,
      exactMatches: privateResult.exactMatches,
      alternatives: privateResult.alternatives
    });
  } catch (error) {
    console.error('[CHATBOT PRIVATE CONTROLLER ERROR]', {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      source: 'private_agent',
      controller: 'chatbotPrivateController',
      message: error.message || 'Private chatbot controller failed.'
    });
  }
};

module.exports.generatePrivateChatbotResponse = generatePrivateChatbotResponse;
module.exports.loadPrivateChatbotSkillInfo = loadPrivateChatbotSkillInfo;

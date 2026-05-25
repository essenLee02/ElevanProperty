const axios = require('axios');
const { loadProjectSkillPrompt } = require('./skillPromptService');
const {
  getProjectSkillInstruction,
  buildContactReplyPrompt,
  buildChatbotReplyPrompt,
  buildWhatsappReplyPrompt,
  buildIntentDetectionPrompt,
  buildPreferenceExtractionPrompt
} = require('./aiPromptBuilderService');

const DEFAULT_CHATGPT_MODEL = 'gpt-5.4-mini';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function sanitizeEnvValue(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/[\r\n]/g, '')
    .trim();
}

function maskSecret(value) {
  const clean = sanitizeEnvValue(value);
  if (!clean) return '';
  if (clean.length <= 12) return '***';
  return `${clean.slice(0, 8)}...${clean.slice(-4)}`;
}

function extractChatGPTText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = data && Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (item && Array.isArray(item.content)) {
      const textParts = item.content
        .map((content) => {
          if (!content) return '';
          if (typeof content.text === 'string') return content.text;
          if (typeof content.output_text === 'string') return content.output_text;
          if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
          return '';
        })
        .filter(Boolean);

      if (textParts.length) return textParts.join('\n').trim();
    }
  }

  if (data && Array.isArray(data.choices)) {
    const text = data.choices
      .map((choice) => choice.message?.content || choice.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();
    if (text) return text;
  }

  return '';
}

function tagChatGPTError(error, options = {}) {
  error.provider = 'chatgpt';
  error.status = options.status || error.status;
  error.fallbackEligible = Boolean(options.fallbackEligible);
  error.originalMessage = options.originalMessage || error.originalMessage || error.message;
  return error;
}

function isChatGPTQuotaBillingOrRateLimit(status, message = '') {
  const text = String(message || '').toLowerCase();
  return (
    status === 402 ||
    status === 429 ||
    text.includes('quota') ||
    text.includes('billing') ||
    text.includes('insufficient') ||
    text.includes('credit') ||
    text.includes('rate limit') ||
    text.includes('rate_limit') ||
    text.includes('exceeded your current quota')
  );
}

function normalizeChatGPTError(error) {
  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown ChatGPT API error';

  if (status === 401) {
    return tagChatGPTError(
      new Error('ChatGPT rejected the API key. Please replace OPENAI_API_KEY in backend/.env with a new active key, then restart the backend.'),
      { status, originalMessage: apiMessage, fallbackEligible: false }
    );
  }

  if (isChatGPTQuotaBillingOrRateLimit(status, apiMessage)) {
    return tagChatGPTError(
      new Error(`ChatGPT API quota/billing/rate limit issue: ${apiMessage}`),
      { status, originalMessage: apiMessage, fallbackEligible: true }
    );
  }

  if ((status === 400 || status === 404) && String(apiMessage).toLowerCase().includes('model')) {
    return tagChatGPTError(
      new Error(`ChatGPT model error: ${apiMessage}. Please check OPENAI_MODEL in backend/.env.`),
      { status, originalMessage: apiMessage, fallbackEligible: false }
    );
  }

  return tagChatGPTError(
    new Error(`ChatGPT API error${status ? ` (${status})` : ''}: ${apiMessage}`),
    { status, originalMessage: apiMessage, fallbackEligible: false }
  );
}

function getChatGPTConfig() {
  const apiKey = sanitizeEnvValue(process.env.OPENAI_API_KEY);
  const model = sanitizeEnvValue(process.env.OPENAI_MODEL) || DEFAULT_CHATGPT_MODEL;

  return {
    apiKey,
    model,
    store: String(process.env.OPENAI_STORE_RESPONSE || 'true').toLowerCase() !== 'false'
  };
}

async function callChatGPTResponseAPI(input, options = {}) {
  const config = getChatGPTConfig();

  if (!config.apiKey) {
    throw tagChatGPTError(new Error('OPENAI_API_KEY is missing in backend/.env'), { fallbackEligible: false });
  }

  if (!config.apiKey.startsWith('sk-')) {
    throw tagChatGPTError(new Error('OPENAI_API_KEY format is invalid. It should start with sk-.'), { fallbackEligible: false });
  }

  const payload = {
    model: options.model || config.model,
    input,
    store: options.store !== undefined ? options.store : config.store
  };

  if (options.metadata && typeof options.metadata === 'object') {
    payload.metadata = options.metadata;
  }

  const maxOutputTokens = Number(options.max_output_tokens || process.env.OPENAI_MAX_OUTPUT_TOKENS || 0);
  if (maxOutputTokens > 0) payload.max_output_tokens = maxOutputTokens;

  try {
    console.log('[CHATGPT REQUEST]', {
      provider: 'chatgpt',
      model: payload.model,
      store: payload.store,
      source: options.metadata?.source || 'unknown',
      channel: options.metadata?.channel || 'unknown'
    });

    const response = await axios.post(OPENAI_RESPONSES_URL, payload, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 90000
    });

    const text = extractChatGPTText(response.data);
    if (!text) throw new Error('ChatGPT response is empty or cannot be parsed.');
    return text;
  } catch (error) {
    throw normalizeChatGPTError(error);
  }
}

async function generateChatGPTContactReply(contactPayload) {
  return callChatGPTResponseAPI(buildContactReplyPrompt(contactPayload, 'chatgpt'), {
    store: true,
    metadata: {
      source: 'contact_form',
      channel: 'website_contact',
      provider: 'chatgpt'
    }
  });
}

async function generateChatGPTChatbotReply(session, history, userMessage, propertyContext = '') {
  return callChatGPTResponseAPI(buildChatbotReplyPrompt(session, history, userMessage, propertyContext, 'chatgpt'), {
    store: true,
    metadata: {
      source: 'floating_chatbot',
      channel: 'website_chatbot',
      sessionId: String(session.id || ''),
      provider: 'chatgpt'
    }
  });
}

async function generateChatGPTWhatsappReply(session, history, userMessage, propertyContext = '') {
  return callChatGPTResponseAPI(buildWhatsappReplyPrompt(session, history, userMessage, propertyContext, 'chatgpt'), {
    store: true,
    metadata: {
      source: 'fonnte_whatsapp',
      channel: 'whatsapp',
      sessionId: String(session.id || ''),
      provider: 'chatgpt'
    }
  });
}

async function detectCustomerIntentWithChatGPT(message) {
  return callChatGPTResponseAPI(buildIntentDetectionPrompt(message, 'chatgpt'), {
    store: true,
    metadata: { source: 'intent_detection', channel: 'backend', provider: 'chatgpt' }
  });
}

async function extractPropertyPreferencesWithChatGPT(message) {
  return callChatGPTResponseAPI(buildPreferenceExtractionPrompt(message, 'chatgpt'), {
    store: true,
    metadata: { source: 'preference_extraction', channel: 'backend', provider: 'chatgpt' }
  });
}

function checkChatGPTConfig() {
  const config = getChatGPTConfig();
  return {
    provider: 'chatgpt',
    hasApiKey: Boolean(config.apiKey),
    keyLooksValid: Boolean(config.apiKey && config.apiKey.startsWith('sk-')),
    maskedKey: maskSecret(config.apiKey),
    model: config.model,
    store: config.store,
    skillPromptLoaded: Boolean(loadProjectSkillPrompt({ provider: 'chatgpt' }))
  };
}

function isChatGPTFallbackEligibleError(error) {
  return Boolean(error?.fallbackEligible || isChatGPTQuotaBillingOrRateLimit(error?.status, error?.message));
}

module.exports = {
  PROPERTY_ASSISTANT_PROMPT: getProjectSkillInstruction('chatgpt'),
  getProjectSkillInstruction,

  // New explicit ChatGPT function names
  getChatGPTConfig,
  callChatGPTResponseAPI,
  generateChatGPTContactReply,
  generateChatGPTChatbotReply,
  generateChatGPTWhatsappReply,
  detectCustomerIntentWithChatGPT,
  extractPropertyPreferencesWithChatGPT,
  checkChatGPTConfig,
  isChatGPTFallbackEligibleError,
  sanitizeEnvValue,
  maskSecret,

  // Backward-compatible aliases used by older controllers/services.
  createResponse: callChatGPTResponseAPI,
  generateContactReply: generateChatGPTContactReply,
  generateChatbotReply: generateChatGPTChatbotReply,
  generateWhatsappReply: generateChatGPTWhatsappReply,
  detectCustomerIntent: detectCustomerIntentWithChatGPT,
  extractPropertyPreferences: extractPropertyPreferencesWithChatGPT,
  checkOpenAIConfig: checkChatGPTConfig
};

const axios = require('axios');
const {
  getProjectSkillInstruction,
  buildContactReplyPrompt,
  buildChatbotReplyPrompt,
  buildWhatsappReplyPrompt,
  buildIntentDetectionPrompt,
  buildPreferenceExtractionPrompt
} = require('./aiPromptBuilderService');
const { sanitizeEnvValue, maskSecret } = require('./openaiService');

const CLAUDE_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5';
const DEFAULT_CLAUDE_API_VERSION = '2023-06-01';

function getClaudeConfig() {
  const apiKey = sanitizeEnvValue(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
  const model = sanitizeEnvValue(process.env.CLAUDE_MODEL) || DEFAULT_CLAUDE_MODEL;
  const apiVersion = sanitizeEnvValue(process.env.CLAUDE_API_VERSION) || DEFAULT_CLAUDE_API_VERSION;
  const maxTokens = Number(process.env.CLAUDE_MAX_TOKENS || 1200);

  return {
    apiKey,
    model,
    apiVersion,
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 1200
  };
}

function extractClaudeText(data) {
  const content = Array.isArray(data?.content) ? data.content : [];
  const text = content
    .map((item) => {
      if (!item) return '';
      if (typeof item.text === 'string') return item.text;
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();

  return text;
}

function normalizeClaudeError(error) {
  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown Claude API error';

  const finalError = new Error(`Claude API error${status ? ` (${status})` : ''}: ${apiMessage}`);
  finalError.provider = 'claude';
  finalError.status = status;
  finalError.originalMessage = apiMessage;
  return finalError;
}

async function callClaudeMessagesAPI(input, options = {}) {
  const config = getClaudeConfig();

  if (!config.apiKey) {
    const error = new Error('ANTHROPIC_API_KEY is missing in backend/.env. Add your Claude API key, then restart the backend.');
    error.provider = 'claude';
    throw error;
  }

  const payload = {
    model: options.model || config.model,
    max_tokens: Number(options.max_tokens || config.maxTokens),
    system: options.system || 'You are a helpful professional property assistant.',
    messages: [
      {
        role: 'user',
        content: input
      }
    ]
  };

  try {
    console.log('[CLAUDE REQUEST]', {
      provider: 'claude',
      model: payload.model,
      source: options.metadata?.source || 'unknown',
      channel: options.metadata?.channel || 'unknown'
    });

    const response = await axios.post(CLAUDE_MESSAGES_URL, payload, {
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': config.apiVersion,
        'content-type': 'application/json'
      },
      timeout: 90000
    });

    const text = extractClaudeText(response.data);
    if (!text) throw new Error('Claude response is empty or cannot be parsed.');
    return text;
  } catch (error) {
    throw normalizeClaudeError(error);
  }
}

async function generateClaudeContactReply(contactPayload) {
  return callClaudeMessagesAPI(buildContactReplyPrompt(contactPayload), {
    system: getProjectSkillInstruction(),
    metadata: {
      source: 'elevanlabs_contact_form',
      channel: 'website_contact',
      provider: 'claude'
    }
  });
}

async function generateClaudeChatbotReply(session, history, userMessage, propertyContext = '') {
  return callClaudeMessagesAPI(buildChatbotReplyPrompt(session, history, userMessage, propertyContext), {
    system: getProjectSkillInstruction(),
    metadata: {
      source: 'elevanlabs_floating_chatbot',
      channel: 'website_chatbot',
      sessionId: String(session.id || ''),
      provider: 'claude'
    }
  });
}

async function generateClaudeWhatsappReply(session, history, userMessage, propertyContext = '') {
  return callClaudeMessagesAPI(buildWhatsappReplyPrompt(session, history, userMessage, propertyContext), {
    system: getProjectSkillInstruction(),
    metadata: {
      source: 'elevanlabs_fonnte_whatsapp',
      channel: 'whatsapp',
      sessionId: String(session.id || ''),
      provider: 'claude'
    }
  });
}

async function detectCustomerIntentWithClaude(message) {
  return callClaudeMessagesAPI(buildIntentDetectionPrompt(message), {
    system: getProjectSkillInstruction(),
    metadata: { source: 'elevanlabs_intent_detection', channel: 'backend', provider: 'claude' }
  });
}

async function extractPropertyPreferencesWithClaude(message) {
  return callClaudeMessagesAPI(buildPreferenceExtractionPrompt(message), {
    system: getProjectSkillInstruction(),
    metadata: { source: 'elevanlabs_preference_extraction', channel: 'backend', provider: 'claude' }
  });
}

function checkClaudeConfig() {
  const config = getClaudeConfig();
  return {
    provider: 'claude',
    hasApiKey: Boolean(config.apiKey),
    keyLooksValid: Boolean(config.apiKey && config.apiKey.length > 20),
    maskedKey: maskSecret(config.apiKey),
    model: config.model,
    apiVersion: config.apiVersion,
    maxTokens: config.maxTokens
  };
}

module.exports = {
  getClaudeConfig,
  callClaudeMessagesAPI,
  generateClaudeContactReply,
  generateClaudeChatbotReply,
  generateClaudeWhatsappReply,
  detectCustomerIntentWithClaude,
  extractPropertyPreferencesWithClaude,
  checkClaudeConfig,
  extractClaudeText
};

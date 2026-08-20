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

function _waSource() {
  const t = String(process.env.MESSAGE_TERMINAL || '').toUpperCase();
  if (t === 'KIRIMI')      return 'kirimi_whatsapp';
  if (t === 'TIMELINESAI') return 'timelinesai_whatsapp';
  return 'fonnte_whatsapp';
}

/**
 * Build the text used to decide which conditional reference skill docs (facilities/
 * landmark tables) should load this turn — current message + last few history turns.
 */
function _skillContext(history = [], userMessage = '') {
  const recent = (history || []).slice(-6).map((h) => h.message || '').join(' ');
  return `${recent} ${userMessage || ''}`;
}

function getClaudeConfig() {
  const apiKey = sanitizeEnvValue(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
  const model = sanitizeEnvValue(process.env.CLAUDE_MODEL);
  const apiVersion = sanitizeEnvValue(process.env.CLAUDE_API_VERSION);
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
      // M126: configurable (was hardcoded), same fix pattern as KIMI_TIMEOUT_MS
      // — default unchanged (90000) so unset behavior doesn't shift silently.
      timeout: Number(process.env.CLAUDE_TIMEOUT_MS || 90000)
    });

    const text = extractClaudeText(response.data);
    if (!text) throw new Error('Claude response is empty or cannot be parsed.');
    return text;
  } catch (error) {
    throw normalizeClaudeError(error);
  }
}

async function generateClaudeContactReply(contactPayload) {
  return callClaudeMessagesAPI(buildContactReplyPrompt(contactPayload, 'claude'), {
    system: getProjectSkillInstruction('claude'),
    metadata: {
      source: 'contact_form',
      channel: 'website_contact',
      provider: 'claude'
    }
  });
}

async function generateClaudeChatbotReply(session, history, userMessage, propertyContext = '') {
  return callClaudeMessagesAPI(buildChatbotReplyPrompt(session, history, userMessage, propertyContext, 'claude'), {
    system: getProjectSkillInstruction('claude', _skillContext(history, userMessage)),
    metadata: {
      source: 'floating_chatbot',
      channel: 'website_chatbot',
      sessionId: String(session.id || ''),
      provider: 'claude'
    }
  });
}

async function generateClaudeWhatsappReply(session, history, userMessage, propertyContext = '', extraContext = {}) {
  return callClaudeMessagesAPI(buildWhatsappReplyPrompt(session, history, userMessage, propertyContext, 'claude', extraContext), {
    system: getProjectSkillInstruction('claude', _skillContext(history, userMessage)),
    metadata: {
      source: _waSource(),
      channel: 'whatsapp',
      sessionId: String(session.id || ''),
      provider: 'claude'
    }
  });
}

async function detectCustomerIntentWithClaude(message) {
  return callClaudeMessagesAPI(buildIntentDetectionPrompt(message, 'claude'), {
    system: getProjectSkillInstruction('claude'),
    metadata: { source: 'intent_detection', channel: 'backend', provider: 'claude' }
  });
}

async function extractPropertyPreferencesWithClaude(message) {
  return callClaudeMessagesAPI(buildPreferenceExtractionPrompt(message, 'claude'), {
    system: getProjectSkillInstruction('claude'),
    metadata: { source: 'preference_extraction', channel: 'backend', provider: 'claude' }
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
    maxTokens: config.maxTokens,
    skillPromptLoaded: Boolean(getProjectSkillInstruction('claude'))
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

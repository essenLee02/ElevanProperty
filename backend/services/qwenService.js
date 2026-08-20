const axios = require('axios');
const {
  getProjectSkillInstruction,
  buildContactReplyPrompt,
  buildChatbotReplyPrompt,
  buildWhatsappReplyPrompt,
} = require('./aiPromptBuilderService');
const { sanitizeEnvValue } = require('./openaiService');

// DashScope OpenAI-compatible endpoint.
// International (QwenCloud): https://dashscope-intl.aliyuncs.com/compatible-mode/v1
// China mainland:            https://dashscope.aliyuncs.com/compatible-mode/v1
// Set QWEN_BASE_URL in .env to override.
const QWEN_BASE_URL  = (process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
const QWEN_CHAT_URL  = `${QWEN_BASE_URL}/chat/completions`;

// Bailian App endpoint (sk-ws-* workspace keys + QWEN_APP_ID)
const BAILIAN_CHAT_URL = 'https://bailian.aliyuncs.com/v2/app/completions';

// Resolve WhatsApp source label from MESSAGE_TERMINAL env (FONNTE | KIRIMI | TIMELINESAI)
function _waSource() {
  const t = String(process.env.MESSAGE_TERMINAL || '').toUpperCase();
  if (t === 'KIRIMI')     return 'kirimi_whatsapp';
  if (t === 'TIMELINESAI') return 'timelinesai_whatsapp';
  return 'fonnte_whatsapp';
}

function getQwenConfig() {
  const apiKey    = sanitizeEnvValue(process.env.QWEN_API_KEY || '');
  const model     = sanitizeEnvValue(process.env.QWEN_MODEL   || '');
  const maxTokens = Number(process.env.QWEN_MAX_TOKENS || 500);
  const appId     = sanitizeEnvValue(process.env.QWEN_APP_ID  || '');
  return {
    apiKey,
    model,
    appId,
    maxTokens    : Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 500,
    hasApiKey    : !!apiKey,
    keyLooksValid: !!apiKey && apiKey.length > 20,
    isBailianKey : apiKey.startsWith('sk-ws-'),
  };
}

function normalizeQwenError(error) {
  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown Qwen API error';
  const finalError = new Error(`Qwen API error${status ? ` (${status})` : ''}: ${apiMessage}`);
  finalError.provider = 'qwen';
  finalError.status   = status;
  finalError.originalMessage = apiMessage;
  return finalError;
}

async function callQwenChatAPI(systemPrompt, userPrompt, options = {}) {
  const config = getQwenConfig();

  if (!config.apiKey) {
    const err = new Error('QWEN_API_KEY is missing in backend/.env.');
    err.provider = 'qwen';
    throw err;
  }

  // sk-ws- (Bailian workspace key) + QWEN_APP_ID set → use Bailian App endpoint
  // sk-ws- without QWEN_APP_ID → try DashScope (will fail at API level if key invalid)
  // standard sk-xxx → use DashScope
  const useBailian = config.isBailianKey && !!config.appId;
  const chatUrl    = useBailian ? BAILIAN_CHAT_URL : QWEN_CHAT_URL;

  const messages = [
    { role: 'system', content: systemPrompt || 'You are a helpful professional property assistant.' },
    { role: 'user',   content: userPrompt   || '' },
  ];

  const payload = useBailian
    ? { appId: config.appId, messages }
    : { model: options.model || config.model, max_tokens: options.max_tokens || config.maxTokens, messages };

  try {
    console.log('[QWEN REQUEST]', {
      provider : 'qwen',
      endpoint : useBailian ? 'bailian' : 'dashscope',
      model    : config.model,
      source   : options.metadata?.source  || 'unknown',
      channel  : options.metadata?.channel || 'unknown',
    });

    const response = await axios.post(chatUrl, payload, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type' : 'application/json',
      },
      // M126: configurable (was hardcoded), same fix pattern as KIMI_TIMEOUT_MS
      // — default unchanged (60000) so unset behavior doesn't shift silently.
      timeout: Number(process.env.QWEN_TIMEOUT_MS || 60000),
    });

    // Bailian wraps errors in the body with HTTP 200 (v1: lowercase success; v2: capital Success)
    const bailianFailed = useBailian && (response.data?.Success === false || response.data?.success === false);
    if (bailianFailed) {
      const code = response.data?.Code || response.data?.errorCode || '';
      const msg  = response.data?.Message || response.data?.errorMsg || 'Auth failed';
      const bailianErr = new Error(`Bailian error ${code}: ${msg}`);
      bailianErr.provider = 'qwen';
      bailianErr.status   = 401;
      throw bailianErr;
    }

    const text = response.data?.choices?.[0]?.message?.content?.trim()
      || response.data?.Output?.Text?.trim()
      || '';
    if (!text) throw new Error('Qwen response is empty or cannot be parsed.');
    return text;
  } catch (error) {
    throw normalizeQwenError(error);
  }
}

function generateQwenContactReply(contactPayload) {
  const prompt = buildContactReplyPrompt(contactPayload, 'qwen');
  return callQwenChatAPI(getProjectSkillInstruction('qwen'), prompt, {
    metadata: { source: 'contact_form', channel: 'website_contact', provider: 'qwen' },
  });
}

function generateQwenChatbotReply(session, history, userMessage, propertyContext = '') {
  const prompt = buildChatbotReplyPrompt(session, history, userMessage, propertyContext, 'qwen');
  return callQwenChatAPI(getProjectSkillInstruction('qwen'), prompt, {
    metadata: { source: 'floating_chatbot', channel: 'website_chatbot', sessionId: String(session.id || ''), provider: 'qwen' },
  });
}

function generateQwenWhatsappReply(session, history, userMessage, propertyContext = '', extraContext = {}) {
  const prompt = buildWhatsappReplyPrompt(session, history, userMessage, propertyContext, 'qwen', extraContext);
  return callQwenChatAPI(getProjectSkillInstruction('qwen'), prompt, {
    metadata: { source: _waSource(), channel: 'whatsapp', sessionId: String(session.id || ''), provider: 'qwen' },
  });
}

function checkQwenConfig() {
  return getQwenConfig();
}

module.exports = {
  generateQwenContactReply,
  generateQwenChatbotReply,
  generateQwenWhatsappReply,
  checkQwenConfig,
};

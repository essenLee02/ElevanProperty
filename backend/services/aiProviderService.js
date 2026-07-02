const {
  generateChatGPTContactReply,
  generateChatGPTChatbotReply,
  generateChatGPTWhatsappReply,
  checkChatGPTConfig
} = require('./openaiService');

const {
  generateClaudeContactReply,
  generateClaudeChatbotReply,
  generateClaudeWhatsappReply,
  checkClaudeConfig
} = require('./claudeService');

const {
  generateQwenContactReply,
  generateQwenChatbotReply,
  generateQwenWhatsappReply,
  checkQwenConfig
} = require('./qwenService');

// ENABLE_CLAUDE_FALLBACK: mengontrol apakah Claude diizinkan digunakan sama sekali.
// Nama "Fallback" dipertahankan untuk backward-compat .env; secara efektif adalah toggle Claude.
function isClaudeEnabled() {
  return String(process.env.ENABLE_CLAUDE_FALLBACK || 'true').toLowerCase() !== 'false';
}

function getPrimaryAIProvider() {
  const value = String(process.env.AI_PRIMARY_PROVIDER || 'chatgpt').toLowerCase().trim();

  // Support: 'chatgpt', 'claude', 'qwen', 'private'
  if (value === 'claude')   return 'claude';
  if (value === 'qwen')     return 'qwen';
  if (value === 'private')  return 'private';

  return 'chatgpt'; // default
}

function getAIProviderOrder() {
  const primary = getPrimaryAIProvider();
  if (primary === 'private') return ['private'];
  if (primary === 'claude')  return ['claude'];
  if (primary === 'qwen')    return ['qwen'];
  return ['chatgpt'];
}

function canUseChatGPT() {
  const chatGPTConfig = checkChatGPTConfig();
  return chatGPTConfig.hasApiKey && chatGPTConfig.keyLooksValid;
}

function canUseClaude() {
  const claudeConfig = checkClaudeConfig();
  return isClaudeEnabled() && claudeConfig.hasApiKey && claudeConfig.keyLooksValid;
}

function canUseQwen() {
  const qwenConfig = checkQwenConfig();
  return qwenConfig.hasApiKey; // Validasi key format dikerjakan oleh API call, bukan di sini
}

function logProviderError(provider, taskName, error) {
  console.error(`[${String(provider).toUpperCase()} ERROR]`, {
    taskName,
    provider,
    status: error?.status || error?.response?.status || null,
    message: error?.originalMessage || error?.message || 'Unknown provider error',
    stack: error?.stack
  });
}

function logProviderSkipped(provider, taskName, reason) {
  console.warn('[AI PROVIDER SKIPPED]', {
    taskName,
    provider,
    reason
  });
}

function logProviderFallback(taskName, fromProvider, toProvider, reason) {
  console.warn('[AI PROVIDER FALLBACK]', {
    taskName,
    from: fromProvider,
    to: toProvider,
    reason
  });
}

// Urutan fallback berdasarkan AI_PRIMARY_PROVIDER:
//   qwen    → QWEN → Private Agent (dihandle oleh caller)
//   claude  → Claude → Private Agent (dihandle oleh caller)
//   chatgpt → ChatGPT → Private Agent (dihandle oleh caller)
//   private → throw (caller langsung pakai Private Agent)
// Setiap provider hanya mencoba dirinya sendiri. Jika gagal → throw → caller fallback ke Private Agent.
const PROVIDER_ORDER = {
  qwen    : ['qwen'],
  claude  : ['claude'],
  chatgpt : ['chatgpt'],
};

async function executeAIProviderWithFallback(taskName, chatGPTFn, claudeFn, qwenFn = null) {
  const primary = getPrimaryAIProvider();

  if (primary === 'private') {
    const err = new Error('AI_PRIMARY_PROVIDER=private: Private Agent is primary.');
    err.provider = 'private';
    err.providerErrors = [];
    throw err;
  }

  const order = PROVIDER_ORDER[primary] || PROVIDER_ORDER.chatgpt;
  const fns   = { chatgpt: chatGPTFn, claude: claudeFn, qwen: qwenFn };
  const avail = {
    chatgpt : () => canUseChatGPT()        && !!chatGPTFn,
    claude  : () => canUseClaude() && !!claudeFn,
    qwen    : () => canUseQwen()           && !!qwenFn,
  };

  const providerErrors  = [];
  const primaryProvider = order[0];

  for (const providerName of order) {
    if (!avail[providerName]()) {
      logProviderSkipped(providerName, taskName, `${providerName} not available.`);
      continue;
    }

    if (providerErrors.length > 0) {
      const prev = providerErrors[providerErrors.length - 1];
      logProviderFallback(taskName, prev.provider, providerName, prev.message);
    }

    try {
      const reply = await fns[providerName]();
      return {
        reply,
        provider        : providerName,
        fallbackUsed    : providerName !== primaryProvider,
        primaryProvider,
        fallbackProvider: providerName !== primaryProvider ? providerName : null,
        primaryError    : providerErrors.length > 0 ? providerErrors[0].message : null,
        providerErrors,
        taskName,
      };
    } catch (err) {
      logProviderError(providerName, taskName, err);
      providerErrors.push({ provider: providerName, message: err.message, status: err.status || null });
    }
  }

  const finalError = new Error(
    `All AI providers failed. ${providerErrors.map(e => `${e.provider}: ${e.message}`).join('. ')}`
  );
  finalError.provider      = 'ai_provider_router';
  finalError.providerErrors = providerErrors;
  throw finalError;
}

// Digunakan saat Private Agent gagal (AI_PRIMARY_PROVIDER=private):
// urutan tetap Claude → ChatGPT → QWEN tanpa memperhatikan primary setting.
async function executeExternalAIFallbackChain(taskName, chatGPTFn, claudeFn, qwenFn = null) {
  const fns   = { chatgpt: chatGPTFn, claude: claudeFn, qwen: qwenFn };
  const avail = {
    chatgpt : () => canUseChatGPT()        && !!chatGPTFn,
    claude  : () => canUseClaude() && !!claudeFn,
    qwen    : () => canUseQwen()           && !!qwenFn,
  };
  const providerErrors = [];

  for (const providerName of ['claude', 'chatgpt', 'qwen']) {
    if (!avail[providerName]()) {
      logProviderSkipped(providerName, taskName, `${providerName} not available (private-agent fallback).`);
      continue;
    }

    if (providerErrors.length > 0) {
      const prev = providerErrors[providerErrors.length - 1];
      logProviderFallback(taskName, prev.provider, providerName, prev.message);
    }

    try {
      const reply = await fns[providerName]();
      return { reply, provider: providerName, fallbackUsed: true, primaryProvider: 'private', fallbackProvider: providerName, providerErrors, taskName };
    } catch (err) {
      logProviderError(providerName, taskName, err);
      providerErrors.push({ provider: providerName, message: err.message, status: err.status || null });
    }
  }

  const finalError = new Error(`Private Agent dan semua external AI gagal. ${providerErrors.map(e => `${e.provider}: ${e.message}`).join('. ')}`);
  finalError.provider      = 'ai_provider_router';
  finalError.providerErrors = providerErrors;
  throw finalError;
}

async function generateContactReplyWithProviderFallback(contactPayload) {
  return executeAIProviderWithFallback(
    'contact_reply',
    () => generateChatGPTContactReply(contactPayload),
    () => generateClaudeContactReply(contactPayload),
    () => generateQwenContactReply(contactPayload)
  );
}

async function generateChatbotReplyWithProviderFallback(session, history, userMessage, propertyContext = '') {
  return executeAIProviderWithFallback(
    'chatbot_reply',
    () => generateChatGPTChatbotReply(session, history, userMessage, propertyContext),
    () => generateClaudeChatbotReply(session, history, userMessage, propertyContext),
    () => generateQwenChatbotReply(session, history, userMessage, propertyContext)
  );
}

async function generateWhatsappReplyWithProviderFallback(session, history, userMessage, propertyContext = '', extraContext = {}) {
  return executeAIProviderWithFallback(
    'whatsapp_reply',
    () => generateChatGPTWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateClaudeWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateQwenWhatsappReply(session, history, userMessage, propertyContext, extraContext)
  );
}

// Fallback eksternal saat Private Agent gagal (primary=private):
// urutan Claude → ChatGPT → QWEN
async function generateWhatsappExternalAIFallback(session, history, userMessage, propertyContext = '', extraContext = {}) {
  return executeExternalAIFallbackChain(
    'whatsapp_private_fallback',
    () => generateChatGPTWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateClaudeWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateQwenWhatsappReply(session, history, userMessage, propertyContext, extraContext)
  );
}

function checkAIProviderConfig() {
  const chatGPT = checkChatGPTConfig();
  const claude  = checkClaudeConfig();
  const qwen    = checkQwenConfig();

  return {
    primaryProvider      : getPrimaryAIProvider(),
    providerOrder        : getAIProviderOrder(),
    claudeFallbackEnabled: isClaudeEnabled(),
    chatGPTReady         : canUseChatGPT(),
    claudeFallbackReady  : canUseClaude(),
    qwenFallbackReady    : canUseQwen(),
    chatGPT,
    claude,
    qwen
  };
}

module.exports = {
  isClaudeEnabled,
  getPrimaryAIProvider,
  getAIProviderOrder,
  canUseChatGPT,
  canUseClaude,
  canUseQwen,
  executeAIProviderWithFallback,
  executeExternalAIFallbackChain,
  generateContactReplyWithProviderFallback,
  generateChatbotReplyWithProviderFallback,
  generateWhatsappReplyWithProviderFallback,
  generateWhatsappExternalAIFallback,
  checkAIProviderConfig
};

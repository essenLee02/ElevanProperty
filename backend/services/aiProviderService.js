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

const {
  generateDeepSeekContactReply,
  generateDeepSeekChatbotReply,
  generateDeepSeekWhatsappReply,
  checkDeepSeekConfig
} = require('./deepseekService');

const {
  generateKimiContactReply,
  generateKimiChatbotReply,
  generateKimiWhatsappReply,
  checkKimiConfig
} = require('./kimiService');

// ENABLE_CLAUDE_FALLBACK: mengontrol apakah Claude diizinkan digunakan sama sekali.
// Nama "Fallback" dipertahankan untuk backward-compat .env; secara efektif adalah toggle Claude.
function isClaudeEnabled() {
  return String(process.env.ENABLE_CLAUDE_FALLBACK || 'true').toLowerCase() !== 'false';
}

function getPrimaryAIProvider() {
  const value = String(process.env.AI_PRIMARY_PROVIDER || 'chatgpt').toLowerCase().trim();

  if (value === 'claude')    return 'claude';
  if (value === 'qwen')      return 'qwen';
  if (value === 'deepseek')  return 'deepseek';
  if (value === 'kimi')      return 'kimi';
  if (value === 'private')   return 'private';

  return 'chatgpt'; // default
}

// ⚠️ PROVIDER_ORDER dideklarasikan di ATAS pemakaian pertamanya (dulu di ~baris 113,
// dipakai di sini). `const` berada di Temporal Dead Zone sampai baris deklarasinya
// dieksekusi, jadi susunan lama akan melempar ReferenceError bila fungsi ini pernah
// dipanggil saat modul masih dimuat. Aman hari ini, tapi persis kelas bug yang
// membuat M62/M63 senyap — jadi dirapikan, bukan dibiarkan.
//
// ⛔ ATURAN WAJIB (user, 4 Agu 2026): SETIAP primary — Kimi, DeepSeek, Qwen,
// Claude, ChatGPT — bila error (token habis, key invalid, network, dll) LANGSUNG
// jatuh ke Private Agent (chatbotPrivateController.js). TIDAK PERNAH mencoba
// provider eksternal LAIN dulu. Karena itu tiap key di bawah HANYA berisi SATU
// elemen (dirinya sendiri) — JANGAN pernah menambah provider kedua ke array
// manapun di bawah ini, itu akan melanggar aturan ini secara diam-diam.
// Terkunci oleh tests/providerFallbackRule.test.js.
const PROVIDER_ORDER = {
  qwen     : ['qwen'],
  claude   : ['claude'],
  chatgpt  : ['chatgpt'],
  deepseek : ['deepseek'],
  kimi     : ['kimi'],
};

function getAIProviderOrder() {
  const primary = getPrimaryAIProvider();
  if (primary === 'private') return ['private'];
  if (PROVIDER_ORDER[primary]) return PROVIDER_ORDER[primary];
  return PROVIDER_ORDER.chatgpt;
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
  return qwenConfig.hasApiKey;
}

function canUseDeepSeek() {
  const cfg = checkDeepSeekConfig();
  return cfg.hasApiKey;
}

function canUseKimi() {
  const cfg = checkKimiConfig();
  return cfg.hasApiKey;
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

// ═════════════════════════════════════════════════════════════════════════════
// PROVIDER FALLBACK — Tingkatkan penggunaan AI
// ═════════════════════════════════════════════════════════════════════════════
// AI_PRIMARY_PROVIDER:
//   qwen     → Try QWEN → Error? → Fallback Private Agent
//   claude   → Try Claude → Error? → Fallback Private Agent
//   chatgpt  → Try ChatGPT → Error? → Fallback Private Agent
//   deepseek → Try DeepSeek → Error? → Fallback Private Agent
//   kimi     → Try Kimi → Error? → Fallback Private Agent
//   private  → Private Agent only (no external AI)
//
// Fallback otomatis jika primary provider error (token, billing, API, timeout).
// Private Agent selalu tersedia sebagai fallback terakhir.
// ═════════════════════════════════════════════════════════════════════════════
// (PROVIDER_ORDER dipindahkan ke atas — lihat catatan di getAIProviderOrder)

async function executeAIProviderWithFallback(taskName, chatGPTFn, claudeFn, qwenFn = null, deepseekFn = null, kimiFn = null) {
  const primary = getPrimaryAIProvider();

  if (primary === 'private') {
    const err = new Error('AI_PRIMARY_PROVIDER=private: Private Agent is primary.');
    err.provider = 'private';
    err.providerErrors = [];
    throw err;
  }

  const order = PROVIDER_ORDER[primary] || PROVIDER_ORDER.chatgpt;
  const fns   = { chatgpt: chatGPTFn, claude: claudeFn, qwen: qwenFn, deepseek: deepseekFn, kimi: kimiFn };
  const avail = {
    chatgpt  : () => canUseChatGPT()   && !!chatGPTFn,
    claude   : () => canUseClaude()    && !!claudeFn,
    qwen     : () => canUseQwen()      && !!qwenFn,
    deepseek : () => canUseDeepSeek()  && !!deepseekFn,
    kimi     : () => canUseKimi()      && !!kimiFn,
  };

  const providerErrors  = [];
  const primaryProvider = order[0];

  console.log(`[AI Provider] Trying primary provider: ${primaryProvider} (fallback to Private Agent if error)`);

  for (const providerName of order) {
    if (!avail[providerName]()) {
      logProviderSkipped(providerName, taskName, `${providerName} not available (no API key or not configured).`);
      continue;
    }

    if (providerErrors.length > 0) {
      const prev = providerErrors[providerErrors.length - 1];
      logProviderFallback(taskName, prev.provider, providerName, `${prev.provider} failed → trying ${providerName}`);
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
// urutan: DeepSeek → Kimi → Claude → ChatGPT → QWEN
async function executeExternalAIFallbackChain(taskName, chatGPTFn, claudeFn, qwenFn = null, deepseekFn = null, kimiFn = null) {
  const fns   = { chatgpt: chatGPTFn, claude: claudeFn, qwen: qwenFn, deepseek: deepseekFn, kimi: kimiFn };
  const avail = {
    chatgpt  : () => canUseChatGPT()   && !!chatGPTFn,
    claude   : () => canUseClaude()    && !!claudeFn,
    qwen     : () => canUseQwen()      && !!qwenFn,
    deepseek : () => canUseDeepSeek()  && !!deepseekFn,
    kimi     : () => canUseKimi()      && !!kimiFn,
  };
  const providerErrors = [];

  for (const providerName of ['deepseek', 'kimi', 'claude', 'chatgpt', 'qwen']) {
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
    () => generateQwenContactReply(contactPayload),
    () => generateDeepSeekContactReply(contactPayload),
    () => generateKimiContactReply(contactPayload)
  );
}

async function generateChatbotReplyWithProviderFallback(session, history, userMessage, propertyContext = '') {
  return executeAIProviderWithFallback(
    'chatbot_reply',
    () => generateChatGPTChatbotReply(session, history, userMessage, propertyContext),
    () => generateClaudeChatbotReply(session, history, userMessage, propertyContext),
    () => generateQwenChatbotReply(session, history, userMessage, propertyContext),
    () => generateDeepSeekChatbotReply(session, history, userMessage, propertyContext),
    () => generateKimiChatbotReply(session, history, userMessage, propertyContext)
  );
}

async function generateWhatsappReplyWithProviderFallback(session, history, userMessage, propertyContext = '', extraContext = {}) {
  return executeAIProviderWithFallback(
    'whatsapp_reply',
    () => generateChatGPTWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateClaudeWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateQwenWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateDeepSeekWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateKimiWhatsappReply(session, history, userMessage, propertyContext, extraContext)
  );
}

// Fallback eksternal saat Private Agent gagal (primary=private):
// urutan: DeepSeek → Kimi → Claude → ChatGPT → QWEN
async function generateWhatsappExternalAIFallback(session, history, userMessage, propertyContext = '', extraContext = {}) {
  return executeExternalAIFallbackChain(
    'whatsapp_private_fallback',
    () => generateChatGPTWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateClaudeWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateQwenWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateDeepSeekWhatsappReply(session, history, userMessage, propertyContext, extraContext),
    () => generateKimiWhatsappReply(session, history, userMessage, propertyContext, extraContext)
  );
}

function checkAIProviderConfig() {
  const chatGPT   = checkChatGPTConfig();
  const claude    = checkClaudeConfig();
  const qwen      = checkQwenConfig();
  const deepseek  = checkDeepSeekConfig();
  const kimi      = checkKimiConfig();

  return {
    primaryProvider      : getPrimaryAIProvider(),
    providerOrder        : getAIProviderOrder(),
    claudeEnabled        : isClaudeEnabled(),
    chatGPTReady         : canUseChatGPT(),
    claudeReady          : canUseClaude(),
    qwenReady            : canUseQwen(),
    deepseekReady        : canUseDeepSeek(),
    kimiReady            : canUseKimi(),
    chatGPT,
    claude,
    qwen,
    deepseek,
    kimi,
  };
}

module.exports = {
  isClaudeEnabled,
  getPrimaryAIProvider,
  getAIProviderOrder,
  canUseChatGPT,
  canUseClaude,
  canUseQwen,
  canUseDeepSeek,
  canUseKimi,
  executeAIProviderWithFallback,
  executeExternalAIFallbackChain,
  generateContactReplyWithProviderFallback,
  generateChatbotReplyWithProviderFallback,
  generateWhatsappReplyWithProviderFallback,
  generateWhatsappExternalAIFallback,
  checkAIProviderConfig
};

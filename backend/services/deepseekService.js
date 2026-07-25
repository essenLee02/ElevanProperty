const axios = require('axios');
const {
  getProjectSkillInstruction,
  buildContactReplyPrompt,
  buildChatbotReplyPrompt,
  buildWhatsappReplyPrompt,
} = require('./aiPromptBuilderService');
const { sanitizeEnvValue } = require('./openaiService');

// Resolve WhatsApp source label from MESSAGE_TERMINAL env
function _waSource() {
  const t = String(process.env.MESSAGE_TERMINAL || '').toUpperCase();
  if (t === 'KIRIMI')      return 'kirimi_whatsapp';
  if (t === 'TIMELINESAI') return 'timelinesai_whatsapp';
  return 'fonnte_whatsapp';
}

function _clamp(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function getDeepSeekConfig() {
  const apiKey      = sanitizeEnvValue(process.env.DEEPSEEK_API_KEY  || '');
  const rawModel    = sanitizeEnvValue(process.env.DEEPSEEK_MODEL    || '').split('#')[0].trim();
  const rawBaseUrl  = sanitizeEnvValue(process.env.DEEPSEEK_BASE_URL || '').split('#')[0].trim();
  const maxTokens   = _clamp(process.env.DEEPSEEK_MAX_TOKENS,  1,    65536, 4096);
  const temperature = _clamp(process.env.DEEPSEEK_TEMPERATURE, 0.0,  2.0,   1.0);
  const topP        = _clamp(process.env.DEEPSEEK_TOP_P,       0.0,  1.0,   1.0);
  const baseUrl     = rawBaseUrl || 'https://api.deepseek.com';

  return {
    apiKey,
    // ⚠️ Default HARUS model yang masih didukung. Sejak DeepSeek V4 (Juli 2026),
    // nama lama `deepseek-chat` / `deepseek-reasoner` DITOLAK dengan HTTP 400:
    //   "The supported API model names are deepseek-v4-pro or deepseek-v4-flash".
    // Akibatnya seluruh panggilan gagal & sistem diam-diam jatuh ke Private Agent.
    model       : rawModel || 'deepseek-v4-flash',
    maxTokens,
    temperature,
    topP,
    baseUrl,
    chatUrl     : `${baseUrl}/v1/chat/completions`,
    hasApiKey   : !!apiKey,
  };
}

function normalizeDeepSeekError(error) {
  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown DeepSeek API error';

  if (status === 401) {
    const err = new Error('DeepSeek rejected the API key. Please replace DEEPSEEK_API_KEY in backend/.env, then restart the backend.');
    err.provider = 'deepseek'; err.status = status; err.fallbackEligible = false;
    return err;
  }

  if (status === 402 || status === 429) {
    const err = new Error(`DeepSeek quota/rate limit: ${apiMessage}`);
    err.provider = 'deepseek'; err.status = status; err.fallbackEligible = true;
    return err;
  }

  // Model tidak didukung (mis. nama lama `deepseek-chat` setelah migrasi V4).
  // Ini KESALAHAN KONFIGURASI, bukan gangguan sesaat — kalau tidak ditampilkan
  // mencolok, sistem akan diam-diam memakai Private Agent terus-menerus.
  if (status === 400 && /supported API model names|model/i.test(apiMessage)) {
    console.error(
      '\n╔════════════════════════════════════════════════════════════════════╗\n' +
      '║  ⛔ DEEPSEEK: NAMA MODEL TIDAK DIDUKUNG — SEMUA CALL AKAN GAGAL   ║\n' +
      '╚════════════════════════════════════════════════════════════════════╝\n' +
      `   Pesan API : ${apiMessage}\n` +
      `   Model kini: ${sanitizeEnvValue(process.env.DEEPSEEK_MODEL || '(kosong)')}\n` +
      '   PERBAIKI  : set DEEPSEEK_MODEL=deepseek-v4-flash (atau deepseek-v4-pro)\n' +
      '               di backend/.env lalu RESTART backend.\n'
    );
    const err = new Error(`DeepSeek model tidak didukung: ${apiMessage}`);
    err.provider = 'deepseek'; err.status = status; err.fallbackEligible = true;
    err.configError = true;
    return err;
  }

  const err = new Error(`DeepSeek API error${status ? ` (${status})` : ''}: ${apiMessage}`);
  err.provider = 'deepseek'; err.status = status; err.fallbackEligible = false;
  return err;
}

async function callDeepSeekChatAPI(userPrompt, options = {}) {
  const config = getDeepSeekConfig();

  if (!config.apiKey) {
    const err = new Error('DEEPSEEK_API_KEY is missing in backend/.env');
    err.provider = 'deepseek'; err.fallbackEligible = false;
    throw err;
  }

  const systemPrompt = options.system || getProjectSkillInstruction('deepseek');
  const payload = {
    model      : options.model       || config.model,
    messages   : [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    max_tokens : Number(options.max_tokens  || config.maxTokens),
    temperature: Number(options.temperature ?? config.temperature),
    top_p      : Number(options.top_p       ?? config.topP),
    stream     : false,
  };

  try {
    console.log('[DEEPSEEK REQUEST]', {
      provider   : 'deepseek',
      model      : payload.model,
      max_tokens : payload.max_tokens,
      temperature: payload.temperature,
      top_p      : payload.top_p,
      source     : options.metadata?.source  || 'unknown',
      channel    : options.metadata?.channel || 'unknown',
    });

    const response = await axios.post(config.chatUrl, payload, {
      headers: {
        Authorization : `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 90000,
    });

    const choice = response.data?.choices?.[0] || {};
    const text   = choice.message?.content?.trim() || '';

    if (!text) {
      // DeepSeek V4 = model REASONING: token dipakai dulu untuk `reasoning_content`,
      // baru menulis `content`. Bila max_tokens habis di tahap reasoning →
      // finish_reason='length' dan content KOSONG. Beri pesan yang menjelaskan
      // penyebabnya supaya tidak terbaca sebagai "API rusak".
      const reasoningLen = String(choice.message?.reasoning_content || '').length;
      const finish       = choice.finish_reason || 'unknown';
      if (finish === 'length' && reasoningLen > 0) {
        throw new Error(
          `DeepSeek kehabisan token saat reasoning (finish_reason=length, reasoning=${reasoningLen} char, ` +
          `max_tokens=${payload.max_tokens}). Naikkan DEEPSEEK_MAX_TOKENS di backend/.env.`
        );
      }
      throw new Error(`DeepSeek response is empty or cannot be parsed (finish_reason=${finish}).`);
    }
    return text;
  } catch (error) {
    throw normalizeDeepSeekError(error);
  }
}

async function generateDeepSeekContactReply(contactPayload) {
  return callDeepSeekChatAPI(buildContactReplyPrompt(contactPayload, 'deepseek'), {
    metadata: { source: 'contact_form', channel: 'website_contact', provider: 'deepseek' },
  });
}

async function generateDeepSeekChatbotReply(session, history, userMessage, propertyContext = '') {
  return callDeepSeekChatAPI(buildChatbotReplyPrompt(session, history, userMessage, propertyContext, 'deepseek'), {
    metadata: { source: 'floating_chatbot', channel: 'website_chatbot', sessionId: String(session.id || ''), provider: 'deepseek' },
  });
}

async function generateDeepSeekWhatsappReply(session, history, userMessage, propertyContext = '', extraContext = {}) {
  return callDeepSeekChatAPI(buildWhatsappReplyPrompt(session, history, userMessage, propertyContext, 'deepseek', extraContext), {
    metadata: { source: _waSource(), channel: 'whatsapp', sessionId: String(session.id || ''), provider: 'deepseek' },
  });
}

function checkDeepSeekConfig() {
  const config = getDeepSeekConfig();
  return {
    provider    : 'deepseek',
    hasApiKey   : config.hasApiKey,
    model       : config.model,
    maxTokens   : config.maxTokens,
    temperature : config.temperature,
    topP        : config.topP,
    baseUrl     : config.baseUrl,
    skillLoaded : Boolean(getProjectSkillInstruction('deepseek')),
  };
}

module.exports = {
  getDeepSeekConfig,
  callDeepSeekChatAPI,
  generateDeepSeekContactReply,
  generateDeepSeekChatbotReply,
  generateDeepSeekWhatsappReply,
  checkDeepSeekConfig,
};

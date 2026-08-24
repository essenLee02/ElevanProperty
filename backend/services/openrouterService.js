const axios = require('axios');
const {
  getProjectSkillInstruction,
  buildContactReplyPrompt,
  buildChatbotReplyPrompt,
  buildWhatsappReplyPrompt,
} = require('./aiPromptBuilderService');
const { sanitizeEnvValue } = require('./openaiService');

// Resolve WhatsApp source label from MESSAGE_TERMINAL env — pola identik
// dengan provider lain (kimiService.js dst.), lihat catatan di sana.
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

function getOpenRouterConfig() {
  const apiKey      = sanitizeEnvValue(process.env.OPENROUTER_API_KEY  || '');
  const rawModel    = sanitizeEnvValue(process.env.OPENROUTER_MODEL    || '').split('#')[0].trim();
  const rawBaseUrl  = sanitizeEnvValue(process.env.OPENROUTER_BASE_URL || '').split('#')[0].trim();
  const maxTokens   = _clamp(process.env.OPENROUTER_MAX_TOKENS,  1,   65536, 4096);
  const temperature = _clamp(process.env.OPENROUTER_TEMPERATURE, 0.0, 2.0,   1.0);
  const topP        = _clamp(process.env.OPENROUTER_TOP_P,       0.0, 1.0,   1.0);
  const baseUrl     = rawBaseUrl || 'https://openrouter.ai/api/v1';
  // Header opsional yang direkomendasikan OpenRouter untuk atribusi/ranking di
  // dashboard mereka — TIDAK wajib untuk request berhasil, jadi fail-open bila
  // APP_URL/APP_NAME belum diisi (header ikut kosong, tidak dikirim).
  const siteUrl     = sanitizeEnvValue(process.env.APP_URL  || '');
  const siteName    = sanitizeEnvValue(process.env.APP_NAME || '');

  return {
    apiKey,
    // OpenRouter memakai format "vendor/model" (mis. "openai/gpt-4o-mini").
    // TIDAK ada default hardcode ke satu vendor tertentu — proyek ini sengaja
    // memakai OpenRouter untuk fleksibilitas ganti model tanpa ganti provider.
    model       : rawModel,
    maxTokens,
    temperature,
    topP,
    baseUrl,
    chatUrl     : `${baseUrl}/chat/completions`,
    siteUrl,
    siteName,
    hasApiKey   : !!apiKey,
  };
}

function normalizeOpenRouterError(error) {
  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown OpenRouter API error';

  if (status === 401) {
    const err = new Error('OpenRouter rejected the API key. Please replace OPENROUTER_API_KEY in backend/.env, then restart the backend.');
    err.provider = 'openrouter'; err.status = status; err.fallbackEligible = false;
    return err;
  }

  if (status === 402 || status === 429) {
    const err = new Error(`OpenRouter quota/rate limit/billing: ${apiMessage}`);
    err.provider = 'openrouter'; err.status = status; err.fallbackEligible = true;
    return err;
  }

  // Model salah nama/tidak tersedia untuk akun ini — OpenRouter proxy ratusan
  // model dari banyak vendor sekaligus; ini KESALAHAN KONFIGURASI (bukan
  // gangguan sesaat), tampilkan mencolok sama seperti pola Kimi (M74) supaya
  // tidak diam-diam jatuh ke fallback terus-menerus (kelas bug M46).
  // ⚠️ Regex SENGAJA sempit, BUKAN sekadar /model/i — pelajaran M74 langsung:
  // kimi-k3 pernah menolak parameter top_p dengan pesan "...only 0.95 is
  // allowed for this model", yang mengandung kata "model" tapi SAMA SEKALI
  // bukan soal nama model salah. OpenRouter mem-proxy banyak vendor sekaligus
  // (risiko pesan serupa lebih tinggi) — pola di bawah HANYA cocok frasa yang
  // benar-benar berarti "model ID tidak dikenali/tidak tersedia".
  if ((status === 400 || status === 404) && /not a valid model|no endpoints found|no allowed providers|model not found|unknown model|model.{0,20}(does not exist|not (found|available|recognized))/i.test(apiMessage)) {
    console.error(
      '\n╔════════════════════════════════════════════════════════════════════╗\n' +
      '║  ⛔ OPENROUTER: MODEL TIDAK DIKENALI/TIDAK TERSEDIA                ║\n' +
      '╚════════════════════════════════════════════════════════════════════╝\n' +
      `   Pesan API : ${apiMessage}\n` +
      `   Model kini: ${sanitizeEnvValue(process.env.OPENROUTER_MODEL || '(kosong)')}\n` +
      '   PERBAIKI  : set OPENROUTER_MODEL ke ID valid (format "vendor/model",\n' +
      '               mis. "openai/gpt-4o-mini") di backend/.env, lalu RESTART backend.\n' +
      '               Lihat daftar model di https://openrouter.ai/models\n'
    );
    const err = new Error(`OpenRouter model tidak dikenali/tidak tersedia: ${apiMessage}`);
    err.provider = 'openrouter'; err.status = status; err.fallbackEligible = true;
    err.configError = true;
    return err;
  }

  const err = new Error(`OpenRouter API error${status ? ` (${status})` : ''}: ${apiMessage}`);
  err.provider = 'openrouter'; err.status = status; err.fallbackEligible = false;
  return err;
}

async function callOpenRouterChatAPI(userPrompt, options = {}) {
  const config = getOpenRouterConfig();

  if (!config.apiKey) {
    const err = new Error('OPENROUTER_API_KEY is missing in backend/.env');
    err.provider = 'openrouter'; err.fallbackEligible = false;
    throw err;
  }

  if (!config.model) {
    const err = new Error('OPENROUTER_MODEL is missing in backend/.env (format "vendor/model", e.g. "openai/gpt-4o-mini").');
    err.provider = 'openrouter'; err.fallbackEligible = false;
    throw err;
  }

  const systemPrompt = options.system || getProjectSkillInstruction('openrouter');
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

  const headers = {
    Authorization : `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };
  // Opsional (rekomendasi OpenRouter untuk atribusi di dashboard mereka) —
  // hanya dikirim bila terisi, tidak wajib untuk request berhasil.
  if (config.siteUrl)  headers['HTTP-Referer'] = config.siteUrl;
  if (config.siteName) headers['X-Title']      = config.siteName;

  try {
    console.log('[OPENROUTER REQUEST]', {
      provider   : 'openrouter',
      model      : payload.model,
      max_tokens : payload.max_tokens,
      temperature: payload.temperature,
      top_p      : payload.top_p,
      source     : options.metadata?.source  || 'unknown',
      channel    : options.metadata?.channel || 'unknown',
    });

    const response = await axios.post(config.chatUrl, payload, {
      headers,
      // Pola sama dengan KIMI_TIMEOUT_MS (M126) — OpenRouter mem-proxy ke
      // banyak vendor model dengan latensi yang bisa sangat berbeda-beda;
      // biarkan configurable per .env, bukan hardcode.
      timeout: Number(process.env.OPENROUTER_TIMEOUT_MS || 30000),
    });

    const choice = response.data?.choices?.[0] || {};
    const text   = choice.message?.content?.trim() || '';

    if (!text) {
      const finish = choice.finish_reason || 'unknown';
      if (finish === 'length') {
        throw new Error(
          `OpenRouter kehabisan token sebelum selesai menulis (finish_reason=length, ` +
          `max_tokens=${payload.max_tokens}). Naikkan OPENROUTER_MAX_TOKENS di backend/.env.`
        );
      }
      throw new Error(`OpenRouter response is empty or cannot be parsed (finish_reason=${finish}).`);
    }
    return text;
  } catch (error) {
    throw normalizeOpenRouterError(error);
  }
}

async function generateOpenRouterContactReply(contactPayload) {
  return callOpenRouterChatAPI(buildContactReplyPrompt(contactPayload, 'openrouter'), {
    metadata: { source: 'contact_form', channel: 'website_contact', provider: 'openrouter' },
  });
}

async function generateOpenRouterChatbotReply(session, history, userMessage, propertyContext = '') {
  return callOpenRouterChatAPI(buildChatbotReplyPrompt(session, history, userMessage, propertyContext, 'openrouter'), {
    metadata: { source: 'floating_chatbot', channel: 'website_chatbot', sessionId: String(session.id || ''), provider: 'openrouter' },
  });
}

async function generateOpenRouterWhatsappReply(session, history, userMessage, propertyContext = '', extraContext = {}) {
  return callOpenRouterChatAPI(buildWhatsappReplyPrompt(session, history, userMessage, propertyContext, 'openrouter', extraContext), {
    metadata: { source: _waSource(), channel: 'whatsapp', sessionId: String(session.id || ''), provider: 'openrouter' },
  });
}

function checkOpenRouterConfig() {
  const config = getOpenRouterConfig();
  return {
    provider    : 'openrouter',
    hasApiKey   : config.hasApiKey,
    model       : config.model,
    maxTokens   : config.maxTokens,
    temperature : config.temperature,
    topP        : config.topP,
    baseUrl     : config.baseUrl,
    skillLoaded : Boolean(getProjectSkillInstruction('openrouter')),
  };
}

module.exports = {
  getOpenRouterConfig,
  callOpenRouterChatAPI,
  generateOpenRouterContactReply,
  generateOpenRouterChatbotReply,
  generateOpenRouterWhatsappReply,
  checkOpenRouterConfig,
};

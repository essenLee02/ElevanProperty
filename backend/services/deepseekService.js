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
    // ⛔ TIDAK ADA MODEL PENGGANTI. Versi lama menulis `rawModel ||
    // 'deepseek-v4-flash'`, sehingga DEEPSEEK_MODEL yang kosong/salah ketik
    // diam-diam diganti model LAIN — backend memakai model yang tidak pernah
    // dipilih operator, dan itu baru ketahuan dari tagihan di dashboard
    // provider. Arahan pemilik proyek (3 Sep 2026): backend WAJIB memakai
    // PERSIS model di .env, tidak pernah menyubstitusi.
    // Kalau kosong → gagal LANTANG di callDeepSeek(), jangan menebak.
    model       : rawModel,
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
      '   PERBAIKI  : set DEEPSEEK_MODEL ke salah satu nama yang DIDUKUNG AKUN\n' +
      '               ANDA, lalu RESTART backend. Nama yang didukung berubah\n' +
      '               sewaktu-waktu — JANGAN menyalin dari catatan lama.\n' +
      '               Cek daftar aslinya:\n' +
      '                 curl -s https://api.deepseek.com/models \\\n' +
      '                      -H "Authorization: Bearer $DEEPSEEK_API_KEY"\n' +
      '               (per 3 Sep 2026 akun ini: deepseek-v4-flash,\n' +
      '                deepseek-v4-pro, deepseek-v4-flash-vision-exp)\n' +
      '   ⛔ Backend TIDAK akan menggantikan model ini dengan model lain.\n'
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

  // ⛔ Model kosong = KESALAHAN KONFIGURASI, bukan alasan menebak model lain.
  if (!config.model) {
    const err = new Error('DEEPSEEK_MODEL is missing in backend/.env — set it explicitly; the backend never substitutes another model.');
    err.provider = 'deepseek'; err.fallbackEligible = false; err.configError = true;
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
      // M126: configurable (was hardcoded), same fix pattern as KIMI_TIMEOUT_MS
      // — default unchanged (90000) so unset behavior doesn't shift silently.
      timeout: Number(process.env.DEEPSEEK_TIMEOUT_MS || 90000),
    });

    // ⭐ M177: BUKTIKAN model mana yang BENAR-BENAR melayani panggilan ini.
    // Latar: dashboard DeepSeek mencatat `deepseek-v4-flash` padahal .env
    // berisi `deepseek-chat`. Tanpa baris ini, satu-satunya tempat perbedaan
    // itu terlihat adalah tagihan provider — terlambat dan mahal. `model` di
    // BODY RESPONS adalah nama yang di-resolve server (alias sudah dibuka),
    // jadi selisihnya di sini = jawaban pasti, bukan tebakan.
    const servedModel = response.data?.model;
    if (servedModel && servedModel !== payload.model) {
      console.warn(
        `[DEEPSEEK ⚠️ MODEL MISMATCH] dikirim "${payload.model}" → dilayani "${servedModel}". ` +
        'Nama di .env kemungkinan ALIAS yang di-resolve provider ke model lain; ' +
        'tagihan & dashboard akan memakai nama yang DILAYANI. ' +
        'Set DEEPSEEK_MODEL ke nama yang dilayani bila ingin keduanya sama persis.'
      );
    }

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

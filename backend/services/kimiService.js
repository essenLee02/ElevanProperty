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

function getKimiConfig() {
  const apiKey      = sanitizeEnvValue(process.env.KIMI_API_KEY  || '');
  const rawModel    = sanitizeEnvValue(process.env.KIMI_MODEL    || '').split('#')[0].trim();
  const rawBaseUrl  = sanitizeEnvValue(process.env.KIMI_BASE_URL || '').split('#')[0].trim();
  const maxTokens   = _clamp(process.env.KIMI_MAX_TOKENS,  1,   65536, 4096);
  const temperature = _clamp(process.env.KIMI_TEMPERATURE, 0.0, 2.0,   1.0);
  // ⚠️ kimi-k3 MENOLAK top_p apa pun selain 0.95 (dites langsung ke API:
  // "invalid top_p: only 0.95 is allowed for this model"). Default 0.95, BUKAN
  // 1.0 seperti provider OpenAI-compatible lain — jangan disamakan tanpa tes.
  const topP        = _clamp(process.env.KIMI_TOP_P,       0.0, 1.0,   0.95);
  const baseUrl     = rawBaseUrl || 'https://api.moonshot.ai/v1';

  return {
    apiKey,
    // ⛔ TIDAK ADA MODEL PENGGANTI (arahan pemilik proyek, 3 Sep 2026).
    // Dulu: `rawModel || 'kimi-k3'` — KIMI_MODEL kosong/salah ketik diam-diam
    // diganti model lain, sehingga backend memakai model yang tidak pernah
    // dipilih operator dan itu hanya ketahuan dari tagihan provider.
    model       : rawModel,
    maxTokens,
    temperature,
    topP,
    baseUrl,
    chatUrl     : `${baseUrl}/chat/completions`,
    hasApiKey   : !!apiKey,
  };
}

function normalizeKimiError(error) {
  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown Kimi API error';

  if (status === 401) {
    const err = new Error('Kimi rejected the API key. Please replace KIMI_API_KEY in backend/.env, then restart the backend.');
    err.provider = 'kimi'; err.status = status; err.fallbackEligible = false;
    return err;
  }

  if (status === 402 || status === 429) {
    const err = new Error(`Kimi quota/rate limit: ${apiMessage}`);
    err.provider = 'kimi'; err.status = status; err.fallbackEligible = true;
    return err;
  }

  // Model tidak dikenali/dihentikan/tidak diizinkan untuk akun ini.
  // ⚠️ Moonshot mengembalikan 404 (bukan 400) untuk model yang salah nama ATAU
  // yang API key ini tidak punya akses — "Not found the model X or Permission
  // denied" adalah SATU pesan untuk DUA kemungkinan penyebab berbeda.
  // ⚠️ Regex SENGAJA sempit ("not found"/"does not exist"/"unsupported model"),
  // BUKAN sekadar /model/i — kimi-k3 juga menolak top_p≠0.95 dengan pesan
  // "invalid top_p: only 0.95 is allowed for this model", yang mengandung kata
  // "model" tapi SAMA SEKALI bukan soal nama model. Regex longgar sempat salah
  // mengklasifikasikan error parameter sebagai "model tidak dikenali" (dites
  // langsung ke API sebelum fix ini).
  // Ini KESALAHAN KONFIGURASI, bukan gangguan sesaat — kalau tidak ditampilkan
  // mencolok, sistem akan diam-diam jatuh ke provider berikutnya/Private Agent
  // terus-menerus (sekelas M46 pada DeepSeek).
  if ((status === 400 || status === 404) && /not found the model|model (does not exist|not exist)|unsupported model|model.*not (found|available|recognized)/i.test(apiMessage)) {
    console.error(
      '\n╔════════════════════════════════════════════════════════════════════╗\n' +
      '║  ⛔ KIMI: NAMA MODEL TIDAK DIKENALI — SEMUA CALL AKAN GAGAL       ║\n' +
      '╚════════════════════════════════════════════════════════════════════╝\n' +
      `   Pesan API : ${apiMessage}\n` +
      `   Model kini: ${sanitizeEnvValue(process.env.KIMI_MODEL || '(kosong)')}\n` +
      '   PERBAIKI  : set KIMI_MODEL=kimi-k3 di backend/.env lalu RESTART backend.\n'
    );
    const err = new Error(`Kimi model tidak dikenali: ${apiMessage}`);
    err.provider = 'kimi'; err.status = status; err.fallbackEligible = true;
    err.configError = true;
    return err;
  }

  const err = new Error(`Kimi API error${status ? ` (${status})` : ''}: ${apiMessage}`);
  err.provider = 'kimi'; err.status = status; err.fallbackEligible = false;
  return err;
}

async function callKimiChatAPI(userPrompt, options = {}) {
  const config = getKimiConfig();

  if (!config.apiKey) {
    const err = new Error('KIMI_API_KEY is missing in backend/.env');
    err.provider = 'kimi'; err.fallbackEligible = false;
    throw err;
  }

  // ⛔ Model kosong = KESALAHAN KONFIGURASI, bukan alasan menebak model lain.
  if (!config.model) {
    const err = new Error('KIMI_MODEL is missing in backend/.env — set it explicitly; the backend never substitutes another model.');
    err.provider = 'kimi'; err.fallbackEligible = false; err.configError = true;
    throw err;
  }

  const systemPrompt = options.system || getProjectSkillInstruction('kimi');
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
    console.log('[KIMI REQUEST]', {
      provider   : 'kimi',
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
      // ⚠️ TIMEOUT DIBUAT CONFIGURABLE (produksi Hostinger, 20 Agu 2026).
      // Log produksi berulang:
      //   [KIMI ERROR] "Kimi API error: timeout of 90000ms exceeded"
      // Prompt WhatsApp proyek ini ±67K token; kimi-k2.6/k3 kerap melampaui 90
      // detik untuk beban itu. Dampak ke customer BUKAN sekadar error di log:
      // dengan AI_PRIMARY_PROVIDER=kimi, tiap timeout berarti customer MENUNGGU
      // 90 detik penuh SEBELUM fallback ke Private Agent baru berjalan.
      // Untuk WhatsApp, menunggu 90 detik praktis sama dengan tidak dibalas.
      //
      // Nilai hardcode juga melanggar konvensi proyek ("semua nilai konfigurasi
      // dari .env"). Sekarang: KIMI_TIMEOUT_MS, default tetap 90000 agar
      // perilaku TIDAK berubah diam-diam bagi yang tidak menyetelnya.
      //
      // ⛔ MENAIKKAN timeout BUKAN perbaikan yang benar untuk kasus ini —
      // itu hanya memperpanjang penantian customer. Yang benar salah satu dari:
      //   (a) TURUNKAN (mis. 30000) supaya fallback ke Private Agent cepat, ATAU
      //   (b) kecilkan prompt (§ UKURAN PROMPT — doc selalu-aktif ~67K token), ATAU
      //   (c) pindah AI_PRIMARY_PROVIDER ke provider yang lebih cepat.
      timeout: Number(process.env.KIMI_TIMEOUT_MS || 90000),
    });

    const choice = response.data?.choices?.[0] || {};
    const text   = choice.message?.content?.trim() || '';

    if (!text) {
      const finish = choice.finish_reason || 'unknown';
      if (finish === 'length') {
        throw new Error(
          `Kimi kehabisan token sebelum selesai menulis (finish_reason=length, ` +
          `max_tokens=${payload.max_tokens}). Naikkan KIMI_MAX_TOKENS di backend/.env.`
        );
      }
      throw new Error(`Kimi response is empty or cannot be parsed (finish_reason=${finish}).`);
    }
    return text;
  } catch (error) {
    throw normalizeKimiError(error);
  }
}

async function generateKimiContactReply(contactPayload) {
  return callKimiChatAPI(buildContactReplyPrompt(contactPayload, 'kimi'), {
    metadata: { source: 'contact_form', channel: 'website_contact', provider: 'kimi' },
  });
}

async function generateKimiChatbotReply(session, history, userMessage, propertyContext = '') {
  return callKimiChatAPI(buildChatbotReplyPrompt(session, history, userMessage, propertyContext, 'kimi'), {
    metadata: { source: 'floating_chatbot', channel: 'website_chatbot', sessionId: String(session.id || ''), provider: 'kimi' },
  });
}

async function generateKimiWhatsappReply(session, history, userMessage, propertyContext = '', extraContext = {}) {
  return callKimiChatAPI(buildWhatsappReplyPrompt(session, history, userMessage, propertyContext, 'kimi', extraContext), {
    metadata: { source: _waSource(), channel: 'whatsapp', sessionId: String(session.id || ''), provider: 'kimi' },
  });
}

function checkKimiConfig() {
  const config = getKimiConfig();
  return {
    provider    : 'kimi',
    hasApiKey   : config.hasApiKey,
    model       : config.model,
    maxTokens   : config.maxTokens,
    temperature : config.temperature,
    topP        : config.topP,
    baseUrl     : config.baseUrl,
    skillLoaded : Boolean(getProjectSkillInstruction('kimi')),
  };
}

module.exports = {
  getKimiConfig,
  callKimiChatAPI,
  generateKimiContactReply,
  generateKimiChatbotReply,
  generateKimiWhatsappReply,
  checkKimiConfig,
};

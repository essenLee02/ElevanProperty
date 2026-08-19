/**
 * huggingfaceService.js
 *
 * Provider AI ke-6: Hugging Face Inference Router (router.huggingface.co).
 * OpenAI-compatible, HTTP biasa via axios — pola SAMA PERSIS dengan
 * kimiService.js, ditiru sengaja supaya providerService.js bisa memperlakukan
 * keenam provider secara seragam.
 *
 * ⚠️ KEPUTUSAN PENTING: BUKAN self-hosted vLLM. Permintaan asli menyebut
 * `pip install vllm && vllm serve "Qwen/Qwen3.8-27B"` — itu menjalankan model
 * 20–27B parameter secara LOKAL, butuh GPU besar (biasanya ≥24GB VRAM) dan
 * dukungan Windows native vLLM sangat terbatas. Mesin dev proyek ini TIDAK
 * punya GPU NVIDIA terdeteksi (dicek `nvidia-smi` sebelum menulis modul ini —
 * tidak ada). Menulis kode yang mengasumsikan vLLM lokal akan gagal total di
 * mesin ini dan kemungkinan besar di server produksi yang sama.
 *
 * HF Inference Router adalah endpoint HOSTED, OpenAI-compatible, tanpa GPU
 * lokal — model yang SAMA (gpt-oss-20b, DeepSeek-V4-Flash) tetap terpakai,
 * hanya jalur aksesnya yang disesuaikan agar benar-benar bisa jalan.
 *
 * Model didukung (format wajib "penyedia:provider-slug" dari HF Router):
 *   openai/gpt-oss-20b:groq
 *   deepseek-ai/DeepSeek-V4-Flash-0731:novita
 * Model TANPA sufiks provider (mis. "Qwen/Qwen3.8-27B" polos) TIDAK dijamin
 * tersedia di router — HF Router hanya meneruskan ke provider inferensi pihak
 * ketiga yang benar-benar meng-host model itu. Selalu cek
 * https://huggingface.co/models?inference_provider=... sebelum mengganti.
 */

const axios = require('axios');
const {
  getProjectSkillInstruction,
  buildContactReplyPrompt,
  buildChatbotReplyPrompt,
  buildWhatsappReplyPrompt,
} = require('./aiPromptBuilderService');
const { sanitizeEnvValue } = require('./openaiService');

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

function getHuggingFaceConfig() {
  const apiKey      = sanitizeEnvValue(process.env.HF_TOKEN    || '');
  const rawModel    = sanitizeEnvValue(process.env.HF_MODEL    || '').split('#')[0].trim();
  const rawBaseUrl  = sanitizeEnvValue(process.env.HF_BASE_URL || '').split('#')[0].trim();
  const maxTokens   = _clamp(process.env.HF_MAX_TOKENS,  1,   65536, 4096);
  const temperature = _clamp(process.env.HF_TEMPERATURE, 0.0, 2.0,   1.0);
  const topP        = _clamp(process.env.HF_TOP_P,       0.0, 1.0,   1.0);
  const baseUrl     = rawBaseUrl || 'https://router.huggingface.co/v1';

  return {
    apiKey,
    // Default: gpt-oss-20b via provider Groq (latensi rendah, cocok untuk
    // chat WhatsApp interaktif). deepseek-ai/DeepSeek-V4-Flash-0731:novita
    // adalah alternatif — ganti lewat HF_MODEL, JANGAN hardcode di sini.
    model       : rawModel || 'openai/gpt-oss-20b:groq',
    maxTokens,
    temperature,
    topP,
    baseUrl,
    chatUrl     : `${baseUrl}/chat/completions`,
    hasApiKey   : !!apiKey,
  };
}

function normalizeHuggingFaceError(error) {
  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown Hugging Face API error';

  if (status === 401) {
    const err = new Error('Hugging Face menolak HF_TOKEN. Ganti HF_TOKEN di backend/.env, lalu restart backend.');
    err.provider = 'huggingface'; err.status = status; err.fallbackEligible = false;
    return err;
  }

  // ⚠️ 403 BUKAN token invalid — token-nya SAH tapi tidak punya scope
  // "Inference Providers". Dites langsung ke API (14 Agu 2026, dua model
  // berbeda, hasil identik): "This authentication method does not have
  // sufficient permissions to call Inference Providers on behalf of user X".
  // Beda dari 401 (token salah/kadaluarsa): di sini kredensialnya diterima,
  // otorisasinya yang kurang. Dipisah dari 401 supaya pesan yang ditampilkan
  // ke developer BENAR — "ganti token" tidak menyelesaikan 403, yang perlu
  // adalah mengaktifkan scope di huggingface.co/settings/tokens.
  if (status === 403) {
    console.error(
      '\n╔════════════════════════════════════════════════════════════════════╗\n' +
      '║  ⛔ HUGGING FACE: TOKEN SAH TAPI TANPA IZIN INFERENCE PROVIDERS   ║\n' +
      '╚════════════════════════════════════════════════════════════════════╝\n' +
      `   Pesan API : ${apiMessage}\n` +
      '   PERBAIKI  : buka huggingface.co/settings/tokens → edit token (atau buat\n' +
      '   token BARU) → centang scope "Make calls to Inference Providers" →\n' +
      '   update HF_TOKEN di backend/.env → restart backend.\n'
    );
    const err = new Error(`Hugging Face: token tanpa izin Inference Providers: ${apiMessage}`);
    err.provider = 'huggingface'; err.status = status; err.fallbackEligible = true;
    err.configError = true;
    return err;
  }

  if (status === 402 || status === 429) {
    const err = new Error(`Hugging Face rate limit/kuota: ${apiMessage}`);
    err.provider = 'huggingface'; err.status = status; err.fallbackEligible = true;
    return err;
  }

  // ⚠️ Router HF mengembalikan 404 untuk model yang TIDAK di-host oleh provider
  // manapun (atau sufiks ":provider" salah) — kelas kesalahan konfigurasi yang
  // sama dengan M46 (DeepSeek)/M74 (Kimi): kalau tidak ditampilkan mencolok,
  // sistem diam-diam jatuh terus ke Private Agent tanpa penjelasan.
  if (status === 404 || /model.*not (found|available)|no inference provider/i.test(apiMessage)) {
    console.error(
      '\n╔════════════════════════════════════════════════════════════════════╗\n' +
      '║  ⛔ HUGGING FACE: MODEL TIDAK TERSEDIA DI ROUTER                  ║\n' +
      '╚════════════════════════════════════════════════════════════════════╝\n' +
      `   Pesan API : ${apiMessage}\n` +
      `   Model kini: ${sanitizeEnvValue(process.env.HF_MODEL || '(kosong, pakai default)')}\n` +
      '   PERBAIKI  : model HF Router WAJIB sufiks ":provider" (mis.\n' +
      '   "openai/gpt-oss-20b:groq"). Cek ketersediaan di\n' +
      '   huggingface.co/models?inference_provider=... lalu set HF_MODEL,\n' +
      '   restart backend.\n'
    );
    const err = new Error(`Hugging Face model tidak tersedia: ${apiMessage}`);
    err.provider = 'huggingface'; err.status = status; err.fallbackEligible = true;
    err.configError = true;
    return err;
  }

  const err = new Error(`Hugging Face API error${status ? ` (${status})` : ''}: ${apiMessage}`);
  err.provider = 'huggingface'; err.status = status; err.fallbackEligible = false;
  return err;
}

async function callHuggingFaceChatAPI(userPrompt, options = {}) {
  const config = getHuggingFaceConfig();

  if (!config.apiKey) {
    const err = new Error('HF_TOKEN is missing in backend/.env');
    err.provider = 'huggingface'; err.fallbackEligible = false;
    throw err;
  }

  const systemPrompt = options.system || getProjectSkillInstruction('huggingface');
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
    console.log('[HUGGINGFACE REQUEST]', {
      provider   : 'huggingface',
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
      const finish = choice.finish_reason || 'unknown';
      if (finish === 'length') {
        throw new Error(
          `Hugging Face kehabisan token sebelum selesai menulis (finish_reason=length, ` +
          `max_tokens=${payload.max_tokens}). Naikkan HF_MAX_TOKENS di backend/.env.`
        );
      }
      throw new Error(`Hugging Face response kosong atau tidak bisa di-parse (finish_reason=${finish}).`);
    }
    return text;
  } catch (error) {
    if (error.provider === 'huggingface') throw error; // sudah dinormalisasi (mis. token kosong)
    throw normalizeHuggingFaceError(error);
  }
}

async function generateHuggingFaceContactReply(contactPayload) {
  return callHuggingFaceChatAPI(buildContactReplyPrompt(contactPayload, 'huggingface'), {
    metadata: { source: 'contact_form', channel: 'website_contact', provider: 'huggingface' },
  });
}

async function generateHuggingFaceChatbotReply(session, history, userMessage, propertyContext = '') {
  return callHuggingFaceChatAPI(buildChatbotReplyPrompt(session, history, userMessage, propertyContext, 'huggingface'), {
    metadata: { source: 'floating_chatbot', channel: 'website_chatbot', sessionId: String(session.id || ''), provider: 'huggingface' },
  });
}

async function generateHuggingFaceWhatsappReply(session, history, userMessage, propertyContext = '', extraContext = {}) {
  return callHuggingFaceChatAPI(buildWhatsappReplyPrompt(session, history, userMessage, propertyContext, 'huggingface', extraContext), {
    metadata: { source: _waSource(), channel: 'whatsapp', sessionId: String(session.id || ''), provider: 'huggingface' },
  });
}

function checkHuggingFaceConfig() {
  const config = getHuggingFaceConfig();
  return {
    provider    : 'huggingface',
    hasApiKey   : config.hasApiKey,
    model       : config.model,
    maxTokens   : config.maxTokens,
    temperature : config.temperature,
    topP        : config.topP,
    baseUrl     : config.baseUrl,
    skillLoaded : Boolean(getProjectSkillInstruction('huggingface')),
  };
}

module.exports = {
  getHuggingFaceConfig,
  callHuggingFaceChatAPI,
  generateHuggingFaceContactReply,
  generateHuggingFaceChatbotReply,
  generateHuggingFaceWhatsappReply,
  checkHuggingFaceConfig,
};

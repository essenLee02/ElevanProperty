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

/* ⭐ M203 (16 Sep 2026) — CLAUDE_SKILL_ID: skill dari Claude Platform, BUKAN .md lokal.
 *
 * Pemilik proyek meng-upload zip `skills/elevan-property-assistant` ke
 * platform.claude.com → Skills, lalu menaruh ID-nya di `CLAUDE_SKILL_ID`.
 * Begitu diisi, jalur Claude:
 *   • TIDAK membaca folder AI_SKILL_CALL / skills/*.md sama sekali (system
 *     prompt hanya kalimat dasar + perintah memuat skill);
 *   • mengirim `container.skills[{type:'custom', skill_id, version}]` +
 *     tool `code_execution` — syarat Skills API (skill dibaca Claude di
 *     dalam container lewat code execution);
 *   • referensi perilaku RAG dari .md lokal juga dimatikan
 *     (whatsappAIService → includeSkillReference) supaya tidak ada dua skill
 *     bertengkar dalam satu prompt.
 * Kosong → perilaku lama (system prompt = .md lokal) tidak berubah sedikit pun.
 *
 * Model WAJIB dari daftar kompatibel code execution (mis. claude-haiku-4-5-20251001,
 * claude-sonnet-5, claude-opus-5). Model generasi lama ("claude-3-haiku") ditolak API.
 * Biaya: code execution dihitung per container (min 5 menit), 1.550 jam/bulan gratis.
 */
const CODE_EXEC_MODEL_RE = /^claude-(?:haiku-4-5|sonnet-(?:4-5|4-6|5)|opus-(?:4-5|4-6|4-7|4-8|5)|fable-5|mythos-5)/;

function getClaudeConfig() {
  const apiKey = sanitizeEnvValue(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
  const model = sanitizeEnvValue(process.env.CLAUDE_MODEL);
  const apiVersion = sanitizeEnvValue(process.env.CLAUDE_API_VERSION);
  const maxTokens = Number(process.env.CLAUDE_MAX_TOKENS || 1200);
  const skillId = sanitizeEnvValue(process.env.CLAUDE_SKILL_ID);
  const skillVersion = sanitizeEnvValue(process.env.CLAUDE_SKILL_VERSION) || 'latest';

  return {
    apiKey,
    model,
    apiVersion,
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 1200,
    skillId,
    skillVersion
  };
}

/** true bila CLAUDE_SKILL_ID diisi → Claude memakai skill platform, .md lokal tidak dikirim. */
function claudeUsesPlatformSkill() {
  return Boolean(getClaudeConfig().skillId);
}

// Penanda balasan akhir — Haiku menyisipkan narasi kerja ("Sempurna! Sekarang saya punya…")
// sebelum jawaban walau diminta tidak; teks di luar penanda dibuang (probe hidup 16 Sep 2026).
const REPLY_OPEN = '===REPLY===';
const REPLY_CLOSE = '===END===';

/* System prompt mode skill platform: TIDAK memuat .md lokal. Instruksi memuat
 * skill dibuat eksplisit karena setiap request adalah container baru — tanpa
 * perintah ini model kecil kadang menjawab tanpa membaca SKILL.md dulu. */
function buildPlatformSkillSystemPrompt() {
  return [
    'You are a professional property assistant in Indonesia, speaking for one named human agent.',
    'Your complete behaviour rules live in the custom skill attached to this request (its SKILL.md and docs/*.md).',
    'FIRST read SKILL.md and every docs/*.md of that skill (cat them via code execution), THEN compose the reply and follow them exactly.',
    'Use ONLY the catalog/facts blocks in this request - never invent a name, price, facility, address, availability or certificate.',
    'Output ONLY the final WhatsApp reply text for the customer: no preamble, no notes about the skill, no code, no markdown headings.',
    `Write the final reply between a line ${REPLY_OPEN} and a line ${REPLY_CLOSE}; anything outside those markers is discarded and never reaches the customer.`
  ].join(' ');
}

/* Blok konten Claude: ambil teks SETELAH blok hasil code execution terakhir (teks
 * sebelum itu biasanya "let me read the skill..." — bukan balasan). Tanpa tool
 * result → semua blok teks (perilaku lama). */
function extractClaudeText(data) {
  const content = Array.isArray(data?.content) ? data.content : [];
  let lastToolIdx = -1;
  content.forEach((item, i) => {
    if (item && /_tool_result$/.test(String(item.type || ''))) lastToolIdx = i;
  });
  const text = content
    .slice(lastToolIdx + 1)
    .map((item) => {
      if (!item) return '';
      if (typeof item.text === 'string') return item.text;
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();

  // Mode skill: ambil hanya isi di antara penanda balasan bila ada.
  const open = text.lastIndexOf(REPLY_OPEN);
  if (open >= 0) {
    const body = text.slice(open + REPLY_OPEN.length);
    const close = body.indexOf(REPLY_CLOSE);
    const inner = (close >= 0 ? body.slice(0, close) : body).trim();
    if (inner) return inner;
  }
  return text.replace(new RegExp(`${REPLY_OPEN}|${REPLY_CLOSE}`, 'g'), '').trim();
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

  const useSkill = Boolean(config.skillId) && options.platformSkill !== false;
  const payload = {
    model: options.model || config.model,
    max_tokens: Number(options.max_tokens || config.maxTokens),
    system: useSkill ? buildPlatformSkillSystemPrompt() : (options.system || 'You are a helpful professional property assistant.'),
    messages: [
      {
        role: 'user',
        content: input
      }
    ]
  };

  if (useSkill) {
    if (!CODE_EXEC_MODEL_RE.test(String(payload.model || ''))) {
      const error = new Error(`CLAUDE_MODEL="${payload.model}" tidak mendukung code execution, jadi tidak bisa memakai CLAUDE_SKILL_ID. Pakai claude-haiku-4-5-20251001 / claude-sonnet-5 / claude-opus-5.`);
      error.provider = 'claude';
      throw error;
    }
    payload.container = { skills: [{ type: 'custom', skill_id: config.skillId, version: config.skillVersion }] };
    payload.tools = [{ type: 'code_execution_20250825', name: 'code_execution' }];
  }

  // M126: configurable (was hardcoded), same fix pattern as KIMI_TIMEOUT_MS
  // — default unchanged (90000) so unset behavior doesn't shift silently.
  // M203: mode skill = container + beberapa panggilan bash sebelum menjawab →
  // minimal 120 detik, CLAUDE_TIMEOUT_MS yang lebih pendek tidak dipakai.
  const timeout = Math.max(Number(process.env.CLAUDE_TIMEOUT_MS || 90000), useSkill ? 120000 : 0);
  const headers = {
    'x-api-key': config.apiKey,
    'anthropic-version': config.apiVersion,
    'content-type': 'application/json'
  };

  try {
    console.log('[CLAUDE REQUEST]', {
      provider: 'claude',
      model: payload.model,
      skill: useSkill ? `${config.skillId}@${config.skillVersion} (platform skill, .md lokal TIDAK dikirim)` : 'local .md',
      source: options.metadata?.source || 'unknown',
      channel: options.metadata?.channel || 'unknown'
    });

    let response = await axios.post(CLAUDE_MESSAGES_URL, payload, { headers, timeout });

    // Skill/code execution: server bisa berhenti dengan `pause_turn` (giliran
    // panjang) — lanjutkan dengan mengirim balik konten assistant apa adanya.
    for (let hop = 0; useSkill && response.data?.stop_reason === 'pause_turn' && hop < 3; hop += 1) {
      const cont = {
        ...payload,
        container: { ...payload.container, ...(response.data.container?.id ? { id: response.data.container.id } : {}) },
        messages: [...payload.messages, { role: 'assistant', content: response.data.content }]
      };
      response = await axios.post(CLAUDE_MESSAGES_URL, cont, { headers, timeout });
    }

    if (useSkill) {
      const blocks = Array.isArray(response.data?.content) ? response.data.content : [];
      console.log('[CLAUDE SKILL]', {
        stop_reason: response.data?.stop_reason,
        code_execution_calls: blocks.filter((b) => b && b.type === 'server_tool_use').length,
        container: response.data?.container?.id || null,
        usage: response.data?.usage || null
      });
    }

    const text = extractClaudeText(response.data);
    if (!text) throw new Error('Claude response is empty or cannot be parsed.');
    return text;
  } catch (error) {
    throw normalizeClaudeError(error);
  }
}

async function generateClaudeContactReply(contactPayload) {
  return callClaudeMessagesAPI(buildContactReplyPrompt(contactPayload, 'claude'), {
    system: claudeUsesPlatformSkill() ? undefined : getProjectSkillInstruction('claude'),
    metadata: {
      source: 'contact_form',
      channel: 'website_contact',
      provider: 'claude'
    }
  });
}

async function generateClaudeChatbotReply(session, history, userMessage, propertyContext = '') {
  return callClaudeMessagesAPI(buildChatbotReplyPrompt(session, history, userMessage, propertyContext, 'claude'), {
    system: claudeUsesPlatformSkill() ? undefined : getProjectSkillInstruction('claude', _skillContext(history, userMessage)),
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
    system: claudeUsesPlatformSkill() ? undefined : getProjectSkillInstruction('claude', _skillContext(history, userMessage)),
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
    system: claudeUsesPlatformSkill() ? undefined : getProjectSkillInstruction('claude'),
    metadata: { source: 'intent_detection', channel: 'backend', provider: 'claude' }
  });
}

async function extractPropertyPreferencesWithClaude(message) {
  return callClaudeMessagesAPI(buildPreferenceExtractionPrompt(message, 'claude'), {
    system: claudeUsesPlatformSkill() ? undefined : getProjectSkillInstruction('claude'),
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
    skillId: config.skillId || null,
    skillVersion: config.skillId ? config.skillVersion : null,
    skillSource: config.skillId ? 'claude_platform_skill' : 'local_md',
    skillPromptLoaded: config.skillId ? true : Boolean(getProjectSkillInstruction('claude'))
  };
}

module.exports = {
  getClaudeConfig,
  claudeUsesPlatformSkill,
  buildPlatformSkillSystemPrompt,
  callClaudeMessagesAPI,
  generateClaudeContactReply,
  generateClaudeChatbotReply,
  generateClaudeWhatsappReply,
  detectCustomerIntentWithClaude,
  extractPropertyPreferencesWithClaude,
  checkClaudeConfig,
  extractClaudeText
};

/**
 * secretRedactor.js
 *
 * Menyensor (redact) rahasia/kredensial sebelum disimpan ke database atau ditulis
 * ke log. DILARANG menyimpan API key ke DB (termasuk tabel chat_messages).
 *
 * Sumber kebocoran nyata yang ditangani:
 *   - Customer / AI menempel isi file .env (KEY=VALUE) lewat WhatsApp
 *   - Perintah curl berisi header `x-api-key: sk-ant-...`
 *   - Token provider yang ke-paste mentah (OpenAI sk-..., Anthropic sk-ant-...,
 *     Apify apify_api_..., Google/Fonnte/TimelinesAI/Kirimi key, JWT, dll.)
 *
 * Pemakaian:
 *   const { redactSecrets } = require('./secretRedactor');
 *   const safe = redactSecrets(rawText);
 *
 * Catatan: pola sengaja SPESIFIK (prefix token, header rahasia, assignment
 * KEY=VALUE untuk nama sensitif) supaya obrolan properti normal tidak ikut
 * tersensor. "harga 500 juta", "rumah 3 kamar" dll. tidak akan kena.
 */

'use strict';

const REDACTED = '[REDACTED]';

/**
 * Daftar aturan redaksi. Tiap aturan: { re, replace }.
 * Urutan penting — yang paling spesifik dulu.
 */
const RULES = [
  // ── Token provider dengan prefix khas (paling pasti) ───────────────────────
  // Anthropic / Claude:  sk-ant-api03-xxxx
  { re: /sk-ant-[A-Za-z0-9_-]{8,}/g,                 replace: '[REDACTED_ANTHROPIC_KEY]' },
  // OpenAI (project & legacy): sk-proj-xxxx , sk-xxxx
  { re: /sk-proj-[A-Za-z0-9_-]{8,}/g,                replace: '[REDACTED_CHAT_GPT_KEY]' },
  { re: /\bsk-[A-Za-z0-9]{20,}/g,                    replace: '[REDACTED_CHAT_GPT_KEY]' },
  // Apify: apify_api_xxxx
  { re: /apify_api_[A-Za-z0-9]{10,}/g,               replace: '[REDACTED_APIFY_TOKEN]' },
  // Google API key: AIza....
  { re: /AIza[0-9A-Za-z_-]{20,}/g,                   replace: '[REDACTED_GOOGLE_KEY]' },
  // Slack-style: xoxb-/xoxp-
  { re: /xox[baprs]-[A-Za-z0-9-]{10,}/g,             replace: '[REDACTED_SLACK_TOKEN]' },

  // ── Header rahasia (curl, dsb.) — sensor NILAI-nya saja ────────────────────
  // x-api-key: <token>   /   api-key: <token>   /   apikey: <token>
  { re: /\b(x-api-key|api-key|apikey)\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}["']?/gi,
    replace: '$1: ' + REDACTED },
  // Authorization: Bearer <token>   /   Bearer <token>
  { re: /\b(authorization)\s*[:=]\s*["']?bearer\s+[A-Za-z0-9._-]{8,}["']?/gi,
    replace: '$1: Bearer ' + REDACTED },
  { re: /\bBearer\s+[A-Za-z0-9._-]{12,}/g,           replace: 'Bearer ' + REDACTED },

  // ── JWT (eyJ...) ───────────────────────────────────────────────────────────
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    replace: '[REDACTED_JWT]' },

  // ── Blok private key (Google service account, RSA, dll.) ───────────────────
  { re: /-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/g,
    replace: '[REDACTED_PRIVATE_KEY]' },

  // ── Assignment gaya .env untuk nama variabel SENSITIF ──────────────────────
  // Menangkap: CHAT_GPT_API_KEY=... , ANTHROPIC_API_KEY=... , CLAUDE_API_KEY=... ,
  // *_TOKEN=... , *_SECRET=... , *_PASSWORD=... , DB_PASSWORD=... , dll.
  // Hanya nilai yang disensor; nama variabel dipertahankan agar tetap informatif.
  { re: /^([ \t]*[A-Za-z_][A-Za-z0-9_]*(?:API[_-]?KEY|APIKEY|_KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|PRIVATE_KEY|CLIENT_SECRET|ACCESS_TOKEN|REFRESH_TOKEN))[ \t]*=[ \t]*.+$/gim,
    replace: '$1=' + REDACTED },
  // Bentuk JSON: "api_key": "....", "token": "...." , "secret": "...."
  { re: /("(?:api[_-]?key|apikey|token|secret|password|access[_-]?token|refresh[_-]?token|private[_-]?key)"\s*:\s*)"[^"]+"/gi,
    replace: '$1"' + REDACTED + '"' },
];

/**
 * Sensor semua rahasia dalam sebuah string.
 * @param {*} input
 * @returns {*} string tersensor (atau input apa adanya jika bukan string)
 */
function redactSecrets(input) {
  if (input === null || input === undefined) return input;
  if (typeof input !== 'string') {
    // Non-string (mis. number/boolean) dibiarkan. Object ditangani redactObject.
    return input;
  }
  let out = input;
  for (const { re, replace } of RULES) {
    out = out.replace(re, replace);
  }
  return out;
}

/**
 * Sensor rahasia di dalam object/array secara rekursif (nilai string saja).
 * Berguna untuk metadata sebelum JSON.stringify.
 * @param {*} value
 * @returns {*}
 */
function redactObject(value) {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value))      return value.map(redactObject);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactObject(v);
    return out;
  }
  return value;
}

/**
 * True jika string mengandung indikasi rahasia (untuk logging/deteksi).
 * @param {string} input
 */
function containsSecret(input) {
  if (typeof input !== 'string') return false;
  return RULES.some(({ re }) => {
    re.lastIndex = 0;
    return re.test(input);
  });
}

module.exports = { redactSecrets, redactObject, containsSecret };

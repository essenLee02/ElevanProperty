/**
 * embeddingService.js — Mengubah teks menjadi vektor untuk RAG.
 *
 * DUA MODE, SENGAJA:
 *   1. `openai`  — text-embedding-3-small lewat axios ke /v1/embeddings.
 *                  Memakai CHAT_GPT_API_KEY yang SUDAH ada (nol dependency baru,
 *                  nol kredensial baru). Kualitas semantik penuh.
 *   2. `local`   — "hashing trick" deterministik, TANPA jaringan.
 *                  Dipakai otomatis saat API key tidak ada / API gagal, dan
 *                  dipakai SELALU oleh unit test supaya suite tetap offline
 *                  (49 berkas tes yang ada semuanya berjalan tanpa jaringan —
 *                  menambahkan tes yang butuh internet akan merusak disiplin itu).
 *
 * ⚠️ VEKTOR DARI DUA MODE TIDAK BOLEH DICAMPUR. Dimensi dan ruang vektornya
 * berbeda, sehingga cosine similarity antar-mode tidak bermakna. Setiap vektor
 * membawa `model`-nya; vectorStore WAJIB menolak indeks yang modelnya tidak
 * sama dengan mode aktif (lihat vectorStoreService.assertCompatible).
 *
 * Mode `local` bukan sekadar mock: ia memberi kemiripan LEKSIKAL yang nyata
 * (tumpang tindih kata), jadi tetap berguna sebagai fallback darurat saat
 * OpenAI down — RAG melemah, tapi tidak mati.
 */

'use strict';

const axios = require('axios');
const crypto = require('crypto');

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

const OPENAI_MODEL = String(process.env.RAG_EMBEDDING_MODEL || 'text-embedding-3-small').trim();
const LOCAL_DIMENSIONS = Number(process.env.RAG_LOCAL_EMBEDDING_DIMS || 512);
const REQUEST_TIMEOUT_MS = Number(process.env.RAG_EMBEDDING_TIMEOUT_MS || 20000);
const MAX_BATCH = Number(process.env.RAG_EMBEDDING_BATCH || 64);

/** Cache in-process: teks identik tidak pernah di-embed dua kali dalam satu proses. */
const _cache = new Map();
const MAX_CACHE_ENTRIES = Number(process.env.RAG_EMBEDDING_CACHE_ENTRIES || 5000);

function sanitizeEnvValue(value) {
  if (value == null) return '';
  return String(value).trim().replace(/^["']|["']$/g, '');
}

/**
 * Mode embedding yang aktif.
 * `RAG_EMBEDDING_MODE=local` memaksa mode lokal (dipakai tes & pengembangan offline).
 */
function getEmbeddingMode() {
  const forced = sanitizeEnvValue(process.env.RAG_EMBEDDING_MODE).toLowerCase();
  if (forced === 'local' || forced === 'openai') return forced;

  const apiKey = sanitizeEnvValue(process.env.CHAT_GPT_API_KEY);
  return apiKey.startsWith('sk-') ? 'openai' : 'local';
}

/** Nama model aktif — ikut disimpan bersama setiap vektor. */
function getActiveModelName() {
  return getEmbeddingMode() === 'openai' ? OPENAI_MODEL : `local-hash-${LOCAL_DIMENSIONS}`;
}

// ─── Mode LOCAL: feature hashing ──────────────────────────────────────────────

/** Tokenisasi sederhana yang ramah Bahasa Indonesia (huruf+angka, lowercase). */
function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9À-ɏ]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 1);
}

/** Hash stabil token → indeks dimensi + tanda (+1/-1), teknik hashing trick. */
function hashToken(token, dimensions) {
  const digest = crypto.createHash('md5').update(token).digest();
  const index = digest.readUInt32BE(0) % dimensions;
  const sign = (digest[4] & 1) === 0 ? 1 : -1;
  return { index, sign };
}

/**
 * Embedding deterministik tanpa jaringan.
 * Memakai bag-of-words + hashing trick + normalisasi L2, sehingga dua teks
 * dengan kata yang banyak beririsan menghasilkan cosine tinggi.
 */
function embedLocal(text, dimensions = LOCAL_DIMENSIONS) {
  const vector = new Array(dimensions).fill(0);
  const tokens = tokenize(text);

  if (tokens.length === 0) return vector;

  // Sub-linear term frequency meredam kata yang muncul sangat sering.
  const counts = new Map();
  tokens.forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));

  counts.forEach((count, token) => {
    const { index, sign } = hashToken(token, dimensions);
    vector[index] += sign * (1 + Math.log(count));
  });

  return normalize(vector);
}

// ─── Mode OPENAI ──────────────────────────────────────────────────────────────

async function embedBatchOpenAI(texts) {
  const apiKey = sanitizeEnvValue(process.env.CHAT_GPT_API_KEY);
  if (!apiKey) throw new Error('CHAT_GPT_API_KEY tidak tersedia untuk embedding.');

  const response = await axios.post(
    OPENAI_EMBEDDINGS_URL,
    { model: OPENAI_MODEL, input: texts },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: REQUEST_TIMEOUT_MS
    }
  );

  const data = response?.data?.data;
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new Error(`Balasan embedding tidak sesuai: ${data?.length} vektor untuk ${texts.length} teks.`);
  }

  // API tidak menjamin urutan; `index` adalah sumber kebenarannya.
  const ordered = new Array(texts.length);
  data.forEach((item) => { ordered[item.index] = normalize(item.embedding); });

  return ordered;
}

// ─── Operasi vektor ───────────────────────────────────────────────────────────

/** Normalisasi L2 — setelah ini cosine similarity = dot product biasa. */
function normalize(vector) {
  let sumSquares = 0;
  for (let i = 0; i < vector.length; i += 1) sumSquares += vector[i] * vector[i];

  const magnitude = Math.sqrt(sumSquares);
  if (magnitude === 0) return vector.slice();

  const result = new Array(vector.length);
  for (let i = 0; i < vector.length; i += 1) result[i] = vector[i] / magnitude;
  return result;
}

/**
 * Cosine similarity. Karena semua vektor SUDAH dinormalisasi saat dibuat,
 * ini cukup dot product — hemat satu akar kuadrat per perbandingan.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

// ─── API publik ───────────────────────────────────────────────────────────────

function cacheKey(text) {
  return `${getActiveModelName()}::${crypto.createHash('sha1').update(text).digest('hex')}`;
}

/**
 * Meng-embed banyak teks sekaligus.
 * FAIL-OPEN: bila OpenAI gagal, otomatis turun ke mode lokal dan mencatat
 * peringatan — RAG jadi lebih lemah, tapi percakapan TIDAK pernah putus.
 *
 * @param {string[]} texts
 * @returns {Promise<{vectors:number[][], model:string, degraded:boolean}>}
 */
async function embedTexts(texts) {
  const list = (Array.isArray(texts) ? texts : [texts]).map((t) => String(t || '').trim());
  if (list.length === 0) return { vectors: [], model: getActiveModelName(), degraded: false };

  const mode = getEmbeddingMode();

  if (mode === 'local') {
    return {
      vectors: list.map((text) => embedLocal(text)),
      model: getActiveModelName(),
      degraded: false
    };
  }

  const vectors = new Array(list.length);
  const pending = [];

  list.forEach((text, i) => {
    const hit = _cache.get(cacheKey(text));
    if (hit) vectors[i] = hit;
    else pending.push({ text, i });
  });

  if (pending.length === 0) {
    return { vectors, model: OPENAI_MODEL, degraded: false };
  }

  try {
    for (let start = 0; start < pending.length; start += MAX_BATCH) {
      const slice = pending.slice(start, start + MAX_BATCH);
      const embedded = await embedBatchOpenAI(slice.map((item) => item.text));

      slice.forEach((item, k) => {
        vectors[item.i] = embedded[k];
        if (_cache.size < MAX_CACHE_ENTRIES) _cache.set(cacheKey(item.text), embedded[k]);
      });
    }

    return { vectors, model: OPENAI_MODEL, degraded: false };
  } catch (error) {
    console.warn('[RAG EMBEDDING] OpenAI gagal, turun ke mode lokal:', error.message);
    return {
      vectors: list.map((text) => embedLocal(text)),
      model: `local-hash-${LOCAL_DIMENSIONS}`,
      degraded: true
    };
  }
}

/** Meng-embed satu teks. */
async function embedText(text) {
  const { vectors, model, degraded } = await embedTexts([text]);
  return { vector: vectors[0], model, degraded };
}

module.exports = {
  embedText,
  embedTexts,
  cosineSimilarity,
  normalize,
  getEmbeddingMode,
  getActiveModelName,
  // diekspor untuk pengujian unit
  embedLocal,
  tokenize,
  LOCAL_DIMENSIONS
};

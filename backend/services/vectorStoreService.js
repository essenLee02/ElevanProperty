/**
 * vectorStoreService.js — Indeks vektor in-memory + persistensi berkas.
 *
 * KENAPA BUKAN VECTOR DATABASE (Chroma/FAISS/Pinecone):
 * Korpus proyek ini kecil dan terbatas — ±336 properti + ±600 chunk skill docs
 * + korpus pengetahuan jual-beli ≈ 1.000–1.500 vektor. Cosine similarity atas
 * 1.500 vektor di JavaScript memakan <2 ms. Menambah vector DB berarti menambah
 * dependency, proses baru, mode kegagalan baru, dan satu lagi sumber kebenaran —
 * semuanya bertentangan dengan prinsip proyek ini (§9 no.4 "satu sumber
 * kebenaran per konsep"). Bila korpus kelak menembus ~100k vektor, barulah
 * pindah ke pgvector/Qdrant; sampai saat itu ini berlebihan.
 *
 * PERSISTENSI: berkas JSON di `backend/data/`, BUKAN tabel MySQL baru.
 * Alasan: menambah model Sequelize menyentuh urutan boot yang rapuh
 * (ensureRequiredDatabaseColumns() HARUS sebelum sequelize.sync()) — risiko
 * boot gagal jauh lebih besar daripada manfaatnya untuk data yang bisa
 * dibangun ulang kapan saja dari sumbernya (berkas .md dan tabel properties).
 *
 * ⚠️ ISOLASI AGENT: chunk properti WAJIB membawa metadata.user_id dan
 * WAJIB difilter saat pencarian. Katalog di proyek ini selalu di-scope ke
 * Property.user_id; indeks vektor yang bocor lintas-agent akan membuat agent A
 * merekomendasikan properti milik agent B.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { cosineSimilarity } = require('./embeddingService');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const INDEX_FILE = path.join(DATA_DIR, 'rag-index.json');
const INDEX_VERSION = 1;

/**
 * Struktur in-memory:
 *   _store[namespace] = { model, entries: [{ id, text, vector, metadata }] }
 */
let _store = Object.create(null);
let _loaded = false;

function emptyNamespace(model) {
  return { model: model || null, entries: [] };
}

function getNamespace(namespace) {
  if (!_store[namespace]) _store[namespace] = emptyNamespace(null);
  return _store[namespace];
}

/**
 * Menjaga agar vektor dari model berbeda tidak pernah dibandingkan.
 * Cosine antar ruang vektor berbeda menghasilkan angka yang terlihat valid
 * tapi tidak bermakna — kelas bug yang senyap dan sangat sulit dilacak.
 */
function assertCompatible(namespace, model) {
  const bucket = getNamespace(namespace);
  if (bucket.entries.length === 0) {
    bucket.model = model;
    return true;
  }
  return bucket.model === model;
}

/**
 * Menambahkan dokumen ke sebuah namespace.
 * Bila model berbeda dengan isi indeks saat ini, namespace DIKOSONGKAN dulu —
 * lebih baik indeks kosong (RAG mati, fail-open ke perilaku lama) daripada
 * indeks tercampur yang memberi hasil ngawur.
 *
 * @param {string} namespace
 * @param {Array<{id?:string, text:string, vector:number[], metadata?:object}>} documents
 * @param {string} model  nama model embedding yang menghasilkan vektor
 */
function addDocuments(namespace, documents, model) {
  if (!Array.isArray(documents) || documents.length === 0) return 0;

  if (!assertCompatible(namespace, model)) {
    console.warn(
      `[RAG STORE] Model berubah untuk namespace "${namespace}" `
      + `(${getNamespace(namespace).model} → ${model}). Indeks lama dibuang.`
    );
    _store[namespace] = emptyNamespace(model);
  }

  const bucket = getNamespace(namespace);
  bucket.model = model;

  documents.forEach((doc, i) => {
    if (!doc || !Array.isArray(doc.vector) || doc.vector.length === 0) return;
    bucket.entries.push({
      id: doc.id || `${namespace}:${bucket.entries.length + i}`,
      text: String(doc.text || ''),
      vector: doc.vector,
      metadata: doc.metadata || {}
    });
  });

  return bucket.entries.length;
}

/** Mengosongkan satu namespace (dipakai saat indeks dibangun ulang). */
function clearNamespace(namespace) {
  _store[namespace] = emptyNamespace(null);
}

/**
 * Maximal Marginal Relevance — memilih hasil yang RELEVAN sekaligus BERAGAM.
 *
 * Tanpa MMR, pencarian "fasilitas apartemen" gampang mengembalikan 5 potongan
 * yang isinya nyaris sama dan memboroskan anggaran token tanpa menambah
 * informasi. MMR menghukum kandidat yang terlalu mirip dengan yang sudah dipilih.
 *
 * lambda = 1 → murni relevansi · lambda = 0 → murni keberagaman.
 */
function maximalMarginalRelevance(scored, topK, lambda) {
  const selected = [];
  const pool = scored.slice();

  while (selected.length < topK && pool.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < pool.length; i += 1) {
      const candidate = pool[i];

      let maxSimilarityToSelected = 0;
      for (let j = 0; j < selected.length; j += 1) {
        const similarity = cosineSimilarity(candidate.entry.vector, selected[j].entry.vector);
        if (similarity > maxSimilarityToSelected) maxSimilarityToSelected = similarity;
      }

      const mmrScore = (lambda * candidate.score) - ((1 - lambda) * maxSimilarityToSelected);
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }

    selected.push(pool[bestIndex]);
    pool.splice(bestIndex, 1);
  }

  return selected;
}

/**
 * Mencari chunk paling relevan dalam sebuah namespace.
 *
 * @param {string} namespace
 * @param {number[]} queryVector
 * @param {object} [options]
 * @param {number} [options.topK=5]
 * @param {number} [options.minScore=0.15]  ambang relevansi; di bawah ini dibuang
 * @param {number} [options.mmrLambda=0.7]  0..1, lihat maximalMarginalRelevance
 * @param {function} [options.filter]       (metadata) => boolean — WAJIB dipakai
 *                                          untuk scoping per-agent pada properti
 * @returns {Array<{id:string, text:string, score:number, metadata:object}>}
 */
function search(namespace, queryVector, options = {}) {
  const {
    topK = 5,
    minScore = 0.15,
    mmrLambda = 0.7,
    filter = null
  } = options;

  const bucket = _store[namespace];
  if (!bucket || bucket.entries.length === 0) return [];
  if (!Array.isArray(queryVector) || queryVector.length === 0) return [];

  const scored = [];

  for (let i = 0; i < bucket.entries.length; i += 1) {
    const entry = bucket.entries[i];

    if (entry.vector.length !== queryVector.length) continue;      // beda model → lewati
    if (filter && !filter(entry.metadata)) continue;                // scoping agent

    const score = cosineSimilarity(queryVector, entry.vector);
    if (score >= minScore) scored.push({ entry, score });
  }

  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);

  // MMR hanya perlu dijalankan atas kandidat teratas — jauh lebih murah
  // daripada atas seluruh indeks, dengan hasil praktis sama.
  const candidatePool = scored.slice(0, Math.max(topK * 4, topK));
  const chosen = mmrLambda >= 1
    ? candidatePool.slice(0, topK)
    : maximalMarginalRelevance(candidatePool, topK, mmrLambda);

  return chosen.map(({ entry, score }) => ({
    id: entry.id,
    text: entry.text,
    score,
    metadata: entry.metadata
  }));
}

// ─── Persistensi ──────────────────────────────────────────────────────────────

/**
 * Menyimpan indeks ke disk.
 * Vektor disimpan sebagai array angka biasa (JSON) — untuk ±1.500 vektor
 * berkasnya beberapa MB, masih sangat wajar dan mudah di-inspeksi manusia.
 */
function saveToDisk(filePath = INDEX_FILE) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const payload = {
      version: INDEX_VERSION,
      builtAt: new Date().toISOString(),
      namespaces: _store
    };

    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
    return true;
  } catch (error) {
    console.error('[RAG STORE] Gagal menyimpan indeks:', error.message);
    return false;
  }
}

/**
 * Memuat indeks dari disk. FAIL-OPEN: berkas hilang/rusak → indeks kosong,
 * dan pemanggil otomatis kembali ke perilaku lama (muat semua skill docs).
 */
function loadFromDisk(filePath = INDEX_FILE) {
  try {
    if (!fs.existsSync(filePath)) {
      _loaded = true;
      return false;
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!raw || raw.version !== INDEX_VERSION || !raw.namespaces) {
      console.warn('[RAG STORE] Versi indeks tidak cocok — indeks diabaikan, jalankan ulang build.');
      _loaded = true;
      return false;
    }

    _store = raw.namespaces;
    _loaded = true;
    return true;
  } catch (error) {
    console.error('[RAG STORE] Gagal memuat indeks:', error.message);
    _store = Object.create(null);
    _loaded = true;
    return false;
  }
}

function ensureLoaded() {
  if (!_loaded) loadFromDisk();
  return _loaded;
}

function isReady(namespace) {
  ensureLoaded();
  const bucket = _store[namespace];
  return Boolean(bucket && bucket.entries.length > 0);
}

function getStats() {
  ensureLoaded();
  const namespaces = {};

  Object.keys(_store).forEach((key) => {
    namespaces[key] = {
      model: _store[key].model,
      count: _store[key].entries.length,
      dimensions: _store[key].entries[0]?.vector?.length || 0
    };
  });

  return { indexFile: INDEX_FILE, version: INDEX_VERSION, namespaces };
}

/**
 * Reset total — hanya dipakai oleh tes.
 *
 * ⚠️ `_loaded` sengaja di-set TRUE, bukan false. Bila dibiarkan false,
 * pemanggilan berikutnya akan memicu ensureLoaded() → loadFromDisk(), yang
 * MENIMPA seluruh isi in-memory dengan indeks nyata di disk. Akibatnya data
 * yang baru saja dipasang tes lenyap tanpa error — kegagalan senyap yang
 * membingungkan. Reset berarti "mulai dari kosong dan JANGAN sentuh disk".
 */
function _resetForTests() {
  _store = Object.create(null);
  _loaded = true;
}

module.exports = {
  addDocuments,
  clearNamespace,
  search,
  saveToDisk,
  loadFromDisk,
  ensureLoaded,
  isReady,
  getStats,
  assertCompatible,
  maximalMarginalRelevance,
  INDEX_FILE,
  DATA_DIR,
  _resetForTests
};

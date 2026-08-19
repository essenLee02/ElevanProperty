/**
 * masterDataRagService.js — RAG atas MASTER DATA, tanpa embedding (M118).
 *
 * ⚠️ KENAPA TIDAK MEMAKAI embedJs / LangChain / Ollama / Couchbase.
 * Enam repo rujukan (embed-js, RAG-Document-Nodejs, embedJs, LLM-Nodejs-RAG-
 * chatbot, RagXOllama, vector-search-nodejs) semuanya bertumpu pada SALAH SATU
 * dari: vector database terpisah, atau model embedding. Di lingkungan ini
 * keduanya TIDAK tersedia:
 *   • kredit OpenAI habis → setiap panggilan /v1/embeddings dijawab HTTP 429
 *     (terlihat di log produksi 17 Agu 2026 23:18);
 *   • tidak ada GPU untuk model embedding lokal.
 * Menambah framework berarti menambah dependensi berat untuk RAG yang justru
 * TIDAK BISA JALAN hari ini. Yang diambil dari repo-repo itu adalah POLANYA:
 * dokumen per-entitas yang terstruktur + retrieval hibrida. Skornya di sini
 * LEKSIKAL murni, jadi tetap bekerja saat kredit nol.
 *
 * ⚠️ MASALAH YANG DIPERBAIKI. Indeks RAG Node.js hanya memuat dua namespace —
 * `property_knowledge` (38) dan `skill_docs` (131). TIDAK ADA master data sama
 * sekali, sehingga AI tidak pernah tahu isi tabel `cities`, `facilities`,
 * `locations`, `provinces`, `countries`. Akibatnya pertanyaan "ada di kota
 * mana saja?" atau "fasilitasnya apa saja?" dijawab dari ingatan model —
 * sumber jawaban mengarang yang sudah berkali-kali dilaporkan.
 *
 * ⚠️ CHAT MALAS & SINGKATAN ditangani DI SISI KUERI, bukan dengan menambah
 * baris indeks. "sby" → "surabaya", "rmh" → "rumah", "kt" → "kamar tidur"
 * lewat `expandAbbreviations()` yang SUDAH ada. Menyalin daftar singkatan ke
 * modul ini akan membuat dua kamus yang lambat laun berbeda isi.
 *
 * MURNI & DAPAT DIUJI: seluruh fungsi menerima ARRAY BARIS biasa, bukan model
 * Sequelize, sehingga bisa diuji tanpa database sama sekali.
 */

'use strict';

const { expandAbbreviations } = require('../utils/lazyChatNormalizer');

/** Kata yang terlalu umum untuk membedakan dokumen. */
const STOPWORDS = new Set([
  'yang', 'untuk', 'dengan', 'dari', 'dan', 'atau', 'di', 'ke', 'ada', 'apa',
  'saja', 'aja', 'saya', 'mau', 'cari', 'kak', 'the', 'for', 'with', 'and',
  'are', 'you', 'what', 'any', 'have', 'this', 'that', 'ini', 'itu',
]);

/**
 * Pecah teks jadi token yang bisa dibandingkan.
 * Singkatan DIURAI dulu supaya "sby" dan "surabaya" bertemu di ruang yang sama.
 */
function tokenize(text) {
  return String(expandAbbreviations(String(text || '').toLowerCase()) || '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Satu dokumen master data — bentuk seragam apa pun tabel asalnya. */
function makeDoc({ kind, id, title, text, metadata = {} }) {
  return Object.freeze({
    id: `${kind}:${id}`,
    kind,
    title: String(title || '').trim(),
    text: String(text || '').trim(),
    metadata: Object.freeze({ ...metadata }),
  });
}

/**
 * Bangun dokumen dari baris master data.
 *
 * Tiap entitas ditulis sebagai KALIMAT, bukan potongan kolom. Model membaca
 * kalimat jauh lebih baik daripada `{"name":"Surabaya","province_id":11}`, dan
 * kalimat juga membawa hierarki (kota → provinsi → negara) yang kalau tidak
 * ditulis harus ditebak model.
 *
 * @param {object} rows
 * @param {Array} [rows.countries]  {country_id,name}
 * @param {Array} [rows.provinces]  {province_id,country_id,name}
 * @param {Array} [rows.cities]     {city_id,province_id,country_id,name}
 * @param {Array} [rows.locations]  {location_id,name}
 * @param {Array} [rows.facilities] {facility_id,name,description,keywords}
 * @returns {Array} dokumen siap-cari
 */
function buildMasterDataDocuments(rows = {}) {
  const countries = rows.countries || [];
  const provinces = rows.provinces || [];
  const cities = rows.cities || [];
  const locations = rows.locations || [];
  const facilities = rows.facilities || [];

  const countryById = new Map(countries.map((c) => [c.country_id, c.name]));
  const provinceById = new Map(provinces.map((p) => [p.province_id, p]));

  const docs = [];

  for (const c of countries) {
    docs.push(makeDoc({
      kind: 'country', id: c.country_id, title: c.name,
      text: `${c.name} adalah negara yang dilayani. Country: ${c.name}.`,
      metadata: { name: c.name },
    }));
  }

  for (const p of provinces) {
    const country = countryById.get(p.country_id) || '';
    docs.push(makeDoc({
      kind: 'province', id: p.province_id, title: p.name,
      text: `${p.name} adalah provinsi${country ? ` di ${country}` : ''}. `
          + `Province: ${p.name}${country ? `, country: ${country}` : ''}.`,
      metadata: { name: p.name, country },
    }));
  }

  for (const c of cities) {
    const prov = provinceById.get(c.province_id);
    const provName = prov ? prov.name : '';
    const country = countryById.get(c.country_id)
      || (prov ? countryById.get(prov.country_id) : '') || '';
    // Hierarki ditulis lengkap: "Surabaya, Jawa Timur, Indonesia" membuat
    // pencarian "properti di Jawa Timur" ikut menemukan kotanya.
    const trail = [c.name, provName, country].filter(Boolean).join(', ');
    docs.push(makeDoc({
      kind: 'city', id: c.city_id, title: c.name,
      text: `${c.name} adalah kota yang dilayani (${trail}). City: ${trail}.`,
      metadata: { name: c.name, province: provName, country },
    }));
  }

  for (const l of locations) {
    docs.push(makeDoc({
      kind: 'location', id: l.location_id, title: l.name,
      text: `${l.name} adalah area/lokasi yang dikenal. Area: ${l.name}.`,
      metadata: { name: l.name },
    }));
  }

  for (const f of facilities) {
    // `keywords` di tabel facilities memang disediakan untuk pencocokan
    // sinonim — dipakai apa adanya supaya kamus tidak digandakan di kode.
    const kw = String(f.keywords || '').trim();
    const desc = String(f.description || '').trim();
    docs.push(makeDoc({
      kind: 'facility', id: f.facility_id, title: f.name,
      text: [`${f.name} adalah fasilitas properti.`, desc, kw && `Kata kunci: ${kw}.`,
        `Facility: ${f.name}.`].filter(Boolean).join(' '),
      metadata: { name: f.name, keywords: kw },
    }));
  }

  return docs;
}

/**
 * Skor leksikal ala BM25 yang disederhanakan.
 *
 * Tanpa embedding, pembeda utamanya adalah IDF: kata langka ("kondotel")
 * jauh lebih menentukan daripada kata umum ("properti"). Panjang dokumen
 * dinormalkan supaya deskripsi fasilitas yang panjang tidak otomatis menang.
 */
function scoreDocuments(queryTokens, docs, docTokensCache) {
  const N = docs.length || 1;
  const df = new Map();
  for (const tokens of docTokensCache) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) || 0) + 1);
  }

  const avgLen = docTokensCache.reduce((s, t) => s + t.length, 0) / N || 1;
  const k1 = 1.2;
  const b = 0.75;

  return docs.map((doc, i) => {
    const tokens = docTokensCache[i];
    const len = tokens.length || 1;
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

    let score = 0;
    for (const q of queryTokens) {
      const f = tf.get(q);
      if (!f) continue;
      const n = df.get(q) || 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (len / avgLen))));
    }
    return { doc, score };
  });
}

/**
 * Cari dokumen master data yang paling relevan dengan pesan customer.
 *
 * @param {string} query pesan customer (boleh penuh singkatan)
 * @param {Array}  docs  hasil buildMasterDataDocuments()
 * @param {object} [opts]
 * @param {number} [opts.limit=5]
 * @param {number} [opts.minScore=0.1]
 * @param {string} [opts.kind] batasi ke satu jenis ('city'|'facility'|…)
 * @returns {Array<{doc:object, score:number}>} urut skor menurun
 */
function searchMasterData(query, docs = [], opts = {}) {
  const { limit = 5, minScore = 0.1, kind = '' } = opts;
  const pool = kind ? docs.filter((d) => d.kind === kind) : docs;
  const qTokens = tokenize(query);
  if (!qTokens.length || !pool.length) return [];

  const cache = pool.map((d) => tokenize(`${d.title} ${d.text}`));
  return scoreDocuments(qTokens, pool, cache)
    .filter((r) => r.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Blok teks siap tempel ke prompt.
 *
 * ⚠️ Ditandai tegas sebagai DATA NYATA dari database. Tanpa penanda itu model
 * memperlakukannya sebagai saran dan tetap mengarang nama kota/fasilitas —
 * kegagalan yang sudah berulang di proyek ini.
 */
function formatMasterDataBlock(hits = []) {
  if (!hits.length) return '';
  const lines = ['── DATA MASTER (dari database, BUKAN karangan) ──'];
  for (const { doc } of hits) lines.push(`• ${doc.text}`);
  lines.push('Gunakan HANYA nama yang tercantum di atas bila menyebut kota, area, atau fasilitas.');
  return lines.join('\n');
}

module.exports = {
  STOPWORDS,
  tokenize,
  buildMasterDataDocuments,
  searchMasterData,
  formatMasterDataBlock,
};

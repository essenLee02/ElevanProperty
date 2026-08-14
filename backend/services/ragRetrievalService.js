/**
 * ragRetrievalService.js — Lapisan pengambilan (retrieval) untuk prompt AI.
 *
 * PERAN DALAM ARSITEKTUR (baca ini sebelum mengubah apa pun):
 * RAG di proyek ini MENAMBAH GROUNDING, ia TIDAK PERNAH menggantikan aturan
 * perilaku inti. Alasannya terukur: mode embedding lokal (fallback saat API
 * mati) hanya menangkap kemiripan leksikal, sehingga chunk yang benar kerap
 * berada di peringkat 2–3, bukan 1. Bila aturan seperti "jangan pernah
 * mengarang nama area" (M84) atau "state block satu-satunya sumber kebenaran"
 * (M62) bergantung pada retrieval, maka SATU kali meleset = regresi bug yang
 * sudah susah payah diperbaiki.
 *
 * Karena itu pembagiannya TEGAS:
 *   SELALU DIMUAT (tidak pernah lewat RAG):
 *     - identitas agent, satu-pertanyaan-per-pesan, never-invent,
 *       state block, DIREKTIF FINAL, kontrak mode katalog
 *   BOLEH LEWAT RAG (referensi besar, aman bila kadang tidak terambil):
 *     - playbook per tipe properti, tabel fasilitas, tabel landmark,
 *       referensi tanggal/uang, pengetahuan jual-beli, katalog properti
 *
 * FAIL-OPEN MUTLAK: setiap kegagalan mengembalikan STRING KOSONG. String
 * kosong = nol token tambahan = perilaku lama persis seperti sebelum RAG ada
 * (pola aman yang sama dengan §DISIPLIN TOKEN). RAG tidak boleh bisa
 * memutus percakapan customer dalam kondisi apa pun.
 */

'use strict';

const embeddingService = require('./embeddingService');
const vectorStore = require('./vectorStoreService');

/** Namespace indeks — dipakai konsisten oleh builder maupun retriever. */
const NAMESPACE = {
  SKILL_DOCS: 'skill_docs',        // referensi perilaku (BUKAN aturan inti)
  PROPERTY_KNOWLEDGE: 'property_knowledge', // pengetahuan jual-beli properti Indonesia
  AGENT_CATALOG: 'agent_catalog'   // listing milik agent — WAJIB di-scope user_id
};

function isEnabled() {
  return String(process.env.RAG_ENABLED || 'OFF').toUpperCase() === 'ON';
}

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Menyusun teks kueri dari percakapan.
 *
 * Bobotnya SENGAJA condong ke pesan customer TERAKHIR: itulah yang sedang
 * dijawab. Beberapa giliran sebelumnya ikut disertakan sebagai konteks tipis
 * supaya jawaban pendek ("semi aja", "iya") tetap punya sinyal — persis kelas
 * jawaban yang selama ini paling sering salah tangani.
 *
 * ⚠️ JANGAN memakai seluruh history: kueri yang terlalu panjang membuat
 * embedding-nya "rata-rata" dan justru menurunkan presisi retrieval.
 */
function buildQueryText(customerMessage, history = [], turns = 3) {
  const recent = Array.isArray(history) ? history.slice(-turns * 2) : [];

  const contextLines = recent
    .map((item) => String(item?.message || item?.content || '').trim())
    .filter(Boolean)
    .slice(-turns);

  const current = String(customerMessage || '').trim();

  // Pesan saat ini diulang agar bobotnya dominan dalam bag-of-words maupun
  // embedding semantik.
  return [current, current, ...contextLines].filter(Boolean).join('\n').slice(0, 1500);
}

/**
 * Memformat hasil retrieval menjadi blok prompt.
 * Setiap potongan diberi label sumbernya agar model bisa menyebut asal
 * informasi, dan agar saat debugging kita tahu chunk mana yang terpakai.
 */
function formatBlock(title, hits, options = {}) {
  if (!Array.isArray(hits) || hits.length === 0) return '';

  const { maxChars = 4000, showScores = false } = options;

  const lines = [];
  let used = 0;

  for (let i = 0; i < hits.length; i += 1) {
    const hit = hits[i];
    const label = hit.metadata?.breadcrumb || hit.metadata?.source || hit.id;
    const score = showScores ? ` (${hit.score.toFixed(3)})` : '';
    const entry = `\n### ${label}${score}\n${hit.text}`;

    if (used + entry.length > maxChars) break;
    lines.push(entry);
    used += entry.length;
  }

  if (lines.length === 0) return '';

  return [`## ${title}`, ...lines].join('\n');
}

/**
 * Mengambil referensi perilaku (skill docs) yang relevan dengan giliran ini.
 * HANYA untuk melengkapi — aturan inti tetap dimuat penuh di tempat lain.
 */
async function retrieveSkillReference(queryText, options = {}) {
  if (!vectorStore.isReady(NAMESPACE.SKILL_DOCS)) return '';

  const topK = envNumber('RAG_SKILL_TOP_K', 4);
  const maxChars = envNumber('RAG_SKILL_MAX_CHARS', 5000);

  const { vector } = await embeddingService.embedText(queryText);
  const hits = vectorStore.search(NAMESPACE.SKILL_DOCS, vector, {
    topK,
    minScore: Number(process.env.RAG_MIN_SCORE || 0.12),
    mmrLambda: Number(process.env.RAG_MMR_LAMBDA || 0.7),
    filter: options.filter || null
  });

  return formatBlock('📚 REFERENSI PERILAKU TERKAIT (hasil pencarian, pelengkap aturan inti)', hits, { maxChars });
}

/**
 * Mengambil pengetahuan domain jual-beli properti Indonesia.
 * Inilah yang membuat AI bisa menjawab "AJB itu apa?", "BPHTB berapa?",
 * "beda SHM dan HGB?" secara AKURAT alih-alih mengarang.
 */
async function retrievePropertyKnowledge(queryText, options = {}) {
  if (!vectorStore.isReady(NAMESPACE.PROPERTY_KNOWLEDGE)) return '';

  const topK = envNumber('RAG_KNOWLEDGE_TOP_K', 3);
  const maxChars = envNumber('RAG_KNOWLEDGE_MAX_CHARS', 3500);

  const { vector } = await embeddingService.embedText(queryText);
  const hits = vectorStore.search(NAMESPACE.PROPERTY_KNOWLEDGE, vector, {
    topK,
    minScore: Number(process.env.RAG_MIN_SCORE || 0.12),
    mmrLambda: Number(process.env.RAG_MMR_LAMBDA || 0.7),
    filter: options.filter || null
  });

  if (hits.length === 0) return '';

  return [
    formatBlock('🏷️ PENGETAHUAN PROPERTI (sumber terverifikasi — pakai ini, jangan mengarang)', hits, { maxChars }),
    '',
    '⛔ Bila pertanyaan customer TIDAK terjawab oleh kutipan di atas, katakan Anda akan',
    '   cek dulu ke tim — JANGAN menambah detail dari ingatan sendiri. Angka pajak,',
    '   biaya notaris, dan syarat KPR berubah antar waktu dan antar daerah.'
  ].join('\n');
}

/**
 * Mengambil listing paling relevan secara SEMANTIK dari katalog agent.
 *
 * Ini melengkapi propertyRecommendationService (yang bekerja dengan filter SQL
 * tegas: tipe, transaksi, kota, rentang harga). Pencarian semantik menangkap
 * maksud yang tidak bisa difilter SQL — "yang cocok buat keluarga muda",
 * "suasananya tenang", "dekat tempat kerja" — lalu memberi model bahasa
 * deskriptif listing yang sebenarnya.
 *
 * ⚠️ WAJIB di-scope per-agent. Tanpa filter user_id, agent A akan
 * merekomendasikan properti milik agent B.
 */
async function retrieveAgentCatalog(queryText, agentUserId, options = {}) {
  if (!vectorStore.isReady(NAMESPACE.AGENT_CATALOG)) return '';
  if (!agentUserId) return ''; // tanpa identitas agent → JANGAN tampilkan apa pun

  const topK = envNumber('RAG_CATALOG_TOP_K', 5);
  const maxChars = envNumber('RAG_CATALOG_MAX_CHARS', 3000);

  const { vector } = await embeddingService.embedText(queryText);

  const hits = vectorStore.search(NAMESPACE.AGENT_CATALOG, vector, {
    topK,
    minScore: Number(process.env.RAG_MIN_SCORE || 0.12),
    mmrLambda: Number(process.env.RAG_MMR_LAMBDA || 0.6),
    // Isolasi agent — dibandingkan sebagai string agar tipe kolom (STRING(50))
    // tidak menyebabkan ketidakcocokan senyap.
    filter: (metadata) => String(metadata?.user_id || '') === String(agentUserId)
      && (!options.buildingType || String(metadata?.building_type || '') === String(options.buildingType))
      && (!options.transactionType || String(metadata?.transaction_type || '') === String(options.transactionType))
  });

  if (hits.length === 0) return '';

  return [
    formatBlock('🏘️ LISTING KATALOG YANG COCOK SECARA MAKNA (milik agent ini saja)', hits, { maxChars }),
    '',
    '⛔ Hanya properti di atas yang boleh disebut. Jangan pernah mengarang nama,',
    '   harga, alamat, atau fasilitas listing yang tidak tercantum.'
  ].join('\n');
}

/**
 * Jawaban EKSTRAKTIF langsung untuk customer — dipakai oleh Private Agent
 * (chatbotPrivateController.js), yang deterministik dan TIDAK memanggil LLM.
 *
 * BERBEDA dari retrievePropertyKnowledge(): fungsi itu menghasilkan blok
 * konteks untuk DIBACA model bahasa. Fungsi ini menghasilkan TEKS SIAP KIRIM
 * ke customer — kutipan verbatim dari korpus, tanpa satu kata pun dikarang
 * Private Agent sendiri (yang memang tidak punya kemampuan generasi bahasa
 * bebas). Ini caranya Private Agent bisa "menjawab" "beda SHM sama HGB apa?"
 * tanpa melanggar sifat deterministiknya: ia MENGUTIP, tidak MENULIS.
 *
 * Ambang skor sengaja lebih TINGGI daripada retrievePropertyKnowledge (yang
 * hanya melengkapi prompt LLM) — di sini false positive berarti Private Agent
 * mengirim jawaban yang salah topik langsung ke customer tanpa filter model
 * bahasa apa pun sesudahnya, jadi presisi harus diutamakan di atas recall.
 *
 * @param {string} customerMessage
 * @returns {Promise<{text:string, source:string}|null>} null bila tidak ada
 *          kecocokan yang cukup yakin — pemanggil WAJIB jatuh ke perilaku lama
 *          (redirect off-topic biasa), bukan menganggap ini jawaban kosong.
 */
async function answerKnowledgeQuestion(customerMessage) {
  if (!isEnabled()) return null;
  if (!vectorStore.isReady(NAMESPACE.PROPERTY_KNOWLEDGE)) return null;

  try {
    vectorStore.ensureLoaded();

    const queryText = String(customerMessage || '').trim();
    if (!queryText) return null;

    const { vector } = await embeddingService.embedText(queryText);
    const hits = vectorStore.search(NAMESPACE.PROPERTY_KNOWLEDGE, vector, {
      // topK > 1 sengaja: chunk TERATAS kadang cuma judul bagian tanpa isi
      // (mis. heading "## Jenis Sertifikat" yang badannya langsung mulai di
      // sub-heading "### SHM" berikutnya). Ambil beberapa kandidat, lalu pilih
      // yang PERTAMA dengan isi cukup panjang untuk jadi jawaban yang berdiri
      // sendiri — bukan otomatis kandidat rangking #1.
      topK: 5,
      minScore: Number(process.env.RAG_ANSWER_MIN_SCORE || 0.30),
      mmrLambda: 1
    });

    const MIN_ANSWER_CHARS = Number(process.env.RAG_ANSWER_MIN_BODY_CHARS || 150);
    const hit = hits.find((h) => h.text.length >= MIN_ANSWER_CHARS);
    if (!hit) return null;

    const heading = (hit.metadata?.breadcrumb || '').split(' > ').pop() || 'Info';

    const text = [
      `ℹ️ *${heading}*`,
      '',
      hit.text,
      '',
      '_Untuk kepastian angka/syarat yang berlaku saat ini, tim kami akan bantu konfirmasi lebih lanjut._'
    ].join('\n');

    return { text, source: hit.metadata?.source || 'knowledge' };
  } catch (error) {
    console.warn('[RAG] answerKnowledgeQuestion gagal, dilewati:', error.message);
    return null;
  }
}

/**
 * Titik masuk utama — dipanggil dari pembangun prompt.
 *
 * @param {object} params
 * @param {string} params.customerMessage
 * @param {Array}  [params.history]
 * @param {string} [params.agentUserId]     WAJIB bila ingin blok katalog
 * @param {string} [params.buildingType]
 * @param {string} [params.transactionType]
 * @param {boolean}[params.includeSkillReference=false]
 * @param {boolean}[params.includeAgentCatalog=false]  ⚠️ lihat catatan di bawah
 * @returns {Promise<string>} blok prompt siap tempel — '' bila mati/gagal/kosong
 */
async function buildRagContext(params = {}) {
  if (!isEnabled()) return '';

  try {
    vectorStore.ensureLoaded();

    const queryText = buildQueryText(params.customerMessage, params.history);
    if (!queryText.trim()) return '';

    // ⚠️ Blok katalog SENGAJA opt-in (default false), BUKAN otomatis menyertai
    // pengetahuan properti. Aturan operasional proyek ini (SKILL.md §4) mutlak:
    // "❌ Never show listings mid-interview" — berlaku bahkan saat
    // RESPOND_CATALOG_RUN=ON. buildRagContext() dipanggil pada SETIAP giliran,
    // termasuk saat Q1–Q12 masih berjalan, jadi menyalakannya tanpa syarat akan
    // membocorkan rekomendasi semantik sebelum brief tampil — pelanggaran nyata
    // terhadap aturan itu, bukan sekadar risiko teoretis. Pemanggil WAJIB
    // mengaktifkannya hanya pada giliran setelah brief (mis. showCatalogAfterBrief
    // && summary sudah tampil), bukan pada setiap pesan.
    const blocks = await Promise.all([
      params.includeSkillReference ? retrieveSkillReference(queryText) : Promise.resolve(''),
      retrievePropertyKnowledge(queryText),
      params.includeAgentCatalog
        ? retrieveAgentCatalog(queryText, params.agentUserId, {
          buildingType: params.buildingType,
          transactionType: params.transactionType
        })
        : Promise.resolve('')
    ]);

    const combined = blocks.filter(Boolean).join('\n\n');
    if (!combined.trim()) return '';

    return [
      '',
      '════════════════════════════════════════════════════════════',
      '  KONTEKS HASIL PENCARIAN (RAG) — data faktual untuk giliran ini',
      '════════════════════════════════════════════════════════════',
      combined,
      '════════════════════════════════════════════════════════════',
      ''
    ].join('\n');
  } catch (error) {
    // FAIL-OPEN: percakapan JAUH lebih penting daripada konteks tambahan.
    console.warn('[RAG] buildRagContext gagal, dilewati:', error.message);
    return '';
  }
}

module.exports = {
  buildRagContext,
  buildQueryText,
  formatBlock,
  retrieveSkillReference,
  retrievePropertyKnowledge,
  retrieveAgentCatalog,
  answerKnowledgeQuestion,
  isEnabled,
  NAMESPACE
};

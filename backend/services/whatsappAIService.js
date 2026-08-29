/**
 * whatsappAIService.js
 *
 * Unified AI response service untuk semua WhatsApp controllers (Fonnte, Kirimi, TimelinesAI).
 *
 * ALUR LENGKAP:
 *   1. Fetch property context (Rumah123 / flat JSON)
 *   2. Get conversation history
 *   3. ★ PRE-QUALIFICATION GATE ★
 *      Jika pesan pertama tanpa konteks → kembalikan pertanyaan pembuka (tanpa panggil API AI)
 *      Jika ada konteks properti (type/tx/loc) → lanjut ke AI
 *   4. Load AI context blocks (fasilitas + kota dari DB)
 *   5. Call AI primary provider (Claude / QWEN / ChatGPT)
 *      AI selalu menjalankan Q1-Q12 interview. Setelah semua Q terjawab → tampilkan brief.
 *      RESPOND_CATALOG_RUN hanya mengontrol ISI BRIEF:
 *        OFF (default) → brief summary saja ("Saya akan segera menghubungi...")
 *        ON            → brief summary + rekomendasi catalog langsung di pesan yang sama
 *   6. Fallback to Private Agent jika AI primary gagal
 */

'use strict';

const {
  generateWhatsappReplyWithProviderFallback,
  generateWhatsappExternalAIFallback,
} = require('./aiProviderService');
const { getWhatsappPropertyContext }                = require('../utils/whatsappPropertyContext');
const { buildRecommendationContextForLLM,
        extractPropertyFilters,
        humanBuildingType,
        detectLandmark }                            = require('./propertyRecommendationService');
const { getConversationHistory }                    = require('./sessionService');
const { loadAIContextBlocks }                       = require('./aiContextService');
const { splitCatalogReply }                         = require('../utils/replySplitter');
const { resolveCatalogMode, envFallbackMode }       = require('./catalogModeService');
const { resolveAgentBusinessRules }                 = require('./agentBusinessRulesService');
const { checkAgentScope }                           = require('../utils/agentScopeGuard');
const { guardReplyIdentity }                        = require('../utils/replyIdentityGuard');
const sessionAnchors                                = require('../utils/sessionAnchors');
const { expandAbbreviations }                       = require('../utils/lazyChatNormalizer');
const { buildRagContext }                           = require('./ragRetrievalService');
const { isSilentSentinel }                          = require('../utils/offTopicSentinel');
const { tryTerminologyAnswer }                      = require('../utils/terminologyAnswerGate');
const { getAgentCoverage,
        buildAgentCoverageContext }                 = require('./agentCoverageService');
const { resolveGuardrailProfile }                   = require('../utils/guardrailPolicy');
const { evaluateListingReadiness,
        buildListingReadinessContext }              = require('../utils/listingReadiness');
const { getAgentIdentity,
        buildAgentIdentityContext }                 = require('./agentIdentityService');
const { tryCityAvailabilityAnswer,
        tryAreaAvailabilityAnswer,
        customerAsksAvailability }                  = require('../utils/areaAvailabilityGate');
const { resolveCityAndArea, findAreaInText }        = require('./areaAvailabilityService');
const { tryListingSelectionAnswer }                 = require('../utils/listingSelectionGate');

// Jendela history untuk ekstraksi filter & state kualifikasi. Cukup besar agar
// pesan pembuka (tipe/transaksi/lokasi) tidak keluar scope di alur panjang, tapi
// tetap dibatasi agar tidak menarik terlalu banyak data. Bisa di-override via env.
const HISTORY_WINDOW = (() => {
  const n = parseInt(process.env.AI_HISTORY_WINDOW || '', 10);
  return Number.isFinite(n) && n >= 24 ? n : 60;
})();

/**
 * Normalisasi `result.provider` (nilai internal whatsappAIService, banyak
 * variasi historis) menjadi label `chat_messages.ai_responder` yang bersih:
 * salah satu dari chatgpt|claude|qwen|deepseek|kimi|private, atau `null`
 * bila balasan ini BUKAN benar-benar hasil AI provider mana pun.
 *
 * ⚠️ ATURAN WAJIB (user, 4 Agu 2026): ai_responder mencatat provider yang
 * BENAR-BENAR menjawab, BUKAN sekadar menyalin AI_PRIMARY_PROVIDER dari .env.
 * Saat primary provider gagal/token habis dan sistem otomatis fallback ke
 * chatbotPrivateController.js, nilainya HARUS 'private' — walau
 * AI_PRIMARY_PROVIDER di .env masih tertulis 'chatgpt', misalnya.
 *
 * Pemetaan:
 *   'chatgpt'|'claude'|'qwen'|'deepseek'|'kimi'|'openrouter'
 *                                                → apa adanya (provider asli menjawab)
 *   'private_agent'                              → 'private' (fallback ke Private Agent)
 *   'qualification'                               → null (gerbang info-minimum,
 *                                                    belum ada AI provider ATAU
 *                                                    Private Agent yang dipanggil)
 *   'fallback_generic'                            → null (last-resort statis,
 *                                                    bukan hasil provider mana pun)
 *   lainnya/tidak dikenal                          → null (jangan menebak)
 *
 * @param {string} rawProvider - `result.provider` dari generateWhatsAppAIReply()
 * @returns {string|null}
 */
function normalizeAiResponderLabel(rawProvider) {
  // 'openrouter' sempat tertinggal saat provider ke-6 ditambahkan: balasannya
  // tercatat sebagai ai_responder = null, jadi laporan "provider mana yang
  // menjawab" diam-diam salah untuk setiap percakapan lewat OpenRouter.
  const KNOWN_PROVIDERS = new Set(['chatgpt', 'claude', 'qwen', 'deepseek', 'kimi', 'openrouter']);
  const p = String(rawProvider || '').toLowerCase().trim();
  if (KNOWN_PROVIDERS.has(p)) return p;
  if (p === 'private_agent') return 'private';
  return null;   // 'qualification' / 'fallback_generic' / kosong / tidak dikenal
}

/* ══════════════════════════════════════════════════════════════════════════════
   QUALIFICATION GATE — 4 Minimum Info Required
   (Runs before ANY AI provider is called)
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Human-readable building type label for qualification messages.
 *
 * @param {string} type - Internal buildingType key
 * @param {boolean} isId - true = Indonesian, false = English
 * @returns {string}
 */
function typeLabel(type, isId) {
  const map = {
    house        : isId ? 'Rumah'              : 'House',
    apartment    : isId ? 'Apartemen'          : 'Apartment',
    hotel        : 'Hotel',
    villa        : 'Villa',
    boarding_house: isId ? 'Kos-Kosan'          : 'Boarding House',
    shophouse    : isId ? 'Ruko'               : 'Shophouse',
    store        : isId ? 'Toko'               : 'Store',
    office       : isId ? 'Kantor'             : 'Office',
    warehouse    : isId ? 'Gudang'             : 'Warehouse',
    others       : isId ? 'Properti Lainnya'   : 'Other Property',
  };
  return map[type] || type || (isId ? 'Properti' : 'Property');
}

const ID_KEYWORDS = [
  // Kata ganti & modal
  'saya', 'aku', 'mau', 'ingin', 'pengen', 'cari', 'sewa', 'beli',
  'jual', 'ada', 'tolong', 'mohon', 'yang', 'dengan', 'dan', 'atau',
  'tidak', 'bisa', 'siap', 'untuk', 'apa', 'boleh', 'dong', 'ya',
  // Properti
  'rumah', 'villa', 'vila', 'apartemen', 'hotel', 'kos', 'kost', 'ruko', 'gudang', 'kantor',
  'properti', 'tanah', 'kontrakan',
  // Harga & lokasi
  'harga', 'berapa', 'budget', 'sekitar', 'kisaran', 'terjangkau', 'murah',
  'di ', 'lokasi', 'area', 'kota', 'wilayah', 'daerah',
  // Satuan mata uang Indonesia → pesan "3-10 juta" jelas bahasa Indonesia
  'juta', 'ribu', 'miliar',
];

/**
 * Detect language from the customer's message.
 * If current message is ambiguous (short / no keywords), fall back to recent history.
 * Returns true if Indonesian, false if English.
 *
 * @param {string} message
 * @param {Array}  history  - Conversation history array [{role, message}]
 * @returns {boolean}
 */
function isIndonesian(message, history = []) {
  const lower = (message || '').toLowerCase();

  // Check current message first
  if (ID_KEYWORDS.some(w => lower.includes(w))) return true;

  // Fallback: check last 4 customer messages in history
  // role bisa 'user' (website chatbot) atau 'customer' (fonnte/wati/dialog)
  const recentUserMsgs = (history || [])
    .filter(m => m.role === 'user' || m.role === 'customer')
    .slice(-4)
    .map(m => (m.message || '').toLowerCase());

  return recentUserMsgs.some(msg => ID_KEYWORDS.some(w => msg.includes(w)));
}

/**
 * Build agent signature for qualification messages.
 *
 * @param {string} agentName
 * @param {boolean} isId
 * @returns {string}
 */
function agentSignature(agentName, isId) {
  // App name dari APP_NAME env; agent name dari database (param). JANGAN hardcode.
  const appName = process.env.APP_NAME || 'Elevan Property';
  const name    = agentName || appName;
  return isId
    ? `\n\nSalam hangat,\n*${name}*\n*${appName}*`
    : `\n\nWarm regards,\n*${name}*\n*${appName}*`;
}

/**
 * ★ CORE QUALIFICATION FUNCTION ★
 *
 * Check apakah customer sudah memberikan 4 info minimum:
 *   1) Tipe properti   (buildingType)
 *   2) Tipe transaksi  (transactionType)
 *   3) Kota            (location)
 *   4) LOKASI SPESIFIK (district / area / landmark)
 *
 * ⚠️ M162 — SLOT KE-4 BUKAN LAGI BUDGET.
 * Directive pemilik proyek (M134, 24 Agu 2026) sudah menetapkan slot ke-4 =
 * lokasi spesifik, dan `utils/listingReadiness.js` menuliskannya sejak saat itu
 * — docstring-nya bahkan menyebut "Sebelumnya buildQualifyReply() mensyaratkan
 * type+tx+kota+BUDGET". Tapi FUNGSI INI tidak pernah ikut diubah, jadi dua
 * komponen backend berbeda pendapat tentang slot yang sama:
 *
 *   • listingReadiness  → "Masih kurang: area/kawasan atau patokan lokasi."
 *   • buildQualifyReply → "Untuk beli Rumah di Surabaya, kisaran harga berapa?"
 *
 * Dan yang MENANG adalah fungsi ini, karena ia `return` LEBIH DULU — sebelum
 * blok readiness sempat sampai ke prompt. Hasilnya di produksi (profil 'local'
 * / Private Agent, catalog mode ON): customer yang sudah menyebut tipe +
 * transaksi + kota + area tetap ditanya BUDGET, padahal directive-nya eksplisit
 * "budget BUKAN syarat menampilkan listing; customer lazim menyesuaikan harga
 * SETELAH melihat pilihan."
 *
 * Budget TIDAK dihapus dari alur — ia tetap ditanya oleh Q3 di
 * findNextQuestion()/ConversationQualifier, dengan teknik dua-harga-kontras
 * yang memang dirancang untuk itu. Yang dihapus hanyalah perannya sebagai
 * PALANG PINTU sebelum listing boleh tampil.
 *
 * Jika ada yang kurang → kembalikan pertanyaan yang sopan & informatif.
 * Jika semua lengkap   → kembalikan null (lanjut ke AI provider).
 *
 * @param {object} filters   - Hasil extractPropertyFilters() (+ enrichment M162)
 * @param {string} message   - Pesan customer terbaru
 * @param {string} agentName - Nama agent (untuk tanda tangan)
 * @param {string} contextSource
 * @param {Array}  history   - Conversation history (untuk language detection)
 * @returns {{ reply, provider, contextSource } | null}
 */
function buildQualifyReply(filters, message, agentName, contextSource, history = [], catalogMode = null) {
  const { buildingType: type, transactionType: tx, location: loc } = filters;
  // Slot ke-4. Dibaca lewat evaluateListingReadiness() — SATU definisi, dipakai
  // gerbang ini DAN blok fakta di prompt, supaya keduanya tidak bisa menyimpang
  // lagi seperti sebelum M162.
  const spec = evaluateListingReadiness(filters).have.specificLocation;
  // Nama perusahaan dari APP_NAME env (bisa diubah di .env). JANGAN hardcode.
  const appName = process.env.APP_NAME || 'Elevan Property';

  // Semua 4 info sudah ada → proceed to AI
  if (type && tx && loc && spec) return null;

  // ── RESPOND_CATALOG_RUN=OFF (Q1–Q12 Summary Mode) ─────────────────────────
  //
  // Dalam summary mode, AI sudah mendapat instruksi penuh Q1–Q12 di system prompt.
  // Kunci: Q3 (budget) harus ditanya AI menggunakan dua pilihan harga kontras
  //   "Di [area] saya punya yang kisaran [LOW] dan ada yang [HIGH]…"
  //   BUKAN ditanya langsung oleh qual gate ("Kisaran harga berapa?").
  //
  // Rule: Jika setidaknya satu info properti (type, tx, atau location) sudah diketahui,
  // kembalikan null → biarkan AI menangani sisa pertanyaan via Q1–Q12.
  //
  // Hanya gunakan qual gate di summary mode untuk pesan pertama (zero context),
  // supaya AI tidak menerima terlalu sedikit context saat start.
  //
  // Di catalog mode (ON): qual gate selalu dijalankan penuh — AI butuh 4 info
  // sebelum bisa menampilkan listing.
  // Mode per-agent (users.catalog_summary) dilewatkan caller; fallback env bila null.
  const summaryMode = (catalogMode || envFallbackMode()) !== 'ON';
  if (summaryMode && (type || tx || loc)) {
    // Property context sudah ada → AI handle Q1–Q12 naturally (termasuk Q3 budget)
    return null;
  }

  const id  = isIndonesian(message, history);
  const sig = agentSignature(agentName, id);

  // Hitung berapa yang sudah diketahui
  const known   = [type, tx, loc, spec].filter(Boolean).length;
  const txWord  = tx === 'rent'
    ? (id ? 'sewa'  : 'rent')
    : (tx === 'sale' || tx === 'purchase')
      ? (id ? 'beli'  : 'buy')
      : null;
  const typeLbl     = type ? typeLabel(type, id) : null;
  const locLbl      = loc  ? `*${loc}*` : null;

  let question;

  // ── KASUS 1: Belum ada info sama sekali / hanya type yang ada ─────────────
  // ⚠️ M162: bullet ke-4 dulu berbunyi "Kisaran harga yang Anda siapkan?".
  // Itu meminta customer menyiapkan angka SEBELUM ia melihat satu pun listing —
  // urutan yang dilarang directive M134 dan yang paling sering membuat customer
  // berhenti membalas. Diganti dengan lokasi spesifik, slot yang memang
  // dibutuhkan untuk MENCARI. Budget menyusul lewat Q3 (dua harga kontras).
  if (!tx && !loc && !spec) {
    if (!type) {
      // Benar-benar kosong
      question = id
        ? `Halo! 😊 Terima kasih sudah menghubungi *${appName}*.\n\nSaya dengan senang hati akan membantu Anda menemukan properti yang tepat. Sebelum saya carikan pilihan terbaik, boleh saya tanyakan beberapa hal?\n\n1️⃣ Apakah Anda sedang cari untuk *sewa* atau *beli*?\n2️⃣ Tipe properti apa yang Anda inginkan?\n   _Rumah, Apartemen, Villa, Kos-kosan, Ruko, Kantor, Gudang, dll_ 🏡\n3️⃣ Di *kota* mana? _(Contoh: Surabaya, Malang, Bali)_\n4️⃣ Area/kawasan atau patokan lokasinya di mana? _(Contoh: Pakuwon, dekat PTC)_\n\nSemakin lengkap infonya, semakin tepat rekomendasi yang bisa saya berikan 🙏`
        : `Hello! 😊 Thank you for reaching out to *${appName}*.\n\nI'd love to help you find the perfect property. Before I start searching, may I ask a few things?\n\n1️⃣ Are you looking to *rent* or *buy*?\n2️⃣ What type of property do you have in mind?\n   _House, Apartment, Villa, Boarding House, Shophouse, Office, Warehouse, etc._ 🏡\n3️⃣ Which city?\n4️⃣ Which area or nearby landmark?\n\nThe more details you share, the better I can match your needs 🙏`;
    } else {
      // Type diketahui, sisanya kosong
      question = id
        ? `Terima kasih! 😊 Untuk *${typeLbl}* yang Anda cari, saya butuh beberapa informasi tambahan:\n\n1️⃣ Apakah rencananya untuk *sewa* atau *beli*?\n2️⃣ Di *kota* mana? _(Contoh: Surabaya, Malang, Bali)_\n3️⃣ Area/kawasan atau patokan lokasinya? _(Contoh: Pakuwon, dekat PTC)_\n\nSilakan ceritakan kebutuhannya, saya siap bantu! 🏡`
        : `Thank you! 😊 For the *${typeLbl}* you're looking for, I need a bit more information:\n\n1️⃣ Are you planning to *rent* or *buy*?\n2️⃣ Which city?\n3️⃣ Which area or nearby landmark?\n\nPlease share the details and I'll find the best match! 🏡`;
    }
  }

  // ── KASUS 2: Transaction type tidak diketahui ─────────────────────────────
  // M125: SATU pertanyaan per pesan — dulu membundel kota+budget sebagai bullet
  // tambahan di sini juga, walau baru satu topik (transaksi) yang sedang
  // ditanya. Kota/budget menyusul di giliran berikutnya (KASUS 3/4/5) begitu
  // transaksi terjawab — customer tidak kehilangan fokus menjawab 3 hal sekaligus.
  else if (!tx) {
    question = id
      ? `Untuk *${typeLbl || 'properti'}* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠`
      : `For the *${typeLbl || 'property'}* you're looking for — are you planning to *rent* or *buy*? 🏠`;
  }

  // ── KASUS 3: Tipe properti tidak diketahui ────────────────────────────────
  else if (!type) {
    question = id
      ? `Siap, mau *${txWord}* properti! 🏡\n\nTipe properti apa yang Anda cari?\n_Rumah, Apartemen, Villa, Kos-kosan, Ruko, Kantor, Gudang, atau lainnya_`
      : `Got it, looking to *${txWord}* a property! 🏡\n\nWhat type of property are you looking for?\n_House, Apartment, Villa, Boarding House, Shophouse, Office, Warehouse, or other_`;
  }

  // ── KASUS 4: Lokasi tidak diketahui ──────────────────────────────────────
  else if (!loc) {
    question = id
      ? `Baik! Mau *${txWord} ${typeLbl}*. 📍\n\nDi *kota* mana yang Anda inginkan?\n_(Contoh: Surabaya, Malang, Bali, Jakarta Selatan)_`
      : `Great! Looking to *${txWord} a ${typeLbl}*. 📍\n\nWhich *city*?\n_(e.g., Surabaya, Malang, Bali, South Jakarta)_`;
  }

  // ── KASUS 5: Hanya LOKASI SPESIFIK yang belum diketahui ───────────────────
  // ⚠️ M162: cabang ini DULU menanyakan BUDGET. Lihat docstring fungsi — budget
  // bukan lagi palang pintu sebelum listing boleh tampil; ia ditanya belakangan
  // lewat Q3 (dua harga kontras) oleh findNextQuestion()/ConversationQualifier.
  // M127 tetap berlaku: SATU pertanyaan, tanpa basa-basi "Hampir lengkap!".
  else if (!spec) {
    question = id
      ? `Baik, *${txWord} ${typeLbl} di ${loc}*. 📍\n\nDi area/kawasan mana, atau ada patokan lokasi tertentu?\n_(Contoh: area Pakuwon, dekat PTC, dekat kampus)_`
      : `Great — *${txWord} a ${typeLbl} in ${loc}*. 📍\n\nWhich area or neighbourhood, or is there a nearby landmark?\n_(e.g., Pakuwon area, near PTC, near campus)_`;
  }

  if (!question) return null;

  return {
    reply         : question + sig,
    provider      : 'qualification',
    contextSource,
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN FUNCTION
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Generate AI reply untuk WhatsApp message dengan full provider chain.
 *
 * PENTING: Pre-qualification gate memastikan customer sudah memberikan
 * 4 info minimum SEBELUM listing property ditampilkan.
 *
 * Chain (hanya dijalankan jika sudah lulus qualification):
 *   ChatGPT → Claude → Private Agent
 *
 * @param {object} params
 *   @param {object} session   - ChatSession object
 *   @param {string} message   - Customer's message text
 *   @param {string} agentName - Name of WhatsApp agent
 *   @param {object} options   - Optional: { context, contextSource }
 * @returns {Promise<{ reply, provider, contextSource }>}
 */
async function _generateWhatsAppAIReplyCore(params) {
  const { session, agentName, agentUserId = null, agentAiPrimary = null, options = {} } = params;

  // id-realestate-lazy-chat-normalizer skill (28 Jul 2026): expand SMS-speak/
  // abbreviations ONCE, here, before any detector (filter extraction, Q-flow
  // extractors, AI prompt builders) sees the text. The RAW message was already
  // saved to ChatMessage by the calling controller before this function runs —
  // normalizing only the in-memory copy used for detection this turn keeps the
  // stored transcript authentic for an agent takeover/log read, while every
  // live detector benefits from the expansion. Past turns already in `history`
  // are read as originally typed (not retroactively re-expanded) — see
  // lazyChatNormalizer.js docstring.
  const message = expandAbbreviations(params.message);

  // Pastikan nama agent (dari database) ikut ke prompt builder lewat session.
  // buildWhatsappReplyPrompt() membaca session.agentName untuk tanda tangan dinamis.
  if (session && agentName && !session.agentName) session.agentName = agentName;
  // user_id agent → scoping katalog per-agent (tiap nomor WA hanya rekomendasikan
  // listing miliknya sendiri). Disimpan di session agar ikut ke Private Agent fallback.
  if (session && agentUserId && !session.agentUserId) session.agentUserId = agentUserId;
  // Pilihan AI provider milik agent (users.ai_primary). "Default" → ikut .env.
  // Dibaca aiProviderService lewat session, sejalan dengan agentName/agentUserId.
  if (session && agentAiPrimary && !session.agentAiPrimary) session.agentAiPrimary = agentAiPrimary;

  // ── Mode katalog PER-AGENT (users.catalog_summary) ─────────────────────────
  // Sumber kebenaran mode summary/katalog kini kolom users.catalog_summary
  // ('ON'/'OFF', diubah agent via chat "matikan/nyalakan summary") — BUKAN env
  // RESPOND_CATALOG_RUN (env tinggal fallback saat kolom NULL). Dipanggil di sini
  // (awal pipeline) supaya cache hangat untuk pembaca sync di prompt builder.
  const catalogMode = await resolveCatalogMode(agentUserId);   // 'ON' | 'OFF'

  // ── Aturan bisnis PER-AGENT (trans_type/payment_type/rental_*) ─────────────
  // Menentukan APA yang boleh dijawab AI. Dimuat di sini (awal pipeline) dengan
  // pola yang sama seperti catalogMode, supaya cache-nya hangat untuk pembaca
  // sync di gate bawah. Lihat utils/agentScopeGuard.js.
  const agentRules = await resolveAgentBusinessRules(agentUserId);

  // ── Step 1: Get conversation history ───────────────────────────────────────
  // Diambil DULU (sebelum property context) supaya katalog DB (Property/
  // PropertyFacility/PropertyLocation) bisa memakai filter yang diekstrak dari
  // SELURUH percakapan, bukan hanya pesan terakhir — sama seperti
  // chatbotPrivateController.js memanggil buildRecommendationContextForLLM().
  let history = [];
  try {
    // Window HARUS cukup besar untuk menampung SATU sesi kualifikasi penuh
    // (Q1–Q14 + identitas nama/email). Customer sering mengetik 1–3 kata per pesan,
    // sehingga satu kualifikasi bisa 40–60 pesan total. Window 24 terlalu kecil:
    // pesan pembuka yang membawa TIPE/TRANSAKSI/LOKASI (mis. "book apartemen di
    // Surabaya") keluar dari window → gate keliru menganggap tipe kosong → RESET
    // ke Q1 di tengah alur (loop). Boundary sesi (summary/ganti-tipe/greeting) +
    // TTL idle tetap mencegah kebocoran sesi lama meski window besar.
    history = await getConversationHistory(session.id, HISTORY_WINDOW);
  } catch (err) {
    console.warn('[WhatsAppAI] History fetch failed:', err.message);
  }

  // ── Step 2: Fetch property context (Rumah123 + katalog DB sendiri) ─────────
  let propertyCtx  = options.context || '';
  let contextSource = 'none';

  if (!propertyCtx) {
    try {
      const ctxResult = await getWhatsappPropertyContext(message, history, agentUserId);
      propertyCtx     = ctxResult.contextText || '';
      contextSource   = ctxResult.source       || 'none';
    } catch (err) {
      console.warn('[WhatsAppAI] Context fetch failed:', err.message);
    }
  } else {
    contextSource = options.contextSource || 'provided';
  }

  // ── Step 3: PRE-QUALIFICATION GATE ★ ───────────────────────────────────────
  // Extract filters dari SEMUA pesan (history + pesan terbaru)
  // untuk mendapatkan gambaran lengkap apa yang sudah diketahui.
  let filters = { buildingType: '', transactionType: '', location: '', budget: null };
  try {
    filters = extractPropertyFilters(message, history);
  } catch (err) {
    console.warn('[WhatsAppAI] Filter extraction failed:', err.message);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ★ M162 — SLOT LOKASI SPESIFIK DISATUKAN DENGAN RESOLVER KANONIK ★
     ══════════════════════════════════════════════════════════════════════════
     `utils/listingReadiness.evaluateListingReadiness()` membaca
     `filters.district || filters.area || filters.landmark`. Masalahnya:
     extractPropertyFilters() TIDAK PERNAH mengisi `district` MAUPUN `area` —
     dua dari tiga field itu selalu `undefined`. Satu-satunya yang terisi,
     `landmark`, berasal dari detectLandmark() yang mencocokkan ke tabel
     `locations`; nama kawasan yang diketik customer tapi belum ada di master
     data (atau cache yang belum hangat di proses baru) menghasilkan '' .

     Akibatnya, untuk transkrip "Mau cari rumah di Citraland Surabaya":
       • extractQualificationState → district = 'Citraland'  → blok state
         menulis "✅ Area [Q2c]: Citraland".
       • evaluateListingReadiness  → specificLocation = ''    → blok readiness
         menulis "SYARAT MINIMUM LISTING: BELUM TERPENUHI. Masih kurang:
         area/kawasan atau patokan lokasi. … Tanyakan yang kurang, SATU per
         pesan."
     Kedua blok masuk ke SATU prompt. Yang berbentuk PERINTAH menang, dan AI
     menanyakan ulang area yang baru saja disebut customer. Ini persis kelas
     bug yang M154 hilangkan untuk kota/transaksi/tipe — field lokasi spesifik
     saja yang belum ikut disatukan.

     Perbaikannya BUKAN menyalin regex area ke ekstraktor kedua (pelajaran
     ngekos: satu regex di 5 tempat = 5 perbaikan), melainkan MEMINJAM hasil
     resolver kanonik yang memang sudah dihitung di pipeline ini.
     Fail-open: kegagalan apa pun → filters dibiarkan apa adanya.
  ══════════════════════════════════════════════════════════════════════════ */
  let qualState = {};
  try {
    // require lokal — alasan sama dengan call-site M152 di bawah: menariknya ke
    // puncak file berisiko siklus require yang muncul sebagai export undefined.
    const { extractQualificationState } = require('./aiPromptBuilderService');
    qualState = extractQualificationState(history, message) || {};
    if (!filters.district && qualState.district)    filters.district = qualState.district;
    if (!filters.landmark && qualState.anchorPoint) filters.landmark = qualState.anchorPoint;
  } catch (qsErr) {
    console.warn('[WhatsAppAI] enrich lokasi spesifik gagal (fail-open):', qsErr.message);
  }

  // ── STICKY ANCHORS (anti-reset) ──────────────────────────────────────────
  // Lengkapi tipe/transaksi/lokasi dari cache sesi bila "keluar window" di
  // percakapan panjang → cegah gate reset ke Q1 ("Tipe properti apa?") di tengah
  // alur. Ganti-tipe & summary tetap mereset (lihat sessionAnchors.reconcile /
  // clearAnchors). Jaring pengaman selain HISTORY_WINDOW yang sudah diperbesar.
  try {
    if (session?.id) sessionAnchors.reconcile(session.id, filters);
  } catch (anchErr) {
    console.warn('[WhatsAppAI] anchor reconcile failed (non-fatal):', anchErr.message);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ★ M158 — PROFIL GUARDRAIL DIPUTUSKAN DI SINI, SEBELUM GERBANG APA PUN ★
     ══════════════════════════════════════════════════════════════════════════
     Directive pemilik proyek (28 Agu 2026):
       "AI_PRIMARY_PROVIDER hanya menggunakan guardrails + vektor + RAG +
        skills saja pada backend; code backend yang lain tidak boleh ikut
        campur, cek, seleksi, analisa, mengelola, menentukan keputusan."

     MASALAH STRUKTURAL YANG DIPERBAIKI
     `guardProfile` dulu dihitung di ~baris 644 — SESUDAH gerbang batas layanan,
     gerbang istilah (M132), dan gerbang ketersediaan area (M152) sudah sempat
     MENYUSUN DAN MENGIRIM balasan. Ketiganya secara teknis TIDAK MUNGKIN
     menghormati profil: keputusannya diambil sebelum profilnya diketahui.
     Akibatnya, walau AI_PRIMARY_PROVIDER=kimi, yang menjawab customer sering
     kali tetap backend — persis "util dan service lain yang ikut campur" yang
     dikeluhkan pemilik proyek.

     ATURAN BARU YANG DITEGAKKAN DI BAWAH
       profil 'local'    → backend menyusun balasan (Private Agent). Tidak berubah.
       profil 'platform' → backend HANYA menyiapkan bahan (guardrails, vektor,
                           RAG, skor keyakinan, skill docs) lalu MENYERAHKAN
                           keputusan & kata-katanya ke platform AI.

     Fakta yang dulu dipakai gerbang untuk MENJAWAB tidak dibuang — ia berpindah
     peran menjadi KONTEKS PROMPT (lihat gateFactsContext di bawah). Jadi model
     tetap tidak bisa mengarang ketersediaan/istilah, tapi kalimatnya miliknya.
  ══════════════════════════════════════════════════════════════════════════ */
  const guardProfile = resolveGuardrailProfile(agentAiPrimary || session?.agentAiPrimary);
  const backendMayCompose = guardProfile === 'local';

  // Fakta hasil gerbang untuk profil 'platform' — dikumpulkan, TIDAK dikirim.
  const gateFacts = [];

  // ── ★ GERBANG BATAS LAYANAN AGENT ★ ───────────────────────────────────────
  // Ditempatkan SEBELUM qualification gate dan SEBELUM percabangan LLM/Private
  // Agent — jadi SATU tempat melindungi KEDUA jalur. Menaruhnya di salah satu
  // jalur saja adalah kesalahan yang sudah dua kali menyesatkan proyek ini
  // (M52/M54: fitur dipasang di Private Agent, produksi jalan di jalur LLM).
  //
  // Tidak ada gunanya menanyakan budget/lokasi kepada customer yang transaksinya
  // memang tidak dilayani agent — beri tahu sekarang, jangan setelah 12
  // pertanyaan. Guard ini fail-open: bila aturan agent tidak diketahui, lolos.
  try {
    const scope = checkAgentScope(message, agentRules);
    if (scope.blocked) {
      console.log('[WhatsAppAI] 🚫 Di luar batas layanan agent:', {
        reason: scope.reason,
        transType: agentRules.transType,
        paymentType: agentRules.paymentType,
        minRental: agentRules.rentalDuration ? `${agentRules.rentalDuration} ${agentRules.rentalType}` : null,
      });
      const reply = scope.reply + agentSignature(agentName, isIndonesian(message, history));
      return {
        reply,
        replyParts: [reply],
        provider: 'agent_scope_guard',
        contextSource,
      };
    }
  } catch (scopeErr) {
    // Fail-open: gerbang non-kritis tidak boleh menghentikan balasan.
    console.warn('[WhatsAppAI] agent scope guard failed (non-fatal):', scopeErr.message);
  }

  const qualResponse = buildQualifyReply(filters, message, agentName, contextSource, history, catalogMode);

  // ── ★ M132: GERBANG ISTILAH LEGAL/SERTIFIKAT (SHM/SHGB/KPR/dst.) ★ ────────
  // Dicek DI SINI, TIDAK BERSYARAT, bukan hanya di dalam chatbotPrivateController.js
  // (M129). Root cause transkrip produksi nyata (23-24 Agu 2026): customer
  // bertanya "Apakah sdh SHM?" berkali-kali dan SELALU dibalas pertanyaan
  // qualResponse ("...rencananya sewa atau beli?") yang identik — karena
  // buildQualifyReply() di atas me-return LEBIH DULU setiap kali salah satu
  // dari 4 info minimum belum ada, kondisi yang HAMPIR SELALU benar persis
  // saat customer baru bertanya soal sertifikat sebelum sempat menjawab
  // sewa/beli. chatbotPrivateController.js (tempat #tryTerminologyAnswer()
  // M129 hidup) hanya dipanggil SETELAH gate ini lolos — jadi M129 secara
  // efektif tidak pernah tercapai untuk kasus yang justru paling umum, walau
  // tes unit-nya (terminologyAnswerGate.test.js, memanggil
  // generatePrivateTerminalMassege LANGSUNG) tetap hijau karena tidak
  // melewati gate ini sama sekali.
  //
  // Fix: jawab istilahnya DULU (fungsi bersama, utils/terminologyAnswerGate.js
  // — hindari duplikasi daftar istilah, kelas bug M27/M77), lalu SAMBUNG
  // dengan pertanyaan kualifikasi yang sedianya akan ditanyakan (bila info
  // masih kurang) supaya alur qualification tidak pernah macet karena
  // customer bertanya balik. Bila info kualifikasi sudah lengkap, jawab
  // istilahnya saja — giliran berikutnya tetap berjalan normal ke AI/Private
  // Agent seperti biasa.
  const termAnswer = tryTerminologyAnswer(message);
  if (termAnswer && backendMayCompose) {
    console.log('[WhatsAppAI] 📖 Pertanyaan istilah legal/sertifikat terdeteksi — dijawab sebelum melanjutkan qualification flow.');
    const combinedReply = qualResponse
      ? `${termAnswer}\n\n${qualResponse.reply}`
      : `${termAnswer}\n\nAda pertanyaan lain seputar properti yang bisa saya bantu? 😊${agentSignature(agentName, isIndonesian(message, history))}`;
    return {
      reply         : combinedReply,
      replyParts    : [combinedReply],
      provider      : 'terminology_gate',
      contextSource,
    };
  }
  if (termAnswer && !backendMayCompose) {
    // Profil 'platform': definisinya diberikan sebagai FAKTA, bukan balasan.
    // Model yang memutuskan kapan & bagaimana menyampaikannya — tapi ia tidak
    // perlu (dan tidak boleh) mengarang isi istilah legalnya sendiri.
    gateFacts.push(`DEFINISI ISTILAH (pakai apa adanya bila relevan):\n${termAnswer}`);
  }

  // ── ★ M152: GERBANG KETERSEDIAAN AREA ★ ──────────────────────────────────
  // Directive pemilik proyek (25 Agu 2026), dari transkrip produksi: customer
  // minta SEWA apartemen di Pakuwon dan bertanya "apakah ada?" LIMA KALI. Bot
  // tidak pernah menjawab — tiap giliran ia mengajukan pertanyaan interview
  // berikutnya (satu di antaranya diulang 3x) — lalu diam-diam mengirim listing
  // Bulak/Kalijudan/Karang Pilang, area yang tidak pernah diminta. Faktanya:
  // Pakuwon punya 19 apartemen, SEMUANYA dijual, NOL disewakan.
  //
  // Ditempatkan tepat setelah gerbang istilah dan dengan alasan yang sama:
  // buildQualifyReply() me-return lebih dulu selama salah satu info minimum
  // belum lengkap — kondisi yang justru hampir selalu benar saat customer
  // bertanya "ada tidak?" — sehingga jawaban apa pun yang ditaruh lebih dalam
  // (di chatbotPrivateController atau di prompt LLM) tidak pernah tercapai.
  // Kelas bug yang sama persis dengan M129 (lihat catatan gerbang istilah).
  //
  // ⛔ Aktif di KEDUA profil guardrail: ini mencegah AI MENGARANG ketersediaan
  // (kelas fakta, seperti M129/M130/M132 yang sengaja dipertahankan), bukan
  // mengatur gaya percakapan yang jadi wewenang platform AI.
  try {
    const isIdMsg = isIndonesian(message, history);

    /* ── ★ M165: GERBANG PEMILIHAN LISTING — SEBELUM gerbang kota/area ★ ────
     * Transkrip produksi 29 Agu 2026: backend mengirim 2 kartu MERR berjudul
     * IDENTIK (beda harga saja). Customer memilih no. 2 LIMA KALI — lewat
     * nomor ("Saya mau yang no 2"), lewat harga ("Yg hrg 471.1 juta"), lalu
     * mengulang "Saya pilih no 2, Kak" tiga kali. Tiap kali backend mengirim
     * ULANG kedua kartu yang sama persis.
     *
     * Ditaruh PALING DEPAN di blok ini, dan itu memang inti perbaikannya:
     * gerbang area di bawah masih punya jalur yang merender ulang katalog
     * untuk area yang sama. Selama pemilihan belum dikenali lebih dulu,
     * jawaban apa pun yang lebih dalam tidak pernah tercapai — kelas bug yang
     * sama dengan M129 (gerbang istilah) dan M164 (gerbang kota).
     *
     * ⛔ Aktif di KEDUA profil guardrail. Kartu mana yang customer tunjuk
     * adalah FAKTA yang hanya bisa dibaca dari teks yang sudah terkirim —
     * bukan gaya percakapan. Membiarkan LLM menebaknya justru sumber bug ini.
     */
    const pick = tryListingSelectionAnswer({ message, history, isId: isIdMsg });
    if (pick && backendMayCompose) {
      console.log(`[WhatsAppAI] 🎯 Gerbang pemilihan listing: ${pick.verdict}`
        + `${pick.card ? ` → no.${pick.card.index} "${pick.card.title}" (${pick.card.priceText})` : ''}`);
      return {
        reply      : pick.reply,
        replyParts : [pick.reply],
        provider   : 'listing_selection_gate',
        contextSource,
      };
    }
    if (pick && !backendMayCompose) {
      gateFacts.push(`PILIHAN CUSTOMER ATAS KATALOG YANG SUDAH DIKIRIM (fakta, jangan ditebak ulang):\n${pick.reply}`);
    }

    // require lokal, BUKAN di puncak file: aiPromptBuilderService berada di sisi
    // lain pipeline dan me-require balik modul-modul di sekitarnya. Menariknya
    // ke atas berisiko siklus require yang muncul sebagai export undefined saat
    // runtime — jauh lebih mahal didiagnosis daripada satu require di jalur ini.
    // M162: dihitung SEKALI di Step 3 (qualState) — jangan panggil ulang
    // extractQualificationState() di sini. Dua pemanggilan atas input yang sama
    // hanya membuang waktu DAN membuka celah dua salinan state yang berbeda.
    const qs = qualState || {};
    // Nama slot hulu tidak bisa dipercaya (qs.city pernah berisi 'pakuwon'),
    // jadi kota vs area diputuskan dari tabel `cities`, bukan dari nama slot.
    // `detectLandmark(message)` ikut jadi kandidat — TANPA ini pesan pembuka
    // "Saya mau beli apartemen di Surabaya, Kutisari" hanya menghasilkan
    // city='Surabaya' dan area=null: qs.district kosong dan filters.landmark
    // kosong pada giliran pertama, sehingga area yang JELAS-JELAS disebut
    // customer di kalimat yang sama tidak pernah terbaca. Akibatnya di
    // transkrip 25 Agu: bot balas "di area mana?" untuk area yang baru saja
    // disebutkan. detectLandmark() membaca langsung dari master lokasi (1.738
    // entri) dan menemukan "KUTISARI" dengan benar.
    // ⚠️ M160: URUTAN KANDIDAT DIBALIK — deteksi dari PESAN SAAT INI harus
    // menang atas qs.district/qs.city (state lintas-giliran yang bisa BASI).
    // Bug nyata (transkrip 28 Agu 2026): customer sebut "Chandramas", ditolak,
    // pindah kota ke "Sidoarjo", lalu tanya "Di Buduran ada ta?" — tapi
    // qs.district masih "Chandramas" dari 2 giliran sebelumnya dan menang
    // duluan di daftar lama, sehingga gerbang TERUS mengulang jawaban
    // Chandramas walau customer sudah jelas-jelas bertanya area lain.
    // detectLandmark(message)/filters.landmark membaca pesan SAAT INI saja,
    // jadi ditaruh paling depan; qs.* tetap jadi cadangan bila pesan saat ini
    // sama sekali tidak menyebut area (mis. jawaban pendek "Ya benar").
    const { city: realCity, area: resolvedArea } = await resolveCityAndArea([
      detectLandmark(message), filters.landmark, qs.district, qs.city, qs.anchorPoint,
      filters.location,
    ]);

    // ⚠️ Cadangan terakhir: detectLandmark() hanya mengenali PATOKAN (mal,
    // stasiun, wisata) — untuk "Kutisari" ia mengembalikan string kosong,
    // karena Kutisari itu AREA/kawasan, bukan landmark. Diverifikasi langsung:
    //   detectLandmark("...di Surabaya, Kutisari") === ""
    //   findAreaInText(...)                        === "Kutisari"
    // findAreaInText mencocokkan ke daftar area NYATA milik agent, jadi ini
    // bukan tebakan — dan tanpa itu pesan pembuka yang sudah memuat keempat
    // slot tetap dibalas "di area mana di Surabaya?" (keluhan pemilik proyek).
    const realArea = resolvedArea
      || await findAreaInText({ userId: agentUserId, city: realCity, text: message });
    const txRaw   = qs.transactionType || filters.transactionType || '';
    const typeRaw = qs.buildingType   || filters.buildingType    || '';
    let   txDb    = /rent|sewa/i.test(txRaw) ? 'Rent' : (/sale|beli|jual/i.test(txRaw) ? 'Sale' : '');

    // ⚠️ Cadangan: baca transaksi LANGSUNG dari teks customer bila slot kosong.
    // extractQualificationState() memulai pemindaian dari pesan AI, sehingga
    // apa pun yang dinyatakan di pesan customer PERTAMA tidak terlihat (bug
    // yang sudah tercatat). Pada transkrip nyata kalimat pembukanya persis
    // "Saya mau sewa apartemen" — jadi justru kasus yang paling penting yang
    // hilang. Tanpa cadangan ini gerbang tidak pernah menyala di percakapan
    // yang memicunya. Hanya membaca pesan CUSTOMER; teks AI memuat kata
    // "sewa/beli" di pertanyaannya sendiri dan akan salah baca.
    if (!txDb) {
      // ⚠️ getConversationHistory() mengembalikan { role, message, ... } —
      // field-nya `message`, BUKAN `content`, dan peran customer disimpan
      // sebagai 'user' (lihat saveUserMessage di sessionService.js). Versi
      // pertama membaca h.content dan menyaring 'customer' saja, jadi teksnya
      // SELALU kosong dan cadangan ini tidak pernah bekerja — gagal senyap yang
      // hanya ketahuan karena diuji lewat generateWhatsAppAIReply() sungguhan,
      // bukan lewat fungsi dalam yang nyaman.
      const custOnly = [
        ...history
          .filter((h) => /^(customer|user|human)$/i.test(String(h.role || '')))
          .map((h) => h.message || h.content || ''),
        message,
      ].join(' \n ');
      if (/\b(sewa|ngontrak|kontrak|rent(?:al)?)\b/i.test(custOnly)) txDb = 'Rent';
      else if (/\b(beli|membeli|dijual|jual|purchase|buy)\b/i.test(custOnly)) txDb = 'Sale';
    }
    // properties.building_type memakai Kapital ('Apartment'), filters lowercase.
    const typeDb  = typeRaw ? String(typeRaw).charAt(0).toUpperCase() + String(typeRaw).slice(1).toLowerCase() : '';

    /* ── ★ M164: GERBANG KOTA — dicek SEBELUM gerbang area ★ ─────────────────
     * Transkrip produksi 29 Agu 2026: customer bilang "sewa rumah di Madiun"
     * — Natasha NOL listing di Madiun sama sekali (kotanya sendiri tidak ada
     * di katalog, bukan cuma areanya). Tanpa gerbang ini, alur lanjut ke Q2c
     * ("di area mana di Madiun?") memakai daftar kawasan STATIS
     * (locationLandmarks.js) seolah kotanya valid — customer bertanya "Anda
     * punya listing dimana?" empat kali dan tetap dibalas soal area yang
     * tidak pernah ia sebut.
     *
     * `realCity` di sini SUDAH tervalidasi sebagai nama kota nyata
     * (resolveCityAndArea hanya mengisi city bila cocok baris tabel `cities`),
     * jadi aman dicek langsung ke katalog agent tanpa menunggu area disebut.
     */
    if (realCity && (txDb || typeDb)) {
      const cityHit = await tryCityAvailabilityAnswer({
        userId: agentUserId, city: realCity,
        buildingType: typeDb || undefined, transactionType: txDb || undefined,
        typeLabel: typeRaw ? humanBuildingType(String(typeRaw).toLowerCase()) : 'properti',
        isId: isIdMsg,
      });
      if (cityHit && backendMayCompose) {
        console.log(`[WhatsAppAI] 🏙️ Gerbang kota: "${realCity}" tidak ada di katalog agent — dijawab dengan kota alternatif nyata.`);
        return {
          reply      : cityHit.reply,
          replyParts : [cityHit.reply],
          provider   : 'city_availability_gate',
          contextSource,
        };
      }
      if (cityHit && !backendMayCompose) {
        gateFacts.push(`KETERSEDIAAN KOTA (fakta katalog agent):\n${cityHit.reply}`);
      }
    }

    /* ── KAPAN GERBANG BOLEH BICARA (M155) ──────────────────────────────────
     * Dua pemicu, bukan satu:
     *
     * (a) Customer BERTANYA ketersediaan/minta listing — sudah sejak M152.
     *
     * (b) Empat slot inti sudah lengkap (transaksi + tipe + kota + area),
     *     WALAU customer tidak bertanya apa pun. Directive pemilik proyek
     *     (26 Agu 2026): "Ketika AI mendapatkan informasi tipe transaksi, tipe
     *     property, lokasi area dan kota; AI langsung memberikan 2 listing-an."
     *
     *     Ini menutup celah yang terlihat di transkrip 25 Agu: pesan PEMBUKA
     *     "Hi... Saya mau beli apartemen di Surabaya, Kutisari" sudah memuat
     *     keempat slot, tapi karena berbentuk PERNYATAAN (bukan pertanyaan),
     *     gerbang diam dan bot malah bertanya "di area mana?" — area yang baru
     *     saja disebut customer di kalimat yang sama.
     *
     * Penjaga `listingsAlreadyShown`: begitu kartu listing pernah terkirim,
     * pemicu (b) berhenti supaya percakapan tidak mengulang blok listing yang
     * sama tiap giliran. Pemicu (a) tetap hidup — kalau customer memang minta
     * lagi ("minta 4 listing"), itu permintaan eksplisit dan harus dilayani.
     */
    const listingsAlreadyShown = history.some((h) => /^(ai|assistant)$/i.test(String(h.role || ''))
      && /Estimasi Harga|Estimated Price/i.test(String(h.message || h.content || '')));
    const fourSlotsKnown = Boolean(txDb && typeDb && realCity && realArea);
    const gateShouldSpeak = customerAsksAvailability(message)
      || (fourSlotsKnown && !listingsAlreadyShown);

    if (agentUserId && realArea && txDb && gateShouldSpeak) {
      const hit = await tryAreaAvailabilityAnswer({
        userId: agentUserId, city: realCity, area: realArea,
        buildingType: typeDb || undefined, transactionType: txDb,
        // Label Indonesia ("apartemen", bukan "apartment") — pakai peta yang
        // sudah ada supaya tidak lahir daftar tipe kedua yang bisa menyimpang.
        typeLabel: typeRaw ? humanBuildingType(String(typeRaw).toLowerCase()) : 'properti',
        message, isId: isIdMsg, persistedBudgetText: qs.budget || '',
      });
      if (hit && backendMayCompose) {
        console.log(`[WhatsAppAI] 📊 Gerbang ketersediaan: ${hit.verdict} untuk "${realArea}" (${txDb}) — dijawab dengan data katalog, alur interview dilewati.`);
        return {
          reply      : hit.reply,
          // ⚠️ M165: WAJIB dipecah. Gerbang ini merender KARTU LISTING, dan
          // versi lama mengirim head + semua kartu + kalimat penutup sebagai
          // SATU pesan WhatsApp raksasa — persis bentuk yang membuat pertanyaan
          // penutup tidak terbaca (lihat catatan di utils/replySplitter.js).
          // Untuk balasan non-katalog (apologi "belum ada di data saya"),
          // splitCatalogReply() mengembalikan [teks] apa adanya.
          replyParts : splitCatalogReply(hit.reply),
          provider   : 'area_availability_gate',
          contextSource,
        };
      }
      if (hit && !backendMayCompose) {
        // Profil 'platform': stok nyata disuntikkan sebagai FAKTA KATALOG.
        // Ini justru inti "vektor + RAG" yang memang tugas backend — model
        // mendapat angka yang benar (0 unit sewa di Pakuwon, 19 dijual) tanpa
        // backend ikut menyusun kalimatnya.
        console.log(`[WhatsAppAI] 📊 Ketersediaan "${realArea}" (${txDb}): ${hit.verdict} — dikirim sebagai konteks ke platform AI.`);
        gateFacts.push(`KETERSEDIAAN NYATA DI KATALOG AGENT:\n${hit.reply}`);
      }
    }
  } catch (availErr) {
    // Fail-open: gerbang non-kritis tidak boleh menghentikan balasan.
    console.warn('[WhatsAppAI] area availability gate failed (non-fatal):', availErr.message);
  }

  // ── ★ M133: GERBANG KUALIFIKASI TUNDUK PADA PROFIL GUARDRAIL ★ ───────────
  // Directive pemilik proyek (24 Agu 2026): saat AI_PRIMARY_PROVIDER BUKAN
  // 'private', backend TIDAK BOLEH ikut menentukan isi balasan — platform AI
  // (ChatGPT/Kimi/Claude/Qwen/DeepSeek) yang memutuskan, dipandu skill .md.
  //
  // buildQualifyReply() adalah backend MENYUSUN KALIMAT BALASAN (pertanyaan
  // Q1 "sewa atau beli?"), bukan sekadar menyaring — jadi di profil 'platform'
  // ia HARUS dilewati. Terbukti langsung saat verifikasi: dengan primary=
  // chatgpt, gerbang ini tetap membalas sendiri dan ChatGPT TIDAK PERNAH
  // melihat pesan customer sama sekali. LLM sudah punya instruksi Q1-Q14 penuh
  // di skill docs (doc 04) — ia mampu menanyakannya sendiri, DAN kini punya
  // blok KATALOG NYATA AGENT (Step 3.3) untuk menjawab dengan data asli.
  //
  // ⛔ BEDA dengan jaring pengaman M129/M130/M132 (terminologi & jarak) yang
  // SENGAJA DIPERTAHANKAN di kedua profil: itu mencegah LLM MENGARANG fakta
  // legal/numerik (kelas bug M84/M96), bukan mengatur gaya percakapan.
  // Dikonfirmasi ulang pemilik proyek 24 Agu 2026 ("keep the safety nets").
  // guardProfile sudah dihitung di awal fungsi (M158) — jangan hitung ulang.

  if (qualResponse && guardProfile === 'local') {
    console.log('[WhatsAppAI] 🛑 Qualification gate triggered — asking for missing info:', {
      hasType    : !!filters.buildingType,
      hasTx      : !!filters.transactionType,
      hasCity    : !!filters.location,
      // M162: slot ke-4 = lokasi spesifik, BUKAN budget. Budget tetap dicatat
      // untuk diagnosis, tapi tidak lagi menentukan gerbang ini.
      hasSpecific: !!(filters.district || filters.area || filters.landmark),
      budgetKnown: !!filters.budget,
      profile    : guardProfile,
    });
    return qualResponse;
  }
  if (qualResponse && guardProfile === 'platform') {
    console.log('[WhatsAppAI] ➡️  Gerbang kualifikasi DILEWATI (profil platform) — ' +
                'platform AI yang akan menanyakan Q1-Q14 sendiri sesuai skill docs.');
  }

  console.log('[WhatsAppAI] ✅ Proceeding to AI:', {
    type    : filters.buildingType,
    tx      : filters.transactionType,
    location: filters.location,
    budget  : filters.budget?.text || 'set',
  });

  // ── Step 3.2: LOAD AI CONTEXT BLOCKS (facilities + cities + landmarks from DB) ─
  let facilityContext = '';
  let cityContext     = '';
  let locationContext = '';
  try {
    const ctx = await loadAIContextBlocks(message, history);
    facilityContext = ctx.facilityContext || '';
    cityContext     = ctx.cityContext     || '';
    locationContext = ctx.locationContext || '';
    if (ctx.detectedCities.length) {
      console.log('[WhatsAppAI] 🏙️ Detected cities in message:', ctx.detectedCities.join(', '));
    }
  } catch (err) {
    console.warn('[WhatsAppAI] Context blocks load failed:', err.message);
  }

  // ── Step 3.3: AGENT COVERAGE (M133) ───────────────────────────────────────
  // FAKTA katalog agent ini: kota mana yang ada stok, area mana yang ada
  // isinya, rentang harga nyata. Tanpa ini, LLM tidak punya cara menjawab
  // "saya punya listing di kota mana saja?" atau "area X kosong, adanya Y"
  // selain MENEBAK — kelas bug M84/M96 (mengarang nama area) yang mahal.
  //
  // ⛔ Ini DATA, bukan keputusan. Backend tidak memilih kota/area mana yang
  // ditawarkan, tidak menyusun kalimatnya, dan tidak memutuskan balas/diam —
  // semua itu tetap wewenang platform AI (directive M131, ditegaskan ulang
  // 24 Agu 2026). Pola identik dengan facilityContext/cityContext/ragContext.
  // Fail-open: kegagalan apa pun → '' (nol token, balasan tetap jalan).
  let agentCoverageContext = '';
  try {
    const coverage = await getAgentCoverage(agentUserId);
    agentCoverageContext = buildAgentCoverageContext(coverage, filters);
  } catch (err) {
    console.warn('[WhatsAppAI] Agent coverage gagal, dilewati (fail-open):', err.message);
  }

  // ── Step 3.35: IDENTITAS AGENSI AGENT (M138) ──────────────────────────────
  // Menjawab "Kakak dari agensi/developer mana?" dengan DATA
  // (users.developer_property_id), bukan tebakan. Fakta, bukan perintah.
  let agentIdentityContext = '';
  try {
    agentIdentityContext = buildAgentIdentityContext(await getAgentIdentity(agentUserId));
  } catch (err) {
    console.warn('[WhatsAppAI] Agent identity gagal, dilewati (fail-open):', err.message);
  }

  // ── Step 3.4: SYARAT MINIMUM LISTING (M134) ───────────────────────────────
  // Directive pemilik proyek: listing boleh tampil begitu tipe + transaksi +
  // kota + LOKASI SPESIFIK (area/landmark/commercial) diketahui — budget BUKAN
  // syarat lagi (customer lazim menyesuaikan harga setelah melihat pilihan).
  // Dikirim sebagai FAKTA, bukan perintah; platform AI yang menyusun kalimat.
  let listingReadinessContext = '';
  try {
    listingReadinessContext = buildListingReadinessContext(evaluateListingReadiness(filters));
  } catch (err) {
    console.warn('[WhatsAppAI] Listing readiness gagal, dilewati (fail-open):', err.message);
  }

  // Append facility + city + landmark + coverage context to propertyCtx so it reaches all AI providers
  /* M158 — fakta gerbang untuk profil 'platform'.
   * Di profil 'local' array ini SELALU kosong (gerbang sudah membalas sendiri
   * dan fungsi ini tidak pernah sampai ke sini). Di profil 'platform' berisi
   * definisi istilah legal dan/atau angka ketersediaan nyata dari katalog —
   * bahan yang membuat model tidak perlu menebak, tanpa backend ikut memilih
   * kata-katanya. */
  const gateFactsContext = gateFacts.length
    ? ['════ FAKTA TERVERIFIKASI DARI BACKEND ════',
      'Angka & definisi di bawah berasal langsung dari database agent.',
      'Pakai sebagai sumber kebenaran; jangan menyebut angka lain.',
      '',
      gateFacts.join('\n\n'),
      '══════════════════════════════════════════'].join('\n')
    : '';

  const enrichedPropertyCtx = [propertyCtx, facilityContext, cityContext, locationContext, agentCoverageContext, agentIdentityContext, listingReadinessContext, gateFactsContext].filter(Boolean).join('\n\n');

  // ── Step 3.6: RAG CONTEXT (opsional, RAG_ENABLED=OFF secara default) ──────
  // Melengkapi prompt dengan (a) pengetahuan jual-beli properti Indonesia yang
  // TERVERIFIKASI (legalitas/pajak/KPR — mencegah LLM mengarang angka pajak/
  // syarat bank) dan (b) listing katalog agent ini yang cocok SECARA MAKNA,
  // di luar filter SQL biasa (mis. "yang cocok buat keluarga muda").
  // ⚠️ Ini TIDAK PERNAH menggantikan aturan inti — hanya melengkapi. Lihat
  // ragRetrievalService.js untuk kenapa aturan perilaku TIDAK lewat RAG.
  // Fail-open MUTLAK di dalam buildRagContext(): kegagalan apa pun → ''.
  let ragContext = '';
  try {
    ragContext = await buildRagContext({
      customerMessage : message,
      history,
      agentUserId,
      buildingType    : filters?.buildingType,
      transactionType : filters?.transactionType,
      // ⚠️ M134 — WAJIB true, kalau tidak RAG praktis MATI. `retrieveSkillReference`
      // opt-in dan TIDAK ADA pemanggil produksi yang pernah menyalakannya; sejak
      // M131 memindahkan korpus legalitas/pajak/KPR dari namespace
      // PROPERTY_KNOWLEDGE ke SKILL_DOCS, `retrievePropertyKnowledge()`
      // (satu-satunya blok yang menyala otomatis) selalu mengembalikan kosong.
      // Akibatnya buildRagContext() SELALU '' walau RAG_ENABLED=ON dan indeks
      // berisi 151 chunk — diverifikasi langsung, bukan dugaan.
      // Aman mid-interview: yang diambil di sini REFERENSI PERILAKU (doc
      // 07/08/10/11/12/13/14/15), BUKAN listing. Blok katalog semantik
      // (includeAgentCatalog) TETAP opt-in & mati — itu yang berisiko bocor
      // sebelum brief (lihat catatan panjang di ragRetrievalService.js).
      includeSkillReference: true,
    });
  } catch (err) {
    console.warn('[WhatsAppAI] RAG context gagal, dilewati:', err.message);
  }

  // ── Step 3.5: CHECK AI_PRIMARY_PROVIDER ───────────────────────────────────
  //
  // AI_PRIMARY_PROVIDER: 'chatgpt' | 'claude' | 'qwen' | 'deepseek' | 'kimi' | 'private'
  //
  // ✨ PROVIDER FALLBACK (Tingkatkan penggunaan AI):
  //   QWEN    → Try QWEN     → Error? → Fallback Private Agent
  //   Claude  → Try Claude   → Error? → Fallback Private Agent
  //   ChatGPT → Try ChatGPT  → Error? → Fallback Private Agent
  //   DeepSeek→ Try DeepSeek → Error? → Fallback Private Agent
  //   Kimi    → Try Kimi     → Error? → Fallback Private Agent
  //   private → Private Agent only (skip all external AI)
  //
  // Fallback otomatis jika primary provider gagal (token error, billing, API error, timeout).
  // Private Agent selalu tersedia sebagai backup terakhir.
  //
  // AI selalu menjalankan Q1-Q12 interview. RESPOND_CATALOG_RUN hanya mengontrol
  // apakah setelah brief ditampilkan, rekomendasi catalog juga ikut ditampilkan atau tidak.
  const primaryProvider       = String(process.env.AI_PRIMARY_PROVIDER || 'chatgpt').toLowerCase().trim();
  // Per-agent (users.catalog_summary), sudah di-resolve di awal pipeline.
  const showCatalogAfterBrief = catalogMode === 'ON';
  const shouldCallAIProviders = primaryProvider !== 'private';

  if (!shouldCallAIProviders) {
    console.log('[WhatsAppAI] 🛑 AI_PRIMARY_PROVIDER=private → using Private Agent only');
    // Fall through to Step 5 (Private Agent)

  } else {
    console.log('[WhatsAppAI] ✅ Calling AI provider:', {
      primaryProvider,
      respondCatalogRun: showCatalogAfterBrief ? 'ON (brief + catalog)' : 'OFF (brief only)',
    });

    try {
      const result = await generateWhatsappReplyWithProviderFallback(
        session,
        history,
        message,
        propertyCtx,
        { facilityContext, cityContext, locationContext, agentCoverageContext, agentIdentityContext, listingReadinessContext, ragContext }
      );

      // ★ M131: sinyal diam dari platform API ★ — model memutuskan SENDIRI
      // pesan ini di luar topik (per skill doc §3c) dan tidak perlu dibalas.
      // Backend tidak menebak/menge-override keputusan ini — deteksi murni
      // dari token, bukan dari analisis teks balasan.
      if (isSilentSentinel(result.reply)) {
        console.log(`[WhatsAppAI] 🤫 ${result.provider} memutuskan diam (sentinel off-topic) — tidak ada balasan dikirim.`);
        return { reply: null, replyParts: [], provider: result.provider, contextSource, silent: true };
      }

      // Jaring pengaman DETERMINISTIK: model kadang tetap menulis "[Nama Agen]"
      // / "${agentName}" alih-alih nama sungguhan, meski nama itu sudah tertulis
      // apa adanya di prompt DAN dilarang eksplisit (M85). Ganti di sisi kirim —
      // nol token tambahan, dan menutup kelas bug ini untuk SEMUA provider.
      const guarded = guardReplyIdentity(result.reply, {
        agentName: session?.agentName || agentName,
        appName  : process.env.APP_NAME || 'Elevan Property',
      });
      if (guarded.replaced > 0) {
        console.warn(`[WhatsAppAI] ⚠️ ${result.provider} menulis ${guarded.replaced} placeholder identitas ` +
                     `di balasan — diganti nama sungguhan sebelum kirim (M85).`);
      }
      return {
        reply         : guarded.text,
        replyParts    : splitCatalogReply(guarded.text),
        provider      : result.provider,
        contextSource,
      };
    } catch (err) {
      console.warn('[WhatsAppAI] AI providers failed — falling back to Private Agent:', err.message);
    }
  }

  // ── Step 5: Fallback to Private Agent ──────────────────────────────────────
  try {
    // Lazy require untuk hindari circular dependency
    const { generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');

    // Do NOT pre-load recommendation context here — the private agent loads property
    // data only when all Q1-Q12 are answered and it's about to show the summary/catalog.
    // Loading 8831 properties on every Q-flow message wastes DB round-trips.
    const result = await generatePrivateTerminalMassege({
      session,
      history,
      userMessage          : message,
      agentName,
      agentUserId,
      recommendationContext: null,
      externalError        : new Error('ChatGPT and Claude unavailable for WhatsApp reply'),
    });

    console.log(`[WhatsAppAI] Private Agent used (${result.exactMatches || 0} exact, ` +
                `${result.alternatives || 0} alt, ${result.rumah123Listings || 0} rumah123)`);

    return {
      reply         : result.reply,
      replyParts    : result.replyParts || splitCatalogReply(result.reply),
      provider      : 'private_agent',
      contextSource,
    };
  } catch (privateErr) {
    console.error('[WhatsAppAI] Private Agent also failed:', privateErr.message);

    // Jika primary=private dan Private Agent gagal → coba external AI (Claude → ChatGPT → QWEN)
    if (primaryProvider === 'private') {
      try {
        console.warn('[WhatsAppAI] primary=private & Private Agent failed → trying external AI fallback');
        const aiResult = await generateWhatsappExternalAIFallback(
          session, history, message, enrichedPropertyCtx, { facilityContext, cityContext, agentCoverageContext, agentIdentityContext, listingReadinessContext, ragContext }
        );

        // ★ M131 ★ — sentinel diam berlaku sama di jalur fallback eksternal ini,
        // karena ini juga jawaban langsung dari platform API (Claude/ChatGPT/QWEN).
        if (isSilentSentinel(aiResult.reply)) {
          console.log(`[WhatsAppAI] 🤫 ${aiResult.provider} memutuskan diam (sentinel off-topic, fallback eksternal) — tidak ada balasan dikirim.`);
          return { reply: null, replyParts: [], provider: aiResult.provider, contextSource, silent: true };
        }

        // Guard identitas yang sama (M85) — jalur fallback eksternal juga
        // dilayani provider LLM, jadi punya kelas bug yang persis sama.
        const guardedExt = guardReplyIdentity(aiResult.reply, {
          agentName: session?.agentName || agentName,
          appName  : process.env.APP_NAME || 'Elevan Property',
        });
        if (guardedExt.replaced > 0) {
          console.warn(`[WhatsAppAI] ⚠️ ${aiResult.provider} menulis ${guardedExt.replaced} placeholder ` +
                       `identitas — diganti nama sungguhan sebelum kirim (M85).`);
        }
        return {
          reply      : guardedExt.text,
          replyParts : splitCatalogReply(guardedExt.text),
          provider   : aiResult.provider,
          contextSource,
        };
      } catch (extErr) {
        console.error('[WhatsAppAI] External AI fallback also failed:', extErr.message);
      }
    }

    // ── Last resort ────────────────────────────────────────────────────────────
    const name = session?.name || 'Pelanggan';
    const lastResortReply = `Halo *${name}*! 👋\n\nTerima kasih telah menghubungi saya. Saya akan segera membalas pesan Anda dengan informasi properti yang sesuai.\n\nMohon tunggu sebentar 🙏`;
    return {
      reply         : lastResortReply,
      replyParts    : [lastResortReply],
      provider      : 'fallback_generic',
      contextSource : 'none',
    };
  }
}

/**
 * Wrapper publik generateWhatsAppAIReply() — sama seperti versi inti di atas,
 * ditambah SATU gerbang deterministik: bila balasan yang baru dihasilkan
 * adalah SUMMARY dan customer ini belum pernah ditanya namanya
 * (customers.ask_name = 'NO'), balasan ditukar dengan pertanyaan nama —
 * summary yang sesungguhnya BARU dikirim giliran berikutnya.
 *
 * Kenapa aman ditukar begitu saja (bukan disimpan lalu dikirim susulan):
 * qualification state SUDAH lengkap di titik ini dan bersifat idempoten — AI
 * akan menghasilkan ulang summary yang PERSIS SAMA di giliran berikutnya dari
 * state yang tidak berubah, begitu customerRegistrationService menandai
 * ask_name='YES' (lewat jawaban ATAU penolakan). Tidak ada data yang hilang.
 *
 * Satu call-site ini otomatis melindungi SEMUA jalur balasan (5 provider LLM,
 * Private Agent, external fallback) karena semuanya bermuara ke return value
 * _generateWhatsAppAIReplyCore() — pola yang sama dipatuhi RAG (M92) & guard
 * identitas (M85) di fungsi ini juga.
 *
 * Fail-open MUTLAK: kegagalan lookup DB apa pun (atau `phone` tidak dikirim
 * pemanggil) → balasan asli tetap dikirim tanpa gangguan. Menanyakan nama
 * adalah penyempurnaan UX, BUKAN gerbang bisnis kritis — tidak boleh pernah
 * memblokir summary yang sudah selesai dihasilkan.
 *
 * @param {object} params - sama seperti _generateWhatsAppAIReplyCore, PLUS:
 *   @param {string|null} params.phone - nomor WA customer (lookup ask_name)
 */
async function generateWhatsAppAIReply(params) {
  // ── M130: pertanyaan JARAK & WAKTU TEMPUH ke properti — dijawab
  // DETERMINISTIK, SEBELUM memanggil LLM sama sekali (bukan sekadar konteks
  // yang disuntik ke prompt). Alasan: angka jarak/waktu adalah fakta yang
  // HARUS akurat — menyuntikkannya sebagai konteks lalu berharap LLM
  // menyalin persis tanpa membulatkan/mengarang ulang adalah risiko yang
  // sama seperti kelas bug "AI mengarang nama area" (M84/M92), hanya untuk
  // domain angka jarak yang salahnya bisa membuat customer salah rencana
  // perjalanan. GOOGLE_ENABLED=false (keputusan pemilik proyek) — estimasi
  // HANYA dari tabel koordinat kota statis (utils/cityGeoData.js), jarak
  // garis lurus, bukan rute jalan presisi; selalu dinyatakan sebagai
  // estimasi. Fail-open: hanya menjawab bila KEDUA kota (asal & tujuan)
  // disebutkan eksplisit di pesan yang sama DAN dikenali tabel — di luar
  // itu, `null` dan alur normal (LLM/Private Agent) berjalan seperti biasa.
  try {
    const { tryAnswerDistanceQuery } = require('./distanceEstimationService');
    const distanceReply = tryAnswerDistanceQuery(params.message);
    if (distanceReply) {
      return {
        reply: distanceReply,
        replyParts: [distanceReply],
        provider: 'distance_estimation',
        contextSource: 'none',
      };
    }
  } catch (err) {
    console.warn('[WhatsAppAI] Estimasi jarak gagal (fail-open, lanjut ke LLM):', err.message);
  }

  const result = await _generateWhatsAppAIReplyCore(params);
  if (result.silent) return result;   // M131: platform API diam — jangan diproses lebih lanjut
  try {
    const { phone, agentUserId = null } = params;
    if (!phone || !agentUserId) return result;

    const { replyContainsSummary, getIdentityStatus, aiAlreadyAskedName } =
      require('./customerRegistrationService');
    if (!replyContainsSummary(result.reply)) return result;

    const status = await getIdentityStatus({ agentUserId, phone });
    if (status.askName === 'YES') return result;

    // ⛔ M142 — JANGAN tanya nama DUA KALI (bug produksi 25 Agu 2026).
    // customers.ask_name baru di-set 'YES' oleh syncCustomerFromChat() yang
    // berjalan SETELAH balasan ini dibuat & dikirim. Jadi pada giliran
    // BERIKUTNYA (saat customer sudah menjawab "Saya Agus"), status.askName
    // MASIH 'NO' — dan gerbang ini menukar summary dengan pertanyaan nama
    // untuk KEDUA KALINYA. Transkrip nyata:
    //   AI  : "boleh saya tahu nama Kakak?"
    //   Cust: "Saya Agus, Kak"
    //   AI  : "boleh saya tahu nama Kakak?"      ← diulang
    // Kolom DB saja tidak cukup karena urutannya memang selalu terlambat satu
    // giliran; yang menentukan adalah APA yang sudah AI tanyakan di riwayat.
    let alreadyAsked = false;
    try {
      const recent = await getConversationHistory(params.session?.id, 8);
      alreadyAsked = aiAlreadyAskedName(recent);
    } catch (_) { /* fail-open: lebih baik bertanya sekali lagi daripada crash */ }
    if (alreadyAsked) return result;   // sudah pernah ditanya → kirim summary-nya

    const askText = 'Sebelum saya sampaikan ringkasannya — boleh saya tahu nama Kakak? 😊\n\n_(Kalau belum ingin menyebutkan, tidak apa-apa — cukup balas "lewati")_';
    return {
      ...result,
      reply      : askText,
      replyParts : [askText],
      provider   : 'qualification',
    };
  } catch (err) {
    console.warn('[WhatsAppAI] Gerbang tanya-nama gagal (fail-open, summary tetap dikirim):', err.message);
    return result;
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Analyze apakah pesan adalah property query + fetch context.
 */
async function analyzePropertyMessage(message) {
  const { hasPropertyKeyword } = require('../utils/propertyKeywordFilter');

  if (!hasPropertyKeyword(message)) return null;

  try {
    const result = await getWhatsappPropertyContext(message);
    return {
      isPropertyQuery : true,
      context         : result.contextText,
      contextSource   : result.source,
      location        : result.location,
      propertyType    : result.propertyType,
      transactionType : result.transactionType,
    };
  } catch (err) {
    console.warn('[WhatsAppAI] Property analysis failed:', err.message);
    return {
      isPropertyQuery : true,
      context         : '',
      contextSource   : 'error',
      location        : null,
      propertyType    : null,
      transactionType : null,
    };
  }
}

/**
 * Format WhatsApp response dengan metadata.
 */
function formatWhatsAppResponse(params) {
  const { reply, provider, contextSource, agentName, customerPhone } = params;
  return {
    text: reply,
    metadata: {
      aiProvider    : provider,
      contextSource,
      agentName,
      timestamp     : new Date().toISOString(),
      channel       : 'whatsapp',
    },
  };
}

module.exports = {
  generateWhatsAppAIReply,
  analyzePropertyMessage,
  formatWhatsAppResponse,
  normalizeAiResponderLabel,
  buildQualifyReply,
};

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
        extractPropertyFilters }                    = require('./propertyRecommendationService');
const { getConversationHistory }                    = require('./sessionService');
const { loadAIContextBlocks }                       = require('./aiContextService');
const { splitCatalogReply }                         = require('../utils/replySplitter');
const { resolveCatalogMode, envFallbackMode }       = require('./catalogModeService');
const { guardReplyIdentity }                        = require('../utils/replyIdentityGuard');
const sessionAnchors                                = require('../utils/sessionAnchors');
const { expandAbbreviations }                       = require('../utils/lazyChatNormalizer');

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
 *   'chatgpt'|'claude'|'qwen'|'deepseek'|'kimi'  → apa adanya (provider asli menjawab)
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
  const KNOWN_PROVIDERS = new Set(['chatgpt', 'claude', 'qwen', 'deepseek', 'kimi']);
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
 *   3) Lokasi          (location)
 *   4) Range harga     (budget)
 *
 * Jika ada yang kurang → kembalikan pertanyaan yang sopan & informatif.
 * Jika semua lengkap   → kembalikan null (lanjut ke AI provider).
 *
 * Pertanyaan bersifat KUMULATIF — satu pesan bisa menanyakan ≥ 1 info
 * jika banyak yang kurang (untuk efisiensi konversasi).
 *
 * @param {object} filters   - Hasil extractPropertyFilters()
 * @param {string} message   - Pesan customer terbaru
 * @param {string} agentName - Nama agent (untuk tanda tangan)
 * @param {string} contextSource
 * @param {Array}  history   - Conversation history (untuk language detection)
 * @returns {{ reply, provider, contextSource } | null}
 */
function buildQualifyReply(filters, message, agentName, contextSource, history = [], catalogMode = null) {
  const { buildingType: type, transactionType: tx, location: loc, budget: bud } = filters;
  // Nama perusahaan dari APP_NAME env (bisa diubah di .env). JANGAN hardcode.
  const appName = process.env.APP_NAME || 'Elevan Property';

  // Semua 4 info sudah ada → proceed to AI
  if (type && tx && loc && bud) return null;

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
  const known   = [type, tx, loc, bud].filter(Boolean).length;
  const txWord  = tx === 'rent'
    ? (id ? 'sewa'  : 'rent')
    : (tx === 'sale' || tx === 'purchase')
      ? (id ? 'beli'  : 'buy')
      : null;
  const typeLbl     = type ? typeLabel(type, id) : null;
  const locLbl      = loc  ? `*${loc}*` : null;

  let question;

  // ── KASUS 1: Belum ada info sama sekali / hanya type yang ada ─────────────
  if (!tx && !loc && !bud) {
    if (!type) {
      // Benar-benar kosong
      question = id
        ? `Halo! 😊 Terima kasih sudah menghubungi *${appName}*.\n\nSaya dengan senang hati akan membantu Anda menemukan properti yang tepat. Sebelum saya carikan pilihan terbaik, boleh saya tanyakan beberapa hal?\n\n1️⃣ Apakah Anda sedang cari untuk *sewa* atau *beli*?\n2️⃣ Tipe properti apa yang Anda inginkan?\n   _Rumah, Apartemen, Villa, Kos-kosan, Ruko, Kantor, Gudang, dll_ 🏡\n3️⃣ Di *kota* mana? _(Contoh: Surabaya, Malang, Bali)_\n4️⃣ Kisaran harga yang Anda siapkan?\n\nSemakin lengkap infonya, semakin tepat rekomendasi yang bisa saya berikan 🙏`
        : `Hello! 😊 Thank you for reaching out to *${appName}*.\n\nI'd love to help you find the perfect property. Before I start searching, may I ask a few things?\n\n1️⃣ Are you looking to *rent* or *buy*?\n2️⃣ What type of property do you have in mind?\n   _House, Apartment, Villa, Boarding House, Shophouse, Office, Warehouse, etc._ 🏡\n3️⃣ Which city or area?\n4️⃣ What's your price range?\n\nThe more details you share, the better I can match your needs 🙏`;
    } else {
      // Type diketahui, sisanya kosong
      question = id
        ? `Terima kasih! 😊 Untuk *${typeLbl}* yang Anda cari, saya butuh beberapa informasi tambahan:\n\n1️⃣ Apakah rencananya untuk *sewa* atau *beli*?\n2️⃣ Di *kota* mana? _(Contoh: Surabaya, Malang, Bali)_\n3️⃣ Kisaran harga yang diinginkan? _(Contoh: 5-10 juta/bulan, atau di bawah 1 miliar)_\n\nSilakan ceritakan kebutuhannya, saya siap bantu! 🏡`
        : `Thank you! 😊 For the *${typeLbl}* you're looking for, I need a bit more information:\n\n1️⃣ Are you planning to *rent* or *buy*?\n2️⃣ Which city or area?\n3️⃣ What's your price range? _(e.g., 5–10 million/month, or under 1 billion)_\n\nPlease share the details and I'll find the best match! 🏡`;
    }
  }

  // ── KASUS 2: Transaction type tidak diketahui ─────────────────────────────
  else if (!tx) {
    const parts = [];
    if (!loc) parts.push(id ? 'Di *kota* mana yang Anda inginkan? 📍 _(Contoh: Surabaya, Malang, Bali)_' : 'Which *city*? 📍');
    if (!bud) parts.push(id ? 'Kisaran harga berapa? _(Contoh: 3-7 juta/bulan)_ 💰' : 'What price range? _(e.g., 3–7 million/month)_ 💰');

    question = id
      ? `Untuk *${typeLbl || 'properti'}* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠${parts.length ? '\n\nSelain itu:\n' + parts.map(p => `• ${p}`).join('\n') : ''}`
      : `For the *${typeLbl || 'property'}* you're looking for — are you planning to *rent* or *buy*? 🏠${parts.length ? '\n\nAlso:\n' + parts.map(p => `• ${p}`).join('\n') : ''}`;
  }

  // ── KASUS 3: Tipe properti tidak diketahui ────────────────────────────────
  else if (!type) {
    const parts = [];
    if (!loc) parts.push(id ? 'Di *kota* mana? 📍 _(Contoh: Surabaya, Malang, Bali)_' : 'Which *city*? 📍');
    if (!bud) parts.push(id ? 'Kisaran harga berapa? 💰' : 'What price range? 💰');

    question = id
      ? `Siap, mau *${txWord}* properti! 🏡\n\nTipe properti apa yang Anda cari?\n_Rumah, Apartemen, Villa, Kos-kosan, Ruko, Kantor, Gudang, atau lainnya_${parts.length ? '\n\nDan juga:\n' + parts.map(p => `• ${p}`).join('\n') : ''}`
      : `Got it, looking to *${txWord}* a property! 🏡\n\nWhat type of property are you looking for?\n_House, Apartment, Villa, Boarding House, Shophouse, Office, Warehouse, or other_${parts.length ? '\n\nAlso:\n' + parts.map(p => `• ${p}`).join('\n') : ''}`;
  }

  // ── KASUS 4: Lokasi tidak diketahui ──────────────────────────────────────
  else if (!loc) {
    const budPart = !bud
      ? (id ? '\n\nDan kisaran harga yang Anda siapkan? _(Contoh: 5-10 juta/bulan, atau 500 juta - 1 miliar)_ 💰' : '\n\nAlso, what price range do you have in mind? _(e.g., 5–10 million/month)_ 💰')
      : '';

    question = id
      ? `Baik! Mau *${txWord} ${typeLbl}*. 📍\n\nDi *kota* mana yang Anda inginkan?\n_(Contoh: Surabaya, Malang, Bali, Jakarta Selatan)_\nKalau sudah ada area/kecamatan tertentu, boleh sekalian disebut ya.${budPart}`
      : `Great! Looking to *${txWord} a ${typeLbl}*. 📍\n\nWhich *city*?\n_(e.g., Surabaya, Malang, Bali, South Jakarta)_\nIf you already have a specific area in mind, feel free to name it too.${budPart}`;
  }

  // ── KASUS 5: Hanya budget yang belum diketahui ────────────────────────────
  else if (!bud) {
    question = id
      ? `Hampir lengkap! Untuk *${txWord} ${typeLbl} di ${loc}* — 💰\n\nKisaran harga yang Anda inginkan berapa?\n_(Contoh: 3-7 juta/bulan, di bawah 500 juta, atau 1-2 miliar)_\n\nJika belum ada angka pasti, cukup ceritakan apakah lebih prefer yang *terjangkau* atau *menengah ke atas* — saya tetap bisa carikan yang sesuai 😊`
      : `Almost there! For *${txWord}ing a ${typeLbl} in ${loc}* — 💰\n\nWhat's your price range?\n_(e.g., 3–7 million/month, under 500 million, or 1–2 billion)_\n\nIf you don't have an exact number, just tell me whether you prefer *affordable* or *mid-to-premium* — I can still find good options 😊`;
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
async function generateWhatsAppAIReply(params) {
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

  const qualResponse = buildQualifyReply(filters, message, agentName, contextSource, history, catalogMode);

  if (qualResponse) {
    console.log('[WhatsAppAI] 🛑 Qualification gate triggered — asking for missing info:', {
      hasType  : !!filters.buildingType,
      hasTx    : !!filters.transactionType,
      hasLoc   : !!filters.location,
      hasBudget: !!filters.budget,
    });
    return qualResponse;
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

  // Append facility + city + landmark context to propertyCtx so it reaches all AI providers
  const enrichedPropertyCtx = [propertyCtx, facilityContext, cityContext, locationContext].filter(Boolean).join('\n\n');

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
        { facilityContext, cityContext, locationContext }
      );
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
          session, history, message, enrichedPropertyCtx, { facilityContext, cityContext }
        );
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
};

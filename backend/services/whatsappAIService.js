/**
 * whatsappAIService.js
 *
 * Unified AI response service untuk semua WhatsApp controllers (Fonnte, WATI, 360dialog).
 *
 * ALUR LENGKAP:
 *   1. Fetch property context (Rumah123 / flat JSON)
 *   2. Get conversation history
 *   3. ★ PRE-QUALIFICATION GATE ★  ← NEW
 *      Pastikan 4 info minimum terpenuhi SEBELUM memanggil AI manapun:
 *        a) Tipe properti   (buildingType)
 *        b) Tipe transaksi  (transactionType: sewa/beli)
 *        c) Lokasi          (location)
 *        d) Range harga     (budget)
 *      Jika ada yang kurang → kembalikan pertanyaan kualifikasi (tanpa panggil API AI)
 *   4. Try ChatGPT → Claude (with property context)
 *   5. Fallback to Private Agent (guaranteed response)
 */

'use strict';

const { generateWhatsappReplyWithProviderFallback } = require('./aiProviderService');
const { getWhatsappPropertyContext }                = require('../utils/whatsappPropertyContext');
const { buildRecommendationContextForLLM,
        extractPropertyFilters }                    = require('./propertyRecommendationService');
const { getConversationHistory }                    = require('./sessionService');

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
    boarding_house: isId ? 'Kos-Kosan'         : 'Boarding House',
    shophouse    : isId ? 'Ruko / Shophouse'   : 'Shophouse',
    office       : isId ? 'Kantor'             : 'Office',
    warehouse    : isId ? 'Gudang'             : 'Warehouse',
    others       : isId ? 'Properti Lainnya'   : 'Other Property',
  };
  return map[type] || type || (isId ? 'Properti' : 'Property');
}

/**
 * Detect language from the customer's message.
 * Returns true if Indonesian, false if English.
 *
 * @param {string} message
 * @returns {boolean}
 */
function isIndonesian(message) {
  const idKeywords = [
    'saya', 'aku', 'mau', 'ingin', 'pengen', 'cari', 'sewa', 'beli',
    'jual', 'ada', 'tolong', 'mohon', 'harga', 'berapa', 'di ', 'yang',
    'rumah', 'villa', 'vila', 'apartemen', 'hotel', 'kos', 'ruko', 'gudang',
    'properti', 'apa', 'dengan', 'dan', 'atau', 'tidak', 'bisa',
  ];
  const lower = (message || '').toLowerCase();
  return idKeywords.some(w => lower.includes(w));
}

/**
 * Build agent signature for qualification messages.
 *
 * @param {string} agentName
 * @param {boolean} isId
 * @returns {string}
 */
function agentSignature(agentName, isId) {
  const name = agentName || 'Elevan Property';
  return isId
    ? `\n\nSalam hangat,\n*${name}*\n*Elevan Property*`
    : `\n\nWarm regards,\n*${name}*\n*Elevan Property*`;
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
 * @returns {{ reply, provider, contextSource } | null}
 */
function buildQualifyReply(filters, message, agentName, contextSource) {
  const { buildingType: type, transactionType: tx, location: loc, budget: bud } = filters;

  // Semua 4 info sudah ada → proceed to AI
  if (type && tx && loc && bud) return null;

  const id  = isIndonesian(message);
  const sig = agentSignature(agentName, id);

  // Hitung berapa yang sudah diketahui
  const known       = [type, tx, loc, bud].filter(Boolean).length;
  const txWord      = tx === 'rent' ? (id ? 'sewa' : 'rent') : tx === 'sale' ? (id ? 'beli' : 'buy') : null;
  const typeLbl     = type ? typeLabel(type, id) : null;
  const locLbl      = loc  ? `*${loc}*` : null;

  let question;

  // ── KASUS 1: Belum ada info sama sekali / hanya type yang ada ─────────────
  if (!tx && !loc && !bud) {
    if (!type) {
      // Benar-benar kosong
      question = id
        ? `Halo! 😊 Terima kasih sudah menghubungi *Elevan Property*.\n\nSaya dengan senang hati akan membantu Anda menemukan properti yang tepat. Sebelum saya carikan pilihan terbaik, boleh saya tanyakan beberapa hal?\n\n1️⃣ Apakah Anda sedang cari untuk *sewa* atau *beli*?\n2️⃣ Tipe properti apa yang Anda inginkan?\n   _Rumah, Apartemen, Villa, Kos-kosan, Ruko, Kantor, Gudang, dll_ 🏡\n3️⃣ Di kota atau area mana?\n4️⃣ Kisaran harga yang Anda siapkan?\n\nSemakin lengkap infonya, semakin tepat rekomendasi yang bisa saya berikan 🙏`
        : `Hello! 😊 Thank you for reaching out to *Elevan Property*.\n\nI'd love to help you find the perfect property. Before I start searching, may I ask a few things?\n\n1️⃣ Are you looking to *rent* or *buy*?\n2️⃣ What type of property do you have in mind?\n   _House, Apartment, Villa, Boarding House, Shophouse, Office, Warehouse, etc._ 🏡\n3️⃣ Which city or area?\n4️⃣ What's your price range?\n\nThe more details you share, the better I can match your needs 🙏`;
    } else {
      // Type diketahui, sisanya kosong
      question = id
        ? `Terima kasih! 😊 Untuk *${typeLbl}* yang Anda cari, saya butuh beberapa informasi tambahan:\n\n1️⃣ Apakah rencananya untuk *sewa* atau *beli*?\n2️⃣ Di kota atau area mana?\n3️⃣ Kisaran harga yang diinginkan? _(Contoh: 5-10 juta/bulan, atau di bawah 1 miliar)_\n\nSilakan ceritakan kebutuhannya, saya siap bantu! 🏡`
        : `Thank you! 😊 For the *${typeLbl}* you're looking for, I need a bit more information:\n\n1️⃣ Are you planning to *rent* or *buy*?\n2️⃣ Which city or area?\n3️⃣ What's your price range? _(e.g., 5–10 million/month, or under 1 billion)_\n\nPlease share the details and I'll find the best match! 🏡`;
    }
  }

  // ── KASUS 2: Transaction type tidak diketahui ─────────────────────────────
  else if (!tx) {
    const parts = [];
    if (!loc) parts.push(id ? 'Di kota atau area mana yang Anda inginkan? 📍' : 'Which city or area? 📍');
    if (!bud) parts.push(id ? 'Kisaran harga berapa? _(Contoh: 3-7 juta/bulan)_ 💰' : 'What price range? _(e.g., 3–7 million/month)_ 💰');

    question = id
      ? `Untuk *${typeLbl || 'properti'}* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠${parts.length ? '\n\nSelain itu:\n' + parts.map(p => `• ${p}`).join('\n') : ''}`
      : `For the *${typeLbl || 'property'}* you're looking for — are you planning to *rent* or *buy*? 🏠${parts.length ? '\n\nAlso:\n' + parts.map(p => `• ${p}`).join('\n') : ''}`;
  }

  // ── KASUS 3: Tipe properti tidak diketahui ────────────────────────────────
  else if (!type) {
    const parts = [];
    if (!loc) parts.push(id ? 'Di kota atau area mana? 📍' : 'Which city or area? 📍');
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
      ? `Baik! Mau *${txWord} ${typeLbl}*. 📍\n\nDi kota atau area mana yang Anda inginkan?\n_(Contoh: Surabaya, Malang, Bali, Jakarta Selatan, dll)_${budPart}`
      : `Great! Looking to *${txWord} a ${typeLbl}*. 📍\n\nWhich city or area are you considering?\n_(e.g., Surabaya, Malang, Bali, South Jakarta, etc.)_${budPart}`;
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
  const { session, message, agentName, options = {} } = params;

  // ── Step 1: Fetch property context ─────────────────────────────────────────
  let propertyCtx  = options.context || '';
  let contextSource = 'none';

  if (!propertyCtx) {
    try {
      const ctxResult = await getWhatsappPropertyContext(message);
      propertyCtx     = ctxResult.contextText || '';
      contextSource   = ctxResult.source       || 'none';
    } catch (err) {
      console.warn('[WhatsAppAI] Context fetch failed:', err.message);
    }
  } else {
    contextSource = options.contextSource || 'provided';
  }

  // ── Step 2: Get conversation history ───────────────────────────────────────
  let history = [];
  try {
    history = await getConversationHistory(session.id, 10);
  } catch (err) {
    console.warn('[WhatsAppAI] History fetch failed:', err.message);
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

  const qualResponse = buildQualifyReply(filters, message, agentName, contextSource);

  if (qualResponse) {
    console.log('[WhatsAppAI] 🛑 Qualification gate triggered — asking for missing info:', {
      hasType : !!filters.buildingType,
      hasTx   : !!filters.transactionType,
      hasLoc  : !!filters.location,
      hasBudget: !!filters.budget,
    });
    return qualResponse;
  }

  console.log('[WhatsAppAI] ✅ Qualification passed — proceeding to AI:', {
    type    : filters.buildingType,
    tx      : filters.transactionType,
    location: filters.location,
    budget  : filters.budget?.text || 'set',
  });

  // ── Step 4: Try ChatGPT → Claude ───────────────────────────────────────────
  try {
    const result = await generateWhatsappReplyWithProviderFallback(
      session,
      history,
      message,
      propertyCtx
    );
    return {
      reply         : result.reply,
      provider      : result.provider,
      contextSource,
    };
  } catch (err) {
    console.warn('[WhatsAppAI] ChatGPT + Claude both failed:', err.message);
  }

  // ── Step 5: Fallback to Private Agent ──────────────────────────────────────
  try {
    // Lazy require untuk hindari circular dependency
    const { generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');

    const recommendationContext = await buildRecommendationContextForLLM(message, history);

    const result = await generatePrivateTerminalMassege({
      session,
      history,
      userMessage          : message,
      agentName,
      recommendationContext,
      externalError        : new Error('ChatGPT and Claude unavailable for WhatsApp reply'),
    });

    console.log(`[WhatsAppAI] Private Agent used (${result.exactMatches || 0} exact, ` +
                `${result.alternatives || 0} alt, ${result.rumah123Listings || 0} rumah123)`);

    return {
      reply         : result.reply,
      provider      : 'private_agent',
      contextSource,
    };
  } catch (err) {
    console.error('[WhatsAppAI] Private Agent also failed:', err.message);

    // ── Last resort ────────────────────────────────────────────────────────────
    const name  = session?.name || 'Pelanggan';
    const agent = agentName    || process.env.APP_NAME || 'Elevan Property';
    return {
      reply: `Halo *${name}*! 👋\n\nTerima kasih telah menghubungi kami. Tim *${agent}* akan segera membalas pesan Anda dengan informasi properti yang sesuai.\n\nMohon tunggu sebentar 🙏`,
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
};

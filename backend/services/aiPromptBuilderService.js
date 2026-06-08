const { loadProjectSkillPrompt } = require('./skillPromptService');

/* ─── Qualification State Extractor ────────────────────────────────────────── */
/* Scans full conversation history to build a per-question answered/unanswered  */
/* state. This is injected into the AI prompt so the AI NEVER re-asks a         */
/* question that already has a green checkmark.                                  */

const QS_CUST_ROLES = new Set(['user', 'customer']);
const QS_AI_ROLES   = new Set(['assistant', 'ai', 'bot']);

/**
 * Extract which Q1–Q12 fields have been answered from conversation history.
 * Runs server-side so the AI gets an authoritative checklist — it does NOT
 * have to guess from raw history text (which fails when history is truncated).
 *
 * @param {Array}  history        - Full conversation history [{role, message}]
 * @param {string} currentMessage - Current customer message
 * @returns {object} Qualification state
 */
function extractQualificationState(history = [], currentMessage = '') {
  // Build chronological message array (history is already oldest-first from DB reverse)
  const ALL = [...(history || []), { role: 'customer', message: currentMessage }];

  const state = {
    transactionType : null,   // Q1
    buildingType    : null,   // from first message
    fallbackTypes   : [],     // "kalau tidak ada X, Y saja"
    location        : null,   // Q2
    budget          : null,   // Q3
    household       : null,   // Q4
    redFlags        : null,   // Q5
    anchorPoint     : null,   // Q6
    alternativeAreas: null,   // Q7
    moveInDate      : null,   // Q8 MANDATORY
    decisionMaker   : null,   // Q9
    leaseDuration   : null,   // Q10
    furnishing      : null,   // Q11
    apartmentPref   : null,   // Q12
  };

  const MONTH_ID = 'januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember';
  const MONTH_EN = 'january|february|march|april|may|june|july|august|september|october|november|december';
  const MONTH_RE = new RegExp(`(\\d{1,2}\\s+)?(${MONTH_ID}|${MONTH_EN})(\\s+\\d{4})?`, 'i');
  const CITY_RE  = /\b(surabaya|malang|bali|denpasar|jakarta|bandung|yogyakarta|jogja|semarang|medan|makassar|sidoarjo|gresik|bekasi|tangerang|depok|bogor|solo|palembang|batam|balikpapan|samarinda|pontianak|manado|kupang|mataram|lombok|batu)\b/i;

  // ── Phase 0: Find "active session start" ──────────────────────────────────
  // If a summary brief was already sent in history, Q2–Q12 answers BEFORE
  // the first customer message after that summary are stale (they belong to a
  // previous search). Only scan messages from the active session onwards for
  // Q2–Q12 to prevent polluting the current search with old answers.
  //
  // Example: customer answered Q4="bersama istri" for villa search → summary
  // shown → customer now searches for apartment. Phase 1 must NOT carry over
  // "bersama istri" (household) or "semi-furnished" (furnishing) from the
  // old villa session into the new apartment search.
  {
    const SUMMARY_RE_P0 = /[✓✔]\s*Rencana\s*:/i;
    const histForP0 = ALL.slice(0, -1);
    const lastSumP0 = histForP0.reduce(
      (idx, m, i) => QS_AI_ROLES.has(m.role) && SUMMARY_RE_P0.test(m.message || '') ? i : idx,
      -1
    );
    let activeStart = 0;
    if (lastSumP0 >= 0) {
      for (let i = lastSumP0 + 1; i < histForP0.length; i++) {
        if (QS_CUST_ROLES.has(histForP0[i].role)) { activeStart = i; break; }
      }
      // No customer message after summary → only the current message is active
      if (activeStart === 0) activeStart = ALL.length - 1;
    }
    // Expose activeStart for Phase 1, 2 & 3B (via closure)
    // eslint-disable-next-line no-var
    var ACTIVE_ALL = ALL.slice(activeStart);
  }

  // ── Phase 1: Scan every customer message for content-detectable fields ────
  // Uses ACTIVE_ALL (messages from active session start) to prevent stale
  // Q2–Q12 data from before the last summary from polluting the current search.
  for (const msg of ACTIVE_ALL) {
    if (!QS_CUST_ROLES.has(msg.role)) continue;
    const raw  = msg.message || '';
    const text = raw.toLowerCase().trim();

    // Q1 — Transaction type
    if (!state.transactionType) {
      if (/\b(sewa|kontrak|ngontrak|rent)\b/.test(text))        state.transactionType = 'rent';
      else if (/\b(beli|buy|purchase)\b/.test(text))             state.transactionType = 'sale';
    }

    // Building type (primary)
    if (!state.buildingType) {
      if (/\bvill?a\b/.test(text))                               state.buildingType = 'villa';
      else if (/\bapartemen\b|\bapartment\b/.test(text))         state.buildingType = 'apartment';
      else if (/\brumah\b|\bhouse\b|\bkontrakan\b/.test(text))  state.buildingType = 'house';
      else if (/\bhotel\b|\bpenginapan\b/.test(text))           state.buildingType = 'hotel';
      else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(text)) state.buildingType = 'boarding_house';
      else if (/\bruko\b|\brukan\b/.test(text))                 state.buildingType = 'shophouse';
      else if (/\bkantor\b/.test(text))                         state.buildingType = 'office';
      else if (/\bgudang\b/.test(text))                         state.buildingType = 'warehouse';
    }

    // Fallback types — "kalau/jika tidak/enggak ada [type] ... [type] saja"
    // Pattern A: conditional clause
    const fallbackMatchA = text.match(
      /(?:kalau|jika|kalo|bila)\s+(?:tidak|gak|ga|ngga|enggak|kagak|ndak)(?:\s+ada)?\s+(\w+)/
    );
    if (fallbackMatchA) {
      // The fallback TYPE is usually what comes AFTER the condition, e.g. "sewa apartemen saja"
      const afterMatch = text.match(/(?:sewa|beli|kontrak)\s+(\w+)\s+(?:saja|aja)/);
      if (afterMatch) {
        const fb = _typeKeyFromWord(afterMatch[1]);
        if (fb && fb !== state.buildingType && !state.fallbackTypes.includes(fb)) {
          state.fallbackTypes.push(fb);
        }
      }
    }
    // Pattern B: direct "sewa/beli [type] saja"
    const directFb = text.match(/\b(?:sewa|beli|kontrak)\s+(\w+)\s+(?:saja|aja)\b/);
    if (directFb) {
      const fb = _typeKeyFromWord(directFb[1]);
      if (fb && fb !== state.buildingType && !state.fallbackTypes.includes(fb)) {
        state.fallbackTypes.push(fb);
      }
    }

    // Q2 — Location (city)
    if (!state.location) {
      const cm = raw.match(CITY_RE);
      if (cm) state.location = cm[1];
    }

    // Q3 — Budget
    if (!state.budget) {
      if (/\b(terjangkau|murah|affordable|ekonomis|hemat|low budget|yang paling murah)\b/.test(text)) {
        state.budget = 'terjangkau/affordable';
      } else {
        const pm = text.match(/(\d[\d.,]*\s*(?:juta|jt|miliar|ribu|rb|k))/);
        if (pm) state.budget = pm[1].trim();
      }
    }

    // Q4 — Household
    if (!state.household) {
      if (/\bsendiri\b|\bsendiran\b|\bjust me\b|\balone\b/.test(text)) {
        state.household = '1 orang (sendiri)';
      } else if (/\bsama (istri|suami)\b|\bbersama (istri|suami)\b/.test(text)) {
        state.household = '2 orang (bersama pasangan)';
      } else if (/\bberdua\b/.test(text) && !/\bberdua (sama|dengan)\s*(sekolah|kantor|mall)/.test(text)) {
        state.household = '2 orang (berdua)';
      } else if (/\bkeluarga\b/.test(text) && !/\bkeluarga lain\b|\bkoordinasi.*keluarga\b/.test(text)) {
        state.household = 'keluarga';
      } else if (/\borangtua\b|\borang tua\b|\bparents\b/.test(text)) {
        state.household = 'dengan orangtua';
      }
    }

    // Q8 — Move-in date
    if (!state.moveInDate) {
      const dm = raw.match(MONTH_RE);
      if (dm) {
        state.moveInDate = dm[0].trim();
      } else if (/\b(bulan depan|next month|minggu depan|segera|sekarang|asap)\b/.test(text)) {
        state.moveInDate = text.includes('bulan depan') ? 'bulan depan' : 'segera/ASAP';
      }
    }

    // Q11 — Furnishing
    if (!state.furnishing) {
      if (/\bfull.{0,5}furn|\bfully.{0,5}furn/.test(text)) {
        state.furnishing = 'fully furnished';
      } else if (/\bsemi.{0,10}furn/.test(text) || (/\bsemi\b/.test(text) && /\bfurn/.test(text))) {
        state.furnishing = 'semi-furnished';
      } else if (/\bkosongan\b|\bunfurnished\b/.test(text)) {
        state.furnishing = 'unfurnished/kosongan';
      } else if (/\bfurnished\b/.test(text) && !/semi/.test(text)) {
        state.furnishing = 'furnished';
      }
    }
  }

  // ── Phase 2: Detect context-dependent Q6/Q7/Q9/Q10 from AI→Customer pairs ─
  // Only meaningful when the AI actually asked the question first.
  // Uses ACTIVE_ALL so old AI→Customer pairs from before the active session
  // do not set Q6/Q7/Q9/Q10 from a previous search.
  for (let i = 0; i < ACTIVE_ALL.length - 1; i++) {
    const ai = ACTIVE_ALL[i];
    if (!QS_AI_ROLES.has(ai.role)) continue;

    // Find the next customer message (skip consecutive AI messages)
    let nextCustIdx = -1;
    for (let j = i + 1; j < ACTIVE_ALL.length; j++) {
      if (QS_AI_ROLES.has(ACTIVE_ALL[j].role)) continue;   // skip back-to-back AI msgs
      if (QS_CUST_ROLES.has(ACTIVE_ALL[j].role)) { nextCustIdx = j; break; }
      break;
    }
    if (nextCustIdx < 0) continue;
    const cust = ACTIVE_ALL[nextCustIdx];

    const aiText   = (ai.message   || '').toLowerCase();
    const custResp = (cust.message || '').trim();

    // Q6 — anchor point
    if (!state.anchorPoint && /patokan|dekat sekolah|dekat kantor|mall tertentu|anchor/.test(aiText)) {
      state.anchorPoint = custResp;
    }
    // Q7 — alternative areas
    if (!state.alternativeAreas && /selain .{2,40}area sekitar|area.{0,20}lain.{0,20}oke|besides.{2,40}area/.test(aiText)) {
      state.alternativeAreas = custResp;
    }
    // Q9 — decision maker
    if (!state.decisionMaker && /jadwalkan viewing|koordinasi dulu|keluarga lain/.test(aiText)) {
      state.decisionMaker = custResp;
    }
    // Q10 — lease duration
    if (!state.leaseDuration && /sewa untuk berapa lama|berapa lama.*sewa/.test(aiText)) {
      state.leaseDuration = custResp;
    }
    // Q5 — red flags
    if (!state.redFlags && /pasti tidak cocok|hadap barat|gang sempit|rumah tua/.test(aiText)) {
      state.redFlags = custResp;
    }
    // Q12 — apartment preference
    if (!state.apartmentPref && /tower atau lantai|preferensi tower|lantai berapa/.test(aiText)) {
      state.apartmentPref = custResp;
    }
    // Q2b — search history (highest-value question, fires early)
    // Detect when AI asked search-history question and capture customer's answer.
    // "Saya belum pernah lihat" / "sudah lihat 3" / "belum ada yang cocok" — all valid Q2b answers.
    if (!state.searchHistory &&
        /sudah\s+lihat\s+berapa|how\s+many\s+prop|apa\s+yang\s+membuat\s+belum\s+cocok|yang\s+sudah\s+dilihat|berapa\s+properti.*sudah/.test(aiText)) {
      state.searchHistory = custResp.trim() || 'dijawab';
    }
  }

  // ── Phase 3: Post-summary reset & type-change detection ─────────────────────

  // ── 3A: Summary-already-shown detection ─────────────────────────────────────
  // If the AI already sent a brief (contains "✓ Rencana:") AND there are NO
  // customer messages AFTER that summary (i.e., the customer is replying TO the
  // summary), treat the current message as the start of a brand-new search.
  //
  // If customer messages DO exist after the last summary (e.g., turns 16-25),
  // the customer already answered Q1-Qn in the new session — don't wipe those.
  {
    const SUMMARY_SENT_RE = /[✓✔]\s*Rencana\s*:/i;
    // Find the index of the LAST summary message in history (not counting current)
    const histAll = ALL.slice(0, -1);
    const lastSummaryIdx = histAll.reduce(
      (idx, m, i) => QS_AI_ROLES.has(m.role) && SUMMARY_SENT_RE.test(m.message || '') ? i : idx,
      -1
    );
    // Customer messages that arrived AFTER the last summary (excluding current message)
    const custMsgsAfterSummary = lastSummaryIdx >= 0
      ? histAll.slice(lastSummaryIdx + 1).filter(m => QS_CUST_ROLES.has(m.role))
      : [];
    // Only trigger reset if summary was found AND no new Q&A has started yet
    const summaryWasShown = lastSummaryIdx >= 0 && custMsgsAfterSummary.length === 0;

    if (summaryWasShown) {
      state.summaryAlreadyShown  = true;
      state.typeChangedFromHistory = false;

      // Wipe everything — fresh slate for the new search
      state.buildingType     = null;
      state.transactionType  = null;
      state.fallbackTypes    = [];
      state.location         = null;
      state.budget           = null;
      state.household        = null;
      state.redFlags         = null;
      state.anchorPoint      = null;
      state.alternativeAreas = null;
      state.moveInDate       = null;
      state.decisionMaker    = null;
      state.leaseDuration    = null;
      state.furnishing       = null;
      state.apartmentPref    = null;

      // Re-populate ONLY what the current message explicitly states
      const cur = (currentMessage || '').toLowerCase().trim();
      if      (/\bvill?a\b/.test(cur))                               state.buildingType = 'villa';
      else if (/\bapartemen\b|\bapartment\b/.test(cur))              state.buildingType = 'apartment';
      else if (/\brumah\b|\bhouse\b|\bkontrakan\b/.test(cur))       state.buildingType = 'house';
      else if (/\bhotel\b|\bpenginapan\b/.test(cur))                state.buildingType = 'hotel';
      else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(cur)) state.buildingType = 'boarding_house';
      else if (/\bruko\b|\brukan\b/.test(cur))                       state.buildingType = 'shophouse';
      else if (/\bkantor\b/.test(cur))                               state.buildingType = 'office';
      else if (/\bgudang\b/.test(cur))                               state.buildingType = 'warehouse';

      if      (/\b(sewa|kontrak|ngontrak|rent)\b/.test(cur))         state.transactionType = 'rent';
      else if (/\b(beli|buy|purchase)\b/.test(cur))                  state.transactionType = 'sale';

      const cityMatch = (currentMessage || '').match(CITY_RE);
      if (cityMatch) state.location = cityMatch[1];

      return state;  // summary reset takes full priority — skip 3B
    }
  }

  // ── 3B: Building-type-change detection (only runs when no summary was shown) ─
  // RULES (per business logic):
  //   • Building type changes (villa→rumah, villa→apartment) → reset Q2–Q12, show ⚠️
  //   • TX-only change, SAME building type (beli gudang→sewa gudang) → just update
  //     state.transactionType silently; qualification continues from where it left off.
  //
  // Uses ACTIVE_ALL so we only compare types WITHIN the active session —
  // not between the current and a pre-summary session.
  {
    const histMsgs = ACTIVE_ALL.slice(0, -1).filter(m => QS_CUST_ROLES.has(m.role));

    const histType = histMsgs.reduce((t, msg) => {
      if (t) return t;
      const w = (msg.message || '').toLowerCase();
      if (/\bvill?a\b/.test(w))                               return 'villa';
      if (/\bapartemen\b|\bapartment\b/.test(w))              return 'apartment';
      if (/\brumah\b|\bhouse\b|\bkontrakan\b/.test(w))       return 'house';
      if (/\bhotel\b|\bpenginapan\b/.test(w))                return 'hotel';
      if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(w)) return 'boarding_house';
      if (/\bruko\b|\brukan\b/.test(w))                      return 'shophouse';
      if (/\bkantor\b/.test(w))                              return 'office';
      if (/\bgudang\b/.test(w))                              return 'warehouse';
      return null;
    }, null);

    const histTx = histMsgs.reduce((t, msg) => {
      if (t) return t;
      const w = (msg.message || '').toLowerCase();
      if (/\b(sewa|kontrak|rent)\b/.test(w))  return 'rent';
      if (/\b(beli|buy|purchase)\b/.test(w))  return 'sale';
      return null;
    }, null);

    const cur = (currentMessage || '').toLowerCase().trim();
    let curType = null;
    if      (/\bvill?a\b/.test(cur))                               curType = 'villa';
    else if (/\bapartemen\b|\bapartment\b/.test(cur))              curType = 'apartment';
    else if (/\brumah\b|\bhouse\b|\bkontrakan\b/.test(cur))       curType = 'house';
    else if (/\bhotel\b|\bpenginapan\b/.test(cur))                curType = 'hotel';
    else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(cur)) curType = 'boarding_house';
    else if (/\bruko\b|\brukan\b/.test(cur))                       curType = 'shophouse';
    else if (/\bkantor\b/.test(cur))                               curType = 'office';
    else if (/\bgudang\b/.test(cur))                               curType = 'warehouse';

    let curTx = null;
    if      (/\b(sewa|kontrak|rent)\b/.test(cur))    curTx = 'rent';
    else if (/\b(beli|buy|purchase)\b/.test(cur))    curTx = 'sale';

    // Building type changed → full Q2–Q12 reset + ⚠️ banner
    const buildingTypeChanged = Boolean(histType && curType && histType !== curType);

    // TX-only change (same building type) → silent update, no reset
    const txOnlyChanged = Boolean(!buildingTypeChanged && histTx && curTx && histTx !== curTx);

    state.typeChangedFromHistory = buildingTypeChanged;

    if (txOnlyChanged && curTx) {
      // Quietly update the transaction type — Q2–Q12 answers remain valid
      state.transactionType = curTx;
    }

    if (buildingTypeChanged) {
      if (curType) state.buildingType    = curType;
      if (curTx)   state.transactionType = curTx;
      state.location         = null;
      state.budget           = null;
      state.household        = null;
      state.redFlags         = null;
      state.anchorPoint      = null;
      state.alternativeAreas = null;
      state.moveInDate       = null;
      state.decisionMaker    = null;
      state.leaseDuration    = null;
      state.furnishing       = null;
      state.apartmentPref    = null;
      state.fallbackTypes    = [];
    }
  }

  return state;
}

/** Simple building type key lookup for state extractor */
function _typeKeyFromWord(word = '') {
  const w = word.toLowerCase().trim();
  if (/vill?a/.test(w))                          return 'villa';
  if (/apartemen|apartment/.test(w))             return 'apartment';
  if (/rumah|house|kontrakan/.test(w))           return 'house';
  if (/hotel|penginapan/.test(w))                return 'hotel';
  if (/kos|kost|kosan|indekos/.test(w))          return 'boarding_house';
  if (/ruko|rukan|shophouse/.test(w))            return 'shophouse';
  if (/kantor|office/.test(w))                   return 'office';
  if (/gudang|warehouse/.test(w))                return 'warehouse';
  return null;
}

/**
 * Format qualification state as a readable checklist block for AI injection.
 * Green = answered (AI must NOT re-ask). Red = unanswered (AI should ask next).
 *
 * @param {object} state - From extractQualificationState()
 * @returns {string}
 */
function buildQualificationStateBlock(state) {
  const row = (label, val) => val
    ? `✅ ${label}: ${val}`
    : `❓ ${label}: BELUM DIJAWAB`;

  const fbNote = state.fallbackTypes && state.fallbackTypes.length
    ? ` (fallback: ${state.fallbackTypes.join(' / ')})`
    : '';

  const lines = [
    '╔══════════════════════════════════════════════════════════╗',
    '║  📋 QUALIFICATION STATE — STATUS JAWABAN CUSTOMER        ║',
    '║  ✅ = SUDAH DIJAWAB → JANGAN TANYA LAGI                  ║',
    '║  ❓ = BELUM DIJAWAB → TANYAKAN BERIKUTNYA (urutan Q↑)    ║',
    '╚══════════════════════════════════════════════════════════╝',
    '',
  ];

  // Summary-already-shown banner — customer is starting a brand-new search
  if (state.summaryAlreadyShown) {
    lines.push('⚠️  SUMMARY SUDAH DIKIRIM — Customer memulai pencarian baru.');
    lines.push('   RESET PENUH ke Q1. Tanyakan dari awal: sewa/beli dan tipe propertinya.');
    lines.push('   JANGAN tampilkan summary lagi sampai semua Q wajib terjawab ulang.');
    lines.push('');
  }

  // Type-change banner — shown when customer switched building type (villa→rumah, etc.)
  if (state.typeChangedFromHistory) {
    lines.push('⚠️  TIPE PROPERTI BERUBAH — Customer beralih ke jenis properti baru.');
    lines.push('   Q2-Q12 di-RESET. Akui perubahan singkat (1 kalimat), lanjut dari Q terkecil ❓.');
    lines.push('');
  }

  lines.push(
    row('Tipe transaksi    [Q1]', state.transactionType),
    row('Tipe properti         ', state.buildingType ? state.buildingType + fbNote : null),
    row('Lokasi            [Q2]', state.location),
    // Q2b is shown as ✅ when AI asked search-history question and customer answered;
    // shown as ❓ otherwise (not yet asked). Q2b is the HIGHEST-VALUE question.
    state.searchHistory
      ? `✅ Riwayat pencarian [Q2b]: ${state.searchHistory}`
      : `❓ Riwayat pencarian [Q2b]: BELUM DITANYAKAN`,
    row('Budget            [Q3]', state.budget),
    row('Penghuni          [Q4]', state.household),
    row('Red flags         [Q5]', state.redFlags),
    row('Patokan lokasi    [Q6]', state.anchorPoint),
    row('Area alternatif   [Q7]', state.alternativeAreas),
    row('Tanggal masuk  ⚠️WAJIB [Q8]', state.moveInDate),
    row('Keputusan         [Q9]', state.decisionMaker),
    row('Durasi sewa      [Q10]', state.leaseDuration),
    row('Furnitur         [Q11]', state.furnishing),
    row('Apt preference   [Q12]', state.apartmentPref),
    '',
    '→ Tanyakan HANYA field ❓ di atas, mulai dari nomor Q terkecil.',
    '→ SATU pertanyaan per pesan. Jangan gabungkan dua pertanyaan.',
    '→ Q3 Budget: JANGAN tanya langsung — gunakan 2 harga kontras sebagai pilihan.',
    '→ Q8 Tanggal masuk WAJIB dijawab sebelum summary ditampilkan.',
    '→ ⛔ Field ❓ di atas berarti BELUM dijawab di sesi ini — ABAIKAN nilai dari history lama.',
    '→ ⛔ JANGAN tampilkan summary sampai Q3 (Budget) DAN Q8 (Tanggal) keduanya ✅ di atas.',
  );

  return lines.join('\n');
}

/* ─── Indonesian keyword list for server-side language detection ───────────── */
const ID_DETECT_WORDS = [
  // Pronouns & modals
  'saya', 'aku', 'mau', 'ingin', 'pengen', 'cari', 'sewa', 'beli',
  'jual', 'ada', 'tolong', 'mohon', 'yang', 'dengan', 'dan', 'atau',
  'tidak', 'bisa', 'untuk', 'apa', 'ya', 'dong', 'ya', 'nih',
  // Property
  'rumah', 'villa', 'vila', 'apartemen', 'hotel', 'kos', 'kost', 'ruko',
  'gudang', 'kantor', 'properti', 'tanah', 'kontrakan',
  // Price & units — CRITICAL: "2-4 juta/seminggu" must detect as Indonesian
  'harga', 'berapa', 'budget', 'kisaran', 'terjangkau', 'murah',
  'juta', 'ribu', 'miliar', 'rb', 'jt',
  // Time units (Indonesian)
  'seminggu', 'sebulan', 'setahun', 'bulan', 'minggu', 'tahun',
  'per\s*bulan', 'per\s*tahun', 'per\s*minggu',
  // Month names (Indonesian) — "Juni 2026" must detect as Indonesian
  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
  // General Indonesian
  'lokasi', 'area', 'di ', 'kota', 'wilayah', 'daerah',
];

/**
 * Detect dominant language from conversation.
 * Checks current message first, then falls back to last 4 customer messages in history.
 * Returns 'id' for Indonesian, 'en' for English.
 *
 * @param {string} message  - Latest customer message
 * @param {Array}  history  - Conversation history [{role, message}]
 * @returns {'id'|'en'}
 */
function detectLanguage(message = '', history = []) {
  const checkId = (text) => {
    const lower = (text || '').toLowerCase();
    return ID_DETECT_WORDS.some(w => lower.includes(w));
  };

  if (checkId(message)) return 'id';

  // Fallback: check last 4 customer messages
  const customerMsgs = (history || [])
    .filter(h => h.role === 'user' || h.role === 'customer')
    .slice(-4);

  if (customerMsgs.some(m => checkId(m.message || ''))) return 'id';

  return 'en';
}

const BASE_PROPERTY_ASSISTANT_PROMPT = `
You are a professional property assistant for a property rental and sales platform in Indonesia.

You must follow the project skill documentation provided below. The skill documentation is the main behavior standard for this website chatbot and WhatsApp chatbot.

Core behavior:
- Help customers buy, sell, or rent properties such as houses, villas, hotels, apartments, boarding houses, shophouses, offices, and warehouses.
- LANGUAGE RULE: Always obey the ⚠️ FORCED REPLY LANGUAGE instruction that is injected above the conversation history — it overrides all other language detection. Never switch language just because the latest message is a short answer like a number, date, month name, or single word.
- Stay focused on property topics only.
- Prioritize the customer's latest message over older conversation history.
- Remember returning customers by the combination of name, phone number, and location when conversation history is provided.
- Use only backend property catalog data provided in the current request.
- Do not invent property names, prices, facilities, addresses, locations, discounts, or availability.
- Translate response labels and explanation text, but do not translate or change factual catalog data such as property names, IDs, addresses, city names, province names, prices, sizes, facilities, or image URLs.
- If exact matching properties exist, list exact matching properties first.
- If no exact match exists, clearly apologize or explain that no exact match is available, then provide only the closest alternatives from the backend catalog.
- If the customer asks for rental houses in Surabaya, do not recommend hotels in Malang.
- If the customer asks for hotels in Malang, recommend hotels in Malang if available.
- If the customer asks for a budget range, respect the range when exact matching data exists; if alternatives are outside the range, say so clearly.
- After listing property options, ask only one short follow-up question.
`.trim();

function getProjectSkillInstruction(provider = 'shared') {
  return `${BASE_PROPERTY_ASSISTANT_PROMPT}\n\nPROJECT SKILL DOCUMENTATION FOR PROVIDER: ${provider}\n${loadProjectSkillPrompt({ provider })}`;
}

function formatConversationHistory(history = []) {
  if (!history.length) return 'No previous conversation history.';
  return history.map((item) => `${item.role}: ${item.message}`).join('\n');
}

function buildContactReplyPrompt({ name, email, phone, subject, message }, provider = 'shared') {
  const firstName = (name || '').split(' ')[0] || name;

  return `${getProjectSkillInstruction(provider)}

Task: Compose a professional, warm, and empathetic WhatsApp follow-up reply for a new Contact Form submission from a prospective property client.

## Persona
You are Elvan, a senior property consultant at ${process.env.APP_NAME || 'Elevan Property'} — a trusted Indonesian property agency.
You are professional, elegant, empathetic, patient, and fluent in the customer's language.
Your communication style feels human, warm, and trustworthy — like a knowledgeable friend who works in real estate.

## Language Rule
Detect the language used in the customer's message and subject.
Reply entirely in that same language (Indonesian, English, etc.).
If the message is in Indonesian, use polite Indonesian (Bahasa Indonesia formal, use "Bapak/Ibu" or "Anda").
If in English, use professional yet warm English.

## WhatsApp Reply Structure
Follow this structure exactly — each section separated by a blank line:

1. **Warm Greeting with Name**
   Open with a professional, friendly greeting using the customer's first name.
   Example (Indonesian): "Halo Bapak/Ibu *${firstName}*, selamat datang! 🌟"
   Example (English): "Hello *${firstName}*, thank you for reaching out! 🌟"

2. **Empathetic Acknowledgement**
   Acknowledge the specific inquiry they made (reference the subject or key points from their message).
   Show you have carefully read their message.
   Express genuine enthusiasm to help.

3. **Brief Value Statement**
   One sentence about how Elevan Property can help them achieve their property goal.
   Be specific to their inquiry (buying, renting, selling, inquiry, etc.).

4. **ONE Focused Follow-up Question**
   Ask exactly ONE smart, relevant question that helps qualify or clarify their need.
   Make it feel natural and helpful — not interrogative.
   Examples: asking about budget range, preferred location, desired move-in date, property type preference, etc.
   Choose the MOST important unknown from their message.

5. **Warm Closing**
   Invite them to continue the conversation freely on WhatsApp.
   Sign off warmly.
   Use: "Salam hangat," (Indonesian) or "Warm regards," (English) followed by "*Elvan*\\n*${process.env.APP_NAME || 'Elevan Property'}*"

## Tone & Style
- Professional but warm — like a trusted consultant, not a sales pitch.
- Empathetic — show you understand their need or situation.
- Elegant — avoid slang, excessive exclamation marks, or pushy sales language.
- Concise — WhatsApp messages should be short and scannable.
- Use *bold* (with asterisks) for the customer's name, important property terms, and your sign-off.
- Use line breaks between sections for readability.

## Hard Rules
- Do NOT invent specific property prices, exact availability, discounts, legal promises, or appointment schedules.
- Do NOT mention competitor agencies.
- Do NOT use more than 5 short paragraphs total.
- Do NOT ask more than ONE follow-up question.
- Do NOT use email-style formalities (no "Dear", no "Best regards," for Indonesian replies).
- Do NOT expose backend systems, API names, or technical details.
- Reply must feel like a genuine personal message from a property consultant — not a template.

## Customer Contact Data
Name: ${name}
Email: ${email}
Phone: ${phone}
Subject: ${subject}
Message: ${message}`;
}

function buildChatbotReplyPrompt(session, history, userMessage, propertyContext = '', provider = 'shared') {
  const detectedLang = detectLanguage(userMessage, history);
  const forcedLangInstruction = detectedLang === 'id'
    ? `\n⚠️ FORCED REPLY LANGUAGE: Bahasa Indonesia\nCustomer ini berbicara dalam Bahasa Indonesia. SELALU balas dalam Bahasa Indonesia.\n`
    : `\n⚠️ FORCED REPLY LANGUAGE: English\nThe customer is writing in English. Always reply in English.\n`;

  return `${getProjectSkillInstruction(provider)}
${forcedLangInstruction}
Customer profile:
Name: ${session.name}
Phone: ${session.normalizedPhone}
Location: ${session.location || session.normalizedLocation || 'Not provided'}
Source: ${session.source}

Recent conversation history for context only. Use the customer profile identity (name, phone, and location) to continue the returning customer's context. Do not let old history override the latest customer message:
${formatConversationHistory(history)}

Backend property catalog context for this latest message:
${propertyContext || 'No backend property catalog context is available.'}

Latest customer message. This is the highest-priority instruction:
${userMessage}

Task:
Create the final chatbot reply using only the backend property catalog context above.
If exact matches are available, recommend exact matches directly.
If no exact match is available, say that no exact match is available and then present only the backend alternatives.
Do not keep asking discovery questions before showing options when the customer asks for suggestions or available properties.`;
}

function buildWhatsappReplyPrompt(session, history, userMessage, propertyContext = '', provider = 'shared') {
  // ── Server-side language detection (overrides AI guessing) ───────────────
  // Detect from full history + current message. Inject as hard constraint so
  // AI never switches to English for short answers like "2-4 juta/seminggu",
  // "Juni 2026", a number, or a single word.
  const detectedLang = detectLanguage(userMessage, history);
  const forcedLangInstruction = detectedLang === 'id'
    ? `\n⚠️ FORCED REPLY LANGUAGE: Bahasa Indonesia\nCustomer ini berbicara dalam Bahasa Indonesia. SELALU balas dalam Bahasa Indonesia — termasuk ketika pesan terbaru adalah jawaban singkat, angka, nama bulan, atau tanggal seperti "Juni 2026", "2-4 juta/seminggu", "iya", "1 tahun". JANGAN beralih ke Bahasa Inggris dalam kondisi apapun.\n`
    : `\n⚠️ FORCED REPLY LANGUAGE: English\nThe customer is writing in English. Always reply in English.\n`;

  // ── Detect RESPOND_CATALOG_RUN mode ──────────────────────────────────────
  const summaryMode = String(process.env.RESPOND_CATALOG_RUN || 'OFF').toUpperCase() !== 'ON';

  // ── Build server-side qualification state (prevents repeated questions) ──
  // This is computed from full history BEFORE calling the AI. The AI receives
  // an authoritative ✅/❓ checklist so it never re-asks an answered question,
  // even if raw history is long and early answers are hard to spot.
  const qualState      = summaryMode ? extractQualificationState(history, userMessage) : null;
  const qualStateBlock = qualState   ? buildQualificationStateBlock(qualState)          : '';

  // ── Summary mode: inject full Q1–Q12 qualification instructions ──────────
  const summaryModeInstructions = summaryMode ? `

## QUALIFICATION MODE (RESPOND_CATALOG_RUN=OFF)

You are currently in QUALIFICATION MODE. This means:

1. ❌ DO NOT show property listings or catalog.
2. ✅ Ask Q1–Q12 qualification questions, in order, ONE question per message.
3. ✅ Only after ALL mandatory questions are answered → show the structured brief below.
4. ✅ Never skip Q8 (move-in date) — it is MANDATORY.

### Context Continuation Rules (CRITICAL — Read First)

Short customer answers are CONTINUATIONS of the previous question — not new topics.
NEVER re-ask a question that was already answered. Read the full history before deciding which question to ask next.

Examples of continuation answers and what to do next:
- Q4 was asked ("Nanti tinggal bersama siapa saja?") → customer says "saya tinggal sendiran aja", "sama istri aja", "berdua sama anak" → **acknowledge + ask next unanswered question**
- Q8 was asked ("Rencananya masuk bulan apa?") → customer says "Juni 2026", "bulan depan", "24 juni" → **acknowledge + ask next unanswered question**
- Q1 was asked ("Sewa atau beli?") → customer says "sewa", "beli aja" → **acknowledge + ask next unanswered question**
- Q3: customer says "yang terjangkau aja" / "murah aja" → **budget = affordable, proceed to next question**

Rule: After receiving a short answer, always ACKNOWLEDGE first, then ask ONE next question.
Example acknowledgment for Q4: "Oke, berarti 1 kamar cukup ya 😊" or "Siap, nanti saya carikan yang cocok untuk 1 orang." Then ask the next unanswered Q.

### Discovery Conversation Rules (from PRD)

Most customers don't know exactly what they want. Guide discovery through OPTIONS, not interrogation.

**Q1 — Transaction type** (skip if already known from history)
"Lagi cari untuk sewa atau beli?"

**Q2 — Search history** (after location is established — HIGHEST VALUE QUESTION)
"Sudah lihat berapa properti di area itu? Apa yang membuat belum cocok dari yang sudah dilihat?"
→ Extracts: red flags, budget ceiling, decision maker signals, anchor point, urgency.

**Q3 — Budget** (NEVER ask directly — always show two contrasting price options)
"Di [area] kami ada Villa yang di kisaran [LOW range] dan ada juga yang [HIGH range]. Kira-kira yang mana lebih sesuai dengan rencana Bapak/Ibu?"
→ Customer's reaction reveals real budget. NEVER ask "berapa budget Anda?" or "kisaran harga berapa?"
→ Use realistic price ranges for the specific property type + location + transaction.
→ If customer says "yang terjangkau", "murah aja", "affordable" → budget = terjangkau, PROCEED to next Q.

**Q4 — Household composition** (NEVER ask bedrooms directly)
"Nanti akan tinggal bersama siapa saja? Biar saya bisa carikan yang pas jumlah kamarnya."
→ Infers bedrooms + decision maker signal.
→ Short answers like "sendiri", "sama istri", "berdua", "saya aja" = valid Q4 answer → PROCEED.

**Q5 — Red flags** (only if not captured in Q2)
"Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua?"

**Q6 — Anchor point** (only if not captured in Q2)
"Ada lokasi tertentu yang jadi patokan? Misalnya dekat sekolah anak, kantor, atau mall tertentu?"

**Q7 — Alternative areas** (always ask unless customer already volunteered)
"Selain [area], area sekitar yang masih oke?"

**Q8 — Move-in date** (MANDATORY — never skip, no exceptions)
"Rencananya masuk bulan apa?"

**Q9 — Decision maker** (never ask directly, always indirect)
"Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?"
→ NEVER ask "siapa yang memutuskan" — ask about scheduling logistics instead.

**Q10 — Lease duration** (only if transaction = sewa AND not volunteered)
"Rencananya sewa untuk berapa lama?"

**Q10a — Payment terms** (only if lease duration ≥ 1 year)
"Untuk pembayaran, biasanya lebih cocok bayar di muka penuh atau ada yang bisa cicil?"

**Q11 — Furnishing** (if not already stated)
"Untuk furnitur, lebih prefer yang sudah furnished, semi-furnished, atau kosongan saja?"

**Q12 — Apartment specific** (only if property type = apartment)
"Ada preferensi tower atau lantai tertentu? Misalnya hadap timur, lantai rendah/tengah/tinggi?"

### When to Show Summary (Brief)

Show the structured brief ONLY when ALL of the following are answered:
- Core 4: transaction type, building type, location, budget
- Q8 (move-in date) — mandatory
- Q4 or Q9 (household/decision maker)
- Q7 (alternative areas)

**Brief format:**
\`\`\`
Baik, permintaan utama Anda sudah saya catat, sebagai berikut 📝 🔥

✓ Rencana: *[nilai dari Q1 tx — HANYA jika ✅]*
✓ Tipe: *[nilai dari building type — HANYA jika ✅]*
✓ Lokasi: *[nilai dari Q2 — HANYA jika ✅]*
✓ Budget: *[nilai dari Q3]* (terkonfirmasi nanti) — HANYA jika ✅
✓ Masuk: *[nilai dari Q8]* — HANYA jika ✅
✓ Keputusan bersama: *[nilai dari Q9]* — HANYA jika ✅
✓ Furnitur: *[nilai dari Q11]* — HANYA jika ✅
✓ Patokan: *[nilai dari Q6 — nilai PERSIS dari QUALIFICATION STATE]* — HANYA jika ✅
✓ Area alternatif: *[nilai dari Q7]* — HANYA jika ✅

Saya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠 Apabila ada pertanyaan lagi, silahkan hubungi saya kembali.
Terima kasih sudah menghubungi saya. 🙏
\`\`\`

### Summary Strict Rules
- **HANYA sertakan field yang ✅ di QUALIFICATION STATE.** Jangan sertakan field yang ❓ — lewati saja.
- **Gunakan nilai PERSIS yang tertera setelah ": " di baris ✅** — jangan tulis "Disebutkan", "Ada", "Iya", "Diketahui" atau frasa samar lainnya.
- **JANGAN gunakan nilai dari raw conversation history** jika field tersebut ❓ di QUALIFICATION STATE — walaupun kata itu muncul di history (mungkin dari percakapan sebelumnya yang sudah selesai).
- One question per message only.
- Maximum 12 AI messages before showing brief (even if incomplete).
- Never show catalog, Rumah123 listings, or property details in this mode.
` : '';

  return `${getProjectSkillInstruction(provider)}
${forcedLangInstruction}
${summaryModeInstructions}
${qualStateBlock ? `\n${qualStateBlock}\n` : ''}
Customer profile:
Name: ${session.name}
Phone: ${session.normalizedPhone}
Location: ${session.location || session.normalizedLocation || 'Not provided'}
Source: ${session.source}

Recent conversation history for context only. Use the customer profile identity (name, phone, and location) to continue the returning customer's context. Do not let old history override the latest customer message. ⚠️ PENTING: QUALIFICATION STATE di atas adalah satu-satunya sumber kebenaran — JANGAN gunakan nilai budget/tanggal/penghuni/furnitur dari history lama (sesi sebelumnya) untuk mengisi field yang masih ❓:
${formatConversationHistory(history)}

Backend property catalog context for this latest WhatsApp message:
${summaryMode ? '(Not used in qualification mode — ask Q1–Q12 first)' : (propertyContext || 'No backend property catalog context is available.')}

Latest WhatsApp customer message. This is the highest-priority instruction:
${userMessage}

Task:
${summaryMode
    ? `Lihat QUALIFICATION STATE di atas (✅ = sudah dijawab, ❓ = belum dijawab).
Kemudian:
0. ⛔ NON-PROPERTY MESSAGE — Jika pesan terbaru BUKAN tentang properti (misalnya: permintaan teknis, file, kode program, topik tidak relevan), balas HANYA dengan: "Maaf, saya hanya bisa membantu terkait pencarian properti. Ada yang bisa saya bantu untuk kebutuhan properti Anda? 🏠"
1. ⚠️ JIKA ADA BANNER "SUMMARY SUDAH DIKIRIM" DI QUALIFICATION STATE: Customer memulai pencarian baru. Semua field ❓ di atas. Tanyakan Q1 untuk pencarian baru ini: "Untuk pencarian baru, mau sewa atau beli? Dan tipe propertinya apa?" — JANGAN tampilkan summary lagi sampai semua Q wajib terjawab ulang.
2. ⚠️ JIKA ADA BANNER "TIPE PROPERTI BERUBAH" DI QUALIFICATION STATE: Akui perubahan singkat (1 kalimat, contoh: "Oke, kita alihkan ke rumah sewa ya 😊"), lalu tanyakan Q terkecil yang masih ❓. JANGAN gunakan jawaban Q2–Q12 dari tipe lama.
3. Jika pesan terbaru adalah jawaban singkat untuk pertanyaan sebelumnya → AKUI singkat (1 kalimat), lalu tanyakan pertanyaan ❓ BERIKUTNYA dengan nomor Q terkecil.
   — Khusus Q2b (Riwayat pencarian): Jawaban seperti "Saya belum pernah lihat", "belum pernah", "sudah lihat 3" adalah jawaban Q2b yang valid → AKUI ("Oke, belum ada referensi sebelumnya 👌") → lanjut ke Q3 (Budget).
4. Jika pesan terbaru mengandung informasi baru → catat, lalu tanyakan pertanyaan ❓ berikutnya.
5. Jika semua pertanyaan wajib (Q1 tx, building type, Q2 lokasi, Q3 budget, Q4 penghuni, Q8 tanggal) sudah ✅ DAN tidak ada banner ⚠️ → tampilkan structured brief.
⛔ JANGAN tampilkan listing properti dalam mode ini.
⛔ JANGAN tanya ulang pertanyaan yang sudah ✅ di QUALIFICATION STATE.
⛔ SATU pertanyaan per pesan — jangan gabungkan dua pertanyaan.
⛔ Q3 Budget: JANGAN tanya langsung — gunakan 2 harga kontras sebagai pilihan reaksi.
⛔ Pesan ambigu ("cari properti", "ada properti?") tanpa tipe/transaksi → tanyakan Q1: "Mau sewa atau beli? Dan tipe propertinya apa?"
⛔ JANGAN tampilkan summary jika Q3 (Budget) atau Q8 (Tanggal masuk) masih ❓ di QUALIFICATION STATE — walaupun budget/tanggal muncul di raw conversation history dari sesi lama.
⛔ JANGAN tampilkan summary jika ada banner ⚠️ di atas, atau jika ada field ❓ yang belum dijawab.
⛔ Field ❓ di QUALIFICATION STATE = BELUM dijawab di sesi aktif ini. ABAIKAN semua nilai budget/tanggal/penghuni/furnitur dari percakapan sebelumnya (sesi lama) — itu bukan jawaban untuk sesi ini.`
    : 'Create the final WhatsApp reply using only the backend property catalog context above. If exact matches are available, recommend exact matches directly. If no exact match is available, say that no exact match is available and then present only the backend alternatives.'
  }`;
}

function buildIntentDetectionPrompt(message, provider = 'shared') {
  return `${getProjectSkillInstruction(provider)}

Classify this customer message into one of: buy, sell, rent, unknown.
Return only one word.
Message: ${message}`;
}

function buildPreferenceExtractionPrompt(message, provider = 'shared') {
  return `${getProjectSkillInstruction(provider)}

Extract property preferences from the message into concise JSON with these keys: intent, propertyType, location, budget, size, bedrooms, bathrooms, facilities, rentalDuration, occupants, notes.
Message: ${message}`;
}

module.exports = {
  getProjectSkillInstruction,
  formatConversationHistory,
  buildContactReplyPrompt,
  buildChatbotReplyPrompt,
  detectLanguage,
  buildWhatsappReplyPrompt,
  buildIntentDetectionPrompt,
  buildPreferenceExtractionPrompt,
  extractQualificationState,
  buildQualificationStateBlock,
};

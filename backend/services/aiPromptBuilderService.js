const { loadProjectSkillPrompt } = require('./skillPromptService');
const { detectBudget }           = require('./propertyRecommendationService');

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
  // \\b word boundaries prevent brand names like "indomaret" from matching "maret"
  const MONTH_RE = new RegExp(`(\\d{1,2}\\s+)?\\b(${MONTH_ID}|${MONTH_EN})\\b(\\s+\\d{4})?`, 'i');
  const CITY_RE  = /\b(surabaya|malang|bali|denpasar|jakarta|bandung|yogyakarta|jogja|semarang|medan|makassar|sidoarjo|gresik|bekasi|tangerang|depok|bogor|solo|palembang|batam|balikpapan|samarinda|pontianak|manado|kupang|mataram|lombok|batu)\b/i;

  // Month name → number (for date year inference)
  const MONTH_NUMBERS = {
    januari:1, january:1, februari:2, february:2, maret:3, march:3,
    april:4, mei:5, may:5, juni:6, june:6, juli:7, july:7,
    agustus:8, august:8, september:9, oktober:10, october:10,
    november:11, desember:12, december:12,
  };
  const now = new Date();
  const SYS_MONTH = now.getMonth() + 1;  // 1–12
  const SYS_DAY   = now.getDate();
  const SYS_YEAR  = now.getFullYear();

  // ── Phase 0: Find "active session start" ──────────────────────────────────
  // The active session begins at the LATEST of two boundaries. Everything
  // before that boundary is a stale/abandoned search and must NOT pollute the
  // current qualification state.
  //
  //   Boundary A — Summary brief: if a brief was already sent, the first
  //     customer message after it starts a fresh search.
  //
  //   Boundary B — Type/transaction change: if the customer switches building
  //     type (villa→hotel) or flips transaction type (sewa→beli) WITHOUT a
  //     summary in between, that message starts a fresh search. Business rule:
  //     "perubahan tipe transaksi atau tipe properti → response kembali ke Q1".
  //
  // Why Boundary B is critical: a customer can abandon a half-finished search
  // ("villa di Surabaya, masuk Juni…") and start over ("Mau cari hotel"). Since
  // qualification state is recomputed from scratch every turn, the old answers
  // (Surabaya, Juni, furnishing, …) would otherwise leak into the new hotel
  // search — and a stale AI "berapa lama?" question would mis-pair with the new
  // opening line as the lease duration. Trimming to the switch point fixes both.
  {
    const SUMMARY_RE_P0 = /[✓✔]\s*Rencana\s*:/i;
    const histForP0 = ALL.slice(0, -1);

    // Word-boundary aware detectors — all 12 building types, priority order matters:
    // kondotel before hotel/apartment, mansion/rumah mewah before rumah, store after shophouse.
    const typeOfP0 = (txt) => {
      const w = (txt || '').toLowerCase();
      if (/\bkondotel\b|\bcondotel\b/.test(w))                             return 'kondotel';
      if (/\bmansion\b|\brumah\s+mewah\b/.test(w))                        return 'mansion';
      if (/\bvill?a\b/.test(w))                                            return 'villa';
      if (/\bapartemen\b|\bapartment\b/.test(w))                           return 'apartment';
      if (/\bhotel\b|\bpenginapan\b/.test(w))                             return 'hotel';
      if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(w))              return 'boarding_house';
      if (/\bruko\b|\brukan\b/.test(w))                                   return 'shophouse';
      if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(w))             return 'store';
      if (/\bkantor\b/.test(w))                                           return 'office';
      if (/\bgudang\b/.test(w))                                           return 'warehouse';
      if (/\brumah\b|\bhouse\b|\bkontrakan\b/.test(w))                   return 'house';
      if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(w)) return 'others';
      return null;
    };
    const txOfP0 = (txt) => {
      const w = (txt || '').toLowerCase();
      if (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|rent|rental|lease|booking|book|pesan|reservasi)\b/.test(w)) return 'rent';
      if (/\b(beli|membeli|pembelian|dibeli|jual|dijual|buy|purchase|invest|investasi)\b/.test(w))                                   return 'sale';
      return null;
    };

    // ── Boundary A: first customer message after the last summary brief ──────
    const lastSumP0 = histForP0.reduce(
      (idx, m, i) => QS_AI_ROLES.has(m.role) && SUMMARY_RE_P0.test(m.message || '') ? i : idx,
      -1
    );
    let summaryStart = 0;
    if (lastSumP0 >= 0) {
      summaryStart = -1;
      for (let i = lastSumP0 + 1; i < histForP0.length; i++) {
        if (QS_CUST_ROLES.has(histForP0[i].role)) { summaryStart = i; break; }
      }
      if (summaryStart === -1) summaryStart = ALL.length - 1;  // none yet → only current
    }

    // ── Boundary B: latest customer message that switches type or flips tx ───
    // Scans ALL (incl. current message). A switch is only counted once a prior
    // type/tx has been established — the first mention is the initial choice.
    let switchStart   = 0;
    let switchType    = null;   // previous type, for the change banner
    {
      let runType = null;
      let runTx   = null;
      for (let i = 0; i < ALL.length; i++) {
        if (!QS_CUST_ROLES.has(ALL[i].role)) continue;
        const t  = typeOfP0(ALL[i].message);
        const tx = txOfP0(ALL[i].message);
        const typeFlipped = t  && runType && t  !== runType;
        const txFlipped   = tx && runTx   && tx !== runTx;
        if (typeFlipped || txFlipped) {
          switchStart = i;
          switchType  = runType;   // remember what they switched away from
        }
        if (t)  runType = t;
        if (tx) runTx   = tx;
      }
    }

    const activeStart = Math.max(summaryStart, switchStart);

    // If the active session began because of a type/tx switch (not a summary),
    // flag it so the change banner is shown even though Phase 3B — which only
    // looks WITHIN the now-trimmed segment — will no longer detect a change.
    if (switchStart > 0 && switchStart >= summaryStart) {
      state.typeChangedFromHistory = true;
      state.previousType           = switchType;
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

    // Q1 — Transaction type. "booking/pesan" = rent frame (hotel/kondotel/villa)
    if (!state.transactionType) {
      if (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|rent|rental|lease|booking|book|pesan|reservasi)\b/.test(text))
        state.transactionType = 'rent';
      else if (/\b(beli|membeli|pembelian|dibeli|jual|dijual|buy|purchase|invest|investasi)\b/.test(text))
        state.transactionType = 'sale';
    }

    // Building type (primary) — all 12 types, detection-order: most specific first.
    // kondotel before hotel/apartment; mansion/rumah mewah before rumah; store after shophouse.
    if (!state.buildingType) {
      if (/\bkondotel\b|\bcondotel\b/.test(text))                          state.buildingType = 'kondotel';
      else if (/\bmansion\b|\brumah\s+mewah\b/.test(text))               state.buildingType = 'mansion';
      else if (/\bvill?a\b/.test(text))                                    state.buildingType = 'villa';
      else if (/\bapartemen\b|\bapartment\b/.test(text))                   state.buildingType = 'apartment';
      else if (/\bhotel\b|\bpenginapan\b/.test(text))                     state.buildingType = 'hotel';
      else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(text))      state.buildingType = 'boarding_house';
      else if (/\bruko\b|\brukan\b/.test(text))                           state.buildingType = 'shophouse';
      else if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(text))     state.buildingType = 'store';
      else if (/\bkantor\b/.test(text))                                   state.buildingType = 'office';
      else if (/\bgudang\b/.test(text))                                   state.buildingType = 'warehouse';
      else if (/\brumah\b|\bhouse\b|\bkontrakan\b/.test(text))           state.buildingType = 'house';
      else if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(text)) state.buildingType = 'others';
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
    // Guard: strip "kisaran [price]" first — "kisaran" means "range/approximately" in
    // Indonesian and must NEVER be treated as the city Kisaran (North Sumatra).
    // e.g. "harganya kisaran 3-6juta/minggu" → remove "kisaran 3-6juta/minggu" before CITY_RE.
    if (!state.location) {
      const rawForCity = raw.replace(/\bkisaran\s+[\d.,][\d.,]*\s*(?:juta|ribu|miliar|rb|jt)?[^\s]*/gi, '');
      const cm = rawForCity.match(CITY_RE);
      if (cm) state.location = cm[1];
    }

    // Q2b — Direct Phase-1 capture for explicit "belum/sudah lihat" answers.
    // This runs independently of Phase-2 AI→customer pair detection so Q2b is
    // captured even if the pair-based scan misses the turn (e.g. duplicate message
    // in ALL, race condition, or AI phrased the Q2b question differently).
    if (!state.searchHistory) {
      if (/\b(belum\s+pernah\s+lihat|sudah\s+lihat\s+\d|belum\s+lihat|sudah\s+survey|belum\s+pernah\s+survey|belum\s+ada\s+yang\s+cocok)\b/i.test(text)) {
        state.searchHistory = raw.trim() || 'dijawab';
      }
    }

    // Q3 — Budget
    // Reuse the robust detector so the QUALIFICATION STATE matches the gate:
    //   • parses ranges in full ("2-4jt" → Rp 2.000.000 - Rp 4.000.000)
    //   • rejects counts ("2 kali" is NOT 2 ribu, "3 kamar" is NOT budget)
    //   • maps affordability words → terjangkau/affordable
    // Ambiguous ranges (no unit on either side) are left ❓ so Q3 is re-asked.
    if (!state.budget) {
      const b = detectBudget(raw);
      if (b && !b.ambiguous) {
        if (b.preference === 'affordable') {
          state.budget = 'terjangkau/affordable';
        } else {
          const periodSuffix = b.period === 'year'  ? '/tahun'
            : b.period === 'month' ? '/bulan'
            : b.period === 'night' ? '/malam'
            : b.period === 'week'  ? '/minggu'
            : '';
          state.budget = b.text + periodSuffix;
        }
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

    // Q8 — Move-in date (with year inference for past months)
    if (!state.moveInDate) {
      const dm = raw.match(MONTH_RE);
      if (dm) {
        const matched = dm[0].trim();
        const hasExplicitYear = /\b(202[4-9]|203[0-9])\b/.test(matched);
        if (hasExplicitYear) {
          state.moveInDate = matched;
        } else {
          const mMatch = matched.toLowerCase().match(new RegExp(`\\b(${MONTH_ID}|${MONTH_EN})\\b`));
          const mNum   = mMatch ? (MONTH_NUMBERS[mMatch[1]] || 0) : 0;
          const dayMatch = matched.match(/^(\d{1,2})\s/);
          const day    = dayMatch ? parseInt(dayMatch[1], 10) : 1;
          // If mentioned month is already past this year (or same month but day already past)
          // → treat as next year.  If future (or today) → current year.
          const isPast = mNum > 0 && (mNum < SYS_MONTH || (mNum === SYS_MONTH && day < SYS_DAY));
          const year   = isPast ? SYS_YEAR + 1 : SYS_YEAR;
          state.moveInDate = mNum > 0 ? `${matched} ${year}` : matched;
        }
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
    // Q7 detection: matches both old ("area sekitar yang masih oke") and
    // new ("pilihan lokasi lainnya") Q7 wording variations.
    if (!state.alternativeAreas && /selain\s+(lokasi\s+)?.{2,40}(area\s+sekitar|pilihan\s+lokasi)|area.{0,20}lain.{0,20}oke|besides.{2,40}(area|location)/i.test(aiText)) {
      state.alternativeAreas = custResp;
    }
    // Q9 — decision maker (normalized server-side so AI just copies the value)
    if (!state.decisionMaker && /jadwalkan viewing|koordinasi dulu|keluarga lain/.test(aiText)) {
      const resp = custResp;
      const lo   = resp.toLowerCase();

      // Guard: if the customer's answer looks like a move-in date (month name,
      // "tahun depan", year number, "bulan depan") do NOT store it as a decision
      // maker — the customer likely answered the wrong question or the bot mis-
      // classified their move-in date answer as a Q9 trigger.
      const MONTH_ID_RE = /\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i;
      const MONTH_EN_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
      const DATE_ANSWER_RE = /\b(tahun\s+depan|bulan\s+depan|next\s+year|next\s+month|20\d{2})\b/i;
      if (MONTH_ID_RE.test(lo) || MONTH_EN_RE.test(lo) || DATE_ANSWER_RE.test(lo)) {
        // Looks like a date answer — skip Q9 capture, do not pollute decisionMaker
      } else if (/\b(saya|aku)\b.{0,40}\b(ambil keputusan|yang memutuskan|yang putuskan|yang tentukan|yang decide)\b/i.test(lo) ||
          /\b(ambil keputusan|yang memutuskan|saya sendiri)\b/i.test(lo) ||
          /\btidak perlu koordinasi\b|\bnggak perlu koordinasi\b|\blangsung bisa (viewing|jadwal)\b/i.test(lo)) {
        state.decisionMaker = 'Mandiri';
      } else if (/\b(koordinasi|konfirmasi|tanya|izin).{0,40}(istri|suami|pasangan)\b/i.test(lo) ||
                 /\b(istri|suami|pasangan).{0,20}(harus|perlu|dulu)\b/i.test(lo)) {
        state.decisionMaker = 'Koordinasi dengan pasangan';
      } else if (/\b(koordinasi|tanya|izin).{0,40}(orang tua|orangtua|ayah|ibu|parents)\b/i.test(lo)) {
        state.decisionMaker = 'Koordinasi dengan orang tua';
      } else if (/\b(koordinasi|tanya|izin).{0,40}keluarga\b/i.test(lo)) {
        state.decisionMaker = 'Koordinasi dengan keluarga';
      } else if (/\b(sendiri|sendirian|seorang diri|solo)\b/i.test(lo)) {
        // Customer explicitly said "sendiri" in response to Q9 — normalize to "Sendirian"
        state.decisionMaker = 'Sendirian';
      } else {
        state.decisionMaker = resp;
      }
    }
    // Q10 — lease duration
    // Skip if customer answers with a date instead of a duration (e.g. "26 Juni 2026" → misunderstood question)
    if (!state.leaseDuration && /sewa\s+(?:untuk\s+)?berapa lama|berapa lama.*sewa|durasi\s+sewa/.test(aiText)) {
      const looksLikeDate = new RegExp(`\\b\\d{1,2}\\s+(?:${MONTH_ID}|${MONTH_EN})\\b`, 'i').test(custResp);
      if (!looksLikeDate) {
        state.leaseDuration = custResp;
      }
      // If it looks like a date: leave leaseDuration null so Q10 gets re-asked with clearer hint
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

      // Customer often volunteers anchor info inside their Q2b answer, e.g.:
      // "Belum, tapi saya cari yang dekat dengan cafe, indomaret dan jalan Demak."
      // Capture it now so the brief doesn't need to fall back to the regex extractor
      // (which joins all messages and can pick up wrong "dekat" fragments).
      if (!state.anchorPoint && /\b(dekat|deket|near)\b/i.test(custResp)) {
        const am = custResp.match(/\b(?:dekat|deket|near)\s+(?:dengan\s+)?[^\n.!?]{4,120}/i);
        if (am) state.anchorPoint = am[0].trim();
      }
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

      // Re-populate ONLY what the current message explicitly states — all 12 types.
      const cur = (currentMessage || '').toLowerCase().trim();
      if      (/\bkondotel\b|\bcondotel\b/.test(cur))                          state.buildingType = 'kondotel';
      else if (/\bmansion\b|\brumah\s+mewah\b/.test(cur))                    state.buildingType = 'mansion';
      else if (/\bvill?a\b/.test(cur))                                         state.buildingType = 'villa';
      else if (/\bapartemen\b|\bapartment\b/.test(cur))                        state.buildingType = 'apartment';
      else if (/\bhotel\b|\bpenginapan\b/.test(cur))                          state.buildingType = 'hotel';
      else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(cur))           state.buildingType = 'boarding_house';
      else if (/\bruko\b|\brukan\b/.test(cur))                                state.buildingType = 'shophouse';
      else if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(cur))          state.buildingType = 'store';
      else if (/\bkantor\b/.test(cur))                                        state.buildingType = 'office';
      else if (/\bgudang\b/.test(cur))                                        state.buildingType = 'warehouse';
      else if (/\brumah\b|\bhouse\b|\bkontrakan\b/.test(cur))                state.buildingType = 'house';
      else if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(cur)) state.buildingType = 'others';

      if      (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|rent|rental|lease|booking|book|pesan|reservasi)\b/.test(cur)) state.transactionType = 'rent';
      else if (/\b(beli|membeli|pembelian|dibeli|jual|dijual|buy|purchase|invest|investasi)\b/.test(cur))                               state.transactionType = 'sale';

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
      if (/\bkondotel\b|\bcondotel\b/.test(w))                             return 'kondotel';
      if (/\bmansion\b|\brumah\s+mewah\b/.test(w))                        return 'mansion';
      if (/\bvill?a\b/.test(w))                                            return 'villa';
      if (/\bapartemen\b|\bapartment\b/.test(w))                           return 'apartment';
      if (/\bhotel\b|\bpenginapan\b/.test(w))                             return 'hotel';
      if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(w))              return 'boarding_house';
      if (/\bruko\b|\brukan\b/.test(w))                                   return 'shophouse';
      if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(w))             return 'store';
      if (/\bkantor\b/.test(w))                                           return 'office';
      if (/\bgudang\b/.test(w))                                           return 'warehouse';
      if (/\brumah\b|\bhouse\b|\bkontrakan\b/.test(w))                   return 'house';
      if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(w)) return 'others';
      return null;
    }, null);

    const histTx = histMsgs.reduce((t, msg) => {
      if (t) return t;
      const w = (msg.message || '').toLowerCase();
      if (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|rent|rental|lease|booking|book|pesan|reservasi)\b/.test(w)) return 'rent';
      if (/\b(beli|membeli|pembelian|dibeli|jual|dijual|buy|purchase|invest|investasi)\b/.test(w))                                  return 'sale';
      return null;
    }, null);

    const cur = (currentMessage || '').toLowerCase().trim();
    let curType = null;
    if      (/\bkondotel\b|\bcondotel\b/.test(cur))                          curType = 'kondotel';
    else if (/\bmansion\b|\brumah\s+mewah\b/.test(cur))                    curType = 'mansion';
    else if (/\bvill?a\b/.test(cur))                                         curType = 'villa';
    else if (/\bapartemen\b|\bapartment\b/.test(cur))                        curType = 'apartment';
    else if (/\bhotel\b|\bpenginapan\b/.test(cur))                          curType = 'hotel';
    else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(cur))           curType = 'boarding_house';
    else if (/\bruko\b|\brukan\b/.test(cur))                                curType = 'shophouse';
    else if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(cur))          curType = 'store';
    else if (/\bkantor\b/.test(cur))                                        curType = 'office';
    else if (/\bgudang\b/.test(cur))                                        curType = 'warehouse';
    else if (/\brumah\b|\bhouse\b|\bkontrakan\b/.test(cur))                curType = 'house';
    else if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(cur)) curType = 'others';

    let curTx = null;
    if      (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|rent|rental|lease|booking|book|pesan|reservasi)\b/.test(cur)) curTx = 'rent';
    else if (/\b(beli|membeli|pembelian|dibeli|jual|dijual|buy|purchase|invest|investasi)\b/.test(cur))                                  curTx = 'sale';

    // Building type changed → full Q2–Q12 reset + ⚠️ banner
    const buildingTypeChanged = Boolean(histType && curType && histType !== curType);

    // TX-only change (same building type) → silent update, no reset
    const txOnlyChanged = Boolean(!buildingTypeChanged && histTx && curTx && histTx !== curTx);

    // Don't clobber a change already flagged by Phase 0 (which detects switches
    // that happened on an earlier turn and are no longer inside ACTIVE_ALL).
    state.typeChangedFromHistory = state.typeChangedFromHistory || buildingTypeChanged;

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

/** Simple building type key lookup for fallback type extractor — all 12 types */
function _typeKeyFromWord(word = '') {
  const w = word.toLowerCase().trim();
  if (/kondotel|condotel/.test(w))               return 'kondotel';
  if (/mansion|rumah\s*mewah/.test(w))           return 'mansion';
  if (/vill?a/.test(w))                          return 'villa';
  if (/apartemen|apartment/.test(w))             return 'apartment';
  if (/hotel|penginapan/.test(w))                return 'hotel';
  if (/kos|kost|kosan|indekos/.test(w))          return 'boarding_house';
  if (/ruko|rukan|shophouse/.test(w))            return 'shophouse';
  if (/toko|kios|warung|retail/.test(w))         return 'store';
  if (/kantor|office/.test(w))                   return 'office';
  if (/gudang|warehouse/.test(w))                return 'warehouse';
  if (/rumah|house|kontrakan/.test(w))           return 'house';
  if (/tanah|kavling|lahan|spbu|pabrik/.test(w)) return 'others';
  return null;
}

/**
 * Determine the next question the AI should ask based on qualification state.
 * Returns { q, hint } or null when all mandatory questions are answered.
 */
function findNextQuestion(state) {
  const tx   = (state.transactionType || '').toLowerCase();
  const type = (state.buildingType    || '').toLowerCase();
  const loc  = state.location ? `*${state.location}*` : '*[area]*';
  const typeLbl = state.buildingType || '[tipe]';
  const isSewa  = tx.includes('sewa') || tx.includes('rent');
  const isApt   = type === 'apartment';
  const isBooking = (type === 'hotel' || type === 'kondotel') && isSewa;
  const isCommercial = ['shophouse', 'office', 'warehouse', 'store'].includes(type);
  const isLuxury = type === 'mansion';

  // Q1 — tipe transaksi + building type (keduanya wajib)
  if (!state.transactionType || !state.buildingType)
    return { q: 'Q1', hint: 'Tanyakan: mau sewa atau beli? Dan tipe propertinya apa? (rumah, apartemen, villa, hotel, kos, ruko, kantor, gudang, toko, mansion, kondotel, dll) 🏠' };

  // Q2 — Lokasi (per-type context)
  if (!state.location) {
    if (isBooking) {
      const tipeLabel = type === 'hotel' ? 'Hotel' : 'Kondotel';
      return { q: 'Q2', hint: `Siap, *booking ${tipeLabel}*! 📍 Di kota atau area mana? Dan sudah ada gambaran tanggal check-in? (Bisa jawab lokasinya dulu)` };
    }
    if (type === 'villa' && isSewa)
      return { q: 'Q2', hint: `Mau sewa *Villa*! 📍 Di mana — Bali, Malang, Lombok, atau kota lain? (Nanti saya tanyakan periode sewanya: per malam, minggu, atau bulan)` };
    if (type === 'boarding_house')
      return { q: 'Q2', hint: `Mau cari *Kos-kosan*. 📍 Di area mana? Dekat kampus, kantor, atau area tertentu?` };
    if (type === 'warehouse')
      return { q: 'Q2', hint: `Oke, mau ${isSewa ? 'sewa' : 'beli'} *Gudang*. 📍 Di kota atau kawasan industri mana yang diinginkan?` };
    if (type === 'office')
      return { q: 'Q2', hint: `Mau sewa *Kantor*. 📍 Di CBD mana? (Jakarta Selatan, SCBD, Sudirman, Semarang, Surabaya, dll)` };
    if (type === 'store')
      return { q: 'Q2', hint: `Mau ${isSewa ? 'sewa' : 'beli'} *Toko*. 📍 Di mal/pusat perbelanjaan atau toko pinggir jalan di kota mana?` };
    if (type === 'others')
      return { q: 'Q2', hint: `Mau ${isSewa ? 'sewa' : 'beli'} *Properti*. 📍 Di area mana? Dan apa tujuan penggunaannya?` };
    return { q: 'Q2', hint: `Oke, mau ${tx} *${typeLbl}*. 📍 Di kota atau area mana yang Anda pertimbangkan?` };
  }

  // Q2b — Riwayat pencarian (kecuali untuk booking hotel/kondotel dan properti komersial)
  if (!state.searchHistory && !isBooking)
    return { q: 'Q2b', hint: `Sudah lihat berapa properti di ${loc}? Apa yang membuat belum cocok dari yang sudah dilihat?` };

  // Q3 — Budget (via 2 harga kontras — JANGAN tanya langsung)
  if (!state.budget)
    return { q: 'Q3', hint: `Di ${loc} ada *${typeLbl}* kisaran [harga rendah${isBooking ? '/malam' : ''}] dan [harga tinggi${isBooking ? '/malam' : ''}]. Kira-kira yang mana lebih sesuai? 💰` };

  // Q8 — Tanggal masuk/check-in (MANDATORY)
  if (!state.moveInDate) {
    if (isBooking)
      return { q: 'Q8', hint: 'Rencananya check-in tanggal berapa? 📅' };
    return { q: 'Q8', hint: 'Rencananya masuk atau pindah bulan apa? 📅' };
  }

  // Q4 — Penghuni (skip: commercial + hotel/kondotel booking — jumlah orang ditanya via Q14 tipe kamar)
  if (!state.household && !isCommercial && !isBooking)
    return { q: 'Q4', hint: 'Nanti akan tinggal bersama siapa saja? Biar saya bisa carikan yang pas jumlah kamarnya 🛏️' };

  // Q5 — Red flags
  if (!state.redFlags) {
    if (isCommercial)
      return { q: 'Q5', hint: `Ada syarat yang mutlak diperlukan atau yang tidak boleh ada untuk ${typeLbl === 'office' ? 'kantor' : typeLbl} ini? 🚫` };
    return { q: 'Q5', hint: 'Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua? 🚫' };
  }

  // Q6 — Patokan lokasi
  if (!state.anchorPoint) {
    if (isCommercial)
      return { q: 'Q6', hint: `Ada lokasi atau kawasan tertentu yang jadi prioritas? Misalnya dekat kawasan industri, pelabuhan, atau pusat bisnis? 📍` };
    return { q: 'Q6', hint: 'Ada lokasi tertentu yang jadi patokan? Misalnya dekat sekolah anak, kantor, atau mall tertentu? 📍' };
  }

  // Q7 — Area alternatif
  if (!state.alternativeAreas)
    return { q: 'Q7', hint: `Selain ${loc}, area sekitar yang masih oke? 🗺️` };

  // Q9 — Decision maker
  if (!state.decisionMaker)
    return { q: 'Q9', hint: 'Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?' };

  // Q10 — Durasi sewa (sewa only, skip hotel/kondotel/villa booking — durasi = malam/minggu)
  if (isSewa && !isBooking && !state.leaseDuration)
    return { q: 'Q10', hint: 'Rencananya sewa untuk berapa lama? ⏱️ (durasi, bukan tanggal — contoh: 6 bulan, 1 tahun)' };

  // Q11 — Furnishing (sewa only, skip: commercial, hotel/kondotel booking, villa)
  // Villa sewa selalu dilengkapi furniture (booking frame per malam/minggu/bulan).
  if (isSewa && !isCommercial && !isBooking && type !== 'villa' && type !== 'mansion' && !state.furnishing)
    return { q: 'Q11', hint: 'Untuk furnitur, lebih prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan* saja? 🛋️' };

  // Q12 — Apartemen spesifik
  if (isApt && !state.apartmentPref)
    return { q: 'Q12', hint: 'Ada preferensi tower atau lantai tertentu? Misalnya hadap timur, lantai rendah/tengah/tinggi? 🏢' };

  // Q14 — Type-specific slots (fired after Q12 based on building type + transaction)
  // AI checks from conversation history whether these were already answered.
  if (isBooking) {
    return { q: 'Q14', hint: `Lanjutkan Q14 ${type === 'hotel' ? 'hotel' : 'kondotel'} booking: (a) check-out/berapa malam? (b) tipe kamar? Standard/Deluxe/Suite/Family? (c) breakfast included? — CEK history dulu sebelum tanya yang sudah dijawab.` };
  }
  if (type === 'villa' && isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 villa sewa: (a) per malam/minggu/bulan? (b) perlu private pool? (c) tanggal check-in? — CEK history dulu.' };
  }
  if (type === 'villa' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 villa beli: (a) wajib private pool? (b) freehold (SHM) atau leasehold? — CEK history dulu.' };
  }
  if (type === 'boarding_house') {
    return { q: 'Q14', hint: 'Lanjutkan Q14 kos: (a) putra/putri/campur? (b) kamar mandi dalam/luar? (c) include makan? — CEK history dulu.' };
  }
  if (type === 'shophouse') {
    return { q: 'Q14', hint: 'Lanjutkan Q14 ruko: (a) jenis bisnis? (b) berapa lantai? (c) lebar depan minimum? (d) posisi hook/pojok? — CEK history dulu.' };
  }
  if (type === 'store') {
    return { q: 'Q14', hint: 'Lanjutkan Q14 toko: (a) jenis bisnis? (b) mal/pusat perbelanjaan atau standalone? (c) lebar depan minimum? — CEK history dulu.' };
  }
  if (type === 'office') {
    return { q: 'Q14', hint: 'Lanjutkan Q14 kantor: (a) berapa orang karyawan? (b) Grade A/B/C? (c) fit-out siap pakai atau shell & core? — CEK history dulu.' };
  }
  if (type === 'warehouse') {
    return { q: 'Q14', hint: 'Lanjutkan Q14 gudang: (a) luas minimum m²? (b) tinggi plafon minimum? (c) perlu loading dock? (d) daya listrik KVA? — CEK history dulu.' };
  }
  if (isLuxury) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 mansion: (a) wajib private pool? (b) perlu smart home? (c) kamar staf? (d) kapasitas garasi? — CEK history dulu.' };
  }
  if (type === 'kondotel' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 kondotel investasi: (a) target ROI per tahun? (b) tipe unit studio/1KT? (c) preferensi operator hotel? — CEK history dulu.' };
  }
  if (type === 'others') {
    return { q: 'Q14', hint: 'Lanjutkan Q14 properti lainnya: (a) tujuan penggunaan? (b) luas lahan m²/hektar? (c) zonasi yang diperlukan? — CEK history dulu.' };
  }

  return null; // all answered → show summary
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
    lines.push('   Lihat ⚡ PERTANYAAN BERIKUTNYA di bawah — tanyakan field ❓ terkecil.');
    lines.push('   JANGAN tampilkan summary lagi sampai semua Q wajib ✅ di sesi ini.');
    lines.push('   JANGAN gunakan jawaban dari sesi lama (history sebelum summary).');
    lines.push('');
  }

  // Type-change banner — shown when customer switched building type (villa→rumah, etc.)
  if (state.typeChangedFromHistory) {
    lines.push('⚠️  TIPE PROPERTI BERUBAH — Customer beralih ke jenis properti baru.');
    lines.push('   Q2-Q12 di-RESET. Akui perubahan singkat (1 kalimat), lanjut dari Q terkecil ❓.');
    lines.push('');
  }

  // ⚠️ Disambiguation note — injected before the checklist so the AI reads it first
  lines.push('⚠️  KAMUS BAHASA INDONESIA (jangan salah tafsir):');
  lines.push('   • "kisaran [harga]" = ekspresi budget ("sekitar/range") — BUKAN nama kota.');
  lines.push('     Contoh: "kisaran 3-6juta/minggu" → Budget, bukan lokasi Kisaran.');
  lines.push('   • Lokasi customer HANYA dari field ✅ Lokasi [Q2] di bawah — ABAIKAN');
  lines.push('     kata "kisaran" dalam pesan customer sebagai referensi lokasi.');
  lines.push('');

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

  // Inline hard-blocks for fields most commonly hallucinated
  const missingMandatory = [];
  if (!state.budget)           missingMandatory.push('Q3 Budget');
  if (!state.moveInDate)       missingMandatory.push('Q8 Tanggal masuk');
  if (!state.redFlags)         missingMandatory.push('Q5 Red flags');
  if (!state.anchorPoint)      missingMandatory.push('Q6 Patokan lokasi');
  if (!state.alternativeAreas) missingMandatory.push('Q7 Area alternatif');

  if (missingMandatory.length > 0) {
    lines.push('');
    lines.push(`🚫🚫🚫 SUMMARY DIBLOKIR — field wajib BELUM DIISI: ${missingMandatory.join(', ')}`);
    lines.push('   Tanyakan field di atas SATU PER SATU sampai semua ✅ — BARU tampilkan summary.');
    lines.push('');
    lines.push('⛔ DATA INTEGRITY — WAJIB DIPATUHI:');
    if (!state.moveInDate) {
      lines.push('   • Q8 = NULL → DILARANG KERAS menulis "Masuk: Juni" atau bulan apapun.');
      lines.push('     Jangan inferensi dari tanggal sistem. Jika Q8 ❓ → baris Masuk TIDAK ADA di brief.');
    }
    if (!state.redFlags) {
      lines.push('   • Q5 = NULL → DILARANG KERAS menulis "Red flags: Disebutkan" atau "Hindari: Disebutkan".');
      lines.push('     Jika Q5 ❓ → baris Red flags TIDAK ADA di brief. Tanyakan Q5 dulu.');
    }
    if (!state.anchorPoint) {
      lines.push('   • Q6 = NULL → DILARANG KERAS menulis "Patokan: Disebutkan" atau "Patokan lokasi: Disebutkan".');
      lines.push('     Jika Q6 ❓ → baris Patokan lokasi TIDAK ADA di brief. Tanyakan Q6 dulu.');
    }
  }

  // ── ⚡ NEXT ACTION directive ───────────────────────────────────────────────
  // Tells the AI exactly which question to ask next, derived from state — NOT
  // from raw conversation history. This is the single most effective guard
  // against the AI re-asking answered questions or looping.
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════╗');
  const nextQ = findNextQuestion(state);
  if (nextQ) {
    lines.push(`║  ⚡ PERTANYAAN BERIKUTNYA: ${nextQ.q.padEnd(32)}║`);
    lines.push('╠══════════════════════════════════════════════════════════╣');
    lines.push(`║  Tanyakan: "${nextQ.hint}"`);
    lines.push('╠══════════════════════════════════════════════════════════╣');
    lines.push('║  ⛔ JANGAN tanya pertanyaan lain selain yang di atas.    ║');
    lines.push('║  ⛔ JANGAN ulangi field yang sudah ✅ di atas.           ║');
    lines.push('║  ⛔ ABAIKAN raw history — STATE BLOCK = satu-satunya     ║');
    lines.push('║     sumber kebenaran tentang apa yang sudah dijawab.     ║');
  } else {
    lines.push('║  ✅ SEMUA Q WAJIB SUDAH DIJAWAB                          ║');
    lines.push('║  → Tampilkan summary brief sekarang.                     ║');
  }
  lines.push('╚══════════════════════════════════════════════════════════╝');

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

function buildContactReplyPrompt({ name, email, phone, subject, message, agentName = '', appName = '' }, provider = 'shared') {
  const firstName = (name || '').split(' ')[0] || name;

  // Nama agent & app SELALU dinamis — agent dari database (di-pass via payload),
  // app dari APP_NAME env. JANGAN hardcode "Elvan" / "Elevan Property".
  const resolvedAppName   = appName || process.env.APP_NAME || 'Elevan Property';
  const resolvedAgentName = agentName || process.env.AGENT_NAME || resolvedAppName;

  return `${getProjectSkillInstruction(provider)}

Task: Compose a professional, warm, and empathetic WhatsApp follow-up reply for a new Contact Form submission from a prospective property client.

## Persona
You are ${resolvedAgentName}, a senior property consultant at ${resolvedAppName} — a trusted Indonesian property agency.
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
   One sentence about how ${resolvedAppName} can help them achieve their property goal.
   Be specific to their inquiry (buying, renting, selling, inquiry, etc.).

4. **ONE Focused Follow-up Question**
   Ask exactly ONE smart, relevant question that helps qualify or clarify their need.
   Make it feel natural and helpful — not interrogative.
   Examples: asking about budget range, preferred location, desired move-in date, property type preference, etc.
   Choose the MOST important unknown from their message.

5. **Warm Closing**
   Invite them to continue the conversation freely on WhatsApp.
   Sign off warmly.
   Use: "Salam hangat," (Indonesian) or "Warm regards," (English) followed by "*${resolvedAgentName}*\\n*${resolvedAppName}*"

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
  // ── Identitas dinamis (JANGAN hardcode "LEO FELIX" / "Elevan Property") ──
  // Nama agent SELALU dari database (session.agentName); nama app dari APP_NAME env.
  const resolvedAppName   = process.env.APP_NAME || 'Elevan Property';
  const resolvedAgentName = session?.agentName || process.env.AGENT_NAME || resolvedAppName;

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
"Di [area] ada Villa yang di kisaran [LOW range] dan ada juga yang [HIGH range]. Kira-kira yang mana lebih sesuai dengan rencana Bapak/Ibu?"
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

✓ Budget: *[nilai dari Q3 — HANYA jika ✅]*

✓ Masuk: *[nilai dari Q8 — HANYA jika ✅]*

✓ Keputusan bersama: *[nilai dari Q9 — HANYA jika ✅]*

✓ Furnitur: *[nilai dari Q11 — HANYA jika ✅]*

✓ Red flags: *[nilai PERSIS dari Q5 di QUALIFICATION STATE — HANYA jika ✅]*

✓ Patokan lokasi: *[nilai PERSIS dari Q6 di QUALIFICATION STATE — HANYA jika ✅]*

✓ Area alternatif: *[nilai dari Q7 — HANYA jika ✅]*



Saya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠

Terima kasih sudah menghubungi saya. 🙏



Salam hangat,
${resolvedAgentName}
${resolvedAppName}
\`\`\`

### Summary Strict Rules
- **HANYA sertakan field yang ✅ di QUALIFICATION STATE.** Jangan sertakan field yang ❓ — lewati baris itu seluruhnya. Tidak ada tanda "Belum", "N/A", atau apapun untuk field ❓.
- **Gunakan nilai PERSIS yang tertera setelah ": " di baris ✅** — salin kata per kata tanpa parafrase.
- **JANGAN gunakan nilai dari raw conversation history** jika field tersebut ❓ di QUALIFICATION STATE.
- **⛔ DILARANG KERAS tulis "Disebutkan", "Ada", "Iya", "Diketahui", "Pernah", "Sudah", atau frasa samar apapun sebagai nilai field di summary.** Jika fieldnya ❓ → baris itu TIDAK ADA di summary, titik.
- **⛔ DILARANG KERAS: Jangan inferensi "Masuk: [bulan]" dari tanggal sistem.** Jika Q8 ❓ → baris "Masuk" TIDAK ADA di brief.
- **⛔ DILARANG KERAS: Jangan tulis "Patokan lokasi: Disebutkan" atau "Hindari: Disebutkan".** Jika Q6 ❓ atau Q5 ❓ → baris itu TIDAK ADA di brief.
- **⛔ DILARANG KERAS: Jangan tampilkan summary jika Q8 (Tanggal masuk) masih ❓.** Tanyakan Q8 dulu.
- **⛔ DILARANG KERAS: Jangan tampilkan summary jika Q5 (Red flags) masih ❓.** Tanyakan Q5 dulu.
- **⛔ DILARANG KERAS: Jangan tampilkan summary jika Q6 (Patokan lokasi) masih ❓.** Tanyakan Q6 dulu.
- **⛔ Label "Hindari" TIDAK ADA** dalam template brief. Jangan gunakan label "Hindari" — gunakan "Red flags" jika Q5 ✅.
- **⛔ Q9 nilai "Mandiri"** — jika customer memutuskan sendiri, tampilkan persis: "Mandiri". Jangan tulis "Solo (mandiri)", "Solo", atau varian lain.
- One question per message only.
- Maximum 12 AI messages before showing brief (even if incomplete).
- Never show catalog, Rumah123 listings, or property details in this mode.

### Tanda Tangan / Signature
⛔ **JANGAN tambahkan** "Salam hangat," atau nama/tanda tangan agen di akhir pertanyaan kualifikasi Q1–Q12 MANAPUN.
⛔ **JANGAN akhiri pertanyaan dengan "Salam hangat," nama agen, atau nama perusahaan** — akhiri pertanyaan LANGSUNG setelah kalimat tanya atau emoji terakhir.
✅ Tanda tangan HANYA boleh ada satu kali — di dalam summary brief final (sudah termasuk dalam template di atas), dan TIDAK di tempat lain.
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
1. ⚠️ JIKA ADA BANNER "SUMMARY SUDAH DIKIRIM" DI QUALIFICATION STATE: Customer memulai pencarian baru.
   • Lihat QUALIFICATION STATE — sudah ada field ✅ dari pesan saat ini (tipe/transaksi sudah disebutkan ulang oleh customer).
   • Tanyakan field ❓ dengan nomor Q TERKECIL dari yang tersisa (biasanya Q1 atau Q2).
   • Jika Q1 sudah ✅ (customer sudah sebut tx+tipe di pesan ini) → langsung tanya Q2 (lokasi).
   • Jika Q1 masih ❓ → tanya: "Untuk pencarian baru, mau *sewa* atau *beli*? Dan tipe propertinya apa? 🏠"
   • JANGAN tampilkan summary lagi sampai semua Q wajib terjawab ulang di sesi ini.
2. ⚠️ JIKA ADA BANNER "TIPE PROPERTI BERUBAH" DI QUALIFICATION STATE: Akui perubahan singkat (1 kalimat, contoh: "Oke, saya alihkan ke rumah sewa ya 😊"), lalu tanyakan Q terkecil yang masih ❓. JANGAN gunakan jawaban Q2–Q12 dari tipe lama.
3. Jika pesan terbaru adalah jawaban singkat untuk pertanyaan sebelumnya → AKUI singkat (1 kalimat), lalu tanyakan pertanyaan ❓ BERIKUTNYA dengan nomor Q terkecil.
   — Khusus Q2b (Riwayat pencarian): Jawaban seperti "Saya belum pernah lihat", "belum pernah", "sudah lihat 3" adalah jawaban Q2b yang valid → AKUI ("Oke, belum ada referensi sebelumnya 👌") → lanjut ke Q3 (Budget).
4. Jika pesan terbaru mengandung informasi baru → catat, lalu tanyakan pertanyaan ❓ berikutnya.
5. Jika semua pertanyaan wajib (Q1 tx, building type, Q2 lokasi, Q3 budget, Q4 penghuni, Q5 red flags, Q6 patokan lokasi, Q7 area alternatif, Q8 tanggal) sudah ✅ DAN tidak ada banner ⚠️ → tampilkan structured brief.
⛔ JANGAN tampilkan listing properti dalam mode ini.
⛔ JANGAN tanya ulang pertanyaan yang sudah ✅ di QUALIFICATION STATE.
⛔ SATU pertanyaan per pesan — jangan gabungkan dua pertanyaan.
⛔ Q3 Budget: JANGAN tanya langsung — gunakan 2 harga kontras sebagai pilihan reaksi.
⛔ Pesan ambigu ("cari properti", "ada properti?") tanpa tipe/transaksi → tanyakan Q1: "Mau sewa atau beli? Dan tipe propertinya apa?"
⛔ JANGAN tampilkan summary jika Q3 (Budget) atau Q8 (Tanggal masuk) masih ❓ di QUALIFICATION STATE — walaupun budget/tanggal muncul di raw conversation history dari sesi lama.
⛔ JANGAN tampilkan summary jika ada banner ⚠️ di atas, atau jika ada field ❓ yang belum dijawab.
⛔ Field ❓ di QUALIFICATION STATE = BELUM dijawab di sesi aktif ini. ABAIKAN semua nilai budget/tanggal/penghuni/furnitur dari percakapan sebelumnya (sesi lama) — itu bukan jawaban untuk sesi ini.`
    : `Create the final WhatsApp reply using only the backend property catalog context above.
If exact matches are available, recommend exact matches directly.
If no exact match is available, say that no exact match is available and then present only the backend alternatives.
⛔ JANGAN tambahkan "Salam hangat," atau tanda tangan agen di akhir pesan — platform sudah menangani tanda tangan secara terpisah.`
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

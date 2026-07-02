const { loadProjectSkillPrompt } = require('./skillPromptService');
const { detectBudget, detectFacilities, stripCommercialUsePhrases, detectUseCase, isNonResidentialUse } = require('./propertyRecommendationService');
const { parseCustomerDate, isDontKnowDateAnswer, WAITING_THE_UPDATE } = require('../utils/customerDateParser');

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
    district        : null,   // Q2c: area/district within large city (Surabaya → Pakuwon, Rungkut, dll)
    budget          : null,   // Q3
    household       : null,   // Q4
    redFlags        : null,   // Q5
    anchorPoint     : null,   // Q6
    alternativeAreas: null,   // Q7
    moveInDate      : null,   // Q8 MANDATORY
    moveInDateAsk   : null,   // 'current_month' | 'soon' — Q8 perlu klarifikasi (rule 25/35)
    decisionMaker   : null,   // Q9
    leaseDuration   : null,   // Q10
    furnishing      : null,   // Q11
    facilities      : null,   // amenities (gym, kids zone, kolam renang, dll) — opsional
    apartmentPref   : null,   // Q12
    financing       : null,   // Q_KPR  (beli only): cash | KPR | kombinasi
    kprDetails      : null,   // Q_KPR-a (beli + KPR): bank & DP
    propertyCondition: null,  // Q_COND (beli residensial): baru/ready | second | inden
    useCase         : null,   // own-use | investasi | ibadah | kantor/usaha | liburan
    rentOutIntent   : false,  // investasi yang akan disewakan (kos/kontrakan) → tanya target penyewa
    aiAskedQ2b      : false,  // true when AI already asked Q2b — show ⏭️, NEVER repeat
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
      // Strip commercial use-phrases ("dipakai kantor"/"buat usaha") so a residential
      // property used commercially isn't read as a type switch (→ reset).
      const w = stripCommercialUsePhrases((txt || '').toLowerCase());
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
      if (/\brumah\b(?!\s+(?:makan|sakit|tangga|ibadah|duka|produksi|tahanan|susun|potong|kos))|\bhouse\b|\bkontrakan\b/.test(w))                   return 'house';
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

    // ── Boundary B: latest customer message that switches type, tx, OR city ──
    // Scans ALL (incl. current message). A switch is only counted once a prior
    // value has been established — the first mention is the initial choice.
    //
    // LOCATION RULE: if the customer switches from one city to another
    // (e.g. "di Surabaya" → "di Bali") everything resets to Q1, just like a
    // property-type or transaction-type change. All three dimensions anchor the
    // search — switching any one abandons the prior context.
    const locOfP0 = (txt) => {
      // Reuse CITY_RE (defined two lines above in this function scope)
      const m = CITY_RE.exec((txt || '').toLowerCase());
      return m ? m[0].trim() : null;
    };

    let switchStart   = 0;
    let switchType    = null;   // previous type, for the change banner
    {
      let runType = null;
      let runTx   = null;
      let runLoc  = null;
      for (let i = 0; i < ALL.length; i++) {
        if (!QS_CUST_ROLES.has(ALL[i].role)) continue;
        const t   = typeOfP0(ALL[i].message);
        const tx  = txOfP0(ALL[i].message);
        const loc = locOfP0(ALL[i].message);
        const typeFlipped = t   && runType && t   !== runType;
        const txFlipped   = tx  && runTx   && tx  !== runTx;
        const locFlipped  = loc && runLoc  && loc !== runLoc;
        if (typeFlipped || txFlipped || locFlipped) {
          switchStart = i;
          switchType  = runType;   // remember what they switched away from
        }
        if (t)   runType = t;
        if (tx)  runTx   = tx;
        if (loc) runLoc  = loc;
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
    // Strip USE-phrases first so "rumah utk bangun kos", "ruko buat ibadah",
    // "dipakai sebagai kantor" don't flip the type to the USE word.
    if (!state.buildingType) {
      const tt = stripCommercialUsePhrases(text);
      if (/\bkondotel\b|\bcondotel\b/.test(tt))                          state.buildingType = 'kondotel';
      else if (/\bmansion\b|\brumah\s+mewah\b/.test(tt))               state.buildingType = 'mansion';
      else if (/\bvill?a\b/.test(tt))                                    state.buildingType = 'villa';
      else if (/\bapartemen\b|\bapartment\b/.test(tt))                   state.buildingType = 'apartment';
      else if (/\bhotel\b|\bpenginapan\b/.test(tt))                     state.buildingType = 'hotel';
      else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(tt))      state.buildingType = 'boarding_house';
      else if (/\bruko\b|\brukan\b/.test(tt))                           state.buildingType = 'shophouse';
      else if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(tt))     state.buildingType = 'store';
      else if (/\bkantor\b/.test(tt))                                   state.buildingType = 'office';
      else if (/\bgudang\b/.test(tt))                                   state.buildingType = 'warehouse';
      else if (/\brumah\b(?!\s+(?:makan|sakit|tangga|ibadah|duka|produksi|tahanan|susun|potong|kos))|\bhouse\b|\bkontrakan\b/.test(tt))           state.buildingType = 'house';
      else if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(tt)) state.buildingType = 'others';
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

    // Q2c — District / area within large city
    // Only detect when a city-level location is known, and customer mentions a specific area.
    if (!state.district && state.location) {
      const locL = state.location.toLowerCase();
      let areaList = null;
      if (locL.includes('surabaya')) {
        areaList = ['rungkut', 'pakuwon', 'pakuwon city', 'darmo', 'wonokromo', 'kenjeran',
          'gubeng', 'sukolilo', 'mulyorejo', 'tenggilis', 'gayungan', 'benowo',
          'lakarsantri', 'sambikerep', 'sukomanunggal', 'dukuh pakis', 'sawahan',
          'genteng', 'bubutan', 'simokerto', 'krembangan', 'asemrowo', 'tandes',
          'wiyung', 'karangpilang', 'wonocolo', 'jambangan', 'dukuh kupang',
          'ngagel', 'nginden', 'citraland', 'graha family', 'kembang jepun',
          'surabaya selatan', 'surabaya utara', 'surabaya barat', 'surabaya timur', 'surabaya pusat'];
      } else if (locL.includes('jakarta')) {
        areaList = ['menteng', 'kebayoran', 'kemang', 'kuningan', 'sudirman', 'thamrin',
          'kelapa gading', 'pluit', 'pantai indah kapuk', 'pik', 'sunter', 'tebet',
          'senayan', 'fatmawati', 'cempaka putih', 'condet', 'mampang',
          'jakarta selatan', 'jakarta utara', 'jakarta barat', 'jakarta timur', 'jakarta pusat'];
      } else if (locL.includes('bandung')) {
        areaList = ['dago', 'buah batu', 'antapani', 'cicaheum', 'pasteur', 'setrasari',
          'setiabudi', 'sukajadi', 'bojongsoang', 'cimahi', 'lembang',
          'bandung selatan', 'bandung utara', 'bandung barat', 'bandung timur'];
      } else if (locL.includes('semarang')) {
        areaList = ['banyumanik', 'gajahmungkur', 'tembalang', 'pedurungan',
          'semarang tengah', 'semarang selatan', 'semarang barat', 'semarang timur'];
      } else if (locL.includes('makassar')) {
        areaList = ['panakkukang', 'tamalate', 'biringkanaya', 'rappocini', 'manggala',
          'makassar pusat', 'makassar selatan', 'makassar timur'];
      } else if (locL.includes('medan')) {
        areaList = ['medan baru', 'medan sunggal', 'medan petisah', 'medan helvetia',
          'medan kota', 'medan selayang', 'medan polonia'];
      }
      if (areaList) {
        const found = areaList.find(a => text.includes(a));
        if (found) state.district = found.replace(/\b\w/g, c => c.toUpperCase());
      }
    }

    // Q2b — Direct Phase-1 capture for explicit "belum/sudah lihat" answers.
    // This runs independently of Phase-2 AI→customer pair detection so Q2b is
    // captured even if the pair-based scan misses the turn (e.g. duplicate message
    // in ALL, race condition, or AI phrased the Q2b question differently).
    if (!state.searchHistory) {
      if (/\b(belum\s+pernah(\s+lihat|\s+survey)?|sudah\s+lihat\s+\d|belum\s+lihat|sudah\s+survey|baru\s+mulai|belum\s+survey|belum\s+ada\s+yang\s+cocok)\b/i.test(text)) {
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

    // Facilities (optional — accumulate amenities across the session)
    {
      const fac = detectFacilities(raw);
      if (fac.length) {
        const prev = Array.isArray(state.facilities) ? state.facilities : [];
        state.facilities = [...new Set([...prev, ...fac])];
      }
    }

    // Q6 — Anchor point (volunteered landmark). Capture "dekat/deket/near X" even
    // when the customer states it inside another answer (e.g. with facilities) and
    // not paired with the Q6 question. Exclude "dekat <kota>" (that's the location).
    if (!state.anchorPoint) {
      const am = raw.match(/\b(?:dekat|deket|near)\s+([a-z][\w\s,.\/&-]{2,60})/i);
      if (am) {
        const after = am[1].trim();
        const cleaned = after.replace(/\s+(ya|dong|kak|aja|saja|nih|lainnya)\b.*$/i, '').trim();
        if (cleaned && !CITY_RE.test(after)) {
          state.anchorPoint = `dekat ${cleaned}`;
        }
      }
    }

    // Q4 — Household
    if (!state.household) {
      // Explicit headcount "N orang / N pax / for N people" — works for ANY number,
      // not just 2-4. A group (≥6) is a strong signal toward villa/large capacity.
      const headcount = text.match(/\b(\d{1,3})\s*(?:orang|pax|people|tamu|peserta)\b/);
      if (headcount) {
        const n = parseInt(headcount[1], 10);
        if (n >= 1 && n <= 200) {
          state.household = n >= 6 ? `${n} orang (rombongan/grup)` : `${n} orang`;
        }
      }
      if (!state.household && /\b(rombongan|grup|group|gathering|arisan|reuni|keluarga besar)\b/.test(text)) {
        state.household = 'rombongan/grup';
      }
      if (!state.household && (/\bsendiri\b|\bsendiran\b|\bjust me\b|\balone\b/.test(text))) {
        state.household = '1 orang (sendiri)';
      } else if (!state.household && /\bsama (istri|suami)\b|\bbersama (istri|suami)\b/.test(text)) {
        state.household = '2 orang (bersama pasangan)';
      } else if (!state.household && /\bberdua\b/.test(text) && !/\bberdua (sama|dengan)\s*(sekolah|kantor|mall)/.test(text)) {
        state.household = '2 orang (berdua)';
      } else if (!state.household && /\bkeluarga\b/.test(text) && !/\bkeluarga lain\b|\bkoordinasi.*keluarga\b/.test(text)) {
        state.household = 'keluarga';
      } else if (!state.household && (/\borangtua\b|\borang tua\b|\bparents\b/.test(text))) {
        state.household = 'dengan orangtua';
      }
    }

    // ── Use-case (semua tipe transaksi) — menentukan apakah Q4 "tinggal bersama
    //    siapa" relevan. Hanya hunian-sendiri yang perlu Q4. Ibadah, kantor/usaha,
    //    investasi (disewakan/warung/kos/didiamkan), dan liburan/dinas TIDAK perlu.
    //    Cth: rumah dibeli utk investasi → tidak ditinggali → jangan tanya penghuni.
    if (!state.useCase) {
      const uc = detectUseCase(raw);
      if (uc === 'ibadah')          state.useCase = 'ibadah (non-hunian)';
      else if (uc === 'kantor')     state.useCase = 'kantor (non-hunian)';
      else if (uc === 'usaha')      state.useCase = 'usaha (non-hunian)';
      else if (uc === 'investasi')  state.useCase = 'investasi';
      else if (uc === 'liburan')    state.useCase = 'liburan/menginap sementara';
    }
    // Rent-out intent → for investment, the relevant question is the TARGET TENANT
    // (not "tinggal bersama siapa"). Held-as-asset / warung / ibadah have neither.
    if (!state.rentOutIntent && /\b(disewakan|sewakan|disewain|dikontrakkan|dikontrakan|kos[\s-]?kosan|kontrakan|kontrakkan|bangun\s+kos)\b/.test(text)) {
      state.rentOutIntent = true;
    }

    // Q8 — Move-in / check-in / target date — deterministic 35-rule parser.
    // 'ok'                → store normalized "DD Bulan YYYY" (year rollover, DD/MM vs
    //                        MM/DD disambiguation, bare month → tanggal 1, dll).
    // 'ask_current_month' → customer menyebut bulan berjalan tanpa tanggal (rule 25)
    // 'ask_soon'          → customer bilang "segera" (rule 35)
    // Keduanya WAJIB diklarifikasi dulu; jika customer tidak tahu → "Waiting the update".
    if (!state.moveInDate) {
      const parsed = parseCustomerDate(raw, now);
      if (parsed) {
        if (parsed.status === 'ok') {
          state.moveInDate    = parsed.formatted;
          state.moveInDateAsk = null;
        } else if (parsed.status === 'ask_current_month') {
          state.moveInDateAsk = 'current_month';
        } else if (parsed.status === 'ask_soon') {
          state.moveInDateAsk = 'soon';
        }
      }
    }

    // ── BELI-only slots (Q_KPR / Q_COND / use-case) — bagian dari 24 kombinasi ──
    if (state.transactionType === 'sale') {
      // Q_KPR — pembiayaan (MANDATORY untuk semua 12 tipe beli)
      if (!state.financing) {
        const hasKpr  = /\b(kpr|kpa|kpt|kredit|mortgage|dp\s*\d+)\b/.test(text);
        const hasCash = /\b(cash|tunai)\b/.test(text);
        if (hasKpr && hasCash)  state.financing = 'kombinasi cash + KPR';
        else if (hasKpr)        state.financing = 'KPR';
        else if (hasCash)       state.financing = 'cash';
      }
      // Q_COND — kondisi (beli residensial): baru/ready | second | inden
      if (!state.propertyCondition) {
        if (/\bready\s*stock\b|\bbaru\/ready\b/.test(text))      state.propertyCondition = 'baru/ready';
        else if (/\b(second|bekas)\b/.test(text))                 state.propertyCondition = 'second';
        else if (/\binden\b/.test(text))                          state.propertyCondition = 'inden';
      }
      // Use-case (beli) — fallback ke huni-sendiri bila customer eksplisit menyebutnya.
      // (Kategori non-hunian — investasi/ibadah/kantor/usaha — sudah ditangkap umum di atas.)
      if (!state.useCase && /\b(ditempati|tinggal|huni|pakai|operasional)\s+sendiri\b/.test(text)) {
        state.useCase = 'huni/pakai sendiri';
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

  // ── Phase 1.5: Detect whether AI already asked Q2b ──────────────────────────
  // Runs after Phase 1 so state.searchHistory (if set by Phase 1) takes priority.
  // If customer answered Q2b with something that didn't match Phase-1 patterns
  // (e.g. "AC, kamar mandi dalam" instead of "belum pernah"), we still know
  // AI already asked → ⏭️ SKIP, never repeat Q2b.
  if (!state.searchHistory) {
    const Q2B_ASKED_RE = /sudah\s+lihat\s+berapa|how\s+many\s+(?:prop|properties)|apa\s+yang\s+membuat\s+belum\s+cocok|sudah\s+sempat\s+lihat|sebelumnya\s+sudah\s+sempat/i;
    state.aiAskedQ2b = ACTIVE_ALL.some(m =>
      QS_AI_ROLES.has(m.role) && Q2B_ASKED_RE.test(m.message || '')
    );
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

    // Q2c — district/area (pair detection: AI asked which area, customer answered)
    if (!state.district && /area.{0,20}(mana|kawasan|wilayah)|kawasan.{0,20}mana|daerah.{0,20}mana|di bagian mana|which area|which.{0,15}neighbourhood|bagian.{0,20}(surabaya|jakarta|bandung|medan|semarang|makassar)/i.test(aiText)) {
      const candidateDistrict = custResp.trim();
      if (candidateDistrict && !/^(tidak|belum|ga|gak|ngga|tidak\s+ada|manapun|flexible|fleksibel)\b/i.test(candidateDistrict)) {
        state.district = candidateDistrict;
      }
    }

    // Q6 — anchor point
    if (!state.anchorPoint && /patokan|dekat sekolah|dekat kantor|mall tertentu|anchor|wisata|kawasan tertentu|tempat tertentu.*patokan/.test(aiText)) {
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

      // Sinyal OTORITAS KEPUTUSAN — kata yang benar-benar menunjuk siapa yang
      // memutuskan (sendiri vs koordinasi, dengan siapa). Hanya jika salah satu ada,
      // jawaban boleh dianggap menjawab Q9.
      const DECISION_SIGNAL_RE = /\b(sendiri|sendirian|seorang diri|solo|mandiri|langsung|keputusan|memutuskan|putuskan|tentukan|decide|koordinasi|konfirmasi|diskusi|izin|minta\s+izin|istri|suami|pasangan|keluarga|orang\s*tua|orangtua|ayah|ibu|parents|bos|atasan|partner)\b/i;

      // Guard: jawaban yang sebenarnya tentang TANGGAL atau JADWAL/SURVEI — bukan siapa
      // pengambil keputusan — TIDAK boleh mengisi decisionMaker. Customer sering menjawab
      // Q9 dengan kesediaan/waktu survei ("mau survei, besok lusa saya bisa") atau tanggal
      // masuk; itu menjawab logistik viewing, BUKAN otoritas keputusan. Biarkan Q9 tetap ❓
      // agar AI menanyakan otoritas keputusan dengan jelas (jangan mengarang nilai).
      const MONTH_ID_RE = /\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i;
      const MONTH_EN_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
      const DATE_ANSWER_RE = /\b(tahun\s+depan|bulan\s+depan|minggu\s+depan|next\s+(year|month|week)|besok|lusa|hari\s+ini|sekarang|nanti|secepatnya|20\d{2}|\d{1,2}\s*(hari|minggu|bulan))\b/i;
      const SCHEDULING_ONLY_RE = /\b(survei|survey|viewing|lihat|liat|kunjung|datang|jadwal|jadwalkan|cek\s+lokasi|mampir)\b/i;

      if ((MONTH_ID_RE.test(lo) || MONTH_EN_RE.test(lo) || DATE_ANSWER_RE.test(lo) || SCHEDULING_ONLY_RE.test(lo)) &&
          !DECISION_SIGNAL_RE.test(lo)) {
        // Jawaban tanggal/jadwal/survei tanpa sinyal keputusan → JANGAN simpan. Q9 ❓.
      } else if (/\b(saya|aku)\b.{0,40}\b(ambil keputusan|yang memutuskan|yang putuskan|yang tentukan|yang decide)\b/i.test(lo) ||
          /\b(ambil keputusan|yang memutuskan|saya sendiri)\b/i.test(lo) ||
          /\btidak perlu koordinasi\b|\b(nggak|ngga|gak|ga|tdk|tidak)\s+perlu koordinasi\b|\btanpa koordinasi\b|\blangsung\s+(bisa|aja|saja|jadwal\w*|viewing|survei|survey|book\w*)\b|\bbisa langsung\b/i.test(lo)) {
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
      } else if (DECISION_SIGNAL_RE.test(lo)) {
        // Ada sinyal keputusan tapi tak match pola spesifik → simpan apa adanya.
        state.decisionMaker = resp;
      }
      // else: tidak ada sinyal keputusan sama sekali → biarkan null (Q9 tetap ❓,
      // AI akan menanyakannya; JANGAN tangkap jawaban yang tak relevan).
    }
    // Q10 — lease duration
    // Skip if customer answers with a date instead of a duration (e.g. "26 Juni 2026" → misunderstood question)
    if (!state.leaseDuration && /sewa\s+(?:untuk\s+)?berapa lama|berapa lama.*sewa|durasi\s+sewa/.test(aiText)) {
      const looksLikeDate = new RegExp(`\\b\\d{1,2}\\s+(?:${MONTH_ID}|${MONTH_EN})\\b`, 'i').test(custResp);
      if (!looksLikeDate) {
        // Extract clean "N unit" — strip filler like "Butuh ... sewa, Kak" → "10 hari"
        const durMatch = custResp.match(/\b(\d+)\s*(hari|malam|minggu|bulan|tahun|day|night|week|month|year)s?\b/i);
        if (durMatch) {
          const uMap = { hari:'hari',day:'hari',malam:'malam',night:'malam',minggu:'minggu',week:'minggu',bulan:'bulan',month:'bulan',tahun:'tahun',year:'tahun' };
          state.leaseDuration = `${durMatch[1]} ${uMap[durMatch[2].toLowerCase()] || durMatch[2].toLowerCase()}`;
        } else {
          state.leaseDuration = custResp;
        }
      }
      // If it looks like a date: leave leaseDuration null so Q10 gets re-asked with clearer hint
    }
    // Q8 follow-up — AI sudah menanyakan tanggal (klarifikasi rule 25/35) dan
    // customer menjawab "belum tahu / belum pasti / tidak bisa memutuskan"
    // → nilai summary Q8 = "Waiting the update" (jangan tanya berulang-ulang).
    if (!state.moveInDate &&
        /tanggal|masuk bulan apa|check-?in|target.*(beli|deal)|kapan.*(masuk|pindah|mulai|proses)/.test(aiText) &&
        isDontKnowDateAnswer(custResp)) {
      state.moveInDate    = WAITING_THE_UPDATE;
      state.moveInDateAsk = null;
    }

    // Q_KPR-a — bank & DP (fires hanya jika AI menanyakan detail KPR)
    if (!state.kprDetails && /bank.{0,30}(dituju|approve|rekomendasi)|dp.{0,20}persen|berapa\s+persen.{0,20}dp/.test(aiText)) {
      state.kprDetails = custResp;
    }

    // Q_COND — kondisi properti (fires jika AI menanyakan baru/second/inden)
    if (!state.propertyCondition && /baru.{0,30}second|second.{0,30}inden|kondisi.{0,20}(rumah|unit|properti)|ready.{0,10}stock.{0,20}inden/.test(aiText)) {
      if (/\b(baru|ready)\b/i.test(custResp))       state.propertyCondition = 'baru/ready';
      else if (/\b(second|bekas)\b/i.test(custResp)) state.propertyCondition = 'second';
      else if (/\binden\b/i.test(custResp))          state.propertyCondition = 'inden';
      else if (custResp.trim())                      state.propertyCondition = custResp.trim();
    }

    // Q_FAC — facilities (opsional). AI tanya fasilitas → customer jawab apapun → catat.
    // "standar", "biasa", "tidak ada", "terserah" = tidak ada preferensi spesifik → simpan 'standar'
    // agar AI tidak mengulangi pertanyaan fasilitas (field ❓ yang sudah dijawab).
    if ((!state.facilities || (Array.isArray(state.facilities) && !state.facilities.length)) &&
        /fasilitas|amenity|amenities|facility|kolam|gym|parking|parkir/i.test(aiText) &&
        custResp.trim()) {
      const custLo = custResp.toLowerCase();
      if (/\b(standar|biasa|standard|gak ada|tidak ada|apa saja|terserah|bebas|gapapa|ga pa pa|ngga ada|engga ada)\b/i.test(custLo)) {
        state.facilities = ['standar'];
      }
      // Specific facilities already captured by Phase 1 detectFacilities; this only covers
      // the "no preference / standard" case that detectFacilities misses.
    }
    // Q5 — red flags
    if (!state.redFlags && /pasti tidak cocok|ingin dihindari|yang\s+dihindari|hadap barat|gang sempit|rumah tua|rawan banjir|rel kereta/.test(aiText)) {
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
      state.moveInDateAsk    = null;
      state.decisionMaker    = null;
      state.leaseDuration    = null;
      state.furnishing       = null;
      state.facilities       = null;
      state.apartmentPref    = null;
      state.financing        = null;
      state.kprDetails       = null;
      state.propertyCondition = null;
      state.useCase          = null;
      state.rentOutIntent    = false;

      // Re-populate ONLY what the current message explicitly states — all 12 types.
      // Strip commercial use-phrases ("dipakai kantor") so they don't set a wrong type.
      const cur = stripCommercialUsePhrases((currentMessage || '').toLowerCase().trim());
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
      else if (/\brumah\b(?!\s+(?:makan|sakit|tangga|ibadah|duka|produksi|tahanan|susun|potong|kos))|\bhouse\b|\bkontrakan\b/.test(cur))                state.buildingType = 'house';
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
      const w = stripCommercialUsePhrases((msg.message || '').toLowerCase());
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
      if (/\brumah\b(?!\s+(?:makan|sakit|tangga|ibadah|duka|produksi|tahanan|susun|potong|kos))|\bhouse\b|\bkontrakan\b/.test(w))                   return 'house';
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

    // Strip commercial use-phrases so "dipakai kantor"/"buat usaha" doesn't read as
    // a type switch (house→office) and reset the search.
    const cur = stripCommercialUsePhrases((currentMessage || '').toLowerCase().trim());
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
    else if (/\brumah\b(?!\s+(?:makan|sakit|tangga|ibadah|duka|produksi|tahanan|susun|potong|kos))|\bhouse\b|\bkontrakan\b/.test(cur))                curType = 'house';
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
      state.moveInDateAsk    = null;
      state.decisionMaker    = null;
      state.leaseDuration    = null;
      state.furnishing       = null;
      state.facilities       = null;
      state.apartmentPref    = null;
      state.financing        = null;
      state.kprDetails       = null;
      state.propertyCondition = null;
      state.useCase          = null;
      state.rentOutIntent    = false;
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
  const _humanType = {
    house: 'Rumah', apartment: 'Apartemen', villa: 'Villa', hotel: 'Hotel',
    boarding_house: 'Kos', shophouse: 'Ruko', office: 'Kantor', warehouse: 'Gudang',
    store: 'Toko', mansion: 'Mansion', kondotel: 'Kondotel', others: 'Properti',
  };
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

  // Q2c — Area/district dalam kota besar (SEBELUM Q2b — mempersempit area pencarian)
  // Hanya berlaku untuk kota besar yang punya banyak area/district.
  const LARGE_CITIES_Q2C = ['surabaya', 'jakarta', 'bandung', 'medan', 'semarang', 'makassar', 'palembang', 'tangerang'];
  if (!state.district && state.location &&
      LARGE_CITIES_Q2C.some(c => state.location.toLowerCase().includes(c)) &&
      !isBooking && !isCommercial) {
    let areaEx = 'Misalnya pusat kota, area selatan, kawasan tertentu?';
    if (state.location.toLowerCase().includes('surabaya'))
      areaEx = 'Misalnya Pakuwon, Darmo, Rungkut, Gubeng, Kenjeran, atau area lainnya?';
    else if (state.location.toLowerCase().includes('jakarta'))
      areaEx = 'Misalnya Kebayoran, Menteng, Kelapa Gading, Kemang, atau area lainnya?';
    else if (state.location.toLowerCase().includes('bandung'))
      areaEx = 'Misalnya Dago, Buah Batu, Antapani, Pasteur, atau area lainnya?';
    else if (state.location.toLowerCase().includes('semarang'))
      areaEx = 'Misalnya Banyumanik, Tembalang, Gajahmungkur, atau area lainnya?';
    else if (state.location.toLowerCase().includes('makassar'))
      areaEx = 'Misalnya Panakkukang, Tamalate, Rappocini, atau area lainnya?';
    return { q: 'Q2c', hint: `Di area atau kawasan mana di ${loc} yang Anda pertimbangkan? 📍 ${areaEx}` };
  }

  // Q2b — Riwayat pencarian (kecuali untuk booking hotel/kondotel dan properti komersial)
  if (!state.searchHistory && !state.aiAskedQ2b && !isBooking) {
    const humanType = _humanType[type] || 'properti';
    return { q: 'Q2b', hint: `Sudah lihat berapa ${humanType} di ${loc}? Apa yang membuat belum cocok dari yang sudah dilihat?` };
  }

  // Q3 — Budget (via 2 harga kontras — JANGAN tanya langsung)
  if (!state.budget)
    return { q: 'Q3', hint: `Di ${loc} ada *${typeLbl}* kisaran [harga rendah${isBooking ? '/malam' : ''}] dan [harga tinggi${isBooking ? '/malam' : ''}]. Kira-kira yang mana lebih sesuai? 💰` };

  // Q8 — Tanggal masuk/check-in/target beli (MANDATORY — wording per 24 kombinasi)
  if (!state.moveInDate) {
    // Rule 25/35 klarifikasi: customer menjawab "bulan berjalan" atau "segera"
    if (state.moveInDateAsk === 'current_month')
      return { q: 'Q8', hint: 'Customer menyebut bulan berjalan tanpa tanggal. Tanyakan tanggal pastinya (harus ≥ tanggal hari ini). Jika customer belum tahu/tidak bisa memutuskan → tulis "Waiting the update" sebagai nilai tanggal di summary. 📅' };
    if (state.moveInDateAsk === 'soon')
      return { q: 'Q8', hint: 'Customer bilang "segera". Tanyakan: "Kak, boleh tau kira-kira tanggalnya?" — lalu jika perlu: "Baik, kak. Mohon segera info tanggalnya ya." Jika customer belum tahu/diam → tulis "Waiting the update" di summary. 📅' };
    if (isBooking)
      return { q: 'Q8', hint: 'Rencananya check-in tanggal berapa? 📅' };
    if (!isSewa)
      return { q: 'Q8', hint: 'Ada target kapan proses belinya selesai? 📅 (untuk beli: "target beli" menggantikan "tanggal masuk")' };
    if (isCommercial)
      return { q: 'Q8', hint: 'Kapan rencananya mulai operasional? 📅' };
    return { q: 'Q8', hint: 'Rencananya masuk atau pindah bulan apa? 📅' };
  }

  // Q4 — Penghuni. HANYA relevan untuk hunian yang akan DITINGGALI sendiri.
  //   Skip bila: tipe komersial, booking hotel/kondotel (Q14 tipe kamar),
  //   ATAU use-case non-hunian (ibadah / kantor / usaha / investasi-didiamkan).
  //   Kekecualian: investasi yang akan DISEWAKAN (kos/kontrakan) → tanya TARGET
  //   PENYEWA (bukan "tinggal bersama siapa"). Investasi tanpa niat sewa (didiamkan
  //   sbg aset / warung / cafe) → tidak ditanya sama sekali.
  const useNonResidential =
    /^(ibadah|kantor|usaha)/.test(state.useCase || '') ||
    (state.useCase === 'investasi' && !state.rentOutIntent);
  if (!state.household && !isCommercial && !isBooking && !useNonResidential) {
    if (!isSewa && state.useCase === 'investasi' && state.rentOutIntent)
      return { q: 'Q4', hint: 'Untuk investasi sewa: target penyewanya nanti siapa — karyawan, mahasiswa, keluarga, atau expat? Biar saya carikan tipe yang paling laku 🛏️' };
    // Liburan/dinas sementara → bukan penghuni tetap; tanya KAPASITAS (jumlah tamu
    // yang menginap) supaya bisa pilih villa/unit dgn jumlah kamar yang pas.
    if (/^liburan/.test(state.useCase || ''))
      return { q: 'Q4', hint: 'Nanti akan menginap berapa orang, Kak? Biar saya carikan yang pas jumlah kamarnya 🛏️' };
    if (!isSewa)
      return { q: 'Q4', hint: 'Nanti akan ditempati bersama siapa saja? Biar pas jumlah kamarnya 🛏️' };
    return { q: 'Q4', hint: 'Nanti akan tinggal bersama siapa saja? Biar saya bisa carikan yang pas jumlah kamarnya 🛏️' };
  }

  // Q5 — Red flags
  if (!state.redFlags) {
    if (isCommercial)
      return { q: 'Q5', hint: `Ada syarat yang mutlak diperlukan atau yang tidak boleh ada untuk ${typeLbl === 'office' ? 'kantor' : typeLbl} ini? 🚫` };
    return { q: 'Q5', hint: 'Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua? 🚫' };
  }

  // Q6 — Patokan lokasi (include wisata, kawasan, dan landmark named examples)
  if (!state.anchorPoint) {
    if (isCommercial)
      return { q: 'Q6', hint: `Ada lokasi atau kawasan tertentu yang jadi prioritas? Misalnya dekat kawasan industri, pelabuhan, atau pusat bisnis? 📍` };
    if (state.location && state.location.toLowerCase().includes('surabaya'))
      return { q: 'Q6', hint: 'Ada lokasi atau tempat tertentu yang jadi patokan? Misalnya dekat Grand City, Pakuwon, KBS, wisata mangrove, sekolah anak, atau jalan tertentu? 📍' };
    return { q: 'Q6', hint: 'Ada lokasi atau tempat tertentu yang jadi patokan? Misalnya dekat sekolah anak, mal, wisata, kawasan tertentu, atau jalan tertentu? 📍' };
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

  // Q_KPR — Pembiayaan (MANDATORY untuk SEMUA tipe beli — pengganti durasi sewa)
  if (!isSewa && !state.financing) {
    if (isCommercial || type === 'hotel' || type === 'kondotel')
      return { q: 'Q_KPR', hint: 'Untuk pembiayaan, rencananya cash, KPR komersial, atau kombinasi? 💳' };
    if (type === 'others')
      return { q: 'Q_KPR', hint: 'Cash atau KPR? (Untuk tanah biasanya KPT — Kredit Pemilikan Tanah, syaratnya sedikit berbeda) 💳' };
    return { q: 'Q_KPR', hint: 'Untuk pembiayaan, rencananya cash atau KPR? 💳' };
  }

  // Q_KPR-a — KPR readiness (fires only jika financing = KPR/kombinasi)
  if (!isSewa && /kpr|kombinasi/i.test(state.financing || '') && !state.kprDetails)
    return { q: 'Q_KPR-a', hint: 'Sudah ada bank yang dituju, atau perlu saya bantu rekomendasikan? Dan DP-nya kira-kira berapa persen yang disiapkan? 🏦' };

  // Q_COND — Kondisi properti (beli residensial: rumah/apartemen/mansion)
  if (!isSewa && ['house', 'apartment', 'mansion'].includes(type) && !state.propertyCondition)
    return { q: 'Q_COND', hint: 'Lebih prefer yang *baru/ready*, *second* kondisi baik, atau *inden* tidak masalah? 🏗️' };

  // Q11 — Furnishing
  // Sewa: skip commercial, booking, villa, mansion (villa/mansion sewa selalu furnished).
  // Beli: rumah/apartemen/mansion juga ditanya furnishing (per spec 24 flow).
  const askFurnSewa = isSewa && !isCommercial && !isBooking && type !== 'villa' && type !== 'mansion';
  const askFurnBeli = !isSewa && ['house', 'apartment', 'mansion'].includes(type);
  if ((askFurnSewa || askFurnBeli) && !state.furnishing)
    return { q: 'Q11', hint: 'Untuk furnitur, lebih prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan* saja? 🛋️' };

  // Q12 — Apartemen spesifik
  if (isApt && !state.apartmentPref)
    return { q: 'Q12', hint: 'Ada preferensi tower atau lantai tertentu? Misalnya hadap timur, lantai rendah/tengah/tinggi? 🏢' };

  // Q14 — Type-specific slots: 24 kombinasi (12 tipe × sewa/beli).
  // AI checks from conversation history whether these were already answered.
  if (isBooking) {
    const hasDuration = !!state.leaseDuration;
    const hasCheckIn  = !!state.moveInDate && state.moveInDate !== 'Waiting the update';
    const autoCheckout = (hasDuration && hasCheckIn)
      ? `⚠️ Check-in (${state.moveInDate}) dan durasi (${state.leaseDuration}) sudah diketahui → HITUNG check-out otomatis (check-in + durasi), JANGAN tanya check-out lagi. `
      : '';
    const subItems = [];
    if (!hasDuration || !hasCheckIn) subItems.push('(a) check-out/berapa malam?');
    subItems.push('(b) tipe kamar? Standard/Deluxe/Suite/Family?');
    subItems.push('(c) breakfast included?');
    return { q: 'Q14', hint: `${autoCheckout}Lanjutkan Q14 ${type === 'hotel' ? 'hotel' : 'kondotel'} booking: ${subItems.join(' ')} — CEK history dulu sebelum tanya yang sudah dijawab.` };
  }
  if (type === 'hotel' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 hotel akuisisi: (a) hotel operasional atau bangunan/lahan untuk dikembangkan? (b) minimal berapa kamar? (c) kelola sendiri / management contract / franchise? (d) target bintang? — CEK history dulu.' };
  }
  if (type === 'villa' && isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 villa sewa: (a) per malam/minggu/bulan? (b) perlu private pool? (c) tanggal check-in? — CEK history dulu.' };
  }
  if (type === 'villa' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 villa beli: (a) wajib private pool? (b) status kepemilikan freehold (SHM) atau leasehold? (c) jika investasi: target yield/tamu? — CEK history dulu.' };
  }
  if (type === 'boarding_house' && isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 kos sewa: (a) putra/putri/campur? (b) kamar mandi dalam/luar? (c) include makan? (d) bayar bulanan/semester/tahunan? — CEK history dulu.' };
  }
  if (type === 'boarding_house' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 kos investasi: (a) kos operasional atau lahan bangun baru? (b) minimal berapa kamar? (c) target putra/putri/campur? (d) pengelola sekarang dilanjutkan atau kelola sendiri? — CEK history dulu.' };
  }
  if (type === 'shophouse' && isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 ruko sewa: (a) untuk usaha apa? (b) berapa lantai? (c) lebar muka (frontage) minimum? (d) posisi hook? (e) parkir pelanggan? — CEK history dulu.' };
  }
  if (type === 'shophouse' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 ruko beli: (a) usaha sendiri atau investasi disewakan? (b) berapa lantai + hook? (c) jika investasi: prefer ruko kosong atau sudah ada tenant berjalan? — CEK history dulu.' };
  }
  if (type === 'store' && isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 toko sewa: (a) jualan apa? (b) di dalam mal / standalone / trade center? (c) luas? (d) info deposit mal 3-6 bulan sewa! (e) ground floor atau upper? — CEK history dulu.' };
  }
  if (type === 'store' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 toko beli: (a) usaha sendiri atau investasi? (b) mal prime (stabil) atau trade center (yield 8-12%)? (c) luas? (d) prefer unit kosong atau sudah ada penyewa berjalan? — CEK history dulu.' };
  }
  if (type === 'office' && isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 kantor sewa: (a) tim berapa orang? (infer luas 5-7 m²/orang) (b) Grade A/B/C? (c) fit-out atau shell & core? (d) klarifikasi budget all-in service charge! (e) parkir & kebutuhan IT? — CEK history dulu.' };
  }
  if (type === 'office' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 kantor beli: (a) dipakai perusahaan sendiri atau investasi disewakan? (b) tim berapa orang? (c) Grade gedung? (d) fit-out atau shell? (e) cek SHMSRS/strata title + service charge! — CEK history dulu.' };
  }
  if (type === 'warehouse' && isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 gudang sewa: (a) untuk produksi/distribusi/penyimpanan? (b) luas m²? (c) tinggi plafon? (d) loading dock? (e) daya listrik KVA? (f) perlu ruang kantor di dalam? — CEK history dulu.' };
  }
  if (type === 'warehouse' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 gudang beli: (a) operasional sendiri atau investasi? Dan untuk produksi/distribusi/penyimpanan? (b) luas? (c) plafon + dock + KVA? (d) WAJIB tawarkan pengecekan legalitas zona industri/pergudangan sebelum deal! — CEK history dulu.' };
  }
  if (isLuxury && isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 mansion sewa: (a) wajib private pool/smart home? (b) komposisi termasuk staf (ART/sopir) → kamar staf? (c) kapasitas garasi? (d) sebutkan akses off-market listing! — CEK history dulu.' };
  }
  if (isLuxury && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 mansion beli: (a) fasilitas wajib (pool, garasi, garden)? (b) multi-generasi? → perlu lift internal / kamar utama lantai dasar? (c) kamar staf? (d) sebutkan akses off-market listing! — CEK history dulu.' };
  }
  if (type === 'kondotel' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 kondotel investasi: (a) investasi murni atau kadang dipakai sendiri? (b) target ROI per tahun? (WAJIB — filter utama) (c) tipe unit studio/1KT? (d) preferensi operator hotel? (e) status SHMSRS? — CEK history dulu.' };
  }
  if (type === 'others' && isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 properti lainnya sewa: (a) tujuan penggunaan? (parkir/pertanian/event/glamping/dll) (b) luas lahan? (c) infrastruktur (PLN/PDAM/pagar/akses)? (d) kejelasan izin peruntukan? — CEK history dulu.' };
  }
  if (type === 'others' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 properti lainnya beli: (a) tujuan (bangun sendiri/investasi/usaha)? (b) jika relevan: sudah operasional atau lahan? (c) luas? (d) matang siap bangun atau mentah? (e) WAJIB tawarkan pengecekan sertifikat (SHM) + zonasi sebelum deal! — CEK history dulu.' };
  }
  if (type === 'apartment' && !isSewa) {
    return { q: 'Q14', hint: 'Lanjutkan Q14 apartemen beli: (a) primary dari developer atau secondary? (b) status SHMSRS? (c) jika investasi: furnished lebih cepat laku disewakan — sarankan! — CEK history dulu.' };
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
    '║  ⏭️  = SUDAH DITANYAKAN → SKIP, JANGAN ULANGI           ║',
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
    row('Area/District    [Q2c]', state.district),
    // Q2b: ✅ = customer answered; ⏭️ = AI asked but customer redirected (skip, don't repeat); ❓ = not asked yet.
    state.searchHistory
      ? `✅ Riwayat pencarian [Q2b]: ${state.searchHistory}`
      : state.aiAskedQ2b
        ? `⏭️ Riwayat pencarian [Q2b]: Sudah ditanyakan — customer tidak menjawab langsung. ⛔ JANGAN tanya ulang. Lanjut ke Q berikutnya.`
        : `❓ Riwayat pencarian [Q2b]: BELUM DITANYAKAN`,
    row('Budget            [Q3]', state.budget),
    row('Penghuni          [Q4]', state.household
      || (/^(ibadah|kantor|usaha)/.test(state.useCase || '') ? `N/A — ${state.useCase} (jangan tanya penghuni)`
        : (state.useCase === 'investasi' && !state.rentOutIntent) ? 'N/A — investasi/didiamkan (jangan tanya penghuni)'
        : null)),
    row('Red flags         [Q5]', state.redFlags),
    row('Patokan lokasi    [Q6]', state.anchorPoint),
    row('Area alternatif   [Q7]', state.alternativeAreas),
    row('Tanggal masuk  ⚠️WAJIB [Q8]', state.moveInDate),
    row('Keputusan         [Q9]', state.decisionMaker),
    row('Durasi sewa      [Q10]', state.leaseDuration),
    row('Furnitur         [Q11]', state.furnishing),
    row('Fasilitas (opsional)   ', Array.isArray(state.facilities) && state.facilities.length ? state.facilities.join(', ') : null),
    row('Apt preference   [Q12]', state.apartmentPref),
  );

  // BELI-only rows — hanya ditampilkan untuk transaksi beli (bagian 24 kombinasi)
  const isSale = (state.transactionType || '').toLowerCase().includes('sale')
    || (state.transactionType || '').toLowerCase().includes('beli');
  if (isSale) {
    lines.push(
      row('Pembiayaan ⚠️WAJIB [Q_KPR]', state.financing),
      row('Detail KPR    [Q_KPR-a]', /kpr|kombinasi/i.test(state.financing || '') ? state.kprDetails : 'N/A (cash)'),
      row('Kondisi        [Q_COND]', state.propertyCondition),
      row('Use-case (huni/invest) ', state.useCase),
    );
  }

  // Q8 perlu klarifikasi (rule 25 "bulan berjalan" / rule 35 "segera")
  if (!state.moveInDate && state.moveInDateAsk) {
    lines.push('');
    lines.push(state.moveInDateAsk === 'current_month'
      ? '⚠️  Q8 KLARIFIKASI: customer menyebut BULAN BERJALAN tanpa tanggal — tanyakan tanggal pastinya (≥ hari ini). Jika customer tidak tahu → nilai Q8 di summary = "Waiting the update".'
      : '⚠️  Q8 KLARIFIKASI: customer bilang "SEGERA" — tanyakan: "Kak, boleh tau kira-kira tanggalnya?" Jika customer tidak tahu/diam → nilai Q8 di summary = "Waiting the update".');
  }

  lines.push(
    '',
    '→ Tanyakan HANYA field ❓ di atas, mulai dari nomor Q terkecil.',
    '→ SATU pertanyaan per pesan. Jangan gabungkan dua pertanyaan.',
    '→ Q3 Budget: JANGAN tanya langsung — gunakan 2 harga kontras sebagai pilihan.',
    state.budget
      ? '→ ✅ Q3 Budget SUDAH DIJAWAB — ⛔ DILARANG KERAS tanya anchor harga lagi. Lanjut ke Q berikutnya.'
      : '→ Q3 Budget belum dijawab — tanyakan via 2 harga kontras (JANGAN tanya langsung).',
    '→ Q8 Tanggal masuk WAJIB dijawab sebelum summary ditampilkan.',
    '→ ⛔ Field ❓ di atas berarti BELUM dijawab di sesi ini — ABAIKAN nilai dari history lama.',
    '→ ⛔ JANGAN tampilkan summary sampai Q3 (Budget) DAN Q8 (Tanggal) keduanya ✅ di atas.',
    '→ ⏭️  berarti SUDAH DITANYAKAN tapi customer redirect/tidak jawab langsung — SKIP saja, lanjut ke Q berikutnya.',
  );

  // Inline hard-blocks for fields most commonly hallucinated
  const missingMandatory = [];
  if (!state.budget)           missingMandatory.push('Q3 Budget');
  if (!state.moveInDate)       missingMandatory.push('Q8 Tanggal masuk');
  if (isSale && !state.financing) missingMandatory.push('Q_KPR Pembiayaan (WAJIB untuk beli)');
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

function buildWhatsappReplyPrompt(session, history, userMessage, propertyContext = '', provider = 'shared', extraContext = {}) {
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

**✅ Jawaban Q3 yang VALID — semua ini dianggap sudah menjawab Q3:**
- Pilih dari anchor: "yang murah aja", "yang 1-3 juta", "sesuai yang pertama", "yang lebih rendah"
- Budget absolut: "badget 2-3.4 juta/minggu", "5 jt per malam", "sekitar 10 juta", "harga 2-3jt"
- Affordability words: "terjangkau", "murah", "affordable", "ekonomis"
- Setiap jawaban yang mengandung angka + satuan mata uang (juta, ribu, jt, rb) → Q3 SELESAI.

**⚠️ CRITICAL — Jika QUALIFICATION STATE menunjukkan ✅ Budget [Q3]:**
- Q3 sudah SELESAI. JANGAN tanyakan anchor harga lagi.
- Jika customer menyatakan budget di pesan PERTAMA ("badget 2-3.4 juta/minggu"), Q3 sudah PRE-ANSWERED.
- Perbedaan periode (customer bilang /minggu, harga catalog /malam) BUKAN alasan tanya ulang — konversi mental.
- Lanjut langsung ke Q berikutnya (❓ dengan nomor Q terkecil sesuai ⚡ PERTANYAAN BERIKUTNYA).

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

### 24 KOMBINASI RESPONSE (12 tipe properti × sewa/beli)

Setiap kombinasi tipe properti + tipe transaksi punya alur berbeda. Ikuti directive ⚡ PERTANYAAN BERIKUTNYA — pertanyaannya sudah disesuaikan per kombinasi. Pembeda utama SEWA vs BELI:

| Aspek | SEWA | BELI |
|---|---|---|
| Pengganti durasi | Q10 durasi sewa + payment terms (≥1 thn) | Q_KPR pembiayaan cash/KPR (MANDATORY) + Q_KPR-a bank/DP jika KPR |
| Pertanyaan waktu (Q8) | Tanggal masuk / check-in / mulai operasional | Target kapan proses beli selesai |
| Kondisi | Furnishing saja | Baru/ready, second, atau inden (Q_COND) + furnishing |
| Q4 jika investasi | — | Target penyewa/tenant menggantikan komposisi penghuni |
| Fokus red flags | Kenyamanan & kecocokan | Legalitas, sertifikat, struktur, zonasi |
| Khusus investasi | — | Target market, ROI (kondotel WAJIB), tenant status (ruko/toko) |

Slot khusus per tipe (Q14) — sesuai directive: hotel booking (check-in/out, malam, tipe kamar, breakfast) vs hotel beli (operasional/lahan, jumlah kamar, management contract, bintang); kos sewa (putra/putri/campur, KM dalam/luar, makan) vs kos beli (operasional, jumlah kamar, pengelola); ruko/toko (jenis usaha DI AWAL, frontage, hook / tenant status untuk beli); kantor (headcount → luas 5-7 m²/orang, grade, fit-out, service charge all-in); gudang (tujuan DI AWAL, m², plafon, dock, KVA / zonasi untuk beli); mansion (kamar staf, off-market); kondotel beli (ROI WAJIB, operator, SHMSRS); others (tujuan DI AWAL, luas, izin/zonasi).

### ATURAN INTERPRETASI TANGGAL (Q8) — WAJIB DIIKUTI

Tanggal hari ini (server): **${(() => { const n = new Date(); const M = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']; return `${n.getDate()} ${M[n.getMonth()]} ${n.getFullYear()}`; })()}**. Server sudah menormalkan jawaban tanggal customer ke format "DD Bulan YYYY" di QUALIFICATION STATE — gunakan nilai itu apa adanya. Aturan yang dipakai (contoh dengan hari ini = 12 Juni 2026):
1. Relatif: "besok"→13 Juni 2026; "lusa"→14 Juni 2026; "minggu depan"→+7 hari; "bulan depan"→12 Juli 2026; "tahun depan"→+1 tahun; "hari ini/sekarang"→12 Juni 2026.
2. Tanggal tanpa tahun ("19 Agustus", "Aug 2", "Maret, 12"): jika sudah lewat tahun ini → tahun depan ("12 Mei"→12 Mei 2027); jika belum → tahun ini.
3. Tahun 2 digit = 20XX ("11 September 26" → 11 September 2026).
4. Format numerik: "13/06/2026"→13 Juni (DD/MM); angka pertama >12 → DD/MM; angka kedua >12 → MM/DD ("06/15/2026"→15 Juni 2026); dua-duanya ≤12 → default DD/MM Indonesia ("01/05/2027"→01 Mei 2027).
5. "2026 Agustus" → 01 Agustus 2026 (tanggal 1).
6. Nama bulan saja: bulan setelah bulan berjalan → tanggal 1 tahun ini ("Juli"→01 Juli 2026); bulan yang sudah lewat → tanggal 1 tahun depan ("Mei"→01 Mei 2027, "Jan"→01 Januari 2027).
7. ⚠️ Bulan BERJALAN tanpa tanggal ("Juni" saat ini Juni): WAJIB tanya tanggal pastinya dulu (harus ≥ hari ini) SEBELUM summary. Jika customer tidak tahu/tidak bisa memutuskan/diam → tulis nilai Q8 di summary: "Waiting the update".
8. ⚠️ "Segera": WAJIB tanya dulu — "Kak, boleh tau kira-kira tanggalnya?" / "Baik, kak. Mohon segera info tanggalnya ya." SEBELUM summary. Jika customer tidak tahu/diam → nilai Q8 di summary: "Waiting the update".

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

✓ Masuk: *[nilai dari Q8 — HANYA jika ✅; bisa juga "Waiting the update"]*

✓ Pembiayaan: *[nilai dari Q_KPR — HANYA untuk transaksi BELI dan jika ✅; sertakan bank/DP dari Q_KPR-a jika ada]*

✓ Kondisi: *[nilai dari Q_COND (baru/second/inden) — HANYA untuk BELI residensial dan jika ✅]*

✓ Keputusan bersama: *[nilai dari Q9 — HANYA jika ✅]*

✓ Furnitur: *[nilai dari Q11 — HANYA jika ✅]*

✓ Fasilitas: *[nilai dari baris "Fasilitas" di QUALIFICATION STATE — HANYA jika ✅; gabung dengan koma, mis. "Kids zone, Gym"]*

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
- **⛔ DILARANG KERAS: Jangan tampilkan summary jika Q8 (Tanggal masuk) masih ❓.** Tanyakan Q8 dulu. Pengecualian: jika customer sudah ditanya tanggal tapi belum tahu/tidak bisa memutuskan → Q8 = "Waiting the update" dan summary boleh tampil.
- **⛔ DILARANG KERAS (BELI): Jangan tampilkan summary jika transaksi = beli dan Q_KPR (Pembiayaan) masih ❓.** Tanyakan cash/KPR dulu.
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
${extraContext.facilityContext || ''}
${extraContext.cityContext || ''}
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
   — Khusus Q2b (Riwayat pencarian): Jawaban seperti "Belum pernah.", "belum pernah cek", "belum lihat", "sudah lihat 3" adalah jawaban Q2b yang VALID → AKUI singkat ("Oke, belum ada referensi sebelumnya 👌") → lanjut ke Q3 (Budget). JANGAN tanya Q2b lagi.
   — Jika QUALIFICATION STATE menampilkan ⏭️ untuk Q2b → customer sudah pernah menjawab tapi tidak cocok pattern — TETAP skip Q2b, lanjut ke Q berikutnya.
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
  findNextQuestion,
};

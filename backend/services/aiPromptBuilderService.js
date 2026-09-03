const { loadProjectSkillPrompt } = require('./skillPromptService');
const { detectBudget, detectFacilities, stripCommercialUsePhrases, stripNearPhrases, stripAmbiguousRumah, stripInvestmentIntentPhrases, stripMovingFromPhrases, detectUseCase, isNonResidentialUse, detectLocation, isKnownLocationName, detectCanonicalType, detectCanonicalTransaction } = require('./propertyRecommendationService');
const { parseCustomerDate, isDontKnowDateAnswer, WAITING_THE_UPDATE } = require('../utils/customerDateParser');
const { expandAbbreviations }                 = require('../utils/lazyChatNormalizer');
const { expandStandardFacilities }            = require('../utils/standardFacilities');
const { detectCustomerFrustration } = require('../utils/propertyKeywordFilter');
const { customerAsksPropertyData,
        buildAnswerFirstDirective,
        customerNeedsDirectAnswer,
        buildViewingRequestDirective } = require('../utils/customerQuestionGuard');
const { getCityLandmarks }                    = require('../utils/locationLandmarks');
// ⛔ Teks banner ganti-kota/transaksi/tipe TIDAK boleh ditulis ulang di file ini.
// Satu tabel spec dipakai bersama ekstraktor filter — lihat utils/contextSwitchPolicy.js.
const { buildSwitchBanners }                  = require('../utils/contextSwitchPolicy');

/* ─── Qualification State Extractor ────────────────────────────────────────── */
/* Scans full conversation history to build a per-question answered/unanswered  */
/* state. This is injected into the AI prompt so the AI NEVER re-asks a         */
/* question that already has a green checkmark.                                  */

const QS_CUST_ROLES = new Set(['user', 'customer']);
const QS_AI_ROLES   = new Set(['assistant', 'ai', 'bot']);

/**
 * Sufiks periode untuk budget: 'week' + 2 → "/2 minggu", 'year' → "/tahun".
 *
 * ⚠️ M169 — SATU salinan, dipakai kedua jalur (Phase 1 dan Q3a). Sebelumnya
 * blok terner yang sama persis ditulis DUA KALI di berkas ini; menambahkan
 * pengali periode di satu tempat saja akan membuat keduanya diam-diam berbeda
 * pendapat soal budget yang sama — kelas bug M27/M77 yang sudah berulang di
 * proyek ini.
 *
 * `count` > 1 dicetak apa adanya ("/2 minggu"): customer yang menyebut anggaran
 * DUA MINGGU tidak boleh muncul di brief agent sebagai anggaran SATU minggu —
 * itu melipatgandakan budget yang dibaca agent (transkrip "kerja dinas").
 */
function budgetPeriodSuffix(period, count = 1) {
  const WORD = { year: 'tahun', month: 'bulan', night: 'malam', week: 'minggu' };
  const word = WORD[period];
  if (!word) return '';
  const n = Number(count) > 1 ? `${Number(count)} ` : '';
  return `/${n}${word}`;
}

/**
 * Ringkas jawaban Q12 (tower/lantai/orientasi) jadi label pendek untuk summary.
 *
 * "Antara lantai 12-18 aja, Kak"  → "Lantai 12-18"
 * "lantai 8"                       → "Lantai 8"
 * "tower B, hadap timur"           → "Tower B · Hadap timur"
 * "lantai tinggi"                  → "Lantai tinggi"
 *
 * @param {string} raw jawaban mentah customer
 * @returns {string} label ringkas, atau '' bila tak ada info yang bisa diringkas
 */
function _normalizeAptPref(raw = '') {
  const s = String(raw || '').toLowerCase();
  if (!s.trim()) return '';
  const parts = [];

  const tower = s.match(/tower\s*([a-z0-9]{1,3})\b/i);
  if (tower) parts.push(`Tower ${tower[1].toUpperCase()}`);

  const range = s.match(/lantai\s*(?:antara\s*)?(\d{1,3})\s*(?:-|–|s\/d|sampai|sd|hingga|ke)\s*(\d{1,3})/i);
  const single = s.match(/lantai\s*(?:ke[-\s]?)?(\d{1,3})\b/i);
  const qual = s.match(/lantai\s*(tinggi|rendah|tengah|atas|bawah|dasar)/i);
  if (range)       parts.push(`Lantai ${range[1]}-${range[2]}`);
  else if (single) parts.push(`Lantai ${single[1]}`);
  else if (qual)   parts.push(`Lantai ${qual[1]}`);

  const facing = s.match(/hadap\s*(timur|barat|utara|selatan|tenggara|barat\s*daya|timur\s*laut|barat\s*laut)/i);
  if (facing) parts.push(`Hadap ${facing[1]}`);

  return parts.join(' · ');
}

/**
 * Q3 ANCHOR ACCEPTANCE — customer menyetujui / menolak harga yang DITAWARKAN AI.
 *
 * Q3 tidak pernah ditanya langsung ("budget berapa?"); AI menawarkan dua harga
 * kontras sebagai pemancing: *"Di Surabaya ada apartment kisaran Rp 2.200.000
 * dan Rp 3.100.000/bulan. Kira-kira yang mana lebih sesuai?"*
 *
 * Customer boleh merespons dengan tiga cara — dan dulu HANYA satu yang dikenali:
 *   (a) menyebut angka sendiri        → sudah ditangani `detectBudget()`
 *   (b) MENERIMA tawaran itu           → "sesuai", "sudah sesuai", "iya", "ok"
 *   (c) MENOLAK karena kemahalan       → "kemahalan", "terlalu mahal"
 * (b) dan (c) mengembalikan null, sehingga Q3 tetap ❓ dan AI mengulang
 * pertanyaan harga yang SAMA tanpa henti — persis yang terjadi di produksi
 * 3 Agu 2026 (customer menjawab "Sesuai, Kak" lalu "Sudah sesuai, Kak", dan
 * pertanyaan itu tetap diulang tiga kali).
 *
 * @param {string} aiText   pesan AI sebelumnya (pertanyaan anchor harga)
 * @param {string} custText jawaban customer
 * @returns {string|null} nilai budget siap-pakai, atau null bila bukan respons anchor
 */
function detectBudgetAnchorResponse(aiText = '', custText = '') {
  const ai = String(aiText || '');
  const cust = String(custText || '').trim();
  if (!ai || !cust) return null;

  // Apakah pesan AI memang pertanyaan ANCHOR harga? Butuh nominal Rp DAN
  // ajakan memilih — supaya kalimat harga biasa (mis. baris katalog) tidak ikut.
  const amounts = [...ai.matchAll(/rp\s*([\d][\d.,]*)/gi)]
    .map(m => Number(String(m[1]).replace(/[.,]/g, '')))
    .filter(n => Number.isFinite(n) && n >= 100000);
  const asksToChoose = /(mana\s+(?:yang\s+)?lebih|kira-kira|lebih\s+(?:sesuai|cocok)|yang\s+mana|sesuai\?|cocok\?)/i.test(ai);
  if (amounts.length < 1 || !asksToChoose) return null;

  const lower = cust.toLowerCase();

  const fmt = (n) => `Rp ${n.toLocaleString('id-ID')}`;
  const lo = Math.min(...amounts);
  const hi = Math.max(...amounts);
  // Satuan periode ikut dari pertanyaan AI ("/bulan", "/malam", …).
  const per = (ai.match(/\/\s*(bulan|malam|minggu|hari|tahun)/i) || [])[1];
  const suffix = per ? `/${per.toLowerCase()}` : '';
  const range = (lo === hi ? fmt(lo) : `${fmt(lo)} - ${fmt(hi)}`) + suffix;

  // (d) Memilih anchor yang LEBIH TINGGI dengan menyebut namanya langsung
  // ("yang mahal aja, yang penting bagus", "yang eksklusif", "yang atas").
  // Dicek SEBELUM cabang (c) di bawah: "yang mahal" adalah PILIHAN sadar
  // (mau yang mahal), beda dari bare "mahal"/"kemahalan" yang berarti
  // KOMPLAIN (terlalu mahal, mau yang lebih murah) — kedua makna memuat kata
  // "mahal" yang sama, jadi urutan pengecekan menentukan siapa menang.
  if (/\b(yang\s+mahal|yang\s+eksklusif|eksklusif\s+aja|yang\s+(?:lebih\s+)?(?:tinggi|atas)|premium)\b/i.test(lower) && cust.length <= 60) {
    return fmt(hi) + suffix;
  }

  // (c) Memilih/menolak ke arah anchor yang LEBIH RENDAH — baik dengan
  // menyebut namanya langsung ("yang terjangkau aja", "yang murah") maupun
  // dengan komplain kemahalan ("kemahalan", "terlalu mahal"). Bug nyata
  // (5 Agu 2026): dulu cabang ini mengembalikan STRING 'terjangkau' TANPA
  // angka sama sekali — padahal AI baru saja menyebut nominal PERSIS di
  // pertanyaannya (`amounts`). Sekarang pakai angka ANCHOR RENDAH yang
  // benar-benar ditawarkan, bukan kategori kosong.
  if (/\b(kemahalan|terlalu\s+mahal|mahal\s+(?:banget|sekali|amat)?|kurang\s+cocok|belum\s+sesuai|tidak\s+sesuai|gak\s+sesuai|nggak\s+sesuai|di\s*bawah\s*itu|lebih\s+murah|yang\s+murah|terjangkau|yang\s+terjangkau)\b/i.test(lower) && cust.length <= 60) {
    return fmt(lo) + suffix;
  }

  // (b) Menerima tawaran APA ADANYA (tanpa memilih salah satu secara eksplisit)
  //     → pakai rentang PENUH yang ditawarkan sebagai budget. Harus jawaban
  //     PENDEK & afirmatif; kalimat panjang bisa memuat info lain yang lebih
  //     tepat ditangani detectBudget().
  const isAffirmative = /^(?:ya|iya|iyaa|yaa|ok|oke|okay|sip|siap|boleh|cocok|setuju|deal|sesuai|betul|benar|bener)\b/i.test(lower)
    || /\b(?:sudah|udah|uda)\s+(?:sesuai|cocok|pas|oke|ok)\b/i.test(lower)
    || /\b(?:sesuai|cocok|pas)\s*(?:kak|ya|aja|saja|banget)?\s*[.!]?$/i.test(lower);
  if (!isAffirmative || cust.length > 40) return null;

  return range;
}

/**
 * Direktif terakhir — diletakkan di BARIS PALING BAWAH prompt.
 *
 * WHY (diukur 3 Agu 2026): prompt WhatsApp untuk satu pesan = ±53.000 token,
 * sedangkan QUALIFICATION STATE (kebenaran otoritatif) hanya ±450 token dan
 * berada di posisi 8% dari awal — disusul ±49.000 token prosa instruksi.
 * Rasio sinyal:derau 1:109. Ini kondisi klasik "lost in the middle": model
 * memperhatikan AWAL dan AKHIR prompt jauh lebih kuat daripada tengahnya,
 * sehingga gpt-4o-mini kehilangan jejak state dan berperilaku seolah sesi
 * kosong — menanyakan ulang Q1 ("mau sewa atau beli?") padahal Q1 sudah ✅,
 * bahkan menolak "Saya sewa apartemen" sebagai non-properti.
 *
 * Blok ini MENGULANG hanya inti yang tidak boleh hilang (field ✅ + satu
 * pertanyaan berikutnya) di posisi perhatian tertinggi. Sengaja SANGAT ringkas
 * (±150 token) — menambah panjang justru memperburuk masalah yang sama.
 *
 * @param {object} state hasil extractQualificationState()
 * @param {object} [identity] identitas & mode yang SUDAH di-resolve server-side:
 *        { agentName, appName, catalogMode:'ON'|'OFF', hasCatalog:boolean }.
 *        Opsional demi kompatibilitas pemanggil lama.
 * @returns {string} blok direktif, atau '' bila state tidak tersedia
 */
function buildFinalDirective(state, identity = {}) {
  if (!state) return '';

  const answered = [];
  const push = (label, val) => { if (val) answered.push(`${label}=${val}`); };
  push('Q1 transaksi', state.transactionType);
  push('Tipe',         state.buildingType);
  push('Q2 kota',      state.city);
  push('Q2c area',     state.district);
  push('Q3 budget',    state.budget);
  push('Q8 tanggal',   state.moveInDate);
  push('Q10 durasi',   state.leaseDuration);
  push('Q11 furnitur', state.furnishing);
  // M127: Q14 kantor (Grade/fit-out) TIDAK PERNAH masuk baris SUDAH DIJAWAB
  // ini — hanya disebut di tengah hint Q14 gabungan (findNextQuestion) dan di
  // baris state block, KEDUANYA di posisi tengah prompt. Transkrip nyata:
  // customer menjawab "Grade C" (bahkan dikonfirmasi AI), lalu MENOLAK
  // menyebutkan lagi ("Terserah"), tapi AI tetap bertanya ulang PERSIS
  // pertanyaan yang sama 7× berturut-turut sampai customer menulis "Stop
  // diulang". state.officeGrade sudah benar tersimpan sepanjang itu (dibukti-
  // kan lewat extractQualificationState di tests/officeGradeContext.test.js)
  // — LLM-nya yang mengabaikan sinyal di tengah prompt. Pola M62 (lost-in-
  // the-middle): field yang sudah dijawab HARUS SATU baris eksplisit di sini
  // (posisi 100%, "menang atas seluruh instruksi di atas"), bukan terkubur di
  // dalam satu string hint gabungan.
  push('Q14 grade',    state.officeGrade);
  push('Q14 fit-out',  state.officeFitOut);

  const nq = findNextQuestion(state, {});

  // ── M142: customer BERTANYA → jawab dulu, tunda pertanyaan berikutnya ─────
  // Baris "TANYAKAN SEKARANG" ada di posisi 100% prompt (M62) dan MENGALAHKAN
  // semua instruksi di atasnya. Transkrip produksi: customer bertanya alamat
  // sebuah listing, dijawab Q2b ("sudah lihat berapa rumah?"); bertanya alamat
  // lagi, dijawab Q3 (budget tier). Data alamatnya SUDAH ada di konteks
  // katalog — yang salah murni direktif yang memaksa bertanya.
  // Selama satu giliran itu, direktif diganti "JAWAB DULU"; pertanyaan
  // berikutnya tetap disebut sebagai LANJUTAN opsional, bukan hilang.
  // M103 — TIGA kelas giliran yang WAJIB dijawab dulu, bukan hanya pertanyaan data:
  //   'data'     → pertanyaan yang jawabannya ada di katalog (M142, sudah ada)
  //   'viewing'  → permintaan/pertanyaan survei ("Apakah blh survei dlu?")
  //   'redirect' → customer menyuruh berhenti ("Stop, Kak. Fokus ke survei dlu")
  // Transkrip 26 Agu 2026: customer meminta survei ENAM KALI, tiap kali dibalas
  // pertanyaan interview yang tidak berhubungan, karena hanya kelas 'data' yang
  // bisa menunda baris "TANYAKAN SEKARANG" di posisi 100%.
  const turnKind = identity.customerMessage
    ? customerNeedsDirectAnswer(identity.customerMessage)
    : null;

  const nextLine = turnKind === 'data'
    ? buildAnswerFirstDirective(identity.customerMessage, nq)
    : (turnKind === 'viewing' || turnKind === 'redirect')
      ? buildViewingRequestDirective(identity.customerMessage, turnKind, nq)
      : (nq
        ? `TANYAKAN SEKARANG → ${nq.q}: ${nq.hint}`
        : 'Semua field wajib sudah ✅ → TAMPILKAN SUMMARY BRIEF sekarang.');

  // ⚠️ Baris penutup ini TIDAK BOLEH menyuruh "ajukan pertanyaan di baris
  // TANYAKAN SEKARANG" ketika baris itu SUDAH DIGANTI oleh direktif
  // jawab-dulu — pada giliran itu tidak ada baris TANYAKAN SEKARANG sama
  // sekali, sehingga instruksinya saling bertentangan DI POSISI 100% prompt
  // (persis kelas masalah yang diperingatkan M62: yang di ujung paling
  // dipatuhi, jadi kontradiksi di sini paling mahal).
  const oneQuestionLine = turnKind
    ? '⛔ Jawab dulu permintaan/pertanyaan customer di atas. JANGAN menambah\n   pertanyaan interview lain di giliran yang sama.'
    : '⛔ Ajukan TEPAT SATU pertanyaan: yang tertulis di baris TANYAKAN SEKARANG.';

  // ── Anti-karangan nama area (M84) ─────────────────────────────────────────
  // Bug produksi 6 Agu 2026: customer hanya menyebut kota Malang; area tidak
  // pernah ditanya. Skill doc Q7 melarang jangkar KOTA dan menampilkan
  // placeholder `Selain area *[Area dari Q2c]*`, jadi LLM mengisi placeholder
  // itu dengan nama yang paling ter-prime di korpus prompt — "Ciputra"
  // (developer SURABAYA, banyak muncul di Real-Estate/*.md). ChatGPT dan
  // DeepSeek menghasilkan karangan yang SAMA, bukti ini priming korpus, bukan
  // kebetulan. Nilai itu lalu tersalin ke summary ("Area: Ciputra masih ok").
  // Satu baris di posisi 100% (M62) jauh lebih patuh daripada aturan di tengah.
  // ── M92 — token spesifik yang TERBUKTI dikarang dari contoh dokumen sendiri ──
  // Bug produksi 18 Agu 2026: customer beli gudang di JAKARTA, tidak pernah
  // menyebut nama area apa pun (district null sepanjang chat, terverifikasi lewat
  // simulasi extractQualificationState). Summary tetap menampilkan
  // "✓ Area: Sidotopo" — kata itu HANYA ada di skill doc sendiri sebagai contoh
  // ilustrasi ("Customer: 'Area Sidotopo' → ✓ Area: Sidotopo"). Larangan generik
  // (paragraf di atas) TERBUKTI tidak cukup kuat melawan token yang sudah
  // ter-prime di prompt yang sama — perlu larangan bernama, pola yang sama
  // dengan kenapa M83/M91 butuh CONTOH KONKRET, bukan aturan abstrak lagi.
  const noAreaLine = state.district ? '' : `
⛔ AREA (Q2c) BELUM DIKETAHUI. DILARANG menulis nama area apa pun di Q7 atau
   baris "Area" summary — termasuk "Sidotopo"/"Ciputra" (contoh dokumen,
   BUKAN customer). Jangkar KOTA saja ("Selain *${state.city || 'kota ini'}*,
   area sekitar masih oke?"). Area yang tidak diketik CUSTOMER = karangan.`;

  // ── Tanda tangan: nama SUDAH di-resolve, jangan tulis placeholder (M85) ───
  const sigLine = (identity.agentName && identity.appName) ? `
✍️ TANDA TANGAN SUMMARY (nilai FINAL, salin apa adanya sebagai teks biasa):
   Salam hangat, / ${identity.agentName} / ${identity.appName}
   ⛔ DILARANG menulis kurung siku, tanda dolar, atau kurung kurawal di tanda
      tangan — "[Nama Agen]" / "\${agentName}" adalah BUG, bukan keluaran sah.` : '';

  // ── Mode katalog per-agent (users.catalog_summary) (M86) ─────────────────
  let catalogLine = '';
  if (identity.catalogMode === 'ON') {
    catalogLine = identity.hasCatalog
      ? `
📦 KATALOG=ON: SETELAH summary, WAJIB lanjut tampilkan rekomendasi properti
   dari "Backend property catalog context". Summary tanpa katalog = tidak lengkap.`
      : `
📦 KATALOG=ON TAPI KATALOG KOSONG: setelah summary, WAJIB minta maaf bahwa saat
   ini belum ada properti yang cocok di katalog dan janjikan kabar begitu ada.
   ⛔ JANGAN mengarang listing untuk menutupi katalog yang kosong.`;
  } else if (identity.catalogMode === 'OFF') {
    catalogLine = `
📦 KATALOG=OFF: tampilkan summary SAJA. ⛔ JANGAN tampilkan listing/katalog apa pun.`;
  }

  return `
═══════════════════════════════════════════════════════════
⚡ DIREKTIF FINAL — INI MENANG ATAS SELURUH INSTRUKSI DI ATAS
═══════════════════════════════════════════════════════════
SUDAH DIJAWAB (⛔ JANGAN tanya ulang, jangan minta konfirmasi):
  ${answered.length ? answered.join(' | ') : '(belum ada)'}

${nextLine}

⛔ Pesan customer terakhir adalah JAWABAN atas pertanyaan kamu — apa pun
   kata-katanya, ia TIDAK PERNAH "non-properti". Jangan pernah membalas
   "Maaf, saya hanya bisa membantu terkait pencarian properti" di tengah alur
   kualifikasi yang sedang berjalan.
⛔ JANGAN mulai "pencarian baru" / tanya "sewa atau beli?" kecuali baris
   SUDAH DIJAWAB di atas benar-benar kosong.
${oneQuestionLine}${noAreaLine}${sigLine}${catalogLine}
═══════════════════════════════════════════════════════════`;
}

/**
 * Blok LIVE LANDMARK untuk prompt LLM (Claude & ChatGPT).
 *
 * WHY: `googlePlacesService.js` sebelumnya HANYA di-require oleh
 * chatbotPrivateController.js — yaitu Private Agent, jalur FALLBACK. Padahal
 * produksi berjalan di jalur LLM (AI_PRIMARY_PROVIDER=chatgpt), sehingga
 * Claude/ChatGPT tidak pernah menerima data landmark live sama sekali dan hanya
 * mengandalkan ingatan training yang punya knowledge cutoff (landmark bisa sudah
 * tutup / ganti nama / baru dibuka). Kelas bug yang sama dengan loop Q7: fitur
 * dibangun di Private Agent, tapi produksi memakai jalur lain.
 *
 * DESIGN — cache-then-async-refresh, TIDAK PERNAH memblokir balasan:
 *   builder prompt ini SINKRON, jadi kita hanya membaca cache (sync) dan
 *   menghangatkan cache secara fire-and-forget untuk giliran BERIKUTNYA. Turn
 *   pertama sebuah kota baru tidak dapat data live — itu disengaja, lebih baik
 *   daripada menahan balasan WhatsApp demi satu panggilan jaringan.
 *
 * Sengaja DIPANGKAS (maks 6 landmark, satu baris): prompt WhatsApp sudah pernah
 * menembus limit TPM 60K milik gpt-4o-mini, jadi setiap blok tambahan harus hemat token.
 *
 * @param {string} city kota/area hasil ekstraksi qualification state
 * @returns {string} blok siap-tempel, atau '' bila tidak ada data live
 */
function buildLiveLandmarkBlock(city) {
  const name = String(city || '').trim();
  if (!name) return '';

  let live = null;
  try {
    const { getCachedCityLandmarks, warmCityLandmarksCache } = require('./googlePlacesService');
    live = getCachedCityLandmarks(name);
    // Fire-and-forget: hangatkan cache untuk giliran berikutnya. JANGAN di-await.
    if (!live) Promise.resolve(warmCityLandmarksCache(name)).catch(() => {});
  } catch { return ''; }

  if (!live || !live.length) return '';

  return `\n📍 LIVE LANDMARK DATA — ${name} (Google Places, terbaru):
${live.slice(0, 6).join(' · ')}
Gunakan daftar ini saat memberi contoh patokan lokasi untuk ${name}. Data ini LEBIH BARU
daripada ingatan training kamu — kalau berbeda, PERCAYA daftar ini.\n`;
}

/**
 * Normalisasi jawaban Q7 (area alternatif).
 *
 * Menolak = SUDAH MENJAWAB. Tapi menyimpan teks mentah ("Tidak ada, Kak")
 * membuat baris summary berbunyi "✓ Area alternatif: Tidak ada, Kak" — janggal
 * dan terbaca seperti data kosong, sehingga LLM tergoda menanyakannya lagi.
 * Ubah penolakan jadi pernyataan niat yang POSITIF ("Fokus di Pakuwon saja")
 * supaya ✅-nya tidak ambigu.
 *
 * @param {string} text  jawaban customer
 * @param {string} loc   area/kota yang sudah dipilih (untuk kalimat fokus)
 * @returns {string} nilai siap-tampil untuk baris Q7
 */
function normalizeAltAreaAnswer(text = '', loc = '') {
  const raw = String(text || '').trim();
  if (!raw) return raw;

  // Penolakan: "tidak ada", "enggak ada", "nggak ada", "gak ada", "no",
  // "tetap di X", "cukup di X", "di X saja/aja", "fokus di X".
  const isRefusal =
    // `gk`/`ngg`/`kgk` ikut disertakan: normalizer sudah memperluasnya di
    // produksi, tapi ekstraktor tidak boleh bergantung pada itu — jawaban
    // "Gk mau" harus terbaca sebagai penolakan apa pun jalannya.
    /^(tidak|tdk|enggak|engga|nggak|ngga|nggk|ngg|gak|gk|ga|kgk|kagak|no|non)\b[\s,.!]*(ada|aja|saja|mau)?\b/i.test(raw)
    // "tetap di X", dan bentuk dengan sisipan: "tetap MAU di X", "tetap INGIN di X".
    || /\b(tetap|cukup|fokus|hanya|cuma)\s+(?:\w+\s+){0,2}(di|pada)\b/i.test(raw)
    || /\bdi\s+.{1,30}\s*(saja|aja)\b/i.test(raw)
    || /\bonly\b|\bjust\b.{0,15}\b(here|there)\b/i.test(raw);

  if (!isRefusal) return raw;   // benar-benar menyebut area lain → simpan apa adanya

  const where = String(loc || '').trim();
  return where ? `Fokus di ${where} saja (tidak ada area alternatif)`
               : 'Tidak ada area alternatif (fokus 1 area)';
}

/**
 * Normalisasi jawaban durasi sewa/booking menjadi "N unit" yang rapi.
 * Menangani:
 *   - angka + unit  : "10 hari", "2 minggu"          → "10 hari", "2 minggu"
 *   - prefix "se-"  : "seminggu", "sebulan", "setahun" → "1 minggu", "1 bulan", "1 tahun"
 *   - angka kata    : "dua minggu", "tiga bulan"       → "2 minggu", "3 bulan"
 * Filler seperti "Saya booking ... aja, Kak" diabaikan; hanya durasi bersih diambil.
 * @returns {string|null} "N unit" atau null bila tidak ada durasi terdeteksi.
 */
const _DUR_UNIT_RE = '(?:hari|malam|minggu|pekan|bulan|tahun|thn|day|days|night|nights|week|weeks|month|months|year|years)';

/**
 * "untuk1 minggu" → "untuk 1 minggu" (M103).
 *
 * Typo tanpa spasi NYATA muncul di transkrip produksi ("Sama booking untuk1
 * minggu saja"). Tanpa dipisah, \b(\d+) tidak pernah cocok karena tidak ada
 * word-boundary antara huruf dan angka — durasinya hilang diam-diam.
 *
 * ⚠️ Regex ditulis sebagai LITERAL, bukan template literal. Di dalam template
 * literal `\d` runtuh jadi `d` dan `\b` jadi karakter backspace, sehingga
 * regex-nya salah TANPA error apa pun — kesalahan yang sudah terjadi sekali
 * saat memperbaiki berkas ini.
 */
function deglueDurationDigits(text = '') {
  return String(text).replace(
    /([a-z])(\d+)(\s*(?:hari|malam|minggu|pekan|bulan|tahun|thn|day|days|night|nights|week|weeks|month|months|year|years)\b)/gi,
    '$1 $2$3',
  );
}

/**
 * Durasi yang DISEBUT SENDIRI customer, tanpa AI menanyakannya (M103).
 *
 * Phase 2 hanya membaca PASANGAN AI→Customer, jadi durasi di pesan PERTAMA
 * (belum ada balasan AI) tidak pernah terbaca. Bug produksi nyata: durasi
 * hilang dari ringkasan DAN AI menanyakannya lagi.
 *
 * ⚠️ Anchor WAJIB ("durasi/selama/untuk/book/menginap"). Tanpa penanda itu
 * "5 hari lagi" (OFFSET tanggal masuk) ikut terbaca sebagai durasi — justru
 * kesalahan yang dicegah M82.
 */
function extractSelfVolunteeredDuration(text = '') {
  const raw = deglueDurationDigits(text);
  if (!raw.trim()) return null;

  const anchored = raw.match(
    /durasi\s*(?:sewa|menginap|booking|nginap|kontrak)?\s*[:-]?\s*(\d+)\s*(hari|malam|minggu|pekan|bulan|tahun|thn|day|days|night|nights|week|weeks|month|months|year|years)\b/i,
  );
  if (anchored) return normalizeDuration(`${anchored[1]} ${anchored[2]}`);

  if (/\b\d+\s*(?:hari|malam|minggu|pekan|bulan|tahun)\s+lagi\b/i.test(raw)) return null;

  const m = raw.match(
    /\b(?:selama|untuk|book(?:ing)?|nginap|menginap|nginep|sewa|stay(?:ing)?|for)\s+(\d+)\s*(hari|malam|minggu|pekan|bulan|tahun|thn|day|days|night|nights|week|weeks|month|months|year|years)\b/i,
  );
  return m ? normalizeDuration(`${m[1]} ${m[2]}`) : null;
}

function normalizeDuration(text = '') {
  const t = String(text || '').toLowerCase();
  const uMap = {
    hari: 'hari', day: 'hari', days: 'hari',
    malam: 'malam', night: 'malam', nights: 'malam',
    minggu: 'minggu', pekan: 'minggu', week: 'minggu', weeks: 'minggu',
    bulan: 'bulan', month: 'bulan', months: 'bulan',
    tahun: 'tahun', thn: 'tahun', year: 'tahun', years: 'tahun',
  };
  const unitRe = 'hari|malam|minggu|pekan|bulan|tahun|thn|day|days|night|nights|week|weeks|month|months|year|years';

  // 1) angka + unit — "2 minggu", "10 hari"
  const numMatch = t.match(new RegExp(`\\b(\\d+)\\s*(${unitRe})\\b`, 'i'));
  if (numMatch) return `${numMatch[1]} ${uMap[numMatch[2].toLowerCase()]}`;

  // 2) prefix "se-" menempel — "seminggu", "sebulan", "setahun", "sehari", "semalam"
  const seMatch = t.match(new RegExp(`\\bse(${unitRe})\\b`, 'i'));
  if (seMatch) return `1 ${uMap[seMatch[1].toLowerCase()]}`;

  // 3) angka kata + unit — "dua minggu", "tiga bulan"
  const WORD_NUM = { se:1, satu:1, dua:2, tiga:3, empat:4, lima:5, enam:6, tujuh:7, delapan:8, sembilan:9, sepuluh:10 };
  const wordMatch = t.match(new RegExp(`\\b(${Object.keys(WORD_NUM).join('|')})\\s+(${unitRe})\\b`, 'i'));
  if (wordMatch) return `${WORD_NUM[wordMatch[1].toLowerCase()]} ${uMap[wordMatch[2].toLowerCase()]}`;

  return null;
}

/**
 * A conditional/hedge message ("kalau gak ada apartemen, villa juga boleh") names
 * a fallback type but does NOT confirm the customer switched to it — the primary
 * search is still the earlier type. Boundary B must not treat the fallback word as
 * a hard type switch (which would wipe budget/facilities before the primary type is
 * even confirmed unavailable). Phase 1's existing fallbackTypes logic captures the
 * hedge word properly; this only suppresses the switch-detection side.
 */
function isConditionalFallbackMessage(text = '') {
  const t = (text || '').toLowerCase();
  const hasCondition = /\b(kalau|jika|kalo|bila|seandainya)\b[\s\S]{0,60}?\b(tidak|gak|ga|ngga|enggak|kagak|ndak)\b[\s\S]{0,10}?\bada\b/.test(t);
  const hasHedgeOffer = /\b(juga|masih)\b[\s\S]{0,25}?\b(boleh|bisa|oke|ok|mau)\b|\b(saja|aja)\b/.test(t);
  return hasCondition && hasHedgeOffer;
}

/**
 * Pesan RALAT/KOREKSI — customer memperbaiki jawaban sebelumnya ("ralat, budget
 * 1-2 miliar aja", "eh salah, viewingnya jam 2 siang", "ganti jadi tanggal 5").
 * Slot yang biasanya first-wins (budget, tanggal masuk, jadwal viewing) BOLEH
 * di-overwrite oleh nilai baru dalam pesan yang match regex ini — nilai baru hanya
 * ditulis bila memang ada (pesan ralat tanpa nilai baru tidak menghapus apa pun).
 */
// M127: "maaf" TELANJANG (bukan cuma "maaf salah") ditambahkan sendiri.
// Transkrip nyata: customer "Saya cari harga 2-3 juta/hari" lalu SATU pesan
// kemudian "Maaf... Saya cari harga 400-800 juta" — apology diikuti angka
// budget BARU yang sama sekali berbeda (dan satuan yang beda pula: /hari vs
// lump-sum) adalah pola ralat yang SANGAT umum di WhatsApp Indonesia, tapi
// tidak match "maaf\s+salah" (harus diikuti kata "salah" persis) maupun kata
// kunci ralat lain manapun → budget lama (".../malam") tetap dipakai,
// mengabaikan koreksi customer sepenuhnya. Aman diperlonggar ke "maaf" saja
// (tanpa "salah") karena SEMUA pemanggil CORRECTION_RE/isCorrectionMsg di
// file ini mensyaratkan pesan JUGA berisi nilai baru yang valid sebelum
// menimpa apa pun (lihat komentar di atas) — "maaf" basa-basi tanpa angka
// baru tidak menghapus apa pun.
const CORRECTION_RE = /\b(ralat|koreksi|revisi|ganti(?:\s+(?:jadi|ke))?|diganti|ubah(?:\s+(?:jadi|ke))?|diubah|rubah|dirubah|salah\s+(?:sebut|tulis|ketik|kirim|info)|maksud\s?(?:ku|saya|nya)|bukan\s+itu|yang\s+benar|yg\s+bener|harusnya|seharusnya|sebenarnya|eh\s+salah|maaf(?:\s+salah)?|batal(?:kan)?\s+yang\s+tadi)\b/i;

/**
 * Penolakan JADWAL SURVEI (Q9b) — menolak survei adalah JAWABAN yang sah,
 * dicatat sebagai "Minta listing", bukan slot kosong yang ditanya ulang.
 *
 * ⚠️ BUG PRODUKSI (12 Agu 2026, chatbot web): pola lama mensyaratkan kata
 * `usah|perlu` SETELAH negasi —
 *   `tidak\s*(usah|perlu)\s*survei`
 * — sehingga "Saya **tdk mau** survei" dan "**Tdk mau** survei" TIDAK cocok:
 * pemakainya memakai "mau" (bukan "usah/perlu") dan singkatan "tdk". Q9b tetap
 * ❓, dan pertanyaan yang SAMA diulang TIGA KALI berturut-turut sampai customer
 * berhenti membalas. Menolak jawaban customer atas pertanyaan sendiri adalah
 * kegagalan yang paling cepat menghabiskan kesabaran.
 *
 * Karena itu negasi dan kata kerja ditangani terpisah & longgar:
 *   negasi   : tidak/tdk/tak/ga/gak/ngga/nggak/enggak/engga/belum/blm/no
 *   penghubung (opsional): usah/perlu/mau/ingin/pengen/berminat/minat/niat
 *   kegiatan : survei/survey/viewing/lihat unit/liat unit/datang/kunjungan
 * Ditambah jalur eksplisit "lihat listing saja"/"katalog saja"/"skip".
 */
const VIEWING_REFUSAL_RE = new RegExp(
  '(' +
    // "tidak/tdk/ga/belum ... (usah|perlu|mau|...) ... survei/viewing/lihat unit"
    '\\b(?:tidak|tdk|tak|ga|gak|ngga|nggak|enggak|engga|belum|blm|no)\\b' +
    '(?:\\s+(?:usah|perlu|mau|ingin|pengen|kepengen|berminat|minat|niat|akan|bisa|sempat))?' +
    '\\s*(?:untuk\\s+)?' +
    '(?:survei|survey|surver|viewing|visit|lihat\\s*unit|liat\\s*unit|datang|kunjungan|ketemu)' +
  '|' +
    // "lihat listing saja" / "kirim listing" / "katalog saja" / "skip"
    '\\b(?:lihat|liat|kirim|minta|mau)?\\s*(?:listing|katalog|catalog)\\b' +
  '|' +
    '\\bskip\\b|\\bnanti\\s*(?:saja|aja|dulu)\\b' +
  ')', 'i'
);

/** True bila pesan adalah ralat/koreksi atas jawaban sebelumnya. */
function isCorrectionMessage(text = '') {
  return CORRECTION_RE.test(String(text || ''));
}

/**
 * Extract individual anchor-landmark tokens from a text: every "dekat/deket/near X"
 * phrase, split into per-landmark tokens (commas / "dan" / "&"), with filler words
 * stripped and city names excluded (a city is the Q2 location, not a Q6 anchor).
 * Newline is deliberately NOT part of the capture class — debounce-joined WhatsApp
 * messages must produce separate matches, not one phrase with an embedded newline.
 */
function extractAnchorTokens(text = '') {
  const tokens = [];
  // Typo-tolerant: "dekay"/"dekt"/"dkt" adalah salah ketik umum "dekat".
  //
  // Capture BERHENTI sebelum kata-kedekatan BERIKUTNYA (tempered pattern
  // `(?!…)`). Tanpa itu, satu match melahap seluruh sisa kalimat termasuk
  // frasa "dekat X" berikutnya, lalu terpotong di tengah kata saat menyentuh
  // batas panjang — bug nyata di produksi:
  //   "dekat Kampung warna Jodipan, dekat cafe, resto dan wisata Kampung warna Jodipan"
  //     → "…, resto dan wisata Kampung w"   ← nama landmark terpenggal
  // Batas dinaikkan 60 → 80 karena nama tempat Indonesia kerap panjang
  // ("Kampung Warna-Warni Jodipan", "Taman Wisata Bukit Mas").
  const NEXT_ANCHOR = '(?!\\b(?:dekat|deket|dekay|dekt|dkt|near)\\b)';
  const ANCHOR_RE = new RegExp(
    `\\b(?:dekat|deket|dekay|dekt|dkt|near)\\s+(?:dengan\\s+)?([a-z](?:${NEXT_ANCHOR}[\\w ,.\\/&-]){2,80})`,
    'gi'
  );
  for (const am of String(text || '').matchAll(ANCHOR_RE)) {
    const after = am[1].trim();
    const cleaned = after.replace(/\s+(ya|dong|kak|aja|saja|nih|lainnya)\b.*$/i, '').trim();
    if (!cleaned || detectLocation(after)) continue;
    for (const token of cleaned.split(/\s*,\s*|\s+dan\s+|\s+&\s+/i)) {
      const t = token.trim();
      if (t && !tokens.some((p) => p.toLowerCase() === t.toLowerCase())) tokens.push(t);
    }
  }
  return tokens;
}

/** Join anchor tokens into ONE clean phrase: "dekat A, B dan C". */
function joinAnchorTokens(parts = []) {
  if (!parts.length) return null;
  return parts.length === 1
    ? `dekat ${parts[0]}`
    : `dekat ${parts.slice(0, -1).join(', ')} dan ${parts[parts.length - 1]}`;
}

/**
 * Extract which Q1–Q12 fields have been answered from conversation history.
 * Runs server-side so the AI gets an authoritative checklist — it does NOT
 * have to guess from raw history text (which fails when history is truncated).
 *
 * @param {Array}  history        - Full conversation history [{role, message}]
 * @param {string} currentMessage - Current customer message
 * @returns {object} Qualification state
 */
/**
 * Bersihkan jawaban Q2c menjadi NAMA AREA saja.
 * "Saya mempertimbangkan area di Sidotopo" → "Sidotopo"
 * "di daerah Pakuwon aja"                  → "Pakuwon"
 * "Rungkut"                                → "Rungkut" (sudah bersih)
 * Bila hasil pemangkasan jadi kosong/aneh, kembalikan teks aslinya (fail-safe:
 * lebih baik menyimpan kalimat penuh daripada menghapus jawaban customer).
 */
/**
 * True bila teks district hasil pembersihan ternyata TIDAK memuat nama area apa
 * pun — isinya hanya nama kota (Q2), kata "kota", atau sisa kata kerja/tipe
 * properti dari kalimat customer.
 *
 * WHY: pertanyaan gabungan "di kota atau area mana?" membuat customer menjawab
 * KOTA lebih dulu ("Saya mau booking hotel di Surabaya"). Tanpa penjaga ini,
 * kalimat itu tersimpan sebagai district ("Booking Hotel Surabaya") dan karena
 * slot district first-wins, nama area sungguhan di pesan berikutnya ("Area
 * Sidotopo") tidak pernah masuk. Akibat nyata di produksi: state block
 * menampilkan `Area/District [Q2c]: booking hotel Surabaya`, LLM membaca itu
 * sebagai data sampah lalu MENANYAKAN LOKASI BERULANG-ULANG, dan area yang
 * customer sebut hilang sama sekali dari summary.
 *
 * @param {string} cleaned hasil _cleanDistrictAnswer()
 * @param {string} city    nilai Q2 yang sudah terdeteksi (boleh kosong)
 * @returns {boolean} true → JANGAN simpan sebagai district
 */
function _isJustTheCity(cleaned = '', city = '') {
  let s = String(cleaned || '').toLowerCase().trim();
  if (!s) return true;

  // Buang nama kota yang terdeteksi + kata "kota" itu sendiri.
  const c = String(city || '').toLowerCase().trim();
  if (c) s = s.split(c).join(' ');
  s = s.replace(/\bkota\b/gi, ' ');

  // Buang kata kerja transaksi & tipe properti — sisa kalimat pembuka customer
  // ("booking hotel", "sewa apartemen") bukan nama area.
  s = s.replace(/\b(sewa|beli|booking|kontrak|ngekos|kos|rental|rent|buy)\b/gi, ' ')
       .replace(/\b(hotel|villa|rumah|apartemen|apartment|ruko|kantor|office|gudang|kondo|kost?an?)\b/gi, ' ')
       .replace(/[^a-z\s]/gi, ' ')
       .replace(/\s{2,}/g, ' ')
       .trim();

  // Tidak ada sisa kata bermakna (≥3 huruf) → bukan district.
  return !s.split(/\s+/).some(w => w.length >= 3);
}

function _cleanDistrictAnswer(raw = '') {
  let s = String(raw || '').trim();
  if (!s) return raw;

  // Buang pembuka kalimat yang tidak membawa informasi lokasi.
  s = s
    .replace(/^(saya|aku|kami)\s+/i, '')
    .replace(/^(sih|ya|yaa|oke|ok|hmm|mmm)\s*,?\s*/i, '')
    .replace(/\b(mempertimbangkan|pertimbangkan|mikirin|memikirkan|pengen|pingin|ingin|mau|cari|carikan|prefer|lebih\s+suka|tertarik|minat)\b\s*/gi, '')
    .replace(/\b(di|daerah|area|kawasan|wilayah|sekitar|sekitaran|bagian|deket|dekat)\b\s*/gi, ' ')
    .replace(/\b(aja|saja|dulu|dong|kak|ya|yaa|sih|nih|deh)\b/gi, ' ')
    .replace(/[.,;!?]+\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Kapitalisasi nama tempat ("sidotopo" → "Sidotopo"); biarkan yang sudah kapital.
  if (s && s === s.toLowerCase()) {
    s = s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }

  // Fail-safe: hasil kosong / terlalu pendek → pakai teks asli.
  return s.length >= 3 ? s : raw;
}

function extractQualificationState(history = [], currentMessage = '') {
  // ⛔ NORMALISASI SINGKATAN WAJIB DI SINI — jangan pindahkan ke pemanggil.
  // whatsappAIService hanya meng-expand PESAN SAAT INI; transkrip yang tersimpan
  // di DB sengaja RAW (autentik untuk takeover agent). Konsekuensinya: giliran
  // berikutnya, jawaban yang tadi tertangkap kembali terbaca sebagai SMS-speak
  // mentah dan TIDAK cocok regex mana pun → slot yang sudah ✅ berubah lagi jadi
  // ❓ → pertanyaan yang sama diulang tanpa henti (M73).
  // Terbukti: "Rencana tahun dpn" → Q8 terisi di giliran N, lalu null di N+1.
  // Karena SETIAP slot diturunkan ulang dari history tiap giliran, satu singkatan
  // saja cukup membuat percakapan tidak pernah sampai summary.
  // Ditaruh di dalam fungsi ini (bukan di builder) supaya jalur LLM DAN Private
  // Agent — dua basis kode terpisah — sama-sama terlindungi (pelajaran M52/M54).
  const _norm = (m) => {
    try { return expandAbbreviations(String(m || '')); }
    catch (_) { return String(m || ''); }   // fail-open: jangan pernah blokir alur
  };
  const normalizedHistory = (history || []).map(item => ({
    ...item,
    message: _norm(item.message),
  }));
  const normalizedCurrent = _norm(currentMessage);

  history        = normalizedHistory;
  currentMessage = normalizedCurrent;

  /* ── Build chronological message array ────────────────────────────────────
   * (history is already oldest-first from DB reverse)
   *
   * ⭐ M166 — JANGAN MENGGANDAKAN PESAN SAAT INI.
   *
   * Ketiga controller WhatsApp (Kirimi/Fonnte/TimelinesAI) MENYIMPAN pesan
   * customer ke `chat_messages` LEBIH DULU, baru memanggil
   * generateWhatsAppAIReply() (kirimiChatController.js: simpan ~697, panggil
   * ~711). Jadi getConversationHistory() SUDAH memulangkan pesan itu — dan
   * baris ini dulu menambahkannya SEKALI LAGI.
   *
   * Akibatnya fatal dan senyap: `lastIdx = ACTIVE_ALL.length - 1` menunjuk ke
   * salinan KEDUA, sedangkan resolver kanonik mencatat flip-nya di salinan
   * PERTAMA. Perbandingan `runTxIdx === lastIdx` karena itu SELALU false,
   * sehingga SELURUH sistem reset mid-flow (M124 / M132 / M154 / M163)
   * TIDAK PERNAH SEKALI PUN menyala untuk customer WhatsApp — hanya jalur web
   * chat (yang tidak menyimpan lebih dulu) yang pernah menjalankannya.
   *
   * Terbukti lewat A/B (29 Agu 2026), transkrip "sewa → beli":
   *   bentuk web      → tx=sale, budget=null,                  txChanged=true
   *   bentuk whatsapp → tx=sale, budget="Rp 30.855.000…/tahun", txChanged=false
   * Itulah asal "budget Rp 36.300.000/tahun" yang menempel pada pencarian
   * BELI di transkrip produksi 29 Agu 2026.
   *
   * Akar masalahnya satu keluarga dengan M162 (TTL sesi tidak pernah menyala):
   * simpan-dulu-baru-baca. Dikompensasi di SATU titik konsumen ini, bukan
   * dengan membalik urutan simpan di tiga controller — urutan itu dipakai juga
   * oleh dedup pesan & penyimpanan audit.
   *
   * Pencocokan memakai teks TERNORMALISASI (sesudah expandAbbreviations) dan
   * hanya menengok entri TERAKHIR: kalau customer memang mengirim teks sama
   * dua kali berturut-turut ("Saya pilih no 2, Kak" 3x di transkrip yang sama),
   * entri terakhir itu tetap pesan yang sedang diproses sekarang, jadi
   * membuang satu salinan tetap benar.
   */
  const _lastHist = (history || [])[(history || []).length - 1];
  const _currentAlreadyInHistory = Boolean(
    _lastHist
    && QS_CUST_ROLES.has(_lastHist.role)
    && String(_lastHist.message || '').trim() === String(currentMessage || '').trim()
    && String(currentMessage || '').trim() !== ''
  );
  const ALL = _currentAlreadyInHistory
    ? [...history]
    : [...(history || []), { role: 'customer', message: currentMessage }];

  // Customer JENGKEL karena pertanyaan berulang? Dipakai buildQualificationStateBlock
  // untuk menyuntikkan protokol PEMULIHAN (minta maaf + rekap + JANGAN tanya ulang).
  const _frustration = detectCustomerFrustration(currentMessage);

  const state = {
    transactionType : null,   // Q1
    buildingType    : null,   // from first message
    fallbackTypes   : [],     // "kalau tidak ada X, Y saja"
    // ⚠️ ISTILAH "location" SENGAJA TIDAK DIPAKAI — ambigu, bisa berarti kota
    // ATAU area/kecamatan, dan kerancuan itu sudah beberapa kali membuat
    // jawaban kota tersimpan ke slot area (dan sebaliknya). Dua slot, dua nama
    // eksplisit: `city` (Q2) dan `district` (Q2c). Alias `location` masih
    // di-set di akhir extractQualificationState() demi kompatibilitas.
    city            : null,   // Q2  — KOTA saja (Surabaya, Malang, Bali)
    district        : null,   // Q2c — area/kecamatan DI DALAM kota (Ngagel, Pakuwon, Merr)
    budget          : null,   // Q3
    household       : null,   // Q4
    redFlags        : null,   // Q5
    // Kekesalan customer pada giliran INI (bukan akumulasi) — memicu protokol
    // pemulihan di state block. kind: 'repetition' | 'ignored' | 'general' | null.
    customerFrustrated : _frustration.frustrated,
    frustrationKind    : _frustration.kind,
    anchorPoint     : null,   // Q6
    alternativeAreas: null,   // Q7
    moveInDate      : null,   // Q8 MANDATORY
    moveInDateAsk   : null,   // 'current_month' | 'soon' — Q8 perlu klarifikasi (rule 25/35)
    decisionMaker   : null,   // Q9
    viewingDate     : null,   // Q9b — tanggal survei, atau 'Minta listing' bila customer menolak
    viewingTime     : null,   // Q9c — jam survei (hanya ditanya bila viewingDate ada)
    leaseDuration   : null,   // Q10
    furnishing      : null,   // Q11
    facilities      : null,   // amenities (gym, kids zone, kolam renang, dll) — opsional
    apartmentPref   : null,   // Q12
    // Q14 kantor (M122) — SEBELUMNYA tidak ada state eksplisit sama sekali;
    // "Grade A/B/C?" dan "fit-out/shell?" hanya berupa HINT teks bebas yang
    // diserahkan ke LLM untuk dibaca ulang dari history tiap giliran. Transkrip
    // nyata (19-20 Agu 2026): AI SUDAH mengonfirmasi "tercatat Grade C, ya 👍"
    // lalu 2 giliran kemudian menanyakannya LAGI — lima kali berturut-turut,
    // sampai customer menulis "Stop diulang". Fakta yang sudah dikonfirmasi
    // AI sendiri tidak tersimpan di mana pun selain teks bebas, jadi hilang
    // begitu LLM re-derive dari history yang makin panjang.
    officeGrade     : null,   // Q14 kantor: 'A' | 'B' | 'C'
    officeFitOut    : null,   // Q14 kantor: 'fit-out' | 'shell & core'
    financing       : null,   // Q_KPR  (beli only): cash | KPR | kombinasi
    kprDetails      : null,   // Q_KPR-a (beli + KPR): bank & DP
    propertyCondition: null,  // Q_COND (beli residensial): baru/ready | second | inden
    useCase         : null,   // own-use | investasi | ibadah | kantor/usaha | liburan
    rentOutIntent   : false,  // investasi yang akan disewakan (kos/kontrakan) → tanya target penyewa
    aiAskedQ2b      : false,  // true when AI already asked Q2b — show ⏭️, NEVER repeat
    // M140: true bila AI SUDAH pernah mengirim listing di sesi ini. Dipakai
    // findNextQuestion() untuk memutuskan apakah giliran ini harus MENAMPILKAN
    // listing (syarat minimum terpenuhi tapi belum pernah tampil) atau boleh
    // melanjutkan pertanyaan pendalaman. Tanpa flag ini, gerbang "tampilkan
    // listing" akan menyala TERUS setiap giliran dan alur tidak pernah maju.
    listingsShown   : false,
    // Q2c ditanya TAPI customer menolak menyebut area ("mana saja", "terserah",
    // "belum tahu"). PENOLAKAN = JAWABAN: Q2c tidak boleh ditanya lagi, dan
    // baris "Area" tidak muncul di summary (tidak ada nilai untuk ditulis).
    // Tanpa flag ini, memperluas Q2c ke SEMUA kota (M84) akan membuat customer
    // yang menolak ditanya area terjebak loop tak berujung.
    q2cDeclined     : false,
    // Customer memakai bahasa BOOKING/menginap ("booking apartemen", "book
    // selama 5 hari", "checkin tanggal 15"). transactionType tetap 'rent'
    // (booking = cabang sewa, master flow Q2), tapi NADA pertanyaannya harus
    // ikut: menanyakan "Rencananya SEWA untuk berapa lama?" kepada orang yang
    // menginap 5 hari terbaca seperti bot yang tidak menyimak (M89).
    bookingIntent   : false,
  };

  const MONTH_ID = 'januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember';
  const MONTH_EN = 'january|february|march|april|may|june|july|august|september|october|november|december';
  // \\b word boundaries prevent brand names like "indomaret" from matching "maret"
  const MONTH_RE = new RegExp(`(\\d{1,2}\\s+)?\\b(${MONTH_ID}|${MONTH_EN})\\b(\\s+\\d{4})?`, 'i');
  // City detection now delegates to propertyRecommendationService.detectLocation() —
  // it covers 649 DB-driven cities + a 200+ city fallback list + alias matching
  // (sby→Surabaya, jogja→Yogyakarta) + a generic "di X" fallback for unrecognized
  // towns (e.g. "ngajuk"/"nganjuk"). The previous CITY_RE here was a 28-city hardcoded
  // whitelist that silently returned no match for anything outside it — causing
  // state.city to stay null for smaller/misspelled cities even though the
  // customer clearly stated one, which left the qualification state shown to the
  // LLM incomplete/inconsistent for the rest of the conversation.

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

  // ── Phase 0: Find "active session start" + resolve canonical type/tx/city ──
  // The active session begins at Boundary A — Summary brief: if a brief was
  // already sent, the first customer message after it starts a fresh search.
  // Everything before that boundary is a stale/abandoned search and must NOT
  // pollute the current qualification state.
  //
  // ⚠️ M124 (21 Agu 2026): a second boundary used to live here — "Boundary B"
  // — which hard-truncated ACTIVE_ALL the instant a customer's city, property
  // type, or transaction type differed from what was already established,
  // discarding EVERY answer that came before the switch (budget, move-in date,
  // survey schedule, facilities — all of it, not just the field that actually
  // changed). Real transcript: a customer deep in a Surabaya house search named
  // "Sidoarjo" while answering an alternative-AREA question, and the bot reset
  // all the way to "Mau sewa atau beli? Dan tipe propertinya apa?" as if the
  // conversation had never happened.
  //
  // Business rule is now GRANULAR, not all-or-nothing (owner spec, M124):
  // changing city / transaction type / property type each keep MOST answered
  // slots and only re-ask what that specific change actually invalidates.
  //
  // Why this canonical-resolve step still has to exist (can't just delete it):
  // Phase 1 below extracts buildingType/transactionType/city with a FIRST-WINS
  // guard (`if (!state.city) state.city = loc;`) — deliberately sticky, so a
  // Q6 anchor mentioning "kantor" in passing can't flip an established "rumah"
  // search (M73). That stickiness means Phase 1 ALONE would keep resolving to
  // whichever value was mentioned FIRST in the active window, forever — a
  // genuine switch on turn N would correctly show the new value on turn N (via
  // the Phase 3B override below) but silently REVERT to the old value on turn
  // N+1, because Phase 1 re-scans from scratch every call and finds the old
  // message again. This block resolves the CANONICAL (latest genuine) value
  // for each of the three anchor fields by walking the whole active window
  // forward once, tracking the running value and where it last flipped — Phase
  // 3B overrides Phase 1's first-wins result with this resolved value on EVERY
  // turn (not just the turn the switch happened), and uses the flip *position*
  // to fire the field-preservation rules exactly once, on the turn the switch
  // actually occurs.
  {
    const SUMMARY_RE_P0 = /[✓✔]\s*Rencana\s*:/i;
    const histForP0 = ALL.slice(0, -1);

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

    // Expose ACTIVE_ALL for Phase 1, 2 & 3B (via closure)
    // eslint-disable-next-line no-var
    var ACTIVE_ALL = ALL.slice(summaryStart);

    // ── Canonical resolver: walk ACTIVE_ALL forward, track the running
    // type/tx/city and the index (within ACTIVE_ALL) each last genuinely
    // flipped. Same word-boundary detectors & guards as before M124 (hedge
    // messages don't flip type; investment-intent phrasing doesn't flip tx;
    // location flips require BOTH sides to be a known city name, non-substring
    // of each other — M51 guard against "gang sempit" misread as a city).
    // ⭐ M162: regex-nya TIDAK lagi ditulis di sini. Detektor kanonik hidup di
    // propertyRecommendationService.detectCanonicalType/Transaction — satu
    // salinan yang juga dipakai Private Agent, supaya kedua jalur tidak bisa
    // lagi berbeda pendapat soal "ngekos" (lihat komentar di definisinya).
    const typeOfP0 = detectCanonicalType;
    const txOfP0   = detectCanonicalTransaction;
    const locOfP0 = (txt) => detectLocation(txt || '');

    let runType = null, runTypeIdx = -1;
    let runTx   = null, runTxIdx   = -1;
    let runLoc  = null, runLocIdx  = -1;
    for (let i = 0; i < ACTIVE_ALL.length; i++) {
      if (!QS_CUST_ROLES.has(ACTIVE_ALL[i].role)) continue;
      const isHedge = isConditionalFallbackMessage(ACTIVE_ALL[i].message);
      const t   = isHedge ? null : typeOfP0(ACTIVE_ALL[i].message);
      const tx  = txOfP0(ACTIVE_ALL[i].message);
      const loc = locOfP0(ACTIVE_ALL[i].message);
      if (t && runType && t !== runType) { runType = t; runTypeIdx = i; }
      else if (t && !runType) { runType = t; }
      if (tx && runTx && tx !== runTx) { runTx = tx; runTxIdx = i; }
      else if (tx && !runTx) { runTx = tx; }
      if (loc && runLoc && loc.toLowerCase() !== runLoc.toLowerCase()
          && isKnownLocationName(loc) && isKnownLocationName(runLoc)
          && !loc.toLowerCase().includes(runLoc.toLowerCase())
          && !runLoc.toLowerCase().includes(loc.toLowerCase())) {
        runLoc = loc; runLocIdx = i;
      } else if (loc && !runLoc) { runLoc = loc; }
    }
    // Did the LATEST genuine flip land on the current (last) message? Only
    // then should the dependent fields be reset — a flip several turns back
    // was already handled on that turn; re-nulling on every later turn would
    // wipe the customer's fresh answer to the re-ask.
    const lastIdx = ACTIVE_ALL.length - 1;
    // eslint-disable-next-line no-var
    var P0_RESOLVED = {
      type: runType, typeChangedNow: runTypeIdx === lastIdx,
      tx:   runTx,   txChangedNow:   runTxIdx   === lastIdx,
      loc:  runLoc,  locChangedNow:  runLocIdx  === lastIdx,
    };
  }

  // ── Phase 1: Scan every customer message for content-detectable fields ────
  // Uses ACTIVE_ALL (messages from active session start) to prevent stale
  // Q2–Q12 data from before the last summary from polluting the current search.
  //
  // Anchor points are ACCUMULATED (not first-match-wins like other fields) — a
  // customer often volunteers separate "dekat X" mentions in different answers
  // (e.g. "dekat stasiun bus" inside a Q2b answer, then later "deket dengan cafe"
  // inside a Q5 red-flags answer). Both are genuine patokan lokasi and must both
  // reach the summary, not just whichever happened to match first.
  const _anchorParts = [];
  for (const msg of ACTIVE_ALL) {
    if (!QS_CUST_ROLES.has(msg.role)) continue;
    const raw  = msg.message || '';
    const text = raw.toLowerCase().trim();
    // Pesan ralat → slot first-wins (budget, tanggal masuk) boleh di-overwrite
    // dengan nilai baru di pesan ini. Loop berjalan kronologis, jadi ralat yang
    // datang belakangan otomatis menang atas nilai lama.
    const isCorrectionMsg = CORRECTION_RE.test(text);

    // Q1 — Transaction type. "booking/pesan" = rent frame (hotel/kondotel/villa)
    if (!state.transactionType) {
      if (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|kos|kost|kosan|kostan|ngekos|ngekost|ngekosan|indekos|indekost|rent|rental|lease|booking|book|pesan|reservasi)\b/.test(text))
        state.transactionType = 'rent';
      else if (/\b(beli|membeli|pembelian|dibeli|jual|dijual|buy|purchase|invest|investasi)\b/.test(text))
        state.transactionType = 'sale';
    }

    // Building type (primary) — all 12 types, detection-order: most specific first.
    // kondotel before hotel/apartment; mansion/rumah mewah before rumah; store after shophouse.
    // Strip USE-phrases first so "rumah utk bangun kos", "ruko buat ibadah",
    // "dipakai sebagai kantor" don't flip the type to the USE word.
    if (!state.buildingType) {
      // ⚠️ RANTAI STRIP HARUS SAMA dengan 3 call-site lain (baris ~1461/1509/1535).
      // Dulu di sini HANYA stripCommercialUsePhrases, sehingga jawaban PATOKAN
      // LOKASI (Q6) "Saya mau dekat indomaret, warung, resto" membuat
      // buildingType = 'store' — customer yang jelas mencari RUMAH dicarikan TOKO,
      // dan karena tipe bersifat first-match-wins, "Saya mau beli rumah" berikutnya
      // TIDAK bisa mengoreksinya. Ini juga memicu reset ke Q1 saat tipe dianggap
      // berubah (M73).
      // stripNearPhrases membuang "dekat/deket/near X" — persis kelas kalimat ini.
      const tt = stripCommercialUsePhrases(
        stripMovingFromPhrases(stripAmbiguousRumah(stripNearPhrases(text)))
      );
      if (/\bkondotel\b|\bcondotel\b/.test(tt))                          state.buildingType = 'kondotel';
      else if (/\bmansion\b|\brumah\s+mewah\b/.test(tt))               state.buildingType = 'mansion';
      else if (/\bvill?a\b/.test(tt))                                    state.buildingType = 'villa';
      else if (/\bapartemen\b|\bapartment\b/.test(tt))                   state.buildingType = 'apartment';
      else if (/\bhotel\b|\bpenginapan\b/.test(tt))                     state.buildingType = 'hotel';
      else if (/\bkos\b|\bkost\b|\bkosan\b|\bkostan\b|\bngekos\b|\bngekost\b|\bngekosan\b|\bindekos\b|\bindekost\b/.test(tt))      state.buildingType = 'boarding_house';
      else if (/\bruko\b|\brukan\b/.test(tt))                           state.buildingType = 'shophouse';
      else if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(tt))     state.buildingType = 'store';
      else if (/\bkantor\b|\boffice\b/.test(tt))                                   state.buildingType = 'office';
      else if (/\bgudang\b|\bwarehouse\b/.test(tt))                                   state.buildingType = 'warehouse';
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
    // Pattern C: hedge offer — "... juga boleh/bisa/mau [type]" (no "saja/aja"), e.g.
    // "kalau gak ada apartemen, saya juga boleh dibantu booking Villa"
    if (isConditionalFallbackMessage(raw)) {
      const hedgeMatch = text.match(/\b(?:juga|masih)\b\s+(?:boleh|bisa|oke|ok|mau)\b([^.!?]{0,40})/);
      if (hedgeMatch) {
        const fb = _typeKeyFromWord(hedgeMatch[1]);
        if (fb && fb !== state.buildingType && !state.fallbackTypes.includes(fb)) {
          state.fallbackTypes.push(fb);
        }
      }
    }

    // Q2 — Location (city). detectLocation() already strips "kisaran [price]" internally
    // ("kisaran" = range/approximately in Indonesian, must never be read as the city
    // Kisaran, North Sumatra) — no need to pre-strip it here.
    if (!state.city) {
      const loc = detectLocation(raw);
      if (loc) state.city = loc;
    }

    // Sinyal BOOKING / menginap jangka pendek (M89). Loop ini SUDAH difilter ke
    // peran CUSTOMER di atas — penting, karena kata "booking"/"check-in" sering
    // muncul di pesan AI sendiri ("langsung bisa jadwalkan viewing…"), sehingga
    // memindai pesan AI akan menyalakan flag ini untuk sewa tahunan biasa.
    if (!state.bookingIntent &&
        /\b(booking|bookingan|book|menginap|nginap|nginep|check[\s-]?in|checkin|reservasi)\b/i.test(raw)) {
      state.bookingIntent = true;
    }

    // Q2c — District / area within large city
    // Only detect when a city-level location is known, and customer mentions a specific area.
    if (!state.district && state.city) {
      const locL = state.city.toLowerCase();
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
    // Pesan ralat boleh menimpa budget lama ("ralat, budget 1-2 miliar aja") —
    // hanya bila pesan ralat memang berisi angka budget baru yang valid.
    if (!state.budget || isCorrectionMsg) {
      const b = detectBudget(raw);
      if (b && !b.ambiguous) {
        // ⚠️ M168: dulu `b.preference === 'affordable'`. detectBudget() TIDAK
        // PERNAH mengembalikan 'affordable' — _detectBudgetTier() hanya
        // memulangkan kosakata Indonesia 'terjangkau' | 'menengah' |
        // 'eksklusif' (propertyRecommendationService.js). Cabang itu mati
        // sejak tier diperkenalkan, dan 'menengah'/'eksklusif' tidak pernah
        // punya cabangnya sendiri sama sekali. Sekarang: kategori APA PUN
        // disimpan apa adanya sebagai nama tier-nya (angka konkret di-resolve
        // belakangan di buildAgentBrief, yang butuh tipe+transaksi dulu).
        if (b.preference) {
          state.budget = b.preference;
        } else {
          state.budget = b.text + budgetPeriodSuffix(b.period, b.periodCount);
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
    // Accumulated across ALL messages (see _anchorParts note above the loop).
    //
    // matchAll + newline excluded from the capture: the cookie response timer
    // debounce-joins consecutive WhatsApp messages with '\n' ("Dekat Suncity mall\n
    // Dekat stasiun bus"), so a \s-based class swallowed the newline into ONE
    // anchor phrase and only the first "dekat" was ever matched.
    {
      for (const t of extractAnchorTokens(raw)) {
        if (!_anchorParts.some((p) => p.toLowerCase() === t.toLowerCase())) {
          _anchorParts.push(t);
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
      // "N teman/kawan/rekan" — hitungan TANPA kata "orang", bentuk paling lazim
      // untuk penyewa bersama ("tinggal bersama 2 teman kerja saya"). Dulu tidak
      // tertangkap sama sekali karena headcount di atas mewajibkan kata
      // "orang|pax|people", sehingga Q4 ditanyakan berulang tanpa henti.
      // Total penghuni = customer + N teman (konvensi yang sudah dipakai AI:
      // "Kak + 5 teman kerja" → 6 orang).
      if (!state.household) {
        const mates = text.match(/\b(\d{1,2})\s*(?:orang\s+)?(?:teman|temen|kawan|rekan|sahabat|kolega|friends?)\b/);
        if (mates) {
          const n = parseInt(mates[1], 10) + 1;
          if (n >= 2 && n <= 200) {
            state.household = n >= 6 ? `${n} orang (rombongan/grup)` : `${n} orang`;
          }
        }
      }
      // "bertiga/berempat/berlima/berenam" — jumlah tanpa angka.
      if (!state.household) {
        const WORD_N = { bertiga: 3, berempat: 4, berlima: 5, berenam: 6, bertujuh: 7, berdelapan: 8 };
        for (const [w, n] of Object.entries(WORD_N)) {
          if (new RegExp(`\\b${w}\\b`).test(text)) {
            state.household = n >= 6 ? `${n} orang (rombongan/grup)` : `${n} orang`;
            break;
          }
        }
      }
      // Teman TANPA jumlah ("sama teman kerja", "bareng temen") — jumlahnya
      // belum jelas, tapi pertanyaannya SUDAH TERJAWAB; jangan ditanya lagi.
      if (!state.household && /\b(?:sama|bersama|bareng|dengan)\s+(?:teman|temen|kawan|rekan|kolega)\b/.test(text)) {
        state.household = 'bersama teman';
      }
      // "sendirian" TIDAK match \bsendiri\b (boundary gagal di "-an") dan "sendiran"
      // adalah typo — pakai sendiri(?:an)? agar "Saya tinggal sendirian" tertangkap.
      if (!state.household && (/\bsendiri(?:an)?\b|\bsendiran\b|\bjust me\b|\balone\b/.test(text))) {
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
    // Pesan ralat boleh menimpa tanggal masuk ("ralat, jadinya 5 agustus") —
    // KECUALI ralat itu tentang JADWAL VIEWING ("ralat viewingnya besok aja"):
    // tanggal viewing bukan tanggal masuk, jangan sampai saling menimpa.
    // ⚠️ Pengecualian VIEWING berlaku untuk PENANGKAPAN AWAL juga, bukan hanya ralat.
    // Dulu hanya cabang isCorrectionMsg yang menyaringnya, sehingga pesan biasa
    // "Bisa survei besok?" ikut di-parse → Q8 (tanggal masuk) terisi tanggal VIEWING.
    // Karena Q8 first-match-wins, tanggal check-in ASLI yang disebut kemudian
    // ("Saya checkin tanggal 6 Agustus ini") TIDAK BISA menimpanya → brief agent
    // memuat tanggal masuk yang SALAH (M63).
    // Kecuali pesan itu juga menyebut isyarat masuk/check-in — mis. "checkin
    // tanggal 6, sekalian viewing" — di situ tanggalnya memang tanggal masuk.
    const hasMoveInCue  = /\b(check[\s-]?in|checkin|masuk|mulai\s+(sewa|tinggal|huni|nginap|menginap)|tempati|menempati|pindah|nginap|menginap|booking\s+dari)\b/i.test(text);
    const isViewingOnly = /\b(viewing|survei|survey|lihat\s+unit|lihat\s+propert|kunjungan|jadwal\w*)\b/i.test(text) && !hasMoveInCue;

    if ((!state.moveInDate && !isViewingOnly) || (isCorrectionMsg && !isViewingOnly)) {
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
        // ⚠️ PENUNDAAN BUKAN PILIHAN (M103).
        // Bug produksi 26 Agu 2026: customer menulis "Urusan KPR nanti sj" —
        // itu MENUNDA topik pembiayaan, bukan memilih KPR. Karena pola lama
        // hanya mencari kata "kpr" di mana saja, financing di-set 'KPR', lalu
        // findNextQuestion langsung menembak Q_KPR-a ("bank mana? DP berapa
        // persen?") — persis hal yang baru saja diminta customer untuk DITUNDA.
        // Deteksi penundaan HARUS didahulukan; slot dibiarkan ❓ supaya
        // pertanyaannya muncul lagi NANTI, bukan terisi nilai palsu sekarang.
        const isDeferral = /\b(?:nanti|ntar|belakangan|kemudian|besok)\b\s*(?:saja|sj|aja|dulu|dlu)?\b/i.test(text)
          || /\b(?:urusan|soal|masalah|perkara)\b[^.?!]{0,20}\b(?:nanti|ntar|belakangan)\b/i.test(text)
          || /\b(?:belum|blm)\b[^.?!]{0,15}\b(?:mikir|kepikiran|tahu|tau|putus|pasti)\b/i.test(text);

        if (!isDeferral) {
          const hasKpr  = /\b(kpr|kpa|kpt|kredit|mortgage|dp\s*\d+)\b/.test(text);
          const hasCash = /\b(cash|tunai)\b/.test(text);
          if (hasKpr && hasCash)  state.financing = 'kombinasi cash + KPR';
          else if (hasKpr)        state.financing = 'KPR';
          else if (hasCash)       state.financing = 'cash';
        }
      }
      // Q_COND — kondisi (beli residensial): baru/ready | second | inden.
      // Jawaban GABUNGAN ("kondisi baru atau second") harus utuh — dulu hanya
      // "second" yang match sehingga summary kehilangan opsi "baru"-nya.
      if (!state.propertyCondition) {
        const pairNewSecond =
          /\b(?:baru|ready)\b[^.!?\n]{0,25}\b(?:atau|\/|or|maupun)\b[^.!?\n]{0,25}\b(?:second|bekas)\b/.test(text) ||
          /\b(?:second|bekas)\b[^.!?\n]{0,25}\b(?:atau|\/|or|maupun)\b[^.!?\n]{0,25}\b(?:baru|ready)\b/.test(text);
        if (pairNewSecond)                                        state.propertyCondition = 'baru atau second';
        else if (/\bready\s*stock\b|\bbaru\/ready\b|\bkondisi\s+baru\b/.test(text)) state.propertyCondition = 'baru/ready';
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

  // ── Phase 1.4: durasi yang disebut SENDIRI oleh customer (M103) ──────────
  // Phase 2 hanya melihat PASANGAN AI→Customer, jadi durasi di pesan PERTAMA
  // customer (belum ada balasan AI) tidak pernah terbaca — durasi hilang dari
  // ringkasan dan AI menanyakannya lagi.
  if (!state.leaseDuration) {
    for (const msg of ACTIVE_ALL) {
      if (!QS_CUST_ROLES.has(msg.role)) continue;
      const found = extractSelfVolunteeredDuration(msg.message || '');
      if (found) { state.leaseDuration = found; break; }
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

  // M140 — apakah AI sudah pernah MENGIRIM listing di sesi ini?
  // Penanda: baris bernomor ("1." / "2.") yang membawa HARGA di pesan AI.
  // Keduanya harus ada — pesan yang sekadar menyebut "Rp" (mis. menanyakan
  // budget lewat 2 harga kontras di Q3) BUKAN listing, dan daftar bernomor
  // tanpa harga (mis. menu pilihan) juga bukan.
  {
    const LISTING_LINE_RE = /^\s*\*?\d+[.)]\s+\S/m;
    const PRICE_RE = /\bRp\s*[\d.,]|\b\d+([.,]\d+)?\s*(juta|jt|miliar|milyar|m)\b/i;
    state.listingsShown = ACTIVE_ALL.some((m) => {
      if (!QS_AI_ROLES.has(m.role)) return false;
      const txt = String(m.message || '');
      return LISTING_LINE_RE.test(txt) && PRICE_RE.test(txt);
    });
  }

  // Merge accumulated Phase 1 anchor landmarks into ONE clean phrase:
  // ["Manguharjo", "Suncity mall", "stasiun bus"] → "dekat Manguharjo, Suncity mall
  // dan stasiun bus". Tokens are already deduped at capture time, so a repeated
  // mention ("dekat dengan Suncity mall" after "dekat Manguharjo dan Suncity mall")
  // never appears twice.
  if (_anchorParts.length) {
    state.anchorPoint = joinAnchorTokens(_anchorParts);
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

    // Q3 — customer MENERIMA / MENOLAK harga yang ditawarkan AI (anchor).
    // Butuh pasangan AI↔jawaban: nilainya berasal dari nominal di PERTANYAAN AI,
    // bukan dari pesan customer (yang cuma berbunyi "Sesuai, Kak").
    {
      const anchored = detectBudgetAnchorResponse(ai.message || '', custResp);
      // `anchored` SELALU MENIMPA hasil Phase 1 ketika truthy. Phase 1 memindai
      // pesan tanpa konteks dan memetakan kata "mahal" ke tier *eksklusif* —
      // kebalikan dari maksud customer yang justru komplain kemahalan/minta
      // lebih murah. Deteksi anchor ini tahu AI baru saja menawarkan harga
      // NYATA (nominal Rp asli), jadi konteksnya lebih lengkap dan berhak
      // menang — nilainya sendiri sekarang SELALU angka Rupiah asli (bukan
      // kategori kosong seperti "terjangkau" tanpa nominal, bug 5 Agu 2026).
      if (anchored) state.budget = anchored;
    }

    // Q3a — jawaban atas follow-up "kisaran berapa" (lihat findNextQuestion Q3a).
    // Menutup celah Budget yang hanya berupa KATEGORI ("terjangkau/affordable")
    // tanpa angka sama sekali. Diterima SEKALI SAJA — apa pun jawabannya
    // (angka valid ATAU tetap vague), state.budgetRangeAsked dikunci true supaya
    // Q3a tidak pernah ditanya dua kali.
    if (/kisaran berapa|budget.{0,10}(nya|nya kira)/i.test(ai.message || '') && !state.budgetRangeAsked) {
      state.budgetRangeAsked = true;
      const b2 = detectBudget(custResp);
      // ⚠️ M168: dulu `b2.preference !== 'affordable'` — selalu true, karena
      // 'affordable' bukan nilai yang pernah dipulangkan detectBudget(). Guard
      // ini seharusnya membedakan jawaban ANGKA dari jawaban KATEGORI; yang
      // dicek sekarang adalah ada-tidaknya preference, bukan satu kata mati.
      if (b2 && !b2.ambiguous && !b2.preference) {
        state.budget = b2.text + budgetPeriodSuffix(b2.period, b2.periodCount);
      }
      // Jika customer tetap vague ("terserah aja, yang penting terjangkau") →
      // state.budget TETAP kategori lama, tapi budgetRangeAsked=true mencegah
      // pertanyaan ini diulang — customer sudah diberi kesempatan menjawab.
    }

    // Q9b / Q9c — JADWAL SURVEI (tanggal dulu, lalu jam).
    // Customer BERHAK menolak survei; penolakan adalah jawaban yang sah dan
    // dicatat sebagai "Minta listing" — bukan slot kosong yang ditanya ulang.
    {
      const aiAsksViewDate = /tanggal berapa|kapan.{0,20}(lihat|survei|survey|viewing)|mau lihat unit|jadwal.{0,15}(survei|viewing)/i.test(ai.message || '');
      const aiAsksViewTime = /jam berapa|pukul berapa|jam yang|paling pas/i.test(ai.message || '');
      const lo = custResp.toLowerCase();

      // ⚠️ PENOLAKAN SURVEI DICATAT DI GILIRAN MANA PUN, bukan hanya saat AI
      // kebetulan sedang menanyakan TANGGAL survei.
      // Bug produksi (booking kantor Madiun, 20 Agu 2026) — customer menolak
      // EMPAT KALI dan tetap ditanya ulang:
      //   16.20 "Tdk perlu survei. Saya minta rekomendasi aja dlu" → AI: "mau viewing jam berapa?"
      //   16.21 "Tdk mau survei. Minta katalog saja"               → tidak tercatat (AI menanya JAM, bukan TANGGAL)
      //   16.34 "Minta listing saja"                               → tidak tercatat (AI menanya Q5)
      //   16.37 AI menanya Q9 (jadwalkan viewing) LAGI
      // Penyebab: cek penolakan bersarang di dalam `aiAsksViewDate`, sehingga
      // penolakan yang diucapkan saat AI menanyakan hal LAIN menguap.
      // Penolakan survei bersifat MUTLAK dan tidak bergantung pertanyaan yang
      // sedang terbuka — sekali customer bilang tidak mau survei / minta
      // listing / katalog / rekomendasi, itu jawaban FINAL untuk Q9b DAN Q9c.
      // (Prinsip yang sama dengan M75 untuk jam survei sukarela.)
      if (!state.viewingDate && VIEWING_REFUSAL_RE.test(lo)) {
        state.viewingDate = 'Minta listing';
      }

      if (aiAsksViewDate && !state.viewingDate) {
        if (VIEWING_REFUSAL_RE.test(lo)) {
          state.viewingDate = 'Minta listing';
        } else {
          // Pakai `formatted` ("20 Agustus 2026"), BUKAN `date` (ISO string) —
          // nilai ini tampil apa adanya di baris summary customer.
          const d = parseCustomerDate(custResp);
          if (d && d.formatted) state.viewingDate = d.formatted;
        }
      }
      // ⚠️ JAM YANG DIBERIKAN SUKARELA JUGA HARUS DITANGKAP.
      // Dulu blok ini HANYA berjalan bila AI baru saja menanyakan jam
      // (aiAsksViewTime). Kasus nyata (5 Agu 2026): AI menanyakan Q9 (decision
      // maker), customer menjawab "Saya mau servei 5 hari lagi. Jam 4 sore" —
      // SATU kalimat berisi tanggal DAN jam. Tanggal tertangkap (pola
      // "jadwalkan viewing" cocok aiAsksViewDate), tapi jamnya DIBUANG karena
      // AI belum menanyakan jam. Akibatnya AI bertanya "jam berapa yang paling
      // pas?" padahal customer sudah menjawabnya (M75).
      // Aturan: informasi yang SUDAH diberikan customer tidak boleh dibuang
      // hanya karena urutan pertanyaannya belum sampai situ.
      const custMentionsClock = /\b(?:jam|pukul)\s*\d{1,2}\b/i.test(custResp);
      if ((aiAsksViewTime || custMentionsClock) && !state.viewingTime && state.viewingDate !== 'Minta listing') {
        // Saat jam diberikan sukarela, WAJIB ada kata "jam"/"pukul" eksplisit —
        // tanpa itu angka seperti "5 hari lagi" atau "3 kamar" bisa salah
        // terbaca sebagai jam. Saat AI memang bertanya jam, pola longgar tetap
        // dipakai supaya jawaban telanjang ("4 sore") tetap tertangkap.
        const timeRe = aiAsksViewTime
          ? /\b(?:jam|pukul)?\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam|am|pm)?\b/i
          : /\b(?:jam|pukul)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam|am|pm)?\b/i;
        const t = custResp.match(timeRe);
        if (t) {
          const label = (t[3] || '').toLowerCase();
          state.viewingTime = `Jam ${t[1]}${t[2] ? '.' + t[2] : ''}${label ? ' ' + label : ''}`.trim();
        }
        // ⚠️ FALLBACK tanggal dari kalimat AI sendiri. Bug nyata (4 Agu 2026):
        // AI kadang MENYATAKAN tanggal survei sambil MENANYAKAN jamnya dalam
        // SATU kalimat ("...jadwal survei di tanggal 18 Agustus 2026, kira-
        // kira jam berapa yang paling pas?") — bukan pola interogatif "tanggal
        // berapa" yang dicek `aiAsksViewDate` di atas, jadi giliran sebelumnya
        // tidak pernah menyimpan viewingDate. Customer lalu hanya menjawab
        // jamnya saja ("Jam 2 siang") tanpa mengulang tanggal, dan summary
        // akhir memakai tanggal fabrikasi/kosong. Di sini kita coba baca
        // tanggal eksplisit dari PESAN AI ITU SENDIRI, bukan dari jawaban
        // customer (yang mungkin cuma berisi jam).
        if (!state.viewingDate) {
          const dFromAi = parseCustomerDate(ai.message || '');
          if (dFromAi && dFromAi.formatted) state.viewingDate = dFromAi.formatted;
        }
      }
    }

    // Q11 — jawaban furnitur TELANJANG ("semi", "yang semi, Kak", "full").
    // Phase 1 mensyaratkan kata "furn" muncul bersama "semi", jadi jawaban
    // sependek "Yang semi, Kak" tidak tertangkap dan pertanyaan furnitur
    // diulang 3× sampai customer mengetik "semi furnished" lengkap (3 Agu 2026).
    // Di sini konteksnya jelas: AI baru saja menanyakan furnitur, jadi satu kata
    // tier sudah cukup.
    if (!state.furnishing && /furnitur|furnished|furnish|perabot|kosongan/i.test(ai.message || '')) {
      const lo = custResp.toLowerCase();
      if (/\b(full|fully|lengkap)\b/.test(lo))            state.furnishing = 'fully furnished';
      else if (/\bsemi\b/.test(lo))                        state.furnishing = 'semi-furnished';
      else if (/\b(kosong|kosongan|unfurnished|polos)\b/.test(lo)) state.furnishing = 'unfurnished/kosongan';
    }

    // Q14 kantor — Grade gedung (M122). AI bertanya "Grade A (premium), Grade
    // B (mid), atau Grade C (ekonomis)?" dan customer sering menjawab TELANJANG
    // ("Grade c", "c", "grade C aja") — tidak ada kata lain untuk dicocokkan
    // regex generik, jadi anchor ini WAJIB spesifik pada konteks pertanyaan AI.
    // Pertanyaan boleh diparafrase LLM ("Grade A (premium), Grade B (mid),
    // atau Grade C?" ATAU "Grade A, B, atau C?" ATAU "gedung grade berapa?
    // A/B/C?") — jadi disyaratkan LONGGAR: kata "grade"/"gedung" MUNCUL, dan
    // minimal DUA huruf a/b/c berdiri sendiri (bukan bagian kata lain, mis.
    // "budget", "cash", "ada") ikut disebutkan.
    const gradeLetterCount = (aiText.match(/\b[abc]\b/gi) || []).length;
    // ⚠️ "gedung" SENGAJA tanpa \b di sisi KANAN — imbuhan posesif Indonesia
    // ("gedungnya") menempel langsung tanpa spasi, jadi \bgedung\b gagal cocok
    // di "gedungnya" walau maknanya sama persis. \b di sisi KIRI dipertahankan
    // supaya tidak salah tangkap prefiks ("digedung" tidak match — sengaja).
    if (!state.officeGrade && /\bgrade\b|\bgedung/i.test(aiText) && gradeLetterCount >= 2) {
      const lo = custResp.toLowerCase();
      // Huruf tunggal dgn word-boundary — "c" TIDAK boleh cocok di "cash" atau
      // "cari". \b memastikan hanya huruf berdiri sendiri (atau setelah kata
      // "grade"/"gedung") yang tertangkap.
      const m = lo.match(/\b(?:grade|gedung)?\s*([abc])\b/i);
      if (m) state.officeGrade = m[1].toUpperCase();
      else if (/\bterserah\b|\bbebas\b|\btidak\s+masalah\b|\bapa\s+saja\b/.test(lo)) {
        // Sama seperti fasilitas "terserah" → default masuk akal, LANJUT
        // (Real-Estate/00_ANSWER_COMPLETENESS_GUIDE §4 Level-2), bukan
        // ditanya ulang selamanya menunggu huruf yang tidak akan pernah datang.
        state.officeGrade = 'B (default — customer terserah)';
      }
    }

    // Q14 kantor — fit-out atau shell & core.
    if (!state.officeFitOut && /\bfit[\s-]?out\b.{0,40}\bshell\b/i.test(aiText)) {
      const lo = custResp.toLowerCase();
      if (/\bfit[\s-]?out\b/.test(lo))          state.officeFitOut = 'fit-out';
      else if (/\bshell\b|\bcore\b|\bkosong(an)?\b/.test(lo)) state.officeFitOut = 'shell & core';
    }

    // Q2c — district/area (pair detection: AI asked which area, customer answered)
    if (!state.district && /area.{0,20}(mana|kawasan|wilayah)|kawasan.{0,20}mana|daerah.{0,20}mana|di bagian mana|which area|which.{0,15}neighbourhood|bagian.{0,20}(surabaya|jakarta|bandung|medan|semarang|makassar)/i.test(aiText)) {
      const candidateDistrict = custResp.trim();
      // ⚠️ AI kadang menggabung DUA pertanyaan dalam satu pesan ("area mana? Dan
      // tanggal check-in?"). Customer lalu menjawab bagian TANGGAL-nya, dan dulu
      // kalimat mentahnya ("Saya checkin tanggal 6 Agustus ini") tersimpan bulat-bulat
      // sebagai district (M63). District harus berupa NAMA TEMPAT: tolak jawaban yang
      // jelas-jelas tanggal/durasi/harga, dan tolak kalimat yang terlalu panjang.
      const looksLikeDate = /\b(tanggal|tgl|check[\s-]?in|checkin|besok|lusa|minggu\s+depan|bulan\s+depan|\d{1,2}[\/-]\d{1,2})\b/i.test(candidateDistrict)
        || /\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i.test(candidateDistrict);
      const looksLikeMoneyOrDuration = /\b\d[\d.,]*\s*(juta|jt|ribu|rb|miliar|malam|hari|minggu|bulan|tahun)\b/i.test(candidateDistrict);
      const isRejection = /^(tidak|belum|ga|gak|ngga|tidak\s+ada|manapun|flexible|fleksibel)\b/i.test(candidateDistrict)
        || /^(mana\s*saja|di\s*mana\s*saja|terserah|bebas|apa\s*saja|semua\s*area|belum\s*tahu|blm\s*tau)\b/i.test(candidateDistrict);

      // PENOLAKAN = JAWABAN (M84). Tandai Q2c sudah tuntas supaya tidak diulang.
      // District tetap null: tidak ada nilai sah untuk ditulis di baris "Area",
      // dan Q7 harus jatuh ke jangkar KOTA — bukan mengarang nama area.
      if (isRejection) state.q2cDeclined = true;

      if (candidateDistrict && !isRejection && !looksLikeDate && !looksLikeMoneyOrDuration
          && candidateDistrict.length <= 60) {
        // Ambil NAMA AREA-nya saja, bukan kalimat mentah. Tanpa ini summary menulis
        // "Area: Saya mempertimbangkan area di Sidotopo" — terbaca seperti bot yang
        // menyalin ulang kalimat customer, bukan mencatat datanya (M65).
        const cleaned = _cleanDistrictAnswer(candidateDistrict);
        // ⚠️ AI sering menggabung KOTA dan AREA dalam satu pertanyaan
        // ("di kota atau area mana?"). Customer menjawab KOTA-nya dulu, dan
        // dulu jawaban itu tersimpan sebagai district — first-wins mengunci
        // slot sehingga nama AREA yang sebenarnya ("Sidotopo") di pesan
        // berikutnya TIDAK PERNAH tercatat, dan LLM terus menanyakan lokasi.
        // District hanya sah bila menyisakan sesuatu DI LUAR nama kota.
        if (!_isJustTheCity(cleaned, state.city)) {
          state.district = cleaned;
        }
      }
    }

    // Q6 — anchor point (AI explicitly asked the dedicated Q6 question).
    // Tokenize the answer and MERGE with Phase 1's accumulated landmarks — a raw
    // copy used to (a) keep filler like "Ya yang strategis saja" and the debounce
    // newline inside the summary line, and (b) clobber landmarks the customer
    // volunteered in OTHER answers (e.g. "deket Pakuwon, GWalk, pasar" given as a
    // red-flags reply AFTER Q6). Only when no landmark is extractable (negative /
    // flexible answers like "bebas", "terserah") keep the raw reply so downstream
    // normalization can render "Bebas".
    // ⚠️ GUARD (!state.anchorPoint || isCorrectionMsg) — DULU TIDAK ADA. Q6 yang
    // sudah terjawab bisa TERTIMPA nilai lebih buruk hanya karena pertanyaannya
    // diulang lagi (bug lain, mis. race condition debounce — lihat
    // responseDebounce.js) tanpa customer benar-benar ingin mengganti jawaban.
    // Kasus nyata: jawaban baik "Di Dinoyo" tertimpa "Tdk ada" setelah Q6
    // ditanya ulang beberapa kali, dan summary akhir menampilkan "Bebas" —
    // padahal customer sudah menjawab dengan jelas di awal. Sekarang HANYA
    // pesan RALAT eksplisit yang boleh menimpa jawaban Q6 yang sudah ada.
    if (/patokan|dekat sekolah|dekat kantor|mall tertentu|anchor|wisata|kawasan tertentu|tempat tertentu.*patokan/.test(aiText)) {
      // Jawaban Q6 berbentuk "Di <NamaTempat>" (bukan "dekat X", tanpa awalan
      // kedekatan) sering kali sebenarnya nama AREA/kecamatan, bukan patokan
      // ("Di Dinoyo" saat AI menanyakan patokan → customer memaksudkan area).
      // Dicek DI LUAR guard anchorPoint di bawah — district punya guard
      // sendiri (!state.district) dan HARUS tetap jalan walau anchorPoint
      // sudah terisi lebih dulu oleh landmark Phase 1 (mis. dari jawaban Q5).
      // Tanpa ini, info area hilang begitu saja saat anchorPoint sudah penuh.
      if (!state.district) {
        const asPlace = custResp.trim().match(/^di\s+([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*){0,2})$/i);
        if (asPlace) {
          const cleaned = _cleanDistrictAnswer(asPlace[1].trim());
          if (!_isJustTheCity(cleaned, state.city)) state.district = cleaned;
        }
      }
    }
    if (/patokan|dekat sekolah|dekat kantor|mall tertentu|anchor|wisata|kawasan tertentu|tempat tertentu.*patokan/.test(aiText)
        && (!state.anchorPoint || CORRECTION_RE.test(custResp))) {
      const q6Tokens = extractAnchorTokens(custResp);
      if (q6Tokens.length) {
        for (const t of q6Tokens) {
          if (!_anchorParts.some((p) => p.toLowerCase() === t.toLowerCase())) _anchorParts.push(t);
        }
        state.anchorPoint = joinAnchorTokens(_anchorParts);
      } else {
        // Customer sering menjawab Q6 (patokan lokasi) dengan daftar FASILITAS
        // ("AC, kolam renang, gym, one gate system, kulkas") — itu bukan patokan
        // lokasi. Fasilitas sudah ditangkap terpisah (detectFacilities). Jangan
        // simpan jawaban yang murni fasilitas (tanpa kata dekat/di jalan/kawasan &
        // bukan nama kota) sebagai anchorPoint — biarkan null supaya baris "Patokan
        // lokasi" tidak menampilkan fasilitas. Jawaban negatif/fleksibel ("bebas",
        // "terserah") tetap disimpan agar dinormalisasi jadi "Bebas".
        const facils = detectFacilities(custResp);
        const hasLocationCue = /\b(dekat|deket|dekay|dekt|dkt|near|di\s+jalan|di\s+sekitar|sekitar|kawasan|daerah|jalan|jl\.?|komplek|perumahan|cluster)\b/i.test(custResp);
        const isFacilityOnly = facils.length >= 1 && !hasLocationCue && !detectLocation(custResp);
        if (!isFacilityOnly) state.anchorPoint = custResp;
      }
    }
    // Q7 — alternative areas
    // The LLM PARAPHRASES this question every time it asks ("area sekitar yang
    // masih oke", "pilihan lokasi lainnya", "area lain yang ingin
    // dipertimbangkan", "area lain di Surabaya yang ingin Kakak
    // pertimbangkan"). A regex pinned to specific wording misses the paraphrase,
    // leaves alternativeAreas null, and the loop self-reinforces: unmatched →
    // re-asked → paraphrased differently → still unmatched. Match on the stable
    // SEMANTIC core instead — "selain/besides" + an area/location noun — not on
    // any one phrasing. Same failure mode as the Q9 paraphrase loop.
    if (!state.alternativeAreas && (
      /\bselain\b[\s\S]{0,60}\b(area|lokasi|kawasan|wilayah|daerah|tempat)\b/i.test(aiText)
      || /\b(area|lokasi|kawasan|wilayah|daerah)\b[\s\S]{0,30}\blain\b/i.test(aiText)
      || /\bbesides\b[\s\S]{0,60}\b(area|location|neighou?rhood)\b/i.test(aiText)
      || /\bother\b[\s\S]{0,20}\b(area|location|neighou?rhood)s?\b/i.test(aiText)
    )) {
      // A REFUSAL is an answer. "Tidak ada", "enggak ada, tetap di Pakuwon",
      // "di pakuwon saja" all mean the customer HAS decided — record it as
      // answered so Q7 goes ✅ and is never asked again. Normalize the refusal
      // into a positive statement of intent so the summary reads
      // "Fokus di Pakuwon saja" instead of the bare "Tidak ada, Kak".
      // Jangkar penolakan HARUS MENGIKUTI jangkar PERTANYAAN yang benar-benar
      // diajukan (M76). Q7 kini berjangkar AREA ("Selain area *Pakuwon*, apakah
      // area sekitar masih oke?") sehingga "tidak ada" = "Fokus di Pakuwon saja".
      // TAPI provider LLM sering memparafrase; bila kalimatnya ternyata memakai
      // KOTA, penolakannya harus berbunyi kota — kalau tidak, jawaban customer
      // dicatat dengan cakupan yang salah (mis. menolak "selain Surabaya" tapi
      // tercatat "Fokus di Ngagel saja", padahal Ngagel justru DI DALAM Surabaya).
      // Karena itu: pilih jangkar dari nama yang MUNCUL di pertanyaan AI.
      const _esc = (v) => String(v || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const askedDistrict = state.district && new RegExp(`\\b${_esc(state.district)}\\b`, 'i').test(aiText);
      const askedCity     = state.city     && new RegExp(`\\b${_esc(state.city)}\\b`, 'i').test(aiText);
      const altAnchor     = askedDistrict ? state.district
                          : askedCity     ? state.city
                          : (state.district || state.city);
      state.alternativeAreas = normalizeAltAreaAnswer(custResp, altAnchor);
    }
    // Q9 — decision maker (normalized server-side so AI just copies the value)
    //
    // The PRIMARY provider (DeepSeek/ChatGPT/etc.) rarely uses the exact canonical
    // Q9 wording verbatim — it paraphrases ("langsung bisa Bapak putuskan sendiri
    // atau perlu diskusi dulu sama istri?" instead of "...jadwalkan viewing atau
    // perlu koordinasi dulu sama keluarga lain?"). Matching only the canonical
    // phrase left every paraphrased Q9 undetected: decisionMaker stayed null even
    // after the customer answered clearly, so the state block still showed Q9 ❓
    // on the next turn and the LLM asked something again instead of progressing.
    // This pattern covers the semantic core of Q9 (act alone/immediately vs.
    // coordinate/discuss with someone) rather than one fixed sentence.
    if (!state.decisionMaker && /jadwalkan\s*viewing|koordinasi\s*dulu|keluarga\s*lain|putuskan\s*sendiri|diskusi\s*dulu|(langsung\s*(bisa|dapat|aja)?\s*(jadwalkan|putuskan|memutuskan))|(perlu\s*(koordinasi|diskusi|tanya|izin)\b.{0,25}(dulu|dengan|sama))|bisa\s*langsung\s*diputuskan|siapa\s*yang\s*(memutuskan|mengambil\s*keputusan)/i.test(aiText)) {
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

      // PENOLAKAN TELANJANG = JAWABAN. Q9 berbentuk pilihan ("langsung jadwalkan
      // ATAU perlu koordinasi dulu?"), jadi "tdk perlu" / "tidak usah" / "gak mau"
      // sudah menjawab dengan jelas: TIDAK perlu koordinasi → Mandiri. Dulu
      // jawaban ini tidak punya satu pun kata di DECISION_SIGNAL_RE sehingga
      // jatuh ke null, dan pertanyaan yang sama diulang 4× sampai customer
      // terpaksa mengetik kalimat panjang "Saya survei sendirian" (3 Agu 2026).
      const BARE_REFUSAL_RE = /^(?:tdk|tidak|ga|gak|gk|nggak|ngga|enggak|engga|no)\s*(?:perlu|usah|mau|butuh)?\b[\s.,!]*$/i;
      const REFUSES_COORD_RE = /\b(?:tdk|tidak|ga|gak|gk|nggak|ngga|enggak|engga)\s+(?:perlu|usah|mau|butuh)\b/i;

      // ORANG LAIN yang mungkin ikut memutuskan. Bila TIDAK SATU PUN disebut,
      // customer bertindak sendiri.
      const OTHER_PERSON_RE = /\b(istri|suami|pasangan|keluarga|orang\s*tua|orangtua|ayah|ibu|bapak|mama|papa|parents|anak|teman|kawan|rekan|saudara|sepupu|kerabat|kakak|adik|om|tante|bos|atasan|partner|kantor|tim)\b/i;

      if (BARE_REFUSAL_RE.test(lo.trim()) || REFUSES_COORD_RE.test(lo)) {
        state.decisionMaker = 'Mandiri';
      } else if ((MONTH_ID_RE.test(lo) || MONTH_EN_RE.test(lo) || DATE_ANSWER_RE.test(lo) || SCHEDULING_ONLY_RE.test(lo)) &&
          !DECISION_SIGNAL_RE.test(lo) && !OTHER_PERSON_RE.test(lo)) {
        // Q9 berbentuk PILIHAN: "langsung jadwalkan viewing ATAU perlu koordinasi
        // dulu sama keluarga lain?". Customer yang langsung menjadwalkan survei
        // untuk dirinya sendiri — TANPA menyebut istri/keluarga/teman/siapa pun —
        // sudah memilih cabang PERTAMA: tidak perlu koordinasi = Mandiri.
        // Dulu cabang ini sengaja dibiarkan ❓ agar AI menanyakan otoritas dengan
        // jelas, tetapi hasilnya AI mengulang Q9 persis setelah customer menjawab
        // "Saya mau servei 5 hari lagi. Jam 4 sore" (M75). Menjadwalkan survei
        // sendiri ADALAH jawabannya.
        state.decisionMaker = 'Mandiri';
      } else if ((MONTH_ID_RE.test(lo) || MONTH_EN_RE.test(lo) || DATE_ANSWER_RE.test(lo) || SCHEDULING_ONLY_RE.test(lo)) &&
          !DECISION_SIGNAL_RE.test(lo)) {
        // Menyebut orang lain TAPI tanpa sinyal keputusan yang jelas
        // (mis. "besok saya lihat sama istri") → ambigu, biarkan Q9 ❓ supaya
        // AI menanyakan otoritas keputusan dengan jelas. JANGAN mengarang nilai.
      } else if (/\b(saya|aku)\b.{0,40}\b(ambil keputusan|yang memutuskan|yang putuskan|yang tentukan|yang decide)\b/i.test(lo) ||
          /\b(ambil keputusan|yang memutuskan|saya sendiri)\b/i.test(lo) ||
          /\btidak perlu koordinasi\b|\b(nggak|ngga|gak|ga|tdk|tidak)\s+perlu koordinasi\b|\btanpa koordinasi\b|\blangsung\s+(bisa|aja|saja|jadwal\w*|viewing|survei|survey|book\w*)\b|\bbisa langsung\b/i.test(lo)) {
        state.decisionMaker = 'Mandiri';
      } else if (/\b(koordinasi|konfirmasi|diskusi|tanya|izin).{0,40}(istri|suami|pasangan)\b/i.test(lo) ||
                 /\b(istri|suami|pasangan).{0,20}(harus|perlu|dulu)\b/i.test(lo)) {
        // "diskusi" added alongside "koordinasi" — customers phrase this as often
        // ("saya akan diskusi dengan istri untuk deal pembeliannya") as "koordinasi",
        // and both mean the same joint-decision signal. Without it this fell through
        // to the raw-response fallback below (still ✅/truthy, so it didn't cause the
        // Q9-never-answered loop by itself, but produced an unnormalized summary line).
        state.decisionMaker = 'Koordinasi dengan pasangan';
      } else if (/\b(koordinasi|diskusi|tanya|izin).{0,40}(orang tua|orangtua|ayah|ibu|parents)\b/i.test(lo)) {
        state.decisionMaker = 'Koordinasi dengan orang tua';
      } else if (/\b(koordinasi|diskusi|tanya|izin).{0,40}keluarga\b/i.test(lo)) {
        state.decisionMaker = 'Koordinasi dengan keluarga';
      } else if (/\b(sendiri|sendirian|seorang diri|solo)\b/i.test(lo)) {
        // "survei sendiri", "sendirian", "solo" → memutuskan TANPA koordinasi.
        // Nilainya HARUS persis "Mandiri" — aturan prompt melarang varian lain
        // ("Solo", "Sendirian", "Solo (mandiri)"), dan kode ini dulu justru
        // menghasilkan "Sendirian" sehingga melanggar aturannya sendiri.
        state.decisionMaker = 'Mandiri';
      } else if (DECISION_SIGNAL_RE.test(lo)) {
        // Ada sinyal keputusan tapi tak match pola spesifik. DULU disimpan
        // MENTAH (`resp` apa adanya) — bila `resp` berasal dari beberapa pesan
        // yang di-debounce/join (mengandung newline, mis. "Iya, Kak\nSaya
        // survei bersama istri"), nilai multi-baris kotor itu ikut tersimpan
        // dan muncul apa adanya di summary customer. Rapikan dulu: satu baris,
        // whitespace rapi, dipotong wajar — tetap "apa adanya" secara MAKNA,
        // hanya tidak lagi membawa newline/spasi ganda mentah.
        state.decisionMaker = resp
          .replace(/\s*\n+\s*/g, ' — ')
          .replace(/\s{2,}/g, ' ')
          .trim()
          .slice(0, 80);
      }
      // else: tidak ada sinyal keputusan sama sekali → biarkan null (Q9 tetap ❓,
      // AI akan menanyakannya; JANGAN tangkap jawaban yang tak relevan).
    }
    // Q10 — lease duration, SELF-VOLUNTEERED (independen dari pertanyaan AI).
    // Customer kerap menyebut durasi TANPA diminta, sering DIGABUNG dengan info
    // lain dalam satu pesan ("Rencana checkin 2 minggu lagi, Kak. Durasi sewa
    // 5 hari") — di sini "2 minggu" adalah OFFSET tanggal masuk, "5 hari" adalah
    // DURASI. Blok Q10 di bawah (yang butuh aiText bertanya durasi) tidak akan
    // pernah jalan kalau AI justru sedang menanyakan hal lain (mis. tanggal
    // check-in) — akibatnya durasi hilang dan Q8 malah salah menangkap durasi
    // sebagai tanggal, atau leaseDuration tetap ❓ selamanya. Anchor KETAT pada
    // kata "durasi" itu sendiri (bukan sekadar angka+satuan pertama di kalimat)
    // supaya "2 minggu" (bagian dari tanggal) tidak ikut tertangkap secara keliru.
    if (!state.leaseDuration) {
      const UNIT = '(hari|malam|minggu|pekan|bulan|tahun|thn|day|days|night|nights|week|weeks|month|months|year|years)';
      // (a) Anchor eksplisit pada kata "durasi" (M82).
      const DURATION_ANCHOR_RE = new RegExp(`durasi\\s*(?:sewa|menginap|booking|nginap|kontrak)?\\s*[:\\-]?\\s*(\\d+)\\s*${UNIT}\\b`, 'i');
      // (b) Anchor pada kata "SELAMA" / "untuk N <unit>" / "book N malam" (M89).
      //     Kasus nyata (transkrip Versi 2, 8–10 Agu 2026): "Cari yang badget
      //     800K-1.4 juta/hari. Karena saya butuh book selama 5 hari saja" —
      //     durasi jelas disebutkan, tapi tanpa kata "durasi" sehingga anchor
      //     (a) tidak cocok dan blok Q10 di bawah juga tidak jalan (AI sedang
      //     menanyakan BUDGET, bukan durasi). Akibatnya AI tetap bertanya
      //     "Rencananya sewa untuk berapa lama?" — pertanyaan yang SUDAH
      //     dijawab, persis keluhan repetitif dari customer.
      //     ⚠️ "selama"/"book"/"menginap" WAJIB ada. Tanpa penanda itu
      //     "5 hari lagi" (OFFSET tanggal masuk, bukan durasi) akan ikut
      //     tertangkap — justru kesalahan yang dicegah M82.
      const DURATION_SELAMA_RE = new RegExp(
        `\\b(?:selama|untuk|book(?:ing)?|nginap|menginap|nginep|stay(?:ing)?|for)\\s+(\\d+)\\s*${UNIT}\\b`, 'i');
      const m = custResp.match(DURATION_ANCHOR_RE)
        // "5 hari lagi" / "2 minggu lagi" = offset tanggal → JANGAN dibaca durasi.
        || (!/\b\d+\s*(?:hari|malam|minggu|pekan|bulan|tahun)\s+lagi\b/i.test(custResp)
            ? custResp.match(DURATION_SELAMA_RE)
            : null);
      if (m) state.leaseDuration = normalizeDuration(`${m[1]} ${m[2]}`);
    }

    // Q10 — lease duration
    // Skip if customer answers with a date instead of a duration (e.g. "26 Juni 2026" → misunderstood question)
    // Like Q7, the LLM paraphrases freely and often drops the word "sewa"
    // entirely ("rencananya liburan di villa tersebut untuk berapa lama?",
    // "menginap berapa lama?", "booking untuk berapa lama?"). Anchor on
    // "berapa lama" / "how long" — the part that actually survives paraphrasing.
    if (!state.leaseDuration && (
      /berapa lama|durasi\s+(sewa|menginap|booking|nginap)|how long/i.test(aiText)
    )) {
      const looksLikeDate = new RegExp(`\\b\\d{1,2}\\s+(?:${MONTH_ID}|${MONTH_EN})\\b`, 'i').test(custResp);
      if (!looksLikeDate) {
        state.leaseDuration = normalizeDuration(custResp) || custResp;
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

    // Q_COND — kondisi properti (fires jika AI menanyakan baru/second/inden).
    // MULTI-PILIH: customer boleh menjawab lebih dari satu opsi ("baru atau
    // second") — kumpulkan SEMUA yang disebut, jangan berhenti di match pertama
    // (dulu if/else-if → "Saya mau beli dalam kondisi baru atau second" hanya
    // tercatat "baru/ready", opsi "second"-nya hilang dari summary).
    if (!state.propertyCondition && /baru.{0,30}second|second.{0,30}inden|kondisi.{0,20}(rumah|unit|properti)|ready.{0,10}stock.{0,20}inden/.test(aiText)) {
      const opts = [];
      if (/\b(baru|ready)\b/i.test(custResp))  opts.push('baru');
      if (/\b(second|bekas)\b/i.test(custResp)) opts.push('second');
      if (/\binden\b/i.test(custResp))          opts.push('inden');
      if (opts.length > 1)      state.propertyCondition = opts.join(' atau ');
      else if (opts[0] === 'baru') state.propertyCondition = 'baru/ready';
      else if (opts.length)     state.propertyCondition = opts[0];
      else if (custResp.trim()) state.propertyCondition = custResp.trim();
    }

    // Q_FAC — facilities (opsional). AI tanya fasilitas → customer jawab apapun → catat.
    // Dua kasus penanda 'standar':
    //   (1) EKSPLISIT minta standar ("fasilitas standar", "yang standar", "biasa aja")
    //       → tambahkan marker 'standar' MESKIPUN customer juga sebut item spesifik
    //         (mis. "pokok fasilitas standar, tambahin kulkas & spring bed"). Ini bikin
    //         summary menggabungkan fasilitas standar + item spesifik.
    //   (2) TANPA preferensi ("tidak ada", "terserah", "bebas") DAN belum ada item
    //       spesifik → set ['standar'] saja.
    if (custResp.trim() &&
        /fasilitas|amenity|amenities|facility|kolam|gym|parking|parkir|furnish|perabot|kelengkapan/i.test(aiText + ' ' + custResp)) {
      const custLo = custResp.toLowerCase();
      const wantsStandardExplicit = /\b(standar|standard)\b|fasilitas\s+(?:yang\s+)?(?:standar|biasa|umum)|(?:yang\s+)?biasa\s+(?:aja|saja)/i.test(custLo);
      // Flexible/no-preference answers — incl. "tidak apa-apa dengan semua fasilitas".
      // Treated same as explicit: marker keeps LATER specifics too (customer often
      // defers first, then adds "one gate system dan smart door" a few turns later —
      // the summary must show standar + specifics merged, not specifics only).
      // ⚠️ DAFTAR INI SENGAJA LUAS (M91). Sebelumnya hanya memuat segelintir
      // bentuk, sehingga 13 dari 23 cara lazim menjawab "bebas" TIDAK menyalakan
      // marker 'standar' — termasuk "apapun" (kata yang paling sering dipakai),
      // "ga ada preferensi" (hanya "gak ada" yang terdaftar), "apa aja boleh",
      // dan "ikut/ngikut/nurut aja". Akibatnya Q_FAC dianggap BELUM terjawab →
      // ditanya ulang, atau baris Fasilitas hilang sama sekali dari summary.
      // Kasus terburuk: "apapun asal ada gym" menyimpan Gym SAJA — customer
      // yang justru bilang "bebas" malah dapat daftar fasilitas paling sempit.
      const noPreference = new RegExp([
        // apapun / apa pun / apa saja / apa aja (+ boleh/aja/saja)
        '\\bapa\\s*(?:pun|saja|aja)\\b',
        // tidak ada / gak ada / ga ada / nggak ada / engga ada …
        '\\b(?:tidak|tdk|gak|ga|gk|nggak|ngga|enggak|engga)\\s+ada\\b',
        // terserah / bebas / gapapa
        '\\b(?:terserah|bebas|gapapa|ga\\s*pa\\s*pa)\\b',
        // tidak apa-apa
        '(?:tidak|gak|ga|ngga|enggak)\\s+apa[\\s-]?apa',
        // semua boleh / semua fasilitas boleh / semua oke
        '\\bsemua\\b(?:\\s+fasilitas)?\\s*(?:boleh|oke|ok|bagus)?\\b',
        // ikut aja / ngikut aja / nurut aja / manut
        '\\b(?:ngikut|ikut|nurut|manut)\\b',
        // tanpa preferensi / tidak ada preferensi (varian apa pun)
        '\\bpreferensi\\b',
        // standar apa aja
        'standar\\s+apa\\s*(?:saja|aja)',
      ].join('|'), 'i').test(custLo);
      const prev = Array.isArray(state.facilities) ? state.facilities : [];
      const hasStdMarker = prev.some(f => String(f).toLowerCase() === 'standar');

      if ((wantsStandardExplicit || noPreference) && !hasStdMarker) {
        // Sisipkan marker 'standar' di DEPAN agar summary tetap tahu ada permintaan
        // fasilitas standar, sambil mempertahankan item spesifik yang sudah tertangkap.
        state.facilities = ['standar', ...prev];
      }
      // Item spesifik lain sudah ditangkap Phase 1 detectFacilities di atas.
    }
    // Q5 — red flags
    // ⚠️ POLA INI HARUS MENCAKUP SEMUA VARIAN KALIMAT Q5 YANG BENAR-BENAR DIKIRIM AI.
    // Bug produksi (booking kantor Madiun, 20 Agu 2026): untuk tipe KOMERSIAL, Q5
    // dikirim dengan kalimat berbeda —
    //   "Ada syarat yang mutlak diperlukan atau yang tidak boleh ada untuk kantor ini?"
    // — yang TIDAK cocok satu pun pola di bawah. Akibatnya jawaban customer
    // ("Tidak boleh kotor aja") tidak pernah tersimpan, redFlags tetap null, dan
    // Q5 DIULANG TERUS (3× dalam satu percakapan, dengan tiga kalimat berbeda).
    // Kelas yang sama dengan M88 (kalimat Q2c tidak dikenali gerbangnya sendiri):
    // AI mengirim pertanyaan yang EKSTRAKTORNYA SENDIRI tidak kenali.
    // ⛔ Saat menambah/mengubah kalimat Q5 di findNextQuestion, WAJIB tambahkan
    // frasa pengenalnya ke sini juga — kalau tidak, jawabannya menguap.
    if (!state.redFlags && /pasti tidak cocok|ingin dihindari|yang\s+dihindari|tidak\s+boleh\s+ada|mutlak\s+diperlukan|syarat\s+yang\s+mutlak|hadap barat|gang sempit|rumah tua|rawan banjir|rel kereta/.test(aiText)) {
      // ⚠️ JAWABAN Q5 YANG SEBENARNYA PREFERENSI, BUKAN PENGHINDARAN (M89).
      // Kasus nyata (transkrip Versi 2, 8–10 Agu 2026): Q5 "Ada yang pasti
      // tidak cocok?" dijawab "Saya cari jalan yang strategis dan dekat dengan
      // mall dan rumah makan" — itu KEINGINAN, bukan hal yang dihindari. Dulu
      // kalimat mentahnya disimpan bulat-bulat sehingga summary mencetak
      // "✓ Red flags: Saya cari jalan yang strategis dan dekat dengan mall dan
      // rumah makan" — membalik makna slot, dan agent membaca daftar
      // "hindari" yang isinya justru hal yang DIINGINKAN customer.
      // Isi preferensinya sendiri TIDAK hilang: kalimat yang sama sudah
      // ditangkap sebagai patokan lokasi (Q6/anchorPoint) lewat "dekat …".
      const hasAvoidMarker = /\b(tidak|tdk|ga|gak|gk|nggak|ngga|enggak|jangan|hindari|dihindari|anti|bukan|tanpa|jauh\s+dari|hadap\s+barat|gang\s+sempit|rumah\s+tua|rawan|bising|banjir|macet|kumuh|panas|bau)\b/i.test(custResp);
      const looksLikeWant   = /\b(cari|mau|ingin|pengen|pingin|butuh|prefer|maunya|yang\s+penting|pokok(?:nya)?|dekat|deket|strategis)\b/i.test(custResp);
      if (!hasAvoidMarker && looksLikeWant) {
        // Q5 SUDAH ditanya & dijawab → JANGAN diulang; tapi nilainya jujur:
        // customer tidak menyebut satu pun hal yang dihindari.
        state.redFlags = 'Tidak ada';
        // ⚠️ TAPI PREFERENSINYA JANGAN DIBUANG (bug produksi villa Malang,
        // 18 Agu 2026). Komentar M89 di atas berasumsi "kalimat yang sama sudah
        // ditangkap sebagai patokan lokasi (Q6/anchorPoint) lewat 'dekat …'" —
        // asumsi itu GAGAL bila jawaban Q5 tidak memakai kata "dekat", atau bila
        // anchorPoint kemudian ditimpa jawaban Q6 yang sesungguhnya.
        // Kasus nyata: Q5 dijawab "Saya mau tempat yang dingin, udaranya bersih,
        // tempat sejuk, akses jalan strategis dengan tempat makanan" → redFlags
        // jadi "Tidak ada", anchorPoint lalu diisi jawaban Q6 ("Dekat Ijen"),
        // sehingga SELURUH preferensi customer lenyap dari summary: tidak ada
        // baris Hindari, tidak ada baris Prefer. Padahal itu satu-satunya
        // kalimat yang menjelaskan suasana yang ia inginkan.
        // Simpan mentahnya di slot sendiri supaya LLM bisa merender baris Prefer
        // (dan menurunkan lawan-negatifnya ke Hindari, lihat doc 04 §Q5).
        if (!state.preferences) state.preferences = custResp;
      } else {
        state.redFlags = custResp;
      }
    }
    // ⚠️ RED FLAG YANG DIBERIKAN SUKARELA (di luar giliran Q5) JUGA DICATAT.
    // Customer sering menyebut hal yang dihindari saat menjawab pertanyaan LAIN —
    // kasus nyata (5 Agu 2026): Q2b "sudah lihat berapa rumah?" dijawab
    // "Saya pingin cari rmh yg tdk banjir, tdk panas, tdk bau". Dulu kalimat itu
    // hanya masuk searchHistory, sehingga Q5 tetap ❓ dan baris "Hindari" HILANG
    // dari summary — padahal AI sempat mengakuinya di chat ("Berarti yang
    // dihindari: rawan banjir, area panas, bau"). Data yang sudah diberikan
    // customer tidak boleh hilang hanya karena urutan pertanyaan belum sampai (M75).
    // Syarat ketat: minimal DUA penanda penghindaran ("tidak X, tidak Y") atau
    // kata hindar/jangan eksplisit — supaya satu kata "tidak" biasa tidak ikut.
    if (!state.redFlags) {
      const avoidHits = (custResp.match(/\b(?:tidak|tdk|ga|gak|gk|nggak|ngga|enggak|jangan|hindari|anti|bukan|tanpa)\s+\S+/gi) || []).length;
      const explicitAvoid = /\b(hindari|dihindari|jangan|jauh\s+dari|anti)\b/i.test(custResp);
      if (avoidHits >= 2 || explicitAvoid) state.redFlags = custResp;
    }
    // Q12 — apartment preference (tower/lantai/orientasi)
    // Simpan bentuk RINGKAS, bukan kalimat mentah. Tanpa ini summary menulis
    // "✓ Tower/Lantai: Antara lantai 12-18 aja, Kak" — terbaca seperti bot
    // yang menyalin ulang kalimat customer, bukan mencatat datanya.
    if (!state.apartmentPref && /tower atau lantai|preferensi tower|lantai berapa/.test(aiText)) {
      state.apartmentPref = _normalizeAptPref(custResp) || custResp;
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

  // ── Q2 fallback: kota yang sudah dipakai AI dalam pertanyaannya sendiri ─────
  // Hanya pesan CUSTOMER yang dipindai untuk lokasi. Pada percakapan panjang,
  // pesan customer yang menyebut kota bisa berada jauh di belakang atau
  // terhapus oleh reset parsial, sehingga Q2 kembali ❓ — padahal AI sendiri
  // sudah berkali-kali menulis "Di Surabaya ada apartemen…" dan "di area mana
  // di Surabaya?". AI TIDAK PERNAH menyebut kota yang belum ditetapkan, jadi
  // menyebutnya adalah bukti sah bahwa Q2 sudah terjawab. Tanpa ini, AI
  // menanyakan "di kota mana?" tepat setelah ia sendiri menyebut kotanya —
  // pemicu utama customer merasa diputar-putar (3 Agu 2026).
  if (!state.city) {
    for (let i = ALL.length - 1; i >= 0; i--) {
      const m = ALL[i];
      if (!QS_AI_ROLES.has(m.role)) continue;
      const loc = detectLocation(String(m.message || ''));
      if (loc) { state.city = loc; break; }
    }
  }

  // ── Q2c fallback: area yang customer sebut SENDIRI, tanpa perlu dipasangkan ──
  // Deteksi berpasangan (AI-bertanya → jawaban BERIKUTNYA) melewatkan area yang
  // datang di pesan LAIN. Kasus nyata: AI bertanya "di kota ATAU area mana?",
  // customer menjawab "Kota Surabaya" (ditolak — hanya kota), lalu menyebut
  // "Area Sidotopo" di pesan TERPISAH yang tidak lagi berpasangan dengan
  // pertanyaan mana pun → area hilang, LLM menanyakan lokasi berulang kali.
  //
  // Customer Indonesia lazim menandai area secara eksplisit ("area X", "daerah
  // X", "kawasan X"), jadi tangkap penanda itu di mana pun ia muncul. Pesan
  // TERBARU menang supaya "Saya tetap pilih area Sidotopo saja" mengoreksi
  // tebakan sebelumnya.
  if (!state.district) {
    const AREA_RE = /\b(?:area|daerah|kawasan|wilayah|kecamatan|kelurahan)\s+([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*){0,2})/gi;
    for (const m of ALL) {
      if (!QS_CUST_ROLES.has(m.role)) continue;
      const txt = String(m.message || '');
      for (const hit of txt.matchAll(AREA_RE)) {
        const cand = _cleanDistrictAnswer(hit[1].trim());
        // Tolak kata pengisi ("lain", "sekitar") dan nilai yang cuma nama kota.
        if (!cand || cand.length < 3) continue;
        if (/^(lain|lainnya|sekitar|sekitarnya|mana|manapun|tertentu|itu|ini)$/i.test(cand)) continue;
        if (_isJustTheCity(cand, state.city)) continue;
        state.district = cand;   // pesan terbaru menimpa yang lama
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
      state.city         = null;
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
      // Skip entirely if the opener is a hedge ("kalau gak ada X, Y juga boleh") — an
      // ambiguous first message shouldn't commit to whichever type the priority chain
      // happens to match first.
      const cur = stripCommercialUsePhrases(stripMovingFromPhrases(stripAmbiguousRumah(stripNearPhrases((currentMessage || '').toLowerCase().trim()))));
      if (isConditionalFallbackMessage(currentMessage)) {
        // leave buildingType/transactionType null — nothing confirmed yet
      }
      else if (/\bkondotel\b|\bcondotel\b/.test(cur))                          state.buildingType = 'kondotel';
      else if (/\bmansion\b|\brumah\s+mewah\b/.test(cur))                    state.buildingType = 'mansion';
      else if (/\bvill?a\b/.test(cur))                                         state.buildingType = 'villa';
      else if (/\bapartemen\b|\bapartment\b/.test(cur))                        state.buildingType = 'apartment';
      else if (/\bhotel\b|\bpenginapan\b/.test(cur))                          state.buildingType = 'hotel';
      else if (/\bkos\b|\bkost\b|\bkosan\b|\bkostan\b|\bngekos\b|\bngekost\b|\bngekosan\b|\bindekos\b|\bindekost\b/.test(cur))           state.buildingType = 'boarding_house';
      else if (/\bruko\b|\brukan\b/.test(cur))                                state.buildingType = 'shophouse';
      else if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(cur))          state.buildingType = 'store';
      else if (/\bkantor\b|\boffice\b/.test(cur))                                        state.buildingType = 'office';
      else if (/\bgudang\b|\bwarehouse\b/.test(cur))                                        state.buildingType = 'warehouse';
      else if (/\brumah\b(?!\s+(?:makan|sakit|tangga|ibadah|duka|produksi|tahanan|susun|potong|kos))|\bhouse\b|\bkontrakan\b/.test(cur))                state.buildingType = 'house';
      else if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(cur)) state.buildingType = 'others';

      if      (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|kos|kost|kosan|kostan|ngekos|ngekost|ngekosan|indekos|indekost|rent|rental|lease|booking|book|pesan|reservasi)\b/.test(cur)) state.transactionType = 'rent';
      else if (/\b(beli|membeli|pembelian|dibeli|jual|dijual|buy|purchase|invest|investasi)\b/.test(cur))                               state.transactionType = 'sale';

      // ⚠️ Dulu baris ini memakai `CITY_RE` — konstanta 28-kota hardcoded yang SUDAH
      // DIHAPUS saat deteksi kota dipindahkan ke detectLocation() (lihat catatan di
      // Fase 0). Referensinya tertinggal di sini, sehingga SETIAP giliran yang masuk
      // cabang reset-pasca-summary melempar `ReferenceError: CITY_RE is not defined`
      // → extractQualificationState GAGAL → jalur LLM batal → sistem jatuh ke Private
      // Agent yang membalas template Q1 ("mau sewa atau beli? Dan tipe propertinya
      // apa?") BERULANG-ULANG walau customer sudah menyebut tipe & lokasi (M52).
      const curLoc = detectLocation(currentMessage || '');
      if (curLoc) state.city = curLoc;

      state.location = state.city;   // alias kompatibilitas (lihat return utama)
      return state;  // summary reset takes full priority — skip 3B
    }
  }

  // ── 3B: Mid-flow change detection (M124, diperluas M132) — GRANULAR per
  // owner spec, dengan SATU pengecualian compound ──────────────────────────
  // Uses P0_RESOLVED (Phase 0's canonical resolver) instead of re-detecting
  // type/tx/city here — one detector, not two copies drifting apart.
  //
  // Tiga axis independen (SATU axis berubah sendirian di pesan yang sama):
  //   GANTI KOTA        → re-ask landmark only. Transaction, property type,
  //                        move-in date, survey schedule, facilities all stay.
  //   GANTI TRANSAKSI   → re-ask budget (new tx's range) + payment method, and
  //                        (if now sewa) lease/booking duration. City, landmark,
  //                        move-in date, survey schedule, facilities stay.
  //   GANTI PROPERTI    → re-ask type-specific slots (budget, facilities, Q14
  //                        attributes, etc.). City, landmark, move-in date, and
  //                        survey schedule ALL stay — a property-type switch no
  //                        longer implies the customer also wants a new city.
  //
  // ⭐ M132 (23 Agu 2026, owner spec) — PENGECUALIAN: tipe DAN transaksi
  // berubah BERSAMAAN di pesan yang sama ("compound reset") dipandang sebagai
  // customer memulai pencarian baru, bukan sekadar dua axis independen yang
  // kebetulan berubah bareng — resetnya lebih luas daripada gabungan reset
  // per-axis di atas. TAPI "kembali ke Q1" di sini TIDAK berarti literally
  // menanyakan ulang transaksi/tipe — keduanya SUDAH terjawab justru di pesan
  // yang memicu ini, menanyakannya lagi persis pola repetitive/redundant yang
  // dilarang eksplisit. Yang direset adalah SELURUH field turunan tipe/
  // transaksi lama, sehingga findNextQuestion() lanjut dari Q2 dst. dengan
  // slate hampir bersih — kecuali item yang pemilik proyek eksplisit minta
  // dipertahankan (durasi sewa, tanggal masuk/beli, informasi survei — SELALU
  // dipertahankan; kota/area/red flag HANYA dipertahankan bila kota TIDAK ikut
  // berubah di pesan yang sama).
  {
    if (P0_RESOLVED.type) state.buildingType    = P0_RESOLVED.type;
    if (P0_RESOLVED.tx)   state.transactionType = P0_RESOLVED.tx;
    if (P0_RESOLVED.loc)  state.city            = P0_RESOLVED.loc;

    const typeChangedNow = P0_RESOLVED.typeChangedNow;
    const txChangedNow   = P0_RESOLVED.txChangedNow;
    const locChangedNow  = P0_RESOLVED.locChangedNow;
    const compoundReset  = typeChangedNow && txChangedNow;

    state.typeChangedFromHistory = state.typeChangedFromHistory || typeChangedNow;

    if (compoundReset) {
      const cityAlsoChanged = locChangedNow;
      state.cityChangedFromHistory = cityAlsoChanged;
      // M154: dipakai buildSwitchBanners() untuk memilih banner COMPOUND
      // (tipe+transaksi sekaligus) alih-alih dua banner axis-tunggal yang saling
      // bertumpuk dan membingungkan.
      state.txChangedFromHistory   = true;

      // Selalu dibuang saat tipe+transaksi berubah bersamaan — kombinasi
      // tipe×transaksi ini sepenuhnya baru, jadi budget/pembayaran/detail
      // per-tipe lama pasti sudah tidak relevan (owner spec, kedua kondisi).
      state.budget            = null;
      state.budgetRangeAsked  = false;
      state.financing         = null;
      state.kprDetails        = null;
      state.furnishing        = null;
      state.facilities        = null;
      state.apartmentPref     = null;
      state.propertyCondition = null;
      state.useCase           = null;
      state.household         = null;
      state.rentOutIntent     = false;
      state.fallbackTypes     = [];
      state.officeGrade       = null;
      state.officeFitOut      = null;
      state.searchHistory     = null;
      state.aiAskedQ2b        = false;

      if (cityAlsoChanged) {
        // Kondisi 1 (owner spec): tipe+transaksi+kota SEMUA berubah bareng —
        // area/landmark/red-flag lama terikat KOTA SEBELUMNYA, tidak lagi
        // relevan untuk kota yang baru. q2cDeclined dibiarkan false (bukan
        // di-set true) supaya Q2c benar-benar ditanya untuk kota baru — beda
        // dari ganti-kota tunggal, di sini bukan sekadar "kota lain, area
        // sekitar sama", tapi pencarian yang genuinely baru.
        state.district         = null;
        state.anchorPoint      = null;
        state.alternativeAreas = null;
        state.redFlags         = null;
        state.preferences      = null;
        state.q2cDeclined      = false;
      }
      // Kondisi 2 (owner spec, kota TIDAK ikut berubah): city/district/
      // anchorPoint/redFlags/preferences SENGAJA tidak disentuh sama sekali
      // di sini — owner spec eksplisit "masih pertahankan informasi lokasi
      // kota, lokasi area, lokasi yang menjadi red flag (Hindari, Prefer)".

      // Dipertahankan di KEDUA kondisi (owner spec eksplisit, tanpa syarat):
      // leaseDuration (durasi sewa), moveInDate/moveInDateAsk (kapan masuk/
      // beli), decisionMaker + viewingDate/viewingTime (informasi survei) —
      // TIDAK disentuh sama sekali di blok manapun di atas.
    } else {
      // ── SATU axis berubah sendirian (M124 asli, tidak berubah) ──────────
      const txChanged   = txChangedNow  && !typeChangedNow;
      // ⚠️ M132 fix: cityChanged TIDAK LAGI digerbangi `&& !typeChangedNow`.
      // Guard lama itu membuat district/anchorPoint/alternativeAreas GAGAL
      // di-reset ketika tipe DAN kota berubah bersamaan TANPA transaksi ikut
      // berubah (kombinasi yang tidak masuk compoundReset di atas) — data
      // lokasi lama tetap nyantol padahal kotanya sudah beda. typeChanged di
      // bawah tidak pernah menyentuh field lokasi, jadi tidak ada risiko
      // dobel-reset yang saling bertentangan.
      const cityChanged = locChangedNow;

      state.cityChangedFromHistory = cityChanged;
      // ⭐ M154: sinyal ganti-transaksi SEBELUMNYA TIDAK PERNAH DIEKSPOR.
      // txChanged mereset budget/financing/kprDetails/leaseDuration tapi tidak
      // meninggalkan jejak apa pun di state, sehingga tidak ada banner yang bisa
      // menjelaskannya ke LLM (ganti-kota dan ganti-tipe punya banner; transaksi
      // tidak). LLM hanya melihat budget & metode pembayaran tiba-tiba kembali ❓
      // tanpa sebab, menyimpulkan alur mengulang dari awal, lalu ikut menanyakan
      // ulang kota/landmark/tanggal yang masih ✅ — persis looping yang dikeluhkan.
      state.txChangedFromHistory = txChanged;

      if (txChanged) {
        // Ganti transaksi: budget & payment method depend on sewa vs. beli —
        // re-ask them. Duration only matters for sewa/booking; findNextQuestion
        // already gates the duration question on isSewa, so nulling it
        // unconditionally is harmless when the new tx is 'sale'.
        state.budget          = null;
        state.budgetRangeAsked = false;
        state.financing       = null;
        state.kprDetails      = null;
        state.leaseDuration   = null;
        // ⚠️ M163 (spec pemilik proyek, 28 Agu 2026, "Ganti transaksi" item 7):
        // "Fasilitas diperhatikan skill tipe transaksi atas tipe properti" —
        // fasilitas standar/prioritas untuk RUMAH DIJUAL (mis. carport, garasi)
        // tidak selalu sama relevansinya untuk RUMAH DISEWA jangka pendek (mis.
        // customer sewa 3 bulan biasanya tidak menaruh bobot yang sama pada
        // "kolam renang pribadi" seperti pembeli). Sebelumnya HANYA typeChangedNow
        // yang me-reset state.facilities — ganti transaksi SENDIRIAN (tipe
        // properti tetap) tidak menyentuhnya sama sekali, jadi fasilitas lama
        // ikut terbawa ke transaksi baru tanpa pernah ditinjau ulang.
        state.facilities      = null;
      }

      if (cityChanged) {
        // Ganti kota: only the landmark/area answers were anchored to the OLD
        // city. q2cDeclined suppresses a forced re-ask of the area/kawasan
        // question (Q2c) — the customer is free to volunteer a new one, but the
        // AI is only required to ask about the landmark (owner spec, item 1).
        state.district         = null;
        state.anchorPoint      = null;
        state.alternativeAreas = null;
        state.q2cDeclined      = true;
      }

      if (typeChangedNow) {
        state.budget            = null;
        state.household         = null;
        // ⚠️ M154: `redFlags` dan `leaseDuration` DIHAPUS dari daftar reset ini.
        //
        // Keduanya melanggar monotonisitas: cabang compoundReset di atas — yang
        // resetnya JAUH LEBIH LUAS (tipe DAN transaksi berubah sekaligus) —
        // secara eksplisit MEMPERTAHANKAN redFlags/preferences (bila kota tidak
        // ikut berubah) dan SELALU mempertahankan leaseDuration. Reset yang
        // lebih sempit tidak boleh membuang lebih banyak daripada reset yang
        // lebih luas; itu bukan keputusan bisnis, itu inkonsistensi.
        //
        // Secara makna juga salah:
        //   • redFlags/preferences terikat LOKASI ("hindari banjir", "jangan
        //     dekat kuburan", "mau yang sejuk") — bukan terikat tipe properti.
        //     Ganti-kota (axis yang memang mengubah lokasi) justru TIDAK
        //     mereset redFlags, jadi ganti-tipe mereset justru arah yang salah.
        //     Lebih buruk lagi: `preferences` tidak ikut di-null di sini, jadi
        //     summary tersisa separuh — "Prefer: sejuk" bertahan sementara
        //     "Hindari: banjir" hilang. M89b sengaja memisahkan dua baris itu
        //     karena maknanya berlawanan; membuang salah satunya saja membuat
        //     brief ke agent menyesatkan.
        //   • leaseDuration terikat TRANSAKSI, bukan tipe — spec pemilik proyek
        //     menaruh "tanyakan durasi sewa" di bawah GANTI TRANSAKSI item 8,
        //     dan daftar GANTI PROPERTI tidak menyebutnya sama sekali. Customer
        //     yang sudah bilang "sewa 1 tahun" lalu beralih apartemen→rumah
        //     tetap menyewa 1 tahun; menanyakannya lagi = pertanyaan berulang.
        state.furnishing        = null;
        state.facilities        = null;
        state.apartmentPref     = null;
        state.financing         = null;
        state.kprDetails        = null;
        state.propertyCondition = null;
        state.useCase           = null;
        state.rentOutIntent     = false;
        state.fallbackTypes     = [];
        state.officeGrade       = null;
        state.officeFitOut      = null;
        // ⚠️ M132 fix: decisionMaker DIHAPUS dari daftar reset ini — owner
        // spec "Ganti properti" item 6 eksplisit "Survei masih dengan nilai
        // sama (jadwal survei/katalog)". decisionMaker (Q9, siapa yang
        // memutuskan/mendampingi survei) adalah bagian dari informasi survei
        // itu, sama seperti viewingDate/viewingTime yang SUDAH TIDAK di-reset
        // di sini sejak M124 — sebelumnya hanya decisionMaker yang tertinggal
        // ikut ter-null, sebuah inkonsistensi murni, bukan keputusan sengaja.
        //
        // City, district, anchorPoint, alternativeAreas, moveInDate,
        // moveInDateAsk, viewingDate, viewingTime, decisionMaker deliberately
        // NOT reset here — owner spec: property-type change keeps
        // city/landmark/move-in/survey.
      }
    }
  }

  // Alias kompatibilitas — kode & tes lama masih membaca `location`.
  // `city` adalah nama KANONIK; jangan menulis ke `location` di mana pun.
  state.location = state.city;

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
  if (/kantor/.test(w))                   return 'office';
  if (/gudang/.test(w))                return 'warehouse';
  if (/rumah|house|kontrakan/.test(w))           return 'house';
  if (/tanah|kavling|lahan|spbu|pabrik/.test(w)) return 'others';
  return null;
}

/**
 * Determine the next question the AI should ask based on qualification state.
 * Returns { q, hint } or null when all mandatory questions are answered.
 */
function findNextQuestion(state) {
  // Terima `city` (kanonik) MAUPUN `location` (alias lama) — pemanggil lama
  // dan fixture tes masih memakai `location`. Dinormalkan sekali di sini agar
  // sisa fungsi cukup membaca satu nama saja.
  if (state && !state.city && state.location) state = { ...state, city: state.location };

  const tx   = (state.transactionType || '').toLowerCase();
  const type = (state.buildingType    || '').toLowerCase();
  const loc  = state.city ? `*${state.city}*` : '*[area]*';
  const typeLbl = state.buildingType || '[tipe]';
  const _humanType = {
    house: 'Rumah', apartment: 'Apartemen', villa: 'Villa', hotel: 'Hotel',
    boarding_house: 'Kos', shophouse: 'Ruko', office: 'Kantor', warehouse: 'Gudang',
    store: 'Toko', mansion: 'Mansion', kondotel: 'Kondotel', others: 'Properti',
  };
  const isSewa  = tx.includes('sewa') || tx.includes('rent');
  const isApt   = type === 'apartment';
  const isBooking = (type === 'hotel' || type === 'kondotel') && isSewa;
  // Menginap jangka pendek — TIDAK sama dengan isBooking. isBooking mengubah
  // ALUR (melewati Q2c/Q2b dan hanya berlaku untuk hotel/kondotel); isShortStay
  // hanya mengubah NADA satu pertanyaan, sehingga aman dipakai untuk tipe apa
  // pun tanpa menggeser urutan Q (pelajaran M69: menyisipkan/menggeser
  // pertanyaan memutus alur lain).
  const isShortStay = isBooking || state.bookingIntent === true ||
    /\b\d+\s*(hari|malam|day|night)/i.test(String(state.leaseDuration || ''));
  const isCommercial = ['shophouse', 'office', 'warehouse', 'store'].includes(type);
  const isLuxury = type === 'mansion';

  // Q1 — tipe transaksi + building type (keduanya wajib)
  if (!state.transactionType || !state.buildingType)
    return { q: 'Q1', hint: 'Tanyakan: mau sewa atau beli? Dan tipe propertinya apa? (rumah, apartemen, villa, hotel, kos, ruko, kantor, gudang, toko, mansion, kondotel, dll) 🏠' };

  // Q2 — Lokasi (per-type context)
  if (!state.city) {
    if (isBooking) {
      const tipeLabel = type === 'hotel' ? 'Hotel' : 'Kondotel';
      return { q: 'Q2', hint: `Siap, *booking ${tipeLabel}*! 📍 Di *kota* mana? (Contoh: Surabaya, Malang, Bali)
Kalau sudah ada area/kecamatan tertentu, boleh sekalian disebut ya.` };
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
    return { q: 'Q2', hint: `Oke, mau ${tx} *${typeLbl}*. 📍 Di *kota* mana yang Anda pertimbangkan? (Contoh: Surabaya, Malang, Bali)` };
  }

  // Q2c — Area/district DI DALAM kota (SEBELUM Q2b — mempersempit area pencarian)
  //
  // ⚠️ DULU digerbangi allowlist 8 kota (LARGE_CITIES_Q2C). Kota di luar daftar
  // itu — termasuk MALANG — TIDAK PERNAH ditanya areanya, sehingga
  // `state.district` permanen null. Akibat berantainya fatal (M84): Q7 lalu
  // memakai template berjangkar area, skill doc melarang jangkar KOTA, dan LLM
  // yang tidak punya area asli MENGARANG satu ("Selain area *Ciputra*…" untuk
  // Malang — nama developer Surabaya yang banyak muncul di playbook
  // Real-Estate/). Nilai karangan itu lalu tersalin ke summary.
  //
  // Sumber kebenaran area kini `utils/locationLandmarks.js` (45 kota) — file
  // yang memang sudah ada untuk keperluan ini dan sudah dipakai Private Agent.
  // Kota yang tidak ada di map tetap ditanya, hanya dengan contoh generik:
  // lebih baik bertanya daripada membiarkan slot kosong yang mengundang karangan.
  /* ═══════════════════════════════════════════════════════════════════════════
     ⭐ M162 — SLOT MINIMUM KE-4 = "LOKASI SPESIFIK", BUKAN "district"
     ───────────────────────────────────────────────────────────────────────────
     `utils/listingReadiness.js` (M134) sudah menyatakan slot ke-4 terisi bila
     SALAH SATU dari district / area / landmark ada. Gerbang Q2c di bawah dulu
     hanya melihat `state.district`, sehingga dua bug nyata muncul sekaligus:

     (1) PERTANYAAN BERULANG. Customer bilang "sewa rumah di Surabaya dekat
         Bandara Juanda" → anchorPoint terisi, district null → AI tetap bertanya
         "Di area atau kawasan mana di Surabaya?" untuk lokasi yang BARU SAJA
         disebut. Private Agent (ConversationQualifier.getNextQuestion) sudah
         benar sejak lama — ia menggerbangi Q2c dengan `!profile.hasAnchorPoint`.
         Jalur LLM-lah yang tertinggal, jadi ini penyeragaman, bukan aturan baru.

     (2) GERBANG SHOW_LISTINGS (M140) TIDAK PERNAH TERCAPAI pada kasus itu.
         Gerbangnya ada di BAWAH blok ini dan syaratnya memakai
         `district || anchorPoint || landmark` — tapi `return` Q2c di sini
         mendahuluinya. Kelas bug yang sama dengan "terminology gate before
         qual gate": aturan yang benar, ditaruh di belakang `return` yang salah.

     ⛔ JANGAN kembalikan gerbang ini ke `!state.district`. Bila slot ke-4
     berubah definisinya, ubah di utils/listingReadiness.js — SATU sumber.
  ═══════════════════════════════════════════════════════════════════════════ */
  const hasSpecificLocation = Boolean(state.district || state.anchorPoint || state.landmark);

  /** Pertanyaan patokan lokasi (Q6). Dipakai DUA kali (prioritas ganti-kota di
   *  sini, dan posisi normalnya di cascade bawah) — satu sumber teks, supaya
   *  tidak lahir salinan ketiga yang bisa menyimpang. */
  const _anchorQuestion = () => {
    if (isCommercial)
      return { q: 'Q6', hint: `Ada lokasi atau kawasan tertentu yang jadi prioritas? Misalnya dekat kawasan industri, pelabuhan, atau pusat bisnis? 📍` };
    if (state.city && state.city.toLowerCase().includes('surabaya'))
      return { q: 'Q6', hint: 'Ada lokasi atau tempat tertentu yang jadi patokan? Misalnya dekat Grand City, Pakuwon, KBS, wisata mangrove, sekolah anak, atau jalan tertentu? 📍' };
    return { q: 'Q6', hint: 'Ada lokasi atau tempat tertentu yang jadi patokan? Misalnya dekat sekolah anak, mal, wisata, kawasan tertentu, atau jalan tertentu? 📍' };
  };

  // Q2c — Area/district DI DALAM kota (SEBELUM Q2b — mempersempit area pencarian)
  if (!hasSpecificLocation && !state.q2cDeclined && state.city && !isBooking && !isCommercial) {
    /* ⭐ M170 — CONTOH AREA HARUS DARI KATALOG AGENT, BUKAN DAFTAR STATIS.
     *
     * Ini bug Madiun (M164) SATU TINGKAT DI BAWAHNYA. M164 menutup kasus
     * "kotanya tidak ada di katalog". Yang tersisa: kota BENAR-BENAR ada, tapi
     * contoh AREA-nya tetap diambil dari utils/locationLandmarks.js — daftar
     * statis 45 kota yang sama sekali tidak tahu stok agent.
     *
     * Terukur untuk agent uji (29 Agu 2026, Surabaya):
     *   disarankan (statis) : Pakuwon, Darmo, Rungkut, Gubeng
     *   dimiliki  (katalog) : Dukuh Pakis, Waterplace, Mulyorejo, Pakuwon City,
     *                         Citraland, MERR
     * Hanya Citraland yang beririsan. Jadi AI mengundang customer ke Darmo /
     * Rungkut / Gubeng — NOL listing di ketiganya — lalu meminta maaf. Persis
     * pola keluhan pemilik proyek: "AI dilarang menebak, langsung cek isi
     * database... area tidak boleh hardcode."
     *
     * `state.agentAreas` diisi pemanggil yang punya agentUserId dan boleh
     * async (whatsappAIService). Daftar statis TETAP dipakai sebagai cadangan
     * ketika coverage belum termuat — bertanya dengan contoh generik masih
     * jauh lebih baik daripada slot kosong yang mengundang karangan (M84).
     *
     * Maksimal 3 contoh, sesuai spec pemilik proyek ("max tampilkan 3").
     */
    const realAreas = Array.isArray(state.agentAreas) ? state.agentAreas.filter(Boolean) : [];
    const areas = realAreas.length ? realAreas : getCityLandmarks(state.city);
    const areaEx = areas && areas.length
      ? `Misalnya ${areas.slice(0, 3).join(', ')}, atau area lainnya?`
      : 'Misalnya pusat kota, area selatan, atau kawasan tertentu?';
    return { q: 'Q2c', hint: `Di area atau kawasan mana di ${loc} yang Anda pertimbangkan? 📍 ${areaEx}` };
  }

  /* ⭐ M162b — Q2c TERTUTUP tapi slot ke-4 MASIH KOSONG → tanyakan PATOKAN.
   *
   * `q2cDeclined` menyala pada dua keadaan, dan KEDUANYA berakhir sama: satu-
   * satunya jalan tersisa untuk mengisi slot lokasi spesifik adalah Q6.
   *   • GANTI KOTA (M124) — spec pemilik proyek item 1 harfiah: "Tanyakan ulang
   *     lokasi landmark saja."
   *   • Customer menolak pertanyaan area ("bebas", "terserah") — M84.
   *
   * SEBELUM perbaikan ini, kedua keadaan itu jatuh ke cascade biasa dan
   * pertanyaan berikutnya menjadi Q2b ("sudah lihat berapa rumah di Malang?"),
   * lalu Q3 budget, Q8 tanggal, Q4 penghuni, Q5 red flag — LIMA pertanyaan
   * interview sebelum Q6 akhirnya ditanya di posisi normalnya. Persis keluhan
   * "AI lose & forget konteks" setelah ganti kota: informasi yang justru
   * dibuang oleh ganti-kota (patokan kota lama) tidak pernah segera digali
   * ulang, sementara pertanyaan yang TIDAK relevan dengan perubahan itu
   * diajukan lebih dulu.
   */
  if (!hasSpecificLocation && state.q2cDeclined && state.city && !isBooking && !isCommercial)
    return _anchorQuestion();

  /* ═══════════════════════════════════════════════════════════════════════════
     ⭐ M140 — GERBANG "TAMPILKAN LISTING DULU" (mengalahkan sisa interview)
     ───────────────────────────────────────────────────────────────────────────
     Directive pemilik proyek (25 Agu 2026), dari transkrip produksi NYATA:
     customer bilang "Mau cari rumah di Citraland Surabaya" lalu "Rencana beli"
     — tipe + transaksi + kota + area SUDAH lengkap — tapi AI malah lanjut
     bertanya Q2b (sudah lihat berapa), Q3 (budget), Q8 (target waktu), Q4
     (penghuni). Customer sampai memohon "Ada listing nya? Saya minta" dan TETAP
     ditanya lagi. "Ini dilarang keras, karena customer tidak suka interview."

     ⛔ KENAPA PERBAIKAN DOKUMEN SAJA (M139) TIDAK CUKUP: fungsi INI yang
     menyuntikkan "pertanyaan berikutnya" ke DIREKTIF FINAL prompt (posisi 100%,
     M62). Direktif bernomor itu MENGALAHKAN aturan di SKILL.md — persis
     pelajaran lama "prompt outranks skill docs". Selama findNextQuestion masih
     mengembalikan Q2b di sini, LLM akan menanyakan Q2b apa pun isi SKILL.md.
     Jadi gerbangnya HARUS ada di kode, bukan cuma di dokumen.

     Syarat minimum SAMA dengan utils/listingReadiness.js (M134): tipe +
     transaksi + kota + lokasi spesifik. Budget SENGAJA tidak termasuk.
     Lokasi spesifik boleh dari district (area), anchorPoint (patokan), atau
     landmark — ketiganya sah, sejalan evaluateListingReadiness().

     Menyala HANYA sekali: begitu listing sudah pernah tampil
     (state.listingsShown), cascade lanjut seperti biasa untuk melengkapi brief.
     Tanpa syarat itu, alur akan mandek menampilkan listing selamanya.
  ═══════════════════════════════════════════════════════════════════════════ */
  {
    // `hasSpecificLocation` dihitung SEKALI di atas (M162) — gerbang Q2c dan
    // gerbang ini WAJIB memakai definisi slot ke-4 yang sama persis. Dulu hanya
    // gerbang ini yang benar, dan `return` Q2c di atasnya membuatnya tak
    // tercapai untuk customer yang menyebut patokan tanpa nama area.
    const minimumMet = Boolean(state.transactionType && state.buildingType && state.city && hasSpecificLocation);
    // ⚠️ `=== false`, BUKAN `!state.listingsShown`. listingsShown hanya PASTI
    // benar saat state datang dari extractQualificationState() (produksi
    // sesungguhnya). Puluhan tes lama di file ini memanggil findNextQuestion()
    // LANGSUNG dengan object state buatan tangan untuk menguji cabang lain
    // (officeGrade, budget follow-up, dst.) — di situ listingsShown selalu
    // `undefined`. Memakai `!state.listingsShown` membuat gerbang ini
    // membajak SEMUA tes itu (regresi nyata, ditemukan lewat full suite run).
    // `undefined` diperlakukan sebagai "anggap sudah tampil" — aman karena
    // jalur produksi SELALU eksplisit true/false, tidak pernah undefined.
    //
    // ⚠️ KEDUA: gerbang HANYA boleh menyala pada giliran PERTAMA syarat
    // minimum terpenuhi — bukan tiap kali dipanggil ulang. Deteksi
    // listingsShown via regex pada teks AI (baris bernomor + harga) rapuh
    // untuk banyak transkrip sintetis yang sengaja pendek (mis. tes
    // bookingShortStayVersi2: Q2b SUDAH ditanya, budget SUDAH dijawab, tapi
    // tidak ada baris "1. ... Rp ..." tertulis literal). Tanda yang JAUH
    // lebih andal bahwa percakapan sudah melewati titik "baru sampai info
    // minimum": salah satu pertanyaan SETELAH gerbang ini (Q2b/Q2b-riwayat/
    // budget) sudah pernah dijawab. Bila SALAH SATU dari itu sudah terisi,
    // percakapan sudah maju melewati titik ini — jangan mundur memaksa
    // listing di tengah alur yang sudah berjalan.
    const pastThisPoint = Boolean(state.aiAskedQ2b || state.searchHistory || state.budget);
    if (minimumMet && state.listingsShown === false && !pastThisPoint) {
      const humanType = _humanType[type] || 'properti';
      // ⚠️ M162: jawaban NEGATIF/FLEKSIBEL ("bebas", "terserah", "tidak ada")
      // sah mengisi slot lokasi (M84: penolakan = jawaban) tapi TIDAK boleh
      // dipakai sebagai NAMA TEMPAT — tanpa guard ini direktifnya berbunyi
      // "tampilkan listing di bebas, Surabaya" dan LLM meneruskan kalimat itu
      // apa adanya ke customer. Bila lokasi spesifiknya cuma penolakan, jangkar
      // pencariannya kembali ke KOTA (yang selalu valid di titik ini).
      const _placeless = /^(bebas|terserah|tidak\s*ada|tdk\s*ada|ga(k)?\s*ada|nggak\s*ada|belum\s*tahu|belum\s*tau|blm\s*tau|mana\s*saja|apa\s*saja|semua|manapun|fleksibel|flexible)\b/i;
      const _specific  = [state.district, state.anchorPoint, state.landmark]
        .find((v) => v && !_placeless.test(String(v).trim()));
      const where = _specific || state.city;
      return {
        q: 'SHOW_LISTINGS',
        hint: `SYARAT MINIMUM SUDAH TERPENUHI (tipe + transaksi + kota + lokasi). `
            + `JANGAN bertanya apa pun lagi giliran ini — TAMPILKAN 2 listing ${humanType} `
            + `${isSewa ? 'sewa' : 'beli'} di ${where}, ${state.city} dari KATALOG NYATA AGENT INI, `
            + `lalu tanya singkat apakah ada yang menarik. Bila katalog untuk kriteria itu KOSONG: `
            + `katakan terus terang lalu tawarkan alternatif yang BENAR-BENAR ada di katalog agent `
            + `(kota sama lebih dulu) — jangan mengarang listing dan jangan balik meng-interview. `
            + `Budget/penghuni/tanggal TIDAK perlu ditanya sebelum listing tampil.`,
      };
    }
  }

  // Q2b — Riwayat pencarian (kecuali untuk booking hotel/kondotel dan properti komersial)
  if (!state.searchHistory && !state.aiAskedQ2b && !isBooking) {
    const humanType = _humanType[type] || 'properti';
    return { q: 'Q2b', hint: `Sudah lihat berapa ${humanType} di ${loc}? Apa yang membuat belum cocok dari yang sudah dilihat?` };
  }

  // Q3 — Budget (via 2 harga kontras — JANGAN tanya langsung)
  if (!state.budget)
    return { q: 'Q3', hint: `Di ${loc} ada *${typeLbl}* kisaran [harga rendah${isBooking ? '/malam' : ''}] dan [harga tinggi${isBooking ? '/malam' : ''}]. Kira-kira yang mana lebih sesuai? 💰` };

  // Q3a — Follow-up SEKALI SAJA saat Q3 hanya terisi KATEGORI ("terjangkau/affordable")
  // TANPA angka sama sekali. Bug nyata (5 Agu 2026, Jakarta beli-rumah): customer
  // menjawab "Cari yang harga terjangkau" SEBELUM AI sempat menawarkan 2 harga
  // kontras (Q3 preempted) → state.budget = 'terjangkau/affordable', tidak pernah
  // ada Rupiah sama sekali → summary akhir "✓ Budget: Terjangkau" tanpa angka,
  // tidak berguna untuk agent mencocokkan listing. Server hanya bisa mendeteksi
  // KATEGORI dari kata "terjangkau/murah/mahal" — TIDAK PERNAH menyimpan angka
  // aktual yang AI tawarkan (anchor 2-harga hanya menyimpan arah, bukan nominal),
  // jadi baik jalur "customer mendahului" MAUPUN "customer menerima salah satu
  // dari 2 opsi" sama-sama berakhir tanpa angka. Follow-up ini menutup celah itu
  // dengan SATU pertanyaan tambahan, lalu diterima apa pun jawabannya (termasuk
  // tetap vague) — tidak pernah diulang dua kali.
  if (/^(terjangkau|affordable|murah|eksklusif|premium|mahal)(\/[a-z]+)?$/i.test(state.budget || '') && !state.budgetRangeAsked)
    return { q: 'Q3a', hint: `Baik, Kak! Kira-kira di kisaran berapa ya budgetnya? Misalnya "900jt-2 miliar", "700-900 juta", atau "300rb-2jt${isBooking ? '/malam' : ''}" 💰` };

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

  // Q6 — Patokan lokasi (include wisata, kawasan, dan landmark named examples).
  // Teks pertanyaannya dibagi dengan gerbang prioritas M162b di atas lewat
  // `_anchorQuestion()` — JANGAN menuliskannya ulang di sini.
  if (!state.anchorPoint) return _anchorQuestion();

  // Q7 — Area alternatif (AREA lain DI DALAM kota yang sama, BUKAN kota lain).
  // ⚠️ Kota sudah ditetapkan di Q2 dan TIDAK ditawar ulang di sini. Bertanya
  // "Selain Surabaya, area sekitar yang masih oke?" terbaca seperti menawarkan
  // PINDAH KOTA — padahal yang dimaksud adalah kecamatan/kawasan lain di dalam
  // Surabaya. Bila area (Q2c) sudah diketahui, jadikan AREA itu jangkarnya
  // ("Selain area Pakuwon, apakah area sekitar masih oke?"). Kota hanya dipakai
  // sebagai jangkar bila customer belum menyebut area sama sekali (M76).
  if (!state.alternativeAreas) {
    const anchor = state.district ? `area *${state.district}*` : loc;
    return { q: 'Q7', hint: `Selain ${anchor}, apakah area sekitar masih oke? 🗺️` };
  }

  // Q9 — Decision maker
  if (!state.decisionMaker)
    return { q: 'Q9', hint: 'Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?' };

  // Q10 — Durasi sewa (sewa only, skip hotel/kondotel/villa booking — durasi = malam/minggu)
  if (isSewa && !isBooking && !state.leaseDuration)
    // Nada pertanyaan mengikuti KONTEKS: menginap 5 hari ≠ sewa tahunan (M89).
    return isShortStay
      ? { q: 'Q10', hint: 'Rencananya menginap berapa lama? ⏱️ (durasi, bukan tanggal — contoh: 3 malam, 5 hari, 1 minggu)' }
      : { q: 'Q10', hint: 'Rencananya sewa untuk berapa lama? ⏱️ (durasi, bukan tanggal — contoh: 6 bulan, 1 tahun)' };

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
  if (type === 'office') {
    // ⚠️ Grade & fit-out DIBANGUN DINAMIS dari state (M122), bukan teks tetap.
    // Sebelumnya hint SELALU menyebut "(b) Grade A/B/C?" apa pun keadaannya —
    // LLM diberi instruksi "tanyakan grade" pada SETIAP giliran, bahkan pada
    // giliran yang sudah punya `state.officeGrade` terisi. Instruksi yang
    // bertentangan dengan fakta yang baru saja dikonfirmasi sendiri adalah
    // persis yang membuat AI mengulang "Grade A/B/C?" lima kali di transkrip
    // 19-20 Agu 2026 walau customer sudah menjawab "Grade C" sejak awal.
    const gradeItem = state.officeGrade
      ? `✅ Grade gedung SUDAH DIJAWAB: ${state.officeGrade} — JANGAN TANYA LAGI.`
      : 'Grade A/B/C?';
    const fitOutItem = state.officeFitOut
      ? `✅ Fit-out/shell SUDAH DIJAWAB: ${state.officeFitOut} — JANGAN TANYA LAGI.`
      : 'fit-out atau shell & core?';
    if (isSewa) {
      return { q: 'Q14', hint: `Lanjutkan Q14 kantor sewa: (a) tim berapa orang? (infer luas 5-7 m²/orang) (b) ${gradeItem} (c) ${fitOutItem} (d) klarifikasi budget all-in service charge! (e) parkir & kebutuhan IT? — CEK history dulu.` };
    }
    return { q: 'Q14', hint: `Lanjutkan Q14 kantor beli: (a) dipakai perusahaan sendiri atau investasi disewakan? (b) tim berapa orang? (c) ${gradeItem} (d) ${fitOutItem} (e) cek SHMSRS/strata title + service charge! — CEK history dulu.` };
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


  // Q_FAC — Fasilitas. WAJIB ditanya; dulu TIDAK ADA sama sekali di urutan ini,
  // sehingga summary keluar tanpa pernah menanyakan fasilitas (3 Agu 2026).
  // Jawaban "terserah/standar/semua" tetap sah → isi dengan fasilitas standar
  // per tipe properti (lihat utils/standardFacilities.js & skill doc 12).
  if (!state.facilities)
    return { q: 'Q_FAC', hint: `Ada fasilitas yang wajib ada untuk ${typeLbl === 'apartment' ? 'apartemen' : typeLbl}-nya? Misalnya AC, kolam renang, gym, parkir, atau kitchen set. Kalau tidak ada preferensi khusus, boleh jawab "standar saja" 🛠️` };

  // Q9b / Q9c — JADWAL SURVEI. Juga belum pernah ada di urutan ini.
  // Aturan: TANGGAL dulu, baru JAM. Customer boleh menolak survei — penolakan
  // adalah jawaban yang sah dan dicatat sebagai "Minta listing".
  if (!state.viewingDate)
    return { q: 'Q9b', hint: 'Kalau mau lihat unitnya langsung, enaknya tanggal berapa? 📅 (kalau belum mau survei dulu, boleh balas "lihat listing saja")' };
  if (state.viewingDate !== 'Minta listing' && !state.viewingTime)
    return { q: 'Q9c', hint: `Siap, ${state.viewingDate} ya 📅 Kira-kira jam berapa yang paling pas? ⏰ (contoh: jam 10 pagi, 1 siang, 4 sore)` };

  return null; // all answered → show summary
}

/**
 * Format qualification state as a readable checklist block for AI injection.
 * Green = answered (AI must NOT re-ask). Red = unanswered (AI should ask next).
 *
 * @param {object} state - From extractQualificationState()
 * @returns {string}
 */
/**
 * Field WAJIB yang masih kosong — sumber tunggal untuk "boleh tampilkan summary?".
 *
 * Dipakai DUA tempat yang harus selalu sepakat:
 *   1. `buildQualificationStateBlock()` → banner "🚫 SUMMARY DIBLOKIR".
 *   2. `buildWhatsappReplyPrompt()`     → menyembunyikan TEMPLATE BRIEF selama
 *      masih ada field wajib kosong (lihat catatan di sana).
 * Dulu daftar ini hanya hidup di dalam (1); (2) tidak punya cara mengetahuinya.
 *
 * @param {object} state hasil extractQualificationState()
 * @returns {string[]} label field wajib yang belum terisi (kosong = summary boleh)
 */
function listMissingMandatory(state = {}) {
  // ⭐ EMPAT SLOT INTI SAJA (arahan pemilik proyek, 2 Sep 2026 — transkrip nyata).
  // DULU delapan field memblokir summary (budget, fasilitas, red flags, jadwal
  // survei, tanggal masuk, pembiayaan). Akibatnya summary tidak pernah boleh
  // keluar sampai SEMUANYA terisi, sehingga AI terpaksa terus meng-interview —
  // persis keluhan yang merusak reputasi di transkrip 2 Sep: customer minta
  // listing 3x, menolak survei, bilang "saya tanya saja dulu", dan AI tetap
  // menembak "cash atau KPR?" lalu "DP berapa persen?" karena slot itu WAJIB.
  //
  // Sekarang: hanya transaksi + tipe + kota + AREA yang menahan summary. Sisanya
  // BEST-EFFORT — boleh ditanya kalau percakapan mengalir ke sana, tapi TIDAK
  // PERNAH jadi alasan menahan summary atau memaksa pertanyaan berikutnya.
  //
  // ⚠️ AREA kini WAJIB (dulu opsional): tanpa area, katalog tidak bisa disaring
  // ke listing yang benar-benar relevan — itu sumber bug "customer minta
  // Citraland/Pakuwon tapi dikirimi MERR/Wiyung".
  const missing = [];
  if (!state.transactionType)                    missing.push('Q1 Tipe transaksi');
  if (!state.buildingType)                       missing.push('Tipe properti');
  if (!state.city)                               missing.push('Q2 Lokasi KOTA');
  if (!state.district && !state.anchorPoint)     missing.push('Q2c Area/kawasan');
  return missing;
}

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

  // ══ PROTOKOL PEMULIHAN — CUSTOMER JENGKEL (prioritas TERTINGGI) ═════════════
  // Ditempatkan PALING ATAS supaya dibaca sebelum instruksi "tanyakan Q berikutnya".
  // Tanpa blok ini, AI membalas keluhan dengan template off-topic ("saya asisten
  // khusus properti") atau tetap mengulang pertanyaan — keduanya memperburuk (M51).
  if (state.customerFrustrated) {
    const answered = [
      ['Transaksi',      state.transactionType],
      ['Tipe',           state.buildingType],
      ['Kota',           state.city],
      ['Budget',         state.budget],
      ['Tanggal masuk',  state.moveInDate],
      ['Penghuni',       state.household],
      ['Hindari',        state.redFlags],
      ['Patokan lokasi', state.anchorPoint],
      ['Durasi',         state.leaseDuration],
    ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);

    lines.push('🚨🚨🚨 CUSTOMER SEDANG JENGKEL / KESAL — TANGANI INI DULU 🚨🚨🚨');
    lines.push(state.frustrationKind === 'repetition'
      ? '   Sebab: customer merasa DITANYA HAL YANG SUDAH IA JAWAB.'
      : state.frustrationKind === 'ignored'
        ? '   Sebab: customer merasa pesannya TIDAK DIBACA / tidak didengarkan.'
        : '   Sebab: customer kesal / kecewa pada alur percakapan.');
    lines.push('');
    lines.push('   WAJIB dilakukan pada balasan ini — URUTAN PERSIS:');
    lines.push('   1. MINTA MAAF dengan tulus & singkat (1 kalimat). Jangan defensif,');
    lines.push('      jangan menyalahkan customer, JANGAN memakai emoji tertawa (😄/😅/hehe).');
    lines.push('   2. BUKTIKAN sudah menyimak — rekap ulang data yang SUDAH tercatat:');
    if (answered.length) {
      answered.forEach(a => lines.push(`        • ${a}`));
    } else {
      lines.push('        (belum ada data tercatat — cukup minta maaf & tanya ulang 1 hal saja)');
    }
    lines.push('   3. ⛔ DILARANG KERAS mengulang pertanyaan apa pun yang sudah ✅ di bawah.');
    lines.push('      Termasuk pertanyaan yang jawabannya PENOLAKAN ("tidak ada", "cukup di X saja").');
    lines.push('      Menolak = SUDAH MENJAWAB. Mengulang dengan kalimat lain = tetap mengulang.');
    lines.push('   4. Lanjut HANYA ke field ❓ berikutnya, atau bila semua wajib sudah ✅ →');
    lines.push('      langsung tampilkan SUMMARY (jangan menahan-nahan lagi).');
    lines.push('   4b. ⛔ Jika customer MINTA KATALOG/LISTING ("mana katalognya", "kasih');
    lines.push('      listingnya", "langsung lihat unit saja") → BERIKAN. Jangan tanya apa pun');
    lines.push('      dulu. Data yang ada sudah cukup untuk menampilkan pilihan awal;');
    lines.push('      kekurangan detail bisa digali SETELAH customer melihat opsi.');
    lines.push('   5. ⛔ DILARANG memakai template off-topic ("saya asisten khusus properti").');
    lines.push('      Keluhan tentang alur kualifikasi adalah topik PROPERTI yang sah.');
    lines.push('   6. Nada: tenang, hangat, dewasa, solutif. Akui kesalahan sistem, bukan customer.');
    lines.push('');
  }

  // Summary-already-shown banner — customer is starting a brand-new search
  if (state.summaryAlreadyShown) {
    lines.push('⚠️  SUMMARY SUDAH DIKIRIM — Customer memulai pencarian baru.');
    lines.push('   Lihat ⚡ PERTANYAAN BERIKUTNYA di bawah — tanyakan field ❓ terkecil.');
    lines.push('   JANGAN tampilkan summary lagi sampai semua Q wajib ✅ di sesi ini.');
    lines.push('   JANGAN gunakan jawaban dari sesi lama (history sebelum summary).');
    lines.push('');
  }

  // ── Banner PERUBAHAN KONTEKS (M154) ───────────────────────────────────────
  // Dulu ditulis inline di sini: hanya dua banner (KOTA & TIPE), tanpa banner
  // TRANSAKSI sama sekali, dan daftar "yang tetap dipakai" ditulis manual
  // sehingga sudah menyimpang dari field yang benar-benar direset di
  // extractQualificationState(). Sekarang teksnya dibangun dari tabel spec yang
  // SAMA dengan yang dipakai ekstraktor filter — satu kontrak, satu tempat.
  // Lihat utils/contextSwitchPolicy.js.
  lines.push(...buildSwitchBanners({
    cityChanged    : !!state.cityChangedFromHistory,
    txChanged      : !!state.txChangedFromHistory,
    typeChanged    : !!state.typeChangedFromHistory,
    transactionType: state.transactionType,
    buildingType   : state.buildingType,
  }));

  // ⚠️ Disambiguation note — injected before the checklist so the AI reads it first
  lines.push('⚠️  KAMUS BAHASA INDONESIA (jangan salah tafsir):');
  lines.push('   • "kisaran [harga]" = ekspresi budget ("sekitar/range") — BUKAN nama kota.');
  lines.push('     Contoh: "kisaran 3-6juta/minggu" → Budget, bukan lokasi Kisaran.');
  lines.push('   • Lokasi customer HANYA dari field ✅ Lokasi [Q2] di bawah — ABAIKAN');
  lines.push('     kata "kisaran" dalam pesan customer sebagai referensi lokasi.');
  lines.push('');

  // ⚠️ LABEL INDONESIA, BUKAN ENUM INTERNAL. Bug produksi (5 Agu 2026): state
  // menampilkan enum mentah `sale`, LLM menerjemahkannya sendiri jadi "Jual",
  // dan customer yang jelas bilang "Mau BELI rumah" menerima "✓ Rencana: Jual"
  // — kebalikan makna. Enum `sale`/`rent` ditulis dari sudut pandang LISTING
  // (properti ini dijual/disewakan); summary bicara dari sudut pandang CUSTOMER
  // (dia membeli/menyewa). Sajikan label siap-salin agar LLM tidak menerjemahkan.
  const TX_LABEL_ID   = { sale: 'Beli', rent: 'Sewa', buy: 'Beli', beli: 'Beli', sewa: 'Sewa' };
  const TYPE_LABEL_ID = {
    house: 'Rumah', apartment: 'Apartemen', villa: 'Villa', hotel: 'Hotel',
    boarding_house: 'Kos', shophouse: 'Ruko', office: 'Kantor',
    warehouse: 'Gudang', store: 'Toko', mansion: 'Mansion',
    kondotel: 'Kondotel', condo: 'Kondominium', others: 'Properti',
  };
  const _txRaw    = String(state.transactionType || '').trim().toLowerCase();
  const _typeRaw  = String(state.buildingType    || '').trim().toLowerCase();
  const txLabel   = state.transactionType ? (TX_LABEL_ID[_txRaw]     || state.transactionType) : null;
  const typeLabel = state.buildingType    ? (TYPE_LABEL_ID[_typeRaw] || state.buildingType)    : null;

  lines.push(
    row('Tipe transaksi    [Q1]', txLabel),
    row('Tipe properti         ', typeLabel ? typeLabel + fbNote : null),
    row('Kota              [Q2]', state.city),
    row('Area/Kecamatan  [Q2c]', state.district),
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
    // Preferensi POSITIF dari jawaban Q5 (mis. "mau yang sejuk, udara bersih").
    // Baris terpisah supaya tidak tertukar dengan Hindari — arah maknanya
    // berlawanan, dan pernah tertukar di produksi (M89b).
    row('Prefer/suasana     [Q5]', state.preferences),
    row('Patokan lokasi    [Q6]', state.anchorPoint),
    row('Area alternatif   [Q7]', state.alternativeAreas),
    state.moveInDate === WAITING_THE_UPDATE
      // Extra-loud variant: a plain "✅ ... Waiting the update" row was observed to
      // still get re-asked by the primary provider on a later turn — it read the raw
      // customer message ("belum pasti") again and treated the topic as unresolved
      // despite the ✅ marker. Spell out explicitly that this IS the answered state
      // and that the customer will follow up on their own; nothing to ask here.
      ? `✅ Tanggal masuk  ⚠️WAJIB [Q8]: ${WAITING_THE_UPDATE} — SUDAH DIJAWAB (customer belum tahu tanggal pastinya & akan mengabari sendiri nanti). ⛔ JANGAN tanya ulang soal tanggal/target — lanjut ke Q berikutnya.`
      : row('Tanggal masuk  ⚠️WAJIB [Q8]', state.moveInDate),
    row('Keputusan         [Q9]', state.decisionMaker),
    row('Tgl survei       [Q9b]', state.viewingDate),
    row('Jam survei       [Q9c]', state.viewingDate === 'Minta listing' ? 'n/a (customer minta listing)' : state.viewingTime),
    row('Durasi sewa      [Q10]', state.leaseDuration),
    row('Furnitur         [Q11]', state.furnishing),
    // Marker internal 'standar' DIEKSPANSI jadi daftar fasilitas nyata per tipe
    // properti — dulu tampil apa adanya sebagai "✓ Fasilitas: Standar" (satu
    // kata tanpa isi) di summary customer. Lihat utils/standardFacilities.js.
    row('Fasilitas  ⚠️WAJIB     ', (() => {
      const expanded = expandStandardFacilities(state.facilities, state.buildingType, state.furnishing || '');
      return expanded.length ? expanded.join(', ') : null;
    })()),
    row('Apt preference   [Q12]', state.apartmentPref),
  );

  // Q14 kantor — HANYA muncul untuk tipe office (M122). Ditaruh di luar
  // lines.push() literal, seperti pola BELI-only di bawah, supaya tipe lain
  // tidak menampilkan "❓ Grade Gedung: BELUM DIJAWAB" yang membingungkan —
  // pertanyaan itu memang tidak relevan untuk rumah/villa/dsb.
  if (state.buildingType === 'office') {
    lines.push(
      row('Grade gedung [Q14]', state.officeGrade),
      row('Fit-out/shell [Q14]', state.officeFitOut),
    );
  }

  // BELI-only rows — hanya ditampilkan untuk transaksi beli (bagian 24 kombinasi)
  const isSale = (state.transactionType || '').toLowerCase().includes('sale')
    || (state.transactionType || '').toLowerCase().includes('beli');
  if (isSale) {
    lines.push(
      row('Pembiayaan [Q_KPR — hanya bila customer sendiri yang membuka topik]', state.financing),
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

  // ── FIELD WAJIB (8) — summary DIBLOKIR sampai semuanya ✅ ─────────────────
  //   1 Tipe transaksi · 2 Tipe properti · 3 Lokasi KOTA · 4 Budget
  //   5 Fasilitas · 6 Avoiding & Preference (red flags) · 7 Jadwal survei
  //   8 Tanggal pindah/masuk/check-in
  //
  // ── FIELD OPSIONAL — TIDAK memblokir summary ─────────────────────────────
  //   Area/district (Q2c) · Furnitur (Q11) · Patokan lokasi (Q6) ·
  //   Keputusan bersama (Q9)
  //
  // Q6 Patokan dan Q7 Area alternatif DULU ikut memblokir summary. Itu keliru:
  // keduanya opsional, dan memblokir di situ membuat AI menahan brief sambil
  // menanyakan hal yang boleh saja tidak dijawab customer.
  const missingMandatory = listMissingMandatory(state);

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

/**
 * @param {string} provider
 * @param {string} [context] - recent conversation text (current message + a few history
 *   turns) used to decide whether conditional reference skill docs (facilities/landmark
 *   tables) should be loaded this turn. Omit when no live conversation is available
 *   (e.g. skill-status checks) — conditional docs default to "always included" then.
 */
function getProjectSkillInstruction(provider = 'shared', context = null) {
  return `${BASE_PROPERTY_ASSISTANT_PROMPT}\n\nPROJECT SKILL DOCUMENTATION FOR PROVIDER: ${provider}\n${loadProjectSkillPrompt({ provider, context })}`;
}

/**
 * Recent message text used to decide which conditional skill docs to load
 * (see getProjectSkillInstruction + CONDITIONAL_FILE_TRIGGERS in skillPromptService.js).
 *
 * ⚠️ WINDOW SIZE IS THE WHOLE POINT — it was 6 and the optimization was INERT.
 * Measured on a real transcript (Sidoarjo/Puri Surya, 8 turns): with a 6-message window
 * ALL SIX conditional docs (104KB) loaded on EVERY turn, because six turns of any property
 * chat inevitably contain "rumah", "harga", "dekat", "fasilitas" — every trigger fires, and
 * "conditional" silently means "always on". Narrowing the window to the CURRENT EXCHANGE
 * (customer's message + the AI's immediately preceding question + one turn of lookback)
 * cut the skill payload 33% on the same transcript with no rule lost.
 *
 * Why 2 and not 0/1: the AI's own last question is the decisive signal — a customer answering
 * "AC dan kolam renang" only makes sense as a facilities answer because the previous turn asked
 * about fasilitas, so that turn must stay in the window for doc 12 to load.
 * ⚠️ Never use 0 here: `Array.slice(-0)` is `slice(0)` and silently returns the ENTIRE history,
 * which is exactly the always-on behaviour this window exists to prevent.
 */
const SKILL_CONTEXT_WINDOW = 2;
function _skillContext(history = [], userMessage = '') {
  const recent = (history || []).slice(-SKILL_CONTEXT_WINDOW).map((h) => h.message || '').join(' ');
  return `${recent} ${userMessage || ''}`;
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

/**
 * Prompt chatbot WEBSITE — kini IDENTIK dengan jalur WhatsApp/terminal message.
 *
 * ⚠️ DULU prompt terpisah & JAUH lebih tipis: tanpa QUALIFICATION STATE, tanpa
 * DIREKTIF FINAL, tanpa gating summary — dan diakhiri instruksi
 *   "Do not keep asking discovery questions before showing options…"
 * Instruksi itu, digabung dengan katalog yang SELALU disuntikkan tiap pesan,
 * membuat chatbot web membuang seluruh isi katalog pada pesan PERTAMA lalu
 * mengulanginya persis sama di pesan berikutnya — tidak pernah bertanya
 * kota/budget/tanggal, tidak pernah maju (bug nyata: "Saya mau booking rumah"
 * → 8 listing acak lintas provinsi; "Boleh" → 8 listing yang sama lagi).
 *
 * Web dan WhatsApp melayani customer yang sama dengan kebutuhan yang sama, jadi
 * keduanya sekarang memakai SATU pembangun prompt. Perbedaan yang tersisa hanya
 * datang dari data sesi itu sendiri:
 *   • `session.agentUserId` kosong pada web → getCachedCatalogMode() = "OFF"
 *     → katalog hanya tampil SETELAH brief lengkap (persis yang diinginkan:
 *       kualifikasi dulu, baru rekomendasi).
 *   • `session.agentName` kosong pada web → tanda tangan memakai APP_NAME.
 *
 * Menyatukannya juga berarti setiap perbaikan alur (anti-halusinasi summary,
 * label Beli/Sewa, fasilitas standar, dst.) otomatis berlaku di web — dulu
 * setiap perbaikan harus ditulis dua kali dan pada praktiknya tidak pernah.
 */
function buildChatbotReplyPrompt(session, history, userMessage, propertyContext = '', provider = 'shared') {
  return buildWhatsappReplyPrompt(session, history, userMessage, propertyContext, provider, {});
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

  // ── Mode katalog PER-AGENT: hanya mengontrol ISI BRIEF — bukan mode interview ─
  // Q1-Q12 interview SELALU berjalan, apapun nilai modenya.
  //   OFF (default) → brief summary saja, tanpa rekomendasi katalog
  //   ON            → brief summary + rekomendasi properti dari catalog context
  // Sumber: users.catalog_summary via cache (dihangatkan resolveCatalogMode() di
  // awal pipeline whatsappAIService); fallback env RESPOND_CATALOG_RUN bila NULL.
  const { getCachedCatalogMode } = require('./catalogModeService');
  const showCatalogAfterBrief = getCachedCatalogMode(session?.agentUserId) === 'ON';

  // ── Batas layanan agent (users.trans_type/payment_type/rental_*) ──────────
  // Penolakan yang EKSPLISIT sudah ditangani deterministik oleh
  // utils/agentScopeGuard.js SEBELUM prompt ini dibuat. Blok di bawah untuk hal
  // yang TIDAK bisa ditangani gerbang: mencegah AI MENAWARKAN sesuatu di luar
  // layanan agent — mis. bertanya "sewa atau beli?" pada agent yang hanya
  // menjual, atau menanyakan durasi sewa di bawah minimalnya (M90).
  const _agentRules = (() => {
    try { return require('./agentBusinessRulesService').getCachedAgentBusinessRules(session?.agentUserId); }
    catch { return null; }
  })();
  const scopeBlock = (() => {
    const t = String(_agentRules?.transType || '').toLowerCase();
    if (!t) return '';                      // fail-open: tidak diketahui → diam
    const lines = [];
    if (t === 'sale') {
      lines.push('Agent ini HANYA melayani JUAL BELI properti. ⛔ JANGAN menanyakan "sewa atau beli?" — transaksinya sudah pasti BELI. JANGAN menawarkan sewa/kos/kontrak/booking.');
      const p = String(_agentRules.paymentType || '').toLowerCase();
      if (p === 'cash') lines.push('Pembiayaan: HANYA cash. ⛔ JANGAN menawarkan KPR/kredit.');
      else if (p === 'kpr') lines.push('Pembiayaan: bisa dibantu KPR (pembeli cash juga tetap diterima).');
    } else if (t === 'rent') {
      lines.push('Agent ini HANYA melayani SEWA/BOOKING properti. ⛔ JANGAN menanyakan "sewa atau beli?" — transaksinya sudah pasti SEWA. JANGAN menawarkan pembelian/KPR.');
      const { minRentalDays } = require('../utils/agentScopeGuard');
      const { formatDurationId } = require('../utils/durationConverter');
      const md = minRentalDays(_agentRules);
      if (md) {
        const lbl = formatDurationId(_agentRules.rentalDuration, _agentRules.rentalType);
        // Jangan menulis "4 hari (4 hari)" saat satuannya memang sudah hari.
        const suffix = /hari/.test(lbl) ? '' : ` (= ${md} hari)`;
        lines.push(`Minimal sewa: ${lbl}${suffix}. ⛔ JANGAN menyetujui durasi di bawah itu; sampaikan minimalnya dengan sopan.`);
      }
    } else {
      lines.push('Agent ini melayani JUAL BELI maupun SEWA — tanyakan mana yang dimaksud bila belum jelas.');
      const { minRentalDays } = require('../utils/agentScopeGuard');
      const { formatDurationId } = require('../utils/durationConverter');
      const md = minRentalDays(_agentRules);
      if (md) {
        const lbl = formatDurationId(_agentRules.rentalDuration, _agentRules.rentalType);
        const suffix = /hari/.test(lbl) ? '' : ` (= ${md} hari)`;
        lines.push(`Khusus sewa, minimal ${lbl}${suffix}.`);
      }
    }
    return `\n🎯 BATAS LAYANAN AGENT (dari profil agent — WAJIB dipatuhi):\n${lines.map(l => `  • ${l}`).join('\n')}\n`;
  })();

  // Apakah konteks katalog benar-benar BERISI listing? Dipakai untuk memilih
  // antara "tampilkan rekomendasi" dan "minta maaf, katalog belum ada yang
  // cocok" (M86). Tanpa pembedaan ini, katalog=ON + katalog kosong membuat AI
  // diam saja — customer tidak pernah tahu bahwa memang belum ada stok.
  const hasCatalogContext = String(propertyContext || '').trim().length > 0;

  // ── Build server-side qualification state (prevents repeated questions) ──
  // Selalu dihitung — Q1-Q12 selalu aktif.
  // ⚠️ STATE SELALU DARI HISTORY PENUH. Pemotongan token hanya boleh mengenai
  // TRANSKRIP YANG DITAMPILKAN (historyForDisplay di bawah) — tidak pernah
  // perhitungan state. Memotong input state membuat jawaban Q1/Q2/Q3 di awal
  // percakapan panjang menghilang, seluruh field jadi ❓, dan AI menanyakan
  // Q1 lagi; jawaban baru mendorong pesan lama makin jauh keluar window →
  // loop tak berujung (bug M35, terulang 3 Agu 2026).
  const qualState      = extractQualificationState(history, userMessage);

  // ⚠️ Chatbot WEB meminta lokasi di form pembuka (name/phone/location), tapi
  // nilainya hanya ada di sesi — extractQualificationState() memindai TEKS PESAN
  // saja, sehingga Q2 tetap ❓ dan AI menanyakan "di kota mana?" kepada customer
  // yang baru saja mengetikkannya di form.
  //
  // Sengaja DIBATASI pada sesi web: di sana lokasi diketik customer untuk sesi
  // ini juga. Pada WhatsApp, `session.location` bisa berisi sisa pencarian lama,
  // dan menyalurkannya akan menghidupkan kembali pencarian yang sudah
  // ditinggalkan (kelas bug stabilitas konteks yang sudah pernah terjadi).
  if (qualState && !qualState.city && session?.source === 'website_chatbot' && session?.location) {
    const seeded = detectLocation(String(session.location)) || String(session.location).trim();
    if (seeded) qualState.city = seeded;
  }

  const qualStateBlock = qualState ? buildQualificationStateBlock(qualState) : '';

  // Transkrip yang ditampilkan dibatasi demi anggaran token — QUALIFICATION
  // STATE di atas sudah memuat seluruh jawaban, jadi turn lama tidak perlu
  // dikirim utuh. Aman dipangkas: state tetap lengkap.
  const MAX_DISPLAY_TURNS  = Number(process.env.AI_PROMPT_DISPLAY_TURNS || 20);
  const historyForDisplay  = Array.isArray(history) && history.length > MAX_DISPLAY_TURNS
    ? history.slice(-MAX_DISPLAY_TURNS)
    : (history || []);

  // Landmark live dari Google Places untuk kota yang dipilih customer. Kosong
  // (dan tidak berbiaya token) bila cache belum hangat atau API tidak tersedia.
  const liveLandmarkBlock = buildLiveLandmarkBlock(qualState?.district || qualState?.location);

  // ── Boleh tampilkan summary sekarang? ────────────────────────────────────
  // Bug produksi 7 Agu 2026 (Malang, beli untuk investasi): state, direktif
  // final, dan banner "🚫 SUMMARY DIBLOKIR" SEMUA sudah benar — findNextQuestion
  // mengembalikan Q7 — tapi AI tetap membalas dengan kalimat penutup
  // "Mohon maaf … belum ada properti di katalog saya yang cocok". Kalimat itu
  // TIDAK dikarang: ia ada di TEMPLATE BRIEF dalam prompt ini, siap disalin.
  // Malang memang belum punya listing sama sekali (hasCatalogContext=false),
  // jadi cabang katalog-kosong itulah yang tercetak di template.
  //
  // Pelajaran yang sama seperti bug-bug prompt sebelumnya: menambah larangan
  // tidak menutup celah — MENGHILANGKAN kalimatnya yang menutup. Selama masih
  // ada field wajib kosong, template brief (khususnya kalimat penutupnya)
  // tidak boleh hadir utuh di prompt; yang tersisa hanya kerangka format.
  const missingNow       = qualState ? listMissingMandatory(qualState) : [];
  const summaryIsBlocked = missingNow.length > 0;
  const summaryBlockedNote = summaryIsBlocked
    ? `\n\n⛔ **SUMMARY SEDANG DIBLOKIR** — field wajib belum terisi: ${missingNow.join(', ')}.\nTemplate di bawah HANYA referensi format untuk NANTI. DILARANG KERAS mengirim bagian mana pun darinya pada giliran ini — termasuk kalimat pembuka, baris ✓, maupun kalimat PENUTUP. Balasan Anda giliran ini WAJIB berupa SATU pertanyaan berikutnya sesuai DIREKTIF FINAL.`
    : '';

  // ── Q1-Q12 qualification instructions — selalu diinjeksi ─────────────────
  const summaryModeInstructions = `

## QUALIFICATION MODE

You are conducting a property qualification interview. This means:

1. ❌ DO NOT show property listings or catalog DURING Q1–Q12 questions.
2. ✅ Ask Q1–Q12 qualification questions, in order, ONE question per message.
3. ✅ Only after ALL mandatory questions are answered → show the structured brief below.
4. ✅ Never skip Q8 (move-in date) — it is MANDATORY.

### Context Continuation Rules (CRITICAL — Read First)

Short customer answers are CONTINUATIONS of the previous question — not new topics.
NEVER re-ask a question that was already answered. Read the full history before deciding which question to ask next.

**⛔ A REFUSAL IS AN ANSWER — THIS IS THE #1 CAUSE OF ANGRY CUSTOMERS.**

When you offer an option and the customer DECLINES it, that question is ANSWERED. "Tidak ada",
"enggak ada", "nggak perlu", "tetap di X saja", "cukup X saja", "di X aja" are COMPLETE, VALID
answers — not silence, not evasion, not an invitation to ask again in different words.

- ❌ NEVER re-ask a question just because the answer was negative.
- ❌ NEVER rephrase a declined question and ask it again ("area lain?" → "masih ada area lain?"
  → "selain X, ada area lain?"). Rewording a question the customer already declined is the SAME
  question. The customer WILL notice, and they WILL get angry.
- ✅ A decline → acknowledge it briefly, then move to the NEXT question that is still ❓.
- ✅ Only ask a question that is marked ❓ (never asked). If it is ✅, it is DONE — forever.

Example — Q7 alternative areas:
- AI: "Selain Pakuwon, ada area lain?" → Customer: "Tidak ada, Kak"
  → Q7 is now ✅ **ANSWERED = "Fokus di Pakuwon saja"**. Acknowledge once, then ask the next ❓.
  Asking about other areas again — in ANY wording — is FORBIDDEN for the rest of the conversation.

If the customer expresses frustration ("kok nanya lagi", "sudah saya jawab", "dari tadi") →
STOP asking that question immediately, apologize briefly, and move on. If they ask for the
catalog/listings, give it to them — do not keep interrogating.

Examples of continuation answers and what to do next:
- Q4 was asked ("Nanti tinggal bersama siapa saja?") → customer says "saya tinggal sendiran aja", "sama istri aja", "berdua sama anak" → **acknowledge + ask next unanswered question**
- Q8 was asked ("Rencananya masuk bulan apa?") → customer says "Juni 2026", "bulan depan", "24 juni" → **acknowledge + ask next unanswered question**
- Q1 was asked ("Sewa atau beli?") → customer says "sewa", "beli aja" → **acknowledge + ask next unanswered question**
- Q3: customer says "yang terjangkau aja" / "murah aja" → **budget = affordable, proceed to next question**
- Q7 was asked ("Selain Pakuwon, ada area lain?") → customer says "tidak ada", "tetap di Pakuwon", "di Pakuwon saja" → **Q7 ANSWERED (fokus 1 area) — acknowledge + ask next unanswered question. NEVER ask about areas again.**

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

**Q7 — Alternative areas** (ask AT MOST ONCE — see "A REFUSAL IS AN ANSWER" above)
"Selain area [Area], apakah area sekitar masih oke?"
⛔ Q7 menanyakan AREA/KECAMATAN LAIN DI DALAM KOTA YANG SAMA — BUKAN kota lain.
   Kota sudah final sejak Q2 dan TIDAK ditawar ulang di sini.
   ✅ BENAR : "Selain area *Pakuwon*, apakah area sekitar masih oke? 🗺️"
   ❌ SALAH : "Selain *Surabaya*, area sekitar yang masih oke? 🗺️"  ← terdengar
      seperti menawarkan PINDAH KOTA; customer sudah memilih Surabaya.
   Jangkar = AREA dari Q2c. Pakai nama KOTA hanya bila customer belum menyebut
   area sama sekali.
→ ASK ONLY IF Q7 is ❓. If Q7 shows ✅ — including when the value is a refusal like
  "Tidak ada" / "tetap di Pakuwon" — it is ANSWERED. Do NOT ask again, in any wording.
→ Declining other areas = "Fokus di [area] saja". That is a complete answer. Move on.

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

**Brief format:**${summaryBlockedNote}
\`\`\`
Baik, saya sudah catat permintaan Anda, sebagai berikut 📝 🔥

✓ Rencana: *[nilai dari Q1 tx — HANYA jika ✅]*

✓ Tipe: *[nilai dari building type — HANYA jika ✅]*

✓ Kota: *[nilai dari Q2 — HANYA jika ✅]*

✓ Area: *[nilai dari Q2c — HANYA jika ✅; area/kecamatan di dalam kota, mis. "Ngagel"]*

✓ Budget: *[nilai dari Q3 — HANYA jika ✅]*

✓ Masuk: *[nilai dari Q8 — HANYA jika ✅; bisa juga "Waiting the update"]*

✓ Pembiayaan: *[nilai dari Q_KPR — HANYA untuk transaksi BELI dan jika ✅; sertakan bank/DP dari Q_KPR-a jika ada]*

✓ Kondisi: *[nilai dari Q_COND (baru/second/inden) — HANYA untuk BELI residensial dan jika ✅]*

✓ Keputusan bersama: *[nilai dari Q9 — HANYA jika ✅]*

✓ Furnitur: *[nilai dari Q11 — HANYA jika ✅]*

✓ Fasilitas: *[SALIN UTUH baris "Fasilitas" dari QUALIFICATION STATE — HANYA jika ✅. JANGAN dipangkas, JANGAN diringkas, JANGAN diambil sebagiannya saja.]*

✓ Red flags: *[nilai PERSIS dari Q5 di QUALIFICATION STATE — HANYA jika ✅]*

✓ Patokan lokasi: *[nilai PERSIS dari Q6 di QUALIFICATION STATE — HANYA jika ✅]*

✓ Area alternatif: *[nilai dari Q7 — HANYA jika ✅]*

✓ Tower/Lantai: *[nilai dari Q12 — HANYA untuk apartemen/kondo dan jika ✅; mis. "Lantai 12-18"]*

✓ Viewing: *[nilai dari Q9b+Q9c — HANYA jika ✅. Format "Jam <jam>, <tanggal>" bila customer mau survei, atau persis "Minta listing" bila customer menolak survei]*



${!showCatalogAfterBrief
  ? `Terima kasih sudah menghubungi saya. 🙏`
  : hasCatalogContext
    ? `[Setelah brief di atas, LANJUTKAN LANGSUNG tanpa jeda — tampilkan rekomendasi properti dari "Backend property catalog context". Jika ada exact match tampilkan dulu. Jika tidak ada, sampaikan tidak ada yang persis cocok lalu tampilkan alternatif terdekat. Gunakan format yang jelas dan mudah dibaca di WhatsApp.]`
    : summaryIsBlocked
      ? `[kalimat penutup katalog-kosong SENGAJA DISEMBUNYIKAN selama summary diblokir — jangan mengarang penggantinya, cukup tanyakan pertanyaan berikutnya]`
      : `Mohon maaf, Kak 🙏 untuk saat ini belum ada properti di katalog saya yang cocok dengan kriteria di atas. Permintaan Anda sudah saya catat, dan saya kabari begitu ada unit yang sesuai masuk.

Terima kasih sudah menghubungi saya. 🙏`}

Salam hangat,
${resolvedAgentName}
${resolvedAppName}
\`\`\`

### Summary Strict Rules
- **⛔ Label baris WAJIB persis seperti template di atas.** Baris kota memakai label "Kota" — JANGAN "Lokasi". Anotasi/penjelasan apa pun dari dokumen ini TIDAK BOLEH ikut tersalin ke pesan customer: yang dikirim hanya "✓ Label: *nilai*", tanpa tanda ⛔, tanpa catatan kurung, tanpa komentar instruksi. (Bug nyata 5 Agu 2026: baris "✓ Kota: Surabaya ⛔ label Kota, BUKAN Lokasi" terkirim mentah ke customer.)
- **⛔ Nilai "Rencana" memakai sudut pandang CUSTOMER: "Beli" atau "Sewa".** JANGAN PERNAH menulis "Jual" — customer adalah pembeli, bukan penjual. QUALIFICATION STATE sudah memberi label Indonesia siap-salin di baris "Tipe transaksi"; salin persis, jangan menerjemahkan enum internal sendiri.
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
- **⛔ DILARANG KERAS: setiap nilai field HARUS SATU BARIS, tanpa line break di dalamnya.** Jika baris QUALIFICATION STATE tampak menggabungkan dua info berbeda (mis. nama kota + jawaban pertanyaan lain yang tidak terkait), itu BUKAN nilai field yang sah — jangan disalin apa adanya, dan jangan digabung sendiri. Field seperti itu dianggap ❓ dan barisnya dilewati.
- **⛔ DILARANG KERAS: "Area" TIDAK BOLEH sama dengan/hanya mengulang nama Kota (Q2), dan TIDAK BOLEH berisi jawaban dari pertanyaan lain** (mis. tipe kamar, fasilitas). Area hanya nama area/kecamatan DI DALAM kota tersebut. Jika QUALIFICATION STATE Q2c ❓ → baris "Area" TIDAK ADA di summary sama sekali, meskipun nama kota disebut berkali-kali di riwayat chat.
- **⛔ DILARANG KERAS: "Keputusan bersama" HANYA salinan PERSIS nilai Q9 di QUALIFICATION STATE.** JANGAN mengarang kutipan/dialog customer ("Iya, Kak... saya survei bersama istri") yang tidak muncul sebagai nilai Q9. Jika Q9 ❓ → baris ini TIDAK ADA.
- **⛔ DILARANG KERAS: "Viewing" TIDAK BOLEH memakai kata relatif ("besok", "lusa", "minggu depan").** QUALIFICATION STATE Q9b sudah berisi tanggal ABSOLUT hasil normalisasi ("DD Bulan YYYY") — salin PERSIS itu. Jangan menebak atau mengganti dengan kata relatif apa pun.
- **⛔ DILARANG KERAS: baris "Fasilitas" WAJIB disalin UTUH dari QUALIFICATION STATE — dilarang dipangkas.** Bug nyata (8 Agu 2026, dibandingkan dengan transkrip 9 Agu yang BENAR): customer menjawab "Fasilitas terserah saja, pokok ada AC dan gym". QUALIFICATION STATE sudah berisi daftar LENGKAP hasil ekspansi fasilitas standar apartemen — "Gym, AC, Kamar Tidur, Kamar Mandi, Ruang Tamu, Pantry/Kitchen Set, Water Heater, Listrik, Air, Wi-Fi, TV, Lift, Parkir, Lobby, Keamanan 24 Jam, CCTV, Akses Kartu" — tetapi brief hanya menulis "✓ Fasilitas: AC, Gym". Dua item yang customer sebut spesifik ditulis, 15 fasilitas standar sisanya DIBUANG.
  ❌ SALAH  : "✓ Fasilitas: AC, Gym"  ← hanya menyalin yang customer sebut, sisanya dibuang
  ✅ BENAR  : "✓ Fasilitas: Gym, AC, Kamar Tidur, Kamar Mandi, Ruang Tamu, Pantry/Kitchen Set, Water Heater, Listrik, Air, Wi-Fi, TV, Lift, Parkir, Lobby, Keamanan 24 Jam, CCTV, Akses Kartu"
  Alasannya: "terserah/standar/apapun" BUKAN berarti tidak ada fasilitas — itu berarti fasilitas STANDAR tipe properti tersebut BERLAKU, ditambah item yang customer sebut. Server sudah menghitungnya; tugas Anda hanya MENYALIN. Panjang bukan alasan memangkas.
- **⛔ DILARANG KERAS: "✓" TIDAK PERNAH berpasangan dengan "(Belum ditanyakan)".** Bug nyata (4 Agu 2026): Q_FAC sudah ditanya DAN dijawab ("Fasilitas terserah, Kak" → QUALIFICATION STATE menunjukkan ✅ Fasilitas: standar), tapi brief tetap menulis "✓ Fasilitas: (Belum ditanyakan)" — kontradiksi, dan mengarang nilai yang bertentangan dengan state ✅ yang sudah tersedia. Field ✅ SELALU pakai nilai ASLI dari QUALIFICATION STATE (mis. "Standar" untuk marker 'standar'); field ❓ TIDAK ADA barisnya sama sekali — tidak pernah "✓ ... (Belum ditanyakan)".
- **⛔ DILARANG KERAS: tanda tangan HARUS berupa NAMA ASLI, JANGAN PERNAH literal \${agentName} atau \${appName}.** Bug nyata (4 Agu 2026): brief terkirim ke customer dengan teks harfiah "\${agentName}" dan "\${appName}" alih-alih nama sungguhan. Nama ASLI ada di blok "🪪 IDENTITAS ANDA (AGENT)" dan sudah terisi otomatis di baris "Salam hangat," pada template brief di atas — salin APA ADANYA sebagai teks biasa. JANGAN PERNAH mengetik karakter dolar, kurung kurawal buka, atau kurung kurawal tutup di baris tanda tangan.
- **⛔ DILARANG KERAS: JANGAN menandatangani summary dengan NAMA CUSTOMER.** Bug nyata (6 Agu 2026): summary tertanda "Nigel 期凡努" (nama customer di blok "Customer profile") padahal agent-nya "Leo Felix" — customer seolah menerima surat dari dirinya sendiri. Blok "Customer profile" adalah LAWAN BICARA; tanda tangan SELALU dari blok "🪪 IDENTITAS ANDA (AGENT)". Kalau ragu: nama di "Salam hangat," pada template sudah benar — jangan diganti.
- One question per message only.
- Maximum 12 AI messages before showing brief (even if incomplete).
- ${!showCatalogAfterBrief
    ? 'Never show catalog, Rumah123 listings, or property details. Setelah brief, cukup pesan konfirmasi saja — tanpa catalog. (users.catalog_summary = OFF)'
    : hasCatalogContext
      ? 'JANGAN tampilkan catalog selama Q1–Q12. Setelah brief ditampilkan (semua Q wajib ✅), WAJIB LANJUTKAN dengan rekomendasi dari property catalog context. (users.catalog_summary = ON) — summary tanpa katalog dianggap TIDAK LENGKAP.'
      : 'users.catalog_summary = ON tetapi katalog agent ini KOSONG untuk kriteria tersebut. Setelah brief, WAJIB minta maaf kepada customer bahwa belum ada properti yang cocok dan janjikan kabar susulan. ⛔ DILARANG KERAS mengarang listing, harga, atau nama properti untuk mengisi kekosongan itu.'}

### Tanda Tangan / Signature
⛔ **JANGAN tambahkan** "Salam hangat," atau nama/tanda tangan agen di akhir pertanyaan kualifikasi Q1–Q12 MANAPUN.
⛔ **JANGAN akhiri pertanyaan dengan "Salam hangat," nama agen, atau nama perusahaan** — akhiri pertanyaan LANGSUNG setelah kalimat tanya atau emoji terakhir.
✅ Tanda tangan HANYA boleh ada satu kali — di dalam summary brief final (sudah termasuk dalam template di atas), dan TIDAK di tempat lain.
`;

  return `${getProjectSkillInstruction(provider, _skillContext(history, userMessage))}
${forcedLangInstruction}
🪪 IDENTITAS ANDA (AGENT) — SUDAH DI-RESOLVE, PAKAI APA ADANYA:
Nama agent (users.name) : ${resolvedAgentName}
Nama aplikasi (APP_NAME): ${resolvedAppName}
⚠️ Ini identitas ANDA. Blok "Customer profile" di bawah adalah LAWAN BICARA —
   jangan pernah menandatangani summary dengan nama dari blok itu.
⛔ Tanda tangan summary WAJIB memakai dua nilai di atas sebagai TEKS BIASA.
   Menulis "[Nama Agen]", "[Nama Aplikasi]", "\${agentName}", atau "\${appName}"
   adalah BUG yang pernah terkirim ke customer sungguhan — bukan keluaran sah.
${scopeBlock}${summaryModeInstructions}
${qualStateBlock ? `\n${qualStateBlock}\n` : ''}${liveLandmarkBlock}
Customer profile (LAWAN BICARA — jangan dipakai sebagai tanda tangan):
Name: ${session.name}   ← nama CUSTOMER
Phone: ${session.normalizedPhone}
Location: ${session.location || session.normalizedLocation || 'Not provided'}
Source: ${session.source}

Recent conversation history for context only. Use the customer profile identity (name, phone, and location) to continue the returning customer's context. Do not let old history override the latest customer message. ⚠️ PENTING: QUALIFICATION STATE di atas adalah satu-satunya sumber kebenaran — JANGAN gunakan nilai budget/tanggal/penghuni/furnitur dari history lama (sesi sebelumnya) untuk mengisi field yang masih ❓:
${formatConversationHistory(historyForDisplay)}

Backend property catalog context for this latest WhatsApp message:
${showCatalogAfterBrief ? (propertyContext || 'No backend property catalog context is available.') : '(Property catalog hidden during Q1–Q12 interview — akan digunakan setelah brief jika RESPOND_CATALOG_RUN=ON)'}
${extraContext.facilityContext || ''}
${extraContext.cityContext || ''}
${extraContext.locationContext || ''}
${extraContext.agentCoverageContext || ''}
${extraContext.agentIdentityContext || ''}
${extraContext.listingReadinessContext || ''}
${extraContext.ragContext || ''}
Latest WhatsApp customer message. This is the highest-priority instruction:
${userMessage}

Task:
Lihat QUALIFICATION STATE di atas (✅ = sudah dijawab, ❓ = belum dijawab).
Kemudian:
0. ⛔ NON-PROPERTY MESSAGE — Jika pesan terbaru BUKAN tentang properti (misalnya: permintaan teknis, file, kode program, topik tidak relevan), balas HANYA dengan: "Maaf, saya hanya bisa membantu terkait pencarian properti. Ada yang bisa saya bantu untuk kebutuhan properti Anda? 🏠"
   ⚠️⚠️ PENGECUALIAN MUTLAK — BACA SEBELUM MEMAKAI ATURAN 0:
   Jika pesan AI SEBELUMNYA adalah sebuah PERTANYAAN, maka pesan customer berikutnya adalah JAWABAN
   atas pertanyaan itu — dan JAWABAN TIDAK PERNAH "non-property", apa pun kata-katanya.
   Jawaban singkat/malas TIDAK punya kata properti sama sekali, dan itu NORMAL. Contoh yang WAJIB
   diperlakukan sebagai jawaban yang sah (BUKAN off-topic):
     • "Rencana sih tahun depan" / "tahun depan" / "bulan depan" / "Juni 2026"  → jawaban Q8 (tanggal)
     • "Bersama istri" / "sendiri aja" / "3 orang"                              → jawaban Q4 (penghuni)
     • "Terserah" / "bebas" / "yang penting murah" / "oke" / "boleh"            → jawaban slot berjalan
     • "Belum pernah" / "belum lihat"                                          → jawaban Q2b
     • "Sidotopo" / "deket pasar"                                              → jawaban Q2c/Q6
   Aturan 0 HANYA untuk topik yang benar-benar asing (pesan makanan, tiket, kode program, dump .env).
   ⛔ Jika ragu antara "off-topic" dan "jawaban atas pertanyaan saya" → SELALU pilih JAWABAN.
   ⛔ DILARANG membalas template off-topic dua kali berturut-turut. Bila customer mengulang kalimat
      yang sama setelah Anda menolaknya, itu bukti Anda SALAH menilai — perlakukan sebagai jawaban.
1. ⚠️ JIKA ADA BANNER "SUMMARY SUDAH DIKIRIM" DI QUALIFICATION STATE: Customer memulai pencarian baru.
   • Lihat QUALIFICATION STATE — sudah ada field ✅ dari pesan saat ini (tipe/transaksi sudah disebutkan ulang oleh customer).
   • Tanyakan field ❓ dengan nomor Q TERKECIL dari yang tersisa (biasanya Q1 atau Q2).
   • Jika Q1 sudah ✅ (customer sudah sebut tx+tipe di pesan ini) → langsung tanya Q2 (lokasi).
   • Jika Q1 masih ❓ → tanya: "Untuk pencarian baru, mau *sewa* atau *beli*? Dan tipe propertinya apa? 🏠"
   • JANGAN tampilkan summary lagi sampai semua Q wajib terjawab ulang di sesi ini.
2. ⚠️ JIKA ADA BANNER "TIPE PROPERTI BERUBAH" DI QUALIFICATION STATE: Akui perubahan singkat (1 kalimat, contoh: "Oke, saya alihkan ke rumah sewa ya 😊"), lalu tanyakan Q terkecil yang masih ❓. Kota, landmark, tanggal masuk, dan jadwal survei TETAP DIPAKAI (field ✅ di bawah) — JANGAN tanya ulang itu; hanya field yang masih ❓ (biasanya budget & fasilitas) yang perlu ditanya ulang.
2b. ⚠️ JIKA ADA BANNER "KOTA BERUBAH" DI QUALIFICATION STATE: Akui perubahan singkat (1 kalimat, contoh: "Oke, jadi di Sidoarjo ya 😊"), lalu tanyakan patokan lokasi/landmark (Q6) untuk kota barunya. JANGAN tawarkan pindah kota lagi, JANGAN tanya ulang transaksi/tipe/budget/tanggal masuk/jadwal survei/fasilitas — semua itu TETAP DIPAKAI dari sebelum perubahan kota.
3. Jika pesan terbaru adalah jawaban singkat untuk pertanyaan sebelumnya → AKUI singkat (1 kalimat), lalu tanyakan pertanyaan ❓ BERIKUTNYA dengan nomor Q terkecil.
   — Khusus Q2b (Riwayat pencarian): Jawaban seperti "Belum pernah.", "belum pernah cek", "belum lihat", "sudah lihat 3" adalah jawaban Q2b yang VALID → AKUI singkat ("Oke, belum ada referensi sebelumnya 👌") → lanjut ke Q3 (Budget). JANGAN tanya Q2b lagi.
   — Jika QUALIFICATION STATE menampilkan ⏭️ untuk Q2b → customer sudah pernah menjawab tapi tidak cocok pattern — TETAP skip Q2b, lanjut ke Q berikutnya.
4. Jika pesan terbaru mengandung informasi baru → catat, lalu tanyakan pertanyaan ❓ berikutnya.
5. Jika semua pertanyaan wajib (Q1 tx, building type, Q2 lokasi, Q3 budget, Q4 penghuni, Q5 red flags, Q6 patokan lokasi, Q7 area alternatif, Q8 tanggal) sudah ✅ DAN tidak ada banner ⚠️ → tampilkan structured brief.${showCatalogAfterBrief ? '\n   Setelah brief: LANJUTKAN dengan rekomendasi dari property catalog context (RESPOND_CATALOG_RUN=ON).' : ''}
⛔ JANGAN tampilkan listing properti SELAMA proses interview Q1-Q12 (sebelum brief).
⛔ JANGAN tanya ulang pertanyaan yang sudah ✅ di QUALIFICATION STATE.
⛔ SATU pertanyaan per pesan — jangan gabungkan dua pertanyaan.
⛔ JANGAN pernah menulis kode slot internal (Q1, Q9, Q9b, Q_FAC, Q_KPR, dst) di pesan ke customer. Itu label internal. Tulis "Siap, Kak. Kalau nanti ada yang cocok…", BUKAN "Untuk Q9, kalau nanti…".
⛔ Q3 Budget: JANGAN tanya langsung — gunakan 2 harga kontras sebagai pilihan reaksi.
⛔ Pesan ambigu ("cari properti", "ada properti?") tanpa tipe/transaksi → tanyakan Q1: "Mau sewa atau beli? Dan tipe propertinya apa?"
⛔ JANGAN tampilkan summary jika Q3 (Budget) atau Q8 (Tanggal masuk) masih ❓ di QUALIFICATION STATE — walaupun budget/tanggal muncul di raw conversation history dari sesi lama.
⛔ JANGAN tampilkan summary jika ada banner ⚠️ di atas, atau jika ada field ❓ yang belum dijawab.
⛔ Field ❓ di QUALIFICATION STATE = BELUM dijawab di sesi aktif ini. ABAIKAN semua nilai budget/tanggal/penghuni/furnitur dari percakapan sebelumnya (sesi lama) — itu bukan jawaban untuk sesi ini.
${buildFinalDirective(qualState, {
  agentName  : resolvedAgentName,
  appName    : resolvedAppName,
  catalogMode: showCatalogAfterBrief ? 'ON' : 'OFF',
  hasCatalog : hasCatalogContext,
  // M142: dipakai untuk mendeteksi "customer sedang bertanya" → jawab dulu.
  customerMessage: userMessage,
})}`;
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
  listMissingMandatory,
  findNextQuestion,
  buildFinalDirective,
  isConditionalFallbackMessage,
  isCorrectionMessage,
};

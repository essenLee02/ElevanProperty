const { loadProjectSkillPrompt } = require('./skillPromptService');
const { detectBudget, detectFacilities, stripCommercialUsePhrases, stripNearPhrases, stripAmbiguousRumah, stripInvestmentIntentPhrases, stripMovingFromPhrases, detectUseCase, isNonResidentialUse, detectLocation, isKnownLocationName } = require('./propertyRecommendationService');
const { parseCustomerDate, isDontKnowDateAnswer, WAITING_THE_UPDATE } = require('../utils/customerDateParser');
const { expandAbbreviations }                 = require('../utils/lazyChatNormalizer');
const { expandStandardFacilities }            = require('../utils/standardFacilities');
const { detectCustomerFrustration } = require('../utils/propertyKeywordFilter');
const { getCityLandmarks }                    = require('../utils/locationLandmarks');

/* ─── Qualification State Extractor ────────────────────────────────────────── */
/* Scans full conversation history to build a per-question answered/unanswered  */
/* state. This is injected into the AI prompt so the AI NEVER re-asks a         */
/* question that already has a green checkmark.                                  */

const QS_CUST_ROLES = new Set(['user', 'customer']);
const QS_AI_ROLES   = new Set(['assistant', 'ai', 'bot']);

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

  const nq = findNextQuestion(state, {});
  const nextLine = nq
    ? `TANYAKAN SEKARANG → ${nq.q}: ${nq.hint}`
    : 'Semua field wajib sudah ✅ → TAMPILKAN SUMMARY BRIEF sekarang.';

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
⛔ Ajukan TEPAT SATU pertanyaan: yang tertulis di baris TANYAKAN SEKARANG.${noAreaLine}${sigLine}${catalogLine}
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
const CORRECTION_RE = /\b(ralat|koreksi|revisi|ganti(?:\s+(?:jadi|ke))?|diganti|ubah(?:\s+(?:jadi|ke))?|diubah|rubah|dirubah|salah\s+(?:sebut|tulis|ketik|kirim|info)|maksud\s?(?:ku|saya|nya)|bukan\s+itu|yang\s+benar|yg\s+bener|harusnya|seharusnya|sebenarnya|eh\s+salah|maaf\s+salah|batal(?:kan)?\s+yang\s+tadi)\b/i;

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

  // Build chronological message array (history is already oldest-first from DB reverse)
  const ALL = [...(history || []), { role: 'customer', message: currentMessage }];

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
    financing       : null,   // Q_KPR  (beli only): cash | KPR | kombinasi
    kprDetails      : null,   // Q_KPR-a (beli + KPR): bank & DP
    propertyCondition: null,  // Q_COND (beli residensial): baru/ready | second | inden
    useCase         : null,   // own-use | investasi | ibadah | kantor/usaha | liburan
    rentOutIntent   : false,  // investasi yang akan disewakan (kos/kontrakan) → tanya target penyewa
    aiAskedQ2b      : false,  // true when AI already asked Q2b — show ⏭️, NEVER repeat
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
      // Apply the SAME strip chain as detectBuildingType() in
      // propertyRecommendationService (see the twin in chatbotPrivateController.js).
      //   stripNearPhrases        — "deket kantor dan mall" is a Q6 ANCHOR, not an office
      //   stripAmbiguousRumah     — "rumah makan/sakit/…" is not a house
      //   stripMovingFromPhrases  — "pindah dari apartemen" is the home being LEFT
      //   stripCommercialUsePhrases — "dipakai kantor"/"buat usaha" is a USE, not a type
      const w = stripCommercialUsePhrases(
        stripMovingFromPhrases(stripAmbiguousRumah(stripNearPhrases((txt || '').toLowerCase())))
      );
      if (/\bkondotel\b|\bcondotel\b/.test(w))                             return 'kondotel';
      if (/\bmansion\b|\brumah\s+mewah\b/.test(w))                        return 'mansion';
      if (/\bvill?a\b/.test(w))                                            return 'villa';
      if (/\bapartemen\b|\bapartment\b/.test(w))                           return 'apartment';
      if (/\bhotel\b|\bpenginapan\b/.test(w))                             return 'hotel';
      if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(w))              return 'boarding_house';
      if (/\bruko\b|\brukan\b/.test(w))                                   return 'shophouse';
      if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(w))             return 'store';
      if (/\bkantor\b|\boffice\b/.test(w))                                           return 'office';
      if (/\bgudang\b|\bwarehouse\b/.test(w))                                           return 'warehouse';
      if (/\brumah\b(?!\s+(?:makan|sakit|tangga|ibadah|duka|produksi|tahanan|susun|potong|kos))|\bhouse\b|\bkontrakan\b/.test(w))                   return 'house';
      if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(w)) return 'others';
      return null;
    };
    const txOfP0 = (txt) => {
      // See the twin in chatbotPrivateController.js: a BUYER saying "buat investasi,
      // mau disewakan lagi" is describing the plan, not flipping sale→rent.
      const w = stripInvestmentIntentPhrases((txt || '').toLowerCase());
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
      const loc = detectLocation(txt || '');
      return loc ? loc.toLowerCase() : null;
    };

    let switchStart   = 0;
    let switchType    = null;   // previous type, for the change banner
    {
      let runType = null;
      let runTx   = null;
      let runLoc  = null;
      for (let i = 0; i < ALL.length; i++) {
        if (!QS_CUST_ROLES.has(ALL[i].role)) continue;
        const isHedge = isConditionalFallbackMessage(ALL[i].message);
        // A hedge message ("kalau gak ada apartemen, villa juga boleh") names a
        // fallback type without confirming a switch — don't let its type keyword
        // flip runType or trigger a Q1 reset. txFlipped/locFlipped can still apply.
        const t   = isHedge ? null : typeOfP0(ALL[i].message);
        const tx  = txOfP0(ALL[i].message);
        const loc = locOfP0(ALL[i].message);
        const typeFlipped = t   && runType && t   !== runType;
        const txFlipped   = tx  && runTx   && tx  !== runTx;
        // ⚠️ PERPINDAHAN KOTA me-RESET seluruh sesi (ACTIVE_ALL dipotong), jadi
        // syaratnya HARUS ketat: kedua nilai wajib nama kota yang DIKENAL.
        // Tanpa guard ini, teks bebas hasil fallback "di X" bisa menghapus semua
        // jawaban customer. Kasus nyata (M51): "saya gak mau di gang sempit dan
        // rumah tua" → loc="gang sempit" → dianggap pindah dari Surabaya →
        // transaksi/budget/tanggal/penghuni HILANG → AI menanyakan Q1 lagi.
        const locFlipped  = loc && runLoc && loc !== runLoc
                            && isKnownLocationName(loc) && isKnownLocationName(runLoc)
                            // "surabaya" → "surabaya barat" bukan pindah kota.
                            && !loc.includes(runLoc) && !runLoc.includes(loc);
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
      else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(tt))      state.buildingType = 'boarding_house';
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
        const hasKpr  = /\b(kpr|kpa|kpt|kredit|mortgage|dp\s*\d+)\b/.test(text);
        const hasCash = /\b(cash|tunai)\b/.test(text);
        if (hasKpr && hasCash)  state.financing = 'kombinasi cash + KPR';
        else if (hasKpr)        state.financing = 'KPR';
        else if (hasCash)       state.financing = 'cash';
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
      if (b2 && !b2.ambiguous && b2.preference !== 'affordable') {
        const periodSuffix2 = b2.period === 'year'  ? '/tahun'
          : b2.period === 'month' ? '/bulan'
          : b2.period === 'night' ? '/malam'
          : b2.period === 'week'  ? '/minggu'
          : '';
        state.budget = b2.text + periodSuffix2;
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
    if (!state.redFlags && /pasti tidak cocok|ingin dihindari|yang\s+dihindari|hadap barat|gang sempit|rumah tua|rawan banjir|rel kereta/.test(aiText)) {
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
      else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(cur))           state.buildingType = 'boarding_house';
      else if (/\bruko\b|\brukan\b/.test(cur))                                state.buildingType = 'shophouse';
      else if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(cur))          state.buildingType = 'store';
      else if (/\bkantor\b|\boffice\b/.test(cur))                                        state.buildingType = 'office';
      else if (/\bgudang\b|\bwarehouse\b/.test(cur))                                        state.buildingType = 'warehouse';
      else if (/\brumah\b(?!\s+(?:makan|sakit|tangga|ibadah|duka|produksi|tahanan|susun|potong|kos))|\bhouse\b|\bkontrakan\b/.test(cur))                state.buildingType = 'house';
      else if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(cur)) state.buildingType = 'others';

      if      (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|rent|rental|lease|booking|book|pesan|reservasi)\b/.test(cur)) state.transactionType = 'rent';
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
      const w = stripCommercialUsePhrases(stripMovingFromPhrases(stripAmbiguousRumah(stripNearPhrases((msg.message || '').toLowerCase()))));
      if (/\bkondotel\b|\bcondotel\b/.test(w))                             return 'kondotel';
      if (/\bmansion\b|\brumah\s+mewah\b/.test(w))                        return 'mansion';
      if (/\bvill?a\b/.test(w))                                            return 'villa';
      if (/\bapartemen\b|\bapartment\b/.test(w))                           return 'apartment';
      if (/\bhotel\b|\bpenginapan\b/.test(w))                             return 'hotel';
      if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(w))              return 'boarding_house';
      if (/\bruko\b|\brukan\b/.test(w))                                   return 'shophouse';
      if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(w))             return 'store';
      if (/\bkantor\b|\boffice\b/.test(w))                                           return 'office';
      if (/\bgudang\b|\bwarehouse\b/.test(w))                                           return 'warehouse';
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
    const cur = stripCommercialUsePhrases(stripMovingFromPhrases(stripAmbiguousRumah(stripNearPhrases((currentMessage || '').toLowerCase().trim()))));
    // A hedge message ("kalau gak ada apartemen, villa juga boleh") names a fallback
    // type without confirming a switch — must not compute a curType from it, or this
    // block force-flips buildingType/wipes budget before the primary type is even
    // confirmed unavailable. Phase 1's Pattern C already records the hedge type into
    // fallbackTypes instead.
    const curIsHedge = isConditionalFallbackMessage(currentMessage);
    let curType = null;
    if (curIsHedge) {
      // leave curType null — no forced switch from a hedge message
    }
    else if (/\bkondotel\b|\bcondotel\b/.test(cur))                          curType = 'kondotel';
    else if (/\bmansion\b|\brumah\s+mewah\b/.test(cur))                    curType = 'mansion';
    else if (/\bvill?a\b/.test(cur))                                         curType = 'villa';
    else if (/\bapartemen\b|\bapartment\b/.test(cur))                        curType = 'apartment';
    else if (/\bhotel\b|\bpenginapan\b/.test(cur))                          curType = 'hotel';
    else if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(cur))           curType = 'boarding_house';
    else if (/\bruko\b|\brukan\b/.test(cur))                                curType = 'shophouse';
    else if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(cur))          curType = 'store';
    else if (/\bkantor\b|\boffice\b/.test(cur))                                        curType = 'office';
    else if (/\bgudang\b|\bwarehouse\b/.test(cur))                                        curType = 'warehouse';
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
      state.fallbackTypes    = [];
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
  if (!state.district && !state.q2cDeclined && state.city && !isBooking && !isCommercial) {
    const areas = getCityLandmarks(state.city);
    const areaEx = areas && areas.length
      ? `Misalnya ${areas.slice(0, 4).join(', ')}, atau area lainnya?`
      : 'Misalnya pusat kota, area selatan, atau kawasan tertentu?';
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

  // Q6 — Patokan lokasi (include wisata, kawasan, dan landmark named examples)
  if (!state.anchorPoint) {
    if (isCommercial)
      return { q: 'Q6', hint: `Ada lokasi atau kawasan tertentu yang jadi prioritas? Misalnya dekat kawasan industri, pelabuhan, atau pusat bisnis? 📍` };
    if (state.city && state.city.toLowerCase().includes('surabaya'))
      return { q: 'Q6', hint: 'Ada lokasi atau tempat tertentu yang jadi patokan? Misalnya dekat Grand City, Pakuwon, KBS, wisata mangrove, sekolah anak, atau jalan tertentu? 📍' };
    return { q: 'Q6', hint: 'Ada lokasi atau tempat tertentu yang jadi patokan? Misalnya dekat sekolah anak, mal, wisata, kawasan tertentu, atau jalan tertentu? 📍' };
  }

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
  const isSale = (state.transactionType || '').toLowerCase().includes('sale')
    || (state.transactionType || '').toLowerCase().includes('beli');

  const missing = [];
  if (!state.transactionType)     missing.push('Q1 Tipe transaksi');
  if (!state.buildingType)        missing.push('Tipe properti');
  if (!state.city)                missing.push('Q2 Lokasi KOTA');
  if (!state.budget)              missing.push('Q3 Budget');
  if (!(Array.isArray(state.facilities) ? state.facilities.length : state.facilities))
                                  missing.push('Q_FAC Fasilitas');
  if (!state.redFlags)            missing.push('Q5 Avoiding & Preference');
  if (!state.viewingDate)         missing.push('Q9b Jadwal survei (tanggal, atau "Minta listing")');
  if (!state.moveInDate)          missing.push('Q8 Tanggal masuk/check-in');
  if (isSale && !state.financing) missing.push('Q_KPR Pembiayaan (WAJIB untuk beli)');
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

/** Recent message text used to decide which conditional skill docs to load (see getProjectSkillInstruction). */
function _skillContext(history = [], userMessage = '') {
  const recent = (history || []).slice(-6).map((h) => h.message || '').join(' ');
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
2. ⚠️ JIKA ADA BANNER "TIPE PROPERTI BERUBAH" DI QUALIFICATION STATE: Akui perubahan singkat (1 kalimat, contoh: "Oke, saya alihkan ke rumah sewa ya 😊"), lalu tanyakan Q terkecil yang masih ❓. JANGAN gunakan jawaban Q2–Q12 dari tipe lama.
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

'use strict';

/**
 * listingSelectionGate.js — M165
 * ==============================================================
 * GERBANG PEMILIHAN LISTING: "Saya pilih no 2, Kak"
 *
 * ── Bug produksi yang melahirkan modul ini (transkrip 29 Agu 2026) ──────────
 * Backend mengirim 2 kartu listing di area MERR. Keduanya BERJUDUL SAMA
 * ("MERR House Sale Surabaya") dan hanya beda harga (451.6 juta vs 471.1 juta).
 * Customer lalu memilih — dengan sangat jelas, tiga cara sekaligus:
 *
 *     [08:53] "Saya mau yang no 2"
 *     [08:53] "Yg hrg 471.1 juta"
 *     [15:08] "Saya pilih no 2, Kak"     (diulang 3x, 15:08 / 15:09 / 15:21)
 *
 * Backend membalas dengan MENGIRIM ULANG kedua kartu yang sama persis. Tidak
 * satu pun dari lima pesan pemilihan itu dipahami sebagai pemilihan.
 *
 * ── Kenapa bisa lolos sejauh ini ────────────────────────────────────────────
 * Tidak ada satu pun kode di backend yang tahu KARTU APA YANG BARU SAJA
 * DIKIRIM. `listingsAlreadyShown` di whatsappAIService.js hanya memeriksa
 * apakah string "Estimasi Harga" pernah muncul di riwayat — cukup untuk
 * MENGHENTIKAN pemicu (b), tapi tidak menyimpan satu pun atribut kartunya.
 * Akibatnya "no 2" tidak punya rujukan: tidak ada daftar untuk dihitung.
 *
 * ── Kenapa dibaca ulang dari riwayat, bukan disimpan di kolom baru ──────────
 * Kartu yang SUDAH TERKIRIM adalah satu-satunya sumber kebenaran tentang apa
 * yang customer LIHAT dan nomori. Kolom "last_shown_listings" akan jadi salinan
 * kedua yang bisa melenceng dari teks nyata (kelas bug M27/M77 yang sudah
 * pernah menggigit proyek ini — lihat catatan renderListingCards). Riwayat chat
 * sudah persisten, sudah per-sesi, dan sudah persis apa yang dibaca customer.
 *
 * ⚠️ Penomoran mengikuti ANGKA YANG TERCETAK di kartu ("1.", "2."), bukan urutan
 * array — kalau keduanya pernah berbeda, yang benar adalah yang dilihat
 * customer.
 *
 * ── Empat cara customer menyebut pilihan (spec pemilik proyek 29 Agu 2026) ──
 *   1. NOMOR  — "no 2", "nomer 2", "yang kedua", "#2", "2"
 *   2. HARGA  — "yg hrg 471.1 juta", "yang 471 juta"
 *   3. NAMA   — "MERR House Sale Surabaya"
 *   4. NAMA+HARGA gabungan
 *
 * Bila nama saja tidak cukup membedakan (kasus MERR di atas: dua kartu berjudul
 * identik), gerbang WAJIB bertanya balik harganya — bukan menebak dan bukan
 * mengirim ulang katalog.
 */

/* ── Pengenalan nomor pilihan ──────────────────────────────────────────────
 * `no` sengaja TIDAK memakai \b di belakang supaya "no.2"/"no2" ikut tertangkap;
 * variasi ejaan "nomer" (sangat umum di chat Indonesia) ditulis eksplisit.
 */
const ORDINAL_WORD = {
  pertama: 1, satu: 1, kesatu: 1,
  kedua: 2, dua: 2,
  ketiga: 3, tiga: 3,
  keempat: 4, empat: 4,
  kelima: 5, lima: 5,
  keenam: 6, enam: 6,
};

const NUM_PICK_RE = /(?:\b(?:no|nomor|nomer|number|opsi|pilihan|item|urutan)\b\s*\.?\s*|#)(\d{1,2})\b/i;
const PICK_VERB_RE = /\b(?:pilih|ambil|mau|milih|take|choose|pick|select)\b[^0-9]{0,20}(\d{1,2})\b/i;
const ORDINAL_WORD_RE = new RegExp(`\\byang\\s+(${Object.keys(ORDINAL_WORD).join('|')})\\b`, 'i');
const BARE_NUM_RE = /^\s*(\d{1,2})\s*[.,!]?\s*$/;

/** Kata yang menandakan customer sedang MEMILIH, bukan sekadar menyebut angka. */
const SELECT_INTENT_RE = /\b(?:pilih|milih|ambil|mau\s+(?:yang|no|nomor|nomer)|saya\s+mau|deal|oke\s+yang|ok\s+yang|choose|pick|select|i'?ll\s+take|go\s+with)\b/i;

/* ── Pengenalan harga ──────────────────────────────────────────────────────
 * Format Indonesia: "471.1 juta" (titik = DESIMAL), "1.2 miliar",
 * "Rp 471.100.000" (titik = pemisah ribuan). Dibedakan oleh ada/tidaknya
 * satuan juta/miliar sesudahnya — tanpa pembedaan ini "471.1" terbaca 4711.
 */
const PRICE_UNIT_RE = /(\d{1,4}(?:[.,]\d{1,3})?)\s*(juta|jt|miliar|milyar|m\b|bn\b|billion|million)/gi;
const PRICE_PLAIN_RE = /(?:rp\.?\s*)(\d{1,3}(?:\.\d{3})+|\d{6,12})/gi;

/**
 * "471.1 juta" → 471100000. Mengembalikan null bila tidak terbaca sebagai angka.
 * @param {string} num  bagian angka ("471.1", "1,2")
 * @param {string} unit satuan ("juta", "miliar", ...)
 */
function unitToNumber(num, unit) {
  const n = parseFloat(String(num).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const u = String(unit || '').toLowerCase();
  if (/^(miliar|milyar|m|bn|billion)$/.test(u)) return Math.round(n * 1e9);
  if (/^(juta|jt|million)$/.test(u))            return Math.round(n * 1e6);
  return null;
}

/** Semua nilai harga yang tersebut dalam sebuah teks (bisa lebih dari satu). */
function extractPrices(text) {
  const out = [];
  const t = String(text || '');
  let m;
  PRICE_UNIT_RE.lastIndex = 0;
  while ((m = PRICE_UNIT_RE.exec(t)) !== null) {
    const v = unitToNumber(m[1], m[2]);
    if (v !== null) out.push(v);
  }
  PRICE_PLAIN_RE.lastIndex = 0;
  while ((m = PRICE_PLAIN_RE.exec(t)) !== null) {
    const v = parseInt(String(m[1]).replace(/\./g, ''), 10);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

/* ── Pembacaan kartu yang SUDAH terkirim ───────────────────────────────────
 * Kartu dirender oleh ResponseBuilderWhatsApp#catalogItemWhatsApp:
 *
 *   2. *MERR House Sale Surabaya*
 *      📍 Lokasi: SURABAYA, JAWA TIMUR
 *      🗺️ Area: MERR
 *      🏡 Alamat: Jl. MERR No. 15, Surabaya
 *      💰 Estimasi Harga: *471.1 juta*
 *      ...
 *
 * `*` maupun `**` diterima: jalur Private Agent memakai satu bintang, template
 * skill-doc (jalur LLM) memakai dua. Sama seperti replySplitter.js.
 */
const CARD_HEAD_RE = /^\s*(\d{1,2})\.\s+\*{1,2}(.+?)\*{1,2}\s*$/m;
const PRICE_LINE_RE = /(?:Estimasi Harga|Estimated Price)\s*:\s*\*{0,2}([^*\n]+)\*{0,2}/i;
const AREA_LINE_RE = /(?:🗺️\s*)?\bArea\s*:\s*([^\n]+)/i;
const ADDRESS_LINE_RE = /(?:🏡\s*)?(?:Alamat|Address)\s*:\s*([^\n]+)/i;

/** Sebuah pesan AI adalah "pesan kartu" bila diawali `N. *Judul*`. */
function isCardMessage(text) {
  return CARD_HEAD_RE.test(String(text || ''));
}

/**
 * Pecah satu blok teks menjadi kartu-kartu (satu pesan bisa memuat >1 kartu
 * bila replySplitter tidak memecahnya).
 */
function parseCardsFromText(text) {
  const t = String(text || '');
  if (!isCardMessage(t)) return [];

  // Potong pada batas kartu, pertahankan header-nya.
  const chunks = t.split(/\n(?=\s*\d{1,2}\.\s+\*{1,2})/).filter((c) => isCardMessage(c));
  return chunks.map((chunk) => {
    const head = chunk.match(CARD_HEAD_RE);
    const priceRaw = (chunk.match(PRICE_LINE_RE) || [])[1] || '';
    const prices = extractPrices(priceRaw);
    return {
      index: parseInt(head[1], 10),
      title: String(head[2] || '').trim(),
      priceText: priceRaw.trim(),
      priceValue: prices.length ? prices[0] : null,
      area: ((chunk.match(AREA_LINE_RE) || [])[1] || '').trim(),
      address: ((chunk.match(ADDRESS_LINE_RE) || [])[1] || '').trim(),
    };
  }).filter((c) => Number.isFinite(c.index) && c.title);
}

/**
 * Kartu-kartu dari BLOK KATALOG TERAKHIR yang dikirim ke customer.
 *
 * Berjalan mundur dari pesan terbaru: lewati apa pun sampai bertemu pesan kartu
 * pertama, lalu terus mundur selama pesan-pesan AI masih berupa kartu (karena
 * replySplitter mengirim tiap kartu sebagai pesan terpisah, satu blok katalog =
 * beberapa pesan AI berurutan). Berhenti pada pesan customer atau pesan AI
 * non-kartu — itu batas blok.
 *
 * @param {Array<{role:string, message?:string, content?:string}>} history
 * @returns {Array<object>} kartu terurut menaik menurut nomor cetaknya
 */
function parseShownListings(history = []) {
  const rows = Array.isArray(history) ? history : [];
  const isAi = (h) => /^(ai|assistant|bot)$/i.test(String(h.role || ''));
  const textOf = (h) => String(h.message || h.content || '');

  let end = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (isAi(rows[i]) && isCardMessage(textOf(rows[i]))) { end = i; break; }
  }
  if (end === -1) return [];

  let start = end;
  while (start - 1 >= 0 && isAi(rows[start - 1]) && isCardMessage(textOf(rows[start - 1]))) {
    start -= 1;
  }

  const cards = [];
  for (let i = start; i <= end; i++) cards.push(...parseCardsFromText(textOf(rows[i])));

  // Nomor cetak adalah identitas kartu. Bila satu blok terkirim dua kali
  // (retry Kirimi), nomor yang sama muncul dua kali — ambil yang terakhir.
  const byIndex = new Map();
  for (const c of cards) byIndex.set(c.index, c);
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

/** Normalisasi judul untuk pembandingan longgar. */
function normTitle(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Baca pilihan customer terhadap daftar kartu yang sudah tampil.
 *
 * @returns {null | {
 *   status: 'matched'|'ambiguous'|'conflict'|'out-of-range',
 *   card?: object, candidates?: object[], askedIndex?: number, askedPrice?: number
 * }}
 *   null = pesan ini memang bukan pemilihan (biarkan alur normal jalan).
 */
function detectSelection(message, shown = []) {
  const text = String(message || '').trim();
  if (!text || !shown.length) return null;

  /* 1 ── NOMOR ------------------------------------------------------------ */
  let pickedIndex = null;
  const mNum = text.match(NUM_PICK_RE) || text.match(PICK_VERB_RE);
  if (mNum) pickedIndex = parseInt(mNum[1], 10);
  if (pickedIndex === null) {
    const mWord = text.match(ORDINAL_WORD_RE);
    if (mWord) pickedIndex = ORDINAL_WORD[String(mWord[1]).toLowerCase()] || null;
  }
  // Angka telanjang ("2") hanya dianggap pilihan bila pesannya memang cuma itu —
  // jangan sampai "2 kamar tidur" atau "budget 2 M" terbaca sebagai pilihan.
  if (pickedIndex === null) {
    const mBare = text.match(BARE_NUM_RE);
    if (mBare) pickedIndex = parseInt(mBare[1], 10);
  }

  /* 2 ── HARGA ------------------------------------------------------------ */
  // Toleransi ±0.5% menjaga pembulatan tampilan ("471.1 juta" untuk 471.100.000)
  // tetap cocok, tanpa cukup longgar untuk menyentuh kartu tetangga.
  const saidPrices = extractPrices(text);
  const priceHits = [];
  for (const p of saidPrices) {
    for (const c of shown) {
      if (c.priceValue === null) continue;
      const tol = Math.max(c.priceValue * 0.005, 1000);
      if (Math.abs(c.priceValue - p) <= tol && !priceHits.includes(c)) priceHits.push(c);
    }
  }

  /* 3 ── NAMA ------------------------------------------------------------- */
  const nt = normTitle(text);
  const titleHits = shown.filter((c) => {
    const ct = normTitle(c.title);
    return ct.length >= 6 && nt.includes(ct);
  });

  const saidSomething = pickedIndex !== null || priceHits.length > 0 || titleHits.length > 0;
  if (!saidSomething) return null;

  // Angka/harga saja tanpa niat memilih DAN tanpa kecocokan harga bukan pilihan
  // — mis. "3 kamar" saat daftar punya kartu no. 3. Kalau harganya cocok persis
  // dengan kartu yang tampil, itu sinyal yang jauh lebih kuat dari kata kerja.
  // "yang kedua" ikut dihitung sebagai frasa pemilihan eksplisit: bentuk itu
  // TIDAK PERNAH muncul sebagai spesifikasi properti (tidak ada "yang kedua
  // kamar"), berbeda dari angka telanjang yang memang ambigu.
  if (pickedIndex !== null && !priceHits.length && !titleHits.length
      && !SELECT_INTENT_RE.test(text) && !NUM_PICK_RE.test(text)
      && !ORDINAL_WORD_RE.test(text) && !BARE_NUM_RE.test(text)) {
    return null;
  }

  const byIndex = shown.find((c) => c.index === pickedIndex) || null;

  /* ── Gabungkan sinyal ---------------------------------------------------- */
  // Nomor + harga sama-sama disebut (kasus "no 2" + "471.1 juta"): bila
  // keduanya menunjuk kartu yang SAMA itu konfirmasi terkuat yang mungkin ada.
  if (byIndex && priceHits.length === 1) {
    if (priceHits[0].index === byIndex.index) return { status: 'matched', card: byIndex };
    return {
      status: 'conflict', candidates: [byIndex, priceHits[0]],
      askedIndex: pickedIndex, askedPrice: saidPrices[0],
    };
  }
  if (byIndex) return { status: 'matched', card: byIndex };

  if (pickedIndex !== null && !byIndex && !priceHits.length && !titleHits.length) {
    return { status: 'out-of-range', askedIndex: pickedIndex, candidates: shown };
  }

  if (priceHits.length === 1) return { status: 'matched', card: priceHits[0] };
  if (priceHits.length > 1)   return { status: 'ambiguous', candidates: priceHits };

  if (titleHits.length === 1) return { status: 'matched', card: titleHits[0] };
  if (titleHits.length > 1) {
    // Justru kasus MERR: dua kartu berjudul identik. Jangan menebak — tanyakan
    // harganya, satu-satunya pembeda yang customer benar-benar bisa lihat.
    return { status: 'ambiguous', candidates: titleHits };
  }

  return null;
}

/** Baris ringkas satu kartu untuk kalimat konfirmasi. */
function cardLabel(card) {
  const bits = [card.title];
  if (card.priceText) bits.push(card.priceText);
  return bits.join(' — ');
}

/**
 * Susun balasan untuk hasil detectSelection(). Hanya dipanggil di profil
 * guardrail 'local'; di profil 'platform' teks yang sama dikirim sebagai FAKTA.
 */
function composeSelectionReply(sel, { isId = true, message = '' } = {}) {
  if (!sel) return null;

  if (sel.status === 'matched') {
    const c = sel.card;
    const detail = [
      c.address ? (isId ? `🏡 Alamat: ${c.address}` : `🏡 Address: ${c.address}`) : null,
      c.priceText ? (isId ? `💰 Estimasi Harga: ${c.priceText}` : `💰 Estimated Price: ${c.priceText}`) : null,
    ].filter(Boolean).join('\n');

    /* ⭐ M186 (6 Sep 2026) — SURVEI SUDAH DIMINTA DI PESAN YANG SAMA.
     * Bug produksi nyata: "Saya pilih no 1, Kak. Saya mau survei juga. Kpn
     * anda ada waktu?" — customer SUDAH menjawab "ya" untuk survei di
     * kalimat yang sama dia memilih unitnya. Versi lama SELALU menutup
     * dengan "Mau saya jadwalkan survei ke unit ini?" — pertanyaan yes/no
     * untuk sesuatu yang sudah dijawab "ya", persis anti-pattern "jangan
     * tanya ulang yang sudah dijawab" (doc 00/02). customerRequestsViewing()
     * (utils/customerQuestionGuard.js) dipakai apa adanya — jangan
     * menduplikasi daftar kata kerja survei di sini (kelas bug M27/M77).
     * Survei butuh TANGGAL + JAM (doc 04 §3b) — langsung minta keduanya
     * alih-alih bertanya ya/tidak yang sudah terjawab.
     */
    const { customerRequestsViewing } = require('./customerQuestionGuard');
    const surveyAlreadyRequested = customerRequestsViewing(message);

    const closing = surveyAlreadyRequested
      ? (isId
        ? `Siap, Kak 😊 Untuk survei ke unit ini, Kakak bisa tanggal berapa dan jam berapa?`
        : `Great 😊 For the viewing, what date and time work for you?`)
      : (isId ? `Mau saya jadwalkan survei ke unit ini?` : `Shall I arrange a viewing for this unit?`);

    return isId
      ? `Baik, Kak 😊 Dicatat pilihannya: *${c.title}*${c.priceText ? ` (${c.priceText})` : ''}.\n`
        + (detail ? `\n${detail}\n` : '')
        + `\n${closing}`
      : `Noted 😊 Your pick: *${c.title}*${c.priceText ? ` (${c.priceText})` : ''}.\n`
        + (detail ? `\n${detail}\n` : '')
        + `\n${closing}`;
  }

  if (sel.status === 'ambiguous') {
    const opts = sel.candidates
      .map((c) => `• ${isId ? 'No.' : 'No.'} ${c.index} — ${c.priceText || '-'}`)
      .join('\n');
    return isId
      ? `Biar tidak keliru, Kak 🙏 Ada ${sel.candidates.length} unit dengan nama yang sama, bedanya di harga:\n${opts}\n\nYang mana yang Kakak maksud?`
      : `Just to be sure 🙏 There are ${sel.candidates.length} units with the same name, differing by price:\n${opts}\n\nWhich one did you mean?`;
  }

  if (sel.status === 'conflict') {
    const opts = sel.candidates
      .map((c) => `• No. ${c.index} — ${c.title}${c.priceText ? ` (${c.priceText})` : ''}`)
      .join('\n');
    return isId
      ? `Mohon dikonfirmasi dulu, Kak 🙏 Nomor dan harga yang Kakak sebut menunjuk unit yang berbeda:\n${opts}\n\nYang mana yang Kakak pilih?`
      : `Quick check 🙏 The number and the price you mentioned point to different units:\n${opts}\n\nWhich one do you mean?`;
  }

  if (sel.status === 'out-of-range') {
    const max = sel.candidates.length;
    return isId
      ? `Mohon maaf, Kak 🙏 Saya baru menampilkan ${max} unit (no. 1${max > 1 ? `–${max}` : ''}), jadi belum ada no. ${sel.askedIndex}.\n\nMau pilih dari yang sudah ada, atau saya carikan opsi tambahan?`
      : `Sorry 🙏 I've only shown ${max} unit${max > 1 ? 's' : ''} (no. 1${max > 1 ? `–${max}` : ''}), so there's no no. ${sel.askedIndex} yet.\n\nPick from these, or shall I find more options?`;
  }

  return null;
}

/**
 * Pintu masuk gerbang. Mengembalikan { reply, verdict, card? } atau null.
 *
 * @param {object}   p
 * @param {string}   p.message  pesan customer saat ini
 * @param {Array}    p.history  riwayat percakapan (sessionService.getConversationHistory)
 * @param {boolean}  p.isId
 */
function tryListingSelectionAnswer({ message, history = [], isId = true }) {
  try {
    const shown = parseShownListings(history);
    if (!shown.length) return null;

    const sel = detectSelection(message, shown);
    if (!sel) return null;

    const reply = composeSelectionReply(sel, { isId, message });
    if (!reply) return null;

    return { reply, verdict: sel.status, card: sel.card || null, shownCount: shown.length };
  } catch (err) {
    // Fail-open: gerbang non-kritis tidak boleh menghentikan balasan.
    console.error('[LISTING SELECTION GATE ERROR]', err.message);
    return null;
  }
}

/* ── M189 (7 Sep 2026) — KONFIRMASI SURVEI PADA GILIRAN BERIKUTNYA ─────────
 * Bug produksi nyata: AI mengonfirmasi pilihan lalu bertanya "Mau saya
 * jadwalkan survei ke unit ini?" (satu-satunya penutup yang ADA saat
 * `customerRequestsViewing(message)` di composeSelectionReply() bernilai
 * false, mis. saat pemilihan disebut sendirian tanpa kata survei). Customer
 * menjawab TERPISAH pada giliran berikutnya — "Mau, Kak", atau "Saya mau
 * survei, Kak" / "Kapan bisa survei?". Tak satu pun jawaban itu menyebut
 * nomor/harga/judul listing, jadi `detectSelection()` di atas mengembalikan
 * null (BENAR sesuai desainnya — itu bukan pemilihan). Gerbang ini SENGAJA
 * terpisah: tugasnya bukan "customer memilih apa", tapi "customer menjawab
 * pertanyaan yes/no yang barusan AI ajukan sendiri" — kelas pertanyaan yang
 * berbeda, jadi butuh pengenal berbeda (dijawab dari PESAN AI SEBELUMNYA,
 * bukan dari katalog).
 *
 * Tanpa ini, jawaban itu jatuh ke gerbang ketersediaan area/kota di bawahnya
 * (tidak mengenali "Mau, Kak" sebagai apa pun), yang lalu MENJALANKAN ULANG
 * pencarian dan mengirim ulang katalog — persis transkrip produksi 7 Sep
 * 2026 (Alana Cemandi, 3 kali berturut-turut).
 */
const PENDING_VIEWING_OFFER_RE = /mau saya jadwalkan survei ke unit ini\?|shall i arrange a viewing for this unit\?/i;
const PICK_CONFIRM_LINE_RE = /(?:dicatat pilihannya|your pick)\s*:\s*\*(.+?)\*(?:\s*\(([^)]+)\))?/i;
const VIEWING_AFFIRM_RE = /^\s*(?:ya+h?|iya+|yoi|yup|yep|yes|mau|boleh|blh|oke?|ok(?:e|ay)?|siap|sip|silak?an|lanjut|gas|deal|bisa)\b[^?]{0,25}$/i;
const VIEWING_DECLINE_RE = /^\s*(?:tidak|nggak|ga+k?|blm|belum|nanti\s+(?:saja|sj|aja|dulu|dlu)|engga+|no|not\s+now)\b/i;

/** Teks AI paling akhir dalam riwayat (baris apa pun sebelum giliran saat ini). */
function lastAiMessage(history = []) {
  const rows = Array.isArray(history) ? history : [];
  const isAi = (h) => /^(ai|assistant|bot)$/i.test(String(h.role || ''));
  for (let i = rows.length - 1; i >= 0; i--) {
    if (isAi(rows[i])) return String(rows[i].message || rows[i].content || '');
  }
  return '';
}

/**
 * Bila giliran AI SEBELUMNYA barusan menawarkan survei ("Mau saya jadwalkan
 * survei ke unit ini?") atas sebuah pilihan yang sudah dicatat, dan pesan
 * customer SEKARANG adalah jawaban ya/tidak atau permintaan survei eksplisit
 * — jawab langsung, jangan biarkan gerbang lain menjalankan ulang pencarian.
 *
 * @returns {null | { reply: string, verdict: 'viewing-confirmed'|'viewing-declined' }}
 */
function tryPendingViewingConfirmation({ message, history = [], isId = true }) {
  try {
    const text = String(message || '').trim();
    if (!text) return null;

    const lastAi = lastAiMessage(history);
    if (!lastAi || !PENDING_VIEWING_OFFER_RE.test(lastAi)) return null;

    if (VIEWING_DECLINE_RE.test(text)) {
      return {
        reply: isId
          ? `Baik, Kak 😊 Kalau berubah pikiran atau mau jadwalkan nanti, tinggal bilang saja ya.`
          : `No problem 😊 Just let me know whenever you'd like to schedule it.`,
        verdict: 'viewing-declined',
      };
    }

    const { customerRequestsViewing } = require('./customerQuestionGuard');
    if (VIEWING_AFFIRM_RE.test(text) || customerRequestsViewing(text)) {
      const m = lastAi.match(PICK_CONFIRM_LINE_RE);
      const title = m ? String(m[1]).trim() : '';
      const priceText = m && m[2] ? String(m[2]).trim() : '';
      const label = title ? `*${title}*${priceText ? ` (${priceText})` : ''}` : (isId ? 'unit ini' : 'this unit');
      return {
        reply: isId
          ? `Siap, Kak 😊 Untuk survei ke ${label}, Kakak bisa tanggal berapa dan jam berapa?`
          : `Great 😊 For the viewing to ${label}, what date and time work for you?`,
        verdict: 'viewing-confirmed',
      };
    }

    return null;
  } catch (err) {
    // Fail-open: gerbang non-kritis tidak boleh menghentikan balasan.
    console.error('[PENDING VIEWING GATE ERROR]', err.message);
    return null;
  }
}

/* ── M189b (7 Sep 2026) — CUSTOMER MENJAWAB TANGGAL+JAM YANG BARU DITANYA ──
 * Transkrip produksi lanjutan: gerbang di atas sudah benar bertanya "Kakak
 * bisa tanggal berapa dan jam berapa?". Customer menjawab "Saya bisa survei
 * minggu depan Kak. Jam 12 siang ya" — TAPI tak ada gerbang yang menunggu
 * jawaban itu, jadi pesan jatuh ke gerbang ketersediaan area dan katalog
 * terkirim ulang untuk KETIGA KALINYA dalam satu sesi. `parseCustomerDate`/
 * `parseSurveyTime` sudah lama ada (dipakai extractQualificationState untuk
 * Q9b/Q9c di jalur LLM) — dipakai ULANG di sini, bukan ditulis kedua kali.
 */
const { parseCustomerDate, parseSurveyTime } = require('./customerDateParser');

const PENDING_SCHEDULE_ASK_RE = /tanggal berapa dan jam berapa\?|what date and time work for you\?/i;

/**
 * Bila giliran AI SEBELUMNYA barusan menanyakan tanggal+jam survei (keluaran
 * `tryPendingViewingConfirmation` di atas), baca tanggal/jam dari jawaban
 * customer dan tutup jadwalnya — jangan biarkan gerbang lain menjalankan
 * ulang pencarian selagi customer sedang menjawab jadwal.
 *
 * @returns {null | { reply: string, verdict: string }}
 */
function tryPendingViewingSchedule({ message, history = [], isId = true }) {
  try {
    const text = String(message || '').trim();
    if (!text) return null;

    const lastAi = lastAiMessage(history);
    if (!lastAi || !PENDING_SCHEDULE_ASK_RE.test(lastAi)) return null;

    if (VIEWING_DECLINE_RE.test(text)) {
      return {
        reply: isId
          ? `Baik, Kak 😊 Kalau berubah pikiran atau mau jadwalkan nanti, tinggal bilang saja ya.`
          : `No problem 😊 Just let me know whenever you'd like to schedule it.`,
        verdict: 'viewing-declined',
      };
    }

    const d = parseCustomerDate(text);
    const dateFormatted = d && d.status === 'ok' ? d.formatted : null;
    const timeFormatted = parseSurveyTime(text, { requireClockWord: false });

    if (dateFormatted && timeFormatted) {
      return {
        reply: isId
          ? `Baik, Kak 😊 Survei dijadwalkan tanggal *${dateFormatted}*, *${timeFormatted}* ya. Nanti tim kami hubungi untuk konfirmasi.`
          : `Great 😊 The viewing is scheduled for *${dateFormatted}*, *${timeFormatted}*. Our team will follow up to confirm.`,
        verdict: 'viewing-scheduled',
      };
    }
    if (dateFormatted && !timeFormatted) {
      return {
        reply: isId
          ? `Siap, tanggal *${dateFormatted}* ya, Kak 😊 Kira-kira jam berapa yang paling pas?`
          : `Got it, *${dateFormatted}* it is 😊 What time works best?`,
        verdict: 'viewing-date-only',
      };
    }
    if (!dateFormatted && timeFormatted) {
      return {
        reply: isId
          ? `Baik, jam *${timeFormatted}* dicatat, Kak 😊 Untuk tanggalnya, hari apa yang pas?`
          : `Noted, *${timeFormatted}* 😊 And what date works for you?`,
        verdict: 'viewing-time-only',
      };
    }

    // Tak satu pun terbaca — jangan biarkan gerbang lain menganggap ini
    // pesan lain (mis. area kosong) dan menjalankan pencarian ulang.
    return {
      reply: isId
        ? `Maaf, Kak 🙏 Boleh disebutkan tanggal dan jam yang pas untuk surveinya?`
        : `Sorry 🙏 Could you share the date and time that work for the viewing?`,
      verdict: 'viewing-schedule-unclear',
    };
  } catch (err) {
    console.error('[PENDING VIEWING SCHEDULE GATE ERROR]', err.message);
    return null;
  }
}

module.exports = {
  tryListingSelectionAnswer,
  tryPendingViewingConfirmation,
  tryPendingViewingSchedule,
  lastAiMessage,
  parseShownListings,
  parseCardsFromText,
  detectSelection,
  composeSelectionReply,
  extractPrices,
  isCardMessage,
};

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
const PRICE_LINE_RE = /(?:Estimasi Harga|Estimated Price|Harga|Price)\s*:\s*\*{0,2}([^*\n]+)\*{0,2}/i;
/* M194 (12 Sep 2026) — FORMAT KARTU BUATAN PLATFORM AI. DeepSeek menulis
 * "🏡 Jl. Candramas No. 92, Sidoarjo" (tanpa label "Alamat:") dan
 * "💰 *Rp 351,7 juta*" (tanpa "Estimasi Harga:"). Parser lama membaca
 * address/price kosong → fakta pilihan "Dicatat pilihannya: *Judul*" tanpa
 * alamat/harga → model mengarang "No. 93, Rp 415.000.000". Kini ada cadangan
 * tanpa label: baris apa pun yang memuat "Jl." / 💰 / Rp. */
const PRICE_LINE_FALLBACK_RE = /(?:💰|💸)\s*\*{0,2}((?:Rp\s?)?[\d.,]+\s*(?:juta|jt|miliar|milyar|m)\b[^*\n]*)\*{0,2}/i;
const ADDRESS_LINE_FALLBACK_RE = /(?:🏡|📍)?\s*\*{0,2}((?:Jl|Jalan)\.?\s[^\n*]{3,80})/i;
const AREA_LINE_RE = /(?:🗺️\s*)?\bArea\s*:\s*([^\n]+)/i;
const ADDRESS_LINE_RE = /(?:🏡\s*)?(?:Alamat|Address)\s*:\s*([^\n]+)/i;
/* M193 — TIPE unit dari baris kartu "🏠 Tipe: Apartemen — Disewakan". Ringkasan
 * harus mengikuti tipe unit yang DIPILIH, bukan kata pertama customer di awal
 * sesi (transkrip 14 Sep 2026: "✓ Tipe: Rumah" padahal yang dipilih apartemen). */
const TYPE_LINE_RE = /(?:🏠\s*)?\b(?:Tipe|Type)\s*:\s*\*{0,2}([^\n*—-]+)/i;
const TYPE_LABEL_TO_KEY = {
  rumah: 'house', house: 'house', apartemen: 'apartment', apartment: 'apartment', villa: 'villa', vila: 'villa',
  kos: 'boarding_house', kost: 'boarding_house', 'kos-kosan': 'boarding_house', 'boarding house': 'boarding_house',
  ruko: 'shophouse', rukan: 'shophouse', shophouse: 'shophouse', kantor: 'office', office: 'office',
  gudang: 'warehouse', warehouse: 'warehouse', toko: 'store', store: 'store', hotel: 'hotel',
  kondotel: 'kondotel', condotel: 'kondotel', mansion: 'mansion', tanah: 'land', kavling: 'land', land: 'land',
};
function typeLabelToKey(label) {
  const l = String(label || '').trim().toLowerCase();
  return TYPE_LABEL_TO_KEY[l] || null;
}

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
    const priceRaw = (chunk.match(PRICE_LINE_RE) || chunk.match(PRICE_LINE_FALLBACK_RE) || [])[1] || '';
    const prices = extractPrices(priceRaw);
    const addressRaw = ((chunk.match(ADDRESS_LINE_RE) || chunk.match(ADDRESS_LINE_FALLBACK_RE) || [])[1] || '')
      .replace(/\s*[·—-]\s*$/, '').trim();
    return {
      index: parseInt(head[1], 10),
      title: String(head[2] || '').trim(),
      priceText: priceRaw.trim(),
      priceValue: prices.length ? prices[0] : null,
      area: ((chunk.match(AREA_LINE_RE) || [])[1] || '').trim(),
      address: addressRaw,
      typeLabel: ((chunk.match(TYPE_LINE_RE) || [])[1] || '').trim(),
      typeKey: typeLabelToKey(((chunk.match(TYPE_LINE_RE) || [])[1] || '').trim()),
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

  /* M191 (12 Sep 2026) — NOMOR KARTU BERLANJUT LINTAS PESAN.
   * Platform AI (sesuai doc 03: "never renumber") melanjutkan nomor kartu di
   * pesan berikutnya: blok pertama 1-2, blok berikut 3-4. Versi lama hanya
   * membaca BLOK TERAKHIR, jadi "Saya pilih nomer 2" saat blok terakhir
   * bernomor 3-4 divonis out-of-range dan backend mengirim FAKTA SALAH
   * "belum ada no. 2" — padahal no. 2 jelas pernah tampil. Kini blok-blok
   * sebelumnya ikut dibaca; nomor yang sama diambil dari blok TERBARU. */
  for (let i = start - 1; i >= 0; i--) {
    if (isAi(rows[i]) && isCardMessage(textOf(rows[i]))) cards.push(...parseCardsFromText(textOf(rows[i])));
  }

  // Nomor cetak adalah identitas kartu. Bila nomor yang sama muncul dua kali
  // (retry Kirimi / blok ulang), yang TERBARU (dibaca lebih dulu) menang.
  const byIndex = new Map();
  for (const c of cards) if (!byIndex.has(c.index)) byIndex.set(c.index, c);
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

/**
 * M199 — SEMUA kartu yang pernah dikirim di sesi (semua blok, urut kronologis),
 * dedup per (judul+alamat); `index` = nomor cetak di bloknya, `block` = urutan blok.
 * Berbeda dari parseShownListings (nomor cetak = identitas, blok terbaru menang):
 * saat area berganti nomor kartu dimulai ulang dari 1 (kontrak M192), sehingga
 * kartu blok lama HILANG dari parseShownListings — padahal customer plin-plan
 * masih merujuknya ("yang tadi di MERR nomor 2"). Fungsi ini menyimpannya.
 */
function parseAllShownCards(history = []) {
  const rows = Array.isArray(history) ? history : [];
  const isAi = (h) => /^(ai|assistant|bot)$/i.test(String(h.role || ''));
  const out = []; let block = 0; let prevWasCard = false;
  for (const h of rows) {
    const text = String(h.message || h.content || '');
    const isCard = isAi(h) && isCardMessage(text);
    if (isCard) {
      if (!prevWasCard) block += 1;
      for (const c of parseCardsFromText(text)) {
        const key = normTitle(`${c.title} ${c.address || ''}`);
        const j = out.findIndex((x) => normTitle(`${x.title} ${x.address || ''}`) === key);
        const item = { ...c, block };
        if (j >= 0) out[j] = item; else out.push(item);
      }
    }
    if (isAi(h)) prevWasCard = isCard;
  }
  return out;
}

/** M199 — customer membandingkan beberapa unit ("bedanya", "masing-masing", "lebih murah"). */
const COMPARE_CUE_RE = /\b(bedanya|perbedaan|banding\w*|masing[-\s]?masing|lebih\s+(?:murah|mahal|luas|besar|kecil)|termurah|termahal|paling\s+(?:murah|mahal|luas))\b/i;

/** Nama area yang disebut di pesan, dicocokkan ke area kartu yang pernah dikirim (nama PERSIS menang). */
function mentionedCardArea(message, cards) {
  const text = String(message || '');
  const areas = [...new Set(cards.map((c) => String(c.area || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hits = areas.filter((a) => new RegExp(`\\b${esc(a)}\\b`, 'i').test(text));
  if (!hits.length) return '';
  // "Tropodo" & "Wisma Tropodo" keduanya cocok pada "…Wisma Tropodo…" → yang terpanjang;
  // pada "…Tropodo…" saja hanya "Tropodo" yang cocok.
  return hits[0];
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
/* ── M198 (13 Sep 2026) — PERTANYAAN ATRIBUT UNIT (jalur Private Agent) ────
 * "Yang nomor 2 luas tanahnya berapa?", "Sertifikatnya apa?", "Sudah termasuk
 * IPL?", "Apakah rumah tersebut banjir?" dulu dijawab "Dicatat pilihannya…"
 * (dianggap memilih) atau "Boleh diulang maksudnya?" (post-pick fallback).
 * Kini dijawab dari KARTU + baris DB agent (sertifikat, luas, kamar, fasilitas);
 * atribut yang tidak tercatat (banjir/panas/IPL/lantai/jam malam) dijawab
 * jujur "belum tercatat, nanti dikonfirmasi agent". */
const ATTR_RE = {
  certificate: /\b(sertifikat\w*|shm|shgb|shmsrs|hak\s*milik|hak\s*guna)\b/i,
  land: /\b(luas\s*tanah|tanahnya|lt\b|luas\s*lahan)\b/i,
  building: /\b(luas\s*bangunan|bangunannya|lb\b)\b/i,
  area_any: /\b(luas(?:nya)?\s*(?:berapa|\?)|berapa\s+luas|luas\s+(?:tanah|bangunan|rumah|unit)|ukuran|berapa\s*meter|m2|m²)\b/i,
  rooms: /\b(kamar\w*|kt\b|km\b|bedroom\w*|bathroom\w*)\b/i,   // M193: kamarnya/kamarny/kamar-kamar
  address: /\b(alamat\w*|lokasinya\s+di\s+mana|di\s+mana\s+(?:persis|tepat)nya|share\s*lok\w*|maps)\b/i,
  price: /\b(harga\w*|berapa\s*duit|hrg\w*|berapa\s*(?:per|se)\s*(?:bulan|tahun|hari|malam)|per\s*bulan|sebulan|per\s*tahun|setahun|sewanya\s*berapa)\b/i,
  availability: /\b(masih\s+(?:ada|tersedia|available|kosong)|sudah\s+(?:laku|terjual|tersewa|dibooking|di-?booking)|belum\s+laku)\b/i,
  facilities: /\b(fasilitas|ada\s+(?:ac|gym|kolam|lift|carport|garasi|taman|garden|cctv|security|satpam|parkir|parking|wifi|water\s*heater|kitchen|dapur|kompor|musholla|laundry|kid[sz]|playground|pet\s*\w+|jogging|minimarket|balkon|balcony)\w*|furnished|furnitur|perabot)\b/i,
  unknown: /\b(banjir|panas|bising|berisik|ipl|lantai\s*berapa|bertingkat|tingkat|satu\s+lantai|dua\s+lantai|kolam\w*|pool|tower|jam\s*malam|pasangan|suami\s*istri|pemilik|owner|nego|diskon|promo|potongan|bisa\s+kurang|turun\s+harga|dekat\s+sekolah|sekolah|tetangga|lingkungan|air|listrik\s*berapa|watt|hadap|renovasi|direnovasi|tahun\s+dibangun|usia\s+bangunan|umur\s+bangunan|pbb|lunas|tunggakan|patokan\w*|dekat\s+apa|imb|pbg|denah|floor\s*plan|legalitas|dokumen\w*|berkas|surat[-\s]surat|deposit\w*|uang\s+jaminan|termin|cicil\w*|bulanan|tahunan|bayar\s+(?:per|tiap|setiap|di\s+tempat|di\s+muka|setahun|sebulan)|per\s+\d+\s+bulan|dekat\s+tol|tol\b|angkot|bus\b|transport\w*|akses\w*|stasiun|halte|kursi\s+roda|difabel|lansia|tangga|check[-\s]?in|check[-\s]?out|jam\s+masuk|parkir\w*|parking|muat\s+\d+\s+mobil|zonasi|izin\s+usaha|hewan|peliharaan|pet\b|kucing|anjing|dapur|kitchen|kompor|penyewa\w*|tenant\w*|yield|roi|balik\s+modal|cash\s+bertahap|bertahap|cash\s+keras)\b/i,
};
// M198b: "Yang tidak dekat jalan raya ya, berisik" adalah PERNYATAAN (red flag), bukan
// pertanyaan — negasi hanya dihitung bila di UJUNG kalimat ("banjir nggak?", "dekat sekolah nggak").
const ATTR_QUESTION_RE = /\?|\b(apa|berapa|brp|apakah|gimana|bagaimana|kah|bisa|boleh|tolong|minta|kirim\w*|share)\b|\b(nggak|ngga|gak|tidak|tdk|sudah|belum)\s*\??\s*$/i;

function isAttributeQuestion(message) {
  const t = String(message || '');
  if (!ATTR_QUESTION_RE.test(t)) return false;
  return Object.values(ATTR_RE).some((re) => re.test(t));
}

async function findRowForCard(userId, card) {
  if (!userId || !card) return null;
  try {
    const { getDbPropertiesForAgent } = require('../services/propertyRecommendationService');
    const rows = await getDbPropertiesForAgent(userId);
    const addr = normTitle(card.address || '');
    if (addr) {
      const hit = rows.find((r) => normTitle(r.address || '') === addr);
      if (hit) return hit;
    }
    const key = normTitle(`${card.title} ${card.priceText || ''}`);
    return rows.find((r) => normTitle(`${r.title} ${r.price || ''}`) === key) || null;
  } catch { return null; }
}

/**
 * Jawab pertanyaan atribut tentang SATU kartu. Mengembalikan null bila pesan
 * bukan pertanyaan atribut.
 */
async function answerCardAttribute({ message, card, userId = null, isId = true }) {
  if (!card || !isAttributeQuestion(message)) return null;
  const t = String(message || '');
  const row = await findRowForCard(userId, card);
  const label = `*${card.title}*${card.address ? ` (${card.address})` : ''}`;
  const parts = [];
  const unknownLine = isId
    ? 'belum tercatat di data unit ini, Kak — saya catat dulu, nanti dikonfirmasi langsung oleh agent kami 🙏'
    : 'is not recorded for this unit — I have noted it and our agent will confirm 🙏';
  if (ATTR_RE.certificate.test(t)) {
    const c = row && row.certificateType ? String(row.certificateType).toUpperCase() : '';
    parts.push(c ? (isId ? `sertifikatnya *${c}*` : `the certificate is *${c}*`) : (isId ? `sertifikatnya ${unknownLine}` : `the certificate ${unknownLine}`));
  }
  if (ATTR_RE.land.test(t) || (ATTR_RE.area_any.test(t) && !ATTR_RE.building.test(t))) {
    const v = row && row.landArea ? `${String(row.landArea).replace(/\s*(m2|m²|sqm)\s*$/i, '')} m²` : '';
    parts.push(v ? (isId ? `luas tanah *${v}*` : `land area *${v}*`) : (isId ? `luas tanahnya ${unknownLine}` : `land area ${unknownLine}`));
  }
  if (ATTR_RE.building.test(t)) {
    const v = row && row.buildingArea ? `${String(row.buildingArea).replace(/\s*(m2|m²|sqm)\s*$/i, '')} m²` : '';
    parts.push(v ? (isId ? `luas bangunan *${v}*` : `building area *${v}*`) : (isId ? `luas bangunannya ${unknownLine}` : `building area ${unknownLine}`));
  }
  if (ATTR_RE.rooms.test(t) && !ATTR_RE.unknown.test(t)) {
    const v = row && (row.bedrooms || row.bathrooms) ? `${row.bedrooms || '-'} KT, ${row.bathrooms || '-'} KM` : '';
    parts.push(v ? (isId ? `kamarnya *${v}*` : `rooms *${v}*`) : (isId ? `jumlah kamarnya ${unknownLine}` : `rooms ${unknownLine}`));
  }
  if (ATTR_RE.address.test(t)) {
    const v = row && row.address ? row.address : card.address;
    parts.push(v ? (isId ? `alamatnya *${v}*` : `the address is *${v}*`) : (isId ? `alamat lengkapnya ${unknownLine}` : `the full address ${unknownLine}`));
  }
  if (ATTR_RE.availability.test(t)) {
    parts.push(isId
      ? 'masih tercatat *tersedia* di data agent kami per hari ini — agent akan konfirmasi ulang sebelum survei'
      : 'is still listed as *available* in our agent\'s data as of today — the agent will reconfirm before the viewing');
  }
  if (ATTR_RE.price.test(t) && !/nego|diskon/i.test(t)) {
    const v = card.priceText || (row && row.price) || '';
    parts.push(v ? (isId ? `harganya *${v}*` : `the price is *${v}*`) : (isId ? `harganya ${unknownLine}` : `the price ${unknownLine}`));
  }
  if (ATTR_RE.facilities.test(t)) {
    const f = row && row.facilities ? (Array.isArray(row.facilities) ? row.facilities.join(', ') : String(row.facilities)) : '';
    const furn = row && row.furnishedStatus ? String(row.furnishedStatus) : '';
    const v = [f, furn].filter(Boolean).join(' · ');
    /* M193 (14 Sep 2026) — BANDINGKAN KEBUTUHAN DENGAN DATA NYATA, jangan cuma
     * menyalin daftar. Transkrip: "saya ingin fasilitas kids zone, gym dan
     * kolam renang; apakah bisa dibantu?" dibalas daftar fasilitas mentah —
     * pertanyaannya sendiri tidak terjawab. Sekarang tiap fasilitas yang
     * diminta dicek satu per satu: ada / belum tercatat. */
    const FAC = {
      'kolam renang': /\b(kolam\s*renang|swimming|pool)\b/i, 'gym': /\b(gym|fitness)\b/i,
      'kids zone': /\b(kid[sz]?\s*zone|kids?\s*playground|children\s*playground|taman\s*bermain|area\s*(?:bermain\s*)?anak)\b/i,
      'pet playground': /\b(pet\s*(?:playground|park|zone|area|friendly)|dog\s*park)\b/i,
      'AC': /\bac\b/i, 'lift': /\b(lift|elevator)\b/i, 'carport/garasi': /\b(carport|garasi|garage)\b/i,
      'CCTV': /\bcctv\b/i, 'security': /\b(security|satpam|keamanan\s*24)\b/i, 'parkir': /\b(parkir|parking)\b/i,
      'wifi': /\b(wi-?fi|internet)\b/i, 'water heater': /\b(water\s*heater|pemanas\s*air)\b/i,
      'kitchen set': /\bkitchen\s*set\b/i, 'taman': /\b(taman|garden)\b/i, 'musholla': /\b(musholla|mushola|masjid)\b/i,
      'laundry': /\blaundry\b/i, 'jogging track': /\bjogging\b/i, 'minimarket': /\b(minimarket|indomaret|alfamart)\b/i,
      'dapur': /\b(dapur|kitchen(?!\s*set)|kompor)\b/i, 'balkon': /\b(balkon|balcony)\b/i,
    };
    const asked = Object.keys(FAC).filter((k) => FAC[k].test(t));
    if (asked.length && f) {
      const has = asked.filter((k) => FAC[k].test(f));
      const missing = asked.filter((k) => !FAC[k].test(f));
      const seg = [];
      if (has.length) seg.push(isId ? `${has.join(', ')} *ada*` : `${has.join(', ')} *available*`);
      if (missing.length) seg.push(isId
        ? `${missing.join(', ')} *belum tercatat di unit ini* — saya catat sebagai kebutuhan Kakak, nanti dikonfirmasi agent kami`
        : `${missing.join(', ')} *not recorded for this unit* — noted as your requirement, our agent will confirm`);
      parts.push(`${seg.join('; ')}${isId ? '. Fasilitas tercatat' : '. Listed facilities'}: *${v}*`);
    } else {
      parts.push(v ? (isId ? `fasilitasnya: *${v}*` : `facilities: *${v}*`) : (isId ? `fasilitasnya ${unknownLine}` : `facilities ${unknownLine}`));
    }
  }
  if (/nego|diskon/i.test(t)) {
    parts.push(isId ? 'soal nego saya tidak bisa menjanjikan angkanya — nanti dibantu langsung oleh agent kami; kalau Kakak punya angka yang diharapkan, saya catat' : 'I cannot promise a negotiated figure — our agent will handle that; tell me your target and I will note it');
  }
  if (/\b(imb|pbg|pbb|denah|floor\s*plan|legalitas|dokumen\w*|berkas|surat[-\s]surat|ajb|akta)\b/i.test(t)) {
    const c = row && row.certificateType ? String(row.certificateType).toUpperCase() : '';
    parts.push(isId
      ? `${c ? `sertifikat tercatat *${c}*; ` : ''}dokumen lain (IMB/PBG, PBB, denah, salinan sertifikat) dipegang agent kami — saya minta agent mengirimkannya ke Kakak`
      : `${c ? `certificate on file: *${c}*; ` : ''}other documents (building permit, tax, floor plan, certificate copy) are with our agent — I'll ask them to send these to you`);
  }
  if (ATTR_RE.unknown.test(t) && !parts.length) {
    parts.push(isId ? `soal itu ${unknownLine}` : `that ${unknownLine}`);
  }
  if (!parts.length) return null;
  const body = isId ? `Untuk ${label}: ${parts.join('; ')}.` : `For ${label}: ${parts.join('; ')}.`;
  return { reply: body, verdict: 'attribute-answer', card };
}

/* M193 (14 Sep 2026) — "Masih tersedia?", "Ada carport?", "Ada taman?" setelah
 * kartu terkirim adalah pertanyaan tentang UNIT yang sudah ada, BUKAN permintaan
 * listing baru. Simulasi 12 pesan: "Masih tersedia?" membuat gerbang area
 * mengirim 2 kartu TAMBAHAN. Bare = tanpa lokasi/tipe/jumlah/"lagi". */
function isBareAvailabilityQuestion(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 60) return false;
  if (/\b(di|daerah|area|kawasan|kota)\s+[A-Za-z]/i.test(t)) return false;
  if (/\b(rumah|apartemen|apartment|villa|kos|kost|ruko|kantor|gudang|tanah|unit\s+lain)\b/i.test(t)) return false;
  if (/\d/.test(t) && !/\b(no|nomor|nomer)\.?\s*\d/i.test(t)) return false;
  if (/\b(lagi|lain|tambah\w*|opsi|pilihan\s+lain|lebih\s+banyak|more|listing)\b/i.test(t)) return false;
  return /\b(masih\s+(?:ada|tersedia)|tersedia|available|ada)\b/i.test(t);
}

function tryListingSelectionAnswer({ message, history = [], isId = true }) {
  try {
    const shown = parseShownListings(history);
    if (!shown.length) return null;
    /* M193 — "Yang no 2 kamarnya berapa?" pernah tercatat sebagai PILIHAN
     * ("Dicatat pilihannya"). Akarnya bukan alur ini: ATTR_RE.rooms memakai
     * \bkamar\b sehingga "kamarnya" tidak terbaca pertanyaan atribut, dan
     * jalur `attributeQuestion` di bawah (M199) tidak pernah aktif. Regex-nya
     * sudah diperbaiki (kamar\w*); alur M199 yang menangani sisanya. */

    /* M199 — "Yang tadi di MERR nomor 2" / "MERR nomor 2 saja yang saya ambil":
     * bila customer menyebut AREA dari blok lama, nomor dihitung di blok area itu —
     * bukan di blok terbaru (yang bisa saja area lain dengan nomor mulai 1 lagi). */
    const allCards = parseAllShownCards(history);
    const area = mentionedCardArea(message, allCards);
    const scoped = area
      ? (() => {
        const inArea = allCards.filter((c) => String(c.area || '').toLowerCase() === area.toLowerCase());
        const byIdx = new Map();
        for (const c of inArea) byIdx.set(c.index, c);   // blok terbaru di area itu menang
        return [...byIdx.values()].sort((a, b) => a.index - b.index);
      })()
      : shown;
    let sel = detectSelection(message, scoped.length ? scoped : shown);
    if (!sel) return null;
    // "Nomor 1 yang Wisma Tropodo" saat blok Wisma Tropodo tercetak 3-4 → nomor urut DI AREA itu.
    if (area && sel.status === 'out-of-range' && Number.isFinite(sel.askedIndex) && scoped.length >= sel.askedIndex && sel.askedIndex >= 1) {
      sel = { status: 'matched', card: scoped[sel.askedIndex - 1] };
    }

    // M198: "nomor 2 luas tanahnya berapa?" = pertanyaan atribut kartu no. 2, bukan memilih.
    if (sel.status === 'matched' && isAttributeQuestion(message) && !/\b(pilih|ambil|milih|minat|mau yang|jadi yang|take|choose)\b/i.test(message)) {
      return { reply: null, verdict: 'attribute-question', card: sel.card, shownCount: shown.length, attributeQuestion: true };
    }

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
// M191: platform AI menulis konfirmasi pilihan dengan kata-kata bebas
// ("Pilihannya sudah dicatat:", "Tercatat pilihannya:", "pilihan Kakak jatuh ke",
// "Unit dipilih:") — bukan hanya "Dicatat pilihannya:" milik Private Agent.
const PICK_CONFIRM_LINE_RE = /(?:dicatat pilihannya|pilihannya (?:sudah |telah )?(?:di|ter)catat|tercatat pilihannya|pilihan kakak jatuh ke|unit (?:yang )?dipilih|your pick)\s*:?\s*\*(.+?)\*(?:\s*(?:\(([^)]+)\)|[—-]\s*[^,\n]*?(?:,|\s)\s*(?:harga\s*)?\*?(Rp\s?[\d.,]+\s*(?:juta|jt|miliar|m)?[^*\n]*)))?/i;
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

    /* M198 (13 Sep 2026) — "Survei Sabtu depan jam 10 bisa?" / "Minggu depan
     * Rabu jam 2 siang": tanggal (dan jam) SUDAH ada di pesan yang sama —
     * menyebut jadwal atas tawaran survei = setuju. Jangan balas "Enaknya
     * survei tanggal berapa?" (customer baru saja menyebutnya). Pakai
     * penjadwal yang sama dengan giliran susulan. */
    // M202: "Boleh bayar per 3 bulan?" bukan jawaban tawaran survei ("per 3 bulan" pernah
    // terbaca tanggal +3 bulan). Pertanyaan pembayaran/deposit/harga → gerbang lain.
    if (/\b(?:bayar|cicil|termin|deposit|dp|harga|nego|diskon|promo|ipl|listrik|watt)\b/i.test(text)
        && !/\b(?:survei|survey|viewing|ketemu\w*|lihat\s+langsung)\b/i.test(text)) return null;
    const direct = scheduleViewingFromText(text, isId, { history });
    if (direct) return direct;

    const { customerRequestsViewing, customerOnlyThanks } = require('./customerQuestionGuard');
    /* M193 — "Ok, Kak. Trma ksh infonya" sesudah "Mau saya jadwalkan survei?"
     * adalah UCAPAN TERIMA KASIH, bukan "ya, jadwalkan". "ok" memang cocok
     * VIEWING_AFFIRM_RE, tapi kalimatnya ditutup terima kasih tanpa kata
     * survei -> bukan persetujuan. Biarkan gerbang penutup/Q8 yang menangani
     * (transkrip 14 Sep 2026: yang benar AI lanjut bertanya tanggal masuk). */
    if (customerOnlyThanks(text) && !customerRequestsViewing(text)) return null;
    if (VIEWING_AFFIRM_RE.test(text) || customerRequestsViewing(text)) {
      /* ⭐ M189e — SATU PERTANYAAN, PENDEK. Versi lama mengulang judul unit +
       * harga LALU menanyakan DUA hal sekaligus ("tanggal berapa dan jam
       * berapa?") — panjang, dan melanggar aturan doc 02 §3 "satu pertanyaan
       * per pesan". Unit-nya baru saja disebut di pesan tepat sebelum ini,
       * jadi mengulanginya tidak menambah kejelasan. Jam ditanyakan menyusul
       * — dan HANYA bila surveinya dalam 7 hari (lihat tryPendingViewingSchedule).
       */
      return {
        reply: isId
          ? `Siap, Kak 😊 Enaknya survei tanggal berapa?`
          : `Great 😊 What date works for the viewing?`,
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
const { parseCustomerDate, parseSurveyTime, isDontKnowDateAnswer } = require('./customerDateParser');
// ⛔ NORMALISASI SINGKATAN WAJIB sebelum parseCustomerDate/parseSurveyTime —
// pola yang sama persis dengan extractQualificationState() di
// aiPromptBuilderService.js (M73): "bln dpn" tidak cocok regex "bulan depan"
// mana pun tanpa expandAbbreviations() lebih dulu.
const { expandAbbreviations } = require('./lazyChatNormalizer');
const normalizeForDateParsing = (m) => {
  try { return expandAbbreviations(String(m || '')); }
  catch (_) { return String(m || ''); } // fail-open
};

/* Pertanyaan TANGGAL survei. Bentuk pendek M189e didahulukan; bentuk gabungan
 * lama tetap dikenali supaya percakapan yang SEDANG berjalan (sudah menerima
 * pertanyaan versi lama di riwayatnya) tidak putus saat versi baru dirilis. */
const PENDING_SCHEDULE_ASK_RE = /enaknya survei tanggal berapa\?|what date works for the viewing\?|tanggal berapa dan jam berapa\?|what date and time work for you\?|mau hari dan jam berapa\?|what day and time suit you\?/i;   // M208: tawaran video call ikut menunggu jadwal
/* ── M189c (7 Sep 2026) — GILIRAN SUSULAN: HANYA JAM, ATAU HANYA TANGGAL ──
 * Transkrip produksi lanjutan lagi: customer menjawab tanggal saja ("Saya
 * mau survei bln dpn, Kak") → gerbang di bawah BENAR bertanya balik "Kira-
 * kira jam berapa yang paling pas?" (verdict viewing-date-only). Customer
 * lalu menjawab "Jam 11 pagi, Kak" — TAPI `PENDING_SCHEDULE_ASK_RE` di atas
 * hanya mengenali pertanyaan GABUNGAN ("tanggal berapa DAN jam berapa"),
 * bukan susulan jam-saja ini — gerbang bungkam, jatuh ke gerbang area,
 * katalog terkirim ulang (DENGAN jumlah unit yang beda pula, karena kueri
 * diulang dari nol) padahal customer sudah lama memilih & menjadwalkan.
 * Tanggal/jam yang SUDAH diketahui dibaca balik dari teks tebal di pesan AI
 * itu SENDIRI (bukan diminta ulang) — sama prinsipnya dengan
 * PICK_CONFIRM_LINE_RE di atas.
 */
const PENDING_DATE_ONLY_FOLLOWUP_RE = /kira-kira jam berapa yang paling pas\?|what time works best\?/i;
const PENDING_TIME_ONLY_FOLLOWUP_RE = /untuk tanggalnya, hari apa yang pas\?|and what date works for you\?/i;
/* Survei sudah dicatat TANPA jam (M189e, tanggalnya >7 hari). Kalau customer
 * lalu menyebut jamnya sendiri, jam itu harus tetap tertangkap — bukan jatuh
 * ke gerbang lain. Jamnya sukarela, jadi tidak pernah DIMINTA di sini. */
const PENDING_SCHEDULED_DATE_ONLY_RE = /survei dicatat tanggal|the viewing is set for/i;

/* Batas "survei masih dekat" — di atas ini JAM tidak ditanyakan lagi, cukup
 * tanggalnya (pemilik proyek, 9 Sep 2026: semula 7 hari, diperketat ke 5). */
const VIEWING_HOUR_ASK_MAX_DAYS = 5;
const BOLD_FIRST_RE = /\*([^*]+)\*/;

/**
 * Bila giliran AI SEBELUMNYA barusan menanyakan tanggal+jam survei — baik
 * pertanyaan gabungan (`tryPendingViewingConfirmation`) maupun susulan
 * jam-saja/tanggal-saja (keluaran fungsi ini sendiri) — baca jawaban
 * customer dan tutup jadwalnya. Jangan biarkan gerbang lain menjalankan
 * ulang pencarian selagi customer sedang menjawab jadwal.
 *
 * @returns {null | { reply: string, verdict: string }}
 */
function tryPendingViewingSchedule({ message, history = [], isId = true }) {
  try {
    const text = String(message || '').trim();
    if (!text) return null;

    const lastAi = lastAiMessage(history);
    if (!lastAi) return null;
    const isCombinedAsk   = PENDING_SCHEDULE_ASK_RE.test(lastAi);
    const isDateOnlyFollow = PENDING_DATE_ONLY_FOLLOWUP_RE.test(lastAi);
    const isTimeOnlyFollow = PENDING_TIME_ONLY_FOLLOWUP_RE.test(lastAi);
    const isScheduledNoHour = PENDING_SCHEDULED_DATE_ONLY_RE.test(lastAi);

    // Jadwal sudah dicatat tanpa jam, lalu customer menyebut jamnya sendiri →
    // lengkapi jadwalnya. Tanpa jam yang bisa dibaca, tidak ada yang perlu
    // diubah: biarkan alur normal jalan (jangan balas apa pun dari sini).
    if (isScheduledNoHour) {
      const volunteered = parseSurveyTime(normalizeForDateParsing(text), { requireClockWord: false });
      if (!volunteered) return null;
      const m = lastAi.match(BOLD_FIRST_RE);
      const known = m ? String(m[1]).trim() : '';
      return {
        reply: isId
          ? `Siap, Kak 😊 Survei dijadwalkan tanggal *${known}*, *${volunteered}* ya. Nanti tim kami hubungi untuk konfirmasi.`
          : `Great 😊 The viewing is scheduled for *${known}*, *${volunteered}*. Our team will follow up to confirm.`,
        verdict: 'viewing-scheduled',
      };
    }

    if (!isCombinedAsk && !isDateOnlyFollow && !isTimeOnlyFollow) return null;
    // M202: penutup ("Makasih", "Terima kasih") atau pesan panjang tanpa tanggal/jam saat
    // menunggu jawaban jadwal → biarkan gerbang penutup/lanjutan menjawab, jangan mengulang
    // "hari apa yang pas?" (simulasi Z9: diulang 3 giliran).
    const { customerSignalsClosing: _cls, customerRequestsViewing } = require('./customerQuestionGuard');
    if (_cls(text)) return null;
    // M198b: "Masuknya rencana awal Desember" = tanggal MASUK, bukan jawaban jadwal survei.
    if (/\b(masuk\w*|pindah\w*|huni\w*|nempat\w*|check[- ]?in)\b/i.test(text) && !/\b(survei|survey|viewing|lihat|liat|ketemu\w*)\b/i.test(text)) return null;

    /* ⭐ M189e — "BELUM TAHU JAMNYA" BUKAN PENOLAKAN SURVEI.
     * `VIEWING_DECLINE_RE` cocok pada awalan "belum", sehingga jawaban wajar
     * seperti "Belum tau jamnya, Kak" (saat AI baru menanyakan JAM, dan
     * tanggalnya sudah disepakati) terbaca sebagai membatalkan survei — padahal
     * customer hanya belum menentukan jam. `isDontKnowDateAnswer()` sudah lama
     * ada untuk kelas jawaban ini; dipakai ulang di sini, bukan ditulis lagi. */
    const isDontKnow = isDontKnowDateAnswer(text);
    if (VIEWING_DECLINE_RE.test(text) && !((isDateOnlyFollow || isTimeOnlyFollow) && isDontKnow) && !customerRequestsViewing(text)) {   // M208 (P23): "nggak mau online, mau datang langsung"
      return {
        reply: isId
          ? `Baik, Kak 😊 Kalau berubah pikiran atau mau jadwalkan nanti, tinggal bilang saja ya.`
          : `No problem 😊 Just let me know whenever you'd like to schedule it.`,
        verdict: 'viewing-declined',
      };
    }

    const normText = normalizeForDateParsing(text);
    let dateFormatted = null;
    let timeFormatted = null;
    if (isDateOnlyFollow) {
      // Tanggal sudah dijawab giliran sebelumnya — dibaca balik dari teks
      // tebal di pesan AI itu sendiri, bukan diminta ulang ke customer.
      const m = lastAi.match(BOLD_FIRST_RE);
      dateFormatted = m ? String(m[1]).trim() : null;
      timeFormatted = parseSurveyTime(normText, { requireClockWord: false });
      if (!timeFormatted && !isDontKnow && String(text).trim().split(/\s+/).length > 3) return null;   // M199
    } else if (isTimeOnlyFollow) {
      const m = lastAi.match(BOLD_FIRST_RE);
      timeFormatted = m ? String(m[1]).trim() : null;
      const d = parseCustomerDate(sundayInViewingContext(normText));
      dateFormatted = d && d.status === 'ok' ? d.formatted : null;
      // M199: bukan jawaban tanggal ("nanti saya minta agentnya jemput", "terima kasih")
      // → jangan mengulang pertanyaan tanggal; biarkan gerbang lain menjawab.
      if (!dateFormatted && String(text).trim().split(/\s+/).length > 3) return null;
    } else {
      const d = parseCustomerDate(normText);
      dateFormatted = d && d.status === 'ok' ? d.formatted : null;
      /* ⚠️ WAJIB pakai kata "jam"/"pukul" di cabang ini. Pesan di sini boleh
       * memuat TANGGAL, dan mode longgar menerima ANGKA TELANJANG — sehingga
       * "Survei 12 September" terbaca jamnya "Jam 12" (angka tanggalnya!).
       * Mode longgar hanya aman di cabang susulan, di mana tanggalnya sudah
       * diketahui dan yang ditunggu memang tinggal jamnya. */
      timeFormatted = parseSurveyTime(normText, { requireClockWord: true });
    }

    /* M200 (15 Sep 2026) — "Saya msh tanya dlu saja" / "Iya, Kak" sesudah "Enaknya
     * survei tanggal berapa?" bukan jawaban tanggal. Dulu dibalas "Boleh disebutkan
     * tanggal dan jam" (transkrip produksi 15 Sep). Menjelajah/menolak → hormati;
     * pesan lain yang bukan tanggal → null supaya gerbang lanjutan menjawab. */
    if (!dateFormatted && !timeFormatted) {
      const { customerIsBrowsing, customerDeclinesViewing } = require('./customerQuestionGuard');
      if (customerIsBrowsing(text) || customerDeclinesViewing(text)) {
        return {
          reply: isId
            ? `Santai saja, Kak 😊 Surveinya kapan pun Kakak siap — tinggal sebut tanggalnya. Silakan tanya apa pun soal unitnya.`
            : `No rush 😊 The viewing can wait until you're ready — just send me a date. Ask me anything about the unit.`,
          verdict: 'viewing-deferred',
        };
      }
      if (String(text).trim().split(/\s+/).length > 3 || /\?/.test(text)) return null;
    }
    const composed = composeViewingScheduleReply({ dateFormatted, timeFormatted, isDateOnlyFollow, isId });
    // M208 (sim R2): jawaban atas tawaran VIDEO CALL — sebut video call, bukan survei.
    if (composed && /video\s*call/i.test(lastAi)) composed.reply = composed.reply.replace(/\bSurvei\b/g, 'Video call').replace(/\bThe viewing\b/g, 'The video call');
    return composed;
  } catch (err) {
    console.error('[PENDING VIEWING SCHEDULE GATE ERROR]', err.message);
    return null;
  }
}

/**
 * M200 — fasilitas yang tercetak di kartu unit yang DIPILIH customer
 * ("🏷️ Fasilitas: GARDEN, CCTV 24 JAM, …"). Untuk baris Fasilitas di summary:
 * kebutuhan customer + fasilitas unit terpilih (arahan pemilik 15 Sep 2026).
 * @returns {string[]} kosong bila belum ada pilihan / kartu tanpa baris fasilitas
 */
function pickedUnitFacilities(history = []) {
  try {
    const pick = readConfirmedPick(history);
    if (!pick) return [];
    const rows = Array.isArray(history) ? history : [];
    const isAi = (h) => /^(ai|assistant|bot)$/i.test(String(h.role || ''));
    const wantTitle = normTitle(pick.title); const wantPrice = normTitle(pick.priceText || '');
    for (let i = rows.length - 1; i >= 0; i--) {
      if (!isAi(rows[i])) continue;
      const text = String(rows[i].message || rows[i].content || '');
      if (!isCardMessage(text)) continue;
      const chunks = text.split(/\n(?=\s*\d{1,2}\.\s+\*{1,2})/);
      for (const chunk of chunks) {
        const head = chunk.match(CARD_HEAD_RE); if (!head) continue;
        if (normTitle(head[2]) !== wantTitle) continue;
        const priceRaw = (chunk.match(PRICE_LINE_RE) || chunk.match(PRICE_LINE_FALLBACK_RE) || [])[1] || '';
        if (wantPrice && normTitle(priceRaw) !== wantPrice) continue;
        const fm = chunk.match(/Fasilitas\s*:\s*([^\n]+)/i) || chunk.match(/Facilities\s*:\s*([^\n]+)/i);
        if (!fm) return [];
        return fm[1].split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
      }
    }
    return [];
  } catch (_) { return []; }
}

/**
 * M198 — tanggal (+jam) yang disebut customer di pesan yang SAMA dengan
 * persetujuan survei. null bila tidak ada tanggal/jam yang terbaca (biarkan
 * pemanggil bertanya tanggal seperti biasa).
 */
/** Dalam konteks SURVEI, "Minggu ini/depan" = hari Minggu (bukan pekan). */
function sundayInViewingContext(text) {
  // M200: "minggu depan" = pekan depan (+7 hari) — sama dengan gerbang jadwal susulan;
  // hanya "minggu ini" (yang tanpa ini = null) dibaca sebagai hari Minggu.
  // M202: "survei Minggu jam 10" / "Minggu jam 2" (tanpa ini/depan) = hari Minggu.
  return String(text || '')
    .replace(/\b(?:hari\s+)?minggu\s+(ini)\b/gi, 'hari minggu $1')
    .replace(/\bminggu(?=\s*(?:,|\.|jam|pukul|pagi|siang|sore|malam|$))/gi, 'hari minggu');
}

/* M208 (sim R7) — "Sabtu nggak jadi, Minggu aja jam yang sama": klausa hari yang DIBATALKAN
 * dibuang sebelum parse (dulu "Sabtu" yang terbaca), dan "jam yang sama" mengambil jam dari
 * jadwal terakhir di riwayat. */
function stripCancelledDayClause(text) {
  return String(text || '')
    .replace(/\b(?:hari\s+)?(?:senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|besok|lusa|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:ini|depan|besok))?\s*(?:nya)?\s+(?:nggak|ngga|gak|ga|tidak|tdk|ndak)\s+(?:jadi|bisa)\b[^,.;]*[,.;]?/gi, ' ')
    .replace(/\b(?:batal|cancel|ganti|undur)\s+(?:yang\s+)?(?:senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|besok|lusa)(?:\s+(?:ini|depan))?\b/gi, ' ');
}
function lastScheduledTime(history) {
  const rows = Array.isArray(history) ? history : [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const h = rows[i]; if (!/^(ai|assistant)$/i.test(String(h.role || ''))) continue;
    const m = String(h.message || '').match(/(?:survei|viewing)[^\n]{0,40}tanggal \*[^*]+\*,\s*\*([^*]+)\*|✓ Viewing: \*\d{1,2} [A-Za-z]+ \d{4},\s*([^*]+)\*|(?:set|scheduled) for \*[^*]+\*,\s*\*([^*]+)\*/i);
    if (m) return (m[1] || m[2] || m[3] || '').trim();
  }
  return '';
}

function scheduleViewingFromText(text, isId = true, opts = {}) {
  try {
    const normText = sundayInViewingContext(normalizeForDateParsing(stripCancelledDayClause(text).replace(/\bminggu\s+(?:saja|aja|deh|ya)\b/i, 'hari minggu')));
    const d = parseCustomerDate(normText);
    const dateFormatted = d && d.status === 'ok' ? d.formatted : null;
    const sameTime = /\bjam\s+(?:yang\s+)?sama\b|\bsame\s+time\b/i.test(String(text)) ? lastScheduledTime(opts.history) : '';
    const timeFormatted = parseSurveyTime(normText, { requireClockWord: true }) || sameTime || null;
    if (!dateFormatted && !timeFormatted) return null;
    return composeViewingScheduleReply({ dateFormatted, timeFormatted, isDateOnlyFollow: false, isId });
  } catch (_) { return null; }
}

function composeViewingScheduleReply({ dateFormatted, timeFormatted, isDateOnlyFollow, isId }) {
  {
    if (dateFormatted && timeFormatted) {
      return {
        reply: isId
          ? `Baik, Kak 😊 Survei dijadwalkan tanggal *${dateFormatted}*, *${timeFormatted}* ya. Nanti tim kami hubungi untuk konfirmasi.`
          : `Great 😊 The viewing is scheduled for *${dateFormatted}*, *${timeFormatted}*. Our team will follow up to confirm.`,
        verdict: 'viewing-scheduled',
      };
    }
    if (dateFormatted && !timeFormatted) {
      /* ⭐ M189e — JAM TIDAK SELALU PERLU DITANYA. Aturan pemilik proyek:
       * survei yang lebih dari 7 hari ke depan biasanya BELUM ditentukan
       * jamnya oleh customer — memaksa "jam berapa?" hanya menghasilkan
       * pertanyaan yang tidak bisa dijawab. Catat tanggalnya saja; jam
       * dikonfirmasi tim mendekati hari-H. Di bawah 7 hari, jam masih
       * ditanyakan sekali (masih wajar dan berguna untuk agent).
       * Ambang diubah 7 → 5 hari atas permintaan pemilik proyek (9 Sep 2026). */
      const reparsed = parseCustomerDate(dateFormatted);
      const dueDate = reparsed && reparsed.date ? new Date(reparsed.date) : null;
      const daysAhead = dueDate
        ? Math.round((dueDate.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
        : 0;
      // Jam sudah pernah ditanya sekali (isDateOnlyFollow) tapi tetap tidak
      // disebutkan → JANGAN tanya lagi, cukup catat tanggalnya.
      if (daysAhead > VIEWING_HOUR_ASK_MAX_DAYS || isDateOnlyFollow) {
        return {
          reply: isId
            ? `Baik, Kak 😊 Survei dicatat tanggal *${dateFormatted}* ya. Untuk jamnya nanti tim kami konfirmasi mendekati hari-H.`
            : `Noted 😊 The viewing is set for *${dateFormatted}*. Our team will confirm the exact time closer to the date.`,
          verdict: 'viewing-scheduled-date-only',
        };
      }
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
  }
}

/* ── M189d (7 Sep 2026) — JARING PENGAMAN: JANGAN PERNAH TAMPILKAN KATALOG
 * BARU SELAGI MASIH DI ALUR PASCA-PILIHAN, APA PUN PESANNYA ─────────────────
 * Permintaan eksplisit pemilik proyek setelah bug M189c: "jika customer sudah
 * pilih property; AI dilarang memberikan listing baru". Tiga gerbang di atas
 * menangani pola yang SUDAH dikenal (ya/tidak, tanggal+jam, jam-saja,
 * tanggal-saja) — tapi pola customer tidak terbatas. Bila SATU PUN dari
 * ketiganya tidak cocok, jaring ini memastikan gerbang kota/area DI BAWAHNYA
 * tetap tidak boleh bicara selama pesan AI TERAKHIR masih bagian dari alur
 * pasca-pilihan (konfirmasi pilihan, tawaran survei, atau pertanyaan
 * jadwal) — daripada diam-diam mengizinkan pencarian baru yang mengembalikan
 * katalog LAIN (bisa beda jumlah/urutan unit) dan membuat customer kehilangan
 * rujukan ke unit yang sudah dipilihnya.
 */
const POST_PICK_FINGERPRINT_RE = /dicatat pilihannya:|your pick:|mau saya jadwalkan survei ke unit ini\?|shall i arrange a viewing for this unit\?|enaknya survei tanggal berapa\?|what date works for the viewing\?|tanggal berapa dan jam berapa\?|what date and time work for you\?|kira-kira jam berapa yang paling pas\?|what time works best\?|untuk tanggalnya, hari apa yang pas\?|and what date works for you\?|survei dijadwalkan tanggal|the viewing is scheduled for|survei dicatat tanggal|the viewing is set for/i;

/**
 * @returns {null | { reply: string, verdict: 'post-pick-fallback' }} null bila
 *   pesan AI terakhir BUKAN bagian dari alur pasca-pilihan (alur normal jalan).
 */
async function tryPostPickFallback({ history = [], isId = true, message = '', userId = null } = {}) {
  try {
    const lastAi = lastAiMessage(history);
    if (!lastAi || !POST_PICK_FINGERPRINT_RE.test(lastAi)) return null;

    /* M198 — pesan sesudah pilihan HAMPIR SELALU bermakna: pertanyaan atribut
     * unit dijawab dari kartu/DB; budget, penghuni, tanggal, keluhan, permintaan
     * diteruskan ke alur normal (null). "Boleh diulang maksudnya?" hanya untuk
     * pesan yang benar-benar tidak terbaca (≤2 kata tanpa huruf/angka bermakna). */
    // M199: pertanyaan PEMBANDING beberapa unit ditangani gerbang lanjutan Private Agent.
    if (COMPARE_CUE_RE.test(String(message || ''))) return null;
    const pickedCard = (() => {
      const pick = readConfirmedPick(history);
      if (!pick) return null;
      const shown = parseAllShownCards(history);   // M199: pilihan bisa dari blok area lama
      return shown.find((c) => normTitle(c.title) === normTitle(pick.title) && (!pick.priceText || normTitle(c.priceText || '') === normTitle(pick.priceText))) || shown.find((c) => normTitle(c.title) === normTitle(pick.title)) || null;
    })();
    if (pickedCard) {
      const ans = await answerCardAttribute({ message, card: pickedCard, userId, isId });
      if (ans) return { reply: ans.reply, verdict: 'post-pick-attribute' };
    }
    const words = String(message || '').trim().split(/\s+/).filter(Boolean);
    if (words.length > 2 || /[a-z0-9]{3,}/i.test(String(message || ''))) return null;

    return {
      reply: isId
        ? `Maaf, Kak 🙏 Boleh diulang maksudnya? Kita masih bahas unit yang sudah Kakak pilih tadi — mau lanjut ke jadwal surveinya, atau ada yang lain?`
        : `Sorry 🙏 Could you rephrase that? We're still discussing the unit you picked earlier — want to continue with the viewing schedule, or is there something else?`,
      verdict: 'post-pick-fallback',
    };
  } catch (err) {
    console.error('[POST PICK FALLBACK GATE ERROR]', err.message);
    return null;
  }
}

/**
 * Listing yang SUDAH dikonfirmasi dipilih customer, dibaca balik dari pesan
 * konfirmasi AI ("Dicatat pilihannya: *Judul* (harga)") — satu-satunya catatan
 * otoritatif tentang unit mana yang dipilih. Dipakai baris "✓ Listing" pada
 * ringkasan supaya tidak ada regex kedua yang bisa melenceng dari gerbangnya.
 *
 * @returns {null | { title: string, priceText: string, label: string }}
 */
/**
 * M192 (12 Sep 2026) — SEMUA kartu yang sudah pernah dikirim di sesi ini
 * (semua blok, bukan hanya yang terakhir), untuk dedup pengiriman listing.
 * Identitas kartu = alamat (unik per unit), cadangan judul+harga.
 * @returns {{ addresses:Set<string>, keys:Set<string>, count:number }}
 */
function listSentCards(history = []) {
  const rows = Array.isArray(history) ? history : [];
  const isAi = (h) => /^(ai|assistant|bot)$/i.test(String(h.role || ''));
  const addresses = new Set(); const keys = new Set(); const areas = new Set(); let count = 0;
  for (const h of rows) {
    if (!isAi(h)) continue;
    const text = String(h.message || h.content || '');
    if (!isCardMessage(text)) continue;
    for (const c of parseCardsFromText(text)) {
      count += 1;
      if (c.address) addresses.add(normTitle(c.address));
      if (c.area) areas.add(normTitle(c.area));
      keys.add(normTitle(`${c.title} ${c.priceText || ''}`));
    }
  }
  return { addresses, keys, areas, count };
}

/**
 * M199 — AREA yang DICARI pada pengiriman kartu terakhir: dibaca dari judul
 * blok ("Ini 2 rumah dijual di *Tropodo* ya"), bukan dari area per kartu —
 * pencarian "Tropodo" bisa memuat kartu ber-area "Wisma Tropodo", sehingga area
 * kartu terakhir menyesatkan deteksi pergantian area.
 * @returns {string} huruf kecil, '' bila belum ada kartu.
 */
function lastSentAreaLabel(history = []) {
  const rows = Array.isArray(history) ? history : [];
  const isAi = (h) => /^(ai|assistant|bot)$/i.test(String(h.role || ''));
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!isAi(rows[i])) continue;
    const text = String(rows[i].message || rows[i].content || '');
    if (!isCardMessage(text)) continue;
    const m = text.match(/^[^\n]*\b(?:di|in)\s+\*([^*\n]+)\*/m);
    if (m) return String(m[1]).trim().toLowerCase();
    const cards = parseCardsFromText(text);
    return String((cards[cards.length - 1] || {}).area || '').trim().toLowerCase();
  }
  return '';
}

/** Apakah baris properti (DB row) sudah pernah dikirim sebagai kartu? */
function isRowAlreadySent(row, sent) {
  if (!sent || !row) return false;
  const addr = normTitle(row.address || '');
  if (addr && sent.addresses.has(addr)) return true;
  const key = normTitle(`${row.title || ''} ${row.priceText || row.price || ''}`);
  return Boolean(key.trim()) && sent.keys.has(key);
}

/**
 * M199 — SEMUA pilihan yang pernah dicatat di sesi ini, urut kronologis, masing-
 * masing dipetakan ke kartunya (area/alamat) bila ditemukan. Untuk customer
 * plin-plan: "balik ke Pakuwon, yang tadi saya pilih" harus bisa menemukan
 * pilihan LAMA walau pilihan terbaru ada di area lain.
 * @returns {Array<{title:string, priceText:string, card:object|null, at:number}>}
 */
function listConfirmedPicks(history = []) {
  const rows = Array.isArray(history) ? history : [];
  const isAi = (h) => /^(ai|assistant|bot)$/i.test(String(h.role || ''));
  const shown = parseAllShownCards(rows);
  const out = [];
  rows.forEach((h, i) => {
    if (!isAi(h)) return;
    const m = String(h.message || h.content || '').match(PICK_CONFIRM_LINE_RE);
    if (!m) return;
    const title = String(m[1] || '').trim();
    const priceText = (m[2] || m[3]) ? String(m[2] || m[3]).trim() : '';
    if (!title) return;
    const card = shown.find((c) => normTitle(c.title) === normTitle(title) && (!priceText || normTitle(c.priceText || '') === normTitle(priceText)))
      || shown.find((c) => normTitle(c.title) === normTitle(title)) || null;
    out.push({ title, priceText, card, at: i });
  });
  return out;
}

/* Customer merujuk pilihan LAMA: "balik ke Pakuwon, yang tadi saya pilih",
 * "nggak jadi, tetap beli rumah Pakuwon yang nomor 1 tadi", "yang mana ya? saya lupa",
 * "bukan deh, balik ke Tropodo nomor 1 yang pertama". */
const RECALL_CUE_RE = /\b(?:balik|kembali|tetap|nggak\s+jadi|ga\s+jadi|gak\s+jadi|batal\s+ganti|jadi\s+yang)\b[^.?!]{0,40}\b(?:tadi|pertama|sebelumnya|semula|awal|yang\s+saya\s+pilih|pilihan\s+saya|nomor\s*\d|no\.?\s*\d|yang\s+\w+\s+tadi)\b|\b(?:yang\s+mana\s+ya|saya\s+lupa|pilihan\s+saya\s+(?:tadi|apa|yang\s+mana)|yang\s+tadi\s+saya\s+pilih|tadi\s+saya\s+pilih\s+(?:yang\s+)?(?:mana|apa))\b/i;

/**
 * @returns {null | {reply:string, verdict:'pick-recalled', card:object}}
 */
function tryRecallPreviousPick({ message, history = [], isId = true } = {}) {
  try {
    const text = String(message || '').trim();
    if (!text || !RECALL_CUE_RE.test(text)) return null;
    const picks = listConfirmedPicks(history);
    if (!picks.length) return null;
    const shown = parseAllShownCards(history);
    const lower = text.toLowerCase();

    // 1) area yang disebut ("Pakuwon", "Tropodo") → kartu di area itu (nama area PERSIS
    //    lebih dulu supaya "Tropodo" tidak tertukar dengan "Wisma Tropodo").
    const areaTokens = [...new Set(shown.map((c) => String(c.area || '').trim()).filter(Boolean))]
      .sort((a, b) => b.length - a.length);
    const mentioned = areaTokens.filter((a) => new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
    const exactArea = mentioned.length
      ? mentioned.find((a) => !mentioned.some((b) => b !== a && b.toLowerCase().includes(a.toLowerCase()) && new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text) && b.length > a.length))
        || mentioned[0]
      : '';
    const numM = text.match(/\b(?:nomor|nomer|no\.?)\s*(\d{1,2})\b/i);
    const wantsFirst = /\b(pertama|semula|awal|paling\s+awal)\b/i.test(lower);

    let candidates = picks.slice();
    if (exactArea) candidates = candidates.filter((p) => p.card && String(p.card.area || '').toLowerCase() === exactArea.toLowerCase());
    if (numM && exactArea) {
      const n = parseInt(numM[1], 10);
      const byNum = candidates.filter((p) => p.card && p.card.index === n);
      if (byNum.length) candidates = byNum;
      else {
        // pilihan bernomor N di area itu belum pernah dicatat → kartu bernomor N di area itu
        const card = shown.filter((c) => String(c.area || '').toLowerCase() === exactArea.toLowerCase() && c.index === n);
        if (card.length) candidates = [{ title: card[0].title, priceText: card[0].priceText, card: card[0], at: -1 }];
      }
    } else if (numM && !exactArea) {
      const n = parseInt(numM[1], 10);
      const byNum = candidates.filter((p) => p.card && p.card.index === n);
      if (byNum.length) candidates = byNum;
    }
    if (!candidates.length) return null;
    const chosen = wantsFirst ? candidates[0] : candidates[candidates.length - 1];
    const c = chosen.card || { title: chosen.title, priceText: chosen.priceText, address: '' };
    const detail = [
      c.address ? (isId ? `🏡 Alamat: ${c.address}` : `🏡 Address: ${c.address}`) : null,
      c.priceText ? (isId ? `💰 Estimasi Harga: ${c.priceText}` : `💰 Estimated Price: ${c.priceText}`) : null,
      c.area ? (isId ? `🗺️ Area: ${c.area}` : `🗺️ Area: ${c.area}`) : null,
    ].filter(Boolean).join('\n');
    const reply = isId
      ? `Baik, Kak 😊 Kembali ke pilihan Kakak sebelumnya — Dicatat pilihannya: *${c.title}*${c.priceText ? ` (${c.priceText})` : ''}.\n\n${detail}\n\nMau saya jadwalkan survei ke unit ini?`
      : `Sure 😊 Back to your earlier choice — Your pick: *${c.title}*${c.priceText ? ` (${c.priceText})` : ''}.\n\n${detail}\n\nShall I arrange a viewing for this unit?`;
    return { reply, verdict: 'pick-recalled', card: c };
  } catch (err) {
    console.error('[RECALL PICK ERROR]', err.message);
    return null;
  }
}

function readConfirmedPick(history = []) {
  try {
    const rows = Array.isArray(history) ? history : [];
    const isAi = (h) => /^(ai|assistant|bot)$/i.test(String(h.role || ''));
    for (let i = rows.length - 1; i >= 0; i--) {
      if (!isAi(rows[i])) continue;
      const m = String(rows[i].message || rows[i].content || '').match(PICK_CONFIRM_LINE_RE);
      if (m) {
        const title = String(m[1] || '').trim();
        const priceText = (m[2] || m[3]) ? String(m[2] || m[3]).trim() : '';
        if (!title) continue;
        // Cari kartunya di blok katalog terakhir supaya tipe/area unit ikut
        // terbawa (judul + harga bila ada, karena judul bisa kembar).
        let card = null;
        try {
          const shown = parseShownListings(rows.slice(0, i));
          const nt = normTitle(title);
          const cands = shown.filter((c) => normTitle(c.title) === nt);
          card = (priceText && cands.find((c) => String(c.priceText).trim() === priceText)) || cands[0] || null;
        } catch (_e) { card = null; }
        return {
          title, priceText, label: priceText ? `${title} (${priceText})` : title,
          typeKey: card ? card.typeKey : null, typeLabel: card ? card.typeLabel : '',
          area: card ? card.area : '', address: card ? card.address : '',
        };
      }
    }
    return null;
  } catch (err) {
    console.error('[READ CONFIRMED PICK ERROR]', err.message);
    return null;
  }
}

module.exports = {
  tryListingSelectionAnswer,
  tryPendingViewingConfirmation,
  scheduleViewingFromText,
  tryPendingViewingSchedule,
  stripCancelledDayClause,
  lastScheduledTime,
  tryPostPickFallback,
  readConfirmedPick,
  pickedUnitFacilities,
  listConfirmedPicks,
  parseAllShownCards,
  mentionedCardArea,
  lastSentAreaLabel,
  COMPARE_CUE_RE,
  tryRecallPreviousPick,
  answerCardAttribute,
  isAttributeQuestion,
  isBareAvailabilityQuestion,
  listSentCards,
  isRowAlreadySent,
  lastAiMessage,
  parseShownListings,
  parseCardsFromText,
  detectSelection,
  composeSelectionReply,
  extractPrices,
  isCardMessage,
};

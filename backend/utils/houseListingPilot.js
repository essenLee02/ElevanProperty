/**
 * houseListingPilot.js
 *
 * Mekanik SKILL_HOUSE_v1_pilot — kualifikasi RESIDENSIAL (rumah & apartemen,
 * beli + sewa) untuk customer yang membuka chat karena MELIHAT SEBUAH LISTING
 * (portal Rumah123/broadcast/offline). Konteks kunci: AI TIDAK punya akses
 * inventory; agent yang mengecek ketersediaan di WAG.
 *
 * Empat mekanik yang TIDAK ada di alur standar (docs 09–11) dan pilot v2 (doc 12):
 *
 *  1. LISTING REFERENCE — pesan pembuka biasanya sudah membawa area + harga
 *     ("minat rumah Citraland 1.2M di Rumah123"). Itu MENGISI slot lokasi &
 *     price-band sekaligus → jangan pernah ditanyakan ulang.
 *
 *  2. AVAILABILITY DEFLECTION (holding script) — "masih ada?" TIDAK dijawab
 *     "saya cek dulu" polos (menandakan tidak kenal stok sendiri → kredibilitas
 *     jatuh di pasar yang customer-nya menghubungi 5 agent sekaligus). Dijawab
 *     dengan konfirmasi ke tim + LANGSUNG menyambung slot berikutnya.
 *     Dorongan KEDUA dari customer → STOP mengelak, eskalasi ke agent.
 *
 *  3. VALUE CHECKPOINT — setelah ±3 slot inti terisi, BERHENTI bertanya dan
 *     kirim sinyal momentum + [BRIEF_READY_EARLY]. Agent langsung menjatuhkan
 *     1–3 opsi nyata dari WAG. Inilah yang menahan customer, bukan inventory palsu.
 *
 *  4. QUESTION CAP 6–7 — di batas ini brief keluar apa adanya (unknown ditandai).
 *     JANGAN diperpanjang demi "melengkapi formulir".
 *
 * Modul ini murni fungsi (tanpa I/O) agar mudah diuji & tidak menambah beban
 * chatbotPrivateController.js yang sudah besar.
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════════
   1. LISTING REFERENCE
══════════════════════════════════════════════════════════════════════════════ */

// Portal / sumber listing yang umum disebut customer.
const PORTALS = ['rumah123', 'rumah 123', 'olx', 'lamudi', 'pinhome', '99.co', '99co',
                 'travelio', 'mamikos', 'instagram', 'ig', 'facebook', 'fb', 'tiktok',
                 'broadcast', 'katalog', 'brosur', 'iklan'];

/**
 * Ambil harga yang disebut customer di pesan pembuka (angka + satuan uang).
 * "1.2M" / "1,2 M" / "800jt" / "80 juta" / "1.5 miliar"
 * @returns {{text:string, value:number}|null}
 */
function _extractPrice(text = '') {
  const t = String(text).toLowerCase();
  const m = t.match(/\b(\d+(?:[.,]\d+)?)\s*(m\b|miliar|milyar|jt\b|juta|rb\b|ribu)/i);
  if (!m) return null;
  const num  = parseFloat(String(m[1]).replace(',', '.'));
  const unit = m[2].toLowerCase();
  const mult = /^m\b|miliar|milyar/.test(unit) ? 1e9
             : /^jt\b|juta/.test(unit)         ? 1e6
             : 1e3;
  if (!Number.isFinite(num)) return null;
  return { text: m[0].trim(), value: Math.round(num * mult) };
}

/**
 * Deteksi apakah pesan pembuka merujuk sebuah LISTING yang customer lihat.
 * Sinyal: kata minat/tanya + (nama area ATAU harga ATAU portal).
 *
 * @param {string} text
 * @returns {{raw:string, price:object|null, portal:string|null, isListingReferral:boolean}}
 */
function extractListingReference(text = '') {
  const raw = String(text || '').trim();
  const t   = raw.toLowerCase();

  const portal = PORTALS.find(p => t.includes(p)) || null;
  const price  = _extractPrice(t);

  // Frasa khas customer yang datang dari sebuah iklan/listing.
  const referralCue =
    /\b(minat|tertarik|nanya|tanya|lihat|liat|dapat|dapet|nemu|ada di|yang di|iklan|listing|unit)\b/i.test(t) ||
    /\bmasih\s+(ada|tersedia)\b/i.test(t) ||
    !!portal;

  return {
    raw,
    price,
    portal,
    // Butuh cue + minimal satu penanda konkret (harga atau portal) agar tidak
    // salah tangkap pertanyaan umum ("saya mau cari rumah").
    isListingReferral: !!(referralCue && (price || portal)),
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   2. AVAILABILITY DEFLECTION (holding script)
══════════════════════════════════════════════════════════════════════════════ */

/** Apakah pesan customer menanyakan KETERSEDIAAN unit? */
function isAvailabilityQuestion(text = '') {
  const t = String(text || '').toLowerCase();
  return /\bmasih\s*(ada|tersedia|available|kosong)\b/.test(t) ||
         /\b(available|tersedia)\s*(kah|gak|ga|nggak|engga|\?)/.test(t) ||
         /\bunit(nya)?\s*(masih|udah|sudah)\s*(ada|laku|kejual|terjual)\b/.test(t) ||
         /\bsudah\s*(laku|kejual|terjual|disewa)\b/.test(t);
}

/**
 * Berapa kali customer sudah MENDESAK soal ketersediaan sepanjang sesi?
 * Dorongan ke-2 → berhenti mengelak, eskalasi ke agent.
 * @param {Array<{role:string,message:string}>} history
 * @param {string} currentMessage
 */
function countAvailabilityPushes(history = [], currentMessage = '') {
  const past = (history || [])
    .filter(h => h.role === 'user' || h.role === 'customer')
    .map(h => String(h.message || ''));

  // ⚠️ Controller menyimpan pesan customer ke DB SEBELUM memanggil AI, sehingga
  // `history` SUDAH memuat pesan saat ini. Tanpa dedup, satu pertanyaan
  // "masih ada?" terhitung 2× → customer langsung dieskalasi di pesan PERTAMA
  // (padahal seharusnya dapat holding script + pertanyaan slot dulu).
  const cur = String(currentMessage || '').trim();
  if (cur && past.length && past[past.length - 1].trim() === cur) past.pop();

  return [...past, cur].filter(isAvailabilityQuestion).length;
}

/**
 * Skrip penahan: konfirmasi ke tim + LANGSUNG sambung pertanyaan slot berikutnya.
 * Jangan pernah berhenti di "saya cek dulu ya" tanpa pertanyaan lanjutan.
 *
 * @param {string} nextSlotQuestion - pertanyaan slot kosong berikutnya
 * @param {boolean} isId
 */
function buildHoldingScript(nextSlotQuestion = '', isId = true) {
  const lead = isId
    ? 'Saya konfirmasi ke tim dulu ya biar pasti 🙏'
    : 'Let me confirm with the team to be sure 🙏';
  const bridge = isId ? 'Sambil nunggu, ' : 'In the meantime, ';
  if (!nextSlotQuestion) return lead;
  // Sambung tanpa mengubah makna pertanyaan slot.
  const q = String(nextSlotQuestion).trim();
  return `${lead} ${bridge}${q.charAt(0).toLowerCase()}${q.slice(1)}`;
}

/** Eskalasi saat customer mendesak KEDUA kalinya — berhenti mengelak. */
function buildAvailabilityEscalation(agentName = '', isId = true) {
  const who = agentName || (isId ? 'agen kami' : 'our agent');
  return isId
    ? `Biar tidak simpang siur, saya sambungkan langsung ke *${who}* ya Kak — beliau yang paling update soal ketersediaan unitnya. Mohon tunggu sebentar 🙏`
    : `To avoid any mix-up, I'm connecting you directly with *${who}* — they have the most current availability. Please hold on a moment 🙏`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   3. VALUE CHECKPOINT — [BRIEF_READY_EARLY]
══════════════════════════════════════════════════════════════════════════════ */

/** Slot INTI per alur (yang menentukan kapan checkpoint boleh menyala). */
const CORE_SLOTS = {
  sale: ['listing_reference', 'motivation', 'location', 'price_band'],
  rent: ['listing_reference', 'move_in_urgency', 'location', 'price_band'],
};

/**
 * Hitung berapa slot inti yang sudah terisi.
 * @param {'sale'|'rent'} tx
 * @param {object} filled - map slot→boolean
 */
function countCoreSlots(tx, filled = {}) {
  const list = CORE_SLOTS[tx === 'sale' ? 'sale' : 'rent'];
  return list.filter(s => !!filled[s]).length;
}

/**
 * Haruskah VALUE CHECKPOINT menyala sekarang?
 * Syarat: ≥3 slot inti terisi DAN belum pernah menyala.
 */
function shouldFireValueCheckpoint(tx, filled = {}, alreadyFired = false) {
  if (alreadyFired) return false;
  return countCoreSlots(tx, filled) >= 3;
}

/** Pesan checkpoint — berhenti bertanya, beri sinyal momentum. */
function buildValueCheckpoint(isId = true) {
  return isId
    ? 'Oke, udah kebayang kebutuhan Kakak. Saya lagi cek beberapa opsi yang cocok ya, sebentar 🙏'
    : "Got it — I have a clear picture of what you need. Let me check a few matching options, one moment 🙏";
}

/* ══════════════════════════════════════════════════════════════════════════════
   4. SCORING — sesuai tabel SKILL_HOUSE_v1_pilot
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Skor BELI:
 *   motivation:1 · location:1 · price_band:2 · payment_method:1
 *   dp_readiness:2 (KPR) ATAU cash_confirmed:2 · timeline:1 · decision_maker:1 · furnish:1
 */
function scoreBeli(s = {}) {
  let score = 0;
  if (s.motivation)     score += 1;
  if (s.location)       score += 1;
  if (s.price_band)     score += 2;
  if (s.payment_method) score += 1;
  if (s.payment_method === 'cash' || s.cash_confirmed) score += 2;
  else if (s.dp_readiness)                             score += 2;
  if (s.timeline)       score += 1;
  if (s.decision_maker) score += 1;
  if (s.furnish)        score += 1;
  return { score, priority: _priority(score) };
}

/**
 * Skor SEWA:
 *   move_in_urgency:2 · location:1 · price_band:2 · furnish:1
 *   rent_period:1 · payment_term:1 · household:1 · decision_maker:1
 */
function scoreSewa(s = {}) {
  let score = 0;
  if (s.move_in_urgency) score += 2;
  if (s.location)        score += 1;
  if (s.price_band)      score += 2;
  if (s.furnish)         score += 1;
  if (s.rent_period)     score += 1;
  if (s.payment_term)    score += 1;
  if (s.household)       score += 1;
  if (s.decision_maker)  score += 1;
  return { score, priority: _priority(score) };
}

function _priority(score) {
  return score >= 7 ? 'HOT' : score >= 4 ? 'WARM' : 'INCOMPLETE';
}

/* ══════════════════════════════════════════════════════════════════════════════
   5. QUESTION CAP
══════════════════════════════════════════════════════════════════════════════ */

// Batas pertanyaan AI pada pilot ini (jauh lebih ketat dari alur standar 12).
const MAX_PILOT_QUESTIONS = (() => {
  const n = parseInt(process.env.HOUSE_PILOT_MAX_QUESTIONS || '', 10);
  return Number.isFinite(n) && n >= 3 && n <= 12 ? n : 7;
})();

/** Sudah mencapai batas pertanyaan? → keluarkan brief apa adanya. */
function reachedQuestionCap(aiCount = 0) {
  return Number(aiCount) >= MAX_PILOT_QUESTIONS;
}

module.exports = {
  extractListingReference,
  isAvailabilityQuestion,
  countAvailabilityPushes,
  buildHoldingScript,
  buildAvailabilityEscalation,
  countCoreSlots,
  shouldFireValueCheckpoint,
  buildValueCheckpoint,
  scoreBeli,
  scoreSewa,
  reachedQuestionCap,
  MAX_PILOT_QUESTIONS,
  CORE_SLOTS,
};

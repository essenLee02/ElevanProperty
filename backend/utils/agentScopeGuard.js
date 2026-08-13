/**
 * agentScopeGuard.js
 *
 * BATAS KEMAMPUAN AGENT → BATAS JAWABAN AI.
 *
 * Agent menetapkan di profilnya APA yang dia layani:
 *   users.trans_type      Sale | Rent | Both
 *   users.payment_type    Cash | KPR  | Both
 *   users.rental_duration angka minimal sewa   (hanya Rent/Both)
 *   users.rental_type     Day|Week|Month|Year|Night (satuan minimal sewa)
 *
 * Modul ini menjawab DUA pertanyaan, keduanya deterministik (nol token prompt):
 *   1. Apakah TRANSAKSI yang diminta customer dilayani agent ini?
 *      Contoh: trans_type=Sale, customer bilang "mau ngekos" → TIDAK.
 *   2. Bila sewa: apakah DURASI-nya memenuhi minimal agent?
 *      Contoh: rental_duration=4, rental_type=Day, customer minta 3 hari → TIDAK.
 *
 * ⚠️ KENAPA DI KODE, BUKAN ATURAN PROMPT: prompt WhatsApp sudah ±67.400 token
 * dan setiap aturan baru menurunkan kepatuhan model secara global (M62). Batas
 * bisnis agent adalah fakta yang bisa dihitung pasti — persis kelas hal yang
 * proyek ini sudah pelajari harus jadi EKSTRAKTOR, bukan prosa (M73/M84).
 *
 * ⚠️ FAIL-OPEN. Bila aturan agent tidak diketahui (trans_type null / gagal load),
 * modul ini TIDAK memblokir apa pun. Menolak customer karena data profil agent
 * belum lengkap jauh lebih merugikan daripada tidak menegakkan batas.
 */

'use strict';

const { toDays, formatDurationId, parseDurationFromText, unitLabelId } = require('./durationConverter');

/* ── Deteksi niat transaksi dari kalimat customer ──────────────────────────── */

// SEWA — termasuk kos & kontrak, sesuai contoh user ("booking, sewa, ngekos, kontrak").
const RENT_INTENT_RE = /\b(sewa|nyewa|menyewa|disewa|rental|ngontrak|kontrak(?:an)?|ngekos|kos|kost|indekos|booking|book|reservasi|menginap|nginap|nginep|check[\s-]?in|checkin|rent|lease|stay)\b/i;

// BELI — termasuk KPR/kredit (orang sering langsung menyebut caranya).
const SALE_INTENT_RE = /\b(beli|membeli|dibeli|pembelian|purchase|buy|kpr|kredit\s+pemilikan|cicil(?:an)?|angsuran|dp|uang\s+muka|over\s*kredit|akad|balik\s+nama|shm|sertifikat)\b/i;

// Kata yang menandakan customer bicara PEMBIAYAAN kredit (bukan cash).
// "nyicil" bukan "ny"+"cicil" (n-y-i-c-i-l), jadi harus ditulis utuh —
// pola `(?:ny)?cicil` TIDAK akan pernah mencocokinya.
const KPR_INTENT_RE = /\b(kpr|kredit\s+pemilikan|kredit|nyicil|nyicilan|mencicil|cicil(?:an)?|angsuran|mortgage|kpt|flpp|subsidi|syariah|murabahah)\b/i;
const CASH_INTENT_RE = /\b(cash|tunai|kontan|bayar\s+penuh|lunas)\b/i;

/**
 * Frasa PENJADWALAN KUNJUNGAN yang memakai kata "booking"/"book" tetapi TIDAK
 * ada hubungannya dengan menyewa.
 *
 * ⚠️ Tanpa ini, agent Sale akan menolak customernya sendiri di TENGAH alur beli:
 * "boleh booking viewing besok?" / "jadwalkan booking survei" mengandung kata
 * "booking", sehingga terbaca sebagai niat SEWA dan memicu penolakan
 * "maaf, saya fokus jual beli" — kepada orang yang justru sedang membeli.
 * Frasa ini dibuang DULU sebelum deteksi niat.
 */
const SCHEDULING_PHRASE_RE =
  /\b(?:jadwal(?:kan)?\s+)?(?:book(?:ing)?|reservasi)\s+(?:untuk\s+)?(?:viewing|survei|survey|kunjungan|lihat|liat|unit|jadwal)\b|\bviewing\b|\bsurvei\b|\bsurvey\b/gi;

/**
 * Niat transaksi customer dari sebuah kalimat.
 *
 * ⚠️ SENGAJA hanya melihat pesan ini, TANPA "transaksi yang sudah mapan di sesi"
 * sebagai penimpa. Versi pertama modul ini punya override semacam itu untuk
 * meredam false positive "booking viewing" — tetapi override itu juga MEMBUNGKAM
 * peralihan yang SUNGGUHAN: customer yang tadinya mau beli lalu menulis "Saya
 * mau sewa apartemen" akan tetap dianggap pembeli, sehingga agent Sale-only
 * tidak pernah memberi tahu bahwa sewa tidak dilayani. False positive-nya sudah
 * ditangani jauh lebih tepat oleh SCHEDULING_PHRASE_RE di atas (membuang frasa
 * jadwal kunjungan saja), jadi override yang berdampak luas itu dihapus.
 *
 * @param {string} text
 * @returns {'rent'|'sale'|null}  null = tidak jelas → jangan menyimpulkan apa pun
 */
function detectTransIntent(text) {
  const s = String(text || '').replace(SCHEDULING_PHRASE_RE, ' ');
  const rent = RENT_INTENT_RE.test(s);
  const sale = SALE_INTENT_RE.test(s);
  // Keduanya muncul ("beli atau sewa ya?") → ambigu, jangan tegakkan batas.
  if (rent && sale) return null;
  return rent ? 'rent' : sale ? 'sale' : null;
}

/** Niat pembiayaan customer. @returns {'kpr'|'cash'|null} */
function detectPaymentIntent(text) {
  const s = String(text || '');
  const kpr = KPR_INTENT_RE.test(s);
  const cash = CASH_INTENT_RE.test(s);
  if (kpr && cash) return null;
  if (kpr) return 'kpr';
  if (cash) return 'cash';
  return null;
}

/* ── Penegakan batas ───────────────────────────────────────────────────────── */

const _norm = (v) => String(v || '').trim().toLowerCase();

/** Apakah agent melayani transaksi ini? */
function servesTransaction(rules, intent) {
  const t = _norm(rules && rules.transType);
  if (!t || !intent) return true;          // fail-open
  if (t === 'both') return true;
  if (t === 'sale') return intent === 'sale';
  if (t === 'rent') return intent === 'rent';
  return true;
}

/**
 * Apakah agent melayani metode pembayaran ini? (hanya relevan untuk Sale)
 *
 * ⚠️ ATURANNYA SENGAJA ASIMETRIS — dan ini keputusan bisnis, bukan kelalaian:
 *   payment_type=Cash + customer minta KPR  → TOLAK (agent memang tidak bisa
 *                                             mengurus pembiayaan kredit).
 *   payment_type=KPR  + customer bayar CASH → TERIMA. Pembeli cash selalu
 *                                             LEBIH mudah daripada pembeli KPR;
 *                                             menolaknya berarti membuang closing
 *                                             yang paling siap. "KPR" di profil
 *                                             berarti "saya BISA bantu KPR",
 *                                             bukan "saya hanya mau KPR".
 * Menolak pembeli cash pernah nyaris ikut terpasang di sini karena
 * perbandingan simetris (p === payIntent) terlihat masuk akal di kode.
 */
function servesPayment(rules, payIntent) {
  const p = _norm(rules && rules.paymentType);
  if (!p || !payIntent) return true;       // fail-open
  if (p === 'both') return true;
  if (payIntent === 'cash') return true;   // cash SELALU diterima (lihat atas)
  return p === payIntent;                  // sisanya: KPR hanya bila agent KPR
}

/** Label transaksi yang dilayani, untuk kalimat penolakan. */
function transLabelId(transType) {
  switch (_norm(transType)) {
    case 'sale': return 'jual beli properti';
    case 'rent': return 'sewa properti';
    case 'both': return 'jual beli dan sewa properti';
    default: return 'properti';
  }
}

function payLabelId(paymentType) {
  switch (_norm(paymentType)) {
    case 'kpr': return 'KPR';
    case 'cash': return 'cash';
    case 'both': return 'cash maupun KPR';
    default: return '';
  }
}

/**
 * Minimal sewa agent dalam hari (null bila tidak diatur).
 */
function minRentalDays(rules) {
  if (!rules || rules.rentalDuration == null || !rules.rentalType) return null;
  return toDays(rules.rentalDuration, rules.rentalType);
}

/**
 * PEMERIKSAAN UTAMA — apakah pesan customer berada DI LUAR layanan agent?
 *
 * @param {string} message  pesan customer (sudah di-expand singkatannya)
 * @param {object} rules    dari agentBusinessRulesService
 * @returns {{blocked:boolean, reason?:string, reply?:string}}
 *          blocked=false → lanjutkan alur normal (mayoritas kasus)
 */
function checkAgentScope(message, rules) {
  const pass = { blocked: false };
  if (!rules || !_norm(rules.transType)) return pass;   // fail-open

  const text = String(message || '');
  const intent = detectTransIntent(text);

  /* 1. Transaksi di luar layanan agent ------------------------------------- */
  if (intent && !servesTransaction(rules, intent)) {
    const serves = transLabelId(rules.transType);
    const payHint = _norm(rules.transType) === 'sale' && _norm(rules.paymentType) !== 'cash'
      ? ` dan bisa dibantu lewat ${payLabelId(rules.paymentType)}`
      : '';
    const asked = intent === 'rent' ? 'sewa/booking' : 'pembelian';
    return {
      blocked: true,
      reason: 'trans_type',
      reply: `Mohon maaf, Kak 🙏 untuk ${asked} saya belum bisa bantu. `
           + `Saat ini saya fokus melayani *${serves}*${payHint}.\n\n`
           + `Kalau Kak sedang mencari properti untuk ${serves}, dengan senang hati saya bantu carikan 😊`,
    };
  }

  /* 2. Metode pembayaran di luar layanan (hanya bermakna untuk jual-beli) --- */
  if (intent === 'sale' || _norm(rules.transType) === 'sale') {
    const payIntent = detectPaymentIntent(text);
    if (payIntent && !servesPayment(rules, payIntent)) {
      const serves = payLabelId(rules.paymentType);
      const asked = payIntent === 'kpr' ? 'KPR/kredit' : 'pembayaran cash';
      return {
        blocked: true,
        reason: 'payment_type',
        reply: `Mohon maaf, Kak 🙏 untuk ${asked} saya belum bisa bantu. `
             + `Pembelian yang saya layani saat ini lewat *${serves}*.\n\n`
             + `Kalau Kak berkenan dengan skema ${serves}, saya bantu carikan unitnya ya 😊`,
      };
    }
  }

  /* 3. Durasi sewa di bawah minimal agent ---------------------------------- */
  const minDays = minRentalDays(rules);
  if (minDays != null && intent !== 'sale') {
    const asked = parseDurationFromText(text);
    if (asked && asked.days < minDays) {
      const minLabel = formatDurationId(rules.rentalDuration, rules.rentalType);
      const askedLabel = `${asked.amount} ${unitLabelId(asked.unit)}`;
      return {
        blocked: true,
        reason: 'rental_duration',
        reply: `Mohon maaf, Kak 🙏 untuk sewa ${askedLabel} belum bisa saya layani. `
             + `Minimal sewa di tempat saya *${minLabel}*.\n\n`
             + `Kalau Kak bersedia menyewa minimal ${minLabel}, saya bantu carikan unitnya ya 😊`,
      };
    }
  }

  return pass;
}

module.exports = {
  detectTransIntent,
  detectPaymentIntent,
  servesTransaction,
  servesPayment,
  minRentalDays,
  transLabelId,
  payLabelId,
  checkAgentScope,
};

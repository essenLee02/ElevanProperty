/**
 * userBusinessRules.js
 *
 * SATU SUMBER KEBENARAN untuk field users yang SALING TERIKAT:
 *   ai_primary · trans_type · payment_type · rental_duration · rental_type
 *
 * Dipakai oleh registerController, profileController, dan tes. Aturan ini
 * SENGAJA tidak di-inline di controller: register dan profile dulu punya
 * salinan validasi sendiri untuk field lain, dan salinan itulah yang membuat
 * keduanya melenceng satu sama lain seiring waktu.
 *
 * ── ATURAN trans_type → payment_type (dari spesifikasi user) ────────────────
 *   Rent  → payment_type WAJIB "Cash". KPR TIDAK boleh (sewa tidak dibiayai KPR).
 *   Both  → payment_type WAJIB "Both".
 *   Sale  → payment_type bebas: "Cash", "KPR", atau "Both".
 *
 * ── ATURAN rental_duration / rental_type ───────────────────────────────────
 *   Hanya BOLEH terisi bila trans_type "Rent" atau "Both".
 *   Untuk "Sale" keduanya dipaksa null — menyimpan durasi sewa pada agent yang
 *   hanya melayani jual-beli adalah data yang tidak punya arti.
 *   Keduanya berpasangan: mengisi salah satu tanpa yang lain ditolak, karena
 *   "3" tanpa satuan (atau "Month" tanpa angka) tidak bisa dibaca siapa pun.
 */

'use strict';

/** Pilihan yang DITAWARKAN di UI (register & profile). */
const AI_PRIMARY_UI_OPTIONS = ['Default', 'Deepseek', 'Kimi'];

/**
 * Nilai ai_primary yang DITERIMA backend. Lebih luas dari opsi UI: nilai lain
 * masih sah bila di-set langsung di DB (mis. saat provider lain dipulihkan),
 * dan menolaknya akan membuat profile gagal disimpan hanya karena user membuka
 * halaman itu. UI tetap menampilkan tiga opsi di atas.
 */
const AI_PRIMARY_ALLOWED = [
  'Default', 'Deepseek', 'Kimi', 'Qwen', 'Chat GPT', 'Claude', 'Private',
];

const TRANS_TYPES   = ['Sale', 'Rent', 'Both'];
const PAYMENT_TYPES = ['Cash', 'KPR', 'Both'];
const RENTAL_TYPES  = ['Day', 'Week', 'Month', 'Year', 'Night'];

/** payment_type yang sah untuk tiap trans_type. */
const PAYMENT_BY_TRANS = {
  Rent: ['Cash'],
  Both: ['Both'],
  Sale: ['Cash', 'KPR', 'Both'],
};

/** trans_type yang boleh punya rental_duration / rental_type. */
const TRANS_WITH_RENTAL = ['Rent', 'Both'];

/**
 * Apakah nilai ini "tidak diisi"?
 *
 * ⚠️ Menyamakan null/undefined/'' SANGAT PENTING di sini. Bug produksi
 * (12 Agu 2026): frontend mengirim `rental_duration: null` secara EKSPLISIT saat
 * agent berpindah ke trans_type "Sale" (input-nya disembunyikan lalu
 * dikosongkan). Cek lama memakai `String(v).trim() !== ''`, padahal
 * `String(null)` menghasilkan STRING "null" — bukan string kosong — sehingga
 * nilai yang justru sudah DIKOSONGKAN malah terbaca sebagai "user mengirim
 * durasi sewa untuk Sale", dan simpan profil ditolak. Agent tidak punya cara
 * lolos: field-nya tidak terlihat lagi di layar.
 */
function _isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

/** Samakan kapitalisasi ke bentuk kanonik daftar (case-insensitive). */
function _canon(value, allowed) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return '';
  return allowed.find(a => a.toLowerCase() === v.toLowerCase()) || '';
}

/** payment_type yang WAJIB/boleh dipakai untuk sebuah trans_type. */
function allowedPaymentTypes(transType) {
  return PAYMENT_BY_TRANS[_canon(transType, TRANS_TYPES)] || PAYMENT_TYPES;
}

/** Apakah trans_type ini boleh mengisi durasi sewa? */
function supportsRental(transType) {
  return TRANS_WITH_RENTAL.includes(_canon(transType, TRANS_TYPES));
}

/**
 * Validasi + normalisasi kelima field sekaligus.
 *
 * Mengembalikan objek siap-tulis (`values`) — BUKAN memodifikasi input — supaya
 * pemanggil tidak perlu tahu aturan turunannya (mis. Sale memaksa rental_* null,
 * Both memaksa payment_type "Both").
 *
 * @param {object} input  nilai mentah dari req.body (boleh sebagian/undefined)
 * @param {object} [current] nilai tersimpan saat ini (untuk update parsial)
 * @returns {{ok:true, values:object}|{ok:false, error:string}}
 */
function validateUserBusinessFields(input = {}, current = {}) {
  const pick = (key, fallback) => (input[key] !== undefined ? input[key] : fallback);

  /* ── ai_primary ─────────────────────────────────────────────────────────── */
  const aiRaw = pick('ai_primary', current.ai_primary ?? 'Default');
  const aiPrimary = _canon(aiRaw, AI_PRIMARY_ALLOWED) || (String(aiRaw).trim() ? '' : 'Default');
  if (!aiPrimary) {
    return { ok: false, error: `AI Primary tidak valid. Pilihan: ${AI_PRIMARY_UI_OPTIONS.join(', ')}` };
  }

  /* ── trans_type ─────────────────────────────────────────────────────────── */
  const transRaw = pick('trans_type', current.trans_type ?? 'Both');
  const transType = _canon(transRaw, TRANS_TYPES);
  if (!transType) {
    return { ok: false, error: `Transaction Type tidak valid. Pilihan: ${TRANS_TYPES.join(', ')}` };
  }

  /* ── payment_type — TERIKAT trans_type ──────────────────────────────────── */
  const allowedPay = allowedPaymentTypes(transType);
  // Bila payment_type tidak dikirim, ambil yang tersimpan; bila yang tersimpan
  // pun tidak sah untuk trans_type BARU (mis. user mengubah Sale→Rent sementara
  // payment_type lamanya "KPR"), pakai nilai sah pertama. Tanpa fallback ini,
  // sekadar mengganti trans_type akan menolak simpan dengan pesan yang
  // membingungkan tentang field yang tidak user sentuh.
  const payRaw = pick('payment_type', current.payment_type);
  let paymentType = _canon(payRaw, PAYMENT_TYPES);
  if (!paymentType || !allowedPay.includes(paymentType)) {
    if (input.payment_type !== undefined && _canon(payRaw, PAYMENT_TYPES) && !allowedPay.includes(_canon(payRaw, PAYMENT_TYPES))) {
      // User MENGIRIM nilai yang bentrok secara eksplisit → tolak dengan jelas.
      const why = transType === 'Rent'
        ? 'transaksi Rent hanya boleh Cash (sewa tidak dibiayai KPR)'
        : transType === 'Both'
          ? 'transaksi Both harus Both'
          : `transaksi Sale hanya boleh ${allowedPay.join('/')}`;
      return { ok: false, error: `Payment Type "${_canon(payRaw, PAYMENT_TYPES)}" tidak sesuai — ${why}` };
    }
    paymentType = allowedPay[0];
  }

  /* ── rental_duration / rental_type ──────────────────────────────────────── */
  let rentalDuration = null;
  let rentalType     = null;

  if (supportsRental(transType)) {
    const durRaw  = pick('rental_duration', current.rental_duration);
    const typeRaw = pick('rental_type', current.rental_type);

    const durStr = _isBlank(durRaw)  ? '' : String(durRaw).trim();
    const typStr = _isBlank(typeRaw) ? '' : String(typeRaw).trim();

    if (durStr !== '' || typStr !== '') {
      const durNum = Number(durStr);
      if (!Number.isInteger(durNum) || durNum <= 0) {
        return { ok: false, error: 'Rental Duration harus berupa angka bulat lebih dari 0' };
      }
      const rt = _canon(typStr, RENTAL_TYPES);
      if (!rt) {
        return { ok: false, error: `Rental Type tidak valid. Pilihan: ${RENTAL_TYPES.join(', ')}` };
      }
      rentalDuration = durNum;
      rentalType     = rt;
    }
    // Keduanya kosong → tetap null (durasi minimal memang opsional).
  } else if (!_isBlank(input.rental_duration) || !_isBlank(input.rental_type)) {
    // trans_type = Sale tapi user mengirim durasi sewa BERISI → beri tahu,
    // jangan dibuang senyap (user akan mengira datanya tersimpan).
    //
    // ⚠️ Yang dicek HANYA nilai yang benar-benar BERISI. Nilai kosong —
    // termasuk `null` EKSPLISIT yang dikirim frontend saat field-nya
    // disembunyikan & dikosongkan karena pindah ke "Sale" — bukan pelanggaran,
    // justru tanda user sudah membereskannya. Lihat _isBlank() untuk bug
    // nyatanya (12 Agu 2026: agent tidak bisa menyimpan profil sama sekali
    // setelah pindah ke Sale, karena `String(null)` = "null" ≠ "").
    return { ok: false, error: 'Rental Duration/Type hanya berlaku untuk Transaction Type "Rent" atau "Both"' };
  }

  return {
    ok: true,
    values: {
      ai_primary:      aiPrimary,
      trans_type:      transType,
      payment_type:    paymentType,
      rental_duration: rentalDuration,
      rental_type:     rentalType,
    },
  };
}

module.exports = {
  AI_PRIMARY_UI_OPTIONS,
  AI_PRIMARY_ALLOWED,
  TRANS_TYPES,
  PAYMENT_TYPES,
  RENTAL_TYPES,
  PAYMENT_BY_TRANS,
  allowedPaymentTypes,
  supportsRental,
  validateUserBusinessFields,
};

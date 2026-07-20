/**
 * sessionAnchors.js
 *
 * Cache STICKY (in-memory, per-sesi) untuk ANCHOR kualifikasi: buildingType,
 * transactionType, location. Tujuan: mencegah alur RESET ke Q1 di tengah
 * percakapan panjang saat pesan pembuka (yang membawa tipe/transaksi/lokasi)
 * keluar dari window history — customer sering ketik 1–3 kata/pesan sehingga satu
 * kualifikasi bisa puluhan pesan dan tipe "keluar scope" → gate keliru menganggap
 * tipe kosong → "Tipe properti apa yang Anda cari?" (loop).
 *
 * Anchor diingat begitu terdeteksi, dan MELENGKAPI (bukan menimpa) hasil ekstraksi
 * window bila field-nya kosong. Aturan konsistensi:
 *   - Ganti TIPE (tipe saat ini ≠ tipe teringat) → anchor lama DIBUANG (pencarian
 *     baru; tx/lokasi lama tidak boleh bocor), lalu tipe baru diingat.
 *   - Setelah SUMMARY terkirim → clearAnchors() (pencarian berikutnya mulai fresh).
 *   - TTL idle (CHATBOT_COOKIE_TTL_MINUTES) → anchor kedaluwarsa, selaras dgn TTL
 *     memori history (getConversationHistory) supaya tidak ada sisa sesi lama.
 *
 * Catatan: in-memory (hilang saat restart). Untuk sesi aktif (menit-an) ini cukup;
 * window history (≥60) menjadi jaring pengaman bila proses baru saja restart.
 */

'use strict';

// sessionId → { buildingType, transactionType, location, at }
const _anchors = new Map();

function _ttlMs() {
  const raw = String(process.env.CHATBOT_COOKIE_TTL_MINUTES || '90').trim().replace(/[;\s]+$/g, '');
  const min = parseInt(raw, 10);
  return (Number.isFinite(min) && min > 0 ? min : 90) * 60 * 1000;
}

/** Ambil anchor sesi (null bila tidak ada / kedaluwarsa). */
function getAnchors(sessionId) {
  if (!sessionId) return null;
  const a = _anchors.get(sessionId);
  if (!a) return null;
  if (Date.now() - a.at > _ttlMs()) {
    _anchors.delete(sessionId);
    return null;
  }
  return a;
}

/** Simpan/merge anchor non-kosong (dipanggil setelah reconcile). */
function rememberAnchors(sessionId, filters = {}) {
  if (!sessionId || !filters) return;
  const prev = getAnchors(sessionId) || {};
  _anchors.set(sessionId, {
    buildingType:    filters.buildingType    || prev.buildingType    || '',
    transactionType: filters.transactionType || prev.transactionType || '',
    location:        filters.location        || prev.location        || '',
    at: Date.now(),
  });
}

/** Hapus anchor sesi (dipanggil saat summary terkirim / reset penuh). */
function clearAnchors(sessionId) {
  if (sessionId) _anchors.delete(sessionId);
}

/**
 * Rekonsiliasi anchor dengan filters hasil ekstraksi window. Memutasi `filters`:
 *  - Ganti tipe → buang anchor lama (jangan warisi tx/lokasi lama), pakai tipe baru.
 *  - Kalau field kosong → isi dari anchor teringat (mencegah "lupa tipe" saat scroll).
 * Lalu ingat anchor terbaru. Kembalikan `filters` yang sama (sudah dimutasi).
 *
 * @param {string|number} sessionId
 * @param {object} filters - hasil extractPropertyFilters (dimutasi in-place)
 * @returns {object} filters
 */
function reconcile(sessionId, filters = {}) {
  if (!sessionId || !filters) return filters;
  const a = getAnchors(sessionId);

  if (a && filters.buildingType && a.buildingType && filters.buildingType !== a.buildingType) {
    // Ganti tipe properti → pencarian baru. Anchor lama (tx/lokasi) stale → buang.
    clearAnchors(sessionId);
  } else if (a) {
    // Lengkapi field yang kosong dari anchor (tipe/transaksi/lokasi yang "keluar window").
    if (!filters.buildingType    && a.buildingType)    filters.buildingType    = a.buildingType;
    if (!filters.transactionType && a.transactionType) filters.transactionType = a.transactionType;
    if (!filters.location        && a.location)        filters.location        = a.location;
  }

  rememberAnchors(sessionId, filters);
  return filters;
}

module.exports = {
  getAnchors,
  rememberAnchors,
  clearAnchors,
  reconcile,
};

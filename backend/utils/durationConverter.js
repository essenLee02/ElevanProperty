/**
 * durationConverter.js
 *
 * Konversi durasi sewa (angka + satuan) ke HARI, dan parsing durasi sukarela
 * dari kalimat customer. Dipakai oleh agentScopeGuard.js untuk membandingkan
 * durasi yang diminta customer terhadap users.rental_duration/rental_type
 * (minimal sewa yang dilayani agent).
 *
 * TABEL KONVERSI (dari spesifikasi user, HARUS PERSIS — jangan dibulatkan
 * memakai kalender asli/leap year; ini konversi bisnis, bukan tanggal):
 *   Day/Night = 1 hari · Week = 7 hari · Month = 30 hari · Year = 365 hari
 * Contoh (harus lulus): 9 Days=9 · 2 Weeks=14 · 3 Weeks=21 · 1 Month=30 ·
 *                        4 Months=120 · 1 Year=365 · 2 Years=730
 */

'use strict';

const UNIT_DAYS = {
  day: 1, night: 1,
  week: 7,
  month: 30,
  year: 365,
};

const UNIT_LABEL_ID = {
  day: 'hari', night: 'malam',
  week: 'minggu',
  month: 'bulan',
  year: 'tahun',
};

/** Samakan satuan (day/days/hari/minggu/week/…) ke kunci kanonik UNIT_DAYS. */
function canonUnit(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/s$/, ''); // days→day, weeks→week
  const map = {
    day: 'day', hari: 'day',
    night: 'night', malam: 'night',
    week: 'week', minggu: 'week', pekan: 'week',
    month: 'month', bulan: 'month',
    year: 'year', tahun: 'year', thn: 'year',
  };
  return map[s] || '';
}

/**
 * amount × hari-per-satuan.
 * @param {number} amount
 * @param {string} unit  Day|Night|Week|Month|Year (atau varian Indonesia)
 * @returns {number|null} total hari, atau null bila unit tidak dikenali
 */
function toDays(amount, unit) {
  const u = canonUnit(unit);
  const n = Number(amount);
  if (!u || !Number.isFinite(n) || n <= 0) return null;
  return n * UNIT_DAYS[u];
}

/** Label Indonesia untuk satuan (untuk pesan ke customer). */
function unitLabelId(unit) {
  const u = canonUnit(unit);
  return u ? UNIT_LABEL_ID[u] : String(unit || '');
}

/**
 * Frasa "N <satuan>" siap tampil, mis. toDays 4 & 'Month' → "4 bulan".
 */
function formatDurationId(amount, unit) {
  return `${amount} ${unitLabelId(unit)}`;
}

// Anchor KETAT — sengaja meniru pola yang sudah terverifikasi di M82/M89
// (aiPromptBuilderService.js): durasi HARUS didahului kata pemicu eksplisit,
// supaya "800K-1.4 juta/hari" (satuan HARGA) tidak salah terbaca sebagai
// durasi 1 hari, dan "5 hari lagi" (OFFSET tanggal masuk) tidak ikut tertangkap.
const DURATION_ANCHOR_RE = new RegExp(
  '\\b(?:durasi(?:\\s+(?:sewa|menginap|booking|nginap|kontrak))?|selama|untuk|book(?:ing)?|nginap|menginap|nginep|kontrak|ngekos|sewa)\\s*[:\\-]?\\s*(\\d+)\\s*(hari|malam|minggu|pekan|bulan|tahun|thn|day|days|night|nights|week|weeks|month|months|year|years)\\b',
  'i'
);
const OFFSET_NOT_DURATION_RE = /\b\d+\s*(?:hari|malam|minggu|pekan|bulan|tahun)\s+lagi\b/i;

/**
 * Cari durasi yang disebutkan CUSTOMER dalam satu kalimat, bila ada.
 * Sengaja anchor-ketat (lihat regex di atas) — bukan "angka+satuan pertama
 * di kalimat manapun", supaya harga per-hari/offset tanggal tidak ikut.
 *
 * @param {string} text
 * @returns {{amount:number, unit:string, days:number}|null}
 */
function parseDurationFromText(text) {
  const s = String(text || '');
  if (OFFSET_NOT_DURATION_RE.test(s)) return null;
  const m = s.match(DURATION_ANCHOR_RE);
  if (!m) return null;
  const amount = Number(m[1]);
  const unit = m[2];
  const days = toDays(amount, unit);
  if (days == null) return null;
  return { amount, unit, days };
}

module.exports = {
  UNIT_DAYS,
  canonUnit,
  toDays,
  unitLabelId,
  formatDurationId,
  parseDurationFromText,
};

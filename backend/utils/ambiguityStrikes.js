'use strict';
/**
 * ambiguityStrikes.js — eskalasi off-topic/ambigu: arahkan → tutup → DIAM (M134)
 *
 * Directive pemilik proyek (24 Agu 2026):
 *   "Jika customer mulai ambigu di tengah jalan, AI bisa mengarahkan kembali ke
 *    topik properti, namun jika customer tetap melakukan hal yang sama; AI minta
 *    maaf untuk mengakhiri obrolan, mendiamkan customer selama mereka ambigu
 *    atau melanggar guardrails."
 *
 * TIGA TAHAP per sesi:
 *   strike 1 → ARAHKAN  ('redirect') — ajak kembali ke topik properti.
 *   strike 2 → TUTUP    ('closing')  — minta maaf, akhiri obrolan dengan sopan.
 *   strike 3+→ DIAM     ('silent')   — tidak dibalas sama sekali, dan (penting)
 *                                      TIDAK memanggil API AI berbayar lagi.
 *
 * Kenapa ini SAH sebagai backend guardrail meski profil 'platform' aktif:
 * tahap 'silent' adalah PENGHEMATAN TOKEN, persis peran yang pemilik proyek
 * tetapkan untuk guardrail platform ("hanya untuk deteksi awal, agar AI tidak
 * menghabiskan banyak token"). Backend tidak menyusun ISI balasan di tahap 1-2
 * saat profil 'platform' — kalimatnya tetap dari platform AI (lihat
 * guardrailPolicy.js); yang backend tentukan hanyalah "masih layak dikirim ke
 * API atau tidak".
 *
 * ⚠️ RESET OTOMATIS: satu pesan properti yang SAH menghapus seluruh strike.
 * Customer yang sempat melantur lalu kembali serius TIDAK boleh terkunci diam —
 * itu akan menghukum lead yang sah, kesalahan yang jauh lebih mahal daripada
 * satu-dua balasan off-topic. Sama semangatnya dengan fail-open di
 * guardrailPolicy.screenForPlatform().
 */

/** sessionKey → { count, lastAt } */
const _strikes = new Map();

/** TTL: strike lama dilupakan agar sesi baru tidak mewarisi hukuman sesi lama. */
const STRIKE_TTL_MS = Number(process.env.AMBIGUITY_STRIKE_TTL_MS || 30 * 60 * 1000);

/** Batas tahap. Bisa disetel .env bila agent ingin lebih sabar/tegas. */
const REDIRECT_LIMIT = Number(process.env.AMBIGUITY_REDIRECT_LIMIT || 1);
const CLOSING_LIMIT  = Number(process.env.AMBIGUITY_CLOSING_LIMIT  || 2);

function _key(sessionId) { return String(sessionId || 'unknown'); }

function _prune(key) {
  const entry = _strikes.get(key);
  if (!entry) return null;
  if (Date.now() - entry.lastAt > STRIKE_TTL_MS) { _strikes.delete(key); return null; }
  return entry;
}

/**
 * Catat satu pesan ambigu/off-topic dan kembalikan tahap yang berlaku.
 *
 * @param {string|number} sessionId
 * @returns {{ stage: 'redirect'|'closing'|'silent', count: number }}
 */
function recordAmbiguous(sessionId) {
  const key = _key(sessionId);
  const entry = _prune(key) || { count: 0, lastAt: Date.now() };
  entry.count += 1;
  entry.lastAt = Date.now();
  _strikes.set(key, entry);

  const stage = entry.count <= REDIRECT_LIMIT ? 'redirect'
    : entry.count <= CLOSING_LIMIT ? 'closing'
      : 'silent';

  return { stage, count: entry.count };
}

/**
 * Tahap saat ini TANPA menambah hitungan (untuk pengecekan sebelum memanggil API).
 * @returns {{ stage: 'none'|'redirect'|'closing'|'silent', count: number }}
 */
function peekStage(sessionId) {
  const entry = _prune(_key(sessionId));
  if (!entry) return { stage: 'none', count: 0 };
  const stage = entry.count <= REDIRECT_LIMIT ? 'redirect'
    : entry.count <= CLOSING_LIMIT ? 'closing'
      : 'silent';
  return { stage, count: entry.count };
}

/** Apakah sesi ini sedang dalam keadaan DIAM (jangan panggil API sama sekali)? */
function isSilenced(sessionId) {
  return peekStage(sessionId).stage === 'silent';
}

/**
 * Hapus semua strike — dipanggil saat customer mengirim pesan properti yang SAH.
 * Inilah yang membuat "diam" bersifat SEMENTARA, bukan blokir permanen.
 */
function clearStrikes(sessionId) {
  _strikes.delete(_key(sessionId));
}

/** Kosongkan seluruh cache (tes / restart logis). */
function resetAll() { _strikes.clear(); }

/**
 * Balasan penutup untuk tahap 'closing' — HANYA dipakai profil 'local'
 * (Private Agent). Di profil 'platform', kalimat penutup disusun platform AI
 * sesuai skill doc; backend tidak mengarang teks balasan (M133).
 */
function buildClosingReply(agentName = '', isId = true) {
  const appName = process.env.APP_NAME || 'Elevan Property';
  const name = agentName || appName;
  return isId
    ? `Mohon maaf, Kak 🙏 sepertinya yang Anda tanyakan di luar layanan properti yang bisa saya bantu.\n\n` +
      `Saya akhiri dulu percakapan ini ya. Kalau nanti ada kebutuhan sewa atau beli properti, ` +
      `silakan chat saya lagi kapan saja 😊\n\nSalam hangat,\n*${name}*\n*${appName}*`
    : `I'm sorry 🙏 this seems outside the property services I can help with.\n\n` +
      `I'll close our conversation here. Whenever you need to rent or buy a property, ` +
      `feel free to message me again 😊\n\nWarm regards,\n*${name}*\n*${appName}*`;
}

module.exports = {
  STRIKE_TTL_MS,
  REDIRECT_LIMIT,
  CLOSING_LIMIT,
  recordAmbiguous,
  peekStage,
  isSilenced,
  clearStrikes,
  resetAll,
  buildClosingReply,
};

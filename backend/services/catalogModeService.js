/**
 * catalogModeService.js
 *
 * Mode summary/katalog PER-AGENT — sumber kebenaran: kolom `users.catalog_summary`
 * ('ON' = summary + katalog, 'OFF' = summary saja). Menggantikan env global
 * RESPOND_CATALOG_RUN; env kini hanya FALLBACK ketika kolom masih NULL (agent belum
 * pernah set) atau agent tidak dikenal.
 *
 * Agent mengubah modenya sendiri lewat chat WhatsApp ke bot-nya:
 *   "matikan summary" / "saya mau summary off" / "turn off the summary"  → OFF
 *   "nyalakan summary" / "aktifkan summary" / "turn on the summary"      → ON
 * (deteksi: detectCatalogSummaryCommand; eksekusi: setCatalogMode)
 *
 * Cache in-memory per agent (TTL) supaya pembaca SYNC di dalam prompt builder
 * (aiPromptBuilderService) tidak perlu query DB — cache dihangatkan oleh
 * resolveCatalogMode() yang selalu dipanggil di awal pipeline pesan.
 */

'use strict';

const CACHE_TTL_MS = 60 * 1000;   // 1 menit — perubahan via chat langsung update cache

// agentUserId → { mode: 'ON'|'OFF'|null, at: epoch-ms }
const _cache = new Map();

/** Fallback global dari env (dipakai bila kolom NULL / agent tak dikenal). */
function envFallbackMode() {
  return String(process.env.RESPOND_CATALOG_RUN || 'OFF').toUpperCase() === 'ON' ? 'ON' : 'OFF';
}

/** Normalisasi nilai kolom → 'ON' | 'OFF' | null. */
function _normMode(v) {
  const s = String(v || '').trim().toUpperCase();
  return s === 'ON' ? 'ON' : s === 'OFF' ? 'OFF' : null;
}

/**
 * Mode katalog agent (async, source of truth). Baca DB dengan cache TTL.
 * @param {string|null} agentUserId - users.user_id (mis. 'LFGKT49002')
 * @returns {Promise<'ON'|'OFF'>}
 */
async function resolveCatalogMode(agentUserId) {
  if (!agentUserId) return envFallbackMode();

  const hit = _cache.get(agentUserId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.mode || envFallbackMode();
  }

  try {
    const User = require('../models/User');
    const row  = await User.findOne({ where: { user_id: agentUserId }, attributes: ['catalog_summary'] });
    const mode = _normMode(row?.catalog_summary);
    _cache.set(agentUserId, { mode, at: Date.now() });
    return mode || envFallbackMode();
  } catch (err) {
    console.warn('[CatalogMode] DB read failed — fallback env:', err.message);
    return envFallbackMode();
  }
}

/**
 * Pembaca SYNC untuk konteks yang tidak bisa await (prompt builder). Mengandalkan
 * cache yang sudah dihangatkan resolveCatalogMode() di awal pipeline request.
 * @param {string|null} agentUserId
 * @returns {'ON'|'OFF'}
 */
function getCachedCatalogMode(agentUserId) {
  if (!agentUserId) return envFallbackMode();
  const hit = _cache.get(agentUserId);
  return (hit && hit.mode) || envFallbackMode();
}

/**
 * Set mode katalog agent (dipanggil handler perintah chat). Update DB + cache.
 * @param {string} agentUserId
 * @param {'ON'|'OFF'} mode
 * @returns {Promise<boolean>} sukses tersimpan ke DB
 */
async function setCatalogMode(agentUserId, mode) {
  const m = _normMode(mode);
  if (!agentUserId || !m) return false;
  try {
    const User = require('../models/User');
    const [n] = await User.update({ catalog_summary: m }, { where: { user_id: agentUserId } });
    _cache.set(agentUserId, { mode: m, at: Date.now() });
    return n > 0;
  } catch (err) {
    console.error('[CatalogMode] DB update failed:', err.message);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   DETEKSI PERINTAH — dari pesan chat agent
══════════════════════════════════════════════════════════════════════════════ */

// Kata kerja MATIKAN (→ OFF) & NYALAKAN (→ ON), ID + EN, formal + kolokial.
const OFF_VERBS = '(?:matikan|dimatikan|mati|off(?:kan)?|nonaktifkan|non-aktifkan|dinonaktifkan|disable(?:d)?|turn(?:ed)?\\s+off|switch(?:ed)?\\s+off|hentikan|stop|tutup)';
const ON_VERBS  = '(?:nyalakan|dinyalakan|nyala|hidupkan|dihidupkan|aktifkan|diaktifkan|aktif|on(?:kan)?|enable(?:d)?|turn(?:ed)?\\s+on|switch(?:ed)?\\s+on|buka)';

// Kata objek yang dimaksud: summary / catalog summary / katalog.
const TOPIC = '(?:catalog[_\\s-]?summary|summary|ringkasan|katalog|catalog)';

// Verb sebelum topik ("matikan summary", "turn off the summary", "AI nyalakan summary")
// atau topik sebelum verb ("summary dimatikan", "saya mau summary off", "summary: off").
const _OFF_RE = new RegExp(
  `\\b${OFF_VERBS}\\b[\\w\\s,-]{0,25}?\\b${TOPIC}\\b|\\b${TOPIC}\\b[\\w\\s,:=-]{0,25}?\\b${OFF_VERBS}\\b`, 'i');
const _ON_RE  = new RegExp(
  `\\b${ON_VERBS}\\b[\\w\\s,-]{0,25}?\\b${TOPIC}\\b|\\b${TOPIC}\\b[\\w\\s,:=-]{0,25}?\\b${ON_VERBS}\\b`, 'i');

/**
 * Deteksi perintah toggle summary dari teks chat.
 * Contoh OFF : "matikan summary", "matikan summary pada AI", "saya mau summary off",
 *              "saya ingin summary dimatikan", "AI can you please turn off the summary",
 *              "tolong summary dinonaktifkan", "catalog_summary=OFF"
 * Contoh ON  : "nyalakan summary", "AI nyalakan summary", "turn on the summary",
 *              "aktifkan summary", "summary dinyalakan", "catalog_summary=ON"
 * @param {string} text
 * @returns {'ON'|'OFF'|null} null bila bukan perintah toggle summary
 */
function detectCatalogSummaryCommand(text = '') {
  const t = String(text || '').toLowerCase()
    // Toleransi typo umum: "sumarry", "summry", "sumary" → summary
    .replace(/\bsum+ar*r*y\b/gi, 'summary');
  if (!new RegExp(`\\b${TOPIC}\\b`, 'i').test(t)) return null;
  // Nilai eksplisit "catalog_summary=OFF" / "summary: on"
  const eq = t.match(new RegExp(`\\b${TOPIC}\\b\\s*[:=]\\s*(on|off)\\b`, 'i'));
  if (eq) return eq[1].toUpperCase();
  const isOff = _OFF_RE.test(t);
  const isOn  = _ON_RE.test(t);
  if (isOff && !isOn) return 'OFF';
  if (isOn && !isOff) return 'ON';
  return null;   // ambigu / tidak menyebut verb → bukan perintah
}

/**
 * Cek apakah PENGIRIM adalah agent pemilik bot (bukan customer). Perintah toggle
 * hanya boleh dari nomor agent sendiri — customer tidak boleh mengubah mode.
 * Toleran beda format nomor (0888… vs 62888…): bandingkan 9 digit terakhir.
 * @param {string} senderPhone - nomor pengirim (raw/normalized)
 * @param {object} agent       - row users (butuh .phone)
 * @returns {boolean}
 */
function isSenderTheAgent(senderPhone, agent) {
  const digits = (v) => String(v || '').replace(/\D/g, '');
  const s = digits(senderPhone);
  const a = digits(agent?.phone);
  if (!s || !a || s.length < 8 || a.length < 8) return false;
  return s.slice(-9) === a.slice(-9);
}

/**
 * Handler lengkap: bila pesan adalah perintah toggle DARI agent → update DB dan
 * kembalikan teks konfirmasi untuk dibalas. Selain itu → null (lanjutkan alur normal).
 * @param {object} p
 * @param {string} p.message     - isi pesan masuk
 * @param {string} p.senderPhone - nomor pengirim
 * @param {object} p.agent       - row users agent pemilik terminal
 * @returns {Promise<string|null>} teks konfirmasi atau null
 */
async function maybeHandleCatalogCommand({ message, senderPhone, agent }) {
  const mode = detectCatalogSummaryCommand(message);
  if (!mode) return null;
  if (!isSenderTheAgent(senderPhone, agent)) {
    // Customer mencoba perintah admin → abaikan diam-diam (bukan query properti).
    console.log(`[CatalogMode] Perintah toggle dari NON-agent diabaikan (${String(senderPhone).slice(-4)})`);
    return null;
  }
  const ok = await setCatalogMode(agent.user_id, mode);
  if (!ok) {
    return '⚠️ Maaf, gagal menyimpan pengaturan summary. Coba lagi sebentar lagi ya.';
  }
  console.log(`[CatalogMode] ✅ ${agent.user_id} (${agent.name}) → catalog_summary=${mode}`);
  return mode === 'ON'
    ? '✅ Summary + katalog *AKTIF* (catalog_summary=ON).\nSetelah kualifikasi selesai, customer akan menerima ringkasan *plus* daftar rekomendasi katalog.'
    : '✅ Summary tanpa katalog (catalog_summary=OFF).\nSetelah kualifikasi selesai, customer hanya menerima ringkasan — katalog tidak ditampilkan.';
}

module.exports = {
  resolveCatalogMode,
  getCachedCatalogMode,
  setCatalogMode,
  detectCatalogSummaryCommand,
  isSenderTheAgent,
  maybeHandleCatalogCommand,
  envFallbackMode,
};

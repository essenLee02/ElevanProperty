/**
 * agentBusinessRulesService.js
 *
 * Cache in-memory (TTL) untuk trans_type/payment_type/rental_duration/rental_type
 * per agent — kolom `users` yang menentukan APA yang boleh dijawab AI ke customer
 * (lihat utils/agentScopeGuard.js untuk penegakannya, utils/userBusinessRules.js
 * untuk aturan validasi saat agent MENYIMPAN nilai-nilai ini).
 *
 * Pola SAMA PERSIS dengan catalogModeService.js (resolve async yang menghangatkan
 * cache di awal pipeline pesan + pembaca SYNC untuk prompt builder/gate yang tidak
 * bisa await) — sengaja ditiru, bukan digabung, supaya perubahan pada satu cache
 * tidak bisa diam-diam memengaruhi yang lain.
 */

'use strict';

const CACHE_TTL_MS = 60 * 1000; // 1 menit — cukup responsif bila agent ubah profil

// agentUserId → { rules: {...}|null, at: epoch-ms }
const _cache = new Map();

/**
 * Default fail-open: TIDAK ADA batasan. Agent yang belum diketahui/gagal
 * di-load JANGAN membuat AI menolak semua transaksi — itu lebih merugikan
 * daripada tidak menegakkan batas sama sekali (prinsip proyek: gate non-kritis
 * harus fail-open).
 */
function _defaultRules() {
  return {
    transType: null,       // null = tidak diketahui → jangan menegakkan apa pun
    paymentType: null,
    rentalDuration: null,
    rentalType: null,
  };
}

function _fromRow(row) {
  if (!row) return _defaultRules();
  return {
    transType: row.trans_type || null,
    paymentType: row.payment_type || null,
    rentalDuration: row.rental_duration != null ? Number(row.rental_duration) : null,
    rentalType: row.rental_type || null,
  };
}

/**
 * Muat aturan bisnis agent (async, source of truth). Dipanggil di AWAL pipeline
 * pesan (whatsappAIService.generateWhatsAppAIReply) supaya cache-nya hangat
 * sebelum pembaca sync (agentScopeGuard) membutuhkannya di giliran yang sama.
 * @param {string|null} agentUserId
 * @returns {Promise<object>}
 */
async function resolveAgentBusinessRules(agentUserId) {
  if (!agentUserId) return _defaultRules();

  const hit = _cache.get(agentUserId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rules;

  try {
    const User = require('../models/User');
    const row = await User.findOne({
      where: { user_id: agentUserId },
      attributes: ['trans_type', 'payment_type', 'rental_duration', 'rental_type'],
    });
    const rules = _fromRow(row);
    _cache.set(agentUserId, { rules, at: Date.now() });
    return rules;
  } catch (err) {
    console.warn('[AgentBusinessRules] DB read failed — fail-open (tanpa batasan):', err.message);
    return _defaultRules();
  }
}

/**
 * Pembaca SYNC untuk gate yang tidak bisa await (dipanggil di dalam
 * generateWhatsAppAIReply setelah resolveAgentBusinessRules sudah dipanggil
 * di awal fungsi yang sama). Mengandalkan cache yang sudah dihangatkan.
 * @param {string|null} agentUserId
 * @returns {object}
 */
function getCachedAgentBusinessRules(agentUserId) {
  if (!agentUserId) return _defaultRules();
  const hit = _cache.get(agentUserId);
  return (hit && hit.rules) || _defaultRules();
}

/** Hanya untuk tes — hindari kebocoran cache antar-skenario. */
function _clearCache() { _cache.clear(); }

module.exports = {
  resolveAgentBusinessRules,
  getCachedAgentBusinessRules,
  _clearCache,
};

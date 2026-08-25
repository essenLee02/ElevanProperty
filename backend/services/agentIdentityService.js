'use strict';
/**
 * agentIdentityService.js — brand agensi agent sebagai FAKTA untuk prompt (M138)
 *
 * Menjawab satu pertanyaan customer yang lazim dan sebelumnya TIDAK BISA
 * dijawab tanpa menebak: "Kakak dari agensi/developer mana?"
 *
 * Sumbernya `users.developer_property_id` → `developer_properties.name`
 * (Ray White, ERA Property, Xavier Marks, Galaxy Property, Brighton, Propnex,
 * Propmatches).
 *
 * ⛔ POLA SAMA DENGAN agentCoverageService.js: modul ini HANYA menyediakan
 * FAKTA, TIDAK PERNAH menyusun kalimat balasan. Platform AI yang memutuskan
 * cara menjawabnya (M131/M133). Tanpa blok fakta ini, satu-satunya cara LLM
 * menjawab adalah mengarang nama agensi dari nama agent/judul properti —
 * kelas bug M84/M96 yang sudah mahal diperbaiki berkali-kali.
 *
 * ⚠️ ISTILAH: "developer" di sini = BRAND AGENSI/BROKERAGE, BUKAN pengembang
 * perumahan (Ciputra/Sinarmas). Lihat catatan di models/DeveloperProperty.js.
 * Blok prompt di bawah menyatakan perbedaan ini EKSPLISIT supaya LLM tidak
 * memakai nama agensi untuk menjawab "siapa yang membangun perumahan ini?".
 */

const _cache = new Map();   // agentUserId → { value, at }
const CACHE_TTL_MS = Number(process.env.AGENT_IDENTITY_TTL_MS || 5 * 60 * 1000);

function _cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) { _cache.delete(key); return undefined; }
  return hit.value;
}
function _cacheSet(key, value) { _cache.set(key, { value, at: Date.now() }); }

/** Kosongkan cache identitas (dipakai setelah seed/ubah profil agent). */
function clearAgentIdentityCache(agentUserId = null) {
  if (agentUserId) _cache.delete(agentUserId);
  else _cache.clear();
}

/**
 * Nama brand agensi milik agent ini.
 *
 * @param {string} agentUserId users.user_id
 * @returns {Promise<{developerName:string|null}|null>} null = tidak diketahui
 *   (fail-open MUTLAK — identitas adalah pelengkap, tidak boleh memutus balasan)
 */
async function getAgentIdentity(agentUserId) {
  if (!agentUserId) return null;

  const cached = _cacheGet(agentUserId);
  if (cached !== undefined) return cached;

  try {
    const { User, DeveloperProperty } = require('../models');

    const user = await User.findOne({
      where: { user_id: agentUserId },
      attributes: ['developer_property_id'],
      raw: true,
    });
    if (!user || !user.developer_property_id) { _cacheSet(agentUserId, null); return null; }

    const dev = await DeveloperProperty.findOne({
      where: { developer_property_id: user.developer_property_id, status: 1 },
      attributes: ['name'],
      raw: true,
    });
    // Brand yang di-disable/dihapus (status != 1) diperlakukan seperti TIDAK
    // DIKETAHUI — lebih baik AI bilang "tim akan konfirmasi" daripada
    // menyebutkan brand yang sudah tidak dipakai lagi.
    const value = dev?.name ? { developerName: dev.name } : null;
    _cacheSet(agentUserId, value);
    return value;

  } catch (err) {
    console.warn('[AgentIdentity] gagal memuat (fail-open):', err.message);
    return null;
  }
}

/**
 * Render identitas jadi blok FAKTA untuk prompt.
 * Deskriptif, bukan imperatif — LLM yang menyusun kalimatnya.
 *
 * @returns {string} '' bila tidak diketahui (nol token tambahan)
 */
function buildAgentIdentityContext(identity) {
  if (!identity || !identity.developerName) return '';
  return [
    'AGENSI/DEVELOPER AGENT INI:',
    `- Agent ini bernaung di bawah brand: ${identity.developerName}`,
    '- Boleh disebutkan bila customer bertanya "dari agensi/developer mana?".',
    '- ⛔ Ini nama AGENSI/BROKERAGE tempat agent bekerja, BUKAN pengembang yang',
    '  MEMBANGUN perumahan (mis. Ciputra, Sinarmas Land). Bila customer bertanya',
    '  siapa PENGEMBANG perumahannya dan itu tidak ada di data listing, katakan',
    '  tim akan mengonfirmasi — JANGAN memakai nama agensi ini sebagai jawabannya.',
  ].join('\n');
}

module.exports = {
  getAgentIdentity,
  buildAgentIdentityContext,
  clearAgentIdentityCache,
};

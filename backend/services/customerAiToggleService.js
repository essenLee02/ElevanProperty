/**
 * customerAiToggleService.js
 *
 * Perintah AGENT via chat untuk menyalakan/mematikan AI PER-CUSTOMER (by name).
 * Sumber kebenaran: kolom `customers.ai_response` ('ON' = AI membalas, 'OFF' =
 * AI diam / agent takeover). Menggantikan/menemani toggle manual di module Customer.
 *
 * Agent mengetik ke bot-nya, menyebut nama customer:
 *   OFF : "matikan AI untuk Clarence" · "matikan chat AI Clarence" · "AI mati untuk Nia"
 *         "nonaktifkan chat AI untuk Rizal, Kezia dan Lia"
 *   ON  : "nyalakan AI untuk Nia" · "nyalakan AI pada Hendry" · "turn on AI pada Clarence"
 *         "tolong turn on chat AI untuk Siska" · "nyalakan chat dengan AI untuk Rizal, Kezia dan Lia"
 *
 * BISA banyak nama sekaligus (dipisah koma / "dan" / "&" / "serta").
 * Nama dicocokkan (case-insensitive) ke `customers.name` DALAM scope agent
 * (user_id = agent.user_id) — 1 customer bisa beda nama antar agent.
 *
 * Deteksi: detectAiToggleCommand · Eksekusi + konfirmasi: maybeHandleAiToggleCommand.
 * Hanya berlaku bila PENGIRIM adalah agent (isSenderTheAgent) — customer tidak
 * boleh mengubah setelan ini.
 */

'use strict';

const { Op } = require('sequelize');
const { isSenderTheAgent } = require('./catalogModeService');

/* ══════════════════════════════════════════════════════════════════════════════
   DETEKSI PERINTAH
══════════════════════════════════════════════════════════════════════════════ */

// Kata kerja MATIKAN (→ OFF) & NYALAKAN (→ ON), ID + EN, formal + kolokial.
const OFF_VERBS = '(?:matikan|dimatikan|mati|off(?:kan|in)?|nonaktifkan|non-aktifkan|dinonaktifkan|disable(?:d)?|turn(?:ed)?\\s+off|switch(?:ed)?\\s+off|hentikan|stop|tutup|pause|jeda)';
const ON_VERBS  = '(?:nyalakan|dinyalakan|nyala|hidupkan|dihidupkan|aktifkan|diaktifkan|aktif|on(?:kan|in)?|enable(?:d)?|turn(?:ed)?\\s+on|switch(?:ed)?\\s+on|buka|lanjutkan|resume)';

// Objek perintah = AI / chat AI / chat dengan AI / chatbot / bot.
const AI_TOPIC = '(?:chat\\s*(?:dengan\\s+)?ai|ai\\s*chat|chatbot|\\bbot\\b|\\ba\\.?i\\.?\\b|kecerdasan\\s+buatan)';

// Verb sebelum objek ("matikan chat AI"), atau objek sebelum verb ("AI mati").
const _OFF_RE = new RegExp(`\\b${OFF_VERBS}\\b[\\w\\s,'-]{0,20}?${AI_TOPIC}|${AI_TOPIC}[\\w\\s,:=-]{0,20}?\\b${OFF_VERBS}\\b`, 'i');
const _ON_RE  = new RegExp(`\\b${ON_VERBS}\\b[\\w\\s,'-]{0,20}?${AI_TOPIC}|${AI_TOPIC}[\\w\\s,:=-]{0,20}?\\b${ON_VERBS}\\b`, 'i');

// Preposisi/pengantar nama customer ("untuk", "pada", "buat", "for", "to", "ke", "dengan").
const NAME_LEAD = '(?:untuk|pada|buat|kepada|ke|bagi|dengan|for|to|atas\\s+nama|si)';

/**
 * Deteksi mode toggle AI dari teks. Return 'ON' | 'OFF' | null.
 * Menuntut objek AI hadir (AI_TOPIC) + verb yang jelas.
 */
function detectAiToggleCommand(text = '') {
  const t = String(text || '').toLowerCase();
  if (!new RegExp(AI_TOPIC, 'i').test(t)) return null;
  // Nilai eksplisit "ai=off" / "chat ai : on"
  const eq = t.match(new RegExp(`${AI_TOPIC}\\s*[:=]\\s*(on|off)\\b`, 'i'));
  if (eq) return eq[1].toUpperCase();
  const isOff = _OFF_RE.test(t);
  const isOn  = _ON_RE.test(t);
  if (isOff && !isOn) return 'OFF';
  if (isOn && !isOff) return 'ON';
  return null;
}

/**
 * Ekstrak daftar nama customer dari perintah. Prioritas: segmen setelah preposisi
 * ("untuk/pada/buat …") yang datang SETELAH objek AI. Fallback: nama tepat setelah "ai".
 * Pisah pada koma / "dan" / "and" / "&" / "serta" / "/".
 * @param {string} text
 * @returns {string[]} kandidat nama (mentah, sudah dibersihkan)
 */
function extractNames(text = '') {
  const t = String(text || '');

  // Ambil bagian setelah preposisi nama TERAKHIR (agar "dengan AI untuk X" → "X",
  // bukan menangkap kata setelah "dengan").
  let seg = null;
  const prepRe = new RegExp(`\\b${NAME_LEAD}\\b\\s+(.+)$`, 'i');
  const prepAll = [...t.matchAll(new RegExp(`\\b${NAME_LEAD}\\b\\s+`, 'gi'))];
  if (prepAll.length) {
    const last = prepAll[prepAll.length - 1];
    seg = t.slice(last.index + last[0].length);
  } else {
    const m = t.match(prepRe);
    if (m) seg = m[1];
  }
  // Fallback: "…AI Clarence" tanpa preposisi.
  if (!seg) {
    const after = t.match(/\bai\b\s+(.+)$/i);
    if (after) seg = after[1];
  }
  if (!seg) return [];

  // Buang sisa kata perintah di depan segmen (chat, dengan, ai, chatbot, bot, nya).
  seg = seg.replace(/^(?:chat\s+|dengan\s+|ai\s+|chatbot\s+|bot\s+|nya\s+|:\s*|nomor\s+|no\s+)+/i, '');

  return seg
    .split(/\s*(?:,|;|\bdan\b|\band\b|&|\bserta\b|\/|\+)\s*/i)
    .map(s =>
      s.replace(/[.!?]+$/g, '')                 // buang tanda baca akhir
       .replace(/[^\p{L}\s'.-]/gu, '')          // sisakan huruf, spasi, apostrof, titik, hyphen
       .replace(/\s{2,}/g, ' ')
       .trim()
    )
    // Buang token filler yang jelas bukan nama.
    .filter(s => s.length >= 2 && s.length <= 40)
    .filter(s => !/^(?:ya|dong|kak|deh|aja|saja|semua|semuanya|itu|ini|tolong|mohon|sekarang|please|thanks?|makasih)$/i.test(s));
}

/* ══════════════════════════════════════════════════════════════════════════════
   EKSEKUSI
══════════════════════════════════════════════════════════════════════════════ */

function _todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Cocokkan kandidat nama ke customers milik agent (case-insensitive).
 * Cocok bila: nama sama persis, ATAU kata-pertama nama = kandidat (mis. DB "Rizal
 * Pratama", agent tulis "Rizal"), ATAU nama diawali kandidat.
 * @returns {{ matched: object[], notFound: string[] }}
 */
function _matchCustomers(candidates, customers) {
  const matched = new Map();     // customer_id → row (dedupe)
  const notFound = [];
  for (const cand of candidates) {
    const cl = cand.toLowerCase();
    const hits = customers.filter(c => {
      const nm = String(c.name || '').toLowerCase().trim();
      if (!nm) return false;
      return nm === cl || nm.split(/\s+/)[0] === cl || nm.startsWith(cl + ' ');
    });
    if (hits.length) hits.forEach(h => matched.set(h.customer_id, h));
    else notFound.push(cand);
  }
  return { matched: [...matched.values()], notFound };
}

/**
 * Update ai_response untuk daftar customer milik agent.
 * @param {string} agentUserId
 * @param {'ON'|'OFF'} mode
 * @param {string[]} candidateNames
 * @returns {Promise<{ updated: string[], notFound: string[], noChange: string[] }>}
 */
async function setAiResponseByNames(agentUserId, mode, candidateNames) {
  const { Customer } = require('../models');
  const customers = await Customer.findAll({
    where: { user_id: String(agentUserId).toUpperCase(), status: { [Op.ne]: 3 } },
    attributes: ['customer_id', 'name', 'ai_response'],
  });

  const { matched, notFound } = _matchCustomers(candidateNames, customers);
  const toUpdate = matched.filter(c => String(c.ai_response || 'ON').toUpperCase() !== mode);
  const noChange = matched.filter(c => String(c.ai_response || 'ON').toUpperCase() === mode);

  if (toUpdate.length) {
    await Customer.update(
      { ai_response: mode, updated_date: _todayDate(), updated_by: String(agentUserId).toUpperCase() },
      { where: { customer_id: { [Op.in]: toUpdate.map(c => c.customer_id) } } }
    );
  }
  return {
    updated : toUpdate.map(c => c.name),
    notFound,
    noChange: noChange.map(c => c.name),
  };
}

/**
 * Handler lengkap untuk chat controllers. Bila pesan adalah perintah toggle AI
 * DARI agent → update customers.ai_response + kembalikan teks konfirmasi.
 * Selain itu → null (lanjut alur normal).
 *
 * @param {object} p
 * @param {string} p.message     - isi pesan masuk
 * @param {string} p.senderPhone - nomor pengirim
 * @param {object} p.agent       - row users agent (butuh .user_id, .phone)
 * @returns {Promise<string|null>}
 */
async function maybeHandleAiToggleCommand({ message, senderPhone, agent }) {
  const mode = detectAiToggleCommand(message);
  if (!mode) return null;
  // Hanya agent pemilik yang boleh — customer yang menulis frasa serupa diabaikan.
  if (!isSenderTheAgent(senderPhone, agent)) {
    console.log(`[CustomerAIToggle] Perintah dari NON-agent diabaikan (${String(senderPhone).slice(-4)})`);
    return null;
  }

  const names = extractNames(message);
  const verbWord = mode === 'ON' ? 'dinyalakan' : 'dimatikan';

  if (!names.length) {
    return `Sebutkan nama customer-nya ya, Kak 🙂 Contoh: *${mode === 'ON' ? 'nyalakan' : 'matikan'} AI untuk Clarence* (boleh beberapa: *…untuk Rizal, Kezia dan Lia*).`;
  }

  try {
    const { updated, notFound, noChange } = await setAiResponseByNames(agent.user_id, mode, names);

    if (!updated.length && !noChange.length) {
      return `⚠️ Customer *${notFound.join(', ')}* belum terdaftar di daftar Anda, jadi belum bisa saya set. Pastikan namanya sudah ada di module Customer ya.`;
    }

    const lines = [];
    if (updated.length)  lines.push(`✅ AI *${verbWord}* untuk: *${updated.join(', ')}*`);
    if (noChange.length) lines.push(`ℹ️ Sudah ${mode} sebelumnya: ${noChange.join(', ')}`);
    if (notFound.length) lines.push(`⚠️ Tidak ditemukan: ${notFound.join(', ')}`);
    if (mode === 'OFF' && updated.length) lines.push('AI tidak akan membalas chat mereka sampai dinyalakan kembali.');
    if (mode === 'ON'  && updated.length) lines.push('AI kembali membalas chat mereka secara otomatis.');

    console.log(`[CustomerAIToggle] ✅ ${agent.user_id} → ai_response=${mode} | updated=[${updated.join(',')}] notFound=[${notFound.join(',')}]`);
    return lines.join('\n');
  } catch (err) {
    console.error('[CustomerAIToggle] update failed:', err.message);
    return '⚠️ Maaf, gagal menyimpan pengaturan AI. Coba lagi sebentar lagi ya.';
  }
}

module.exports = {
  detectAiToggleCommand,
  extractNames,
  setAiResponseByNames,
  maybeHandleAiToggleCommand,
};

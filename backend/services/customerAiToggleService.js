/**
 * customerAiToggleService.js
 *
 * Perintah AGENT via chat untuk menyalakan/mematikan AI PER-CUSTOMER.
 * Sumber kebenaran: kolom `customers.ai_response` ('ON' = AI membalas, 'OFF' =
 * AI diam / agent takeover). Menemani toggle manual di module Customer Master.
 *
 * ⚠️ IDENTIFIKASI CUSTOMER = NOMOR WHATSAPP SAJA (bukan nama).
 * Nama TIDAK dipakai karena ambigu: satu agent bisa punya beberapa customer dengan
 * nama sama/mirip, dan nama default WhatsApp bisa berubah sewaktu-waktu — salah
 * target berarti AI mati untuk customer yang keliru. Nomor WA unik & stabil
 * (UNIQUE (user_id, phone)), jadi hanya nomor yang diterima.
 *
 * Agent mengetik ke bot-nya, menyebut NOMOR:
 *   OFF : "matikan AI untuk 628123456789" · "matikan chat AI 0812-3456-789"
 *         "nonaktifkan chat AI untuk 628111, 628222 dan 628333"
 *   ON  : "nyalakan AI untuk 0812345678" · "turn on chat AI untuk +62 812 3456 789"
 *
 * BISA banyak nomor sekaligus (dipisah koma / "dan" / "&" / spasi).
 * Nomor dinormalisasi ke 62xxx lalu dicocokkan ke `customers.phone` DALAM scope
 * agent (user_id = agent.user_id).
 *
 * Deteksi: detectAiToggleCommand · Eksekusi + konfirmasi: maybeHandleAiToggleCommand.
 * Hanya berlaku bila PENGIRIM adalah agent (isSenderTheAgent).
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

/* ══════════════════════════════════════════════════════════════════════════════
   EKSTRAKSI NOMOR WHATSAPP
══════════════════════════════════════════════════════════════════════════════ */

/** Normalisasi nomor ke digit 62xxx (samakan dgn registrasi & module Customer). */
function normPhone(p) {
  let s = String(p || '').replace(/\D/g, '');
  if (!s) return '';
  if (s.startsWith('0'))      s = '62' + s.slice(1);
  else if (s.startsWith('8')) s = '62' + s;      // "81234…" ditulis tanpa 0/62
  return s;
}

// Nomor Indonesia: diawali +62 / 62 / 0 / 8, boleh diselingi spasi, titik, dash,
// kurung. Minimal 9 digit total setelah normalisasi.
const PHONE_RE = /(?:\+?62|0|8)[\s.\-()]*\d(?:[\s.\-()]*\d){6,14}/g;

/**
 * Ambil semua nomor WhatsApp dari perintah agent (ternormalisasi 62xxx, unik).
 * Contoh: "matikan AI untuk 628123456789, 0812-3456-789 dan +62 813 999 111"
 *   → ['628123456789', '628123456789'…] (duplikat dibuang)
 * @param {string} text
 * @returns {string[]}
 */
function extractPhones(text = '') {
  const out = [];
  const matches = String(text || '').match(PHONE_RE) || [];
  for (const m of matches) {
    const norm = normPhone(m);
    // 62 + 9..13 digit → total 11..15. Tolak yang terlalu pendek/panjang.
    if (norm.startsWith('62') && norm.length >= 10 && norm.length <= 15 && !out.includes(norm)) {
      out.push(norm);
    }
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════════
   EKSEKUSI
══════════════════════════════════════════════════════════════════════════════ */

function _todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Update ai_response untuk daftar NOMOR customer milik agent.
 * @param {string} agentUserId
 * @param {'ON'|'OFF'} mode
 * @param {string[]} phones - sudah ternormalisasi (62xxx)
 * @returns {Promise<{updated:object[], notFound:string[], noChange:object[]}>}
 */
async function setAiResponseByPhones(agentUserId, mode, phones) {
  const { Customer } = require('../models');
  const rows = await Customer.findAll({
    where: {
      user_id: String(agentUserId).toUpperCase(),
      phone:   { [Op.in]: phones },
      status:  { [Op.ne]: 3 },
    },
    attributes: ['customer_id', 'name', 'phone', 'ai_response'],
  });

  const foundPhones = new Set(rows.map(r => r.phone));
  const notFound    = phones.filter(p => !foundPhones.has(p));
  const toUpdate    = rows.filter(r => String(r.ai_response || 'ON').toUpperCase() !== mode);
  const noChange    = rows.filter(r => String(r.ai_response || 'ON').toUpperCase() === mode);

  if (toUpdate.length) {
    await Customer.update(
      { ai_response: mode, updated_date: _todayDate(), updated_by: String(agentUserId).toUpperCase() },
      { where: { customer_id: { [Op.in]: toUpdate.map(c => c.customer_id) } } }
    );
  }
  return {
    updated : toUpdate.map(c => ({ name: c.name, phone: c.phone })),
    notFound,
    noChange: noChange.map(c => ({ name: c.name, phone: c.phone })),
  };
}

/** Format "Nama (62812…)" untuk baris konfirmasi. */
function _label(c) {
  return c.name ? `${c.name} (${c.phone})` : c.phone;
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

  const phones   = extractPhones(message);
  const verbWord = mode === 'ON' ? 'dinyalakan' : 'dimatikan';
  const verbCmd  = mode === 'ON' ? 'nyalakan'   : 'matikan';

  // WAJIB nomor — nama tidak diterima (ambigu, bisa salah target).
  if (!phones.length) {
    return `Mohon sebutkan *nomor WhatsApp* customer-nya ya, Kak 🙂\n` +
           `Contoh: *${verbCmd} AI untuk 628123456789*\n` +
           `Boleh beberapa sekaligus: *${verbCmd} AI untuk 628111111111, 628222222222 dan 628333333333*\n\n` +
           `_Catatan: identifikasi memakai nomor WA (bukan nama) supaya tidak salah target._`;
  }

  try {
    const { updated, notFound, noChange } = await setAiResponseByPhones(agent.user_id, mode, phones);

    if (!updated.length && !noChange.length) {
      return `⚠️ Nomor *${notFound.join(', ')}* belum terdaftar sebagai customer Anda, jadi belum bisa di-set.\n` +
             `Pastikan customer tsb sudah pernah chat / terdaftar di module Customer ya.`;
    }

    const lines = [];
    if (updated.length)  lines.push(`✅ AI *${verbWord}* untuk: *${updated.map(_label).join(', ')}*`);
    if (noChange.length) lines.push(`ℹ️ Sudah ${mode} sebelumnya: ${noChange.map(_label).join(', ')}`);
    if (notFound.length) lines.push(`⚠️ Nomor tidak terdaftar: ${notFound.join(', ')}`);
    if (mode === 'OFF' && updated.length) lines.push('AI tidak akan membalas chat mereka sampai dinyalakan kembali.');
    if (mode === 'ON'  && updated.length) lines.push('AI kembali membalas chat mereka secara otomatis.');

    console.log(`[CustomerAIToggle] ✅ ${agent.user_id} → ai_response=${mode} | updated=[${updated.map(u => u.phone).join(',')}] notFound=[${notFound.join(',')}]`);
    return lines.join('\n');
  } catch (err) {
    console.error('[CustomerAIToggle] update failed:', err.message);
    return '⚠️ Maaf, gagal menyimpan pengaturan AI. Coba lagi sebentar lagi ya.';
  }
}

module.exports = {
  detectAiToggleCommand,
  extractPhones,
  normPhone,
  setAiResponseByPhones,
  maybeHandleAiToggleCommand,
};

/**
 * replyIdentityGuard.js — jaring pengaman DETERMINISTIK untuk tanda tangan brief.
 *
 * MASALAH NYATA (M85, transkrip ChatGPT 6 Agu 2026): summary terkirim ke customer
 * dengan isi harfiah
 *
 *     Salam hangat,
 *     [Nama Agen]
 *     [Nama Aplikasi]
 *
 * Nama agent dan nama aplikasi SUDAH di-resolve server-side dan SUDAH tertulis
 * apa adanya di template brief dalam prompt. Model tetap menulis placeholder
 * karena SELURUH template brief memakai notasi kurung siku (`✓ Kota: *[nilai
 * dari Q2]*`) — untuk baris tanda tangan model ikut memakai bentuk yang sama,
 * lalu menerjemahkannya ke Bahasa Indonesia. Kejadian sebelumnya (4 Agu) versi
 * `${agentName}` / `${appName}`; kelas bug yang sama, notasi berbeda.
 *
 * KENAPA KODE, BUKAN ATURAN PROMPT: prompt WhatsApp sudah ±53–56K token dan
 * setiap aturan baru menurunkan kepatuhan model secara global (M62). Aturan
 * larangannya SUDAH ada di prompt dan di skill docs, dan tetap dilanggar. Satu
 * substitusi di sisi kirim menutup kelas bug ini tanpa menambah satu token pun.
 *
 * ⚠️ Sengaja HANYA mengganti placeholder identitas. Kalau nama asli tidak
 * tersedia, teks dibiarkan apa adanya — menebak nama agent lebih berbahaya
 * daripada placeholder yang kelihatan jelas salah.
 */

'use strict';

/**
 * Pola placeholder identitas yang pernah/berpotensi bocor ke customer.
 * Sengaja spesifik: JANGAN pakai pola `\[[^\]]+\]` umum, karena customer bisa
 * saja menerima teks berkurung siku yang sah (mis. judul listing).
 */
const AGENT_PLACEHOLDER_RE = new RegExp(
  [
    '\\$\\{\\s*agentName\\s*\\}',
    '\\[\\s*(?:nama\\s+agen(?:t)?|agent\\s+name)\\s*\\]',
    '<\\s*(?:nama\\s+agen(?:t)?|agent\\s+name)\\s*>',
  ].join('|'),
  'gi'
);

const APP_PLACEHOLDER_RE = new RegExp(
  [
    '\\$\\{\\s*appName\\s*\\}',
    '\\[\\s*(?:nama\\s+aplikasi|nama\\s+perusahaan|app\\s+name|company\\s+name)\\s*\\]',
    '<\\s*(?:nama\\s+aplikasi|app\\s+name)\\s*>',
  ].join('|'),
  'gi'
);

/**
 * Ganti placeholder identitas yang tersisa dengan nama sungguhan.
 *
 * @param {string} reply         teks balasan dari provider AI
 * @param {object} identity      { agentName, appName } — sudah di-resolve
 * @returns {{ text: string, replaced: number }} teks bersih + jumlah substitusi
 *          (jumlah > 0 berarti model melanggar aturan — layak di-log).
 */
function guardReplyIdentity(reply, identity = {}) {
  const text = String(reply || '');
  if (!text) return { text, replaced: 0 };

  const agentName = String(identity.agentName || '').trim();
  const appName   = String(identity.appName   || '').trim();

  let replaced = 0;
  let out = text;

  if (agentName) {
    out = out.replace(AGENT_PLACEHOLDER_RE, () => { replaced++; return agentName; });
  }
  if (appName) {
    out = out.replace(APP_PLACEHOLDER_RE, () => { replaced++; return appName; });
  }

  return { text: out, replaced };
}

module.exports = { guardReplyIdentity, AGENT_PLACEHOLDER_RE, APP_PLACEHOLDER_RE };

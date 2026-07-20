/**
 * customerRegistrationService.js
 *
 * Registrasi OTOMATIS customer ke tabel `customers` dari alur chat WhatsApp.
 *
 * Kapan: saat AI mengirim SUMMARY ke customer (akhir kualifikasi Q1-Q12).
 * Idempoten: dikenali via UNIQUE (user_id, phone) — kunjungan/summary berikutnya
 * TIDAK insert baris baru; hanya melengkapi name/email bila baru diketahui.
 *
 * Default insert: status=1, ai_response='ON', created_date=today,
 * created_by = users.user_id agent (AI mendaftarkan atas nama agent-nya).
 *
 * Sumber data:
 *   phone — selalu ada (nomor WA pengirim).
 *   name  — (a) perkenalan customer di chat ("Hi saya Rina...", "Perkenalkan, saya
 *           Rizal", "Nama saya Kezia") — extractCustomerName();
 *           (b) jawaban atas pertanyaan nama dari AI sebelum summary;
 *           (c) fallback: nama profil WhatsApp (pushname).
 *   email — extractCustomerEmail() dari pesan mana pun (AI menanyakannya saat
 *           menjadwalkan viewing); dilengkapi lewat update bila datang belakangan.
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════════
   EKSTRAKSI NAMA — dari kalimat perkenalan customer
══════════════════════════════════════════════════════════════════════════════ */

// Kata yang TIDAK mungkin nama orang (sering mengikuti "saya ..." dalam kalimat
// non-perkenalan: "saya mau", "saya cari", "saya bisa sorean", dll).
const _NON_NAME_WORDS = new Set([
  'mau', 'ingin', 'pengen', 'butuh', 'perlu', 'cari', 'nyari', 'mencari', 'lagi',
  'sedang', 'akan', 'sudah', 'belum', 'bisa', 'boleh', 'minta', 'tanya', 'nanya',
  'suka', 'tinggal', 'beli', 'sewa', 'jual', 'booking', 'ok', 'oke', 'setuju',
  'tertarik', 'berminat', 'punya', 'ada', 'dari', 'orang', 'asli', 'kurang',
  'tidak', 'gak', 'ga', 'nggak', 'enggak', 'siap', 'baru', 'masih', 'cuma',
  'hanya', 'juga', 'kemungkinan', 'rencana', 'berencana', 'prefer', 'pilih',
  'kerja', 'kuliah', 'sekolah', 'menikah', 'pindah', 'pindahan', 'sendirian',
  'sendiri', 'bersama', 'sekeluarga', 'the', 'a', 'an', 'am', 'is', 'was',
  'want', 'need', 'looking', 'searching', 'interested', 'planning',
]);

/**
 * Ambil nama customer dari kalimat perkenalan. Pola yang dikenali:
 *   "Hi saya Rina, ..."                → Rina
 *   "Perkenalkan, saya Rizal. ..."     → Rizal
 *   "Nama saya Kezia. ..."             → Kezia
 *   "saya Budi Santoso, mau cari..."   → Budi Santoso
 *   "panggil saja saya Andi"           → Andi
 *   "I'm Kevin / my name is Kevin"     → Kevin
 * Nama = 1-3 kata berawalan huruf, berhenti di tanda baca / kata kerja niat.
 * @param {string} text - satu pesan ATAU gabungan pesan customer
 * @returns {string|null}
 */
function extractCustomerName(text = '') {
  const t = String(text || '');

  const PATTERNS = [
    // "nama saya Kezia" / "nama aku Dina" / "namaku Dina"
    /\bnama\s*(?:saya|aku|ku)\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})/i,
    /\bnamaku\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})/i,
    // "perkenalkan(,) saya Rizal" / "kenalkan saya Rizal"
    /\b(?:perkenalkan|kenalkan|perkenalan)\b[,\s]*(?:nama\s+)?(?:saya|aku)\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})/i,
    // "panggil (saja) saya Andi" / "panggil aja Andi"
    /\bpanggil\s+(?:saja\s+|aja\s+)?(?:saya\s+|aku\s+)?([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})/i,
    // English: "my name is Kevin" / "I'm Kevin" / "I am Kevin"
    /\bmy\s+name\s+is\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})/i,
    /\bI\s*(?:'m|am)\s+([A-Z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]*){0,2})\b/,
    // "(Hi/Halo) saya Rina" — paling umum TAPI paling rawan ("saya mau...").
    // Wajib diakhiri koma/titik ATAU kata berikutnya BUKAN kata kerja niat.
    /\b(?:hi|hai|halo+|hello|hey|pagi|siang|sore|malam)\b[.,!\s]*(?:saya|aku)\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})/i,
    /\b(?:saya|aku)\s+([A-Z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]*){0,2})\s*[,.]/,
  ];

  for (const re of PATTERNS) {
    const m = t.match(re);
    if (!m) continue;
    // Bersihkan trailing filler & potong di kata non-nama pertama
    const words = m[1].trim().replace(/[.,!?]+$/, '').split(/\s+/);
    const kept = [];
    for (const w of words) {
      if (_NON_NAME_WORDS.has(w.toLowerCase())) break;
      kept.push(w);
      if (kept.length >= 3) break;
    }
    if (!kept.length) continue;
    const name = kept.join(' ').trim();
    if (name.length < 2 || name.length > 60) continue;
    // Kapital awal tiap kata (rina → Rina)
    return name.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

/** Ekstrak alamat email pertama yang valid dari teks (jawaban atas pertanyaan AI). */
function extractCustomerEmail(text = '') {
  const m = String(text || '').match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  return m ? m[0].toLowerCase() : null;
}

/**
 * Scan SELURUH pesan customer (kronologis) untuk nama & email — nilai TERAKHIR
 * menang (customer bisa meralat). Return { name, email } (masing-masing nullable).
 * @param {Array<{role:string,message:string}>} history
 * @param {string} currentMessage
 */
// Pertanyaan NAMA dari AI (gate pra-summary) — dipakai juga utk Q&A-aware capture.
const AI_ASKED_NAME_RE  = /boleh\s+(?:saya\s+)?tahu\s+nama|dengan\s+(?:kakak|bapak|ibu|siapa)\s*(?:siapa)?|atas\s+nama\s+siapa|may\s+i\s+know\s+your\s+name|nama\s+kakak\s+siapa/i;
// Pertanyaan EMAIL dari AI (saat penjadwalan viewing).
const AI_ASKED_EMAIL_RE = /boleh\s+(?:minta|tahu)\s+(?:alamat\s+)?email|email\s+(?:kakak|anda|nya)?\s*(?:berapa|apa)|your\s+email/i;

function extractIdentityFromChat(history = [], currentMessage = '') {
  const seq = [
    ...(history || []),
    { role: 'customer', message: currentMessage || '' },
  ];
  let name = null, email = null;
  let prevAiAskedName = false;
  for (const m of seq) {
    const msg = m.message || '';
    if (m.role === 'ai' || m.role === 'assistant') {
      prevAiAskedName = AI_ASKED_NAME_RE.test(msg);
      continue;
    }
    if (!(m.role === 'user' || m.role === 'customer')) continue;
    // (a) Perkenalan eksplisit ("nama saya Kezia") — di pesan mana pun.
    const n = extractCustomerName(msg);
    if (n) name = n;
    // (b) Q&A-aware: AI baru saja tanya nama → jawaban PENDEK huruf-saja = nama
    //     ("Rina", "Budi Santoso") walau tanpa frasa "nama saya".
    else if (prevAiAskedName) {
      const bare = msg.trim().replace(/^(?:nama\s*(?:saya|ku)?\s*[:=]?\s*)/i, '').replace(/[.,!?]+$/, '');
      if (/^[A-Za-z][A-Za-z'.\s-]{1,40}$/.test(bare) && bare.split(/\s+/).length <= 4) {
        const words = bare.split(/\s+/);
        // SEMUA kata harus lolos — penolakan/filler ("gak usah ya", "nanti aja",
        // "lewati") BUKAN nama. Satu kata mencurigakan → tolak seluruh jawaban.
        const REFUSAL = /^(gak|ga|nggak|enggak|tidak|tdk|usah|nanti|lewati|skip|no|belum|jangan|males|maaf|rahasia|privasi|ya|aja|saja|dulu|kak|dong|deh)$/i;
        const allNamey = words.every(w => !_NON_NAME_WORDS.has(w.toLowerCase()) && !REFUSAL.test(w));
        if (allNamey) name = words.slice(0, 3).join(' ').replace(/\b\w/g, c => c.toUpperCase());
      }
    }
    const e = extractCustomerEmail(msg);
    if (e) email = e;
    prevAiAskedName = false;
  }
  return { name, email };
}

/** Sudahkah AI menanyakan nama / email di percakapan ini? (guard tanya-sekali) */
function aiAlreadyAskedName(history = [])  {
  return (history || []).some(m => (m.role === 'ai' || m.role === 'assistant') && AI_ASKED_NAME_RE.test(m.message || ''));
}
function aiAlreadyAskedEmail(history = []) {
  return (history || []).some(m => (m.role === 'ai' || m.role === 'assistant') && AI_ASKED_EMAIL_RE.test(m.message || ''));
}

/* ══════════════════════════════════════════════════════════════════════════════
   REGISTRASI — idempoten via (user_id, phone)
══════════════════════════════════════════════════════════════════════════════ */

/** Generated customer_id: prefix nama (2 huruf) + 5 alphanumeric + count 3 digit. */
function _generateCustomerId(name, total) {
  const prefix = String(name || 'CU').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase().padEnd(2, 'X');
  const rand = Array.from({ length: 5 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
  ).join('');
  return `${prefix}${rand}${String((total || 0) + 1).padStart(3, '0')}`.toUpperCase();
}

function _todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Normalisasi nomor telepon ke digit (62xxx). */
function _normPhone(p) {
  let s = String(p || '').replace(/\D/g, '');
  if (s.startsWith('0')) s = '62' + s.slice(1);
  return s;
}

/**
 * Daftarkan customer dari alur chat (dipanggil saat AI kirim SUMMARY).
 * Idempoten: (user_id, phone) sudah ada → TIDAK insert; hanya lengkapi name
 * (bila baris lama masih pakai pushname & kini ada nama perkenalan) dan email
 * (bila baru diberikan). Selain itu tidak menyentuh apa pun.
 *
 * @param {object} p
 * @param {string} p.agentUserId  - users.user_id agent (→ user_id & created_by)
 * @param {string} p.phone        - nomor WA customer
 * @param {string|null} p.chatName - nama hasil ekstraksi perkenalan chat (prioritas)
 * @param {string|null} p.waName   - nama profil WhatsApp (fallback)
 * @param {string|null} p.email    - email hasil ekstraksi (nullable)
 * @returns {Promise<{action:'inserted'|'updated'|'exists'|'skipped', customer?:object}>}
 */
async function registerCustomerFromChat({ agentUserId, phone, chatName = null, waName = null, email = null }) {
  if (!agentUserId || !phone) return { action: 'skipped' };
  const { Customer } = require('../models');

  const normPhone = _normPhone(phone);
  if (normPhone.length < 8) return { action: 'skipped' };

  try {
    const existing = await Customer.findOne({ where: { user_id: agentUserId, phone: normPhone } });

    if (existing) {
      // Sudah terdaftar → dikenali, TIDAK insert ulang. Lengkapi data baru saja.
      const patch = {};
      // Nama perkenalan chat menggantikan fallback pushname lama (lebih akurat).
      if (chatName && existing.name !== chatName) patch.name = chatName;
      if (email && !existing.email) patch.email = email;
      if (Object.keys(patch).length) {
        patch.updated_date = _todayDate();
        patch.updated_by = agentUserId;
        await existing.update(patch);
        console.log(`[CustomerReg] ✏️  UPDATE ${existing.customer_id} (${normPhone.slice(-4)}):`, Object.keys(patch).join(','));
        return { action: 'updated', customer: existing };
      }
      return { action: 'exists', customer: existing };
    }

    // Belum ada → INSERT dengan default sesuai spesifikasi.
    const name = chatName || waName || `Customer ${normPhone.slice(-4)}`;
    const total = await Customer.count();
    const customer = await Customer.create({
      user_id:      agentUserId,
      customer_id:  _generateCustomerId(name, total),
      name,
      phone:        normPhone,
      email:        email || null,
      ai_response:  'ON',
      status:       1,
      created_date: _todayDate(),
      created_by:   agentUserId,
      updated_date: null,
      updated_by:   null,
    });
    console.log(`[CustomerReg] ✅ INSERT ${customer.customer_id} | "${name}" | agent ${agentUserId}`);
    return { action: 'inserted', customer };
  } catch (err) {
    // Race dua summary bersamaan → unique constraint; anggap sudah terdaftar.
    if (/unique/i.test(err.message)) return { action: 'exists' };
    console.error('[CustomerReg] ERROR:', err.message);
    return { action: 'skipped' };
  }
}

/** Balasan AI berisi SUMMARY brief? (marker baris "✓ Rencana:") */
function replyContainsSummary(reply = '') {
  return /[✓✔]\s*Rencana\s*:/i.test(String(reply || ''));
}

/**
 * Hook satu-panggilan untuk chat controllers (Kirimi/Fonnte/TimelinesAI):
 * bila balasan AI yang baru dikirim adalah SUMMARY → daftarkan customer.
 * Non-fatal & fire-safe: error apa pun hanya di-log, alur chat tidak terganggu.
 *
 * @param {object} p
 * @param {string} p.reply        - teks balasan AI (deteksi marker summary)
 * @param {number} p.sessionId    - ChatSession.id (ambil history utk ekstraksi identitas)
 * @param {string} p.currentMessage - pesan customer terakhir
 * @param {string} p.agentUserId  - users.user_id agent
 * @param {string} p.phone        - nomor WA customer (sender)
 * @param {string|null} p.waName  - nama profil WhatsApp (fallback nama)
 */
async function maybeRegisterOnSummary({ reply, sessionId, currentMessage, agentUserId, phone, waName = null }) {
  try {
    if (!replyContainsSummary(reply)) return { action: 'skipped' };
    let history = [];
    try {
      const { getConversationHistory } = require('./sessionService');
      history = await getConversationHistory(sessionId, 24);
    } catch (_) { /* tanpa history pun tetap bisa daftar via pushname */ }
    const { name: chatName, email } = extractIdentityFromChat(history, currentMessage);
    return await registerCustomerFromChat({ agentUserId, phone, chatName, waName, email });
  } catch (err) {
    console.warn('[CustomerReg] maybeRegisterOnSummary failed (non-fatal):', err.message);
    return { action: 'skipped' };
  }
}

module.exports = {
  extractCustomerName,
  extractCustomerEmail,
  extractIdentityFromChat,
  aiAlreadyAskedName,
  aiAlreadyAskedEmail,
  registerCustomerFromChat,
  replyContainsSummary,
  maybeRegisterOnSummary,
};

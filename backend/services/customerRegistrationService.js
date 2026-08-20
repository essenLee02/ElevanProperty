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

/**
 * Pesan AI TERAKHIR dari giliran SEBELUM giliran ini — bukan balasan yang baru
 * saja dibuat untuk `currentMessage` yang sedang diproses.
 *
 * ⚠️ Dipanggil SETELAH pesan customer & balasan AI giliran ini SUDAH tersimpan
 * ke DB (pola hook `syncCustomerFromChat`, lihat di bawah), jadi `history` yang
 * di-fetch ulang dari DB ikut membawa DUA entri milik giliran ini di ekornya:
 * [..., customerMsg(giliran ini), aiReply(giliran ini)]. Tanpa membuang dulu
 * ekor itu, pengecekan "apakah AI baru saja menanyakan nama" akan salah
 * menguji balasan AI yang BARU DIBUAT (respons UNTUK currentMessage) — bukan
 * pertanyaan yang currentMessage seharusnya sedang MENJAWAB.
 *
 * @param {Array<{role:string,message:string}>} history
 * @param {string} currentMessage - pesan customer giliran ini
 * @param {string} currentReply   - balasan AI giliran ini (baru dibuat, sudah tersimpan)
 * @returns {string} pesan AI dari giliran sebelumnya, atau '' bila tidak ada
 */
function _lastAiMessageBeforeCurrentTurn(history = [], currentMessage = '', currentReply = '') {
  const h = [...(history || [])];
  while (h.length) {
    const last = h[h.length - 1];
    const isThisTurnAi       = (last.role === 'ai' || last.role === 'assistant') && last.message === currentReply;
    const isThisTurnCustomer = (last.role === 'customer' || last.role === 'user') && last.message === currentMessage;
    if (isThisTurnAi || isThisTurnCustomer) { h.pop(); continue; }
    break;
  }
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i].role === 'ai' || h[i].role === 'assistant') return h[i].message || '';
  }
  return '';
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
 * @param {boolean} p.nameQuestionResolved - true bila giliran ini adalah jawaban
 *   (atau PENOLAKAN) atas pertanyaan nama yang AI ajukan giliran sebelumnya →
 *   ask_name wajib menjadi 'YES' walau chatName tetap null (customer menolak).
 * @returns {Promise<{action:'inserted'|'updated'|'exists'|'skipped', customer?:object}>}
 */
async function registerCustomerFromChat({ agentUserId, phone, chatName = null, waName = null, email = null, nameQuestionResolved = false }) {
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
      // Pertanyaan nama terjawab (nama ATAU penolakan) → jangan tanya lagi.
      if ((chatName || nameQuestionResolved) && String(existing.ask_name || 'NO').toUpperCase() !== 'YES') {
        patch.ask_name = 'YES';
      }
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
      // Nama sudah diketahui saat pendaftaran pertama (customer memperkenalkan
      // diri sebelum sempat ditanya) → tidak perlu ditanya lagi. Selain itu
      // (masih pakai nama default WA) → AI WAJIB menanyakan nama nanti.
      ask_name:     chatName ? 'YES' : 'NO',
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

/**
 * Status identitas customer terhadap agent ini — dipakai untuk memutuskan apakah
 * AI BOLEH menanyakan nama / email.
 *
 * Aturan bisnis: pertanyaan nama & email HANYA untuk customer BARU (belum pernah
 * menyelesaikan percakapan dengan agent ini). Customer lama tidak ditanya lagi —
 * datanya sudah ada, bertanya ulang terasa tidak personal & menambah panjang chat.
 *
 * Karena registrasi kini terjadi AWAL (setelah Q1+Q2, memakai nama default
 * WhatsApp), keberadaan baris customer TIDAK bisa dipakai sebagai penanda "lama".
 * Penanda yang dipakai: apakah kita PERNAH belajar identitas asli —
 *   hasRealName : nama tersimpan bukan nama default WA / bukan placeholder
 *   hasEmail    : email sudah terisi
 *   isReturning : salah satu di atas true → customer lama → jangan tanya lagi
 *
 * @param {object} p
 * @param {string} p.agentUserId
 * @param {string} p.phone
 * @param {string|null} p.waName - nama profil WhatsApp (pembanding placeholder)
 * @returns {Promise<{exists:boolean,hasRealName:boolean,hasEmail:boolean,isReturning:boolean,name:string|null}>}
 */
async function getIdentityStatus({ agentUserId, phone, waName = null }) {
  const EMPTY = { exists: false, hasRealName: false, hasEmail: false, isReturning: false, name: null, email: null, askName: null };
  if (!agentUserId || !phone) return EMPTY;
  try {
    const { Customer } = require('../models');
    const normPhone = _normPhone(phone);
    if (normPhone.length < 8) return EMPTY;
    const row = await Customer.findOne({
      where: { user_id: String(agentUserId).toUpperCase(), phone: normPhone },
      attributes: ['name', 'email', 'status', 'ask_name'],
    });
    if (!row || row.status === 3) return EMPTY;

    const nm = String(row.name || '').trim();
    const wa = String(waName || '').trim();
    const isPlaceholder = !nm
      || (wa && nm.toLowerCase() === wa.toLowerCase())   // masih nama default WhatsApp
      || /^customer\s+\d{3,4}$/i.test(nm);               // fallback "Customer 1234"
    const hasRealName = !isPlaceholder;
    const hasEmail    = !!row.email;
    return {
      exists: true, hasRealName, hasEmail, isReturning: hasRealName || hasEmail,
      name: nm || null,
      // Actual email string (not just the hasEmail flag) — needed by the calendar
      // trigger to send a viewing invite without re-asking a returning customer.
      email: row.email || null,
      // Penanda OTORITATIF (bukan heuristik) apakah AI sudah menanyakan nama —
      // 'YES' | 'NO'. Dipakai gerbang pertanyaan nama; hasRealName di atas
      // masih heuristik lama, dipertahankan untuk pemanggil yang sudah ada.
      askName: String(row.ask_name || 'NO').toUpperCase(),
    };
  } catch (err) {
    console.warn('[CustomerReg] getIdentityStatus failed (fail-open):', err.message);
    return EMPTY;
  }
}

/**
 * Apakah AI di-NONAKTIFKAN untuk customer ini? (ai_response = 'OFF')
 * Dipakai chat controllers sebagai GATE sebelum memanggil AI: bila agent sudah
 * mengambil-alih percakapan manual (toggle ai_response=OFF di module Customer),
 * AI HARUS diam untuk SEMUA pesan customer ini sampai di-ON-kan lagi.
 *
 * Dikenali via (user_id agent, phone) — sama seperti registrasi. Customer yang
 * belum terdaftar / tidak ditemukan → tidak OFF (AI tetap jalan seperti biasa).
 * Non-fatal: error apa pun → anggap tidak OFF (fail-open, jangan blokir chat).
 *
 * @param {object} p
 * @param {string} p.agentUserId - users.user_id agent
 * @param {string} p.phone       - nomor WA customer
 * @returns {Promise<boolean>} true = AI harus diam (agent takeover)
 */
async function isAiDisabledForCustomer({ agentUserId, phone }) {
  if (!agentUserId || !phone) return false;
  try {
    const { Customer } = require('../models');
    const normPhone = _normPhone(phone);
    if (normPhone.length < 8) return false;
    const row = await Customer.findOne({
      where: { user_id: String(agentUserId).toUpperCase(), phone: normPhone },
      attributes: ['ai_response', 'status'],
    });
    // status 3 (deleted) → abaikan record, AI jalan normal.
    if (!row || row.status === 3) return false;
    return String(row.ai_response || 'ON').toUpperCase() === 'OFF';
  } catch (err) {
    console.warn('[CustomerReg] isAiDisabledForCustomer failed (fail-open):', err.message);
    return false;
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
    // Summary terkirim → pencarian ini selesai. Bersihkan sticky anchor sesi supaya
    // pencarian BERIKUTNYA mulai dari nol (tidak mewarisi tipe/transaksi/lokasi lama).
    try { require('../utils/sessionAnchors').clearAnchors(sessionId); } catch (_) { /* non-fatal */ }
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

/**
 * Hook UTAMA untuk chat controllers — dipanggil SETIAP balasan AI terkirim.
 * Menggantikan pendekatan lama "daftar hanya saat summary".
 *
 * Dua tugas:
 *  1. REGISTRASI AWAL — begitu Q1 (tipe transaksi) & Q2 (lokasi) terjawab, customer
 *     langsung didaftarkan memakai NAMA DEFAULT WHATSAPP. Lead tercatat sejak dini,
 *     tidak hilang bila percakapan putus di tengah (dulu baru tercatat saat summary).
 *  2. UPDATE IDENTITAS — begitu customer menyebut nama panggilan (mis. saat AI
 *     bertanya) atau email, baris yang sudah ada di-update (nama default WA diganti
 *     nama asli, email diisi). Idempoten via UNIQUE (user_id, phone).
 *
 * Selain itu: saat balasan berisi SUMMARY → bersihkan sticky anchor sesi.
 * Non-fatal & fire-safe: error apa pun hanya di-log, alur chat tidak terganggu.
 *
 * @param {object} p
 * @param {string} p.reply           - teks balasan AI (deteksi marker summary)
 * @param {number} p.sessionId       - ChatSession.id
 * @param {string} p.currentMessage  - pesan customer terakhir
 * @param {string} p.agentUserId     - users.user_id agent
 * @param {string} p.phone           - nomor WA customer
 * @param {string|null} p.waName     - nama profil WhatsApp (nama default saat insert)
 * @returns {Promise<{action:string, customer?:object}>}
 */
async function syncCustomerFromChat({ reply, sessionId, currentMessage, agentUserId, phone, waName = null }) {
  try {
    if (!agentUserId || !phone) return { action: 'skipped' };

    // Summary terkirim → pencarian selesai, reset sticky anchor sesi.
    if (replyContainsSummary(reply)) {
      try { require('../utils/sessionAnchors').clearAnchors(sessionId); } catch (_) { /* non-fatal */ }
    }

    let history = [];
    try {
      const { getConversationHistory } = require('./sessionService');
      history = await getConversationHistory(sessionId, 60);
    } catch (_) { /* tanpa history pun tetap bisa daftar via pushname */ }

    // Sudah terdaftar? (menentukan apakah boleh update identitas walau Q1/Q2 belum lengkap)
    let alreadyExists = false;
    try {
      const { Customer } = require('../models');
      const found = await Customer.findOne({
        where: { user_id: String(agentUserId).toUpperCase(), phone: _normPhone(phone) },
        attributes: ['customer_id'],
      });
      alreadyExists = !!found;
    } catch (_) { /* fail-open */ }

    // GATE Q1+Q2 — hanya daftarkan lead yang sudah menyebut TIPE TRANSAKSI & LOKASI.
    // Mencegah nomor iseng/salah sambung ikut masuk daftar customer agent.
    let qualified = false;
    try {
      const { extractPropertyFilters } = require('./propertyRecommendationService');
      const f = extractPropertyFilters(currentMessage || '', history);
      qualified = !!(f.transactionType && f.location);
    } catch (_) { /* fail-closed: biarkan qualified=false */ }

    if (!qualified && !alreadyExists) return { action: 'skipped' };

    const { name: chatName, email } = extractIdentityFromChat(history, currentMessage);
    // Apakah giliran AI SEBELUM ini (bukan balasan yang baru saja dibuat untuk
    // currentMessage) menanyakan nama? Bila ya, currentMessage adalah RESOLUSI
    // dari pertanyaan itu — nama (bila ada) ATAU penolakan — dan ask_name wajib
    // menjadi 'YES' agar AI tidak bertanya lagi giliran berikutnya.
    const prevAiMsg = _lastAiMessageBeforeCurrentTurn(history, currentMessage, reply);
    const nameQuestionResolved = AI_ASKED_NAME_RE.test(prevAiMsg);
    return await registerCustomerFromChat({ agentUserId, phone, chatName, waName, email, nameQuestionResolved });
  } catch (err) {
    console.warn('[CustomerReg] syncCustomerFromChat failed (non-fatal):', err.message);
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
  isAiDisabledForCustomer,
  getIdentityStatus,
  replyContainsSummary,
  maybeRegisterOnSummary,
  syncCustomerFromChat,
};

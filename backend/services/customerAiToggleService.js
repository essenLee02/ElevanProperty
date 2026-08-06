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
 *         "matikan obrolan pada customer 082233556796"
 *         "nonaktifkan chat AI untuk 628111, 628222 dan 628333"
 *   ON  : "nyalakan AI untuk 0812345678" · "turn on chat AI untuk +62 812 3456 789"
 *         "nyalakan obrolan untuk 082233556796"
 *
 * Objek perintah (AI_TOPIC) menerima kata "AI"/"chatbot"/"bot" MAUPUN kata
 * percakapan sehari-hari ("obrolan", "percakapan", "chat", "balasan otomatis").
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

// Objek perintah = AI / chat AI / chatbot / bot, ATAU kata umum untuk percakapan
// yang dipakai agent sehari-hari ("obrolan", "percakapan", "chat", "balasan
// otomatis"). Agent jarang menyebut kata "AI" secara eksplisit — mereka menulis
// "matikan obrolan pada customer 0822…" — dan dulu pesan seperti itu lolos ke
// property gate lalu di-skip diam-diam. Aman dilonggarkan karena perintah ini
// hanya dieksekusi bila PENGIRIM = nomor agent sendiri (isSenderTheAgent).
const AI_TOPIC = '(?:' + [
  'chat\\s*(?:dengan\\s+)?ai',
  'ai\\s*chat',
  'ai\\s*respon(?:s|se)?',
  'respon(?:s|se)?\\s*ai',
  'chatbot',
  '\\bbot\\b',
  '\\ba\\.?i\\.?\\b',
  'kecerdasan\\s+buatan',
  // Kata percakapan umum (ID + EN)
  '\\bobrolan\\b',
  '\\bngobrol\\b',
  '\\bpercakapan\\b',
  '\\bchat(?:ting|an)?\\b',
  '\\bconversation\\b',
  // Balasan/respon OTOMATIS (butuh kata "otomatis"/"auto" agar tidak terlalu luas)
  '(?:balasan|jawaban|respon(?:s|se)?|pesan|reply|replies)\\s*(?:otomatis|automatis|auto)',
  'auto[\\s-]*(?:reply|replies|respon(?:s|se)?|balas)',
].join('|') + ')';

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

/* ══════════════════════════════════════════════════════════════════════════════
   AGENT INTERRUPTION — handover OTOMATIS, tanpa perintah eksplisit
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Handover OTOMATIS: agent tiba-tiba mengetik LANGSUNG ke seorang customer
 * (bukan ke nomornya sendiri) di tengah AI sedang menjawab customer itu. AI
 * harus BERHENTI SEPENUHNYA untuk customer ini — tidak menunggu perintah
 * eksplisit "matikan AI", karena tindakan agent mengetik itu SENDIRI sudah
 * menyatakan maksudnya: mengambil alih.
 *
 * MEKANISME DETEKSI: webhook WhatsApp meng-echo pesan KELUAR (yang dikirim
 * dari nomor terhubung agent) sebagai event `fromMe:true`. Selama ini event
 * itu HANYA di-skip diam-diam oleh setiap controller — tidak pernah dibedakan
 * apakah isinya balasan AI kita sendiri, atau ketikan MANUAL agent lewat app
 * WhatsApp di HP-nya (device yang sama dengan yang dipakai bot).
 *
 * Pembeda yang sudah tersedia: SETIAP balasan AI selalu diberi footer
 * "Sent via <AI_PRIMARY_TAG>" oleh `appendSentViaTag()` sebelum dikirim —
 * `isOwnEcho()` sudah mengenali footer ini. Sebuah `fromMe:true` TANPA footer
 * itu PASTI bukan pesan yang dikirim oleh pipeline AI kita → satu-satunya
 * sumber lain untuk event `fromMe:true` adalah agent mengetik manual.
 *
 * ⚠️ Hanya aktif bila `AI_PRIMARY_TAG` terisi — tanpa tag, `isOwnEcho()` SELALU
 * false, dan setiap balasan AI sendiri akan salah terbaca sebagai interupsi
 * (mematikan AI untuk customer yang justru sedang dilayani AI). Fail-safe:
 * bila tag kosong, fungsi ini tidak melakukan apa pun (biarkan skip lama).
 *
 * ⛔ DIKECUALIKAN — agent mengetik ke NOMORNYA SENDIRI (self-chat). Itu bukan
 * percakapan dengan customer melainkan jalur perintah pribadi agent: mengirim
 * nomor customer untuk "matikan/nyalakan AI", atau menyalakan/mematikan katalog
 * sebelum summary. Handover di sana akan mematikan AI untuk nomor agent sendiri.
 * Lihat guard `agent.phone === phone` di badan fungsi.
 *
 * ⚠️ TIDAK bergantung pada customer sudah terdaftar. Baris `customers` normalnya
 * baru dibuat saat AI mengirim SUMMARY, sedangkan interupsi agent justru paling
 * sering terjadi SEBELUM itu — bila baris belum ada (dan sudah ada ChatSession),
 * fungsi ini membuatnya lebih dulu supaya status OFF punya tempat tersimpan.
 *
 * PENCATATAN TRANSKRIP (BARU): sebelum ini, pesan manual agent pada event
 * `fromMe:true` HILANG TOTAL — tidak pernah masuk `chat_messages` sama sekali.
 * Sekarang SETIAP pesan manual (bukan hanya yang PERTAMA kali mematikan AI)
 * dicatat sebagai baris `role:'ai'` dengan `ai_responder:'agent interruption'`
 * (bukan nama provider apa pun — ini penanda eksplisit bahwa baris ini
 * ketikan MANUSIA, bukan hasil panggilan AI provider), supaya riwayat
 * percakapan tetap utuh setelah agent mengambil alih.
 *
 * @param {object} p
 * @param {string} p.customerPhone - nomor customer (= `sender` pada event fromMe:true)
 * @param {string} p.message       - isi pesan keluar yang di-echo webhook
 * @param {object} p.agent         - row users agent pemilik terminal ini
 * @param {string} p.platform      - 'kirimi' | 'fonnte' | 'timelinesai' — untuk
 *                                    membentuk `source` ChatSession yang KONSISTEN
 *                                    dengan alur normal controller pemanggil.
 * @param {string} [p.customerName] - nama tampilan customer (opsional, untuk
 *                                    ChatSession BARU bila sesi belum pernah ada).
 * @returns {Promise<{handedOver:boolean, customerName?:string}|null>} null = tidak relevan
 */
async function maybeHandleAgentInterruption({ customerPhone, message, agent, platform, customerName }) {
  const tag = String(process.env.AI_PRIMARY_TAG || '').trim();
  if (!tag) return null;   // fail-safe — lihat catatan di atas

  const { isOwnEcho } = require('../utils/whatsappUtils');
  if (isOwnEcho(message)) return null;   // ini balasan AI kita sendiri, bukan interupsi

  const phone = normPhone(customerPhone);
  if (!phone || !agent?.user_id) return null;

  // ⛔ SELF-CHAT GUARD — agent mengetik ke NOMORNYA SENDIRI, bukan ke customer.
  // Ini jalur perintah/catatan pribadi agent (mis. mengirim nomor customer untuk
  // "matikan AI 62812…", atau menyalakan/mematikan katalog sebelum summary).
  // Menganggapnya "interupsi" akan mematikan AI untuk nomor agent itu sendiri —
  // efek samping yang salah total. Dicek EKSPLISIT di sini: dulu proteksinya
  // hanya KEBETULAN (nomor agent biasanya tidak ada di tabel customers), dan
  // kebetulan itu HILANG begitu handover boleh membuat baris customer sendiri
  // (lihat blok "belum terdaftar" di bawah).
  if (agent.phone && normPhone(agent.phone) === phone) return null;

  try {
    const { Customer, ChatSession, ChatMessage } = require('../models');
    let row = await Customer.findOne({
      where: { user_id: String(agent.user_id).toUpperCase(), phone },
      attributes: ['customer_id', 'name', 'phone', 'ai_response'],
    });

    // ⚠️ BELUM TERDAFTAR ≠ BUKAN CUSTOMER. Baris `customers` baru dibuat saat AI
    // MENGIRIM SUMMARY (registerCustomerFromChat), padahal interupsi agent justru
    // paling sering terjadi JAUH SEBELUM summary — persis kasus produksi 5 Agu
    // 2026: customer baru mengirim 1 pesan, agent langsung mengambil alih, dan
    // handover BATAL DIAM-DIAM karena `row` masih null → AI tetap ikut menjawab
    // beberapa menit kemudian, bertabrakan dengan agent di chat yang sama.
    // Kolom `ai_response` adalah satu-satunya yang dibaca gate AI, jadi tanpa
    // baris tidak ada tempat menyimpan status OFF sama sekali.
    //
    // Namun JANGAN mendaftarkan sembarang nomor: satu device WhatsApp yang sama
    // juga dipakai agent mengobrol dengan teman/keluarga/vendor, dan nomor itu
    // tidak boleh ikut masuk master customer. Syaratnya: HARUS sudah ada
    // ChatSession — bukti nomor ini memang sedang/pernah berbicara dengan bot.
    // Tanpa sesi → benar-benar nomor luar → no-op (perilaku lama dipertahankan).
    if (!row) {
      const sessionSource = `${platform || 'whatsapp'}_${String(agent.name || '').toLowerCase().replace(/\s+/g, '_')}`;
      const convo = await ChatSession.findOne({ where: { normalizedPhone: phone, source: sessionSource } });
      if (!convo) return null;   // nomor luar (bukan lawan bicara bot) — abaikan

      const { registerCustomerFromChat } = require('./customerRegistrationService');
      const reg = await registerCustomerFromChat({
        agentUserId: String(agent.user_id).toUpperCase(),
        phone,
        waName: customerName || convo.name || null,
      });
      if (!reg?.customer) return null;   // registrasi ditolak (nomor tak valid, dll)
      row = reg.customer;
      console.log(`[AgentInterruption] 📇 Customer ${phone} didaftarkan lebih awal (interupsi agent sebelum summary).`);
    }

    const wasOn = String(row.ai_response || 'ON').toUpperCase() === 'ON';
    if (wasOn) {
      await Customer.update(
        { ai_response: 'OFF', updated_date: _todayDate(), updated_by: String(agent.user_id).toUpperCase() },
        { where: { customer_id: row.customer_id } }
      );
      console.log(`[AgentInterruption] ⛔ Agent ${agent.user_id} mengetik manual ke ${phone} — AI di-nonaktifkan otomatis untuk customer ini.`);
    }

    // Catat pesan manual ini ke transkrip — SELALU, walau ai_response sudah OFF
    // sebelumnya (agent mungkin melanjutkan obrolan; setiap baris tetap bagian
    // sah dari riwayat, bukan hanya baris PERTAMA yang memicu handover).
    try {
      const source = `${platform || 'whatsapp'}_${String(agent.name || '').toLowerCase().replace(/\s+/g, '_')}`;
      let session = await ChatSession.findOne({ where: { normalizedPhone: phone, source } });
      if (!session) {
        const displayName = customerName || row.name || 'Customer';
        session = await ChatSession.create({
          name: displayName, normalizedName: String(displayName).toLowerCase(),
          phone, normalizedPhone: phone, source, location: null, normalizedLocation: null,
        });
      }
      await ChatMessage.create({
        chatSessionId : session.id,
        user_id       : agent.user_id,
        role          : 'ai',
        message,
        channel       : 'whatsapp',
        customer_phone: phone,
        ai_responder  : 'agent interruption',
        metadata      : JSON.stringify({ agentInterruption: true, handedOverNow: wasOn }),
      });
    } catch (logErr) {
      // Gagal mencatat transkrip TIDAK boleh membatalkan handover di atas —
      // ai_response sudah tersimpan; ini murni kegagalan pencatatan sekunder.
      console.error('[AgentInterruption] gagal mencatat pesan ke transkrip:', logErr.message);
    }

    return { handedOver: wasOn, customerName: row.name };
  } catch (err) {
    console.error('[AgentInterruption] gagal handover otomatis:', err.message);
    return null;   // fail-open — jangan sampai error di sini mengganggu alur webhook
  }
}

module.exports = {
  detectAiToggleCommand,
  extractPhones,
  normPhone,
  setAiResponseByPhones,
  maybeHandleAiToggleCommand,
  maybeHandleAgentInterruption,
};

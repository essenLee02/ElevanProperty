'use strict';
/**
 * conversationRepairGate.js — M204 (18 Sep 2026)
 *
 * Tiga situasi percakapan yang dulu jatuh ke skrip wawancara / gerbang area / off-topic
 * keras, padahal yang dibutuhkan customer adalah SATU kalimat manusiawi lalu kembali ke
 * agendanya (sim K3 C6, K5 C3, K5 C7):
 *
 *   1. BASA-BASI ("Btw hari ini Surabaya hujan nggak ya haha") → dulu dijawab skrip
 *      "tinggal bersama siapa saja?" karena pesan AI sebelumnya berupa pertanyaan.
 *      Sekarang: balas ringan, tidak menghukum (bukan eskalasi off-topic), lalu
 *      kembalikan ke unit/area yang sedang dibahas.
 *   2. FRUSTRASI ("Kok ditanya terus sih, sy cuma mau lihat pilihan dulu") → dulu
 *      dibalas gerbang budget/area lagi. Sekarang: minta maaf, BERHENTI bertanya,
 *      arahkan ke pilihan yang sudah/akan dikirim.
 *   3. KELUHAN FOTO ("The photo you sent looks like a different house") → dulu
 *      "Sorry, I can only help with property questions". Sekarang: akui, pegang data
 *      kartu sebagai acuan, minta agent kirim foto terbaru.
 *
 * Dipakai di whatsappAIService SEBELUM gerbang kualifikasi/area (satu tempat untuk
 * kedua profil): profil 'local' memakai teks balasannya, profil 'platform' menerima
 * verdict-nya sebagai FAKTA (model yang menyusun kalimat).
 */

const SMALL_TALK_CUE = /\b(haha+|hehe+|wkwk\w*|lol|btw|ngomong[- ]?ngomong|hujan|cuaca|panas\s+banget|dingin\s+banget|macet|bola|persebaya|arema|persija|timnas|menang|kalah|ngopi|makan\s+siang|weekend|libur\w*|selamat\s+(?:ulang\s+tahun|hari\s+raya)|good\s+(?:game|match)|weather|rain\w*|traffic)\b/i;

function detectSmallTalk(message = '', { hasPropertyKeyword = () => false, isContinuation = () => false } = {}) {
  const t = String(message || '').trim();
  if (!t) return false;
  if (!SMALL_TALK_CUE.test(t)) return false;
  if (hasPropertyKeyword(t)) return false;
  // isPropertyContextContinuation() menganggap SEMUA balasan atas pertanyaan AI sebagai
  // lanjutan — termasuk "hujan nggak ya haha". Lanjutan hanya dihormati bila pesannya
  // pendek (jawaban wajar), bukan kalimat basa-basi utuh.
  if (isContinuation(t) && t.split(/\s+/).length <= 3) return false;
  // Pertanyaan properti yang kebetulan memuat kata cuaca ("rumahnya banjir kalau hujan?")
  // sudah tersaring hasPropertyKeyword; sisanya = obrolan ringan.
  return true;
}

const PHOTO_MISMATCH = /\b(?:photo|foto|gambar|picture|image)\w*\b[^.?!]{0,60}\b(?:beda|berbeda|different|salah|bukan|not\s+match|mismatch|doesn'?t\s+match|lain|ngga(?:k)?\s+sama|nggak\s+sesuai|tidak\s+sesuai)\b|\b(?:beda|berbeda|different|salah)\b[^.?!]{0,40}\b(?:photo|foto|gambar|picture)\w*\b/i;

function detectPhotoMismatch(message = '') {
  return PHOTO_MISMATCH.test(String(message || ''));
}

/**
 * @param {object} p
 * @param {string} p.message
 * @param {'id'|'en'} p.lang
 * @param {boolean} p.cardsSent  sudah ada kartu unit yang terkirim di sesi ini
 * @param {string}  [p.lastCardTitle]  judul unit terakhir yang dibahas (opsional)
 * @param {{frustrated:boolean,kind:string|null}} [p.frustration]
 * @param {boolean} [p.smallTalk]
 * @param {boolean} [p.photoMismatch]
 * @returns {{reply:string, verdict:string}|null}
 */
// M204 (sim N9/N4): "Saya mau ngomong sama orang, bukan bot" / "boleh minta nomor agentnya?" —
// dulu dibalas pertanyaan slot. Serah-terima ke manusia dijawab langsung, di kedua profil.
// "Sama orang tua saya, 3 orang" (peserta survei) BUKAN minta manusia — kata kerja bicara/chat wajib ada.
const HUMAN_REQUEST = /\b(?:ngomong|bicara|chat|hubungi|telpon|telepon|call|talk|speak)\b[^.?!]{0,30}\b(?:orang(?!\s*(?:tua|lain|rumah|kantor|nya))|manusia|human|person|agent\w*|agen\w*|cs|admin|staff)\b|\b(?:bukan|jangan|no)\s+(?:bot|robot|ai)\b|\breal\s+person\b/i;
const AGENT_NUMBER_REQUEST = /\b(?:minta|boleh|bisa|share|kasih|bagi|ada)\b[^.?!]{0,25}\b(?:nomor|no\.?|kontak|contact|number|hp|wa|whatsapp)\b[^.?!]{0,25}\b(?:agent\w*|agen\w*|marketing|pemilik|owner)\b|\b(?:agent|agen)\w*\b[^.?!]{0,12}\b(?:nomor|kontak)nya\b|\bhubungi\s+agen\w*\s+(?:langsung|aja|saja)\b/i;
function detectHumanRequest(message = '') { return HUMAN_REQUEST.test(String(message || '')); }
function detectAgentNumberRequest(message = '') { return AGENT_NUMBER_REQUEST.test(String(message || '')); }

function buildRepairReply({ message, lang = 'id', cardsSent = false, lastCardTitle = '', frustration, smallTalk, photoMismatch, humanRequest, agentNumberRequest }) {
  const id = lang !== 'en';
  if (humanRequest || agentNumberRequest) {
    return {
      verdict: humanRequest ? 'human-handoff' : 'agent-number',
      reply: id
        ? `Siap, Kak 🙏 Saya teruskan ke agent kami (manusia) sekarang — beliau akan menghubungi Kakak lewat nomor WhatsApp ini${cardsSent ? ', lengkap dengan catatan unit yang sudah dibahas' : ', lengkap dengan catatan kebutuhan Kakak'}. Sambil menunggu, kalau ada yang mau ditanyakan, saya tetap di sini.`
        : `Sure 🙏 I'm passing this to our (human) agent now — they'll contact you on this WhatsApp number${cardsSent ? ' with the notes on the units we discussed' : ' with your requirements'}. Meanwhile, I'm still here if you need anything.`,
    };
  }
  if (photoMismatch) {
    const unit = lastCardTitle ? ` *${lastCardTitle}*` : '';
    return {
      verdict: 'photo-mismatch',
      reply: id
        ? `Terima kasih sudah mengecek, Kak 🙏 Kalau foto dan deskripsinya tidak cocok, yang jadi acuan adalah DATA di kartu${unit} (alamat, kamar, luas, harga) — fotonya kemungkinan tertukar/lama. Saya minta agent kami kirim foto terbaru unit itu ya. Sambil menunggu, ada detail lain yang mau dicek?`
        : `Thanks for flagging that 🙏 If the photo and the description don't match, the DATA on the card${unit} (address, rooms, size, price) is the reference — the photo is likely outdated or swapped. I'll ask our agent to send the latest photos of that unit. Meanwhile, anything else you'd like me to check?`,
    };
  }
  if (frustration && frustration.frustrated) {
    return {
      verdict: `frustration-${frustration.kind}`,
      reply: id
        ? (cardsSent
          ? `Maaf ya, Kak 🙏 Saya berhenti bertanya. Silakan lihat-lihat dulu pilihan yang sudah saya kirim — tinggal sebut nomor unitnya kalau ada yang menarik, atau sebut area/kriteria lain dan langsung saya kirim pilihannya.`
          : `Maaf ya, Kak 🙏 Saya berhenti bertanya. Sebutkan saja area atau kriteria yang Kakak mau, langsung saya kirim pilihannya tanpa pertanyaan tambahan.`)
        : (cardsSent
          ? `Sorry about that 🙏 No more questions. Take your time with the options I've sent — just mention the unit number if one interests you, or name another area/criteria and I'll send options right away.`
          : `Sorry about that 🙏 No more questions. Just tell me the area or criteria you want and I'll send the options straight away.`),
    };
  }
  if (smallTalk) {
    return {
      verdict: 'small-talk',
      reply: id
        ? (cardsSent
          ? `Hehe, kalau soal itu saya kurang update, Kak 😄 Balik ke properti ya — dari pilihan yang sudah saya kirim, ada yang mau ditanyakan detailnya?`
          : `Hehe, kalau soal itu saya kurang update, Kak 😄 Balik ke properti ya — kalau area atau kriterianya sudah ada, langsung saya carikan pilihannya.`)
        : (cardsSent
          ? `Haha, I'm not the best source on that 😄 Back to the property — anything you'd like to check on the options I've sent?`
          : `Haha, I'm not the best source on that 😄 Back to the property — tell me the area or criteria and I'll find options right away.`),
    };
  }
  return null;
}

module.exports = { detectSmallTalk, detectPhotoMismatch, detectHumanRequest, detectAgentNumberRequest, buildRepairReply, SMALL_TALK_CUE, PHOTO_MISMATCH };

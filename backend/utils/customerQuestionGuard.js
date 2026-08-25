'use strict';
/**
 * customerQuestionGuard.js — "customer BERTANYA, jawab dulu" (M142)
 *
 * Transkrip produksi NYATA (25 Agu 2026) yang memicu modul ini:
 *
 *   Customer : "Alamat Sawahan House Sale Surabaya, itu ada dimana; Kak?"
 *   AI       : "Sudah lihat berapa Rumah di Surabaya? Apa yang membuat belum
 *               cocok dari yang sudah dilihat?"          ← Q2b, TIDAK NYAMBUNG
 *
 *   Customer : "Kalau saya mau survei ke Perumahan Surabaya Suburban, itu
 *               alamat dan kotanya ada dimana ya?"
 *   AI       : "Kak lebih prefer yang terjangkau, menengah, atau eksklusif?"
 *                                                        ← Q3, TIDAK NYAMBUNG
 *
 * AKAR: `buildFinalDirective()` SELALU menutup prompt dengan
 * "TANYAKAN SEKARANG → Qx" tanpa syarat. Baris itu ada di posisi 100% prompt
 * (M62) dan MENGALAHKAN seluruh instruksi di atasnya — termasuk aturan
 * "jawab pertanyaan customer". Jadi apa pun yang customer tanyakan, LLM
 * mengabaikannya dan melanjutkan skrip interview.
 *
 * Alamat/harga/kamar SEMUANYA sudah ada di konteks katalog yang dikirim ke
 * LLM (`Address:`/`Price:`/`Rooms:` di formatPropertyRecommendation) — jadi
 * ini BUKAN data yang kurang, murni direktif yang salah memaksa.
 *
 * ⛔ Modul ini TIDAK menyusun balasan. Ia hanya menjawab satu pertanyaan
 * boolean — "apakah giliran ini customer sedang bertanya sesuatu yang harus
 * dijawab dari data?" — supaya buildFinalDirective bisa MENUNDA pertanyaan
 * berikutnya satu giliran. Kalimat jawabannya tetap disusun platform AI
 * (M131/M133).
 */

/** Tanda sebuah pesan adalah PERTANYAAN (bukan pernyataan/jawaban). */
const QUESTION_CUE_RE = /\?|\b(apakah|apa|dimana|di\s*mana|kapan|berapa|brp|bagaimana|gimana|kenapa|mengapa|siapa|bisakah|boleh|adakah|ada\s+(?:nggak|ga|gak|tidak))\b/i;

/**
 * Topik yang JAWABANNYA ada di katalog/DB — bukan sesuatu yang harus
 * ditanyakan balik ke customer.
 *
 * ⚠️ SENGAJA tidak memasukkan kata generik seperti "rumah"/"properti" saja —
 * "Saya mau rumah" adalah PERNYATAAN kebutuhan, bukan pertanyaan data.
 * Yang dicari: atribut KONKRET dari sebuah listing.
 */
const DATA_TOPIC_RE = new RegExp([
  // Alamat & lokasi fisik listing
  'alamat', 'lokasi(?:nya)?', 'letak(?:nya)?', 'di\\s*mana', 'dimana', 'jalan\\b', '\\bjln\\b',
  // Harga
  'harga(?:nya)?', 'berapa\\s+(?:harga|duit|uang)', '\\bnego\\b', 'cicilan', 'angsuran',
  // Spesifikasi unit
  'kamar', '\\bkt\\b', '\\bkm\\b', 'luas', 'bangunan', 'tanah', 'lantai',
  'sertifikat', '\\bshm\\b', '\\bshgb\\b', 'furnish',
  // Fasilitas & sekitar
  'fasilitas', 'dekat', 'sekitar', 'deket',
  // Ketersediaan
  'masih\\s+ada', 'tersedia', 'ready',
].join('|'), 'i');

/**
 * Apakah customer sedang MENANYAKAN data properti yang harus dijawab dari
 * katalog/DB pada giliran ini?
 *
 * @param {string} message pesan customer terbaru
 * @returns {boolean}
 */
function customerAsksPropertyData(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  if (!QUESTION_CUE_RE.test(text)) return false;
  return DATA_TOPIC_RE.test(text);
}

/**
 * Baris direktif pengganti "TANYAKAN SEKARANG → Qx" untuk giliran ini.
 *
 * Deskriptif soal APA yang harus dilakukan (jawab dari data, jangan mengarang,
 * jangan lanjut interview dulu) — TIDAK mendikte kalimatnya.
 *
 * @param {string} message pesan customer yang sedang ditanyakan
 * @param {object|null} nextQuestion hasil findNextQuestion() (untuk disebut
 *   sebagai lanjutan SESUDAH menjawab, bukan menggantikan jawaban)
 * @returns {string}
 */
function buildAnswerFirstDirective(message, nextQuestion = null) {
  const followUp = nextQuestion && nextQuestion.hint
    ? `\n   Setelah menjawab, BOLEH lanjut satu pertanyaan: ${String(nextQuestion.hint).slice(0, 160)}`
    : '';
  return `❗ CUSTOMER SEDANG BERTANYA — JAWAB DULU, JANGAN LANJUT INTERVIEW.
   Pertanyaan customer: "${String(message).trim().slice(0, 200)}"
   Jawab dari DATA KATALOG di atas (Address / Price / Rooms / Facilities /
   Certificate pada listing yang customer maksud). Sebut nama listing-nya
   supaya jelas yang mana.
   ⛔ Bila datanya TIDAK ADA di konteks: katakan terus terang belum tercatat
      dan akan dibantu cek tim — DILARANG menebak atau mengarang alamat,
      harga, jumlah kamar, atau status sertifikat.
   ⛔ DILARANG membalas dengan pertanyaan interview yang tidak berhubungan
      (itu terjadi di produksi dan customer harus mengulang pertanyaannya).${followUp}`;
}

module.exports = {
  QUESTION_CUE_RE,
  DATA_TOPIC_RE,
  customerAsksPropertyData,
  buildAnswerFirstDirective,
};

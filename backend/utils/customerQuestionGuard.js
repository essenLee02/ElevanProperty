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

/* ═══════════════════════════════════════════════════════════════════════════
   M103 — KELAS KEDUA: PERMINTAAN PROSES, BUKAN PERTANYAAN DATA.
   ═══════════════════════════════════════════════════════════════════════════
   Transkrip produksi 26 Agu 2026 (beli rumah Sidoarjo / Puri Surya Jaya).
   Customer meminta survei ENAM KALI dan TIDAK PERNAH dijawab:

     11.54 "Saya mau survei dulu, Kak"           → AI: Q4 penghuni        ❌
     11.54 "Apakah blh survei dlu?"              → (diabaikan)            ❌
     11.55 "Saya mau lihat" dlu sih, Kak"        → AI: Q_FAC fasilitas    ❌
     11.56 "Saya survei dlu; Kak"                → AI: Q_COND kondisi     ❌
     11.57 "Kalau survei ke Puri Surya Jaya,
            butuh brpa lama? Rumah saya di
            Sidotopo; Kak"                       → AI: Q11 furnitur       ❌
     11.58 "Stop, Kak. Fokus ke survei dlu"      → AI: Q5 red flags       ❌❌
     11.58 "Saya mau survei. Apakah sy blh
            survei ke Puri Surya Jaya?"          → AI: Q6 patokan         ❌

   `customerAsksPropertyData()` TIDAK menangkap satu pun dari ini — dan itu
   BENAR sesuai desainnya: fungsi itu khusus pertanyaan yang jawabannya ada di
   KATALOG (alamat/harga/kamar). Permintaan di atas kelasnya beda:
     • IZIN/NIAT   — "boleh survei?" → butuh jawaban YA + penjadwalan
     • REDIRECT    — "Stop, fokus ke survei dlu" → customer MEMBATALKAN agenda
                     interview AI secara eksplisit
     • LOGISTIK    — "butuh berapa lama dari Sidotopo?" → AI TIDAK TAHU jarak
                     tempuh; wajib jujur & serahkan ke agent, jangan menebak

   Semuanya WAJIB dijawab lebih dulu. Membiarkan skrip interview menang atas
   permintaan eksplisit customer adalah keluhan utama pemilik proyek:
   "AI terlalu fokus pada agendanya pribadi… AI tetap acuh dan terus melakukan
   interview sesuai agenda pribadinya sendiri."
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Customer MEMINTA/MENANYAKAN survei-viewing (izin, niat, atau jadwal).
 *
 * ⚠️ Sengaja TIDAK memakai QUESTION_CUE_RE sebagai syarat: "Saya mau survei
 * dulu, Kak" adalah PERNYATAAN NIAT tanpa tanda tanya, tapi tetap wajib
 * dijawab. Yang menentukan justru kata kerja survei + penanda niat/izin.
 */
const VIEWING_REQUEST_RE = new RegExp(
  '\\b(?:mau|ingin|pengen|pingin|bisa|bisakah|boleh|blh|bolehkah|minta|rencana|niat)\\b'
  + '[^.?!]{0,40}?'
  + '\\b(?:survei|survey|surver|srvei|viewing|visit|lihat|liat|liht|cek|ngecek|datang|kunjung)\\b'
  + '|'
  + '\\b(?:survei|survey|viewing)\\b[^.?!]{0,30}?\\b(?:dulu|dlu|dl)\\b',
  'i'
);

/**
 * Customer secara EKSPLISIT menyuruh AI berhenti/berganti fokus.
 * Ini sinyal terkuat yang bisa diberikan customer — mengabaikannya membuat
 * percakapan terasa seperti bot yang tidak mendengarkan sama sekali.
 */
const FOCUS_REDIRECT_RE = new RegExp(
  '\\b(?:stop|berhenti|udah|sudah|cukup|tunggu|bentar|sebentar)\\b[^.?!]{0,30}?'
  + '\\b(?:dulu|dlu|ya|kak)?\\b'
  + '[^.?!]{0,30}?\\b(?:fokus|fokuskan|bahas|urus|bicara)\\b'
  + '|'
  + '\\bfokus\\b[^.?!]{0,20}?\\b(?:ke|pada|dulu|dlu)\\b'
  + '|'
  + '\\b(?:jangan|jgn)\\b[^.?!]{0,25}?\\b(?:tanya|nanya|tanyakan)\\b'
  + '|'
  + '\\b(?:nanti|ntar)\\s+(?:saja|sj|aja|dulu|dlu)\\b',
  'i'
);

/** Kata kerja survei/viewing dalam segala ejaan yang lazim di WhatsApp. */
const VIEWING_VERB_RE = /\b(?:survei|survey|surver|srvei|viewing|visit|kunjungan)\b/i;

/** @returns {boolean} customer meminta/menanyakan survei pada giliran ini. */
function customerRequestsViewing(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  if (VIEWING_REQUEST_RE.test(text)) return true;

  // BERTANYA TENTANG survei (bukan meminta) tetap wajib dijawab.
  // Kasus produksi yang lolos pola di atas karena tidak ada kata niat maupun
  // "dulu": "Kalau survei ke Puri Surya Jaya, butuh brpa lama? Rumah saya di
  // Sidotopo; Kak" — pertanyaan LOGISTIK. Di produksi dijawab Q11 furnitur.
  // Syaratnya tetap dua: ada tanda tanya/kata tanya DAN menyebut survei —
  // jadi kalimat biasa yang kebetulan memuat "survei" tidak ikut tertangkap.
  return QUESTION_CUE_RE.test(text) && VIEWING_VERB_RE.test(text);
}

/** @returns {boolean} customer menyuruh AI berhenti/ganti fokus. */
function customerRedirectsFocus(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  return FOCUS_REDIRECT_RE.test(text);
}

/**
 * Satu gerbang untuk "giliran ini WAJIB dijawab dulu, apa pun agendanya".
 * @returns {'data'|'viewing'|'redirect'|null}
 */
function customerNeedsDirectAnswer(message) {
  if (customerRedirectsFocus(message)) return 'redirect';
  if (customerRequestsViewing(message)) return 'viewing';
  if (customerAsksPropertyData(message)) return 'data';
  return null;
}

/**
 * Direktif untuk permintaan survei / redirect fokus.
 * Sama seperti buildAnswerFirstDirective: deskriptif soal APA yang harus
 * dilakukan, TIDAK mendikte kalimatnya (M131/M133).
 */
function buildViewingRequestDirective(message, kind = 'viewing', nextQuestion = null) {
  const header = kind === 'redirect'
    ? '❗ CUSTOMER MENYURUH BERHENTI & GANTI FOKUS — PATUHI SEKARANG.'
    : '❗ CUSTOMER MEMINTA SURVEI/VIEWING — JAWAB & TINDAK LANJUTI DULU.';

  const followUp = nextQuestion && nextQuestion.hint
    ? `\n   Setelah itu, BOLEH lanjut satu pertanyaan: ${String(nextQuestion.hint).slice(0, 160)}`
    : '';

  return `${header}
   Pesan customer: "${String(message).trim().slice(0, 200)}"
   Yang HARUS dilakukan giliran ini:
     1. Jawab permintaannya secara langsung ("Bisa, Kak" untuk permintaan survei).
     2. Lanjutkan prosesnya — tanyakan KAPAN (tanggal), lalu jam pada giliran
        berikutnya. Jadwal survei adalah data yang memang perlu dikumpulkan,
        jadi ini BUKAN keluar jalur.
   ⛔ DILARANG membalas dengan pertanyaan interview lain (fasilitas, furnitur,
      penghuni, kondisi, red flags) sebelum permintaan ini dijawab. Di produksi
      customer harus mengulang permintaan survei SAMPAI ENAM KALI karena
      aturan ini tidak ada.
   ⛔ Bila customer menanyakan JARAK/LAMA PERJALANAN ke lokasi: AI TIDAK punya
      data itu — katakan terus terang akan dibantu agent, JANGAN menebak durasi
      atau jarak.${followUp}`;
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
  // M103 — permintaan proses (survei) & redirect fokus
  VIEWING_REQUEST_RE,
  FOCUS_REDIRECT_RE,
  customerRequestsViewing,
  customerRedirectsFocus,
  customerNeedsDirectAnswer,
  buildViewingRequestDirective,
};

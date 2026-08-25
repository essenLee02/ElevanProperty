'use strict';
/**
 * areaAvailabilityGate.js — jangan menebak, jangan mengarang, jangan meng-interview (M152)
 * ----------------------------------------------------------------------------------------
 * Directive pemilik proyek (25 Agu 2026), dari transkrip produksi:
 *   "Jika AI tdk memiliki datanya di database, AI harus tanya apakah customer
 *    mau alternatif area lain. Namun AI tdk melakukan itu, malah AI memberikan
 *    apartemen di area lain, seharusnya AI bertanya dahulu, tidak boleh menebak.
 *    AI juga bisa minta maaf kepada customer, kalau sewa apartemen Pakuwon
 *    Surabaya itu tidak ada, adanya itu dijual, belum ada yang disewakan."
 *
 * APA YANG SALAH SEBELUMNYA
 * Customer minta SEWA apartemen di Pakuwon dan bertanya "apakah ada?" lima kali.
 * Bot tidak pernah menjawab; ia mengajukan pertanyaan interview berikutnya tiap
 * giliran (satu pertanyaan bahkan diulang 3x), lalu diam-diam mengirim listing
 * Bulak/Kalijudan/Karang Pilang — area yang TIDAK diminta. Dua pelanggaran:
 * pertanyaan customer diabaikan, dan area ditebak tanpa izin.
 *
 * ATURAN GERBANG INI
 *   1. Pertanyaan ketersediaan customer DIJAWAB DULU, sebelum pertanyaan apa pun.
 *   2. Angkanya diambil dari katalog agent (areaAvailabilityService), bukan dikarang.
 *   3. Stok nol → MINTA MAAF, sebutkan apa yang sebenarnya ADA, lalu TANYA.
 *      Tidak pernah langsung mengirim listing area lain.
 *   4. Salah transaksi (Pakuwon: sewa nol, jual 19) → sebut apa adanya dan
 *      tawarkan dua jalan: ganti area (tetap sewa) atau ganti transaksi (tetap Pakuwon).
 *   5. Alternatif area HANYA yang benar-benar punya stok, diurut TERMURAH dulu.
 *
 * ⛔ Gerbang ini sekelas M129/M130/M132 (terminologi & jarak): ia mencegah AI
 * MENGARANG FAKTA ketersediaan, bukan mengatur gaya bicara. Karena itu ia aktif
 * di profil 'local' maupun 'platform' — sama seperti jaring pengaman lain yang
 * secara eksplisit dipertahankan pemilik proyek (24 Agu 2026).
 */

const { checkAreaAvailability } = require('../services/areaAvailabilityService');

/** Customer bertanya "ada / apakah ada / punya ga" — pertanyaan KETERSEDIAAN. */
const AVAILABILITY_RE = new RegExp([
  /\bapakah\s+ada\b/, /\bada\s+(?:nggak|ngga|ga|gak|tidak|gk)\b/, /\badakah\b/,
  /\bada\s+atau\s+(?:tidak|tdk|ga|nggak)\b/, /\bada\s+atau\s+tdk\b/,
  /\bpunya\s+(?:nggak|ga|gak|tidak)\b/, /\bmasih\s+ada\b/, /\btersedia\b/,
  /\bavailab(?:le|ility)\b/, /\bdo\s+you\s+have\b/, /\bany\s+.*\bavailable\b/,
  // Angka di tengah frasa ("minta 5 data") harus ikut tertangkap — versi awal
  // memakai \bminta\s+data\b dan meleset persis pada contoh pemilik proyek.
  /\bminta\s+(?:\d{1,2}\s+)?(?:data|listing|unit|properti)\b/,
  /\b(?:kasih|kirim|tolong|boleh)\s+(?:\d{1,2}\s+)?(?:data|listing)\b/,
  /\bbutuh\s+rekomendasi\b/,
  /\bada\s+di\s+(?:area|daerah|kawasan)\b/, /\bdaerah\s+mana\s+saja\b/,
  /\barea\s+mana\s+saja\b/, /\bdi\s*mana\s+saja\b/,
].map((r) => r.source).join('|'), 'i');

/**
 * "Minta 5 data apartemen" → 5. Pemilik proyek: "Kalau customer minta 5 data
 * apartemen di Pakuwon Surabaya, AI bisa berikan 5 data, selama jumlah data itu
 * possible." Dibatasi 10 supaya satu balasan tidak jadi banjir pesan.
 */
const COUNT_RE = /\b(\d{1,2})\s*(?:data|listing|unit|properti|apartemen|rumah|pilihan|opsi)\b/i;

const MAX_REQUESTED = 10;
const DEFAULT_SHOWN = 2;

function detectRequestedCount(message) {
  const m = String(message || '').match(COUNT_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, MAX_REQUESTED);
}

function customerAsksAvailability(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  return AVAILABILITY_RE.test(t);
}

/** "2.000.000" → "2 juta"; dipakai supaya angka alternatif enak dibaca. */
function humanPrice(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;
  const v = Number(n);
  if (v >= 1e9) return `${parseFloat((v / 1e9).toFixed(2))} miliar`;
  if (v >= 1e6) return `${parseFloat((v / 1e6).toFixed(1))} juta`;
  if (v >= 1e3) return `${parseFloat((v / 1e3).toFixed(0))} ribu`;
  return String(v);
}

const txWord = (tx, isId) => (tx === 'Rent'
  ? (isId ? 'sewa' : 'rent')
  : (isId ? 'dijual' : 'for sale'));

/**
 * Susun balasan dari FAKTA. Mengembalikan null bila tidak ada yang perlu
 * dikoreksi (stok ada) — pemanggil lanjut ke alur normal.
 *
 * @returns {{reply:string, verdict:string, requestedCount:number|null}|null}
 */
function composeAvailabilityReply(av, { area, typeLabel = 'properti', transactionType, isId = true, requestedCount = null }) {
  if (!av || !av.ok) return null;
  if (av.verdict === 'available') return null;          // ada stok → tidak perlu gerbang

  const alts = (av.alternativeAreas || []).filter((a) => a.count > 0);
  const altLine = alts.length
    ? alts.map((a) => {
      const p = humanPrice(a.minPrice);
      return `• *${a.area}* — ${a.count} unit${p ? `, mulai ${p}` : ''}`;
    }).join('\n')
    : '';

  /* ── Kasus 1: area punya stok, tapi TRANSAKSINYA beda (kasus Pakuwon) ── */
  if (av.verdict === 'wrong-transaction') {
    const other = av.crossTransaction;
    const otherPrice = humanPrice(other.minPrice);
    if (!isId) {
      return {
        verdict: av.verdict, requestedCount,
        reply: `I'm sorry — I don't have any ${typeLabel} ${txWord(transactionType, false)} in ${area} right now. `
             + `What I do have in ${area} is ${other.count} unit(s) ${txWord(other.transactionType, false)}`
             + `${otherPrice ? `, starting from ${otherPrice}` : ''}.\n\n`
             + (altLine ? `If you'd rather stay with ${txWord(transactionType, false)}, these areas do have stock:\n${altLine}\n\n` : '')
             + `Would you like to switch area, or see the ${txWord(other.transactionType, false)} units in ${area}?`,
      };
    }
    return {
      verdict: av.verdict, requestedCount,
      reply: `Mohon maaf, Kak 🙏 Untuk *${typeLabel} ${txWord(transactionType, true)}* di *${area}* memang belum ada.\n\n`
           + `Yang ada di *${area}* itu *${txWord(other.transactionType, true)}* — ${other.count} unit`
           + `${otherPrice ? `, mulai ${otherPrice}` : ''}.\n\n`
           + (altLine
             ? `Kalau Kakak tetap mau *${txWord(transactionType, true)}*, area yang tersedia:\n${altLine}\n\n`
             : '')
           + `Mau saya carikan di area lain, atau mau lihat yang *${txWord(other.transactionType, true)}* di ${area}? 😊`,
    };
  }

  /* ── Kasus 2: area itu memang kosong untuk tipe ini ── */
  if (!isId) {
    return {
      verdict: av.verdict, requestedCount,
      reply: `I'm sorry — I don't have any ${typeLabel} ${txWord(transactionType, false)} in ${area} at the moment.\n\n`
           + (altLine ? `These areas do have stock:\n${altLine}\n\nWould you like me to look at any of these?`
             : `Would you like me to check another area?`),
    };
  }
  return {
    verdict: av.verdict, requestedCount,
    reply: `Mohon maaf, Kak 🙏 Untuk *${typeLabel} ${txWord(transactionType, true)}* di *${area}* belum ada di data saya.\n\n`
         + (altLine
           ? `Yang tersedia ada di area berikut:\n${altLine}\n\nMau saya carikan di salah satu area itu? 😊`
           : `Mau saya carikan di area lain? 😊`),
  };
}

/**
 * Gerbang lengkap: cek katalog lalu susun balasan bila perlu.
 * Fail-open — error apa pun mengembalikan null supaya alur normal jalan terus.
 */
async function tryAreaAvailabilityAnswer({
  userId, city, area, buildingType, transactionType,
  typeLabel = 'properti', message = '', isId = true,
}) {
  if (!userId || !area || !transactionType) return null;
  try {
    const av = await checkAreaAvailability({ userId, city, area, buildingType, transactionType });
    return composeAvailabilityReply(av, {
      area, typeLabel, transactionType, isId,
      requestedCount: detectRequestedCount(message),
    });
  } catch (err) {
    console.error('[AREA AVAILABILITY GATE ERROR]', err.message);
    return null;
  }
}

module.exports = {
  tryAreaAvailabilityAnswer,
  composeAvailabilityReply,
  customerAsksAvailability,
  detectRequestedCount,
  humanPrice,
  DEFAULT_SHOWN,
  MAX_REQUESTED,
};

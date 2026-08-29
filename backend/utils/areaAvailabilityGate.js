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

const {
  checkAreaAvailability, checkCityAvailability, fetchAreaListings, listAreasWithinBudget, resolveCityId,
} = require('../services/areaAvailabilityService');

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

/**
 * "kutisari" / "KUTISARI" → "Kutisari".
 *
 * Nama area sampai ke gerbang ini lewat bermacam jalur: qs.district (apa adanya
 * dari ketikan customer), detectLandmark() (HURUF BESAR semua, dari master
 * lokasi), filters.landmark. Tanpa penyeragaman, balasan ke customer bisa
 * berbunyi "apartemen dijual di *kutisari*" atau "*KUTISARI*" — terlihat seperti
 * salah ketik pada pesan yang seharusnya rapi. Nama listing di kartu tetap
 * memakai nilai asli dari database, yang dirapikan hanya kalimat gerbang.
 */
function titleCaseArea(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

const txWord = (tx, isId) => (tx === 'Rent'
  ? (isId ? 'sewa' : 'rent')
  : (isId ? 'dijual' : 'for sale'));

/**
 * Baca ulang angka dari teks budget YANG SUDAH TERSIMPAN di state percakapan
 * (mis. qs.budget = "Rp 600.000.000 - Rp 700.000.000"), dipakai sebagai
 * CADANGAN saat pesan SAAT INI tidak menyebut budget sama sekali (M161).
 *
 * Bug nyata (transkrip uji coba 28 Agu 2026, "Tasha"): customer bilang budget
 * 600-700 juta di pesan PERTAMA, lalu pesan-pesan berikutnya ("Driyorejo aja
 * Kak") wajar sekali tidak mengulang angka itu. Karena `detectBudget(message)`
 * hanya membaca pesan SAAT INI, gerbang menganggap budget "tidak diketahui"
 * dan menampilkan SEMUA listing tanpa filter harga — termasuk yang 776.9 juta,
 * jauh di atas budget yang baru saja disebutkan, seolah-olah cocok.
 */
function parsePersistedBudgetText(text) {
  const m = String(text || '').match(/Rp\s*([\d.]+)(?:\s*-\s*Rp\s*([\d.]+))?/i);
  if (!m) return null;
  const min = m[1] ? Number(m[1].replace(/\./g, '')) : null;
  const max = m[2] ? Number(m[2].replace(/\./g, '')) : min;
  if (!Number.isFinite(min) && !Number.isFinite(max)) return null;
  return { min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null, text };
}

/**
 * Susun balasan dari FAKTA. Mengembalikan null bila tidak ada yang perlu
 * dikoreksi (stok ada) — pemanggil lanjut ke alur normal.
 *
 * @returns {{reply:string, verdict:string, requestedCount:number|null}|null}
 */
function composeAvailabilityReply(av, { area: areaRaw, typeLabel = 'properti', transactionType, isId = true, requestedCount = null }) {
  if (!av || !av.ok) return null;
  const area = titleCaseArea(areaRaw);
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
 * Balasan saat stok ADA di area ini, tapi tidak satu pun masuk budget yang
 * customer sebutkan (M156). Beda dari composeAvailabilityReply — di sini
 * area MEMANG punya stok, hanya HARGANYA yang tidak cocok, jadi framingnya
 * soal budget, bukan soal ketersediaan area/transaksi.
 */
/**
 * Balasan saat kota yang disebut customer TIDAK ADA sama sekali di katalog
 * agent — kelas kegagalan satu tingkat DI ATAS "area tidak ada" (M164).
 *
 * Directive pemilik proyek (29 Agu 2026), contoh eksplisit:
 *   customer: "Hello.. Saya mau sewa rumah di Madiun"
 *   AI (BENAR): "Mohon maaf, Kak. Saya punya listing di kota lain; seperti
 *                Surabaya, Gresik dan Sidoarjo. Apakah berminat?"
 * BUKAN bertanya "di area mana di Madiun?" — kota itu sendiri yang tidak ada,
 * jadi tidak ada gunanya bertanya area di dalamnya sama sekali.
 */
function composeCityEmptyReply({ city, typeLabel = 'properti', transactionType, isId = true, alternativeCities = [] }) {
  const names = (alternativeCities || []).map((c) => c.city);
  if (!isId) {
    return {
      verdict: 'city-empty',
      reply: names.length
        ? `I'm sorry — I don't have any ${typeLabel} listings in ${city} yet. I do have listings in ${names.join(', ')}. Would you be interested in one of those instead?`
        : `I'm sorry — I don't have any ${typeLabel} listings in ${city} yet, and I don't currently have stock in any other city either.`,
    };
  }
  return {
    verdict: 'city-empty',
    reply: names.length
      ? `Mohon maaf, Kak 🙏 Saya belum punya listing *${typeLabel}* di *${city}*. Saya punya listing di kota lain; seperti ${names.join(', ')}. Apakah berminat? 😊`
      : `Mohon maaf, Kak 🙏 Saya belum punya listing *${typeLabel}* di *${city}*, dan saat ini belum ada stok di kota lain juga.`,
  };
}

function composeBudgetEmptyReply({
  area: areaRaw, typeLabel = 'properti', transactionType, isId = true,
  requestedCount = null, budgetLabel, altAreas = [],
}) {
  const area = titleCaseArea(areaRaw);
  const alts = (altAreas || []).filter((a) => a.count > 0);
  const altLine = alts.length
    ? alts.map((a) => {
      const p = humanPrice(a.minPrice);
      return `• *${a.area}* — ${a.count} unit${p ? `, mulai ${p}` : ''}`;
    }).join('\n')
    : '';

  if (!isId) {
    return {
      verdict: 'budget-empty', requestedCount,
      reply: `I'm sorry — I don't have any ${typeLabel} ${txWord(transactionType, false)} in ${area} within ${budgetLabel}.\n\n`
           + (altLine ? `These areas do fit that budget:\n${altLine}\n\nWould you like to see any of these?`
             : `Would you like to try a different budget, or another area?`),
    };
  }
  return {
    verdict: 'budget-empty', requestedCount,
    reply: `Mohon maaf, Kak 🙏 Untuk *${typeLabel} ${txWord(transactionType, true)}* di *${area}* belum ada yang sesuai budget ${budgetLabel}.\n\n`
         + (altLine
           ? `Kalau budgetnya segitu, ada di area berikut:\n${altLine}\n\nMau saya carikan di salah satu area itu? 😊`
           : `Mau saya cek budget lain, atau area lain? 😊`),
  };
}

/**
 * Gerbang lengkap: cek katalog lalu susun balasan bila perlu.
 * Fail-open — error apa pun mengembalikan null supaya alur normal jalan terus.
 */
/**
 * Gerbang KOTA (M164) — dipanggil SEBELUM gerbang area, dan sebelum Q2c
 * ("di area mana?") pernah ditanyakan. Menjawab null bila kota memang ada di
 * katalog agent (pemanggil lanjut seperti biasa), atau bila cek gagal
 * (fail-open — jangan sampai gerbang non-kritis mematikan seluruh alur).
 *
 * @returns {Promise<{reply:string, verdict:'city-empty'}|null>}
 */
async function tryCityAvailabilityAnswer({
  userId, city, buildingType, transactionType, typeLabel = 'properti', isId = true,
}) {
  if (!userId || !city) return null;
  try {
    const chk = await checkCityAvailability({ userId, city, buildingType, transactionType });
    if (!chk.ok || chk.available) return null;   // kota ADA, atau cek gagal → lanjut normal
    return composeCityEmptyReply({
      city, typeLabel, transactionType, isId, alternativeCities: chk.alternativeCities,
    });
  } catch (err) {
    console.error('[CITY AVAILABILITY GATE ERROR]', err.message);
    return null;
  }
}

async function tryAreaAvailabilityAnswer({
  userId, city, area, buildingType, transactionType,
  typeLabel = 'properti', message = '', isId = true, persistedBudgetText = '',
}) {
  if (!userId || !area || !transactionType) return null;
  try {
    const requestedCount = detectRequestedCount(message);
    // require lokal: propertyRecommendationService besar dan saling terkait —
    // menariknya ke puncak file berisiko siklus require (sama pola dengan
    // fetchAreaListings di areaAvailabilityService.js).
    const { detectBudget } = require('../services/propertyRecommendationService');
    // M161: pesan SAAT INI didahulukan; qs.budget (state lintas-giliran) HANYA
    // dipakai bila pesan saat ini sendiri tidak menyebut budget sama sekali —
    // lihat catatan panjang di parsePersistedBudgetText() di atas untuk kasus
    // nyata yang membuktikan celah ini (listing 776.9 juta ditawarkan kepada
    // customer yang baru saja menyebut budget 600-700 juta).
    const budget = detectBudget(message) || parsePersistedBudgetText(persistedBudgetText);
    const hasBudget = budget && !budget.ambiguous && (Number.isFinite(budget.min) || Number.isFinite(budget.max));
    const av = await checkAreaAvailability({ userId, city, area, buildingType, transactionType });

    /* ── Stok ADA → LANGSUNG TAMPILKAN LISTING (M154) ──────────────────────
     * Versi M152 mengembalikan null di sini, artinya alur interview lanjut.
     * Transkrip 25 Agu 2026 menunjukkan akibatnya: customer minta listing
     * ENAM KALI ("Saya minta listing dlu", "Kak, ini saya minta listing dlu")
     * dan tiap kali dibalas pertanyaan berikutnya — budget, tanggal, penghuni,
     * fasilitas, KPR, DP, kondisi unit, furnitur. Permintaan customer kalah
     * dari agenda interview backend.
     *
     * Begitu tipe transaksi + tipe properti + kota + area sudah diketahui,
     * tidak ada alasan menahan listing: itu justru informasi yang membuat
     * customer bisa memutuskan. Slot sisanya (budget/tanggal/dst.) tetap bisa
     * ditanyakan SETELAH customer melihat barangnya.
     */
    if (av.ok && av.verdict === 'available') {
      const limit = requestedCount || DEFAULT_SHOWN;
      // M160: bila checkAreaAvailability() mengoreksi salah ketik ("Chandramas"
      // → "Candramas"), ambil listing untuk nama yang BENAR — bukan nama yang
      // diketik customer, yang memang tidak ada satu unit pun di katalog.
      const areaForListing = av.correctedArea || area;
      const rows  = await fetchAreaListings({
        userId, city, area: areaForListing, buildingType, transactionType, limit,
        minPrice: hasBudget ? budget.min : null,
        maxPrice: hasBudget ? budget.max : null,
      });

      if (!rows.length) {
        // Budget disebutkan tapi TIDAK SATU PUN listing area ini yang cocok —
        // jangan kirim ulang listing yang sudah ditolak customer sebagai
        // "kemahalan" (transkrip nyata 26 Agu 2026: "700-800 juta" ditanyakan
        // 2x, gerbang lama mengirim ulang 2 unit 1.15M/1.27M yang sama persis
        // tiap kali). Cari area LAIN di kota yang sama yang masuk budget dulu.
        if (!hasBudget) return null;               // fail-open: biarkan alur normal
        const cityId = await resolveCityId(city);
        const altAreas = await listAreasWithinBudget({
          userId, cityId, buildingType, transactionType,
          minPrice: budget.min, maxPrice: budget.max, excludeArea: area,
        });
        return composeBudgetEmptyReply({
          area, typeLabel, transactionType, isId, requestedCount,
          budgetLabel: budget.text, altAreas,
        });
      }

      // Format kartu dipinjam dari ResponseBuilderWhatsApp supaya identik
      // dengan listing yang dikirim jalur lain (bukan salinan format kedua).
      // require lokal: chatbotPrivateController besar & saling me-require —
      // menariknya ke puncak file berisiko siklus require.
      const { ResponseBuilderWhatsApp } = require('../controllers/chatbotPrivateController');
      const builder = new ResponseBuilderWhatsApp(isId ? 'id' : 'en');
      const cards   = builder.renderListingCards(
        rows.map((r) => (typeof r.toJSON === 'function' ? r.toJSON() : r)), isId ? 'id' : 'en', limit
      );
      if (!cards || !cards.trim()) return null;

      // ⚠️ Tidak menyebut "diurutkan dari yang termurah" — itu detail internal
      // penyortiran, bukan informasi untuk customer (permintaan pemilik proyek,
      // 27 Agu 2026: "itu rahasia backend saja, AI cukup tampilkan data saja").
      const head = isId
        ? `Ini ${rows.length} ${typeLabel} ${txWord(transactionType, true)} di *${titleCaseArea(areaForListing)}* ya, Kak 😊\n\n`
        : `Here ${rows.length === 1 ? 'is' : 'are'} ${rows.length} ${typeLabel} ${txWord(transactionType, false)} in *${titleCaseArea(areaForListing)}* 😊\n\n`;
      const tail = isId
        ? `\n\nAda yang menarik, Kak? Kalau mau saya carikan yang lebih spesifik, boleh sebutkan budget atau kebutuhan lainnya.`
        : `\n\nAnything catch your eye? If you'd like something more specific, let me know your budget or other needs.`;

      return { reply: head + cards + tail, verdict: 'listings-shown', requestedCount };
    }

    /* M161: area yang diminta tidak ada / salah transaksi, TAPI budget sudah
     * diketahui → alternatif yang ditawarkan HARUS ikut disaring budget, bukan
     * sekadar "yang termurah di kota ini". Kasus nyata (uji coba "Tasha",
     * Gresik 600-700jt, area "Bunga Melati" tak ada): tanpa ini gerbang
     * menawarkan Driyorejo/Menganti dari harga TERMURAH KESELURUHAN — abai
     * pada budget yang baru saja disebutkan.
     */
    let avForReply = av;
    if (hasBudget && av.ok) {
      const cityId = await resolveCityId(city);
      const budgetAlts = await listAreasWithinBudget({
        userId, cityId, buildingType, transactionType,
        minPrice: budget.min, maxPrice: budget.max, excludeArea: area,
      });
      if (budgetAlts.length) avForReply = { ...av, alternativeAreas: budgetAlts };
    }

    return composeAvailabilityReply(avForReply, {
      area, typeLabel, transactionType, isId, requestedCount,
    });
  } catch (err) {
    console.error('[AREA AVAILABILITY GATE ERROR]', err.message);
    return null;
  }
}

module.exports = {
  tryCityAvailabilityAnswer,
  composeCityEmptyReply,
  tryAreaAvailabilityAnswer,
  composeAvailabilityReply,
  composeBudgetEmptyReply,
  customerAsksAvailability,
  detectRequestedCount,
  humanPrice,
  DEFAULT_SHOWN,
  MAX_REQUESTED,
};

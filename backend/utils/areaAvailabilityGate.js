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
  // M198 (13 Sep 2026): "Ada yang di bawah 400 juta?", "Yang dekat Waru ada?",
  // "Ada apartemen sewa … dekat ITS?", "ada apa saja?", "yang 3 kamar ada?"
  /\bada\s+yang\b/, /\byang\b[^.?!]{0,40}\bada\s*(?:\?|$)/, /\bada\s+apa\s+(?:saja|aja)\b/,
  /^\s*ada\s+(?:rumah|apartemen|apart|villa|ruko|kos|kantor|gudang|tanah|unit|properti)\b[^.?!]{0,80}\?/,
  /\bada\s+(?:rumah|apartemen|apart|villa|ruko|kos|kantor|gudang|tanah|unit|properti)\b[^.?!]{0,60}\b(?:di|dekat|deket|sekitar|area|daerah)\b[^.?!]{0,40}\?/,
  /\b(?:lihat|liat|tampilkan|carikan|cariin)\s+(?:\d{1,2}\s+)?(?:pilihan|unit|listing|opsi|lagi)\b/,
  // "Kalau yang dekat Buduran?" / "Kalau di Tropodo?" — menanyakan alternatif area.
  /\bkalau\s+(?:yang\s+)?(?:dekat|deket|sekitar|di)\s+[A-Za-z][\w' -]{2,30}\?/,
  // M199: "Pakuwon juga bagus ya, ada?", "Pakuwon Indah ada juga?", "Kalau Wiyung?"
  /\bada\s*(?:juga|jg|kah|nggak|ga|gak)?\s*\?\s*$/,
  /^\s*(?:kalau|klo|kl)\s+(?:di\s+|yang\s+di\s+)?(?!(?:nego|harga|budget|kpr|cash|sewa|beli|survei|survey|besok|nanti|foto|dp|jam|tanggal|itu|ini|saya|ada|yang)\b)[A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)?\s*\?\s*$/,
  // "Yang 3 kamar?" / "yang 2 lantai ada?" — saringan atribut = minta listing yang cocok.
  /\byang\s+\d{1,2}\s*(?:kamar|kt|km|lantai)\b[^.?!]{0,15}(?:\?|\bada\b)/,
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
  // M198b: "jangan kirim listing yang sama" / "tidak usah kasih data" = permintaan
  // BERHENTI, bukan minta listing.
  if (/\b(?:jangan|jgn|tidak\s+usah|tdk\s+usah|nggak\s+usah|gak\s+usah|ga\s+usah)\b[^.?!]{0,12}\b(?:kirim|kasih|tampilkan|minta|lihat|liat)\b/i.test(t)) return false;
  // M199: "Denah rumahnya ada?", "ada videonya?", "IMB-nya ada?" = dokumentasi unit, bukan minta listing.
  if (/\b(denah|foto\w*|video\w*|dokumen\w*|sertifikat\w*|imb|pbg|pbb|brosur|maps|patokan\w*|garasi|carport|kolam|ac)\b/i.test(t) && !/\b(listing|unit\s+lain|pilihan\s+lain|yang\s+lain|lainnya)\b/i.test(t)) return false;
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
    /* M193 — kota ada, TIPE tidak ("kos di Surabaya" padahal agent nol kos):
     * jujur + sebut tipe yang benar-benar dipegang di kota itu (doc 03). */
    if (chk.typeMissing) {
      // Label ringkas per tipe (tanpa me-require controller — hindari siklus require).
      const TYPE_ID = { house: 'Rumah', apartment: 'Apartemen', villa: 'Villa', hotel: 'Hotel', boarding_house: 'Kos-Kosan', shophouse: 'Ruko', office: 'Kantor', warehouse: 'Gudang', store: 'Toko', mansion: 'Mansion', kondotel: 'Kondotel', land: 'Tanah' };
      const TYPE_EN = { house: 'House', apartment: 'Apartment', villa: 'Villa', hotel: 'Hotel', boarding_house: 'Boarding House', shophouse: 'Shophouse', office: 'Office', warehouse: 'Warehouse', store: 'Store', mansion: 'Mansion', kondotel: 'Condotel', land: 'Land' };
      const humanType = (k) => (isId ? TYPE_ID : TYPE_EN)[String(k || '').toLowerCase()] || String(k || '');
      const have = (chk.availableTypes || []).slice(0, 3).map((t) => humanType(t.buildingType)).filter(Boolean);
      return {
        verdict: 'type-empty',
        reply: isId
          ? `Mohon maaf, Kak 🙏 Untuk *${typeLabel}* di *${chk.city || city}* belum ada di data saya.${have.length ? ` Yang saya pegang di ${chk.city || city}: *${have.join(', ')}*. Mau saya carikan dari itu?` : ''}`
          : `Sorry 🙏 I have no *${typeLabel}* listings in *${chk.city || city}* yet.${have.length ? ` What I do have there: *${have.join(', ')}*. Shall I look at those?` : ''}`,
      };
    }
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
  history = [], resetSent = false,
}) {
  if (!userId || !area || !transactionType) return null;
  try {
    const requestedCount = detectRequestedCount(message);
    /* M192 (12 Sep 2026) — KONTRAK PENGIRIMAN LISTING INKREMENTAL (arahan
     * pemilik proyek): listing yang SUDAH dikirim tidak pernah dikirim ulang.
     * Kirim ulang hanya bila customer mengganti area/kota/transaksi
     * (`resetSent`, dihitung pemanggil dari banner perubahan) — di luar itu:
     *   sudah 2, minta 5 → kirim 3 BARU · sudah 2, minta 3 → kirim 1 BARU ·
     *   tanpa angka → DEFAULT_SHOWN unit BARU. Semua yang sudah dikirim
     *   dibaca dari riwayat (listSentCards), bukan ditebak. */
    const { listSentCards, isRowAlreadySent } = require('./listingSelectionGate');
    const sentAll = listSentCards(history);
    // Area BARU (belum ada kartu area itu yang pernah dikirim) = customer
    // mengganti area → boleh mulai dari awal untuk area tersebut.
    const areaKey = String(area || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const areaIsNew = sentAll.areas.size > 0 && ![...sentAll.areas].some((a) => a.includes(areaKey) || areaKey.includes(a));
    const sent = (resetSent || areaIsNew) ? { addresses: new Set(), keys: new Set(), areas: new Set(), count: 0 } : sentAll;
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
      // Jumlah BARU yang harus dikirim: (diminta − sudah dikirim), minimal 0;
      // tanpa angka: DEFAULT_SHOWN unit yang belum pernah dikirim.
      const wantNew = requestedCount ? Math.max(0, requestedCount - sent.count) : DEFAULT_SHOWN;
      const limit = wantNew;
      // Balasan "sudah dikirim" / "tidak ada yang baru" hanya masuk akal bila customer
      // memang MEMINTA listing; pada pesan lain (budget, penghuni) biarkan alur normal.
      const asksListings = customerAsksAvailability(message) || Boolean(requestedCount);
      if (requestedCount && wantNew === 0) {
        const reply = isId
          ? `Kak, ${sent.count} listing itu sudah saya kirim sebelumnya ya 😊 Mau saya tambahkan yang lain lagi, atau ada yang menarik dari yang sudah ada?`
          : `I've already sent you ${sent.count} listings 😊 Want me to add more, or did any of them catch your eye?`;
        return { reply, verdict: 'already-sent', requestedCount };
      }
      // M160: bila checkAreaAvailability() mengoreksi salah ketik ("Chandramas"
      // → "Candramas"), ambil listing untuk nama yang BENAR — bukan nama yang
      // diketik customer, yang memang tidak ada satu unit pun di katalog.
      const areaForListing = av.correctedArea || area;
      // Ambil lebih banyak lalu buang yang sudah dikirim, sisakan `limit` yang BARU.
      const rowsAll = await fetchAreaListings({
        userId, city, area: areaForListing, buildingType, transactionType, limit: 10,   // cukup untuk mengetahui stok nyata (shortfall) & membuang yang sudah terkirim
        minPrice: hasBudget ? budget.min : null,
        maxPrice: hasBudget ? budget.max : null,
      });
      /* M193 (14 Sep 2026) — UTAMAKAN ALAMAT YANG BERBEDA dalam satu kiriman.
       * Data agent punya alamat kembar (Candramas No. 89 dipakai 4 listing
       * berbeda): dua kartu berjudul & beralamat sama persis, beda harga saja,
       * terbaca customer sebagai kiriman ganda. Baris beralamat sama hanya
       * dipakai bila kartu beralamat unik sudah habis. */
      const fresh = rowsAll.filter((r) => !isRowAlreadySent(typeof r.toJSON === 'function' ? r.toJSON() : r, sent));
      const seenAddr = new Set([...(sent.addresses || [])].map((a) => String(a).toLowerCase()));
      const distinct = []; const dupes = [];
      for (const r of fresh) {
        const j = typeof r.toJSON === 'function' ? r.toJSON() : r;
        const key = String(j.address || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (key && seenAddr.has(key)) dupes.push(r); else { if (key) seenAddr.add(key); distinct.push(r); }
      }
      const rows = [...distinct, ...dupes].slice(0, limit);

      if (!rows.length && rowsAll.length && sent.count && !asksListings) return null;   // M198
      if (!rows.length && rowsAll.length && sent.count) {
        // Semua yang cocok sudah pernah dikirim — katakan apa adanya (doc 03
        // "Nothing new left -> say so"), jangan kirim ulang.
        const reply = isId
          ? `Untuk kriteria itu, semua ${rowsAll.length} unit di *${titleCaseArea(areaForListing)}* sudah pernah saya kirim, Kak 🙏 Ada yang menarik dari yang sudah ada, atau mau coba area/kriteria lain?`
          : `All ${rowsAll.length} matching units in *${titleCaseArea(areaForListing)}* were already sent 🙏 Did any catch your eye, or shall we try another area?`;
        return { reply, verdict: 'nothing-new', requestedCount };
      }

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
      // M197: nomor kartu BERLANJUT dari jumlah yang sudah terkirim (2 lama → 3, 4, 5).
      const cards   = builder.renderListingCards(
        rows.map((r) => (typeof r.toJSON === 'function' ? r.toJSON() : r)), isId ? 'id' : 'en', limit, sent.count
      );
      if (!cards || !cards.trim()) return null;

      // ⚠️ Tidak menyebut "diurutkan dari yang termurah" — itu detail internal
      // penyortiran, bukan informasi untuk customer (permintaan pemilik proyek,
      // 27 Agu 2026: "itu rahasia backend saja, AI cukup tampilkan data saja").
      /* M193 — STOK KURANG DARI PERMINTAAN: minta 5, agent hanya punya 4 →
       * minta maaf, sebut jumlah nyata, kirim yang BARU saja (2 lama + 2 baru).
       * Total nyata = yang sudah terkirim + yang cocok & belum terkirim. */
      const totalAvailable = sent.count + rowsAll.filter((r) => !isRowAlreadySent(typeof r.toJSON === 'function' ? r.toJSON() : r, sent)).length;
      const shortfall = requestedCount && totalAvailable < requestedCount;
      const sorry = shortfall
        ? (isId
          ? `Mohon maaf, Kak 🙏 listing ${typeLabel} ${txWord(transactionType, true)} di *${titleCaseArea(areaForListing)}* hanya ada ${totalAvailable} saja${sent.count ? ` (${sent.count} sudah dikirim sebelumnya)` : ''}. `
          : `Sorry, Kak 🙏 I only have ${totalAvailable} matching units in *${titleCaseArea(areaForListing)}*${sent.count ? ` (${sent.count} already sent)` : ''}. `)
        : '';
      const head = isId
        ? `${sorry}Ini ${rows.length} ${typeLabel} ${txWord(transactionType, true)}${sent.count ? ' TAMBAHAN' : ''} di *${titleCaseArea(areaForListing)}* ya, Kak 😊\n\n`
        : `${sorry}Here ${rows.length === 1 ? 'is' : 'are'} ${rows.length} ${typeLabel} ${txWord(transactionType, false)}${sent.count ? ' more' : ''} in *${titleCaseArea(areaForListing)}* 😊\n\n`;
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

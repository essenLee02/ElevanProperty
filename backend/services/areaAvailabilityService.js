'use strict';
/**
 * areaAvailabilityService.js — jawab "ada apartemen di Pakuwon?" dengan FAKTA (M152)
 * ---------------------------------------------------------------------------------
 * Directive pemilik proyek (25 Agu 2026), dari transkrip nyata:
 *   "AI tidak memberikan data secara real dan sesuai permintaan customer. Jika
 *    AI tdk memiliki datanya di database, AI harus tanya apakah customer mau
 *    alternatif area lain. Namun AI tdk melakukan itu, malah AI memberikan
 *    apartemen di area lain, seharusnya AI bertanya dahulu, tidak boleh menebak."
 *
 * KEJADIAN NYATA YANG DITANGANI
 * Customer minta SEWA apartemen di Pakuwon, Surabaya. Di katalog agent, Pakuwon
 * punya 19 apartemen — SEMUANYA DIJUAL, nol disewakan. AI lama tidak pernah
 * memeriksa itu: ia terus meng-interview, lalu diam-diam mengirim listing dari
 * Bulak/Kalijudan/Karang Pilang seolah-olah itu Pakuwon. Dua kesalahan sekaligus
 * (menebak area, dan tidak mengaku barangnya tidak ada).
 *
 * YANG DIKEMBALIKAN — FAKTA SAJA, BUKAN KALIMAT
 * Service ini sengaja tidak menyusun balasan. Ia hanya menjawab:
 *   • ada berapa unit persis di area+transaksi yang diminta?  (exact)
 *   • kalau nol, apakah ada di area itu dengan transaksi LAIN? (crossTransaction)
 *   • area mana saja yang BENAR-BENAR punya stok untuk transaksi ini?
 *     (alternativeAreas — diurut termurah, karena itu yang paling menolong)
 * Penyusun kalimat (Private Agent atau prompt LLM) yang memutuskan kata-katanya.
 * Dengan begitu satu sumber fakta dipakai kedua jalur, tidak ada dua versi.
 *
 * ⚠️ SELALU per-agent (user_id). Katalog agent lain tidak boleh bocor.
 */

const { Op, fn, col, literal } = require('sequelize');
const { Property, City, PropertyLocation, Location } = require('../models');

/** Berapa area alternatif yang ditawarkan sekaligus — cukup untuk memilih, tidak membanjiri. */
const MAX_ALT_AREAS = 6;

/** Normalisasi longgar: "Pakuwon City" ~ "pakuwon", "Darmo Permai" ~ "darmo permai". */
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Transaksi lawan. Dipakai untuk menjawab "sewa tidak ada, tapi ADA yang dijual".
 * Nilai mengikuti kolom properties.transaction_type ('Sale' / 'Rent').
 */
const OTHER_TX = { Sale: 'Rent', Rent: 'Sale' };

/**
 * Cari city_id dari nama kota. Mengembalikan null bila kota tidak dikenal —
 * pemanggil harus memperlakukan itu sebagai "tidak bisa memastikan", BUKAN
 * sebagai "tidak ada stok" (dua hal yang sangat berbeda bagi customer).
 */
async function resolveCityId(cityName) {
  if (!cityName) return null;
  const city = await City.findOne({
    where: { name: { [Op.like]: String(cityName).trim() }, status: 1 },
    attributes: ['city_id'],
  });
  return city ? city.city_id : null;
}

/**
 * ⚠️ "DI Pakuwon" ≠ "DEKAT Pakuwon" — dan menyamakannya persis melahirkan
 * kebohongan yang dikeluhkan pemilik proyek.
 *
 * Versi pertama service ini menggabungkan dua sumber: kolom properties.area DAN
 * tautan property_locations. Hasilnya "sewa apartemen Pakuwon = 2" — padahal
 * nol. Dua unit itu ada di Bulak/Kalijudan yang kebetulan DITANDAI berpatokan
 * "Pakuwon City". Kalau digabung, AI akan bilang "ada 2 apartemen sewa di
 * Pakuwon" lalu mengirim listing Bulak — tepat kesalahan yang sedang diperbaiki.
 *
 * Karena itu keduanya dipisah dan diberi label berbeda:
 *   • exact   → HANYA kolom properties.area. Ini yang boleh disebut "di X".
 *   • nearby  → lewat patokan. Hanya boleh disebut sebagai "dekat X", dan hanya
 *               kalau customer memang menerima tawaran itu.
 */
function areaWhere(area) {
  return { area: { [Op.like]: `%${String(area).trim()}%` } };
}

async function propertyIdsNearLocation(area, cityId, userId) {
  const locs = await Location.findAll({
    where: { status: 1, name: { [Op.like]: `%${String(area).trim()}%` } },
    attributes: ['location_id'],
  });
  if (!locs.length) return [];
  const links = await PropertyLocation.findAll({
    where: { location_id: { [Op.in]: locs.map((l) => l.location_id) } },
    attributes: ['property_id'],
  });
  if (!links.length) return [];
  const rows = await Property.findAll({
    where: {
      property_id: { [Op.in]: links.map((l) => l.property_id) },
      user_id: userId, status: 1, ...(cityId ? { city_id: cityId } : {}),
    },
    attributes: ['property_id'],
  });
  return rows.map((r) => r.property_id);
}

/**
 * Hitung stok untuk satu kombinasi area + transaksi + tipe bangunan.
 * @returns {{count:number, minPrice:number|null}}
 */
async function countIn({ userId, cityId, area, buildingType, transactionType, ids = null }) {
  const where = {
    user_id: userId, status: 1,
    ...(cityId ? { city_id: cityId } : {}),
    ...(buildingType ? { building_type: buildingType } : {}),
    ...(transactionType ? { transaction_type: transactionType } : {}),
    // `ids` = mode "dekat" (daftar property_id dari patokan). Tanpa itu, mode
    // "di" — murni kolom area. Tidak pernah dua-duanya sekaligus (lihat catatan
    // di atas fungsi propertyIdsNearLocation).
    ...(ids ? { property_id: { [Op.in]: ids.length ? ids : ['__none__'] } } : areaWhere(area)),
  };

  const rows = await Property.findAll({
    where,
    attributes: [[fn('COUNT', col('id')), 'n'], [fn('MIN', col('price')), 'mn']],
    raw: true,
  });
  const r = rows[0] || {};
  return { count: Number(r.n || 0), minPrice: r.mn === null || r.mn === undefined ? null : Number(r.mn) };
}

/**
 * Area yang BENAR-BENAR punya stok untuk transaksi & tipe yang diminta.
 * Diurut harga termurah lebih dulu (permintaan pemilik proyek: "Berikan datanya
 * dari harga yang termurah dulu kepada customer").
 */
async function listAlternativeAreas({ userId, cityId, buildingType, transactionType, excludeArea }) {
  const rows = await Property.findAll({
    where: {
      user_id: userId, status: 1,
      ...(cityId ? { city_id: cityId } : {}),
      ...(buildingType ? { building_type: buildingType } : {}),
      ...(transactionType ? { transaction_type: transactionType } : {}),
      area: { [Op.ne]: null },
    },
    attributes: ['area', [fn('COUNT', col('id')), 'n'], [fn('MIN', col('price')), 'mn']],
    group: ['area'],
    order: [[literal('mn'), 'ASC']],
    raw: true,
  });

  const skip = norm(excludeArea);
  return rows
    .filter((r) => r.area && String(r.area).trim())
    // Buang area yang diminta customer (termasuk kecocokan sebagian: customer
    // minta "Pakuwon", area "Pakuwon City" jangan ditawarkan sebagai alternatif
    // — bagi customer itu tempat yang sama).
    .filter((r) => {
      const a = norm(r.area);
      return !skip || (!a.includes(skip) && !skip.includes(a));
    })
    .slice(0, MAX_ALT_AREAS)
    .map((r) => ({ area: r.area, count: Number(r.n), minPrice: r.mn === null ? null : Number(r.mn) }));
}

/**
 * PEMERIKSAAN UTAMA.
 *
 * @param {object} p
 * @param {string} p.userId          agent pemilik katalog (WAJIB)
 * @param {string} [p.city]          nama kota, mis. 'Surabaya'
 * @param {string} p.area            area yang ditanyakan customer, mis. 'Pakuwon'
 * @param {string} [p.buildingType]  'Apartment' | 'House' | ...
 * @param {string} [p.transactionType] 'Sale' | 'Rent'
 * @returns {Promise<{
 *   ok: boolean, area: string, city: string|null,
 *   exact: {count:number, minPrice:number|null},
 *   crossTransaction: {transactionType:string, count:number, minPrice:number|null}|null,
 *   alternativeAreas: Array<{area:string,count:number,minPrice:number|null}>,
 *   verdict: 'available'|'wrong-transaction'|'area-empty'|'unknown'
 * }>}
 */
async function checkAreaAvailability({ userId, city, area, buildingType, transactionType }) {
  const base = {
    ok: false, area: area || '', city: city || null,
    exact: { count: 0, minPrice: null }, crossTransaction: null,
    nearby: { count: 0, minPrice: null },
    alternativeAreas: [], verdict: 'unknown',
  };
  if (!userId || !area) return base;

  try {
    const cityId = await resolveCityId(city);

    // "DI area itu" — kolom properties.area saja.
    const exact = await countIn({ userId, cityId, area, buildingType, transactionType });
    if (exact.count > 0) {
      return { ...base, ok: true, exact, verdict: 'available' };
    }

    // Nol untuk transaksi yang diminta → apakah area ini punya stok dengan
    // transaksi LAIN? Inilah kasus Pakuwon: sewa nol, dijual 19.
    let crossTransaction = null;
    const other = OTHER_TX[transactionType];
    if (other) {
      const cross = await countIn({ userId, cityId, area, buildingType, transactionType: other });
      if (cross.count > 0) crossTransaction = { transactionType: other, ...cross };
    }

    // "DEKAT area itu" — lewat patokan. Dilaporkan TERPISAH; pemanggil wajib
    // menyebutnya "dekat", tidak boleh dijual sebagai "di".
    const nearIds = await propertyIdsNearLocation(area, cityId, userId);
    const nearby = nearIds.length
      ? await countIn({ userId, cityId, area, buildingType, transactionType, ids: nearIds })
      : { count: 0, minPrice: null };

    const alternativeAreas = await listAlternativeAreas({
      userId, cityId, buildingType, transactionType, excludeArea: area,
    });

    return {
      ...base, ok: true, exact, crossTransaction, nearby, alternativeAreas,
      verdict: crossTransaction ? 'wrong-transaction' : 'area-empty',
    };
  } catch (err) {
    // Fail-open: lebih baik AI melanjutkan alur normal daripada percakapan mati
    // hanya karena pemeriksaan ketersediaan gagal.
    console.error('[AREA AVAILABILITY ERROR]', err.message);
    return base;
  }
}

/**
 * Pisahkan mana KOTA dan mana AREA dari beberapa calon string.
 *
 * Perlu karena slot hulu tidak bisa dipercaya namanya: pada transkrip nyata
 * extractQualificationState() mengembalikan `city = 'pakuwon'` (padahal Pakuwon
 * itu area) dan `district = null`. Kalau gerbang menelan itu mentah-mentah, ia
 * akan mencari kota bernama "Pakuwon", tidak menemukannya, lalu gagal senyap.
 *
 * Aturan: calon yang benar-benar ADA di tabel `cities` adalah kota; calon
 * pertama yang BUKAN kota diperlakukan sebagai area.
 *
 * @param {string[]} candidates urut dari yang paling dipercaya
 * @returns {Promise<{city:string|null, area:string|null}>}
 */
/**
 * Apakah string ini masuk akal sebagai NAMA TEMPAT, bukan kalimat?
 *
 * ⚠️ Penjaga wajib. Slot hulu kadang berisi KALIMAT MENTAH customer, bukan
 * nama area. Terbukti di produksi: kandidat area berisi
 * "Hi... Saya beli apartemen Surabaya, Kutisari" sehingga balasannya berbunyi
 * "apartemen dijual di *Hi... Saya beli apartemen Surabaya, Kutisari* belum
 * ada" — memalukan di depan customer, dan pencarian katalog pasti gagal karena
 * tidak ada area bernama begitu.
 *
 * Nama tempat Indonesia praktis selalu ≤ 4 kata ("Pakuwon City", "Darmo
 * Permai", "Dukuh Kupang Barat") dan tidak memuat tanda kalimat.
 */
function looksLikePlaceName(v) {
  const s = String(v || '').trim();
  if (!s || s.length > 40) return false;
  if (/[?!]|\.{2,}|,/.test(s)) return false;            // tanda kalimat/daftar
  if (s.split(/\s+/).length > 4) return false;          // terlalu panjang untuk nama area
  // Kata kerja/intent yang menandakan ini kalimat, bukan tempat.
  if (/\b(saya|aku|mau|ingin|cari|beli|sewa|minta|tolong|apakah|ada|butuh|hi|halo)\b/i.test(s)) return false;
  return true;
}

async function resolveCityAndArea(candidates = []) {
  const seen = [];
  for (const raw of candidates) {
    const v = String(raw || '').trim();
    if (v && looksLikePlaceName(v) && !seen.some((s) => norm(s) === norm(v))) seen.push(v);
  }
  if (!seen.length) return { city: null, area: null };

  const rows = await City.findAll({
    where: { status: 1, name: { [Op.in]: seen.map((s) => s.toUpperCase()) } },
    attributes: ['name'],
  });
  const cityNames = new Set(rows.map((r) => norm(r.name)));

  const city = seen.find((s) => cityNames.has(norm(s))) || null;
  const area = seen.find((s) => !cityNames.has(norm(s))) || null;
  return { city, area };
}

/**
 * Ambil listing NYATA untuk area+transaksi+tipe, TERMURAH DULU (M154).
 *
 * Directive pemilik proyek (26 Agu 2026):
 *   "Ketika AI mendapatkan informasi tipe transaksi, tipe property, lokasi area
 *    dan kota; AI langsung memberikan 2 listing-an sesuai info ke customer.
 *    Kalau customer langsung minta 4 listing-an, AI langsung memberikan 4."
 *
 * Sebelumnya gerbang ketersediaan hanya bersuara saat stok KOSONG; saat stok
 * ADA ia diam dan alur interview lanjut — persis keluhan customer yang minta
 * listing enam kali dan tetap ditanyai budget/tanggal/penghuni.
 *
 * ⚠️ WAJIB mengembalikan bentuk TERNORMALISASI, bukan baris Sequelize mentah.
 * Versi pertama fungsi ini memakai Property.findAll() dan hasilnya diumpankan
 * ke renderListingCards() — kartu yang keluar rusak dan sempat lolos ke jalur
 * balasan customer:
 *     📍 Lokasi: -
 *     💰 Estimasi Harga: *360000000.0000*     ← angka mentah, bukan "360 juta"
 *     🏠 Tipe: Properti — Tersedia            ← tipe/transaksi gagal diterjemahkan
 *     📐 Luas: bangunan -, tanah -
 *     🏷️ Fasilitas: -                         ← fasilitas ada di tabel lain
 * Penyebabnya: renderListingCards() menunggu bentuk hasil _queryProperties()
 * (price sudah string "360 juta", facilities sudah digabung, imageUrl sudah
 * di-resolve), sedangkan model Property mentah tidak punya satu pun di antaranya.
 *
 * Karena itu sumbernya sekarang getDbPropertiesForAgent() — katalog agent yang
 * SUDAH ternormalisasi dan sudah di-cache (5 menit), jadi ini juga tidak
 * menambah query DB per pesan. Penyaringan dilakukan di memori atas cache itu.
 *
 * @returns {Promise<Array>} properti ternormalisasi, siap dirender
 */
async function fetchAreaListings({ userId, city, area, buildingType, transactionType, limit = 2 }) {
  if (!userId || !area) return [];
  try {
    // require lokal: propertyRecommendationService besar dan saling terkait —
    // menariknya ke puncak file berisiko siklus require.
    const { getDbPropertiesForAgent } = require('./propertyRecommendationService');
    const rows = await getDbPropertiesForAgent(userId);
    if (!Array.isArray(rows) || !rows.length) return [];

    const wantArea = norm(area);
    const wantType = norm(buildingType);      // 'Apartment' → 'apartment'
    const wantTx   = norm(transactionType);   // 'Sale' → 'sale'
    const wantCity = norm(city);

    const matched = rows.filter((r) => {
      if (wantArea && !norm(r.area).includes(wantArea)) return false;
      if (wantType && norm(r.buildingType) !== wantType) return false;
      if (wantTx   && norm(r.transactionType) !== wantTx) return false;
      // Kota dicocokkan longgar: r.city/r.location kadang "SURABAYA", kadang
      // kosong pada baris lama. Kalau kosong, jangan buang — area sudah cukup
      // menyempitkan dan membuang baris valid lebih merugikan customer.
      if (wantCity && norm(r.city) && norm(r.city) !== wantCity) return false;
      return true;
    });

    // Termurah dulu — permintaan eksplisit pemilik proyek. priceValue numerik
    // hasil normalisasi; baris tanpa harga ditaruh terakhir, bukan dianggap 0
    // (harga 0 akan menempatkan listing "harga belum diisi" di posisi teratas).
    matched.sort((a, b) => {
      const pa = Number.isFinite(Number(a.priceValue)) && Number(a.priceValue) > 0 ? Number(a.priceValue) : Infinity;
      const pb = Number.isFinite(Number(b.priceValue)) && Number(b.priceValue) > 0 ? Number(b.priceValue) : Infinity;
      return pa - pb;
    });

    return matched.slice(0, Math.max(1, Math.min(Number(limit) || 2, 10)));
  } catch (err) {
    console.error('[FETCH AREA LISTINGS ERROR]', err.message);
    return [];
  }
}

/**
 * Cari nama AREA milik agent yang benar-benar muncul di dalam teks (M155).
 *
 * Kenapa perlu: slot hulu tidak melihat area yang disebut di pesan PERTAMA
 * customer. Transkrip 25 Agu 2026 dibuka dengan
 *   "Hi... Saya mau beli apartemen di Surabaya, Kutisari"
 * — keempat slot ada dalam satu kalimat, tapi filters.location hanya menangkap
 * "Surabaya" dan tidak ada satu pun slot yang berisi "Kutisari". Akibatnya bot
 * menjawab "di area atau kawasan mana di Surabaya?" — menanyakan hal yang baru
 * saja disebut customer di kalimat yang sama. Itu langsung terbaca sebagai
 * "tidak menyimak", dan memang begitu adanya.
 *
 * Dicocokkan ke daftar area NYATA milik agent (bukan tebak-tebakan dari
 * potongan kalimat), dan yang TERPANJANG menang supaya "Pakuwon City" tidak
 * kalah oleh "Pakuwon".
 */
async function findAreaInText({ userId, city, text }) {
  const t = String(text || '').toLowerCase();
  if (!userId || !t.trim()) return null;
  try {
    const cityId = await resolveCityId(city);
    const rows = await Property.findAll({
      where: {
        user_id: userId, status: 1,
        ...(cityId ? { city_id: cityId } : {}),
        area: { [Op.ne]: null },
      },
      attributes: ['area'],
      group: ['area'],
      raw: true,
    });
    const hits = rows
      .map((r) => String(r.area || '').trim())
      .filter((a) => a && t.includes(a.toLowerCase()))
      .sort((a, b) => b.length - a.length);
    return hits[0] || null;
  } catch (err) {
    console.error('[FIND AREA IN TEXT ERROR]', err.message);
    return null;
  }
}

module.exports = {
  checkAreaAvailability,
  fetchAreaListings,
  findAreaInText,
  resolveCityAndArea,
  listAlternativeAreas,
  resolveCityId,
  MAX_ALT_AREAS,
};

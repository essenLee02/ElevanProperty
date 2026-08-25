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
async function resolveCityAndArea(candidates = []) {
  const seen = [];
  for (const raw of candidates) {
    const v = String(raw || '').trim();
    if (v && !seen.some((s) => norm(s) === norm(v))) seen.push(v);
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

module.exports = {
  checkAreaAvailability,
  resolveCityAndArea,
  listAlternativeAreas,
  resolveCityId,
  MAX_ALT_AREAS,
};

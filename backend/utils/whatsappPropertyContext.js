/**
 * whatsappPropertyContext.js
 *
 * Ambil konteks properti untuk AI reply di WhatsApp.
 *
 * Prioritas:
 *   1. Rumah123 live data (jika APIFY_API_TOKEN tersedia dan quota ada)
 *   2. Fallback: backend/asset/json_data/indonesia_property_36_provinces_flat.json
 *
 * Digunakan oleh: fonnteChatController, watiChatController, dialogChatController
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const {
  getRumah123Listings,
  formatRumah123ContextForLLM,
  mapBuildingTypeToApify,
  mapTransactionTypeToApify,
} = require('../services/rumah123ContextService');

const {
  extractLocationFromMessage,
  extractPropertyTypeFromMessage,
  extractTransactionTypeFromMessage,
} = require('./propertyKeywordFilter');

/* ── Path ke flat JSON ───────────────────────────────────────────────────── */

const FLAT_JSON_PATH = path.resolve(
  __dirname,
  '../asset/json_data/indonesia_property_36_provinces_flat.json'
);

/* ── Cache sederhana untuk flat JSON (load sekali saja) ─────────────────── */

let _flatJsonCache = null;

function loadFlatJson() {
  if (_flatJsonCache) return _flatJsonCache;
  try {
    const raw  = fs.readFileSync(FLAT_JSON_PATH, 'utf8');
    const data = JSON.parse(raw);
    _flatJsonCache = data.properties || [];
    console.log(`[PropertyContext] Flat JSON loaded: ${_flatJsonCache.length} properties`);
  } catch (err) {
    console.error('[PropertyContext] Gagal load flat JSON:', err.message);
    _flatJsonCache = [];
  }
  return _flatJsonCache;
}

/* ── Filter dan format dari flat JSON ───────────────────────────────────── */

/**
 * Cari properti dari flat JSON berdasarkan lokasi, tipe, transaksi.
 * Mengembalikan max 8 hasil yang paling relevan.
 */
function searchFlatJson(location = '', propertyType = '', transactionType = '') {
  const all = loadFlatJson();
  if (!all.length) return [];

  const locLower  = location.toLowerCase().trim();
  const typeLower = propertyType.toLowerCase().trim();
  const txLower   = transactionType.toLowerCase().trim();

  let results = all.filter(p => {
    const pCity     = (p.location?.city     || '').toLowerCase();
    const pProvince = (p.location?.province || '').toLowerCase();
    const pArea     = (p.location?.area     || '').toLowerCase();
    const pType     = (p.building_type      || '').toLowerCase();
    const pTx       = (p.transaction_type   || '').toLowerCase();

    // Filter lokasi (jika ada)
    const locMatch = !locLower
      || pCity.includes(locLower)     || locLower.includes(pCity)
      || pProvince.includes(locLower) || locLower.includes(pProvince)
      || pArea.includes(locLower);

    // Filter tipe properti (jika ada)
    const typeMatch = !typeLower || pType.includes(typeLower);

    // Filter transaksi (sale/rent)
    const txMap = { sale: ['purchase','sale','buy','jual'], rent: ['rent','sewa','rental'] };
    const txMatch = !txLower
      || (txLower === 'sale' && txMap.sale.some(k => pTx.includes(k)))
      || (txLower === 'rent' && txMap.rent.some(k => pTx.includes(k)));

    return locMatch && typeMatch && txMatch;
  });

  // Kalau tidak ada hasil dengan filter ketat, relax ke lokasi saja
  if (!results.length && locLower) {
    results = all.filter(p => {
      const pCity     = (p.location?.city     || '').toLowerCase();
      const pProvince = (p.location?.province || '').toLowerCase();
      return pCity.includes(locLower) || locLower.includes(pCity)
          || pProvince.includes(locLower);
    });
  }

  // Kalau masih kosong, kembalikan sampel acak
  if (!results.length) {
    results = all.slice(0, 20);
  }

  // Ambil max 8
  return results.slice(0, 8);
}

/**
 * Format hasil flat JSON ke teks untuk LLM prompt.
 */
function formatFlatJsonForLLM(properties) {
  if (!properties.length) return '';

  const lines = [
    `DATA PROPERTI LOKAL (backend/asset/json_data) — ${properties.length} listing:`,
    `Sumber: Katalog properti lokal Elevan Property`,
    '',
  ];

  properties.forEach((p, i) => {
    const loc = [p.location?.area, p.location?.city, p.location?.province]
      .filter(Boolean).join(', ');
    const tx  = p.transaction_type || '';
    const tp  = p.building_type    || '';
    const fac = Array.isArray(p.facilities) ? p.facilities.join(', ') : (p.facilities || '');

    lines.push(
      `${i + 1}. ${p.title}`,
      `   📍 Lokasi   : ${loc || p.address || '-'}`,
      `   💰 Harga    : ${p.price || '-'}`,
      `   🏠 Tipe     : ${tp} — ${tx}`,
      `   📐 Luas     : bangunan ${p.building_area || '-'}, tanah ${p.land_area || '-'}`,
      `   ✨ Fasilitas: ${fac || '-'}`,
      ''
    );
  });

  lines.push('END OF LOCAL PROPERTY DATA');
  return lines.join('\n');
}

/* ── Fungsi utama — dipanggil dari controller ────────────────────────────── */

/**
 * Ambil property context string untuk diinjeksi ke AI prompt.
 *
 * Alur:
 *   1. Ekstrak lokasi, tipe, transaksi dari pesan customer
 *   2. Coba Rumah123 live data (Apify)
 *   3. Jika gagal/kosong → gunakan flat JSON
 *
 * @param {string} customerMessage - Isi pesan customer
 * @returns {Promise<{ contextText: string, source: 'rumah123'|'flat_json'|'none' }>}
 */
async function getWhatsappPropertyContext(customerMessage) {
  const location        = extractLocationFromMessage(customerMessage);
  const propertyType    = extractPropertyTypeFromMessage(customerMessage);
  const transactionType = extractTransactionTypeFromMessage(customerMessage);

  console.log(`[PropertyContext] Params — location: "${location}" | type: "${propertyType}" | tx: "${transactionType}"`);

  // ── Coba Rumah123 live data ──────────────────────────────────────────────
  const apifyToken         = process.env.APIFY_API_TOKEN;
  const apifyReady         = apifyToken && apifyToken !== 'isi_apify_token_anda';
  const rumah123DataEnabled = String(process.env.RUMAH123_DATA || 'ON').toUpperCase() === 'ON';

  if (apifyReady && rumah123DataEnabled) {
    try {
      const listings = await getRumah123Listings({
        location,
        propertyType : mapBuildingTypeToApify(propertyType),
        listingType  : mapTransactionTypeToApify(transactionType) || 'sale',
      });

      if (listings && listings.length > 0) {
        const contextText = formatRumah123ContextForLLM(listings);
        console.log(`[PropertyContext] ✅ Rumah123: ${listings.length} listings`);
        return { contextText, source: 'rumah123', location, propertyType, transactionType };
      }
      console.log(`[PropertyContext] Rumah123 returned 0 listings → fallback to flat JSON`);
    } catch (err) {
      console.warn(`[PropertyContext] Rumah123 error: ${err.message} → fallback to flat JSON`);
    }
  } else {
    if (!rumah123DataEnabled) {
      console.log(`[PropertyContext] RUMAH123_DATA=OFF → langsung flat JSON`);
    } else {
      console.log(`[PropertyContext] Apify token tidak tersedia → flat JSON`);
    }
  }

  // ── Fallback: flat JSON ──────────────────────────────────────────────────
  const properties  = searchFlatJson(location, propertyType, transactionType);
  const contextText = formatFlatJsonForLLM(properties);
  console.log(`[PropertyContext] ✅ Flat JSON: ${properties.length} properties (location: "${location}")`);

  return { contextText, source: 'flat_json', location, propertyType, transactionType };
}

module.exports = { getWhatsappPropertyContext };

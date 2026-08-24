'use strict';
/**
 * agentCoverageService.js — "apa yang SEBENARNYA dimiliki agent ini?" (M133)
 *
 * ⛔ BACA INI SEBELUM MENGUBAH: modul ini SENGAJA hanya MENYEDIAKAN FAKTA,
 * TIDAK PERNAH MEMUTUSKAN BALASAN.
 *
 * Directive pemilik proyek (24 Agu 2026, penegasan ulang M131): saat
 * AI_PRIMARY_PROVIDER bukan 'private', SEMUA keputusan balas/diam/isi-balasan
 * ada di tangan platform API (ChatGPT/Kimi/Claude/Qwen/DeepSeek) yang dipandu
 * skill .md — backend TIDAK boleh ikut menentukan responsnya.
 *
 * Tapi LLM TIDAK BISA menjawab "saya punya listing di kota mana saja?" atau
 * "area Gunawangsa kosong, adanya Kebomas" tanpa DATA — dan mengarang jawaban
 * itu persis kelas bug M84/M96 (AI mengarang nama area) yang sudah mahal
 * diperbaiki. Jadi pembagiannya:
 *
 *   Backend (modul ini) : MENGAMBIL fakta dari DB — kota mana yang ada stok,
 *                         area mana yang ada isinya, rentang harga nyata.
 *   Platform AI         : MEMUTUSKAN kalimatnya, urutannya, mau menawarkan
 *                         kota lain atau tidak, mau diam atau tidak.
 *
 * Ini pola yang SAMA PERSIS dengan facilityContext/cityContext/ragContext yang
 * sudah ada (aiContextService.js) — konteks masuk lewat `extraContext`, bukan
 * lewat cabang keputusan di controller.
 *
 * ⚠️ Semua query di sini di-scope `user_id` (agent pemilik nomor WA). Katalog
 * antar-agent TIDAK PERNAH bocor — aturan per-agent scoping doc 08 §2.
 */

const { Op } = require('sequelize');

/** TTL cache — coverage jarang berubah dalam satu percakapan. */
const _cache = new Map();
const CACHE_TTL_MS = Number(process.env.AGENT_COVERAGE_TTL_MS || 5 * 60 * 1000);

function _cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return hit.value;
}
function _cacheSet(key, value) { _cache.set(key, { at: Date.now(), value }); }

/** Title-case nama kota DB (disimpan UPPERCASE) agar enak dibaca di chat. */
function _titleCase(s) {
  return String(s || '').replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function _fmtRp(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

/**
 * Ambil peta coverage agent: kota → tipe → { count, minPrice, maxPrice, areas[] }.
 *
 * @param {string} agentUserId users.user_id pemilik nomor WA
 * @returns {Promise<object|null>} null bila agentUserId kosong / query gagal
 *   (fail-open MUTLAK — coverage adalah pelengkap, tidak boleh memutus balasan)
 */
async function getAgentCoverage(agentUserId) {
  if (!agentUserId) return null;

  const cached = _cacheGet(agentUserId);
  if (cached) return cached;

  try {
    const { Property, City } = require('../models');

    const rows = await Property.findAll({
      where: { user_id: agentUserId, status: 1 },
      attributes: ['city_id', 'building_type', 'transaction_type', 'area', 'price', 'price_type'],
      raw: true,
    });
    if (!rows.length) { _cacheSet(agentUserId, null); return null; }

    const cityIds = [...new Set(rows.map((r) => r.city_id).filter(Boolean))];
    const cityRows = await City.findAll({
      where: { city_id: { [Op.in]: cityIds } },
      attributes: ['city_id', 'name'],
      raw: true,
    });
    const cityNameById = new Map(cityRows.map((c) => [c.city_id, _titleCase(c.name)]));

    /** cityName → { total, types: { 'house|Sale': {count,min,max,priceTypes:Set,areas:Map} } } */
    const byCity = new Map();
    for (const r of rows) {
      const cityName = cityNameById.get(r.city_id);
      if (!cityName) continue;
      if (!byCity.has(cityName)) byCity.set(cityName, { total: 0, types: new Map() });
      const cityEntry = byCity.get(cityName);
      cityEntry.total++;

      const typeKey = `${r.building_type}|${r.transaction_type}`;
      if (!cityEntry.types.has(typeKey)) {
        cityEntry.types.set(typeKey, {
          buildingType: r.building_type,
          transactionType: r.transaction_type,
          count: 0, min: null, max: null,
          priceTypes: new Set(),
          areas: new Map(), // areaName → { count, min, max }
        });
      }
      const t = cityEntry.types.get(typeKey);
      t.count++;
      const price = r.price == null ? null : Number(r.price);
      if (Number.isFinite(price) && price > 0) {
        t.min = t.min == null ? price : Math.min(t.min, price);
        t.max = t.max == null ? price : Math.max(t.max, price);
      }
      if (r.price_type) t.priceTypes.add(r.price_type);

      const areaName = String(r.area || '').trim();
      if (areaName) {
        if (!t.areas.has(areaName)) t.areas.set(areaName, { count: 0, min: null, max: null });
        const a = t.areas.get(areaName);
        a.count++;
        if (Number.isFinite(price) && price > 0) {
          a.min = a.min == null ? price : Math.min(a.min, price);
          a.max = a.max == null ? price : Math.max(a.max, price);
        }
      }
    }

    const coverage = { agentUserId, cities: byCity };
    _cacheSet(agentUserId, coverage);
    return coverage;
  } catch (err) {
    console.warn('[AgentCoverage] gagal memuat coverage (fail-open):', err.message);
    return null;
  }
}

/**
 * Render coverage jadi blok teks untuk prompt LLM.
 *
 * ⛔ Blok ini adalah DATA, bukan instruksi balasan. Kalimatnya sengaja
 * deskriptif ("agent ini punya X") — BUKAN imperatif ("tawarkan X"), supaya
 * platform AI tetap yang memutuskan mau memakainya bagaimana, sesuai skill doc.
 *
 * Dibatasi agar hemat token (disiplin §8 UKURAN PROMPT — prompt sudah ±67K):
 * hanya kota+tipe yang RELEVAN dengan permintaan customer yang dirinci sampai
 * level area; kota lain cukup disebut nama + jumlah.
 *
 * @param {object|null} coverage hasil getAgentCoverage()
 * @param {object} filters { buildingType, transactionType, location }
 * @returns {string} '' bila tidak ada data (nol token tambahan)
 */
function buildAgentCoverageContext(coverage, filters = {}) {
  if (!coverage || !coverage.cities || !coverage.cities.size) return '';

  const MAX_AREAS = Number(process.env.AGENT_COVERAGE_MAX_AREAS || 12);
  const wantType = String(filters.buildingType || '').toLowerCase();
  const wantTx   = String(filters.transactionType || '').toLowerCase();
  const wantCity = String(filters.location || '').trim().toLowerCase();

  const lines = ['KATALOG NYATA AGENT INI (fakta dari database — untuk mencegah menebak/mengarang):'];

  // Ringkasan kota: SELALU disertakan. Inilah yang membuat AI bisa menjawab
  // "saya punya data di kota mana saja" tanpa mengarang (skenario nyata:
  // customer minta Malang, agent hanya punya Surabaya/Sidoarjo/Gresik).
  const citySummary = [...coverage.cities.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, e]) => `${name} (${e.total})`)
    .join(', ');
  lines.push(`- Kota yang ADA stoknya: ${citySummary}.`);
  lines.push('- Kota SELAIN daftar di atas: agent ini TIDAK punya listing sama sekali.');

  // Detail per kota yang diminta customer (atau semua kota bila belum menyebut).
  const targetCities = [...coverage.cities.entries()].filter(([name]) =>
    !wantCity || name.toLowerCase().includes(wantCity) || wantCity.includes(name.toLowerCase()));

  for (const [cityName, entry] of targetCities) {
    const types = [...entry.types.values()].filter((t) => {
      if (wantType && String(t.buildingType).toLowerCase() !== wantType) return false;
      if (wantTx && String(t.transactionType).toLowerCase() !== wantTx) return false;
      return true;
    });
    if (!types.length) {
      if (wantType || wantTx) {
        const label = [wantTx, wantType].filter(Boolean).join(' ');
        lines.push(`- ${cityName}: TIDAK ada listing untuk "${label}". (Tipe/transaksi lain di kota ini: ${[...entry.types.values()].map((t) => `${t.buildingType}/${t.transactionType} (${t.count})`).join(', ')})`);
      }
      continue;
    }

    for (const t of types) {
      const priceRange = (t.min != null && t.max != null)
        ? ` — harga ${_fmtRp(t.min)} s/d ${_fmtRp(t.max)}${t.priceTypes.size ? ` (${[...t.priceTypes].join('/')})` : ''}`
        : '';
      lines.push(`- ${cityName} · ${t.buildingType} · ${t.transactionType}: ${t.count} unit${priceRange}`);

      const areas = [...t.areas.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, MAX_AREAS);
      if (areas.length) {
        const areaTxt = areas.map(([name, a]) => {
          const r = (a.min != null && a.max != null) ? ` ${_fmtRp(a.min)}-${_fmtRp(a.max)}` : '';
          return `${name} (${a.count}${r})`;
        }).join('; ');
        lines.push(`  Area yang ADA isinya: ${areaTxt}.`);
        lines.push(`  Area SELAIN yang disebut di baris ini: kosong untuk tipe/transaksi ini di ${cityName}.`);
      }
    }
  }

  return lines.join('\n');
}

/** Kosongkan cache (dipakai tes & setelah seed/import katalog). */
function clearAgentCoverageCache() { _cache.clear(); }

module.exports = {
  getAgentCoverage,
  buildAgentCoverageContext,
  clearAgentCoverageCache,
};

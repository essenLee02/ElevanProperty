'use strict';
/**
 * seed-facility-keywords.js
 * ---------------------------------------------------------------------------
 * Migrasi sinonim fasilitas dari hardcoded _FACILITY_MAP
 * (backend/services/propertyRecommendationService.js) ke kolom DB
 * `facilities.keywords` (JSON). Setelah ini, sumber kebenaran sinonim ada di
 * DATABASE — admin cukup mengisi/ubah keyword di master, chatbot langsung tahu.
 *
 * Prasyarat: jalankan dulu migration kolom:
 *   mysql ... < database/migrations/2026-07-15-facility-keywords.sql
 *   (atau server.js sequelize.sync() sudah menambah kolomnya)
 *
 * Jalankan:
 *   node backend/scripts/seed-facility-keywords.js          # tulis ke DB
 *   node backend/scripts/seed-facility-keywords.js --dry    # pratinjau saja
 *
 * Idempoten: menggabungkan (union) keyword map ke keyword DB yang sudah ada,
 * jadi aman dijalankan berkali-kali dan tidak menimpa keyword tambahan admin.
 * Setiap entri map ditautkan ke SATU fasilitas DB terbaik (nama == label, atau
 * nama == salah satu keyword) supaya sinonim tidak tersebar ke banyak baris.
 */
require('dotenv').config();
const { Facility } = require('../models');
const svc = require('../services/propertyRecommendationService');

const DRY = process.argv.includes('--dry');

// Normalisasi untuk pencocokan: lowercase, rapatkan spasi & tanda hubung.
const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_]+/g, ' ').trim();

async function main() {
  const map = svc.getFacilityFallbackMap();               // [[label, [kw...]], ...]
  const rows = await Facility.findAll({ where: { status: 1 }, raw: false });

  // Index DB by normalized name.
  const byName = new Map();
  for (const r of rows) byName.set(norm(r.name), r);

  const used = new Set();     // facility_id yang sudah ditautkan (hindari dobel)
  let updated = 0, skipped = 0;
  const preview = [];

  for (const [label, keywords] of map) {
    // Cari fasilitas DB terbaik: (1) nama == label, else (2) nama == salah satu keyword.
    let target = byName.get(norm(label));
    if (!target) {
      for (const kw of keywords) {
        const cand = byName.get(norm(kw));
        if (cand) { target = cand; break; }
      }
    }
    if (!target) { skipped++; continue; }                 // entri map tanpa padanan DB (mis. "Perlengkapan Dapur")
    if (used.has(target.facility_id)) continue;           // sudah ditautkan entri lain
    used.add(target.facility_id);

    // Union keyword yang sudah ada di DB + keyword map + nama fasilitas (lowercase).
    const existing = Array.isArray(target.keywords) ? target.keywords
      : (typeof target.keywords === 'string' && target.keywords.trim()
          ? (() => { try { const p = JSON.parse(target.keywords); return Array.isArray(p) ? p : []; } catch (_) { return []; } })()
          : []);
    const merged = Array.from(new Set(
      [...existing, ...keywords, String(target.name || '').toLowerCase()]
        .map((k) => String(k || '').trim().toLowerCase())
        .filter(Boolean)
    ));

    preview.push({ name: target.name, keywords: merged });
    if (!DRY) { target.keywords = merged; await target.save({ fields: ['keywords'] }); }
    updated++;
  }

  console.log(`\n[seed-facility-keywords] ${DRY ? 'DRY RUN — ' : ''}${updated} fasilitas di-seed, ${skipped} entri map tanpa padanan DB.`);
  for (const p of preview) console.log(`  • ${p.name.padEnd(22)} → ${JSON.stringify(p.keywords)}`);

  // Fasilitas DB yang TIDAK dapat keyword dari map (long-tail) → tetap terdeteksi
  // via nama fasilitasnya sendiri (fallback di initFacilityCache). Tampilkan agar
  // admin tahu mana yang mungkin perlu sinonim tambahan manual.
  const unseeded = rows.filter((r) => !used.has(r.facility_id) && !(Array.isArray(r.keywords) && r.keywords.length));
  console.log(`\n[seed-facility-keywords] ${unseeded.length} fasilitas tanpa keyword khusus (pakai nama sebagai token):`);
  console.log('  ' + unseeded.map((r) => r.name).join(', '));

  process.exit(0);
}

main().catch((e) => { console.error('[seed-facility-keywords] ERROR:', e); process.exit(1); });

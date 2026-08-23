/**
 * missingFacilitiesSeed.test.js — regresi M129 follow-up (facility gap-fill).
 *
 * Fasilitas ditemukan hilang saat membandingkan katalog vs listing rumah123.com
 * nyata (Club House, Amphitheater, Basketball Court, Foodhall, Jogging Track,
 * Access Card, Community Room). Verifikasi tujuh baris baru ada, punya
 * keywords deteksi yang masuk akal, dan created_by user_id nyata.
 *
 * Run: node tests/missingFacilitiesSeed.test.js
 */
'use strict';

require('dotenv').config();
const { Facility, User } = require('../models');
const { detectFacilities, initFacilityCache } = require('../services/propertyRecommendationService');

// keywords disimpan sebagai STRING JSON di kolom, bukan array native (perilaku
// existing, dikonfirmasi juga terjadi pada baris "AC" yang sudah lama ada —
// bukan bug baru dari script ini). _parseKeywordsColumn() di
// propertyRecommendationService.js sudah menangani ini secara internal;
// test ini mem-parse manual untuk memverifikasi ISI-nya, bukan tipe mentahnya.
function parseKeywords(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch (_) { return []; }
  }
  return [];
}

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const NEW_NAMES = ['CLUB HOUSE', 'AMPHITHEATER', 'BASKETBALL COURT', 'FOODHALL', 'JOGGING TRACK', 'ACCESS CARD', 'COMMUNITY ROOM'];

async function main() {
  const realUserIds = new Set((await User.findAll({ attributes: ['user_id'], raw: true })).map((u) => u.user_id));

  console.log('\n== 7 fasilitas baru ada di DB ==');
  for (const name of NEW_NAMES) {
    const row = await Facility.findOne({ where: { name }, raw: true });
    ok(`"${name}" ada`, !!row);
    if (row) {
      ok(`  "${name}": created_by user_id nyata`, realUserIds.has(row.created_by), row.created_by);
      const kws = parseKeywords(row.keywords);
      ok(`  "${name}": keywords terisi (array non-kosong)`, kws.length > 0, JSON.stringify(row.keywords));
    }
  }

  console.log('\n== detectFacilities() mengenali keyword baru dalam kalimat customer ==');
  {
    // Cache DB-augmented harus dimuat eksplisit (bukan lazy) — sama seperti
    // server.js melakukannya sekali saat boot (initFacilityCache()).
    await initFacilityCache();
    const f1 = detectFacilities('Ada club house nggak di sini?');
    ok('mendeteksi "club house"', f1.some((f) => /club house/i.test(f)), JSON.stringify(f1));

    const f2 = detectFacilities('Saya mau yang ada jogging track');
    ok('mendeteksi "jogging track"', f2.some((f) => /jogging track/i.test(f)), JSON.stringify(f2));

    const f3 = detectFacilities('Butuh kartu akses masuk kompleks');
    ok('mendeteksi "kartu akses" → access card', f3.some((f) => /access card/i.test(f)), JSON.stringify(f3));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

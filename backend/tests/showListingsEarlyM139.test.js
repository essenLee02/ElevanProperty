/**
 * showListingsEarlyM139.test.js — regresi M139.
 *
 * Directive pemilik proyek (24 Agu 2026):
 *   "Selama ini AI dikembangkan seperti interview customer. AI saat ini harus
 *    lebih menyesuaikan kebutuhan customer, karena customer malas terlalu
 *    banyak interview. Berikan 2 listing dulu, jika AI sudah dapat informasi
 *    minimal lokasi area, kota, tipe transaksi dan tipe properti."
 *
 * ⛔ AKAR MASALAH yang ditemukan (bukan sekadar contoh dialog kurang):
 * `SKILL.md` §4 — OPERATING CONTRACT yang MENGALAHKAN docs/ — masih berbunyi
 * "❌ Never show listings mid-interview" dan mensyaratkan SEMUA slot wajib ✅
 * sebelum listing apa pun. Itu BERTENTANGAN LANGSUNG dengan doc 15 §0b (M134,
 * 4 slot saja), dan karena SKILL.md adalah kontrak, SKILL.md yang menang.
 * Itulah sebabnya AI tetap meng-interview walau M134 sudah dikerjakan —
 * kelas kegagalan yang SAMA dengan "prompt outranks skill docs".
 *
 * Tes ini mengunci: (a) kontrak sudah dibalik di KETIGA folder skill,
 * (b) tidak ada aturan lama yang tersisa sebagai perintah aktif, dan
 * (c) pesan pembuka NYATA dari skenario pemilik proyek benar-benar mencapai
 * status READY (→ 2 listing), bukan malah memicu pertanyaan tambahan.
 *
 * Run: node tests/showListingsEarlyM139.test.js
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { evaluateListingReadiness, buildListingReadinessContext } = require('../utils/listingReadiness');
const svc = require('../services/propertyRecommendationService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const SKILL_DIRS = ['chat_gpt_responds', 'claude_responds', 'elevan-property-assistant'];
const skillRoot = path.join(__dirname, '..', '..', 'skills');
const readSkill = (d) => fs.readFileSync(path.join(skillRoot, d, 'SKILL.md'), 'utf8');
const readDoc15 = (d) => fs.readFileSync(path.join(skillRoot, d, 'docs', '15-catalog-conversation-cases.md'), 'utf8');

async function main() {
  console.log('\n== Group 1: kontrak SKILL.md §4 sudah "show early", di KETIGA folder ==');
  for (const d of SKILL_DIRS) {
    const s = readSkill(d);
    ok(`${d}: ada seksi "SHOW LISTINGS EARLY"`, /SHOW LISTINGS EARLY/.test(s));
    ok(`${d}: menyebut 2 listing begitu 4 slot diketahui`,
      /show \*\*2 listings\*\*|show \*\*2 listing/i.test(s));
    ok(`${d}: budget DINYATAKAN bukan syarat`, /Budget is \*\*not\*\* required/i.test(s));
    ok(`${d}: aturan lama DICABUT eksplisit (bukan sekadar dihapus diam-diam)`,
      /That rule is withdrawn/i.test(s));
  }

  console.log('\n== Group 2: KONTROL — aturan lama tidak tersisa sebagai perintah aktif ==');
  for (const d of SKILL_DIRS) {
    const s = readSkill(d);
    // Frasa lama boleh muncul HANYA di dalam catatan pencabutan (dikutip),
    // TIDAK sebagai baris tabel mode yang masih memerintah.
    const inWithdrawalNote = /Previous versions of this file said \*"❌ Never show listings mid-interview"\*/.test(s);
    const occurrences = (s.match(/Never show listings/g) || []).length;
    ok(`${d}: frasa "Never show listings" hanya tersisa di catatan pencabutan`,
      inWithdrawalNote && occurrences === 1, `${occurrences} kemunculan`);
    ok(`${d}: diagram lifecycle sudah "minimum slots → 2 listings"`,
      /minimum slots → 2 listings/.test(s));
    ok(`${d}: lifecycle lama (Q1–Q14 → summary) sudah TIDAK ada`,
      !/Q1–Q14 qualification {2}→ {2}summary brief/.test(s));
  }

  console.log('\n== Group 3: doc 15 selaras & byte-identical antar folder ==');
  {
    const base = readDoc15(SKILL_DIRS[0]);
    for (const d of SKILL_DIRS.slice(1)) {
      ok(`doc 15 ${d} byte-identical dengan chat_gpt_responds`, readDoc15(d) === base);
    }
    ok('doc 15 menegaskan "show as soon as you can"', /show as soon as you can/i.test(base));
    ok('doc 15 punya tabel kapan slot lain baru relevan', /Then it is natural to ask/i.test(base));
    ok('doc 15 melarang interview lanjutan sebagai anti-pattern',
      /Keep interviewing after the 4 slots are known/i.test(base));
    ok('doc 15 punya dialog kerja penuh Case 1 (Andy)', /8c\. Full worked dialogue/.test(base));
    ok('doc 15 punya dialog kerja penuh Case 2/3 (Gresik)', /8d\. Full worked dialogue/.test(base));
    ok('doc 15 punya variasi pembukaan lain', /8e\. Shorter variations/.test(base));
    ok('doc 15 mengatur jumlah listing default 2', /default \*\*2\*\*/.test(base));
  }

  console.log('\n== Group 4: PESAN NYATA skenario pemilik proyek → READY (bukan interview) ==');
  {
    // Cache WAJIB dihangatkan seperti produksi (server.js melakukannya saat boot).
    // Tanpa ini detectLandmark() selalu '' dan tes ini akan menyimpulkan bug palsu.
    await svc.initFacilityCache();
    await svc.initCityCache();
    await svc.initLandmarkCache();

    const ready = (msg) => evaluateListingReadiness(svc.extractPropertyFilters(msg, []));

    const c1 = ready('Saya lagi beli rumah di Puri Surya Jaya Sidoarjo. Apakah Ada?');
    ok('Case 1 pembuka → READY (4 slot lengkap di pesan pertama)', c1.ready === true,
      'kurang: ' + c1.missingLabels.join(', '));

    const c3 = ready('Cari rumah dijual di Wiyung Surabaya, budget 1-1,5 M');
    ok('semua-di-satu-pesan → READY tanpa pertanyaan tambahan', c3.ready === true,
      'kurang: ' + c3.missingLabels.join(', '));

    // Case 2 pembuka memang belum lengkap — HANYA area yang kurang setelah
    // tipe+transaksi terdeteksi. Yang penting: tipe TERDETEKSI (lihat Group 5).
    const c2 = ready('Saya lagi cari apartmen sewa di kota Gresik');
    ok('Case 2 pembuka → hanya lokasi spesifik yang kurang (tipe & tx terbaca)',
      c2.ready === false && c2.missing.length === 1 && c2.missing[0] === 'specificLocation',
      'kurang: ' + c2.missing.join(', '));
  }

  console.log('\n== Group 5: salah-ketik "apartmen" (transkrip nyata) TERDETEKSI ==');
  {
    for (const w of ['apartmen', 'apartemen', 'apartment', 'apartement', 'aparteman']) {
      ok(`"${w}" → apartment`, svc.detectBuildingType(`cari ${w} di Gresik`) === 'apartment',
        JSON.stringify(svc.detectBuildingType(`cari ${w} di Gresik`)));
    }
    // KONTROL NEGATIF: kata tanya "apa"/"apakah" TIDAK boleh jadi apartment.
    ok('"apa ada rumah?" TIDAK jadi apartment', svc.detectBuildingType('apa ada rumah?') === 'house');
    ok('"apakah ada gudang" TIDAK jadi apartment', svc.detectBuildingType('apakah ada gudang') === 'warehouse');
    ok('"cari rumah" tetap house', svc.detectBuildingType('cari rumah') === 'house');
  }

  console.log('\n== Group 6: blok readiness tetap deskriptif (LLM yang menyusun kalimat) ==');
  {
    const ctxReady = buildListingReadinessContext(evaluateListingReadiness({
      buildingType: 'house', transactionType: 'sale', location: 'Sidoarjo', district: 'Puri Surya Jaya',
    }));
    ok('status TERPENUHI dinyatakan', /TERPENUHI/.test(ctxReady));
    ok('menegaskan budget bukan syarat', /budget bukan syarat|tanpa menunggu budget/i.test(ctxReady));
    ok('fail-open: null → string kosong (nol token)', buildListingReadinessContext(null) === '');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

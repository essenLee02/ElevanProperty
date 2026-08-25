/**
 * showListingsAfterMinimumM140AndCustomerIsolationM141.test.js
 *
 * TWO real production bugs from a live transcript (25 Agu 2026):
 *
 * M140 — AI KEPT INTERVIEWING after type+tx+city+area were all known, even
 * though M139 already updated the skill-doc CONTRACT to say "show 2 listings".
 * Root cause: findNextQuestion() (aiPromptBuilderService.js) injects a
 * NUMBERED question into the DIREKTIF FINAL at prompt position 100% — and per
 * this project's own established lesson, a numbered directive OUTRANKS
 * SKILL.md. Fixing the doc (M139) could never fix this; the gate had to move
 * into findNextQuestion() itself.
 *
 * M141 — customerMasterController.js's by-id endpoints (detail/update/
 * toggle-status/toggle-ai/delete) looked up customers by customer_id ALONE,
 * with no check that the customer belongs to the logged-in agent. Any
 * authenticated agent who knew/guessed another agent's customer_id could
 * view, edit, disable AI on, or DELETE that agent's customer — full
 * cross-agent write access. Found while investigating the project owner's
 * report that "setiap agent punya data customer yang berbeda" (each agent's
 * customer data must stay separate). The list endpoint's `?all=1` had the
 * same gap (any agent, not just admin, could request the full cross-agent
 * list) and is fixed alongside the by-id endpoints.
 *
 * Run: node tests/showListingsAfterMinimumM140AndCustomerIsolationM141.test.js
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

async function main() {
  const svc = require('../services/propertyRecommendationService');
  const pb  = require('../services/aiPromptBuilderService');
  await svc.initFacilityCache();
  await svc.initCityCache();
  await svc.initLandmarkCache();

  console.log('\n== Group 1: M140 — pesan transkrip NYATA berhenti mengulang interview ==');
  {
    const history = [
      { role: 'customer', message: 'Hello... Mau cari rumah di Citraland Surabaya.' },
      { role: 'ai',       message: 'Untuk Rumah yang Anda cari — rencananya untuk sewa atau beli? 🏠' },
    ];
    const state = pb.extractQualificationState(history, 'Rencana beli, Kak');
    ok('state menangkap tipe+transaksi+kota+area dari 3 pesan',
      state.buildingType === 'house' && state.transactionType === 'sale' &&
      state.city === 'Surabaya' && !!state.district,
      JSON.stringify({ t: state.buildingType, tx: state.transactionType, c: state.city, d: state.district }));

    const next = pb.findNextQuestion(state);
    ok('findNextQuestion() = SHOW_LISTINGS (BUKAN Q2b "sudah lihat berapa")',
      next && next.q === 'SHOW_LISTINGS', next && next.q);
    ok('hint melarang bertanya lagi giliran ini', /JANGAN bertanya/i.test(next?.hint || ''));
    ok('hint menyebut 2 listing', /2 listing/i.test(next?.hint || ''));
    ok('hint menegaskan budget tidak perlu ditanya', /[Bb]udget.*tidak perlu ditanya/i.test(next?.hint || ''));
    ok('hint mengarahkan ke katalog agent ini (bukan mengarang)',
      /KATALOG NYATA AGENT INI/i.test(next?.hint || ''));
  }

  console.log('\n== Group 2: M140 — gerbang menyala SEKALI, lalu alur lanjut normal ==');
  {
    const historyAfterListing = [
      { role: 'customer', message: 'Hello... Mau cari rumah di Citraland Surabaya.' },
      { role: 'ai',       message: 'Untuk Rumah yang Anda cari — rencananya untuk sewa atau beli?' },
      { role: 'customer', message: 'Rencana beli, Kak' },
      { role: 'ai',       message: 'Berikut 2 pilihannya:\n1. Citraland Tipe A - Rp 1,2 miliar\n2. Citraland Tipe B - Rp 1,8 miliar\nAda yang menarik?' },
      { role: 'customer', message: 'Yang no 1 menarik' },
    ];
    const state = pb.extractQualificationState(historyAfterListing, 'Yang no 1 menarik');
    ok('listingsShown terdeteksi TRUE setelah AI mengirim baris bernomor + harga', state.listingsShown === true);
    const next = pb.findNextQuestion(state);
    ok('setelah listing tampil, gerbang TIDAK menyala lagi', next && next.q !== 'SHOW_LISTINGS', next && next.q);
  }

  console.log('\n== Group 3: M140 — KONTROL NEGATIF, jangan salah tangkap pesan lain sebagai listing ==');
  {
    const q3History = [{ role: 'ai', message: 'Di Surabaya ada Rumah kisaran Rp 800 juta dan Rp 2 miliar. Mana yang sesuai?' }];
    const st = pb.extractQualificationState(q3History, '');
    ok('pertanyaan Q3 (2 harga kontras, TANPA baris bernomor) TIDAK dianggap listing', st.listingsShown === false);
  }

  console.log('\n== Group 4: M140 — gerbang belum menyala bila salah satu dari 4 slot masih kosong ==');
  {
    const st = pb.extractQualificationState([], 'Saya mau beli rumah di Surabaya'); // tanpa area
    const next = pb.findNextQuestion(st);
    ok('tanpa lokasi spesifik, gerbang TIDAK menyala (lanjut tanya area, bukan listing kosong)',
      next && next.q !== 'SHOW_LISTINGS', next && next.q);
  }

  console.log('\n== Group 5: M141 — endpoint by-id TIDAK LAGI bisa diakses lintas-agent ==');
  {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'controllers', 'customerMasterController.js'), 'utf8'
    );
    ok('#findOwnedCustomer() didefinisikan', /#findOwnedCustomer/.test(src));
    for (const fn of ['getDetailCustomer', 'updateDataCustomer', 'toggleStatusCustomer', 'toggleAiResponseCustomer', 'deleteCustomer']) {
      const body = (src.split(`static async ${fn}(`)[1] || '').split(/\n  static async |\n}\n\nmodule\.exports/)[0];
      ok(`${fn}() memanggil #findOwnedCustomer sebelum memakai customer`,
        /#findOwnedCustomer\(customer_id, req\)/.test(body), 'body tidak memanggil gerbang kepemilikan');
      ok(`${fn}() TIDAK LAGI query customer_id tanpa cek kepemilikan`,
        !/Customer\.findOne\(\{ where: \{ customer_id, status/.test(body));
    }
  }

  console.log('\n== Group 6: M141 — ?all=1 pada /customer/list kini WAJIB admin ==');
  {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'controllers', 'customerMasterController.js'), 'utf8'
    );
    const listFn = src.split('static async showDataCustomer(')[1].split('\n  static async ')[0];
    ok('showAll SEKARANG memeriksa req.user.privilege === \'admin\'',
      /isAdmin\s*=\s*req\.user\?\.privilege === 'admin'/.test(listFn));
    ok('showAll = requestedAll && isAdmin (bukan requestedAll saja)',
      /showAll\s*=\s*requestedAll && isAdmin/.test(listFn));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

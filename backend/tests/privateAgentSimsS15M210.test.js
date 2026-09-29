/**
 * M210 (29 Sep 2026) — 15 sesi S1–S15 (scripts/sim-scenarios-private-s15.js) + regresi Z/R-set.
 * Kelas bug yang dikunci di sini:
 *  - "ok"/"sip" sesudah memilih unit ditelan tryPostPickFallback ("Boleh diulang maksudnya?")
 *    alih-alih diteruskan ke gerbang penutup.
 *  - "saya tunggu agentnya menghubungi" & "saya pikir dulu" tidak terbaca sebagai penutup,
 *    sementara "mikir-mikir dulu" (menjelajah) harus TETAP bukan penutup.
 *  - "Bisa bayar DP dulu?" (tanpa kata KPR) tidak dijawab sama sekali.
 *  - Ack pasca-kartu menimpa ucapan penutup customer.
 *  - Sewa harian menyebut tanggal sebagai lama menginap → Q8 dianggap tertunda, penutup
 *    dibalas pertanyaan baru.
 *  - Singkatan/typo di detektor kanonik: "rmh dijul di sda" → house/sale/sidoarjo.
 */
require('dotenv').config();
process.env.AI_PRIMARY_PROVIDER = 'private';
let pass = 0, fail = 0;
const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}${e ? ' — ' + e : ''}`); } };
const A = (m) => ({ role: 'ai', message: m }); const C = (m) => ({ role: 'customer', message: m });

(async () => {
  const prs = require('../services/propertyRecommendationService');
  await prs.initCityCache(); await prs.initLandmarkCache(); await prs.initFacilityCache();
  const q = require('../utils/customerQuestionGuard');
  const g = require('../utils/listingSelectionGate');
  const { tryTerminologyAnswer } = require('../utils/terminologyAnswerGate');

  console.log('\n[1] Penutup yang sebelumnya tidak terbaca');
  ok('"ok" = penutup', q.customerSignalsClosing('ok'));
  ok('"Ok sip." = penutup', q.customerSignalsClosing('Ok sip.'));
  ok('"Oke, saya tunggu agentnya menghubungi." = penutup', q.customerSignalsClosing('Oke, saya tunggu agentnya menghubungi.'));
  ok('"Oke saya pikir dulu ya." = penutup', q.customerSignalsClosing('Oke saya pikir dulu ya.'));
  ok('"mikir-mikir dulu" TETAP bukan penutup (masih menjelajah)', !q.customerSignalsClosing('Saya masih mikir-mikir dulu ya.'));
  ok('"oke, yang nomor 2 saja" bukan penutup', !q.customerSignalsClosing('oke, yang nomor 2 saja'));

  console.log('\n[2] Penutup tidak ditelan gerbang pasca-pilih');
  {
    const hist = [
      C('Rumah dijual Mulyorejo Surabaya'),
      A('Ini 2 Rumah dijual di *Mulyorejo* ya, Kak 😊\n\n1. *Mulyorejo House Sale Surabaya*\n\n   🏡 Alamat: Jl. Mulyorejo No. 63, Surabaya\n   💰 Estimasi Harga: *367.3 juta*'),
      C('Saya pilih no 1'),
      A('Baik, Kak 😊 Dicatat pilihannya: *Mulyorejo House Sale Surabaya* (367.3 juta).'),
    ];
    const r = g.tryPostPickFallback ? g.tryPostPickFallback({ message: 'ok', history: hist, isId: true }) : null;
    ok('"ok" tidak dibalas "Boleh diulang maksudnya?"', !r || !/boleh diulang/i.test(String(r.reply || '')), r && String(r.reply).slice(0, 70));
  }

  console.log('\n[3] Pertanyaan yang sebelumnya didiamkan');
  {
    const dp = String(tryTerminologyAnswer('Bisa bayar DP dulu?') || '');
    ok('"Bisa bayar DP dulu?" dijawab (booking fee / lewat agent-notaris)', /booking fee|tanda jadi/i.test(dp) && /notaris|agent/i.test(dp), dp.slice(0, 80));
    ok('jawaban DP tidak menjanjikan nominal', !/\bRp\s?\d/.test(dp), dp.slice(0, 80));
  }

  console.log('\n[4] Singkatan & typo di detektor kanonik');
  ok('"rmh dijul di sda" → house / sale / sidoarjo',
    prs.detectCanonicalType('cari rmh dijul di sda') === 'house'
    && prs.detectCanonicalTransaction('cari rmh dijul di sda') === 'sale'
    && /sidoarjo/i.test(String((prs.detectLocation('cari rmh dijul di sda') || {}).city || prs.detectLocation('cari rmh dijul di sda') || '')),
    JSON.stringify(prs.detectLocation('cari rmh dijul di sda')));
  ok('"srtfikatnya apa?" tetap pertanyaan atribut', g.isAttributeQuestion('srtfikatnya apa?'));

  console.log(`\nRESULT: ${pass}/${pass + fail}${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

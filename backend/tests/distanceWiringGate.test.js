/**
 * distanceWiringGate.test.js — regresi M130 (wiring ke Private Agent + jalur LLM).
 *
 * distanceEstimationService.js sendiri diuji di distanceEstimation.test.js —
 * file ini menguji bahwa fitur itu benar-benar TERPASANG di kedua jalur
 * produksi (Private Agent deterministik + wrapper whatsappAIService.js),
 * termasuk fallback "Maaf, saya akan cek dahulu" yang diminta pemilik proyek
 * untuk kasus yang TERLIHAT seperti pertanyaan jarak tapi tidak bisa dihitung.
 *
 * Run: node tests/distanceWiringGate.test.js
 */
'use strict';

require('dotenv').config();
const { generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');
const { generateWhatsAppAIReply } = require('../services/whatsappAIService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

async function askPrivate(userMessage, history = []) {
  const result = await generatePrivateTerminalMassege({
    session: { id: 999002, name: 'Test', agentName: 'Test Agent' },
    history, userMessage, agentName: 'Test Agent',
    recommendationContext: null, externalError: new Error('test'),
  });
  return result?.reply || '';
}

async function main() {
  console.log('\n== Group 1: Private Agent — pertanyaan jarak DAPAT DIHITUNG dijawab langsung ==');
  {
    const r = await askPrivate('jarak dari Surabaya ke Malang berapa?');
    ok('dijawab dengan estimasi jarak/waktu (bukan diam/off-topic)', /km/i.test(r) && /mobil/i.test(r), r.slice(0, 100));
  }

  console.log('\n== Group 2: Private Agent — pertanyaan jarak TIDAK BISA DIHITUNG → "Maaf, saya akan cek dahulu" ==');
  {
    const r = await askPrivate('berapa jarak dari Kota Antah Berantah ke properti ini?');
    ok('balasan PERSIS "Maaf, saya akan cek dahulu" (sesuai permintaan pemilik proyek)',
      /maaf.{0,10}saya akan cek dahulu/i.test(r), r);
  }

  console.log('\n== Group 3: Private Agent — pesan biasa TIDAK terganggu fitur jarak ==');
  {
    const r = await askPrivate('Saya mau sewa rumah di Surabaya');
    ok('tidak dijawab dengan "cek dahulu" atau estimasi jarak (bukan pertanyaan jarak)',
      !/cek dahulu/i.test(r) && !/estimasi jarak/i.test(r), r.slice(0, 100));
  }

  console.log('\n== Group 4: jalur LLM (whatsappAIService wrapper) — intercept SEBELUM panggil LLM ==');
  {
    // Tidak perlu provider AI sungguhan menyala — bila intercept jarak
    // bekerja, LLM/Private Agent core TIDAK PERNAH dipanggil sama sekali.
    const result = await generateWhatsAppAIReply({
      session: { id: 999003, agentName: 'Test Agent' },
      message: 'dari Surabaya ke Malang, berapa jarak dan waktu tempuhnya?',
      agentName: 'Test Agent', agentUserId: 'TEST_M130',
    });
    ok('provider = distance_estimation (intercept aktif, bukan LLM/Private Agent)',
      result.provider === 'distance_estimation', result.provider);
    ok('balasan berisi estimasi jarak/waktu', /km/i.test(result.reply) && /mobil/i.test(result.reply));
  }

  console.log('\n== Group 5: jalur LLM — pesan biasa TIDAK di-intercept (lanjut ke core seperti biasa) ==');
  {
    // Tanpa provider AI nyata, core function akan gagal/fallback — yang
    // penting provider BUKAN 'distance_estimation' untuk pesan non-jarak.
    const result = await generateWhatsAppAIReply({
      session: { id: 999004, agentName: 'Test Agent' },
      message: 'apa itu SHM?',
      agentName: 'Test Agent', agentUserId: 'TEST_M130',
    });
    ok('provider BUKAN distance_estimation untuk pesan non-jarak', result.provider !== 'distance_estimation', result.provider);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

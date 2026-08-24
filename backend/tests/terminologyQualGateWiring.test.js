/**
 * terminologyQualGateWiring.test.js — regresi M132.
 *
 * terminologyAnswerGate.test.js (M129) menguji #tryTerminologyAnswer() lewat
 * generatePrivateTerminalMassege() LANGSUNG — tapi itu BUKAN pintu masuk
 * produksi yang sesungguhnya. Semua 3 WhatsApp controller (Kirimi/Fonnte/
 * TimelinesAI) memanggil generateWhatsAppAIReply() (whatsappAIService.js),
 * yang menjalankan buildQualifyReply() SEBELUM chatbotPrivateController.js
 * pernah dipanggil. Transkrip produksi nyata (23-24 Agu 2026): customer
 * bertanya "Apakah sdh SHM?" empat kali berturut-turut, SELALU dibalas
 * pertanyaan qualifikasi generik ("...rencananya sewa atau beli?") — M129
 * tidak pernah tereksekusi sama sekali karena gate itu.
 *
 * File ini menguji pintu masuk produksi YANG SESUNGGUHNYA
 * (generateWhatsAppAIReply), dengan filter kualifikasi masih INCOMPLETE
 * (kondisi paling umum saat customer bertanya soal sertifikat) — persis
 * skenario yang lolos dari tes M129.
 *
 * Run: node tests/terminologyQualGateWiring.test.js
 */
'use strict';

require('dotenv').config();
const { generateWhatsAppAIReply } = require('../services/whatsappAIService');
const { tryTerminologyAnswer } = require('../utils/terminologyAnswerGate');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

let seq = 0;
function session() { return { id: 999100 + (seq++), agentName: 'Test Agent' }; }

// ⚠️ generateWhatsAppAIReply()/_generateWhatsAppAIReplyCore() TIDAK PERNAH
// membaca `params.history` — conversation history produksi SELALU diambil
// dari DB lewat getConversationHistory(session.id, ...) (whatsappAIService.js).
// Sebuah `history:` array yang dikirim langsung ke pemanggilan ini diam-diam
// DIABAIKAN (session test di sini pakai id sintetis, jadi DB query-nya
// kembali kosong). Karena itu tes di bawah membangun kondisi "info sebagian
// diketahui" lewat SATU pesan yang membawa >1 sinyal sekaligus (persis pola
// transkrip nyata "Saya mau ngekos di Madiun, SHM itu apa?"), bukan lewat
// riwayat buatan yang tidak akan pernah terbaca oleh kode produksi.
async function main() {
  console.log('\n== Group 1: pintu masuk produksi (generateWhatsAppAIReply) — qual gate BELUM lengkap (KASUS 2: type+loc ada, tx belum) ==');
  {
    const result = await generateWhatsAppAIReply({
      session: session(),
      message: 'Kalau saya mau ngekos di Madiun, SHM itu apa sih maksudnya?',
      agentName: 'Test Agent',
      agentUserId: 'TEST_M132',
    });

    ok('provider = terminology_gate (bukan diam-diam qualification kosong)',
      result.provider === 'terminology_gate', result.provider);
    ok('balasan MENJAWAB SHM (bukan hanya mengulang pertanyaan qualifikasi)',
      /kepemilikan/i.test(result.reply) && /selamanya/i.test(result.reply), result.reply.slice(0, 200));
    ok('balasan TETAP menyambung ke pertanyaan qualifikasi berikutnya (tidak macet)',
      /sewa/i.test(result.reply) && /beli/i.test(result.reply), result.reply.slice(0, 300));
  }

  console.log('\n== Group 1b: transkrip nyata PERSIS — "Blh tau SHM itu apa" (urutan "X itu apa", tanpa "?") ==');
  {
    // Pesan PERTAMA customer di transkrip produksi (23 Agu 2026) yang memicu
    // seluruh investigasi ini — TANPA tanda tanya, urutan kata "itu apa"
    // (bukan "apa itu"). Guard #tryTerminologyAnswer() versi M129 asli TIDAK
    // menangkap pola ini sama sekali (diverifikasi langsung sebelum fix ini).
    const result = await generateWhatsAppAIReply({
      session: session(),
      message: 'Blh tau SHM itu apa',
      agentName: 'Test Agent',
      agentUserId: 'TEST_M132',
    });
    ok('provider = terminology_gate untuk pesan literal transkrip', result.provider === 'terminology_gate', result.provider);
    ok('balasan menjawab SHM', /kepemilikan/i.test(result.reply) && /selamanya/i.test(result.reply), result.reply.slice(0, 150));
  }

  console.log('\n== Group 2: pertanyaan terminologi berulang tetap dijawab tiap kali (bukan hanya sekali) ==');
  {
    // Sesi BARU (bukan lanjutan Group 1 — history tidak nyambung antar
    // pemanggilan tes ini, lihat catatan di atas main()), tapi tetap
    // membuktikan KEDUA istilah berbeda (SHM lalu KPR) sama-sama dijawab
    // dalam SATU pesan yang juga membawa info kualifikasi sebagian.
    const result = await generateWhatsAppAIReply({
      session: session(),
      message: 'Mau ngekos di Madiun, ngomong-ngomong SHM sama KPR itu apa bedanya?',
      agentName: 'Test Agent',
      agentUserId: 'TEST_M132',
    });
    ok('pertanyaan istilah (SHM, dicek lebih dulu dari KPR) tetap dijawab', /kepemilikan/i.test(result.reply), result.reply.slice(0, 150));
  }

  console.log('\n== Group 3: KONTROL — pesan properti biasa (bukan pertanyaan istilah) tidak terganggu ==');
  {
    const result = await generateWhatsAppAIReply({
      session: session(),
      message: 'Saya mau sewa rumah di Malang',
      agentName: 'Test Agent',
      agentUserId: 'TEST_M132',
    });
    ok('provider BUKAN terminology_gate untuk pesan non-istilah', result.provider !== 'terminology_gate', result.provider);
  }

  console.log('\n== Group 4: KONTROL NEGATIF — jawaban singkat "SHM" atas pertanyaan AI tidak salah tertangkap ==');
  {
    ok('tryTerminologyAnswer("SHM") = null (bukan pertanyaan)', tryTerminologyAnswer('SHM') === null);
  }

  console.log('\n== Group 5: qual gate LENGKAP + pertanyaan istilah → jawab istilah saja, tidak memaksa Q lagi ==');
  {
    const result = await generateWhatsAppAIReply({
      session: session(),
      message: 'Rumah di Surabaya yang mau saya sewa, budget 5 juta/bulan, itu sertifikatnya SHM atau SHGB?',
      agentName: 'Test Agent',
      agentUserId: 'TEST_M132',
    });
    ok('provider = terminology_gate walau info kualifikasi sudah lengkap di pesan yang sama',
      result.provider === 'terminology_gate', result.provider);
    ok('balasan tidak mengulang pertanyaan sewa/beli (info sudah ada)',
      !/rencananya untuk \*sewa\* atau \*beli\*/i.test(result.reply), result.reply.slice(0, 200));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

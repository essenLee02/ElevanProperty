/**
 * terminologyAnswerGate.test.js — regresi M129 (Private Agent).
 *
 * Permintaan pemilik proyek: AI (termasuk Private Agent, fallback
 * deterministik) harus bisa mendeteksi pertanyaan customer soal istilah
 * legal/pembiayaan properti (SHM, SHGB, SHSRS, AJB, BPHTB, KPR, dll.) dan
 * menjawabnya — walau pertanyaan itu muncul di tengah alur kualifikasi.
 *
 * ⚠️ TEMUAN SAAT MEMBANGUN FITUR INI: "apa itu SHM?" SUDAH lolos
 * hasPropertyKeyword() (SHM/KPR dikenali sebagai kata kunci properti biasa)
 * — artinya pesan ini TIDAK PERNAH masuk cabang off-topic sama sekali di
 * generateResponseForTerminalMassege(). Menaruh jawaban terminologi HANYA di
 * dalam kedua guard off-topic (seperti #tryKnowledgeAnswer/RAG yang sudah
 * ada) membuatnya TIDAK PERNAH terpanggil untuk kasus yang justru paling
 * umum. Fix: cek terminologi TIDAK BERSYARAT sebelum kedua guard.
 *
 * ⚠️ RAG TIDAK CUKUP ANDAL UNTUK INI (diverifikasi langsung): query pendek
 * seperti "apa itu SHM" hanya skor ~0.09 di mode embedding lokal — jauh di
 * bawah ambang 0.30 Private Agent. Mode `openai` (semantik asli) tidak bisa
 * diverifikasi sesi ini (CHAT_GPT_API_KEY menolak endpoint embeddings, HTTP
 * 401 — masalah kredensial terpisah). Karena itu jawaban ini DETERMINISTIK
 * (pencocokan keyword), bukan bergantung RAG_ENABLED sama sekali.
 *
 * Run: node tests/terminologyAnswerGate.test.js
 */
'use strict';

require('dotenv').config();
const { generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const SESSION = { id: 999001, name: 'Test', agentName: 'Test Agent' };

async function ask(userMessage, history = []) {
  const result = await generatePrivateTerminalMassege({
    session: SESSION, history, userMessage, agentName: 'Test Agent',
    recommendationContext: null, externalError: new Error('test'),
  });
  return result?.reply || '';
}

async function main() {
  console.log('\n== Group 1: pertanyaan terminologi DIJAWAB, bukan diam-diam masuk Q-flow ==');
  {
    const r1 = await ask('apa itu SHM?');
    ok('"apa itu SHM?" dijawab dengan penjelasan SHM', /kepemilikan/i.test(r1) && /selamanya/i.test(r1), r1.slice(0, 100));
    ok('"apa itu SHM?" TIDAK menanyakan Q1 (sewa/beli/tipe)', !/sewa\s+atau\s+beli/i.test(r1));

    const r2 = await ask('KPR itu gimana caranya?');
    ok('"KPR itu gimana caranya?" dijawab dengan penjelasan KPR', /subsidi/i.test(r2) && /nonsubsidi/i.test(r2), r2.slice(0, 100));

    const r3 = await ask('SHGB itu apa ya?');
    ok('"SHGB itu apa ya?" dijawab dengan penjelasan SHGB (bukan SHM)', /guna\s+bangunan/i.test(r3), r3.slice(0, 100));

    const r4 = await ask('bedanya AJB sama PPJB apa?');
    ok('"bedanya AJB sama PPJB apa?" dijawab (AJB dicek lebih dulu)', /akta\s+jual\s+beli/i.test(r4), r4.slice(0, 100));
  }

  console.log('\n== Group 2: MID-FLOW — pertanyaan terminologi tetap dijawab di tengah kualifikasi ==');
  {
    const history = [
      { role: 'customer', message: 'Saya mau beli rumah di Surabaya' },
      { role: 'ai', message: 'Untuk beli Rumah di Surabaya, kisaran harga berapa?' },
      { role: 'customer', message: '500-700 juta' },
      { role: 'ai', message: 'Untuk pembiayaan, rencananya cash atau KPR?' },
    ];
    const r = await ask('eh btw KPR itu maksudnya apa ya?', history);
    ok('pertanyaan terminologi MID-FLOW tetap dijawab (bukan dianggap off-topic/diabaikan)',
      /subsidi/i.test(r), r.slice(0, 100));
  }

  console.log('\n== Group 3: KONTROL NEGATIF — jawaban singkat atas pertanyaan sertifikat TIDAK salah tertangkap ==');
  {
    // AI baru saja menanyakan sertifikat; customer menjawab "SHM" — ini
    // JAWABAN PILIHAN, bukan pertanyaan "apa itu SHM". Harus TIDAK match
    // #tryTerminologyAnswer (tidak ada tanda tanya/kata tanya).
    const history = [
      { role: 'customer', message: 'Saya mau beli rumah di Surabaya, budget 700 juta' },
      { role: 'ai', message: 'Untuk sertifikatnya, maunya SHM atau SHGB?' },
    ];
    const r = await ask('SHM', history);
    ok('jawaban singkat "SHM" TIDAK dibalas dengan definisi SHM (bukan pertanyaan)',
      !/kepemilikan\s+properti\s+tertinggi/i.test(r), r.slice(0, 150));
  }

  console.log('\n== Group 4: KONTROL — pertanyaan properti biasa tidak terganggu ==');
  {
    const r = await ask('Saya mau sewa rumah di Malang');
    ok('pesan biasa (bukan pertanyaan terminologi) tidak dijawab dengan definisi SHM/KPR',
      !/kepemilikan\s+properti\s+tertinggi/i.test(r) && !/kredit\s+pemilikan\s+rumah/i.test(r), r.slice(0, 100));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

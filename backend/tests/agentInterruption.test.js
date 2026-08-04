/**
 * agentInterruption.test.js
 *
 * Fitur baru (4 Agu 2026): saat AI sedang mengobrol dengan seorang customer,
 * lalu agent TIBA-TIBA chat LANGSUNG ke customer itu (bukan ke nomornya
 * sendiri, bukan lewat perintah eksplisit "matikan AI") — AI harus BERHENTI
 * SEPENUHNYA untuk customer itu. Tindakan mengetik itu sendiri sudah cukup
 * sebagai sinyal "saya ambil alih", tidak perlu kata kunci apa pun.
 *
 * Mekanisme: webhook meng-echo pesan KELUAR sebagai `fromMe:true`. Setiap
 * balasan AI selalu punya footer "Sent via <AI_PRIMARY_TAG>" (appendSentViaTag).
 * Sebuah fromMe:true TANPA footer itu PASTI ketikan manual agent (satu-satunya
 * sumber lain untuk event fromMe:true adalah pipeline AI kita sendiri).
 *
 * SETIAP pesan manual (bukan hanya yang PERTAMA memicu handover) dicatat ke
 * chat_messages sebagai role='ai', ai_responder='agent interruption' — dulu
 * pesan-pesan ini hilang total dari transkrip (fromMe:true selalu di-skip
 * mentah-mentah tanpa pernah disimpan).
 *
 * ⚠️ Test ini menyentuh DB nyata (customers + chat_sessions + chat_messages)
 * — pakai baris SEMENTARA yang dibuat & dihapus sendiri, tidak menyentuh
 * data produksi.
 */
process.env.AI_PRIMARY_TAG = process.env.AI_PRIMARY_TAG || 'propmatches.netlify.app';

const { maybeHandleAgentInterruption } = require('../services/customerAiToggleService');
const { Customer, ChatSession, ChatMessage } = require('../models');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const TEST_AGENT = { user_id: 'TESTAGENT_INTERRUPT', name: 'Test Agent Interrupt' };
const TEST_PHONE = '62811111199901';
const PLATFORM   = 'kirimi';

async function cleanup() {
  const source = `${PLATFORM}_${TEST_AGENT.name.toLowerCase().replace(/\s+/g, '_')}`;
  const sessions = await ChatSession.findAll({ where: { normalizedPhone: TEST_PHONE, source } });
  for (const s of sessions) await ChatMessage.destroy({ where: { chatSessionId: s.id } });
  await ChatSession.destroy({ where: { normalizedPhone: TEST_PHONE, source } });
  await Customer.destroy({ where: { user_id: TEST_AGENT.user_id, phone: TEST_PHONE } });
}

async function latestLoggedRow() {
  return ChatMessage.findOne({
    where: { customer_phone: TEST_PHONE, ai_responder: 'agent interruption' },
    order: [['id', 'DESC']],
  });
}

async function main() {
  await cleanup();
  await Customer.create({
    user_id: TEST_AGENT.user_id, customer_id: 'TSTCUST001', name: 'Test Customer',
    phone: TEST_PHONE, ai_response: 'ON', status: 1,
    created_date: '2026-08-04', created_by: TEST_AGENT.user_id,
  });

  console.log('\n── Balasan AI sendiri (ada footer) → TIDAK menonaktifkan, TIDAK dicatat sebagai interupsi ──');
  {
    const aiMsg = `Baik, Kak! Saya catat.\n\n> _Sent via ${process.env.AI_PRIMARY_TAG}_`;
    const r = await maybeHandleAgentInterruption({ customerPhone: TEST_PHONE, message: aiMsg, agent: TEST_AGENT, platform: PLATFORM });
    const row = await Customer.findOne({ where: { user_id: TEST_AGENT.user_id, phone: TEST_PHONE } });
    ok('return null (bukan interupsi)', r === null);
    ok('ai_response tetap ON', row.ai_response === 'ON');
    ok('tidak ada baris agent-interruption tercatat', !(await latestLoggedRow()));
  }

  console.log('\n── Agent mengetik manual (tanpa footer) → HARUS menonaktifkan + tercatat ──');
  {
    const text = 'Halo kak, ini saya langsung ya, soal unitnya...';
    const r = await maybeHandleAgentInterruption({ customerPhone: TEST_PHONE, message: text, agent: TEST_AGENT, platform: PLATFORM, customerName: 'Test Customer' });
    const row = await Customer.findOne({ where: { user_id: TEST_AGENT.user_id, phone: TEST_PHONE } });
    ok('handedOver: true', r && r.handedOver === true);
    ok('ai_response menjadi OFF', row.ai_response === 'OFF');

    const logged = await latestLoggedRow();
    ok('tercatat ke chat_messages', !!logged);
    ok('role = ai',                  logged.role === 'ai');
    ok('ai_responder = "agent interruption"', logged.ai_responder === 'agent interruption');
    ok('customer_phone benar',       logged.customer_phone === TEST_PHONE);
    ok('message = teks asli agent',  logged.message === text);
    ok('user_id = agent pemilik',    logged.user_id === TEST_AGENT.user_id);
  }

  console.log('\n── Sudah OFF, agent ketik lagi → TIDAK re-toggle, TAPI tetap dicatat ──');
  {
    const text2 = 'oke kak, saya proses ya';
    const r = await maybeHandleAgentInterruption({ customerPhone: TEST_PHONE, message: text2, agent: TEST_AGENT, platform: PLATFORM });
    const row = await Customer.findOne({ where: { user_id: TEST_AGENT.user_id, phone: TEST_PHONE } });
    ok('handedOver: false (sudah OFF sebelumnya)', r && r.handedOver === false);
    ok('ai_response tetap OFF',                     row.ai_response === 'OFF');

    const logged = await latestLoggedRow();
    ok('pesan LANJUTAN tetap tercatat (bukan hanya yang pertama)', logged.message === text2);
  }

  console.log('\n── Nomor bukan customer terdaftar agent ini → no-op, tidak tercatat ──');
  {
    const r = await maybeHandleAgentInterruption({ customerPhone: '62899999999999', message: 'halo random', agent: TEST_AGENT, platform: PLATFORM });
    ok('return null (nomor tak dikenal)', r === null);
  }

  console.log('\n── AI_PRIMARY_TAG kosong → fail-safe, tidak pernah aktif ──');
  {
    await Customer.update({ ai_response: 'ON' }, { where: { user_id: TEST_AGENT.user_id, phone: TEST_PHONE } });
    const beforeCount = await ChatMessage.count({ where: { customer_phone: TEST_PHONE, ai_responder: 'agent interruption' } });
    const orig = process.env.AI_PRIMARY_TAG;
    process.env.AI_PRIMARY_TAG = '';
    const r = await maybeHandleAgentInterruption({ customerPhone: TEST_PHONE, message: 'ketikan manual tanpa tag aktif', agent: TEST_AGENT, platform: PLATFORM });
    process.env.AI_PRIMARY_TAG = orig;
    const row = await Customer.findOne({ where: { user_id: TEST_AGENT.user_id, phone: TEST_PHONE } });
    const afterCount = await ChatMessage.count({ where: { customer_phone: TEST_PHONE, ai_responder: 'agent interruption' } });
    ok('return null (tag kosong = fitur mati)', r === null);
    ok('ai_response TIDAK berubah (tetap ON)', row.ai_response === 'ON');
    ok('tidak ada baris baru tercatat', afterCount === beforeCount);
  }

  await cleanup();

  console.log(`\nRESULT: ${pass}/${total}`);
  process.exit(pass === total ? 0 : 1);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

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

  console.log('\n── SELF-CHAT: agent mengetik ke NOMORNYA SENDIRI → JANGAN pernah handover ──');
  {
    // Jalur perintah pribadi agent ("matikan AI 62812…", toggle katalog sebelum
    // summary). Mematikan AI untuk nomor agent sendiri adalah efek samping salah.
    const SELF = '62822222299902';
    const selfAgent = { ...TEST_AGENT, phone: SELF };
    await Customer.destroy({ where: { user_id: TEST_AGENT.user_id, phone: SELF } });
    await Customer.create({
      user_id: TEST_AGENT.user_id, customer_id: 'TSTSELF001', name: 'Agent Self',
      phone: SELF, ai_response: 'ON', status: 1,
      created_date: '2026-08-05', created_by: TEST_AGENT.user_id,
    });
    const r = await maybeHandleAgentInterruption({
      customerPhone: SELF, message: 'matikan AI 628123456789', agent: selfAgent, platform: PLATFORM,
    });
    const row = await Customer.findOne({ where: { user_id: TEST_AGENT.user_id, phone: SELF } });
    ok('return null (self-chat, bukan interupsi)', r === null);
    ok('ai_response nomor agent sendiri TIDAK dimatikan', row.ai_response === 'ON');
    await Customer.destroy({ where: { user_id: TEST_AGENT.user_id, phone: SELF } });
  }

  console.log('\n── Interupsi SEBELUM summary (customer belum terdaftar, tapi sudah ada sesi) ──');
  {
    // Bug produksi 5 Agu 2026: baris `customers` baru dibuat saat AI mengirim
    // SUMMARY, sedangkan agent mengambil alih jauh sebelum itu → handover batal
    // diam-diam (row null) dan AI tetap ikut menjawab beberapa menit kemudian.
    const NEW = '62833333399903';
    const source = `${PLATFORM}_${TEST_AGENT.name.toLowerCase().replace(/\s+/g, '_')}`;
    await Customer.destroy({ where: { user_id: TEST_AGENT.user_id, phone: NEW } });
    const sess = await ChatSession.create({
      name: 'Prospek Baru', normalizedName: 'prospek baru',
      phone: NEW, normalizedPhone: NEW, source,
    });

    const r = await maybeHandleAgentInterruption({
      customerPhone: NEW, message: 'Mau beli rumah di area mana, Kak?',
      agent: TEST_AGENT, platform: PLATFORM, customerName: 'Prospek Baru',
    });
    const row = await Customer.findOne({ where: { user_id: TEST_AGENT.user_id, phone: NEW } });
    ok('handedOver: true walau customer belum terdaftar sebelumnya', r && r.handedOver === true);
    ok('baris customer dibuat otomatis', !!row);
    ok('ai_response = OFF (AI berhenti ikut campur)', row && row.ai_response === 'OFF');

    const logged = await ChatMessage.findOne({
      where: { customer_phone: NEW, ai_responder: 'agent interruption' }, order: [['id', 'DESC']],
    });
    ok('pesan manual agent tercatat di transkrip', !!logged);

    await ChatMessage.destroy({ where: { chatSessionId: sess.id } });
    await ChatSession.destroy({ where: { id: sess.id } });
    await Customer.destroy({ where: { user_id: TEST_AGENT.user_id, phone: NEW } });
  }

  console.log('\n── Nomor luar TANPA sesi chat → tetap no-op (jangan cemari master customer) ──');
  {
    // Device WhatsApp yang sama juga dipakai agent mengobrol dengan teman/vendor.
    const OUTSIDER = '62844444499904';
    await Customer.destroy({ where: { user_id: TEST_AGENT.user_id, phone: OUTSIDER } });
    const r = await maybeHandleAgentInterruption({
      customerPhone: OUTSIDER, message: 'nanti ketemu jam 7 ya', agent: TEST_AGENT, platform: PLATFORM,
    });
    const row = await Customer.findOne({ where: { user_id: TEST_AGENT.user_id, phone: OUTSIDER } });
    ok('return null (tidak ada sesi chat dengan bot)', r === null);
    ok('TIDAK membuat baris customer untuk nomor luar', !row);
  }

  await cleanup();

  console.log(`\nRESULT: ${pass}/${total}`);
  process.exit(pass === total ? 0 : 1);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

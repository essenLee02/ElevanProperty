/**
 * askNameFlow.test.js — regresi fitur `customers.ask_name` (M123).
 *
 * Spesifikasi (permintaan pemilik proyek, 20 Agu 2026):
 *   - customers.ask_name STRING(5) NOT NULL default 'NO'.
 *   - Customer baru (chat pertama, on-topic) → didaftarkan dengan ask_name='NO',
 *     name = default WhatsApp (pushname).
 *   - AI WAJIB menanyakan nama sebelum menampilkan summary.
 *   - Customer MENJAWAB nama → customers.name diupdate ke nama itu, ask_name→'YES'.
 *   - Customer MENOLAK menyebutkan nama → ask_name TETAP menjadi 'YES' (jangan
 *     tanya lagi), name TETAP nama default WhatsApp (tidak diubah).
 *   - ask_name='YES' → AI TIDAK PERNAH bertanya nama lagi ke customer ini.
 *   - Percakapan off-topic → TIDAK disimpan ke DB / TIDAK dijawab AI (sudah
 *     diverifikasi sebagai perilaku EXISTING di kirimiChatController.js,
 *     bukan bagian baru fitur ini — lihat catatan di akhir file).
 *
 * ⚠️ Test ini menyentuh DB nyata (customers + chat_sessions + chat_messages),
 * pola sama dengan agentInterruption.test.js — baris SEMENTARA dibuat & dihapus
 * sendiri, tidak menyentuh data produksi.
 *
 * Run: node tests/askNameFlow.test.js
 */
'use strict';

require('dotenv').config();
const { Customer, ChatSession, ChatMessage } = require('../models');
const {
  registerCustomerFromChat,
  getIdentityStatus,
  syncCustomerFromChat,
  replyContainsSummary,
} = require('../services/customerRegistrationService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const AGENT = { user_id: 'TESTAGENT_ASKNAME', name: 'Test Agent AskName' };
const PLATFORM = 'kirimi';

function phoneFor(tag) { return `6281${String(tag).padStart(9, '5')}`; }

async function cleanup(phone) {
  const source = `${PLATFORM}_${AGENT.name.toLowerCase().replace(/\s+/g, '_')}`;
  const sessions = await ChatSession.findAll({ where: { normalizedPhone: phone, source } });
  for (const s of sessions) await ChatMessage.destroy({ where: { chatSessionId: s.id } });
  await ChatSession.destroy({ where: { normalizedPhone: phone, source } });
  await Customer.destroy({ where: { user_id: AGENT.user_id, phone } });
}

async function makeSession(phone, name) {
  const source = `${PLATFORM}_${AGENT.name.toLowerCase().replace(/\s+/g, '_')}`;
  return ChatSession.create({
    name, normalizedName: name.toLowerCase(),
    phone, normalizedPhone: phone, source, location: null, normalizedLocation: null,
  });
}

// ⚠️ Pesan berturut-turut yang dibuat dalam milidetik yang SAMA bisa membuat
// `ORDER BY createdAt DESC` (getConversationHistory, sessionService.js) tidak
// deterministik — tidak ada tie-break kolom kedua (mis. `id`). Di produksi
// jeda antar pesan nyata (network/AI generation) mencegah ini; di test yang
// insert berturutan SANGAT cepat, harus dipaksa naik eksplisit agar urutan
// yang diuji benar-benar mencerminkan kronologi produksi, bukan kebetulan
// tie-break DB. (Temuan ini di luar cakupan fitur ask_name — lihat catatan
// di akhir file.)
let _msgClock = Date.now() - 60_000;
async function addMsg(sessionId, role, message) {
  _msgClock += 1000;
  return ChatMessage.create({
    chatSessionId: sessionId, user_id: AGENT.user_id, role, message,
    channel: 'whatsapp', customer_phone: null, createdAt: new Date(_msgClock),
  });
}

async function main() {
  console.log('\n== Group 1: replyContainsSummary — marker deteksi tidak berubah ==');
  {
    ok('mendeteksi "✓ Rencana:"', replyContainsSummary('Baik, berikut ✓ Rencana: sewa rumah...'));
    ok('teks biasa BUKAN summary', !replyContainsSummary('Boleh tahu budget-nya berapa?'));
  }

  console.log('\n== Group 2: registerCustomerFromChat — INSERT ==');
  {
    const phone = phoneFor(1);
    await cleanup(phone);

    const r1 = await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, waName: 'Budi WA' });
    ok('insert tanpa chatName → ask_name NO', r1.customer.ask_name === 'NO', r1.customer.ask_name);
    ok('insert tanpa chatName → name = pushname WA', r1.customer.name === 'Budi WA');
    await cleanup(phone);

    const r2 = await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, chatName: 'Rina Asli', waName: 'Rina WA' });
    ok('insert DENGAN chatName (sudah kenalan sendiri) → ask_name langsung YES',
      r2.customer.ask_name === 'YES', r2.customer.ask_name);
    ok('insert DENGAN chatName → name = chatName (bukan pushname)', r2.customer.name === 'Rina Asli');
    await cleanup(phone);
  }

  console.log('\n== Group 3: registerCustomerFromChat — UPDATE (jawaban nama) ==');
  {
    const phone = phoneFor(2);
    await cleanup(phone);
    await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, waName: 'Default WA' });

    const r = await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, chatName: 'Kezia Sebenarnya' });
    ok('update dengan chatName → action updated', r.action === 'updated', r.action);
    ok('update dengan chatName → name berubah', r.customer.name === 'Kezia Sebenarnya');
    ok('update dengan chatName → ask_name jadi YES', r.customer.ask_name === 'YES');
    await cleanup(phone);
  }

  console.log('\n== Group 4: registerCustomerFromChat — UPDATE (PENOLAKAN) ==');
  {
    const phone = phoneFor(3);
    await cleanup(phone);
    await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, waName: 'Default WA Tolak' });

    // Customer menolak: nameQuestionResolved=true TAPI chatName tetap null.
    const r = await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, nameQuestionResolved: true });
    ok('penolakan → action updated (ask_name berubah)', r.action === 'updated', r.action);
    ok('penolakan → ask_name TETAP jadi YES (jangan tanya lagi)', r.customer.ask_name === 'YES');
    ok('penolakan → name TIDAK berubah (tetap default WA)', r.customer.name === 'Default WA Tolak');
    await cleanup(phone);
  }

  console.log('\n== Group 5: registerCustomerFromChat — sudah YES, tidak ada patch percuma ==');
  {
    const phone = phoneFor(4);
    await cleanup(phone);
    await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, chatName: 'Sudah Tahu' }); // ask_name→YES saat insert

    const r = await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, nameQuestionResolved: true });
    ok('sudah YES sebelumnya → tidak ada patch baru (action exists)', r.action === 'exists', r.action);
    await cleanup(phone);
  }

  console.log('\n== Group 6: getIdentityStatus — expose askName otoritatif ==');
  {
    const phone = phoneFor(5);
    await cleanup(phone);
    await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, waName: 'Cek Status' });

    const s1 = await getIdentityStatus({ agentUserId: AGENT.user_id, phone });
    ok('baru terdaftar → askName = NO', s1.askName === 'NO', s1.askName);

    await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, nameQuestionResolved: true });
    const s2 = await getIdentityStatus({ agentUserId: AGENT.user_id, phone });
    ok('setelah resolusi → askName = YES', s2.askName === 'YES', s2.askName);

    const empty = await getIdentityStatus({ agentUserId: AGENT.user_id, phone: phoneFor(999) });
    ok('nomor tidak terdaftar → askName = null (bukan NO/YES, aman untuk gerbang tanya)',
      empty.askName === null, empty.askName);
    await cleanup(phone);
  }

  console.log('\n== Group 7: syncCustomerFromChat END-TO-END — jawab nama ==');
  {
    const phone = phoneFor(6);
    await cleanup(phone);
    await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, waName: 'Andi WA' });
    const session = await makeSession(phone, 'Andi WA');

    // Giliran SEBELUMNYA: AI bertanya nama. Giliran INI: customer menjawab, DAN
    // AI sudah membalas (mensimulasikan urutan produksi: kedua ChatMessage
    // giliran ini SUDAH tersimpan sebelum syncCustomerFromChat dipanggil —
    // lihat kirimiChatController.js baris 623/657/673).
    await addMsg(session.id, 'ai', 'Sebelum saya sampaikan ringkasannya — boleh saya tahu nama Kakak? 😊');
    const currentMessage = 'Nama saya Andi Wijaya';
    const reply = 'Terima kasih Andi! Berikut ✓ Rencana: sewa rumah di Malang...';
    await addMsg(session.id, 'customer', currentMessage);
    await addMsg(session.id, 'ai', reply);

    await syncCustomerFromChat({
      reply, sessionId: session.id, currentMessage,
      agentUserId: AGENT.user_id, phone, waName: 'Andi WA',
    });

    const row = await Customer.findOne({ where: { user_id: AGENT.user_id, phone } });
    ok('nama terupdate dari jawaban', row.name === 'Andi Wijaya', row.name);
    ok('ask_name jadi YES', row.ask_name === 'YES');
    await cleanup(phone);
  }

  console.log('\n== Group 8: syncCustomerFromChat END-TO-END — MENOLAK sebutkan nama ==');
  {
    const phone = phoneFor(7);
    await cleanup(phone);
    await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, waName: 'Citra WA' });
    const session = await makeSession(phone, 'Citra WA');

    await addMsg(session.id, 'ai', 'Sebelum saya sampaikan ringkasannya — boleh saya tahu nama Kakak? 😊');
    const currentMessage = 'gak usah ya';
    const reply = 'Baik, tidak masalah! Berikut ✓ Rencana: sewa apartemen di Surabaya...';
    await addMsg(session.id, 'customer', currentMessage);
    await addMsg(session.id, 'ai', reply);

    await syncCustomerFromChat({
      reply, sessionId: session.id, currentMessage,
      agentUserId: AGENT.user_id, phone, waName: 'Citra WA',
    });

    const row = await Customer.findOne({ where: { user_id: AGENT.user_id, phone } });
    ok('nama TIDAK berubah (tetap pushname WA)', row.name === 'Citra WA', row.name);
    ok('ask_name TETAP jadi YES walau menolak', row.ask_name === 'YES');
    await cleanup(phone);
  }

  console.log('\n== Group 9: KONTROL NEGATIF — AI TIDAK bertanya nama giliran sebelumnya ==');
  {
    const phone = phoneFor(8);
    await cleanup(phone);
    await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, waName: 'Dedi WA' });
    const session = await makeSession(phone, 'Dedi WA');

    // Giliran sebelumnya AI bertanya BUDGET, bukan nama.
    await addMsg(session.id, 'ai', 'Budget yang Kakak inginkan berapa?');
    const currentMessage = '500 juta';
    const reply = 'Baik, dicatat 500 juta. Lokasi yang diinginkan di mana?';
    await addMsg(session.id, 'customer', currentMessage);
    await addMsg(session.id, 'ai', reply);

    await syncCustomerFromChat({
      reply, sessionId: session.id, currentMessage,
      agentUserId: AGENT.user_id, phone, waName: 'Dedi WA',
    });

    const row = await Customer.findOne({ where: { user_id: AGENT.user_id, phone } });
    ok('ask_name TETAP NO (pertanyaan giliran lalu bukan soal nama)', row.ask_name === 'NO', row.ask_name);
    await cleanup(phone);
  }

  console.log('\n== Group 10: KONTROL — sudah YES, giliran berikutnya tidak diusik lagi ==');
  {
    const phone = phoneFor(9);
    await cleanup(phone);
    await registerCustomerFromChat({ agentUserId: AGENT.user_id, phone, chatName: 'Sudah Lengkap' }); // ask_name→YES
    const session = await makeSession(phone, 'Sudah Lengkap');

    // AI TIDAK seharusnya menanyakan nama lagi (gerbang di whatsappAIService.js
    // sudah mencegah ini di sisi ASK; test ini memverifikasi sisi RESOLUSI tidak
    // rusak walau — secara hipotetis — pertanyaan nama muncul lagi karena bug
    // lain: ask_name harus tetap YES, tidak boleh flip-flop.
    await addMsg(session.id, 'ai', 'Terima kasih! Ada yang bisa dibantu lagi?');
    const currentMessage = 'Tidak ada, terima kasih';
    const reply = 'Sama-sama! Berikut ✓ Rencana: sewa ruko di Jakarta...';
    await addMsg(session.id, 'customer', currentMessage);
    await addMsg(session.id, 'ai', reply);

    await syncCustomerFromChat({
      reply, sessionId: session.id, currentMessage,
      agentUserId: AGENT.user_id, phone, waName: 'Sudah Lengkap',
    });

    const row = await Customer.findOne({ where: { user_id: AGENT.user_id, phone } });
    ok('ask_name tetap YES (tidak pernah kembali ke NO)', row.ask_name === 'YES');
    ok('name tetap "Sudah Lengkap" (tidak tertimpa)', row.name === 'Sudah Lengkap', row.name);
    await cleanup(phone);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

/*
 * CATATAN TEMUAN (di luar cakupan fitur ask_name, TIDAK diperbaiki di sini):
 * `getConversationHistory()` (services/sessionService.js) mengurutkan HANYA
 * dengan `ORDER BY createdAt DESC`, tanpa tie-break kolom kedua (mis. `id`).
 * Dibuktikan lewat debugging manual: 3 ChatMessage dibuat berturut-turut
 * (milidetik yang sama) kembali dalam urutan TERBALIK dari kronologi asli.
 * Di produksi jeda nyata antar pesan (network/generation AI) biasanya
 * mencegah tabrakan ini, tapi tidak dijamin (mis. webhook duplikat/burst).
 * Fungsi `extractQualificationState()`'s Phase 2 (loop pasangan AI↔customer)
 * BERGANTUNG pada urutan history yang benar — worth investigating separately.
 */

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

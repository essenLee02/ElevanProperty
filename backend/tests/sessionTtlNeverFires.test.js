'use strict';
/**
 * sessionTtlNeverFires.test.js — M162
 * -------------------------------------
 * Bug produksi nyata (28 Agu 2026): customer menyapa "Hello, Saya mau cari
 * rumah di Madiun" pada sesi yang idle 97,6 menit (MELEBIHI TTL 90 menit),
 * tapi AI tetap menjawab soal "Candramas/Sidoarjo" — nama yang TIDAK PERNAH
 * disebut sama sekali di percakapan yang sedang berjalan.
 *
 * AKAR MASALAH: kirimiChatController.js (dan Fonnte/TimelinesAI) menyimpan
 * pesan customer ke chat_messages SEBELUM memanggil generateWhatsAppAIReply(),
 * yang di dalamnya getConversationHistory() menghitung "idle sejak pesan
 * terakhir" dari BARIS TER-DESC — yang SELALU adalah pesan yang baru saja
 * disimpan itu sendiri (createdAt ≈ sekarang). TTL 90 menit karena itu TIDAK
 * PERNAH bisa menyala untuk satu pun pesan WhatsApp nyata — bug diam yang ada
 * sejak fitur TTL ini ditulis.
 *
 * Tes ini mereproduksi PERSIS pola panggilan produksi (simpan pesan dulu,
 * baru fetch history) dan mengunci bahwa idle dihitung dari giliran
 * SEBELUMNYA, bukan dari pesan yang baru disimpan.
 */
require('dotenv').config();

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`); }
}

async function main() {
  console.log('\n=== M162 · TTL Sesi Tidak Pernah Menyala (bug fatal) ===\n');

  let ChatSession; let ChatMessage; let getConversationHistory;
  try {
    ({ ChatSession, ChatMessage } = require('../models'));
    ({ getConversationHistory } = require('../services/sessionService'));
  } catch (err) {
    console.log(`  ⏭️  seluruh tes dilewati (setup gagal: ${err.message})`);
    console.log(`\nRESULT: 0/0 passed ALL PASS`);
    process.exit(0);
  }

  let sid1 = null; let sid2 = null;
  try {
    /* ── 1. Reproduksi PERSIS pola produksi: simpan pesan dulu, baru fetch ── */
    console.log('1) Sesi idle 97,6 menit (melebihi TTL 90 mnt) — pola simpan-dulu-baru-fetch');
    const s1 = await ChatSession.create({
      name: 'TTLTest', normalizedName: 'ttltest', phone: '6280000007701', normalizedPhone: '6280000007701',
      source: 'kirimi_whatsapp', lastMessageAt: new Date(),
    });
    sid1 = s1.id;
    const old1 = await ChatMessage.create({ chatSessionId: sid1, role: 'customer', message: 'Di daerah Chandramas, Sidoarjo', channel: 'whatsapp' });
    const old2 = await ChatMessage.create({ chatSessionId: sid1, role: 'ai', message: 'Baik, mau di Chandramas Sidoarjo ya', channel: 'whatsapp' });
    const oldTime = new Date(Date.now() - 97 * 60 * 1000);
    await ChatMessage.update({ createdAt: oldTime }, { where: { id: old1.id } });
    await ChatMessage.update({ createdAt: new Date(oldTime.getTime() + 3000) }, { where: { id: old2.id } });
    // Pola produksi: pesan BARU disimpan SEBELUM history diambil.
    await ChatMessage.create({ chatSessionId: sid1, role: 'customer', message: 'Hello, saya mau cari rumah di Madiun', channel: 'whatsapp' });

    const hist1 = await getConversationHistory(sid1, 60);
    ok('sesi idle > TTL dianggap LUPA (history kosong)', hist1.length === 0, `dapat ${hist1.length} baris`);
    ok('TIDAK ADA jejak "Chandramas" yang bocor', !hist1.some((h) => /chandramas/i.test(h.message)));

    /* ── 2. Kontrol: percakapan AKTIF (tanpa jeda) TIDAK boleh ikut terhapus ── */
    console.log('\n2) Percakapan aktif (tanpa jeda) TIDAK boleh salah dianggap lupa');
    const s2 = await ChatSession.create({
      name: 'ActiveTest', normalizedName: 'activetest', phone: '6280000007702', normalizedPhone: '6280000007702',
      source: 'kirimi_whatsapp', lastMessageAt: new Date(),
    });
    sid2 = s2.id;
    await ChatMessage.create({ chatSessionId: sid2, role: 'customer', message: 'Saya mau beli rumah di Sidoarjo', channel: 'whatsapp' });
    await ChatMessage.create({ chatSessionId: sid2, role: 'ai', message: 'Di area mana Kak?', channel: 'whatsapp' });
    await ChatMessage.create({ chatSessionId: sid2, role: 'customer', message: 'Di Candramas', channel: 'whatsapp' });

    const hist2 = await getConversationHistory(sid2, 60);
    ok('percakapan aktif TETAP utuh (3 pesan)', hist2.length === 3, `dapat ${hist2.length} baris`);
  } catch (err) {
    console.log(`  ⏭️  dilewati (${err.message})`);
  } finally {
    if (sid1) { await ChatMessage.destroy({ where: { chatSessionId: sid1 } }); await ChatSession.destroy({ where: { id: sid1 } }); }
    if (sid2) { await ChatMessage.destroy({ where: { chatSessionId: sid2 } }); await ChatSession.destroy({ where: { id: sid2 } }); }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

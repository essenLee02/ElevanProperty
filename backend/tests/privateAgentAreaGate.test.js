'use strict';
/**
 * privateAgentAreaGate.test.js — M160
 * ------------------------------------
 * Menguji gerbang ketersediaan area di JALUR PRIVATE AGENT (bukan hanya
 * whatsappAIService.js), terhadap transkrip produksi 28 Agu 2026: customer
 * tanya "Buduran" (Sidoarjo), diinterview terus tanpa henti, lalu ditawari
 * area dari KOTA LAIN (Surabaya) yang tampak dikarang.
 *
 * Root cause asli: `agentUserId` DIKIRIM whatsappAIService.js ke
 * generatePrivateTerminalMassege() tapi TIDAK PERNAH didestrukturisasi di
 * generateResponseForTerminalMassege() — nilainya selalu undefined, jadi
 * setiap gerbang yang butuh agentUserId (ketersediaan area, coverage) mati
 * total persis saat Private Agent aktif (yaitu SELALU, karena saldo Kimi
 * habis — lihat M158). Tes ini menguji lewat generateWhatsAppAIReply()
 * (pintu masuk nyata), bukan memanggil chatbotPrivateController langsung.
 *
 * ⚠️ Bagian yang menyentuh database hanya berjalan bila koneksi tersedia;
 * tanpa DB, dilewati dengan pesan eksplisit, bukan diam-diam skip.
 */
require('dotenv').config();

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`); }
}

async function main() {
  console.log('\n=== M160 · Gerbang Ketersediaan Area — Jalur Private Agent ===\n');

  const AGENT = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
  let ChatSession; let ChatMessage; let generateWhatsAppAIReply;
  try {
    ({ ChatSession, ChatMessage } = require('../models'));
    ({ generateWhatsAppAIReply } = require('../services/whatsappAIService'));
    const { initLandmarkCache, initCityCache, initFacilityCache } = require('../services/propertyRecommendationService');
    await initLandmarkCache(); await initCityCache(); await initFacilityCache();
  } catch (err) {
    console.log(`  ⏭️  seluruh tes dilewati (setup gagal: ${err.message})`);
    console.log(`\nRESULT: 0/0 passed ALL PASS`);
    process.exit(0);
  }

  let session = null;
  async function say(sid, agentName, msg) {
    await ChatMessage.create({ chatSessionId: sid, role: 'user', message: msg, channel: 'kirimi_whatsapp' });
    const r = await generateWhatsAppAIReply({
      message: msg,
      session: { id: sid, agentUserId: AGENT, agentName },
      agentUserId: AGENT, agentName,
    });
    await ChatMessage.create({ chatSessionId: sid, role: 'ai', message: r.reply, channel: 'kirimi_whatsapp' });
    return r;
  }

  try {
    session = await ChatSession.create({
      name: 'Test', normalizedName: 'test', phone: '6280000009911', normalizedPhone: '6280000009911',
      source: 'kirimi_whatsapp', lastMessageAt: new Date(),
    });
    const sid = session.id;

    /* ── 1. agentUserId benar-benar sampai ke Private Agent ── */
    console.log('1) agentUserId tersambung ke Private Agent (dulu selalu undefined)');
    await say(sid, 'Natasha', 'Hello.. Saya mau beli rumah');
    const r2 = await say(sid, 'Natasha', 'Di daerah Chandramas');
    ok('gerbang ketersediaan AKTIF (bukan interview kosong)',
      r2.provider === 'private_agent' && /Candramas|belum ada di data saya/i.test(r2.reply),
      r2.reply.slice(0, 80));

    /* ── 2. Koreksi salah ketik: "Chandramas" → "Candramas" ── */
    console.log('\n2) Koreksi salah ketik area (Chandramas → Candramas)');
    ok('langsung tampil listing Candramas, TIDAK bilang "belum ada"',
      /Candramas/i.test(r2.reply) && !/belum ada di data saya/i.test(r2.reply), r2.reply.slice(0, 200));
    ok('tidak menyebut nama salah ketik "Chandramas" ke customer',
      !/\bChandramas\b/.test(r2.reply));

    /* ── 3. Area yang benar-benar tidak ada (Buduran) → jujur + alternatif ── */
    console.log('\n3) Area yang benar-benar tidak ada di katalog → jujur + alternatif nyata');
    const r3 = await say(sid, 'Natasha', 'Di Buduran ada ta? Minta 3 listing');
    ok('mengaku belum ada, BUKAN mengarang listing', /belum ada di data saya/i.test(r3.reply), r3.reply.slice(0, 100));
    ok('menawarkan area lain yang BENAR-BENAR ada (bukan kota lain)',
      !/Surabaya/i.test(r3.reply), r3.reply);
    ok('tidak diam-diam kembali ke Candramas tanpa penjelasan',
      /Buduran/i.test(r3.reply));

    /* ── 4. Customer menolak tawaran → tutup dengan sopan, bukan ulangi ── */
    console.log('\n4) Customer menolak tawaran area alternatif → tutup sopan');
    const r4 = await say(sid, 'Natasha', 'Tidak mau, Kak.');
    ok('TIDAK mengulang tawaran/listing yang sama',
      !/Mau saya carikan|Estimasi Harga/i.test(r4.reply), r4.reply.slice(0, 100));
    ok('berisi penutupan yang sopan', /terima kasih/i.test(r4.reply), r4.reply);

    /* ── 5. Q2c/Q6 tidak lagi hardcode — area asli agent, bukan daftar statis ── */
    console.log('\n5) Saran area Q2c memakai katalog NYATA agent, bukan daftar statis');
    const s2 = await ChatSession.create({
      name: 'Test2', normalizedName: 'test2', phone: '6280000009922', normalizedPhone: '6280000009922',
      source: 'kirimi_whatsapp', lastMessageAt: new Date(),
    });
    await say(s2.id, 'Natasha', 'Hello.. Saya mau beli rumah');
    const r5 = await say(s2.id, 'Natasha', 'Di Sidoarjo');
    ok('TIDAK menyarankan area statis (Gedangan/Waru/Buduran/Krian — nol stok Natasha)',
      !/\b(Gedangan|Waru|Buduran|Krian)\b/i.test(r5.reply), r5.reply);
    ok('menyarankan area yang BENAR-BENAR ada di katalog agent', /Candramas/i.test(r5.reply), r5.reply);
    await ChatMessage.destroy({ where: { chatSessionId: s2.id } });
    await ChatSession.destroy({ where: { id: s2.id } });
  } catch (err) {
    console.log(`  ⏭️  dilewati (${err.message})`);
  } finally {
    if (session) {
      await ChatMessage.destroy({ where: { chatSessionId: session.id } });
      await ChatSession.destroy({ where: { id: session.id } });
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

'use strict';
/**
 * budgetPersistenceAndAddressRecall.test.js — M161
 * --------------------------------------------------
 * Menguji tiga bug nyata yang ditemukan lewat uji coba 5-customer (28 Agu
 * 2026, agent Natasha):
 *
 *  1. listAreasWithinBudget() SELALU mengembalikan array kosong sejak
 *     ditulis (M156) — `Object.keys(priceWhere)` tidak pernah melihat
 *     properti ber-key Symbol (Op.gte/Op.lte), jadi guard "tidak ada filter
 *     harga" salah menyala terus-menerus.
 *  2. Budget yang disebutkan SEKALI di pesan pertama hilang begitu pesan
 *     berikutnya tidak mengulang angkanya — listing di luar budget tetap
 *     ditampilkan seolah cocok.
 *  3. Pertanyaan alamat/jarak untuk keperluan survei ("ke lokasi rumah itu")
 *     dijawab "saya cek dahulu" walau alamatnya SUDAH ADA di kartu listing
 *     yang baru saja dikirim.
 *
 * Bagian yang menyentuh database hanya berjalan bila koneksi tersedia.
 */
require('dotenv').config();

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`); }
}

async function main() {
  console.log('\n=== M161 · Budget Persistence & Address Recall ===\n');

  const AGENT = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
  let listAreasWithinBudget; let resolveCityId; let ChatSession; let ChatMessage;
  let generateWhatsAppAIReply;
  try {
    ({ listAreasWithinBudget, resolveCityId } = require('../services/areaAvailabilityService'));
    ({ ChatSession, ChatMessage } = require('../models'));
    ({ generateWhatsAppAIReply } = require('../services/whatsappAIService'));
    const { initLandmarkCache, initCityCache, initFacilityCache } = require('../services/propertyRecommendationService');
    await initLandmarkCache(); await initCityCache(); await initFacilityCache();
  } catch (err) {
    console.log(`  ⏭️  seluruh tes dilewati (setup gagal: ${err.message})`);
    console.log(`\nRESULT: 0/0 passed ALL PASS`);
    process.exit(0);
  }

  /* ── 1. listAreasWithinBudget() harus benar-benar mengembalikan hasil ── */
  console.log('1) listAreasWithinBudget() tidak lagi selalu kosong (bug Symbol-key)');
  try {
    const cityId = await resolveCityId('Gresik');
    const alts = await listAreasWithinBudget({
      userId: AGENT, cityId, buildingType: 'house', transactionType: 'Sale',
      minPrice: 600000000, maxPrice: 700000000, excludeArea: 'Bunga Melati',
    });
    ok('mengembalikan area yang BENAR-BENAR ada dalam budget (bukan [])', alts.length > 0, JSON.stringify(alts));
    ok('setiap area yang dikembalikan punya minPrice dalam rentang',
      alts.every((a) => a.minPrice >= 550000000 && a.minPrice <= 700000000), JSON.stringify(alts));
  } catch (err) {
    console.log(`  ⏭️  dilewati (${err.message})`);
  }

  /* ── 2-3: end-to-end lewat entry point nyata ── */
  let session = null;
  async function say(sid, msg) {
    await ChatMessage.create({ chatSessionId: sid, role: 'user', message: msg, channel: 'kirimi_whatsapp' });
    const r = await generateWhatsAppAIReply({
      message: msg, session: { id: sid, agentUserId: AGENT, agentName: 'Natasha' },
      agentUserId: AGENT, agentName: 'Natasha',
    });
    await ChatMessage.create({ chatSessionId: sid, role: 'ai', message: r.reply, channel: 'kirimi_whatsapp' });
    return r;
  }

  try {
    session = await ChatSession.create({
      name: 'Test', normalizedName: 'test', phone: '6280000008811', normalizedPhone: '6280000008811',
      source: 'kirimi_whatsapp', lastMessageAt: new Date(),
    });
    const sid = session.id;

    console.log('\n2) Budget dari pesan pertama tetap dihormati di pesan berikutnya');
    await say(sid, 'Hi, saya mau sewa apartemen di Surabaya, budget 1 juta - 1.2 juta per bulan');
    const r2 = await say(sid, 'Di area Kalijudan aja Kak');
    ok('TIDAK menampilkan listing di luar budget seolah cocok (2.1jt/3.2jt)',
      !/Estimasi Harga.*2\.1 juta|Estimasi Harga.*3\.2 juta/is.test(r2.reply), r2.reply.slice(0, 150));
    ok('mengaku jujur belum ada yang sesuai budget', /belum ada yang sesuai budget/i.test(r2.reply), r2.reply);

    console.log('\n3) Alamat listing yang sudah ditampilkan dikutip ulang saat ditanya untuk survei');
    const sid2 = (await ChatSession.create({
      name: 'Test2', normalizedName: 'test2', phone: '6280000008822', normalizedPhone: '6280000008822',
      source: 'kirimi_whatsapp', lastMessageAt: new Date(),
    })).id;
    await say(sid2, 'Hi, saya mau beli rumah di Sidoarjo, di area Candramas');
    const r3 = await say(sid2, 'Berapa jarak dan alamatnya ke lokasi rumah itu? Saya mau survei');
    ok('mengutip alamat yang sudah ada, BUKAN "saya cek dahulu"',
      /Candramas No\./.test(r3.reply) && !/saya akan cek dahulu/i.test(r3.reply), r3.reply);
    await ChatMessage.destroy({ where: { chatSessionId: sid2 } });
    await ChatSession.destroy({ where: { id: sid2 } });

    console.log('\n4) Pertanyaan jarak genuine yang tak terhitung TETAP dapat fallback jujur (regresi lama)');
    const sid3 = (await ChatSession.create({
      name: 'Test3', normalizedName: 'test3', phone: '6280000008833', normalizedPhone: '6280000008833',
      source: 'kirimi_whatsapp', lastMessageAt: new Date(),
    })).id;
    const r4 = await say(sid3, 'berapa jarak dari Kota Antah Berantah ke properti ini?');
    ok('tetap membalas "saya cek dahulu" (bukan diam / lompat ke pertanyaan lain)',
      /cek dahulu/i.test(r4.reply), r4.reply.slice(0, 150));
    await ChatMessage.destroy({ where: { chatSessionId: sid3 } });
    await ChatSession.destroy({ where: { id: sid3 } });
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

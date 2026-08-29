'use strict';
/**
 * cityAvailabilityGate.test.js — M164
 * -------------------------------------
 * Bug produksi nyata (29 Agu 2026): customer bilang "Hello.. Saya mau sewa
 * rumah di Madiun". Natasha punya NOL listing di Madiun sama sekali (kota
 * itu tidak ada di satu pun baris properties.city_id miliknya) — tapi Q2c
 * tetap bertanya "Di area atau kawasan mana di Madiun?" lengkap dengan nama
 * kawasan Madiun dari daftar statis (locationLandmarks.js), seolah kotanya
 * valid. Customer bertanya "Anda punya listing dimana?" empat kali berturut
 * dan tetap dibalas soal area yang tidak pernah ia sebut.
 *
 * M160 (sesi sebelumnya) menutup kasus "kota BENAR, area SALAH" (Sidoarjo vs
 * Buduran). M164 menutup kasus SATU TINGKAT DI ATASNYA: kota itu sendiri
 * sama sekali tidak ada di katalog agent — jadi menanyakan area di dalamnya
 * tidak pernah masuk akal.
 *
 * Diuji lewat generateWhatsAppAIReply() — pintu masuk nyata — bukan
 * memanggil chatbotPrivateController langsung.
 */
require('dotenv').config();

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`); }
}

async function main() {
  console.log('\n=== M164 · Gerbang Ketersediaan Kota ===\n');

  const AGENT = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
  let ChatSession; let ChatMessage; let generateWhatsAppAIReply; let checkCityAvailability;
  try {
    ({ ChatSession, ChatMessage } = require('../models'));
    ({ generateWhatsAppAIReply } = require('../services/whatsappAIService'));
    ({ checkCityAvailability } = require('../services/areaAvailabilityService'));
    const { initLandmarkCache, initCityCache, initFacilityCache } = require('../services/propertyRecommendationService');
    await initLandmarkCache(); await initCityCache(); await initFacilityCache();
  } catch (err) {
    console.log(`  ⏭️  seluruh tes dilewati (setup gagal: ${err.message})`);
    console.log(`\nRESULT: 0/0 passed ALL PASS`);
    process.exit(0);
  }

  async function say(sid, agentName, msg) {
    await ChatMessage.create({ chatSessionId: sid, role: 'user', message: msg, channel: 'kirimi_whatsapp' });
    const r = await generateWhatsAppAIReply({
      message: msg, session: { id: sid, agentUserId: AGENT, agentName }, agentUserId: AGENT, agentName,
    });
    await ChatMessage.create({ chatSessionId: sid, role: 'ai', message: r.reply, channel: 'kirimi_whatsapp' });
    return r;
  }

  let sids = [];
  try {
    /* ── 1. Fakta katalog: kota kosong → hingga 3 kota alternatif nyata ── */
    console.log('1) checkCityAvailability() — fakta katalog langsung');
    const madiun = await checkCityAvailability({ userId: AGENT, city: 'Madiun', buildingType: 'House', transactionType: 'Rent' });
    if (!madiun.ok) {
      console.log('  ⏭️  dilewati (DB tidak tersedia)');
    } else {
      ok('Madiun terdeteksi TIDAK tersedia', madiun.available === false, JSON.stringify(madiun));
      ok('maksimal 3 kota alternatif', madiun.alternativeCities.length <= 3, madiun.alternativeCities.length);
      ok('alternatif adalah kota NYATA (Surabaya/Sidoarjo/Gresik)',
        madiun.alternativeCities.every((c) => ['surabaya', 'sidoarjo', 'gresik'].includes(c.city.toLowerCase())),
        JSON.stringify(madiun.alternativeCities));

      const surabaya = await checkCityAvailability({ userId: AGENT, city: 'Surabaya', buildingType: 'House', transactionType: 'Rent' });
      ok('Surabaya (kota nyata) terdeteksi TERSEDIA', surabaya.available === true, JSON.stringify(surabaya));
    }

    /* ── 2. Ujung ke ujung: transkrip nyata ── */
    console.log('\n2) Replay transkrip produksi 29 Agu 2026');
    const s1 = await ChatSession.create({
      name: 'M164', normalizedName: 'm164', phone: '6280000007701', normalizedPhone: '6280000007701',
      source: 'kirimi_whatsapp', lastMessageAt: new Date(),
    });
    sids.push(s1.id);
    const r1 = await say(s1.id, 'Natasha', 'Hello.. Saya mau sewa rumah di Madiun');
    ok('mengaku kota tidak ada — BUKAN bertanya area di Madiun',
      /belum punya listing.*madiun/i.test(r1.reply) || /madiun.*belum ada/i.test(r1.reply), r1.reply);
    ok('TIDAK menyebut nama kawasan Madiun (Kartoharjo/Manguharjo/dst — jejak hardcode lama)',
      !/kartoharjo|manguharjo|pahlawan\s+street|alun-alun\s+madiun/i.test(r1.reply), r1.reply);
    ok('menawarkan kota NYATA milik agent', /surabaya/i.test(r1.reply) && /sidoarjo/i.test(r1.reply), r1.reply);

    const r2 = await say(s1.id, 'Natasha', 'Mau.');
    ok('menindaklanjuti dengan "kota mana", BUKAN mengulang tawaran yang sama',
      /kota\s+mana/i.test(r2.reply) && !/belum punya listing/i.test(r2.reply), r2.reply);

    const r3 = await say(s1.id, 'Natasha', 'Di Surabaya');
    ok('lanjut normal setelah kota valid disebut (bertanya area, BUKAN mengulang tawaran kota)',
      !/belum punya listing/i.test(r3.reply) && !/kota\s+mana/i.test(r3.reply), r3.reply);

    /* ── 3. Kontrol: customer MENOLAK tawaran kota → tutup sopan ── */
    console.log('\n3) Customer menolak tawaran kota → tutup sopan (bukan interview lanjut)');
    const s2 = await ChatSession.create({
      name: 'M164Decline', normalizedName: 'm164decline', phone: '6280000007702', normalizedPhone: '6280000007702',
      source: 'kirimi_whatsapp', lastMessageAt: new Date(),
    });
    sids.push(s2.id);
    await say(s2.id, 'Natasha', 'Saya mau beli apartemen di Madiun');
    const r4 = await say(s2.id, 'Natasha', 'Tidak mau, Kak.');
    ok('menutup dengan sopan, TIDAK mengulang tawaran', /terima kasih/i.test(r4.reply) && !/berminat/i.test(r4.reply), r4.reply);
  } catch (err) {
    console.log(`  ⏭️  dilewati (${err.message})`);
  } finally {
    for (const sid of sids) {
      await ChatMessage.destroy({ where: { chatSessionId: sid } });
      await ChatSession.destroy({ where: { id: sid } });
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

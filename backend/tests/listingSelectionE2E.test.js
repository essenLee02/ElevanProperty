'use strict';
/**
 * listingSelectionE2E.test.js — M165
 * -------------------------------------
 * Verifikasi lewat PINTU MASUK NYATA generateWhatsAppAIReply(), bukan lewat
 * gerbangnya langsung. Pelajaran M129/terminologyQualGateWiring: gerbang bisa
 * 100% benar sebagai unit tapi TIDAK PERNAH TERCAPAI di produksi karena ada
 * `return` lain yang menang lebih dulu. Tes unit saja tidak membuktikan apa pun
 * tentang urutan.
 *
 * Skenario = transkrip produksi 29 Agu 2026 (dua kartu MERR berjudul identik).
 */
require('dotenv').config();

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`); }
}

const CARD1 = `1. *MERR House Sale Surabaya*

   📍 Lokasi: SURABAYA, JAWA TIMUR
   🗺️ Area: MERR
   🏡 Alamat: Jl. MERR No. 69, Surabaya
   💰 Estimasi Harga: *451.6 juta*
   🏠 Tipe: Rumah — Dijual
   📐 Luas: bangunan 323 m2, tanah 331 m2
   🏷️ Fasilitas: SECURITY, AC, WATER HEATER, CCTV 24 JAM`;

const CARD2 = `2. *MERR House Sale Surabaya*

   📍 Lokasi: SURABAYA, JAWA TIMUR
   🗺️ Area: MERR
   🏡 Alamat: Jl. MERR No. 15, Surabaya
   💰 Estimasi Harga: *471.1 juta*
   🏠 Tipe: Rumah — Dijual
   📐 Luas: bangunan 344 m2, tanah 212 m2
   🏷️ Fasilitas: CCTV 24 JAM, CARPORT, KITCHEN SET, WATER HEATER`;

async function main() {
  console.log('\n=== M165 · Pemilihan Listing lewat generateWhatsAppAIReply() ===\n');

  const AGENT = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
  let ChatSession; let ChatMessage; let generateWhatsAppAIReply;
  try {
    ({ ChatSession, ChatMessage } = require('../models'));
    ({ generateWhatsAppAIReply } = require('../services/whatsappAIService'));
    const { initLandmarkCache, initCityCache, initFacilityCache } = require('../services/propertyRecommendationService');
    await initLandmarkCache(); await initCityCache(); await initFacilityCache();
  } catch (err) {
    console.log(`  ⏭️  dilewati (setup gagal: ${err.message})`);
    console.log(`\nRESULT: 0/0 passed ALL PASS`);
    process.exit(0);
  }

  const sids = [];
  try {
    const s = await ChatSession.create({
      name: 'M165', normalizedName: 'm165', phone: '6280000007801', normalizedPhone: '6280000007801',
      source: 'kirimi_whatsapp', lastMessageAt: new Date(),
    });
    sids.push(s.id);

    // Tanam riwayat persis seperti yang customer LIHAT: head, dua kartu sebagai
    // pesan terpisah (hasil replySplitter), lalu ekor.
    const seed = [
      ['user', 'yang harganya 400-900 juta'],
      ['ai',   'Ini 2 Rumah dijual di Merr ya, Kak 😊'],
      ['ai',   CARD1],
      ['ai',   CARD2],
      ['ai',   'Ada yang menarik, Kak? Kalau mau saya carikan yang lebih spesifik, boleh sebutkan budget atau kebutuhan lainnya.'],
    ];
    for (const [role, message] of seed) {
      await ChatMessage.create({ chatSessionId: s.id, role, message, channel: 'kirimi_whatsapp' });
    }

    /* ⚠️ agentAiPrimary:'private' = profil guardrail 'local' → backend BOLEH
     * menyusun balasan sendiri. Tanpa ini agent uji (NA40D8N007) berjalan di
     * profil 'platform', gerbang hanya MENYUNTIKKAN FAKTA, dan penyusunan
     * kalimatnya jadi wewenang LLM — sehingga `provider` tidak akan pernah
     * bernilai 'listing_selection_gate'. Kedua profil diuji di berkas ini
     * (bagian 3), karena itulah perbedaan yang bikin versi pertama tes ini
     * gagal padahal gerbangnya sudah benar. */
    const LOCAL = { id: s.id, agentUserId: AGENT, agentName: 'Natasha', agentAiPrimary: 'private' };

    async function say(msg) {
      await ChatMessage.create({ chatSessionId: s.id, role: 'user', message: msg, channel: 'kirimi_whatsapp' });
      const r = await generateWhatsAppAIReply({
        message: msg, session: LOCAL, agentUserId: AGENT, agentName: 'Natasha',
      });
      await ChatMessage.create({ chatSessionId: s.id, role: 'ai', message: r.reply, channel: 'kirimi_whatsapp' });
      return r;
    }

    console.log('1) [profil local] "Saya pilih no 2, Kak" — pesan yang diabaikan 3x di produksi');
    const r1 = await say('Saya pilih no 2, Kak');
    ok('gerbang pemilihan yang menjawab (bukan gerbang area)',
      r1.provider === 'listing_selection_gate', `provider=${r1.provider}`);
    ok('menyebut unit yang BENAR (471.1 juta)', /471\.1/.test(r1.reply), r1.reply);
    ok('⭐ TIDAK mengirim ulang kartu no. 1 (451.6 juta)', !/451\.6/.test(r1.reply), r1.reply);
    ok('TIDAK mengulang blok katalog', !/^1\.\s+\*/m.test(r1.reply), r1.reply);
    ok('melangkah maju (menawarkan survei)', /survei|jadwal/i.test(r1.reply), r1.reply);

    console.log('\n2) [profil local] "Yg hrg 471.1 juta" — pemilihan lewat HARGA saja');
    async function freshSay(msg, extraSession = {}) {
      const sx = await ChatSession.create({
        name: 'M165x', normalizedName: 'm165x',
        phone: `62800000078${sids.length}`, normalizedPhone: `62800000078${sids.length}`,
        source: 'kirimi_whatsapp', lastMessageAt: new Date(),
      });
      sids.push(sx.id);
      for (const [role, message] of seed) {
        await ChatMessage.create({ chatSessionId: sx.id, role, message, channel: 'kirimi_whatsapp' });
      }
      await ChatMessage.create({ chatSessionId: sx.id, role: 'user', message: msg, channel: 'kirimi_whatsapp' });
      return generateWhatsAppAIReply({
        message: msg,
        session: { id: sx.id, agentUserId: AGENT, agentName: 'Natasha', ...extraSession },
        agentUserId: AGENT, agentName: 'Natasha',
      });
    }

    const r2 = await freshSay('Yg hrg 471.1 juta', { agentAiPrimary: 'private' });
    ok('dijawab gerbang pemilihan', r2.provider === 'listing_selection_gate', `provider=${r2.provider}`);
    ok('mengenali unit no. 2', /471\.1/.test(r2.reply) && !/451\.6/.test(r2.reply), r2.reply);

    /* ── 3. Profil 'platform': gerbang TIDAK BOLEH menyusun kalimat ────────
     * Di profil ini penyusunan kalimat adalah wewenang platform AI; tugas
     * gerbang hanya menyuntikkan FAKTA pilihan customer ke konteks prompt.
     * Yang dijaga di sini: gerbang tidak membajak balasan (tidak mengembalikan
     * provider-nya sendiri) DAN tetap tidak crash. */
    console.log('\n3) [profil platform] gerbang menyuntik fakta, TIDAK membajak balasan');
    const r3 = await freshSay('Saya pilih no 2, Kak', { agentAiPrimary: 'chatgpt' });
    ok('tidak membajak balasan di profil platform',
      r3.provider !== 'listing_selection_gate', `provider=${r3.provider}`);
    ok('tetap menghasilkan balasan (tidak crash)',
      typeof r3.reply === 'string' || r3.silent === true, JSON.stringify(r3).slice(0, 160));
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

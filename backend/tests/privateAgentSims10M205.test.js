/**
 * M205 (18 Sep 2026) — 10 sesi N1–N10 (scripts/sim-scenarios-private10.js) ke Private Agent
 * murni. Kelas bug yang dikunci: "3 jt an per bulan, sewa 1 tahun" → /tahun; "Cicilan 15
 * tahun … per bulan" → sewa + durasi 15 tahun; "100 m2" → 100 MILIAR; "Rencana pindah Maret"
 * → ubah jadwal survei; "Area yang rame" → district "Ng Rame"; "Kirim 3 ya" → area/patokan;
 * kos → "sewa atau beli?"; WNA & SHM; ngomong sama orang; penutup tanpa kartu; "Kamis jam 4"
 * fuzzy ke "Dukuh Pakis"; "Ok thanks." memicu summary Inggris; jadwal tanpa unit diubah/batal.
 */
require('dotenv').config();
process.env.AI_PRIMARY_PROVIDER = 'private';
let pass = 0, fail = 0;
const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}${e ? ' — ' + e : ''}`); } };
const A = (m) => ({ role: 'ai', message: m }); const C = (m) => ({ role: 'customer', message: m });

(async () => {
  const prs = require('../services/propertyRecommendationService');
  await prs.initCityCache(); await prs.initLandmarkCache(); await prs.initFacilityCache();
  const { extractQualificationState } = require('../services/aiPromptBuilderService');
  const { tryTerminologyAnswer } = require('../utils/terminologyAnswerGate');
  const repair = require('../utils/conversationRepairGate');
  const q = require('../utils/customerQuestionGuard');
  const { findAreaCandidatesInText } = require('../services/areaAvailabilityService');
  const { LanguageDetector } = require('../controllers/chatbotPrivateController');
  const AG = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';

  console.log('\n[1] Ekstraktor & detektor');
  {
    const b = prs.detectBudget('Budget 3 jt an per bulan, sewa 1 tahun.');
    ok('"3 jt an per bulan, sewa 1 tahun" → periode bulan', b && b.period === 'month', JSON.stringify(b));
    ok('"Luas minimal 100 m2, parkir 5 mobil" bukan budget', prs.detectBudget('Luas minimal 100 m2, parkir minimal 5 mobil.') === null);
    ok('"Budget 3 M, cash bertahap 2 kali" tetap 3 miliar', /3\.450\.000\.000/.test((prs.detectBudget('Budget 3 M, bayar cash bertahap 2 kali boleh?') || {}).text || ''));
    ok('"Cicilan 15 tahun … per bulan" bukan sewa', prs.detectTransactionType('Cicilan 15 tahun kira2 berapa per bulan?') !== 'rent');
    ok('"Yield sewanya … per tahun" bukan pembalik transaksi', prs.detectTransactionType('Yield sewanya kira2 berapa persen per tahun?') !== 'rent');
    ok('"cari kos buat anak" → rent', prs.detectTransactionType('Sy cari kos buat anak sy yg kuliah di ITS surabaya') === 'rent');
    const s = extractQualificationState([], 'Mau beli ruko di Surabaya buat investasi, disewakan lagi. Area yang rame.');
    ok('"Area yang rame" bukan district', !s.district, String(s.district));
    const s2 = extractQualificationState([C('Mau beli ruko di Surabaya'), A('Di area/kawasan mana, atau ada patokan lokasi tertentu?')], 'Kirim 3 ya.');
    ok('"Kirim 3 ya" bukan district/patokan', !s2.district && !s2.anchorPoint, `${s2.district}|${s2.anchorPoint}`);
    const s3 = extractQualificationState([C('Beli rumah Sidoarjo Candramas'), A('Ini 2 rumah dijual')], 'Alana Cemandi boleh, lihat 2 pilihan');
    ok('"Alana Cemandi boleh, lihat 2 pilihan" tetap area', /Alana Cemandi/i.test(String(s3.district)), String(s3.district));
  }
  ok('WNA & SHM dijawab aturan (bukan data unit)', /WNA tidak bisa memegang SHM/.test(String(tryTerminologyAnswer('Apakah WNA bisa punya SHM?'))));
  ok('"secara izin" → zonasi', /zonasi/i.test(String(tryTerminologyAnswer('Boleh untuk kantor cabang bank kan secara izin?'))));
  ok('"ngomong sama orang, bukan bot" → serah-terima', repair.detectHumanRequest('Saya mau ngomong sama orang, bukan bot.'));
  ok('"Sama orang tua saya, 3 orang" BUKAN serah-terima', !repair.detectHumanRequest('Sama orang tua saya, 3 orang.'));
  ok('"boleh minta nomornya?" (agent) → nomor agent', repair.detectAgentNumberRequest('Nanti sy hubungi agentnya langsung aja, boleh minta nomornya?'));
  ok('"Oke ditunggu ya." = penutup', q.customerSignalsClosing('Oke ditunggu ya.'));
  ok('"Kamis jam 4" tidak fuzzy ke area', (await findAreaCandidatesInText({ userId: AG, city: 'Surabaya', text: 'Kamis jam 4.' })).area === null);
  ok('"Ok thanks." di sesi Indonesia tetap id', LanguageDetector.detect('Ok thanks.', [C('Mau beli ruko di Surabaya'), A('x'), C('Budget 2-3 M.'), A('y')]) === 'id');
  ok('"Thanks, that is all." di sesi Inggris tetap en', LanguageDetector.detect('Thanks, that is all.', [C('Hi, I am relocating for work'), A('x')]) === 'en');

  console.log('\n[2] Jalur WhatsApp lengkap (generateWhatsAppAIReply, provider=private)');
  {
    const { ChatSession, ChatMessage } = require('../models');
    const { generateWhatsAppAIReply } = require('../services/whatsappAIService');
    const run = async (turns, phone) => {
      const session = await ChatSession.create({ name: 'Sim M205', normalizedName: 'sim m205', phone, normalizedPhone: phone, source: 'kirimi_whatsapp', lastMessageAt: new Date() }).catch(() => null);
      if (!session) return null;
      const out = [];
      for (const msg of turns) {
        await ChatMessage.create({ chatSessionId: session.id, role: 'user', message: msg, channel: 'kirimi_whatsapp' });
        const r = await generateWhatsAppAIReply({ message: msg, session: { id: session.id, agentUserId: AG, agentName: 'Natasha', name: 'Sim M205', normalizedPhone: phone, source: 'kirimi_whatsapp' }, agentUserId: AG, agentName: 'Natasha' });
        const reply = String(r?.reply || '');
        await ChatMessage.create({ chatSessionId: session.id, role: 'ai', message: reply, channel: 'kirimi_whatsapp' });
        out.push({ msg, reply, provider: r?.provider || '' });
      }
      try { await ChatMessage.destroy({ where: { chatSessionId: session.id } }); await session.destroy(); } catch (_) { /* ignore */ }
      return out;
    };
    const n2 = await run(['Mau beli rumah di Sidoarjo, area Candramas atau sekitarnya. Budget 700 jt, KPR.', 'Cicilan 15 tahun kira2 berapa per bulan?', 'Survei Sabtu depan jam 10 bisa?', 'Rencana pindah Maret tahun depan.', 'Terima kasih infonya.'], '6280000072002');
    if (!n2) { console.log('  (DB tidak tersedia — bagian [2] dilewati)'); }
    else {
      ok('N2: "Rencana pindah Maret" dicatat sebagai MASUK, survei tetap', /rencana masuk \*01 Maret 20\d\d\*/.test(n2[3].reply) && /survei tetap/i.test(n2[3].reply), n2[3].reply.slice(0, 90));
      const last = n2[4].reply;
      ok('N2 summary: Rencana Beli', /Rencana: \*Beli\*/.test(last), (last.match(/Rencana: [^\n]*/) || [])[0]);
      ok('N2 summary: tanpa "Durasi sewa: 15 tahun"', !/Durasi sewa: \*15 tahun\*/.test(last));
      ok('N2 summary: Masuk 01 Maret', /Masuk: \*01 Maret 20\d\d\*/.test(last));
    }
    const n5 = await run(['Kami cari kantor sewa di Surabaya untuk 15 orang, area Darmo atau pusat kota.', 'Luas minimal 100 m2, parkir minimal 5 mobil.', 'Budget 150 jt per tahun, kontrak 2 tahun.', 'Tolong rangkum kebutuhan kami.'], '6280000072005');
    if (n5) {
      const last = n5[3].reply;
      ok('N5 summary: budget 127,5–172,5 juta (bukan 85 miliar)', /Rp 127\.500\.000 - Rp 172\.500\.000/.test(last), (last.match(/Budget: [^\n]*/) || [])[0]);
    }
    const n10 = await run(['Halo, ada apartemen dijual di Surabaya Kutisari? Mau survei minggu ini.', 'Nomor 1. Jumat jam 2 ya.', 'Eh ganti Sabtu aja.', 'Maaf, batal dulu ya, ada acara.', 'Kalau Minggu depan jam 10 bisa?', 'Sip, makasih.'], '6280000072010');
    if (n10) {
      ok('N10: ganti hari tanpa unit → dicatat', /saya catat/.test(n10[2].reply), n10[2].reply.slice(0, 60));
      ok('N10: batal tanpa unit → dibatalkan', /dibatalkan dulu/.test(n10[3].reply), n10[3].reply.slice(0, 60));
      ok('N10: jadwal baru tanpa unit → dicatat', /saya catat/.test(n10[4].reply), n10[4].reply.slice(0, 60));
      ok('N10: penutup tanpa kartu (slot lengkap, stok kosong) → summary untuk agent, bukan skrip', /Rencana: \*Beli\*/.test(n10[5].reply) && /Kutisari/.test(n10[5].reply), n10[5].reply.slice(0, 80));
    }
    const n9 = await run(['Rumah sewa Surabaya Rungkut, 2 kamar, ada?', 'Saya mau ngomong sama orang, bukan bot.'], '6280000072009');
    if (n9) ok('N9: minta manusia → serah-terima ke agent', /agent kami \(manusia\)/.test(n9[1].reply), n9[1].reply.slice(0, 60));
  }

  console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

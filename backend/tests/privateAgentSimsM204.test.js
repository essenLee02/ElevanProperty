/**
 * M204 (18 Sep 2026) — 5 sesi K1–K5 dijalankan ke Private Agent MURNI
 * (AI_PRIMARY_PROVIDER=private, jalur whatsappAIService lengkap — bukan fallback).
 * Kelas bug yang dikunci: kata waktu sambil lalu ("hari ini") jadi tanggal masuk,
 * "2 orang" jadi "Jam 2", "beli daripada sewa" tetap sewa, "nomor 1 sudah SHM?"
 * dijawab glosarium, basa-basi/frustrasi/keluhan foto jatuh ke skrip, jarak
 * area↔kawasan (Citraland↔JIIPE), pajak/deposit/AJB tanpa jawaban, district
 * "Gubeng atau sekitarnya", fasilitas standar dari "apa aja?", "Minta listing"
 * menimpa jadwal survei, "pajak jual beli" dibaca pencarian baru sesudah summary.
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
  const { parseSurveyTime } = require('../utils/customerDateParser');
  const { tryTerminologyAnswer } = require('../utils/terminologyAnswerGate');
  const dist = require('../services/distanceEstimationService');
  const repair = require('../utils/conversationRepairGate');
  const f = require('../utils/propertyKeywordFilter');

  console.log('\n[1] Ekstraktor slot');
  {
    const h = [C('Halo kak, ada rumah sewa di Surabaya area Rungkut?'), A('Ini 2 rumah sewa di *Rungkut* ya, Kak 😊\n\n1. *Rungkut House*\n\n   🏡 Alamat: Jl. Rungkut No. 1, Surabaya\n   💰 Estimasi Harga: *26 juta/tahun*\n\nAda yang menarik, Kak?'), C('Btw hari ini Surabaya hujan nggak ya haha'), A('Hehe, kalau soal itu saya kurang update, Kak 😄')];
    const s1 = extractQualificationState(h, 'Rencana pindah awal tahun depan.');
    ok('"hari ini" (basa-basi) tidak jadi tanggal masuk; "awal tahun depan" = 01 Januari', /^01 Januari 20\d\d$/.test(String(s1.moveInDate)), String(s1.moveInDate));
    const s2 = extractQualificationState([], 'Saya mau sewa rumah di Surabaya, masuknya segera');
    ok('"masuknya segera" tetap ask_soon', s2.moveInDateAsk === 'soon');
    const s3 = extractQualificationState([C('Sewa rumah Surabaya'), A('Rencananya masuk bulan apa? 📅')], 'Bulan depan');
    ok('jawaban "Bulan depan" atas Q8 tetap tercatat', Boolean(s3.moveInDate), String(s3.moveInDate));
  }
  ok('"Sama suami sy, 2 orang." bukan jam (mode longgar)', parseSurveyTime('Sama suami sy, 2 orang.', { requireClockWord: false }) === null);
  ok('"10" mode longgar tetap Jam 10', parseSurveyTime('10', { requireClockWord: false }) === 'Jam 10');
  ok('"jam 2 sore" tetap terbaca', parseSurveyTime('jam 2 sore', { requireClockWord: false }) === 'Jam 2 sore');
  ok('"mending beli aja daripada sewa" → sale', prs.detectCanonicalTransaction('Hmm mending beli aja sih daripada sewa. Ada rumah dijual di Rungkut?') === 'sale');
  ok('"Sewa aja dulu, bukan beli" → rent', prs.detectCanonicalTransaction('Sewa aja dulu, bukan beli') === 'rent');
  ok('"pajak jual belinya siapa yg tanggung?" bukan niat transaksi', prs.detectCanonicalTransaction('Nanti klo cocok pajak jual belinya siapa yg tanggung?') === null);
  {
    const s = extractQualificationState([C('sy cari apartemen sewa di Surabaya'), A('Di area/kawasan mana?')], 'Dkt kampus B Unair kalau bisa, area Gubeng atau sekitarnya.');
    ok('district "Gubeng atau sekitarnya" → Gubeng', s.district === 'Gubeng', s.district);
    const s2 = extractQualificationState([C('Mau beli ruko di Sidoarjo.'), A('Di area mana?')], 'Area Gedangan atau Waru, yg rame.');
    ok('district "Gedangan atau Waru" → Gedangan', s2.district === 'Gedangan', s2.district);
  }
  {
    const card = 'Ini 2 rumah dijual di *Rungkut* ya, Kak 😊\n\n1. *Rungkut House Sale*\n\n   🏡 Alamat: Jl. Rungkut No. 25, Surabaya\n   💰 Estimasi Harga: *520 juta*\n   🏷️ Fasilitas: GARDEN, GARAGE\n\nAda yang menarik, Kak? Kalau mau saya carikan yang lebih spesifik, boleh sebutkan budget atau kebutuhan lainnya.';
    const s = extractQualificationState([C('Ada rumah dijual di Rungkut Surabaya?'), A(card)], 'Budget 900 jt, KPR. Syaratnya apa aja?');
    ok('"Syaratnya apa aja?" sesudah kartu TIDAK menyalakan fasilitas standar', !(Array.isArray(s.facilities) && s.facilities.includes('standar')), JSON.stringify(s.facilities));
    const s2 = extractQualificationState([C('Ada rumah dijual di Rungkut Surabaya?'), A('Ada fasilitas tertentu yang Anda inginkan? Misalnya AC, kolam renang? 🏊')], 'apa aja boleh');
    ok('"apa aja boleh" atas pertanyaan fasilitas → standar', Array.isArray(s2.facilities) && s2.facilities.includes('standar'));
  }

  console.log('\n[2] Istilah, jarak, perbaikan percakapan');
  ok('pajak jual beli dijawab (BPHTB/PPh)', /BPHTB/.test(String(tryTerminologyAnswer('Nanti klo cocok pajak jual belinya siapa yg tanggung?'))));
  ok('deposit (EN) dijawab', /deposit/i.test(String(tryTerminologyAnswer('Is there a deposit? How many months?', { lang: 'en' }))));
  ok('"AJB aja aman nggak?" dijawab risiko, bukan definisi SHM saja', /berisiko|AJB hanya bukti transaksi/.test(String(tryTerminologyAnswer('Kalau tanah cuma AJB aja aman nggak? Wajib SHM?'))));
  ok('Citraland ↔ JIIPE → Surabaya ↔ Gresik (EN)', /Citraland \(Surabaya\) and JIIPE \(Gresik\)[\s\S]*Surabaya to Gresik/.test(String(dist.tryAnswerDistanceQuery('Ok. How far is Citraland from JIIPE by car in the morning?', { lang: 'en' }))));
  ok('Juanda → Rungkut (ID)', /Sidoarjo ke Surabaya/.test(String(dist.tryAnswerDistanceQuery('dari Juanda ke Rungkut jauh nggak?', { lang: 'id' }))));
  ok('dua area satu kota → null (bukan 0 km)', dist.tryAnswerDistanceQuery('Jarak Pakuwon ke Citraland?', { lang: 'id' }) === null);
  ok('basa-basi terdeteksi', repair.detectSmallTalk('Btw hari ini hujan nggak ya haha', { hasPropertyKeyword: f.hasPropertyKeyword, isContinuation: () => true }));
  ok('"rumahnya banjir kalau hujan?" bukan basa-basi', !repair.detectSmallTalk('rumahnya banjir kalau hujan?', { hasPropertyKeyword: f.hasPropertyKeyword, isContinuation: () => false }));
  ok('keluhan foto terdeteksi (EN)', repair.detectPhotoMismatch('The photo you sent looks like a different house than the description.'));
  ok('keluhan foto terdeteksi (ID)', repair.detectPhotoMismatch('fotonya kok beda sama deskripsinya?'));
  {
    const r = repair.buildRepairReply({ message: 'x', lang: 'id', cardsSent: true, frustration: f.detectCustomerFrustration('Kok ditanya terus sih, sy cuma mau lihat pilihan dulu') });
    ok('frustrasi → berhenti bertanya', r && /berhenti bertanya/.test(r.reply));
  }

  console.log('\n[3] Jalur WhatsApp lengkap (generateWhatsAppAIReply, provider=private)');
  {
    const { ChatSession, ChatMessage } = require('../models');
    const { generateWhatsAppAIReply } = require('../services/whatsappAIService');
    const AG = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
    const run = async (turns, phone) => {
      const session = await ChatSession.create({ name: 'Sim M204', normalizedName: 'sim m204', phone, normalizedPhone: phone, source: 'kirimi_whatsapp', lastMessageAt: new Date() }).catch(() => null);
      if (!session) return null;
      const out = [];
      for (const msg of turns) {
        await ChatMessage.create({ chatSessionId: session.id, role: 'user', message: msg, channel: 'kirimi_whatsapp' });
        const r = await generateWhatsAppAIReply({ message: msg, session: { id: session.id, agentUserId: AG, agentName: 'Natasha', name: 'Sim M204', normalizedPhone: phone, source: 'kirimi_whatsapp' }, agentUserId: AG, agentName: 'Natasha' });
        const reply = String(r?.reply || '');
        await ChatMessage.create({ chatSessionId: session.id, role: 'ai', message: reply, channel: 'kirimi_whatsapp' });
        out.push({ msg, reply, provider: r?.provider || '' });
      }
      try { await ChatMessage.destroy({ where: { chatSessionId: session.id } }); await session.destroy(); } catch (_) { /* ignore */ }
      return out;
    };
    const k5 = await run(['Halo kak, langsung aja ada rumah sewa di Surabaya area Rungkut? Kirim 2 ya.', 'Btw hari ini Surabaya hujan nggak ya haha', 'Hmm sebenarnya kami mikir2 mending beli aja sih daripada sewa. Ada rumah dijual di Rungkut?', 'Budget 900 jt, KPR. Syaratnya apa aja?', 'Kok ditanya terus sih, sy cuma mau lihat pilihan dulu', 'Rencana pindah awal tahun depan.', 'Survei sabtu ini bisa? Pagi.', 'Sama suami sy, 2 orang.', 'Oke makasih ya kak.'], '6280000062005');
    if (!k5) { console.log('  (DB tidak tersedia — bagian [3] dilewati)'); }
    else {
      ok('K5: basa-basi → conversation_repair_gate', k5[1].provider === 'conversation_repair_gate', k5[1].provider);
      ok('K5: "beli daripada sewa" → kartu dijual', /rumah dijual di \*Rungkut\*/i.test(k5[2].reply), k5[2].reply.slice(0, 60));
      ok('K5: frustrasi → berhenti bertanya', /berhenti bertanya/.test(k5[4].reply), k5[4].reply.slice(0, 60));
      const last = k5[k5.length - 1].reply;
      ok('K5 summary: Rencana Beli', /Rencana: \*Beli\*/.test(last));
      ok('K5 summary: Masuk 01 Januari (bukan hari ini)', /Masuk: \*01 Januari 20\d\d\*/.test(last), (last.match(/Masuk: [^\n]*/) || [])[0]);
      ok('K5 summary: Viewing 19-ish Sep, Pagi (bukan Jam 2 / Minta listing)', /Viewing: \*\d{2} \w+ 20\d\d, Pagi\*/.test(last), (last.match(/Viewing: [^\n]*/) || [])[0]);
      ok('K5 summary: tanpa 16 fasilitas standar', !/Fasilitas: \*Kamar Tidur, Kamar Mandi/.test(last));
    }
    const k3 = await run(['Hi, I am relocating for work near JIIPE Gresik. Looking to rent a house, 3 bedrooms.', 'Actually my wife prefers Surabaya, Citraland area. Can we look there instead?', 'The photo you sent looks like a different house than the description. Which one is correct?', 'Ok. How far is Citraland from JIIPE by car in the morning?', 'Can we view it next Wednesday? My wife will join.', 'Afternoon, around 2 pm.', 'Is there a deposit? How many months?'], '6280000062003');
    if (k3) {
      ok('K3: keluhan foto dijawab (bukan off-topic)', /flagging|DATA on the card/.test(k3[2].reply), k3[2].reply.slice(0, 60));
      ok('K3: jarak Citraland↔JIIPE dalam bahasa Inggris', /Surabaya to Gresik is about/.test(k3[3].reply), k3[3].reply.slice(0, 80));
      ok('K3: viewing tanpa unit di pencarian ini → jujur + sebut unit lama', /haven't sent any unit to view yet[\s\S]*Green Garden/.test(k3[4].reply), k3[4].reply.slice(0, 80));
      ok('K3: "2 pm" dicatat, bukan skrip area', /Noted — \*2 pm\*/.test(k3[5].reply), k3[5].reply.slice(0, 80));
      ok('K3: deposit dijawab', /deposit is usually/i.test(k3[6].reply), k3[6].reply.slice(0, 60));
    }
    const k4 = await run(['Pagi, sy cari tanah di Gresik buat investasi, minimal 200 m2.', 'Kalau Mneganti?', 'Yg nomor 1 itu luasnya brp? Bentuknya kotak?', 'Sy mau lihat lokasi minggu depan, hari kerja aja.', 'Nanti klo cocok pajak jual belinya siapa yg tanggung?', 'Oke cukup dulu, nanti sy hubungi lagi.'], '6280000062004');
    if (k4) {
      ok('K4: "Mneganti" → Menganti disebut', /Menganti/.test(k4[1].reply), k4[1].reply.slice(0, 80));
      ok('K4: "nomor 1" tanpa kartu → belum ada unit (bukan tanya area)', /Belum ada unit yang saya kirim/.test(k4[2].reply), k4[2].reply.slice(0, 60));
      ok('K4: pajak dijawab', /BPHTB/.test(k4[4].reply), k4[4].reply.slice(0, 60));
      ok('K4: penutup sesudah summary tidak restart "Tipe apa"', !/Tipe apa yang Anda cari/.test(k4[5].reply), k4[5].reply.slice(0, 80));
    }
  }

  console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

/**
 * M203 (16 Sep 2026) — 3 sesi baru (scripts/sim-scenarios-claude-skill.js: K1 sewa apartemen
 * untuk anak kuliah, K2 beli ruko untuk kafe, K3 expat berbahasa Inggris). Kelas bug yang
 * dikunci: deteksi bahasa buta-Inggris, pertanyaan unit tanpa kartu, penundaan survei jadi
 * tanggal, sapaan "Selamat siang" → jam survei / area fuzzy, "buka kafe" = usaha, Q2b dua
 * tanda tanya, penutup Inggris, istilah legal Inggris + "beda X sama Y", jarak Inggris,
 * kamar tidur & hewan peliharaan di summary, "atau sekitarnya" bukan area alternatif.
 */
require('dotenv').config();
process.env.AI_PRIMARY_PROVIDER = 'private';
let pass = 0, fail = 0;
const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}${e ? ' — ' + e : ''}`); } };
const A = (m) => ({ role: 'ai', message: m }); const C = (m) => ({ role: 'customer', message: m });

(async () => {
  const prs = require('../services/propertyRecommendationService');
  await prs.initCityCache(); await prs.initLandmarkCache(); await prs.initFacilityCache();
  const { LanguageDetector, generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');
  const { isIndonesian } = require('../services/whatsappAIService');
  const q = require('../utils/customerQuestionGuard');
  const { tryTerminologyAnswer } = require('../utils/terminologyAnswerGate');
  const dist = require('../services/distanceEstimationService');
  const { findAreaCandidatesInText } = require('../services/areaAvailabilityService');
  const { parseCustomerDate } = require('../utils/customerDateParser');
  const AG = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
  const run = async (turns) => {
    const hist = []; let r = null;
    for (const m of turns) {
      r = await generatePrivateTerminalMassege({ session: { id: 0 }, history: hist, userMessage: m, agentName: 'Natasha', agentUserId: AG, recommendationContext: null, externalError: new Error('x') });
      hist.push(C(m), A(String(r.reply)));
    }
    return { r, hist };
  };

  console.log('\n[1] Deteksi bahasa tidak lagi buta Inggris');
  for (const m of ['Budget around 60 million per year. Must be pet friendly, I have a dog.', 'Is number 1 fully furnished? And does it have a garden for the dog?', 'Ok. How far is Citraland from JIIPE by car in the morning?', 'Great, that is all for now. Thank you.']) {
    ok(`EN: "${m.slice(0, 45)}"`, LanguageDetector.detect(m, []) === 'en' && !isIndonesian(m, []));
  }
  for (const m of ['Yg furnished ya, anaknya nggak bawa apa2.', 'Budget maksimal 4 jt per bulan', 'Jam 10 pagi ya.', 'ok siap']) {
    ok(`ID: "${m}"`, LanguageDetector.detect(m, []) === 'id' && isIndonesian(m, []));
  }

  console.log('\n[2] Pertanyaan unit padahal belum ada kartu; penundaan survei; tawaran ulang tanpa skrip');
  {
    const { hist } = await run(['Mau beli ruko di Sidoarjo buat buka kafe.', 'Area Gedangan atau Waru, yg rame.', 'Budget 2M, cash.', 'Yg nomor 1 sudah SHM atau masih HGB?']);
    ok('"nomor 1 sudah SHM?" tanpa kartu → "belum ada unit yang saya kirim"', /Belum ada unit yang saya kirim/.test(hist[7].message), hist[7].message.slice(0, 80));
    ok('"Budget 2M, cash." saat tipe tak ada di kota → bukan skrip "Sudah lihat berapa"', !/Sudah lihat berapa/.test(hist[5].message) && /Dicatat/.test(hist[5].message), hist[5].message.slice(0, 80));
    const { r } = await run(['Mau beli ruko di Sidoarjo buat buka kafe.', 'Sy belum bisa survei, masih di luar kota sampai Oktober.']);
    ok('"belum bisa survei sampai Oktober" → ditunda, bukan tanggal', /ditunda/i.test(r.reply) && !/01 Oktober/.test(r.reply), String(r.reply).slice(0, 80));
    const { r: rz } = await run(['Mau beli ruko di Sidoarjo buat buka kafe.', 'Secara zonasi ruko itu boleh buat kafe kan? Perlu izin apa?']);
    ok('pertanyaan zonasi tetap dijawab gerbang istilah (bukan "belum ada unit")', /zonasi/i.test(rz.reply) && !/Belum ada unit/.test(rz.reply));
  }

  console.log('\n[3] Sapaan, use-case, area alternatif, Q2b satu tanda tanya');
  ok('"Selamat siang, cari rumah di Surabaya" tidak fuzzy ke Karang Pilang', (await findAreaCandidatesInText({ userId: AG, city: 'Surabaya', text: 'Selamat siang, cari rumah di Surabaya' })).area === null);
  ok('"Kalau Mneganti?" masih typo-match Menganti', (await findAreaCandidatesInText({ userId: AG, city: 'Gresik', text: 'Kalau Mneganti?' })).area === 'Menganti');
  ok('"buka kafe" → usaha (bukan investasi)', prs.detectUseCase('mau beli ruko buat buka kafe') === 'usaha');
  ok('"dijadikan kos-kosan" → investasi', prs.detectUseCase('rumahnya mau dijadikan kos-kosan') === 'investasi');
  {
    const { r } = await run(['Sewa rumah di Surabaya, area Wiyung atau sekitarnya, 2 kamar.', 'Nomor 1.', 'Budget 40 juta per tahun.', 'Cash.', 'Sendiri.', 'Masuk Januari.', 'Tidak ada yang dihindari.', 'Baru atau second boleh.', 'Standar saja.', 'Ya.', 'Oke.', 'Terima kasih.']);
    const all = r.reply + '\n' + '';
    ok('summary: "atau sekitarnya" bukan "Area alternatif: sekitarnya"', !/Area alternatif: \*sekitarnya\*/i.test(all));
  }
  {
    const { hist } = await run(['Sewa apartemen di Surabaya, area Gubeng.', 'Yg furnished ya, anaknya nggak bawa apa2.']);
    const asks = hist.map((h) => h.message).filter((m) => /Sudah lihat berapa/.test(m));
    ok('Q2b hanya satu tanda tanya', asks.every((m) => (m.match(/\?/g) || []).length === 1), asks[0]);
  }

  console.log('\n[4] Bahasa Inggris: penutup, istilah legal, jarak, jadwal, summary');
  ok('"that is all for now" = penutup', q.customerSignalsClosing('Great, that is all for now. Thank you.'));
  const diff = tryTerminologyAnswer('What is the difference between PPJB and AJB? My HR asked.', { lang: 'en' }) || '';
  ok('PPJB vs AJB dijawab KEDUANYA dalam bahasa Inggris', /AJB \(Akta Jual Beli\) is/.test(diff) && /PPJB \(Perjanjian Pengikatan Jual Beli\) is/.test(diff));
  ok('"Apa itu SHMSRS? Beda sama SHM?" → dua paragraf', String(tryTerminologyAnswer('Apa itu SHMSRS? Beda sama SHM?')).split('\n\n').length === 2);
  ok('"How far is X from Y" = pertanyaan jarak', dist.looksLikeDistanceQuestion('Ok. How far is Citraland from JIIPE by car in the morning?'));
  ok('jarak Inggris: Malang→Surabaya dalam bahasa Inggris', /is about \d+ km/.test(dist.tryAnswerDistanceQuery('How long from Malang to Surabaya by car?', { lang: 'en' }) || ''));
  {
    const { r, hist } = await run(['Hi, I am relocating for work near JIIPE Gresik. Looking to rent a house, 3 bedrooms.', 'Budget around 60 million per year. Must be pet friendly, I have a dog.', 'Actually my wife prefers Surabaya, Citraland area. Can we look there instead?', 'Is number 1 fully furnished? And does it have a garden for the dog?', 'We move in on 1 December. Lease 2 years if possible.', 'Can we view it next Wednesday? My wife will join.', 'Afternoon, around 2 pm.', 'Great, that is all for now. Thank you.']);
    const ai = hist.filter((h) => h.role === 'ai').map((h) => h.message);
    ok('semua balasan sesi Inggris tanpa skrip Indonesia', ai.every((m) => !/Sudah lihat berapa|Rencananya masuk|Ada fasilitas apartemen/.test(m)), ai.find((m) => /Sudah lihat berapa|Rencananya masuk/.test(m)));
    ok('"Is number 1 …" tanpa kartu → "I haven\'t sent any unit yet"', ai.some((m) => /haven't sent any unit/.test(m)));
    ok('summary Inggris: Bedrooms 3', /Bedrooms: \*3\*/.test(r.reply), String(r.reply).slice(0, 60));
    ok('summary Inggris: pet-friendly tercatat', /pet-friendly/i.test(r.reply));
    // Tanggal relatif ("next Wednesday") bergeser tiap minggu — bandingkan dengan parser resmi.
    const expWed = (parseCustomerDate('next Wednesday', new Date()) || {}).formatted;
    ok(`summary Inggris: Viewing ${expWed}, 2 pm`, new RegExp(`Viewing: \\*${expWed}, 2 pm\\*`).test(r.reply), String(r.reply).match(/Viewing: [^\n]*/)?.[0]);
  }

  console.log('\n[5] "Jam 10 pagi ya." sesudah summary dengan baris Viewing → jam ditambahkan');
  {
    const hist = [C('Sewa apartemen di Surabaya, Karang Pilang.'), A('Ini 2 Apartemen sewa di *Karang Pilang* ya, Kak 😊\n\n1. *Karang Pilang Apartment Rent Surabaya*\n\n   🏡 Alamat: Jl. Karang Pilang No. 44, Surabaya\n   💰 Estimasi Harga: *2.6 juta/bulan*'), C('Survei sabtu depan bisa?'), A('Baik, semua sudah saya catat! 📝\n\n✓ Rencana: *Sewa*\n✓ Tipe: *Apartemen*\n✓ Kota: *Surabaya*\n✓ Area: *Karang Pilang*\n✓ Viewing: *26 September 2026*\n\nSalam hangat,\n*Natasha*')];
    const r = await generatePrivateTerminalMassege({ session: { id: 0 }, history: hist, userMessage: 'Jam 10 pagi ya.', agentName: 'Natasha', agentUserId: AG, recommendationContext: null, externalError: new Error('x') });
    ok('jam dikonfirmasi bersama tanggal summary', /26 September 2026/.test(r.reply) && /Jam 10 pagi/.test(r.reply), String(r.reply).slice(0, 100));
  }

  console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

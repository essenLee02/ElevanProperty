/**
 * M208 (21 Sep 2026) — 10 sesi R1–R10 (scripts/sim-scenarios-private-r10.js) + regresi P-set.
 * Kelas bug yang dikunci: ralat budget tidak memicu cek ulang; "Masuk awal Oktober, 1 tahun" →
 * +1 tahun; "rumah sewa … dekat rumah sakit" ditolak off-topic; "kabari kalau ada …" dibaca pilihan;
 * "yang kemarin masih tersedia?" sesudah summary → sesi baru; "Sabtu nggak jadi, Minggu aja jam yang
 * sama"; "Surabaya atau Sidoarjo"; "area mana saja"; "dijadikan/kamar/usaha kos" membalik tipe/transaksi;
 * keluhan agent belum telpon & "kok lama balasnya"; tawaran harga "400 juta boleh?"; tanggal sukarela
 * sesudah "kapan pun Kakak siap"; syarat "harus satu lantai" & "kalau bertingkat nggak mau".
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
  const q = require('../utils/customerQuestionGuard');
  const f = require('../utils/propertyKeywordFilter');
  const g = require('../utils/listingSelectionGate');
  const { tryTerminologyAnswer } = require('../utils/terminologyAnswerGate');
  const AG = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';

  console.log('\n[1] Detektor & ekstraktor');
  ok('"beli rumah untuk dijadikan kos-kosan" → sale/house', prs.detectCanonicalTransaction('Mau beli rumah di Surabaya untuk dijadikan kos-kosan, dekat kampus.') === 'sale' && prs.detectCanonicalType('Mau beli rumah di Surabaya untuk dijadikan kos-kosan') === 'house');
  ok('"dibagi jadi berapa kamar kos?" bukan tipe kos & bukan sewa', !prs.detectCanonicalType('Yang nomor 1 kamarnya berapa? Bisa dibagi jadi berapa kamar kos?') && prs.detectTransactionType('Bisa dibagi jadi berapa kamar kos?') !== 'rent');
  ok('"cari kos dekat ITS" tetap boarding_house/rent', prs.detectCanonicalType('cari kos dekat ITS') === 'boarding_house' && prs.detectTransactionType('cari kos dekat ITS') === 'rent');
  ok('"rumah sewa … dekat rumah sakit" lolos gerbang kata kunci', f.hasPropertyKeyword('Saya cari rumah sewa di Surabaya buat orang tua, harus satu lantai, akses kursi roda, dekat rumah sakit.'));
  ok('"rumah sakit" saja tetap bukan properti', !f.hasPropertyKeyword('saya lagi di rumah sakit'));
  ok('"Rumahnya untuk investasi" tetap lolos', f.hasPropertyKeyword('Rumahnya untuk investasi'));
  ok('"kok lama banget balasnya" → slow (bukan repetition)', f.detectCustomerFrustration('Kok lama banget balasnya, dari tadi saya tunggu.').kind === 'slow');
  ok('"belum ada kabar" bukan penutup', !q.customerSignalsClosing('Halo, kemarin katanya agent mau telpon tapi belum ada kabar.'));
  ok('"diskusi sama istri dulu" = penutup', q.customerSignalsClosing('Oke nanti saya diskusi sama istri dulu.'));
  ok('"kabari kalau ada yang satu lantai ya" = penutup', q.customerSignalsClosing('Ya sudah, kabari kalau ada yang satu lantai ya.'));
  ok('"masih mikir-mikir dulu" BUKAN penutup (menjelajah)', !q.customerSignalsClosing('Saya masih mikir-mikir dulu ya.'));
  ok('"trima kasih ya Kak" = penutup', q.customerSignalsClosing('Trima kasih ya Kak.'));
  {
    const s = extractQualificationState([C('Rumah sewa Rungkut'), A('Ini 2 rumah')], 'Ok saya ambil yang itu. Masuk awal Oktober, 1 tahun.');
    ok('"Masuk awal Oktober, 1 tahun" → Oktober 2026 (bukan +1 tahun)', /Oktober 2026/.test(String(s.moveInDate)), String(s.moveInDate));
    const s2 = extractQualificationState([], 'Saya cari rumah sewa di Surabaya buat orang tua, harus satu lantai, akses kursi roda, dekat rumah sakit.');
    ok('"harus satu lantai, akses kursi roda" → Prefer', /satu lantai/.test(String(s2.preferences)) && /kursi roda/.test(String(s2.preferences)), String(s2.preferences));
    const s3 = extractQualificationState([C('Rumah sewa Tegalsari'), A('Ini 2 rumah')], 'Yang nomor 1 itu bertingkat nggak? Kalau bertingkat saya nggak mau.');
    ok('"kalau bertingkat saya nggak mau" → Hindari bertingkat', /bertingkat/.test(String(s3.redFlags)), String(s3.redFlags));
  }
  ok('"bertingkat nggak?" = pertanyaan atribut', g.isAttributeQuestion('Yang nomor 1 itu bertingkat nggak?'));
  ok('okupansi kos → catat, tim agent', /okupansi/i.test(String(tryTerminologyAnswer('Rata-rata okupansi kos di situ berapa persen?'))));
  {
    const hist = [C('Apartemen sewa Kalijudan'), A('Baik, Kak 😊 Survei dijadwalkan tanggal *26 September 2026*, *Jam 10* ya. Nanti tim kami hubungi untuk konfirmasi.')];
    const r = g.scheduleViewingFromText('Sabtu nggak jadi, Minggu aja jam yang sama.', true, { history: hist });
    ok('"Sabtu nggak jadi, Minggu aja jam yang sama" → Minggu + Jam 10', r && /27 September 2026/.test(r.reply) && /Jam 10/.test(r.reply), r && r.reply.slice(0, 90));
  }

  console.log('\n[2] Jalur WhatsApp lengkap (provider=private)');
  {
    const { ChatSession, ChatMessage } = require('../models');
    const { generateWhatsAppAIReply } = require('../services/whatsappAIService');
    const run = async (turns, phone) => {
      const session = await ChatSession.create({ name: 'Sim M208', normalizedName: 'sim m208', phone, normalizedPhone: phone, source: 'kirimi_whatsapp', lastMessageAt: new Date() }).catch(() => null);
      if (!session) return null;
      const out = [];
      for (const msg of turns) {
        await ChatMessage.create({ chatSessionId: session.id, role: 'user', message: msg, channel: 'kirimi_whatsapp' });
        const r = await generateWhatsAppAIReply({ message: msg, session: { id: session.id, agentUserId: AG, agentName: 'Natasha', name: 'Sim M208', normalizedPhone: phone, source: 'kirimi_whatsapp' }, agentUserId: AG, agentName: 'Natasha' });
        const reply = String(r?.reply || '');
        await ChatMessage.create({ chatSessionId: session.id, role: 'ai', message: reply, channel: 'kirimi_whatsapp' });
        out.push({ msg, reply, provider: r?.provider || '' });
      }
      try { await ChatMessage.destroy({ where: { chatSessionId: session.id } }); await session.destroy(); } catch (_) { /* ignore */ }
      return out;
    };
    const r1 = await run(['Cari rumah dijual di Sidoarjo area Candramas, budget 50 juta.', 'Maaf salah ketik, maksudnya 500 juta.', 'Sip terima kasih.'], '6280000082001');
    if (!r1) { console.log('  (DB tidak tersedia — bagian [2] dilewati)'); }
    else {
      ok('R1: ralat budget → kartu dikirim ulang dengan budget baru', /rumah dijual di \*Candramas\*/i.test(r1[1].reply) && /^\s*1\. \*/m.test(r1[1].reply), r1[1].reply.slice(0, 60));
    }
    const r4 = await run(['Rumah di Jl. Rungkut Menanggal No. 38 masih ada? Sewa.', 'Harganya berapa? Bisa dicicil per bulan?', 'Ok saya ambil yang itu. Masuk awal Oktober, 1 tahun.', 'Survei besok jam 10.', 'Cukup, terima kasih.', 'Halo, yang kemarin masih tersedia kan?', 'Jadi survei besok tetap ya?'], '6280000082004');
    if (r4) {
      ok('R4: alamat yang disebut → harga unit itu (bukan "nomor berapa?")', /No\. 38/.test(r4[1].reply) && /harganya/.test(r4[1].reply), r4[1].reply.slice(0, 80));
      ok('R4 summary: Masuk Oktober 2026', /Masuk: \*\d{2} Oktober 2026\*/.test(r4[4].reply), (r4[4].reply.match(/Masuk: [^\n]*/) || [])[0]);
      ok('R4: "yang kemarin masih tersedia?" → jawab unit terpilih', /tersedia/.test(r4[5].reply) && /No\. 38/.test(r4[5].reply), r4[5].reply.slice(0, 80));
      ok('R4: "survei besok tetap ya?" → Tetap (bukan "diubah")', /Tetap, Kak/.test(r4[6].reply), r4[6].reply.slice(0, 60));
    }
    const r6 = await run(['Cari rumah dijual di Surabaya atau Sidoarjo, budget 800 juta.'], '6280000082006');
    if (r6) ok('R6: dua kota → tanya kota mana dulu', /Surabaya\* atau \*Sidoarjo/.test(r6[0].reply), r6[0].reply.slice(0, 80));
    const r9 = await run(['Halo, kemarin katanya agent mau telpon tapi belum ada kabar.', 'Kok lama balasnya sih.'], '6280000082009');
    if (r9) {
      ok('R9: keluhan agent belum telpon → serah-terima (bukan penutup)', /agent kami \(manusia\)/.test(r9[0].reply), r9[0].reply.slice(0, 60));
      ok('R9: "kok lama balasnya" → maaf lama menunggu', /lama menunggu/.test(r9[1].reply), r9[1].reply.slice(0, 60));
    }
    const r10 = await run(['Rumah dijual Sidoarjo Candramas, 2 kamar, cash.', 'Nomor 1 harga netnya berapa?', 'Kemahalan. 400 juta boleh?', 'Ya sudah kalau nggak bisa, tapi saya tetap mau lihat dulu.', 'Sabtu ini jam 9 pagi, saya sama istri.'], '6280000082010');
    if (r10) {
      ok('R10: tawaran 400 juta dicatat', /Penawaran \*400 juta\* saya catat/.test(r10[2].reply), r10[2].reply.slice(0, 60));
      ok('R10: tanggal sukarela sesudah "kapan pun siap" → survei dijadwalkan', /Survei dijadwalkan tanggal/.test(r10[4].reply) && /Jam 9 pagi/.test(r10[4].reply), r10[4].reply.slice(0, 80));
    }
    const r5 = await run(['Ada rumah sewa di Surabaya yang ada kolam renang? Area mana saja.'], '6280000082005');
    if (r5) ok('R5: "area mana saja" → langsung 2 kartu dari area berstok', /Area bebas ya/.test(r5[0].reply) && /^\s*1\. \*/m.test(r5[0].reply), r5[0].reply.slice(0, 80));
  }

  console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

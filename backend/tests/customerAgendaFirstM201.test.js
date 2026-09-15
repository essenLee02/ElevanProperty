/**
 * M201 (16 Sep 2026) — agenda customer didahulukan; summary di percakapan ke-10-12
 * hanya bila data minimal (4 slot wajib: transaksi, tipe, kota, area) sudah dijawab —
 * bila belum, giliran 10-12 dipakai untuk MENANYAKAN slot wajib itu. Deterministik.
 */
require('dotenv').config();
process.env.AI_PRIMARY_PROVIDER = 'private';
let pass = 0, fail = 0;
const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}${e ? ' — ' + e : ''}`); } };
const A = (m) => ({ role: 'ai', message: m }); const C = (m) => ({ role: 'customer', message: m });

(async () => {
  const prs = require('../services/propertyRecommendationService');
  await prs.initCityCache(); await prs.initLandmarkCache(); await prs.initFacilityCache();
  const pb = require('../services/aiPromptBuilderService');
  const { tryTerminologyAnswer } = require('../utils/terminologyAnswerGate');
  const { findAreaCandidatesInText } = require('../services/areaAvailabilityService');
  const { generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');
  const AGENT = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';

  console.log('\n[1] Pertanyaan proses beli dijawab (bukan diabaikan)');
  ok('biaya notaris', /notaris/i.test(tryTerminologyAnswer('Biaya notaris biasanya berapa?') || ''));
  ok('PBB siapa yang bayar', /PBB/.test(tryTerminologyAnswer('Kalau rumah second, PBB-nya siapa yang bayar?') || ''));
  ok('DP KPR minimal', /DP/.test(tryTerminologyAnswer('Kalau KPR DP-nya minimal berapa persen?') || ''));
  ok('harga rata-rata → bukan angka umum (null → gerbang katalog)', tryTerminologyAnswer('Rumah di Surabaya rata-rata berapa harganya?') === null);

  console.log('\n[2] Pengakuan bukan jawaban slot; typo-area hanya untuk sebutan tempat');
  const st = pb.extractQualificationState([C('Mau beli rumah di Surabaya.'), A('Di area/kawasan mana, atau ada patokan lokasi tertentu?')], 'Oke, saya paham.');
  ok('"Oke, saya paham" → area & patokan tetap kosong', !st.district && !st.anchorPoint, `${st.district}/${st.anchorPoint}`);
  const stB = pb.extractQualificationState([C('Beli rumah di Surabaya'), A('Harganya sekitar 500 juta, sesuai?')], 'iya');
  ok('"iya" atas pertanyaan ya/tidak tetap jawaban', Boolean(stB.budget), JSON.stringify(stB.budget));
  const fz = await findAreaCandidatesInText({ userId: AGENT, city: 'Surabaya', text: 'Oke, saya paham.' });
  ok('"Oke, saya paham." tidak fuzzy ke area Pakal', !fz.area && !(fz.candidates || []).length, JSON.stringify(fz));
  const fz2 = await findAreaCandidatesInText({ userId: AGENT, city: 'Surabaya', text: 'Kalau Wiyunk?' });
  ok('"Kalau Wiyunk?" tetap fuzzy → Wiyung', fz2.area === 'Wiyung', JSON.stringify(fz2));
  const stC = pb.extractQualificationState([C('Mau beli rumah di Surabaya.'), A('Di area/kawasan mana, atau ada patokan lokasi tertentu?')], 'Wiyung saja.');
  ok('"Wiyung saja" → area Wiyung, patokan kosong', stC.district === 'Wiyung' && !stC.anchorPoint, `${stC.district}/${stC.anchorPoint}`);

  console.log('\n[3] Gate C: slot wajib kosong di giliran 10 → tanya area, bukan summary');
  const hist = [C('Mau beli rumah di Surabaya.'), A('Baik, beli Rumah di Surabaya. Di area mana?')];
  for (let i = 0; i < 8; i++) hist.push(C(`Pertanyaan ke-${i + 2} soal legalitas?`), A('Jawaban istilah.'));
  const r = await generatePrivateTerminalMassege({ session: { id: 0 }, history: hist, userMessage: 'Oke, saya paham.', agentName: 'Natasha', agentUserId: AGENT, recommendationContext: null, externalError: new Error('x') });
  ok('giliran ke-10 tanpa area → BUKAN summary', !/[✓✔]\s*Rencana/.test(String(r.reply)), String(r.reply).slice(0, 80));
  ok('balasan menanyakan area/kawasan', /area|kawasan/i.test(String(r.reply)), String(r.reply).slice(0, 120));

  console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

/**
 * M202 (16 Sep 2026) — 20 sesi hit backend (scripts/sim-scenarios-z20.js). Temuan run 1 yang
 * dikunci di sini: tipe yang dinegasikan, investor "disewakan lagi", BPN ≠ Balikpapan,
 * "boleh bayar per 3 bulan" ≠ tanggal survei, bahasa sesi melekat, pertanyaan proses beli,
 * "belum ada" tidak diulang, "Ada 2 unit lagi yang mirip?" = minta listing.
 */
require('dotenv').config();
process.env.AI_PRIMARY_PROVIDER = 'private';
let pass = 0, fail = 0;
const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}${e ? ' — ' + e : ''}`); } };
const A = (m) => ({ role: 'ai', message: m }); const C = (m) => ({ role: 'customer', message: m });

(async () => {
  const prs = require('../services/propertyRecommendationService');
  await prs.initCityCache(); await prs.initLandmarkCache(); await prs.initFacilityCache();
  const g = require('../utils/listingSelectionGate');
  const q = require('../utils/customerQuestionGuard');
  const { customerAsksAvailability } = require('../utils/areaAvailabilityGate');
  const { tryTerminologyAnswer } = require('../utils/terminologyAnswerGate');
  const { parseCustomerDate } = require('../utils/customerDateParser');

  console.log('\n[1] Tipe & transaksi dari kalimat bernegasi / investor / singkatan');
  ok('"Kok yang dikirim apartemen? Saya minta rumah" → house', prs.detectCanonicalType('Kok yang dikirim apartemen? Saya minta rumah.') === 'house');
  ok('"Kalau nggak ada ruko, rumah yang bisa buat usaha" → house', prs.detectCanonicalType('Kalau nggak ada ruko, rumah yang bisa buat usaha di MERR?') === 'house');
  ok('"beli apartemen untuk investasi, disewakan lagi" → sale', prs.detectTransactionType('Saya mau beli apartemen di Surabaya untuk investasi, disewakan lagi. MERR ada?') === 'sale');
  ok('"cari rumah yang disewakan" tetap rent', prs.extractPropertyFilters('cari rumah yang disewakan di surabaya', []).transactionType === 'rent');
  ok('"rent apt in sby" → apartment + Surabaya', prs.detectCanonicalType('hi, looking to rent apt in sby, kalijudan area') === 'apartment' && prs.detectLocation('hi, looking to rent apt in sby, kalijudan area') === 'Surabaya');
  ok('"cek sertifikat di BPN" bukan Balikpapan', prs.detectLocation('Bisa cek sertifikat di BPN dulu?') === '');

  console.log('\n[2] Survei vs pembayaran / browsing / Inggris');
  const offer = [A('Baik, Kak 😊 Dicatat pilihannya: *X* (3.2 juta/bulan).\n\nMau saya jadwalkan survei ke unit ini?')];
  ok('"Boleh bayar per 3 bulan?" bukan jawaban survei', g.tryPendingViewingConfirmation({ message: 'Boleh bayar per 3 bulan?', history: offer, isId: true }) === null);
  ok('"Saya cuma mau lihat harga dulu" = menjelajah, bukan survei', q.customerIsBrowsing('Saya cuma mau lihat harga dulu.') && !q.customerRequestsViewing('Saya cuma mau lihat harga dulu.'));
  ok('"can i view this sat 10am?" = minta survei', q.customerRequestsViewing('can i view this sat 10am?'));
  ok('"Bisa cek sertifikat di BPN dulu?" bukan survei', !q.customerRequestsViewing('Bisa cek sertifikat di BPN dulu?'));
  ok('"Survei nanti saja setelah ditelepon" bukan permintaan survei', !q.customerRequestsViewing('Survei nanti saja setelah ditelepon.'));
  const now = new Date(2026, 8, 16); // Rabu
  ok('"survei Minggu jam 10" → hari Minggu (20 Sep)', (parseCustomerDate('survei hari minggu jam 10', now) || {}).formatted === '20 September 2026');
  ok('"next sat" → Sabtu pekan depan', (parseCustomerDate('next sat', now) || {}).formatted === '26 September 2026', (parseCustomerDate('next sat', now) || {}).formatted);

  console.log('\n[3] Atribut unit & permintaan listing');
  for (const m of ['Sudah ada penyewanya sekarang?', 'Depositnya berapa bulan?', 'Dekat tol nggak?', 'Akses kursi roda bisa?', 'Check-in jam berapa?', 'Ada garasinya?', 'Bisa kurang nggak?']) ok(`atribut: "${m}"`, g.isAttributeQuestion(m));
  ok('"Ada 2 unit lagi yang mirip?" = minta listing', customerAsksAvailability('Ada 2 unit lagi yang mirip?'));

  console.log('\n[4] Pertanyaan proses beli / kepercayaan dijawab');
  for (const [m, re] of [['Agentnya resmi? Ada kantornya?', /terdaftar/i], ['Komisinya berapa persen, siapa yang bayar?', /PENJUAL/], ['Ada biaya tersembunyi nggak?', /BPHTB/], ['Rumah second kena pajak apa?', /PPh/], ['Bisa KPR? DP 20%.', /Bisa/], ['Boleh untuk usaha kafe secara zonasi?', /zonasi/i]]) {
    ok(`"${m}"`, re.test(tryTerminologyAnswer(m) || ''));
  }

  console.log('\n[5] Bahasa sesi melekat');
  const { generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');
  const hist = [C('Beli rumah di Surabaya, Wiyung.'), A('Ini 2 rumah dijual di *Wiyung* ya, Kak 😊'), C('Nomor 2 Wiyung.'), A('Dicatat pilihannya: *Wiyung House Sale Surabaya*'), C('Sertifikatnya?'), A('Untuk *Wiyung House Sale Surabaya*: SHGB'), C('Survei Selasa jam 10.'), A('Survei dijadwalkan tanggal *22 September 2026*, *Jam 10*.')];
  const r = await generatePrivateTerminalMassege({ session: { id: 0 }, history: hist, userMessage: 'Cash.', agentName: 'Natasha', agentUserId: process.env.TEST_AGENT_USER_ID || 'NA40D8N007', recommendationContext: null, externalError: new Error('x') });
  ok('"Cash." tetap dijawab Bahasa Indonesia', !/\b(target date|Who will|Is there)\b/i.test(String(r.reply)), String(r.reply).slice(0, 80));

  console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

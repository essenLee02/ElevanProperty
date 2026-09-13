/**
 * M199 (14 Sep 2026) — customer plin-plan (area/kota bolak-balik) & dokumentasi/survei/jarak.
 * Simulasi P11-P23 (logs/sim-private-m199-run1.md → logs/sim-private-m199-final.md).
 * Deterministik — tanpa LLM; DB hanya untuk cache area (detectAreaName).
 */
require('dotenv').config();
process.env.AI_PRIMARY_PROVIDER = 'private';
let pass = 0, fail = 0;
const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}${e ? ' — ' + e : ''}`); } };
const A = (m) => ({ role: 'ai', message: m }); const C = (m) => ({ role: 'customer', message: m });
const card = (n, t, area, addr, price) => `${n}. *${t}*\n   📍 Lokasi: SURABAYA, JAWA TIMUR\n   🗺️ Area: ${area}\n   🏡 Alamat: ${addr}\n   💰 Estimasi Harga: *${price}*`;

const g = require('../utils/listingSelectionGate');
const { customerAsksAvailability } = require('../utils/areaAvailabilityGate');
const { parseCustomerDate } = require('../utils/customerDateParser');
const guard = require('../utils/customerQuestionGuard');

(async () => {
  const prs = require('../services/propertyRecommendationService');
  await prs.initCityCache(); await prs.initLandmarkCache();
  const pb = require('../services/aiPromptBuilderService');

  console.log('\n[1] Kartu lintas blok & area');
  const h = [
    A(`Ini 2 rumah dijual di *Pakuwon* ya, Kak 😊\n\n${card(1, 'Pakuwon City House Sale Surabaya', 'Pakuwon City', 'Jl. Pakuwon City No. 2, Surabaya', '641 juta')}\n\n${card(2, 'Pakuwon City House Sale Surabaya', 'Pakuwon City', 'Jl. Pakuwon City No. 76, Surabaya', '668.8 juta')}`),
    C('Saya pilih nomor 2.'), A('Baik, Kak 😊 Dicatat pilihannya: *Pakuwon City House Sale Surabaya* (668.8 juta).'),
    C('Eh, coba yang di Wiyung dulu deh.'),
    A(`Ini 2 Rumah dijual di *Wiyung* ya, Kak 😊\n\n${card(1, 'Wiyung House Sale Surabaya', 'Wiyung', 'Jl. Wiyung No. 72, Surabaya', '355 juta')}\n\n${card(2, 'Wiyung House Sale Surabaya', 'Wiyung', 'Jl. Wiyung No. 81, Surabaya', '458.2 juta')}`),
  ];
  ok('parseAllShownCards menyimpan 4 kartu dari 2 blok', g.parseAllShownCards(h).length === 4);
  ok('lastSentAreaLabel = wiyung', g.lastSentAreaLabel(h) === 'wiyung', g.lastSentAreaLabel(h));
  ok('mentionedCardArea("Pakuwon City nomor 1") = Pakuwon City', g.mentionedCardArea('yang tadi di Pakuwon City nomor 1', g.parseAllShownCards(h)) === 'Pakuwon City');
  const sel = g.tryListingSelectionAnswer({ message: 'Yang tadi di Pakuwon City nomor 1 harganya berapa?', history: h });
  ok('"Pakuwon City nomor 1" → kartu Pakuwon No. 2 (blok lama), bukan Wiyung', sel && sel.attributeQuestion && sel.card.address === 'Jl. Pakuwon City No. 2, Surabaya', JSON.stringify(sel && sel.card));

  console.log('\n[2] Pilihan lama dipanggil kembali');
  const r1 = g.tryRecallPreviousPick({ message: 'Hmm, balik ke Pakuwon saja, yang tadi saya pilih.', history: h });
  ok('"balik ke Pakuwon, yang tadi saya pilih" → No. 76 (668.8 juta)', r1 && r1.card.address === 'Jl. Pakuwon City No. 76, Surabaya', r1 && r1.card.address);
  ok('balasan memuat fingerprint "Dicatat pilihannya"', r1 && /Dicatat pilihannya/.test(r1.reply));
  const r2 = g.tryRecallPreviousPick({ message: 'Itu yang mana ya? Saya lupa.', history: h });
  ok('"yang mana ya? saya lupa" → pilihan terakhir', r2 && r2.card.address === 'Jl. Pakuwon City No. 76, Surabaya');
  ok('pesan biasa tidak memicu recall', g.tryRecallPreviousPick({ message: 'Alamat lengkapnya di mana?', history: h }) === null);
  ok('listConfirmedPicks memetakan pilihan ke kartu blok lama', g.listConfirmedPicks(h).length === 1 && g.listConfirmedPicks(h)[0].card.address === 'Jl. Pakuwon City No. 76, Surabaya');

  console.log('\n[3] Area dari master lokasi (ekstraktor), terbaru menang, bukan landmark/tempat kerja');
  const st1 = pb.extractQualificationState([C('Mau beli rumah di Surabaya, area Pakuwon.'), A('ini 2')], 'Eh, coba yang di Wiyung dulu deh.');
  ok('district = Wiyung (sebutan terakhir)', st1.district === 'Wiyung', st1.district);
  const st2 = pb.extractQualificationState([C('Mau beli rumah di Gresik, Driyorejo. Budget 400 juta.'), A('ini 1')], 'Masuknya Januari tahun depan.');
  ok('district = Driyorejo (tidak ada di daftar statis)', st2.district === 'Driyorejo', st2.district);
  ok('"Januari tahun depan" → 01 Januari 2027', st2.moveInDate === '01 Januari 2027', st2.moveInDate);
  ok('"Bank BCA ya" bukan area', prs.detectAreaName('Bank BCA ya') === '');
  const st3 = pb.extractQualificationState([C('Beli rumah di Sidoarjo, Alana Cemandi'), A('ini 2')], 'Nggak cocok, kejauhan dari kerja saya di Waru.');
  ok('"kerja saya di Waru" tidak mengganti area', st3.district === 'Alana Cemandi', st3.district);

  console.log('\n[4] Permintaan listing & dokumentasi');
  ok('"Tapi Pakuwon juga bagus ya, ada?" = minta listing', customerAsksAvailability('Tapi Pakuwon juga bagus ya, ada?'));
  ok('"Kalau Wiyung?" = minta listing', customerAsksAvailability('Kalau Wiyung?'));
  ok('"Kalau nego?" BUKAN minta listing', !customerAsksAvailability('Kalau nego?'));
  ok('"Denah rumahnya ada?" BUKAN minta listing', !customerAsksAvailability('Denah rumahnya ada?'));
  ok('"Ada videonya nggak?" BUKAN minta listing', !customerAsksAvailability('Ada videonya nggak?'));
  ok('"Berapa per bulan yang nomor 1?" = pertanyaan atribut', g.isAttributeQuestion('Berapa per bulan yang nomor 1?'));
  ok('"Sudah pernah direnovasi?" = pertanyaan atribut', g.isAttributeQuestion('Sudah pernah direnovasi?'));
  ok('"Alamat lengkapnya tolong kirim ya" = pertanyaan atribut', g.isAttributeQuestion('Alamat lengkapnya tolong kirim ya.'));
  ok('"Tropodo kan luas" bukan pertanyaan luas', !/luas/.test(String((g.isAttributeQuestion('Alamatnya ini di Tropodo yang mana? Tropodo kan luas.') && 'x') || '')) );

  console.log('\n[5] Survei: kata kerja + tanggal tanpa kata niat; hari yang sama = pekan depan');
  ok('"saya survei saja Minggu ini" = minta survei', guard.customerRequestsViewing('Ya sudah, saya survei saja Minggu ini.'));
  const now = new Date(2026, 8, 13); // Minggu
  ok('"Minggu saja jam 10" (diucap hari Minggu) → Minggu depan', parseCustomerDate('hari minggu saja jam 10', now).formatted === '20 September 2026', parseCustomerDate('hari minggu saja jam 10', now).formatted);
  ok('"Sabtu ini" tetap Sabtu terdekat', parseCustomerDate('sabtu ini', now).formatted === '19 September 2026');
  const sv = g.scheduleViewingFromText('Survei Selasa depan jam 3 sore ya.');
  ok('"Survei Selasa depan jam 3 sore" → terjadwal', sv && sv.verdict === 'viewing-scheduled', sv && sv.verdict);
  const offer = [A('Dicatat pilihannya: *X*.\n\nMau saya jadwalkan survei ke unit ini?'), C('Mau'), A('Siap, Kak 😊 Enaknya survei tanggal berapa?'), C('Jam 10 pagi bisa?'), A('Baik, jam *Jam 10 pagi* dicatat, Kak 😊 Untuk tanggalnya, hari apa yang pas?')];
  ok('pesan bukan tanggal setelah tanya tanggal → null (tidak mengulang pertanyaan)', g.tryPendingViewingSchedule({ message: 'Nanti saya minta agentnya jemput di gerbang ya.', history: offer }) === null);

  console.log('\n[6] Pembanding & ketersediaan unit');
  ok('COMPARE_CUE_RE: "luas tanah masing-masing"', g.COMPARE_CUE_RE.test('Bedanya apa? Luas tanah masing-masing?'));
  const av = await g.answerCardAttribute({ message: 'Yang nomor 1 Driyorejo tadi masih ada?', card: { title: 'Driyorejo House Sale Gresik', address: 'Jl. Driyorejo No. 69, Gresik', priceText: '387.2 juta' }, userId: null });
  ok('"masih ada?" → jawaban ketersediaan', av && /tersedia|available/i.test(av.reply), av && av.reply);

  console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

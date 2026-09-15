/**
 * M200 (15 Sep 2026) — transkrip produksi Wiyung 21:46-21:52 (Private Agent aktif).
 * Empat respons salah: pertanyaan fasilitas unit memicu gerbang listing, "rmh trsbut sdh
 * SHM?" dijawab kamus istilah, "Saya msh tanya dlu" dibalas "Boleh disebutkan tanggal",
 * summary tanpa tanggal survei & tanpa fasilitas unit; plus "TIM kami" → landmark TIM
 * (Jakarta Pusat) yang mengganti kota sesi. Deterministik; DB hanya cache lokasi/fasilitas.
 */
require('dotenv').config();
process.env.AI_PRIMARY_PROVIDER = 'private';
let pass = 0, fail = 0;
const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}${e ? ' — ' + e : ''}`); } };
const A = (m) => ({ role: 'ai', message: m }); const C = (m) => ({ role: 'customer', message: m });
const card = (n, t, area, addr, price, fac) => `${n}. *${t}*\n   📍 Lokasi: SURABAYA, JAWA TIMUR\n   🗺️ Area: ${area}\n   🏡 Alamat: ${addr}\n   💰 Estimasi Harga: *${price}*\n   🏠 Tipe: Rumah — Dijual\n   🏷️ Fasilitas: ${fac}`;

(async () => {
  const prs = require('../services/propertyRecommendationService');
  await prs.initCityCache(); await prs.initLandmarkCache(); await prs.initFacilityCache();
  const pb = require('../services/aiPromptBuilderService');
  const g = require('../utils/listingSelectionGate');

  console.log('\n[1] Landmark pendek / kata umum bukan lokasi');
  ok('"Nanti tim kami hubungi" → tidak ada landmark/kota', prs.detectLandmark('Nanti tim kami hubungi untuk konfirmasi.') === '' && prs.detectLocation('Nanti tim kami hubungi untuk konfirmasi.') === '');
  ok('"Yang dekat Waru ada?" tetap WARU', prs.detectLandmark('Yang dekat Waru ada?') === 'WARU');
  ok('"Kalau merr?" tetap MERR', prs.detectLandmark('Kalau merr?') === 'MERR');
  ok('"Kalau dari Surabaya pusat berapa lama?" → kota asal diabaikan', prs.detectLocation('Kalau dari Surabaya pusat berapa lama?') === '');

  console.log('\n[2] Riwayat produksi: SHM / fasilitas / survei');
  const h = [
    C('Saya cari rumah dijual di Surabaya, area Wiyung.'),
    A(`Ini 2 rumah dijual di *Wiyung* ya, Kak 😊\n\n${card(1, 'Wiyung House Sale Surabaya', 'Wiyung', 'Jl. Wiyung No. 72, Surabaya', '355 juta', 'CARPORT, KITCHEN SET')}\n\n${card(2, 'Wiyung House Sale Surabaya', 'Wiyung', 'Jl. Wiyung No. 81, Surabaya', '458.2 juta', 'AC, GARDEN')}`),
    C('Apa blh minta 4 listing?'),
    A(`Ini 2 rumah dijual TAMBAHAN di *Wiyung* ya, Kak 😊\n\n${card(3, 'Wiyung House Sale Surabaya', 'Wiyung', 'Jl. Wiyung No. 60, Surabaya', '465.8 juta', 'GARDEN, CCTV 24 JAM, PLN ELECTRICITY, KITCHEN SET, SECURITY, WATER HEATER, AC')}\n\n${card(4, 'Wiyung House Sale Surabaya', 'Wiyung', 'Jl. Wiyung No. 17, Surabaya', '494.8 juta', 'GARDEN')}`),
    C('Saya mau yg no 3'),
    A('Baik, Kak 😊 Dicatat pilihannya: *Wiyung House Sale Surabaya* (465.8 juta).\n\n🏡 Alamat: Jl. Wiyung No. 60, Surabaya\n💰 Estimasi Harga: 465.8 juta\n\nMau saya jadwalkan survei ke unit ini?'),
  ];
  ok('isBareAvailabilityQuestion("Apakah ada gym, Kidz zone dan pet Playground?")', g.isBareAvailabilityQuestion('Apakah ada gym, Kidz zone dan pet Playground?'));
  ok('"Kak, apakah rmh trsbut sdh SHM?" = pertanyaan atribut', g.isAttributeQuestion('Kak, apakah rmh trsbut sdh SHM?'));
  const st = pb.extractQualificationState([...h, C('Apakah ada gym, Kidz zone dan pet Playground?'), A('Untuk *Wiyung House Sale Surabaya*: gym, kids zone, pet playground belum tercatat.')], 'Kak, apakah rmh trsbut sdh SHM?');
  ok('fasilitas kebutuhan memuat Pet Playground (tidak ada di master)', (st.facilities || []).some((f) => /pet playground/i.test(f)), JSON.stringify(st.facilities));
  ok('tidak ada item sampah ("Fasilitas Apa Sja") dan tidak dobel Kidz/Kids', !(st.facilities || []).some((f) => /apa sja|kidz/i.test(f)), JSON.stringify(st.facilities));
  ok('pickedUnitFacilities → fasilitas kartu no. 3', g.pickedUnitFacilities(h).includes('CCTV 24 JAM') && g.pickedUnitFacilities(h).length === 7, JSON.stringify(g.pickedUnitFacilities(h)));

  console.log('\n[3] Jawaban tanggal survei bukan tanggal masuk');
  const h2 = [...h, C('Ini ya saya mau survei'), A('Siap, Kak 😊 Enaknya survei tanggal berapa?'), C('Minggu dpn, Kak. Jam 3 sore'), A('Baik, Kak 😊 Survei dijadwalkan tanggal *22 September 2026*, *Jam 3 sore* ya.')];
  const st2 = pb.extractQualificationState(h2, 'Ok, terima kasih');
  ok('viewingDate terisi', /22 September 2026/.test(st2.viewingDate || ''), st2.viewingDate);
  ok('moveInDate KOSONG', !st2.moveInDate, st2.moveInDate);
  ok('kota tetap Surabaya (bukan Jakarta Pusat dari "tim kami")', st2.city === 'Surabaya', st2.city);
  const st3 = pb.extractQualificationState([C('sewa apartemen kalijudan'), A('Mau saya jadwalkan survei? Tanggal berapa?')], 'Untuk 1 tahun, mulai November.');
  ok('"mulai November" tetap tanggal masuk', /November/.test(st3.moveInDate || '') && !st3.viewingDate);

  console.log('\n[4] Gerbang jadwal: pesan bukan tanggal');
  const offer = [A('Siap, Kak 😊 Enaknya survei tanggal berapa?')];
  const r1 = g.tryPendingViewingSchedule({ message: 'Saya msh tanya dlu saja', history: offer, isId: true });
  ok('"Saya msh tanya dlu saja" → ditunda (bukan "Boleh disebutkan tanggal")', r1 && r1.verdict === 'viewing-deferred', r1 && r1.verdict);
  ok('"Iya, Kak" (setuju tanpa tanggal) → minta tanggalnya lagi', (g.tryPendingViewingSchedule({ message: 'Iya, Kak', history: offer, isId: true }) || {}).verdict === 'viewing-schedule-unclear');
  ok('"Nanti saya minta agentnya jemput di gerbang ya" → null (gerbang lain menjawab)', g.tryPendingViewingSchedule({ message: 'Nanti saya minta agentnya jemput di gerbang ya.', history: offer, isId: true }) === null);
  const r2 = g.tryPendingViewingSchedule({ message: 'Minggu dpn, Kak. Jam 3 sore', history: offer, isId: true });
  ok('"Minggu dpn, Kak. Jam 3 sore" → terjadwal', r2 && r2.verdict === 'viewing-scheduled' && /Jam 3 sore/.test(r2.reply), r2 && r2.reply);

  console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

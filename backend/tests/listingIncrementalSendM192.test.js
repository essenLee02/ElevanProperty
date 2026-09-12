/**
 * M192 (12 Sep 2026) — KONTRAK PENGIRIMAN LISTING INKREMENTAL (arahan pemilik).
 * Listing yang sudah dikirim tidak pernah dikirim ulang; kirim ulang hanya bila
 * area/kota/transaksi berganti; permintaan angka dihitung dari yang sudah ada:
 * sudah 2 minta 5 → 3 baru; sudah 2 minta 3 → 1 baru; semua sudah → katakan.
 * Diuji lewat gerbang ketersediaan nyata (katalog agent Natasha), kedua jalur
 * (whatsappAIService & chatbotPrivateController) memanggil fungsi yang sama.
 */
require('dotenv').config();
const { tryAreaAvailabilityAnswer } = require('../utils/areaAvailabilityGate');
const { parseCardsFromText, listSentCards } = require('../utils/listingSelectionGate');
const AGENT = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
let pass = 0, fail = 0;
const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}${e ? ' — ' + e : ''}`); } };
const A = (m) => ({ role: 'ai', message: m }); const C = (m) => ({ role: 'customer', message: m });
const addrs = (t) => parseCardsFromText(t).map((c) => c.address);

(async () => {
  const prs = require('../services/propertyRecommendationService');
  await prs.initCityCache(); await prs.initLandmarkCache(); await prs.initFacilityCache();
  const base = { userId: AGENT, city: 'Sidoarjo', area: 'Candramas', buildingType: 'House', transactionType: 'Sale', typeLabel: 'rumah', isId: true };

  console.log('\n[1] Kirim pertama: 2 kartu');
  const r1 = await tryAreaAvailabilityAnswer({ ...base, message: 'ada rumah di Candramas?', history: [] });
  const a1 = r1 ? addrs(r1.reply) : [];
  ok('2 kartu terkirim', r1 && a1.length === 2, JSON.stringify(a1));
  const hist = [C('ada rumah di Candramas?'), A(r1 ? r1.reply : '')];

  console.log('\n[2] "minta 3 listing" setelah 2 → hanya 1 BARU');
  const r2 = await tryAreaAvailabilityAnswer({ ...base, message: 'minta 3 listing dong', history: hist });
  const a2 = r2 ? addrs(r2.reply) : [];
  ok('tepat 1 kartu', a2.length === 1, JSON.stringify(a2));
  ok('kartu itu belum pernah dikirim', a2.every((x) => !a1.includes(x)));
  ok('kepala pesan menyebut TAMBAHAN', /TAMBAHAN/i.test(r2 ? r2.reply : ''));
  hist.push(C('minta 3 listing dong'), A(r2 ? r2.reply : ''));

  console.log('\n[3] "minta 5 listing" setelah 3 → 2 BARU (bukan 5)');
  const r3 = await tryAreaAvailabilityAnswer({ ...base, message: 'boleh minta 5 listing?', history: hist });
  const a3 = r3 ? addrs(r3.reply) : [];
  ok('tepat 2 kartu baru', a3.length === 2 && a3.every((x) => ![...a1, ...a2].includes(x)), JSON.stringify(a3));
  hist.push(C('boleh minta 5 listing?'), A(r3 ? r3.reply : ''));

  console.log('\n[4] Minta angka ≤ yang sudah dikirim → tidak kirim ulang');
  const r4 = await tryAreaAvailabilityAnswer({ ...base, message: 'kirim 2 listing', history: hist });
  ok('tidak ada kartu, menjelaskan sudah dikirim', r4 && r4.verdict === 'already-sent' && addrs(r4.reply).length === 0, r4 && r4.verdict);

  console.log('\n[5] Tanpa angka setelah listing tampil → 2 unit BARU lagi (bukan yang lama)');
  const r5 = await tryAreaAvailabilityAnswer({ ...base, message: 'ada lagi yang lain?', history: hist });
  const a5 = r5 ? addrs(r5.reply) : [];
  ok('semua baru', a5.length > 0 && a5.every((x) => ![...a1, ...a2, ...a3].includes(x)), JSON.stringify(a5));

  console.log('\n[6] Ganti AREA → mulai dari awal (2 kartu area baru)');
  const r6 = await tryAreaAvailabilityAnswer({ ...base, area: 'Tropodo', message: 'kalau di Tropodo ada?', history: hist });
  const a6 = r6 ? addrs(r6.reply) : [];
  ok('2 kartu Tropodo', a6.length === 2 && a6.every((x) => /Tropodo/i.test(x)), JSON.stringify(a6));

  console.log('\n[7] Ganti TRANSAKSI (resetSent) → boleh kirim ulang set baru');
  const r7 = await tryAreaAvailabilityAnswer({ ...base, transactionType: 'Rent', area: 'Suko', message: 'sewa saja', history: hist, resetSent: true });
  ok('kartu sewa terkirim', r7 && addrs(r7.reply).length > 0, r7 && r7.verdict);

  console.log('\n[9] M193: stok kurang dari permintaan → minta maaf + kirim yang BARU saja');
  {
    const g = { ...base, city: 'Gresik', area: 'Driyorejo' };   // Driyorejo: 4 rumah dijual
    const d1 = await tryAreaAvailabilityAnswer({ ...g, message: 'rumah di Driyorejo ada?', history: [] });
    const h2 = [C('rumah di Driyorejo ada?'), A(d1 ? d1.reply : '')];
    const d2 = await tryAreaAvailabilityAnswer({ ...g, message: 'minta 6 listing dong', history: h2 });
    const n2 = d2 ? addrs(d2.reply) : [];
    ok('2 kartu awal', d1 && addrs(d1.reply).length === 2);
    ok('minta 6 dari stok 4 → hanya 2 BARU', n2.length === 2, JSON.stringify(n2));
    ok('minta maaf & sebut stok nyata 4 (2 sudah dikirim)', /hanya punya 4 unit/.test(d2 ? d2.reply : '') && /2 sudah dikirim/.test(d2 ? d2.reply : ''), (d2 ? d2.reply : '').slice(0, 160));
    ok('tidak mengulang 2 kartu lama', n2.every((x) => !addrs(d1.reply).includes(x)));
  }

  console.log('\n[8] listSentCards membaca semua blok');
  const sent = listSentCards(hist);
  ok(`sent.count = 5 (2+1+2)`, sent.count === 5, String(sent.count));

  console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

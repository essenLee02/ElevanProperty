'use strict';
/**
 * areaAvailabilityGate.test.js — M152
 * -----------------------------------
 * Menguji gerbang ketersediaan area terhadap transkrip produksi 25 Agu 2026:
 * customer minta SEWA apartemen di Pakuwon, bertanya "apakah ada?" lima kali,
 * tidak pernah dijawab, lalu dikirimi listing dari area lain tanpa ditanya.
 *
 * ⚠️ Menguji MODUL SUNGGUHAN, bukan salinan helper. Pelajaran mahal dari
 * aiPromptBuilder: tes yang menyalin logika ke dalam file tes tetap hijau
 * sementara produksi crash. Detektor & penyusun kalimat di-require apa adanya.
 *
 * Bagian yang menyentuh database (checkAreaAvailability) hanya dijalankan bila
 * koneksi tersedia; tanpa DB, tes deterministik tetap berjalan penuh.
 */
require('dotenv').config();

const {
  customerAsksAvailability,
  detectRequestedCount,
  composeAvailabilityReply,
  humanPrice,
} = require('../utils/areaAvailabilityGate');

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`); }
}

async function main() {
  console.log('\n=== M152 · Gerbang Ketersediaan Area ===\n');

  /* ── 1. Deteksi pertanyaan ketersediaan (kalimat NYATA dari transkrip) ── */
  console.log('1) Deteksi pertanyaan ketersediaan');
  [
    'Apakah ada apartemen di Pakuwon?',
    'Kak, apakah ada di area Pakuwon?',
    'Anda terlalu banyak interview saya, saya tdk suka. Apakah ada apartemen di pakuwon?',
    'Stop interview. Ada atau tdk?',
    'Minta listing saja',
    'Saya butuh rekomendasi apartemen di Pakuwon Surabaya',
    'Ada di daerah mana saja?',
    'Minta 5 data apartemen di Pakuwon Surabaya',
  ].forEach((m) => ok(`terdeteksi: "${m.slice(0, 46)}"`, customerAsksAvailability(m)));

  console.log('\n2) Kalimat yang BUKAN pertanyaan ketersediaan (kontrol negatif)');
  [
    'Pakuwon, Kak',
    'Full furnished',
    'Sndrian',
    '1 bulan saja',
    'Nama saya Agus',
  ].forEach((m) => ok(`tidak terdeteksi: "${m}"`, !customerAsksAvailability(m)));

  /* ── 3. Jumlah yang diminta customer ── */
  console.log('\n3) Jumlah listing yang diminta');
  ok('"Minta 5 data apartemen" → 5', detectRequestedCount('Minta 5 data apartemen') === 5);
  ok('"minta listing saja" → null (pakai default)', detectRequestedCount('minta listing saja') === null);
  ok('dibatasi maksimum 10', detectRequestedCount('minta 50 data') === 10);

  /* ── 4. Format harga ── */
  console.log('\n4) Format harga');
  ok('2.000.000 → "2 juta"', humanPrice(2000000) === '2 juta', humanPrice(2000000));
  ok('423.700.000 → "423.7 juta"', humanPrice(423700000) === '423.7 juta', humanPrice(423700000));
  ok('1.250.000.000 → "1.25 miliar"', humanPrice(1250000000) === '1.25 miliar', humanPrice(1250000000));

  /* ── 5. Penyusunan balasan — kasus Pakuwon (salah transaksi) ── */
  console.log('\n5) Balasan saat area punya stok tapi transaksinya beda');
  const wrongTx = composeAvailabilityReply({
    ok: true, verdict: 'wrong-transaction',
    exact: { count: 0, minPrice: null },
    crossTransaction: { transactionType: 'Sale', count: 19, minPrice: 423700000 },
    alternativeAreas: [
      { area: 'Bulak', count: 2, minPrice: 2000000 },
      { area: 'Kalijudan', count: 5, minPrice: 2100000 },
    ],
  }, { area: 'Pakuwon', typeLabel: 'apartemen', transactionType: 'Rent', isId: true });

  ok('minta maaf lebih dulu', /mohon maaf/i.test(wrongTx.reply), wrongTx.reply.slice(0, 60));
  ok('menyatakan sewa di Pakuwon belum ada', /belum ada/i.test(wrongTx.reply));
  ok('menyebut yang ADA itu dijual + jumlahnya', /dijual/i.test(wrongTx.reply) && /19 unit/.test(wrongTx.reply));
  ok('menawarkan area alternatif yang nyata', /Bulak/.test(wrongTx.reply) && /Kalijudan/.test(wrongTx.reply));
  ok('alternatif termurah lebih dulu',
    wrongTx.reply.indexOf('Bulak') < wrongTx.reply.indexOf('Kalijudan'));
  ok('DIAKHIRI pertanyaan — tidak menebak sendiri', /\?/.test(wrongTx.reply.trim().slice(-80)));
  ok('TIDAK langsung mengirim listing area lain',
    !/📐|Estimasi Harga|Fasilitas:/i.test(wrongTx.reply), wrongTx.reply.slice(0, 80));

  /* ── 6. Area benar-benar kosong ── */
  console.log('\n6) Balasan saat area memang kosong');
  const empty = composeAvailabilityReply({
    ok: true, verdict: 'area-empty',
    exact: { count: 0, minPrice: null }, crossTransaction: null,
    alternativeAreas: [{ area: 'Bubutan', count: 2, minPrice: 8500000 }],
  }, { area: 'Gubeng', typeLabel: 'apartemen', transactionType: 'Rent', isId: true });
  ok('minta maaf', /mohon maaf/i.test(empty.reply));
  ok('menawarkan area yang benar-benar ada', /Bubutan/.test(empty.reply));
  ok('bertanya dulu sebelum mengganti area', /\?/.test(empty.reply.trim().slice(-60)));

  /* ── 7. Stok ADA → gerbang harus DIAM (jangan bajak alur normal) ── */
  console.log('\n7) Stok tersedia → gerbang tidak ikut campur');
  const available = composeAvailabilityReply({
    ok: true, verdict: 'available',
    exact: { count: 19, minPrice: 423700000 }, crossTransaction: null, alternativeAreas: [],
  }, { area: 'Pakuwon', typeLabel: 'apartemen', transactionType: 'Sale', isId: true });
  ok('mengembalikan null saat stok ada', available === null,
    available ? available.reply.slice(0, 60) : '');

  /* ── 8. Katalog nyata (butuh DB) ── */
  console.log('\n8) Terhadap katalog sungguhan');
  try {
    const { checkAreaAvailability } = require('../services/areaAvailabilityService');
    const AGENT = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
    const rent = await checkAreaAvailability({
      userId: AGENT, city: 'Surabaya', area: 'Pakuwon',
      buildingType: 'Apartment', transactionType: 'Rent',
    });
    if (!rent.ok) {
      console.log('  ⏭️  dilewati (katalog/DB tidak tersedia)');
    } else {
      ok('sewa apartemen Pakuwon = 0 (fakta katalog)', rent.exact.count === 0, `dapat ${rent.exact.count}`);
      ok('terdeteksi sebagai salah-transaksi', rent.verdict === 'wrong-transaction', rent.verdict);
      ok('jual di Pakuwon > 0', !!rent.crossTransaction && rent.crossTransaction.count > 0);
      ok('area alternatif hanya yang ADA stoknya',
        rent.alternativeAreas.every((a) => a.count > 0));
      ok('alternatif tidak mengandung area yang diminta',
        !rent.alternativeAreas.some((a) => /pakuwon/i.test(a.area)),
        rent.alternativeAreas.map((a) => a.area).join(', '));
      ok('alternatif urut termurah',
        rent.alternativeAreas.every((a, i, arr) => i === 0 || (arr[i - 1].minPrice ?? 0) <= (a.minPrice ?? 0)));
      // "DI Pakuwon" tidak boleh tercampur "DEKAT Pakuwon" — pembeda yang
      // mencegah AI mengklaim unit Bulak sebagai unit Pakuwon.
      ok('"di" dan "dekat" dilaporkan terpisah',
        rent.exact.count === 0 && typeof rent.nearby === 'object',
        `nearby=${rent.nearby && rent.nearby.count}`);
    }
  } catch (err) {
    console.log(`  ⏭️  dilewati (${err.message})`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

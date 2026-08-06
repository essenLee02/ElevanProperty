/**
 * summaryLabelsAndStandardFacilities.test.js
 *
 * Tiga bug dari SATU transkrip produksi (Surabaya beli-rumah, 5 Agu 2026):
 *
 * 1. "✓ Rencana: Jual" untuk customer yang jelas bilang "Mau BELI rumah".
 *    QUALIFICATION STATE dulu menampilkan enum internal mentah `sale`, dan LLM
 *    menerjemahkannya sendiri jadi "Jual" — kebalikan makna dari sudut pandang
 *    customer. Fix: state block menampilkan label Indonesia siap-salin ("Beli").
 *
 * 2. "✓ Kota: Surabaya ⛔ label "Kota", BUKAN "Lokasi"" — anotasi instruksi
 *    internal dari TEMPLATE brief ikut terkirim mentah ke customer. Fix:
 *    anotasi dipindah keluar dari blok template ke bagian Strict Rules.
 *
 * 3. "✓ Fasilitas: Standar" — satu kata tanpa isi. Customer menjawab "Fasilitas
 *    standar", state menyimpan marker internal `['standar']`, dan marker itu
 *    tampil apa adanya. Fix: marker diekspansi jadi daftar fasilitas NYATA per
 *    tipe properti (utils/standardFacilities.js) di dalam state block.
 */
const { extractQualificationState, buildQualificationStateBlock } = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });
const facLine = (s) => buildQualificationStateBlock(s).split('\n').find(l => /Fasilitas/.test(l)) || '';
const txLine  = (s) => buildQualificationStateBlock(s).split('\n').find(l => /Tipe transaksi/.test(l)) || '';

console.log('\n── (1) Transaksi ditampilkan sebagai label Indonesia, bukan enum ──');
{
  ok('sale → "Beli" (BUKAN "Jual" / enum "sale")',
     /:\s*Beli\b/.test(txLine({ transactionType: 'sale', buildingType: 'house' })));
  ok('rent → "Sewa"',
     /:\s*Sewa\b/.test(txLine({ transactionType: 'rent', buildingType: 'house' })));
  ok('kata "Jual" tidak pernah muncul di baris transaksi untuk pembeli',
     !/Jual/i.test(txLine({ transactionType: 'sale', buildingType: 'house' })));
  ok('buildingType juga di-Indonesia-kan (house → Rumah)',
     /Rumah/.test(buildQualificationStateBlock({ transactionType: 'sale', buildingType: 'house' })));
}

console.log('\n── (2) Anotasi template tidak lagi menempel di baris field ──');
{
  // Anotasi "⛔ label WAJIB Kota" dulu ada DI DALAM blok template brief, satu
  // baris dengan field-nya, sehingga ikut tersalin ke output customer.
  const prompt = require('fs').readFileSync(require.resolve('../services/aiPromptBuilderService'), 'utf8');
  const templateLine = prompt.split('\n').find(l => /^✓ Kota:/.test(l.trim())) || '';
  ok('baris template "✓ Kota:" bersih dari anotasi ⛔', !/⛔/.test(templateLine));
  ok('aturan label "Kota bukan Lokasi" tetap ada di Strict Rules',
     /Label baris WAJIB persis/.test(prompt) && /JANGAN "Lokasi"/.test(prompt));
}

console.log('\n── (3) Marker "standar" diekspansi jadi daftar fasilitas nyata ──');
{
  const houseStd = facLine({ buildingType: 'house', facilities: ['standar'] });
  ok('house + "standar" → daftar nyata, BUKAN kata "Standar" saja',
     /Kamar Tidur/.test(houseStd) && /Carport/.test(houseStd));
  ok('marker mentah "standar" tidak bocor ke output', !/:\s*standar\s*$/i.test(houseStd));

  const hotelStd = facLine({ buildingType: 'hotel', facilities: ['standar'] });
  ok('hotel + "standar" → daftar khas hotel (housekeeping/resepsionis)',
     /Housekeeping/i.test(hotelStd) && /Resepsionis/i.test(hotelStd));
  ok('daftar hotel BEDA dari daftar house (per tipe properti)', hotelStd !== houseStd);

  const merged = facLine({ buildingType: 'house', facilities: ['standar', 'Gym', 'Kolam renang'] });
  ok('item spesifik customer tampil DULU, standar menyusul',
     merged.indexOf('Gym') < merged.indexOf('Kamar Tidur'));
  ok('item spesifik TIDAK hilang saat digabung standar',
     /Gym/.test(merged) && /Kolam renang/.test(merged));

  ok('tanpa marker standar → hanya item spesifik',
     facLine({ buildingType: 'house', facilities: ['Gym'] }).includes('Gym')
     && !/Kamar Tidur/.test(facLine({ buildingType: 'house', facilities: ['Gym'] })));
  ok('belum dijawab → tetap ❓ BELUM DIJAWAB',
     /BELUM DIJAWAB/.test(facLine({ buildingType: 'house', facilities: [] })));
}

console.log('\n── Reproduksi transkrip asli (Surabaya, beli rumah, fasilitas standar) ──');
{
  const H = [
    u('Mau beli rumah di Surabaya'), u('sAYA CARI KONDISI RUMAH YANG BARU'),
    a('Di Surabaya ada house kisaran Rp 350.000.000 dan Rp 900.000.000. Kira-kira yang mana lebih sesuai?'),
    u('Saya cari rumah yang harga 400-700 juta cash; Kak'),
    a('Ada target kapan proses belinya selesai?'), u('Rencana 17 November'),
    a('Ada lokasi atau tempat tertentu yang jadi patokan?'), u('Dekat Wiyung'),
    a('Untuk furnitur, lebih prefer furnished, semi-furnished, atau kosongan?'), u('Kosongan, Kak'),
    a('Ada fasilitas yang wajib ada untuk rumahnya? boleh jawab "standar saja"'),
  ];
  const st = extractQualificationState(H, 'Fasilitas standar');
  ok('transaksi = sale (internal) tapi ditampilkan "Beli"', /:\s*Beli\b/.test(txLine(st)));
  ok('fasilitas terekspansi (bukan "Standar" telanjang)', /Kamar Tidur/.test(facLine(st)));
  ok('budget tetap angka asli customer (400-700 juta)',
     /400\.000\.000/.test(st.budget || '') && /700\.000\.000/.test(st.budget || ''));
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

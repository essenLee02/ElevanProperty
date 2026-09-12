/**
 * M191 (12 Sep 2026) — tiga fakta backend salah yang ditemukan lewat 4 sesi live
 * DeepSeek × chat_gpt_responds (lihat artifact "DeepSeek × chat_gpt_responds —
 * Diagnosis 4 Sesi"):
 *  1. nomor kartu berlanjut lintas pesan (1-2 lalu 3-4) → "pilih nomer 2" out-of-range
 *  2. kartu buatan platform AI ("💰 Harga:") tidak dihitung sebagai listing tampil
 *  3. "patokannya dekat Pakuwon Mall" dijadikan AREA → fakta "belum ada di Pakuwon Mall"
 *  + konfirmasi pilihan dengan kata-kata bebas LLM dibaca readConfirmedPick.
 */
require('dotenv').config();
const g = require('../utils/listingSelectionGate');
const fs = require('fs'); const path = require('path');
let pass = 0, fail = 0;
const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}${e ? ' — ' + e : ''}`); } };
const A = (m) => ({ role: 'ai', message: m }); const C = (m) => ({ role: 'customer', message: m });
const card = (n, addr, price) => `${n}. *Pakuwon City House Sale Surabaya*\n\n   🏡 Alamat: ${addr}\n   💰 Harga: *${price}*\n   🛏️ 2 KT, 1 KM`;

console.log('\n[1] Nomor kartu lintas blok');
const h = [C('beli rumah pakuwon'), A(card(1, 'Jl. Pakuwon City No. 2, Surabaya', '641 juta') + '\n\n' + card(2, 'Jl. Pakuwon City No. 76, Surabaya', '668,8 juta')),
  C('tdk banjir tdk panas'), A(card(3, 'Jl. Pakuwon City No. 22, Surabaya', '752,8 juta') + '\n\n' + card(4, 'Jl. Pakuwon Indah No. 97, Surabaya', '763,2 juta'))];
const shown = g.parseShownListings(h);
ok('4 kartu terbaca (1-4)', shown.map((c) => c.index).join(',') === '1,2,3,4', shown.map((c) => c.index).join(','));
const sel = g.detectSelection('Saya pilih nomer 2, Kak', shown);
ok('"nomer 2" = kartu no. 2 (No. 76), bukan out-of-range', sel && sel.status === 'matched' && /No\. 76/.test(sel.card.address), JSON.stringify(sel && sel.status));

console.log('\n[2] Konfirmasi pilihan dengan kata-kata bebas');
for (const m of ['Baik, Kak 😊 Pilihannya sudah dicatat: *Suko House Rent Sidoarjo* — Jl. Suko No. 97', 'Siap, Kak — dicatat ya: pilihan Kakak jatuh ke *Candramas House Sale Sidoarjo* di *Jl. Candramas No. 92*', 'Baik, Kak 😊 Tercatat pilihannya: *X House*.']) {
  const p = g.readConfirmedPick([A(m)]); ok(`dibaca: ${m.slice(0, 40)}…`, !!(p && p.title), JSON.stringify(p));
}

console.log('\n[3] Kode gerbang: kartu LLM dihitung, patokan bukan area, unit dipilih di facts');
const svc = fs.readFileSync(path.join(__dirname, '../services/whatsappAIService.js'), 'utf8');
ok('listingsAlreadyShown memakai isCardMessage', /listingsAlreadyShown[\s\S]{0,600}isCardMessage\(/.test(svc));
ok('kalimat patokan tidak jadi kandidat area', /isAnchorPhrase/.test(svc) && /isAnchorPhrase \? '' : lmToken/.test(svc));
const pb = fs.readFileSync(path.join(__dirname, '../services/aiPromptBuilderService.js'), 'utf8');
ok('facts block memuat "Unit dipilih customer"', /Unit dipilih customer \(pilihan MELEKAT/.test(pb));

console.log('\n[4] M194: kartu format LLM (tanpa label) tetap terbaca; count request ≠ tolak survei; tx change membatalkan gerbang pilihan');
{
  const c = g.parseShownListings([A('1. *Candramas House Sale Sidoarjo*\n   🏡 Jl. Candramas No. 92, Sidoarjo\n   💰 *Rp 351,7 juta*')])[0];
  ok('alamat terbaca tanpa label "Alamat:"', c && /No\. 92/.test(c.address), JSON.stringify(c));
  ok('harga terbaca tanpa label "Estimasi Harga:"', c && c.priceValue === 351700000);
  const p = require('../services/aiPromptBuilderService');
  const st = p.extractQualificationState([C('beli rumah driyorejo'), A('ini 2')], 'Minta 4 listing ya.');
  ok('"Minta 4 listing" tidak mengunci Q9b = Minta listing', st.viewingDate == null, String(st.viewingDate));
  const st2 = p.extractQualificationState([C('beli rumah'), A('ini 2'), C('lihat listing saja, tidak usah survei'), A('ok'), C('nomor 2'), A('Dicatat pilihannya: *X*.')], 'Survei Sabtu depan jam 10 pagi bisa?');
  ok('tanggal survei eksplisit menimpa penolakan sebelumnya', /September|Oktober/.test(st2.viewingDate || ''), String(st2.viewingDate));
  ok('gerbang pilihan/pasca-pilihan dilewati saat ganti transaksi/kota/tipe', /const changeTurn = Boolean\(qualState\?\.txChangedFromHistory/.test(svc) && /!changeTurn && !pick && !viewingConfirm/.test(svc));
}

console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail ? 1 : 0);

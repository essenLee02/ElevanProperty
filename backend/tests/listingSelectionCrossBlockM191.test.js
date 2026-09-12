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

console.log('\n[5] M195: summary otomatis di pesan ke-10-12 — fakta hitungan giliran & jam survei tidak salah baca');
{
  const p = require('../services/aiPromptBuilderService');
  const h = []; for (let i = 1; i <= 11; i++) { h.push(C('pesan ' + i)); h.push(A('ok ' + i)); }
  const out = p.buildWhatsappReplyPrompt({ name: 'X', normalizedPhone: '0', source: 'whatsapp', agentName: 'A' }, h, 'pesan 12', '', 'deepseek', { guardProfile: 'platform' });
  ok('facts block menghitung pesan customer ke-12 (riwayat penuh, bukan yang dipangkas)', /Pesan customer ke-12/.test(out));
  ok('tanpa perubahan: hitungan sejak-perubahan = 12 juga', /ke-12 sejak kota\/transaksi\/tipe terakhir tetap/.test(out));
  const hc = []; for (const m of ['Beli rumah di Sidoarjo area Candramas', 'Yang 3 kamar?', 'Ganti pikiran, di Gresik saja area Driyorejo', 'Yang nomor 1 luasnya?']) { hc.push(C(m)); hc.push(A('ok')); }
  const outc = p.buildWhatsappReplyPrompt({ name: 'X', normalizedPhone: '0', source: 'whatsapp', agentName: 'A' }, hc, 'Banjir nggak?', '', 'deepseek', { guardProfile: 'platform' });
  ok('M196: ganti kota di pesan ke-3 → pesan ke-5 = ke-3 sejak perubahan', /ke-5 di sesi ini; ke-3 sejak/.test(outc), (outc.match(/🔢[^\n]*/) || [''])[0]);
  const { customerRequestsViewing } = require('../utils/customerQuestionGuard');
  ok('sinonim survei: ayo ketemuan / lihat langsung / mampir / cek unit / viewing', ['Ayo ketemuan kak', 'Bisa lihat langsung unitnya?', 'Mampir ke lokasi boleh?', 'yuk cek unitnya', 'Kapan bisa viewing?'].every(customerRequestsViewing));
  ok('bukan survei: harga / sudah lihat brosur', !['Harganya berapa?', 'Saya sudah lihat brosurnya'].some(customerRequestsViewing));
  const st3 = p.extractQualificationState([C('beli rumah'), A('Dicatat pilihannya: *X*.')], 'Ayo ketemuan Sabtu depan jam 10');
  ok('"Ayo ketemuan Sabtu depan jam 10" → tanggal & jam survei tercatat', /September|Oktober/.test(st3.viewingDate || '') && /10/.test(st3.viewingTime || ''));
  const st = p.extractQualificationState([C('beli rumah candramas'), A('ini 2, mana yang paling pas?')], 'Yang 3 kamar ada?');
  ok('"Yang 3 kamar" tidak menjadi jam survei 3', st.viewingTime == null, String(st.viewingTime));
  const st2 = p.extractQualificationState([C('beli rumah'), A('Survei jam berapa yang paling pas?')], '4 sore');
  ok('jawaban telanjang "4 sore" saat AI bertanya jam tetap terbaca', /4/.test(st2.viewingTime || ''));
  const d02 = fs.readFileSync(path.join(__dirname, '../asset/skills/chat_gpt_responds/docs/02-qualification-flow.md'), 'utf8');
  ok('doc 02 Gate C: summary otomatis di pesan ke-10-12', /10th-12th customer message/.test(d02) && /do not wait for "itu saja"/.test(d02));
}

console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail ? 1 : 0);

/**
 * agentScopeGuard.test.js — M90.
 *
 * AI harus menjawab DALAM BATAS yang di-set agent di profilnya:
 *   users.trans_type      Sale | Rent | Both
 *   users.payment_type    Cash | KPR  | Both
 *   users.rental_duration + users.rental_type  → minimal sewa
 *
 * Dua contoh yang diminta user (dijadikan Group 1 & 2, kata demi kata):
 *   (1) trans_type=Sale, payment_type=KPR → customer bilang booking/sewa/
 *       ngekos/kontrak → AI minta maaf, sampaikan fokusnya jual & bisa KPR.
 *   (2) trans_type=Rent, rental_duration=4, rental_type=Day → customer minta
 *       sewa 3 hari → AI sampaikan minimal sewa 4 hari.
 *
 * Konversi hari WAJIB persis tabel user:
 *   Day=1 · 9 Days=9 · Week=7 · 2 Weeks=14 · 3 Weeks=21 ·
 *   1 Month=30 · 4 Months=120 · 1 Year=365 · 2 Years=730
 *
 * Run: node tests/agentScopeGuard.test.js
 */

'use strict';

require('dotenv').config();

const { toDays, parseDurationFromText } = require('../utils/durationConverter');
const {
  checkAgentScope, detectTransIntent, detectPaymentIntent,
  servesTransaction, servesPayment, minRentalDays,
} = require('../utils/agentScopeGuard');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

/* ───────────────────────────────────────────────────────────────────────── */
console.log('── Group 0: tabel konversi durasi HARUS persis spesifikasi ──');
{
  const spec = [
    [1, 'Day', 1], [9, 'Days', 9], [1, 'Week', 7], [2, 'Weeks', 14],
    [3, 'Weeks', 21], [1, 'Month', 30], [4, 'Months', 120],
    [1, 'Year', 365], [2, 'Years', 730],
  ];
  for (const [n, u, expect] of spec) {
    ok(`${n} ${u} = ${expect} hari`, toDays(n, u) === expect, `got=${toDays(n, u)}`);
  }
  ok('Night dihitung 1 hari (setara Day)', toDays(3, 'Night') === 3, `got=${toDays(3, 'Night')}`);
  ok('satuan Indonesia juga dikenali (2 bulan = 60)', toDays(2, 'bulan') === 60, `got=${toDays(2, 'bulan')}`);
  ok('satuan asing → null (jangan menebak)', toDays(2, 'dekade') === null);
}

console.log('\n── Group 1: CONTOH USER #1 — trans_type=Sale, payment_type=KPR ──');
{
  const rules = { transType: 'Sale', paymentType: 'KPR', rentalDuration: null, rentalType: null };
  for (const msg of ['Saya mau booking apartemen di Surabaya',
                     'Saya mau sewa rumah di Malang',
                     'Saya mau ngekos',
                     'Saya mau kontrak rumah 1 tahun']) {
    const r = checkAgentScope(msg, rules);
    ok(`"${msg}" → ditolak sopan`, r.blocked === true && r.reason === 'trans_type', JSON.stringify(r.reason));
    if (r.blocked) {
      ok('   pesan memuat permintaan maaf', /mohon maaf/i.test(r.reply));
      ok('   pesan menyebut fokus JUAL BELI', /jual beli properti/i.test(r.reply));
      ok('   pesan menyebut KPR', /KPR/.test(r.reply), r.reply);
    }
  }
}

console.log('\n  KONTROL NEGATIF — permintaan BELI harus tetap dilayani:');
{
  const rules = { transType: 'Sale', paymentType: 'KPR' };
  for (const msg of ['Saya mau beli rumah di Malang', 'Saya cari rumah KPR',
                     'Mau beli rumah cash', 'Cari rumah dijual di Surabaya']) {
    ok(`"${msg}" lolos`, checkAgentScope(msg, rules).blocked === false);
  }
}

console.log('\n── Group 2: CONTOH USER #2 — Rent, rental_duration=4, rental_type=Day ──');
{
  const rules = { transType: 'Rent', paymentType: 'Cash', rentalDuration: 4, rentalType: 'Day' };
  ok('minimal agent = 4 hari', minRentalDays(rules) === 4, String(minRentalDays(rules)));

  for (const msg of ['Saya mau sewa selama 3 hari',
                     'Saya booking selama 3 hari',
                     'Mau ngekos untuk 2 hari',
                     'Saya mau booking 2 malam']) {
    const r = checkAgentScope(msg, rules);
    ok(`"${msg}" → ditolak dengan minimal`, r.blocked === true && r.reason === 'rental_duration');
    if (r.blocked) ok('   pesan menyebut minimal 4 hari', /minimal sewa.*4 hari/i.test(r.reply), r.reply);
  }

  console.log('\n  KONTROL NEGATIF — durasi ≥ minimal harus lolos:');
  for (const msg of ['Saya mau sewa selama 4 hari', 'Saya mau sewa selama 5 hari',
                     'Saya mau sewa 1 minggu', 'Mau kontrak 1 bulan']) {
    ok(`"${msg}" lolos`, checkAgentScope(msg, rules).blocked === false);
  }
}

console.log('\n── Group 3: minimal dalam satuan BESAR (Rent, 1 Month = 30 hari) ──');
{
  const rules = { transType: 'Rent', paymentType: 'Cash', rentalDuration: 1, rentalType: 'Month' };
  ok('2 minggu (14 hari) < 30 → ditolak', checkAgentScope('Saya mau sewa 2 minggu', rules).blocked === true);
  ok('3 minggu (21 hari) < 30 → ditolak', checkAgentScope('Saya mau sewa 3 minggu', rules).blocked === true);
  ok('1 bulan (30 hari) = 30 → lolos',    checkAgentScope('Saya mau sewa selama 1 bulan', rules).blocked === false);
  ok('4 bulan (120 hari) > 30 → lolos',   checkAgentScope('Saya mau sewa 4 bulan', rules).blocked === false);
  ok('1 tahun (365 hari) > 30 → lolos',   checkAgentScope('Mau kontrak 1 tahun', rules).blocked === false);
}

console.log('\n── Group 4: payment_type ASIMETRIS (keputusan bisnis) ──');
{
  // Cash SELALU diterima: pembeli cash lebih mudah daripada pembeli KPR.
  const kprAgent = { transType: 'Sale', paymentType: 'KPR' };
  ok('agent KPR + customer cash → LOLOS (cash selalu diterima)',
     checkAgentScope('Mau beli rumah cash', kprAgent).blocked === false);
  ok('agent KPR + customer KPR → lolos',
     checkAgentScope('Saya mau beli rumah pakai KPR', kprAgent).blocked === false);

  // Agent cash-only memang tidak bisa mengurus kredit.
  const cashAgent = { transType: 'Sale', paymentType: 'Cash' };
  ok('agent Cash + customer KPR → ditolak',
     checkAgentScope('Bisa KPR nggak?', cashAgent).blocked === true);
  ok('agent Cash + "nyicil" → ditolak',
     checkAgentScope('Saya mau nyicil', cashAgent).blocked === true);
  ok('agent Cash + "cicilan" → ditolak',
     checkAgentScope('bisa cicilan?', cashAgent).blocked === true);
  ok('agent Cash + customer cash → lolos',
     checkAgentScope('Mau beli rumah cash', cashAgent).blocked === false);

  const bothAgent = { transType: 'Both', paymentType: 'Both' };
  for (const msg of ['Saya mau sewa rumah', 'Saya mau beli rumah', 'Saya mau ngekos', 'Bisa KPR?']) {
    ok(`Both melayani "${msg}"`, checkAgentScope(msg, bothAgent).blocked === false);
  }
}

console.log('\n── Group 5: FAIL-OPEN — aturan tidak diketahui tidak boleh memblokir ──');
{
  for (const rules of [null, undefined, {}, { transType: null, paymentType: null }]) {
    ok(`rules=${JSON.stringify(rules)} → lolos`,
       checkAgentScope('Saya mau ngekos 1 hari', rules).blocked === false);
  }
  ok('rental_duration tanpa rental_type → tidak menegakkan minimal',
     checkAgentScope('Saya mau sewa 1 hari', { transType: 'Rent', rentalDuration: 4, rentalType: null }).blocked === false);
}

console.log('\n── Group 6: FALSE POSITIVE — "booking viewing" bukan niat sewa ──');
{
  // Agent Sale sedang melayani pembeli; kata "booking" muncul untuk JADWAL
  // kunjungan. Tanpa guard, AI menolak customernya sendiri di tengah alur beli.
  const rules = { transType: 'Sale', paymentType: 'KPR' };
  for (const msg of ['boleh booking viewing besok?', 'jadwalkan booking survei ya',
                     'Saya mau booking jadwal lihat unit', 'bisa reservasi viewing?']) {
    ok(`"${msg}" TIDAK diblokir`, checkAgentScope(msg, rules).blocked === false);
  }
  // Tapi permintaan sewa yang SUNGGUHAN tetap harus tertangkap.
  ok('"Saya mau sewa apartemen" TETAP diblokir',
     checkAgentScope('Saya mau sewa apartemen', rules).blocked === true);
  // Peralihan transaksi yang SUNGGUHAN harus tetap tertangkap — inilah alasan
  // override "transaksi sudah mapan" dihapus dari detectTransIntent.
  ok('peralihan ke sewa di tengah alur beli TETAP diberi tahu',
     checkAgentScope('Ternyata saya mau sewa saja', rules).blocked === true);
}

console.log('\n── Group 7: harga per-hari & offset tanggal BUKAN durasi ──');
{
  const rules = { transType: 'Rent', paymentType: 'Cash', rentalDuration: 4, rentalType: 'Day' };
  // "800K-1.4 juta/hari" = SATUAN HARGA; "2 hari lagi" = OFFSET tanggal masuk.
  // Keduanya pernah jadi sumber salah-baca durasi di proyek ini (M82/M89).
  ok('"Cari yang badget 800K-1.4 juta/hari" tidak dibaca durasi',
     checkAgentScope('Cari yang badget 800K-1.4 juta/hari', rules).blocked === false);
  ok('"Rencana checkin 2 hari lagi" tidak dibaca durasi',
     checkAgentScope('Rencana checkin 2 hari lagi', rules).blocked === false);
  ok('parseDurationFromText menolak "5 hari lagi"', parseDurationFromText('5 hari lagi') === null);
  ok('parseDurationFromText menerima "selama 5 hari"',
     (parseDurationFromText('selama 5 hari') || {}).days === 5);
}

console.log('\n── Group 8: deteksi niat (unit) ──');
{
  ok('booking → rent',  detectTransIntent('Saya mau booking apartemen') === 'rent');
  ok('ngekos → rent',   detectTransIntent('mau ngekos') === 'rent');
  ok('kontrak → rent',  detectTransIntent('mau kontrak rumah') === 'rent');
  ok('beli → sale',     detectTransIntent('Saya mau beli rumah') === 'sale');
  ok('KPR → sale',      detectTransIntent('bisa KPR?') === 'sale');
  ok('ambigu → null',   detectTransIntent('mau beli atau sewa ya?') === null);
  ok('netral → null',   detectTransIntent('halo kak') === null);
  ok('payment kpr',     detectPaymentIntent('bisa KPR?') === 'kpr');
  ok('payment cash',    detectPaymentIntent('bayar cash') === 'cash');
  ok('payment ambigu',  detectPaymentIntent('cash atau kpr?') === null);
  ok('servesTransaction Sale menolak rent', servesTransaction({ transType: 'Sale' }, 'rent') === false);
  ok('servesTransaction Both menerima keduanya',
     servesTransaction({ transType: 'Both' }, 'rent') && servesTransaction({ transType: 'Both' }, 'sale'));
  ok('servesPayment Cash menolak kpr', servesPayment({ paymentType: 'Cash' }, 'kpr') === false);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);

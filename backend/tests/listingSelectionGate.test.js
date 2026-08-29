'use strict';
/**
 * listingSelectionGate.test.js — M165
 * -------------------------------------
 * Replay transkrip produksi 29 Agu 2026: dua kartu MERR berjudul IDENTIK,
 * beda harga saja. Customer memilih no. 2 lima kali (nomor, harga, dan
 * gabungan) — backend lama mengirim ulang kedua kartu setiap kali.
 *
 * Tes unit murni: tidak menyentuh DB / provider AI, jadi selalu bisa jalan.
 */

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`); }
}

const {
  tryListingSelectionAnswer, parseShownListings, detectSelection, extractPrices,
} = require('../utils/listingSelectionGate');

/* Kartu persis seperti yang terkirim di produksi (replySplitter memecah tiap
 * kartu jadi pesan tersendiri — ditiru di sini). */
const CARD1 = `1. *MERR House Sale Surabaya*

   📍 Lokasi: SURABAYA, JAWA TIMUR
   🗺️ Area: MERR
   🏡 Alamat: Jl. MERR No. 69, Surabaya
   💰 Estimasi Harga: *451.6 juta*
   🏠 Tipe: Rumah — Dijual
   📐 Luas: bangunan 323 m2, tanah 331 m2
   🏷️ Fasilitas: SECURITY, AC, WATER HEATER, CCTV 24 JAM`;

const CARD2 = `2. *MERR House Sale Surabaya*

   📍 Lokasi: SURABAYA, JAWA TIMUR
   🗺️ Area: MERR
   🏡 Alamat: Jl. MERR No. 15, Surabaya
   💰 Estimasi Harga: *471.1 juta*
   🏠 Tipe: Rumah — Dijual
   📐 Luas: bangunan 344 m2, tanah 212 m2
   🏷️ Fasilitas: CCTV 24 JAM, CARPORT, KITCHEN SET, WATER HEATER`;

const HISTORY = [
  { role: 'user', message: 'yang harganya 400-900 juta' },
  { role: 'ai',   message: 'Ini 2 Rumah dijual di Merr ya, Kak 😊' },
  { role: 'ai',   message: CARD1 },
  { role: 'ai',   message: CARD2 },
  { role: 'ai',   message: 'Ada yang menarik, Kak?' },
];

console.log('\n=== M165 · Gerbang Pemilihan Listing ===\n');

/* ── 1. Pembacaan kartu dari riwayat ─────────────────────────────────────── */
console.log('1) parseShownListings() — baca kartu yang SUDAH terkirim');
const shown = parseShownListings(HISTORY);
ok('menemukan 2 kartu', shown.length === 2, JSON.stringify(shown.map((c) => c.index)));
ok('nomor cetak terbaca 1 dan 2', shown[0].index === 1 && shown[1].index === 2);
ok('judul terbaca', shown[1].title === 'MERR House Sale Surabaya', shown[1].title);
ok('harga no.2 = 471.100.000', shown[1].priceValue === 471100000, String(shown[1].priceValue));
ok('harga no.1 = 451.600.000', shown[0].priceValue === 451600000, String(shown[0].priceValue));
ok('alamat pembeda terbaca', /No\. 15/.test(shown[1].address), shown[1].address);

/* ── 2. Parsing harga Indonesia ──────────────────────────────────────────── */
console.log('\n2) extractPrices() — format harga Indonesia');
ok('"471.1 juta" → 471100000', extractPrices('471.1 juta')[0] === 471100000);
ok('"1.2 miliar" → 1200000000', extractPrices('1.2 miliar')[0] === 1200000000);
ok('"Rp 36.300.000" → 36300000', extractPrices('Rp 36.300.000')[0] === 36300000);
ok('titik DESIMAL tidak dibaca sebagai ribuan', extractPrices('471.1 juta')[0] !== 4711000000);

/* ── 3. Lima pesan pemilihan dari transkrip nyata ────────────────────────── */
console.log('\n3) Lima pesan pemilihan nyata — semua harus mengenai no. 2');
const REAL_PICKS = [
  'Saya mau yang no 2',
  'Yg hrg 471.1 juta',
  'Saya pilih no 2, Kak',
  'Saya pilih no 2, Kak',
  'Saya pilih no 2, Kak',
];
for (const msg of REAL_PICKS) {
  const sel = detectSelection(msg, shown);
  ok(`"${msg}" → kartu no. 2`,
    sel && sel.status === 'matched' && sel.card.index === 2,
    JSON.stringify(sel));
}

/* ── 4. Balasan konfirmasi, BUKAN kirim ulang katalog ────────────────────── */
console.log('\n4) Balasan: konfirmasi pilihan, bukan mengulang kartu');
const hit = tryListingSelectionAnswer({ message: 'Saya pilih no 2, Kak', history: HISTORY, isId: true });
ok('gerbang menyala', Boolean(hit), JSON.stringify(hit));
ok('menyebut harga unit yang dipilih', /471\.1 juta/.test(hit.reply), hit.reply);
ok('menyebut alamat pembeda (No. 15)', /No\. 15/.test(hit.reply), hit.reply);
ok('TIDAK mengulang kartu no. 1 (451.6 juta)', !/451\.6/.test(hit.reply), hit.reply);
ok('melangkah maju (menawarkan survei), bukan bertanya ulang',
  /survei|jadwal/i.test(hit.reply) && !/Ada yang menarik/i.test(hit.reply), hit.reply);

/* ── 5. Cara sebut yang lain ─────────────────────────────────────────────── */
console.log('\n5) Ragam cara customer menyebut pilihan');
const VARIANTS = [
  ['nomor 2', 2], ['no.2', 2], ['#2', 2], ['yang kedua', 2],
  ['2', 2], ['pilih 1', 1], ['Saya ambil yang pertama', 1],
  ['yang 451.6 juta', 1],
];
for (const [msg, want] of VARIANTS) {
  const sel = detectSelection(msg, shown);
  ok(`"${msg}" → no. ${want}`,
    sel && sel.status === 'matched' && sel.card.index === want,
    JSON.stringify(sel));
}

/* ── 6. Nama saja TIDAK boleh menebak (dua judul identik) ────────────────── */
console.log('\n6) Judul identik → WAJIB tanya harga, dilarang menebak');
const byName = detectSelection('Saya mau MERR House Sale Surabaya', shown);
ok('status ambigu (bukan matched)', byName && byName.status === 'ambiguous', JSON.stringify(byName));
const askReply = tryListingSelectionAnswer({
  message: 'Saya mau MERR House Sale Surabaya', history: HISTORY, isId: true,
});
ok('balasan menanyakan yang mana', /yang mana/i.test(askReply.reply), askReply.reply);
ok('menampilkan KEDUA harga sebagai pembeda',
  /451\.6/.test(askReply.reply) && /471\.1/.test(askReply.reply), askReply.reply);

/* ── 7. Nomor + harga bertentangan → konfirmasi, bukan menebak ───────────── */
console.log('\n7) Nomor dan harga saling bertentangan');
const conflict = detectSelection('no 1 yang 471.1 juta', shown);
ok('terdeteksi conflict', conflict && conflict.status === 'conflict', JSON.stringify(conflict));

/* ── 8. Nomor di luar jangkauan ──────────────────────────────────────────── */
console.log('\n8) Nomor di luar daftar');
const oor = tryListingSelectionAnswer({ message: 'saya pilih no 5', history: HISTORY, isId: true });
ok('mengaku hanya ada 2 unit', oor && /2 unit/.test(oor.reply), oor && oor.reply);

/* ── 9. Kontrol negatif: angka yang BUKAN pemilihan ──────────────────────── */
console.log('\n9) Kontrol negatif — angka biasa tidak boleh dibaca sebagai pilihan');
const NEGATIVE = [
  'Saya mau 3 kamar tidur',
  'budgetnya 2 miliar',
  'Ada yang lebih murah?',
  'Kalau di Wiyung ada?',
];
for (const msg of NEGATIVE) {
  const sel = detectSelection(msg, shown);
  ok(`"${msg}" → BUKAN pemilihan`, sel === null || sel.status !== 'matched', JSON.stringify(sel));
}

/* ── 10. Tanpa kartu di riwayat → gerbang diam ───────────────────────────── */
console.log('\n10) Belum ada kartu → gerbang tidak boleh menyala');
const none = tryListingSelectionAnswer({
  message: 'saya pilih no 2', history: [{ role: 'user', message: 'halo' }], isId: true,
});
ok('gerbang diam', none === null, JSON.stringify(none));

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

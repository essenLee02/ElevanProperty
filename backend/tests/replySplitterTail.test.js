'use strict';
/**
 * replySplitterTail.test.js — M165
 * -------------------------------------
 * Keluhan pemilik proyek (29 Agu 2026): "Pertanyaan 'Ada yang menarik, Kak?...'
 * akan tertutup oleh katalog di WhatsApp; maka AI wajib kirim itu terpisah."
 *
 * Versi lama splitCatalogReply() hanya memotong pada batas ANTAR-kartu, jadi
 * kalimat penutup ikut menumpang di pesan kartu terakhir.
 */

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`); }
}

const { splitCatalogReply } = require('../utils/replySplitter');

console.log('\n=== M165 · Ekor katalog jadi pesan terpisah ===\n');

const card = (n, addr, price) => `${n}. *MERR House Sale Surabaya*

   📍 Lokasi: SURABAYA, JAWA TIMUR
   🗺️ Area: MERR
   🏡 Alamat: ${addr}
   💰 Estimasi Harga: *${price}*
   🏠 Tipe: Rumah — Dijual`;

const HEAD = 'Ini 2 Rumah dijual di Merr ya, Kak 😊';
const TAIL = 'Ada yang menarik, Kak? Kalau mau saya carikan yang lebih spesifik, boleh sebutkan budget atau kebutuhan lainnya.';

/* ── 1. Kasus produksi: head + 2 kartu + ekor ────────────────────────────── */
console.log('1) Balasan katalog nyata');
const full = `${HEAD}\n\n${card(1, 'Jl. MERR No. 69, Surabaya', '451.6 juta')}\n\n${card(2, 'Jl. MERR No. 15, Surabaya', '471.1 juta')}\n\n${TAIL}`;
const parts = splitCatalogReply(full);

ok('terpecah jadi 4 pesan (head + 2 kartu + ekor)', parts.length === 4, `dapat ${parts.length}`);
ok('pesan 1 = kalimat pembuka', parts[0] === HEAD, parts[0]);
ok('pesan 2 = kartu no. 1', /^1\. \*/.test(parts[1]) && /451\.6/.test(parts[1]));
ok('pesan 3 = kartu no. 2', /^2\. \*/.test(parts[2]) && /471\.1/.test(parts[2]));
ok('pesan 4 = HANYA pertanyaan penutup', parts[3] === TAIL, parts[3]);
ok('⭐ ekor TIDAK menempel di kartu terakhir', !/Ada yang menarik/.test(parts[2]), parts[2]);
ok('detail kartu terakhir tetap utuh', /Estimasi Harga/.test(parts[2]) && /Tipe:/.test(parts[2]));

/* ── 2. Katalog tanpa ekor tidak boleh berubah ───────────────────────────── */
console.log('\n2) Katalog tanpa kalimat penutup');
const noTail = `${HEAD}\n\n${card(1, 'Jl. A', '400 juta')}\n\n${card(2, 'Jl. B', '500 juta')}`;
const p2 = splitCatalogReply(noTail);
ok('tetap 3 pesan (tidak ada ekor palsu)', p2.length === 3, `dapat ${p2.length}`);
ok('kartu terakhir utuh', /Tipe: Rumah/.test(p2[2]));

/* ── 3. Satu kartu + ekor ────────────────────────────────────────────────── */
console.log('\n3) Satu kartu saja + ekor');
const one = `Ini 1 Rumah dijual di Kenjeran ya, Kak 😊\n\n${card(1, 'Jl. Kenjeran No. 32', '1.2 miliar')}\n\n${TAIL}`;
const p3 = splitCatalogReply(one);
ok('terpecah jadi 3 pesan', p3.length === 3, `dapat ${p3.length}`);
ok('ekor berdiri sendiri', p3[2] === TAIL, p3[2]);

/* ── 4. Teks non-katalog tidak disentuh ──────────────────────────────────── */
console.log('\n4) Bukan katalog → tidak dipecah');
const plain = 'Mohon maaf, Kak 🙏 Untuk Rumah sewa di Kartoharjo belum ada di data saya.\n\nMau saya carikan di area lain? 😊';
const p4 = splitCatalogReply(plain);
ok('tetap satu pesan', p4.length === 1 && p4[0] === plain);

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

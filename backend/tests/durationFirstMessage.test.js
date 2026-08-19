/**
 * durationFirstMessage.test.js — regresi M103.
 *
 * BUG PRODUKSI (transkrip 15 Agu 2026, 09:23–09:35):
 *   09:23 Customer: "Saya mau booking apartemen di Jakarta dengan badget
 *                    2-3 juta/hari. Sama booking untuk1 minggu saja"
 *   09:31 AI      : "Rencananya menginap berapa lama?"   ← SUDAH DIJAWAB
 *   09:35 Ringkasan: TIDAK ADA baris durasi sama sekali
 *
 * DUA sebab yang berbeda, keduanya terbukti lewat probe langsung ke
 * extractQualificationState():
 *
 *  (1) Loop ekstraksi Phase 1 hanya memeriksa customer yang menjawab SETELAH
 *      ada pesan AI. Pesan PERTAMA customer (sebelum AI membalas) tidak pernah
 *      dipindai — padahal di situlah durasi disebut. Diperbaiki dengan sapuan
 *      Phase 1.4 atas SELURUH pesan customer.
 *
 *  (2) "untuk1" (typo tanpa spasi) membuat SEMUA regex durasi gagal, karena
 *      `\b(\d+)` menuntut word-boundary — dan antara "k" dan "1" tidak ada.
 *      Akibat lanjutannya: jalur Q10 menyimpan SELURUH kalimat mentah sebagai
 *      durasi. Diperbaiki dengan deglueDurationDigits().
 *
 * ⚠️ Kontrol negatif M82 WAJIB tetap hijau: "5 hari lagi" adalah OFFSET
 * tanggal masuk, BUKAN durasi. Fix ini tidak boleh melonggarkan itu.
 *
 * Run: node tests/durationFirstMessage.test.js
 */

'use strict';

require('dotenv').config();

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const { extractQualificationState } = require('../services/aiPromptBuilderService');

const dur = (history) => extractQualificationState(history).leaseDuration;
const u = (message) => ({ role: 'user', message });
const a = (message) => ({ role: 'ai', message });

/* ───────────────────────────────────────────────────────────────────────── */
console.log('── Group 1: durasi di PESAN PERTAMA customer (inti bug M103) ──');
{
  const first = 'Saya mau booking apartemen di Jakarta dengan badget 2-3 juta/hari. Sama booking untuk1 minggu saja';
  ok('pesan pertama saja (belum ada balasan AI) → "1 minggu"',
     dur([u(first)]) === '1 minggu', JSON.stringify(dur([u(first)])));

  ok('pesan pertama + AI membalas hal lain → tetap "1 minggu"',
     dur([u(first), a('Sudah lihat berapa Apartemen di Jakarta?'), u('Belum pernah')]) === '1 minggu');

  const spaced = first.replace('untuk1', 'untuk 1');
  ok('varian dengan spasi normal ("untuk 1 minggu") → "1 minggu"',
     dur([u(spaced)]) === '1 minggu', JSON.stringify(dur([u(spaced)])));
}

console.log('\n── Group 2: typo tanpa spasi (deglueDurationDigits) ──');
{
  ok('"untuk1 minggu" → "1 minggu"', dur([u('booking untuk1 minggu saja')]) === '1 minggu');
  ok('"selama3 hari" → "3 hari"',   dur([u('mau nginap selama3 hari')]) === '3 hari');
  ok('"book2 malam" → "2 malam"',   dur([u('mau book2 malam')]) === '2 malam');

  // Jalur Q10 (AI BERTANYA durasi) tidak boleh lagi menyimpan kalimat mentah.
  const q10 = [a('Rencananya menginap berapa lama?'), u('Booking untuk1 minggu saja, semi-furnished')];
  ok('jalur Q10 dgn typo → "1 minggu" (BUKAN kalimat mentah)',
     dur(q10) === '1 minggu', JSON.stringify(dur(q10)));
}

console.log('\n── Group 3: kasus M89 yang sudah ada tetap jalan ──');
{
  const m89 = 'Cari yang badget 800K-1.4 juta/hari. Karena saya butuh book selama 5 hari saja';
  ok('M89 tanpa pesan AI sebelumnya → "5 hari"', dur([u(m89)]) === '5 hari');
  ok('M89 sesudah AI tanya budget → "5 hari"',
     dur([a('Kisaran budget berapa?'), u(m89)]) === '5 hari');
  ok('M82 anchor "durasi sewa 5 hari" → "5 hari"',
     dur([u('Saya mau sewa. durasi sewa 5 hari')]) === '5 hari');
}

console.log('\n── Group 4: KONTROL NEGATIF — offset tanggal BUKAN durasi (M82) ──');
{
  ok('"masuk 5 hari lagi" → null (offset, bukan durasi)',
     dur([u('Saya mau sewa rumah, rencana masuk 5 hari lagi')]) === null,
     JSON.stringify(dur([u('Saya mau sewa rumah, rencana masuk 5 hari lagi')])));

  ok('"pindah 2 minggu lagi" → null',
     dur([u('Rencana pindah 2 minggu lagi')]) === null);

  // Campuran: offset DAN durasi dalam satu pesan — anchor "durasi" menang.
  ok('"checkin 2 minggu lagi. Durasi sewa 5 hari" → "5 hari"',
     dur([u('Rencana checkin 2 minggu lagi, Kak. Durasi sewa 5 hari')]) === '5 hari');

  // Angka menempel yang BUKAN durasi tidak boleh diubah/ditangkap.
  ok('"budget Rp2000000" tidak menghasilkan durasi',
     dur([u('Budget saya Rp2000000 per bulan')]) === null);
  ok('"tipe 3BR" tidak menghasilkan durasi',
     dur([u('Saya cari tipe 3BR')]) === null);
}

console.log('\n── Group 5: pesan customer tanpa durasi tetap null ──');
{
  ok('pesan biasa tanpa durasi → null',
     dur([u('Saya mau sewa apartemen di Jakarta')]) === null);
  ok('history kosong → null', dur([]) === null);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);

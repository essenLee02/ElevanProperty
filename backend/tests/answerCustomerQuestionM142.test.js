/**
 * answerCustomerQuestionM142.test.js — regresi M142.
 *
 * DUA bug dari transkrip produksi NYATA (25 Agu 2026):
 *
 * (a) AI MENGABAIKAN PERTANYAAN CUSTOMER dan melanjutkan skrip interview:
 *       Cust: "Alamat Sawahan House Sale Surabaya, itu ada dimana; Kak?"
 *       AI  : "Sudah lihat berapa Rumah di Surabaya?"            ← Q2b
 *       Cust: "Kalau saya mau survei ke Perumahan Surabaya Suburban,
 *              itu alamat dan kotanya ada dimana ya?"
 *       AI  : "Kak lebih prefer terjangkau, menengah, atau eksklusif?" ← Q3
 *     AKAR: buildFinalDirective() SELALU menutup prompt dengan
 *     "TANYAKAN SEKARANG → Qx" tanpa syarat, di posisi 100% prompt (M62),
 *     mengalahkan semua aturan di atasnya. Alamatnya SUDAH ada di konteks
 *     katalog (`Address:`) — jadi ini direktif yang memaksa, bukan data hilang.
 *
 * (b) PERTANYAAN NAMA DIULANG:
 *       AI  : "boleh saya tahu nama Kakak?"
 *       Cust: "Saya Agus, Kak"
 *       AI  : "boleh saya tahu nama Kakak?"        ← diulang
 *     AKAR: customers.ask_name baru di-set 'YES' oleh syncCustomerFromChat()
 *     yang jalan SETELAH balasan dibuat — jadi giliran berikutnya masih
 *     membaca 'NO'. Kolom DB selalu terlambat satu giliran; yang menentukan
 *     harus RIWAYAT (apa yang sudah AI tanyakan).
 *
 * Run: node tests/answerCustomerQuestionM142.test.js
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  customerAsksPropertyData,
  buildAnswerFirstDirective,
} = require('../utils/customerQuestionGuard');
const { aiAlreadyAskedName } = require('../services/customerRegistrationService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

console.log('\n== Group 1: pertanyaan NYATA dari transkrip terdeteksi ==');
{
  const asks = [
    'Alamat Sawahan House Sale Surabaya, itu ada dimana; Kak?',
    'Kalau saya mau survei ke Perumahan Surabaya Suburban, itu alamat dan kotanya ada dimana ya?',
    'Yang no 2 kamar mandinya berapa?',
    'Harganya berapa kak?',
    'Apakah rumah tersebut sdh ada SHM-nya?',
    'Dekat Alfamart tidak?',
    'Luas tanahnya berapa ya?',
    'Masih ada unitnya?',
  ];
  for (const m of asks) {
    ok(`terdeteksi: "${m.slice(0, 46)}…"`, customerAsksPropertyData(m) === true);
  }
}

console.log('\n== Group 2: KONTROL NEGATIF — jawaban/pernyataan BUKAN pertanyaan data ==');
{
  // Ini semua muncul di transkrip yang sama sebagai JAWABAN customer atas
  // pertanyaan AI. Bila salah terdeteksi, alur kualifikasi akan macet karena
  // AI dipaksa "menjawab" sesuatu yang bukan pertanyaan.
  const notAsks = [
    'Rencana beli, Kak',
    'Saya Agus',
    'Nama saya Agus',
    'Terserah, Kak',
    'Belum pernah, Kak',
    'Saya mau beli rumah di Surabaya',
    'Tdk ada, Kak',
    'Cari yang baru, Kak',
    'KPR',
    'Untuk investasi, Kak',
  ];
  for (const m of notAsks) {
    ok(`TIDAK terdeteksi: "${m}"`, customerAsksPropertyData(m) === false);
  }
  ok('pesan kosong → false', customerAsksPropertyData('') === false);
  ok('null → false', customerAsksPropertyData(null) === false);
}

console.log('\n== Group 3: direktif "JAWAB DULU" berisi pagar yang benar ==');
{
  const d = buildAnswerFirstDirective(
    'Alamat Sawahan House Sale Surabaya, itu ada dimana; Kak?',
    { q: 'Q2b', hint: 'Sudah lihat berapa Rumah?' }
  );
  ok('memerintahkan jawab dulu', /JAWAB DULU/i.test(d));
  ok('mengutip pertanyaan customer apa adanya', /Alamat Sawahan House Sale Surabaya/.test(d));
  ok('mengarahkan ke data katalog (Address/Price/Rooms)', /Address|Price|Rooms/.test(d));
  ok('melarang menebak alamat/harga/kamar', /DILARANG menebak atau mengarang/i.test(d));
  ok('melarang balas dengan pertanyaan interview tak berhubungan',
    /DILARANG membalas dengan pertanyaan interview/i.test(d));
  ok('pertanyaan berikutnya TETAP disebut sebagai lanjutan (tidak hilang)',
    /Setelah menjawab, BOLEH lanjut/i.test(d) && /Sudah lihat berapa Rumah/.test(d));

  const dNoNext = buildAnswerFirstDirective('Harganya berapa?', null);
  ok('tanpa pertanyaan berikutnya → tidak ada baris lanjutan',
    !/Setelah menjawab, BOLEH lanjut/i.test(dNoNext));
}

console.log('\n== Group 4: direktif terpasang di buildFinalDirective (bukan cuma util) ==');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'aiPromptBuilderService.js'), 'utf8');
  ok('aiPromptBuilderService me-require customerQuestionGuard',
    /require\('\.\.\/utils\/customerQuestionGuard'\)/.test(src));
  ok('buildFinalDirective memakai customerAsksPropertyData',
    /askedNow[\s\S]{0,120}customerAsksPropertyData\(identity\.customerMessage\)/.test(src));
  ok('nextLine memilih buildAnswerFirstDirective saat customer bertanya',
    /askedNow\s*\?\s*buildAnswerFirstDirective/.test(src));
  ok('call-site meneruskan customerMessage: userMessage',
    /customerMessage:\s*userMessage/.test(src));
}

console.log('\n== Group 5: gerbang tanya-nama tidak mengulang (bug b) ==');
{
  const askText = 'Sebelum saya sampaikan ringkasannya — boleh saya tahu nama Kakak? 😊\n\n_(Kalau belum ingin menyebutkan, tidak apa-apa — cukup balas "lewati")_';
  ok('aiAlreadyAskedName mengenali teks tanya-nama yang SESUNGGUHNYA dipakai',
    aiAlreadyAskedName([{ role: 'ai', message: askText }]) === true);
  ok('riwayat tanpa tanya-nama → false',
    aiAlreadyAskedName([{ role: 'ai', message: 'Mau sewa atau beli?' }]) === false);

  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'whatsappAIService.js'), 'utf8');
  ok('wrapper mengecek riwayat SEBELUM menukar balasan jadi tanya-nama',
    /alreadyAsked\s*=\s*aiAlreadyAskedName\(recent\)/.test(src));
  ok('bila sudah pernah ditanya → kirim summary, JANGAN tanya lagi',
    /if \(alreadyAsked\) return result;/.test(src));
  ok('lookup riwayat fail-open (tidak boleh crash balasan)',
    /catch \(_\) \{ \/\* fail-open/.test(src));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

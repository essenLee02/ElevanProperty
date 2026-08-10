/**
 * bookingShortStayVersi2.test.js — regresi M89.
 *
 * Sumber: "Elevan AI Responses.zip / Versi 2" — transkrip produksi yang SAMA
 * dijalankan pada tiga provider (ChatGPT 8 Agu, DeepSeek 9 Agu, Kimi 10 Agu
 * 2026). Kasusnya BOOKING APARTEMEN JANGKA PENDEK, berbeda dari Versi 1
 * (beli rumah) hanya pada tipe transaksi + tipe properti.
 *
 * TIGA CACAT YANG MUNCUL DI KETIGA PROVIDER:
 *
 *  (a) DURASI SUKARELA HILANG. Customer menulis "Cari yang badget 800K-1.4
 *      juta/hari. Karena saya butuh book selama 5 hari saja" — durasi jelas
 *      disebut, tapi ekstraktor M82 hanya ber-anchor pada kata "durasi",
 *      sedangkan blok Q10 butuh AI sedang bertanya "berapa lama" (saat itu AI
 *      menanyakan BUDGET). Akibatnya AI tetap bertanya "Rencananya sewa untuk
 *      berapa lama?" — pertanyaan yang SUDAH dijawab.
 *
 *  (b) PREFERENSI TERCATAT SEBAGAI RED FLAG. Q5 "Ada yang pasti tidak cocok?"
 *      dijawab "Saya cari jalan yang strategis dan dekat dengan mall dan rumah
 *      makan" — itu KEINGINAN. DeepSeek mencetak
 *      "✓ Red flags: Saya cari jalan yang strategis dan dekat dengan mall dan
 *      rumah makan" di brief, membalik makna slot bagi agent.
 *
 *  (c) NADA SEWA JANGKA PANJANG UNTUK MENGINAP 5 HARI. Q10 berbunyi
 *      "Rencananya SEWA untuk berapa lama? (contoh: 6 bulan, 1 tahun)" kepada
 *      customer yang menginap 5 hari. `isBooking` hanya mengenal hotel/kondotel,
 *      sehingga booking APARTEMEN diperlakukan seperti sewa tahunan.
 *
 * Run: node tests/bookingShortStayVersi2.test.js
 */

'use strict';

require('dotenv').config();

const { extractQualificationState, findNextQuestion } = require('../services/aiPromptBuilderService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const U = m => ({ role: 'user',      message: m });
const A = m => ({ role: 'assistant', message: m });

const Q5 = 'Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua? 🚫';
const Q3 = 'Di Surabaya, ada apartemen kisaran Rp 800.000 - Rp 1.400.000 per malam dan Rp 2.000.000 - Rp 3.500.000 per malam. Kira-kira yang mana lebih sesuai? 💰';

// ───────────────────────────────────────────────────────────────────────────
console.log('── (a) durasi sukarela "book selama 5 hari" ──');
{
  const H = [U('Saya ingin booking apartemen di Surabaya'), A(Q3),
             U('Cari yang badget 800K-1.4 juta/hari. Karena saya butuh book selama 5 hari saja')];
  const s = extractQualificationState(H, 'Cari yang badget 800K-1.4 juta/hari. Karena saya butuh book selama 5 hari saja');
  ok('durasi tertangkap = 5 hari', /5\s*hari/i.test(s.leaseDuration || ''), `leaseDuration=${s.leaseDuration}`);
  ok('budget tetap per malam',     /malam|hari/i.test(s.budget || ''),      `budget=${s.budget}`);
}

console.log('\n  KONTROL NEGATIF — offset tanggal BUKAN durasi:');
{
  const cases = [
    ['Rencana checkin 2 minggu lagi',                          null],
    ['5 hari lagi',                                            null],
    ['Ada 3 kamar tidur',                                      null],
    ['budget 5 juta',                                          null],
    ['Rencana checkin 2 minggu lagi, Kak. Durasi sewa 5 hari', '5 hari'],
    ['menginap 3 malam',                                       '3 malam'],
    ['Saya mau sewa untuk 1 tahun',                            '1 tahun'],
  ];
  for (const [msg, expect] of cases) {
    const s = extractQualificationState([U('Saya ingin booking apartemen di Surabaya'), A(Q3), U(msg)], msg);
    const got = s.leaseDuration;
    const good = expect === null ? !got : new RegExp(expect.split(' ')[0]).test(String(got || ''));
    ok(`"${msg}" → ${expect === null ? 'BUKAN durasi' : expect}`, good, `got=${got}`);
  }
}

console.log('\n── (b) preferensi TIDAK boleh jadi red flag ──');
{
  const msg = 'Saya cari jalan yang strategis dan dekat dengan mall dan rumah makan';
  const s = extractQualificationState([U('Saya ingin booking apartemen di Surabaya'), A(Q5), U(msg)], msg);
  ok('redFlags TIDAK memuat kalimat keinginan',
     !/strategis|mall/i.test(s.redFlags || ''), `redFlags=${s.redFlags}`);
  ok('Q5 tetap dianggap TERJAWAB (tidak diulang)', !!s.redFlags, `redFlags=${s.redFlags}`);
  ok('preferensinya tidak hilang — tercatat sebagai patokan lokasi',
     /mall|rumah makan/i.test(s.anchorPoint || ''), `anchorPoint=${s.anchorPoint}`);
}

console.log('\n  KONTROL NEGATIF — red flag ASLI harus tetap tersimpan apa adanya:');
{
  for (const msg of ['Tidak mau banjir, tidak mau panas', 'hindari dekat rel kereta',
                     'jangan yang hadap barat', 'rawan banjir dan gang sempit',
                     'Saya mau yang tidak bising', 'nggak ada']) {
    const s = extractQualificationState([U('Saya ingin booking apartemen di Surabaya'), A(Q5), U(msg)], msg);
    ok(`"${msg}" tetap tersimpan utuh`, (s.redFlags || '') === msg, `redFlags=${s.redFlags}`);
  }
}

console.log('\n── (c) nada Q10 mengikuti konteks menginap vs sewa ──');
{
  const tail = [A(Q5), U('Tidak ada'),
                A('Ada lokasi atau tempat tertentu yang jadi patokan? 📍'), U('dekat mall'),
                A('Selain area Gubeng, apakah area sekitar masih oke? 🗺️'), U('Tidak'),
                A('Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu?'), U('Saya survei sendiri')];

  const book = [U('Saya ingin booking apartemen di Surabaya'), A('Di area mana?'), U('Daerah Gubeng'),
                A('Sudah lihat berapa?'), U('Belum'), A(Q3), U('800 ribu'),
                A('masuk bulan apa?'), U('checkin 15 agustus 2026'),
                A('tinggal bersama siapa?'), U('teman kerja'), ...tail];

  const rent = [U('Saya mau sewa rumah di Surabaya'), A('Di area mana?'), U('Gubeng'),
                A('Sudah lihat berapa?'), U('Belum'),
                A('kisaran 30 juta dan 60 juta per tahun?'), U('30 juta'),
                A('masuk bulan apa?'), U('September 2026'),
                A('tinggal bersama siapa?'), U('keluarga'), ...tail];

  const sB = extractQualificationState(book, 'Saya survei sendiri');
  const sR = extractQualificationState(rent, 'Saya survei sendiri');

  ok('booking → bookingIntent true',      sB.bookingIntent === true);
  ok('sewa biasa → bookingIntent false',  sR.bookingIntent === false);

  const nB = findNextQuestion(sB, {});
  const nR = findNextQuestion(sR, {});
  ok('booking → Q10 bernada MENGINAP', !!nB && nB.q === 'Q10' && /menginap berapa lama/i.test(nB.hint), nB && nB.hint);
  ok('booking → contoh durasi pendek',  !!nB && /malam|hari/i.test(nB.hint), nB && nB.hint);
  ok('sewa   → Q10 bernada SEWA',       !!nR && nR.q === 'Q10' && /sewa untuk berapa lama/i.test(nR.hint), nR && nR.hint);
  ok('sewa   → contoh durasi panjang',  !!nR && /bulan|tahun/i.test(nR.hint), nR && nR.hint);
  ok('nada keduanya BERBEDA',           !!nB && !!nR && nB.hint !== nR.hint);
}

console.log('\n── bookingIntent hanya dari pesan CUSTOMER, bukan pesan AI ──');
{
  // Pesan AI rutin memuat kata "jadwalkan viewing"/"check-in"; bila dibaca,
  // sewa tahunan biasa akan salah dianggap menginap jangka pendek.
  const H = [U('Saya mau sewa rumah di Surabaya'),
             A('Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing? Nanti kita atur check-in-nya.'),
             U('Boleh')];
  const s = extractQualificationState(H, 'Boleh');
  ok('kata "check-in" di pesan AI TIDAK menyalakan bookingIntent', s.bookingIntent === false);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);

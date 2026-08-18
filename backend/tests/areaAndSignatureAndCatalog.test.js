/**
 * areaAndSignatureAndCatalog.test.js — regresi M84 / M85 / M86.
 *
 * Sumber: tiga transkrip produksi 6 Agu 2026 (ChatGPT, DeepSeek, Private Agent)
 * untuk permintaan yang SAMA ("Saya mau beli rumah di Malang"):
 *
 *   M84  ChatGPT & DeepSeek sama-sama bertanya "Selain area *Ciputra*…" padahal
 *        customer TIDAK PERNAH menyebut Ciputra (nama developer SURABAYA yang
 *        banyak muncul di Real-Estate/*.md). Akar: Malang tidak ada di allowlist
 *        LARGE_CITIES_Q2C → Q2c tidak pernah ditanya → district permanen null →
 *        template Q7 berjangkar area tidak punya nilai → LLM mengisi sendiri.
 *        Nilai karangan itu lalu muncul di summary ("✓ Area: Ciputra masih ok").
 *
 *   M85  Summary ChatGPT ditandatangani "[Nama Agen]" / "[Nama Aplikasi]" —
 *        placeholder harfiah, padahal nama sungguhan sudah di-resolve dan
 *        tertulis di prompt.
 *
 *   M86  Summary ChatGPT & DeepSeek tidak menyertakan katalog sama sekali, dan
 *        tidak memberi tahu customer bahwa memang tidak ada. Mode katalog
 *        (users.catalog_summary) tidak pernah sampai ke posisi prompt yang
 *        dipatuhi model.
 *
 * Tes ini memanggil MODUL ASLI (bukan salinan logika di dalam test).
 *
 * Run: node tests/areaAndSignatureAndCatalog.test.js
 */

'use strict';

require('dotenv').config();

const {
  extractQualificationState,
  findNextQuestion,
  buildFinalDirective,
} = require('../services/aiPromptBuilderService');
const { guardReplyIdentity } = require('../utils/replyIdentityGuard');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const H = (...pairs) => pairs;
const cust = (m) => ({ role: 'user',      message: m });
const ai   = (m) => ({ role: 'assistant', message: m });

// ───────────────────────────────────────────────────────────────────────────
console.log('── M84 Group 1: Q2c ditanya untuk kota DI LUAR allowlist lama ──');
{
  const hist = H(cust('Saya mau beli rumah di Malang'));
  const s = extractQualificationState(hist, 'Saya mau beli rumah di Malang');
  const n = findNextQuestion(s, {});

  ok('kota Malang terdeteksi', /malang/i.test(s.city || ''), `city=${s.city}`);
  ok('pertanyaan berikutnya adalah Q2c (dulu dilewati)', n && n.q === 'Q2c', `q=${n && n.q}`);
  ok('contoh area diambil dari locationLandmarks Malang',
     !!n && /Soekarno Hatta|Ijen|Dinoyo|Lowokwaru/.test(n.hint), n && n.hint);
  ok('contoh area TIDAK memakai area kota lain',
     !!n && !/Pakuwon|Rungkut|Menteng|Dago/i.test(n.hint), n && n.hint);
}

console.log('\n── M84 Group 2: kota yang SUDAH didukung tetap berperilaku sama ──');
{
  // Kontrol negatif: Surabaya sudah ada di allowlist lama — jangan sampai
  // perubahan ini mengubah perilaku yang sudah benar.
  const hist = H(cust('Saya mau sewa rumah di Surabaya'));
  const s = extractQualificationState(hist, 'Saya mau sewa rumah di Surabaya');
  const n = findNextQuestion(s, {});
  ok('Surabaya tetap ditanya Q2c', n && n.q === 'Q2c', `q=${n && n.q}`);
  ok('contoh area Surabaya relevan', !!n && /Pakuwon|Darmo|Rungkut|Gubeng/.test(n.hint), n && n.hint);
}

console.log('\n── M84 Group 3: area yang customer sebut BENAR-BENAR tersimpan ──');
{
  const q2c = 'Di area atau kawasan mana di *Malang* yang Anda pertimbangkan? 📍 Misalnya Soekarno Hatta, Ijen, Dinoyo, Lowokwaru, atau area lainnya?';
  const hist = H(cust('Saya mau beli rumah di Malang'), ai(q2c), cust('Di Area Ijen'));
  const s = extractQualificationState(hist, 'Di Area Ijen');
  ok('district = Ijen', /ijen/i.test(s.district || ''), `district=${s.district}`);
  ok('district BUKAN nama kota', !/malang/i.test(s.district || ''), `district=${s.district}`);
}

console.log('\n── M84 Group 4: penolakan Q2c = jawaban (anti-loop) ──');
{
  const q2c = 'Di area atau kawasan mana di *Malang* yang Anda pertimbangkan? 📍 Misalnya Soekarno Hatta, Ijen, Dinoyo, atau area lainnya?';
  for (const answer of ['Mana saja', 'Terserah', 'Belum tahu', 'Tidak ada preferensi']) {
    const hist = H(cust('Saya mau beli rumah di Malang'), ai(q2c), cust(answer));
    const s = extractQualificationState(hist, answer);
    const n = findNextQuestion(s, {});
    ok(`"${answer}" → Q2c TIDAK diulang`, !!n && n.q !== 'Q2c', `q=${n && n.q}`);
    ok(`"${answer}" → district TIDAK diisi nilai palsu`, !s.district, `district=${s.district}`);
  }
}

console.log('\n── M84 Group 5: Q7 tanpa area TIDAK boleh berbentuk "area *X*" ──');
{
  // Reproduksi persis: seluruh alur sampai Q7, area tidak pernah disebut.
  const q2c = 'Di area atau kawasan mana di *Malang* yang Anda pertimbangkan? 📍';
  const hist = H(
    cust('Saya mau beli rumah di Malang'),
    ai(q2c), cust('Mana saja'),
    ai('Sudah lihat berapa rumah di Malang? Apa yang membuat belum cocok?'), cust('Belum pernah'),
    ai('Di Malang ada house kisaran Rp 2.000.000.000 dan Rp 3.000.000.000. Kira-kira yang mana lebih sesuai? 💰'),
    cust('Saya cari yang harga 400-800 juta cash'),
    ai('Ada target kapan proses belinya selesai? 📅'), cust('Rencana beli tahun depan'),
    ai('Nanti akan ditempati bersama siapa saja? 🛏️'), cust('Bersama keluarga'),
    ai('Ada yang pasti tidak cocok? 🚫'), cust('Cari yang akses jalan lancar, tidak banjir, tidak panas'),
    ai('Ada lokasi atau tempat tertentu yang jadi patokan? 📍'), cust('Dekat alfamaret atau Indomaret saja'),
  );
  const s = extractQualificationState(hist, 'Dekat alfamaret atau Indomaret saja');
  ok('district tetap kosong (customer memang tidak pernah menyebut area)', !s.district, `district=${s.district}`);

  const d = buildFinalDirective(s, { agentName: 'LEO FELIX', appName: 'Elevan Property' });
  ok('direktif final memuat larangan mengarang area', /DILARANG menulis nama area/i.test(d));
  ok('larangan menyebut kota sebagai jangkar pengganti', /Selain \*Malang\*/i.test(d), d.slice(-400));
  // ⚠️ M92 (18 Agu 2026) mengubah asersi ini SENGAJA. Larangan generik saja
  // ("jangan mengarang area") terbukti TIDAK cukup — "Sidotopo" tetap dikarang
  // dari contoh dokumen skill sendiri di produksi (kelas M83/M91: state bersih,
  // model tidak patuh → obatnya CONTOH KONKRET, bukan aturan abstrak). Direktif
  // kini SENGAJA menyebut "Ciputra"/"Sidotopo" secara eksplisit sebagai token
  // TERLARANG — jadi kemunculan kata itu di direktif sekarang BENAR, bukan bug.
  // Lihat tests/warehouseAreaInventionAndCompoundAvoid.test.js untuk kasusnya.
  ok('direktif menamai "Ciputra" secara eksplisit sebagai token TERLARANG (M92)',
    /ciputra.{0,30}(contoh dokumen|bukan customer)/i.test(d), d.slice(-400));

  // Kontrol negatif: saat area DIKETAHUI, larangan itu tidak boleh muncul
  // (kalau muncul, AI akan menolak memakai area yang sah).
  const sWithArea = extractQualificationState(
    H(cust('Saya mau beli rumah di Malang'),
      ai('Di area atau kawasan mana di *Malang*? 📍'),
      cust('Di Area Ijen')),
    'Di Area Ijen'
  );
  const d2 = buildFinalDirective(sWithArea, {});
  ok('area diketahui → TIDAK ada larangan area', !/DILARANG menulis nama area/i.test(d2));
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n── M85 Group 6: guard tanda tangan mengganti placeholder ──');
{
  const idn = { agentName: 'LEO FELIX', appName: 'Elevan Property' };

  const bracket = 'Terima kasih sudah menghubungi saya. 🙏\n\nSalam hangat,\n[Nama Agen]\n[Nama Aplikasi]';
  const r1 = guardReplyIdentity(bracket, idn);
  ok('gejala produksi persis: [Nama Agen]/[Nama Aplikasi] diganti', r1.replaced === 2, `replaced=${r1.replaced}`);
  ok('hasil memuat nama agent sungguhan', /LEO FELIX/.test(r1.text));
  ok('hasil memuat nama aplikasi sungguhan', /Elevan Property/.test(r1.text));
  ok('tidak ada kurung siku tersisa', !/\[Nama/i.test(r1.text));

  const dollar = 'Salam hangat,\n${agentName}\n${appName}';
  const r2 = guardReplyIdentity(dollar, idn);
  ok('varian lama ${agentName}/${appName} juga tertangkap', r2.replaced === 2, `replaced=${r2.replaced}`);

  const angle = 'Salam hangat,\n<agent name>\n<nama aplikasi>';
  ok('varian <…> tertangkap', guardReplyIdentity(angle, idn).replaced === 2);

  // KONTROL NEGATIF — jangan sampai guard merusak teks yang sah.
  const clean = 'Salam hangat,\nLEO FELIX\nElevan Property';
  ok('balasan yang sudah benar TIDAK diubah', guardReplyIdentity(clean, idn).text === clean);

  const listing = '1. Malang Heritage Zone House [Dijual]\n💰 Harga: 302.4 juta';
  ok('kurung siku SAH di listing tidak disentuh',
     guardReplyIdentity(listing, idn).text === listing);

  ok('tanpa nama agent → teks dibiarkan (jangan menebak nama)',
     guardReplyIdentity(bracket, {}).text === bracket);
}

// ───────────────────────────────────────────────────────────────────────────
console.log('\n── M86 Group 7: mode katalog sampai ke direktif final ──');
{
  const s = extractQualificationState(H(cust('Saya mau beli rumah di Malang')), 'Saya mau beli rumah di Malang');

  const on   = buildFinalDirective(s, { catalogMode: 'ON',  hasCatalog: true  });
  const onE  = buildFinalDirective(s, { catalogMode: 'ON',  hasCatalog: false });
  const off  = buildFinalDirective(s, { catalogMode: 'OFF', hasCatalog: true  });
  const none = buildFinalDirective(s, {});

  ok('ON + ada katalog → wajib tampilkan rekomendasi', /WAJIB lanjut tampilkan rekomendasi/i.test(on));
  ok('ON + katalog kosong → wajib minta maaf',          /WAJIB minta maaf/i.test(onE));
  ok('ON + katalog kosong → larangan mengarang listing', /JANGAN mengarang listing/i.test(onE));
  ok('OFF → summary saja',                              /JANGAN tampilkan listing/i.test(off));
  ok('OFF TIDAK menyuruh tampilkan rekomendasi',        !/WAJIB lanjut tampilkan rekomendasi/i.test(off));
  ok('mode tidak diberikan → tidak ada baris katalog (kompatibel)', !/KATALOG=/i.test(none));
}

console.log('\n── Group 8: direktif final tetap di posisi 100% (jaga M62) ──');
{
  const s = extractQualificationState(H(cust('Saya mau beli rumah di Malang')), 'Saya mau beli rumah di Malang');
  const d = buildFinalDirective(s, { agentName: 'A', appName: 'B', catalogMode: 'ON', hasCatalog: true });
  ok('direktif diakhiri garis penutup', /═+\s*$/.test(d.trim()), JSON.stringify(d.slice(-40)));
  ok('direktif tetap ringkas (< 2200 char)', d.length < 2200, `len=${d.length}`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);

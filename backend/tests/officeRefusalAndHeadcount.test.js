/**
 * officeRefusalAndHeadcount.test.js
 *
 * M102 — EMPAT CACAT DARI SATU TRANSKRIP PRODUKSI
 * (booking kantor Madiun, terminal Kirimi, 20 Agu 2026).
 *
 *  (a) PENOLAKAN SURVEI TIDAK TERCATAT BILA DIUCAPKAN DI GILIRAN LAIN.
 *      Customer menolak EMPAT KALI dan tetap ditanya ulang:
 *        16.20 "Tdk perlu survei. Saya minta rekomendasi aja dlu"
 *              → AI: "kira-kira mau viewing jam berapa?"       ❌
 *        16.21 "Tdk mau survei. Minta katalog saja"            → tidak tercatat
 *        16.34 "Minta listing saja"                            → tidak tercatat
 *        16.37 AI menanya Q9 (jadwalkan viewing) LAGI          ❌
 *      Akar: cek penolakan BERSARANG di dalam `aiAsksViewDate`, jadi penolakan
 *      yang diucapkan saat AI menanyakan hal LAIN (jam / Q5 / Q14) menguap.
 *      Penolakan survei bersifat MUTLAK — tidak bergantung pertanyaan terbuka.
 *
 *  (b) Q5 VARIAN KOMERSIAL TIDAK DIKENALI EKSTRAKTORNYA SENDIRI.
 *      Untuk tipe kantor, Q5 dikirim sebagai
 *        "Ada syarat yang mutlak diperlukan atau yang tidak boleh ada untuk
 *         kantor ini?"
 *      yang tidak cocok pola mana pun → jawaban "Tidak boleh kotor aja" hilang,
 *      redFlags tetap null, Q5 DIULANG 3× dengan tiga kalimat berbeda.
 *      Kelas SAMA dengan M88: AI mengirim pertanyaan yang ekstraktornya sendiri
 *      tidak kenali.
 *
 *  (c) JUMLAH ORANG DIBACA SEBAGAI BUDGET.
 *      Q14 kantor menanyakan headcount; jawaban
 *        "Kemungkinan ada 20-38 orang yg akan berkerja di kantor ini"
 *      terbaca sebagai budget AMBIGU → AI membalas
 *        "Untuk harga 20-38 — maksudnya dalam ribu, juta, miliar, atau triliun?"
 *      Kelas SAMA dengan strip lantai/tanggal yang sudah ada di detectBudget.
 *      ⚠️ Hanya bentuk RENTANG yang bocor; "20 orang" tunggal sudah aman.
 *
 *  (d) TIMEOUT KIMI HARDCODE 90 detik.
 *      Log produksi berulang: "Kimi API error: timeout of 90000ms exceeded".
 *      Melanggar konvensi proyek (semua config dari .env) DAN membuat customer
 *      menunggu 90 detik sebelum fallback Private Agent berjalan.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const P = require('../services/aiPromptBuilderService');
const { detectBudget } = require('../services/propertyRecommendationService');

let pass = 0, total = 0;
const ok = (n, c, extra) => {
  total++;
  if (c) { pass++; console.log(`  ✅ ${n}`); }
  else { console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); }
};

const U = (m) => ({ role: 'user', message: m });
const A = (m) => ({ role: 'assistant', message: m });

const Q9  = 'Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain? 📅';
const Q9c = 'Baik, Kak — kira-kira mau viewing jam berapa? ⏰';
const Q5_UMUM   = 'Ada yang pasti tidak cocok atau ingin dihindari? Misalnya rawan banjir, area panas, hadap barat? 🚫';
const Q5_KANTOR = 'Ada syarat yang mutlak diperlukan atau yang tidak boleh ada untuk kantor ini? 🚫';
const Q14_GRADE = 'Preferensi gedung Grade A (premium), Grade B (mid), atau Grade C (ekonomis)? 🏢';

const stateAfter = (aiQuestion, custAnswer, opening = 'Hello... Mau booking office di Madiun') =>
  P.extractQualificationState([U(opening), A(aiQuestion), U(custAnswer)], custAnswer);

// ═══ (a) Penolakan survei di giliran MANA PUN ════════════════════════════════
console.log('\n[M102a] Penolakan survei dicatat di giliran mana pun');

[
  ['16.20 tolak + minta rekomendasi (AI tanya Q9)', Q9,        'Tdk perlu survei. Saya minta rekomendasi aja dlu'],
  ['16.21 tolak + minta katalog (AI tanya JAM)',    Q9c,       'Tdk mau survei. Minta katalog saja'],
  ['16.34 minta listing (AI tanya Q5)',             Q5_UMUM,   'Minta listing saja'],
  ['minta listing saat AI tanya Q14 grade',         Q14_GRADE, 'Minta listing saja'],
].forEach(([label, q, a]) => {
  const s = stateAfter(q, a);
  ok(label, s.viewingDate === 'Minta listing', `viewingDate=${JSON.stringify(s.viewingDate)}`);
});

// Setelah menolak, alur TIDAK boleh menanyakan jam survei lagi.
{
  const s = stateAfter(Q9, 'Tdk perlu survei. Saya minta rekomendasi aja dlu');
  const nq = P.findNextQuestion(s, {});
  ok('setelah menolak, pertanyaan berikutnya BUKAN jam survei (Q9c)',
    !nq || nq.q !== 'Q9c', nq ? `${nq.q}: ${String(nq.hint).slice(0, 60)}` : '(summary)');
  ok('KONTROL: penolakan juga menutup Q9 decision maker (Mandiri)',
    s.decisionMaker === 'Mandiri', `decisionMaker=${JSON.stringify(s.decisionMaker)}`);
}

console.log('\n[M102a] KONTROL NEGATIF — jangan salah tandai sebagai penolakan');
[
  ['customer MAU survei + sebut tanggal', Q9,      'Boleh, tanggal 25 Desember'],
  ['pertanyaan area (bukan penolakan)',   Q5_UMUM, 'Ada rekomendasi area yang bagus?'],
  ['jawaban Q5 biasa',                    Q5_UMUM, 'Jangan yang dekat rel kereta'],
].forEach(([label, q, a]) => {
  const s = stateAfter(q, a);
  ok(`KONTROL NEGATIF: ${label}`, s.viewingDate !== 'Minta listing',
    `viewingDate=${JSON.stringify(s.viewingDate)}`);
});

// ═══ (b) Q5 varian komersial ════════════════════════════════════════════════
console.log('\n[M102b] Q5 varian kantor dikenali ekstraktornya sendiri');

ok('varian UMUM tetap dikenali (tidak ada regresi)',
  stateAfter(Q5_UMUM, 'Tidak boleh kotor aja').redFlags === 'Tidak boleh kotor aja');
ok('varian KANTOR ("syarat mutlak / tidak boleh ada") kini dikenali',
  stateAfter(Q5_KANTOR, 'Tidak boleh kotor aja').redFlags === 'Tidak boleh kotor aja',
  JSON.stringify(stateAfter(Q5_KANTOR, 'Tidak boleh kotor aja').redFlags));

// Setelah Q5 terisi, Q5 tidak boleh jadi pertanyaan berikutnya lagi.
{
  const s = stateAfter(Q5_KANTOR, 'Tidak boleh kotor aja');
  const nq = P.findNextQuestion(s, {});
  ok('Q5 tidak diulang setelah jawabannya tercatat',
    !nq || nq.q !== 'Q5', nq ? nq.q : '(summary)');
}

ok('KONTROL NEGATIF: pertanyaan NON-Q5 tidak mengisi redFlags',
  !stateAfter('Berapa orang yang akan bekerja di kantor ini? 👥', 'Tidak boleh kotor aja').redFlags,
  'seharusnya null');

// ═══ (c) Headcount bukan budget ═════════════════════════════════════════════
console.log('\n[M102c] Jumlah orang TIDAK dibaca sebagai budget');

[
  ['pesan produksi persis', 'Kemungkinan ada 20-38 orang yg akan berkerja di kantor ini'],
  ['rentang polos',         '20-38 orang'],
  ['kata kapasitas',        'kapasitas 20-38'],
  ['staf',                  'sekitar 30-45 staf'],
].forEach(([label, msg]) => {
  const b = detectBudget(msg);
  ok(`${label} → bukan budget`, !b, b ? `terbaca: ${JSON.stringify(b)}` : '');
});

console.log('\n[M102c] KONTROL NEGATIF — budget SUNGGUHAN tetap terbaca');
{
  const b1 = detectBudget('Saya cari yang harga 1.2-2.5 juta/hari');
  ok('budget asli tetap terbaca', b1 && !b1.ambiguous && /1\.200\.000/.test(b1.text),
    JSON.stringify(b1 && b1.text));

  // Satu kalimat berisi KEDUANYA — harga harus menang, headcount diabaikan.
  const b2 = detectBudget('Kalau harga, saya cari yg badget 1.2-2.5 juta/hari; untuk kapasitas kantor bisa 20-38 orang');
  ok('kalimat campur → ambil HARGA, abaikan headcount',
    b2 && !b2.ambiguous && /1\.200\.000/.test(b2.text) && !/20/.test(String(b2.text).slice(0, 6)),
    JSON.stringify(b2 && b2.text));

  const b3 = detectBudget('budget 500-700');
  ok('KONTROL NEGATIF: budget ambigu SAH tetap minta klarifikasi',
    b3 && b3.ambiguous === true, JSON.stringify(b3));

  const b4 = detectBudget('Antara lantai 12-15 aja');
  ok('KONTROL NEGATIF: guard lantai lama masih jalan', !b4, JSON.stringify(b4));
}

// ═══ (d) Timeout Kimi configurable ══════════════════════════════════════════
console.log('\n[M102d] Timeout Kimi dari .env, bukan hardcode');

const kimiSrc = fs.readFileSync(path.join(__dirname, '..', 'services', 'kimiService.js'), 'utf8');
ok('kimiService membaca KIMI_TIMEOUT_MS', kimiSrc.includes('KIMI_TIMEOUT_MS'));
ok('KONTROL: default tetap 90000 (perilaku tidak berubah diam-diam)',
  /KIMI_TIMEOUT_MS\s*\|\|\s*90000/.test(kimiSrc));
ok('tidak ada lagi angka timeout telanjang di panggilan axios',
  !/timeout:\s*90000\s*,/.test(kimiSrc));

console.log(`\nRESULT: ${pass}/${total}`);
process.exitCode = pass === total ? 0 : 1;

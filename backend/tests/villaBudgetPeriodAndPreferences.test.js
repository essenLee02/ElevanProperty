/**
 * villaBudgetPeriodAndPreferences.test.js
 *
 * M95 — DUA BUG DARI SATU TRANSKRIP (booking villa Malang, 18 Agu 2026).
 *
 *  (a) SATUAN PERIODE HARGA DIREBUT OLEH DURASI MENGINAP.
 *      Pesan: "saya book selama 7 hari. Saya cari yang harga 2-3 juta/minggu"
 *      (customer mengulanginya: "Yang sekitar 2-3 juta/minggu").
 *      Summary mencetak "Rp 2.000.000 - Rp 3.000.000/malam".
 *      Akar: detectBudget() memindai kata periode DI MANA SAJA dalam kalimat,
 *      dan cabang 'night' (yang juga cocok kata "hari") diperiksa SEBELUM
 *      'week'. Kata "hari" milik DURASI mengalahkan "/minggu" yang menempel
 *      pada HARGA. Angka benar, satuan salah — selisih 7× bagi agent.
 *      Fix: satuan yang MENEMPEL pada angka menang; pemindaian longgar hanya
 *      fallback, dan urutannya diperbaiki (week sebelum night).
 *
 *  (b) SELURUH PREFERENSI CUSTOMER HILANG DARI SUMMARY.
 *      Q5 dijawab "Saya mau tempat yang dingin, udaranya bersih, tempat sejuk,
 *      akses jalan strategis dengan tempat makanan" — semuanya KEINGINAN, tanpa
 *      satu pun penanda penghindaran. M89(b) benar menetapkan redFlags =
 *      "Tidak ada", TAPI komentarnya berasumsi "preferensinya tidak hilang,
 *      sudah tertangkap sebagai anchorPoint lewat 'dekat …'". Asumsi itu GAGAL
 *      di sini: jawaban Q5 tidak memakai "dekat", dan anchorPoint kemudian
 *      ditimpa jawaban Q6 ("Dekat Ijen"). Hasilnya summary tanpa baris Hindari
 *      DAN tanpa baris Prefer — satu-satunya kalimat yang menjelaskan suasana
 *      yang diinginkan customer lenyap.
 *      Fix: slot baru `state.preferences` + baris sendiri di state block.
 */

const path = require('path');
const fs = require('fs');
const { detectBudget } = require('../services/propertyRecommendationService');
const {
  extractQualificationState,
  buildQualificationStateBlock
} = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c, extra) => {
  total++;
  if (c) { pass++; console.log(`  ✅ ${n}`); }
  else { console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); }
};

const U = (m) => ({ role: 'user', message: m });
const A = (m) => ({ role: 'assistant', message: m });

// ── Transkrip produksi ───────────────────────────────────────────────────────
const HIST = [
  U('Saya mau booking villa di Malang, saya book selama 7 hari. Saya cari yang harga 2-3 juta/minggu'),
  A('Sudah lihat berapa Villa di Malang? Apa yang membuat belum cocok dari yang sudah dilihat?'),
  U('Belum pernah survei; namun saya cari yang harganya murah'),
  U('Yang sekitar 2-3 juta/minggu'),
  A('Rencananya masuk atau pindah bulan apa? 📅'),
  A('Nanti akan tinggal bersama siapa saja? Biar saya bisa carikan yang pas jumlah kamarnya 🛏️'),
  U('Rencana checkin 2 minggu lagi. Saya stay bersama keluarga besar, butuh 5 kamar'),
  A('Untuk furnitur, lebih prefer yang sudah furnished, semi-furnished, atau kosongan saja? 🛋️'),
  U('Kosongan'),
  A('Ada fasilitas villa yang diinginkan? Misalnya kolam renang pribadi, dapur lengkap, BBQ area? 🏊'),
  U('Fasilitas terserah, namun pastikan ada AC, kolam renang, gym dan ada kids zone-nya'),
  A('Ada yang pasti tidak cocok atau ingin dihindari? Misalnya rawan banjir, area panas, hadap barat, dekat jalan ramai, gang sempit, atau dekat rel kereta? 🚫'),
  U('Saya mau tempat yang dingin, udaranya bersih, tempat sejuk, akses jalan strategis dengan tempat makanan'),
  A('Ada lokasi atau tempat tertentu yang jadi patokan? Misalnya dekat Soekarno Hatta, Ijen, Dinoyo? 📍'),
  U('Dekat Ijen, Kak')
];

// ═══ (a) Periode harga ═══════════════════════════════════════════════════════
console.log('\n[M95a] Satuan periode diambil dari yang MENEMPEL pada harga');

ok('pesan produksi: durasi "7 hari" TIDAK merebut satuan "/minggu"',
  (detectBudget('saya book selama 7 hari. Saya cari yang harga 2-3 juta/minggu') || {}).period === 'week',
  `got ${(detectBudget('saya book selama 7 hari. Saya cari yang harga 2-3 juta/minggu') || {}).period}`);

ok('pengulangan customer "Yang sekitar 2-3 juta/minggu" → week',
  (detectBudget('Yang sekitar 2-3 juta/minggu') || {}).period === 'week');

ok('durasi "3 malam" + harga "/minggu" → week (bukan night)',
  (detectBudget('book 3 malam, budget 2-3 juta/minggu') || {}).period === 'week');

ok('urutan terbalik: harga dulu lalu durasi → tetap week',
  (detectBudget('harga 2-3 juta/minggu, book selama 7 hari') || {}).period === 'week');

// KONTROL NEGATIF — periode lain TIDAK boleh ikut berubah
ok('KONTROL NEGATIF: harga /malam asli tetap night',
  (detectBudget('budget 800rb-1.4 juta/malam') || {}).period === 'night');
ok('KONTROL NEGATIF: "per malam" (spasi) tetap night',
  (detectBudget('sekitar 2 juta per malam') || {}).period === 'night');
ok('KONTROL NEGATIF: /bulan tetap month',
  (detectBudget('5-8 juta/bulan') || {}).period === 'month');
ok('KONTROL NEGATIF: /tahun tetap year',
  (detectBudget('60-90 juta/tahun') || {}).period === 'year');
ok('KONTROL NEGATIF: fallback longgar masih jalan ("5 juta, per bulan ya")',
  (detectBudget('budgetnya 5 juta, per bulan ya') || {}).period === 'month');
ok('KONTROL NEGATIF: beli tanpa periode tetap kosong',
  ((detectBudget('800 juta - 2 miliar') || {}).period || '') === '');

const state = extractQualificationState(HIST, 'Dekat Ijen, Kak');

ok('state.budget memakai /minggu (bukan /malam)',
  /\/minggu$/.test(String(state.budget || '')), `budget=${state.budget}`);
ok('KONTROL: nominalnya tetap benar',
  String(state.budget || '').includes('Rp 2.000.000') && String(state.budget || '').includes('Rp 3.000.000'));

// ═══ (b) Preferensi tidak boleh hilang ═══════════════════════════════════════
console.log('\n[M95b] Preferensi positif Q5 disimpan, tidak dibuang');

ok('redFlags tetap jujur "Tidak ada" (tidak ada yang dihindari) — perilaku M89b',
  state.redFlags === 'Tidak ada', `redFlags=${state.redFlags}`);

ok('state.preferences MENYIMPAN kalimat preferensi customer',
  typeof state.preferences === 'string' && state.preferences.includes('sejuk'),
  `preferences=${state.preferences}`);
ok('preferences memuat "udaranya bersih"',
  String(state.preferences || '').includes('udaranya bersih'));
ok('preferences memuat "tempat makanan"',
  String(state.preferences || '').includes('tempat makanan'));

const block = buildQualificationStateBlock(state);
ok('state block punya baris Prefer/suasana terpisah dari Red flags',
  /Prefer\/suasana\s+\[Q5\]/.test(block));
ok('baris Prefer di state block berisi nilainya (bukan BELUM DIJAWAB)',
  /Prefer\/suasana\s+\[Q5\]:\s*Saya mau tempat yang dingin/.test(block));

// KONTROL NEGATIF: jawaban Q5 yang BENAR-BENAR penghindaran tidak boleh
// mengisi preferences — arah maknanya berlawanan.
console.log('\n[M95b] KONTROL NEGATIF — penghindaran asli tidak jadi "preferences"');
{
  const H2 = [
    U('Saya mau sewa rumah di Surabaya'),
    A('Ada yang pasti tidak cocok atau ingin dihindari? Misalnya rawan banjir, area panas? 🚫'),
    U('Jangan yang rawan banjir dan jangan dekat rel kereta')
  ];
  const s2 = extractQualificationState(H2, 'Jangan yang rawan banjir dan jangan dekat rel kereta');
  ok('penghindaran asli → redFlags terisi kalimatnya',
    String(s2.redFlags || '').includes('banjir'), `redFlags=${s2.redFlags}`);
  ok('KONTROL NEGATIF: preferences TIDAK terisi untuk jawaban penghindaran',
    !s2.preferences, `preferences=${s2.preferences}`);
}

// ═══ Dokumentasi tersinkron di KETIGA folder ═════════════════════════════════
console.log('\n[M95] Skill docs — ketiga folder');

const ROOT = path.resolve(__dirname, '..', '..');
const FOLDERS = ['claude_responds', 'chat_gpt_responds', 'elevan-property-assistant'];

FOLDERS.forEach((f) => {
  const doc = fs.readFileSync(path.join(ROOT, 'skills', f, 'docs', '04-qualification-flow.md'), 'utf8');
  ok(`${f}: aturan "all-positive Q5 tetap menghasilkan DUA baris"`,
    doc.includes('all-positive Q5 answer still produces BOTH lines'));
  ok(`${f}: aturan periode budget ≠ durasi menginap`,
    doc.includes('never the stay length'));
  ok(`${f}: tabel lawan-kata diperluas (dingin/udara bersih)`,
    doc.includes('Udara kotor / berpolusi'));
});

const a = fs.readFileSync(path.join(ROOT, 'skills', 'claude_responds', 'docs', '04-qualification-flow.md'), 'utf8');
const b = fs.readFileSync(path.join(ROOT, 'skills', 'chat_gpt_responds', 'docs', '04-qualification-flow.md'), 'utf8');
ok('claude_responds & chat_gpt_responds doc 04 BYTE-IDENTICAL', a === b);

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

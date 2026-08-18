/**
 * occupancyAnswerGateDrop.test.js
 *
 * M93 — JAWABAN Q4 (PENGHUNI) DIBUANG GERBANG SEBAGAI "OFF-TOPIC".
 *
 * Transkrip produksi 18 Agu 2026 (booking villa Malang, terminal Kirimi):
 *   AI  : "Nanti akan tinggal bersama siapa saja? Biar saya bisa carikan yang
 *          pas jumlah kamarnya 🛏️"
 *   Cust: "Rencana checkin 2 minggu lagi. Saya stay bersama keluarga besar,
 *          butuh 5 kamar"                                          ← 78 char
 *   AI  : "Hehe, maaf Kak — kalau soal itu saya belum bisa bantu 😄
 *          Saya asisten khusus properti."                          ← DUA KALI
 *
 * Customer menjawab dengan BENAR dan LENGKAP (tanggal check-in + komposisi
 * penghuni + jumlah kamar sekaligus), lalu ditolak sebagai off-topic — dua kali
 * berturut-turut, termasuk saat ia mengetik ulang memperbaiki typo.
 *
 * AKAR MASALAH: `isPropertyContextContinuation` memiliki gerbang panjang 70
 * karakter. Pesan >70 char HARUS punya salah satu sinyal konten properti untuk
 * lolos. Ada detektor untuk budget (Q3), furnishing (Q11), kondisi (Q_COND),
 * fasilitas, landmark, motivasi, tower/lantai — TAPI TIDAK ADA SATU PUN untuk
 * PENGHUNI (Q4), padahal Q4 adalah pertanyaan WAJIB. Jawaban Q4 yang panjang
 * karena customer menjawab banyak hal sekaligus otomatis jatuh ke off-topic.
 *
 * Kelas bug yang SAMA dengan M87 (booking tidak ada di ACTION_WORDS) dan M88
 * (jawaban Q2c tidak ada polanya): fitur lengkap di findNextQuestion tapi
 * GERBANG MASUK-nya tidak ikut diperluas. Pelajaran M87/M88 terulang lagi —
 * saat menambah/mewajibkan sebuah pertanyaan, periksa juga apakah JAWABANNYA
 * bisa masuk.
 */

const {
  isPropertyContextContinuation,
  hasPropertyKeyword,
  isInPropertyFlow
} = require('../utils/propertyKeywordFilter');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const U = (m) => ({ role: 'user', message: m });
const A = (m) => ({ role: 'assistant', message: m });

// ── Riwayat PERSIS transkrip produksi ────────────────────────────────────────
const HIST = [
  U('Saya mau booking villa di Malang, saya book selama 7 hari. Saya cari yang harga 2-3 juta/minggu'),
  A('Sudah lihat berapa Villa di Malang? Apa yang membuat belum cocok dari yang sudah dilihat?'),
  U('Belum pernah survei; namun saya cari yang harganya murah'),
  U('Yang sekitar 2-3 juta/minggu'),
  A('Rencananya masuk atau pindah bulan apa? 📅'),
  A('Nanti akan tinggal bersama siapa saja? Biar saya bisa carikan yang pas jumlah kamarnya 🛏️')
];

console.log('\n[1] Reproduksi transkrip produksi — pesan PERSIS yang ditolak 2×');

const PROD_TYPO = 'Rencana checking 2 minggu lagi. Saya stay bersama keluarga besar, butuh 5 kamar';
const PROD_REAL = 'Rencana checkin 2 minggu lagi. Saya stay bersama keluarga besar, butuh 5 kamar';

// Bukti akar masalah: pesan memang >70 char dan TIDAK punya kata kunci properti
// telanjang — jadi ia HARUS lolos lewat jalur continuation, bukan lewat keyword.
ok('KONTROL: pesan produksi >70 char (memicu gerbang panjang)', PROD_REAL.length > 70);
ok('KONTROL: hasPropertyKeyword = false (wajar untuk jawaban Q4)', hasPropertyKeyword(PROD_REAL) === false);
ok('KONTROL: percakapan memang sedang dalam alur properti', isInPropertyFlow(HIST) === true);

ok('pesan produksi (ejaan asli "checkin") DITERIMA sebagai lanjutan',
  isPropertyContextContinuation(PROD_REAL, HIST) === true);
ok('pesan produksi (typo "checking") DITERIMA juga — customer mengetik ulang',
  isPropertyContextContinuation(PROD_TYPO, HIST) === true);

console.log('\n[2] Bentuk-bentuk lain jawaban Q4 (penghuni/kapasitas)');

const Q4_ANSWERS = [
  ['komposisi + kamar',      'Saya tinggal bersama istri dan 2 anak, jadi butuh 3 kamar tidur'],
  ['jumlah orang',           'Kami berlima, jadi butuh 3 kamar tidur ya kak'],
  ['keluarga besar',         'stay bersama keluarga besar'],
  ['sendiri',                'sendiri aja'],
  ['bertiga',                'bertiga sama teman kerja'],
  ['jumlah kamar eksplisit', 'Butuh 5 kamar ya, soalnya rombongan keluarga semua ikut menginap'],
  ['pax (booking)',          'Total 8 orang dewasa dan 2 anak, menginap 3 malam di Malang'],
  ['orang tua',              'Saya menginap bersama orang tua dan mertua, tolong yang 4 kamar']
];

Q4_ANSWERS.forEach(([label, msg]) => {
  ok(`Q4 diterima — ${label}`, isPropertyContextContinuation(msg, HIST) === true);
});

console.log('\n[3] KONTROL NEGATIF — off-topic TETAP ditolak');

// Sengaja memakai kosakata yang BERIRISAN dengan detektor baru (keluarga, orang,
// anak, angka) untuk membuktikan detektor tidak sekadar meloloskan kata itu.
const OFF_TOPIC = [
  ['pesan makanan + keluarga besar', 'Saya mau pesan makanan buat keluarga besar, 5 porsi ya'],
  ['tiket pesawat + 4 orang',        'Mau beli tiket pesawat buat 4 orang'],
  ['gofood + 3 orang',               'Tolong pesan gofood 3 orang porsi besar'],
  ['nonton film + anak',             'mau nonton film sama anak'],
  ['beli hp + anak',                 'mau beli hp baru buat anak saya yang nomor dua']
];

OFF_TOPIC.forEach(([label, msg]) => {
  ok(`KONTROL NEGATIF ditolak — ${label}`, isPropertyContextContinuation(msg, HIST) === false);
});

console.log('\n[4] KONTROL NEGATIF — tanpa konteks properti, tetap ditolak');

// Tanpa riwayat alur properti, jawaban Q4 sekalipun tidak boleh lolos: bisa jadi
// pesan nyasar / broadcast. Continuation HARUS bergantung pada konteks.
ok('riwayat KOSONG → ditolak',
  isPropertyContextContinuation(PROD_REAL, []) === false);

const NON_PROPERTY_HIST = [
  U('halo'),
  A('Halo! Ada yang bisa saya bantu?')
];
ok('riwayat NON-properti → tidak diperlakukan sebagai jawaban Q4',
  isPropertyContextContinuation('stay bersama keluarga besar', NON_PROPERTY_HIST) === false);

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

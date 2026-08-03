/**
 * finalDirective.test.js
 *
 * Mengunci DIREKTIF FINAL di ujung prompt WhatsApp.
 *
 * Bug asal (produksi, 3 Agu 2026): prompt satu pesan = ±53.000 token, sedangkan
 * QUALIFICATION STATE (kebenaran otoritatif, ±450 token) berada di posisi 8%
 * dan disusul ±49.000 token prosa. gpt-4o-mini kehilangan jejak state:
 *   - Q1 sudah ✅ rent+apartment, tapi AI bertanya "mau sewa atau beli?"
 *   - "Saya sewa apartemen" dibalas "Maaf, saya hanya bisa membantu properti"
 *   - alur di-reset jadi "pencarian baru" berkali-kali
 * Model memperhatikan AWAL dan AKHIR prompt jauh lebih kuat daripada tengah,
 * jadi inti state diulang di posisi PALING AKHIR.
 */
const { buildWhatsappReplyPrompt } = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });
const SESSION = { id: 1, name: 'N', normalizedPhone: '62', source: 'wa', agentName: 'LEO FELIX' };
const build = (hist, msg) =>
  buildWhatsappReplyPrompt(SESSION, hist, msg, '', 'chatgpt', {});

// Transkrip nyata yang memicu bug.
const HIST = [
  u('Saya mau booking apartemen'),
  u('Saya booking di Surabaya'),
  a('Baik! Mau sewa Apartemen. Di kota mana? Dan kisaran harga?'),
  u('Di Surabaya, Kak'),
  a('Hampir lengkap! Untuk sewa Apartemen di Surabaya — Kisaran harga?'),
];

console.log('\n── Posisi: direktif harus PALING AKHIR ──');
{
  const p = build(HIST, 'Saya cari yang harga terjangkau');
  const i = p.indexOf('⚡ DIREKTIF FINAL');
  ok('direktif ada di prompt', i > 0);
  ok('berada di >98% panjang prompt', i / p.length > 0.98);
  ok('tidak ada QUALIFICATION STATE sesudahnya',
     !p.slice(i).includes('📋 QUALIFICATION STATE'));
  ok('ekor setelah direktif ringkas (<400 token)', (p.length - i) / 4 < 400);
}

console.log('\n── Isi: field ✅ diulang, pertanyaan berikutnya tunggal ──');
{
  const p = build(HIST, 'Saya cari yang harga terjangkau');
  const tail = p.slice(p.indexOf('⚡ DIREKTIF FINAL'));
  ok('Q1 transaksi disebut sudah dijawab', /Q1 transaksi=rent/.test(tail));
  ok('tipe apartment disebut',             /Tipe=apartment/.test(tail));
  ok('kota Surabaya disebut',              /Q2 kota=Surabaya/.test(tail));
  ok('budget terjangkau disebut',          /Q3 budget=terjangkau/.test(tail));
  ok('menyebut satu pertanyaan berikutnya', /TANYAKAN SEKARANG → Q2c/.test(tail));
  ok('larangan "sewa atau beli" ada',      /JANGAN mulai "pencarian baru"/.test(tail));
  ok('larangan balasan off-topic ada',     /TIDAK PERNAH "non-properti"/.test(tail));
}

console.log('\n── Sesi kosong: tidak mengklaim ada jawaban ──');
{
  const p = build([], 'Halo');
  const tail = p.slice(p.indexOf('⚡ DIREKTIF FINAL'));
  ok('menandai belum ada jawaban', /\(belum ada\)/.test(tail));
}

console.log('\n── Semua wajib ✅ → perintahkan SUMMARY, bukan bertanya ──');
{
  const hist = [
    u('mau sewa rumah di surabaya'),
    a('budget?'), u('5 juta per bulan'),
    a('kapan masuk?'), u('15 Agustus 2026'),
    a('tinggal sama siapa?'), u('sama istri'),
    a('ada yang dihindari?'), u('jangan banjir'),
    a('ada patokan lokasi?'), u('dekat pakuwon'),
    a('selain area itu ada area lain?'), u('tidak ada'),
    a('perlu koordinasi dulu?'), u('saya sendiri yang putuskan'),
    a('durasi sewa berapa lama?'), u('1 tahun'),
    a('furnitur?'),
  ];
  const p = build(hist, 'semi furnished');
  const tail = p.slice(p.indexOf('⚡ DIREKTIF FINAL'));
  const done = /TAMPILKAN SUMMARY BRIEF/.test(tail);
  const asks = /TANYAKAN SEKARANG/.test(tail);
  ok('memerintahkan summary ATAU pertanyaan tersisa (bukan keduanya)', done !== asks);
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

/**
 * investasiUseCaseFlow.test.js
 *
 * Bug produksi (Malang beli-rumah, 7 Agu 2026): saat ditanya Q4 ("Nanti akan
 * ditempati bersama siapa saja?") customer menjawab "Oh ini untuk investasi".
 * Itu jawaban SAH — rumahnya memang tidak akan ditinggali — dan alur seharusnya
 * melewati Q4 lalu lanjut ke pertanyaan berikutnya. Yang terjadi: AI membalas
 *   "Maaf, saat ini belum ada properti di katalog saya yang cocok…"
 * lalu percakapan mati, padahal kualifikasi baru separuh jalan.
 *
 * DIAGNOSA: state server SUDAH BENAR (useCase='investasi', household di-N/A-kan,
 * findNextQuestion → Q7, banner "SUMMARY DIBLOKIR" tampil, DIREKTIF FINAL
 * menyuruh tanya Q7). Kalimat maaf itu TIDAK dikarang model — ia tersedia utuh
 * di TEMPLATE BRIEF dalam prompt (cabang katalog-kosong; Malang memang belum
 * punya listing sama sekali). Model tinggal menyalinnya.
 *
 * FIX: selama masih ada field wajib kosong, template brief TIDAK BOLEH hadir
 * utuh di prompt — kalimat penutupnya disembunyikan. Menghilangkan kalimatnya
 * menutup celah; menambah larangan tidak.
 */
const {
  extractQualificationState, findNextQuestion, buildQualificationStateBlock, buildWhatsappReplyPrompt,
} = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });
const SESSION = { agentName: 'Leo Felix', name: 'Nigel', normalizedPhone: '628', source: 'kirimi_leo_felix' };

// Transkrip nyata sampai tepat sebelum jawaban "untuk investasi".
const HISTORY = [
  u('Hi. Saya beli rumah di Malang'),
  a('Di area atau kawasan mana di Malang yang Anda pertimbangkan?'),
  u('Saya mau di Lokowaru'),
  a('Sudah lihat berapa Rumah di Malang? Apa yang membuat belum cocok dari yang sudah dilihat?'),
  u('Saya ingin cari rmh yg besar, tdk banjir, tdk panas'), u('Dkt gunung dan sawah'), u('Suasana asri'),
  a('Di Malang ada house kisaran Rp 2.000.000 dan Rp 3.000.000. Kira-kira yang mana lebih sesuai?'),
  u('Saya mau beli rumah dgn harga 400juta-900 juta'),
  a('Ada target kapan proses belinya selesai?'),
  u('5 bulan lagi'),
  a('Nanti akan ditempati bersama siapa saja? Biar pas jumlah kamarnya'),
];

console.log('\n── "untuk investasi" dikenali sebagai jawaban Q4 yang SAH ──');
{
  for (const ans of ['Oh ini untuk investasi', 'Rumahnya untuk investasi', 'ini buat investasi aja']) {
    const st = extractQualificationState(HISTORY, ans);
    ok(`"${ans}" → useCase = investasi`, st.useCase === 'investasi');
  }
  const st = extractQualificationState(HISTORY, 'Oh ini untuk investasi');
  ok('household TIDAK dipaksa terisi (rumah tidak ditinggali)', !st.household);
}

console.log('\n── Alur LANJUT, tidak berhenti & tidak mengulang Q4 ──');
{
  const st = extractQualificationState(HISTORY, 'Oh ini untuk investasi');
  const nq = findNextQuestion(st);
  ok('ada pertanyaan berikutnya (alur tidak mati)', !!nq && !!nq.q);
  ok('BUKAN mengulang Q4 penghuni', !/ditempati bersama siapa/i.test((nq && nq.hint) || ''));

  const block = buildQualificationStateBlock(st);
  ok('state block menandai Q4 sebagai N/A investasi', /N\/A — investasi/.test(block));

  // ⚠️ KONTRAK BERUBAH 2 Sep 2026 — dulu di sini di-assert "SUMMARY DIBLOKIR".
  // HISTORY ini sudah punya KEEMPAT slot inti (beli · rumah · Malang · Lokowaru),
  // jadi di bawah aturan 4-slot summary memang BOLEH keluar. Menahannya justru
  // perilaku lama yang memaksa interview lanjut (budget/fasilitas/survei/KPR).
  ok('4 slot inti lengkap → summary TIDAK diblokir lagi', !/SUMMARY DIBLOKIR/.test(block));
}

console.log('\n── Kalimat "belum ada properti di katalog" TIDAK tersedia saat summary diblokir ──');
{
  const p = buildWhatsappReplyPrompt(SESSION, HISTORY, 'Oh ini untuk investasi', '', 'shared', {});
  ok('kalimat penutup katalog-kosong TIDAK ada di prompt (tidak bisa disalin)',
     !/belum ada properti di katalog saya yang cocok/.test(p));
  // ⚠️ KONTRAK BERUBAH 2 Sep 2026 (lihat catatan di blok sebelumnya): HISTORY ini
  // sudah memenuhi 4 slot inti, jadi peringatan blokir memang TIDAK boleh muncul.
  ok('4 slot inti lengkap → tidak ada peringatan "SUMMARY SEDANG DIBLOKIR"',
     !/SUMMARY SEDANG DIBLOKIR/.test(p));
  ok('direktif final tetap menyuruh bertanya, bukan menutup', /TANYAKAN SEKARANG →/.test(p));
}

console.log('\n── Setelah semua field wajib ✅ → template brief kembali utuh ──');
{
  const full = [
    u('Hi. Saya beli rumah di Malang'), a('area mana?'), u('Lowokwaru'),
    a('Di Malang ada house kisaran Rp 2.000.000 dan Rp 3.000.000. Kira-kira yang mana lebih sesuai?'),
    u('400juta-900 juta'), a('target kapan?'), u('5 bulan lagi'),
    a('Ada yang pasti tidak cocok?'), u('tdk banjir tdk panas'),
    a('Untuk pembiayaan, cash atau KPR?'), u('cash'),
    a('Ada fasilitas yang wajib ada?'), u('standar saja'),
    a('Kalau mau lihat unitnya, tanggal berapa?'), u('20 Agustus'),
    a('Jam berapa yang paling pas?'),
  ];
  const p = buildWhatsappReplyPrompt(SESSION, full, 'jam 2 siang', '', 'shared', {});
  ok('peringatan blokir HILANG saat wajib sudah lengkap', !/SUMMARY SEDANG DIBLOKIR/.test(p));
  ok('template brief tetap tersedia untuk dipakai', /Baik, saya sudah catat permintaan Anda/.test(p));
}

console.log('\n── Kontrol negatif: hunian biasa tetap ditanya penghuni ──');
{
  const st = extractQualificationState(HISTORY, 'Bersama istri dan 2 anak');
  ok('jawaban penghuni normal TIDAK jadi investasi', st.useCase !== 'investasi');
  ok('household terisi', !!st.household);
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

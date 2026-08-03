/**
 * budgetAnchorAcceptance.test.js
 *
 * Q3 tidak pernah ditanya langsung — AI menawarkan dua harga kontras:
 *   "Di Surabaya ada apartment kisaran Rp 2.200.000 dan Rp 3.100.000/bulan.
 *    Kira-kira yang mana lebih sesuai, Kak? 💰"
 *
 * Bug produksi 3 Agu 2026: customer menjawab "Sesuai, Kak" lalu "Sudah sesuai,
 * Kak" — keduanya PENERIMAAN yang sah — tapi `detectBudget()` hanya mengenali
 * angka/kata-tier, jadi Q3 tetap ❓ dan AI mengulang pertanyaan harga yang sama
 * tiga kali berturut-turut sampai customer minta berhenti.
 *
 * Loop ini makin konsisten setelah DIREKTIF FINAL ditambahkan (AI kini patuh
 * pada state) — bukti bahwa state yang salah HARUS diperbaiki di ekstraktor,
 * bukan ditambal aturan prompt.
 */
const { extractQualificationState } = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const ANCHOR = 'Di Surabaya ada apartment kisaran Rp 2.200.000 dan Rp 3.100.000/bulan. Kira-kira yang mana lebih sesuai, Kak? 💰';
const OPENER = { role: 'user', message: 'sewa apartemen di surabaya' };
const budgetFor = (aiMsg, ans) =>
  extractQualificationState([OPENER, { role: 'assistant', message: aiMsg }], ans).budget;

console.log('\n── MENERIMA tawaran → pakai rentang yang ditawarkan ──');
for (const ans of ['Sesuai, Kak', 'Sudah sesuai, Kak', 'iya', 'ok', 'Cocok kak', 'setuju', 'boleh', 'Sudah pas']) {
  const b = budgetFor(ANCHOR, ans);
  ok(`"${ans}" → rentang tawaran`, b === 'Rp 2.200.000 - Rp 3.100.000/bulan');
}

console.log('\n── MENOLAK karena mahal → turun ke tier terjangkau ──');
for (const ans of ['Itu kemahalan, Kak', 'terlalu mahal', 'Saya mau yang murah saja', 'Belum sesuai', 'kurang cocok']) {
  const b = budgetFor(ANCHOR, ans);
  ok(`"${ans}" → terjangkau`, b === 'terjangkau');
}

console.log('\n── Menyebut angka sendiri tetap menang atas tawaran ──');
{
  const b = budgetFor(ANCHOR, 'yang 2.2 juta');
  ok('"yang 2.2 juta" → angka customer, bukan rentang tawaran',
     !!b && b !== 'Rp 2.200.000 - Rp 3.100.000/bulan');
}

console.log('\n── ⛔ TIDAK boleh aktif di luar pertanyaan anchor harga ──');
{
  ok('pertanyaan red-flags + "Sesuai, Kak" → budget tetap kosong',
     !budgetFor('Ada yang pasti tidak cocok atau ingin dihindari? 🚫', 'Sesuai, Kak'));
  ok('baris katalog (ada Rp, bukan pertanyaan) + "iya" → kosong',
     !budgetFor('1. Apartemen X - Harga: Rp 2.500.000/bulan - Tipe: apartment', 'iya'));
  ok('pertanyaan tanggal + "ok" → kosong',
     !budgetFor('Rencananya masuk bulan apa? 📅', 'ok'));
  ok('jawaban panjang berisi info lain → biarkan detectBudget yang menangani',
     !budgetFor(ANCHOR, 'sesuai tapi saya juga mau yang dekat kampus dan ada gym serta kolam renang'));
}

console.log('\n── Satuan periode ikut dari pertanyaan ──');
{
  const perMalam = 'Di Bali ada villa kisaran Rp 800.000 dan Rp 1.500.000/malam. Kira-kira mana yang lebih sesuai?';
  ok('anchor /malam → budget ber-suffix /malam',
     budgetFor(perMalam, 'sesuai') === 'Rp 800.000 - Rp 1.500.000/malam');
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

/**
 * budgetCategoryRangeFollowup.test.js
 *
 * Bug produksi (5 Agu 2026, Jakarta beli-rumah transcript): customer menjawab
 * "Cari yang harga terjangkau" SEBELUM AI sempat menawarkan 2 harga kontras
 * (Q3 preempted oleh customer) → state.budget = "terjangkau/affordable",
 * TIDAK PERNAH ada angka Rupiah sama sekali. Q3 dianggap terjawab (!state.budget
 * sudah falsy-check lolos) sehingga tidak pernah ditanya ulang → summary akhir
 * "✓ Budget: Terjangkau" tanpa kisaran harga, tidak berguna untuk agent
 * mencocokkan listing ke customer.
 *
 * Fix: Q3a — follow-up SEKALI SAJA saat budget hanya berupa kategori tanpa
 * angka. Diterima apa pun jawabannya (angka valid atau tetap vague), dan
 * dikunci via state.budgetRangeAsked supaya tidak pernah diulang dua kali.
 */
const { extractQualificationState, findNextQuestion } = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });

console.log('\n── findNextQuestion: Q3a triggers only when budget is a bare category ──');
{
  const base = { transactionType: 'sale', buildingType: 'house', city: 'Jakarta', district: 'Ngagel', searchHistory: 'dijawab' };
  ok('budget="terjangkau", belum ditanya angka → Q3a',
     findNextQuestion({ ...base, budget: 'terjangkau' }).q === 'Q3a');
  ok('budget="terjangkau", sudah pernah ditanya (budgetRangeAsked) → lanjut, BUKAN Q3a',
     findNextQuestion({ ...base, budget: 'terjangkau', budgetRangeAsked: true }).q !== 'Q3a');
  ok('budget sudah berupa angka Rupiah → lanjut, BUKAN Q3a',
     findNextQuestion({ ...base, budget: 'Rp 700.000.000 - Rp 900.000.000' }).q !== 'Q3a');
}

console.log('\n── Kasus asli: customer mendahului dengan "terjangkau" sebelum anchor ──');
{
  const H = [
    u('Mau cari rumah di Jakarta'),
    a('Mau sewa atau beli? Dan tipe propertinya apa?'),
    u('Saya rencana beli rumah'), u('Cari yang harga terjangkau'),
    a('Baik, sudah saya catat. Di area mana di Jakarta?'), u('Ngagel'),
    a('Sudah lihat beberapa rumah?'), u('Belum'),
    a('Ada target kapan proses belinya selesai?'), u('Desember'),
    a('Ditempati bersama siapa?'), u('Keluarga'),
    a('Ada yang pasti tidak cocok?'), u('Hindari ramai'),
    a('Baik, Kak! Kira-kira di kisaran berapa ya budgetnya? Misalnya "900jt-2 miliar", "700-900 juta", atau "300rb-2jt"'),
  ];
  const stNum = extractQualificationState(H, '700-900 juta aja, Kak');
  ok('jawaban Q3a bernomor → budget terisi angka Rupiah asli',
     stNum.budget === 'Rp 700.000.000 - Rp 900.000.000');
  ok('budgetRangeAsked terkunci true setelah dijawab (angka)', stNum.budgetRangeAsked === true);

  const stVague = extractQualificationState(H, 'Terserah aja, yang penting terjangkau');
  ok('jawaban Q3a tetap vague → budget tetap kategori (tidak dipaksa angka palsu)',
     stVague.budget === 'terjangkau');
  ok('budgetRangeAsked tetap terkunci true meski jawaban vague (tidak diulang lagi)',
     stVague.budgetRangeAsked === true);
}

console.log('\n── Jalur lama: budget bernomor sejak awal tidak pernah memicu Q3a ──');
{
  const H = [
    u('Mau cari rumah di Jakarta'),
    a('Mau sewa atau beli? Dan tipe propertinya apa?'),
    u('Saya rencana beli rumah, budget 700-900 juta'),
  ];
  const st = extractQualificationState(H, 'ya betul');
  ok('budget langsung bernomor dari awal (bukan kategori)',
     /Rp/.test(st.budget || ''));
  ok('budgetRangeAsked tidak pernah di-set (tidak perlu Q3a)', !st.budgetRangeAsked);
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

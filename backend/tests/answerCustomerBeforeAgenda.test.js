/**
 * answerCustomerBeforeAgenda.test.js
 *
 * M103 — "AI TERLALU FOKUS PADA AGENDANYA SENDIRI".
 * Transkrip produksi 26 Agu 2026 (beli rumah Sidoarjo / Puri Surya Jaya).
 *
 * Customer meminta survei ENAM KALI dan TIDAK PERNAH dijawab — tiap kali
 * dibalas pertanyaan interview yang tidak berhubungan:
 *
 *   11.54 "Saya mau survei dulu, Kak"        → AI: Q4 penghuni          ❌
 *   11.54 "Apakah blh survei dlu?"           → (diabaikan)              ❌
 *   11.55 "Saya mau lihat" dlu sih, Kak"     → AI: Q_FAC fasilitas      ❌
 *   11.56 "Saya survei dlu; Kak"             → AI: Q_COND kondisi       ❌
 *   11.57 "Kalau survei ke Puri Surya Jaya,
 *          butuh brpa lama?..."              → AI: Q11 furnitur         ❌
 *   11.58 "Stop, Kak. Fokus ke survei dlu"   → AI: Q5 red flags         ❌❌
 *   11.58 "Saya mau survei. Apakah sy blh
 *          survei ke Puri Surya Jaya?"       → AI: Q6 patokan           ❌
 *
 * AKAR: `customerAsksPropertyData()` (M142) SUDAH bisa menunda baris
 * "TANYAKAN SEKARANG" di posisi 100% prompt — TAPI cakupannya hanya pertanyaan
 * yang jawabannya ada di KATALOG (alamat/harga/kamar). Permintaan di transkrip
 * ini kelasnya BERBEDA dan tidak tertangkap sama sekali:
 *   • IZIN/NIAT survei   — "Apakah blh survei dlu?"
 *   • REDIRECT eksplisit — "Stop, Kak. Fokus ke survei dlu"
 *   • LOGISTIK           — "butuh brpa lama dari Sidotopo?"
 *
 * DUA BUG EKSTRAKSI DARI TRANSKRIP YANG SAMA:
 *   (b) "Urusan KPR nanti sj" (PENUNDAAN) terbaca sebagai PILIHAN KPR →
 *       AI langsung menembak Q_KPR-a ("bank mana? DP berapa persen?"),
 *       persis topik yang baru saja diminta customer untuk ditunda.
 *   (c) Skill doc Q_KPR-a MENAWARKAN rekomendasi bank ("atau perlu saya bantu
 *       rekomendasikan?") — AI tidak boleh merekomendasikan bank sama sekali.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const G = require('../utils/customerQuestionGuard');
const P = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c, extra) => {
  total++;
  if (c) { pass++; console.log(`  ✅ ${n}`); }
  else { console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); }
};

const U = (m) => ({ role: 'user', message: m });
const A = (m) => ({ role: 'assistant', message: m });

// ═══ (a) Deteksi giliran yang WAJIB dijawab dulu ════════════════════════════
console.log('\n[M103a] Permintaan survei & redirect terdeteksi');

[
  ['11.54 niat survei',        'Saya mau survei dulu, Kak',                     'viewing'],
  ['11.54 minta izin',         'Apakah blh survei dlu?',                        'viewing'],
  ['11.55 mau lihat dulu',     'Saya mau lihat" dlu sih, Kak',                  'viewing'],
  ['11.56 survei dulu',        'Saya survei dlu; Kak',                          'viewing'],
  ['11.57 logistik survei',    'Kalau survei ke Puri Surya Jaya, butuh brpa lama? Rumah saya di Sidotopo; Kak', 'viewing'],
  ['11.58 STOP eksplisit',     'Stop, Kak. Fokus ke survei dlu',                'redirect'],
  ['11.58 izin + lokasi',      'Saya mau survei. Apakah sy blh survei ke Puri Surya Jaya?', 'viewing'],
  ['11.56 tunda KPR',          'Urusan KPR nanti sj',                           'redirect'],
].forEach(([label, msg, expected]) => {
  ok(`${label} → ${expected}`, G.customerNeedsDirectAnswer(msg) === expected,
    `got ${G.customerNeedsDirectAnswer(msg)}`);
});

console.log('\n[M103a] KONTROL NEGATIF — jawaban biasa TIDAK boleh tertangkap');
[
  'Kosongan', 'Grade B', '3 kamar tidur', 'Sidoarjo', 'Saya tinggal bersama istri',
  'Menengah aja', 'Tidak ada, Kak', 'Agus, Kak', 'Fasilitas standar',
  'Saya mau beli rumah di Sidoarjo', 'Cari yg ada 3 kamar tdr, Kak',
  'Di puri surya jaya', 'KPR aja Kak',
].forEach((msg) => {
  ok(`KONTROL NEGATIF: ${JSON.stringify(msg.slice(0, 34))}`,
    G.customerNeedsDirectAnswer(msg) === null, `got ${G.customerNeedsDirectAnswer(msg)}`);
});

// ═══ (a2) Direktif posisi-100% benar-benar berubah ══════════════════════════
console.log('\n[M103a] DIREKTIF FINAL menunda interview pada giliran itu');

const HIST = [
  U('Saya mau beli rumah di sidoarjo'),
  A('Di area atau kawasan mana di Sidoarjo yang Anda pertimbangkan? 📍'),
  U('Saya mau di Puri Surya'),
  A('Nanti akan tinggal bersama siapa saja? 🛏️'),
];
const ident = { agentName: 'NATASHA', appName: 'Propmatches' };

const directiveFor = (msg) => {
  const s = P.extractQualificationState([...HIST, U(msg)], msg);
  return P.buildFinalDirective(s, { ...ident, customerMessage: msg });
};

{
  const d = directiveFor('Apakah blh survei dlu?');
  ok('minta survei → direktif "JAWAB & TINDAK LANJUTI DULU"',
    /CUSTOMER MEMINTA SURVEI\/VIEWING/.test(d));
  ok('minta survei → TIDAK ada lagi baris "TANYAKAN SEKARANG"',
    !/TANYAKAN SEKARANG/.test(d));
  ok('direktif melarang balas dengan pertanyaan interview lain',
    /DILARANG membalas dengan pertanyaan interview lain/.test(d));
  ok('direktif melarang menebak jarak/lama perjalanan',
    /JANGAN menebak durasi|tidak punya data itu/i.test(d));
}

{
  const d = directiveFor('Stop, Kak. Fokus ke survei dlu');
  ok('redirect → direktif "MENYURUH BERHENTI & GANTI FOKUS"',
    /MENYURUH BERHENTI & GANTI FOKUS/.test(d));
  ok('redirect → TIDAK ada baris "TANYAKAN SEKARANG"', !/TANYAKAN SEKARANG/.test(d));
}

{
  // KONTROL NEGATIF paling penting: alur normal TIDAK boleh ikut berubah.
  const d = directiveFor('Kosongan');
  ok('KONTROL NEGATIF: jawaban biasa → baris TANYAKAN SEKARANG tetap ada',
    /TANYAKAN SEKARANG/.test(d));
  ok('KONTROL NEGATIF: jawaban biasa → TIDAK memicu direktif jawab-dulu',
    !/JAWAB & TINDAK LANJUTI DULU|MENYURUH BERHENTI/.test(d));
}

// Kontradiksi di posisi 100% (kelas M62) — instruksi penutup harus konsisten.
console.log('\n[M103a] Tidak ada instruksi yang saling bertentangan di ujung prompt');
['Apakah blh survei dlu?', 'Stop, Kak. Fokus ke survei dlu', 'Kosongan'].forEach((msg) => {
  const d = directiveFor(msg);
  const tellsToAskListedQuestion = /Ajukan TEPAT SATU pertanyaan/.test(d);
  const hasListedQuestion = /TANYAKAN SEKARANG/.test(d);
  ok(`"${msg.slice(0, 30)}" → penutup konsisten dengan ada/tidaknya TANYAKAN SEKARANG`,
    !tellsToAskListedQuestion || hasListedQuestion);
});

// ═══ (b) Penundaan KPR bukan pilihan KPR ════════════════════════════════════
console.log('\n[M103b] "Urusan KPR nanti sj" = PENUNDAAN, bukan pilihan');

const Q_KPR = 'Untuk pembiayaan, rencananya cash atau KPR? 💳';
const financingFor = (msg) => P.extractQualificationState(
  [U('Saya mau beli rumah di sidoarjo'), A(Q_KPR), U(msg)], msg).financing;

[
  'Urusan KPR nanti sj',
  'KPR nanti saja dulu',
  'Soal KPR belakangan aja Kak',
  'Belum kepikiran KPR-nya',
].forEach((msg) => {
  ok(`penundaan → financing tetap kosong: ${JSON.stringify(msg)}`,
    !financingFor(msg), `got ${JSON.stringify(financingFor(msg))}`);
});

console.log('\n[M103b] KONTROL NEGATIF — pilihan SUNGGUHAN tetap terbaca');
[
  ['KPR aja Kak', 'KPR'],
  ['Cash keras', 'cash'],
  ['Cash dulu sebagian, sisanya KPR', 'kombinasi cash + KPR'],
  ['pakai KPR BCA', 'KPR'],
].forEach(([msg, expected]) => {
  ok(`KONTROL NEGATIF: ${JSON.stringify(msg)} → ${expected}`,
    financingFor(msg) === expected, `got ${JSON.stringify(financingFor(msg))}`);
});

// Penundaan TIDAK boleh membuat Q_KPR-a (bank/DP) ditanyakan.
{
  const s = P.extractQualificationState(
    [U('Saya mau beli rumah di sidoarjo'), A(Q_KPR), U('Urusan KPR nanti sj')],
    'Urusan KPR nanti sj'
  );
  const nq = P.findNextQuestion(s, {});
  ok('setelah menunda KPR, pertanyaan berikutnya BUKAN Q_KPR-a (bank/DP)',
    !nq || !/bank|DP-nya|berapa persen/i.test(String(nq.hint || '')),
    nq ? String(nq.hint).slice(0, 70) : '(summary)');
}

// ═══ (c) Larangan merekomendasikan bank ═════════════════════════════════════
console.log('\n[M103c] Skill docs: AI DILARANG merekomendasikan bank');

const ROOT = path.resolve(__dirname, '..', '..');
const FOLDERS = ['claude_responds', 'chat_gpt_responds', 'elevan-property-assistant'];

FOLDERS.forEach((f) => {
  const doc = fs.readFileSync(path.join(ROOT, 'skills', f, 'docs', '02-qualification-flow.md'), 'utf8');
  ok(`${f}: TIDAK lagi menawarkan "perlu saya bantu rekomendasikan"`,
    !doc.includes('perlu saya bantu rekomendasikan'));
  ok(`${f}: memuat larangan eksplisit merekomendasikan bank`,
    /JANGAN PERNAH MEREKOMENDASIKAN BANK/.test(doc));
  ok(`${f}: memuat contoh jawaban yang benar (serahkan ke agent)`,
    /dibantu langsung oleh agent kami/.test(doc));
});

{
  const a = fs.readFileSync(path.join(ROOT, 'skills', 'claude_responds', 'docs', '02-qualification-flow.md'), 'utf8');
  const b = fs.readFileSync(path.join(ROOT, 'skills', 'chat_gpt_responds', 'docs', '02-qualification-flow.md'), 'utf8');
  ok('claude_responds & chat_gpt_responds doc 02 BYTE-IDENTICAL', a === b);
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exitCode = pass === total ? 0 : 1;

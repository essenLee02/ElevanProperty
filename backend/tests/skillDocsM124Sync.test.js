/**
 * skillDocsM124Sync.test.js — regresi M124/M125 dokumentasi skill.
 *
 * doc 01-qualification-flow.md (ketiga folder AI-facing) SEBELUMNYA mengajarkan
 * "The four triggers that reset to Q1" — termasuk "City/location changes" —
 * yang PERSIS PERILAKU BUG yang diperbaiki M124 di kode (aiPromptBuilderService.js).
 * Membiarkan dokumen lama berdiri akan membuat LLM membaca instruksi yang
 * BERTENTANGAN dengan qualification state block yang benar (lihat memory
 * prompt-outranks-skill-docs) — berpotensi membatalkan perbaikan backend.
 *
 * Run: node tests/skillDocsM124Sync.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, total = 0;
const ok = (n, c, extra = '') => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); } };

const ROOT = path.join(__dirname, '..', '..');
const FOLDERS = ['claude_responds', 'chat_gpt_responds', 'elevan-property-assistant'];

FOLDERS.forEach((f) => {
  const doc = fs.readFileSync(path.join(ROOT, 'skills', f, 'docs', '02-qualification-flow.md'), 'utf8');

  ok(`${f}: TIDAK LAGI mengajarkan "four triggers that reset to Q1"`,
    !doc.includes('four triggers that reset to Q1'));
  ok(`${f}: TIDAK LAGI menyuruh "Never carry over old location/budget/date"`,
    !doc.includes('Never carry over old location/budget/date'));
  ok(`${f}: memuat rujukan M124`, doc.includes('M124'));
  ok(`${f}: memuat banner "KOTA BERUBAH"`, doc.includes('KOTA BERUBAH'));
  ok(`${f}: banner kota menyebut landmark SATU-SATUNYA yang ditanya ulang`,
    /KOTA BERUBAH[\s\S]{0,400}Q6/.test(doc));
  ok(`${f}: tabel 3 sumbu (kota/transaksi/properti) ada`,
    doc.includes('Ganti kota') && doc.includes('Ganti transaksi') && doc.includes('Ganti properti'));
  ok(`${f}: instruksi "JANGAN tawarkan pindah kota lagi" ada (anti re-offer)`,
    doc.includes('tawarkan pindah kota lagi') || doc.includes('offer to switch city again'));
});

const a = fs.readFileSync(path.join(ROOT, 'skills', 'claude_responds', 'docs', '02-qualification-flow.md'), 'utf8');
const b = fs.readFileSync(path.join(ROOT, 'skills', 'chat_gpt_responds', 'docs', '02-qualification-flow.md'), 'utf8');
ok('claude_responds & chat_gpt_responds doc 02 BYTE-IDENTICAL (setelah update M124)', a === b);

/* ══════════════════════════════════════════════════════════════════════════
 * M154 — doc 01 juga harus disinkronkan.
 *
 * ⚠️ Tes ini SEMULA hanya memeriksa doc 02, dan itu tidak cukup. doc
 * 01-conversation-memory.md §"Reset" MASIH berdiri dengan kalimat pra-M124:
 *
 *     "**Reset** — changing **building type**, **transaction type**, or **city**
 *      discards Q2–Q12 and restarts from Q1."
 *
 * Jadi selama ini doc 02 mengajarkan aturan granular yang BENAR sementara doc
 * 03 — di folder yang sama, dimuat ke prompt yang sama — mengajarkan reset-total
 * yang justru sudah diperbaiki di kode. LLM membaca keduanya. Menguji satu
 * dokumen saja membuat perbaikan terlihat selesai padahal instruksi lawannya
 * masih hidup di berkas sebelah (pelajaran prompt-outranks-skill-docs).
 * ══════════════════════════════════════════════════════════════════════════ */
FOLDERS.forEach((f) => {
  const doc = fs.readFileSync(path.join(ROOT, 'skills', f, 'docs', '01-conversation-memory.md'), 'utf8');

  // ⚠️ Sasarannya adalah kalimat PERINTAH-nya, bukan setiap kemunculan katanya:
  // blok penjelasan yang baru sengaja MENGUTIP aturan lama ("dulu tertulis
  // sebaliknya…") supaya kesalahannya tidak diam-diam kembali. Mencocokkan teks
  // kutipan itu akan membuat tes gagal justru karena dokumennya sudah benar.
  ok(`${f}: doc 01 TIDAK LAGI memerintahkan reset-total ("**Reset** — changing …")`,
    !/\*\*Reset\*\* — changing \*\*building type\*\*/.test(doc));
  ok(`${f}: doc 01 menegaskan perubahan mid-flow BUKAN wipe ke Q1`,
    /GRANULAR, never a Q1 wipe/i.test(doc));
  ok(`${f}: doc 01 memuat tabel tiga sumbu`,
    /\|\s*\*\*City\*\*\s*\|/.test(doc) && /\|\s*\*\*Transaction\*\*\s*\|/.test(doc)
    && /\|\s*\*\*Property type\*\*\s*\|/.test(doc));
  ok(`${f}: doc 01 menyatakan durasi sewa & red flag bertahan saat ganti tipe`,
    /\*\*Property type\*\*[^\n]*lease duration[^\n]*red flags/.test(doc));
});

const c3 = fs.readFileSync(path.join(ROOT, 'skills', 'claude_responds', 'docs', '01-conversation-memory.md'), 'utf8');
const g3 = fs.readFileSync(path.join(ROOT, 'skills', 'chat_gpt_responds', 'docs', '01-conversation-memory.md'), 'utf8');
ok('claude_responds & chat_gpt_responds doc 01 BYTE-IDENTICAL', c3 === g3);

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

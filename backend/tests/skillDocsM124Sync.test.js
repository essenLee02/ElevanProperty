/**
 * skillDocsM124Sync.test.js — regresi M124/M125 dokumentasi skill.
 *
 * doc 04-qualification-flow.md (ketiga folder AI-facing) SEBELUMNYA mengajarkan
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
  const doc = fs.readFileSync(path.join(ROOT, 'skills', f, 'docs', '04-qualification-flow.md'), 'utf8');

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

const a = fs.readFileSync(path.join(ROOT, 'skills', 'claude_responds', 'docs', '04-qualification-flow.md'), 'utf8');
const b = fs.readFileSync(path.join(ROOT, 'skills', 'chat_gpt_responds', 'docs', '04-qualification-flow.md'), 'utf8');
ok('claude_responds & chat_gpt_responds doc 04 BYTE-IDENTICAL (setelah update M124)', a === b);

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

/**
 * distanceSkillDocsSync.test.js — regresi M130 dokumentasi skill.
 *
 * doc 09-offtopic-and-escalation.md (claude_responds + elevan-property-
 * assistant, TIDAK termasuk chat_gpt_responds — pemilik proyek mengelola
 * salinan itu sendiri secara manual) harus memuat §3b: aturan jarak/waktu
 * tempuh, termasuk larangan mengarang nama pelabuhan/jarak.
 *
 * Run: node tests/distanceSkillDocsSync.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, total = 0;
const ok = (n, c, extra = '') => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); } };

const ROOT = path.join(__dirname, '..', '..');
const FOLDERS = ['claude_responds', 'elevan-property-assistant'];

FOLDERS.forEach((f) => {
  const doc = fs.readFileSync(path.join(ROOT, 'skills', f, 'docs', '09-offtopic-and-escalation.md'), 'utf8');
  ok(`${f}: memuat §3b jarak/waktu tempuh`, doc.includes('3b. Distance/travel-time questions'));
  ok(`${f}: memuat rujukan M130`, doc.includes('M130'));
  ok(`${f}: melarang menebak nama pelabuhan`, /never state a specific ferry port/i.test(doc));
  ok(`${f}: menyebut GOOGLE_ENABLED=false sebagai konteks`, doc.includes('GOOGLE_ENABLED=false'));
  ok(`${f}: instruksi "jangan mengarang jarak/waktu sendiri"`,
    /do \*\*not\*\* invent a distance or travel time/i.test(doc));
});

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

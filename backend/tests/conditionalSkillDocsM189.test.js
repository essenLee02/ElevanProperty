/**
 * M189 (12 Sep 2026) — tiga doc dari backup Juli dikembalikan ke chat_gpt_responds:
 *   05-property-type-playbooks.md   (kondisional: tipe non-rumah/apartemen)
 *   06-landmark-reference.md        (kondisional: patokan/area/jarak)
 *   07-date-money-parsing-reference.md (selalu; ≤300 char sesuai arahan)
 * Konteks giliran kini dikirim SEMUA provider (deepseek/chatgpt/kimi/openrouter/
 * qwen/hf, bukan hanya Claude). ChatGPT Responses API sebelumnya tidak mengirim
 * skill sama sekali (tanpa `instructions`) — dikunci di sini.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const s = require('../services/skillPromptService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`); }
};
const files = (t) => (t.match(/^--- .*\.md ---$/gm) || []).map((x) => x.slice(4, -4));
const BIG = 999999;
const docs = path.join(__dirname, '..', 'asset', 'skills', 'chat_gpt_responds', 'docs');

console.log('\n[1] Doc 07 ada dan ≤300 karakter');
{
  const t = fs.readFileSync(path.join(docs, '07-date-money-parsing-reference.md'), 'utf8');
  ok(`07 = ${t.length} chars ≤ 300`, t.length <= 300);
  ok('07 menyebut copy verbatim + format Rp summary', /verbatim/i.test(t) && /Rp 2\.000\.000/.test(t));
}

console.log('\n[2] Konteks rumah/apartemen → 05 & 06 TIDAK dimuat');
{
  const t = s.loadSkillGroupPrompt('chatgpt', { maxCharacters: BIG, context: 'mau beli rumah, budget 500 juta' });
  const f = files(t);
  ok('05 tidak dimuat', !f.includes('05-property-type-playbooks.md'), f.join(','));
  ok('06 tidak dimuat', !f.includes('06-landmark-reference.md'));
  ok('07 selalu dimuat', f.includes('07-date-money-parsing-reference.md'));
  // M190: anggaran pemilik proyek = total berkas ≤ 14.500, cap loader 15.000.
  ok(`selalu-dimuat ${t.length} ≤ 12500`, t.length <= 12500);
}

console.log('\n[3] Pemicu kondisional');
{
  const f1 = files(s.loadSkillGroupPrompt('chatgpt', { maxCharacters: BIG, context: 'sewa villa 3 kamar di Ubud' }));
  ok('villa → 05 dimuat', f1.includes('05-property-type-playbooks.md'));
  const f2 = files(s.loadSkillGroupPrompt('chatgpt', { maxCharacters: BIG, context: 'patokannya dekat Pakuwon Mall' }));
  ok('patokan/dekat → 06 dimuat', f2.includes('06-landmark-reference.md'));
  const f3 = files(s.loadSkillGroupPrompt('chatgpt', { maxCharacters: BIG, context: 'cari gudang dekat tol' }));
  ok('gudang dekat tol → 05 + 06', f3.includes('05-property-type-playbooks.md') && f3.includes('06-landmark-reference.md'));
  const cap = Number(process.env.SKILL_MAX_RESPONSE_CHARACTERS) || 15000;
  const both = s.loadSkillGroupPrompt('chatgpt', { maxCharacters: cap, context: 'cari gudang dekat tol' });
  ok(`keduanya dimuat tetap ≤ cap ${cap} tanpa pemotongan`, !/truncated for prompt size/.test(both));
  // Yang dipakai system prompt WhatsApp adalah plafon PROJECT (loadProjectSkillPrompt),
  // bukan RESPONSE — live 12 Sep: 11000 memotong doc 07 saat 05/06 ikut.
  const proj = s.loadProjectSkillPrompt({ provider: 'deepseek', context: 'cari gudang dekat tol' });
  ok('loadProjectSkillPrompt: 9 doc utuh, 07 tidak terpotong', files(proj).includes('07-date-money-parsing-reference.md') && !/truncated for prompt size/.test(proj), files(proj).join(','));
}

console.log('\n[4] Isi doc 05/06 — aturan kunci');
{
  const d5 = fs.readFileSync(path.join(docs, '05-property-type-playbooks.md'), 'utf8');
  const d6 = fs.readFileSync(path.join(docs, '06-landmark-reference.md'), 'utf8');
  ok('05: 10 tipe non-rumah/apartemen', ['Hotel', 'Villa', 'Kos', 'Ruko', 'Kantor', 'Gudang', 'Toko', 'Mansion', 'Kondotel', 'Others'].every((k) => d5.includes(`| ${k}`)));
  ok('05: booking summary tanpa furnitur', /no furnishing line/.test(d5));
  ok('05: orientasi/hadap = jawaban Q12 valid', /hadap/.test(d5) && /Tower\/Lantai/.test(d5));
  ok('06: contoh area HANYA dari katalog agent (tabel kota statis dihapus)', /ONLY source for Q2c/.test(d6) && !/Malioboro|SCBD|Dago/.test(d6));
  ok('06: landmark customer diterima apa adanya', /never correct or doubt/.test(d6));
  ok('06: area name beats landmark', /Area name beats landmark/.test(d6));
}

console.log('\n[5] Semua provider mengirim konteks doc kondisional; ChatGPT mengirim instructions');
{
  const svc = (f) => fs.readFileSync(path.join(__dirname, '..', 'services', f), 'utf8');
  for (const [f, name] of [['deepseekService.js', 'deepseek'], ['kimiService.js', 'kimi'], ['openrouterService.js', 'openrouter'], ['huggingfaceService.js', 'huggingface'], ['qwenService.js', 'qwen'], ['openaiService.js', 'chatgpt']]) {
    ok(`${name}: getProjectSkillInstruction('${name}', buildSkillContext(history, userMessage))`,
      svc(f).includes(`getProjectSkillInstruction('${name}', buildSkillContext(history, userMessage))`));
  }
  ok('openai payload memuat instructions', /instructions:\s*options\.system \|\| getProjectSkillInstruction\('chatgpt'\)/.test(svc('openaiService.js')));
  ok('claude tetap mengirim konteks', /getProjectSkillInstruction\('claude', _skillContext\(history, userMessage\)\)/.test(svc('claudeService.js')));
}

console.log('\n[6] Tiga folder root byte-identik dengan asset');
{
  const root = path.join(__dirname, '..', '..', 'skills');
  for (const d of ['chat_gpt_responds', 'claude_responds', 'elevan-property-assistant']) {
    const same = fs.readdirSync(docs).every((f) => fs.readFileSync(path.join(docs, f), 'utf8') === fs.readFileSync(path.join(root, d, 'docs', f), 'utf8'));
    ok(`${d}/docs identik`, same);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

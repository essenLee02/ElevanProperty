'use strict';
/**
 * publish-claude-skill.js — M203 (16 Sep 2026)
 *
 * Mengunggah folder skill lokal sebagai VERSI BARU skill di Claude Platform
 * (POST /v1/skills/{CLAUDE_SKILL_ID}/versions, multipart `files[]`), atau
 * hanya memeriksa skill yang ada (--check).
 *
 *   node scripts/publish-claude-skill.js --check
 *   node scripts/publish-claude-skill.js                # upload skills/elevan-property-assistant
 *   node scripts/publish-claude-skill.js --dir ../skills/elevan-property-assistant --name propmatches-property-assistant
 *
 * Catatan API: setiap versi harus memuat SEMUA berkas (yang tidak ikut = hilang),
 * dan `name:` di SKILL.md WAJIB sama dengan nama skill yang sudah ada di platform
 * (nama lokal "elevan-property-assistant" vs nama platform bisa berbeda → --name
 * atau CLAUDE_SKILL_NAME menulis-ulang frontmatter HANYA pada payload upload,
 * berkas lokal tidak disentuh). Tanpa auto-topup; hanya memakai kredensial .env.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sanitizeEnvValue } = require('../services/openaiService');

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
const CHECK_ONLY = args.includes('--check');
const DIR = path.resolve(__dirname, flag('--dir') || '../../skills/elevan-property-assistant');
const NAME_OVERRIDE = flag('--name') || sanitizeEnvValue(process.env.CLAUDE_SKILL_NAME) || '';
const MAX_MD_CHARS = Number(process.env.SKILL_MD_BUDGET_CHARACTERS || 14700);

const apiKey = sanitizeEnvValue(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
const skillId = sanitizeEnvValue(process.env.CLAUDE_SKILL_ID);
const version = sanitizeEnvValue(process.env.CLAUDE_API_VERSION) || '2023-06-01';
if (!apiKey || !skillId) { console.error('CLAUDE_API_KEY dan CLAUDE_SKILL_ID wajib diisi di backend/.env'); process.exit(2); }
const H = { 'x-api-key': apiKey, 'anthropic-version': version };
const BASE = 'https://api.anthropic.com/v1/skills';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

(async () => {
  try {
    const info = await axios.get(`${BASE}/${skillId}`, { headers: H });
    const s = info.data || {};
    console.log(`Skill platform : ${s.id} · name=${s.display_title || s.name || '?'} · latest=${s.latest_version || '?'}`);
    const vers = await axios.get(`${BASE}/${skillId}/versions`, { headers: H });
    for (const v of (vers.data?.data || [])) console.log(`  versi ${v.version || v.id} · ${v.created_at || ''}`);
    if (CHECK_ONLY) return;

    const files = walk(DIR).filter((f) => !/\.(zip|DS_Store)$/i.test(f));
    const mdTotal = files.filter((f) => f.endsWith('.md')).reduce((n, f) => n + fs.readFileSync(f, 'utf8').length, 0);
    console.log(`Folder lokal   : ${DIR} · ${files.length} berkas · total .md ${mdTotal} char (batas ${MAX_MD_CHARS})`);
    if (mdTotal > MAX_MD_CHARS) { console.error(`⛔ total .md ${mdTotal} > ${MAX_MD_CHARS} — kecilkan dulu.`); process.exit(3); }

    const folderName = path.basename(DIR);
    const form = new FormData();
    for (const f of files) {
      const rel = `${folderName}/${path.relative(DIR, f).split(path.sep).join('/')}`;
      let buf = fs.readFileSync(f);
      if (NAME_OVERRIDE && rel.endsWith('/SKILL.md')) {
        buf = Buffer.from(buf.toString('utf8').replace(/^(---\r?\nname:\s*)[^\r\n]+/, `$1${NAME_OVERRIDE}`), 'utf8');
      }
      form.append('files[]', new Blob([buf]), rel);
      console.log(`  + ${rel} (${buf.length} B)`);
    }
    const res = await axios.post(`${BASE}/${skillId}/versions`, form, { headers: H, timeout: 120000 });
    console.log('✅ Versi baru:', res.data?.version || res.data?.id || JSON.stringify(res.data).slice(0, 200));
    console.log('   Set CLAUDE_SKILL_VERSION=latest (default) atau kunci ke versi di atas.');
  } catch (e) {
    console.error('⛔', e.response?.status || '', JSON.stringify(e.response?.data || e.message).slice(0, 400));
    process.exit(1);
  }
})();

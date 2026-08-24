/**
 * openrouterProviderWiring.test.js — regresi penambahan provider OpenRouter.
 *
 * backend/.env sudah lama menyiapkan OPENROUTER_API_KEY/MODEL/BASE_URL/
 * MAX_TOKENS/TIMEOUT_MS (dan komentar AI_PRIMARY_PROVIDER sudah menyebut
 * "openrouter" sebagai opsi valid) — tapi tidak ada services/openrouterService.js
 * ATAU wiring di aiProviderService.js sama sekali sebelum sesi ini, jadi
 * AI_PRIMARY_PROVIDER=openrouter diam-diam JATUH ke default 'chatgpt' di
 * getPrimaryAIProvider(). File ini mengunci bahwa OpenRouter kini benar-benar
 * dikenali sebagai provider penuh: routing, skill prompt (kontrak OpenAI-
 * compatible → skill set chat_gpt_responds, sama seperti Kimi/Qwen/DeepSeek),
 * dan aturan fallback SATU-provider (tidak cross-provider) yang sama seperti
 * provider lain.
 *
 * Panggilan API OpenRouter SUNGGUHAN sudah diverifikasi manual (node -e) saat
 * membangun fitur ini — tes ini SENGAJA tidak memanggil API nyata, konsisten
 * dengan disiplin suite 100% offline proyek ini.
 *
 * Run: node tests/openrouterProviderWiring.test.js
 */
'use strict';

require('dotenv').config();

let pass = 0, total = 0;
const ok = (n, c, extra = '') => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); } };

function reloadAiProviderService() {
  delete require.cache[require.resolve('../services/aiProviderService')];
  delete require.cache[require.resolve('../services/openrouterService')];
  return require('../services/aiProviderService');
}

console.log('\n== Group 1: openrouterService.js — config resolution dari .env ==');
{
  const { checkOpenRouterConfig } = require('../services/openrouterService');
  const cfg = checkOpenRouterConfig();
  ok('provider label = "openrouter"', cfg.provider === 'openrouter');
  ok('baseUrl default ke https://openrouter.ai/api/v1 bila OPENROUTER_BASE_URL kosong/terisi',
    typeof cfg.baseUrl === 'string' && cfg.baseUrl.startsWith('https://openrouter.ai'));
  ok('skillLoaded = true (skill prompt chat_gpt_responds berhasil dimuat untuk provider ini)',
    cfg.skillLoaded === true);
}

console.log('\n== Group 2: aiProviderService.js — AI_PRIMARY_PROVIDER=openrouter dikenali (bukan fallback diam-diam ke chatgpt) ==');
{
  const orig = process.env.AI_PRIMARY_PROVIDER;
  process.env.AI_PRIMARY_PROVIDER = 'openrouter';
  const svc = reloadAiProviderService();

  ok('getPrimaryAIProvider() = "openrouter"', svc.getPrimaryAIProvider() === 'openrouter', svc.getPrimaryAIProvider());
  ok('getAIProviderOrder() = ["openrouter"] (satu provider, bukan cascade)',
    Array.isArray(svc.getAIProviderOrder()) && svc.getAIProviderOrder().length === 1 && svc.getAIProviderOrder()[0] === 'openrouter');
  ok('checkAIProviderConfig().primaryProvider = "openrouter"',
    svc.checkAIProviderConfig().primaryProvider === 'openrouter');
  ok('checkAIProviderConfig().openrouter ada dan openrouterReady adalah boolean',
    typeof svc.checkAIProviderConfig().openrouterReady === 'boolean' && !!svc.checkAIProviderConfig().openrouter);

  process.env.AI_PRIMARY_PROVIDER = orig;
  reloadAiProviderService();
}

console.log('\n== Group 3: skillPromptService.js — provider "openrouter" dipetakan ke skill set chat_gpt_responds ==');
{
  const { getProjectSkillInstruction } = require('../services/aiPromptBuilderService');
  const openrouterPrompt = getProjectSkillInstruction('openrouter');
  const chatgptPrompt    = getProjectSkillInstruction('chatgpt');
  const claudePrompt     = getProjectSkillInstruction('claude');

  // getProjectSkillInstruction() menyuntikkan "FOR PROVIDER: <nama>" di baris
  // header — satu-satunya perbedaan yang SAH antara openrouter vs chatgpt.
  // Menormalkan baris itu sebelum membandingkan supaya tes ini menguji ISI
  // dokumentasi skill (harus identik), bukan label provider (memang beda).
  const normalize = (s) => String(s || '').replace(/FOR PROVIDER: \S+/, 'FOR PROVIDER: X');

  ok('getProjectSkillInstruction("openrouter") tidak kosong', Boolean(openrouterPrompt && openrouterPrompt.trim()));
  ok('isi skill docs sama persis dengan "chatgpt" (satu skill set OpenAI-compatible, bukan "shared" gabungan)',
    normalize(openrouterPrompt) === normalize(chatgptPrompt));
  ok('BEDA dari skill prompt "claude" (bukan salah petakan ke skill set lain)',
    normalize(openrouterPrompt) !== normalize(claudePrompt));
}

console.log('\n== Group 4: canUseOpenRouter() konsisten dengan hasApiKey + model terisi ==');
{
  const { canUseOpenRouter } = require('../services/aiProviderService');
  const { checkOpenRouterConfig } = require('../services/openrouterService');
  const cfg = checkOpenRouterConfig();
  const expected = cfg.hasApiKey && Boolean(cfg.model);
  ok(`canUseOpenRouter() === ${expected} (mengikuti hasApiKey=${cfg.hasApiKey}, model="${cfg.model}")`,
    canUseOpenRouter() === expected);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${total} passed${pass === total ? ' ALL PASS' : ' (FAILURES)'}`);
process.exit(pass === total ? 0 : 1);

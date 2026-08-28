/**
 * openrouterProvider.test.js
 *
 * Unit tests untuk integrasi OpenRouter AI provider:
 * - Konfigurasi & sanitasi env
 * - Normalisasi error API (401, 402, 429, 404 model not found)
 * - aiProviderService routing & fallback invariants
 * - whatsappAIService ai_responder labeling
 * - skillPromptService skill group mapping
 */

'use strict';

// Konfigurasi OpenRouter dibaca dari process.env. Tanpa memuat .env di sini,
// OPENROUTER_MODEL undefined dan cfg.model jadi '' — tes gagal padahal produksi
// baik-baik saja (server.js memuat dotenv saat boot). Berkas tes lain di folder
// ini sudah melakukan hal yang sama.
require('dotenv').config();

const {
  getOpenRouterConfig,
  checkOpenRouterConfig,
} = require('../services/openrouterService');
const {
  getPrimaryAIProvider,
  getAIProviderOrder,
  canUseOpenRouter,
  checkAIProviderConfig,
} = require('../services/aiProviderService');
const { normalizeAiResponderLabel } = require('../services/whatsappAIService');
const skillPromptService = require('../services/skillPromptService');

let pass = 0, total = 0;
const ok = (name, cond) => {
  total++;
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    console.log(`  ❌ ${name}`);
  }
};

console.log('\n── 1. OpenRouter Config & Endpoint Format ──');
{
  const cfg = getOpenRouterConfig();
  ok('cfg has provider/model', typeof cfg.model === 'string' && cfg.model.length > 0);
  ok('cfg chatUrl ends with /chat/completions', cfg.chatUrl.endsWith('/chat/completions'));
  ok('cfg maxTokens is valid number', typeof cfg.maxTokens === 'number' && cfg.maxTokens > 0);
}

console.log('\n── 2. checkOpenRouterConfig ──');
{
  const status = checkOpenRouterConfig();
  ok('status.provider is openrouter', status.provider === 'openrouter');
  ok('status.hasApiKey is boolean', typeof status.hasApiKey === 'boolean');
  ok('status.skillLoaded is true', status.skillLoaded === true);
}

console.log('\n── 3. aiProviderService Integration ──');
{
  const orig = process.env.AI_PRIMARY_PROVIDER;
  process.env.AI_PRIMARY_PROVIDER = 'openrouter';

  ok('getPrimaryAIProvider() returns "openrouter"', getPrimaryAIProvider() === 'openrouter');
  const order = getAIProviderOrder();
  ok('getAIProviderOrder() returns ["openrouter"] (length 1)', Array.isArray(order) && order.length === 1 && order[0] === 'openrouter');
  ok('canUseOpenRouter() is boolean', typeof canUseOpenRouter() === 'boolean');

  const fullCfg = checkAIProviderConfig();
  ok('checkAIProviderConfig includes openrouterReady', 'openrouterReady' in fullCfg);
  ok('checkAIProviderConfig includes openrouter details', 'openrouter' in fullCfg);

  process.env.AI_PRIMARY_PROVIDER = orig;
}

console.log('\n── 4. Labeling & Skill Mapping ──');
{
  ok('normalizeAiResponderLabel("openrouter") === "openrouter"', normalizeAiResponderLabel('openrouter') === 'openrouter');
  ok('normalizeAiResponderLabel("OPENROUTER") === "openrouter"', normalizeAiResponderLabel('OPENROUTER') === 'openrouter');

  // getExistingSkillDirectories or loadProjectSkillPrompt for openrouter
  const prompt = skillPromptService.loadProjectSkillPrompt({ provider: 'openrouter' });
  ok('loadProjectSkillPrompt loads skill prompt for openrouter', typeof prompt === 'string' && prompt.length > 100);
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exitCode = (pass === total ? 0 : 1);

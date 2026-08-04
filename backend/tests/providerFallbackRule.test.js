/**
 * providerFallbackRule.test.js
 *
 * Aturan wajib dari user (4 Agu 2026): apa pun AI_PRIMARY_PROVIDER, error pada
 * provider itu (token habis, key invalid, dll) LANGSUNG jatuh ke
 * chatbotPrivateController.js (Private Agent) — TIDAK mencoba provider
 * eksternal lain dulu:
 *   Kimi     → Private Agent
 *   DeepSeek → Private Agent
 *   Qwen     → Private Agent
 *   Claude   → Private Agent
 *   ChatGPT  → Private Agent
 *   (primary=private) → Private Agent langsung, tanpa AI eksternal
 *
 * Ini SUDAH jadi perilaku PROVIDER_ORDER (satu entri per key) — tes ini
 * mengunci invarian tsb supaya tidak pernah diam-diam berubah jadi cross-
 * provider cascade (mis. Kimi gagal → coba DeepSeek → coba Claude → ...).
 */
// eslint-disable-next-line no-unused-vars
const _unused = require('../services/aiProviderService'); // sanity: module loads

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

console.log('\n── Tiap primary → chain SATU provider saja (langsung ke Private Agent) ──');
for (const primary of ['kimi', 'deepseek', 'qwen', 'claude', 'chatgpt']) {
  const orig = process.env.AI_PRIMARY_PROVIDER;
  process.env.AI_PRIMARY_PROVIDER = primary;
  delete require.cache[require.resolve('../services/aiProviderService')];
  const { getAIProviderOrder: reload } = require('../services/aiProviderService');
  const order = reload();
  process.env.AI_PRIMARY_PROVIDER = orig;
  ok(`${primary}: chain = ['${primary}'] (panjang 1)`, Array.isArray(order) && order.length === 1 && order[0] === primary);
}
delete require.cache[require.resolve('../services/aiProviderService')];

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

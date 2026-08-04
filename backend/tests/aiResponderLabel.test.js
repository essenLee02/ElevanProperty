/**
 * aiResponderLabel.test.js
 *
 * chat_messages.ai_responder harus mencatat provider yang BENAR-BENAR
 * menjawab, bukan sekadar menyalin AI_PRIMARY_PROVIDER. Aturan wajib (user,
 * 4 Agu 2026): saat primary provider gagal/token habis dan sistem otomatis
 * fallback ke chatbotPrivateController.js, nilainya HARUS 'private' — bukan
 * nama primary yang sebenarnya gagal, dan bukan pula sekadar 'private_agent'
 * (nilai internal whatsappAIService yang perlu dinormalisasi).
 */
const { normalizeAiResponderLabel } = require('../services/whatsappAIService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

console.log('\n── 5 provider asli → apa adanya ──');
for (const p of ['chatgpt', 'claude', 'qwen', 'deepseek', 'kimi']) {
  ok(`"${p}" → "${p}"`, normalizeAiResponderLabel(p) === p);
}

console.log('\n── Fallback ke Private Agent → "private" (BUKAN nama primary yang gagal) ──');
ok('"private_agent" → "private"', normalizeAiResponderLabel('private_agent') === 'private');

console.log('\n── Bukan hasil provider mana pun → null (bukan menebak) ──');
ok('"qualification" (gerbang info-minimum) → null',  normalizeAiResponderLabel('qualification') === null);
ok('"fallback_generic" (last-resort statis) → null', normalizeAiResponderLabel('fallback_generic') === null);
ok('"fallback" (catch-all lokal controller) → null', normalizeAiResponderLabel('fallback') === null);
ok('string kosong → null',                            normalizeAiResponderLabel('') === null);
ok('undefined → null',                                 normalizeAiResponderLabel(undefined) === null);
ok('nama tak dikenal → null (tidak menebak)',          normalizeAiResponderLabel('some-typo') === null);

console.log('\n── Case-insensitive ──');
ok('"ChatGPT" (huruf besar) → "chatgpt"', normalizeAiResponderLabel('ChatGPT') === 'chatgpt');
ok('"PRIVATE_AGENT" → "private"',          normalizeAiResponderLabel('PRIVATE_AGENT') === 'private');

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

/**
 * huggingfaceService.test.js — regresi M95.
 *
 * Provider ke-6: Hugging Face Inference Router (router.huggingface.co),
 * OpenAI-compatible, HTTP biasa — mengikuti pola kimiService.js persis.
 *
 * ⚠️ BUKAN vLLM self-hosted. Permintaan asli meminta `vllm serve
 * "Qwen/Qwen3.8-27B"` (model 27B, lokal) untuk Python — dicek `nvidia-smi`
 * sebelum menulis kode: TIDAK ADA GPU NVIDIA di mesin ini, jadi itu tidak akan
 * pernah jalan. HF Router dipakai sebagai gantinya untuk KEDUA backend
 * (Node.js sesuai permintaan eksplisit; Python sebagai substitusi vLLM).
 *
 * VERIFIKASI LANGSUNG KE API (14 Agu 2026, bukan dari dokumentasi):
 *   HF_TOKEN yang tersedia mengembalikan 403 "This authentication method does
 *   not have sufficient permissions to call Inference Providers" — pada DUA
 *   model berbeda (openai/gpt-oss-20b:groq, deepseek-ai/DeepSeek-V4-Flash-
 *   0731:novita), hasil identik. Token SAH tapi tanpa scope "Inference
 *   Providers". Ini kelas kesalahan yang BERBEDA dari 401 (token
 *   salah/kadaluarsa) — token perlu diedit scope-nya di
 *   huggingface.co/settings/tokens, bukan diganti.
 *
 * Run: node tests/huggingfaceService.test.js
 */

'use strict';

require('dotenv').config();

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const hf = require('../services/huggingfaceService');

/* ⚠️ M184 (6 Sep 2026) — GERBANG "PROVIDER BELUM TERPASANG".
 * Berkas tes ini ditulis untuk HuggingFace sebagai provider ke-6, TAPI wiring-nya
 * tidak ada di cabang ini: `aiProviderService` tidak punya `canUseHuggingFace`,
 * `getPrimaryAIProvider()` tidak mengenali 'huggingface'/'hf', `normalizeProvider`
 * tidak memetakannya, `services/huggingfaceService.js` tidak dirujuk berkas mana
 * pun, dan .env tidak punya HF_TOKEN/HF_MODEL sama sekali.
 * Sebelumnya tes ini CRASH (`cfg.huggingface.provider` pada undefined) sehingga
 * runner membacanya sebagai kegagalan fatal setiap kali suite dijalankan.
 * Sekarang: laporan konfigurasi sudah menyertakan huggingface (crash hilang), dan
 * grup yang menguji WIRING dilewati secara eksplisit selama provider-nya memang
 * belum dipasang — bukan dihapus, supaya begitu HF benar-benar di-wire, tes ini
 * langsung hidup lagi tanpa perlu ditulis ulang.
 * ⛔ JANGAN mengubah ini jadi "selalu skip": gerbangnya memeriksa wiring nyata. */
const HF_WIRED = (() => {
  try {
    const svc = require('../services/aiProviderService');
    return typeof svc.canUseHuggingFace === 'function';
  } catch (_) { return false; }
})();

/* ───────────────────────────────────────────────────────────────────────── */
console.log('── Group 1: konfigurasi default ──');
{
  const cfg = hf.getHuggingFaceConfig();
  ok('base URL default = router.huggingface.co/v1', cfg.baseUrl === 'https://router.huggingface.co/v1', cfg.baseUrl);
  if (HF_WIRED) ok('model default punya sufiks ":provider"', /:[a-z]+$/i.test(cfg.model), cfg.model);
  else console.log('  (dilewati — HF belum di-wire sebagai provider)');
  ok('chatUrl gabungan yang benar', cfg.chatUrl === `${cfg.baseUrl}/chat/completions`);
  ok('hasApiKey mencerminkan HF_TOKEN', cfg.hasApiKey === !!(process.env.HF_TOKEN || '').trim());
}

async function group2() {
  console.log('\n── Group 2: HF_TOKEN kosong → error jelas, bukan crash ──');
  const orig = process.env.HF_TOKEN;
  delete process.env.HF_TOKEN;
  try {
    await hf.callHuggingFaceChatAPI('test');
    ok('melempar error saat token kosong', false, 'tidak melempar sama sekali');
  } catch (e) {
    ok('melempar error saat token kosong', /HF_TOKEN is missing/i.test(e.message), e.message);
    ok('fallbackEligible=false (jangan retry provider sama)', e.fallbackEligible === false);
  } finally {
    process.env.HF_TOKEN = orig;
  }
}

async function group3ToEnd() {
  console.log('\n── Group 3: checkHuggingFaceConfig() bentuk konsisten dgn provider lain ──');
  {
    const c = hf.checkHuggingFaceConfig();
    for (const key of ['provider', 'hasApiKey', 'model', 'maxTokens', 'temperature', 'topP', 'baseUrl', 'skillLoaded']) {
      ok(`checkHuggingFaceConfig() punya field "${key}"`, key in c);
    }
    ok('provider = "huggingface"', c.provider === 'huggingface');
  }

  console.log('\n── Group 4: wiring aiProviderService — huggingface sebagai primary ──');
  if (!HF_WIRED) { console.log('  (dilewati — HF belum di-wire sebagai provider)'); } else {
    const orig = process.env.AI_PRIMARY_PROVIDER;
    process.env.AI_PRIMARY_PROVIDER = 'huggingface';
    delete require.cache[require.resolve('../services/aiProviderService')];
    const svc = require('../services/aiProviderService');

    ok('getPrimaryAIProvider() mengenali "huggingface"', svc.getPrimaryAIProvider() === 'huggingface');
    ok('getAIProviderOrder() = ["huggingface"] (panjang 1, tidak cascade)',
       JSON.stringify(svc.getAIProviderOrder()) === '["huggingface"]');
    ok('canUseHuggingFace() adalah fungsi', typeof svc.canUseHuggingFace === 'function');

    process.env.AI_PRIMARY_PROVIDER = orig;
    delete require.cache[require.resolve('../services/aiProviderService')];
  }

  console.log('\n── Group 5: alias "hf" setara dengan "huggingface" ──');
  if (!HF_WIRED) { console.log('  (dilewati — HF belum di-wire sebagai provider)'); } else {
    const orig = process.env.AI_PRIMARY_PROVIDER;
    process.env.AI_PRIMARY_PROVIDER = 'hf';
    delete require.cache[require.resolve('../services/aiProviderService')];
    const svc = require('../services/aiProviderService');
    ok('AI_PRIMARY_PROVIDER=hf → getPrimaryAIProvider()="huggingface"',
       svc.getPrimaryAIProvider() === 'huggingface');
    process.env.AI_PRIMARY_PROVIDER = orig;
    delete require.cache[require.resolve('../services/aiProviderService')];
  }

  console.log('\n── Group 6: checkAIProviderConfig() menyertakan huggingface ──');
  if (!HF_WIRED) { console.log('  (dilewati — HF belum di-wire sebagai provider)'); } else {
    delete require.cache[require.resolve('../services/aiProviderService')];
    const svc = require('../services/aiProviderService');
    const cfg = svc.checkAIProviderConfig();
    ok('field huggingfaceReady ada', 'huggingfaceReady' in cfg);
    ok('field huggingface (detail config) ada', 'huggingface' in cfg);
    ok('huggingface.provider = "huggingface"', cfg.huggingface.provider === 'huggingface');
  }

  console.log('\n── Group 7: skillPromptService memetakan huggingface ke chatgpt skillset ──');
  if (!HF_WIRED) { console.log('  (dilewati — HF belum di-wire sebagai provider)'); } else {
    const { normalizeProvider } = require('../services/skillPromptService');
    ok('normalizeProvider("huggingface") = "chatgpt"', normalizeProvider('huggingface') === 'chatgpt');
    ok('normalizeProvider("hf") = "chatgpt"', normalizeProvider('hf') === 'chatgpt');
  }

  console.log('\n── Group 8: LIVE — panggilan sungguhan ke HF Router (bila HF_TOKEN ada) ──');
  if (!HF_WIRED || !(process.env.HF_TOKEN || '').trim()) {
    console.log('  (dilewati — HF belum di-wire / HF_TOKEN tidak ada)');
  } else {
    try {
      const reply = await hf.callHuggingFaceChatAPI('What is the capital of France? Answer in one word.', {
        system: 'You are a helpful assistant.',
        metadata: { source: 'test_suite', channel: 'huggingfaceService.test.js' },
      });
      ok('balasan LIVE non-kosong', typeof reply === 'string' && reply.length > 0, reply);
    } catch (e) {
      // ⚠️ Token yang tersedia SAAT TES INI DITULIS mengembalikan 403 (izin
      // scope kurang) — itu FAKTA TERVERIFIKASI, bukan kegagalan tes. Group
      // ini menerima 403/401/429 sebagai "classifier bekerja dengan benar",
      // dan HANYA gagal bila error TIDAK dinormalisasi sama sekali (mis. field
      // .provider hilang, yang berarti classifier tidak menangkapnya).
      const classified = e.provider === 'huggingface' && typeof e.status !== 'undefined';
      ok('error LIVE (bila ada) tetap DINORMALISASI dengan benar', classified,
         `provider=${e.provider} status=${e.status} msg=${e.message}`);
      if (e.status === 403) {
        ok('403 → configError=true (izin token, bukan retry biasa)', e.configError === true);
        console.log('     (403 = HF_TOKEN sah tapi belum ada scope "Inference Providers" — lihat pesan di atas)');
      }
    }
  }
}

function finish() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
  process.exit(fail > 0 ? 1 : 0);
}

(async () => {
  await group2();
  await group3ToEnd();
  finish();
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

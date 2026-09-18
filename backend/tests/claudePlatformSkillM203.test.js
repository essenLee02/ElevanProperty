/**
 * M203 (16 Sep 2026) — CLAUDE_SKILL_ID: Claude memakai skill dari Claude Platform,
 * .md lokal TIDAK dikirim. Dikunci: bentuk payload (container.skills + code_execution),
 * system prompt tanpa isi .md, guard model, ekstraksi teks sesudah tool result,
 * lanjutan pause_turn, dan perilaku lama tetap bila CLAUDE_SKILL_ID kosong.
 * Tidak ada panggilan API sungguhan (axios.post di-mock).
 */
require('dotenv').config();
process.env.CLAUDE_API_KEY = 'sk-ant-test-0000000000000000000000';
process.env.CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
process.env.CLAUDE_SKILL_ID = 'skill_01TESTSKILLID';
delete process.env.CLAUDE_SKILL_VERSION;
let pass = 0, fail = 0;
const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ✅ ${l}`); } else { fail++; console.log(`  ❌ ${l}${e ? ' — ' + e : ''}`); } };

const axios = require('axios');
const calls = [];
let responder = () => ({ data: { content: [{ type: 'text', text: 'Halo Kak' }], stop_reason: 'end_turn' } });
axios.post = async (url, payload, opts) => { calls.push({ url, payload, opts }); return responder(payload); };

(async () => {
  const svc = require('../services/claudeService');
  const { getProjectSkillInstruction } = require('../services/aiPromptBuilderService');
  const localSkill = getProjectSkillInstruction('claude');

  console.log('\n[1] Mode skill platform — bentuk payload');
  ok('claudeUsesPlatformSkill() true', svc.claudeUsesPlatformSkill());
  const r1 = await svc.callClaudeMessagesAPI('Halo', { system: localSkill, metadata: { source: 'test' } });
  const p1 = calls[0].payload;
  ok('balasan teks', r1 === 'Halo Kak');
  ok('container.skills[0] = custom + skill_id + version latest', p1.container?.skills?.[0]?.type === 'custom' && p1.container.skills[0].skill_id === 'skill_01TESTSKILLID' && p1.container.skills[0].version === 'latest');
  ok('tools = code_execution', p1.tools?.[0]?.type === 'code_execution_20250825' && p1.tools[0].name === 'code_execution');
  ok('system TIDAK memuat .md lokal (tidak ada "--- SKILL.md ---" / "PROJECT SKILL DOCUMENTATION")', !/--- SKILL\.md ---|PROJECT SKILL DOCUMENTATION|Four slots gate/i.test(p1.system));
  ok('system memerintahkan membaca skill dulu', /read SKILL\.md/i.test(p1.system));
  ok('system pendek (< 900 char)', String(p1.system).length < 900, String(p1.system).length);
  ok('timeout ≥ 120 detik pada mode skill', Number(calls[0].opts.timeout) >= 120000);
  ok('tidak ada header anthropic-beta (Skills sudah GA)', !calls[0].opts.headers['anthropic-beta']);

  console.log('\n[2] Ekstraksi teks & pause_turn');
  ok('teks SESUDAH tool result yang diambil', svc.extractClaudeText({ content: [
    { type: 'text', text: 'Let me read the skill first.' },
    { type: 'server_tool_use', id: 'x', name: 'code_execution', input: {} },
    { type: 'bash_code_execution_tool_result', tool_use_id: 'x', content: {} },
    { type: 'text', text: 'Halo Kak 😊 ada 2 rumah di Wiyung.' },
  ] }) === 'Halo Kak 😊 ada 2 rumah di Wiyung.');
  ok('tanpa tool result → semua teks (perilaku lama)', svc.extractClaudeText({ content: [{ type: 'text', text: 'A' }, { type: 'text', text: 'B' }] }) === 'A\nB');
  calls.length = 0;
  let hop = 0;
  responder = () => (hop++ === 0
    ? { data: { stop_reason: 'pause_turn', container: { id: 'cont_1' }, content: [{ type: 'server_tool_use', id: 'y', name: 'code_execution', input: {} }] } }
    : { data: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Lanjutan' }] } });
  const r2 = await svc.callClaudeMessagesAPI('Halo', {});
  ok('pause_turn dilanjutkan sekali, container id dibawa', r2 === 'Lanjutan' && calls.length === 2 && calls[1].payload.container.id === 'cont_1' && calls[1].payload.messages.length === 2);
  responder = () => ({ data: { content: [{ type: 'text', text: 'Halo Kak' }], stop_reason: 'end_turn' } });

  console.log('\n[3] Guard model & konfigurasi');
  process.env.CLAUDE_MODEL = 'claude-3-haiku';
  let err = null; try { await svc.callClaudeMessagesAPI('Halo', {}); } catch (e) { err = e; }
  ok('claude-3-haiku + skill → error jelas tanpa memanggil API', err && /tidak mendukung code execution/.test(err.message));
  process.env.CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
  const cfg = svc.checkClaudeConfig();
  ok('checkClaudeConfig melaporkan skillSource=claude_platform_skill', cfg.skillSource === 'claude_platform_skill' && cfg.skillId === 'skill_01TESTSKILLID');

  console.log('\n[4] CLAUDE_SKILL_ID kosong → perilaku lama (system = .md lokal)');
  delete process.env.CLAUDE_SKILL_ID;
  calls.length = 0;
  ok('claudeUsesPlatformSkill() false', !svc.claudeUsesPlatformSkill());
  await svc.generateClaudeChatbotReply({ id: 1, name: 'X' }, [], 'Halo', '');
  ok('system memuat .md lokal', /PROJECT SKILL DOCUMENTATION/.test(calls[0].payload.system) && !calls[0].payload.container && !calls[0].payload.tools);
  ok('checkClaudeConfig skillSource=local_md', svc.checkClaudeConfig().skillSource === 'local_md');

  console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

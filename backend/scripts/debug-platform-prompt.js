'use strict';
/**
 * debug-platform-prompt.js — mainkan beberapa giliran customer lewat pintu
 * masuk nyata dan tulis prompt yang DITERIMA platform AI ke logs/prompt-debug.txt.
 *
 *   node scripts/debug-platform-prompt.js "pesan 1" "pesan 2" ...
 *
 * Memanggil API provider sungguhan (berbayar). Sesi uji dibuat & dihapus sendiri.
 */
require('dotenv').config();
const path = require('path');
process.env.AI_PROMPT_DEBUG_FILE = process.env.AI_PROMPT_DEBUG_FILE || path.join(__dirname, '..', 'logs', 'prompt-debug.txt');
const AGENT = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
const PHONE = '6280000031099';

(async () => {
  const { ChatSession, ChatMessage } = require('../models');
  const svc = require('../services/whatsappAIService');
  const prs = require('../services/propertyRecommendationService');
  await prs.initLandmarkCache(); await prs.initCityCache(); await prs.initFacilityCache();
  const s = await ChatSession.create({ name: 'Dbg', normalizedName: 'dbg', phone: PHONE, normalizedPhone: PHONE, source: 'kirimi_whatsapp', lastMessageAt: new Date() });
  try {
    for (const msg of process.argv.slice(2)) {
      await ChatMessage.create({ chatSessionId: s.id, role: 'user', message: msg, channel: 'kirimi_whatsapp' });
      const r = await svc.generateWhatsAppAIReply({
        message: msg,
        session: { id: s.id, agentUserId: AGENT, agentName: 'Natasha', name: 'Dbg', normalizedPhone: PHONE, source: 'kirimi_whatsapp' },
        agentUserId: AGENT, agentName: 'Natasha',
      });
      await ChatMessage.create({ chatSessionId: s.id, role: 'ai', message: r.reply || '', channel: 'kirimi_whatsapp' });
      console.log(`\n### C: ${msg}\n### AI (${r.provider}): ${(r.reply || '').slice(0, 400)}`);
    }
    console.log(`\nprompt dump → ${process.env.AI_PROMPT_DEBUG_FILE}`);
  } finally {
    await ChatMessage.destroy({ where: { chatSessionId: s.id } });
    await ChatSession.destroy({ where: { id: s.id } });
  }
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

// node dbg_turn.js <logfile.md> <SessionKey> <turnIndex(1-based)>  → replay that turn through generatePrivateTerminalMassege
require('dotenv').config();
(async () => {
  const s = require('../services/propertyRecommendationService'); await s.initCityCache(); await s.initLandmarkCache(); await s.initFacilityCache();
  const fs = require('fs'); const [file, key, tStr] = process.argv.slice(2); const t = parseInt(tStr, 10);
  const md = fs.readFileSync(file, 'utf8'); const sec = md.split('\n## ' + key + ' ')[1].split('\n## ')[0];
  const parts = sec.split(/\n\*\*C\d+:\*\* /).slice(1); const hist = [];
  for (const q of parts) { const [cust, rest] = q.split(/\n\n\*\*AI\*\*[^\n]*\n\n/); const ai = (rest || '').split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^> ?/, '')).join('\n'); hist.push({ role: 'customer', message: cust.trim() }); hist.push({ role: 'ai', message: ai }); }
  const history = hist.slice(0, (t - 1) * 2); const userMessage = hist[(t - 1) * 2].message;
  console.log('MSG:', userMessage);
  const { generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');
  const r = await generatePrivateTerminalMassege({ session: { id: 0 }, history, userMessage, agentName: 'Natasha', agentUserId: process.env.TEST_AGENT_USER_ID || 'NA40D8N007', recommendationContext: null, externalError: new Error('x') });
  console.log('PROVIDER:', r.provider, '\nREPLY:', String(r.reply).slice(0, 300));
  process.exit(0);
})();

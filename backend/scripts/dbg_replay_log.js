// node scripts/dbg_replay_log.js <logs/sim-*.md> <K5> [turnIndex]
// Replay satu sesi dari berkas log simulasi: riwayat = transkrip log sampai giliran ke-N,
// lalu pesan customer ke-N diproses ulang lewat generatePrivateTerminalMassege.
require('dotenv').config();
const fs = require('fs');
(async () => {
  const [file, code, nStr] = process.argv.slice(2);
  const md = fs.readFileSync(file, 'utf8');
  const sec = md.split(/^## /m).find((s) => s.startsWith(code));
  const turns = [];
  const re = /\*\*C(\d+):\*\* (.*)\n\n\*\*AI\*\*[^\n]*\n\n((?:> ?.*\n?)+)/g;
  let m;
  while ((m = re.exec(sec))) turns.push({ c: m[2], ai: m[3].split('\n').map((l) => l.replace(/^> ?/, '')).join('\n').trim() });
  const n = Number(nStr || turns.length);
  const history = [];
  for (let i = 0; i < n - 1; i++) history.push({ role: 'customer', message: turns[i].c }, { role: 'ai', message: turns[i].ai });
  const s = require('../services/propertyRecommendationService'); await s.initCityCache(); await s.initLandmarkCache(); await s.initFacilityCache();
  const { generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');
  const r = await generatePrivateTerminalMassege({ session: { id: 0 }, history, userMessage: turns[n - 1].c, agentName: 'Natasha', agentUserId: process.env.TEST_AGENT_USER_ID || 'NA40D8N007', recommendationContext: null, externalError: new Error('x') });
  console.log('\n>> C' + n + ':', turns[n - 1].c, '\n<< [' + (r.provider || 'private_agent') + ']', String(r.reply));
  process.exit(0);
})();

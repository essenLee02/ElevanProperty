// node scripts/dbg_seq.js "msg1" "msg2" ... → jalankan berurutan lewat generatePrivateTerminalMassege
require('dotenv').config();
(async () => {
  const s = require('../services/propertyRecommendationService'); await s.initCityCache(); await s.initLandmarkCache(); await s.initFacilityCache();
  const { generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');
  const history = [];
  for (const m of process.argv.slice(2)) {
    const r = await generatePrivateTerminalMassege({ session: { id: 0 }, history, userMessage: m, agentName: 'Natasha', agentUserId: process.env.TEST_AGENT_USER_ID || 'NA40D8N007', recommendationContext: null, externalError: new Error('x') });
    console.log('\n>> C:', m, '\n<< [' + (r.provider || 'private_agent') + ']', String(r.reply).slice(0, 220).replace(/\n/g, ' | '));
    history.push({ role: 'customer', message: m }, { role: 'ai', message: String(r.reply) });
  }
  process.exit(0);
})();

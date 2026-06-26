const express    = require('express');
const router     = express.Router();
const rateLimit  = require('express-rate-limit');

/* ══════════════════════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════════════════════ */

// Contact form: 5 req / 15 menit
const contactLimiter = rateLimit({
  windowMs       : 15 * 60 * 1000,
  max            : 5,
  message        : { success: false, message: 'Terlalu banyak pengiriman. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders  : false,
});

// Webhook endpoints: 120 req / menit (cukup untuk volume normal, blok abuse)
const webhookLimiter = rateLimit({
  windowMs       : 60 * 1000,
  max            : 120,
  message        : { success: false, message: 'Rate limit: terlalu banyak request ke webhook.' },
  standardHeaders: true,
  legacyHeaders  : false,
  skip           : () => false,   // Selalu aktif
});

// Log endpoint: 60 req / menit
const logLimiter = rateLimit({
  windowMs       : 60 * 1000,
  max            : 60,
  message        : { success: false, message: 'Rate limit pada log endpoint.' },
  standardHeaders: true,
  legacyHeaders  : false,
});

/* ══════════════════════════════════════════════════════════════════════════════
   CONTROLLERS
══════════════════════════════════════════════════════════════════════════════ */

const homeController             = require('../controllers/homeController');
const aboutController            = require('../controllers/aboutController');
const contactController          = require('../controllers/contactController');
const chatbotController          = require('../controllers/chatbotController');
const chatbotPrivateController   = require('../controllers/chatbotPrivateController');
const fonnteWebhookController    = require('../controllers/fonnteWebhookController');
const logController              = require('../controllers/logController');
const rumah123Controller         = require('../controllers/rumah123Controller');
const whatsappInboundController  = require('../controllers/whatsappInboundController');
const timelinesAIChatController  = require('../controllers/timelinesAIChatController');
const fonnteChatController       = require('../controllers/fonnteChatController');
const kirimiChatController       = require('../controllers/kirimiChatController');

// Auth controllers
const registerController         = require('../controllers/registerController');
const loginController            = require('../controllers/loginController');
const refreshTokenController     = require('../controllers/refreshTokenController');
const profileController          = require('../controllers/profileController');

// Master data controllers
const facilityMasterController   = require('../controllers/facilityMasterController');
const countryMasterController    = require('../controllers/countryMasterController');
const provinceMasterController   = require('../controllers/provinceMasterController');
const cityMasterController       = require('../controllers/cityMasterController');

const { verifyToken, requirePrivilege } = require('../middleware/verifyToken');

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC ROUTES — Tidak butuh autentikasi
══════════════════════════════════════════════════════════════════════════════ */

router.get('/home',   homeController.index);
router.get('/about',  aboutController.index);

router.post('/contact',                    contactLimiter, contactController.submitContact);
router.get('/contact/google-sheets-status',                contactController.googleSheetsStatus);
router.get('/contact/ai-whatsapp-status',                  contactController.aiWhatsappStatus);

// Floating Website Chatbot (public — dipakai tanpa login)
router.get('/chatbot/config',                              chatbotController.getConfig);
router.get('/chatbot/ai-provider-status',                  chatbotController.aiProviderStatus);
router.get('/chatbot/skill-status',                        chatbotController.skillStatus);
router.get('/chatbot/private-status',                      chatbotPrivateController.privateAgentStatus);
router.post('/chatbot/private-message',                    chatbotPrivateController.sendPrivateMessage);
router.post('/chatbot/message',                            chatbotController.sendMessage);

/* ══════════════════════════════════════════════════════════════════════════════
   AUTH ROUTES
══════════════════════════════════════════════════════════════════════════════ */

router.post('/auth/register',   registerController.insertDataAgent);
router.get('/auth/users-count', registerController.countUsers);
router.post('/auth/login',      loginController.loginUser);
router.get('/auth/refresh',     refreshTokenController.refreshTokenController);
router.delete('/auth/logout',   loginController.logoutUser);
router.get('/auth/me',          loginController.getCurrentUser);

// Test endpoint — butuh login
router.get('/auth/protected-test', verifyToken, (req, res) => {
  return res.json({
    status   : 200,
    data     : { response: req.user, message: 'Anda terautentikasi' },
    isSuccess: 1
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   PROFILE ROUTES — Butuh login (verifyToken)
══════════════════════════════════════════════════════════════════════════════ */

router.get('/profile/me',            verifyToken, profileController.getCurrentProfile);
router.put('/profile/update-agent',  verifyToken, profileController.updateDataAgent);

/* ══════════════════════════════════════════════════════════════════════════════
   WEBHOOK ROUTES — Public tapi rate-limited
   (Dikirim dari platform eksternal: Fonnte, Kirimi, TimelinesAI)
══════════════════════════════════════════════════════════════════════════════ */

// Fonnte legacy webhook
router.post('/fonnte/webhook',       webhookLimiter, fonnteWebhookController.handleWebhook);
router.post('/whatsapp/webhook',     webhookLimiter, whatsappInboundController.handleInboundMessage);
router.get('/whatsapp/messages',                     whatsappInboundController.getInboundMessages);
router.get('/whatsapp/messages/:id',                 whatsappInboundController.getMessageDetail);
router.get('/whatsapp/agents/status',                whatsappInboundController.getAgentsStatus);

// Fonnte multi-agent webhook (public)
router.post('/fonnte-chat/webhook',      webhookLimiter, fonnteChatController.handleInboundMessage);
router.post('/fonnte-chat/chaining',     webhookLimiter, fonnteChatController.handleChainingWebhook);
router.post('/fonnte-chat/webhook-raw',  webhookLimiter, fonnteChatController.webhookRawCatcher);

// TimelinesAI webhook (public)
router.post('/timelinesai/webhook',      webhookLimiter, timelinesAIChatController.handleInboundMessage);
router.post('/timelinesai/webhook-raw',  webhookLimiter, timelinesAIChatController.webhookRawCatcher);

// Kirimi webhook (public)
router.post('/kirimi/webhook',           webhookLimiter, kirimiChatController.handleInboundMessage);
router.post('/kirimi/webhook-raw',       webhookLimiter, kirimiChatController.webhookRawCatcher);

/* ══════════════════════════════════════════════════════════════════════════════
   WHATSAPP ADMIN ROUTES — Butuh login (verifyToken)
   Endpoint simulate, debug, agent list hanya untuk user terautentikasi.
══════════════════════════════════════════════════════════════════════════════ */

// Fonnte admin endpoints
router.post('/fonnte-chat/simulate',              verifyToken, fonnteChatController.simulateInboundMessage);
router.get('/fonnte-chat/debug-info',             verifyToken, fonnteChatController.getDebugInfo);
router.get('/fonnte-chat/agents',                 verifyToken, fonnteChatController.getAgentsWithFonnte);
router.get('/fonnte-chat/agent-chats/:agentName', verifyToken, fonnteChatController.getAgentChats);
router.get('/fonnte-chat/chat-history/:sessionId',verifyToken, fonnteChatController.getChatHistory);
router.get('/fonnte-chat/status',                 verifyToken, fonnteChatController.getFonnteStatus);
router.get('/fonnte-chat/poller-status',          verifyToken, fonnteChatController.getPollerStatus);
router.post('/fonnte-chat/poller-start',          verifyToken, fonnteChatController.startPoller);
router.post('/fonnte-chat/poller-stop',           verifyToken, fonnteChatController.stopPoller);
router.get('/fonnte-chat/check-fonnte-api',       verifyToken, fonnteChatController.checkFonnteApi);

// TimelinesAI admin endpoints
router.post('/timelinesai/simulate',              verifyToken, timelinesAIChatController.simulateInboundMessage);
router.get('/timelinesai/debug-info',             verifyToken, timelinesAIChatController.getDebugInfo);
router.get('/timelinesai/agents',                 verifyToken, timelinesAIChatController.getRegisteredAgents);
router.get('/timelinesai/agent-chats/:agentName', verifyToken, timelinesAIChatController.getAgentChats);
router.get('/timelinesai/chat-history/:sessionId',verifyToken, timelinesAIChatController.getChatHistory);
router.get('/timelinesai/status',                 verifyToken, timelinesAIChatController.getStatus);
router.get('/timelinesai/check-api',              verifyToken, timelinesAIChatController.checkTimelinesApi);

// Kirimi admin endpoints (butuh login)
router.post('/kirimi/simulate',                        verifyToken, kirimiChatController.simulateInboundMessage);
router.get('/kirimi/debug-info',                       verifyToken, kirimiChatController.getDebugInfo);
router.get('/kirimi/agents',                           verifyToken, kirimiChatController.getAgentsWithKirimi);
router.get('/kirimi/agent-chats/:agentName',           verifyToken, kirimiChatController.getAgentChats);
router.get('/kirimi/chat-history/:sessionId',          verifyToken, kirimiChatController.getChatHistory);
router.get('/kirimi/status',                           verifyToken, kirimiChatController.getKirimiStatus);
router.get('/kirimi/check-api',                        verifyToken, kirimiChatController.checkKirimiApi);

/* ══════════════════════════════════════════════════════════════════════════════
   UTILITY ROUTES
══════════════════════════════════════════════════════════════════════════════ */

// Logger (rate-limited, tidak butuh login — dipakai frontend untuk event tracking)
router.post('/log',               logLimiter, logController.insertLog);

// Rumah123 (Apify Scraper)
router.get('/rumah123/status',                             rumah123Controller.status);
router.get('/rumah123/search',                             rumah123Controller.search);
router.post('/rumah123/search',                            rumah123Controller.searchPost);
router.get('/rumah123/dataset/:datasetId',                 rumah123Controller.getDataset);
router.get('/rumah123/cache-status',                       rumah123Controller.cacheStatus);
router.post('/rumah123/warmup',    verifyToken,            rumah123Controller.triggerWarmup);

// Debug chatbot (development only)
router.get('/chatbot/debug/test-rumah123', verifyToken,    chatbotPrivateController.debugTestRumah123);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — FACILITY (Butuh login)
══════════════════════════════════════════════════════════════════════════════ */

router.get('/facility/list',                        verifyToken, facilityMasterController.showDataFacility);
router.get('/facility/detail/:facility_id',         verifyToken, facilityMasterController.getDetailFacility);
router.post('/facility/insert',                     verifyToken, facilityMasterController.insertDataFacility);
router.put('/facility/update/:facility_id',         verifyToken, facilityMasterController.updateDataFacility);
router.patch('/facility/toggle-status/:facility_id',verifyToken, facilityMasterController.toggleStatusFacility);
router.delete('/facility/delete/:facility_id',      verifyToken, facilityMasterController.deleteFacility);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — COUNTRY (Butuh login)
══════════════════════════════════════════════════════════════════════════════ */

router.get('/country/options',                      verifyToken, countryMasterController.getCountryOptions);
router.get('/country/list',                         verifyToken, countryMasterController.showDataCountry);
router.get('/country/detail/:country_id',           verifyToken, countryMasterController.getDetailCountry);
router.post('/country/insert',                      verifyToken, countryMasterController.insertDataCountry);
router.put('/country/update/:country_id',           verifyToken, countryMasterController.updateDataCountry);
router.patch('/country/toggle-status/:country_id',  verifyToken, countryMasterController.toggleStatusCountry);
router.delete('/country/delete/:country_id',        verifyToken, countryMasterController.deleteCountry);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — PROVINCE (Butuh login)
══════════════════════════════════════════════════════════════════════════════ */

router.get('/province/options',                     verifyToken, provinceMasterController.getProvinceOptions);
router.get('/province/list',                        verifyToken, provinceMasterController.showDataProvince);
router.get('/province/detail/:province_id',         verifyToken, provinceMasterController.getDetailProvince);
router.post('/province/insert',                     verifyToken, provinceMasterController.insertDataProvince);
router.put('/province/update/:province_id',         verifyToken, provinceMasterController.updateDataProvince);
router.patch('/province/toggle-status/:province_id',verifyToken, provinceMasterController.toggleStatusProvince);
router.delete('/province/delete/:province_id',      verifyToken, provinceMasterController.deleteProvince);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — CITY (Butuh login)
══════════════════════════════════════════════════════════════════════════════ */

router.get('/city/list',                            verifyToken, cityMasterController.showDataCity);
router.get('/city/detail/:city_id',                 verifyToken, cityMasterController.getDetailCity);
router.post('/city/insert',                         verifyToken, cityMasterController.insertDataCity);
router.put('/city/update/:city_id',                 verifyToken, cityMasterController.updateDataCity);
router.patch('/city/toggle-status/:city_id',        verifyToken, cityMasterController.toggleStatusCity);
router.delete('/city/delete/:city_id',              verifyToken, cityMasterController.deleteCity);

module.exports = router;

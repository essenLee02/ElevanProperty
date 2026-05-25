const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { success: false, message: 'Terlalu banyak pengiriman. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const homeController = require('../controllers/homeController');
const aboutController = require('../controllers/aboutController');
const contactController = require('../controllers/contactController');
const chatbotController = require('../controllers/chatbotController');
const chatbotPrivateController = require('../controllers/chatbotPrivateController');
const fonnteWebhookController = require('../controllers/fonnteWebhookController');
const logController = require('../controllers/logController');
const rumah123Controller = require('../controllers/rumah123Controller');
const whatsappInboundController = require('../controllers/whatsappInboundController');
const watiChatController = require('../controllers/watiChatController');

// Auth controllers (Login & Register Users)
const registerController = require('../controllers/registerController');
const loginController = require('../controllers/loginController');
const refreshTokenController = require('../controllers/refreshTokenController');
const profileController = require('../controllers/profileController');
const { verifyToken } = require('../middleware/verifyToken');

// Module Home
router.get('/home', homeController.index);

// Module About Us
router.get('/about', aboutController.index);

// Module Contact
router.post('/contact', contactLimiter, contactController.submitContact);
router.get('/contact/google-sheets-status', contactController.googleSheetsStatus);
router.get('/contact/ai-whatsapp-status', contactController.aiWhatsappStatus);

// Floating Website Chatbot
router.get('/chatbot/config', chatbotController.getConfig);
router.get('/chatbot/ai-provider-status', chatbotController.aiProviderStatus);
router.get('/chatbot/skill-status', chatbotController.skillStatus);
router.get('/chatbot/private-status', chatbotPrivateController.privateAgentStatus);
router.post('/chatbot/private-message', chatbotPrivateController.sendPrivateMessage);
router.post('/chatbot/message', chatbotController.sendMessage);

// Debug endpoints
router.get('/chatbot/debug/test-rumah123', chatbotPrivateController.debugTestRumah123);

// Fonnte WhatsApp Webhook
router.post('/fonnte/webhook', fonnteWebhookController.handleWebhook);

// WhatsApp Inbound Messages (Fonnte Webhook Handler)
router.post('/whatsapp/webhook', whatsappInboundController.handleInboundMessage);
router.get('/whatsapp/messages', whatsappInboundController.getInboundMessages);
router.get('/whatsapp/messages/:id', whatsappInboundController.getMessageDetail);
router.get('/whatsapp/agents/status', whatsappInboundController.getAgentsStatus);

// WATI WhatsApp Chat Controller (Multi-Agent)
router.post('/wati/webhook', watiChatController.handleInboundMessage);
router.get('/wati/agent-chats/:agentName', watiChatController.getAgentChats);
router.get('/wati/chat-history/:sessionId', watiChatController.getChatHistory);
router.get('/wati/agents/list', watiChatController.getRegisteredAgents);
router.get('/wati/status', watiChatController.getWatiStatus);

// =============================================================
// Auth Routes (Login & Register Users)
// =============================================================
// Register & Login (open access)
router.post('/auth/register', registerController.insertDataAgent);
router.get('/auth/users-count', registerController.countUsers);
router.post('/auth/login', loginController.loginUser);

// Refresh token (rely on cookie HttpOnly)
router.get('/auth/refresh', refreshTokenController.refreshTokenController);

// Logout & Get current user (open, rely on cookie)
router.delete('/auth/logout', loginController.logoutUser);
router.get('/auth/me', loginController.getCurrentUser);

// Profile routes (requires authentication)
router.get('/profile/me', profileController.getCurrentProfile);
router.put('/profile/update-agent', profileController.updateDataAgent);

// Example protected endpoint pakai verifyToken (boleh dihapus kalau tidak dipakai)
router.get('/auth/protected-test', verifyToken, (req, res) => {
  return res.json({
    status: 200,
    data: { response: req.user, message: 'Anda terautentikasi' },
    isSuccess: 1
  });
});

// Module Logger
router.post('/log', logController.saveLog);

// Module Rumah123 (Apify Scraper)
router.get('/rumah123/status', rumah123Controller.status);
router.get('/rumah123/search', rumah123Controller.search);
router.post('/rumah123/search', rumah123Controller.searchPost);
router.get('/rumah123/dataset/:datasetId', rumah123Controller.getDataset);
router.get('/rumah123/cache-status', rumah123Controller.cacheStatus);
router.post('/rumah123/warmup', rumah123Controller.triggerWarmup);

module.exports = router;

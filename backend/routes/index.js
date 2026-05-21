const express = require('express');
const router = express.Router();

const homeController = require('../controllers/homeController');
const aboutController = require('../controllers/aboutController');
const contactController = require('../controllers/contactController');
const chatbotController = require('../controllers/chatbotController');
const chatbotPrivateController = require('../controllers/chatbotPrivateController');
const fonnteWebhookController = require('../controllers/fonnteWebhookController');
const logController = require('../controllers/logController');
const rumah123Controller = require('../controllers/rumah123Controller');

// Module Home
router.get('/home', homeController.index);

// Module About Us
router.get('/about', aboutController.index);

// Module Contact
router.post('/contact', contactController.submitContact);
router.get('/contact/google-sheets-status', contactController.googleSheetsStatus);
router.get('/contact/ai-whatsapp-status', contactController.aiWhatsappStatus);

// Floating Website Chatbot
router.get('/chatbot/config', chatbotController.getConfig);
router.get('/chatbot/ai-provider-status', chatbotController.aiProviderStatus);
router.get('/chatbot/skill-status', chatbotController.skillStatus);
router.get('/chatbot/private-status', chatbotPrivateController.privateAgentStatus);
router.post('/chatbot/private-message', chatbotPrivateController.sendPrivateMessage);
router.post('/chatbot/message', chatbotController.sendMessage);

// Fonnte WhatsApp Webhook
router.post('/fonnte/webhook', fonnteWebhookController.handleWebhook);

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

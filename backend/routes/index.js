const express = require('express');
const router = express.Router();

const homeController = require('../controllers/homeController');
const aboutController = require('../controllers/aboutController');
const contactController = require('../controllers/contactController');
const chatbotController = require('../controllers/chatbotController');
const fonnteWebhookController = require('../controllers/fonnteWebhookController');
const logController = require('../controllers/logController');

// Module Home
router.get('/home', homeController.index);

// Module About Us
router.get('/about', aboutController.index);

// Module Contact
router.post('/contact', contactController.submitContact);
router.get('/contact/google-sheets-status', contactController.googleSheetsStatus);
router.get('/contact/ai-whatsapp-status', contactController.aiWhatsappStatus);

// Floating Website Chatbot
router.post('/chatbot/message', chatbotController.sendMessage);

// Fonnte WhatsApp Webhook
router.post('/fonnte/webhook', fonnteWebhookController.handleWebhook);

// Module Logger
router.post('/log', logController.saveLog);

module.exports = router;

# 03 — Backend Structure and Routes

## Recommended Backend Structure

```text
backend/
├─ config/
├─ controllers/
├─ models/
├─ routes/
├─ services/
├─ utils/
├─ .env
├─ .env.example
├─ google-service-account.json
├─ package.json
└─ server.js
```

## Required Routes

```text
GET  /api/home
GET  /api/about
POST /api/contact
GET  /api/contact/google-sheets-status
POST /api/log

GET  /api/chatbot/config
POST /api/chatbot/message
GET  /api/chatbot/property-json-status

POST /api/fonnte/webhook
```

## Controller Responsibilities

### `contactController.js`

- validate Contact Form;
- save contact to database;
- save lead to Google Sheets;
- optionally trigger AI reply and WhatsApp.

### `chatbotController.js`

- return chatbot config;
- receive chatbot messages;
- validate name, phone, location, and message;
- load session/history;
- load and filter JSON property data;
- call ChatGPT;
- save user and assistant messages;
- return response to frontend.

### `fonnteWebhookController.js`

- receive WhatsApp webhook;
- process incoming WhatsApp messages;
- call ChatGPT;
- send response through Fonnte.

## Service Responsibilities

```text
openaiService.js       → ChatGPT API calls
fonnteService.js       → WhatsApp send/webhook logic
googleSheetsService.js → Google Sheets append/status
sessionService.js      → ChatSession and ChatMessage handling
validationService.js   → request validation
skillPromptService.js  → prompt instruction assembly
propertyRecommendationService.js → JSON property filtering
```

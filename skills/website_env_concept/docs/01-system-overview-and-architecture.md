# 01. System Overview & Architecture

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express, port 5005 |
| Frontend | Vue 3 + Vite, port 5173 |
| Database | MySQL (MariaDB 10.4) via Sequelize v6 ORM |
| Primary AI | ChatGPT (OpenAI gpt-4o-mini) |
| Fallback AI | Claude (Anthropic claude-haiku-4-5-20251001) |
| Last-resort AI | chatbotPrivateController (local, no API needed) |
| WhatsApp | Fonnte (send + receive webhook) |
| Live property data | Rumah123 via Apify scraper |
| Static property data | JSON flat file (36 provinces) |

## Directory Structure

```
Elevan_Property/
├── backend/
│   ├── controllers/         ← OOP class-based route handlers
│   ├── services/            ← Business logic (AI, WhatsApp, DB, property)
│   ├── models/              ← Sequelize models (MySQL tables)
│   ├── middleware/          ← verifyToken.js (JWT auth)
│   ├── routes/index.js      ← All API route definitions
│   ├── utils/               ← safeLog, authLogger, httpStatus, responseFormat
│   └── server.js            ← Express entry point, CORS, Sequelize sync
├── frontend/
│   ├── src/
│   │   ├── views/           ← HomeView, AboutView, ContactView, LoginView, RegisterView, ProfileView
│   │   ├── components/      ← FloatingChatbot.vue
│   │   ├── services/        ← api.js, authApi.js, chatbotApi.js
│   │   └── router/index.js  ← Vue Router with auth guards
│   └── public/
│       └── json_data/       ← indonesia_property_36_provinces_flat.json
└── skills/
    ├── chat_gpt_responds/   ← Prompt skill .md files for ChatGPT
    ├── claude_responds/     ← Prompt skill .md files for Claude
    └── website_env_concept/ ← System documentation (this folder)
```

## Data Flows

### Website Chatbot
```
User (browser)
  → POST /api/chatbot/message { name, phone, location, message, propertyContext }
  → ChatbotController.sendMessage()
    → findOrCreateSession(name, phone, location)
    → getConversationHistory(sessionId, 12 messages)
    → buildRecommendationContextForLLM(message, history)  ← JSON catalog
    → getRumah123Listings(filters)                         ← live data (if ON)
    → generateChatbotReplyWithProviderFallback(...)         ← ChatGPT → Claude → Private
    → saveAssistantMessage(sessionId, reply)
  ← { reply, sessionId, aiProvider, fallbackUsed, ... }
```

### Contact Form
```
User fills form
  → POST /api/contact { name, phone, email, subject, message }
  → ContactController.submitContact()
    → validateContactForm()
    → Contact.create()                            ← save to MySQL
    → appendContactRow() [non-blocking]           ← Google Sheets
    → generateContactReplyWithProviderFallback()  ← ChatGPT → Claude → Private
    → sendWhatsAppMessage(phone, aiReply)          ← Fonnte API
  ← { success: true, ... }
```

### WhatsApp Inbound (Agent Numbers)
```
Customer → Agent's WA number
  → Fonnte webhook → POST /api/whatsapp/webhook
  → WhatsAppInboundController.handleInboundMessage()
    → findAgent(agentPhone)        ← match 5 known agents
    → WhatsAppInbound.create()     ← save to MySQL
  ← { success: true, recordId }
```

### Auth Flow
```
Register: POST /api/auth/register → bcrypt hash → User.create
Login:    POST /api/auth/login → bcrypt.compare → JWT sign → cookie (refresh) + JSON (access)
Refresh:  GET  /api/auth/refresh → read cookie → verify → new access token
Logout:   DELETE /api/auth/logout → clear DB refresh_token + clear cookie
```

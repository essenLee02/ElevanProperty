# 01. System Overview & Architecture

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express, port 5005 |
| Frontend | Vue 3 + Vite, port 5173 |
| Database | MySQL (MariaDB 10.4) via Sequelize v6 ORM |
| Primary AI | ChatGPT (OpenAI gpt-4o-mini) |
| Fallback AI | Claude (Anthropic claude-haiku-4-5-20251001) |
| Last-resort AI | chatbotPrivateController (local, no external API) |
| WhatsApp (primary) | Fonnte — multi-agent, each agent has own token |
| WhatsApp (alt) | ChakraHQ (chakraHQController — Meta WhatsApp Cloud format) |
| WhatsApp (alt) | TimelinesAI (timelinesAIChatController) |
| Live property data | Rumah123 via Apify scraper |
| Static property data | JSON flat file (`backend/asset/json_data/`) |
| Google Sheets | Contact form logging (non-blocking) |

## Directory Structure

```
Elevan_Property/
├── backend/
│   ├── controllers/
│   │   ├── aboutController.js
│   │   ├── chatbotController.js          ← Website floating chatbot
│   │   ├── chatbotPrivateController.js   ← Private agent (OOP, 4 classes + WhatsApp classes)
│   │   ├── contactController.js
│   │   ├── chakraHQController.js         ← ChakraHQ multi-agent webhook (Meta WA Cloud format)
│   │   ├── facilityMasterController.js   ← Facility CRUD (protected)
│   │   ├── fonnteChatController.js       ← Fonnte multi-agent webhook (MAIN WA handler)
│   │   ├── fonnteWebhookController.js    ← Legacy Fonnte webhook
│   │   ├── homeController.js
│   │   ├── logController.js
│   │   ├── loginController.js
│   │   ├── profileController.js
│   │   ├── refreshTokenController.js
│   │   ├── registerController.js
│   │   ├── rumah123Controller.js
│   │   ├── timelinesAIChatController.js  ← TimelinesAI multi-agent webhook
│   │   ├── watiChatController.js         ← WATI multi-agent webhook (legacy)
│   │   ├── dialogChatController.js       ← 360dialog webhook (legacy, off terminal routing)
│   │   └── whatsappInboundController.js  ← Legacy WA inbound (log-only)
│   ├── services/
│   │   ├── aiPromptBuilderService.js     ← Q1-Q12 extraction + WhatsApp prompt builder
│   │   ├── aiProviderService.js          ← ChatGPT → Claude fallback routing
│   │   ├── apifyService.js               ← Rumah123 via Apify
│   │   ├── claudeService.js              ← Raw axios Claude calls
│   │   ├── fonnteService.js              ← Fonnte send API (single global token)
│   │   ├── googleSheetsService.js        ← Contact form → Sheets
│   │   ├── openaiService.js              ← ChatGPT calls
│   │   ├── propertyRecommendationService.js ← Filter JSON catalog for LLM
│   │   ├── rumah123ContextService.js     ← Live listings via Apify
│   │   ├── sessionService.js             ← Session/history CRUD
│   │   ├── skillPromptService.js         ← Load .md skill files at runtime
│   │   ├── validationService.js          ← Input validation helpers
│   │   ├── watiService.js                ← WATI send API
│   │   └── whatsappAIService.js          ← Unified AI reply (all 3 WA platforms)
│   ├── models/
│   │   ├── ChatMessage.js
│   │   ├── ChatSession.js
│   │   ├── Contact.js
│   │   ├── Facility.js                   ← Facility master data
│   │   ├── Log.js
│   │   ├── Property.js
│   │   ├── User.js                       ← Has fonnte_token + dialog360_token columns
│   │   ├── WhatsAppInbound.js            ← Legacy inbound log table
│   │   └── index.js
│   ├── middleware/
│   │   └── verifyToken.js                ← JWT auth + requirePrivilege
│   ├── routes/index.js                   ← All routes + rate limiters
│   ├── utils/
│   │   ├── authLogger.js                 ← Auth event boxes (loginSuccess, etc.)
│   │   ├── httpStatus.js                 ← HTTP status constants from .env
│   │   ├── normalizeName.js
│   │   ├── normalizePhone.js
│   │   ├── propertyKeywordFilter.js      ← hasPropertyKeyword + isPropertyContextContinuation
│   │   ├── responseFormat.js             ← sendSuccess / sendError wrappers
│   │   ├── responseFormatter.js
│   │   ├── safeLog.js                    ← Structured JSON logging
│   │   ├── terminalSwitch.js             ← MASSEGE_TERMINAL env control
│   │   ├── whatsappPropertyContext.js    ← Rumah123 → flat JSON fallback
│   │   └── whatsappUtils.js              ← sanitizeLog, maskPhone, maskName
│   ├── asset/
│   │   └── json_data/
│   │       └── indonesia_property_36_provinces_flat.json
│   ├── scripts/sync-db.js
│   └── server.js                         ← Express entry, CORS, Sequelize sync
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   │   ├── HomeView.vue              ← Landing page, FloatingChatbot
│   │   │   ├── AboutView.vue
│   │   │   ├── ContactView.vue
│   │   │   ├── Rumah123View.vue          ← Live property search
│   │   │   ├── LoginView.vue
│   │   │   ├── RegisterView.vue
│   │   │   ├── ProfileView.vue           ← Auth required
│   │   │   ├── FacilityListView.vue      ← Facility browse (auth required)
│   │   │   └── FacilityMasterView.vue    ← Facility CRUD admin (auth required)
│   │   ├── components/
│   │   │   ├── FloatingChatbot.vue       ← Main chatbot widget (~950 lines, XSS-safe)
│   │   │   ├── Navbar.vue
│   │   │   ├── PortfolioCard.vue
│   │   │   └── PropertyFilter.vue
│   │   ├── services/
│   │   │   ├── api.js                    ← Axios instance (interceptors, auto-refresh)
│   │   │   ├── authApi.js                ← Token memory management
│   │   │   ├── chatbotApi.js
│   │   │   ├── contactApi.js
│   │   │   ├── facilityApi.js            ← Facility CRUD API calls
│   │   │   ├── profileApi.js
│   │   │   ├── aboutApi.js
│   │   │   └── rumah123Api.js
│   │   └── router/index.js               ← Vue Router with auth guards
│   └── public/
└── skills/
    ├── chat_gpt_responds/                ← Prompt skill .md files for ChatGPT
    ├── claude_responds/                  ← Prompt skill .md files for Claude
    └── website_env_concept/              ← System documentation (this folder)
```

## Data Flows

### Website Chatbot
```
User (browser)
  → POST /api/chatbot/message { name, phone, location, message, propertyContext }
  → ChatbotController.sendMessage()
    → findOrCreateSession(name, phone, location)
    → getConversationHistory(sessionId, 12 messages)
    → buildRecommendationContextForLLM(message, history)   ← JSON catalog
    → getRumah123Listings(filters)                          ← live data (if ON)
    → generateChatbotReplyWithProviderFallback(...)          ← ChatGPT → Claude → Private
    → saveAssistantMessage(sessionId, reply)
  ← { reply, sessionId, aiProvider, fallbackUsed, ... }
```

### Fonnte Multi-Agent WhatsApp (MAIN)
```
Customer → Agent's WhatsApp number
  → Fonnte webhook → POST /api/fonnte-chat/webhook
  → fonnteChatController.handleInboundMessage()
    → detectEventType(body)            ← 'incoming' / 'message_status' / 'send'
    → _isAlreadyProcessed(messageId)   ← dedup cache (10-min TTL)
    → findAgentByDevice(devicePhone)   ← match device phone → user in DB
    → hasPropertyKeyword(msg) || isPropertyContextContinuation(msg, history)
    → getConversationHistory(sessionId)
    → generateWhatsAppAIReply(...)     ← whatsappAIService
    → saveAssistantMessage(...)
    → sendViaFonnte(customer, reply, agent.fonnte_token)
```

### ChakraHQ / TimelinesAI Multi-Agent WhatsApp
```
Same flow as Fonnte but via:
  POST /api/chakrahq/webhook   → chakraHQController   (Meta WhatsApp Cloud format)
  POST /api/timelinesai/webhook → timelinesAIChatController
Terminal display controlled by MASSEGE_TERMINAL env var.
```

### Contact Form
```
User fills form
  → POST /api/contact { name, phone, email, subject, message }
  → ContactController.submitContact()
    → validateContactForm()
    → Contact.create()                             ← save to MySQL
    → appendContactRow() [non-blocking]            ← Google Sheets
    → generateContactReplyWithProviderFallback()   ← ChatGPT → Claude → Private
    → sendWhatsAppMessage(phone, aiReply)           ← Fonnte API
  ← { success: true }
```

### Auth Flow
```
Register: POST /api/auth/register → bcrypt hash → User.create
Login:    POST /api/auth/login → bcrypt.compare → JWT sign → cookie (refresh) + JSON (access)
Refresh:  GET  /api/auth/refresh → read cookie → verify → new access token
Logout:   DELETE /api/auth/logout → clear DB refresh_token + clear cookie
```

## WhatsApp Multi-Platform Architecture

```
                    ┌─────────────────────────┐
                    │   Customer WhatsApp      │
                    └──────────┬──────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       Fonnte webhook    ChakraHQ webhook   TimelinesAI webhook
       /fonnte-chat/     /chakrahq/         /timelinesai/
       webhook           webhook            webhook
              │                │                │
              └────────────────┼────────────────┘
                               ▼
                    findAgentByDevice()
                    (match device phone → DB user)
                               │
                    hasPropertyKeyword() || isPropertyContextContinuation()
                               │
                               ▼
                    whatsappAIService.generateWhatsAppAIReply()
                    ┌──────────────────────────────┐
                    │ 1. extractQualificationState  │
                    │ 2. buildQualificationStateBlock│
                    │ 3. RESPOND_CATALOG_RUN check  │
                    │ 4. ChatGPT → Claude → Private │
                    └──────────────────────────────┘
                               │
                    Send reply via agent's own fonnte_token
```

## Key ENV Variables

```env
# AI Providers
AI_PRIMARY_PROVIDER=chatgpt        # or 'claude'
ENABLE_CLAUDE_FALLBACK=true
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Claude
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-haiku-4-5-20251001
CLAUDE_MAX_TOKENS=1200

# WhatsApp
FONNTE_TOKEN=...                   # global token for contact form notifications
MASSEGE_TERMINAL=FONNTE            # which platform shows in terminal (FONNTE,CHAKRAHQ,TIMELINESAI)

# WhatsApp AI Mode
RESPOND_CATALOG_RUN=OFF            # OFF=Q1-Q12 qualification; ON=catalog listing
RUMAH123_DATA=ON                   # ON=use Apify live data; OFF=flat JSON only

# Apify (Rumah123)
APIFY_API_TOKEN=apify_api_...

# Google Sheets
GOOGLE_SHEET_ID=...

# Server
PORT=5005
FRONTEND_URL=http://localhost:5173
```

# 01. System Overview & Architecture

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express, **port 5055** |
| Frontend | Vue 3 + Vite, port 5173 (data properti via backend API) |
| Database | MySQL (MariaDB 10.4) via **Sequelize v6** ORM (sumber utama data properti) |
| Primary AI | dipilih `AI_PRIMARY_PROVIDER`: QWEN / Claude / ChatGPT / **DeepSeek** (satu saja) |
| Last-resort AI | chatbotPrivateController (local, no external API) — fallback tiap primary |
| WhatsApp | Fonnte / **Kirimi** / TimelinesAI — multi-agent, token/device per-agent |
| Live property data | Rumah123 via Apify scraper (opsional di atas DB) |
| Static property data | JSON fallback `indonesia_property_extended_v3.json` (lazy) |
| Dev tunnel | ngrok auto-start dari terminal backend (`ENABLE_NGROK`) |
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
│   │   ├── kirimiChatController.js       ← Kirimi multi-agent webhook (device_id per-agent)
│   │   ├── facilityMasterController.js   ← Facility CRUD (protected)
│   │   ├── propertyMasterController.js   ← Property CRUD (protected)
│   │   ├── countryMasterController.js / provinceMasterController.js / cityMasterController.js
│   │   ├── locationMasterController.js / propertyLocationController.js
│   │   ├── fonnteChatController.js       ← Fonnte multi-agent webhook
│   │   ├── fonnteWebhookController.js    ← Legacy Fonnte webhook
│   │   ├── homeController.js / logController.js / rumah123Controller.js
│   │   ├── loginController.js / registerController.js / refreshTokenController.js / profileController.js
│   │   ├── timelinesAIChatController.js  ← TimelinesAI multi-agent webhook
│   │   └── whatsappInboundController.js  ← Legacy WA inbound (log-only)
│   ├── services/
│   │   ├── aiPromptBuilderService.js     ← Q1-Q12 extraction + WhatsApp prompt builder
│   │   ├── aiProviderService.js          ← routing 1 primary → Private Agent (no cross-AI)
│   │   ├── openaiService.js / claudeService.js / qwenService.js / deepseekService.js  ← AI providers
│   │   ├── apifyService.js / rumah123ContextService.js ← Rumah123 via Apify
│   │   ├── fonnteService.js              ← Fonnte send API
│   │   ├── ngrokService.js               ← ngrok auto-start (child process)
│   │   ├── googleSheetsService.js        ← Contact form → Sheets
│   │   ├── propertyRecommendationService.js ← DB-first catalog + dynamic rules (lazy JSON)
│   │   ├── sessionService.js / skillPromptService.js / validationService.js
│   │   └── whatsappAIService.js          ← Unified AI reply (all 3 WA platforms)
│   ├── models/
│   │   ├── ChatMessage.js / ChatSession.js / Contact.js / Log.js
│   │   ├── Facility.js                   ← Facility master data
│   │   ├── Property.js / PropertyImage.js / PropertyFacility.js / PropertyLocation.js  ← catalog (extended_v3)
│   │   ├── Country.js / Province.js / City.js / Location.js  ← region + landmark
│   │   ├── User.js                       ← fonnte_token + kirimi_device_id columns
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
│   │       └── indonesia_property_extended_v3.json   ← fallback (DB = sumber utama)
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
  → POST /api/chatbot/message { name, phone, location, message }   ← TANPA propertyContext
  → ChatbotController.sendMessage()
    → findOrCreateSession(name, phone, location)
    → getConversationHistory(sessionId, 12 messages)
    → buildRecommendationContextForLLM(message, history)   ← DB-first catalog + dynamic rules
    → getRumah123Listings(filters)                          ← live data (if ON)
    → generateChatbotReplyWithProviderFallback(...)          ← primary AI → Private Agent
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

### Kirimi / TimelinesAI Multi-Agent WhatsApp
```
Same flow as Fonnte but via:
  POST /api/kirimi/webhook      → kirimiChatController      (device_id per-agent)
  POST /api/timelinesai/webhook → timelinesAIChatController
Terminal display controlled by MASSEGE_TERMINAL; source metadata by MESSAGE_TERMINAL.
```

### Contact Form
```
User fills form
  → POST /api/contact { name, phone, email, subject, message }
  → ContactController.submitContact()
    → validateContactForm()
    → Contact.create()                             ← save to MySQL
    → appendContactRow() [non-blocking]            ← Google Sheets
    → generateContactReplyWithProviderFallback()   ← primary AI → Private Agent
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
       Fonnte webhook    Kirimi webhook     TimelinesAI webhook
       /fonnte-chat/     /kirimi/           /timelinesai/
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
                    │ 3. RESPOND_CATALOG_RUN (isi     │
                    │    setelah brief; Q1–Q12 selalu)│
                    │ 4. primary AI → Private Agent   │
                    └──────────────────────────────┘
                               │
                    Send reply via agent (fonnte_token / kirimi_device_id / TimelinesAI)
```

## Key ENV Variables

```env
# AI Providers — satu primary → Private Agent (tanpa cross-AI). Nama model dari .env (dilarang hardcode).
AI_PRIMARY_PROVIDER=deepseek       # qwen | claude | chatgpt | deepseek | private
ENABLE_CLAUDE_FALLBACK=true
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
OPENAI_API_KEY / OPENAI_MODEL
ANTHROPIC_API_KEY / CLAUDE_MODEL
QWEN_API_KEY / QWEN_BASE_URL / QWEN_MODEL
DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL / DEEPSEEK_TEMPERATURE / DEEPSEEK_TOP_P

# WhatsApp
FONNTE_TOKEN=...                   # global token for contact form notifications
KIRIMI_USER_CODE / KIRIMI_SECRET   # akun; device per-agent di users.kirimi_device_id
TIMELINESAI_API_KEY=...
MESSAGE_TERMINAL=KIRIMI            # sumber metadata `source` di log AI (satu nilai)
MASSEGE_TERMINAL=FONNTE,KIRIMI,TIMELINESAI   # platform yang tampil di terminal + routing POST /

# WhatsApp AI Mode
RESPOND_CATALOG_RUN=OFF            # OFF=brief saja; ON=brief+katalog (Q1–Q12 SELALU jalan)
RUMAH123_DATA=OFF                  # ON=Apify live; OFF=DB/JSON extended_v3
APIFY_API_TOKEN=apify_api_...

# Server / Dev
PORT=5055                          # frontend VITE_BACKEND_PORT harus 5055
ENABLE_NGROK=true                  # auto-start tunnel dari terminal backend
FRONTEND_URL=http://localhost:5173
```

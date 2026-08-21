# 19. Feature Routes & Module Reference (Quick Lookup)

**Status:** Quick reference | **Last update:** 4 Agustus 2026

---

## Purpose

Map features to their implementation: which controller, route, service, database model,
and docs cover each feature. Use this to quickly locate code for: home, property search,
city/location/facility management, profile, auth, chatbot, terminal message, contact form, etc.

---

## Feature → Code Mapping

### **Authentication & User Management**

| Feature | Route | Controller | Service | Model | Docs |
|---------|-------|-----------|---------|-------|------|
| **Login** | `POST /auth/login` | `authController` | `authService` | `User` | 04 |
| **Register** | `POST /auth/register` | `authController` | `authService` | `User` | 04 |
| **JWT refresh** | `POST /auth/refresh` | `authController` | `authService` | — | 04, 06 |
| **Logout** | `POST /auth/logout` | `authController` | `authService` | — | 04 |
| **Change password** | `POST /auth/change-password` | `authController` | `authService` | `User` | 04 |
| **User profile** | `GET /users/:id` | `userController` | `userService` | `User` | 05 |
| **Agent token setup** | `POST /users/:id/agent-token` | `userController` | `userService` | `User` | 04, 05 |
| **Phone normalization** | `POST /auth/normalize-phone` | `authController` | `authService` (util) | — | 04, 09 |

---

### **Frontend Modules (Vue 3)**

| Module | Route (Frontend) | Controller/API | Components | Docs |
|--------|-----------------|----------------|-----------|------|
| **Home** | `/` | static / `propertyController` | `Home.vue`, hero, agent card | 07 |
| **Property Search** | `/property/search` | `propertyController` | `PropertySearch.vue`, filter, card | 05, 07, 12 |
| **Property Detail** | `/property/:id` | `propertyController` | `PropertyDetail.vue`, images, contact | 05, 07, 12 |
| **City Management** | `/admin/cities` | `cityController` | `CityList.vue`, form modal | 05, 07 |
| **Location (Landmark)** | `/admin/locations` | `locationController` | `LocationList.vue`, form modal | 05, 07 |
| **Facility Management** | `/admin/facilities` | `facilityController` | `FacilityList.vue`, facility grid | 05, 07, 16 |
| **Profile** | `/profile` | `userController` | `Profile.vue`, edit form | 05, 07 |
| **About** | `/about` | static | `About.vue`, agency info | 07 |
| **Contact** | `/contact` | `contactController` | `Contact.vue`, form → Google Sheets | 05, 07, 13 |

---

### **Master Data (CRUD)**

| Data Type | Models | Routes | Controller | Service | Docs |
|-----------|--------|--------|-----------|---------|------|
| **Country** | `Country` | `GET /countries` | `countryController` | `countryService` | 03, 05 |
| **Province** | `Province` | `GET /provinces` | `provinceController` | `provinceService` | 03, 05 |
| **City** | `City` | CRUD `/cities` | `cityController` | `cityService` | 03, 05, 16 |
| **Location (Landmark)** | `Location` | CRUD `/locations` | `locationController` | `locationService` | 03, 05, 16 |
| **Facility** | `Facility` | CRUD `/facilities` | `facilityController` | `facilityService` | 03, 05, 16 |
| **Property** | `Property` | CRUD `/properties` | `propertyController` | `propertyService` | 03, 05, 12 |
| **Agent** | `Agent` | CRUD `/agents` | `agentController` | `agentService` | 03, 05 |
| **User** | `User` | GET `/users` | `userController` | `userService` | 03, 04, 05 |

---

### **Chatbot & WhatsApp**

| Feature | Route (Backend) | Controller | Service | Trigger | Docs |
|---------|-----------------|-----------|---------|---------|------|
| **Webhook (Fonnte)** | `POST /webhook/fonnte` | `fonnteWebhookController` | `whatsappAIService` | WhatsApp msg in | 08, 09 |
| **Webhook (Kirimi)** | `POST /webhook/kirimi` | `kirimiWebhookController` | `whatsappAIService` | WhatsApp msg in | 08, 09 |
| **Webhook (TimelinesAI)** | `POST /webhook/timelinesai` | `timelinesAIChatController` | `whatsappAIService` | WhatsApp msg in | 08, 09 |
| **ChatBot Response** | (internal) | `chatbotController` | `whatsappAIService` | LLM (primary) | 06, 10 |
| **Private Agent (fallback)** | (internal) | `chatbotPrivateController` | `ConversationQualifier` | LLM fail | 06, 18 |
| **Terminal Message** | `POST /messages/terminal` | `chatbotPrivateController` | `ConversationQualifier` | Manual / API | 09, 11 |
| **Cookie response timer** | (internal) | `fonnteWebhookController` (etc) | `responseDebounce` | Multiple msgs | 09 |
| **Qualification state** | (internal) | `chatbotController` | `aiPromptBuilderService` | Each reply | 10 |
| **Viewing schedule** | (internal) | `chatbotPrivateController` | `viewingScheduleTrigger` | Google Calendar | 13 |

---

### **AI & Prompting**

| Feature | Component | File | Input | Output | Docs |
|---------|-----------|------|-------|--------|------|
| **AI Provider selection** | `aiProviderService` | `services/aiProviderService.js` | Q + history | selected provider | 06 |
| **Prompt builder** | `aiPromptBuilderService` | `services/aiPromptBuilderService.js` | history + state + Q | LLM prompt | 06, 10 |
| **State extractor** | `extractQualificationState()` | `services/aiPromptBuilderService.js` | history + msg | Q1–Q12 state | 10 |
| **Skill loader** | `loadProjectSkillPrompt()` | `services/skillPromptService.js` | skill name | doc text | 06 |
| **Facility context** | `aiContextService` | `services/aiContextService.js` | city, type | facility list + keywords | 16 |
| **City/Location context** | `aiContextService` | `services/aiContextService.js` | city | landmark list + examples | 16 |
| **LLM call** | `whatsappAIService` | `services/whatsappAIService.js` | prompt + state | LLM reply | 06 |
| **Response formatting** | `ResponseBuilderWhatsApp` | `controllers/chatbotPrivateController.js` | state | WhatsApp text | 11 |
| **Final directive** | `buildFinalDirective()` | `services/aiPromptBuilderService.js` | state + identity | blok akhir prompt (posisi 100%) | 06, 10 |
| **Identitas agent → prompt** | blok `🪪 IDENTITAS ANDA` | `services/aiPromptBuilderService.js` | `users.name` + `APP_NAME` | nama tanda tangan | 06 |
| **Guard tanda tangan** | `guardReplyIdentity()` | `utils/replyIdentityGuard.js` | balasan AI | placeholder `[Nama Agen]`/`${agentName}` → nama asli | 06 |
| **Mode katalog per-agent** | `catalogModeService` | `services/catalogModeService.js` | `users.catalog_summary` | `ON`/`OFF` (cache TTL) | 06 |
| **Aturan bisnis agent** | `agentBusinessRulesService` | `services/agentBusinessRulesService.js` | `users.trans_type/payment_type/rental_*` | rules (cache TTL) | 06 |
| **Batas layanan agent** | `checkAgentScope()` | `utils/agentScopeGuard.js` | pesan + rules | blok/lolos + kalimat penolakan | 06 |
| **Konversi durasi** | `toDays()`, `parseDurationFromText()` | `utils/durationConverter.js` | angka + satuan | jumlah HARI (Day=1, Week=7, Month=30, Year=365) | 06 |
| **Debounce anti-race** | `debounceMessage()` | `utils/responseDebounce.js` | pesan beruntun | satu batch, mutex per-key | 09 |
| **Provider Kimi** | `kimiService` | `services/kimiService.js` | prompt | balasan (OpenAI-compatible) | 06 |

> **Gerbang berlapis sebelum AI dipanggil** — urutannya penting, semuanya di
> `services/whatsappAIService.js` sehingga jalur LLM DAN Private Agent sama-sama
> terlindungi (menaruhnya di salah satu jalur saja adalah kesalahan M52/M54):
>
> 1. `hasPropertyKeyword()` / `isPropertyContextContinuation()` — gerbang MASUK
>    (`utils/propertyKeywordFilter.js`). Pesan non-properti berhenti di sini.
> 2. `checkAgentScope()` — batas layanan agent. Transaksi/pembiayaan/durasi di luar
>    setelan agent dijawab sopan, tanpa memanggil AI sama sekali.
> 3. `buildQualifyReply()` — gerbang kualifikasi (4 info minimum).
> 4. Baru kemudian provider AI / Private Agent.
>
> Ketiga gerbang **fail-open**: kegagalan internalnya tidak boleh membungkam balasan.

---

### **Data Integration & Catalog**

| Feature | Source | Service | Route | Docs |
|---------|--------|---------|-------|------|
| **Backend properties** | Database (`properties` table) | `propertyService` | `GET /properties`, `/search` | 03, 05, 12 |
| **Rumah123 live scrape** | Apify (online) | `apifyService` | (internal merge) | 12 |
| **Merged catalog** | DB + Apify | `propertyRecommendationService` | `GET /catalog/:agent` | 05, 12 |
| **Per-agent scoping** | `users.agent_id` | `propertyService` (filter) | filtered by agent | 03, 12 |
| **Category alias** | facility keywords | `facilityService` | category → facility id | 16 |

---

### **External Integrations**

| Service | Purpose | Auth | Controller/Service | Docs |
|---------|---------|------|-------------------|------|
| **Google Sheets** | Contact form logging | Service Account | `contactController` + `googleSheetsService` | 13 |
| **Google Calendar** | Viewing schedule | OAuth 2.0 (User) | `viewingScheduleTrigger` | 13 |
| **Google Places** | Live landmark data | API Key | `googlePlacesService` | 16 |
| **Apify** | Property scrape (Rumah123) | API Key | `apifyService` | 12 |
| **Fonnte** | WhatsApp send/receive | Token per-agent | `fonnteWebhookController` | 08, 09 |
| **Kirimi** | WhatsApp send/receive | Token per-agent | `kirimiWebhookController` | 08, 09 |
| **TimelinesAI** | WhatsApp send/receive | Token per-agent | `timelinesAIChatController` | 08, 09 |
| **S3** | Image hosting | AWS credentials | `s3Service` | 14 |
| **Email** | Transactional (backup) | SMTP config | `emailService` | 14 |

---

### **Admin & Troubleshooting**

| Feature | Route | Controller | Purpose | Docs |
|---------|-------|-----------|---------|------|
| **System health** | `GET /health` | `healthController` | Readiness check | 15 |
| **Version** | `GET /version` | `healthController` | App version + env | 15 |
| **Logs** | (filesystem) | `logger` util | Request/error/AI logs | 15 |
| **Database migration** | (CLI) | `sequelize migrate` | Schema upgrade | 02, 03 |
| **NGROK tunnel** | (CLI) | `ngrok http 5055` | Webhook URL for testing | 15 |
| **Webhook test** | `POST /webhook/test` | `webhookTestController` | Simulate inbound msg | 15 |

---

## Quick Lookup by Feature Type

### **CRUD Operations (Master Data)**

**Where?** `controllers/{entity}Controller.js` → `services/{entity}Service.js` → `models/{Entity}.js`

Example (City):
```
Route:  CRUD /cities (GET list, POST create, PUT update, DELETE remove)
        ↓
Controller: cityController.js (extract req, call service)
        ↓
Service: cityService.js (business logic, DB query)
        ↓
Model: City.js (Sequelize ORM, schema)
        ↓
Docs: 03 (schema), 05 (all routes), 07 (frontend)
```

### **WhatsApp Chatbot Flow**

**Where?** Webhook → AI Service → Qualification → Format → Send

```
Customer message → Fonnte/Kirimi/TimelinesAI webhook
        ↓
{fonnteWebhookController.handleIncomingMessage}
        ↓
whatsappAIService.processCustomerMessage()
        ├─ extractQualificationState() ← state Q1–Q12
        ├─ aiPromptBuilderService.buildWhatsappReplyPrompt()
        ├─ call AI provider (primary, or fallback chain)
        └─ chatbotPrivateController (if LLM fail)
        ↓
formatForWhatsApp() + send via Fonnte API
        ↓
Customer receives reply

Docs: 06 (AI), 08–09 (WhatsApp), 10 (qualification)
```

### **Frontend Master Data Module**

**Where?** Vue route → API call → service logic → model query

```
User navigates /admin/cities
        ↓
CityList.vue (component, call API)
        ↓
GET /cities (route)
        ↓
cityController.list() (extract params, call service)
        ↓
cityService.getAll() (DB query via Sequelize)
        ↓
City model (ORM, schema validation)
        ↓
Response JSON → render in table

Docs: 07 (frontend), 05 (API), 03 (schema)
```

### **Debugging: "Where is X handled?"**

| Question | Answer | Docs |
|----------|--------|------|
| Property search broken | `propertyController.search()` → `propertyService.search()` | 05, 12 |
| Chatbot keeps asking Q2 | `extractQualificationState()` (Q2 extraction) | 10 |
| Webhook 404 | `fonnteWebhookController` route not registered | 08, 09 |
| Facility not shown to AI | `aiContextService.getFacilityContext()` | 16 |
| Profile page blank | `userController.getProfile()` → `Profile.vue` | 05, 07 |
| Rumah123 data missing | `propertyRecommendationService.mergeCatalog()` | 12 |
| Contact form not logged | `contactController.submit()` → `googleSheetsService` | 13 |
| Viewing not in Calendar | `viewingScheduleTrigger.maybeScheduleViewingFromChat()` | 13 |

---

## Environment & Configuration

| Config | File | Purpose | Docs |
|--------|------|---------|------|
| `AI_PRIMARY_PROVIDER` | `.env` | Which AI (deepseek/kimi/qwen/chatgpt/claude — currently `kimi`) | 02, 06 |
| `PORT` | `.env` | Server listen port | 02, 15 |
| `DATABASE_URL` | `.env` | DB connection string | 02, 03 |
| `FONNTE_TOKEN_*` | `.env` | Per-agent Fonnte API key | 02, 08 |
| `KIRIMI_DEVICE_ID_*` | `.env` | Per-agent Kirimi device ID | 02, 09 |
| `GOOGLE_SHEETS_ID` | `.env` | Spreadsheet for logging | 02, 13 |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | `.env` | User OAuth for Calendar | 02, 13 |
| `APIFY_TOKEN` | `.env` | Rumah123 scraper API | 02, 12 |
| `S3_*` | `.env` | AWS credentials | 02, 14 |
| `NGROK_URL` | `.env` (manual) | Webhook tunnel for local dev | 02, 15 |
| `AI_COOKIE_RESPONSE_TIMER` | `.env` | Debounce delay (ms) | 02, 09 |

---

## Data Models (15 Total)

Sequelize models in `backend/models/`:

1. **User** — agent account, credentials, token setup
2. **Agent** — chatbot identity (name, app, channel)
3. **Country** — master data
4. **Province** — master data
5. **City** — master data + landmark examples
6. **Location** — landmarks (dekat X)
7. **Facility** — amenities + keywords
8. **Property** — listing (DB-driven or from Apify)
9. **PropertyImage** — photos per property
10. **ContactForm** — inquiry submissions (logged to Google Sheets)
11. **Session** — WhatsApp session tracking (per customer)
12. **ChatLog** — all messages (debug)
13. **AuditLog** — admin actions (create/update/delete master data)
14. **RefreshToken** — JWT token lifecycle
15. **Config** — runtime settings (per-agent catalog mode, etc)

See doc 03 for full schema.

---

## Summary: Three Paths to Code

1. **By route**: Know the HTTP endpoint? → Docs 05 (all routes), find controller, trace to service
2. **By feature name**: Know what user sees? → This doc (19), find module, link to code + docs
3. **By problem**: Bug/error message? → Docs 15 (troubleshooting), match symptom, drill down

---

**Next:** See specific doc numbers in tables above for deep dive into each feature.

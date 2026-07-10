# 05. Backend API & Services

## Routes (`backend/routes/index.js`)

### Rate Limiters
| Limiter | Window | Max | Applied to |
|---|---|---|---|
| contactLimiter | 15 min | 5 | POST /contact |
| webhookLimiter | 1 min | 120 | All webhook endpoints |
| logLimiter | 1 min | 60 | POST /log |

### Public Routes — No Auth Required
| Method | Path | Controller |
|---|---|---|
| GET | /api/home | homeController.index |
| GET | /api/about | aboutController.index |
| POST | /api/contact | contactController.submitContact (rate limited) |
| GET | /api/contact/google-sheets-status | contactController.googleSheetsStatus |
| GET | /api/contact/ai-whatsapp-status | contactController.aiWhatsappStatus |
| GET | /api/chatbot/config | chatbotController.getConfig |
| GET | /api/chatbot/ai-provider-status | chatbotController.aiProviderStatus |
| GET | /api/chatbot/skill-status | chatbotController.skillStatus |
| GET | /api/chatbot/private-status | chatbotPrivateController.privateAgentStatus |
| POST | /api/chatbot/private-message | chatbotPrivateController.sendPrivateMessage |
| POST | /api/chatbot/message | chatbotController.sendMessage |

### Auth Routes
| Method | Path | Controller |
|---|---|---|
| POST | /api/auth/register | registerController.insertDataAgent |
| GET | /api/auth/users-count | registerController.countUsers |
| POST | /api/auth/login | loginController.loginUser |
| GET | /api/auth/refresh | refreshTokenController.refreshTokenController |
| DELETE | /api/auth/logout | loginController.logoutUser |
| GET | /api/auth/me | loginController.getCurrentUser |
| GET | /api/auth/protected-test | (test, requires verifyToken) |

### Protected Routes — Require verifyToken
| Method | Path | Controller |
|---|---|---|
| GET | /api/profile/me | profileController.getCurrentProfile |
| PUT | /api/profile/update-agent | profileController.updateDataAgent |

### Webhook Routes — Public, Rate Limited (120/min)
| Method | Path | Controller |
|---|---|---|
| POST | /api/fonnte/webhook | fonnteWebhookController.handleWebhook (legacy) |
| **POST** | **/api/fonnte-chat/webhook** | **fonnteChatController.handleInboundMessage (MAIN)** |
| POST | /api/fonnte-chat/chaining | fonnteChatController.handleChainingWebhook |
| POST | /api/fonnte-chat/webhook-raw | fonnteChatController.webhookRawCatcher |
| POST | /api/kirimi/webhook | kirimiChatController.handleInboundMessage |
| POST | /api/kirimi/webhook-raw | kirimiChatController.webhookRawCatcher |
| POST | /api/timelinesai/webhook | timelinesAIChatController.handleInboundMessage |
| POST | /api/timelinesai/webhook-raw | timelinesAIChatController.webhookRawCatcher |

### WhatsApp Admin Routes — Require verifyToken
| Method | Path | Controller |
|---|---|---|
| POST | /api/fonnte-chat/simulate | fonnteChatController.simulateInboundMessage |
| GET | /api/fonnte-chat/debug-info | fonnteChatController.getDebugInfo |
| GET | /api/fonnte-chat/agents | fonnteChatController.getAgentsWithFonnte |
| GET | /api/fonnte-chat/agent-chats/:agentName | fonnteChatController.getAgentChats |
| GET | /api/fonnte-chat/chat-history/:sessionId | fonnteChatController.getChatHistory |
| GET | /api/fonnte-chat/status | fonnteChatController.getFonnteStatus |
| GET | /api/fonnte-chat/poller-status | fonnteChatController.getPollerStatus |
| POST | /api/fonnte-chat/poller-start | fonnteChatController.startPoller |
| POST | /api/fonnte-chat/poller-stop | fonnteChatController.stopPoller |
| GET | /api/fonnte-chat/check-fonnte-api | fonnteChatController.checkFonnteApi |
| POST | /api/kirimi/simulate | kirimiChatController.simulateInboundMessage |
| GET | /api/kirimi/debug-info | kirimiChatController.getDebugInfo |
| GET | /api/kirimi/agents | kirimiChatController.getAgentsWithKirimi |
| GET | /api/kirimi/agent-chats/:agentName | kirimiChatController.getAgentChats |
| GET | /api/kirimi/chat-history/:sessionId | kirimiChatController.getChatHistory |
| GET | /api/kirimi/status | kirimiChatController.getKirimiStatus |
| GET | /api/kirimi/check-api | kirimiChatController.checkKirimiApi |
| POST | /api/timelinesai/simulate | timelinesAIChatController.simulateInboundMessage |
| GET | /api/timelinesai/agents | timelinesAIChatController.getRegisteredAgents |
| GET | /api/timelinesai/status | timelinesAIChatController.getStatus |
| — | Master data | facility / property / country / province / city / location (+ property-location) CRUD, semua verifyToken |

### Utility Routes
| Method | Path | Notes |
|---|---|---|
| POST | /api/log | logController.insertLog (rate limited 60/min) |
| GET | /api/rumah123/status | rumah123Controller.status |
| GET | /api/rumah123/search | rumah123Controller.search |
| POST | /api/rumah123/search | rumah123Controller.searchPost |
| GET | /api/rumah123/dataset/:datasetId | rumah123Controller.getDataset |
| GET | /api/rumah123/cache-status | rumah123Controller.cacheStatus |
| POST | /api/rumah123/warmup | verifyToken — rumah123Controller.triggerWarmup |
| GET | /api/chatbot/debug/test-rumah123 | verifyToken — debug only |

### Facility Master Data Routes — Require verifyToken
| Method | Path | Controller |
|---|---|---|
| GET | /api/facility/list | facilityMasterController.showDataFacility |
| GET | /api/facility/categories | facilityMasterController.getCategories |
| GET | /api/facility/detail/:facility_id | facilityMasterController.getDetailFacility |
| POST | /api/facility/insert | facilityMasterController.insertDataFacility |
| PUT | /api/facility/update/:facility_id | facilityMasterController.updateDataFacility |
| PATCH | /api/facility/toggle-status/:facility_id | facilityMasterController.toggleStatusFacility |
| DELETE | /api/facility/delete/:facility_id | facilityMasterController.deleteFacility |

---

## Controller Pattern (OOP — all controllers)

All controllers use class-based OOP with static methods:

```javascript
class SomeController {
  static #privateHelper(...) { ... }   // ES2022 private static
  static async someEndpoint(req, res) { /* handler logic */ }
}
module.exports = SomeController;
// Routes: router.get('/path', SomeController.someEndpoint)
```

---

## Services (`backend/services/`)

### aiProviderService.js
- `executeAIProviderWithFallback(taskName, chatGPTFn, claudeFn, qwenFn, deepseekFn)` — 1 primary → Private Agent
- `getPrimaryAIProvider()` / `getAIProviderOrder()` / `canUseChatGPT|Claude|Qwen|DeepSeek()`
- `generateChatbotReplyWithProviderFallback(session, history, message, context)` — website chatbot
- `generateContactReplyWithProviderFallback(contactPayload)` — contact form
- `generateWhatsappReplyWithProviderFallback(session, history, message, context)` — all WA platforms
- `generateWhatsappExternalAIFallback(...)` — rantai darurat saat primary=private
- `checkAIProviderConfig()` — status semua provider (chatgpt/claude/qwen/deepseek)
- Returns `{ reply, provider, primaryProvider, fallbackUsed, fallbackProvider, primaryError, providerErrors }`

### whatsappAIService.js (NEW — unified for all 3 WA platforms)
- `generateWhatsAppAIReply({ session, history, message, agentName, contextSource })` — main entry
- `buildQualifyReply(filters, message, agentName, contextSource, history)` — pre-qualification gate
- `isIndonesian(message, history)` — language detection with history fallback
- `agentSignature(agentName, isId)` — builds agent signature block
- `RESPOND_CATALOG_RUN` mengatur isi SETELAH brief (Q1–Q12 SELALU jalan):
  - `OFF` (default): brief/summary saja
  - `ON`: brief + katalog rekomendasi (primary AI → Private Agent)

### aiPromptBuilderService.js (CORE — WhatsApp prompt assembly)
- `extractQualificationState(history, currentMessage)` — 4-phase Q1–Q12 extraction
- `buildQualificationStateBlock(state)` — renders ✅/❓ checklist + DIBLOKIR banner
- `findNextQuestion(state)` — returns `{q, hint}` for next unanswered Q in priority order
- `buildWhatsappReplyPrompt(params)` — assembles full AI system prompt
  - Includes: skill docs, forced language, Q1–Q12 state block, customer profile, history, property context
- See `17-qualification-flow-and-ai-prompt-builder.md` for full detail.

### sessionService.js
- `findOrCreateSession(name, phone, location, source)` — smart dedup by normalizedPhone
- `getConversationHistory(sessionId, limit=12)` — last N messages, chronological
- `saveUserMessage(sessionId, message, source, metadata)`
- `saveAssistantMessage(sessionId, reply, source, metadata)`

### fonnteService.js
- `sendWhatsAppMessage(phone, message)` — POST to api.fonnte.com/send (uses global FONNTE_TOKEN)
- `normalizeWhatsAppNumber(phone)` — normalize to 628... format
- `checkFonnteConfig()` — validate token present
- Note: `fonnteChatController` uses its own `sendViaFonnte(target, message, agentToken)` with per-agent tokens

### skillPromptService.js
- Loads all `.md` files from `skills/chat_gpt_responds/` and `skills/claude_responds/`
- `loadProjectSkillPrompt(provider)` — combines all skill docs, truncated to 36000 chars
- `getSkillRegistryStatus()` — file count + folder existence
- Hot-reload: reads files at runtime (no server restart needed after skill changes)

### propertyRecommendationService.js
- `buildRecommendationContextForLLM(message, history)` — filter JSON catalog for website chatbot
- `extractPropertyFilters(message, history)` — extract buildingType, transactionType, location, budget

### rumah123ContextService.js
- `getRumah123Listings({ location, propertyType, listingType })` — live data via Apify
- `formatRumah123ContextForLLM(listings)` — format listings for AI prompt
- `mapBuildingTypeToApify(type)` — internal type → Apify filter string
- `mapTransactionTypeToApify(type)` — internal type → Apify filter string
- Cache warmup on start: Jakarta Selatan, Surabaya, Bandung, Bali

### googleSheetsService.js
- `appendContactRow(contactData)` — append contact submission to Google Sheet
- `getGoogleSheetsStatus()` — test connection
- Auth: `backend/google-service-account.json`

---

## Utils (`backend/utils/`)

| File | Key Exports | Purpose |
|---|---|---|
| safeLog.js | `safeLog(action, details, level)` | Structured JSON logging |
| authLogger.js | `authLog.loginSuccess / loginFailed / ...` | Auth event terminal boxes |
| httpStatus.js | `HTTP.OK, HTTP.CREATED, HTTP.BAD_REQUEST, ...` | HTTP status constants |
| responseFormat.js | `sendSuccess(res, status, data, msg)`, `sendError(...)` | Consistent response shape |
| normalizeName.js | `normalizeName(name)` | Normalize customer name |
| normalizePhone.js | `normalizePhone(phone)` | Normalize phone to 628... |
| propertyKeywordFilter.js | `hasPropertyKeyword(msg)`, `isPropertyContextContinuation(msg, history)`, `extractLocationFromMessage(msg)`, `extractPropertyTypeFromMessage(msg)`, `extractTransactionTypeFromMessage(msg)` | Property intent detection |
| terminalSwitch.js | `isTerminalActive(platform)`, `getActiveTerminals()` | Control which WA platform logs to terminal via `MASSEGE_TERMINAL` env |
| whatsappPropertyContext.js | `getWhatsappPropertyContext(customerMessage)` | Rumah123 → flat JSON fallback for WhatsApp AI |
| whatsappUtils.js | `sanitizeLog(text)`, `maskPhone(phone)`, `maskName(name)` | Safe terminal logging |

### propertyKeywordFilter.js — Detection Logic

```
hasPropertyKeyword(msg):
  True if: (property type keyword) AND (action word)
         OR standalone unambiguous keyword (KPR, kavling, perumahan, etc.)
  Exclusions: "rumah makan", "rumah sakit", "sewa mobil", etc.

isPropertyContextContinuation(msg, history):
  True if: short answer that continues a property conversation
  14 patterns:
  - Lease duration: "^\d+\s*(tahun|bulan)s?"
  - Month name fast-path: "^\s*\d{0,2}\s*(januari|...|december)"
  - Q4 household: "sendiri|sendiran|sama [person]|bersama|keluarga|istri|suami"
  - Q6 anchor: "dekat|deket|near|di jalan|di sekitar|samping"
  - Short negation ≤30 chars starting with "tidak|ga|gak|ngga|enggak|nggak"
  - ... and 9 more patterns
```

### terminalSwitch.js

Controls which platform's logs appear in terminal:
```env
MASSEGE_TERMINAL=FONNTE                       # only Fonnte shows in terminal
MASSEGE_TERMINAL=FONNTE,KIRIMI               # Fonnte + Kirimi
MASSEGE_TERMINAL=FONNTE,KIRIMI,TIMELINESAI  # all active platforms
```

### whatsappPropertyContext.js

Priority order for property data in WhatsApp AI responses:
1. **Database** (model Property + relasi) via `propertyRecommendationService` — sumber utama
2. Fallback: `backend/asset/json_data/indonesia_property_extended_v3.json` (lazy)
3. Opsional Rumah123 live data (Apify) — if `APIFY_API_TOKEN` set AND `RUMAH123_DATA=ON`

Returns `{ contextText, source: 'rumah123'|'flat_json'|'none', location, propertyType, transactionType }`

### ngrokService.js (baru)

`startNgrok(port)` / `stopNgrok()` — jalankan `ngrok http <port>` sebagai child process
saat `ENABLE_NGROK=true`; parse URL dari output JSON, cetak ke terminal backend, dan
matikan saat SIGINT/SIGTERM. Lihat doc 15.

### propertyRecommendationService.js — backend-driven + lazy

- `getSourceProperties()` DB-first (`getDbProperties` JOIN Property+Image+Facility+Location);
  fallback `loadJsonProperties()` (extended_v3, **lazy** — tidak di-load saat startup).
- `buildRecommendationContextForLLM()` membangun **dynamic response rules** dari filter
  nyata customer (`buildDynamicResponseRules`) — tanpa hardcode kota; alternatif
  memprioritaskan kota yang sama sebelum melebar.
- `GET /api/about` (aboutController) memakai service ini → portfolios DB-driven.

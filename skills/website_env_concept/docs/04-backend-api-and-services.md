# 04. Backend API & Services

## Routes (backend/routes/index.js)

### Public Routes
| Method | Path | Controller | Notes |
|---|---|---|---|
| GET | /api/home | homeController.index | |
| GET | /api/about | aboutController.index | |
| POST | /api/contact | contactController.submitContact | rate limited: 5/15min |
| GET | /api/chatbot/config | chatbotController.getConfig | cookie TTL config |
| POST | /api/chatbot/message | chatbotController.sendMessage | main chatbot |
| POST | /api/chatbot/private-message | chatbotPrivateController.sendPrivateMessage | direct private agent |
| POST | /api/fonnte/webhook | fonnteWebhookController.handleWebhook | Fonnte AI webhook |
| POST | /api/whatsapp/webhook | whatsappInboundController.handleInboundMessage | agent inbound |
| POST | /api/auth/register | registerController.insertDataAgent | |
| POST | /api/auth/login | loginController.loginUser | |
| GET | /api/auth/refresh | refreshTokenController | reads HttpOnly cookie |
| DELETE | /api/auth/logout | loginController.logoutUser | |
| GET | /api/auth/me | loginController.getCurrentUser | |
| POST | /api/log | logController.saveLog | frontend nav logs |

### Protected Routes (require verifyToken middleware)
| Method | Path | Controller |
|---|---|---|
| GET | /api/profile/me | profileController.getCurrentProfile |
| PUT | /api/profile/update-agent | profileController.updateDataAgent |

### Status / Debug Routes
| Method | Path | Description |
|---|---|---|
| GET | /api/chatbot/ai-provider-status | ChatGPT/Claude config check |
| GET | /api/chatbot/skill-status | skill files loaded check |
| GET | /api/chatbot/private-status | private agent status |
| GET | /api/contact/google-sheets-status | Google Sheets connection |
| GET | /api/contact/ai-whatsapp-status | AI + Fonnte config |
| GET | /api/whatsapp/messages | list inbound WA messages |
| GET | /api/whatsapp/messages/:id | single message detail |
| GET | /api/whatsapp/agents/status | 5 agents message counts |
| GET | /api/rumah123/search | live Rumah123 search |
| GET | /api/rumah123/cache-status | Apify cache status |

## Controller Pattern (OOP — all controllers)

All controllers follow class-based OOP pattern with static methods:

```javascript
class SomeController {
  static #privateHelper(...) { ... }   // private to class

  static async someEndpoint(req, res) {
    // handler logic
  }
}
module.exports = SomeController;
```

Routes access static methods directly: `chatbotController.sendMessage` resolves to `ChatbotController.sendMessage`.

## Key Services (backend/services/)

### aiProviderService.js
- `executeAIProviderWithFallback(taskName, chatGPTFn, claudeFn)` — routes ChatGPT→Claude
- `generateChatbotReplyWithProviderFallback(session, history, message, context)`
- `generateContactReplyWithProviderFallback(contactPayload)`
- `generateWhatsappReplyWithProviderFallback(session, history, message, context)`
- `checkAIProviderConfig()` — returns config status for both providers

### sessionService.js
- `findOrCreateSession(name, phone, location, source)` — smart session (handles typos)
- `getConversationHistory(sessionId, limit)` — last N messages
- `saveUserMessage(sessionId, message, source, metadata)`
- `saveAssistantMessage(sessionId, reply, source, metadata)`

### fonnteService.js
- `sendWhatsAppMessage(phone, message)` — POST to api.fonnte.com/send with FONNTE_TOKEN
- `normalizeWhatsAppNumber(phone)` — normalize to 628... format
- `checkFonnteConfig()` — validate token present

### skillPromptService.js
- Loads all .md files from `skills/chat_gpt_responds/` and `skills/claude_responds/`
- `getSkillRegistryStatus()` — check skill folders exist + file count

### propertyRecommendationService.js
- `buildRecommendationContextForLLM(message, history)` — filter JSON catalog

### rumah123ContextService.js
- `getRumah123Listings({ location, propertyType, listingType })` — live via Apify
- Cache warmup on start: Jakarta Selatan, Surabaya, Bandung, Bali

### googleSheetsService.js
- `appendContactRow(contactData)` — append to sheet (non-blocking in contactController)
- `getGoogleSheetsStatus()` — test connection
- Credentials: `backend/google-service-account.json`

## Utils (backend/utils/)

| File | Exports | Purpose |
|---|---|---|
| safeLog.js | `safeLog(action, details, level)` | structured JSON logging |
| authLogger.js | `authLog.loginSuccess/loginFailed/registerSuccess/registerFailed/logoutSuccess/logoutFailed` | auth event boxes |
| httpStatus.js | `HTTP.OK, HTTP.CREATED, HTTP.BAD_REQUEST, ...` | constants from .env |
| responseFormat.js | `sendSuccess(res, status, data, message)`, `sendError(...)` | consistent response shape |

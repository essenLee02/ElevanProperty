# 05. Backend API & Services

## Routes (`backend/routes/index.js`)

### Core Pages
| Method | Path | Controller | Notes |
|---|---|---|---|
| GET | /api/home | homeController.index | |
| GET | /api/about | aboutController.index | |

### Contact Form
| Method | Path | Controller | Notes |
|---|---|---|---|
| POST | /api/contact | contactController.submitContact | rate limited: 5/15min |
| GET | /api/contact/google-sheets-status | contactController.googleSheetsStatus | |
| GET | /api/contact/ai-whatsapp-status | contactController.aiWhatsappStatus | |

### Website Chatbot
| Method | Path | Controller | Notes |
|---|---|---|---|
| GET | /api/chatbot/config | chatbotController.getConfig | cookie TTL config |
| GET | /api/chatbot/ai-provider-status | chatbotController.aiProviderStatus | |
| GET | /api/chatbot/skill-status | chatbotController.skillStatus | |
| GET | /api/chatbot/private-status | chatbotPrivateController.privateAgentStatus | |
| POST | /api/chatbot/message | chatbotController.sendMessage | main chatbot |
| POST | /api/chatbot/private-message | chatbotPrivateController.sendPrivateMessage | direct private agent |
| GET | /api/chatbot/debug/test-rumah123 | chatbotPrivateController.debugTestRumah123 | debug only |

### Fonnte Webhooks (Contact Form / Old Inbound)
| Method | Path | Controller | Notes |
|---|---|---|---|
| POST | /api/fonnte/webhook | fonnteWebhookController.handleWebhook | Fonnte AI reply webhook |
| POST | /api/whatsapp/webhook | whatsappInboundController.handleInboundMessage | Agent inbound log (old) |
| GET | /api/whatsapp/messages | whatsappInboundController.getInboundMessages | |
| GET | /api/whatsapp/messages/:id | whatsappInboundController.getMessageDetail | |
| GET | /api/whatsapp/agents/status | whatsappInboundController.getAgentsStatus | |

### Fonnte Multi-Agent Chat (`fonnteChatController`)
| Method | Path | Controller | Notes |
|---|---|---|---|
| POST | /api/fonnte-chat/webhook | fonnteChatController.handleInboundMessage | **Main Fonnte webhook** |
| GET | /api/fonnte-chat/status | fonnteChatController.getFonnteStatus | Status config per agent |
| GET | /api/fonnte-chat/agents | fonnteChatController.getAgentsWithFonnte | List agent siap Fonnte |
| GET | /api/fonnte-chat/agent-chats/:agentName | fonnteChatController.getAgentChats | Sesi chat per agent |
| GET | /api/fonnte-chat/chat-history/:sessionId | fonnteChatController.getChatHistory | Riwayat pesan |

> Webhook Fonnte diarahkan ke `/api/fonnte-chat/webhook` (bukan `/api/fonnte/webhook`).
> `/api/fonnte/webhook` = lama (AI reply contact form). `/api/fonnte-chat/webhook` = baru (multi-agent chat).

### WATI Multi-Agent Chat (`watiChatController`)
| Method | Path | Controller |
|---|---|---|
| POST | /api/wati/webhook | watiChatController.handleInboundMessage |
| GET | /api/wati/status | watiChatController.getWatiStatus |
| GET | /api/wati/agents/list | watiChatController.getRegisteredAgents |
| GET | /api/wati/agent-chats/:agentName | watiChatController.getAgentChats |
| GET | /api/wati/chat-history/:sessionId | watiChatController.getChatHistory |

### Auth
| Method | Path | Controller | Auth |
|---|---|---|---|
| POST | /api/auth/register | registerController.insertDataAgent | Public |
| POST | /api/auth/login | loginController.loginUser | Public |
| DELETE | /api/auth/logout | loginController.logoutUser | Public |
| GET | /api/auth/me | loginController.getCurrentUser | Cookie |
| GET | /api/auth/refresh | refreshTokenController | Cookie (HttpOnly) |
| GET | /api/profile/me | profileController.getCurrentProfile | JWT |
| PUT | /api/profile/update-agent | profileController.updateDataAgent | JWT |

### Rumah123 / Apify
| Method | Path | Controller |
|---|---|---|
| GET | /api/rumah123/status | rumah123Controller.status |
| GET | /api/rumah123/search | rumah123Controller.search |
| POST | /api/rumah123/search | rumah123Controller.searchPost |
| GET | /api/rumah123/dataset/:datasetId | rumah123Controller.getDataset |
| GET | /api/rumah123/cache-status | rumah123Controller.cacheStatus |
| POST | /api/rumah123/warmup | rumah123Controller.triggerWarmup |

### Misc
| Method | Path | Controller |
|---|---|---|
| POST | /api/log | logController.saveLog |

---

## Controller Pattern (OOP — all controllers)

```javascript
class SomeController {
  static #privateHelper(...) { ... }   // private to class

  static async someEndpoint(req, res) {
    // handler logic
  }
}
module.exports = SomeController;
```

Routes access static methods directly: `fonnteChatController.handleInboundMessage` → `FonnteChatController.handleInboundMessage`.

---

## All Controllers (`backend/controllers/`)

| File | Fungsi Utama |
|---|---|
| `homeController.js` | GET /api/home |
| `aboutController.js` | GET /api/about |
| `contactController.js` | Contact form + Google Sheets + Fonnte |
| `chatbotController.js` | Website floating chatbot |
| `chatbotPrivateController.js` | Private AI fallback agent |
| `loginController.js` | Login, logout, getCurrentUser |
| `registerController.js` | Register agent |
| `refreshTokenController.js` | JWT refresh via cookie |
| `profileController.js` | Get & update agent profile (incl. fonnte_token) |
| `fonnteWebhookController.js` | Fonnte AI reply webhook (contact form) |
| `whatsappInboundController.js` | Agent inbound log (old approach) |
| `fonnteChatController.js` | **Fonnte multi-agent chat** (per-agent token) |
| `watiChatController.js` | WATI multi-agent chat |
| `rumah123Controller.js` | Rumah123/Apify property search |
| `logController.js` | Frontend navigation logging |

---

## All Services (`backend/services/`)

| File | Fungsi |
|---|---|
| `aiProviderService.js` | Orchestrator AI fallback (ChatGPT → Claude → Private) |
| `openaiService.js` | ChatGPT API calls |
| `claudeService.js` | Claude API calls (axios HTTP) |
| `fonnteService.js` | Fonnte send WA (global token dari .env — contact form) |
| `watiService.js` | WATI API calls |
| `sessionService.js` | find/create session, save messages |
| `skillPromptService.js` | Load .md skill files → system prompt |
| `aiPromptBuilderService.js` | Build AI prompt dari context + history |
| `propertyRecommendationService.js` | Filter property catalog JSON |
| `rumah123ContextService.js` | Live Apify + cache |
| `apifyService.js` | Apify API client |
| `googleSheetsService.js` | Google Sheets append (contact form backup) |
| `validationService.js` | Input validation helpers |

---

## Utils (`backend/utils/`)

| File | Exports | Purpose |
|---|---|---|
| `safeLog.js` | `safeLog(action, details, level)` | structured JSON logging |
| `authLogger.js` | `authLog.loginSuccess/loginFailed/...` | auth event boxes |
| `httpStatus.js` | `HTTP.OK, HTTP.BAD_REQUEST, ...` | HTTP status constants |
| `responseFormat.js` | `sendSuccess(res, ...)`, `sendError(res, ...)` | consistent response shape |

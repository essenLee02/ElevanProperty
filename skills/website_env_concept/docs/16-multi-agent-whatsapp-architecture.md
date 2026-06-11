# 16. Multi-Agent WhatsApp Architecture

## Overview

The system supports **3 WhatsApp API platforms** simultaneously. Each agent can be configured
to use any of these platforms. All three share the same AI pipeline via `whatsappAIService.js`.

| Platform | Controller | Main Webhook | Agent Token Field |
|---|---|---|---|
| Fonnte | fonnteChatController.js | POST /api/fonnte-chat/webhook | `users.fonnte_token` |
| WATI | watiChatController.js | POST /api/wati/webhook | WATI API config |
| 360dialog | dialogChatController.js | POST /api/dialog-chat/webhook | `users.dialog360_token` |

---

## Data Model: User (Agent)

```javascript
// backend/models/User.js
User {
  user_id        : String   // Generated: prefix + random + count
  name           : String   // Agent display name
  phone          : String   // Agent's WhatsApp number (matched to Fonnte device)
  username       : String   // Login username
  password       : String   // bcrypt hashed
  refresh_token  : Text
  privilege      : String   // 'agent' | 'admin'
  status         : Integer  // 1=aktif, 2=blocked, 3=delete
  fonnte_token   : String   // Per-agent Fonnte API token (nullable)
  dialog360_token: String   // Per-agent 360dialog API key (nullable)
  // Timestamps: created_date, updated_date, created_by, updated_by
}
```

---

## Fonnte Multi-Agent Setup

### How Agent Matching Works

Fonnte sends a `device` field in each webhook payload — this is the agent's WhatsApp number.
The system queries `users` table to find the matching agent:

```javascript
// fonnteChatController.findAgentByDevice()
const agents = await User.findAll({
  where: { privilege: 'agent', status: 1 },
  attributes: ['id', 'name', 'phone', 'username', 'fonnte_token'],
});
// Match: normalizePhone(agent.phone) === normalizePhone(body.device)
```

### Per-Agent Token Isolation

Each agent's reply is sent via **their own token** — no shared sending:
```javascript
sendViaFonnte(customerPhone, aiReply, agent.fonnte_token)
// → POST https://api.fonnte.com/send
//   Authorization: agent.fonnte_token
```

### Retry + Timeout Config
```env
FONNTE_TIMEOUT_MS=30000
FONNTE_RETRY_COUNT=3
FONNTE_RETRY_DELAY_MS=3000
```
Retryable network codes: `ETIMEDOUT, ECONNREFUSED, ECONNRESET, ENOTFOUND, ENETUNREACH, ECONNABORTED`

---

## WATI Multi-Agent Setup

- Webhook: `POST /api/wati/webhook`
- Agent matching: similar lookup from DB
- Raw catcher: `POST /api/wati/webhook-raw` (debug/logging)
- Admin endpoints: simulate, debug-info, agents/list, chat history, status

---

## 360dialog Multi-Agent Setup

- Webhook: `POST /api/dialog-chat/webhook`
- Token stored in `users.dialog360_token`
- Webhook setup: `POST /api/dialog-chat/setup-webhook` (requires auth)
- Sandbox setup: send `START` to `+551146733492` to get sandbox credentials
- Admin endpoints: setup-webhook, simulate, debug-info, status, agents, chat history

---

## Shared AI Pipeline

All three platforms use identical AI logic via `whatsappAIService.js`:

```
[Fonnte / WATI / 360dialog controller]
  │
  ├─ Property intent gate (hasPropertyKeyword || isPropertyContextContinuation)
  │
  ├─ findOrCreateSession(name, phone, location, source)
  │   source: 'fonnte' | 'wati' | 'dialog360'
  │
  ├─ getConversationHistory(sessionId, 12)
  │
  └─ generateWhatsAppAIReply({ session, history, message, agentName, contextSource })
       │
       ├─ extractPropertyFilters(message, history)
       │
       ├─ buildQualifyReply() ← pre-qualification gate (4 min fields)
       │
       ├─ RESPOND_CATALOG_RUN=OFF:
       │     extractQualificationState(history, message)
       │     buildQualificationStateBlock(state)
       │     buildWhatsappReplyPrompt(...)
       │     → chatbotPrivateController (Private Agent)
       │
       └─ RESPOND_CATALOG_RUN=ON:
             getWhatsappPropertyContext(message) ← Rumah123 / flat JSON
             → ChatGPT → Claude → Private Agent
```

---

## Terminal Display Control

```env
MASSEGE_TERMINAL=FONNTE              # Only Fonnte shows in terminal
MASSEGE_TERMINAL=FONNTE,DIALOG       # Fonnte + 360dialog
MASSEGE_TERMINAL=FONNTE,DIALOG,WATI  # All 3 platforms
```

Each platform's controller checks `isTerminalActive(platform)` before logging.
This prevents terminal spam when running multiple agents across platforms.

---

## Session Handling Across Platforms

Sessions are stored in `chat_sessions` table with `source` field:
- Fonnte sessions: `source = 'fonnte'`
- WATI sessions: `source = 'wati'`
- 360dialog sessions: `source = 'dialog360'`
- Website chatbot: `source = 'website'` or `'chatbot'`

Sessions are looked up by normalized phone — the same customer reaching out via
different platforms will create separate sessions per platform.

---

## WhatsAppInbound Model (Legacy Log-Only)

The `whatsapp_inbound_messages` table (via `whatsappInboundController.js`) is a legacy
log-only table — it saves inbound messages for record-keeping but does NOT send AI replies.
This is separate from the multi-agent chat controllers.

```javascript
WhatsAppInbound {
  agentName           : String   // Agent name
  agentPhone          : String
  agentPhoneNormalized: String
  senderName          : String
  senderPhone         : String
  senderPhoneNormalized: String
  message             : Text
  mediaType           : String   // 'text', 'image', etc.
  mediaUrl            : Text
  deviceId            : String
  timestamp           : String
  rawPayload          : Text
  status              : String   // 'received' (default)
}
```

Admin routes:
- `GET /api/whatsapp/messages` — list all inbound
- `GET /api/whatsapp/messages/:id` — single message detail
- `GET /api/whatsapp/agents/status` — message count per agent

---

## Adding a New Agent

1. **Register in DB**: `POST /api/auth/register` with privilege='agent'
2. **Set Fonnte token**: `PUT /api/profile/update-agent` (requires auth) or direct SQL
3. **Configure Fonnte**: Add phone to Fonnte dashboard, scan QR, set webhook to `/api/fonnte-chat/webhook`
4. **Disable auto-signature** in Fonnte dashboard (AI generates its own)
5. **Verify**: `GET /api/fonnte-chat/agents` (requires auth) — should show new agent with token
6. **Test**: `POST /api/fonnte-chat/simulate` with `agentPhone` matching new agent's phone

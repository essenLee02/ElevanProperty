# 16. Multi-Agent WhatsApp Architecture

## Overview

The system supports **3 WhatsApp API platforms** simultaneously. Each agent can be configured
to use any of these platforms. All three share the same AI pipeline via `whatsappAIService.js`.

| Platform | Controller | Main Webhook | Agent Token / Identity |
|---|---|---|---|
| Fonnte | fonnteChatController.js | POST /api/fonnte-chat/webhook | per-agent `users.fonnte_token`; agent matched by payload `device` |
| WATI | watiChatController.js | POST /api/wati/webhook | shared `WATI_API_TOKEN` (env); agent identified from payload (4 strategies) |
| 360dialog | dialogChatController.js | POST /api/dialog-chat/webhook | per-agent `users.dialog360_token`; agent matched by header `X-Agent-Id` |

All three controllers now run the **same inbound processing pipeline** (see below) and the same
AI chain via `whatsappAIService.js`. Only the transport (event detection, agent identity, send API)
differs per platform.

---

## Unified Inbound Processing Pipeline (identical across Fonnte / WATI / 360dialog)

Every platform controller follows the SAME ordered steps. This consistency was aligned to
`fonnteChatController.js` (the reference implementation):

```
1. Webhook received → log raw payload
2. detectEventType → only "incoming" proceeds; status/send/unknown → 200 and stop
3. Respond HTTP 200 IMMEDIATELY, then process in background (setImmediate)
   → avoids platform webhook timeouts (Fonnte/WATI/360dialog all expect a fast ack)
4. Identify agent (per-platform strategy) → fallback to first ready agent
5. processIncomingMessage():
   a. Skip empty/media-only messages
   b. DEDUP guard — utils/messageDedup (isAlreadyProcessed / markProcessed)
      → drops duplicate webhook retries (stable message IDs only)
   c. findOrCreateSession (source = 'fonnte' | 'wati' | 'dialog360')
   d. ★ PROPERTY GATE — runs BEFORE any DB write:
        isPropertyQuery  = hasPropertyKeyword(message)
        isContinuation   = isPropertyContextContinuation(message, getConversationHistory(id, 6))
        if (!isPropertyQuery && !isContinuation) → logTerminalSkip + RETURN
        → non-property messages are NOT saved to DB (clean history, no wasted writes)
   e. Save customer message to DB (ONLY property / continuation messages)
   f. generateWhatsAppAIReply({ session, message, agentName })  ← ChatGPT → Claude → Private
   g. Save AI reply to DB
   h. Send reply via the platform's own API (per-agent token where applicable)
   i. Terminal summary log (gated by isTerminalActive(platform))
```

**Why the gate runs before the DB save (consistency fix):** previously WATI and 360dialog saved
the customer message first and gated afterwards, which let non-property chatter (greetings,
off-topic) pollute `chat_messages` and the conversation history fed to the AI. Aligning all three
to gate-first means only genuine property queries / qualification answers are persisted — keeping
`extractQualificationState` history clean and DB writes minimal. Fonnte, WATI, and 360dialog are
now byte-for-byte equivalent on this flow.

**Continuation check:** the gate fetches the last **6** messages to detect short answers
("sewa", "di malang", "belum pernah lihat", "15 orang") that have no property keyword but clearly
continue a prior AI question. The AI step later fetches its own deeper history (~24 messages).

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

After the property gate passes (step 5d above), all three platforms call the SAME AI logic via
`whatsappAIService.generateWhatsAppAIReply()`:

```
generateWhatsAppAIReply({ session, message, agentName })
  │
  ├─ getConversationHistory(session.id, 24)   ← deep history for the AI
  │
  ├─ extractPropertyFilters(message, history) ← accumulates type/tx/location/budget/
  │     facilities over the last 24 customer messages ("current message wins"; a TYPE
  │     change resets tx/location/budget). Wide window prevents the opener from scrolling
  │     out and the gate from looping back to "ask 4 info" mid-flow.
  │
  ├─ buildQualifyReply() ← pre-qualification gate:
  │     • Mode OFF: proceed to AI if ANY of type/tx/location is known
  │     • Mode ON : require all 4 minimum fields before catalog
  │
  ├─ RESPOND_CATALOG_RUN=OFF (default — qualification + summary):
  │     extractQualificationState(history, message)   ← ✅/❓ per field, Phase 0/1/2,
  │        deterministic date parser (35 rules), money parser, facilities, household
  │        ("N orang"/rombongan), 24-combination BELI branch, House v2 pilot
  │     buildQualificationStateBlock(state) + buildWhatsappReplyPrompt(...)
  │     → ChatGPT → Claude → Private Agent (chatbotPrivateController)
  │
  └─ RESPOND_CATALOG_RUN=ON (direct catalog):
        getWhatsappPropertyContext(message) ← Rumah123 (Apify) / flat JSON catalog
        → ChatGPT → Claude → Private Agent
```

**Provider chain** (env `AI_PRIMARY_PROVIDER`): `chatgpt` (default) = ChatGPT → Claude → Private;
`claude` = Claude → ChatGPT → Private; `private` = Private Agent only (deterministic, no tokens).
The Private Agent is the guaranteed fallback and never fails.

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

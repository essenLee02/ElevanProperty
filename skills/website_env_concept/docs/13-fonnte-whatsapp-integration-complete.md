# 13. Fonnte WhatsApp — Multi-Agent Integration (Actual Implementation)

This documents the **actual Fonnte implementation** in this codebase, not a generic guide.
For general Fonnte API reference, see fonnte.com docs.

---

## Architecture Overview

Each agent has their **own Fonnte token** stored in `users.fonnte_token`.
When a message comes in via webhook, the system:
1. Identifies which agent the message was sent to (by matching `body.device` to `users.phone`)
2. Generates an AI reply using that agent's session context
3. Sends the reply using that agent's `fonnte_token`

This means each agent's WhatsApp is fully isolated — no cross-contamination.

---

## Setup: Register Agent in Fonnte

### Step 1: Create Fonnte Account
1. Visit fonnte.com, create account
2. Add device → scan QR code with agent's WhatsApp
3. Get API token for that device
4. Set webhook URL: `https://yourserver.com/api/fonnte-chat/webhook`

### Step 2: Save Token to Database
```sql
UPDATE users SET fonnte_token = 'your_fonnte_token_here' WHERE phone = '628xxx';
```
Or via `PUT /api/profile/update-agent` (requires auth).

### Step 3: Disable Auto-Signature in Fonnte Dashboard
⚠️ **IMPORTANT**: Disable auto-signature in Fonnte dashboard for each agent.
The AI generates its own formatted signature at the end of the brief — Fonnte's
auto-signature would duplicate it and look unprofessional.

### Step 4: Set ENV Variables
```env
MASSEGE_TERMINAL=FONNTE    # Show Fonnte logs in terminal
RESPOND_CATALOG_RUN=OFF    # Q1-Q12 qualification mode (default)
RUMAH123_DATA=ON           # Use Apify live data
FONNTE_TIMEOUT_MS=30000
FONNTE_RETRY_COUNT=3
FONNTE_RETRY_DELAY_MS=3000
```

---

## Webhook Handler (`fonnteChatController.js`)

### Endpoint: `POST /api/fonnte-chat/webhook`

Set this URL in Fonnte Dashboard for all agents.

### Event Detection

```javascript
function detectEventType(body) {
  if (body.eventType === 'send') return 'send';

  // Incoming: has sender AND (message or inboxid defined)
  // Use !== undefined (not !!) so empty message "" is still detected
  if (body.sender && (body.message !== undefined || body.inboxid !== undefined))
    return 'incoming';

  // Message status (read receipts, delivery)
  if (body.status !== undefined || body.state !== undefined || body.stateid !== undefined)
    return 'message_status';

  return 'unknown';
}
```

### Message Dedup Cache

Prevents double-processing when Fonnte retries a webhook delivery:

```javascript
const _seenMessageIds = new Map();
const DEDUP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Only deduplicates stable IDs (body.inboxid / body.key / body.id)
// Falls back gracefully when no stable ID (fonnte_<timestamp> prefix → not deduped)
```

### Agent Lookup by Device Phone

```javascript
async function findAgentByDevice(devicePhone) {
  const normDevice = normalizePhone(devicePhone);  // → 628xxx
  const agents = await User.findAll({
    where: { privilege: 'agent', status: 1 },
    attributes: ['id', 'name', 'phone', 'fonnte_token'],
  });
  return agents.find(a => normalizePhone(a.phone) === normDevice) || null;
}
```

### Property Intent Gate

Before calling AI, check if message is property-related:
```javascript
const isProperty = hasPropertyKeyword(message) ||
                   isPropertyContextContinuation(message, history);
if (!isProperty) {
  // Log: "bukan query properti — tidak dibalas"
  // Save message to DB but skip AI reply
  return;
}
```

---

## Sending Messages Per-Agent

Each agent sends via their own token (not the global `FONNTE_TOKEN`):

```javascript
async function sendViaFonnte(targetPhone, message, agentToken) {
  const params = new URLSearchParams();
  params.append('target',      normalizePhone(targetPhone));
  params.append('message',     message.trim());
  params.append('countryCode', '0');

  await axios.post('https://api.fonnte.com/send', params, {
    headers: {
      'Authorization' : agentToken,   // ← agent's own token
      'Content-Type'  : 'application/x-www-form-urlencoded'
    },
    timeout: FONNTE_TIMEOUT_MS
  });
  // Retries up to FONNTE_RETRY_COUNT on network errors (ETIMEDOUT, ECONNRESET, etc.)
}
```

---

## Complete Incoming Message Flow

```
POST /api/fonnte-chat/webhook
  │
  ├─ detectEventType(body)
  │     'message_status' → log + return 200 (no reply)
  │     'send' → log + return 200 (no reply)
  │     'incoming' → continue
  │
  ├─ _isAlreadyProcessed(messageId)
  │     already seen → return 200 (skip)
  │
  ├─ Extract: sender, device, message, pushname, inboxid
  │
  ├─ findAgentByDevice(device)
  │     no match → log warning + return 200 (unknown agent)
  │
  ├─ findOrCreateSession(pushname, sender, ?, 'fonnte')
  │
  ├─ saveUserMessage(sessionId, message)
  │
  ├─ getConversationHistory(sessionId)
  │
  ├─ hasPropertyKeyword(msg) || isPropertyContextContinuation(msg, history)
  │     false → log "bukan query properti" + return 200 (no reply)
  │
  ├─ generateWhatsAppAIReply({ session, history, message, agentName, contextSource })
  │     → whatsappAIService handles qualification + AI provider chain
  │
  ├─ saveAssistantMessage(sessionId, reply)
  │
  └─ sendViaFonnte(sender, reply, agent.fonnte_token)
       → return 200
```

---

## Admin Endpoints (Require Auth)

| Endpoint | Purpose |
|---|---|
| GET /api/fonnte-chat/agents | List all agents with fonnte_token |
| GET /api/fonnte-chat/agent-chats/:agentName | Chat sessions for agent |
| GET /api/fonnte-chat/chat-history/:sessionId | Full session messages |
| GET /api/fonnte-chat/status | Check Fonnte API connectivity |
| GET /api/fonnte-chat/debug-info | Debug payload info |
| POST /api/fonnte-chat/simulate | Simulate incoming message (testing) |
| GET /api/fonnte-chat/poller-status | Polling mode status |
| POST /api/fonnte-chat/poller-start | Start polling |
| POST /api/fonnte-chat/poller-stop | Stop polling |
| GET /api/fonnte-chat/check-fonnte-api | Test Fonnte API connectivity |

---

## Phone Number Normalization

```javascript
function normalizePhone(phone) {
  return String(phone || '')
    .replace(/\+62/g, '62')
    .replace(/^0/, '62')
    .replace(/[\s\-()]/g, '');
}
// +62 821-3311-936  → 628213311936
// 0821-3311-936     → 628213311936
```

---

## Contact Form WhatsApp Notification (via global token)

The contact form uses the **global** `FONNTE_TOKEN` (not per-agent) to notify admins.
This is separate from the multi-agent chat system.

```javascript
// In contactController.js (non-blocking):
fonnteService.sendWhatsAppMessage(adminPhone, aiReply).catch(err => safeLog(...));
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Agent not responding | `fonnte_token` not set in DB | Run UPDATE query or use profile update endpoint |
| All messages ignored | Webhook URL wrong in Fonnte Dashboard | Set to `/api/fonnte-chat/webhook` |
| Messages processed twice | Fonnte retry without dedup ID | Check `inboxid` present in payload |
| Non-property replies | Intent gate too strict | Check `isPropertyContextContinuation` patterns |
| Agent mismatch | `device` phone not matching DB `users.phone` | Normalize both phones to 628... format |
| Duplicate signature | Fonnte auto-signature enabled | Disable auto-signature in Fonnte Dashboard |

---

## Terminal Logging

Controlled by `MASSEGE_TERMINAL` env var:
```env
MASSEGE_TERMINAL=FONNTE    # Show Fonnte messages in terminal
```

When active, each message shows a formatted box:
```
──────────────────────────────────────────────
[FONNTE] ⬇  PESAN MASUK
[FONNTE]    Agent    : LEO FELIX (0888...874)
[FONNTE]    Customer : 628...796 (Nigel **.)
[FONNTE]    Time     : 2026-06-11T...
[FONNTE]    Message  : sewa villa di malang
[FONNTE]    Status   : ✅ Dikirim ke AI
──────────────────────────────────────────────
```

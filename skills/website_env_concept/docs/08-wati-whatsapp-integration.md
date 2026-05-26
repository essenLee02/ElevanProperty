# 02. WATI WhatsApp Integration (watiChatController)

## Status: ⚠️ Backend Ready — Channel Pending

| Component | Status |
|---|---|
| `watiChatController.js` code | ✅ Done |
| 6 agents in database | ✅ Done |
| NGROK tunnel | ✅ Active during dev |
| Webhook URL set in WATI | ✅ POST /setWebhook done |
| WATI WhatsApp channel connected | ❌ Not yet |
| Real messages in terminal | ❌ Blocked by above |

> **Root cause:** WATI requires ONE WhatsApp Business number connected to the account.
> Until connected, no webhook fires. Test with curl commands instead.

---

## Architecture — How WATI Works

```
WATI = ONE WhatsApp Business Number for Elevan Property
                        ↓
Customer messages that business number
                        ↓
WATI receives → fires webhook POST → NGROK → backend
                        ↓
watiChatController identifies agent + displays in terminal
```

**Important distinctions:**

| WATI Concept | Meaning | Our Usage |
|---|---|---|
| **Contacts** | Numbers WATI can message | Agent phones added here (LEO FELIX added) |
| **Operators** | Team members who log into WATI | Agents should also be added as operators |
| **Business Number** | The ONE number customers message | Needs to be connected (pending) |

Agent personal phones in DB = **identity for the system**, not directly monitored by WATI.

---

## watiChatController.js — Agent Lookup (4 Strategies)

```
Webhook received
     ↓
Strategy 1: agentPhone (custom test field) → findByPhone()
     ↓ not found
Strategy 2: waId = agent phone? (WATI Contact reply flow)
            When LEO FELIX replies to WATI → waId = Leo's number
     ↓ not found
Strategy 3: assignedOperator.name match → name fuzzy match in DB
     ↓ not found
Strategy 4: owner (business phone) → findByPhone()
     ↓ still not found
Fallback: DISPLAY MESSAGE IN TERMINAL ANYWAY (non-blocking)
```

---

## Terminal Display Format

```
────────────────────────────────────────────────────────────
Agent     : LEO FELIX - +62821-3311-936
Customer  : 6288133701235
Timestamp : 2026-05-26T10:55:00.000Z
Message   : Saya mau sewa rumah di Surabaya. Ada yang tersedia?
────────────────────────────────────────────────────────────
```

---

## WATI Webhook Payload (Actual Format)

```json
{
  "waId": "628xxxxxxxx",           // Customer's phone (who sent message)
  "senderName": "Customer Name",
  "text": { "body": "message..." },
  "owner": "62BISNIS_NUMBER",      // WATI business number (NOT agent personal phone)
  "timestamp": "2026-05-26T...",
  "id": "msg_id",
  "assignedOperator": {            // Optional: which WATI operator handles this
    "email": "agent@email.com",
    "name": "Leo Felix"
  }
}
```

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/wati/webhook` | Receive webhook from WATI |
| GET | `/api/wati/status` | Check WATI API connection |
| GET | `/api/wati/agents/list` | List all agents from DB |
| GET | `/api/wati/agent-chats/:agentName` | Agent's chat sessions |
| GET | `/api/wati/chat-history/:sessionId` | Conversation history |

---

## Test Without Real WhatsApp (curl)

**Test Leo Felix receives message:**
```powershell
curl -X POST http://localhost:5005/api/wati/webhook ^
  -H "Content-Type: application/json" ^
  -d "{\"waId\":\"6288133701235\",\"senderName\":\"Budi\",\"text\":{\"body\":\"Mau cari rumah di Surabaya\"},\"agentPhone\":\"+62821-3311-936\",\"id\":\"msg_001\"}"
```

**Test Clarence receives message:**
```powershell
curl -X POST http://localhost:5005/api/wati/webhook ^
  -H "Content-Type: application/json" ^
  -d "{\"waId\":\"6287812345678\",\"senderName\":\"Andi\",\"text\":{\"body\":\"Ada properti di Jakarta?\"},\"agentPhone\":\"0821-1136-7154\",\"id\":\"msg_002\"}"
```

---

## Activate Real WhatsApp Messages

### Option A — WATI Sandbox (5 minutes, for testing)
```
WATI Dashboard → "Connect Channel" button → Sandbox
→ WATI gives a sandbox number
→ Customer sends WA to sandbox number → webhook fires → terminal shows message
```

### Option B — WhatsApp Business (production)
```
Requirements:
  - New phone number (never used WhatsApp before)
  - Meta Business Manager account (business.facebook.com)
  - Business verification (~1-2 days)

Steps:
  WATI → Connect Channel → WhatsApp Cloud API → follow Meta wizard
```

---

## NGROK Setup (Development)

Each session NGROK URL changes — must re-update webhook after restart.

```powershell
# Terminal 1: Start NGROK
ngrok config add-authtoken 3CTVG7OWPXEAjVWgRhHIyH8XUsc_5YbFsXj2DTR7Lsb6uZiSD
ngrok http 5005
# Copy: https://xxxx-xxxx.ngrok-free.app

# Set webhook URL in WATI (Postman or curl):
# POST https://live.wati.io/10167096/api/v1/setWebhook
# Body: { "webhookUrl": "https://NGROK_URL/api/wati/webhook" }

# Terminal 2: Start backend
cd backend && npm start
```

NGROK dashboard: `http://127.0.0.1:4040`

---

## FONNTE vs WATI — Scope Separation

| Feature | Uses | Notes |
|---|---|---|
| Contact form (`/contact`) | **Fonnte** | `fonnteService.js` — sends AI reply to visitor |
| Agent-customer chat capture | **WATI** | `watiChatController.js` — terminal display + DB save |

**Do NOT use Fonnte in watiChatController.** Do NOT use WATI in contact form.

---

## Database — Chat Storage

After agent identified, messages saved to:

```
chat_sessions:   id, name, normalizedName, phone, normalizedPhone,
                 source ('wati_leo_felix'), location
chat_messages:   chatSessionId, role ('customer'|'ai'), message,
                 channel ('whatsapp'), metadata (JSON)
```

---

## WATI Credentials

```env
WATI_API_TOKEN=wati_2688d36b-1f09-41b6-b09d-1872e6ce6c8e.699l...
WATI_API_URL=https://live.wati.io/10167096/api/v1
# Account: live.wati.io/10167096
# Connectors → Webhooks (to find webhook setting in UI)
```

# WATI Integration Setup Guide

## Quick Start

### Files Created
✅ `backend/services/watiService.js` — WATI API wrapper  
✅ `backend/controllers/watiChatController.js` — Chat processing & webhook handler  
✅ `backend/controllers/chatbotPrivateController.js` — Added `generatePrivateWhatsappReply()`  
✅ `backend/routes/index.js` — Added WATI routes  

### Implementation Status
- ✅ Service layer ready
- ✅ Controller layer ready
- ✅ Routes configured
- ⚠️ Webhook setup needed (WATI Dashboard)
- ⚠️ Agent WhatsApp registration needed

---

## Architecture Overview

### Data Flow
```
1. Customer WhatsApp Message
       ↓
2. WATI Cloud receives & stores
       ↓
3. WATI sends webhook POST to: /api/wati/webhook
       ↓
4. watiChatController.handleInboundMessage()
       ├─ Find agent from User.phone (database)
       ├─ Create/find ChatSession
       ├─ Save user message
       └─ Generate AI reply (ChatGPT → Claude → PrivateAgent)
       ↓
5. Send reply via WatiService.sendMessage()
       ↓
6. Save reply to database
       ↓
7. Return response to WATI
       ↓
8. Customer receives reply on WhatsApp
```

### Database Tables

**users** (existing)
```sql
SELECT id, user_id, name, phone, privilege, status 
FROM users 
WHERE privilege = 'agent' AND status = 1;

-- This table is queried to identify which agent is receiving the chat
-- phone column stores WhatsApp number
```

**chat_sessions** (existing, reused)
```sql
CREATE TABLE chat_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customerName VARCHAR(255),
  customerPhone VARCHAR(20),           -- Customer WhatsApp
  normalizedPhone VARCHAR(20),         -- Normalized (628xxx)
  agentName VARCHAR(100),              -- Agent's name (from User.name)
  source VARCHAR(50) DEFAULT 'whatsapp',
  location VARCHAR(255),
  normalizedLocation VARCHAR(255),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP
);
```

**chat_messages** (existing, reused)
```sql
CREATE TABLE chat_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id INT NOT NULL,
  role VARCHAR(20),                    -- 'user' atau 'assistant'
  message TEXT,
  source VARCHAR(50),                  -- 'whatsapp'
  aiProvider VARCHAR(50),              -- 'chatgpt', 'claude', 'private_agent'
  metadata JSON,                       -- AI provider details, fallback info
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
);
```

---

## Implementation Steps

### Step 1: Verify Agent Registration

**Check agents are registered in database**
```bash
# MySQL query
SELECT user_id, name, phone, privilege, status FROM users WHERE privilege = 'agent';

# Expected output (5 agents):
NTxK6aQ001  | Nigel Tjandra   | 082233556796      | agent | 1
CXXxxxXXxx2 | Clarence        | +62 821-1136-7154 | agent | 1
...etc
```

**If agents are missing, register them:**
```bash
curl -X POST http://localhost:5005/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nigel Tjandra",
    "phone": "082233556796",
    "username": "nigel",
    "password": "SecurePass123",
    "privilege": "agent",
    "createdBy": "Admin"
  }'
```

### Step 2: Verify WATI Token

**Check WATI API token is set**
```bash
# backend/.env
WATI_API_TOKEN=wati_2688d36b-1f09-41b6-b09d-1872e6ce6c8e.699lefCaexEWDQDc076Wb9FeddD7VddVcuVMw018Kio4nla5fp1VnNPkMO6jJBhk3Bb0GGzw-I3X36nHOoQHh4X_3JK2ps8t9hLSXds5Skgrc-XFfJ_2FSXRlmUMJC94
```

**Test WATI connection**
```bash
curl http://localhost:5005/api/wati/status

# Expected response:
{
  "success": true,
  "wati": {
    "hasToken": true,
    "keyLooksValid": true,
    "maskedKey": "wati_2688d36b-1f09-41b6-b09d-1872e6ce6c8e.xxxxx...xxxxx",
    "enabled": true,
    "connected": true,
    "error": null
  },
  "message": "WATI API is configured and connected"
}
```

### Step 3: Setup WATI Webhook

**In WATI Dashboard:**
1. Go to Settings → Webhooks
2. Add new webhook:
   - **URL:** `http://your-domain.com/api/wati/webhook` (or `http://localhost:5005/api/wati/webhook` for testing with ngrok)
   - **Method:** POST
   - **Event type:** Incoming messages
   - **Active:** Yes

3. Test webhook (WATI Dashboard will send test payload)
   - Check backend logs for webhook reception
   - Verify response HTTP 200

**For Local Testing (Development):**
```bash
# Use ngrok to expose local backend to public URL
ngrok http 5005

# This gives you: https://xxxx-xxx-xxx-x.ngrok.io
# Use as webhook URL: https://xxxx-xxx-xxx-x.ngrok.io/api/wati/webhook

# ngrok logs will show webhook traffic in real-time
```

### Step 4: Register Agent WhatsApp Numbers in WATI

**For each agent in the system:**
1. Go to WATI Dashboard → Devices/Accounts
2. Scan QR code with agent's WhatsApp (on the registered phone number)
3. Link the WhatsApp account to WATI
4. Verify WhatsApp number matches User.phone in database

**Current Agents (must be registered in WATI):**
```
Nigel:     082233556796
Clarence:  +62 821-1136-7154
Desy:      +62 821-1331-8191
Natasha:   +62 822-3058-7788
Leo:       0813-3470-8691
```

### Step 5: Start Backend Server

```bash
cd backend
npm install  # If not done yet
npm start    # Starts on port 5005

# Check logs for:
# "Database connected and synced"
# "Backend listening at http://localhost:5005"
# "CORS Allowed Origins: http://localhost:5173, ..."
```

---

## Testing Workflow

### Test 1: Manual Webhook Test

**Send test message to agent's WhatsApp number via WATI Dashboard:**

1. WATI Dashboard → Send Message
2. To: +62 821-1136-7154 (Nigel's WhatsApp)
3. Message: "Cari rumah di Jakarta Selatan, budget 2 M"
4. Send

**Check backend logs:**
```
╔════════════════════════════════════════════════════════════╗
║                   📱 WATI INBOUND MESSAGE                  ║
╠════════════════════════════════════════════════════════════╣
║ Agent        : Nigel Tjandra (6282233556796)
║ Customer     : [Sender Name] (628xxxxx)
║ Timestamp    : 2026-05-25T10:30:00.000Z
║ Message ID   : msg_123456
╠════════════════════════════════════════════════════════════╣
║ MESSAGE:
║ Cari rumah di Jakarta Selatan, budget 2 M
╚════════════════════════════════════════════════════════════╝

[WATI] New session created: ID 1
[WATI AI] Trying ChatGPT...
[WATI] AI reply generated: { provider: 'chatgpt', replyLength: 245 }
[WATI SEND] Reply sent successfully: { recipient: '628xxxxx', messageId: 'msg_654321' }
```

**Expected result:**
- ✅ Session created in `chat_sessions` table
- ✅ Customer message saved in `chat_messages` table
- ✅ AI reply generated
- ✅ Reply saved to `chat_messages` table
- ✅ Reply sent back to customer via WATI (visible in their WhatsApp)

### Test 2: Check Agent Chats

**Get all active chats for an agent:**
```bash
curl http://localhost:5005/api/wati/agent-chats/Nigel

# Response:
{
  "success": true,
  "data": {
    "agent": "Nigel",
    "sessions": [
      {
        "id": 1,
        "customerName": "John Doe",
        "customerPhone": "628xxxxxxxx",
        "agentName": "Nigel",
        "source": "whatsapp",
        "createdAt": "2026-05-25T10:30:00.000Z"
      },
      ... more sessions
    ],
    "pagination": {
      "total": 5,
      "limit": 50,
      "offset": 0
    }
  }
}
```

### Test 3: Check Chat History

**Get conversation history for a session:**
```bash
curl http://localhost:5005/api/wati/chat-history/1

# Response:
{
  "success": true,
  "data": {
    "session": {
      "id": 1,
      "customerName": "John Doe",
      "customerPhone": "628xxxxxxxx",
      "agentName": "Nigel",
      "source": "whatsapp",
      "createdAt": "2026-05-25T10:30:00.000Z"
    },
    "messages": [
      {
        "id": 1,
        "role": "user",
        "message": "Cari rumah di Jakarta Selatan",
        "source": "whatsapp",
        "aiProvider": null,
        "createdAt": "2026-05-25T10:30:00.000Z"
      },
      {
        "id": 2,
        "role": "assistant",
        "message": "Halo, kami memiliki beberapa pilihan rumah...",
        "source": "whatsapp",
        "aiProvider": "chatgpt",
        "metadata": { ... },
        "createdAt": "2026-05-25T10:30:05.000Z"
      }
    ],
    "messageCount": 2
  }
}
```

### Test 4: Get Registered Agents

**List all agents in system:**
```bash
curl http://localhost:5005/api/wati/agents/list

# Response:
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": 1,
        "user_id": "NTxK6aQ001",
        "name": "Nigel Tjandra",
        "phone": "082233556796",
        "username": "nigel",
        "created_date": "2026-05-20T08:00:00.000Z"
      },
      ...more agents
    ],
    "totalAgents": 5
  }
}
```

---

## AI Provider Fallback Chain

### Priority Order
1. **ChatGPT (OpenAI)** — Primary provider
   - Config: OPENAI_API_KEY, OPENAI_MODEL (gpt-4o-mini)
   - Error handling: If quota/billing error → try Claude
   - If other error (key invalid) → skip to private agent

2. **Claude (Anthropic)** — Secondary provider
   - Config: ANTHROPIC_API_KEY, CLAUDE_MODEL
   - Error handling: If failed → use private agent

3. **Private Agent** — Last resort fallback
   - Config: Always available (no API key needed)
   - Provides generic helpful response in correct language (ID/EN)
   - No property recommendations (but acknowledges customer intent)

### Example Fallback Flow
```javascript
try {
  // Try ChatGPT
  aiResult = await generateChatGPTWhatsappReply(...);
} catch (error) {
  // If ChatGPT fails
  try {
    // Try Claude
    aiResult = await generateClaudeWhatsappReply(...);
  } catch (error) {
    // If Claude also fails
    // Use Private Agent (always works)
    aiResult = generatePrivateWhatsappReply({...});
  }
}
```

---

## Monitoring & Logging

### Log Locations

**Backend Console:**
```bash
# Terminal where you ran `npm start`
# Shows: Webhook received, AI processing, messages sent
```

**Database Logs:**
```sql
-- View recent WATI activity
SELECT * FROM log 
WHERE action LIKE 'WATI%' 
ORDER BY created_at DESC 
LIMIT 20;

-- View all messages for an agent
SELECT * FROM chat_messages 
WHERE session_id IN (
  SELECT id FROM chat_sessions WHERE agentName = 'Nigel'
)
ORDER BY createdAt DESC;
```

**Error Handling:**
```bash
# If WATI webhook fails:
GET /api/wati/status  # Check WATI connection
# If returns error → check WATI_API_TOKEN in .env

# If AI generation fails:
# Check ChatGPT key: OPENAI_API_KEY
# Check Claude key: ANTHROPIC_API_KEY
# Will fallback to private agent automatically
```

---

## Troubleshooting

### Issue 1: Webhook Not Received

**Check:**
1. WATI webhook URL is correct (check WATI Dashboard)
2. Backend is running: `curl http://localhost:5005/api/home`
3. For local testing, verify ngrok is forwarding traffic
4. Check webhook events in WATI Dashboard logs

**Fix:**
```bash
# Restart backend
npm start

# If using ngrok, get new URL (it changes on each restart)
ngrok http 5005
# Update WATI Dashboard webhook URL with new ngrok URL
```

### Issue 2: Agent Not Found

**Error:** `"Unknown agent phone number"`

**Check:**
```sql
-- Agent phone must be registered in User table
SELECT * FROM users WHERE privilege = 'agent' AND status = 1;

-- If agent missing, register via:
POST /api/auth/register
{
  "name": "Agent Name",
  "phone": "628xxxxxxxx",  -- Must match WhatsApp number
  "username": "agentusername",
  "password": "SecurePass123",
  "privilege": "agent"
}
```

### Issue 3: AI Reply Generation Fails

**Check logs:**
```
[WATI AI] ChatGPT failed: [error]
[WATI AI] Claude failed: [error]
[WATI AI] Using private agent fallback...
```

**Fix:**
1. Verify API keys: `curl http://localhost:5005/api/wati/status`
2. Check quota/billing in OpenAI/Anthropic dashboard
3. If API keys invalid, update `.env` and restart backend
4. Private agent fallback will activate automatically

### Issue 4: Messages Not Saved to Database

**Check:**
```sql
-- Verify chat tables exist
SHOW TABLES LIKE 'chat%';

-- Should see: chat_sessions, chat_messages

-- If missing, restart backend (Sequelize auto-creates)
npm start  # Press Ctrl+C first
```

### Issue 5: WATI Reply Not Sent

**Error:** `"WATI API error: ..."`

**Check:**
1. WATI token is valid: `curl http://localhost:5005/api/wati/status`
2. Customer phone number is correct
3. WhatsApp number must be registered in WATI (not just in User table)

**Fix:**
- Re-register WhatsApp in WATI Dashboard (scan QR again)
- Verify number format: 628xxxxxxx (no +, no dashes)

---

## Production Deployment Checklist

- [ ] Generate new JWT secrets (update ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET in .env)
- [ ] Set WATI_API_TOKEN from production WATI account
- [ ] Update WATI webhook URL to production domain (not ngrok)
- [ ] Set OPENAI_API_KEY, ANTHROPIC_API_KEY from production accounts
- [ ] Enable HTTPS on backend (uncomment `secure: true` in server.js line 126)
- [ ] Setup database backups
- [ ] Configure monitoring alerts for webhook failures
- [ ] Test end-to-end with real customer messages
- [ ] Train agents on WATI Dashboard usage

---

## API Endpoint Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/wati/webhook` | POST | WATI sends incoming messages here |
| `/api/wati/status` | GET | Check WATI connection status |
| `/api/wati/agents/list` | GET | List all registered agents |
| `/api/wati/agent-chats/:agentName` | GET | Get active chats for agent |
| `/api/wati/chat-history/:sessionId` | GET | Get conversation history |

---

## Next Steps

1. **Immediate:** Complete Steps 1-5 above (verification → webhook setup → agent registration)
2. **Testing:** Run Test 1-4 workflows to verify system
3. **Monitoring:** Setup log monitoring and error alerts
4. **Training:** Document for agents how to use WATI Dashboard
5. **Enhancement:** Consider adding dashboard UI to view active chats per agent

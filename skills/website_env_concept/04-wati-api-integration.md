# WATI API Integration

## Overview
WATI (WhatsApp Team Inbox) integration untuk multi-agent WhatsApp chat management. Sistem akan:
1. Retrieve semua pesan yang masuk ke nomor WhatsApp agent yang terdaftar
2. Identifikasi agent dari nomor WhatsApp yang menerima pesan
3. Proses pesan dengan AI (ChatGPT/Claude) untuk generate reply otomatis
4. Send reply kembali ke customer via WATI API
5. Store conversation history di database untuk future reference

## Current Status
- ✓ WATI_API_TOKEN sudah ada di `.env`
- ✓ WhatsApp inbound message handler ada (whatsappInboundController.js)
- ✓ 5 agents terdaftar dengan nomor WhatsApp
- ⚠️ WATI API belum terintegrasi ke chatController
- ⚠️ Belum ada scheduled polling atau webhook untuk WATI

## Architecture

### Agent Registration & WhatsApp Numbers
```sql
-- Dari User model (terdaftar via register endpoint)
SELECT user_id, name, phone FROM users WHERE privilege = 'agent' AND status = 1;

-- Data saat ini (hardcoded di whatsappInboundController.js):
Clarence:  +62 821-1136-7154 (normalized: 6282111367154)
Desy:      +62 821-1331-8191 (normalized: 6282113318191)
Nigel:     082233556796     (normalized: 6282233556796)
Natasha:   +62 822-3058-7788 (normalized: 6282223058788)
Leo:       0813-3470-8691   (normalized: 6281334708691)
```

### Message Flow
```
Customer                    WATI Cloud              Elevan Backend
    |                           |                         |
    |-- Send chat to agent ---> |                         |
    |                           |-- Webhook payload ----> whatsappInboundController
    |                           |                         |
    |                           |                    [Identify Agent]
    |                           |                         |
    |                           |                    [Generate AI Reply]
    |                           |                         |
    |                           |<-- Send via WATI API ---|
    |<--- AI Reply from agent --|                         |
    |                           |                         |
```

## Database Schema

### Table: `users` (Agents)
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),                  -- Agent's WhatsApp number
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  privilege VARCHAR(50),              -- MUST be 'agent'
  status INT DEFAULT 1,               -- 1=aktif, 2=blokir, 3=dihapus
  created_date TIMESTAMP,
  refresh_token TEXT,
  ...
);

-- Query: Find all active agents
SELECT user_id, name, phone FROM users 
WHERE privilege = 'agent' AND status = 1;
```

### Table: `whatsapp_inbound_messages` (Message Log)
```sql
CREATE TABLE whatsapp_inbound_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agentName VARCHAR(100),                -- e.g., "Nigel"
  agentPhone VARCHAR(20),                -- e.g., "6282233556796"
  agentPhoneNormalized VARCHAR(20),      -- Normalized format
  senderName VARCHAR(255),               -- Customer name from WATI
  senderPhone VARCHAR(20),               -- Customer WhatsApp
  senderPhoneNormalized VARCHAR(20),     -- Normalized customer phone
  message TEXT,                          -- Customer message content
  mediaType VARCHAR(50),                 -- e.g., "image", "document"
  mediaUrl VARCHAR(500),                 -- URL to media
  deviceId VARCHAR(100),                 -- WATI device identifier
  timestamp TIMESTAMP,                   -- When message arrived
  rawPayload JSON,                       -- Full WATI webhook payload
  status VARCHAR(50) DEFAULT 'received', -- received, processed, replied
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `chat_sessions` (Conversation Context)
```sql
CREATE TABLE chat_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customerName VARCHAR(255),
  customerPhone VARCHAR(20),
  normalizedPhone VARCHAR(20),
  agentName VARCHAR(100),                -- Which agent handling this chat
  source VARCHAR(50),                    -- 'whatsapp', 'contact_form', 'website_chatbot'
  location VARCHAR(255),                 -- Property search location
  normalizedLocation VARCHAR(255),       -- Normalized location
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP
);
```

### Table: `chat_messages` (Conversation History)
```sql
CREATE TABLE chat_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id INT NOT NULL,
  role VARCHAR(20),                      -- 'user' atau 'assistant'
  message TEXT,
  source VARCHAR(50),                    -- 'whatsapp', 'website_contact', etc
  aiProvider VARCHAR(50),                -- 'chatgpt', 'claude', 'private_agent'
  metadata JSON,                         -- Additional context
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
);
```

## API Integration: WATI

### WATI Webhook (Inbound)

**Webhook URL (to be set in WATI Dashboard)**
```
POST http://your-domain.com/api/whatsapp/webhook
```

**WATI Webhook Payload Structure**
```json
{
  "from": "6282233556796",              // Agent's WhatsApp number
  "message": "Halo, saya mencari rumah di Jakarta Selatan",
  "sender": "Nigel Tjandra (082233556796)",
  "timestamp": "2026-05-25T10:30:00Z",
  "media_type": "text",                 // "text", "image", "document", "audio"
  "media_url": null,                    // URL if media_type != "text"
  "device_id": "device_123456"
}
```

### WATI API: Send Message (Outbound)

**Endpoint**
```
POST https://api.wati.io/api/v1/sendMessageLink
Content-Type: application/json
Authorization: Bearer {WATI_API_TOKEN}
```

**Request Body**
```json
{
  "link": "https://wa.me/6282233556796?text=Halo%20customer",
  "customMessage": true,
  "recipientPhone": "6282233556796"    // Customer phone
}
```

**Alternative: Direct Message Send**
```json
{
  "recipient": "62812345678",           // Recipient WhatsApp number
  "message": "Halo, saya Nigel dari Elevan Property...",
  "senderPhone": "6282233556796"        // Agent's registered number
}
```

## Controller Implementation Plan

### File: `backend/controllers/whatsappInboundController.js` (EXISTING)

**Current Methods** ✓
- `handleInboundMessage(req, res)` — Receive webhook from WATI
- `getInboundMessages(req, res)` — Query messages by agent
- `getMessageDetail(req, res)` — Get single message
- `getAgentsStatus(req, res)` — Agent statistics

**Current Limitations**
- ✗ No AI reply generation
- ✗ No outbound message sending
- ✗ No automatic reply to customer

### Planned: New WATI Service Layer

**File: `backend/services/watiService.js` (NEW)**

**Methods to Implement**

```javascript
// 1. Retrieve all messages for an agent
async function getAgentMessages(agentPhone, options = {}) {
  // WATI API: GET /api/v1/getMessages
  // Filter: receiver = agentPhone, after = lastCheck
  // Return: array of message objects
}

// 2. Send WhatsApp message via WATI
async function sendWatiMessage(agentPhone, customerPhone, messageText) {
  // WATI API: POST /api/v1/sendMessageLink
  // Parameters: recipient, message, senderPhone
  // Returns: { success, messageId, timestamp }
}

// 3. Get WATI account status
async function getWatiStatus() {
  // WATI API: GET /api/v1/getProfile
  // Check: API token valid, account active
}

// 4. Normalize phone number (WATI format)
function normalizeWatiPhone(phone) {
  // Convert: "+62 821-1136-7154" → "6282111367154"
  // Convert: "082233556796" → "6282233556796"
  // Remove: spaces, dashes, parentheses
}
```

### Planned: Chat Processing Controller

**File: `backend/controllers/watiChatController.js` (NEW)**

**Methods to Implement**

```javascript
class WatiChatController {
  // 1. Process inbound message and generate reply
  static async processInboundMessage(req, res) {
    // Extract: agentPhone, customerPhone, customerMessage
    // Identify agent from agentPhone (query users table)
    // Generate AI reply using claudeService or openaiService
    // Store in database (chat_sessions, chat_messages)
    // Send reply via WATI API
    // Return: { success, replyText, messageId }
  }

  // 2. Poll WATI for new messages (scheduled)
  static async pollWatiMessages() {
    // For each agent with privilege = 'agent' and status = 1:
    //   Get messages from WATI API
    //   For each new message:
    //     Process with AI
    //     Send reply via WATI
    //     Log to database
  }

  // 3. Get chat history for agent-customer pair
  static async getChatHistory(agentName, customerPhone) {
    // Query chat_sessions + chat_messages
    // Return: conversation history in chronological order
  }

  // 4. Get agent's active chats
  static async getAgentChats(agentName, limit = 50) {
    // Query: chat_sessions WHERE agentName = ?
    // Return: list of ongoing conversations
  }
}
```

### Planned: Routes

**File: `backend/routes/index.js` (ADD)**

```javascript
// Routes untuk WATI integration
router.post('/api/whatsapp/webhook',      watiChatController.processInboundMessage);
router.get('/api/whatsapp/chats/:agent',  watiChatController.getAgentChats);
router.get('/api/whatsapp/history',       watiChatController.getChatHistory);
router.post('/api/whatsapp/test-send',    watiChatController.testSendMessage);
```

## Scheduled Polling (Optional)

### Option 1: Node-Cron
```javascript
// backend/server.js
const cron = require('node-cron');

// Poll WATI every 5 seconds for new messages
cron.schedule('*/5 * * * * *', async () => {
  try {
    await WatiChatController.pollWatiMessages();
  } catch (error) {
    console.error('[WATI POLL ERROR]', error.message);
  }
});
```

### Option 2: WATI Webhook (Preferred)
- Setup webhook in WATI Dashboard
- WATI sends real-time notifications to `/api/whatsapp/webhook`
- No polling needed, faster response

## Agent Management

### Register New Agent with WhatsApp
```javascript
// POST /api/auth/register
{
  "name": "Natasha Kusuma",
  "phone": "+62 822-3058-7788",      // WhatsApp number
  "username": "natasha",
  "password": "SecurePass123",
  "privilege": "agent",
  "createdBy": "Admin"
}

// Response: user_id = "NKAb3xK004"
// This user_id + phone becomes the agent profile in system
```

### Sync Agents to WATI
```javascript
// GET /api/auth/agents (NEW ENDPOINT TO CREATE)
// Return: [
//   { user_id, name, phone, status },
//   { user_id, name, phone, status },
//   ...
// ]

// Admin setup: Register agent phone in WATI dashboard
// - Agent provides WhatsApp number (already in User.phone)
// - WATI scans QR code to link WhatsApp account
// - Messages to this number → sent to WATI webhook
// - Our backend receives messages via webhook
```

## Implementation Checklist

### Phase 1: Setup & Configuration
- [ ] Verify WATI_API_TOKEN in backend/.env
- [ ] Test WATI API connectivity (getProfile endpoint)
- [ ] Setup webhook URL in WATI Dashboard
- [ ] Verify 5 agents are registered with correct WhatsApp numbers

### Phase 2: Message Reception
- [ ] Create watiService.js with API wrapper functions
- [ ] Update whatsappInboundController.js to identify agent from phone
- [ ] Test webhook reception from WATI
- [ ] Verify messages stored in whatsapp_inbound_messages table

### Phase 3: AI Processing
- [ ] Create watiChatController.js
- [ ] Integrate with claudeService / openaiService for AI replies
- [ ] Handle fallback: if AI fails, use private_agent
- [ ] Log all replies to chat_messages table

### Phase 4: Outbound Sending
- [ ] Implement sendWatiMessage() in watiService.js
- [ ] Send AI-generated replies to customer via WATI
- [ ] Handle WATI API errors gracefully
- [ ] Test end-to-end: customer message → AI reply → received by customer

### Phase 5: Dashboard & Monitoring
- [ ] Create agent chat dashboard (GET /api/whatsapp/chats/:agent)
- [ ] Show active conversations per agent
- [ ] Display message history
- [ ] Show AI response statistics

## Security & Best Practices

### API Token Protection
- ✓ WATI_API_TOKEN stored in `.env` (never commit to git)
- ✓ Token not logged in console or error messages
- ✓ Use `maskSecret()` when displaying token in logs

### Rate Limiting
- ⚠️ Implement rate limiting on webhook endpoint
  - Max 100 requests per minute per IP
  - WATI pushes ~1-5 messages per second under normal load

### Message Validation
- ✓ Validate WATI webhook payload structure
- ✓ Check agentPhone exists in users table
- ✓ Check message length limits (WhatsApp: 1600 chars)

### Data Privacy
- ✓ Store only necessary customer data (name, phone)
- ✓ Mask sensitive info in logs (birthdate, addresses)
- ✓ Implement message TTL: delete messages after 30 days

## Testing Plan

### Unit Tests
- [ ] normalizeWatiPhone() with various formats
- [ ] Agent identification from phone number
- [ ] AI reply generation with mock responses
- [ ] Message storage to database

### Integration Tests
- [ ] Webhook reception and processing
- [ ] WATI API connectivity
- [ ] End-to-end: message in → AI reply → message out
- [ ] Multiple agents handling simultaneous messages

### Load Tests
- [ ] 10 concurrent messages from different customers
- [ ] 100+ message history retrieval
- [ ] Webhook latency < 500ms

## Environment Variables

```bash
# WATI Configuration
WATI_API_TOKEN=wati_2688d36b-1f09-41b6-b09d-1872e6ce6c8e.699lefCaexEWDQDc076Wb9FeddD7VddVcuVMw018Kio4nla5fp1VnNPkMO6jJBhk3Bb0GGzw-I3X36nHOoQHh4X_3JK2ps8t9hLSXds5Skgrc-XFfJ_2FSXRlmUMJC94

# WATI API Endpoint
WATI_API_URL=https://api.wati.io/api/v1

# Webhook polling interval (if using cron instead of webhook)
WATI_POLL_INTERVAL=5    # seconds

# Enable WATI integration
ENABLE_WATI_INTEGRATION=true
```

## References

- WATI Documentation: https://docs.wati.io/
- WATI API Endpoints: https://docs.wati.io/rest-api/
- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp/cloud-api/

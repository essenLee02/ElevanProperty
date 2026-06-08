# WATI Agent Registration Guide

## Pertanyaan Kritis: Apakah Agent Perlu Daftar di WATI?

### Jawaban: YA, TAPI BUKAN AKUN TERPISAH

**Model yang BENAR:**
```
1 WATI Account (HOST)
    ├─ Phone Number 1: +62 821-1136-7154 (Clarence) ← Linked
    ├─ Phone Number 2: +62 821-1331-8191 (Desy) ← Linked
    ├─ Phone Number 3: 082233556796 (Nigel) ← Linked
    ├─ Phone Number 4: 0881-0365-8887 (Ifan) ← Linked
    └─ Phone Number 5: +62813-3470-8691 (Leo) ← Linked

Dashboard WATI:
├─ 5 Agent/Device tabs
├─ Masing-masing tab untuk 1 nomor
└─ All integrated dalam 1 workspace
```

**Analogi:** Seperti 1 perusahaan yang punya 5 nomor telepon, semua di bawah satu PBX (Private Branch Exchange).

---

## Apa yang Perlu Dilakukan: 5 Langkah

### Step 1: Verifikasi WhatsApp Business Account untuk Setiap Nomor

WATI memerlukan setiap nomor agent terhubung ke **WhatsApp Business Account (tidak bisa WhatsApp Personal)**.

**Untuk setiap agent, lakukan:**

```
Agent: Clarence (+62 821-1136-7154)
1. Download WhatsApp Business di device pribadi Clarence
2. Login dengan nomor +62 821-1136-7154
3. Verify dengan SMS code dari WhatsApp
4. Setup Business Profile (nama: "Elevan Property - Clarence", dll)
5. Siap untuk link ke WATI
```

**Pengecualian:**
- Jika nomor sudah WhatsApp Personal → bisa di-upgrade ke Business
- Atau buat nomor baru di device terpisah

### Step 2: Connect Setiap Nomor ke WATI

**Di WATI Dashboard:**

```
1. Login ke https://app.wati.io
2. Go to: Settings → Devices / Connected Accounts
3. Click: "+ Add Device"
4. Pilih: WhatsApp Business API
5. Scan QR Code dengan device Clarence (yang sudah punya nomor +62 821-1136-7154)
6. Approve di WhatsApp
7. Repeat untuk 4 nomor lainnya (Desy, Nigel, Ifan, Leo)
```

**Hasil:**
```
WATI akan menampilkan:
✓ Device 1: Clarence (+62 821-1136-7154) - Connected ✓
✓ Device 2: Desy (+62 821-1331-8191) - Connected ✓
✓ Device 3: Nigel (082233556796) - Connected ✓
✓ Device 4: Ifan (0881-0365-8887) - Connected ✓
✓ Device 5: Leo (+62813-3470-8691) - Connected ✓
```

### Step 3: Configure WATI Workspace Settings

**Setup Single Workspace untuk semua 5 agent:**

```
Settings → Workspace
├─ Workspace Name: "Elevan Property"
├─ Industry: "Real Estate"
├─ Timezone: "Asia/Jakarta"
├─ Currency: "IDR"
└─ Team Members:
    ├─ Clarence (Agent) - Can manage only his device
    ├─ Desy (Agent) - Can manage only her device
    ├─ Nigel (Agent) - Can manage only his device
    ├─ Ifan (Agent) - Can manage only his device
    ├─ Leo (Agent) - Can manage only his device
    └─ Admin (You) - Can see all devices + analytics
```

### Step 4: Setup Webhook untuk Backend

**Single webhook untuk semua 5 nomor:**

```
Settings → Integrations → Webhooks
├─ Webhook URL: https://yourdomain.com/api/wati/webhook
├─ Method: POST
├─ Events:
│   ├─ ✓ Incoming Messages
│   ├─ ✓ Message Status (sent, delivered, read)
│   ├─ ✓ Message Failed
│   └─ ✓ Customer Started Chat
└─ Retry Policy: Exponential backoff
```

**Backend menerima webhook dari ANY nomor:**
```javascript
POST /api/wati/webhook
{
  "from": "628xxxxxxxxx",        // Customer
  "to": "6282111367154",         // Agent nomor (Clarence)
  "message": "Halo...",
  "timestamp": "2026-05-25T10:00:00Z"
}

// Backend cek: "to" field → match dengan User.phone
// Cari agent dari nomor tersebut → process
```

### Step 5: Mapping di Database

**Ensure semua 5 agent terdaftar di User table dengan phone yang match WATI:**

```sql
SELECT user_id, name, phone, privilege, status 
FROM users 
WHERE privilege = 'agent' AND status = 1;

-- Result harus:
user_id      | name     | phone          | privilege | status
─────────────┼──────────┼────────────────┼───────────┼────────
NTxK6aQ001   | Clarence | +62821-1136... | agent     | 1
DKxxx2       | Desy     | +62821-1331... | agent     | 1
NIGxxx3      | Nigel    | 082233556796   | agent     | 1
IFNxxx4      | Ifan     | 0881-0365-... | agent     | 1
LEOxxx5      | Leo      | +62813-3470... | agent     | 1
```

---

## Normalisasi Nomor Telepon (CRITICAL)

**WATI mengirim nomor dalam berbagai format. Harus dinormalisasi untuk matching:**

```javascript
// Input dari WATI bisa:
+62 821-1136-7154      (dengan +, spasi, dash)
0821 1136 7154         (dengan 0, spasi)
6282111367154          (langsung)

// Backend harus normalize ke format: 628xxxxxxxxx

function normalizeWatiPhone(phone) {
  return String(phone || '')
    .replace(/\+62/g, '62')      // +62 → 62
    .replace(/^0/, '62')         // 0xxx → 62xxx
    .replace(/[\s\-()]/g, '');   // Hapus spasi, dash, parenthesis
}

// Contoh:
normalizeWatiPhone('+62 821-1136-7154')  // → '6282111367154'
normalizeWatiPhone('0821 1136 7154')     // → '6282111367154'
normalizeWatiPhone('6282111367154')      // → '6282111367154'
```

**Simpan di database dalam format normal:**

```sql
UPDATE users SET phone = '6282111367154' WHERE user_id = 'NTxK6aQ001';
```

---

## Workflow Lengkap: Chat Masuk → Backend → Response

### Scenario: Customer Chat ke Clarence

```
1. Customer WhatsApp ke Clarence's number: +62 821-1136-7154
   Message: "Halo, berapa harga rumah di Jakarta?"

2. WATI menerima pesan

3. WATI kirim webhook POST /api/wati/webhook:
{
  "from": "+6281234567890",            // Customer
  "to": "+62821-1136-7154",            // Clarence (bisa berbagai format)
  "message": "Halo, berapa harga rumah di Jakarta?",
  "timestamp": "2026-05-25T10:00:00Z",
  "messageId": "msg_abc123"
}

4. Backend watiChatController.handleInboundMessage():
   a. Normalize phone: "+62821-1136-7154" → "6282111367154"
   b. Query users table: SELECT * FROM users WHERE phone = '6282111367154'
   c. Find: User dengan user_id='NTxK6aQ001', name='Clarence'
   d. Create/Find ChatSession untuk customer + Clarence
   e. Save message ke chat_messages
   f. Generate AI reply (ChatGPT/Claude/PrivateAgent)
   g. Send reply ke customer via WATI API
   h. Save reply ke chat_messages
   i. Emit Socket.io ke Clarence's dashboard (realtime notification)

5. Clarence lihat di WATI app atau custom dashboard:
   "New message from +6281234567890: Halo, berapa harga..."
   AI reply sudah disiapkan atau menunggu Clarence reply
```

---

## Infrastruktur yang Dibutuhkan Per Agent

### Per Agent, TIDAK Perlu:
- ❌ API Key terpisah
- ❌ Account WATI terpisah
- ❌ Setup webhook terpisah
- ❌ Database terpisah

### Per Agent, HARUS Ada:
- ✅ WhatsApp Business Account (di device pribadi mereka)
- ✅ Phone number terdaftar di WATI (via QR scan)
- ✅ Row di User table dengan phone number yang match
- ✅ Access ke dashboard (web/mobile) untuk manage chat

---

## Cost Breakdown

**WATI Pricing untuk Setup Anda:**

```
WATI Plan: Team/Business
├─ Base: $149/bulan untuk unlimited messages
├─ Users: First 3 free, setiap user tambahan +$69/bulan
│   → 5 agents = 3 free + 2 @ $69 = $138/bulan
├─ Webhook: Included
└─ TOTAL: ~$287/bulan ≈ Rp 4.6 juta/bulan
```

**Cost per Agent: Rp 920.000/bulan (Shared infrastructure)**

---

## Security & Best Practices

### 1. Webhook Verification

**WATI bisa mengirim webhook dengan signature:**

```javascript
function verifyWatiSignature(req) {
  const signature = req.headers['x-wati-signature'];
  const timestamp = req.headers['x-wati-timestamp'];
  const secret = process.env.WATI_WEBHOOK_SECRET;
  
  // Verify HMAC SHA256
  const crypto = require('crypto');
  const message = `${timestamp}.${JSON.stringify(req.body)}`;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  if (hash !== signature) {
    throw new Error('Invalid WATI signature');
  }
}
```

### 2. Phone Number Privacy

**Encrypt sensitive phone numbers:**

```javascript
const crypto = require('crypto');

function encryptPhone(phone, key = process.env.ENCRYPTION_KEY) {
  const cipher = crypto.createCipher('aes192', key);
  return cipher.update(phone, 'utf8', 'hex') + cipher.final('hex');
}

function decryptPhone(encrypted, key = process.env.ENCRYPTION_KEY) {
  const decipher = crypto.createDecipher('aes192', key);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
```

### 3. Rate Limiting per Agent

```javascript
const rateLimit = require('express-rate-limit');

// 100 messages per agent per minute
const watiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 100,                  // 100 requests
  keyGenerator: (req) => {
    // Rate limit by nomor agent (to field)
    return req.body.to || 'unknown';
  }
});

app.post('/api/wati/webhook', watiLimiter, watiChatController.handleInboundMessage);
```

---

## Testing Sebelum Go-Live

### Test 1: Manual Message via WATI App

```
1. Open WATI Dashboard
2. Go to "Send Message"
3. Type customer number: +628xxxxxxxxx
4. Message: "Test dari Clarence"
5. Check backend logs → webhook received?
6. Check database → message saved?
7. Check Slack/Email → notification sent?
```

### Test 2: Duplicate Message Handling

```
WATI bisa retry webhook kalau timeout.
Test:
1. Send message
2. Kill backend (simulating timeout)
3. Restart backend
4. WATI retry webhook
5. Backend should detect duplicate (by messageId)
6. Should NOT create duplicate in database
```

### Test 3: Phone Number Normalization

```
Test dengan berbagai format:
- "+62 821-1136-7154" → Should match Clarence ✓
- "0821 1136 7154" → Should match Clarence ✓
- "6282111367154" → Should match Clarence ✓
- "082111367154" → Should match Clarence ✓
```

### Test 4: Load Test dengan 5 Agent Simultan

```
Send messages ke semua 5 nomor secara bersamaan.
Check:
- Response time < 2 detik per message
- No chat tertukar antar agent
- Database integrity (FK, unique keys valid)
```

---

## Checklist Setup WATI

- [ ] **Week 1 - Setup:**
  - [ ] Buat WATI account
  - [ ] Verify domain dengan WATI
  - [ ] Add 5 phone numbers (scan QR untuk setiap device)
  - [ ] Setup webhook URL di WATI dashboard
  - [ ] Generate & save WATI_API_TOKEN ke .env

- [ ] **Week 1 - Database:**
  - [ ] Update User table: pastikan semua agent phone number match WATI nomor
  - [ ] Normalize semua phone numbers ke format 628xxxxxxxxx
  - [ ] Create chat_sessions, chat_messages tables
  - [ ] Create idempotency index di messages.wati_message_id

- [ ] **Week 2 - Backend:**
  - [ ] Fix watiChatController.handleInboundMessage()
  - [ ] Implement phone normalization
  - [ ] Add webhook signature verification
  - [ ] Add duplicate detection (messageId check)
  - [ ] Implement AI reply generation

- [ ] **Week 2 - Testing:**
  - [ ] Test manual message via WATI app
  - [ ] Test webhook reception & logging
  - [ ] Test phone number matching (all formats)
  - [ ] Test duplicate handling
  - [ ] Load test dengan 5 agent

- [ ] **Week 3 - Deployment:**
  - [ ] Deploy to production
  - [ ] Setup monitoring & alerting
  - [ ] Go live!

---

## Summary: Jawaban Singkat

**Q: Apakah agent perlu daftar di WATI?**
A: **YA**, tapi bukan akun terpisah. Hanya perlu:
1. WhatsApp Business Account di device mereka
2. Scan QR code di WATI untuk link nomor ke 1 account WATI host

**Q: Apakah masing-masing nomor perlu API?**
A: **TIDAK**. 1 WATI account + 1 API token sudah cukup untuk semua 5 nomor.

**Q: Gimana cara match chat ke agent yang tepat?**
A: Webhook WATI menyertakan field "to" (nomor penerima). Backend:
1. Normalize nomor
2. Query User table dengan phone
3. Dapat agent_id
4. Proses dengan agent_id yang sudah dipastikan

---

## Environment Variables yang Diperlukan

```bash
# .env
WATI_API_TOKEN=wati_2688d36b-1f09-41b6-b09d-1872e6ce6c8e.xxxxx
WATI_API_URL=https://api.wati.io
WATI_WEBHOOK_SECRET=your_webhook_secret_from_wati_dashboard

# Phone number format (for testing)
AGENT_PHONES_CLARENCE=+62821-1136-7154,0821-1136-7154,6282111367154
AGENT_PHONES_DESY=+62821-1331-8191
AGENT_PHONES_NIGEL=082233556796,6282233556796
AGENT_PHONES_IFAN=0881-0365-8887,6288810365888
AGENT_PHONES_LEO=+62813-3470-8691
```

---

Done! Sekarang mari saya perbaiki watiChatController dengan format yang lebih rapi.

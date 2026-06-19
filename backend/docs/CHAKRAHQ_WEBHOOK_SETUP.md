# ChakraHQ Webhook Setup Guide

## 📋 Overview

ChakraHQ adalah WhatsApp multi-agent platform mirip Fonnte. Dokumentasi ini menjelaskan cara setup webhook ChakraHQ agar Elevan Property dapat menerima dan membalas pesan customer.

---

## 🔑 1. Get API Key dari ChakraHQ Dashboard

### Step 1: Login ke ChakraHQ Admin
1. Buka https://app.chakrahq.com/admin/
2. Login dengan akun agent (setiap agent punya akun terpisah)

### Step 2: Generate API Key
1. Pergi ke menu **"WhatsApp API Integration"** atau **"API Integration"**
2. Klik tombol **"Generate API Key"** atau **"New ApiKey"**
3. Copy **Access Token** (panjang, format random string)
   - Contoh: `E4Zz3df86V4agaU6rqafQOecGE7y6VcBnhn...`
4. Simpan token ini — ini adalah `chakra_hq_token`

### Step 3: Simpan Token ke Database

Opsi A — Via UI Profile Page:
```
1. Login ke Elevan Property: http://localhost:5173/login
2. Pergi ke Profile: http://localhost:5173/profile
3. Scroll ke field "ChakraHQ Token"
4. Paste Access Token yang sudah di-copy
5. Klik "Simpan Perubahan"
```

Opsi B — Via Direct Database:
```sql
UPDATE users 
SET chakra_hq_token = 'E4Zz3df86V4agaU6rqafQOecGE7y...' 
WHERE name = 'LEO FELIX';
```

Opsi C — Via API Endpoint (dengan curl):
```bash
curl -X PUT http://localhost:5005/api/profile/update-agent \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "LEO FELIX",
    "phone": "0881036588874",
    "password": "your_password",
    "chakra_hq_token": "E4Zz3df86V4agaU6rqafQOecGE7y6VcBnhn..."
  }'
```

---

## 🪝 2. Setup Webhook URL di ChakraHQ Dashboard

### Step 1: Dapatkan Webhook URL

Jika running **locally** (development):
- Pakai ngrok untuk expose localhost ke internet
  ```bash
  ngrok http 5005
  # Output: https://abc123-def456.ngrok-free.dev
  ```

Jika running di **server** (production):
- URL adalah domain server Anda
  - Contoh: `https://elevan-property.com`

### Step 2: Set Webhook URL di ChakraHQ

1. Buka https://app.chakrahq.com/admin/
2. Pergi ke menu **"Chat Settings"** atau **"Webhook Settings"**
3. Cari field **"Webhook URL"** atau **"Message Webhook"**
4. Masukkan salah satu dari:
   - `https://abc123-def456.ngrok-free.dev/api/chakrahq/webhook` (prioritas — endpoint khusus)
   - `https://abc123-def456.ngrok-free.dev/` (fallback — root handler di server.js)
5. Method: pilih **POST**
6. Klik **Save** atau **Apply**

### Step 3: Test Webhook Connection

Di ChakraHQ dashboard, cari tombol **"Test Webhook"** atau **"Send Test"**
- Jika ✅ (status 200), webhook siap
- Jika ❌ (timeout/error), cek:
  - URL benar dan dapat di-akses dari internet
  - Firewall tidak memblokir
  - ngrok masih running (jika local)

---

## 📨 3. Payload Format ChakraHQ

ChakraHQ mengirim webhook dengan format JSON:

### Incoming Message Payload
```json
{
  "choices": [],
  "device": "0881036588874",           // ← Nomor WA agent yang terima
  "extension": "",
  "filename": "",
  "inboxid": 12345,
  "isforwarded": false,
  "isgroup": false,
  "location": "",
  "memberlid": "",
  "message": "...",                     // ← Field sekunder (sering kosong)
  "pesan": "Mau beli rumah",            // ← FIELD UTAMA (isi pesan sebenarnya) ✅
  "mode": "lid",
  "name": "Mikhael Jefferson",
  "pengirim": "6285748094855",          // ← Nomor customer (juga ada field "phone")
  "pollname": "",
  "pushname": "Mikhael Jefferso"
}
```

### Field yang Penting:
| Field | Type | Deskripsi | Contoh |
|-------|------|-----------|--------|
| `pesan` | string | **MAIN** — Isi pesan customer | "Mau beli rumah" |
| `pengirim` atau `phone` | string | Nomor customer (format 62xxx) | "6285748094855" |
| `device` | string | Nomor WA agent yang terima | "0881036588874" |
| `name` atau `pushname` | string | Nama customer | "Mikhael Jefferson" |
| `inboxid` | number | Message ID unik | 12345 |

---

## 🔄 4. Request Flow: Pesan → Processing → Reply

```
Customer kirim WA ke nomor agent ChakraHQ
    ↓
ChakraHQ server → POST /api/chakrahq/webhook (Elevan backend)
    ↓
server.js root handler atau chakraHQController.handleInboundMessage
    ↓
1. Extract fields (phone, pesan, device, name)
2. Match agent by device phone (dari DB users)
3. Check: hasPropertyKeyword(pesan)?
    - YES → generateWhatsAppAIReply → save to DB → send reply via ChakraHQ API
    - NO → log "bukan query properti", return (tidak kirim)
    ↓
AI reply ready → sendViaChakraHQ(...)
    ↓
ChakraHQ API POST /v1/ext/message/send-text
    ↓
Message sent to customer ✅
```

---

## 🧪 5. Testing dengan Simulate Endpoint

### Curl Test (Local):
```bash
# Test incoming message (butuh login)
curl -X POST http://localhost:5005/api/chakrahq/simulate \
  -H "Authorization: Bearer <access_token_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "6285748094855",
    "message": "Mau beli rumah di Jakarta",
    "device": "0881036588874",
    "name": "Mikhael Jefferson",
    "dry_run": false
  }'
```

### Response jika sukses:
```json
{
  "success": true,
  "message": "Simulate selesai. Lihat terminal untuk output.",
  "agent": "LEO FELIX",
  "sender": "6285748094855"
}
```

### Check di Terminal:
```
[CHAKRAHQ] ⬇  PESAN PROPERTI MASUK & DIBALAS
[CHAKRAHQ] Agent    : LEO FELIX (088***8874)
[CHAKRAHQ] Customer : 628***4855 (Mikhael J.)
[CHAKRAHQ] Message  : Mau beli rumah di Jakarta
...
[CHAKRAHQ] Send Status: ✅ Terkirim
```

---

## 🔍 6. Debugging Checklist

### Pesan diterima tapi tidak dibalas?
```
1. Cek message field:
   - Terminal harus tampil "[CHAKRAHQ] 💬 Message: ..."
   - Jika field "pesan" vs "message" salah → lihat rawnya di log
   
2. Cek property keyword:
   - Terminal akan tampil:
     ✅ "[CHAKRAHQ] ⬇  PESAN PROPERTI MASUK & DIBALAS" → OK
     ❌ "[CHAKRAHQ] ⬇  PESAN MASUK (bukan query properti)" → keyword tidak match
   
3. Jika keyword tidak match:
   - Pastikan message punya tipe properti (rumah/villa/apartemen/dll)
   - Pastikan message punya action word (sewa/beli/cari/ada/dll)
   - Contoh valid: "Mau beli rumah", "Sewa villa di Jakarta", "Ada apartemen?"
   - Contoh invalid: "Kirimno aku", "Nasi bakar", "Mau tanya wisata"
```

### Webhook tidak terkoneksi?
```
1. Cek ngrok (jika local):
   - ngrok window masih terbuka? → jangan close
   - URL ngrok berubah setelah restart? → update di ChakraHQ dashboard
   
2. Cek firewall:
   - Port 5005 allow incoming?
   - ISP tidak block webhook? → coba ngrok inspect: http://localhost:4040
   
3. Test webhook URL:
   curl -X POST https://your-url/api/chakrahq/webhook \
     -H "Content-Type: application/json" \
     -d '{"pesan":"test","phone":"6285748094855","device":"0881036588874"}'
   # Should return: {"status":true,"type":"incoming",...}
```

### API Send Error?
```
1. Cek token di DB:
   SELECT chakra_hq_token FROM users WHERE name='LEO FELIX';
   # Should return non-empty token
   
2. Cek token validity:
   curl -X POST https://api.chakrahq.com/v1/ext/chat \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"limit":1}'
   # If 401/403 → token invalid or expired
   
3. Check logs:
   [CHAKRAHQ] Send attempt 1/3 failed (ETIMEDOUT). Retry in 3000ms…
   [CHAKRAHQ] Send attempt 2/3 failed (401 Unauthorized)...
   # Lihat error code untuk debug lebih lanjut
```

---

## 📊 7. Environment Variables

Tambah/update di `backend/.env`:

```env
# ChakraHQ Send Config (WAJIB untuk kirim pesan — per nomor WA terhubung)
CHAKRAHQ_PLUGIN_ID=                 # UUID plugin WhatsApp (WhatsApp Setup → ⋮ → Copy Plugin Id)
CHAKRAHQ_PHONE_NUMBER_ID=           # Meta phone number id (WhatsApp Setup → ⚙ kolom phone number)
CHAKRAHQ_API_VERSION=v21.0          # Versi Meta Graph API

# ChakraHQ API Settings
CHAKRAHQ_TIMEOUT_MS=30000           # Timeout per request (ms)
CHAKRAHQ_RETRY_COUNT=3              # Retry attempts
CHAKRAHQ_RETRY_DELAY_MS=3000        # Initial retry delay (ms)

# Terminal Display
MASSEGE_TERMINAL=CHAKRAHQ           # Aktifkan ChakraHQ logging di terminal
# Atau multi-platform: MASSEGE_TERMINAL=FONNTE,CHAKRAHQ,WATI
```

---

## 🚀 8. Production Checklist

```
✅ API Key tersimpan di database (chakra_hq_token)
✅ Webhook URL terdaftar di ChakraHQ dashboard
✅ Webhook URL pointing ke domain production (bukan ngrok)
✅ SSL certificate valid (HTTPS)
✅ Firewall allow port 5005 (atau reverse proxy)
✅ Test dengan pesan real: "Mau beli rumah" → terima reply AI
✅ Monitor terminal logs (MASSEGE_TERMINAL=CHAKRAHQ)
✅ Database backup (customer chats di chat_messages table)
✅ Rate limiting aktif (120 req/min di webhook)
```

---

## 📞 API Reference

### ChakraHQ Base URL
```
https://api.chakrahq.com/v1/ext/
```

### Send Session Message Endpoint (format Meta WhatsApp Cloud API)
```
POST /v1/ext/plugin/whatsapp/{pluginId}/api/{apiVersion}/{phoneNumberId}/messages
Authorization: Bearer {chakra_hq_token}
Content-Type: application/json

Request Body:
{
  "messaging_product": "whatsapp",
  "to": "6285748094855",
  "type": "text",
  "text": { "body": "Halo! Kami siap membantu cari properti." }
}

Response (sukses):
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "6285748094855", "wa_id": "6285748094855" }],
  "messages": [{ "id": "wamid...." }]
}
```

> ⚠️ Session message HANYA boleh dikirim dalam 24 jam setelah customer terakhir
> mengirim pesan. Di luar jendela itu wajib pakai **template message**
> (`/send-template-message`) dengan template yang sudah di-approve WhatsApp.

**Path params (set di `backend/.env`):**
| Param | .env | Cara dapat |
|-------|------|-----------|
| `pluginId` | `CHAKRAHQ_PLUGIN_ID` | WhatsApp Setup → ikon ⋮ di samping Save → **Copy Plugin Id** |
| `apiVersion` | `CHAKRAHQ_API_VERSION` | pilih versi, mis. `v21.0` (default) |
| `phoneNumberId` | `CHAKRAHQ_PHONE_NUMBER_ID` | WhatsApp Setup → ⚙ di "📞 WhatsApp Phone Numbers" → Meta ID di kolom phone number |

### List Chats Endpoint
```
POST /chat
Authorization: Bearer {chakra_hq_token}
Content-Type: application/json

Request Body:
{
  "orderField": "createdAt",
  "limit": 50,
  "page": 1
}
```

---

## 🎓 Troubleshooting Scenario

### Scenario: "Mau beli rumah" masuk tapi tidak di-reply

**Log Output:**
```
[CHAKRAHQ] 💬 Message: Mau beli rumah
[CHAKRAHQ] ⬇  PESAN MASUK (bukan query properti — tidak dibalas)
```

**Debug:**
1. Pesan "Mau beli rumah" seharusnya match property keyword
2. "rumah" ✅ ada di PROPERTY_TYPES
3. "beli" ✅ ada di ACTION_WORDS
4. Seharusnya return TRUE → `hasPropertyKeyword("mau beli rumah")`

**Kemungkinan penyebab:**
- ❌ Field extraction salah (ambil dari "message" bukan "pesan")
  - **FIX**: Sudah diperbaiki di `extractFields()` — prioritas ke "pesan"
- ❌ Off-topic guard filter
  - **CHECK**: `isOffTopic()` return TRUE?
  - **FIX**: Pesan "Mau beli rumah" bukan off-topic

**Solusi:**
1. Restart backend: `npm run dev`
2. Test ulang dengan curl atau WhatsApp real
3. Lihat terminal log untuk debugging

---

## 📝 Notes

- ChakraHQ format berbeda dari Fonnte — lihat `extractFields()` di chakraHQController.js
- Field utama adalah `pesan`, bukan `message`
- Token expire — ganti di profile jika reply tidak masuk 401
- Support multi-agent — setiap agent punya token sendiri
- Session tracking — per customer per agent (source: `chakrahq_agent_name`)

---

**Last Updated:** 2026-06-18  
**Reference:** chakraHQController.js, propertyKeywordFilter.js


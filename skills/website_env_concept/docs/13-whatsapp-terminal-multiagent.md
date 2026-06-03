# 13. WhatsApp Terminal Multi-Agent
## (fonnteChatController · watiChatController · dialogChatController)

> Tiga controller yang menangani pesan WhatsApp masuk dari platform berbeda.
> Semua menggunakan **keyword filter** yang sama agar hanya merespons pesan terkait properti.

---

## Arsitektur Umum

```
Customer kirim WA
        ↓
Platform (Fonnte / WATI / 360dialog)
        ↓ webhook
NGROK → backend POST / atau POST /api/[platform]/webhook
        ↓
Controller terima payload
        ↓
detectEventType() → incoming / status / unknown
        ↓
simpan pesan ke DB (SELALU, terlepas dari keyword)
        ↓
hasPropertyKeyword(message)?
    ├── TIDAK → log "📥 Disimpan, tidak dibalas" → SELESAI
    └── YA  → getWhatsappPropertyContext(message)
                    ↓
                Coba Rumah123 live (Apify token)
                    ↓ gagal/kosong
                Fallback: backend/asset/json_data/flat.json
                    ↓
                generateAIReply(session, message, agent, ctx)
                    ↓
                ChatGPT → Claude → Private Agent
                    ↓
                simpan AI reply + kirim ke WA
                    ↓
                LOG RINGKASAN TERMINAL (satu blok di akhir)
```

---

## MASSEGE_TERMINAL — Switch Platform

```env
# backend/.env
MASSEGE_TERMINAL=FONNTE           # Hanya Fonnte log ke terminal
MASSEGE_TERMINAL=DIALOG           # Hanya 360dialog log ke terminal
MASSEGE_TERMINAL=WATI             # Hanya WATI log ke terminal
MASSEGE_TERMINAL=FONNTE,DIALOG    # Fonnte + Dialog (multi)
MASSEGE_TERMINAL=FONNTE,DIALOG,WATI  # Semua
```

**Catatan:** `MASSEGE_TERMINAL` mengontrol tampilan terminal saja.
Semua platform tetap memproses pesan dan menyimpan ke DB.

---

## Root POST Handler (server.js)

Fonnte dan platform lain terkadang dikonfigurasi ke base URL tanpa path.
Backend menangani ini via handler di root:

```javascript
app.post('/', (req, res) => {
  const active = (process.env.MASSEGE_TERMINAL || 'FONNTE').split(',')[0].trim();
  if (active === 'FONNTE') return FonnteChatController.handleInboundMessage(req, res);
  if (active === 'DIALOG') return DialogChatController.handleInboundMessage(req, res);
  if (active === 'WATI')   return WatiChatController.handleInboundMessage(req, res);
});
```

Jika Fonnte Dashboard webhook = `https://ngrok-url/` (tanpa path) → tetap diterima.

---

## Property Keyword Filter

**File:** `backend/utils/propertyKeywordFilter.js`

### Logika Dua Kondisi

```
(Tipe Properti + Kata Aksi) ATAU Kata Kunci Mandiri
```

**Tipe Properti** (harus ada salah satu):
- rumah *(kecuali "rumah makan", "rumah sakit", "rumah tangga")*
- apartemen, apartment, apt *(word boundary — tidak match "laptop")*
- villa, vila, kost, kos, kosan, boarding
- ruko, shophouse, toko *(word boundary)*
- kantor, office, gudang, warehouse
- hotel, motel, kavling, properti, perumahan, cluster

**Kata Aksi** (harus ada salah satu, valid hanya bersama Tipe Properti):
- sewa, rental, ngontrak, beli, jual, cari, nyari
- ada, available, kosong, ready, listing, unit, stok
- harga, berapa, cicilan, dp, uang muka
- mau, ingin, pengen, butuh, tanya, nanya

**Kata Kunci Mandiri** (trigger tanpa perlu Tipe Properti):
- kpr, over kredit, inden, perumahan, real estate
- siap huni, ready unit, ready stok, unit ready, ada unit
- dp rumah, cicilan rumah, uang muka rumah
- agen properti, developer, shm, hgb, listing properti

### Contoh Nyata

| Pesan | Trigger? | Alasan |
|---|---|---|
| "sewa rumah 3 kamar" | ✅ YA | "sewa"(aksi) + "rumah"(tipe) |
| "ada apartemen kosong?" | ✅ YA | "ada"(aksi) + "apartemen"(tipe) |
| "KPR syariah berapa persen?" | ✅ YA | "kpr" (mandiri) |
| "jual tanah kavling murah" | ✅ YA | "jual"(aksi) + "tanah"(tipe) + "kavling"(mandiri) |
| "mau tanya soal perumahan" | ✅ YA | "tanya"(aksi) + "perumahan"(tipe) |
| **"Km mau cari bebek goreng?"** | ❌ TIDAK | "cari"(aksi) tapi TIDAK ada tipe properti |
| **"sewa mobil dong"** | ❌ TIDAK | "sewa"(aksi) tapi "mobil" bukan tipe properti |
| **"jual laptop bekas"** | ❌ TIDAK | "jual"(aksi) + "laptop" bukan tipe + "apt" tidak match karena word boundary |
| **"rumah makan enak dimana"** | ❌ TIDAK | "rumah makan" dikecualikan |
| **"cari wisata bali"** | ❌ TIDAK | "cari"(aksi) tapi tidak ada tipe properti |
| **"sewa tenda acara"** | ❌ TIDAK | "sewa" + "tenda" bukan properti |
| **"sewa baju pengantin"** | ❌ TIDAK | "sewa" + "baju" bukan properti |

---

## Property Context (whatsappPropertyContext.js)

**File:** `backend/utils/whatsappPropertyContext.js`

Dipanggil saat pesan lulus keyword filter.

```
getWhatsappPropertyContext(customerMessage)
    ↓
extractLocationFromMessage("cari rumah di surabaya") → "surabaya"
extractPropertyTypeFromMessage(...) → "house"
extractTransactionTypeFromMessage(...) → "sale"
    ↓
[1] Coba Rumah123 live (jika APIFY_API_TOKEN ada & quota)
    getRumah123Listings({ location, propertyType, listingType })
    formatRumah123ContextForLLM(listings)
    ↓ jika gagal/kosong
[2] Fallback: backend/asset/json_data/indonesia_property_36_provinces_flat.json
    searchFlatJson(location, propertyType, transactionType)
    formatFlatJsonForLLM(properties)
    ↓
return { contextText, source: 'rumah123'|'flat_json' }
```

Context ini diinjeksi ke AI prompt → AI memberikan jawaban dengan data properti nyata.

---

## Controller 1 — fonnteChatController

**File:** `backend/controllers/fonnteChatController.js`
**Endpoint:** `POST /api/fonnte-chat/webhook` (dan `POST /` via root handler)

### Agent Setup
```
DB: users.fonnte_token = [token dari Fonnte Dashboard]
DB: users.phone = nomor WA terdaftar di Fonnte (harus cocok dengan field "device")
```

### Agent Saat Ini
| Agent | Phone | Token | Status |
|---|---|---|---|
| LEO FELIX | 0881036588874 | PiBSZQXu6HKWhKkEDu9e | ✅ Connected |
| NIGEL KUNCORO | 082233556796 | m5HDmV4hAYRFBgTdkfDR | ⚠️ Disconnected |
| CLARENCE MARIO | 0821-1136-7154 | NULL | ❌ Belum setup |
| DESY TALIM | 0821-1331-8191 | NULL | ❌ Belum setup |
| IFAN TJANDRA | +62881036588874 | NULL | ❌ Belum setup |
| IFAN ELDY | 0881-0365-88874 | NULL | ❌ Belum setup |

### Fonnte Dashboard Config
```
Webhook ?        : https://[ngrok]/api/fonnte-chat/webhook   ← incoming messages
Webhook Status ? : https://[ngrok]/api/fonnte-chat/webhook   ← read receipts
Webhook Chaining?: https://[ngrok]/api/fonnte-chat/chaining  ← alternative incoming
```

### Agent Routing (3 Strategi)
```
1. device field match → cari agent by phone di DB
2. fallback → auto-select agent pertama yang punya fonnte_token
```

### Terminal Log Format
```
──────────────────────────────────────────────────────────────────
[FONNTE] ⬇  PESAN PROPERTI MASUK
[FONNTE]    Agent    : LEO FELIX (0881036588874)
[FONNTE]    Customer : 628xxx (Nama Customer)
[FONNTE]    Time     : 2026-06-03T10:00:00.000Z
[FONNTE]    Message  : sewa rumah 3 kamar di surabaya
[FONNTE]    Context  : flat_json     ← atau 'rumah123'
[FONNTE]    AI       : chatgpt       ← provider yang digunakan
[FONNTE]    Reply    : Berikut pilihan rumah...
[FONNTE]    Send     : ✅ Terkirim ke 628xxx
──────────────────────────────────────────────────────────────────
```

### API Endpoints
```
POST /api/fonnte-chat/webhook           ← Fonnte Dashboard target
POST /api/fonnte-chat/chaining          ← Chaining mode
POST /api/fonnte-chat/webhook-raw       ← Debug semua payload
POST /api/fonnte-chat/simulate          ← Test tanpa WA asli
GET  /api/fonnte-chat/status            ← Status semua agent
GET  /api/fonnte-chat/agents            ← Daftar agent aktif
GET  /api/fonnte-chat/agent-chats/:name ← Chat per agent
GET  /api/fonnte-chat/chat-history/:id  ← History sesi
GET  /api/fonnte-chat/debug-info        ← Diagnostik phone normalization
GET  /api/fonnte-chat/check-fonnte-api  ← Test Fonnte API connection
GET  /api/fonnte-chat/poller-status     ← Status poller
POST /api/fonnte-chat/poller-start      ← Start poller
POST /api/fonnte-chat/poller-stop       ← Stop poller
```

---

## Controller 2 — watiChatController

**File:** `backend/controllers/watiChatController.js`
**Endpoint:** `POST /api/wati/webhook`

### Status: ⚠️ Code Ready — WA Channel Belum Connect

### WATI Setup
```
WATI_API_TOKEN = [dari WATI Dashboard]
WATI_API_URL   = https://live.wati.io/[account_id]/api/v1
```

### Perbedaan WATI vs Fonnte
- **WATI**: 1 nomor WA bisnis untuk semua agent (routing by agent name/session)
- **Fonnte**: Setiap agent punya nomor WA sendiri (routing by device phone)

### Webhook Payload (WATI)
```json
{
  "waId": "628xxx",          ← nomor customer
  "text": { "body": "..." }, ← isi pesan
  "senderName": "Nama",
  "assignedTo": "agent_name"
}
```

### API Endpoints
```
POST /api/wati/webhook
GET  /api/wati/agent-chats/:agentName
GET  /api/wati/chat-history/:sessionId
GET  /api/wati/agents/list
GET  /api/wati/status
```

---

## Controller 3 — dialogChatController (360dialog)

**File:** `backend/controllers/dialogChatController.js`
**Endpoint:** `POST /api/dialog-chat/webhook`

### Status: ✅ Code Ready — Token Belum Diisi di DB

### 360dialog API
```
Sandbox URL : https://waba-sandbox.360dialog.io
Prod URL    : https://waba-v2.360dialog.io
Auth header : D360-API-KEY: [token]
Send endpoint: POST /v1/messages
Webhook config: POST /v1/configs/webhook
```

### Setup Sandbox
```
1. Kirim "START" ke +551146733492 via WA → dapat API key
2. Simpan ke DB:
   UPDATE users SET dialog360_token='[KEY]' WHERE name='[AGENT]';
3. Daftarkan webhook:
   POST /api/dialog-chat/setup-webhook
   Body: { "agentId": "[user_id]" }
4. Webhook dikirim dengan header X-Agent-Id → backend identifikasi agent
```

### Webhook Payload (360dialog)
```json
{
  "contacts": [{ "profile": { "name": "Nama" }, "wa_id": "628xxx" }],
  "messages": [{
    "from": "628xxx",
    "id": "wamid.XXX",
    "text": { "body": "pesan teks" },
    "timestamp": "1716800000",
    "type": "text"
  }]
}
```

### DB Column
```sql
ALTER TABLE users ADD COLUMN dialog360_token VARCHAR(200) NULL AFTER fonnte_token;
-- Auto-migrasi di server.js (ensureRequiredDatabaseColumns)
```

### API Endpoints
```
POST /api/dialog-chat/webhook          ← 360dialog target
POST /api/dialog-chat/setup-webhook    ← Daftarkan webhook ke 360dialog
POST /api/dialog-chat/simulate         ← Test tanpa WA
GET  /api/dialog-chat/status           ← Status semua agent
GET  /api/dialog-chat/agents           ← Agent dengan token aktif
GET  /api/dialog-chat/agent-chats/:name
GET  /api/dialog-chat/chat-history/:id
```

---

## Shared Utilities

### `backend/utils/propertyKeywordFilter.js`
```javascript
hasPropertyKeyword(message)           // → boolean, main check
extractLocationFromMessage(message)   // → "surabaya" | ""
extractPropertyTypeFromMessage(msg)   // → "house"|"apartment"|"villa"|...
extractTransactionTypeFromMessage(msg)// → "sale"|"rent"|""
```

### `backend/utils/whatsappPropertyContext.js`
```javascript
getWhatsappPropertyContext(customerMessage)
// → { contextText: string, source: 'rumah123'|'flat_json', location, propertyType, transactionType }
```

### `backend/utils/terminalSwitch.js`
```javascript
isTerminalActive('FONNTE')   // → true jika MASSEGE_TERMINAL mengandung FONNTE
isTerminalActive('DIALOG')   // → true jika MASSEGE_TERMINAL mengandung DIALOG
isTerminalActive('WATI')     // → true jika MASSEGE_TERMINAL mengandung WATI
getActiveTerminals()         // → ['FONNTE'] | ['FONNTE','DIALOG'] | ...
```

---

## Quick Diagnostics

```bash
# Cek status semua agent
curl http://localhost:5005/api/fonnte-chat/status
curl http://localhost:5005/api/dialog-chat/status
curl http://localhost:5005/api/wati/status

# Simulate pesan properti (test pipeline)
curl -X POST http://localhost:5005/api/fonnte-chat/simulate \
  -H "Content-Type: application/json" \
  -d '{"sender":"628xxx","message":"sewa rumah 3 kamar surabaya","name":"Test"}'

# Test keyword filter (via webhook simulasi)
curl -X POST http://localhost:5005/ \
  -H "Content-Type: application/json" \
  -d '{"sender":"628xxx","name":"Test","message":"cari bebek goreng","device":"62xxx","inboxid":"T1"}'
# → Harus: { status: true, type: "incoming" } tapi DI TERMINAL: "📥 Disimpan, tidak dibalas"
```

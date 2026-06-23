# 09. WhatsApp Terminal Multi-Agent
## (fonnteChatController · chakraHQController · timelinesAIChatController)

> Tiga controller yang menangani pesan WhatsApp masuk dari platform berbeda
> (**Fonnte, ChakraHQ, TimelinesAI**). Semua menggunakan **keyword filter +
> context continuation** agar hanya merespons pesan terkait properti — termasuk
> jawaban singkat lanjutan percakapan. Pipeline AI-nya identik (whatsappAIService).
> (WATI/360dialog = legacy, tidak lagi dipakai sebagai terminal platform.)

---

## Alur Proses Lengkap (Updated Juni 2026)

```
Customer kirim WA
        ↓
Platform (Fonnte / ChakraHQ / TimelinesAI)
        ↓ webhook
NGROK → backend POST / atau POST /api/[platform]/webhook
        ↓
Controller terima payload
        ↓
detectEventType() → incoming / status / unknown
        ↓
findOrCreateSession() → ChatSession di DB
        ↓
Simpan pesan customer ke DB (SELALU, terlepas dari keyword)
        ↓
hasPropertyKeyword(message)?
    └── YA ─────────────────────────────────────────────────────→ ⬇ lanjut
    └── TIDAK → getConversationHistory(session.id, 6)
                      ↓
              isPropertyContextContinuation(message, history)?
                  ├── TIDAK → log "📥 Disimpan, tidak dibalas" → SELESAI
                  └── YA  → ⬇ lanjut
        ↓
generateWhatsAppAIReply({ session, message, agentName })
    ↓
    [1] getWhatsappPropertyContext(message)
           → Coba Rumah123 (APIFY + RUMAH123_DATA=ON)
           → Fallback: backend/asset/json_data/flat.json
    [2] getConversationHistory(session.id, 10)
    [3] ChatGPT → Claude (via generateWhatsappReplyWithProviderFallback)
    [4] Private Agent → generateResponseForTerminalMassege() [fallback]
        ↓
Simpan AI reply ke DB
        ↓
Kirim balasan via platform API (Fonnte / ChakraHQ / TimelinesAI)
        ↓
LOG RINGKASAN TERMINAL (full response, tidak truncated)
```

---

## Context-Aware Continuation (NEW — Juni 2026)

**File:** `backend/utils/propertyKeywordFilter.js`
**Fungsi:** `isPropertyContextContinuation(message, history)`

### Problem yang Diselesaikan

```
AI bertanya  : "Untuk Gudang yang Anda cari — rencananya untuk sewa atau beli? 🏠"
Customer balas: "saya beli"

hasPropertyKeyword("saya beli") = FALSE  ← tidak ada property type keyword
→ Tanpa context check: pesan DIABAIKAN ❌

isPropertyContextContinuation("saya beli", history) = TRUE  ← ada konteks properti
→ Dengan context check: pesan DIBALAS ✅
```

### Logika Deteksi (5 Kondisi Harus Terpenuhi)

1. **Pesan ≤ 70 karakter** — panjang pesan baru memperkenalkan topik baru
2. **Bukan topik non-property jelas** — tidak ada "makanan", "mobil", "laptop", dll
3. **5 pesan terakhir ada konteks properti** — histori terbaru bicara tentang properti
4. **Pesan AI terakhir ada pertanyaan properti** — "sewa atau beli?", "harga berapa?", dll
5. **Pesan saat ini cocok pola jawaban:**
   - Transaksi: "sewa", "beli", "rental", "purchase"
   - Harga: "500 juta", "3 miliar", "di bawah 2M"
   - Lokasi: nama kota, "di jakarta"
   - Afirmatif: "ya", "oke", "tampilkan", "lanjut"
   - Spesifikasi: "furnished", "3 kamar", "50m2"
   - Angka murni: "500000000"

### Contoh Kasus

| Pesan | History Terakhir | Hasil |
|---|---|---|
| "saya beli" | AI tanya sewa/beli (property) | ✅ Continuation |
| "beli" | AI tanya sewa/beli (property) | ✅ Continuation |
| "sewa aja" | AI tanya sewa/beli (property) | ✅ Continuation |
| "500 juta" | AI tanya kisaran harga (property) | ✅ Continuation |
| "surabaya" | AI tanya lokasi (property) | ✅ Continuation |
| "furnished" | AI tanya furnishing (property) | ✅ Continuation |
| "ya" | AI ajukan pertanyaan (property) | ✅ Continuation |
| "tampilkan" | History properti | ✅ Continuation |
| "saya beli" | History kosong | ❌ Skip |
| "saya beli" | History non-property | ❌ Skip |
| "saya mau daging sapi" | History properti | ❌ Skip (topik baru) |
| "sewa mobil" | History properti | ❌ Skip (non-property) |

### Implementasi di Controller

```javascript
// Semua 3 controller menggunakan pattern ini:
const isPropertyQuery = hasPropertyKeyword(message);

let isContinuation = false;
if (!isPropertyQuery) {
  try {
    const history = await getConversationHistory(session.id, 6);
    isContinuation = isPropertyContextContinuation(message, history);
  } catch (_) { /* skip jika history gagal */ }
}

if (!isPropertyQuery && !isContinuation) {
  // Log "tidak dibalas" dan return
  return;
}
// Lanjut ke generateWhatsAppAIReply(...)
```

---

## MASSEGE_TERMINAL — Switch Platform

```env
# backend/.env
MASSEGE_TERMINAL=FONNTE                       # Hanya Fonnte log ke terminal
MASSEGE_TERMINAL=CHAKRAHQ                      # Hanya ChakraHQ
MASSEGE_TERMINAL=TIMELINESAI                   # Hanya TimelinesAI
MASSEGE_TERMINAL=FONNTE,CHAKRAHQ              # Fonnte + ChakraHQ (multi)
MASSEGE_TERMINAL=FONNTE,CHAKRAHQ,TIMELINESAI # Semua
```

`MASSEGE_TERMINAL` hanya mengontrol tampilan terminal. Semua platform tetap memproses dan simpan ke DB.

---

## Terminal Log Format (Updated — Full Response)

Semua 3 controller menampilkan format ini (tidak lagi truncated 80 chars):

```
════════════════════════════════════════════════════════════════════════════════
[FONNTE] ⬇  PESAN PROPERTI MASUK & DIBALAS
════════════════════════════════════════════════════════════════════════════════
Agent    : LEO FELIX (628813658874)
Customer : 628213311936 (Nigel)
Time     : 2026-06-05T10:30:45.123Z
Message  : saya butuh sewa hotel di surabaya
Context  : flat_json
AI       : chatgpt
════════════════════════════════════════════════════════════════════════════════
RESPONSE:
════════════════════════════════════════════════════════════════════════════════
⚠️ Maaf, belum ada listing yang tersedia di *Surabaya* dari Rumah123...

Namun berikut pilihan alternatif dari katalog saya...

1. *Surabaya Residential Area Boarding House Rent*
   ![...](/assets/image_data/properties/boarding_house.png)
   📍 Lokasi: Residential Area, Surabaya, Jawa Timur
   💰 Harga: *Rp 8.750.000 / month*
   ...

Salam hangat,
*LEO FELIX*
*Elevan Property*
════════════════════════════════════════════════════════════════════════════════
Send Status: ✅ Terkirim
════════════════════════════════════════════════════════════════════════════════
```

---

## Root POST Handler (server.js)

```javascript
app.post('/', (req, res) => {
  const active = (process.env.MASSEGE_TERMINAL || 'FONNTE').toUpperCase().split(',')[0].trim();
  if (active === 'FONNTE')      return FonnteChatController.handleInboundMessage(req, res);
  if (active === 'TIMELINESAI') return TimelinesAIChatController.handleInboundMessage(req, res);
  if (active === 'CHAKRAHQ')    return ChakraHQController.handleInboundMessage(req, res);
});
```
> Root `POST /` memakai **nilai pertama** `MASSEGE_TERMINAL` untuk routing webhook
> tanpa-path. Tiap platform juga punya endpoint sendiri (`/api/chakrahq/webhook`, dst.).

---

## Property Keyword Filter

**File:** `backend/utils/propertyKeywordFilter.js`

```javascript
// Export
hasPropertyKeyword(message)               // → boolean, main check
isPropertyContextContinuation(msg, hist)  // → boolean, NEW continuation check
extractLocationFromMessage(message)       // → "surabaya" | ""
extractPropertyTypeFromMessage(message)   // → "house"|"apartment"|"warehouse"|...
extractTransactionTypeFromMessage(message)// → "sale"|"rent"|""
```

### Dua Kondisi hasPropertyKeyword

```
(Tipe Properti + Kata Aksi)  ATAU  Kata Kunci Mandiri
```

**Tipe Properti** (salah satu harus ada):
- rumah *(kecuali "rumah makan", "rumah sakit", "rumah tangga")*
- apartemen, apartmen (typo OK), apartment, apt *(word boundary — tidak match "laptop")*
- villa, vila, kost, kos, kosan, boarding
- ruko, rukan, shophouse, toko *(word boundary)*
- kantor, office, perkantoran, gudang, warehouse, pergudangan
- hotel, motel, resort, kavling, properti, perumahan, cluster, hunian

**Kata Aksi** (harus bersama Tipe Properti):
- sewa, rental, ngontrak, beli, jual, cari
- ada, available, kosong, ready, listing
- harga, berapa, cicilan, dp, uang muka
- mau, ingin, pengen, butuh, tanya

**Kata Kunci Mandiri** (trigger tanpa Tipe Properti):
- kpr, over kredit, inden, perumahan, real estate
- siap huni, ready unit, dp rumah, cicilan rumah
- agen properti, developer, shm, hgb

---

## Property Context

**File:** `backend/utils/whatsappPropertyContext.js`

```
getWhatsappPropertyContext(customerMessage)
        ↓
Extract: location, propertyType, transactionType
        ↓
RUMAH123_DATA=ON? → getRumah123Listings() via Apify
        ↓ gagal/kosong atau OFF
flat JSON: backend/asset/json_data/indonesia_property_36_provinces_flat.json
        ↓
return { contextText, source: 'rumah123'|'flat_json', location, propertyType, transactionType }
```

Respects `RUMAH123_DATA` env var (ON/OFF) untuk konsistensi dengan chatbot.

---

## Controller 1 — fonnteChatController

**File:** `backend/controllers/fonnteChatController.js`
**Endpoint:** `POST /api/fonnte-chat/webhook` + `POST /` via root handler

### Agent di DB (`users` table)

| Agent | Phone | fonnte_token |
|---|---|---|
| LEO FELIX | 0881036588874 | ✅ Ada (connected & working) |
| NIGEL KUNCORO | 082233556796 | ✅ Ada (device disconnected) |
| CLARENCE MARIO | 0821-1136-7154 | ❌ NULL |
| DESY TALIM | 0821-1331-8191 | ❌ NULL |
| IFAN TJANDRA | +62881036588874 | ❌ NULL |
| KEZIA ELDY | 0851-6365-05872 | ❌ NULL |

Agent diisi token via halaman `/profile` → field "Fonnte API".

### API Endpoints

```
POST /api/fonnte-chat/webhook           ← Main Fonnte webhook
POST /api/fonnte-chat/chaining          ← Chaining mode
POST /api/fonnte-chat/simulate          ← Test tanpa WA asli
GET  /api/fonnte-chat/status            ← Status semua agent
GET  /api/fonnte-chat/agents            ← Agent dengan fonnte_token
GET  /api/fonnte-chat/agent-chats/:name
GET  /api/fonnte-chat/chat-history/:id
GET  /api/fonnte-chat/debug-info
GET  /api/fonnte-chat/check-fonnte-api
GET  /api/fonnte-chat/poller-status
POST /api/fonnte-chat/poller-start
POST /api/fonnte-chat/poller-stop
```

---

## Controller 2 — chakraHQController

**File:** `backend/controllers/chakraHQController.js`
**Endpoint:** `POST /api/chakrahq/webhook` (+ `POST /` bila `MASSEGE_TERMINAL` diawali CHAKRAHQ)
**Format:** Meta WhatsApp Cloud API (bukan format flat ala Fonnte).

### Inbound (webhook)
`extractFields()` mendukung 3 bentuk payload:
- **Meta pass-through**: `entry[].changes[].value.{messages,contacts,metadata}`
- **Chakra MessagePayload**: `{ message:{...}, contacts:[{wa_id, profile.name}], messageId }`
- **Legacy/simple** (fallback defensif): `{ phone/pengirim, pesan/message }`

Teks di `message.text.body`; pengirim `message.from`/`contacts[0].wa_id`.

### Send (session message — hanya dalam 24 jam setelah pesan customer)
```
POST https://api.chakrahq.com/v1/ext/plugin/whatsapp/{pluginId}/api/{apiVersion}/{phoneNumberId}/messages
Authorization: Bearer {chakra_hq_token}   ← per-agent (users.chakra_hq_token)
Body: { messaging_product:"whatsapp", to, type:"text", text:{ body } }
```
Konfigurasi `.env`: `CHAKRAHQ_PLUGIN_ID`, `CHAKRAHQ_PHONE_NUMBER_ID`,
`CHAKRAHQ_API_VERSION` (lihat WhatsApp Setup di dashboard ChakraHQ).

### API Endpoints
```
POST /api/chakrahq/webhook
POST /api/chakrahq/simulate
GET  /api/chakrahq/status
GET  /api/chakrahq/agents
GET  /api/chakrahq/check-api
```

---

## Controller 3 — timelinesAIChatController

**File:** `backend/controllers/timelinesAIChatController.js`
**Endpoint:** `POST /api/timelinesai/webhook` (+ `POST /` bila `MASSEGE_TERMINAL` diawali TIMELINESAI)
**Env:** `TIMELINESAI_API_KEY`

TimelinesAI mengelola satu/lebih nomor WA; controller mengikuti pipeline yang
sama (extract fields → match agent → `generateWhatsAppAIReply` → kirim balasan).
Detail field/endpoint spesifik: lihat `timelinesAIChatController.js`.

---

## Shared Utilities

```javascript
// backend/utils/terminalSwitch.js
isTerminalActive('FONNTE')  // → boolean
isTerminalActive('CHAKRAHQ')
isTerminalActive('TIMELINESAI')
getActiveTerminals()        // → ['FONNTE'] | ['FONNTE','CHAKRAHQ','TIMELINESAI'] | ...

// backend/services/sessionService.js
getConversationHistory(sessionId, limit)  // Used untuk context continuation check
```

---

## Quick Diagnostics

```bash
# Status semua agent
curl http://localhost:5005/api/fonnte-chat/status

# Simulate pesan properti (test full pipeline)
curl -X POST http://localhost:5005/api/fonnte-chat/simulate \
  -H "Content-Type: application/json" \
  -d '{"sender":"628213311936","message":"sewa rumah 3 kamar surabaya","name":"Test"}'

# Test context continuation (jawaban singkat)
# 1. Kirim pesan properti dulu
# 2. Lalu kirim: "saya beli" → harus dibalas (continuation dari langkah 1)

# Test non-property (harus diabaikan)
curl -X POST http://localhost:5005/ \
  -H "Content-Type: application/json" \
  -d '{"sender":"628xxx","name":"Test","message":"cari bebek goreng","device":"628xxx","inboxid":"T1"}'
# Terminal: "📥 Disimpan, tidak dibalas"

# Test context continuation (harus dibalas jika ada history properti)
curl -X POST http://localhost:5005/ \
  -H "Content-Type: application/json" \
  -d '{"sender":"628xxx","name":"Test","message":"saya beli","device":"628xxx","inboxid":"T2"}'
# Jika ada history property: dibalas; jika history kosong: diabaikan
```

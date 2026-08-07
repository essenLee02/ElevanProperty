# 09. WhatsApp Terminal Multi-Agent
## (fonnteChatController · kirimiChatController · timelinesAIChatController)

> Tiga controller yang menangani pesan WhatsApp masuk dari platform berbeda
> (**Fonnte, Kirimi, TimelinesAI**). Semua menggunakan **keyword filter +
> context continuation** agar hanya merespons pesan terkait properti — termasuk
> jawaban singkat lanjutan percakapan. Pipeline AI-nya identik (whatsappAIService).
> (ChakraHQ/WATI/360dialog = legacy, tidak lagi dipakai sebagai terminal platform.)

> **Sinkronisasi penuh (Juli 2026):** ketiga controller sekarang IDENTIK pada:
> fromMe guard (anti-loop balas pesan sendiri), filter pesan grup, dedup
> 2-layer (messageId in-memory + DB ChatMessage.metadata survive restart),
> cookie response timer (debounce pesan beruntun), dan deteksi kegagalan kirim
> yang lebih robust (cek banyak field respons + regex pesan gagal berbahasa
> Indonesia). Sebelumnya Kirimi paling lengkap, Fonnte/TimelinesAI tertinggal
> — sekarang semua fitur di-backport merata. Hanya bagian platform-specific
> (bentuk payload webhook, format API kirim, auth header) yang legitimately berbeda.

> **Dua env yang berbeda:** `MESSAGE_TERMINAL` (satu nilai) = sumber metadata
> `source` di log AI (`kirimi_whatsapp` / `timelinesai_whatsapp` / `fonnte_whatsapp`).
> `MASSEGE_TERMINAL` (boleh multi) = platform mana yang di-render ke terminal + routing `POST /`.

---

## Alur Proses Lengkap (Updated Juli 2026)

```
Customer kirim WA
        ↓
Platform (Fonnte / Kirimi / TimelinesAI)
        ↓ webhook
ngrok (auto-start) → backend POST / atau POST /api/[platform]/webhook
        ↓
Controller terima payload → log raw → detectEventType()
        ↓ bukan 'incoming' (status/sent/connection) → return 200, selesai
        ↓ 'incoming' → return 200 DULU, proses background (setImmediate):
        ↓
extract sender/name/message/messageId (+device_id utk Kirimi)
        ↓
fromMe guard: pesan dari nomor sendiri? → skip (anti-loop)  [SINKRON 3 controller]
        ↓
Filter pesan grup WhatsApp? → skip  [SINKRON 3 controller]
        ↓
Identifikasi agent (token/device/phone → users.*)
        ↓
Dedup layer 1: messageId in-memory (10 menit TTL)? → skip jika sudah diproses
        ↓
Dedup layer 2 (BARU, SINKRON 3 controller): query ChatMessage.metadata di DB
untuk messageId ini → skip jika sudah ada (survive restart/nodemon)
        ↓
COOKIE RESPONSE TIMER (BARU): debounceMessage() — tunggu AI_COOKIE_RESPONSE_TIMER
ms (default 20000) sejak pesan TERAKHIR dari customer ini. Pesan baru me-reset
jendela waktu ke penuh. Setelah jendela lewat tanpa pesan baru → gabungkan
semua pesan tertunda jadi satu teks → lanjut proses SEKALI.
        ↓
hasPropertyKeyword(combinedMessage)?
    └── YA ─────────────────────────────────────────────────────→ ⬇ lanjut
    └── TIDAK → getConversationHistory(session.id, 12)
                      ↓
              isPropertyContextContinuation(combinedMessage, history)?
                  ├── TIDAK → log "⏭️ Tidak disimpan ke DB, AI skip" → SELESAI
                  │          (pesan non-properti TIDAK disimpan sama sekali —
                  │           gate-before-save, BUKAN "selalu disimpan")
                  └── YA  → ⬇ lanjut
        ↓
Simpan pesan customer ke ChatMessage (user_id: agent.user_id)
        ↓
generateWhatsAppAIReply({ session, message: combinedMessage, agentName, agentUserId })
    ↓
    [1] getConversationHistory(session.id, 24)  ← diambil DULU (urutan dibalik dari versi lama)
    [2] getWhatsappPropertyContext(combinedMessage, history, agentUserId)
           → Rumah123 (bila RUMAH123_DATA=ON) DIGABUNG DENGAN
           → Katalog DB sendiri (buildRecommendationContextForLLM, di-scope
             ke agentUserId) — SAMA dengan sumber Private Agent (parity fix)
           → Fallback TERAKHIR (hanya bila keduanya kosong & agentUserId
             kosong): backend/asset/json_data/indonesia_property_extended_v3.json
    [3] Primary AI (deepseek/qwen/claude/chatgpt) via generateWhatsappReplyWithProviderFallback
    [4] Private Agent → generateResponseForTerminalMassege() [fallback terjamin,
        agentUserId ikut untuk scoping katalog Mode B]
        ↓
Simpan AI reply ke ChatMessage (user_id: agent.user_id)
        ↓
Kirim balasan via platform API (Fonnte / Kirimi / TimelinesAI) — deteksi
kegagalan kirim yang lebih robust (banyak field respons + regex Indonesia)
        ↓
LOG RINGKASAN TERMINAL (full response, tidak truncated, baris "Owner: user_id")
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
MASSEGE_TERMINAL=KIRIMI                        # Hanya Kirimi
MASSEGE_TERMINAL=TIMELINESAI                   # Hanya TimelinesAI
MASSEGE_TERMINAL=FONNTE,KIRIMI               # Fonnte + Kirimi (multi)
MASSEGE_TERMINAL=FONNTE,KIRIMI,TIMELINESAI  # Semua
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
  if (active === 'KIRIMI')      return KirimiChatController.handleInboundMessage(req, res);
});
```
> Root `POST /` memakai **nilai pertama** `MASSEGE_TERMINAL` untuk routing webhook
> tanpa-path. Tiap platform juga punya endpoint sendiri (`/api/kirimi/webhook`, dst.).

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
- **TUJUAN/use-case (BARU 7 Agu 2026):** investasi, invest, ditinggali, ditempati,
  dihuni, hunian, untuk usaha, buat kantor, dikoskan

> **⚠️ Kenapa kata TUJUAN perlu masuk daftar aksi.** Bug produksi 7 Agu 2026 —
> log: `PESAN MASUK (bukan query properti — tidak dibalas) | Message: Rumahnya
> untuk investasi`. Pesan itu punya TIPE properti ("rumah") tapi tidak punya
> KATA AKSI: customer menyebut **tujuan**, bukan aksi. Gerbang kedua
> (`isPropertyContextContinuation`) juga gagal karena customer membalas **9 jam**
> kemudian sedangkan `CHATBOT_COOKIE_TTL_MINUTES=90` → sesi kedaluwarsa →
> history kosong → fungsi itu langsung `return false`. Akibatnya pesan hilang
> tanpa jejak: tidak disimpan ke DB, tidak dibalas.
>
> Aman ditambahkan karena Kata Aksi **wajib bersama Tipe Properti** — "investasi
> saham"/"investasi emas" tidak punya tipe properti sehingga tetap ditolak, dan
> pengecualian "rumah makan"/"rumah sakit"/"rumah tangga" tetap berlaku.
> Regression: `backend/tests/investasiGateDrop.test.js`.

**Kata Kunci Mandiri** (trigger tanpa Tipe Properti):
- kpr, over kredit, inden, perumahan, real estate
- siap huni, ready unit, dp rumah, cicilan rumah
- agen properti, developer, shm, hgb

---

## Property Context (DIPERBARUI — parity fix + agent scoping)

**File:** `backend/utils/whatsappPropertyContext.js`

```
getWhatsappPropertyContext(customerMessage, history, agentUserId)
        ↓
Extract: location, propertyType, transactionType
        ↓
1. Coba Rumah123 (bila RUMAH123_DATA=ON & APIFY_API_TOKEN valid)
2. Coba katalog DB sendiri (buildRecommendationContextForLLM, propertyRecommendationService)
   — di-scope ke agentUserId bila diisi (Property.user_id filter)
   — SAMA dengan sumber yang dipakai chatbotPrivateController.js Mode B
3. Keduanya DIGABUNG bila sama-sama ada data (bukan salah satu saja)
4. Fallback TERAKHIR (hanya bila Rumah123 & katalog DB SAMA-SAMA kosong,
   DAN agentUserId kosong — mencegah bocor listing bukan-milik-agent):
   JSON backend/asset/json_data/indonesia_property_extended_v3.json (lazy)
        ↓
return {
  contextText,
  source: 'rumah123'|'rumah123+db_catalog'|'db_catalog'|'flat_json'|'none',
  location, propertyType, transactionType
}
```

Respects `RUMAH123_DATA` env var (ON/OFF) untuk konsistensi dengan chatbot.
`agentUserId` dialirkan dari `agent.user_id` di masing-masing controller
WhatsApp — lihat doc 06 "Agent-Scoped Catalog" untuk alur lengkap.

---

## Cookie Response Timer — Debounce Pesan Beruntun (BARU)

**File:** `backend/utils/responseDebounce.js`

Customer sering mengetik beberapa pesan terpisah dalam waktu singkat (mis.
"Belum pernah lihat" lalu detik berikutnya "Tapi saya mau cari yang dekat
stasiun bus"). Tanpa jeda, AI membalas pesan pertama sebelum sempat membaca
lanjutannya. `debounceMessage()` menahan proses selama
`AI_COOKIE_RESPONSE_TIMER` ms (default 20000) sejak pesan TERAKHIR dari
customer tsb — setiap pesan baru me-reset jendela waktu ke penuh. Setelah
jendela lewat tanpa pesan baru, semua pesan tertunda digabung (dipisah newline,
urutan kedatangan) dan diproses SEKALI (satu balasan AI).

```javascript
const { debounceMessage } = require('../utils/responseDebounce');

// key harus unik per (platform + agent + customer), mis. `${source}::${normalizedPhone}`
debounceMessage(`${source}::${normSender}`, message, (combinedMessage) => {
  handleDebouncedBatch({ combinedMessage, sender, name, normSender, source, agent, messageId });
});
```

Dipasang **identik** di ketiga controller WhatsApp: pengecekan cepat per-pesan
(fromMe/grup/echo/dedup) tetap jalan tiap pesan masuk (agar retry/echo tidak
memperpanjang buffer customer), tapi hanya pesan yang lolos itu yang masuk ke
`debounceMessage()`. Fungsi berat (gate properti, simpan DB, panggil AI, kirim
balasan) dipindah ke `handleDebouncedBatch()` yang hanya jalan SEKALI setelah
jendela waktu selesai.

---

## Agent Interruption — handover OTOMATIS saat agent mengetik manual

**File:** `backend/services/customerAiToggleService.js` → `maybeHandleAgentInterruption()`
Dipanggil dari KETIGA controller di cabang `if (fromMe)`, sebelum event di-skip.

Webhook meng-echo pesan KELUAR sebagai `fromMe:true`. Dulu event ini selalu
di-skip mentah-mentah, sehingga tidak ada bedanya antara balasan AI sendiri dan
ketikan MANUAL agent lewat app WhatsApp di device yang sama.

**Pembeda:** setiap balasan AI diberi footer `Sent via <AI_PRIMARY_TAG>` oleh
`appendSentViaTag()`. `fromMe:true` TANPA footer itu = ketikan manual agent →
agent sedang mengambil alih → `customers.ai_response` di-set `OFF` otomatis,
tanpa perlu perintah eksplisit. Gate di controller (`isAiDisabledForCustomer`)
lalu membuat AI diam untuk customer itu.

| Kondisi | Perilaku |
|---|---|
| `AI_PRIMARY_TAG` kosong | **Fitur MATI total** (fail-safe). Tanpa tag, `isOwnEcho()` selalu false → setiap balasan AI sendiri akan salah terbaca sebagai interupsi dan mematikan AI untuk customer yang justru sedang dilayani. |
| Pesan ADA footer `Sent via …` | Balasan AI sendiri → abaikan. |
| Nomor tujuan = `agent.phone` (**self-chat**) | **Abaikan.** Agent mengetik ke nomornya sendiri = jalur perintah pribadi (kirim nomor customer untuk "matikan/nyalakan AI", toggle katalog sebelum summary). Handover di sini akan mematikan AI untuk nomor agent sendiri. |
| Nomor belum ada di `customers` **tapi** sudah ada `ChatSession` | Baris customer **dibuat lebih awal** (idempoten, lewat `registerCustomerFromChat`) lalu di-set OFF. |
| Nomor belum ada di `customers` **dan** tidak ada `ChatSession` | Abaikan — nomor luar (teman/vendor di device yang sama), jangan cemari master customer. |

> **⚠️ Kenapa baris customer perlu dibuat lebih awal.** `customers` normalnya baru
> dibuat saat AI MENGIRIM SUMMARY (`registerCustomerFromChat` via
> `maybeRegisterOnSummary`), sedangkan interupsi agent justru paling sering
> terjadi JAUH SEBELUM summary. Bug produksi 5 Agu 2026: customer baru mengirim
> 1 pesan, agent langsung mengambil alih, `Customer.findOne()` mengembalikan
> null → handover BATAL DIAM-DIAM (tanpa log) → AI tetap ikut menjawab beberapa
> menit kemudian, bertabrakan dengan agent di chat yang sama. Kolom
> `ai_response` adalah SATU-SATUNYA yang dibaca gate AI, jadi tanpa baris tidak
> ada tempat menyimpan status OFF.

Setiap pesan manual agent (bukan hanya yang pertama memicu handover) dicatat ke
`chat_messages` dengan `role:'ai'` + `ai_responder:'agent interruption'` —
penanda eksplisit bahwa baris itu ketikan MANUSIA, bukan hasil panggilan AI.
Sebelumnya pesan-pesan ini hilang total dari transkrip.

Regression: `backend/tests/agentInterruption.test.js` (menulis baris DB nyata &
membersihkannya sendiri; run yang crash bisa meninggalkan baris `TESTAGENT_INTERRUPT`).

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

## Controller 2 — kirimiChatController

**File:** `backend/controllers/kirimiChatController.js`
**Endpoint:** `POST /api/kirimi/webhook` (+ `POST /` bila `MASSEGE_TERMINAL` diawali KIRIMI)
**Kredensial:** akun `KIRIMI_USER_CODE` + `KIRIMI_SECRET` (`.env`); device per-agent
di `users.kirimi_device_id` (mis. `D-3OCA6`).

### Inbound (webhook)
Payload Kirimi memuat pengirim (nomor customer), teks pesan, dan device_id tujuan
(dipakai untuk mencocokkan agent lewat `users.kirimi_device_id`).

### Send
```
POST https://api.kirimi.id/v1/send-message
Body: { user_code, secret, device_id, receiver, message }
# Opsional: /v1/send-message-fast (KIRIMI_SEND_FAST=true, tanpa efek mengetik)
```
Opsi `.env`: `KIRIMI_API_URL`, `KIRIMI_SEND_FAST`, `KIRIMI_TIMEOUT_MS`,
`KIRIMI_RETRY_COUNT`, `KIRIMI_RETRY_DELAY_MS`.

### API Endpoints
```
POST /api/kirimi/webhook
POST /api/kirimi/simulate
GET  /api/kirimi/agents
GET  /api/kirimi/status
GET  /api/kirimi/check-api
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
isTerminalActive('KIRIMI')
isTerminalActive('TIMELINESAI')
getActiveTerminals()        // → ['FONNTE'] | ['FONNTE','KIRIMI','TIMELINESAI'] | ...

// backend/services/sessionService.js
getConversationHistory(sessionId, limit)  // Used untuk context continuation check

// backend/utils/messageDedup.js — dedup layer 1 (in-memory, 10 menit TTL)
isAlreadyProcessed(messageId)  // → boolean
markProcessed(messageId)

// Dedup layer 2 (BARU, SINKRON 3 controller) — query langsung ChatMessage.metadata
// (survive restart/nodemon), tidak ada helper terpisah — inline di tiap controller:
//   ChatMessage.findOne({ where: { channel: 'whatsapp',
//     metadata: { [Op.like]: `%"messageId":"${safeId}"%` } } })

// backend/utils/responseDebounce.js — BARU, cookie response timer (lihat di atas)
debounceMessage(key, message, onFire)  // key = `${source}::${normalizedPhone}`

// backend/utils/standardFacilities.js — BARU, fallback fasilitas standar (lihat doc 06)
getStandardFacilitiesByType(buildingType, furnishing)
```

---

## Quick Diagnostics

```bash
# Status semua agent
curl http://localhost:5055/api/fonnte-chat/status

# Simulate pesan properti (test full pipeline)
curl -X POST http://localhost:5055/api/fonnte-chat/simulate \
  -H "Content-Type: application/json" \
  -d '{"sender":"628213311936","message":"sewa rumah 3 kamar surabaya","name":"Test"}'

# Test context continuation (jawaban singkat)
# 1. Kirim pesan properti dulu
# 2. Lalu kirim: "saya beli" → harus dibalas (continuation dari langkah 1)

# Test non-property (harus diabaikan)
curl -X POST http://localhost:5055/ \
  -H "Content-Type: application/json" \
  -d '{"sender":"628xxx","name":"Test","message":"cari bebek goreng","device":"628xxx","inboxid":"T1"}'
# Terminal: "📥 Disimpan, tidak dibalas"

# Test context continuation (harus dibalas jika ada history properti)
curl -X POST http://localhost:5055/ \
  -H "Content-Type: application/json" \
  -d '{"sender":"628xxx","name":"Test","message":"saya beli","device":"628xxx","inboxid":"T2"}'
# Jika ada history property: dibalas; jika history kosong: diabaikan
```

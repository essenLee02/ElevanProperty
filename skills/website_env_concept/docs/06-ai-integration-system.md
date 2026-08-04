# 06. AI Integration System

## Provider Fallback Architecture (single primary → Private Agent)

`AI_PRIMARY_PROVIDER` memilih **satu** AI eksternal sebagai primary. Jika primary
gagal, sistem **TIDAK** melompat ke AI eksternal lain — langsung jatuh ke
**Private Agent** (chatbotPrivateController) yang selalu memberi jawaban.

```
AI_PRIMARY_PROVIDER=qwen      → QWEN     → Private Agent
AI_PRIMARY_PROVIDER=claude    → Claude   → Private Agent
AI_PRIMARY_PROVIDER=chatgpt   → ChatGPT  → Private Agent
AI_PRIMARY_PROVIDER=deepseek  → DeepSeek → Private Agent
AI_PRIMARY_PROVIDER=kimi      → Kimi     → Private Agent   ← DEFAULT SAAT INI (3 Agu 2026)
AI_PRIMARY_PROVIDER=private   → Private Agent (langsung, tanpa AI eksternal)
```

`PROVIDER_ORDER` di `aiProviderService.js` memberi tiap primary chain **satu
provider saja** (`{ qwen:['qwen'], claude:['claude'], chatgpt:['chatgpt'],
deepseek:['deepseek'], kimi:['kimi'] }`) — primary gagal → LANGSUNG Private
Agent, tidak mencoba provider eksternal lain lebih dulu.

> ⚠️ **Diagnosis wajib cek jalur AKTUAL, bukan asumsi.** `AI_PRIMARY_PROVIDER`
> sudah berganti beberapa kali (`deepseek` → `chatgpt` → `kimi`) tanpa
> dokumentasi lama diperbarui. Bug re-ask-loop pernah salah didiagnosis karena
> diuji terhadap `chatbotPrivateController.js` (Private Agent) padahal
> produksi sedang memakai jalur LLM (`aiPromptBuilderService.js`) — dua kode
> base yang MIRIP tapi TERPISAH. Selalu `grep AI_PRIMARY_PROVIDER .env` dan
> cek log runtime (`[WhatsAppAI] Calling AI provider: { primaryProvider: … }`)
> sebelum mereproduksi bug perilaku AI.

Pengecualian: bila primary = `private` dan Private Agent gagal, ada rantai
darurat eksternal (`executeExternalAIFallbackChain`), urutan tetap (bukan
dipengaruhi `AI_PRIMARY_PROVIDER`): **DeepSeek → Kimi → Claude → ChatGPT → QWEN**.

```
Customer Message (WhatsApp or Website)
     ↓
[Q1–Q12 QUALIFICATION]  ← extractQualificationState dari history (SELALU jalan)
     ↓ (jika ada pertanyaan wajib belum terjawab)
Ajukan pertanyaan berikutnya (brief interview, belum tampilkan katalog)
     ↓ (jika semua pertanyaan wajib ✅ → tampilkan structured brief)
     ↓ (RESPOND_CATALOG_RUN=OFF) brief saja → selesai
     ↓ (RESPOND_CATALOG_RUN=ON)  brief + katalog rekomendasi
     ↓
[PRIMARY AI] ──[quota/key/network error]──→ Private Agent (jawaban terjamin)
```

Toggle via `backend/.env`:
```env
AI_PRIMARY_PROVIDER=kimi             # qwen | claude | chatgpt | deepseek | kimi | private
ENABLE_CLAUDE_FALLBACK=true          # efektif = toggle global Claude (on/off)
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
RESPOND_CATALOG_RUN=OFF              # OFF = brief saja ; ON = brief + katalog
```

## ⛔ Kebijakan Billing — Larangan Auto-Recharge (WAJIB, 3 Agu 2026)

Untuk **KELIMA** provider (ChatGPT, Claude, QWEN, DeepSeek, Kimi): **DILARANG
KERAS** menambahkan kode/script/UI apa pun yang melakukan auto-recharge atau
auto-topup billing saat token/kredit habis. Perilaku yang benar saat kuota
habis: service melempar error → provider chain jatuh ke Private Agent (lihat
di atas) → isi ulang kredit **hanya manual** oleh owner via dashboard billing
masing-masing provider. Didokumentasikan juga sebagai komentar eksplisit di
`backend/.env` tepat sebelum `CHAT_GPT_API_KEY`.

## Audit Koneksi API Langsung ke Live Endpoint (3 Agu 2026)

Dilakukan pengecekan riil (bukan asumsi) terhadap seluruh 5 provider dengan
memanggil fungsi `generate*WhatsappReply()` masing-masing secara langsung:

| Provider | Model di `.env` | Hasil |
|---|---|---|
| Kimi (primary) | `kimi-k2.6` | ✅ berhasil |
| DeepSeek | `deepseek-chat` | ✅ berhasil (`deepseek-v4-flash` juga dites, SAMA-SAMA jalan dengan key ini — catatan lama yang bilang v4-flash "tidak tersedia" TIDAK akurat untuk akun ini) |
| Qwen | `qwen3-vl-flash` | ✅ berhasil |
| ChatGPT | `gpt-oss-20b` (nilai lama) | ❌ HTTP 400 "model does not exist" — **diperbaiki** ke `gpt-4o-mini` (teruji jalan; `gpt-4.1-mini` juga jalan sebagai alternatif). `gpt-5.6-terra-pro` yang tercantum di komentar `.env` **juga tidak valid** — jangan pakai. |
| Claude | `claude-3-haiku` | ❌ **HTTP 401 "API key is invalid"** — `CLAUDE_API_KEY` perlu diganti manual oleh owner di console.anthropic.com. Kode & nama env var (mendukung `CLAUDE_API_KEY` maupun alias lama `ANTHROPIC_API_KEY`) sudah benar; murni masalah kredensial, BUKAN bug. |

**Dampak produksi hari ini: NOL** — primary=`kimi` (sehat), dan `PROVIDER_ORDER`
per-primary hanya berisi provider itu sendiri (lihat di atas), jadi ChatGPT/
Claude yang bermasalah tidak pernah tersentuh selama primary tetap `kimi`.
Baru relevan jika: (a) `AI_PRIMARY_PROVIDER` diganti ke `chatgpt`/`claude`, atau
(b) primary=`private` dan Private Agent gagal → `executeExternalAIFallbackChain`
akan mencoba Claude & ChatGPT dan gagal di keduanya sebelum lanjut ke provider
berikutnya dalam urutan (lihat urutan chain di atas).

## ⚠️ Plafon TPM (Tokens Per Minute) — gpt-4o-mini (BARU, 31 Jul 2026)

Akun OpenAI org saat ini punya limit **60.000 TPM/menit** untuk `gpt-4o-mini`.
Diukur langsung (31 Jul 2026):

| Komponen prompt | Karakter | ≈ Token | % dari plafon 60K |
|---|---|---|---|
| 10 skill doc yang SELALU aktif | 156.413 | 39.100 | 65% |
| + 3 skill doc kondisional (11/12/13) | 204.128 | 51.000 | 85% |

Skill docs SAJA — sebelum history, qualification state, atau katalog properti
ditambahkan — sudah memakan 65–85% dari seluruh jatah per menit. Ini adalah
penyebab RIIL error `429 Request too large` ("Limit 60000, Requested 71610"),
**bukan** panjang riwayat percakapan seperti diagnosis awal yang keliru.

**Solusi definitif:** tambahkan metode pembayaran ke akun OpenAI — TPM naik
dari 60K ke 200K seketika, tanpa perlu memangkas skill docs (docs sengaja
diperbesar — lihat doc 17 §Skill Doc Cleanup — agar konten sampai ke LLM;
memangkasnya untuk mengatasi rate limit berarti membatalkan pekerjaan itu).

**Mitigasi sementara (defense-in-depth, bukan fix utama):**
`generateChatGPTWhatsappReply()` (`services/openaiService.js`) memangkas
history ke **12 pesan terakhir** sebelum dikirim ke ChatGPT — full history
tetap dipakai untuk state calculation server-side (qualification state,
deteksi "sudah dijawab", dst), hanya request API yang dipersingkat.

**Disiplin untuk fitur baru:** setiap penambahan ke prompt LLM (blok state
baru, skill doc kondisional baru, konteks tambahan apa pun) WAJIB diukur
dampak tokennya. Pola aman: cache-then-async-refresh + emit STRING KOSONG
saat data tidak tersedia (0 token tambahan) — lihat `buildLiveLandmarkBlock()`
di bawah sebagai contoh implementasi.

## Landmark Live (Google Places) — Wired ke Jalur LLM (BARU, 31 Jul 2026)

`services/googlePlacesService.js` sudah ada sejak sebelum sesi ini, TAPI
sebelumnya **hanya** di-`require()` oleh `chatbotPrivateController.js`
(Private Agent / fallback) — jalur LLM produksi (`aiPromptBuilderService.js`)
tidak pernah menerima data landmark live sama sekali, hanya mengandalkan
ingatan training model yang punya knowledge cutoff.

Fix: `buildLiveLandmarkBlock(city)` (baru, di `aiPromptBuilderService.js`):
- **Sync cache read** (`getCachedCityLandmarks`) — tidak pernah menyentuh
  jaringan dari builder prompt yang sinkron.
- **Fire-and-forget async warm** (`warmCityLandmarksCache`) bila cache
  kosong — menghangatkan untuk giliran BERIKUTNYA, tidak memblokir balasan
  giliran ini.
- Dibatasi **6 landmark, satu baris** — hemat token (lihat plafon TPM di atas).
- Emit **string kosong** (0 token tambahan) saat data tidak tersedia.

Diinjeksikan ke prompt tepat setelah blok qualification state:
```
${qualStateBlock ? `\n${qualStateBlock}\n` : ''}${liveLandmarkBlock}
```

⚠️ **Status saat ini: DORMAN.** Google Places API menolak semua panggilan
dengan `REQUEST_DENIED — You must enable Billing on the Google Cloud
Project`. `GOOGLE_API_KEY` sendiri valid (dipakai fitur Google lain yang
sudah jalan) — billing PROJECT Google Cloud-nya yang belum di-enable.
Sistem turun anggun ke peta kurasi `utils/locationLandmarks.js` (45 kota)
sampai billing dinyalakan di `console.cloud.google.com`.

Skill doc terkait (`claude_responds/docs/13-locations-and-landmarks.md`,
mirror di `chat_gpt_responds/`) diperbarui dengan §2a (tangga prioritas:
live > kurasi > generik; blok kosong itu NORMAL, jangan pernah dilaporkan ke
customer sebagai kegagalan) dan §2b (larangan keras mengarang nama
landmark/status buka/jam operasional — landmark karangan menghancurkan
kepercayaan lebih cepat daripada landmark basi).

> **PENTING — arti RESPOND_CATALOG_RUN (baru):** Q1–Q12 **SELALU** dijalankan
> apa pun nilainya. Flag ini hanya menentukan isi SETELAH brief:
> `OFF` → cukup summary/brief saja; `ON` → brief + katalog rekomendasi.
> (Dulu flag ini keliru dipakai sebagai toggle seluruh mode.)

> **PENTING — parity fix (Juli 2026):** sebelumnya, saat provider AI UTAMA
> (ChatGPT/Claude/QWEN/DeepSeek) yang menjawab, katalog `ON` HANYA bersumber
> dari Rumah123 + JSON statis — TIDAK PERNAH menyentuh database
> Property/PropertyFacility/PropertyLocation milik agent. Ini membuat katalog
> tidak konsisten tergantung provider mana yang kebetulan menjawab. Sekarang
> `whatsappPropertyContext.js` JUGA memanggil `buildRecommendationContextForLLM()`
> (sumber yang SAMA dipakai Private Agent) dan menggabungkannya dengan Rumah123
> — JSON statis benar-benar last resort. Lihat "Agent-Scoped Catalog" di bawah.

> **Larangan:** dilarang membuat `const` hardcode untuk nama model AI. Semua nama
> model dibaca dari `.env` (`CHAT_GPT_MODEL`, `CLAUDE_MODEL`, `QWEN_MODEL`, `DEEPSEEK_MODEL`).

---

## WhatsApp AI Service (`whatsappAIService.js`)

Unified entry point for all WhatsApp platforms (Fonnte, Kirimi, TimelinesAI).

### Main Function: `generateWhatsAppAIReply(params)`

```javascript
generateWhatsAppAIReply({
  session,        // ChatSession object
  history,        // [{role, message}] — last 12 messages
  message,        // Current customer message
  agentName,      // Agent's name (for signature in brief)
  agentUserId,    // BARU — users.user_id agent pemilik nomor WA ini; scoping katalog
  contextSource,  // 'rumah123' | 'rumah123+db_catalog' | 'db_catalog' | 'flat_json' | 'none'
})
// Returns: { reply, provider, fallbackUsed, ... }
```

### Flow inside `generateWhatsAppAIReply`:

1. **Get conversation history DULU** (`getConversationHistory`) — diambil SEBELUM
   property context (urutan dibalik dari versi lama) supaya filter Q1-Q12 akurat
   lintas percakapan saat query katalog, bukan hanya dari pesan terakhir.
2. **Extract property filters** from message + history (`extractPropertyFilters`)
3. **Pre-qualification gate** (`buildQualifyReply`):
   - Checks 4 minimum fields: buildingType, transactionType, location, budget
   - If any missing → returns qualification question immediately (no AI called)
4. **★ Load AI Context Blocks** (`aiContextService.loadAIContextBlocks`):
   - `buildFacilityContextBlock()` — always injected (facility names from DB)
   - `buildCityContextBlock()` — injected only when message is location-related
   - Cached 5 minutes, parallel fetch. See doc 16 for full details.
5. **Check `RESPOND_CATALOG_RUN`** (hanya memengaruhi isi SETELAH brief):
   - `OFF` → setelah semua Q1–Q12 wajib ✅ → tampilkan brief saja
   - `ON` → setelah brief → lanjutkan dengan katalog rekomendasi dari property context
   - Q1–Q12 tetap dijalankan pada kedua nilai; AI provider dipilih oleh `AI_PRIMARY_PROVIDER`
6. **Get property context** (`getWhatsappPropertyContext(message, history, agentUserId)`):
   - Coba Rumah123 live data (jika `RUMAH123_DATA=ON`)
   - **BARU:** JUGA coba katalog DB sendiri via `buildRecommendationContextForLLM()`,
     di-scope ke `agentUserId` bila diisi — SAMA dengan sumber Private Agent
   - Keduanya DIGABUNG (bukan salah satu) bila sama-sama ada data
   - Fallback terakhir (hanya bila Rumah123 DAN katalog DB sama-sama kosong):
     JSON `indonesia_property_extended_v3.json` — dan HANYA dipakai bila
     `agentUserId` kosong (mencegah bocor listing bukan-milik-agent saat scoping aktif)
7. **Build full prompt** (`buildWhatsappReplyPrompt`) with Q1-Q12 state + facility + city context injected
8. **Call AI provider chain** → return reply

### Agent-Scoped Catalog (BARU)

Setiap agent WhatsApp hanya merekomendasikan **listing miliknya sendiri**
(`Property.user_id` = agent yang menjawab), bukan katalog gabungan semua agent.
`agentUserId` dialirkan dari controller WhatsApp (`agent.user_id`) melalui:

```
fonnteChatController / kirimiChatController / timelinesAIChatController
  → generateWhatsAppAIReply({ ..., agentUserId })
  → session.agentUserId = agentUserId   (disimpan agar ikut ke Private Agent fallback)
  → getWhatsappPropertyContext(message, history, agentUserId)
  → buildRecommendationContextForLLM(message, history, { userId: agentUserId })
  → searchProperties / getAlternatives / findWithExpandedBudget
      → filterProperties({ ..., userId })  ← scope by Property.userId bila diisi
```

`userId` kosong/null = katalog global (dipakai chatbot web publik, TIDAK di-scope).

### Budget Expansion — Batas "Harga Wajar" (BARU, bukan lagi tanpa-limit)

`findWithExpandedBudget()` melebarkan budget bertahap saat exact match kosong:

| Step | Ekspansi | Catatan |
|---|---|---|
| 1 | ±35% dari budget asli | |
| 2 | ±70% dari budget asli | |
| 3 | **Batas harga wajar**: min × 0.20 … max × 2.5 | BUKAN tanpa-limit lagi |

Guard yang sama (`min×0.20…max×2.5`) juga diterapkan ke `getAlternatives()` —
yang sebelumnya melonggarkan tipe/lokasi tanpa mempedulikan harga sama sekali,
sehingga bisa menampilkan properti jauh di luar anggaran customer (mis. listing
60 miliar untuk budget 800rb/malam).

### Fallback "Fasilitas Standar + Harga Wajar" (BARU)

Bila katalog agent benar-benar kosong (exact match DAN alternatif kosong,
bahkan setelah ekspansi batas wajar), `buildRecommendationContextForLLM()`
membangun objek `standardFallback` dari `utils/standardFacilities.js`
(`getStandardFacilitiesByType(buildingType, furnishing)` — satu sumber, juga
dipakai `chatbotPrivateController.js` untuk mengisi summary saat customer
jawab "standar"):

```javascript
standardFallback = {
  buildingType,
  standardFacilities: 'Tempat Tidur, Kamar Mandi, AC, TV, WiFi, ...', // per tipe
  reasonableRange: { min, max, period }  // dari budget customer × 0.20/2.5
}
```

Ini di-inject ke `contextText` LLM (`NO CATALOG MATCH — STANDARD-FACILITIES
FALLBACK` block) DAN dirender langsung oleh Private Agent
(`ResponseBuilder`/`ResponseBuilderWhatsApp.alternative()`) — instruksinya:
sampaikan jujur tidak ada listing pas, sebutkan fasilitas standar tipe ini
sebagai gambaran, kutip rentang harga wajar, lalu tawarkan penyesuaian
kriteria. **Dilarang mengarang listing.**

### `buildQualifyReply` — Pre-Qualification Gate

Asks missing fields cumulatively (one message can cover ≥1 missing field):

```
Missing: type           → "Sedang cari properti jenis apa? (Rumah, Apartemen, Villa, Kos, dll.)"
Missing: tx             → "Sedang cari untuk disewa atau dibeli?"
Missing: type + tx      → "Sedang cari properti jenis apa? Untuk disewa atau dibeli?"
Missing: loc            → "Di kota atau area mana yang Anda inginkan?"
Missing: bud (sewa)     → "Di [lokasi] saya punya di kisaran [X] dan [Y]. Mana yang lebih sesuai?"
Missing: bud (beli)     → same, with purchase price ranges
All 4 present           → return null (proceed to AI)
```

---

## AI Prompt Builder (`aiPromptBuilderService.js`)

### `extractQualificationState(history, currentMessage)` — 4-Phase Extractor

Scans full conversation history to build per-question answered/unanswered state.
This is the authoritative Q1-Q12 state — AI never needs to re-derive it from raw history.

**State object:**
```javascript
{
  transactionType  : null,   // Q1 — sewa/beli
  buildingType     : null,   // Q1b — rumah/apartemen/villa/...
  fallbackTypes    : [],     // "kalau tidak ada X, Y saja"
  location         : null,   // Q2
  budget           : null,   // Q3
  household        : null,   // Q4 — household composition
  redFlags         : null,   // Q5
  anchorPoint      : null,   // Q6
  alternativeAreas : null,   // Q7
  moveInDate       : null,   // Q8 — MANDATORY
  decisionMaker    : null,   // Q9
  leaseDuration    : null,   // Q10
  furnishing       : null,   // Q11
  apartmentPref    : null,   // Q12
}
```

**Phase 0:** Find active session start (after last summary message) → `ACTIVE_ALL`

**Phase 1:** Scan all CUSTOMER messages for content-detectable fields:
- Q1 (tx type): keywords "sewa|kontrak|ngontrak|beli|jual|beli"
- Q1b (building type): "villa|rumah|apartemen|kos|ruko|gudang|kantor"
- Q2 (location): city name regex + CITY_RE pattern
- Q3 (budget): price patterns "X juta|X miliar|X-Y juta"
- Q4 (household): "sendiri|bersama istri|keluarga N orang|bersama [N] orang"
- Q8 (move-in date): MONTH_RE pattern (any message with a month name → date)
- Q11 (furnishing): "furnished|semi furnished|semi-furnished|kosongan|unfurnished"
- Q6 (anchor): "dekat [place]|deket [place]|near [place]"

**Phase 2:** AI→Customer pair scan for context-dependent fields:
- Q5 (red flags): AI asked "pasti tidak cocok|hadap barat|gang sempit" → customer response
- Q6 (anchor point): AI asked "patokan|dekat sekolah|dekat kantor" → customer response
- Q7 (alternatives): AI asked "area sekitar|area alternatif" → customer response
- Q9 (decision maker): AI asked "langsung bisa jadwalkan|koordinasi dulu" → customer response
  - "sendiri" response → normalized to `'Mandiri'`
  - Single-person household (Q4 = "1 orang") → auto-set Q9 = `'Mandiri'`
- Q10 (lease duration): AI asked "sewa untuk berapa lama|berapa lama.*sewa" → customer response
  - **Date check**: if customer answers with a date ("26 Juni 2026") → skip, leave Q10 null so it re-asks
- Q12 (apartment pref): AI asked "tower atau lantai|preferensi tower" → customer response
- Q2b (search history): AI asked search-history question → customer response

**Phase 3A:** Summary-already-shown detection → wipe state, re-extract from current message only

**Phase 3B:** Building-type-change detection → reset Q2–Q12 on type change

---

### `buildQualificationStateBlock(state)` — Checklist Renderer

Outputs the QUALIFICATION STATE block injected into every AI prompt:
```
QUALIFICATION STATE (server-extracted):
✅ Q1 — Rencana: Sewa  ✅ Tipe: Villa
✅ Q2 — Lokasi: Surabaya
❓ Q3 — Budget: belum disebutkan
✅ Q4 — Penghuni: 2 orang (bersama istri)
❓ Q5 — Red flags: belum ditanya
...

⚡ PERTANYAAN BERIKUTNYA: Q3 — Kisaran budget? 💰
```

Also adds `⚠️ DATA INTEGRITY WARNING` for Q5/Q6 null states, and `⚠️ DIBLOKIR` banner when required fields are incomplete after summary.

---

### `findNextQuestion(state)` — Priority Queue

Returns `{ q, hint }` for the next question to ask. Priority order:

```
Q1 (tx type) → Q2 (building type) → Q2b (search history) → Q3 (budget) →
Q8 (move-in date, MANDATORY) → Q4 (household) → Q5 (red flags) →
Q6 (anchor point) → Q7 (alternatives) → Q9 (decision maker) →
Q10 (lease duration, only if sewa) → Q11 (furnishing) → Q12 (apartment pref, only if apartment)
```

Q10 hint includes date clarification: `"(durasi, bukan tanggal — contoh: 6 bulan, 1 tahun)"`

---

### `buildWhatsappReplyPrompt(params)` — Full AI System Prompt

Assembles complete prompt injected to ChatGPT or Claude:
1. Skill docs (`getProjectSkillInstruction(provider)`)
2. Forced language instruction (`⚠️ FORCED REPLY LANGUAGE: ...`)
3. Summary mode instructions (when `RESPOND_CATALOG_RUN=OFF`):
   - Q1–Q12 discovery conversation rules
   - Brief template (structured property summary)
   - Summary Strict Rules (bans "Disebutkan", "Hindari" label, "Solo (mandiri)")
   - Signature rules (only in brief, not in Q1-Q12 questions)
4. QUALIFICATION STATE block (from `buildQualificationStateBlock`)
5. Customer profile + conversation history
6. Property context (Rumah123 or flat JSON)
7. Task block (6 numbered instructions, includes Q5/Q6/Q7 required before summary)

---

## aiProviderService.js

### `executeAIProviderWithFallback(taskName, chatGPTFn, claudeFn, qwenFn, deepseekFn)`

1. Read `AI_PRIMARY_PROVIDER` from env (`getPrimaryAIProvider`)
2. `PROVIDER_ORDER` = **satu provider per key** — `{ qwen:['qwen'], claude:['claude'], chatgpt:['chatgpt'], deepseek:['deepseek'] }`.
   Tidak ada cross-AI: bila primary gagal, caller menjatuhkan ke Private Agent.
3. `avail` mengecek key/config tiap provider: `canUseChatGPT / canUseClaude / canUseQwen / canUseDeepSeek`
4. Returns `{ reply, provider, primaryProvider, fallbackUsed, fallbackProvider, primaryError, providerErrors }`

Helpers: `getPrimaryAIProvider`, `getAIProviderOrder`, `isClaudeEnabled`,
`checkAIProviderConfig` (status semua provider termasuk deepseek).

`executeExternalAIFallbackChain(...)` — dipakai HANYA saat `AI_PRIMARY_PROVIDER=private`
dan Private Agent gagal; urutan darurat: **DeepSeek → Claude → ChatGPT → QWEN**.

Empat wrapper (masing-masing meneruskan `deepseekFn`):
- `generateChatbotReplyWithProviderFallback` — website chatbot
- `generateContactReplyWithProviderFallback` — contact form
- `generateWhatsappReplyWithProviderFallback` — WhatsApp (all platforms)
- `generateWhatsappExternalAIFallback` — rantai darurat saat primary=private

### AI Error Handling (no cross-AI)

| Error | Behavior |
|---|---|
| Primary 429 (quota) / 401 (key) / network | Jatuh ke **Private Agent** (bukan AI eksternal lain) |
| DeepSeek 402/429 | Ditandai kuota, jatuh ke Private Agent |
| Provider key kosong/invalid | Provider di-skip; jatuh ke Private Agent |
| Private Agent juga gagal | Returns 502 with error message |
| `ENABLE_CHATBOT_PRIVATE_CONTROLLER=false` | Returns 502 (no private fallback) |

---

## ChatGPT Integration (`openaiService.js`)

- Model: `gpt-4o-mini` (from `CHAT_GPT_MODEL` env)
- Key: `CHAT_GPT_API_KEY`
- SDK: official `openai` npm package
- `CHAT_GPT_STORE_RESPONSE=true` enables response storage in OpenAI dashboard

---

## Claude Integration (`claudeService.js`)

- Model: dari `CLAUDE_MODEL` env (mis. `claude-3-haiku`)
- Key: `ANTHROPIC_API_KEY`
- API version: `2023-06-01`
- Max tokens: `CLAUDE_MAX_TOKENS`
- Implementation: **raw axios HTTP** (not Anthropic SDK)

---

## QWEN Integration (`qwenService.js`)

- OpenAI-compatible (DashScope / Bailian). Base URL: `QWEN_BASE_URL`
  (International: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`)
- Key: `QWEN_API_KEY` (standar `sk-...`, atau Bailian `sk-ws-...` + `QWEN_APP_ID`)
- Model: `QWEN_MODEL` (mis. `qwen3-vl-flash`) · Max tokens: `QWEN_MAX_TOKENS`

---

## DeepSeek Integration (`deepseekService.js`) — baru

- OpenAI-compatible. Endpoint: `${DEEPSEEK_BASE_URL}/v1/chat/completions`
  (default base `https://api.deepseek.com`)
- Key: `DEEPSEEK_API_KEY` · Model: `DEEPSEEK_MODEL` (mis. `deepseek-chat`)
- Param dinamis dari `.env`: `DEEPSEEK_MAX_TOKENS`, `DEEPSEEK_TEMPERATURE`, `DEEPSEEK_TOP_P`
- System prompt = skill `chat_gpt_responds` (via `getProjectSkillInstruction('deepseek')`)
- Implementation: **raw axios HTTP**. Log `[DEEPSEEK REQUEST]` menampilkan model +
  max_tokens + temperature + top_p + source (kirimi/timelinesai/fonnte)
- Fungsi: `generateDeepSeekContactReply / ChatbotReply / WhatsappReply`, `checkDeepSeekConfig`

---

## Private Agent (`chatbotPrivateController.js`)

The guaranteed fallback. Fully OOP with multiple classes.

### Classes

```javascript
class LanguageDetector {
  static detect(message)                    // returns 'id' or 'en'
  static isOffTopic(message)                // true if not property-related
  static hasPropertyIntent(message, filters, history)  // 4-check intent detector
}

class PropertyFormatter {
  static formatLocation(item)
  static formatFacilities(item)
  static buildWaLink(phone)
  static humanBuildingType(type, lang)
  static rumah123Item(item, index, lang)    // format live listing
  static catalogItem(item, index, lang)    // format catalog listing
  static rumah123List(items, lang)
  static catalogList(items, lang)
}

class ResponseBuilder {
  // For website chatbot
  constructor(lang)
  exactMatch({ session, matches, filters, userMessage, history })
  alternative({ session, alternatives, filters, userMessage })
  agentBrief(session, filters)
}

class ResponseBuilderWhatsApp {
  // For WhatsApp (all platforms)
  #filterByTypeAndLocation(allItems, filters)  // strict type, graceful location
  exactMatch(params)
  alternative(params)
  agentBrief(session, filters, agentName)
}

class ConversationQualifier {
  // Q0-Q12 state machine (used by website chatbot private fallback)
}
```

### Exported Functions

- `generatePrivateChatbotResponse(params)` — website chatbot fallback
- `generatePrivateContactReply({ name, phone, subject, message })` — contact form fallback
- `sendPrivateMessage(req, res)` — POST /api/chatbot/private-message (test endpoint)
- `privateAgentStatus(_req, res)` — GET /api/chatbot/private-status
- `debugTestRumah123(req, res)` — GET /api/chatbot/debug/test-rumah123

### `hasPropertyIntent(message, filters, history)` — 4-Check Detector

1. Check `filters` (already extracted property type/tx/location)
2. `hasPropertyKeyword(message)` — keyword-based check
3. `isPropertyContextContinuation(message, history)` — 14-pattern continuation check
4. Fallback regex for edge cases

---

## Skill System (`skillPromptService.js`)

Skills are `.md` files in `skills/` folders. Loaded at runtime — no server restart needed.

```
skills/
├── claude_responds/docs/      ← For Claude AI
└── chat_gpt_responds/docs/    ← For ChatGPT
    ├── 01-core-role-scope-style.md
    ├── 02-property-types-and-location.md
    ├── ...
    └── 09-qualification-flow.md
```

`loadProjectSkillPrompt(provider)`:
- Reads all `.md` files from the appropriate folder
- Combines them with section headers
- Truncates via `SKILL_MAX_*` env
- Provider mapping (`normalizeProvider`):
  - `'claude'` → `claude_responds/`
  - `'chatgpt' | 'openai' | 'gpt' | 'qwen' | 'deepseek'` → `chat_gpt_responds/`
  - (QWEN & DeepSeek berbagi skill `chat_gpt_responds` — tidak perlu paket tambahan)

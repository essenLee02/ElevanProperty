# 06. AI Integration System

## Provider Fallback Architecture (single primary → Private Agent)

`AI_PRIMARY_PROVIDER` memilih **satu** AI eksternal sebagai primary. Jika primary
gagal, sistem **TIDAK** melompat ke AI eksternal lain — langsung jatuh ke
**Private Agent** (chatbotPrivateController) yang selalu memberi jawaban.

```
AI_PRIMARY_PROVIDER=qwen      → QWEN     → Private Agent
AI_PRIMARY_PROVIDER=claude    → Claude   → Private Agent
AI_PRIMARY_PROVIDER=chatgpt   → ChatGPT  → Private Agent
AI_PRIMARY_PROVIDER=deepseek  → DeepSeek → Private Agent   (baru)
AI_PRIMARY_PROVIDER=private   → Private Agent (langsung, tanpa AI eksternal)
```

Pengecualian: bila primary = `private` dan Private Agent gagal, ada rantai
darurat eksternal (`executeExternalAIFallbackChain`): DeepSeek → Claude → ChatGPT → QWEN.

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
AI_PRIMARY_PROVIDER=deepseek         # qwen | claude | chatgpt | deepseek | private
ENABLE_CLAUDE_FALLBACK=true          # efektif = toggle global Claude (on/off)
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
RESPOND_CATALOG_RUN=OFF              # OFF = brief saja ; ON = brief + katalog
```

> **PENTING — arti RESPOND_CATALOG_RUN (baru):** Q1–Q12 **SELALU** dijalankan
> apa pun nilainya. Flag ini hanya menentukan isi SETELAH brief:
> `OFF` → cukup summary/brief saja; `ON` → brief + katalog rekomendasi.
> (Dulu flag ini keliru dipakai sebagai toggle seluruh mode.)

> **Larangan:** dilarang membuat `const` hardcode untuk nama model AI. Semua nama
> model dibaca dari `.env` (`OPENAI_MODEL`, `CLAUDE_MODEL`, `QWEN_MODEL`, `DEEPSEEK_MODEL`).

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
  contextSource,  // 'rumah123' | 'flat_json' | 'none'
})
// Returns: { reply, provider, fallbackUsed, ... }
```

### Flow inside `generateWhatsAppAIReply`:

1. **Extract property filters** from message + history (`extractPropertyFilters`)
2. **Pre-qualification gate** (`buildQualifyReply`):
   - Checks 4 minimum fields: buildingType, transactionType, location, budget
   - If any missing → returns qualification question immediately (no AI called)
3. **★ Load AI Context Blocks** (`aiContextService.loadAIContextBlocks`): ← NEW
   - `buildFacilityContextBlock()` — always injected (facility names from DB)
   - `buildCityContextBlock()` — injected only when message is location-related
   - Cached 5 minutes, parallel fetch. See doc 16 for full details.
3.5. **Check `RESPOND_CATALOG_RUN`** (hanya memengaruhi isi SETELAH brief):
   - `OFF` → setelah semua Q1–Q12 wajib ✅ → tampilkan brief saja
   - `ON` → setelah brief → lanjutkan dengan katalog rekomendasi dari property context
   - Q1–Q12 tetap dijalankan pada kedua nilai; AI provider dipilih oleh `AI_PRIMARY_PROVIDER`
4. **Get property context** (`getWhatsappPropertyContext`) — sumber utama **database**
   (model Property + relasi), fallback JSON `indonesia_property_extended_v3.json`
5. **Build full prompt** (`buildWhatsappReplyPrompt`) with Q1-Q12 state + facility + city context injected
6. **Call AI provider chain** → return reply

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

- Model: `gpt-4o-mini` (from `OPENAI_MODEL` env)
- Key: `OPENAI_API_KEY`
- SDK: official `openai` npm package
- `OPENAI_STORE_RESPONSE=true` enables response storage in OpenAI dashboard

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

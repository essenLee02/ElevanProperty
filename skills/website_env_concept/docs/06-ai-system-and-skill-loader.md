# 06. AI System & Skill Loader

## 3-Layer Fallback Architecture

```
User Message (Website Chatbot atau WhatsApp)
        ↓
ChatGPT (primary) ──[quota/key error]──→ Claude (fallback)
                                               ↓
                                    [invalid key/error]
                                               ↓
                               chatbotPrivateController (last resort)
                               Website  → generateResponseForChatbot()
                               WhatsApp → generateResponseForTerminalMassege()
```

Toggle via `backend/.env`:
```env
AI_PRIMARY_PROVIDER=chatgpt          # or 'claude' to make Claude primary
ENABLE_CLAUDE_FALLBACK=true
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
```

---

## whatsappAIService.js — Unified WhatsApp AI Service

**File:** `backend/services/whatsappAIService.js`

Entry point tunggal untuk semua 3 WhatsApp controller (Fonnte, WATI, 360dialog).

```
generateWhatsAppAIReply({ session, message, agentName, options })
        ↓
[1] getWhatsappPropertyContext(message)
      → Rumah123 API (RUMAH123_DATA=ON) atau flat JSON
      → contextText, source, location, propertyType, transactionType
        ↓
[2] getConversationHistory(session.id, 10)
        ↓
[3] generateWhatsappReplyWithProviderFallback(session, history, message, propertyCtx)
        │   (ChatGPT → Claude, otomatis via aiProviderService)
        ↓ jika keduanya gagal
[4] generatePrivateTerminalMassege({
      session, history, userMessage, agentName,
      recommendationContext, externalError
    })
    → ResponseBuilderWhatsApp (format khusus WA)
        ↓
return { reply, provider, contextSource }
```

### Export
```javascript
const { generateWhatsAppAIReply } = require('../services/whatsappAIService');
```

### Perbedaan dengan Chatbot Website
| | Website Chatbot | WhatsApp Terminal |
|---|---|---|
| Entry point | `chatbotController.sendMessage` | `whatsappAIService.generateWhatsAppAIReply` |
| History | Dikirim dari frontend | Difetch dari DB (getConversationHistory) |
| Property Context | Dari frontend (propertyContext field) | Dari `getWhatsappPropertyContext()` otomatis |
| Private Agent | `generateResponseForChatbot()` | `generateResponseForTerminalMassege()` |
| Format | Markdown `**bold**` | Asterik `*bold*` + images + agent footer |

---

## aiProviderService.js — AI Orchestrator

`executeAIProviderWithFallback(taskName, chatGPTFn, claudeFn)`:
1. Reads `AI_PRIMARY_PROVIDER` from env
2. Calls primary provider function (callback)
3. On failure (429/401/network), calls fallback
4. Returns `{ reply, provider, primaryProvider, fallbackUsed, fallbackProvider, primaryError }`

Three wrapper functions:
- `generateChatbotReplyWithProviderFallback(session, history, message, context)` — website chatbot
- `generateContactReplyWithProviderFallback(contactPayload)` — contact form
- `generateWhatsappReplyWithProviderFallback(session, history, message, context)` — WA controllers

---

## ChatGPT Integration

| Setting | Value |
|---|---|
| Model | `gpt-4o-mini` (dari `OPENAI_MODEL`) |
| Key | `OPENAI_API_KEY` |
| Store response | `OPENAI_STORE_RESPONSE=true` |
| Max output | `OPENAI_MAX_OUTPUT_TOKENS=0` (unlimited) |
| Prompt builder | `buildWhatsappReplyPrompt()` via `aiPromptBuilderService.js` |

---

## Claude Integration

| Setting | Value |
|---|---|
| Model | `claude-haiku-4-5-20251001` (dari `CLAUDE_MODEL`) |
| Key | `ANTHROPIC_API_KEY` ⚠️ placeholder — fill real key to activate |
| API Version | `2023-06-01` |
| Max tokens | `1200` (`CLAUDE_MAX_TOKENS`) |

---

## chatbotPrivateController.js — Private Agent (Last Resort)

**File:** `backend/controllers/chatbotPrivateController.js` (~1300 lines)

Local fallback — no external API, always succeeds. OOP dengan 5 class:

```javascript
class LanguageDetector {
  static detect(message)              // returns 'id' | 'en'
  static isOffTopic(message)          // true jika non-property
  static hasPropertyIntent(message, filters)
}

class PropertyFormatter {             // Static helper — format data properti
  static formatLocation(item)
  static formatFacilities(value)
  static rumah123Item(item, index, lang)
  static catalogItem(item, index, lang)
  static rumah123List(listings, lang, limit)
  static catalogList(properties, lang, limit)
}

class ResponseBuilder {               // Format untuk WEBSITE CHATBOT
  constructor(lang)
  // Gunakan **markdown bold**, tanpa images, tanpa agent footer
  exactMatch({ rumah123Listings, catalogMatches, filters })
  alternative({ alternatives, rumah123Listings, filters })
  offTopic()
  clarification()
}

class ResponseBuilderWhatsApp {       // Format untuk WHATSAPP TERMINAL (NEW)
  constructor(lang, agentName)
  // Gunakan *asterik bold*, include images, include agent footer
  exactMatch({ rumah123Listings, catalogMatches, filters })
  alternative({ alternatives, rumah123Listings, filters })
  offTopic()
  clarification()
}

class ChatbotPrivateService {
  static async generateResponseForChatbot(params)         // Website — pakai ResponseBuilder
  static async generateResponseForTerminalMassege(params) // WhatsApp — pakai ResponseBuilderWhatsApp
  static async fetchRumah123Listings(filters, sessionLocation)
  static resolveCatalogMatches(context)
  static generateContactFormReply(payload)
  static #wrap(reply, meta)
}
```

### Dual Response Functions

```javascript
// ── Website Chatbot ───────────────────────────────────────────────────────
// Format: **markdown bold**, tanpa images, tanpa agent footer
// Max properties: 6 dari catalog, 20 dari Rumah123
generateResponseForChatbot({
  session, history, userMessage, recommendationContext, externalError
})

// ── WhatsApp Terminal ─────────────────────────────────────────────────────
// Format: *asterik bold*, dengan images, dengan agent footer
// Max properties: 6 (WhatsApp character limit)
generateResponseForTerminalMassege({
  session, history, userMessage,
  agentName,             // ← WAJIB: nama agent untuk footer
  recommendationContext,
  externalError
})
```

### Exported Functions

```javascript
module.exports.generatePrivateChatbotResponse = (params) =>
  ChatbotPrivateService.generateResponseForChatbot(params);

module.exports.generatePrivateTerminalMassege = (params) =>
  ChatbotPrivateService.generateResponseForTerminalMassege(params);

module.exports.generatePrivateContactReply = (payload) =>
  ChatbotPrivateService.generateContactFormReply(payload);

module.exports.generatePrivateChatbotResponse
module.exports.generatePrivateTerminalMassege
module.exports.generatePrivateContactReply
module.exports.privateAgentStatus
module.exports.sendPrivateMessage
module.exports.debugTestRumah123
module.exports.loadPrivateChatbotSkillInfo
```

---

## AI Error Cases

| Error | Behavior |
|---|---|
| OpenAI 429 (quota exceeded) | Falls back to Claude |
| OpenAI 401 (invalid key) | Falls back to Claude |
| Claude 401 (invalid/placeholder key) | Falls back to private agent |
| Website chatbot fallback | `generateResponseForChatbot()` — web format |
| WhatsApp fallback | `generateResponseForTerminalMassege()` — WA format + agent footer |
| `ENABLE_CHATBOT_PRIVATE_CONTROLLER=false` | Returns 502 (no private fallback) |

---

## Skill Loader (`skillPromptService.js`)

### Skill Directory Structure

```
skills/
├── chat_gpt_responds/       ← .md files injected into ChatGPT system prompt
│   ├── SKILL.md
│   └── docs/
│       ├── 01-core-role-scope-style.md
│       ├── 02-property-intent-terminology-data.md
│       ├── 03-catalog-matching-recommendations.md
│       ├── 04-history-memory-context.md          ← Context continuation rules
│       ├── 05-multilingual-provider-sync.md
│       ├── 06-response-format-templates-quality.md
│       ├── 07-offtopic-clarification-negotiation.md
│       ├── 08-rumah123-live-data.md
│       └── 09-qualification-flow.md              ← Q0–Q12 customer qualification
│
├── claude_responds/         ← .md files injected into Claude system prompt (synced)
│   ├── SKILL.md
│   └── docs/  (mirror of chat_gpt_responds/docs/)
│
└── website_env_concept/     ← system documentation (AI reads these)
    ├── SKILL.md
    └── docs/ (14 files)
```

### How Skills Are Loaded

`skillPromptService.js` reads **all `.md` files** dari skill folders pada setiap request.

Character limits (dari `.env`):
```env
SKILL_MAX_WEBSITE_CHARACTERS=12000    # content from website_env_concept/
SKILL_MAX_RESPONSE_CHARACTERS=22000   # content from chat_gpt_responds/ or claude_responds/
SKILL_MAX_PROJECT_CHARACTERS=36000    # combined project skill
```

### Status Check

```bash
GET /api/chatbot/skill-status
```

### Adding New Skill Files

1. Buat `.md` file di `skills/chat_gpt_responds/` (untuk ChatGPT) atau `skills/claude_responds/`
2. Otomatis dimuat pada request berikutnya — **tidak perlu restart**
3. Content ditambahkan ke system prompt hingga batas karakter

---

## Key Behavioral Rules (dari skills/chat_gpt_responds/)

### Context-Aware Continuation (doc 04)
Ketika AI bertanya "sewa atau beli?" dan customer menjawab "saya beli":
- Backend (`isPropertyContextContinuation`) sudah men-detect ini sebagai lanjutan
- AI harus menginterpretasikan jawaban pendek sebagai jawaban atas pertanyaan sebelumnya
- Kumpulkan: transactionType, buildingType, location, budget lintas giliran
- Tampilkan listing saat readiness ≥ 3

### Qualification Flow Q0–Q12 (doc 09)
Sebelum tampilkan listing, kumpulkan:
- Q0/Q1: sewa atau beli? tipe apa?
- Q2: kota/area mana?
- Q3: budget (via 2 price anchors, jangan tanya langsung)
- Q8: masuk/pindah bulan apa? (MANDATORY, jangan skip)

### Strict Type Matching (doc 03)
Jika user minta gudang → alternatif hanya gudang, bukan apartemen/rumah.

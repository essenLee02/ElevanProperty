# 06. AI System & Skill Loader

## 3-Layer Fallback Architecture

```
User Message
     ↓
ChatGPT (primary) ──[quota/key error]──→ Claude (fallback)
                                               ↓
                                    [invalid key/error]
                                               ↓
                               chatbotPrivateController (last resort)
                               (local logic, no external API)
```

Toggle via `backend/.env`:
```env
AI_PRIMARY_PROVIDER=chatgpt          # or 'claude' to make Claude primary
ENABLE_CLAUDE_FALLBACK=true
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
```

---

## aiProviderService.js (Orchestrator)

`executeAIProviderWithFallback(taskName, chatGPTFn, claudeFn)`:
1. Reads `AI_PRIMARY_PROVIDER` from env
2. Calls primary provider function (passed as callback)
3. On failure (429 quota, 401 invalid key, network error), calls fallback
4. Returns `{ reply, provider, primaryProvider, fallbackUsed, fallbackProvider, primaryError }`

Three wrapper functions:
- `generateChatbotReplyWithProviderFallback(session, history, message, context)` — website chatbot
- `generateContactReplyWithProviderFallback(contactPayload)` — contact form
- `generateWhatsappReplyWithProviderFallback(session, history, message, context)` — Fonnte webhook

---

## ChatGPT Integration

| Setting | Value |
|---|---|
| Model | `gpt-4o-mini` (from `OPENAI_MODEL`) |
| Key | `OPENAI_API_KEY` |
| Store response | `OPENAI_STORE_RESPONSE=true` |
| Max output | `OPENAI_MAX_OUTPUT_TOKENS=0` (unlimited) |

Called via official `openai` npm package.

---

## Claude Integration

| Setting | Value |
|---|---|
| Model | `claude-haiku-4-5-20251001` (from `CLAUDE_MODEL`) |
| Key | `ANTHROPIC_API_KEY` ⚠️ placeholder — fill real key to activate |
| API Version | `2023-06-01` |
| Max tokens | `1200` (`CLAUDE_MAX_TOKENS`) |

Called via **raw axios HTTP** (not official Anthropic SDK).

---

## chatbotPrivateController.js — Private Agent (Last Resort)

Local fallback — no external API, always works. Full OOP with 4 classes:

```javascript
class LanguageDetector {
  static detect(message)        // returns 'id' (Indonesian) or 'en' (English)
  static isOffTopic(message)    // true if not property-related
}

class PropertyFormatter {
  static formatLocation(item)               // city + province string
  static rumah123Item(item, index, lang)    // format live listing for response
}

class ResponseBuilder {
  constructor(lang)
  exactMatch({ session, matches, filters, userMessage, history })
  alternative({ session, alternatives, filters, userMessage })
}

class ChatbotPrivateService {
  static async generateResponse({ session, history, userMessage, recommendationContext, externalError })
  static #wrap(reply, meta)
}
```

Exported functions:
- `generatePrivateChatbotResponse(params)` — website chatbot fallback
- `generatePrivateContactReply({ name, phone, subject, message })` — contact form fallback
- `sendPrivateMessage(req, res)` — `POST /api/chatbot/private-message` (direct test endpoint)
- `privateAgentStatus(_req, res)` — `GET /api/chatbot/private-status`

---

## AI Error Cases

| Error | Behavior |
|---|---|
| OpenAI 429 (quota exceeded) | Falls back to Claude |
| OpenAI 401 (invalid key) | Falls back to Claude |
| Claude 401 (invalid/placeholder key) | Falls back to private agent |
| All providers fail | Returns 502 with error message |
| `ENABLE_CHATBOT_PRIVATE_CONTROLLER=false` | Returns 502 (no private fallback) |

---

## Skill Loader (`skillPromptService.js`)

### Skill Directory Structure

```
skills/
├── chat_gpt_responds/       ← .md files injected into ChatGPT system prompt
│   └── *.md
├── claude_responds/         ← .md files injected into Claude system prompt
│   └── *.md
└── website_env_concept/     ← system documentation (AI reads these)
    ├── SKILL.md
    └── docs/
        └── *.md
```

### How Skills Are Loaded

`skillPromptService.js` reads **all `.md` files** from the skill folders on each request.

Character limits (from `.env`):
```env
SKILL_MAX_WEBSITE_CHARACTERS=12000   # content from website_env_concept/
SKILL_MAX_RESPONSE_CHARACTERS=22000  # content from chat_gpt_responds/ or claude_responds/
SKILL_MAX_PROJECT_CHARACTERS=36000   # combined project skill
```

### Status Check

```
GET /api/chatbot/skill-status
```

Returns:
```json
{
  "groups": {
    "chat_gpt_responds": { "exists": true, "markdownFileCount": 3 },
    "claude_responds":   { "exists": true, "markdownFileCount": 3 },
    "website_env_concept": { "exists": true, "markdownFileCount": 12 }
  }
}
```

If `chat_gpt_responds` or `claude_responds` folders are empty, AI still works — falls back to minimal system prompt in `aiProviderService.js`.

### Adding New Skill Files

1. Create a `.md` file in `skills/chat_gpt_responds/` (for ChatGPT) or `skills/claude_responds/` (for Claude)
2. Automatically loaded on next request — **no restart needed**
3. Content appended to system prompt up to character limit

Example `skills/chat_gpt_responds/property-tone.md`:
```markdown
# Response Guidelines
- Always respond in the same language as the user (Indonesian or English)
- Keep responses concise — max 3 property recommendations per message
- Always include price and location in property listings
- End responses with a follow-up question
```

# 05. AI Integration System

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

## aiProviderService.js

`executeAIProviderWithFallback(taskName, chatGPTFn, claudeFn)`:
1. Reads `AI_PRIMARY_PROVIDER` from env
2. Calls primary provider function (passed as callback)
3. On failure (429 quota, 401 invalid key, network error), calls fallback
4. Returns `{ reply, provider, primaryProvider, fallbackUsed, fallbackProvider, primaryError }`

Used by three wrapper functions:
- `generateChatbotReplyWithProviderFallback(session, history, message, context)` — website chatbot
- `generateContactReplyWithProviderFallback(contactPayload)` — contact form
- `generateWhatsappReplyWithProviderFallback(session, history, message, context)` — Fonnte webhook

## ChatGPT Integration

- Model: `gpt-4o-mini` (from `OPENAI_MODEL`)
- Key: `OPENAI_API_KEY`
- Called via official `openai` npm package
- `OPENAI_STORE_RESPONSE=true` enables response storage in OpenAI dashboard

## Claude Integration

- Model: `claude-haiku-4-5-20251001` (from `CLAUDE_MODEL`)
- Key: `ANTHROPIC_API_KEY`
- API Version: `2023-06-01`
- Max tokens: 1200 (`CLAUDE_MAX_TOKENS`)
- Called via **raw axios HTTP** (not official Anthropic SDK)

## chatbotPrivateController.js — Private Agent

The local fallback. Fully OOP with 4 classes:

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
  exactMatch({ session, matches, filters, userMessage, history })   // found exact results
  alternative({ session, alternatives, filters, userMessage })      // suggest alternatives
}

class ChatbotPrivateService {
  static async generateResponse({ session, history, userMessage, recommendationContext, externalError })
  static #wrap(reply, meta)   // attach metadata to response
}
```

Exported functions:
- `generatePrivateChatbotResponse(params)` — for website chatbot fallback
- `generatePrivateContactReply({ name, phone, subject, message })` — for contact form fallback
- `sendPrivateMessage(req, res)` — POST /api/chatbot/private-message (direct test endpoint)
- `privateAgentStatus(_req, res)` — GET /api/chatbot/private-status
- `debugTestRumah123(req, res)` — GET /api/chatbot/debug/test-rumah123

## AI Error Cases Handled

| Error | Behavior |
|---|---|
| OpenAI 429 (quota exceeded) | Falls back to Claude |
| OpenAI 401 (invalid key) | Falls back to Claude |
| Claude 401 (invalid/placeholder key) | Falls back to private agent |
| All providers fail | Returns 502 with error message |
| `ENABLE_CHATBOT_PRIVATE_CONTROLLER=false` | Returns 502 (no private fallback) |

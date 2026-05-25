# 11. Module: Chatbot

## FloatingChatbot.vue
`frontend/src/components/FloatingChatbot.vue` (~950 lines)

Bottom-right floating chat widget. Visible on all pages (included in HomeView).
Public — no login required.

## Profile & Session Management

### User Profile (cookie: `chatbot_profile`)
Before sending first message, user fills:
- `name` (required)
- `phone` (required)
- `location` (required)

Stored in a persistent cookie. Restored on page reload.

### Session Cookie
Session ID stored in cookie with TTL from `GET /api/chatbot/config`:
- Default: 90 minutes (`CHATBOT_COOKIE_TTL_MINUTES`)
- When cookie expires, new session starts

### Returning Customer Recognition
`sessionService.findOrCreateSession()` normalizes name/phone/location to recognize returning customers even with slight typos.

## First Message — Property Context

On the first message of a new session, FloatingChatbot:
1. Loads `frontend/public/json_data/indonesia_property_36_provinces_flat.json` (36 provinces, flat array)
2. Sends it as `propertyContext` in the POST body

Backend uses this + live Rumah123 data to build the AI prompt context.

## Message Rendering (XSS-Safe)

```javascript
class MessageFormatter {
  static #escapeHtml(text) {
    // HTML-escape special chars FIRST (prevent XSS injection)
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;') /* ... */;
  }
  static toHtml(text) {
    const escaped = MessageFormatter.#escapeHtml(text);
    // Then convert markdown: **bold**, *italic*, `code`, - lists → safe HTML
    return escaped;
  }
}
```

## API Call

```javascript
POST /api/chatbot/message
Body: {
  name: "string",
  phone: "string",
  location: "string",
  message: "string",
  propertyContext: { ... }   // first message only; null on subsequent
}

Response: {
  success: true,
  reply: "string",
  sessionId: number,
  aiProvider: "chatgpt" | "claude" | "private_agent",
  fallbackUsed: boolean,
  exactMatches: number,
  alternatives: number
}
```

## Backend Handler
`backend/controllers/chatbotController.js` → class `ChatbotController`:

| Method | Route | Description |
|---|---|---|
| `sendMessage(req, res)` | POST /api/chatbot/message | main chatbot handler |
| `getConfig(_req, res)` | GET /api/chatbot/config | cookie TTL + required fields |
| `aiProviderStatus(_req, res)` | GET /api/chatbot/ai-provider-status | AI config check |
| `skillStatus(_req, res)` | GET /api/chatbot/skill-status | skill files check |

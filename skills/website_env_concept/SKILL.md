---
name: website-env-concept-code-aligned
description: Documentation aligned with the current ElevanLabs backend and frontend code. Covers actual Home, About Us, Contact, Google Sheets, MySQL, Vue, NodeJS behavior, plus implemented chatbot, ChatGPT API, Fonnte API, and JSON property catalog data flow.
---

# Website Environment Concept — Code Aligned Skill

## Purpose

This skill documents the actual current website behavior based on the backend and frontend code.

It also separates future development items clearly, so the documentation does not claim that unfinished modules already exist.

## Current Implemented Scope

Current code supports:

- NodeJS / Express backend
- VueJS frontend
- MySQL with Sequelize
- Google Sheets integration for Contact Form
- Home page
- About Us page with portfolio from real JSON dataset
- Contact page
- Frontend validation for Contact Form
- User activity logging endpoint
- Vue Router page navigation logging
- Floating Chatbot (`FloatingChatbot.vue`)
- ChatGPT / OpenAI API integration via `openaiService.js`
- Fonnte WhatsApp webhook integration
- Property catalog loaded from `indonesia_property_36_provinces_flat.json`
- Frontend services: `contactApi.js`, `chatbotApi.js`, `aboutApi.js`
- Backend services: `openaiService.js`, `propertyRecommendationService.js`, `sessionService.js`, `fonnteService.js`, `validationService.js`, `skillPromptService.js`
- Frontend components: `FloatingChatbot.vue`, `PortfolioCard.vue`, `PropertyFilter.vue`

## Data Source: indonesia_property_36_provinces_flat.json

The primary property catalog is a static JSON file located at:

```
frontend/public/json_data/indonesia_property_36_provinces_flat.json
```

### File Structure

```json
{
  "metadata": { ... },
  "properties": [ { ... }, ... ]
}
```

Each property record contains: `id`, `title`, `description`, `price`, `location` (object with `province`, `city`, `area`), `address`, `facilities` (array), `building_area`, `land_area`, `building_type`, `transaction_type`, `image`.

### Dataset Scale

- **36 Indonesian provinces**
- **220 records per province**
- **7,920 total property records**
- Building types: `house`, `apartment`, `hotel`, `villa`, `boarding_house`, `shophouse`, `office`, `warehouse`, `others`
- Transaction types: `sale`, `rent`, `purchase`
- Images: shared PNG files in `/assets/image_data/properties/` per building type

### How It Is Used

| Consumer | Usage |
|---|---|
| `AboutView.vue` | Fetches JSON via `fetch('/json_data/...')`, displays 12 per page with pagination |
| `propertyRecommendationService.js` (backend) | Reads JSON at startup via `fs.readFileSync`, caches in memory, powers chatbot property search |
| `FloatingChatbot.vue` | Loads a 50-property sample on first user chat message, sends as `propertyContext` in request payload |

## Chatbot — First-Chat JSON Context Flow

When a user has entered their name and phone number and sends their **first chat message**, the following happens:

```
User sends first message
        ↓
FloatingChatbot.vue loads 50-property sample from JSON file (via fetch)
        ↓
Sample is attached to the request payload as `propertyContext`
        ↓
POST /chatbot/message { name, phone, message, propertyContext }
        ↓
chatbotController.js detects propertyContext, formats it into text
        ↓
Text is appended to the LLM context alongside the backend property catalog result
        ↓
generateChatbotReply() calls OpenAI with combined context
        ↓
ChatGPT returns property-aware recommendation reply
```

### Why 50 Properties (Sample)

Sending all 7,920 records to ChatGPT would exceed token limits and slow the request. The frontend sends a representative sample of 50 records evenly distributed across the full dataset. For detailed property search, the backend `propertyRecommendationService.js` handles full-catalog filtering using its in-memory cache.

### Subsequent Messages

From the second message onward, `propertyContext` is **not resent** (`contextSentOnce` flag in `FloatingChatbot.vue`). All subsequent context comes from the backend property catalog search in `propertyRecommendationService.js`.

## About Us Portfolio Display

`AboutView.vue` no longer contains any hardcoded dummy data. The portfolio section:

1. First tries the backend API (`GET /about`) for live data
2. Falls back to loading from the JSON file directly via browser `fetch()`
3. Normalizes JSON fields (snake_case → camelCase) for the `PortfolioCard` component
4. Shows 12 properties per page with prev/next pagination
5. Supports filter by `buildingType`, `transactionType`, and `location` (province, city, area)

## Backend Property Search (propertyRecommendationService.js)

The backend service now reads from the same JSON file using Node's `fs.readFileSync()` at startup. The loaded records are cached in memory (`_jsonPropertiesCache`). All hardcoded `baseProperties` and `generatedProperties` arrays have been removed.

The service normalises each record:
- `location.city` → `city`
- `location.area` → `district`
- `building_type` → `buildingType`
- `transaction_type` → `transactionType`
- `building_area` → `buildingArea`
- `land_area` → `landArea`
- `facilities` (array) → joined string

## Not Yet Implemented in Current Code

Current code does not yet include:

- Property model in MySQL database (properties are served from JSON, not database)
- Admin panel for property CRUD
- WhatsApp chatbot multi-step conversation flow

## Documentation Rule

Every `.md` file must clearly distinguish:

```text
Current implementation
Planned development
Recommended improvement
```

This avoids mismatch between documentation and actual code behavior.

## Chatbot Cookie, Location, and History Update

Current chatbot profile fields:

```text
name
phone
location
```

The chatbot must require all three fields before the user can start chatting.

The browser cookie only stores the temporary chat profile. The cookie TTL is controlled from the backend `.env` file:

```env
CHATBOT_COOKIE_TTL_MINUTES=20
```

The frontend must call:

```text
GET /api/chatbot/config
```

and use the returned `cookieTtlSeconds` to set the browser cookie `Max-Age`.

When the cookie expires or is deleted, the user must enter name, phone number, and location again before sending a new chatbot message.

The chatbot conversation history is not only based on the browser cookie. Chat history is stored and reconnected by customer identity:

```text
normalizedName
normalizedPhone
normalizedLocation
```

When the same customer returns and enters the same name, phone, and location, ChatGPT should use previous history for context while still prioritizing the latest user message.

On the first chatbot message after profile input, the website sends a compact JSON property context from:

```text
frontend/public/json_data/indonesia_property_36_provinces_flat.json
```

to the backend, and the backend forwards that context to ChatGPT together with conversation history.

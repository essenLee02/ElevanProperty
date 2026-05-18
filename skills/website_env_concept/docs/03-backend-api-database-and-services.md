# 03 — Backend API, Database, and Services

## Main Route File

```text
backend/routes/index.js
```

## Current API Routes

```text
GET  /api/home
GET  /api/about

POST /api/contact
GET  /api/contact/google-sheets-status
GET  /api/contact/ai-whatsapp-status

GET  /api/chatbot/config
GET  /api/chatbot/ai-provider-status
GET  /api/chatbot/skill-status
GET  /api/chatbot/private-status
POST /api/chatbot/private-message
POST /api/chatbot/message

POST /api/fonnte/webhook

POST /api/log
```

## Controllers

```text
backend/controllers/homeController.js
backend/controllers/aboutController.js
backend/controllers/contactController.js
backend/controllers/chatbotController.js
backend/controllers/chatbotPrivateController.js
backend/controllers/fonnteWebhookController.js
backend/controllers/logController.js
```

## Services

```text
backend/services/aiPromptBuilderService.js
backend/services/aiProviderService.js
backend/services/claudeService.js
backend/services/fonnteService.js
backend/services/googleSheetsService.js
backend/services/openaiService.js
backend/services/propertyRecommendationService.js
backend/services/sessionService.js
backend/services/skillPromptService.js
backend/services/validationService.js
```

## Service Responsibilities

| Service | Responsibility |
|---|---|
| `openaiService.js` | ChatGPT / OpenAI API calls |
| `claudeService.js` | Claude / Anthropic API calls |
| `aiProviderService.js` | AI routing and fallback |
| `aiPromptBuilderService.js` | Shared prompt building |
| `skillPromptService.js` | Load `.md` skills from registered folders |
| `propertyRecommendationService.js` | Load/filter JSON property catalog |
| `sessionService.js` | Chat sessions and history |
| `fonnteService.js` | WhatsApp send/webhook parsing |
| `googleSheetsService.js` | Google Sheets append/status |
| `validationService.js` | Request validation |

## Database

The backend uses:

```text
MySQL
Sequelize
```

Environment:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_property
DB_DIALECT=mysql
```

## Models

```text
backend/models/Contact.js
backend/models/Log.js
backend/models/ChatSession.js
backend/models/ChatMessage.js
backend/models/Property.js
backend/models/index.js
```

## Model Summary

### Contact

Stores Contact Form submissions:

```text
name
email
phone
subject
message
```

### Log

Stores activity logs:

```text
action
details
level
```

### ChatSession

Stores chatbot identity:

```text
name
normalizedName
phone
normalizedPhone
location
normalizedLocation
source
lastMessageAt
```

### ChatMessage

Stores conversation history:

```text
chatSessionId
role
message
channel
metadata
```

### Property

Optional database-backed property model.

Current recommendation source should prioritize JSON catalog unless the project is intentionally migrated to database-backed property records.

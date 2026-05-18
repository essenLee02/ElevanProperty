# 07 — Chatbot Module, AI Providers, and Skill Loader

## Purpose

The Chatbot module helps users search and ask questions about properties.

It must use backend property catalog context and response skill rules.

## Frontend File

```text
frontend/src/components/FloatingChatbot.vue
frontend/src/services/chatbotApi.js
```

## Backend Routes

```text
GET  /api/chatbot/config
GET  /api/chatbot/ai-provider-status
GET  /api/chatbot/skill-status
GET  /api/chatbot/private-status
POST /api/chatbot/private-message
POST /api/chatbot/message
```

## Backend Controllers

```text
backend/controllers/chatbotController.js
backend/controllers/chatbotPrivateController.js
```

## Backend Services

```text
backend/services/sessionService.js
backend/services/propertyRecommendationService.js
backend/services/aiProviderService.js
backend/services/aiPromptBuilderService.js
backend/services/skillPromptService.js
backend/services/openaiService.js
backend/services/claudeService.js
```

## Required Chatbot Profile

Before chatting, users must provide:

```text
name
phone
location
```

## Cookie Behavior

Cookie name:

```text
propertyChatProfile
```

Backend TTL:

```env
CHATBOT_COOKIE_TTL_MINUTES=20
```

If cookie expires, frontend must ask name, phone, and location again.

## AI Provider Flow

Recommended flow:

```text
ChatGPT primary
→ Claude fallback
→ Private Agent fallback
```

Environment:

```env
AI_PRIMARY_PROVIDER=chatgpt
ENABLE_CLAUDE_FALLBACK=true
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
```

## ChatGPT Provider

Service:

```text
backend/services/openaiService.js
```

Environment:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
OPENAI_STORE_RESPONSE=true
OPENAI_MAX_OUTPUT_TOKENS=0
```

## Claude Provider

Service:

```text
backend/services/claudeService.js
```

Environment:

```env
ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-haiku-4-5-20251001
CLAUDE_API_VERSION=2023-06-01
CLAUDE_MAX_TOKENS=1200
```

## Private Agent

Controller:

```text
backend/controllers/chatbotPrivateController.js
```

Private Agent should activate when external AI providers are unavailable or fail.

## Skill Loader

Service:

```text
backend/services/skillPromptService.js
```

Prompt builder:

```text
backend/services/aiPromptBuilderService.js
```

Registered skill folders:

```text
skills/website_env_concept
skills/chat_gpt_responds
skills/claude_responds
```

Provider mapping:

```text
ChatGPT → skills/chat_gpt_responds
Claude → skills/claude_responds
Private Agent → skills/chat_gpt_responds + skills/claude_responds
```

## Property Recommendation Service

Service:

```text
backend/services/propertyRecommendationService.js
```

Main catalog source:

```text
frontend/public/json_data/indonesia_property_36_provinces_flat.json
```

Responsibilities:

- load JSON catalog;
- normalize property data;
- detect building type;
- detect transaction type;
- detect location;
- detect budget/facilities;
- build exact matches and alternatives;
- prepare catalog context for AI providers.

## Backend Chat Flow

```text
User message
→ chatbotController receives payload
→ sessionService finds/creates ChatSession
→ save user message
→ load recent history
→ propertyRecommendationService builds catalog context
→ aiProviderService routes to ChatGPT / Claude / Private Agent
→ save assistant message
→ return reply to frontend
```

## Frontend Rendering Rule

AI responses may use markdown bold:

```text
**Property Name**
**Rp 39.950.000.000**
```

Frontend should safely escape HTML first, then render markdown bold as:

```html
<b>text</b>
```

## Chatbot Scope Rule

Chatbot should focus on:

```text
buying property
selling property
renting property
property recommendation
```

For unrelated topics, it should politely refuse and ask for a property-related question.

## Troubleshooting

If chatbot gives wrong recommendation:

1. check JSON catalog data;
2. check backend property filter result;
3. check exact match vs alternative logic;
4. check response skill folder loaded by `/api/chatbot/skill-status`;
5. check provider status through `/api/chatbot/ai-provider-status`.

# 14 — Chatbot Private Controller

## Purpose

The backend includes a private chatbot controller:

```text
backend/controllers/chatbotPrivateController.js
```

This controller is activated when ChatGPT and Claude cannot provide a response.

## Activation Condition

The controller can be used when external AI providers fail due to:

```text
billing or quota issue
wrong API key
wrong model name
network error
API timeout
connection error
provider response parsing error
```

## Environment

```env
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
```

## Flow

```text
POST /api/chatbot/message
→ chatbotController receives message
→ ChatGPT is tried first
→ Claude is tried next
→ if both fail, chatbotPrivateController generates the response
```

## Direct Test Route

```text
POST /api/chatbot/private-message
```

## Status Route

```text
GET /api/chatbot/private-status
```

## Required Response Behavior

The controller must follow the `.md` skills:

```text
skills/chat_gpt_reponds/
skills/claude_responds/
```

## Important Rules

- only answer property buying, selling, and rental questions;
- reject off-topic questions politely;
- use latest user message as highest priority;
- use conversation history only when relevant;
- use local property JSON/backend catalog;
- do not invent property data;
- exact matches first;
- alternatives only when exact matches are unavailable;
- use markdown bold for property name and price.

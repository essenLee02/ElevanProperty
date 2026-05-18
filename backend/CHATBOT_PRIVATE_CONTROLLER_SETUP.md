# Chatbot Private Controller Setup

## Purpose

`chatbotPrivateController` is a local backend controller for the floating chatbot.

It becomes active when the backend cannot get a usable response from ChatGPT or Claude, for example:

```text
ChatGPT billing/quota/token issue
ChatGPT wrong API key
ChatGPT wrong model
ChatGPT network/API connection error
Claude billing/quota/token issue
Claude wrong API key
Claude wrong model
Claude network/API connection error
```

## Controller File

```text
backend/controllers/chatbotPrivateController.js
```

## How It Works

```text
User sends chatbot message
→ chatbotController tries ChatGPT
→ if ChatGPT fails, aiProviderService tries Claude
→ if Claude fails, chatbotController activates chatbotPrivateController
→ chatbotPrivateController builds response from local property catalog and skills/chat_gpt_reponds .md rules
```

## Environment

Add this to `backend/.env`:

```env
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
```

## Routes

```text
GET  /api/chatbot/private-status
POST /api/chatbot/private-message
```

`/api/chatbot/private-message` is for direct testing only. The normal chatbot still uses:

```text
POST /api/chatbot/message
```

## Terminal Logs

When external providers fail, the terminal will show:

```text
[CHATGPT ERROR]
[CLAUDE ERROR]
[AI PROVIDER FALLBACK]
[CHATBOT EXTERNAL AI FAILED]
[CHATBOT PRIVATE CONTROLLER ACTIVE]
```

## Response Rules

The private controller follows the same response behavior as the `.md` skill files:

```text
skills/chat_gpt_reponds/
skills/claude_responds/
```

Main rules:

- property questions only;
- same language as user;
- latest message priority;
- use local JSON/backend property catalog only;
- do not invent price, location, address, or facilities;
- exact match first;
- if no exact match, clearly say no exact match and show closest alternatives;
- reject off-topic questions politely;
- use **bold** for property name and price.

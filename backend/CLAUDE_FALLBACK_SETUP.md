# Claude Fallback Setup

## Purpose

The backend now supports two AI providers:

```text
Primary provider: ChatGPT / OpenAI
Fallback provider: Claude / Anthropic
```

If ChatGPT fails because of quota, billing, or rate-limit issues, the backend automatically sends the same chatbot/contact/WhatsApp prompt to Claude.

## Add These Variables To `backend/.env`

```env
AI_PRIMARY_PROVIDER=chatgpt
ENABLE_CLAUDE_FALLBACK=true

ANTHROPIC_API_KEY=your_claude_api_key
CLAUDE_MODEL=claude-sonnet-4-5
CLAUDE_API_VERSION=2023-06-01
CLAUDE_MAX_TOKENS=1200
```

## Backend Service Files

```text
backend/services/openaiService.js
backend/services/claudeService.js
backend/services/aiProviderService.js
backend/services/aiPromptBuilderService.js
```

## Service Responsibilities

### `openaiService.js`

ChatGPT-only service.

Main functions:

```text
callChatGPTResponseAPI
generateChatGPTContactReply
generateChatGPTChatbotReply
generateChatGPTWhatsappReply
checkChatGPTConfig
```

### `claudeService.js`

Claude-only service.

Main functions:

```text
callClaudeMessagesAPI
generateClaudeContactReply
generateClaudeChatbotReply
generateClaudeWhatsappReply
checkClaudeConfig
```

### `aiProviderService.js`

Provider router and fallback service.

Main functions:

```text
generateContactReplyWithProviderFallback
generateChatbotReplyWithProviderFallback
generateWhatsappReplyWithProviderFallback
checkAIProviderConfig
```

## Status Check

Run backend, then open:

```text
http://localhost:5000/api/chatbot/ai-provider-status
```

Expected result should show:

```text
primaryProvider
providerOrder
claudeFallbackEnabled
claudeFallbackReady
chatGPT
claude
```

## Fallback Rule

Claude fallback happens when:

```text
AI_PRIMARY_PROVIDER=chatgpt
ENABLE_CLAUDE_FALLBACK=true
ANTHROPIC_API_KEY is filled
ChatGPT returns quota/billing/rate-limit issue
```

## Restart Backend

After updating `.env`, restart backend:

```bash
cd backend
nodemon
```

or:

```bash
npm run dev
```

# 12 — AI Provider Routing: ChatGPT Primary and Claude Fallback

## Purpose

The chatbot should be able to use more than one AI provider.

Current behavior:

```text
ChatGPT is the primary provider.
Claude is the fallback provider.
```

If ChatGPT fails because of quota, billing, or rate-limit issues, the backend should automatically send the same prompt to Claude.

## Backend Environment Variables

Add these values to `backend/.env`:

```env
AI_PRIMARY_PROVIDER=chatgpt
ENABLE_CLAUDE_FALLBACK=true

ANTHROPIC_API_KEY=your_claude_api_key
CLAUDE_MODEL=claude-sonnet-4-5
CLAUDE_API_VERSION=2023-06-01
CLAUDE_MAX_TOKENS=1200
```

## Provider Service Files

The backend should clearly separate provider responsibilities:

```text
backend/services/openaiService.js
backend/services/claudeService.js
backend/services/aiProviderService.js
backend/services/aiPromptBuilderService.js
```

## Service Responsibility

### `openaiService.js`

Handles ChatGPT only.

Recommended function names:

```text
callChatGPTResponseAPI
generateChatGPTContactReply
generateChatGPTChatbotReply
generateChatGPTWhatsappReply
checkChatGPTConfig
```

### `claudeService.js`

Handles Claude only.

Recommended function names:

```text
callClaudeMessagesAPI
generateClaudeContactReply
generateClaudeChatbotReply
generateClaudeWhatsappReply
checkClaudeConfig
```

### `aiProviderService.js`

Connects ChatGPT and Claude fallback behavior.

Recommended function names:

```text
generateContactReplyWithProviderFallback
generateChatbotReplyWithProviderFallback
generateWhatsappReplyWithProviderFallback
checkAIProviderConfig
```

### `aiPromptBuilderService.js`

Builds shared prompt text so ChatGPT and Claude receive consistent instructions.

## Fallback Logic

```text
User sends chatbot message
→ backend builds property context
→ backend tries ChatGPT first
→ if ChatGPT has billing/quota/rate-limit issue
→ backend sends the same task to Claude
→ backend returns Claude response to frontend
```

## Metadata Rule

When saving assistant messages, store:

```text
source
primaryProvider
fallbackUsed
fallbackProvider
primaryError
```

Example:

```json
{
  "source": "claude",
  "primaryProvider": "chatgpt",
  "fallbackUsed": true,
  "fallbackProvider": "claude",
  "primaryError": "ChatGPT API quota/billing/rate limit issue"
}
```

## Status Endpoint

Use this route to check provider configuration:

```text
GET /api/chatbot/ai-provider-status
```

## Important Rule

The frontend should not call ChatGPT or Claude directly.

Only the backend may call private AI provider APIs.

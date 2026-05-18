# Skill Loader Integration

## Purpose

The backend now loads registered response skills directly from these folders:

```text
skills/chat_gpt_responds
skills/claude_responds
skills/website_env_concept
```

## What Changed

The backend no longer depends on hardcoded old response-skill file names such as:

```text
chat_gpt_reponds
03-catalog-recommendation-rules.md
20-multilingual-llm-response-sync.md
```

Instead, it dynamically scans all `.md` files inside the registered skill folders.

## Main Files

```text
backend/services/skillPromptService.js
backend/services/aiPromptBuilderService.js
backend/services/openaiService.js
backend/services/claudeService.js
backend/controllers/chatbotController.js
backend/controllers/chatbotPrivateController.js
backend/routes/index.js
```

## Provider Skill Mapping

```text
ChatGPT → skills/chat_gpt_responds
Claude  → skills/claude_responds
Private Agent → skills/chat_gpt_responds + skills/claude_responds
```

## Runtime Flow

```text
User sends message
→ chatbotController builds property catalog context
→ aiProviderService calls ChatGPT or Claude
→ aiPromptBuilderService builds provider-specific prompt
→ skillPromptService loads .md files from the correct skill folder
→ ChatGPT/Claude receives the skill rules in the prompt
```

## Status Endpoint

Use this endpoint to confirm that skill folders are detected:

```text
GET /api/chatbot/skill-status
```

Expected response includes:

```text
skills/chat_gpt_responds
skills/claude_responds
markdownFileCount
markdownFiles
```

## AI Provider Status

This endpoint also includes the skill registry:

```text
GET /api/chatbot/ai-provider-status
```

## Environment Tuning

Optional prompt-size limits:

```env
SKILL_MAX_WEBSITE_CHARACTERS=12000
SKILL_MAX_RESPONSE_CHARACTERS=22000
SKILL_MAX_PROJECT_CHARACTERS=36000
```

## Notes

The old typo folder `skills/chat_gpt_reponds` is still supported as backward compatibility only.

The correct folder name is:

```text
skills/chat_gpt_responds
```

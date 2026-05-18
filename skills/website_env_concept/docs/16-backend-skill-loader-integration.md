# 16 — Backend Skill Loader Integration

## Purpose

The website backend must load response-skill Markdown files from the registered skill folders.

## Registered Skill Folders

```text
skills/chat_gpt_responds
skills/claude_responds
skills/website_env_concept
```

## Provider Mapping

```text
ChatGPT provider → chat_gpt_responds skill files
Claude provider → claude_responds skill files
Private Agent → both chat_gpt_responds and claude_responds skill files
```

## Backend Services

```text
backend/services/skillPromptService.js
backend/services/aiPromptBuilderService.js
backend/services/openaiService.js
backend/services/claudeService.js
```

## Important Rule

Do not hardcode individual old skill file names.

The backend should scan all `.md` files in each registered skill folder so future changes can be picked up without changing code.

## Check Endpoint

```text
GET /api/chatbot/skill-status
```

This endpoint should show whether the registered skill folders are found and how many Markdown files are loaded.

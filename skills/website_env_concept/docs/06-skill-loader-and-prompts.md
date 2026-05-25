# 06. Skill Loader & Prompts

## Skill Directory Structure

```
skills/
├── chat_gpt_responds/       ← .md skill files injected into ChatGPT system prompt
│   └── *.md                 ← any number of markdown files
├── claude_responds/         ← .md skill files injected into Claude system prompt
│   └── *.md
└── website_env_concept/     ← system documentation (this folder — AI reads these)
    ├── SKILL.md
    └── docs/
        └── *.md
```

## How Skills Are Loaded

`backend/services/skillPromptService.js` reads **all `.md` files** from the skill folders.

Character limits (from `.env`):
- `SKILL_MAX_WEBSITE_CHARACTERS=12000` — content from `website_env_concept/`
- `SKILL_MAX_RESPONSE_CHARACTERS=22000` — content from `chat_gpt_responds/` or `claude_responds/`
- `SKILL_MAX_PROJECT_CHARACTERS=36000` — combined project skill

## Status Check

```
GET /api/chatbot/skill-status
```

Returns per-group status:
```json
{
  "groups": {
    "chat_gpt_responds": { "exists": true, "markdownFileCount": 3, "files": [...] },
    "claude_responds":   { "exists": true, "markdownFileCount": 3, "files": [...] },
    "website_env_concept": { "exists": true, "markdownFileCount": 13 }
  }
}
```

If `chat_gpt_responds` or `claude_responds` folders are empty or missing, the AI still works — it falls back to a minimal system prompt built directly in `aiProviderService.js`.

## Adding Skill Files

To customize AI behavior:
1. Create a `.md` file in `skills/chat_gpt_responds/` (for ChatGPT) or `skills/claude_responds/` (for Claude)
2. The file is automatically loaded on next request (no restart needed)
3. Content is appended to the system prompt up to the character limit

Example `skills/chat_gpt_responds/property-tone.md`:
```markdown
# Response Guidelines
- Always respond in the same language as the user (Indonesian or English)
- Keep responses concise — max 3 property recommendations per message
- Always include price and location in property listings
- End responses with a follow-up question to keep conversation going
```

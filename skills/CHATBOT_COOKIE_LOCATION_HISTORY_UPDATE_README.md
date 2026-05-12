# Chatbot Cookie, Location, and History Update

This update adds these changes:

1. Chatbot profile now requires:
   - name
   - phone
   - location

2. Chatbot profile cookie TTL is controlled from backend `.env`:

```env
CHATBOT_COOKIE_TTL_MINUTES=20
```

3. Frontend reads cookie TTL from:

```text
GET /api/chatbot/config
```

4. If the cookie expires or is deleted, the user must enter name, phone, and location again.

5. Backend ChatSession now stores:
   - location
   - normalizedLocation

6. Conversation history is reconnected by:
   - normalizedName
   - normalizedPhone
   - normalizedLocation

7. OpenAI prompt now receives customer location and instructions to use history for the same name, phone, and location, while still prioritizing the latest user message.

8. Skill `.md` files were updated in:
   - `skills/website_env_concept`
   - `skills/website_env_concept_code`
   - `skills/property-ai-website-skills/docs/04-chatbot-skill.md`
   - `skills/property-ai-website-skills/docs/06-openai-gpt-integration.md`
   - `skills/chat_gpt_reponds/docs/07-conversation-history-and-latest-message-priority.md`

## Changed Main Code Files

```text
backend/.env
backend/.env.example
backend/server.js
backend/models/ChatSession.js
backend/controllers/chatbotController.js
backend/routes/index.js
backend/services/sessionService.js
backend/services/validationService.js
backend/services/openaiService.js
backend/services/skillPromptService.js
frontend/src/components/FloatingChatbot.vue
frontend/src/services/chatbotApi.js
```

## Validation Done

- Backend JS syntax checked using `node --check`.
- FloatingChatbot Vue SFC parsed successfully using `@vue/compiler-sfc`.

Note: full frontend build could not be completed in this sandbox because the uploaded `node_modules` is missing Rollup optional native dependency. Run `npm install` in the frontend folder, then `npm run build` on your machine.

# Recommended Next Steps

## Step 1 — Stabilize Current Code

- Fix ContactView `alert` mismatch.
- Use local jQuery or remove jQuery dependency.
- Use central API service in AboutView and ContactView.
- Decide whether logs should remain console-only or save to database.

## Step 2 — Improve Portfolio Data

- Move portfolio data from frontend random generation to stable static data or backend API.
- Add realistic property fields.
- Avoid random price and random area in production.

## Step 3 — Add Chatbot

- Add FloatingChatbot component.
- Add `/api/chatbot/message`.
- Add ChatSession and ChatMessage models.

## Step 4 — Add ChatGPT

- Add OpenAI environment variables.
- Add openaiService.js.
- Make chatbot response come from ChatGPT.

## Step 5 — Add Fonnte

- Add Fonnte environment variable.
- Add fonnteService.js.
- Add WhatsApp send and webhook flow.

---
name: website-env-concept-code-aligned-english
description: English documentation aligned with the current ElevanLabs backend and frontend code. Covers actual Home, About Us, Contact, Google Sheets, MySQL, Vue, and NodeJS behavior, plus planned chatbot, ChatGPT API, and Fonnte API development without changing code.
---

# Website Environment Concept — Code-Aligned English Skill

## Purpose

This skill documents the actual current website behavior based on the backend and frontend code.

It also separates future development items clearly, so the documentation does not claim that unfinished modules already exist.

## Current Implemented Scope

The current code supports:

- NodeJS / Express backend
- VueJS frontend
- MySQL with Sequelize
- Google Sheets integration for Contact Form
- Home page
- About Us page
- Contact page
- Frontend validation for Contact Form
- User activity logging endpoint
- Vue Router page navigation logging

## Not Yet Implemented in Current Code

The current code does not yet include:

- Floating chatbot
- ChatGPT / OpenAI API integration
- Fonnte WhatsApp integration
- ChatSession and ChatMessage models
- Property database model
- Dedicated service files for OpenAI, Fonnte, Google Sheets, validation, and session
- Frontend components such as `FloatingChatbot.vue`, `PortfolioCard.vue`, and `PropertyFilter.vue`
- Frontend services such as `contactApi.js`, `chatbotApi.js`, and `aboutApi.js`

## Documentation Rule

Every `.md` file must clearly distinguish:

```text
Current implementation
Planned development
Recommended improvement
```

This avoids mismatch between documentation and actual code behavior.

## Chatbot Cookie, Location, and History Update

Current chatbot profile fields:

```text
name
phone
location
```

The chatbot must require all three fields before the user can start chatting.

The browser cookie only stores the temporary chat profile. The cookie TTL is controlled from the backend `.env` file:

```env
CHATBOT_COOKIE_TTL_MINUTES=20
```

The frontend must call:

```text
GET /api/chatbot/config
```

and use the returned `cookieTtlSeconds` to set the browser cookie `Max-Age`.

When the cookie expires or is deleted, the user must enter name, phone number, and location again before sending a new chatbot message.

The chatbot conversation history is not only based on the browser cookie. Chat history is stored and reconnected by customer identity:

```text
normalizedName
normalizedPhone
normalizedLocation
```

When the same customer returns and enters the same name, phone, and location, ChatGPT should use previous history for context while still prioritizing the latest user message.

On the first chatbot message after profile input, the website sends a compact JSON property context from:

```text
frontend/public/json_data/indonesia_property_36_provinces_flat.json
```

to the backend, and the backend forwards that context to ChatGPT together with conversation history.

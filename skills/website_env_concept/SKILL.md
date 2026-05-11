---
name: website-env-concept-code-aligned
description: Documentation aligned with the current ElevanLabs backend and frontend code. Covers actual Home, About Us, Contact, Google Sheets, MySQL, Vue, NodeJS behavior, plus planned chatbot, ChatGPT API, and Fonnte API development without changing code.
---

# Website Environment Concept — Code Aligned Skill

## Purpose

This skill documents the actual current website behavior based on the backend and frontend code.

It also separates future development items clearly, so the documentation does not claim that unfinished modules already exist.

## Current Implemented Scope

Current code supports:

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

Current code does not yet include:

- Floating chatbot
- ChatGPT / OpenAI API integration
- Fonnte WhatsApp integration
- ChatSession and ChatMessage models
- Property database model
- Dedicated service files for OpenAI, Fonnte, Google Sheets, validation, and session
- Frontend components such as `FloatingChatbot.vue`, `PortfolioCard.vue`, `PropertyFilter.vue`
- Frontend services such as `contactApi.js`, `chatbotApi.js`, `aboutApi.js`

## Documentation Rule

Every `.md` file must clearly distinguish:

```text
Current implementation
Planned development
Recommended improvement
```

This avoids mismatch between documentation and actual code behavior.

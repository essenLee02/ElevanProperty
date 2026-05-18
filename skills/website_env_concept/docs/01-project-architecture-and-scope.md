# 01 — Project Architecture and Scope

## Project Name

```text
Elevan_Property
```

## Project Purpose

Elevan_Property is a property website for:

- property portfolio display;
- buying property inquiries;
- selling property inquiries;
- rental property inquiries;
- AI chatbot property assistance;
- WhatsApp follow-up using Fonnte;
- Contact Form lead capture;
- Google Sheets lead backup.

## Main Folder Structure

```text
Elevan_Property/
├─ backend/
├─ frontend/
└─ skills/
```

## Backend Responsibility

The backend handles:

- Express API routes;
- MySQL connection through Sequelize;
- Sequelize models;
- Contact Form submission;
- Google Sheets integration;
- Fonnte WhatsApp integration;
- ChatGPT / OpenAI integration;
- Claude / Anthropic integration;
- Private Agent fallback;
- chatbot sessions and message history;
- JSON property catalog filtering;
- response skill `.md` loading;
- logging and validation.

## Frontend Responsibility

The frontend handles:

- Vue application rendering;
- Home page;
- About Us portfolio page;
- Contact Form page;
- Floating Chatbot;
- property cards and filters;
- Axios API communication;
- frontend `.env` port/API settings;
- safe rendering of chatbot bold markdown.

## Skills Responsibility

```text
skills/website_env_concept
skills/chat_gpt_responds
skills/claude_responds
```

`website_env_concept` documents backend/frontend development.

`chat_gpt_responds` controls ChatGPT property response behavior.

`claude_responds` controls Claude property response behavior.

## Main Runtime Flow

```text
User opens frontend
→ Vue page loads
→ Axios calls backend API
→ backend reads .env
→ backend uses database / JSON catalog / external services
→ chatbot routes messages to ChatGPT, Claude, or Private Agent
→ response returns to frontend
```

## Scope Boundary

This skill should only describe Elevan_Property.

Do not mix unrelated website environment concepts or generic templates that are not used by this project.

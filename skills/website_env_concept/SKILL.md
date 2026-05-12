---
name: website-environment-code-integration-skill
description: Consolidated website environment and code development skill for the ElevanLabs property website. Covers VueJS frontend, NodeJS backend, database, Google API, Fonnte API, ChatGPT API, JSON property catalog, chatbot cookie/session, and testing/deployment.
---

# Website Environment and Code Integration Skill

## Purpose

This skill documents how the property website should be developed and maintained.

It covers:

- frontend modules;
- backend modules;
- database and models;
- JSON property catalog;
- About Us portfolio from JSON;
- Contact Form;
- chatbot workflow;
- chatbot cookie/session TTL;
- Google Sheets API;
- Fonnte WhatsApp API;
- ChatGPT / OpenAI API;
- frontend rendering rules;
- testing and troubleshooting.

## Core Architecture

```text
VueJS frontend
→ NodeJS / Express backend
→ MySQL / Sequelize
→ Google Sheets API
→ ChatGPT / OpenAI API
→ Fonnte WhatsApp API
```

## Development Principles

1. Frontend handles UI only.
2. Backend handles private APIs, database, external integrations, and security.
3. Secrets must never be exposed in frontend.
4. About Us portfolio data should come from `frontend/public/json_data/indonesia_property_36_provinces_flat.json`.
5. Chatbot property recommendations should be based on JSON property data.
6. Chatbot identity requires name, phone, and location.
7. Chatbot cookie/session TTL is controlled from backend `.env`.
8. ChatGPT should receive filtered property context, user identity, location, and relevant conversation history.
9. Documentation must avoid duplicated or looping instructions.

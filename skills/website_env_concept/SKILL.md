---
name: elevan-property-website-environment-skill-module-split
description: Module-based website environment and development skill for the Elevan_Property project. It separates Home, About Us, Contact, and Chatbot skills while keeping shared backend, frontend, environment, API, database, and troubleshooting guidance clean and non-repetitive.
version: elevan-property-module-split-v1
---

# Elevan_Property Website Environment Skill

## Purpose

This skill documents the **Elevan_Property** website environment only.

It supports backend and frontend development for the actual project structure:

```text
Elevan_Property/
├─ backend/
├─ frontend/
└─ skills/
```

## Core Stack

```text
Backend: Node.js, Express, Sequelize, MySQL
Frontend: Vue 3, Vite, Axios, Vue Router, vue3-toastify
External APIs: OpenAI / ChatGPT, Anthropic / Claude, Fonnte, Google Sheets
Property Catalog: frontend/public/json_data/indonesia_property_36_provinces_flat.json
Response Skills: skills/chat_gpt_responds and skills/claude_responds
```

## Main Architecture

```text
Vue frontend
→ Axios API services
→ Express backend
→ MySQL / Sequelize
→ JSON property catalog
→ ChatGPT / Claude / Private Agent
→ Fonnte WhatsApp
→ Google Sheets
```

## Module-Based Rule

The project skill should be organized by module:

```text
Home
About Us
Contact
Chatbot
```

Each module should clearly describe:

- frontend files;
- backend routes/controllers/services;
- data source;
- expected behavior;
- validation or business rule;
- troubleshooting focus.

## Development Principles

1. Backend uses `backend/.env`.
2. Frontend uses `frontend/.env`.
3. Browser-exposed frontend variables must start with `VITE_`.
4. Secrets must stay only in `backend/.env`.
5. About Us portfolio must use the JSON property catalog.
6. Contact Form must be public and not require user login/JWT.
7. Chatbot recommendations must use backend catalog context.
8. ChatGPT must load response skills from `skills/chat_gpt_responds`.
9. Claude must load response skills from `skills/claude_responds`.
10. Private Agent should use both ChatGPT and Claude response skill rules.
11. Google Sheets sync errors must not block database contact submission.
12. Fonnte WhatsApp errors must be logged clearly without exposing tokens.
13. Backend and frontend dependencies must be installed separately.
14. Keep skill files clean, module-based, non-repetitive, and focused on actual Elevan_Property code.

---
name: elevan-property-system
description: Elevan Property platform documentation — Node.js+Express backend, Vue 3 frontend, MySQL, AI chatbot (ChatGPT→Claude→Private), Fonnte WhatsApp, JWT auth.
version: 4.0
status: production
---

# Elevan Property — System Documentation

## Document Index

```
docs/
├── 01-system-overview-and-architecture.md    ← Stack, data flows, directory structure
├── 02-project-configuration-and-setup.md     ← .env variables, dependencies, quick start
├── 03-database-design-and-models.md          ← MySQL tables, Sequelize models
├── 04-backend-api-and-services.md            ← All API routes, key services
├── 05-ai-integration-system.md               ← ChatGPT→Claude→Private fallback chain
├── 06-skill-loader-and-prompts.md            ← Skill file system, prompt loading
├── 07-frontend-architecture-and-setup.md     ← Vue 3 structure, router, auth
├── 08-module-home.md                         ← HomeView.vue
├── 09-module-about-us.md                     ← AboutView.vue
├── 10-module-contact.md                      ← Contact form flow, rate limiting
├── 11-module-chatbot.md                      ← FloatingChatbot.vue, session management
└── 12-external-integrations-and-deployment.md ← Fonnte, Google Sheets, Rumah123, deploy
```

## Quick Reference

| Question | Document |
|---|---|
| How does the AI fallback work? | 05 |
| What are all the API routes? | 04 |
| What tables are in the DB? | 03 |
| How is the chatbot session managed? | 11 |
| How does the contact form flow? | 10 |
| How to configure .env? | 02 |
| How does JWT auth work? | 07 + 04 |
| How does Fonnte WhatsApp work? | 12 |
| How does OOP controller pattern work? | 04 |

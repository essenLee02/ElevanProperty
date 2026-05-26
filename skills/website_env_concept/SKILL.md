---
name: elevan-property-system
description: Elevan Property platform — Node.js+Express backend, Vue 3 frontend, MySQL, AI chatbot (ChatGPT→Claude→Private), Fonnte (contact form), WATI (agent chat), JWT auth, Rumah123 via Apify.
version: 5.1
status: production
updated: 2026-05-26
---

# Elevan Property — System Documentation

## Skill Files (Feature Summaries)

Quick-reference files covering each major feature area:

```
docs/
├── A-auth-and-agents.md              ← Login, Register, Profile, JWT, 6 agents
├── B-wati-whatsapp-integration.md    ← WATI setup, watiChatController, agent-customer chat
├── C-website-modules.md              ← Home, About, Contact, Chatbot, Rumah123
└── D-ai-and-external-integrations.md ← ChatGPT, Claude, Private Agent, Fonnte, Google, Apify, NGROK
```

## Skill Files (Detailed Technical Reference)

In-depth implementation docs:

```
docs/
├── 01-system-overview-and-architecture.md
├── 02-project-configuration-and-setup.md
├── 03-database-design-and-models.md
├── 04-backend-api-and-services.md
├── 05-ai-integration-system.md
├── 06-skill-loader-and-prompts.md
├── 07-frontend-architecture-and-setup.md
├── 08-module-home.md
├── 09-module-about-us.md
├── 10-module-contact.md
├── 11-module-chatbot.md
└── 12-external-integrations-and-deployment.md
```

## Quick Reference

| Question | File |
|---|---|
| Login / register / JWT / agent list | `docs/A-auth-and-agents.md` |
| WATI setup, watiController, terminal format | `docs/B-wati-whatsapp-integration.md` |
| Contact form (Fonnte), Chatbot, Rumah123 | `docs/C-website-modules.md` |
| ChatGPT / Claude / Private / all .env | `docs/D-ai-and-external-integrations.md` |
| All API routes | `docs/04-backend-api-and-services.md` |
| Database tables & models | `docs/03-database-design-and-models.md` |
| Frontend Vue 3 structure | `docs/07-frontend-architecture-and-setup.md` |

## System Status (26 May 2026)

| Feature | Status |
|---|---|
| Login / Register / Profile | ✅ Live |
| Website Chatbot (FloatingChatbot) | ✅ Live |
| Contact Form (Fonnte + Google Sheets) | ✅ Live |
| Rumah123 via Apify | ✅ Live (quota-limited) |
| WATI watiChatController code | ✅ Ready |
| WATI 6 agents in database | ✅ Done |
| WATI webhook endpoint | ✅ Ready |
| WATI WhatsApp Business channel | ❌ Not connected yet |
| WATI real messages in terminal | ❌ Blocked by above |
| Claude API key | ⚠️ Placeholder — needs real key |

## Service Scope

| Service | Used For | NOT Used For |
|---|---|---|
| **Fonnte** | Contact form WA send + webhook | watiChatController |
| **WATI** | Agent-customer chat capture | Contact form |
| **ChatGPT** | Primary AI: chatbot / contact / WATI | — |
| **Claude** | Fallback AI | — |
| **Google Sheets** | Contact form submission backup | — |
| **Apify** | Live Rumah123 property data | — |
| **NGROK** | Dev tunnel for WATI webhook | Production |

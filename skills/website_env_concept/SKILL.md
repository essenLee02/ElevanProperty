---
name: elevan-property-system
description: Elevan Property platform — Node.js+Express backend, Vue 3 frontend, MySQL, AI chatbot (ChatGPT→Claude→Private), Fonnte (contact form), WATI (agent chat), JWT auth, Rumah123 via Apify.
version: 6.0
status: production
updated: 2026-05-26
---

# Elevan Property — System Documentation

## Skill Files (`docs/`)

```
docs/
├── 01-system-overview-and-architecture.md   ← Stack, directory, all data flows
├── 02-project-configuration-and-setup.md    ← Installation, dependencies, complete .env
├── 03-database-design-and-models.md         ← All tables, Sequelize models
├── 04-auth-and-agents.md                    ← JWT, login/register, 6 agents, phone normalization
├── 05-backend-api-and-services.md           ← All API routes, controllers, key services
├── 06-ai-system-and-skill-loader.md         ← AI fallback chain, ChatGPT, Claude, Private, skill files
├── 07-frontend-and-modules.md               ← Vue 3, router, auth guards, all page modules
├── 08-wati-whatsapp-integration.md          ← WATI arch, watiChatController, NGROK, curl tests
├── 09-fonnte-and-contact-form.md            ← Fonnte service, contact form flow (Fonnte = contact ONLY)
├── 10-google-sheets-integration.md          ← Google Sheets setup, appendContactRow, non-blocking
├── 11-rumah123-and-apify.md                 ← Live property data, Apify config, static JSON fallback
└── 12-deployment-and-troubleshooting.md     ← Deploy checklist, NGROK, start commands, common issues
```

## Quick Reference

| Question | File |
|---|---|
| Stack, architecture, data flows | `01-system-overview-and-architecture.md` |
| Environment variables (.env) | `02-project-configuration-and-setup.md` |
| Database tables & models | `03-database-design-and-models.md` |
| Login / register / JWT / 6 agents | `04-auth-and-agents.md` |
| All API routes & controllers | `05-backend-api-and-services.md` |
| ChatGPT / Claude / Private Agent / skill files | `06-ai-system-and-skill-loader.md` |
| Vue 3 frontend, router, page modules | `07-frontend-and-modules.md` |
| WATI webhook, watiChatController, curl tests | `08-wati-whatsapp-integration.md` |
| Fonnte, contact form flow | `09-fonnte-and-contact-form.md` |
| Google Sheets setup & integration | `10-google-sheets-integration.md` |
| Rumah123 live property data | `11-rumah123-and-apify.md` |
| Deployment, NGROK, troubleshooting | `12-deployment-and-troubleshooting.md` |

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

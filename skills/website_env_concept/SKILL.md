---
name: elevan-property-system
description: Elevan Property platform — Node.js+Express backend, Vue 3 frontend, MySQL, AI chatbot (ChatGPT→Claude→Private), Fonnte multi-agent WA, 360dialog WA, WATI WA, JWT auth, Rumah123 via Apify, property keyword filter.
version: 7.0
status: production
updated: 2026-06-03
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
│                                               (Home, About, Contact, Chatbot, Rumah123,
│                                                Login, Register, Profile)
├── 08-wati-whatsapp-integration.md          ← WATI arch, watiChatController, NGROK, curl tests
├── 09-fonnte-and-contact-form.md            ← Fonnte service, contact form + fonnteChatController
│                                               (multi-agent, property keyword filter, Rumah123 ctx)
├── 10-google-sheets-integration.md          ← Google Sheets setup, appendContactRow, non-blocking
├── 11-rumah123-and-apify.md                 ← Live property data, Apify config, static JSON fallback
│                                               + WhatsApp property context (getWhatsappPropertyContext)
├── 12-deployment-and-troubleshooting.md     ← Deploy checklist, NGROK, start commands, common issues
└── 13-whatsapp-terminal-multiagent.md       ← Semua 3 WA controller, MASSEGE_TERMINAL, keyword filter,
                                                360dialog sandbox, property context, routing POST /
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
| Vue 3 frontend, all page modules (Home/About/Contact/Chatbot/Rumah123/Auth/Profile) | `07-frontend-and-modules.md` |
| WATI webhook, watiChatController, keyword filter | `08-wati-whatsapp-integration.md` |
| Fonnte, contact form, fonnteChatController, multi-agent | `09-fonnte-and-contact-form.md` |
| Google Sheets setup & integration | `10-google-sheets-integration.md` |
| Rumah123 live property data + WhatsApp context | `11-rumah123-and-apify.md` |
| Deployment, NGROK, troubleshooting | `12-deployment-and-troubleshooting.md` |
| **Fonnte + WATI + 360dialog terminal, MASSEGE_TERMINAL, keyword filter** | **`13-whatsapp-terminal-multiagent.md`** |

## System Status (3 Juni 2026)

| Feature | Status |
|---|---|
| **Frontend Pages** | |
| Home (HomeView) | ✅ Live |
| About (AboutView + property JSON load) | ✅ Live |
| Contact Form (Fonnte + Google Sheets) | ✅ Live |
| Login / Register | ✅ Live |
| Profile (auth-protected) | ✅ Live |
| Rumah123 live search (Apify) | ✅ Live (quota-limited) |
| **Chatbot** | |
| Website Chatbot (FloatingChatbot.vue) | ✅ Live |
| ChatGPT reply | ⚠️ Quota exhausted — fallback aktif |
| Claude reply | ⚠️ Key belum diisi |
| Private Agent reply | ✅ Always works (fallback) |
| Rumah123 context di chatbot | ✅ Live |
| **WhatsApp Multi-Agent** | |
| Fonnte fonnteChatController | ✅ End-to-end working |
| Fonnte LEO FELIX (0881036588874) | ✅ Connected |
| Fonnte NIGEL (082233556796) | ⚠️ Token ada, device disconnected |
| Fonnte 4 agent lainnya | ❌ Token belum diisi |
| WATI watiChatController | ✅ Code ready |
| WATI WA channel | ❌ Belum connect |
| 360dialog dialogChatController | ✅ Code ready (sandbox) |
| 360dialog agent tokens di DB | ❌ Perlu isi dialog360_token |
| Property keyword filter | ✅ Live (semua 3 controller) |
| Property context (Rumah123→JSON) | ✅ Live (semua 3 controller) |
| MASSEGE_TERMINAL routing | ✅ Live |
| **Infrastructure** | |
| NGROK tunnel → port 5005 | ✅ Active |
| POST / root webhook routing | ✅ Active (via MASSEGE_TERMINAL) |
| JSON data dari backend/asset/ | ✅ Migrasi selesai |
| Claude API key | ⚠️ Placeholder — needs real key |

## Service Scope

| Service | Digunakan Untuk | BUKAN Untuk |
|---|---|---|
| **Fonnte** | Contact form WA send + fonnteChatController multi-agent | watiChatController |
| **WATI** | watiChatController agent chat | Contact form |
| **360dialog** | dialogChatController agent chat (sandbox/prod) | Contact form |
| **ChatGPT** | Primary AI: chatbot / WA controllers | — |
| **Claude** | Fallback AI | — |
| **Private Agent** | Final fallback (selalu berhasil) | — |
| **Google Sheets** | Contact form submission backup | — |
| **Apify/Rumah123** | Live property data (chatbot + WA controllers) | — |
| **NGROK** | Dev tunnel untuk semua WA webhook | Production |
| **MASSEGE_TERMINAL** | Switch controller mana yang log ke terminal | — |

## Environment Variables Baru (Juni 2026)

```env
# Platform aktif di terminal (FONNTE | DIALOG | WATI, bisa koma-separated)
MASSEGE_TERMINAL=FONNTE

# 360dialog Sandbox
DIALOG360_SANDBOX=true
DIALOG360_WEBHOOK_BASE_URL=https://spotter-dragging-sporting.ngrok-free.dev

# JSON data source (pindah ke backend)
# File: backend/asset/json_data/indonesia_property_36_provinces_flat.json
# Frontend fetch via Vite proxy → backend /json_data/ static middleware
```

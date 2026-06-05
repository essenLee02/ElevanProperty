---
name: elevan-property-system
description: Elevan Property — Node.js+Express backend, Vue 3 frontend, MySQL, AI chatbot (ChatGPT→Claude→Private Agent), WhatsApp multi-platform (Fonnte/WATI/360dialog), JWT auth, Rumah123 via Apify, property keyword filter, context-aware continuation, ResponseBuilderWhatsApp.
version: 8.0
status: production
updated: 2026-06-05
---

# Elevan Property — System Documentation

## Skill Files (`docs/`)

```
docs/
├── 01-system-overview-and-architecture.md   ← Stack, directory, all data flows
├── 02-project-configuration-and-setup.md    ← Installation, dependencies, complete .env
├── 03-database-design-and-models.md         ← All tables, Sequelize models
├── 04-auth-and-agents.md                    ← JWT, login/register, 6 agents, phone normalization,
│                                               fonnte_token, dialog360_token per agent
├── 05-backend-api-and-services.md           ← All API routes, controllers, key services
├── 06-ai-system-and-skill-loader.md         ← AI fallback chain, ChatGPT, Claude, Private Agent,
│                                               whatsappAIService, ResponseBuilderWhatsApp, skill files
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
├── 13-whatsapp-terminal-multiagent.md       ← 3 WA controllers, MASSEGE_TERMINAL, keyword filter,
│                                               isPropertyContextContinuation(), context-aware flow,
│                                               360dialog sandbox, property context, routing POST /
└── 14-private-agent-whatsapp-format.md      ← NEW: ResponseBuilderWhatsApp, generateResponseFor
                                                TerminalMassege(), WhatsApp format vs web format,
                                                agent name footer, image markdown, dual functions
```

## Quick Reference

| Question | File |
|---|---|
| Stack, architecture, data flows | `01-system-overview-and-architecture.md` |
| Environment variables (.env) | `02-project-configuration-and-setup.md` |
| Database tables & models | `03-database-design-and-models.md` |
| Login / register / JWT / 6 agents / tokens per agent | `04-auth-and-agents.md` |
| All API routes & controllers | `05-backend-api-and-services.md` |
| ChatGPT / Claude / Private Agent / whatsappAIService / skill files | `06-ai-system-and-skill-loader.md` |
| Vue 3 frontend — Home / About / Contact / Chatbot / Rumah123 / Auth / Profile | `07-frontend-and-modules.md` |
| WATI webhook, watiChatController, keyword filter | `08-wati-whatsapp-integration.md` |
| Fonnte, contact form, fonnteChatController, multi-agent | `09-fonnte-and-contact-form.md` |
| Google Sheets setup & integration | `10-google-sheets-integration.md` |
| Rumah123 live property data + WhatsApp context | `11-rumah123-and-apify.md` |
| Deployment, NGROK, troubleshooting | `12-deployment-and-troubleshooting.md` |
| Fonnte + WATI + 360dialog terminal, MASSEGE_TERMINAL, context continuation | `13-whatsapp-terminal-multiagent.md` |
| **ResponseBuilderWhatsApp, generateResponseForTerminalMassege, WhatsApp format** | **`14-private-agent-whatsapp-format.md`** |

## System Status (5 Juni 2026)

| Feature | Status |
|---|---|
| **Frontend Pages** | |
| Home (HomeView) | ✅ Live |
| About (AboutView) | ✅ Live |
| Contact Form (Fonnte + Google Sheets) | ✅ Live |
| Login / Register | ✅ Live |
| Profile (auth-protected, Fonnte API field) | ✅ Live |
| Rumah123 live search (Apify) | ✅ Live (quota-limited) |
| **Chatbot** | |
| Website Chatbot (FloatingChatbot.vue) | ✅ Live |
| ChatGPT reply | ⚠️ Quota exhausted — fallback aktif |
| Claude reply | ⚠️ Key belum diisi → placeholder |
| Private Agent (generateResponseForChatbot) | ✅ Always works (web format) |
| Private Agent (generateResponseForTerminalMassege) | ✅ Always works (WhatsApp format + images) |
| Rumah123 context di chatbot + WhatsApp | ✅ Live |
| **WhatsApp Multi-Agent** | |
| Fonnte fonnteChatController | ✅ End-to-end working |
| Fonnte LEO FELIX (0881036588874) | ✅ Connected |
| WATI watiChatController | ✅ Code ready |
| WATI WA channel | ❌ Belum connect |
| 360dialog dialogChatController | ✅ Code ready (sandbox) |
| 360dialog agent tokens di DB | ❌ Perlu isi dialog360_token |
| Property keyword filter (hasPropertyKeyword) | ✅ Live (semua 3 controller) |
| Context continuation (isPropertyContextContinuation) | ✅ NEW — semua 3 controller |
| Property context (Rumah123→JSON) | ✅ Live (semua 3 controller) |
| MASSEGE_TERMINAL routing | ✅ Live |
| **AI Service** | |
| whatsappAIService (unified) | ✅ Live — ChatGPT→Claude→Private chain |
| ResponseBuilderWhatsApp | ✅ NEW — WhatsApp format dengan images + agent footer |
| Dual Private Agent functions | ✅ NEW — chatbot vs terminal message |
| **Infrastructure** | |
| NGROK tunnel → port 5005 | ✅ Active |
| POST / root webhook routing | ✅ Active (via MASSEGE_TERMINAL) |
| JSON data dari backend/asset/ | ✅ Migrasi selesai |
| logController (class-style, insertLog) | ✅ Refactored |

## Service Scope

| Service | Digunakan Untuk | BUKAN Untuk |
|---|---|---|
| **Fonnte** | Contact form WA send + fonnteChatController multi-agent | watiChatController |
| **WATI** | watiChatController agent chat | Contact form |
| **360dialog** | dialogChatController agent chat (sandbox/prod) | Contact form |
| **ChatGPT** | Primary AI: chatbot / WA controllers | — |
| **Claude** | Fallback AI | — |
| **Private Agent (Chatbot)** | Final fallback untuk website chatbot | WhatsApp |
| **Private Agent (WA)** | Final fallback untuk WhatsApp terminal | Website chatbot |
| **Google Sheets** | Contact form submission backup | — |
| **Apify/Rumah123** | Live property data (chatbot + WA controllers) | — |
| **NGROK** | Dev tunnel untuk semua WA webhook | Production |
| **MASSEGE_TERMINAL** | Switch controller mana yang log ke terminal | — |

## Key Environment Variables

```env
# ── AI Providers ──────────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
AI_PRIMARY_PROVIDER=chatgpt
ENABLE_CLAUDE_FALLBACK=true
ANTHROPIC_API_KEY=sk-ant-...       # ← WAJIB diisi untuk Claude aktif
CLAUDE_MODEL=claude-haiku-4-5-20251001
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true

# ── WhatsApp ──────────────────────────────────────────────────────────────────
FONNTE_TOKEN=...                   # Token default (per-agent di DB: users.fonnte_token)
WATI_API_TOKEN=...
WATI_API_URL=https://live.wati.io/[account_id]/api/v1
DIALOG360_SANDBOX=true
DIALOG360_WEBHOOK_BASE_URL=https://xxxx.ngrok-free.app

# ── Terminal Control ──────────────────────────────────────────────────────────
MASSEGE_TERMINAL=FONNTE            # FONNTE | WATI | DIALOG | comma-separated

# ── Property Data ─────────────────────────────────────────────────────────────
APIFY_API_TOKEN=apify_api_...
RUMAH123_DATA=ON                   # ON = live Rumah123, OFF = flat JSON only

# ── Chatbot ───────────────────────────────────────────────────────────────────
CHATBOT_COOKIE_TTL_MINUTES=90
SKILL_MAX_WEBSITE_CHARACTERS=12000
SKILL_MAX_RESPONSE_CHARACTERS=22000
SKILL_MAX_PROJECT_CHARACTERS=36000

# ── Auth ──────────────────────────────────────────────────────────────────────
ACCESS_TOKEN_SECRET=...
REFRESH_TOKEN_SECRET=...
ACCESS_TOKEN_EXPIRY=5m
REFRESH_TOKEN_EXPIRY=1d
COOKIE_REFRESH_TOKEN=Elevan_Refresh_Token
BCRYPT_SALT_ROUNDS=10

# ── Database ──────────────────────────────────────────────────────────────────
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_property
DB_DIALECT=mysql
```

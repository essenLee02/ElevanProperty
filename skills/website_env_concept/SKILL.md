---
name: elevan-property-system
description: Elevan Property — Node.js+Express backend, Vue 3 frontend, MySQL, AI chatbot (ChatGPT→Claude→Private Agent), WhatsApp multi-agent (Fonnte/Kirimi/TimelinesAI), JWT auth, Rumah123 via Apify, property keyword filter + context-aware continuation, Q1–Q12 qualification, ResponseBuilderWhatsApp.
version: 9.0
status: production
updated: 2026-06-23
---

# Elevan Property — System Documentation

Dokumentasi arsitektur website + environment + integrasi. Untuk konteks 1-file
(upload sekali), pakai `WEBSITE_ENV_CONCEPT_BRIEF.txt` di root skill ini.

WhatsApp terminal platforms aktif: **Fonnte, Kirimi, TimelinesAI**.

## Doc Files (`docs/`) — urut 01–15

```
00-NAVIGATION.md                              ← indeks + jalur baca
01-system-overview-and-architecture.md        ← stack, struktur, data flow, ENV inti
02-project-configuration-and-setup.md          ← instalasi, .env lengkap, init DB
03-database-design-and-models.md               ← skema tabel + model Sequelize
04-auth-and-agents.md                          ← JWT, login/register, token per-agent
05-backend-api-and-services.md                 ← semua route, controller, service, util
06-ai-integration-system.md                    ← ChatGPT→Claude→Private, whatsappAIService, skill loader
07-frontend-and-modules.md                     ← Vue 3, router/guard, modul halaman, Facility, vendor global
08-fonnte-whatsapp-integration.md              ← Fonnte multi-agent (implementasi)
09-whatsapp-terminal-multiagent.md             ← terminal: Fonnte + Kirimi + TimelinesAI, MASSEGE_TERMINAL
10-qualification-flow-and-ai-prompt-builder.md ← Q1–Q12, state extractor, prompt builder
11-private-agent-whatsapp-format.md            ← ResponseBuilderWhatsApp, format WA, footer agent
12-rumah123-and-apify.md                       ← data properti live + fallback JSON
13-google-sheets-integration.md                ← Google Sheets logging contact form
14-external-integrations-s3-email.md           ← S3, email, integrasi lain
15-deployment-and-troubleshooting.md           ← deploy, NGROK, troubleshoot
```

## Quick Reference

| Pertanyaan | File |
|---|---|
| Stack, arsitektur, data flow | `01-system-overview-and-architecture.md` |
| Environment variables (.env) | `02-project-configuration-and-setup.md` |
| Tabel & model database | `03-database-design-and-models.md` |
| Login / JWT / token per-agent | `04-auth-and-agents.md` |
| Semua route & controller | `05-backend-api-and-services.md` |
| ChatGPT / Claude / Private / whatsappAIService / skill | `06-ai-integration-system.md` |
| Frontend Vue 3 + modul + Facility | `07-frontend-and-modules.md` |
| Fonnte multi-agent | `08-fonnte-whatsapp-integration.md` |
| Terminal multi-agent (Fonnte/Kirimi/TimelinesAI), MASSEGE_TERMINAL | `09-whatsapp-terminal-multiagent.md` |
| Q1–Q12 qualification | `10-qualification-flow-and-ai-prompt-builder.md` |
| Format balasan WhatsApp (ResponseBuilderWhatsApp) | `11-private-agent-whatsapp-format.md` |
| Rumah123 / Apify | `12-rumah123-and-apify.md` |
| Google Sheets | `13-google-sheets-integration.md` |
| S3 / Email / lainnya | `14-external-integrations-s3-email.md` |
| Deployment & troubleshooting | `15-deployment-and-troubleshooting.md` |

## Service Scope

| Service | Untuk |
|---|---|
| Fonnte | Kirim WA contact form + fonnteChatController multi-agent |
| Kirimi | kirimiChatController multi-agent (device_id per-agent, shared account) |
| TimelinesAI | timelinesAIChatController multi-agent |
| ChatGPT | AI primary (chatbot / WA) |
| Claude | AI fallback |
| Private Agent | Fallback terjamin (web: chatbot; WA: terminal message) |
| Google Sheets | Backup submission contact form |
| Apify/Rumah123 | Data properti live |
| MASSEGE_TERMINAL | Pilih platform mana yang log ke terminal (FONNTE,KIRIMI,TIMELINESAI) |

## Key Environment Variables

```env
# AI
AI_PRIMARY_PROVIDER=private        # chatgpt | claude | private
ENABLE_CLAUDE_FALLBACK=true        ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
OPENAI_API_KEY / OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_API_KEY / CLAUDE_MODEL=claude-haiku-4-5
RESPOND_CATALOG_RUN=OFF            # OFF = Q1–Q12 + summary ; ON = katalog

# WhatsApp (per-agent token di tabel users untuk Fonnte; per-device untuk Kirimi)
FONNTE_TOKEN  TIMELINESAI_API_KEY
KIRIMI_USER_CODE / KIRIMI_SECRET / users.kirimi_device_id (per-agent)
MASSEGE_TERMINAL=FONNTE,KIRIMI,TIMELINESAI

# Data properti
RUMAH123_DATA=OFF   APIFY_API_TOKEN

# Auth & DB
ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET (RAHASIA)
ACCESS_TOKEN_EXPIRY=5m / REFRESH_TOKEN_EXPIRY=1d / BCRYPT_SALT_ROUNDS=10
DB_HOST / DB_USER / DB_PASSWORD / DB_NAME=db_property / DB_DIALECT=mysql
```

> RAHASIA — jangan echo/commit: OPENAI/ANTHROPIC/FONNTE/KIRIMI/TIMELINESAI keys,
> APIFY_API_TOKEN, ACCESS/REFRESH_TOKEN_SECRET.

---
name: elevan-property-system
description: Elevan Property — Node.js+Express backend, Vue 3 frontend, MySQL (Sequelize v6), AI chatbot multi-provider (QWEN/Claude/ChatGPT/DeepSeek → Private Agent), WhatsApp multi-agent (Fonnte/Kirimi/TimelinesAI, sinkron fromMe/group/dedup DB/cookie-timer), JWT auth, backend-driven agent-scoped property catalog (Property/PropertyFacility/PropertyLocation), fallback fasilitas standar + harga wajar, master data 6-modul (Country/Province/City/Location/Facility/Property) dengan GeneralController + ConfirmModal reusable, Rumah123 via Apify, Q1–Q12 qualification, ngrok auto-start. Panggil skill ini untuk merekonstruksi atau mengembangkan modul/API/environment/database/framework/komponen/security yang SAMA dengan kondisi project saat ini.
version: 11.0
status: production
updated: 2026-07-07
---

# Elevan Property — System Documentation

Dokumentasi arsitektur website + environment + integrasi — cukup lengkap untuk
merekonstruksi atau mengembangkan ulang sistem ini (module, API, environment,
database, framework, component, security, code). Untuk konteks 1-file
(upload sekali), pakai `WEBSITE_ENV_CONCEPT_BRIEF.txt` di root skill ini —
namun untuk detail teknis akurat & terbaru, RUJUK LANGSUNG ke `docs/*.md`
(file brief bisa tertinggal versi).

WhatsApp terminal platforms aktif: **Fonnte, Kirimi, TimelinesAI** — pipeline
identik (fromMe guard, filter grup, dedup 2-layer messageId+DB, cookie
response timer debounce). Master data: **Country, Province, City, Location,
Facility, Property** — 6 modul CRUD pola seragam via `GeneralController` +
`ConfirmModal.vue`.

## Doc Files (`docs/`) — urut 00–17

```
00-NAVIGATION.md                              ← indeks + jalur baca
01-system-overview-and-architecture.md        ← stack, struktur, data flow, ENV inti
02-project-configuration-and-setup.md          ← instalasi, .env lengkap, init DB
03-database-design-and-models.md               ← skema tabel + model Sequelize (15 model)
04-auth-and-agents.md                          ← JWT, login/register, token per-agent
05-backend-api-and-services.md                 ← semua route, controller, service, util
06-ai-integration-system.md                    ← QWEN/Claude/ChatGPT/DeepSeek→Private, whatsappAIService,
                                                  katalog per-agent + fallback fasilitas standar, skill loader
07-frontend-and-modules.md                     ← Vue 3, router/guard, 6 modul master, ConfirmModal, vendor global
08-fonnte-whatsapp-integration.md              ← Fonnte multi-agent (implementasi)
09-whatsapp-terminal-multiagent.md             ← terminal: Fonnte + Kirimi + TimelinesAI, dedup DB,
                                                  fromMe/group filter, cookie response timer, MASSEGE_TERMINAL
10-qualification-flow-and-ai-prompt-builder.md ← Q1–Q12, state extractor, prompt builder
11-private-agent-whatsapp-format.md            ← ResponseBuilderWhatsApp, format WA, footer agent
12-rumah123-and-apify.md                       ← data properti backend-driven (DB) + Apify live (digabung)
13-google-sheets-integration.md                ← Google Sheets logging contact form
14-external-integrations-s3-email.md           ← S3, email, integrasi lain
15-deployment-and-troubleshooting.md           ← deploy, NGROK, troubleshoot
16-facility-city-ai-context.md                 ← vocabulary injection (facility/city names) ke AI prompt
17-recent-updates-and-reconstruction-checklist.md ← BARU: konsolidasi semua perubahan sesi Juli 2026
                                                  (GeneralController, ConfirmModal, katalog per-agent,
                                                  fallback fasilitas standar, cookie timer, sinkronisasi
                                                  terminal) + checklist rekonstruksi lengkap
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
| Facility/City vocabulary context (AI) | `16-facility-city-ai-context.md` |
| Ringkasan perubahan terbaru + checklist rekonstruksi | `17-recent-updates-and-reconstruction-checklist.md` |

## Service Scope

| Service | Untuk |
|---|---|
| Fonnte | Kirim WA contact form + fonnteChatController multi-agent |
| Kirimi | kirimiChatController multi-agent (device_id per-agent, shared account) |
| TimelinesAI | timelinesAIChatController multi-agent |
| QWEN / Claude / ChatGPT / DeepSeek | AI primary (dipilih `AI_PRIMARY_PROVIDER`, satu saja) |
| Private Agent | Fallback terjamin tiap primary (web: chatbot; WA: terminal message) |
| Google Sheets | Backup submission contact form |
| Apify/Rumah123 | Data properti live (opsional, DIGABUNG dengan katalog DB, bukan salah satu) |
| Database (Sequelize v6) | Sumber utama katalog — Property + PropertyFacility(FK Facility) + PropertyLocation(FK Location), di-scope per-agent (Property.user_id) |
| ngrok | Auto-start tunnel dev dari terminal backend (ENABLE_NGROK) |
| MESSAGE_TERMINAL | Sumber metadata `source` log AI (satu platform) |
| MASSEGE_TERMINAL | Platform mana yang log ke terminal (FONNTE,KIRIMI,TIMELINESAI) |
| Cookie response timer | Debounce pesan beruntun WhatsApp sebelum AI proses (AI_COOKIE_RESPONSE_TIMER) |

## Key Environment Variables

```env
# AI — satu primary → Private Agent (tanpa cross-AI). DILARANG hardcode nama model di kode.
AI_PRIMARY_PROVIDER=deepseek       # qwen | claude | chatgpt | deepseek | private
ENABLE_CLAUDE_FALLBACK=true        ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
OPENAI_MODEL / ANTHROPIC(CLAUDE_MODEL) / QWEN_MODEL / DEEPSEEK_MODEL  (semua dari .env)
DEEPSEEK_BASE_URL / DEEPSEEK_TEMPERATURE / DEEPSEEK_TOP_P / *_MAX_TOKENS
RESPOND_CATALOG_RUN=OFF            # OFF = brief saja ; ON = brief + katalog per-agent (Q1–Q12 SELALU sama)
AI_COOKIE_RESPONSE_TIMER=20000     # ms, debounce pesan beruntun WhatsApp sebelum diproses

# WhatsApp (fromMe guard, filter grup, dedup 2-layer messageId+DB — identik ketiganya)
FONNTE_TOKEN  TIMELINESAI_API_KEY
KIRIMI_USER_CODE / KIRIMI_SECRET / users.kirimi_device_id (per-agent)
MESSAGE_TERMINAL=KIRIMI            MASSEGE_TERMINAL=FONNTE,KIRIMI,TIMELINESAI

# Data properti (DB scoped-by-agent dulu + Rumah123 digabung, JSON extended_v3 last resort)
RUMAH123_DATA=OFF   APIFY_API_TOKEN

# ngrok / Server
ENABLE_NGROK=true                  PORT=5055   (frontend VITE_BACKEND_PORT=5055)

# Master data / Auth tambahan
PAGINATION_ROWS=8                  # default page size, semua master data list
# users.email, users.catalog_summary (ON/OFF) — kolom baru, lihat doc 03 & 04

# Auth & DB
ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET (RAHASIA)
ACCESS_TOKEN_EXPIRY=5m / REFRESH_TOKEN_EXPIRY=1d / BCRYPT_SALT_ROUNDS=10
DB_HOST / DB_USER / DB_PASSWORD / DB_NAME=db_property / DB_DIALECT=mysql
```

> RAHASIA — jangan echo/commit: OPENAI/ANTHROPIC/QWEN/DEEPSEEK/FONNTE/KIRIMI/TIMELINESAI keys,
> APIFY_API_TOKEN, ACCESS/REFRESH_TOKEN_SECRET.

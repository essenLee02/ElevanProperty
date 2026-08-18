---
name: elevan-property-system
description: Elevan Property — Node.js+Express backend, Vue 3 frontend, MySQL (Sequelize v6), AI chatbot multi-provider (QWEN/Claude/ChatGPT/DeepSeek/Kimi → Private Agent, primary saat ini Kimi kimi-k2.6), WhatsApp multi-agent (Fonnte/Kirimi/TimelinesAI, sinkron fromMe/group/dedup DB/cookie-timer), JWT auth, backend-driven agent-scoped property catalog (Property/PropertyFacility/PropertyLocation), fallback fasilitas standar 11-tipe+tier premium, master data 7-modul (Country/Province/City/Location/Facility/Property/Customer) dengan GeneralController + ConfirmModal reusable, Rumah123 via Apify, Google Places landmark live (wired ke jalur LLM) + Google Calendar viewing auto-schedule, Q1–Q14 qualification, ngrok auto-start. Panggil skill ini untuk merekonstruksi atau mengembangkan modul/API/environment/database/framework/komponen/security yang SAMA dengan kondisi project saat ini.
version: 13.0
status: production
updated: 2026-08-03
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
response timer debounce, lazy-chat normalizer). Master data: **Country,
Province, City, Location, Facility, Property, Customer** — 7 modul CRUD pola
seragam via `GeneralController` + `ConfirmModal.vue`.

⚠️ **AI_PRIMARY_PROVIDER saat ini `kimi`** (Moonshot AI, model `kimi-k2.6`) —
BUKAN `chatgpt` maupun `deepseek` seperti versi dokumen sebelumnya. 5 provider
eksternal kini tersedia: **ChatGPT, Claude, QWEN, DeepSeek, Kimi**. Selalu cek
`.env` aktual + log runtime sebelum mendiagnosis bug perilaku AI; lihat doc 06
§Plafon TPM untuk implikasi khusus gpt-4o-mini (ChatGPT).

⚠️ **Env var ChatGPT di-rename**: `OPENAI_API_KEY`/`OPENAI_MODEL`/… → **`CHAT_GPT_API_KEY`**/
**`CHAT_GPT_MODEL`**/dst. Kode sudah 100% konsisten memakai nama baru (diverifikasi
3 Agu 2026, nol sisa referensi `OPENAI_*` di backend).

⚠️ **Audit koneksi API langsung ke live endpoint (3 Agu 2026)** — hasil:
Kimi ✅ · DeepSeek ✅ (`deepseek-chat` maupun `deepseek-v4-flash` sama-sama jalan
dengan key ini) · Qwen ✅ · ChatGPT ✅ setelah `CHAT_GPT_MODEL` diperbaiki ke
`gpt-4o-mini` (nilai sebelumnya, `gpt-oss-20b`, HTTP 400 "model does not exist";
`gpt-5.6-terra-pro` yang tercantum di komentar `.env` juga tidak valid — jangan
pakai) · **Claude ❌ HTTP 401 "API key is invalid"** — `CLAUDE_API_KEY` di `.env`
perlu diganti manual oleh owner via console.anthropic.com; kode & nama env var
sudah benar, murni masalah kredensial. Dampak produksi saat ini NOL karena
primary=`kimi` (rantai fallback per-provider hanya `[primary]` → langsung
Private Agent, lihat doc 06), tapi Claude akan gagal bila dipakai lewat
`executeExternalAIFallbackChain` (primary=`private` & Private Agent error) atau
bila `AI_PRIMARY_PROVIDER` diganti ke `claude`.

## Doc Files (`docs/`) — urut 00–17

```
00-NAVIGATION.md                              ← indeks + jalur baca
01-system-overview-and-architecture.md        ← stack, struktur, data flow, ENV inti
02-project-configuration-and-setup.md          ← instalasi, .env lengkap, init DB
03-database-design-and-models.md               ← skema tabel + model Sequelize (17 model,
                                                  termasuk Customer BARU + facilities.keywords)
04-auth-and-agents.md                          ← JWT, login/register, token per-agent
05-backend-api-and-services.md                 ← semua route, controller, service, util
06-ai-integration-system.md                    ← QWEN/Claude/ChatGPT/DeepSeek/Kimi→Private (primary=kimi),
                                                  whatsappAIService, katalog per-agent + fallback fasilitas
                                                  standar, skill loader, ⚠️ plafon TPM ChatGPT, Google Places
                                                  landmark live wiring, hasil audit koneksi API (3 Agu 2026)
07-frontend-and-modules.md                     ← Vue 3, router/guard, 7 modul master (+Customer BARU),
                                                  ConfirmModal, vendor global
08-fonnte-whatsapp-integration.md              ← Fonnte multi-agent (implementasi)
09-whatsapp-terminal-multiagent.md             ← terminal: Fonnte + Kirimi + TimelinesAI, dedup DB,
                                                  fromMe/group filter, cookie response timer, MASSEGE_TERMINAL
10-qualification-flow-and-ai-prompt-builder.md ← Q1–Q14, state extractor, prompt builder,
                                                  penolakan=jawaban (anti-loop)
11-private-agent-whatsapp-format.md            ← ResponseBuilderWhatsApp, format WA, footer agent
12-rumah123-and-apify.md                       ← data properti backend-driven (DB) + Apify live (digabung)
13-google-sheets-integration.md                ← Google Sheets logging contact form
14-external-integrations-s3-email.md           ← S3, email, integrasi lain
15-deployment-and-troubleshooting.md           ← deploy, NGROK, troubleshoot
16-facility-city-ai-context.md                 ← vocabulary injection (facility/city names) ke AI prompt
17-recent-updates-and-reconstruction-checklist.md ← konsolidasi SEMUA perubahan sejak Juli 2026,
                                                  termasuk §13 update 20 Jul→31 Jul (Customer module,
                                                  skill docs 21→13, plafon TPM, Google Places/Calendar,
                                                  bug loop Q7, rewrite date/facilities/normalizer)
                                                  + checklist rekonstruksi lengkap (§16)
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
| QWEN / Claude / ChatGPT / DeepSeek / Kimi | AI primary (dipilih `AI_PRIMARY_PROVIDER`, satu saja — saat ini `kimi`). ⚠️ Claude 401 invalid key (3 Agu 2026), lihat catatan di atas |
| Private Agent | Fallback terjamin tiap primary (web: chatbot; WA: terminal message) — JALUR TERPISAH dari LLM, jangan disamakan saat debug |
| Google Sheets | Backup submission contact form |
| Google Places | Landmark live untuk contoh Q2c/Q6 — wired ke jalur LLM (BARU), saat ini DORMAN (billing Google Cloud project off) |
| Google Calendar | Auto-schedule event viewing (OAuth 2.0, BARU) — saat ini 1 langkah manual (refresh token) tersisa |
| Apify/Rumah123 | Data properti live (opsional, DIGABUNG dengan katalog DB, bukan salah satu) |
| Database (Sequelize v6) | Sumber utama katalog — Property + PropertyFacility(FK Facility) + PropertyLocation(FK Location), di-scope per-agent (Property.user_id) |
| ngrok | Auto-start tunnel dev dari terminal backend (ENABLE_NGROK) |
| MESSAGE_TERMINAL | Sumber metadata `source` log AI (satu platform) |
| MASSEGE_TERMINAL | Platform mana yang log ke terminal (FONNTE,KIRIMI,TIMELINESAI) |
| Cookie response timer | Debounce pesan beruntun WhatsApp sebelum AI proses (AI_COOKIE_RESPONSE_TIMER) |
| lazyChatNormalizer | Ekspansi singkatan SMS-speak sebelum semua detektor (giliran ini saja, BARU) |

## Key Environment Variables

```env
# AI — satu primary → Private Agent (tanpa cross-AI). DILARANG hardcode nama model di kode.
# ⛔ Untuk KELIMA provider: DILARANG auto-recharge/auto-topup saat kredit habis
# (kebijakan wajib, lihat komentar di .env tepat sebelum CHAT_GPT_API_KEY).
AI_PRIMARY_PROVIDER=kimi           # qwen | claude | chatgpt | deepseek | kimi | private  ← default saat ini
ENABLE_CLAUDE_FALLBACK=true        ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
CHAT_GPT_API_KEY / CHAT_GPT_MODEL=gpt-4o-mini   # ⚠️ BUKAN lagi OPENAI_API_KEY/OPENAI_MODEL (rename)
CLAUDE_API_KEY (alias ANTHROPIC_API_KEY) / CLAUDE_MODEL / QWEN_API_KEY / QWEN_MODEL
DEEPSEEK_API_KEY / DEEPSEEK_MODEL=deepseek-chat
KIMI_API_KEY / KIMI_MODEL=kimi-k2.6 / KIMI_BASE_URL   # ⚠️ kimi-k3 HANYA terima top_p=0.95
# ⚠️ gpt-4o-mini (ChatGPT) org TPM limit 60.000/menit — skill docs saja pakai 39–51K. Lihat doc 06.
DEEPSEEK_BASE_URL / DEEPSEEK_TEMPERATURE / DEEPSEEK_TOP_P / *_MAX_TOKENS
RESPOND_CATALOG_RUN=OFF            # OFF = brief saja ; ON = brief + katalog per-agent (Q1–Q14 SELALU sama)
AI_COOKIE_RESPONSE_TIMER=12000     # ms, debounce pesan beruntun WhatsApp sebelum diproses
AI_HISTORY_WINDOW=60               # jendela history percakapan (anti loop reset-ke-Q1)

# WhatsApp (fromMe guard, filter grup, dedup 2-layer messageId+DB — identik ketiganya)
FONNTE_TOKEN  TIMELINESAI_API_KEY
KIRIMI_USER_CODE / KIRIMI_SECRET / users.kirimi_device_id (per-agent)
MESSAGE_TERMINAL=KIRIMI            MASSEGE_TERMINAL=FONNTE,KIRIMI,TIMELINESAI

# Data properti (DB scoped-by-agent dulu + Rumah123 digabung, JSON extended_v3 last resort)
RUMAH123_DATA=OFF   APIFY_API_TOKEN

# Google Places (landmark live, BARU — wired ke jalur LLM) + Calendar (viewing auto-schedule, BARU)
GOOGLE_API_KEY                     # Places — ⚠️ saat ini REQUEST_DENIED, billing project belum di-enable
GOOGLE_PLACES_CACHE_TTL_MS=86400000
GOOGLE_OAUTH_CLIENT_JSON_PATH / GOOGLE_OAUTH_REFRESH_TOKEN   # ⚠️ REFRESH_TOKEN masih kosong
GOOGLE_CALENDAR_TIMEZONE=Asia/Jakarta

# ngrok / Server
ENABLE_NGROK=true                  APP_PORT=5055   (frontend VITE_BACKEND_PORT=5055)

# Master data / Auth tambahan
PAGINATION_ROWS=8                  # default page size, semua master data list
# users.email, users.catalog_summary (ON/OFF), customers.ai_response (per-customer) — lihat doc 03 & 04

# Auth & DB
ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET (RAHASIA)
ACCESS_TOKEN_EXPIRY=5m / REFRESH_TOKEN_EXPIRY=1d / BCRYPT_SALT_ROUNDS=10
DB_HOST / DB_USER / DB_PASSWORD / DB_NAME=db_property / DB_DIALECT=mysql
```

> RAHASIA — jangan echo/commit: OPENAI/ANTHROPIC/QWEN/DEEPSEEK/FONNTE/KIRIMI/TIMELINESAI keys,
> APIFY_API_TOKEN, GOOGLE_API_KEY, GOOGLE_OAUTH_REFRESH_TOKEN, ACCESS/REFRESH_TOKEN_SECRET.

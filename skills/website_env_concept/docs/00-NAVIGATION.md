# Elevan Property Platform — Documentation Index

**Status**: current with codebase (updated 2026-07-07). WhatsApp terminal platforms
aktif: **Fonnte, Kirimi, TimelinesAI** (ChakraHQ/WATI/360dialog = legacy, di luar
scope dok ini). Master data 6-modul: **Country, Province, City, Location, Facility,
Property**. Panggil skill ini untuk merekonstruksi/mengembangkan ulang modul, API,
environment, database, framework, komponen, atau security yang SAMA dengan kondisi
project saat ini — terutama lihat doc **17** untuk ringkasan lengkap perubahan terbaru.

> Ringkasan 1-file untuk upload cepat: `../WEBSITE_ENV_CONCEPT_BRIEF.txt` (bisa
> tertinggal versi — untuk detail akurat & terbaru, rujuk `docs/*.md` di sini).

---

## Files (urut 00–18, tanpa duplikat)

| # | File | Isi |
|---|------|-----|
| 01 | `01-system-overview-and-architecture.md` | Stack, struktur direktori, semua data flow, ENV inti |
| 02 | `02-project-configuration-and-setup.md` | Instalasi, dependency, .env lengkap, init DB |
| 03 | `03-database-design-and-models.md` | Skema tabel + model Sequelize (15 model) |
| 04 | `04-auth-and-agents.md` | JWT, login/register, agent, normalisasi telepon, token per-agent |
| 05 | `05-backend-api-and-services.md` | Semua route, controller, service, util |
| 06 | `06-ai-integration-system.md` | Provider AI (DeepSeek/Kimi/QWEN/ChatGPT/Claude → Private, tanpa cross-AI), whatsappAIService, katalog per-agent + fallback fasilitas standar, prompt builder, skill loader |
| 07 | `07-frontend-and-modules.md` | Vue 3, router/auth guard, 6 modul master, ConfirmModal, Facility, vendor global (App.vue) |
| 08 | `08-fonnte-whatsapp-integration.md` | Fonnte multi-agent (implementasi: webhook, per-agent token, flow) |
| 09 | `09-whatsapp-terminal-multiagent.md` | Terminal multi-agent: Fonnte + Kirimi + TimelinesAI, dedup DB, fromMe/group filter, cookie response timer, MASSEGE_TERMINAL, gate, routing |
| 10 | `10-qualification-flow-and-ai-prompt-builder.md` | Q1–Q12, extractQualificationState, state block, findNextQuestion, summary |
| 11 | `11-private-agent-whatsapp-format.md` | ResponseBuilderWhatsApp, format WA vs web, footer agent, image markdown |
| 12 | `12-rumah123-and-apify.md` | Data properti backend-driven (DB, scoped per-agent) + Apify live (digabung) + dynamic rules |
| 13 | `13-google-sheets-integration.md` | Setup Google Sheets, service, logging contact form (non-blocking) |
| 14 | `14-external-integrations-s3-email.md` | S3, Email, dan integrasi eksternal lain |
| 15 | `15-deployment-and-troubleshooting.md` | Deploy checklist, NGROK, start command, troubleshoot |
| 16 | `16-facility-city-ai-context.md` | Facility & city DB injection into AI prompt (aiContextService) |
| 17 | `17-recent-updates-and-reconstruction-checklist.md` | Konsolidasi perubahan sesi Juli 2026 + checklist rekonstruksi lengkap |
| 18 | `18-chatbot-private-agent-fallback.md` | BARU (V7): Private Agent architecture, ConversationQualifier, fallback trigger, vs LLM path comparison |
| 19 | `19-feature-routes-and-modules-reference.md` | BARU (V7): Quick lookup — feature → controller/service/model/route, CRUD examples, debugging paths |

---

## Quick Navigation

- **Cara kerja WhatsApp?** → 09 (terminal multi-agent) → 08 (Fonnte) → 10 (Q1–Q12)
- **AI memproses pesan?** → 06 (AI system) → 16 (facility+city context) → 10 (kualifikasi) → 11 (format balasan)
- **Facility / city ke AI?** → 16 (aiContextService)
- **Route API apa saja?** → 05 (route + service + util)
- **Tabel database?** → 03 (skema) → 01 (struktur)
- **Tambah agent WhatsApp?** → 04 (token per-agent) → 03 (kolom users)
- **RESPOND_CATALOG_RUN (Q1–Q12 selalu jalan; OFF=brief, ON=+katalog per-agent)?** → 06 → 10 → 17
- **AI provider (DeepSeek/Kimi/QWEN/ChatGPT/Claude → Private)?** → 06
- **Data properti backend-driven / katalog per-agent?** → 12 → 03 → 06 → 17
- **ngrok auto-start?** → 15 → 02
- **Tambah master data module baru (mengikuti pola Country/Property)?** → 03 → 05 → 07 → 17
- **Merekonstruksi ulang seluruh sistem dari nol?** → 17 → 01 → 02 → 03 → semua lainnya

---

## Developer Paths

| Peran | Urutan baca |
|-------|-------------|
| Backend (baru) | 01 → 02 → 03 → 04 → 05 → 06 → 09 → 10 → 17 |
| Frontend (baru) | 01 → 02 → 07 → 05 → 17 |
| Integrasi WhatsApp | 09 → 08 → 10 → 06 → 11 → 17 |
| Full-stack / rekonstruksi lengkap | 17 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 |

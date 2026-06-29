# Elevan Property Platform — Documentation Index

**Status**: current with codebase. WhatsApp terminal platforms aktif:
**Fonnte, Kirimi, TimelinesAI** (ChakraHQ/WATI/360dialog = legacy, di luar scope dok ini).

> Ringkasan 1-file untuk upload cepat: `../WEBSITE_ENV_CONCEPT_BRIEF.txt`.

---

## Files (urut 01–16, tanpa duplikat)

| # | File | Isi |
|---|------|-----|
| 01 | `01-system-overview-and-architecture.md` | Stack, struktur direktori, semua data flow, ENV inti |
| 02 | `02-project-configuration-and-setup.md` | Instalasi, dependency, .env lengkap, init DB |
| 03 | `03-database-design-and-models.md` | Skema tabel + model Sequelize |
| 04 | `04-auth-and-agents.md` | JWT, login/register, agent, normalisasi telepon, token per-agent |
| 05 | `05-backend-api-and-services.md` | Semua route, controller, service, util |
| 06 | `06-ai-integration-system.md` | Rantai AI (ChatGPT→Claude→Private), whatsappAIService, prompt builder, skill loader |
| 07 | `07-frontend-and-modules.md` | Vue 3, router/auth guard, semua modul halaman, Facility, vendor global (App.vue) |
| 08 | `08-fonnte-whatsapp-integration.md` | Fonnte multi-agent (implementasi: webhook, per-agent token, flow) |
| 09 | `09-whatsapp-terminal-multiagent.md` | Terminal multi-agent: Fonnte + Kirimi + TimelinesAI, MASSEGE_TERMINAL, gate, routing |
| 10 | `10-qualification-flow-and-ai-prompt-builder.md` | Q1–Q12, extractQualificationState, state block, findNextQuestion, summary |
| 11 | `11-private-agent-whatsapp-format.md` | ResponseBuilderWhatsApp, format WA vs web, footer agent, image markdown |
| 12 | `12-rumah123-and-apify.md` | Data properti live (Apify) + fallback JSON + whatsappPropertyContext |
| 13 | `13-google-sheets-integration.md` | Setup Google Sheets, service, logging contact form (non-blocking) |
| 14 | `14-external-integrations-s3-email.md` | S3, Email, dan integrasi eksternal lain |
| 15 | `15-deployment-and-troubleshooting.md` | Deploy checklist, NGROK, start command, troubleshoot |
| 16 | `16-facility-city-ai-context.md` | Facility & city DB injection into AI prompt (aiContextService) |

---

## Quick Navigation

- **Cara kerja WhatsApp?** → 09 (terminal multi-agent) → 08 (Fonnte) → 10 (Q1–Q12)
- **AI memproses pesan?** → 06 (AI system) → 16 (facility+city context) → 10 (kualifikasi) → 11 (format balasan)
- **Facility / city ke AI?** → 16 (aiContextService)
- **Route API apa saja?** → 05 (route + service + util)
- **Tabel database?** → 03 (skema) → 01 (struktur)
- **Tambah agent WhatsApp?** → 04 (token per-agent) → 03 (kolom users)
- **RESPOND_CATALOG_RUN / mode?** → 06 → 10

---

## Developer Paths

| Peran | Urutan baca |
|-------|-------------|
| Backend (baru) | 01 → 02 → 03 → 04 → 05 → 06 → 09 → 10 |
| Frontend (baru) | 01 → 02 → 07 → 05 |
| Integrasi WhatsApp | 09 → 08 → 10 → 06 → 11 |
| Full-stack | 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 |

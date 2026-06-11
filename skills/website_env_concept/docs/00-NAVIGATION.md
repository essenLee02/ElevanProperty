# Elevan Property Platform — Documentation Index

**Last Updated**: June 2026 | **Status**: Current with codebase

---

## Core System (3 files)

1. **01-system-overview-and-architecture.md**
   - Technology stack, directory structure, data flows (website + WhatsApp + auth)
   - Multi-platform WhatsApp architecture diagram
   - Key ENV variables

2. **02-project-configuration-and-setup.md**
   - Environment variables, installation, database init

3. **03-database-design-and-models.md**
   - SQL schema, Sequelize models, table relationships

---

## Backend Logic (4 files)

4. **04-backend-api-and-services.md**
   - All routes (public, auth, protected, webhook, facility, Rumah123)
   - All services with function signatures
   - All utils (propertyKeywordFilter, terminalSwitch, whatsappPropertyContext, etc.)

5. **05-ai-integration-system.md**
   - 3-layer AI fallback (ChatGPT → Claude → Private Agent)
   - WhatsApp AI service (`whatsappAIService.js`) — qualification gate + RESPOND_CATALOG_RUN
   - AI Prompt Builder — extractQualificationState, buildQualificationStateBlock, findNextQuestion
   - chatbotPrivateController OOP classes
   - Skill system (runtime .md loading)

6. **06-skill-loader-and-prompts.md**
   - skillPromptService.js — how skill files are loaded and combined

---

## WhatsApp System (3 files)

13. **13-fonnte-whatsapp-integration-complete.md** ← ACTUAL IMPLEMENTATION
    - Multi-agent Fonnte setup (per-agent tokens)
    - Webhook handler, event detection, dedup cache
    - Agent matching, property intent gate, AI flow
    - Admin endpoints, troubleshooting, terminal logging

16. **16-multi-agent-whatsapp-architecture.md** ← NEW
    - All 3 platforms: Fonnte, WATI, 360dialog
    - Shared AI pipeline via whatsappAIService
    - User model fields (fonnte_token, dialog360_token)
    - Session handling, terminal display control
    - WhatsAppInbound legacy log model

17. **17-qualification-flow-and-ai-prompt-builder.md** ← NEW
    - Complete Q1–Q12 question flow with state keys
    - extractQualificationState: 4 phases explained
    - buildQualificationStateBlock: checklist + DIBLOKIR banner
    - findNextQuestion: priority order + hints
    - buildWhatsappReplyPrompt: full prompt structure
    - Summary brief format + strict rules

---

## Frontend (5 files)

7. **07-frontend-architecture-and-setup.md**
   - Vue 3 + Vite setup, directory structure
   - Router guards, auth flow (authApi + api.js)
   - FloatingChatbot (XSS safety, cookies, property data)
   - Facility module (FacilityListView, FacilityMasterView, facilityApi)

8. **08-module-home.md** — Landing page, hero, featured listings

9. **09-module-about-us.md** — Company info, team, benefits

10. **10-module-contact.md** — Contact form, validation, Sheets, WhatsApp

11. **11-module-chatbot.md** — Floating chatbot widget, sessions

---

## External Integrations (3 files)

12. **12-external-integrations-and-deployment.md** — Deployment, troubleshooting

14. **14-google-sheets-integration-complete.md** — Google Sheets API, contact form logging

15. **15-external-integrations-s3-email-others.md** — S3, Email, Analytics, SMS, Slack, Sentry

---

## Quick Navigation

### "How does WhatsApp work?"
→ 16 (architecture) → 13 (Fonnte implementation) → 17 (qualification flow)

### "What does the AI do with customer messages?"
→ 05 (AI system) → 17 (Q1-Q12 qualification) → skills/claude_responds/09-qualification-flow.md

### "What API routes are available?"
→ 04 (all routes + services + utils)

### "Where are the database tables?"
→ 03 (schema) → 01 (directory structure)

### "How do I add a new WhatsApp agent?"
→ 16 (Adding a New Agent section)

### "Why isn't the bot asking Q10 (lease duration) correctly?"
→ 17 (Q10 date validation) → aiPromptBuilderService.js Phase 2

### "How does RESPOND_CATALOG_RUN work?"
→ 05 (WhatsApp AI Service section) → 17 (buildWhatsappReplyPrompt)

---

## Developer Paths

| Role | Read in order |
|---|---|
| Backend (new) | 01 → 02 → 03 → 04 → 05 → 16 → 17 |
| Frontend (new) | 01 → 02 → 07 → 08-11 → 04 |
| WhatsApp integration | 16 → 13 → 17 → 05 |
| Full-stack | 01 → 02 → 03 → 04 → 05 → 16 → 17 → 07 → 08-11 → 13-15 |

---

## File Statistics

| # | File | Topic | Status |
|---|---|---|---|
| 01 | System Overview | Architecture + ENV | ✅ Current |
| 02 | Config & Setup | Env vars, install | ✅ |
| 03 | Database | Schema, models | ✅ |
| 04 | Backend API | Routes, services, utils | ✅ Current |
| 05 | AI System | Fallback + Q1-Q12 | ✅ Current |
| 06 | Skill Loader | .md file loading | ✅ |
| 07 | Frontend | Vue 3, facility module | ✅ Current |
| 08-11 | Frontend Modules | Home, About, Contact, Chatbot | ✅ |
| 12 | Deployment | Checklist, troubleshoot | ✅ |
| 13 | Fonnte WA | Actual implementation | ✅ Current |
| 14 | Google Sheets | Complete guide | ✅ |
| 15 | S3/Email/etc | External integrations | ✅ |
| 16 | Multi-Agent WA | 3-platform architecture | ✅ NEW |
| 17 | Q1-Q12 Flow | Qualification system | ✅ NEW |

# 01. System Overview & Architecture

## ElevanLabs Property Platform

**Complete AI-powered Indonesian property marketplace with multi-channel support.**

---

## System Architecture (Complete)

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                     │
├─────────────────────────────────────────────────────────┤
│ Vue 3 + Vite                                            │
│ ├─ Home Module (landing, featured listings)            │
│ ├─ About Module (company info, team)                   │
│ ├─ Contact Module (form, validation)                   │
│ └─ Chatbot Module (floating chat widget)               │
└──────────────┬────────────────────────┬──────────────────┘
               │ HTTP REST API          │ WebSocket (optional)
┌──────────────▼────────────────────────▼──────────────────┐
│                    BACKEND LAYER                         │
├──────────────────────────────────────────────────────────┤
│ Express.js (Node.js)                                    │
│                                                          │
│ Controllers & Routes:                                  │
│  • /api/chatbot   - Chat messages                      │
│  • /api/contact   - Contact form                       │
│  • /api/catalog   - Property data                      │
│  • /api/webhook   - Fonnte WhatsApp                   │
│                                                          │
│ Services:                                              │
│  • aiService (ChatGPT/Claude selection)               │
│  • promptService (skill loading)                       │
│  • propertyService (catalog filtering)                │
│  • sessionService (user context)                      │
│  • fonnteService (WhatsApp)                           │
│  • sheetsService (Google Sheets)                      │
└──────────────┬────────────────────────┬──────────────────┘
        │              │                    │
        ▼              ▼                    ▼
   ┌────────┐  ┌──────────┐      ┌─────────────────┐
   │Database│  │AI Models │      │External APIs    │
   └────────┘  └──────────┘      └─────────────────┘
      │            │  │                │  │  │
    SQLite       ChatGPT  Claude    Sheets  S3  Fonnte
    PostgreSQL
```

---

## Data Flow Diagram

### Website Chat Flow
```
User Input → Frontend → API /chatbot → sessionService
→ propertyService (catalog) → promptService (skills)
→ aiService (ChatGPT/Claude) → Response → Frontend Display
```

### Contact Form Flow
```
User Submit → Frontend → API /contact → sheetsService (non-blocking)
→ fonnteService (notification) → Return success immediately
```

### WhatsApp Flow
```
Fonnte Webhook → /api/webhook → Same AI logic as website
→ fonnteService (send response to WhatsApp)
```

---

## Technology Stack

**Backend**: Node.js + Express.js  
**Database**: SQLite (dev) / PostgreSQL (prod)  
**Frontend**: Vue 3 + Vite  
**AI**: ChatGPT API + Claude API (with fallback)  
**External**: Fonnte (WhatsApp), Google Sheets, AWS S3  

---

## Key Features

✅ **Multi-channel**: Website, WhatsApp, Contact form  
✅ **AI-powered**: ChatGPT + Claude with intelligent fallback  
✅ **Session management**: User context & conversation history  
✅ **Skill-based prompts**: Unified skill loader system  
✅ **Catalog-driven**: JSON property data with caching  
✅ **Real-time**: Webhook-based WhatsApp messaging  
✅ **Scalable**: Stateless backend, easy horizontal scaling  

---

## Supported Features

**Property Types**: house, apartment, villa, hotel, boarding_house, shophouse, office, warehouse, store

**Transactions**: rent, sale

**AI Providers**: ChatGPT (primary), Claude (fallback), Private AI option

**Channels**: Website chat, WhatsApp, Contact form → Sheets

---

## Project Structure

```
elevan-property/
├── backend/          (Node.js + Express)
│   ├── controllers/  (Route handlers)
│   ├── services/     (Business logic)
│   ├── routes/       (API endpoints)
│   ├── config/       (Configuration)
│   ├── skills/       (AI skill files)
│   ├── db/           (Database)
│   └── server.js
│
├── frontend/         (Vue 3 + Vite)
│   ├── src/
│   │   ├── components/ (Home, About, Contact, Chatbot)
│   │   ├── composables/ (Logic hooks)
│   │   ├── api/       (Service calls)
│   │   └── App.vue
│   └── vite.config.js
│
├── docs/             (This documentation)
└── README.md
```

---

## Environment Overview

**Production**: Cloud-based (AWS/Heroku), PostgreSQL, SSL/TLS  
**Development**: Local Docker or Node.js, SQLite  
**Testing**: Jest unit tests, integration tests  

---

## Success Criteria

- ✅ Website loads in <2 seconds
- ✅ Chat response in <3 seconds
- ✅ 99.9% uptime
- ✅ <5% error rate
- ✅ Support 1000+ concurrent users

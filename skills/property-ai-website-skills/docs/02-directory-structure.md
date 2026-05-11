# 02 — Directory Structure

## 1. Standard Project Structure

```text
ElevanLabs/
├─ backend/
│  ├─ config/
│  │  └─ database.js
│  │
│  ├─ controllers/
│  │  ├─ aboutController.js
│  │  ├─ chatbotController.js
│  │  ├─ contactController.js
│  │  ├─ fonnteWebhookController.js
│  │  ├─ homeController.js
│  │  └─ logController.js
│  │
│  ├─ models/
│  │  ├─ Contact.js
│  │  ├─ ChatSession.js
│  │  ├─ ChatMessage.js
│  │  ├─ Property.js
│  │  └─ Log.js
│  │
│  ├─ routes/
│  │  └─ index.js
│  │
│  ├─ services/
│  │  ├─ fonnteService.js
│  │  ├─ googleSheetsService.js
│  │  ├─ openaiService.js
│  │  ├─ propertyRecommendationService.js
│  │  ├─ sessionService.js
│  │  └─ validationService.js
│  │
│  ├─ utils/
│  │  ├─ normalizeName.js
│  │  ├─ normalizePhone.js
│  │  ├─ responseFormatter.js
│  │  └─ safeLog.js
│  │
│  ├─ .env
│  ├─ .env.example
│  ├─ google-service-account.json
│  ├─ package.json
│  └─ server.js
│
├─ frontend/
│  ├─ public/
│  │  └─ assets/
│  │     ├─ images/
│  │     └─ jquery-4.0.0/
│  │        └─ jquery-4.0.0.min.js
│  │
│  ├─ src/
│  │  ├─ assets/
│  │  ├─ components/
│  │  │  ├─ FloatingChatbot.vue
│  │  │  ├─ Navbar.vue
│  │  │  ├─ PortfolioCard.vue
│  │  │  └─ PropertyFilter.vue
│  │  │
│  │  ├─ router/
│  │  │  └─ index.js
│  │  │
│  │  ├─ services/
│  │  │  ├─ api.js
│  │  │  ├─ chatbotApi.js
│  │  │  └─ contactApi.js
│  │  │
│  │  ├─ views/
│  │  │  ├─ AboutView.vue
│  │  │  ├─ ContactView.vue
│  │  │  └─ HomeView.vue
│  │  │
│  │  ├─ App.vue
│  │  └─ main.js
│  │
│  ├─ .env
│  ├─ .env.example
│  ├─ index.html
│  └─ package.json
│
├─ docs/
├─ README.md
└─ SKILL.md
```

## 2. Directory Responsibility

| Directory | Responsibility |
|---|---|
| `backend/config` | Database and backend configuration |
| `backend/controllers` | Request handling and business flow orchestration |
| `backend/models` | Sequelize database models |
| `backend/routes` | API route mapping |
| `backend/services` | External API and reusable business services |
| `backend/utils` | Helpers, formatters, and normalizers |
| `frontend/src/views` | Page-level Vue components |
| `frontend/src/components` | Reusable UI components |
| `frontend/src/services` | Axios API client and frontend API services |
| `frontend/src/router` | Vue Router setup |
| `docs` | Technical documentation |

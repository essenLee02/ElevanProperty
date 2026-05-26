# 02. Project Configuration & Setup

## Environment Variables (backend/.env)

### Server
```env
PORT=5005
FRONTEND_PORT=5173
```

### Database (MySQL)
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_property
DB_DIALECT=mysql
```

### OpenAI (ChatGPT — primary AI)
```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_STORE_RESPONSE=true
OPENAI_MAX_OUTPUT_TOKENS=0
```

### Claude (Anthropic — fallback AI)
```env
ANTHROPIC_API_KEY=...            ← placeholder = Claude disabled
CLAUDE_MODEL=claude-haiku-4-5-20251001
CLAUDE_API_VERSION=2023-06-01
CLAUDE_MAX_TOKENS=1200
```

### AI Provider Routing
```env
AI_PRIMARY_PROVIDER=chatgpt
ENABLE_CLAUDE_FALLBACK=true
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
ENABLE_AI_WHATSAPP=true
```

### WhatsApp (Fonnte — contact form only)
```env
FONNTE_TOKEN=m5HDmV4hAYRFBgTdkfDR
ENABLE_AI_WHATSAPP=true
```

### WATI (Agent-customer chat)
```env
WATI_API_TOKEN=wati_2688d36b-1f09-41b6-b09d-1872e6ce6c8e.699l...
WATI_API_URL=https://live.wati.io/10167096/api/v1
```

### Live Property Data (Rumah123 via Apify)
```env
APIFY_API_TOKEN=        # lihat backend/.env — jangan commit token ini ke git
RUMAH123_DATA=ON               # OFF = use only static JSON catalog
RUMAH123_WARMUP_LOCATIONS=Jakarta Selatan,Surabaya,Bandung,Bali
```

### Google Sheets (contact form sync, non-blocking)
```env
GOOGLE_SHEET_ID=1nwy276VXH0JvDZVOoddBbqmr9jwpydoKrukWY2Jukw4
GOOGLE_SHEET_GID=0
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json
```

### JWT Authentication
```env
ACCESS_TOKEN_SECRET=elevan_access_secret_...
REFRESH_TOKEN_SECRET=elevan_refresh_secret_...
ACCESS_TOKEN_EXPIRY=5m
REFRESH_TOKEN_EXPIRY=1d
COOKIE_REFRESH_TOKEN=Elevan_Refresh_Token
BCRYPT_SALT_ROUNDS=10
```

### Chatbot Session
```env
CHATBOT_COOKIE_TTL_MINUTES=90
```

### Skill Prompt Character Limits
```env
SKILL_MAX_WEBSITE_CHARACTERS=12000
SKILL_MAX_RESPONSE_CHARACTERS=22000
SKILL_MAX_PROJECT_CHARACTERS=36000
```

## Quick Start

```bash
# Backend (port 5005)
cd backend
npm install
# Fill in backend/.env
node server.js        # or: npm run dev (nodemon)

# Frontend (port 5173)
cd frontend
npm install
npm run dev
```

## Backend Dependencies

| Package | Purpose |
|---|---|
| express | HTTP server |
| sequelize + mysql2 | ORM + MySQL driver |
| bcrypt | password hashing |
| jsonwebtoken | JWT access/refresh tokens |
| cookie-parser | read HttpOnly cookies |
| axios | Claude API + Fonnte HTTP calls |
| google-spreadsheet | Google Sheets integration |
| apify-client | Rumah123 live property data |
| express-rate-limit | rate limiting (contact form: 5/15min) |
| dotenv | environment variable loading |

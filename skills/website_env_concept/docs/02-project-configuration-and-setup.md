# 02. Project Configuration & Setup

## Installation & Setup

```bash
# Backend
cd backend
npm install express dotenv cors sqlite3 axios uuid
npm install nodemon --save-dev

# Frontend  
cd frontend
npm create vite@latest . -- --template vue
npm install axios vue-router
```

## Environment Variables (.env)

```env
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_TYPE=sqlite
DATABASE_URL=sqlite:./db/database.sqlite

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AI_PRIMARY_PROVIDER=chatgpt
AI_FALLBACK_PROVIDER=claude

# External
FONNTE_TOKEN=...
GOOGLE_SHEET_ID=...
AWS_S3_BUCKET=...

# Chat
CHATBOT_COOKIE_TTL_MINUTES=1440
SESSION_TIMEOUT_MINUTES=720
```

## Database Initialization

**SQLite** (development):
```bash
# Automatic on first run - database.js handles it
```

**PostgreSQL** (production):
```bash
createdb elevan_property
createuser elevan_user
psql -d elevan_property -c "ALTER USER elevan_user WITH PASSWORD 'password';"
```

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js",
    "migrate": "node config/migrations.js",
    "test": "jest",
    "deploy": "npm run migrate && npm start"
  }
}
```

## Running Application

```bash
# Development
npm run dev
# Server on http://localhost:3000

# Production  
npm run deploy
```

## Setup Checklist

- [ ] Node.js >= 18 installed
- [ ] .env file configured
- [ ] Database created
- [ ] API keys obtained (OpenAI, Claude, Fonnte)
- [ ] npm install completed
- [ ] Database migrations run
- [ ] Server starts without errors
- [ ] Frontend can reach backend

# 02 — Environment, Packages, and Runtime

## Backend Runtime

Folder:

```text
backend/
```

Entry point:

```text
backend/server.js
```

The backend loads:

```text
backend/.env
```

using:

```js
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
```

## Backend Environment Variables

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_property
DB_DIALECT=mysql

GOOGLE_SHEET_ID=...
GOOGLE_SHEET_GID=0
GOOGLE_SHEET_TAB_NAME=
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json

OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
OPENAI_STORE_RESPONSE=true
OPENAI_MAX_OUTPUT_TOKENS=0

AI_PRIMARY_PROVIDER=chatgpt
ENABLE_CLAUDE_FALLBACK=true
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true

ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-haiku-4-5-20251001
CLAUDE_API_VERSION=2023-06-01
CLAUDE_MAX_TOKENS=1200

FONNTE_TOKEN=...
ENABLE_AI_WHATSAPP=true

CHATBOT_COOKIE_TTL_MINUTES=20

SKILL_MAX_WEBSITE_CHARACTERS=12000
SKILL_MAX_RESPONSE_CHARACTERS=22000
SKILL_MAX_PROJECT_CHARACTERS=36000
```

## Backend Packages

```text
express
cors
dotenv
axios
sequelize
mysql2
google-auth-library
google-spreadsheet
nodemon
```

Install and run:

```bash
cd backend
npm install
npm run dev
```

## Frontend Runtime

Folder:

```text
frontend/
```

Main files:

```text
frontend/src/main.js
frontend/src/App.vue
frontend/vite.config.js
```

The frontend uses:

```text
frontend/.env
```

## Frontend Environment Variables

```env
VITE_APP_NAME=Elevan Property
VITE_APP_ENV=local

VITE_API_BASE_URL=http://localhost:5000/api

VITE_DEV_SERVER_HOST=localhost
VITE_DEV_SERVER_PORT=5173
VITE_DEV_SERVER_STRICT_PORT=true
VITE_DEV_SERVER_OPEN=false

VITE_PREVIEW_HOST=localhost
VITE_PREVIEW_PORT=4173
VITE_PREVIEW_STRICT_PORT=true
```

## Frontend Packages

```text
vue
vue-router
axios
vue3-toastify
vite
@vitejs/plugin-vue
```

Install and run:

```bash
cd frontend
npm install
npm run dev
```

## Security Rule

Keep secrets only in backend:

```text
OPENAI_API_KEY
ANTHROPIC_API_KEY
FONNTE_TOKEN
GOOGLE_SERVICE_ACCOUNT_JSON_PATH
google-service-account.json
```

Do not store secret keys in `frontend/.env`.

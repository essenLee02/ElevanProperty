# 01 — Environment and Security

## 1. Technology Stack

### Frontend

- VueJS
- Vue Router
- Axios
- Bootstrap template assets
- Local jQuery file when required
- Floating chatbot component

### Backend

- NodeJS
- ExpressJS
- Sequelize
- MySQL
- dotenv
- cors
- axios
- Google Sheets API
- OpenAI API
- Fonnte API

### External Services

- Google Sheets API
- OpenAI / ChatGPT API
- Fonnte WhatsApp API
- MySQL database

## 2. Backend `.env`

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_property
DB_DIALECT=mysql

GOOGLE_SHEET_ID=
GOOGLE_SHEET_GID=0
GOOGLE_SHEET_TAB_NAME=
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_STORE_RESPONSE=true
OPENAI_MAX_OUTPUT_TOKENS=0

FONNTE_TOKEN=
ENABLE_AI_WHATSAPP=true
```

## 3. Frontend `.env`

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## 4. Security Rules

Never commit or expose these files and values publicly:

```text
backend/.env
frontend/.env
backend/google-service-account.json
OPENAI_API_KEY
FONNTE_TOKEN
Google private key
Authorization bearer token
```

## 5. Recommended `.gitignore`

```gitignore
.env
google-service-account.json
node_modules/
dist/
.DS_Store
```

## 6. API Key Rules

- The OpenAI API key must only be used on the backend.
- The Fonnte token must only be used on the backend.
- The Google Service Account JSON file must only be stored on the backend.
- The frontend must never store or expose secret keys.

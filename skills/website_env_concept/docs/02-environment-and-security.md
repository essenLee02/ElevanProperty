# 02 — Environment and Security

## Backend `.env`

Recommended backend environment variables:

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

FONNTE_TOKEN=
ENABLE_AI_WHATSAPP=true

CHATBOT_COOKIE_TTL_MINUTES=20
```

## Frontend `.env`

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Security Rules

Never expose these in frontend code:

```text
OPENAI_API_KEY
FONNTE_TOKEN
GOOGLE_PRIVATE_KEY
google-service-account.json
backend/.env
Authorization header
Bearer token
```

## Cookie TTL Rule

`CHATBOT_COOKIE_TTL_MINUTES` controls how long the frontend may keep chatbot profile data.

Default value:

```env
CHATBOT_COOKIE_TTL_MINUTES=20
```

If the cookie expires or is deleted, the user must enter name, phone, and location again.

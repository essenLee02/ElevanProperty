# Current Backend Environment

## Actual `.env.example`

The current backend `.env.example` contains:

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_property
DB_DIALECT=mysql

GOOGLE_SHEET_ID=1nwy276VXH0JvDZVOoddBbqmr9jwpydoKrukWY2Jukw4
GOOGLE_SHEET_GID=0
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json
```

## Actual `.env`

The current backend `.env` also includes:

```env
GOOGLE_SHEET_TAB_NAME=
```

## Current Implemented Environment Scope

The current code uses environment values for:

```text
PORT
DB_HOST
DB_USER
DB_PASSWORD
DB_NAME
DB_DIALECT
GOOGLE_SHEET_ID
GOOGLE_SHEET_GID
GOOGLE_SHEET_TAB_NAME
GOOGLE_SERVICE_ACCOUNT_JSON_PATH
```

## Not Currently Used

The current backend code does not use:

```text
OPENAI_API_KEY
OPENAI_MODEL
FONNTE_TOKEN
ENABLE_AI_WHATSAPP
```

These should only be added when ChatGPT and Fonnte integrations are implemented.

## Chatbot Cookie TTL Environment

The chatbot profile cookie expiration is configured from backend `.env`:

```env
CHATBOT_COOKIE_TTL_MINUTES=20
```

This value is exposed safely through:

```text
GET /api/chatbot/config
```

Only the TTL value is exposed. Secret keys remain backend-only.

# 08 — Install, Test, and Troubleshooting

## Install Backend Dependencies

```bash
cd backend
npm install
```

## Install Frontend Dependencies

```bash
cd frontend
npm install
```

## Run Backend

```bash
cd backend
npm run dev
```

Expected:

```text
Database connected and synced
Environment file loaded from: .../backend/.env
Backend listening at http://localhost:5000
```

## Run Frontend

```bash
cd frontend
npm run dev
```

Expected:

```text
http://localhost:5173
```

## Clean Install Backend

Windows CMD:

```cmd
cd backend
rmdir /s /q node_modules
del package-lock.json
npm install
npm run dev
```

## Clean Install Frontend

Windows CMD:

```cmd
cd frontend
rmdir /s /q node_modules
del package-lock.json
npm install
npm run dev
```

## Backend Health Check

```text
GET http://localhost:5000/
```

Expected:

```json
{
  "success": true,
  "message": "ElevanLabs backend is running."
}
```

## Important Status Checks

```text
GET http://localhost:5000/api/contact/google-sheets-status
GET http://localhost:5000/api/contact/ai-whatsapp-status
GET http://localhost:5000/api/chatbot/config
GET http://localhost:5000/api/chatbot/ai-provider-status
GET http://localhost:5000/api/chatbot/skill-status
GET http://localhost:5000/api/chatbot/private-status
```

## Common Backend Issues

### Database connection failed

Check:

```env
DB_HOST
DB_USER
DB_PASSWORD
DB_NAME
DB_DIALECT
```

Ensure MySQL is running and database exists.

### OpenAI model/key error

Check:

```env
OPENAI_API_KEY
OPENAI_MODEL
```

Example:

```env
OPENAI_MODEL=gpt-4o-mini
```

### Claude model/key error

Check:

```env
ANTHROPIC_API_KEY
CLAUDE_MODEL=claude-haiku-4-5-20251001
```

### Google Sheets invalid JWT

Check:

```text
backend/google-service-account.json
GOOGLE_SERVICE_ACCOUNT_JSON_PATH
Google Sheets API enabled
Spreadsheet shared with service account email
System clock is correct
```

### Fonnte failed

Check:

```env
FONNTE_TOKEN
ENABLE_AI_WHATSAPP=true
```

Also check Fonnte account/device status.

## Common Frontend Issues

### Frontend cannot call backend

Check:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### Frontend port conflict

Change:

```env
VITE_DEV_SERVER_PORT=5173
```

then restart frontend.

### `.env` not updated

Restart the dev server after changing `.env`.

## Security Rule

Do not commit real secrets:

```text
backend/.env
backend/google-service-account.json
```

Use example files/placeholders for shared templates.

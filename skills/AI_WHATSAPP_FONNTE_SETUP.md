# AI WhatsApp Reply via OpenAI + Fonnte

Flow after this fix:

```text
Vue Contact Form
→ POST /api/contact
→ Backend validates required fields
→ Backend writes to Google Spreadsheet
→ Backend saves to MySQL contacts table
→ Backend sends form data to OpenAI Responses API
→ Backend receives AI reply
→ Backend sends AI reply to the customer's WhatsApp number via Fonnte API
```

## 1. Backend .env

Create or update `backend/.env`:

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_property
DB_DIALECT=mysql

GOOGLE_SHEET_ID=1nwy276VXH0JvDZVOoddBbqmr9jwpydoKrukWY2Jukw4
GOOGLE_SHEET_GID=0
GOOGLE_SHEET_TAB_NAME=
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json

OPENAI_API_KEY=your_new_openai_api_key
OPENAI_MODEL=gpt-5.5
ENABLE_AI_WHATSAPP=true

FONNTE_TOKEN=your_new_fonnte_token
```

Do not put `OPENAI_API_KEY`, `FONNTE_TOKEN`, `.env`, or `google-service-account.json` in frontend/public or GitHub.

## 2. Google Sheet setup

Copy your service account JSON file to:

```text
backend/google-service-account.json
```

Open the JSON, copy `client_email`, then share the Google Spreadsheet to that email as **Editor**.

## 3. Test endpoints

Start backend:

```bash
cd backend
npm install
npm run dev
```

Check Google Sheets connection:

```text
http://localhost:5000/api/contact/google-sheets-status
```

Check OpenAI + Fonnte environment configuration:

```text
http://localhost:5000/api/contact/ai-whatsapp-status
```

The AI/Fonnte status endpoint only checks whether config values are present. The real test is submitting the contact form.

## 4. Common issues

### OpenAI API fails

Check:

- `OPENAI_API_KEY` is valid and not revoked.
- Billing/credits are active in OpenAI Platform.
- `OPENAI_MODEL` is available to your project.

### Fonnte fails

Check:

- `FONNTE_TOKEN` is valid.
- Fonnte device is connected.
- WhatsApp quota is available.
- Phone number is valid. Example accepted input: `08123456789`, `+62 812-3456-7890`, `628123456789`.

## 5. Backend response behavior

If Google Sheets or MySQL fails, backend returns HTTP 500 and the form shows an error.

If Google Sheets and MySQL succeed but OpenAI/Fonnte fails, backend returns HTTP 200 with:

```json
{
  "success": true,
  "googleSheetSent": true,
  "databaseSaved": true,
  "whatsappSent": false,
  "aiWhatsappError": "..."
}
```

This avoids losing the customer contact data while still showing the AI/WhatsApp error clearly.

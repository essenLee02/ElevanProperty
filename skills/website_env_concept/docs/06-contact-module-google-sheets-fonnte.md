# 06 — Contact Module, Google Sheets, and Fonnte

## Purpose

The Contact module captures leads from public users.

It stores contact data in the database, optionally syncs to Google Sheets, and can send an AI WhatsApp reply using Fonnte.

## Frontend Files

```text
frontend/src/views/ContactView.vue
frontend/src/services/contactApi.js
```

## Backend Route

```text
POST /api/contact
GET  /api/contact/google-sheets-status
GET  /api/contact/ai-whatsapp-status
```

## Backend Controller

```text
backend/controllers/contactController.js
```

## Backend Services

```text
backend/services/googleSheetsService.js
backend/services/fonnteService.js
backend/services/aiProviderService.js
```

## Contact Form Fields

```text
name
email
phone
subject
message
```

## Public Form Rule

Contact Form is public.

Users must not need:

```text
login
frontend JWT
Google JWT
admin token
```

to submit the form.

Google Service Account JWT is internal backend-only authentication.

## Recommended Contact Flow

```text
User submits Contact Form
→ frontend validates required fields
→ frontend posts to /api/contact
→ backend validates payload
→ backend saves to MySQL Contact table
→ backend tries Google Sheets append
→ backend optionally sends AI WhatsApp reply via Fonnte
→ frontend shows user-friendly result
```

## Google Sheets Environment

```env
GOOGLE_SHEET_ID=...
GOOGLE_SHEET_GID=0
GOOGLE_SHEET_TAB_NAME=
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json
```

Credential file:

```text
backend/google-service-account.json
```

Template:

```text
backend/google-service-account.example.json
```

## Google Sheets Non-Blocking Rule

Google Sheets errors must not block Contact Form submission if database save succeeds.

Common backend-only Google errors:

```text
invalid_grant
Invalid JWT Signature
403 permission denied
401 unauthorized
```

These errors should be logged in the backend terminal and converted into a user-friendly frontend response.

## Fonnte Environment

```env
FONNTE_TOKEN=...
ENABLE_AI_WHATSAPP=true
```

## Fonnte Route

```text
POST /api/fonnte/webhook
```

## WhatsApp Reply Flow

```text
Contact Form or WhatsApp message
→ backend builds AI prompt
→ ChatGPT / Claude / Private Agent generates response
→ Fonnte sends response to normalized phone number
```

## Frontend Behavior

Contact page should:

- validate required fields;
- sanitize phone number;
- submit to backend API;
- show success if database save succeeds;
- not show raw Google JWT errors to user;
- not require login.

## Troubleshooting

If Contact Form fails:

1. check backend `/api/contact`;
2. check MySQL connection;
3. check Contact model/table;
4. check Google Sheets status endpoint;
5. check Fonnte token/device if WhatsApp fails;
6. keep Google/Fonnte errors non-blocking when database save succeeds.

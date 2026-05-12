# 11 — Testing, Troubleshooting, and Deployment

## Backend Test

```bash
cd backend
npm install
npm run dev
```

Expected:

```text
Backend listening at http://localhost:5000
Database connected and synced
```

## Frontend Test

```bash
cd frontend
npm install
npm run dev
```

Expected:

```text
http://localhost:5173
```

## Functional Test Checklist

- Home page loads.
- About Us loads property data from JSON, not random dummy data.
- About Us filters work.
- Contact Form validates required fields.
- Contact Form submits to backend.
- Google Sheets receives contact lead.
- Chatbot asks for name, phone, and location.
- Chatbot cookie expires based on backend TTL.
- After cookie expiry, user must re-enter name, phone, and location.
- Chatbot sends message to backend.
- Backend sends filtered JSON property context to ChatGPT.
- Chatbot renders `**bold**` text as bold in UI.
- Fonnte sends WhatsApp message if enabled.

## Common Issues

### About Us still showing random data

Check that `AboutView.vue` loads:

```text
/frontend/public/json_data/indonesia_property_36_provinces_flat.json
```

and no longer uses `Array.from()` / `Math.random()` for production portfolio data.

### Chatbot profile does not reset

Check:

```env
CHATBOT_COOKIE_TTL_MINUTES=20
```

and verify frontend calls:

```text
GET /api/chatbot/config
```

### GPT response contains raw `**`

Check `FloatingChatbot.vue` formatter for safe markdown bold rendering.

### Google Sheets 403

Share spreadsheet with service account email as Editor.

### OpenAI rejected key

Replace `OPENAI_API_KEY` with an active API key and restart backend.

### Fonnte failed

Check `FONNTE_TOKEN`, phone normalization, and Fonnte account status.

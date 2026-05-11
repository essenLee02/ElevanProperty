# 12 — Testing and Deployment

## 1. Backend Startup Test

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

## 2. Frontend Startup Test

```bash
cd frontend
npm install
npm run dev
```

Expected:

```text
http://localhost:5173
```

## 3. Google Sheets Test

Open:

```text
http://localhost:5000/api/contact/google-sheets-status
```

Expected:

```json
{
  "success": true
}
```

## 4. OpenAI + Fonnte Test

Open:

```text
http://localhost:5000/api/contact/ai-whatsapp-status?testOpenAI=true
```

Expected:

```json
{
  "success": true
}
```

## 5. Contact Flow Test

Submit the form from:

```text
http://localhost:5173/contact
```

Confirm that:

- Data appears in Google Sheets.
- Data appears in MySQL.
- AI reply is generated.
- WhatsApp message is sent through Fonnte.

## 6. Floating Chatbot Test

Confirm that:

- Chatbot appears on the website.
- User can enter name and phone.
- User can send a message.
- AI reply appears in the widget.
- Chat history is saved.

## 7. Fonnte Webhook Test

Confirm that:

- Fonnte sends webhook to backend.
- Backend receives WhatsApp message.
- Backend sends message to OpenAI.
- Backend sends reply through Fonnte.
- Customer receives the WhatsApp message.

## 8. Deployment Checklist

- `.env` is configured.
- MySQL database is available.
- Google Sheets is shared with the service account.
- OpenAI API key is active.
- Fonnte token is active.
- Backend server is reachable.
- Fonnte webhook URL points to backend.
- Frontend points to the correct backend API.

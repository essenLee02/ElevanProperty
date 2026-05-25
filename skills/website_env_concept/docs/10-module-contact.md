# 10. Module: Contact

## ContactView.vue
`frontend/src/views/ContactView.vue`

Contact form that generates an AI-powered WhatsApp reply to the customer.
Public — no login required.

## Form Fields
- `name` (required)
- `phone` (required) — customer's WhatsApp number, 10–15 digits
- `email` (required)
- `subject` (required)
- `message` (required)

## Submission Flow (POST /api/contact)

```
1. Frontend → POST /api/contact { name, phone, email, subject, message }

2. ContactController.submitContact():
   a. validateContactForm() — validate all fields
   b. Contact.create() — save to MySQL `contacts` table
   c. appendContactRow() [NON-BLOCKING] — sync to Google Sheets
      (fails silently — contact still saved)
   d. generateContactReplyWithProviderFallback(contactPayload)
      → ChatGPT → Claude → generatePrivateContactReply()
   e. sendWhatsAppMessage(phone, aiReply) — Fonnte API
   f. findOrCreateSession + saveUserMessage + saveAssistantMessage
      — save conversation to chat_sessions + chat_messages

3. Response: 200 OK even if AI/Fonnte fails
   (DB save is the critical step — user gets confirmation)
```

## Rate Limiting
`express-rate-limit`: max **5 submissions per IP per 15 minutes**.
Returns 429 with message: `"Terlalu banyak pengiriman. Coba lagi dalam 15 menit."`

## Backend Controller
`backend/controllers/contactController.js` → class `ContactController`:

| Method | Route | Description |
|---|---|---|
| `submitContact(req, res)` | POST /api/contact | main submission handler |
| `googleSheetsStatus(req, res)` | GET /api/contact/google-sheets-status | check GSheets connection |
| `aiWhatsappStatus(req, res)` | GET /api/contact/ai-whatsapp-status | check AI + Fonnte config |

# 05 — Fonnte WhatsApp Flow

## 1. Purpose

Fonnte is used as the WhatsApp message gateway.

The backend must be able to:

1. Receive incoming WhatsApp messages from Fonnte webhook.
2. Send reply messages to customers through Fonnte send-message API.
3. Connect WhatsApp messages with OpenAI / ChatGPT.
4. Store session and conversation history.

## 2. Full WhatsApp Flow

```text
Customer sends WhatsApp message
→ Fonnte forwards message to backend webhook
→ backend reads sender and message
→ backend normalizes phone number
→ backend finds or creates chat session
→ backend saves incoming message
→ backend sends message and history to OpenAI
→ OpenAI generates reply
→ backend saves AI reply
→ backend sends final reply to Fonnte API
→ Fonnte sends reply to customer WhatsApp
```

## 3. Required Endpoint

```text
POST /api/fonnte/webhook
```

## 4. Example Incoming Payload

```json
{
  "sender": "6281234567890",
  "message": "I want to find a villa in Batu."
}
```

## 5. Fonnte Send Message API

Backend sends request to:

```text
POST https://api.fonnte.com/send
```

### Header

```text
Authorization: FONNTE_TOKEN
```

### Payload

```json
{
  "target": "628123456789",
  "message": "Sure, I can help you find a villa in Batu...",
  "countryCode": "0"
}
```

## 6. Phone Normalization

```text
08123456789      → 628123456789
+62 812-3456-789 → 628123456789
8123456789       → 628123456789
```

## 7. Required Service

```text
backend/services/fonnteService.js
```

### Main Functions

```text
sendWhatsAppMessage(targetPhone, message)
normalizeFonnteTarget(phone)
validateFonnteConfig()
```

## 8. Rules

- The Fonnte token must only be stored in backend `.env`.
- Do not send WhatsApp messages directly from the frontend.
- Always normalize the phone number before sending to Fonnte.
- Store incoming and outgoing messages.
- Handle Fonnte errors clearly.

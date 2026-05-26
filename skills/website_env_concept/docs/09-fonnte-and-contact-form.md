# 09. Fonnte WhatsApp & Contact Form

> **Scope:** Fonnte digunakan HANYA untuk contact form (`/contact`).
> **JANGAN** gunakan Fonnte di `watiChatController.js`.
> Untuk agent-customer chat → lihat file `08-wati-whatsapp-integration.md`.

---

## What is Fonnte?

Fonnte is a WhatsApp API platform used by Elevan Property to:
- Send AI-generated replies to visitors who submit the contact form
- Receive incoming messages via webhook (Fonnte webhook)

**Official**: https://fonnte.com

---

## Environment Variables

```env
FONNTE_TOKEN=m5HDmV4hAYRFBgTdkfDR
ENABLE_AI_WHATSAPP=true
```

---

## fonnteService.js

`backend/services/fonnteService.js`

### Key Method: sendWhatsAppMessage

```javascript
sendWhatsAppMessage(phone, message)
// POST https://api.fonnte.com/send
// Header: Authorization: FONNTE_TOKEN
// Body: { target: phone, message, countryCode: '62' }
```

### Phone Normalization

```javascript
normalizeWhatsAppNumber(phone)
// 0821234567 → 62821234567
// +62821234567 → 62821234567
```

### Config Check

```javascript
checkFonnteConfig()
// Returns: { hasToken: bool, enabled: bool }
```

---

## Contact Form Flow (Complete)

```
User fills form (name, phone, email, subject, message)
     ↓
POST /api/contact
     ↓
ContactController.submitContact():
  1. validateContactForm()                         ← validate required fields
  2. Contact.create()                              ← save to MySQL (blocking)
  3. appendContactRow() [NON-BLOCKING]             ← Google Sheets backup
  4. generateContactReplyWithProviderFallback()    ← ChatGPT → Claude → Private
  5. sendWhatsAppMessage(phone, aiReply)           ← Fonnte: send to visitor's WA
  6. findOrCreateSession() + saveMessages()        ← save to chat_sessions/messages
     ↓
Return 200 OK (even if AI or Fonnte fails — DB save is the critical step)
```

---

## Webhook Endpoints

| Path | Controller | Purpose |
|---|---|---|
| `POST /api/fonnte/webhook` | `fonnteWebhookController` | Fonnte AI reply (external) |
| `POST /api/whatsapp/webhook` | `whatsappInboundController` | Agent inbound message log |

### Webhook Handler (fonnteWebhookController)

```javascript
async handleWebhook(req, res) {
  // Incoming message from Fonnte (customer replied to WA)
  const { phone, message, type } = req.body;

  if (type !== 'text') {
    return res.json({ success: true, type: 'media-ignored' });
  }

  // Get or create session
  const session = await sessionService.getOrCreateSession(phone, { source: 'whatsapp_fonnte' });

  // Generate AI response (same chain as chatbot)
  const aiResponse = await aiProviderService.generateWhatsappReplyWithProviderFallback(...);

  // Send reply back via Fonnte
  await fonnteService.sendWhatsAppMessage(phone, aiResponse);

  res.json({ success: true });
}
```

---

## WhatsApp Notification Format (Contact Form → Admin)

When contact form submitted, AI reply is sent to the **visitor's phone**.
The message format:

```
📋 Halo [Nama],

Terima kasih atas pesan Anda!

[AI-generated property reply based on their message]

Tim Elevan Property siap membantu Anda lebih lanjut.
```

---

## Error Handling

```javascript
// Retry with exponential backoff
async function sendWithRetry(phone, message, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fonnteService.sendWhatsAppMessage(phone, message);
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      } else {
        throw error;
      }
    }
  }
}
```

---

## Fonnte Dashboard Setup

```
1. Login: https://fonnte.com
2. Settings → Webhook
   URL: https://yoursite.com/api/fonnte/webhook
   Events: incoming-message, message-status
3. Scan QR code with your WhatsApp number
4. Copy API token → FONNTE_TOKEN in .env
```

---

## Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Messages not sent | Invalid token | Check `FONNTE_TOKEN` in `.env` |
| Webhook not received | URL misconfigured | Verify webhook URL in Fonnte dashboard |
| Phone format error | Missing country code | Use `62821...` not `0821...` |
| Device disconnected | WhatsApp logged out | Rescan QR code in Fonnte dashboard |
| Rate limited | Too many requests | Add 100ms delay between sends |

---

## Status Check

```
GET /api/contact/ai-whatsapp-status
```

Returns Fonnte token status + AI provider status.

# 08 — Fonnte WhatsApp Integration

## Purpose

Fonnte connects chatbot/AI responses to WhatsApp.

## Environment

```env
FONNTE_TOKEN=
ENABLE_AI_WHATSAPP=true
```

## Backend Only

Fonnte token must stay in backend.

Frontend must never call Fonnte directly.

## Send Message Flow

```text
Backend receives ChatGPT reply
→ normalize phone number
→ call Fonnte send API
→ customer receives WhatsApp message
```

## Webhook Flow

```text
Customer sends WhatsApp
→ Fonnte webhook calls backend
→ backend finds or creates session
→ backend loads history
→ backend calls ChatGPT
→ backend sends reply through Fonnte
```

## Phone Normalization

Examples:

```text
+6282233556796 → 6282233556796
082233556796   → 6282233556796
```

## Failure Rule

If Fonnte fails:

- log technical error internally;
- do not expose token;
- return a user-friendly message.

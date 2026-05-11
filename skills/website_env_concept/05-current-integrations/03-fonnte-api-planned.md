# Fonnte API Planned Integration

## Current Status

Not implemented in current code.

## Evidence in Current Code

Current backend does not include:

```text
FONNTE_TOKEN in .env.example
fonnteService.js
/api/fonnte/webhook route
WhatsApp send logic
```

## Planned Purpose

Fonnte can later be used for:

```text
sending ChatGPT replies to WhatsApp
receiving WhatsApp webhook messages
connecting WhatsApp conversations with chatbot flow
```

## Planned Backend Service

```text
backend/services/fonnteService.js
```

## Planned Routes

```text
POST /api/fonnte/webhook
```

## Security Rule

Fonnte token must stay in backend environment variables and must never be placed in frontend code.

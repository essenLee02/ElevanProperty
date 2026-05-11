# Environment Overview

## Core Stack
- **Node.js** for backend services and webhook processing
- **Vue.js** for frontend website pages and floating chatbot UI
- **Google API** for optional supporting services
- **Fonnte API** for WhatsApp message delivery and inbound webhook handling
- **OpenAI API** for chatbot reasoning, multilingual response generation, and property inquiry handling

## Environment Types
- **Local**
- **Staging**
- **Production**

## Best Practice Additions
- Use separate API keys and secrets per environment
- Separate staging and production webhook URLs
- Use `.env` files only for local development
- Use secret manager / server environment variables for staging and production
- Add request logging and webhook event logging from day one

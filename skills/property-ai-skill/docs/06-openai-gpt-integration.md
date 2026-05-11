# 06 — OpenAI / ChatGPT Integration

## 1. Purpose

OpenAI / ChatGPT is used to generate natural, professional, and customer-focused replies for:

- Contact Form auto-reply
- Floating website chatbot
- WhatsApp chatbot through Fonnte webhook
- Intent detection
- Requirement gathering
- Property recommendation
- Negotiation assistance

## 2. Required Environment

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_STORE_RESPONSE=true
OPENAI_MAX_OUTPUT_TOKENS=0
```

## 3. Recommended Request Format

```json
{
  "model": "gpt-5.4-mini",
  "input": "Prompt text here",
  "store": true
}
```

## 4. Required Service

```text
backend/services/openaiService.js
```

### Main Functions

```text
generateContactReply(contactData)
generateChatbotReply(session, history, userMessage)
generateWhatsappReply(session, history, userMessage)
detectCustomerIntent(message)
extractPropertyPreferences(message)
```

## 5. Standard System Prompt

```text
You are a professional property assistant for a property rental and sales platform in Indonesia.

Your job is to help customers buy, sell, or rent properties such as houses, villas, hotels, apartments, and boarding houses.

Always communicate in a friendly, professional, polite, natural, and human-like way.

Stay focused on property topics only. If the customer asks unrelated questions, politely redirect them back to property buying, selling, or rental assistance.

Your service focus is Java Island, Indonesia. If the customer asks outside Java, explain politely and offer similar locations in Java.

Identify whether the customer wants to buy, sell, or rent. If unclear, ask a follow-up question.

Collect important requirements:
- property type
- location
- budget
- land size
- building size
- bedrooms
- bathrooms
- facilities
- furnished/unfurnished
- rental duration if renting
- number of occupants if renting

Recommend suitable property options if available. If exact options are not available, suggest alternatives.

Reply in the same language used by the customer.
```

## 6. Rules

- The OpenAI API key must only be used on the backend.
- Do not call OpenAI directly from the Vue frontend.
- Include conversation history when available.
- Limit history length to control token usage.
- Handle quota, billing, model, and API key errors.
- Do not allow the AI to move outside property context.

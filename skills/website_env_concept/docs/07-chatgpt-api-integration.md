# 07 — ChatGPT / OpenAI API Integration

## Purpose

ChatGPT generates customer-facing responses for chatbot and optional Contact Form auto-reply.

## Backend Only

OpenAI API must be called from backend only.

Frontend must never call OpenAI directly.

## Environment

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_STORE_RESPONSE=true
```

## Recommended API

Use OpenAI Responses API.

Payload should include:

```text
model
input
store
```

`store: true` is recommended for debugging logs.

## Prompt Context

Backend should assemble prompt with:

```text
property assistant role
latest user message
user name
user phone
user location
conversation history
filtered JSON property context
scope control
catalog-only rule
same-language rule
no hallucination rule
alternative suggestion rule
```

## JSON Property Context Rule

When user chats for the first time after entering name, phone, and location, backend should be able to read property JSON and send relevant filtered property data to ChatGPT.

Do not send irrelevant properties when user criteria are clear.

## Response Formatting Rule

GPT may use markdown bold:

```text
**Property Name**
**Rp 53.200.000.000**
```

Frontend should safely render `**text**` as bold.

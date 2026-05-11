# ChatGPT / OpenAI API Planned Integration

## Current Status

Not implemented in current code.

## Evidence in Current Code

Current backend does not include:

```text
OPENAI_API_KEY in .env.example
openaiService.js
OpenAI package or direct OpenAI request
/api/contact/ai-whatsapp-status route
/api/chatbot/message route
```

## Planned Purpose

ChatGPT can later be used for:

```text
Contact Form auto-reply
Floating chatbot response
Property recommendation explanation
Lead qualification
Negotiation message drafting
```

## Planned Backend Service

```text
backend/services/openaiService.js
```

## Planned Rule

ChatGPT should be called only from backend, never from frontend.

## Planned Prompt Context

A future prompt should include:

```text
property assistant role
latest user message
conversation history
property context
scope control
no hallucination rule
same-language rule
alternative suggestion rule
```

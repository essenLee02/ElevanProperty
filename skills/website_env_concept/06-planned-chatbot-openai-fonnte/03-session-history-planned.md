# Session History Current Development

## Current Status

Implemented in the current backend code.

## Models

```text
ChatSession
ChatMessage
```

## Customer Identity Fields

The chatbot session should remember the customer using:

```text
name
normalizedName
phone
normalizedPhone
location
normalizedLocation
```

## Purpose

Session history supports:

```text
remembering user name, phone, and location
saving user messages
saving ChatGPT answers
loading recent history
continuing the same customer's conversation after cookie expiry
prioritizing the latest user request
```

## Cookie vs History

The browser cookie expires based on `CHATBOT_COOKIE_TTL_MINUTES`.

The cookie only controls whether the user must re-enter profile fields.

Conversation history is stored separately. When the same user enters the same name, phone, and location again, the chatbot can load previous history and give a more relevant answer.

## Important Rule

The latest user message must always have priority over old history.

# Floating Chatbot Planned Development

## Current Status

Not implemented in the current frontend code.

## Planned Frontend Component

```text
frontend/src/components/FloatingChatbot.vue
```

## Planned Backend Route

```text
POST /api/chatbot/message
```

## Planned Flow

```text
user enters name and phone
user sends message
frontend calls backend chatbot API
backend loads or creates conversation session
backend calls ChatGPT
backend returns ChatGPT answer
frontend displays answer
```

## Planned UI Rules

```text
bottom-right widget
loading state
disable submit while sending
display user and assistant messages
friendly error message
```

# Floating Chatbot Current Development

## Current Status

Implemented in the current frontend and backend code.

## Frontend Component

```text
frontend/src/components/FloatingChatbot.vue
```

## Backend Routes

```text
GET  /api/chatbot/config
POST /api/chatbot/message
```

## Required Profile Fields

Before a customer can chat, the chatbot must request:

```text
name
phone
location
```

## Cookie Rule

The profile cookie is temporary only. The cookie TTL is configured in backend `.env`:

```env
CHATBOT_COOKIE_TTL_MINUTES=20
```

The frontend reads this value from:

```text
GET /api/chatbot/config
```

If the cookie expires or is deleted, the chatbot must reset the profile and require name, phone, and location again.

## Chat Flow

```text
user enters name, phone, and location
frontend saves temporary profile cookie using backend TTL
user sends message
frontend sends name, phone, location, message, and first-chat JSON property context to backend
backend finds or creates chat session using name + phone + location
backend loads conversation history
backend sends latest message, history, customer identity, and property context to ChatGPT
ChatGPT returns final response
backend saves assistant response
frontend displays answer
```

## History Rule for GPT

ChatGPT should remember returning users by:

```text
name
phone
location
```

When the same user chats again after the cookie expires, the backend reconnects to the stored conversation history using those fields.

The latest message still has the highest priority. Old history must support the response but must not override a new request.

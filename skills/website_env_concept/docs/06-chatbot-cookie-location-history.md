# 06 — Chatbot Cookie, Location, and History

## Required Profile Fields

Before a user can chat, the chatbot must request:

```text
name
phone
location
```

## Cookie TTL

Cookie expiry is controlled by backend `.env`:

```env
CHATBOT_COOKIE_TTL_MINUTES=20
```

Frontend should get TTL from:

```text
GET /api/chatbot/config
```

## Cookie Expiry Rule

If the cookie expires or is deleted:

1. remove chatbot profile;
2. clear active frontend profile state;
3. ask the user to fill name, phone, and location again.

## Session Identity

Backend should use these fields to identify returning users:

```text
normalizedName
normalizedPhone
normalizedLocation
```

## Chat History

Backend should save:

```text
user messages
assistant messages
channel
metadata
createdAt
```

When calling ChatGPT, include relevant history for the same user identity.

## Latest Message Priority

History must not override the latest user message.

Example:

```text
Old history: user asked about hotel in Malang.
Latest message: user asks for rental house in Surabaya.
Correct result: answer about rental house in Surabaya.
```

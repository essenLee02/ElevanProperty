# 04 — Frontend Structure and Modules

## Recommended Frontend Structure

```text
frontend/
├─ public/
│  ├─ assets/
│  │  └─ image_data/
│  │     └─ properties/
│  └─ json_data/
│     └─ indonesia_property_36_provinces_flat.json
├─ src/
│  ├─ components/
│  ├─ router/
│  ├─ services/
│  ├─ views/
│  ├─ App.vue
│  └─ main.js
```

## Home Module

File:

```text
frontend/src/views/HomeView.vue
```

Purpose:

- show landing page;
- business story;
- vision;
- mission;
- CTA to About and Contact.

## About Us Module

File:

```text
frontend/src/views/AboutView.vue
```

Rules:

- do not generate dummy data using `Array.from()` and `Math.random()`;
- load portfolio data from JSON;
- use the JSON file:

```text
frontend/public/json_data/indonesia_property_36_provinces_flat.json
```

- display property cards;
- filter by building type, transaction type, and location.

## Contact Module

File:

```text
frontend/src/views/ContactView.vue
```

Required fields:

```text
name
email
phone
subject
message
```

Phone input should allow only:

```text
numbers
+
-
space
```

## Floating Chatbot

File:

```text
frontend/src/components/FloatingChatbot.vue
```

Rules:

- ask for name, phone, and location;
- store profile in cookie only for the TTL from backend;
- clear profile when cookie expires;
- send chat messages to backend;
- render `**bold**` response text as bold HTML safely.

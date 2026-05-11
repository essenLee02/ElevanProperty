# Markdown Alignment Notes

## Main Alignment Decision

The documentation has been updated to match actual code behavior.

Where a feature does not exist in the code yet, it is now labeled as:

```text
Planned development
Future scope
Recommended improvement
```

## Important Corrections

### Chatbot

Previous documentation may have implied that a chatbot already exists.

Actual code:

```text
No chatbot route
No FloatingChatbot component
No ChatSession model
No ChatMessage model
```

Updated documentation treats the chatbot as planned development.

### OpenAI / ChatGPT API

Actual code:

```text
No OpenAI dependency
No OPENAI_API_KEY in .env.example
No openaiService.js
No API call to OpenAI
```

Updated documentation treats ChatGPT integration as planned development.

### Fonnte API

Actual code:

```text
No FONNTE_TOKEN in .env.example
No fonnteService.js
No /api/fonnte/webhook route
```

Updated documentation treats Fonnte integration as planned development.

### Property Data

Actual code:

```text
No Property model
AboutView.vue generates 40 frontend-only random portfolio records
```

Updated documentation records this current behavior and separates planned database-driven property catalog.

### Google Sheets

Actual code:

```text
Google Sheets integration exists in contactController.js.
It uses google-spreadsheet and google-auth-library JWT.
```

Updated documentation reflects this as implemented.

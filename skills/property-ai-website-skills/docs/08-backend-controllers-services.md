# 08 — Backend Controllers, Services, and Utilities

## 1. Controllers

### `homeController.js`

Responsibilities:

- Provide Home page data.
- Provide vision, mission, story, background, and service summary.

### `aboutController.js`

Responsibilities:

- Provide About Us data.
- Provide property portfolio data.
- Support filtering by transaction type and building type.

### `contactController.js`

Responsibilities:

- Validate Contact Form data.
- Save data to Google Sheets.
- Save data to MySQL.
- Send data to OpenAI.
- Send AI reply to WhatsApp through Fonnte.

### `chatbotController.js`

Responsibilities:

- Receive messages from the floating chatbot.
- Store session and history.
- Send context to OpenAI.
- Return AI reply to frontend.

### `fonnteWebhookController.js`

Responsibilities:

- Receive webhook messages from Fonnte.
- Process incoming WhatsApp messages.
- Send messages to OpenAI.
- Send replies through Fonnte.

### `logController.js`

Responsibilities:

- Record user and backend activity.
- Log to console or save to the `logs` table.

## 2. Services

### `openaiService.js`

Handles external API integration with OpenAI.

### `fonnteService.js`

Handles external API integration with Fonnte.

### `googleSheetsService.js`

Handles external API integration with Google Sheets.

### `sessionService.js`

Manages customer sessions and conversation history.

### `propertyRecommendationService.js`

Searches and ranks properties based on customer needs.

### `validationService.js`

Provides reusable validation for contact form, chatbot, email, phone, and required fields.

## 3. Utilities

### `normalizePhone.js`

Normalizes phone numbers:

```text
+6282233556796 → 6282233556796
082233556796   → 6282233556796
82233556796    → 6282233556796
```

### `normalizeName.js`

Normalizes customer names:

```text
Devy Herman → devy herman
devy herMAN → devy herman
```

### `responseFormatter.js`

Standardizes success and error responses.

### `safeLog.js`

Masks secrets such as API keys, tokens, and private keys.

# 10 — API Specification

## 1. Home API

```text
GET /api/home
```

### Response

```json
{
  "success": true,
  "data": {}
}
```

## 2. About API

```text
GET /api/about
GET /api/about?transactionType=rent&buildingType=villa
```

### Response

```json
{
  "success": true,
  "data": {
    "company": {},
    "portfolios": []
  }
}
```

## 3. Contact Submit API

```text
POST /api/contact
```

### Request

```json
{
  "name": "Nigel",
  "email": "nigel@example.com",
  "phone": "08123456789",
  "subject": "Villa Rental",
  "message": "I want to find a villa in Malang."
}
```

### Response

```json
{
  "success": true,
  "message": "Contact submitted successfully.",
  "contactId": 1,
  "whatsappSent": true
}
```

## 4. Google Sheets Status API

```text
GET /api/contact/google-sheets-status
```

## 5. AI WhatsApp Status API

```text
GET /api/contact/ai-whatsapp-status
GET /api/contact/ai-whatsapp-status?testOpenAI=true
```

## 6. Website Chatbot API

```text
POST /api/chatbot/message
```

### Request

```json
{
  "name": "Devy Herman",
  "phone": "082233556796",
  "message": "I am looking for a rental apartment in Surabaya."
}
```

### Response

```json
{
  "success": true,
  "reply": "Sure, I can help you find a rental apartment in Surabaya..."
}
```

## 7. Fonnte Webhook API

```text
POST /api/fonnte/webhook
```

### Request

```json
{
  "sender": "6281234567890",
  "message": "I want to find a house in Malang."
}
```

## 8. Log API

```text
POST /api/log
```

### Request

```json
{
  "action": "PAGE_VIEW",
  "details": "Navigated to /contact"
}
```

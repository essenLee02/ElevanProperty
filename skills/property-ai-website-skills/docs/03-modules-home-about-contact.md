# 03 — Modules: Home, About Us, Contact

## 1. Home Module

### Directory

```text
frontend/src/views/HomeView.vue
backend/controllers/homeController.js
```

### Purpose

The Home page displays the main company information.

### Required Content

- Company background
- Vision
- Mission
- Business story
- Business reason
- Customer benefits
- Service summary:
  - Rent
  - Buy
  - Sell

### Home API

```text
GET /api/home
```

### Expected Response

```json
{
  "success": true,
  "data": {
    "vision": "...",
    "mission": "...",
    "story": "...",
    "benefits": []
  }
}
```

---

## 2. About Us Module

### Directory

```text
frontend/src/views/AboutView.vue
backend/controllers/aboutController.js
```

### Purpose

The About Us page displays the company profile and property portfolio.

### Required Content

- Company profile
- Company portfolio
- Rental service explanation
- Buying service explanation
- Selling service explanation
- Property experience

### Portfolio Fields

```text
id
title
description
price
location
address
buildingArea
landArea
buildingType
transactionType
imageUrl
facilities
```

### Transaction Types

```text
sale
rent
purchase
```

### Building Types

```text
house
villa
hotel
boarding_house
apartment
other
```

### Required Filters

Transaction type filter:

- All
- Sale
- Rent
- Purchase

Building type filter:

- All
- House
- Villa
- Hotel
- Boarding House
- Apartment
- Other

### About API

```text
GET /api/about
GET /api/about?transactionType=rent&buildingType=villa
```

---

## 3. Contact Module

### Directory

```text
frontend/src/views/ContactView.vue
backend/controllers/contactController.js
backend/services/googleSheetsService.js
backend/services/openaiService.js
backend/services/fonnteService.js
```

### Purpose

The Contact Form receives customer identity and inquiry data, then the backend processes it through Google Sheets, MySQL, OpenAI, and Fonnte.

### Required Input

```text
name
email
phone
subject
message
```

### Contact Flow

```text
Customer submits Contact Form
→ frontend validates input
→ POST /api/contact
→ backend validates input
→ backend saves data to Google Sheets
→ backend saves data to MySQL
→ backend sends customer context to OpenAI
→ backend receives AI reply
→ backend sends WhatsApp reply via Fonnte
→ frontend shows success or error message
```

### Phone Input Rule

The phone field may only accept:

```text
0-9
+
-
space
```

### Contact API

```text
POST /api/contact
```

### Request Example

```json
{
  "name": "Nigel",
  "email": "nigel@example.com",
  "phone": "08123456789",
  "subject": "Villa Rental",
  "message": "I want to find a villa in Malang."
}
```

### Success Response

```json
{
  "success": true,
  "message": "Contact submitted successfully.",
  "contactId": 1,
  "googleSheetsSaved": true,
  "databaseSaved": true,
  "aiReply": "...",
  "whatsappSent": true
}
```

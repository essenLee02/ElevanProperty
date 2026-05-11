# 11 — Frontend Components and Views

## 1. `frontend/index.html`

### Purpose

Base HTML template for the Vue app.

### Local jQuery

If jQuery is required:

```html
<script src="/assets/jquery-4.0.0/jquery-4.0.0.min.js"></script>
```

### Rule

Do not place API keys or tokens in the frontend.

---

## 2. `frontend/src/services/api.js`

### Purpose

Central Axios instance.

### Standard Code

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;
```

---

## 3. `frontend/src/views/HomeView.vue`

### Must Include

- Hero section
- Vision
- Mission
- Business background
- Business story
- Customer benefits
- CTA to Contact page
- CTA to Chatbot

---

## 4. `frontend/src/views/AboutView.vue`

### Must Include

- Company profile
- Rental service
- Buying service
- Selling service
- Portfolio list
- Portfolio filter

### Portfolio Card Must Show

```text
image
title
description
price
location
address
building area
land area
building type
transaction type
facilities
```

---

## 5. `frontend/src/views/ContactView.vue`

### Required Fields

```text
name
email
phone
subject
message
```

### Validation

If a field is empty, show a message box explaining which field is blank.

### Phone Rule

The phone field only accepts:

```text
0-9
+
-
space
```

### jQuery Example

```javascript
$('#phone').on('input', function () {
  const cleanValue = $(this).val().replace(/[^0-9+\-\s]/g, '');
  $(this).val(cleanValue);
});
```

---

## 6. `components/FloatingChatbot.vue`

### Purpose

Floating chatbot displayed at the bottom-right of every page.

### Pre-Chat Input

```text
name
phone
```

### Flow

```text
User sends message
→ POST /api/chatbot/message
→ backend processes with OpenAI
→ frontend displays reply
```

---

## 7. `components/PortfolioCard.vue`

Displays one property card.

## 8. `components/PropertyFilter.vue`

Filters portfolio by:

- Transaction type
- Building type

## 9. `components/Navbar.vue`

Navigation links:

- Home
- About Us
- Contact

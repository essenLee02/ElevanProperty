# 10. Module: Contact

## Contact Form & Flow

```
Contact Module
├── Contact Form
│   ├── Name field
│   ├── Phone field
│   ├── Email field
│   └── Message textarea
│
├── Validation
│   ├── Required fields check
│   ├── Email format validation
│   └── Phone format validation
│
├── Submission
│   ├── Send to Google Sheets (non-blocking)
│   ├── Send WhatsApp notification
│   └── Return success
│
└── Confirmation
    ├── Success message
    └── Next steps info
```

## Component Template

```vue
<template>
  <div class="contact-module">
    <h1>Get in Touch</h1>
    <form @submit.prevent="submitForm">
      <input v-model="form.name" placeholder="Your Name" required />
      <input v-model="form.phone" type="tel" placeholder="Phone" required />
      <input v-model="form.email" type="email" placeholder="Email" required />
      <textarea v-model="form.message" placeholder="Message"></textarea>
      <button type="submit">Send</button>
    </form>
    <div v-if="submitted" class="success">Thank you! We'll contact you soon.</div>
  </div>
</template>
```

## Form Validation

```javascript
function validateForm(form) {
  if (!form.name || form.name.length < 2) return 'Invalid name';
  if (!form.phone || form.phone.length < 10) return 'Invalid phone';
  if (!form.email || !form.email.includes('@')) return 'Invalid email';
  if (!form.message || form.message.length < 10) return 'Message too short';
  return null; // Valid
}
```

## Submission Flow

```javascript
async function submitForm() {
  const error = validateForm(form.value);
  if (error) return alert(error);

  try {
    const response = await contactApi.submit(form.value);
    if (response.success) {
      submitted.value = true;
      form.value = {}; // Clear form
    }
  } catch (error) {
    alert('Error submitting form. Please try again.');
  }
}
```

## Backend Integration

POST /api/contact:
1. Validate input
2. Save to Google Sheets (non-blocking)
3. Send WhatsApp notification to admin
4. Return success immediately

## Features

- Real-time validation
- Clean error messages
- Success confirmation
- Mobile responsive
- Spam protection (optional)

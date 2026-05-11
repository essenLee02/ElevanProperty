# Module: Contact

## Purpose
The Contact module captures lead data and sends inquiries to backend and WhatsApp.

## Required Inputs
- name
- email
- phone number
- subject
- message

## Flow
1. User submits contact form
2. Frontend validates the inputs
3. Backend stores the lead
4. Backend forwards the message to WhatsApp through Fonnte API
5. System returns a success or failure response to frontend

## Best Practice Additions
- Normalize phone number before saving
- Add spam protection
- Add server-side validation in addition to frontend validation
- Store inquiry source such as `contact_page`, `home_page`, or `chatbot`
- Save timestamp and optional campaign/source tracking

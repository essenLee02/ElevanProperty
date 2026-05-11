# 00 — Goal and Scope

## 1. Project Goal

The website is designed to improve customer experience, increase successful property transactions, reduce agent workload, and provide smart automated assistance for property buying, selling, and rental needs.

The system must support:

- Property selling inquiries
- Property buying inquiries
- Property rental inquiries
- Property recommendations
- Price negotiation assistance
- Website chatbot conversations
- WhatsApp conversations using Fonnte
- Conversation history based on customer name and phone number

## 2. Business Scope

The platform focuses on property types such as:

- House
- Villa
- Hotel
- Boarding house
- Apartment
- Other relevant property types

## 3. Main User Journey

```text
Customer opens the website
→ Customer views Home / About Us / Portfolio
→ Customer submits Contact Form or uses Chatbot
→ Backend receives customer data
→ Backend saves data to Google Sheets and MySQL
→ Backend sends customer context to OpenAI / ChatGPT
→ ChatGPT generates a response
→ Backend sends the response to the customer through WhatsApp using Fonnte
```

## 4. Chatbot Goal

The chatbot must be able to:

1. Understand customer needs.
2. Identify whether the customer wants to buy, sell, or rent property.
3. Ask relevant property requirement questions.
4. Recommend suitable property options.
5. Assist with price negotiation.
6. Reply in the same language used by the customer.
7. Avoid conversations outside property topics.
8. Focus on properties in Java Island, Indonesia.

## 5. Communication Style

The chatbot must communicate in a way that is:

- Friendly
- Professional
- Natural
- Human-like
- Polite
- Fast and responsive
- Persuasive but respectful
- Helpful and customer-focused

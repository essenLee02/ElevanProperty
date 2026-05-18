# 04 — Home Module

## Purpose

The Home module is the landing entry point for the Elevan_Property website.

It should introduce the website and guide users to:

- view property portfolio;
- open About Us;
- submit Contact Form;
- use the Floating Chatbot.

## Frontend Files

```text
frontend/src/views/HomeView.vue
frontend/src/components/Navbar.vue
```

## Backend Route

```text
GET /api/home
```

## Backend Controller

```text
backend/controllers/homeController.js
```

## Expected Home API Responsibility

The Home API may return:

```text
title
subtitle
description
main call-to-action text
basic company/profile message
```

## Frontend Behavior

The Home page should:

- load without login;
- render responsive layout;
- provide clear navigation;
- not expose backend secrets;
- not directly call external AI providers;
- let Contact Form and Chatbot handle lead capture.

## Development Rule

Keep Home simple and lightweight.

Do not duplicate About Us portfolio logic inside Home unless intentionally needed.

## Troubleshooting

If Home does not load:

1. check frontend route `/`;
2. check `HomeView.vue`;
3. check backend `/api/home`;
4. check `VITE_API_BASE_URL`;
5. check backend is running on `PORT=5000`.

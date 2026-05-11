# About Us Module

## Current Status

Implemented as a static Vue page with frontend-generated portfolio data.

## Frontend File

```text
frontend/src/views/AboutView.vue
```

## Backend API

```text
GET /api/about
```

Current backend API returns only a welcome message.

## Current Features

```text
services section
portfolio section
building type filter
transaction type filter
40 generated portfolio cards
filter action logging
```

## Current Limitation

Portfolio data is not stored in the backend.

Portfolio data changes on page refresh because price and area are generated with `Math.random()`.

# Current Frontend Views

## HomeView.vue

Current behavior:

```text
static landing page content
hero section
story/reason tab
vision tab
mission tab
local image assets
```

It does not currently call `/api/home`.

## AboutView.vue

Current behavior:

```text
static service section
frontend-generated portfolio list
40 portfolio records generated with Array.from()
random price and area using Math.random()
filters by buildingType and transactionType
logs filter changes to /api/log using hardcoded axios URL
```

It does not currently call `/api/about`.

## ContactView.vue

Current behavior:

```text
contact form with name, email, phone, subject, message
required field validation
phone cleaning and regex validation
toast success/error messages
POST to http://localhost:5000/api/contact
loads jQuery from CDN for phone input handling
```

It does not use the central API service yet for contact submit.

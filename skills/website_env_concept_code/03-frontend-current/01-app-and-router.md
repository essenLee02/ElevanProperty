# Current App and Router

## App Layout

File:

```text
frontend/src/App.vue
```

Current layout contains:

```text
navbar
logo
Home link
About Us link
Contact link
router-view
```

Navbar is currently inside `App.vue`, not separated into `Navbar.vue`.

## Router

File:

```text
frontend/src/router/index.js
```

Current routes:

```text
/        → HomeView.vue
/about   → AboutView.vue
/contact → ContactView.vue
```

## Route Logging

The router uses `afterEach()` to send navigation logs to:

```text
POST /api/log
```

It uses the central API service:

```text
frontend/src/services/api.js
```

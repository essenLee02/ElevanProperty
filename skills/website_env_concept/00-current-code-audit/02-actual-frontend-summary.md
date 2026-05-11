# Actual Frontend Summary

## Current Frontend Stack

Based on the current `frontend/package.json`, the frontend uses:

```text
vue
vue-router
axios
vue3-toastify
vite
@vitejs/plugin-vue
```

## Current Frontend Routes

Defined in:

```text
frontend/src/router/index.js
```

Available routes:

```text
/        → HomeView.vue
/about   → AboutView.vue
/contact → ContactView.vue
```

## Current Views

```text
frontend/src/views/HomeView.vue
frontend/src/views/AboutView.vue
frontend/src/views/ContactView.vue
```

## Current App Layout

Defined in:

```text
frontend/src/App.vue
```

Current layout includes:

```text
navbar
logo
Home link
About Us link
Contact link
router-view
```

## Current Frontend API Service

There is a central API file:

```text
frontend/src/services/api.js
```

Current configuration:

```text
baseURL = VITE_API_BASE_URL or http://localhost:5000/api
timeout = 30000
```

However, not all views use this API service. Some views still use hardcoded Axios URLs.

## Current Frontend Limitations

The current frontend does not yet include:

```text
FloatingChatbot.vue
Navbar.vue as separate component
PortfolioCard.vue
PropertyFilter.vue
contactApi.js
chatbotApi.js
aboutApi.js
homeApi.js
```

Navbar is currently inside `App.vue`.
Portfolio cards and filters are directly inside `AboutView.vue`.
Contact API call is directly inside `ContactView.vue`.

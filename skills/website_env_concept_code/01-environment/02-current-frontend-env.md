# Current Frontend Environment

## Actual `.env.example`

The current frontend `.env.example` contains:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Current Usage

The file exists and `frontend/src/services/api.js` uses it.

However, some views still use hardcoded URLs:

```text
ContactView.vue → http://localhost:5000/api/contact
AboutView.vue   → http://localhost:5000/api/log
```

## Recommended Future Improvement

Use the existing central API service everywhere:

```text
frontend/src/services/api.js
```

This avoids repeated hardcoded API URLs.

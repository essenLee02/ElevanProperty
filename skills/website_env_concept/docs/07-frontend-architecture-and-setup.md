# 07. Frontend Architecture & Setup

## Stack
- Vue 3 (Composition API)
- Vite build tool
- Port 5173 (dev)

## Directory Structure

```
frontend/src/
├── views/
│   ├── HomeView.vue          ← Landing page, contains FloatingChatbot
│   ├── AboutView.vue         ← About page (static)
│   ├── ContactView.vue       ← Contact form with AI WhatsApp reply
│   ├── Rumah123View.vue      ← Live property search (Apify)
│   ├── LoginView.vue         ← Login form (auth layout)
│   ├── RegisterView.vue      ← Register form (auth layout)
│   └── ProfileView.vue       ← User profile (requires auth)
├── components/
│   └── FloatingChatbot.vue   ← Main chatbot widget (~950 lines)
├── services/
│   ├── api.js                ← Axios instance with interceptors
│   ├── authApi.js            ← Token memory management
│   └── chatbotApi.js         ← Chatbot API calls
└── router/
    └── index.js              ← Vue Router with auth guards
```

## Router Guards (frontend/src/router/index.js)

```javascript
// Route meta options:
{ meta: { requiresAuth: true } }   // → redirect to /login if not authenticated
{ meta: { requiresGuest: true } }  // → redirect logged-in users away (login/register pages)
// No meta = public (accessible by all, logged in or not)
```

| Route | Meta | Access |
|---|---|---|
| / (Home) | none | public |
| /about | none | public |
| /contact | none | public |
| /rumah123 | none | public |
| /login | requiresGuest | guests only |
| /register | requiresGuest | guests only |
| /profile | requiresAuth | logged-in only |

## Authentication in Frontend

### authApi.js
- `getCachedToken()` — returns token from memory (falls back to localStorage for page reload)
- `setCachedToken(token)` — stores in memory (runtime only, more XSS-safe than localStorage)
- `clearCachedToken()` — removes token from memory

### api.js (Axios instance)
- `baseURL: /api` → proxied to `http://localhost:5005/api` by Vite
- **Request interceptor**: adds `Authorization: Bearer <token>` header automatically
- **Response interceptor**: on 401, calls `GET /api/auth/refresh`, retries original request with new token

## FloatingChatbot.vue

See `11-module-chatbot.md` for full details.

Key files used:
- Reads profile from cookie `chatbot_profile`
- Reads session ID from cookie (TTL from `/api/chatbot/config`)
- Loads property data from `frontend/public/json_data/indonesia_property_36_provinces_flat.json`
- Posts to `POST /api/chatbot/message`

## Build / Deploy

```bash
# Dev server (hot reload)
npm run dev

# Production build (outputs to frontend/dist/)
npm run build
```

Vite config proxies `/api` to `http://localhost:5005` in dev mode.
For production, configure your web server (nginx/caddy) to proxy `/api` to the Node.js backend.

# 07. Frontend Architecture & Setup

## Stack
- Vue 3 (Composition API)
- Vite build tool
- Port 5173 (dev), proxied `/api` → `http://localhost:5005/api`

## Directory Structure

```
frontend/src/
├── views/
│   ├── HomeView.vue          ← Landing page (public) — contains FloatingChatbot
│   ├── AboutView.vue         ← About page (public)
│   ├── ContactView.vue       ← Contact form with AI WhatsApp reply (public)
│   ├── Rumah123View.vue      ← Live property search via Apify (public)
│   ├── LoginView.vue         ← Login form (guests only)
│   ├── RegisterView.vue      ← Register form (guests only)
│   ├── ProfileView.vue       ← User profile (auth required)
│   ├── FacilityListView.vue  ← Browse facility list (auth required)
│   └── FacilityMasterView.vue ← Facility CRUD admin UI (auth required)
├── components/
│   ├── FloatingChatbot.vue   ← Chatbot widget (~950 lines, XSS-safe)
│   ├── Navbar.vue
│   ├── PortfolioCard.vue
│   └── PropertyFilter.vue
├── services/
│   ├── api.js               ← Axios instance (interceptors + token refresh)
│   ├── authApi.js           ← In-memory token management
│   ├── chatbotApi.js        ← POST /api/chatbot/message
│   ├── contactApi.js        ← POST /api/contact
│   ├── facilityApi.js       ← Facility CRUD (/api/facility/*)
│   ├── profileApi.js        ← GET/PUT /api/profile/*
│   ├── aboutApi.js          ← GET /api/about
│   └── rumah123Api.js       ← GET /api/rumah123/search
└── router/
    └── index.js             ← Vue Router with meta-based auth guards
```

## Router Guards (`frontend/src/router/index.js`)

```javascript
{ meta: { requiresAuth: true } }   // → redirect to /login if not authenticated
{ meta: { requiresGuest: true } }  // → redirect logged-in users away from login/register
// No meta = public (all users)
```

| Route | Path | Meta | Access |
|---|---|---|---|
| Home | / | none | public |
| About | /about | none | public |
| Contact | /contact | none | public |
| Rumah123 | /rumah123 | none | public |
| Login | /login | requiresGuest | guests only |
| Register | /register | requiresGuest | guests only |
| Profile | /profile | requiresAuth | logged-in only |
| Facility List | /facility | requiresAuth | logged-in only |
| Facility Master | /facility/master | requiresAuth | logged-in only |

## Authentication

### authApi.js — Token Management
- `getCachedToken()` — in-memory first, localStorage fallback (for page reload)
- `setCachedToken(token)` — stores in memory (more XSS-safe than pure localStorage)
- `clearCachedToken()` — removes from memory

### api.js — Axios Instance
- `baseURL: /api` → Vite proxy → `http://localhost:5005/api`
- **Request interceptor**: injects `Authorization: Bearer <token>` automatically
- **Response interceptor**: on 401 → calls `GET /api/auth/refresh` → retries original request with new token

## FloatingChatbot.vue

### Cookie-Based Profile
- Reads profile from cookie `chatbot_profile` (set on first use)
- Profile required before chatting: name, phone, location
- Session ID stored in cookie with TTL from `/api/chatbot/config`

### XSS Safety
- `MessageFormatter.escapeHtml()` runs FIRST before any markdown transforms
- Renders `![alt](url)` → `<img>` (http/https only)
- Renders `[label](url)` → `<a>` (http/https only)

### Property Data
- Loads from `frontend/public/json_data/indonesia_property_36_provinces_flat.json`
- Sends as `propertyContext` in POST /api/chatbot/message

## Facility Module

### FacilityListView.vue
- Read-only list of active facilities
- Calls `GET /api/facility/list` via `facilityApi.js`
- Groups by category

### FacilityMasterView.vue
- CRUD admin UI for facility master data
- Create: `POST /api/facility/insert`
- Update: `PUT /api/facility/update/:facility_id`
- Toggle status: `PATCH /api/facility/toggle-status/:facility_id`
- Delete: `DELETE /api/facility/delete/:facility_id`
- Category filter: `GET /api/facility/categories`

### facilityApi.js
All calls include `Authorization` header via `api.js` interceptor.

## Build / Deploy

```bash
# Dev server (hot reload)
npm run dev        # starts on port 5173

# Production build (outputs to frontend/dist/)
npm run build
```

For production, configure nginx/caddy to:
- Serve `frontend/dist/` as static files
- Proxy `/api/*` to `http://localhost:5005/api/*`

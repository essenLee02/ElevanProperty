# 07. Frontend Architecture & All Page Modules

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
│   ├── LoginView.vue         ← Login form
│   ├── RegisterView.vue      ← Register form
│   └── ProfileView.vue       ← User profile (requires auth)
├── components/
│   ├── FloatingChatbot.vue   ← Main chatbot widget (~950 lines)
│   ├── Navbar.vue            ← Navigation bar
│   ├── PortfolioCard.vue     ← Property card component
│   └── PropertyFilter.vue   ← Property search filter
├── services/
│   ├── api.js                ← Axios instance with interceptors
│   ├── authApi.js            ← Token memory management
│   ├── profileApi.js         ← Profile get/update API calls
│   └── chatbotApi.js         ← Chatbot API calls
└── router/
    └── index.js              ← Vue Router with auth guards
```

---

## Module Status

| Module | Vue File | Controller | Status |
|---|---|---|---|
| Home | `HomeView.vue` | `homeController.js` | ✅ Live |
| About | `AboutView.vue` | `aboutController.js` | ✅ Live |
| Contact | `ContactView.vue` | `contactController.js` | ✅ Live |
| Chatbot | `FloatingChatbot.vue` | `chatbotController.js` | ✅ Live |
| Rumah123 | `Rumah123View.vue` | `rumah123Controller.js` | ✅ Live |
| Auth (Login/Register) | `LoginView`, `RegisterView` | `loginController`, `registerController` | ✅ Live |
| Profile | `ProfileView.vue` | `profileController.js` | ✅ Live |
| WhatsApp Chat | *(terminal only, no UI)* | `fonnteChatController` / `chakraHQController` / `timelinesAIChatController` | ✅ |

---

## Router Guards (`frontend/src/router/index.js`)

```javascript
{ meta: { requiresAuth: true } }   // → redirect to /login if not authenticated
{ meta: { requiresGuest: true } }  // → redirect logged-in users to /profile
// No meta = public
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

Auth state checked via `GET /api/auth/me` on app load.

---

## Authentication Frontend

### authApi.js
- `getCachedToken()` — from memory (falls back to localStorage on reload)
- `setCachedToken(token)` — memory-only (more XSS-safe)
- `clearCachedToken()` — removes from memory

### api.js (Axios instance)
- `baseURL: /api` → proxied to `http://localhost:5005/api` by Vite
- **Request interceptor**: adds `Authorization: Bearer <token>` header
- **Response interceptor**: on 401 → calls `GET /api/auth/refresh` → retries original request

---

## Module: Home (`HomeView.vue`)

`frontend/src/views/HomeView.vue` — main landing page. Public.

### Sections
- Hero section with property search CTA and "Chat with AI" button
- Featured property listings
- "How It Works" steps
- `<FloatingChatbot />` component (bottom-right, always visible)

**Note:** No backend API call for page content — static layout. Property catalog loaded by FloatingChatbot on first chat.

---

## Module: About (`AboutView.vue`)

`frontend/src/views/AboutView.vue` — static page, public.

Backend route: `GET /api/about` → `aboutController.index`

Content: company description, team info, property highlights.

---

## Module: Contact (`ContactView.vue`)

`frontend/src/views/ContactView.vue` — contact form. Public.
Rate limit: **5 submissions per IP per 15 minutes**.

### Form Fields
- `name` (required)
- `phone` (required) — customer's WhatsApp number, 10–15 digits
- `email` (required)
- `subject` (required)
- `message` (required)

### Submission Flow (`POST /api/contact`)

```
Frontend → POST /api/contact { name, phone, email, subject, message }
     ↓
ContactController.submitContact():
  a. validateContactForm()
  b. Contact.create()                          ← save to MySQL contacts table
  c. appendContactRow() [NON-BLOCKING]         ← Google Sheets (silent fail)
  d. generateContactReplyWithProviderFallback() ← ChatGPT → Claude → Private
  e. sendWhatsAppMessage(phone, aiReply)        ← Fonnte API
  f. findOrCreateSession + save messages       ← chat_sessions + chat_messages
     ↓
Response: 200 OK even if AI/Fonnte fails
```

> **Fonnte** is used ONLY here for contact form — NOT in watiChatController.

### Rate Limit Error
Returns 429: `"Terlalu banyak pengiriman. Coba lagi dalam 15 menit."`

### Controller Methods
| Method | Route | Description |
|---|---|---|
| `submitContact(req, res)` | POST /api/contact | main handler |
| `googleSheetsStatus(req, res)` | GET /api/contact/google-sheets-status | check Sheets connection |
| `aiWhatsappStatus(req, res)` | GET /api/contact/ai-whatsapp-status | check AI + Fonnte config |

---

## Module: Chatbot (`FloatingChatbot.vue`)

`frontend/src/components/FloatingChatbot.vue` (~950 lines)

Bottom-right floating chat widget. Visible on all pages (included in HomeView). Public — no login required.

### User Profile (cookie: `chatbot_profile`)
Before first message, user fills:
- `name` (required)
- `phone` (required)
- `location` (required)

Stored in a persistent cookie. Restored on page reload.

### Session Cookie
Session ID stored in cookie with TTL from `GET /api/chatbot/config`:
- Default: 90 minutes (`CHATBOT_COOKIE_TTL_MINUTES`)
- Expired → new session starts

### Returning Customer Recognition
`sessionService.findOrCreateSession()` normalizes name/phone/location to recognize returning customers even with typos.

### First Message — Property Context
On the first message of a new session:
1. Fetches `/json_data/indonesia_property_36_provinces_flat.json`
   - Dev mode: Vite proxy → `localhost:5005/json_data/` → `backend/asset/json_data/`
   - File **TIDAK lagi** di `frontend/public/json_data/` (migrasi Juni 2026)
2. Sends it as `propertyContext` in POST body

Backend uses this + live Rumah123 data for full property-aware AI prompt.

### Message Rendering (XSS-Safe)

```javascript
class MessageFormatter {
  static #escapeHtml(text) {
    // HTML-escape FIRST to prevent XSS injection
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;') /* ... */;
  }
  static toHtml(text) {
    const escaped = MessageFormatter.#escapeHtml(text);
    // Then convert: **bold**, *italic*, `code`, - lists → safe HTML
    return escaped;
  }
}
```

### API Call

```javascript
POST /api/chatbot/message
Body: {
  name: "string",
  phone: "string",
  location: "string",
  message: "string",
  propertyContext: { ... }   // first message only; null on subsequent
}

Response: {
  success: true,
  reply: "string",
  sessionId: number,
  aiProvider: "chatgpt" | "claude" | "private_agent",
  fallbackUsed: boolean,
  exactMatches: number,
  alternatives: number
}
```

### Controller Methods
| Method | Route | Description |
|---|---|---|
| `sendMessage(req, res)` | POST /api/chatbot/message | main handler |
| `getConfig(_req, res)` | GET /api/chatbot/config | cookie TTL + required fields |
| `aiProviderStatus(_req, res)` | GET /api/chatbot/ai-provider-status | AI config check |
| `skillStatus(_req, res)` | GET /api/chatbot/skill-status | skill files check |

---

## Module: Profile (`ProfileView.vue`)

`frontend/src/views/ProfileView.vue` — halaman profil agent. Requires auth.

### Form Layout

```
┌─────────────────────────────────────────┐
│ User ID         [disabled, read-only]   │
│                                         │
│ Nama Lengkap *  [editable]              │
│ Nomor HP *      [editable]              │
│ Tanggal Lahir   [editable]              │
│                                         │
│ ── Keamanan & Integrasi ──              │
│                                         │
│ Username 🔒     [disabled, read-only]  │
│ Password *      [editable, show/hide 👁️]│
│ Fonnte API      [editable, opsional]    │
└─────────────────────────────────────────┘
```

### Field Rules

| Field | Wajib | Keterangan |
|---|---|---|
| Nama Lengkap | ✅ | |
| Nomor HP | ✅ | |
| Password | ✅ | Min 6 karakter, dikosongkan setelah save |
| Username | ❌ | Read-only, tidak bisa diubah, **tidak dikirim ke backend** |
| Fonnte API | ❌ | Token Fonnte pribadi agent, kirim `null` jika kosong |

### Payload ke Backend (`PUT /api/profile/update-agent`)

```json
{
  "name": "NIGEL KUNCORO",
  "phone": "082233556796",
  "birthdate": "1995-01-15",
  "password": "••••••",
  "fonnte_token": "abc123..." 
}
```

> `username` **TIDAK dikirim** ke backend.

---

## Module: Facility Master (`FacilityListView.vue` + `FacilityMasterView.vue`)

Halaman master fasilitas (AC, Kolam Renang, CCTV, dll). **Requires auth.**
Field master fasilitas: `name`, `description`, `icon`, `status` (1=aktif, 2=disabled,
3=deleted). **Tanpa** kolom kategori / urutan tampil (sudah dihapus).

| View | Fungsi |
|---|---|
| `FacilityListView.vue` | Daftar fasilitas status 1 & 2. Tabel + pagination dibangun lewat `window.tableModal()` / `loadModalPagination()` (Function_Path). Tombol: Edit → halaman update; Disable → toggle status 1↔2; Delete → soft-delete (status 3). |
| `FacilityMasterView.vue` | Form tambah/edit. Insert → `POST /api/facility/insert`; Update → `PUT /api/facility/update/:facility_id`. |

API (`facilityApi.js`, semua via interceptor `api.js`):
`GET /api/facility/list` · `GET /api/facility/detail/:id` · `POST /api/facility/insert`
· `PUT /api/facility/update/:id` · `PATCH /api/facility/toggle-status/:id`
· `DELETE /api/facility/delete/:id`.

**Anti-redundancy (server):** insert/update menolak nama duplikat *dan* sinonim
(mis. gym/gym club, cctv/kamera pengawas, kolam renang/swimming pool) via
normalisasi nama + `FACILITY_SYNONYM_GROUPS` di `facilityMasterController.js`.

---

## Global Vendor Assets (App.vue)

`src/App.vue` memuat SEKALI (semua view dapat akses, tanpa import ulang):
Bootstrap 5.3.8, jQuery 4.0.0, Font Awesome 7.2.0, dan **Function_Path**
(`tableModal`, `loadModalPagination`, `sendMessageBox`, `ajaxHit`) dari
`public/assets/`. List view baru cukup duplikat `FacilityListView` dan ganti
`TABLE_HEADERS`/`TABLE_CHUNKS`/`ACTION_*` + endpoint — markup tabel tak ditulis ulang.

---

## Build / Deploy

```bash
# Dev server (hot reload)
cd frontend && npm run dev

# Production build → outputs to frontend/dist/
cd frontend && npm run build
```

Vite config proxies:
- `/api` → `http://localhost:5005` (backend API)
- `/json_data` → `http://localhost:5005` (static JSON dari backend/asset/json_data/)

For production: configure nginx/caddy to proxy `/api` and `/json_data` to Node.js backend.

---

## Vite Proxy Config (Juni 2026)

```javascript
// frontend/vite.config.js
proxy: {
  '/json_data': {
    target: `http://localhost:${PORT || 5005}`,
    changeOrigin: true
  }
}
```

Backend `server.js`:
```javascript
app.use('/json_data', express.static(path.join(__dirname, 'asset/json_data')));
```

---

## Module: Terminal Message (WhatsApp Multi-Agent)

Terminal message **bukan halaman frontend** — ini adalah backend-only WhatsApp chat handler.
Tidak ada tampilan UI di website. Interaksi terjadi di WhatsApp customer ↔ agent.

> Dokumentasi lengkap: `docs/13-whatsapp-terminal-multiagent.md` dan `docs/14-private-agent-whatsapp-format.md`

### Ringkasan

| Controller | Platform | Endpoint | Status |
|---|---|---|---|
| `fonnteChatController.js` | Fonnte | `POST /api/fonnte-chat/webhook` | ✅ Working |
| `chakraHQController.js` | ChakraHQ | `POST /api/chakrahq/webhook` | ✅ Webhook ready |
| `timelinesAIChatController.js` | TimelinesAI | `POST /api/timelinesai/webhook` | ✅ |

### Alur Singkat

```
Customer kirim WA
    ↓
hasPropertyKeyword(message) → ATAU → isPropertyContextContinuation(message, history)
    ↓
whatsappAIService.generateWhatsAppAIReply()
    ↓ ChatGPT → Claude → Private Agent (ResponseBuilderWhatsApp)
Balas ke customer dengan property recommendations + agent footer
```

### MASSEGE_TERMINAL Control

```env
MASSEGE_TERMINAL=FONNTE                       # Hanya Fonnte log ke terminal
MASSEGE_TERMINAL=FONNTE,CHAKRAHQ,TIMELINESAI  # Semua platform aktif
```

### Context-Aware Continuation (Juni 2026)

Jawaban singkat customer setelah AI bertanya ("sewa atau beli?") sekarang dikenali
sebagai lanjutan percakapan properti, meskipun pesan tidak mengandung keyword properti.

```
AI     : "Untuk Gudang — rencananya sewa atau beli?"
Customer: "saya beli"   ← hasPropertyKeyword=false, tapi isPropertyContextContinuation=true
→ Sistem tetap membalas ✅
```

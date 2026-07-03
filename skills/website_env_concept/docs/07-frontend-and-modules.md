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
│   ├── AboutView.vue         ← About page (DB-driven via GET /api/about)
│   ├── ContactView.vue       ← Contact form with AI WhatsApp reply
│   ├── Rumah123View.vue      ← Live property search (Apify)
│   ├── LoginView.vue         ← Login form
│   ├── RegisterView.vue      ← Register form
│   ├── ProfileView.vue       ← User profile (requires auth)
│   ├── Facility/
│   │   ├── FacilityListView.vue    ← Master fasilitas — list (requires auth)
│   │   └── FacilityMasterView.vue  ← Master fasilitas — form tambah/edit (requires auth)
│   ├── Country/
│   │   ├── CountryListView.vue     ← Master negara — list (requires auth)
│   │   └── CountryMasterView.vue   ← Master negara — form tambah/edit (requires auth)
│   ├── Province/
│   │   ├── ProvinceListView.vue    ← Master provinsi — list (requires auth)
│   │   └── ProvinceMasterView.vue  ← Master provinsi — form tambah/edit (requires auth)
│   ├── City/
│   │   ├── CityListView.vue        ← Master kota — list (requires auth)
│   │   └── CityMasterView.vue      ← Master kota — form tambah/edit (requires auth)
│   ├── Location/
│   │   ├── LocationListView.vue    ← Master lokasi/landmark — list (requires auth)
│   │   └── LocationMasterView.vue  ← Master lokasi/landmark — form tambah/edit (requires auth)
│   └── Property/
│       ├── PropertyListView.vue    ← Master properti — list (requires auth)
│       └── PropertyMasterView.vue  ← Master properti — form tambah/edit (requires auth)
├── components/
│   ├── FloatingChatbot.vue   ← Main chatbot widget (XSS-safe, tanpa fetch JSON)
│   ├── Navbar.vue            ← Navigation bar
│   ├── PortfolioCard.vue     ← Property card component
│   └── PropertyFilter.vue   ← Property search filter
├── services/
│   ├── api.js                ← Axios instance (baseURL absolut, interceptors)
│   ├── authApi.js            ← Token memory management
│   ├── profileApi.js         ← Profile get/update API calls
│   ├── chatbotApi.js         ← Chatbot API calls
│   ├── aboutApi.js / contactApi.js / rumah123Api.js
│   ├── facilityApi.js / countryApi.js / provinceApi.js / cityApi.js
│   ├── locationApi.js / propertyApi.js / propertyLocationApi.js
│   └── (semua master data pakai pola CRUD yang sama: list/detail/insert/update/toggle-status/delete)
└── router/
    └── index.js              ← Vue Router with auth guards
```

---

## Module Status

| Module | Vue File | Controller | Access | Status |
|---|---|---|---|---|
| Home | `HomeView.vue` | `homeController.js` | public | ✅ Live |
| About | `AboutView.vue` | `aboutController.js` | public | ✅ Live |
| Contact | `ContactView.vue` | `contactController.js` | public | ✅ Live |
| Chatbot | `FloatingChatbot.vue` | `chatbotController.js` | public | ✅ Live |
| Rumah123 | `Rumah123View.vue` | `rumah123Controller.js` | public | ✅ Live |
| Auth (Login/Register) | `LoginView`, `RegisterView` | `loginController`, `registerController` | guest only | ✅ Live |
| Profile | `ProfileView.vue` | `profileController.js` | **auth** | ✅ Live |
| **Master Fasilitas** | `Facility/FacilityListView.vue` + `FacilityMasterView.vue` | `facilityMasterController.js` | **auth** | ✅ Live |
| **Master Negara** | `Country/CountryListView.vue` + `CountryMasterView.vue` | `countryMasterController.js` | **auth** | ✅ Live |
| **Master Provinsi** | `Province/ProvinceListView.vue` + `ProvinceMasterView.vue` | `provinceMasterController.js` | **auth** | ✅ Live |
| **Master Kota** | `City/CityListView.vue` + `CityMasterView.vue` | `cityMasterController.js` | **auth** | ✅ Live |
| **Master Lokasi** | `Location/LocationListView.vue` + `LocationMasterView.vue` | `locationMasterController.js` | **auth** | ✅ Live |
| **Master Properti** | `Property/PropertyListView.vue` + `PropertyMasterView.vue` | `propertyMasterController.js` | **auth** | ✅ Live |
| WhatsApp Chat | *(terminal only, no UI)* | `fonnteChatController` / `kirimiChatController` / `timelinesAIChatController` | — | ✅ |

---

## Router Guards (`frontend/src/router/index.js`)

```javascript
{ meta: { layout: 'auth', requiresAuth: true } }   // → redirect to /login if not authenticated
{ meta: { layout: 'auth', requiresGuest: true } }  // → redirect logged-in users to /
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
| /facility, /facility/add, /facility/edit/:facility_id | requiresAuth | logged-in only |
| /country, /country/add, /country/edit/:country_id | requiresAuth | logged-in only |
| /province, /province/add, /province/edit/:province_id | requiresAuth | logged-in only |
| /city, /city/add, /city/edit/:city_id | requiresAuth | logged-in only |
| /location, /location/add, /location/edit/:location_id | requiresAuth | logged-in only |
| /property, /property/add, /property/edit/:property_id | requiresAuth | logged-in only |

> **Semua modul master (Fasilitas/Negara/Provinsi/Kota/Lokasi/Properti) wajib login**
> — pola route seragam: `/{module}` (list), `/{module}/add` (create), `/{module}/edit/:id` (update).

Auth state checked via `GET /api/auth/me` on app load.

---

## Authentication Frontend

### authApi.js
- `getCachedToken()` — from memory (falls back to localStorage on reload)
- `setCachedToken(token)` — memory-only (more XSS-safe)
- `clearCachedToken()` — removes from memory

### api.js (Axios instance)
- `baseURL` = `${VITE_BACKEND_URL}:${VITE_BACKEND_PORT}/api` = `http://localhost:5055/api`
  (absolute — bukan proxy Vite; `VITE_BACKEND_PORT` harus **5055**, dulu keliru 5005)
- **Request interceptor**: adds `Authorization: Bearer <token>` header
- **Response interceptor**: on 401 → single-flight `GET /api/auth/refresh` → retry original request

---

## Module: Home (`HomeView.vue`)

`frontend/src/views/HomeView.vue` — main landing page. Public.

### Sections
- Hero section with property search CTA and "Chat with AI" button
- Featured property listings
- "How It Works" steps
- `<FloatingChatbot />` component (bottom-right, always visible)

**Note:** Layout statis. Frontend **tidak** lagi memuat katalog JSON — semua data
properti berasal dari backend (database).

---

## Module: About (`AboutView.vue`)

`frontend/src/views/AboutView.vue` — public.

Backend route: `GET /api/about` → `aboutController.index`

Portfolio **diambil dari backend** via `api.get('/about')` → `data.portfolios`
(DB-first: model Property + relasi; fallback JSON `extended_v3`). Frontend **tidak lagi**
`fetch('/json_data/...')`. Kartu dirender `PortfolioCard` + filter client-side
(`PropertyFilter`). Ini adalah salah satu trigger pemuatan `PropertyRecommendationService`.

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
  d. generateContactReplyWithProviderFallback() ← primary AI → Private Agent
  e. sendWhatsAppMessage(phone, aiReply)        ← Fonnte API
  f. findOrCreateSession + save messages       ← chat_sessions + chat_messages
     ↓
Response: 200 OK even if AI/Fonnte fails
```

> **Fonnte** dipakai di sini untuk notifikasi contact form (terpisah dari terminal
> WhatsApp multi-agent Fonnte/Kirimi/TimelinesAI).

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

### Property Context — dibangun BACKEND (bukan frontend)
FloatingChatbot **tidak** lagi memuat JSON atau mengirim `propertyContext`. Widget
hanya mengirim `{ name, phone, location, message }`. Backend (`chatbotController.sendMessage`)
membangun konteks katalog sendiri via `buildRecommendationContextForLLM` (DB-first) +
opsional Rumah123. ~150 baris scoring client-side (loadPropertyContextSample dsb.) sudah dihapus.

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
  message: "string"
  // TIDAK ada propertyContext — backend membangun konteks dari database
}

Response: {
  success: true,
  reply: "string",
  sessionId: number,
  aiProvider: "deepseek" | "qwen" | "chatgpt" | "claude" | "private_agent",
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

## Master Data Modules — pola seragam (6 modul, SEMUA requires auth)

Facility, Country, Province, City, Location, dan Property memakai **pola CRUD
identik**: satu `*ListView.vue` (daftar + status) + satu `*MasterView.vue`
(form tambah/edit dipakai bersama, dibedakan lewat parameter route `:id`).
Tabel + pagination dibangun lewat `window.tableModal()` / `loadModalPagination()`
(Function_Path, di-load global lewat `App.vue` — lihat "Global Vendor Assets"
di bawah). Tombol standar: Edit → halaman update; Disable → toggle status 1↔2;
Delete → soft-delete (status 3).

| Modul | List View | Master View (form) | Controller | Base route |
|---|---|---|---|---|
| Fasilitas | `Facility/FacilityListView.vue` | `Facility/FacilityMasterView.vue` | `facilityMasterController.js` | `/api/facility` |
| Negara | `Country/CountryListView.vue` | `Country/CountryMasterView.vue` | `countryMasterController.js` | `/api/country` |
| Provinsi | `Province/ProvinceListView.vue` | `Province/ProvinceMasterView.vue` | `provinceMasterController.js` | `/api/province` |
| Kota | `City/CityListView.vue` | `City/CityMasterView.vue` | `cityMasterController.js` | `/api/city` |
| Lokasi | `Location/LocationListView.vue` | `Location/LocationMasterView.vue` | `locationMasterController.js` | `/api/location` |
| Properti | `Property/PropertyListView.vue` | `Property/PropertyMasterView.vue` | `propertyMasterController.js` | `/api/property` |

**API pattern (identik tiap modul, semua `verifyToken`):**
```
GET    /api/{module}/list                  ← daftar (status 1 & 2)
GET    /api/{module}/detail/:id
POST   /api/{module}/insert
PUT    /api/{module}/update/:id
PATCH  /api/{module}/toggle-status/:id     ← toggle 1↔2
DELETE /api/{module}/delete/:id             ← soft-delete (status 3)
```
Country & Province juga punya `GET /api/{module}/options` (dropdown ringkas
untuk form Province/City). Property punya tambahan sub-resource
`/api/property/:property_id/locations` (landmark terdekat, lihat
`propertyLocationController.js`).

### Detail: Fasilitas

Field: `name`, `description`, `icon`, `status` (1=aktif, 2=disabled, 3=deleted).
**Tanpa** kolom kategori / urutan tampil (sudah dihapus).

**Anti-redundancy (server):** insert/update menolak nama duplikat *dan* sinonim
(mis. gym/gym club, cctv/kamera pengawas, kolam renang/swimming pool) via
normalisasi nama + `FACILITY_SYNONYM_GROUPS` di `facilityMasterController.js`.

### Detail: Negara → Provinsi → Kota (region hierarchy)

Mengikuti hierarki `Country.hasMany(Province)` → `Province.hasMany(City)`
(lihat doc 03). Form Provinsi memakai `GET /api/country/options` untuk
dropdown negara; form Kota memakai `GET /api/province/options` untuk dropdown
provinsi.

### Detail: Lokasi

Landmark/anchor (mall, sekolah, rumah sakit, dll.) yang dipakai sebagai titik
patokan properti (Q6 di Q1–Q12) dan dihubungkan ke property lewat
`property_locations` (many-to-many, lihat doc 03).

### Detail: Properti

Form terbesar — field header (title, price, address, building_type,
transaction_type, bed/bath rooms, building/land area, dst.) plus relasi
gambar (`PropertyImage`) dan fasilitas (`PropertyFacility`). Data yang
ditampilkan di sini adalah **sumber utama** yang dipakai
`propertyRecommendationService.js` (lihat doc 12) untuk katalog AI chatbot/WA.

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

Frontend memanggil backend lewat `api.js` (absolute `http://localhost:5055/api`).
Proxy `/json_data` **dihapus** dari `vite.config.js` — frontend tak fetch JSON lagi.

For production: konfigurasi nginx/caddy proxy `/api` ke Node.js backend.

---

## Vite Config (sekarang)

```javascript
// frontend/vite.config.js — TIDAK ada proxy /json_data lagi
server: { host, port: 5173, strictPort, open }
```

Backend `server.js` masih menyediakan `app.use('/json_data', express.static(...))`
(opsional/kompat), tetapi frontend tidak memakainya — data lewat API.

---

## Module: Terminal Message (WhatsApp Multi-Agent)

Terminal message **bukan halaman frontend** — ini adalah backend-only WhatsApp chat handler.
Tidak ada tampilan UI di website. Interaksi terjadi di WhatsApp customer ↔ agent.

> Dokumentasi lengkap: `docs/13-whatsapp-terminal-multiagent.md` dan `docs/14-private-agent-whatsapp-format.md`

### Ringkasan

| Controller | Platform | Endpoint | Status |
|---|---|---|---|
| `fonnteChatController.js` | Fonnte | `POST /api/fonnte-chat/webhook` | ✅ |
| `kirimiChatController.js` | Kirimi | `POST /api/kirimi/webhook` | ✅ |
| `timelinesAIChatController.js` | TimelinesAI | `POST /api/timelinesai/webhook` | ✅ |

### Alur Singkat

```
Customer kirim WA
    ↓
hasPropertyKeyword(message) → ATAU → isPropertyContextContinuation(message, history)
    ↓
whatsappAIService.generateWhatsAppAIReply()
    ↓ Primary AI (deepseek/qwen/claude/chatgpt) → Private Agent (ResponseBuilderWhatsApp)
Balas ke customer dengan property recommendations + agent footer
```

### MESSAGE_TERMINAL vs MASSEGE_TERMINAL

```env
MESSAGE_TERMINAL=KIRIMI                        # sumber metadata `source` di log AI
MASSEGE_TERMINAL=FONNTE,KIRIMI,TIMELINESAI     # platform mana yang di-render di terminal
```

### Context-Aware Continuation (Juni 2026)

Jawaban singkat customer setelah AI bertanya ("sewa atau beli?") sekarang dikenali
sebagai lanjutan percakapan properti, meskipun pesan tidak mengandung keyword properti.

```
AI     : "Untuk Gudang — rencananya sewa atau beli?"
Customer: "saya beli"   ← hasPropertyKeyword=false, tapi isPropertyContextContinuation=true
→ Sistem tetap membalas ✅
```

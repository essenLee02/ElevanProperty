# 03. Database Design & Models

Database: `db_property` (MySQL / MariaDB 10.4)
ORM: **Sequelize v6** (`backend/models/`) — upgrade dari v3 (fix vuln lodash/validator/dottie)
Sync strategy: `sequelize.sync()` on server start + `ensureRequiredDatabaseColumns()`
untuk kolom tambahan yang tidak otomatis ter-`alter` (`logs.level`,
`chat_sessions.location`, `chat_sessions.normalizedLocation`, `users.email`,
`users.catalog_summary` — BARU).

**Data properti (salinan `indonesia_property_extended_v3.json`):** properties 8831,
property_images 8831, property_facilities 56891, property_locations 23022,
facilities 274, locations 210, cities 649, provinces 52.

## Tables

### users
Stores registered agents (login system).

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | auto-increment |
| user_id | VARCHAR(50) | generated: prefix nama + random alphanumeric + (count+1), UNIQUE |
| name | VARCHAR | stored UPPERCASE |
| birthdate | DATEONLY | nullable |
| phone | VARCHAR(30) | nullable, INDEX |
| username | VARCHAR | unique |
| password | VARCHAR | bcrypt hash |
| email | VARCHAR(200) | nullable — alamat email agent (BARU) |
| catalog_summary | VARCHAR(5) | `ON`/`OFF`, nullable, default null di model tapi di-set `'OFF'` otomatis saat register (BARU) — kontrol tampilan katalog di summary, terkait `RESPOND_CATALOG_RUN` |
| refresh_token | TEXT | current JWT refresh token (null = logged out) |
| status | INTEGER(1) | 1=aktif, 2=blocked, 3=delete, default 1, INDEX |
| privilege | VARCHAR(50) | nullable, INDEX(privilege,status) composite |
| fonnte_token | VARCHAR(100) | Fonnte token per-agent (nullable) |
| kirimi_device_id | VARCHAR(50) | Kirimi device_id per-agent (mis. `D-3OCA6`), nullable |
| created_date, created_by | DATE/VARCHAR(50) | nullable audit |
| updated_date, update_by | DATE/VARCHAR(50) | nullable audit (kolom bernama `update_by`, bukan `updated_by`) |

**Indexes:** `user_id`, `username`, `status`, `(privilege, status)`, `phone`
**timestamps:** false (pakai `created_date`/`updated_date` custom, bukan Sequelize `createdAt`/`updatedAt`)

> Token WhatsApp per-agent: **Fonnte** → `fonnte_token`; **Kirimi** → `kirimi_device_id`
> (kredensial akun `KIRIMI_USER_CODE`/`KIRIMI_SECRET` di `.env`, device per-agent di DB).
> Diisi agent via halaman `/profile` atau direct SQL. Kolom legacy 360dialog/WATI
> **sudah tidak ada** di model — dihapus dari schema (bukan sekadar tidak dipakai).

---

### chat_sessions
One row per unique customer conversation context.

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| name | VARCHAR | customer name (as entered) |
| normalizedName | VARCHAR | lowercase, no extra spaces (for matching) |
| phone | VARCHAR | customer phone (as entered) |
| normalizedPhone | VARCHAR | 628xxx format, INDEX |
| location | VARCHAR | nullable |
| normalizedLocation | VARCHAR | lowercase, INDEX, nullable |
| source | VARCHAR | default `website_chatbot`; format `[channel]_[agent_name]` |
| lastMessageAt | DATETIME | timestamp of last message, nullable |
| createdAt, updatedAt | DATETIME | Sequelize auto |

> **Source format:** `[channel]_[agent_name]`
> - Website chatbot: `website_chatbot`
> - Contact form: `contact_form`
> - Fonnte agent: `fonnte_leo_felix`
> - Kirimi agent: `kirimi_leo_felix`
> - TimelinesAI agent: `timelinesai_leo_felix`

---

### chat_messages
All messages for each session.

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| chatSessionId | INT | FK → chat_sessions.id |
| user_id | VARCHAR(50) | nullable — FK informasional ke `users.user_id` (agent WhatsApp yang menangani chat; null untuk chat tanpa agent, mis. website chatbot publik) |
| role | VARCHAR(50) | `customer` (incoming) or `ai` (AI reply) |
| message | TEXT | message text |
| channel | VARCHAR(50) | default `website_chatbot`; nilai lain: `whatsapp`, `private_agent`, dll. |
| metadata | TEXT (JSON) | AI provider info, filters, match counts |
| createdAt, updatedAt | DATETIME | |

> ⚠️ Field names: `chatSessionId` (camelCase), `message` (not `content`), `channel` (not `source`)
> Role values: `customer` (not `user`) and `ai` (not `assistant`)

> **Security — redaction hook:** `beforeSave`/`beforeBulkCreate` menjalankan
> `redactSecrets()` (`backend/utils/secretRedactor.js`) pada `message` dan `metadata`
> sebelum disimpan. Lapisan terakhir yang menjamin API key/token tidak pernah
> tersimpan ke DB, terlepas dari jalur penyimpanan (controller WhatsApp mana pun,
> `sessionService`, dll).

---

### contacts
Contact form submissions.

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| name | VARCHAR | |
| email | VARCHAR | |
| phone | VARCHAR | |
| subject | VARCHAR | |
| message | TEXT | |
| createdAt, updatedAt | DATETIME | |

---

### whatsapp_inbound_messages — ORPHAN TABLE (model+controller dihapus Juli 2026)
Legacy table — messages captured from agent WA numbers via Fonnte webhook (old approach).
Model (`WhatsAppInbound.js`) dan controller (`whatsappInboundController.js`) sudah
dihapus dari codebase (tidak ada frontend/kode internal yang memakainya). Tabel
fisik ini SENGAJA dibiarkan di database (bukan destructive drop) — bila memang
tidak ada kebutuhan histori, boleh di-drop manual.

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| agentName | VARCHAR | e.g. `Clarence`, INDEX |
| agentPhone | VARCHAR | agent WA number (as received) |
| agentPhoneNormalized | VARCHAR | e.g. `6282111367154`, INDEX |
| senderName | VARCHAR | customer display name, nullable |
| senderPhone | VARCHAR | customer phone, nullable |
| senderPhoneNormalized | VARCHAR | nullable, INDEX |
| message | TEXT | |
| mediaType, mediaUrl | VARCHAR/TEXT | nullable |
| deviceId | VARCHAR | Fonnte device ID, nullable |
| timestamp | VARCHAR | from Fonnte payload, nullable |
| rawPayload | TEXT | full JSON from webhook, nullable |
| status | VARCHAR | default `received`, INDEX |
| createdAt, updatedAt | DATETIME | createdAt juga di-index |

> New multi-agent Fonnte/Kirimi/TimelinesAI flow uses `chat_sessions` + `chat_messages`
> via masing-masing controller — **bukan** tabel ini.

---

### logs
Frontend navigation and action logging.

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| action | VARCHAR | e.g. `PAGE_VIEW` |
| details | TEXT | nullable |
| level | VARCHAR | default `info` — kolom tambahan via `ensureRequiredDatabaseColumns()` |
| username | VARCHAR | nullable |
| user_id | VARCHAR | nullable |
| createdAt, updatedAt | DATETIME | Sequelize auto |

---

### facilities
Master data for property facilities (AC, pool, CCTV, parking, etc.).

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| facility_id | VARCHAR(30) | Generated: name prefix + random alphanumeric + 3-digit count, UNIQUE |
| name | VARCHAR(100) | e.g. "AC", "Kolam Renang", "CCTV", UNIQUE |
| description | VARCHAR(255) | nullable |
| icon | VARCHAR(50) | emoji or CSS class (e.g. 🏊, fa-wifi), nullable |
| status | INTEGER(1) | 1=aktif, 2=disabled, 3=deleted (soft delete) |
| created_date | DATEONLY | |
| created_by | VARCHAR(50) | FK → users.user_id |
| updated_date | DATEONLY | nullable |
| updated_by | VARCHAR(50) | FK → users.user_id, nullable |

**Indexes:** `facility_id`, `status`, `name`
**timestamps:** false

> ⚠️ **Tanpa kolom `category` / `sort_order`** — sudah dihapus dari model.
> Jangan tambahkan kembali di form/tabel frontend kecuali skema di-migrate ulang.

**Anti-redundancy (server):** insert/update di `facilityMasterController.js` menolak
nama duplikat *dan* sinonim (mis. gym/gym club, cctv/kamera pengawas, kolam
renang/swimming pool) via normalisasi nama + `FACILITY_SYNONYM_GROUPS`.

---

### countries / provinces / cities — region hierarchy

Semua tiga model memakai pola field yang identik (mengikuti referensi PHP
lama, **tanpa kolom `code`**), berbeda hanya pada FK region induk.

| Column | countries | provinces | cities | Notes |
|---|---|---|---|---|
| id | ✅ INT AI PK | ✅ | ✅ | |
| {region}_id | `country_id` VARCHAR(30) UNIQUE | `province_id` VARCHAR(30) UNIQUE | `city_id` VARCHAR(30) UNIQUE | Generated: prefix nama + random alphanumeric + count 3-digit |
| country_id (FK) | — | ✅ FK → countries.country_id | ✅ FK → countries.country_id | informasional, `constraints:false` |
| province_id (FK) | — | — | ✅ FK → provinces.province_id | informasional, `constraints:false` |
| name | VARCHAR(100) UNIQUE | VARCHAR(100) UNIQUE | VARCHAR(100) UNIQUE | mis. "Indonesia" / "Jawa Timur" / "Surabaya" |
| status | INTEGER(1), default 1 | sama | sama | 1=aktif, 2=disabled, 3=deleted |
| created_date, created_by | DATEONLY / VARCHAR(50) | sama | sama | required |
| updated_date, updated_by | DATEONLY / VARCHAR(50) | sama | sama | nullable |

**Indexes:** masing-masing di-index pada `{region}_id`, `status`, `name`
(+ `country_id`/`province_id` FK untuk provinces/cities). **timestamps:** false.

**Hierarki:** `Country.hasMany(Province)` → `Province.hasMany(City)` — semua
association `constraints:false` (informasional, tanpa cascade enforced di DB).
Form Provinsi memakai `GET /api/country/options`; form Kota memakai
`GET /api/province/options` (dropdown ringkas).

---

### locations
Master data lokasi rujukan/landmark (Pasar, PTC, Café, Kebun Binatang,
Indomaret, Stasiun, dll.) — dipakai sebagai titik patokan properti
(Q6 di alur Q1–Q12) via tabel pivot `property_locations`.

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| location_id | VARCHAR(50) | Generated: prefix nama + random alphanumeric + count 3-digit, UNIQUE |
| name | VARCHAR(100) | mis. "Pasar Besar", "Kebun Binatang", "Indomaret", UNIQUE |
| status | INTEGER(1) | 1=aktif, 2=disabled, 3=deleted (soft delete) |
| created_date | DATEONLY | |
| created_by | VARCHAR(50) | FK → users.user_id |
| updated_date | DATEONLY | nullable |
| updated_by | VARCHAR(50) | FK → users.user_id, nullable |

**Indexes:** `location_id`, `status`, `name`. **timestamps:** false.

---

### Property catalog (master) — salinan `indonesia_property_extended_v3.json`

Header + detail, saling berelasi via `property_id`.

#### properties (HEADER)

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| property_id | VARCHAR(50) | UNIQUE — generated: prefix nama + random alphanumeric + count 3-digit |
| city_id | VARCHAR(50) | FK informasional → cities.city_id |
| province_id | VARCHAR(50) | FK informasional → provinces.province_id |
| country_id | VARCHAR(50) | FK informasional → countries.country_id |
| title | VARCHAR(100) | mis. "Rumah 2 Lantai Citraland Surabaya" |
| description | TEXT | nullable |
| price | DECIMAL(25,4) | nullable |
| price_type | VARCHAR(20) | nullable — Night/Daily/Weekly/Monthly/Yearly/Cash/Negotiable/Others |
| address | VARCHAR(255) | nullable |
| area | VARCHAR(255) | nullable — kawasan, mis. "Citraland" |
| district | VARCHAR(255) | nullable — kecamatan |
| postal_code | VARCHAR(15) | nullable |
| furnished_status | VARCHAR(20) | nullable — Full furnished/Semi-furnished/Unfurnished |
| bed_rooms | INTEGER | nullable, default 0 |
| bath_rooms | INTEGER | nullable, default 0 |
| electricity_capacity | INTEGER | nullable — kapasitas watt |
| building_area | VARCHAR(100) | nullable, mis. "120 m2" |
| land_area | VARCHAR(100) | nullable, mis. "150 m2" |
| floor_location | VARCHAR(100) | nullable — umumnya apartment/hotel/office/condo/kos |
| floor_quantity | INTEGER(4) | nullable — umumnya rumah/villa/gudang |
| kpr_status | VARCHAR(1) | Y/N, default `N` (tipe sewa tidak bisa KPR) |
| building_type | VARCHAR(50) | house/apartment/hotel/villa/boarding_house/shophouse/office/warehouse/store/condo/mansion/others |
| transaction_type | VARCHAR(50) | Rent / Sale |
| status | INTEGER(1) | 1=aktif, 2=disabled/blocked, 3=deleted, default 1 |
| created_date, created_by | DATEONLY / VARCHAR(50) | required |
| updated_date, updated_by | DATEONLY / VARCHAR(50) | nullable |

**Indexes:** `property_id`, `city_id`, `province_id`, `country_id`, `building_type`,
`transaction_type`, `status`, `title`. **timestamps:** false.

#### property_images (detail — 1-ke-banyak)

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| property_id | VARCHAR(50) | FK informasional → properties.property_id |
| name | VARCHAR(100) | nullable — label gambar, mis. "Tampak depan" |
| url | VARCHAR(100) | path/URL file gambar |

**Indexes:** `property_id`. **timestamps:** false.

#### property_facilities (pivot properties↔facilities)

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| property_id | VARCHAR(50) | FK informasional → properties.property_id |
| facility_id | VARCHAR(50) | FK informasional → facilities.facility_id |
| facility_qty | INTEGER | nullable — jumlah unit fasilitas (mis. 2 AC) |
| created_date, created_by | DATEONLY / VARCHAR(50) | required |
| updated_date, updated_by | DATEONLY / VARCHAR(50) | nullable |

**Indexes:** `property_id`, `facility_id`. **timestamps:** false.

#### property_locations (pivot properties↔locations, many-to-many)

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK, auto-increment | |
| property_id | VARCHAR(50) | FK → properties.property_id, `onDelete: CASCADE` |
| location_id | VARCHAR(50) | FK → locations.location_id |
| created_date | DATE | nullable, default `NOW` |
| created_by | VARCHAR(50) | nullable |
| updated_date | DATE | nullable |
| updated_by | VARCHAR(50) | nullable |

**Indexes:** `property_id`, `location_id`, UNIQUE `(property_id, location_id)`.
**timestamps:** false.

> Sub-resource API: `/api/property/:property_id/locations` (get/add/bulk-add/remove)
> via `propertyLocationController.js` — menghubungkan properti dengan landmark
> terdekat (dipakai untuk Q6 anchor point di Q1–Q12).

---

## Associations (`backend/models/index.js`)

```javascript
// Facility ↔ User (informasional, constraints:false)
Facility.belongsTo(User, { as: 'creator' })
Facility.belongsTo(User, { as: 'updater' })

// Region hierarchy (informasional, constraints:false)
Country.hasMany(Province, { as: 'provinces' })
Province.belongsTo(Country, { as: 'country' })
Province.hasMany(City, { as: 'cities' })
City.belongsTo(Province, { as: 'province' })
City.belongsTo(Country, { as: 'country' })

// Property header → region (informasional, constraints:false)
Property.belongsTo(City, { as: 'city' })
Property.belongsTo(Province, { as: 'province' })
Property.belongsTo(Country, { as: 'country' })

// Property header → detail (1-ke-banyak, constraints:false)
Property.hasMany(PropertyImage, { as: 'images' })
PropertyImage.belongsTo(Property, { as: 'property' })
Property.hasMany(PropertyFacility, { as: 'facilities' })
PropertyFacility.belongsTo(Property, { as: 'property' })
PropertyFacility.belongsTo(Facility, { as: 'facility' })

// Property ↔ Location (many-to-many via property_locations, constraints:false)
Property.hasMany(PropertyLocation, { as: 'locations' })
PropertyLocation.belongsTo(Property, { as: 'property' })
PropertyLocation.belongsTo(Location, { as: 'location' })
Location.hasMany(PropertyLocation, { as: 'properties' })

// ChatSession ↔ ChatMessage (constraints ENFORCED — bukan constraints:false)
ChatSession.hasMany(ChatMessage, { as: 'messages' })
ChatMessage.belongsTo(ChatSession, { as: 'session' })
```

Semua association region/property/facility pakai `constraints: false`
(informasional, tanpa FK enforced di level DB) — hanya `ChatSession`↔`ChatMessage`
yang FK-nya benar-benar ditegakkan Sequelize.

---

## Sequelize Models (`backend/models/`)

| File | Table |
|---|---|
| `User.js` | users |
| `ChatSession.js` | chat_sessions |
| `ChatMessage.js` | chat_messages |
| `Contact.js` | contacts |
| `Facility.js` | facilities |
| `Property.js` | properties |
| `PropertyImage.js` | property_images |
| `PropertyFacility.js` | property_facilities |
| `PropertyLocation.js` | property_locations |
| `Country.js` / `Province.js` / `City.js` | countries / provinces / cities |
| `Location.js` | locations |
| `Log.js` | logs |

All models auto-exported from `backend/models/index.js`.

## Data Read Path — bukan hanya CRUD manual

`propertyRecommendationService.js` (lihat doc 06/12) membaca tabel-tabel di atas
via `getDbProperties()` (JOIN Property + City + Province + PropertyImage +
PropertyFacility→Facility **+ PropertyLocation→Location** [BARU], `where:
{ status: 1 }`), di-cache 5 menit (`DB_PROPS_CACHE_TTL_MS`). Ini adalah
**sumber utama** katalog untuk chatbot website & WhatsApp — bukan hasil query
langsung dari master CRUD di frontend. JSON `indonesia_property_extended_v3.json`
hanya fallback lazy bila DB kosong DAN Rumah123 kosong.

**Field ternormalisasi (BARU, ditambahkan ke setiap object property hasil
`getDbProperties()`):**
| Field | Sumber | Kegunaan |
|---|---|---|
| `userId` | `Property.user_id` | Scoping katalog per-agent — lihat doc 06/17 |
| `priceValue` | `Property.price` (raw numeric) | Perbandingan budget BETWEEN akurat, tanpa re-parse string harga |
| `priceType` | `Property.price_type` (lowercase) | Menentukan periode (night/monthly/yearly/dst.) untuk `budgetMatches()` |
| `area` | `Property.area` | Kawasan/nama area (mis. "Citraland") |
| `nearbyLocations` | Join `PropertyLocation` → `Location.name` (gabung koma) | Baris "Lokasi Terdekat"/"Nearby Landmarks" di tampilan katalog |

## GeneralController — Shared Helpers (BARU)

`backend/controllers/GeneralController.js` adalah base class SEMUA master
controller (Country/Province/City/Location/Facility/Property/Register). Dua
helper baru menggantikan method privat yang tadinya diduplikasi di 4
controller berbeda:

```javascript
// Cek duplikat nama (case/spasi-insensitive), dengan scope opsional.
// Menggantikan #findDuplicate yang tadinya ada terpisah di Country/Location/
// Province/City controller.
GeneralController.findDuplicateName(model, name, { idField, scope = {}, excludeId = null })
// contoh: findDuplicateName(Province, name, { idField: 'province_id', scope: { country_id }, excludeId })

// Resolve nama record dari id-nya (untuk join tampilan list/detail).
// Menggantikan #countryName/#provinceName yang tadinya diduplikasi.
GeneralController.lookupName(model, idField, id)
// contoh: lookupName(Country, 'country_id', province.country_id)
```

> **Facility TIDAK memakai `findDuplicateName`** — Facility punya logika
> sinonim sendiri (`#findRedundant` + `FACILITY_SYNONYM_GROUPS`, cek gym/gym
> club, cctv/kamera pengawas, dll.), sengaja tidak digabung karena beda level
> abstraksi (bukan sekadar normalisasi nama, tapi grup sinonim semantik).

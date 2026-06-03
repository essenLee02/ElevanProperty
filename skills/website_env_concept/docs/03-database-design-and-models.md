# 03. Database Design & Models

Database: `db_property` (MySQL / MariaDB 10.4)
ORM: Sequelize v6 (`backend/models/`)
Sync strategy: `sequelize.sync({ alter: true })` on server start (auto-migrates, no data loss)

## Tables

### users
Stores registered agents (login system).

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | auto-increment |
| user_id | VARCHAR(255) | format: `SA6EDRU001` (2-char prefix + random + 3-digit count), UNIQUE |
| name | VARCHAR(255) | stored UPPERCASE |
| birthdate | DATE | nullable |
| phone | VARCHAR(30) | nullable, INDEX |
| username | VARCHAR(255) | unique |
| password | VARCHAR(255) | bcrypt hash |
| refresh_token | TEXT | current JWT refresh token (null = logged out) |
| status | INT | 1=active, 2=blocked, 3=deleted, default 1, INDEX |
| privilege | VARCHAR(50) | nullable, INDEX(privilege,status) composite |
| fonnte_token | VARCHAR(100) | Fonnte token per-agent (nullable — null = not setup yet) |
| created_date, created_by | DATETIME/VARCHAR | audit |
| updated_date, update_by | DATETIME/VARCHAR | audit |

**Indexes:** `user_id`, `username`, `status`, `(privilege, status)`, `phone`

> `fonnte_token` diisi agent via halaman `/profile`.
> Agent tanpa `fonnte_token` tidak akan diproses oleh `fonnteChatController`.

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
| source | VARCHAR | `website_chatbot`, `contact_form`, `fonnte_leo_felix`, `wati_leo_felix`, etc. |
| lastMessageAt | DATETIME | timestamp of last message, nullable |
| createdAt, updatedAt | DATETIME | Sequelize auto |

> **Source format:** `[channel]_[agent_name]`
> - Website chatbot: `website_chatbot`
> - Contact form: `contact_form`
> - Fonnte agent: `fonnte_leo_felix`
> - WATI agent: `wati_leo_felix`

---

### chat_messages
All messages for each session.

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| chatSessionId | INT | FK → chat_sessions.id |
| role | VARCHAR | `customer` (incoming) or `ai` (AI reply) |
| message | TEXT | message text |
| channel | VARCHAR | `website_chatbot`, `whatsapp`, `private_agent`, etc. |
| metadata | TEXT (JSON) | AI provider info, filters, match counts |
| createdAt, updatedAt | DATETIME | |

> ⚠️ Field names: `chatSessionId` (camelCase), `message` (not `content`), `channel` (not `source`)
> Role values: `customer` (not `user`) and `ai` (not `assistant`)

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

### whatsapp_inbound_messages
Legacy table — messages captured from agent WA numbers via Fonnte webhook (old approach).

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| agentName | VARCHAR | e.g. `Clarence` |
| agentPhone | VARCHAR | agent WA number (as received) |
| agentPhoneNormalized | VARCHAR | e.g. `6282111367154` |
| senderName | VARCHAR | customer display name |
| senderPhone | VARCHAR | customer phone |
| senderPhoneNormalized | VARCHAR | |
| message | TEXT | |
| mediaType, mediaUrl | VARCHAR | nullable |
| deviceId | VARCHAR | Fonnte device ID |
| timestamp | VARCHAR | from Fonnte payload |
| rawPayload | TEXT | full JSON from webhook |
| status | VARCHAR | `received` |
| createdAt, updatedAt | DATETIME | |

> New multi-agent Fonnte flow uses `chat_sessions` + `chat_messages` via `fonnteChatController`, NOT this table.

---

### logs
Frontend navigation and action logging.

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| action | VARCHAR | e.g. `PAGE_VIEW` |
| details | TEXT | |
| username | VARCHAR | nullable |
| user_id | VARCHAR | nullable |
| createdAt | DATETIME | |

---

## Sequelize Models (`backend/models/`)

| File | Table |
|---|---|
| `User.js` | users |
| `ChatSession.js` | chat_sessions |
| `ChatMessage.js` | chat_messages |
| `Contact.js` | contacts |
| `WhatsAppInbound.js` | whatsapp_inbound_messages |
| `Property.js` | properties (property catalog) |
| `Log.js` | logs |

All models auto-exported from `backend/models/index.js`.

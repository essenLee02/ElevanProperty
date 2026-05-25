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
| user_id | VARCHAR(20) | format: `NTAb3xK006` (prefix+random+count) |
| name | VARCHAR(100) | stored UPPERCASE |
| birthdate | DATE | nullable |
| phone | VARCHAR(20) | nullable |
| username | VARCHAR(50) | unique |
| password | VARCHAR(255) | bcrypt hash |
| refresh_token | TEXT | current JWT refresh token (null = logged out) |
| status | INT | 1=active, 2=blocked, 3=deleted |
| privilege | VARCHAR(50) | nullable |
| created_date, created_by | | audit |
| updated_date, update_by | | audit |

### chat_sessions
One row per unique customer conversation context.

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| session_token | VARCHAR | unique identifier (stored in cookie) |
| name | VARCHAR | customer name |
| phone | VARCHAR | customer phone |
| location | VARCHAR | customer location |
| source | VARCHAR | `website_chatbot`, `contact_form`, `whatsapp_fonnte` |
| createdAt, updatedAt | DATETIME | Sequelize auto |

### chat_messages
All messages for each session.

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| session_id | INT | FK → chat_sessions.id |
| role | VARCHAR | `user` or `assistant` |
| content | TEXT | message text |
| source | VARCHAR | `website_chatbot`, `whatsapp`, `private_agent`, etc. |
| metadata | JSON | AI provider info, filters, match counts |
| createdAt, updatedAt | DATETIME | |

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

### whatsapp_inbound_messages
Messages received from customers on the 5 agent WhatsApp numbers.

| Column | Type | Notes |
|---|---|---|
| id | INT AI PK | |
| agentName | VARCHAR | Clarence / Desy / Nigel / Natasha / Leo |
| agentPhone | VARCHAR | agent's WA number (as received) |
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

## Sequelize Models (backend/models/)

- `User.js` → users
- `ChatSession.js` → chat_sessions
- `ChatMessage.js` → chat_messages
- `Contact.js` → contacts
- `WhatsAppInbound.js` → whatsapp_inbound_messages
- `Log.js` → logs

All models auto-exported from `backend/models/index.js`.

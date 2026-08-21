# 04. Authentication & Agent Management

## JWT Strategy (2-Tier Token)

| Token | Lifetime | Storage | Purpose |
|---|---|---|---|
| Access Token | 5 min (`ACCESS_TOKEN_EXPIRY`) | Frontend localStorage | API authorization header |
| Refresh Token | 1 day (`REFRESH_TOKEN_EXPIRY`) | HttpOnly cookie `Elevan_Refresh_Token` | Generate new access token |

Auto-refresh flow: When access token is near expiry → `GET /api/auth/refresh` → new access token issued.

---

## API Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register agent |
| POST | `/api/auth/login` | Public | Login |
| DELETE | `/api/auth/logout` | Public | Logout (clear cookie) |
| GET | `/api/auth/me` | Cookie | Get current user profile |
| GET | `/api/auth/refresh` | Cookie | Refresh access token |
| GET | `/api/profile/me` | JWT | Protected profile |
| PUT | `/api/profile/update-agent` | JWT | Update profile |

---

## Register (`POST /api/auth/register`)

**Request:**
```json
{
  "name": "Leo Felix",
  "birthdate": "2000-05-25",
  "phone": "+62821-3311-936",
  "username": "leon123",
  "password": "pass123",
  "konfirmasi": "pass123",
  "privilege": "agent"
}
```

**Validations:** name + username + password required · password ≥ 6 chars · password == konfirmasi · username unique

**User ID Generation:** `[2-char prefix][5-char random][3-digit count]`
```
"Leo Felix" → LF + 5gK3T + 002 = LFGKT49002
"Nigel Kuncoro" → NK + ... → SA6EDRU001
```
Name stored UPPERCASE. Default `privilege = 'agent'`, `status = 1`.

---

## Login (`POST /api/auth/login`)

**Request:** `{ "username": "leon123", "password": "pass123" }`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "<access_jwt>",
    "user": { "user_id": "...", "name": "LEO FELIX", "privilege": "agent", "phone": "..." }
  }
}
```
Sets `Elevan_Refresh_Token` HttpOnly cookie.

**Errors:** 400 missing fields · 401 wrong credentials · 403 blocked/deleted account

---

## User Status Codes

| Value | Meaning | Can Login |
|---|---|---|
| 1 | Active | ✅ Yes |
| 2 | Blocked | ❌ No |
| 3 | Deleted (soft) | ❌ No |

---

## Current Agents in Database

All 6 registered, `privilege='agent'`, `status=1`:

| # | user_id | Name | Phone | fonnte_token | dialog360_token |
|---|---|---|---|---|---|
| 1 | SA6EDRU001 | NIGEL KUNCORO | 082233556796 | ✅ Ada (disconnected) | ❌ NULL |
| 2 | LFGKT49002 | LEO FELIX | +62821-3311-936 | ✅ Ada (working) | ❌ NULL |
| 3 | CEMPL3Z003 | CLARENCE MARIO | 0821-1136-7154 | ❌ NULL | ❌ NULL |
| 4 | DTDE8RX004 | DESY TALIM | 0821-1331-8191 | ❌ NULL | ❌ NULL |
| 5 | ITJMESP005 | IFAN TJANDRA | +62881036588874 | ❌ NULL | ❌ NULL |
| 6 | IE1BGVY006 | KEZIA ELDY | 0851-6365-05872 | ❌ NULL | ❌ NULL |

Agent phone numbers stored as-is from registration. Normalized to `628xxxxxxx` format at runtime for matching.

### Token Columns per Agent

| Column | Platform | Cara Isi |
|---|---|---|
| `fonnte_token` | Fonnte WhatsApp | Via `/profile` → field "Fonnte API" |
| `dialog360_token` | 360dialog WhatsApp | Via SQL langsung atau endpoint `/setup-webhook` |

```sql
-- Setup dialog360_token untuk agent tertentu
UPDATE users SET dialog360_token='[API_KEY_DARI_360DIALOG]' WHERE name='LEO FELIX';

-- Cek semua token
SELECT name, phone, fonnte_token, dialog360_token FROM users;
```

Column `dialog360_token` di-auto-migrate via `ensureRequiredDatabaseColumns()` di `server.js` (tidak perlu migration manual).

---

## Phone Normalization (runtime)

```javascript
// PhoneUtils.normalize()
'+62821-3311-936' → '6282133119036'
'0821-1136-7154'  → '6282111367154'
'082233556796'    → '6282233556796'
```

---

## Controller Files

| File | Methods |
|---|---|
| `loginController.js` | `loginUser`, `logoutUser`, `getCurrentUser` |
| `registerController.js` | `insertDataAgent`, `countUsers` |
| `profileController.js` | `getCurrentProfile`, `updateDataAgent` |
| `refreshTokenController.js` | Auto refresh via cookie |

### profileController — updateDataAgent

Fields yang bisa diupdate via `PUT /api/profile/update-agent`:
- `name` (wajib)
- `phone` (wajib)
- `birthdate` (opsional)
- `password` (wajib tiap save, min 6 karakter, di-hash bcrypt)
- `fonnte_token` (opsional, null jika dikosongkan)

**`username` TIDAK bisa diupdate** — tidak diambil dari request body.

`GET /api/profile/me` mengembalikan: `user_id, name, username, phone, birthdate, fonnte_token`

---

## Environment Variables

```env
ACCESS_TOKEN_SECRET=elevan_access_secret_...
REFRESH_TOKEN_SECRET=elevan_refresh_secret_...
ACCESS_TOKEN_EXPIRY=5m
REFRESH_TOKEN_EXPIRY=1d
COOKIE_REFRESH_TOKEN=Elevan_Refresh_Token
BCRYPT_SALT_ROUNDS=10
```

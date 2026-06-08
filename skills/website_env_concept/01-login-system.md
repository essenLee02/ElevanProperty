# Login System

## Overview
Login system untuk agen property dan user yang sudah terdaftar. Sistem menggunakan JWT (JSON Web Token) dengan 2-tier token strategy: access token (5 menit) + refresh token (1 hari) yang disimpan dalam HttpOnly cookie.

## Architecture

### Token Strategy
```
Access Token (short-lived)
├─ Expires: 5 menit (configurable via ACCESS_TOKEN_EXPIRY in .env)
├─ Stored: In response JSON (frontend localStorage/sessionStorage)
├─ Usage: Authorization header untuk setiap API request
└─ Refresh: Otomatis via GET /api/auth/refresh-token saat akan expired

Refresh Token (long-lived)
├─ Expires: 1 hari (configurable via REFRESH_TOKEN_EXPIRY in .env)
├─ Stored: HttpOnly cookie (COOKIE_REFRESH_TOKEN=Elevan_Refresh_Token)
├─ Usage: Untuk generate access token baru
└─ Security: Tidak bisa diakses JavaScript, hanya dikirim otomatis ke backend
```

### Password Hashing
- Algorithm: bcrypt (async hashing)
- Salt rounds: Configurable via BCRYPT_SALT_ROUNDS in .env (default: 10)
- Timing: ~100ms per hash (intentional, untuk prevent brute-force)

## Database Schema

### Table: `users`
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(20) UNIQUE NOT NULL,        -- Format: [PREFIX][RANDOM5][COUNT3] (e.g., NTAb3xK006)
  name VARCHAR(255) NOT NULL,
  birthdate DATE,
  phone VARCHAR(20),
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,              -- bcrypt hash
  refresh_token TEXT,                          -- JWT refresh token
  privilege VARCHAR(50),                       -- Role: admin, agent, customer, etc.
  status INT DEFAULT 1,                        -- 1=aktif, 2=blokir, 3=dihapus
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_date TIMESTAMP,
  update_by VARCHAR(100)
);
```

## API Endpoint

### POST /api/auth/login

**Request**
```json
{
  "username": "nigel",
  "password": "mypassword123"
}
```

**Response Success (HTTP 200)**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",  // Access token (JWT)
    "user": {
      "user_id": "NTAb3xK001",
      "name": "Nigel Tjandra",
      "username": "nigel",
      "privilege": "agent",
      "phone": "082233556796",
      "birthdate": "1990-05-15"
    }
  },
  "message": "Berhasil login"
}
```

**Response Error**
```json
// HTTP 400 - Username atau password kosong
{
  "success": false,
  "message": "Username dan password wajib diisi"
}

// HTTP 401 - Username tidak ditemukan atau password salah
{
  "success": false,
  "message": "Username atau password salah"
}

// HTTP 403 - User status bukan aktif (status != 1)
{
  "success": false,
  "message": "Akun di-blokir, hubungi admin"  // Jika status = 2
}
```

**Set-Cookie Header**
```
Set-Cookie: Elevan_Refresh_Token=eyJhbGciOiJIUzI1NiIs...; HttpOnly; Path=/; Max-Age=86400
```

## Controller Implementation

### File: `backend/controllers/loginController.js`

**Key Methods**
- `loginUser(req, res)` — Main login handler
- `logoutUser(req, res)` — Clear refresh token
- `getCurrentUser(req, res)` — Validate token and return user

**Private Helpers**
- `#cleanEnv(value, fallback)` — Sanitize .env values
- `#cookieName()` — Get refresh token cookie name from .env
- `#statusMessage(status)` — User-friendly status message

**Flow**
1. Validasi input (username & password tidak kosong)
2. Query user dari database by username
3. Cek status user (harus = 1 / aktif)
4. Bandingkan password dengan bcrypt.compare()
5. Generate access token & refresh token via jwt.sign()
6. Simpan refresh token ke database
7. Set refresh token ke HttpOnly cookie
8. Return access token & user info dalam response

## Frontend Integration

### Login Request
```javascript
const response = await fetch('http://localhost:5005/api/auth/login', {
  method: 'POST',
  credentials: 'include',  // PENTING: kirim + terima cookie
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'nigel',
    password: 'mypassword123'
  })
});

const { data } = await response.json();
localStorage.setItem('accessToken', data.token);
// Refresh token otomatis di-set sebagai HttpOnly cookie (tidak bisa diakses JS)
```

### Use Access Token
```javascript
const response = await fetch('http://localhost:5005/api/auth/me', {
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});
```

### Auto-Refresh Token
```javascript
// Saat access token akan expired (sebelum 5 menit), request ke /api/auth/refresh-token
const response = await fetch('http://localhost:5005/api/auth/refresh-token', {
  method: 'POST',
  credentials: 'include'  // Kirim refresh token cookie
});

const { data } = await response.json();
localStorage.setItem('accessToken', data.token);  // Update access token
```

## Logging & Audit

### File: `backend/utils/authLogger.js`

**Events Logged**
- Login success → user_id, username, name, IP, HTTP status, privilege, token expiry
- Login failed → reason, username, IP, HTTP status, error details
- Logout success → user_id, username, IP
- Logout failed → reason, IP

**Log Format**
```
[TIMESTAMP] [EVENT] [STATUS]
IP: xxx.xxx.xxx.xxx
Route: POST /api/auth/login
HTTP Status: 200 OK
Additional: {...}
```

## Security Considerations

### Token Storage
- ✅ Access token → localStorage (accessible to JavaScript, vulnerable to XSS)
  - Mitigasi: Keep token lifetime short (5 menit)
- ✅ Refresh token → HttpOnly cookie (NOT accessible to JavaScript, immune to XSS)
  - Mitigasi: Only sent over HTTPS in production (uncomment `secure: true` in server.js)

### Password Security
- ✅ Hashed dengan bcrypt (one-way, cannot be reversed)
- ✅ Salt rounds = 10 (slower = harder to brute-force)
- ⚠️ Minimum 6 characters (enforce on frontend + backend)

### CORS & Credentials
- ✅ CORS enabled dengan credentials: true (untuk send/receive cookies)
- ✅ Origin whitelist: localhost:5173, 127.0.0.1:5173 saja

### Rate Limiting
- ⚠️ Not yet implemented on login endpoint (recommended: 5 attempts per IP per 15 minutes)

## Environment Variables

```bash
# JWT Secrets — ganti dengan string random sebelum production
ACCESS_TOKEN_SECRET=elevan_access_secret_iuewg928g0wbigw78981091nLJkosniqLwq83egijc
REFRESH_TOKEN_SECRET=elevan_refresh_secret_837qbdgwosDapoznchvdo07sNckaidskjajwiuq98y8

# Expiry — format: 60s, 5m, 2h, 1d
ACCESS_TOKEN_EXPIRY=5m
REFRESH_TOKEN_EXPIRY=1d

# Cookie name untuk refresh token
COOKIE_REFRESH_TOKEN=Elevan_Refresh_Token

# Bcrypt salt rounds (10-12 recommended)
BCRYPT_SALT_ROUNDS=10
```

## Testing Checklist

- [ ] Login dengan username & password valid → dapat access token & HttpOnly cookie
- [ ] Login dengan username tidak ditemukan → error 401
- [ ] Login dengan password salah → error 401
- [ ] Login dengan user status = 2 (blokir) → error 403 dengan pesan "Akun di-blokir"
- [ ] Access token valid → GET /api/auth/me return user info
- [ ] Access token expired → GET /api/auth/me return error 401
- [ ] Refresh token valid → POST /api/auth/refresh-token return new access token
- [ ] Logout → refresh token dihapus dari DB & cookie cleared
- [ ] Login dari multiple devices → setiap device punya refresh token berbeda

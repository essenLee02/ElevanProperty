# Register System

## Overview
Register system untuk membuat agen property dan user baru di platform Elevan Property. System menghasilkan unique user_id secara otomatis berdasarkan nama, random suffix, dan counter.

## User ID Generation

### Format
```
[PREFIX][RANDOM5][COUNT3]

PREFIX    → 2 huruf pertama dari nama
            - 2+ kata: huruf pertama kata pertama + huruf pertama kata terakhir (e.g., "Nigel Tjandra" → "NT")
            - 1 kata: 2 huruf pertama (e.g., "Nigel" → "Ni")
            
RANDOM5   → 5 karakter random alphanumeric (A-Z, a-z, 0-9)
            - Contoh: "xK6aQ"
            
COUNT3    → 3 digit, padded dengan leading zeros
            - User ke-1 → "001"
            - User ke-10 → "010"
            - User ke-100 → "100"
```

### Contoh
```
User 1: Nigel Tjandra     → NT + xK6aQ + 001 = NTxK6aQ001
User 2: Desy Kusuma      → DK + m9pLz + 002 = DKm9pLz002
User 3: Ahmad            → Ah + r2tQw + 003 = Ahr2tQw003
```

## Database Schema

### Table: `users`
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  birthdate DATE,
  phone VARCHAR(20),
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,              -- bcrypt hash
  privilege VARCHAR(50),                       -- Role: admin, agent, customer
  status INT DEFAULT 1,                        -- 1=aktif, 2=blokir, 3=dihapus
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  refresh_token TEXT,
  updated_date TIMESTAMP,
  update_by VARCHAR(100)
);
```

## API Endpoint

### POST /api/auth/register

**Request**
```json
{
  "name": "Nigel Tjandra",
  "birthdate": "1990-05-15",
  "phone": "082233556796",
  "username": "nigel",
  "password": "MySecurePass123",
  "konfirmasi": "MySecurePass123",
  "privilege": "agent",
  "createdBy": "Admin"  // Optional, default: "Self-Register"
}
```

**Response Success (HTTP 201)**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "NTxK6aQ001",
    "name": "NIGEL TJANDRA",
    "birthdate": "1990-05-15",
    "phone": "082233556796",
    "username": "nigel",
    "status": 1,
    "privilege": "agent",
    "created_date": "2026-05-25T10:30:00.000Z",
    "created_by": "Admin"
  },
  "message": "Sukses register"
}
```

**Response Error**
```json
// HTTP 400 - Field name, username, password kosong
{
  "success": false,
  "message": "Field name, username, dan password wajib diisi"
}

// HTTP 400 - Password & konfirmasi tidak cocok
{
  "success": false,
  "message": "Password dan Konfirmasi tidak cocok"
}

// HTTP 400 - Password < 6 karakter
{
  "success": false,
  "message": "Password minimal 6 karakter"
}

// HTTP 409 - Username sudah terdaftar
{
  "success": false,
  "message": "Username sudah terpakai, silakan pilih yang lain"
}

// HTTP 500 - Server error
{
  "success": false,
  "message": "Gagal register: [error details]"
}
```

## Controller Implementation

### File: `backend/controllers/registerController.js`

**Key Methods**
- `insertDataAgent(req, res)` — Main register handler
- `countUsers(req, res)` — Return total user count

**Private Helpers**
- `#saltRounds()` — Get bcrypt salt rounds from .env
- `#randomString(length)` — Generate random alphanumeric string
- `#makeUserId(nama, jumlah)` — Generate user_id

**Flow**
1. Validasi input (name, username, password wajib)
2. Cek password length ≥ 6 karakter
3. Cek password == konfirmasi
4. Cek username belum terdaftar (unique constraint)
5. Generate user_id dengan formula [PREFIX][RANDOM5][COUNT3]
6. Hash password dengan bcrypt (salt rounds dari .env)
7. Insert ke database dengan status = 1 (aktif)
8. Log ke authLogger
9. Return user info (tanpa password hash)

## Validation Rules

### Field Validation
| Field | Required | Min | Max | Format | Notes |
|-------|----------|-----|-----|--------|-------|
| name | ✓ | 2 | 255 | Text | Used for PREFIX generation |
| username | ✓ | 3 | 100 | Alphanumeric + _ - | Unique, case-insensitive |
| password | ✓ | 6 | - | Any | Will be bcrypt hashed |
| konfirmasi | ✓ | 6 | - | Any | Must match password |
| phone | | 7 | 20 | Digits only | Optional |
| birthdate | | - | - | YYYY-MM-DD | Optional |
| privilege | | - | 50 | Text | e.g., "agent", "admin" |
| createdBy | | 1 | 100 | Text | Default: "Self-Register" |

### Username Uniqueness
```sql
-- Backend akan query sebelum insert
SELECT * FROM users WHERE username = ? LIMIT 1;

-- Jika found, return 409 Conflict
```

## Security Features

### Password Hashing
```javascript
const saltRounds = BCRYPT_SALT_ROUNDS;  // Default: 10
const salt = await bcrypt.genSalt(saltRounds);
const hashedPassword = await bcrypt.hash(password, salt);
// ~100ms processing time per hash (intentional, prevent brute-force)
```

### Name Normalization
```javascript
// Input: "nigel tjandra" atau "NIGEL TJANDRA"
// Output: "NIGEL TJANDRA" (all uppercase)
const formattedName = String(name).trim().toUpperCase();
```

### Username Sanitization
```javascript
// Trim whitespace, lowercase (optional)
const username = String(username).trim();
```

### No Password Exposure
- Password hash never returned in response
- Only safe fields returned: id, user_id, name, birthdate, phone, username, status, privilege, created_date, created_by

## Logging & Audit

### File: `backend/utils/authLogger.js`

**Register Success Logged**
```
Event: registerSuccess
Data: {
  user_id: "NTxK6aQ001",
  username: "nigel",
  name: "NIGEL TJANDRA"
}
Context: {
  IP: "127.0.0.1",
  Route: "POST /api/auth/register",
  HTTP Status: 201,
  Phone: "082233556796" atau "(kosong)",
  Birthdate: "1990-05-15" atau "(kosong)",
  Created By: "Admin",
  Total Users: 5
}
```

**Register Failed Logged**
```
Event: registerFailed
Reason: "Username sudah terpakai" atau "[other validation error]"
Context: {
  IP: "127.0.0.1",
  Route: "POST /api/auth/register",
  HTTP Status: 400 / 409 / 500,
  Username Input: "nigel",
  Existing User ID: "NTxK6aQ001" (jika duplicate)
}
```

## Frontend Integration

### Simple Register Form
```javascript
const registerForm = {
  name: "Nigel Tjandra",
  birthdate: "1990-05-15",
  phone: "082233556796",
  username: "nigel",
  password: "MySecurePass123",
  konfirmasi: "MySecurePass123",
  privilege: "agent",
  createdBy: "Admin"
};

const response = await fetch('http://localhost:5005/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(registerForm)
});

const result = await response.json();
if (result.success) {
  console.log('User ID:', result.data.user_id);
  // Redirect to login
} else {
  console.error('Error:', result.message);
}
```

### Input Validation (Frontend)

**Before sending to backend:**
```javascript
// 1. Check required fields
if (!name || !username || !password) {
  alert('Name, username, password wajib diisi');
  return;
}

// 2. Check password length
if (password.length < 6) {
  alert('Password minimal 6 karakter');
  return;
}

// 3. Check password match
if (password !== konfirmasi) {
  alert('Password dan Konfirmasi tidak cocok');
  return;
}

// 4. Check username format (alphanumeric + _ -)
const usernameRegex = /^[a-zA-Z0-9_-]+$/;
if (!usernameRegex.test(username)) {
  alert('Username hanya boleh berisi huruf, angka, underscore, dan dash');
  return;
}

// 5. Optional: check phone format
if (phone && !/^\d{7,20}$/.test(phone)) {
  alert('Phone harus berisi 7-20 angka');
  return;
}
```

## Environment Variables

```bash
# Bcrypt salt rounds
BCRYPT_SALT_ROUNDS=10

# HTTP Status Codes
HTTP_CREATED=201
HTTP_BAD_REQUEST=400
HTTP_CONFLICT=409
HTTP_INTERNAL_SERVER_ERROR=500
```

## Testing Checklist

- [ ] Register dengan data valid → user_id generated, status 201
- [ ] Register dengan username duplikat → error 409
- [ ] Register dengan password < 6 karakter → error 400
- [ ] Register dengan password != konfirmasi → error 400
- [ ] Register dengan field kosong → error 400 dengan field yang missing
- [ ] Register tanpa phone/birthdate → berhasil (optional fields)
- [ ] User_id format benar: [2PREFIX][5RANDOM][3COUNT]
- [ ] Name disimpan sebagai UPPERCASE
- [ ] Created By default "Self-Register" jika tidak dikirim
- [ ] Password di-hash dengan bcrypt (never stored plain text)
- [ ] GET /api/auth/users/count → return total user count
- [ ] Register dari multiple IPs → masing-masing generate unique user_id

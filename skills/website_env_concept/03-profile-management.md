# Profile Management

## Overview
Profile management untuk agent dan user yang sudah login. Agent dapat melihat dan update profile mereka sendiri (name, phone, birthdate). Profile data tersimpan di tabel `users` dan terasosiasi dengan JWT token yang valid.

## Database Schema

### Table: `users` (Profile Fields)
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(20) UNIQUE NOT NULL,      -- Generated on register
  name VARCHAR(255) NOT NULL,
  birthdate DATE,
  phone VARCHAR(20),
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  privilege VARCHAR(50),                    -- Role/privilege
  status INT DEFAULT 1,                     -- 1=aktif, 2=blokir, 3=dihapus
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_date TIMESTAMP,
  update_by VARCHAR(100)
);
```

## API Endpoints

### GET /api/auth/me

**Purpose:** Get current authenticated user's profile

**Requirements**
- HttpOnly cookie `Elevan_Refresh_Token` harus valid di browser
- Refresh token harus ada di database

**Request**
```bash
GET /api/auth/me HTTP/1.1
Host: localhost:5005
Cookie: Elevan_Refresh_Token=eyJhbGciOiJIUzI1NiIs...
```

**Response Success (HTTP 200)**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": "NTxK6aQ001",
      "name": "NIGEL TJANDRA",
      "username": "nigel",
      "phone": "082233556796",
      "birthdate": "1990-05-15",
      "privilege": "agent",
      "status": 1
    }
  },
  "message": "User terautentikasi"
}
```

**Response Error**
```json
// HTTP 401 - Tidak ada refresh token di cookie
{
  "success": false,
  "message": "Belum login"
}

// HTTP 401 - Refresh token tidak dikenali di database
{
  "success": false,
  "message": "Token tidak dikenali"
}

// HTTP 403 - Status user != 1 (user di-blokir atau dihapus)
{
  "success": false,
  "message": "Akun di-blokir, hubungi admin"  // atau "Akun sudah dihapus"
}

// HTTP 500 - Server error
{
  "success": false,
  "message": "Failed to retrieve user"
}
```

### PUT /api/auth/profile/update (Belum Diimplementasi)

**Purpose:** Update user's profile (name, phone, birthdate)

**Requirements**
- HttpOnly cookie `Elevan_Refresh_Token` harus valid
- User status harus = 1

**Request**
```json
{
  "name": "Nigel Tjandra Updated",
  "phone": "082233556796",
  "birthdate": "1990-05-15"
}
```

**Response Success (HTTP 200)**
```json
{
  "success": true,
  "data": {
    "user_id": "NTxK6aQ001",
    "name": "NIGEL TJANDRA UPDATED",
    "phone": "082233556796",
    "birthdate": "1990-05-15",
    "updated_date": "2026-05-25T10:30:00.000Z",
    "update_by": "nigel"
  },
  "message": "Profile berhasil diperbarui"
}
```

## Controller Implementation

### File: `backend/controllers/loginController.js`

**Current Methods**
- `loginUser(req, res)` — Generate tokens & login
- `logoutUser(req, res)` — Clear refresh token
- `getCurrentUser(req, res)` — Get user profile from refresh token

**getCurrentUser() Flow**
1. Extract refresh token dari HttpOnly cookie (nama: Elevan_Refresh_Token)
2. Jika tidak ada cookie → return 401 "Belum login"
3. Query database: `SELECT ... FROM users WHERE refresh_token = ?`
4. Jika tidak ditemukan → return 401 "Token tidak dikenali"
5. Jika status != 1 → return 403 "Akun di-blokir" atau "Akun sudah dihapus"
6. Return user data (exclude: password, refresh_token, created_by, update_by)

## Frontend Integration

### Get Current User Profile
```javascript
// Fetch current user profile saat page load
async function loadUserProfile() {
  const response = await fetch('http://localhost:5005/api/auth/me', {
    method: 'GET',
    credentials: 'include'  // PENTING: kirim HttpOnly cookie
  });

  if (!response.ok) {
    // User belum login, redirect ke login page
    window.location.href = '/login';
    return null;
  }

  const { data } = await response.json();
  return data.user;  // { user_id, name, username, phone, birthdate, privilege, status }
}

// Store di state
const user = await loadUserProfile();
console.log('Agent:', user.name, 'Privilege:', user.privilege);
```

### Display Profile in Dashboard
```html
<div class="profile-card">
  <h2>{{ user.name }}</h2>
  <p>ID: {{ user.user_id }}</p>
  <p>Username: {{ user.username }}</p>
  <p>Phone: {{ user.phone }}</p>
  <p>Birthdate: {{ user.birthdate }}</p>
  <p>Privilege: {{ user.privilege }}</p>
  <p>Status: {{ user.status === 1 ? 'Active' : 'Inactive' }}</p>
  <button @click="editProfile">Edit Profile</button>
</div>
```

### Logout User
```javascript
async function logout() {
  const response = await fetch('http://localhost:5005/api/auth/logout', {
    method: 'DELETE',
    credentials: 'include'  // Kirim refresh token cookie untuk clear
  });

  if (response.ok) {
    // Clear local storage
    localStorage.removeItem('accessToken');
    // Redirect to login
    window.location.href = '/login';
  }
}
```

## User Status Codes

| Status | Value | Meaning | Login Allowed |
|--------|-------|---------|---------------|
| Aktif | 1 | User dapat login & akses sistem | ✓ Yes |
| Blokir | 2 | User di-suspend/blacklist | ✗ No |
| Dihapus | 3 | User soft-deleted | ✗ No |

**Saat login atau GET /me dengan status != 1:**
```javascript
static #statusMessage(status) {
  if (status === 2) return 'Akun di-blokir, hubungi admin';
  if (status === 3) return 'Akun sudah dihapus';
  return 'Akun tidak aktif';
}
```

## Agent Profile Use Cases

### 1. Display Agent Info in Chatbot
```javascript
// Di chatbot, tampilkan nama agent yang sedang online
const agent = await fetch('/api/auth/me', { credentials: 'include' })
  .then(r => r.json())
  .then(d => d.data.user);

console.log('Connected to:', agent.name, agent.phone);
```

### 2. WhatsApp Agent Status
```javascript
// Di WATI dashboard, tampilkan profile agent yang menerima chat
// Agent perlu login dulu sebelum bisa menerima chat dari WATI webhook
```

### 3. Audit Trail
```javascript
// Setiap agent action (send chat reply, update property) log:
// {
//   user_id: "NTxK6aQ001",
//   name: "NIGEL TJANDRA",
//   action: "send_whatsapp_reply",
//   timestamp: "2026-05-25T10:30:00Z"
// }
```

## Future Enhancement: Profile Update

### Planned: PUT /api/auth/profile/update
```javascript
static async updateProfile(req, res) {
  const { name, phone, birthdate } = req.body;
  const refreshToken = req.cookies[LoginController.#cookieName()];
  
  if (!refreshToken) {
    return sendError(res, HTTP.UNAUTHORIZED, null, 'Belum login');
  }

  try {
    const user = await User.findOne({ where: { refresh_token: refreshToken } });
    if (!user) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Token tidak dikenali');
    }

    // Validation
    if (String(name || '').trim().length < 2) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama minimal 2 karakter');
    }

    // Update
    await User.update(
      {
        name: String(name).trim().toUpperCase(),
        phone: phone ? String(phone).trim() : null,
        birthdate: birthdate || null,
        updated_date: new Date(),
        update_by: user.username
      },
      { where: { user_id: user.user_id } }
    );

    return sendSuccess(res, HTTP.OK, { user_id: user.user_id }, 'Profile updated');
  } catch (error) {
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, error.message);
  }
}
```

## Security Considerations

### Authentication Check
- ✓ Setiap request ke /api/auth/me harus via HTTPS in production
- ✓ HttpOnly cookie tidak bisa diakses JavaScript (immune to XSS)
- ✓ Refresh token harus valid di database (checked every request)
- ✓ User status harus = 1 (active)

### Data Exposure
- ✓ Password hash NEVER returned
- ✓ Refresh token NEVER returned
- ✓ Only safe fields returned: user_id, name, username, phone, birthdate, privilege, status

### Session Management
- ✓ Logout clears refresh token dari database & cookie
- ✓ Multiple device login supported (setiap device punya refresh token berbeda)
- ✓ Refresh token invalid setelah logout (cannot be reused)

## Testing Checklist

- [ ] Login → GET /api/auth/me return user profile
- [ ] Without login → GET /api/auth/me return 401 "Belum login"
- [ ] With invalid token → GET /api/auth/me return 401 "Token tidak dikenali"
- [ ] User status = 2 → GET /api/auth/me return 403 "Akun di-blokir"
- [ ] User status = 3 → GET /api/auth/me return 403 "Akun sudah dihapus"
- [ ] After logout → GET /api/auth/me return 401 (refresh token cleared)
- [ ] Multiple device login → setiap device punya session terpisah
- [ ] Access token expired, refresh token valid → frontend refresh otomatis
- [ ] Logout dari 1 device → device lain masih bisa login
- [ ] Profile data accurate: user_id, name, phone, birthdate, privilege, status

# Google Calendar Viewing Schedule API

Fitur untuk membuat appointment/jadwal viewing properti di Google Calendar customer secara otomatis.

## Konsep

Ketika customer di WhatsApp AI mengatakan ingin jadwal viewing pada tanggal dan jam tertentu:
1. AI mendeteksi intent viewing + ekstrak date/time dari pesan
2. AI panggil `/api/viewing/schedule` dengan detail agen, customer, properti, date/time
3. Backend ambil email agen dari `users` model → tembak Google Calendar API
4. Event terbuat dengan 2 reminders otomatis: **1 hari sebelum** + **3 jam sebelum**
5. Customer & agen menerima calendar invite via email

## ⚠️ Kenapa Bukan API Key

Google Calendar API **menolak API Key untuk operasi tulis** (create event) — errornya persis:

```
"API keys are not supported by this API. Expected OAuth2 access token
or other authentication credentials that assert a principal."
```

API Key hanya berlaku untuk data publik/read-only (misalnya Places/Maps). Untuk **menulis**
ke calendar seseorang, Google wajib tahu identitas penulisnya → dipakai **Service Account**
(JWT), pola yang **sama persis** dengan integrasi Google Sheets yang sudah ada di project ini
(`googleSheetsService.js`, env `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`).

## Environment Variables

```env
# Reuse — sudah dipakai googleSheetsService.js, tidak perlu credential baru
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json
GOOGLE_CALENDAR_TIMEZONE=Asia/Jakarta  # Timezone untuk event datetime
```

### Setup Google Cloud Console (Service Account)

1. Buka https://console.cloud.google.com/apis/credentials (project yang sudah ada, mis. "My API for Projects")
2. Pastikan **Google Calendar API** sudah *Enabled* (Library → cari "Google Calendar API" → Enable — sudah dilakukan)
3. **Create Credentials → Service Account** (bukan API Key)
   - Kalau sudah ada Service Account (mis. `282144058761-compute@developer.gserviceaccount.com` dari screenshot), boleh pakai yang itu — atau buat baru khusus Calendar
4. Buka Service Account → tab **Keys** → **Add Key → Create new key → JSON** → file ke-download otomatis
5. Rename file jadi `google-service-account.json`, taruh di folder `backend/` (sejajar dengan `server.js`)
6. Catat `client_email` di file JSON tersebut (formatnya `xxx@xxx.iam.gserviceaccount.com`)

### ⚠️ WAJIB — Share Calendar per Agent (Multi-Agent)

Service Account **tidak otomatis** punya akses ke calendar pribadi siapa pun — beda dengan API Key
yang (kalaupun bisa dipakai) hanya bisa baca data publik. Setiap agent (Nigel, Leo Felix, dll)
**harus** share Google Calendar mereka sendiri ke Service Account:

1. Agent buka https://calendar.google.com → Settings (⚙️) → pilih calendar mereka di sidebar kiri
2. **Share with specific people or groups** → **Add people**
3. Masukkan `client_email` dari Service Account (langkah 6 di atas)
4. Permission: **Make changes to events**
5. Send

Tanpa langkah ini, request akan gagal dengan error `PERMISSION_DENIED` (403) meskipun kredensial
Service Account valid — event ditulis ke `calendars/{agentEmail}/events`, jadi Service Account
butuh izin eksplisit ke calendar **setiap** agent yang dipakai sistem.

## API Endpoints

### 1. POST `/api/viewing/schedule`

**Buat viewing appointment di Google Calendar.**

**Request:**
```json
{
  "agentUserId": "LFGKT49002",
  "customerName": "Budi Santoso",
  "customerEmail": "budi@example.com",
  "propertyId": "PROP-ABC123",
  "propertyAddress": "Jl. Merdeka No. 42, Surabaya",
  "propertyType": "villa",
  "transactionType": "rent",
  "dateString": "2026-07-19",
  "timeString": "14:00"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Jadwal viewing telah dibuat di Google Calendar untuk 2026-07-19 jam 14:00.",
  "eventId": "abc123def456ghi789",
  "eventLink": "https://calendar.google.com/calendar/u/0/r/eventedit/abc123def456ghi789",
  "agentEmail": "lfgkt49002@example.com",
  "agentName": "Leo Felix",
  "startDateTime": "2026-07-19T14:00:00+07:00"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Agen email tidak ditemukan. Tidak bisa buat jadwal viewing.",
  "error": "MISSING_AGENT_EMAIL"
}
```

**Error Codes:**
- `MISSING_AGENT_EMAIL`: Agen tidak punya email di database
- `INVALID_DATE`: Format dateString tidak valid
- `SERVICE_ACCOUNT_MISSING`: `google-service-account.json` tidak ditemukan/invalid — lihat setup di atas
- `AUTH_FAILED`: Autentikasi Service Account gagal (private_key salah, jam sistem tidak sinkron, dll)
- `PERMISSION_DENIED`: Service Account belum di-share ke calendar agent tersebut (403) — lihat "WAJIB — Share Calendar per Agent"
- `CALENDAR_NOT_FOUND`: Email agent salah, atau calendar belum di-share (404)
- `GOOGLE_ERROR`: Error lain dari Google Calendar API
- `API_ERROR`: Error umum

### 2. POST `/api/viewing/detect`

**Deteksi viewing request dari pesan customer.**

Digunakan oleh AI untuk parsing tanggal/jam dari natural language customer messages.

**Request:**
```json
{
  "message": "Saya mau viewing tanggal 19 Juli jam 2 siang di rumahnya"
}
```

**Response (Has Viewing Request):**
```json
{
  "hasViewingRequest": true,
  "dateString": "2026-07-19",
  "timeString": "14:00",
  "message": "Viewing request terdeteksi."
}
```

**Response (No Viewing Request):**
```json
{
  "hasViewingRequest": false,
  "message": "Tidak ada viewing request terdeteksi."
}
```

## DateTime Detection Patterns

`detectViewingDateTime()` mengenali pola-pola customer ini:

| Pattern | Example | Parse |
|---------|---------|-------|
| Tanggal + Bulan + Jam | "tanggal 19 juli jam 2 siang" | 2026-07-19 14:00 |
| ISO Date + Jam | "2026-07-19 jam 14:00" | 2026-07-19 14:00 |
| Tanggal + Bulan + Jam (short) | "19 juli jam 14" | 2026-07-19 14:00 |

Bulan aliases: `jan/januari`, `peb/februari`, `mar/maret`, `apr/april`, `mei`, `jun/juni`, `jul/juli`, `agu/agustus`, `sep/september`, `okt/oktober`, `nov/november`, `des/desember`.

Jam aliases: `10:00`, `2 siang` → `14:00`, `9 pagi` → `09:00` (parsing sederhana — kalau "pagi/siang/sore/malam" maka tambah/adjust hour).

## Event Details di Calendar

Ketika event terbuat di Google Calendar:

**Summary (Judul):**
- Rent: `"Viewing Sewa Properti"`
- Sale: `"Viewing Beli Properti"`
- Booking: `"Viewing Booking Properti"`

**Description:**
```
Jadwal viewing untuk properti sewa. Customer akan bertemu agen untuk survey unit.

📍 Lokasi: Jl. Merdeka No. 42, Surabaya
🏠 Tipe: villa
👤 Customer: Budi Santoso
🤝 Agen: Leo Felix
```

**Reminders:**
- Email notification **1440 menit sebelum** (24 jam / 1 hari)
- Email notification **180 menit sebelum** (3 jam)

**Attendees:**
- Agen (email dari `users` model, displayName dari `users.name`)
- Customer (jika `customerEmail` disediakan)

**Timezone:** Dari `GOOGLE_CALENDAR_TIMEZONE` (.env, default `Asia/Jakarta`)

## Integration dengan Private Agent (AI)

Di `chatbotPrivateController.js`, setelah customer menjawab pertanyaan qualification + menyebut tanggal/jam viewing:

```javascript
// Detect viewing request dari pesan customer
const viewingDateTime = detectViewingDateTime(userMessage);
if (viewingDateTime) {
  // Panggil API schedule
  const scheduleResult = await axios.post(
    'http://localhost:5000/api/viewing/schedule',
    {
      agentUserId: agentUserId,           // dari session
      customerName: profile.customerName, // dari session
      customerEmail: session?.phone,      // atau ambil dari users.email jika ada
      propertyId: filters.propertyId,     // opsional
      propertyAddress: filters.location,
      propertyType: filters.buildingType,
      transactionType: filters.transactionType,
      dateString: viewingDateTime.dateString,
      timeString: viewingDateTime.timeString,
    }
  );

  if (scheduleResult.data.success) {
    // Kirim konfirmasi ke customer
    reply += '\n\n✅ Jadwal viewing telah dibuat di Google Calendar Anda.';
    reply += '\n📅 ' + scheduleResult.data.startDateTime;
    reply += '\n🔗 ' + scheduleResult.data.eventLink;
  }
}
```

## Database Considerations

### Optional: viewing_schedules Table (untuk audit/history)

```sql
CREATE TABLE viewing_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200),
  customer_email VARCHAR(100),
  property_id VARCHAR(50),
  property_address VARCHAR(500),
  property_type VARCHAR(50),
  transaction_type VARCHAR(20),
  viewing_date DATE,
  viewing_time TIME,
  google_event_id VARCHAR(200),
  google_event_link TEXT,
  status ENUM('scheduled', 'completed', 'cancelled'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES users(user_id),
  INDEX (agent_id, viewing_date)
);
```

Saat ini **tidak wajib** — API hanya buat Google Calendar event. History bisa ambil dari Google Calendar API sendiri atau add table ini nanti.

## Error Handling

### Common Issues & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `SERVICE_ACCOUNT_MISSING` | `google-service-account.json` tidak ada di folder `backend/` | Download JSON key dari Service Account, simpan sesuai `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` |
| `AUTH_FAILED` | private_key rusak / Service Account nonaktif / jam server tidak sinkron | Cek isi JSON, regenerate key jika perlu, sync jam server |
| `PERMISSION_DENIED` | Agent belum share calendar-nya ke Service Account | Agent share Google Calendar → tambahkan `client_email` Service Account, permission "Make changes to events" |
| `CALENDAR_NOT_FOUND` | Email agent di database salah/typo, atau belum di-share | Cek `users.email`, pastikan sama persis dengan akun Google yang di-share |
| `MISSING_AGENT_EMAIL` | User di database tidak punya email | Update `users.email` untuk agen tersebut |
| `INVALID_DATE` | Format tanggal salah | Use format `YYYY-MM-DD` (e.g., `2026-07-19`) |
| Timeout connecting API | Google API slow/down | Retry dengan exponential backoff (built-in) |

## Testing

### Manual Test dengan cURL

```bash
# Test detect viewing request
curl -X POST http://localhost:5000/api/viewing/detect \
  -H "Content-Type: application/json" \
  -d '{"message":"saya mau viewing tanggal 19 juli jam 2 siang"}'

# Test schedule viewing (perlu valid agentUserId + email di database)
curl -X POST http://localhost:5000/api/viewing/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "agentUserId":"LFGKT49002",
    "customerName":"Budi",
    "customerEmail":"budi@example.com",
    "propertyAddress":"Jl. Merdeka",
    "propertyType":"villa",
    "transactionType":"rent",
    "dateString":"2026-07-19",
    "timeString":"14:00"
  }'
```

## Security Notes

1. **API Key scoping:** Restrict Google API key ke `googleapis.com` domain jika memungkinkan
2. **Email validation:** Validate `customerEmail` format sebelum kirim API
3. **Rate limiting:** Endpoint ini tidak ada rate limit default — consider add jika volume tinggi
4. **Data privacy:** Jangan log email/phone ke console di production
5. **Timezone handling:** Ensure `GOOGLE_CALENDAR_TIMEZONE` match lokasi customer untuk avoid confusion

## Future Enhancements

- [ ] Add timezone detection per customer (jika ada location tracking)
- [ ] Add viewing_schedules table untuk audit history
- [ ] Support rescheduling (PATCH event)
- [ ] Support cancellation (DELETE event)
- [ ] Add SMS/WhatsApp confirmation notification (via Fonnte API)
- [ ] Add calendar sync dari Rumah123/other listing sources

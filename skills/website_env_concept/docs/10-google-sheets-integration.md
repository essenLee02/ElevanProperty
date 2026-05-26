# 10. Google Sheets Integration

**Used for:** Contact form submission backup (non-blocking — silent fail, does not affect user response).

---

## Environment Variables

```env
GOOGLE_SHEET_ID=1nwy276VXH0JvDZVOoddBbqmr9jwpydoKrukWY2Jukw4
GOOGLE_SHEET_GID=0
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json
```

---

## Setup (First Time)

### 1. Google Cloud — Create Service Account

```
1. https://console.cloud.google.com → New project (e.g., "Elevan Property")
2. APIs & Services → Enable: Google Sheets API + Google Drive API
3. IAM & Admin → Service Accounts → Create Service Account
   - Name: "elevan-sheets"
   - Role: Editor
4. Create JSON key → Download → save as backend/google-service-account.json
```

### 2. Share Google Sheet with Service Account

```
1. Copy the email from JSON: "client_email": "abc@xyz.iam.gserviceaccount.com"
2. Open your Google Sheet
3. Share → paste service account email → Editor role
4. Copy Sheet ID from URL: https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
5. Set GOOGLE_SHEET_ID in .env
```

---

## googleSheetsService.js

`backend/services/googleSheetsService.js`

### Key Methods

```javascript
// Append a contact form row (non-blocking in contactController)
appendContactRow(contactData)
// contactData: { timestamp, name, phone, email, subject, message, source }

// Check connection
getGoogleSheetsStatus()
// Returns: { connected: bool, error: string | null }
```

### How It's Used in Contact Form

```javascript
// backend/controllers/contactController.js
// Non-blocking: fire and forget
googleSheetsService.appendContactRow({
  timestamp: new Date().toLocaleString('id-ID'),
  name: contactData.name,
  phone: contactData.phone,
  email: contactData.email,
  subject: contactData.subject,
  message: contactData.message,
  source: 'website-form'
}).catch(err => {
  // Log error but DON'T fail the request
  console.error('[SHEETS] append failed:', err.message);
});
```

---

## Recommended Sheet Structure

**Sheet tab: "Submissions"**
```
| Timestamp | Name | Phone | Email | Subject | Message | Source |
|-----------|------|-------|-------|---------|---------|--------|
| 26/05/2026 10:00 | Budi | 62821... | budi@email.com | ... | Cari rumah... | website-form |
```

Headers in row 1 (manually set once):
- A1: Timestamp
- B1: Name
- C1: Phone
- D1: Email
- E1: Subject
- F1: Message
- G1: Source

---

## Error Handling & Fallback

```javascript
async function appendWithFallback(rowData) {
  try {
    return await googleSheetsService.appendContactRow(rowData);
  } catch (error) {
    // Fallback: log to local file if Sheets fails
    console.warn('[SHEETS FALLBACK] Sheets unavailable, logging locally');
    // Contact is already saved to MySQL — this is just a backup
  }
}
```

---

## Status Check

```
GET /api/contact/google-sheets-status
```

Returns:
```json
{
  "connected": true,
  "sheetId": "1nwy276VX...",
  "tabName": "Submissions"
}
```

---

## Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Auth error | Invalid credentials | Check `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` path |
| Permission denied | Not shared with service account | Share sheet with service account email (Editor) |
| Append fails | Sheet tab doesn't exist | Create "Submissions" tab manually first |
| Missing columns | Data mismatch | Verify headers match `formatRow()` column order |
| Rate limited | Too many requests | Implement delay between appends |

---

## Important Notes

- ✅ **Non-blocking**: Contact form returns 200 even if Sheets fails
- ✅ **MySQL is primary**: Contact always saved to `contacts` table first
- ✅ **Sheets is backup only**: Never block the user response for Sheets
- ✅ **Keep JSON key private**: `google-service-account.json` must NOT be committed to git

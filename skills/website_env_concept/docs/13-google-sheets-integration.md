# 13. Google Sheets Integration — Complete Guide

**Complete integration guide for Google Sheets API with contact form submissions, non-blocking operations, and production setup.**

---

## What is Google Sheets API?

Allows you to:
- Append rows to spreadsheets
- Read data from sheets
- Update cells
- Create new sheets
- Manage permissions

**Official Docs**: https://developers.google.com/sheets/api

---

## Setup: Getting Started

### 1. Create Google Cloud Project

```bash
# Go to https://console.cloud.google.com
# Create new project
# Name: "ElevanLabs Property"
# Enable Sheets API
# Enable Drive API
```

### 2. Create Service Account

```bash
# Console → IAM & Admin → Service Accounts
# Create Service Account
# Name: "elevan-sheets"
# Grant role: Editor

# Create JSON key
# Download JSON file
# Save as: backend/config/google-service-account.json
```

### 3. Share Google Sheet with Service Account

```bash
# Copy email from JSON: "client_email": "abc@xyz.iam.gserviceaccount.com"
# Open Google Sheet
# Share with that email address
# Grant Editor access
```

### 4. Environment Variables

```env
GOOGLE_SHEET_ID=1ABC2DEF3GHI4JKL5MNO6PQR7STU8VWX  # From sheet URL
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./config/google-service-account.json
```

---

## Google Sheets Service Class

### Complete Implementation

```javascript
// backend/services/sheetsService.js

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class SheetsService {
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
    this.keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
    this.sheetsApi = null;
    this.auth = null;
  }

  /**
   * Initialize Google Sheets client
   * Must be called once before using other methods
   */
  async initialize() {
    if (this.sheetsApi) return; // Already initialized

    try {
      const keyFile = path.resolve(this.keyPath);
      const keyData = JSON.parse(fs.readFileSync(keyFile, 'utf8'));

      const auth = new google.auth.GoogleAuth({
        keyFile: this.keyPath,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive'
        ]
      });

      this.auth = auth;
      this.sheetsApi = google.sheets({ version: 'v4', auth });
      logger.info('Google Sheets client initialized');
    } catch (error) {
      logger.error('Failed to initialize Google Sheets:', error.message);
      throw error;
    }
  }

  /**
   * Append row to sheet
   * Non-blocking - safe to fire and forget
   * @param {object} rowData - Data to append
   * @param {string} sheetName - Sheet tab name (default: Sheet1)
   * @returns {Promise}
   */
  async appendRow(rowData, sheetName = 'Sheet1') {
    await this.initialize();

    try {
      const values = [this.formatRow(rowData)];

      const response = await this.sheetsApi.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`, // Append to all columns
        valueInputOption: 'RAW', // Don't interpret formulas
        requestBody: { values }
      });

      logger.info(`Row appended to ${sheetName}:`, response.data.updates);

      return {
        success: true,
        updatedRows: response.data.updates?.updatedRows || 0,
        spreadsheetId: response.data.spreadsheetId
      };
    } catch (error) {
      logger.error('Sheets append error:', error.message);
      throw error;
    }
  }

  /**
   * Append multiple rows (batch)
   * @param {Array<object>} rows - Array of row data
   * @param {string} sheetName - Sheet tab name
   * @returns {Promise}
   */
  async appendRows(rows, sheetName = 'Sheet1') {
    await this.initialize();

    try {
      const values = rows.map(row => this.formatRow(row));

      const response = await this.sheetsApi.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'RAW',
        requestBody: { values }
      });

      logger.info(`${rows.length} rows appended to ${sheetName}`);

      return {
        success: true,
        updatedRows: response.data.updates?.updatedRows || 0
      };
    } catch (error) {
      logger.error('Sheets batch append error:', error.message);
      throw error;
    }
  }

  /**
   * Read data from sheet
   * @param {string} range - Range to read (e.g., "Sheet1!A1:Z100")
   * @returns {Promise}
   */
  async readRange(range) {
    await this.initialize();

    try {
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range
      });

      return {
        success: true,
        values: response.data.values || [],
        range: response.data.range
      };
    } catch (error) {
      logger.error('Sheets read error:', error.message);
      throw error;
    }
  }

  /**
   * Update cell value
   * @param {string} range - Cell range (e.g., "Sheet1!A1")
   * @param {string} value - New value
   * @returns {Promise}
   */
  async updateCell(range, value) {
    await this.initialize();

    try {
      const response = await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[value]]
        }
      });

      return {
        success: true,
        updatedCells: response.data.updatedCells
      };
    } catch (error) {
      logger.error('Sheets update error:', error.message);
      throw error;
    }
  }

  /**
   * Clear sheet data
   * @param {string} range - Range to clear
   * @returns {Promise}
   */
  async clearRange(range) {
    await this.initialize();

    try {
      const response = await this.sheetsApi.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: range
      });

      return {
        success: true,
        clearedRange: response.data.clearedRange
      };
    } catch (error) {
      logger.error('Sheets clear error:', error.message);
      throw error;
    }
  }

  /**
   * Format row data for sheets
   * Converts object to array in correct column order
   * @param {object} rowData - Data object
   * @returns {Array}
   */
  formatRow(rowData) {
    // Define column order (must match sheet headers)
    const columns = [
      'timestamp',
      'name',
      'phone',
      'email',
      'message',
      'location',
      'source'
    ];

    return columns.map(col => {
      const value = rowData[col];

      // Format timestamp if not provided
      if (col === 'timestamp' && !value) {
        return new Date().toLocaleString('id-ID');
      }

      return value || '';
    });
  }

  /**
   * Create new sheet tab
   * @param {string} sheetTitle - Name of new sheet
   * @returns {Promise}
   */
  async createSheet(sheetTitle) {
    await this.initialize();

    try {
      const response = await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetTitle,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 26
                }
              }
            }
          }]
        }
      });

      return {
        success: true,
        sheetId: response.data.replies[0].addSheet.properties.sheetId
      };
    } catch (error) {
      logger.error('Sheets create sheet error:', error.message);
      throw error;
    }
  }

  /**
   * Get sheet headers
   * @param {string} sheetName - Sheet tab name
   * @returns {Promise}
   */
  async getHeaders(sheetName = 'Sheet1') {
    await this.initialize();

    try {
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!1:1` // First row only
      });

      return {
        success: true,
        headers: response.data.values?.[0] || []
      };
    } catch (error) {
      logger.error('Sheets get headers error:', error.message);
      throw error;
    }
  }
}

module.exports = new SheetsService();
```

---

## Contact Form Integration

### Save Contact Submissions

```javascript
// backend/controllers/contactController.js

const sheetsService = require('../services/sheetsService');
const fonnteService = require('../services/fonnteService');

async function handleContactSubmission(req, res) {
  try {
    const { name, phone, email, message, location } = req.body;

    // Validate input
    if (!name || !phone || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Prepare data
    const contactData = {
      timestamp: new Date().toLocaleString('id-ID'),
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      message: message.trim(),
      location: location || '',
      source: 'website-form'
    };

    // 1. Save to Google Sheets (non-blocking)
    sheetsService.appendRow(contactData, 'Submissions')
      .catch(err => {
        logger.error('Failed to save to Sheets:', err.message);
        // Don't fail the request if Sheets fails
      });

    // 2. Send WhatsApp notification to admin (non-blocking)
    const whatsappMessage = `
📋 *Formulir Kontak Baru*

Nama: ${contactData.name}
WhatsApp: ${contactData.phone}
Email: ${contactData.email}
Lokasi: ${contactData.location || 'Tidak disebutkan'}

Pesan:
${contactData.message}

Hubungi untuk follow-up.
    `;

    fonnteService.sendAdminNotification('Kontak Baru dari Website', whatsappMessage)
      .catch(err => logger.error('Failed to send WhatsApp:', err.message));

    // 3. Send confirmation email to user (non-blocking)
    emailService.sendConfirmationEmail(email, name)
      .catch(err => logger.error('Failed to send email:', err.message));

    // Return success immediately (don't wait for background tasks)
    res.json({
      success: true,
      message: 'Terima kasih! Kami akan menghubungi Anda segera.'
    });
  } catch (error) {
    logger.error('Contact submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process submission'
    });
  }
}

module.exports = { handleContactSubmission };
```

---

## Setup Google Sheet Structure

### Recommended Sheet Tabs

**Sheet 1: Submissions** (Contact form data)
```
| Timestamp | Name | Phone | Email | Message | Location | Source |
|-----------|------|-------|-------|---------|----------|--------|
| 2026-05-18 10:00 | Budi | 62821234567 | budi@email.com | Interested in... | Jakarta | website |
```

**Sheet 2: Chat History** (WhatsApp conversations)
```
| Timestamp | Phone | UserMessage | AIResponse | Status |
|-----------|-------|-------------|-----------|--------|
| 2026-05-18 10:00 | 62821234567 | Cari rumah di Surabaya | Berikut rekomendasi... | sent |
```

**Sheet 3: Analytics** (Stats and summaries)
```
| Date | TotalContacts | TotalChats | ConversionsToAgent |
|------|---------------|-----------|-------------------|
| 2026-05-18 | 5 | 23 | 2 |
```

### Create with Formulas

```
Headers row (don't data to this):
A1: Timestamp
B1: Name
C1: Phone
D1: Email
E1: Message
F1: Location
G1: Source

Data starts from row 2:
A2: =TODAY()
[subsequent rows auto-populated]
```

---

## Usage Examples

### Example 1: Save Contact with Timestamp

```javascript
const sheetsService = require('../services/sheetsService');

async function saveContact(contactData) {
  const rowData = {
    timestamp: new Date().toLocaleString(),
    name: contactData.name,
    phone: contactData.phone,
    email: contactData.email,
    message: contactData.message,
    location: contactData.location || 'N/A',
    source: 'website'
  };

  return await sheetsService.appendRow(rowData, 'Submissions');
}
```

### Example 2: Save Chat History

```javascript
async function saveChatHistory(sessionId, userMessage, aiResponse) {
  const rowData = {
    timestamp: new Date().toLocaleString(),
    sessionId: sessionId,
    userMessage: userMessage.substring(0, 200), // Limit length
    aiResponse: aiResponse.substring(0, 200),
    status: 'logged'
  };

  return await sheetsService.appendRow(rowData, 'Chat History');
}
```

### Example 3: Batch Save Multiple Rows

```javascript
async function saveBatchContacts(contactsArray) {
  const rows = contactsArray.map(contact => ({
    timestamp: new Date().toLocaleString(),
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    message: contact.message,
    location: contact.location || 'N/A',
    source: 'import'
  }));

  return await sheetsService.appendRows(rows, 'Submissions');
}
```

---

## Error Handling

```javascript
async function appendWithFallback(rowData, primarySheet, fallbackFile) {
  try {
    // Try Google Sheets first
    return await sheetsService.appendRow(rowData, primarySheet);
  } catch (error) {
    logger.warn('Sheets failed, using fallback:', error.message);

    // Fallback: save to local JSON file
    try {
      const backup = JSON.parse(fs.readFileSync(fallbackFile, 'utf8') || '[]');
      backup.push(rowData);
      fs.writeFileSync(fallbackFile, JSON.stringify(backup, null, 2));
      return { success: true, fallback: true };
    } catch (fallbackError) {
      logger.error('Both Sheets and fallback failed:', fallbackError.message);
      throw fallbackError;
    }
  }
}
```

---

## Testing

### Manual Test

```bash
# Test append to sheets
curl -X POST http://localhost:3000/api/test/sheets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "phone": "62821234567",
    "email": "test@example.com",
    "message": "Test message"
  }'

# Test read from sheets
curl http://localhost:3000/api/test/sheets/read
```

### Unit Test

```javascript
// test/sheets.test.js

describe('SheetsService', () => {
  it('should format row data correctly', () => {
    const data = {
      name: 'John',
      phone: '62821234567',
      email: 'john@email.com'
    };

    const formatted = sheetsService.formatRow(data);
    expect(formatted.length).toBe(7); // 7 columns
  });

  it('should append row successfully', async () => {
    const result = await sheetsService.appendRow({
      name: 'Test',
      phone: '62821234567',
      email: 'test@email.com',
      message: 'Test message'
    });

    expect(result.success).toBe(true);
    expect(result.updatedRows).toBeGreaterThan(0);
  });
});
```

---

## Best Practices

✅ **Non-blocking**: Fire and forget for form submissions  
✅ **Validate**: Always validate data before appending  
✅ **Format dates**: Use consistent date format  
✅ **Fallback**: Have backup (local file) if Sheets fails  
✅ **Limit size**: Don't append huge messages (use substring)  
✅ **Batch operations**: Use appendRows for multiple records  
✅ **Keep clean**: Archive old data periodically  
✅ **Monitor**: Log all append operations  

---

## Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Auth error** | Invalid credentials | Check GOOGLE_SERVICE_ACCOUNT_JSON_PATH |
| **Permission denied** | Not shared with service account | Share sheet with service account email |
| **Append fails** | Sheet tab doesn't exist | Create tab first or use existing name |
| **Missing columns** | Data structure mismatch | Verify formatRow() column order |
| **Rate limited** | Too many requests | Implement exponential backoff |
| **Data cut off** | String too long | Use substring() to limit length |

---

## Security

- ✅ **Keep JSON key private** (never commit to repo)
- ✅ **Use service account** (not personal account)
- ✅ **Validate input** before appending
- ✅ **Log operations** for audit trail
- ✅ **Monitor sheet size** (don't let it grow infinitely)
- ✅ **Archive data** periodically
- ✅ **Restrict access** to service account email only

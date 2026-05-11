# 07 — Google Sheets Integration

## 1. Purpose

Google Sheets is used to record leads and contact form submissions.

## 2. Required Service

```text
backend/services/googleSheetsService.js
```

### Main Functions

```text
appendContactRow(contactData)
getGoogleSheetsStatus()
ensureHeaderRow()
getTargetSheet()
```

## 3. Required Backend `.env`

```env
GOOGLE_SHEET_ID=
GOOGLE_SHEET_GID=0
GOOGLE_SHEET_TAB_NAME=
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json
```

## 4. Required Setup

1. Enable Google Sheets API.
2. Create a Google Service Account.
3. Download the Service Account JSON file.
4. Rename the file to:

```text
google-service-account.json
```

5. Place the file in:

```text
backend/google-service-account.json
```

6. Open the JSON file and copy `client_email`.
7. Open the Google Spreadsheet.
8. Click Share.
9. Add the `client_email` as Editor.

## 5. Required Spreadsheet Header

```text
Timestamp | Name | Email | Phone | Subject | Message | Source
```

## 6. Contact Row Data

When the Contact Form is submitted, the following data is sent to Google Sheets:

```text
Timestamp
Name
Email
Phone
Subject
Message
Source
```

## 7. Google Sheets Status Endpoint

```text
GET /api/contact/google-sheets-status
```

## 8. Common Errors

### 401 Unauthorized

Common causes:

- Using the spreadsheet edit URL instead of the API.
- Invalid credential.
- Wrong Service Account JSON file.
- Google Sheets API is not enabled.

### 403 Permission Denied

Common causes:

- The spreadsheet has not been shared with the service account.
- The shared service account email is different from the active JSON file.
- The service account permission is not Editor.

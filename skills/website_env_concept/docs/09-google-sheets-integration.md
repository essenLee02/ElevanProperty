# 09 — Google Sheets Integration

## Purpose

Google Sheets stores Contact Form leads.

## Environment

```env
GOOGLE_SHEET_ID=
GOOGLE_SHEET_GID=0
GOOGLE_SHEET_TAB_NAME=
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json
```

## Service Account Setup

1. Enable Google Sheets API.
2. Create Google Service Account.
3. Download JSON credential.
4. Save as:

```text
backend/google-service-account.json
```

5. Copy the service account `client_email`.
6. Share the Google Spreadsheet to that email as Editor.

## Required Sheet Header

```text
Timestamp | Name | Email | Phone | Subject | Message | Source
```

## Common Errors

### 403 Permission Denied

Meaning:

```text
The spreadsheet is not shared with the service account as Editor.
```

### 401 Unauthorized

Possible causes:

```text
wrong credential
invalid private key
wrong auth setup
```

## Security Rule

Never expose Google private key or service account JSON to frontend.

# Google Sheets Troubleshooting

## 403 Permission Error

Meaning:

```text
Service account does not have access to the spreadsheet.
```

Fix:

```text
Open Google Spreadsheet
Click Share
Add service account client_email as Editor
Restart backend
Test /api/contact/google-sheets-status
```

## 404 Spreadsheet Not Found

Possible causes:

```text
wrong GOOGLE_SHEET_ID
spreadsheet not shared with service account
```

## Missing Header

Required header:

```text
Timestamp | Name | Email | Phone | Subject | Message | Source
```

If sheet is blank, current backend attempts to create the header automatically.

If header exists but is incomplete, backend returns a clear error.

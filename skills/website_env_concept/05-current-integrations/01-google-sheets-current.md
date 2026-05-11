# Google Sheets Current Integration

## Current Status

Implemented.

## Backend File

```text
backend/controllers/contactController.js
```

## Libraries

```text
google-spreadsheet
google-auth-library
```

## Auth Method

The current code uses Google Service Account JSON and JWT.

## Required Spreadsheet Header

```text
Timestamp | Name | Email | Phone | Subject | Message | Source
```

## Current Contact Row

The backend adds:

```text
Timestamp
Name
Email
Phone
Subject
Message
Source = Website Contact Form
```

## Status Endpoint

```text
GET /api/contact/google-sheets-status
```

Current success message:

```text
Google Sheets connection is OK.
```

## Permission Error Handling

The current code gives clear instruction to share the spreadsheet with the service account email as Editor.

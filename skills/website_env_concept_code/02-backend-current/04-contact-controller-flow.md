# Current Contact Controller Flow

## File

```text
backend/controllers/contactController.js
```

## Required Fields

```text
name
email
phone
subject
message
```

## Current Flow

```text
POST /api/contact
→ sanitize request body
→ log FORM_SUBMIT_ATTEMPT to console
→ validate blank required fields
→ submit data to Google Sheets first
→ create Contact row in MySQL
→ log FORM_SUBMIT_SUCCESS to console
→ return success response
```

## Important Behavior

Google Sheets is submitted first.

Reason in the code comment:

```text
This prevents duplicate MySQL rows when Google permission is not ready.
```

## Current Success Response

```json
{
  "success": true,
  "message": "Message received, sent to Google Spreadsheet, and saved to database successfully!"
}
```

## Current Error Response

```json
{
  "success": false,
  "error": "error message"
}
```

## Current Limitations

This controller does not currently:

```text
call ChatGPT
send WhatsApp through Fonnte
create chatbot session
save conversation history
```

# Current Backend Controllers

## `homeController.js`

Current response:

```json
{
  "message": "Welcome to Home Page API"
}
```

The frontend Home page does not currently consume this API.

## `aboutController.js`

Current response:

```json
{
  "message": "Welcome to About Us API"
}
```

The frontend About page does not currently consume this API for portfolio data.

## `contactController.js`

This is the main implemented business controller.

It handles:

```text
contact field sanitization
required field validation
Google Sheets configuration
Google Service Account JSON reading
Google Spreadsheet connection
Google Sheet header validation/creation
Google Sheets row append
MySQL Contact.create()
Google Sheets status check
Google permission error messages
```

## `logController.js`

Current behavior:

```text
reads action and details from request body
prints activity to console
returns { success: true }
```

Important note:

Although a `Log` model exists, `logController.js` currently does not save logs to MySQL.

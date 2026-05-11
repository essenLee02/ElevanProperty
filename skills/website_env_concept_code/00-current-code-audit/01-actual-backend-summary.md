# Actual Backend Summary

## Current Backend Stack

Based on the current `backend/package.json`, the backend uses:

```text
express
cors
dotenv
axios
sequelize
mysql2
google-auth-library
google-spreadsheet
nodemon
```

## Current Backend Entry Point

```text
backend/server.js
```

Current behavior:

```text
load dotenv
create Express app
enable CORS
enable JSON body parser
sync Sequelize database
mount /api routes
start server on PORT or 5000
```

## Current Backend Routes

Defined in:

```text
backend/routes/index.js
```

Available routes:

```text
GET  /api/home
GET  /api/about
POST /api/contact
GET  /api/contact/google-sheets-status
POST /api/log
```

## Current Controllers

```text
backend/controllers/homeController.js
backend/controllers/aboutController.js
backend/controllers/contactController.js
backend/controllers/logController.js
```

## Current Models

```text
backend/models/Contact.js
backend/models/Log.js
```

## Current Backend Limitations

The current backend does not yet include:

```text
/chatbot/message route
/fonnte/webhook route
OpenAI service
Fonnte service
separate Google Sheets service
validation service
session service
property recommendation service
ChatSession model
ChatMessage model
Property model
```

These items should be treated as planned development, not current behavior.

# Backend Server and Routes

## Server File

```text
backend/server.js
```

## Current Server Flow

```text
require dotenv
create Express app
enable CORS
enable express.json()
sequelize.sync()
app.use('/api', routes)
app.listen(PORT)
```

## Route File

```text
backend/routes/index.js
```

## Current API Routes

```text
GET  /api/home
GET  /api/about
POST /api/contact
GET  /api/contact/google-sheets-status
POST /api/log
```

## Not Available Yet

These routes are not in the current code:

```text
POST /api/chatbot/message
POST /api/fonnte/webhook
GET  /api/contact/ai-whatsapp-status
GET  /api/properties
```

They should be documented as future development only.

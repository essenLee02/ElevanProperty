# 12. Deployment & Troubleshooting

## Start Commands

```bash
# Backend (port 5005)
cd backend
npm install
node server.js          # production
# or: npm run dev       # development with nodemon

# Frontend (port 5173)
cd frontend
npm install
npm run dev             # development
npm run build           # production → outputs to frontend/dist/
```

---

## Pre-Deploy Checklist

- [ ] Set real `ANTHROPIC_API_KEY` (currently placeholder — Claude fallback disabled)
- [ ] Set real `OPENAI_API_KEY` (check quota remaining)
- [ ] Set `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` (ensure file exists at path)
- [ ] Set real `FONNTE_TOKEN` (test by checking Fonnte dashboard)
- [ ] Set `WATI_API_TOKEN` + `WATI_API_URL` (for agent-chat feature)
- [ ] Enable `secure: true` on refresh token cookie in `loginController.js` (HTTPS required)
- [ ] Replace `0.0.0.0` in CORS `allowedOrigins` in `server.js` with your production domain
- [ ] Consider moving access token from localStorage to memory-only in `authApi.js`
- [ ] Verify `backend/google-service-account.json` is NOT committed to git (add to .gitignore)

---

## NGROK (Development Only)

Used to expose `localhost:5005` to internet for WATI webhooks during development.

```powershell
# Terminal 1: Setup NGROK (one-time)
ngrok config add-authtoken 3CTVG7OWPXEAjVWgRhHIyH8XUsc_5YbFsXj2DTR7Lsb6uZiSD

# Terminal 1: Start NGROK each session
ngrok http 5005
# → Gives new URL: https://xxxx-xxxx.ngrok-free.app

# NGROK dashboard (see traffic): http://127.0.0.1:4040
```

> ⚠️ **Free NGROK = new URL each restart.** Must re-update WATI webhook URL after each restart.

### Update WATI Webhook (Postman or curl)

```powershell
curl -X POST https://live.wati.io/10167096/api/v1/setWebhook ^
  -H "Authorization: Bearer WATI_API_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"webhookUrl\": \"https://NEW_NGROK_URL/api/wati/webhook\"}"
```

In production: use a fixed domain (no NGROK needed).

---

## Production Frontend Deployment

```bash
cd frontend && npm run build
# Serves frontend/dist/ via nginx or static host
```

### Nginx Config (example)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve frontend
    root /path/to/frontend/dist;
    try_files $uri $uri/ /index.html;

    # Proxy API to backend
    location /api {
        proxy_pass http://localhost:5005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Common Issues

| Issue | Cause | Solution |
|---|---|---|
| AI returns 502 | OpenAI quota + Claude placeholder key | Add real `ANTHROPIC_API_KEY` |
| Contact form fails | Fonnte token invalid | Check `FONNTE_TOKEN` in `.env` |
| Google Sheets not saving | Service account not shared | Share sheet with service account email |
| WATI webhook not firing | WhatsApp channel not connected | Connect channel in WATI dashboard |
| WATI webhook wrong URL | NGROK URL changed after restart | Re-run `setWebhook` with new NGROK URL |
| Rumah123 empty results | Apify quota exceeded | Set `RUMAH123_DATA=OFF` for static JSON |
| JWT expired on refresh | `REFRESH_TOKEN_EXPIRY` too short | Default is 1d — check `.env` |
| Login returns 403 | User status=2 (blocked) or 3 (deleted) | Check users table in phpMyAdmin |
| Database not syncing | MySQL not running | Start MySQL (XAMPP/MariaDB) |

---

## Database Reset (Development)

```sql
-- Reset and recreate tables (data will be lost!)
DROP DATABASE db_property;
CREATE DATABASE db_property;
-- Then start backend: Sequelize sync({ alter: true }) recreates tables
```

---

## Service Status Checks

All status endpoints return JSON:

```
GET /api/chatbot/ai-provider-status    ← ChatGPT + Claude config
GET /api/chatbot/skill-status          ← skill .md files loaded
GET /api/chatbot/private-status        ← private agent working
GET /api/contact/google-sheets-status  ← Sheets connection
GET /api/contact/ai-whatsapp-status    ← AI + Fonnte config
GET /api/wati/status                   ← WATI API connection
GET /api/rumah123/cache-status         ← Apify cache contents
```

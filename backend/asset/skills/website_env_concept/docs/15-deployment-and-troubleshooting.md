# 15. Deployment & Troubleshooting

## Start Commands

```bash
# Backend (port 5055)
cd backend
npm install
npm run dev             # nodemon (dev); node server.js untuk production
# NGROK_ENABLE=true → URL tunnel muncul otomatis di terminal backend ini

# Frontend (port 5173) — VITE_BACKEND_PORT harus 5055
cd frontend
npm install
npm run dev             # development (data properti via backend API)
npm run build           # production → outputs to frontend/dist/
```

---

## Pre-Deploy Checklist

- [ ] Set key untuk `AI_PRIMARY_PROVIDER` yang dipilih (DEEPSEEK/QWEN/OPENAI/ANTHROPIC) + cek kuota
- [ ] Set `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` (ensure file exists at path)
- [ ] Set real `FONNTE_TOKEN` / `KIRIMI_USER_CODE`+`KIRIMI_SECRET` / `TIMELINESAI_API_KEY`
- [ ] Set `MESSAGE_TERMINAL` + `MASSEGE_TERMINAL` sesuai platform aktif
- [ ] `NGROK_ENABLE=false` di production (pakai domain tetap)
- [ ] Enable `secure: true` on refresh token cookie in `loginController.js` (HTTPS required)
- [ ] Replace `0.0.0.0` in CORS `allowedOrigins` in `server.js` with your production domain
- [ ] Consider moving access token from localStorage to memory-only in `authApi.js`
- [ ] Verify `backend/google-service-account.json` is NOT committed to git (add to .gitignore)

---

## ngrok (Development Only) — auto-start dari backend

Expose `localhost:5055` ke internet untuk webhook WhatsApp (Kirimi/TimelinesAI/Fonnte)
saat development. Sekarang **ngrok dijalankan otomatis oleh backend** sebagai child
process — tidak perlu window ngrok.exe terpisah.

```env
NGROK_ENABLE=true            # backend jalankan `ngrok http 5055 --log=stdout --log-format=json`
# NGROK_DOMAIN=...           # opsional reserved domain (paid); URL tetap antar restart
# NGROK_REGION=ap            # opsional
```

Implementasi: `backend/services/ngrokService.js` (`startNgrok`/`stopNgrok`). URL tunnel
di-parse dari output JSON dan dicetak ke terminal backend; banner Kirimi otomatis
menampilkan `<url>/api/kirimi/webhook`. Shutdown backend (SIGINT/SIGTERM) mematikan ngrok.

```powershell
# One-time: daftarkan authtoken (jika belum)
ngrok config add-authtoken <TOKEN>
# ngrok dashboard traffic: http://127.0.0.1:4040
```

> ⚠️ **Free ngrok = 1 tunnel & URL baru tiap restart.** Pastikan tak ada ngrok.exe
> manual lain yang jalan (error `ERR_NGROK_334` = endpoint sudah online). Update URL
> webhook di dashboard platform (Kirimi/TimelinesAI/Fonnte) tiap restart.

In production: use a fixed domain (no ngrok needed).

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
        proxy_pass http://localhost:5055;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Common Issues

| Issue | Cause | Solution |
|---|---|---|
| AI returns 502 | Primary AI gagal + Private Agent off | Cek key `AI_PRIMARY_PROVIDER` + `ENABLE_CHATBOT_PRIVATE_CONTROLLER=true` |
| Nama model korup | Komentar inline setelah nilai model di `.env` | Hapus `# ...` di baris `*_MODEL`; jangan hardcode di kode |
| `source: fonnte_whatsapp` padahal KIRIMI | Backend belum restart / `MESSAGE_TERMINAL` salah | Set `MESSAGE_TERMINAL=KIRIMI` lalu restart |
| Contact form fails | Fonnte token invalid | Check `FONNTE_TOKEN` in `.env` |
| Google Sheets not saving | Service account not shared | Share sheet with service account email |
| Webhook WA salah URL | ngrok URL berubah tiap restart | Update URL webhook di dashboard Kirimi/TimelinesAI/Fonnte |
| `ERR_NGROK_334` | ada ngrok.exe manual lain masih jalan | Matikan proses ngrok lama (free plan = 1 tunnel) |
| Frontend `ECONNREFUSED /json_data` | port salah / frontend fetch JSON | Set `VITE_BACKEND_PORT=5055`; About kini pakai `GET /api/about` |
| Rumah123 empty results | Apify quota exceeded | Set `RUMAH123_DATA=OFF` for static JSON |
| JWT expired on refresh | `REFRESH_TOKEN_EXPIRY` too short | Default is 1d — check `.env` |
| Login returns 403 | User status=2 (blocked) or 3 (deleted) | Check users table in phpMyAdmin |
| Database not syncing | MySQL not running | Start MySQL (XAMPP/MariaDB) |
| WhatsApp mengirim generic template | Import salah di whatsappAIService | Pastikan import `generateWhatsappReplyWithProviderFallback` dari `aiProviderService` (bukan fungsi individual) |
| "saya beli" tidak dibalas WA | Tidak ada context continuation check | Pastikan controller import `isPropertyContextContinuation` + `getConversationHistory` |
| Terminal hanya 80 char | Kode lama pakai `.substring(0, 80)` | Hapus truncation, gunakan `console.log(aiResult.reply)` |
| 360dialog tidak dapat agent | `dialog360_token` NULL di DB | `UPDATE users SET dialog360_token='KEY' WHERE name='...'` |
| Private Agent balas generic | Menggunakan fungsi lama | Pastikan `whatsappAIService` panggil `generatePrivateTerminalMassege` (bukan `generatePrivateWhatsappReply`) |
| `generatePrivateTerminalMassege is not a function` | Export belum ada | Cek `module.exports.generatePrivateTerminalMassege` di `chatbotPrivateController.js` |

---

## Syntax Check Cepat

```bash
# Sebelum deploy, cek semua file yang sering berubah:
node --check backend/utils/propertyKeywordFilter.js
node --check backend/services/whatsappAIService.js
node --check backend/controllers/chatbotPrivateController.js
node --check backend/controllers/fonnteChatController.js
node --check backend/controllers/kirimiChatController.js
node --check backend/controllers/timelinesAIChatController.js
node --check backend/services/deepseekService.js
node --check backend/services/ngrokService.js

# Verifikasi exports
node -e "
const x = require('./backend/controllers/chatbotPrivateController');
console.log('generatePrivateChatbotResponse:', typeof x.generatePrivateChatbotResponse);
console.log('generatePrivateTerminalMassege:', typeof x.generatePrivateTerminalMassege);
"
```

---

## Database Reset (Development)

```sql
-- Reset and recreate tables (data will be lost!)
DROP DATABASE db_property;
CREATE DATABASE db_property;
-- Then start backend: Sequelize sync() + ensureRequiredDatabaseColumns() recreates tables
```

---

## Service Status Checks

All status endpoints return JSON:

```
GET /api/chatbot/ai-provider-status    ← status semua provider (chatgpt/claude/qwen/deepseek) + private
GET /api/chatbot/skill-status          ← skill .md files loaded
GET /api/chatbot/private-status        ← private agent working
GET /api/contact/google-sheets-status  ← Sheets connection
GET /api/contact/ai-whatsapp-status    ← AI + Fonnte config
GET /api/kirimi/status                 ← Kirimi API/agent status
GET /api/timelinesai/status            ← TimelinesAI status
GET /api/rumah123/cache-status         ← Apify cache contents
```

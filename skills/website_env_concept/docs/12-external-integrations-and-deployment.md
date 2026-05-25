# 12. External Integrations & Deployment

## Fonnte (WhatsApp)

**Used for:**
- Sending AI-generated replies to customers (contact form + Fonnte webhook)
- Receiving messages from customers on agent WhatsApp numbers (webhook)

**Service:** `backend/services/fonnteService.js`
```javascript
sendWhatsAppMessage(phone, message)
// POST https://api.fonnte.com/send
// Header: Authorization: FONNTE_TOKEN
// Body: { target: phone, message, countryCode: '62' }
```

**Webhook endpoints:**
| Path | Controller | Purpose |
|---|---|---|
| POST /api/fonnte/webhook | fonnteWebhookController | Fonnte AI reply (external webhook) |
| POST /api/whatsapp/webhook | whatsappInboundController | Agent inbound messages |

**5 Agent Numbers:**
| Name | Normalized Phone |
|---|---|
| Clarence | 6282111367154 |
| Desy | 6282113318191 |
| Nigel | 6282233556796 |
| Natasha | 6282223058788 |
| Leo | 6281334708691 |

**Troubleshooting:**
- Messages not sent → check `FONNTE_TOKEN` in `.env`
- Webhook not received → verify webhook URL in Fonnte dashboard (Settings → Webhook)
- Phone format → must be `628...` not `08...`

---

## Google Sheets

**Used for:** Contact form submission backup (non-blocking)

**Service:** `backend/services/googleSheetsService.js`
- Uses `google-spreadsheet` npm package
- Credentials: `backend/google-service-account.json` (download from Google Cloud)
- Sheet ID: `GOOGLE_SHEET_ID` in `.env`

**Setup:**
1. Google Cloud Console → New project → Enable Sheets API + Drive API
2. IAM → Service Accounts → Create → download JSON → save as `backend/google-service-account.json`
3. Open your Google Sheet → Share with service account email (Editor)
4. Set `GOOGLE_SHEET_ID` from sheet URL

**Note:** Sheets sync is non-blocking — if it fails, the contact form still succeeds.

**Status check:** `GET /api/contact/google-sheets-status`

---

## Rumah123 via Apify

**Used for:** Live property listings in chatbot responses

**Toggle:** `RUMAH123_DATA=ON` (or `OFF` for JSON-only mode)

**Warmup on server start:** `RUMAH123_WARMUP_LOCATIONS=Jakarta Selatan,Surabaya,Bandung,Bali`

**Token:** `APIFY_API_TOKEN` in `.env`

---

## Deployment Notes

### Pre-Deploy Checklist
- Set real `ANTHROPIC_API_KEY` (currently placeholder — Claude fallback disabled)
- Set real `OPENAI_API_KEY` (check quota)
- Enable `secure: true` on refresh token cookie in `loginController.js` for HTTPS
- Replace `0.0.0.0` in CORS `allowedOrigins` in `server.js` with production domain
- Consider moving `access_token` storage from localStorage to memory-only in `authApi.js`

### Start Commands
```bash
# Backend (production)
cd backend && node server.js

# Frontend (build)
cd frontend && npm run build
# Serve frontend/dist/ via nginx or static host

# Frontend (dev)
cd frontend && npm run dev
```

### WATI (Future)
`WATI_API_TOKEN` is configured in `.env` but not yet integrated.
WATI would replace or complement Fonnte for the multi-agent WhatsApp system.

# 02. Project Configuration & Setup

## Environment Variables (backend/.env)

### Server
```env
APP_PORT=5055
APP_FRONTEND_PORT=5173
```

### WhatsApp Terminal Selector
```env
# Sumber metadata `source` di log AI (kirimi_whatsapp/timelinesai_whatsapp/fonnte_whatsapp)
MESSAGE_TERMINAL=KIRIMI            # FONNTE | KIRIMI | TIMELINESAI
# Platform mana yang di-render di terminal (boleh multi, pisah koma)
MASSEGE_TERMINAL=KIRIMI            # FONNTE,KIRIMI,TIMELINESAI
```

### ngrok (auto-start tunnel dari terminal backend)
```env
ENABLE_NGROK=true                 # true = backend jalankan `ngrok http <APP_PORT>` sbg child process
# NGROK_DOMAIN=your-reserved.ngrok-free.app   # opsional (paid plan)
# NGROK_REGION=ap                             # opsional
```

### Database (MySQL)
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_property
DB_DIALECT=mysql
```

> **Larangan (security):** dilarang membuat `const` hardcode nama model AI di kode.
> Semua nama model WAJIB dibaca dari `.env`. Jangan menaruh komentar inline setelah
> nilai model (mis. `CHAT_GPT_MODEL=gpt-4o-mini # ...`) — bisa mengorupsi nilai model.

### OpenAI (ChatGPT)
```env
CHAT_GPT_API_KEY=sk-...
CHAT_GPT_MODEL=gpt-4o-mini
CHAT_GPT_STORE_RESPONSE=true
CHAT_GPT_MAX_OUTPUT_TOKENS=4096
```

### Claude (Anthropic)
```env
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-haiku
CLAUDE_API_VERSION=2023-06-01
CLAUDE_MAX_TOKENS=4096
```

### QWEN (Alibaba DashScope / Bailian)
```env
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
QWEN_API_KEY=sk-...              # atau sk-ws-... (Bailian) + QWEN_APP_ID
QWEN_MODEL=qwen3-vl-flash
QWEN_MAX_TOKENS=4096
```

### DeepSeek (OpenAI-compatible)
```env
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat     # deepseek-chat | deepseek-reasoner | deepseek-v3.1
DEEPSEEK_MAX_TOKENS=4096
DEEPSEEK_TEMPERATURE=1.0          # 0.0 faktual … 2.0 kreatif
DEEPSEEK_TOP_P=1.0
```

### AI Provider Routing
```env
AI_PRIMARY_PROVIDER=deepseek     # qwen | claude | chatgpt | deepseek | private
ENABLE_CLAUDE_FALLBACK=true       # efektif = toggle global Claude
ENABLE_CHATBOT_PRIVATE_CONTROLLER=true
ENABLE_AI_WHATSAPP=true
RESPOND_CATALOG_RUN=OFF           # OFF = brief saja ; ON = brief + katalog per-agent (Q1–Q12 IDENTIK di kedua mode)
AI_PRIMARY_TAG=propmatches.netlify.app   # footer "> Sent via <tag>" pesan WA keluar
AI_COOKIE_RESPONSE_TIMER=20000    # ms — debounce pesan beruntun WhatsApp (BARU, lihat doc 09/17)
```

### WhatsApp Terminals
```env
# Fonnte (kirim WA contact form + multi-agent)
FONNTE_TOKEN=...
FONNTE_POLLING_ENABLED=true
FONNTE_POLLING_INTERVAL_MS=10000
# TimelinesAI
TIMELINESAI_API_KEY=...
# Kirimi (kredensial akun; device_id per-agent di users.kirimi_device_id)
KIRIMI_USER_CODE=...
KIRIMI_SECRET=...
```

### Live Property Data (Rumah123 via Apify)
```env
APIFY_API_TOKEN=        # lihat backend/.env — jangan commit token ini ke git
RUMAH123_DATA=OFF              # ON = live Apify | OFF = static/DB catalog
RUMAH123_WARMUP_LOCATIONS=Malang Selatan,Surabaya Timur
```

### Google Sheets (contact form sync, non-blocking)
```env
GOOGLE_SHEET_ID=1nwy276VXH0JvDZVOoddBbqmr9jwpydoKrukWY2Jukw4
GOOGLE_SHEET_GID=0
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json
```

### JWT Authentication
```env
ACCESS_TOKEN_SECRET=elevan_access_secret_...
REFRESH_TOKEN_SECRET=elevan_refresh_secret_...
ACCESS_TOKEN_EXPIRY=5m
REFRESH_TOKEN_EXPIRY=1d
COOKIE_REFRESH_TOKEN=Elevan_Refresh_Token
BCRYPT_SALT_ROUNDS=10
```

### Chatbot Session
```env
CHATBOT_COOKIE_TTL_MINUTES=90
```

### Skill Prompt Character Limits
```env
SKILL_MAX_WEBSITE_CHARACTERS=12000
SKILL_MAX_RESPONSE_CHARACTERS=330000
SKILL_MAX_PROJECT_CHARACTERS=345000
```
Dinaikkan Juli 2026 (260000/280000 → 330000/345000): baseline wajib
claude_responds/chat_gpt_responds (SKILL.md + docs 01-15, tanpa file
kondisional 16-19) sudah ~250K sendiri. Headroom lama (10K) tidak cukup
begitu 2+ file kondisional (fasilitas+lokasi) terpicu bersamaan dalam
satu pesan customer → bagian akhir skill docs terpotong diam-diam
(`trimForPrompt()` adalah hard slice, bukan smart-summarize).
```env
```

### Pagination (semua master data list)
```env
PAGINATION_ROWS=8                # default page size — GeneralController.pageSize()
```

### Frontend (frontend/.env)
```env
VITE_BACKEND_URL=http://localhost
VITE_BACKEND_PORT=5055            # HARUS cocok dengan backend APP_PORT (dulu keliru 5005)
VITE_DEV_SERVER_PORT=5173
```

## Quick Start

```bash
# Backend (port 5055)
cd backend
npm install
# Fill in backend/.env
npm run dev           # nodemon; ENABLE_NGROK=true → tunnel muncul di terminal ini

# Frontend (port 5173)
cd frontend
npm install
npm run dev           # data properti diambil dari backend API, bukan file JSON
```

> Reset cache bersih: `rm -rf node_modules package-lock.json && npm cache clean --force && npm install`.

## Backend Dependencies

| Package | Purpose |
|---|---|
| express | HTTP server |
| sequelize (v6) + mysql2 | ORM + MySQL driver (upgrade dari v3 → fix vuln lodash/validator) |
| bcrypt | password hashing |
| jsonwebtoken | JWT access/refresh tokens |
| cookie-parser | read HttpOnly cookies |
| axios | Private (chatbotPrivateController.js)/QWEN/DeepSeek/Kimi/Chat GPT/Claude + Fonnte/Kirimi/TimelinesAI HTTP calls |
| google-spreadsheet | Google Sheets integration |
| apify-client | Rumah123 live property data |
| express-rate-limit | rate limiting (contact form: 5/15min) |
| dotenv | environment variable loading |
| ngrok (CLI) | tunnel dev (dijalankan sbg child process oleh services/ngrokService.js) |

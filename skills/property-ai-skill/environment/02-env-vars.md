# Environment Variables

## Required Variables
```env
NODE_ENV=development
APP_NAME=property-ai-platform
APP_URL=https://your-domain.com
FRONTEND_URL=https://your-frontend-domain.com
PORT=3000
DB_CLIENT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=property_ai
DB_USER=app_user
DB_PASSWORD=change_me
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1-mini
FONNTE_TOKEN=your_fonnte_token
FONNTE_WEBHOOK_SECRET=your_webhook_secret
FONNTE_API_BASE_URL=https://api.fonnte.com
GOOGLE_API_KEY=your_google_api_key
SESSION_SECRET=change_me
LOG_LEVEL=info
ALLOWED_ORIGINS=https://your-domain.com
```

## Best Practices
- Never hardcode API keys in frontend code
- Validate required environment variables on startup
- Keep outbound provider URLs configurable

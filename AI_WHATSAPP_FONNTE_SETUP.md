# AI WhatsApp Fonnte Setup

Flow setelah user submit Contact Form:

1. Data dikirim ke Google Spreadsheet.
2. Data disimpan ke MySQL.
3. Backend mengirim subject + message ke OpenAI Responses API.
4. Backend menerima jawaban ChatGPT.
5. Backend mengirim jawaban tersebut ke nomor WhatsApp customer melalui Fonnte API.

## File yang diubah

- `backend/controllers/contactController.js`
- `backend/services/openaiService.js`
- `backend/services/fonnteService.js`
- `backend/routes/index.js`
- `backend/.env.example`

## .env backend

Copy `.env.example` menjadi `.env`, lalu isi:

```env
OPENAI_API_KEY=sk-proj-your_new_openai_key_here
OPENAI_MODEL=gpt-5.4-mini
OPENAI_STORE_RESPONSE=true
OPENAI_MAX_OUTPUT_TOKENS=0

FONNTE_TOKEN=your_new_fonnte_token_here
ENABLE_AI_WHATSAPP=true
```

`OPENAI_MAX_OUTPUT_TOKENS=0` artinya backend tidak mengirim parameter `max_output_tokens`, sehingga request backend lebih mirip dengan request Postman yang sudah berhasil.

## Test endpoint

Cek config OpenAI + Fonnte tanpa mengirim pesan:

```text
http://localhost:5000/api/contact/ai-whatsapp-status
```

Test OpenAI dengan request kecil:

```text
http://localhost:5000/api/contact/ai-whatsapp-status?testOpenAI=true
```

Cek Google Sheets:

```text
http://localhost:5000/api/contact/google-sheets-status
```

## Restart backend

Setelah mengubah `.env`, backend wajib di-restart:

```bash
cd backend
npm run dev
```

## Catatan security

Jangan upload `.env`, `google-service-account.json`, OpenAI API key, atau Fonnte token ke GitHub/public.
Jika key/token sudah pernah dibagikan, revoke/rotate dan buat key/token baru.

# Current Test Checklist

## Backend Start

```bash
cd backend
npm install
npm run dev
```

Expected:

```text
Backend listening at http://localhost:5000
Database connected and synced
```

## Frontend Start

```bash
cd frontend
npm install
npm run dev
```

Expected:

```text
http://localhost:5173
```

## Test Routes

```text
http://localhost:5000/api/home
http://localhost:5000/api/about
http://localhost:5000/api/contact/google-sheets-status
http://localhost:5173/
http://localhost:5173/about
http://localhost:5173/contact
```

## Contact Form Test

1. Submit blank form.
2. Confirm toast shows missing fields.
3. Enter invalid phone characters.
4. Confirm phone is cleaned or validation fails.
5. Submit valid form.
6. Confirm Google Sheets receives row.
7. Confirm MySQL receives Contact row.

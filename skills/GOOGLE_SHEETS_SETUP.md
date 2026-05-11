# Google Sheets Setup untuk Contact Form

Backend ini mengirim data Contact Form ke Google Spreadsheet menggunakan **Google Service Account JSON**.

## Kenapa bukan Google API Key?

API key biasa hanya mengidentifikasi project Google Cloud untuk quota/billing. API key tidak cukup untuk append/write row ke Google Spreadsheet karena proses tulis data membutuhkan authentication/authorization. Untuk backend NodeJS, cara yang paling sesuai adalah Service Account.

## 1. Enable Google Sheets API

1. Buka Google Cloud Console.
2. Pilih project Anda.
3. Masuk ke **APIs & Services > Library**.
4. Enable **Google Sheets API**.

## 2. Buat / Download Service Account JSON

1. Masuk ke **IAM & Admin > Service Accounts**.
2. Create Service Account.
3. Buka service account tersebut.
4. Masuk ke tab **Keys**.
5. Klik **Add Key > Create new key > JSON**.
6. File JSON akan otomatis ter-download.

## 3. Simpan JSON ke folder backend

Rename file JSON menjadi:

```text
google-service-account.json
```

Simpan di folder:

```text
backend/google-service-account.json
```

Penting: file ini berisi private key. Jangan upload ke GitHub, jangan taruh di folder frontend/public, dan jangan share ke orang lain.

## 4. Share Google Spreadsheet ke Service Account

Buka file JSON dan cari field:

```json
"client_email": "xxxxx@xxxxx.iam.gserviceaccount.com"
```

Buka Google Spreadsheet Anda, klik **Share**, masukkan email service account tersebut, lalu pilih role **Editor**.

## 5. Setting .env backend

File `.env` backend cukup seperti ini:

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=db_property
DB_DIALECT=mysql

GOOGLE_SHEET_ID=1nwy276VXH0JvDZVOoddBbqmr9jwpydoKrukWY2Jukw4
GOOGLE_SHEET_GID=0
GOOGLE_SHEET_TAB_NAME=
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json
```

## 6. Header Google Sheet

Row pertama Google Sheet harus berisi header berikut:

```text
Timestamp | Name | Email | Phone | Subject | Message | Source
```

Jika sheet masih kosong, backend akan mencoba membuat header otomatis.

## 7. Jalankan backend

```bash
cd backend
npm install
npm run dev
```

## 8. Test koneksi Google Sheets

Buka browser:

```text
http://localhost:5000/api/contact/google-sheets-status
```

Jika berhasil, response akan berisi:

```json
{
  "success": true,
  "message": "Google Sheets connection is ready."
}
```

Jika error `The caller does not have permission`, berarti spreadsheet belum di-share ke `client_email` sebagai Editor.

Jika error file JSON tidak ditemukan, pastikan file berada di `backend/google-service-account.json`.

# Permission Fix untuk Google Sheets

Error:

```text
Google API error - [403] The caller does not have permission
```

Artinya backend sudah berhasil membaca Service Account JSON dan berhasil meminta token ke Google, tetapi service account tersebut belum punya akses ke Google Spreadsheet.

## Cara memperbaiki

1. Buka `backend/google-service-account.json` di komputer Anda.
2. Cari field `client_email`.
3. Copy email tersebut.
4. Buka Google Spreadsheet.
5. Klik **Share**.
6. Paste email service account tersebut.
7. Set role menjadi **Editor**.
8. Klik **Send / Share**.
9. Restart backend.
10. Test ulang:

```text
http://localhost:5000/api/contact/google-sheets-status
```

Jika endpoint masih gagal, baca response JSON-nya. Backend akan menampilkan email service account yang harus Anda share.

## File penting

Backend `.env`:

```env
GOOGLE_SHEET_ID=1nwy276VXH0JvDZVOoddBbqmr9jwpydoKrukWY2Jukw4
GOOGLE_SHEET_GID=0
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./google-service-account.json
```

Service Account JSON harus disimpan di:

```text
backend/google-service-account.json
```

File `google-service-account.json` tidak saya sertakan dalam ZIP karena berisi private key.

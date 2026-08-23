# Deploy ElevanProperty ke Hostinger (propmatches.fun)

Panduan ini ditulis untuk dijalankan oleh Claude Code di sesi berikutnya (atau siapa pun) saat meng-upload/update project ini ke Hostinger. Domain: **propmatches.fun**, dashboard: `https://hpanel.hostinger.com/websites/propmatches.fun`.

Arsitektur: `frontend` (Vue 3 + Vite, static build) disajikan lewat `public_html`, `backend` (Node/Express) jalan sebagai Node.js App di Hostinger (Passenger), database MySQL satu server dengan app.

---

## 0. Ringkasan penyebab 503 yang pernah terjadi (M100) — jangan diulang

1. **Port.** Passenger menyuntikkan port lewat `process.env.PORT`, bukan `APP_PORT`. [backend/server.js:21](backend/server.js:21) sudah menangani ini: `const port = process.env.PORT || process.env.APP_PORT || 5000;`. **Jangan** override dengan hardcode port sendiri, dan **jangan** isi `PORT=` manual di `.env` produksi — biarkan Passenger yang mengisi.
2. **CORS.** Origin produksi diturunkan otomatis dari `APP_URL` (+ varian www) dan `CORS_EXTRA_ORIGINS` opsional — lihat [backend/server.js:30-53](backend/server.js:30).
3. **Kredensial DB salah.** Kegagalan `sequelize.sync()` bisa membuat proses `process.exit(1)` total (bukan sekadar error) → tidak ada apa pun mendengarkan port. Selalu cocokkan `DB_USER`/`DB_NAME`/`DB_PASSWORD` dengan hPanel > Databases sebelum start.
4. **Port hardcoded di frontend build.** `VITE_BACKEND_URL` produksi (https://, di balik proxy standar) harus **tanpa** port. `frontend/src/services/backendBaseUrl.js` sudah menangani ini — jangan susun baseURL manual di file lain.

---

## 1. Checklist sebelum mulai

- [ ] `backend/.env` sudah berisi nilai produksi (lihat §2). Nilai dev lokal ada di `backend/.env.local.bak`.
- [ ] `frontend/.env` sudah berisi `VITE_BACKEND_URL=https://propmatches.fun` dan `VITE_BACKEND_PORT=` (kosong).
- [ ] Password database & Hostinger sudah dikonfirmasi user — JANGAN generate/tebak sendiri.
- [ ] `git status` bersih atau perubahan sudah di-commit (jangan upload state yang belum di-review).

---

## 2. Backend — variabel `.env` produksi

File: `backend/.env` (JANGAN commit — sudah di-`.gitignore` lewat pola `.env.*`).

| Key | Nilai produksi | Catatan |
|---|---|---|
| `NODE_ENV` | `production` | |
| `APP_PORT` | `5055` (dibiarkan) | hanya fallback dev; Passenger pakai `PORT` |
| `APP_URL` | `https://propmatches.fun` | sumber CORS allowed origins |
| `CORS_EXTRA_ORIGINS` | subdomain lain jika ada (mis. `https://shop.propmatches.fun`), pisah koma | opsional |
| `DB_HOST` | `localhost` | DB satu server dengan app |
| `DB_PORT` | `3306` | tidak dibaca Sequelize saat ini ([backend/config/database.js](backend/config/database.js)) — cukup dokumentasi |
| `DB_USER` | `u310807636_propmatches` | prefix akun Hostinger — **cek ulang di hPanel > Databases** |
| `DB_PASSWORD` | (dari hPanel, dikutip `'...'` jika mengandung `@`) | |
| `DB_NAME` | `u310807636_db_property` | |
| `NGROK_ENABLE` | `false` | domain sudah publik, tunnel tidak diperlukan di shared hosting |
| `NGROK_WEBHOOK_URL` | `https://propmatches.fun/api/kirimi/webhook` | dipakai controller WhatsApp saat `NGROK_ENABLE=false` |

Semua key lain (API key AI: ChatGPT/Claude/Qwen/DeepSeek/Kimi, Fonnte/Kirimi/TimelinesAI, JWT secrets, Google, dll.) **dipertahankan apa adanya** dari `.env` dev — sudah production-ready, tidak perlu diubah kecuali user minta eksplisit.

⚠️ **`AI_PRIMARY_TAG`**: JANGAN diubah kecuali user secara eksplisit minta. Ini footer WA + dipakai `isOwnEcho()` untuk mendeteksi pesan balasan sendiri — mengubahnya tanpa instruksi bisa merusak deteksi echo pesan WhatsApp yang sedang berjalan.

Verifikasi sebelum upload:

```bash
cd backend && node -e "require('dotenv').config({path:'.env'}); ['NODE_ENV','APP_URL','DB_USER','DB_NAME','NGROK_ENABLE'].forEach(k=>console.log(k,'=',process.env[k]))"
```

Untuk kembali ke dev lokal kapan saja:

```bash
cp backend/.env.local.bak backend/.env
```

---

## 3. Frontend — build produksi

File: `frontend/.env`

```
VITE_BACKEND_URL=https://propmatches.fun
VITE_BACKEND_PORT=
```

⚠️ Nilai `VITE_*` **dibakukan saat build** (`npm run build`) — mengubahnya di server SETELAH build tidak berpengaruh. Harus build ulang lalu upload ulang isi `frontend/dist/`.

```bash
cd frontend
npm install
npm run build
```

Verifikasi baseURL final tertanam benar di bundle (harus persis `https://propmatches.fun/api`, TANPA port menempel):

```bash
grep -o "https://propmatches\.fun[^\"']*" dist/assets/*.js | head
```

Upload **isi** `frontend/dist/` (bukan folder `dist` itu sendiri) ke `public_html` lewat File Manager Hostinger atau FTP/SFTP.

### Routing SPA (Vue Router)

Jika Vue Router pakai history mode, `public_html` butuh `.htaccess` agar refresh di route selain `/` tidak 404:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## 4. Backend — Node.js App di Hostinger (hPanel)

1. hPanel > Websites > propmatches.fun > **Advanced > Node.js**.
2. Buat/edit aplikasi Node.js:
   - **Application root**: folder tempat `backend/` di-upload di server (mis. `backend` di luar `public_html`, TIDAK di dalam `public_html` — lihat §6 keamanan).
   - **Application startup file**: `server.js`.
   - **Node.js version**: pilih versi LTS yang tersedia (cocokkan dengan versi lokal — cek `node -v`).
3. Upload seluruh isi `backend/` (KECUALI `node_modules/`, `.env.local.bak`, dan file dev-only) ke Application root — lewat File Manager/FTP/Git.
4. Jalankan **NPM Install** dari panel Node.js Hostinger (atau SSH: `npm install --omit=dev`) di Application root.
5. Pastikan `backend/.env` (§2) ikut ter-upload ke Application root — Hostinger Node.js app membaca `.env` di folder yang sama dengan `server.js` (lewat `dotenv` di [backend/server.js:2](backend/server.js:2)).
6. **Restart** aplikasi Node.js dari panel setelah upload/env berubah.

---

## 5. Database

1. hPanel > Databases > MySQL Databases — pastikan `u310807636_db_property` sudah ada dan user `u310807636_propmatches` punya akses penuh ke database itu.
2. Import struktur/data awal jika database masih kosong (lihat folder `database/` di root project untuk dump/migrasi, jika ada).
3. Start backend sekali (`npm run start` via panel) — `sequelize.sync()` akan membuat tabel yang belum ada berdasarkan `backend/models/`.

---

## 6. KEAMANAN — wajib dicek setiap deploy

- [ ] `backend/.env` **TIDAK BOLEH** berada di dalam `public_html` atau folder mana pun yang bisa diakses browser. Application root Node.js app boleh di luar `public_html`.
- [ ] Test langsung: `https://propmatches.fun/.env` harus membalas **404**. Kalau tidak, `.env` ter-upload ke lokasi yang salah — pindahkan segera, lalu **rotate semua API key** yang sempat terekspos.
- [ ] `google-service-account.json` dan file kredensial lain di `backend/asset/` juga tidak boleh publicly accessible.
- [ ] Jangan commit `.env` asli ke git (sudah dijaga `backend/.gitignore`: `.env`, `.env.*`, kecuali `.env.example`).
- [ ] Password database (`Nigel217180404@` dsb.) hanya boleh ditulis di `.env` server produksi — jangan tempel ulang di chat/dokumentasi lain setelah deploy selesai.

---

## 7. Urutan verifikasi setelah deploy

1. `https://propmatches.fun/` — frontend termuat, bukan 503/404.
2. `https://propmatches.fun/.env` — harus 404 (lihat §6).
3. Buka DevTools Network di frontend produksi, pastikan panggilan API mengarah ke `https://propmatches.fun/api/...` (TANPA port).
4. Login/register (test akun) — cek cookie `Elevan_Refresh_Token` ter-set, tidak ada CORS error di console.
5. Kirim pesan WhatsApp test ke nomor terhubung (Kirimi/Fonnte sesuai `MESSAGE_TERMINAL`) — pastikan AI membalas dan `NGROK_WEBHOOK_URL` (bila dipakai) benar-benar dipanggil.
6. Cek log Node.js app di panel Hostinger — pastikan tidak ada error `sequelize.sync()` / provider AI yang berulang.

---

## 8. Rollback cepat

- Frontend: upload ulang build `dist/` versi sebelumnya (simpan sebagai backup sebelum overwrite).
- Backend: restore `backend/.env` dari `backend/.env.local.bak` kalau perlu kembali ke setup dev, atau simpan salinan `.env` produksi sebelumnya sebagai `backend/.env.prod.bak` sebelum tiap perubahan besar.
- Database: jangan jalankan migrasi destruktif tanpa backup `mysqldump` terlebih dahulu.

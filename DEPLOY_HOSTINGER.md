# Deploy ke Hostinger — propmatches.fun

Panduan ini menjelaskan **kenapa `https://propmatches.fun/` membalas 503** dan
langkah persisnya supaya hidup. Urutannya sengaja: nomor 1–3 adalah penyebab
503; sisanya membuat aplikasi benar-benar berfungsi.

> ⚠️ **503 Service Unavailable = proxy Hostinger tidak menemukan aplikasi Node
> yang hidup di port yang ia harapkan.** Jadi penyebabnya selalu salah satu dari:
> (a) aplikasi mendengarkan port yang salah, (b) aplikasi mati/crash saat start,
> (c) aplikasi memang belum pernah dijalankan.

---

## 0. RINGKASAN PENYEBAB (hasil diagnosis kode & .env Anda)

| # | Penyebab | Status |
|---|---|---|
| 1 | Aplikasi mendengarkan `APP_PORT=5055`, bukan port pemberian Hostinger | ✅ **SUDAH SAYA PERBAIKI di kode** |
| 2 | Kredensial DB masih lokal (`root` / `db_property`) → `sequelize.sync()` gagal → `process.exit(1)` → proses mati | ⛔ **HARUS ANDA ISI** (butuh password Hostinger) |
| 3 | CORS hanya mengizinkan `localhost` → frontend ditolak | ✅ **SUDAH SAYA PERBAIKI** (baca `APP_URL`) |
| 4 | `VITE_BACKEND_URL=http://localhost` → frontend memanggil localhost dari browser pengunjung | ⛔ **HARUS ANDA UBAH + REBUILD** |
| 5 | `.env` berisi ±10 API key aktif ikut ter-upload | ⚠️ **RISIKO KEAMANAN — baca §6** |

---

## 1. Perubahan kode yang SUDAH diterapkan

### `backend/server.js` — port
```js
const port = process.env.PORT || process.env.APP_PORT || 5000;
```
Hostinger (Passenger) menyuntikkan `process.env.PORT` dan mem-proxy domain ke
port itu. Sebelumnya kode hanya membaca `APP_PORT` sehingga selalu bind 5055 →
proxy menembak port kosong → **503**. `APP_PORT` tetap dipakai saat dev lokal.

### `backend/server.js` — CORS
Origin produksi kini diturunkan otomatis dari `APP_URL` (termasuk varian `www`),
plus `CORS_EXTRA_ORIGINS` (opsional, pisah koma) bila perlu domain tambahan.

> Kedua perubahan aman untuk dev: tanpa `PORT` dan dengan `APP_URL=http://localhost`,
> perilakunya persis seperti sebelumnya. Suite tes tetap **1519/1540**.

---

## 2. `backend/.env` — SUDAH DISETEL ke nilai produksi

Kedua baris yang bergantung pada domain sudah diubah langsung di
`backend/.env` (nilai lokal disimpan sebagai baris ter-komentar di atasnya,
tinggal ditukar aktif/nonaktif bila kembali kerja lokal):

```env
APP_URL=https://propmatches.fun
AI_PRIMARY_TAG=propmatches.fun
```

`APP_URL` dipakai `server.js` untuk menurunkan CORS allowed origins produksi
(termasuk varian `www`) — origin `localhost:APP_FRONTEND_PORT` untuk dev SELALU
tetap diizinkan berapa pun nilai ini, jadi aman biarkan produksi bahkan saat
Anda masih kerja di komputer lokal.

`AI_PRIMARY_TAG` adalah footer `"> Sent via <tag>"` di setiap balasan WhatsApp,
DAN dipakai `isOwnEcho()` untuk mengenali balasan AI sendiri saat terpantul
balik dari WhatsApp — sebelumnya masih menunjuk `propmatches.netlify.app`
(frontend lama), sekarang `propmatches.fun`.

**Yang MASIH HARUS Anda isi sendiri** (butuh kredensial Hostinger, sengaja
tidak disentuh):

```env
# ── Database Hostinger (hPanel → Databases → MySQL) ──────────
DB_HOST=localhost
DB_USER=u310807636_propmatches
DB_NAME=u310807636_db_property
DB_PASSWORD=<password database Hostinger Anda>
DB_DIALECT=mysql

# ── Matikan tunnel dev ───────────────────────────────────────
NGROK_ENABLE=false
```

**Catatan penting soal `DB_HOST`:** di hosting Hostinger, MySQL biasanya tetap
`localhost` (database berada di server yang sama). Jangan diisi `propmatches.fun`
— itu nama domain web, bukan host database. Bila hPanel menampilkan hostname
khusus (mis. `srv1153.hstgr.io`), pakai yang tertulis di hPanel.

> ⚠️ **Kenapa ini penyebab 503 yang paling mematikan:** di `server.js`, kegagalan
> koneksi DB masuk ke `.catch(() => process.exit(1))`. Aplikasi **berhenti total**,
> bukan sekadar error — jadi tidak ada apa pun yang mendengarkan port, dan proxy
> membalas 503. Selama kredensial DB salah, memperbaiki hal lain tidak akan
> menghidupkan domain.

### Impor skema database
hPanel → **Databases → phpMyAdmin** → pilih `u310807636_db_property` → **Import**
→ unggah file SQL dari folder `database/` proyek Anda.

---

## 3. WAJIB: setup aplikasi Node di hPanel

hPanel → **Website → Node.js** (atau *Setup Node.js App*):

| Field | Isi |
|---|---|
| Application root | `hbuilds/current/Elevan_Property/backend` |
| Application startup file | `server.js` |
| Node version | 18 atau lebih baru |
| Application mode | Production |

Lalu di folder `backend` server: **Run NPM Install**, kemudian **Restart**.

> `package.json` Anda memakai `"start": "node server.js"` — sudah benar.
> Jangan pakai `npm run dev` di produksi (itu nodemon).

Setelah restart, buka **log aplikasi** di hPanel. Yang Anda cari:
```
Database connected and synced
Backend listening at http://localhost:<port>
CORS Allowed Origins: … https://propmatches.fun …
```
Kalau muncul `Failed to sync database` → kembali ke §2, kredensial DB masih salah.

---

## 4. `frontend/.env` — SUDAH DISETEL, tinggal build ulang & upload

Variabel `VITE_*` **dibaca saat BUILD**, bukan saat runtime — mengubah `.env`
di server tanpa build ulang **tidak berpengaruh sama sekali**. Nilainya sudah
saya set di `frontend/.env`:

```env
VITE_APP_ENV=production
VITE_BACKEND_URL=https://propmatches.fun
VITE_BACKEND_PORT=
```

> ⚠️ **Kode frontend SUDAH SAYA PERBAIKI supaya nilai kosong ini valid.**
> Sebelumnya tiga berkas (`api.js`, `authApi.js`, `profileApi.js`) menyusun
> sendiri `` `${backendUrl}:${backendPort}/api` `` dengan titik dua HARDCODED
> dan fallback `|| 5005`. Akibatnya bentuk produksi **mustahil dinyatakan**:
> mengosongkan `VITE_BACKEND_PORT` justru jatuh ke `5005` →
> `https://propmatches.fun:5005/api` → semua panggilan API dari browser
> pengunjung gagal. Sekarang ketiganya memakai satu helper
> `src/services/backendBaseUrl.js`, dan sudah diverifikasi: `npm run build`
> menghasilkan bundle yang memanggil persis `https://propmatches.fun/api`
> (dicek langsung di dalam berkas `.js` hasil build, tanpa port menempel).

**Langkah yang tersisa (di komputer lokal Anda):**

```bash
cd frontend && npm run build
```

Lalu upload **isi** folder `frontend/dist/` (bukan foldernya) ke `public_html/`.

> `VITE_DEV_SERVER_HOST` / `VITE_PREVIEW_HOST` sengaja TIDAK diubah — itu
> alamat bind Vite dev/preview server di komputer Anda sendiri, bukan sesuatu
> yang diunggah ke Hostinger.

---

## 5. Routing: satu domain untuk web + API

Frontend statis di `public_html`, backend Node di port terpisah. Agar
`https://propmatches.fun/api/...` sampai ke Node, tambahkan `public_html/.htaccess`:

```apache
RewriteEngine On

# /api/* → aplikasi Node (sesuaikan port bila hPanel menampilkan port khusus)
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ http://127.0.0.1:5055/api/$1 [P,L]

# SPA fallback — semua route non-file dilayani index.html (vue-router history mode)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

> Bila Hostinger sudah otomatis mem-proxy domain ke aplikasi Node Anda, blok
> `/api/` di atas tidak diperlukan — cek dulu di hPanel apakah domain sudah
> terhubung ke aplikasi Node atau ke `public_html`.

---

## 6. ⚠️ KEAMANAN — lakukan SEKARANG

`backend/.env` Anda memuat kunci **aktif**: OpenAI, Claude, QWEN, DeepSeek, Kimi,
Fonnte, Kirimi secret, Apify, Google API key, serta `ACCESS_TOKEN_SECRET` /
`REFRESH_TOKEN_SECRET`.

1. **Pastikan `.env` tidak berada di `public_html`.** Bila bisa dibuka lewat
   browser, seluruh kunci Anda bocor. Uji: buka `https://propmatches.fun/.env`
   — harus **404**, bukan menampilkan isi file.
2. Tambahkan proteksi di `public_html/.htaccess`:
   ```apache
   <FilesMatch "^\.env">
     Require all denied
   </FilesMatch>
   ```
3. **Kunci mana pun yang pernah masuk ke chat, screenshot, atau repo publik
   sebaiknya di-rotate** (buat baru, cabut yang lama) — termasuk
   `NGROK_AUTHTOKEN` yang sempat Anda tempel di percakapan.
4. Jangan pernah commit `.env` asli ke git.

---

## 7. Urutan verifikasi (ikuti berurutan)

```
1. hPanel → log aplikasi Node    → ada "Database connected and synced"?
                                   TIDAK → §2 (kredensial DB)
2. hPanel → log aplikasi Node    → ada "Backend listening at ..."?
                                   TIDAK → §3 (startup file / npm install)
3. buka https://propmatches.fun/api/chatbot/config
                                   → balasan JSON? kalau 503 → §3/§5 (routing)
4. buka https://propmatches.fun/  → halaman Vue muncul? kalau blank → §4 (build)
5. buka DevTools → Console/Network → error CORS? → §2 (APP_URL) lalu restart
6. buka https://propmatches.fun/.env → HARUS 404 → §6
```

---

## 8. Yang TIDAK perlu diubah

- `RUMAH123_DATA=OFF` — sudah benar (AI hanya pakai katalog database).
- `AI_PRIMARY_PROVIDER=chatgpt` — silakan tetap; pastikan kuota OpenAI aktif.
- `MESSAGE_TERMINAL` / `MASSEGE_TERMINAL=KIRIMI` — sudah benar.
- Webhook WhatsApp: setelah domain hidup, **ganti URL webhook Kirimi** dari
  URL ngrok lama ke `https://propmatches.fun/api/kirimi/webhook`.

---

## 8. ⭐ Webhook WhatsApp di Hostinger (M101 — 20 Agu 2026)

### Yang SUDAH diperbaiki di kode

**(a) `trust proxy` — rate limit menghukum customer yang salah.**
Log produksi menampilkan:
```
ValidationError: The 'X-Forwarded-For' header is set but the Express
'trust proxy' setting is false (default).
```
Hostinger menaruh app Node di belakang reverse proxy, jadi setiap request
membawa `X-Forwarded-For`.

> ⚠️ **Koreksi atas dugaan awal:** request TIDAK gagal — tetap HTTP 200 dan
> webhook tetap diproses. Kerusakan sesungguhnya lebih halus: `req.ip` selalu
> menjadi IP **proxy** (`::ffff:127.0.0.1`), sehingga **SELURUH customer berbagi
> SATU bucket rate-limit** (`webhookLimiter` = 120/menit). Begitu beberapa
> customer chat bersamaan, customer yang sah kena **HTTP 429** dan pesannya
> hilang tanpa error yang jelas.

Fix: `app.set('trust proxy', TRUST_PROXY_HOPS ?? 1)` di `server.js`.
**Sengaja bukan `true`** — `true` berarti percaya buta seluruh rantai
`X-Forwarded-For`, sehingga siapa pun bisa memalsukannya dan lolos rate limit.
Angka = jumlah proxy hop yang dipercaya. `1` benar untuk Hostinger. Bila kelak
ada Cloudflare DI DEPAN Hostinger, naikkan lewat env:

```env
TRUST_PROXY_HOPS=2
```

**(b) Fonnte diarahkan ke endpoint yang tidak punya AI.**
Banner dulu menyuruh isi `/api/fonnte/webhook`. Endpoint itu ada, tapi
ditangani `fonnteWebhookController` (**legacy**) yang **tidak pernah** memanggil
`generateWhatsAppAIReply` — pesan masuk, AI tidak pernah membalas (gagal senyap,
HTTP 200 tanpa error). Sekarang menunjuk jalur multi-agent yang benar.

**(c) `DB_PORT` ada di `.env` tapi tidak pernah dibaca** `config/database.js`.
Tidak terasa selama DB di 3306; begitu port non-standar dipakai, koneksi gagal
padahal `.env` terlihat benar.

### URL webhook yang harus diisi di dashboard

Ditentukan `MASSEGE_TERMINAL` di `backend/.env`. Backend mencetak daftarnya saat
start (blok `✅ WEBHOOK SIAP`) — **selalu pakai yang tercetak di log**, jangan
menebak:

| Terminal | URL webhook (produksi) |
|---|---|
| KIRIMI | `https://propmatches.fun/api/kirimi/webhook` |
| FONNTE | `https://propmatches.fun/api/fonnte-chat/webhook` ⚠️ **`-chat`**, bukan `/api/fonnte/webhook` |
| TIMELINESAI | `https://propmatches.fun/api/timelinesai/webhook` |

`MASSEGE_TERMINAL` boleh multi-nilai (`FONNTE,KIRIMI,TIMELINESAI`) — banner akan
mencetak ketiga URL sekaligus.

### NGROK_ENABLE — dua mode, satu sumber kebenaran

| Nilai | Mode | URL webhook diturunkan dari |
|---|---|---|
| `true` | Dev lokal | URL tunnel ngrok (mis. `https://spotter-dragging-sporting.ngrok-free.dev`) |
| `false` | Hostinger / VPS | `APP_URL` (mis. `https://propmatches.fun`) |

⚠️ `APP_URL` di `.env` produksi **harus** `https://propmatches.fun`. Bila masih
`http://localhost`, banner tidak bisa membentuk URL publik yang benar.
(Fonnte juga punya mode polling — `FONNTE_POLLING_ENABLED=true` — yang menarik
pesan tanpa webhook publik sama sekali; itu jalur terpisah.)

### Verifikasi setelah deploy

```
1. Log hPanel → cari blok "✅ WEBHOOK SIAP — MODE: VPS / Hosting"
   → "URL publik" HARUS https://propmatches.fun (bukan localhost/<ngrok-url>)
2. Kirim WhatsApp ke nomor agent
   → log HARUS menampilkan "[⇨ HTTP IN] POST /api/kirimi/webhook"
   → TIDAK BOLEH ada lagi ValidationError X-Forwarded-For
3. Beberapa customer chat bersamaan → tidak ada yang kena 429
```

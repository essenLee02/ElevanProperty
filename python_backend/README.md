# Elevan Property — Backend Python (FastAPI)

Migrasi backend Node.js → Python/FastAPI. **Berjalan berdampingan** dengan
`backend/` (Node.js) selama masa transisi.

## Kenapa berdampingan, bukan langsung menggantikan

`backend/` memuat **42.863 baris** dan **94 perbaikan bernomor (M1–M94)** yang
setiap satunya lahir dari transkrip customer sungguhan dan dikunci oleh
**1.426 assertion** di 52 berkas tes. Contoh yang tidak akan tertebak ulang
dari membaca spesifikasi:

| M | Perilaku yang diperbaiki |
|---|---|
| M64 | Memotong `history` sebelum ekstraksi state → semua slot jadi null → loop tanya-ulang tak berujung |
| M84 | Slot area kosong membuat model **mengarang** nama area ("Ciputra" untuk Malang) |
| M87 | `booking` tidak ada di daftar kata aksi gerbang → seluruh alur booking tidak bisa dimulai |
| M88 | AI mengajukan pertanyaan lalu membuang jawabannya sendiri |
| M91 | "fasilitas terserah" → daftar standar hilang dari summary |
| M94 | ngrok mengabaikan `NGROK_AUTHTOKEN` di `.env` |

Menulis ulang dari nol berarti **mengulang 94 bug itu di produksi**, dengan
customer sungguhan sebagai penguji. Karena itu urutannya:

1. Bangun Python berdampingan (tahap ini)
2. Port per-modul + **buktikan setara** lewat harness paritas
3. Alihkan trafik setelah paritas terbukti
4. Hapus Node.js **setelah** itu

`backend/` adalah satu-satunya spesifikasi lengkap perilaku tersebut — ia
dibutuhkan sebagai acuan selama porting, persis seperti yang Anda minta
("controller mencontek versi Node.js").

## Yang dibagi dengan Node.js (tidak diduplikasi)

- **`.env` yang sama** (`backend/.env`) — satu sumber konfigurasi
- **MySQL `db_property` yang sama** — tidak ada migrasi data
- **`skills/` dan `knowledge/` yang sama** — korpus prompt & RAG

## Struktur

```
python_backend/
├── app/
│   ├── main.py              FastAPI app + lifespan
│   ├── config.py            pydantic-settings, baca backend/.env
│   ├── db.py                SQLAlchemy 2.0 async + aiomysql
│   ├── models/              mirror models/ Node.js
│   ├── core/                logika murni (Q-flow, gerbang, ekstraktor)
│   ├── services/            AI provider, RAG, katalog
│   ├── routers/             webhook Kirimi/Fonnte + API
│   └── schemas/             Pydantic request/response
├── tests/
│   └── parity/              harness paritas Node ↔ Python
└── requirements.txt
```

## Menjalankan

```bash
cd python_backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

⚠️ **Python 3.14 TIDAK BISA dipakai untuk `.venv` proyek ini** (diverifikasi
15 Agu 2026): `pydantic-core` belum punya wheel prebuilt untuk 3.14 di mesin
ini, dan build dari source gagal (`maturin`/PyO3 belum mendukung 3.14).
Pakai **Python 3.11** (`py -3.11 -m venv .venv` atau arahkan langsung ke
`C:\Users\HP\AppData\Local\Programs\Python\Python311\python.exe`).

`main.py` di root (BARU, 15 Agu 2026 — pola sama dengan
`Integra_Assistance/backend/main.py`) membaca `PYTHON_PORT` dari
`backend/.env` lewat blok `if __name__ == "__main__":`, lalu memanggil
`uvicorn.run("app.main:app", ...)` secara terprogram. Ini yang membuat
`python main.py` jadi satu-satunya sumber kebenaran port — kalau butuh
auto-reload saat development, `uvicorn app.main:app --reload --port 5056`
via CLI langsung tetap bisa dipakai sebagai alternatif, tapi WAJIB sertakan
`--port` manual (CLI uvicorn defaultnya 8000, tidak membaca .env).

Port **5056** sengaja berbeda dari Node.js (5055) supaya keduanya bisa hidup
bersamaan selama migrasi.

## Harness paritas

```bash
python tests/parity/run_parity.py
```

Menjalankan fixture yang SAMA lewat Node.js dan Python, lalu menuntut keluaran
**identik**. Ini yang menjaga 94 perbaikan M tidak hilang saat porting —
bukan pembacaan kode secara manual.

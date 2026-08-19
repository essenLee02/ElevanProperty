"""
main.py — titik masuk backend Python Elevan Property.

Jalankan:
    .venv\\Scripts\\python.exe main.py

⚠️ JANGAN jalankan lewat `uvicorn app.main:app` tanpa --port manual — CLI
uvicorn punya default port SENDIRI (8000) yang tidak membaca PYTHON_PORT dari
backend/.env. Blok `if __name__ == "__main__"` di bawah ini yang membaca
PYTHON_PORT, supaya satu-satunya sumber kebenaran port tetap .env (pola yang
sama dipakai di Integra_Assistance/backend/main.py).

Dokumentasi interaktif otomatis: http://localhost:<PYTHON_PORT>/docs
"""

from __future__ import annotations

import sys

import uvicorn

# Console Windows default ke cp1252 saat stdout/stderr tidak terpasang ke
# konsol interaktif sungguhan — mencetak karakter non-ASCII di kondisi itu
# crash dengan UnicodeEncodeError. Dipaksa UTF-8 di sini, satu tempat.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

from app.config import get_settings  # noqa: E402
from app.core.startup_guard import assert_port_free, build_stamp  # noqa: E402


if __name__ == "__main__":
    settings = get_settings()

    # ⚠️ DICEK SEBELUM UVICORN START (M115). Kalau port sudah dipegang proses
    # lama, uvicorn hanya melempar traceback panjang dan mati — sementara
    # proses lama TETAP menjawab customer, sehingga restart terlihat berhasil
    # padahal kode lama yang jalan. Itu yang menyembunyikan perbaikan M110–M114
    # selama hampir dua jam pada 17 Agu 2026.
    assert_port_free(settings.PYTHON_PORT)

    print(f"[BUILD] stempel kode: {build_stamp()}  (cek juga di GET /health)")

    try:
        uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PYTHON_PORT, reload=False)
    except KeyboardInterrupt:
        # Ctrl+C memicu traceback KeyboardInterrupt/CancelledError yang panjang
        # dari lifespan starlette + `Connection.__del__` aiomysql yang telat
        # digarbage-collect setelah event loop ditutup (kuirk asyncio Proactor
        # di Windows, TIDAK menandakan data korup atau proses gagal berhenti —
        # server sudah selesai melayani semua request sebelum berhenti).
        # Ditangkap di sini supaya berhenti terlihat bersih, bukan seperti crash.
        print("\n[NGROK/SERVER] Dihentikan oleh pengguna (Ctrl+C).")

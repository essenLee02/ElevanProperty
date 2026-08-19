"""Verifikasi JWT — KOMPATIBEL dengan token yang diterbitkan Node.js.

Selama migrasi, satu frontend Vue login lewat Node.js lalu memanggil KEDUA
backend dengan token yang sama. Maka verifikasi di sini WAJIB memakai
`ACCESS_TOKEN_SECRET` dan klaim `userId` yang persis sama — bukan skema baru.
Menerbitkan token sendiri dari Python selama transisi hanya akan membuat dua
sesi yang tidak saling kenal.

⚠️ Penerbitan token (login/refresh) TETAP di Node.js. Modul ini hanya
MEMVERIFIKASI.
"""

from __future__ import annotations

from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, status

from app.config import get_settings


def _clean_secret(raw: str | None) -> str:
    """Bersihkan nilai .env.

    Node.js memakai `cleanEnv()` karena nilai di .env kadang membawa titik koma
    atau spasi di ujung (mis. `ACCESS_TOKEN_SECRET=abc;`). Secret yang berbeda
    satu karakter membuat SEMUA token ditolak — dan gejalanya terlihat seperti
    "user tidak bisa login", bukan seperti salah konfigurasi.
    """
    return str(raw or "").strip().rstrip(";").strip()


def decode_access_token(token: str) -> dict[str, Any]:
    secret = _clean_secret(get_settings().ACCESS_TOKEN_SECRET)
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ACCESS_TOKEN_SECRET belum diatur di .env",
        )
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesi berakhir, silakan login ulang",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid",
        ) from exc


async def current_user_id(authorization: str | None = Header(default=None)) -> str:
    """Dependency: ambil `userId` dari header `Authorization: Bearer <token>`.

    Dipakai semua rute master data — kolom audit `created_by`/`updated_by`
    diisi dari sini, bukan dari body permintaan (kalau dari body, siapa pun
    bisa mengaku sebagai orang lain).
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesi tidak valid, silakan login ulang",
        )

    payload = decode_access_token(authorization.split(" ", 1)[1].strip())
    user_id = payload.get("userId") or payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak memuat identitas pengguna",
        )
    return str(user_id)


__all__ = ["current_user_id", "decode_access_token"]

"""Koneksi database — MySQL `db_property` YANG SAMA dengan Node.js.

TIDAK ada migrasi skema dan TIDAK ada tabel baru. Selama transisi, kedua
backend membaca/menulis tabel yang sama, jadi skema WAJIB diperlakukan sebagai
milik bersama: jangan ubah kolom dari sisi Python selama Node.js masih hidup.

Catatan urutan boot (dari V8): di Node.js, `ensureRequiredDatabaseColumns()`
HARUS berjalan sebelum `sequelize.sync()`. Sisi Python sengaja TIDAK
menjalankan DDL apa pun — Node.js tetap pemilik skema sampai peralihan selesai.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """Engine tunggal (lazy).

    ⚠️ `pool_pre_ping=True` SENGAJA TIDAK dipakai — diverifikasi langsung (15
    Agu 2026) bahwa kombinasi SQLAlchemy 2.0.36 + aiomysql 0.2.0 di proyek ini
    melempar `AsyncAdapt_aiomysql_connection.ping() missing 1 required
    positional argument: 'reconnect'` pada setiap health-check/query — bug
    ketidakcocokan sinyal antara wrapper async SQLAlchemy dan aiomysql, bukan
    masalah di kode ini. `pool_recycle=3600` dipertahankan sebagai mitigasi:
    MySQL memutus koneksi menganggur lewat `wait_timeout` (default 8 jam),
    dan koneksi didaur ulang jauh sebelum itu — cukup untuk backend yang
    berumur panjang tanpa butuh pre-ping.
    """
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.database_url,
            pool_recycle=3600,
            echo=False,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            expire_on_commit=False,
            class_=AsyncSession,
        )
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency FastAPI — satu sesi per permintaan."""
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def check_connection() -> dict[str, Any]:
    """Cek kesehatan DB. TIDAK melempar — dipakai endpoint /health.

    Health check yang melempar akan membuat proses terlihat mati padahal hanya
    DB-nya yang bermasalah; kembalikan status supaya bisa dibedakan.
    """
    from sqlalchemy import text

    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"connected": True, "error": None}
    except Exception as exc:  # noqa: BLE001
        return {"connected": False, "error": str(exc)[:200]}


async def dispose_engine() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None

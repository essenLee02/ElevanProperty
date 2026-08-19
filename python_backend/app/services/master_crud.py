"""CRUD generik untuk master data — satu implementasi, dipakai semua modul.

Di Node.js, ketujuh `*MasterController.js` mengulang alur yang SAMA
(list/detail/insert/update/toggle/delete) sebanyak ±3.610 baris. Duplikasi
itulah yang membuat modul-modul saling menyimpang seiring waktu — pola yang
sudah berulang kali menggigit proyek ini (M87, M88, M92: modul berbeda untuk
konsep sama, isi berbeda).

Di sini alurnya ditulis SEKALI dan diparameterkan. Yang membedakan tiap modul
hanya: model, nama kolom ID, label untuk pesan, dan scope keunikan.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ids import generate_random_id, normalize_name, today_date
from app.core.responses import status_label

DELETED = 3


@dataclass(frozen=True)
class MasterSpec:
    """Deskripsi satu modul master data."""

    model: type
    id_field: str                       # mis. "country_id"
    label: str                          # mis. "Negara" (untuk pesan)
    list_key: str                       # mis. "countries" (kunci payload)
    # Kolom FK yang WAJIB diisi saat insert, mis. {"province_id": ...} untuk City.
    parent_fields: Sequence[str] = field(default_factory=tuple)
    # Keunikan nama dicek dalam lingkup ini; kosong = global.
    # City unik per province_id, Province unik per country_id, Country global.
    unique_scope: Sequence[str] = field(default_factory=tuple)
    # Simpan nama UPPERCASE? Node.js melakukannya untuk country/province/city/
    # location; facility mempertahankan huruf aslinya.
    uppercase_name: bool = True
    extra_fields: Sequence[str] = field(default_factory=tuple)


def _row_to_dict(spec: MasterSpec, row: Any, no: int | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if no is not None:
        out["no"] = no
    out["id"] = row.id
    out[spec.id_field] = getattr(row, spec.id_field)
    for fk in spec.parent_fields:
        out[fk] = getattr(row, fk, None)
    out["name"] = row.name
    for extra in spec.extra_fields:
        out[extra] = getattr(row, extra, None)
    out["status"] = row.status
    out["status_label"] = status_label(row.status)
    out["created_date"] = str(row.created_date) if row.created_date else None
    out["created_by"] = row.created_by
    out["updated_date"] = str(row.updated_date) if row.updated_date else None
    out["updated_by"] = row.updated_by
    return out


async def find_duplicate_name(
    db: AsyncSession,
    spec: MasterSpec,
    name: str,
    *,
    scope_values: dict[str, Any] | None = None,
    exclude_id: str | None = None,
) -> Any | None:
    """Cari baris lain dengan nama yang SAMA SECARA MANUSIA.

    Perbandingan memakai `normalize_name()`, bukan `=` — supaya "D.I.Y Shop"
    dan "DIY  Shop" dianggap duplikat. Kalau hanya mengandalkan UNIQUE di DB,
    master data akan terisi baris-baris yang secara manusia identik.
    """
    target = normalize_name(name)
    if not target:
        return None

    stmt = select(spec.model).where(spec.model.status != DELETED)
    for col in spec.unique_scope:
        value = (scope_values or {}).get(col)
        if value is not None:
            stmt = stmt.where(getattr(spec.model, col) == value)
    if exclude_id:
        stmt = stmt.where(getattr(spec.model, spec.id_field) != exclude_id)

    rows = (await db.execute(stmt)).scalars().all()
    return next((r for r in rows if normalize_name(r.name) == target), None)


async def list_records(
    db: AsyncSession,
    spec: MasterSpec,
    *,
    page: int = 1,
    page_size: int = 10,
    search: str = "",
    filters: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Daftar berpaginasi, TANPA baris terhapus (status=3)."""
    page = max(1, page)
    offset = (page - 1) * page_size

    conditions = [spec.model.status != DELETED]
    if search:
        conditions.append(spec.model.name.like(f"%{search}%"))
    for col, value in (filters or {}).items():
        if value:
            conditions.append(getattr(spec.model, col) == value)

    total = (
        await db.execute(select(func.count()).select_from(spec.model).where(*conditions))
    ).scalar_one()

    rows = (
        await db.execute(
            select(spec.model).where(*conditions).order_by(spec.model.name.asc())
            .limit(page_size).offset(offset)
        )
    ).scalars().all()

    return [_row_to_dict(spec, r, offset + i + 1) for i, r in enumerate(rows)], int(total)


async def get_record(db: AsyncSession, spec: MasterSpec, record_id: str) -> Any | None:
    stmt = select(spec.model).where(
        getattr(spec.model, spec.id_field) == record_id,
        spec.model.status != DELETED,
    )
    return (await db.execute(stmt)).scalars().first()


async def create_record(
    db: AsyncSession,
    spec: MasterSpec,
    *,
    name: str,
    created_by: str,
    parents: dict[str, Any] | None = None,
    extras: dict[str, Any] | None = None,
) -> Any:
    total = (await db.execute(select(func.count()).select_from(spec.model))).scalar_one()
    new_id = generate_random_id(name, int(total))

    # ── Kolom `id` dihitung EKSPLISIT (MAX+1) ───────────────────────────────
    # Sebagian tabel master dideklarasikan `id int(11) NOT NULL` TANPA
    # AUTO_INCREMENT (terkonfirmasi pada `locations`). Konsekuensinya:
    #   • membiarkan `id` NULL → error 1048 "Column 'id' cannot be null";
    #   • INSERT yang tidak menyebut `id` sama sekali → MySQL mengisi 0,
    #     sehingga RATUSAN baris berbagi id 0. Itulah yang terjadi pada 379
    #     baris `locations` (seeding 13 Agu), dan itu MENYEMBUNYIKAN baris dari
    #     ORM mana pun yang memakai `id` sebagai identitas.
    # Menghitungnya di sini membuat setiap baris baru punya id unik, apa pun
    # keadaan skemanya — dan tidak merusak tabel yang memang AUTO_INCREMENT.
    max_id = (await db.execute(select(func.max(spec.model.id)))).scalar_one_or_none()
    next_id = int(max_id or 0) + 1

    clean = str(name).strip()
    values: dict[str, Any] = {
        "id": next_id,
        spec.id_field: new_id,
        "name": clean.upper() if spec.uppercase_name else clean,
        "status": 1,
        "created_date": today_date(),
        "created_by": str(created_by).upper(),
        "updated_date": None,
        "updated_by": None,
        **(parents or {}),
        **(extras or {}),
    }

    row = spec.model(**values)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def update_record(
    db: AsyncSession,
    spec: MasterSpec,
    row: Any,
    *,
    name: str | None,
    updated_by: str,
    parents: dict[str, Any] | None = None,
    extras: dict[str, Any] | None = None,
) -> Any:
    if name is not None:
        clean = str(name).strip()
        row.name = clean.upper() if spec.uppercase_name else clean
    for key, value in (parents or {}).items():
        if value is not None:
            setattr(row, key, value)
    for key, value in (extras or {}).items():
        if value is not None:
            setattr(row, key, value)

    row.updated_date = today_date()
    row.updated_by = str(updated_by).upper()

    await db.commit()
    await db.refresh(row)
    return row


async def toggle_status(db: AsyncSession, spec: MasterSpec, row: Any, updated_by: str) -> Any:
    """1 ⇄ 2. TIDAK PERNAH menyentuh status 3 (terhapus)."""
    row.status = 2 if row.status == 1 else 1
    row.updated_date = today_date()
    row.updated_by = str(updated_by).upper()
    await db.commit()
    await db.refresh(row)
    return row


async def soft_delete(db: AsyncSession, spec: MasterSpec, row: Any, updated_by: str) -> Any:
    """Soft delete (status=3).

    Sengaja BUKAN DELETE fisik: baris ini bisa dirujuk properti/chat lama.
    Menghapusnya benar-benar akan memutus riwayat yang sudah terkirim ke
    customer.
    """
    row.status = DELETED
    row.updated_date = today_date()
    row.updated_by = str(updated_by).upper()
    await db.commit()
    return row


def to_payload(spec: MasterSpec, row: Any) -> dict[str, Any]:
    return _row_to_dict(spec, row)


__all__ = [
    "MasterSpec",
    "find_duplicate_name",
    "list_records",
    "get_record",
    "create_record",
    "update_record",
    "toggle_status",
    "soft_delete",
    "to_payload",
    "DELETED",
]

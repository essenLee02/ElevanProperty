"""Router master data — 6 endpoint per modul, dibangun dari SATU factory.

Rute dan bentuk respons dijaga IDENTIK dengan Node.js supaya frontend Vue yang
sama bisa menunjuk ke backend mana pun tanpa perubahan:

    GET    /api/{entity}/list                  ?page=&search=
    GET    /api/{entity}/detail/{id}
    POST   /api/{entity}/insert
    PUT    /api/{entity}/update/{id}
    PATCH  /api/{entity}/toggle-status/{id}
    DELETE /api/{entity}/delete/{id}

Semua rute memerlukan token (lihat `app.core.auth.current_user_id`).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.auth import current_user_id
from app.core.responses import build_pagination, send_error, send_success
from app.db import get_db
from app.models.master import City, Country, Facility, Location, Province
from app.services import master_crud as crud
from app.services.master_crud import MasterSpec

HTTP_OK = 200
HTTP_CREATED = 201
HTTP_BAD_REQUEST = 400
HTTP_NOT_FOUND = 404
HTTP_CONFLICT = 409
HTTP_SERVER_ERROR = 500


class MasterPayload(BaseModel):
    """Body insert/update. Field induk opsional — divalidasi per-modul."""

    name: str | None = Field(default=None, description="Nama record")
    country_id: str | None = None
    province_id: str | None = None
    keywords: str | None = None


# ── Spesifikasi tiap modul ──────────────────────────────────────────────────
SPECS: dict[str, MasterSpec] = {
    "country": MasterSpec(
        model=Country, id_field="country_id", label="Negara", list_key="countries",
    ),
    "province": MasterSpec(
        model=Province, id_field="province_id", label="Provinsi", list_key="provinces",
        parent_fields=("country_id",), unique_scope=("country_id",),
    ),
    "city": MasterSpec(
        model=City, id_field="city_id", label="Kota", list_key="cities",
        parent_fields=("country_id", "province_id"), unique_scope=("province_id",),
    ),
    "location": MasterSpec(
        model=Location, id_field="location_id", label="Lokasi", list_key="locations",
    ),
    "facility": MasterSpec(
        model=Facility, id_field="facility_id", label="Fasilitas", list_key="facilities",
        # Fasilitas mempertahankan huruf asli ("Kolam renang"), tidak di-UPPERCASE.
        uppercase_name=False, extra_fields=("keywords",),
    ),
}


def _parents_from(spec: MasterSpec, payload: MasterPayload) -> dict[str, Any]:
    return {f: getattr(payload, f, None) for f in spec.parent_fields}


def _extras_from(spec: MasterSpec, payload: MasterPayload) -> dict[str, Any]:
    return {f: getattr(payload, f, None) for f in spec.extra_fields}


def build_master_router(entity: str, spec: MasterSpec) -> APIRouter:
    """Bangun 6 endpoint standar untuk satu modul master data."""
    router = APIRouter(prefix=f"/api/{entity}", tags=[f"master:{entity}"])

    @router.get("/list")
    async def list_items(  # noqa: ANN202
        page: int = Query(1, ge=1),
        search: str = Query(""),
        country_id: str = Query(""),
        province_id: str = Query(""),
        db: AsyncSession = Depends(get_db),
        _user: str = Depends(current_user_id),
    ):
        try:
            page_size = get_settings().PAGINATION_ROWS
            # Filter induk hanya berlaku bila modulnya memang punya kolom itu.
            filters = {
                f: v
                for f, v in (("country_id", country_id), ("province_id", province_id))
                if f in spec.parent_fields and v
            }
            rows, total = await crud.list_records(
                db, spec, page=page, page_size=page_size, search=search.strip(), filters=filters,
            )
            return send_success(
                HTTP_OK,
                {spec.list_key: rows, "pagination": build_pagination(total, page, page_size)},
                f"Data {spec.label.lower()} berhasil dimuat",
            )
        except Exception as exc:  # noqa: BLE001
            return send_error(HTTP_SERVER_ERROR, None, f"Gagal memuat {spec.label.lower()}: {exc}")

    @router.get("/detail/{record_id}")
    async def detail(  # noqa: ANN202
        record_id: str,
        db: AsyncSession = Depends(get_db),
        _user: str = Depends(current_user_id),
    ):
        row = await crud.get_record(db, spec, record_id)
        if row is None:
            return send_error(HTTP_NOT_FOUND, None, f"{spec.label} tidak ditemukan")
        return send_success(HTTP_OK, {entity: crud.to_payload(spec, row)}, f"Detail {spec.label.lower()} dimuat")

    @router.post("/insert")
    async def insert(  # noqa: ANN202
        payload: MasterPayload,
        db: AsyncSession = Depends(get_db),
        user_id: str = Depends(current_user_id),
    ):
        name = (payload.name or "").strip()
        if not name:
            return send_error(HTTP_BAD_REQUEST, None, f"Nama {spec.label.lower()} wajib diisi")

        parents = _parents_from(spec, payload)
        missing = [f for f in spec.parent_fields if not parents.get(f)]
        if missing:
            return send_error(HTTP_BAD_REQUEST, None, f"{', '.join(missing)} wajib disertakan")

        try:
            dup = await crud.find_duplicate_name(db, spec, name, scope_values=parents)
            if dup is not None:
                return send_error(
                    HTTP_CONFLICT, None,
                    f'{spec.label} "{name}" sudah terdaftar. Gunakan data yang sudah ada '
                    "untuk menghindari duplikasi.",
                )
            row = await crud.create_record(
                db, spec, name=name, created_by=user_id,
                parents=parents, extras=_extras_from(spec, payload),
            )
            return send_success(
                HTTP_CREATED, {entity: crud.to_payload(spec, row)},
                f"{spec.label} berhasil ditambahkan",
            )
        except Exception as exc:  # noqa: BLE001
            await db.rollback()
            return send_error(HTTP_SERVER_ERROR, None, f"Gagal menambahkan {spec.label.lower()}: {exc}")

    @router.put("/update/{record_id}")
    async def update(  # noqa: ANN202
        record_id: str,
        payload: MasterPayload,
        db: AsyncSession = Depends(get_db),
        user_id: str = Depends(current_user_id),
    ):
        name = (payload.name or "").strip()
        if not name:
            return send_error(HTTP_BAD_REQUEST, None, f"Nama {spec.label.lower()} wajib diisi")

        row = await crud.get_record(db, spec, record_id)
        if row is None:
            return send_error(HTTP_NOT_FOUND, None, f"{spec.label} tidak ditemukan")

        try:
            parents = _parents_from(spec, payload)
            # Untuk cek duplikat, pakai induk BARU bila dikirim; kalau tidak,
            # induk yang tersimpan — memindahkan kota ke provinsi lain harus
            # diuji terhadap provinsi TUJUAN, bukan asal.
            scope = {f: parents.get(f) or getattr(row, f, None) for f in spec.unique_scope}
            dup = await crud.find_duplicate_name(
                db, spec, name, scope_values=scope, exclude_id=record_id,
            )
            if dup is not None:
                return send_error(HTTP_CONFLICT, None, f'{spec.label} "{name}" sudah terdaftar')

            row = await crud.update_record(
                db, spec, row, name=name, updated_by=user_id,
                parents=parents, extras=_extras_from(spec, payload),
            )
            return send_success(
                HTTP_OK, {entity: crud.to_payload(spec, row)},
                f"{spec.label} berhasil diperbarui",
            )
        except Exception as exc:  # noqa: BLE001
            await db.rollback()
            return send_error(HTTP_SERVER_ERROR, None, f"Gagal memperbarui {spec.label.lower()}: {exc}")

    @router.patch("/toggle-status/{record_id}")
    async def toggle(  # noqa: ANN202
        record_id: str,
        db: AsyncSession = Depends(get_db),
        user_id: str = Depends(current_user_id),
    ):
        row = await crud.get_record(db, spec, record_id)
        if row is None:
            return send_error(HTTP_NOT_FOUND, None, f"{spec.label} tidak ditemukan")
        try:
            row = await crud.toggle_status(db, spec, row, user_id)
            state = "diaktifkan" if row.status == 1 else "dinonaktifkan"
            return send_success(HTTP_OK, {entity: crud.to_payload(spec, row)}, f"{spec.label} berhasil {state}")
        except Exception as exc:  # noqa: BLE001
            await db.rollback()
            return send_error(HTTP_SERVER_ERROR, None, f"Gagal mengubah status: {exc}")

    @router.delete("/delete/{record_id}")
    async def delete(  # noqa: ANN202
        record_id: str,
        db: AsyncSession = Depends(get_db),
        user_id: str = Depends(current_user_id),
    ):
        row = await crud.get_record(db, spec, record_id)
        if row is None:
            return send_error(HTTP_NOT_FOUND, None, f"{spec.label} tidak ditemukan")
        try:
            await crud.soft_delete(db, spec, row, user_id)
            return send_success(HTTP_OK, None, f"{spec.label} berhasil dihapus")
        except Exception as exc:  # noqa: BLE001
            await db.rollback()
            return send_error(HTTP_SERVER_ERROR, None, f"Gagal menghapus {spec.label.lower()}: {exc}")

    return router


def all_master_routers() -> list[APIRouter]:
    return [build_master_router(entity, spec) for entity, spec in SPECS.items()]


__all__ = ["all_master_routers", "build_master_router", "SPECS", "MasterPayload"]

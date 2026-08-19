"""Model SQLAlchemy untuk master data — memetakan tabel yang SUDAH ADA.

⚠️ TIDAK ADA DDL DARI SISI PYTHON. Selama migrasi, Node.js tetap pemilik skema
(`ensureRequiredDatabaseColumns()` → `sequelize.sync()`), dan kedua backend
membaca/menulis tabel yang sama. Model di sini hanya PEMBACAAN struktur —
`Base.metadata.create_all()` tidak boleh dipanggil di mana pun.

Konvensi status di seluruh master data:
    1 = aktif · 2 = disabled/blocked · 3 = deleted (soft delete)
Baris status=3 TIDAK PERNAH tampil di list/detail — hanya disembunyikan,
tidak dihapus, supaya relasi ke properti/chat lama tidak putus.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base deklaratif. Sengaja TIDAK dipakai untuk membuat tabel."""


class _AuditMixin:
    """Kolom audit yang sama di seluruh master data."""

    status: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    updated_date: Mapped[date | None] = mapped_column(Date, nullable=True, default=None)
    updated_by: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)


# ⚠️ PRIMARY KEY ORM = KOLOM `*_id`, BUKAN `id`.
#
# Kolom `id` di beberapa tabel TIDAK bisa dipercaya sebagai identitas. Terbukti
# 14 Agu 2026: `locations` punya 589 baris tapi hanya 211 nilai `id` unik —
# 379 baris di antaranya ber-`id = 0`, karena tabel itu dideklarasikan
# `id int(11) NOT NULL` TANPA AUTO_INCREMENT, sehingga setiap INSERT yang tidak
# menyebut `id` mendapat 0.
#
# SQLAlchemy memakai primary key untuk identity map: bila banyak baris berbagi
# PK yang sama, hasil query DIRUNTUHKAN diam-diam — 589 baris menjadi 211, dan
# baris yang "hilang" tidak pernah terlihat oleh pengecekan duplikat. Gejalanya
# muncul sebagai "duplikat lolos", bukan sebagai error.
#
# `*_id` (country_id/city_id/location_id/…) adalah kunci bisnis yang benar,
# UNIQUE di skema, dan yang dipakai seluruh rute Node.js untuk mengalamatkan
# record. Memetakannya sebagai PK membuat ORM benar TANPA menyentuh data.


class Country(_AuditMixin, Base):
    __tablename__ = "countries"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    country_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class Province(_AuditMixin, Base):
    __tablename__ = "provinces"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    province_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    country_id: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class City(_AuditMixin, Base):
    __tablename__ = "cities"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    city_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    # `cities` menyimpan country_id JUGA (denormalisasi) dan kolomnya NOT NULL —
    # diambil dari provinsi induk, bukan ditebak (pelajaran M93/V7: seeding
    # gagal karena kolom ini terlewat).
    country_id: Mapped[str] = mapped_column(String(50), nullable=False)
    province_id: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class Location(_AuditMixin, Base):
    """Landmark/patokan lokasi (Q6). 587 baris aktif per 13 Agu 2026."""

    __tablename__ = "locations"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    location_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)


class Facility(_AuditMixin, Base):
    """Master fasilitas + sinonim.

    `keywords` bertipe JSON di MySQL dan dipakai chatbot untuk mengenali
    sebutan customer ("kolam" → "Kolam renang"). Dipetakan sebagai Text di sini
    karena Python hanya MEMBACANYA; penulisan sinonim tetap lewat Node.js
    (`scripts/seed-facility-keywords.js`).
    """

    __tablename__ = "facilities"

    id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    facility_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    keywords: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)


__all__ = ["Base", "Country", "Province", "City", "Location", "Facility"]

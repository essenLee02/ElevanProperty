"""Generator ID record + normalisasi nama — port `controllers/GeneralController.js`.

Format ID: [prefix 2 huruf] + [random alphanumeric] + [count+1 padded 3 digit]
  "Indonesia", count=3        → "IN" + 5 acak + "004"
  "Jawa Timur", count=3       → "JT" + 5 acak + "004"

⚠️ Formatnya WAJIB sama persis dengan Node.js. Selama migrasi kedua backend
menulis ke tabel yang SAMA; ID dengan bentuk berbeda akan terlihat sebagai data
asing di dashboard dan memutus konvensi yang sudah dipakai 650 kota +
587 landmark yang sudah ada.
"""

from __future__ import annotations

import re
import secrets
from datetime import date

_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def generate_random_id(name: str | None, count: int, length: int = 5) -> str:
    """Padanan `GeneralController.generateRandomId(name, count, length)`.

    Prefix: 1 kata → dua huruf pertama; ≥2 kata → huruf awal kata pertama +
    huruf awal kata terakhir. Nama kosong jatuh ke "GX" seperti versi Node.js.
    """
    random_part = "".join(secrets.choice(_ALPHABET) for _ in range(length))

    clean = str(name or "").strip()
    parts = [p for p in re.split(r"\s+", clean) if p]

    if len(parts) < 2:
        first = clean[0] if len(clean) > 0 else "G"
        second = clean[1] if len(clean) > 1 else "X"
        prefix = f"{first}{second}".upper()
    else:
        prefix = f"{parts[0][0]}{parts[-1][0]}".upper()

    total = int(count) + 1
    number = f"{total:03d}" if total < 1000 else str(total)

    return f"{prefix}{random_part}{number}".upper()


def normalize_name(name: str | None) -> str:
    """Normalisasi untuk perbandingan duplikat.

    "Jawa  Timur " → "jawa timur". Non-alfanumerik jadi spasi supaya
    "D.I.Y Shop" dan "DIY Shop" dianggap sama — itulah gunanya, mencegah
    master data terisi dua baris yang secara manusia identik.
    """
    lowered = str(name or "").lower()
    cleaned = re.sub(r"[^a-z0-9\s]", " ", lowered)
    return re.sub(r"\s+", " ", cleaned).strip()


def today_date() -> date:
    """Tanggal hari ini (kolom DATEONLY di Node.js)."""
    return date.today()


__all__ = ["generate_random_id", "normalize_name", "today_date"]

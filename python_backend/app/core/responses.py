"""Format respons API — port `utils/responseFormat.js`.

Bentuknya WAJIB identik dengan Node.js karena frontend Vue yang SAMA
mengonsumsi keduanya selama migrasi:

    {
      "status":    200,
      "data": { "response": <payload>, "message": "..." },
      "isSuccess": 1        # 1 = sukses, 2 = gagal
    }

`isSuccess` numerik (bukan boolean) dipertahankan apa adanya — frontend
memeriksanya sebagai angka, jadi mengubahnya jadi true/false akan memutus
setiap layar master data sekaligus.
"""

from __future__ import annotations

from typing import Any

from fastapi.responses import JSONResponse

SUCCESS = 1
FAILURE = 2


def _body(status_code: int, response: Any, message: str, is_success: int) -> dict[str, Any]:
    return {
        "status": status_code,
        "data": {"response": response, "message": message},
        "isSuccess": is_success,
    }


def send_success(status_code: int, response: Any = None, message: str = "Sukses") -> JSONResponse:
    return JSONResponse(status_code=status_code, content=_body(status_code, response, message, SUCCESS))


def send_error(status_code: int, response: Any = None, message: str = "Terjadi kesalahan") -> JSONResponse:
    return JSONResponse(status_code=status_code, content=_body(status_code, response, message, FAILURE))


def build_pagination(total: int, page: int, page_size: int) -> dict[str, Any]:
    """Blok paginasi dengan nama field persis seperti Node.js."""
    total_pages = (total + page_size - 1) // page_size if page_size else 0
    return {
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": total_pages,
        "hasNextPage": page < total_pages,
        "hasPrevPage": page > 1,
    }


def status_label(status: int | None) -> str:
    """1 = Aktif, selain itu Disabled (3 = deleted, tidak pernah ditampilkan)."""
    return "Aktif" if status == 1 else "Disabled"


__all__ = [
    "send_success",
    "send_error",
    "build_pagination",
    "status_label",
    "SUCCESS",
    "FAILURE",
]

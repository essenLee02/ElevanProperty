"""Embedding teks untuk RAG — panggilan HTTP langsung ke OpenAI (M101).

⚠️ TIDAK MEMAKAI LangChain — dan itu keputusan sadar, bukan kelalaian.
Spesifikasi asli (worldbank/WhatsApp-RAG-Example) memakai `OpenAIEmbeddings`
milik LangChain. Yang benar-benar dibutuhkan dari sana hanyalah SATU endpoint
HTTP (`POST /v1/embeddings`); menarik LangChain beserta seluruh pohon
dependensinya menambah permukaan pemeliharaan tanpa menambah kemampuan.
Referensi yang diminta untuk dicontek (`Integra_Assistance/backend`) mengambil
keputusan yang SAMA dan menuliskan alasannya di docstring
`app/services/embedding_service.py` miliknya. V8 §10 juga sudah mencatat
LangChain sebagai DITOLAK DENGAN SENGAJA untuk proyek ini.

⛔ KEBIJAKAN BILLING (backend/.env): kuota habis → lempar error → sistem
turun ke pencarian leksikal. TIDAK ADA auto-topup.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Harus SAMA dengan model yang dipakai `node scripts/build-rag-index.js` —
# vektor dari model berbeda hidup di ruang vektor berbeda, dan cosine
# antar-ruang TIDAK bermakna (hasilnya angka, tapi angka yang salah).
DEFAULT_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536

_TIMEOUT_S = 30.0
_OPENAI_URL = "https://api.openai.com/v1/embeddings"


class EmbeddingError(Exception):
    """Gagal membuat embedding. Pemanggil WAJIB tetap jalan (fallback leksikal)."""


def model_name() -> str:
    return (get_settings().RAG_EMBEDDING_MODEL or DEFAULT_MODEL).strip() or DEFAULT_MODEL


def is_available() -> bool:
    """Embedding memakai kredensial ChatGPT yang sama dengan jalur percakapan."""
    return bool((get_settings().CHAT_GPT_API_KEY or "").strip())


async def embed_texts(texts: list[str], *, batch_size: int = 200) -> list[list[float]]:
    """Embedding untuk BANYAK teks sekaligus — urutan hasil dipertahankan.

    ⚠️ DIPAKAI UNTUK MEMBANGUN INDEKS, bukan untuk kueri per-pesan.
    Endpoint `/v1/embeddings` menerima ARRAY input. Mengirim satu teks per
    panggilan (seperti `embed_query`) untuk 641 chunk berarti 641 round-trip
    HTTP — diukur langsung: macet di ~100 chunk karena rate limit, padahal
    pekerjaannya sama. Dengan batch 200, jumlah panggilan turun jadi 4.

    Urutan hasil TIDAK dijamin oleh API, jadi diurutkan ulang lewat field
    `index` sebelum dipakai — tanpa itu, vektor ke-N bisa menjadi milik teks
    yang berbeda, dan kesalahan seperti itu TIDAK akan terlihat sebagai error,
    hanya sebagai hasil pencarian yang aneh.
    """
    if not texts:
        return []

    settings = get_settings()
    api_key = (settings.CHAT_GPT_API_KEY or "").strip()
    if not api_key:
        raise EmbeddingError("CHAT_GPT_API_KEY kosong — embedding tidak bisa dibuat")

    out: list[list[float]] = []
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=120.0) as client:
        for start in range(0, len(texts), batch_size):
            batch = texts[start:start + batch_size]
            # API menolak string kosong; diganti spasi supaya JUMLAH dan URUTAN
            # hasil tetap sejajar dengan input.
            payload = {
                "model": model_name(),
                "input": [t if t.strip() else " " for t in batch],
            }
            last_err: Exception | None = None
            for attempt in range(3):
                try:
                    resp = await client.post(_OPENAI_URL, json=payload, headers=headers)
                    if resp.status_code >= 400:
                        raise EmbeddingError(
                            f"Embedding ditolak (HTTP {resp.status_code}): {resp.text[:200]}"
                        )
                    rows = (resp.json() or {}).get("data") or []
                    rows.sort(key=lambda r: r.get("index", 0))
                    if len(rows) != len(batch):
                        raise EmbeddingError(
                            f"Jumlah embedding ({len(rows)}) != jumlah teks ({len(batch)})"
                        )
                    out.extend(r["embedding"] for r in rows)
                    last_err = None
                    break
                except Exception as exc:  # noqa: BLE001
                    last_err = exc
                    if attempt < 2:
                        await asyncio.sleep(3 * (attempt + 1))
            if last_err is not None:
                raise EmbeddingError(f"Batch {start}-{start + len(batch)} gagal: {last_err}")
            logger.info("[EMBED] %s/%s teks selesai", len(out), len(texts))

    return out


async def embed_query(text: str) -> list[float]:
    """Embedding untuk satu kueri pencarian.

    :raises EmbeddingError: bila API key kosong, ditolak, atau kuota habis.
    """
    settings = get_settings()
    api_key = (settings.CHAT_GPT_API_KEY or "").strip()
    if not api_key:
        raise EmbeddingError("CHAT_GPT_API_KEY kosong — embedding tidak bisa dibuat")

    clean = (text or "").strip()
    if not clean:
        raise EmbeddingError("Teks kueri kosong")

    payload: dict[str, Any] = {"model": model_name(), "input": [clean]}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            resp = await client.post(
                _OPENAI_URL, json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
        if resp.status_code >= 400:
            raise EmbeddingError(f"Embedding ditolak (HTTP {resp.status_code}): {resp.text[:200]}")
        rows = (resp.json() or {}).get("data") or []
        if not rows:
            raise EmbeddingError("Respons embedding kosong")
        return rows[0]["embedding"]
    except EmbeddingError:
        raise
    except httpx.RequestError as exc:
        raise EmbeddingError(f"Gagal terhubung ke API embedding: {exc}") from exc
    except (KeyError, ValueError) as exc:
        raise EmbeddingError(f"Respons embedding tidak terbaca: {exc}") from exc


__all__ = ["embed_query", "is_available", "model_name", "EmbeddingError", "EMBEDDING_DIM"]

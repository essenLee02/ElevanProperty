"""Kirim pesan WhatsApp via Kirimi — port `sendViaKirimi()` (M105).

⚠️ MODUL INI BENAR-BENAR MENGIRIM KE CUSTOMER SUNGGUHAN. Berbeda dari seluruh
modul Python lain sejauh ini (yang hanya menyusun/menyimpan), kesalahan di
sini terlihat langsung oleh customer.

Dua perilaku Node.js yang WAJIB ikut diport, bukan sekadar "POST lalu anggap
sukses":

1. **Deteksi GAGAL-PALSU.** Kirimi bisa membalas HTTP 200 tapi isinya
   kegagalan (`success:false`, `status:"failed"`, device disconnect, nomor
   tidak terdaftar WA, kuota habis). Menganggap 200 = terkirim membuat
   terminal menampilkan "✅ Terkirim" padahal customer tidak menerima apa pun
   — kelas bug yang paling mahal karena TIDAK terlihat sebagai error.

2. **Retry hanya untuk kegagalan JARINGAN.** Timeout/koneksi putus boleh
   diulang; penolakan API (nomor salah, kredensial salah) TIDAK boleh —
   mengulangnya hanya menggandakan pesan atau membuang waktu.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

import httpx

from app.config import get_settings
from app.core.kirimi_message import normalize_phone
from app.core.whatsapp_utils import mask_phone

logger = logging.getLogger(__name__)


class KirimiSendError(Exception):
    """Gagal mengirim pesan WhatsApp lewat Kirimi."""


def _api_base() -> str:
    return (get_settings().KIRIMI_API_URL or "https://api.kirimi.id").rstrip("/")


def _send_path() -> str:
    fast = (get_settings().KIRIMI_SEND_FAST or "").strip().lower() == "true"
    return "/v1/send-message-fast" if fast else "/v1/send-message"


def append_sent_via_tag(message: str) -> str:
    """Footer "> Sent via <tag>" — sama seperti Node.js `appendSentViaTag()`."""
    tag = (get_settings().AI_PRIMARY_TAG or "").strip()
    text = str(message or "").rstrip()
    if not tag or not text:
        return text
    if tag.lower() in text.lower():
        return text
    return f"{text}\n\n> Sent via {tag}"


# Bentuk-bentuk "sebenarnya gagal" walau HTTP 200 — port dari Node.js.
_FAIL_STATUS_RE = re.compile(
    r"fail|gagal|error|invalid|reject|not[\s_-]*connect|disconnect|expired|unauthor", re.IGNORECASE)
_FAIL_MESSAGE_RE = re.compile(
    r"fail|gagal|error|invalid|tidak\s+terkirim|not\s+sent|reject", re.IGNORECASE)


def _looks_failed(data: dict[str, Any]) -> str | None:
    """Kembalikan alasan gagal bila respons Kirimi sebenarnya kegagalan."""
    if not isinstance(data, dict):
        return None
    if data.get("success") is False or data.get("status") is False or data.get("sent") is False:
        return str(data.get("message") or data.get("error") or "Kirimi: gagal kirim")
    if data.get("error"):
        return str(data.get("error"))
    status_str = str(data.get("status") if data.get("status") is not None else data.get("state") or "")
    if status_str and _FAIL_STATUS_RE.search(status_str):
        return status_str
    msg = str(data.get("message") or "")
    if msg and _FAIL_MESSAGE_RE.search(msg):
        return msg
    return None


async def send_message(
    target_phone: str,
    message: str,
    device_id: str,
    *,
    media_url: str | None = None,
) -> dict[str, Any]:
    """Kirim satu pesan WhatsApp. Melempar `KirimiSendError` bila gagal."""
    settings = get_settings()
    user_code = (settings.KIRIMI_USER_CODE or "").strip()
    secret = (settings.KIRIMI_SECRET or "").strip()

    if not user_code or not secret:
        raise KirimiSendError("KIRIMI_USER_CODE / KIRIMI_SECRET belum di-set di .env")
    if not str(device_id or "").strip():
        raise KirimiSendError("Agent belum punya kirimi_device_id di database")

    phone = normalize_phone(target_phone)
    if not phone:
        raise KirimiSendError("Nomor tujuan kosong / tidak valid")

    body = str(message or "").strip()
    if not body:
        raise KirimiSendError("Isi pesan kosong")

    payload: dict[str, Any] = {
        "user_code": user_code,
        "secret": secret,
        "device_id": str(device_id).strip(),
        "phone": phone,
        # Kiriman gambar TIDAK diberi tag "sent via" (caption jadi aneh).
        "message": body if media_url else append_sent_via_tag(body),
    }
    if media_url:
        payload["media_url"] = str(media_url).strip()

    url = f"{_api_base()}{_send_path()}"
    timeout_s = max(1.0, settings.KIRIMI_TIMEOUT_MS / 1000)
    max_retries = max(1, settings.KIRIMI_RETRY_COUNT)
    retry_delay_s = max(0.1, settings.KIRIMI_RETRY_DELAY_MS / 1000)

    logger.info("[KIRIMI SEND] → %s | device: %s | len: %s%s",
                mask_phone(phone), payload["device_id"], len(payload["message"]),
                " | +media" if media_url else "")

    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                resp = await client.post(url, json=payload,
                                         headers={"Content-Type": "application/json"})

            try:
                data = resp.json()
            except Exception:  # noqa: BLE001
                data = {"raw": resp.text[:300]}

            logger.info("[KIRIMI SEND] API response (%s): %s",
                        resp.status_code, str(data)[:300])

            if resp.status_code >= 400:
                # 5xx = masalah sisi Kirimi → layak diulang. 4xx = permintaan
                # kita yang salah → mengulang tidak akan memperbaikinya.
                if resp.status_code >= 500 and attempt < max_retries:
                    last_error = KirimiSendError(f"HTTP {resp.status_code}: {str(data)[:200]}")
                    await asyncio.sleep(retry_delay_s * attempt)
                    continue
                raise KirimiSendError(f"HTTP {resp.status_code}: {str(data)[:200]}")

            reason = _looks_failed(data)
            if reason:
                # Ditolak API (bukan gangguan jaringan) → JANGAN diulang.
                raise KirimiSendError(reason)

            if attempt > 1:
                logger.info("[KIRIMI] Berhasil kirim pada percobaan %s/%s", attempt, max_retries)
            return data if isinstance(data, dict) else {"ok": True}

        except KirimiSendError:
            raise
        except (httpx.TimeoutException, httpx.RequestError) as exc:
            # HANYA kegagalan jaringan yang diulang.
            last_error = exc
            if attempt < max_retries:
                logger.warning("[KIRIMI SEND] percobaan %s/%s gagal (%s) — ulang dalam %.1fs",
                               attempt, max_retries, exc.__class__.__name__, retry_delay_s * attempt)
                await asyncio.sleep(retry_delay_s * attempt)
                continue

    raise KirimiSendError(f"Gagal kirim setelah {max_retries} percobaan: {last_error}")


def is_configured() -> bool:
    s = get_settings()
    return bool((s.KIRIMI_USER_CODE or "").strip() and (s.KIRIMI_SECRET or "").strip())


__all__ = ["send_message", "is_configured", "append_sent_via_tag", "KirimiSendError"]

"""POST /api/fonnte/webhook — sisi Python (M100).

Bentuk payload Fonnte BERBEDA dari Kirimi (`sender`/`message`/`inboxid`/
`eventType`, bukan `from`/`device_id`), jadi hanya parsing yang ditulis
terpisah. Seluruh alur setelahnya memakai `inbound_message_service` YANG SAMA
dengan Kirimi — lihat docstring modul itu untuk kenapa tidak disalin.

⚠️ FASE MIGRASI: sama seperti Kirimi — menyusun balasan, TIDAK mengirim.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import terminal_logger
from app.core.kirimi_message import normalize_phone
from app.db import get_db
from app.services.inbound_message_service import process_inbound

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fonnte", tags=["fonnte:webhook (dev)"])

TERMINAL = "FONNTE"


def detect_event_type(body: Any) -> str:
    """Port `detectEventType()` fonnteChatController.js.

    ⚠️ `message is not None`, BUKAN truthiness — pesan kosong ("") tetap harus
    terdeteksi sebagai incoming, sama seperti catatan eksplisit di Node.js.
    """
    if not isinstance(body, dict):
        return "unknown"
    if body.get("eventType") == "send":
        return "send"
    if body.get("sender") and (body.get("message") is not None or body.get("inboxid") is not None):
        return "incoming"
    if body.get("status") is not None or body.get("state") is not None or body.get("stateid") is not None:
        return "message_status"
    return "unknown"


def extract_message(body: dict | None) -> dict[str, Any]:
    body = body or {}
    return {
        "sender": normalize_phone(str(body.get("sender") or "").split("@")[0]),
        "name": str(body.get("name") or body.get("pushName") or "Customer").strip() or "Customer",
        "message": str(body.get("message") or body.get("text") or "").strip(),
        "message_id": str(body.get("inboxid") or body.get("id") or f"fonnte_{int(time.time() * 1000)}"),
        "token": str(body.get("token") or "").strip(),
    }


@router.post("/webhook")
async def fonnte_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    prefetched_body: dict | None = None,
) -> dict:
    """`prefetched_body` dipakai saat dipanggil dari handler root (`POST /`) —
    badan HTTP hanya bisa dibaca sekali."""
    body = prefetched_body if prefetched_body is not None else await request.json()

    event = detect_event_type(body)
    if event != "incoming":
        terminal_logger.log_event_ignored(terminal=TERMINAL, event_type=event)
        return {"status": True, "type": event, "message": "Webhook diterima (tidak diproses)"}

    x = extract_message(body)
    # Salinan dari Node.js tidak boleh membalas — lihat process_inbound().
    is_mirrored = request.headers.get("X-Mirrored-From", "").strip().lower() == "nodejs"

    result = await process_inbound(
        db, terminal=TERMINAL,
        sender=x["sender"], name=x["name"], message=x["message"],
        message_id=x["message_id"], token=x["token"],
        is_mirrored=is_mirrored,
    )

    return {
        "status": True, "type": "incoming", "message": result.reason,
        "ai_ok": result.ai_ok, "provider": result.provider,
        "context_source": result.context_source, "catalog_hits": result.catalog_hits,
    }

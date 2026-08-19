"""POST /api/kirimi/webhook — sisi Python (M98, diperluas M100/M101).

⚠️ FASE MIGRASI: menerima, menyaring, menyimpan, DAN menyusun balasan AI —
tapi TIDAK MENGIRIM apa pun ke customer. Node.js tetap satu-satunya yang
membalas (lihat MIGRATION_PLAN.md). Balasan dicetak ke terminal supaya
kualitasnya bisa dinilai berdampingan dengan Node.js sebelum trafik dialihkan.

URL ini BUKAN yang terdaftar di dashboard Kirimi produksi — itu tetap tunnel
Node.js (lihat V8 §5 M97: akun ngrok ini hanya punya SATU domain).

Router ini SENGAJA tipis: seluruh alur setelah parsing ada di
`app/services/inbound_message_service.py`, dipakai bersama Fonnte.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import terminal_logger
from app.core.kirimi_message import detect_event_type, extract_message
from app.db import get_db
from app.services.inbound_message_service import process_inbound

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/kirimi", tags=["kirimi:webhook (dev)"])

TERMINAL = "KIRIMI"


@router.post("/webhook")
async def kirimi_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    prefetched_body: dict | None = None,
) -> dict:
    """`prefetched_body` dipakai saat dipanggil ulang dari handler root
    (`POST /`). Badan permintaan HTTP hanya bisa dibaca SEKALI — memanggil
    `await request.json()` untuk kedua kalinya menghasilkan badan kosong dan
    pesan customer hilang tanpa jejak error."""
    body = prefetched_body if prefetched_body is not None else await request.json()

    event = detect_event_type(body)
    if event != "incoming":
        terminal_logger.log_event_ignored(terminal=TERMINAL, event_type=event)
        return {"status": True, "type": event, "message": "Webhook diterima (tidak diproses)"}

    x = extract_message(body)
    # Header dipasang pythonMirrorService.js — menandai bahwa ini SALINAN,
    # bukan webhook langsung dari Kirimi. Salinan tidak boleh membalas
    # (Node.js sudah membalas) — lihat process_inbound().
    is_mirrored = request.headers.get("X-Mirrored-From", "").strip().lower() == "nodejs"

    result = await process_inbound(
        db, terminal=TERMINAL,
        sender=x["sender"], name=x["name"], message=x["message"],
        message_id=x["message_id"], device_id=x["device_id"],
        is_mirrored=is_mirrored,
    )

    return {
        "status": True, "type": "incoming", "message": result.reason,
        "ai_ok": result.ai_ok, "provider": result.provider,
        "context_source": result.context_source, "catalog_hits": result.catalog_hits,
    }

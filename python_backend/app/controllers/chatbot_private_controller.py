"""app/controllers/chatbot_private_controller.py — port chatbotPrivateController.js (M113).

Lapisan CONTROLLER, disusun menyerupai `backend/controllers/` di Node.js
(diminta eksplisit: "python_backend menggunakan controller, persis dengan
backend\\controllers"). Router FastAPI hanya menempelkan HTTP; keputusan ada
di sini — sama seperti Express route → controller di Node.

KONTRAK HTTP DIJAGA IDENTIK dengan Node supaya frontend Vue yang sama bisa
menunjuk ke :5055 atau :5056 tanpa perubahan satu baris pun:

  GET  /api/chatbot/private-status   → privateAgentStatus()
  POST /api/chatbot/private-message  → sendPrivateMessage()

Nama field balasan mengikuti Node PERSIS (`success`, `reply`, `sessionId`,
`source`, `controller`, `fallbackUsed`, `directPrivateEndpoint`,
`exactMatches`, `rumah123Listings`, `alternatives`). Mengubah satu nama saja
berarti frontend harus bercabang per-backend — dan percabangan itulah yang
membuat migrasi tidak pernah selesai.

⚠️ YANG SENGAJA TIDAK DIPORT: `debugTestRumah123` (butuh APIFY_API_TOKEN dan
scraper Rumah123) dan seluruh kelas `ResponseBuilder`/`PropertyFormatter` Node
yang membangun balasan dari template. Jalur Python memakai
`whatsapp_ai_service.generate_whatsapp_reply()` — yang SUDAH memuat semua
perbaikan M107–M112 (batas sesi, pelacak slot, anti-ulang, penjaga keluaran).
Menyalin template Node ke Python akan menghidupkan kembali rasa "kaku seperti
robot" yang justru sedang diperbaiki.

⚠️ SATU OTAK UNTUK DUA KANAL. Chat website dan WhatsApp memakai orkestrator
yang SAMA. Node punya dua kelas terpisah (`ResponseBuilder` untuk web,
`ResponseBuilderWhatsApp` untuk WA) dan itu sumber bug berulang: satu kanal
diperbaiki, kanal lain terlupakan (pelajaran M27/M77 yang sudah tercatat di
inbound_message_service). Di Python keduanya berbagi satu jalur.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.chat import ChatMessage, ChatSession, User
from app.services.whatsapp_ai_service import generate_whatsapp_reply

logger = logging.getLogger(__name__)

SOURCE = "private_agent"
CONTROLLER = "chatbotPrivateController"

# Kanal disimpan berbeda dari WhatsApp supaya riwayat web dan WA bisa
# dibedakan saat audit, meski otak yang memprosesnya sama.
CHANNEL = "website_chatbot_private"


@dataclass(frozen=True)
class Validation:
    ok: bool
    message: str = ""


def validate_payload(*, name: str, phone: str, message: str) -> Validation:
    """Validasi minimum — sama urutannya dengan `validateRequest()` di Node."""
    if not message.strip():
        return Validation(False, "Pesan tidak boleh kosong.")
    if not name.strip():
        return Validation(False, "Nama wajib diisi.")
    if not phone.strip():
        return Validation(False, "Nomor telepon wajib diisi.")
    return Validation(True)


def private_agent_status() -> dict[str, Any]:
    """GET /api/chatbot/private-status — bentuk balasan mengikuti Node.

    ⚠️ `rumah123Enabled` SELALU False di Python: scraper Rumah123 belum
    diport. Melaporkannya True akan membuat dashboard menyatakan sumber data
    yang sebenarnya tidak ada — lebih baik jujur daripada terlihat lengkap.
    """
    settings = get_settings()
    return {
        "success": True,
        "enabled": True,
        "controller": CONTROLLER,
        "source": SOURCE,
        "behavior": "Activated when ChatGPT and Claude cannot generate a response.",
        "runtime": "python",
        "dataSource": {
            "rumah123Enabled": False,
            "rumah123Status": "OFF (belum diport ke Python)",
            "catalogEnabled": True,
            "catalogPath": "python_backend/data/rag/agent_catalog.*",
        },
        "ai": {
            "primaryProvider": settings.AI_PRIMARY_PROVIDER,
            "ragEnabled": settings.rag_enabled,
        },
    }


async def _resolve_agent(db: AsyncSession) -> User | None:
    result = await db.execute(
        select(User).where(User.status == 1, User.privilege == "agent")
    )
    return result.scalars().first()


async def _get_or_create_session(db: AsyncSession, *, phone: str, name: str) -> ChatSession:
    result = await db.execute(
        select(ChatSession).where(ChatSession.normalizedPhone == phone)
    )
    session = result.scalars().first()
    if session:
        session.lastMessageAt = datetime.utcnow()
        session.updatedAt = datetime.utcnow()
        return session

    session = ChatSession(
        name=name, normalizedName=name.strip().lower(),
        phone=phone, normalizedPhone=phone, source=CHANNEL,
        lastMessageAt=datetime.utcnow(),
    )
    db.add(session)
    await db.flush()
    return session


async def _load_history(db: AsyncSession, session_id: int, limit: int = 60) -> list[dict]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.chatSessionId == session_id)
        .order_by(ChatMessage.id.desc())
        .limit(limit)
    )
    rows = list(result.scalars())
    rows.reverse()
    return [{"role": r.role, "message": r.message} for r in rows]


def _store(
    db: AsyncSession,
    session_id: int,
    *,
    role: str,
    message: str,
    user_id: str | None = None,
    phone: str = "",
    ai_responder: str | None = None,
) -> None:
    """Simpan satu baris pesan.

    ⚠️ Nilai `role` HARUS 'customer' / 'ai' — bukan 'user' / 'assistant'.
    Seluruh kode lain (inbound_message_service, session_boundary,
    qualification_state) memakai konvensi itu; memasukkan varian baru membuat
    riwayat yang ditulis controller ini tidak terbaca oleh pelacak slot, dan
    gejalanya persis seperti "AI lupa jawaban customer".
    """
    db.add(ChatMessage(
        chatSessionId=session_id, user_id=user_id, customer_phone=phone or None,
        role=role, message=message, channel=CHANNEL, ai_responder=ai_responder,
        metadata_=json.dumps({"source": "python_chatbot_private"}),
    ))


async def send_private_message(
    db: AsyncSession,
    *,
    name: str,
    phone: str,
    message: str,
    location: str = "",
) -> tuple[int, dict[str, Any]]:
    """POST /api/chatbot/private-message. Mengembalikan (status_http, body).

    Status HTTP dikembalikan sebagai nilai, bukan dilempar sebagai exception,
    supaya router tetap tipis dan pengujian bisa memeriksa kode + body tanpa
    menjalankan server.
    """
    validation = validate_payload(name=name, phone=phone, message=message)
    if not validation.ok:
        return 400, {"success": False, "source": SOURCE,
                     "controller": CONTROLLER, "message": validation.message}

    agent = await _resolve_agent(db)
    if agent is None:
        return 503, {"success": False, "source": SOURCE, "controller": CONTROLLER,
                     "message": "Tidak ada agent aktif."}

    session = await _get_or_create_session(db, phone=phone.strip(), name=name.strip())
    history = await _load_history(db, session.id)

    _store(db, session.id, role="customer", message=message.strip(),
           user_id=agent.user_id, phone=phone.strip())

    result = await generate_whatsapp_reply(
        message.strip(),
        agent_name=(agent.name or "").strip(),
        agent_user_id=str(getattr(agent, "user_id", "") or agent.id),
        history=history,
        customer_name=name.strip(),
    )

    if not result.ok:
        # Balasan tidak layak kirim (provider gagal, atau penjaga keluaran M111
        # menolak template/placeholder). JANGAN mengarang teks pengganti —
        # frontend yang memutuskan apa yang ditampilkan.
        await db.commit()
        logger.error("[%s] gagal menyusun balasan: %s", CONTROLLER, result.error)
        return 502, {"success": False, "source": SOURCE, "controller": CONTROLLER,
                     "sessionId": session.id, "message": result.error}

    _store(db, session.id, role="ai", message=result.reply,
           user_id=agent.user_id, phone=phone.strip(), ai_responder=result.provider)
    await db.commit()

    return 200, {
        "success": True,
        "reply": result.reply,
        "sessionId": session.id,
        "source": SOURCE,
        "controller": CONTROLLER,
        "fallbackUsed": True,
        "directPrivateEndpoint": True,
        # Node mengembalikan tiga daftar ini dari katalog statis + Rumah123.
        # Python belum memisahkan hasil RAG jadi tiga kategori, jadi dikirim
        # kosong — BUKAN dihilangkan, supaya frontend tidak perlu cek `undefined`.
        "exactMatches": [],
        "rumah123Listings": [],
        "alternatives": [],
        "debug": {
            "provider": result.provider,
            "contextSource": result.context_source,
            "catalogHits": result.catalog_hits,
            "phase": result.debug.get("phase"),
            "missing": result.debug.get("missing"),
            "boundary": result.debug.get("boundary"),
            "humanizerIssues": result.debug.get("humanizer_issues"),
        },
    }


__all__ = [
    "SOURCE", "CONTROLLER", "CHANNEL", "Validation",
    "validate_payload", "private_agent_status", "send_private_message",
]

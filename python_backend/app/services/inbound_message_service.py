"""Pemrosesan pesan masuk WhatsApp — SATU jalur untuk SEMUA terminal (M100).

Kirimi dan Fonnte hanya berbeda pada BENTUK PAYLOAD dan cara mengirim balasan.
Segala hal setelah parsing — cari agent, gerbang properti, simpan, susun
balasan, log terminal — IDENTIK, jadi ditulis SEKALI di sini.

⚠️ INI BUKAN SEKADAR KERAPIAN. Menyalin alur ini per-terminal adalah kelas bug
yang sudah TIGA KALI menggigit proyek ini (M27, M77: "salinan fungsi
antar-terminal berbeda perilaku"). Ketika satu terminal diperbaiki dan yang
lain terlupakan, gejalanya muncul berbulan-bulan kemudian sebagai "kok di
Fonnte beda ya?" — dan tidak ada tes yang menangkapnya karena kedua jalur
sama-sama "bekerja".

⚠️ SEJAK M105, MODUL INI BISA BENAR-BENAR MEMBALAS CUSTOMER. Ada TIGA
lapisan yang menentukan terkirim atau tidak — urutannya penting:

  1. `is_mirrored=True` (salinan dari Node.js, header X-Mirrored-From)
     → TIDAK PERNAH mengirim, apa pun flag-nya. Kalau salinan ikut membalas,
       customer menerima DUA pesan (satu dari Node.js, satu dari Python).
  2. `PYTHON_AI_REPLY_ENABLED=false` (default) → hanya menyusun + log.
  3. Selain itu → kirim sungguhan lewat Kirimi.

⚠️ ATURAN OPERASIONAL yang TIDAK BISA dipaksakan kode (dua proses terpisah):
JANGAN menyalakan PYTHON_AI_REPLY_ENABLED sementara Node.js juga masih
melayani webhook yang sama. Pilih SATU yang membalas.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core import terminal_logger
from app.core.property_keyword_filter import (
    has_property_keyword,
    is_property_context_continuation,
)
from app.models.chat import ChatMessage, ChatSession, User
from app.services import kirimi_service
from app.services.kirimi_service import KirimiSendError
from app.services.whatsapp_ai_service import generate_whatsapp_reply

logger = logging.getLogger(__name__)

# Dedup in-memory per-proses (TTL 5 menit). BUKAN otoritas produksi — hanya
# mencegah webhook yang dikirim ulang diproses dua kali dalam satu sesi.
_seen: dict[str, float] = {}
_DEDUP_TTL_S = 300.0


# ⚠️ ID SINTETIS TIDAK BISA DIPAKAI UNTUK DEDUP (perbaikan M112).
# `extract_message()` memakai `f"kirimi_{ms}"` bila payload tidak memuat id.
# Nilainya BERBEDA setiap kali dipanggil, jadi webhook yang dikirim ulang
# mendapat id berbeda, lolos dedup, dan customer dibalas 2–3 kali — persis yang
# terjadi di transkrip 17 Agu (setiap pesan dijawab dua kali dengan kalimat
# berbeda, artinya benar-benar dua panggilan LLM terpisah).
#
# Perbaikannya di lapisan dedup, BUKAN di parser: parser punya harness parity
# dengan Node.js dan tidak boleh berubah karena alasan operasional Python.
_SYNTHETIC_ID_RE = re.compile(r"^kirimi_\d+$")

# Jendela sidik jari isi. Pengiriman ulang datang dalam hitungan milidetik–detik;
# customer yang MEMANG mengirim teks sama lagi biasanya berjarak lebih lama
# (lihat transkrip Case 8: "Daerah Gubeng" diulang tiap beberapa menit) sehingga
# tetap diproses karena masuk ember waktu berikutnya.
_FINGERPRINT_WINDOW_S = 10


def dedup_key(message_id: str, *, phone: str = "", message: str = "") -> str:
    """Kunci dedup: id asli bila ada, sidik jari isi bila id-nya sintetis."""
    mid = str(message_id or "").strip()
    if mid and not _SYNTHETIC_ID_RE.match(mid):
        return mid
    bucket = int(time.time() // _FINGERPRINT_WINDOW_S)
    raw = f"{phone}|{(message or '').strip().lower()}|{bucket}"
    return "fp_" + hashlib.sha1(raw.encode("utf-8")).hexdigest()


def is_duplicate(message_id: str, *, phone: str = "", message: str = "") -> bool:
    now = time.time()
    for mid in [m for m, ts in _seen.items() if now - ts > _DEDUP_TTL_S]:
        _seen.pop(mid, None)
    key = dedup_key(message_id, phone=phone, message=message)
    if key in _seen:
        return True
    _seen[key] = now
    return False


@dataclass
class InboundResult:
    handled: bool
    reason: str
    ai_ok: bool = False
    provider: str = ""
    context_source: str = "none"
    catalog_hits: int = 0


async def find_agent(db: AsyncSession, *, device_id: str = "", token: str = "") -> User | None:
    """Cari agent by device (Kirimi) atau token (Fonnte); fallback agent pertama.

    Fallback SENGAJA ada: webhook uji / device yang belum terdaftar tetap bisa
    diproses supaya masalahnya terlihat di terminal, bukan hilang diam-diam.
    """
    result = await db.execute(select(User).where(User.status == 1, User.privilege == "agent"))
    agents = list(result.scalars())

    if device_id:
        target = device_id.strip().lower()
        for a in agents:
            if (a.kirimi_device_id or "").strip().lower() == target:
                return a
    if token:
        target = token.strip()
        for a in agents:
            if (getattr(a, "fonnte_token", "") or "").strip() == target:
                return a

    for a in agents:
        if (a.kirimi_device_id or "").strip():
            return a
    return agents[0] if agents else None


async def load_history(db: AsyncSession, session_id: int, limit: int = 60) -> list[dict]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.chatSessionId == session_id)
        .order_by(ChatMessage.id.desc())
        .limit(limit)
    )
    rows = list(result.scalars())
    rows.reverse()
    return [{"role": r.role, "message": r.message} for r in rows]


async def get_or_create_session(db: AsyncSession, phone: str, name: str, source: str) -> ChatSession:
    result = await db.execute(select(ChatSession).where(ChatSession.normalizedPhone == phone))
    session = result.scalars().first()
    if session:
        session.lastMessageAt = datetime.utcnow()
        session.updatedAt = datetime.utcnow()
        return session

    session = ChatSession(
        name=name, normalizedName=name.strip().lower(),
        phone=phone, normalizedPhone=phone, source=source,
        lastMessageAt=datetime.utcnow(),
    )
    db.add(session)
    await db.flush()
    return session


async def process_inbound(
    db: AsyncSession,
    *,
    terminal: str,
    sender: str,
    name: str,
    message: str,
    message_id: str,
    device_id: str = "",
    token: str = "",
    is_mirrored: bool = False,
) -> InboundResult:
    """Alur lengkap satu pesan masuk. Dipakai Kirimi DAN Fonnte.

    `is_mirrored=True` berarti permintaan ini SALINAN dari Node.js (header
    `X-Mirrored-From`), bukan webhook langsung dari Kirimi.

    ⚠️ SALINAN TIDAK PERNAH MEMBALAS — apa pun nilai PYTHON_AI_REPLY_ENABLED.
    Kalau salinan ikut membalas, customer menerima DUA pesan: satu dari
    Node.js (yang menerima webhook aslinya) dan satu dari Python. Guard ini
    yang membuat mode "mirror untuk observasi" dan mode "Python membalas"
    tidak bisa saling bertabrakan.
    """
    if is_duplicate(message_id, phone=sender, message=message):
        return InboundResult(handled=False, reason="Duplikat, diabaikan")

    if not sender or not message:
        return InboundResult(handled=False, reason="Payload tidak lengkap")

    agent = await find_agent(db, device_id=device_id, token=token)
    if agent is None:
        logger.warning("[%s] tidak ada agent aktif — pesan tidak diproses", terminal)
        return InboundResult(handled=False, reason="Tidak ada agent aktif")

    timestamp = datetime.utcnow().isoformat() + "Z"
    channel = f"{terminal.lower()}_whatsapp_python"
    session = await get_or_create_session(db, sender, name, channel)
    history = await load_history(db, session.id)

    # ── Gerbang masuk (sama seperti Node.js) ────────────────────────────────
    if not (has_property_keyword(message) or is_property_context_continuation(message, history)):
        terminal_logger.log_incoming_skipped(
            terminal=terminal,
            agent_name=agent.name, agent_phone=agent.phone, agent_user_id=agent.user_id,
            customer_phone=sender, customer_name=name,
            timestamp=timestamp, message=message, stored=False,
        )
        return InboundResult(handled=True, reason="Bukan query properti — tidak disimpan")

    db.add(ChatMessage(
        chatSessionId=session.id, user_id=agent.user_id, customer_phone=sender,
        role="customer", message=message, channel=channel,
        metadata_=json.dumps({
            "source": "python_phase_receive_only",
            "message_id": message_id, "device_id": device_id,
        }),
    ))
    await db.commit()

    ai = await generate_whatsapp_reply(
        message, agent_name=agent.name, agent_user_id=agent.user_id or "",
        history=history, customer_name=name,
    )

    # ── KIRIM BALASAN (M105) ────────────────────────────────────────────────
    sent = False
    send_status: str | None = None

    if not ai.ok:
        send_status = f"⚠️  Balasan gagal disusun: {ai.error}"
    elif is_mirrored:
        # Salinan dari Node.js — Node.js yang membalas. Lihat docstring.
        send_status = "👁️  Salinan dari Node.js (observasi) — Node.js yang membalas"
    elif not get_settings().python_reply_enabled:
        send_status = "⏸️  TIDAK dikirim (PYTHON_AI_REPLY_ENABLED=false)"
    else:
        try:
            await kirimi_service.send_message(sender, ai.reply, device_id or agent.kirimi_device_id or "")
            sent = True
            # Balasan AI disimpan HANYA bila benar-benar terkirim — kalau
            # tidak, riwayat akan memuat pesan yang customer tidak pernah
            # terima, dan giliran berikutnya AI menyangka sudah menjawab.
            db.add(ChatMessage(
                chatSessionId=session.id, user_id=agent.user_id, customer_phone=sender,
                role="ai", message=ai.reply, channel=channel, ai_responder=ai.provider,
                metadata_=json.dumps({"source": "python_reply", "context": ai.context_source}),
            ))
            await db.commit()
        except KirimiSendError as exc:
            send_status = f"❌ Gagal: {exc}"
            logger.error("[%s] gagal mengirim balasan: %s", terminal, exc)
        except Exception as exc:  # noqa: BLE001
            send_status = f"❌ Gagal (tak terduga): {exc}"
            logger.error("[%s] error tak terduga saat mengirim: %s", terminal, exc)

    terminal_logger.log_incoming_replied(
        terminal=terminal,
        agent_name=agent.name, agent_phone=agent.phone, agent_user_id=agent.user_id,
        customer_phone=sender, customer_name=name,
        timestamp=timestamp, message=message,
        context_source=ai.context_source, ai_provider=ai.provider or "-",
        reply=ai.reply if ai.ok else f"(gagal menyusun balasan: {ai.error})",
        sent=sent,
        send_status=send_status,  # None saat terkirim → label "✅ Terkirim"
    )

    return InboundResult(
        handled=True,
        reason="Disimpan & dibalas" if sent else "Disimpan; balasan TIDAK dikirim",
        ai_ok=ai.ok, provider=ai.provider,
        context_source=ai.context_source, catalog_hits=ai.catalog_hits,
    )


__all__ = ["process_inbound", "InboundResult", "is_duplicate", "find_agent"]

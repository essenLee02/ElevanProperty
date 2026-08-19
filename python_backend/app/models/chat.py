"""Model SQLAlchemy untuk chat WhatsApp (M98) — memetakan tabel yang SUDAH ADA.

TIDAK ADA DDL DARI SISI PYTHON (kebijakan sama dengan master.py — Node.js
tetap pemilik skema). Dipakai HANYA oleh app/routers/kirimi_webhook.py untuk
menyimpan pesan masuk; TIDAK menulis balasan AI (fase ini sengaja hanya
menerima + menyimpan, lihat docstring router).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.master import Base


class User(Base):
    """Agent WhatsApp — hanya kolom yang dibutuhkan untuk lookup device Kirimi."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    privilege: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ai_primary: Mapped[str | None] = mapped_column(String(20), nullable=True)
    kirimi_device_id: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)

    __table_args__ = (Index("idx_users_kirimi_device", "kirimi_device_id"),)


class ChatSession(Base):
    """Satu percakapan per (nomor, agent) — port `models/ChatSession.js`."""

    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalizedName: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(255), nullable=False)
    normalizedPhone: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    normalizedLocation: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    source: Mapped[str] = mapped_column(String(255), nullable=False, default="website_chatbot")
    lastMessageAt: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (Index("idx_chatsession_phone", "normalizedPhone"),)


class ChatMessage(Base):
    """Satu baris pesan (customer ATAU ai) — port `models/ChatMessage.js`.

    ⚠️ Fase ini (M98) HANYA menulis role='customer'. Baris role='ai' tetap
    HANYA ditulis oleh Node.js (satu-satunya yang benar-benar memanggil
    provider AI dan mengirim balasan) — lihat docstring router.
    """

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chatSessionId: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)
    customer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    ai_responder: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[str] = mapped_column(String(50), nullable=False, default="website_chatbot")
    metadata_: Mapped[str | None] = mapped_column("metadata", Text, nullable=True, default=None)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (Index("idx_chatmessage_session", "chatSessionId"),)

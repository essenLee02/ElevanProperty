"""app/routers/chatbot_private.py — HTTP untuk chatbot_private_controller (M113).

SENGAJA TIPIS: router hanya membaca body, memanggil controller, lalu
mengembalikan (status, body) apa adanya. Tidak ada keputusan bisnis di sini —
sama seperti `routes/index.js` di Node yang hanya memetakan path ke handler.

Path dijaga identik dengan Express supaya frontend tidak perlu tahu backend
mana yang melayaninya:
    GET  /api/chatbot/private-status
    POST /api/chatbot/private-message
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers import chatbot_private_controller as controller
from app.db import get_db

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


class PrivateMessageRequest(BaseModel):
    """Body POST /api/chatbot/private-message — nama field sama dengan Node."""

    name: str = Field(default="")
    phone: str = Field(default="")
    message: str = Field(default="")
    location: str = Field(default="")


@router.get("/private-status")
async def private_status() -> JSONResponse:
    return JSONResponse(status_code=200, content=controller.private_agent_status())


@router.post("/private-message")
async def private_message(
    payload: PrivateMessageRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    status, body = await controller.send_private_message(
        db,
        name=payload.name,
        phone=payload.phone,
        message=payload.message,
        location=payload.location,
    )
    return JSONResponse(status_code=status, content=body)

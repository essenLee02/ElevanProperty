"""Provider AI: OpenAI Chat Completions (M101) — provider primary saat ini.

Pola mengikuti `huggingface_service.py` (M95) persis: error DIKLASIFIKASI,
tidak pernah melempar exception httpx mentah ke pemanggil.

⛔ KEBIJAKAN BILLING: kuota habis → lempar error → sistem turun ke Private
Agent / balasan aman. TIDAK ADA auto-topup, tidak ada pemanggilan endpoint
billing apa pun.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_URL = "https://api.openai.com/v1/chat/completions"
_TIMEOUT_S = 90.0


class ChatGPTError(Exception):
    def __init__(self, message: str, *, status: int | None = None,
                 fallback_eligible: bool = False) -> None:
        super().__init__(message)
        self.status = status
        self.fallback_eligible = fallback_eligible
        self.provider = "chatgpt"


def _normalize_error(exc: httpx.HTTPStatusError) -> ChatGPTError:
    status = exc.response.status_code
    try:
        body = exc.response.json()
        api_msg = ((body.get("error") or {}).get("message")
                   if isinstance(body.get("error"), dict) else body.get("error")) or str(exc)
    except Exception:  # noqa: BLE001
        api_msg = exc.response.text[:300] or str(exc)

    if status == 401:
        return ChatGPTError(f"CHAT_GPT_API_KEY ditolak: {api_msg}", status=status,
                            fallback_eligible=False)
    if status == 429:
        return ChatGPTError(f"Kuota/rate limit OpenAI: {api_msg}", status=status,
                            fallback_eligible=True)
    if status == 400 and "model" in str(api_msg).lower():
        return ChatGPTError(f"Model tidak tersedia: {api_msg}", status=status,
                            fallback_eligible=True)
    return ChatGPTError(f"OpenAI API error ({status}): {api_msg}", status=status,
                        fallback_eligible=True)


def is_available() -> bool:
    return bool((get_settings().CHAT_GPT_API_KEY or "").strip())


async def generate_reply(system_prompt: str, user_prompt: str, *,
                         temperature: float = 0.8, max_tokens: int | None = None) -> str:
    """Balasan WhatsApp dari OpenAI.

    `temperature=0.8` SENGAJA lebih tinggi dari default analitik (0.2): tujuan
    di sini adalah balasan yang terdengar manusiawi dan bervariasi antar
    giliran. Suhu rendah justru menghasilkan kalimat pembuka yang nyaris
    identik setiap kali — persis "rasa chatbot" yang sedang diperbaiki.
    """
    settings = get_settings()
    api_key = (settings.CHAT_GPT_API_KEY or "").strip()
    if not api_key:
        raise ChatGPTError("CHAT_GPT_API_KEY kosong di .env", fallback_eligible=False)

    payload: dict[str, Any] = {
        "model": settings.CHAT_GPT_MODEL or "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": int(max_tokens or 700),
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
        try:
            resp = await client.post(
                _URL, json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise _normalize_error(exc) from exc
        except httpx.RequestError as exc:
            raise ChatGPTError(f"Gagal terhubung ke OpenAI: {exc}", fallback_eligible=True) from exc

    data = resp.json()
    choice = (data.get("choices") or [{}])[0]
    text = ((choice.get("message") or {}).get("content") or "").strip()
    if not text:
        raise ChatGPTError(f"Balasan kosong (finish_reason={choice.get('finish_reason')})",
                           fallback_eligible=True)
    return text


__all__ = ["generate_reply", "is_available", "ChatGPTError"]

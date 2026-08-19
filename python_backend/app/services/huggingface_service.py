"""Provider AI: Hugging Face Inference Router — port dari
`backend/services/huggingfaceService.js` (M95).

⚠️ KEPUTUSAN PENTING: BUKAN vLLM self-hosted, meski itu yang diminta di
spesifikasi asli (`pip install vllm && vllm serve "Qwen/Qwen3.8-27B"`).
`vllm serve` menjalankan model 20–27B parameter SECARA LOKAL, butuh GPU besar
(biasanya ≥24GB VRAM) — dicek `nvidia-smi` di mesin ini sebelum menulis modul
ini: **tidak ada GPU NVIDIA terdeteksi**. Kode yang mengasumsikan vLLM lokal
akan gagal total di mesin dev ini, dan kemungkinan besar juga di server
produksi yang sama.

HF Inference Router (https://router.huggingface.co/v1) adalah endpoint
HOSTED, OpenAI-compatible, tanpa GPU lokal — model YANG SAMA (gpt-oss-20b,
DeepSeek-V4-Flash) tetap terpakai, hanya jalur aksesnya disesuaikan agar
benar-benar bisa jalan.

⚠️ VERIFIKASI LANGSUNG KE API (14 Agu 2026, konsisten dengan sisi Node.js):
HF_TOKEN yang tersedia mengembalikan HTTP 403 "This authentication method
does not have sufficient permissions to call Inference Providers" — token
SAH tapi belum punya scope "Inference Providers". Perbaikannya: buka
huggingface.co/settings/tokens → edit/ buat token baru → centang "Make calls
to Inference Providers" → update HF_TOKEN.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings


class HuggingFaceProviderError(Exception):
    """Error terklasifikasi dari HF Router.

    Atribut `fallback_eligible` menandai boleh/tidaknya sistem mencoba
    provider lain (sesuai aturan proyek: SETIAP primary gagal → LANGSUNG ke
    Private Agent, TIDAK PERNAH cascade ke provider eksternal lain).
    """

    def __init__(self, message: str, *, status: int | None = None,
                 fallback_eligible: bool = False, config_error: bool = False) -> None:
        super().__init__(message)
        self.status = status
        self.fallback_eligible = fallback_eligible
        self.config_error = config_error


def _normalize_error(exc: httpx.HTTPStatusError) -> HuggingFaceProviderError:
    status = exc.response.status_code
    try:
        body = exc.response.json()
        api_message = (
            (body.get("error") or {}).get("message")
            if isinstance(body.get("error"), dict)
            else body.get("error") or body.get("message")
        ) or str(exc)
    except Exception:  # noqa: BLE001
        api_message = exc.response.text or str(exc)

    if status == 401:
        return HuggingFaceProviderError(
            "Hugging Face menolak HF_TOKEN. Ganti HF_TOKEN di backend/.env, lalu restart.",
            status=status, fallback_eligible=False,
        )

    # 403 BUKAN token invalid — token sah tapi tanpa scope "Inference
    # Providers". Dipisah dari 401 supaya pesannya BENAR: mengganti token
    # tidak menyelesaikan 403; yang perlu adalah mengaktifkan scope-nya.
    if status == 403:
        print(
            "\n[HUGGINGFACE] TOKEN SAH TAPI TANPA IZIN INFERENCE PROVIDERS\n"
            f"  Pesan API : {api_message}\n"
            "  PERBAIKI  : huggingface.co/settings/tokens -> edit token -> centang\n"
            "  'Make calls to Inference Providers' -> update HF_TOKEN -> restart.\n"
        )
        return HuggingFaceProviderError(
            f"Hugging Face: token tanpa izin Inference Providers: {api_message}",
            status=status, fallback_eligible=True, config_error=True,
        )

    if status in (402, 429):
        return HuggingFaceProviderError(
            f"Hugging Face rate limit/kuota: {api_message}",
            status=status, fallback_eligible=True,
        )

    if status == 404 or "not found" in api_message.lower() or "no inference provider" in api_message.lower():
        print(
            "\n[HUGGINGFACE] MODEL TIDAK TERSEDIA DI ROUTER\n"
            f"  Pesan API : {api_message}\n"
            "  PERBAIKI  : model WAJIB sufiks ':provider' (mis. 'openai/gpt-oss-20b:groq').\n"
        )
        return HuggingFaceProviderError(
            f"Hugging Face model tidak tersedia: {api_message}",
            status=status, fallback_eligible=True, config_error=True,
        )

    return HuggingFaceProviderError(
        f"Hugging Face API error ({status}): {api_message}",
        status=status, fallback_eligible=False,
    )


async def call_huggingface_chat(
    user_prompt: str,
    *,
    system_prompt: str = "You are a helpful assistant.",
    model: str | None = None,
    max_tokens: int | None = None,
    temperature: float | None = None,
    top_p: float | None = None,
) -> str:
    """Panggil HF Router /chat/completions. Melempar `HuggingFaceProviderError`
    yang sudah terklasifikasi bila gagal — TIDAK PERNAH exception mentah httpx.
    """
    settings = get_settings()
    api_key = (settings.HF_TOKEN or "").strip()
    if not api_key:
        raise HuggingFaceProviderError(
            "HF_TOKEN is missing in backend/.env", fallback_eligible=False,
        )

    payload: dict[str, Any] = {
        "model": model or settings.HF_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": int(max_tokens or settings.HF_MAX_TOKENS),
        "temperature": float(temperature if temperature is not None else settings.HF_TEMPERATURE),
        "top_p": float(top_p if top_p is not None else settings.HF_TOP_P),
        "stream": False,
    }

    url = f"{settings.HF_BASE_URL.rstrip('/')}/chat/completions"

    async with httpx.AsyncClient(timeout=90.0) as client:
        try:
            resp = await client.post(
                url, json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise _normalize_error(exc) from exc
        except httpx.RequestError as exc:
            raise HuggingFaceProviderError(
                f"Hugging Face: gagal terhubung ({exc.__class__.__name__}): {exc}",
                fallback_eligible=True,
            ) from exc

    data = resp.json()
    choice = (data.get("choices") or [{}])[0]
    text = ((choice.get("message") or {}).get("content") or "").strip()

    if not text:
        finish = choice.get("finish_reason", "unknown")
        if finish == "length":
            raise HuggingFaceProviderError(
                f"Hugging Face kehabisan token (finish_reason=length, "
                f"max_tokens={payload['max_tokens']}). Naikkan HF_MAX_TOKENS.",
                fallback_eligible=True,
            )
        raise HuggingFaceProviderError(
            f"Hugging Face response kosong (finish_reason={finish}).", fallback_eligible=True,
        )

    return text


def check_huggingface_config() -> dict[str, Any]:
    settings = get_settings()
    return {
        "provider": "huggingface",
        "has_api_key": bool((settings.HF_TOKEN or "").strip()),
        "model": settings.HF_MODEL,
        "base_url": settings.HF_BASE_URL,
        "max_tokens": settings.HF_MAX_TOKENS,
        "temperature": settings.HF_TEMPERATURE,
        "top_p": settings.HF_TOP_P,
    }


__all__ = ["call_huggingface_chat", "check_huggingface_config", "HuggingFaceProviderError"]

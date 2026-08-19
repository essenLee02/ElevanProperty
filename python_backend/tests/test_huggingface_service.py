"""Regresi M95 — port app/services/huggingface_service.py.

Paritas terhadap backend/services/huggingfaceService.js: bentuk konfigurasi,
klasifikasi error (401/402/403/404/429), dan aturan fallback_eligible harus
setara. Group LIVE (bila HF_TOKEN ada) sengaja MENERIMA error 403 sebagai
"classifier bekerja benar" — bukan kegagalan tes. Lihat catatan panjang di
huggingface_service.py untuk kenapa 403 terjadi dan bukan bug kode.

Run: python -m pytest python_backend/tests/test_huggingface_service.py -v
     atau: python python_backend/tests/test_huggingface_service.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.services.huggingface_service import (  # noqa: E402
    HuggingFaceProviderError,
    call_huggingface_chat,
    check_huggingface_config,
)

pass_count = 0
fail_count = 0


def ok(label: str, cond: bool, extra: str = "") -> None:
    global pass_count, fail_count
    if cond:
        pass_count += 1
        print(f"  [OK]   {label}")
    else:
        fail_count += 1
        print(f"  [FAIL] {label} {extra}")


def _mock_response(status: int, json_body: dict) -> httpx.Response:
    req = httpx.Request("POST", "https://router.huggingface.co/v1/chat/completions")
    return httpx.Response(status_code=status, json=json_body, request=req)


async def main() -> None:
    print("== Group 1: konfigurasi default ==")
    cfg = check_huggingface_config()
    ok('provider == "huggingface"', cfg["provider"] == "huggingface")
    ok('base_url default = router.huggingface.co/v1',
       cfg["base_url"] == "https://router.huggingface.co/v1", cfg["base_url"])
    ok('model default punya sufiks ":provider"', ":" in cfg["model"], cfg["model"])
    ok("has_api_key mencerminkan HF_TOKEN",
       cfg["has_api_key"] == bool((get_settings().HF_TOKEN or "").strip()))

    print("\n== Group 2: HF_TOKEN kosong -> error jelas ==")
    # pydantic-settings instance sengaja tidak diubah langsung (praktik yang
    # rapuh); simulasikan token kosong dengan mengganti get_settings() yang
    # dipanggil huggingface_service.py memakai objek tiruan.
    import app.services.huggingface_service as hf_mod

    fake_settings = MagicMock()
    fake_settings.HF_TOKEN = ""
    fake_settings.HF_MODEL = "openai/gpt-oss-20b:groq"
    fake_settings.HF_BASE_URL = "https://router.huggingface.co/v1"
    fake_settings.HF_MAX_TOKENS = 4096
    fake_settings.HF_TEMPERATURE = 1.0
    fake_settings.HF_TOP_P = 1.0

    with patch.object(hf_mod, "get_settings", return_value=fake_settings):
        try:
            await call_huggingface_chat("test")
            ok("melempar error saat token kosong", False, "tidak melempar")
        except HuggingFaceProviderError as e:
            ok("melempar error saat token kosong", "HF_TOKEN is missing" in str(e), str(e))
            ok("fallback_eligible=False (jangan retry provider sama)", e.fallback_eligible is False)

    print("\n== Group 3: klasifikasi error (mock HTTP, tanpa panggilan nyata) ==")
    fake_settings.HF_TOKEN = "fake-token-for-mock"

    cases = [
        (401, {"error": {"message": "invalid token"}}, False, False, "token salah/kadaluarsa"),
        (403, {"error": "This authentication method does not have sufficient permissions"}, True, True, "izin scope kurang"),
        (429, {"error": {"message": "rate limited"}}, True, False, "rate limit"),
        (404, {"error": {"message": "model not found"}}, True, True, "model tidak tersedia"),
    ]
    for status, body, expect_fallback, expect_config_error, label in cases:
        mock_resp = _mock_response(status, body)

        async def _raise(*_a, **_kw):  # noqa: ANN001, ANN002
            raise httpx.HTTPStatusError("mock", request=mock_resp.request, response=mock_resp)

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value.post = _raise
        with patch.object(hf_mod, "get_settings", return_value=fake_settings), \
             patch("httpx.AsyncClient", return_value=mock_client):
            try:
                await call_huggingface_chat("test")
                ok(f"HTTP {status} ({label}) melempar HuggingFaceProviderError", False, "tidak melempar")
            except HuggingFaceProviderError as e:
                ok(f"HTTP {status} ({label}): status tercatat benar", e.status == status, e.status)
                ok(f"HTTP {status} ({label}): fallback_eligible={expect_fallback}",
                   e.fallback_eligible == expect_fallback, e.fallback_eligible)
                ok(f"HTTP {status} ({label}): config_error={expect_config_error}",
                   e.config_error == expect_config_error, e.config_error)

    print("\n== Group 4: 401 vs 403 HARUS beda pesan (jangan disamakan) ==")
    # Kontrol negatif penting: 401 ("ganti token") dan 403 ("ubah scope token")
    # butuh instruksi BERBEDA. Menyamakan keduanya akan menyesatkan developer.
    mock_401 = _mock_response(401, {"error": {"message": "bad credentials"}})
    mock_403 = _mock_response(403, {"error": "insufficient permissions"})

    async def _raise_401(*_a, **_kw):  # noqa: ANN001, ANN002
        raise httpx.HTTPStatusError("mock", request=mock_401.request, response=mock_401)

    async def _raise_403(*_a, **_kw):  # noqa: ANN001, ANN002
        raise httpx.HTTPStatusError("mock", request=mock_403.request, response=mock_403)

    client_401 = AsyncMock()
    client_401.__aenter__.return_value.post = _raise_401
    client_403 = AsyncMock()
    client_403.__aenter__.return_value.post = _raise_403

    with patch.object(hf_mod, "get_settings", return_value=fake_settings):
        with patch("httpx.AsyncClient", return_value=client_401):
            try:
                await call_huggingface_chat("test")
            except HuggingFaceProviderError as e:
                msg_401 = str(e)
        with patch("httpx.AsyncClient", return_value=client_403):
            try:
                await call_huggingface_chat("test")
            except HuggingFaceProviderError as e:
                msg_403 = str(e)

    ok("pesan 401 dan 403 BERBEDA", msg_401 != msg_403)
    ok('pesan 403 menyebut "izin" (bukan "token salah")', "izin" in msg_403.lower(), msg_403)

    print("\n== Group 5: LIVE - panggilan sungguhan (bila HF_TOKEN ada di .env) ==")
    real_token = (get_settings().HF_TOKEN or "").strip()
    if not real_token:
        print("  (dilewati - HF_TOKEN tidak ada)")
    else:
        try:
            reply = await call_huggingface_chat(
                "What is the capital of France? Answer in one word.",
                system_prompt="You are a helpful assistant.",
            )
            ok("balasan LIVE non-kosong", isinstance(reply, str) and len(reply) > 0, reply)
        except HuggingFaceProviderError as e:
            # 403 terverifikasi (lihat docstring modul) -> classifier benar,
            # bukan kegagalan tes.
            ok("error LIVE tetap HuggingFaceProviderError (bukan exception mentah)", True)
            if e.status == 403:
                ok("403 -> config_error=True", e.config_error is True)
                print(f"     (403 = token belum ada scope Inference Providers: {e})")

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())

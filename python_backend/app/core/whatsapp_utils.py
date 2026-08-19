"""Utilitas log WhatsApp — port `backend/utils/whatsappUtils.js` +
`backend/utils/secretRedactor.js` (M100).

⚠️ `redact_secrets()` ADALAH LAPISAN KEAMANAN, BUKAN KERAPIAN. Pesan customer
dan payload webhook rutin memuat teks salin-tempel; sekali ada API key ikut
terbawa, ia tersimpan permanen di log DAN berpeluang dikutip AI ke customer.
Karena itu `sanitize_log()` SELALU melewatkan teks lewat redaktor lebih dulu —
jangan pernah mencetak pesan mentah langsung ke terminal.

Diverifikasi setara dengan Node.js lewat `tests/parity/run_logutil_parity.py`.
"""

from __future__ import annotations

import re
from typing import Any

REDACTED = "[REDACTED]"

# Urutan MENENTUKAN hasil (aturan spesifik dulu, umum belakangan) — sama
# persis dengan array RULES di secretRedactor.js. Jangan diurut ulang.
_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"sk-ant-[A-Za-z0-9_-]{8,}"), "[REDACTED_ANTHROPIC_KEY]"),
    (re.compile(r"sk-proj-[A-Za-z0-9_-]{8,}"), "[REDACTED_CHAT_GPT_KEY]"),
    (re.compile(r"\bsk-[A-Za-z0-9]{20,}"), "[REDACTED_CHAT_GPT_KEY]"),
    (re.compile(r"apify_api_[A-Za-z0-9]{10,}"), "[REDACTED_APIFY_TOKEN]"),
    (re.compile(r"AIza[0-9A-Za-z_-]{20,}"), "[REDACTED_GOOGLE_KEY]"),
    (re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}"), "[REDACTED_SLACK_TOKEN]"),
    (re.compile(r"\b(x-api-key|api-key|apikey)\s*[:=]\s*[\"']?[A-Za-z0-9._-]{8,}[\"']?", re.IGNORECASE),
     r"\1: " + REDACTED),
    (re.compile(r"\b(authorization)\s*[:=]\s*[\"']?bearer\s+[A-Za-z0-9._-]{8,}[\"']?", re.IGNORECASE),
     r"\1: Bearer " + REDACTED),
    (re.compile(r"\bBearer\s+[A-Za-z0-9._-]{12,}"), "Bearer " + REDACTED),
    (re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}"), "[REDACTED_JWT]"),
    (re.compile(r"-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----"),
     "[REDACTED_PRIVATE_KEY]"),
    (re.compile(
        r"^([ \t]*[A-Za-z_][A-Za-z0-9_]*(?:API[_-]?KEY|APIKEY|_KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|PRIVATE_KEY|CLIENT_SECRET|ACCESS_TOKEN|REFRESH_TOKEN))[ \t]*=[ \t]*.+$",
        re.IGNORECASE | re.MULTILINE),
     r"\1=" + REDACTED),
    (re.compile(
        r"(\"(?:api[_-]?key|apikey|token|secret|password|access[_-]?token|refresh[_-]?token|private[_-]?key)\"\s*:\s*)\"[^\"]+\"",
        re.IGNORECASE),
     r'\1"' + REDACTED + '"'),
)

_ANSI_RE = re.compile(r"\x1B\[[0-9;]*[mGKHFABCDJsulnhr]")
_WS_RE = re.compile(r"[\r\n\t]")


def redact_secrets(value: Any) -> Any:
    """Sensor rahasia dalam string. Non-string dikembalikan apa adanya."""
    if value is None:
        return value
    if not isinstance(value, str):
        return value
    out = value
    for pattern, replacement in _RULES:
        out = pattern.sub(replacement, out)
    return out


def sanitize_log(text: Any, max_len: int = 400) -> str:
    """Redaksi rahasia → buang ANSI → ratakan newline → potong `max_len`.

    Meratakan newline BUKAN kosmetik: tanpa itu, pesan customer yang memuat
    baris baru bisa memalsukan baris log lain (log injection).
    """
    s = redact_secrets(str(text)) if text is not None else ""
    if not isinstance(s, str):
        s = str(s)
    s = _ANSI_RE.sub("", s)
    s = _WS_RE.sub(" ", s)
    s = s.replace("\x00", "")
    return s[:max_len]


def mask_phone(phone: Any) -> str:
    """`628123456789` → `628***6789`. ≤4 karakter disensor total."""
    s = str(phone) if phone is not None else ""
    if len(s) <= 4:
        return "****"
    return s[:3] + "***" + s[-4:]


def mask_name(name: Any) -> str:
    """`Nigel Tjandra` → `Nigel T.` (kata KEDUA, bukan kata terakhir)."""
    s = sanitize_log(str(name) if name else "Customer", 50).strip()
    if not s:
        s = "Customer"
    parts = [p for p in re.split(r"\s+", s) if p]
    if len(parts) <= 1:
        return s
    return f"{parts[0]} {parts[1][:1].upper()}."


__all__ = ["redact_secrets", "sanitize_log", "mask_phone", "mask_name"]

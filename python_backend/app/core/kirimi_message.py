"""Parsing payload webhook Kirimi — port murni (tanpa DB/IO) dari BAGIAN 1
`backend/controllers/kirimiChatController.js` (M98, 15 Agu 2026).

⚠️ HANYA PARSING. Tidak memanggil AI, tidak mengirim balasan, tidak menyentuh
provider apa pun — lihat app/routers/kirimi_webhook.py untuk kenapa (webhook
Python fase ini SENGAJA hanya menerima + menyimpan, Node.js tetap satu-
satunya yang membalas customer, sesuai keputusan eksplisit 15 Agu 2026:
migrasi AI penuh terlalu besar/berisiko untuk satu sesi — lihat
MIGRATION_PLAN.md).

Diverifikasi setara dengan Node.js lewat
`tests/parity/run_kirimi_parity.py`.
"""

from __future__ import annotations

import re
import time
from typing import Any


def normalize_phone(phone: str | None) -> str:
    """+62 821-3311-936 → 628213311936 (identik dengan normalizePhone() Node.js)."""
    s = str(phone or "")
    s = s.replace("+62", "62")
    s = re.sub(r"^0", "62", s)
    s = re.sub(r"[\s\-()]", "", s)
    return s


def _normalize_phone_from_jid(value: Any) -> str:
    raw = str(value or "").split("@")[0]
    return normalize_phone(raw)


def _pick(obj: dict, paths: list[str]) -> Any:
    """Ambil nilai pertama yang ada dari beberapa kemungkinan path dot-notation."""
    for path in paths:
        current: Any = obj
        for key in path.split("."):
            if isinstance(current, dict) and key in current and current[key] is not None and current[key] != "":
                current = current[key]
            else:
                current = None
                break
        if current is not None and current != "":
            return current
    return ""


def extract_message(body: dict | None) -> dict[str, Any]:
    """Ekstrak field penting dari payload webhook — port `extractMessage()`."""
    body = body or {}

    from_me_raw = _pick(body, ["fromMe", "data.fromMe", "key.fromMe", "message.fromMe"])
    from_me = from_me_raw is True or str(from_me_raw).lower() == "true"

    is_group_flag = _pick(body, ["isGroup", "is_group", "data.isGroup", "data.is_group"])
    if is_group_flag is True or str(is_group_flag).lower() == "true":
        is_group = True
    else:
        jid = _pick(body, ["from", "sender", "phone", "data.from", "data.sender", "key.remoteJid", "remoteJid"])
        is_group = "@g.us" in str(jid or "").lower()

    return {
        "sender": _normalize_phone_from_jid(_pick(body, [
            "from", "sender", "phone", "pengirim", "sender_number", "senderNumber",
            "data.from", "data.sender", "data.phone", "key.remoteJid", "remoteJid",
        ])),
        "name": _pick(body, [
            "pushName", "pushname", "senderName", "name", "notify",
            "data.pushName", "data.name", "contact.name",
        ]) or "Customer",
        "message": str(_pick(body, [
            "message", "text", "body", "pesan", "content", "caption",
            "data.message", "data.text", "data.body", "message.text", "message.body",
        ]) or "").strip(),
        "message_id": _pick(body, [
            "messageId", "message_id", "id", "clientMsgId", "key.id",
            "data.messageId", "data.id",
        ]) or f"kirimi_{int(time.time() * 1000)}",
        "device_id": str(_pick(body, [
            "device_id", "deviceId", "device", "data.device_id", "data.deviceId",
        ]) or "").strip(),
        "from_me": from_me,
        "is_group": is_group,
    }


def detect_event_type(body: dict | None) -> str:
    """'incoming' | 'send' | 'message_status' | 'unknown' — port `detectEventType()`."""
    if not isinstance(body, dict):
        return "unknown"

    evt = str(body.get("type") or body.get("event") or body.get("event_type") or "").lower()

    if evt.startswith("connection"):
        return "message_status"
    if any(tok in evt for tok in ("sent", "ack", "delivered", "read", "failed", "status")):
        return "send"
    if evt == "message" or evt == "message.received" or "received" in evt or "incoming" in evt:
        return "incoming"

    from_me_raw = _pick(body, ["fromMe", "data.fromMe", "key.fromMe", "message.fromMe"])
    if from_me_raw is True or str(from_me_raw).lower() == "true":
        return "send"

    extracted = extract_message(body)
    if extracted["message"] and extracted["sender"]:
        return "incoming"

    return "unknown"

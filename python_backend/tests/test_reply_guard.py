"""Regresi M105 — pengaman BALASAN GANDA & kirim WhatsApp.

⚠️ TES KESELAMATAN CUSTOMER, bukan tes fitur.

Sejak M105, python_backend BISA benar-benar mengirim WhatsApp. Ada dua jalur
yang bisa membuat customer menerima DUA balasan untuk satu pesan:

  (a) Node.js menerima webhook DAN menyalinnya ke Python (M104). Kalau salinan
      itu ikut dibalas Python, customer dapat 2 pesan.
  (b) PYTHON_AI_REPLY_ENABLED menyala padahal Node.js juga masih melayani.

Guard (a) ada di kode dan diuji di sini: permintaan bertanda
`X-Mirrored-From: nodejs` TIDAK PERNAH dibalas, APA PUN nilai flag.
Guard (b) tidak bisa dipaksakan kode (dua proses terpisah) — itu aturan
operasional, didokumentasikan di .env dan V8 §5 M105.

Run: python tests/test_reply_guard.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import inbound_message_service as ims  # noqa: E402
from app.services.kirimi_service import KirimiSendError, _looks_failed, append_sent_via_tag  # noqa: E402

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


class _FakeAgent:
    user_id = "LFGKT49002"
    name = "LEO FELIX"
    phone = "6288888874"
    kirimi_device_id = "D-3OCA6"
    status = 1
    privilege = "agent"


class _FakeSession:
    id = 999


class _FakeDB:
    """DB tiruan — mencatat baris yang ditambahkan tanpa menyentuh MySQL."""

    def __init__(self) -> None:
        self.added: list = []
        self.commits = 0

    def add(self, row):  # noqa: ANN001
        self.added.append(row)

    async def commit(self):
        self.commits += 1

    async def flush(self):
        return None


async def _run(*, is_mirrored: bool, reply_enabled: bool, message: str = "Saya mau sewa rumah di Malang"):
    """Jalankan process_inbound dengan semua I/O eksternal di-mock."""
    db = _FakeDB()
    sent_calls: list = []

    async def fake_send(phone, msg, device, **kw):  # noqa: ANN001
        sent_calls.append({"phone": phone, "message": msg, "device": device})
        return {"success": True}

    class FakeAI:
        ok = True
        reply = "Halo! Ada beberapa pilihan di Malang."
        provider = "chatgpt"
        context_source = "rag_catalog"
        catalog_hits = 2
        error = ""

    class FakeSettings:
        python_reply_enabled = reply_enabled

        def terminal_active(self, *_a):
            return False  # matikan cetakan blok agar output tes bersih

    with patch.object(ims, "find_agent", AsyncMock(return_value=_FakeAgent())), \
         patch.object(ims, "get_or_create_session", AsyncMock(return_value=_FakeSession())), \
         patch.object(ims, "load_history", AsyncMock(return_value=[])), \
         patch.object(ims, "generate_whatsapp_reply", AsyncMock(return_value=FakeAI())), \
         patch.object(ims, "get_settings", lambda: FakeSettings()), \
         patch.object(ims.kirimi_service, "send_message", fake_send), \
         patch.object(ims.terminal_logger, "log_incoming_replied", lambda **kw: None), \
         patch.object(ims.terminal_logger, "log_incoming_skipped", lambda **kw: None):
        result = await ims.process_inbound(
            db, terminal="KIRIMI", sender="628123456789", name="Nigel",
            message=message, message_id=f"guard-{is_mirrored}-{reply_enabled}-{message[:8]}",
            device_id="D-3OCA6", is_mirrored=is_mirrored,
        )
    return result, sent_calls, db


async def main() -> None:
    print("== Group 1: SALINAN dari Node.js TIDAK PERNAH membalas ==")
    r, sent, _ = await _run(is_mirrored=True, reply_enabled=True)
    ok("mirrored=True + reply_enabled=True → TIDAK mengirim", len(sent) == 0,
       f"{len(sent)} kiriman")
    ok("mirrored=True → tetap diproses (handled)", r.handled is True)

    r, sent, _ = await _run(is_mirrored=True, reply_enabled=False)
    ok("mirrored=True + reply_enabled=False → TIDAK mengirim", len(sent) == 0)

    print("\n== Group 2: flag PYTHON_AI_REPLY_ENABLED dihormati ==")
    r, sent, _ = await _run(is_mirrored=False, reply_enabled=False)
    ok("langsung + reply_enabled=False → TIDAK mengirim", len(sent) == 0)

    print("\n== Group 3: KONTROL POSITIF — memang bisa mengirim ==")
    r, sent, db = await _run(is_mirrored=False, reply_enabled=True)
    ok("langsung + reply_enabled=True → MENGIRIM 1 pesan", len(sent) == 1, f"{len(sent)} kiriman")
    if sent:
        ok("nomor tujuan benar", sent[0]["phone"] == "628123456789", sent[0]["phone"])
        ok("device_id ikut terkirim", sent[0]["device"] == "D-3OCA6")
    ok("balasan AI disimpan ke DB saat terkirim",
       any(getattr(r_, "role", "") == "ai" for r_ in db.added))

    print("\n== Group 4: gagal kirim TIDAK menyimpan balasan ==")
    db = _FakeDB()

    async def failing_send(*_a, **_kw):
        raise KirimiSendError("device disconnect")

    class FakeAI2:
        ok = True; reply = "halo"; provider = "chatgpt"
        context_source = "none"; catalog_hits = 0; error = ""

    class FakeSettings2:
        python_reply_enabled = True
        def terminal_active(self, *_a): return False

    with patch.object(ims, "find_agent", AsyncMock(return_value=_FakeAgent())), \
         patch.object(ims, "get_or_create_session", AsyncMock(return_value=_FakeSession())), \
         patch.object(ims, "load_history", AsyncMock(return_value=[])), \
         patch.object(ims, "generate_whatsapp_reply", AsyncMock(return_value=FakeAI2())), \
         patch.object(ims, "get_settings", lambda: FakeSettings2()), \
         patch.object(ims.kirimi_service, "send_message", failing_send), \
         patch.object(ims.terminal_logger, "log_incoming_replied", lambda **kw: None), \
         patch.object(ims.terminal_logger, "log_incoming_skipped", lambda **kw: None):
        res = await ims.process_inbound(
            db, terminal="KIRIMI", sender="628123456789", name="N",
            message="Saya mau sewa rumah di Malang", message_id="guard-failsend",
            device_id="D-3OCA6", is_mirrored=False,
        )
    ok("kirim gagal → TIDAK melempar ke pemanggil", res.handled is True)
    ok("kirim gagal → balasan AI TIDAK disimpan (riwayat tetap jujur)",
       not any(getattr(x, "role", "") == "ai" for x in db.added))

    print("\n== Group 5: deteksi GAGAL-PALSU dari respons Kirimi ==")
    ok("success=false → gagal", _looks_failed({"success": False, "message": "x"}) is not None)
    ok('status="failed" → gagal', _looks_failed({"status": "failed"}) is not None)
    ok('message berisi "gagal" → gagal', _looks_failed({"message": "gagal kirim"}) is not None)
    ok("error terisi → gagal", _looks_failed({"error": "device disconnect"}) is not None)
    ok("KONTROL: respons sukses → None", _looks_failed({"success": True, "status": "sent"}) is None)
    ok("KONTROL: respons kosong → None", _looks_failed({}) is None)

    print("\n== Group 6: footer 'Sent via' ==")
    # ⚠️ Diuji dengan tag yang DIPAKSA lewat settings tiruan, bukan bergantung
    # pada isi .env — kalau AI_PRIMARY_TAG kebetulan kosong, asersi jadi
    # hijau tanpa arti (versi pertama tes ini sempat begitu).
    from app.services import kirimi_service as ks

    class TagSettings:
        AI_PRIMARY_TAG = "propmatches.netlify.app"

    with patch.object(ks, "get_settings", lambda: TagSettings()):
        tagged = ks.append_sent_via_tag("halo")
        ok("footer ditambahkan", tagged.endswith("> Sent via propmatches.netlify.app"), tagged)
        ok("isi pesan asli tetap utuh", tagged.startswith("halo"))
        ok("tidak dobel bila sudah ada", ks.append_sent_via_tag(tagged) == tagged)

    class NoTagSettings:
        AI_PRIMARY_TAG = ""

    with patch.object(ks, "get_settings", lambda: NoTagSettings()):
        ok("KONTROL: tag kosong → pesan TIDAK diubah",
           ks.append_sent_via_tag("halo") == "halo")

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())

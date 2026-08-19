"""Regresi M113 — controller chat website (port chatbotPrivateController.js).

Menguji lapisan CONTROLLER, bukan HTTP: `send_private_message()` mengembalikan
`(status, body)` sebagai nilai, jadi seluruh alur bisa diuji tanpa server.

DUA HAL YANG DIJAGA DI SINI:
  1. KONTRAK BALASAN identik dengan Node (`success`, `reply`, `sessionId`,
     `source`, `controller`, `fallbackUsed`, `directPrivateEndpoint`,
     `exactMatches`, `rumah123Listings`, `alternatives`). Frontend Vue yang
     sama harus bisa menunjuk ke :5055 atau :5056 tanpa percabangan.
  2. `role` yang DISIMPAN = 'customer'/'ai'. Kalau controller menulis
     'user'/'assistant', riwayatnya tetap tersimpan tapi TIDAK TERBACA oleh
     pelacak slot — dan gejalanya persis "AI lupa jawaban customer", bug yang
     baru saja dikejar dua ronde (M110/M112).

DB: SQLite in-memory sungguhan (bukan mock) supaya query SQLAlchemy benar-benar
dieksekusi. Provider AI di-stub karena yang diuji di sini alur controller, bukan
kualitas balasan model — itu sudah diuji di test lain.

Run: python tests/test_chatbot_private_controller.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.controllers import chatbot_private_controller as ctl  # noqa: E402
from app.models.chat import Base, ChatMessage, ChatSession, User  # noqa: E402
from app.services.whatsapp_ai_service import AIReplyResult  # noqa: E402

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


class _StubAI:
    """Pengganti generate_whatsapp_reply — merekam apa yang diterimanya."""

    def __init__(self, result: AIReplyResult) -> None:
        self.result = result
        self.calls: list[dict] = []

    async def __call__(self, message: str, **kwargs):
        self.calls.append({"message": message, **kwargs})
        return self.result


def _good_reply() -> AIReplyResult:
    return AIReplyResult(
        ok=True, reply="Budget yang Anda siapkan berapa, Kak? 😊",
        provider="chatgpt", context_source="rag_catalog", catalog_hits=3,
        debug={"phase": "asking", "missing": ["budget"], "boundary": "none",
               "humanizer_issues": []},
    )


async def _fresh_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return engine, async_sessionmaker(engine, expire_on_commit=False)


async def run() -> None:
    print("== Group 1: validasi payload (urutan sama dengan Node) ==")
    ok("pesan kosong ditolak", ctl.validate_payload(name="N", phone="628", message="  ").ok is False)
    ok("nama kosong ditolak", ctl.validate_payload(name="", phone="628", message="hai").ok is False)
    ok("telepon kosong ditolak", ctl.validate_payload(name="N", phone="", message="hai").ok is False)
    ok("payload lengkap diterima", ctl.validate_payload(name="N", phone="628", message="hai").ok is True)
    ok("pesan kosong diprioritaskan lebih dulu",
       "Pesan" in ctl.validate_payload(name="", phone="", message="").message,
       ctl.validate_payload(name="", phone="", message="").message)

    print("\n== Group 2: status endpoint ==")
    st = ctl.private_agent_status()
    for key in ("success", "enabled", "controller", "source", "dataSource"):
        ok(f"status memuat '{key}'", key in st)
    ok("controller dinamai sama dengan Node",
       st["controller"] == "chatbotPrivateController", st["controller"])
    ok("rumah123 dilaporkan OFF (jujur, belum diport)",
       st["dataSource"]["rumah123Enabled"] is False)

    print("\n== Group 3: validasi gagal → 400, TIDAK menyentuh DB ==")
    engine, factory = await _fresh_db()
    async with factory() as db:
        status, body = await ctl.send_private_message(db, name="", phone="", message="")
        ok("status 400", status == 400, str(status))
        ok("success False", body["success"] is False)
        ok("body memuat controller", body["controller"] == "chatbotPrivateController")

    print("\n== Group 4: tanpa agent aktif → 503 (bukan 500) ==")
    async with factory() as db:
        status, body = await ctl.send_private_message(
            db, name="Nigel", phone="628111", message="Saya mau beli rumah di Surabaya")
        ok("status 503", status == 503, str(status))
        ok("alasannya disebut", "agent" in body["message"].lower(), body["message"])

    print("\n== Group 5: alur sukses penuh ==")
    engine, factory = await _fresh_db()
    async with factory() as db:
        db.add(User(id=1, user_id="LFGKT49002", name="LEO FELIX",
                    status=1, privilege="agent"))
        await db.commit()

    stub = _StubAI(_good_reply())
    original = ctl.generate_whatsapp_reply
    ctl.generate_whatsapp_reply = stub  # type: ignore[assignment]
    try:
        async with factory() as db:
            status, body = await ctl.send_private_message(
                db, name="Nigel", phone="628111",
                message="Saya mau beli rumah di Surabaya", location="Surabaya")
    finally:
        ctl.generate_whatsapp_reply = original  # type: ignore[assignment]

    ok("status 200", status == 200, str(status))
    for key in ("success", "reply", "sessionId", "source", "controller",
                "fallbackUsed", "directPrivateEndpoint", "exactMatches",
                "rumah123Listings", "alternatives"):
        ok(f"kontrak Node: '{key}' ada", key in body, str(sorted(body)))
    ok("reply diteruskan apa adanya", body["reply"] == _good_reply().reply, body["reply"])
    ok("sessionId berupa angka", isinstance(body["sessionId"], int), str(body["sessionId"]))
    ok("tiga daftar dikirim sebagai list kosong (bukan hilang)",
       body["exactMatches"] == [] and body["rumah123Listings"] == []
       and body["alternatives"] == [])
    ok("debug memuat fase Q-flow", body["debug"]["phase"] == "asking", str(body["debug"]))

    print("\n== Group 6: nama agent SUNGGUHAN dikirim ke AI ==")
    ok("AI dipanggil sekali", len(stub.calls) == 1, str(len(stub.calls)))
    call = stub.calls[0]
    ok("agent_name dari DB, bukan hardcode", call["agent_name"] == "LEO FELIX", str(call.get("agent_name")))
    ok("agent_user_id dari DB", call["agent_user_id"] == "LFGKT49002", str(call.get("agent_user_id")))
    ok("customer_name diteruskan", call["customer_name"] == "Nigel")
    ok("riwayat kosong di pesan pertama", call["history"] == [], str(call["history"]))

    print("\n== Group 7: role tersimpan 'customer'/'ai' (BUKAN user/assistant) ==")
    async with factory() as db:
        rows = list((await db.execute(
            ChatMessage.__table__.select().order_by(ChatMessage.id)
        )).mappings())
    roles = [r["role"] for r in rows]
    ok("dua baris tersimpan", len(rows) == 2, str(roles))
    ok("role customer, bukan 'user'", roles[0] == "customer", roles[0])
    ok("role ai, bukan 'assistant'", roles[1] == "ai", roles[1])
    ok("channel website_chatbot_private",
       all(r["channel"] == "website_chatbot_private" for r in rows))
    ok("ai_responder dicatat", rows[1]["ai_responder"] == "chatgpt", str(rows[1]["ai_responder"]))
    ok("user_id agent dicatat", rows[0]["user_id"] == "LFGKT49002", str(rows[0]["user_id"]))

    print("\n== Group 8: giliran kedua MEMBAWA riwayat (anti-amnesia) ==")
    stub2 = _StubAI(_good_reply())
    ctl.generate_whatsapp_reply = stub2  # type: ignore[assignment]
    try:
        async with factory() as db:
            await ctl.send_private_message(
                db, name="Nigel", phone="628111", message="400-700 juta")
    finally:
        ctl.generate_whatsapp_reply = original  # type: ignore[assignment]

    hist = stub2.calls[0]["history"]
    ok("riwayat giliran-2 tidak kosong", len(hist) == 2, str(len(hist)))
    ok("riwayat memuat pesan customer sebelumnya",
       any("Surabaya" in h["message"] for h in hist), str(hist))
    ok("riwayat memakai role yang dikenali pelacak slot",
       {h["role"] for h in hist} == {"customer", "ai"}, str({h["role"] for h in hist}))

    print("\n== Group 9: balasan DITOLAK penjaga keluaran → 502, tidak disimpan ==")
    engine2, factory2 = await _fresh_db()
    async with factory2() as db:
        db.add(User(id=1, user_id="LFGKT49002", name="LEO FELIX", status=1, privilege="agent"))
        await db.commit()

    bad = AIReplyResult(ok=False, provider="chatgpt",
                        error="balasan tidak layak kirim: unresolved_placeholder")
    ctl.generate_whatsapp_reply = _StubAI(bad)  # type: ignore[assignment]
    try:
        async with factory2() as db:
            status, body = await ctl.send_private_message(
                db, name="Nigel", phone="628222", message="Saya mau beli rumah")
    finally:
        ctl.generate_whatsapp_reply = original  # type: ignore[assignment]

    ok("status 502", status == 502, str(status))
    ok("success False", body["success"] is False)
    ok("alasan penjaga diteruskan", "placeholder" in body["message"], body["message"])
    async with factory2() as db:
        rows2 = list((await db.execute(
            ChatMessage.__table__.select()
        )).mappings())
    ok("pesan customer TETAP tersimpan (jejak audit)",
       len(rows2) == 1 and rows2[0]["role"] == "customer", str([r["role"] for r in rows2]))
    ok("TIDAK ada baris ai yang ditulis",
       all(r["role"] != "ai" for r in rows2), str([r["role"] for r in rows2]))

    print("\n== Group 10: sesi dipakai ulang per nomor telepon ==")
    async with factory() as db:
        sessions = list((await db.execute(ChatSession.__table__.select())).mappings())
    ok("satu nomor = satu sesi", len(sessions) == 1, str(len(sessions)))
    ok("nomor tersimpan ternormalisasi", sessions[0]["normalizedPhone"] == "628111")

    await engine.dispose()
    await engine2.dispose()


def main() -> None:
    asyncio.run(run())
    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()

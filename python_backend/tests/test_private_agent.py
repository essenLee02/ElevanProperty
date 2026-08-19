"""Regresi M116 — kredit habis TIDAK boleh membuat customer tak dibalas.

KEJADIAN NYATA 17 Agu 2026 23:18 — kredit OpenAI habis:

    HTTP 429 "You have no credits remaining."
    [AI] provider chatgpt gagal
    Send Status: ⚠️ Balasan gagal disusun

Customer mengirim "Saya mau beli gudang" dan TIDAK MENERIMA APA PUN. Padahal
`chatbotPrivateController.js` di Node.js memang dirancang untuk kondisi ini:
"Activated when ChatGPT and Claude cannot generate a response." — di Python
peran itu masih kosong.

Sekarang percakapan tetap maju TANPA API berbayar: slot berikutnya tetap
ditanyakan, dan ringkasan tetap terbentuk.

Run: python tests/test_private_agent.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import qualification_state as qs  # noqa: E402
from app.services.private_agent_service import build_private_reply  # noqa: E402

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


def u(m: str) -> dict:
    return {"role": "user", "message": m}


def a(m: str) -> dict:
    return {"role": "ai", "message": m}


def main() -> None:
    print("== Group 1: pesan pertama tetap dibalas (bukan diam) ==")
    st = qs.extract_state([], "Saya mau beli gudang")
    reply = build_private_reply(st, agent_name="LEO FELIX", app_name="Elevan Property")
    ok("balasan tidak kosong", bool(reply.strip()), repr(reply))
    ok("berisi pertanyaan", "?" in reply, reply)
    ok("menanyakan kota (slot ❓ pertama)", "kota" in reply.lower(), reply)
    ok("TIDAK menanyakan tipe (sudah 'gudang')", "tipe" not in reply.lower(), reply)

    print("\n== Group 2: percakapan MAJU tiap giliran, tidak mengulang ==")
    seq = ["Saya mau beli gudang", "di Surabaya", "budget 5 miliar",
           "target 4 bulan lagi", "cash aja"]
    hist: list[dict] = []
    asked: list[str] = []
    for i, msg in enumerate(seq):
        state = qs.extract_state(hist, msg)
        r = build_private_reply(state, agent_name="LEO FELIX",
                                app_name="Elevan Property", turn=i)
        missing = qs.missing_mandatory(state)
        asked.append(missing[0][0] if missing else "RINGKASAN")
        hist = hist + [u(msg), a(r)]

    ok("urutan pertanyaan maju terus",
       asked == ["city", "budget", "move_in_date", "financing", "RINGKASAN"],
       str(asked))
    ok("tidak ada slot ditanya dua kali", len(asked) == len(set(asked)), str(asked))

    print("\n== Group 3: '4 bulan lagi' mengisi TARGET WAKTU ==")
    st_date = qs.extract_state([], "target 4 bulan lagi")
    ok("tanggal terisi", st_date.move_in_date == "4 bulan lagi", str(st_date.move_in_date))
    ok("TIDAK terbaca sebagai durasi", st_date.duration is None, str(st_date.duration))
    ok("'tahun depan' juga terbaca",
       qs.extract_state([], "rencana beli tahun depan").move_in_date == "tahun depan")

    print("\n== Group 4: ringkasan saat semua slot terisi ==")
    final = qs.extract_state(hist[:-2], seq[-1])
    summary = build_private_reply(final, agent_name="LEO FELIX", app_name="Elevan Property")
    ok("memuat judul ringkasan", "ringkasan" in summary.lower(), summary[:80])
    ok("memuat baris ✓", summary.count("✓") >= 5, str(summary.count("✓")))
    ok("kota benar", "Surabaya" in summary, summary)
    ok("budget benar", "5 miliar" in summary, summary)
    ok("pembiayaan benar", "cash" in summary.lower(), summary)
    ok("tanda tangan agent SUNGGUHAN", "LEO FELIX" in summary, summary[-80:])
    ok("nama aplikasi", "Elevan Property" in summary, summary[-80:])
    ok("TIDAK bertanya lagi setelah lengkap",
       "?" not in summary.split("Sudah sesuai")[0], summary)

    print("\n== Group 5: TIDAK mengarang listing/harga ==")
    for token in ("Rp ", "/bulan", "unit ", "tersedia"):
        ok(f"tidak menyebut '{token.strip()}' yang tidak dikatakan customer",
           token not in summary, summary)
    ok("tidak ada placeholder tersisa",
       "[" not in summary and "${" not in summary, summary)

    print("\n== Group 6: variasi kalimat (anti-robotik) ==")
    st_b = qs.extract_state([], "Saya mau sewa rumah di Surabaya")
    variants = {build_private_reply(st_b, agent_name="A", turn=t) for t in range(4)}
    ok("kalimat berbeda antar giliran", len(variants) > 1, str(len(variants)))

    print("\n== Group 7: klausa pengakuan opsional ==")
    r_ack = build_private_reply(st, agent_name="A", acknowledge="Gudang di Surabaya ya.")
    ok("pengakuan muncul", "Gudang di Surabaya" in r_ack, r_ack)
    ok("pertanyaan tetap ada", "?" in r_ack, r_ack)

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()

"""Regresi M115 — restart palsu harus mustahil.

KEJADIAN NYATA 17 Agu 2026. Lima ronde perbaikan (M110–M114) tidak pernah
terlihat efeknya di WhatsApp. Penyebabnya BUKAN kodenya:

    PID 14992  start 21:01:42  memegang :5056  → menjawab SEMUA pesan
    perbaikan M112 mendarat 21:28, M113/M114 sesudahnya

Setiap kali `python main.py` dijalankan lagi, proses baru gagal bind ke :5056
(`address already in use`), mati, dan proses LAMA tetap melayani customer.
Di layar restart terlihat berhasil; yang menjawab tetap kode lama.

Dua penjaga yang diuji di sini:
  • `assert_port_free()` — berhenti dengan pesan jelas + PID + perintah kill.
  • `build_stamp()`      — sidik jari kode, supaya "apakah perbaikan sudah
                            jalan?" bisa dijawab, bukan ditebak.

Run: python tests/test_startup_guard.py
"""

from __future__ import annotations

import socket
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.startup_guard import (  # noqa: E402
    assert_port_free,
    build_stamp,
    is_port_in_use,
    port_owner_pid,
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


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> None:
    print("== Group 1: deteksi port ==")
    free = _free_port()
    ok("port bebas → tidak terpakai", is_port_in_use(free) is False, str(free))

    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    # ⚠️ Backlog HARUS besar. Dengan listen(1), probe pertama mengisi antrian
    # accept (tidak pernah di-accept oleh siapa pun), sehingga probe KEDUA
    # gagal connect dan port terbaca "bebas" — tesnya sendiri yang salah,
    # bukan kodenya. Server sungguhan meng-accept koneksi, jadi tidak kena.
    listener.listen(128)
    busy = listener.getsockname()[1]
    try:
        ok("port yang didengarkan → terpakai", is_port_in_use(busy) is True, str(busy))

        print("\n== Group 2: assert_port_free ==")
        raised = None
        try:
            assert_port_free(free)
        except SystemExit as exc:  # pragma: no cover
            raised = exc
        ok("port bebas → TIDAK berhenti", raised is None, repr(raised))

        code = None
        try:
            assert_port_free(busy)
        except SystemExit as exc:
            code = exc.code
        ok("port terpakai → SystemExit", code is not None)
        ok("exit code 1 (bukan 0)", code == 1, str(code))

        print("\n== Group 3: PID pemegang port terdeteksi ==")
        pid = port_owner_pid(busy)
        # netstat bisa saja tidak tersedia; fungsi ini WAJIB tetap aman.
        ok("port_owner_pid mengembalikan string", isinstance(pid, str), repr(pid))
        if pid:
            ok("  PID berupa angka", pid.isdigit(), pid)
        else:
            print("       (netstat tidak memberi hasil — dilewati, bukan kegagalan)")
        ok("port bebas → tidak ada PID", port_owner_pid(free) == "", port_owner_pid(free))
    finally:
        listener.close()

    print("\n== Group 4: build stamp ==")
    stamp = build_stamp()
    ok("stempel 8 karakter", len(stamp) == 8, stamp)
    ok("stempel heksadesimal", all(c in "0123456789abcdef" for c in stamp), stamp)
    ok("stabil bila kode tidak berubah", build_stamp() == stamp)

    # Stempel HARUS berubah kalau modul inti berubah — itulah gunanya.
    tmp = Path(__file__).resolve().parents[1] / "app" / "core" / "session_boundary.py"
    original = tmp.read_bytes()
    try:
        tmp.write_bytes(original + b"\n# penanda uji M115\n")
        ok("berubah saat modul inti disunting", build_stamp() != stamp, build_stamp())
    finally:
        tmp.write_bytes(original)
    ok("kembali sama setelah dipulihkan", build_stamp() == stamp, build_stamp())

    print("\n== Group 5: root yang tidak ada tidak boleh melempar ==")
    ok("root salah tetap menghasilkan stempel",
       len(build_stamp(Path("Z:/tidak/ada"))) == 8)

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()

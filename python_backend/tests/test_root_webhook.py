"""Regresi M106 — webhook di ROOT (`POST /`).

⚠️ INI PENYEBAB KEGAGALAN DIAM 15 Agu 2026.
Dashboard Kirimi akun ini dikonfigurasi ke BASE URL saja
(`https://<domain>/`) TANPA path `/api/kirimi/webhook`. Node.js sudah lama
punya handler root (`server.js` → `app.post('/')`) sehingga tetap bekerja;
python_backend belum, jadi SETIAP pesan customer dibalas **404 Not Found**.

Gejalanya: terminal Python kosong, AI tidak membalas, dan satu-satunya
petunjuk hanya baris `"POST / HTTP/1.1" 404 Not Found` di antara log ngrok.

Tes ini memastikan Python bekerja dengan konfigurasi dashboard APA PUN —
dengan path maupun tanpa path.

Run: python tests/test_root_webhook.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

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


def main() -> None:
    import app.main as m

    print("== Group 1: rute terdaftar ==")
    paths = {r.path for r in m.app.routes if hasattr(r, "path")}
    ok("POST / terdaftar (tanpa path — konfigurasi dashboard nyata)", "/" in paths)
    ok("/api/kirimi/webhook tetap ada (dengan path)", "/api/kirimi/webhook" in paths)
    ok("/api/fonnte/webhook tetap ada", "/api/fonnte/webhook" in paths)

    # Metode HTTP yang benar — root HANYA menerima POST.
    root_methods: set[str] = set()
    for r in m.app.routes:
        if getattr(r, "path", None) == "/":
            root_methods |= set(getattr(r, "methods", []) or [])
    ok("root menerima POST", "POST" in root_methods, str(root_methods))

    print("\n== Group 2: KONTROL NEGATIF — sebelum M106 ini 404 ==")
    client = TestClient(m.app)
    payload = {
        "type": "message", "device_id": "D-TEST", "from": "628999000111",
        "pushName": "Uji Root", "message": "Saya mau sewa rumah di Malang",
        "messageId": "root-regress-01", "fromMe": False,
    }
    resp = client.post("/", json=payload)
    ok("POST / TIDAK 404 (inti bug M106)", resp.status_code != 404, f"HTTP {resp.status_code}")
    ok("POST / balas 200", resp.status_code == 200, f"HTTP {resp.status_code}")
    ok("POST / diproses sebagai pesan masuk",
       resp.json().get("type") == "incoming" or resp.json().get("status") is True,
       str(resp.json())[:160])

    print("\n== Group 3: event non-pesan tetap di-ack, tidak error ==")
    resp2 = client.post("/", json={"type": "connection.connected", "device_id": "D-TEST"})
    ok("event koneksi → 200", resp2.status_code == 200, f"HTTP {resp2.status_code}")
    ok("event koneksi TIDAK diproses sbg pesan",
       resp2.json().get("type") != "incoming", str(resp2.json())[:120])

    print("\n== Group 4: payload rusak tidak menjatuhkan server ==")
    resp3 = client.post("/", json={})
    ok("payload kosong → tidak 500", resp3.status_code < 500, f"HTTP {resp3.status_code}")

    print("\n== Group 5: routing ikut MASSEGE_TERMINAL ==")
    from app.config import get_settings
    active = (get_settings().MASSEGE_TERMINAL or "").upper().split(",")[0].strip()
    ok(f"MASSEGE_TERMINAL terbaca ('{active}')", active in ("KIRIMI", "FONNTE", "TIMELINESAI", ""))

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()

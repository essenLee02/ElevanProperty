"""Regresi M100 — python_backend/.env dipakai, TAPI port & domain produksi TIDAK.

⚠️ INI TES KESELAMATAN PRODUKSI, BUKAN TES KERAPIAN.
`python_backend/.env` adalah SALINAN UTUH `backend/.env`, jadi ia memuat
`PORT=5055` (port produksi Node.js) dan `NGROK_DOMAIN=<domain reserved yang
terdaftar di dashboard Kirimi>`. Bila suatu saat seseorang "merapikan"
app/config.py dengan menambahkan field `PORT` atau `NGROK_DOMAIN` — niat baik
yang sangat mungkin terjadi — akibatnya:

  • field PORT terisi 5055 → Python bind ke port Node.js → salah satu mati.
    Bila Python yang menang, SELURUH pesan customer berhenti dibalas dan
    gejalanya TIDAK terlihat sebagai error, hanya "AI diam".
  • field NGROK_DOMAIN terisi → tunnel Python merebut domain produksi.
    Itu insiden NYATA yang sudah terjadi 15 Agu 2026 (V8 §5 M97).

Tes ini GAGAL kalau itu terjadi. Jangan hapus tanpa membaca V8 §5 M97/M100.

Run: python tests/test_config_isolation.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import ACTIVE_ENV_FILE, PYTHON_ENV_FILE, Settings, get_settings  # noqa: E402

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
    print("== Group 1: sumber konfigurasi ==")
    ok("python_backend/.env ADA", PYTHON_ENV_FILE.exists(), str(PYTHON_ENV_FILE))
    ok("config membaca python_backend/.env (bukan backend/.env)",
       ACTIVE_ENV_FILE == PYTHON_ENV_FILE, str(ACTIVE_ENV_FILE))

    settings = get_settings()

    print("\n== Group 2: ISOLASI PORT — tidak boleh memakai 5055 ==")
    ok("PYTHON_PORT != 5055 (port produksi Node.js)",
       settings.PYTHON_PORT != 5055, f"PYTHON_PORT={settings.PYTHON_PORT}")
    ok("PYTHON_PORT = 5056", settings.PYTHON_PORT == 5056, f"PYTHON_PORT={settings.PYTHON_PORT}")
    # Kontrol negatif STRUKTURAL: field bernama PORT tidak boleh ada sama
    # sekali. Kalau ada, pydantic akan mengisinya dari PORT=5055 di .env.
    ok('TIDAK ADA field "PORT" di Settings (kalau ada, akan terisi 5055)',
       "PORT" not in Settings.model_fields,
       f"model_fields memuat PORT — BAHAYA")

    print("\n== Group 3: ISOLASI DOMAIN NGROK — tidak boleh domain produksi ==")
    ok('TIDAK ADA field "NGROK_DOMAIN" di Settings',
       "NGROK_DOMAIN" not in Settings.model_fields,
       "model_fields memuat NGROK_DOMAIN — tunnel Python akan merebut domain produksi")
    ok("PYTHON_NGROK_DOMAIN ada sebagai field terpisah",
       "PYTHON_NGROK_DOMAIN" in Settings.model_fields)
    # Verifikasi nilai .env-nya sendiri memang berisi domain produksi —
    # membuktikan tes di atas bukan tes kosong (kalau .env tidak memuat
    # NGROK_DOMAIN sama sekali, Group 3 lolos tanpa arti).
    env_text = PYTHON_ENV_FILE.read_text(encoding="utf-8", errors="replace") if PYTHON_ENV_FILE.exists() else ""
    ok("KONTROL: .env memang memuat NGROK_DOMAIN (jadi Group 3 bermakna)",
       "NGROK_DOMAIN=" in env_text)
    ok("KONTROL: .env memang memuat PORT=5055 (jadi Group 2 bermakna)",
       "PORT=5055" in env_text)

    print("\n== Group 4: nilai terminal terbaca dari .env ==")
    ok("MESSAGE_TERMINAL terisi", bool(settings.MESSAGE_TERMINAL.strip()), settings.MESSAGE_TERMINAL)
    ok("KIRIMI_USER_CODE terisi dari .env", bool(settings.KIRIMI_USER_CODE.strip()))
    ok("terminal_active('KIRIMI') True (MASSEGE_TERMINAL=KIRIMI)", settings.terminal_active("KIRIMI"))
    ok("terminal_active('FONNTE') False saat MASSEGE_TERMINAL=KIRIMI",
       settings.terminal_active("FONNTE") is False, f"MASSEGE_TERMINAL={settings.MASSEGE_TERMINAL}")

    print("\n== Group 5: terminal_active() — logika multi-nilai ==")
    multi = Settings(MASSEGE_TERMINAL="FONNTE,KIRIMI")
    ok("multi: KIRIMI aktif", multi.terminal_active("KIRIMI"))
    ok("multi: FONNTE aktif", multi.terminal_active("FONNTE"))
    ok("multi: TIMELINESAI TIDAK aktif", multi.terminal_active("TIMELINESAI") is False)
    empty = Settings(MASSEGE_TERMINAL="")
    ok("kosong = fail-open (semua aktif)", empty.terminal_active("FONNTE"))

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()

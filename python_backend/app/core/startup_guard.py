"""app/core/startup_guard.py — pastikan kode BARU yang benar-benar jalan (M115).

⚠️ MASALAH YANG DIPERBAIKI DI SINI — "sudah diperbaiki tapi kok masih sama?"

17 Agu 2026: LIMA ronde perbaikan (M110–M114) tidak pernah terlihat efeknya.
Sebabnya bukan kodenya, melainkan proses lama yang tidak pernah benar-benar
mati:

    PID 14992  start 21:01:42  memegang :5056  → melayani SEMUA pesan
    (perbaikan M112 mendarat 21:28, M113/M114 sesudahnya)

Ketika `python main.py` dijalankan lagi, proses BARU tidak bisa bind ke :5056,
mati dengan `[Errno 10048] address already in use`, sementara proses LAMA tetap
menjawab customer. Dari layar, restart terlihat "berhasil" — padahal yang
melayani tetap kode lama. Traceback uvicorn-nya pun panjang dan tenggelam,
jadi tidak terbaca sebagai penyebab.

Modul ini menutup celah itu dengan dua cara:

  1. `assert_port_free()` — cek port SEBELUM uvicorn start. Kalau terpakai,
     cetak spanduk yang tidak mungkin terlewat: PID pemegang port + perintah
     persis untuk mematikannya, lalu keluar. Tidak ada lagi "restart palsu".

  2. `build_stamp()` — sidik jari isi modul-modul inti, dicetak saat start dan
     ditampilkan di /health. Pertanyaan "apakah perbaikan sudah jalan?" jadi
     bisa dijawab dalam satu detik, bukan ditebak dari perilaku chat.

⚠️ Pemeriksaan port SENGAJA tidak "cari port kosong lain lalu lanjut". Pindah
port diam-diam justru membuat webhook Kirimi (yang menunjuk satu URL) berhenti
sampai — kegagalan diam yang persis sama kelasnya dengan yang sedang dicegah.
"""

from __future__ import annotations

import hashlib
import socket
import subprocess
from pathlib import Path

# Modul yang menentukan perilaku percakapan. Kalau salah satunya berubah,
# stempel berubah — itulah sinyal "server ini membawa perbaikan baru".
_TRACKED = (
    "app/core/session_boundary.py",
    "app/core/qualification_state.py",
    "app/core/preference_extractor.py",
    "app/core/reply_humanizer.py",
    "app/services/inbound_message_service.py",
    "app/services/whatsapp_ai_service.py",
)


def build_stamp(root: Path | None = None) -> str:
    """Sidik jari 8-karakter dari isi modul inti.

    Bukan versi semantik — hanya penanda "kode yang jalan ini yang mana".
    Berubah setiap kali salah satu modul inti disunting.
    """
    base = root or Path(__file__).resolve().parents[2]
    digest = hashlib.sha1()
    for rel in _TRACKED:
        path = base / rel
        try:
            digest.update(path.read_bytes())
        except OSError:
            # Berkas hilang juga informasi — ikut memengaruhi stempel.
            digest.update(f"MISSING:{rel}".encode())
    return digest.hexdigest()[:8]


def port_owner_pid(port: int) -> str:
    """PID pemegang port, atau '' bila tidak terdeteksi.

    Memakai `netstat` karena tersedia di Windows polos tanpa dependensi
    tambahan. Kegagalan apa pun dianggap "tidak tahu" — fungsi ini hanya
    memperkaya pesan, tidak boleh ikut menggagalkan startup.
    """
    try:
        out = subprocess.run(
            ["netstat", "-ano"], capture_output=True, text=True, timeout=8,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return ""
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0].upper() == "TCP" and "LISTENING" in line.upper():
            if parts[1].endswith(f":{port}"):
                return parts[-1]
    return ""


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def assert_port_free(port: int) -> None:
    """Berhenti dengan pesan yang jelas bila port sudah dipakai proses lain.

    Raises:
        SystemExit: selalu, bila port terpakai. Sengaja keluar di sini
            (bukan melempar ke uvicorn) supaya pesannya berada di BARIS
            TERAKHIR terminal, bukan terkubur di bawah traceback.
    """
    if not is_port_in_use(port):
        return

    pid = port_owner_pid(port)
    bar = "=" * 72
    lines = [
        "",
        bar,
        f"  ❌ PORT {port} SUDAH DIPAKAI — SERVER BARU TIDAK DIJALANKAN",
        bar,
        "",
        "  Ada proses LAIN yang masih memegang port ini. Kalau dibiarkan,",
        "  proses lama itulah yang terus menjawab customer — jadi perbaikan",
        "  kode TIDAK akan terlihat sama sekali walau sudah di-restart.",
        "",
    ]
    if pid:
        lines += [
            f"  Pemegang port : PID {pid}",
            "",
            "  Hentikan dulu, lalu jalankan lagi:",
            "",
            f"      taskkill /F /PID {pid}",
            "      .venv\\Scripts\\python.exe main.py",
        ]
    else:
        lines += [
            "  PID pemegang port tidak terdeteksi. Jalankan:",
            "",
            f"      netstat -ano | findstr :{port}",
            "      taskkill /F /PID <PID_TERAKHIR_DI_BARIS_ITU>",
        ]
    lines += ["", "  Atau pakai skrip yang sudah ada:  stop.bat", bar, ""]

    print("\n".join(lines))
    raise SystemExit(1)


__all__ = ["build_stamp", "assert_port_free", "is_port_in_use", "port_owner_pid"]

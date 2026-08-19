"""app/core/ngrok_diagnostics.py — memilah galat ngrok & cek jaringan (M109).

KENAPA PEMILAHAN INI ADA:
Tidak semua kegagalan ngrok berarti hal yang sama, dan memperlakukannya sama
selalu salah di salah satu arah:

  • Token salah → mencoba ulang 10x hanya membuang 30 detik lalu tetap gagal.
    Yang dibutuhkan manusia adalah PESAN yang menyebut apa yang harus dibetulkan.
  • DNS ngadat sesaat → menyerah setelah satu percobaan mematikan tunnel untuk
    SELURUH umur proses. Persis yang terjadi 16 Agu 2026 22:16:58:
        lookup connect.ngrok-agent.com: no such host
    padahal DNS-nya pulih sendiri beberapa menit kemudian.

Jadi: TRANSIENT → coba lagi; PERMANENT → berhenti, jelaskan cara memperbaiki.

⚠️ DEFAULT-nya TRANSIENT. Galat yang belum pernah kita lihat lebih baik dicoba
ulang: biaya mencoba lagi adalah beberapa detik, sedangkan biaya salah
menyerah adalah webhook customer tidak sampai sampai ada yang me-restart.
"""

from __future__ import annotations

import socket
from dataclasses import dataclass

TRANSIENT = "transient"
PERMANENT = "permanent"

NGROK_HOST = "connect.ngrok-agent.com"
NGROK_PORT = 443


@dataclass(frozen=True)
class Diagnosis:
    kind: str      # TRANSIENT | PERMANENT
    reason: str    # kode pendek, dipakai /health dan log
    remedy: str    # kalimat yang bisa ditindaklanjuti manusia


# Urutan PENTING. Galat DNS asli datang terbungkus teks "The ngrok process
# errored on start: ..." — kalau pola pembungkus itu dicek lebih dulu sebagai
# galat permanen, penyebab sebenarnya (DNS, yang sesaat) tidak akan pernah
# terbaca. Yang spesifik selalu didahulukan daripada yang umum.
_PERMANENT_PATTERNS: tuple[tuple[str, str, str], ...] = (
    ("err_ngrok_4018", "auth",
     "NGROK_AUTHTOKEN ditolak. Perbarui token di python_backend/.env "
     "(ambil dari dashboard.ngrok.com/get-started/your-authtoken)."),
    ("authentication failed", "auth",
     "NGROK_AUTHTOKEN ditolak. Perbarui token di python_backend/.env."),
    ("authtoken you specified is invalid", "auth",
     "NGROK_AUTHTOKEN tidak valid. Perbarui token di python_backend/.env."),
    ("err_ngrok_334", "domain_in_use",
     "Domain ngrok sudah dipakai proses lain. Akun ini hanya punya SATU domain "
     "reserved — matikan tunnel Node.js (atau ngrok.exe yatim) dulu, lalu "
     "jalankan ulang. Cek: tasklist | findstr ngrok"),
    ("err_ngrok_108", "session_limit",
     "Batas sesi ngrok tercapai (1 sesi per akun). Tutup agent ngrok lain — "
     "termasuk tunnel produksi Node.js — sebelum menjalankan tunnel Python."),
    ("is already in use", "domain_in_use",
     "Domain ngrok sudah dipakai proses lain. Hentikan tunnel yang memakainya "
     "(biasanya Node.js) sebelum menjalankan tunnel Python."),
    ("simultaneous session", "session_limit",
     "Batas sesi ngrok tercapai. Tutup agent ngrok lain lebih dulu."),
)

_TRANSIENT_PATTERNS: tuple[tuple[str, str, str], ...] = (
    ("no such host", "dns",
     "DNS gagal me-resolve connect.ngrok-agent.com — hampir selalu gangguan "
     "jaringan/resolver sesaat. Tunnel akan dicoba lagi otomatis."),
    ("lookup ", "dns",
     "Resolusi DNS gagal. Tunnel akan dicoba lagi otomatis."),
    ("dial tcp", "network",
     "Tidak bisa menghubungi server ngrok. Tunnel akan dicoba lagi otomatis."),
    ("i/o timeout", "network", "Koneksi ke ngrok timeout. Akan dicoba lagi."),
    ("timeout", "network", "Koneksi ke ngrok timeout. Akan dicoba lagi."),
    ("connection reset", "network", "Koneksi ke ngrok terputus. Akan dicoba lagi."),
    ("failed to reconnect session", "network",
     "Sesi ngrok terputus. Akan dicoba lagi."),
    ("temporary failure", "dns", "Gangguan DNS sesaat. Akan dicoba lagi."),
    ("eof", "network", "Koneksi ke ngrok putus mendadak. Akan dicoba lagi."),
)


def classify_error(message: object) -> Diagnosis:
    """Petakan teks galat ngrok ke keputusan: coba lagi, atau berhenti?"""
    text = str(message or "").lower()

    for needle, reason, remedy in _PERMANENT_PATTERNS:
        if needle in text:
            return Diagnosis(PERMANENT, reason, remedy)

    for needle, reason, remedy in _TRANSIENT_PATTERNS:
        if needle in text:
            return Diagnosis(TRANSIENT, reason, remedy)

    return Diagnosis(
        TRANSIENT, "unknown",
        "Galat ngrok yang belum dikenali — diperlakukan sebagai gangguan "
        "sesaat dan akan dicoba lagi.",
    )


def _family_ok(family: int, timeout: float) -> bool:
    """Bisakah host ngrok di-resolve DAN dihubungi lewat famili alamat ini?"""
    try:
        infos = socket.getaddrinfo(NGROK_HOST, NGROK_PORT, family, socket.SOCK_STREAM)
    except OSError:
        return False
    if not infos:
        return False
    with socket.socket(family, socket.SOCK_STREAM) as sock:
        sock.settimeout(timeout)
        try:
            return sock.connect_ex(infos[0][4]) == 0
        except OSError:
            return False


def preflight(timeout: float = 4.0) -> dict:
    """Cek cepat: apakah server ngrok terjangkau dari mesin ini SEKARANG?

    Dipisah per IPv4/IPv6 karena keduanya bisa berbeda nasib — di mesin ini
    (diukur 16 Agu 2026) IPv4 tersambung normal sementara getaddrinfo IPv6
    gagal dengan errno 11004. Melaporkan "jaringan mati" saat sebenarnya hanya
    IPv6 yang bermasalah akan menyesatkan orang ke arah yang salah.
    """
    ipv4 = _family_ok(socket.AF_INET, timeout)
    ipv6 = _family_ok(socket.AF_INET6, timeout)

    if ipv4 and ipv6:
        summary = "IPv4 & IPv6 terjangkau"
    elif ipv4:
        summary = "IPv4 terjangkau (IPv6 tidak — tidak masalah, ngrok cukup IPv4)"
    elif ipv6:
        summary = "hanya IPv6 terjangkau"
    else:
        summary = ("TIDAK terjangkau — periksa koneksi internet, DNS, "
                   "VPN, atau firewall")

    return {
        "host": NGROK_HOST,
        "port": NGROK_PORT,
        "ipv4_ok": ipv4,
        "ipv6_ok": ipv6,
        "reachable": ipv4 or ipv6,
        "summary": summary,
    }


__all__ = ["TRANSIENT", "PERMANENT", "Diagnosis", "classify_error", "preflight",
           "NGROK_HOST", "NGROK_PORT"]

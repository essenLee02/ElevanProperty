"""Log ringkasan terminal WhatsApp — port `logTerminalSummary`/`logTerminalSkip`
dari `backend/controllers/kirimiChatController.js` (M100).

Format DISAMAKAN PERSIS dengan Node.js supaya operator yang sudah terbiasa
membaca terminal produksi tidak perlu belajar format kedua — dan supaya
transkrip dari kedua backend bisa dibandingkan berdampingan saat memverifikasi
paritas migrasi.

Dipakai oleh KEDUA terminal (Kirimi & Fonnte) lewat parameter `terminal` —
SATU fungsi, bukan salinan per-terminal. Menyalin fungsi log per-terminal
adalah kelas bug yang sudah tiga kali menggigit proyek ini (M27, M77: "salinan
fungsi antar-terminal berbeda perilaku").

⚠️ SEMUA teks dari luar (nama, pesan, balasan AI) WAJIB lewat `sanitize_log()`
— itu yang menyensor API key & mencegah log injection. Jangan pernah
mem-f-string teks mentah ke dalam baris log.
"""

from __future__ import annotations

import logging
import sys

from app.config import get_settings
from app.core.whatsapp_utils import mask_name, mask_phone, sanitize_log

logger = logging.getLogger("elevan.terminal")

_WIDE = "═" * 80
_THIN = "─" * 62

# ⚠️ Console Windows default ke cp1252 saat stdout TIDAK terpasang ke konsol
# interaktif (di-pipe, di-redirect ke berkas, atau dijalankan lewat process
# manager). Karakter kotak (═ ─ ⬇ ✅) TIDAK ADA di cp1252, sehingga `print()`
# melempar UnicodeEncodeError. Ditemukan lewat uji nyata 15 Agu 2026: seluruh
# permintaan webhook membalas HTTP 500 — bukan karena logikanya salah, tapi
# karena BARIS LOG-nya gagal dicetak. Dipaksa UTF-8 di sini (satu tempat),
# untuk kasus modul ini dipakai tanpa lewat main.py (mis. `uvicorn` CLI).
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):  # pragma: no cover
        pass


def _emit(line: str = "") -> None:
    """Cetak apa adanya — TIDAK PERNAH melempar.

    ⚠️ `print()`, BUKAN `logger.info()` — SENGAJA. Blok ini adalah TAMPILAN
    terminal multi-baris (kotak pemisah + isi balasan), bukan satu peristiwa
    log. Melewatkannya ke logging akan menempelkan prefix timestamp/level di
    SETIAP baris dan merusak kotaknya. Peristiwa terstruktur untuk mesin tetap
    dicatat terpisah lewat `logger` di pemanggil.

    ⚠️ SELURUH pencetakan dibungkus try/except sebagai lapisan kedua:
    kegagalan MENAMPILKAN log TIDAK BOLEH menggagalkan pemrosesan pesan
    customer. Log adalah pengamatan, bukan bagian dari transaksi.
    """
    try:
        print(line)
    except Exception:  # noqa: BLE001
        try:
            safe = line.encode("ascii", "replace").decode("ascii")
            print(safe)
        except Exception:  # noqa: BLE001
            pass


def log_incoming_replied(
    *,
    terminal: str,
    agent_name: str,
    agent_phone: str | None,
    agent_user_id: str | None,
    customer_phone: str,
    customer_name: str,
    timestamp: str,
    message: str,
    context_source: str,
    ai_provider: str,
    reply: str,
    sent: bool,
    send_error: str | None = None,
    send_status: str | None = None,
) -> None:
    """Blok penuh: pesan properti masuk DAN sudah dibalas (Contoh 1 & 2).

    `send_status` menimpa label status bila diberikan. Dipakai untuk keadaan
    yang BUKAN sukses maupun gagal — mis. fase migrasi, di mana balasan
    sengaja tidak dikirim. Menampilkannya sebagai "❌ Gagal" akan membuat
    operator mengira ada kerusakan padahal itu perilaku yang diinginkan.
    """
    if not get_settings().terminal_active(terminal):
        return

    if send_status is not None:
        status_label = sanitize_log(send_status, 120)
    elif sent:
        status_label = "✅ Terkirim"
    else:
        status_label = f"❌ Gagal: {sanitize_log(send_error, 80)}"
    safe_reply = sanitize_log(reply, 4000)

    _emit("")
    _emit(_WIDE)
    _emit(f"[{terminal}] ⬇  PESAN PROPERTI MASUK & DIBALAS")
    _emit(_WIDE)
    _emit(f"Agent    : {sanitize_log(agent_name, 60)} ({mask_phone(agent_phone)})")
    _emit(f"Owner    : User {sanitize_log(agent_user_id or '-', 40)}")
    _emit(f"Customer : {mask_phone(customer_phone)} ({mask_name(customer_name)})")
    _emit(f"Time     : {timestamp}")
    _emit(f"Message  : {sanitize_log(message, 300)}")
    _emit(f"Context  : {sanitize_log(context_source, 60)}")
    _emit(f"AI       : {sanitize_log(ai_provider, 40)}")
    _emit(_WIDE)
    _emit("RESPONSE:")
    _emit(_WIDE)
    _emit(safe_reply)
    _emit(_WIDE)
    _emit(f"Send Status: {status_label}")
    _emit(_WIDE)
    _emit("")


def log_incoming_skipped(
    *,
    terminal: str,
    agent_name: str,
    agent_phone: str | None,
    agent_user_id: str | None,
    customer_phone: str,
    customer_name: str,
    timestamp: str,
    message: str,
    stored: bool = False,
    reason: str = "AI skip (bukan query properti)",
) -> None:
    """Blok ringkas: pesan masuk yang BUKAN query properti (Contoh 3)."""
    if not get_settings().terminal_active(terminal):
        return

    stored_label = "Disimpan ke DB" if stored else "Tidak disimpan ke DB"

    _emit("")
    _emit(_THIN)
    _emit(f"[{terminal}] ⬇  PESAN MASUK (bukan query properti — tidak dibalas)")
    _emit(f"[{terminal}]    Agent    : {sanitize_log(agent_name, 60)} ({mask_phone(agent_phone)})")
    _emit(f"[{terminal}]    Owner    : User {sanitize_log(agent_user_id or '-', 40)}")
    _emit(f"[{terminal}]    Customer : {mask_phone(customer_phone)} ({mask_name(customer_name)})")
    _emit(f"[{terminal}]    Time     : {timestamp}")
    _emit(f"[{terminal}]    Message  : {sanitize_log(message, 120)}")
    _emit(f"[{terminal}]    Status   : ⏭️  {stored_label}, {sanitize_log(reason, 80)}")
    _emit(_THIN)
    _emit("")


def log_event_ignored(*, terminal: str, event_type: str) -> None:
    """Satu baris untuk event non-pesan (status koneksi / ack / echo sendiri).

    Sengaja SATU BARIS, bukan blok: event ini datang sangat sering dan
    mencetak kotak penuh untuk masing-masing akan menenggelamkan pesan
    customer sungguhan di terminal.
    """
    if not get_settings().terminal_active(terminal):
        return
    logger.info("[%s] event '%s' diabaikan (bukan pesan masuk)", terminal, sanitize_log(event_type, 40))


__all__ = ["log_incoming_replied", "log_incoming_skipped", "log_event_ignored"]

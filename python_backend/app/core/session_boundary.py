"""app/core/session_boundary.py — batas sesi aktif (M110).

MASALAH NYATA (16 Agu 2026 23.22). Customer mengetik satu kalimat:

    "Saya mau beli rumah di Jakarta"

dan LANGSUNG menerima ringkasan lengkap berisi Area Senayan, budget 300-500
juta, cash, 3 kamar, semi-furnished, "dekat Senayan Mall", bahkan
"2-3 juta/hari + Durasi 1 minggu" untuk sebuah pembelian. Tidak satu pun
pernah dikatakan di percakapan itu.

SEBABNYA BUKAN AI MENGARANG. `get_or_create_session()` memakai ulang sesi
milik satu nomor telepon SELAMANYA, dan `load_history()` mengembalikan 60 pesan
terakhir tanpa peduli umur atau topiknya. Jadi slot terisi dari pencarian LAMA
(villa booking, sewa apartemen) yang sudah selesai. Ketika M107 menambahkan
pelacak slot, ia membaca riwayat basi itu, menyimpulkan "semua wajib sudah
terisi", lalu memerintahkan RINGKASAN — di pesan pertama.

⚠️ Jadi M107 tidak menciptakan kebocoran ini; kebocoran sudah ada. Yang
dilakukan M107 adalah mengubahnya dari "AI kadang menyinggung hal lama" menjadi
"AI mencetak ringkasan lengkap yang salah dengan penuh percaya diri". Perbaikan
slot tanpa batas sesi memang menghasilkan persis itu.

ATURAN (docs/04-qualification-flow.md §2, sudah lama ada di spec, sudah
diterapkan Node.js di chatbotPrivateController.js — Python-lah yang tertinggal):
sesi aktif dimulai dari batas TERAKHIR di antara tiga hal, dan hanya
`history[start:]` yang boleh dipindai:

  A. Batas RINGKASAN  — pesan customer pertama setelah ringkasan terakhir.
  B. Batas GANTI      — pesan yang mengganti tipe properti, membalik transaksi,
                        ATAU mengganti kota, tanpa ringkasan di antaranya.
  C. Batas SAPAAN     — sapaan + niat properti + tipe, walau tipenya sama.

Empat pemicu reset ke Q1 = B (tipe/transaksi/kota) + C (sapaan).

⚠️ KOTA sengaja ikut di batas B. Node.js hanya memeriksa tipe & transaksi,
padahal tabel pemicu di doc 04 mencantumkan "City/location changes" — dan
justru itu yang gagal di transkrip ini ("Jakarta" mewarisi "Area: Senayan"
dari pencarian Surabaya sebelumnya).

MURNI & TANPA EFEK SAMPING: modul ini tidak pernah mengubah riwayat yang
dioper (caller tetap memiliki datanya utuh), tidak menyimpan state modul, dan
mengembalikan nilai baru yang frozen.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Sequence

from app.core.property_keyword_filter import (
    extract_location_from_message,
    extract_property_type_from_message,
    extract_transaction_type_from_message,
)

_CUST_ROLES = frozenset({"user", "customer"})
_AI_ROLES = frozenset({"ai", "assistant"})

# Ringkasan dikenali dari baris "✓ Rencana:" — sama dengan SUMMARY_RE_P0 di
# chatbotPrivateController.js. Dijaga identik supaya kedua backend memotong
# riwayat di titik yang sama.
_SUMMARY_RE = re.compile(r"[✓✔]\s*Rencana\s*:", re.IGNORECASE)

_GREET_RE = re.compile(
    r"^[\s.…,!-]*(hi|hai|halo+|hello|hey|pagi|siang|sore|malam|"
    r"selamat\s+(pagi|siang|sore|malam)|permisi|assalamualaikum|"
    r"asalamualaikum|met\s+(pagi|siang|sore|malam))\b",
    re.IGNORECASE,
)
_INTENT_RE = re.compile(
    r"\b(sewa|menyewa|ngontrak|kontrak|beli|membeli|cari|nyari|mau|pengen|"
    r"butuh|rent|buy|looking|cariin|carikan|book|booking)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Boundary:
    """Hasil perhitungan batas. Frozen: tidak ada yang boleh menambalnya."""

    start: int              # indeks awal sesi aktif di dalam history
    reason: str             # none | summary | switch | greeting
    switched: bool          # True bila reset dipicu ganti tipe/tx/kota atau sapaan
    changed_slot: str       # property_type | transaction | city | greeting | ""


def _text(msg: Any) -> str:
    if isinstance(msg, dict):
        return str(msg.get("message") or "")
    return str(getattr(msg, "message", "") or "")


def _role(msg: Any) -> str:
    if isinstance(msg, dict):
        return str(msg.get("role") or "")
    return str(getattr(msg, "role", "") or "")


# ⚠️ NEGASI HARUS DIBUANG SEBELUM DETEKSI. "eh bukan sewa, mau beli rumah"
# terbaca sebagai `rent` oleh ekstraktor polos karena kata "sewa" ada di
# kalimat — sehingga pembalikan transaksi yang PALING eksplisit justru tidak
# terdeteksi dan sesi tidak pernah direset. Polanya sama seperti
# `stripInvestmentIntentPhrases()` di Node.js: bersihkan frasa dulu, baru
# jalankan detektor yang sudah ada (jangan menulis detektor tandingan).
_NEGATED_RE = re.compile(
    r"\b(?:bukan|bkn|tidak|tdk|gak|nggak|ga|jangan)\s+(?:jadi\s+|mau\s+)?"
    r"(sewa|menyewa|kontrak|ngontrak|beli|membeli|booking|book|"
    r"rumah|villa|vila|apartemen|apartment|hotel|ruko|kos|kost)\b",
    re.IGNORECASE,
)


def _strip_negated(text: str) -> str:
    """Buang "bukan X" supaya X tidak terbaca sebagai pilihan customer."""
    return _NEGATED_RE.sub(" ", str(text or ""))


def _type_of(text: str) -> str | None:
    return extract_property_type_from_message(_strip_negated(text)) or None


def _tx_of(text: str) -> str | None:
    return extract_transaction_type_from_message(_strip_negated(text)) or None


def _city_of(text: str) -> str | None:
    city = extract_location_from_message(text)
    return city.strip().lower() if city else None


def _summary_start(history: Sequence[Any]) -> int:
    """Batas A — pesan customer pertama setelah ringkasan TERAKHIR."""
    last_summary = -1
    for i, m in enumerate(history):
        if _role(m) in _AI_ROLES and _SUMMARY_RE.search(_text(m)):
            last_summary = i
    if last_summary < 0:
        return 0

    # Ringkasan ada tapi customer belum membalas → hanya pesan sekarang yang aktif.
    for i in range(last_summary + 1, len(history)):
        if _role(history[i]) in _CUST_ROLES:
            return i
    return len(history)


def _switch_start(history: Sequence[Any], current_message: str) -> tuple[int, str]:
    """Batas B — ganti tipe properti, balik transaksi, ATAU ganti kota."""
    start, changed = 0, ""
    run_type = run_tx = run_city = None

    # Pesan sekarang ikut sebagai simpul terakhir: pergantian yang terjadi DI
    # pesan ini harus langsung mereset, bukan baru pada giliran berikutnya.
    seq: list[tuple[int, str, str]] = [
        (i, _role(m), _text(m)) for i, m in enumerate(history)
    ]
    seq.append((len(history), "customer", current_message or ""))

    for idx, role, text in seq:
        if role not in _CUST_ROLES:
            continue
        t, tx, city = _type_of(text), _tx_of(text), _city_of(text)
        if t and run_type and t != run_type:
            start, changed = idx, "property_type"
        elif tx and run_tx and tx != run_tx:
            start, changed = idx, "transaction"
        elif city and run_city and city != run_city:
            start, changed = idx, "city"
        if t:
            run_type = t
        if tx:
            run_tx = tx
        if city:
            run_city = city

    return start, changed


def _greeting_start(history: Sequence[Any], current_message: str) -> int:
    """Batas C — sapaan + niat + tipe properti = percakapan baru."""
    start = 0
    seq: list[tuple[int, str, str]] = [
        (i, _role(m), _text(m)) for i, m in enumerate(history)
    ]
    seq.append((len(history), "customer", current_message or ""))

    for idx, role, text in seq:
        if role not in _CUST_ROLES or idx == 0:
            continue  # pesan pertama = awal alami, bukan restart
        if _GREET_RE.search(text) and _INTENT_RE.search(text) and _type_of(text):
            start = idx
    return start


def compute_boundary(history: Sequence[Any] | None,
                     current_message: str = "") -> Boundary:
    """Hitung awal sesi aktif. TIDAK mengubah `history` sama sekali."""
    hist = list(history or [])

    summary = _summary_start(hist)
    switch, changed = _switch_start(hist, current_message)
    greeting = _greeting_start(hist, current_message)

    start = max(summary, switch, greeting)

    # Reset yang dipicu ganti/sapaan berbeda dari reset karena ringkasan:
    # hanya yang pertama mewajibkan AI mengakui perubahan dan mulai dari Q1.
    switched = (switch > 0 and switch >= summary) or (greeting > 0 and greeting >= summary)

    # ⚠️ LATCH SATU GILIRAN (perbaikan regresi M110 → M112). `switched` dulu
    # tetap True SELAMANYA setelah pergantian, karena pergantian itu masih ada
    # di riwayat pada setiap giliran berikutnya. Akibatnya perintah "MULAI
    # WAWANCARA BARU" terus terkirim, dan AI mengulang "mau cari rumah di kota
    # mana?" berkali-kali sambil membuang jawaban yang baru saja diberikan —
    # persis yang terjadi di transkrip 17 Agu 21.05–21.08.
    #
    # Pemotongan riwayat (`start`) HARUS tetap berlaku selamanya — jawaban lama
    # memang sudah tidak sah. Yang hanya boleh sekali adalah PENGUMUMANNYA.
    # Jadi: `switched` = pergantiannya terjadi TEPAT DI pesan sekarang
    # (indeksnya == len(history), simpul terakhir di seq).
    trigger_index = max(switch, greeting)
    just_switched = switched and trigger_index == len(hist)

    if start == 0:
        reason = "none"
    elif switched and greeting >= switch and greeting > 0:
        reason, changed = "greeting", changed or "greeting"
    elif switched:
        reason = "switch"
    else:
        reason, changed = "summary", ""

    return Boundary(start=start, reason=reason, switched=just_switched,
                    changed_slot=changed if just_switched else "")


def active_history(history: Sequence[Any] | None,
                   current_message: str = "") -> list[Any]:
    """Potongan riwayat yang boleh dipindai — SALINAN baru, bukan view."""
    hist = list(history or [])
    return hist[compute_boundary(hist, current_message).start:]


__all__ = ["Boundary", "compute_boundary", "active_history"]

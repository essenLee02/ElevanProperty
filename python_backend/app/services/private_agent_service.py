"""app/services/private_agent_service.py — agen privat TANPA LLM (M116).

⚠️ KENAPA MODUL INI ADA. 17 Agu 2026 23:18, kredit OpenAI habis:

    HTTP 429 — "You have no credits remaining."
    [AI] provider chatgpt gagal
    Send Status: ⚠️ Balasan gagal disusun

Customer bertanya "Saya mau beli gudang" dan TIDAK MENERIMA APA PUN. Padahal
kontrak `chatbotPrivateController.js` di Node.js sudah menyatakan perannya:
"Activated when ChatGPT and Claude cannot generate a response." Di Python
peran itu belum ada isinya — begitu provider gagal, jalur balasan berhenti.

Modul ini menjawab TANPA memanggil API berbayar sama sekali. Bahannya sudah
tersedia dan gratis:
  • `qualification_state` tahu slot mana sudah ✅ dan mana ❓ berikutnya;
  • `preference_extractor` sudah memisahkan mau/hindari/hadap/patokan;
  • RAG tetap bekerja dengan skor LEKSIKAL (BM25) walau embedding ditolak.

Jadi ketika kredit habis, percakapan TETAP maju: pertanyaan berikutnya tetap
diajukan, dan ringkasan tetap bisa dibuat. Yang hilang hanya keluwesan bahasa
model — bukan layanannya.

⚠️ VARIASI KALIMAT ITU WAJIB, BUKAN HIASAN. Balasan template yang selalu sama
persis adalah sumber keluhan "kaku seperti robot" yang sudah dua kali dilaporkan
user. Tiap slot punya beberapa varian, dan yang dipakai dipilih dari PANJANG
RIWAYAT — deterministik (bisa diuji, tidak acak antar-percakapan) tapi berganti
seiring percakapan berjalan.

⚠️ TIDAK PERNAH MENGARANG LISTING/HARGA. Modul ini hanya menanyakan slot dan
merangkum apa yang sudah dikatakan customer. Menyebut properti tanpa data nyata
adalah kelas bug yang sudah dikunci di M111.
"""

from __future__ import annotations

import logging

from app.core.qualification_state import (
    QualificationState,
    build_summary_rows,
    missing_mandatory,
)

logger = logging.getLogger(__name__)

# Beberapa varian per slot. Indeks dipilih dari panjang riwayat sehingga
# pertanyaan yang sama tidak muncul dengan kalimat identik dua kali beruntun.
_QUESTIONS: dict[str, tuple[str, ...]] = {
    "transaction": (
        "Untuk properti ini rencananya disewa atau dibeli, Kak?",
        "Boleh tahu, ini untuk sewa atau beli ya?",
    ),
    "property_type": (
        "Tipe properti apa yang Kakak cari? Misalnya rumah, apartemen, ruko, atau gudang.",
        "Kira-kira properti seperti apa yang dicari, Kak? (rumah, apartemen, ruko, gudang, dll)",
    ),
    "city": (
        "Di kota atau area mana yang Kakak pertimbangkan?",
        "Boleh tahu lokasinya di kota mana, Kak?",
    ),
    "budget": (
        "Kira-kira budget yang Kakak siapkan berapa?",
        "Boleh tahu kisaran anggarannya berapa, Kak?",
        "Untuk anggaran, kira-kira di angka berapa ya, Kak?",
    ),
    "move_in_date": (
        "Rencananya mau masuk atau mulai bulan apa, Kak?",
        "Kira-kira kapan targetnya, Kak?",
    ),
    "duration": (
        "Rencananya untuk berapa lama, Kak? (durasi, bukan tanggal)",
        "Berapa lama rencana sewanya, Kak?",
    ),
    "occupants": (
        "Nanti akan ditempati berapa orang, Kak?",
        "Rencananya bersama siapa saja, Kak? Biar pas jumlah kamarnya.",
    ),
    "facilities": (
        'Ada fasilitas yang wajib ada, Kak? Kalau tidak ada preferensi khusus, boleh jawab "standar saja".',
        'Fasilitas apa yang penting untuk Kakak? Boleh juga jawab "standar saja".',
    ),
    "financing": (
        "Untuk pembiayaan, rencananya cash atau KPR, Kak?",
        "Pembayarannya cash atau lewat KPR ya, Kak?",
    ),
}

_FALLBACK_QUESTION = "Boleh tahu {label}-nya, Kak?"

# Pembuka bervariasi supaya deretan balasan tidak terbaca seperti template.
_OPENERS = ("Baik, Kak.", "Oke, Kak.", "Siap, Kak.", "Terima kasih, Kak.")


def _pick(options: tuple[str, ...], turn: int) -> str:
    return options[turn % len(options)]


def build_private_reply(
    state: QualificationState,
    *,
    agent_name: str = "",
    app_name: str = "",
    turn: int = 0,
    acknowledge: str = "",
) -> str:
    """Susun balasan tanpa LLM: tanya slot ❓ berikutnya, atau buat ringkasan.

    Args:
        state: Status kualifikasi hasil `extract_state()`.
        agent_name: Nama agent sungguhan untuk tanda tangan ringkasan.
        app_name: Nama aplikasi untuk tanda tangan.
        turn: Nomor giliran (dipakai memilih varian kalimat).
        acknowledge: Klausa pengakuan singkat opsional, mis. "budget 400-700 juta".

    Returns:
        Satu pesan WhatsApp siap kirim.
    """
    missing = missing_mandatory(state)

    if missing:
        key, label = missing[0]
        question = _pick(_QUESTIONS.get(key, ()), turn) if key in _QUESTIONS \
            else _FALLBACK_QUESTION.format(label=label)
        opener = _pick(_OPENERS, turn)
        if acknowledge:
            return f"{opener} {acknowledge}\n\n{question}"
        return f"{opener}\n\n{question}"

    # Semua slot wajib terisi → ringkasan. Baris ✓ diambil dari state, jadi
    # tidak ada satu pun nilai yang dikarang.
    rows = build_summary_rows(state)
    agent = (agent_name or "").strip() or "Agen"
    app = (app_name or "").strip() or "Elevan Property"

    return "\n".join([
        "Baik, Kak! Berikut ringkasan permintaan Anda 📝",
        "",
        *rows,
        "",
        "Sudah sesuai, Kak? Saya carikan pilihan yang paling cocok ya.",
        "",
        "Salam hangat,",
        agent,
        app,
    ])


__all__ = ["build_private_reply"]

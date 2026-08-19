"""Penjaga keluaran: buang jejak instruksi & keseragaman robotik (M111).

Semua cacat di bawah diambil dari transkrip PRODUKSI yang dikirim user, bukan
dari dugaan. Semuanya lolos dari aturan prompt — karena itu dijaga
DETERMINISTIK di sini, tepat sebelum pesan dikirim.

1. PLACEHOLDER MENTAH SAMPAI KE CUSTOMER (Case 9):
       "Di Jakarta ada apartemen kisaran Rp [harga rendah] dan Rp [harga tinggi]"
   Model diberi template lalu mengirim kerangkanya. `[Nama Agen]`/`${agentName}`
   masih bisa DIPERBAIKI (nilainya kita punya), tapi `[harga rendah]` tidak —
   itu harus MEMBLOKIR pengiriman, karena menebak harga jauh lebih berbahaya
   daripada terlambat menjawab.

2. KATA PERINTAH IKUT TERKIRIM (Case 1):
       "Untuk pencarian apartemen di Jakarta, tanyakan: Selain area Senayan..."
       "Tanya: Ada fasilitas yang wajib ada untuk apartemen-nya?"
   Model menyalin kalimat tugasnya sendiri. Customer melihat "tanyakan:" —
   inilah yang membuatnya terasa seperti mesin, bukan orang.

3. NOMOR PERTANYAAN INTERNAL BOCOR (Case 5):
       "Siap, Kak. Untuk Q9, kalau nanti ada yang cocok..."
   "Q9" adalah penomoran internal kami; tidak ada artinya bagi customer.

4. PEMBUKA YANG SAMA BERULANG-ULANG (Case 1, 2, 7, 9):
   Delapan giliran berturut-turut dibuka "Oke, Kak! 😊". Tiap pesannya wajar
   sendiri-sendiri, tapi DERETANNYA membuat percakapan terasa dihasilkan
   template. Aturan prompt "jangan ulangi kerangka" sudah ada dan tetap gagal,
   karena model tidak melihat balasannya sendiri sebagai pola. Di sini pembuka
   yang persis sama dengan giliran sebelumnya cukup DIBUANG — sisanya sudah
   kalimat yang wajar.

⚠️ MURNI: tidak mengubah argumen, tidak menyimpan state modul, hasilnya frozen.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_AI_ROLES = frozenset({"ai", "assistant"})

# Placeholder yang NILAINYA kita punya → diperbaiki, bukan diblokir.
_FIXABLE = (
    (re.compile(r"\$\{\s*agent_?name\s*\}|\[\s*nama\s+agen\s*\]", re.IGNORECASE), "agent"),
    (re.compile(r"\$\{\s*app_?name\s*\}|\[\s*nama\s+aplikasi\s*\]", re.IGNORECASE), "app"),
)

# Sisa placeholder apa pun. `[...]` hanya dianggap placeholder bila isinya
# terlihat seperti instruksi (huruf/spasi/underscore) — supaya tautan Markdown
# dan kurung siku wajar tidak ikut kena.
_LEFTOVER = re.compile(r"\$\{[^}]{0,60}\}|\[[a-z][a-z\s_/]{2,40}\]", re.IGNORECASE)

# Kata perintah yang bocor. Dibuang HANYA di posisi scaffolding (awal pesan atau
# setelah koma/titik dua), supaya "saya tanyakan ke owner" tidak ikut terpotong.
_DIRECTIVE = re.compile(
    r"(?:^|(?<=[.\n]))\s*(?:untuk\s+[^,.\n]{0,60},\s*)?"
    r"(?:tanya|tanyakan|pertanyaan|task|tugas)\s*:\s*",
    re.IGNORECASE,
)
_DIRECTIVE_MID = re.compile(r",\s*(?:tanya|tanyakan)\s*:\s*", re.IGNORECASE)

# Penomoran internal: "Untuk Q9,", "Q2c:", "(Q10)".
_QNUM = re.compile(
    r"(?:untuk\s+)?\bQ\s?-?\d{1,2}[a-z]?\b\s*[,:]?\s*",
    re.IGNORECASE,
)

# Pembuka basa-basi: "Oke, Kak! 😊", "Baik, Kak!", "Siap, Pak.".
_OPENER = re.compile(
    r"^\s*(oke|ok|okay|baik|siap|tentu|betul|sip)\s*[,!.]?\s*"
    r"(kak|pak|bu|bund|mas|mbak|ibu|bapak)?\s*[,!.]?\s*[\U0001F300-\U0001FAFF☀-➿]*\s*",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class HumanizedReply:
    """Hasil pembersihan satu balasan.

    Attributes:
        text: Teks yang siap dikirim (kosong bila diblokir).
        issues: Kode masalah yang ditemukan, untuk log dan /health.
        blocked: True bila balasan TIDAK BOLEH dikirim apa adanya.
    """

    text: str
    issues: tuple[str, ...]
    blocked: bool


def _msg_text(msg: object) -> str:
    if isinstance(msg, dict):
        return str(msg.get("message") or "")
    return str(getattr(msg, "message", "") or "")


def _msg_role(msg: object) -> str:
    if isinstance(msg, dict):
        return str(msg.get("role") or "")
    return str(getattr(msg, "role", "") or "")


def last_ai_message(history: object) -> str:
    """Balasan AI terakhir dari riwayat, atau string kosong."""
    try:
        items = list(history or [])  # type: ignore[arg-type]
    except TypeError:
        return ""
    for msg in reversed(items):
        if _msg_role(msg) in _AI_ROLES and _msg_text(msg).strip():
            return _msg_text(msg)
    return ""


def opener_of(text: str) -> str:
    """Pembuka basa-basi yang dinormalkan, untuk membandingkan dua giliran."""
    match = _OPENER.match(str(text or ""))
    if not match:
        return ""
    return re.sub(r"[^a-z]", "", match.group(0).lower())


def humanize_reply(
    raw: str,
    *,
    agent_name: str = "",
    app_name: str = "",
    previous_ai_message: str = "",
) -> HumanizedReply:
    """Bersihkan balasan model sebelum dikirim ke customer.

    Args:
        raw: Teks mentah dari provider AI.
        agent_name: Nama agent sungguhan, untuk mengisi placeholder nama.
        app_name: Nama aplikasi sungguhan.
        previous_ai_message: Balasan AI giliran sebelumnya — dipakai untuk
            mendeteksi pembuka yang berulang.

    Returns:
        HumanizedReply. `blocked=True` berarti masih ada placeholder yang
        nilainya TIDAK kita ketahui; pemanggil wajib tidak mengirimnya.
    """
    text = str(raw or "")
    issues: list[str] = []

    if not text.strip():
        return HumanizedReply(text="", issues=("empty",), blocked=True)

    for pattern, kind in _FIXABLE:
        replacement = (agent_name if kind == "agent" else app_name).strip()
        if pattern.search(text):
            issues.append(f"placeholder_{kind}")
            # Tanpa nilai pengganti, placeholder ini pun tidak layak dikirim —
            # dibiarkan supaya terdeteksi _LEFTOVER di bawah.
            if replacement:
                text = pattern.sub(replacement, text)

    if _DIRECTIVE.search(text) or _DIRECTIVE_MID.search(text):
        issues.append("directive_leak")
        text = _DIRECTIVE_MID.sub(", ", text)
        text = _DIRECTIVE.sub("", text)

    if _QNUM.search(text):
        issues.append("question_number_leak")
        text = _QNUM.sub("", text)

    if previous_ai_message and opener_of(text) and opener_of(text) == opener_of(previous_ai_message):
        stripped = _OPENER.sub("", text, count=1).lstrip()
        # Hanya dibuang bila masih ada isi sesudahnya — pesan yang ISINYA cuma
        # sapaan lebih baik dibiarkan daripada dikosongkan.
        if stripped:
            issues.append("repeated_opener")
            text = stripped[0].upper() + stripped[1:] if stripped[:1].islower() else stripped

    leftovers = _LEFTOVER.findall(text)
    if leftovers:
        issues.append("unresolved_placeholder")
        return HumanizedReply(text=text.strip(), issues=tuple(issues), blocked=True)

    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    if not text:
        return HumanizedReply(text="", issues=tuple([*issues, "empty_after_clean"]), blocked=True)

    return HumanizedReply(text=text, issues=tuple(issues), blocked=False)


__all__ = ["HumanizedReply", "humanize_reply", "last_ai_message", "opener_of"]

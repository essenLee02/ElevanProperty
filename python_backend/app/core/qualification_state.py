"""Pelacak slot kualifikasi — SATU sumber kebenaran "apa yang sudah dijawab".

⚠️ MODUL INI MEMPERBAIKI DUA BUG NYATA sekaligus (transkrip villa Malang,
15 Agu 2026 13:04–13:08):

  (1) **PERTANYAAN BERULANG.** AI menanyakan jumlah kamar di 13.05 lalu
      MENANYAKANNYA LAGI di 13.06; menanyakan tanggal di 13.05 lalu LAGI di
      13.07 — padahal customer sudah menjawab keduanya. Penyebabnya: jalur
      Python murni LLM+RAG, tanpa catatan slot mana yang sudah terisi. Model
      hanya melihat transkrip dan menebak; kalau jawabannya terselip di
      kalimat panjang, ia menanyakan ulang.

  (2) **TIDAK ADA RINGKASAN.** Percakapan berakhir "Nanti saya kabari ya!"
      tanpa blok ✓ ringkasan. Tanpa daftar slot wajib, tidak ada satu pun
      titik di mana sistem tahu "semua sudah lengkap, saatnya merangkum".

Solusinya BUKAN menyuruh model "jangan mengulang" (itu sudah dicoba lewat
aturan prompt dan tetap terjadi), melainkan MEMBERI MODEL DAFTAR EKSPLISIT:
slot mana ✅ terisi (beserta nilainya) dan mana ❓ kosong. Model tinggal
menanyakan yang ❓ — sama seperti yang dilakukan Node.js lewat
`buildQualificationStateBlock()`.

Kontrak slot wajib mengikuti `Real-Estate/00_ANSWER_COMPLETENESS_GUIDE.md` §8:
  SEWA    : transaksi · tipe · lokasi · budget · tanggal masuk · fasilitas
  BELI    : transaksi · tipe · lokasi · budget · target waktu · financing
  BOOKING : tipe · lokasi · budget · check-in · durasi · jumlah tamu
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Sequence

from app.core.property_keyword_filter import (
    extract_location_from_message,
    extract_property_type_from_message,
    extract_transaction_type_from_message,
)
from app.core.preference_extractor import PreferenceSet, extract_preferences, merge
from app.core.session_boundary import Boundary, compute_boundary

_CUST_ROLES = frozenset({"user", "customer"})
_AI_ROLES = frozenset({"ai", "assistant"})

# ── Satuan durasi & uang ────────────────────────────────────────────────────
_UNIT = r"(hari|malam|minggu|pekan|bulan|tahun|thn|day|days|night|nights|week|weeks|month|months|year|years)"

_MONTHS_ID = (
    "januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember"
)
_MONTHS_EN = (
    "january|february|march|april|may|june|july|august|september|october|november|december"
)


def _deglue(text: str) -> str:
    """"untuk1 minggu" → "untuk 1 minggu" (bug produksi M103, sisi Node.js).

    Tanpa ini `\\b(\\d+)` gagal karena tidak ada word-boundary antara huruf
    dan angka yang menempel.
    """
    return re.sub(rf"([a-z])(\d+)(\s*(?:{_UNIT})\b)", r"\1 \2\3", str(text or ""), flags=re.IGNORECASE)


def _msg_text(m: Any) -> str:
    if isinstance(m, dict):
        return str(m.get("message") or "")
    return str(getattr(m, "message", "") or "")


def _msg_role(m: Any) -> str:
    if isinstance(m, dict):
        return str(m.get("role") or "")
    return str(getattr(m, "role", "") or "")


@dataclass
class QualificationState:
    transaction: str | None = None      # rent | sale | booking
    property_type: str | None = None
    city: str | None = None
    area: str | None = None
    budget: str | None = None
    move_in_date: str | None = None
    duration: str | None = None
    occupants: str | None = None
    bedrooms: str | None = None
    facilities: str | None = None
    furnished: str | None = None
    financing: str | None = None        # cash | kpr
    condition: str | None = None        # baru | second | inden
    tower_floor: str | None = None
    red_flags: str | None = None
    anchor_point: str | None = None
    orientation: str | None = None
    preferences: str | None = None
    viewing: str | None = None
    debug: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if k != "debug"}


# ── Ekstraktor per-slot ─────────────────────────────────────────────────────

def _extract_budget(text: str) -> str | None:
    """"2-3 juta/minggu", "Rp 500 juta", "300-500 juta"."""
    low = _deglue(text).lower()
    rng = re.search(
        r"(\d+(?:[.,]\d+)?)\s*(?:-|–|s/d|sampai|hingga)\s*(\d+(?:[.,]\d+)?)\s*"
        r"(juta|jt|miliar|milyar|m|ribu|rb)\b(\s*/\s*\w+)?", low)
    if rng:
        unit = rng.group(3)
        per = (rng.group(4) or "").replace(" ", "")
        return f"{rng.group(1)}-{rng.group(2)} {unit}{per}"
    one = re.search(r"(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(juta|jt|miliar|milyar|ribu|rb)\b(\s*/\s*\w+)?", low)
    if one:
        per = (one.group(3) or "").replace(" ", "")
        return f"{one.group(1)} {one.group(2)}{per}"
    return None


def _extract_duration(text: str) -> str | None:
    """Durasi sewa/menginap. Anchor KETAT (M82/M89): "N hari lagi" = OFFSET
    tanggal, BUKAN durasi."""
    raw = _deglue(text)
    if re.search(rf"\b\d+\s*(?:hari|malam|minggu|pekan|bulan|tahun)\s+lagi\b", raw, re.IGNORECASE):
        # Masih boleh ada durasi terpisah di kalimat yang sama ("checkin 2
        # minggu lagi, durasi 5 hari") — anchor "durasi" tetap dicoba.
        m = re.search(rf"durasi\s*\w*\s*[:\-]?\s*(\d+)\s*{_UNIT}\b", raw, re.IGNORECASE)
        return f"{m.group(1)} {m.group(2)}" if m else None
    m = re.search(rf"durasi\s*\w*\s*[:\-]?\s*(\d+)\s*{_UNIT}\b", raw, re.IGNORECASE)
    if m:
        return f"{m.group(1)} {m.group(2)}"
    m = re.search(
        rf"\b(?:selama|untuk|book(?:ing)?|nginap|menginap|nginep|sewa|stay(?:ing)?|for)\s+(\d+)\s*{_UNIT}\b",
        raw, re.IGNORECASE)
    if m:
        return f"{m.group(1)} {m.group(2)}"
    return None


def _extract_date(text: str) -> str | None:
    """Tanggal/bulan masuk. "tanggal 12 September", "bulan depan", "minggu depan"."""
    low = str(text or "").lower()
    m = re.search(rf"tanggal\s+(\d{{1,2}})\s*(?:bulan\s+)?({_MONTHS_ID}|{_MONTHS_EN})?", low)
    if m:
        return f"tanggal {m.group(1)}" + (f" {m.group(2)}" if m.group(2) else "")
    m = re.search(rf"\b(\d{{1,2}})\s+({_MONTHS_ID}|{_MONTHS_EN})\b", low)
    if m:
        return f"{m.group(1)} {m.group(2)}"
    m = re.search(rf"\b({_MONTHS_ID}|{_MONTHS_EN})\b", low)
    if m:
        return m.group(1)
    m = re.search(r"\b(minggu|bulan|pekan)\s+depan\b", low)
    if m:
        return f"{m.group(1)} depan"
    # ⚠️ "4 bulan lagi" / "3 hari lagi" adalah TARGET WAKTU (M116). Tanpa ini
    # slot tanggal tidak pernah terisi dan agen privat menanyakannya berulang
    # — persis looping yang dikeluhkan user. Perhatikan `_extract_duration()`
    # sengaja MENOLAK bentuk yang sama (di sana "N hari lagi" = offset, bukan
    # durasi); keduanya konsisten: pola ini mengisi TANGGAL, bukan DURASI.
    m = re.search(r"\b(\d+)\s*(hari|minggu|pekan|bulan|tahun)\s+lagi\b", low)
    if m:
        return f"{m.group(1)} {m.group(2)} lagi"
    m = re.search(r"\b(tahun|thn)\s+depan\b", low)
    if m:
        return "tahun depan"
    if re.search(r"\b(secepatnya|asap|segera)\b", low):
        return "secepatnya"
    return None


def _extract_occupants(text: str) -> str | None:
    low = _deglue(text).lower()
    m = re.search(r"\b(\d+)\s*orang\b", low)
    if m:
        return f"{m.group(1)} orang"
    # "menginap dgn 4 teman" → "saya + 4 teman" (total 5). Angka + peran
    # dicek SEBELUM peran polos, kalau tidak hasilnya cuma "teman" dan
    # jumlah tamu — yang WAJIB untuk booking — jadi tidak berguna.
    m = re.search(r"\b(\d+)\s*(teman|tamu|anak|orang\s*dewasa|rekan)\b", low)
    if m:
        return f"saya + {m.group(1)} {m.group(2)}"
    if re.search(r"\b(sendiri|sendirian|solo)\b", low):
        return "sendiri"
    m = re.search(r"\b(istri|suami|pasangan|keluarga|anak|teman|orang tua|ortu)\b", low)
    return m.group(1) if m else None


def _extract_bedrooms(text: str) -> str | None:
    low = _deglue(text).lower()
    m = re.search(r"\b(\d+)\s*(?:kamar(?:\s+tidur)?|kt|bedroom|br)\b", low)
    return f"{m.group(1)} kamar" if m else None


def _extract_facilities(text: str) -> str | None:
    low = str(text or "").lower()
    if re.search(r"\b(standar\s*(saja|aja)?|terserah|bebas|apa\s*(saja|aja))\b", low):
        return "standar saja"
    found = re.findall(
        r"\b(ac|kolam\s*renang|pool|gym|fitness|parkir|kitchen\s*set|wifi|internet|"
        r"carport|garasi|taman|cctv|keamanan|security|lift|water\s*heater|balkon|mushola)\b", low)
    if found:
        seen: list[str] = []
        for f in found:
            f = re.sub(r"\s+", " ", f).strip()
            if f not in seen:
                seen.append(f)
        return ", ".join(seen)
    return None


def _extract_furnished(text: str) -> str | None:
    low = str(text or "").lower()
    if re.search(r"\bsemi[\s-]*furnish", low):
        return "semi-furnished"
    if re.search(r"\b(full[\s-]*furnish|fully[\s-]*furnish|furnished)\b", low):
        return "furnished"
    if re.search(r"\b(kosongan|unfurnished|kosong)\b", low):
        return "kosongan"
    return None


def _extract_financing(text: str) -> str | None:
    low = str(text or "").lower()
    if re.search(r"\bkpr\b", low):
        return "KPR"
    if re.search(r"\b(cash|tunai)\b", low):
        return "cash"
    return None


def _extract_condition(text: str) -> str | None:
    low = str(text or "").lower()
    hits = []
    if re.search(r"\b(baru|new|ready)\b", low):
        hits.append("baru")
    if re.search(r"\b(second|bekas)\b", low):
        hits.append("second")
    if re.search(r"\b(inden|indent)\b", low):
        hits.append("inden")
    return " / ".join(hits) if hits else None


def _extract_tower_floor(text: str) -> str | None:
    low = _deglue(text).lower()
    m = re.search(r"\blantai\s*(\d+\s*(?:-|–|s/d|sampai)\s*\d+|\d+|rendah|tengah|tinggi)\b", low)
    if m:
        return f"lantai {m.group(1)}"
    m = re.search(r"\btower\s+([a-z0-9]+)\b", low)
    return f"tower {m.group(1)}" if m else None


def _extract_area(text: str) -> str | None:
    """Area/kawasan — BUKAN fasilitas.

    ⚠️ Kontrol nyata dari transkrip produksi: "Selain area Parkir Mobil" —
    "Parkir Mobil" itu FASILITAS yang keliru tercatat sebagai area. Penanda
    area WAJIB diikuti nama yang bukan kata fasilitas.
    """
    low = str(text or "").lower()
    m = re.search(r"\b(?:daerah|area|kawasan|kecamatan|wilayah)\s+([a-z][a-z\s]{2,25})", low)
    if m:
        cand = m.group(1).strip()
        if re.search(r"\b(parkir|kolam|renang|gym|fitness|ac|kitchen|wifi|cctv|lift|garasi|carport)\b", cand):
            return None
        return cand.title()
    m = re.search(r"\bdekat\s+([A-Za-z][\w\s]{2,25}?)\s*(?:mall|plaza|square)\b", str(text or ""), re.IGNORECASE)
    if m:
        return m.group(1).strip().title()
    return None


def _extract_red_flags(text: str) -> str | None:
    """Hal yang DIHINDARI. Menjaga NEGASI tetap negasi.

    ⚠️ Bug produksi: "Tdk mau dekat parkiran mobil" tercatat sebagai patokan
    lokasi "dekat parkiran mobil" — kebalikan dari maunya customer.
    """
    low = str(text or "").lower()
    if re.search(r"\b(tidak|tdk|gak|ga|nggak|jangan|hindari|bukan|anti|bebas)\b[\s\w]{0,30}"
                 r"\b(banjir|macet|panas|bising|ramai|sempit|tua|gelap|dekat)\b", low):
        return str(text or "").strip()[:120]
    return None


def _extract_anchor(text: str) -> str | None:
    """Patokan lokasi POSITIF saja — kalimat bernegasi ditolak (lihat red flags)."""
    raw = str(text or "")
    low = raw.lower()
    if re.search(r"\b(tidak|tdk|gak|ga|nggak|jangan|hindari)\b[\s\w]{0,20}\b(dekat|deket)\b", low):
        return None
    m = re.search(r"\b(?:dekat|deket|near|sebelah|samping)\s+([^.,;]{3,60})", raw, re.IGNORECASE)
    return f"dekat {m.group(1).strip()}"[:120] if m else None


def _extract_viewing(text: str) -> str | None:
    low = str(text or "").lower()
    if re.search(r"\b(minta\s+(katalog|listing|rekomendasi)|gak?\s*bisa\s*survei|tidak\s+mau\s+survey|"
                 r"tdk\s+bisa\s+survei|katalog\s+saja|rekomendasi\s+saja)\b", low):
        return "minta listing"
    if re.search(r"\b(viewing|survei|survey|kunjungan|lihat\s+langsung)\b", low):
        return "bersedia viewing"
    return None


def extract_state(history: Sequence[Any], current_message: str = "") -> QualificationState:
    """Pindai SELURUH pesan customer (termasuk yang PERTAMA) untuk mengisi slot.

    ⚠️ Memindai SEMUA pesan customer, bukan hanya yang menjawab setelah AI
    bertanya. Node.js pernah punya bug persis itu (M103): pesan pembuka —
    yang justru paling padat informasi — tidak pernah diperiksa.

    Nilai yang SUDAH terisi TIDAK ditimpa oleh pesan berikutnya, kecuali slot
    itu memang belum ada isinya. Jadi jawaban paling awal menang, dan koreksi
    eksplisit customer tetap bisa masuk lewat slot yang masih kosong.

    ⚠️ HANYA SESI AKTIF yang dipindai (M110). Sebelumnya SELURUH riwayat
    dipindai — dan karena satu nomor telepon memakai ulang sesi yang sama
    selamanya, "Saya mau beli rumah di Jakarta" mewarisi Senayan/300-500
    juta/3 kamar dari pencarian yang sudah SELESAI, lalu dicetak sebagai
    ringkasan. Lihat app/core/session_boundary.py.
    """
    st = QualificationState()
    prefs = PreferenceSet()
    bound = compute_boundary(history, current_message)

    texts: list[str] = [
        _msg_text(m) for m in list(history or [])[bound.start:]
        if _msg_role(m) in _CUST_ROLES and _msg_text(m).strip()
    ]
    if current_message and current_message.strip():
        texts.append(current_message)

    for t in texts:
        if st.transaction is None:
            # ⚠️ BOOKING dicek DULU. `extract_transaction_type_from_message()`
            # memetakan "book/booking/menginap" → "rent" (benar secara harga:
            # booking memang cabang sewa). TAPI daftar slot WAJIB-nya berbeda:
            # booking mewajibkan jumlah tamu & durasi menginap, sewa tidak.
            # Kalau booking terlanjur dilabeli "rent", sistem menyimpulkan
            # "semua lengkap" padahal jumlah tamu belum ditanyakan — persis
            # yang terjadi di transkrip villa Malang.
            if re.search(r"\b(book|booking|menginap|nginap|nginep|check.?in|per\s*malam)\b",
                         t, re.IGNORECASE):
                st.transaction = "booking"
            else:
                st.transaction = extract_transaction_type_from_message(t) or None
        if st.property_type is None:
            st.property_type = extract_property_type_from_message(t) or None
        if st.city is None:
            st.city = (extract_location_from_message(t) or None)
            if st.city:
                st.city = st.city.title()
        if st.area is None:
            st.area = _extract_area(t)
        if st.budget is None:
            st.budget = _extract_budget(t)
        if st.duration is None:
            st.duration = _extract_duration(t)
        if st.move_in_date is None:
            st.move_in_date = _extract_date(t)
        if st.occupants is None:
            st.occupants = _extract_occupants(t)
        if st.bedrooms is None:
            st.bedrooms = _extract_bedrooms(t)
        if st.facilities is None:
            st.facilities = _extract_facilities(t)
        if st.furnished is None:
            st.furnished = _extract_furnished(t)
        if st.financing is None:
            st.financing = _extract_financing(t)
        if st.condition is None:
            st.condition = _extract_condition(t)
        if st.tower_floor is None:
            st.tower_floor = _extract_tower_floor(t)
        if st.viewing is None:
            st.viewing = _extract_viewing(t)

        # ⚠️ PREFERENSI DIPARSING, BUKAN DISALIN MENTAH (M114). Dulu seluruh
        # kalimat "cari yang dingin, hadap selatan, tidak banjir, gang lebar"
        # masuk ke `red_flags`, sehingga ringkasan menulis "Hindari: ...dingin,
        # hadap selatan..." — menyuruh agent menghindari yang justru DIMINTA.
        # Sekarang dipisah: mau / hindari / hadap / patokan.
        prefs = merge(prefs, extract_preferences(t))

    # Preferensi terkumpul dari SEMUA pesan sesi aktif, bukan hanya yang
    # terakhir — customer sering menyebutnya sepotong-sepotong lintas pesan
    # ("dingin, hadap selatan" lalu "dekat Alfamaret" di pesan berikutnya).
    if prefs.wants:
        st.preferences = ", ".join(prefs.wants)[:200]
    if prefs.avoids:
        st.red_flags = ", ".join(prefs.avoids)[:200]
    if prefs.orientation:
        st.orientation = prefs.orientation
    if prefs.nearby and st.anchor_point is None:
        st.anchor_point = ", ".join(prefs.nearby)[:200]

    # "booking" itu cabang SEWA (tarif per malam/minggu) — sama seperti
    # TRANSACTION_KEYWORDS.rent di Node.js yang memuat 'booking'/'menginap'.
    if st.transaction == "booking":
        st.debug["is_booking"] = True

    return st


# ── Slot wajib per jenis transaksi (00_ANSWER_COMPLETENESS_GUIDE.md §8) ─────
_MANDATORY: dict[str, list[tuple[str, str]]] = {
    "booking": [
        ("property_type", "tipe properti"), ("city", "kota/lokasi"),
        ("budget", "budget"), ("move_in_date", "tanggal check-in"),
        ("duration", "durasi menginap"), ("occupants", "jumlah tamu"),
    ],
    "rent": [
        ("transaction", "sewa/beli"), ("property_type", "tipe properti"),
        ("city", "kota/lokasi"), ("budget", "budget"),
        ("move_in_date", "tanggal masuk"), ("facilities", "fasilitas"),
    ],
    "sale": [
        ("transaction", "sewa/beli"), ("property_type", "tipe properti"),
        ("city", "kota/lokasi"), ("budget", "budget"),
        ("move_in_date", "target waktu"), ("financing", "cash atau KPR"),
    ],
}


def missing_mandatory(state: QualificationState) -> list[tuple[str, str]]:
    """Slot wajib yang masih kosong, urut prioritas."""
    txn = state.transaction or "rent"
    if txn == "booking":
        keys = _MANDATORY["booking"]
    elif txn == "sale":
        keys = _MANDATORY["sale"]
    else:
        keys = _MANDATORY["rent"]
    return [(k, label) for k, label in keys if not getattr(state, k, None)]


_LABELS: dict[str, str] = {
    "transaction": "Rencana", "property_type": "Tipe", "city": "Kota",
    "area": "Area", "budget": "Budget", "move_in_date": "Masuk/Check-in",
    "duration": "Durasi", "occupants": "Penghuni/Tamu", "bedrooms": "Kamar",
    "facilities": "Fasilitas", "furnished": "Furnitur", "financing": "Pembiayaan",
    "condition": "Kondisi", "tower_floor": "Tower/Lantai",
    "red_flags": "Hindari", "anchor_point": "Patokan lokasi",
    # M114 — preferensi dipisah dari "Hindari". "Preferensi" berisi hal yang
    # DIMAU (termasuk hasil terjemahan negasi: "tidak banjir" → "bebas
    # banjir"); "Hindari" hanya larangan sebenarnya.
    "orientation": "Hadap", "preferences": "Preferensi",
    "viewing": "Viewing",
}

_TXN_ID = {"rent": "Sewa", "sale": "Beli", "booking": "Booking"}

_CHANGE_LABEL = {
    "property_type": "tipe properti",
    "transaction": "jenis transaksi",
    "city": "kota",
    "greeting": "arah pencarian",
}


def build_state_block(state: QualificationState) -> str:
    """Blok "apa yang SUDAH dijawab" untuk disisipkan ke prompt.

    ⚠️ INILAH yang menghentikan pertanyaan berulang. Model tidak perlu lagi
    menyimpulkan dari transkrip panjang — ia melihat daftar tegas ✅/❓.
    """
    lines = ["── STATUS KUALIFIKASI (JANGAN tanyakan yang sudah ✅) ──"]
    for key, label in _LABELS.items():
        val = getattr(state, key, None)
        if val:
            shown = _TXN_ID.get(val, val) if key == "transaction" else val
            lines.append(f"✅ {label}: {shown}")

    missing = missing_mandatory(state)
    if missing:
        lines.append("")
        lines.append("❓ MASIH KOSONG (wajib, tanyakan SATU saja — yang paling atas):")
        for _, label in missing:
            lines.append(f"   ❓ {label}")
    else:
        lines.append("")
        lines.append("✅ SEMUA SLOT WAJIB SUDAH TERISI.")
    return "\n".join(lines)


def build_summary_rows(state: QualificationState) -> list[str]:
    """Baris ✓ ringkasan dari slot yang TERISI saja.

    Dipakai dua jalur sekaligus: perintah ringkasan untuk LLM, dan agen privat
    tanpa LLM (M116). Satu sumber supaya bentuk ringkasan tidak bercabang saat
    provider berbayar mati — persis kelas bug "salinan antar-jalur berbeda
    perilaku" yang sudah tiga kali menggigit proyek ini.

    Tidak ada nilai yang dikarang: hanya slot yang benar-benar ada isinya.
    """
    return [
        f"✓ {_LABELS[k]}: {(_TXN_ID.get(v, v) if k == 'transaction' else v)}"
        for k, v in state.as_dict().items() if v and k in _LABELS
    ]


def build_directive(state: QualificationState, agent_name: str = "", app_name: str = "",
                    boundary: Boundary | None = None) -> str:
    """Instruksi tegas untuk giliran ini: tanya satu slot, ATAU buat ringkasan.

    ⚠️ Pada giliran terjadinya pergantian tipe/transaksi/kota (atau sapaan
    restart), ringkasan DILARANG walau semua slot terlihat penuh — doc 04 §2:
    "Never show a summary on the turn the change happens". Tanpa aturan ini,
    "Saya mau beli rumah di Jakarta" dijawab ringkasan lengkap milik pencarian
    sebelumnya.
    """
    missing = missing_mandatory(state)

    if boundary is not None and boundary.switched and not missing:
        # Slot penuh di sini hanya bisa berarti nilainya berasal dari pesan
        # pemicu itu sendiri; sisanya sudah dipotong. Wawancara tetap harus
        # dimulai, bukan diringkas.
        label = _CHANGE_LABEL.get(boundary.changed_slot, "permintaan baru")
        return "\n".join([
            "── TUGAS ANDA GILIRAN INI: MULAI WAWANCARA BARU ──",
            f"Customer baru saja mengganti {label}. Semua jawaban lama TIDAK",
            "berlaku lagi dan sudah dibuang.",
            "1. Akui perubahannya dalam SATU kalimat singkat.",
            "2. Lanjutkan bertanya dari slot ❓ paling awal, SATU pertanyaan saja.",
            "⛔ DILARANG menampilkan ringkasan pada giliran ini.",
            "⛔ DILARANG menyebut area, budget, kamar, fasilitas, tanggal, atau",
            "   patokan lokasi dari pencarian sebelumnya — itu bukan milik",
            "   permintaan ini dan customer tidak pernah menyebutkannya.",
        ])

    if missing:
        _, label = missing[0]
        return "\n".join([
            "── TUGAS ANDA GILIRAN INI ──",
            f"Tanyakan HANYA satu hal: **{label}**.",
            "⛔ JANGAN menanyakan apa pun yang sudah ✅ di atas — customer sudah",
            "   menjawabnya, dan menanyakannya lagi membuat mereka jengkel.",
            "⛔ JANGAN menampilkan ringkasan dulu — masih ada slot wajib kosong.",
            "Akui singkat info baru yang barusan diberikan (maksimal satu klausa),",
            "lalu ajukan pertanyaan itu dengan wajar.",
        ])

    agent = (agent_name or "").strip() or "Agen"
    app = (app_name or "").strip() or "Elevan Property"
    rows = build_summary_rows(state)

    return "\n".join([
        "── TUGAS ANDA GILIRAN INI: BUAT RINGKASAN ──",
        "SEMUA slot wajib sudah terisi. JANGAN bertanya lagi.",
        "Tulis ringkasan PERSIS dengan format baris ✓ berikut (boleh dirapikan",
        "bahasanya, TAPI jangan menambah baris yang tidak ada di sini, dan",
        "JANGAN mengarang nilai yang tidak tercantum):",
        "",
        "Baik, Kak! Berikut ringkasan permintaan Anda 📝",
        "",
        *rows,
        "",
        "Lalu tutup dengan: apakah sudah sesuai, dan beri tahu Anda akan",
        "carikan pilihan yang cocok. Akhiri dengan tanda tangan:",
        "",
        "Salam hangat,",
        agent,
        app,
    ])


__all__ = [
    "QualificationState", "extract_state", "missing_mandatory",
    "build_state_block", "build_directive",
]

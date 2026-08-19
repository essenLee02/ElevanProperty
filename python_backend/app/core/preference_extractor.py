"""app/core/preference_extractor.py — pisahkan MAU vs HINDARI (M114).

MASALAH NYATA. Customer menulis satu kalimat berisi EMPAT hal berbeda:

    "Saya cari rumah yang dingin, hadap selatan, tidak banjir, gang yang lebar"

Sebelum modul ini, seluruh kalimat itu masuk ke satu slot `red_flags`. Dua
akibatnya sama-sama buruk:

  1. RINGKASAN MEMBALIK MAKNA. Baris "✓ Hindari: ...dingin, hadap selatan..."
     menyuruh agent MENGHINDARI hal yang justru DIMINTA customer. Persis
     terlihat di transkrip 15 Agu: "✓ Hindari: Cari yang akses jalan lancar,
     tidak banjir, tidak panas, dekat Alfamaret, Indomaret" — semuanya
     permintaan, bukan larangan.
  2. AI MENGIRA BELUM DIJAWAB. Karena tidak ada slot yang terisi rapi, model
     terus bertanya hal yang sudah dijawab ("tipe rumah seperti apa?") —
     keluhan berulang: repetitif, redundan, looping.

⚠️ ORANG INDONESIA MENYATAKAN KEINGINAN LEWAT NEGASI. "tidak banjir",
"tidak panas", "tidak macet", "gang jangan sempit" — semuanya KEINGINAN
(bebas banjir, sejuk, akses lancar, gang lebar), bukan sekadar larangan.
Menyalin mentah ke kolom "Hindari" membuat ringkasan terbaca aneh dan
menyesatkan pencarian. Maka negasi diterjemahkan ke bentuk POSITIF yang bisa
dicari, dan hanya larangan SEBENARNYA ("jangan dekat parkiran", "hindari
rumah tua") yang masuk daftar hindari.

⚠️ HADAP ADALAH SLOT SENDIRI, BUKAN FASILITAS DAN BUKAN AREA. "hadap selatan"
pernah tercatat sebagai area/fasilitas; keduanya salah dan merusak filter
katalog.

MURNI: tidak mengubah argumen, tidak menyimpan state, hasil frozen.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Kata pengingkar yang lazim di chat Indonesia (termasuk singkatan WA).
_NEG = r"(?:tidak|tdk|gak|gk|ga|nggak|ngga|enggak|jangan|jgn|hindari|bukan|anti|bebas|no)"

# ── NEGASI → KEINGINAN POSITIF ──────────────────────────────────────────────
# Kunci: apa yang diingkari. Nilai: bagaimana menuliskannya sebagai keinginan.
# Ini yang membuat "tidak banjir" berhenti muncul di kolom "Hindari".
_NEG_TO_WANT: tuple[tuple[str, str], ...] = (
    (r"banjir", "bebas banjir"),
    (r"macet", "akses lancar"),
    (r"panas|gerah", "sejuk"),
    (r"bising|berisik|ramai\s*(?:jalan)?", "tenang"),
    (r"sempit", "akses/gang lebar"),
    (r"tua|kuno", "bangunan kondisi baik"),
    (r"gelap", "terang"),
    (r"lembab|lembap", "kering"),
    (r"bau", "bebas bau"),
)

# ── KEINGINAN YANG DINYATAKAN LANGSUNG ──────────────────────────────────────
_WANT_PATTERNS: tuple[tuple[str, str], ...] = (
    (r"\b(dingin|sejuk|adem|asri)\b", "sejuk/asri"),
    (r"\bgang\w*\s+(?:yang\s+)?lebar\b|\bjalan\w*\s+(?:yang\s+)?lebar\b", "gang/jalan lebar"),
    (r"\bakses\w*\s+(?:jalan\s+)?(?:yang\s+)?lancar\b|\bjalan\w*\s+lancar\b", "akses lancar"),
    (r"\bstrategis\b", "lokasi strategis"),
    (r"\btenang\b|\bsepi\b", "tenang"),
    (r"\baman\b|\bkeamanan\b", "aman"),
    (r"\bbebas\s+banjir\b|\bgak?\s*banjir\b", "bebas banjir"),
    (r"\bhijau\b|\bbanyak\s+taman\b", "banyak ruang hijau"),
    (r"\bterang\b", "terang"),
)

# ── ARAH HADAP ──────────────────────────────────────────────────────────────
_ORIENTATION_RE = re.compile(
    r"\bhadap\s*(?:ke\s*)?(selatan|utara|timur|barat|tenggara|"
    r"barat\s*daya|timur\s*laut|barat\s*laut)\b",
    re.IGNORECASE,
)
# "tidak hadap matahari terbit" / "jangan hadap barat" → masuk daftar hindari.
_ORIENTATION_NEG_RE = re.compile(
    rf"\b{_NEG}\b[\s\w]{{0,12}}\bhadap\s*(?:ke\s*)?"
    r"(selatan|utara|timur|barat|matahari\s+terbit|matahari\s+sore)\b",
    re.IGNORECASE,
)

# ── PATOKAN LOKASI (dekat X) ────────────────────────────────────────────────
# Koma DIIZINKAN di dalam tangkapan supaya "dekat alfamaret, Indomaret" tidak
# kehilangan patokan kedua. Tiap bagian hasil pecahan disaring lagi oleh
# `_looks_like_landmark()` agar klausa berikutnya ("budget 5 juta") tidak ikut
# tertelan menjadi patokan lokasi.
_NEAR_RE = re.compile(r"\b(?:dekat|deket|dkt|near|sebelah|samping)\s+([^.;!?]{2,80})",
                      re.IGNORECASE)
_NEAR_NEG_RE = re.compile(rf"\b{_NEG}\b[\s\w]{{0,15}}\b(?:dekat|deket|dkt)\s+([^.,;!?]{{2,60}})",
                          re.IGNORECASE)

# Penanda bahwa potongan itu sebenarnya slot lain, bukan patokan lokasi.
_NOT_LANDMARK_RE = re.compile(
    r"\d|\b(juta|jt|miliar|rb|ribu|budget|harga|kamar|kt|tahun|thn|bulan|bln|"
    r"minggu|hari|malam|cash|kpr|sewa|beli|booking|furnished|kosongan)\b",
    re.IGNORECASE,
)


def _looks_like_landmark(text: str) -> bool:
    """Potongan layak jadi patokan hanya bila ia bukan slot lain.

    ⚠️ Potongan yang MEMUAT kata pengingkar juga ditolak. Karena tangkapan
    boleh melewati koma, "dekat PTC dan dekat gunung, jangan yang rumah tua"
    sempat menghasilkan patokan palsu "dekat jangan yang rumah tua" — larangan
    yang berbalik menjadi keinginan, kelas bug yang sama dengan yang sedang
    diperbaiki modul ini.
    """
    t = text.strip()
    if not (2 <= len(t) <= 40):
        return False
    if re.search(rf"\b{_NEG}\b", t, re.IGNORECASE):
        return False
    return not _NOT_LANDMARK_RE.search(t)


@dataclass(frozen=True)
class PreferenceSet:
    """Hasil pembacaan satu kalimat preferensi.

    Attributes:
        wants: Hal yang DIINGINKAN (sudah dinormalkan jadi bentuk positif).
        avoids: Hal yang BENAR-BENAR dilarang customer.
        orientation: Arah hadap yang diminta, mis. "hadap selatan".
        nearby: Patokan lokasi positif, mis. "dekat PTC".
    """

    wants: tuple[str, ...] = ()
    avoids: tuple[str, ...] = ()
    orientation: str | None = None
    nearby: tuple[str, ...] = ()

    def is_empty(self) -> bool:
        return not (self.wants or self.avoids or self.orientation or self.nearby)


def _dedup(items: list[str]) -> tuple[str, ...]:
    """Buang duplikat, pertahankan urutan munculnya."""
    seen: set[str] = set()
    out: list[str] = []
    for it in items:
        key = it.lower()
        if key not in seen:
            seen.add(key)
            out.append(it)
    return tuple(out)


def extract_preferences(text: str) -> PreferenceSet:
    """Baca satu pesan customer menjadi wants / avoids / hadap / patokan."""
    raw = str(text or "")
    low = raw.lower()
    if not low.strip():
        return PreferenceSet()

    wants: list[str] = []
    avoids: list[str] = []
    nearby: list[str] = []

    # 1. Negasi → keinginan positif. Dicek DULU supaya "tidak banjir" tidak
    #    keburu tertangkap sebagai larangan mentah.
    for pattern, want in _NEG_TO_WANT:
        if re.search(rf"\b{_NEG}\b[\s\w]{{0,15}}\b(?:{pattern})\b", low):
            wants.append(want)

    # 2. Keinginan yang dinyatakan langsung.
    for pattern, want in _WANT_PATTERNS:
        if re.search(pattern, low):
            wants.append(want)

    # 3. Arah hadap. Negatif diperiksa lebih dulu — "jangan hadap barat"
    #    adalah larangan, bukan permintaan hadap barat.
    orientation: str | None = None
    neg_or = _ORIENTATION_NEG_RE.search(raw)
    if neg_or:
        avoids.append(f"hadap {neg_or.group(1).strip().lower()}")
    else:
        m = _ORIENTATION_RE.search(raw)
        if m:
            orientation = f"hadap {m.group(1).strip().lower()}"

    # 4. Patokan lokasi. "tidak mau dekat parkiran" → hindari, bukan patokan.
    for m in _NEAR_NEG_RE.finditer(raw):
        avoids.append(f"dekat {m.group(1).strip()}")
    negated_spans = [m.span() for m in _NEAR_NEG_RE.finditer(raw)]
    for m in _NEAR_RE.finditer(raw):
        if any(s <= m.start() < e for s, e in negated_spans):
            continue
        # "dekat alfamaret, Indomaret" dan "dekat PTC dan dekat gunung" adalah
        # DAFTAR. Disimpan sebagai satu gumpalan, ringkasan jadi rancu dan
        # patokan kedua hilang dari pencarian — jadi dipecah di sini.
        for part in re.split(r"\s+dan\s+|\s*,\s*|\s*&\s*", m.group(1)):
            item = re.sub(r"^(?:dekat|deket|dkt)\s+", "", part.strip(), flags=re.IGNORECASE)
            if _looks_like_landmark(item):
                nearby.append(f"dekat {item}")

    # 5. Larangan eksplisit yang TIDAK punya padanan positif.
    for pattern in (r"rumah\s+tua", r"gang\s+sempit", r"jalan\s+ramai",
                    r"rel\s+kereta", r"kuburan", r"tpa|tempat\s+pembuangan"):
        if re.search(rf"\b{_NEG}\b[\s\w]{{0,15}}\b(?:{pattern})\b", low):
            avoids.append(re.sub(r"\s+", " ", re.search(pattern, low).group(0)))

    return PreferenceSet(
        wants=_dedup(wants),
        avoids=_dedup(avoids),
        orientation=orientation,
        nearby=_dedup(nearby),
    )


def merge(base: PreferenceSet, new: PreferenceSet) -> PreferenceSet:
    """Gabung dua hasil — nilai LAMA dipertahankan, yang baru ditambahkan.

    Mengembalikan objek BARU; tidak satu pun argumen diubah.
    """
    return PreferenceSet(
        wants=_dedup([*base.wants, *new.wants]),
        avoids=_dedup([*base.avoids, *new.avoids]),
        orientation=base.orientation or new.orientation,
        nearby=_dedup([*base.nearby, *new.nearby]),
    )


__all__ = ["PreferenceSet", "extract_preferences", "merge"]

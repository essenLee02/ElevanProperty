"""Gerbang masuk pesan WhatsApp — port dari `backend/utils/propertyKeywordFilter.js`.

Setiap pesan masuk melewati fungsi di sini SEBELUM apa pun yang lain. Bila
gerbang menolak, pesan tidak dibalas dan tidak disimpan — jadi kesalahan di
modul ini terlihat sebagai "AI mendiamkan customer", bukan sebagai error.

Perbaikan yang tertanam di sini (jangan hilangkan tanpa membaca V8 §5):
  M87  "booking" WAJIB ada di ACTION_WORDS. Q1 mengenal TIGA transaksi —
       sewa/beli/booking — dan tanpa kata itu SELURUH alur booking tidak bisa
       dimulai: "Saya booking hotel di Surabaya" (transaksi+tipe+kota lengkap)
       dibuang sebagai non-properti.
  M88  Kalimat pertanyaan yang DIKIRIM AI SENDIRI harus dikenali oleh
       PROPERTY_QUESTION_PATTERNS. Bila tidak, AI bertanya lalu membuang
       jawabannya — customer menjawab "Daerah Gubeng" lima kali tanpa dibalas.

⚠️ Konstanta TIDAK ditulis ulang dengan tangan. Semuanya dimuat dari
`_gate_constants.json` yang diekspor langsung dari modul Node.js
(`tools/export_gate_constants.js`), sehingga port ini turunan yang terbukti
identik — bukan tiruan yang mirip. Jalankan ulang eksporternya bila Node.js
berubah.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Sequence

_CONST_FILE = Path(__file__).with_name("_gate_constants.json")


@lru_cache(maxsize=1)
def _constants() -> dict[str, Any]:
    with _CONST_FILE.open(encoding="utf-8") as fh:
        return json.load(fh)


def _list(name: str) -> list[str]:
    return list(_constants().get(name) or [])


@lru_cache(maxsize=1)
def _property_types() -> list[str]:
    return _list("PROPERTY_TYPES")


@lru_cache(maxsize=1)
def _rumah_exclusions() -> list[str]:
    return _list("RUMAH_EXCLUSIONS")


@lru_cache(maxsize=1)
def _action_words() -> list[str]:
    return _list("ACTION_WORDS")


@lru_cache(maxsize=1)
def _standalone_keywords() -> list[str]:
    return _list("STANDALONE_KEYWORDS")


@lru_cache(maxsize=1)
def _action_strict() -> frozenset[str]:
    return frozenset(_list("ACTION_WORDS_STRICT_BOUNDARY"))


@lru_cache(maxsize=1)
def _type_strict() -> frozenset[str]:
    return frozenset(_list("PROPERTY_TYPES_STRICT_BOUNDARY"))


@lru_cache(maxsize=512)
def _bounded(term: str) -> re.Pattern[str]:
    """Regex word-boundary, meniru `new RegExp('\\b'+t+'\\b', 'i')` di JS.

    Word-boundary WAJIB untuk kata pendek/ambigu — tanpa ini "ada" cocok di
    "kepada", "list" di "listrik", "book" di "facebook". Itu bukan hipotesis:
    daftar ACTION_WORDS_STRICT_BOUNDARY di Node.js lahir dari salah-match nyata.
    """
    return re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)


def _matches_term(text_lower: str, term: str, strict: frozenset[str]) -> bool:
    """Cocokkan satu istilah: word-boundary bila terdaftar strict, else substring."""
    if term in strict:
        return bool(_bounded(term).search(text_lower))
    return term in text_lower


def has_property_type(text_lower: str) -> bool:
    """Apakah teks memuat tipe properti yang sah?

    "rumah" ditangani khusus: "rumah makan"/"rumah sakit" BUKAN tipe properti.
    """
    if "rumah" in text_lower:
        if not any(exc in text_lower for exc in _rumah_exclusions()):
            return True

    strict = _type_strict()
    return any(_matches_term(text_lower, t, strict) for t in _property_types())


def has_action_word(text_lower: str) -> bool:
    strict = _action_strict()
    return any(_matches_term(text_lower, a, strict) for a in _action_words())


def has_standalone_keyword(text_lower: str) -> bool:
    return any(kw in text_lower for kw in _standalone_keywords())


def has_property_keyword(message: str | None) -> bool:
    """Gerbang masuk utama: (TIPE PROPERTI + KATA AKSI) ATAU KATA KUNCI MANDIRI.

    Struktur AND itu adalah properti keamanannya: menambah kata aksi baru tetap
    aman karena tipe properti tetap diwajibkan — "booking tiket pesawat" dan
    "booking meja restoran" tetap ditolak meski "booking" kini kata aksi (M87).

    >>> has_property_keyword("Saya booking hotel di Surabaya")
    True
    >>> has_property_keyword("booking tiket pesawat")
    False
    """
    if not message or not isinstance(message, str):
        return False

    lower = message.lower().strip()
    if not lower or len(lower) < 3:
        return False

    if has_standalone_keyword(lower):
        return True

    return has_property_type(lower) and has_action_word(lower)


# ── Pola pertanyaan properti dari AI ────────────────────────────────────────
_AI_ROLES = frozenset({"ai", "assistant"})
_CUST_ROLES = frozenset({"user", "customer"})


@lru_cache(maxsize=1)
def _question_patterns() -> tuple[re.Pattern[str], ...]:
    """PROPERTY_QUESTION_PATTERNS dari Node.js, dikompilasi.

    Entri berbentuk {"__regex__": src, "flags": f} hasil serialisasi eksporter.
    """
    out: list[re.Pattern[str]] = []
    for item in _constants().get("PROPERTY_QUESTION_PATTERNS") or []:
        if not isinstance(item, dict) or "__regex__" not in item:
            continue
        flags = re.IGNORECASE if "i" in (item.get("flags") or "") else 0
        try:
            out.append(re.compile(item["__regex__"], flags))
        except re.error:
            # Segelintir pola JS bisa memakai sintaks yang tidak sah di Python.
            # Melewatinya lebih baik daripada gagal import seluruh gerbang —
            # dan harness paritas akan MENANGKAP bila ada yang benar-benar hilang.
            continue
    return tuple(out)


def _msg_text(msg: Any) -> str:
    if isinstance(msg, dict):
        return str(msg.get("message") or "")
    return str(getattr(msg, "message", "") or "")


def _msg_role(msg: Any) -> str:
    if isinstance(msg, dict):
        return str(msg.get("role") or "")
    return str(getattr(msg, "role", "") or "")


def is_in_property_flow(history: Sequence[Any] | None) -> bool:
    """True bila ≥2 pesan AI di history adalah pertanyaan properti."""
    if not history:
        return False

    count = 0
    for msg in history:
        if _msg_role(msg) not in _AI_ROLES:
            continue
        text = _msg_text(msg).lower()
        if any(p.search(text) for p in _question_patterns()):
            count += 1
            if count >= 2:
                return True
    return False


def has_recent_property_question(history: Iterable[Any] | None) -> bool:
    """Apakah ADA pertanyaan properti yang dikenali di potongan history ini?"""
    if not history:
        return False
    for msg in history:
        if _msg_role(msg) not in _AI_ROLES:
            continue
        text = _msg_text(msg).lower()
        if any(p.search(text) for p in _question_patterns()):
            return True
    return False


def last_ai_message_asks_question(history: Sequence[Any] | None) -> bool:
    """Apakah pesan AI TERAKHIR diakhiri pertanyaan (sinyal struktural, lemah)?

    Sengaja terpisah dari has_recent_property_question(): yang ini hanya tahu
    "AI mengakhiri dengan tanda tanya", tanpa tahu pertanyaannya soal properti.
    Gradasi kekuatan sinyal itu penting — lihat M88.

    ⚠️ Port `lastAiMessageAsksQuestion()`. Pola pembersih footer/tanda tangan
    HARUS identik dengan Node.js — mengubahnya mengubah sinyal M51.
    """
    if not history:
        return False
    last_ai = None
    for msg in history:
        if _msg_role(msg) in _AI_ROLES:
            last_ai = msg
    if last_ai is None:
        return False

    msg_text = _msg_text(last_ai)
    if not msg_text.strip():
        return False

    body = re.sub(r">\s*_?sent\s+via[^\n]*", "", msg_text, flags=re.IGNORECASE)
    body = re.sub(r"salam\s+hangat[\s\S]*$", "", body, flags=re.IGNORECASE).strip()

    if "?" in body:
        return True

    return bool(re.search(
        r"\b(boleh\s+(tahu|info|minta)|mohon\s+info|silakan\s+(sebut|pilih|info)|kira-kira|apakah|bagaimana|gimana)\b",
        body, re.IGNORECASE,
    ))


# ── M99 — isPropertyContextContinuation dan pendukungnya ───────────────────
# Konstanta module-level (DAILY_LIFE_OFFTOPIC, CLEAR_NON_PROPERTY, BANJIR_DAILY
# dkk, _LOCATION_FALLBACK) dimuat dari _gate_constants.json — TERBUKTI identik
# dengan Node.js lewat eksporter, bukan disalin tangan.
#
# ⚠️ TIGA kelompok konstanta di bawah TIDAK bisa diekspor otomatis: di Node.js
# ia dideklarasikan DI DALAM badan fungsi (bukan module scope), jadi eksporter
# (yang membaca lewat monkey-patch export module-level) tidak menjangkaunya.
# Ditranskripsi manual dengan hati-hati — DIVERIFIKASI lewat harness paritas
# (bukan dibaca-baca) sebelum dianggap benar:
#   • OBVIOUSLY_OFF_TOPIC (5 pola, di dalam isPropertyContextContinuation)
#   • REPETITION/IGNORED/GENERAL (di dalam detectCustomerFrustration)
#   • _IGNORE/_AFFIRM/_NEGATE token set (di dalam isPropertyContextContinuation)


def _compile_regex_obj(item: dict, default_flags: int = 0) -> re.Pattern[str]:
    flags = re.IGNORECASE if "i" in (item.get("flags") or "") else default_flags
    return re.compile(item["__regex__"], flags)


@lru_cache(maxsize=1)
def _daily_life_offtopic() -> tuple[re.Pattern[str], ...]:
    return tuple(_compile_regex_obj(item) for item in _constants().get("DAILY_LIFE_OFFTOPIC") or [])


@lru_cache(maxsize=1)
def _clear_non_property() -> tuple[re.Pattern[str], ...]:
    return tuple(_compile_regex_obj(item) for item in _constants().get("CLEAR_NON_PROPERTY") or [])


@lru_cache(maxsize=1)
def _banjir_daily() -> re.Pattern[str]:
    return _compile_regex_obj(_constants()["BANJIR_DAILY"])


@lru_cache(maxsize=1)
def _flood_avoid_preference() -> re.Pattern[str]:
    return _compile_regex_obj(_constants()["FLOOD_AVOID_PREFERENCE"])


@lru_cache(maxsize=1)
def _macet_daily() -> re.Pattern[str]:
    return _compile_regex_obj(_constants()["MACET_DAILY"])


@lru_cache(maxsize=1)
def _macet_avoid_preference() -> re.Pattern[str]:
    return _compile_regex_obj(_constants()["MACET_AVOID_PREFERENCE"])


@lru_cache(maxsize=1)
def _panas_avoid_preference() -> re.Pattern[str]:
    return _compile_regex_obj(_constants()["PANAS_AVOID_PREFERENCE"])


@lru_cache(maxsize=1)
def _location_fallback() -> tuple[str, ...]:
    return tuple(_list("_LOCATION_FALLBACK"))


# Cache runtime — mutable, diisi ulang oleh init_location_cache() saat startup
# (mirror Node initLocationCache()). Dimulai sebagai fallback statis.
_location_cache_list: list[str] = list(_location_fallback())


def location_cache() -> list[str]:
    """Daftar lokasi aktif — fallback statis, atau hasil DB bila sudah di-refresh."""
    return _location_cache_list


async def init_location_cache(db: Any) -> None:
    """Refresh cache lokasi dari tabel `cities` (status=1) — port `initLocationCache()`.

    ⚠️ DB CACHE MENAMBAH, TIDAK MENGGANTIKAN — nama dari DB didahulukan
    (diurutkan terpanjang dulu), fallback statis HANYA mengisi yang belum
    tercakup. Menggantikan total pernah membuat "Jakarta" tak dikenali begitu
    `cities` terisi tapi belum lengkap. Gagal-diam ke fallback statis bila
    query gagal — TIDAK PERNAH melempar, TIDAK PERNAH menggagalkan startup.
    """
    global _location_cache_list
    try:
        from sqlalchemy import select

        from app.models.master import City

        result = await db.execute(select(City.name).where(City.status == 1))
        names = sorted({str(n).lower().strip() for n in result.scalars() if n}, key=len, reverse=True)
        if not names:
            return

        covered = set(names)
        extras = [f for f in _location_fallback() if f not in covered]
        _location_cache_list = names + extras
        import logging

        logging.getLogger(__name__).info(
            "[LocationCache] %s kota dari DB (%s fallback extras).", len(names), len(extras)
        )
    except Exception as exc:  # noqa: BLE001
        import logging

        logging.getLogger(__name__).warning("[LocationCache] init_location_cache() gagal: %s", exc)


def is_daily_life_offtopic(lower: str) -> bool:
    """Obrolan harian non-properti (mati listrik, banjir, macet, dll)? Port `isDailyLifeOffTopic()`."""
    banjir_src = _banjir_daily().pattern
    macet_src = _macet_daily().pattern
    for pattern in _daily_life_offtopic():
        if not pattern.search(lower):
            continue
        if pattern.pattern == banjir_src and _flood_avoid_preference().search(lower):
            continue
        if pattern.pattern == macet_src and _macet_avoid_preference().search(lower):
            continue
        return True
    return False


@lru_cache(maxsize=1)
def _obviously_off_topic() -> tuple[re.Pattern[str], ...]:
    """5 pola function-scoped di Node.js — lihat catatan transkripsi manual di atas."""
    return (
        re.compile(r"\b(pesan\s+makanan|order\s+makanan|gofood|grabfood|shopeefood|mau\s+makan\s+di|lagi\s+di\s+restoran)\b", re.IGNORECASE),
        re.compile(r"\b(tiket\s+(pesawat|kereta|bus|kapal)|booking\s+tiket|paket\s+wisata|tur\s+wisata)\b", re.IGNORECASE),
        re.compile(r"\b(beli\s+(hp|laptop|iphone|gadget)|harga\s+(hp|laptop|iphone|samsung))\b", re.IGNORECASE),
        re.compile(r"\b(nonton\s+film|bioskop|tiket\s+konser|nonton\s+drakor)\b", re.IGNORECASE),
        re.compile(r"\b(resep\s+(masakan|kue)|cara\s+masak\s+|masak\s+(apa|gimana))\b", re.IGNORECASE),
    )


def _has_recent_property_question_in(recent_history: Sequence[Any]) -> bool:
    """Port `hasRecentPropertyQuestionIn()` — HANYA ≤2 pesan AI TERAKHIR dari potongan ini.

    ⚠️ BERBEDA dari has_recent_property_question() di atas (yang memeriksa
    SEMUA pesan AI di iterable yang diberikan, bukan cuma 2 terakhir) — dua
    fungsi Node.js berbeda dengan nama mirip, jangan disatukan.
    """
    last_ai = [m for m in recent_history if _msg_role(m) in _AI_ROLES][-2:]
    patterns = _question_patterns()
    return any(any(p.search(_msg_text(m).lower()) for p in patterns) for m in last_ai)


def detect_customer_frustration(message: str = "") -> dict[str, Any]:
    """Deteksi customer jengkel/mengeluh — port `detectCustomerFrustration()`."""
    t = str(message or "").lower()
    if not t.strip():
        return {"frustrated": False, "kind": None}

    repetition = (
        r"\b(udah|sudah|kan\s+udah|kan\s+sudah)\b.{0,20}\b(jawab|bilang|kasih\s+tau|sebut|info)",
        r"\b(ditanya|nanya|tanya)\b.{0,15}\b(terus|lagi|ulang|melulu|mulu|berkali|berulang)",
        r"\b(kok|kenapa|ngapain|napa)\b.{0,25}\b(ditanya|nanya|tanya|ulang)",
        r"\b(berapa\s+kali|dari\s+tadi|tadi\s+udah|itu\s+udah)\b",
        r"\b(muter|muter-muter|bolak-balik|balik\s+lagi|ulang\s+terus|loop)\b",
        r"\bpertanyaan\b.{0,15}\b(sama|itu|ulang|berulang)",
        r"\b(same|already)\s+(question|answered|told|said)\b",
        r"\bagain\b.{0,15}\b(asking|question)|\basking\b.{0,15}\bagain\b",
    )
    if any(re.search(p, t, re.IGNORECASE) for p in repetition):
        return {"frustrated": True, "kind": "repetition"}

    ignored = (
        r"\b(dibaca|baca\s+dong|baca\s+lah|dibaca\s+lah|gak\s+dibaca|tidak\s+dibaca|ga\s+baca)\b",
        r"\b(nyimak|simak|didengar|didengerin|dengerin|merhatiin|perhatiin)\b.{0,10}\b(gak|ga|nggak|tidak|dong)?",
        r"\b(gak|ga|nggak|tidak)\s+(nyambung|paham|ngerti|connect)\b",
        r"\b(read|listen)\b.{0,12}\b(please|properly)\b",
    )
    if any(re.search(p, t, re.IGNORECASE) for p in ignored):
        return {"frustrated": True, "kind": "ignored"}

    general = (
        r"\b(capek|cape|bosen|bosan|jengkel|kesal|kesel|sebel|ribet|lama\s+banget|lelet|payah|parah)\b",
        r"\b(gak|ga|nggak|tidak)\s+(jelas|beres|bener|profesional|membantu|guna)\b",
        r"\b(bot|robot)\b.{0,20}\b(gak|ga|nggak|tidak|bego|bodoh|error)\b",
        r"\b(useless|annoying|frustrating|ridiculous)\b",
    )
    if any(re.search(p, t, re.IGNORECASE) for p in general):
        return {"frustrated": True, "kind": "general"}

    return {"frustrated": False, "kind": None}


_IGNORE_TOKENS = frozenset(["kak", "ya", "yah", "iya", "dong", "deh", "aja", "saja", "sih", "kok", "nih", "loh", "lah", "banget", "sekali", "nya", "ya,", "dulu"])
_AFFIRM_TOKENS = frozenset(["ya", "iya", "iyaa", "ok", "oke", "okay", "okai", "sip", "siap", "boleh", "bisa", "mau", "setuju", "sepakat", "baik", "lanjut", "gas", "gaskan", "yup", "yoi", "yes", "show", "lihat", "tampilkan", "rekomendasikan", "silakan", "silahkan"])
_NEGATE_TOKENS = frozenset(["tidak", "belum", "ga", "gak", "nggak", "ngga", "blum", "blom", "enggak", "engga", "gamau", "gakmau", "nanti", "skip", "lewati", "lewat", "ada", "usah", "perlu"])


def is_property_context_continuation(message: str | None, history: Sequence[Any] | None = None) -> bool:
    """Port `isPropertyContextContinuation()` — jawaban singkat sebagai lanjutan Q-flow.

    ⚠️ Fungsi terpanjang dan paling kritis di gerbang — bertanggung jawab atas
    M51/M88 dan puluhan kasus lain. DIVERIFIKASI lewat harness paritas 1:1
    terhadap fungsi asli, urutan pengecekan dipertahankan PERSIS sama dengan
    Node.js (urutan menentukan hasil — early return).
    """
    history = history if history is not None else []
    if not message or not isinstance(message, str):
        return False
    if not history:
        return False

    lower = message.lower().strip()

    recent_history = list(history)[-6:]
    in_property_flow = is_in_property_flow(history)
    has_recent_property_q = _has_recent_property_question_in(recent_history)
    ai_just_asked = last_ai_message_asks_question(recent_history)

    if in_property_flow and detect_customer_frustration(message)["frustrated"]:
        return True

    if is_daily_life_offtopic(lower):
        return False

    is_scheduling_request = (
        bool(re.search(r"\b(viewing|site\s+visit|open\s+house|lihat\s+unit|lihat\s+rumah|lihat\s+properti)\b", lower, re.IGNORECASE))
        or (bool(re.search(r"\b(survey|survei)\b", lower, re.IGNORECASE)) and bool(re.search(r"\b(kapan|jadwal|bisa|mau|boleh|properti|rumah|unit)\b", lower, re.IGNORECASE)))
        or (bool(re.search(r"\b(jadwalkan|jadwal\s+kunjungan)\b", lower, re.IGNORECASE)) and bool(re.search(r"\b(properti|rumah|unit|viewing|survey|survei)\b", lower, re.IGNORECASE)))
    )

    has_property_facility = bool(re.search(
        r"\b(fasilitas|gym|fitness|kolam\s*renang|kolam|renang|parkir|garasi|carport|taman|playground|play\s*ground|kids?\s*zone|kids?\s*club|keamanan|cctv|ac|wifi|internet|lift|elevator|rooftop|balkon|balcony|view|pemandangan|clubhouse|sport|olahraga|water\s*heater|mushola|jogging|jacuzzi|bathtub|bak\s+mandi|yoga|sauna|steam|spa|dapur|kitchen|laundry|mesin\s+cuci|teras|terrace|shower|tennis|badminton|futsal|basket|barbecue|bbq|gerbang|smart\s+home|smart\s+tv|lemari|wardrobe|kasur|sofa|kompor|kulkas|springbed|dispenser|game\s+room|billiard|private\s+pool|infinity\s+pool|kolam\s+ikan|taman\s+bermain|genset|generator|security\s+guard|satpam|intercom|gate\s+system|one\s+gate|bar\s+lounge|wine\s+cellar)\b",
        lower, re.IGNORECASE,
    ))
    is_landmark_answer = bool(re.search(r"\b(dekat|deket|near|close\s+to|di\s+jalan|di\s+sekitar|samping|next\s+to|beside|sebelah)\b", lower, re.IGNORECASE))
    is_motivation_answer = bool(re.search(
        r"\b(pindah|pindahan|mutasi|relokasi|relocat|kontrak\s+(habis|abis)|ngontrak|keluarga\s+(nambah|bertambah)|nambah\s+anak|anak\s+(masuk|sekolah)|sekolah\s+anak|investasi|invest|disewakan|pensiun|menikah|nikah|kerja\s+baru|pindah\s+kerja|mutasi\s+kerja|menetap|growing\s+family|relocation|moving|job\s+(relocat|transfer)|dinas|perjalanan\s+dinas|ditugaskan|penugasan|tugas\s+(kerja|dinas|kantor)|kerja\s+(dinas|sementara|sebentar)|pindah\s+tugas|liburan|berlibur|vacation|holiday|staycation|wisata|honeymoon|bulan\s+madu|business\s+trip|work\s+trip|workation)\b",
        lower, re.IGNORECASE,
    ))
    is_preference_answer = bool(re.search(
        r"\b(jalan\s+(raya|lebar|besar|utama|kecil)|akses|access|strategis|hook|pojok|sudut|menghadap|hadap\s+(timur|barat|utara|selatan|matahari)|jalan\s+ramai|bising|tenang|sepi|ramai|rame|hidup|aman|nyaman|asri|sejuk|adem|dingin|rindang|pepohonan|pohon|hijau|teduh|gelap|terang|pencahayaan|panas|gerah|pengap)\b",
        lower, re.IGNORECASE,
    )) or bool(_flood_avoid_preference().search(lower)) or bool(_macet_avoid_preference().search(lower)) or bool(_panas_avoid_preference().search(lower))
    is_tower_floor_answer = (
        bool(re.search(r"\b(lantai|tower|penthouse)\b", lower, re.IGNORECASE))
        or bool(re.search(r"\b(hadap|menghadap|menghindari|hindari)\b.{0,30}\b(timur|barat|utara|selatan|matahari|sinar|terbit|terbenam|sunrise|sunset|silau|sore|pagi)\b", lower, re.IGNORECASE))
        or bool(re.search(r"\b(sinar\s+matahari|matahari\s+(terbit|terbenam)|sunrise|sunset)\b", lower, re.IGNORECASE))
    )
    is_amenity_vicinity = bool(re.search(r"\b(banyak|dekat|deket|near|area|kawasan|lingkungan|sekitar|deketan|berdekatan|akses\s+ke)\b", lower, re.IGNORECASE)) and bool(re.search(
        r"\b(cafe|kafe|resto|restoran|restaurant|warung|warteg|mall|plaza|kampus|sekolah|universitas|pasar|minimarket|indomaret|alfamart|rumah\s+sakit|stasiun|halte|terminal|tol|gym|taman|kantor)\b",
        lower, re.IGNORECASE,
    ))
    has_budget_answer = (
        bool(re.search(r"\b\d[\d.,]*\s*(?:-\s*\d[\d.,]*\s*)?(juta|jutaan|jt|ribu|rb|miliar|milyar)\b", lower, re.IGNORECASE))
        or bool(re.search(r"\brp\.?\s*\d", lower, re.IGNORECASE))
        or bool(re.search(r"\b\d{1,3}(?:[.,]\d{3}){2,}\b", lower))
    )
    has_negotiation_cue = bool(re.search(r"\b(nego|dinego|dinegokan|dinegosiasi|negosiasi|negotiable|nawar|ditawar|menawar|tawar[\s-]?menawar|kurang\s+harganya|harga\s+bisa\s+kurang|bisa\s+kurang)\b", lower, re.IGNORECASE))
    has_furnishing_answer = bool(re.search(
        r"\b(furnished|unfurnished|furnish|furnitur|furniture|semi[\s-]?furnish\w*|full[\s-]?furnish\w*|fully[\s-]?furnish\w*|kosongan|perabot(?:an)?|peralatan\s+(dapur|rumah|masak|elektronik)|lemari|ranjang|kasur|tempat\s+tidur|spring\s*bed|springbed|sofa|kompor|kulkas|mesin\s+cuci|dispenser|kitchen\s+set|wardrobe)\b",
        lower, re.IGNORECASE,
    ))
    has_condition_answer = bool(re.search(r"\b(second|bekas|inden|indent)\b", lower, re.IGNORECASE)) or bool(re.search(r"\bkondisi\s+(bagus|baik|prima|terawat|mulus|oke|ok|siap|baru|second|layak|ready)\b", lower, re.IGNORECASE))
    has_property_content = has_property_facility or is_landmark_answer or is_motivation_answer or is_preference_answer or is_amenity_vicinity or is_scheduling_request or is_tower_floor_answer
    has_budget_category = bool(re.search(r"\b(terjangkau|ekonomis|murah|termurah|hemat|menengah|sedang|standar|eksklusif|ekslusif|mewah|premium|luxur(y|ious)|mahal|kompetitif|competitive|low\s*budget|affordable|mid[\s-]*range|budget[\s-]*friendly|exclusive)\b", lower, re.IGNORECASE))
    has_strong_answer_cue = has_budget_answer or has_negotiation_cue or has_furnishing_answer or has_budget_category or has_condition_answer

    if not has_property_content and not has_strong_answer_cue and len(lower) > 70:
        return False
    if len(lower) > 200:
        return False

    if not has_property_content:
        if (has_recent_property_q or (in_property_flow and ai_just_asked)) and len(lower) <= 150:
            if any(p.search(lower) for p in _obviously_off_topic()):
                return False

            strong_enough_to_bypass = has_recent_property_q and in_property_flow
            if not strong_enough_to_bypass and any(p.search(lower) for p in _clear_non_property()):
                return False
            return True

        for pattern in _clear_non_property():
            if pattern.search(lower):
                return False

    if len(recent_history) >= 2:
        if re.match(r"^\d+\s*(hari|minggu|bulan|tahun|day|week|month|year)s?$", lower.strip()):
            return True
        if has_property_facility or is_landmark_answer or is_motivation_answer or is_scheduling_request or is_tower_floor_answer:
            return True

    has_property_ctx = any(has_property_keyword(_msg_text(item)) for item in history)
    if not has_property_ctx and not has_recent_property_q and not in_property_flow:
        return False

    if re.search(r"\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b", lower, re.IGNORECASE):
        return True
    if re.search(r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b", lower, re.IGNORECASE):
        return True
    if re.search(r"\b(jan|feb|mar|apr|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)\b", lower, re.IGNORECASE):
        return True
    if re.search(r"\b(tanggal|tgl)\s+\d{1,2}\b", lower, re.IGNORECASE):
        return True
    if re.search(r"\b(202[4-9]|203[0-9])\b", lower):
        return True
    if re.match(r"^(sewa|beli|jual|beli\s+aja|mau\s+sewa|mau\s+beli|untuk\s+sewa|untuk\s+beli|rent|buy|purchase)$", lower.strip()):
        return True
    if re.match(r"^\d+\s*(hari|minggu|bulan|tahun|day|week|month|year)s?$", lower.strip()):
        return True
    if re.search(r"\b\d[\d.,]*\s*(juta|ribu|miliar|rb|jt)\b", lower, re.IGNORECASE):
        return True
    if re.search(r"\b\d{1,3}(?:[.,]\d{3}){2,}\b", lower):
        return True
    if has_budget_category:
        return True
    if re.search(r"\b(belum\s+pernah\s+lihat|belum\s+pernah\s+survey|belum\s+pernah\s+cek|belum\s+pernah|pernah\s+lihat|sudah\s+lihat\s+\d|belum\s+lihat|sudah\s+survey|belum\s+ada\s+yang\s+cocok)\b", lower, re.IGNORECASE):
        return True
    if re.search(r"\b(breakfast|sarapan|makan\s+pagi|deluxe|suite|family\s+room|standard\s+room|check.?in|check.?out)\b", lower, re.IGNORECASE):
        return True

    if re.search(r"\b(sewa|beli|jual|beli\s+aja|mau\s+sewa|mau\s+beli|disewa|dibeli|rent|buy|purchase|sale)\b", lower):
        return True

    if re.search(r"\b(\d[\d.,]*\s*(juta|ribu|miliar|rb|jt|m|k|rupiah))\b", lower):
        return True
    if re.search(r"\b(di\s+bawah|max|maksimal|minimal|range|antara|sekitar|kurang\s+dari|lebih\s+dari)\b", lower) and re.search(r"\d", lower):
        return True

    for loc in location_cache():
        if loc in lower:
            return True
    if re.search(r"\b(di\s+\w+)\b", lower):
        return True

    toks = [t for t in re.sub(r"\s+", " ", re.sub(r"[.,!?…]+", " ", lower)).strip().split(" ") if t]
    core = [t for t in toks if t not in _IGNORE_TOKENS]
    if toks and not core:
        return True
    if core and all(t in _AFFIRM_TOKENS for t in core):
        return True
    if core and all(t in _NEGATE_TOKENS or t in _AFFIRM_TOKENS for t in core):
        return True

    if re.search(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", lower):
        return True
    last_ai_msg = None
    for m in history:
        if _msg_role(m) in _AI_ROLES:
            last_ai_msg = m
    if last_ai_msg is not None and re.search(
        r"boleh\s+(?:saya\s+)?tahu\s+nama|may\s+i\s+know\s+your\s+name|minta\s+(?:alamat\s+)?email",
        _msg_text(last_ai_msg), re.IGNORECASE,
    ):
        if re.match(r"^[a-z][a-z'.\s-]{1,40}$", lower.strip(), re.IGNORECASE) or re.search(r"\b(lewati|skip|tidak\s+usah|ga\s+usah)\b", lower, re.IGNORECASE):
            return True

    if re.search(r"\b(furnished|unfurnished|kosong|semi|ac|wifi|parkir|garasi|kolam|renang)\b", lower):
        return True
    if re.search(r"\b(fitted\s*[\s-]?out|bare\s*[\s-]?shell|siap\s+pakai|bangun\s+interior|inden|indent|ready\s*(stock)?|second|bekas|renovasi|kondisi\s+(baru|baik|apa\s*adanya))\b", lower, re.IGNORECASE):
        return True
    if re.search(r"\b(\d+\s*(kamar|km|lt|lb|m2|meter|lantai))\b", lower):
        return True
    if re.search(r"\b(besar|kecil|luas|sempit|bagus|mewah|sederhana|ekonomis|murah|mahal)\b", lower):
        return True

    if re.match(r"^\d+[\d.,]*$", lower.strip()):
        return True

    if re.search(r"\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b", lower, re.IGNORECASE):
        return True
    if re.search(r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b", lower, re.IGNORECASE):
        return True
    if re.search(r"\b(202[4-9]|203[0-9])\b", lower):
        return True

    if re.search(r"\b(\d+\s*(hari|minggu|bulan|tahun|day|week|month|year)s?)\b", lower, re.IGNORECASE):
        return True

    if re.search(r"\b(sendiri|sendiran|sendirian|aja|aj|saja|sama\s+\w+|dengan\s+\w+|bersama|keluarga|orang\s+tua|istri|suami|anak|ayah|ibu|orangtua)\b", lower, re.IGNORECASE):
        return True
    if re.match(r"^(iya|ya|setuju|baik|ok|boleh)[\s,]*\d+\s*(orang|person|orang\s+saja|orang\s+aja)$", lower, re.IGNORECASE):
        return True
    if re.search(r"\b(just\s+me|just\s+us|me\s+alone|family|husband|wife|children|kids|parents|siblings)\b", lower, re.IGNORECASE):
        return True

    if re.search(r"\b(furnish|ac\s+penuh|wifi|internet|kamar\s+mandi|parkir|garasi|kolam|renang|taman|keamanan|cctv|penjaga)\b", lower, re.IGNORECASE):
        return True

    if re.search(r"\b(dekat|deket|near|close\s+to|di\s+jalan|di\s+sekitar|samping|next\s+to|beside)\b", lower, re.IGNORECASE):
        return True

    if re.search(r"\b(daerah|area|kawasan|wilayah|kecamatan|kelurahan|district)\s+[a-z]", lower, re.IGNORECASE):
        return True

    if re.search(r"\b(bebas|fleksibel|flexible|terserah|tidak\s+masalah|ga\s+masalah|tidak\s+ada\s+preferensi|no\s+preference|whatever)\b", lower, re.IGNORECASE):
        return True

    if re.match(r"^(tidak|ga|gak|ngga|enggak|nggak|no)\s*(ada|masalah|preferensi|mau|perlu|usah|ingin|bisa|boleh|apa|tahu)?$", lower.strip(), re.IGNORECASE):
        return True
    if len(lower) <= 30 and re.match(r"^(saya\s+|aku\s+)?(tidak|ga|gak|ngga|enggak|engga|nggak|gak\s*mau|gamau|gakmau|nggamau|no)\b", lower.strip()):
        return True

    if re.search(r"\b(belum\s+pernah|pernah\s+lihat|sudah\s+lihat|belum\s+cocok|tidak\s+cocok|kurang\s+cocok|belum\s+ada\s+yang\s+cocok)\b", lower, re.IGNORECASE):
        return True

    if re.search(r"\b(jalan\s+(raya|lebar|besar|utama|kecil)|akses\s+(mudah|jalan|tol)|hook|pojok|sudut|menghadap|hadap\s+(timur|barat|utara|selatan|matahari)|bebas\s+banjir|tidak\s+banjir|jalan\s+ramai|bising)\b", lower, re.IGNORECASE):
        return True

    if is_preference_answer or is_amenity_vicinity:
        return True

    if re.search(r"\b(kpr|dp|cash|tunai|cicilan|angsuran|tenor|bunga|uang\s+muka|down\s+payment|kredit)\b", lower, re.IGNORECASE):
        return True

    if has_negotiation_cue:
        return True

    if is_scheduling_request:
        return True

    if len(lower) <= 40 and (
        re.search(r"\b(pagi|siang|sore|malam|subuh|petang)\b", lower, re.IGNORECASE)
        or re.search(r"\b(besok|lusa|nanti|hari\s+ini|sekarang|akhir\s+pekan|weekend)\b", lower, re.IGNORECASE)
        or re.search(r"\b(jam|pukul)\s*\d{1,2}", lower, re.IGNORECASE)
        or re.search(r"\b(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|ahad)\b", lower, re.IGNORECASE)
    ):
        return True

    if len(lower) <= 60 and re.search(
        r"\b(rekom|rekomendasi|rekomen|saran|sarankan|kasi|kasih|tolong|gimana|bagaimana|better|lebih\s+baik|yang\s+mana|mana\s+(yang|lebih)|pilih\s+mana|summar(y|ize|kan)|ringkas|simpulkan)\b",
        lower, re.IGNORECASE,
    ):
        return True

    if len(lower) <= 80 and "?" in lower and re.search(
        r"\b(apa|maksud|gimana|bagaimana|yang\s+mana|mana\s+yang|dimaksud|maksudnya|artinya|ini\s+apa|itu\s+apa)\b",
        lower,
    ):
        return True

    if len(lower) <= 70 and re.match(
        r"^(saya\s+|aku\s+)?(mau|ingin|pengen|prefer|butuh|perlu|suka|lebih\s+suka|maunya|yang|jangan|hindari|tidak\s+mau|gak\s+mau|ga\s+mau|nggak\s+mau|enggak\s+mau|engga\s+mau|gamau|gakmau|tanpa|tidak\s+include|tidak\s+termasuk)\b",
        lower.strip(), re.IGNORECASE,
    ):
        return True

    return False


def extract_location_from_message(message: str | None) -> str:
    """Port `extractLocationFromMessage()`."""
    if not message:
        return ""
    lower = message.lower()

    di_pattern = re.compile(
        r"\bdi\s+(?:daerah\s+|kawasan\s+|area\s+|kota\s+|wilayah\s+)?([a-z\s]{3,25})(?:\s+yang|\s+ada|\s+dong|\s+ya|\s+yg|\s+nih|\?|$|,)",
        re.IGNORECASE,
    )
    match = di_pattern.search(lower)
    if match:
        candidate = match.group(1).strip()
        cache = location_cache()

        # ⚠️ ARAH PENCOCOKAN (M110). Versi lama memakai `candidate in loc`, dan
        # karena cache diurutkan TERPANJANG DULU, "jakarta" cocok dengan
        # "jakarta selatan" — customer menulis "di Jakarta" lalu ringkasan
        # menyebut "Jakarta Selatan", sebuah kecamatan yang TIDAK PERNAH
        # mereka sebut. Menaikkan nama pendek menjadi nama yang lebih panjang
        # selalu berarti mengarang; yang benar hanya arah sebaliknya.
        if candidate in cache:
            return candidate

        # Nama kota yang BENAR-BENAR ada di dalam ucapan customer. Cache sudah
        # terurut terpanjang dulu, jadi "surabaya barat" menang atas "surabaya".
        for loc in cache:
            if loc in candidate:
                return loc

        # Awalan UNIK saja (toleransi salah ketik). Kalau ambigu — "jakart"
        # cocok ke 6 entri — lebih baik tidak menjawab dan biarkan AI bertanya
        # daripada menebak kecamatan yang salah.
        prefixed = [loc for loc in cache if loc.startswith(candidate)]
        if len(prefixed) == 1:
            return prefixed[0]

    for loc in location_cache():
        if loc in lower:
            return loc

    return ""


def extract_property_type_from_message(message: str | None) -> str:
    """Port `extractPropertyTypeFromMessage()`."""
    if not message:
        return ""
    lower = message.lower()

    checks: tuple[tuple[str, str], ...] = (
        (r"\b(apartemen|apartment|apt)\b", "apartment"),
        (r"\b(villa|vila)\b", "villa"),
        (r"\b(tanah|kavling|kapling|lahan)\b", "land"),
        (r"\b(ruko|shophouse|kios|toko|store)\b", "commercial"),
        (r"\b(kantor|office)\b", "office"),
        (r"\b(gudang|warehouse)\b", "warehouse"),
        (r"\b(hotel|motel|penginapan)\b", "hotel"),
        (r"\b(kost|kos|kosan|kostan|ngekos|ngekost|ngekosan|indekos|indekost|boarding)\b", "boarding_house"),
        (r"\b(rumah|house|perumahan|residensial)\b", "house"),
    )
    for pattern, kind in checks:
        if re.search(pattern, lower, re.IGNORECASE):
            return kind
    return ""


def extract_transaction_type_from_message(message: str | None) -> str:
    """Port `extractTransactionTypeFromMessage()`. 'booking' = sewa (lihat catatan Node.js)."""
    if not message:
        return ""
    lower = message.lower()

    if re.search(r"\b(sewa|rental|ngontrak|kontrak|disewakan|kost|kos|kosan|kostan|ngekos|ngekost|ngekosan|indekos|indekost|boarding|rent|lease|booking|book|reservasi|menginap|nginap|nginep)\b", lower, re.IGNORECASE):
        return "rent"
    if re.search(r"\b(beli|jual|dijual|purchase|buy|sell|kpr|inden|dp|cicilan|over kredit)\b", lower, re.IGNORECASE):
        return "sale"
    return ""


def is_post_summary_dormant(history: Sequence[Any] | None) -> bool:
    """Port `isPostSummaryDormant()` — AI dorman pasca-summary sampai query properti baru."""
    if not history:
        return False
    summary_re = re.compile(r"[✓✔]\s*Rencana\s*:", re.IGNORECASE)

    last_summary_idx = -1
    history_list = list(history)
    for i, m in enumerate(history_list):
        if _msg_role(m) in _AI_ROLES and summary_re.search(_msg_text(m)):
            last_summary_idx = i
    if last_summary_idx == -1:
        return False

    for m in history_list[last_summary_idx + 1:]:
        if _msg_role(m) in _CUST_ROLES and has_property_keyword(_msg_text(m)):
            return False
    return True


__all__ = [
    "has_property_keyword",
    "has_property_type",
    "has_action_word",
    "has_standalone_keyword",
    "is_in_property_flow",
    "has_recent_property_question",
    "last_ai_message_asks_question",
    "is_daily_life_offtopic",
    "detect_customer_frustration",
    "is_property_context_continuation",
    "location_cache",
    "init_location_cache",
    "extract_location_from_message",
    "extract_property_type_from_message",
    "extract_transaction_type_from_message",
    "is_post_summary_dormant",
]

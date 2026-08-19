"""Retrieval-Augmented Generation untuk Elevan Property (M101).

Menggabungkan tiga sumber:
  • `agent_catalog`  — 9.167 listing properti nyata dari tabel `properties`
  • `skill_docs`     — 268 chunk ATURAN dari `skills/chat_gpt_responds/`
  • `skill_cases`    — 641 chunk CONTOH DIALOG dari `Real-Estate/*.md`

`agent_catalog` dibangun Node.js (`scripts/build-rag-index.js`) lalu dikonversi
ke biner oleh `tools/build_rag_store.py` — Python TIDAK membuat embedding
katalog sendiri, jadi tidak ada biaya ganda DAN tidak ada risiko dua indeks
berbeda isi.

`skill_docs` (M108) dibangun Python: `tools/build_skill_docs_index.py`.
Versi Node lamanya hanya memuat 6 dari 14 berkas — 04-qualification-flow dan
05-answer-completeness (justru aturan "jangan tanya ulang") TIDAK ADA di
indeks, jadi mustahil di-retrieve — dan teksnya mojibake karena dibaca cp1252.

⚠️ `skill_docs` vs `skill_cases` sengaja TERPISAH: docs = aturan, cases =
contoh. Digabung dalam satu namespace, contoh dialog yang panjang dan kaya kata
akan mendominasi skor dan mendorong aturan keluar dari hasil teratas.

PENCARIAN HIBRIDA — dan kenapa bukan vektor saja (mengikuti pola
`Integra_Assistance/backend/app/services/rag_service.py` yang sudah terbukti):

1. **Embedding bisa mati.** Kuota habis / API key ditolak membuat pencarian
   vektor mengembalikan nol hasil — tepat saat sistem paling butuh konteks.
   Skor leksikal (BM25) dihitung sepenuhnya di dalam proses ini dan tidak
   pernah ikut mati.
2. **Kode & angka.** Vektor buruk mencocokkan token persis seperti "3 kamar",
   "160/200", "Rungkut", atau harga. Customer menyebut hal-hal itu apa adanya,
   dan BM25 justru unggul di sana.

Skor akhir = 0.65 × cosine + 0.35 × BM25 ternormalisasi. Bila embedding tidak
tersedia, bobot jatuh SEPENUHNYA ke BM25 (bukan tetap 0.65 — menahan bobot
vektor pada 0 akan memangkas semua skor jadi sepertiga dan membuat ambang
MIN_SCORE menyaring habis hasil yang sebenarnya relevan).

⚠️⚠️ ISOLASI ANTAR-AGENT ADALAH ATURAN KEAMANAN, BUKAN FILTER KENYAMANAN.
Namespace `agent_catalog` memuat listing MILIK BANYAK AGENT (6 agent, satu
database). Tanpa filter `user_id`, agent A akan merekomendasikan properti
milik agent B ke customernya sendiri. `retrieve_catalog()` MEWAJIBKAN
`agent_user_id` dan mengembalikan kosong bila tidak diberikan — fail-closed,
bukan fail-open.

FAIL-OPEN untuk sisanya: setiap kegagalan lain (indeks tidak ada, embedding
error) mengembalikan hasil kosong / string kosong = nol token tambahan =
perilaku persis seperti sebelum RAG ada. RAG TIDAK BOLEH bisa memutus
percakapan customer.
"""

from __future__ import annotations

import json
import logging
import math
import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from app.config import get_settings
from app.services.embedding_service import EmbeddingError, embed_query, is_available

logger = logging.getLogger(__name__)

STORE_DIR = Path(__file__).resolve().parents[1].parent / "data" / "rag"

NS_CATALOG = "agent_catalog"
NS_SKILL_DOCS = "skill_docs"
# Korpus Real-Estate/*.md — ratusan CONTOH percakapan nyata per tipe properti
# dan per kondisi customer (malas ketik, marah, bingung, …). Lihat M102.
NS_SKILL_CASES = "skill_cases"

VECTOR_WEIGHT = 0.65
LEXICAL_WEIGHT = 0.35

# Ambang minimal agar potongan tidak relevan tidak ikut masuk prompt.
# Konteks yang SALAH lebih merusak daripada tidak ada konteks: AI akan
# menjawab dengan percaya diri memakai bahan yang keliru.
MIN_SCORE = 0.18
DEFAULT_TOP_K = 4

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Kata terlalu umum untuk membedakan apa pun di korpus berbahasa Indonesia.
_STOPWORDS = frozenset("""
yang untuk dengan dari pada dan atau ini itu ada adalah akan bisa dapat saya kami
anda kamu kita mereka di ke dalam oleh sebagai juga tidak bukan sudah belum masih
mau ingin punya per buah unit apa apakah bagaimana berapa kapan siapa mana kak
the and for with from this that are was you your our their have has can will
""".split())


def tokenize(text: Any) -> list[str]:
    return [t for t in _TOKEN_RE.findall(str(text or "").lower())
            if t not in _STOPWORDS and len(t) > 1]


@dataclass
class RetrievedChunk:
    text: str
    score: float
    vector_score: float
    lexical_score: float
    metadata: dict[str, Any]


def build_query_text(customer_message: str, history: Any = None, turns: int = 3) -> str:
    """Susun teks kueri dari percakapan — port `buildQueryText()` Node.js.

    ⚠️ INI BUKAN OPTIMASI, INI PERBAIKAN BUG NYATA (ditemukan lewat uji
    end-to-end 15 Agu 2026). Meng-embed HANYA pesan terakhir membuat jawaban
    pendek kehilangan seluruh sinyal: "Belum pernah lihat, Kak. Ada rekomendasi
    yg cocok?" tidak memuat kota, budget, maupun tipe properti. Akibatnya
    retrieval mengembalikan listing acak, AI menyimpulkan "tidak ada yang
    cocok", dan customer kehilangan 2 rumah Surabaya yang SEBENARNYA ada di
    katalog agent (Rp 726 jt & Rp 679 jt, tepat di rentang yang diminta).
    Itu kegagalan yang terlihat seperti jawaban sopan — kelas bug paling mahal.

    Pesan sekarang DIULANG dua kali supaya bobotnya dominan, lalu beberapa
    giliran terakhir ikut sebagai konteks tipis. JANGAN memakai seluruh
    history: kueri terlalu panjang membuat embedding-nya "rata-rata" dan
    justru MENURUNKAN presisi.
    """
    current = str(customer_message or "").strip()
    recent_all = list(history or [])[-(turns * 2):]

    context_lines: list[str] = []
    for item in recent_all:
        if isinstance(item, dict):
            text = str(item.get("message") or item.get("content") or "").strip()
        else:
            text = str(getattr(item, "message", "") or "").strip()
        if text:
            context_lines.append(text)
    context_lines = context_lines[-turns:]

    parts = [p for p in ([current, current] + context_lines) if p]
    return "\n".join(parts)[:1500]


class _Namespace:
    """Satu namespace indeks: vektor float32 + teks + metadata."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.vectors: np.ndarray | None = None
        self.norms: np.ndarray | None = None
        self.entries: list[dict[str, Any]] = []
        self.model: str | None = None
        self._token_cache: list[list[str]] | None = None

    @property
    def ready(self) -> bool:
        return bool(self.entries)

    def load(self) -> None:
        vec_path = STORE_DIR / f"{self.name}.vectors.npy"
        norm_path = STORE_DIR / f"{self.name}.norms.npy"
        meta_path = STORE_DIR / f"{self.name}.meta.json"

        if not meta_path.exists():
            logger.warning(
                "[RAG] namespace '%s' belum dibangun (%s tidak ada). "
                "Jalankan: python tools/build_rag_store.py", self.name, meta_path.name,
            )
            return

        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            self.entries = meta.get("entries") or []
            self.model = meta.get("model")
            if vec_path.exists() and norm_path.exists():
                # mmap_mode='r' — vektor tetap di luar heap Python, dibaca
                # dari disk sesuai kebutuhan OS. 54 MB tidak ikut menaikkan
                # RSS proses secara permanen.
                self.vectors = np.load(vec_path, mmap_mode="r")
                self.norms = np.load(norm_path)
            logger.info("[RAG] '%s' dimuat: %s chunk (model %s)",
                        self.name, len(self.entries), self.model)
        except Exception as exc:  # noqa: BLE001
            # Fail-open: indeks rusak TIDAK boleh menggagalkan startup.
            logger.error("[RAG] gagal memuat namespace '%s': %s", self.name, exc)
            self.entries = []
            self.vectors = None

    def tokens(self) -> list[list[str]]:
        if self._token_cache is None:
            self._token_cache = [tokenize(e.get("text")) for e in self.entries]
        return self._token_cache


@lru_cache(maxsize=1)
def _store() -> dict[str, _Namespace]:
    store: dict[str, _Namespace] = {}
    for name in (NS_CATALOG, NS_SKILL_DOCS, NS_SKILL_CASES):
        ns = _Namespace(name)
        ns.load()
        store[name] = ns
    return store


def is_ready(namespace: str = NS_CATALOG) -> bool:
    return _store().get(namespace, _Namespace(namespace)).ready


def stats() -> dict[str, Any]:
    out: dict[str, Any] = {"enabled": get_settings().rag_enabled, "namespaces": {}}
    for name, ns in _store().items():
        out["namespaces"][name] = {
            "chunks": len(ns.entries),
            "model": ns.model,
            "vectors_loaded": ns.vectors is not None,
        }
    return out


class _BM25:
    """BM25 sederhana atas subset chunk yang sedang dipertimbangkan."""

    K1 = 1.5
    B = 0.75

    def __init__(self, docs: list[list[str]]) -> None:
        self.docs = docs
        self.doc_freq: Counter = Counter()
        for tokens in docs:
            self.doc_freq.update(set(tokens))
        self.total = len(docs) or 1
        self.avg_len = (sum(len(d) for d in docs) / self.total) or 1.0

    def score(self, query_tokens: list[str], index: int) -> float:
        tokens = self.docs[index]
        if not tokens or not query_tokens:
            return 0.0
        counts = Counter(tokens)
        length = len(tokens)
        total = 0.0
        for term in set(query_tokens):
            freq = counts.get(term, 0)
            if not freq:
                continue
            df = self.doc_freq[term]
            # IDF versi BM25+ — dijaga positif supaya term yang muncul di
            # hampir semua dokumen tidak menghasilkan skor negatif yang
            # menenggelamkan kecocokan lain pada dokumen yang sama.
            idf = math.log(1 + (self.total - df + 0.5) / (df + 0.5))
            denom = freq + self.K1 * (1 - self.B + self.B * length / self.avg_len)
            total += idf * (freq * (self.K1 + 1)) / denom
        return total


async def _retrieve(
    namespace: str,
    query: str,
    *,
    candidate_idx: list[int],
    top_k: int,
    min_score: float,
) -> list[RetrievedChunk]:
    ns = _store().get(namespace)
    if ns is None or not ns.ready or not candidate_idx:
        return []

    text = (query or "").strip()
    if not text:
        return []

    all_tokens = ns.tokens()
    subset_tokens = [all_tokens[i] for i in candidate_idx]

    # ── Skor leksikal — selalu dihitung, tidak pernah gagal ────────────────
    bm25 = _BM25(subset_tokens)
    q_tokens = tokenize(text)
    lex_raw = [bm25.score(q_tokens, i) for i in range(len(subset_tokens))]
    lex_max = max(lex_raw) if lex_raw and max(lex_raw) > 0 else 1.0
    lexical = [v / lex_max for v in lex_raw]

    # ── Skor vektor — hanya bila embedding tersedia ────────────────────────
    vector_scores = [0.0] * len(candidate_idx)
    have_vectors = False

    if is_available() and ns.vectors is not None:
        try:
            q_vec = np.asarray(await embed_query(text), dtype=np.float32)
            q_norm = float(np.linalg.norm(q_vec)) or 1.0
            subset = np.asarray(ns.vectors[candidate_idx], dtype=np.float32)
            subset_norms = ns.norms[candidate_idx] if ns.norms is not None else None
            dots = subset @ q_vec
            denom = (subset_norms if subset_norms is not None
                     else np.linalg.norm(subset, axis=1)) * q_norm
            denom[denom == 0] = 1.0
            vector_scores = np.clip(dots / denom, 0.0, None).tolist()
            have_vectors = True
        except EmbeddingError as exc:
            logger.warning("[RAG] embedding kueri gagal (%s) — memakai skor leksikal saja", exc)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[RAG] skor vektor gagal (%s) — memakai skor leksikal saja", exc)

    v_w = VECTOR_WEIGHT if have_vectors else 0.0
    l_w = LEXICAL_WEIGHT if have_vectors else 1.0

    scored: list[RetrievedChunk] = []
    for pos, entry_idx in enumerate(candidate_idx):
        entry = ns.entries[entry_idx]
        scored.append(RetrievedChunk(
            text=entry.get("text") or "",
            score=v_w * vector_scores[pos] + l_w * lexical[pos],
            vector_score=float(vector_scores[pos]),
            lexical_score=float(lexical[pos]),
            metadata=entry.get("metadata") or {},
        ))

    scored.sort(key=lambda c: c.score, reverse=True)
    return [c for c in scored if c.score >= min_score][:top_k]


def _price_of(meta: dict[str, Any]) -> float | None:
    try:
        raw = meta.get("price")
        if raw in (None, ""):
            return None
        return float(raw)
    except (TypeError, ValueError):
        return None


async def retrieve_catalog(
    query: str,
    agent_user_id: str,
    *,
    top_k: int = DEFAULT_TOP_K,
    min_score: float = MIN_SCORE,
    building_type: str | None = None,
    transaction_type: str | None = None,
    price_min: float | None = None,
    price_max: float | None = None,
) -> list[RetrievedChunk]:
    """Listing properti paling relevan MILIK AGENT INI SAJA.

    ⚠️ FAIL-CLOSED: `agent_user_id` kosong → kembalikan kosong. Tanpa ini,
    agent A bisa merekomendasikan properti agent B (lihat docstring modul).

    ⚠️ FILTER STRUKTURAL WAJIB ADA — kemiripan semantik TIDAK BISA menegakkan
    batasan keras. Terbukti lewat uji nyata (15 Agu 2026): customer meminta
    RUMAH 700-750 juta, retrieval murni semantik+BM25 mengembalikan APARTEMEN
    Rp 603 juta di peringkat teratas, dan AI menawarkannya seolah sesuai
    permintaan. Embedding menangkap "properti di Surabaya", bukan "tipe HARUS
    rumah" atau "harga HARUS di rentang itu" — batasan seperti itu hanya bisa
    ditegakkan dengan filter metadata SEBELUM pemeringkatan.

    Filter dipakai bila diberikan; `None` berarti "tidak dibatasi" (bukan
    "tidak cocok"), supaya percakapan yang belum menyebut tipe/budget tetap
    mendapat hasil.
    """
    if not str(agent_user_id or "").strip():
        logger.warning("[RAG] retrieve_catalog dipanggil TANPA agent_user_id — dikembalikan kosong")
        return []

    ns = _store().get(NS_CATALOG)
    if ns is None or not ns.ready:
        return []

    target = str(agent_user_id).strip()
    want_type = (building_type or "").strip().lower() or None
    want_txn = (transaction_type or "").strip().lower() or None

    candidates: list[int] = []
    for i, e in enumerate(ns.entries):
        meta = e.get("metadata") or {}
        if str(meta.get("user_id") or "").strip() != target:
            continue
        if want_type and str(meta.get("building_type") or "").strip().lower() != want_type:
            continue
        if want_txn and str(meta.get("transaction_type") or "").strip().lower() != want_txn:
            continue
        if price_min is not None or price_max is not None:
            price = _price_of(meta)
            # Listing tanpa harga TIDAK dibuang — harga kosong bukan berarti
            # di luar anggaran, dan membuangnya menyembunyikan properti yang
            # mungkin justru paling cocok.
            if price is not None:
                if price_min is not None and price < price_min:
                    continue
                if price_max is not None and price > price_max:
                    continue
        candidates.append(i)

    if not candidates:
        logger.info(
            "[RAG] tidak ada listing untuk agent %s dengan filter "
            "(tipe=%s, transaksi=%s, harga=%s..%s)",
            target, want_type, want_txn, price_min, price_max,
        )
        return []

    return await _retrieve(NS_CATALOG, query, candidate_idx=candidates,
                           top_k=top_k, min_score=min_score)


async def retrieve_skill_reference(
    query: str, *, top_k: int = 2, min_score: float = MIN_SCORE,
) -> list[RetrievedChunk]:
    """Referensi perilaku (playbook tipe properti, tabel fasilitas/landmark).

    ⚠️ HANYA dokumen REFERENSI. Aturan inti (never-invent, satu pertanyaan
    per pesan, state block) TIDAK PERNAH lewat RAG — retrieval bisa meleset,
    dan aturan itu tidak boleh hilang bahkan sekali pun.
    """
    ns = _store().get(NS_SKILL_DOCS)
    if ns is None or not ns.ready:
        return []
    return await _retrieve(NS_SKILL_DOCS, query,
                           candidate_idx=list(range(len(ns.entries))),
                           top_k=top_k, min_score=min_score)


def format_catalog_for_prompt(chunks: list[RetrievedChunk]) -> str:
    """Rangkai listing jadi blok DATA yang aman ditempel ke prompt."""
    if not chunks:
        return ""
    lines = [
        "LISTING NYATA DARI KATALOG AGENT (satu-satunya properti yang boleh Anda sebut):",
    ]
    for i, c in enumerate(chunks, 1):
        meta = c.metadata or {}
        pid = meta.get("property_id") or "-"
        lines.append(f"[{i}] (id:{pid}) {c.text.strip()}")
    lines.append("")
    lines.append(
        "⚠️ JANGAN menyebut properti di luar daftar di atas. Bila tidak ada yang cocok, "
        "katakan apa adanya dan tawarkan mencarikan — JANGAN mengarang listing, harga, "
        "atau nama area."
    )
    lines.append(
        "⚠️ Daftar di atas adalah kandidat TERDEKAT, belum tentu memenuhi semua permintaan. "
        "Periksa sendiri tipe dan harganya sebelum menawarkan: bila harganya di LUAR "
        "anggaran customer atau tipenya berbeda dari yang diminta, KATAKAN TERUS TERANG "
        "('yang paling dekat ada di angka X, sedikit di atas budget Kak') — JANGAN "
        "menyajikannya seolah-olah sudah sesuai permintaan."
    )
    return "\n".join(lines)


async def retrieve_skill_cases(
    query: str,
    *,
    property_type: str | None = None,
    transaction_type: str | None = None,
    style: str | None = None,
    top_k: int = 3,
    min_score: float = 0.12,
) -> list[RetrievedChunk]:
    """Contoh percakapan NYATA yang paling mirip situasi saat ini (M102).

    Inilah inti perbaikan "LLM terasa kaku": model tidak disuruh "jadi ramah",
    melainkan DIBERI CONTOH bagaimana agen menjawab customer serupa — termasuk
    customer yang malas ketik, bingung, atau marah.

    Filter `property_type`/`transaction_type` dipakai bila diketahui; `style`
    ("lazy"/"angry"/"unsure"/…) memprioritaskan contoh dengan kondisi customer
    yang sama. Ambang skor SENGAJA lebih rendah dari katalog (0.12 vs 0.18):
    contoh gaya bicara tetap berguna walau topiknya tidak persis sama, dan
    risikonya kecil — ini bahan GAYA, bukan fakta yang bisa salah dikutip.
    """
    ns = _store().get(NS_SKILL_CASES)
    if ns is None or not ns.ready:
        return []

    want_type = (property_type or "").strip().lower() or None
    want_txn = (transaction_type or "").strip().lower() or None

    candidates: list[int] = []
    for i, e in enumerate(ns.entries):
        meta = e.get("metadata") or {}
        etype = str(meta.get("property_type") or "any").lower()
        etxn = str(meta.get("transaction_type") or "any").lower()
        # "any" cocok dengan apa pun — dokumen lintas-tipe (mis. panduan
        # kelengkapan jawaban) harus tetap bisa terambil.
        if want_type and etype not in ("any", want_type):
            continue
        if want_txn and etxn not in ("any", want_txn):
            continue
        candidates.append(i)

    if not candidates:
        candidates = list(range(len(ns.entries)))

    hits = await _retrieve(NS_SKILL_CASES, query, candidate_idx=candidates,
                           top_k=top_k * 2, min_score=min_score)

    if style:
        # Contoh dengan kondisi customer yang sama didahulukan, tapi TIDAK
        # menyaring habis yang lain — relevansi topik tetap berbobot.
        want = style.strip().lower()
        hits.sort(key=lambda h: (want not in (h.metadata or {}).get("styles", []), -h.score))
    return hits[:top_k]


def format_skill_cases_for_prompt(chunks: list[RetrievedChunk]) -> str:
    """Contoh few-shot — DIBERI LABEL TEGAS sebagai contoh gaya, bukan data.

    ⚠️ Label ini penting: tanpa itu model bisa mengutip ANGKA dari contoh
    (mis. "1,5 juta/malam" di CASE Bali) seolah-olah itu listing nyata milik
    agent. Contoh hanya boleh ditiru CARA BICARANYA.
    """
    if not chunks:
        return ""
    lines = [
        "CONTOH GAYA PERCAKAPAN (dari panduan internal — TIRU CARA BICARANYA, "
        "JANGAN tiru angka/lokasi/propertinya):",
    ]
    for i, c in enumerate(chunks, 1):
        meta = c.metadata or {}
        label = meta.get("case") or meta.get("source") or f"contoh {i}"
        lines.append(f"--- Contoh {i}: {label} ---")
        lines.append(c.text.strip()[:1600])
    lines.append(
        "--- akhir contoh ---\n"
        "⚠️ Angka, kota, dan nama properti di contoh di atas HANYA ilustrasi gaya. "
        "Fakta yang boleh Anda sebut ke customer HANYA dari blok LISTING."
    )
    return "\n".join(lines)


def format_reference_for_prompt(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return ""
    lines = ["REFERENSI INTERNAL (panduan gaya/pengetahuan — jangan dikutip mentah):"]
    for c in chunks:
        lines.append(c.text.strip()[:800])
    return "\n".join(lines)


__all__ = [
    "retrieve_catalog", "retrieve_skill_reference",
    "format_catalog_for_prompt", "format_reference_for_prompt",
    "is_ready", "stats", "RetrievedChunk", "tokenize",
    "NS_CATALOG", "NS_SKILL_DOCS",
]

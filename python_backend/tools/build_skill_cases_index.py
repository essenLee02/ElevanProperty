"""Indeks RAG untuk korpus skill Real-Estate (M102).

SUMBER: `Real-Estate/*.md` — 26 berkas, ~14.600 baris, memuat RATUSAN contoh
percakapan nyata per tipe properti (rumah, apartemen, hotel, villa, kos, ruko,
kantor, gudang, toko, mansion, kondotel, lainnya) × (sewa/beli/booking) ×
kondisi customer (normal, MALAS KETIK, info terbatas, marah, ganti-ganti,
first-timer, WA singkat).

⚠️ KENAPA POTONGAN = SATU "CASE", BUKAN N KARAKTER:
Setiap blok `### CASE ...` adalah SATU percakapan utuh dari pembuka sampai
ringkasan. Memotongnya per-700-karakter akan membelah dialog di tengah —
dan potongan setengah dialog persis jenis bahan yang membuat model meniru
pola yang salah (menjawab tanpa konteks, atau meniru ringkasan tanpa
pertanyaannya). Batas CASE dijaga UTUH supaya model belajar ALUR-nya, bukan
sekadar kalimatnya.

Chunk ini dipakai sebagai CONTOH FEW-SHOT saat menyusun balasan — inilah
jawaban langsung atas keluhan "LLM-nya kaku seperti chatbot": model tidak
diberi tahu "jadilah ramah", melainkan DIBERI CONTOH NYATA bagaimana agen
manusia menjawab customer yang malas ketik, bingung, atau marah.

Jalankan:  .venv\\Scripts\\python.exe tools/build_skill_cases_index.py
Keluaran:  python_backend/data/rag/skill_cases.{vectors.npy,norms.npy,meta.json}
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path

import numpy as np

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # pragma: no cover
        pass

PY_BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PY_BACKEND))

PROJECT_ROOT = PY_BACKEND.parent
SRC_DIR = PROJECT_ROOT / "Real-Estate"
OUT_DIR = PY_BACKEND / "data" / "rag"
NAMESPACE = "skill_cases"

# Batas atas per chunk. CASE yang lebih panjang dari ini dipotong di batas
# baris (bukan tengah kalimat) — jarang terjadi, tapi menjaga biaya embedding.
MAX_CHARS = 2400

_CASE_RE = re.compile(r"^#{2,4}\s+CASE\b", re.IGNORECASE)
_HEADING_RE = re.compile(r"^#{1,4}\s+(.*)$")

# Tipe properti diturunkan dari NAMA BERKAS, bukan ditebak dari isi — nama
# berkas sudah eksplisit (01_SKILL_HOUSE_RUMAH.md) dan itu label paling andal
# untuk memfilter contoh sesuai tipe yang sedang dibicarakan customer.
_TYPE_BY_PREFIX = {
    "01": "house", "02": "apartment", "03": "hotel", "04": "villa",
    "05": "boarding_house", "06": "shophouse", "07": "office", "08": "warehouse",
    "09": "store", "10": "mansion", "11": "condo", "12": "others",
    "00": "any", "EL": "any",
}


def detect_type(filename: str) -> str:
    return _TYPE_BY_PREFIX.get(filename[:2].upper(), "any")


def detect_transaction(text: str) -> str:
    """Sewa / beli / booking dari isi CASE. 'any' bila tidak tegas."""
    low = text.lower()
    rent = len(re.findall(r"\b(sewa|ngekos|kontrak|disewakan|rental)\b", low))
    buy = len(re.findall(r"\b(beli|jual|dijual|kpr|cash|investasi)\b", low))
    book = len(re.findall(r"\b(booking|menginap|check.?in|per malam|malam)\b", low))
    best = max(rent, buy, book)
    if best == 0:
        return "any"
    if best == book and book > rent:
        return "booking"
    return "rent" if rent >= buy else "sale"


def detect_customer_style(text: str) -> list[str]:
    """Label kondisi customer — dipakai memilih contoh yang relevan.

    Diambil dari JUDUL case (mis. "| Malas Ketik", "| Marah") yang memang
    sudah ditulis eksplisit di korpus — bukan hasil terkaan.
    """
    low = text.lower()
    styles: list[str] = []
    if re.search(r"malas ketik|wa singkat|singkat", low):
        styles.append("lazy")
    if re.search(r"marah|frustrasi|kesal", low):
        styles.append("angry")
    if re.search(r"info terbatas|tidak tahu|bingung|first.?tim|pertama kali", low):
        styles.append("unsure")
    if re.search(r"ganti-ganti|ganti lokasi", low):
        styles.append("changing")
    if re.search(r"tanya harga|tanya roi|tanya kpr|tanya legalitas", low):
        styles.append("asking_price")
    return styles or ["normal"]


def split_cases(text: str, source: str) -> list[dict]:
    """Pecah satu berkas menjadi chunk per-CASE, batas CASE dijaga utuh."""
    lines = text.splitlines()
    chunks: list[dict] = []

    current: list[str] = []
    current_title = ""
    doc_title = source

    def flush() -> None:
        if not current:
            return
        body = "\n".join(current).strip()
        if len(body) < 40:  # potongan terlalu pendek tidak informatif
            return
        for piece in _hard_split(body):
            chunks.append({
                "text": f"[{doc_title} > {current_title or 'umum'}]\n{piece}",
                "metadata": {
                    "source": source,
                    "case": current_title or "umum",
                    "property_type": detect_type(source),
                    "transaction_type": detect_transaction(piece),
                    "styles": detect_customer_style(f"{current_title} {piece}"),
                },
            })

    for line in lines:
        heading = _HEADING_RE.match(line)
        if heading and _CASE_RE.match(line):
            flush()
            current = [line]
            current_title = heading.group(1).strip()
            continue
        if heading and not current:
            # Judul dokumen / bagian sebelum CASE pertama.
            if line.startswith("# "):
                doc_title = heading.group(1).strip()
        current.append(line)

    flush()
    return chunks


def _hard_split(body: str) -> list[str]:
    if len(body) <= MAX_CHARS:
        return [body]
    out: list[str] = []
    buf: list[str] = []
    size = 0
    for line in body.splitlines():
        if size + len(line) + 1 > MAX_CHARS and buf:
            out.append("\n".join(buf))
            buf, size = [], 0
        buf.append(line)
        size += len(line) + 1
    if buf:
        out.append("\n".join(buf))
    return out


async def main() -> int:
    if not SRC_DIR.exists():
        print(f"❌ Folder tidak ditemukan: {SRC_DIR}")
        return 1

    files = sorted(SRC_DIR.glob("*.md"))
    if not files:
        print(f"❌ Tidak ada berkas .md di {SRC_DIR}")
        return 1

    print(f"Memindai {len(files)} berkas di {SRC_DIR.name}/ ...")
    all_chunks: list[dict] = []
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        chunks = split_cases(text, path.name)
        all_chunks.extend(chunks)
        print(f"  {path.name:48} {len(chunks):>4} chunk")

    print(f"\nTotal {len(all_chunks)} chunk. Membuat embedding...")

    from app.services.embedding_service import embed_texts, is_available

    if not is_available():
        print("❌ CHAT_GPT_API_KEY kosong — embedding tidak bisa dibuat.")
        return 1

    # ⚠️ SATU panggilan per BATCH, bukan per chunk. Versi awal mengirim satu
    # teks per permintaan (641 round-trip) dan MACET di ~100 chunk karena rate
    # limit — diukur langsung, bukan dugaan. Endpoint embeddings menerima array.
    try:
        vectors = await embed_texts([c["text"] for c in all_chunks])
    except Exception as exc:  # noqa: BLE001
        print(f"❌ Embedding gagal: {exc}")
        return 1

    keep = [(c, v) for c, v in zip(all_chunks, vectors) if v]
    if not keep:
        print("❌ Tidak ada embedding yang berhasil.")
        return 1

    arr = np.asarray([v for _, v in keep], dtype=np.float32)
    norms = np.linalg.norm(arr, axis=1).astype(np.float32)
    norms[norms == 0] = 1.0

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    np.save(OUT_DIR / f"{NAMESPACE}.vectors.npy", arr)
    np.save(OUT_DIR / f"{NAMESPACE}.norms.npy", norms)
    (OUT_DIR / f"{NAMESPACE}.meta.json").write_text(
        json.dumps({
            "model": "text-embedding-3-small",
            "entries": [{"id": f"{NAMESPACE}:{i}", "text": c["text"], "metadata": c["metadata"]}
                        for i, (c, _) in enumerate(keep)],
        }, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"\n✅ {len(keep)}/{len(all_chunks)} chunk tersimpan ke {OUT_DIR.name}/{NAMESPACE}.*")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

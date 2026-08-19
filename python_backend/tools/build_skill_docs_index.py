"""Indeks RAG untuk DOKUMEN ATURAN skill (M108).

SUMBER: `skills/chat_gpt_responds/` — SKILL.md + docs/01..13 (14 berkas).

⚠️ KENAPA HANYA SATU FOLDER DARI TIGA:
`skills/claude_responds/docs/*` BYTE-IDENTIK dengan `chat_gpt_responds/docs/*`
(hanya SKILL.md yang beda), dan `elevan-property-assistant` adalah varian nyaris
sama untuk diunggah ke platform OpenAI. Mengindeks ketiganya membuat setiap
aturan muncul 3x di kandidat retrieval: tiga slot teratas terisi kalimat yang
sama, dan aturan lain yang relevan justru terdorong keluar. Satu folder
kanonik dipakai — `chat_gpt_responds`, karena itulah yang menjadi acuan runtime
provider aktif (DeepSeek/Kimi/Qwen). Dedup hash tetap dipasang sebagai jaring
pengaman kalau isinya berubah dan tidak lagi identik.

⚠️ DUA CACAT INDEKS LAMA YANG DIPERBAIKI DI SINI:
  1. HANYA 6 dari 14 berkas terindeks (07,08,10,11,12,13). Yang HILANG justru
     04-qualification-flow (73KB, urutan Q1–Q14) dan 05-answer-completeness —
     dua dokumen yang persis mengatur "jangan tanya ulang yang sudah dijawab".
     Aturan anti-repetisi tidak pernah bisa di-retrieve karena tidak ada.
  2. Teksnya MOJIBAKE: "07 <?> Property-Type" — berkas dibaca sebagai cp1252,
     jadi em-dash rusak. Embedding dibuat dari teks rusak itu.
     Di sini semua dibaca eksplisit sebagai UTF-8.

BEDA DENGAN `skill_cases`: cases = CONTOH DIALOG (few-shot, "beginilah cara
menjawab"); docs = ATURAN ("inilah yang wajib/dilarang"). Keduanya di-retrieve
terpisah supaya contoh tidak menggeser aturan keluar dari konteks.

Jalankan:  .venv\\Scripts\\python.exe tools/build_skill_docs_index.py
Keluaran:  python_backend/data/rag/skill_docs.{vectors.npy,norms.npy,meta.json}
"""

from __future__ import annotations

import asyncio
import hashlib
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
SRC_DIR = PROJECT_ROOT / "skills" / "chat_gpt_responds"
OUT_DIR = PY_BACKEND / "data" / "rag"
NAMESPACE = "skill_docs"

MAX_CHARS = 2400
MIN_CHARS = 60

_HEADING_RE = re.compile(r"^(#{1,4})\s+(.*)$")

# Tag topik dipakai sebagai pra-filter saat retrieval (mis. giliran yang sedang
# menanyakan slot cukup mengambil aturan Q-flow, bukan referensi fasilitas).
_TOPIC_BY_FILE = {
    "SKILL.md": ["overview"],
    "01": ["style", "role"],
    "02": ["language", "intent"],
    "03": ["memory", "session"],
    "04": ["qualification", "questions", "anti_repeat"],
    "05": ["completeness", "anti_repeat", "reask"],
    "06": ["customer_condition", "diagnosis"],
    "07": ["property_type", "playbook"],
    "08": ["catalog", "recommendation"],
    "09": ["offtopic", "escalation"],
    "10": ["parsing", "date", "money"],
    "11": ["house_pilot"],
    "12": ["facilities"],
    "13": ["location", "landmark"],
}


def topics_for(filename: str) -> list[str]:
    return _TOPIC_BY_FILE.get(filename, _TOPIC_BY_FILE.get(filename[:2], ["general"]))


def split_sections(text: str, source: str) -> list[dict]:
    """Pecah per heading. Batas potong = heading, bukan hitungan karakter.

    Memotong per-N-karakter di dokumen aturan berbahaya: satu aturan bisa
    terbelah dari pengecualiannya, sehingga model me-retrieve "lakukan X"
    tanpa "kecuali bila Y".
    """
    lines = text.splitlines()
    doc_title = source
    chunks: list[dict] = []

    current: list[str] = []
    breadcrumb: list[str] = []       # [judul H2, judul H3]
    current_crumb = ""

    def flush() -> None:
        if not current:
            return
        body = "\n".join(current).strip()
        if len(body) < MIN_CHARS:
            return
        crumb = f"{doc_title}" + (f" > {current_crumb}" if current_crumb else "")
        for piece in _hard_split(body):
            chunks.append({
                "text": f"[{crumb}]\n{piece}",
                "metadata": {
                    "source": source,
                    "breadcrumb": crumb,
                    "kind": "skill_reference",
                    "topics": topics_for(source),
                },
            })

    for line in lines:
        h = _HEADING_RE.match(line)
        if h:
            level, title = len(h.group(1)), h.group(2).strip()
            if level == 1 and not current:
                doc_title = title
                current.append(line)
                continue
            if level >= 2:
                flush()
                current = [line]
                if level == 2:
                    breadcrumb = [title]
                else:
                    breadcrumb = (breadcrumb[:1] + [title]) if breadcrumb else [title]
                current_crumb = " > ".join(breadcrumb)
                continue
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


def collect_files() -> list[Path]:
    files: list[Path] = []
    skill = SRC_DIR / "SKILL.md"
    if skill.exists():
        files.append(skill)
    files.extend(sorted((SRC_DIR / "docs").glob("*.md")))
    return files


async def main() -> int:
    if not SRC_DIR.exists():
        print(f"❌ Folder tidak ditemukan: {SRC_DIR}")
        return 1

    files = collect_files()
    if not files:
        print(f"❌ Tidak ada berkas .md di {SRC_DIR}")
        return 1

    print(f"Memindai {len(files)} berkas di skills/{SRC_DIR.name}/ ...")
    all_chunks: list[dict] = []
    seen: set[str] = set()
    dupes = 0

    for path in files:
        # UTF-8 EKSPLISIT — indeks lama rusak justru karena ini tidak dilakukan.
        text = path.read_text(encoding="utf-8", errors="replace")
        chunks = split_sections(text, path.name)
        kept = 0
        for c in chunks:
            digest = hashlib.sha1(c["text"].encode("utf-8")).hexdigest()
            if digest in seen:
                dupes += 1
                continue
            seen.add(digest)
            all_chunks.append(c)
            kept += 1
        print(f"  {path.name:42} {kept:>4} chunk")

    if dupes:
        print(f"  ({dupes} chunk duplikat dilewati)")

    # Cek mojibake: kalau masih ada U+FFFD, sumbernya memang bukan UTF-8 valid
    # dan itu harus terlihat SEKARANG, bukan setelah embedding dibayar.
    bad = [c["metadata"]["source"] for c in all_chunks if "�" in c["text"]]
    if bad:
        print(f"⚠️  {len(bad)} chunk masih memuat karakter rusak (U+FFFD): "
              f"{sorted(set(bad))[:5]}")

    print(f"\nTotal {len(all_chunks)} chunk. Membuat embedding...")

    from app.services.embedding_service import embed_texts, is_available

    if not is_available():
        print("❌ CHAT_GPT_API_KEY kosong — embedding tidak bisa dibuat.")
        return 1

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
            "source": f"skills/{SRC_DIR.name}",
            "entries": [{"id": f"{NAMESPACE}:{i}", "text": c["text"], "metadata": c["metadata"]}
                        for i, (c, _) in enumerate(keep)],
        }, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"\n✅ {len(keep)}/{len(all_chunks)} chunk tersimpan ke "
          f"{OUT_DIR.name}/{NAMESPACE}.*")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

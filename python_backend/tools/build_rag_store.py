"""Konversi indeks RAG Node.js → penyimpanan biner ringkas untuk Python (M101).

KENAPA ADA KONVERSI, BUKAN LANGSUNG BACA JSON-NYA:
`backend/data/rag-index.json` berukuran **295 MB** dan butuh **9,3 detik**
hanya untuk di-parse (diukur langsung, bukan diperkirakan) — setiap kali
proses start, ditambah ratusan MB RAM karena setiap float jadi objek Python.
Disimpan ulang sebagai float32 biner: ~56 MB, dimuat <1 detik lewat memmap,
dan RAM-nya tetap di luar heap Python.

⚠️ INDEKS TETAP MILIK NODE.js. Skrip ini TIDAK membuat embedding baru — ia
hanya mengubah format indeks yang SUDAH dibangun `node scripts/build-rag-index.js`.
Jadi tidak ada biaya embedding tambahan, dan TIDAK ADA RISIKO dua indeks
berbeda isi (kelas desync yang berulang menggigit proyek ini). Jalankan ulang
skrip ini setiap kali indeks Node.js dibangun ulang.

Jalankan:  .venv\\Scripts\\python.exe tools/build_rag_store.py
Keluaran:  python_backend/data/rag/<namespace>.{vectors.npy,meta.json}
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # pragma: no cover
        pass

PY_BACKEND = Path(__file__).resolve().parents[1]
PROJECT_ROOT = PY_BACKEND.parent
SRC = PROJECT_ROOT / "backend" / "data" / "rag-index.json"
OUT_DIR = PY_BACKEND / "data" / "rag"


def main() -> int:
    if not SRC.exists():
        print(f"❌ Indeks Node.js tidak ditemukan: {SRC}")
        print("   Jalankan dulu: cd backend && node scripts/build-rag-index.js")
        return 1

    print(f"Membaca {SRC.name} ({SRC.stat().st_size / 1024 / 1024:.0f} MB)...")
    t0 = time.time()
    with SRC.open(encoding="utf-8") as fh:
        data = json.load(fh)
    print(f"  parse: {time.time() - t0:.1f} detik")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = 0

    for namespace, payload in (data.get("namespaces") or {}).items():
        entries = payload.get("entries") or []
        if not entries:
            print(f"  (lewati {namespace} — kosong)")
            continue

        vectors = np.asarray([e["vector"] for e in entries], dtype=np.float32)
        # Norma dihitung SEKALI di sini, bukan setiap query untuk setiap
        # chunk — itu pekerjaan identik berulang yang mendominasi waktu
        # pencarian begitu korpus bertambah.
        norms = np.linalg.norm(vectors, axis=1).astype(np.float32)
        norms[norms == 0] = 1.0  # hindari bagi-nol pada vektor kosong

        meta = [
            {
                "id": e.get("id"),
                "text": e.get("text") or "",
                "metadata": e.get("metadata") or {},
            }
            for e in entries
        ]

        np.save(OUT_DIR / f"{namespace}.vectors.npy", vectors)
        np.save(OUT_DIR / f"{namespace}.norms.npy", norms)
        (OUT_DIR / f"{namespace}.meta.json").write_text(
            json.dumps({"model": payload.get("model"), "entries": meta}, ensure_ascii=False),
            encoding="utf-8",
        )

        size_mb = (OUT_DIR / f"{namespace}.vectors.npy").stat().st_size / 1024 / 1024
        print(f"  ✅ {namespace:20} {len(entries):>6} chunk  dim={vectors.shape[1]}  {size_mb:.0f} MB")
        total += len(entries)

    print(f"\nSelesai — {total} chunk tersimpan di {OUT_DIR.relative_to(PROJECT_ROOT)}")
    print("Jalankan ulang skrip ini setiap kali `node scripts/build-rag-index.js` dijalankan.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

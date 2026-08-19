"""Harness paritas Node.js ↔ Python.

Menjalankan fixture yang SAMA lewat kedua implementasi dan menuntut keluaran
IDENTIK. Ini alat utama yang menjaga 94 perbaikan bernomor (M1–M94) tidak
hilang saat porting.

Kenapa harness, bukan membaca kode berdampingan:
  Perbaikan seperti M87 (kata "booking" di gerbang) atau M88 (gerbang mengenali
  kalimat pertanyaannya sendiri) adalah SATU entri di dalam daftar ratusan.
  Membandingkan dua implementasi dengan mata tidak akan menangkap satu entri
  yang tertinggal — menjalankan keduanya atas input yang sama, menangkap.

Fixture SENGAJA memuat kasus produksi nyata yang pernah menjadi bug, bukan
contoh yang dikarang: kalau port Python diam-diam kehilangan salah satunya,
harness ini gagal dan menyebut persis mana yang beda.

Jalankan:  python tests/parity/run_parity.py
Keluar 0 bila semua identik, 1 bila ada beda.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

# Console Windows default cp1252 — mencetak emoji akan melempar
# UnicodeEncodeError DAN menutupi hasil paritas yang sebenarnya sudah dihitung.
# Paksa UTF-8 pada stdout/stderr sebelum mencetak apa pun.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # pragma: no cover
        pass

HERE = Path(__file__).resolve().parent
PY_BACKEND = HERE.parents[1]
PROJECT_ROOT = PY_BACKEND.parent
NODE_BACKEND = PROJECT_ROOT / "backend"

sys.path.insert(0, str(PY_BACKEND))

from app.core import property_keyword_filter as gate  # noqa: E402

# ── Fixture ────────────────────────────────────────────────────────────────
# Kasus NYATA dari transkrip produksi + kontrol negatif yang sudah terbukti
# penting. Menambah kasus di sini otomatis menguji KEDUA implementasi.
GATE_FIXTURES: list[str] = [
    # M87 — alur booking (pernah dibuang seluruhnya)
    "Saya booking hotel di Surabaya",
    "booking hotel di Surabaya",
    "Saya booking apartemen di Surabaya",
    "Saya ingin booking apartemen di Surabaya",
    "Booking hotel",
    "Saya booking kondotel di Batu",
    "reservasi hotel di Malang",
    "Mau menginap di villa Bali",
    "nginap di hotel surabaya",
    "I want to book a hotel in Bali",
    # Kontrol negatif M87 — booking NON-properti harus tetap ditolak
    "booking tiket pesawat",
    "booking tiket kereta ke Jakarta",
    "Saya mau booking meja restoran",
    "reservasi tempat makan malam",
    "saya buka facebook dulu",
    "ada notebook murah?",
    # Alur normal
    "Saya mau beli rumah di Malang",
    "cari rumah sewa Surabaya",
    "mau sewa apartemen di Jakarta",
    "Saya mau tanya tentang sewa apartemen",
    "Hi cari book apartemen",
    # Jawaban pendek — biasanya FALSE di gerbang (normal, ditangani continuation)
    "Daerah Gubeng",
    "Kota Jakarta",
    "Di kota Jakarta",
    "Kosongan",
    "Lantai 12-17",
    "Jam 2 siang",
    # Non-properti murni
    "km mau cari bebek goreng",
    "sewa mobil dong",
    "cari kunci motor hilang",
    "kasi makan dulu ya",
    "mau ke bioskop",
    "resep masakan apa ya",
    # Ambiguitas "rumah"
    "cari yang deket rumah makan",
    "cari yang deket rumah sakit",
    "Saya tidak ingin rumah tua",
    # Batas
    "ok",
    "",
    "   ",
]


def run_node_gate(messages: list[str]) -> list[bool]:
    """Panggil hasPropertyKeyword() Node.js atas fixture yang sama."""
    script = (
        "const f=require('./utils/propertyKeywordFilter');"
        "let raw='';"
        "process.stdin.on('data',d=>raw+=d);"
        "process.stdin.on('end',()=>{"
        "const msgs=JSON.parse(raw);"
        "process.stdout.write(JSON.stringify(msgs.map(m=>f.hasPropertyKeyword(m))));"
        "});"
    )
    proc = subprocess.run(
        ["node", "-e", script],
        input=json.dumps(messages),
        capture_output=True,
        text=True,
        cwd=str(NODE_BACKEND),
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Node gagal: {proc.stderr.strip()[:300]}")

    # Node bisa menulis log startup ke stdout; ambil array JSON terakhir.
    out = proc.stdout.strip()
    start = out.rfind("[")
    if start < 0:
        raise RuntimeError(f"Keluaran Node tidak berisi JSON: {out[:200]}")
    return json.loads(out[start:])


def run_python_gate(messages: list[str]) -> list[bool]:
    return [gate.has_property_keyword(m) for m in messages]


def main() -> int:
    print("=" * 64)
    print("HARNESS PARITAS — gerbang masuk (hasPropertyKeyword)")
    print("=" * 64)

    try:
        node_results = run_node_gate(GATE_FIXTURES)
    except Exception as exc:  # noqa: BLE001
        print(f"❌ Tidak bisa menjalankan sisi Node.js: {exc}")
        return 1

    py_results = run_python_gate(GATE_FIXTURES)

    if len(node_results) != len(py_results):
        print(f"❌ Jumlah hasil beda: node={len(node_results)} python={len(py_results)}")
        return 1

    mismatches: list[tuple[str, bool, bool]] = []
    for msg, n, p in zip(GATE_FIXTURES, node_results, py_results):
        if n != p:
            mismatches.append((msg, n, p))

    total = len(GATE_FIXTURES)
    same = total - len(mismatches)
    print(f"\nfixture   : {total}")
    print(f"identik   : {same}")
    print(f"BEDA      : {len(mismatches)}")

    if mismatches:
        print("\n── PERBEDAAN (node → python) ──")
        for msg, n, p in mismatches:
            print(f"  ✗ {msg!r:48} node={n!s:5} python={p!s:5}")
        print("\nPort Python BELUM setara. Perbaiki sebelum mengalihkan trafik.")
        return 1

    print("\n✅ SETARA — kedua implementasi memberi hasil identik untuk semua fixture.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

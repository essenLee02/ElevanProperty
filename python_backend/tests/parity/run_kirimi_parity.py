"""Harness paritas — parsing webhook Kirimi (M98, 15 Agu 2026).

Menguji `app/core/kirimi_message.py` terhadap fungsi ASLI di
`backend/controllers/kirimiChatController.js` (extractMessage, detectEventType,
normalizePhone — diekspos khusus untuk ini, lihat komentar di bawah
`module.exports` file itu).

Jalankan:  python tests/parity/run_kirimi_parity.py
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

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

from app.core import kirimi_message as km  # noqa: E402

# ── Fixture — bentuk payload NYATA yang bervariasi (flat root, nested data.*,
# key.* ala Baileys) yang harus dipahami sama oleh kedua implementasi. ───────
PAYLOAD_FIXTURES: list[dict] = [
    {"type": "message", "device_id": "D-3OCA6", "from": "628123456789",
     "pushName": "Budi", "message": "Halo, saya mau tanya properti",
     "messageId": "abc123", "fromMe": False},
    {"type": "message", "device_id": "D-3OCA6", "from": "+62 812-3456-789",
     "pushName": "Siti", "message": "Rumah di Surabaya ada?",
     "messageId": "abc124", "fromMe": False},
    {"type": "message.sent", "device_id": "D-3OCA6", "from": "628123456789",
     "message": "balasan agent", "fromMe": True},
    {"type": "connection.connected", "device_id": "D-3OCA6"},
    {"event": "message.ack", "from": "628123456789"},
    {"data": {"from": "628999888777", "message": "nested payload",
              "pushName": "Nested User"}, "type": "message",
     "device_id": "D-9XYZ"},
    {"key": {"remoteJid": "628111222333@s.whatsapp.net", "fromMe": False, "id": "wamid.1"},
     "text": "key.* style payload (tanpa field 'message' object, hindari [object Object])",
     "type": "message"},
    {"from": "628123456789@g.us", "message": "pesan grup", "type": "message"},
    {},
    {"type": "message", "from": "", "message": ""},
    {"type": "unknown_event_xyz", "from": "628123456789", "message": "isi ada tapi event asing"},
]


def run_node(payloads: list[dict]) -> list[dict]:
    script = (
        "const c=require('./controllers/kirimiChatController');"
        "let raw='';"
        "process.stdin.on('data',d=>raw+=d);"
        "process.stdin.on('end',()=>{"
        "const bodies=JSON.parse(raw);"
        "const out=bodies.map(b=>({"
        "extracted:c.extractMessage(b),"
        "event:c.detectEventType(b)"
        "}));"
        "process.stdout.write(JSON.stringify(out));"
        "});"
    )
    proc = subprocess.run(
        ["node", "-e", script],
        input=json.dumps(payloads),
        capture_output=True,
        text=True,
        cwd=str(NODE_BACKEND),
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Node gagal: {proc.stderr.strip()[:500]}")

    out = proc.stdout.strip()
    # find(), BUKAN rfind() — payload uji bisa memuat teks yang sendirinya
    # mengandung karakter '[' (mis. hasil stringify objek JS), yang akan
    # membuat rfind() menunjuk ke tengah data, bukan awal array JSON asli.
    start = out.find("[")
    if start < 0:
        raise RuntimeError(f"Keluaran Node tidak berisi JSON: {out[:300]}")
    return json.loads(out[start:])


def run_python(payloads: list[dict]) -> list[dict]:
    results = []
    for body in payloads:
        extracted = km.extract_message(body)
        results.append({
            "extracted": {
                "sender": extracted["sender"],
                "name": extracted["name"],
                "message": extracted["message"],
                # messageId auto-generated berbasis waktu — dikecualikan dari
                # perbandingan (lihat main()), bukan dibandingkan literal.
                "deviceId": extracted["device_id"],
                "fromMe": extracted["from_me"],
                "isGroup": extracted["is_group"],
            },
            "event": km.detect_event_type(body),
        })
    return results


def main() -> int:
    print("=" * 64)
    print("HARNESS PARITAS — parsing webhook Kirimi")
    print("=" * 64)

    try:
        node_results = run_node(PAYLOAD_FIXTURES)
    except Exception as exc:  # noqa: BLE001
        print(f"❌ Tidak bisa menjalankan sisi Node.js: {exc}")
        return 1

    py_results = run_python(PAYLOAD_FIXTURES)

    if len(node_results) != len(py_results):
        print(f"❌ Jumlah hasil beda: node={len(node_results)} python={len(py_results)}")
        return 1

    # messageId auto-generated dari timestamp saat tidak ada di payload — dua
    # proses berbeda TIDAK MUNGKIN menghasilkan nilai literal sama pada
    # milidetik yang persis sama, jadi field ini sengaja dikecualikan dari
    # perbandingan (bukan diam-diam diabaikan — field lain tetap dibandingkan).
    fields_to_compare = ["sender", "name", "message", "deviceId", "fromMe", "isGroup"]

    mismatches: list[tuple[int, dict, dict]] = []
    for i, (payload, n, p) in enumerate(zip(PAYLOAD_FIXTURES, node_results, py_results)):
        n_ex = {k: n["extracted"].get(k) for k in fields_to_compare}
        p_ex = {k: p["extracted"].get(k) for k in fields_to_compare}
        if n_ex != p_ex or n["event"] != p["event"]:
            mismatches.append((i, n, p))

    total = len(PAYLOAD_FIXTURES)
    same = total - len(mismatches)
    print(f"\nfixture   : {total}")
    print(f"identik   : {same}")
    print(f"BEDA      : {len(mismatches)}")

    if mismatches:
        print("\n── PERBEDAAN (node vs python) ──")
        for i, n, p in mismatches:
            print(f"  ✗ payload[{i}] = {PAYLOAD_FIXTURES[i]!r}")
            print(f"      node   = {n!r}")
            print(f"      python = {p!r}")
        print("\nPort Python BELUM setara. Perbaiki sebelum dipakai lebih jauh.")
        return 1

    print("\n✅ SETARA — parsing webhook Kirimi identik untuk semua fixture.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

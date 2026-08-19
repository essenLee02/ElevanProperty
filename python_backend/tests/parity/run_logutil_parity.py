"""Harness paritas — utilitas log & redaksi rahasia (M100).

`redact_secrets()` adalah lapisan KEAMANAN: ia yang mencegah API key ikut
tercetak ke terminal/log saat customer menyalin-tempel teks. Perbedaan diam
antara Node.js dan Python di sini = kebocoran kredensial yang tidak terlihat
sampai terlambat. Karena itu diuji 1:1 terhadap fungsi ASLI, bukan diperiksa
dengan mata.

Jalankan:  python tests/parity/run_logutil_parity.py
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

from app.core import whatsapp_utils as wu  # noqa: E402

PHONES = ["628123456789", "62812", "123", "", "6288888874", "1234", "12345", "628", "62", "1"]
NAMES = ["Nigel Tjandra", "Nigel", "Nigel 期凡努", "", "A B C D", "  spasi   ganda  ", "李"]

# ⚠️ Rahasia PALSU (bukan kredensial asli) — sengaja dibentuk menyerupai pola
# nyata supaya aturan redaksi benar-benar terpicu.
SECRETS = [
    "ini sk-ant-api03-AAAABBBBCCCCDDDDEEEE bocor",
    "key sk-proj-1234567890abcdefghij ada",
    "openai sk-abcdefghijklmnopqrstuvwxyz123456 nih",
    "apify_api_abcdefghij1234567890",
    "google AIzaSyD9lR2OAPd0000000000000000000",
    "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
    "x-api-key: abcdefgh12345678",
    "jwt eyJhbGciOiJIUzI1NiIs.eyJzdWIiOiIxMjM0NTY.SflKxwRJSMeKKF2QT4",
    "CHAT_GPT_API_KEY=sk-svcacct-rahasia-sekali-panjang",
    'json {"api_key": "sangat-rahasia-1234"}',
    "teks biasa tanpa rahasia apa pun",
    "harga 500 juta di Surabaya",
]

SANITIZE = [
    ("baris\nbaru\tdan tab", 400),
    ("a" * 500, 100),
    ("teks pendek", 400),
    ("", 400),
    ("\x1b[31mmerah\x1b[0m", 400),
]


def run_node() -> dict:
    script = r"""
const u = require('./utils/whatsappUtils');
const r = require('./utils/secretRedactor');
let raw='';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  const i = JSON.parse(raw);
  process.stdout.write(JSON.stringify({
    phones: i.phones.map(p => u.maskPhone(p)),
    names: i.names.map(n => u.maskName(n)),
    secrets: i.secrets.map(s => r.redactSecrets(s)),
    sanitize: i.sanitize.map(([t, n]) => u.sanitizeLog(t, n)),
  }));
});
"""
    payload = {"phones": PHONES, "names": NAMES, "secrets": SECRETS, "sanitize": SANITIZE}
    proc = subprocess.run(
        ["node", "-e", script], input=json.dumps(payload),
        capture_output=True, text=True, cwd=str(NODE_BACKEND), encoding="utf-8",
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Node gagal: {proc.stderr.strip()[:800]}")
    out = proc.stdout.strip()
    start = out.find("{")
    if start < 0:
        raise RuntimeError(f"Keluaran Node tidak berisi JSON: {out[:300]}")
    return json.loads(out[start:])


def run_python() -> dict:
    return {
        "phones": [wu.mask_phone(p) for p in PHONES],
        "names": [wu.mask_name(n) for n in NAMES],
        "secrets": [wu.redact_secrets(s) for s in SECRETS],
        "sanitize": [wu.sanitize_log(t, n) for t, n in SANITIZE],
    }


def main() -> int:
    print("=" * 64)
    print("HARNESS PARITAS — utilitas log & redaksi rahasia (M100)")
    print("=" * 64)

    try:
        node_out = run_node()
    except Exception as exc:  # noqa: BLE001
        print(f"❌ Tidak bisa menjalankan sisi Node.js: {exc}")
        return 1

    py_out = run_python()

    total = 0
    mismatches: list[str] = []
    inputs = {"phones": PHONES, "names": NAMES, "secrets": SECRETS,
              "sanitize": [t for t, _ in SANITIZE]}

    for key in ("phones", "names", "secrets", "sanitize"):
        for i, (n, p) in enumerate(zip(node_out[key], py_out[key])):
            total += 1
            if n != p:
                mismatches.append(f"{key}[{i}] in={inputs[key][i]!r}\n      node  ={n!r}\n      python={p!r}")

    # Kontrol positif: pastikan aturan redaksi memang TERPICU (kalau semua
    # kasus rahasia lolos tanpa berubah, tes ini hijau tanpa arti).
    redacted_count = sum(1 for s, out in zip(SECRETS, py_out["secrets"]) if s != out)
    total += 1
    if redacted_count < 9:
        mismatches.append(
            f"KONTROL POSITIF GAGAL: hanya {redacted_count} kasus rahasia yang tersensor "
            "— aturan redaksi mungkin tidak aktif, tes jadi tidak bermakna"
        )

    same = total - len(mismatches)
    print(f"\nfixture   : {total}")
    print(f"identik   : {same}")
    print(f"BEDA      : {len(mismatches)}")
    print(f"(kontrol : {redacted_count}/{len(SECRETS)} kasus rahasia benar-benar tersensor)")

    if mismatches:
        print("\n── PERBEDAAN ──")
        for line in mismatches:
            print(f"  ✗ {line}")
        return 1

    print("\n✅ SETARA — masking & redaksi identik dengan Node.js.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

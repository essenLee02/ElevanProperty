"""Harness paritas — isPropertyContextContinuation dan pendukungnya (M99).

Fungsi terpanjang dan paling kritis di gerbang masuk (~440 baris, puluhan
cabang regex, bertanggung jawab atas M51/M88 dan lusinan kasus produksi
lain). Fixture di bawah SENGAJA mencakup kasus nyata yang disebut di
komentar kode sumber (bukan dikarang), plus kontrol negatif.

Jalankan:  python tests/parity/run_context_parity.py
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

from app.core import property_keyword_filter as gate  # noqa: E402


def ai(msg: str) -> dict:
    return {"role": "ai", "message": msg}


def user(msg: str) -> dict:
    return {"role": "user", "message": msg}


# ── Fixture: (message, history, label) ──────────────────────────────────────
# History dirancang menyerupai transkrip produksi nyata di komentar kode.
CASES: list[tuple[str, list[dict], str]] = [
    # M51 — jawaban bukan frasa terdaftar, tapi AI baru bertanya
    ("Untuk 3 orang sih", [ai("Untuk berapa orang yang akan menginap?")], "M51 jawaban jumlah orang"),
    # M88 — Q2c area/kecamatan, bukan nama kota
    ("Daerah Gubeng", [
        ai("Di kota mana yang Anda inginkan?"), user("Surabaya"),
        ai("Di area atau kawasan mana di Surabaya yang Anda pertimbangkan?"),
    ], "M88 jawaban area Q2c"),
    # Frustrasi — pengulangan pertanyaan. History SENGAJA dirancang supaya
    # hasRecentPropertyQ dan aiJustAsked SAMA-SAMA False (2 pesan AI TERAKHIR
    # bukan pertanyaan properti) — kalau tidak, jalur bypass lain di bawah
    # akan meloloskannya juga, dan kasus ini gagal membuktikan cabang
    # frustrasi benar-benar diperlukan (diverifikasi A/B: tanpa cabang ini,
    # kasus persis ini berubah jadi False — lihat catatan M99 di V8).
    ("kok ditanya-tanya terus? udah dijawab tadi", [
        ai("Untuk properti ini, rencananya sewa atau beli?"),
        ai("Kisaran harga yang Anda siapkan berapa?"),
        ai("Baik, akan saya proses."),
        ai("Mohon tunggu sebentar."),
    ], "customer jengkel pertanyaan berulang (isolasi cabang frustrasi)"),
    # Obrolan harian — HARUS ditolak walau ada history properti
    ("Rumahku barusan mati listrik", [ai("Di kota mana?"), user("Surabaya")], "obrolan harian mati listrik (tolak)"),
    ("Duh macet banget di jalan", [ai("Budget berapa?")], "obrolan macet murni (tolak)"),
    ("gak macet kok di sini, aman", [ai("Ada red flag lokasi yang mau dihindari?")], "macet sebagai preferensi Q5 (lolos)"),
    # Booking hotel — transaksi ketiga
    ("saya beli", [ai("Untuk Gudang yang Anda cari — rencananya untuk sewa atau beli?")], "jawaban transaksi singkat"),
    # Budget
    ("9-10 juta per bulan, yg bisa dinego ya kak", [ai("Budget berapa?")], "jawaban budget + nego panjang"),
    ("terjangkau saja", [ai("Prefer yang terjangkau, menengah, atau eksklusif?")], "kategori budget"),
    # Furnishing
    ("semi furnish dong, pokok ada peralatan dapur, lemari, ranjang", [ai("Furnished atau unfurnished?")], "jawaban furnishing panjang"),
    # Kondisi
    ("second atau baru, cuma untuk second. Saya mau kondisi bagus", [ai("Kondisi properti yang diinginkan?")], "jawaban kondisi panjang"),
    # Tower/lantai
    ("Hadap menghindari sinar matahari terbenam dan terbit.. Lantai antara 12-15 aja", [ai("Ada preferensi tower atau lantai?")], "jawaban tower/lantai panjang"),
    # Scheduling
    ("Boleh.. kapan saya bisa viewing?", [ai("Ada yang ingin ditanyakan lagi?")], "permintaan viewing"),
    ("Boleh siang, Kak?", [ai("Mau viewing jam berapa?")], "jawaban waktu viewing pendek"),
    # Nama/email pra-summary
    ("Rina", [ai("Boleh saya tahu nama Anda?")], "jawaban nama pendek"),
    ("rina@gmail.com", [ai("Boleh minta alamat email?")], "jawaban email"),
    # Fasilitas
    ("Ada gym dan restoran di dalam?", [
        ai("Di kota mana?"), user("Surabaya"), ai("Budget berapa?"), user("500 juta"),
        ai("Ada fasilitas yang diinginkan?"),
    ], "fasilitas dengan kosakata restoran (context-aware bypass)"),
    # Motivasi (house pilot QM)
    ("Saya pindahan karena ada pindahan kerja, sekalian mau menetap di Jakarta", [ai("Apa yang membuat Kak mulai cari rumah sekarang?")], "jawaban motivasi panjang"),
    # Preferensi fleksibel
    ("terserah aja", [ai("Ada preferensi lokasi tertentu?")], "jawaban fleksibel"),
    # Negasi pendek
    ("gak mau deh", [ai("Ada red flag yang mau dihindari?")], "negasi pendek"),
    # Lokasi langsung
    ("di Malang aja deh", [ai("Di kota mana?")], "jawaban lokasi eksplisit"),
    # Tanggal
    ("Juni 2026", [ai("Rencananya masuk bulan apa?")], "jawaban bulan+tahun"),
    ("tanggal 18", [ai("Tanggal berapa rencananya masuk?")], "jawaban tanggal"),
    # Angka murni
    ("450000000", [ai("Budget berapa?")], "angka murni sebagai budget"),
    # Afirmasi murni / filler
    ("oke deh", [ai("Boleh saya jadwalkan viewing?")], "filler murni"),
    ("boleh", [ai("Mau saya carikan pilihan lain?")], "afirmasi tunggal"),
    # KONTROL NEGATIF — topik non-properti jelas, TANPA histori properti kuat
    ("saya lagi nonton drakor bagus banget", [ai("Halo, ada yang bisa dibantu?")], "KONTROL: obrolan drama non-properti"),
    ("mau beli laptop baru", [ai("Halo, ada yang bisa dibantu?")], "KONTROL: beli laptop (bukan properti)"),
    ("resep nasi goreng gimana ya", [ai("Selamat siang, ada yang bisa saya bantu?")], "KONTROL: resep masakan"),
    # Pesan > 200 karakter — selalu topik baru
    ("x" * 250, [ai("Budget berapa?")], "KONTROL: pesan sangat panjang tanpa sinyal"),
    # Tanpa history — selalu false
    ("boleh", [], "KONTROL: tanpa history"),
]

DETECT_FRUSTRATION_CASES = [
    "kok ditanya-tanya terus? udah dijawab tadi",
    "capek deh, ribet banget",
    "baca dong pesan saya",
    "Saya mau cari rumah di Surabaya",
    "",
]

IS_DAILY_LIFE_CASES = [
    "mati listrik dari tadi",
    "wifi lemot banget",
    "gak macet kok di sini",
    "tidak banjir di sini",
    "Saya mau beli rumah di Malang",
]

LAST_AI_ASKS_CASES = [
    [ai("Di kota mana yang Anda inginkan?")],
    [ai("Baik, akan saya carikan.")],
    [ai("Boleh saya tahu nama Anda?")],
    [],
]

EXTRACT_LOCATION_CASES = ["Saya mau cari rumah di Surabaya", "cari di Malang dong", "tidak ada lokasi di sini"]
EXTRACT_TYPE_CASES = ["mau apartemen dong", "villa di Bali", "ga ada tipe di sini"]
EXTRACT_TXN_CASES = ["mau sewa rumah", "saya beli rumah", "hanya lihat-lihat"]

POST_SUMMARY_CASES = [
    [ai("✓ Rencana: Sewa Rumah di Surabaya, budget 5 juta")],
    [ai("✓ Rencana: Sewa Rumah di Surabaya"), user("Saya mau cari apartemen juga di Jakarta")],
    [ai("Halo, ada yang bisa dibantu?")],
]


def run_node() -> dict:
    script = r"""
const c = require('./utils/propertyKeywordFilter');
let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  const input = JSON.parse(raw);
  const out = {
    continuation: input.cases.map(([msg, hist]) => c.isPropertyContextContinuation(msg, hist)),
    frustration: input.frustration.map(m => c.detectCustomerFrustration(m)),
    lastAiAsks: input.lastAiAsks.map(h => c.lastAiMessageAsksQuestion(h)),
    extractLoc: input.extractLoc.map(m => c.extractLocationFromMessage(m)),
    extractType: input.extractType.map(m => c.extractPropertyTypeFromMessage(m)),
    extractTxn: input.extractTxn.map(m => c.extractTransactionTypeFromMessage(m)),
    postSummary: input.postSummary.map(h => c.isPostSummaryDormant(h)),
  };
  process.stdout.write(JSON.stringify(out));
});
"""
    payload = {
        "cases": [[msg, hist] for msg, hist, _ in CASES],
        "frustration": DETECT_FRUSTRATION_CASES,
        "lastAiAsks": LAST_AI_ASKS_CASES,
        "extractLoc": EXTRACT_LOCATION_CASES,
        "extractType": EXTRACT_TYPE_CASES,
        "extractTxn": EXTRACT_TXN_CASES,
        "postSummary": POST_SUMMARY_CASES,
    }
    proc = subprocess.run(
        ["node", "-e", script], input=json.dumps(payload),
        capture_output=True, text=True, cwd=str(NODE_BACKEND),
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
        "continuation": [gate.is_property_context_continuation(msg, hist) for msg, hist, _ in CASES],
        "frustration": [gate.detect_customer_frustration(m) for m in DETECT_FRUSTRATION_CASES],
        "lastAiAsks": [gate.last_ai_message_asks_question(h) for h in LAST_AI_ASKS_CASES],
        "extractLoc": [gate.extract_location_from_message(m) for m in EXTRACT_LOCATION_CASES],
        "extractType": [gate.extract_property_type_from_message(m) for m in EXTRACT_TYPE_CASES],
        "extractTxn": [gate.extract_transaction_type_from_message(m) for m in EXTRACT_TXN_CASES],
        "postSummary": [gate.is_post_summary_dormant(h) for h in POST_SUMMARY_CASES],
    }


def main() -> int:
    print("=" * 64)
    print("HARNESS PARITAS — isPropertyContextContinuation + pendukung (M99)")
    print("=" * 64)

    try:
        node_out = run_node()
    except Exception as exc:  # noqa: BLE001
        print(f"❌ Tidak bisa menjalankan sisi Node.js: {exc}")
        return 1

    py_out = run_python()

    total = 0
    mismatches: list[str] = []

    for i, (msg, _hist, label) in enumerate(CASES):
        total += 1
        n, p = node_out["continuation"][i], py_out["continuation"][i]
        if n != p:
            mismatches.append(f"continuation[{i}] {label!r} msg={msg[:50]!r} node={n} python={p}")

    for i, m in enumerate(DETECT_FRUSTRATION_CASES):
        total += 1
        n, p = node_out["frustration"][i], py_out["frustration"][i]
        if n != p:
            mismatches.append(f"frustration[{i}] msg={m!r} node={n} python={p}")

    for i in range(len(LAST_AI_ASKS_CASES)):
        total += 1
        n, p = node_out["lastAiAsks"][i], py_out["lastAiAsks"][i]
        if n != p:
            mismatches.append(f"lastAiAsks[{i}] node={n} python={p}")

    for i, m in enumerate(EXTRACT_LOCATION_CASES):
        total += 1
        n, p = node_out["extractLoc"][i], py_out["extractLoc"][i]
        if n != p:
            mismatches.append(f"extractLoc[{i}] msg={m!r} node={n!r} python={p!r}")

    for i, m in enumerate(EXTRACT_TYPE_CASES):
        total += 1
        n, p = node_out["extractType"][i], py_out["extractType"][i]
        if n != p:
            mismatches.append(f"extractType[{i}] msg={m!r} node={n!r} python={p!r}")

    for i, m in enumerate(EXTRACT_TXN_CASES):
        total += 1
        n, p = node_out["extractTxn"][i], py_out["extractTxn"][i]
        if n != p:
            mismatches.append(f"extractTxn[{i}] msg={m!r} node={n!r} python={p!r}")

    for i in range(len(POST_SUMMARY_CASES)):
        total += 1
        n, p = node_out["postSummary"][i], py_out["postSummary"][i]
        if n != p:
            mismatches.append(f"postSummary[{i}] node={n} python={p}")

    same = total - len(mismatches)
    print(f"\nfixture   : {total}")
    print(f"identik   : {same}")
    print(f"BEDA      : {len(mismatches)}")

    if mismatches:
        print("\n── PERBEDAAN ──")
        for line in mismatches:
            print(f"  ✗ {line}")
        print("\nPort Python BELUM setara. Perbaiki sebelum dipakai lebih jauh.")
        return 1

    print("\n✅ SETARA — semua fungsi identik dengan Node.js untuk seluruh fixture.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

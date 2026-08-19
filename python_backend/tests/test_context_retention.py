"""Regresi M112 — konteks tidak boleh hilang & customer tidak dibalas 2x.

TRANSKRIP NYATA 17 Agu 2026 21.02–21.08. DUA cacat, keduanya terlihat jelas:

(1) SETIAP PESAN DIBALAS 2–3 KALI, dengan kalimat BERBEDA
    21.02 "Mantap, Kak! Jadi mau beli rumah di Surabaya. Budget...?"
    21.02 "Mantap! Jadi Anda mencari rumah di Surabaya. Budget Anda berapa...?"
    Kalimat berbeda = benar-benar dua panggilan LLM terpisah, jadi satu webhook
    diproses dua kali. Sebabnya: `extract_message()` memberi id sintetis
    `kirimi_<epoch_ms>` bila payload tidak punya id — NILAINYA BEDA setiap kali,
    sehingga pengiriman ulang lolos dari dedup.

(2) KONTEKS HILANG DI TENGAH, LALU MELOOP  ← REGRESI YANG SAYA BUAT DI M110
    21.04 customer: "Rencana beli cash aja, Kak"
    21.05 AI    : "Oh, jadi sekarang Kakak mau cari rumah di kota yang baru ya?
                   Kira-kira budget...?"          ← budget SUDAH dijawab 21.02
    21.08 AI    : "jadi sekarang mau cari rumah di kota mana?" (3x berturut)
    Sebabnya: `Boundary.switched` tetap True SELAMANYA setelah pergantian kota,
    karena pergantian itu masih ada di riwayat pada setiap giliran berikutnya.
    Perintah "MULAI WAWANCARA BARU" ikut terkirim terus, dan model menuruti:
    membuang jawaban yang baru saja diberikan lalu menanyakan kota lagi.

Run: python tests/test_context_retention.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import qualification_state as qs  # noqa: E402
from app.core.session_boundary import compute_boundary  # noqa: E402
from app.services.inbound_message_service import (  # noqa: E402
    dedup_key,
    is_duplicate,
)

pass_count = 0
fail_count = 0


def ok(label: str, cond: bool, extra: str = "") -> None:
    global pass_count, fail_count
    if cond:
        pass_count += 1
        print(f"  [OK]   {label}")
    else:
        fail_count += 1
        print(f"  [FAIL] {label} {extra}")


def u(m: str) -> dict:
    return {"role": "user", "message": m}


def a(m: str) -> dict:
    return {"role": "ai", "message": m}


# Percakapan Jakarta 16 Agu masih di sesi yang sama (satu nomor = satu sesi).
OLD_JAKARTA = [
    u("Saya mau beli rumah di Jakarta"),
    a("Baik, Kak! Berikut ringkasan permintaan Anda 📝\n✓ Rencana: Beli\n✓ Kota: Jakarta"),
]

# Urutan PERSIS dari transkrip 17 Agu.
TRANSCRIPT = [
    "Saya mau beli rumah di Surabaya",
    "Saya cari harga 400-700 jt",
    "Rencana mau beli 18 September ini",
    "Rencana beli cash aja, Kak",
    "Saya cari rumah yang dingin, hadap selatan, tidak banjir, gang yang lebar",
]


def main() -> None:
    print("== Group 1: pergantian kota diumumkan SEKALI, bukan tiap giliran ==")
    hist = list(OLD_JAKARTA)
    switched_turns: list[int] = []
    for i, msg in enumerate(TRANSCRIPT):
        b = compute_boundary(hist, msg)
        if b.switched:
            switched_turns.append(i)
        hist = hist + [u(msg), a("(balasan AI)")]

    ok("pergantian ditandai HANYA di giliran pemicu", switched_turns == [0],
       f"giliran ber-switched: {switched_turns}")
    ok("giliran 'cash aja' TIDAK dianggap ganti kota", 3 not in switched_turns)
    ok("giliran red-flag TIDAK dianggap ganti kota", 4 not in switched_turns)

    print("\n== Group 2: riwayat tetap terpotong walau tidak diumumkan lagi ==")
    hist = list(OLD_JAKARTA)
    starts: list[int] = []
    for msg in TRANSCRIPT:
        starts.append(compute_boundary(hist, msg).start)
        hist = hist + [u(msg), a("(balasan AI)")]
    ok("batas tetap > 0 di semua giliran (Jakarta tetap dibuang)",
       all(s > 0 for s in starts), str(starts))
    ok("batas STABIL, tidak bergeser tiap giliran",
       len(set(starts)) == 1, str(starts))

    print("\n== Group 3: jawaban customer TIDAK hilang (inti bug) ==")
    hist = list(OLD_JAKARTA)
    asked: list[str] = []
    for msg in TRANSCRIPT:
        st = qs.extract_state(hist, msg)
        missing = [label for _, label in qs.missing_mandatory(st)]
        asked.append(missing[0] if missing else "RINGKASAN")
        hist = hist + [u(msg), a("(balasan AI)")]

    ok("Q berikutnya maju terus, tidak mundur",
       asked == ["budget", "target waktu", "cash atau KPR", "RINGKASAN", "RINGKASAN"],
       str(asked))
    ok("kota TIDAK pernah ditanya lagi setelah dijawab",
       "kota/lokasi" not in asked, str(asked))
    ok("budget TIDAK ditanya dua kali", asked.count("budget") == 1, str(asked))

    final = qs.extract_state(hist[:-2], TRANSCRIPT[-1])
    ok("kota Surabaya tetap tersimpan", (final.city or "").lower() == "surabaya",
       str(final.city))
    ok("budget 400-700 jt tetap tersimpan",
       final.budget is not None and "400-700" in final.budget, str(final.budget))
    ok("cash tetap tersimpan", final.financing == "cash", str(final.financing))
    # ⚠️ Assertion ini DIPERBAIKI di M114. Dulu ia menuntut `red_flags` terisi
    # untuk kalimat "dingin, hadap selatan, tidak banjir, gang lebar" — padahal
    # kalimat itu TIDAK memuat satu pun larangan; semuanya keinginan. Menuntut
    # `red_flags` justru mengunci bug "Hindari: ...yang sebenarnya diminta".
    ok("preferensi tercatat (bukan sebagai 'hindari')",
       final.preferences is not None, str(final.preferences))
    ok("tidak ada larangan palsu", final.red_flags is None, str(final.red_flags))

    print("\n== Group 4: dedup — id sintetis pakai sidik jari isi ==")
    ok("id asli dipakai apa adanya",
       dedup_key("ABC123", phone="628x", message="hai") == "ABC123")
    k1 = dedup_key("kirimi_1755400000001", phone="628111", message="Saya mau beli rumah di Surabaya")
    k2 = dedup_key("kirimi_1755400000002", phone="628111", message="Saya mau beli rumah di Surabaya")
    ok("id sintetis BEDA + isi sama → kunci SAMA", k1 == k2, f"{k1[:16]} vs {k2[:16]}")
    ok("kunci sidik jari ditandai 'fp_'", k1.startswith("fp_"), k1[:8])
    k3 = dedup_key("kirimi_1755400000003", phone="628111", message="Saya cari harga 400-700 jt")
    ok("isi BERBEDA → kunci berbeda", k1 != k3)
    k4 = dedup_key("kirimi_1755400000004", phone="628999", message="Saya mau beli rumah di Surabaya")
    ok("nomor BERBEDA → kunci berbeda", k1 != k4)

    print("\n== Group 5: is_duplicate memblokir pengiriman ulang ==")
    stamp = int(time.time() * 1000)
    first = is_duplicate(f"kirimi_{stamp}", phone="628222", message="Saya mau beli rumah di Surabaya")
    second = is_duplicate(f"kirimi_{stamp + 1}", phone="628222", message="Saya mau beli rumah di Surabaya")
    third = is_duplicate(f"kirimi_{stamp + 2}", phone="628222", message="Saya mau beli rumah di Surabaya")
    ok("kiriman pertama diproses", first is False)
    ok("kiriman ulang ke-2 DIBLOKIR", second is True)
    ok("kiriman ulang ke-3 DIBLOKIR", third is True)

    ok("pesan lain dari nomor sama tetap diproses",
       is_duplicate(f"kirimi_{stamp + 3}", phone="628222", message="Saya cari harga 400-700 jt") is False)
    ok("id asli tetap dedup normal",
       is_duplicate("REAL_ID_1", phone="628222", message="x") is False
       and is_duplicate("REAL_ID_1", phone="628222", message="x") is True)

    print("\n== Group 6: KONTROL NEGATIF — pergantian NYATA tetap terdeteksi ==")
    b = compute_boundary([u("mau beli rumah di Surabaya"), a("Budget?")],
                         "eh di Jakarta aja")
    ok("ganti kota di pesan sekarang → switched True", b.switched is True, str(b))
    b2 = compute_boundary([u("mau sewa villa di Malang"), a("Budget?")],
                          "mau beli apartemen aja")
    ok("ganti tipe+transaksi → switched True", b2.switched is True, str(b2))

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()

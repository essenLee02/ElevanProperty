"""Regresi M110 — batas sesi: jangan bawa jawaban pencarian lama.

KEJADIAN NYATA (16 Agu 2026 23.22, transkrip WhatsApp user). Customer menulis
SATU kalimat pembuka:

    "Saya mau beli rumah di Jakarta"

dan langsung menerima ringkasan lengkap: Area Senayan, budget 300-500 juta,
cash, 3 kamar, semi-furnished, "dekat Senayan Mall", bahkan
"Budget 2-3 juta/hari + Durasi 1 minggu" untuk sebuah PEMBELIAN. Tidak satu
pun pernah dikatakan di percakapan itu.

Diverifikasi: yang membalas adalah Python (tidak ada proses Node yang hidup;
:5056 + ngrok :4040 aktif). Jadi M107 tidak menciptakan kebocorannya — riwayat
memang sudah bocor karena satu nomor memakai ulang sesi selamanya — tetapi
M107-lah yang mengubahnya dari "kadang menyinggung hal lama" menjadi
"mencetak ringkasan salah dengan penuh percaya diri".

ATURAN YANG DIUJI (docs/04-qualification-flow.md §2 + permintaan user):
setiap pergantian TIPE PROPERTI, JENIS TRANSAKSI, atau KOTA → mulai lagi dari
Q1, wawancara dari awal, DILARANG langsung meringkas.

Run: python tests/test_session_boundary.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import qualification_state as qs  # noqa: E402
from app.core import session_boundary as sb  # noqa: E402
from app.core.property_keyword_filter import (  # noqa: E402
    extract_location_from_message,
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


SUMMARY_VILLA = """Baik, Kak! Berikut ringkasan permintaan Anda 📝

✓ Rencana: Booking
✓ Tipe: villa
✓ Kota: Malang
✓ Area: Senayan
✓ Budget: 2-3 juta/hari
✓ Durasi: 1 minggu
✓ Kamar: 3 kamar
✓ Furnitur: semi-furnished
✓ Patokan lokasi: dekat Senayan Mall"""

# Pencarian LAMA yang sudah selesai (ada ringkasannya).
OLD_SEARCH = [
    u("Halo, saya mau booking villa di Malang"),
    a("Budget berapa, Kak?"),
    u("2-3 juta/hari, 1 minggu, 3 kamar, semi-furnished, dekat Senayan Mall"),
    a(SUMMARY_VILLA),
]

NEW_MSG = "Saya mau beli rumah di Jakarta"


def main() -> None:
    print("== Group 1: batas dihitung — pesan baru memulai sesi baru ==")
    b = sb.compute_boundary(OLD_SEARCH, NEW_MSG)
    ok("batas TIDAK di 0 (riwayat lama dipotong)", b.start > 0, str(b))
    ok("ditandai sebagai pergantian (switched)", b.switched is True, str(b))
    ok("slot pemicu tercatat", b.changed_slot in ("property_type", "transaction", "city"),
       b.changed_slot)

    print("\n== Group 2: slot TIDAK mewarisi pencarian lama (inti bug) ==")
    st = qs.extract_state(OLD_SEARCH, NEW_MSG)
    d = st.as_dict()
    for slot, ghost in [("area", "Senayan"), ("budget", "2-3 juta"),
                        ("bedrooms", "3 kamar"), ("furnishing", "semi-furnished"),
                        ("anchor_point", "Senayan Mall"), ("duration", "1 minggu")]:
        ok(f"'{slot}' TIDAK bocor dari pencarian villa", not d.get(slot),
           f"{slot}={d.get(slot)!r} (harusnya kosong, bukan {ghost!r})")

    print("\n== Group 3: yang BENAR-BENAR dikatakan tetap terbaca ==")
    ok("transaksi = sale (beli)", st.transaction == "sale", str(st.transaction))
    ok("tipe = house (rumah)", st.property_type == "house", str(st.property_type))
    ok("kota = Jakarta", (st.city or "").lower() == "jakarta", str(st.city))

    print("\n== Group 4: giliran pergantian DILARANG meringkas ==")
    directive = qs.build_directive(st, agent_name="LEO FELIX", boundary=b)
    ok("directive BUKAN perintah ringkasan",
       "BUAT RINGKASAN" not in directive.upper(), directive[:70])
    ok("directive melarang ringkasan eksplisit",
       "DILARANG menampilkan ringkasan" in directive or
       "JANGAN menampilkan ringkasan" in directive, directive[:120])
    ok("directive menyuruh bertanya (wawancara)",
       "Tanyakan" in directive or "bertanya" in directive, directive[:120])

    # ⚠️ Kasus di atas lolos walau penjaga pergantian DIMATIKAN, karena masih
    # ada slot kosong sehingga cabang "missing" sudah melarang ringkasan
    # (terbukti lewat A/B: FIX-2 dimatikan → tetap lulus). Penjaga itu baru
    # benar-benar berperan bila pesan pemicunya SENDIRI mengisi semua slot
    # wajib — di situlah AI lama langsung meringkas tanpa wawancara.
    print("\n== Group 4b: pemicu yang mengisi SEMUA slot pun tidak boleh diringkas ==")
    rich = "eh mau beli rumah di Jakarta, budget 500 juta, cash, target bulan depan"
    b2 = sb.compute_boundary(OLD_SEARCH, rich)
    st2 = qs.extract_state(OLD_SEARCH, rich)
    ok("semua slot wajib terisi dari pesan pemicu",
       qs.missing_mandatory(st2) == [], str(qs.missing_mandatory(st2)))
    ok("batas tetap menandai pergantian", b2.switched is True, str(b2))
    d2 = qs.build_directive(st2, agent_name="LEO FELIX", boundary=b2)
    ok("TETAP dilarang meringkas walau lengkap",
       "BUAT RINGKASAN" not in d2.upper(), d2[:80])
    ok("diperintahkan memulai wawancara", "WAWANCARA" in d2.upper(), d2[:80])

    print("\n== Group 5: tiga pemicu reset (tipe / transaksi / kota) ==")
    triggers = [
        ("tipe properti", [u("mau sewa villa di Malang")], "mau sewa apartemen di Malang"),
        ("jenis transaksi", [u("mau sewa rumah di Malang")], "eh bukan sewa, mau beli rumah"),
        ("kota", [u("mau beli rumah di Surabaya")], "eh di Jakarta aja"),
    ]
    for label, hist, msg in triggers:
        bb = sb.compute_boundary(hist, msg)
        ok(f"ganti {label} → reset", bb.switched is True and bb.start > 0, str(bb))

    print("\n== Group 6: KONTROL NEGATIF — percakapan wajar TIDAK direset ==")
    normal = [
        u("Saya mau beli rumah di Jakarta"),
        a("Budget berapa, Kak?"),
        u("300-500 juta"),
        a("Cash atau KPR?"),
    ]
    bn = sb.compute_boundary(normal, "cash aja")
    ok("tanpa pergantian → batas tetap 0", bn.start == 0, str(bn))
    ok("tanpa pergantian → switched False", bn.switched is False, str(bn))
    stn = qs.extract_state(normal, "cash aja")
    ok("jawaban dalam sesi yang sama TETAP terkumpul",
       stn.budget is not None and stn.financing is not None,
       f"budget={stn.budget!r} financing={stn.financing!r}")
    ok("kota tetap terbaca", (stn.city or "").lower() == "jakarta", str(stn.city))

    # Menyebut kota yang SAMA lagi bukan pergantian.
    same = [u("mau beli rumah di Jakarta"), a("Budget?"), u("di Jakarta ya, 500 juta")]
    ok("menyebut ulang kota yang sama → BUKAN reset",
       sb.compute_boundary(same, "iya").switched is False,
       str(sb.compute_boundary(same, "iya")))

    print("\n== Group 7: batas RINGKASAN (bukan pergantian) ==")
    after = OLD_SEARCH + [u("oke lanjut")]
    ba = sb.compute_boundary(after, "kapan bisa lihat unitnya?")
    ok("setelah ringkasan → sesi baru dimulai", ba.start > 0, str(ba))
    ok("alasan = summary (bukan switch)", ba.reason == "summary", str(ba))
    ok("summary TIDAK menyalakan banner pergantian", ba.switched is False, str(ba))

    print("\n== Group 8: kota tidak boleh 'naik pangkat' jadi kecamatan ==")
    ok("'di Jakarta' → jakarta (BUKAN jakarta selatan)",
       extract_location_from_message("Saya mau beli rumah di Jakarta") == "jakarta",
       extract_location_from_message("Saya mau beli rumah di Jakarta"))
    ok("'di Jakarta Selatan' tetap jakarta selatan",
       extract_location_from_message("beli rumah di Jakarta Selatan") == "jakarta selatan")
    ok("teks bukan-kota tidak dipaksa jadi kota",
       extract_location_from_message("saya gak mau di gang sempit") == "",
       extract_location_from_message("saya gak mau di gang sempit"))

    print("\n== Group 9: riwayat pemanggil TIDAK BOLEH berubah (IMMUT-1) ==")
    snapshot = [dict(m) for m in OLD_SEARCH]
    sb.compute_boundary(OLD_SEARCH, NEW_MSG)
    sb.active_history(OLD_SEARCH, NEW_MSG)
    qs.extract_state(OLD_SEARCH, NEW_MSG)
    ok("panjang riwayat tidak berubah", len(OLD_SEARCH) == len(snapshot))
    ok("isi riwayat tidak berubah", OLD_SEARCH == snapshot)
    sliced = sb.active_history(OLD_SEARCH, NEW_MSG)
    ok("active_history mengembalikan list BARU", sliced is not OLD_SEARCH)

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()

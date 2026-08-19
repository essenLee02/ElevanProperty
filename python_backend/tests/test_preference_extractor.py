"""Regresi M114 — MAU vs HINDARI harus terpisah.

BUG PRODUKSI. Satu kalimat customer memuat empat hal berbeda:

    "Saya cari rumah yang dingin, hadap selatan, tidak banjir, gang yang lebar"

Seluruhnya masuk ke slot `red_flags`, sehingga:
  • Ringkasan menulis "✓ Hindari: ...dingin, hadap selatan..." — menyuruh agent
    MENGHINDARI yang justru DIMINTA (terlihat nyata 15 Agu: "✓ Hindari: Cari
    yang akses jalan lancar, tidak banjir, tidak panas, dekat Alfamaret").
  • Tidak ada slot yang terisi rapi, jadi AI mengira belum dijawab dan terus
    bertanya ulang (transkrip 17 Agu 22.05–22.14, "tipe rumah seperti apa?"
    lima kali).

⚠️ INTI: orang Indonesia menyatakan KEINGINAN lewat NEGASI. "tidak banjir" =
mau bebas banjir. Menyalinnya ke kolom "Hindari" membalik maknanya.

Run: python tests/test_preference_extractor.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import qualification_state as qs  # noqa: E402
from app.core.preference_extractor import (  # noqa: E402
    PreferenceSet,
    extract_preferences,
    merge,
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


REAL = "Saya cari rumah yang dingin, hadap selatan, tidak banjir, gang yang lebar"


def main() -> None:
    print("== Group 1: kalimat asli customer (17 Agu 22.08) ==")
    p = extract_preferences(REAL)
    ok("'dingin' → keinginan sejuk", any("sejuk" in w for w in p.wants), str(p.wants))
    ok("'tidak banjir' → MAU bebas banjir, bukan hindari",
       any("bebas banjir" in w for w in p.wants), str(p.wants))
    ok("'gang lebar' tertangkap", any("lebar" in w for w in p.wants), str(p.wants))
    ok("'hadap selatan' jadi slot hadap", p.orientation == "hadap selatan", str(p.orientation))
    ok("TIDAK ada yang salah masuk 'hindari'", p.avoids == (), str(p.avoids))

    print("\n== Group 2: negasi lain yang sering dipakai ==")
    for text, want in [
        ("Cari yang akses jalan lancar, tidak banjir, tidak panas", "sejuk"),
        ("jangan yang macet", "akses lancar"),
        ("gang jangan sempit", "akses/gang lebar"),
        ("tidak bising", "tenang"),
    ]:
        got = extract_preferences(text).wants
        ok(f"{text[:34]!r} → {want}", any(want in w for w in got), str(got))

    print("\n== Group 3: larangan SEBENARNYA tetap masuk 'hindari' ==")
    p = extract_preferences("Tdk mau dekat parkiran mobil, saya cari tempat yang sepi.")
    ok("'tdk mau dekat parkiran' → hindari",
       any("parkiran" in a for a in p.avoids), str(p.avoids))
    ok("TIDAK jadi patokan lokasi positif", p.nearby == (), str(p.nearby))
    ok("'sepi' tetap tercatat sebagai keinginan",
       any("tenang" in w for w in p.wants), str(p.wants))

    p = extract_preferences("jangan yang rumah tua")
    ok("'rumah tua' masuk hindari", any("rumah tua" in a for a in p.avoids), str(p.avoids))

    print("\n== Group 4: hadap — positif vs negatif ==")
    ok("'hadap barat' → orientation",
       extract_preferences("mau hadap barat").orientation == "hadap barat")
    neg = extract_preferences("tidak hadap matahari terbit")
    ok("'tidak hadap matahari terbit' → hindari",
       any("matahari terbit" in a for a in neg.avoids), str(neg.avoids))
    ok("negasi hadap TIDAK mengisi orientation", neg.orientation is None, str(neg.orientation))

    print("\n== Group 5: patokan lokasi (daftar) ==")
    ok("'Dekat alfamaret, Indomaret' → dua patokan",
       extract_preferences("Dekat alfamaret, Indomaret").nearby
       == ("dekat alfamaret", "dekat Indomaret"),
       str(extract_preferences("Dekat alfamaret, Indomaret").nearby))
    ok("'dekat cafe, mall dan sekolah' → tiga patokan",
       len(extract_preferences("dekat cafe, mall dan sekolah").nearby) == 3,
       str(extract_preferences("dekat cafe, mall dan sekolah").nearby))
    ok("klausa lain TIDAK ikut jadi patokan",
       extract_preferences("dekat kampus, budget 5 juta").nearby == ("dekat kampus",),
       str(extract_preferences("dekat kampus, budget 5 juta").nearby))
    ok("larangan TIDAK ikut jadi patokan",
       extract_preferences("dekat PTC, jangan yang rumah tua").nearby == ("dekat PTC",),
       str(extract_preferences("dekat PTC, jangan yang rumah tua").nearby))
    ok("PTC & gunung terpisah",
       extract_preferences("dekat PTC dan dekat gunung").nearby
       == ("dekat PTC", "dekat gunung"))

    print("\n== Group 6: merge lintas pesan (customer menyebut sepotong-sepotong) ==")
    a = extract_preferences("cari yang dingin, hadap selatan")
    b = extract_preferences("dekat Alfamaret, tidak banjir")
    m = merge(a, b)
    ok("hadap dari pesan pertama dipertahankan", m.orientation == "hadap selatan")
    ok("keinginan kedua pesan digabung",
       any("sejuk" in w for w in m.wants) and any("bebas banjir" in w for w in m.wants),
       str(m.wants))
    ok("patokan dari pesan kedua masuk", any("Alfamaret" in n for n in m.nearby), str(m.nearby))
    ok("merge TIDAK mengubah argumen (IMMUT-1)",
       a.orientation == "hadap selatan" and b.orientation is None)
    ok("tanpa duplikat", len(m.wants) == len(set(m.wants)), str(m.wants))

    print("\n== Group 7: terpasang di pelacak slot ==")
    st = qs.extract_state([u("Saya mau beli rumah di Surabaya")], REAL)
    ok("slot 'preferences' terisi", st.preferences is not None, str(st.preferences))
    ok("slot 'orientation' terisi", st.orientation == "hadap selatan", str(st.orientation))
    ok("slot 'red_flags' TIDAK terisi kalimat mentah",
       st.red_flags is None, str(st.red_flags))
    ok("kalimat mentah tidak bocor ke slot mana pun",
       all(REAL not in str(v) for v in st.as_dict().values()),
       str({k: v for k, v in st.as_dict().items() if v}))

    block = qs.build_state_block(st)
    ok("state block menandai Preferensi ✅", "Preferensi" in block, block[:200])
    ok("state block menandai Hadap ✅", "Hadap" in block, block[:200])
    ok("preferensi TIDAK muncul di baris 'Hindari'",
       "Hindari" not in block, block[:300])

    print("\n== Group 8: pertanyaan berikutnya MAJU, bukan mengulang ==")
    missing = [label for _, label in qs.missing_mandatory(st)]
    ok("tipe TIDAK ditanya lagi (sudah 'rumah')",
       "tipe properti" not in missing, str(missing))
    ok("kota TIDAK ditanya lagi", "kota/lokasi" not in missing, str(missing))
    ok("pertanyaan berikutnya = budget", missing[:1] == ["budget"], str(missing))

    print("\n== Group 9: KONTROL NEGATIF ==")
    ok("kalimat kosong → hasil kosong", extract_preferences("").is_empty())
    ok("kalimat tanpa preferensi → kosong",
       extract_preferences("Saya mau beli rumah").is_empty(),
       str(extract_preferences("Saya mau beli rumah")))
    ok("PreferenceSet default kosong", PreferenceSet().is_empty())

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()

"""Regresi M107 — status kualifikasi: anti-ulang & pemicu ringkasan.

DUA BUG NYATA (transkrip villa Malang, 15 Agu 2026 13:04–13:08):
  (1) AI menanyakan jumlah kamar di 13.05 lalu MENANYAKANNYA LAGI di 13.06;
      tanggal ditanya 13.05 lalu LAGI di 13.07 — semuanya sudah dijawab.
  (2) Percakapan berakhir tanpa blok ✓ ringkasan.

Sebab: jalur Python murni LLM+RAG tanpa catatan slot. Perbaikannya bukan
menyuruh model "jangan mengulang" (sudah dicoba lewat aturan prompt dan tetap
terjadi), melainkan memberi model DAFTAR TEGAS ✅/❓ + satu instruksi.

Run: python tests/test_qualification_state.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import qualification_state as qs  # noqa: E402

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


VILLA = [
    u("Hello... Saya mau book villa di Malang. Apakah ada rekomendasi?"),
    a("Budget dan tipe villa yang diinginkan seperti apa?"),
    u("Saya cari badget 2-3 juta/Minggu. Saya mau booking untuk 2 minggu"),
    a("Ada preferensi untuk jumlah kamar atau fasilitas tertentu?"),
    u("Fasilitas standar saja, Kak. Pokok ada kolam renangnya dan AC"),
    a("Kapan rencananya Kakak mau booking?"),
    u("Saya booking bulan depan, Kak. Tanggal 12"),
]


def main() -> None:
    print("== Group 1: slot terisi dari transkrip villa (termasuk pesan PERTAMA) ==")
    st = qs.extract_state(VILLA)
    ok("transaction = booking (bukan 'rent')", st.transaction == "booking", str(st.transaction))
    ok("property_type = villa", st.property_type == "villa", str(st.property_type))
    ok("city = Malang", (st.city or "").lower() == "malang", str(st.city))
    ok("budget tertangkap", st.budget is not None and "2-3" in st.budget, str(st.budget))
    ok("durasi = 2 minggu", st.duration is not None and "2 minggu" in st.duration, str(st.duration))
    ok("tanggal tertangkap", st.move_in_date is not None and "12" in st.move_in_date, str(st.move_in_date))
    ok("fasilitas = standar saja", st.facilities == "standar saja", str(st.facilities))

    print("\n== Group 2: BOOKING mewajibkan jumlah tamu (inti bug) ==")
    missing = [k for k, _ in qs.missing_mandatory(st)]
    ok("jumlah tamu (occupants) masih ❓", "occupants" in missing, str(missing))
    ok("HANYA satu slot wajib tersisa", len(missing) == 1, str(missing))
    ok("tanggal TIDAK diminta ulang", "move_in_date" not in missing)
    ok("durasi TIDAK diminta ulang", "duration" not in missing)
    ok("budget TIDAK diminta ulang", "budget" not in missing)

    print("\n== Group 3: setelah jumlah tamu → lengkap → RINGKASAN ==")
    full = VILLA + [a("Boleh tahu jumlah tamunya?"),
                    u("Butuh 5 kamar, karena saya menginap dgn 4 teman")]
    st2 = qs.extract_state(full)
    ok("occupants terisi", st2.occupants is not None, str(st2.occupants))
    ok("occupants menyertakan jumlah (bukan cuma 'teman')",
       any(ch.isdigit() for ch in (st2.occupants or "")), str(st2.occupants))
    ok("bedrooms = 5 kamar", st2.bedrooms == "5 kamar", str(st2.bedrooms))
    ok("TIDAK ada slot wajib tersisa", qs.missing_mandatory(st2) == [],
       str(qs.missing_mandatory(st2)))

    directive = qs.build_directive(st2, agent_name="LEO FELIX", app_name="Elevan Property")
    ok("directive memerintahkan RINGKASAN", "RINGKASAN" in directive.upper(), directive[:80])
    ok("directive memuat baris ✓", "✓" in directive)
    ok("directive memuat tanda tangan agent", "LEO FELIX" in directive)

    print("\n== Group 4: directive saat masih ada slot kosong ==")
    d1 = qs.build_directive(st)
    ok("perintah bertanya SATU slot", "jumlah tamu" in d1.lower(), d1[:100])
    ok("melarang ringkasan dini", "JANGAN menampilkan ringkasan" in d1)
    ok("melarang tanya ulang slot ✅", "sudah ✅" in d1)

    print("\n== Group 5: state block menandai ✅ / ❓ ==")
    block = qs.build_state_block(st)
    ok("blok memuat penanda ✅", "✅" in block)
    ok("blok menandai yang kosong ❓", "❓" in block)
    ok("blok memuat instruksi jangan tanya ulang", "JANGAN tanyakan yang sudah" in block)
    block2 = qs.build_state_block(st2)
    ok("blok lengkap menyatakan semua terisi", "SEMUA SLOT WAJIB SUDAH TERISI" in block2)

    print("\n== Group 6: KONTROL NEGATIF — jangan salah tangkap ==")
    # Fasilitas BUKAN area (bug produksi: "Area: Parkir Mobil").
    st3 = qs.extract_state([u("Selain area Parkir Mobil, apakah masih oke?")])
    ok("'area Parkir Mobil' TIDAK dicatat sebagai area", st3.area is None, str(st3.area))

    # Negasi tetap negasi (bug produksi: "tidak mau dekat X" → "dekat X").
    st4 = qs.extract_state([u("Tdk mau dekat parkiran mobil, saya cari tempat yang sepi.")])
    ok("negasi TIDAK jadi patokan lokasi positif", st4.anchor_point is None, str(st4.anchor_point))
    ok("negasi tercatat sebagai red flag", st4.red_flags is not None, str(st4.red_flags))

    # "5 hari lagi" = offset tanggal, BUKAN durasi (M82).
    st5 = qs.extract_state([u("Saya mau sewa rumah, rencana masuk 5 hari lagi")])
    ok("'5 hari lagi' TIDAK jadi durasi", st5.duration is None, str(st5.duration))

    # Typo tanpa spasi tetap terbaca (M103).
    st6 = qs.extract_state([u("booking apartemen di Jakarta, untuk1 minggu saja")])
    ok("'untuk1 minggu' terbaca sebagai durasi",
       st6.duration is not None and "1 minggu" in st6.duration, str(st6.duration))

    # Sewa (bukan booking) TIDAK mewajibkan jumlah tamu.
    st7 = qs.extract_state([u("Saya mau sewa rumah di Surabaya, budget 5 juta, masuk September, fasilitas standar saja")])
    ok("sewa: transaction = rent", st7.transaction == "rent", str(st7.transaction))
    ok("sewa: jumlah tamu TIDAK wajib",
       "occupants" not in [k for k, _ in qs.missing_mandatory(st7)])

    # Beli WAJIB financing.
    st8 = qs.extract_state([u("Saya mau beli rumah di Surabaya, budget 500 juta, target 4 bulan lagi")])
    ok("beli: transaction = sale", st8.transaction == "sale", str(st8.transaction))
    ok("beli: financing (cash/KPR) WAJIB",
       "financing" in [k for k, _ in qs.missing_mandatory(st8)],
       str(qs.missing_mandatory(st8)))

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()

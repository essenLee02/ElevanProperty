"""Regresi M111 — balasan tidak boleh membocorkan instruksi / terasa robotik.

SEMUA string di bawah DIKUTIP PERSIS dari 9 transkrip produksi yang dikirim
user (15 Agu – 16 Agu 2026), bukan contoh buatan. User menyebut hasilnya
"terlalu kaku seperti robot dan tidak manusiawi" — empat sebab konkretnya
terlihat langsung di transkrip itu:

  Case 9 : "Rp [harga rendah] dan Rp [harga tinggi]"      → placeholder mentah
  Case 1 : "..., tanyakan: Selain area Senayan..."         → kata perintah bocor
  Case 1 : "Tanya: Ada fasilitas yang wajib ada..."        → kata perintah bocor
  Case 5 : "Siap, Kak. Untuk Q9, kalau nanti ada..."       → nomor internal bocor
  Case 1/2/7/9: "Oke, Kak! 😊" delapan giliran berturut    → pembuka seragam

Run: python tests/test_reply_humanizer.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.reply_humanizer import (  # noqa: E402
    humanize_reply,
    last_ai_message,
    opener_of,
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


def main() -> None:
    print("== Group 1: placeholder harga MEMBLOKIR pengiriman (Case 9) ==")
    r = humanize_reply(
        "Di Jakarta ada apartemen kisaran Rp [harga rendah] dan Rp [harga tinggi]. "
        "Kira-kira yang mana lebih sesuai? 💰",
        agent_name="LEO FELIX", app_name="Elevan Property",
    )
    ok("DIBLOKIR — harga tidak boleh ditebak", r.blocked is True, str(r.issues))
    ok("alasan 'unresolved_placeholder'", "unresolved_placeholder" in r.issues, str(r.issues))

    print("\n== Group 2: placeholder nama DIPERBAIKI, bukan diblokir ==")
    r = humanize_reply(
        "Terima kasih sudah menghubungi saya.\n\nSalam hangat,\n[Nama Agen]\n${appName}",
        agent_name="LEO FELIX", app_name="Elevan Property",
    )
    ok("tidak diblokir (nilainya kita punya)", r.blocked is False, str(r.issues))
    ok("nama agent sungguhan masuk", "LEO FELIX" in r.text, r.text[-60:])
    ok("nama aplikasi sungguhan masuk", "Elevan Property" in r.text, r.text[-60:])
    ok("tidak ada '[Nama Agen]' tersisa", "[Nama Agen]" not in r.text)
    ok("tidak ada '${appName}' tersisa", "${appName}" not in r.text)

    # Tanpa nama agent, placeholder yang sama TIDAK boleh lolos.
    r = humanize_reply("Salam hangat,\n[Nama Agen]", agent_name="", app_name="")
    ok("tanpa nama agent → DIBLOKIR", r.blocked is True, str(r.issues))

    print("\n== Group 3: kata perintah bocor (Case 1) ==")
    r = humanize_reply(
        "Oke, Kak! 😊\n\nUntuk pencarian apartemen di Jakarta, tanyakan: "
        "Selain area Senayan, apakah area sekitar masih oke? 🗺️",
        agent_name="LEO FELIX",
    )
    ok("'tanyakan:' dibuang", "tanyakan:" not in r.text.lower(), r.text)
    ok("ditandai directive_leak", "directive_leak" in r.issues, str(r.issues))
    ok("pertanyaan aslinya TETAP ada", "Selain area Senayan" in r.text, r.text)
    ok("tidak diblokir", r.blocked is False)

    r = humanize_reply(
        "Tanya: Ada fasilitas yang wajib ada untuk apartemen-nya? Misalnya AC, "
        'kolam renang, gym, parkir, atau kitchen set. Kalau tidak ada preferensi '
        'khusus, boleh jawab "standar saja" 🛠️',
        agent_name="LEO FELIX",
    )
    ok("'Tanya:' di awal dibuang", not r.text.lower().startswith("tanya:"), r.text[:40])
    ok("isi pertanyaan utuh", "fasilitas yang wajib ada" in r.text)

    print("\n== Group 4: nomor pertanyaan internal (Case 5) ==")
    r = humanize_reply(
        "Siap, Kak. Untuk Q9, kalau nanti ada yang cocok, langsung bisa "
        "dijadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?",
        agent_name="LEO FELIX",
    )
    ok("'Q9' tidak terlihat customer", "Q9" not in r.text, r.text)
    ok("ditandai question_number_leak", "question_number_leak" in r.issues, str(r.issues))
    ok("kalimatnya tetap utuh", "jadwalkan viewing" in r.text, r.text)

    print("\n== Group 5: pembuka berulang (Case 1/2/7/9) ==")
    prev = "Oke, Kak! 😊\n\nRencananya masuk atau pindah bulan apa? 📅"
    r = humanize_reply(
        "Oke, Kak! 😊\n\nNanti akan tinggal bersama siapa saja? 🛏️",
        agent_name="LEO FELIX", previous_ai_message=prev,
    )
    ok("pembuka kembar dibuang", not r.text.lower().startswith("oke"), r.text[:40])
    ok("ditandai repeated_opener", "repeated_opener" in r.issues, str(r.issues))
    ok("isi pertanyaan tetap ada", "tinggal bersama siapa" in r.text, r.text)

    # Pembuka BERBEDA dari giliran lalu → dibiarkan (variasi itu manusiawi).
    r = humanize_reply(
        "Baik, Kak! Nanti akan tinggal bersama siapa saja?",
        agent_name="LEO FELIX", previous_ai_message=prev,
    )
    ok("pembuka BERBEDA dipertahankan", r.text.startswith("Baik"), r.text[:40])
    ok("tidak ditandai repeated_opener", "repeated_opener" not in r.issues, str(r.issues))

    # Giliran pertama (tidak ada sebelumnya) → dibiarkan.
    r = humanize_reply("Oke, Kak! 😊 Budget berapa?", agent_name="LEO FELIX")
    ok("giliran pertama tidak diubah", r.text.startswith("Oke"), r.text[:40])

    print("\n== Group 6: KONTROL NEGATIF — jangan rusak balasan yang wajar ==")
    good = ("Oh, mau beli rumah di Jakarta, ya! Budget yang diinginkan berapa, Kak? 😊")
    r = humanize_reply(good, agent_name="LEO FELIX", app_name="Elevan Property")
    ok("balasan wajar tidak berubah", r.text == good, r.text)
    ok("balasan wajar tanpa issue", r.issues == (), str(r.issues))

    # "tanyakan" sebagai kata biasa (bukan scaffolding) TIDAK boleh dipotong.
    natural = "Nanti saya tanyakan ke owner dulu ya, Kak."
    r = humanize_reply(natural, agent_name="LEO FELIX")
    ok("'saya tanyakan ke owner' utuh", r.text == natural, r.text)

    # Ringkasan asli penuh baris ✓ harus lolos apa adanya.
    summary = ("Baik, Kak! Berikut ringkasan permintaan Anda 📝\n\n"
               "✓ Rencana: Beli\n✓ Tipe: Rumah\n✓ Kota: Jakarta\n\n"
               "Salam hangat,\nLEO FELIX\nElevan Property")
    r = humanize_reply(summary, agent_name="LEO FELIX", app_name="Elevan Property")
    ok("ringkasan sah tidak diblokir", r.blocked is False, str(r.issues))
    ok("baris ✓ utuh", r.text.count("✓") == 3, str(r.text.count("✓")))

    # Kurung siku yang WAJAR (bukan placeholder) tidak boleh memblokir.
    r = humanize_reply("Harganya Rp 500 juta (nego).", agent_name="LEO FELIX")
    ok("teks tanpa placeholder tidak diblokir", r.blocked is False, str(r.issues))

    print("\n== Group 7: balasan kosong ==")
    r = humanize_reply("   ", agent_name="LEO FELIX")
    ok("balasan kosong DIBLOKIR", r.blocked is True, str(r.issues))

    print("\n== Group 8: pembantu riwayat ==")
    hist = [{"role": "user", "message": "hai"},
            {"role": "ai", "message": "Oke, Kak! 😊 Budget berapa?"},
            {"role": "user", "message": "500 juta"}]
    ok("last_ai_message mengambil pesan AI terakhir",
       "Budget berapa" in last_ai_message(hist), last_ai_message(hist))
    ok("last_ai_message aman untuk riwayat kosong", last_ai_message([]) == "")
    ok("last_ai_message aman untuk None", last_ai_message(None) == "")
    ok("opener_of menormalkan pembuka",
       opener_of("Oke, Kak! 😊") == opener_of("oke kak"),
       f"{opener_of('Oke, Kak! 😊')} vs {opener_of('oke kak')}")
    ok("opener_of kosong untuk kalimat biasa", opener_of("Budget berapa?") == "")

    print("\n== Group 9: argumen pemanggil tidak diubah (IMMUT-1) ==")
    snapshot = [dict(m) for m in hist]
    last_ai_message(hist)
    ok("riwayat tidak berubah", hist == snapshot)

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()

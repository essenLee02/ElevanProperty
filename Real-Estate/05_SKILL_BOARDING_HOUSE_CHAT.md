# SKILL: KOS-KOSAN / BOARDING HOUSE — 20 Simulasi Chat WhatsApp
**Tipe Property:** Kos-Kosan (Boarding House)
**Transaksi:** Ngekos (sewa kamar), Beli (aset bangunan kos) | **Total Case:** 20
**Fokus:** Fasilitas, transaksi, area, preferensi lokasi & red flag

---

## 🔧 SLOT KHUSUS KOS
```json
{
  "transaction_type": null, "location": null, "kos_type": "putra/putri/campur",
  "bathroom_type": "dalam/luar", "room_size": null, "payment_period": "harian/bulanan",
  "budget": null, "facilities": [], "include_meals": null,
  "environment": {"tenang": null, "aman": null, "akses_lancar": null},
  "nearby": [], "red_flags": []
}
```

---

## BAGIAN A: NGEKOS / SEWA KAMAR (Case 01–12)

### CASE 01 | Ngekos | Dekat Kampus + Alfamart + Tenang
```
Customer : Cari kos dekat kampus yang tenang buat belajar
AI       : Siap! Kampus mana acuannya?
Customer : Dekat UBAYA Tenggilis
AI       : Kos putra, putri, atau campur?
Customer : Putri
AI       : "Tenang" = hindari jalan raya bising ya? Tapi jangan yang gelap/sepi
Customer : Iya, tenang tapi aman & terang
AI       : Wajib dekat apa?
Customer : Dekat Alfamart/Indomaret & tempat makan
AI       : Fasilitas kamar wajib?
Customer : AC, kamar mandi dalam, WiFi
AI       : Budget/bulan & kapan masuk?
Customer : 1,2–1,8 juta, September
AI       : Siap! Kos putri dekat UBAYA Tenggilis, tenang + aman + terang, dekat Alfamart & tempat makan, AC + KM dalam + WiFi, 1,2–1,8jt/bln, masuk September!
```

### CASE 02 | Ngekos | Malas Ketik + Anti Macet ke Kantor
```
Customer : kos karyawan deket rungkut akses lancar gak macet
AI       : Kos putra/putri & fasilitas?
Customer : putra, AC kamar mandi dalam
AI       : Prioritas dekat apa?
Customer : warung makan & minimarket, parkir motor aman
AI       : Budget/bln & kapan?
Customer : 1.5-2.5jt, secepatnya
AI       : Siap! Kos putra dekat Rungkut, akses lancar anti-macet, dekat warung + minimarket, parkir aman, AC + KM dalam, 1,5–2,5jt/bln, masuk secepatnya!
```

### CASE 03 | Ngekos | Info Terbatas
```
Customer : mau ngekos di Surabaya tapi bingung area
AI       : Untuk kuliah, kerja, atau lainnya?
Customer : Kuliah, mahasiswa baru
AI       : Kampus mana? Biar saya carikan yang dekat
Customer : ITS Sukolilo
AI       : Kos putra/putri?
Customer : Putra
AI       : Prioritas — tenang buat belajar & dekat kebutuhan?
Customer : Iya, dekat fotokopi & warung
AI       : Budget & fasilitas?
Customer : 1–1,5 juta, AC + WiFi
AI       : Kapan masuk?
Customer : Awal semester
AI       : Siap! Kos putra dekat ITS Sukolilo, tenang + dekat fotokopi & warung, AC + WiFi, 1–1,5jt/bln, masuk awal semester!
```

### CASE 04 | Ngekos | Tanya Harga
```
Customer : Kos dekat UNAIR B berapa per bulan?
AI       : Dekat UNAIR B: kos standar KM luar 700rb–1jt, KM dalam + AC 1,2–2jt/bulan. Putra/putri?
Customer : Putri, yang KM dalam
AI       : Prioritas tenang & aman?
Customer : Iya, sama dekat Indomaret
AI       : Budget & kapan masuk?
Customer : 1,3–1,8 juta, bulan depan
AI       : Siap! Kos putri dekat UNAIR B, KM dalam + AC, tenang + aman + dekat Indomaret, 1,3–1,8jt/bln, masuk bulan depan!
```

### CASE 05 | Ngekos | Marah (kos sebelumnya bermasalah)
```
Customer : Kos lama saya berisik & pemiliknya susah, mau pindah!
AI       : Wajar cari yang lebih nyaman. Saya carikan kos dengan lingkungan tenang & pengelola responsif. Area & tipe?
Customer : Dekat ITS, putri, tenang, pemilik yang enak
AI       : Fasilitas & budget?
Customer : AC KM dalam WiFi, 1,5–2 juta
AI       : Prioritas dekat minimarket & aman (banyak penghuni)?
Customer : Iya
AI       : Kapan pindah?
Customer : Akhir bulan ini
AI       : Siap! Kos putri dekat ITS, tenang + aman + pengelola responsif, dekat minimarket, AC + KM dalam + WiFi, 1,5–2jt/bln, pindah akhir bulan!
```

### CASE 06 | Ngekos | Kos Harian
```
Customer : Kos harian di Surabaya buat 5 hari, ada urusan kerja
AI       : Untuk kos harian, prioritas dekat lokasi urusan. Area mana?
Customer : Dekat Tunjungan/pusat kota
AI       : Putra/putri/campur & fasilitas?
Customer : Campur boleh, AC + KM dalam
AI       : Budget/hari?
Customer : 100–200 ribu
AI       : Prioritas dekat minimarket & tempat makan?
Customer : Iya
AI       : Tanggal?
Customer : Mulai besok, 5 hari
AI       : Siap! Kos harian dekat pusat kota Surabaya, AC + KM dalam, dekat minimarket & tempat makan, 100–200rb/hari, 5 hari mulai besok!
```

### CASE 07 | Ngekos | Include Makan
```
Customer : Cari kos putri yang include makan biar praktis
AI       : Kos include makan memang hemat waktu! Area/kampus?
Customer : Dekat UBAYA, mahasiswa
AI       : Berapa kali makan/hari?
Customer : 2 kali (pagi & malam)
AI       : Prioritas tenang & aman?
Customer : Iya, sama dekat Alfamart
AI       : Fasilitas kamar & budget?
Customer : AC KM dalam, 1,8–2,5 juta include makan
AI       : Kapan masuk?
Customer : Semester baru
AI       : Siap! Kos putri dekat UBAYA, include makan 2x + AC + KM dalam, tenang + aman + dekat Alfamart, 1,8–2,5jt/bln, masuk semester baru!
```

### CASE 08 | Ngekos | Kos Eksklusif/Premium
```
Customer : Kos eksklusif yang kayak apartemen di Surabaya
AI       : Kos eksklusif (private bathroom, AC, water heater, dapur bersama premium) memang nyaman. Area?
Customer : Dekat CBD Sungkono buat kerja
AI       : Prioritas fasilitas premium apa?
Customer : Water heater, WiFi kencang, cleaning service, parkir mobil
AI       : Budget/bulan?
Customer : 3–5 juta
AI       : Prioritas akses lancar & dekat cafe?
Customer : Iya dua-duanya
AI       : Kapan masuk?
Customer : Bulan depan
AI       : Siap! Kos eksklusif dekat CBD Sungkono, water heater + WiFi kencang + cleaning + parkir mobil, akses lancar + dekat cafe, 3–5jt/bln, masuk bulan depan!
```

### CASE 09 | Ngekos | Ganti-Ganti
```
Customer : mau ngekos surabaya
AI       : Kampus/kantor acuan?
Customer : Kerja di HR Muhammad... eh atau dekat Sungkono deh
AI       : Sungkono baik! Putra/putri?
Customer : Putra
AI       : Fasilitas & budget?
Customer : AC KM dalam, 1,5 juta... 2 juta deh biar nyaman
AI       : Prioritas tenang & dekat minimarket?
Customer : Iya
AI       : Kapan masuk?
Customer : Bulan depan
AI       : Siap! Kos putra dekat Sungkono, tenang + dekat minimarket, AC + KM dalam, sampai 2jt/bln, masuk bulan depan!
```

### CASE 10 | Ngekos | Untuk Pasangan (suami-istri)
```
Customer : Kos yang boleh buat pasangan suami istri di Surabaya
AI       : Kos pasutri memang khusus — saya carikan yang mengizinkan & kamar cukup luas. Area?
Customer : Dekat Rungkut, kerja di industri
AI       : Prioritas kamar luas + dapur?
Customer : Iya, sama KM dalam
AI       : Budget & akses?
Customer : 2–3 juta, akses lancar gak macet
AI       : Dekat minimarket & tempat makan?
Customer : Iya penting
AI       : Kapan masuk?
Customer : Secepatnya
AI       : Siap! Kos pasutri dekat Rungkut (kamar luas + dapur + KM dalam), akses lancar + dekat minimarket & tempat makan, 2–3jt/bln, masuk secepatnya!
```

### CASE 11 | Ngekos | Dekat RS (untuk nakes)
```
Customer : Kos dekat RS Dr Soetomo buat perawat, shift malam
AI       : Untuk shift malam, prioritas: dekat RS (hemat waktu) + akses aman malam hari. Putra/putri?
Customer : Putri, yang aman buat pulang malam
AI       : Noted — keamanan prioritas. Fasilitas?
Customer : AC KM dalam, akses 24 jam
AI       : Budget & dekat minimarket buat kebutuhan malam?
Customer : 1,3–2 juta, iya dekat Indomaret 24 jam
AI       : Kapan masuk?
Customer : Bulan depan
AI       : Siap! Kos putri dekat RS Soetomo, aman untuk shift malam + akses 24 jam + dekat Indomaret 24 jam, AC + KM dalam, 1,3–2jt/bln, masuk bulan depan!
```

### CASE 12 | Ngekos | WA Singkat
```
Customer : kos putri deket its AC km dalam wifi 1.5jt tenang aman
AI       : Dekat minimarket & kapan masuk?
Customer : iya deket alfamart, awal semester
AI       : Siap! Kos putri dekat ITS, tenang + aman + dekat Alfamart, AC + KM dalam + WiFi, 1,5jt/bln, masuk awal semester!
```

---

## BAGIAN B: BELI ASET KOS (Case 13–20)

### CASE 13 | Beli | Investasi Dekat Kampus + Bebas Banjir
```
Customer : Mau beli bangunan kos buat investasi dekat kampus
AI       : Investasi kos dekat kampus cashflow-nya stabil! Kampus target?
Customer : Dekat ITS atau UNAIR yang selalu penuh
AI       : Berapa kamar minimal biar worth?
Customer : Minimal 15–20 kamar
AI       : Budget?
Customer : 3–6 miliar
AI       : Penting — saya cek BEBAS BANJIR (biar penghuni betah) & akses jalan bagus. Setuju?
Customer : Wajib, kos banjir susah dapat penghuni
AI       : Cash/KPR & target?
Customer : Cash, 4 bulan
AI       : Siap! Bangunan kos 15–20 kamar dekat ITS/UNAIR, BEBAS BANJIR + akses bagus, 3–6M, cash, target 4 bulan, investasi okupansi tinggi!
```

### CASE 14 | Beli | Malas Ketik
```
Customer : beli kos sby deket kampus 18 kamar 4M cash invest
AI       : Kampus mana & prioritas bebas banjir?
Customer : deket unair, iya bebas banjir wajib
AI       : Target beli?
Customer : 4 bulan
AI       : Siap! Kos 18 kamar dekat UNAIR, BEBAS BANJIR, 4M, cash, target 4 bulan, investasi!
```

### CASE 15 | Beli | Tanya ROI
```
Customer : Beli kos 4 M dekat kampus Surabaya, ROI-nya berapa?
AI       : Simulasi: kos 20 kamar @ 1,5jt/bulan = 30jt/bulan = 360jt/tahun. Setelah operasional (listrik, kebersihan, dll ~30%) net ~250jt/tahun. ROI ~6–7%. Okupansi dekat kampus biasanya 90%+. Sesuai?
Customer : Lumayan, mau yang okupansi tinggi
AI       : Prioritas bebas banjir & dekat minimarket (magnet penghuni)?
Customer : Iya dua-duanya
AI       : Cash/KPR & target?
Customer : Cash, 4 bulan
AI       : Siap! Kos ~20 kamar dekat kampus Surabaya (ROI 6–7%, okupansi tinggi), BEBAS BANJIR + dekat minimarket, 4M, cash, target 4 bulan!
```

### CASE 16 | Beli | Marah (legalitas bermasalah)
```
Customer : 2x mau beli kos batal karena izinnya gak lengkap! Kesal
AI       : Legalitas kos (IMB, sertifikat, izin kos) memang harus teliti. Saya fokuskan hanya yang dokumennya LENGKAP & bersih. Kriteria?
Customer : 15–20 kamar, dekat kampus, max 4 M cash
AI       : Area & target?
Customer : Dekat UNAIR/ITS, secepatnya
AI       : Saya seleksi kos dengan legalitas TERVERIFIKASI + BEBAS BANJIR dekat UNAIR/ITS, 15–20 kamar, max 4M cash — Anda tidak keluar dana sebelum dokumen clear. Update 24 jam!
```

### CASE 17 | Beli | Kos Aktif (sudah ada penghuni)
```
Customer : Beli kos yang sudah jalan & ada penghuninya
AI       : Beli kos running = langsung dapat cashflow! Prioritas okupansi & lokasi?
Customer : Yang penghuninya penuh, dekat kampus
AI       : Kota & kampus?
Customer : Surabaya, dekat ITS
AI       : Berapa kamar & budget?
Customer : 20 kamar, 4–5 M
AI       : Saya cek okupansi + histori pembayaran + BEBAS BANJIR. Cash?
Customer : Cash, target 4 bulan
AI       : Siap! Kos aktif 20 kamar dekat ITS (okupansi penuh + BEBAS BANJIR + histori clear), 4–5M, cash, target 4 bulan!
```

### CASE 18 | Beli | Rumah untuk Dikonversi Kos
```
Customer : Beli rumah besar buat dijadikan kos di Surabaya
AI       : Strategi bagus! Untuk konversi kos, perlu rumah besar/banyak kamar dekat kampus. Area?
Customer : Dekat kampus, yang bisa jadi 10+ kamar
AI       : Prioritas — struktur bisa dibagi kamar & bebas banjir?
Customer : Iya, sama akses jalan cukup buat penghuni
AI       : Kampus & budget?
Customer : Dekat UBAYA, 2–3,5 M
AI       : Cash/KPR & target?
Customer : Cash, 4 bulan
AI       : Siap! Rumah besar dekat UBAYA (potensi 10+ kamar kos), BEBAS BANJIR + akses cukup, 2–3,5M, cash, target 4 bulan, untuk konversi kos!
```

### CASE 19 | Beli | Multi-Aset Investor
```
Customer : Sudah punya 2 kos, mau tambah lagi yang dekat kampus lain
AI       : Ekspansi portofolio kos yang solid! Kampus target baru?
Customer : Belum punya di dekat ITS, mau ke sana
AI       : ITS demand tinggi (mahasiswa teknik banyak dari luar kota). Berapa kamar & budget?
Customer : 15–25 kamar, 4–6 M
AI       : Prioritas bebas banjir & dekat minimarket?
Customer : Iya standar saya
AI       : Cash & target?
Customer : Cash, 4 bulan
AI       : Siap! Kos 15–25 kamar dekat ITS (BEBAS BANJIR + dekat minimarket), 4–6M, cash, target 4 bulan, ekspansi portofolio!
```

### CASE 20 | Beli | WA Singkat
```
Customer : beli kos deket its 20 kamar aktif 5M cash 4bln bebas banjir
AI       : Prioritas okupansi penuh & legalitas lengkap?
Customer : iya wajib
AI       : Siap! Kos aktif 20 kamar dekat ITS (okupansi penuh + legalitas lengkap + BEBAS BANJIR), 5M, cash, target 4 bulan, investasi!
```

---
*File: 05_SKILL_BOARDING_HOUSE_CHAT.md | Elevan Property Chatbot Skills v2.0*

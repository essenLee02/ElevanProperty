# SKILL: KONDOTEL / CONDO HOTEL — 20 Simulasi Chat WhatsApp
**Tipe Property:** Kondotel (Condo Hotel)
**Transaksi:** Booking (menginap), Beli (investasi) | **Total Case:** 20
**Fokus:** Fasilitas, transaksi, area, preferensi lokasi & red flag
**Catatan:** Kondotel = apartemen dengan manajemen hotel; unit bisa disewakan lewat operator

---

## 🔧 SLOT KHUSUS KONDOTEL
```json
{
  "transaction_type": null, "location": null, "unit_type": null, "floor": null,
  "view": null, "nights": null, "operator_hotel": null, "roi_expectation": null,
  "strata_title": null, "management_fee": null, "budget": null,
  "environment": {"sejuk": null, "akses_lancar": null},
  "nearby": [], "red_flags": []
}
```

---

## BAGIAN A: BOOKING / SEWA KONDOTEL (Case 01–10)

### CASE 01 | Booking | Dekat Wisata + Sejuk (Batu)
```
Customer : Booking kondotel di Batu yang dekat wisata & sejuk buat staycation
AI       : Batu paling pas untuk staycation sejuk! Wisata acuan — BNS, Jatim Park, atau alun-alun?
Customer : Dekat Jatim Park & BNS
AI       : Berapa malam & tanggal?
Customer : 3 malam, long weekend
AI       : Berapa orang & tipe unit?
Customer : 3 orang, 1 kamar
AI       : Fasilitas wajib?
Customer : Pool, breakfast, view pegunungan yang adem
AI       : Prioritas akses gak macet ke wisata (long weekend padat)?
Customer : Iya, males macet
AI       : Budget/malam?
Customer : 800rb–1,5 juta
AI       : Siap! Kondotel 1KT Batu dekat Jatim Park + BNS, pool + breakfast + view pegunungan sejuk + akses lancar, 3 orang, 800rb–1,5jt/malam, 3 malam long weekend!
```

### CASE 02 | Booking | Malas Ketik
```
Customer : book kondotel bali seminyak 3 malam 2 org
AI       : Tanggal & tipe unit?
Customer : 10-13 agustus, 1 kamar
AI       : Budget/malam & fasilitas?
Customer : 1.5-2.5jt, pool breakfast
AI       : Prioritas dekat wisata/cafe?
Customer : iya deket pantai & cafe
AI       : Siap! Kondotel 1KT Seminyak Bali dekat pantai + cafe, pool + breakfast, 2 orang, 1,5–2,5jt/malam, 10–13 Agustus!
```

### CASE 03 | Booking | Info Terbatas (Honeymoon)
```
Customer : mau booking kondotel yang bagus buat honeymoon
AI       : Selamat! Di pulau/kota mana?
Customer : Yang romantis & terkenal
AI       : Bali paling populer. Area — Nusa Dua/Uluwatu (ocean view romantis)?
Customer : Nusa Dua yang tenang
AI       : Berapa malam & tanggal?
Customer : 5 malam, September
AI       : Tipe unit & fasilitas?
Customer : Suite, ocean view, pool, spa
AI       : Prioritas in-room breakfast (romantis)?
Customer : Iya
AI       : Budget/malam?
Customer : 2–4 juta
AI       : Siap! Kondotel suite Nusa Dua Bali (tenang, ocean view), pool + spa + in-room breakfast, 2 orang, 2–4jt/malam, 5 malam September, honeymoon!
```

### CASE 04 | Booking | Tanya Harga
```
Customer : Kondotel di Surabaya berapa per malam?
AI       : Surabaya: studio 400–800rb, 1KT 700rb–1,5jt, suite 1,5–4jt/malam. Area mana?
Customer : Pakuwon atau Citraland
AI       : Berapa malam, orang, tipe?
Customer : 2 malam, 2 orang, 1 kamar
AI       : Prioritas dekat mall & pool view?
Customer : Iya dua-duanya
AI       : Budget/malam?
Customer : 800rb–1,5 juta
AI       : Tanggal?
Customer : Weekend ini
AI       : Siap! Kondotel 1KT Pakuwon/Citraland Surabaya (dekat mall + pool view), 2 orang, 800rb–1,5jt/malam, 2 malam weekend ini!
```

### CASE 05 | Booking | Marah (unit unavailable)
```
Customer : Kondotel yang saya pesan tiba-tiba bilang tidak available, padahal sudah transfer!
AI       : Itu sangat mengecewakan — saya bantu cari pengganti setara SEKARANG. Area, tanggal & tipe?
Customer : Seminyak, 3 malam, 1 kamar, check-in besok
AI       : Berapa orang & budget/malam?
Customer : 2 orang, 1,5–2,5 juta
AI       : Fasilitas prioritas?
Customer : Pool, breakfast, dekat pantai
AI       : Saya cek ketersediaan REAL-TIME kondotel Seminyak dekat pantai (pool + breakfast), 1KT, check-in besok, 1,5–2,5jt — konfirmasi 30 menit dengan bukti ketersediaan!
```

### CASE 06 | Booking | Keluarga + Anak
```
Customer : Kondotel 2 kamar buat keluarga 4 orang di Bali, ramah anak
AI       : Untuk anak, prioritas: pool berpagar/anak, unit luas. Area?
Customer : Nusa Dua yang tenang & aman
AI       : Berapa malam & tanggal?
Customer : 5 malam, liburan sekolah
AI       : Prioritas dekat wisata keluarga?
Customer : Iya, dekat pantai & waterpark
AI       : Budget/malam?
Customer : 2–3 juta
AI       : Siap! Kondotel 2KT Nusa Dua Bali (tenang, aman, dekat pantai + waterpark), pool anak, 4 orang, 2–3jt/malam, 5 malam liburan sekolah!
```

### CASE 07 | Long Stay | Bulanan Remote Work
```
Customer : Sewa kondotel bulanan di Bali buat remote work
AI       : Untuk long stay, banyak kondotel kasih rate bulanan hemat. Area?
Customer : Canggu, yang banyak cafe & co-working
AI       : Canggu memang hub digital nomad! Tipe unit & fasilitas?
Customer : 1 kamar, WiFi kencang, pool
AI       : Prioritas dekat cafe & minimarket?
Customer : Iya, sama akses lancar
AI       : Budget/bulan & durasi?
Customer : 8–15 juta, 3 bulan
AI       : Siap! Kondotel 1KT Canggu Bali (dekat cafe + minimarket + akses lancar), WiFi kencang + pool, 8–15jt/bulan, 3 bulan, remote work!
```

### CASE 08 | Booking | Bisnis (dekat CBD)
```
Customer : Kondotel Surabaya buat business stay 1 minggu, dekat CBD
AI       : Untuk bisnis, prioritas dekat CBD + akses lancar. Area?
Customer : Dekat Sungkono/HR Muhammad
AI       : Fasilitas wajib?
Customer : WiFi kencang, gym, breakfast
AI       : Tipe unit & budget/malam?
Customer : Deluxe/1 kamar, 800rb–1,5 juta
AI       : Prioritas dekat mall (makan/meeting)?
Customer : Iya
AI       : Tanggal?
Customer : Senin depan, 7 malam
AI       : Siap! Kondotel 1KT dekat CBD Sungkono/HR Muhammad Surabaya (akses lancar + dekat mall), WiFi + gym + breakfast, 800rb–1,5jt/malam, 7 malam mulai Senin depan!
```

### CASE 09 | Booking | Ganti-Ganti
```
Customer : booking kondotel liburan
AI       : Bali atau Batu?
Customer : Bali... eh Batu aja lebih dekat & sejuk
AI       : Batu sejuk + banyak wisata. Berapa malam & orang?
Customer : 3 malam, 3 orang... eh 4 deh
AI       : 4 orang, tipe 2KT ya. Prioritas dekat wisata & view?
Customer : Iya dekat BNS, view gunung
AI       : Budget/malam & tanggal?
Customer : 1–1,8 juta, weekend depan
AI       : Siap! Kondotel 2KT Batu dekat BNS (view gunung, sejuk), 4 orang, 1–1,8jt/malam, 3 malam weekend depan!
```

### CASE 10 | Booking | WA Singkat
```
Customer : kondotel batu 1kt 2org 3mlm pool breakfast view gunung 1jt deket jatim park
AI       : Tanggal & prioritas akses lancar?
Customer : long weekend, iya biar gak macet
AI       : Siap! Kondotel 1KT Batu dekat Jatim Park (view gunung + akses lancar), pool + breakfast, 2 orang, 1jt/malam, 3 malam long weekend!
```

---

## BAGIAN B: BELI KONDOTEL (Case 11–20)

### CASE 11 | Beli | Investasi Dekat Wisata + ROI
```
Customer : Beli kondotel buat investasi di area wisata yang selalu rame
AI       : Area wisata ramai = okupansi & ROI tinggi! Destinasi?
Customer : Batu (dekat BNS/Jatim Park) atau Bali
AI       : Keduanya kuat. Batu unggul wisata keluarga domestik, okupansi tinggi weekend & liburan. Fokus Batu?
Customer : Iya Batu, lebih dekat
AI       : Unit laku disewa biasanya studio/1KT dekat pintu wisata. Prioritas view gunung + akses lancar?
Customer : Iya, tamu suka view bagus & gak ribet
AI       : Budget & ekspektasi ROI?
Customer : 800jt–1,5 M, ROI 8%+
AI       : Cash/KPR & target?
Customer : Cash, 3 bulan
AI       : Siap! Kondotel studio/1KT Batu dekat BNS/Jatim Park (view gunung + akses lancar, magnet penyewa), 800jt–1,5M, cash, ROI 8%+, target 3 bulan!
```

### CASE 12 | Beli | Malas Ketik
```
Customer : beli kondotel bali seminyak studio 1M cash invest roi tinggi
AI       : Target & operator hotel tertentu?
Customer : 3 bln, bebas asal terpercaya
AI       : Prioritas dekat wisata/pantai (okupansi)?
Customer : iya deket pantai
AI       : Siap! Kondotel studio Seminyak Bali dekat pantai (operator terpercaya), 1M, cash, target 3 bulan, ROI tinggi!
```

### CASE 13 | Beli | Tanya ROI
```
Customer : Kalau beli kondotel 1 M di Bali, ROI-nya berapa?
AI       : Simulasi: kondotel 1M di Seminyak, revenue sharing operator biasanya 60% owner. ADR 700rb–1jt, occupancy 70% → revenue owner ~90–130jt/tahun; net setelah management fee ~70–100jt. ROI 7–10%. Sesuai?
Customer : Mau yang 10%+
AI       : Untuk 10%+, Canggu (trendy) atau area emerging. Area?
Customer : Canggu
AI       : Budget & cash/KPR?
Customer : 800jt–1,2 M, cash
AI       : Prioritas dekat cafe/pantai (demand tinggi)?
Customer : Iya
AI       : Target?
Customer : 3 bulan
AI       : Siap! Kondotel Canggu Bali dekat cafe/pantai (ROI 10%+), 800jt–1,2M, cash, target 3 bulan!
```

### CASE 14 | Beli | Tanya Harga
```
Customer : Harga kondotel di Bali berapa?
AI       : Bali: studio 400jt–800jt, 1KT 800jt–1,5M, suite 1,5–3M. Prime (Seminyak/Nusa Dua) lebih tinggi. Budget?
Customer : 800jt–1,2 M
AI       : Tipe & area?
Customer : Studio/1KT, Seminyak
AI       : Prioritas dekat wisata (okupansi)?
Customer : Iya dekat pantai
AI       : Cash/KPR & target?
Customer : Cash, 3 bulan
AI       : Siap! Kondotel studio/1KT Seminyak Bali dekat pantai, 800jt–1,2M, cash, target 3 bulan, investasi!
```

### CASE 15 | Beli | Marah (gagal deal terus)
```
Customer : 3 bulan gagal deal kondotel Bali terus, capek!
AI       : Maaf atas kesulitannya. Cash siap itu keunggulan — saya prioritaskan Anda. Kriteria?
Customer : Studio/1KT, Canggu/Seminyak, max 1 M cash
AI       : Target?
Customer : Secepatnya
AI       : Saya aktifkan alert prioritas kondotel studio/1KT Canggu/Seminyak max 1M cash — Anda dapat info & unit pertama. Update 24 jam!
```

### CASE 16 | Beli | Operator Ternama
```
Customer : Mau kondotel yang dioperasikan hotel ternama (Wyndham/Marriott)
AI       : Operator ternama = branding kuat + okupansi & sistem manajemen mapan. Area?
Customer : Bali, yang dekat wisata
AI       : Tipe unit & budget?
Customer : 1 kamar, 1–1,5 M
AI       : Prioritas view + akses lancar (nilai sewa)?
Customer : Iya
AI       : Cash/KPR & target?
Customer : Cash, 3 bulan
AI       : Siap! Kondotel 1KT operator ternama (Wyndham/Marriott) di Bali dekat wisata (view + akses lancar), 1–1,5M, cash, target 3 bulan!
```

### CASE 17 | Beli | Tanya Legalitas (SHMSRS)
```
Customer : Kondotel aman gak dari sisi legal? Takut bermasalah
AI       : Bagus ditanyakan! Yang wajib dicek: SHMSRS (strata title), PPJB/AJB, IMB, SLF, TDUP operator, & perjanjian revenue sharing. Saya bantu verifikasi semua. Mau lanjut cari?
Customer : Iya, yang legalitasnya lengkap
AI       : Area & budget?
Customer : Seminyak Bali, 900 juta
AI       : Tipe & prioritas?
Customer : Studio, dekat wisata
AI       : Cash/KPR & target?
Customer : Cash, 3 bulan
AI       : Siap! Kondotel studio Seminyak Bali dekat wisata (SHMSRS + IMB + SLF + TDUP + revenue sharing diverifikasi), 900jt, cash, target 3 bulan!
```

### CASE 18 | Beli | Kondotel di Batu (bukan Bali)
```
Customer : Beli kondotel di Batu aja, biar dekat & wisatanya rame
AI       : Batu pilihan cerdas — wisata domestik ramai + Anda bisa kontrol lebih dekat. Prioritas dekat magnet wisata?
Customer : Dekat BNS, Jatim Park, alun-alun
AI       : Tipe unit & budget?
Customer : Studio/1KT, 600jt–1 M
AI       : Prioritas view gunung + sejuk + akses lancar (magnet penyewa)?
Customer : Iya semua
AI       : Cash/KPR & target?
Customer : Cash, 3 bulan
AI       : Siap! Kondotel studio/1KT Batu dekat BNS/Jatim Park/alun-alun (view gunung + sejuk + akses lancar), 600jt–1M, cash, target 3 bulan, investasi!
```

### CASE 19 | Beli | Multi-Unit Investor
```
Customer : Sudah punya 2 unit kondotel Bali, mau tambah 2 lagi
AI       : Portofolio berkembang bagus! Area yang sama atau diversifikasi?
Customer : Mau coba Canggu yang lagi naik
AI       : Canggu ROI potensial tinggi (trendy + turis muda). Tipe & budget total?
Customer : 2 unit studio/1KT, total 2 M
AI       : Prioritas dekat cafe/pantai + akses lancar?
Customer : Iya standar saya
AI       : Cash & target?
Customer : Cash, 3 bulan
AI       : Siap! 2 unit kondotel studio/1KT Canggu Bali (dekat cafe/pantai + akses lancar), total 2M, cash, target 3 bulan, ekspansi portofolio!
```

### CASE 20 | Beli | WA Singkat
```
Customer : beli kondotel canggu studio 1M cash 3bln roi 10persen deket pantai cafe
AI       : Prioritas SHMSRS & operator terpercaya?
Customer : iya wajib legalitas lengkap
AI       : Siap! Kondotel studio Canggu Bali dekat pantai + cafe (SHMSRS + operator terpercaya), 1M, cash, ROI 10%, target 3 bulan, investasi!
```

---
*File: 11_SKILL_CONDO_KONDOTEL_CHAT.md | Elevan Property Chatbot Skills v2.0*

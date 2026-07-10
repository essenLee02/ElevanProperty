# SKILL: APARTEMEN / APARTMENT — 20 Simulasi Chat WhatsApp
**Tipe Property:** Apartemen (Apartment)
**Transaksi:** Beli, Sewa, Booking (harian) | **Total Case:** 20
**Fokus:** Fasilitas, transaksi, area, preferensi lokasi & red flag

---

## 🔧 SLOT KHUSUS APARTEMEN
```json
{
  "transaction_type": null, "unit_type": null, "floor": null, "view": null,
  "location": null, "budget_min": null, "budget_max": null, "furnished": null,
  "duration": null, "environment": {"akses_lancar": null, "tenang": null},
  "nearby": [], "red_flags": []
}
```

---

## BAGIAN A: SEWA & BOOKING APARTEMEN (Case 01–10)

### CASE 01 | Sewa | Nyambung Mall + Dekat Cafe
```
Customer : Sewa apartemen yang nyambung ke mall biar praktis
AI       : Pilihan cerdas! Apartemen terintegrasi mall di Surabaya: Pakuwon, Ciputra World, Marvell City. Preferensi?
Customer : Pakuwon, sekalian dekat cafe buat nongkrong
AI       : Pakuwon surganya kuliner & cafe. Tipe unit?
Customer : 2 kamar
AI       : Prioritas lantai & view?
Customer : Lantai tinggi city view biar gak bising
AI       : Budget/bulan & furnished?
Customer : 6–10 juta, full furnished
AI       : Kapan masuk & berapa lama?
Customer : 2 bulan, 1 tahun
AI       : Siap! Apartemen 2KT Pakuwon (nyambung mall + cafe), lantai tinggi city view, full furnished, 6–10jt/bln, 1 tahun, masuk 2 bulan!
```

### CASE 02 | Sewa | Malas Ketik + Dekat Kampus
```
Customer : sewa apart sby deket kampus buat kerja remote
AI       : Kampus mana & tipe unit?
Customer : deket UBAYA, studio aja
AI       : Prioritas WiFi kencang & dekat cafe?
Customer : iya wifi kenceng, deket cafe
AI       : Budget/bln & furnished?
Customer : 2.5-4jt full furnished
AI       : Kapan & berapa lama?
Customer : bln depan 1 tahun
AI       : Siap! Apartemen studio dekat UBAYA, WiFi kencang + dekat cafe, full furnished, 2,5–4jt/bln, 1 tahun!
```

### CASE 03 | Booking Harian | Dekat Wisata (Batu)
```
Customer : Booking apartemen harian di Batu dekat wisata
AI       : Siap! Wisata acuan — BNS, Jatim Park, atau alun-alun Batu?
Customer : Dekat Jatim Park & BNS
AI       : Berapa malam & tanggal?
Customer : 3 malam, 15–18 Agustus
AI       : Berapa orang & tipe unit?
Customer : 4 orang, 2 kamar
AI       : Prioritas dekat cafe/kuliner buat malam?
Customer : Iya biar bisa nongkrong
AI       : Budget/malam?
Customer : 800rb–1,5 juta
AI       : Siap! Apartemen harian 2KT Batu dekat Jatim Park + BNS + cafe, 4 orang, 800rb–1,5jt/malam, 15–18 Agustus!
```

### CASE 04 | Sewa | Info Terbatas
```
Customer : mau sewa apartemen tapi bingung di mana
AI       : Kota apa dulu — Surabaya atau Malang?
Customer : Surabaya, yang strategis
AI       : Strategis biasanya dekat CBD/mall/akses tol. Prioritas mana?
Customer : Dekat mall & gampang akses
AI       : Tipe unit & budget?
Customer : 1 kamar, belum tahu wajarnya
AI       : Apartemen 1KT dekat mall Surabaya ~4–7 juta/bulan furnished. Sesuai?
Customer : Oke 4–6 juta
AI       : Kapan masuk & berapa lama?
Customer : Bulan depan, 1 tahun
AI       : Siap! Apartemen 1KT dekat mall Surabaya, akses mudah, furnished, 4–6jt/bln, 1 tahun, masuk bulan depan!
```

### CASE 05 | Sewa | Tanya Harga
```
Customer : Sewa apartemen di Educity Surabaya berapa?
AI       : Educity (dekat ITS): studio 3–4jt, 2KT 5–7jt/bulan furnished. Cocok dekat kampus. Tipe & budget?
Customer : 2 kamar, 5–7 juta
AI       : Prioritas view atau lantai?
Customer : Yang tenang gak bising jalan
AI       : Kapan masuk & berapa lama?
Customer : 2 bulan, 1 tahun
AI       : Siap! Apartemen 2KT Educity Surabaya (dekat ITS, tenang), furnished, 5–7jt/bln, 1 tahun, masuk 2 bulan!
```

### CASE 06 | Sewa | Marah (unit tak sesuai foto)
```
Customer : Kemarin datang lihat apartemen, aslinya beda jauh dari foto! Buang waktu
AI       : Maaf atas pengalaman itu — memang ada listing yang fotonya menyesatkan. Saya kirim unit yang sudah terverifikasi kondisinya. Kriteria?
Customer : 2 kamar, dekat mall, full furnished, max 8 juta
AI       : Area preferensi?
Customer : Surabaya Barat, yang beneran layak huni
AI       : Saya seleksi unit terverifikasi 2KT full furnished dekat mall Surabaya Barat, max 8jt — plus saya sertakan video real. Kapan mau lihat?
Customer : Weekend ini
AI       : Siap! Saya jadwalkan viewing unit terverifikasi weekend ini!
```

### CASE 07 | Booking Harian | Staycation Dekat Mall
```
Customer : booking apartemen harian buat staycation di Surabaya
AI       : Siap! Prioritas dekat mall/pool buat santai?
Customer : Iya yang ada pool, dekat mall
AI       : Berapa malam & orang?
Customer : 2 malam, 2 orang
AI       : Tipe unit & budget/malam?
Customer : 1 kamar, 400–700 ribu
AI       : Tanggal?
Customer : Weekend depan
AI       : Siap! Apartemen harian 1KT dekat mall Surabaya + pool, 2 orang, 400–700rb/malam, 2 malam weekend depan!
```

### CASE 08 | Sewa | Untuk Expat, Akses & Keamanan
```
Customer : Klien expat butuh apartemen di Surabaya 1 tahun
AI       : Untuk expat, prioritas biasanya: keamanan, dekat international area, & full furnished. Area?
Customer : Dekat CBD, HR Muhammad atau Sungkono
AI       : Tipe unit & budget?
Customer : 2 kamar, 10–15 juta
AI       : Prioritas dekat cafe/resto internasional & akses lancar?
Customer : Iya penting
AI       : Kapan masuk?
Customer : Bulan depan
AI       : Siap! Apartemen 2KT dekat CBD Sungkono/HR Muhammad, keamanan baik + dekat resto internasional + akses lancar, full furnished, 10–15jt/bln, 1 tahun, masuk bulan depan!
```

### CASE 09 | Sewa | Ganti-Ganti
```
Customer : sewa apartemen surabaya
AI       : Tipe unit & area?
Customer : Studio... eh 1 kamar deh biar ada dapur
AI       : 1KT baik! Area?
Customer : Barat... atau Pusat ya? Yang dekat mall aja
AI       : Dekat mall Pusat (Tunjungan) atau Barat (Pakuwon). Budget?
Customer : 4–6 juta full furnished
AI       : Kapan & berapa lama?
Customer : Bulan depan, 1 tahun
AI       : Siap! Apartemen 1KT dekat mall Surabaya (Pakuwon/Tunjungan), full furnished, 4–6jt/bln, 1 tahun!
```

### CASE 10 | Sewa | WA Singkat
```
Customer : sewa apart pakuwon sby 2kt city view 8jt 1thn furnished
AI       : Lantai tinggi & kapan masuk?
Customer : lantai tinggi, bln depan
AI       : Siap! Apartemen 2KT Pakuwon Surabaya lantai tinggi city view, full furnished, 8jt/bln, 1 tahun, masuk bulan depan!
```

---

## BAGIAN B: BELI APARTEMEN (Case 11–20)

### CASE 11 | Beli | Investasi Sewa Mahasiswa
```
Customer : beli apartemen buat investasi disewakan mahasiswa
AI       : Strategi bagus! Lokasi dekat kampus besar itu kunci. Kota & kampus?
Customer : Surabaya, dekat ITS atau UNAIR
AI       : Untuk mahasiswa, studio/1KT dekat minimarket & food court paling laku. Prioritaskan?
Customer : Iya, yang gampang disewakan
AI       : Budget & cash/KPR?
Customer : 500–800 juta, cash
AI       : Target beli?
Customer : 3 bulan
AI       : Siap! Apartemen studio/1KT dekat ITS/UNAIR, dekat minimarket + food court (magnet mahasiswa), 500–800jt, cash, target 3 bulan, investasi!
```

### CASE 12 | Beli | Malas Ketik
```
Customer : beli apart sby studio invest 600jt cash
AI       : Dekat kampus/mall & target?
Customer : deket kampus, 3 bln
AI       : Prioritas dekat minimarket buat penyewa?
Customer : iya
AI       : Siap! Apartemen studio dekat kampus Surabaya + minimarket, 600jt, cash, target 3 bulan, investasi!
```

### CASE 13 | Beli | Tanya Harga
```
Customer : Harga apartemen di Surabaya berapa?
AI       : Tergantung lokasi & tipe: studio 300–600jt, 2KT 700jt–1,5M. Prime (Pakuwon/Ciputra) lebih tinggi. Budget Anda?
Customer : 700jt–1 M
AI       : Tipe & tujuan?
Customer : 2 kamar, buat ditinggali sendiri
AI       : Prioritas dekat mall & akses lancar?
Customer : Iya, dekat mall
AI       : Cash/KPR & target?
Customer : KPR, 4 bulan
AI       : Siap! Apartemen 2KT dekat mall Surabaya, akses lancar, 700jt–1M, KPR, target 4 bulan!
```

### CASE 14 | Beli | Investasi Yield Tinggi
```
Customer : Beli apartemen yang yield sewanya tinggi
AI       : Untuk yield tinggi: unit kecil (studio/1KT) di lokasi high-demand (dekat kampus/CBD) rotasi cepat. Kota?
Customer : Surabaya, dekat kampus
AI       : Studio dekat ITS/UNAIR yield 6–8%. Budget & cash/KPR?
Customer : 500–700 juta, cash
AI       : Prioritas dekat minimarket & tenang?
Customer : Iya biar penyewa betah
AI       : Target?
Customer : 3 bulan
AI       : Siap! Apartemen studio dekat kampus Surabaya (yield 6–8%), dekat minimarket + tenang, 500–700jt, cash, target 3 bulan!
```

### CASE 15 | Beli | Marah (inden molor)
```
Customer : Beli apartemen inden, sudah 3 tahun belum jadi-jadi! Kapok
AI       : Maaf sekali — proyek mangkrak memang risiko inden. Untuk yang ini saya sarankan unit READY/serah terima, bukan inden. Setuju?
Customer : Iya, mau yang sudah jadi aja
AI       : Kriteria & budget?
Customer : 2 kamar, dekat mall, max 1 M cash
AI       : Area?
Customer : Surabaya Barat
AI       : Saya carikan unit READY (bukan inden) 2KT dekat mall Surabaya Barat, max 1M cash — legalitas & serah terima jelas. Update 24 jam!
```

### CASE 16 | Beli | Untuk Ditinggali, Dekat Kantor
```
Customer : beli apartemen buat ditinggali, dekat kantor di CBD
AI       : Praktis untuk kurangi macet! Kantor di area mana?
Customer : Sungkono / HR Muhammad
AI       : Apartemen dekat situ: Ciputra World, Educity Sungkono. Tipe unit?
Customer : 2 kamar
AI       : Prioritas akses lancar & dekat mall/cafe?
Customer : Iya, biar hidup praktis
AI       : Budget & cash/KPR?
Customer : 1–1,5 M, KPR
AI       : Target?
Customer : 5 bulan
AI       : Siap! Apartemen 2KT dekat CBD Sungkono/HR Muhammad (akses lancar + dekat mall & cafe), 1–1,5M, KPR, target 5 bulan!
```

### CASE 17 | Beli | First Timer (edukasi strata)
```
Customer : Pertama kali beli apartemen, apa bedanya sama rumah?
AI       : Bagus ditanyakan! Apartemen: kepemilikan strata title (SHMSRS), ada iuran pengelolaan (IPL) bulanan, fasilitas bersama (pool/gym). Sudah paham? Mau lanjut cari?
Customer : Oke paham, mau cari yang buat investasi
AI       : Kota & budget?
Customer : Surabaya, 500–800 juta
AI       : Prioritas dekat kampus/mall (mudah disewakan)?
Customer : Dekat kampus
AI       : Cash/KPR & target?
Customer : Cash, 3 bulan
AI       : Siap! Apartemen dekat kampus Surabaya (SHMSRS, IPL wajar), 500–800jt, cash, target 3 bulan, investasi. Saya bantu cek IPL & fasilitas juga!
```

### CASE 18 | Beli | Unit Second (resale)
```
Customer : Cari apartemen second yang murah di Surabaya
AI       : Unit second bisa lebih murah & sudah furnished. Area & budget?
Customer : Surabaya Barat, 400–600 juta
AI       : Tipe unit?
Customer : Studio atau 1 kamar
AI       : Saya cek kondisi unit & pastikan sertifikat + IPL tidak nunggak ya. Prioritas dekat mall?
Customer : Iya dekat mall & minimarket
AI       : Cash/KPR & target?
Customer : Cash, 3 bulan
AI       : Siap! Apartemen second studio/1KT Surabaya Barat dekat mall + minimarket (sertifikat & IPL clear), 400–600jt, cash, target 3 bulan!
```

### CASE 19 | Beli | Multi-Unit Investor
```
Customer : Sudah punya 2 unit apartemen, mau tambah 2 lagi
AI       : Portofolio berkembang! Fokus di area yang sama atau diversifikasi?
Customer : Mau diversifikasi, coba dekat CBD
AI       : Dekat CBD (Sungkono/HR Muhammad) demand sewa profesional tinggi. Tipe & budget total?
Customer : 2 unit 2KT, total 2–2,5 M
AI       : Prioritas akses lancar & dekat mall (magnet penyewa)?
Customer : Iya
AI       : Cash & target?
Customer : Cash, 4 bulan
AI       : Siap! 2 unit apartemen 2KT dekat CBD Surabaya (akses lancar + dekat mall), total 2–2,5M, cash, target 4 bulan, ekspansi portofolio!
```

### CASE 20 | Beli | WA Singkat
```
Customer : beli apart educity sby studio 550jt cash 3bln invest deket its
AI       : Prioritas dekat minimarket buat penyewa?
Customer : iya
AI       : Siap! Apartemen studio Educity Surabaya dekat ITS + minimarket, 550jt, cash, target 3 bulan, investasi!
```

---
*File: 02_SKILL_APARTMENT_CHAT.md | Elevan Property Chatbot Skills v2.0*

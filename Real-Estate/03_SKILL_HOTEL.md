# SKILL: HOTEL — Panduan Respons Chatbot Property
**Tipe Property:** Hotel
**Transaksi:** Sewa (Booking) & Beli
**Total Case:** 35 (15 Sewa + 20 Beli)

---

## 🔧 ATURAN KHUSUS HOTEL

### Terminologi:
- "Sewa" = Booking / Reservasi kamar hotel
- "Beli" = Akuisisi aset hotel (bangunan/properti hotel)
- Sewa|Kontrak|Booking|Book = sama artinya → SEWA

### Slot Tambahan:
```json
{
  "room_type": null,
  "duration_nights": null,
  "star_rating": null,
  "check_in_date": null,
  "check_out_date": null,
  "breakfast_included": null,
  "hotel_purpose": null
}
```

### Catatan Sewa Hotel:
- Budget biasanya per malam (bukan per bulan)
- Durasi dalam hitungan malam/hari
- Check-in / check-out date penting
- Tujuan (bisnis/liburan/medis/acara) mempengaruhi rekomendasi

---

## ═══════════════════════════════════════
## BAGIAN A: SEWA / BOOKING HOTEL (15 CASE)
## ═══════════════════════════════════════

---

### CASE S-01 | Booking Hotel | Customer Normal / Lengkap

```
Customer : Saya mau booking hotel di Surabaya
AI       : Siap membantu! Hotel di Surabaya — boleh saya tahu tujuan menginapnya? (Bisnis, liburan, acara keluarga, atau lainnya?)
Customer : Untuk acara pernikahan keluarga
AI       : Menarik! Di area Surabaya mana hotelnya — dekat lokasi venue pernikahan atau ada area tertentu yang diinginkan?
Customer : Dekat PTC atau daerah Surabaya Barat
AI       : Fasilitas hotel apa yang penting? Kolam renang, gym, ballroom, atau lainnya?
Customer : Kolam renang, WiFi, dan kalau bisa ada ballroom untuk family gathering kecil
AI       : Budget per malam yang direncanakan?
Customer : 800 ribu sampai 1,5 juta per malam
AI       : Nanti menginap bersama siapa? (Pasangan, keluarga, solo?)
Customer : Saya, istri, dan 2 anak
AI       : Tanggal check-in dan check-out rencananya?
Customer : Check-in 15 Juli, check-out 18 Juli — 3 malam
AI       : Tipe kamar yang diinginkan? Family room, connecting room, atau suite?
Customer : Family room atau connecting room untuk 4 orang
AI       : Sarapan perlu diinclude?
Customer : Iya, breakfast for 4 sudah include lebih baik
AI       : Apakah ada pilihan hotel yang sudah dipertimbangkan, atau mau saya rekomendasikan?
Customer : Rekomendasikan saja
AI       : Siap! Hotel Surabaya Barat dekat PTC, kolam + WiFi + ballroom, 800 ribu–1,5 juta/malam, family room/connecting 4 orang, 15–18 Juli (3 malam), breakfast included. Saya carikan yang terbaik!
```

---

### CASE S-02 | Booking Hotel | Customer Malas Ketik

```
Customer : booking hotel surabaya
AI       : Tanggal check-in & out?
Customer : 20-23 juli
AI       : Area mana?
Customer : PTC
AI       : Budget/malam?
Customer : 800k-1.5jt
AI       : Berapa tamu & tipe kamar?
Customer : 4 org, family room
AI       : Breakfast included?
Customer : iya
AI       : Fasilitas wajib?
Customer : kolam renang
AI       : Siap! Hotel dekat PTC Sby, 800k–1,5jt/mlm, family room 4 org, 20–23 Juli, breakfast + kolam. Carikan!
```

---

### CASE S-03 | Booking Hotel | Info Terbatas / Ambigu

```
Customer : cari hotel yang bagus di Bali
AI       : Siap! Ada banyak pilihan di Bali. Untuk membantu filter — tujuan kunjungan ke Bali? (Liburan, honeymoon, bisnis, dll?)
Customer : Liburan keluarga
AI       : Area di Bali mana yang Anda inginkan? Kuta, Seminyak, Nusa Dua, Ubud, atau area lain?
Customer : Yang enak buat anak-anak
AI       : Untuk keluarga dengan anak, Nusa Dua atau Jimbaran paling cocok — tenang, pantai bersih, banyak resort family-friendly. Sesuai?
Customer : Iya cocok
AI       : Budget per malam untuk kamar?
Customer : Yang worth it lah, tidak mau yang murahan tapi tidak perlu yang bintang 5 juga
AI       : Range 500 ribu–1,5 juta per malam masuk di harapan Anda?
Customer : Iya sekitar segitu
AI       : Tanggal check-in dan check-out?
Customer : Libur lebaran, sekitar 10 hari
AI       : Tanggal pastinya bulan apa?
Customer : Bulan April kalau tidak ada perubahan
AI       : Berapa orang yang menginap?
Customer : Saya, istri, 2 anak (7 dan 10 tahun)
AI       : Tipe kamar yang dibutuhkan? Family room atau connecting?
Customer : Family room cukup
AI       : Breakfast termasuk?
Customer : Iya kalau bisa
AI       : Siap! Hotel/resort family-friendly di Nusa Dua–Jimbaran Bali, 500 ribu–1,5 juta/malam, family room 4 orang, April 10 hari, breakfast included. Saya carikan yang banyak aktivitas anak!
```

---

### CASE S-04 | Booking Hotel | Customer Tanya Harga Duluan

```
Customer : Hotel bintang 4 di Jakarta berapa per malamnya?
AI       : Di Jakarta, hotel bintang 4 biasanya 500 ribu–1,5 juta per malam, tergantung area dan fasilitas. Hotel bintang 4 di Jakpus/Jaksel bisa lebih tinggi. Apakah untuk tujuan bisnis atau liburan?
Customer : Bisnis, meeting besok pagi
AI       : Urgent ya! Di area Jakarta mana meetingnya?
Customer : SCBD
AI       : Untuk dekat SCBD, ada beberapa pilihan bintang 4 di range 700 ribu–1,2 juta. Check-in malam ini atau besok?
Customer : Malam ini
AI       : Berapa malam?
Customer : 1 malam saja
AI       : Sendirian atau ada kolega?
Customer : Sendiri, business trip
AI       : Butuh breakfast?
Customer : Iya, termasuk breakfast
AI       : Siap! Hotel bintang 4 dekat SCBD Jakarta, 700 ribu–1,2 juta/malam, 1 malam, 1 orang, check-in malam ini, breakfast included. Saya cari yang tersedia sekarang!
```

---

### CASE S-05 | Booking Hotel | Customer Marah / Frustrasi

```
Customer : Sudah coba booking sendiri susah banget! Semua hotel yang bagus di Yogyakarta penuh
AI       : Waah, itu sangat frustasi! Terutama kalau sudah pesan mendadak. Saya bantu cari alternatif. Tanggal berapa yang Anda butuhkan?
Customer : Tanggal 14-16 Agustus, 2 malam. Itu kan libur kemerdekaan, makanya penuh
AI       : Betul, long weekend kemerdekaan memang paling padat. Di area Yogyakarta mana yang Anda inginkan?
Customer : Dekat Malioboro atau Prambanan, mau wisata
AI       : Budget per malamnya?
Customer : 500 ribu sampai 1 juta
AI       : Berapa orang yang menginap?
Customer : Berdua sama pasangan
AI       : Tipe kamar?
Customer : Superior atau Deluxe biasa
AI       : Breakfast perlu?
Customer : Iya
AI       : Karena tanggal peak season, ada kemungkinan saya juga perlu cek opsi di Sleman atau Bantul yang juga dekat Prambanan. Bersedia dengan alternatif area?
Customer : Oke asal dekat Prambanan atau Malioboro masih bisa
AI       : Saya langsung cek ketersediaan untuk 14–16 Agustus, 2 malam, berdua, 500 ribu–1 juta/malam, breakfast. Termasuk area sekitar!
```

---

### CASE S-06 | Booking Hotel | Customer Ganti-Ganti Keputusan

```
Customer : Mau book hotel di Lombok bulan Agustus
AI       : Lombok di area mana — Senggigi, Kuta Lombok, Gili Trawangan, atau Mandalika?
Customer : Gili Trawangan bagus ya? Tapi Kuta Lombok juga seru...
AI       : Keduanya punya karakter berbeda. Gili T lebih ramai dan party vibe, Kuta Lombok lebih tenang dan surfing. Anda tipe yang mana?
Customer : Hmm, saya sama keluarga termasuk anak-anak
AI       : Kalau dengan anak-anak, Kuta Lombok atau Senggigi lebih family-friendly. Gili T minim kendaraan bermotor tapi transportasi ke sana perlu perahu.
Customer : Oke, Senggigi aja lebih gampang
AI       : Tanggal check-in dan check-out?
Customer : 10–15 Agustus... eh mungkin 12–15 biar tidak terlalu panjang
AI       : Oke, 12–15 Agustus, 3 malam. Budget per malam?
Customer : 600 ribu–1 juta
AI       : Berapa orang?
Customer : 4 orang, 2 dewasa 2 anak
AI       : Tipe kamar?
Customer : Family room... atau connecting lebih baik?
AI       : Family room biasanya lebih murah dan cukup untuk 2 anak kecil. Connecting lebih privacy tapi harganya bisa 30–40% lebih mahal. Anak masih kecil?
Customer : 5 dan 8 tahun, family room cukup
AI       : Breakfast?
Customer : Iya
AI       : Siap! Hotel di Senggigi Lombok, 12–15 Agustus, 3 malam, family room 4 orang, 600 ribu–1 juta/malam, breakfast included!
```

---

### CASE S-07 | Booking Hotel | Customer Tidak Tahu Yang Mau (Pertama ke Kota)

```
Customer : mau cari hotel di Surabaya, pertama kali ke sana
AI       : Selamat datang ke Surabaya! Untuk membantu rekomendasi terbaik — tujuan ke Surabaya untuk apa? Bisnis, wisata, atau keperluan lain?
Customer : Wisata, mau lihat kota pahlawan
AI       : Bagus! Untuk wisata di Surabaya, area Hotel Tunjungan atau Gubeng paling strategis — dekat Tugu Pahlawan, Jalan Braga, dan pusat kota. Sesuai?
Customer : Iya, yang strategis
AI       : Budget per malam?
Customer : Belum tahu, berapa yang wajar?
AI       : Untuk wisata bintang 3 nyaman di Surabaya, range 350–700 ribu per malam sudah bagus. Bintang 4 lebih ke 600 ribu–1,2 juta. Mana yang lebih sesuai?
Customer : Bintang 3 yang bagus cukup
AI       : Tanggal check-in dan berapa malam?
Customer : Minggu depan, mungkin 3 hari
AI       : Tanggal pastinya?
Customer : Hmm 18-21 Juni
AI       : Berapa orang?
Customer : Saya sendiri
AI       : Tipe kamar?
Customer : Standard single
AI       : Breakfast include?
Customer : Kalau ada include bagus, kalau tidak ada juga tidak apa
AI       : Siap! Hotel bintang 3 di area Tunjungan–Gubeng Surabaya, 350–700 ribu/malam, single room, 18–21 Juni (3 malam), 1 orang, breakfast value-add!
```

---

### CASE S-08 | Booking Hotel | Customer Untuk Keperluan Bisnis

```
Customer : Cari hotel di Jakarta untuk business trip seminggu
AI       : Siap! Hotel untuk business trip seminggu di Jakarta. Meeting di area mana?
Customer : Gatot Subroto dan Kuningan, sering bolak-balik
AI       : Area Semanggi atau Gatot Subroto sendiri paling strategis untuk itu. Budget per malam?
Customer : 800 ribu sampai 1,5 juta, kantor yang reimburse
AI       : Tanggal check-in dan check-out?
Customer : 24 Juni – 1 Juli, 7 malam
AI       : Tipe kamar untuk solo business trip?
Customer : Deluxe single atau Superior, yang punya meja kerja
AI       : Fasilitas yang penting untuk bisnis?
Customer : WiFi kencang, gym untuk refresh, laundry service
AI       : Breakfast include?
Customer : Iya, sekalian sarapan hemat waktu
AI       : Perlu meeting room di hotel?
Customer : Tidak perlu, meeting di kantor klien
AI       : Siap! Hotel bintang 4 area Gatot Subroto–Kuningan Jakarta, meja kerja + WiFi kencang + gym + laundry, 800 ribu–1,5 juta/malam, deluxe single, 24 Juni–1 Juli (7 malam), breakfast. Saya carikan yang paling efisien untuk business trip!
```

---

### CASE S-09 | Booking Hotel | Customer Honeymoon

```
Customer : Mau cari hotel honeymoon di Bali
AI       : Selamat untuk pernikahannya yang akan datang! Honeymoon di Bali — ada area impian? Seminyak, Ubud, Nusa Dua, atau Uluwatu?
Customer : Mau yang romantis dan tenang, plus pantai
AI       : Uluwatu atau Nusa Dua cocok untuk yang romantis sekaligus pantai premium. Seminyak lebih vibrant tapi juga indah. Mana yang lebih sesuai suasana yang diinginkan?
Customer : Uluwatu kedengarannya sempurna
AI       : Budget per malam?
Customer : 1,5 juta – 3 juta, honeymoon sekali seumur hidup
AI       : Tanggal check-in dan berapa malam?
Customer : 5 September, 5 malam
AI       : Tipe kamar? Villa private pool atau suite dengan ocean view?
Customer : Villa private pool, impian sekali
AI       : Fasilitas tambahan yang diinginkan? Candle dinner, spa couple, atau aktivitas tertentu?
Customer : Candle dinner malam pertama, spa couple, dan snorkeling kalau ada
AI       : Breakfast termasuk?
Customer : Iya, breakfast in bed kalau bisa
AI       : Indah sekali rencananya! Siap: Villa private pool honeymoon di Uluwatu Bali, ocean view, 1,5–3 juta/malam, 5–10 September (5 malam), candle dinner + spa couple + breakfast in bed!
```

---

### CASE S-10 | Booking Hotel | Customer Tanya Promo / Diskon

```
Customer : Ada promo hotel di Surabaya bulan ini?
AI       : Ada beberapa hotel yang punya promo reguler, terutama menjelang akhir bulan atau untuk pemesanan lebih dari 3 malam. Di area Surabaya mana yang Anda incar?
Customer : Sekitar Pakuwon atau Surabaya Barat
AI       : Tanggal check-in dan berapa malam?
Customer : Weekend ini, 2 malam, 22-24 Juni
AI       : Budget per malam (setelah diskon)?
Customer : Idealnya 500-800 ribu
AI       : Berapa orang dan tipe kamar?
Customer : Berdua, superior room
AI       : Breakfast included atau room only lebih hemat?
Customer : Breakfast included kalau ada promo
AI       : Siap! Saya cek promo hotel di Pakuwon–Surabaya Barat, 22–24 Juni (2 malam), berdua, superior room, target 500–800 ribu/malam, breakfast. Saya carikan penawaran terbaik termasuk promo!
```

---

### CASE S-11 | Booking Hotel | Customer Butuh Late Check-Out

```
Customer : Cari hotel di Bandung yang bisa late check-out sampai jam 3 sore
AI       : Kebutuhan yang sering diminta! Banyak hotel yang menawarkan late check-out dengan biaya tambahan atau gratis tergantung ketersediaan. Di area Bandung mana?
Customer : Dago atau Lembang
AI       : Tanggal check-in dan berapa malam?
Customer : Besok 1 malam, check-in sore ini
AI       : Wah, urgent ya! Budget per malam?
Customer : 600 ribu–1 juta
AI       : Berapa orang?
Customer : Sendiri, staycation
AI       : Tipe kamar?
Customer : Deluxe atau Superior, yang ada bath tub lebih bagus
AI       : Breakfast termasuk?
Customer : Tidak perlu
AI       : Saya langsung cek ketersediaan hotel di Dago–Lembang Bandung yang bisa late check-out hingga jam 15.00, 1 malam, check-in sore ini, 600 ribu–1 juta, deluxe/bath tub, room only!
```

---

### CASE S-12 | Booking Hotel | Customer Grup / Rombongan

```
Customer : Booking hotel di Malang untuk grup 20 orang
AI       : Booking grup besar! Di area Malang mana — pusat kota, Batu, atau sekitarnya?
Customer : Kota Malang, tapi kalau Batu dekat wisata juga bisa
AI       : Untuk 20 orang, apakah mau kamar single-single atau ada yang sharing?
Customer : Campuran: 5 kamar double, 5 kamar twin, dan 2 kamar single. Total 12 kamar
AI       : Tujuan rombongan — kantor, keluarga besar, atau lainnya?
Customer : Family gathering, reuni keluarga
AI       : Budget total per malam atau per kamar?
Customer : Per kamar 400–700 ribu
AI       : Tanggal check-in dan check-out?
Customer : 28–30 Juni, 2 malam
AI       : Perlu meeting room atau ruang gathering?
Customer : Iya, ruang makan bersama kalau bisa dinner bareng
AI       : Breakfast included untuk semua?
Customer : Iya
AI       : Siap! Hotel di Malang (pusat/Batu), 12 kamar (5 double + 5 twin + 2 single), 400–700 ribu/kamar/malam, 28–30 Juni, ruang gathering + dinner bareng, breakfast. Saya cari yang bisa akomodasi 20 orang sekaligus!
```

---

### CASE S-13 | Booking Hotel | Customer Minta yang Dekat Venue Pernikahan

```
Customer : Perlu hotel dekat ballroom di Surabaya untuk tamu undangan pernikahan
AI       : Momen spesial! Ballroom atau venue pernikahannya di mana di Surabaya?
Customer : Di Shangri-La Hotel Surabaya
AI       : Kalau venuenya di Shangri-La, paling praktis tamu menginap di sana atau hotel yang sangat dekat. Budget per kamar per malam?
Customer : 600 ribu–1,5 juta tergantung kamar
AI       : Berapa total kamar yang perlu disiapkan?
Customer : Sekitar 15 kamar
AI       : Tanggal pernikahannya?
Customer : 12 Oktober
AI       : Check-in 11 Oktober dan check-out 13 Oktober (2 malam)?
Customer : Iya betul
AI       : Mix kamar apa? Superior, Deluxe, atau ada yang butuh suite untuk VIP?
Customer : 10 kamar Superior, 3 Deluxe, 2 suite untuk keluarga inti
AI       : Breakfast termasuk?
Customer : Iya untuk semua tamu
AI       : Siap! 15 kamar (10 Superior + 3 Deluxe + 2 Suite) di/dekat Shangri-La Surabaya, 11–13 Oktober (2 malam), breakfast all. Saya akan hubungi pihak hotel untuk block booking tamu pernikahan!
```

---

### CASE S-14 | Booking Hotel | Customer Tanya Rating/Review

```
Customer : Hotel di Surabaya yang rating-nya bagus dong, minimal 4.5 bintang di Google
AI       : Siap! Ada beberapa hotel di Surabaya dengan rating 4.5+ di Google. Boleh tahu area yang diinginkan dan tanggal menginap?
Customer : Surabaya Pusat, minggu depan 2 malam
AI       : Tanggal pastinya?
Customer : 25-27 Juni
AI       : Budget per malam?
Customer : 800 ribu sampai 1,5 juta
AI       : Berapa orang dan tipe kamar?
Customer : Berdua, superior atau deluxe
AI       : Tujuan menginap — bisnis atau liburan?
Customer : Liburan
AI       : Breakfast termasuk?
Customer : Iya
AI       : Fasilitas yang diinginkan?
Customer : Kolam renang dan spa kalau ada
AI       : Siap! Hotel rating 4.5+ di Surabaya Pusat, kolam + spa, 800 ribu–1,5 juta/malam, superior/deluxe, 25–27 Juni (2 malam), berdua, breakfast included!
```

---

### CASE S-15 | Booking Hotel | Customer WA Singkat

```
Customer : hotel sby surabaya 3 malam
AI       : Tanggal & area?
Customer : 20-23 juli, deket tp
AI       : Budget/malam & berapa orang?
Customer : 800k-1.5jt, 2 org
AI       : Tipe kamar & breakfast?
Customer : deluxe, breakfast ya
AI       : Siap! Hotel dekat TP Surabaya, 20–23 Juli (3 malam), 800k–1,5jt/malam, deluxe 2 orang, breakfast. Carikan!
```

---

## ═══════════════════════════════════════
## BAGIAN B: BELI HOTEL (20 CASE)
## ═══════════════════════════════════════

---

### CASE B-01 | Beli Hotel | Customer Normal / Lengkap

```
Customer : Saya mau beli properti hotel
AI       : Menarik! Pembelian properti hotel adalah investasi besar. Di kota atau area mana yang Anda pertimbangkan?
Customer : Bali, sekitar Seminyak atau Canggu
AI       : Area prime untuk hospitality! Untuk hotel yang Anda cari — beli hotel operasional yang sudah berjalan, atau lahan/bangunan untuk dikembangkan menjadi hotel?
Customer : Hotel operasional yang sudah berjalan, mau langsung dapat revenue
AI       : Berapa kamar minimal yang Anda inginkan?
Customer : Minimal 20–30 kamar
AI       : Budget pembelian di kisaran berapa?
Customer : 15–30 miliar rupiah
AI       : Sudah punya pengalaman di industri hospitality sebelumnya?
Customer : Tidak langsung, tapi mau hire management yang berpengalaman
AI       : Target beli kapan?
Customer : 6 bulan ke depan
AI       : KPR komersial, cash, atau kombinasi?
Customer : Kombinasi, 50% cash 50% KPR komersial
AI       : Apakah ada bintang tertentu yang diinginkan? 2, 3, atau 4 bintang?
Customer : 3 bintang atau boutique yang kualitasnya setara 4 bintang
AI       : Siap! Hotel operasional di Seminyak/Canggu Bali, 20–30 kamar, bintang 3/boutique, 15–30 M, 50% cash + 50% KPR komersial, target 6 bulan. Saya carikan yang sudah berjalan dan profitable!
```

---

### CASE B-02 | Beli Hotel | Customer Malas Ketik

```
Customer : beli hotel di bali
AI       : Area Bali mana?
Customer : kuta atau seminyak
AI       : Hotel operasional atau lahan?
Customer : operasional
AI       : Budget?
Customer : 10-20M
AI       : Berapa kamar?
Customer : min 15 kamar
AI       : Cash atau KPR?
Customer : cash
AI       : Target?
Customer : 3-6 bln
AI       : Bintang berapa?
Customer : 2-3 bintang
AI       : Siap! Hotel operasional Kuta/Seminyak Bali, min 15 kamar, bintang 2–3, 10–20 M, cash, target 3–6 bulan. Carikan!
```

---

### CASE B-03 | Beli Hotel | Info Terbatas / Ambigu

```
Customer : mau beli hotel yang bagus buat investasi
AI       : Investasi yang sangat menarik! Di Indonesia, ada beberapa area yang paling populer untuk investasi hotel. Apakah Anda sudah punya area tertentu di pikiran?
Customer : Yang paling menguntungkan
AI       : Untuk ROI tertinggi di sektor hotel saat ini: Bali (Seminyak, Canggu, Nusa Dua), Lombok (Mandalika), dan Labuan Bajo. Bali paling liquid, Mandalika dan Labuan Bajo emerging. Mana yang menarik?
Customer : Bali lebih aman ya untuk pertama kali
AI       : Sangat tepat, Bali paling liquid dan mature. Area Bali mana yang Anda pertimbangkan?
Customer : Yang kira-kira paling ramai turis
AI       : Kuta/Legian paling ramai mass market. Seminyak–Canggu premium. Nusa Dua high-end. Budget Anda berapa?
Customer : Sekitar 5–15 miliar
AI       : Di range itu di Bali, Anda bisa dapat boutique hotel 10–20 kamar di Seminyak atau hostel berkualitas di Kuta. Cash atau KPR?
Customer : Cash lebih simpel
AI       : Hotel operasional atau bangun dari nol?
Customer : Operasional, langsung dapat pendapatan
AI       : Target beli kapan?
Customer : Dalam tahun ini
AI       : Berapa kamar minimal?
Customer : 10 kamar minimal
AI       : Siap! Hotel operasional di Bali, 10+ kamar, 5–15 M, cash, target tahun ini. Saya carikan yang sudah punya track record occupancy bagus!
```

---

### CASE B-04 | Beli Hotel | Customer Tanya Harga Duluan

```
Customer : Harga beli hotel di Bali berapa?
AI       : Sangat bervariasi! Boutique hotel 10 kamar di Seminyak bisa 8–20 miliar. Hotel 30–50 kamar 25–80 miliar. Resort bintang 4 bisa ratusan miliar. Tergantung lokasi, kamar, dan kondisi. Area Bali mana yang Anda minati?
Customer : Canggu, 15–20 kamar
AI       : Di Canggu, boutique hotel 15–20 kamar saat ini range 12–35 miliar, tergantung kondisi dan track record occupancy. Budget Anda di kisaran berapa?
Customer : 15–25 miliar
AI       : Masuk di range itu. Hotel operasional atau lahan kosong?
Customer : Operasional, sudah ada tamu
AI       : Cash atau KPR?
Customer : Cash
AI       : Target beli?
Customer : 6 bulan
AI       : Bintang atau konsep tertentu?
Customer : Boutique, konsep hip/instagram-able yang sesuai tren Canggu
AI       : Siap! Boutique hotel operasional di Canggu Bali, 15–20 kamar, konsep trendy, 15–25 M, cash, target 6 bulan. Saya carikan yang occupancy-nya bagus dan konsepnya Instagram-able!
```

---

### CASE B-05 | Beli Hotel | Customer Marah / Frustrasi

```
Customer : Sudah deal mau beli hotel di Lombok tapi di menit terakhir penjual mundur! Ada alternatif?
AI       : Sangat frustasi, terutama kalau sudah hampir deal. Saya bantu carikan alternatif. Di Lombok area mana yang Anda incar sebelumnya?
Customer : Sekitar Mandalika
AI       : Area Mandalika sangat berkembang pesat setelah sirkuit MotoGP. Budget yang sudah Anda siapkan?
Customer : 10–18 miliar
AI       : Hotel operasional atau lahan untuk dikembangkan?
Customer : Operasional, atau lahan dengan izin sudah ada
AI       : Cash atau KPR?
Customer : Cash, sudah siap
AI       : Berapa kamar minimal?
Customer : 15–25 kamar
AI       : Target seberapa cepat (mengingat dana sudah siap)?
Customer : Secepat mungkin, dana menganggur
AI       : Siap prioritaskan! Hotel/lahan berIzin di Mandalika Lombok, 15–25 kamar, 10–18 M, cash, secepatnya. Saya juga carikan alternatif terdekat dari area yang gagal deal itu!
```

---

### CASE B-06 | Beli Hotel | Customer Ganti-Ganti Keputusan

```
Customer : Mau beli hotel, tadinya mau di Bali tapi sekarang kepikiran Yogyakarta
AI       : Keduanya menarik untuk investasi hotel! Pertimbangan apa yang membuat Anda berpikir ke Yogyakarta?
Customer : Bali mahal, Jogja mungkin lebih terjangkau. Tapi turis Bali lebih banyak
AI       : Betul! Bali lebih liquid dan occupancy lebih stabil. Jogja lebih terjangkau tapi lebih seasonal (tergantung event dan liburan). Budget Anda berapa?
Customer : 8–15 miliar
AI       : Di Jogja range itu bisa dapat hotel 15–25 kamar yang bagus. Di Bali mungkin lebih kecil atau area yang lebih berkembang seperti Ubud. Masih belum putuskan kota?
Customer : Hmm, mungkin Bali saja ya, lebih aman
AI       : Baik, Bali. Area mana?
Customer : Seminyak... atau Ubud kayaknya lebih budget
AI       : Ubud dengan 8–15 M bisa dapat boutique 15–20 kamar. Seminyak mungkin 10–15 kamar. Mau saya carikan keduanya untuk perbandingan?
Customer : Iya boleh, compare keduanya
AI       : Hotel operasional atau lahan?
Customer : Operasional
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Siap! Komparasi hotel operasional: Seminyak vs Ubud Bali, 10–20 kamar, 8–15 M, cash, target 4 bulan. Nanti Anda pilih yang lebih sesuai!
```

---

### CASE B-07 | Beli Hotel | Customer Tidak Tahu (Pertama Investasi Hotel)

```
Customer : mau investasi hotel tapi belum pernah sebelumnya, dari mana mulai?
AI       : Bagus sekali pertanyaannya! Investasi hotel itu berbeda dari investasi properti biasa karena ada komponen operasional. Pertama, ada dua pendekatan: (1) Beli hotel operasional dan hire management, atau (2) Beli unit kamar hotel (strata title) di hotel brand tertentu. Yang mana lebih sesuai minat Anda?
Customer : Apa bedanya?
AI       : Hotel operasional: Anda punya seluruh aset, pengelolaan lebih kompleks, return lebih tinggi tapi risiko juga lebih tinggi. Unit strata title: Anda beli 1-2 kamar di hotel, management oleh operator, lebih pasif, return lebih predictable. Untuk pemula, strata title sering lebih disarankan. Tertarik?
Customer : Kayaknya strata title lebih mudah untuk mulai
AI       : Tepat! Di kota mana Anda pertimbangkan?
Customer : Bali atau Yogyakarta
AI       : Bali occupancy lebih stabil. Budget Anda?
Customer : 500 juta–1 miliar
AI       : Di range itu, Anda bisa beli unit strata title di beberapa hotel di Bali dengan return sewa 8–12% per tahun. KPR atau cash?
Customer : Cash
AI       : Target beli?
Customer : Dalam setahun ini
AI       : Siap! Unit strata title hotel di Bali, 500 juta–1 M, cash, target setahun. Saya carikan yang operator-nya terpercaya dan track record ROI-nya bagus!
```

---

### CASE B-08 | Beli Hotel | Customer Investor Berpengalaman

```
Customer : Saya sudah punya 2 hotel di Bali, mau tambah di luar Bali. Mana yang paling potensial sekarang?
AI       : Dengan 2 hotel di Bali, Anda sudah punya basis yang kuat. Untuk diversifikasi, beberapa area yang saat ini naik daun: Mandalika Lombok (pasca-MotoGP), Labuan Bajo NTT (wisata premium), Raja Ampat Papua (ekowisata), dan Batam (dekat Singapura, corporate travel). Ada yang sudah Anda riset?
Customer : Mandalika saya sudah lihat, menarik. Labuan Bajo juga. Mana yang lebih liquid?
AI       : Mandalika lebih liquid karena infrastruktur sudah jelas (bandara, jalan, sirkuit). Labuan Bajo lebih high-end tapi masih berkembang. Budget untuk properti berikutnya?
Customer : 20–50 miliar, ini serius
AI       : Hotel operasional atau greenfield?
Customer : Greenfield oke, saya punya kontraktor dan operator
AI       : Luas lahan minimal yang Anda butuhkan?
Customer : Minimal 2.000 m², untuk 25–40 kamar
AI       : Cash atau financing?
Customer : Cash, lebih cepat
AI       : Target?
Customer : 3 bulan untuk deal, pembangunan belakangan
AI       : Saya akan carikan lahan strategis di Mandalika dan Labuan Bajo, min 2.000 m², 20–50 M, cash, siap deal dalam 3 bulan. Saya siapkan juga analisis perbandingan kedua area untuk keputusan Anda!
```

---

### CASE B-09 | Beli Hotel | Customer Minta Hotel Boutique

```
Customer : Mau beli hotel boutique di Indonesia, yang konsepnya unik
AI       : Suka sekali permintaan ini! Hotel boutique dengan konsep unik sedang sangat trend. Area mana yang Anda pertimbangkan?
Customer : Jogja atau Solo, suka kota budaya
AI       : Pilihan yang tepat untuk boutique heritage! Di Jogja, area Kotagede atau dekat Keraton punya banyak bangunan heritage yang bisa dikonversi. Di Solo, Laweyan atau Baluwarti. Mana yang lebih menarik?
Customer : Jogja, lebih ramai turisnya
AI       : Budget?
Customer : 5–12 miliar
AI       : Hotel yang sudah ada (konversi/renovasi) atau bangun baru?
Customer : Konversi dari bangunan lama, lebih berkarakter
AI       : Cash atau KPR?
Customer : Cash
AI       : Berapa kamar yang ideal?
Customer : 8–15 kamar, kecil tapi eksklusif
AI       : Target beli?
Customer : 4 bulan
AI       : Siap! Bangunan/hotel heritage untuk konversi boutique di Jogja (Kotagede/Keraton area), 8–15 kamar, 5–12 M, cash, target 4 bulan. Saya carikan yang punya nilai arsitektur tinggi untuk konsep unik!
```

---

### CASE B-10 | Beli Hotel | Customer Tanya ROI

```
Customer : Kalau beli hotel di Bali 15 miliar, ROI-nya kira-kira berapa?
AI       : Pertanyaan yang tepat sebelum invest! Secara umum: hotel boutique di Bali yang well-managed bisa ROI 10–15% per tahun dari revenue operasional, dengan payback period 7–10 tahun. Tapi ini sangat tergantung lokasi, occupancy rate, dan efisiensi operasional. Untuk yang lebih akurat, saya butuh detail propertinya. Apakah ada properti spesifik yang Anda pertimbangkan?
Customer : Masih cari, budget sekitar 15 miliar di Seminyak
AI       : Seminyak occupancy rata-rata 75–85% di high season. Untuk 15 M di Seminyak, bisa dapat boutique 12–20 kamar. Dengan ADR (Average Daily Rate) 700 ribu–1,2 juta dan occupancy 70%, estimasi revenue kotor sekitar 2–3 M per tahun. Setelah biaya operasional 40–50%, net income sekitar 1–1,5 M/tahun → ROI 7–10%. Sesuai ekspektasi?
Customer : Hmm, kayaknya 10% lebih baik. Ada area yang lebih optimal?
AI       : Canggu saat ini ADR-nya lebih tinggi untuk boutique konsep modern, bisa ROI 10–14% kalau positioning-nya bagus. Budget tetap 15 M?
Customer : Iya
AI       : Hotel operasional atau lahan?
Customer : Operasional
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 6 bulan
AI       : Siap! Hotel operasional di Canggu Bali, 15 M, cash, target 6 bulan, fokus yang ROI 10%+. Saya sertakan analisis keuangan untuk setiap pilihan!
```

---

### CASE B-11 | Beli Hotel | Customer Tanya Izin dan Legalitas

```
Customer : Kalau beli hotel di Bali, izin apa yang perlu dicek?
AI       : Pertanyaan yang sangat penting! Izin utama yang harus dicek sebelum beli hotel di Bali: (1) Izin HO (Gangguan), (2) Sertifikat Laik Fungsi, (3) Tanda Daftar Usaha Pariwisata (TDUP), (4) NPWP Usaha, (5) Izin BPJS Ketenagakerjaan karyawan, (6) Status lahan (HGB/SHMSRS — bukan SHM jika WNA), dan (7) Izin lingkungan jika dekat pantai/sawah. Apakah Anda sudah punya properti spesifik yang mau dibeli?
Customer : Masih cari, budget 10–20 M di Seminyak
AI       : Baik. Selain izin, cek juga: occupancy rate 12 bulan terakhir, laporan keuangan 2–3 tahun, kontrak karyawan, dan kontrak OTA (Agoda, Booking.com, dll). Mau lanjut cari propertinya?
Customer : Iya, ada rekomendasi?
AI       : Hotel operasional atau lahan?
Customer : Operasional
AI       : Berapa kamar?
Customer : 15–25 kamar
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Siap! Hotel operasional Seminyak Bali, 15–25 kamar, 10–20 M, cash, target 4 bulan — lengkap dengan due diligence izin!
```

---

### CASE B-12 | Beli Hotel | Customer Budget Terbatas

```
Customer : Mau beli hotel tapi budget terbatas, sekitar 3-5 miliar
AI       : Dengan 3–5 miliar masih bisa masuk pasar hotel di beberapa kota! Bali mungkin terlalu mahal untuk hotel operasional di range itu, tapi di kota wisata lain masih bisa. Area mana yang Anda pertimbangkan?
Customer : Jogja atau Malang, lebih terjangkau
AI       : Betul! Di Jogja atau Malang, 3–5 M bisa dapat guesthouse 8–12 kamar atau hotel budget yang sudah operasional. Hotel operasional atau lahan?
Customer : Operasional
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 6 bulan
AI       : Berapa kamar minimal?
Customer : 8 kamar sudah cukup untuk mulai
AI       : Konsep tertentu?
Customer : Yang sudah punya pelanggan tetap, homestay atau guest house oke
AI       : Siap! Guesthouse/hotel budget operasional di Jogja atau Malang, min 8 kamar, 3–5 M, cash, target 6 bulan. Saya carikan yang sudah punya recurring customer!
```

---

### CASE B-13 | Beli Hotel | Customer Minta Hotel Dekat Bandara

```
Customer : Mau beli hotel transit dekat bandara, mana yang paling potensial?
AI       : Hotel transit dekat bandara adalah ceruk yang bagus dengan permintaan konsisten! Bandara yang paling besar trafiknya di Indonesia: Soekarno-Hatta (Tangerang), Ngurah Rai (Bali), Juanda (Surabaya). Mana yang Anda pertimbangkan?
Customer : Soekarno-Hatta atau Juanda, mana yang lebih ramai?
AI       : Soekarno-Hatta jauh lebih ramai (trafik terbesar Indonesia), tapi properti juga lebih mahal. Juanda Surabaya juga ramai dan harga propertinya lebih terjangkau. Budget Anda?
Customer : 8–15 miliar
AI       : Di range itu, Surabaya dekat Juanda lebih feasible — bisa dapat hotel 20–30 kamar. Di dekat Soetta butuh minimum 20–30 M untuk skala serupa. Mana yang lebih sesuai?
Customer : Surabaya lebih masuk budget
AI       : Hotel operasional atau greenfield?
Customer : Operasional, langsung jalan
AI       : Cash atau KPR?
Customer : KPR komersial
AI       : Berapa kamar minimal?
Customer : 20 kamar
AI       : Target beli?
Customer : 6 bulan
AI       : Siap! Hotel transit operasional dekat Bandara Juanda Surabaya, min 20 kamar, 8–15 M, KPR komersial, target 6 bulan!
```

---

### CASE B-14 | Beli Hotel | Customer Minta Hotel Syariah

```
Customer : Ada hotel syariah yang bisa dibeli di Jawa Tengah?
AI       : Ada! Hotel syariah sedang berkembang pesat di kota-kota dengan mayoritas wisatawan Muslim. Di Jawa Tengah: Solo, Semarang, Magelang (dekat Borobudur) punya demand bagus. Mana yang paling menarik?
Customer : Solo, saya dari sana
AI       : Keuntungan investor lokal — tahu market! Budget pembelian?
Customer : 5–10 miliar
AI       : Berapa kamar yang ideal?
Customer : 15–25 kamar
AI       : Hotel yang sudah beroperasi atau bangun dari awal?
Customer : Sudah operasional, langsung dapat pendapatan
AI       : Cash atau KPR?
Customer : Cash
AI       : Apakah sudah ada sertifikasi halal dari MUI yang Anda inginkan, atau itu bisa diurus setelah akuisisi?
Customer : Lebih baik sudah ada, tapi bisa juga urus sendiri
AI       : Target beli?
Customer : 4 bulan
AI       : Siap! Hotel syariah operasional di Solo, 15–25 kamar, 5–10 M, cash, target 4 bulan. Saya prioritaskan yang sudah atau mudah mendapat sertifikasi halal MUI!
```

---

### CASE B-15 | Beli Hotel | Customer Tanya Manajemen Hotel

```
Customer : Mau beli hotel tapi tidak punya pengalaman kelola hotel. Bagaimana?
AI       : Sangat wajar pertanyaan itu! Ada beberapa model untuk investor tanpa pengalaman operasional: (1) Hire General Manager berpengalaman, (2) Franchise/brand agreement (Aston, Whiz, Favehotel, dll) — mereka bantu SOP, (3) Management contract dengan operator profesional, (4) Bergabung dengan hotel chain yang ambil alih operasional penuh. Mana yang paling menarik?
Customer : Opsi 3 kedengarannya paling tenang, management contract
AI       : Tepat untuk investor pasif. Beberapa operator terpercaya: Archipelago, Tauzia, PHRI partners. Revenue sharing biasanya 60–70% untuk owner. Di kota mana Anda cari propertinya?
Customer : Bali, mau yang sudah punya operator
AI       : Budget?
Customer : 15–25 miliar
AI       : Hotel yang sudah ada management contract-nya atau Anda mau cari operasional sendiri lalu kontrakkan?
Customer : Yang sudah ada management contract lebih ideal
AI       : Cash atau KPR?
Customer : Cash
AI       : Berapa kamar?
Customer : 20–35 kamar
AI       : Target?
Customer : 6 bulan
AI       : Siap! Hotel operasional di Bali, 20–35 kamar, 15–25 M, cash, target 6 bulan, sudah ada atau mudah mendapatkan management contract dengan operator profesional!
```

---

### CASE B-16 | Beli Hotel | Customer Minta Konversi Ruko Jadi Hotel

```
Customer : Punya 3 ruko bersebelahan di Surabaya, mau dikonversi jadi hotel. Feasible?
AI       : Menarik! Konversi ruko jadi hotel boutique itu feasible dan sedang tren. Pertanyaan kunci: (1) Lokasi ruko di mana? (2) Berapa luas total? (3) Sudah punya IMB atau perlu revisi? Boleh ceritakan detailnya?
Customer : Di jalan Dharmahusada, luas total sekitar 600 m², 3 lantai. IMB belum untuk hotel
AI       : Dharmahusada bagus, dekat kampus dan rumah sakit — demand kuat untuk hotel transit/medis. 600 m² 3 lantai, estimasi bisa dibangun 15–20 kamar. Sudah ada gambaran konsep?
Customer : Belum, tapi mau yang bintang 2-3
AI       : Untuk konversi, biaya estimasi di Surabaya sekitar 3–5 juta/m², jadi total renovasi 1,8–3 M. Plus biaya IMB hotel, izin TDUP, dll sekitar 200–500 juta. Total investasi Anda?
Customer : Budget untuk renovasi 3-5 miliar
AI       : Feasible! Timeline estimasi 12–18 bulan. Apakah Anda perlu bantuan arsitektur dan perizinan juga?
Customer : Iya, butuh semuanya
AI       : Target selesai?
Customer : 2 tahun dari sekarang
AI       : Siap! Saya bantu seluruh prosesnya: konsultasi desain konversi ruko–hotel di Dharmahusada Surabaya, budget renovasi 3–5 M, bintang 2–3, target 2 tahun. Saya koordinasikan dengan tim arsitek dan perizinan kami!
```

---

### CASE B-17 | Beli Hotel | Customer Ganti Arah ke Resort

```
Customer : Tadinya mau beli hotel kota di Surabaya, sekarang kepikiran resort di Malang
AI       : Pergeseran menarik! Hotel kota vs resort punya model bisnis berbeda. Apa yang membuat Anda berpikir ke resort?
Customer : Dengar-dengar resort di Malang (Batu) lagi naik daun
AI       : Betul, Kota Batu sangat berkembang. Malang kota lebih stable tapi Batu occupancy-nya bisa sangat tinggi di high season. Budget Anda?
Customer : 10–20 miliar
AI       : Operasional atau lahan?
Customer : Operasional dulu yang lebih aman
AI       : Cash atau KPR?
Customer : Cash
AI       : Berapa kamar?
Customer : 20–40 kamar, ada kolam renang karena resort
AI       : Target beli?
Customer : 4–6 bulan
AI       : Mau saya carikan keduanya — hotel kota Surabaya dan resort Batu Malang — untuk perbandingan sebelum memutuskan?
Customer : Iya bagus itu
AI       : Siap! Komparasi: hotel kota Surabaya vs resort Batu Malang, 20–40 kamar, kolam renang, 10–20 M, cash, target 4–6 bulan!
```

---

### CASE B-18 | Beli Hotel | Customer Butuh Perkiraan Cash Flow

```
Customer : Mau beli hotel di Yogyakarta 8 miliar, bisa kasih simulasi cash flow-nya?
AI       : Tentu! Simulasi dasar untuk hotel boutique 15 kamar di Jogja dengan harga akuisisi 8 M: ADR (Average Daily Rate) estimasi 300–500 ribu/malam. Occupancy rate rata-rata: 60–70% (Jogja seasonalitas tinggi). Revenue kamar tahunan: 15 kamar × 65% × 365 hari × 400 ribu = ~1,4 M/tahun. Biaya operasional (gaji, utilitas, OTA commission, dll) ~50–55% = ~700 juta. EBITDA = ~700 juta/tahun. Gross yield = 700 juta / 8 M = ~8,75%. Payback period ~11 tahun. Sesuai ekspektasi?
Customer : Hmm, 11 tahun agak lama. Ada yang bisa lebih cepat?
AI       : Untuk payback lebih cepat: (1) beli di harga lebih rendah (6–7 M), (2) tambah revenue dari F&B atau event, (3) optimize occupancy ke 75%+. Dengan itu bisa ke 8–9 tahun. Mau saya carikan properti di range 6–8 M di Jogja?
Customer : Iya, budget 6-8 miliar lebih baik
AI       : Hotel operasional atau lahan?
Customer : Operasional
AI       : Cash atau KPR?
Customer : Cash
AI       : Berapa kamar?
Customer : 10–20 kamar
AI       : Target?
Customer : 4 bulan
AI       : Siap! Hotel operasional di Yogyakarta, 10–20 kamar, 6–8 M, cash, target 4 bulan. Saya sertakan cash flow projection untuk setiap pilihan!
```

---

### CASE B-19 | Beli Hotel | Customer Tanya Tentang Brand Franchise

```
Customer : Mau beli hotel di Surabaya, mending independent atau join franchise brand?
AI       : Pertanyaan strategis! Keduanya ada kelebihan dan kekurangan. Independent: fleksibilitas total, margin lebih tinggi, tapi harus bangun brand sendiri dan harder untuk online visibility. Franchise (Aston, Whiz, Favehotel): brand awareness langsung, booking engine bawaan, training & SOP tersedia, tapi ada royalty fee 4–8% revenue. Untuk investor baru, franchise lebih disarankan untuk kestabilan. Anda sudah punya pengalaman?
Customer : Belum, pertama kali beli hotel
AI       : Kalau pertama kali, franchise lebih aman. Budget Anda?
Customer : 12–20 miliar
AI       : Di range itu di Surabaya, brand seperti Whiz atau Favehotel sangat feasible. Berapa kamar?
Customer : 25–40 kamar
AI       : Cash atau KPR?
Customer : KPR komersial
AI       : Target beli?
Customer : 6 bulan
AI       : Siap! Hotel di Surabaya 25–40 kamar, 12–20 M, KPR komersial, target 6 bulan, disertai analisis perbandingan independent vs franchise dan rekomendasi brand yang paling sesuai!
```

---

### CASE B-20 | Beli Hotel | Customer WA Singkat

```
Customer : beli hotel bali budget 15m
AI       : Area Bali mana?
Customer : seminyak
AI       : Berapa kamar & operasional?
Customer : 15-20 kamar, operasional
AI       : Cash/KPR & target?
Customer : cash, 6 bln
AI       : Siap! Hotel operasional Seminyak Bali, 15–20 kamar, 15M, cash, target 6 bulan. Carikan!
```

---

## 📋 RINGKASAN SLOT DATA — HOTEL

| Slot | Sewa (Booking) | Beli | Keterangan |
|------|----------------|------|------------|
| transaction_type | ✅ | ✅ | sewa/booking/beli |
| location | ✅ | ✅ | Kota + area |
| purpose | ✅ | ✅ | Bisnis/wisata/investasi |
| budget | ✅ | ✅ | Per malam (sewa) / total (beli) |
| check_in_date | ✅ | ❌ | Tanggal masuk |
| duration_nights | ✅ | ❌ | Berapa malam |
| room_type | ✅ | ❌ | Standard/deluxe/suite/family |
| star_rating | ⭕ | ⭕ | Bintang preferensi |
| breakfast | ✅ | ❌ | Include/room only |
| facilities | ✅ | ✅ | Kolam, gym, ballroom |
| guests | ✅ | ❌ | Jumlah tamu |
| rooms_count | ❌ | ✅ | Minimal kamar (beli) |
| operational | ❌ | ✅ | Operasional/lahan |
| financing | ❌ | ✅ | Cash/KPR komersial |
| management | ❌ | ✅ | Self/franchise/contract |

---

*File: 03_SKILL_HOTEL.md | Elevan Property Chatbot Skills v1.0*

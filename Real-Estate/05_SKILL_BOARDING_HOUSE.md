# SKILL: BOARDING HOUSE / KOS-KOSAN — Panduan Respons Chatbot Property
**Tipe Property:** Boarding House (Kos-Kosan)
**Transaksi:** Sewa & Beli
**Total Case:** 35 (15 Sewa + 20 Beli)

---

## 🔧 ATURAN KHUSUS BOARDING HOUSE

### Terminologi:
- Sewa = Ngekos / Sewa kamar kos (per bulan, bisa harian/mingguan untuk kos harian)
- Beli = Beli aset bangunan kos-kosan

### Slot Tambahan:
```json
{
  "room_size": null,
  "bathroom_type": "dalam/luar",
  "kos_type": "putra/putri/campur",
  "payment_period": "harian/mingguan/bulanan",
  "include_meals": null
}
```

---

## ═══════════════════════════════════════
## BAGIAN A: SEWA KOS (15 CASE)
## ═══════════════════════════════════════

---

### CASE S-01 | Sewa Kos | Customer Normal / Lengkap
```
Customer : Saya mau cari kos di Surabaya
AI       : Siap! Kos di area Surabaya mana? Dekat kampus, kantor, atau lokasi tertentu?
Customer : Dekat ITS Sukolilo, saya mahasiswa baru
AI       : Baik, sekitar ITS Sukolilo. Kos putra, putri, atau campur?
Customer : Kos putri
AI       : Fasilitas yang wajib ada?
Customer : AC, kamar mandi dalam, WiFi
AI       : Budget per bulan?
Customer : 1,2 juta sampai 2 juta
AI       : Kamar mau yang ukuran standar atau besar?
Customer : Standar cukup, yang penting bersih
AI       : Kapan mau masuk?
Customer : Awal Agustus, masuk semester
AI       : Mau yang sudah include listrik atau ada meteran sendiri?
Customer : Include listrik lebih praktis
AI       : Siap! Kos putri dekat ITS Sukolilo, AC + kamar mandi dalam + WiFi, 1,2–2 juta/bulan, standar, masuk Agustus, listrik include!
```

---

### CASE S-02 | Sewa Kos | Malas Ketik
```
Customer : kos surabaya
AI       : Area mana & kos putra/putri?
Customer : timur, putra
AI       : Budget/bln & fasilitas wajib?
Customer : 1-1.5jt, ac wifi
AI       : Dekat kampus/kantor mana?
Customer : ubaya
AI       : Kapan masuk?
Customer : agustus
AI       : Kamar mandi dalam atau luar?
Customer : dalam
AI       : Siap! Kos putra dekat UBAYA Sby Timur, AC + WiFi + KM dalam, 1–1,5jt/bln, masuk Agustus!
```

---

### CASE S-03 | Sewa Kos | Info Terbatas / Ambigu
```
Customer : cari kos yang enak di Jakarta
AI       : Siap! Di Jakarta area mana yang Anda butuhkan? Dekat kampus, kantor, atau ada patokan lokasi tertentu?
Customer : yang strategis aja
AI       : "Strategis" bisa beda-beda — strategis buat kerja, kuliah, atau mobilitas umum? Boleh tahu aktivitas utama Anda di Jakarta?
Customer : kerja, di Kuningan
AI       : Kos dekat Kuningan yang populer: area Tebet, Mampang, atau Pancoran. Ada preferensi area?
Customer : yang paling dekat
AI       : Tebet atau Mampang biasanya paling dekat Kuningan via Transjakarta. Budget per bulan?
Customer : yang standar aja buat karyawan
AI       : Range 1,5–3 juta/bulan untuk kos karyawan AC di area itu. Sesuai?
Customer : iya sekitar segitu
AI       : Kos putra, putri, atau campur?
Customer : campur
AI       : Fasilitas yang wajib ada?
Customer : AC dan WiFi, kamar mandi dalam lebih bagus
AI       : Kapan masuk?
Customer : bulan depan
AI       : Siap! Kos campur dekat Kuningan (Tebet/Mampang), AC + WiFi + KM dalam, 1,5–3 juta/bulan, masuk bulan depan!
```

---

### CASE S-04 | Sewa Kos | Tanya Harga Duluan
```
Customer : Kos di Bandung daerah Dago berapa per bulan?
AI       : Di Dago Bandung, kos dengan AC mulai 800 ribu (KM luar) hingga 2,5 juta (AC + KM dalam + WiFi). Tergantung ukuran kamar dan fasilitas. Anda cari untuk kuliah atau kerja?
Customer : Kuliah di ITB
AI       : Mahasiswa ITB, area Dago sangat strategis! Fasilitas yang harus ada?
Customer : AC, WiFi, kamar mandi dalam
AI       : Budget yang dianggarkan per bulan?
Customer : Kalau bisa 1–1,5 juta
AI       : Di Dago dengan kriteria itu range 1,2–2 juta. Bisa stretch ke 1,5 juta?
Customer : Oke, max 1,5 juta deh
AI       : Kos putra?
Customer : Iya
AI       : Kapan masuk?
Customer : Juli, sebelum KRS
AI       : Kamar ukuran standar atau besar?
Customer : Standar cukup
AI       : Siap! Kos putra di Dago Bandung dekat ITB, AC + KM dalam + WiFi, max 1,5 juta/bulan, standar, masuk Juli!
```

---

### CASE S-05 | Sewa Kos | Marah / Frustrasi
```
Customer : Udah keliling cari kos di Jogja dari tadi, semua penuh atau mahal. Tolong bantu!
AI       : Wah, melelahkan sekali, apalagi kalau sudah jalan jauh. Saya bantu dari sini. Di area Jogja mana yang Anda cari?
Customer : Sudah coba Sleman dan Condongcatur, semua penuh
AI       : Musim masuk kuliah memang sangat kompetitif. Budget per bulan Anda?
Customer : 800 ribu sampai 1,2 juta
AI       : Fasilitas yang wajib ada?
Customer : Minimal AC, WiFi. Kamar mandi boleh luar tapi bersih
AI       : Kos putra, putri, atau campur?
Customer : Putra
AI       : Kapan butuhnya?
Customer : Segera, minggu ini kalau bisa
AI       : Boleh sedikit fleksibel area? Mungkin Bantul Utara atau Mlati yang masih terjangkau?
Customer : Oke asal masih bisa akses ke UGM naik motor
AI       : Siap! Saya prioritaskan cari kos putra yang tersedia minggu ini, AC + WiFi, 800 ribu–1,2 juta/bulan, area Jogja yang masih terjangkau dan bisa akses UGM. Saya balik dalam 1 jam ya!
```

---

### CASE S-06 | Sewa Kos | Ganti-Ganti Keputusan
```
Customer : Mau cari kos di Malang
AI       : Area Malang mana? Dekat kampus atau kantor?
Customer : Dekat UB... tapi mungkin Lowokwaru juga oke
AI       : Dekat UB dan Lowokwaru sebenarnya berdekatan — Lowokwaru itu kecamatannya. Fasilitas yang diinginkan?
Customer : AC, WiFi... eh, tapi kalau tidak ada AC bisa pakai kipas. Budget mepet
AI       : Budget per bulan berapa?
Customer : 700 ribu... tapi mungkin bisa 900 ribu kalau bagus
AI       : Di 700–900 ribu dekat UB biasanya AC tidak include, tapi kipas + KM luar bisa. Mau yang kamar mandi dalam?
Customer : Kalau ada KM dalam bagus, tapi luar juga mau. Yang penting bersih
AI       : Kos putra?
Customer : Iya, eh putri... saya perempuan maaf
AI       : Tidak masalah! Kos putri ya. Kapan masuk?
Customer : Agustus... atau September tergantung penerimaan
AI       : Saya carikan dan simpan dulu. Kos putri dekat UB/Lowokwaru Malang, 700–900 ribu/bulan, kipas/AC, bersih, masuk Agustus–September!
```

---

### CASE S-07 | Sewa Kos | Tidak Tahu Yang Mau (Pertama Ngekos)
```
Customer : pertama kali mau ngekos, bingung harus mulai dari mana
AI       : Selamat mau ngekos pertama kali! Normal bingung. Pertama — di kota mana Anda akan tinggal?
Customer : Surabaya, mau kerja pertama kali
AI       : Kantornya di area Surabaya mana?
Customer : Di Rungkut
AI       : Untuk dekat Rungkut, area MERR atau Medokan Ayu banyak kos karyawan. Tahu budget per bulan yang nyaman di kantong?
Customer : Gaji UMR, berapa yang wajar?
AI       : Biasanya idealnya tidak lebih dari 25–30% gaji untuk kos. UMR Surabaya sekitar 4,5 juta, jadi idealnya kos max 1,1–1,3 juta. Sesuai?
Customer : Iya itu masuk akal
AI       : Fasilitas yang paling penting menurut Anda?
Customer : Yang penting bisa tidur nyaman, ada listrik, air lancar
AI       : AC atau kipas cukup?
Customer : AC lebih nyaman, tapi kalau terlalu mahal kipas oke
AI       : Kos putra?
Customer : Iya
AI       : Kamar mandi dalam atau luar tidak masalah?
Customer : Dalam lebih bagus, pertama kali mau yang nyaman
AI       : Kapan masuk?
Customer : Bulan depan
AI       : Siap! Kos putra dekat Rungkut Surabaya, AC + KM dalam + WiFi, 1–1,3 juta/bulan, masuk bulan depan!
```

---

### CASE S-08 | Sewa Kos | Kos Harian / Jangka Pendek
```
Customer : Ada kos harian di Surabaya tidak?
AI       : Ada! Kos harian biasanya 100–250 ribu per malam tergantung fasilitas. Untuk keperluan apa di Surabaya?
Customer : Urusan medis di RSUD Dr. Soetomo, mungkin seminggu
AI       : Paham, keperluan medis — penting dapat tempat yang dekat dan nyaman. Area sekitar RSUD Soetomo yang diinginkan?
Customer : Yang paling dekat rumah sakitnya
AI       : Budget per malam atau per hari?
Customer : Sekitar 150–200 ribu per malam
AI       : Berapa orang yang menginap?
Customer : Berdua, menemani anggota keluarga yang berobat
AI       : Perlu AC dan kamar mandi dalam?
Customer : Iya, penting
AI       : Perkiraan berapa hari?
Customer : 7 hari, tapi mungkin bisa lebih
AI       : Saya carikan kos harian dekat RSUD Soetomo, 2 orang, AC + KM dalam, 150–200 ribu/malam, 7 hari, bisa diperpanjang!
```

---

### CASE S-09 | Sewa Kos | Kos Premium / Executive
```
Customer : Cari kos executive di Jakarta, budget tidak masalah asal bagus
AI       : Siap carikan kos premium! Di Jakarta ada banyak kos executive dengan fasilitas bintang. Area mana yang paling strategis untuk Anda?
Customer : Jaksel, dekat Kuningan atau Sudirman
AI       : Area tersebut punya banyak kos executive modern. Fasilitas apa yang Anda inginkan?
Customer : Smart TV, AC inverter, KM dalam dengan water heater, dapur bersama, gym kalau ada
AI       : Budget per bulan?
Customer : 4–7 juta tidak masalah
AI       : Kos putra atau campur?
Customer : Campur
AI       : Kapan masuk?
Customer : Bulan depan
AI       : Ukuran kamar preferensi?
Customer : Yang luas, minimal 4x4 meter
AI       : Siap! Kos executive campur di Kuningan–Sudirman Jaksel, smart TV + AC inverter + water heater + dapur + gym, 4–7 juta/bulan, kamar luas min 4x4, masuk bulan depan!
```

---

### CASE S-10 | Sewa Kos | Minta Kos dengan Makan
```
Customer : Ada kos yang sudah include makan di Yogyakarta?
AI       : Ada! Kos dengan makan (pondokan) masih banyak di Jogja, terutama di area kampus. Di area mana Anda butuhkan?
Customer : Dekat UGM Bulaksumur
AI       : Budget per bulan include makan?
Customer : 1,5–2,5 juta all-in
AI       : Kos putra, putri, atau campur?
Customer : Putri
AI       : Berapa kali makan per hari?
Customer : 2 kali, pagi dan malam
AI       : Kapan masuk?
Customer : Agustus
AI       : Fasilitas lain yang wajib ada?
Customer : WiFi dan kipas/AC
AI       : Siap! Kos putri dekat UGM, include 2x makan, WiFi, AC/kipas, 1,5–2,5 juta/bulan all-in, masuk Agustus!
```

---

### CASE S-11 | Sewa Kos | Karyawan Baru Pindah Kota
```
Customer : Baru dapat kerja di Surabaya, butuh kos segera
AI       : Selamat kerjanya! Kantornya di area Surabaya mana?
Customer : Di kawasan SIER Rungkut
AI       : Kawasan industri SIER — area Rungkut dan sekitarnya banyak kos karyawan. Budget per bulan?
Customer : 1–1,5 juta
AI       : Kos putra?
Customer : Iya
AI       : Fasilitas minimal yang dibutuhkan?
Customer : AC, WiFi, kamar mandi dalam
AI       : Kapan butuh masuknya?
Customer : 2 minggu lagi, sebelum masuk kerja
AI       : Baik, butuh cepat! Ada kebutuhan khusus lain? Parkir motor?
Customer : Iya parkir motor penting
AI       : Siap! Kos putra dekat SIER Rungkut, AC + WiFi + KM dalam + parkir motor, 1–1,5 juta/bulan, tersedia dalam 2 minggu!
```

---

### CASE S-12 | Sewa Kos | Minta Kamar Besar untuk WFH
```
Customer : Cari kos di Bandung yang kamarnya besar, saya WFH
AI       : Remote worker butuh ruang kerja — sangat masuk akal! Di Bandung area mana?
Customer : Dago atau Ciumbuleuit, suka yang sejuk
AI       : Area paling sejuk di Bandung! Ukuran minimal kamar yang Anda butuhkan?
Customer : Minimal 4x5 meter, butuh meja kerja
AI       : Budget per bulan?
Customer : 2–3,5 juta
AI       : Kos putra, putri, atau campur?
Customer : Campur
AI       : Fasilitas wajib?
Customer : WiFi kencang wajib, AC, KM dalam dengan water heater
AI       : Kapan masuk?
Customer : Bulan depan
AI       : Siap! Kos campur di Dago/Ciumbuleuit Bandung, kamar besar 4x5m+, WiFi kencang + AC + KM dalam + water heater + meja kerja, 2–3,5 juta/bulan, masuk bulan depan!
```

---

### CASE S-13 | Sewa Kos | Cari Kos Dekat RS untuk Dokter/Perawat
```
Customer : Cari kos dekat RSCM Jakarta untuk dokter residen
AI       : Kos untuk dokter residen — faham kebutuhannya, butuh yang dekat dan bisa istirahat dengan nyaman. Di area mana dekat RSCM yang diinginkan?
Customer : Salemba atau Cikini, yang paling dekat
AI       : Budget per bulan?
Customer : 2–3 juta
AI       : Putra atau putri?
Customer : Putri
AI       : Fasilitas yang paling penting?
Customer : Kamar mandi dalam, AC, WiFi, dan yang paling penting keamanan 24 jam
AI       : Kapan masuk?
Customer : Minggu depan, sudah urgent
AI       : Siap! Kos putri dekat RSCM di Salemba–Cikini, AC + KM dalam + WiFi + keamanan 24 jam, 2–3 juta/bulan, tersedia minggu depan. Saya prioritaskan!
```

---

### CASE S-14 | Sewa Kos | Pasangan Baru Menikah Cari Kos Couple
```
Customer : Baru menikah, cari kos couple di Surabaya
AI       : Selamat menikah! Kos couple atau kos campur yang menerima pasangan suami-istri. Di area Surabaya mana?
Customer : Surabaya Pusat, dekat tempat kerja berdua
AI       : Berdua kerja di Surabaya Pusat — area mana tepatnya?
Customer : Suami di Tunjungan, saya di Gubeng
AI       : Tengah-tengahnya sekitar Embong Malang atau Ketabang. Sesuai?
Customer : Iya bisa
AI       : Budget per bulan untuk kos berdua?
Customer : 2–3 juta
AI       : Fasilitas yang wajib ada?
Customer : AC, KM dalam, dapur kecil kalau ada, WiFi
AI       : Kapan masuk?
Customer : 2 minggu lagi
AI       : Siap! Kos couple di Embong Malang/Ketabang Surabaya, AC + KM dalam + WiFi, dapur jadi nilai plus, 2–3 juta/bulan, masuk 2 minggu lagi!
```

---

### CASE S-15 | Sewa Kos | WA Singkat
```
Customer : kos jogja deket ugm putri
AI       : Budget & fasilitas?
Customer : max 1.2jt, ac wifi km dalam
AI       : Kapan masuk?
Customer : agustus
AI       : Siap! Kos putri dekat UGM Jogja, AC + WiFi + KM dalam, max 1,2jt/bln, masuk Agustus!
```

---

## ═══════════════════════════════════════
## BAGIAN B: BELI KOST-KOSTAN (20 CASE)
## ═══════════════════════════════════════

---

### CASE B-01 | Beli Kost | Normal / Lengkap
```
Customer : Saya mau beli kost-kostan untuk investasi
AI       : Investasi properti yang cerdas! Di kota mana Anda pertimbangkan?
Customer : Surabaya, dekat kampus
AI       : Kampus mana yang Anda incar pasarnya?
Customer : ITS atau UNAIR
AI       : Area yang bagus untuk keduanya! Berapa kamar yang Anda inginkan?
Customer : Minimal 10 kamar
AI       : Budget pembelian totalnya?
Customer : 1,5–3 miliar
AI       : Kost yang sudah operasional atau lahan untuk bangun baru?
Customer : Operasional lebih baik, langsung dapat pemasukan
AI       : Cash atau KPR?
Customer : Cash
AI       : Target beli kapan?
Customer : 3 bulan ke depan
AI       : Kost yang sudah ada pemilik kelola atau perlu manajemen baru?
Customer : Kalau ada pengelola yang bisa diteruskan lebih bagus
AI       : Siap! Kost-kostan operasional 10+ kamar dekat ITS/UNAIR Surabaya, 1,5–3 M, cash, target 3 bulan, dengan pengelola yang bisa dilanjutkan!
```

---

### CASE B-02 | Beli Kost | Malas Ketik
```
Customer : beli kost jogja invest
AI       : Dekat kampus mana?
Customer : ugm
AI       : Budget & berapa kamar?
Customer : 1-2M, min 8 kamar
AI       : Cash/KPR & target?
Customer : cash, 3 bln
AI       : Operasional atau lahan?
Customer : operasional
AI       : Siap! Kost operasional 8+ kamar dekat UGM Jogja, 1–2M, cash, target 3 bulan!
```

---

### CASE B-03 | Beli Kost | Info Terbatas / Ambigu
```
Customer : mau investasi kost yang menguntungkan
AI       : Kost memang salah satu investasi properti paling stabil! Di kota mana Anda pertimbangkan?
Customer : Yang paling besar pasarnya
AI       : Untuk kost, kota dengan demand terbesar: Surabaya (banyak kampus besar), Yogyakarta (kota pelajar), Bandung (kampus + wisata), Jakarta (karyawan). Mana yang paling dekat dengan domisili atau akses Anda?
Customer : Surabaya lebih kenal kotanya
AI       : Bagus! Area Surabaya yang paling kuat untuk kost: sekitar ITS, UNAIR, UNESA. Budget Anda?
Customer : Sekitar 1–2 miliar
AI       : Di range itu bisa dapat kost 8–15 kamar yang sudah operasional. Cash atau KPR?
Customer : Cash
AI       : Berapa kamar minimal?
Customer : 10 kamar
AI       : Target beli?
Customer : 6 bulan
AI       : Kost putra, putri, atau campur?
Customer : Campur supaya fleksibel
AI       : Siap! Kost campur operasional 10+ kamar di Surabaya dekat kampus, 1–2M, cash, target 6 bulan!
```

---

### CASE B-04 | Beli Kost | Tanya Harga Duluan
```
Customer : Harga beli kost-kostan di Yogyakarta berapa?
AI       : Di Yogyakarta, kost-kostan 10–15 kamar operasional berkisar 800 juta–1,5 miliar tergantung lokasi dan fasilitas. Yang dekat UGM/UNY biasanya lebih mahal. Budget Anda?
Customer : 800 juta sampai 1,2 miliar
AI       : Masuk! Di range itu bisa dapat yang dekat kampus dengan 8–12 kamar. Berapa kamar minimal?
Customer : 10 kamar
AI       : Area Jogja mana yang Anda targetkan?
Customer : Dekat UGM atau UNY
AI       : Cash atau KPR?
Customer : Cash
AI       : Target beli?
Customer : 4 bulan
AI       : Kost operasional atau lahan baru?
Customer : Operasional lebih baik
AI       : Siap! Kost operasional 10+ kamar dekat UGM/UNY Jogja, 800 juta–1,2M, cash, target 4 bulan!
```

---

### CASE B-05 | Beli Kost | Marah / Frustrasi
```
Customer : Sudah 4 bulan cari kost untuk dibeli di Bandung, selalu ada saja masalahnya. Bantu!
AI       : Saya mengerti frustrasinya. 4 bulan itu benar-benar melelahkan. Apa yang paling sering jadi masalah dari kost yang Anda lihat?
Customer : Kalau lokasinya bagus harganya di atas budget, kalau harganya cocok kondisi bangunan jelek
AI       : Klasik! Mari kita clear dulu. 3 hal yang benar-benar non-negotiable untuk Anda?
Customer : 1. Dekat ITB atau Unpad, 2. Max 1,5 M, 3. Minimal 10 kamar
AI       : Tiga kriteria yang sangat jelas. Cash atau KPR?
Customer : Cash, dana sudah siap
AI       : Target seberapa cepat?
Customer : Secepat mungkin, sudah sangat siap
AI       : Siap! Kost 10+ kamar dekat ITB/Unpad Bandung, max 1,5M, cash — saya prioritaskan dan hubungi Anda dalam 24 jam dengan pilihan terbaik yang tersedia!
```

---

### CASE B-06 | Beli Kost | Ganti-Ganti Keputusan
```
Customer : mau beli kost di Surabaya
AI       : Area mana di Surabaya?
Customer : Dekat ITS... tapi mungkin dekat UNAIR lebih baik?
AI       : Keduanya bagus! ITS (Sukolilo) lebih banyak mahasiswa teknik, UNAIR (Dharmahusada–Airlangga) campuran. Budget Anda berapa?
Customer : 1,5 miliar... atau mungkin 2 M kalau kondisi bagus
AI       : Di 1,5–2 M di dua area itu bisa dapat 12–18 kamar. Berapa minimal kamar yang diinginkan?
Customer : 12 kamar... kalau dapat 15 lebih bagus sih
AI       : Cash atau KPR?
Customer : Cash
AI       : Target beli?
Customer : 3 bulan... mungkin 4 bulan, tergantung temuan
AI       : Kost putra, putri, atau campur?
Customer : Putra dulu... eh campur lebih fleksibel ya?
AI       : Betul, kost campur lebih fleksibel dari sisi occupancy. Saya carikan kost campur 12–15 kamar dekat ITS dan UNAIR Surabaya, 1,5–2M, cash, target 3–4 bulan. Nanti bisa dibandingkan keduanya!
```

---

### CASE B-07 | Beli Kost | Tidak Tahu Yang Mau (Pertama Investasi)
```
Customer : mau investasi kost pertama kali, harus mulai dari mana?
AI       : Investasi kost itu salah satu yang paling stabil di properti! Mulai dari yang paling dasar: beli kost yang sudah jalan (operasional) atau bangun dari nol?
Customer : Yang sudah jalan lebih aman kan?
AI       : Betul, operasional langsung dapat pemasukan dan sudah ada tenant. Risikonya lebih kecil untuk pemula. Di kota mana Anda pertimbangkan?
Customer : Surabaya atau Malang, mana yang lebih baik?
AI       : Surabaya: pasar lebih besar, harga lebih tinggi. Malang: lebih terjangkau, yield sewa cukup stabil khususnya dekat UB/UMM. Budget Anda?
Customer : Sekitar 1–1,5 miliar
AI       : Di Malang range itu bisa dapat kost 10–15 kamar yang bagus. Di Surabaya mungkin 8–12 kamar. Mana yang lebih menarik?
Customer : Malang lebih terjangkau, pilih Malang
AI       : Area dekat kampus mana?
Customer : Dekat UB
AI       : Cash atau KPR?
Customer : Cash
AI       : Berapa kamar minimal?
Customer : 10 kamar
AI       : Target?
Customer : 6 bulan
AI       : Siap! Kost operasional 10+ kamar dekat UB Malang, 1–1,5M, cash, target 6 bulan. Saya bantu juga analisis yield-nya!
```

---

### CASE B-08 | Beli Kost | Fokus ROI
```
Customer : Mau beli kost, mana yang ROI paling tinggi di Jawa?
AI       : Pertanyaan yang tepat! Secara umum kost di area kampus favorit: Jogja (dekat UGM) ROI 10–14%/tahun, Malang (dekat UB) 9–13%, Surabaya (dekat ITS/UNAIR) 8–12%, Bandung (dekat ITB) 8–11%. Budget Anda?
Customer : 1–2 miliar
AI       : Di range itu, Jogja atau Malang paling optimal ROI-nya. Preferensi kota?
Customer : Jogja
AI       : Kost operasional atau bangun baru?
Customer : Operasional
AI       : Cash atau KPR?
Customer : Cash
AI       : Berapa kamar?
Customer : Min 10 kamar
AI       : Target?
Customer : 3 bulan
AI       : Siap! Kost operasional 10+ kamar di Jogja (dekat UGM), 1–2M, cash, target 3 bulan — saya sertakan analisis ROI untuk setiap opsi!
```

---

### CASE B-09 | Beli Kost | Kost Premium / Executive
```
Customer : Mau beli kost premium untuk karyawan di Jakarta, budget besar
AI       : Kost executive untuk karyawan di Jakarta adalah segmen yang sangat profitable! Area mana yang Anda targetkan?
Customer : Jakarta Selatan, dekat CBD
AI       : Budget pembelian?
Customer : 5–10 miliar
AI       : Di range itu di Jaksel bisa dibangun atau dibeli kost executive 15–25 kamar. Berapa kamar minimal?
Customer : 15–20 kamar
AI       : Cash atau KPR?
Customer : Cash
AI       : Kost existing atau lahan baru?
Customer : Kalau ada bangunan existing yang bisa direnovasi lebih efisien
AI       : Target?
Customer : 6 bulan
AI       : Siap! Kost/properti untuk kost executive 15–20 kamar di Jaksel dekat CBD, 5–10M, cash, target 6 bulan, bisa renovasi existing!
```

---

### CASE B-10 | Beli Kost | WA Singkat
```
Customer : beli kost surabaya dkt ITS 1.5M cash
AI       : Berapa kamar & target?
Customer : 10 kamar, 3 bln
AI       : Operasional atau lahan?
Customer : operasional
AI       : Siap! Kost operasional 10 kamar dekat ITS Surabaya, 1,5M, cash, target 3 bulan!
```

---

### CASE B-11 | Beli Kost | Bangun dari Lahan Kosong
```
Customer : Punya lahan 200 m² di dekat UNESA Surabaya, mau dibangun kost
AI       : Lahan 200 m² di dekat UNESA — sangat strategis! Estimasi bisa dibangun kost 2 lantai dengan 12–16 kamar standar. Atau 3 lantai dengan 18–24 kamar. Sudah ada gambaran konsep?
Customer : Mau yang 2 lantai dulu, 12–15 kamar
AI       : Budget konstruksi yang disiapkan?
Customer : 800 juta sampai 1,2 miliar
AI       : Kost putra, putri, atau campur?
Customer : Putri, lebih aman kata orang
AI       : Target selesai dibangun?
Customer : 12–18 bulan
AI       : Fasilitas per kamar yang diinginkan?
Customer : AC, KM dalam, minimal
AI       : Perlu bantuan desain dan kontraktor, atau hanya konsultasi saja?
Customer : Semua, dari desain sampai jadi
AI       : Siap! Saya bantu proses bangun kost putri 12–15 kamar di lahan 200m² dekat UNESA Surabaya, budget konstruksi 800 juta–1,2M, AC + KM dalam, target 12–18 bulan. Koordinasikan dengan arsitek dan kontraktor kami!
```

---

### CASE B-12 | Beli Kost | Cari Kost Syariah
```
Customer : Mau beli kost syariah di Yogyakarta
AI       : Kost syariah permintaannya sangat stabil! Di Jogja banyak kost syariah terutama dekat UGM dan UII. Area mana yang Anda targetkan?
Customer : Dekat UII Sleman
AI       : Budget?
Customer : 800 juta–1,3 miliar
AI       : Berapa kamar?
Customer : 10–15 kamar
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Kost putra, putri, atau campur?
Customer : Putra dan putri terpisah, atau dua gedung berbeda
AI       : Siap! Kost syariah operasional 10–15 kamar (putra/putri) dekat UII Sleman Jogja, 800 juta–1,3M, cash, target 4 bulan!
```

---

### CASE B-13 | Beli Kost | Minta Data Occupancy
```
Customer : Sebelum beli kost di Malang, bisa minta data occupancy-nya?
AI       : Sangat bijak untuk minta data occupancy sebelum memutuskan! Saya akan bantu dapatkan laporan occupancy 6–12 bulan terakhir dari setiap kost yang kita review. Di area Malang mana yang Anda pertimbangkan?
Customer : Dekat UB atau Universitas Brawijaya
AI       : Budget?
Customer : 1–1,8 miliar
AI       : Berapa kamar minimal?
Customer : 12 kamar
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Siap! Kost operasional 12+ kamar dekat UB Malang, 1–1,8M, cash — saya sertakan data occupancy dan pendapatan bulanan untuk transparansi penuh!
```

---

### CASE B-14 | Beli Kost | Investor Beli Banyak Properti
```
Customer : Sudah punya 2 kost di Surabaya, mau tambah 1 lagi di kota lain
AI       : Portofolio yang bagus! Untuk diversifikasi, kota mana yang Anda pertimbangkan?
Customer : Jogja atau Malang. Mana yang belum terlalu saturated?
AI       : Keduanya masih punya gap demand yang cukup, terutama kost premium dengan fasilitas bagus. Malang sedikit lebih terjangkau. Budget?
Customer : 1,5–2,5 miliar
AI       : Berapa kamar?
Customer : Minimal 15 kamar
AI       : Cash atau KPR?
Customer : Cash, sudah biasa
AI       : Target?
Customer : 3 bulan
AI       : Kost putra/putri/campur?
Customer : Campur, lebih fleksibel
AI       : Mau saya carikan di keduanya untuk perbandingan investasi?
Customer : Iya, compare dulu
AI       : Siap! Kost campur 15+ kamar di Jogja vs Malang, 1,5–2,5M, cash, target 3 bulan. Saya sertakan analisis yield per kota!
```

---

### CASE B-15 | Beli Kost | Budget Terbatas
```
Customer : Mau beli kost tapi budget terbatas, sekitar 500–700 juta
AI       : Masih bisa! Di 500–700 juta Anda bisa dapat kost 5–8 kamar di kota yang harga lahannya lebih terjangkau, atau pertimbangkan beli separuh kost (shared ownership). Di kota mana yang Anda pertimbangkan?
Customer : Malang atau Solo
AI       : Keduanya terjangkau! Di Solo range itu bisa dapat kost 6–8 kamar dekat UNS atau UMS. Di Malang mungkin 5–7 kamar. Mana yang lebih kenal kotanya?
Customer : Solo lebih kenal
AI       : Dekat kampus mana di Solo?
Customer : UNS atau UMS
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 6 bulan
AI       : Berapa kamar minimal?
Customer : 6 kamar
AI       : Siap! Kost 6+ kamar dekat UNS/UMS Solo, 500–700 juta, cash, target 6 bulan!
```

---

### CASE B-16 | Beli Kost | Minta Kost Eksklusif Wanita
```
Customer : Mau beli kost khusus putri premium di Bandung
AI       : Kost putri premium sangat diminati di Bandung, terutama mahasiswi dari luar kota. Di area Bandung mana?
Customer : Dekat UNPAD Dipatiukur
AI       : Budget?
Customer : 1,5–2,5 miliar
AI       : Berapa kamar?
Customer : 12–18 kamar
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Fasilitas yang diinginkan per kamar?
Customer : AC, KM dalam, WiFi, dan security CCTV
AI       : Siap! Kost putri premium 12–18 kamar dekat UNPAD Bandung, AC + KM dalam + WiFi + CCTV, 1,5–2,5M, cash, target 4 bulan!
```

---

### CASE B-17 | Beli Kost | Akuisisi + Renovasi
```
Customer : Mau beli kost lama di Surabaya yang butuh renovasi tapi harganya murah
AI       : Strategi yang bagus — beli distressed, renovasi, naikkan value! Di area Surabaya mana?
Customer : Dekat UNESA atau Surabaya Barat
AI       : Budget total termasuk beli + renovasi?
Customer : 1,5 miliar
AI       : Berapa kamar yang ideal setelah renovasi?
Customer : 12–15 kamar
AI       : Cash atau KPR?
Customer : Cash
AI       : Target beli?
Customer : 3 bulan
AI       : Berapa lama rencananya renovasi?
Customer : 6 bulan
AI       : Siap! Kost existing yang butuh renovasi dekat UNESA/Surabaya Barat, 12–15 kamar setelah renovasi, total budget 1,5M, cash, target beli 3 bulan + renovasi 6 bulan!
```

---

### CASE B-18 | Beli Kost | Untuk Anak yang Kuliah
```
Customer : Anak saya kuliah di ITB, mau beli kost sekalian untuk investasi
AI       : Strategi cerdas — anak punya tempat tinggal sekaligus jadi aset investasi! Di area mana dekat ITB yang Anda inginkan?
Customer : Dago atau Ciumbuleuit paling dekat ITB
AI       : Budget pembelian?
Customer : 1,5–2,5 miliar
AI       : Berapa kamar? Kalau anak pakai 1 kamar, sisanya disewakan.
Customer : 8–10 kamar total, anak pakai 1
AI       : Cash atau KPR?
Customer : KPR, DP sudah siap
AI       : Target beli?
Customer : 4 bulan
AI       : Siap! Kost 8–10 kamar dekat ITB (Dago/Ciumbuleuit), 1,5–2,5M, KPR, target 4 bulan — anak tinggal + sewa kamar lain untuk investasi!
```

---

### CASE B-19 | Beli Kost | Minta Analisis Keuangan
```
Customer : Sebelum beli kost di Jogja, bisa buatkan analisis keuangannya?
AI       : Tentu! Untuk simulasi akurat, saya butuh beberapa data. Budget pembelian?
Customer : 1,2 miliar
AI       : Berapa kamar yang ditargetkan?
Customer : 12 kamar
AI       : Harga sewa per kamar per bulan di area target?
Customer : Sekitar 800 ribu–1,2 juta per kamar
AI       : Simulasi dasar: 12 kamar × 1 juta (rata-rata) × 12 bulan × 90% occupancy = 129,6 juta/tahun gross. Biaya operasional (listrik, air, maintenance, kebersihan) estimasi 20–25% = ~30 juta. Net income = ~100 juta/tahun. Gross yield = 100 juta / 1,2 M = ~8,3%/tahun. Payback period ~12 tahun. Sesuai ekspektasi?
Customer : Lumayan, bisa tidak di atas 10%?
AI       : Bisa! Cara optimize: (1) Upgrade fasilitas → naikkan harga ke 1,2–1,5 juta, (2) Optimalkan occupancy >90%, (3) Tambah layanan (laundry, titipan). Mau saya carikan yang potensinya bisa 10%+?
Customer : Iya
AI       : Area Jogja mana?
Customer : Dekat UGM
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Siap! Kost 12 kamar dekat UGM Jogja, 1,2M, cash, target 4 bulan — fokus yang yield bisa 10%+!
```

---

### CASE B-20 | Beli Kost | WA Singkat
```
Customer : beli kost malang dkt UB 1.5M cash 12 kamar
AI       : Operasional atau lahan?
Customer : operasional
AI       : Target & putra/putri/campur?
Customer : 3 bln, campur
AI       : Siap! Kost campur operasional 12 kamar dekat UB Malang, 1,5M, cash, target 3 bulan!
```

---

*File: 05_SKILL_BOARDING_HOUSE.md | Elevan Property Chatbot Skills v1.0*

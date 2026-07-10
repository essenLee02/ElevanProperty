# SKILL: HOTEL — 20 Simulasi Chat WhatsApp
**Tipe Property:** Hotel
**Transaksi:** Booking (menginap), Sewa jangka panjang (long stay), Beli (aset hotel) | **Total Case:** 20
**Fokus:** Fasilitas, transaksi, area, preferensi lokasi & red flag

---

## 🔧 SLOT KHUSUS HOTEL
```json
{
  "transaction_type": null, "location": null, "nights": null, "check_in": null,
  "guests": null, "rooms": null, "room_type": null, "budget_per_night": null,
  "facilities": [], "environment": {"sejuk": null, "akses_lancar": null},
  "nearby": [], "red_flags": []
}
```

---

## BAGIAN A: BOOKING HOTEL (Case 01–14)

### CASE 01 | Booking | Sejuk + Dekat Wisata (Batu)
```
Customer : Booking hotel di Batu yang sejuk & dekat wisata
AI       : Batu juara udara sejuknya! Wisata acuan — BNS, Jatim Park, Museum Angkut, atau Selecta?
Customer : Dekat BNS & Museum Angkut
AI       : Berapa malam & tanggal?
Customer : 2 malam, weekend depan
AI       : Berapa orang & kamar?
Customer : 6 orang, 3 kamar
AI       : Fasilitas wajib?
Customer : Kolam air panas, breakfast, view gunung
AI       : Budget/malam/kamar?
Customer : 1–2 juta
AI       : Prioritas akses gak macet ke wisata?
Customer : Iya
AI       : Siap! Hotel Batu dekat BNS + Museum Angkut, kolam air panas + breakfast + view gunung, akses lancar, 3 kamar, 1–2jt/kamar/malam, 2 malam weekend depan!
```

### CASE 02 | Booking | Bisnis, Akses Tol + Dekat Mall
```
Customer : hotel surabaya buat business trip yang strategis
AI       : "Strategis" untuk bisnis: dekat CBD/tol/mall. Prioritas mana?
Customer : Dekat tol & mall
AI       : Area HR Muhammad atau Sungkono cocok. Berapa malam & tanggal?
Customer : 3 malam, Senin depan
AI       : Fasilitas wajib?
Customer : WiFi kencang, meeting room, breakfast
AI       : Budget/malam?
Customer : 600rb–1 juta
AI       : Siap! Hotel bisnis HR Muhammad/Sungkono Surabaya, dekat tol + mall, WiFi kencang + meeting room + breakfast, 600rb–1jt/malam, 3 malam mulai Senin depan!
```

### CASE 03 | Booking | Malas Ketik
```
Customer : hotel batu 2 malam 4 org 2 kamar view gunung
AI       : Tanggal & budget/malam?
Customer : weekend ini, 800rb-1.5jt
AI       : Dekat wisata mana? BNS/Jatim Park?
Customer : deket jatim park
AI       : Siap! Hotel Batu dekat Jatim Park, view gunung, 2 kamar, 4 orang, 800rb–1,5jt/malam, 2 malam weekend ini!
```

### CASE 04 | Booking | Info Terbatas (Honeymoon)
```
Customer : mau booking hotel yang romantis
AI       : Untuk honeymoon/anniversary ya? Di kota/area mana?
Customer : Yang sejuk & pemandangan bagus
AI       : Batu (pegunungan) atau Malang cocok. Prioritas view?
Customer : Iya view gunung, suasana tenang
AI       : Berapa malam & tanggal?
Customer : 2 malam, akhir bulan
AI       : Fasilitas?
Customer : Private jacuzzi, breakfast in room
AI       : Budget/malam?
Customer : 1,5–3 juta
AI       : Siap! Hotel romantis di Batu, view gunung + suasana tenang + private jacuzzi + in-room breakfast, 2 orang, 1,5–3jt/malam, 2 malam akhir bulan!
```

### CASE 05 | Booking | Tanya Harga
```
Customer : Hotel bintang 4 di Surabaya berapa per malam?
AI       : Bintang 4 Surabaya: 500rb–1,2jt/malam tergantung lokasi & fasilitas. Yang dekat CBD/mall lebih tinggi. Tujuan menginap?
Customer : Liburan keluarga, dekat mall
AI       : Berapa malam, orang, kamar?
Customer : 2 malam, 4 orang, 2 kamar
AI       : Fasilitas?
Customer : Pool, breakfast, dekat mall buat jalan
AI       : Budget/malam?
Customer : 700rb–1 juta
AI       : Tanggal?
Customer : Weekend depan
AI       : Siap! Hotel bintang 4 dekat mall Surabaya, pool + breakfast, 2 kamar, 4 orang, 700rb–1jt/malam, 2 malam weekend depan!
```

### CASE 06 | Booking | Marah (overbooking)
```
Customer : Hotel yang saya pesan tiba-tiba bilang penuh, padahal sudah bayar!
AI       : Itu sangat mengecewakan — overbooking memang masalah serius. Saya bantu carikan pengganti setara SEKARANG. Kriteria & tanggal?
Customer : Batu, 3 kamar, view gunung, check-in besok!
AI       : Budget/malam & orang?
Customer : 1–1,5 juta, 6 orang
AI       : Saya cek ketersediaan real-time hotel Batu view gunung, 3 kamar, check-in besok, 1–1,5jt/malam — konfirmasi dalam 30 menit dengan bukti ketersediaan!
```

### CASE 07 | Booking | Keluarga + Anak (kid friendly)
```
Customer : Booking hotel yang ramah anak di Batu
AI       : Untuk anak, prioritas: pool anak, area bermain, dekat wisata keluarga. Setuju?
Customer : Iya, sama dekat Jatim Park biar praktis
AI       : Berapa malam, orang, kamar?
Customer : 2 malam, 2 dewasa 2 anak, 1 family room
AI       : Budget/malam?
Customer : 1–1,5 juta
AI       : Tanggal?
Customer : Liburan sekolah
AI       : Siap! Hotel ramah anak di Batu dekat Jatim Park, pool anak + area bermain, family room, 1–1,5jt/malam, 2 malam liburan sekolah!
```

### CASE 08 | Booking | Rombongan/Event
```
Customer : Booking hotel buat rombongan 30 orang acara gathering kantor
AI       : Untuk 30 orang butuh blok kamar + ruang meeting/aula. Kota & tanggal?
Customer : Surabaya atau Batu, bulan depan 2 hari
AI       : Batu (sejuk, ada wisata) atau Surabaya (dekat kantor)?
Customer : Batu aja biar sekalian refreshing
AI       : Berapa kamar & fasilitas?
Customer : 15 kamar (2 org/kamar), aula meeting, breakfast
AI       : Budget/malam total?
Customer : Per kamar 700rb–1 juta
AI       : Siap! Hotel Batu untuk gathering 30 orang, 15 kamar + aula meeting + breakfast, dekat wisata, 700rb–1jt/kamar/malam, 2 hari bulan depan!
```

### CASE 09 | Booking | Dekat Bandara (transit)
```
Customer : Hotel dekat bandara Juanda buat transit semalam
AI       : Untuk transit, prioritas: dekat bandara + shuttle. Berapa orang?
Customer : 2 orang, 1 kamar
AI       : Prioritas akses cepat gak macet ke terminal?
Customer : Iya, penerbangan pagi
AI       : Budget/malam?
Customer : 400–700 ribu
AI       : Tanggal?
Customer : Besok malam
AI       : Siap! Hotel dekat Bandara Juanda + shuttle, akses cepat ke terminal, 1 kamar 2 orang, 400–700rb, besok malam transit!
```

### CASE 10 | Booking | Rating Tinggi
```
Customer : Hotel Surabaya yang rating Google-nya bagus 4.5+
AI       : Prioritas kualitas terverifikasi — bagus! Area & tujuan?
Customer : Dekat pusat kota, liburan
AI       : Berapa malam, orang, kamar?
Customer : 2 malam, 2 orang, 1 kamar
AI       : Fasilitas & budget/malam?
Customer : Pool + breakfast, 600rb–1 juta
AI       : Tanggal?
Customer : Weekend depan
AI       : Siap! Hotel rating 4.5+ dekat pusat kota Surabaya, pool + breakfast, 600rb–1jt/malam, 2 malam weekend depan!
```

### CASE 11 | Booking | Ganti-Ganti
```
Customer : booking hotel liburan
AI       : Kota mana?
Customer : Batu... atau Malang kota ya?
AI       : Batu lebih sejuk & banyak wisata, Malang kota lebih dekat kuliner. Prioritas?
Customer : Batu aja yang sejuk, dekat wisata
AI       : Berapa malam & orang?
Customer : 2 malam, 4 orang... eh 5 deh
AI       : 5 orang, 2 kamar ya. Budget & tanggal?
Customer : 800rb–1,5jt/malam, weekend depan
AI       : Siap! Hotel Batu (sejuk, dekat wisata), 2 kamar, 5 orang, 800rb–1,5jt/malam, 2 malam weekend depan!
```

### CASE 12 | Long Stay | Bulanan untuk Kerja
```
Customer : Nginap hotel bulanan di Surabaya buat proyek kerja 3 bulan
AI       : Untuk long stay, banyak hotel/apart-hotel kasih rate bulanan lebih murah. Area dekat lokasi proyek?
Customer : Dekat Rungkut, akses lancar ke lokasi
AI       : Fasilitas wajib?
Customer : WiFi, laundry, breakfast, gym
AI       : Budget/bulan?
Customer : 5–8 juta
AI       : Kapan mulai?
Customer : Bulan depan
AI       : Siap! Hotel/apart-hotel long stay dekat Rungkut Surabaya (akses lancar), WiFi + laundry + breakfast + gym, 5–8jt/bulan, mulai bulan depan, 3 bulan!
```

### CASE 13 | Booking | Dekat Pasar/Kuliner
```
Customer : Hotel di Malang yang dekat kuliner & pasar oleh-oleh
AI       : Malang kota surganya kuliner! Area dekat alun-alun atau Jalan Ijen cocok. Preferensi?
Customer : Dekat alun-alun biar jalan kaki bisa
AI       : Berapa malam, orang, kamar?
Customer : 2 malam, 3 orang, 2 kamar
AI       : Budget/malam?
Customer : 500–800 ribu
AI       : Tanggal?
Customer : Long weekend
AI       : Siap! Hotel dekat alun-alun Malang (dekat kuliner + oleh-oleh), 2 kamar, 3 orang, 500–800rb/malam, 2 malam long weekend!
```

### CASE 14 | Booking | WA Singkat
```
Customer : hotel batu 2mlm 2org view gunung breakfast 1jt weekend
AI       : Dekat wisata mana?
Customer : deket BNS
AI       : Siap! Hotel Batu dekat BNS, view gunung + breakfast, 2 orang, 1jt/malam, 2 malam weekend!
```

---

## BAGIAN B: SEWA JANGKA PANJANG & BELI ASET HOTEL (Case 15–20)

### CASE 15 | Beli Aset Hotel | Investasi Dekat Wisata
```
Customer : Mau beli hotel kecil di Batu buat investasi
AI       : Investasi hotel di kota wisata menjanjikan! Skala berapa kamar?
Customer : 20–30 kamar, budget menengah
AI       : Prioritas dekat magnet wisata (BNS/Jatim Park) biar okupansi tinggi?
Customer : Iya, yang selalu ramai wisatawan
AI       : Budget?
Customer : 15–30 miliar
AI       : Cash atau pembiayaan? Dan saya cek legalitas (IMB, SLF, TDUP) + akses jalan
Customer : Cash, iya legalitas wajib bersih
AI       : Target?
Customer : 6 bulan
AI       : Siap! Hotel 20–30 kamar di Batu dekat BNS/Jatim Park, akses lancar + legalitas bersih (IMB/SLF/TDUP), 15–30M, cash, target 6 bulan, investasi!
```

### CASE 16 | Beli Aset Hotel | Marah (banyak masalah legal)
```
Customer : Cari hotel dijual di Malang setahun, selalu ada masalah izin! Capek
AI       : Legalitas hotel memang kompleks (IMB, SLF, TDUP, sertifikat). Saya fokuskan hanya yang dokumennya lengkap & bersih. Skala & budget?
Customer : 15–25 kamar, 10–20 M, cash siap
AI       : Area Malang mana & target?
Customer : Dekat wisata, secepatnya
AI       : Saya seleksi hotel dekat wisata Malang dengan legalitas TERVERIFIKASI LENGKAP, 15–25 kamar, 10–20M cash — Anda tidak keluar dana sebelum semua dokumen clear. Update 48 jam!
```

### CASE 17 | Beli Aset Hotel | Operasional (sudah jalan)
```
Customer : Mau beli hotel yang sudah operasional & ada karyawan
AI       : Beli hotel running = langsung cashflow! Prioritas okupansi & lokasi?
Customer : Yang okupansi stabil, dekat kota/wisata
AI       : Kota mana?
Customer : Surabaya atau Batu
AI       : Skala kamar & budget?
Customer : 30–50 kamar, 20–40 M
AI       : Saya cek laporan okupansi & keuangan 2 tahun terakhir ya. Cash?
Customer : Cash, target 6 bulan
AI       : Siap! Hotel operasional 30–50 kamar Surabaya/Batu (okupansi stabil, laporan keuangan diverifikasi), 20–40M, cash, target 6 bulan!
```

### CASE 18 | Sewa Gedung untuk Hotel | Konversi
```
Customer : Sewa gedung di Surabaya buat dijadikan hotel/guest house
AI       : Untuk konversi jadi hotel, perlu gedung dengan banyak ruang & izin peruntukan komersial. Area?
AI       : Prioritas dekat wisata/CBD (biar laku)?
Customer : Dekat pusat kota atau kampus, budget sewa 30–50 juta/bulan
AI       : Berapa lantai/kamar potensial?
Customer : Minimal 15 kamar
AI       : Saya cek izin peruntukan & akses ya. Berapa lama sewa?
Customer : 5 tahun
AI       : Siap! Gedung sewa dekat pusat kota/kampus Surabaya untuk konversi hotel (min 15 kamar, izin peruntukan clear), 30–50jt/bln, 5 tahun!
```

### CASE 19 | Beli Aset Hotel | Multi-Unit Investor
```
Customer : Sudah punya 2 hotel di Bali, mau ekspansi ke Jatim
AI       : Ekspansi cerdas ke pasar wisata Jatim! Fokus area?
Customer : Batu atau Bromo, yang wisatanya rame
AI       : Batu (wisata keluarga) atau Bromo (wisata alam). Keduanya okupansi tinggi. Skala & budget?
Customer : 30–40 kamar, 25–40 M per unit
AI       : Prioritas akses lancar & legalitas lengkap?
Customer : Iya wajib
AI       : Cash & target?
Customer : Cash, 6 bulan
AI       : Siap! Hotel 30–40 kamar di Batu/Bromo (akses lancar + legalitas lengkap), 25–40M, cash, target 6 bulan, ekspansi portofolio!
```

### CASE 20 | Beli Aset Hotel | WA Singkat
```
Customer : beli hotel batu 25 kamar operasional 20M cash 6bln deket wisata
AI       : Prioritas legalitas lengkap & okupansi stabil?
Customer : iya wajib
AI       : Siap! Hotel operasional 25 kamar Batu dekat wisata (legalitas lengkap + okupansi stabil), 20M, cash, target 6 bulan, investasi!
```

---
*File: 03_SKILL_HOTEL_CHAT.md | Elevan Property Chatbot Skills v2.0*

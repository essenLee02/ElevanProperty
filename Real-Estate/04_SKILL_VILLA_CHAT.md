# SKILL: VILLA — 20 Simulasi Chat WhatsApp
**Tipe Property:** Villa
**Transaksi:** Sewa (harian/musiman), Beli, Booking | **Total Case:** 20
**Fokus:** Fasilitas, transaksi, area, preferensi lokasi & red flag

---

## 🔧 SLOT KHUSUS VILLA
```json
{
  "transaction_type": null, "location": null, "guests": null, "bedrooms": null,
  "nights": null, "date": null, "private_pool": null, "budget": null,
  "environment": {"asri": null, "sejuk": null, "dingin": null, "akses_lancar": null},
  "nearby": [], "red_flags": []
}
```

---

## BAGIAN A: SEWA & BOOKING VILLA (Case 01–12)

### CASE 01 | Sewa | Asri + Dingin + Dekat Taman Dayu
```
Customer : Sewa villa buat gathering keluarga yang asri & dingin
AI       : Asri + dingin cocok di Prigen, Trawas, Tretes, atau Batu. Preferensi?
Customer : Prigen dekat Taman Dayu
AI       : Area Taman Dayu Pandaan/Prigen sejuk & asri. Untuk berapa orang?
Customer : 15 orang, keluarga besar
AI       : Berapa kamar & fasilitas?
Customer : 5–6 kamar, private pool, BBQ, karaoke
AI       : Berapa malam & tanggal?
Customer : 2 malam, akhir bulan
AI       : Prioritas akses jalan ramah lansia (gak nanjak curam)?
Customer : Iya ada lansia
AI       : Budget/malam?
Customer : 5–8 juta
AI       : Siap! Villa 5–6KT Prigen/Pandaan dekat Taman Dayu (asri, dingin), private pool + BBQ + karaoke, akses ramah lansia, 15 orang, 5–8jt/malam, 2 malam akhir bulan!
```

### CASE 02 | Booking | Malas Ketik + Batu
```
Customer : villa batu 3 kamar private pool 10 org weekend
AI       : Budget/malam & dekat wisata mana?
Customer : 3-5jt, deket BNS
AI       : Prioritas view gunung & udara dingin?
Customer : iya
AI       : Tanggal?
Customer : weekend depan
AI       : Siap! Villa 3KT Batu dekat BNS (view gunung, dingin), private pool, 10 orang, 3–5jt/malam, weekend depan!
```

### CASE 03 | Sewa | Info Terbatas
```
Customer : mau sewa villa tapi bingung di mana
AI       : Untuk acara apa & berapa orang?
Customer : Liburan keluarga, 12 orang
AI       : Prioritas suasana — pantai, pegunungan sejuk, atau dekat wisata?
Customer : Yang sejuk pegunungan, ada wisata dekat
AI       : Batu (dekat BNS/Jatim Park) atau Prigen (dekat Taman Dayu) cocok. Preferensi?
Customer : Batu aja
AI       : Berapa kamar, malam, budget?
Customer : 4 kamar, 2 malam, 4–6 juta/malam
AI       : Tanggal?
Customer : Liburan sekolah
AI       : Siap! Villa 4KT Batu (sejuk, dekat BNS/Jatim Park), private pool, 12 orang, 4–6jt/malam, 2 malam liburan sekolah!
```

### CASE 04 | Sewa | Tanya Harga
```
Customer : Sewa villa di Batu per malam berapa?
AI       : Villa Batu: 3KT dengan private pool 2,5–5jt/malam, villa besar 5KT+ 5–10jt/malam tergantung fasilitas & view. Untuk berapa orang?
Customer : 10 orang, butuh 4 kamar
AI       : Prioritas view gunung & dekat wisata?
Customer : Iya dekat Jatim Park, view bagus
AI       : Budget & tanggal?
Customer : 4–6 juta/malam, weekend depan
AI       : Berapa malam?
Customer : 2 malam
AI       : Siap! Villa 4KT Batu (view gunung, dekat Jatim Park), private pool, 10 orang, 4–6jt/malam, 2 malam weekend depan!
```

### CASE 05 | Booking | Marah (villa kotor)
```
Customer : Terakhir sewa villa kondisinya kotor & pool-nya keruh! Kecewa berat
AI       : Maaf sekali atas pengalaman itu — kebersihan villa itu wajib. Saya kirim villa terverifikasi dengan review kebersihan bagus. Area & orang?
Customer : Batu, 12 orang, 4 kamar, private pool bersih
AI       : Budget & tanggal?
Customer : 4–6 juta/malam, akhir bulan
AI       : Saya seleksi villa Batu rating kebersihan 4.5+, pool terawat, 4KT, 4–6jt/malam — plus foto real terbaru. Berapa malam?
Customer : 2 malam
AI       : Siap! Villa Batu terverifikasi bersih, pool terawat, 4KT, 12 orang, 4–6jt/malam, 2 malam akhir bulan!
```

### CASE 06 | Sewa | Honeymoon/Couple
```
Customer : Sewa villa romantis buat berdua, yang private
AI       : Untuk couple, prioritas: privacy, view indah, private pool. Area — pegunungan sejuk atau pantai?
Customer : Pegunungan yang dingin & tenang
AI       : Batu atau Prigen cocok. Berapa malam & tanggal?
Customer : 2 malam, akhir bulan
AI       : Fasilitas romantis?
Customer : Private pool, jacuzzi, view gunung
AI       : Budget/malam?
Customer : 2–4 juta
AI       : Siap! Villa romantis 1KT Batu/Prigen (dingin, tenang, private), private pool + jacuzzi + view gunung, 2 orang, 2–4jt/malam, 2 malam akhir bulan!
```

### CASE 07 | Sewa | Event/Wedding
```
Customer : Sewa villa buat acara lamaran outdoor
AI       : Untuk acara, butuh villa dengan halaman/garden luas + kapasitas tamu. Berapa tamu?
Customer : Sekitar 50 orang
AI       : Area & prioritas suasana?
Customer : Prigen, yang asri & view bagus
AI       : Berapa kamar untuk menginap & budget?
Customer : 5 kamar, 8–12 juta/hari
AI       : Prioritas akses parkir luas & jalan mudah?
Customer : Iya, tamu bawa mobil
AI       : Tanggal?
Customer : Bulan depan, 1 hari + nginap
AI       : Siap! Villa 5KT Prigen (asri, view bagus), garden luas untuk 50 tamu + parkir + akses mudah, 8–12jt/hari, bulan depan!
```

### CASE 08 | Booking | Pet Friendly
```
Customer : Villa yang boleh bawa anjing di Batu
AI       : Villa pet-friendly memang terbatas, saya carikan yang memang mengizinkan. Berapa orang & kamar?
Customer : 6 orang, 2 kamar
AI       : Prioritas halaman luas buat anjing main?
Customer : Iya, sama private pool
AI       : Budget/malam & tanggal?
Customer : 2–3,5 juta, weekend depan
AI       : Berapa malam?
Customer : 2 malam
AI       : Siap! Villa pet-friendly 2KT Batu, halaman luas + private pool, 6 orang, 2–3,5jt/malam, 2 malam weekend depan!
```

### CASE 09 | Sewa | Ganti-Ganti
```
Customer : sewa villa buat liburan
AI       : Area mana?
Customer : Batu... eh Trawas aja lebih sepi
AI       : Trawas memang lebih tenang & sejuk. Berapa orang & kamar?
Customer : 10 orang, 4 kamar... eh 3 cukup deh
AI       : 3KT untuk 10 orang oke (ada extra bed). Budget & tanggal?
Customer : 3–5 juta/malam, akhir bulan
AI       : Prioritas private pool & view?
Customer : Iya dua-duanya
AI       : Siap! Villa 3KT Trawas (tenang, sejuk), private pool + view, 10 orang, 3–5jt/malam, akhir bulan!
```

### CASE 10 | Sewa | Long Stay Bulanan
```
Customer : Sewa villa bulanan di Batu buat remote work
AI       : Untuk long stay, banyak villa kasih rate bulanan lebih hemat. Prioritas?
Customer : WiFi kencang, tenang, sejuk
AI       : Berapa kamar & budget/bulan?
Customer : 2 kamar, 8–15 juta/bulan
AI       : Prioritas dekat cafe/minimarket buat kebutuhan harian?
Customer : Iya dekat Alfamart & cafe
AI       : Berapa lama?
Customer : 3 bulan
AI       : Siap! Villa 2KT Batu (tenang, sejuk), WiFi kencang + dekat Alfamart & cafe, 8–15jt/bulan, 3 bulan, remote work!
```

### CASE 11 | Booking | Rombongan Besar
```
Customer : Villa buat outing kantor 40 orang di Prigen
AI       : Untuk 40 orang, butuh villa besar/kompleks villa multi-unit + aula. Berapa malam?
Customer : 2 malam, ada acara meeting juga
AI       : Butuh: banyak kamar, aula/meeting, private pool, BBQ. Budget?
Customer : Total 25–40 juta untuk 2 malam
AI       : Prioritas dekat Taman Dayu (bisa sekalian main golf/wisata)?
Customer : Iya bagus tuh
AI       : Tanggal?
Customer : Bulan depan
AI       : Siap! Kompleks villa Prigen dekat Taman Dayu untuk 40 orang, banyak kamar + aula + pool + BBQ, 25–40jt/2 malam, bulan depan!
```

### CASE 12 | Booking | WA Singkat
```
Customer : villa prigen 5kt pool 15org 6jt 2mlm deket taman dayu
AI       : Tanggal & prioritas asri/sejuk?
Customer : akhir bulan, iya yang sejuk
AI       : Siap! Villa 5KT Prigen dekat Taman Dayu (asri, sejuk), private pool, 15 orang, 6jt/malam, 2 malam akhir bulan!
```

---

## BAGIAN B: BELI VILLA (Case 13–20)

### CASE 13 | Beli | Investasi Wisata + Dekat BNS
```
Customer : Beli villa di Batu buat disewakan turis
AI       : Investasi villa wisata Batu menjanjikan! Prioritas dekat magnet wisata?
Customer : Dekat BNS, Jatim Park, atau alun-alun
AI       : Okupansi tinggi terutama weekend. Berapa kamar target?
Customer : 4–5 kamar biar muat rombongan
AI       : Fasilitas yang bikin laku: private pool, view gunung, BBQ. Prioritaskan?
Customer : Iya semua, plus udara dingin
AI       : Cash/KPR & saya pastikan akses jalan muat mobil besar
Customer : Cash, iya penting buat tamu rombongan
AI       : Target?
Customer : 6 bulan
AI       : Siap! Villa 4–5KT Batu dekat BNS/Jatim Park (dingin), private pool + view gunung + BBQ, akses mobil besar, 2–4M, cash, target 6 bulan, investasi turis!
```

### CASE 14 | Beli | Malas Ketik
```
Customer : beli villa batu 4kt pool 3M cash 6bln invest deket wisata
AI       : Prioritas view gunung & akses lancar?
Customer : iya dua-duanya
AI       : Siap! Villa 4KT Batu dekat wisata (view gunung + akses lancar), private pool, 3M, cash, target 6 bulan, investasi!
```

### CASE 15 | Beli | Tanya Harga
```
Customer : Harga villa di Batu berapa?
AI       : Villa Batu: 3KT dengan pool mulai 1,5M, villa premium 5KT+ view gunung 3–6M. Untuk investasi atau pribadi?
Customer : Investasi disewakan
AI       : Prioritas dekat wisata (okupansi tinggi)?
Customer : Iya dekat BNS
AI       : Budget & jumlah kamar?
Customer : 2–3 M, 4 kamar
AI       : Cash/KPR & target?
Customer : Cash, 6 bulan
AI       : Siap! Villa 4KT Batu dekat BNS, private pool + view, 2–3M, cash, target 6 bulan, investasi!
```

### CASE 16 | Beli | Private Resort Keluarga
```
Customer : Beli villa buat private resort keluarga, gak disewakan
AI       : Untuk private use, prioritas kenyamanan & privasi maksimal. Area — sejuk pegunungan?
Customer : Iya yang dingin, tenang, jauh dari keramaian
AI       : Prigen/Trawas cocok (tenang & asri). Berapa kamar & fasilitas?
Customer : 5 kamar, private pool, garden luas, gazebo
AI       : Prioritas akses tetap mudah (walau tenang)?
Customer : Iya jangan yang terlalu susah dijangkau
AI       : Budget & cash/KPR?
Customer : 4–7 M, cash
AI       : Target?
Customer : 6 bulan
AI       : Siap! Villa 5KT Prigen/Trawas (dingin, tenang, asri), private pool + garden + gazebo, akses mudah, 4–7M, cash, target 6 bulan, private resort!
```

### CASE 17 | Beli | Marah (kalah nego)
```
Customer : 2x nego villa Batu gagal karena keburu laku! Frustrasi
AI       : Villa investasi bagus memang cepat laku. Saya bantu prioritaskan Anda dengan info listing tercepat. Kriteria & cash?
Customer : 4 kamar, dekat wisata, max 3 M cash siap
AI       : Cash siap keunggulan besar. Area & target?
Customer : Dekat BNS/Jatim Park, secepatnya
AI       : Saya aktifkan alert listing villa 4KT dekat BNS/Jatim Park max 3M cash — Anda dapat info pertama begitu ada. Update 24 jam!
```

### CASE 18 | Beli | Lahan untuk Bangun Villa
```
Customer : Mau beli lahan di Batu buat bangun villa sendiri
AI       : Bangun sendiri = desain sesuai selera + potensi untung lebih! Luas lahan?
Customer : 500–800 m²
AI       : Prioritas view gunung & dekat wisata?
Customer : Iya view bagus, dekat area wisata
AI       : Penting — saya cek legalitas (SHM/HGB), akses jalan bisa masuk material, & bukan lahan bermasalah
Customer : Iya wajib legalitas bersih
AI       : Budget (lahan) & target?
Customer : 1,5–3 M, cash, 6 bulan
AI       : Siap! Lahan 500–800m² Batu (view gunung, dekat wisata), legalitas bersih + akses material, 1,5–3M, cash, target 6 bulan, untuk bangun villa!
```

### CASE 19 | Beli | Villa + Golf (Taman Dayu)
```
Customer : Beli villa di area Taman Dayu yang dekat lapangan golf
AI       : Taman Dayu Pandaan memang punya golf course! Cocok untuk hobi + investasi. Berapa kamar?
Customer : 4 kamar
AI       : Prioritas view golf/gunung & udara sejuk?
Customer : Iya view golf bagus, sejuk
AI       : Budget & cash/KPR?
Customer : 3–5 M, cash
AI       : Prioritas akses lancar dari tol Pandaan?
Customer : Iya biar gampang dari Surabaya
AI       : Target?
Customer : 6 bulan
AI       : Siap! Villa 4KT Taman Dayu Pandaan (view golf/gunung, sejuk), akses lancar dari tol, 3–5M, cash, target 6 bulan!
```

### CASE 20 | Beli | WA Singkat
```
Customer : beli villa prigen 5kt pool 4M cash 6bln private tenang sejuk
AI       : Prioritas akses mudah & legalitas bersih?
Customer : iya wajib
AI       : Siap! Villa 5KT Prigen (tenang, sejuk, private), akses mudah + legalitas bersih, private pool, 4M, cash, target 6 bulan!
```

---
*File: 04_SKILL_VILLA_CHAT.md | Elevan Property Chatbot Skills v2.0*

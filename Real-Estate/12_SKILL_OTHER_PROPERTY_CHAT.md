# SKILL: PROPERTI LAINNYA / OTHER PROPERTY — 20 Simulasi Chat WhatsApp
**Tipe Property:** Properti Lainnya (Tanah, Kavling, SPBU, Pabrik, Lahan Pertanian, Fasilitas Olahraga, dll)
**Transaksi:** Sewa, Beli | **Total Case:** 20
**Fokus:** Fasilitas, transaksi, area, preferensi lokasi & red flag

---

## 🔧 TIPE PROPERTI YANG TERMASUK
- Tanah / Kavling kosong
- SPBU (Pom bensin)
- Pabrik / Fasilitas Produksi
- Lahan Pertanian / Perkebunan
- Lapangan / Fasilitas Olahraga (futsal, golf, kolam renang)
- Klinik / Fasilitas Kesehatan
- Glamping / Lahan Wisata
- Cold Storage / Fasilitas Khusus

## 🔧 SLOT KHUSUS
```json
{
  "transaction_type": null, "sub_type": null, "location": null, "land_area": null,
  "budget": null, "duration": null, "peruntukan": null,
  "environment": {"asri": null, "sejuk": null, "akses_lancar": null, "bebas_banjir": null, "akses_truk": null},
  "nearby": [], "legalitas": null, "red_flags": []
}
```

---

## BAGIAN A: SEWA PROPERTI LAINNYA (Case 01–10)

### CASE 01 | Sewa Lahan | Parkir Dekat Keramaian
```
Customer : Sewa lahan kosong di Surabaya buat parkir berbayar
AI       : Usaha parkir butuh dekat pusat keramaian! Area?
Customer : Dekat RSUD Dr. Soetomo atau area rumah sakit
AI       : Luas?
Customer : 500–1.000 m²
AI       : Prioritas akses lancar keluar-masuk + jelas izin peruntukan?
Customer : Iya, yang izinnya jelas
AI       : Budget/bulan & durasi?
Customer : 10–20 juta, 2 tahun
AI       : Kapan mulai?
Customer : 3 bulan lagi
AI       : Siap! Lahan 500–1.000m² dekat RSUD Soetomo (akses lancar + izin peruntukan jelas), parkir, 10–20jt/bln, 2 tahun, mulai 3 bulan lagi!
```

### CASE 02 | Sewa Lahan | Lapangan Futsal
```
Customer : Sewa lahan buat usaha futsal di Surabaya
AI       : Futsal butuh min 1.200 m² (2 lapangan standar). Area?
Customer : Surabaya Selatan atau Timur
AI       : Prioritas dekat perumahan padat/kampus (pemain)?
Customer : Iya dekat kampus, sama akses lancar & parkir
AI       : Berapa lapangan & butuh atap?
Customer : 2 lapangan, atap pasang sendiri
AI       : Budget/bulan & durasi?
Customer : 15–25 juta, 3 tahun
AI       : Bebas banjir penting (lapangan gak boleh tergenang)?
Customer : Iya wajib
AI       : Siap! Lahan min 1.200m² Surabaya Selatan/Timur dekat kampus (akses lancar + parkir + BEBAS BANJIR), 2 lapangan futsal + atap sendiri, 15–25jt/bln, 3 tahun!
```

### CASE 03 | Sewa Lahan | Glamping (asri + sejuk)
```
Customer : mau sewa lahan buat glamping
AI       : Glamping butuh lahan dengan pemandangan alam + nuansa outdoor. Area?
Customer : Jawa Timur yang asri
AI       : Populer untuk glamping: Bromo, Batu, Trawas Mojokerto, Prigen. Preferensi?
Customer : Batu, yang sejuk & view bagus
AI       : Prioritas view gunung + udara dingin + dekat wisata?
Customer : Iya, dekat BNS/Jatim Park lebih bagus buat tamu
AI       : Luas & budget/bulan?
Customer : 3.000–5.000 m², 10–20 juta
AI       : Prioritas akses jalan bisa dilalui tamu (gak ekstrem)?
Customer : Iya jangan terlalu susah
AI       : Durasi?
Customer : 3–5 tahun
AI       : Siap! Lahan 3.000–5.000m² Batu (asri, sejuk, view gunung, dekat BNS/Jatim Park), akses tamu OK, glamping, 10–20jt/bln, 3–5 tahun!
```

### CASE 04 | Sewa Lahan | Pertanian Sejuk
```
Customer : Sewa lahan pertanian di Jawa Timur buat sayuran organik
AI       : Sayuran organik butuh iklim sejuk + sumber air. Area?
Customer : Malang atau Batu, karena sejuk cocok buat sayuran
AI       : Tepat! Luas?
Customer : 5.000–10.000 m²
AI       : Prioritas sumber air/irigasi wajib ada?
Customer : Iya wajib
AI       : Budget & durasi?
Customer : 50–100 juta/tahun, 5 tahun
AI       : Prioritas akses jalan buat angkut hasil panen?
Customer : Iya biar distribusi lancar
AI       : Siap! Lahan pertanian 5.000–10.000m² Malang/Batu (sejuk + sumber air + akses angkut), sayuran organik, 50–100jt/tahun, 5 tahun!
```

### CASE 05 | Sewa | SPBU (marah - berbelit)
```
Customer : Mau sewa SPBU existing tapi prosesnya berbelit banget!
AI       : SPBU memang rumit karena melibatkan Pertamina, tapi ada jalur yang lebih jelas. Kota?
Customer : Surabaya atau Sidoarjo
AI       : Budget/investasi?
Customer : 2–5 miliar/tahun
AI       : Mau SPBU operasional (lebih cepat) atau bangun baru franchise?
Customer : Yang operasional
AI       : Prioritas lokasi jalan ramai + akses lancar (volume BBM tinggi)?
Customer : Iya, yang traffic-nya tinggi
AI       : Saya bantu carikan SPBU operasional di jalan ramai Surabaya/Sidoarjo yang pemiliknya mau sewakan + navigasi proses Pertamina. Update 48 jam!
```

### CASE 06 | Sewa | Pabrik Zona Industri
```
Customer : Sewa pabrik/bangunan produksi di Gresik
AI       : Untuk pabrik, wajib zona industri (peruntukan + izin). Luas?
Customer : 2.000 m²
AI       : Prioritas akses truk + listrik besar + dekat tol?
Customer : Iya semua, sama bebas banjir
AI       : Kapasitas listrik yang dibutuhkan?
Customer : Minimal 300 kVA
AI       : Budget/bulan & durasi?
Customer : 50–80 juta, 3 tahun
AI       : Siap! Pabrik 2.000m² zona industri Gresik (akses truk + listrik 300 kVA + dekat tol + BEBAS BANJIR), 50–80jt/bln, 3 tahun!
```

### CASE 07 | Sewa Lahan | Event/Festival
```
Customer : Sewa lahan luas di Surabaya buat festival/konser
AI       : Untuk event, butuh lahan luas + akses + parkir masif. Luas?
Customer : 5.000 m²+
AI       : Prioritas akses lancar (bongkar panggung + pengunjung) + dekat pusat kota?
Customer : Iya biar gampang dijangkau
AI       : Sewa per event atau bulanan?
Customer : Per event dulu, mungkin rutin
AI       : Budget?
Customer : 30–50 juta/event
AI       : Tanggal?
Customer : Bulan depan
AI       : Siap! Lahan 5.000m²+ Surabaya (akses lancar + parkir masif + dekat pusat kota), festival/konser, 30–50jt/event, bulan depan!
```

### CASE 08 | Sewa | Klinik Existing (izin lengkap)
```
Customer : Sewa gedung klinik yang sudah ada izinnya di Surabaya
AI       : Klinik ber-izin memang lebih cepat operasional! Prioritas lokasi dekat perumahan padat (pasien)?
Customer : Iya, sama akses lancar & parkir
AI       : Luas & budget/bulan?
Customer : 200–400 m², 15–30 juta
AI       : Wajib cek: izin klinik + IMB + bebas banjir. Setuju?
Customer : Iya semua
AI       : Durasi?
Customer : 3 tahun
AI       : Siap! Gedung klinik 200–400m² dekat perumahan padat Surabaya (izin klinik + IMB + akses lancar + parkir + BEBAS BANJIR), 15–30jt/bln, 3 tahun!
```

### CASE 09 | Sewa | Ganti-Ganti
```
Customer : sewa lahan buat usaha di surabaya
AI       : Usaha apa?
Customer : Car wash... eh tambah cafe kecil juga deh
AI       : Car wash + cafe = konsep bagus (customer nunggu sambil ngopi)! Luas?
Customer : 400–600 m²
AI       : Prioritas jalan ramai + akses lancar (mobil masuk-keluar)?
Customer : Iya, sama dekat perumahan
AI       : Budget/bulan & durasi?
Customer : 12–20 juta, 3 tahun
AI       : Bebas banjir penting?
Customer : Iya
AI       : Siap! Lahan 400–600m² jalan ramai dekat perumahan Surabaya (akses lancar + BEBAS BANJIR), car wash + cafe, 12–20jt/bln, 3 tahun!
```

### CASE 10 | Sewa | WA Singkat
```
Customer : sewa lahan surabaya 1000m parkir 15jt 2thn deket keramaian izin jelas
AI       : Prioritas akses lancar & bebas banjir?
Customer : iya dua-duanya
AI       : Siap! Lahan 1.000m² dekat keramaian Surabaya (akses lancar + izin jelas + BEBAS BANJIR), parkir, 15jt/bln, 2 tahun!
```

---

## BAGIAN B: BELI PROPERTI LAINNYA (Case 11–20)

### CASE 11 | Beli Kavling | Asri + Sejuk + Dekat Taman Dayu
```
Customer : Beli kavling di daerah sejuk buat bangun villa nanti
AI       : Investasi jangka panjang cerdas! Kavling sejuk untuk villa: Batu, Prigen, Trawas. Preferensi?
Customer : Prigen dekat Taman Dayu, yang asri & dingin
AI       : Area Taman Dayu Pandaan/Prigen sejuk + nilai tanah naik terus. Luas?
Customer : 300–500 m²
AI       : Prioritas akses jalan bisa masuk mobil + view gunung?
Customer : Iya dua-duanya
AI       : Penting — legalitas bersih (SHM/HGB) + bukan lahan sengketa. Setuju?
Customer : Iya wajib
AI       : Budget, cash/KPR & target?
Customer : 1–2,5 M, cash, 6 bulan
AI       : Siap! Kavling 300–500m² Prigen/Pandaan dekat Taman Dayu (asri, sejuk, view gunung), akses mobil + legalitas bersih, 1–2,5M, cash, target 6 bulan!
```

### CASE 12 | Beli Kavling | Malas Ketik
```
Customer : beli kavling surabaya timur 300m 1.5M cash 3bln siap bangun
AI       : Prioritas bebas banjir + akses jalan lebar?
Customer : iya wajib dua-duanya
AI       : Legalitas: kavling matang siap bangun?
Customer : iya yang siap bangun
AI       : Siap! Kavling matang 300m² Surabaya Timur (siap bangun + BEBAS BANJIR + jalan lebar), 1,5M, cash, target 3 bulan!
```

### CASE 13 | Beli | SPBU Operasional
```
Customer : Mau beli SPBU di Jawa Timur
AI       : SPBU operasional atau bangun baru franchise Pertamina?
Customer : Yang sudah operasional
AI       : Budget & kota?
Customer : 5–15 M, Surabaya atau kota besar Jatim
AI       : Prioritas jalan ramai + akses lancar (volume tinggi)?
Customer : Iya, volume min 10.000 liter/hari
AI       : Cash/KPR & target?
Customer : Cash, 6 bulan
AI       : Saya cek legalitas + kontrak Pertamina + laporan volume. Setuju?
Customer : Iya wajib
AI       : Siap! SPBU operasional (volume min 10.000L/hari) jalan ramai Surabaya/kota besar Jatim (akses lancar + legalitas + kontrak Pertamina verified), 5–15M, cash, target 6 bulan!
```

### CASE 14 | Beli | Lahan Pertanian Investasi
```
Customer : Beli sawah di Jawa Timur buat investasi
AI       : Investasi lahan pertanian bagus jangka panjang! Kabupaten?
Customer : Jember atau Banyuwangi, dengar masih murah
AI       : Budget & luas?
Customer : 2–5 M untuk 5–10 ha
AI       : Prioritas pengairan teknis (produktif) + akses jalan?
Customer : Iya teknis lebih baik
AI       : Wajib cek: sertifikat + bukan sengketa + peruntukan pertanian. Setuju?
Customer : Iya
AI       : Cash/KPR & target?
Customer : Cash, 6 bulan
AI       : Siap! Sawah 5–10 ha pengairan teknis Jember/Banyuwangi (sertifikat + peruntukan clear + akses jalan), 2–5M, cash, target 6 bulan, investasi!
```

### CASE 15 | Beli | Lahan Pabrik (marah - legalitas)
```
Customer : Cari lahan pabrik di Gresik setahun, selalu masalah legalitas!
AI       : Legalitas lahan industri Gresik memang perlu teliti. Saya fokuskan yang sertifikatnya BERSIH. Luas & budget?
Customer : 5.000 m², zona industri, 8–15 M, cash siap
AI       : Prioritas akses truk + dekat tol?
Customer : Iya dua-duanya
AI       : Target?
Customer : Secepatnya
AI       : Saya carikan lahan zona industri Gresik 5.000m² (akses truk + dekat tol) dengan VERIFIKASI LEGALITAS PENUH sebelum Anda keluarkan dana, 8–15M cash. Update 48 jam!
```

### CASE 16 | Beli | Lahan Pengembangan Perumahan
```
Customer : Beli lahan besar buat dikembangkan jadi perumahan cluster
AI       : Untuk pengembangan, prioritas: luas, peruntukan, akses. Luas minimal?
Customer : Minimal 5.000 m² atau 0,5 ha
AI       : Kota & prioritas?
Customer : Surabaya/Sidoarjo, yang aksesnya bagus & bebas banjir
AI       : Penting — cek peruntukan (RTRW) perumahan + legalitas + BEBAS BANJIR. Setuju?
Customer : Iya wajib semua
AI       : Budget, cash/KPR & target?
Customer : 10–25 M, cash, 6 bulan
AI       : Siap! Lahan 5.000m²+ Surabaya/Sidoarjo (peruntukan perumahan + akses bagus + BEBAS BANJIR + legalitas clear), 10–25M, cash, target 6 bulan, cluster!
```

### CASE 17 | Beli | Lahan Dekat Tol Baru
```
Customer : Beli lahan dekat akses tol baru di Jatim buat investasi
AI       : Lahan dekat tol baru = capital gain tinggi! Ruas mana?
Customer : Yang lagi dibangun/baru dibuka, strategis
AI       : Prioritas dekat exit tol + peruntukan fleksibel (komersial/gudang)?
Customer : Iya, yang bisa buat macam-macam
AI       : Wajib cek legalitas + RTRW + bukan lahan hijau abadi. Setuju?
Customer : Iya
AI       : Budget, cash/KPR & target?
Customer : 3–8 M, cash, 6 bulan
AI       : Siap! Lahan dekat exit tol baru Jatim (peruntukan fleksibel + legalitas + RTRW clear), 3–8M, cash, target 6 bulan, investasi capital gain!
```

### CASE 18 | Beli | Fasilitas Olahraga (lapangan/kolam)
```
Customer : Beli lahan atau fasilitas olahraga di Surabaya buat gelanggang
AI       : Untuk gelanggang olahraga, butuh lahan luas + akses + parkir. Jenis?
Customer : Futsal + kolam renang + gym
AI       : Kompleks olahraga! Luas?
Customer : 5.000 m²+
AI       : Prioritas dekat perumahan padat/kampus (member) + akses lancar + parkir?
Customer : Iya semua
AI       : Wajib cek legalitas + bebas banjir. Budget & cash/KPR?
Customer : 8–15 M, cash
AI       : Target?
Customer : 6 bulan
AI       : Siap! Lahan 5.000m²+ Surabaya dekat perumahan/kampus (akses lancar + parkir + BEBAS BANJIR + legalitas clear), kompleks olahraga, 8–15M, cash, target 6 bulan!
```

### CASE 19 | Beli | Lahan Wisata (Bromo/Batu)
```
Customer : Beli lahan buat resort kecil di area wisata
AI       : Investasi wisata menjanjikan! Area — Bromo, Batu, atau Prigen?
Customer : Area Bromo yang view-nya bagus
AI       : Luas?
Customer : 2 ha
AI       : Prioritas view spektakuler + sejuk + akses tamu bisa?
Customer : Iya, view sunrise Bromo kalau bisa
AI       : Wajib cek: HGB/peruntukan wisata + bukan kawasan lindung + akses jalan. Setuju?
Customer : Iya wajib
AI       : Budget, cash/KPR & target?
Customer : 5–10 M, cash, 6 bulan
AI       : Siap! Lahan 2 ha area Bromo (view sunrise + sejuk + akses tamu + peruntukan wisata + bukan kawasan lindung), 5–10M, cash, target 6 bulan, resort!
```

### CASE 20 | Beli | WA Singkat
```
Customer : beli lahan industri gresik 5000m 10M cash 4bln zona industri akses truk bebas banjir
AI       : Prioritas dekat tol & legalitas bersih?
Customer : iya wajib dua-duanya
AI       : Siap! Lahan 5.000m² zona industri Gresik (akses truk + dekat tol + BEBAS BANJIR + legalitas bersih), 10M, cash, target 4 bulan!
```

---

## 📋 CATATAN PENUTUP — PRIORITAS RED FLAG PER SUB-TIPE
| Sub-tipe | Red Flag Utama | Preferensi Lokasi |
|---|---|---|
| Kavling/Tanah | Sengketa, banjir, peruntukan salah | Asri/sejuk (villa), akses mobil |
| SPBU | Legalitas Pertamina, volume rendah | Jalan ramai, akses lancar |
| Pabrik | Peruntukan non-industri, banjir | Zona industri, akses truk, dekat tol |
| Pertanian | Bukan sengketa, tanpa air | Sejuk (Malang/Batu), sumber air |
| Fasilitas Olahraga | Banjir, izin | Dekat perumahan/kampus, parkir |
| Lahan Wisata | Kawasan lindung, akses ekstrem | View bagus, sejuk, dekat wisata |

---
*File: 12_SKILL_OTHER_PROPERTY_CHAT.md | Elevan Property Chatbot Skills v2.0*

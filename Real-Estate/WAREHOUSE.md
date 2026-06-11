# SKILL: WAREHOUSE / GUDANG — Panduan Respons Chatbot Property
**Tipe Property:** Gudang (Warehouse)
**Transaksi:** Sewa & Beli | **Total Case:** 35 (15 Sewa + 20 Beli)

---

## 🔧 SLOT KHUSUS GUDANG
```json
{
  "floor_area_sqm": null,
  "ceiling_height_m": null,
  "loading_dock": null,
  "industrial_zone": null,
  "power_capacity_kva": null,
  "sprinkler": null,
  "office_room": null
}
```
**Pertanyaan Kunci:** Luas (m²), tinggi plafon, loading dock, zona industri/logistik, kapasitas listrik, ada kantor kecil?

---

## BAGIAN A: SEWA GUDANG (15 CASE)

### CASE S-01 | Sewa Gudang | Normal
```
Customer : Mau sewa gudang di Surabaya
AI       : Siap! Gudang untuk apa — produksi, distribusi/logistik, atau penyimpanan?
Customer : Distribusi FMCG, butuh yang dekat jalan tol
AI       : Distribusi FMCG — akses tol dan loading dock kritis. Area Surabaya mana?
Customer : Waru Sidoarjo atau Rungkut, dekat tol
AI       : Luas yang dibutuhkan?
Customer : 1.000–1.500 m²
AI       : Tinggi plafon minimal?
Customer : Minimal 8 meter
AI       : Berapa loading dock yang dibutuhkan?
Customer : Minimal 2 loading dock
AI       : Budget sewa per bulan?
Customer : 30–50 juta
AI       : Perlu ruangan kantor kecil di dalam gudang?
Customer : Iya, untuk 5 orang admin
AI       : Kapasitas listrik yang dibutuhkan?
Customer : 100–200 KVA
AI       : Kapan mulai dan berapa lama?
Customer : 3 bulan lagi, sewa 3 tahun
AI       : Siap! Gudang distribusi 1.000–1.500m², plafon 8m+, 2 loading dock, kantor 5 orang, 100–200 KVA, dekat tol Waru/Rungkut, 30–50 juta/bulan, 3 tahun, mulai 3 bulan lagi!
```

### CASE S-02 | Malas Ketik
```
Customer : sewa gudang surabaya 1000m2
AI       : Area & tujuan?
Customer : rungkut, distribusi
AI       : Plafon & loading dock?
Customer : 7m, 2 dock
AI       : Budget/bln & berapa lama?
Customer : 25-35jt, 3 tahun
AI       : Kapan mulai?
Customer : 2 bln lagi
AI       : Siap! Gudang 1.000m², plafon 7m, 2 loading dock, Rungkut Surabaya, 25–35jt/bln, 3 tahun, mulai 2 bulan lagi!
```

### CASE S-03 | Info Terbatas
```
Customer : perlu gudang buat usaha baru
AI       : Usaha apa? Ini membantu tentukan spesifikasi yang tepat.
Customer : Jual furnitur, perlu tempat simpan stok besar
AI       : Furnitur membutuhkan gudang luas dengan plafon tinggi. Di kota mana?
Customer : Surabaya atau Sidoarjo
AI       : Luas perkiraan?
Customer : Belum tahu, stok mungkin 500–800 barang besar
AI       : Estimasi sekitar 500–800 m². Tinggi plafon?
Customer : Tinggi, banyak barang besar
AI       : Minimal 6–7 meter cukup untuk furnitur. Budget per bulan?
Customer : 15–25 juta
AI       : Kapan mulai?
Customer : 3 bulan lagi
AI       : Berapa lama?
Customer : 2 tahun
AI       : Loading dock diperlukan?
Customer : Iya, sering ada truk besar masuk
AI       : Siap! Gudang 500–800m², plafon 6–7m, loading dock, Surabaya/Sidoarjo, 15–25 juta/bulan, 2 tahun, mulai 3 bulan lagi!
```

### CASE S-04 | Tanya Harga
```
Customer : Sewa gudang 1000m2 di Surabaya berapa?
AI       : Di Surabaya, sewa gudang 1.000 m² range 20–45 juta/bulan tergantung lokasi, tinggi plafon, dan fasilitas. Dekat tol lebih mahal. Untuk apa gudangnya?
Customer : Logistik e-commerce
AI       : Butuh loading dock dan akses kendaraan besar. Area mana di Surabaya?
Customer : Dekat tol Waru atau MERR
AI       : Plafon minimal?
Customer : 7 meter
AI       : Budget?
Customer : 25–40 juta
AI       : Kapan mulai dan berapa lama?
Customer : Bulan depan, 3 tahun
AI       : Loading dock berapa?
Customer : 2
AI       : Siap! Gudang 1.000m², plafon 7m, 2 dock, dekat tol Waru/MERR Surabaya, 25–40 juta/bulan, 3 tahun, mulai bulan depan!
```

### CASE S-05 | Marah
```
Customer : Sudah cari gudang di Surabaya 3 bulan, selalu sudah disewa orang! Tolong bantu serius
AI       : Pasar gudang Surabaya memang sangat kompetitif sekarang! Mari kita action. Luas dan spesifikasi yang Anda butuhkan?
Customer : 800–1.200 m², plafon 7m, 2 loading dock, dekat tol
AI       : Budget per bulan?
Customer : 25–40 juta
AI       : Kapan butuh?
Customer : Secepatnya, sudah sangat mendesak
AI       : Berapa lama?
Customer : 3 tahun
AI       : Saya aktifkan alert dan cek semua koneksi kami sekarang. Gudang 800–1.200m², plafon 7m, 2 dock, dekat tol Surabaya/Sidoarjo, 25–40 juta/bulan, 3 tahun — saya hubungi dalam 2 jam!
```

### CASE S-06 | Ganti-Ganti
```
Customer : mau sewa gudang di Surabaya atau Sidoarjo
AI       : Tujuan gudang untuk apa?
Customer : Produksi... tapi mungkin juga distribusi
AI       : Keduanya berbeda. Produksi butuh listrik besar dan ventilasi. Distribusi lebih ke akses tol. Mana yang lebih dominan?
Customer : Distribusi lebih banyak
AI       : Sidoarjo dekat tol Waru sangat strategis untuk distribusi. Setuju?
Customer : Iya Sidoarjo oke
AI       : Luas?
Customer : 1.000 m²... mungkin 1.500 m² lebih aman
AI       : Budget per bulan?
Customer : 30–50 juta
AI       : Plafon dan loading dock?
Customer : 7m, 2 dock
AI       : Kapan mulai?
Customer : 3 bulan
AI       : Berapa lama?
Customer : 3 tahun
AI       : Siap! Gudang distribusi 1.000–1.500m² dekat tol Waru Sidoarjo, plafon 7m, 2 dock, 30–50 juta/bulan, 3 tahun!
```

### CASE S-07 | Tidak Tahu Yang Mau
```
Customer : mau sewa gudang tapi belum tahu spesifikasi yang pas
AI       : Santai, saya bantu dari pertanyaan dasar. Produk apa yang akan disimpan?
Customer : Produk makanan kering FMCG
AI       : Makanan kering FMCG: penting ada ventilasi baik, bebas banjir, bisa juga butuh suhu terkontrol. Apakah perlu cold storage?
Customer : Tidak, kering semua
AI       : Berapa ton atau berapa SKU produk yang akan disimpan?
Customer : Sekitar 200 ton
AI       : Estimasi butuh 600–800 m² untuk 200 ton. Di kota mana?
Customer : Surabaya
AI       : Budget per bulan?
Customer : 20–30 juta
AI       : Kapan mulai dan berapa lama?
Customer : 2 bulan lagi, 2 tahun
AI       : Loading dock diperlukan?
Customer : Iya, untuk truk 8 ton
AI       : Plafon?
Customer : Yang standar, 6 meter cukup
AI       : Siap! Gudang 600–800m² plafon 6m, loading dock, Surabaya, 20–30 juta/bulan, 2 tahun, mulai 2 bulan lagi!
```

### CASE S-08 | Cold Storage
```
Customer : Cari gudang cold storage di Surabaya
AI       : Cold storage memerlukan spesifikasi khusus — sistem refrigerasi, insulasi, dan kapasitas listrik besar. Di area mana?
Customer : Dekat pelabuhan Tanjung Perak
AI       : Luas dan suhu berapa yang dibutuhkan?
Customer : 500 m², suhu -18°C untuk frozen food
AI       : Budget per bulan? Cold storage biasanya lebih mahal dari gudang dry.
Customer : 40–70 juta
AI       : Kapan mulai?
Customer : 3 bulan lagi
AI       : Berapa lama?
Customer : 3 tahun
AI       : Kapasitas listrik yang dibutuhkan?
Customer : Minimal 200 KVA
AI       : Siap! Gudang cold storage 500m², -18°C, kapasitas listrik 200 KVA, dekat Tanjung Perak Surabaya, 40–70 juta/bulan, 3 tahun, mulai 3 bulan lagi!
```

### CASE S-09 | Gudang Kecil untuk UKM
```
Customer : Usaha kecil, mau sewa gudang mini di Surabaya
AI       : Gudang mini untuk UKM! Luas berapa yang dibutuhkan?
Customer : 100–200 m² sudah cukup
AI       : Budget per bulan?
Customer : 5–10 juta
AI       : Di area mana di Surabaya?
Customer : Tidak harus di pusat, yang penting tidak terlalu jauh
AI       : Area Rungkut atau Waru Sidoarjo banyak pilihan gudang mini dengan harga lebih terjangkau. Sesuai?
Customer : Iya oke
AI       : Kapan mulai?
Customer : Bulan depan
AI       : Berapa lama?
Customer : 1 tahun
AI       : Plafon minimal?
Customer : 4–5 meter cukup
AI       : Siap! Gudang mini 100–200m², plafon 4–5m, Rungkut/Waru, 5–10 juta/bulan, 1 tahun, mulai bulan depan!
```

### CASE S-10 | Butuh Kantor dalam Gudang
```
Customer : Sewa gudang di Surabaya yang ada ruang kantornya
AI       : Gudang dengan office space — sangat umum untuk operasional. Area mana?
Customer : Surabaya Timur atau Sidoarjo
AI       : Luas gudang total?
Customer : 800 m²
AI       : Berapa persen untuk kantor?
Customer : Sekitar 100–150 m² untuk kantor, sisanya gudang
AI       : Budget per bulan?
Customer : 25–35 juta
AI       : Plafon gudang?
Customer : 7 meter
AI       : Kapan mulai?
Customer : 2 bulan
AI       : Berapa lama?
Customer : 3 tahun
AI       : Siap! Gudang 800m² (650m² gudang + 150m² kantor), plafon 7m, Surabaya Timur/Sidoarjo, 25–35 juta/bulan, 3 tahun!
```

### CASE S-11 | Butuh Izin/Zona
```
Customer : Mau sewa gudang buat produksi kimia, ada persyaratan khusus?
AI       : Produksi kimia memerlukan gudang di zona industri yang diperuntukkan, bukan zona perumahan. Izin yang perlu: IPAL (Instalasi Pengolahan Air Limbah), izin lingkungan, IMB untuk industri, dan memenuhi standar OHSA. Di kota mana?
Customer : Surabaya atau Gresik, ada kawasan industri
AI       : JIIPE Gresik atau Kawasan Industri PIER Pasuruan lebih tepat untuk produksi kimia. Luas yang dibutuhkan?
Customer : 500–800 m²
AI       : Budget per bulan?
Customer : 20–35 juta
AI       : Kapan mulai?
Customer : 3 bulan
AI       : Berapa lama?
Customer : 3 tahun
AI       : Siap! Gudang di zona industri (JIIPE Gresik/PIER Pasuruan), 500–800m², 20–35 juta/bulan, 3 tahun — saya bantu juga cek peruntukan zonasi dan izin produksi kimia!
```

### CASE S-12 | Butuh Akses 24 Jam
```
Customer : Perlu gudang logistik yang bisa diakses 24 jam di Surabaya
AI       : Untuk logistik 24 jam, butuh kawasan industri yang memang operasional non-stop. Area mana di Surabaya?
Customer : Dekat tol, untuk distribusi ke luar kota
AI       : Area Waru atau Rungkut yang dekat Tol Surabaya–Gempol sangat strategis. Luas?
Customer : 1.200 m²
AI       : Budget?
Customer : 30–45 juta
AI       : Plafon dan loading dock?
Customer : 8 meter, 3 dock
AI       : Kapan mulai?
Customer : 2 bulan
AI       : Berapa lama?
Customer : 3 tahun
AI       : Siap! Gudang logistik 24 jam, 1.200m², plafon 8m, 3 dock, dekat tol Waru/Rungkut, 30–45 juta/bulan, 3 tahun!
```

### CASE S-13 | Gudang Halalcertified
```
Customer : Butuh gudang dengan sertifikasi halal untuk produk makanan
AI       : Gudang halal butuh zona penyimpanan terpisah, prosedur kebersihan khusus, dan sertifikasi dari BPJPH/MUI. Di kota mana?
Customer : Surabaya atau Sidoarjo
AI       : Luas?
Customer : 600–800 m²
AI       : Budget per bulan?
Customer : 20–30 juta
AI       : Kapan mulai?
Customer : 3 bulan
AI       : Berapa lama?
Customer : 2 tahun
AI       : Apakah Anda juga perlu sertifikasi halal baru atau mau yang gudangnya sudah bersertifikat?
Customer : Sudah bersertifikat lebih mudah
AI       : Siap! Gudang bersertifikat halal 600–800m² di Surabaya/Sidoarjo, 20–30 juta/bulan, 2 tahun, mulai 3 bulan lagi!
```

### CASE S-14 | Sewa Singkat 6 Bulan
```
Customer : Perlu sewa gudang hanya 6 bulan di Surabaya
AI       : Short-term gudang lebih jarang tersedia, tapi ada yang mau. Di area mana?
Customer : Surabaya Timur atau Selatan
AI       : Luas?
Customer : 300–500 m²
AI       : Budget per bulan?
Customer : 12–18 juta
AI       : Plafon minimal?
Customer : 5 meter
AI       : Kapan mulai?
Customer : Bulan depan
AI       : Siap! Saya carikan yang mau sewa 6 bulan: gudang 300–500m², plafon 5m, Surabaya Timur/Selatan, 12–18 juta/bulan!
```

### CASE S-15 | WA Singkat
```
Customer : sewa gudang sidoarjo 1000m plafon 7m 2 dock
AI       : Budget/bln & berapa lama?
Customer : 30-40jt, 3 tahun
AI       : Kapan mulai?
Customer : 2 bln lagi
AI       : Siap! Gudang 1.000m², plafon 7m, 2 dock, Sidoarjo, 30–40jt/bln, 3 tahun, mulai 2 bulan lagi!
```

---

## BAGIAN B: BELI GUDANG (20 CASE)

### CASE B-01 | Normal
```
Customer : Mau beli gudang di Surabaya untuk distribusi
AI       : Area mana dan luas yang dibutuhkan?
Customer : Waru Sidoarjo, 2.000 m²
AI       : Budget?
Customer : 8–15 miliar
AI       : KPR atau cash?
Customer : Cash
AI       : Plafon dan loading dock?
Customer : 8 meter, 4 dock
AI       : Target beli?
Customer : 4 bulan
AI       : Perlu kantor di dalam?
Customer : Iya, 200 m² kantor
AI       : Kapasitas listrik?
Customer : 300 KVA
AI       : Siap! Gudang distribusi 2.000m² (1.800 gudang + 200 kantor), plafon 8m, 4 dock, 300 KVA, Waru Sidoarjo, 8–15M, cash, target 4 bulan!
```

### CASE B-02 | Malas Ketik
```
Customer : beli gudang surabaya 1500m invest
AI       : Area & budget?
Customer : rungkut, 6-10M
AI       : Cash/KPR & target?
Customer : cash, 3 bln
AI       : Plafon & dock?
Customer : 7m, 2 dock
AI       : Siap! Gudang 1.500m², plafon 7m, 2 dock, Rungkut Surabaya, 6–10M, cash, target 3 bulan, investasi!
```

### CASE B-03 | Info Terbatas
```
Customer : mau investasi gudang, mana yang bagus?
AI       : Gudang adalah aset defensif yang bagus! Untuk investasi, area dengan demand tinggi: dekat kawasan industri (Rungkut, Waru, JIIPE), dekat pelabuhan (Tanjung Perak), atau dekat tol. Budget?
Customer : 5–10 miliar
AI       : Luas yang ideal?
Customer : 1.000–2.000 m²
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 6 bulan
AI       : Siap! Gudang investasi 1.000–2.000m² di area logistik strategis Surabaya/Sidoarjo, 5–10M, cash, target 6 bulan. Saya carikan yang yield sewanya paling tinggi!
```

### CASE B-04 hingga B-20 (ringkasan variasi)

**B-04 | Tanya Harga**
```
Customer : Harga gudang 2000m2 di Sidoarjo berapa?
AI       : Di Sidoarjo dekat tol, gudang 2.000m² biasanya 8–16 M tergantung plafon, dock, dan fasilitas. Budget Anda?
Customer : 8–13 M
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Plafon dan dock?
Customer : 8m, 3 dock
AI       : Siap! Gudang 2.000m², plafon 8m, 3 dock, Sidoarjo, 8–13M, cash, target 4 bulan!
```

**B-05 | Marah**
```
Customer : Cari gudang di Surabaya 4 bulan, selalu ada masalah harga atau kondisi. Cash siap!
AI       : Cash buyer dengan dana siap adalah posisi terkuat. Spesifikasi yang Anda butuhkan?
Customer : 1.500 m², plafon 8m, 2 dock, dekat tol, max 8 M
AI       : Target seberapa cepat?
Customer : Secepat mungkin, sangat mendesak
AI       : Saya aktifkan semua jaringan kami sekarang untuk gudang 1.500m², plafon 8m, 2 dock, dekat tol Surabaya, max 8M, cash. Berikan saya 24 jam!
```

**B-06 | Ganti-Ganti**
```
Customer : mau beli gudang di Surabaya atau Sidoarjo
AI       : Untuk tujuan apa — usaha sendiri atau investasi?
Customer : Usaha distribusi... tapi kalau harga bagus untuk investasi juga
AI       : Budget?
Customer : 6–10 miliar
AI       : Cash atau KPR?
Customer : Cash
AI       : Luas?
Customer : 1.200–1.800 m²
AI       : Target?
Customer : 4 bulan
AI       : Siap! Komparasi gudang Surabaya vs Sidoarjo, 1.200–1.800m², 6–10M, cash, target 4 bulan!
```

**B-07 | First Timer**
```
Customer : Pertama kali beli gudang, apa yang harus dicek?
AI       : Yang harus dicek: (1) IMB dan peruntukan zona (industri/logistik), (2) Kondisi struktur atap dan lantai, (3) Kapasitas listrik dan air, (4) Akses kendaraan besar, (5) Status sertifikat (SHM/SHGB). Mau saya bantu verifikasi? Di kota mana Anda cari?
Customer : Surabaya, budget 5–8 M
AI       : Cash atau KPR?
Customer : Cash
AI       : Luas dan spesifikasi?
Customer : 800–1.200 m², plafon 7m
AI       : Target?
Customer : 4 bulan
AI       : Siap! Gudang 800–1.200m², plafon 7m, Surabaya, 5–8M, cash, target 4 bulan. Saya bantu due diligence lengkap!
```

**B-08 | Investasi Murni**
```
Customer : Mau beli gudang untuk disewakan di kawasan industri Surabaya
AI       : Gudang investasi yang sangat solid! Area industri mana yang Anda targetkan?
Customer : SIER Rungkut atau Waru
AI       : Budget?
Customer : 6–10 M
AI       : Luas?
Customer : 1.000–1.500 m²
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 3 bulan
AI       : Siap! Gudang investasi 1.000–1.500m² di SIER Rungkut/Waru, 6–10M, cash, target 3 bulan!
```

**B-09 hingga B-20** *(format ringkas)*
```
B-09 | Butuh Lahan Luas + Gudang
Customer : Mau beli lahan 5.000m2 dengan gudang di atasnya di Gresik
AI       : Budget & target?
Customer : 10–20M, cash, 6 bln
AI       : Siap! Lahan + gudang 5.000m² di Gresik, 10–20M, cash, 6 bulan!

B-10 | WA Singkat
Customer : beli gudang gresik 2000m 10M cash
AI       : Plafon, dock & target?
Customer : 8m, 3 dock, 4 bln
AI       : Siap! Gudang 2.000m², plafon 8m, 3 dock, Gresik, 10M, cash, 4 bulan!

B-11 | KPR Komersial
Customer : Beli gudang 8M dengan KPR, cicilan berapa?
AI       : KPR komersial gudang 8M, DP 30% = 2,4M. Pokok 5,6M, bunga 9-10%, tenor 10 tahun = cicilan ~70-75 juta/bulan. Sesuai cashflow?
Customer : Agak berat, cari yang 5M
AI       : Budget 5M, spesifikasi?
Customer : 1000m2, plafon 7m
AI       : Cash atau KPR?
Customer : KPR
AI       : Siap! Gudang 1.000m², plafon 7m, 5M, KPR komersial Surabaya/Sidoarjo!

B-12 | Gudang Cold Storage Beli
Customer : Mau beli gudang cold storage di Surabaya
AI       : Budget & luas?
Customer : 8–15M, 500m2
AI       : Cash/KPR & target?
Customer : Cash, 4 bln
AI       : Siap! Gudang cold storage 500m² Surabaya, 8–15M, cash, target 4 bulan!

B-13 | Di Kawasan Khusus
Customer : Mau beli gudang di JIIPE Gresik
AI       : JIIPE area industri premium. Budget?
Customer : 15–25M
AI       : Luas?
Customer : 3.000 m²
AI       : Cash/KPR & target?
Customer : Cash, 6 bln
AI       : Siap! Gudang 3.000m² di JIIPE Gresik, 15–25M, cash, target 6 bulan!

B-14 | Portofilo Investor
Customer : Sudah punya 2 gudang di Surabaya, mau expand ke Pasuruan
AI       : Pasuruan PIER menarik! Budget?
Customer : 10–18M, cash
AI       : Luas & target?
Customer : 2000m2, 4 bln
AI       : Siap! Gudang 2.000m² PIER Pasuruan, 10–18M, cash, 4 bulan!

B-15 | Butuh Sertifikat Bersih
Customer : Mau beli gudang tapi takut ada masalah sertifikat
AI       : Cek SHGB/SHM, IMB, dan peruntukan zona adalah wajib. Mau saya bantu verifikasi full? Di kota mana?
Customer : Surabaya, budget 7M
AI       : Luas & target?
Customer : 1500m2, 4 bln
AI       : Siap! Gudang 1.500m² Surabaya, 7M, cash, target 4 bulan — dengan verifikasi legalitas penuh!

B-16 | Kombinasi Gudang + Kantor
Customer : Mau beli properti yang ada gudang besar dan kantor representatif
AI       : Budget & lokasi?
Customer : 10–15M, Surabaya Timur
AI       : Luas total?
Customer : 2000m2 gudang + 300m2 kantor
AI       : Cash/KPR & target?
Customer : Cash, 4 bln
AI       : Siap! Properti industri 2.000m² gudang + 300m² kantor, Surabaya Timur, 10–15M, cash, 4 bulan!

B-17 | Tanya Nilai Investasi
Customer : Gudang di Surabaya, apakah nilainya naik?
AI       : Gudang di area strategis Surabaya historis naik 5–10% per tahun. Dekat tol dan kawasan industri paling kuat. Budget Anda?
Customer : 6–10M
AI       : Area & target?
Customer : Waru, 4 bln
AI       : Siap! Gudang investasi di Waru Sidoarjo, 6–10M, cash, target 4 bulan!

B-18 | Untuk Pabrik Kecil
Customer : Mau beli gudang untuk dijadikan pabrik garmen kecil di Surabaya
AI       : Pabrik garmen perlu listrik besar, ventilasi, dan akses mudah. Area mana?
Customer : Surabaya Barat, 1500m2, 6M
AI       : Cash/KPR & target?
Customer : Cash, 4 bln
AI       : Siap! Gudang/workshop 1.500m² Surabaya Barat, 6M, cash, 4 bulan, untuk garmen!

B-19 | Urgent
Customer : Butuh beli gudang di Surabaya ASAP, ekspansi mendadak
AI       : Cash siap?
Customer : Ya, 8M siap transfer
AI       : Spesifikasi minimal?
Customer : 1200m2, plafon 7m, 2 dock, dekat tol
AI       : Saya aktifkan semua network kami sekarang untuk gudang 1.200m², plafon 7m, 2 dock, dekat tol Surabaya, 8M, cash — target dalam minggu ini!

B-20 | WA Singkat
Customer : beli gudang surabaya 1500m 8M cash 4bln
AI       : Plafon & dock?
Customer : 7m, 2 dock
AI       : Siap! Gudang 1.500m², plafon 7m, 2 dock, Surabaya, 8M, cash, 4 bulan!
```

---
*File: 08_SKILL_WAREHOUSE_GUDANG.md | Elevan Property Chatbot Skills v1.0*
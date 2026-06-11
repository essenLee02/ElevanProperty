

# SKILL: MANSION HOUSE / RUMAH MEWAH — Panduan Respons Chatbot Property
**Tipe Property:** Rumah Mewah (Mansion House)
**Transaksi:** Sewa & Beli | **Total Case:** 35 (15 Sewa + 20 Beli)
**Catatan:** Budget jauh di atas rumah biasa: Sewa >5 juta/bulan, Beli >3 miliar

---

## 🔧 SLOT KHUSUS MANSION
```json
{
  "land_area_sqm": null,
  "building_area_sqm": null,
  "bedrooms": null,
  "bathrooms": null,
  "private_pool": null,
  "smart_home": null,
  "security_level": null,
  "staff_quarters": null,
  "garage_capacity": null
}
```

---

## BAGIAN A: SEWA RUMAH MEWAH (15 CASE)

### CASE S-01 | Normal
```
Customer : Mau sewa rumah mewah di Surabaya
AI       : Siap! Di area Surabaya mana yang Anda inginkan?
Customer : Citraland atau Pakuwon, cluster ekslusif
AI       : Area premium pilihan yang tepat! Fasilitas yang wajib ada?
Customer : Private pool, garasi 4 mobil, minimal 5 kamar tidur, smart home
AI       : Budget sewa per bulan?
Customer : 30–60 juta per bulan
AI       : Keluarga berapa orang yang akan tinggal?
Customer : 6 orang plus 2 ART
AI       : Kapan masuk dan berapa lama?
Customer : 3 bulan lagi, 2 tahun
AI       : Furnished atau kosongan?
Customer : Full furnished, kelas atas
AI       : Perlu kamar untuk ART (staf quarter)?
Customer : Iya, 2 kamar ART
AI       : Siap! Rumah mewah sewa di Citraland/Pakuwon, 5KT+, private pool, garasi 4 mobil, smart home, staf quarter x2, 30–60 juta/bulan, 2 tahun, full furnished, masuk 3 bulan lagi!
```

### CASE S-02 | Malas Ketik
```
Customer : sewa mansion surabaya citraland
AI       : Budget/bln & kamar?
Customer : 40-70jt, 5 kamar
AI       : Pool & garasi?
Customer : pool, garasi 3
AI       : Kapan & berapa lama?
Customer : 3 bln, 2 tahun
AI       : Furnished?
Customer : full
AI       : Siap! Mansion Citraland Surabaya, 5KT, private pool, garasi 3, 40–70jt/bln, 2 tahun, full furnished!
```

### CASE S-03 | Info Terbatas
```
Customer : mau sewa rumah yang sangat mewah di Surabaya
AI       : Siap untuk hunian premium! Di area mana?
Customer : Yang paling exclusive di Surabaya
AI       : Cluster paling ekslusif di Surabaya: Citraland Utama, Pakuwon Indah, dan beberapa kawasan di Gununganyar. Mana yang lebih dikenal?
Customer : Pakuwon Indah
AI       : Budget sewa per bulan?
Customer : Tidak terlalu masalah, yang penting world-class
AI       : Range 50–100 juta per bulan untuk mansion di Pakuwon Indah. Sesuai?
Customer : Iya acceptable
AI       : Spesifikasi minimal?
Customer : 5 kamar tidur, private pool, garasi 4 mobil, area entertainment
AI       : Keluarga berapa orang?
Customer : 7 orang
AI       : Kapan masuk?
Customer : 2 bulan lagi
AI       : Berapa lama?
Customer : 2 tahun
AI       : Furnished?
Customer : Full furnished premium
AI       : Siap! Mansion sewa di Pakuwon Indah Surabaya, 5KT+, private pool, garasi 4 mobil, area entertainment, full furnished premium, 50–100 juta/bulan, 2 tahun!
```

### CASE S-04 | Tanya Harga
```
Customer : Sewa rumah mewah di Jakarta Selatan berapa per bulannya?
AI       : Di Jakarta Selatan (Pondok Indah, Kemang, Cipete premium): rumah mewah 5KT dengan private pool disewakan 40–150 juta per bulan tergantung luas dan fasilitas. Budget Anda?
Customer : 50–80 juta per bulan
AI       : Area spesifik?
Customer : Pondok Indah
AI       : Berapa kamar dan fasilitas utama?
Customer : 5 kamar, private pool, garasi 3 mobil, garden
AI       : Untuk siapa?
Customer : Keluarga 5 orang + 2 ART
AI       : Kapan masuk?
Customer : Bulan depan
AI       : Berapa lama?
Customer : 2 tahun
AI       : Furnished?
Customer : Full furnished
AI       : Siap! Mansion sewa di Pondok Indah Jaksel, 5KT, private pool, garasi 3 mobil, garden, staf quarter, full furnished, 50–80 juta/bulan, 2 tahun!
```

### CASE S-05 | Marah
```
Customer : Sudah cari mansion di Surabaya 2 bulan, agen-agen tidak tahu stok! Frustrasi
AI       : Pasar mansion memang inventory-nya terbatas dan sering tidak dipublikasikan. Saya punya akses ke listing yang tidak selalu online. Budget dan spesifikasi?
Customer : 40–70 juta/bulan, 5 kamar, private pool, Citraland atau Pakuwon
AI       : Kapan butuh?
Customer : Bulan depan
AI       : Berapa lama?
Customer : 2 tahun
AI       : Furnished?
Customer : Full furnished
AI       : Saya langsung hubungi network kami untuk off-market listing mansion di Citraland/Pakuwon, 5KT+, private pool, 40–70 juta/bulan, full furnished, masuk bulan depan. Dalam 24 jam saya kembali!
```

### CASE S-06 | Ganti-Ganti
```
Customer : mau sewa rumah mewah di Surabaya
AI       : Area mana?
Customer : Citraland... tapi Pakuwon Indah lebih bagus ya?
AI       : Citraland lebih besar dan fasilitas kawasannya lebih banyak. Pakuwon Indah lebih ekslusif dan tenang. Budget membantu pilih — berapa per bulan?
Customer : 40–70 juta
AI       : Berapa kamar?
Customer : 5 kamar... eh 6 kamar karena ada orang tua yang ikut
AI       : 6 kamar, baik! Kapan masuk?
Customer : 3 bulan... mungkin 4
AI       : Furnished?
Customer : Full furnished, tapi ada beberapa barang pribadi
AI       : Berapa lama?
Customer : 2 tahun
AI       : Siap! Mansion 6KT di Citraland atau Pakuwon Indah, private pool, 40–70 juta/bulan, 2 tahun, full furnished!
```

### CASE S-07 | Tidak Tahu Yang Mau
```
Customer : mau sewa rumah mewah tapi bingung mau di mana
AI       : Asyik! Untuk membantu rekomendasi terbaik — di kota mana Anda akan tinggal atau bekerja?
Customer : Jakarta atau Surabaya, masih negotiate penempatan kerja
AI       : Untuk both kota, saya bisa siapkan opsi. Budget per bulan?
Customer : 50–100 juta
AI       : Keluarga berapa orang?
Customer : 6 orang
AI       : Fasilitas yang paling penting?
Customer : Private pool, keamanan tinggi, dan gated community
AI       : Kapan kira-kira masuk?
Customer : 2 bulan lagi
AI       : Berapa lama?
Customer : 2 tahun
AI       : Saya siapkan opsi di keduanya: mansion di Pondok Indah Jakarta dan Citraland Surabaya, 6KT+, private pool, gated, 50–100 juta/bulan, 2 tahun. Nanti setelah penempatan kerja clear, tinggal pilih!
```

### CASE S-08 | Untuk Expat
```
Customer : Klien kami expat dari Singapore butuh mansion di Jakarta 3 tahun
AI       : Untuk expat, biasanya prioritas: gated security ketat, international school nearby, dan fully serviced jika mungkin. Area Jakarta mana yang diinginkan?
Customer : Pondok Indah atau Kemang
AI       : Budget per bulan?
Customer : USD 10.000–15.000 atau sekitar 150–225 juta rupiah
AI       : Berapa kamar?
Customer : 5–6 kamar
AI       : Kapan masuk?
Customer : 2 bulan lagi
AI       : Furnished?
Customer : Full furnished, full service preferred
AI       : Dekat sekolah internasional mana?
Customer : British International School atau Jakarta Intercultural School
AI       : Siap! Mansion expat di Pondok Indah/Kemang Jakarta, 5–6KT, fully furnished, dekat BIS/JIS, private pool, keamanan premium, 150–225 juta/bulan, 3 tahun!
```

### CASE S-09 hingga S-15 (Variasi Ringkas)
```
S-09 | Smart Home
Customer : Cari mansion dengan sistem smart home di Surabaya
AI       : Area & budget?
Customer : Citraland, 40-60jt/bln
AI       : Kamar & fasilitas?
Customer : 5 kamar, pool, smart home integrated
AI       : Kapan & berapa lama?
Customer : 3 bln, 2 tahun
AI       : Siap! Mansion smart home Citraland, 5KT, pool, 40–60jt/bln, 2 tahun!

S-10 | Dengan Ballroom/Entertainment Room
Customer : Sewa mansion yang ada ballroom atau ruang entertainment di Surabaya
AI       : Area & budget?
Customer : Pakuwon, 60-100jt/bln
AI       : Kamar & kapan?
Customer : 6 kamar, 3 bln lagi
AI       : Berapa lama?
Customer : 2 tahun
AI       : Siap! Mansion Pakuwon, 6KT, ballroom/entertainment room, 60–100jt/bln, 2 tahun!

S-11 | Untuk Kepala Daerah/Pejabat
Customer : Perlu sewa rumah dinas kelas premium di Surabaya
AI       : Budget & fasilitas keamanan?
Customer : 30-50jt/bln, perlu keamanan 24 jam
AI       : Lokasi & kamar?
Customer : Pusat Surabaya, 5 kamar
AI       : Kapan & berapa lama?
Customer : 2 bln, setahun
AI       : Siap! Mansion Surabaya Pusat, keamanan 24 jam, 5KT, 30–50jt/bln, 1 tahun!

S-12 | Butuh Staf Quarter Besar
Customer : Sewa mansion yang ada ruang staf besar di Surabaya
AI       : Budget & berapa staf?
Customer : 40-70jt/bln, 4 staf (2 ART, 1 sopir, 1 satpam)
AI       : Area & kamar?
Customer : Citraland, 5 kamar + 4 kamar staf
AI       : Kapan & berapa lama?
Customer : 3 bln, 2 tahun
AI       : Siap! Mansion Citraland, 5KT + 4 staf quarter, 40–70jt/bln, 2 tahun!

S-13 | Untuk Honeymoon/Anniversay Singkat
Customer : Sewa mansion 3 hari untuk anniversary di Surabaya
AI       : Sewa singkat mansion — biasanya villa-mansion dengan konsep staycation. Area mana?
Customer : Citraland atau Pakuwon
AI       : Budget per malam?
Customer : 10-15 juta
AI       : Berapa orang?
Customer : Berdua + sedikit tamu malam pertama
AI       : Tanggal?
Customer : 20–23 Juli
AI       : Siap! Mansion/villa staycation 3 malam di Citraland/Pakuwon, 10–15 juta/malam, 20–23 Juli, untuk pasangan!

S-14 | Minta Renovasi Sebelum Masuk
Customer : Mau sewa mansion di Surabaya, tapi minta beberapa renovasi dulu
AI       : Renovasi sebelum masuk bisa dinegosiasikan dengan pemilik, terutama sewa jangka panjang. Budget dan area?
Customer : 40-60jt/bln, Pakuwon, 5 kamar
AI       : Renovasi apa yang diinginkan?
Customer : Upgrade dapur, tambah bath tub, repaint
AI       : Kapan masuk & berapa lama?
Customer : 3 bulan (beri waktu renovasi), 2 tahun
AI       : Siap! Mansion Pakuwon, 5KT, 40–60jt/bln, 2 tahun — dengan klausa renovasi (upgrade dapur + bathtub + repaint) sebelum masuk!

S-15 | WA Singkat
Customer : mansion surabaya citraland 5kt pool 50jt 2 tahun
AI       : Kapan masuk & furnished?
Customer : 3 bln, full furnished
AI       : Siap! Mansion Citraland, 5KT, private pool, full furnished, 50jt/bln, 2 tahun, masuk 3 bulan!
```

---

## BAGIAN B: BELI RUMAH MEWAH (20 CASE)

### CASE B-01 | Normal
```
Customer : Mau beli rumah mewah di Surabaya
AI       : Di area mana yang Anda inginkan?
Customer : Citraland Golf atau Pakuwon Indah
AI       : Budget pembelian?
Customer : 8–15 miliar
AI       : Fasilitas yang wajib ada?
Customer : Private pool, garasi 4 mobil, min 5KT, garden
AI       : KPR atau cash?
Customer : Cash
AI       : Target beli?
Customer : 6 bulan
AI       : Untuk siapa?
Customer : Keluarga 6 orang
AI       : Furnished?
Customer : Semi-furnished
AI       : Siap! Mansion beli di Citraland Golf/Pakuwon Indah Surabaya, 5KT+, private pool, garasi 4 mobil, garden, 8–15M, cash, target 6 bulan!
```

### CASE B-02 hingga B-20 (Variasi Kondisi)
```
B-02 | Malas Ketik: mansion beli citraland 5kt 10M cash 6bln, pool, garasi 3. Siap!

B-03 | Tanya Harga: Mansion Pondok Indah Jakarta berapa? Range 10–50M. Budget 15–25M, 5KT pool, KPR, 6 bln. Siap!

B-04 | Marah (gagal deal): Cash 12M siap, cari pengganti mansion Citraland Surabaya yang batal. Saya aktivasi semua network, 24 jam!

B-05 | Ganti Lokasi: Tadinya Citraland, switch ke Pakuwon. Budget 10–15M, 5KT, cash, 6 bln. Compare dua lokasi!

B-06 | Tidak Tahu: Mau beli mansion tapi bingung area. Kerja di Jaksel, budget 15–25M. Pondok Indah vs Kemang. KPR, 6 bln. Siap!

B-07 | Investasi: Mansion untuk disewakan expat Jakarta. Budget 20–30M, cash, 5KT pool, Pondok Indah, 6 bln. Siap!

B-08 | KPR Mewah: Beli mansion 15M dengan KPR. DP 30% = 4,5M, cicilan ~120–140jt/bln tenor 15 tahun. Sesuai? Budget turun ke 10M, KPR, Surabaya Citraland. Siap!

B-09 | Second Mewah: Mansion bekas di Pondok Indah Jakarta, kondisi bagus, cash 18M. Second + renovasi ringan oke. 5KT pool garasi 3. Siap!

B-10 | WA Singkat: mansion citraland 5kt pool 12M cash 6bln. Siap!

B-11 | Smart Home Baru: Beli mansion baru dengan smart home di Surabaya. Citraland Golf phase baru, 5KT, 12–18M, KPR, 6 bln. Siap!

B-12 | Untuk Orang Tua Mewah: Beli mansion untuk orang tua pensiun di Surabaya. Aksesibel, satu lantai preferred, Citraland/Darmo, 5KT, 8–12M, cash. Siap!

B-13 | Developer Premium: Compare Citraland vs Pakuwon beli mansion. 5KT pool, 10–15M, cash, 6 bln. Saya siapkan komparasi detail!

B-14 | Heritage/Bersejarah: Beli rumah mewah heritage kolonial di Surabaya. Area Darmo lama, LT 1.000m²+, 8–15M, cash. Siap!

B-15 | Untuk Resort Pribadi: Beli mansion sebagai private resort keluarga di Bali. Seminyak/Canggu, 6KT, 2 pool, 20–35M, cash. Siap!

B-16 | Tanya Capital Gain: Mansion Pondok Indah naik berapa per tahun? Historis 8–15%/tahun area prime. Budget 20M, cash, 5KT, 6 bln. Siap!

B-17 | Lahan Luas + Bangun: Mau beli lahan besar di Citraland untuk bangun mansion sendiri. 1.500m²+, budget 15–25M (lahan + konstruksi), cash. Siap!

B-18 | Untuk Anak yang Menikah: Hadiah pernikahan — beli mansion Surabaya untuk anak. Citraland, 4KT, 6–10M, cash, 4 bulan. Siap!

B-19 | Multi-Generational: Beli mansion yang bisa untuk 3 generasi. 6KT+, lift internal, Citraland/Pakuwon, 12–18M, cash, 6 bln. Siap!

B-20 | WA Singkat: mansion pkwn sby 6kt pool 15M cash 6bln invest/huni. Siap!
```

---

*File: 10_SKILL_MANSION.md | Elevan Property Chatbot Skills v1.0*


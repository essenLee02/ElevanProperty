# SKILL: RUMAH / HOUSE — 20 Simulasi Chat WhatsApp
**Tipe Property:** Rumah (House)
**Transaksi:** Beli, Sewa, Ngontrak | **Total Case:** 20
**Fokus:** Fasilitas, transaksi, area, preferensi lokasi & red flag

---

## 🔧 SLOT KHUSUS RUMAH
```json
{
  "transaction_type": null, "location_city": null, "location_detail": null,
  "bedrooms": null, "bathrooms": null, "land_area": null, "building_area": null,
  "budget_min": null, "budget_max": null, "furnished": null, "duration": null,
  "environment": {"asri": null, "sejuk": null, "akses_lancar": null, "bebas_banjir": null},
  "nearby": [], "red_flags": []
}
```

---

## BAGIAN A: SEWA & NGONTRAK RUMAH (Case 01–10)

### CASE 01 | Sewa | Asri + Sejuk + Bebas Banjir
```
Customer : Mau sewa rumah yang asri dan adem, capek panas
AI       : Paham! Asri + sejuk cocok di dataran tinggi seperti Malang atau Batu. Ada preferensi kota?
Customer : Malang aja, dekat kota tapi tetap sejuk
AI       : Area Lawang atau Malang kota bisa jadi pilihan. Budget/bulan?
Customer : 4–6 juta
AI       : Berapa kamar & untuk berapa orang?
Customer : 3 kamar, keluarga 4 orang
AI       : Saya pastikan lokasinya BEBAS BANJIR & akses jalan lancar ya
Customer : Iya wajib bebas banjir
AI       : Kapan masuk, berapa lama, furnished?
Customer : Bulan depan, 2 tahun, semi furnished
AI       : Siap! Rumah sewa 3KT area asri & sejuk Malang/Lawang, BEBAS BANJIR + akses lancar, semi furnished, 4–6jt/bln, 2 tahun, masuk bulan depan!
```

### CASE 02 | Sewa | Malas Ketik + Dekat Tol
```
Customer : sewa rumah sby barat deket tol gampang akses
AI       : Budget/bln & jumlah kamar?
Customer : 5-8jt, 3 kamar
AI       : Wajib dekat apa lagi? Pasar/minimarket?
Customer : deket indomaret aja
AI       : Bebas banjir penting? Sby Barat ada titik banjir
Customer : iya bebas banjir
AI       : Kapan & berapa lama?
Customer : bln depan 2 tahun
AI       : Siap! Rumah 3KT Surabaya Barat dekat tol + Indomaret, BEBAS BANJIR, 5–8jt/bln, 2 tahun!
```

### CASE 03 | Ngontrak | Dekat Kampus + Tenang
```
Customer : ngontrak rumah dekat UNAIR buat anak kuliah, yang tenang
AI       : Dekat UNAIR kampus B atau C? Dan "tenang" = hindari jalan besar bising ya?
Customer : Kampus B, iya jangan yang berisik
AI       : Tapi tetap akses mudah, tidak masuk gang dalam?
Customer : Iya, dekat Alfamart sama warung makan
AI       : Budget kontrak/tahun & jumlah kamar?
Customer : 35–45 juta/tahun, 3 kamar
AI       : Kapan mulai & berapa lama?
Customer : Agustus, 1 tahun
AI       : Siap! Rumah kontrak 3KT dekat UNAIR B, tenang tapi akses mudah, dekat Alfamart + warung, 35–45jt/tahun, mulai Agustus, 1 tahun!
```

### CASE 04 | Sewa | Info Terbatas
```
Customer : mau sewa rumah tapi belum tahu di mana yang bagus
AI       : Untuk kota apa dulu — Surabaya, Sidoarjo, atau Malang?
Customer : Surabaya, yang nyaman buat keluarga
AI       : Nyaman biasanya = perumahan/cluster yang tenang & aman. Prioritas dekat apa? Sekolah anak?
Customer : Iya dekat sekolah, sama yang gak banjir
AI       : Noted. Budget/bulan?
Customer : Belum tahu wajarnya berapa
AI       : Rumah 3KT di cluster Surabaya sekitar 4–8 juta/bulan. Sesuai?
Customer : Oke 5–7 juta
AI       : Kapan masuk & berapa lama?
Customer : 2 bulan, 2 tahun
AI       : Siap! Rumah sewa 3KT di cluster Surabaya, dekat sekolah + BEBAS BANJIR, 5–7jt/bln, 2 tahun, masuk 2 bulan lagi!
```

### CASE 05 | Sewa | Tanya Harga
```
Customer : Sewa rumah di Citraland Surabaya berapa?
AI       : Di Citraland, rumah 3KT sekitar 6–12 juta/bulan tergantung cluster & luas. Yang furnished lebih tinggi. Ada preferensi cluster?
Customer : Yang asri banyak taman
AI       : Citraland memang konsep kota taman. Budget?
Customer : 7–10 juta
AI       : Furnished & berapa kamar?
Customer : Full furnished, 3 kamar
AI       : Kapan masuk & berapa lama?
Customer : Bulan depan, 2 tahun
AI       : Siap! Rumah 3KT full furnished di Citraland (asri, banyak taman), 7–10jt/bln, 2 tahun, masuk bulan depan!
```

### CASE 06 | Ngontrak | Marah (susah dapat)
```
Customer : Sudah 2 bulan cari kontrakan di Sidoarjo gak dapat yang cocok!
AI       : Maaf atas kesulitannya — saya bantu percepat. Kriteria utamanya apa?
Customer : 3 kamar, bebas banjir, akses lancar, max 30 juta/tahun
AI       : Area Sidoarjo spesifik? Sidoarjo ada beberapa titik langganan banjir yang harus dihindari
Customer : Iya itu masalahnya, banyak yang banjir. Area yang aman aja
AI       : Saya fokuskan ke area elevasi aman Sidoarjo (Pondok Jati, Puri Indah, dll). Kapan butuh?
Customer : Secepatnya
AI       : Saya carikan kontrakan 3KT area BEBAS BANJIR Sidoarjo, akses lancar, max 30jt/tahun — saya update dalam 24 jam!
```

### CASE 07 | Sewa | Dekat Pasar & Mall
```
Customer : sewa rumah yang dekat pasar sekaligus dekat mall
AI       : Bisa diatur! Kota mana?
Customer : Surabaya, yang serba dekat
AI       : Area yang dekat pasar + mall: sekitar Rungkut (Pasar Soponyono + Maspion Square) atau Wiyung (dekat PTC). Preferensi?
Customer : Wiyung dekat PTC
AI       : Budget & jumlah kamar?
Customer : 5–7 juta, 3 kamar
AI       : Bebas banjir & kapan masuk?
Customer : Iya bebas banjir, bulan depan
AI       : Berapa lama?
Customer : 2 tahun
AI       : Siap! Rumah 3KT Wiyung dekat pasar + PTC, BEBAS BANJIR, 5–7jt/bln, 2 tahun, masuk bulan depan!
```

### CASE 08 | Sewa | Untuk Karyawan, Anti Macet
```
Customer : Sewa rumah dekat kantor di Rungkut Industri yang gak macet
AI       : Untuk hindari macet, saya carikan yang aksesnya bukan jalur padat industri. Berapa kamar?
Customer : 2 kamar cukup, buat saya & istri
AI       : Prioritas dekat apa? Minimarket, warung?
Customer : Dekat Indomaret sama tempat makan
AI       : Budget/bulan?
Customer : 3–5 juta
AI       : Kapan masuk & berapa lama?
Customer : Secepatnya, 1 tahun
AI       : Siap! Rumah 2KT dekat Rungkut Industri, akses anti-macet + dekat Indomaret & tempat makan, 3–5jt/bln, 1 tahun!
```

### CASE 09 | Ngontrak | Ganti-Ganti
```
Customer : mau ngontrak rumah di Surabaya
AI       : Area mana?
Customer : Barat... eh Timur aja deh dekat kerja
AI       : Timur baik! Budget & kamar?
Customer : 3 kamar... eh 2 aja cukup, 4 juta
AI       : Prioritas lingkungan?
Customer : Yang tenang tapi dekat minimarket
AI       : Kapan masuk & berapa lama?
Customer : Bulan depan, 1 tahun
AI       : Siap! Rumah kontrak 2KT Surabaya Timur, tenang + dekat minimarket, 4jt/bln setara ~48jt/tahun, 1 tahun, masuk bulan depan!
```

### CASE 10 | Sewa | WA Singkat
```
Customer : sewa rumah malang 3kt sejuk 5jt 2thn bebas banjir
AI       : Area Malang mana & furnished?
Customer : dekat kota, semi furnished
AI       : Siap! Rumah 3KT area sejuk Malang kota, BEBAS BANJIR, semi furnished, 5jt/bln, 2 tahun!
```

---

## BAGIAN B: BELI RUMAH (Case 11–20)

### CASE 11 | Beli | Asri + Sejuk + Dekat Wisata
```
Customer : Beli rumah di Batu yang asri sekalian dekat wisata
AI       : Batu memang asri & sejuk! Wisata acuan — BNS, Jatim Park, atau alun-alun?
Customer : Dekat BNS & Jatim Park biar sering jalan
AI       : Untuk tinggal atau investasi (bisa disewakan wisatawan)?
Customer : Tinggal, tapi kalau bisa disewakan lebih bagus
AI       : Budget & jumlah kamar?
Customer : 1,5–2,5 M, 3–4 kamar
AI       : Cash atau KPR? Dan saya pastikan bebas banjir + akses lancar ya
Customer : KPR, iya wajib
AI       : Target beli?
Customer : 6 bulan
AI       : Siap! Rumah 3–4KT di Batu dekat BNS/Jatim Park (asri, sejuk), BEBAS BANJIR + akses lancar, 1,5–2,5M, KPR, target 6 bulan!
```

### CASE 12 | Beli | Malas Ketik
```
Customer : beli rumah sidoarjo 3kt 800jt kpr bebas banjir
AI       : Area Sidoarjo mana & akses lancar penting?
Customer : yang aman banjir & jalan lebar
AI       : Target beli & furnished?
Customer : 4 bulan, kosongan
AI       : Siap! Rumah 3KT Sidoarjo BEBAS BANJIR + jalan lebar, 800jt, KPR, target 4 bulan, kosongan!
```

### CASE 13 | Beli | Tanya Harga
```
Customer : Harga rumah di Pakuwon City Surabaya berapa?
AI       : Rumah di Pakuwon City: 3KT mulai ~2,5 M, cluster premium bisa 5 M+. Area asri & fasilitas lengkap. Budget Anda?
Customer : 2,5–3,5 M
AI       : Jumlah kamar & prioritas?
Customer : 3–4 kamar, yang dekat mall & sekolah
AI       : Pakuwon City dekat Pakuwon Mall & sekolah internasional. Cash atau KPR?
Customer : Cash
AI       : Target beli?
Customer : 6 bulan
AI       : Siap! Rumah 3–4KT Pakuwon City (dekat mall + sekolah, asri), 2,5–3,5M, cash, target 6 bulan!
```

### CASE 14 | Beli | Investasi Kontrakan
```
Customer : Beli rumah buat dikontrakkan, mana yang cepat balik modal?
AI       : Untuk yield sewa bagus, dekat kampus/kawasan industri paling stabil. Kota & area?
Customer : Surabaya, dekat kampus yang rame
AI       : Dekat UNAIR/ITS okupansi tinggi. Rumah 3KT bisa dikontrak per kamar ke mahasiswa. Budget?
Customer : 1,5–2 M
AI       : Prioritas bebas banjir (biar penghuni betah) & dekat minimarket?
Customer : Iya penting dua-duanya
AI       : Cash atau KPR & target?
Customer : Cash, 4 bulan
AI       : Siap! Rumah 3KT dekat UNAIR/ITS Surabaya, BEBAS BANJIR + dekat minimarket, 1,5–2M, cash, target 4 bulan, investasi kontrakan!
```

### CASE 15 | Beli | Marah (kalah cepat)
```
Customer : Sudah 2x mau beli rumah keburu diambil orang! Kesal
AI       : Saya paham frustrasinya — rumah bagus cepat laku. Saya bantu prioritaskan Anda. Kriteria?
Customer : 3 kamar, Sidoarjo, bebas banjir, max 1,2 M cash
AI       : Cash siap itu keunggulan besar untuk closing cepat. Area spesifik & target?
Customer : Yang aman banjir, secepatnya
AI       : Saya aktifkan listing prioritas rumah 3KT BEBAS BANJIR Sidoarjo, max 1,2M cash — begitu ada yang cocok Anda dapat info pertama. Update 24 jam!
```

### CASE 16 | Beli | Dekat Tol + Akses Lancar
```
Customer : beli rumah yang dekat pintu tol biar mobilitas gampang
AI       : Cerdas untuk yang sering ke luar kota! Kota mana?
Customer : Sidoarjo atau Surabaya Selatan, dekat tol Waru/Aloha
AI       : Area itu akses tol-nya bagus. Budget & kamar?
Customer : 1–1,8 M, 3 kamar
AI       : Prioritas bebas banjir & tenang (bukan pinggir jalan bising)?
Customer : Iya, di dalam perumahan tapi dekat akses tol
AI       : Cash atau KPR & target?
Customer : KPR, 5 bulan
AI       : Siap! Rumah 3KT dalam perumahan dekat tol Waru/Aloha, BEBAS BANJIR + tenang, 1–1,8M, KPR, target 5 bulan!
```

### CASE 17 | Beli | First Timer (edukasi)
```
Customer : Pertama kali beli rumah, bingung mulai dari mana
AI       : Tenang, saya pandu! Pertama: budget & skema (cash/KPR). Berapa dana yang disiapkan?
Customer : DP sekitar 200 juta, sisanya KPR
AI       : Dengan DP 200jt, rumah ~800jt–1M feasible. Kota & area?
Customer : Sidoarjo, yang aman & nyaman keluarga
AI       : Untuk keluarga, saya prioritaskan cluster BEBAS BANJIR, dekat sekolah & minimarket. Berapa kamar?
Customer : 2–3 kamar
AI       : Target beli?
Customer : 6 bulan
AI       : Siap! Rumah 2–3KT cluster Sidoarjo, BEBAS BANJIR + dekat sekolah & minimarket, ~800jt–1M, KPR (DP 200jt), target 6 bulan. Saya bantu simulasi cicilan juga!
```

### CASE 18 | Beli | Rumah Second + Renovasi
```
Customer : Cari rumah second yang murah buat direnovasi di Surabaya
AI       : Strategi bagus untuk dapat lokasi prime harga miring! Area & budget?
Customer : Surabaya Timur, 700jt–1 M
AI       : Rumah second oke direnovasi. Tapi 2 hal wajib saya cek: struktur bangunan masih bagus & BEBAS BANJIR. Setuju?
Customer : Iya, jangan yang langganan banjir
AI       : Berapa kamar & cash/KPR?
Customer : 3 kamar, cash
AI       : Target?
Customer : 3 bulan
AI       : Siap! Rumah second 3KT Surabaya Timur (struktur bagus + BEBAS BANJIR), cocok renovasi, 700jt–1M, cash, target 3 bulan!
```

### CASE 19 | Beli | Multi-generasi + Aksesibel
```
Customer : Beli rumah yang muat 3 generasi, ada orang tua yang sepuh
AI       : Untuk 3 generasi + lansia, prioritas: 1 lantai atau kamar tidur di lantai bawah, akses ramah lansia. Kota?
Customer : Surabaya, yang nyaman & tenang
AI       : Berapa kamar minimal?
Customer : 4–5 kamar
AI       : Prioritas lingkungan asri & aman (cluster ber-security)?
Customer : Iya, plus bebas banjir & dekat rumah sakit
AI       : Noted semua. Budget & cash/KPR?
Customer : 2–3,5 M, cash
AI       : Target?
Customer : 6 bulan
AI       : Siap! Rumah 4–5KT (kamar bawah untuk lansia) di cluster asri & aman Surabaya, BEBAS BANJIR + dekat RS, 2–3,5M, cash, target 6 bulan!
```

### CASE 20 | Beli | WA Singkat
```
Customer : beli rumah citraland sby 4kt 3M cash 6bln asri dekat sekolah
AI       : Prioritas bebas banjir & akses lancar juga?
Customer : iya wajib
AI       : Siap! Rumah 4KT Citraland Surabaya (asri, dekat sekolah), BEBAS BANJIR + akses lancar, 3M, cash, target 6 bulan!
```

---
*File: 01_SKILL_HOUSE_RUMAH_CHAT.md | Elevan Property Chatbot Skills v2.0*

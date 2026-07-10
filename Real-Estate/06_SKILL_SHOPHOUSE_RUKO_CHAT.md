# SKILL: RUKO / SHOPHOUSE — 20 Simulasi Chat WhatsApp
**Tipe Property:** Ruko (Shophouse)
**Transaksi:** Sewa, Beli | **Total Case:** 20
**Fokus:** Fasilitas, transaksi, area, preferensi lokasi & red flag

---

## 🔧 SLOT KHUSUS RUKO
```json
{
  "transaction_type": null, "location": null, "business_type": null,
  "floors": null, "frontage_width": null, "budget": null, "duration": null,
  "environment": {"jalan_ramai": null, "akses_lancar": null, "bebas_banjir": null},
  "nearby": [], "parking": null, "red_flags": []
}
```

---

## BAGIAN A: SEWA RUKO (Case 01–10)

### CASE 01 | Sewa | Jalan Ramai + Akses Truk + Bebas Banjir
```
Customer : Sewa ruko di jalan ramai tapi gak macet parah buat usaha
AI       : Sweet spot: jalan arteri lebar (ramai tapi lancar). Usaha apa?
Customer : Toko bangunan
AI       : Toko bangunan butuh akses truk & bongkar muat. Area?
Customer : Surabaya Barat atau Sidoarjo
AI       : Prioritas pinggir jalan utama muat truk + parkir depan?
Customer : Iya wajib, sama bebas banjir
AI       : Penting — akses truk + parkir + BEBAS BANJIR (material gampang rusak). Berapa lantai & frontage?
Customer : 2 lantai, frontage min 5 meter
AI       : Budget/bulan & durasi?
Customer : 8–15 juta, 3 tahun
AI       : Siap! Ruko 2 lantai frontage 5m+ pinggir jalan utama Surabaya Barat/Sidoarjo, akses truk + parkir + BEBAS BANJIR, 8–15jt/bln, 3 tahun!
```

### CASE 02 | Sewa | Malas Ketik + Cafe
```
Customer : sewa ruko sby buat cafe deket kampus rame
AI       : Area kampus mana & berapa lantai?
Customer : deket UBAYA, 2 lantai
AI       : Prioritas parkir & frontage lebar buat terlihat?
Customer : iya parkir cukup, frontage 5m
AI       : Budget/bln & durasi?
Customer : 10-15jt 3 tahun
AI       : Siap! Ruko 2 lantai frontage 5m dekat UBAYA (area ramai mahasiswa), parkir cukup, cafe, 10–15jt/bln, 3 tahun!
```

### CASE 03 | Sewa | Info Terbatas
```
Customer : mau sewa ruko buat usaha tapi belum pasti
AI       : Usaha apa yang direncanakan? Ini penting untuk pilih lokasi tepat
Customer : Mungkin apotek atau minimarket
AI       : Keduanya butuh area padat penduduk + traffic. Kota mana?
Customer : Sidoarjo
AI       : Prioritas dekat perumahan padat & jalan ramai?
Customer : Iya biar rame pembeli
AI       : Berapa lantai & budget?
Customer : 1–2 lantai, 8–12 juta/bulan
AI       : Bebas banjir & durasi?
Customer : Iya bebas banjir, 3 tahun
AI       : Siap! Ruko 1–2 lantai dekat perumahan padat + jalan ramai Sidoarjo, BEBAS BANJIR, untuk apotek/minimarket, 8–12jt/bln, 3 tahun!
```

### CASE 04 | Sewa | Tanya Harga
```
Customer : Sewa ruko di Rungkut Surabaya berapa?
AI       : Ruko Rungkut: 2 lantai frontage standar 8–15jt/bulan, lokasi prime (pinggir jalan besar) 15–25jt. Usaha apa?
Customer : Klinik kecil
AI       : Klinik butuh akses mudah + parkir pasien. Prioritas?
Customer : Iya parkir penting, sama jalan yang gak macet
AI       : Berapa lantai & budget?
Customer : 2 lantai, 10–15 juta
AI       : Bebas banjir & durasi?
Customer : Iya, 3 tahun
AI       : Siap! Ruko 2 lantai Rungkut (akses lancar + parkir), BEBAS BANJIR, untuk klinik, 10–15jt/bln, 3 tahun!
```

### CASE 05 | Sewa | Marah (banjir)
```
Customer : Ruko yang saya incar ternyata langganan banjir! Untung belum deal
AI       : Bagus Anda teliti — banjir bisa hancurkan stok & bikin pelanggan kabur. Saya carikan yang elevasinya AMAN. Usaha & area?
Customer : Toko elektronik, Surabaya Barat, bebas banjir mutlak
AI       : Elektronik memang sensitif air. Budget & lantai?
Customer : 10–18 juta, 2 lantai
AI       : Prioritas jalan ramai + parkir?
Customer : Iya
AI       : Durasi?
Customer : 3 tahun
AI       : Siap! Ruko 2 lantai Surabaya Barat, DIJAMIN BEBAS BANJIR + jalan ramai + parkir, toko elektronik, 10–18jt/bln, 3 tahun!
```

### CASE 06 | Sewa | Frontage Lebar (showroom)
```
Customer : Sewa ruko yang depannya lebar buat showroom motor
AI       : Showroom butuh frontage lebar + display area + parkir. Berapa frontage minimal?
Customer : Minimal 8 meter, biar motor kelihatan dari jalan
AI       : Area & jalan ramai?
Customer : Surabaya, pinggir jalan besar yang rame
AI       : Prioritas akses lancar (customer test ride) & parkir?
Customer : Iya dua-duanya
AI       : Budget & durasi?
Customer : 20–35 juta/bulan, 5 tahun
AI       : Siap! Ruko frontage 8m+ pinggir jalan besar ramai Surabaya, showroom motor, akses lancar + parkir luas, 20–35jt/bln, 5 tahun!
```

### CASE 07 | Sewa | Multi-Unit (kantor cabang)
```
Customer : Sewa 3 ruko di Surabaya buat kantor cabang berbeda area
AI       : Untuk 3 cabang, biasanya spread di titik strategis berbeda. Usaha apa?
Customer : Kantor jasa pengiriman
AI       : Jasa pengiriman butuh akses lancar + parkir kendaraan operasional. Area?
Customer : Surabaya Barat, Timur, Selatan masing-masing 1
AI       : Prioritas dekat perumahan/jalan ramai (banyak pelanggan)?
Customer : Iya, sama bebas banjir
AI       : Budget per unit & durasi?
Customer : 8–12 juta/unit, 3 tahun
AI       : Siap! 3 ruko di Surabaya Barat/Timur/Selatan (jalan ramai + akses lancar + BEBAS BANJIR), jasa pengiriman, 8–12jt/unit/bln, 3 tahun!
```

### CASE 08 | Sewa | Dekat Pasar
```
Customer : Sewa ruko dekat pasar buat toko sembako grosir
AI       : Dekat pasar = captive market untuk sembako! Kota & pasar acuan?
Customer : Sidoarjo, dekat pasar induk
AI       : Grosir butuh akses truk + gudang belakang. Prioritas?
Customer : Iya, sama parkir buat bongkar
AI       : Berapa lantai & budget?
Customer : 2 lantai, 8–14 juta
AI       : Bebas banjir & durasi?
Customer : Iya wajib, 3 tahun
AI       : Siap! Ruko 2 lantai dekat pasar induk Sidoarjo, akses truk + parkir bongkar + BEBAS BANJIR, sembako grosir, 8–14jt/bln, 3 tahun!
```

### CASE 09 | Sewa | Ganti-Ganti
```
Customer : sewa ruko surabaya buat usaha
AI       : Usaha apa?
Customer : Cafe... eh restoran deh biar lebih besar
AI       : Restoran butuh lebih luas + parkir. Area?
Customer : Barat... atau Timur ya? Yang dekat perumahan
AI       : Dekat perumahan padat mana saja bagus. Budget?
Customer : 12–20 juta, 2 lantai
AI       : Prioritas parkir & jalan ramai?
Customer : Iya
AI       : Durasi?
Customer : 5 tahun
AI       : Siap! Ruko 2 lantai dekat perumahan padat Surabaya, restoran, parkir + jalan ramai, 12–20jt/bln, 5 tahun!
```

### CASE 10 | Sewa | WA Singkat
```
Customer : sewa ruko sby barat 2lt frontage 5m 12jt 3thn bebas banjir jalan rame
AI       : Usaha apa & parkir penting?
Customer : minimarket, iya parkir cukup
AI       : Siap! Ruko 2 lantai frontage 5m Surabaya Barat, jalan ramai + parkir + BEBAS BANJIR, minimarket, 12jt/bln, 3 tahun!
```

---

## BAGIAN B: BELI RUKO (Case 11–20)

### CASE 11 | Beli | Dekat Pasar + Perumahan Padat
```
Customer : beli ruko dekat pasar & perumahan padat penduduk
AI       : Strategi tepat — captive market! Usaha/sewa targetnya?
Customer : Buka apotek atau minimarket
AI       : Untuk itu, dekat pasar + padat memang ideal. Kota?
Customer : Sidoarjo
AI       : Prioritas ada kompetitor existing atau justru cari yang kosong?
Customer : Yang belum ada minimarket, biar gak saingan
AI       : Cerdas! Budget & cash/KPR?
Customer : 1,5–3 M, KPR
AI       : Bebas banjir & target?
Customer : Iya wajib, 4 bulan
AI       : Siap! Ruko dekat pasar + perumahan padat Sidoarjo (belum ada minimarket kompetitor), BEBAS BANJIR, 1,5–3M, KPR, target 4 bulan!
```

### CASE 12 | Beli | Malas Ketik
```
Customer : beli ruko sby 2lt jalan rame 2M cash invest bebas banjir
AI       : Area & prioritas parkir?
Customer : sby barat, iya parkir cukup
AI       : Target beli?
Customer : 4 bulan
AI       : Siap! Ruko 2 lantai Surabaya Barat (jalan ramai + parkir + BEBAS BANJIR), 2M, cash, target 4 bulan, investasi!
```

### CASE 13 | Beli | Tanya Harga
```
Customer : Harga ruko di Surabaya Barat berapa?
AI       : Ruko Surabaya Barat: 2 lantai standar 2–3,5M, lokasi prime (jalan besar) 4–6M. Frontage & lokasi ngaruh besar. Budget?
Customer : 2–3 M
AI       : Untuk usaha sendiri atau investasi sewa?
Customer : Investasi disewakan
AI       : Prioritas jalan ramai + bebas banjir (biar cepat laku disewa)?
Customer : Iya dua-duanya
AI       : Cash/KPR & target?
Customer : Cash, 4 bulan
AI       : Siap! Ruko 2 lantai Surabaya Barat (jalan ramai + BEBAS BANJIR), 2–3M, cash, target 4 bulan, investasi sewa!
```

### CASE 14 | Beli | Investasi Yield
```
Customer : Beli ruko yang yield sewanya bagus di Surabaya
AI       : Untuk yield ruko: lokasi jalan ramai + dekat keramaian (pasar/kampus/perkantoran) rotasi penyewa cepat. Area?
Customer : Dekat kampus atau perkantoran
AI       : Ruko dekat kampus (UBAYA/UNAIR) demand F&B/fotokopi tinggi. Budget?
Customer : 2–3,5 M
AI       : Prioritas frontage lebar + parkir (magnet penyewa)?
Customer : Iya, sama bebas banjir
AI       : Cash/KPR & target?
Customer : Cash, 4 bulan
AI       : Siap! Ruko dekat kampus Surabaya (frontage lebar + parkir + BEBAS BANJIR), yield tinggi, 2–3,5M, cash, target 4 bulan!
```

### CASE 15 | Beli | Marah (kalah nego)
```
Customer : 2x nego ruko keburu dibeli orang lain! Frustrasi
AI       : Ruko lokasi bagus memang cepat laku. Saya bantu prioritaskan Anda. Kriteria & cash?
Customer : 2 lantai, jalan ramai, max 2,5 M cash siap
AI       : Cash siap = closing cepat. Area & target?
Customer : Surabaya Barat, bebas banjir, secepatnya
AI       : Saya aktifkan alert ruko 2 lantai jalan ramai BEBAS BANJIR Surabaya Barat max 2,5M cash — Anda dapat info pertama. Update 24 jam!
```

### CASE 16 | Beli | Ruko Hook (sudut)
```
Customer : Cari ruko hook yang 2 sisi kelihatan dari jalan
AI       : Ruko hook memang premium — visibility 2 arah! Untuk usaha apa?
Customer : Cafe/resto yang butuh terlihat
AI       : Hook cocok untuk F&B. Area & jalan ramai?
Customer : Surabaya, dekat perumahan padat
AI       : Prioritas parkir luas & bebas banjir?
Customer : Iya dua-duanya
AI       : Budget & cash/KPR?
Customer : 3–5 M, cash
AI       : Target?
Customer : 5 bulan
AI       : Siap! Ruko hook (visibility 2 arah) dekat perumahan padat Surabaya, parkir luas + BEBAS BANJIR, cafe/resto, 3–5M, cash, target 5 bulan!
```

### CASE 17 | Beli | First Timer (edukasi)
```
Customer : Pertama kali beli ruko, apa yang harus diperhatikan?
AI       : Bagus ditanyakan! Yang wajib dicek: (1) legalitas SHM/HGB & IMB, (2) BEBAS BANJIR, (3) lebar jalan & akses, (4) frontage & parkir, (5) potensi bisnis area. Sudah paham? Mau lanjut cari?
Customer : Oke paham, buat investasi
AI       : Kota & budget?
Customer : Sidoarjo, 1,5–2,5 M
AI       : Prioritas jalan ramai + dekat perumahan?
Customer : Iya
AI       : Cash/KPR & target?
Customer : KPR, 4 bulan
AI       : Siap! Ruko dekat perumahan + jalan ramai Sidoarjo (legalitas + IMB + BEBAS BANJIR terverifikasi), 1,5–2,5M, KPR, target 4 bulan. Saya bantu cek semua dokumen!
```

### CASE 18 | Beli | Ruko Second + Renovasi
```
Customer : Beli ruko second yang murah buat direnovasi
AI       : Bisa dapat lokasi prime harga miring! Area & budget?
Customer : Surabaya Timur, 1,5–2,5 M
AI       : Ruko second oke. Wajib cek: struktur bangunan + BEBAS BANJIR + legalitas. Setuju?
Customer : Iya, jangan yang banjir
AI       : Berapa lantai & cash/KPR?
Customer : 2 lantai, cash
AI       : Untuk usaha apa?
Customer : Disewakan
AI       : Target?
Customer : 4 bulan
AI       : Siap! Ruko second 2 lantai Surabaya Timur (struktur bagus + BEBAS BANJIR + legalitas clear), cocok renovasi, 1,5–2,5M, cash, target 4 bulan, investasi!
```

### CASE 19 | Beli | Ruko di Proyek Baru (inden)
```
Customer : Beli ruko di proyek baru yang lagi launching di Surabaya Barat
AI       : Ruko inden proyek baru biasanya harga perdana lebih murah + potensi naik. Tapi cek track record developer ya. Prioritas lokasi dalam proyek?
Customer : Yang di jalan utama proyek, ramai
AI       : Frontage & lantai?
Customer : Frontage 5m, 2–3 lantai
AI       : Prioritas bebas banjir & akses proyek bagus?
Customer : Iya
AI       : Budget & cash/KPR?
Customer : 2–3,5 M, KPR
AI       : Target serah terima?
Customer : Max 1 tahun
AI       : Siap! Ruko inden di jalan utama proyek Surabaya Barat (developer track record OK + BEBAS BANJIR), frontage 5m 2–3 lantai, 2–3,5M, KPR, serah terima max 1 tahun!
```

### CASE 20 | Beli | WA Singkat
```
Customer : beli ruko hook sidoarjo 2lt 3M cash 4bln jalan rame bebas banjir
AI       : Untuk usaha sendiri atau investasi & prioritas parkir?
Customer : investasi, iya parkir luas
AI       : Siap! Ruko hook 2 lantai Sidoarjo (jalan ramai + parkir luas + BEBAS BANJIR), 3M, cash, target 4 bulan, investasi!
```

---
*File: 06_SKILL_SHOPHOUSE_RUKO_CHAT.md | Elevan Property Chatbot Skills v2.0*

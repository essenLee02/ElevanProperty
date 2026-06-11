# SKILL: KONDOTEL / CONDO — Panduan Respons Chatbot Property
**Tipe Property:** Kondotel / Condo Hotel
**Transaksi:** Sewa & Beli | **Total Case:** 35 (15 Sewa + 20 Beli)
**Catatan:** Kondotel = apartemen dengan konsep hotel management; unit bisa disewakan melalui operator hotel

---

## 🔧 SLOT KHUSUS KONDOTEL
```json
{
  "unit_type": null,
  "floor": null,
  "view": null,
  "operator_hotel": null,
  "roi_expectation": null,
  "strata_title": null,
  "management_fee": null
}
```

---

## BAGIAN A: SEWA KONDOTEL (15 CASE)

### CASE S-01 | Normal
```
Customer : Mau booking kondotel di Bali
AI       : Siap! Di area Bali mana?
Customer : Seminyak atau Nusa Dua
AI       : Untuk berapa malam dan tanggal check-in?
Customer : 5 malam, check-in 15 Agustus
AI       : Berapa orang?
Customer : 2 orang, pasangan
AI       : Budget per malam?
Customer : 1,5–3 juta
AI       : Tipe unit? Studio, 1 kamar, atau suite?
Customer : 1 kamar
AI       : Fasilitas yang wajib ada?
Customer : Pool, spa, gym
AI       : Breakfast included?
Customer : Iya
AI       : Siap! Kondotel 1KT di Seminyak/Nusa Dua Bali, pool + spa + gym, 1,5–3 juta/malam, 15–20 Agustus, 2 orang, breakfast!
```

### CASE S-02 | Malas Ketik
```
Customer : book kondotel bali 3 malam 2 org
AI       : Area & tanggal?
Customer : seminyak, 10-13 agustus
AI       : Budget/malam & tipe kamar?
Customer : 1.5-2.5jt, 1 kamar
AI       : Breakfast & fasilitas?
Customer : breakfast, pool
AI       : Siap! Kondotel 1KT Seminyak, 1,5–2,5jt/malam, 10–13 Agustus, 2 orang, breakfast + pool!
```

### CASE S-03 | Info Terbatas
```
Customer : mau sewa kondotel yang bagus
AI       : Di kota atau pulau mana?
Customer : Yang terkenal dan bagus di Indonesia
AI       : Bali paling terkenal untuk kondotel berkualitas. Area mana?
Customer : Yang romantis untuk honeymoon
AI       : Nusa Dua atau Uluwatu sangat cocok. Budget per malam?
Customer : 2–4 juta
AI       : Berapa malam dan tanggal?
Customer : 5 malam, bulan September
AI       : Tanggal pastinya?
Customer : 12–17 September
AI       : Tipe unit?
Customer : 1 kamar atau suite
AI       : Fasilitas?
Customer : Pool, spa, ocean view
AI       : Breakfast?
Customer : Iya, in-room breakfast lebih romantis
AI       : Siap! Kondotel suite/1KT di Nusa Dua/Uluwatu Bali, ocean view, pool + spa, in-room breakfast, 2–4 juta/malam, 12–17 September, 2 orang!
```

### CASE S-04 | Tanya Harga
```
Customer : Kondotel di Surabaya berapa per malam?
AI       : Di Surabaya kondotel biasanya per malam: studio 400–800 ribu, 1 kamar 700 ribu–1,5 juta, suite 1,5–4 juta. Area mana?
Customer : Pakuwon atau Citraland
AI       : Berapa malam & tanggal?
Customer : 2 malam, weekend ini
AI       : Berapa orang & tipe kamar?
Customer : 2 orang, 1 kamar
AI       : Budget?
Customer : 800 ribu–1,5 juta
AI       : Breakfast?
Customer : Iya
AI       : Siap! Kondotel 1KT di Pakuwon/Citraland Surabaya, 800 ribu–1,5 juta/malam, weekend ini, 2 orang, breakfast!
```

### CASE S-05 hingga S-15 (Variasi Ringkas)
```
S-05 | Marah: Kondotel yang dipesan tiba-tiba unavailable. Area Seminyak, 3 malam, 2–3 juta, 4 orang, 2 family room. URGENT — cari alternatif sekarang!

S-06 | Ganti-Ganti: Awalnya mau Bali, switch ke Surabaya karena lebih dekat. 1KT, 2 orang, 800k–1.5jt/malam, 3 malam, pool. Siap!

S-07 | Tidak Tahu: Pertama kali mau kondotel, bingung beda sama hotel biasa. Kondotel = unit seperti apartemen tapi dikelola hotel, fasilitas lebih homey. Budget 1–2 juta/malam, 3 malam Bali. Siap!

S-08 | Bisnis: Kondotel Surabaya untuk business stay 1 minggu, dekat CBD, 800k–1.5jt/malam, WiFi kencang + gym, deluxe single. Siap!

S-09 | Keluarga dengan Anak: Kondotel 2KT di Bali untuk keluarga 4 orang, anak-friendly, pool berpagar, Nusa Dua, 2–3 juta/malam, 5 malam. Siap!

S-10 | Long Stay (Bulanan): Sewa kondotel per bulan di Bali untuk remote work, Canggu, 8–15 juta/bulan, 1KT, 3 bulan. Siap!

S-11 | Pet Friendly: Kondotel pet-friendly di Bandung, kucing, 800k–1.5jt/malam, 3 malam. Siap!

S-12 | Minta Pool View: Kondotel Surabaya dengan pool view untuk staycation, 1KT, 800k–1.5jt, weekend, 2 orang. Siap!

S-13 | Late Checkout: Kondotel Surabaya yang bisa late checkout jam 15, 1 malam, 800k–1.5jt. Siap!

S-14 | Rating Tinggi: Kondotel Bali rating Google 4.5+ Seminyak, 2 orang, 1.5–2.5jt/malam, 3 malam. Siap!

S-15 | WA Singkat: kondotel sby 1kt 2org 2mlm pool bfast 1jt. Siap!
```

---

## BAGIAN B: BELI KONDOTEL (20 CASE)

### CASE B-01 | Normal
```
Customer : Mau beli unit kondotel untuk investasi
AI       : Investasi kondotel yang menarik! Di kota mana yang Anda pertimbangkan?
Customer : Bali, mau yang ROI-nya bagus
AI       : Area Bali mana?
Customer : Seminyak atau Nusa Dua
AI       : Budget pembelian?
Customer : 800 juta–1,5 miliar
AI       : Unit untuk dipakai sendiri juga atau investasi murni?
Customer : 90% investasi, kadang pakai sendiri
AI       : Tipe unit yang paling banyak dicari penyewa?
Customer : Studio atau 1 kamar
AI       : Cash atau KPR?
Customer : Cash
AI       : Target beli?
Customer : 3 bulan
AI       : Operator hotel tertentu yang Anda pertimbangkan?
Customer : Tidak harus, asal terpercaya
AI       : Siap! Unit kondotel studio/1KT di Seminyak/Nusa Dua Bali, 800 juta–1,5M, cash, target 3 bulan, operator hotel terpercaya, ROI optimal!
```

### CASE B-02 | Malas Ketik
```
Customer : beli kondotel bali invest 1M cash
AI       : Area & tipe unit?
Customer : seminyak, studio
AI       : Target & operator?
Customer : 3 bln, bebas
AI       : Siap! Kondotel studio Seminyak Bali, 1M, cash, target 3 bulan, investasi!
```

### CASE B-03 | Tanya ROI
```
Customer : Kalau beli kondotel di Bali 1 miliar, ROI-nya berapa?
AI       : Simulasi: Kondotel 1M di Seminyak, revenue sharing dengan operator biasanya 60% untuk owner. ADR 700 ribu–1 juta, occupancy 70% = revenue owner sekitar 90–130 juta/tahun. Net setelah management fee dan biaya sekitar 70–100 juta. ROI 7–10%. Sesuai ekspektasi?
Customer : Mau yang lebih tinggi, 10%+
AI       : Untuk 10%+, Canggu kondotel trendy atau Nusa Penida yang emerging. Area mana?
Customer : Canggu
AI       : Budget?
Customer : 800jt–1.2M
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 3 bulan
AI       : Siap! Kondotel Canggu Bali, ROI 10%+, 800jt–1,2M, cash, target 3 bulan!
```

### CASE B-04 hingga B-20 (Variasi Ringkas)
```
B-04 | Tanya Harga: Kondotel Bali berapa? Range 400jt–2M. Budget 800jt–1.2M, studio/1KT, Seminyak, cash, 3 bln. Siap!

B-05 | Marah: 3 bulan gagal deal kondotel Bali terus. Cash 1M siap. Studio/1KT Canggu/Seminyak, 3 bln target — saya prioritaskan 24 jam!

B-06 | Ganti Kota: Tadinya Bali, switch ke Surabaya kondotel. Budget 500jt–800jt, studio, cash, 3 bln. Tujuan? Investasi. Siap!

B-07 | First Timer: Penjelasan kondotel vs apartemen biasa + revenue sharing + management fee. Lalu beli: Bali Seminyak, 900jt, cash, studio, 3 bln. Siap!

B-08 | KPR: Beli kondotel 800jt KPR. DP 20% = 160jt. Cicilan ~7–8 juta/bulan. Sesuai? Iya. Area Bali, cash/KPR, studio, 3 bln. Siap!

B-09 | Inden: Kondotel inden di Bali, aman tidak? Cek developer track record. Budget 700jt–1M, Seminyak, cash, studio, inden max 1 tahun. Siap!

B-10 | WA Singkat: kondotel bali seminyak studio 900jt cash 3bln invest. Siap!

B-11 | Strata Title: Tanya SHMSRS vs hak pakai untuk kondotel. WNI prefer SHMSRS. Beli Seminyak 900jt, cash, studio, 3 bln. Siap!

B-12 | Operator Tertentu: Mau kondotel yang dioperasikan Wyndham atau Marriott di Bali. Budget 1–1.5M, 1KT, cash, 3 bln. Siap!

B-13 | Off-Plan Promo: Ada promo kondotel launching di Bali? Cek ketersediaan. Budget 700jt–1M, Seminyak/Canggu, cash, ASAP. Siap!

B-14 | Di Luar Bali: Kondotel investasi di luar Bali. Batam (dekat Singapore), Mandalika, Yogyakarta. Budget 500jt–800jt, cash. Pilih Batam. 3 bln. Siap!

B-15 | Untuk Dipakai + Invest: 80% invest 20% pakai sendiri, Bali Seminyak, 1KT, 1–1.5M, cash, 3 bln. Siap!

B-16 | Tanya Management Fee: Berapa management fee kondotel Bali? Biasanya 30–40% revenue. Lalu cari kondotel yang fee-nya paling kompetitif. 900jt, studio, cash, 3 bln. Siap!

B-17 | Resale: Kondotel second di Bali kondisi bagus, 700jt–1M. Studio, cash, 3 bln, operasional. Siap!

B-18 | Multi-Unit: Sudah punya 2 unit kondotel Bali, mau beli 2 lagi. Budget total 2M, Canggu/Seminyak, cash, 3 bln. Siap!

B-19 | Tanya Legalitas: Kondotel aman dari sisi legal? Cek PPJB, SHMSRS, IMB, SLF, dan TDUP operator. Lalu beli Seminyak 900jt, cash, studio, 3 bln. Siap!

B-20 | WA Singkat: beli kondotel canggu studio 1M cash 3bln roi 10persen. Siap!
```

---

*File: 11_SKILL_CONDO.md | Elevan Property Chatbot Skills v1.0*
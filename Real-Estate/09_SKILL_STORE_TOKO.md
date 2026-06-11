# SKILL: STORE / TOKO — Panduan Respons Chatbot Property
**Tipe Property:** Toko (Store / Retail Space)
**Transaksi:** Sewa & Beli | **Total Case:** 35 (15 Sewa + 20 Beli)

---

## 🔧 SLOT KHUSUS TOKO
```json
{
  "business_type": null,
  "floor_area_sqm": null,
  "frontage_width": null,
  "foot_traffic": null,
  "parking_slots": null,
  "visibility": null,
  "corner_position": false
}
```
**Catatan:** Toko berbeda dari ruko — toko biasanya unit retail di dalam mall/ruko 1 lantai, sedangkan ruko lebih ke bangunan mandiri multi-lantai.

---

## BAGIAN A: SEWA TOKO (15 CASE)

### CASE S-01 | Sewa Toko | Normal
```
Customer : Mau sewa toko untuk jualan
AI       : Siap! Jualan apa dan di kota mana?
Customer : Toko baju anak di Surabaya, target ibu-ibu
AI       : Target pasar ibu-ibu dengan anak — butuh lokasi dekat sekolah, mal keluarga, atau pusat perbelanjaan. Area mana di Surabaya?
Customer : Surabaya Barat, area Pakuwon atau Galaxy Bumi Permai
AI       : Luas toko yang dibutuhkan?
Customer : 30–50 m² sudah cukup
AI       : Budget sewa per bulan?
Customer : 8–15 juta
AI       : Frontage minimal?
Customer : 4 meter biar terlihat
AI       : Apakah di dalam mal/plaza atau di ruko standalone?
Customer : Di dalam mal lebih prefer
AI       : Kapan mulai dan berapa lama?
Customer : 2 bulan lagi, 2 tahun
AI       : Parkir diperlukan khusus?
Customer : Parkir mal sudah cukup
AI       : Siap! Unit toko 30–50m² di mal/plaza Pakuwon/Galaxy Bumi Permai Surabaya Barat, frontage 4m, 8–15 juta/bulan, 2 tahun, mulai 2 bulan lagi!
```

### CASE S-02 | Malas Ketik
```
Customer : sewa toko surabaya buat fashion
AI       : Area & dalam mal atau standalone?
Customer : pkuwon, dalam mal
AI       : Luas & budget/bln?
Customer : 40m2, 10-15jt
AI       : Kapan & berapa lama?
Customer : 2 bln, 2 tahun
AI       : Siap! Unit toko 40m² dalam mal Pakuwon Surabaya, fashion, 10–15jt/bln, 2 tahun, mulai 2 bulan lagi!
```

### CASE S-03 | Info Terbatas
```
Customer : mau buka toko kecil di Surabaya
AI       : Toko untuk apa? Ini penting agar saya carikan lokasi yang paling tepat.
Customer : Belum pasti, mungkin jual aksesoris atau skincare
AI       : Keduanya target pasar perempuan muda. Mal atau ruko standalone?
Customer : Dalam mal lebih ramai
AI       : Area Surabaya mana?
Customer : Yang paling rame anak muda
AI       : Tunjungan Plaza, Galaxy Mall, atau Pakuwon — ketiganya ramai anak muda. Ada preferensi?
Customer : Tunjungan Plaza paling ikonik
AI       : Budget sewa per bulan?
Customer : Belum tahu, berapa yang wajar?
AI       : Unit toko di TP Surabaya mulai 5 juta (kecil 15m²) hingga 30 juta+ (besar 60m²). Luas berapa yang direncanakan?
Customer : 20–30 m² cukup
AI       : Range 8–18 juta untuk ukuran itu di TP. Budget Anda?
Customer : 10-15 juta
AI       : Kapan mulai?
Customer : 3 bulan
AI       : Berapa lama?
Customer : 2 tahun
AI       : Siap! Unit toko 20–30m² di Tunjungan Plaza Surabaya, aksesoris/skincare, 10–15 juta/bulan, 2 tahun, mulai 3 bulan lagi!
```

### CASE S-04 | Tanya Harga
```
Customer : Sewa toko di Pakuwon Mall Surabaya berapa?
AI       : Di Pakuwon Mall Surabaya, sewa toko per m² sekitar 200–500 ribu/m²/bulan tergantung lokasi (ground floor lebih mahal). Ukuran 30 m² = 6–15 juta/bulan. Jenis usaha Anda?
Customer : Kedai kopi kecil
AI       : Kedai kopi di mal — butuh lokasi dengan food court atau area F&B. Luas?
Customer : 20–30 m²
AI       : Budget?
Customer : 8–14 juta
AI       : Kapan mulai?
Customer : 2 bulan
AI       : Berapa lama?
Customer : 2 tahun
AI       : Siap! Unit F&B 20–30m² di area food court Pakuwon Mall, 8–14 juta/bulan, 2 tahun, mulai 2 bulan lagi!
```

### CASE S-05 | Marah
```
Customer : Sudah daftar antri unit toko di mal Surabaya 6 bulan, tidak dapat-dapat. Bantu!
AI       : Antri unit mal memang sangat kompetitif, terutama di mal prime. Ada alternatif lain yang bisa saya bantu? Mal lain atau standalone ruko? Jenis usaha Anda?
Customer : Toko perhiasan emas
AI       : Toko perhiasan emas — juga bisa sangat strategis di ruko yang tepat, tidak harus mal. Area mana?
Customer : Surabaya Pusat
AI       : Budget per bulan?
Customer : 15–25 juta
AI       : Luas?
Customer : 30–50 m²
AI       : Kapan butuh?
Customer : Secepatnya
AI       : Berapa lama?
Customer : 3 tahun
AI       : Saya carikan kombinasi: unit mal yang tersedia SEKARANG dan ruko standalone strategis di Surabaya Pusat, 30–50m², 15–25 juta/bulan, 3 tahun. Saya hubungi dalam 2 jam!
```

### CASE S-06 | Ganti-Ganti
```
Customer : mau sewa toko di surabaya buat jualan
AI       : Jualan apa?
Customer : Mau jual makanan... tapi mungkin minuman aja lebih simpel
AI       : Keduanya F&B! Di dalam mal atau ruko?
Customer : Mal saja lebih ramai
AI       : Area mana?
Customer : Surabaya Barat atau Pusat, belum pasti
AI       : Budget per bulan?
Customer : 8–15 juta
AI       : Luas?
Customer : 20–35 m²
AI       : Kapan mulai?
Customer : 3 bulan
AI       : Berapa lama?
Customer : 2 tahun
AI       : Siap! Unit F&B 20–35m² di mal Surabaya Barat/Pusat, 8–15 juta/bulan, 2 tahun, mulai 3 bulan!
```

### CASE S-07 | Tidak Tahu Yang Mau
```
Customer : mau buka toko tapi bingung jualan apa
AI       : Menarik! Sebelum cari tokonya, ada baiknya tentukan dulu konsepnya. Punya modal berapa untuk usaha?
Customer : Sekitar 150–200 juta
AI       : Dengan 150–200 juta, beberapa konsep yang feasible di toko 20–30m²: franchise minuman kekinian (modal 50–100 juta), toko snack/camilan kekinian, aksesoris/handmade, atau thrift store. Ada yang paling menarik?
Customer : Franchise minuman kekinian sepertinya paling jelas prosedurnya
AI       : Pilihan yang cerdas! Di kota mana Anda berencana?
Customer : Surabaya
AI       : Area mana? Mal atau standalone?
Customer : Mal, lebih ramai
AI       : Budget sewa per bulan?
Customer : 8–12 juta
AI       : Luas?
Customer : 20–30 m²
AI       : Kapan mulai?
Customer : 3 bulan
AI       : Berapa lama?
Customer : 2 tahun
AI       : Siap! Unit F&B/minuman 20–30m² di mal Surabaya, 8–12 juta/bulan, 2 tahun, mulai 3 bulan lagi!
```

### CASE S-08 | Toko di Pinggir Jalan
```
Customer : Cari toko standalone di pinggir jalan utama Surabaya, bukan mal
AI       : Toko standalone di pinggir jalan utama — bagus untuk branding dan akses. Di area mana?
Customer : Surabaya Selatan, Jalan Ahmad Yani atau sekitarnya
AI       : Luas?
Customer : 40–60 m²
AI       : Frontage minimal?
Customer : 5 meter
AI       : Jenis usaha?
Customer : Toko elektronik accessories (kabel, charger, dll)
AI       : Budget per bulan?
Customer : 10–18 juta
AI       : Kapan mulai?
Customer : 2 bulan
AI       : Berapa lama?
Customer : 2 tahun
AI       : Siap! Toko standalone 40–60m², frontage 5m, di Jalan Ahmad Yani Surabaya Selatan, elektronik aksesoris, 10–18 juta/bulan, 2 tahun!
```

### CASE S-09 | Toko di Pasar Modern
```
Customer : Mau sewa toko di pasar modern atau trade center di Surabaya
AI       : Trade center Surabaya yang terkenal: ITC Surabaya, WTC Surabaya, Kapas Krampung Plaza. Jenis usaha?
Customer : Jual baju grosir dan eceran
AI       : Grosir baju — WTC atau ITC Surabaya paling pas. Budget per bulan?
Customer : 5–10 juta
AI       : Luas?
Customer : 10–20 m²
AI       : Kapan mulai?
Customer : Bulan depan
AI       : Berapa lama?
Customer : 2 tahun
AI       : Siap! Unit toko 10–20m² di WTC/ITC Surabaya untuk grosir baju, 5–10 juta/bulan, 2 tahun, mulai bulan depan!
```

### CASE S-10 | S-15 (Variasi Kondisi)
```
S-10 | Popup Store Short Term
Customer : Mau sewa toko 3 bulan untuk popup store di Surabaya
AI       : Area & jenis usaha?
Customer : Pakuwon, fashion lokal
AI       : Budget/bln?
Customer : 10–15 juta
AI       : Luas?
Customer : 25 m²
AI       : Siap! Unit popup 25m² di Pakuwon Surabaya, fashion, 10–15 juta/bulan, 3 bulan!

S-11 | Butuh Gudang + Toko
Customer : Mau sewa toko yang ada storage-nya di belakang
AI       : Area & jenis usaha?
Customer : Surabaya Timur, toko sepatu
AI       : Budget/bln & luas?
Customer : 12-18jt, 40-60m2 (30 toko + 15-20 gudang)
AI       : Kapan & berapa lama?
Customer : 2 bln, 2 tahun
AI       : Siap! Toko 40–60m² (area toko + storage belakang), Surabaya Timur, 12–18jt/bln, 2 tahun!

S-12 | Toko Franchise
Customer : Mau sewa toko buat franchise minuman Surabaya, syaratnya apa?
AI       : Untuk franchise minuman, biasanya syarat lokasi: min luas 15–25 m², frontage 3m+, dan lokasinya disetujui franchisor. Mau saya bantu carikan lokasi dan hubungkan ke franchisee yang sesuai?
Customer : Iya tolong
AI       : Area & budget?
Customer : Surabaya Pusat, 8-12jt
AI       : Siap! Unit toko 15–25m² Surabaya Pusat, 8–12jt/bln, cocok untuk franchise minuman!

S-13 | Toko Kosmetik/Skincare
Customer : Cari toko untuk brand skincare sendiri di Surabaya
AI       : Toko retail skincare — butuh lokasi traffic tinggi dan target pasar yang tepat. Mal atau standalone?
Customer : Mal, target perempuan 20-35 tahun
AI       : Budget & luas?
Customer : 10-18jt, 25-40m2
AI       : Area?
Customer : Tunjungan Plaza atau Ciputra World
AI       : Kapan & berapa lama?
Customer : 3 bln, 2 tahun
AI       : Siap! Unit toko 25–40m² di TP/Ciputra World Surabaya, skincare, 10–18jt/bln, 2 tahun!

S-14 | Tanya Deposit
Customer : Sewa toko di mal Surabaya, depositnya biasanya berapa?
AI       : Deposit toko di mal biasanya 3–6 bulan harga sewa, tergantung mal dan kebijakan pengelola. Mal besar (TP, Ciputra World) bisa 6 bulan. Jenis usaha dan mall yang Anda inginkan?
Customer : Kedai kopi di Galaxy Mall, sewa 10jt/bln
AI       : Estimasi deposit 30–60 juta (3–6 bulan). Budget ini sudah siap?
Customer : Iya siap
AI       : Kapan mulai & berapa lama?
Customer : 2 bln, 2 tahun
AI       : Luas?
Customer : 20-30m2
AI       : Siap! Unit F&B 20–30m² di Galaxy Mall, kedai kopi, 10jt/bln, 2 tahun, deposit ~30–60 juta!

S-15 | WA Singkat
Customer : sewa toko mal sby 25m buat fashion 10jt 2 tahun
AI       : Area mal mana?
Customer : ciputra
AI       : Kapan mulai?
Customer : 3 bln
AI       : Siap! Unit toko 25m² Ciputra World Surabaya, fashion, 10jt/bln, 2 tahun, mulai 3 bulan!
```

---

## BAGIAN B: BELI TOKO (20 CASE)

```
B-01 | Normal
Customer : Mau beli unit toko di Surabaya untuk usaha sendiri
AI       : Area mana dan usaha apa?
Customer : Surabaya Pusat, toko elektronik
AI       : Budget?
Customer : 1.5–3 M
AI       : Di mal atau standalone?
Customer : Di mal
AI       : Cash atau KPR?
Customer : Cash
AI       : Luas?
Customer : 30–50 m²
AI       : Target?
Customer : 3 bulan
AI       : Siap! Unit toko 30–50m² di mal Surabaya Pusat, 1,5–3M, cash, target 3 bulan!

B-02 | Malas Ketik
Customer : beli unit toko surabaya invest 2M cash
AI       : Area & mal/standalone?
Customer : surabaya pusat, mal
AI       : Luas & target?
Customer : 25m2, 3 bln
AI       : Siap! Unit toko 25m² mal Surabaya Pusat, 2M, cash, target 3 bulan, investasi!

B-03 | Investasi Yield
Customer : Mau beli unit toko untuk investasi disewakan, mana yield-nya tinggi?
AI       : Untuk yield toko di Surabaya: mal anchor (TP, Ciputra World) lebih stabil tapi mahal. Trade center (WTC, ITC) yield lebih tinggi 8–12% tapi likuiditas kurang. Budget Anda?
Customer : 1.5–3 M
AI       : Cash atau KPR?
Customer : Cash
AI       : Luas?
Customer : 20–40 m²
AI       : Target?
Customer : 3 bulan
AI       : Siap! Unit toko investasi 20–40m² di trade center/mal Surabaya, 1,5–3M, cash, target 3 bulan!

B-04 | Tanya Harga
Customer : Harga unit toko di mal Surabaya berapa?
AI       : Unit toko di mal Surabaya: tergantung mal dan lokasi dalam mal. Mal prime (TP, Ciputra World) 30–80 juta/m². Trade center (WTC) 15–30 juta/m². Budget Anda?
Customer : 1.5–3 miliar
AI       : Luas?
Customer : 40–60 m²
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 3 bulan
AI       : Siap! Unit toko 40–60m² di mal/trade center Surabaya, 1,5–3M, cash, target 3 bulan!

B-05 | Marah
Customer : Sudah 4 bulan cari unit toko di TP Surabaya, selalu habis atau harga di atas budget!
AI       : TP memang unit tokonya sangat terbatas. Mau saya carikan di mal prime lain yang setara? Budget Anda?
Customer : Max 2.5 M, cash siap
AI       : Luas?
Customer : 30–50 m²
AI       : Tujuan usaha apa?
Customer : Toko aksesoris
AI       : Target?
Customer : Secepat mungkin
AI       : Saya carikan unit di Ciputra World, Galaxy Mall, atau Pakuwon yang kondisinya setara TP. Cash 2,5M, 30–50m² — saya hubungi dalam 24 jam!

B-06 | B-20 (ringkas)
B-06: Ganti dari mal ke standalone, akhirnya standalone 40m² Surabaya Pusat 2M cash.
B-07: First timer, dijelaskan service charge + PPJB mal, lalu beli 30m² TP 2M cash.
B-08: KPR unit toko, simulasi cicilan, akhirnya beli 40m² 2M KPR.
B-09: Beli unit toko yang sudah ada tenant, Surabaya Pusat 2.5M cash.
B-10: WA singkat — unit toko 30m mal sby 2M cash 3bln.
B-11: Beli toko di trade center untuk grosir, WTC 20m 1.5M cash.
B-12: Beli unit toko lantai ground floor (lebih mahal tapi traffic lebih tinggi), 50m 3M.
B-13: Beli unit toko di mal baru yang launching, inden, Surabaya Barat 2M.
B-14: Tanya PPJB vs AJB untuk unit mal, edukasi lalu beli 40m 2.5M.
B-15: Beli unit toko dekat kawasan industri untuk kebutuhan B2B, 1.5M.
B-16: Investor sudah punya 3 unit, mau tambah di Malang, 2M cash.
B-17: Beli unit toko untuk franchise bubble tea, 25m 1.5M KPR.
B-18: Beli toko second murah, renovasi, Surabaya 1.5M cash.
B-19: Butuh unit dengan storage belakang, Surabaya Timur 2M.
B-20: WA singkat — toko standalone sby selatan 40m 2.5M cash 3bln.
```

---

*File: 09_SKILL_STORE_TOKO.md | Elevan Property Chatbot Skills v1.0*


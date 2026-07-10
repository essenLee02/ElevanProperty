# SKILL: TOKO / STORE — 20 Simulasi Chat WhatsApp
**Tipe Property:** Toko (Store / Retail Space)
**Transaksi:** Sewa, Beli | **Total Case:** 20
**Fokus:** Fasilitas, transaksi, area, preferensi lokasi & red flag
**Catatan:** Toko = unit retail di mall/ruko 1 lantai (beda dari ruko multi-lantai)

---

## 🔧 SLOT KHUSUS TOKO
```json
{
  "transaction_type": null, "location": null, "business_type": null,
  "floor_area": null, "frontage_width": null, "foot_traffic": null,
  "budget": null, "duration": null,
  "environment": {"traffic_tinggi": null, "akses_lancar": null, "corner_position": null},
  "nearby": [], "in_mall": null, "red_flags": []
}
```

---

## BAGIAN A: SEWA TOKO (Case 01–10)

### CASE 01 | Sewa | Dalam Mall + Traffic Tinggi + Dekat Food Court
```
Customer : Sewa toko di mall Surabaya yang ramai pengunjung
AI       : Traffic tinggi kunci sukses! Jualan apa?
Customer : Minuman kekinian (boba)
AI       : Boba laku dekat food court/area anak muda. Mall — Pakuwon, TP, atau Ciputra World?
Customer : Yang paling rame anak muda
AI       : TP & Pakuwon paling ramai anak muda. Prioritas dekat bioskop/food court?
Customer : Iya dekat bioskop, orang antri suka jajan
AI       : Luas & frontage?
Customer : 20–30 m², frontage 3m+
AI       : Budget/bulan & durasi?
Customer : 8–15 juta, 2 tahun
AI       : Siap! Toko boba 20–30m² frontage 3m+ dekat bioskop/food court TP/Pakuwon Surabaya (traffic anak muda tinggi), 8–15jt/bln, 2 tahun!
```

### CASE 02 | Sewa | Malas Ketik
```
Customer : sewa toko mall sby 40m fashion dalam mal
AI       : Mall mana & budget/bln?
Customer : pakuwon, 10-15jt
AI       : Prioritas dekat area ramai (food court/anchor store)?
Customer : iya deket yang rame
AI       : Durasi?
Customer : 2 tahun
AI       : Siap! Toko fashion 40m² dalam Pakuwon Surabaya dekat area ramai, 10–15jt/bln, 2 tahun!
```

### CASE 03 | Sewa | Standalone Jalur Wisata
```
Customer : Toko pinggir jalan yang gampang dilihat & gak macet
AI       : Sweet spot: jalan lebar dengan lampu merah dekat (orang berhenti = lihat toko). Usaha apa?
Customer : Toko oleh-oleh/snack
AI       : Cocok di jalur wisata! Kota?
Customer : Malang, yang dilewati wisatawan
AI       : Prioritas jalur wisatawan ke Batu / dekat Taman Dayu?
Customer : Iya jalur ke Batu
AI       : Butuh parkir bus/mobil wisata?
Customer : Iya biar rombongan mampir
AI       : Budget/bulan & luas?
Customer : 10–18 juta, 50–80 m²
AI       : Durasi?
Customer : 3 tahun
AI       : Siap! Toko oleh-oleh 50–80m² jalur wisata ke Batu (Malang), akses lancar + parkir bus/mobil, 10–18jt/bln, 3 tahun!
```

### CASE 04 | Sewa | Tanya Harga
```
Customer : Sewa toko di Tunjungan Plaza Surabaya berapa?
AI       : TP Surabaya: 200–500rb/m²/bulan (ground floor lebih mahal). 30m² = 6–15jt/bulan. Jenis usaha?
Customer : Kedai kopi kecil
AI       : Kedai kopi butuh area F&B/food court. Luas?
Customer : 20–30 m²
AI       : Prioritas dekat area ramai (bioskop/tenant besar)?
Customer : Iya
AI       : Budget & durasi?
Customer : 8–14 juta, 2 tahun
AI       : Siap! Kedai kopi 20–30m² area F&B TP Surabaya (dekat keramaian), 8–14jt/bln, 2 tahun!
```

### CASE 05 | Sewa | Marah (antri unit mall)
```
Customer : Sudah antri unit toko di mal Surabaya 6 bulan, gak dapat-dapat!
AI       : Antri unit mal prime memang kompetitif. Ada alternatif — mall lain atau standalone strategis? Usaha?
Customer : Toko perhiasan emas
AI       : Perhiasan emas juga strategis di lokasi yang tepat, tidak harus mal. Area?
Customer : Surabaya Pusat
AI       : Budget, luas & durasi?
Customer : 15–25 juta, 30–50 m², 3 tahun
AI       : Kapan butuh?
Customer : Secepatnya
AI       : Saya carikan KOMBINASI: unit mal yang available SEKARANG + standalone strategis Surabaya Pusat, 30–50m², 15–25jt/bln, 3 tahun. Hubungi dalam 2 jam!
```

### CASE 06 | Sewa | Trade Center (grosir)
```
Customer : Sewa toko di trade center Surabaya buat grosir baju
AI       : Trade center Surabaya: ITC, WTC, Kapas Krampung Plaza. Grosir baju paling pas WTC/ITC. Budget/bulan?
Customer : 5–10 juta
AI       : Luas & prioritas lokasi (dekat pintu masuk = traffic)?
Customer : 10–20 m², iya dekat pintu masuk
AI       : Kapan mulai & durasi?
Customer : Bulan depan, 2 tahun
AI       : Siap! Toko grosir baju 10–20m² dekat pintu masuk WTC/ITC Surabaya (traffic tinggi), 5–10jt/bln, 2 tahun, mulai bulan depan!
```

### CASE 07 | Sewa | Popup Store (short term)
```
Customer : Sewa toko 3 bulan buat popup store
AI       : Popup untuk brand awareness! Area & jenis usaha?
Customer : Pakuwon, fashion lokal
AI       : Prioritas area high traffic (dekat atrium/anchor)?
Customer : Iya biar banyak yang lihat
AI       : Luas & budget/bulan?
Customer : 25 m², 10–15 juta
AI       : Kapan mulai?
Customer : Bulan depan
AI       : Siap! Popup store fashion 25m² area high traffic Pakuwon Surabaya, 10–15jt/bln, 3 bulan, mulai bulan depan!
```

### CASE 08 | Sewa | Toko + Storage
```
Customer : Sewa toko yang ada storage di belakang buat toko sepatu
AI       : Toko sepatu butuh display + stock room. Area?
Customer : Surabaya Timur
AI       : Prioritas dalam mall atau standalone (dekat perumahan)?
Customer : Standalone dekat perumahan padat
AI       : Luas (toko + storage) & budget?
Customer : 40–60 m² (30 toko + storage), 12–18 juta
AI       : Prioritas frontage lebar + parkir + bebas banjir?
Customer : Iya semua
AI       : Durasi?
Customer : 2 tahun
AI       : Siap! Toko sepatu 40–60m² (display + storage) standalone dekat perumahan Surabaya Timur, frontage lebar + parkir + BEBAS BANJIR, 12–18jt/bln, 2 tahun!
```

### CASE 09 | Sewa | Ganti-Ganti
```
Customer : sewa toko surabaya buat jualan
AI       : Jualan apa?
Customer : Makanan... eh minuman aja lebih simpel
AI       : Keduanya F&B! Dalam mall atau standalone?
Customer : Mall lebih rame
AI       : Area & budget?
Customer : Barat atau Pusat, 8–15 juta
AI       : Prioritas dekat food court (traffic)?
Customer : Iya
AI       : Luas & durasi?
Customer : 20–35 m², 2 tahun
AI       : Siap! Toko F&B 20–35m² dalam mall Surabaya Barat/Pusat dekat food court, 8–15jt/bln, 2 tahun!
```

### CASE 10 | Sewa | WA Singkat
```
Customer : sewa toko mall sby 25m fashion 10jt 2thn deket rame anak muda
AI       : Mall mana & frontage penting?
Customer : ciputra world, iya frontage lebar
AI       : Siap! Toko fashion 25m² frontage lebar Ciputra World Surabaya (area ramai anak muda), 10jt/bln, 2 tahun!
```

---

## BAGIAN B: BELI TOKO (Case 11–20)

### CASE 11 | Beli | Unit Mall + Traffic Tinggi
```
Customer : Beli unit toko di mall Surabaya buat usaha sendiri
AI       : Beli unit mall = aset + tempat usaha! Usaha apa?
Customer : Toko elektronik
AI       : Elektronik butuh traffic + area yang tepat. Mall & lokasi dalam mall?
Customer : Surabaya Pusat, yang ground floor kalau bisa
AI       : Ground floor traffic tertinggi. Budget?
Customer : 1,5–3 M
AI       : Cash/KPR & luas?
Customer : Cash, 30–50 m²
AI       : Target?
Customer : 3 bulan
AI       : Siap! Unit toko elektronik 30–50m² ground floor mall Surabaya Pusat (traffic tinggi), 1,5–3M, cash, target 3 bulan!
```

### CASE 12 | Beli | Malas Ketik
```
Customer : beli unit toko mall sby pusat 25m 2M cash invest
AI       : Ground floor & target?
Customer : iya ground floor, 3 bln
AI       : Prioritas dekat anchor store (traffic)?
Customer : iya
AI       : Siap! Unit toko 25m² ground floor mall Surabaya Pusat dekat anchor store, 2M, cash, target 3 bulan, investasi!
```

### CASE 13 | Beli | Investasi Yield
```
Customer : Beli unit toko buat investasi disewakan, mana yield tinggi?
AI       : Untuk yield toko: mal anchor (TP/Ciputra) stabil tapi mahal; trade center (WTC/ITC) yield lebih tinggi 8–12% tapi likuiditas kurang. Budget?
Customer : 1,5–3 M
AI       : Cash/KPR & luas?
Customer : Cash, 20–40 m²
AI       : Prioritas traffic tinggi (magnet penyewa)?
Customer : Iya
AI       : Target?
Customer : 3 bulan
AI       : Siap! Unit toko 20–40m² trade center/mall Surabaya (yield tinggi + traffic), 1,5–3M, cash, target 3 bulan, investasi!
```

### CASE 14 | Beli | Tanya Harga
```
Customer : Harga unit toko di mall Surabaya berapa?
AI       : Tergantung mall & lokasi: mal prime (TP/Ciputra) 30–80 juta/m²; trade center (WTC) 15–30 juta/m². Ground floor lebih mahal. Budget?
Customer : 1,5–3 M
AI       : Luas & tujuan?
Customer : 40–60 m², usaha sendiri
AI       : Prioritas ground floor + dekat keramaian?
Customer : Iya
AI       : Cash/KPR & target?
Customer : Cash, 3 bulan
AI       : Siap! Unit toko 40–60m² ground floor mall/trade center Surabaya (dekat keramaian), 1,5–3M, cash, target 3 bulan!
```

### CASE 15 | Beli | Marah (habis/mahal terus)
```
Customer : 4 bulan cari unit toko di TP, selalu habis atau over budget!
AI       : TP unit tokonya sangat terbatas. Mau saya carikan di mal prime setara? Budget?
Customer : Max 2,5 M cash siap
AI       : Cash siap = closing cepat. Luas & usaha?
Customer : 30–50 m², toko aksesoris
AI       : Target?
Customer : Secepat mungkin
AI       : Saya carikan unit di Ciputra World/Galaxy/Pakuwon setara TP, 30–50m² cash 2,5M — Anda dapat info pertama. Update 24 jam!
```

### CASE 16 | Beli | Unit dengan Tenant (sudah tersewa)
```
Customer : Beli unit toko yang sudah ada penyewanya
AI       : Beli unit ber-tenant = langsung dapat passive income! Mall & lokasi?
Customer : Surabaya Pusat, yang tenant-nya bagus
AI       : Saya cek: kontrak tenant, histori bayar, sisa masa sewa. Budget & luas?
Customer : 2–3 M, 30–50 m²
AI       : Cash/KPR & target?
Customer : Cash, 3 bulan
AI       : Siap! Unit toko 30–50m² ber-tenant Surabaya Pusat (kontrak + histori clear), 2–3M, cash, target 3 bulan, passive income!
```

### CASE 17 | Beli | First Timer (edukasi PPJB)
```
Customer : Pertama kali beli unit toko di mall, ada yang beda?
AI       : Ya! Unit mall: kepemilikan bisa strata title atau HGB di atas HPL; ada service charge bulanan; transaksi lewat PPJB lalu AJB. Cek juga sisa masa HGB. Mau lanjut?
Customer : Oke, buat investasi
AI       : Mall, luas & budget?
Customer : Surabaya Pusat, 30 m², 2 M
AI       : Prioritas ground floor + traffic tinggi?
Customer : Iya
AI       : Cash/KPR & target?
Customer : Cash, 3 bulan
AI       : Siap! Unit toko 30m² ground floor Surabaya Pusat (PPJB/AJB + service charge dijelaskan), 2M, cash, target 3 bulan. Saya bantu review kontrak!
```

### CASE 18 | Beli | Unit Toko di Mall Baru (inden)
```
Customer : Beli unit toko di mall baru yang lagi launching
AI       : Mall baru harga perdana lebih murah + potensi naik saat ramai. Tapi cek track record developer & rencana tenant anchor ya. Area?
Customer : Surabaya Barat, mall baru
AI       : Prioritas lokasi unit strategis (dekat pintu/anchor)?
Customer : Iya yang ramai nanti
AI       : Luas & budget?
Customer : 30 m², 2 M
AI       : Cash/KPR & target serah terima?
Customer : KPR, max 1 tahun
AI       : Siap! Unit toko 30m² lokasi strategis mall baru Surabaya Barat (developer OK + anchor jelas), 2M, KPR, serah terima max 1 tahun!
```

### CASE 19 | Beli | Toko Second + Renovasi
```
Customer : Beli toko second murah buat direnovasi di Surabaya
AI       : Bisa dapat lokasi bagus harga miring! Standalone atau unit mall?
Customer : Standalone dekat perumahan padat
AI       : Wajib cek: struktur + BEBAS BANJIR + legalitas + frontage. Setuju?
Customer : Iya, jangan yang banjir
AI       : Luas, budget & cash/KPR?
Customer : 40–60 m², 1,5 M, cash
AI       : Tujuan & target?
Customer : Disewakan, 3 bulan
AI       : Siap! Toko second 40–60m² standalone dekat perumahan Surabaya (struktur + BEBAS BANJIR + legalitas clear), 1,5M, cash, target 3 bulan, investasi!
```

### CASE 20 | Beli | WA Singkat
```
Customer : beli unit toko mall sby pusat 40m ground floor 2.5M cash 3bln invest tenant
AI       : Prioritas traffic tinggi & kontrak tenant clear?
Customer : iya dua-duanya
AI       : Siap! Unit toko 40m² ground floor Surabaya Pusat (traffic tinggi + tenant + kontrak clear), 2,5M, cash, target 3 bulan, investasi!
```

---
*File: 09_SKILL_STORE_TOKO_CHAT.md | Elevan Property Chatbot Skills v2.0*

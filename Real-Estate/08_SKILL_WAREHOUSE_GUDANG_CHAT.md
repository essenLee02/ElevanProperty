# SKILL: GUDANG / WAREHOUSE — 20 Simulasi Chat WhatsApp
**Tipe Property:** Gudang (Warehouse)
**Transaksi:** Sewa, Beli | **Total Case:** 20
**Fokus:** Fasilitas, transaksi, area, preferensi lokasi & red flag

---

## 🔧 SLOT KHUSUS GUDANG
```json
{
  "transaction_type": null, "location": null, "floor_area": null, "ceiling_height": null,
  "loading_dock": null, "truck_access": null, "budget": null, "duration": null,
  "environment": {"akses_truk": null, "dekat_tol": null, "bebas_banjir": null, "zona_industri": null},
  "power_capacity": null, "red_flags": []
}
```

---

## BAGIAN A: SEWA GUDANG (Case 01–10)

### CASE 01 | Sewa | Akses Kontainer + Zona Industri + Bebas Banjir
```
Customer : Sewa gudang di Surabaya yang bisa masuk truk kontainer
AI       : Kritikal! Akses truk 40 feet + putar balik butuh jalan lebar. Zona industri mana?
Customer : Margomulyo, Rungkut, atau Gresik
AI       : Ketiganya container-friendly. Luas gudang?
Customer : 1.000–2.000 m²
AI       : Prioritas dekat pintu tol (distribusi cepat)?
Customer : Iya, sama bebas banjir karena barang gampang rusak
AI       : Penting — gudang BEBAS BANJIR + dekat tol. Butuh loading dock?
Customer : Iya minimal 2 dock
AI       : Budget/bulan & durasi?
Customer : 40–70 juta, 3 tahun
AI       : Siap! Gudang 1.000–2.000m² zona industri Margomulyo/Rungkut/Gresik, akses kontainer + 2 loading dock + dekat tol + BEBAS BANJIR, 40–70jt/bln, 3 tahun!
```

### CASE 02 | Sewa | Malas Ketik
```
Customer : sewa gudang gresik 1500m akses truk deket tol
AI       : Loading dock & bebas banjir penting?
Customer : iya 2 dock, bebas banjir wajib
AI       : Budget/bln & durasi?
Customer : 40-60jt 3 tahun
AI       : Siap! Gudang 1.500m² zona industri Gresik, akses truk + 2 dock + dekat tol + BEBAS BANJIR, 40–60jt/bln, 3 tahun!
```

### CASE 03 | Sewa | Info Terbatas
```
Customer : mau sewa gudang buat simpan barang
AI       : Barang apa? Ini menentukan spesifikasi (tinggi plafon, listrik, dll)
Customer : Barang elektronik & spare part
AI       : Elektronik sensitif — WAJIB bebas banjir + kering + keamanan baik. Setuju?
Customer : Iya bebas banjir penting
AI       : Luas & area?
Customer : 500–1.000 m², Surabaya/Sidoarjo
AI       : Prioritas akses truk + dekat tol?
Customer : Iya biar distribusi lancar
AI       : Budget/bulan & durasi?
Customer : 20–40 juta, 3 tahun
AI       : Siap! Gudang 500–1.000m² Surabaya/Sidoarjo, akses truk + dekat tol + BEBAS BANJIR (aman elektronik), 20–40jt/bln, 3 tahun!
```

### CASE 04 | Sewa | Tanya Harga
```
Customer : Sewa gudang di Margomulyo Surabaya berapa?
AI       : Margomulyo (zona industri): 30–60rb/m²/bulan tergantung spesifikasi & akses. 1.000m² = 30–60jt/bulan. Yang ada dock + dekat tol lebih tinggi. Luas?
Customer : 1.500 m²
AI       : Prioritas akses kontainer + dock?
Customer : Iya, sama bebas banjir
AI       : Budget & durasi?
Customer : 45–65 juta, 3 tahun
AI       : Siap! Gudang 1.500m² Margomulyo, akses kontainer + dock + BEBAS BANJIR, 45–65jt/bln, 3 tahun!
```

### CASE 05 | Sewa | Marah (banjir merusak stok)
```
Customer : Gudang lama saya kebanjiran, stok rugi ratusan juta! Mau pindah SEKARANG
AI       : Itu kerugian fatal — gudang WAJIB bebas banjir mutlak. Saya carikan yang elevasinya tinggi & histori kering. Barang & luas?
Customer : Tekstil, 1.000–1.500 m², max 50 juta
AI       : Area & akses?
Customer : Zona industri yang aman banjir, akses truk
AI       : Saya seleksi gudang zona industri DIJAMIN BEBAS BANJIR (elevasi tinggi + verifikasi histori), 1.000–1.500m² + akses truk, max 50jt. Kapan pindah?
Customer : Secepatnya
AI       : Siap! Gudang 1.000–1.500m² zona industri BEBAS BANJIR + akses truk, max 50jt/bln, pindah secepatnya!
```

### CASE 06 | Sewa | Cold Storage
```
Customer : Sewa gudang yang bisa jadi cold storage buat frozen food
AI       : Cold storage butuh: listrik besar, insulasi, & lokasi strategis distribusi. Sudah ada unit pendingin atau bangun sendiri?
Customer : Bangun sendiri, butuh listrik besar
AI       : Berapa kapasitas listrik & luas?
Customer : Minimal 200 kVA, 800–1.200 m²
AI       : Prioritas dekat tol + akses truk (distribusi cepat) + bebas banjir?
Customer : Iya semua wajib
AI       : Budget/bulan & durasi?
Customer : 40–70 juta, 5 tahun
AI       : Siap! Gudang 800–1.200m² (listrik 200 kVA) + akses truk + dekat tol + BEBAS BANJIR, cold storage, 40–70jt/bln, 5 tahun!
```

### CASE 07 | Sewa | Gudang Kecil (UMKM)
```
Customer : Sewa gudang kecil buat UMKM saya, gak perlu besar
AI       : Untuk UMKM! Barang apa & luas kira-kira?
Customer : Stok baju online, 100–200 m² cukup
AI       : Prioritas akses mobil/pickup + dekat rumah/kantor?
Customer : Iya biar gampang bolak-balik
AI       : Area & bebas banjir?
Customer : Surabaya Timur, iya bebas banjir
AI       : Budget/bulan & durasi?
Customer : 5–10 juta, 2 tahun
AI       : Siap! Gudang kecil 100–200m² Surabaya Timur, akses pickup + BEBAS BANJIR, stok fashion online, 5–10jt/bln, 2 tahun!
```

### CASE 08 | Sewa | Dekat Pelabuhan (EksIm)
```
Customer : Sewa gudang dekat Tanjung Perak buat ekspor impor
AI       : Dekat Perak efisien untuk EksIm! Prioritas akses lancar gak kejebak antrian peti kemas?
Customer : Iya, yang jalur alternatifnya lancar
AI       : Luas & loading dock?
Customer : 1.500–2.000 m², 3 dock
AI       : Bebas banjir & budget?
Customer : Iya wajib, 50–80 juta/bulan
AI       : Durasi?
Customer : 3 tahun
AI       : Siap! Gudang 1.500–2.000m² dekat Tanjung Perak, akses lancar anti-macet kontainer + 3 dock + BEBAS BANJIR, EksIm, 50–80jt/bln, 3 tahun!
```

### CASE 09 | Sewa | Ganti-Ganti
```
Customer : sewa gudang surabaya
AI       : Barang apa & luas?
Customer : Distribusi FMCG... 1.000 m² dulu, mungkin nambah
AI       : Siapkan yang bisa ekspansi. Area?
Customer : Margomulyo... atau Gresik ya yang lebih murah?
AI       : Gresik biasanya lebih ekonomis. Prioritas akses truk + tol?
Customer : Iya dua-duanya
AI       : Bebas banjir & budget?
Customer : Iya, 35–55 juta
AI       : Durasi?
Customer : 3 tahun
AI       : Siap! Gudang 1.000m² (bisa ekspansi) Gresik, akses truk + dekat tol + BEBAS BANJIR, FMCG, 35–55jt/bln, 3 tahun!
```

### CASE 10 | Sewa | WA Singkat
```
Customer : sewa gudang margomulyo 1500m akses kontainer 2dock 50jt 3thn bebas banjir
AI       : Dekat tol penting?
Customer : iya wajib
AI       : Siap! Gudang 1.500m² Margomulyo, akses kontainer + 2 dock + dekat tol + BEBAS BANJIR, 50jt/bln, 3 tahun!
```

---

## BAGIAN B: BELI GUDANG (Case 11–20)

### CASE 11 | Beli | Dekat Pelabuhan + Akses Lancar
```
Customer : beli gudang dekat pelabuhan Tanjung Perak buat ekspor impor
AI       : Tepat! Dekat Perak efisien untuk EksIm. Prioritas radius berapa?
Customer : Yang aksesnya lancar, gak kejebak macet peti kemas
AI       : Noted — jalur alternatif lancar. Luas?
Customer : 2.000–3.000 m²
AI       : Budget & cash/KPR?
Customer : 8–15 M, cash
AI       : Verifikasi BEBAS BANJIR + sertifikat bersih ya
Customer : Wajib, jangan ada sengketa
AI       : Target?
Customer : 6 bulan
AI       : Siap! Gudang 2.000–3.000m² dekat Tanjung Perak, akses lancar anti-macet + BEBAS BANJIR + legalitas bersih, 8–15M, cash, target 6 bulan!
```

### CASE 12 | Beli | Malas Ketik
```
Customer : beli gudang gresik 2000m zona industri 10M cash 6bln
AI       : Prioritas akses truk + dekat tol + bebas banjir?
Customer : iya semua wajib
AI       : Siap! Gudang 2.000m² zona industri Gresik, akses truk + dekat tol + BEBAS BANJIR, 10M, cash, target 6 bulan!
```

### CASE 13 | Beli | Tanya Harga
```
Customer : Harga gudang di zona industri Gresik berapa?
AI       : Gudang Gresik: 4–8 juta/m² tergantung akses & spesifikasi. 2.000m² = 8–16M. Yang ada dock + dekat tol lebih tinggi. Budget?
Customer : 8–14 M
AI       : Luas & tujuan?
Customer : 2.000 m², buat pabrik + gudang sendiri
AI       : Prioritas akses truk + listrik besar + bebas banjir?
Customer : Iya semua
AI       : Cash/KPR & target?
Customer : Cash, 6 bulan
AI       : Siap! Gudang 2.000m² zona industri Gresik, akses truk + listrik besar + BEBAS BANJIR, 8–14M, cash, target 6 bulan!
```

### CASE 14 | Beli | Investasi Sewa
```
Customer : Beli gudang buat investasi disewakan
AI       : Gudang di lokasi strategis demand sewa stabil (e-commerce/logistik lagi booming)! Area?
Customer : Dekat tol atau pelabuhan yang gampang disewa
AI       : Dekat tol Waru/pelabuhan demand tinggi. Luas & budget?
Customer : 1.500–2.000 m², 8–12 M
AI       : Prioritas akses truk + dock + bebas banjir (magnet penyewa)?
Customer : Iya semua
AI       : Cash/KPR & target?
Customer : Cash, 6 bulan
AI       : Siap! Gudang 1.500–2.000m² dekat tol/pelabuhan (akses truk + dock + BEBAS BANJIR), demand sewa tinggi, 8–12M, cash, target 6 bulan, investasi!
```

### CASE 15 | Beli | Marah (legalitas)
```
Customer : Cari gudang di Gresik setahun, selalu masalah legalitas! Tolong
AI       : Legalitas lahan industri Gresik memang perlu teliti. Saya fokuskan yang sertifikatnya BERSIH. Luas & budget?
Customer : 5.000 m², zona industri, 8–15 M, cash siap
AI       : Target?
Customer : Secepat mungkin
AI       : Saya carikan gudang zona industri Gresik 5.000m² 8–15M cash — dengan verifikasi legalitas PENUH sebelum Anda keluarkan dana sepeser pun. Update 48 jam!
```

### CASE 16 | Beli | Lahan untuk Bangun Gudang
```
Customer : Beli lahan di zona industri buat bangun gudang sendiri
AI       : Bangun sendiri = desain sesuai kebutuhan (tinggi plafon, dock, dll)! Luas lahan?
Customer : 3.000–5.000 m²
AI       : Prioritas akses truk kontainer + dekat tol?
Customer : Iya wajib, sama zona peruntukan industri
AI       : Penting — cek peruntukan (RTRW) industri + legalitas + bebas banjir. Setuju?
Customer : Iya semua
AI       : Budget & cash/KPR?
Customer : 8–15 M, cash
AI       : Target?
Customer : 6 bulan
AI       : Siap! Lahan 3.000–5.000m² zona industri (peruntukan clear + akses kontainer + dekat tol + BEBAS BANJIR), 8–15M, cash, target 6 bulan, untuk bangun gudang!
```

### CASE 17 | Beli | First Timer (edukasi)
```
Customer : Pertama kali beli gudang, apa yang wajib dicek?
AI       : Bagus! Checklist gudang: (1) legalitas SHM/HGB + peruntukan industri, (2) BEBAS BANJIR (fatal buat stok), (3) akses truk/kontainer + putar balik, (4) tinggi plafon & struktur, (5) kapasitas listrik, (6) loading dock. Mau lanjut cari?
Customer : Iya, buat distribusi sendiri
AI       : Luas, area & budget?
Customer : 1.500 m², Gresik, 6–10 M
AI       : Cash/KPR & target?
Customer : Cash, 6 bulan
AI       : Siap! Gudang 1.500m² Gresik (legalitas + peruntukan + akses truk + BEBAS BANJIR + listrik memadai), 6–10M, cash, target 6 bulan. Saya bantu cek semua checklist!
```

### CASE 18 | Beli | Gudang Second + Renovasi
```
Customer : Beli gudang second yang murah buat direnovasi
AI       : Bisa hemat! Tapi wajib cek struktur (atap, lantai, tiang) + BEBAS BANJIR + legalitas. Area & budget?
Customer : Sidoarjo, 5–8 M
AI       : Luas & tujuan?
Customer : 1.500–2.000 m², distribusi
AI       : Prioritas akses truk + dekat tol?
Customer : Iya dua-duanya
AI       : Cash/KPR & target?
Customer : Cash, 6 bulan
AI       : Siap! Gudang second 1.500–2.000m² Sidoarjo (struktur diverifikasi + BEBAS BANJIR + legalitas clear), akses truk + dekat tol, 5–8M, cash, target 6 bulan!
```

### CASE 19 | Beli | Multi-Unit Investor Logistik
```
Customer : Perusahaan logistik saya mau beli 2 gudang di titik berbeda
AI       : Untuk jaringan distribusi, spread di titik strategis itu efisien! Area target?
Customer : Satu dekat pelabuhan, satu dekat tol Waru
AI       : Kombinasi tepat (impor + distribusi). Luas per unit & budget total?
Customer : 2.000 m² per unit, total 16–24 M
AI       : Prioritas akses kontainer + dock + bebas banjir?
Customer : Iya standar operasional kami
AI       : Cash & target?
Customer : Cash, 6 bulan
AI       : Siap! 2 gudang @2.000m² (dekat pelabuhan + dekat tol Waru), akses kontainer + dock + BEBAS BANJIR, total 16–24M, cash, target 6 bulan, jaringan logistik!
```

### CASE 20 | Beli | WA Singkat
```
Customer : beli gudang deket perak 2500m 12M cash 6bln akses lancar bebas banjir
AI       : Prioritas loading dock & legalitas bersih?
Customer : iya 3 dock, legalitas wajib clear
AI       : Siap! Gudang 2.500m² dekat Tanjung Perak, akses lancar + 3 dock + BEBAS BANJIR + legalitas clear, 12M, cash, target 6 bulan!
```

---
*File: 08_SKILL_WAREHOUSE_GUDANG_CHAT.md | Elevan Property Chatbot Skills v2.0*

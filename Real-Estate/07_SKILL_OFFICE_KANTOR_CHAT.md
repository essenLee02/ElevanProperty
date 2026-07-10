# SKILL: KANTOR / OFFICE — 20 Simulasi Chat WhatsApp
**Tipe Property:** Kantor (Office)
**Transaksi:** Sewa, Beli | **Total Case:** 20
**Fokus:** Fasilitas, transaksi, area, preferensi lokasi & red flag

---

## 🔧 SLOT KHUSUS KANTOR
```json
{
  "transaction_type": null, "location": null, "floor_area": null, "capacity": null,
  "budget": null, "furnished": null, "duration": null,
  "environment": {"prestisius": null, "akses_lancar": null, "bebas_banjir": null},
  "nearby": [], "parking": null, "red_flags": []
}
```

---

## BAGIAN A: SEWA KANTOR (Case 01–10)

### CASE 01 | Sewa | CBD + Akses Tol + Dekat Cafe
```
Customer : Sewa kantor di Surabaya yang prestisius & gampang diakses klien
AI       : "Prestisius + mudah diakses" = gedung CBD dekat tol. Area: Tunjungan, HR Muhammad, atau Sungkono?
Customer : Yang alamatnya bergengsi, sekalian dekat cafe buat meeting santai
AI       : Tunjungan (pusat) atau Sungkono (banyak cafe). Luas & kapasitas?
Customer : 100–150 m², 15 karyawan
AI       : Prioritas dekat tol (klien luar kota) & parkir cukup?
Customer : Iya dua-duanya
AI       : Budget/bulan & furnished?
Customer : 15–25 juta, semi furnished
AI       : Durasi?
Customer : 3 tahun
AI       : Siap! Kantor 100–150m² (15 staf) Tunjungan/Sungkono Surabaya, alamat bergengsi + dekat tol + cafe + parkir, semi furnished, 15–25jt/bln, 3 tahun!
```

### CASE 02 | Sewa | Malas Ketik
```
Customer : sewa kantor sby cbd 100m 12 karyawan deket tol
AI       : Furnished & budget/bln?
Customer : semi furnished, 15-20jt
AI       : Prioritas parkir & dekat cafe?
Customer : iya dua-duanya
AI       : Durasi?
Customer : 3 tahun
AI       : Siap! Kantor 100m² (12 staf) CBD Surabaya dekat tol, semi furnished + parkir + cafe, 15–20jt/bln, 3 tahun!
```

### CASE 03 | Sewa | Info Terbatas
```
Customer : mau sewa kantor kecil buat startup
AI       : Untuk startup! Berapa orang tim saat ini?
Customer : 5–8 orang, mungkin nambah
AI       : Cocok co-working atau private office kecil. Kota & area?
Customer : Surabaya, yang strategis buat meeting klien
AI       : Prioritas akses lancar + dekat cafe (meeting)?
Customer : Iya, sama budget hemat
AI       : Luas ~50–70m² cukup. Budget/bulan?
Customer : 7–12 juta
AI       : Furnished & durasi?
Customer : Furnished biar hemat setup, 2 tahun
AI       : Siap! Kantor 50–70m² (5–8 staf) area strategis Surabaya, akses lancar + dekat cafe, furnished, 7–12jt/bln, 2 tahun, startup!
```

### CASE 04 | Sewa | Tanya Harga
```
Customer : Sewa kantor di gedung Sungkono Surabaya berapa?
AI       : Gedung perkantoran Sungkono: 150–350rb/m²/bulan tergantung grade gedung. 100m² = 15–35jt/bulan. Grade A lebih mahal tapi prestisius. Luas?
Customer : 120 m²
AI       : Prioritas grade & parkir?
Customer : Grade B cukup, parkir penting
AI       : Budget & durasi?
Customer : 18–25 juta, 3 tahun
AI       : Furnished?
Customer : Bare, mau custom
AI       : Siap! Kantor 120m² grade B Sungkono Surabaya, parkir cukup, bare (custom), 18–25jt/bln, 3 tahun!
```

### CASE 05 | Sewa | Marah (banjir)
```
Customer : Kantor lama saya kebanjiran, dokumen & komputer rusak! Mau pindah
AI       : Itu kerugian besar — kantor WAJIB bebas banjir. Saya carikan yang elevasinya aman & gedung ada proteksi. Kriteria?
Customer : 100–150 m², 15 orang, akses lancar, max 25 juta
AI       : Area?
Customer : CBD Surabaya yang bebas banjir mutlak
AI       : Saya seleksi kantor CBD Surabaya DIJAMIN BEBAS BANJIR (gedung tinggi/elevasi aman), 100–150m², akses lancar, max 25jt. Kapan pindah?
Customer : Secepatnya
AI       : Siap! Kantor 100–150m² CBD Surabaya BEBAS BANJIR + akses lancar, max 25jt/bln, pindah secepatnya!
```

### CASE 06 | Sewa | Virtual Office/Co-working
```
Customer : Cari virtual office atau co-working murah di Surabaya
AI       : Untuk hemat biaya di awal! Virtual office (alamat bisnis + resepsionis) atau co-working (meja + fasilitas)?
Customer : Co-working, kadang butuh meeting room
AI       : Berapa orang & prioritas lokasi?
Customer : 3 orang, dekat CBD biar prestisius
AI       : Prioritas dekat cafe & akses lancar?
Customer : Iya
AI       : Budget/bulan?
Customer : 3–6 juta
AI       : Durasi?
Customer : Fleksibel, 1 tahun
AI       : Siap! Co-working (3 orang + meeting room) dekat CBD Surabaya, akses lancar + dekat cafe, 3–6jt/bln, 1 tahun!
```

### CASE 07 | Sewa | Kantor Luas (perusahaan besar)
```
Customer : Sewa kantor 1 lantai penuh buat perusahaan 50 karyawan
AI       : Untuk 50 orang butuh ~400–600m². Prioritas gedung grade A (image perusahaan)?
Customer : Iya grade A, dekat CBD
AI       : Prioritas akses tol + parkir banyak + dekat mall (klien & karyawan)?
Customer : Iya semua penting
AI       : Budget/bulan?
Customer : 60–100 juta
AI       : Furnished & durasi?
Customer : Semi furnished, 5 tahun
AI       : Siap! Kantor 1 lantai (400–600m², 50 staf) grade A CBD Surabaya, akses tol + parkir banyak + dekat mall, semi furnished, 60–100jt/bln, 5 tahun!
```

### CASE 08 | Sewa | Dekat Bandara (logistik)
```
Customer : Sewa kantor dekat Bandara Juanda buat perusahaan logistik
AI       : Dekat Juanda efisien untuk logistik (akses cepat kargo). Luas & kapasitas?
Customer : 150 m², 20 orang
AI       : Prioritas akses lancar ke bandara + parkir operasional?
Customer : Iya dua-duanya
AI       : Budget/bulan?
Customer : 20–30 juta
AI       : Bebas banjir & durasi?
Customer : Iya wajib, 3 tahun
AI       : Siap! Kantor 150m² (20 staf) dekat Bandara Juanda, akses lancar + parkir + BEBAS BANJIR, logistik, 20–30jt/bln, 3 tahun!
```

### CASE 09 | Sewa | Ganti-Ganti
```
Customer : sewa kantor surabaya
AI       : Berapa orang & area?
Customer : 10 orang... eh mungkin 15 nanti nambah
AI       : Siapkan ~120m² untuk antisipasi. Area?
Customer : CBD... atau yang penting dekat tol deh
AI       : Dekat tol Sungkono/Waru cocok. Budget?
Customer : 15–22 juta, semi furnished
AI       : Prioritas parkir & dekat cafe?
Customer : Iya
AI       : Durasi?
Customer : 3 tahun
AI       : Siap! Kantor ~120m² (15 staf) dekat tol Surabaya, semi furnished + parkir + cafe, 15–22jt/bln, 3 tahun!
```

### CASE 10 | Sewa | WA Singkat
```
Customer : sewa kantor sby sungkono 120m 15org 20jt 3thn deket tol parkir
AI       : Furnished & dekat cafe penting?
Customer : semi furnished, iya
AI       : Siap! Kantor 120m² (15 staf) Sungkono Surabaya dekat tol + parkir + cafe, semi furnished, 20jt/bln, 3 tahun!
```

---

## BAGIAN B: BELI KANTOR (Case 11–20)

### CASE 11 | Beli | Akses Lancar + Bebas Banjir
```
Customer : beli unit kantor di Surabaya buat kantor sendiri
AI       : Untuk milik sendiri, lokasi & akses jangka panjang penting. Area preferensi?
Customer : Yang aksesnya lancar, gak macet tiap pagi
AI       : Noted — hindari koridor macet. Dekat tol jadi plus. Budget?
Customer : 2–4 miliar
AI       : Luas?
Customer : 100–200 m²
AI       : Saya pastikan gedung/area BEBAS BANJIR ya (operasional aman)
Customer : Wajib, kantor banjir rugi besar
AI       : Cash/KPR & target?
Customer : Cash, 6 bulan
AI       : Siap! Unit kantor 100–200m² Surabaya, akses lancar anti-macet + dekat tol + BEBAS BANJIR, 2–4M, cash, target 6 bulan!
```

### CASE 12 | Beli | Malas Ketik
```
Customer : beli kantor sby cbd 150m 3M cash 6bln deket tol
AI       : Prioritas bebas banjir & parkir?
Customer : iya dua-duanya wajib
AI       : Siap! Unit kantor 150m² CBD Surabaya dekat tol + parkir + BEBAS BANJIR, 3M, cash, target 6 bulan!
```

### CASE 13 | Beli | Tanya Harga
```
Customer : Harga unit kantor di CBD Surabaya berapa?
AI       : Unit kantor CBD Surabaya: 25–50 juta/m² tergantung grade & lokasi. 100m² = 2,5–5M. Grade A prime lebih tinggi. Budget?
Customer : 2,5–4 M
AI       : Luas & tujuan?
Customer : 100–150 m², kantor sendiri
AI       : Prioritas akses lancar + parkir + bebas banjir?
Customer : Iya semua
AI       : Cash/KPR & target?
Customer : Cash, 6 bulan
AI       : Siap! Unit kantor 100–150m² CBD Surabaya, akses lancar + parkir + BEBAS BANJIR, 2,5–4M, cash, target 6 bulan!
```

### CASE 14 | Beli | Investasi Sewa
```
Customer : Beli unit kantor buat investasi disewakan
AI       : Untuk yield kantor: lokasi CBD/dekat tol demand tinggi dari perusahaan. Area?
Customer : Surabaya, yang gampang dapat penyewa
AI       : CBD Sungkono/HR Muhammad rotasi penyewa cepat. Budget?
Customer : 2–3,5 M
AI       : Prioritas akses lancar + parkir (magnet penyewa) + bebas banjir?
Customer : Iya semua
AI       : Cash/KPR & target?
Customer : Cash, 5 bulan
AI       : Siap! Unit kantor CBD Surabaya (akses lancar + parkir + BEBAS BANJIR), demand penyewa tinggi, 2–3,5M, cash, target 5 bulan, investasi!
```

### CASE 15 | Beli | Marah (kalah cepat)
```
Customer : 2x mau beli kantor keburu diambil! Kesal
AI       : Unit kantor lokasi bagus cepat laku. Saya bantu prioritaskan Anda. Kriteria & cash?
Customer : 100–150 m², CBD, max 3 M cash siap
AI       : Cash siap = closing cepat. Area & target?
Customer : Sungkono/HR Muhammad, secepatnya
AI       : Saya aktifkan alert unit kantor 100–150m² CBD Sungkono/HR Muhammad max 3M cash — info pertama untuk Anda. Update 24 jam!
```

### CASE 16 | Beli | Gedung Kantor Mandiri (standalone)
```
Customer : Beli gedung kantor mandiri (bukan unit strata) di Surabaya
AI       : Gedung mandiri = kontrol penuh + branding sendiri! Berapa lantai/luas?
Customer : 3–4 lantai, total 500–800 m²
AI       : Prioritas lokasi prestisius + akses lancar?
Customer : Iya, jalan besar tapi gak macet parah
AI       : Prioritas parkir memadai + bebas banjir?
Customer : Iya dua-duanya wajib
AI       : Budget & cash/KPR?
Customer : 10–20 M, cash
AI       : Target?
Customer : 6 bulan
AI       : Siap! Gedung kantor mandiri 3–4 lantai (500–800m²) Surabaya, lokasi prestisius + akses lancar + parkir + BEBAS BANJIR, 10–20M, cash, target 6 bulan!
```

### CASE 17 | Beli | First Timer (edukasi)
```
Customer : Pertama kali beli kantor, apa bedanya sama beli ruko?
AI       : Bagus! Kantor (di gedung perkantoran): ada IPL/service charge, fasilitas gedung (lift, security, AC central), image profesional. Ruko: standalone, lebih fleksibel usaha. Untuk citra korporat, kantor lebih cocok. Mau lanjut?
Customer : Iya, buat kantor perusahaan
AI       : Kota, luas & budget?
Customer : Surabaya, 100m², 2,5–3,5 M
AI       : Prioritas akses lancar + parkir + bebas banjir?
Customer : Iya
AI       : Cash/KPR & target?
Customer : KPR, 6 bulan
AI       : Siap! Unit kantor 100m² Surabaya (akses lancar + parkir + BEBAS BANJIR, IPL wajar), 2,5–3,5M, KPR, target 6 bulan. Saya bantu cek service charge juga!
```

### CASE 18 | Beli | Kantor Second (resale)
```
Customer : Beli unit kantor second yang lebih murah di Surabaya
AI       : Unit second bisa hemat & kadang sudah ada interior. Area & budget?
Customer : CBD Surabaya, 2–3 M
AI       : Wajib cek: sertifikat SHMSRS + IPL tidak nunggak + kondisi + BEBAS BANJIR. Setuju?
Customer : Iya semua
AI       : Luas & cash/KPR?
Customer : 100–120 m², cash
AI       : Tujuan?
Customer : Kantor sendiri
AI       : Target?
Customer : 5 bulan
AI       : Siap! Unit kantor second 100–120m² CBD Surabaya (SHMSRS + IPL clear + BEBAS BANJIR), 2–3M, cash, target 5 bulan!
```

### CASE 19 | Beli | Investor Multi-Unit
```
Customer : Sudah punya 2 unit kantor, mau tambah buat portofolio
AI       : Portofolio kantor yang solid (tenant korporat stabil)! Area baru atau sama?
Customer : Diversifikasi, coba dekat tol yang berkembang
AI       : Area dekat tol Waru/Aloha berkembang pesat. Luas & budget?
Customer : 150 m², 2,5–4 M
AI       : Prioritas akses lancar + parkir + bebas banjir?
Customer : Iya standar saya
AI       : Cash & target?
Customer : Cash, 5 bulan
AI       : Siap! Unit kantor 150m² dekat tol Waru/Aloha (akses lancar + parkir + BEBAS BANJIR), 2,5–4M, cash, target 5 bulan, ekspansi portofolio!
```

### CASE 20 | Beli | WA Singkat
```
Customer : beli kantor sungkono sby 120m 3M cash 6bln deket tol bebas banjir
AI       : Untuk sendiri atau investasi & prioritas parkir?
Customer : investasi, iya parkir cukup
AI       : Siap! Unit kantor 120m² Sungkono Surabaya dekat tol + parkir + BEBAS BANJIR, 3M, cash, target 6 bulan, investasi!
```

---
*File: 07_SKILL_OFFICE_KANTOR_CHAT.md | Elevan Property Chatbot Skills v2.0*

# SKILL: OFFICE / KANTOR — Panduan Respons Chatbot Property
**Tipe Property:** Kantor (Office)
**Transaksi:** Sewa & Beli
**Total Case:** 35 (15 Sewa + 20 Beli)

---

## 🔧 ATURAN KHUSUS KANTOR

### Slot Tambahan:
```json
{
  "floor_area_sqm": null,
  "building_grade": "A/B/C",
  "headcount": null,
  "parking_slots": null,
  "it_infrastructure": null,
  "fit_out": "fitted/shell",
  "service_charge": null,
  "floor_number": null
}
```

### Pertanyaan Khusus Kantor:
- Berapa orang yang akan bekerja?
- Grade gedung: Grade A (premium), Grade B (menengah), Grade C (ekonomis)?
- Butuh IT infrastructure (server room, raised floor)?
- Fit-out: furnished/fitted, atau shell & core (bangun sendiri)?
- Service charge biasanya terpisah dari harga sewa
- Parkir: berapa slot dibutuhkan?

---

## ═══════════════════════════════════════
## BAGIAN A: SEWA KANTOR (15 CASE)
## ═══════════════════════════════════════

---

### CASE S-01 | Sewa Kantor | Customer Normal / Lengkap
```
Customer : Mau sewa kantor di Surabaya
AI       : Siap! Kantor di area Surabaya mana? Dan ini untuk tim berapa orang?
Customer : Surabaya Pusat, untuk tim 30 orang
AI       : Tim 30 orang — estimasi luas sekitar 150–200 m² untuk office yang nyaman (5–7 m²/orang standar). Fasilitas gedung yang wajib ada?
Customer : Lift, AC sentral, parkir mobil, dan keamanan 24 jam
AI       : Preferensi grade gedung? Grade A (premium), B (menengah), atau C (ekonomis)?
Customer : Grade B sudah cukup
AI       : Budget sewa per bulan atau per m²?
Customer : Total budget 30–50 juta per bulan sudah termasuk service charge
AI       : Butuh ruangan fit-out (langsung pakai) atau shell & core (finishing sendiri)?
Customer : Fit-out, tidak mau repot
AI       : Perlu server room atau raised floor untuk IT?
Customer : Iya, butuh server room kecil
AI       : Berapa slot parkir yang dibutuhkan?
Customer : Minimal 5–8 slot
AI       : Kapan rencananya masuk?
Customer : 3 bulan lagi
AI       : Sewa berapa lama?
Customer : 3 tahun
AI       : Siap! Kantor 150–200m², Grade B, Surabaya Pusat, lift + AC sentral + 5–8 parkir, fit-out + server room, 30–50 juta/bulan, 3 tahun, masuk 3 bulan lagi!
```

---

### CASE S-02 | Sewa Kantor | Malas Ketik
```
Customer : sewa kantor surabaya 20 org
AI       : Area & grade gedung?
Customer : pusat, grade B
AI       : Budget/bln & berapa lama?
Customer : 20-30jt, 2 tahun
AI       : Fit-out atau shell?
Customer : fit-out
AI       : Kapan masuk?
Customer : 2 bln lagi
AI       : Parkir dibutuhkan?
Customer : 5 slot
AI       : Siap! Kantor 100–140m² Grade B Surabaya Pusat, fit-out, 5 parkir, 20–30jt/bln, 2 tahun, masuk 2 bulan lagi!
```

---

### CASE S-03 | Sewa Kantor | Info Terbatas / Ambigu
```
Customer : mau sewa kantor yang representatif
AI       : Siap! "Representatif" biasanya berarti Grade A atau B di gedung bergengsi. Di kota mana?
Customer : Jakarta, untuk terima klien
AI       : Untuk menerima klien, area CBD Jakarta (Sudirman–Kuningan–SCBD) paling representatif. Tim berapa orang?
Customer : Belum pasti, mungkin 10–15 orang
AI       : Luas sekitar 60–100 m² untuk 10–15 orang. Budget per bulan?
Customer : Yang wajar untuk bisnis konsultan
AI       : Untuk kantor Grade A di CBD Jakarta, harga mulai 200 ribu/m²/bulan, jadi 60 m² sekitar 12–15 juta. Sesuai budget?
Customer : Oke, range 15–25 juta masih oke
AI       : Fit-out atau shell?
Customer : Fit-out, lebih cepat operasional
AI       : Kapan mulai?
Customer : Bulan depan
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Parkir?
Customer : 3–4 slot
AI       : Siap! Kantor Grade A 60–100m² di CBD Sudirman–Kuningan Jakarta, fit-out, 3–4 parkir, 15–25 juta/bulan, 2 tahun, mulai bulan depan!
```

---

### CASE S-04 | Sewa Kantor | Tanya Harga Duluan
```
Customer : Sewa kantor di Jakarta CBD berapa per bulan?
AI       : Di Jakarta CBD, harga sewa office tergantung grade: Grade A 250–400 ribu/m²/bulan, Grade B 150–250 ribu/m²/bulan, Grade C 80–150 ribu/m²/bulan. Untuk tim berapa orang?
Customer : 25 orang
AI       : Estimasi butuh 125–175 m². Dengan Grade B, itu sekitar 18–43 juta/bulan sebelum service charge. Budget totalnya berapa?
Customer : 30–50 juta termasuk service charge
AI       : Masuk untuk Grade B 150–175 m² di area CBD. Di area mana di Jakarta?
Customer : Sudirman atau Kuningan
AI       : Fit-out atau shell?
Customer : Fit-out
AI       : Kapan masuk?
Customer : 2 bulan lagi
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Parkir?
Customer : 6 slot
AI       : Siap! Kantor Grade B 150–175m² di Sudirman/Kuningan Jakarta, fit-out, 6 parkir, 30–50 juta/bulan, 2 tahun, masuk 2 bulan lagi!
```

---

### CASE S-05 | Sewa Kantor | Marah / Frustrasi
```
Customer : Sudah keliling cari kantor di Surabaya, agen-agen tidak ada yang kasih info lengkap soal service charge! Mau sewa yang transparan
AI       : Anda benar, service charge sering jadi hidden cost yang tidak diinformasikan di awal — itu tidak profesional. Saya pastikan dari sini semua harga sudah all-in atau disampaikan terpisah dengan jelas. Di area Surabaya mana yang Anda cari?
Customer : Surabaya Pusat atau Barat
AI       : Tim berapa orang?
Customer : 20 orang
AI       : Budget all-in per bulan (termasuk service charge)?
Customer : Max 30 juta all-in
AI       : Grade gedung?
Customer : B sudah cukup
AI       : Fit-out atau shell?
Customer : Fit-out
AI       : Kapan masuk?
Customer : Secepatnya
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Parkir?
Customer : 4 slot
AI       : Siap! Saya carikan dengan transparansi penuh: kantor Grade B ~100m² fit-out di Surabaya Pusat/Barat, ALL-IN max 30 juta (sewa + SC), 4 parkir, 2 tahun, ASAP!
```

---

### CASE S-06 | Sewa Kantor | Startup dengan Budget Ketat
```
Customer : Startup kami mau sewa kantor di Surabaya, budget terbatas
AI       : Banyak startup sukses yang mulai dari kantor yang lean! Budget per bulan yang ada?
Customer : Maksimal 10–15 juta per bulan
AI       : Di range itu di Surabaya bisa dapat kantor Grade B–C 50–80 m² yang nyaman. Tim berapa orang?
Customer : 8–10 orang sekarang, rencana grow
AI       : Untuk growth, pertimbangkan kantor yang bisa scale. Mau co-working space sebagai alternatif yang lebih fleksibel, atau prefer kantor private?
Customer : Private lebih baik untuk focus kerja
AI       : Area mana di Surabaya?
Customer : Surabaya Pusat atau Timur
AI       : Fit-out atau shell?
Customer : Fit-out
AI       : Kapan masuk?
Customer : Bulan depan
AI       : Sewa berapa lama?
Customer : 1 tahun dengan opsi perpanjang
AI       : Parkir diperlukan?
Customer : 2–3 slot cukup
AI       : Siap! Kantor startup Grade B–C 50–80m² di Surabaya Pusat/Timur, fit-out, 2–3 parkir, 10–15 juta/bulan, 1 tahun + opsi extend, masuk bulan depan!
```

---

### CASE S-07 | Sewa Kantor | Butuh Server Room / IT
```
Customer : Cari kantor di Jakarta yang ada server room-nya
AI       : Server room memerlukan persiapan khusus: pendingin dedicated, raised floor, daya listrik tambahan. Ini jarang standar tersedia, tapi beberapa Grade A building punya pre-fitted data room. Di area mana di Jakarta?
Customer : Kuningan atau SCBD
AI       : Tim berapa orang?
Customer : 40 orang
AI       : Estimasi butuh 200–280 m². Budget?
Customer : 60–100 juta per bulan
AI       : Grade gedung?
Customer : A preferred
AI       : Ukuran server room yang dibutuhkan?
Customer : 20–25 m² dengan pendingin khusus
AI       : Kapan masuk?
Customer : 3 bulan lagi
AI       : Sewa berapa lama?
Customer : 3 tahun
AI       : Fit-out untuk area kantor atau shell?
Customer : Fit-out
AI       : Siap! Kantor Grade A 200–280m² + server room 20–25m² di Kuningan/SCBD Jakarta, fit-out, 60–100 juta/bulan, 3 tahun, masuk 3 bulan lagi!
```

---

### CASE S-08 | Sewa Kantor | Pindah dari Co-Working
```
Customer : Sudah 2 tahun di co-working, mau upgrade ke kantor sendiri di Surabaya
AI       : Selamat, bisnis sudah tumbuh! Upgrade ke private office tepat saat tim sudah 10+ orang. Tim Anda sekarang berapa?
Customer : 15 orang, rencana tambah 5 lagi
AI       : Antisipasi 20 orang — butuh sekitar 100–140 m². Budget per bulan?
Customer : 20–35 juta
AI       : Area mana di Surabaya yang paling dekat dengan ekosistem bisnis Anda?
Customer : Surabaya Pusat, biasa nongkrong di area Tunjungan
AI       : Grade gedung?
Customer : B cukup
AI       : Fit-out atau shell?
Customer : Fit-out, tidak mau renovasi
AI       : Kapan masuk?
Customer : 2 bulan lagi
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Parkir?
Customer : 4–5 slot
AI       : Siap! Kantor Grade B 100–140m² di Tunjungan area Surabaya Pusat, fit-out, 4–5 parkir, 20–35 juta/bulan, 2 tahun, masuk 2 bulan lagi!
```

---

### CASE S-09 | Sewa Kantor | Untuk Perwakilan / Branch Office
```
Customer : Kantor pusat kami di Jakarta, mau buka branch di Surabaya
AI       : Ekspansi ke Surabaya! Branch office biasanya butuh representasi yang baik namun tidak perlu se-besar kantor pusat. Tim yang ditempatkan berapa orang?
Customer : 10–12 orang dulu
AI       : Estimasi butuh 60–80 m². Budget per bulan?
Customer : 15–25 juta
AI       : Di area bisnis Surabaya mana yang paling relevan untuk industri Anda?
Customer : Surabaya Pusat, dekat area Tunjungan atau WTC
AI       : Grade gedung?
Customer : B, harus representatif tapi tidak berlebihan
AI       : Fit-out atau shell?
Customer : Fit-out, tidak ada resource untuk renovasi dari jauh
AI       : Kapan mulai?
Customer : 3 bulan lagi
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Parkir?
Customer : 3–4 slot
AI       : Siap! Kantor Grade B 60–80m² di Tunjungan/WTC Surabaya, fit-out, 3–4 parkir, 15–25 juta/bulan, 2 tahun, mulai 3 bulan lagi!
```

---

### CASE S-10 | Sewa Kantor | Ganti-Ganti Keputusan
```
Customer : Mau sewa kantor di Surabaya
AI       : Area mana dan tim berapa orang?
Customer : Surabaya Pusat... tapi Surabaya Barat juga berkembang
AI       : Keduanya punya kelebihan. Pusat lebih accessible, Barat lebih modern dan parkir lebih luas. Budget membantu menentukan — berapa per bulan?
Customer : 20–35 juta
AI       : Tim berapa orang?
Customer : 15... mungkin sampai 20 dalam 6 bulan
AI       : Antisipasi 20 orang — butuh 100–140 m². Grade B?
Customer : Iya grade B
AI       : Fit-out atau shell?
Customer : Fit-out... eh tapi kalau shell lebih murah mungkin bisa renovasi sendiri?
AI       : Shell bisa 20–30% lebih murah per m², tapi ada biaya dan waktu renovasi. Punya resource untuk itu?
Customer : Tidak ada waktu, fit-out aja
AI       : Kapan masuk?
Customer : 2 bulan lagi, mungkin 3
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Siap! Kantor Grade B 100–140m² di Surabaya Pusat/Barat, fit-out, 20–35 juta/bulan, 2 tahun, masuk 2–3 bulan lagi!
```

---

### CASE S-11 | Sewa Kantor | Butuh Parkir Banyak
```
Customer : Cari kantor di Surabaya yang parkirnya banyak, tim sering pakai mobil semua
AI       : Tim dengan banyak kendaraan — parkir jadi prioritas utama. Di area Surabaya mana?
Customer : Surabaya Pusat atau Barat
AI       : Tim berapa orang, dan kira-kira berapa slot parkir yang dibutuhkan?
Customer : 25 orang, minimal 15 slot mobil
AI       : 15 slot itu di atas rata-rata. Lebih mudah didapat di gedung baru di Surabaya Barat. Grade?
Customer : B sudah cukup
AI       : Budget?
Customer : 30–45 juta
AI       : Fit-out atau shell?
Customer : Fit-out
AI       : Kapan masuk?
Customer : 2 bulan
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Siap! Kantor Grade B 125–175m² Surabaya Pusat/Barat, min 15 slot parkir, fit-out, 30–45 juta/bulan, 2 tahun, masuk 2 bulan lagi!
```

---

### CASE S-12 | Sewa Kantor | Tanya Soal Service Charge
```
Customer : Kalau sewa kantor, service charge itu apa dan berapa biasanya?
AI       : Pertanyaan bagus! Service charge (SC) adalah biaya pengelolaan gedung yang dibayar terpisah dari harga sewa. SC mencakup: kebersihan, keamanan, maintenance lift, AC sentral, lobby, dan fasilitas bersama. Di Surabaya, SC Grade B biasanya 30–50 ribu/m²/bulan. Jadi kalau kantor 100 m², SC sekitar 3–5 juta/bulan di luar harga sewa. Sekarang — kantor di mana yang Anda cari?
Customer : Surabaya Pusat, tim 20 orang
AI       : Budget per bulan sudah all-in (sewa + SC)?
Customer : Max 35 juta all-in
AI       : Untuk 100–120 m² Grade B dengan SC, total 35 juta all-in masuk. Grade?
Customer : B
AI       : Fit-out atau shell?
Customer : Fit-out
AI       : Kapan masuk?
Customer : 2 bulan
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Siap! Kantor Grade B 100–120m² di Surabaya Pusat, fit-out, 35 juta/bulan ALL-IN (sewa + SC), 2 tahun, masuk 2 bulan lagi!
```

---

### CASE S-13 | Sewa Kantor | Lantai Atas vs Bawah
```
Customer : Sewa kantor di Surabaya, lebih prefer lantai atas atau bawah ya?
AI       : Tergantung kebutuhan! Lantai atas: prestige, view bagus, lebih tenang, biasanya lebih mahal 5–10%. Lantai bawah: mudah akses, loading lebih gampang, biasanya lebih murah. Untuk tim Anda — lebih ke representasi klien atau operasional sehari-hari?
Customer : Campuran, sering terima klien tapi juga banyak operasional
AI       : Lantai menengah (5–15) biasanya sweet spot. Di area Surabaya mana?
Customer : Surabaya Pusat
AI       : Tim berapa orang?
Customer : 20 orang
AI       : Budget per bulan?
Customer : 25–40 juta
AI       : Grade?
Customer : B
AI       : Fit-out atau shell?
Customer : Fit-out
AI       : Kapan masuk?
Customer : 3 bulan
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Siap! Kantor Grade B 100–140m², lantai menengah (5–15), Surabaya Pusat, fit-out, 25–40 juta/bulan, 2 tahun, masuk 3 bulan lagi!
```

---

### CASE S-14 | Sewa Kantor | Startup Tech
```
Customer : Cari kantor untuk startup tech di Surabaya, butuh yang ada fiber dan kelistrikan bagus
AI       : Startup tech butuh infrastruktur yang solid! Fiber optic dan daya listrik yang stabil adalah kebutuhan utama. Di area mana?
Customer : Surabaya Pusat atau daerah yang ada tech ecosystem-nya
AI       : Area Surabaya Pusat dan Surabaya Timur dekat kampus mulai berkembang untuk tech. Tim berapa orang?
Customer : 12 orang, tapi mau grow ke 25
AI       : Antisipasi 25 — butuh 125–175 m². Budget?
Customer : 20–35 juta
AI       : Grade?
Customer : B
AI       : IT requirement spesifik?
Customer : Fiber minimal 100 Mbps dedicated, UPS backup, dan akses 24 jam
AI       : Kapan masuk?
Customer : 2 bulan
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Siap! Kantor Grade B 125–175m² di Surabaya Pusat/Timur, fiber dedicated 100Mbps + UPS + akses 24 jam, 20–35 juta/bulan, 2 tahun, masuk 2 bulan lagi!
```

---

### CASE S-15 | Sewa Kantor | WA Singkat
```
Customer : sewa kantor surabaya 15 org grade B
AI       : Area & budget/bln?
Customer : pusat, 20-30jt
AI       : Fit-out & kapan masuk?
Customer : fit-out, 2 bln
AI       : Berapa lama?
Customer : 2 tahun
AI       : Siap! Kantor Grade B ~75–105m² Surabaya Pusat, fit-out, 20–30jt/bln, 2 tahun, masuk 2 bulan lagi!
```

---

## ═══════════════════════════════════════
## BAGIAN B: BELI KANTOR (20 CASE)
## ═══════════════════════════════════════

---

### CASE B-01 | Beli Kantor | Normal / Lengkap
```
Customer : Mau beli unit kantor di Surabaya
AI       : Siap! Untuk dipakai sendiri atau investasi disewakan?
Customer : Dipakai sendiri, kantor perusahaan
AI       : Di area Surabaya mana? Dan tim berapa orang?
Customer : Surabaya Pusat, tim 30 orang
AI       : Estimasi butuh 150–200 m². Budget pembelian?
Customer : 3–5 miliar
AI       : KPR komersial atau cash?
Customer : KPR komersial
AI       : Grade gedung yang diinginkan?
Customer : B
AI       : Fit-out (sudah jadi) atau shell?
Customer : Fit-out
AI       : Target beli kapan?
Customer : 4 bulan
AI       : Parkir: berapa slot dibutuhkan?
Customer : 6–8 slot
AI       : Siap! Unit kantor Grade B 150–200m² di Surabaya Pusat, fit-out, 6–8 parkir, 3–5 M, KPR komersial, target 4 bulan!
```

---

### CASE B-02 | Beli Kantor | Malas Ketik
```
Customer : beli unit kantor surabaya invest
AI       : Area & budget?
Customer : pusat, 2-3M
AI       : Luas & grade?
Customer : 100m2, grade B
AI       : Cash/KPR & target?
Customer : cash, 3 bln
AI       : Siap! Unit kantor Grade B 100m² Surabaya Pusat, 2–3M, cash, target 3 bulan, investasi!
```

---

### CASE B-03 | Beli Kantor | Info Terbatas / Ambigu
```
Customer : mau beli kantor yang representatif di Surabaya
AI       : Untuk dipakai sendiri atau investasi?
Customer : Dipakai sendiri, bisnis ekspor-impor
AI       : Bisnis ekspor-impor — lokasinya dekat pelabuhan atau CBD lebih relevan?
Customer : CBD, sering terima buyer asing
AI       : CBD Surabaya: area sekitar Tunjungan, Basuki Rahmat, Pemuda. Budget?
Customer : 3–6 miliar
AI       : Tim berapa orang?
Customer : 25 orang
AI       : Grade A atau B?
Customer : A lebih representatif untuk klien asing
AI       : KPR atau cash?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Fit-out atau shell?
Customer : Fit-out
AI       : Siap! Unit kantor Grade A 125–175m² di CBD Tunjungan/Basuki Rahmat Surabaya, fit-out, 3–6M, cash, target 4 bulan!
```

---

### CASE B-04 | Beli Kantor | Tanya Harga Duluan
```
Customer : Harga unit kantor di Surabaya Pusat berapa?
AI       : Di Surabaya Pusat, unit kantor Grade B mulai 25–50 juta per m² tergantung gedung dan lantai. Grade A bisa 50–80 juta/m². Luas yang Anda butuhkan?
Customer : Sekitar 150 m²
AI       : Estimasi 150 m² Grade B = 3,75–7,5 M. Budget?
Customer : 3–5 miliar
AI       : Masuk untuk Grade B. Untuk dipakai atau investasi?
Customer : Dipakai sendiri
AI       : Tim berapa orang?
Customer : 25 orang
AI       : KPR atau cash?
Customer : KPR
AI       : Target?
Customer : 4 bulan
AI       : Fit-out?
Customer : Fit-out
AI       : Siap! Unit kantor Grade B 150m² Surabaya Pusat, fit-out, 3–5M, KPR komersial, target 4 bulan!
```

---

### CASE B-05 | Beli Kantor | Marah / Frustrasi
```
Customer : Sudah 5 bulan cari unit kantor di Jakarta CBD, selalu ada masalah — developer tidak transparan soal biaya atau unit sudah sold tapi masih diiklankan!
AI       : Pengalaman yang sangat mengecewakan dan sayangnya terjadi. Saya akan pastikan dari sini semua informasi transparan — harga sudah final, unit benar-benar tersedia. Di area mana di Jakarta yang Anda targetkan?
Customer : Sudirman atau Kuningan
AI       : Budget yang sudah siap?
Customer : 5–8 miliar
AI       : Tim berapa orang?
Customer : 40 orang
AI       : Grade A atau B?
Customer : B, yang penting real tersedia
AI       : Cash atau KPR?
Customer : Cash, sudah siap
AI       : Target seberapa cepat?
Customer : Secepat mungkin
AI       : Siap! Saya cari unit kantor Grade B ~200–280m² di Sudirman/Kuningan, 5–8M, cash — dan saya HANYA tunjukkan yang BENAR-BENAR tersedia, tidak ada phantom listing!
```

---

### CASE B-06 hingga B-20 | Variasi Kondisi Beli Kantor

**B-06 | Ganti Keputusan**
```
Customer : Mau beli unit kantor di Surabaya
AI       : Area mana dan untuk apa?
Customer : Surabaya Pusat untuk usaha... tapi invest juga oke
AI       : Budget?
Customer : 2–4 miliar
AI       : Grade?
Customer : B
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 3 bulan
AI       : Luas untuk tim berapa orang?
Customer : 15 orang sekarang
AI       : Siap! Unit kantor Grade B ~75–105m² Surabaya Pusat, 2–4M, cash, target 3 bulan!
```

**B-07 | First Time Buyer**
```
Customer : Pertama kali mau beli unit kantor, apa yang harus diperhatikan?
AI       : Hal utama yang harus dicek saat beli unit kantor: (1) Status kepemilikan — SHMSRS atau Strata Title untuk unit, (2) Service charge yang akan dikenakan setelah beli, (3) Reputasi pengelola gedung, (4) Rasio parkir yang tersedia, (5) Kondisi lift dan infrastruktur gedung. Sudah ada gedung tertentu yang Anda pertimbangkan?
Customer : Belum, cari di Surabaya Pusat
AI       : Budget?
Customer : 2–3 miliar
AI       : Tim berapa orang?
Customer : 12 orang
AI       : Cash atau KPR?
Customer : KPR
AI       : Target?
Customer : 4 bulan
AI       : Siap! Unit kantor Grade B ~60–85m² Surabaya Pusat, 2–3M, KPR komersial, target 4 bulan. Saya bantu juga cek semua hal penting sebelum beli!
```

**B-08 | Investasi Murni**
```
Customer : Mau beli unit kantor di Surabaya untuk investasi disewakan
AI       : Kantor untuk disewakan — yield di Surabaya berapa ekspektasi Anda?
Customer : Kalau bisa 8–10% per tahun
AI       : Untuk yield 8–10%, area Surabaya Pusat Grade B adalah yang paling realistis. Budget?
Customer : 2–4 miliar
AI       : Luas unit?
Customer : 100–150 m²
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 3 bulan
AI       : Siap! Unit kantor Grade B 100–150m² Surabaya Pusat, 2–4M, cash, target 3 bulan, investasi yield 8–10%!
```

**B-09 | Butuh Lantai Tinggi**
```
Customer : Mau beli unit kantor lantai tinggi di Surabaya, untuk view dan prestise
AI       : Pilihan untuk representasi premium! Area mana?
Customer : Surabaya Pusat, gedung tinggi
AI       : Budget?
Customer : 4–7 miliar
AI       : Luas untuk tim berapa?
Customer : 200 m², tim 35 orang
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Siap! Unit kantor Grade A/B lantai tinggi 200m² Surabaya Pusat, view kota, 4–7M, cash, target 4 bulan!
```

**B-10 | WA Singkat**
```
Customer : beli unit kantor jakarta sudirman 150m grade A cash 6M
AI       : Target & tujuan?
Customer : 3 bln, pakai sendiri
AI       : Fit-out atau shell?
Customer : fit-out
AI       : Siap! Unit kantor Grade A 150m² Sudirman Jakarta, fit-out, 6M, cash, target 3 bulan!
```

**B-11 | Gedung Milik Sendiri**
```
Customer : Mau beli gedung kantor sendiri, bukan unit
AI       : Ambisi besar! Beli seluruh gedung atau ruko yang dikonversi menjadi kantor? Di kota mana?
Customer : Surabaya, beli gedung kecil
AI       : Budget?
Customer : 10–20 miliar
AI       : Berapa lantai dan luas total?
Customer : 4–5 lantai, total sekitar 1.000–1.500 m²
AI       : Cash atau KPR komersial?
Customer : Cash
AI       : Target?
Customer : 6 bulan
AI       : Untuk dipakai sendiri semua atau sebagian disewakan?
Customer : Lantai 1–2 pakai sendiri, atas disewakan
AI       : Siap! Gedung kantor 4–5 lantai ~1.000–1.500m² di Surabaya, 10–20M, cash, target 6 bulan, sebagian untuk usaha sendiri sebagian disewakan!
```

**B-12 | Tanya Perbandingan Sewa vs Beli**
```
Customer : Lebih baik sewa atau beli kantor untuk startup?
AI       : Pertanyaan strategis! Sewa lebih baik jika: cashflow masih ketat, rencana bisnis masih sering berubah, atau butuh fleksibilitas. Beli lebih baik jika: bisnis sudah stabil, cashflow kuat, dan butuh aset. Untuk startup yang masih growth stage, biasanya sewa dulu lebih disarankan karena lebih fleksibel dan tidak mengikat modal. Tapi kalau ada modal idle, beli bisa lebih baik jangka panjang. Bisnis Anda sudah berapa lama?
Customer : 3 tahun, mulai stabil
AI       : Sudah masuk fase beli yang lebih layak. Budget?
Customer : 2–3 miliar
AI       : Di kota mana?
Customer : Surabaya
AI       : Cash atau KPR?
Customer : KPR
AI       : Tim berapa orang?
Customer : 20 orang
AI       : Siap! Unit kantor Grade B ~100–140m² Surabaya, 2–3M, KPR komersial, target 4 bulan!
```

**B-13 | Untuk Klinik / Medis**
```
Customer : Mau beli unit kantor untuk klinik spesialis di Surabaya
AI       : Unit kantor untuk klinik spesialis — perlu beberapa penyesuaian izin dari peruntukan komersial ke medis. Di area mana?
Customer : Surabaya Pusat, dekat RS
AI       : Budget?
Customer : 3–5 miliar
AI       : Luas?
Customer : 150–200 m²
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Perlu ruangan khusus? (Lab, ruang perawatan, dll)
Customer : Ruang konsultasi 3 dokter + ruang tunggu + resepsionis
AI       : Siap! Unit kantor 150–200m² dekat RS di Surabaya Pusat, 3–5M, cash, target 4 bulan. Saya bantu juga cek peruntukan untuk klinik!
```

**B-14 | Cicilan vs Cash**
```
Customer : Beli unit kantor 3 miliar dengan KPR, cicilan berapa?
AI       : Simulasi KPR komersial kantor 3 M: DP 30–40% = 900 juta–1,2 M. Pokok pinjaman 1,8–2,1 M. Bunga 9–10%/tahun, tenor 10–15 tahun. Estimasi cicilan 18–23 juta/bulan. Sesuai cashflow bisnis Anda?
Customer : Agak berat. Bisa dapat unit lebih murah?
AI       : Budget maksimal cicilan per bulan berapa?
Customer : 15 juta
AI       : Untuk cicilan 15 juta, target pembelian sekitar 2–2,3 M. Di kota mana?
Customer : Surabaya
AI       : Area mana?
Customer : Surabaya Pusat
AI       : Luas dan tim berapa orang?
Customer : 20 orang, sekitar 100 m²
AI       : Target?
Customer : 4 bulan
AI       : Siap! Unit kantor Grade B ~100m² Surabaya Pusat, 2–2,3M, KPR komersial, cicilan ~15 juta/bulan, target 4 bulan!
```

**B-15 | Investasi di Kota Berkembang**
```
Customer : Mau investasi unit kantor, mana yang paling potensial di luar Jakarta Surabaya?
AI       : Untuk luar Jakarta-Surabaya, kota dengan perkembangan kantor terbaik saat ini: Medan (gateway Sumatera), Makassar (gateway Indonesia Timur), Balikpapan (gateway Kalimantan IKN), dan Semarang. Mana yang paling menarik?
Customer : Balikpapan, dekat IKN menarik
AI       : Sangat strategis! Budget?
Customer : 2–4 miliar
AI       : Cash atau KPR?
Customer : Cash
AI       : Luas?
Customer : 100–150 m²
AI       : Target?
Customer : 6 bulan
AI       : Siap! Unit kantor di Balikpapan (area dekat IKN), 100–150m², 2–4M, cash, target 6 bulan!
```

**B-16 | Untuk Pendidikan / Lembaga Kursus**
```
Customer : Mau beli unit kantor/ruangan untuk lembaga kursus di Surabaya
AI       : Unit untuk lembaga kursus — perlu ruangan yang bisa dipartisi menjadi beberapa kelas. Budget?
Customer : 2–3,5 miliar
AI       : Luas?
Customer : 150–200 m², mau dibuat 4–5 ruang kelas kecil
AI       : Area mana?
Customer : Surabaya Pusat atau Timur, dekat kampus
AI       : Cash atau KPR?
Customer : KPR
AI       : Target?
Customer : 4 bulan
AI       : Siap! Unit 150–200m² di Surabaya Pusat/Timur (dekat kampus), 2–3,5M, KPR, target 4 bulan — layout bisa dipartisi jadi kelas!
```

**B-17 | Tanya Tentang Strata Title**
```
Customer : Beli unit kantor, harus cek apa soal sertifikat?
AI       : Untuk unit kantor, sertifikat yang benar adalah SHMSRS (Sertifikat Hak Milik atas Satuan Rumah Susun) atau HGBSRS. Cek: (1) Sertifikat atas nama developer sebelum akad, (2) IMB gedung sudah ada, (3) SLF (Sertifikat Laik Fungsi) sudah keluar, (4) Tidak ada sengketa. Mau saya bantu verifikasi untuk unit yang Anda pertimbangkan?
Customer : Iya bantu, ada unit di Surabaya Pusat yang menarik
AI       : Budget?
Customer : 2,5–4 miliar
AI       : Luas?
Customer : 120–150 m²
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 3 bulan
AI       : Siap! Saya bantu verifikasi legalitas dan carikan unit kantor Grade B 120–150m² Surabaya Pusat, 2,5–4M, cash, target 3 bulan!
```

**B-18 | Portofolio Multi-Unit**
```
Customer : Sudah punya 2 unit kantor di Surabaya, mau beli 2 lagi di lantai yang sama untuk expand
AI       : Strategi yang bagus — konsolidasi lantai atau gedung yang sama. Gedung mana yang sudah Anda miliki?
Customer : Di gedung WTC Surabaya, lantai 12
AI       : Apakah ada unit yang tersedia di lantai yang sama?
Customer : Ini yang saya mau tanyakan
AI       : Saya bisa cek ketersediaan unit di lantai 12 WTC Surabaya. Budget untuk 2 unit tambahan?
Customer : 4–6 miliar total
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 3 bulan
AI       : Siap! Saya cek ketersediaan unit di lantai 12 WTC Surabaya, budget 4–6M total (2 unit), cash, target 3 bulan!
```

**B-19 | Butuh Unit yang Bisa Dimodifikasi**
```
Customer : Mau beli unit kantor yang bisa dimodifikasi layout-nya secara bebas
AI       : Berarti perlu unit shell & core atau semi-fitted yang partisinya fleksibel. Di kota mana?
Customer : Surabaya
AI       : Budget?
Customer : 3–5 miliar
AI       : Luas?
Customer : 200 m²
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Untuk tim berapa orang?
Customer : 40 orang, mau layout terbuka
AI       : Siap! Unit kantor shell/semi-fitted 200m² di Surabaya, 3–5M, cash, target 4 bulan — layout bebas untuk open-plan 40 orang!
```

**B-20 | WA Singkat**
```
Customer : beli kantor sby 100m grade B 2.5M cash invest
AI       : Area & target?
Customer : pusat, 3 bln
AI       : Fit-out/shell?
Customer : fit-out
AI       : Siap! Unit kantor Grade B 100m² Surabaya Pusat, fit-out, 2,5M, cash, target 3 bulan, investasi!
```

---
*File: 07_SKILL_OFFICE_KANTOR.md | Elevan Property Chatbot Skills v1.0*

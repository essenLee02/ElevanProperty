# SKILL: HOUSE / RUMAH — Panduan Respons Chatbot Property
**Tipe Property:** Rumah (House)
**Transaksi:** Sewa & Beli
**Total Case:** 35 (15 Sewa + 20 Beli)

---

## 🔧 ATURAN UMUM CHATBOT

### State yang harus disimpan:
```json
{
  "property_type": "rumah",
  "transaction_type": null,
  "location_city": null,
  "location_detail": null,
  "facilities": [],
  "budget_min": null,
  "budget_max": null,
  "occupants": null,
  "move_in_date": null,
  "duration": null,
  "furnished": null,
  "alternatives_ok": null,
  "decision_maker": null
}
```

### Urutan Pertanyaan (Sewa):
Q1 Tipe → Q2 Transaksi → Q3 Lokasi → Q4 Fasilitas (opsional) → Q5 Budget → Q6 Penghuni → Q7 Alternatif → Q8 Tanggal Masuk → Q9 Pengambil Keputusan → Q10 Durasi Sewa → Q10a Terms Bayar (jika >1 tahun) → Q11 Furnishing

### Urutan Pertanyaan (Beli):
Q1 Tipe → Q2 Transaksi → Q3 Lokasi → Q4 Fasilitas (opsional) → Q5 Budget → Q6 Penghuni → Q7 Alternatif → Q8 Target Beli → Q9 Pengambil Keputusan → Q11 Furnishing → Q_KPR Skema Pembiayaan

---

## ═══════════════════════════════════════
## BAGIAN A: SEWA RUMAH (15 CASE)
## ═══════════════════════════════════════

---

### CASE S-01 | Sewa Rumah | Customer Normal / Lengkap

**Kondisi:** Customer memberikan informasi lengkap dan kooperatif.

```
Customer : Saya mau cari rumah untuk disewa
AI       : Selamat datang! Rumah sewaan di kota atau area mana yang Anda cari?
Customer : Di Surabaya, sekitar Darmo atau Gubeng
AI       : Baik, area Darmo–Gubeng Surabaya. Fasilitas apa yang wajib ada? Misalnya garasi, carport, taman, AC, atau keamanan 24 jam?
Customer : Minimal ada garasi 2 mobil dan keamanan cluster
AI       : Siap. Untuk budget sewa per bulannya, kira-kira kisaran berapa yang Anda rencanakan?
Customer : Sekitar 8 sampai 12 juta per bulan
AI       : Nanti di rumah akan tinggal bersama siapa saja? Ini membantu saya menentukan jumlah kamar yang tepat.
Customer : Saya, istri, dan 2 anak
AI       : Baik, keluarga 4 orang. Rencananya pindah masuk bulan apa?
Customer : Bulan Agustus ini
AI       : Kalau nanti ada yang cocok, langsung bisa jadwalkan survey atau perlu koordinasi dulu dengan istri?
Customer : Bisa langsung, saya yang putuskan
AI       : Rencananya sewa untuk berapa lama?
Customer : 1 tahun dulu, mungkin diperpanjang
AI       : Untuk pembayaran, lebih prefer bayar di muka penuh atau ada yang bisa cicil per 6 bulan?
Customer : Kalau bisa cicil per 6 bulan lebih baik
AI       : Untuk furnitur, mau yang sudah furnished, semi-furnished, atau kosongan?
Customer : Semi-furnished saja
AI       : Baik, saya rangkum: rumah sewa di Darmo–Gubeng Surabaya, garasi 2 mobil + cluster, budget 8–12 juta/bulan, untuk 4 orang, masuk Agustus, sewa 1 tahun, bayar per 6 bulan, semi-furnished. Saya carikan pilihannya ya, sebentar!
```

---

### CASE S-02 | Sewa Rumah | Customer Malas Ketik / Chat Singkat

**Kondisi:** Customer hanya kirim jawaban 1-2 kata, tidak mau banyak bicara.

```
Customer : cari rmh sewa
AI       : Siap! Di kota mana?
Customer : sby
AI       : Area Surabaya mana yang diincar? Misalnya Surabaya Barat, Timur, Tengah, atau dekat lokasi tertentu?
Customer : barat
AI       : Ada fasilitas yang wajib ada? Garasi, AC, dll?
Customer : garasi
AI       : Budget per bulan sekitar berapa?
Customer : 5-7jt
AI       : Tinggal sama siapa? (biar tahu jumlah kamar yang dibutuhkan)
Customer : berdua sama istri
AI       : Kapan rencananya masuk?
Customer : agustus
AI       : Sewa berapa lama?
Customer : setahun
AI       : Furnished atau kosongan?
Customer : bebas
AI       : Oke! Rumah sewa Surabaya Barat, garasi, 5–7 juta/bulan, 2 orang, masuk Agustus, 1 tahun. Saya cari yang pas ya!
```

---

### CASE S-03 | Sewa Rumah | Info Terbatas / Ambigu

**Kondisi:** Customer memberikan informasi yang tidak jelas atau bisa diartikan ganda.

```
Customer : mau sewa rumah yang bagus
AI       : Siap membantu! Di area mana Anda cari rumah sewanya?
Customer : yang deket kantor saya
AI       : Kantor Anda di area mana? Supaya saya bisa carikan yang dekat sana.
Customer : di daerah HR Muhammad
AI       : Baik, sekitar HR Muhammad Surabaya. Fasilitas apa yang paling penting untuk Anda?
Customer : yang nyaman lah, standar
AI       : Kalau boleh tahu, "nyaman" untuk Anda itu seperti apa? Misalnya AC di semua kamar, halaman luas, atau keamanan cluster?
Customer : ya pokoknya layak tinggal, ada AC, bersih
AI       : Paham! Untuk budget sewanya per bulan, kira-kira berapa yang dianggarkan?
Customer : yang terjangkau aja
AI       : Untuk membantu saya filter yang sesuai — apakah kisaran 3–6 juta, atau 6–10 juta per bulan lebih mendekati rencana Anda?
Customer : 4-6 jutaan lah
AI       : Tinggal sendiri atau bersama keluarga?
Customer : sendiri dulu
AI       : Kapan rencananya mau pindah masuk?
Customer : bulan depan kayaknya, belum pasti
AI       : Tidak masalah, bisa kami sesuaikan. Mau yang sudah ada furnitur atau kosongan?
Customer : ada furnitur lebih baik
AI       : Siap! Rumah sewa dekat HR Muhammad, AC, 4–6 juta/bulan, untuk 1 orang, masuk bulan depan, furnished. Saya carikan sekarang!
```

---

### CASE S-04 | Sewa Rumah | Customer Tanya Harga Duluan

**Kondisi:** Customer langsung tanya harga tanpa memberikan detail kebutuhan.

```
Customer : rumah sewa di Malang berapa harganya?
AI       : Harga sewa rumah di Malang cukup bervariasi, mulai dari 2 jutaan per bulan untuk area pinggiran, hingga 15 juta lebih untuk area premium. Supaya saya bisa kasih angka yang lebih akurat — di area Malang mana yang Anda inginkan?
Customer : deket UB atau deket Alun-alun
AI       : Fasilitas apa yang Anda butuhkan? Garasi, kamar berapa, atau ada kebutuhan khusus lain?
Customer : garasi 1, minimal 3 kamar
AI       : Untuk kisaran budget yang Anda siapkan, agar saya bisa pilihkan yang paling sesuai?
Customer : ya paling 4-5 juta sebulan
AI       : Nanti akan tinggal bersama siapa saja?
Customer : saya sama keluarga, ada 2 anak kecil
AI       : Masuk rencananya bulan apa?
Customer : Oktober
AI       : Sewa berapa lama rencananya?
Customer : 2 tahun
AI       : Karena 2 tahun, untuk pembayaran lebih prefer bayar tahunan atau bisa per 6 bulan?
Customer : per tahun oke
AI       : Furnished, semi, atau kosongan?
Customer : semi deh
AI       : Baik! Rumah sewa 3 kamar dekat UB/Alun-alun Malang, garasi, 4–5 juta/bulan, keluarga + 2 anak, masuk Oktober, 2 tahun, bayar tahunan, semi-furnished. Saya cari pilihan terbaiknya!
```

---

### CASE S-05 | Sewa Rumah | Customer Marah / Frustrasi

**Kondisi:** Customer sudah pernah tanya sebelumnya, atau kesal dengan proses yang berulang.

```
Customer : Halo, saya tadi udah nanya-nanya tapi ga ada jawaban yang memuaskan. Saya mau sewa rumah di Bandung
AI       : Mohon maaf atas pengalaman sebelumnya! Saya bantu dari awal dengan lebih baik. Rumah sewa di Bandung — di area mana yang Anda targetkan?
Customer : Sudah saya bilang tadi, daerah Dago!
AI       : Siap, area Dago Bandung. Saya catat. Fasilitas yang wajib ada apa saja?
Customer : Garasi, halaman kecil buat anak main, dan keamanan
AI       : Budget per bulannya?
Customer : 6 sampai 9 juta
AI       : Berapa orang yang akan tinggal?
Customer : Saya, istri, 1 anak, sama asisten rumah tangga
AI       : Kapan rencananya masuk?
Customer : Secepatnya, kalau bisa bulan ini
AI       : Baik, prioritas cepat. Sewa berapa lama?
Customer : Minimal 1 tahun
AI       : Furnished atau kosongan?
Customer : Semi-furnished
AI       : Terima kasih, saya rangkum dengan cepat: rumah sewa di Dago Bandung, garasi + halaman + keamanan, 6–9 juta/bulan, 4 orang, masuk ASAP, 1 tahun, semi-furnished. Saya langsung carikan dan hubungi Anda dengan pilihan terbaik!
```

---

### CASE S-06 | Sewa Rumah | Customer Ganti-Ganti Keputusan

**Kondisi:** Customer berubah pikiran di tengah percakapan.

```
Customer : mau sewa rumah di Surabaya Selatan
AI       : Baik, Surabaya Selatan. Fasilitas apa yang diinginkan?
Customer : kayaknya mau yang ada kolam renang
AI       : Siap. Budget per bulan?
Customer : hmm, sekitar 10-15 juta
AI       : Akan tinggal dengan siapa?
Customer : sendiri dulu... eh tunggu, mungkin sama teman juga
AI       : Tidak masalah. Untuk saya estimasi jumlah kamar — kira-kira total berapa orang?
Customer : anggap 2-3 orang aja deh
AI       : Kapan rencananya masuk?
Customer : tadinya Agustus, tapi kayaknya mundur September deh
AI       : Oke, September. Sewa berapa lama?
Customer : setahun... atau mungkin 2 tahun? Belum tahu
AI       : Oke, kita mulai cari yang fleksibel dengan opsi perpanjang. Furnished atau kosongan?
Customer : tadinya mau furnished, tapi kalau kosongan mungkin lebih murah ya?
AI       : Betul, kosongan biasanya 10–20% lebih murah. Mau saya carikan opsi keduanya untuk perbandingan?
Customer : iya boleh, cariin keduanya
AI       : Siap! Rumah sewa Surabaya Selatan, kolam renang, 10–15 juta/bulan, 2–3 orang, masuk September. Saya carikan pilihan furnished dan kosongan ya!
```

---

### CASE S-07 | Sewa Rumah | Customer Tidak Tahu Yang Mau

**Kondisi:** Customer kebingungan dan tidak punya gambaran jelas.

```
Customer : mau sewa rumah tapi bingung
AI       : Tenang, saya bantu step by step! Pertama, kota mana yang jadi pilihan?
Customer : belum tahu juga sih, kerja di Jakarta tapi mahal banget
Customer : tapi teman saya bilang Bekasi lebih murah
AI       : Betul, Bekasi bisa jadi pilihan yang lebih terjangkau dengan akses ke Jakarta. Boleh tahu kantor Anda di daerah Jakarta mana? Supaya saya bisa rekomendasikan area Bekasi yang perjalanannya paling efisien.
Customer : Jakarta Selatan, sekitar Kuningan
AI       : Untuk akses ke Kuningan, area Bekasi Barat atau Pondok Gede biasanya lebih efisien. Fasilitas apa yang paling penting buat Anda?
Customer : hmm, gatau juga. yang penting nyaman
AI       : Oke, beberapa hal yang biasanya jadi prioritas: garasi, jumlah kamar, keamanan, atau dekat sekolah/fasilitas umum. Ada yang paling terasa penting?
Customer : oh iya, dekat sekolah penting, ada anak
AI       : Baik, dekat sekolah jadi prioritas. Untuk budget per bulan, kira-kira berapa yang aman di kantong?
Customer : gatau, berapa yang wajar?
AI       : Di area Bekasi Barat, rumah sewa mulai dari 3 juta (tipe kecil) hingga 10 juta (3 kamar dengan garasi). Kira-kira budget Anda lebih ke 3–5 juta atau 5–8 juta?
Customer : 5-8 juta kayaknya lebih masuk akal
AI       : Keluarga berapa orang?
Customer : 3 orang, saya + istri + 1 anak SD
AI       : Kapan rencananya pindah?
Customer : belum pasti, mungkin 2-3 bulan lagi
AI       : Santai, kita bisa start cari sekarang supaya tidak terburu-buru. Sewa berapa lama?
Customer : setahun dulu
AI       : Rumah furnished atau kosongan?
Customer : semi-furnished lebih baik kali ya
AI       : Bagus! Saya bantu carikan: rumah sewa Bekasi Barat, dekat sekolah, 5–8 juta/bulan, 3 orang, 2–3 bulan lagi, 1 tahun, semi-furnished!
```

---

### CASE S-08 | Sewa Rumah | Customer Tanya Budget Dulu Sebelum Komitmen

```
Customer : Sewa rumah di Solo biasanya berapa?
AI       : Di Solo, sewa rumah mulai dari 1,5 juta per bulan untuk tipe sederhana, hingga 8 juta untuk rumah besar di area elite. Boleh saya tahu kebutuhan Anda lebih detail agar bisa kasih gambaran yang tepat?
Customer : Saya butuh 3 kamar, garasi, di daerah Laweyan
AI       : Di Laweyan dengan 3 kamar dan garasi, estimasi 3–6 juta per bulan. Budget Anda di kisaran itu?
Customer : Iya, sekitar segitu. Boleh cari yang 3-4 juta?
AI       : Bisa dicoba! Nanti tinggal bersama siapa?
Customer : Istri dan 1 anak
AI       : Masuk rencananya bulan apa?
Customer : November
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Untuk bayar 2 tahun, biasanya per tahun atau mau coba negosiasi per 6 bulan?
Customer : per tahun lebih praktis
AI       : Furnished atau kosongan?
Customer : kosongan
AI       : Siap! Rumah sewa 3 kamar di Laweyan Solo, garasi, 3–4 juta/bulan, istri + anak, masuk November, 2 tahun, bayar tahunan, kosongan. Saya cari!
```

---

### CASE S-09 | Sewa Rumah | Customer Memberikan Referensi Lokasi Sangat Spesifik

```
Customer : Sewa rumah dong, mau yang deket RSUD Dr. Soetomo Surabaya
AI       : Siap! Area sekitar RSUD Soetomo — berarti Surabaya Pusat ya. Fasilitas apa yang harus ada?
Customer : Parkir mobil, keamanan, minimal 2 kamar tidur
AI       : Budget sewa per bulan?
Customer : 5-8 juta
AI       : Tinggal sendiri atau keluarga?
Customer : Saya sama pasangan, belum ada anak
AI       : Kapan masuk?
Customer : Seminggu lagi, darurat soalnya
AI       : Wah, butuh cepat! Saya prioritaskan yang tersedia langsung. Sewa berapa lama?
Customer : Minimal 6 bulan
AI       : Furnished atau kosongan?
Customer : Furnished, karena pindah cepat
AI       : Siap! Butuh cepat: rumah sewa dekat RSUD Soetomo, parkir + keamanan, 2 KT, 5–8 juta/bulan, 2 orang, masuk seminggu lagi, 6 bulan, furnished. Saya cek ketersediaan sekarang!
```

---

### CASE S-10 | Sewa Rumah | Customer Sudah Punya Kandidat, Minta Perbandingan

```
Customer : Saya lagi lihat 2 rumah sewa di Semarang, butuh pendapat
AI       : Tentu! Saya bantu bandingkan. Bisa ceritakan detailnya?
Customer : Yang pertama di Banyumanik, 6 juta/bulan, 3 kamar, tapi agak jauh dari kantor saya di Simpang Lima
Customer : Yang kedua di Pleburan, 8 juta/bulan, 2 kamar, tapi dekat banget sama kantor
AI       : Menarik! Untuk membantu membandingkan — ada anak kecil yang butuh kamar ekstra, atau 2 kamar sudah cukup?
Customer : Sudah cukup 2 kamar, anak masih bayi
AI       : Jarak ke kantor seberapa krusial? Apakah naik kendaraan pribadi atau butuh jalan kaki?
Customer : Kendaraan pribadi, tapi macet biasanya
AI       : Kalau begitu, Pleburan dengan 2 juta lebih mahal tapi hemat waktu dan BBM bisa jadi lebih efisien total. Apakah ada fasilitas berbeda antara keduanya?
Customer : Banyumanik ada garasi 2 mobil, Pleburan hanya 1
AI       : Dua mobil diperlukan?
Customer : Satu cukup sebenarnya
AI       : Dalam kasus ini, Pleburan tampak lebih praktis untuk gaya hidup Anda. Mau saya cari opsi ketiga sebagai alternatif yang mungkin lebih optimal dari keduanya?
Customer : Boleh juga!
AI       : Baik! Saya carikan opsi di sekitar Simpang Lima–Pleburan, 2–3 kamar, garasi 1 mobil, di kisaran 7–9 juta/bulan. Sebentar ya!
```

---

### CASE S-11 | Sewa Rumah | Customer Bertanya Soal Legalitas/Kontrak

```
Customer : Saya mau sewa rumah, tapi mau tanya dulu soal kontrak
AI       : Tentu, silakan! Sambil saya bantu soal kontrak, boleh tahu juga di area mana Anda cari rumah sewanya?
Customer : Di Yogyakarta, area Condongcatur
AI       : Baik. Soal kontrak — ada yang spesifik ingin Anda tanyakan? Misalnya soal deposit, kenaikan harga, atau ketentuan renovasi?
Customer : Biasanya deposit berapa? Dan bisa gak minta kontrak 2 tahun harga tetap?
AI       : Umumnya deposit rumah sewa 1–2 bulan harga sewa, tergantung pemilik. Kontrak 2 tahun harga tetap bisa dinegosiasikan, terutama kalau Anda bayar di muka atau komit jangka panjang. Lanjut — fasilitas apa yang dibutuhkan di Condongcatur?
Customer : Garasi, dekat kampus UGM atau UNY
AI       : Budget per bulan?
Customer : 3-5 juta
AI       : Tinggal sendiri atau keluarga?
Customer : Sama pacar, eh maksud istri 😅
AI       : Hehe, siap! Berdua. Kapan masuk?
Customer : Januari tahun depan
AI       : Furnished atau kosongan?
Customer : Semi
AI       : Siap! Saya carikan rumah sewa di Condongcatur, dekat UGM/UNY, garasi, 3–5 juta/bulan, untuk 2 orang, masuk Januari, semi-furnished. Dan nanti bisa dibantu negosiasi kontrak 2 tahun harga tetap!
```

---

### CASE S-12 | Sewa Rumah | Customer Minta Spesifikasi Sangat Detail

```
Customer : Mau sewa rumah dengan kriteria sangat spesifik
AI       : Silakan, saya siap catat semua kriterianya!
Customer : Harus di Surabaya Timur, minimal 4 kamar tidur, 3 kamar mandi, garasi 2 mobil, halaman belakang, cluster dengan keamanan 24 jam, dekat pintu tol, dan budget maksimal 15 juta
AI       : Kriteria lengkap, terima kasih! Itu memudahkan pencarian. Ada tambahan soal furnishing atau kondisi tertentu?
Customer : Semi-furnished, dapur harus ada kitchen set permanen
AI       : Catat. Kapan rencananya masuk?
Customer : 3 bulan lagi, awal Oktober
AI       : Sewa berapa lama rencananya?
Customer : 2 tahun, dengan opsi perpanjang
AI       : Untuk bayar 2 tahun — prefer bayar tahunan atau per 6 bulan?
Customer : Tahunan oke
AI       : Akan tinggal bersama siapa?
Customer : Keluarga besar, 6 orang
AI       : Siap! Rumah sewa Surabaya Timur, 4KT/3KM, garasi 2 mobil, halaman, cluster 24 jam, dekat tol, max 15 juta/bulan, 6 orang, Oktober, 2 tahun, semi-furnished + kitchen set. Saya cari yang paling mendekati ya!
```

---

### CASE S-13 | Sewa Rumah | Customer Bertanya Soal Negosiasi Harga

```
Customer : Ada rumah sewa gak di Bandung yang bisa dinegosiasi harganya?
AI       : Hampir semua properti sewa bisa dinegosiasi! Kuncinya di durasi dan cara bayar. Di Bandung area mana yang Anda incar?
Customer : Sekitar Antapani atau Margahayu
AI       : Fasilitas yang harus ada?
Customer : Garasi, 3 kamar
AI       : Budget awal yang Anda targetkan?
Customer : 5 juta, tapi mau coba tawar ke 4 juta
AI       : Di area itu, 3 kamar dengan garasi biasanya 5–7 juta. Peluang negosiasi ke 4 juta lebih besar kalau Anda bayar 1 tahun di muka. Apakah itu opsi yang feasible?
Customer : Mungkin bisa, tergantung kondisi
AI       : Tinggal bersama siapa?
Customer : Istri dan 2 anak
AI       : Kapan masuk?
Customer : Bulan depan
AI       : Sewa berapa lama?
Customer : 1 tahun
AI       : Mau furnished atau kosongan?
Customer : Kosongan lebih murah kan? Kosongan aja
AI       : Betul! Saya carikan pilihan di Antapani–Margahayu, garasi, 3KT, target 4–5 juta/bulan, 4 orang, bulan depan, 1 tahun, kosongan. Saya bantu juga untuk negosiasi harga!
```

---

### CASE S-14 | Sewa Rumah | Customer Tanya Fasilitas Daerah Sekitar

```
Customer : Sewa rumah di Depok, yang deket fasilitas lengkap
AI       : Siap! Area Depok mana yang dimaksud — Depok Lama, Margonda, Sawangan, atau lainnya?
Customer : Yang deket mall dan rumah sakit
AI       : Area Margonda atau Cinere biasanya paling lengkap fasilitasnya — dekat Margo City, RSUI, dll. Sesuai?
Customer : Iya Margonda cocok
AI       : Fasilitas di dalam rumahnya apa yang dibutuhkan?
Customer : Garasi, minimal 3 kamar, carport lebar
AI       : Budget per bulan?
Customer : 8-12 juta
AI       : Tinggal dengan siapa?
Customer : Saya, orang tua, dan 1 anak
AI       : Kapan masuk?
Customer : September
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Bayar tahunan atau bisa per 6 bulan?
Customer : Per 6 bulan
AI       : Furnished atau kosongan?
Customer : Semi-furnished, tapi harus ada water heater dan AC semua kamar
AI       : Detail yang bagus! Saya carikan rumah sewa di Margonda Depok, garasi, 3KT+, carport lebar, AC semua kamar + water heater, 8–12 juta/bulan, 4 orang, September, 2 tahun, bayar 6 bulanan!
```

---

### CASE S-15 | Sewa Rumah | Customer Hanya Bisa WA Singkat (Jam Sibuk)

**Kondisi:** Customer nampak sibuk, hanya kirim pesan pendek dan tidak responsif lama.

```
Customer : sewa rmh surabaya
AI       : Siap! Area Surabaya mana?
Customer : [30 menit kemudian] timur
AI       : Fasilitas & budget?
Customer : garasi, 3kt. 7-10jt
AI       : Kapan masuk & berapa lama?
Customer : oktober, setahun
AI       : Tinggal berapa orang?
Customer : 4
AI       : Furnished?
Customer : semi
AI       : Oke! Saya carikan: rmh sewa Sby Timur, garasi, 3KT, 7–10jt/bln, 4 org, Oktober, 1 thn, semi-furnished. Nanti saya kirim pilihan ya!
```

---

## ═══════════════════════════════════════
## BAGIAN B: BELI RUMAH (20 CASE)
## ═══════════════════════════════════════

---

### CASE B-01 | Beli Rumah | Customer Normal / Lengkap

```
Customer : Saya mau beli rumah
AI       : Selamat! Rumah di kota atau area mana yang Anda inginkan?
Customer : Surabaya Selatan, sekitar Wiyung atau Menganti
AI       : Fasilitas atau spesifikasi rumah yang wajib ada?
Customer : Minimal 3 kamar, garasi 2 mobil, hook/sudut lebih bagus
AI       : Budget pembeliannya di kisaran berapa?
Customer : 1,2 sampai 1,8 miliar
AI       : Rumah ini untuk ditinggali bersama siapa?
Customer : Keluarga, saya + istri + 2 anak
AI       : Target beli kapan? Apakah ada deadline tertentu?
Customer : Dalam 3 bulan ke depan
AI       : Kalau ada yang cocok, langsung bisa diproses atau perlu diskusi keluarga dulu?
Customer : Perlu diskusi singkat dengan istri, tapi biasanya cepat
AI       : Untuk pembiayaan, rencana KPR atau cash?
Customer : KPR, sudah cek ke bank kemarin
AI       : Bank mana yang sudah di-approve?
Customer : BCA dan Mandiri, DP sekitar 20%
AI       : Untuk kondisi rumah, mau yang ready stock, inden, atau second?
Customer : Lebih prefer ready stock atau second yang kondisi baik
AI       : Furnished atau kosongan?
Customer : Kosongan, mau renovasi sendiri
AI       : Siap! Saya carikan: rumah beli di Wiyung–Menganti Surabaya, 3KT, garasi 2 mobil, hook preferred, 1,2–1,8 M, KPR BCA/Mandiri DP 20%, keluarga 4 orang, target 3 bulan, kosongan. Saya persiapkan pilihannya!
```

---

### CASE B-02 | Beli Rumah | Customer Malas Ketik

```
Customer : beli rmh di bekasi
AI       : Area Bekasi mana?
Customer : bekasi utara
AI       : Budget?
Customer : 600-900jt
AI       : KPR atau cash?
Customer : kpr
AI       : Spesifikasi rumah? (kamar, garasi, dll)
Customer : 3 kamar, garasi
AI       : Kapan mau beli?
Customer : tahun ini
AI       : Untuk siapa?
Customer : keluarga, 3 org
AI       : Ready stock atau boleh inden?
Customer : ready aja
AI       : Furnished atau kosongan?
Customer : kosongan
AI       : Siap! Rumah beli Bekasi Utara, 3KT, garasi, 600–900 jt, KPR, keluarga 3 org, ready stock, kosongan. Saya carikan!
```

---

### CASE B-03 | Beli Rumah | Info Terbatas / Ambigu

```
Customer : mau beli rumah yang bagus dan strategis
AI       : Tentu! Di kota atau daerah mana Anda mencari?
Customer : yang dekat tempat kerja saya
AI       : Kantor Anda di area mana? Ini penting supaya saya bisa rekomendasikan lokasi yang paling strategis.
Customer : di kawasan SCBD Jakarta
AI       : Baik, dekat SCBD. Biasanya area Kebayoran Baru, Cilandak, atau bahkan Tangerang Selatan jadi pilihan yang banyak dicari. Ada preferensi arah tertentu?
Customer : yang penting aksesnya gampang, gak terlalu macet kalau pagi
AI       : Paham. Untuk ukuran rumah, minimal kamar berapa yang dibutuhkan?
Customer : yang cukup untuk keluarga
AI       : Keluarga berapa orang? Ini membantu saya tentukan jumlah kamar yang pas.
Customer : 4 orang, 2 anak masih kecil
AI       : Budget pembelian di kisaran berapa?
Customer : yang masuk akal lah
AI       : Untuk area sekitar SCBD, harga bervariasi. Apakah budget Anda di bawah 1,5 M, atau lebih ke 2–3 M?
Customer : idealnya di bawah 2 miliar
AI       : Baik! KPR atau cash?
Customer : KPR, tapi belum tahu bank mana
AI       : Tidak masalah, kami bisa bantu rekomendasikan bank yang paling sesuai. Mau yang furnished atau kosongan?
Customer : terserah, yang penting kondisi baik
AI       : Siap! Rumah beli dekat SCBD Jakarta (area selatan), akses mudah, min. 3KT, di bawah 2 M, KPR, keluarga 4 orang. Saya carikan pilihannya!
```

---

### CASE B-04 | Beli Rumah | Customer Tanya Harga Duluan

```
Customer : Harga rumah di Tangerang Selatan sekarang berapa?
AI       : Di Tangsel sangat bervariasi: mulai 500 juta untuk tipe kecil di perumahan, hingga 5 miliar lebih untuk area premium seperti BSD atau Alam Sutera. Di area mana yang Anda incar?
Customer : BSD atau Serpong Utara
AI       : Untuk BSD dan Serpong Utara, tipe standar 3 kamar mulai 1–2,5 M tergantung kluster. Budget Anda di kisaran berapa?
Customer : Paling tinggi 1,5 miliar
AI       : Masuk! Banyak pilihan di range itu. Spesifikasi yang dibutuhkan?
Customer : 3 kamar, garasi 2 mobil, dan ada taman kecil
AI       : KPR atau cash?
Customer : KPR, sudah pre-approved BTN
AI       : Untuk siapa rumahnya?
Customer : Istri dan 2 anak, kami berempat
AI       : Kapan target belinya?
Customer : Paling lambat pertengahan tahun depan
AI       : Ready stock atau inden tidak masalah?
Customer : Prefer ready, tapi inden maksimal 6 bulan masih oke
AI       : Kondisi baru atau second?
Customer : Baru lebih prefer, tapi second kondisi baik juga bisa
AI       : Furnished atau kosongan?
Customer : Kosongan, mau custom sendiri
AI       : Siap! Rumah beli BSD/Serpong Utara, 3KT, garasi 2 mobil, taman, max 1,5 M, KPR BTN, keluarga 4 orang, target tengah tahun depan, ready/inden max 6 bulan, baru/second, kosongan!
```

---

### CASE B-05 | Beli Rumah | Customer Marah / Frustrasi

```
Customer : Sudah 3 bulan cari rumah di Depok, gak ada yang cocok! Tolong bantu
AI       : Wah, 3 bulan itu melelahkan sekali. Saya akan bantu lebih serius. Boleh ceritakan — apa yang biasanya kurang cocok dari rumah yang sudah dilihat?
Customer : Entah lokasinya jauh, entah harganya kemahalan, entah kondisinya jelek. Frustrasi!
AI       : Sangat wajar frustrasi. Mari kita clear dulu kriteria yang non-negotiable bagi Anda. Apa 3 hal yang HARUS ada dan tidak bisa dikompromikan?
Customer : 1. Dekat stasiun KRL, 2. Garasi 2 mobil, 3. Maksimal 1 miliar
AI       : Tiga hal itu sudah jelas. Depok area mana yang masih bisa Anda terima — Depok Lama, Citayam, Cinere, atau Sawangan?
Customer : Manapun asal dekat stasiun
AI       : Baik. Jumlah kamar minimal berapa?
Customer : 3 kamar
AI       : KPR atau cash?
Customer : KPR, BRI sudah approve
AI       : Target beli kapan? Masih dalam waktu dekat?
Customer : Secepat mungkin, sudah tidak sabar
AI       : Siap saya prioritaskan! Keluarga berapa orang?
Customer : 4 orang
AI       : Furnished atau kosongan?
Customer : Terserah, yang penting cocok!
AI       : Mengerti. Saya akan carikan yang dekat stasiun KRL Depok, garasi 2 mobil, max 1 M, KPR BRI, 3KT, keluarga 4 orang. Saya akan hubungi Anda dalam 24 jam dengan pilihan terbaik yang tersedia!
```

---

### CASE B-06 | Beli Rumah | Customer Ganti-Ganti Keputusan

```
Customer : mau beli rumah di Semarang
AI       : Di area Semarang mana yang Anda pertimbangkan?
Customer : Hmm, tadinya mau Tembalang, tapi kayaknya Banyumanik lebih enak
AI       : Keduanya area yang bagus di Semarang Selatan. Ada alasan khusus berpindah dari Tembalang ke Banyumanik?
Customer : Di Banyumanik lebih tenang, tapi Tembalang dekat kampus, mungkin harganya lebih cepat naik
AI       : Investasi atau untuk ditempati sendiri?
Customer : Ditempati, tapi kalau nilainya naik bagus juga
AI       : Untuk ditempati — spesifikasi yang dibutuhkan?
Customer : 3 kamar... eh 4 kamar lebih bagus sih, buat guest room
AI       : Budget pembelian?
Customer : 800 juta... sebenarnya bisa stretch ke 1 miliar
AI       : Kalau stretch ke 1 M, pilihan di Banyumanik lebih bagus. Saya carikan di dua area untuk perbandingan ya?
Customer : Iya boleh
AI       : KPR atau cash?
Customer : KPR, DP sudah siap
AI       : Kapan target belinya?
Customer : Harusnya bulan depan tapi mungkin 2 bulan lagi
AI       : Keluarga berapa orang?
Customer : Saya, istri, 2 anak, dan mungkin orang tua ikut nanti
AI       : Jadi idealnya 4 kamar. Furnished atau kosongan?
Customer : Kosongan, mau renov
AI       : Siap! Saya carikan perbandingan: rumah beli Tembalang vs Banyumanik Semarang, 4KT, max 1 M, KPR, target 2 bulan, kosongan. Nanti Anda bisa bandingkan!
```

---

### CASE B-07 | Beli Rumah | Customer Tidak Tahu Yang Mau (First Time Buyer)

```
Customer : mau beli rumah pertama, bingung mulai dari mana
AI       : Selamat akan beli rumah pertama! Saya bantu step by step. Pertama: di kota mana Anda bekerja atau tinggal sekarang?
Customer : Surabaya
AI       : Baik. Surabaya area mana yang paling sering Anda akses? Kantor, keluarga, atau fasilitas tertentu?
Customer : Kerja di Surabaya Pusat, orang tua di Surabaya Barat
AI       : Area Surabaya Barat atau Selatan bisa jadi tengah-tengahnya. Budget Anda kira-kira berapa?
Customer : Hmm, belum tahu. Berapa yang ideal untuk pertama kali?
AI       : Tergantung penghasilan — umumnya cicilan KPR tidak melebihi 30% gaji bulanan. Kalau penghasilan Anda sekitar 10 juta/bulan, cicilan ideal sekitar 3 juta, yang artinya rumah di kisaran 400–500 juta. Apakah itu masuk di rentang kemampuan?
Customer : Penghasilan saya 12 juta, kayaknya bisa agak lebih
AI       : Dengan 12 juta, idealnya cicilan max 3,5–4 juta. Itu setara rumah 550–650 juta dengan KPR 30 tahun. Ingin saya carikan di range itu?
Customer : Iya, tapi saya mau tanya — KPR itu gimana ya prosesnya?
AI       : Singkatnya: Anda pilih bank → ajukan dokumen penghasilan → bank approve limit → pilih rumah → tanda tangan akad. Saya bisa bantu rekomendasikan bank setelah rumah cocok ditemukan. Lanjut dulu — spesifikasi minimalnya berapa kamar?
Customer : 2 kamar cukup, saya masih sendiri
AI       : Kapan target belinya?
Customer : Dalam setahun ini
AI       : Kondisi baru atau second tidak masalah?
Customer : Baru lebih prefer
AI       : Furnished atau kosongan?
Customer : Kosongan, isi sendiri sedikit-sedikit
AI       : Bagus! Rumah baru beli di Surabaya Barat–Selatan, 2KT, 550–650 juta, KPR, target setahun ini, kosongan. Saya carikan dan bantu proses KPR-nya juga!
```

---

### CASE B-08 | Beli Rumah | Investasi / Bukan Untuk Ditempati

```
Customer : Mau beli rumah untuk investasi
AI       : Menarik! Investasi jangka panjang (hold dan nanti dijual) atau mau disewakan?
Customer : Mau disewakan dulu, nanti dijual kalau harga bagus
AI       : Strategi bagus. Di kota mana yang Anda pertimbangkan?
Customer : Surabaya atau Malang, mana yang lebih potensial?
AI       : Keduanya menarik. Surabaya: likuiditas lebih tinggi, harga lebih stabil. Malang: yield sewa lebih tinggi terutama dekat kampus. Budget Anda berapa?
Customer : 500 juta sampai 800 juta
AI       : Di range itu, Malang dekat kampus bisa dapat 2–3 unit kost-kostan kecil, atau 1 rumah di Surabaya pinggiran. Mana yang lebih menarik untuk Anda?
Customer : 1 rumah lebih mudah dikelola
AI       : Surabaya maka lebih cocok. Area mana yang strategis untuk disewakan?
Customer : Yang dekat kampus atau kawasan industri
AI       : Area ITS/UNAIR di Surabaya Timur atau Rungkut bagus untuk kedua kriteria itu. Tipe rumah berapa kamar?
Customer : 3-4 kamar lebih diminati penyewa kan?
AI       : Betul, 3KT paling banyak dicari. KPR atau cash?
Customer : Cash, sudah ada dana
AI       : Target beli kapan?
Customer : 3 bulan ke depan
AI       : Furnished atau kosongan untuk disewakan?
Customer : Semi-furnished supaya lebih mudah disewa
AI       : Siap! Rumah investasi di Surabaya Timur/Rungkut, 3KT, 500–800 juta, cash, target 3 bulan, semi-furnished untuk disewakan. Saya carikan yang yield sewanya paling optimal!
```

---

### CASE B-09 | Beli Rumah | Customer Bandingkan Developer

```
Customer : Mau beli rumah, lagi compare antara perumahan Citraland sama Pakuwon di Surabaya
AI       : Keduanya developer premium di Surabaya Barat! Ada pertimbangan utama yang membuat Anda membandingkan keduanya?
Customer : Sama-sama bagus sih, tapi mau lihat harga vs fasilitas kluster
AI       : Budget Anda di kisaran berapa?
Customer : 1,5–2,5 miliar
AI       : Di range itu, di Citraland Anda bisa dapat tipe premium, di Pakuwon City juga sebanding. Spesifikasi yang Anda butuhkan?
Customer : 3–4 kamar, garasi 2 mobil, hook/sudut
AI       : KPR atau cash?
Customer : KPR, BCA sudah approve 1,8 M
AI       : Kapan target belinya?
Customer : 6 bulan lagi
AI       : Keluarga berapa orang?
Customer : 5 orang, orang tua ikut tinggal
AI       : Untuk 5 orang, 4 kamar lebih ideal. Mau saya siapkan komparasi detail Citraland vs Pakuwon untuk tipe 4KT garasi 2 mobil di range 1,5–2,5 M?
Customer : Ya, tolong
AI       : Siap! Saya persiapkan komparasi Citraland vs Pakuwon, 4KT, garasi 2 mobil, hook preferred, 1,5–2,5 M, KPR BCA 1,8 M, untuk 5 orang, target 6 bulan. Saya hubungi segera!
```

---

### CASE B-10 | Beli Rumah | Customer Tanya KPR Dulu

```
Customer : Bisa bantu cari rumah? Tapi saya belum tahu KPR saya diapprove berapa
AI       : Tentu! Sambil cari rumah, kita bisa juga bantu proses KPR-nya. Di area mana Anda cari rumahnya?
Customer : Jakarta Selatan atau Depok
AI       : Untuk simulasi KPR — berapa perkiraan penghasilan per bulan Anda?
Customer : Sekitar 15 juta, tapi bonus tahunan lumayan
AI       : Dengan 15 juta, cicilan yang aman sekitar 4–4,5 juta/bulan. Itu setara rumah 600–750 juta dengan tenor 30 tahun. Apakah range itu sesuai rencana?
Customer : Mungkin bisa stretch ke 800 juta kalau kondisi rumahnya bagus
AI       : Spesifikasi yang dibutuhkan?
Customer : 3 kamar, garasi, dan harus ada taman atau halaman
AI       : Kapan target belinya?
Customer : Dalam 6 bulan
AI       : Keluarga berapa orang?
Customer : Istri dan 1 anak, 3 orang total
AI       : Furnished atau kosongan?
Customer : Semi-furnished
AI       : Siap! Saya carikan rumah di Jaksel–Depok, 3KT, garasi, halaman, 600–800 juta, 3 orang, target 6 bulan, semi-furnished. Sekaligus saya bantu rekomendasikan bank KPR yang kompetitif!
```

---

### CASE B-11 | Beli Rumah | Customer Spesifik Minta Second/Bekas

```
Customer : Cari rumah bekas yang bagus di Yogyakarta
AI       : Siap! Rumah second di Yogyakarta — area mana yang diincar?
Customer : Sleman atau Bantul, tapi tidak mau yang terlalu pelosok
AI       : Sleman Timur (Maguwoharjo, Berbah) atau Bantul Utara (Kasihan, Sewon) biasanya bagus. Budget?
Customer : 500–700 juta
AI       : Spesifikasi minimal?
Customer : 3 kamar, garasi, kondisi bangunan harus masih bagus
AI       : Untuk rumah second, apakah ada fleksibilitas renovasi ringan? Atau harus langsung bisa huni?
Customer : Boleh renovasi ringan, tapi tidak mau yang strukturnya rusak
AI       : Paham. KPR atau cash?
Customer : Cash
AI       : Kapan target belinya?
Customer : 2 bulan ke depan
AI       : Untuk siapa?
Customer : Pensiun, saya sudah pensiun mau menetap di Jogja
AI       : Wah, selamat! Furnished atau kosongan?
Customer : Sudah ada sebagian furnitur sendiri, jadi semi-furnished oke
AI       : Siap! Rumah second di Sleman/Bantul Yogyakarta, 3KT, garasi, kondisi baik, 500–700 juta, cash, target 2 bulan, semi-furnished. Saya pilihkan yang strukturnya solid dan tidak perlu renovasi besar!
```

---

### CASE B-12 | Beli Rumah | Customer Minta Rumah Hook / Sudut

```
Customer : beli rumah hook dong
AI       : Siap! Rumah hook di area mana?
Customer : Surabaya Barat, sekitar Citraland
AI       : Budget?
Customer : 1,5-2M
AI       : Spek lainnya?
Customer : 3-4 kamar, garasi 2 mobil
AI       : KPR atau cash?
Customer : KPR
AI       : Kapan target?
Customer : 3-4 bulan
AI       : Keluarga berapa orang?
Customer : 4 orang
AI       : Furnished?
Customer : kosongan
AI       : Siap! Rumah hook Citraland Surabaya Barat, 3–4KT, garasi 2 mobil, 1,5–2M, KPR, target 3–4 bulan, 4 orang, kosongan. Cari sekarang!
```

---

### CASE B-13 | Beli Rumah | Customer Tanya Harga Per Meter

```
Customer : Harga tanah per meter di Surabaya Timur sekarang berapa?
AI       : Di Surabaya Timur, harga tanah cukup bervariasi: area Rungkut sekitar 4–7 juta/m², area MERR bisa 6–10 juta/m², kawasan Gunung Anyar mulai 3–5 juta/m². Apakah Anda cari tanah saja atau rumah + tanah?
Customer : Rumah + tanah, mau beli
AI       : Di area Surabaya Timur mana yang Anda pertimbangkan?
Customer : Sekitar Rungkut atau Gunung Anyar
AI       : Budget totalnya berapa?
Customer : 800 juta sampai 1,2 miliar
AI       : Spesifikasi rumah yang diinginkan?
Customer : 3 kamar, garasi, LT minimal 150m²
AI       : KPR atau cash?
Customer : Cash
AI       : Kapan target beli?
Customer : Tidak terburu-buru, 6 bulan ke depan
AI       : Untuk siapa?
Customer : Keluarga kecil, 3 orang
AI       : Furnished atau kosongan?
Customer : Kosongan, mau renovasi
AI       : Siap! Rumah di Rungkut/Gunung Anyar Surabaya Timur, 3KT, garasi, LT min 150m², 800 juta–1,2 M, cash, target 6 bulan, kosongan. Saya cari yang terbaik!
```

---

### CASE B-14 | Beli Rumah | Tanya Dekat Sekolah / Fasilitas Pendidikan

```
Customer : Mau beli rumah yang dekat sekolah internasional di Surabaya
AI       : Pilihan bagus! Beberapa sekolah internasional di Surabaya ada di area Pakuwon (SIS), Surabaya Timur (Ciputra School), dan pusat kota. Area mana yang Anda prioritaskan?
Customer : Sekitar Pakuwon atau Citraland karena dekat SIS dan Surabaya Intercultural School
AI       : Budget pembelian?
Customer : 2–3 miliar
AI       : Spesifikasi rumah?
Customer : 4 kamar, garasi 2 mobil, di perumahan cluster
AI       : KPR atau cash?
Customer : Cash dari hasil jual apartemen lama
AI       : Target beli kapan?
Customer : 4 bulan ke depan, tahun ajaran baru
AI       : Keluarga berapa orang?
Customer : 5 orang, ada 3 anak
AI       : Furnished atau kosongan?
Customer : Semi-furnished
AI       : Siap! Rumah beli di Pakuwon/Citraland Surabaya, cluster, 4KT, garasi 2 mobil, 2–3 M, cash, target 4 bulan, semi-furnished. Saya pastikan yang aksesnya mudah ke SIS ya!
```

---

### CASE B-15 | Beli Rumah | Customer Minta Opsi KPR Subsidi

```
Customer : Ada rumah subsidi gak di Surabaya atau sekitarnya?
AI       : Ada! Program KPR subsidi FLPP masih berjalan. Di area Surabaya memang terbatas, tapi sekitar Sidoarjo atau Gresik masih ada. Boleh saya tahu lebih detail kebutuhannya?
Customer : Penghasilan saya 5 juta, KTP Surabaya, belum pernah punya rumah
AI       : Anda memenuhi syarat dasar KPR FLPP! Untuk lokasi, apakah Sidoarjo atau Gresik masih bisa diterima?
Customer : Sidoarjo oke, asal jangan terlalu jauh dari Surabaya
AI       : Area Waru, Gedangan, atau Buduran Sidoarjo masih relatif dekat Surabaya. Sesuai?
Customer : Waru paling dekat, boleh
AI       : Budget cicilan per bulan yang aman untuk Anda?
Customer : Maksimal 1,5–2 juta
AI       : KPR FLPP cicilan mulai 1,2 juta/bulan untuk rumah 140–200 jutaan. Keluarga berapa orang?
Customer : Saya sendiri dulu, belum menikah
AI       : Target beli kapan?
Customer : Dalam tahun ini
AI       : Furnished atau kosongan (biasanya subsidi kosongan)?
Customer : Kosongan tidak masalah
AI       : Bagus! Saya carikan program KPR FLPP di Waru Sidoarjo, cicilan 1,2–2 juta/bulan, untuk 1 orang, target tahun ini, kosongan. Saya bantu juga lengkapi persyaratan dokumennya!
```

---

### CASE B-16 | Beli Rumah | Customer Ganti Lokasi Di Tengah Percakapan

```
Customer : beli rumah di Tangerang
AI       : Area Tangerang mana — Tangerang Kota, Tangerang Selatan, atau Kabupaten Tangerang?
Customer : Tangsel deh... eh tapi Tangerang Kota juga ada yang bagus ya?
AI       : Betul, keduanya punya kelebihan. Tangsel lebih premium (BSD, Bintaro), Tangerang Kota lebih terjangkau. Budget Anda berapa? Itu bisa bantu tentukan area yang lebih cocok.
Customer : 700 juta–1 miliar
AI       : Di range itu, Tangsel masih dapat pilihan bagus di Ciputat atau Pamulang, dan Tangerang Kota bisa dapat yang lebih luas. Mana yang lebih menarik?
Customer : Coba Tangsel aja
AI       : Spesifikasi rumah?
Customer : 3 kamar, garasi
AI       : KPR atau cash?
Customer : KPR
AI       : Kapan target?
Customer : 6 bulan
AI       : Berapa orang yang tinggal?
Customer : 4 orang
AI       : Furnished?
Customer : Semi
AI       : Siap! Rumah beli di Tangsel (Ciputat/Pamulang area), 3KT, garasi, 700 juta–1 M, KPR, target 6 bulan, 4 orang, semi-furnished!
```

---

### CASE B-17 | Beli Rumah | Customer Sudah Lihat Banyak, Minta Rekomendasi Final

```
Customer : Udah 6 bulan cari rumah, sudah lihat 20+ properti. Bingung mana yang harus dipilih
AI       : Wah, perjalanan yang panjang! Dari yang sudah dilihat, apa yang paling sering bikin tidak jadi beli?
Customer : Selalu ada trade-off. Kalau lokasinya bagus, harganya mahal. Kalau harganya cocok, kondisinya kurang.
AI       : Sangat umum terjadi. Mari kita coba cari formula yang tepat. Dari semua yang pernah dilihat, ada 2-3 yang paling mendekati ideal?
Customer : Ada 1 di Bekasi yang kondisinya bagus tapi 50 juta over budget, dan 1 lagi di Depok yang lokasi bagus tapi perlu renovasi
AI       : Untuk yang Bekasi 50 juta over budget — apakah sudah coba negosiasi?
Customer : Belum berani
AI       : Itu worth untuk dicoba. Kalau penjual turunkan 30–40 juta, masih ada gap kecil yang bisa ditoleransi? Atau ada opsi lain yang bisa membantu?
Customer : Kalau 30 juta turun sudah bisa stretch
AI       : Bagus, itu feasible untuk dinegosiasi. Saya bisa bantu fasilitasi negosiasi itu. Boleh share detailnya?
Customer : Oke, besok saya forward infonya
AI       : Siap! Sambil menunggu, saya juga akan carikan opsi baru yang mungkin belum sempat terlihat, sesuai kriteria Anda. Bisa konfirmasi: area, spek, dan budget?
Customer : Bekasi–Depok, 3KT, garasi, max 800 juta, KPR
AI       : Siap! Saya bantu paralel: fasilitasi negosiasi rumah Bekasi + carikan opsi baru di range Anda!
```

---

### CASE B-18 | Beli Rumah | Customer Tanya Soal Investasi vs Huni

```
Customer : mau beli rumah, tapi bingung pilih untuk invest atau huni sendiri
AI       : Pertanyaan bagus dan penting! Jawabannya tergantung situasi. Boleh saya tanya dulu — saat ini Anda tinggal di mana dan statusnya sewa atau milik?
Customer : Masih ngontrak di Jakarta, kontrak habis 8 bulan lagi
AI       : Karena kontrak habis 8 bulan lagi, ada urgensi untuk hunian sendiri. Tapi investasi tetap bisa dipertimbangkan jika beli 2 unit. Budget Anda berapa?
Customer : Sekitar 800 juta–1,2 M
AI       : Di range itu, untuk investasi terbaik saya rekomendasikan area pertumbuhan seperti Cikarang atau Karawang (jika cash flow sewa jadi prioritas), atau Bekasi–Depok (jika capital gain yang dikejar). Apakah ada area yang Anda paling nyaman?
Customer : Untuk huni sendiri ya dekat kantor di Kuningan, Jakarta Selatan
AI       : Dengan 800 juta–1,2 M di dekat Kuningan, pilihan terbatas di Jakarta — tapi Depok atau Bekasi Barat masih bisa. KPR atau cash?
Customer : KPR
AI       : Keluarga berapa orang?
Customer : Saya sendiri, tapi mungkin menikah dalam 2 tahun
AI       : Untuk antisipasi, 3 kamar lebih bijak. Target beli kapan?
Customer : Sebelum kontrak habis, jadi maksimal 6 bulan
AI       : Furnished?
Customer : Semi
AI       : Siap! Saya carikan rumah beli dekat akses Kuningan (Depok/Bekasi Barat), 3KT, 800 juta–1,2 M, KPR, target 6 bulan, semi-furnished. Saya juga jelaskan opsi mana yang lebih baik untuk situasi Anda!
```

---

### CASE B-19 | Beli Rumah | Customer Hanya Punya Waktu Singkat

```
Customer : Mau beli rumah di Surabaya, buru-buru nih, meeting 10 menit lagi
AI       : Cepat! Boleh tanya 3 hal penting: area mana, budget berapa, KPR atau cash?
Customer : Wiyung, max 900 juta, KPR
AI       : Spek minimal?
Customer : 3 kamar, garasi
AI       : Kapan target?
Customer : 3 bulan
AI       : Oke! Saya carikan dulu, nanti setelah meeting kita lanjut detail ya. Saya simpan info ini: Wiyung Surabaya, 3KT, garasi, max 900 juta, KPR, target 3 bulan.
Customer : Oke makasih
```

---

### CASE B-20 | Beli Rumah | Customer Minta Dijual Dengan Harga Khusus / Nego Ketat

```
Customer : Mau beli rumah cash, tapi minta harga terbaik. Sudah lihat beberapa properti dan saya serious buyer
AI       : Tentu! Cash buyer selalu punya posisi negosiasi lebih kuat. Di area mana yang Anda pertimbangkan?
Customer : Surabaya Utara, sekitar Kenjeran atau Tambak Osowilangun
AI       : Budget yang Anda siapkan?
Customer : 600–800 juta, tapi kalau kondisinya bagus bisa stretch
AI       : Spesifikasi minimal?
Customer : 3 kamar, garasi, kondisi bangunan harus baik
AI       : Kapan bisa proses cepat kalau ada yang cocok?
Customer : Kalau cocok, minggu ini bisa tanda tangan, serius
AI       : Bagus, cash dan bisa proses cepat — itu posisi sangat kuat untuk negosiasi. Keluarga berapa orang?
Customer : 4 orang
AI       : Furnished atau kosongan?
Customer : Kosongan, siap renovasi
AI       : Siap! Saya prioritaskan cari rumah di Kenjeran–Tambak Oso, 3KT, garasi, 600–800 juta, cash, proses cepat, 4 orang, kosongan. Saya akan bantu negosiasikan harga terbaik sebagai cash buyer ya!
```

---

## 📋 RINGKASAN SLOT DATA — RUMAH

| Slot | Sewa | Beli | Keterangan |
|------|------|------|------------|
| transaction_type | ✅ Wajib | ✅ Wajib | sewa/beli |
| location_city | ✅ Wajib | ✅ Wajib | Kota target |
| location_detail | ✅ Wajib | ✅ Wajib | Area/landmark |
| facilities | ⭕ Opsional | ⭕ Opsional | Garasi, AC, dll |
| budget | ✅ Wajib | ✅ Wajib | Range min-max |
| occupants | ✅ Wajib | ✅ Wajib | Inferensi kamar |
| move_in_date | ✅ Wajib | ✅ Wajib | Bulan/tanggal |
| duration | ✅ Sewa | ❌ N/A | Berapa lama sewa |
| payment_terms | ✅ >1thn | ❌ N/A | Cicil/lunas |
| furnished | ✅ Wajib | ✅ Wajib | Furnished/semi/kosong |
| financing | ❌ N/A | ✅ Wajib | KPR/cash |
| alternatives | ⭕ Opsional | ⭕ Opsional | Area lain oke? |
| decision_maker | ⭕ Opsional | ⭕ Opsional | Solo/joint decision |

---

*File: 01_SKILL_HOUSE_RUMAH.md | Elevan Property Chatbot Skills v1.0*

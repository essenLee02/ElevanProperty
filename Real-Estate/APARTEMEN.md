# SKILL: APARTMENT / APARTEMEN — Panduan Respons Chatbot Property
**Tipe Property:** Apartemen (Apartment)
**Transaksi:** Sewa & Beli
**Total Case:** 35 (15 Sewa + 20 Beli)

---

## 🔧 ATURAN KHUSUS APARTEMEN

### Slot Tambahan vs Rumah:
```json
{
  "tower_preference": null,
  "floor_preference": null,
  "view_preference": null,
  "unit_size": null
}
```

### Q12 Khusus Apartemen:
- Preferensi tower (jika multi-tower)
- Preferensi lantai: rendah / menengah / tinggi
- Arah hadap / view (pool view, city view, dll)

---

## ═══════════════════════════════════════
## BAGIAN A: SEWA APARTEMEN (15 CASE)
## ═══════════════════════════════════════

---

### CASE S-01 | Sewa Apartemen | Customer Normal / Lengkap

```
Customer : Saya mau sewa apartemen
AI       : Siap membantu! Di kota atau area mana apartemen yang Anda cari?
Customer : Surabaya, dekat PTC atau Tunjungan Plaza
AI       : Baik, sekitar PTC–TP Surabaya Pusat. Fasilitas apa yang wajib ada? Misalnya gym, kolam renang, atau keamanan 24 jam?
Customer : Wajib ada gym dan kolam renang
AI       : Siap. Budget sewa per bulan di kisaran berapa?
Customer : 4–7 juta per bulan
AI       : Nanti tinggal bersama siapa? Ini membantu saya menentukan ukuran unit yang pas.
Customer : Sendiri saja
AI       : Kapan rencananya masuk?
Customer : Awal bulan depan
AI       : Sewa berapa lama rencananya?
Customer : 1 tahun
AI       : Untuk pembayaran, prefer bayar di muka penuh atau cicil per 6 bulan?
Customer : Bayar per 6 bulan lebih baik
AI       : Untuk furnitur, mau yang sudah furnished, semi, atau kosongan?
Customer : Full furnished
AI       : Ada preferensi lantai? Rendah, menengah, atau tinggi? Dan view tertentu yang diinginkan?
Customer : Lantai tinggi, kalau bisa city view
AI       : Siap! Apartemen sewa dekat PTC–TP Surabaya, gym + kolam renang, 4–7 juta/bulan, 1 orang, masuk bulan depan, 1 tahun, bayar 6 bulanan, full furnished, lantai tinggi, city view!
```

---

### CASE S-02 | Sewa Apartemen | Customer Malas Ketik

```
Customer : cari apart sewa jakarta
AI       : Area Jakarta mana?
Customer : selatan
AI       : Fasilitas wajib?
Customer : kolam renang, gym
AI       : Budget/bulan?
Customer : 5-8jt
AI       : Tinggal berapa orang?
Customer : sendiri
AI       : Kapan masuk?
Customer : bulan depan
AI       : Sewa berapa lama?
Customer : setahun
AI       : Furnished?
Customer : full
AI       : Lantai rendah/tengah/tinggi?
Customer : tengah aja
AI       : Oke! Apart sewa Jaksel, gym + kolam, 5–8jt/bln, 1 org, bulan depan, 1 thn, full furnished, lantai tengah. Cari sekarang!
```

---

### CASE S-03 | Sewa Apartemen | Info Terbatas / Ambigu

```
Customer : mau sewa apartemen yang nyaman buat kerja
AI       : Siap! Di kota mana Anda bekerja?
Customer : di BSD, tapi kerja remote juga sih
AI       : Untuk remote worker, biasanya prioritasnya koneksi internet cepat dan ruang kerja nyaman. Masih ingin di BSD atau boleh di area sekitarnya?
Customer : BSD atau Serpong masih oke
AI       : Fasilitas yang paling penting selain WiFi?
Customer : gym, dan yang penting tenang
AI       : Budget per bulan?
Customer : belum tahu, berapa yang wajar untuk unit bagus di sana?
AI       : Di BSD/Serpong, sewa apartemen studio furnished mulai 3,5 juta, 1 kamar mulai 5 juta. Budget Anda lebih ke studio atau mau 1 kamar terpisah?
Customer : 1 kamar lebih baik biar ada ruang kerja
AI       : Budget sekitar 5–8 juta per bulan oke?
Customer : iya
AI       : Kapan masuk?
Customer : 2 minggu lagi kayaknya
AI       : Sewa berapa lama?
Customer : fleksibel, 6 bulan dulu
AI       : Lantai rendah atau tinggi?
Customer : bebas
AI       : Furnished?
Customer : furnished, malas beli furnitur
AI       : Siap! Apart sewa 1KT di BSD/Serpong, gym + WiFi, 5–8 juta/bulan, 1 orang, 2 minggu lagi, 6 bulan, full furnished!
```

---

### CASE S-04 | Sewa Apartemen | Customer Tanya Harga Duluan

```
Customer : Sewa apartemen di Jakarta Pusat berapa per bulan?
AI       : Di Jakarta Pusat sangat bervariasi: studio mulai 3,5 juta, 1 kamar 5–10 juta, 2 kamar 8–20 juta tergantung gedung dan lantai. Boleh tahu kebutuhan lebih detailnya untuk estimasi yang lebih akurat?
Customer : Mau 1 kamar, gedung yang ada gym dan kolam
AI       : Untuk 1 kamar dengan fasilitas lengkap di Jakpus, range 6–12 juta per bulan itu wajar. Budget Anda di kisaran itu?
Customer : Maksimal 9 juta
AI       : Masuk! Tinggal sendiri atau berdua?
Customer : Berdua sama pasangan
AI       : Kapan masuk?
Customer : Agustus
AI       : Sewa berapa lama?
Customer : 1 tahun
AI       : Furnished atau kosongan?
Customer : Furnished
AI       : Ada preferensi gedung tertentu atau area Jakpus yang disukai?
Customer : Dekat Thamrin atau Sudirman lebih bagus
AI       : Siap! Apart sewa 1KT di Thamrin–Sudirman Jakpus, gym + kolam, max 9 juta/bulan, 2 orang, masuk Agustus, 1 tahun, furnished!
```

---

### CASE S-05 | Sewa Apartemen | Customer Marah / Frustrasi

```
Customer : Sudah chatting sama agen lain gak ada yang bantu beneran. Mau sewa apart di Surabaya!
AI       : Mohon maaf Anda punya pengalaman tidak menyenangkan sebelumnya. Saya pastikan dari sini beda. Langsung ke inti — di area Surabaya mana yang Anda incar?
Customer : Sudah saya bilang 2 kali di tempat lain, Surabaya Barat daerah Pakuwon atau Citraland!
AI       : Siap, Pakuwon–Citraland Surabaya Barat. Saya catat. Fasilitas yang wajib ada?
Customer : Kolam renang dan keamanan ketat. Saya wanita tinggal sendiri
AI       : Prioritas keamanan sangat masuk akal. Budget per bulan?
Customer : 5-8 juta
AI       : Kapan butuh masuknya?
Customer : Secepatnya, minggu depan kalau bisa
AI       : Sewa berapa lama?
Customer : Setahun minimal
AI       : Furnished atau semi?
Customer : Full furnished, gak ada waktu beli perabot
AI       : Lantai rendah, tengah, atau tinggi?
Customer : Tengah ke atas, lebih aman
AI       : Siap! Saya prioritaskan: apart sewa full furnished di Pakuwon–Citraland, kolam renang, keamanan ketat, 5–8 juta/bulan, 1 orang, masuk seminggu lagi, 1 tahun, lantai tengah-atas. Saya hubungi Anda dalam waktu 1 jam dengan pilihan yang tersedia!
```

---

### CASE S-06 | Sewa Apartemen | Customer Ganti-Ganti Keputusan

```
Customer : mau sewa apartemen di Surabaya Timur
AI       : Di Surabaya Timur, area mana yang paling diinginkan?
Customer : MERR atau ITS... tapi sebenernya kalau di tengah kota juga mau
AI       : Oke, fleksibel antara Surabaya Timur dan Pusat. Apa yang paling menentukan pilihan area Anda?
Customer : Kerja di dua tempat sih, satu di ITS area satu lagi di Tunjungan
AI       : Untuk dua titik itu, area Dharmahusada atau Manyar bisa jadi tengahnya. Sesuai?
Customer : Hmm iya mungkin. Budget saya 5-7 juta
AI       : Tinggal sendiri atau ada yang ikut?
Customer : Sendiri dulu, tapi kalau ada tamu sering menginap, perlu sofa bed
AI       : Berarti studio besar atau 1 kamar lebih ideal. Kapan masuk?
Customer : Rencananya Agustus, tapi mungkin bisa September
AI       : Sewa berapa lama?
Customer : Setahun, tapi mau lihat kalau cocok perpanjang
AI       : Furnished?
Customer : Full furnished, tapi saya ada beberapa barang sendiri, jadi semi juga bisa
AI       : Oke, furnished tidak terlalu strict. Lantai preferensi?
Customer : Tinggi kalau ada view bagus, kalau tidak ada terserah
AI       : Siap! Apart sewa di Dharmahusada/Manyar Surabaya, 1KT atau studio besar, 5–7 juta/bulan, 1 orang, September, 1 tahun, furnished/semi, lantai tinggi kalau view bagus. Saya carikan!
```

---

### CASE S-07 | Sewa Apartemen | Customer Tidak Tahu Yang Mau

```
Customer : mau sewa apart tapi belum tahu mau di mana
AI       : Tidak masalah, saya bantu tentukan! Sekarang kerja atau aktivitas utama di kota mana?
Customer : Jakarta, tapi belum tahu daerah mana yang cocok buat saya
AI       : Oke! Beberapa pertanyaan untuk membantu: Kantor Anda di Jakarta mana?
Customer : Belum pasti, baru mau pindah kerja
AI       : Wah, exciting! Kalau kantor belum pasti, ada faktor lain yang bisa jadi patokan? Misalnya dekat teman/keluarga, atau area tertentu yang Anda suka?
Customer : Teman-teman banyak di Selatan, Jakarta Selatan
AI       : Jakarta Selatan oke! Tebet, Kuningan, Kebayoran — semua area populer. Budget per bulan kira-kira berapa?
Customer : Hmmm belum pernah sewa apart. Berapa ya yang wajar?
AI       : Studio di Jaksel mulai 3 juta, 1 kamar mulai 5 juta, 2 kamar mulai 8 juta. Untuk pertama kali, studio atau 1 kamar lebih banyak dipilih. Mana yang lebih cocok?
Customer : Kayaknya 1 kamar, biar ada ruang lebih
AI       : Budget 5–8 juta per bulan oke?
Customer : Oke kayaknya
AI       : Tinggal sendiri?
Customer : Iya, sendiri
AI       : Kapan masuk?
Customer : Bulan depan mungkin
AI       : Sewa berapa lama?
Customer : 6 bulan dulu untuk coba
AI       : Furnished?
Customer : Full furnished, praktis
AI       : Ada yang wajib ada? Gym, kolam, dll?
Customer : Kalau ada gym bagus, tapi tidak wajib
AI       : Siap! Apart sewa 1KT di Jakarta Selatan, full furnished, 5–8 juta/bulan, 1 orang, bulan depan, 6 bulan. Gym jadi nilai plus. Saya carikan pilihan terbaik!
```

---

### CASE S-08 | Sewa Apartemen | Customer Prioritas View

```
Customer : Sewa apartemen di Bali yang ada ocean view dong
AI       : Wah, pilihan keren! Di area Bali mana — Kuta, Seminyak, Nusa Dua, atau Jimbaran?
Customer : Seminyak atau Canggu lebih hidup
AI       : Budget per bulan?
Customer : 8-15 juta tergantung view-nya
AI       : Tinggal sendiri atau ada yang ikut?
Customer : Berdua, remote working couple
AI       : Kapan masuk?
Customer : 2 bulan lagi
AI       : Sewa berapa lama?
Customer : 6 bulan, mungkin diperpanjang
AI       : Furnished?
Customer : Full furnished pastinya
AI       : Preferensi lantai? Semakin tinggi biasanya ocean view lebih bagus.
Customer : Lantai tinggi, pool view atau ocean view, yang penting premium
AI       : Siap! Apart sewa di Seminyak–Canggu Bali, ocean/pool view, lantai tinggi, 8–15 juta/bulan, 2 orang, 2 bulan lagi, 6 bulan, full furnished. Saya carikan yang view-nya paling spektakuler!
```

---

### CASE S-09 | Sewa Apartemen | Customer Sewa Jangka Pendek

```
Customer : Perlu apart di Surabaya untuk 2 bulan saja
AI       : Siap! Short-term rental 2 bulan di Surabaya. Area mana yang diinginkan?
Customer : Dekat RSUD Dr. Soetomo, untuk urusan medis
AI       : Paham, untuk keperluan medis di Surabaya Pusat. Fasilitas yang dibutuhkan?
Customer : Yang penting bersih, aman, ada parkir
AI       : Budget per bulan?
Customer : Maksimal 5 juta
AI       : Tinggal sendiri atau ada yang menemani?
Customer : Berdua sama istri
AI       : Tanggal masuk?
Customer : Minggu depan
AI       : Furnished atau semi?
Customer : Full furnished, tidak mau repot
AI       : Oke, saya carikan yang bisa jangka pendek 2 bulan. Beberapa apartemen punya minimum 3 bulan, tapi ada yang fleksibel. Bisa saya konfirmasi juga?
Customer : Iya tolong
AI       : Siap! Apart sewa dekat RSUD Soetomo, 2 bulan, bersih + aman + parkir, max 5 juta/bulan, 2 orang, masuk minggu depan, full furnished. Saya cek yang menerima short-term!
```

---

### CASE S-10 | Sewa Apartemen | Customer Tanya Soal Pet-Friendly

```
Customer : Sewa apartemen di Bandung yang pet-friendly, ada kucing
AI       : Siap! Pet-friendly apartemen di Bandung. Area mana yang diinginkan?
Customer : Dago atau Buah Batu
AI       : Fasilitas selain pet-friendly yang penting?
Customer : Gym kalau ada, tapi yang paling penting boleh bawa kucing
AI       : Budget per bulan?
Customer : 4-6 juta
AI       : Tinggal sendiri atau keluarga?
Customer : Sendiri + 1 kucing 😸
AI       : Kapan masuk?
Customer : Bulan depan
AI       : Sewa berapa lama?
Customer : Setahun
AI       : Furnished?
Customer : Semi-furnished
AI       : Lantai?
Customer : Tidak tinggi-tinggi, takut kucing jatuh. Lantai 3-5 oke
AI       : Sangat bijak! Siap carikan: apart sewa pet-friendly di Dago–Buah Batu Bandung, gym value-add, 4–6 juta/bulan, 1 orang + 1 kucing, bulan depan, 1 tahun, semi-furnished, lantai 3–5!
```

---

### CASE S-11 | Sewa Apartemen | Customer Dengan Anak Kecil

```
Customer : mau sewa apart di Surabaya buat keluarga kecil, ada anak 3 tahun
AI       : Siap! Untuk keluarga dengan anak kecil, ada pertimbangan khusus ya. Di area Surabaya mana yang Anda cari?
Customer : Surabaya Barat, dekat sekolah TK yang bagus
AI       : Area Pakuwon atau Citraland punya beberapa TK internasional yang bagus. Sesuai?
Customer : Iya Pakuwon atau sekitarnya
AI       : Untuk anak 3 tahun, fasilitas playground atau taman bermain penting? Atau ada fasilitas lain yang wajib ada?
Customer : Playground wajib, kolam renang kalau bisa, tapi harus ada pagar pengaman
AI       : Sangat penting untuk keamanan si kecil. Budget per bulan?
Customer : 7-10 juta
AI       : Butuh berapa kamar? Anak punya kamar sendiri?
Customer : 2 kamar, satu buat anak
AI       : Kapan masuk?
Customer : Semester baru sekolah, Juli
AI       : Sewa berapa lama?
Customer : 1 tahun
AI       : Furnished?
Customer : Semi-furnished, ada beberapa barang sendiri
AI       : Lantai preferensi? Untuk anak kecil biasanya lantai rendah lebih disarankan.
Customer : Setuju, lantai 2-5 aja
AI       : Siap! Apart sewa 2KT di Pakuwon Surabaya Barat, playground + kolam berpagar, 7–10 juta/bulan, 3 orang, masuk Juli, 1 tahun, semi-furnished, lantai 2–5!
```

---

### CASE S-12 | Sewa Apartemen | Customer Minta Studio

```
Customer : cari studio apart buat anak kuliah di surabaya
AI       : Siap! Studio apartemen untuk mahasiswa di Surabaya. Kuliah di kampus mana?
Customer : ITS Sukolilo
AI       : Kalau dekat ITS, area MERR atau Mulyosari yang paling banyak dicari mahasiswa. Sesuai?
Customer : Iya, yang dekat ITS
AI       : Budget per bulan?
Customer : Maksimal 3 juta
AI       : Fasilitas yang paling penting?
Customer : WiFi kencang, keamanan, AC
AI       : Kapan masuk?
Customer : Awal semester, Agustus
AI       : Sewa berapa lama?
Customer : 1 semester dulu, 6 bulan
AI       : Furnished?
Customer : Full furnished, mahasiswa gak ada perabot
AI       : Lantai?
Customer : Tidak tinggi, malas naik tangga kalau lift rusak 😄
AI       : Haha, realistis! Siap: studio apart dekat ITS Surabaya, WiFi + keamanan + AC, max 3 juta/bulan, 1 orang, Agustus, 6 bulan, full furnished, lantai rendah!
```

---

### CASE S-13 | Sewa Apartemen | Customer Sudah Punya Kandidat, Tanya Second Opinion

```
Customer : Lagi consider antara Apartemen Puncak Bukit Golf sama East Coast di Surabaya Timur. Mana lebih baik untuk sewa?
AI       : Dua pilihan yang bagus di Surabaya Timur! Untuk membantu membandingkan — apa prioritas utama Anda?
Customer : Lokasi ke kantor di Rungkut dan fasilitas building
AI       : Untuk akses ke Rungkut, East Coast sedikit lebih dekat. Puncak Bukit Golf lebih mewah fasilitasnya. Spesifikasi unit yang Anda cari?
Customer : 1 kamar, furnished, ada gym
AI       : Budget per bulannya?
Customer : 5-7 juta
AI       : Tinggal sendiri atau ada yang ikut?
Customer : Sendiri
AI       : Preferensi lantai atau view?
Customer : City view atau pool view bagus
AI       : Sewa berapa lama?
Customer : Setahun
AI       : Mau saya bantu dapatkan penawaran dari keduanya sekaligus untuk perbandingan langsung?
Customer : Yes, itu lebih bagus
AI       : Siap! Saya minta penawaran dari Puncak Bukit Golf dan East Coast untuk unit 1KT, furnished, gym, pool/city view, 5–7 juta/bulan, 1 orang, 1 tahun. Nanti Anda tinggal pilih yang lebih baik!
```

---

### CASE S-14 | Sewa Apartemen | Customer Perlu Parkir Motor + Mobil

```
Customer : Sewa apart di Malang yang ada parkir motor dan mobil ya
AI       : Siap! Di Malang area mana yang Anda inginkan?
Customer : Dekat pusat kota atau Lowokwaru
AI       : Oke, area pusat atau Lowokwaru. Fasilitas lain yang wajib ada?
Customer : Parkir aman untuk 1 motor + 1 mobil, gym kalau ada
AI       : Budget per bulan?
Customer : 3-5 juta
AI       : Tinggal sendiri atau keluarga?
Customer : Berdua sama pacar, eh tunangan maksudnya
AI       : Selamat! 😄 Butuh berapa kamar?
Customer : 1 kamar sudah cukup
AI       : Kapan masuk?
Customer : September
AI       : Sewa berapa lama?
Customer : Setahun
AI       : Furnished?
Customer : Semi-furnished
AI       : Lantai preferensi?
Customer : Tengah, tidak terlalu rendah tidak terlalu tinggi
AI       : Siap! Apart sewa 1KT di pusat/Lowokwaru Malang, parkir motor + mobil + gym value-add, 3–5 juta/bulan, 2 orang, September, 1 tahun, semi-furnished, lantai tengah!
```

---

### CASE S-15 | Sewa Apartemen | Customer WA Singkat Jam Sibuk

```
Customer : apart sewa jaksel
AI       : Area spesifik?
Customer : kebayoran
AI       : Budget/bln & ukuran unit?
Customer : 6-9jt, 1 kamar
AI       : Fasilitas wajib?
Customer : gym kolam
AI       : Berapa orang & kapan masuk?
Customer : 2 org, bulan depan
AI       : Furnished?
Customer : full
AI       : Oke! Apart sewa 1KT Kebayoran Jaksel, gym + kolam, 6–9jt/bln, 2 org, bln depan, full furnished. Saya carikan!
```

---

## ═══════════════════════════════════════
## BAGIAN B: BELI APARTEMEN (20 CASE)
## ═══════════════════════════════════════

---

### CASE B-01 | Beli Apartemen | Customer Normal / Lengkap

```
Customer : Mau beli apartemen
AI       : Selamat! Di kota mana yang Anda inginkan?
Customer : Jakarta Selatan, dekat Sudirman atau Thamrin
AI       : Area CBD Jakarta Selatan. Fasilitas gedung yang wajib ada?
Customer : Kolam renang, gym, dan akses ke pusat perbelanjaan
AI       : Budget pembeliannya di kisaran berapa?
Customer : 800 juta sampai 1,5 miliar
AI       : Unit ini untuk ditempati sendiri atau investasi?
Customer : Campuran — ditempati dulu, nanti disewakan
AI       : Berapa orang yang akan menempati?
Customer : 2 orang, saya dan istri
AI       : Target belinya kapan?
Customer : 6 bulan ke depan
AI       : KPR atau cash?
Customer : KPR, sudah ada pre-approval dari CIMB
AI       : Berapa kamar yang diinginkan?
Customer : 1 kamar sudah cukup untuk berdua, tapi kalau ada 2 kamar dalam budget lebih bagus
AI       : Furnished atau kosongan?
Customer : Furnished basic dulu
AI       : Preferensi lantai dan view?
Customer : Lantai tinggi, city view atau pool view
AI       : Siap! Apart beli 1–2KT di Sudirman–Thamrin Jaksel, kolam + gym + mall access, 800 juta–1,5 M, KPR CIMB, 2 orang, target 6 bulan, furnished basic, lantai tinggi, city/pool view!
```

---

### CASE B-02 | Beli Apartemen | Customer Malas Ketik

```
Customer : beli apart sby
AI       : Area Surabaya mana?
Customer : barat
AI       : Budget?
Customer : 500-700jt
AI       : KPR/cash?
Customer : kpr
AI       : Berapa kamar?
Customer : 2
AI       : Target beli?
Customer : 3 bln
AI       : Untuk siapa?
Customer : keluarga, 3 org
AI       : Furnished?
Customer : semi
AI       : Lantai?
Customer : bebas
AI       : Siap! Apart beli 2KT Sby Barat, 500–700jt, KPR, 3 org, 3 bulan, semi-furnished. Cari!
```

---

### CASE B-03 | Beli Apartemen | Info Terbatas / Ambigu

```
Customer : mau beli apart yang bagus buat investasi
AI       : Pilihan cerdas! Di kota mana yang Anda pertimbangkan untuk investasi?
Customer : yang paling menguntungkan
AI       : Untuk investasi apartemen, beberapa area dengan yield tinggi saat ini: Jakarta (Jaksel/Jakpus), Surabaya (Surabaya Pusat/Timur), Bali (Seminyak/Canggu), atau Batam (Kawasan industri). Ada preferensi kota atau area tertentu?
Customer : Jakarta kayaknya paling aman
AI       : Betul, likuiditas Jakarta paling tinggi. Untuk investasi apartemen di Jakarta — apakah target Anda capital gain (harga naik) atau rental yield (disewakan)?
Customer : Keduanya kalau bisa
AI       : Untuk kombinasi keduanya, area Jaksel sekitar MRT paling potensial saat ini. Budget Anda berapa?
Customer : sekitar 600 juta - 1 miliar
AI       : Tipe unit berapa kamar? Studio lebih mudah disewakan, 2 kamar lebih baik untuk capital gain.
Customer : Hmm, saran Anda?
AI       : Untuk yield: studio atau 1KT. Untuk capital gain jangka panjang: 2KT. Kalau mau balance, 1KT di area MRT.
Customer : Oke, 1 kamar
AI       : KPR atau cash?
Customer : Cash kalau bisa, tapi KPR juga tidak masalah
AI       : Target beli kapan?
Customer : Tahun ini
AI       : Furnished atau kosongan untuk nanti disewakan?
Customer : Furnished supaya mudah disewa
AI       : Siap! Apart beli 1KT di area MRT Jaksel untuk investasi, 600 juta–1 M, cash/KPR, target tahun ini, furnished. Saya carikan yang yield sewanya paling optimal!
```

---

### CASE B-04 | Beli Apartemen | Customer Tanya Harga Duluan

```
Customer : Apartemen di Surabaya harganya berapa kalau beli?
AI       : Sangat bervariasi! Di Surabaya: studio mulai 200 juta, 1 kamar 350–700 juta, 2 kamar 500 juta–1,5 M, tergantung area dan gedung. Di area mana yang Anda incar?
Customer : Yang dekat Tunjungan Plaza atau Ciputra World
AI       : Area premium Surabaya Pusat. Di sana 1 kamar biasanya 500–900 juta. Budget Anda di range itu?
Customer : 600 sampai 900 juta
AI       : Bagus. Untuk apa — ditempati atau investasi?
Customer : Ditempati, saya pindah ke Surabaya untuk kerja
AI       : Berapa orang yang tinggal?
Customer : Saya sendiri
AI       : KPR atau cash?
Customer : KPR, tapi belum cek bank
AI       : Kami bisa bantu rekomendasi bank terbaik. Kapan target belinya?
Customer : 4 bulan ke depan, sebelum mulai kerja
AI       : Berapa kamar yang dibutuhkan?
Customer : Studio cukup, atau 1 kamar
AI       : Furnished?
Customer : Full furnished, tidak mau repot
AI       : Lantai dan view preferensi?
Customer : Tidak terlalu rendah, city view bagus
AI       : Siap! Apart beli studio/1KT dekat TP–Ciputra World Surabaya, 600–900 juta, KPR, 1 orang, target 4 bulan, full furnished, lantai tengah-atas, city view!
```

---

### CASE B-05 | Beli Apartemen | Customer Marah / Frustrasi

```
Customer : Sudah 5 bulan hunting apartemen di Jakarta, gak ada yang cocok atau agen-nya tidak responsif!
AI       : Wah, 5 bulan itu benar-benar melelahkan dan tidak adil untuk Anda. Saya pastikan pengalaman di sini berbeda — responsif dan transparan. Boleh ceritakan apa yang paling sering bikin tidak cocok?
Customer : Kalau harganya cocok, lokasinya jelek. Kalau lokasinya bagus, agen tidak mau diajak negosiasi
AI       : Paham. Dalam kasus Anda, apa 3 hal yang benar-benar non-negotiable?
Customer : 1. Dekat MRT, 2. Budget max 1,5 M, 3. Minimal 2 kamar
AI       : Tiga hal itu jelas dan feasible. Di Jakarta Selatan atau Pusat?
Customer : Jaksel prefer, tapi Jakpus juga tidak masalah
AI       : KPR atau cash?
Customer : KPR, BNI sudah approve 1,3 M
AI       : Target seberapa cepat?
Customer : Secepatnya, sudah tidak sabar
AI       : Untuk siapa apartemennya?
Customer : Saya dan istri
AI       : Furnished atau kosongan?
Customer : Semi-furnished
AI       : Lantai?
Customer : Tidak terlalu rendah
AI       : Saya akan langsung carikan dalam 24 jam: apart beli 2KT dekat MRT Jaksel–Jakpus, max 1,5 M, KPR BNI, 2 orang, semi-furnished. Dan saya yang handle negosiasi!
```

---

### CASE B-06 | Beli Apartemen | Customer Ganti-Ganti Keputusan

```
Customer : mau beli apartemen di Jakarta
AI       : Di area Jakarta mana yang Anda pertimbangkan?
Customer : Hmm, tadinya Jaksel, tapi Jakpus juga bagus kan? Dekat kantor juga
AI       : Keduanya punya kelebihan. Jaksel lebih banyak pilihan residensial, Jakpus lebih dekat CBD. Kantor Anda di mana?
Customer : Di Sudirman, Jakpus
AI       : Kalau begitu Jakpus atau area Sudirman–Semanggi lebih efisien. Budget?
Customer : 800 juta... tapi kalau ada yang bagus di bawah 1 M mau juga
AI       : Oke, range 800 juta–1 M. Berapa kamar?
Customer : 1 kamar cukup... tapi 2 kamar lebih nyaman sih
AI       : Untuk budget 800 juta–1 M di area Sudirman, 1 kamar lebih banyak pilihannya. 2 kamar di sana biasanya mulai 1,2 M. Mau naikkan budget atau pilih 1 kamar?
Customer : 1 kamar aja, prioritaskan lokasi
AI       : KPR atau cash?
Customer : KPR
AI       : Target beli?
Customer : 3-4 bulan
AI       : Untuk siapa?
Customer : Saya sendiri dulu
AI       : Furnished?
Customer : Full furnished kalau bisa
AI       : Lantai?
Customer : Tinggi, suka city view
AI       : Siap! Apart beli 1KT di area Sudirman Jakpus, 800 juta–1 M, KPR, 1 orang, target 3–4 bulan, full furnished, lantai tinggi, city view!
```

---

### CASE B-07 | Beli Apartemen | Customer Tidak Tahu (First Timer)

```
Customer : pertama kali mau beli apartemen, bingung
AI       : Selamat akan beli apartemen pertama! Normal bingung — saya bantu step by step. Mulai dari yang paling dasar: untuk ditempati sendiri atau investasi?
Customer : Ditempati dulu
AI       : Di kota mana Anda tinggal atau bekerja?
Customer : Surabaya
AI       : Di Surabaya — area mana yang paling sering Anda akses (kantor, keluarga, aktivitas)?
Customer : Kerja di Surabaya Barat, dekat Galaxy Mall Surabaya Timur kadang
AI       : Untuk dua area itu, Surabaya Pusat bisa jadi tengahnya, atau pilih salah satu yang lebih dominan. Budget Anda untuk beli berapa?
Customer : Belum tahu, gaji saya 12 juta. Sanggup berapa?
AI       : Dengan gaji 12 juta, cicilan KPR yang aman sekitar 3,5 juta/bulan. Itu setara apartemen 500–600 juta dengan tenor 20–30 tahun, tergantung DP. Sesuai rencana?
Customer : Iya kayaknya bisa
AI       : Berapa kamar? Tinggal sendiri atau ada keluarga?
Customer : Sendiri dulu, tapi mungkin menikah dalam setahun
AI       : Antisipasi nikah, 1 kamar atau 2 kamar. 2 kamar lebih investasi tapi sedikit lebih mahal. Mau 1 atau 2?
Customer : 1 kamar dulu aman
AI       : Target beli kapan?
Customer : Tahun ini
AI       : Furnished atau kosongan?
Customer : Semi-furnished
AI       : Lantai?
Customer : Bebas
AI       : Siap! Saya bantu: apart beli 1KT di Surabaya, 500–600 juta, KPR, target tahun ini, semi-furnished. Dan saya bantu juga proses KPR-nya dari awal!
```

---

### CASE B-08 | Beli Apartemen | Fokus Investasi / Yield Tinggi

```
Customer : Mau beli apartemen untuk investasi disewakan, mana yang yield-nya tinggi?
AI       : Pertanyaan yang tepat! Untuk yield tinggi, beberapa area yang kuat saat ini: Bali (Canggu/Seminyak), Batam (industrial area), Surabaya dekat kampus, Yogyakarta wisata. Budget Anda berapa?
Customer : 400-700 juta
AI       : Di range itu, Bali dan Jogja memberikan yield sewa 8–12% per tahun untuk unit yang tepat. Jakarta lebih ke capital gain. Mana yang lebih cocok dengan tujuan Anda?
Customer : Yield sewa dulu, modal balik dulu
AI       : Bali atau Jogja lebih cocok. Ada preferensi?
Customer : Bali lebih menarik
AI       : Area Bali mana yang Anda pertimbangkan?
Customer : Canggu, dengar banyak turis ke sana
AI       : Tepat! Canggu sangat populer untuk short-term rental. KPR atau cash?
Customer : Cash
AI       : Target beli kapan?
Customer : 3 bulan
AI       : Ukuran unit yang ideal untuk disewakan?
Customer : Studio atau 1 kamar, yang lebih banyak dicari turis?
AI       : Studio dan 1 kamar dengan pool access paling banyak dicari di Canggu. Mau saya carikan yang punya occupancy tinggi?
Customer : Ya, penting itu
AI       : Siap! Apart beli studio/1KT di Canggu Bali untuk investasi sewa, 400–700 juta, cash, target 3 bulan, furnished, dekat kolam. Saya fokuskan pada yang histori occupancy-nya kuat!
```

---

### CASE B-09 | Beli Apartemen | Customer Minta yang Dekat MRT/KRL

```
Customer : Beli apartemen yang ada di dekat stasiun MRT Jakarta
AI       : Pilihan sangat strategis! Jalur MRT Jakarta: Lebak Bulus–Bundaran HI. Area stasiunnya mana yang Anda incar?
Customer : Antara Blok M, Haji Nawi, atau Cipete
AI       : Ketiganya ada di area Jaksel yang berkembang pesat. Budget?
Customer : 700 juta–1,2 M
AI       : Spesifikasi unit?
Customer : 1–2 kamar, untuk saya dan istri
AI       : KPR atau cash?
Customer : KPR, simulasi BRI sudah dilakukan
AI       : Target beli?
Customer : 4 bulan
AI       : Furnished atau kosongan?
Customer : Semi-furnished
AI       : Lantai dan view preferensi?
Customer : Tidak terlalu tinggi, max lantai 15
AI       : Siap! Apart beli 1–2KT dekat MRT Blok M/Haji Nawi/Cipete Jaksel, 700 juta–1,2 M, KPR BRI, 2 orang, target 4 bulan, semi-furnished, max lantai 15!
```

---

### CASE B-10 | Beli Apartemen | Customer Perlu Parking Banyak

```
Customer : Beli apartemen di Surabaya yang bisa dapat slot parkir 2 unit
AI       : Cukup spesifik, dan bagus untuk diantisipasi! Di area Surabaya mana?
Customer : Surabaya Pusat atau Timur
AI       : Budget?
Customer : 1–1,5 M
AI       : Untuk 2 slot parkir, beberapa gedung kenakan biaya tambahan. Itu dalam anggaran Anda?
Customer : Iya selama total tidak jauh dari 1,5 M
AI       : Unit berapa kamar?
Customer : 2 kamar
AI       : KPR atau cash?
Customer : KPR
AI       : Target beli?
Customer : 6 bulan
AI       : Untuk siapa?
Customer : Saya dan istri, beserta pembantu
AI       : Jadi 3 orang. Furnished?
Customer : Semi-furnished
AI       : Lantai?
Customer : Tengah, tidak terlalu ekstrem
AI       : Siap! Apart beli 2KT di Surabaya Pusat/Timur, 2 slot parkir, 1–1,5 M, KPR, 3 orang, target 6 bulan, semi-furnished, lantai tengah!
```

---

### CASE B-11 | Beli Apartemen | Customer WNI dari Luar Negeri

```
Customer : Saya WNI tinggal di Singapore, mau beli apartemen di Indonesia untuk investasi
AI       : Tentu bisa! WNI di luar negeri bisa beli apartemen di Indonesia. Ada beberapa ketentuan khusus terkait dokumen. Di kota mana yang Anda pertimbangkan?
Customer : Jakarta atau Bali, mana yang lebih menarik untuk investasi?
AI       : Tergantung tujuan: Jakarta untuk capital gain jangka panjang, Bali untuk rental yield yang lebih cepat. Budget Anda berapa?
Customer : 500 juta–1 M SGD... eh Rupiah, 500 juta–1 M Rupiah
AI       : Di range itu, Bali memberikan yield lebih menarik untuk short-term rental. Jakarta untuk harga yang lebih stabil. Mana prioritas?
Customer : Yield dulu, butuh cashflow
AI       : Bali lebih cocok. KPR atau cash? Catatan: WNI di luar negeri biasanya lebih mudah dengan cash atau KPR bank Singapura yang punya kerjasama.
Customer : Cash lebih mudah
AI       : Target beli kapan?
Customer : 2 bulan ke depan, ada kunjungan ke Indonesia
AI       : Unit berapa kamar?
Customer : 1 kamar, untuk disewakan ke wisatawan
AI       : Area Bali mana?
Customer : Seminyak atau Canggu
AI       : Siap! Apart beli 1KT di Seminyak/Canggu Bali, 500 juta–1 M, cash, target 2 bulan (saat kunjungan ke Indonesia), furnished untuk disewakan. Saya siapkan juga dokumen yang perlu disiapkan dari Singapore!
```

---

### CASE B-12 | Beli Apartemen | Customer Tanya Developer Terpercaya

```
Customer : Mau beli apartemen dari developer terpercaya di Surabaya, ada rekomendasi?
AI       : Di Surabaya, beberapa developer besar yang punya track record bagus: Pakuwon Group, Ciputra, Intiland, Wika Realty, dan PP Properti. Apakah Anda sudah ada di pikiran atau mau saya bantu bandingkan?
Customer : Pakuwon vs Ciputra, mana yang lebih bagus?
AI       : Keduanya premium. Pakuwon lebih ke ekosistem terpadu (mall, hotel, hunian dalam 1 kawasan), Ciputra lebih ke perencanaan kota mandiri. Untuk investasi atau huni?
Customer : Huni sendiri
AI       : Budget?
Customer : 800 juta–1,3 M
AI       : Untuk huni sendiri di range itu, unit 1–2KT dari Pakuwon atau Ciputra bisa didapat. Spesifikasi yang dibutuhkan?
Customer : 2 kamar, fasilitas lengkap
AI       : KPR atau cash?
Customer : KPR, Mandiri sudah approve
AI       : Target beli?
Customer : 4 bulan
AI       : Keluarga berapa orang?
Customer : 3 orang
AI       : Furnished?
Customer : Semi-furnished
AI       : Lantai dan view?
Customer : City view, lantai tengah-atas
AI       : Siap! Saya siapkan penawaran dari Pakuwon dan Ciputra untuk unit 2KT, 800 juta–1,3 M, KPR Mandiri, 3 orang, target 4 bulan, semi-furnished, city view. Nanti Anda bandingkan langsung!
```

---

### CASE B-13 | Beli Apartemen | Customer Tanya Soal Status SHM vs SHMSRS

```
Customer : Mau beli apartemen tapi bingung bedanya SHM dan SHMSRS
AI       : Pertanyaan penting sebelum beli! Singkatnya: SHM (Sertifikat Hak Milik) untuk tanah dan rumah tapak. SHMSRS (Sertifikat Hak Milik atas Satuan Rumah Susun) adalah SHM khusus untuk apartemen/satuan hunian vertikal — ini yang dikeluarkan untuk unit apartemen. Untuk apartemen, SHMSRS adalah yang terkuat dan diakui bank untuk KPR. Sekarang, di kota mana Anda cari apartemennya?
Customer : Jakarta, mau yang sudah SHMSRS
AI       : Tepat, prioritaskan yang sudah SHMSRS. Area Jakarta mana?
Customer : Jakarta Barat, sekitar Puri Indah
AI       : Budget?
Customer : 600-900 juta
AI       : Berapa kamar?
Customer : 2 kamar
AI       : KPR atau cash?
Customer : KPR
AI       : Target beli?
Customer : 5 bulan
AI       : Keluarga berapa orang?
Customer : 4 orang
AI       : Furnished?
Customer : Semi
AI       : Siap! Apart beli 2KT di Puri Indah Jakarta Barat, status SHMSRS, 600–900 juta, KPR, 4 orang, target 5 bulan, semi-furnished!
```

---

### CASE B-14 | Beli Apartemen | Customer Tanya Cicilan Per Bulan

```
Customer : Kalau beli apartemen di Surabaya 700 juta, cicilan KPR-nya kira-kira berapa?
AI       : Simulasi KPR: untuk 700 juta dengan DP 20% (140 juta), pokok pinjaman 560 juta. Dengan tenor 20 tahun dan bunga 7,5%, cicilan sekitar 4,4 juta/bulan. Tenor 30 tahun sekitar 3,9 juta/bulan. Gaji Anda cukup? (idealnya cicilan max 30% dari gaji)
Customer : Gaji saya 15 juta, sepertinya bisa
AI       : Sangat feasible! Di Surabaya area mana yang Anda incar?
Customer : Surabaya Pusat atau dekat Pakuwon
AI       : Budget 700 juta, spesifikasi unit?
Customer : 1-2 kamar, untuk berdua sama istri
AI       : KPR bank mana? Atau belum tahu?
Customer : Belum, nanti dibantu ya
AI       : Tentu! Target beli kapan?
Customer : 4 bulan
AI       : Furnished?
Customer : Semi
AI       : Lantai?
Customer : Tengah
AI       : Siap! Apart beli 1–2KT di Surabaya Pusat/Pakuwon, 700 juta, KPR (kami bantu pilih bank), 2 orang, target 4 bulan, semi-furnished, lantai tengah. Estimasi cicilan 3,9–4,4 juta/bulan!
```

---

### CASE B-15 | Beli Apartemen | Customer Tanya Tentang Inden

```
Customer : Beli apartemen inden itu aman tidak?
AI       : Pertanyaan bagus! Inden bisa menguntungkan (harga lebih murah, bisa pilih unit bagus), tapi ada risiko (jadwal molor, developer bermasalah). Tips amannya: beli dari developer dengan track record selesai tepat waktu, sudah ada PPJB (Perjanjian Pengikatan Jual Beli), dan cicilan bertahap sesuai progress konstruksi. Apakah Anda mempertimbangkan unit inden tertentu?
Customer : Iya ada yang tawarkan inden di Surabaya Barat, harga 400 juta untuk studio
AI       : Developer mana yang menawarkan? Saya bisa bantu cek reputasinya.
Customer : Nanti saya share namanya. Budget saya sekitar 350–450 juta
AI       : Oke. Untuk apa unitnya — ditempati atau investasi?
Customer : Investasi, nanti disewakan
AI       : Lantai dan view preferensi untuk disewakan nanti?
Customer : Yang paling menarik untuk penyewa
AI       : Pool view atau city view lantai tinggi paling banyak dicari penyewa. Kapan target belinya?
Customer : Dalam 2 bulan
AI       : KPR atau cash?
Customer : Cash untuk inden lebih aman katanya
AI       : Betul, cash lebih aman untuk inden karena tidak terikat bank. Siap! Setelah Anda share nama developernya, saya bantu verifikasi dan carikan perbandingan opsi lain juga!
```

---

### CASE B-16 | Beli Apartemen | Customer Tanya Green Building

```
Customer : Ada apartemen green building yang bisa dibeli di Indonesia?
AI       : Ada! Beberapa gedung di Jakarta dan Surabaya sudah tersertifikasi green building (GBCI atau LEED). Di kota mana Anda cari?
Customer : Jakarta Selatan
AI       : Di Jaksel ada beberapa yang sudah green certified. Budget?
Customer : 1-1,5 M
AI       : Berapa kamar?
Customer : 2 kamar untuk keluarga kecil
AI       : KPR atau cash?
Customer : KPR
AI       : Target beli?
Customer : 6 bulan
AI       : Keluarga berapa orang?
Customer : 3 orang
AI       : Furnished?
Customer : Semi
AI       : Lantai dan view?
Customer : Tidak terlalu tinggi, max lantai 20
AI       : Siap! Apart beli 2KT green building di Jaksel, 1–1,5 M, KPR, 3 orang, target 6 bulan, semi-furnished, max lantai 20!
```

---

### CASE B-17 | Beli Apartemen | Customer Sudah Hampir Memutuskan

```
Customer : Sudah hampir mau beli apartemen di Pakuwon City Surabaya unit 2 kamar, tapi masih ragu
AI       : Boleh tahu apa yang masih membuat ragu? Terkadang satu informasi tambahan bisa membantu membuat keputusan.
Customer : Harganya 1,2 miliar, tapi belum tahu apakah itu wajar untuk area sana
AI       : Di Pakuwon City, unit 2KT sekarang memang di range 900 juta–1,5 M tergantung lantai dan view. 1,2 M masuk di tengah-tengah, cukup wajar. Apakah itu unit baru atau second?
Customer : Baru, unit inden tapi selesai 6 bulan lagi
AI       : Developer Pakuwon punya track record bagus untuk menyelesaikan proyek on time. Itu mengurangi risiko inden. Ada yang lain yang masih mengganjal?
Customer : Apakah bisa negosiasi harga?
AI       : Untuk inden yang selesai 6 bulan lagi, ruang nego biasanya 3–5%. Kalau Anda bayar cash atau DP besar, bisa lebih. Mau saya bantu fasilitasi negosiasi?
Customer : Iya tolong
AI       : Siap! Untuk membantu negosiasi terbaik — KPR atau cash rencananya?
Customer : KPR, BCA
AI       : Dan total anggaran max Anda untuk unit ini?
Customer : Kalau bisa dapat di 1,1 M bagus
AI       : Saya akan approach developer dengan posisi buyer serius KPR BCA, target 1,1 M. Mari kita coba!
```

---

### CASE B-18 | Beli Apartemen | Customer Perlu Aksesibilitas Khusus

```
Customer : Mau beli apartemen untuk orang tua yang sudah lansia, perlu yang aksesibel
AI       : Pertimbangan yang sangat bijak! Beberapa hal penting untuk lansia: lantai rendah atau gedung dengan lift yang selalu berfungsi baik, akses tanpa tangga, fasilitas kesehatan atau klinik di area, dan keamanan 24 jam. Di kota mana?
Customer : Surabaya
AI       : Area Surabaya mana yang paling dekat dengan aktivitas atau fasilitas kesehatan untuk orang tua?
Customer : Dekat RS RKZ atau RS Siloam Surabaya
AI       : Area Darmo–Satelit yang paling dekat kedua RS itu. Sesuai?
Customer : Iya
AI       : Budget pembelian?
Customer : 500-800 juta
AI       : Unit berapa kamar?
Customer : 2 kamar, 1 untuk orang tua, 1 cadangan
AI       : KPR atau cash?
Customer : Cash
AI       : Target beli?
Customer : 3 bulan
AI       : Furnished atau kosongan?
Customer : Semi, tapi perlu modifikasi untuk aksesibilitas (pegangan di kamar mandi dll)
AI       : Sangat tepat! Saya akan prioritaskan unit di lantai rendah (2–5), dekat lift, dan gedung yang dikenal untuk kenyamanan aksesibilitas. Siap! Apart beli 2KT dekat RS Darmo–Satelit Surabaya, aksesibel, 500–800 juta, cash, target 3 bulan, semi-furnished!
```

---

### CASE B-19 | Beli Apartemen | Customer Perlu Cepat Karena Promo

```
Customer : Katanya ada promo apartemen limited bulan ini di Surabaya, masih ada gak?
AI       : Ada beberapa developer yang memang punya promo akhir tahun atau special launch. Boleh tahu proyek atau area mana yang Anda dengar promonya?
Customer : Lupa nama proyeknya, tapi di Surabaya Timur daerah MERR
AI       : Saya cek dulu. Di MERR Surabaya Timur ada beberapa proyek. Budget Anda berapa kalau ada yang cocok?
Customer : 400-600 juta
AI       : Berapa kamar?
Customer : 1 kamar cukup
AI       : KPR atau cash?
Customer : KPR
AI       : Untuk siapa?
Customer : Sendiri, first time buyer
AI       : Kapan bisa proses jika cocok?
Customer : Segera, karena kata temannya promo habis bulan ini
AI       : Furnished?
Customer : Kosongan tidak masalah kalau harganya worth it
AI       : Siap! Saya cek proyek di MERR Surabaya Timur dengan promo saat ini, 1KT, 400–600 juta, KPR, 1 orang, kosongan/furnished. Saya hubungi Anda hari ini karena urgensi promo ya!
```

---

### CASE B-20 | Beli Apartemen | Customer WA Singkat

```
Customer : beli apart jakpus
AI       : Area spesifik?
Customer : sudirman
AI       : Budget & kamar?
Customer : 1M, 1KT
AI       : KPR/cash?
Customer : kpr
AI       : Target?
Customer : 3 bln
AI       : Berapa orang & furnished?
Customer : 2 org, full furnished
AI       : Lantai?
Customer : tinggi
AI       : Siap! Apart beli 1KT Sudirman Jakpus, 1M, KPR, 2 org, 3 bln, full furnished, lantai tinggi!
```

---

## 📋 RINGKASAN SLOT DATA — APARTEMEN

| Slot | Sewa | Beli | Keterangan |
|------|------|------|------------|
| transaction_type | ✅ | ✅ | sewa/beli |
| location_city | ✅ | ✅ | Kota target |
| location_detail | ✅ | ✅ | Area/gedung/landmark |
| facilities | ⭕ | ⭕ | Gym, kolam, keamanan |
| budget | ✅ | ✅ | Range min-max |
| occupants | ✅ | ✅ | Inferensi ukuran unit |
| move_in_date | ✅ | ✅ | Bulan/tanggal |
| duration | ✅ Sewa | ❌ | Berapa lama sewa |
| payment_terms | ✅ >1thn | ❌ | Cicil/lunas |
| furnished | ✅ | ✅ | Furnished/semi/kosong |
| financing | ❌ | ✅ | KPR/cash |
| tower_preference | ⭕ | ⭕ | Multi-tower building |
| floor_preference | ✅ | ✅ | Rendah/tengah/tinggi |
| view_preference | ⭕ | ⭕ | City/pool/garden view |
| unit_type | ✅ | ✅ | Studio/1KT/2KT/dll |

---

*File: 02_SKILL_APARTMENT.md | Elevan Property Chatbot Skills v1.0*

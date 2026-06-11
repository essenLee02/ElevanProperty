# SKILL: SHOPHOUSE / RUKO — Panduan Respons Chatbot Property
**Tipe Property:** Ruko (Shophouse)
**Transaksi:** Sewa & Beli
**Total Case:** 35 (15 Sewa + 20 Beli)

---

## 🔧 ATURAN KHUSUS RUKO

### Karakteristik:
- Ruko = Rumah Toko: fungsi campuran (tempat usaha + bisa tinggal di lantai atas)
- Sewa = sewa ruko untuk usaha / hunian + usaha
- Beli = beli aset ruko

### Slot Tambahan:
```json
{
  "business_type": null,
  "floors": null,
  "luas_bangunan": null,
  "luas_tanah": null,
  "frontage_width": null,
  "corner_position": false,
  "pedestrian_traffic": null
}
```

### Pertanyaan Tambahan untuk Ruko:
- Tipe bisnis apa yang akan dijalankan?
- Butuh berapa lantai?
- Lebar muka (frontage) minimal berapa meter?
- Perlu posisi hook/sudut?
- Kebutuhan parkir pelanggan

---

## ═══════════════════════════════════════
## BAGIAN A: SEWA RUKO (15 CASE)
## ═══════════════════════════════════════

---

### CASE S-01 | Sewa Ruko | Customer Normal / Lengkap
```
Customer : Saya mau sewa ruko untuk usaha
AI       : Siap! Untuk usaha apa ruko yang Anda butuhkan? Ini penting agar saya bisa rekomendasikan lokasi yang paling strategis.
Customer : Untuk cafe dan resto kecil
AI       : Cafe dan resto — traffic pejalan kaki dan visibilitas dari jalan sangat penting. Di kota dan area mana?
Customer : Surabaya, daerah Raya Darmo atau Citraland
AI       : Area premium Surabaya Barat dan Pusat. Berapa lantai yang dibutuhkan?
Customer : 2 lantai, lantai bawah untuk cafe, lantai atas dapur dan gudang
AI       : Budget sewa per bulan?
Customer : 15–25 juta per bulan
AI       : Lebar muka minimal berapa meter?
Customer : Minimal 5 meter, biar terlihat dari jalan
AI       : Perlu parkir untuk pelanggan?
Customer : Iya, minimal bisa parkir 5–10 mobil
AI       : Kapan rencananya mulai operasional?
Customer : 3 bulan lagi
AI       : Sewa berapa lama?
Customer : 3 tahun
AI       : Perlu posisi hook/sudut?
Customer : Kalau ada hook lebih bagus, tapi tidak wajib
AI       : Siap! Ruko sewa 2 lantai di Raya Darmo/Citraland Surabaya, frontage min 5m, parkir 5–10 mobil, 15–25 juta/bulan, 3 tahun, mulai 3 bulan lagi, hook preferred!
```

---

### CASE S-02 | Sewa Ruko | Malas Ketik
```
Customer : sewa ruko surabaya buat toko
AI       : Area & tipe toko?
Customer : darmo, toko fashion
AI       : Berapa lantai & budget/bln?
Customer : 2 lt, 12-18jt
AI       : Kapan & berapa lama?
Customer : 2 bln lagi, 2 tahun
AI       : Lebar muka minimal?
Customer : 4 meter
AI       : Siap! Ruko sewa 2 lantai di Darmo Surabaya, toko fashion, frontage 4m, 12–18jt/bln, 2 tahun, mulai 2 bulan lagi!
```

---

### CASE S-03 | Sewa Ruko | Info Terbatas / Ambigu
```
Customer : mau sewa ruko untuk usaha baru
AI       : Menarik! Boleh tahu usaha apa yang akan dijalankan? Jenis bisnis sangat mempengaruhi lokasi ideal.
Customer : Masih belum pasti, mungkin jual makanan atau jasa
AI       : Dua opsi yang berbeda kebutuhan lokasinya. Kuliner butuh traffic tinggi dan parkir. Jasa lebih butuh aksesibilitas dan profesionalisme. Ada yang lebih condong?
Customer : Sepertinya kuliner, buka kedai kopi
AI       : Kedai kopi! Di kota mana?
Customer : Malang
AI       : Area Malang mana yang Anda pertimbangkan?
Customer : Yang rame orang muda, tahu yang lagi tren
AI       : Untuk pasar anak muda di Malang: Jalan Ijen, Soekarno Hatta, atau area Lowokwaru dekat UB. Mana yang paling dekat dengan jaringan Anda?
Customer : Jalan Ijen kedengarannya bagus
AI       : Budget sewa per bulan?
Customer : Belum tahu, berapa yang wajar untuk kedai kopi di sana?
AI       : Di Jalan Ijen, ruko 1–2 lantai biasanya 6–15 juta/bulan. Budget Anda lebih ke mana?
Customer : 8-12 juta oke
AI       : Berapa lantai?
Customer : 1–2 lantai
AI       : Kapan rencananya buka?
Customer : 2–3 bulan lagi
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Siap! Ruko sewa 1–2 lantai di Jalan Ijen Malang untuk kedai kopi, 8–12 juta/bulan, 2 tahun, mulai 2–3 bulan lagi!
```

---

### CASE S-04 | Sewa Ruko | Tanya Harga Duluan
```
Customer : Sewa ruko di Surabaya Pusat berapa per bulannya?
AI       : Di Surabaya Pusat, ruko 1 lantai mulai 5–10 juta, ruko 2 lantai 10–25 juta, ruko 3 lantai di area premium bisa 20–50 juta per bulan. Tergantung lokasi dan lebar muka. Untuk usaha apa?
Customer : Klinik kecantikan
AI       : Klinik kecantikan — butuh area yang aksesibel, parkir cukup, dan kesan "professional". Di area mana di Surabaya Pusat?
Customer : Sekitar Basuki Rahmat atau Raya Darmo
AI       : Berapa lantai yang dibutuhkan?
Customer : 2 lantai, lantai 1 untuk treatment, lantai 2 untuk konsultasi
AI       : Budget per bulan?
Customer : 18–30 juta
AI       : Kapan mulai?
Customer : 4 bulan lagi
AI       : Sewa berapa lama?
Customer : 3 tahun
AI       : Siap! Ruko sewa 2 lantai di Basuki Rahmat/Raya Darmo Surabaya, klinik kecantikan, 18–30 juta/bulan, 3 tahun, mulai 4 bulan lagi!
```

---

### CASE S-05 | Sewa Ruko | Marah / Frustrasi
```
Customer : Udah lihat 10 ruko di Jakarta, gak ada yang pas! Lokasinya bagus harganya selangit, harganya oke lokasinya jelek
AI       : Itu sangat melelahkan, terutama kalau waktu sudah mepet! Saya bantu carikan yang lebih sesuai. Untuk usaha apa ruko ini?
Customer : Showroom furniture premium
AI       : Showroom furniture — butuh lebar muka yang besar dan mudah dijangkau kendaraan. Di Jakarta area mana yang masih Anda pertimbangkan?
Customer : Jakarta Selatan atau Jakarta Barat
AI       : Budget per bulan yang masih feasible?
Customer : Max 35 juta per bulan
AI       : Berapa lantai dan lebar muka minimal?
Customer : 3 lantai, frontage min 7 meter
AI       : Kapan butuh?
Customer : Bulan depan, sudah mepet
AI       : Sewa berapa lama?
Customer : 3 tahun
AI       : Perlu parkir luas?
Customer : Iya, untuk truk pengiriman dan pelanggan
AI       : Saya carikan prioritas: ruko 3 lantai frontage 7m+ di Jaksel/Jakbar, parkir luas, max 35 juta/bulan, tersedia bulan depan, 3 tahun!
```

---

### CASE S-06 | Sewa Ruko | Ganti-Ganti Keputusan
```
Customer : Mau sewa ruko di Surabaya untuk usaha
AI       : Untuk usaha apa?
Customer : Tadinya mau salon, tapi kayaknya mau apotek
AI       : Keduanya punya kebutuhan lokasi berbeda. Salon perlu area yang ramai dan visible, apotek perlu dekat perumahan atau fasilitas kesehatan. Sudah ada keputusan?
Customer : Apotek lebih stabil kayaknya
AI       : Bagus! Apotek idealnya dekat perumahan padat atau dekat rumah sakit. Area Surabaya mana?
Customer : Surabaya Timur... tapi dekat RS juga bagus
AI       : Di Surabaya Timur ada beberapa RS besar seperti RKZ dan Siloam. Dekat sana sangat strategis. Oke untuk area itu?
Customer : Iya, dekat RS bagus
AI       : Budget per bulan?
Customer : 10–15 juta... mungkin bisa 18 juta kalau lokasi strategis
AI       : Berapa lantai?
Customer : 1 lantai cukup untuk apotek
AI       : Kapan mulai?
Customer : 3 bulan
AI       : Sewa berapa lama?
Customer : 3 tahun, bisa perpanjang
AI       : Siap! Ruko sewa 1 lantai dekat RS di Surabaya Timur, untuk apotek, 10–18 juta/bulan, 3 tahun, mulai 3 bulan lagi!
```

---

### CASE S-07 | Sewa Ruko | Tidak Tahu Yang Mau
```
Customer : mau sewa ruko tapi masih bingung usaha apa
AI       : Menarik! Ini justru kesempatan bagus — tentukan dulu konsep bisnisnya baru pilih ruko yang paling sesuai. Punya modal awal kira-kira berapa?
Customer : Sekitar 500 juta untuk modal usaha
AI       : Dengan modal 500 juta, beberapa bisnis yang cocok dengan format ruko: F&B (cafe, resto), minimart/convenience store, klinik/apotek, atau fashion retail. Ada yang sudah pernah terpikir?
Customer : F&B kayaknya sesuai passion saya
AI       : F&B di ruko sangat populer! Di kota mana Anda berencana?
Customer : Surabaya
AI       : Target pasar? Anak muda, keluarga, atau perkantoran?
Customer : Anak muda dan keluarga
AI       : Area Citraland, Darmo, atau Galaxy Mall punya traffic kedua segmen itu. Budget sewa ruko per bulan?
Customer : 10–20 juta
AI       : Berapa lantai?
Customer : 2 lantai
AI       : Kapan mulai?
Customer : 3–4 bulan lagi
AI       : Sewa berapa lama?
Customer : 2 tahun dulu
AI       : Siap! Ruko sewa 2 lantai di area traffic tinggi Surabaya (Citraland/Darmo), untuk F&B, 10–20 juta/bulan, 2 tahun, mulai 3–4 bulan lagi!
```

---

### CASE S-08 | Sewa Ruko | Butuh Hook / Sudut
```
Customer : Mau sewa ruko hook di Surabaya untuk minimarket
AI       : Ruko hook sangat ideal untuk minimarket — visibilitas dari dua arah jalan! Di area Surabaya mana?
Customer : Surabaya Barat, perumahan padat
AI       : Pakuwon, Citraland, atau Wiyung area perumahan padat. Mana yang Anda targetkan?
Customer : Wiyung atau sekitar Menganti
AI       : Budget sewa per bulan?
Customer : 8–14 juta
AI       : Berapa lantai?
Customer : 1 lantai cukup untuk minimarket
AI       : Kapan mulai?
Customer : 2 bulan lagi
AI       : Sewa berapa lama?
Customer : 3 tahun
AI       : Siap! Ruko hook 1 lantai di Wiyung/Menganti Surabaya Barat, untuk minimarket, 8–14 juta/bulan, 3 tahun, mulai 2 bulan lagi!
```

---

### CASE S-09 | Sewa Ruko | Untuk Kantor
```
Customer : Cari ruko buat kantor startup di Jakarta
AI       : Ruko untuk kantor startup — butuh kesan profesional dan aksesibel. Di area Jakarta mana?
Customer : Jakarta Selatan, daerah startup ecosystem
AI       : Area Kuningan, Kemang, atau Mampang banyak startup yang setup di ruko. Mana yang diinginkan?
Customer : Kemang lebih cocok suasananya
AI       : Budget sewa per bulan?
Customer : 15–25 juta
AI       : Berapa lantai?
Customer : 3 lantai — lantai 1 meeting room, lantai 2–3 open space
AI       : Berapa orang yang akan bekerja?
Customer : Tim 20–25 orang
AI       : Kapan mulai?
Customer : Bulan depan
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Siap! Ruko 3 lantai di Kemang Jaksel untuk kantor startup 25 orang, 15–25 juta/bulan, 2 tahun, mulai bulan depan!
```

---

### CASE S-10 | Sewa Ruko | Untuk Salon/Kecantikan
```
Customer : Sewa ruko untuk salon di Bandung
AI       : Salon di Bandung — pasar yang besar! Di area mana yang Anda targetkan?
Customer : Setiabudi atau Dago, target kelas menengah atas
AI       : Budget sewa per bulan?
Customer : 12–20 juta
AI       : Berapa lantai?
Customer : 2 lantai, salon di lantai 1, ruang VIP di lantai 2
AI       : Lebar muka minimal?
Customer : 5–6 meter biar keliatan dari jalan
AI       : Kapan mulai?
Customer : 3 bulan lagi
AI       : Sewa berapa lama?
Customer : 3 tahun
AI       : Parkir diperlukan?
Customer : Iya, minimal 3–4 slot
AI       : Siap! Ruko sewa 2 lantai di Setiabudi/Dago Bandung, frontage 5–6m + parkir, untuk salon premium, 12–20 juta/bulan, 3 tahun, mulai 3 bulan lagi!
```

---

### CASE S-11 | Sewa Ruko | Untuk Toko Online (Gudang + Showroom)
```
Customer : Mau sewa ruko untuk bisnis online, perlu showroom kecil dan area packing
AI       : Tren yang semakin banyak — ruko hybrid online + offline! Di kota mana?
Customer : Surabaya
AI       : Area mana? Dekat jalan utama untuk visibilitas atau area industri untuk efisiensi logistik?
Customer : Lebih ke logistik, dekat akses jalan tol
AI       : Area Surabaya Timur dekat MERR atau Waru Sidoarjo punya akses tol yang bagus. Sesuai?
Customer : Waru oke
AI       : Budget sewa per bulan?
Customer : 8–15 juta
AI       : Berapa lantai dan luas yang dibutuhkan?
Customer : 2 lantai, lantai 1 showroom + packing, lantai 2 gudang
AI       : Kapan mulai?
Customer : Bulan depan
AI       : Sewa berapa lama?
Customer : 2 tahun
AI       : Siap! Ruko sewa 2 lantai di Waru Surabaya, dekat tol, showroom + packing + gudang, 8–15 juta/bulan, 2 tahun, mulai bulan depan!
```

---

### CASE S-12 | Sewa Ruko | Tanya Izin Usaha
```
Customer : Sebelum sewa ruko buat resto, perlu izin apa?
AI       : Pertanyaan penting sebelum mulai! Untuk restoran di ruko, izin yang umumnya dibutuhkan: (1) Izin Usaha (NIB via OSS), (2) Izin Tempat Usaha / SIUP, (3) Sertifikat Laik Higiene Sanitasi dari Dinas Kesehatan, (4) Izin Reklame jika pasang papan nama, (5) BPJS Ketenagakerjaan untuk karyawan. Izin rumit tidak kalau diurus sendiri, tapi kami bisa bantu rekomendasi konsultan perizinan. Sekarang boleh tahu ruko di kota mana?
Customer : Surabaya, sudah mau cari ruko
AI       : Bagus! Area mana di Surabaya?
Customer : Raya Darmo
AI       : Budget per bulan?
Customer : 20–30 juta
AI       : Berapa lantai?
Customer : 2 lantai
AI       : Kapan mulai?
Customer : 3 bulan lagi
AI       : Sewa berapa lama?
Customer : 3 tahun
AI       : Siap! Ruko sewa 2 lantai di Raya Darmo Surabaya, untuk restoran, 20–30 juta/bulan, 3 tahun, mulai 3 bulan lagi. Saya bantu juga rekomendasikan konsultan perizinan!
```

---

### CASE S-13 | Sewa Ruko | Untuk Klinik
```
Customer : Cari ruko untuk klinik umum di Malang
AI       : Klinik umum di ruko — kebutuhan utama: parkir cukup, dekat perumahan padat, mudah diakses. Di area Malang mana?
Customer : Lowokwaru atau Sukun, dekat perumahan
AI       : Budget sewa per bulan?
Customer : 10–18 juta
AI       : Berapa lantai?
Customer : 2 lantai — poli di lantai 1, apotek kecil dan ruang dokter di lantai 2
AI       : Lebar muka minimal?
Customer : 4 meter
AI       : Kapan mulai?
Customer : 4 bulan
AI       : Sewa berapa lama?
Customer : 3 tahun
AI       : Siap! Ruko sewa 2 lantai di Lowokwaru/Sukun Malang, untuk klinik umum, frontage 4m, 10–18 juta/bulan, 3 tahun, mulai 4 bulan lagi!
```

---

### CASE S-14 | Sewa Ruko | Short Term / Event
```
Customer : Ada ruko yang bisa disewa jangka pendek 3 bulan untuk pop-up store?
AI       : Ada beberapa pemilik ruko yang fleksibel untuk short term, terutama kalau rukonya baru atau agak lama kosong. Di kota dan area mana?
Customer : Surabaya, area mall atau lifestyle center
AI       : Area Galaxy Walk, Pakuwon, atau dekat Ciputra Mall. Mana yang paling sesuai target pasar?
Customer : Pakuwon Trade Center area
AI       : Budget per bulan?
Customer : 10–20 juta
AI       : Produk apa yang akan dijual?
Customer : Fashion lokal, brand baru
AI       : Berapa lantai?
Customer : 1 lantai cukup, tidak perlu besar
AI       : Tanggal mulai?
Customer : Bulan depan
AI       : Siap! Ruko short term (3 bulan) di area Pakuwon Trade Center Surabaya, 1 lantai, 10–20 juta/bulan, untuk pop-up store fashion. Saya cari yang owner fleksibel untuk short term!
```

---

### CASE S-15 | Sewa Ruko | WA Singkat
```
Customer : sewa ruko 2lt surabaya buat cafe 15jt
AI       : Area & kapan mulai?
Customer : darmo, 2 bln lagi
AI       : Lebar muka & berapa lama?
Customer : 5m, 3 tahun
AI       : Siap! Ruko sewa 2 lantai Darmo Surabaya, frontage 5m, cafe, 15jt/bln, 3 tahun, mulai 2 bulan lagi!
```

---

## ═══════════════════════════════════════
## BAGIAN B: BELI RUKO (20 CASE)
## ═══════════════════════════════════════

---

### CASE B-01 | Beli Ruko | Normal / Lengkap
```
Customer : Mau beli ruko di Surabaya
AI       : Siap! Ruko untuk usaha sendiri atau investasi disewakan?
Customer : Untuk usaha sendiri — toko elektronik
AI       : Toko elektronik butuh lokasi dengan traffic tinggi dan visibility baik. Di area Surabaya mana?
Customer : Surabaya Pusat, sekitar Pemuda atau Tunjungan
AI       : Area komersial yang kuat! Budget pembelian?
Customer : 3–5 miliar
AI       : Berapa lantai yang dibutuhkan?
Customer : 3 lantai — showroom bawah, stok lantai 2, kantor lantai 3
AI       : KPR atau cash?
Customer : KPR komersial
AI       : Lebar muka minimal?
Customer : Min 5 meter
AI       : Target beli kapan?
Customer : 4 bulan
AI       : Posisi hook diperlukan?
Customer : Sangat diinginkan
AI       : Siap! Ruko beli 3 lantai di Pemuda/Tunjungan Surabaya, frontage 5m+, hook preferred, 3–5 M, KPR komersial, target 4 bulan!
```

---

### CASE B-02 | Beli Ruko | Malas Ketik
```
Customer : beli ruko surabaya 2lt invest
AI       : Area & budget?
Customer : darmo, 2-3M
AI       : KPR/cash & target?
Customer : cash, 4 bln
AI       : Lebar muka minimal?
Customer : 4 meter
AI       : Siap! Ruko beli 2 lantai Darmo Surabaya, frontage 4m, 2–3M, cash, target 4 bulan, investasi!
```

---

### CASE B-03 | Beli Ruko | Info Terbatas / Ambigu
```
Customer : mau beli ruko yang strategis
AI       : Siap! "Strategis" tergantung tujuannya. Untuk usaha sendiri atau investasi disewakan?
Customer : Belum tahu, mungkin keduanya
AI       : Di kota mana yang Anda pertimbangkan?
Customer : Surabaya lebih kenal
AI       : Area Surabaya mana yang paling sering Anda akses atau familiar?
Customer : Surabaya Barat dan Pusat
AI       : Budget pembelian?
Customer : 2–4 miliar
AI       : Berapa lantai?
Customer : 2 lantai standard ruko
AI       : KPR atau cash?
Customer : Cash
AI       : Target?
Customer : 3 bulan
AI       : Lebar muka minimal?
Customer : 4–5 meter standar
AI       : Siap! Ruko 2 lantai di Surabaya Barat/Pusat, frontage 4–5m, 2–4M, cash, target 3 bulan. Saya carikan yang paling strategis dari sisi traffic dan likuiditas investasi!
```

---

### CASE B-04 | Beli Ruko | Tanya Harga Duluan
```
Customer : Harga ruko di Surabaya Pusat berapa?
AI       : Di Surabaya Pusat sangat bervariasi: ruko 2 lantai mulai 1,5–3 M di pinggiran, 3–8 M di koridor utama seperti Darmo atau Basuki Rahmat. Ruko 3 lantai di prime area bisa 5–15 M. Budget Anda?
Customer : 3–5 miliar
AI       : Di range itu bisa dapat ruko 2–3 lantai di lokasi yang sangat bagus. Untuk usaha atau investasi?
Customer : Investasi, mau disewakan
AI       : Area mana yang Anda incar?
Customer : Darmo atau Mayjend Sungkono
AI       : Berapa lantai?
Customer : 2–3 lantai
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Siap! Ruko beli 2–3 lantai di Darmo/Mayjend Sungkono Surabaya, 3–5M, cash, target 4 bulan, untuk investasi sewa!
```

---

### CASE B-05 | Beli Ruko | Marah / Frustrasi
```
Customer : Sudah cari ruko di Jakarta 6 bulan, selalu kalah cepat atau harganya naik! Bantu!
AI       : 6 bulan itu sangat menguras energi! Pasar ruko Jakarta memang sangat kompetitif — kalau ada yang bagus biasanya langsung habis. Kita butuh strategi berbeda. Area mana yang paling Anda inginkan?
Customer : Jakarta Barat atau Jaksel
AI       : Budget cash yang siap deploy?
Customer : 4 miliar, cash siap
AI       : Cash buyer dengan 4 M di Jakbar atau Jaksel itu posisi sangat kuat. Berapa lantai?
Customer : 2–3 lantai
AI       : Untuk usaha atau investasi?
Customer : Investasi, mau disewakan
AI       : Target seberapa cepat?
Customer : Secepat mungkin, sudah 6 bulan
AI       : Saya akan aktif monitor dan langsung ping Anda begitu ada listing baru yang sesuai. Ruko 2–3 lantai Jakbar/Jaksel, 4M, cash — saya set alert khusus untuk Anda!
```

---

### CASE B-06 | Beli Ruko | Ganti-Ganti Keputusan
```
Customer : mau beli ruko di Surabaya
AI       : Area mana?
Customer : Tadinya Surabaya Pusat, tapi Surabaya Barat juga berkembang
AI       : Betul! Surabaya Pusat lebih mature, Surabaya Barat (Citraland, Pakuwon) sedang tumbuh pesat. Untuk usaha atau investasi?
Customer : Hmm, usaha dulu... tapi kalau harga bagus untuk investasi juga
AI       : Budget Anda?
Customer : 2,5 miliar... mungkin bisa 3 M kalau kondisi bagus
AI       : Berapa lantai?
Customer : 2 lantai... 3 lantai lebih bagus
AI       : Di budget 2,5–3 M, 3 lantai di lokasi prime mungkin agak stretch. 2 lantai di lokasi sangat bagus atau 3 lantai di lokasi berkembang. Mana yang lebih prioritas?
Customer : Lokasi bagus, 2 lantai oke
AI       : KPR atau cash?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Siap! Ruko 2 lantai di lokasi prime Surabaya, 2,5–3M, cash, target 4 bulan. Saya carikan di Pusat dan Barat untuk perbandingan!
```

---

### CASE B-07 | Beli Ruko | First Time Buyer
```
Customer : Pertama kali mau beli ruko untuk usaha, bingung
AI       : Wajar! Beli ruko berbeda dari beli rumah — pertimbangannya lebih banyak ke bisnis. Pertama, usaha apa yang akan dijalankan?
Customer : Barbershop dan kafe kecil
AI       : Gabungan menarik! Butuh lokasi dengan traffic laki-laki muda yang tinggi. Di kota mana?
Customer : Surabaya
AI       : Area yang punya traffic target pasar Anda: sekitar kampus, kawasan karyawan muda, atau perumahan modern. Ada area yang Anda paling familiar?
Customer : Daerah Dharmahusada atau MERR
AI       : Budget pembelian?
Customer : 1,5–2,5 miliar
AI       : KPR atau cash?
Customer : KPR, belum pernah
AI       : Untuk ruko, KPR komersial prosesnya sedikit berbeda dari KPR rumah. Saya bantu jelaskan dan rekomendasikan bank yang akomodatif. Berapa lantai?
Customer : 2 lantai cukup
AI       : Target beli?
Customer : 4 bulan
AI       : Siap! Ruko 2 lantai di Dharmahusada/MERR Surabaya, untuk barbershop + kafe, 1,5–2,5M, KPR komersial, target 4 bulan. Saya bantu juga proses KPR-nya!
```

---

### CASE B-08 | Beli Ruko | Investasi Murni
```
Customer : Mau beli ruko untuk investasi disewakan, mana yang paling menguntungkan di Surabaya?
AI       : Untuk investasi ruko dengan yield tertinggi di Surabaya, area yang paling recommended saat ini: Citraland (growth tinggi), Surabaya Pusat koridor Darmo (stable), dan kawasan industri Rungkut (untuk jasa/gudang). Budget Anda?
Customer : 2–4 miliar
AI       : Berapa lantai?
Customer : 2–3 lantai
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 3 bulan
AI       : Siap! Ruko investasi terbaik di Surabaya, 2–3 lantai, 2–4M, cash, target 3 bulan. Saya sertakan analisis yield per area!
```

---

### CASE B-09 | Beli Ruko | Minta Hook / Sudut
```
Customer : Beli ruko hook di Surabaya Barat dong
AI       : Ruko hook memang paling dicari! Budget?
Customer : 2,5–4 miliar
AI       : Berapa lantai?
Customer : 2–3 lantai
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Untuk usaha atau investasi?
Customer : Usaha sendiri, mau buka toko furniture
AI       : Frontage minimal berapa meter?
Customer : Min 6 meter karena hook
AI       : Siap! Ruko hook 2–3 lantai di Surabaya Barat, frontage 6m+, 2,5–4M, cash, target 4 bulan, untuk toko furniture!
```

---

### CASE B-10 | Beli Ruko | WA Singkat
```
Customer : beli ruko citraland 2lt 2.5M cash
AI       : Target & tujuan?
Customer : 3 bln, invest
AI       : Lebar muka minimal?
Customer : 4 meter
AI       : Siap! Ruko 2 lantai Citraland Surabaya, frontage 4m, 2,5M, cash, 3 bulan, investasi!
```

---

### CASE B-11 | Beli Ruko | Minta yang Sudah Ada Penyewa
```
Customer : Mau beli ruko yang sudah ada tenant-nya di Surabaya
AI       : Investasi yang sangat bagus — beli dengan tenant berarti langsung cash flow! Di area mana?
Customer : Darmo atau Mayjend Sungkono
AI       : Budget?
Customer : 3–5 miliar
AI       : Berapa lantai?
Customer : 2–3 lantai
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 3 bulan
AI       : Ada preferensi tipe tenant? Restoran, apotek, bank, atau terbuka?
Customer : Terbuka, yang penting tenant bonafit dan kontrak masih panjang
AI       : Siap! Ruko existing dengan tenant di Darmo/Mayjend Sungkono, 2–3 lantai, 3–5M, cash, target 3 bulan — saya prioritaskan yang tenant kontraknya masih 2+ tahun!
```

---

### CASE B-12 | Beli Ruko | Dekat Kawasan Industri
```
Customer : Mau beli ruko dekat kawasan industri di Surabaya untuk usaha supplier
AI       : Ruko dekat kawasan industri sangat strategis untuk B2B supplier! Area industri di Surabaya: SIER Rungkut, Margomulyo Surabaya Barat, PIER Pasuruan. Mana yang relevan?
Customer : Rungkut SIER
AI       : Budget?
Customer : 2–3,5 miliar
AI       : Berapa lantai?
Customer : 2 lantai
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 3 bulan
AI       : Perlu loading dock atau akses truk?
Customer : Iya, akses truk penting
AI       : Siap! Ruko 2 lantai dekat SIER Rungkut Surabaya, akses truk, 2–3,5M, cash, target 3 bulan!
```

---

### CASE B-13 | Beli Ruko | Untuk Franchise
```
Customer : Mau beli ruko untuk buka franchise di Surabaya
AI       : Franchise yang menarik! Franchise apa yang akan dibuka? Ini mempengaruhi spesifikasi ruko yang dibutuhkan.
Customer : Franchise minuman kekinian
AI       : Minuman kekinian biasanya butuh ruko 1–2 lantai, frontage minimal 4 meter, di area traffic tinggi atau dekat sekolah/kampus/perumahan. Budget beli ruko?
Customer : 1,5–2,5 miliar
AI       : Berapa lantai?
Customer : 1–2 lantai
AI       : Cash atau KPR?
Customer : KPR
AI       : Area Surabaya mana?
Customer : Surabaya Barat, pasar masih berkembang
AI       : Target?
Customer : 3 bulan
AI       : Frontage minimal?
Customer : 4 meter cukup untuk minuman
AI       : Siap! Ruko 1–2 lantai di Surabaya Barat, frontage 4m, untuk franchise minuman, 1,5–2,5M, KPR, target 3 bulan!
```

---

### CASE B-14 | Beli Ruko | Tanya Simulasi KPR Komersial
```
Customer : Kalau beli ruko 3 miliar dengan KPR komersial, cicilan per bulannya kira-kira berapa?
AI       : Simulasi KPR komersial ruko 3 M: DP biasanya 30–40% = 900 juta–1,2 M. Pokok pinjaman 1,8–2,1 M. Bunga KPR komersial sekitar 8,5–10%/tahun (lebih tinggi dari KPR rumah). Tenor 10–15 tahun (lebih pendek). Estimasi cicilan 18–24 juta/bulan. Sesuai dengan kemampuan cashflow usaha Anda?
Customer : Hmm agak berat. Budget cicilan max 15 juta
AI       : Untuk cicilan 15 juta, range ruko yang lebih feasible sekitar 2–2,2 M. Atau DP lebih besar untuk mengurangi cicilan. Budget ruko jadinya?
Customer : Oke, cari yang 2–2,5 miliar
AI       : Area mana di Surabaya?
Customer : Surabaya Pusat
AI       : Berapa lantai?
Customer : 2 lantai
AI       : Target?
Customer : 4 bulan
AI       : Siap! Ruko 2 lantai di Surabaya Pusat, 2–2,5M, KPR komersial, cicilan estimasi 12–15 juta/bulan, target 4 bulan!
```

---

### CASE B-15 | Beli Ruko | Tanya Nilai Investasi Jangka Panjang
```
Customer : Ruko di Surabaya, apakah nilainya naik jangka panjang?
AI       : Secara historis, ruko di Surabaya — terutama di koridor komersial utama — naik rata-rata 5–12% per tahun. Faktor terbesar: lokasi (proximity ke pusat ekonomi), aksesibilitas, dan perkembangan kawasan sekitar. Ruko di area yang baru berkembang seperti Surabaya Barat bisa naik lebih cepat. Ada area tertentu yang Anda pertimbangkan?
Customer : Citraland atau Bukit Darmo
AI       : Keduanya area yang growth-nya bagus. Budget?
Customer : 2,5–4 miliar
AI       : Berapa lantai?
Customer : 2–3 lantai
AI       : Cash atau KPR?
Customer : Cash
AI       : Target?
Customer : 4 bulan
AI       : Untuk usaha atau investasi murni?
Customer : Investasi, disewakan dulu
AI       : Siap! Ruko investasi 2–3 lantai di Citraland/Bukit Darmo Surabaya, 2,5–4M, cash, target 4 bulan. Saya sertakan historis kenaikan harga per area!
```

---

### CASE B-16 | Beli Ruko | Untuk Tempat Tinggal + Usaha
```
Customer : Mau beli ruko untuk usaha sekaligus tempat tinggal
AI       : Konsep yang efisien dan populer! Usaha di lantai bawah, hunian di atas. Usaha apa rencananya?
Customer : Laundry dan toko kelontong
AI       : Bagus, dua usaha yang complementary! Di kota mana?
Customer : Surabaya Selatan
AI       : Budget?
Customer : 1,5–2,5 miliar
AI       : Berapa lantai?
Customer : 2 lantai — usaha bawah, tinggal atas
AI       : Cash atau KPR?
Customer : KPR
AI       : Target?
Customer : 4 bulan
AI       : Frontage minimal?
Customer : 4 meter
AI       : Siap! Ruko 2 lantai di Surabaya Selatan, usaha (laundry + kelontong) + hunian, frontage 4m, 1,5–2,5M, KPR, target 4 bulan!
```

---

### CASE B-17 | Beli Ruko | Untuk Klinik / Apotek
```
Customer : Mau beli ruko untuk klinik dan apotek di Malang
AI       : Investasi properti + usaha kesehatan yang sangat solid! Di area Malang mana yang Anda targetkan?
Customer : Dekat perumahan padat, Sukun atau Blimbing
AI       : Budget?
Customer : 1,5–2,5 miliar
AI       : Berapa lantai?
Customer : 2 lantai
AI       : Cash atau KPR?
Customer : KPR
AI       : Target?
Customer : 4 bulan
AI       : Frontage minimal untuk klinik?
Customer : 4–5 meter, perlu parkir pasien
AI       : Siap! Ruko 2 lantai di Sukun/Blimbing Malang, frontage 4–5m + parkir, untuk klinik + apotek, 1,5–2,5M, KPR, target 4 bulan!
```

---

### CASE B-18 | Beli Ruko | Portofoli0 Investor
```
Customer : Sudah punya 3 ruko di Surabaya, mau tambah di Sidoarjo atau Gresik
AI       : Diversifikasi yang cerdas! Sidoarjo dan Gresik punya pertumbuhan yang bagus sebagai satelit Surabaya. Mana yang lebih Anda pertimbangkan?
Customer : Sidoarjo, dekat BSD Sidoarjo yang berkembang
AI       : Serpong-nya Surabaya! Area BSD Sidoarjo memang sedang tumbuh. Budget?
Customer : 2–3,5 miliar
AI       : Berapa lantai?
Customer : 2–3 lantai
AI       : Cash atau KPR?
Customer : Cash, sudah biasa
AI       : Target?
Customer : 3 bulan
AI       : Posisi hook diinginkan?
Customer : Sangat prefer
AI       : Siap! Ruko hook 2–3 lantai di BSD Sidoarjo, 2–3,5M, cash, target 3 bulan!
```

---

### CASE B-19 | Beli Ruko | Minta Second Murah
```
Customer : Mau beli ruko second yang murah di Surabaya, ada?
AI       : Ada! Ruko second sering bisa 10–20% lebih murah dari harga pasar, terutama kalau penjual butuh cepat atau kondisi perlu renovasi ringan. Di area mana?
Customer : Surabaya Pusat atau Timur
AI       : Budget?
Customer : 1,5–2,5 miliar
AI       : Berapa lantai?
Customer : 2 lantai
AI       : Cash atau KPR?
Customer : Cash, prefer karena mau nego
AI       : Cash buyer + beli second = posisi negosiasi paling kuat! Target?
Customer : 2 bulan, butuh cepat
AI       : Kondisi yang masih oke, atau terima yang butuh renovasi ringan?
Customer : Renovasi ringan oke
AI       : Siap! Ruko second 2 lantai di Surabaya Pusat/Timur, 1,5–2,5M, cash, target 2 bulan, renovasi ringan masih oke. Saya bantu negosiasi harga terbaik!
```

---

### CASE B-20 | Beli Ruko | WA Singkat
```
Customer : beli ruko 3lt surabaya 4M cash invest
AI       : Area & target?
Customer : darmo, 3 bln
AI       : Hook diinginkan?
Customer : iya kalau ada
AI       : Siap! Ruko 3 lantai Darmo Surabaya, 4M, cash, target 3 bulan, hook preferred, investasi!
```

---
*File: 06_SKILL_SHOPHOUSE_RUKO.md | Elevan Property Chatbot Skills v1.0*

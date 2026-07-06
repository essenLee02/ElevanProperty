# 19 — Landmark Reference (per Kota & dari Database)

## Tentang File Ini

Ada **DUA sumber landmark** yang saling melengkapi, jangan dicampur:

1. **Landmark DB terdaftar** (tabel `locations`, 213 entri) — dipakai backend untuk
   **filter katalog properti** yang benar-benar ter-tag "dekat landmark X" via tabel
   join `property_locations`. Lihat bagian [Landmark Terdaftar di Database](#landmark-terdaftar-di-database-untuk-filter-katalog).
2. **Landmark per kota (kurasi manual)** — dipakai AI untuk **memberi contoh relevan**
   saat bertanya Q2c ("area/kawasan mana di kota X?") dan Q6 ("patokan lokasi?").
   Ini TIDAK selalu ada di database — murni referensi percakapan supaya pertanyaan
   AI terasa lokal, bukan generik. Lihat bagian [Landmark per Kota](#landmark-per-kota-referensi-percakapan).

**Aturan penting:** landmark yang customer sebutkan TETAP diterima sebagai patokan lokasi
(Q6) apa pun sumbernya — baik yang ada di database maupun tidak. Kedua daftar di bawah ini
membantu AI **mengenali** dan **memberi contoh** landmark, bukan membatasi jawaban customer.

---

## Landmark Terdaftar di Database (untuk filter katalog)

Backend memuat daftar ini sekali saat startup (`initLandmarkCache()` di
`propertyRecommendationService.js`) dari tabel `locations` (status=1). Saat customer
menyebut salah satu nama ini, `detectLandmark()` mengenalinya, dan `searchProperties()`
memfilter/mem-prioritaskan listing yang benar-benar ter-tag ke landmark tsb (via
`property_locations`). **Jika tidak ada properti yang ter-tag ke landmark tsb, sistem
otomatis fallback ke hasil kota-wide (tidak pernah 0 hasil hanya karena tagging landmark
sparse)** — filter landmark ini bersifat BOOST, bukan constraint keras.

### Landmark bernama spesifik (nama asli, bukan kategori generik)

| Landmark | Kategori |
|---|---|
| PAKUWON MALL | Mall |
| GWALK PAKUWON | Kawasan komersial |
| GRAND CITY MALL | Mall |
| TUNJUNGAN PLAZA (TP) | Mall |
| PASAR ATOM | Pasar |
| WISATA MANGROVE | Wisata |
| ZOO/KEBUN BINATANG SURABAYA | Wisata |
| SEKOLAH CIPUTRA | Sekolah |
| RUMAH SAKIT RKZ | Rumah sakit |
| BANK BCA / BANK BNI / BANK MANDIRI | Bank |
| GACOAN / MIE GACOAN | Restoran |
| DEPOT BU RUDY | Restoran |
| AYCE ALL YOU CAN EAT SURABAYA | Restoran |

### Kategori landmark generik (berlaku lintas kota — cocokkan ke kategori terdekat)

| Kategori | Contoh nama di DB |
|---|---|
| Retail & Belanja | PASAR TRADISIONAL, PASAR MODERN, PASAR SENI, PASAR BUNGA, PASAR IKAN, PASAR SAYUR, MALL PUSAT KOTA, MALL PREMIUM, MALL COMMUNITY, SUPERMARKET BESAR, SUPERMARKET MINI, INDOMARET, ALFAMARET, CARREFOUR, GIANT HYPERMARKET, HYPERMART, TRANSMART, TOKO ELEKTRONIK, TOKO FASHION, TOKO EMAS/PERHIASAN, TOKO ROTI/BAKERY, TOKO OBAT HERBAL, TOKO SPARE PART |
| Pendidikan | TAMAN KANAK-KANAK, PAUD, SEKOLAH DASAR (+ ISLAM/KRISTEN/KATOLIK), SEKOLAH MENENGAH PERTAMA/ATAS/KEJURUAN, SEKOLAH INTERNASIONAL, SEKOLAH BILINGUAL, UNIVERSITAS NEGERI/SWASTA BESAR/SWASTA TERKEMUKA, POLITEKNIK, AKADEMI, LEMBAGA KURSUS, PESANTREN, MADRASAH, SEKOLAH BUDDHIS, SEKOLAH LUAR BIASA, KAMPUS UTAMA/CABANG, PERPUSTAKAAN UMUM/SEKOLAH, SEKOLAH BOARDING, SEKOLAH ALAM |
| Transportasi | STASIUN KERETA API, STASIUN KRL/MRT/LRT, TERMINAL BUS UTAMA/LOKAL, BANDARA INTERNASIONAL/DOMESTIC, PELABUHAN LAUT/FERRY, HALTE BUS, STASIUN TAKSI, PARKIR UMUM/BERLANGGANAN, POM BENSIN/SPBU, BENGKEL MOBIL/MOTOR, CAR WASH, RENTAL MOBIL/MOTOR |
| Kesehatan | RUMAH SAKIT UMUM/KHUSUS/SWASTA/PEMERINTAH/JANTUNG/BERSALIN/JIWA, KLINIK KESEHATAN/GIGI/24 JAM/MATA/KULIT/ANAK, PUSKESMAS, POSYANDU, APOTEK (+ 24 JAM), LABORATORIUM KESEHATAN |
| Kuliner | WARUNG MAKAN, RESTORAN LOKAL/FINE DINING/SEAFOOD/CHINESE/JEPANG/KOREA, CAFE KOPI, KEDAI KOPI PINGGIR JALAN, STARBUCKS/KAFE CHAIN, RUMAH MAKAN PADANG, PIZZA/PASTA RESTORAN, FAST FOOD, WARUNG SOTO/SATAI, DEPOT BAKSO, KAFE DESSERT, FOOD COURT |
| Rekreasi & Olahraga | TAMAN KOTA, TAMAN BERMAIN ANAK, TAMAN HIBURAN, PANTAI PUBLIK, KOLAM RENANG UMUM/KOMPLEKS, GYM/FITNESS CENTER, YOGA STUDIO, BIOSKOP, LAPANGAN OLAHRAGA/TENIS/BADMINTON, GOLF COURSE, BOWLING ALLEY, KARAOKE LOUNGE, BILLIARD CLUB, GAME ARCADE, TAMAN BOTANI, MUSEUM SENI |
| Ibadah | MASJID BESAR/KECIL, GEREJA PROTESTAN/KATOLIK, KUIL BUDDHA/HINDU, VIHARA, TEMPAT IBADAH, MUSHOLA LINGKUNGAN |
| Finansial | BANK BESAR/LOKAL/SWASTA, ATM 24 JAM, MINI ATM, MONEY CHANGER, KANTOR ASURANSI/KOPERASI, KOPERASI SIMPAN PINJAM |
| Pemerintahan & Layanan | KANTOR NOTARIS/KONSULTAN PAJAK/ADVOKAT, AGENSI PROPERTI, KANTOR PEMERINTAH, KELURAHAN, KECAMATAN, POLISI SEKTOR, KANTOR DAMKAR/POS/PLN/PAJAK/BEA CUKAI/IMIGRASI |
| Infrastruktur Lingkungan | GERBANG MASUK KOMPLEKS, RUANG TERBUKA HIJAU, JALAN UMUM/TIKUS, ALLEY/GANG SEMPIT, TAMAN RT/RW, POS KEAMANAN 24 JAM, LAMPU JALAN |

---

## Landmark per Kota (referensi percakapan)

Kurasi manual (`LOCATION_LANDMARKS` di `chatbotPrivateController.js`) — dipakai untuk
memberi CONTOH area/kawasan yang relevan saat AI bertanya Q2c ("area mana di kota X?")
dan Q6 ("patokan lokasi?"). Daftar ini independen dari tabel `locations` di atas — kota
baru bisa ditambahkan cukup dengan menambah satu baris di map tsb, tanpa perlu data
`property_locations` untuk kota itu.

| Kota | Landmark/Kawasan Contoh |
|---|---|
| Surabaya | Pakuwon, Darmo, Rungkut, Gubeng, Tunjungan, Citraland, Manyar, Kertajaya, MERR, Wiyung, Wonokromo |
| Malang | Soekarno Hatta, Ijen, Dinoyo, Lowokwaru, Suhat, UB, UM, Arjosari, Blimbing |
| Batu | Jatim Park, Batu Night Spectacular, Selecta, Alun-Alun Batu, Songgoriti, Oro Oro Ombo |
| Madiun | Pahlawan Street Center, Alun-Alun Madiun, Kartoharjo, Manguharjo, Mejayan |
| Sidoarjo | Gedangan, Waru, Buduran, Krian, Alun-Alun Sidoarjo |
| Gresik | Kebomas, Manyar, GKB, Alun-Alun Gresik |
| Kediri | Simpang Lima Gumul, Mojoroto, Pare |
| Jember | Alun-Alun Jember, Sumbersari, Tanggul |
| Jakarta | SCBD, Sudirman, Thamrin, Senayan, Kemang, Kelapa Gading, Pantai Indah Kapuk, Kuningan, Tebet, Menteng |
| Bekasi | Grand Wisata, Summarecon Bekasi, Harapan Indah, Kemang Pratama, Jababeka |
| Depok | Margonda, UI, Sawangan, Cinere, Cimanggis |
| Bogor | Sentul City, Bogor Nirwana, Yasmin, Cibinong, Tajur |
| Tangerang | BSD City, Alam Sutera, Gading Serpong, Bintaro, Serpong, Karawaci, Cikokol |
| Bandung | Dago, Buah Batu, Antapani, Pasteur, Setiabudi, Ciumbuleuit, Kopo |
| Cirebon | Alun-Alun Kejaksan, Kesambi, Plumbon |
| Semarang | Banyumanik, Tembalang, Gajahmungkur, Simpang Lima, Candi |
| Solo / Surakarta | Manahan, Solo Baru, Kartasura, Palur, Laweyan, Klewer |
| Yogyakarta | Malioboro, UGM, Sleman, Kaliurang, Gejayan, Seturan, Bantul, Kotagede |
| Serang | Cipocok, Ciruas, Kasemen, Alun-Alun Serang |
| Lebak | Rangkasbitung, Sajira, Malingping, Sawarna |
| Cilegon | Krakatau, Merak, Ciwandan, PCI |
| Denpasar | Sanur, Renon, Panjer, Sunset Road |
| Badung | Kuta, Seminyak, Canggu, Nusa Dua, Jimbaran, Uluwatu |
| Mataram | Cakranegara, Sekarbela, Ampenan |
| Medan | Medan Baru, Medan Sunggal, Medan Petisah, Setiabudi Medan, Polonia |
| Palembang | Ilir Barat, Ilir Timur, Jakabaring, Kemuning |
| Jambi | Telanaipura, Mendalo, Paal Merah, Simpang Rimbo, Mayang |
| Kerinci | Gunung Kerinci, Sungai Penuh, Kayu Aro |
| Padang | Alun-Alun Padang, Pondok, Air Tawar |
| Pekanbaru | Sudirman Pekanbaru, Panam, Rumbai |
| Batam | Nagoya, Batam Center, Sekupang |
| Bandar Lampung | Rajabasa, Teluk Betung, Kemiling, Way Halim, Sukarame |
| Pontianak | Alun-Alun Kapuas, Sungai Jawi, Siantan |
| Banjarmasin | Sungai Jingah, Banjar Baru, Kuin |
| Balikpapan | Klandasan, Sepinggan, Gunung Sari |
| Samarinda | Air Hitam, Sempaja, Karang Asam |
| Amuntai | Alabio, Danau Panggang, Sungai Tabukan |
| Makassar | Panakkukang, Tamalate, Rappocini |
| Manado | Boulevard Manado, Malalayang, Tuminting |
| Palu | Alun-Alun Palu, Tatura, Talise |
| Agats | Pelabuhan Agats, Asmat, Bandara Ewer |
| Aimas | Sorong Regency, Bandara DEO, Klamono |
| Ambon | Alun-Alun Ambon, Batu Merah, Karang Panjang |
| Jayapura | Entrop, Abepura, Dok II |

**Kota tidak terdaftar:** AI tetap boleh bertanya Q2c/Q6 dengan contoh generik
("pusat kota, area selatan, atau kawasan tertentu?") — jangan menolak pertanyaan hanya
karena kota tsb belum ada di tabel ini.

---

## Cara AI Menggunakan Daftar Landmark

1. **Q2c (sub-area kota)** — cocokkan `filters.location` (kota) ke tabel "Landmark per
   Kota" di atas, sebutkan 3–4 contoh sebagai bagian dari pertanyaan.
2. **Q6 (patokan lokasi)** — sebutkan 2–3 landmark lokal sebagai contoh, lalu terima
   APAPUN jawaban customer (baik landmark yang ada di daftar ini maupun tidak).
3. **Filter katalog** — jika customer menyebut nama yang cocok dengan tabel "Landmark
   Terdaftar di Database", backend otomatis mem-filter/mem-prioritaskan listing yang
   ter-tag ke landmark tsb. Tidak perlu tindakan tambahan dari AI — cukup catat
   `✓ Patokan lokasi:` seperti biasa (lihat `docs/17-location-anchor-recognition.md`).
4. **Jangan mengarang landmark yang tidak masuk akal** — jika customer menyebut nama
   yang tidak dikenal AI sama sekali (bukan generik seperti "dekat sekolah"), terima
   apa adanya sebagai patokan lokasi tanpa mengoreksi atau meragukan customer.

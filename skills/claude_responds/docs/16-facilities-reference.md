# 16 — Facilities Reference (dari Database)

## Tentang File Ini

File ini berisi **279 nama fasilitas resmi** (287 baris data, termasuk beberapa nama
duplikat dengan ID berbeda) yang terdaftar di database Elevan Property — update terakhir
2026-07-03. Backend secara otomatis menginjeksikan daftar TERKINI ini ke dalam prompt AI
setiap percakapan melalui `aiContextService.buildFacilityContextBlock()` (untuk chatbot
yang menarik langsung dari DB) — file `.md` ini adalah salinan referensi untuk pemanggilan
AI via API Key (Claude/ChatGPT), yang membaca skill docs secara statis
(`skillPromptService.loadProjectSkillPrompt()`), bukan langsung dari DB.

**Gunakan nama-nama ini (atau padanan Indonesia-nya) saat menyebut fasilitas properti.**
Jangan mengarang nama fasilitas yang tidak ada di daftar ini.

---

## Cara AI Menggunakan Daftar Fasilitas

1. **Cocokkan permintaan customer** — jika customer bilang "mau yang ada gym", cocokkan ke `GYM`
2. **Akui fasilitas yang disebutkan** — konfirmasi spesifik apa yang ada/tidak ada
3. **Gunakan nama yang konsisten** — pakai nama DB atau terjemahan wajarnya
4. **Kumpulkan di summary** — gabungkan dengan koma: `✓ Fasilitas: AC, GYM, KOLAM RENANG`
5. **Jika fasilitas tidak dikenal AI** — backend sudah injeksikan daftarnya; periksa konteks `## FACILITY REFERENCE` di dalam prompt sebelum menyatakan "tidak ada"

---

## Fasilitas Standar per Tipe Properti (Sewa/Booking)

**Aturan penting:** Jika customer menjawab pertanyaan fasilitas dengan *"standar"*,
*"biasa"*, *"terserah"*, *"tidak tahu"*, *"apa saja"*, atau *"yang penting standar"* —
artinya customer **tidak punya preferensi spesifik**. Jangan biarkan kolom fasilitas
kosong: **isi otomatis dengan fasilitas standar** sesuai tipe properti di bawah.

Jika customer bilang *"fasilitas standar"* **DAN** menyebut item tambahan
(mis. *"pokok standar, tambahin kulkas dan spring bed"*), **gabungkan**: item spesifik
yang customer sebut **didahulukan**, lalu fasilitas standar yang belum tercakup.

| Tipe Properti | Fasilitas Standar |
|---------------|-------------------|
| **House / Rumah** | Kamar tidur, kamar mandi, listrik, air, dapur, ruang tamu, carport/garasi, halaman kecil, internet opsional |
| **Apartment / Apartemen** | Kamar tidur, kamar mandi, AC, dapur kecil/pantry, listrik, air, lift, keamanan 24 jam, parkir |
| **Hotel** | Tempat tidur, kamar mandi, AC, TV, Wi-Fi, handuk, perlengkapan mandi, housekeeping, resepsionis |
| **Villa** | Kamar tidur, kamar mandi, dapur, AC, Wi-Fi, ruang keluarga, parkir, taman, CCTV, one gate system, kolam renang |
| **Boarding House / Kost** | Tempat tidur, lemari, meja, listrik, air, Wi-Fi, kamar mandi (dalam/luar), akses dapur opsional |
| **Shophouse / Ruko** | Bangunan utama, listrik, air, area parkir, toilet, area usaha |
| **Office / Kantor** | Ruang kerja, listrik, AC, internet dasar, toilet, parkir, keamanan |
| **Warehouse / Gudang** | Area gudang, listrik, air, akses kendaraan, area bongkar muat, keamanan dasar |
| **Store / Toko** | Area toko, listrik, lampu, air, toilet, area display |
| **Condo / Kondominium** | Kamar tidur, kamar mandi, AC, dapur, Wi-Fi, parkir, keamanan, gym/kolam renang |
| **Mansion** | Banyak kamar, beberapa kamar mandi, garasi, taman, ruang keluarga besar, keamanan, smart home opsional |

> Furnishing menambah perabot untuk tipe hunian (house/apartment/villa/condo/kost/mansion):
> **Full furnished** → tambah TV, Kulkas, Lemari, Tempat Tidur, Kitchen set.
> **Semi furnished** → tambah sebagian (mis. Kitchen set, Lemari, Kulkas).
> **Kosongan** → hanya fasilitas dasar bangunan.

Di summary, fasilitas standar (auto-inject) ditandai:
`✗ Fasilitas: *[daftar standar] (Fasilitas standar)*` — tanda ✗ berarti customer tidak
menyebut preferensi spesifik, tapi kita tetap catat fasilitas standarnya untuk agent.

---

## Daftar Fasilitas per Kategori

### 🛏️ Kamar & Ruang Dalam (Bedroom / Indoor)
| Nama DB | Padanan |
|---------|---------|
| BED | Kasur, Ranjang |
| SPRING BED | Spring bed, Kasur per |
| WARDROBE | Lemari pakaian |
| STUDY DESK | Meja belajar |
| LIVING ROOM | Ruang tamu |
| DINING ROOM | Ruang makan |
| GUEST ROOM | Kamar tamu |
| GUEST HOUSE | Guest house, Rumah tamu |
| STORAGE ROOM | Gudang dalam |
| STORAGE AREA | Area penyimpanan |
| STORAGE | Ruang simpan |
| FLEXIBLE LAYOUT | Layout fleksibel |

### 🚿 Kamar Mandi & Toilet
| Nama DB | Padanan |
|---------|---------|
| PRIVATE BATHROOM | Kamar mandi dalam, Toilet dalam |
| SHARED BATHROOM | Kamar mandi bersama, Toilet bersama |
| TOILET | Toilet, WC |
| WATER HEATER | Water heater, Pemanas air |
| OUTDOOR SHOWER | Shower outdoor |

### 🍽️ Dapur & Makan
| Nama DB | Padanan |
|---------|---------|
| KITCHEN | Dapur |
| KITCHEN SET | Kitchen set, Dapur set |
| PANTRY | Pantry |
| SHARED KITCHEN | Dapur bersama |
| BREAKFAST | Sarapan |
| LUNCH | Makan siang |
| DINNER | Makan malam |
| BREAKFAST AREA | Area sarapan |
| BREAKFAST INCLUDED | Sarapan termasuk |

### 🏊 Kolam & Air
| Nama DB | Padanan |
|---------|---------|
| KOLAM RENANG | Kolam renang |
| SWIMMING POOL | Swimming pool, Kolam renang |
| INFINITY POOL | Infinity pool |
| PRIVATE POOL | Kolam renang pribadi |
| JACUZZI | Jacuzzi |
| PDAM WATER | Air PDAM |
| WATER ACCESS | Akses air |
| IRRIGATION SYSTEM | Sistem irigasi |

### 🏋️ Olahraga & Kebugaran
| Nama DB | Padanan |
|---------|---------|
| GYM | Gym, Pusat kebugaran |
| YOGA | Yoga |
| YOGA DECK | Yoga deck |
| TENNIS COURT | Lapangan tenis |
| SAUNA | Sauna |
| SPA | Spa |
| BILLIARD ROOM | Ruang biliar |
| GAME ROOM | Ruang game, Ruang bermain |
| KIDS ZONE | Kids zone, Zona anak |
| OPEN AIR LOUNGE | Lounge outdoor |

### 🔒 Keamanan & Pengawasan
| Nama DB | Padanan |
|---------|---------|
| SECURITY | Keamanan |
| CCTV | CCTV |
| CCTV 24 JAM | CCTV 24 jam |
| SECURITY 24H | Keamanan 24 jam |
| FENCE | Pagar |
| GUARD HOUSE | Pos satpam, Pos keamanan |
| SMART DOOR | Pintu pintar, Smart door |
| FIRE SUPPRESSION | Sistem pemadam kebakaran |
| SPRINKLER SYSTEM | Sprinkler |
| 24-HOUR ACCESS | Akses 24 jam |

### 📺 Smart Home & Teknologi
| Nama DB | Padanan |
|---------|---------|
| SMART HOME | Smart home |
| SMART HOME SYSTEM | Sistem smart home |
| SMART TV | Smart TV, TV pintar |
| WI-FI | WiFi, Internet |
| HOME THEATER | Home theater |
| SERVER ROOM | Ruang server |
| UPS SYSTEM | UPS, Sistem UPS |
| GENERATOR | Genset, Generator |
| PLN ELECTRICITY | Listrik PLN |
| ELECTRICITY | Listrik |

### 🚗 Parkir & Akses
| Nama DB | Padanan |
|---------|---------|
| PARKIR SEPEDA MOTOR | Parkir motor |
| PARKING | Parkir, Area parkir |
| PARKING 4+ CARS | Parkir 4+ mobil |
| CARPORT | Carport |
| TRUCK ACCESS | Akses truk |
| FORKLIFT ACCESS | Akses forklift |
| WIDE GATE | Gerbang lebar |
| LOADING AREA | Area loading |
| LOADING DOCK | Loading dock |
| MAIN ROAD ACCESS | Akses jalan raya |
| MAIN ROAD FRONTAGE | Frontage jalan raya |

### 🌿 Outdoor & Taman
| Nama DB | Padanan |
|---------|---------|
| GARDEN | Taman, Kebun |
| BALCONY | Balkon |
| ROOFTOP | Rooftop, Atap |
| ROOFTOP GARDEN | Taman atap, Rooftop garden |
| BBQ AREA | Area BBQ, Area barbekyu |

### 🏨 Hotel & Service
| Nama DB | Padanan |
|---------|---------|
| RECEPTION | Resepsionis |
| CONCIERGE | Concierge |
| ROOM SERVICE | Room service |
| BUTLER SERVICE | Butler service |
| PRIVATE CHEF | Koki pribadi |
| LAUNDRY | Laundry |
| LAUNDRY ROOM | Ruang laundry |
| LAUNDRY SERVICE | Layanan laundry |
| LAUNDRY AREA | Area laundry |
| WASHING MACHINE | Mesin cuci |
| AC | AC, Air conditioner |
| STAFF QUARTERS | Kamar staf, Kamar ART |
| PRIVATE ELEVATOR | Lift pribadi |
| LIFT | Lift, Elevator |
| MINIMARKET | Minimarket |
| RESTAURANT | Restoran |
| BAR | Bar |
| ATM | ATM |
| ATM CENTER | Pusat ATM |

### 🏢 Kantor & Komersial
| Nama DB | Padanan |
|---------|---------|
| MEETING ROOM | Ruang rapat |
| CONFERENCE ROOM | Ruang konferensi |
| BUSINESS CENTER | Pusat bisnis |
| CO-WORKING SPACE | Co-working space, Ruang kerja bersama |
| OFFICE ROOM | Ruang kantor |
| CAFETERIA | Kafetaria |
| LOUNGE AREA | Lounge |
| PRAYER ROOM | Mushola, Ruang ibadah |
| MEZZANINE | Mezzanine, Loteng |
| RAISED FLOOR | Raised floor |
| HIGH CEILING | Langit-langit tinggi |

### 🏗️ Gudang & Logistik
| Nama DB | Padanan |
|---------|---------|
| WAREHOUSE | Gudang |
| RACKING SYSTEM | Rak sistem |
| COLD STORAGE | Cold storage, Gudang dingin |

### 🏪 Toko & Retail
| Nama DB | Padanan |
|---------|---------|
| DISPLAY AREA | Area display |
| SIGNAGE | Signage, Papan nama |
| SIGNAGE SPACE | Ruang signage |
| OUTDOOR SIGNAGE | Signage outdoor |
| POS SYSTEM | Sistem POS, Kasir |
| FITTING ROOM | Kamar pas |
| CHANGING ROOM | Ruang ganti |
| CASH COUNTER | Meja kasir |
| ROLLING DOOR | Rolling door, Pintu rolling |

### 🌟 Luxury & Lain-lain
| Nama DB | Padanan |
|---------|---------|
| LIBRARY | Perpustakaan |
| WINE CELLAR | Wine cellar |
| HOME THEATER | Home theater |
| BALLROOM | Ballroom |
| GAME ROOM | Ruang game |
| STADIUN NONTON | Area nonton / home cinema |

---

## Fasilitas Tambahan (Update 2026-07-03 — Kategori Detail)

Kategori berikut ditambahkan seiring pertumbuhan database (id 127–287). Gunakan sebagai
pelengkap kategori di atas — sinonim ID/EN yang sama berlaku.

### 🛏️ Kamar Tidur (Detail)
| Nama DB | Padanan |
|---------|---------|
| BEDROOM | Kamar tidur (generik) |
| MASTER BEDROOM | Kamar tidur utama |
| GUEST BEDROOM | Kamar tidur tamu |
| KIDS BEDROOM | Kamar tidur anak |
| SECONDARY BEDROOM | Kamar tidur kedua |
| STUDIO BEDROOM | Kamar tidur studio |
| BEDROOM CLOSET | Lemari kamar tidur |
| BEDROOM ENSUITE | Kamar tidur + kamar mandi dalam |
| BEDROOM BALCONY | Balkon kamar tidur |
| BEDROOM WINDOW | Jendela kamar tidur |
| BEDROOM DOOR | Pintu kamar tidur |

### 🚿 Kamar Mandi (Detail)
| Nama DB | Padanan |
|---------|---------|
| BATHROOM | Kamar mandi (generik) |
| SHOWER ROOM | Ruang shower |
| SHOWER STALL | Bilik shower |
| BATH TUB | Bathtub, bak mandi |
| JACUZZI TUB | Bathtub jacuzzi |
| SHOWER HEAD | Kepala shower |
| BATHROOM SINK | Wastafel kamar mandi |
| VANITY MIRROR | Cermin rias |
| TOWEL RACK | Gantungan handuk |
| TOWEL STORAGE | Penyimpanan handuk |
| TOWELS | Handuk |
| TOILETRIES | Perlengkapan mandi |
| TOILET PAPER HOLDER | Gantungan tisu toilet |
| MEDICINE CABINET | Lemari obat |
| ACCESSIBLE BATHROOM | Kamar mandi difabel |
| GRAB BAR | Pegangan tangan (difabel) |

### 🍽️ Dapur & Peralatan Masak (Detail)
| Nama DB | Padanan |
|---------|---------|
| OVEN | Oven |
| MICROWAVE | Microwave |
| DISHWASHER | Mesin cuci piring |
| REFRIGERATOR | Kulkas, Lemari es |
| FRIDGE | Kulkas |
| FREEZER | Freezer |
| STOVE BURNER | Kompor |
| GAS RANGE | Kompor gas |
| ELECTRIC RANGE | Kompor listrik |
| INDUCTION COOKTOP | Kompor induksi |
| RANGE HOOD | Penghisap asap dapur |
| KITCHEN ISLAND | Meja pulau dapur |
| PANTRY STORAGE | Penyimpanan pantry |
| OUTDOOR KITCHEN | Dapur luar |

### 🛋️ Furnitur & Ruang Duduk
| Nama DB | Padanan |
|---------|---------|
| LIVING ROOM SOFA | Sofa ruang tamu |
| ARMCHAIR | Kursi santai |
| CHAISE LOUNGE | Kursi panjang |
| OTTOMAN | Ottoman, Kursi kaki |
| COFFEE TABLE | Meja kopi |
| TABLE | Meja (generik) |
| DINING SET | Set meja makan |
| BREAKFAST NOOK | Sudut sarapan |
| FAMILY ROOM | Ruang keluarga |
| BOOKSHELF | Rak buku |
| OFFICE CHAIR | Kursi kantor |
| STUDY TABLE | Meja belajar |
| MASSAGE CHAIR | Kursi pijat |

### 🌿 Outdoor & Taman (Detail)
| Nama DB | Padanan |
|---------|---------|
| PATIO | Patio |
| TERRACE | Teras |
| DECK | Dek |
| VERANDA | Beranda |
| LANDSCAPING | Penataan taman |
| FLOWER BED | Kebun bunga |
| VEGETABLE GARDEN | Kebun sayur |
| HERB GARDEN | Kebun herbal |
| YARD | Halaman |
| DOG PARK | Taman anjing |
| PET AREA | Area hewan peliharaan |
| OPEN DOGS PLAYGROUND | Taman bermain anjing terbuka |

### 🚗 Parkir (Detail)
| Nama DB | Padanan |
|---------|---------|
| GARAGE | Garasi |
| COVERED CARPORT | Carport tertutup |
| PARKING SPACE | Ruang parkir |
| BIKE RACK | Rak sepeda |
| MOTORCYCLE PARKING | Parkir motor |

### 🧺 Laundry & Kebersihan (Detail)
| Nama DB | Padanan |
|---------|---------|
| WASHING MACHINE | Mesin cuci |
| DRYER | Pengering |
| LAUNDRY SINK | Wastafel cuci |
| IRONING BOARD | Papan setrika |
| CLEANING SUPPLIES | Perlengkapan bersih-bersih |
| HOUSEKEEPING ROOM | Ruang housekeeping |
| LINEN CLOSET | Lemari linen |

### 🔒 Keamanan & Sistem (Detail)
| Nama DB | Padanan |
|---------|---------|
| ALARM SYSTEM | Sistem alarm |
| CCTV CAMERA | Kamera CCTV |
| VIDEO INTERCOM | Interkom video |
| SMART LOCK | Kunci pintar |
| MOTION SENSOR | Sensor gerak |
| FIRE EXTINGUISHER | Alat pemadam kebakaran |
| FIRST AID KIT | Kotak P3K |
| WHEELCHAIR RAMP | Ramp kursi roda |
| ELEVATOR | Lift |

### ⚡ Listrik & Utilitas
| Nama DB | Padanan |
|---------|---------|
| ELECTRICAL PANEL | Panel listrik |
| CIRCUIT BREAKER | Pemutus arus |
| BACKUP GENERATOR | Genset cadangan |
| SOLAR PANELS | Panel surya |
| THERMAL SPRING | Sumber air panas alami |
| PLUMBING SYSTEM | Sistem pipa air |
| DRAINAGE SYSTEM | Sistem drainase |
| GUTTER SYSTEM | Talang air |
| ROOF | Atap |
| INTERNET | Internet (generik) |

### ❄️ AC & HVAC
| Nama DB | Padanan |
|---------|---------|
| CENTRAL AC | AC sentral |
| HEATING SYSTEM | Sistem pemanas |
| FURNACE | Tungku pemanas |
| THERMOSTAT | Termostat |
| VENTILATION FAN | Kipas ventilasi |
| HVAC SYSTEM | Sistem HVAC |
| CEILING FAN | Kipas langit-langit |
| DRYER VENT | Ventilasi pengering |
| RANGE VENT | Ventilasi kompor |
| BATH VENT | Ventilasi kamar mandi |
| FRESH AIR INTAKE | Ventilasi udara segar |

### 🏋️ Rekreasi & Kebugaran (Detail)
| Nama DB | Padanan |
|---------|---------|
| SAUNA | Sauna |
| STEAM ROOM | Ruang uap |
| JACUZZI | Jacuzzi |
| FITNESS AREA | Area kebugaran |
| TREADMILL | Treadmill |
| ELLIPTICAL MACHINE | Sepeda elips |
| WEIGHT RACK | Rak beban |
| DUMBBELL SET | Set dumbbell |
| GYM EQUIPMENT | Peralatan gym |
| YOGA ROOM | Ruang yoga |
| LOCKER ROOM | Ruang loker |
| SPA TUB | Bathtub spa |
| POOL | Kolam (sinonim swimming pool) |
| BILLIARDS TABLE | Meja biliar |
| RECREATION AREA | Area rekreasi |

### 🏢 Kantor & Bisnis (Detail)
| Nama DB | Padanan |
|---------|---------|
| BOARDROOM | Ruang direksi |
| FIREPLACE | Perapian |
| ART GALLERY | Galeri seni |
| ROOFTOP TERRACE | Teras atap |
| BBQ GRILL | Panggangan BBQ |
| TV | Televisi (generik) |
| PROJECTOR | Proyektor |
| SOUND SYSTEM | Sistem suara |

### 🏠 Interior & Struktur
| Nama DB | Padanan |
|---------|---------|
| CARPET FLOORING | Lantai karpet |
| HARDWOOD FLOOR | Lantai kayu |
| TILE FLOORING | Lantai keramik |
| MARBLE FLOOR | Lantai marmer |
| WALL PAINT | Cat dinding |
| CROWN MOLDING | List profil dinding |
| STAIRS | Tangga |
| INTERIOR DOOR | Pintu dalam |
| EXTERIOR DOOR | Pintu luar |
| WINDOWS | Jendela |
| INSULATION | Insulasi |
| SKYLIGHTS | Jendela atap |

### 💡 Pencahayaan
| Nama DB | Padanan |
|---------|---------|
| CHANDELIERS | Lampu gantung |
| PENDANT LIGHTS | Lampu gantung kecil |
| WALL SCONCE | Lampu dinding |
| LIGHTING | Lampu (generik) |

### 📦 Penyimpanan (Detail)
| Nama DB | Padanan |
|---------|---------|
| STORAGE LOCKER | Loker penyimpanan |
| EQUIPMENT STORAGE | Penyimpanan peralatan |
| TOOL STORAGE | Penyimpanan alat |

### 🏪 Komersial & Lain-lain (Detail)
| Nama DB | Padanan |
|---------|---------|
| ONE GATE SYSTEM | Sistem satu gerbang, One gate |
| LEMARI | Lemari (sinonim wardrobe/closet) |
| BUSINESS AREA | Area usaha |
| RETAIL AREA | Area toko |

---

## Context Injection (Backend Otomatis)

Backend menginjeksikan block berikut ke setiap prompt via `aiContextService.js`:

```
## FACILITY REFERENCE (from database — N facilities) — BILINGUAL

Registered facilities (use these exact names when quoting):
AC | BALCONY | BAR | BBQ AREA | BED | BEDROOM | BILLIARD ROOM | ...

When a customer mentions facilities, acknowledge specifically which ones match.
```

`N` = jumlah fasilitas aktif di database saat request diproses (dinamis, cache 5 menit).
Jangan hardcode angka ini — selalu anggap daftar bisa berubah (fasilitas baru bisa
ditambahkan admin kapan saja). Saat memanggil AI via API Key (bukan chatbot DB-live),
gunakan tabel-tabel di file `.md` ini sebagai referensi statis terbaru.

**Rules untuk AI saat menerima context ini:**
- Gunakan nama dari daftar saat menyebut fasilitas secara spesifik
- Jika customer minta fasilitas yang TIDAK ada di daftar → tanyakan konfirmasi / tawarkan alternatif terdekat
- Kumpulkan semua fasilitas yang diminta dalam summary di `✓ Fasilitas:`
- Fasilitas yang disebutkan di Q2b / Q_FAC tetap dicatat walaupun belum Q_FAC

---

## Q_FAC — Pertanyaan Fasilitas (Wajib untuk Sewa)

Untuk setiap transaksi **sewa**, tanyakan fasilitas setelah Q11:

```
ID: Ada fasilitas tertentu yang Anda inginkan? Misalnya AC, kolam renang,
    gym, keamanan 24 jam, atau yang lainnya? 🏊
EN: Any specific facilities you'd like? For example AC, swimming pool, gym,
    24-hour security, or others? 🏊
```

Referensi kategori fasilitas yang sering ditanyakan customer:
- **Keamanan**: CCTV, SECURITY 24H, GUARD HOUSE
- **Kenyamanan**: AC, WATER HEATER, WI-FI
- **Rekreasi**: GYM, SWIMMING POOL / KOLAM RENANG, KIDS ZONE
- **Parkir**: PARKING, CARPORT
- **Layanan**: LAUNDRY, ROOM SERVICE

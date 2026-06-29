# 16 — Facilities Reference (dari Database)

## Tentang File Ini

File ini berisi **126 nama fasilitas resmi** yang terdaftar di database Elevan Property.
Backend secara otomatis menginjeksikan daftar ini ke dalam prompt AI setiap percakapan
melalui `aiContextService.buildFacilityContextBlock()`.

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

## Context Injection (Backend Otomatis)

Backend menginjeksikan block berikut ke setiap prompt via `aiContextService.js`:

```
## FACILITY REFERENCE (from database — 126 facilities)

Registered facilities (use these exact names when quoting):
AC | BALCONY | BAR | BBQ AREA | BED | BILLIARD ROOM | ...

When a customer mentions facilities, acknowledge specifically which ones match.
```

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

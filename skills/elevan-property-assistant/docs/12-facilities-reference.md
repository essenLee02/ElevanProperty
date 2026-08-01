# 12 — Facilities Reference & Recognition

> **Conditional doc.** Loaded only when the conversation mentions facilities/amenities.
> Merges the former docs 16 (reference vocabulary) + 18 (recognition & normalization).

---

## 1. Source of Truth

If your conversation context (a system message, catalog data, or tool result) gives you an
authoritative facility list for the properties you're discussing — e.g. something like:

```
## FACILITY REFERENCE (N facilities) — BILINGUAL
Registered facilities (use these exact names when quoting):
AC | BALCONY | BAR | BBQ AREA | BED | BEDROOM | ...
```

— that list **outranks** the tables in this file; use its exact names when quoting facilities.
The tables below are the fallback vocabulary for recognizing and normalizing what a customer
says when no such live list is available to you.

**Never invent a facility name.** If a customer asks for something absent from any list you
have, confirm what they mean or offer the closest known alternative.

---

## 2. How to Handle a Facility Mention

1. **Match** the customer's wording to a registered facility ("mau yang ada gym" → `GYM`).
2. **Acknowledge specifically** — name the ones you matched, so the customer feels heard.
3. **Normalize internally** to the canonical English name; **reply in the customer's language**.
4. **Accumulate** across the whole session — facilities mentioned back in Q2b still count.
5. **Collect into the summary** comma-joined: `✓ Fasilitas: AC, Gym, Kolam renang`.

```
Customer: "Saya mau tempat yang ada AC, WiFi, dan kolam renang"
AI:       "Siap, Kak — saya catat AC, WiFi, dan kolam renang ya 👍"
→ ✓ Fasilitas: *AC, WiFi, Kolam renang*

Customer: "I need a place with AC, WiFi, and a gym"
AI:       "Got it! Noted: AC, WiFi, and Gym."
→ ✓ Facilities: *AC, WiFi, Gym*
```

**Language switch mid-chat:** keep the canonical names internally, switch the reply language.
Facilities captured in Indonesian stay valid when the customer switches to English.

---

## 3. Q_FAC — The Facilities Question

**Mandatory for `sewa`.** Recommended for `beli` residential. Not asked for commercial types.
Fires after Q11 (furnishing), before the summary. Adapt the examples to the property type:

```
Rumah / default
ID: Ada fasilitas tertentu yang Anda inginkan? Misalnya AC, kolam renang, gym,
    carport/garasi, keamanan 24 jam, atau yang lainnya? 🏊
EN: Any specific facilities you'd like? For example AC, swimming pool, gym,
    carport/garage, 24-hour security, or others? 🏊

Apartemen  → kolam renang, gym, rooftop, keamanan 24 jam
Villa      → kolam renang pribadi, dapur lengkap, BBQ area
```

**Do not show a `sewa` summary before Q_FAC has been asked.** If still un-asked at summary
time it appears as `✗ Fasilitas: (Belum ditanyakan)` — a visible gap for the agent.

---

## 4. Standard Facilities (the "terserah" fallback)

When the customer answers **"standar" / "biasa" / "terserah" / "tidak tahu" / "apa saja" /
"gak ada"**, they have no specific preference. **Never leave the field empty** — auto-fill from
the table below.

| Property | Fasilitas Standar (Default) |
|---|---|
| **House (Rumah)** | Kamar tidur, kamar mandi, ruang tamu, ruang keluarga, dapur, ruang makan, listrik, air PDAM/sumur, carport/garasi, halaman depan, halaman belakang, pagar, tempat jemuran, instalasi TV, internet/Wi-Fi (opsional), AC (opsional), water heater (opsional), kitchen set (opsional), CCTV (opsional), keamanan lingkungan, akses kendaraan roda empat |
| **Apartment** | Kamar tidur, kamar mandi, ruang tamu, pantry/kitchen set, balkon (opsional), AC, water heater, listrik, air, Wi-Fi, TV, lemari pakaian, tempat tidur, sofa, meja makan, kulkas, kompor, microwave (opsional), mesin cuci (opsional), lift, parkir, lobby, keamanan 24 jam, CCTV, akses kartu (access card), gym, kolam renang, taman, minimarket, laundry (opsional) |
| **Hotel (Booking)** | Tempat tidur, kamar mandi dalam, shower, water heater, AC, TV, Wi-Fi gratis, meja kerja, lemari pakaian, telepon, ketel listrik, air mineral, kopi & teh, perlengkapan mandi, handuk, sandal hotel, hair dryer (opsional), housekeeping, resepsionis 24 jam, room service (opsional), restoran, area parkir, lift, keamanan 24 jam, CCTV, kolam renang (opsional), gym (opsional), ruang meeting (opsional), sarapan (opsional) |
| **Villa (Booking/Sewa)** | Kamar tidur, kamar mandi, ruang keluarga, ruang makan, dapur lengkap, kitchen set, AC, Wi-Fi, TV, kulkas, kompor, microwave, dispenser, mesin cuci (opsional), taman, gazebo (opsional), kolam renang pribadi (opsional), BBQ area (opsional), balkon, teras, parkir mobil, garasi (opsional), keamanan, CCTV (opsional), pemandangan alam (opsional), housekeeping (opsional) |
| **Boarding House / Kost (Sewa Kamar)** | Tempat tidur, kasur, lemari pakaian, meja belajar, kursi, kamar mandi dalam/luar, listrik, air, Wi-Fi, AC atau kipas angin, jendela, jemuran, akses dapur bersama (opsional), dispenser bersama (opsional), kulkas bersama (opsional), parkir motor, parkir mobil (opsional), CCTV, keamanan, akses 24 jam (opsional), laundry (opsional), ruang tamu bersama |
| **Shophouse / Ruko (Sewa/Kontrak)** | Bangunan utama, area usaha, toilet, listrik, air, area parkir, rolling door, gudang kecil, lantai usaha, tangga (2 lantai+), jaringan internet, telepon, CCTV (opsional), keamanan, akses kendaraan besar, area loading, papan nama usaha |
| **Office (Kantor)** | Ruang kerja, ruang meeting, ruang resepsionis, pantry, toilet, AC, listrik, air, internet, Wi-Fi, telepon, lift (gedung), parkir mobil, parkir motor, keamanan 24 jam, CCTV, akses kartu, genset, ruang server (opsional), cleaning service, lobby |
| **Warehouse (Gudang)** | Area gudang, kantor administrasi (opsional), toilet, listrik, air, akses truk, loading dock, area bongkar muat, parkir truk, parkir mobil, parkir motor, plafon tinggi, ventilasi, CCTV, keamanan 24 jam, pagar, jalan beton, akses kontainer, hydrant (opsional) |
| **Store (Toko)** | Area display, gudang kecil, toilet, listrik, air, lampu, etalase (opsional), rolling door, internet, parkir pelanggan, papan nama toko, CCTV (opsional), akses kendaraan |
| **Condo** | Kamar tidur, kamar mandi, ruang tamu, dapur, kitchen set, AC, water heater, Wi-Fi, TV, kulkas, kompor, microwave, oven (opsional), mesin cuci, balkon, sofa, meja makan, tempat tidur, lemari pakaian, lift, parkir, keamanan 24 jam, CCTV, access card, gym, kolam renang, jogging track, taman, coworking space (opsional), playground |
| **Mansion House** | Banyak kamar tidur, beberapa kamar mandi, master bedroom, walk-in closet, ruang tamu besar, ruang keluarga, ruang makan, dapur utama, dapur bersih, dapur kotor, ruang kerja, ruang hiburan, home theater (opsional), perpustakaan (opsional), AC sentral, water heater, smart home, Wi-Fi, CCTV, alarm, garasi beberapa mobil, carport, taman depan, taman belakang, kolam renang pribadi, gazebo, balkon, rooftop (opsional), gudang, kamar ART, kamar sopir, keamanan 24 jam |
| **Kondotel** *(not in the customer's original table — kept from the prior version)* | Tempat tidur, kamar mandi dalam, shower, water heater, AC, TV, Wi-Fi, kitchenette, lemari pakaian, housekeeping, resepsionis, lift, parkir, keamanan 24 jam, CCTV, kolam renang, gym |

**Furnishing adds furniture** for hunian types (house/apartment/villa/condo/kost/mansion) — the
`(opsional)` items above are exactly what furnishing tier fills in:
- **Full furnished** → adds nearly all the `(opsional)` items (AC, kitchen set, kulkas, lemari,
  tempat tidur, TV, water heater, mesin cuci, …)
- **Semi furnished** → adds a subset (typically AC, kitchen set, lemari, kulkas)
- **Kosongan / unfurnished** → base list only, `(opsional)` items dropped

Commercial types (shophouse/office/warehouse/store) **ignore furnishing** — the list is the
same regardless of what the customer says about furnishing.

### The two display markers

```
✓ Fasilitas: *AC, Gym, Kolam renang*                    ← customer named them
✗ Fasilitas: *[daftar standar] (Fasilitas standar)*     ← customer said "terserah"
✗ Fasilitas: *(Belum ditanyakan)*                       ← Q_FAC never asked
```

### ⚠️ Standard facilities are ALWAYS appended, never replaced

Even when the customer names specific facilities, **append** the type's standard list
(deduped) so the agent and catalog get the full picture. **Customer's specific items go
first**, standards follow:

```
Customer asks: Gym, AC, Smart Door, Dinner   (apartemen)
✓ Fasilitas: Gym, AC, Smart Door, Dinner, Kamar Tidur, Kamar Mandi,
             Dapur/Pantry, Lift, Keamanan 24 jam, Parkir
```

Same rule for a mixed answer — *"pokok standar, tambahin kulkas dan spring bed"* → specific
items (kulkas, spring bed) first, then the uncovered standards.

---

## 4a. Premium Facilities (only when the customer signals "exclusive")

When the customer signals they want something **mewah / eksklusif / premium / luxury / fully
furnished** (e.g. "villa premium", "condo luxury", "yang eksklusif aja"), you may draw from
this additional pool **on top of** the type's standard list — never in place of it.

```
Smart Home System · Smart Door Lock · Fingerprint Access · Lift Pribadi · Private Pool ·
Jacuzzi · Sauna · Gym · Rooftop Garden · BBQ Area · Playground · Jogging Track ·
Tennis Court · Basketball Court · Function Hall · Ballroom · Concierge · Shuttle Service ·
EV Charging Station · Solar Panel · Backup Generator (Genset) · Water Treatment System ·
Pet Friendly · Ocean View · Mountain View · City View · Lake View · River View ·
Private Beach Access
```

**Use judgment — never dump the whole list.** This pool is generic across property types; most
items are not relevant to every type/location (a "Private Beach Access" makes sense for a
Bali villa, not a city apartment). Pick the handful that plausibly fit the type + location +
what the customer actually described, the same way you'd naturally describe a premium listing
— don't mechanically append all 28 items to a summary line.

If in doubt about premium interest without enough signal to pick specific items, it's fine to
just note the interest generically (*"🌟 Minat properti premium/eksklusif"*) rather than forcing
a selection — but always prefer picking specific plausible items when you have enough signal to.

### Catalog ranking, not filtering

Requested facilities should **boost** listings that have the most requested amenities — an
overlap match, not an exact-match requirement. Treat this as a **ranking boost, never a
hard filter** — listings lacking them still appear, just lower. The customer always gets the
closest available alternatives.

---

## 5. Recognition Patterns

**Indonesian**
```
"Ada AC, WiFi, dan CCTV"            → AC, WiFi, CCTV
"Fasilitas standar aja"             → standard fallback (§4)
"Lengkap dengan kitchen set"        → Kitchen Set
"Mau yang ada gym dan kolam"        → Gym, Kolam Renang
"Ada gerbang keamanan 24 jam"       → Security 24H
```

**English**
```
"I need AC and WiFi"                → AC, WiFi
"Gym and pool access"               → Gym, Swimming Pool
"24-hour security system"           → Security 24H
"Air conditioning required"         → AC
```

**Normalizations** — accept the variant, store the canonical name:

| Customer writes | Canonical |
|---|---|
| AC, A/C, air conditioning | AC / Air Conditioner ❄️ |
| WiFi, Wifi, wi fi | WI-FI 📶 |
| Kolam, kolam renang, pool | KOLAM RENANG / SWIMMING POOL 🏊 |
| Kamar mandi, toilet, WC | BATHROOM / TOILET 🚿 |
| Parkir, parking | PARKING 🚗 |
| CCTV, kamera keamanan | CCTV 📹 |
| Gym, fitness, nge-gym | GYM 🏋️ |
| One gate, satu gerbang | ONE GATE SYSTEM 🚪 |
| Lemari, closet | WARDROBE 📦 |

**High-frequency facilities** (recognize these instantly):
```
❄️ AC        📶 WiFi       🏊 Kolam renang   🏋️ Gym        🚗 Parkir/Carport
🔐 Security  📹 CCTV       🍳 Kitchen set    🛏️ Kasur      🚿 Kamar mandi
💧 Air/PDAM  ⚡ Listrik/PLN 🌳 Taman         🛗 Lift        🧺 Laundry
```

---

## 6. Vocabulary by Category

Use the DB name (or its natural Indonesian equivalent) when quoting a facility.

### 🛏️ Kamar & Ruang Dalam
`BED` Kasur · `SPRING BED` · `BEDROOM` Kamar tidur · `MASTER BEDROOM` Kamar utama ·
`GUEST BEDROOM` Kamar tamu · `KIDS BEDROOM` Kamar anak · `BEDROOM ENSUITE` Kamar + KM dalam ·
`BEDROOM BALCONY` Balkon kamar · `WARDROBE` / `LEMARI` · `STUDY DESK` Meja belajar ·
`LIVING ROOM` Ruang tamu · `DINING ROOM` Ruang makan · `FAMILY ROOM` Ruang keluarga ·
`GUEST ROOM` · `STORAGE` Ruang simpan · `FLEXIBLE LAYOUT`

### 🚿 Kamar Mandi & Air
`BATHROOM` · `PRIVATE BATHROOM` KM dalam · `SHARED BATHROOM` KM bersama · `TOILET` ·
`SHOWER` / `SHOWER ROOM` · `BATH TUB` · `JACUZZI` / `JACUZZI TUB` · `WATER HEATER` ·
`OUTDOOR SHOWER` · `BATHROOM SINK` Wastafel · `TOWELS` Handuk · `TOILETRIES` ·
`ACCESSIBLE BATHROOM` KM difabel · `GRAB BAR` Pegangan difabel · `PDAM WATER` Air PDAM

### 🍽️ Dapur & Makan
`KITCHEN` Dapur · `KITCHEN SET` · `PANTRY` · `SHARED KITCHEN` Dapur bersama ·
`OUTDOOR KITCHEN` · `KITCHEN ISLAND` · `OVEN` · `MICROWAVE` · `DISHWASHER` ·
`REFRIGERATOR` / `FRIDGE` Kulkas · `FREEZER` · `STOVE BURNER` / `GAS RANGE` /
`ELECTRIC RANGE` / `INDUCTION COOKTOP` Kompor · `RANGE HOOD` Penghisap asap ·
`BREAKFAST` / `LUNCH` / `DINNER` · `BREAKFAST INCLUDED` Sarapan termasuk

### 🏊 Kolam & 🏋️ Kebugaran
`KOLAM RENANG` / `SWIMMING POOL` / `POOL` · `INFINITY POOL` · `PRIVATE POOL` ·
`GYM` · `FITNESS AREA` · `GYM EQUIPMENT` · `TREADMILL` · `WEIGHT RACK` · `DUMBBELL SET` ·
`YOGA` / `YOGA ROOM` / `YOGA DECK` · `SAUNA` · `STEAM ROOM` · `SPA` / `SPA TUB` ·
`TENNIS COURT` · `BILLIARD ROOM` · `GAME ROOM` · `KIDS ZONE` · `RECREATION AREA` ·
`LOCKER ROOM` · `MASSAGE CHAIR` · `OPEN AIR LOUNGE`

### 🔒 Keamanan & Smart Home
`SECURITY` · `SECURITY 24H` · `CCTV` / `CCTV 24 JAM` / `CCTV CAMERA` · `GUARD HOUSE` Pos satpam ·
`ONE GATE SYSTEM` · `FENCE` Pagar · `SMART DOOR` / `SMART LOCK` · `ALARM SYSTEM` ·
`VIDEO INTERCOM` · `MOTION SENSOR` · `24-HOUR ACCESS` · `FIRE EXTINGUISHER` ·
`FIRE SUPPRESSION` · `SPRINKLER SYSTEM` · `FIRST AID KIT` · `WHEELCHAIR RAMP` ·
`SMART HOME` / `SMART HOME SYSTEM` · `SMART TV` · `HOME THEATER` · `WI-FI` / `INTERNET`

### 🚗 Parkir & Akses
`PARKING` / `PARKING SPACE` · `CARPORT` / `COVERED CARPORT` · `GARAGE` Garasi ·
`PARKING 4+ CARS` · `PARKIR SEPEDA MOTOR` / `MOTORCYCLE PARKING` · `BIKE RACK` ·
`TRUCK ACCESS` · `FORKLIFT ACCESS` · `WIDE GATE` · `LOADING AREA` / `LOADING DOCK` ·
`MAIN ROAD ACCESS` / `MAIN ROAD FRONTAGE` · `LIFT` / `ELEVATOR` · `PRIVATE ELEVATOR`

### 🌿 Outdoor & Taman
`GARDEN` Taman · `YARD` Halaman · `BALCONY` Balkon · `TERRACE` Teras · `PATIO` · `DECK` ·
`VERANDA` Beranda · `ROOFTOP` / `ROOFTOP GARDEN` / `ROOFTOP TERRACE` · `BBQ AREA` /
`BBQ GRILL` · `LANDSCAPING` · `FLOWER BED` · `VEGETABLE GARDEN` · `HERB GARDEN` ·
`DOG PARK` · `PET AREA`

### 🏨 Hotel & Layanan
`RECEPTION` Resepsionis · `CONCIERGE` · `ROOM SERVICE` · `BUTLER SERVICE` ·
`PRIVATE CHEF` · `HOUSEKEEPING ROOM` · `LAUNDRY` / `LAUNDRY SERVICE` / `LAUNDRY ROOM` ·
`WASHING MACHINE` Mesin cuci · `DRYER` Pengering · `IRONING BOARD` · `LINEN CLOSET` ·
`AC` · `STAFF QUARTERS` Kamar ART · `MINIMARKET` · `RESTAURANT` · `BAR` · `ATM`

### 🏢 Kantor & Komersial
`MEETING ROOM` · `CONFERENCE ROOM` · `BOARDROOM` · `BUSINESS CENTER` ·
`CO-WORKING SPACE` · `OFFICE ROOM` · `OFFICE CHAIR` · `CAFETERIA` · `LOUNGE AREA` ·
`PRAYER ROOM` Mushola · `MEZZANINE` · `RAISED FLOOR` · `HIGH CEILING` · `SERVER ROOM` ·
`PROJECTOR` · `SOUND SYSTEM` · `BUSINESS AREA` · `RETAIL AREA`

### 🏗️ Gudang & 🏪 Toko
`WAREHOUSE` Gudang · `RACKING SYSTEM` · `COLD STORAGE` · `EQUIPMENT STORAGE` ·
`TOOL STORAGE` · `STORAGE LOCKER` · `DISPLAY AREA` · `SIGNAGE` / `SIGNAGE SPACE` /
`OUTDOOR SIGNAGE` · `POS SYSTEM` Kasir · `CASH COUNTER` · `FITTING ROOM` /
`CHANGING ROOM` · `ROLLING DOOR`

### ⚡ Utilitas, ❄️ HVAC & 🏠 Interior
`PLN ELECTRICITY` / `ELECTRICITY` · `ELECTRICAL PANEL` · `CIRCUIT BREAKER` ·
`GENERATOR` / `BACKUP GENERATOR` Genset · `UPS SYSTEM` · `SOLAR PANELS` ·
`PLUMBING SYSTEM` · `DRAINAGE SYSTEM` · `GUTTER SYSTEM` · `THERMAL SPRING` ·
`CENTRAL AC` · `HVAC SYSTEM` · `HEATING SYSTEM` · `THERMOSTAT` · `CEILING FAN` ·
`VENTILATION FAN` · `FRESH AIR INTAKE` · `ROOF` Atap · `WINDOWS` · `SKYLIGHTS` ·
`STAIRS` Tangga · `INSULATION` · `HARDWOOD FLOOR` / `TILE FLOORING` / `MARBLE FLOOR` /
`CARPET FLOORING` · `WALL PAINT` · `CROWN MOLDING` · `CHANDELIERS` · `PENDANT LIGHTS` ·
`WALL SCONCE` · `LIGHTING`

### 🌟 Luxury
`LIBRARY` Perpustakaan · `WINE CELLAR` · `BALLROOM` · `ART GALLERY` · `FIREPLACE` Perapian ·
`STADIUN NONTON` Home cinema · `HOME THEATER` · `TV`

---

## Related Docs

- `04-qualification-flow.md` — where Q_FAC sits in the sequence, summary field rules
- `08-catalog-and-recommendations.md` — how facilities affect catalog ranking
- `13-locations-and-landmarks.md` — the location-anchor counterpart of this reference

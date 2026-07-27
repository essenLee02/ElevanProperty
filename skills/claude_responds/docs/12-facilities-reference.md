# 12 — Facilities Reference & Recognition

> **Conditional doc.** Loaded only when the conversation mentions facilities/amenities.
> Merges the former docs 16 (reference vocabulary) + 18 (recognition & normalization).

---

## 1. Source of Truth

The authoritative facility list lives in the **`facilities` table** and is injected into every
prompt by `aiContextService.buildFacilityContextBlock()`:

```
## FACILITY REFERENCE (from database — N facilities) — BILINGUAL
Registered facilities (use these exact names when quoting):
AC | BALCONY | BAR | BBQ AREA | BED | BEDROOM | ...
```

**Never hardcode the facility count or row IDs** — admins add facilities at any time, and
`detectFacilities()` reads the DB `keywords` column. If the injected `## FACILITY REFERENCE`
block is present, it **outranks** the tables in this file. The tables below are the static
fallback used when the skill is loaded via API key without a live DB block.

**Never invent a facility name.** If a customer asks for something absent from the list,
confirm what they mean or offer the closest registered alternative.

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
the table below. (Server mirror: `utils/standardFacilities.js`.)

| Tipe Properti | Fasilitas Standar |
|---|---|
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

**Furnishing adds furniture** for hunian types (house/apartment/villa/condo/kost/mansion):
- **Full furnished** → + TV, Kulkas, Lemari, Tempat Tidur, Kitchen set
- **Semi furnished** → + sebagian (Kitchen set, Lemari, Kulkas)
- **Kosongan** → fasilitas dasar bangunan saja

Per-type × furnishing shortlists:
`Rumah semi` = AC, Kitchen set, CCTV, Lemari, Kamar mandi, Kulkas, One gate system ·
`Rumah full` = + Tempat tidur, TV · `Rumah unfurnished` = Kamar mandi, One gate system ·
`Apartemen semi` = AC, Kitchen set, Lemari, Kamar mandi · `Apartemen full` = + Tempat tidur, TV,
Kulkas, Microwave · `Kos full` = AC, Kasur, Lemari, Kamar mandi dalam, WiFi, Meja belajar ·
`Kos semi` = AC, Kamar mandi dalam · `Villa` = AC, Kitchen set, Kolam renang, Kamar mandi.

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

### Catalog ranking, not filtering

Requested facilities feed `facilityMatchScore()`, a `LIKE '%X%' OR …` overlap score that
**prioritizes** listings having the most requested amenities. It is a **ranking boost, never a
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

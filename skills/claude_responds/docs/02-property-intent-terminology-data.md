# 02 — Property Intent, Terminology, and Data

## Two-Condition Detection Logic

A message is treated as a property query when it satisfies **either** condition:

```
Condition A: Property Type KEYWORD + Action Word
Condition B: Standalone property keyword alone (always triggers)
```

If only an action word is present without a property type → NOT a property query.  
Example: "sewa mobil" → sewa (action) + mobil (not property) → SKIP.

---

## Bilingual Support

Both Indonesian and English queries are fully recognized.

**English property types recognized:**
```
house, home, room, apartment, apt, hotel, motel, villa, office,
warehouse, store, shophouse, property, residential, land, lot,
studio, loft, penthouse, boarding house
```

**English action words recognized:**
```
get, find, want, need, looking for, looking, buy, rent, sell, lease,
cheap, cheaper, cheapest, affordable, murah, terjangkau,
price, cost, how much, recommend, show, list, available
```

---

## Transaction Intent

| User Term | Detected Type |
|---|---|
| sewa, disewakan, kontrak, ngontrak, kos | rent |
| rent, rental, lease | rent |
| beli, membeli | purchase |
| buy, purchase | purchase |
| jual, dijual | sale |
| sell, sale | sale |

Complex schemes (lelang, joint venture, barter, sewa-beli, lease-to-own):  
Acknowledge, explain limitation, redirect to rent/sale, or escalate.

---

## Building Type Mapping

| User Terms (ID + EN) | Catalog Type |
|---|---|
| rumah, house, home, residential | house |
| kontrakan, rumah kontrakan | house (rent intent) |
| apartemen, apartment, condo, unit, studio | apartment |
| kos, kost, kosan, indekos, boarding house | boarding_house |
| hotel, motel, penginapan | hotel |
| villa, vila, resort | villa |
| ruko, rukan, shophouse, toko, store | shophouse |
| kantor, office, perkantoran | office |
| gudang, warehouse, pergudangan | warehouse |
| kavling, tanah, lahan, lot, land | others |
| loft, penthouse | others |

**Type priority (to avoid substring collisions):**

```
warehouse and shophouse are checked BEFORE house
(because "warehouse" contains "house" as a substring)
```

---

## Standalone Keywords (always property queries)

Any of these alone — without a property type — is enough to trigger:

```
KPR, kredit pemilikan, over kredit, inden, pre-launch
uang muka rumah, DP rumah, cicilan rumah
perumahan, real estate, siap huni
ready unit, ready stok, unit ready, unit available, unit kosong
sertifikat hak milik, SHM, HGB, IMB, PBG
agen properti, developer properti, developer
listing properti, listing property, properti dijual, properti disewakan
berapa kamar, berapa lantai, luas bangunan, luas tanah
fasilitas perumahan, akses tol, dekat sekolah, dekat mall
```

---

## Exclusion Words (prevent false positives)

"Rumah" alone is ambiguous. If followed by these → NOT a property query:

```
rumah makan, rumah sakit, rumah tangga, rumah ibadah, rumah tahanan
rumah duka, rumah produksi
```

---

## Location Extraction

Locations are extracted from message using:

1. Pattern `di [kota]` / `in [city]`
2. Direct city name match against 50+ Indonesian cities
3. `di daerah`, `area`, `kawasan`, `kota`, `wilayah` prefix support

Supported cities include: Jakarta, Surabaya, Bandung, Semarang, Yogyakarta, Malang, Bali,
Denpasar, Medan, Makassar, Balikpapan, Samarinda, Palembang, Pekanbaru, Batam,
and all 36 provinces.

---

## Price Sort Detection

| Keywords | Sort Direction |
|---|---|
| cheap, cheaper, cheapest, affordable, murah, terjangkau, hemat, budget | ascending (cheapest first) |
| expensive, luxury, premium, mewah, mahal, termahal | descending (most expensive first) |
| (none) | default catalog order |

---

## Explicit Fallback Type Detection

When customer explicitly mentions an alternative type:

| Pattern | Detected |
|---|---|
| "kalau tidak ada hotel, villa saja" | primaryType: hotel, fallbackTypes: [villa] |
| "hotel atau villa" | primaryType: hotel, fallbackTypes: [villa] |
| "jika gak ada rumah, apartemen juga boleh" | primaryType: house, fallbackTypes: [apartment] |

Fallback types are only used **after** the primary type has no results.

---

## Budget Parsing

The server parses budget ranges and outputs full Indonesian dot notation (e.g. `Rp 5.000.000`).
The dot (`.`) is the **thousands separator** in Indonesian numbers — not a decimal point.

### Input units supported

| Input notation | Meaning | Multiplier |
|---|---|---|
| `K`, `k`, `rb`, `ribu` | ribuan | × 1.000 |
| `jt`, `juta` | jutaan | × 1.000.000 |
| `m`, `miliar`, `milyar` | miliaran | × 1.000.000.000 |
| `t`, `triliun` | triliun | × 1.000.000.000.000 |
| `5.000.000` (dots = thousands sep) | exact IDR | as-is |

### Range parsing — all supported cases

| Customer input | Parsed output |
|---|---|
| `1-2 jt` | Rp 1.000.000 - Rp 2.000.000 |
| `3jt-5jt` | Rp 3.000.000 - Rp 5.000.000 |
| `2.6juta-5jt` | Rp 2.600.000 - Rp 5.000.000 |
| `1.3-6juta` | Rp 1.300.000 - Rp 6.000.000 |
| `500K-1juta` | Rp 500.000 - Rp 1.000.000 |
| `700-4 juta` | Rp 700.000 - Rp 4.000.000 |
| `900 K-12 jt` | Rp 900.000 - Rp 12.000.000 |
| `135K-800K` | Rp 135.000 - Rp 800.000 |
| `430 K - 900` | Rp 430.000 - Rp 900.000 |
| `670-1m` | Rp 670.000.000 - Rp 1.000.000.000 |
| `40-300 juta` | Rp 40.000.000 - Rp 300.000.000 |
| `80 - 2 miliar` | Rp 80.000.000 - Rp 2.000.000.000 |
| `400juta-35` | Rp 400.000.000 - Rp 35.000.000.000 |
| `578K-67` | Rp 578.000 - Rp 67.000.000 |
| `5.000.000-412.567.000` | Rp 5.000.000 - Rp 412.567.000 |
| `569.210.000 - 5m` | Rp 569.210.000 - Rp 5.000.000.000 |
| `678 jt - 900m` | Rp 678.000.000 - Rp 900.000.000.000 |
| `300m - 3t` | Rp 300.000.000.000 - Rp 3.000.000.000.000 |
| `879 miliar - 4 t` | Rp 879.000.000.000 - Rp 4.000.000.000.000 |
| `430 m - 2triliun` | Rp 430.000.000.000 - Rp 2.000.000.000.000 |
| `500-700` | **AMBIGUOUS** → ask for unit |

### Unit inference rules (when one side has no explicit unit)

**Only right side has unit (X - Yunit):**
- X_raw ≤ Y_raw → X uses same unit as Y
- X_raw > Y_raw → X uses one step DOWN: juta→ribu, miliar→juta, triliun→miliar

**Only left side has unit (Xunit - Y):**
- Y_raw ≥ X_raw → Y uses same unit as X
- Y_raw < X_raw → Y uses one step UP: ribu→juta, juta→miliar, miliar→triliun

**Full IDR + bare number or bare + full IDR** → AMBIGUOUS (ask customer)
**Neither side has unit (e.g. `500-700`)** → AMBIGUOUS (ask customer):
> "Untuk harga *500-700* — maksudnya dalam *ribu*, *juta*, *miliar*, atau *triliun*?"

### IDR denomination reference

| Denomination | Indonesian | Amount | Example |
|---|---|---|---|
| Ribuan | thousand | 1.000 | Rp 500.000 |
| Ratusan ribu | hundred thousand | 100.000 | Rp 800.000 |
| Jutaan | million | 1.000.000 | Rp 5.000.000 |
| Ratusan juta | hundred million | 100.000.000 | Rp 400.000.000 |
| Miliar | billion | 1.000.000.000 | Rp 2.000.000.000 |
| Ratusan miliar | hundred billion | 100.000.000.000 | Rp 300.000.000.000 |
| Triliun | trillion | 1.000.000.000.000 | Rp 3.000.000.000.000 |
| Ratusan triliun | hundred trillion | 100.000.000.000.000 | Rp 200.000.000.000.000 |

### Single-value formats

```
"budget 5 juta"        → Rp 5.000.000
"harga 2 miliar"       → Rp 2.000.000.000
"Rp 500 ribu"          → Rp 500.000
"Rp 5.000.000"         → Rp 5.000.000 (full IDR input)
"terjangkau / murah"   → preference: affordable (sort cheapest first)
```

### Period terms

bulan / month / per bulan → `period: month`
tahun / year / per tahun  → `period: year`
malam / night / harian    → `period: night`

### How to echo budget back to customer

Always use the server-resolved full dot notation — never abbreviate:
```
❌ "budget 400 juta sampai 35 miliar"
✅ "budget Rp 400.000.000 - Rp 35.000.000.000"

❌ "harga sekitar 578 ribu sampai 67 juta"
✅ "harga Rp 578.000 - Rp 67.000.000"

❌ "kisaran 2.6 juta sampai 5 juta"
✅ "kisaran Rp 2.600.000 - Rp 5.000.000"
```

---

## Facility Terms

Recognized facilities:

```
ac, wifi, wi-fi, parking, parkir, kitchen, dapur,
full furnish, furnished, security, kolam renang / pool,
gym, lift, laundry
```

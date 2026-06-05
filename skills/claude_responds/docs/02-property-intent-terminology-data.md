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

Supported budget formats:

```
"Rp 5.000.000/bulan"       → value: 5000000, period: month
"budget 2 miliar"           → value: 2000000000, no period
"harga 500 jt - 1 M"       → min: 500000000, max: 1000000000
"500 juta sampai 1 miliar"  → range
"di bawah 3 juta per tahun" → max: 3000000, period: year
```

Period terms: bulan/month, tahun/year, malam/night, harian/daily.

---

## Facility Terms

Recognized facilities:

```
ac, wifi, wi-fi, parking, parkir, kitchen, dapur,
full furnish, furnished, security, kolam renang / pool,
gym, lift, laundry
```

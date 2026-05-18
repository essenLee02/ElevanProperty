# 02 — Property Intent, Terminology, and Data

## Transaction Intent Mapping

| User Terms | Meaning |
|---|---|
| sewa, disewakan, kontrak, kontrakan | rent |
| rent, rental, lease | rent |
| beli, membeli, cari untuk dibeli | purchase |
| buy, purchase | purchase |
| jual, dijual | sale |
| sell, sale | sale |

## Complex or Unsupported Transaction Terms

| User Term | Handling |
|---|---|
| lelang, auction | explain that auction is not directly handled unless catalog has it; offer sale alternatives |
| joint venture, kerja sama | explain that this needs human/business confirmation |
| sewa-beli, lease-to-own | explain limitation and ask whether user wants rent or sale options first |
| barter, tukar properti | explain limitation and escalate if needed |
| investasi umum | answer only if related to available catalog/property options; avoid financial promises |

## Building Type Mapping

| User Terms | Catalog Type |
|---|---|
| rumah, house, home | house |
| kontrakan, rumah kontrakan | house with rent intent |
| apartemen, apartment, condo | apartment |
| hotel | hotel |
| villa, vila | villa |
| kos, kos-kosan, kost, tempat kos | boarding_house |
| kamar kos, boarding room | boarding_house |
| ruko, shophouse | shophouse |
| toko | not always shophouse; clarify if needed |
| kantor, office | office |
| gudang, warehouse | warehouse |
| lainnya, others | others |

## Price Periods

Understand and preserve price period context:

```text
per night / per malam
per day / per hari
per week / per minggu
per month / per bulan
per year / per tahun
```

If the period is not clear, do not invent it. Use the catalog price display as provided.

## Budget Expressions

Understand:

```text
5 juta - 10 juta per tahun
Rp 5.000.000 sampai Rp 10.000.000 per tahun
under 10 million per year
max 10 juta
di bawah 10 juta
sekitar 8 juta
5jt sampai 10jt
murah
budget terbatas
```

If user says "murah" without a number, provide available lower-priced catalog options or ask one short budget clarification.

## Catalog Data Fields

Use property fields exactly as provided:

```text
id
title
description
price
location
province
city
district
area
address
facilities
building_area
land_area
building_type
transaction_type
image
status
```

## Data Integrity Rules

- Use `title` as the property name.
- Use `price` exactly as provided.
- Use location, address, city, and province exactly as provided.
- Use facilities only when present in catalog data.
- Do not invent missing fields.
- Do not translate property title, address, city, province, price, ID, or image URL.

## Facilities

Recognize common facilities:

```text
AC
Wi-Fi
furnished
full furnished
parking
carport
security
kitchen
water heater
garden
pool
storage room
bed
wardrobe
```

If facilities are stored as boolean fields or arrays, present only available facilities.

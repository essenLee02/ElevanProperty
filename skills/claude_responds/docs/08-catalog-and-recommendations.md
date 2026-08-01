# 08 — Catalog Matching, Recommendations & Reply Format

How to select, rank, and present listings. Merges the former docs 03 (matching), 06 (format
templates), and 08 (Rumah123 live data).

---

## 1. The Core Rule

Recommend **only** properties present in the backend/catalog context.
**Never invent** names, prices, addresses, facilities, availability, agent contacts, or legal
status. If catalog data matches, present it as available — **never** say "no exact match" while
simultaneously listing matches.

**Privacy:** never expose owner data, internal pricing notes, or non-public metadata unless it
is explicitly in the customer-facing context.

---

## 2. Matching Priority

1. Transaction type (`rent` / `sale`)
2. Building type (`house` / `villa` / `apartment` / …)
3. Location (city → district → address)
4. Budget / price period
5. Facilities
6. Area/size and other preferences

### Strict type matching

When `buildingType` is specified, alternatives **must** be the same type — no exceptions unless
the customer explicitly allows one.

```
"sewa rumah di Surabaya"   → ONLY house
"sewa gudang di Semarang"  → ONLY warehouse
```

**The only exception — an explicit customer fallback:**
```
"hotel di Bali, kalau tidak ada villa saja"  → hotel first; villa if none. Never apartment/warehouse.
"hotel atau villa di Lombok"                 → hotel + villa both accepted.
```

### Per-agent scoping (WhatsApp)

On a WhatsApp terminal each agent recommends **only their own listings**
(`Property.user_id` = the agent owning the connected number). The query is scoped by owner,
building type, transaction type, city, and a numeric budget range, ordered by **price then
title**. Each listing surfaces its nearby landmarks (from `PropertyLocation`), so the Q6 anchor
is reflected in the results.

---

## 3. When There's No Exact Match

### Location fallback (type stays strict)

| Level | Scope | When |
|---|---|---|
| `exact` | The requested district/area | Always first |
| `city` | Other parts of the same city | No exact match |
| `national` | Same type, other cities | **ONLY if the customer never named a city at all** |

**⚠️ Hard rule (M64): if the customer named a city, never cross to a different one.**
A real incident: customer asked for a hotel in Surabaya; when Surabaya stock was thin,
the system offered hotels in Kota Jambi, Medan, and Banda Aceh — a different island,
useless to the customer. `national` scope exists only for the case where the customer
gave *no* location at all (e.g. "cariin hotel dong, budget 2 juta"). If a city was named
and it has nothing, say so honestly with the "No Match" template below — **never**
substitute a different city to appear more helpful.

Always say which level you're showing:
```
city:     "⚠️ Tidak ada [Tipe] di area tersebut. Berikut pilihan di bagian lain kota [Kota]:"
national: "⚠️ Belum ada [Tipe] di [Kota] saat ini. Berikut pilihan terdekat di kota lain:"
```

### Budget expansion (bounded by "harga wajar")

Deliberately **gradual** — small steps first, not a big jump straight to a wide range.
A ±35%/±70% jump offers listings far outside budget on the very first try, which reads
as not having listened to the number the customer gave.

| Step | Expansion | Example: 8–15 jt/bln |
|---|---|---|
| 1 | ±15% | 6.8 – 17.25 jt |
| 2 | ±30% (repeat step 1 once more) | 5.6 – 19.5 jt |
| 3 | Reasonable cap (min ×0.20 … max ×2.5) | 1.6 – 37.5 jt |

**Type + location stay intact** throughout — expanding the budget never means switching city
(see the hard rule above). Expansion is **capped** — never show a listing far outside the
budget (no 60-miliar listing for an 800rb/malam request). Never present anything beyond
~2.5× the stated maximum. Explain each step:
`"⚠️ Belum ada [ringkasan] di budget tersebut. Berikut pilihan terdekat:"`

### Alternative priority order

1. Same type + same city + broader budget (steps above)
2. Same type + different district of the same city (`city`)
3. Same type + nearby city (`national`) — **only if no city was named at all**
4. The explicit fallback type the customer named (still same city first)

### Standard-facilities fallback (nothing found at all)

When even the capped expansion finds nothing, the backend injects a
`NO CATALOG MATCH — STANDARD-FACILITIES FALLBACK` block. When you see it:

1. Honestly state nothing matches yet — **never invent a listing**.
2. Describe the **standard facilities for that type** as a "what this type typically offers"
   reference, using the supplied list.
3. Quote the **reasonable price range** the backend supplies.
4. Offer a concrete adjustment: budget, nearby area, or relaxed facilities.

```
"Maaf, belum ada Hotel yang pas di Surabaya sesuai budget tersebut, Kak.
Sebagai gambaran, hotel umumnya punya fasilitas standar: AC, TV, Wi-Fi, resepsionis,
housekeeping. Kisaran harga yang wajar sekitar [range]. Mau saya sesuaikan budget,
lokasi, atau fasilitasnya?"
```

### Total no-match
```
ID: Maaf, saat ini belum ada *[Tipe]* yang tersedia di *[Lokasi]* di katalog maupun Rumah123.
    Apakah Anda ingin mencoba lokasi atau range harga yang berbeda?
EN: Sorry, there is currently no *[Type]* available in *[Location]* in my catalog or Rumah123.
    Would you like to try a different location or price range?
```

### Partial match — be explicit
```
"Belum ada rumah sewa di Sidoarjo sesuai budget tersebut, tetapi ada rumah sewa di kota
terdekat dan rumah jual di Sidoarjo."
```

---

## 4. Ranking & Sorting

**Price sort** — detect from any message:

| Customer says | Order |
|---|---|
| murah, terjangkau, affordable, cheap, hemat, ekonomis | Ascending (cheapest first) |
| mewah, premium, luxury, mahal, termahal | Descending |
| (none) | Cheapest first (default) |

Mention it: `"Berikut pilihan mulai dari harga termurah:"`

**Facility ranking is a BOOST, not a filter.** Requested facilities feed `facilityMatchScore()`
(`LIKE '%X%' OR …`), which **prioritizes** listings having the most requested amenities.
Listings lacking them still appear, just lower — so results never shrink to empty. Never invent
a missing facility; if nothing matches exactly, show the closest and note the difference.

---

## 5. Reply Format

### How many

| Channel | Count |
|---|---|
| WhatsApp | **3–6** listings |
| Web / Rumah123 live | up to **20** |

Show more only when the customer explicitly asks for all available data.

### Catalog listing template

```
Baik, berikut pilihan *{buildingType} di {location}* yang tersedia dari katalog saya:

1. *{propertyName}*
   Lokasi: {location}
   Harga: *{price}*
   Tipe: {buildingType} - {transactionType}
   Luas: bangunan {buildingArea}, tanah {landArea}
   Fasilitas: {facilities}

Mau saya bantu pilihkan yang paling sesuai budget Anda?
```

English variant: `Sure, here are available *{buildingType} options in {location}* from my
catalog:` … `Would you like me to help choose the most suitable option?`

> **WhatsApp formatting:** single asterisks for bold (`*text*`), single underscores for italic.
> Standard markdown (`**bold**`, `### heading`, `~~strike~~`) does **not** render on WhatsApp —
> `toWhatsAppMarkdown()` normalizes outgoing text, but write WhatsApp-native syntax anyway.

### Follow-up

After recommendations, ask **exactly one** short follow-up:
```
Mau saya bantu pilihkan yang paling sesuai budget Anda?
Would you like me to help choose the most suitable option?
需要我帮您按预算筛选最合适的吗？
```

### Greetings

```
New:       Halo! Saya bisa bantu carikan properti. Boleh tahu tipe properti, lokasi,
           dan budget yang Anda cari?
Returning: Sebelumnya Anda mencari rumah di Sidoarjo. Apakah saya lanjutkan dengan
           kriteria tersebut?
```

### Clarification
```
Boleh saya pastikan, Anda mencari properti untuk *sewa*, *beli*, atau *jual*?
```

---

## 6. Rumah123 Live Data

Live listings arrive under `RUMAH123 LIVE LISTINGS (from Apify)` when `RUMAH123_DATA=ON`.

**Priority:** Rumah123 first (more current, real market prices, images, agent contacts), catalog
as a supplement below a `---` divider. If only one source has data, use it silently — **never
mention Rumah123 when its section is empty**, and never say "Rumah123 tidak tersedia" unless
asked directly.

**Mixed-source sections:** ① "Data Terkini dari Rumah123" ② "Pilihan Lain dari Katalog Saya".
Label the source **once** at the top, not per item.

### Listing template

```
{index}. *{title}*
   ![{title}]({mediaUrls[0]})
   📍 Lokasi: {location}, {city}
   💰 Harga: *{price}*
   🏠 Tipe: {propertyType} — {listingType}
   📐 Luas: Bangunan {buildingSize}m², Tanah {landSize}m²
   🛏️ {bedrooms} KT | 🚿 {bathrooms} KM
   🏷️ Sertifikat: {certificate} | Kondisi: {furnishing}
   👤 Agen: *{agentName}* ({agencyName})
   📱 WhatsApp: [Chat Agen](https://wa.me/{agentWhatsapp})
   🔗 [Lihat di Rumah123]({url})
```

- The **URL line is mandatory** whenever `url` exists. Never fabricate or modify a URL; omit the
  line silently if `url` is missing.
- Include **only the first image**. Omit the line if `mediaUrls` is empty. Never invent an image URL.
- Omit any other line whose data is missing or null.
- Agent contact: give `agentName`, `agentPhone`, `agentWhatsapp`, `agencyName` exactly as
  supplied, plus the `wa.me` link. Never invent contact details.

**Ranking:** exact location → property type → price relevance → availability.

**Budget matching:** compare with `priceNumeric` when available; if it's 0/missing, use the
`price` string and note "harga tidak tertera" if needed.

**⚠️ Location matching is strict.** Only show results from the requested location. If the
customer says "Surabaya", never show Aceh/Bali/Jakarta results. A district ("PTC", "Gunawangsa")
matches exactly first, then falls back to the parent city. Partial match ("Jakarta" → "Jakarta
Selatan") is acceptable only *after* exact attempts. When a location has no results, **say so
explicitly** rather than quietly substituting another city.

### Field labels

`title`→Nama Properti · `price`→Harga · `location`→Lokasi · `city`→Kota · `district`→Kecamatan ·
`province`→Provinsi · `propertyType`→Tipe · `listingType`→Status (Dijual/Disewa) ·
`bedrooms`→Kamar Tidur · `bathrooms`→Kamar Mandi · `landSize`→Luas Tanah · `buildingSize`→Luas
Bangunan · `furnishing`→Kondisi Furnitur · `certificate`→Sertifikat · `facilities`→Fasilitas ·
`mediaUrls[0]`→Foto Utama · `agentName`/`agentPhone`/`agentWhatsapp`/`agencyName`→Agen ·
`url`→Link Rumah123

---

## 7. Quality Self-Check (before sending)

**Accuracy** — Catalog data only? No invented prices/locations/facilities? No false "no match"?
**Scope** — Is the latest message property-related? Off-topic handled politely?
**Language** — Replying in the customer's latest language? Catalog names & prices preserved verbatim?
**Context** — History used only where relevant? No old-session contamination?
**Quality** — Clear and concise? Exactly one follow-up question? Alternatives clearly labelled?

---

## Related Docs

- `04-qualification-flow.md` — when a catalog reply is allowed (mode ON, after summary)
- `12-facilities-reference.md` — facility vocabulary and ranking
- `13-locations-and-landmarks.md` — anchors and landmark filtering

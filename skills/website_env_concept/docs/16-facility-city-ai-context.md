# 16. Facility & City AI Context Injection

## Overview

Backend loads **facility names** and **city names** from the database and injects
them as context blocks into the AI system prompt on every message. This teaches
the AI what facilities and cities the platform actually supports — without hardcoding.

---

## Architecture

```
Customer Message (WhatsApp / Website)
     ↓
whatsappAIService.generateWhatsAppAIReply()
     ↓
aiContextService.loadAIContextBlocks(userMessage, history)
     ├── getCityNames()     → DB query cities WHERE status=1   [cached 5 min]
     └── getFacilityNames() → DB query facilities WHERE status=1 [cached 5 min]
     ↓
Detect city mentions in message (detectCitiesInText)
Detect if message is location-related (isLocationTopic)
     ↓
buildFacilityContextBlock()  → always injected
buildCityContextBlock()      → only injected when location topic detected
     ↓
Passed as extraContext = { facilityContext, cityContext }
     ↓
generateWhatsappReplyWithProviderFallback(session, history, msg, propertyCtx, extraContext)
     ├── generateChatGPTWhatsappReply(..., extraContext)
     │       └── buildWhatsappReplyPrompt(..., 'chatgpt', extraContext)
     └── generateClaudeWhatsappReply(..., extraContext)
             └── buildWhatsappReplyPrompt(..., 'claude', extraContext)
```

---

## Service: `aiContextService.js`

Located at: `backend/services/aiContextService.js`

### Functions

| Function | Description |
|---|---|
| `getCityNames()` | Load active city names from DB (cached 5 min) |
| `getFacilityNames()` | Load active facility names from DB (cached 5 min) |
| `detectCitiesInText(text, cityNames)` | Find which DB cities are mentioned in text |
| `detectFacilitiesInText(text, facilityNames)` | Find which DB facilities are mentioned in text |
| `isLocationTopic(text)` | Returns true if text contains location keywords |
| `buildFacilityContextBlock()` | Build prompt block: facility list reference |
| `buildCityContextBlock(msg, history)` | Build prompt block: city list + detected cities |
| `loadAIContextBlocks(msg, history)` | Parallel load of both blocks (main entry point) |
| `invalidateCache()` | Force-refresh both caches (call after admin data update) |

### Cache Strategy

- TTL: 5 minutes
- In-process only (no Redis)
- Both datasets are loaded fresh on first call or after TTL expires
- `invalidateCache()` can be called from City/Facility master controllers after save

---

## Facility Skill Context

Injected into **every WhatsApp message** (not just location messages).

**Purpose:**
- AI recognises facility names from customer chat (e.g. "ada kolam renang?", "perlu gym", "parkir motor")
- AI uses consistent names when recommending properties with amenities
- AI can tell customers when a facility they requested is not in the catalog

**Sample injected block:**
```
## FACILITY REFERENCE (from database — 271 facilities)

Registered facilities (use these exact names when quoting):
AC | BALCONY | BATHROOM | BBQ AREA | BILLIARD ROOM | CCTV | ...

When a customer mentions facilities, acknowledge specifically which ones match.
```

---

## City Context Block

Injected **only when** the user message contains location keywords:
```
lokasi, kota, wilayah, area, daerah, di mana, dekat, sekitar,
location, city, where, near, close to, around, neighborhood
```

**Purpose:**
- AI validates that the city customer mentions is in the platform's coverage
- If customer mentions unknown city → AI asks for nearest known city
- AI can list covered cities if asked

**Sample injected block:**
```
## CITY REFERENCE (from database — 200+ cities in Indonesia)

Detected city mentions in conversation: SURABAYA, SIDOARJO

All city names registered in the platform:
SURABAYA | MALANG | SIDOARJO | GRESIK | MOJOKERTO | ...

City matching rules:
1. If matches → treat as valid, proceed.
2. If no match → ask customer to clarify using nearest listed city.
3. If customer asks "kota apa saja?" → share summary of major cities.
4. Never assume a city name from outside the list without confirming.
```

---

## City Matching Rules (AI Behavior)

| Scenario | AI Behavior |
|---|---|
| Customer says "di Surabaya" → SURABAYA in DB | Proceed normally |
| Customer says "di Sidoarjo" → SIDOARJO in DB | Proceed normally |
| Customer says "di Cipete" (not in DB as standalone) | Ask: "Apakah maksud Anda Jakarta Selatan?" |
| Customer asks "kota apa saja?" | List major cities from injected block |
| Customer says unknown foreign city | Ask for nearest Indonesian city |

---

## Env Variables (No new ones needed)

This feature uses the same DB connection as the rest of the backend.
No additional `.env` variables required.

---

## Cache Invalidation

After saving a new City or Facility via the admin master page, call:
```javascript
const { invalidateCache } = require('../services/aiContextService');
invalidateCache(); // Forces refresh on next message
```

Recommended: call this in `cityMasterController.js` and `facilityMasterController.js`
after successful create/update/delete operations.

---

## Files Changed (June 29, 2026)

| File | Change |
|---|---|
| `backend/services/aiContextService.js` | **NEW** — DB loader + context block builder |
| `backend/services/whatsappAIService.js` | Added Step 3.2: load AI context blocks, pass as extraContext |
| `backend/services/aiProviderService.js` | Updated `generateWhatsappReplyWithProviderFallback` to accept extraContext |
| `backend/services/claudeService.js` | Updated `generateClaudeWhatsappReply` to accept + pass extraContext |
| `backend/services/openaiService.js` | Updated `generateChatGPTWhatsappReply` to accept + pass extraContext |
| `backend/services/aiPromptBuilderService.js` | Updated `buildWhatsappReplyPrompt` signature + injects facilityContext + cityContext |
| `backend/database/facilities_final_clean.sql` | **NEW** — 271 clean facilities (only true operational facilities) |

---

## Facility Keyword Detection — DB-Driven (July 15, 2026)

Separate from `aiContextService` (which injects the facility *list* into the LLM
prompt), the **qualification extractor** `detectFacilities()` in
`propertyRecommendationService.js` recognises which facilities a customer *asked
for* (→ summary `✓ Fasilitas:` line). Its synonym vocabulary is now **DB-driven**.

### `facilities.keywords` (JSON column)
- Migration: `database/migrations/2026-07-15-facility-keywords.sql` (ALTER TABLE add `keywords` JSON).
- Model: `models/Facility.js` gained the `keywords` field.
- Seed: `node backend/scripts/seed-facility-keywords.js` migrates the curated
  Indonesian synonyms from the in-code `_FACILITY_MAP` into DB `keywords` (idempotent
  union; `--dry` previews). 31 curated facilities seeded; the other ~246 fall back to
  their own name as the match token.

### Runtime (`initFacilityCache()` → `detectFacilities()`)
- On startup, `initFacilityCache()` loads every active facility's `{name, keywords}`
  and expands them into match tokens (`keywords` if present, else the name). Tokens
  <3 chars are dropped (AC/TV covered by the curated map).
- `detectFacilities()` matches the curated `_FACILITY_MAP` FIRST (stable display
  labels like "Kolam renang"), then fills gaps with DB tokens (long-tail: PILATES
  STATION, TREADMILL, GYM EQUIPMENT, …). Display label for DB-only hits = sentence-case
  of the name ("Pilates station").
- **No more first-word guessing.** The old heuristic (match multi-word names by their
  first ≥6-char word) was removed — it false-matched common words ("tempat" from
  "tempat tidur", "equipment" from "equipment storage"). Partial/short forms must now
  be explicit `keywords` entries instead.
- `_FACILITY_MAP` is kept as the curated label layer **and** the fallback when the DB
  is unreachable (`initFacilityCache()` fails → detection still works).

**Admin workflow:** add a facility in Master Fasilitas + fill its `keywords` (e.g.
`["pilates","reformer","pilates station"]`) → chatbot recognises it with **no code
change**. Call `invalidateCache()` / restart to refresh the in-process token cache.

---

## Budget Tier → Concrete Range (July 15, 2026)

The reasonable-price tier table (`terjangkau`/`menengah`/`eksklusif` per
type+transaction) is now the **single source of truth in
`propertyRecommendationService.js`** (`_BUDGET_TIERS` + `getBudgetTiers()` +
`resolveBudgetTierRange()`). `chatbotPrivateController.getBudgetTiers()` delegates to
it (no duplicated table).

Why it moved: when a customer answers a *category* ("terjangkau") instead of a number,
`detectBudget` returns `min/max = null`. Previously the table lived only in the
controller (summary display), so the catalog filter saw a null budget and **passed
every price through** — "sewa apartemen terjangkau" listed 3.9jt/hari and 8.4jt/tahun
side by side. Now `extractPropertyFilters()` resolves the tier to a concrete
`{min,max,period}` (using building type + transaction + period), so
`filterProperties → budgetMatches` restricts the catalog to that band.

---

## Summary → Recommendation Query — Correctness Rules (reference)

The live recommendation path does **in-memory Sequelize filtering** (`getSourceProperties`
→ `filterProperties` → `budgetMatches`), NOT generated SQL. But the summary fields map
1:1 to an equivalent SQL, and hand-written / LLM-drafted versions keep repeating the
same bugs. Rules when translating a summary into a recommendation query:

| Summary field | Correct filter | Common BUG to avoid |
|---|---|---|
| Tipe: *Apartemen* | `building_type = 'apartment'` | **Indonesian enum** `= 'apartemen'` → 0 rows. DB stores English enum (house/apartment/hotel/villa/boarding_house/shophouse/office/warehouse/store/condo/mansion/others). `detectBuildingType()` already returns the English canonical. |
| Rencana: *Sewa* | `transaction_type = 'Rent'` | — |
| Budget: *Terjangkau …/bln* | `price BETWEEN <tier.min> AND <tier.max>` from `getBudgetTiers(type,tx,period)` **for the right type**, + match `price_type` to the tier's **`period`** field (see mapping table below — NOT always `'Monthly'`) | ① Using the **wrong type's tier** — e.g. `200000–800000` is hotel/night terjangkau, not apartment/rent (`2000000–5000000`). ② Hardcoding `price_type='Monthly'` — only correct for apartment/condo/office/store (period `month`). Hotel/villa/kost booking is period `night`, house/shophouse/warehouse/land is period `year`. |
| Fasilitas: *Gym, …, Pilates* | **`LIKE '%TOKEN%' OR …`** — pecah tiap label summary menjadi kata + frasa penuh, masing-masing sebuah `fac.name LIKE '%…%'`, digabung `OR`. Contoh: *Kolam renang* → `'%KOLAM%' OR '%RENANG%' OR '%KOLAM RENANG%'`; *Pilates* → `'%PILATES%' OR '%STATION%' OR '%PILATES STATION%'`. | **JANGAN pakai `IN (...)`** — label summary Indonesia/pendek ("Kolam renang", "Pilates") tak sama dengan nama kanonik DB (`KOLAM RENANG`, `PILATES STATION`); `LIKE` menjembataninya tanpa perlu tahu nama persis, `IN` tidak. |
| Patokan lokasi | **`LIKE '%TOKEN%' OR …`** — sama seperti fasilitas: `loc.name LIKE '%SCBD%' OR '%pasar%' OR '%mall%' OR '%resto%' OR '%cafe%'`. | Sama — pakai `OR` + `LIKE`, bukan `IN`. |
| Furnitur: *Semi furnished* | `furnished_status = 'Semi Furnished'` (optional/soft) | DB values are Title Case **with a space** — `'Full Furnished'`, `'Semi Furnished'`, `'Unfurnished'` — confirmed via `SELECT DISTINCT furnished_status`. Do not invent a hyphenated form (`'Semi-furnished'`). |

### `period` → `price_type` mapping (mirrors `_periodFromPriceType()` exactly)

`getBudgetTiers()`/`resolveBudgetTierRange()` return a `period` string per type+transaction
(see the `_BUDGET_TIERS` table). The SQL `price_type` filter MUST match that period using
this exact mapping — it is the reverse of `_periodFromPriceType()` in
`propertyRecommendationService.js`, so the SQL and the live JS filter never diverge:

| tier `period` | Applies to (rent) | SQL `price_type` filter | Note |
|---|---|---|---|
| `month` | apartment, condo, office, store, boarding_house (kamar) | `price_type = 'Monthly'` | |
| `night` | hotel (booking, default), villa (booking, default), kondotel | `price_type IN ('Night','Daily')` | **Both** values map to period `night` in `_periodFromPriceType()` — filtering only `'Night'` silently excludes `'Daily'` listings (or vice versa). |
| `year` | house, shophouse, warehouse, land, boarding_house (kontrak bangunan), hotel/villa long-stay | `price_type = 'Yearly'` | |
| `''` (sale, absolute price) | any `transaction_type = 'Sale'` | *(no `price_type` filter needed)* | DB uses `Cash`/`Negotiable`/`Others` for sale listings — these carry no periodic unit, so `price` is already comparable as-is. |

`Weekly` (period `week`) has no tier entry today (no building type books by the week) but
follows the same rule if one is ever added: `price_type = 'Weekly'`.

**The GROUP_CONCAT trap:** putting the `LIKE '%…%' OR …` block directly in the outer
`WHERE` (against the `LEFT JOIN`ed `fac`/`loc`) silently turns the join into an
`INNER JOIN` **and** truncates the `GROUP_CONCAT(fac.name)` aggregate to only the
*matched* rows — proven: property `JRSIKZJ2426` returned `facilities = "AC, WASHING
MACHINE"` while its real set is 8 (`AC, ATM CENTER, LAUNDRY SERVICE, MEETING ROOM,
SECURITY, SWIMMING POOL, WASHING MACHINE, WI-FI`) — hiding **SWIMMING POOL**, the very
"Kolam renang" the customer asked for. Fix **without changing the `LIKE '%…%' OR`
matching**: move that exact OR block into an **`EXISTS` subquery** (keep the `LIKE OR`
inside it), so the outer `GROUP_CONCAT` still lists the full facility/location set:

```sql
-- HARD filter (property must have ≥1 wanted facility OR sit near ≥1 wanted landmark):
AND ( EXISTS (SELECT 1 FROM property_facilities pf JOIN facilities f ON f.facility_id=pf.facility_id
              WHERE pf.property_id=prop.property_id
                AND (f.name LIKE '%GYM%' OR f.name LIKE '%YOGA%' OR f.name LIKE '%KOLAM%'
                  OR f.name LIKE '%RENANG%' OR f.name LIKE '%AC%'
                  OR f.name LIKE '%PILATES%' OR f.name LIKE '%STATION%'))
   OR EXISTS (SELECT 1 FROM property_locations pl JOIN locations l ON l.location_id=pl.location_id
              WHERE pl.property_id=prop.property_id
                AND (l.name LIKE '%SCBD%' OR l.name LIKE '%pasar%' OR l.name LIKE '%mall%'
                  OR l.name LIKE '%resto%' OR l.name LIKE '%cafe%')) )
```

For **soft** ranking (never drops rows) put the same two `EXISTS` expressions in
`ORDER BY (…EXISTS… + …EXISTS…) DESC, prop.price, prop.title` instead of `WHERE`.

**Hard vs soft:** in the live JS path, `building_type` + `transaction_type` +
`location` + `budget` are HARD filters; facilities & landmark (patokan) are treated as
**soft** (landmark = ranking boost, facilities = LLM ranking via the context block),
so a thin catalog never returns empty. Mirror that when writing SQL: keep the EXISTS
facility/patokan checks in `ORDER BY … DESC` rather than `WHERE` unless an empty result
is acceptable.

### Full reference query (soft ranking, `building_type` fixed to `'apartment'`)

Verified against the DB (07/2026): returns full, untruncated `facilities`/`locations`
per row, uses `LIKE '%TOKEN%' OR` (not `IN`) for facility/landmark matching, and
matches `price_type` to the budget's `period` (via the mapping table above) so listings
in the wrong billing period (e.g. 3.9jt/**hari**) don't leak into a "2jt–5jt/**bln**"
result. This example is for **apartment** (period `month` → `price_type='Monthly'`);
for hotel/villa/kondotel (period `night`) use `price_type IN ('Night','Daily')` instead,
and for house/shophouse/warehouse/land (period `year`) use `price_type='Yearly'`.

```sql
SELECT
    prop.property_id, prop.city_id, prop.province_id, prop.country_id, prop.user_id,
    prop.title, prop.description, prop.price, prop.price_type, prop.address, prop.area,
    prop.district, prop.postal_code, prop.furnished_status, prop.bed_rooms, prop.bath_rooms,
    prop.electricity_capacity, prop.building_area, prop.land_area, prop.floor_location, prop.floor_quantity,
    CASE prop.kpr_status WHEN 'Y' THEN 'Yes' WHEN 'N' THEN 'No' ELSE '' END AS kpr_status,
    prop.building_type, prop.transaction_type, prop.status,
    usr.name AS Agent_Name, city.name AS City_Name, prov.name AS Province_Name, cntry.name AS Country_Name,
    GROUP_CONCAT(DISTINCT fac.name ORDER BY fac.name SEPARATOR ', ') AS facilities,
    GROUP_CONCAT(DISTINCT loc.name ORDER BY loc.name SEPARATOR ', ') AS locations
FROM properties prop
INNER JOIN users     usr   ON usr.user_id      = prop.user_id
INNER JOIN cities    city  ON city.city_id     = prop.city_id AND city.province_id = prop.province_id AND city.country_id = prop.country_id
INNER JOIN provinces prov  ON prov.province_id = city.province_id AND prov.country_id = city.country_id
INNER JOIN countries cntry ON cntry.country_id = prov.country_id
LEFT  JOIN property_facilities prop_fac ON prop_fac.property_id = prop.property_id
LEFT  JOIN facilities          fac      ON fac.facility_id      = prop_fac.facility_id
LEFT  JOIN property_locations  prop_loc ON prop_loc.property_id = prop.property_id
LEFT  JOIN locations           loc      ON loc.location_id      = prop_loc.location_id
WHERE prop.status = 1
  AND prop.user_id          = 'LFGKT49002'
  AND prop.building_type    = 'apartment'         -- FIX: enum DB Inggris, bukan 'apartemen'
  AND prop.transaction_type = 'Rent'
  AND prop.price_type       = 'Monthly'           -- FIX: samakan periode budget /bln
  AND prop.price BETWEEN 2000000 AND 5000000
  AND city.name LIKE '%Jakarta%'
GROUP BY prop.property_id
ORDER BY
  ( EXISTS (SELECT 1 FROM property_facilities pf JOIN facilities f ON f.facility_id = pf.facility_id
            WHERE pf.property_id = prop.property_id
              AND (f.name LIKE '%GYM%' OR f.name LIKE '%YOGA%' OR f.name LIKE '%KOLAM%'
                OR f.name LIKE '%RENANG%' OR f.name LIKE '%KOLAM RENANG%' OR f.name LIKE '%AC%'
                OR f.name LIKE '%PILATES%' OR f.name LIKE '%STATION%' OR f.name LIKE '%PILATES STATION%'))
  + EXISTS (SELECT 1 FROM property_locations pl JOIN locations l ON l.location_id = pl.location_id
            WHERE pl.property_id = prop.property_id
              AND (l.name LIKE '%SCBD%' OR l.name LIKE '%pasar%' OR l.name LIKE '%mall%'
                OR l.name LIKE '%resto%' OR l.name LIKE '%cafe%')) ) DESC,
  prop.price, prop.title;
```

Swap `ORDER BY (…) DESC, …` for `AND (…EXISTS… OR …EXISTS…)` in `WHERE` if
facilities/patokan should be a hard filter instead of a ranking boost.

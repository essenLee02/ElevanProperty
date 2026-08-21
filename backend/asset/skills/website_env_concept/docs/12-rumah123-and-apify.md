# 12. Rumah123 & Apify Property Data

**Purpose:** Provide live property listings from Rumah123.com as context for the AI chatbot.

---

## Environment Variables

```env
APIFY_API_TOKEN=        # lihat backend/.env — jangan commit token ini ke git
RUMAH123_DATA=ON                          # ON = live Apify | OFF = static JSON only
RUMAH123_WARMUP_LOCATIONS=Jakarta Selatan,Surabaya,Bandung,Bali
SKILL_MAX_PROJECT_CHARACTERS=36000        # Max chars from property context in AI prompt
SKILL_MAX_WEBSITE_CHARACTERS=12000
SKILL_MAX_RESPONSE_CHARACTERS=22000
```

> ⚠️ Apify has usage quota. If quota exceeded → **auto-falls back** to static JSON silently.

---

## Data Sources (Priority Order) — backend-driven

```
[1] DATABASE (sumber utama)  → model Property + PropertyImage + PropertyFacility +
                               PropertyLocation (JOIN). Salinan dari extended_v3.
                               getSourceProperties() = DB-first (getDbProperties).
[2] JSON FALLBACK            → backend/asset/json_data/indonesia_property_extended_v3.json
                               (9120 record) — dipakai HANYA bila DB kosong.
[3] RUMAH123_DATA=ON         → tambahan live Apify (rumah123.com) per pencarian
                               ↓ quota exceeded/error → diam-diam dilewati
```

> **Frontend TIDAK lagi memuat JSON.** Semua data properti berasal dari backend
> via API. `PropertyRecommendationService` memuat data secara **lazy** (bukan saat
> server start) — trigger: halaman `/about`, chatbot setelah "Start Chat",
> terminal message saat pemberian summary.

---

## Service: `rumah123ContextService.js`

`backend/services/rumah123ContextService.js`

### Key Methods

```javascript
// Get live listings by filter (used in chatbot)
getRumah123Listings({ location, propertyType, listingType })
// location: e.g., "Surabaya"
// propertyType: "house" | "apartment" | "land" | etc.
// listingType: "rent" | "sell"

// Cache warmup (called on server start)
warmupCache(locations)
// Pre-fetches data for popular locations to reduce first-request latency
```

### Cache Warmup on Server Start

When the backend starts, it pre-warms cache for locations defined in `RUMAH123_WARMUP_LOCATIONS`:
```env
RUMAH123_WARMUP_LOCATIONS=Jakarta Selatan,Surabaya,Bandung,Bali
```

---

## API Endpoints

```
GET /api/rumah123/search?location=Surabaya&listingType=rent&propertyType=house
GET /api/rumah123/cache-status
```

### Search Response (example)

```json
{
  "success": true,
  "listings": [
    {
      "title": "Rumah 3KT di Surabaya Barat",
      "price": "Rp 2.500.000/bulan",
      "location": "Surabaya Barat, Jawa Timur",
      "bedrooms": 3,
      "bathrooms": 2,
      "buildingArea": 120,
      "url": "https://rumah123.com/..."
    }
  ],
  "source": "apify",    // or "static_json" if fallback
  "count": 8
}
```

---

## Chatbot Integration

The chatbot uses backend catalog data to give property-aware responses:

```
User: "Cari rumah sewa di Surabaya"
     ↓
FloatingChatbot HANYA kirim { name, phone, location, message } — TIDAK kirim JSON
     ↓
Backend (chatbotController.sendMessage):
  1. buildRecommendationContextForLLM(message, history)  ← DB-first catalog
  2. getRumah123Listings({ location:"Surabaya", listingType:"rent" })  ← live (opsional)
  3. Combine into AI prompt context
  4. Primary AI (deepseek/qwen/claude/chatgpt) → Private Agent
```

### Dynamic Response Rules (tanpa hardcode kota)

`buildRecommendationContextForLLM` membangun **STRICT RESPONSE RULES yang dinamis**
dari permintaan nyata customer (`buildDynamicResponseRules`) — tidak ada lagi contoh
hardcode Surabaya→Malang. Aturan mengacu ke tipe + transaksi + kota aktual. Alternatif
memprioritaskan **kota yang sama** (langkah type+location) sebelum melebar ke kota lain,
dan wajib menandai jelas bila terpaksa keluar kota.

---

## Static JSON Fallback (extended_v3)

**Sumber contoh data (fallback saja):**
```
backend/asset/json_data/indonesia_property_extended_v3.json   ← 9120 record (aktif)
backend/asset/json_data/indonesia_property_36_provinces_flat.json          (lama)
backend/asset/json_data/indonesia_property_36_provinces_associative.json   (lama)
```

- `extended_v3`: 38 provinsi, 9120 record, 12 tipe bangunan (+store/condo/mansion),
  `specifications`, `price_type`, `furnished_status`, hierarki lokasi lengkap.
- **Database** adalah salinan `extended_v3` (properties 8831, images 8831,
  facilities 56891, locations 23022, cities 649, provinces 52).
- `loadJsonProperties()` di `propertyRecommendationService.js` membaca file ini secara
  **lazy** (bukan saat startup) dan mengembalikan bentuk ternormalisasi.
- Frontend **tidak** lagi mem-fetch `/json_data/...`. Proxy `/json_data` di
  `vite.config.js` sudah dihapus; halaman About memanggil `GET /api/about`.

---

## WhatsApp Context (Juni 2026)

Semua 3 WA controller (Fonnte, Kirimi, TimelinesAI) menggunakan data properti yang sama:

```javascript
// backend/utils/whatsappPropertyContext.js
const ctx = await getWhatsappPropertyContext(customerMessage);
// ctx.source = 'rumah123' | 'flat_json'
// ctx.contextText = teks yang diinjeksi ke AI prompt
```

Flow:
```
getWhatsappPropertyContext("cari rumah di surabaya")
    ↓ extract: location="surabaya", type="house", tx="sale"
    ↓
[1] getRumah123Listings({ location: "surabaya", propertyType: "house" })
    → formatRumah123ContextForLLM(listings)  ← max 20 listings
    ↓ jika gagal/kosong:
[2] searchFlatJson("surabaya", "house", "sale")
    → formatFlatJsonForLLM(properties)  ← max 8 properties
```

Lihat detail di `13-whatsapp-terminal-multiagent.md`.

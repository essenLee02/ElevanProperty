# 11. Rumah123 & Apify Property Data

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

## Data Sources (Priority Order)

```
RUMAH123_DATA=ON  → Live data from Apify (scraped from rumah123.com per search)
                        ↓ on quota exceeded or error
RUMAH123_DATA=OFF → Static JSON: frontend/public/json_data/
                    indonesia_property_36_provinces_flat.json
                    (36 provinces, flat array, bundled with app)
```

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

The chatbot uses Rumah123 data to give property-aware responses:

```
User: "Cari rumah sewa di Surabaya"
     ↓
FloatingChatbot sends propertyContext (36 provinces JSON) on first message
     ↓
Backend:
  1. buildRecommendationContextForLLM(message, history)  ← filter JSON catalog
  2. getRumah123Listings({ location: "Surabaya", listingType: "rent" })  ← live data
  3. Combine both into AI prompt context
  4. ChatGPT generates response with real listings
```

---

## Static JSON Fallback

File: `frontend/public/json_data/indonesia_property_36_provinces_flat.json`

- Coverage: 36 provinces, flat array format
- Loaded by `FloatingChatbot.vue` on first message and sent as `propertyContext`
- Bundled with the frontend app (no API call needed)
- Used when Apify quota is exceeded or `RUMAH123_DATA=OFF`

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

# Summary Mode Implementation — RESPOND_CATALOG_RUN

**Version:** 1.0  
**Date:** 2026-06-05  
**Environment Variable:** `RESPOND_CATALOG_RUN`  

---

## What Is Summary Mode?

When `RESPOND_CATALOG_RUN=ON`, the chatbot **skips direct property listings** and instead shows a **professional summary** of what the customer has told it, followed by a message that the agent will follow up with detailed recommendations.

**Why?**
- ✅ Quality control — review customer request before sending results
- ✅ Manual agent coordination — agents can personalize follow-up
- ✅ Reduce bot fatigue — customers feel heard, not auto-processed
- ✅ Capture decision signals — agents can prioritize leads differently

---

## Summary Mode Behavior

### Trigger
Summary mode activates after:
1. All 4 core filters collected (transaction type, building type, location, budget)
2. **AND** `RESPOND_CATALOG_RUN=ON` in environment

### What Happens

Instead of showing catalog → bot shows:

```
Baik, saya catat ya! 📝

✓ Rencana: *[TRANSACTION_TYPE]*
✓ Tipe: *[BUILDING_TYPE]*
✓ Lokasi: *[LOCATION]*
✓ Budget: *[BUDGET]*

Data-data ini sudah saya ringkas. Sebentar saya koordinasikan dengan [AGENT_NAME] 
untuk cari properti yang paling sesuai dengan kriteria Anda.

Untuk hasil terbaik, [AGENT_NAME] akan menghubungi Anda kembali dengan 
rekomendasi lengkap & detail properti yang cocok. 🏠

Terima kasih atas informasinya! 🙏
```

### What Does NOT Happen in Summary Mode

❌ **No Rumah123 fetch** (skipped for performance)  
❌ **No catalog listing** (no property details shown)  
❌ **No alternatives** (no fallback suggestions)  
❌ **No Q8 mandatory** (move-in date asked by agent, not bot)  
❌ **No Q10-Q12** (lease duration, furnishing, apartment prefs asked by agent)  

---

## Code Implementation

### Location: `chatbotPrivateController.js`

#### Lines 1396-1459: Summary Mode Logic

```javascript
// ── CHECK: RESPOND_CATALOG_RUN mode ──────────────────────────────────────
const respondCatalogRun = String(process.env.RESPOND_CATALOG_RUN || 'OFF').toUpperCase() === 'ON';

// ... [fetch context] ...

let reply;
let responseMode = 'catalog'; // default

if (respondCatalogRun) {
  // ─ MODE: SUMMARY & REVIEW ─────────────────────────────────────────────
  responseMode = 'summary';

  const summaryParts = [];

  // Transaction type label
  const txWord = filters.transactionType === 'rent'
    ? (lang === 'id' ? 'sewa' : 'rent')
    : (lang === 'id' ? 'beli' : 'buy');

  // Building type label
  const typeLabel = filters.buildingType
    ? PropertyFormatter.humanBuildingType(filters.buildingType, lang === 'id')
    : (lang === 'id' ? 'properti' : 'property');

  // Build summary bullets
  if (filters.transactionType) {
    summaryParts.push(lang === 'id'
      ? `✓ Rencana: *${txWord}*`
      : `✓ Plan: *${txWord}*`);
  }
  if (filters.buildingType) {
    summaryParts.push(lang === 'id'
      ? `✓ Tipe: *${typeLabel}*`
      : `✓ Type: *${typeLabel}*`);
  }
  if (filters.location) {
    summaryParts.push(lang === 'id'
      ? `✓ Lokasi: *${filters.location}*`
      : `✓ Location: *${filters.location}*`);
  }
  if (filters.budget) {
    summaryParts.push(lang === 'id'
      ? `✓ Budget: *${filters.budget.text || 'Sesuai'}*`
      : `✓ Budget: *${filters.budget.text || 'Suitable'}*`);
  }

  // Construct full summary text
  const summaryText = lang === 'id'
    ? `Baik, saya catat ya! 📝\n\n${summaryParts.join('\n')}\n\n...`
    : `Got it! 📝\n\n${summaryParts.join('\n')}\n\n...`;

  reply = summaryText;

} else {
  // ─ MODE: FULL CATALOG ─────────────────────────────────────────────────
  // [existing listing logic]
}
```

### Environment Variable

```bash
# File: backend/.env
RESPOND_CATALOG_RUN=ON   # Enable summary mode
RESPOND_CATALOG_RUN=OFF  # Disable (use default catalog listing)
```

**Default:** `OFF` (catalog listing mode active)

---

## Summary Content Structure

### Header
```
Baik, saya catat ya! 📝
```
Friendly acknowledgment with note emoji

### Bullets (Conditional)
Each bullet only shows if that filter was actually collected:

```
✓ Rencana: *[transaction_type]*
✓ Tipe: *[building_type]*
✓ Lokasi: *[location]*
✓ Budget: *[budget_text]*
```

**What's Shown:**
- Transaction type: `sewa` (rent) or `beli` (buy)
- Building type: human-readable via `PropertyFormatter.humanBuildingType()`
  - Examples: `rumah`, `villa`, `apartemen`, `kos`, `ruko`
- Location: exact city/area typed by customer
- Budget: formatted range
  - Examples: `600jt - 1M`, `2M - 3M`, `affordable` (if semantic keyword used)

### Body Text (Bilingual)

**Indonesian:**
```
Data-data ini sudah saya ringkas. Sebentar saya koordinasikan dengan [AGENT_NAME] 
untuk cari properti yang paling sesuai dengan kriteria Anda.

Untuk hasil terbaik, [AGENT_NAME] akan menghubungi Anda kembali dengan 
rekomendasi lengkap & detail properti yang cocok. 🏠
```

**English:**
```
I've noted all this down. Let me coordinate with [AGENT_NAME] 
to find properties that best match your criteria.

For the best results, [AGENT_NAME] will reach out with detailed recommendations. 🏠
```

### Closing
```
Terima kasih atas informasinya! 🙏  (ID)
Thank you for sharing! 🙏            (EN)
```

---

## Agent Name Insertion

The summary includes the **agent's name** dynamically:

```javascript
`...saya koordinasikan dengan ${agentName}...`
```

**Source:** `agentName` parameter passed to `generateResponseForTerminalMassege()`

**Example:**
```
saya koordinasikan dengan LEO FELIX untuk cari properti...
```

---

## Bilingual Support

Summary mode respects the detected language from `LanguageDetector.detect(userMessage)`:

```javascript
const lang = LanguageDetector.detect(userMessage);
```

**ID Text:** Formal, conversational Indonesian  
**EN Text:** Friendly, professional English  

Both versions maintain the same structure and meaning.

---

## Response Metadata

When summary mode is active, the response wrapper includes:

```javascript
return this.#wrap(reply, {
  skillInfo,
  filters: context.filters,
  responseMode: 'summary',      // ← Mode identifier
  respondCatalogRun: true,      // ← Config flag
  exactMatches: 0,              // ← 0 (no catalog shown)
  rumah123Listings: 0,          // ← 0 (not fetched)
  alternatives: 0,              // ← 0 (not shown)
  fallbackReason: '...',
  agentName: 'LEO FELIX',
});
```

**Key Difference from Catalog Mode:**
- `responseMode: 'summary'` (vs `'catalog'`)
- `exactMatches`, `rumah123Listings`, `alternatives` all = 0
- No `budgetExpanded` metadata (context not built)

---

## Filter Extraction in Summary Mode

Even though catalog is not shown, **filters are still extracted fully**:

```javascript
const filters = recommendationContext?.filters
  || extractPropertyFilters(userMessage, history);
```

**Why?**
- Metadata returned to caller (for analytics, logging, CRM sync)
- Filters available if agent wants to run search independently
- Creates record of what customer requested

---

## Switching Between Modes

### Toggle: Edit `.env`

```bash
# To enable summary mode
RESPOND_CATALOG_RUN=ON

# To go back to catalog listing
RESPOND_CATALOG_RUN=OFF
```

**Takes effect:** On next API call (no restart needed, env vars read at runtime)

### Effect on Conversation

**When toggling ON (catalog → summary):**
- Customer still gets full Q1-Q7 qualification flow
- Instead of listing → see summary + follow-up message
- Perception: bot is still conversational, just more manual

**When toggling OFF (summary → catalog):**
- Customer gets instant listings
- Full Q1-Q12 flow active
- Perception: bot is fully autonomous

---

## Use Cases

### When to Use Summary Mode (ON)?

✅ **New agent training**  
- Review bot's filter extraction first
- QA before live customer interaction

✅ **Premium/high-value leads**  
- Personal agent follow-up preferred
- Want to capture decision signals manually

✅ **Catalog gaps**  
- Few properties in local catalog
- Better to let agent search Rumah123 directly

✅ **Bot fatigue prevention**  
- Reduce volume of automated responses
- Customers feel "heard" by actual person

✅ **A/B testing**  
- Compare conversion: bot-direct vs agent-follow-up
- Measure response time & customer satisfaction

### When to Use Catalog Mode (OFF)?

✅ **Self-service flow**  
- Customers want instant answers
- Low lead friction priority

✅ **High catalog coverage**  
- Plenty of properties in local database
- Bot can provide immediate value

✅ **24/7 availability**  
- Agent not always available
- Customers expect instant response

✅ **High volume**  
- Manual follow-up not feasible
- Automation required for scale

---

## Testing Summary Mode

### Scenario 1: Basic Summary

```
Customer: "Saya mau beli rumah di Surabaya, budget 600jt-1miliar"

Expected Response:
  Baik, saya catat ya! 📝
  
  ✓ Rencana: *beli*
  ✓ Tipe: *rumah*
  ✓ Lokasi: *Surabaya*
  ✓ Budget: *600jt - 1M*
  
  Data-data ini sudah saya ringkas. Sebentar saya koordinasikan dengan [AGENT_NAME]...
```

### Scenario 2: Incomplete Summary (Missing Budget)

```
Customer: "Cari kos di Bandung"

Expected Response:
  Baik, saya catat ya! 📝
  
  ✓ Tipe: *kos*
  ✓ Lokasi: *Bandung*
  
  [body text]
  
Note: No ✓ Rencana (transaction type missing)
      No ✓ Budget (not provided)
```

### Scenario 3: Bilingual Support

**Indonesian Input:**
```
"Saya cari villa di Bali untuk liburan..."
→ Summary in Indonesian
```

**English Input:**
```
"Looking for apartment in Jakarta..."
→ Summary in English
```

---

## Known Limitations

⚠️ **Summary does not validate completeness**
- If customer says "rumah" but never specifies sewa/beli
- Summary still shows, agent must ask Q1 again

⚠️ **No budget expansion logic in summary**
- If customer says "affordable" but no number
- Summary shows "✓ Budget: *affordable*" (semantic keyword)
- Agent must clarify actual range

⚠️ **No Rumah123 fetch for data**
- Agent must run own search
- Faster response time, but less data in bot response

---

## Performance Impact

### Summary Mode (ON)
- **Skip:** Rumah123 fetch (major time saver)
- **Skip:** Context building for recommendation
- **Skip:** Alternative area fallback logic
- **Result:** ~200-300ms response time

### Catalog Mode (OFF)
- **Fetch:** Rumah123 live data
- **Build:** Full recommendation context
- **Fallback:** Location alternatives, budget expansion
- **Result:** ~2-5s response time (API calls)

**Recommendation:** Use summary mode when agent response time acceptable

---

## Debugging

### Check Current Mode

```bash
# Read .env
grep "RESPOND_CATALOG_RUN" backend/.env

# Output: RESPOND_CATALOG_RUN=ON
```

### Verify in Response

```javascript
// Response includes:
{
  "reply": "Baik, saya catat ya!...",
  "responseMode": "summary",      // ← Confirms mode
  "respondCatalogRun": true,      // ← Confirms env var
  "exactMatches": 0,
  "rumah123Listings": 0,
  "alternatives": 0
}
```

### Force Debug Log

In `chatbotPrivateController.js`, line 1414:
```javascript
console.log('[PrivateAgent/SummaryMode]', { 
  respondCatalogRun, 
  filters, 
  agentName 
});
```

---

## See Also

- [QUALIFICATION_FLOW.md](./QUALIFICATION_FLOW.md) — Full Q1-Q12 details
- [chatbotPrivateController.js](../controllers/chatbotPrivateController.js) — Implementation
- [propertyRecommendationService.js](../services/propertyRecommendationService.js) — Filter extraction

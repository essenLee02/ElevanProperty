# Q1-Q12 Qualification Flow — Elevan Property WhatsApp Bot

**Version:** 2.0  
**Last Updated:** 2026-06-05  
**Status:** Active in chatbotPrivateController.js  

---

## Overview

The qualification flow ensures customers provide 4 critical pieces of information **before** property listings are shown:

1. **Transaction Type** (sewa/beli) — rent or buy
2. **Building Type** (rumah/villa/kost) — what kind of property
3. **Location** (city/district) — where to search
4. **Budget** (price range) — affordability constraint

Once all 4 are captured, the system **switches to listing mode** OR shows a **summary+review** (if `RESPOND_CATALOG_RUN=ON`).

---

## RESPOND_CATALOG_RUN Modes

### Mode ON: Summary + Review Only
```
RESPOND_CATALOG_RUN=ON
```

**Behavior:**
- ✅ Show summary of what was collected
- ✅ Thank customer
- ✅ Inform: "Agent will follow up with detailed recommendations"
- ❌ NO catalog listing displayed
- ✅ Good for: Manual agent follow-up, quality control, reducing bot fatigue

**Output Format:**
```
Baik, saya catat ya! 📝

✓ Rencana: *beli*
✓ Tipe: *rumah*
✓ Lokasi: *Surabaya*
✓ Budget: *600jt - 1M*

Data-data ini sudah saya ringkas. Sebentar saya koordinasikan dengan [Agent Name] 
untuk cari properti yang paling sesuai dengan kriteria Anda.

Untuk hasil terbaik, [Agent Name] akan menghubungi Anda kembali dengan 
rekomendasi lengkap & detail properti yang cocok. 🏠

Terima kasih atas informasinya! 🙏
```

### Mode OFF: Full Catalog Listing
```
RESPOND_CATALOG_RUN=OFF
```

**Behavior:**
- ✅ Fetch Rumah123 live data
- ✅ Show catalog matches (exact location filter)
- ✅ Show alternatives (city/national fallback)
- ✅ Show Q8 mandatory follow-up (move-in date)
- ✅ Good for: Autonomous chatbot, instant responses, customer self-service

---

## Q1-Q12 Qualification Question Sequence

### Q0: Language Detection (Implicit)
**Trigger:** First message  
**Logic:** `LanguageDetector.detect(userMessage)`  
**Output:** `lang = 'id'` or `'en'`

---

### Q1: Transaction Type (if still unclear)
**Trigger:** After message, if `!filters.transactionType`  
**Question:** 
- ID: "Lagi cari untuk sewa atau beli?"
- EN: "Are you looking to rent or buy?"

**SKIP if:** Already extracted from conversation or established in history  
**Captured from:** Keywords: `sewa`, `beli`, `jual`, `rent`, `buy`, `lease`  

---

### Q2: Search History (HIGHEST VALUE QUESTION)
**Trigger:** After location is established  
**Question:**
- ID: "Sudah lihat berapa properti di area itu? Apa yang membuat belum cocok dari yang sudah dilihat?"
- EN: "Have you seen any properties in that area? What didn't work about them?"

**Why Critical:**
- Captures red flags (hadap barat, gang sempit, dll)
- Reveals budget ceiling (customer says "too expensive")
- Shows decision maker signals (family involvement)
- Establishes anchor points (dekat sekolah, kantor)
- Reveals urgency level

**SKIP if:** Explicitly covered in initial message (customer already said "maunya yang dekat sekolah")

---

### Q3: Budget (NEVER Asked Directly)
**Trigger:** If `!filters.budget` after other info established  
**Question Pattern:**
- ID: "Di [area] kami ada yang di kisaran [LOW] dan ada yang [HIGH]. Kira-kira yang mana lebih sesuai?"
- EN: "In [area] we have options around [LOW] and some near [HIGH]. Which range works better for you?"

**Example:**
```
Di Surabaya kami ada yang di kisaran 500jt-800jt dan ada yang di 1M-1.5M. 
Kira-kira yang mana lebih sesuai?
```

**Two Contrasting Options:** Never ask "berapa budget Anda?" — show two anchors, customer picks  
**Semantic Detection:** Also detects: terjangkau, murah, affordable, cheap  

---

### Q4: Bedroom / Household Composition (NEVER Asked for Bedrooms Directly)
**Trigger:** If property type suggests bedrooms matter (rumah, villa, kost)  
**Question Pattern:**
- ID: "Nanti akan tinggal bersama siapa saja? Biar saya bisa carikan yang pas jumlah kamarnya."
- EN: "Who will you be living with? That way I can find the right number of bedrooms."

**What It Reveals:**
- Bedroom count needed
- **Decision maker signal:** Spouse mentioned = joint decision. Parents = family approval needed.

**SKIP if:** Already mentioned (customer said "saya sama istri dan 2 anak")

---

### Q5: Red Flags (if not captured in Q2)
**Trigger:** If Q2 didn't surface specific dislikes  
**Question Pattern:**
- ID: "Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua?"
- EN: "Anything you want to avoid? Like west-facing, noisy street, narrow alley, or old houses?"

**Examples of Red Flags:**
- Hadap barat (west-facing = hot)
- Dekat jalan ramai (noisy)
- Gang sempit (narrow lane = access issues)
- Rumah tua (age preference)
- Dekat pabrik (pollution)
- Tidak ada parkir (parking needs)

**SKIP if:** Already captured in Q2 response

---

### Q6: Anchor Point (if not captured in Q2)
**Trigger:** If Q2 didn't establish anchor, and customer seems open  
**Question Pattern:**
- ID: "Ada lokasi tertentu yang jadi patokan? Misalnya dekat sekolah anak, kantor, atau mall tertentu?"
- EN: "Any specific landmark? Like near a school, office, or certain mall?"

**Examples:**
- Dekat SMA Negeri 1 Surabaya
- Dekat kantor di Jl Tunjungan
- Dekat Pakuwon Mall

**SKIP if:** Already captured in Q2

---

### Q7: Alternative Areas
**Trigger:** After main area established  
**Question Pattern:**
- ID: "Selain [mentioned area], area sekitar yang masih oke?"
- EN: "Besides [mentioned area], are there nearby neighborhoods you'd consider?"

**Example:**
```
Selain Surabaya Pusat, area seperti Rungkut atau Gayungan juga oke?
```

**ALWAYS Asked** Unless customer already volunteered alternatives

---

### Q8: Move-in Date (MANDATORY — Never Skipped)
**Trigger:** After all 4 core filters established  
**Question Pattern:**
- ID: "Rencananya masuk atau pindah bulan apa? 📅"
- EN: "What month are you planning to move in? 📅"

**Critical Rules:**
- ✅ **MANDATORY** — System never skips this
- ✅ **ALWAYS fired** even if customer has all 4 filters
- ✅ Inserted BEFORE agent signature if in listing mode
- ✅ If `RESPOND_CATALOG_RUN=ON`, included in follow-up note

**Urgency Signals:**
- "Bulan depan" = HIGH urgency
- "Akhir tahun" = LOW urgency
- "Secepatnya" = CRITICAL

---

### Q9: Decision Maker / Viewing Logistics (NEVER Asked Directly)
**Trigger:** During Q8 response or immediately after  
**Question Pattern:**
- ID: "Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?"
- EN: "When we find a match, can you schedule viewing on the spot, or do you need to check with family first?"

**Key Insight:** NEVER ask "siapa yang memutuskan" — instead ask about **ability to decide & schedule**

**What It Reveals:**
- Solo decision → can move fast
- Joint decision → needs family approval → slower close
- Third-party input → complex decision cycle

---

### Q10: Lease Duration (if `transactionType = 'rent'` AND not volunteered)
**Trigger:** When listing rental properties  
**Question Pattern:**
- ID: "Rencananya sewa untuk berapa lama? (1 tahun, 2 tahun, atau berapa?)"
- EN: "How long are you planning to lease? (1 year, 2 years, other?)"

**Why Matter:**
- 1+ year = triggers Q10a (payment terms discussion)
- Short-term (< 6 months) = different market segment

**SKIP if:** Customer already mentioned duration

---

### Q10a: Payment Terms (triggered when lease duration ≥ 1 year)
**Trigger:** Only if Q10 = 1+ year  
**Question Pattern:**
- ID: "Untuk pembayaran, biasanya lebih cocok bayar di muka penuh atau ada yang bisa cicil?"
- EN: "For payment, would you prefer lump-sum upfront or is there flexibility for installments?"

**Based On:** Nana's feedback that some customers prefer payment flexibility  
**SKIP if:** Customer mentions preferred payment method themselves

---

### Q11: Furnishing Preference
**Trigger:** If property type is apartment/kost and not mentioned  
**Question Pattern:**
- ID: "Untuk furnitur, lebih prefer yang sudah furnished, semi-furnished, atau kosongan saja?"
- EN: "For furnishing, do you prefer fully furnished, semi-furnished, or empty?"

**Options:**
- Fully furnished = ready to move
- Semi-furnished = own bed but kitchen equipped
- Empty = complete flexibility

**SKIP if:** Already stated

---

### Q12: Apartment-Specific Branching (if `buildingType = 'apartment'`)
**Trigger:** Only when searching apartments  
**Sub-questions:**

#### Q12a: Tower Preference
- ID: "Ada preferensi tower tertentu, atau arah hadap? (Timur/Barat/utara/Selatan)"
- EN: "Any tower preference or facing direction? (East/West/North/South)"

#### Q12b: Floor Preference
- ID: "Preferensi lantai? (Rendah 1-5, Tengah 6-15, atau Tinggi 16+)"
- EN: "Floor preference? (Low 1-5, Mid 6-15, or High 16+)"

**Skip if:** Not applicable or customer flexible

---

## Integration with RESPOND_CATALOG_RUN

### When RESPOND_CATALOG_RUN = ON (Summary Mode)

Flow:
1. Ask Q1-Q9 as normal (qualification questions)
2. When all 4 core filters collected → STOP asking questions
3. Instead of showing catalog → show **SUMMARY** with:
   - ✓ Transaction type
   - ✓ Building type
   - ✓ Location
   - ✓ Budget
4. Add closing message: "Agent will follow up with detailed recommendations"
5. **Q8 mandatory is skipped** (will be asked by actual agent)
6. **Q10-Q12 skipped** (agent will handle)

### When RESPOND_CATALOG_RUN = OFF (Catalog Mode)

Flow:
1. Ask Q1-Q9 as normal
2. When all 4 core filters collected → **SHOW CATALOG**
3. Always ask Q8 (move-in date) before signature
4. Continue with Q10-Q12 if relevant (lease duration, furnishing, apartment-specific)

---

## Code Implementation

### Location: `chatbotPrivateController.js`

#### Line 1304-1444: `generateResponseForTerminalMassege()`

**Step 1: Filter Extraction** (line 1325-1326)
```js
const filters = recommendationContext?.filters
  || extractPropertyFilters(userMessage, history);
```

**Step 2: Profile Building** (line 1329)
```js
const profile = ConversationQualifier.buildProfile(history, userMessage, filters);
```

**Step 3: Qualification Gate** (line 1350-1356)
```js
const hasAllFour = !!(
  profile.buildingType &&
  profile.transactionType &&
  profile.location &&
  profile.budget
);
const shouldList = hasAllFour || profile.aiCount >= 5;
```

**Step 4: RESPOND_CATALOG_RUN Check** (line 1396-1399)
```js
const respondCatalogRun = String(process.env.RESPOND_CATALOG_RUN || 'OFF').toUpperCase() === 'ON';
```

**Step 5: Response Mode Selection** (line 1416-1459)
- If `respondCatalogRun = true` → Summary mode
- If `respondCatalogRun = false` → Catalog listing mode

#### Line 1480-1490: Response Metadata
```js
return this.#wrap(reply, {
  skillInfo,
  filters          : context.filters,
  responseMode,    // 'summary' or 'catalog'
  respondCatalogRun,
  exactMatches     : catalogMatches.length,
  // ... other metadata
});
```

---

## Q-Numbering Reference

| Q# | Category | Trigger | Mandatory? | Skip Condition |
|---|---|---|---|---|
| Q0 | Language Detection | First message | ✅ | Never |
| Q1 | Transaction Type | If unclear | ❌ | Extracted or history |
| Q2 | Search History | Location established | ❌ | Customer volunteered |
| Q3 | Budget | After other info | ❌ | Semantic keywords match |
| Q4 | Bedroom/Household | Relevant type | ❌ | Already mentioned |
| Q5 | Red Flags | If not in Q2 | ❌ | Captured earlier |
| Q6 | Anchor Point | If not in Q2 | ❌ | Captured earlier |
| Q7 | Alt Areas | Main area set | ❌ | Never—always asked* |
| Q8 | Move-in Date | All 4 filters | ✅ | Only in Summary mode |
| Q9 | Decision Maker | During/after Q8 | ❌ | Inferred from earlier |
| Q10 | Lease Duration | Rental + unclear | ❌ | Already volunteered |
| Q10a | Payment Terms | Lease ≥ 1 year | ❌ | Already stated |
| Q11 | Furnishing | Apt/kost unclear | ❌ | Already stated |
| Q12a | Tower (Apt) | Apartment type | ❌ | Not applicable |
| Q12b | Floor (Apt) | Apartment type | ❌ | Not applicable |

*Q7 skip only if customer explicitly mentioned alternatives

---

## Examples

### Example 1: Fast Path (All info in first message)
```
Customer: "Saya mau beli rumah di Surabaya, budget 600jt-1miliar, untuk tinggal sama istri dan 2 anak"

Extracted Filters:
  - transactionType: buy
  - buildingType: house
  - location: Surabaya
  - budget: 600jt-1M
  - household: 3-4 bedrooms (inferred)

Next: Skip Q1-Q7 → Ask Q8 (move-in date)
```

### Example 2: Slow Path (Step-by-step)
```
Customer: "Saya mau cari rumah"
Bot: Q1 - "Sewa atau beli?"

Customer: "Beli"
Bot: Q2 - "Sudah lihat berapa properti? Apa yang kurang cocok?"

Customer: "Belum lihat apa-apa, cari yang dekat sekolah anak"
Bot: Q3 - "Di kota mana Anda cari?"

Customer: "Surabaya"
Bot: Q3/Q4 - Trigger Q3 (budget) OR Q4 (bedroom count)
```

### Example 3: Summary Mode
```
RESPOND_CATALOG_RUN=ON

Customer: [provides all 4 filters]

Bot Response:
  Baik, saya catat ya! 📝
  
  ✓ Rencana: *beli*
  ✓ Tipe: *rumah*
  ✓ Lokasi: *Surabaya*
  ✓ Budget: *600jt - 1M*
  
  [agent follow-up message]

Status: Waiting for agent to follow up
```

---

## Environment Variables

```bash
# .env backend
RESPOND_CATALOG_RUN=ON    # Summary mode (agent follow-up)
RESPOND_CATALOG_RUN=OFF   # Catalog listing mode (instant bot response)
```

Default: `OFF` (catalog listing mode)

---

## See Also

- [skill: chat_gpt_responds/SKILL.md](../../../skills/chat_gpt_responds/SKILL.md) — AI fallback rules
- [skill: claude_responds/SKILL.md](../../../skills/claude_responds/SKILL.md) — Claude-specific rules
- [whatsappAIService.js](../services/whatsappAIService.js) — AI provider coordination
- [propertyRecommendationService.js](../services/propertyRecommendationService.js) — Filter extraction logic

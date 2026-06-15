# 09 — Qualification Flow (Q1–Q12)

## Philosophy

Guide discovery through **options, not interrogation**.
Most customers arrive vague — they don't know their exact budget or bedroom count.
Use indirect questions that reveal real needs from natural reactions.

---

## Pre-Qualification Gate (Server-Side)

The backend runs a gate **before** calling any AI provider.
This gate checks 4 minimum fields from the accumulated conversation history:

```
① buildingType    — the property type (house / villa / apartment / etc.)
② transactionType — sewa (rent) | beli → sale
③ location        — city or area
④ budget          — numeric range OR affordability preference
```

**Gate behavior by mode:**

| `RESPOND_CATALOG_RUN` | Gate behavior |
|---|---|
| `OFF` (Q1–Q12 mode) | Gate only intercepts if type+tx are **both** missing. Otherwise → AI handles via Q1–Q12 naturally (especially Q3 budget using contrasting prices). |
| `ON` (catalog mode) | Gate intercepts whenever any of the 4 fields is missing. |

**Budget is satisfied by:** `terjangkau`, `murah`, `affordable`, `yang paling murah` — do not keep asking for exact numbers after customer expresses affordability preference.

---

## Qualification State Injector (Server-Side, Q1–Q12 Mode)

In addition to the Pre-Qualification Gate, the backend computes a **QUALIFICATION STATE** block from full conversation history (last 24 messages) and injects it into every AI prompt:

```
╔══════════════════════════════════════════╗
║  📋 QUALIFICATION STATE                  ║
║  ✅ = SUDAH DIJAWAB → JANGAN TANYA LAGI  ║
║  ❓ = BELUM DIJAWAB → TANYAKAN BERIKUTNYA║
╚══════════════════════════════════════════╝

✅ Tipe transaksi    [Q1]: rent
✅ Tipe properti         : villa (fallback: apartment)
✅ Lokasi            [Q2]: Surabaya
✅ Riwayat pencarian [Q2b]: Sudah lihat 2, terlalu jauh dari pusat kota
✅ Budget            [Q3]: terjangkau/affordable
✅ Penghuni          [Q4]: 2 orang (bersama pasangan)
❓ Red flags         [Q5]: BELUM DIJAWAB
✅ Patokan lokasi    [Q6]: Saya mau di Surabaya
✅ Area alternatif   [Q7]: Saya mau Surabaya aja...
✅ Tanggal masuk ⚠️WAJIB [Q8]: 25 Agustus
❓ Keputusan         [Q9]: BELUM DIJAWAB
❓ Durasi sewa      [Q10]: BELUM DIJAWAB
✅ Furnitur         [Q11]: semi-furnished
❓ Apt preference   [Q12]: BELUM DIJAWAB
```

**Why this prevents repeated questions:**
- The AI is not required to guess from raw history — it reads the explicit ✅/❓ table
- Even if the same question was asked and answered 10+ messages ago, the state block reflects it
- The Task instruction explicitly says: *"JANGAN tanya ulang pertanyaan yang sudah ✅"*

**Fallback type detection:** When a customer says "kalau enggak ada villa... sewa apartemen saja", the `detectFallbackTypes()` function captures `fallbackTypes = ['apartment']` and this is surfaced in the Tipe properti row.

**Active session boundary (Phase 0):**
The backend computes `activeSessionStart` as the **latest** of two boundaries, then scans only `ACTIVE_ALL = history.slice(activeStart)` for Q1–Q12 content in Phase 1 (content scan), Phase 2 (AI→Customer pair matching), and Phase 3B (type-change detection):

1. **Summary boundary** — the first customer message after the last summary brief. Answers before a summary belong to the completed search and are stale.
2. **Type/transaction switch boundary** — the customer message where they switch building type (villa→hotel) **or** flip transaction type (sewa→beli) **without a summary in between**. This is the abandoned-search case: a customer half-fills a villa search, then types "Mau cari hotel". Everything before that switch is stale.

This prevents old-session answers from polluting the current search's QUALIFICATION STATE.

**Example A (summary):** Customer answered Q4 = "bersama istri" in a villa search → summary sent → now searches apartment. Phase 1 scans ACTIVE_ALL only, so "bersama istri" is NOT picked up. Q4 shows ❓ in the new search.

**Example B (abandoned switch — THE critical fix):** Customer was filling a villa search (Surabaya, masuk 26 Juni, full furnished, …) but never got a summary, then types "Mau cari penyewaan hotel". Phase 0 sets `activeStart` to the hotel message. Surabaya / 26 Juni / furnishing are NOT carried over. The AI correctly asks Q2 (location) for the hotel search — it does **not** jump to Q10 or fabricate a summary from the abandoned villa data.

⚠️ **Why this matters:** Without this boundary, a stale AI question ("Rencananya sewa berapa lama?") from the abandoned search mis-pairs with the new opening line, storing `leaseDuration = "Mau cari penyewaan hotel"`, and the leaked location/date/furnishing produce a bogus summary. The switch boundary eliminates both failures.

---

## Question Sequence

Fire questions **in order**, one per message.
Skip any question whose answer is already present in history (any turn).

---

### Q1 — Transaction Type

**Fires when:** Transaction type unknown.

```
ID: Lagi cari untuk *sewa* atau *beli*? 🏠
EN: Are you looking to *rent* or *buy*? 🏠
```

If property type is also unknown, combine:

```
ID: Halo! 😊 Mau *sewa* atau *beli*? Dan tipe properti apa yang Anda cari?
    Saya punya: *rumah, apartemen, villa, hotel, kos-kosan, ruko, kantor, gudang,
    toko, mansion, kondotel*, dan banyak lagi 🏡
```

#### Q1 Per-Type Framing (when type is known from first message)

When the customer mentions the property type upfront, acknowledge it specifically and frame the conversation accordingly:

| Building Type | Transaction | Frame / context hint |
|---|---|---|
| Hotel | Sewa (booking) | Switch to **booking frame**: tanggal check-in/out, tipe kamar, breakfast — bukan sewa bulanan |
| Kondotel | Sewa (booking) | Same as Hotel — booking per malam, check-in/out |
| Kondotel | Beli | **Investment frame**: ROI focus, operator hotel, strata title |
| Villa | Sewa/malam | Clarify rental period first: per malam/minggu/bulan |
| Villa | Beli | Personal use or investment? Private pool is usually mandatory |
| Kos-kosan | Sewa | Practical: dekat kampus/kantor, putra/putri/campur |
| Gudang | Sewa/Beli | Luas m², kawasan industri, loading dock, daya listrik |
| Kantor | Sewa | Headcount first, CBD location, grade gedung (A/B/C) |
| Ruko | Sewa/Beli | Jenis bisnis, jumlah lantai, lebar frontage |
| Toko | Sewa/Beli | Mal/pusat perbelanjaan vs standalone, foot traffic |
| Mansion | Sewa/Beli | Luxury: private pool (almost always mandatory), smart home, security |
| Rumah | Sewa/Beli | Bedroom count (from Q4), location anchor, furnishing |
| Apartemen | Sewa/Beli | Tower/floor preference (Q12), view, facilities (gym/pool) |
| Properti Lain | Sewa/Beli | Tujuan penggunaan first: parkir, event, pertanian, pabrik, klinik, dll |

**Rule:** For hotel/kondotel sewa, never ask "masuk bulan apa?" like for residential — instead ask check-in tanggal berapa (specific date). For villa sewa, always clarify rental period (malam/minggu/bulan) before asking check-in date.

---

### Q2 — Location

**Fires when:** Location unknown, transaction type known.

```
ID: Oke, mau *[sewa/beli] [Tipe]*. 📍 Di kota atau area mana yang Anda pertimbangkan?
EN: Got it, *[rent/buy] a [Type]*. 📍 Which city or area are you considering?
```

---

### Q2b — Search History *(Highest-value question)*

**Fires when:** Location established, not yet asked, AI has asked ≤ 3 questions.

This single question extracts: red flags, budget ceiling, decision maker signals, anchor point, urgency.

```
ID: Sudah lihat berapa properti di *[kota]*?
    Apa yang membuat belum cocok dari yang sudah dilihat?

EN: How many properties have you seen in *[city]*?
    What hasn't quite worked about the ones you've viewed?
```

#### Q2b Answer Handling

**All of these are valid Q2b answers — acknowledge and move to Q3:**

| Customer answer | Meaning | AI action |
|---|---|---|
| "Saya belum pernah lihat" | No prior search | "Oke, belum ada referensi sebelumnya 👌" → ask Q3 |
| "belum pernah" | No prior search | "Oke, belum ada referensi sebelumnya 👌" → ask Q3 |
| "Sudah lihat 3, tapi terlalu jauh" | 3 viewed, red flag=jauh | Note red flag, → ask Q3 or Q5 if needed |
| "Belum ada yang cocok, semuanya di gang sempit" | 0 suitable, red flag=gang sempit | Note red flag → ask Q3 |
| "belum sempat survey" | No search yet | "Oke, belum ada referensi sebelumnya 👌" → ask Q3 |
| "sudah 2 kali, saya mau cari yang ada fasilitas gym dan kolam renang" | 2 viewed + wants gym & pool | Q2b ✅ → note facility wish → ask Q3 |

**⚠️ A compound answer covers BOTH sub-questions — never re-ask Q2b.**
The Q2b question has two parts ("berapa properti" + "apa yang belum cocok"). One sentence often
answers both at once. Parse it and move on:

```
Q2b: "Sudah lihat berapa properti di Surabaya? Apa yang membuat belum cocok dari yang sudah dilihat?"
Customer: "sudah 2 kali, saya mau cari yang ada fasilitas gym dan kolam renang"
→ Berapa kali  : 2 kali
→ Belum cocok / keinginan : mau fasilitas gym & kolam renang
AI: "Oke, sudah lihat 2 dan mau yang ada gym + kolam renang ya 👌" → ask Q3 (budget)
```

**⛔ FORBIDDEN:** repeating "Sudah lihat berapa properti…" after the customer already answered.
The customer in the loop case had to re-format their answer as "1. … 2. …" because the bot kept
re-asking — this must never happen. If the QUALIFICATION STATE shows `Riwayat pencarian [Q2b]: ✅`,
Q2b is done; ask the next ❓ question.

**⚠️ CRITICAL: After Q2b is answered (✅ di QUALIFICATION STATE), the NEXT question is Q3 (Budget).** Do NOT show a summary just because Q2b didn't provide additional context — Q3, Q8, and Q4 are still unanswered.

**Server-side state:** When Q2b is answered, the QUALIFICATION STATE shows:
```
✅ Riwayat pencarian [Q2b]: Saya belum pernah lihat
```
The bot captures the customer's exact Q2b answer text in the state.

**Server-side recognition (Fonnte gate — CRITICAL):** Before the AI is called, `fonnteChatController.js` runs a gate:
```
isPropertyQuery = hasPropertyKeyword(message)       // checks for property type/tx keywords
isContinuation  = isPropertyContextContinuation(message, history)  // checks for short answer in context
if (!isPropertyQuery && !isContinuation) → SKIP (message not saved to DB, AI not called)
```

Q2b answers like "Saya belum pernah lihat", "belum pernah", "sudah lihat 3" contain **no property keywords** (`hasPropertyKeyword` = false). They must pass via `isPropertyContextContinuation`. The keyword filter (`propertyKeywordFilter.js`) now recognises these with TWO layers:

**Layer 1 — fast-path (before `hasRecentPropertyQuestion` check):**
- `belum pernah lihat`, `belum lihat`, `pernah lihat`, `sudah lihat [N]`
- `belum pernah survey`, `belum ada yang cocok`, `sudah survey`

**Layer 2 — pattern 14 answers section (after `hasRecentPropertyQuestion` = true for Q2b):**
- `belum pernah`, `sudah lihat`, `belum cocok`, `tidak cocok`, `kurang cocok`

**If either layer matches → `isContinuation = true` → message saved to DB, AI called normally.**

⚠️ If the server drops a Q2b answer silently (log: `Status: ⏭️ Tidak disimpan ke DB, AI skip`), check that the answer matches one of the patterns above. The fast-path covers the most common forms so most Q2b answers are caught before the `hasRecentPropertyQuestion` gate.

---

### Q3 — Budget *(NEVER ask directly)*

**Fires when:** Budget unknown, location known.

Show **two contrasting price anchors** for the requested type + area.
The customer's reaction reveals their real budget — no direct figure needed.

```
ID: Di *[area]* ada *[Tipe]* yang di kisaran *[LOW]* dan ada juga yang *[HIGH]*.
    Kira-kira yang mana lebih sesuai dengan rencana Bapak/Ibu?

EN: In *[area]* I have *[Type]* options around *[LOW]* and others around *[HIGH]*.
    Which range feels closer to your plans?
```

**If no price data available:**
```
ID: Untuk *[Tipe]* di *[area]* — apakah lebih prefer yang *terjangkau/ekonomis*
    atau yang *menengah ke atas*? 💰
```

**Accepted affordability answers** (treat as budget=affordable, stop asking):
`terjangkau`, `murah`, `yang paling murah`, `ekonomis`, `affordable`, `hemat`, `low budget`

**⚠️ A numeric range or amount is a COMPLETE budget answer — register it and move on.**
When the customer replies with a price (any of these forms), Q3 is ✅ — do **NOT** re-ask
the "terjangkau/ekonomis atau menengah ke atas?" fallback:

| Customer says | Parsed budget |
|---|---|
| `2-4jt/bulan`, `2-4 juta per bulan`, `2 - 4 juta` | Rp 2.000.000 – Rp 4.000.000 / bulan |
| `5 juta`, `sekitar 5jt`, `maksimal 5 juta` | Rp 5.000.000 |
| `500-800 ribu` | Rp 500.000 – Rp 800.000 |
| `1-2 miliar` | Rp 1.000.000.000 – Rp 2.000.000.000 |

The server parses ranges in full (`detectBudget`) and the QUALIFICATION STATE shows the
captured value next to `Budget [Q3]: …`. If you see a budget value there, Q3 is answered —
acknowledge it briefly (`Oke, budget 2–4 juta/bulan ya 👍`) and ask the next ❓ question.

**⛔ FORBIDDEN:** asking the affordability fallback after the customer already gave a number.
The customer in the loop case explicitly complained: *"Saya sudah jawab 2 - 4 juta per bulan…
Jangan diulangi harga ekonomis/terjangkau."* — never do this.

**Note — counts are NOT budgets:** `sudah 2 kali` (2 viewings), `3 kamar`, `10 menit` must
never be read as `2 ribu` / `3` / `10` budget. The server's word-boundary guard prevents this;
the AI must likewise treat them as their real meaning (search count, bedrooms, distance).

---

### Q4 — Household Composition *(infers bedrooms + decision maker)*

**Fires when:** Household info not mentioned.

```
ID: Nanti akan tinggal bersama siapa saja?
    Biar saya bisa carikan yang pas jumlah kamarnya 🛏️

EN: Who will be living there with you?
    That helps me find the right number of bedrooms 🛏️
```

**Bedroom inference from answer:**

| Answer | Inferred bedrooms | Decision maker |
|---|---|---|
| `sendiri`, `saya aja`, `alone` | 1 | Solo (fast decision) |
| `sama istri/suami`, `berdua` | 1–2 | Couple (joint) |
| `dengan anak`, `keluarga kecil` | 2–3 | Family (joint) |
| `bersama orangtua`, `keluarga besar` | 3+ | Joint (slower) |

Short answers are valid — **acknowledge then proceed**:
```
Customer: saya tinggal sendiran aja
AI:       Oke, berarti 1 kamar sudah cukup ya 😊 [→ ask Q3 or next unanswered Q]
```

---

### Q5 — Red Flags *(only if not captured in Q2b)*

```
ID: Ada yang pasti tidak cocok? Misalnya yang hadap barat,
    dekat jalan ramai, gang sempit, atau rumah tua?
EN: Is there anything you definitely want to avoid?
    Such as west-facing, near a busy road, narrow alleys, or older buildings?
```

**Q5 Summary display rule:**
Include `✓ Hindari:` only when a **specific, concrete** red flag was stated (e.g., `Tidak mau hadap barat`, `Tidak mau bising/ramai`).

**FORBIDDEN:** `✓ Hindari: *Disebutkan*` — this placeholder is never shown. If no specific red flag pattern matches the customer's answer, the `Hindari` line is **omitted entirely** from the summary brief. "Tidak ada" or vague non-answers → omit the line.

---

### Q6 — Anchor Point *(only if not captured in Q2b)*

```
ID: Ada lokasi tertentu yang jadi patokan?
    Misalnya dekat sekolah anak, kantor, atau mall tertentu?
EN: Is there a specific landmark you want to be near?
    For example: near a school, office, or mall?
```

**IMPORTANT — "Deket kantor" is a location anchor, NOT a building type:**
When a customer answers Q6 with `"deket kantor dan mall"`, `"dekat kantor saya"`, or any landmark description containing "kantor":
- ✅ Record as anchor point: `Deket kantor dan mall`
- ❌ NEVER change building type to `Kantor / Office`
- ❌ NEVER re-ask Q1 for office type

The server-side building-type detector now strips "dekat/deket/near X" phrases before checking property types. "kantor" only triggers office type when it appears as a standalone word (e.g., "saya mau sewa kantor"), not after a location anchor prefix.

**Customer answer can be ANY landmark — accept all of these:**
- `dekat pasar`, `dekat pasar besar`, `dekat Atom`
- `dekat cafe`, `dekat Food Junction`, `dekat restoran X`
- `deket indomaret, cafe dan ubaya` ← comma-separated list, **copy in full**
- `di jalan Dukuh Kupang`, `di sekitar jalan Ahmad Yani`
- `dekat stasiun`, `dekat terminal`, `dekat pelabuhan`, `dekat bandara`
- `dekat pabrik`, `dekat PT Jaya Putra`, `dekat kantor X`
- Any answer with a leading `dekat / deket / near / di jalan / di sekitar / samping`

**Q6 Summary display rule:**
Copy the **full anchor phrase** from the Q6 state block — do NOT truncate at commas.

| Customer says | Summary must show |
|---|---|
| `"deket indomaret, cafe dan ubaya"` | `✓ Patokan lokasi: *Deket indomaret, cafe dan ubaya*` |
| `"dekat kampus ubaya"` | `✓ Patokan lokasi: *Dekat kampus ubaya*` |

**FORBIDDEN:** `✓ Patokan lokasi: *deket indomaret,*` — the comma-truncated partial text.

**Server-side note:** The keyword filter bypasses its CLEAR_NON_PROPERTY blocklist (which contains "cafe", "restoran", etc.) when the message starts with a landmark prefix (`dekat`, `near`, `di jalan`, etc.). This ensures "dekat cafe" is never blocked as off-topic.

---

### Q7 — Alternative Areas *(always ask unless already volunteered)*

```
ID: Selain lokasi *[area yang disebutkan]*, apakah Anda mau pilihan lokasi lainnya?
EN: Besides *[mentioned area]*, are there other nearby areas you'd consider?
```

---

### Q8 — Move-in Date *(MANDATORY — never skip)*

```
ID: Rencananya masuk atau pindah bulan apa? 📅
EN: What month are you planning to move in? 📅
```

If listing was triggered before Q8 was asked, **append inside the listing reply**:
```
ID: Omong-omong, rencananya masuk atau pindah bulan apa? 📅
EN: By the way, what month are you planning to move in? 📅
```

**Q8 Summary display rule:**
In the summary brief, copy the **exact full date string** from the Q8 qualification state block.

| Customer says | State block shows | Summary must show |
|---|---|---|
| `"7 juli 2026"` | `7 juli 2026` | `✓ Masuk: *7 Juli 2026*` |
| `"Juli 2026"` | `Juli 2026` | `✓ Masuk: *Juli 2026*` |
| `"bulan depan"` | `bulan depan` | `✓ Masuk: *Bulan depan*` |

**FORBIDDEN:** Abbreviating to just the month name (e.g. `Maret`) when the customer specified a full date.

---

### Q9 — Decision Maker *(always indirect)*

```
ID: Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing
    atau perlu koordinasi dulu sama keluarga lain?
EN: If something looks good, can you schedule a viewing directly,
    or would you need to check with family first?
```

"Langsung bisa" → solo decision, higher urgency.
Never ask "siapa yang memutuskan" directly.

**Q9 Summary labels (normalized by server — AI copies the value from state block):**

| Customer answer | State block value | Summary shows |
|---|---|---|
| `"sendiri"`, `"solo"`, `"seorang diri"` | `Sendirian` | `✓ Keputusan bersama: *Sendirian*` |
| `"langsung bisa"`, `"bisa langsung"` | `Mandiri` | `✓ Keputusan bersama: *Mandiri*` |
| `"koordinasi sama istri/suami"` | `Koordinasi dengan pasangan` | `✓ Keputusan bersama: *Koordinasi dengan pasangan*` |
| `"tanya orang tua dulu"` | `Koordinasi dengan orang tua` | `✓ Keputusan bersama: *Koordinasi dengan orang tua*` |

**FORBIDDEN:** Using invented labels like `Solo (mandiri)` — use the exact normalized label from the state block.

---

### Q10 — Lease Duration *(rent only, if not volunteered)*

```
ID: Rencananya sewa untuk berapa lama? ⏱️ (durasi, bukan tanggal — contoh: 6 bulan, 1 tahun)
EN: How long are you planning to rent? ⏱️ (a duration, not a date — e.g. 6 months, 1 year)
```

**Duration vs date guard (server-side):** Q10 asks for a **duration** ("6 bulan", "1 tahun"), not a calendar date. If the customer answers with a date ("26 Juni 2026"), the server does **not** store it as the lease duration — Q10 stays ❓ and is re-asked with the clarified hint above. The AI must never put a date or an unrelated phrase in `Durasi sewa`.

**Q10 Summary display rule:**
Only include `✓ Durasi sewa:` in the summary brief if the customer explicitly stated a specific duration (e.g., `1 tahun`, `6 bulan`, `2 tahun`).

**FORBIDDEN:** Writing `✓ Durasi sewa: *Disebutkan*` or any vague placeholder when no specific duration was given. If Q10 was not answered with a specific value, omit the line entirely.

**Short duration answers are always property continuation:**
A message like `"1 tahun"` or `"6 bulan"` as the entire customer message is **always** treated as a property continuation (answer to Q10), even if it appears shortly after the Q10 question was asked. The server-side keyword filter has an early fast-path rule that passes these through before checking conversation history — this prevents race conditions where the AI's question isn't yet persisted to the database.

#### Q10a — Payment Terms *(fires if lease ≥ 1 year)*

```
ID: Untuk pembayaran, lebih cocok bayar di muka penuh
    atau ada yang bisa cicil?
EN: For payment, do you prefer paying the full amount upfront,
    or would installment options work better?
```

---

### Q11 — Furnishing *(rent only, if not stated)*

```
ID: Untuk furnitur, lebih prefer yang sudah *furnished*,
    *semi-furnished*, atau *kosongan* saja? 🛋️
EN: For furnishing, do you prefer *fully furnished*,
    *semi-furnished*, or *unfurnished*? 🛋️
```

**CRITICAL — "Kosongan" is a furnishing answer, NOT a building type change:**

When a customer answers Q11 with `"kosongan saja"`, `"tidak pakai furnish"`, or any unfurnished preference:
- ✅ Record it as: furnishing = `Kosongan` / `Unfurnished`
- ❌ NEVER change the building type to `Kos / Boarding House`
- ❌ NEVER re-ask "rencananya sewa atau beli?" for kos-kosan

The word "kosongan" (unfurnished) contains "kos" as a substring, but the server-side building-type detector now uses **word-boundary regex** (`\bkos\b`) to prevent this false positive. If you see the building type flip to kos after Q11, it is a bug — the customer is still searching for the original property type.

---

### Q12 — Apartment-Specific *(type = apartment only)*

```
ID: Untuk apartemen, ada preferensi tower atau lantai tertentu?
    (Lantai tinggi biasanya lebih tenang, lantai rendah lebih mudah akses)
EN: For apartments, do you have a floor or tower preference?
    (Higher floors = quieter, lower floors = easier access)
```

---

## Skip Logic

A question is skipped if **any** of these is true:

- Answer already present in any customer message (any turn)
- AI already asked it in a prior turn
- Customer explicitly requested a listing (`kasih daftarnya`, `tampilkan`, `show me`, etc.)
- Readiness score ≥ 3 and mode=ON → switch to listing

---

## Non-Property Message Guard (WhatsApp Mode)

If the customer's latest message is **not about property** (e.g., a technical request, file generation, code, off-topic question), the AI must **not process it as a property query**. Reply with exactly:

```
Maaf, saya hanya bisa membantu terkait pencarian properti.
Ada yang bisa saya bantu untuk kebutuhan properti Anda? 🏠
```

**Examples of non-property messages to skip:**
- "Buatkan file text untuk summary, review, solusi..."
- "Update skills pada claude_responds dan chat_gpt_responds..."
- Any message containing file paths, code requests, or developer instructions

**Why this matters:** Technical messages may contain words like "property" as part of file paths (e.g., `Elevan_Property\skills\`). The server-side keyword filter uses `\bproperty\b` word-boundary regex to catch this — `_property` does NOT match because `_` is a word character (`\w`) in JavaScript, so there is no word boundary between `_` and `p`.

---

## Property Type / Transaction Change → ALWAYS Reset to Q1

**RULE (mandatory):** Whenever the customer changes the **property type** (rumah, kos, ruko, apartemen, villa, toko, hotel, gudang, kantor, cafe/shop, or any other type) **OR** the **transaction type** (sewa ↔ beli), the conversation **restarts from Q1**. All Q2–Q12 answers from the previous search are stale and must be discarded — they describe a different property the customer is no longer asking about.

This is the customer's explicit expectation: *"Jika ada perubahan tipe transaksi atau tipe properti, maka response selalu kembali ke Q1."*

---

### Server-side behavior (automatic)

Phase 0 detects the switch and trims the active session to the switch message, so the QUALIFICATION STATE for the new search starts almost empty:

```javascript
state.typeChangedFromHistory = true
// Only buildingType + transactionType carry into the new search (from the switch message).
// Everything else is ❓: location, budget, household, redFlags, anchorPoint,
//   alternativeAreas, moveInDate, decisionMaker, leaseDuration, furnishing, apartmentPref.
```

`buildQualificationStateBlock()` injects a visible banner:
```
⚠️  TIPE PROPERTI BERUBAH — Customer beralih ke jenis properti baru.
   Q2-Q12 di-RESET. Akui perubahan singkat (1 kalimat), lanjut dari Q terkecil ❓.
```

### AI response when this banner is present

1. Acknowledge the change in **one short sentence** — e.g., "Oke, saya alihkan ke hotel ya 😊"
2. Ask the **smallest-numbered ❓ question** (follow ⚡ PERTANYAAN BERIKUTNYA — usually Q1 or Q2)
3. **NEVER** carry over old Q2–Q12 answers (location, date, furnishing, decision, lease duration) from the previous type/transaction
4. **NEVER** show a summary on the turn the change happens — there is nothing yet to summarize for the new search

---

### Example A — Property type change (villa → hotel)

```
[Previous] Customer: mau sewa villa di Surabaya
[Previous] AI:       Budget villa sekitar 5–10 jt atau 15–25 jt?
[Previous] Customer: yang 5-10 jt aja
[Previous] AI:       Rencananya masuk bulan apa?
[Previous] Customer: 26 Juni 2026
...
[Now]      Customer: Mau cari penyewaan hotel
[Now]      AI:       Oke, saya alihkan ke hotel ya 😊 Di kota atau area mana yang Anda inginkan? 📍
```
❌ **WRONG (the bug):** jumping to "Rencananya sewa untuk berapa lama?" and then producing a summary with `Lokasi: Surabaya`, `Masuk: 26 Juni 2026`, `Furnitur: Full furnished` — all leaked from the abandoned villa search. None of that was asked for the hotel.

### Example B — Transaction type change (beli → sewa)

```
[Previous] Customer: mau beli gudang di Malang
[Previous] AI:       Budget gudang di Malang sekitar 500 jt atau 1–2 M?
[Previous] Customer: yang 500 jt aja
...
[Now]      Customer: eh, saya mau sewa aja bukan beli
[Now]      AI:       Siap, saya ubah ke gudang *sewa* ya 😊 Di kota atau area mana yang Anda inginkan? 📍
```
Budget changes drastically between buying and renting, so the old `500 jt` budget is discarded and Q3 is re-asked with rent-appropriate ranges. Restart from Q1/Q2.

---

**History preservation (all cases):**
- All previous messages remain in the database and session history
- The reset is **logical only** — the AI may read full history for tone/context but treats every old type- or transaction-specific answer as stale
- History is preserved **as long as the cookie/session is active**, so the customer can return to a prior search later if they explicitly ask

---

## After Summary Brief

Once the structured brief has been sent, the QUALIFICATION STATE will include the banner:
```
⚠️  SUMMARY SUDAH DIKIRIM — Customer memulai pencarian baru.
   Lihat ⚡ PERTANYAAN BERIKUTNYA di bawah — tanyakan field ❓ terkecil.
   JANGAN tampilkan summary lagi sampai semua Q wajib ✅ di sesi ini.
   JANGAN gunakan jawaban dari sesi lama (history sebelum summary).
```

**Behavior by message type:**

| Customer message type | AI response |
|---|---|
| New property intent ("Saya mau cari rumah di Malang") | Ask Q1 for the new search |
| Ambiguous ("Mau cari properti") | Ask Q1: "Mau sewa atau beli? Dan tipe propertinya apa?" |
| Non-property message | Apply Non-Property Message Guard → polite redirect only |
| Confirmation/thanks | Acknowledge warmly, no new questions |

**Critical rule:** When the SUMMARY SUDAH DIKIRIM banner is present, NEVER show another summary — even if the message contains property keywords. The qualification flow must restart from Q1 before a new summary can be shown.

---

## Summary Brief (Mode OFF — after mandatory questions complete)

Show when ALL of these are answered: Q1 (tx), building type, location, Q3 (budget), Q8 (date),
Q4 or Q9 (household/decision), Q7 (alternative areas).

```
Baik, permintaan utama Anda sudah saya catat, sebagai berikut 📝 🔥

✓ Rencana: *[nilai dari Q1 tx]* — HANYA jika ✅
✓ Tipe: *[nilai dari building type]* — HANYA jika ✅
✓ Lokasi: *[nilai dari Q2]* — HANYA jika ✅
✓ Budget: *[nilai dari Q3]* (terkonfirmasi nanti) — HANYA jika ✅
✓ Masuk: *[nilai dari Q8]* — HANYA jika ✅
✓ Keputusan bersama: *[nilai dari Q9]* — HANYA jika ✅
✓ Furnitur: *[nilai dari Q11]* — HANYA jika ✅
✓ Patokan: *[nilai dari Q6 — nilai PERSIS dari QUALIFICATION STATE]* — HANYA jika ✅
✓ Area alternatif: *[nilai dari Q7]* — HANYA jika ✅

Saya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠 Apabila ada pertanyaan lagi, silahkan hubungi saya kembali.
Terima kasih sudah menghubungi saya. 🙏
```

**Summary Strict Rules:**
- **HANYA sertakan field yang ✅ di QUALIFICATION STATE.** Jangan sertakan field yang ❓ — lewati baris itu seluruhnya.
- **Gunakan nilai PERSIS yang tertera setelah ": " di baris ✅** — jangan tulis "Disebutkan", "Ada", "Iya", "Diketahui", atau frasa samar lainnya.
- **⛔ JANGAN gunakan nilai dari raw conversation history** jika field tersebut ❓ di QUALIFICATION STATE — walaupun kata itu muncul di history. QUALIFICATION STATE dihitung khusus dari sesi aktif saat ini.
- **⛔ JANGAN gunakan jawaban dari pencarian lama** (tipe/transaksi yang sudah diganti). Jika customer baru saja beralih dari "villa di Surabaya" ke "hotel", lokasi/tanggal/furnitur villa TIDAK boleh muncul di summary hotel. Banner ⚠️ TIPE PROPERTI BERUBAH = jangan tampilkan summary, mulai dari Q terkecil ❓.
- **⛔ JANGAN pernah mengarang jawaban.** Jika belum pernah menanyakan lokasi, durasi sewa, atau patokan lokasi pada sesi aktif ini, baris-baris itu TIDAK boleh ada di summary. Lebih baik bertanya daripada menebak.
- **⛔ DILARANG KERAS: Jangan inferensi "Masuk: [bulan]" dari tanggal sistem.** Jika Q8 ❓ → baris "Masuk" tidak ada di brief, titik.
- **⛔ DILARANG KERAS: Jangan tulis "Patokan: Disebutkan" jika Q6 ❓.** Baris Patokan hanya ada jika Q6 = ✅ dengan nilai konkret.
- **⛔ JANGAN tampilkan summary jika Q3 (Budget) masih ❓** — walaupun budget muncul di old session history.
- **⛔ JANGAN tampilkan summary jika Q8 (Tanggal masuk) masih ❓** — ini mandatory, tidak ada pengecualian.
- **⛔ JANGAN tampilkan summary setelah Q2b dijawab jika Q3/Q8/Q4 masih ❓.**
- One question per message only.
- Max 12 AI messages before showing brief, even if incomplete.

**Wrong vs correct example (Q6 Patokan):**
```
❌ Wrong:  ✓ Patokan lokasi: Disebutkan
✅ Correct: ✓ Patokan: *Dekat ATOM*   ← exact value from QUALIFICATION STATE row Q6

❌ Wrong:  ✓ Keputusan bersama: Bersama istri  ← Q9 was never asked in this session
✅ Correct: (omit this line entirely — Q9 is ❓)

❌ Wrong:  ✓ Masuk: Juni   ← Q8 belum dijawab, AI inferensi dari tanggal sistem
✅ Correct: (omit this line — Q8 is ❓)
```

---

## ⚡ NEXT ACTION Directive (Server-Injected)

At the bottom of every QUALIFICATION STATE block, the server injects a **⚡ PERTANYAAN BERIKUTNYA** box:

```
╔══════════════════════════════════════════════════════════╗
║  ⚡ PERTANYAAN BERIKUTNYA: Q7                             ║
╠══════════════════════════════════════════════════════════╣
║  Tanyakan: "Selain lokasi *Surabaya*, apakah Anda mau pilihan lokasi lainnya? 🗺️"
╠══════════════════════════════════════════════════════════╣
║  ⛔ JANGAN tanya pertanyaan lain selain yang di atas.    ║
║  ⛔ JANGAN ulangi field yang sudah ✅ di atas.           ║
║  ⛔ ABAIKAN raw history — STATE BLOCK = satu-satunya     ║
║     sumber kebenaran tentang apa yang sudah dijawab.     ║
╚══════════════════════════════════════════════════════════╝
```

**Purpose:** Prevents the AI from re-asking answered questions (looping). The directive is computed server-side from the qualification state and is authoritative — it overrides any conclusion the AI might draw from raw conversation history.

**Priority order for next question:** Q1 → Q2 → Q2b → Q3 → Q8 → Q4 → Q5 → Q6 → Q7 → Q9 → Q10 → Q11 → Q12

**When all questions are answered:** The directive changes to `✅ SEMUA Q WAJIB SUDAH DIJAWAB — Tampilkan summary brief sekarang.`

---

## Q9 — Decision Maker (Server-Side Normalization)

Customer responses to Q9 are **normalized server-side** before being stored in the qualification state. The AI does not need to interpret the raw response — it copies the normalized value exactly.

| Customer answer | Stored as |
|---|---|
| "saya yang ambil keputusan", "saya sendiri yang memutuskan", "langsung bisa viewing", "tidak perlu koordinasi" | `Mandiri` |
| "sendiri", "sendirian", "seorang diri", "solo" | `Sendirian` |
| "perlu koordinasi sama istri/suami" | `Koordinasi dengan pasangan` |
| "perlu tanya orang tua dulu" | `Koordinasi dengan orang tua` |
| "perlu tanya keluarga" | `Koordinasi dengan keluarga` |
| Other | Raw customer response |

Additionally, when Q4 household = "1 orang (sendiri)", Q9 is auto-set to `Mandiri` (a single person always decides alone — Q9 is not asked).

**FORBIDDEN:** inventing labels like `Solo (mandiri)` or `Solo — customer yang memutuskan sendiri`. Copy the exact normalized value from the QUALIFICATION STATE row.

---

## Q8 — Move-In Date: Year Inference

The server automatically adds the correct year when a customer states only a month:

| Customer says | Current date | Stored as |
|---|---|---|
| "18 Agustus" | 10 Jun 2026 | `18 Agustus 2026` (Agustus > Juni → future) |
| "10 Mei" | 10 Jun 2026 | `10 Mei 2027` (Mei < Juni → already past) |
| "Januari" | 10 Jun 2026 | `Januari 2027` (Januari < Juni → already past) |
| "3 Februari" | 10 Jun 2026 | `3 Februari 2027` |
| "24 Juni" | 10 Jun 2026 | `24 Juni 2026` (same month, day 24 > today 10 → future) |
| "5 Juni" | 10 Jun 2026 | `5 Juni 2027` (same month, day 5 < today 10 → already past) |
| "Juni 2027" (explicit year) | any | `Juni 2027` (no inference, year stated) |

This logic runs in `extractQualificationState()` Phase 1 — the AI always receives a fully-qualified date with year.

**Word-boundary protection (brand name false positive):**
The month regex uses `\b` word boundaries so brand/place names that contain month substrings do NOT trigger Q8.

| Customer says | Result |
|---|---|
| "dekat indomaret" | ✅ NOT treated as move-in "maret" — word boundary blocks it |
| "maret tahun depan" | ✅ Captured as move-in date (standalone month word) |

If a customer mentions "indomaret", "Carefour", "Hypermart" etc., Q8 is still asked normally.

**Q9 date-answer guard:**
If the customer answers Q9 (decision maker / viewing logistics) with a date phrase like `"mei tahun depan"`, `"Juli 2026"`, or `"bulan depan"`, the server detects this and does NOT store it as the decision maker. Instead, Q8 is set from that answer and Q9 remains unanswered.

This prevents summaries showing: `✓ Keputusan bersama: *mei tahun depan*`

---

## Full Conversation Example

```
Customer: Siang. Saya mau sewa villa
AI (Q2):  Baik! Mau sewa Villa. 📍 Di kota atau area mana yang Anda inginkan?

Customer: di malang
AI (Q8):  Rencananya masuk atau pindah bulan apa? 📅

Customer: 24 juni 2026
AI (Q4):  Nanti akan tinggal bersama siapa saja?
          Biar saya bisa carikan yang pas jumlah kamarnya 🛏️

Customer: saya tinggal sendiran aja
AI (Q3):  Oke, berarti 1 kamar sudah cukup ya 😊
          Di Malang ada Villa sekitar 3–5 juta/bulan dan ada yang 8–15 juta/bulan.
          Kira-kira yang mana lebih sesuai?

Customer: yang 3-5 juta aja
AI:       [budget set → all 4 fields present → proceed to listing or next mode behavior]
```

---

## Q8 — Date Interpretation Rules (35 cases — server `customerDateParser`)

The backend normalizes every Q8 answer (move-in / check-in / start-operasional /
target-beli) through **`backend/utils/customerDateParser.js`** *before* the AI sees it.
The reference "today" is always the live server clock (`new Date()`). The worked
examples below use **today = 12 Juni 2026** (per spec). The AI receives the already-
normalized `DD Bulan YYYY` string in the QUALIFICATION STATE — it must **copy that exact
value** into the summary and must NOT re-interpret the raw text itself.

**Two answers REQUIRE the AI to ask before summarizing** (rules 25 & 35). For those the
state shows an ask-directive, not a date; if the customer still can't/won't give a date
(belum tahu / tidak bisa memutuskan / diam), the summary value becomes **`Waiting the update`**.

| # | Customer says | Normalized result (today = 12 Juni 2026) |
|---|---|---|
| 1 | Minggu depan | 19 Juni 2026 *(+7 hari)* |
| 2 | Besok | 13 Juni 2026 |
| 3 | Bulan depan | 12 Juli 2026 |
| 4 | 19 Agustus | 19 Agustus 2026 |
| 5 | 12 Mei *(sudah lewat)* | 12 Mei 2027 |
| 6 | Tahun depan | 12 Juni 2027 *(+1 tahun)* |
| 7 | 11 September 2026 | 11 September 2026 |
| 8 | 11 September 26 | 11 September 2026 *(2-digit → 20xx)* |
| 9 | 11 Sep 2026 | 11 September 2026 |
| 10 | 9 Feb 2027 | 09 Februari 2027 |
| 11 | Maret, 12 | 12 Maret 2027 *(lewat → tahun depan)* |
| 12 | Desember, 28 | 28 Desember 2026 |
| 13 | Dec, 28 2026 | 28 Desember 2026 |
| 14 | Dec, 28 2027 | 28 Desember 2027 |
| 15 | 13/06/2026 | 13 Juni 2026 *(DD/MM)* |
| 16 | 02/07/2026 | 02 Juli 2026 *(ambigu → DD/MM)* |
| 17 | 06/15/2026 | 15 Juni 2026 *(angka ke-2 >12 → MM/DD)* |
| 18 | 09/13/2026 | 13 September 2026 *(MM/DD)* |
| 19 | 01/15/2027 | 15 Januari 2027 *(MM/DD)* |
| 20 | 02/13/2027 | 13 Februari 2027 *(MM/DD)* |
| 21 | 01/05/2027 | 01 Mei 2027 *(ambigu → DD/MM)* |
| 22 | 11/12/2026 | 11 Desember 2026 *(ambigu → DD/MM)* |
| 23 | 2026 Agustus | 01 Agustus 2026 *(tahun + bulan → tgl 1)* |
| 24 | Mei *(bare, lewat)* | 01 Mei 2027 |
| 25 | **Juni** *(bulan berjalan)* | **AI WAJIB TANYA** tanggal pastinya (≥ 12 Juni 2026). Belum tahu → `Waiting the update` |
| 26 | Juli *(bare, depan)* | 01 Juli 2026 |
| 27 | Agustus *(bare, depan)* | 01 Agustus 2026 |
| 28 | Feb *(bare, lewat)* | 01 Februari 2027 |
| 29 | Jan *(bare, lewat)* | 01 Januari 2027 |
| 30 | 18 Jan | 18 Januari 2027 |
| 31 | Aug 2 | 02 Agustus 2026 |
| 32 | Hari ini / sekarang | 12 Juni 2026 |
| 33 | June 12 2026 | 12 Juni 2026 |
| 34 | Lusa | 14 Juni 2026 |
| 35 | **Segera** | **AI WAJIB TANYA** dulu. Belum tahu → `Waiting the update` |

### Disambiguation logic (numeric `a/b/yyyy`)
- angka pertama `a > 12` → **DD/MM**
- angka kedua `b > 12` → **MM/DD**
- keduanya `≤ 12` → **DD/MM** (default Indonesia)
- tahun 2 digit (`26`) → `2026` (abad sama dengan `now`)
- bulan tanpa tahun → kemunculan terdekat (kalau sudah lewat tahun ini → tahun depan tgl 1)

### Rule 25 — bulan berjalan ("Juni" saat ini Juni)
Customer hanya menyebut bulan yang sedang berjalan tanpa tanggal. Tanggal harus **≥ tanggal
hari ini**. **WAJIB tanya tanggal pastinya dulu** sebelum membuat summary:

```
ID: Untuk bulan Juni ini, kira-kira tanggal berapa rencananya, Kak? 📅
EN: For this June, around which date are you planning? 📅
```

Kalau customer belum tahu / tidak bisa memutuskan / diam → summary `✓ Masuk: *Waiting the update*`.

### Rule 35 — "Segera"
**WAJIB tanya dulu**, jangan auto-resolve ke tanggal apa pun:

```
1. "Kak, boleh tau kira-kira tanggalnya?" 📅
2. (jika belum dijawab) "Baik, kak. Mohon segera info tanggalnya ya."
```

Kalau tetap belum tahu / diam → summary `✓ Masuk: *Waiting the update*`.

### Server integration (don't re-parse in the AI)
- `extractQualificationState()` calls `parseCustomerDate(raw, new Date())` for Q8 and stores the
  normalized string (or sets `moveInDateAsk = 'current_month' | 'soon'`).
- `isDontKnowDateAnswer()` detects "belum tahu / belum pasti / not sure / nanti aja" → after an
  ask-directive this sets `moveInDate = 'Waiting the update'`.
- The QUALIFICATION STATE row `Tanggal masuk ⚠️WAJIB [Q8]` shows the final value; the
  ⚡ PERTANYAAN BERIKUTNYA box carries the ask-directive hint when rules 25/35 apply.
- **The conversation never "stops" on a date answer** — a Q8 reply like "Juni 2026" is always a
  property continuation, the flow proceeds to the next ❓ question (this fixes the bug where the
  chat dead-ended after the customer answered the move-in month).

---

## Budget Anchor Price Table (Q3)

These are the reference price ranges used for the Q3 two-option anchor question (`getBudgetAnchors(buildingType, transactionType)` — sourced from `chatbotPrivateController.js`).

Template:
```
"Di *[lokasi]* ada *[Tipe]* yang di kisaran *[LOW]* dan ada juga yang *[HIGH]*.
Kira-kira yang mana lebih sesuai dengan rencana Anda? 💰"
```

| Tipe Properti | Sewa — Rendah | Sewa — Tinggi | Beli — Rendah | Beli — Tinggi |
|---|---|---|---|---|
| Rumah | 2–5 juta/bln | 10–25 juta/bln | 300–800 juta | 1–5 miliar |
| Apartemen | 2–5 juta/bln | 8–20 juta/bln | 300–700 juta | 1–3 miliar |
| Hotel | 400–800 rb/malam | 2–6 juta/malam | — | — |
| Villa | 1–3 juta/malam | 5–15 juta/malam | 1–3 miliar | 5–20 miliar |
| Kos | 500rb–1,5 juta/bln | 2–5 juta/bln | — | — |
| Ruko | 15–40 juta/bln | 60–150 juta/bln | 1–3 miliar | 5–20 miliar |
| Kantor | 50–100 rb/m²/bln | 150–300 rb/m²/bln | 2–5 miliar | 10–30 miliar |
| Gudang | 20–50 juta/bln | 80–200 juta/bln | 1–3 miliar | 5–15 miliar |
| Toko | 10–30 juta/bln | 50–150 juta/bln | 500 jt–2 M | 5–15 miliar |
| Mansion | 5–15 juta/bln | 30–100 juta/bln | 5–15 miliar | 30–100 miliar |
| Kondotel | 500rb–1,5 juta/malam | 3–8 juta/malam | 500–900 juta | 1,5–4 miliar |
| Lainnya | 10–30 juta/bln | 50–200 juta/bln | 500 jt–3 M | 5–25 miliar |

**Notes:**
- Hotel dan Kos tidak ada opsi beli → clarify jika customer minta beli (mungkin investasi gedung)
- Kantor: satuan per m²/bulan → perlu luas dari headcount (Q14-O1) untuk anchoring yang akurat
- Villa sewa: default per malam → tanyakan period via Q14-V1 jika durasi tidak jelas
- `"terjangkau"`, `"murah"`, `"affordable"`, `"hemat"`, `"low budget"` → Q3 ✅ tanpa angka, budget = affordable → lanjut Q8

---

## BELI FLOW — Q_KPR → Q_KPR-a → Q_COND → Q11-beli

*(Menggantikan Q10/Q10a/Q11 untuk transaksi `sale`)*

Untuk transaksi **beli**, alur setelah Q4 (household) berbeda dari sewa:

```
SEWA: Q8 → Q4 → Q5 → Q6 → Q7 → Q9 → Q10 → Q10a → Q11 → Q12 → [Q14]
BELI: Q8 → Q4 → Q_KPR → [Q_KPR-a] → [Q_COND] → [Q11-beli] → [Q14]
```

Q5/Q6/Q7/Q9/Q10/Q10a/Q12 **TIDAK ditanyakan** untuk transaksi beli.

---

### Q_KPR — Pembiayaan (MANDATORY untuk semua transaksi beli)

**Fires when:** `transactionType === 'sale'` AND customer belum menyebut pembiayaan.

```
Residensial (rumah/apartemen/villa/mansion/kos):
  ID: "Untuk pembiayaan, rencananya *cash* atau *KPR*? 💳"
  EN: "For financing, will it be *cash* or a *mortgage (KPR)*? 💳"

Komersial (ruko/kantor/gudang/toko/hotel/kondotel/others):
  ID: "Untuk pembiayaan, rencananya *cash*, *KPR komersial*, atau *kombinasi*? 💳"
  EN: "For financing, *cash*, *commercial mortgage*, or a *combination*? 💳"

Tanah/Kavling/Lahan (type = others, customer menyebut tanah/kavling):
  ID: "Untuk pembiayaan, rencananya *cash* atau *KPR*?
      (untuk tanah biasanya KPT — Kredit Pemilikan Tanah) 💳"
  EN: "For financing, will it be *cash* or a *loan*?
      (land usually uses a Land Ownership Credit/KPT) 💳"
```

**Skip Q_KPR** jika sudah ada kata berikut di conversation: `cash`, `tunai`, `kpr`, `kredit`, `cicil`, `kombinasi`, `kpt`, `pembiayaan`, `dp`, `down payment`, `mortgage`, `installment`.

---

### Q_KPR-a — KPR Readiness: Bank + DP %

**Fires when:** Customer memilih KPR/cicil/kredit/kombinasi/KPT (`financingIsKPR = true`) DAN belum menyebut bank/DP.

```
ID: "Sudah ada gambaran bank yang dituju, atau perlu saya bantu rekomendasikan?
    Dan DP-nya kira-kira berapa persen yang disiapkan? 🏦"
EN: "Do you already have a target bank, or should I recommend one?
    And roughly what down-payment percentage are you preparing? 🏦"
```

**Skip Q_KPR-a** jika customer sudah menyebut bank (BCA, Mandiri, BNI, BRI, BTN, CIMB, Danamon, Permata) atau `"sudah approve"`, `"pre-approved"`, `"sudah cek bank"`.

---

### Q_COND — Kondisi Properti (residensial beli: rumah/apartemen/mansion)

**Fires when:** `buildingType` ∈ {house, apartment, mansion} AND `transactionType === 'sale'`.
**NOT asked** untuk commercial (ruko/toko/kantor/gudang/hotel/kondotel/others).

```
Apartemen:
  ID: "Untuk kondisi unit, prefer yang *baru/primary* dari developer,
      atau *secondary* yang sudah jadi? 🏢"
  EN: "For condition, do you prefer *new/primary* from the developer,
      or *secondary* (ready) units? 🏢"

Rumah / Mansion:
  ID: "Untuk kondisi, lebih prefer yang *baru/ready*,
      *second* kondisi baik, atau *inden* tidak masalah? 🏠"
  EN: "For condition, do you prefer *new/ready*, a good-condition *second-hand*,
      or is *off-plan/inden* okay? 🏠"
```

**Skip Q_COND** jika sudah ada: `baru`, `ready`, `ready stock`, `primary`, `second`, `bekas`, `secondary`, `inden`, `indent`, `pre-order`, `kondisi baik`, `siap huni`.

---

### Q11-beli — Furnishing (residensial beli, jika belum disebutkan)

**Fires when:** `buildingType` ∈ {house, apartment, mansion} AND `transactionType === 'sale'` AND furnishing belum disebutkan.

```
ID: "Untuk furnitur, prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan*? 🛋️"
EN: "For furnishing, do you prefer *furnished*, *semi-furnished*, or *unfurnished*? 🛋️"
```

**NOT asked** untuk: hotel, kondotel, villa (assumed furnished); commercial (irrelevant).

---

### BELI FLOW — Summary Brief Display

Untuk transaksi beli, summary TIDAK menampilkan `Durasi sewa` atau `Payment terms`.
Tampilkan (jika ✅ di QUALIFICATION STATE):

```
✓ Pembiayaan: *[Cash / KPR — Bank BCA, DP 20% / KPR komersial / Kombinasi]*
✓ Kondisi: *[Baru/ready / Secondary / Inden]*
✓ Furnitur: *[Furnished / Semi-furnished / Kosongan]*
```

---

## Q14 — Type-Specific Questions (Mode OFF / Summary Mode Only)

*(Ditanyakan setelah core Q1–Q12 + BELI FLOW selesai — SATU pertanyaan per pesan)*

Q14 adalah pertanyaan follow-up spesifik per tipe properti, diambil dari `ConversationQualifier.getNextQuestion()` (mode = `'summary'`). Lewati jika sudah dijawab di QUALIFICATION STATE atau conversation history.

**Q14 TIDAK ditanyakan** dalam Mode ON (`RESPOND_CATALOG_RUN=ON`) — listing langsung ditampilkan.

---

### Q14-H — Hotel & Kondotel Sewa (Booking Frame)

Hotel dan Kondotel sewa = **booking per malam**, bukan sewa bulanan.
⚠️ **Jangan tanya Q8 (masuk bulan apa)** seperti residensial — langsung Q14-H1 (check-in tanggal spesifik).

| Slot | ID | EN |
|---|---|---|
| Q14-H1 Check-in date | "Rencananya check-in tanggal berapa? 📅" | "What is your planned check-in date? 📅" |
| Q14-H2 Check-out/berapa malam | "Check-out tanggal berapa? (atau berapa malam?) 🌙" | "Check-out date? (or how many nights?) 🌙" |
| Q14-H3 Tipe kamar | "Tipe kamar yang diinginkan? *Standard*, *Deluxe*, *Suite*, atau *Family room*? 🛏️" | "Preferred room type? *Standard*, *Deluxe*, *Suite*, or *Family room*? 🛏️" |
| Q14-H4 Breakfast | "Termasuk *breakfast* ya? Atau tanpa breakfast juga oke? ☕" | "Do you want *breakfast included*, or room only is fine? ☕" |

---

### Q14-V — Villa

**Villa Sewa:**

| Slot | ID | EN |
|---|---|---|
| Q14-V1 Rental period (tanya SEBELUM check-in) | "Sewa villa-nya per *malam*, per *minggu*, atau per *bulan*? ⏱️" | "Renting the villa per *night*, per *week*, or per *month*? ⏱️" |
| Q14-V2 Private pool | "Perlu villa dengan *private pool*? Atau shared pool juga oke? 🏊" | "Do you need a villa with a *private pool*, or is a shared pool okay? 🏊" |
| Q14-V3 Check-in date (SETELAH period diketahui) | "Tanggal check-in? 📅" | "Check-in date? 📅" |

**Villa Beli:**

| Slot | ID | EN |
|---|---|---|
| Q14-V2-beli Private pool (hampir selalu mandatory) | "Untuk villa, wajib ada *private pool*? Ini biasanya jadi standar villa premium. 🏊" | "For the villa, is a *private pool* a must? It's usually a standard for premium villas. 🏊" |

---

### Q14-K — Kos / Boarding House

| Slot | ID | EN |
|---|---|---|
| Q14-K1 Tipe kos | "Kos yang dicari untuk *putra*, *putri*, atau *campur*? 🏠" | "Looking for *male-only*, *female-only*, or *mixed* boarding house? 🏠" |
| Q14-K2 Kamar mandi | "Kamar mandi *dalam* (en-suite) atau *luar* (shared) oke? 🚿" | "*Private bathroom* (en-suite) or *shared bathroom* is okay? 🚿" |

---

### Q14-R — Ruko / Shophouse

| Slot | ID | EN |
|---|---|---|
| Q14-R1 Bisnis apa | "Bisnis apa yang akan dijalankan di sana? 🏪" | "What kind of business will be run there? 🏪" |
| Q14-R2-beli Tenant status (beli only) | "Prefer ruko *kosong* atau yang sudah ada *tenant* berjalan? (tenant existing = langsung cashflow) 🏪" | "Do you prefer an *empty* shophouse or one with an *existing tenant*? (existing tenant = instant cashflow) 🏪" |

---

### Q14-T — Toko / Store

| Slot | ID | EN |
|---|---|---|
| Q14-T1 Bisnis + lokasi preferensi | "Bisnis apa yang akan dibuka di toko ini? Dan lebih prefer di *mal/pusat perbelanjaan* atau *standalone*? 🛍️" | "What business will open here? And do you prefer a *mall* unit or *standalone*? 🛍️" |
| Q14-T2-beli Unit type + tenant (beli only) | "Prefer unit *mal prime* (stabil) atau *trade center* (yield lebih tinggi)? Dan unit kosong atau sudah ada penyewa? 🛍️" | "Prefer a *prime mall* unit (stable) or *trade center* (higher yield)? And empty or with an existing tenant? 🛍️" |

---

### Q14-O — Kantor / Office

| Slot | ID | EN |
|---|---|---|
| Q14-O1 Headcount | "Berapa orang yang akan bekerja di kantor ini? (untuk tentukan luas & grade gedung) 👥" | "How many people will work in this office? (to determine size & building grade) 👥" |
| Q14-O2 Grade gedung | "Preferensi gedung *Grade A* (premium), *Grade B* (mid), atau *Grade C* (ekonomis)? 🏢" | "Preference: *Grade A* (premium), *Grade B* (mid), or *Grade C* (economy) building? 🏢" |

---

### Q14-M — Mansion

| Slot | ID | EN |
|---|---|---|
| Q14-M1 Private pool (hampir selalu mandatory) | "Untuk mansion, wajib ada *private pool*? Ini hampir selalu jadi standar mansion premium. 🏊" | "Is a *private pool* mandatory for the mansion? It's nearly always standard for premium properties. 🏊" |

---

### Q14-C — Kondotel Beli (Frame Investasi)

Kondotel beli = investasi, bukan hunian pribadi.

| Slot | ID | EN |
|---|---|---|
| Q14-C1 ROI target | "Target ROI per tahun berapa? (misalnya 7%, 10%, atau lebih?) 📈" | "What's your target annual ROI? (e.g. 7%, 10%, or higher?) 📈" |
| Q14-C2 Unit type (yield terbaik) | "Tipe unit yang paling laku disewakan? *Studio* atau *1 kamar* biasanya ROI terbaik. 🛏️" | "Which unit type rents best? *Studio* or *1-bedroom* usually gives the best ROI. 🛏️" |

---

### Q14-W — Gudang / Warehouse

| Slot | ID | EN |
|---|---|---|
| Q14-W1 Tujuan penggunaan | "Gudangnya untuk apa — *produksi*, *distribusi*, atau *penyimpanan*? 📦" | "What is the warehouse for — *production*, *distribution*, or *storage*? 📦" |
| Q14-W2-beli Zonasi (beli only) | "Perlu pengecekan legalitas *zona industri/pergudangan* sebelum deal? (agar tidak salah peruntukan) 📋" | "Should we verify the *industrial/warehouse zoning* legality before the deal? 📋" |

---

### Q14-L — Properti Lainnya (Tanah/Kavling/Lahan/SPBU/Pabrik/Klinik)

| Slot | ID | EN |
|---|---|---|
| Q14-L1 Peruntukan/tujuan | "Properti ini rencananya untuk tujuan apa? (parkir, event, pertanian, pabrik, klinik, dll) 🏗️" | "What is the planned purpose of this property? (parking, events, farming, factory, clinic, etc.) 🏗️" |
| Q14-L2-beli SHM + zonasi (beli only) | "Perlu pengecekan *sertifikat (SHM)* dan *zonasi* sebelum deal? (agar peruntukannya sesuai rencana) 📋" | "Should we verify the *certificate (SHM)* and *zoning* before the deal? 📋" |

---

### Q14 Skip Rules

| Kondisi | Q14 yang di-skip |
|---|---|
| Hotel/Kondotel sewa | Q11 furnishing (always furnished), Q10 lease duration, Q12 apartment prefs |
| Commercial (ruko/kantor/gudang/toko) | Q4 bedroom count, Q11 furnishing, Q12 apartment prefs |
| Villa/Mansion sewa | Q4 household (bukan hunian biasa), Q11 (assumed furnished) |
| Villa/Mansion beli | Q14-V1 rental period (tidak relevan untuk sale) |
| Mode = catalog (RESPOND_CATALOG_RUN=ON) | Q14 TIDAK ditanyakan — listing langsung tampil |
| Sudah dijawab sebelumnya | Pertanyaan terkait di-skip (cek ✅ di QUALIFICATION STATE) |

---

### Full Q Flow Map (Mode OFF / Summary Mode)

```
Q0/Q1   → Tx type + property type (combined if both unknown)
Q2      → Location
Q2b     → Search history (highest-value, fires once, extracts red flags + budget signals)
Q3      → Budget (two price anchors — NEVER a direct "budget berapa?" ask)
Q8      → Move-in / check-in / target beli date ⚠️ MANDATORY
Q4      → Household composition (infers bedrooms + decision maker)

── SEWA ──────────────────────── ── BELI ──────────────────────────────
Q5   Red flags (skip if Q2b)      Q_KPR   Pembiayaan: cash/KPR/KPR komersial
Q6   Anchor point (skip if Q2b)   Q_KPR-a KPR readiness: bank + DP % (if KPR)
Q7   Alternative areas             Q_COND  Kondisi: baru/second/inden (residensial)
Q9   Decision maker (indirect)     Q11-b   Furnishing: furnished/semi/kosongan (residensial)
Q10  Lease duration (rent only)
Q10a Payment terms (≥ 1 year)
Q11  Furnishing: furnished/semi/kosongan
Q12  Apartment prefs (apart only)
──────────────────────────────── ──────────────────────────────────────

Q14 Type-specific slots (one per message, skip if already answered):
  Hotel/Kondotel sewa → H1 check-in → H2 check-out/nights → H3 room type → H4 breakfast
  Villa sewa          → V1 period (malam/minggu/bln) → V2 private pool → V3 check-in
  Villa beli          → V2 private pool mandatory check
  Kos                 → K1 tipe (putra/putri/campur) → K2 kamar mandi (dalam/luar)
  Ruko                → R1 bisnis → R2 tenant status (beli only)
  Toko                → T1 bisnis + mal/standalone → T2 prime/trade + tenant (beli only)
  Kantor              → O1 headcount → O2 grade gedung (A/B/C)
  Mansion             → M1 private pool mandatory check
  Kondotel beli       → C1 ROI target → C2 unit type (studio/1BR)
  Gudang              → W1 tujuan (produksi/distribusi/penyimpanan) → W2 zonasi (beli only)
  Lainnya             → L1 peruntukan (parkir/event/pertanian/pabrik/dll) → L2 SHM+zonasi (beli)

✅ SUMMARY BRIEF → Agent handoff
```

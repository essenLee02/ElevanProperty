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
The backend computes `activeSessionStart` as the **latest** of THREE boundaries, then scans only `ACTIVE_ALL = history.slice(activeStart)` for Q1–Q12 content in Phase 1 (content scan), Phase 2 (AI→Customer pair matching), and Phase 3B (type-change detection):

1. **Summary boundary** — the first customer message after the last summary brief. Answers before a summary belong to the completed search and are stale.
2. **Type/transaction switch boundary** — the customer message where they switch building type (villa→hotel) **or** flip transaction type (sewa→beli) **without a summary in between**. This is the abandoned-search case: a customer half-fills a villa search, then types "Mau cari hotel". Everything before that switch is stale.
3. **Greeting-restart boundary** — a customer message that opens with a greeting (`hi`, `halo`, `hello`, `pagi`, `selamat siang`, `permisi`, …) **and** restates a property intent + type (e.g. *"Hi.. mau sewa apartemen di malang"*) — **even if the type is the SAME as before**. A greeting + fresh intent means the customer is starting over. Everything before it is discarded.

This prevents old-session answers from polluting the current search's QUALIFICATION STATE.

**⛔ Stale budget must never leak across a boundary.** A numeric/ambiguous budget from an abandoned search (e.g. an old `0-1600000` waiting for unit clarification) is dropped when a new search starts — the backend keeps a numeric budget only if a price digit actually appears in the ACTIVE session. So after *"Hi.. mau sewa apartemen di malang"* (no number), the AI must **NOT** ask "harga 0-1600000 maksudnya dalam ribu/juta?" — that budget belonged to the old search. Re-ask Q3 by category for the new search. (A category budget like `menengah` has no digit and is preserved correctly.)

**Business rule — THREE triggers that all reset to Q1:**

| Trigger | Example | What happens |
|---|---|---|
| Building type changes | "tadinya villa, sekarang mau hotel" | Full reset → ask Q1 for new type |
| Transaction type flips | "eh bukan beli, mau sewa aja" | Full reset → ask Q1 |
| **City/location changes** | "tadinya Surabaya, tapi mau Bali aja" | **Full reset → ask Q1** |
| Greeting + fresh intent | "Halo, mau cari apartemen" (restart) | Full reset → ask Q1 |

When any of these fires: abandon ALL prior Q2–Q12 answers, never carry old budget/date/furnishing. Acknowledge in one sentence ("Oke, saya alihkan ke [tipe baru]/[kota baru] ya 😊"), then ask the smallest unanswered ❓.

**Example A (summary):** Customer answered Q4 = "bersama istri" in a villa search → summary sent → now searches apartment. Phase 1 scans ACTIVE_ALL only, so "bersama istri" is NOT picked up. Q4 shows ❓ in the new search.

**Example B (abandoned switch — THE critical fix):** Customer was filling a villa search (Surabaya, masuk 26 Juni, full furnished, …) but never got a summary, then types "Mau cari penyewaan hotel". Phase 0 sets `activeStart` to the hotel message. Surabaya / 26 Juni / furnishing are NOT carried over. The AI correctly asks Q2 (location) for the hotel search — it does **not** jump to Q10 or fabricate a summary from the abandoned villa data.

⚠️ **Why this matters:** Without this boundary, a stale AI question ("Rencananya sewa berapa lama?") from the abandoned search mis-pairs with the new opening line, storing `leaseDuration = "Mau cari penyewaan hotel"`, and the leaked location/date/furnishing produce a bogus summary. The switch boundary eliminates both failures.

---

## Session TTL & Reset Rules

### CHATBOT_COOKIE_TTL_MINUTES

The session has a time-to-live set by `CHATBOT_COOKIE_TTL_MINUTES` in the environment.

| Situation | Behavior |
|---|---|
| TTL still active | AI keeps responding normally; history is preserved |
| TTL expired, summary NOT yet sent | Backend creates a fresh session → empty history → Q1 is asked from scratch |
| TTL expired, summary WAS sent | Same as above: fresh session → Q1 from scratch; customer starts a new search |
| Customer sends ANY message after TTL expiry | Always triggers Q1 regardless of prior conversation state |

**AI side:** You will see an empty QUALIFICATION STATE (all ❓) when TTL has expired. Treat this as a fresh customer — ask Q1 as if it's the very first message.

---

## Q1 Non-Property Gate

**Rule:** If the customer's VERY FIRST message in a session contains **no property-related content**, the backend deflects with one sentence and does NOT call the AI. This prevents off-topic conversations from consuming AI resources.

**What counts as property-related:** any mention of property type (rumah, villa, apartemen, kos, ruko, hotel, gudang, kantor, toko…), transaction (sewa, beli, kontrak…), location intent (di mana, di kota, area…), or property qualifiers (harga, budget, kamar, fasilitas, KPR…).

**If AI IS called on the first message (gate passed):** This means the message already contains some property signal. Proceed with Q1 normally — extract whatever is known and ask for what's missing.

**If the gate fires silently (not your turn):** The backend has already replied with a redirect. You will see that redirect as the last assistant message in history. On the next customer message, proceed normally.

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

### Q1b — Comparison / Recommendation Request *(customer names 2 types & asks "which is better")*

When the customer mentions **two property types** and asks which suits them better — e.g.
*"villa atau apartemen, lebih cocok yang mana?"*, *"berikan rekomendasi antara villa atau apartemen"* —
do **NOT** ignore it and march into Q2b. **Answer the question first** with a brief, informed
recommendation (1–2 sentences), pick the more suitable type, then continue qualifying that type.

**Decision heuristics (state them briefly, don't lecture):**
| Signal | Recommend |
|---|---|
| Group / rombongan ≥ 6 orang, gathering, keluarga besar, butuh banyak kamar | **Villa** (kapasitas besar, banyak kamar, ruang bersama) |
| Sewa harian/short-stay (mis. "4 hari 3 malam"), liburan | **Villa** (untuk grup) / hotel-kondotel (untuk 1–4 orang) |
| Solo / pasangan, dekat transit/kantor/mall, urban, bulanan | **Apartemen** |
| Butuh privasi + halaman + kolam pribadi | **Villa** |

```
Contoh:
Customer: "villa atau apartemen untuk 15 orang, 4 hari 3 malam di Malang?"
AI: "Untuk 15 orang dengan stay 4 hari 3 malam, *villa* jauh lebih cocok, Kak — kapasitas
     kamarnya besar dan ada ruang berkumpul, sedangkan apartemen biasanya 1–2 kamar. Saya
     fokuskan ke villa ya. Di Malang ada villa di kisaran [LOW] dan ada yang [HIGH] — kira-kira
     yang mana lebih sesuai?"  ← lanjut ke Q3 budget untuk villa
```

After the recommendation, set the building type to the recommended one (keep the other as a
fallback if the customer pushes back) and proceed through the normal flow. **Do not loop on Q2b.**

---

### Q2 — Location

**Fires when:** Location unknown, transaction type known.

```
ID: Oke, mau *[sewa/beli] [Tipe]*. 📍 Di kota atau area mana yang Anda pertimbangkan?
EN: Got it, *[rent/buy] a [Type]*. 📍 Which city or area are you considering?
```

---

### Q2c — District / Area within Large City *(new)*

**Fires when:** Location is a large city (Surabaya, Jakarta, Bandung, Semarang, Makassar, Medan) AND no specific area/district has been mentioned.  
**Does NOT fire for:** Commercial types (ruko, kantor, gudang), hotel/kondotel booking.  
**Fires BEFORE Q2b** — knowing the district narrows the search before asking about search history.

```
ID: Di area atau kawasan mana di *[kota]* yang Anda pertimbangkan? 📍
    [Contoh spesifik per kota]

EN: Which area or neighbourhood in *[city]* are you considering? 📍
    [City-specific examples]
```

**City-specific examples:**

| City | Indonesian example |
|------|-------------------|
| Surabaya | Misalnya Pakuwon, Darmo, Rungkut, Gubeng, atau area lainnya? |
| Jakarta | Misalnya Kebayoran, Menteng, Kelapa Gading, Kemang, atau area lainnya? |
| Bandung | Misalnya Dago, Buah Batu, Antapani, Pasteur, atau area lainnya? |
| Semarang | Misalnya Banyumanik, Tembalang, Gajahmungkur, atau area lainnya? |
| Makassar | Misalnya Panakkukang, Tamalate, Rappocini, atau area lainnya? |

**Q2c Answer Handling:**

| Customer answers | AI action |
|---|---|
| Names a specific area ("Pakuwon City") | ✅ Store as district. Proceed to Q2b. |
| Names a district with anchor ("deket Grand City") | ✅ Store district + capture anchor for Q6. |
| "Di mana saja oke" / "Fleksibel" / "Terserah" | ✅ Q2c answered (flexible = no constraint). Proceed. |
| Customer answers with district info included in Q2 | ✅ Q2c already answered — skip, don't ask. |

**Updated Priority order:** Q1 → Q2 → **Q2c** → Q2b → Q3 → Q8 → Q4 → Q5 → Q6 → Q7 → Q9 → Q10 → Q11 → Q12

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

**⛔⛔ HARD RULE — "belum pernah lihat" = Q2b ANSWERED.**
Any of these answers FULLY satisfies Q2b — acknowledge in ≤1 short clause and move to the next ❓:
`"belum pernah lihat"`, `"belum pernah"`, `"belum"`, `"baru mulai"`, `"belum survey"`,
`"sudah lihat N"`, `"belum ada yang cocok"`.
- **NEVER** re-ask Q2b after any of these — not once, not "to confirm", not because the customer's
  message also repeated "cari sewa" / "berikan rekomendasi" (those are NOT a reason to re-ask).
- If the customer repeats the same Q2b answer twice, you have ALREADY looped — STOP, acknowledge,
  and jump straight to the lowest ❓ field (per the ⚡ NEXT ACTION box). Re-asking a third time is a bug.

**⚠️ CRITICAL: After Q2b is answered (✅ di QUALIFICATION STATE), the NEXT question is Q3 (Budget).** Do NOT show a summary just because Q2b didn't provide additional context — Q3, Q8, and Q4 are still unanswered.

**Server-side state:** When Q2b is answered, the QUALIFICATION STATE shows:
```
✅ Riwayat pencarian [Q2b]: Saya belum pernah lihat
```
The bot captures the customer's exact Q2b answer text in the state.

**Server-side recognition (WhatsApp gate — CRITICAL):** Before the AI is called, setiap WhatsApp controller (`fonnteChatController.js`, `kirimiChatController.js`, `timelinesAIChatController.js`) runs a gate:
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

**Ask by CATEGORY (3 tiers), never by absolute price.** Do NOT show big absolute
figures like "Rp 40.750.000.000 dan Rp 67.700.000.000" — it feels blunt. Offer the
three tiers and let the customer choose; the server maps the tier to a reasonable
price range for the summary.

```
ID: Untuk *[Tipe]* *[sewa/beli]* di *[area]*, Kak lebih prefer yang
    *terjangkau*, *menengah*, atau *eksklusif*? 💰

EN: For *[Type]* *[to rent/to buy]* in *[area]*, would you prefer
    *budget-friendly*, *mid-range*, or *exclusive*? 💰
```

**The 3 budget tiers** (server resolves the concrete range per type × transaction):

| Tier | Customer words | Meaning |
|---|---|---|
| **Terjangkau** | terjangkau, ekonomis, murah, hemat, standar bawah, affordable | entry-level / value |
| **Menengah** | menengah, sedang, standar, menengah ke atas, kompetitif, mid-range | mid-market |
| **Eksklusif** | eksklusif, mewah, premium, mahal, kelas atas, luxury | high-end |

**Reasonable price bands per type × transaction** (server table `getBudgetTiers` —
`jt`=juta, `M`=miliar; eksklusif open-ended → "+"):

| Property | Transaksi | Terjangkau | Menengah | Eksklusif |
|---|---|---|---|---|
| House | Beli | Rp 350–900 jt | Rp 900 jt–3 M | Rp 3–15 M+ |
| House | Sewa | Rp 2–6 jt/bln | Rp 6–15 jt/bln | Rp 15–50 jt/bln |
| Apartment | Beli | Rp 350–800 jt | Rp 800 jt–2,5 M | Rp 2,5–10 M+ |
| Apartment | Sewa | Rp 2–5 jt/bln | Rp 5–15 jt/bln | Rp 15–50 jt/bln |
| Condo | Beli | Rp 700 jt–1,5 M | Rp 1,5–5 M | Rp 5–20 M+ |
| Condo | Sewa | Rp 4–10 jt/bln | Rp 10–30 jt/bln | Rp 30–100 jt+/bln |
| Hotel | Beli | Rp 5–20 M | Rp 20–100 M | Rp 100–500 M+ |
| Hotel | Sewa | Rp 100–500 jt/bln | Rp 500 jt–2 M/bln | Rp 2–10 M+/bln |
| Villa | Beli | Rp 800 jt–3 M | Rp 3–10 M | Rp 10–100 M+ |
| Villa | Sewa bulanan | Rp 15–50 jt/bln | Rp 50–150 jt/bln | Rp 150–500 jt+/bln |
| Villa | Sewa harian | Rp 1,5–4 jt/malam | Rp 4–10 jt/malam | Rp 10–40 jt+/malam |
| Boarding House / Kost | Beli | Rp 500 jt–2 M | Rp 2–8 M | Rp 8–50 M+ |
| Boarding House / Kost | Sewa kamar | Rp 600 rb–1,8 jt/bln | Rp 1,8–3,5 jt/bln | Rp 3,5–10 jt/bln |
| Shophouse / Ruko | Beli | Rp 1–2,5 M | Rp 2,5–7 M | Rp 7–25 M+ |
| Shophouse / Ruko | Sewa | Rp 30–100 jt/thn | Rp 100–300 jt/thn | Rp 300 jt–1 M+/thn |
| Office | Beli | Rp 1–5 M | Rp 5–20 M | Rp 20–200 M+ |
| Office | Sewa | Rp 50–200 jt/thn | Rp 200–800 jt/thn | Rp 800 jt–5 M+/thn |
| Warehouse | Beli | Rp 1–4 M | Rp 4–15 M | Rp 15–100 M+ |
| Warehouse | Sewa | Rp 50–200 jt/thn | Rp 200–800 jt/thn | Rp 800 jt–5 M+/thn |
| Store | Beli | Rp 500 jt–2 M | Rp 2–6 M | Rp 6–25 M+ |
| Store | Sewa | Rp 20–80 jt/thn | Rp 80–300 jt/thn | Rp 300 jt–2 M+/thn |
| Mansion | Beli | Rp 5–20 M | Rp 20–100 M | Rp 100–500 M+ |
| Mansion | Sewa | Rp 30–100 jt/bln | Rp 100–300 jt/bln | Rp 300 jt–2 M+/bln |

Standard level mapping: **Affordable → Mid-range → Luxury** = **Terjangkau → Menengah → Eksklusif**.
Notes: *Condo* = unit premium (apartemen kelas atas). *Store* = unit toko; *Shophouse/Ruko* =
ruko (usaha + bisa hunian). Villa sewa: harian (vacation) vs bulanan (long-stay) — server pilih
band sesuai periode yang disebut customer (malam → harian, bulan → bulanan).

**Customer may still answer freely** — a category (`terjangkau`/`menengah`/`eksklusif`/
`mahal`/`murah`/`harga kompetitif`) OR a number/range (`2 juta`, `5jt`, `2-3juta/minggu`,
`800-2m`, `700jt-1.2m`, `931 juta-1.4 miliar`, `800k-3juta`). All are COMPLETE budget answers.

**⚠️ A numeric range or amount is a COMPLETE budget answer — register it and move on.**
When the customer replies with a price (any of these forms), Q3 is ✅ — do **NOT** re-ask
the "terjangkau/ekonomis atau menengah ke atas?" fallback:

| Customer says | Parsed budget |
|---|---|
| `2-4jt/bulan`, `2-4 juta per bulan`, `2 - 4 juta` | Rp 2.000.000 – Rp 4.000.000 / bulan |
| `5 juta`, `sekitar 5jt` (absolut) | Rp 4.250.000 – Rp 5.750.000 (band ±15%) |
| `maksimal 5 juta`, `di bawah 5jt` (plafon) | Rp 5.000.000 (batas atas saja) |
| `Coba yang 40.750.000.000` (pilih anchor, absolut) | Rp 34.637.500.000 – Rp 46.862.500.000 (band ±15%) |
| `500-800 ribu` | Rp 500.000 – Rp 800.000 |
| `1-2 miliar` | Rp 1.000.000.000 – Rp 2.000.000.000 |

**Absolute single price → ±15% band.** When the customer fires ONE exact price without a range
(e.g. picks an anchor: "Coba yang 40.750.000.000", or says "5 juta"), the server builds a
±15% range around it (`detectBudget` → `_budgetBand`): low = value × 0.85, high = value × 1.15.
The summary `✓ Budget` shows that range. EXCEPTION — if the customer used a ceiling word
(`maksimal`, `max`, `di bawah`, `kurang dari`) → keep it as an upper bound, no band.

A bare full-IDR number like `40.750.000.000` or `1.600.000` (≥ 2 thousand-groups) is ALWAYS a
budget answer — even without "juta"/"rp". Never skip it as "not a property query".

**Category answer → summary shows category + reasonable range.** When the customer answers a
TIER (`terjangkau`/`menengah`/`eksklusif`/`mahal`/`murah`/`kompetitif`) instead of a number,
the server maps it to the reasonable price band for that property type × transaction and the
summary shows both. Example (Rumah beli, customer said "menengah"):
```
✓ Budget: *Menengah (Rp 900.000.000 - Rp 3.000.000.000)*
```
Acknowledge briefly (`Oke, kategori menengah ya Kak 👍`) and move to the next ❓ question.

The server parses ranges in full (`detectBudget`) and the QUALIFICATION STATE shows the
captured value next to `Budget [Q3]: …`. If you see a budget value there, Q3 is answered —
acknowledge it briefly (`Oke, budget sekitar Rp 34,6 M – Rp 46,8 M ya 👍`) and ask the next ❓ question.

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
ID: Ada yang pasti tidak cocok atau ingin dihindari?
    Misalnya rawan banjir, area panas, hadap barat, dekat jalan ramai,
    gang sempit, atau dekat rel kereta?
EN: Anything you definitely want to avoid?
    Like flood-prone areas, hot/west-facing, noisy streets,
    narrow alleys, or near train tracks?
```

**Common red flags to detect and store:**

| Customer says | Red flag stored |
|---|---|
| `rawan banjir`, `sering banjir`, `tergenang` | Rawan banjir |
| `panas`, `terlalu panas`, `kurang rindang`, `tidak teduh` | Area panas / kurang pohon |
| `hadap barat`, `west facing` | Hadap barat |
| `bising`, `berisik`, `ramai`, `terlalu ramai` | Area bising |
| `gang sempit`, `lorong sempit` | Akses gang sempit |
| `dekat rel kereta`, `rel kereta api` | Dekat rel kereta |
| `dekat pabrik`, `polusi udara`, `bau pabrik` | Polusi / dekat industri |
| `macet banget`, `kemacetan parah`, `tidak macet`, `bebas macet` | Tidak mau macet |
| `tidak gelap`, `gelap jalannya`, `jalan gelap` | Jalan tidak gelap |
| `rumah tua`, `bangunan tua` | Kondisi properti tua |

**Q5 Summary display rule:**
Include `✓ Hindari:` only when a **specific, concrete** red flag was stated (e.g., `Tidak mau rawan banjir`, `Tidak mau area panas`).

**FORBIDDEN:** `✓ Hindari: *Disebutkan*` — this placeholder is never shown. If no specific red flag pattern matches the customer's answer, the `Hindari` line is **omitted entirely** from the summary brief. "Tidak ada" or vague non-answers → omit the line.

**Mixed Q5+Q6 answer rule:** Customer often answers Q5 with both red flags AND an anchor point in one sentence — e.g., *"tidak macet, tidak banjir, tidak gelap jalannya, terus deket cafe dan restoran"*. Split the answer:
- Red flag parts (`tidak macet`, `tidak banjir`, `tidak gelap jalannya`) → `✓ Hindari:`
- Anchor parts (`deket cafe dan restoran`) → `✓ Patokan:` (stored as Q6)
Never combine them into one field. If the customer's answer has both, both fields get populated.

---

### Q6 — Anchor Point *(only if not captured in Q2b)*

```
ID: Ada lokasi atau tempat tertentu yang jadi patokan?
    Misalnya dekat sekolah anak, mal, wisata, kawasan tertentu, atau jalan tertentu? 📍

EN: Any specific location or landmark you'd like to be near?
    For example a school, mall, tourist spot, residential estate, or street? 📍
```

**For Surabaya specifically:**
```
ID: Ada lokasi atau tempat tertentu yang jadi patokan?
    Misalnya dekat Grand City, Pakuwon, wisata mangrove, KBS, sekolah anak, atau jalan tertentu? 📍
```

**Why include wisata/kawasan:** Customers commonly reference tourist spots (Kenjeran, Mangrove Wonorejo, KBS) and named estates (Pakuwon City, Citraland) as anchor points. These are NOT off-topic — they are property location references.

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

**Q9 Summary labels — Keputusan bersama:**

| Customer answer | Summary shows |
|---|---|
| `"sendiri"`, `"solo"`, `"seorang diri"` | `✓ Keputusan bersama: *Sendirian*` |
| `"langsung bisa"`, `"bisa langsung"` | `✓ Keputusan bersama: *Solo (bisa langsung jadwalkan)*` |
| `"sama suami"` / `"sama istri"` | `✓ Keputusan bersama: *Bersama suami*` / `*Bersama istri*` |
| `"sama pasangan"` | `✓ Keputusan bersama: *Bersama pasangan*` |
| `"sama keluarga"` | `✓ Keputusan bersama: *Bersama keluarga*` |
| `"sama teman saya"` / `"teman-teman"` | `✓ Keputusan bersama: *Teman*` |
| `"koordinasikan sama teman"` / `"koordinasi dulu"` / `"perlu diskusi"` | `✓ Keputusan bersama: *Perlu koordinasi (joint decision)*` |

**Q9 Viewing field** — terpisah dari "Keputusan bersama", menangkap preferensi viewing:

| Customer answer | Viewing shows |
|---|---|
| `"lihat katalog aja"`, `"ga ada waktu survei"` | `✓ Viewing: *Minta listing*` |
| `"mau dijadwalkan viewing"`, `"boleh viewing kapan"` | `✓ Viewing: *Mau dijadwalkan viewing*` |
| `"saya koordinasikan sama teman saya"` | `✓ Viewing: *koordinasikan sama teman (Belum ditanyakan)*` |
| `"perlu koordinasi dulu"` (tanpa menyebut siapa) | `✓ Viewing: *Perlu koordinasi dulu (tanggal belum ditanyakan)*` |
| AI tanya kapan → customer jawab `"besok"` / `"Senin depan"` / `"tanggal 5"` | `✓ Viewing: *Survey dijadwalkan: besok*` |
| AI tanya kapan → customer belum menyebut tanggal | `✓ Viewing: *Mau viewing (tanggal belum dikonfirmasi)*` |
| AI tanya `"jam berapa?"` → customer jawab `"jam 1 siang"` / `"pagi jam 9"` | `✓ Viewing: *Besok siang jam 1*` (gabung hari+waktu+jam) |
| Customer usul `"boleh siang"` (hanya time-of-day) → AI tanya jam → customer jawab jam | `✓ Viewing: *Besok siang jam 1*` (default hari = besok bila tidak disebutkan) |
| Customer sebut hari-dalam-minggu + "minggu depan" → AI tanya jam → customer jawab jam | `✓ Viewing: *Jam 7 pagi, 9 Juli 2026*` (hari X minggu depan = tanggal konkret +7 hari dari hari ini) |

**⚠️ Viewing wajib ada di summary** jika ada jadwal survey yang sudah dikonfirmasi (hari/jam). Jangan hilangkan baris Viewing dari brief hanya karena tidak ada tanggal kalender eksplisit — "besok siang jam 1" sudah cukup sebagai jadwal.

**⛔ JANGAN mengarang label.** Salin nilai persis dari state block. Jangan tulis "Mandiri", "Koordinasi dengan pasangan" — ikuti tabel di atas.

---

### Q10 — Lease Duration *(rent only, if not volunteered)*

```
ID: Rencananya sewa untuk berapa lama? ⏱️ (durasi, bukan tanggal — contoh: 6 bulan, 1 tahun)
EN: How long are you planning to rent? ⏱️ (a duration, not a date — e.g. 6 months, 1 year)
```

**Duration vs date guard (server-side):** Q10 asks for a **duration** ("6 bulan", "1 tahun"), not a calendar date. If the customer answers with a date ("26 Juni 2026"), the server does **not** store it as the lease duration — Q10 stays ❓ and is re-asked with the clarified hint above. The AI must never put a date or an unrelated phrase in `Durasi sewa`.

**Q10 Summary display rule:**
Only include `✓ Durasi:` in the summary brief if the customer explicitly stated a specific duration. Valid for **ALL units** — `10 hari`, `2 minggu`, `6 bulan`, `1 tahun`, `2 tahun` — not just years. A short-stay weekly/daily rental ("butuh sewa 2 minggu") must show `✓ Durasi: *2 minggu*`.

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

**Detailed furnishing answers — capture the listed items, don't ignore them:**

Customers often answer Q11 by naming the furniture/appliances they need, e.g.
`"semi furnished aja, pokok ada peralatan dapur, lemari dan ranjang tidur"`.

- ✅ Record furnishing = `Semi-furnished` (the stated state) **and** note the must-have items
  as a preference/facility line — e.g. `Furnitur: Semi-furnished (wajib: peralatan dapur,
  lemari, ranjang)`.
- ✅ Acknowledge the specifics briefly so the customer feels heard
  ("Oke, semi-furnished dengan dapur, lemari & ranjang ya 👍"), then ask the next ❓ question.
- ❌ Do not reduce it to a bare `Semi-furnished` and drop the listed items — those items are
  the customer's real requirement and must reach the agent brief.

> These detailed replies often run past one short line. They are valid Q11 answers — never
> treat a furnishing reply as off-topic just because it lists kitchen/bedroom items.

---

### Q_FAC — Facilities / Amenities *(WAJIB untuk sewa, opsional untuk beli hunian)*

**For sewa (rent):** MANDATORY — must ask before showing summary.  
**For beli (buy) residential** (rumah, apartemen, villa, mansion): OPTIONAL but recommended — ask to understand must-have facilities.  
**For commercial types:** NOT asked.

Fires after Q11 (furnishing), before the summary. Adapts by property type:

```
Apartemen:
ID: Ada fasilitas apartemen tertentu yang Anda inginkan?
    Misalnya kolam renang, gym, rooftop, keamanan 24 jam, atau yang lainnya? 🏊
EN: Any specific apartment facilities you'd like?
    For example swimming pool, gym, rooftop, 24-hour security, or others? 🏊

Villa:
ID: Ada fasilitas villa yang diinginkan?
    Misalnya kolam renang pribadi, dapur lengkap, BBQ area, atau yang lainnya? 🏊
EN: Any specific villa facilities you'd like?
    For example private pool, full kitchen, BBQ area, or others? 🏊

Rumah / Default:
ID: Ada fasilitas tertentu yang Anda inginkan?
    Misalnya AC, kolam renang, gym, carport/garasi, keamanan 24 jam, atau yang lainnya? 🏊
EN: Any specific facilities you'd like?
    For example AC, swimming pool, gym, carport/garage, 24-hour security, or others? 🏊
```

- Detected amenities accumulate across the session and appear as `✓ Fasilitas: Kids zone, Gym`
  in the summary. Common labels: AC, WiFi, Kolam renang, Gym, Kids zone, Keamanan 24 jam, Lift,
  Parkir, Carport, Garasi, Taman, Dapur, Water heater, Balkon, Rooftop.
- Jika customer jawab **"standar", "biasa", "terserah", "apa saja", "gak ada"** → catat sebagai
  fasilitas standar, lalu tampilkan daftar standar berdasarkan tipe properti + furnishing:
  - Rumah **semi-furnished**: `AC, Kitchen set, CCTV camera, Lemari, Kamar Mandi, Kulkas, One gate system`
  - Rumah **fully furnished**: tambah `Tempat Tidur, TV`
  - Rumah **unfurnished**: `Kamar Mandi, One gate system`
  - Apartemen **semi-furnished**: `AC, Kitchen set, Lemari, Kamar Mandi`
  - Apartemen **fully furnished**: tambah `Tempat Tidur, TV, Kulkas, Microwave`
  - Kos **fully furnished**: `AC, Kasur, Lemari, Kamar Mandi dalam, WiFi, Meja belajar`
  - Kos **semi-furnished**: `AC, Kamar Mandi dalam`
  - Villa: `AC, Kitchen set, Kolam renang, Kamar Mandi`
  → Tampil di summary sebagai: `✗ Fasilitas: *[daftar standar] (Fasilitas standar)*`
- **Do NOT show the summary for a sewa transaction until facilities has been asked.** If still
  un-asked at summary time → it appears as `✗ Fasilitas: (Belum ditanyakan)` (a gap for the agent).

---

### Q12 — Apartment-Specific *(type = apartment only)*

```
ID: Untuk apartemen, ada preferensi tower atau lantai tertentu?
    (Lantai tinggi biasanya lebih tenang, lantai rendah lebih mudah akses)
EN: For apartments, do you have a floor or tower preference?
    (Higher floors = quieter, lower floors = easier access)
```

---

### Q14 — Property-Type-Specific Slots *(summary mode only)*

Fire **one per message**, in the order shown. Skip if already answered.

#### Kos / Boarding House

```
Q14-KOS-1 (Kos type):
ID: Kos yang dicari untuk *putra*, *putri*, atau *campur*? 🏠
EN: Looking for *male-only*, *female-only*, or *mixed* boarding house? 🏠

Q14-KOS-2 (Bathroom):
ID: Kamar mandi *dalam* (en-suite) atau *luar* (shared) oke? 🚿
EN: *Private bathroom* (en-suite) or *shared bathroom* is okay? 🚿

Q14-KOS-3 (Payment period):
ID: Untuk pembayaran kos, prefer *harian*, *mingguan*, *bulanan*, atau *tahunan*? 💳
EN: For payment, do you prefer *daily*, *weekly*, *monthly*, or *annual*? 💳
```

#### Hotel / Kondotel (sewa = booking)

```
Check-in date → Check-out date → Room type (Standard/Deluxe/Suite/Family) → Breakfast included?
```

#### Villa (sewa)

```
Rental period (per malam / minggu / bulan) → Private pool? → Check-in date
```

#### Kantor / Office

```
Q14-OFF-1 (Headcount → infer m²):
ID: Berapa orang yang akan bekerja di kantor ini? (untuk tentukan luas & grade gedung) 👥
EN: How many people will work in this office? (to determine size & building grade) 👥
Note: Infer area at ~5–7 m²/person.

Q14-OFF-2 (Building grade):
ID: Preferensi gedung *Grade A* (premium), *Grade B* (mid), atau *Grade C* (ekonomis)? 🏢
EN: Preference: *Grade A* (premium), *Grade B* (mid), or *Grade C* (economy) building? 🏢

Q14-OFF-3 (Fit-out condition):
ID: Kondisi ruang yang diinginkan: *fitted out* (siap pakai, tinggal kerja) atau *bare shell* (bangun interior sendiri)? 🏢
EN: Office condition: *fitted out* (move-in ready) or *bare shell* (build your own interior)? 🏢
```

#### Gudang / Warehouse

```
Q14-WH-1 (Purpose):
ID: Gudangnya untuk apa — *produksi*, *distribusi*, atau *penyimpanan*? 📦
EN: What is the warehouse for — *production*, *distribution*, or *storage*? 📦

Q14-WH-2 (Ceiling height):
ID: Tinggi langit-langit dibutuhkan berapa meter? (penting untuk penyimpanan bertingkat & forklift) 📏
EN: What ceiling height is needed? (important for stacked storage & forklift use) 📏

Q14-WH-3 (Loading dock):
ID: Perlu berapa *loading dock*? Dan akses forklift di dalam? 🚛
EN: How many *loading docks* are needed? And forklift access inside? 🚛

Q14-WH-4 (Beli only — zonasi):
ID: Perlu pengecekan legalitas *zona industri/pergudangan* sebelum deal? 📋
EN: Should we verify the *industrial/warehouse zoning* legality before the deal? 📋
```

#### Ruko / Shophouse

```
Q14-RUKO-1: Bisnis apa yang akan dijalankan di sana? 🏪
Q14-RUKO-2 (beli): Prefer ruko *kosong* atau yang sudah ada *tenant* berjalan? (tenant existing = langsung cashflow)
```

#### Toko / Store

```
Q14-TOKO-1: Bisnis apa yang akan dibuka? Dan prefer di *mal/pusat perbelanjaan* atau *standalone*? 🛍️
Q14-TOKO-2 (beli): Prefer unit *mal prime* (stabil) atau *trade center* (yield lebih tinggi)?
```

#### Kondotel (beli = investasi)

```
Q14-KONDO-1: Target ROI per tahun berapa? (contoh: 7%, 10%) 📈
Q14-KONDO-2: Tipe unit paling laku: *Studio* atau *1 kamar* biasanya ROI terbaik 🛏️
```

#### Mansion

```
Q14-MANSION: Wajib ada *private pool*? (hampir selalu standar mansion premium) 🏊
```

#### Properti Lainnya (Others)

```
Q14-OTHER-1: Properti ini rencananya untuk tujuan apa? (parkir, event, pertanian, pabrik, klinik, dll) 🏗️
Q14-OTHER-2 (beli): Perlu pengecekan *sertifikat (SHM)* dan *zonasi* sebelum deal? 📋
```

---

### Q_KPR — Financing (beli only)

```
ID: Untuk pembeliannya, rencana pakai *KPR* atau *cash*? 💳
EN: For the purchase, are you planning *mortgage (KPR)* or *cash*? 💳
```

**Payment method variants to detect and acknowledge:**

| Customer says | Method stored | Follow-up |
|---|---|---|
| `cash`, `tunai`, `cash keras` | Cash | No follow-up |
| `kpr`, `kredit`, `cicil` | KPR Komersial | Ask Q_KPR-a (bank + DP) |
| `kpr syariah`, `murabahah`, `syariah` | KPR Syariah | Ask Q_KPR-a (bank + DP) |
| `subsidi`, `flpp`, `kpr subsidi` | KPR Subsidi (FLPP) | Note DP rendah, ada income limit |
| `kombinasi`, `cash + kpr` | Kombinasi | Ask Q_KPR-a |
| `cash bertahap`, `nyicil ke developer` | Developer in-house | Note terms/DP |
| `tanpa dp`, `dp 0%` | Zero DP (promo) | Confirm program |

**Q_KPR-a (if KPR/kombinasi/syariah):**
```
ID: Sudah ada gambaran bank yang dituju, atau perlu saya bantu rekomendasikan?
    Dan DP-nya kira-kira berapa persen yang disiapkan? 🏦
EN: Do you have a preferred bank, or would you like a recommendation?
    And roughly what DP percentage are you preparing? 🏦
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
✓ Budget: *[nilai dari Q3 — angka + satuan uang]* (terkonfirmasi nanti) — HANYA jika ✅
✓ Durasi: *[nilai dari Q10 — mis. "2 minggu", "6 bulan", "1 tahun"]* — HANYA jika ✅ (sewa)
✓ Masuk: *[nilai dari Q8]* — HANYA jika ✅
✓ Keputusan bersama: *[nilai dari Q9]* — HANYA jika ✅
✓ Furnitur: *[nilai dari Q11]* — HANYA jika ✅
✓ Fasilitas: *[amenities spesifik customer]* — jika customer minta fasilitas tertentu (specific request)
✗ Fasilitas: *[daftar standar] (Fasilitas standar)* — jika customer jawab "standar/biasa/terserah/apa saja"
✗ Fasilitas: *(Belum ditanyakan)* — jika Q_FAC belum pernah ditanyakan AI di sesi ini
✓ Patokan: *[nilai dari Q6 — nilai PERSIS dari QUALIFICATION STATE]* — HANYA jika ✅
✓ Area alternatif: *[nilai dari Q7]* — HANYA jika ✅
✓ Viewing: *[jadwal viewing — mis. "Besok siang jam 1" / "Survey dijadwalkan: besok" / "Minta listing"]* — WAJIB ada jika jadwal sudah dikonfirmasi (hari/jam); omit jika belum pernah dibahas

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
- **⛔ DILARANG KERAS: Jangan tulis nilai referensi-silang seperti "Disebutkan di Q4", "Sudah dijawab", "Lihat Q8", atau menunjuk nomor pertanyaan lain.** Sebuah field hanya boleh berisi nilai KONKRET dari baris ✅-nya sendiri di QUALIFICATION STATE. Jika `Keputusan [Q9]` masih ❓ (mis. customer hanya menjawab soal jadwal survei, bukan siapa pengambil keputusan), JANGAN tandai ✓ — tanyakan Q9 lebih dulu, atau (mode summary house) tampilkan `✗ Keputusan bersama: (Belum ditanyakan)`. Jawaban tentang waktu/jadwal survei ("besok lusa saya bisa survei") BUKAN jawaban Q9.
- **⛔ Budget BUKAN nomor lantai/tower.** Jawaban Q12 seperti "lantai 15-20", "lt 27", "tower 3" adalah preferensi lantai — JANGAN pernah ditulis sebagai `✓ Budget: 15-20`. Budget hanya angka dengan satuan UANG (juta/ribu/miliar/Rp). Jika customer sudah memberi budget asli sebelumnya (mis. "1-1.6 juta/minggu"), pertahankan nilai itu — jangan timpa dengan angka lantai.
- **✓ Durasi (Q10) mencakup SEMUA satuan**, bukan hanya tahun: "2 minggu", "10 hari", "6 bulan", "1 tahun" semuanya valid. Jika customer menyebut durasi di awal ("butuh sewa 2 minggu") walau belum ditanya Q10, tetap catat di `✓ Durasi`.
- **✓ Viewing (Q9/Q9b/Q9c)**: lima kemungkinan label — (a) tidak mau survei/katalog saja → `*Minta listing*`; (b) mau viewing tapi koordinasi dulu → `*koordinasikan sama teman (Belum ditanyakan)*`; (c) AI sudah tanya tanggal, customer sudah jawab → `*Survey dijadwalkan: [hari/tanggal]*`; (d) AI sudah tanya tapi belum ada tanggal → `*Mau viewing (tanggal belum dikonfirmasi)*`; **(e) AI tanya jam viewing → customer jawab jam → gabung jam+waktu+tanggal:** jika hari adalah tanggal konkret (mis. "9 Juli 2026"), format `*Jam 7 pagi, 9 Juli 2026*`; jika hari relatif (besok/lusa), format `*Besok siang jam 1*` ← **WAJIB ada di summary!** Jika tidak disebut sama sekali → omit.
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

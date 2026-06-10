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
After a summary brief is sent, Q answers from *before* that summary are **stale** — they belong to the completed search. The backend's Phase 0 finds `activeSessionStart` (the first customer message after the last summary) and scans only `ACTIVE_ALL = history.slice(activeStart)` for Q1–Q12 content in Phase 1 (content scan), Phase 2 (AI→Customer pair matching), and Phase 3B (type-change detection).

This prevents old session answers from polluting the current search's QUALIFICATION STATE.

**Example:** Customer answered Q4 = "bersama istri" in a villa search → summary was sent → customer now searches for apartment. Phase 1 scans ACTIVE_ALL only (starting from the apartment search), so "bersama istri" is NOT picked up. Q4 correctly shows ❓ in the new search.

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
    Kami punya: *rumah, apartemen, villa, kos-kosan, ruko, kantor, gudang*, dan banyak lagi 🏡
```

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
ID: Di *[area]* kami ada *[Tipe]* yang di kisaran *[LOW]* dan ada juga yang *[HIGH]*.
    Kira-kira yang mana lebih sesuai dengan rencana Bapak/Ibu?

EN: In *[area]* we have *[Type]* options around *[LOW]* and others around *[HIGH]*.
    Which range feels closer to your plans?
```

**If no price data available:**
```
ID: Untuk *[Tipe]* di *[area]* — apakah lebih prefer yang *terjangkau/ekonomis*
    atau yang *menengah ke atas*? 💰
```

**Accepted affordability answers** (treat as budget=affordable, stop asking):
`terjangkau`, `murah`, `yang paling murah`, `ekonomis`, `affordable`, `hemat`, `low budget`

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

---

### Q6 — Anchor Point *(only if not captured in Q2b)*

```
ID: Ada lokasi tertentu yang jadi patokan?
    Misalnya dekat sekolah anak, kantor, atau mall tertentu?
EN: Is there a specific landmark you want to be near?
    For example: near a school, office, or mall?
```

**Customer answer can be ANY landmark — accept all of these:**
- `dekat pasar`, `dekat pasar besar`, `dekat Atom`
- `dekat cafe`, `dekat Food Junction`, `dekat restoran X`
- `di jalan Dukuh Kupang`, `di sekitar jalan Ahmad Yani`
- `dekat stasiun`, `dekat terminal`, `dekat pelabuhan`, `dekat bandara`
- `dekat pabrik`, `dekat PT Jaya Putra`, `dekat kantor X`
- Any answer with a leading `dekat / deket / near / di jalan / di sekitar / samping`

**Server-side note:** The keyword filter bypasses its CLEAR_NON_PROPERTY blocklist (which contains "cafe", "restoran", etc.) when the message starts with a landmark prefix (`dekat`, `near`, `di jalan`, etc.). This ensures "dekat cafe" is never blocked as off-topic.

---

### Q7 — Alternative Areas *(always ask unless already volunteered)*

```
ID: Selain *[area yang disebutkan]*, area sekitar yang masih oke?
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

---

### Q10 — Lease Duration *(rent only, if not volunteered)*

```
ID: Rencananya sewa untuk berapa lama?
EN: How long are you planning to rent?
```

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

## Property Type / Transaction Change Reset

There are **two distinct scenarios** — the server handles them differently:

---

### Case A — Building Type Change *(villa→rumah, villa→apartment, etc.)*

**Trigger:** Customer switches to a **different property type** (house, villa, apartment, hotel, kos, ruko, office, warehouse).

**Server-side behavior (automatic):**
```javascript
state.typeChangedFromHistory = true
// resets Q2–Q12: location, budget, household, redFlags, anchorPoint,
//   alternativeAreas, moveInDate, decisionMaker, leaseDuration, furnishing, apartmentPref
```

`buildQualificationStateBlock()` injects a visible banner:
```
⚠️  TIPE PROPERTI BERUBAH — Customer beralih ke jenis properti baru.
   Q2-Q12 di-RESET. Akui perubahan singkat (1 kalimat), lanjut dari Q terkecil ❓.
```

**AI response when this banner is present:**
1. Acknowledge the change in **one sentence** — e.g., "Oke, kita alihkan ke rumah sewa ya 😊"
2. Ask the **smallest-numbered ❓ question** for the new type (usually Q2 — location)
3. Do NOT carry over old Q2–Q12 answers from the previous type

**Example:**
```
[Previous] Customer: mau sewa villa di Surabaya
[Previous] AI:       Budget villa sekitar 5–10 jt atau 15–25 jt?
[Previous] Customer: yang 5-10 jt aja
...
[Now]      Customer: eh maaf, maksud saya mau sewa rumah bukan villa
[Now]      AI:       Oke, kita alihkan ke rumah sewa ya 😊 Di kota atau area mana yang Anda inginkan?
```

---

### Case B — TX-Only Change *(beli gudang → sewa gudang; same building type)*

**Trigger:** Customer changes **only the transaction type** (beli ↔ sewa) while the **building type stays the same**.

**Server-side behavior (automatic):**
```javascript
state.transactionType = curTx   // quietly updated to new tx
// NO Q2–Q12 reset — location, household, budget, etc. remain valid
// NO banner injected into the prompt
```

**AI response:** Continue the qualification flow from where it left off. Q2–Q12 answers are still valid — only the transaction type changed.

**Example:**
```
[Previous] Customer: mau beli gudang di Malang
[Previous] AI:       Budget gudang di Malang sekitar 500 jt atau 1–2 M?
[Previous] Customer: yang 500 jt aja
...
[Now]      Customer: eh, saya mau sewa aja bukan beli
[Now]      AI:       Siap, kita ubah ke gudang *sewa* ya 😊 Rencananya masuk bulan apa?
           (continues from the next unanswered Q — location was already set)
```

---

**History preservation (both cases):**
- All previous messages remain in the database and session history
- The reset is **logical only** — the AI reads full history for context but treats old type-specific answers as stale
- History is preserved **as long as the cookie/session is active**

---

## After Summary Brief

Once the structured brief has been sent, the QUALIFICATION STATE will include the banner:
```
⚠️  SUMMARY SUDAH DIKIRIM — Customer memulai pencarian baru.
   RESET PENUH ke Q1. Tanyakan dari awal: sewa/beli dan tipe propertinya.
   JANGAN tampilkan summary lagi sampai semua Q wajib terjawab ulang.
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
║  Tanyakan: "Selain *Surabaya*, area sekitar yang masih oke? 🗺️"
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

Customer responses to Q9 are **normalized server-side** before being stored in the qualification state. The AI does not need to interpret the raw response — it copies the normalized value.

| Customer answer | Stored as |
|---|---|
| "saya yang ambil keputusan", "saya sendiri yang memutuskan" | `Solo — customer yang memutuskan sendiri` |
| "langsung bisa viewing" | `Solo — customer yang memutuskan sendiri` |
| "perlu koordinasi sama istri/suami" | `Koordinasi dengan pasangan` |
| "perlu tanya orang tua dulu" | `Koordinasi dengan orang tua` |
| "perlu tanya keluarga" | `Koordinasi dengan keluarga` |
| Other | Raw customer response |

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
          Di Malang kami ada Villa sekitar 3–5 juta/bulan dan ada yang 8–15 juta/bulan.
          Kira-kira yang mana lebih sesuai?

Customer: yang 3-5 juta aja
AI:       [budget set → all 4 fields present → proceed to listing or next mode behavior]
```

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

## Summary Brief (Mode OFF — after mandatory questions complete)

Show when ALL of these are answered: Q1 (tx), building type, location, Q3 (budget), Q8 (date),
Q4 or Q9 (household/decision), Q7 (alternative areas).

```
Baik, permintaan utama Anda sudah saya catat, sebagai berikut 📝 🔥

✓ Rencana: *[sewa/beli]*
✓ Tipe: *[building type]*
✓ Lokasi: *[location]*
✓ Budget: *[amount]* (terkonfirmasi nanti)
✓ Masuk: *[move-in month]*
✓ Keputusan bersama: *[solo / joint]*
✓ Furnitur: *[preference]*
✓ Area alternatif: *[areas]*

Saya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠 Apabila ada pertanyaan lagi, silahkan hubungi saya kembali.
Terima kasih sudah menghubungi saya. 🙏
```

- Fields marked "inferred" = agent will reconfirm.
- Fields showing "UNKNOWN" = agent must ask during follow-up.
- Max 12 AI messages before showing brief, even if incomplete.

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

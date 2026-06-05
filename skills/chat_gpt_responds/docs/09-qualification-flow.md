# 09 — Customer Qualification Flow (Q0–Q12)

## Philosophy

Before presenting a property list, qualify the customer's needs through targeted
questions. This surfaces the information needed to give a genuinely useful recommendation,
rather than an overwhelming catalog dump.

The flow is **adaptive**: skip any question whose answer is already known from the
conversation. Stop qualifying once enough is known and switch to listing mode.

---

## Trigger: Qualification vs Listing

### Show listing immediately when ANY of these is true:

| Trigger | Example |
|---------|---------|
| Customer explicitly requests a list | "kasih daftarnya", "tampilkan", "rekomendasikan", "show me", "what do you have" |
| All 3 key signals known (tx + type + location) | "saya mau sewa rumah di malang" → readiness = 3 |
| AI has already asked 4+ qualification questions | Prevent customer frustration |

### Continue qualifying when:

- Readiness score < 3 (missing at least one of: transaction, type, or location)
- Customer has not requested a list
- AI has asked fewer than 4 questions

---

## Readiness Score

Each known signal adds 1 point:

| Signal | Score |
|--------|-------|
| transactionType (sewa / beli) | +1 |
| buildingType (house / apartment / hotel / …) | +1 |
| location (malang / surabaya / …) | +1 |
| budget | +1 |
| move-in date | +1 |

**Threshold: ≥ 3 → show listing.**

---

## Question Sequence

Questions fire in this order. Each fires only once and only if the answer is
not already known from the conversation history.

---

### Q0/Q1 — Transaction Type + Property Type

**Fires when:** Both transaction type AND property type are unknown.

```
ID: Halo! 😊 Saya siap bantu carikan properti yang cocok untuk Anda.
    Boleh saya tanya dulu — Anda sedang cari untuk *sewa* atau *beli*?
    Dan tipe properti apa yang diinginkan?
    Kami punya: *rumah, apartemen, villa, kos-kosan, ruko, kantor, gudang*, dan banyak lagi 🏡

EN: Hello! 😊 I'm here to help you find the right property.
    May I ask first — are you looking to *rent* or *buy*?
    And what type of property do you have in mind?
    We have: *house, apartment, villa, boarding house, shophouse, office, warehouse*, and more 🏡
```

---

### Q1 — Transaction Type only

**Fires when:** Transaction type unknown, property type known.

```
ID: Untuk *[Tipe]* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠
EN: For the *[Type]* you're looking for — are you planning to *rent* or *buy*? 🏠
```

---

### Q0b — Property Type only

**Fires when:** Property type unknown, transaction type known.

```
ID: Oke, mau *[sewa/beli]* properti. Tipe apa yang Anda cari? 🏡
    Kami punya: *rumah, apartemen, villa, kos-kosan, ruko, kantor, gudang*, dan banyak pilihan lainnya.

EN: Got it, looking to *[rent/buy]* a property. What type are you looking for? 🏡
    We have: *house, apartment, villa, boarding house, shophouse, office, warehouse*, and many more.
```

---

### Q2 — Location

**Fires when:** Location unknown.

```
ID: Oke, mau *[sewa/beli] [Tipe]*. 📍 Di kota atau area mana yang Anda pertimbangkan?
EN: Got it, looking to *[rent/buy] a [Type]*. 📍 Which city or area are you considering?
```

---

### Q2b — Search History *(Highest-value question)*

**Fires when:** Location known, this question not yet asked, AI asked ≤ 3 times.

This is the single most valuable question — it surfaces red flags, decision
maker signals, urgency level, and budget ceiling in one response.

```
ID: Sudah lihat berapa properti di *[kota]*? Apa yang membuat belum cocok dari yang sudah dilihat?
EN: How many properties have you seen in *[city]*? What hasn't quite worked about the ones you've viewed?
```

---

### Q3 — Budget *(NEVER ask directly — use two price anchors)*

**Fires when:** Budget unknown, location known.

Show two contrasting options from the catalog. The customer's reaction
reveals their real budget without ever asking a direct figure.

```
ID: Di *[kota]* kami ada yang di kisaran *[LOW]* dan ada yang *[HIGH]*.
    Kira-kira yang mana lebih sesuai dengan rencana Anda?

EN: In *[city]* we have options around *[LOW]* and others around *[HIGH]*.
    Which range feels closer to your plans?
```

If no price anchors available:

```
ID: Di *[kota]* kami punya pilihan dengan berbagai kisaran harga.
    Apakah Anda lebih prefer yang *terjangkau/ekonomis* atau yang *menengah ke atas*? 💰
EN: In *[city]* we have options across different price ranges.
    Do you prefer something more *affordable/economy* or *mid-to-premium range*? 💰
```

---

### Q8 — Move-in Date *(MANDATORY — never skipped)*

**Fires when:** Move-in date not yet mentioned in any message.

```
ID: Rencananya masuk atau pindah bulan apa? 📅
EN: What month are you planning to move in? 📅
```

**Special rule:** If this question was not asked during qualification (e.g., listing was
triggered early), append it **inside** the listing response before the signature:

```
ID: Omong-omong, rencananya masuk atau pindah bulan apa? 📅
EN: By the way, what month are you planning to move in? 📅
```

---

### Q4 — Household Composition *(infers bedroom count + decision maker)*

**Fires when:** Household info not mentioned.

```
ID: Nanti akan tinggal bersama siapa saja?
    Biar saya bisa carikan yang pas jumlah kamarnya 🛏️

EN: Who will be living there with you?
    That helps me find the right number of bedrooms 🛏️
```

*Why this matters:* If spouse or parents are mentioned → joint decision.
If alone → faster decision. Bedroom count inferred without asking directly.

---

### Q11 — Furnishing Preference *(rental only)*

**Fires when:** Renting, furnishing preference not stated.

```
ID: Untuk furnitur, lebih prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan* saja? 🛋️
EN: For furnishing, do you prefer *fully furnished*, *semi-furnished*, or *unfurnished*? 🛋️
```

---

### Q5 — Red Flags *(if not surfaced in Q2b)*

**Fires when:** Red flags not captured, recommended as a late question.

```
ID: Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai,
    gang sempit, atau rumah tua?
EN: Is there anything you definitely want to avoid? Such as west-facing,
    near a busy road, narrow alleys, or older buildings?
```

---

### Q7 — Alternative Areas *(unless already volunteered)*

**Fires when:** Customer has not mentioned alternative areas.

```
ID: Selain *[area yang disebutkan]*, area sekitar yang masih oke?
EN: Besides *[mentioned area]*, are there other nearby areas you'd consider?
```

---

### Q9 — Decision Maker / Viewing Logistics *(indirect)*

**Fires when:** Decision maker not established.

Never ask "siapa yang memutuskan" directly. Use indirect phrasing:

```
ID: Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau
    perlu koordinasi dulu sama keluarga lain?
EN: If something looks good, can you schedule a viewing directly or
    would you need to check with family first?
```

*Interpretation:* "Langsung bisa" → solo decision → higher urgency signal.

---

### Q10 — Lease Duration *(sewa only, if duration not volunteered)*

**Fires when:** Transaction = rent, duration not mentioned.

```
ID: Rencananya sewa untuk berapa lama?
EN: How long are you planning to rent?
```

#### Q10a — Payment Terms *(fires when lease ≥ 1 year)*

```
ID: Untuk pembayaran, biasanya lebih cocok bayar di muka penuh
    atau ada yang bisa cicil?
EN: For payment, do you prefer paying the full amount upfront
    or would installment options work better?
```

---

### Q12 — Apartment-Specific *(type = apartment only)*

**Fires when:** Property type is apartment.

```
ID: Untuk apartemen, ada preferensi tower tertentu atau lantai berapa?
    (Lantai tinggi biasanya lebih tenang, lantai rendah lebih mudah akses)
EN: For apartments, do you have a preference for a specific tower or floor?
    (Higher floors tend to be quieter, lower floors are easier to access)
```

---

## Skip Conditions

A question is skipped if:

- Its answer is already present in customer messages (any turn)
- The AI already asked it in a previous turn
- Readiness score ≥ 3 (switch to listing mode)
- Customer has explicitly requested a listing

---

## Example Conversation

```
Customer  : Halo saya cari properti
AI (Q0/Q1): Halo! 😊 Mau sewa atau beli? Dan tipe apa? Kami punya rumah, apartemen, villa...
Customer  : mau sewa rumah
AI (Q2)   : Oke, sewa rumah. Di kota atau area mana?
Customer  : di surabaya
AI        : [readiness = 3] → SHOW LISTING (houses in Surabaya)
            + Q8 appended: "Omong-omong, rencananya masuk bulan apa? 📅"
```

```
Customer  : saya mau sewa rumah di malang, budget 2-5 juta
AI        : [readiness = 4, wantsListing=false] → SHOW LISTING
            (houses in Malang sorted cheapest first)
            + Q8 appended
```

```
Customer  : kasih rekomendasinya dong
AI        : [wantsListingNow = true] → SHOW LISTING IMMEDIATELY
            (regardless of readiness score)
```

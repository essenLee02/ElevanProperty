# 14 — Intent Detection, Ambiguity Diagnosis & Per-Condition Response

This doc is the **diagnostic layer**: how the assistant (`${agentName}`) figures out *which property type and which transaction type* the customer is talking about, resolves ambiguity, and adapts the response to the customer's emotional/communication state. Use it together with [09 — Qualification Flow] and [11 — Property-Type Conversation Patterns].

---

## 1. Intent Classification — Read Type + Transaction First

On **every** message, the server extracts `buildingType` + `transactionType` (server-side `detectBuildingType` / `detectTransactionType`). The AI must always be aware of the **currently-detected pair** and keep the whole conversation focused on it.

### Property-type keyword map (12 categories)

| Customer says | `buildingType` |
|---|---|
| rumah, house, home, kontrakan, hunian, residential | `house` |
| apartemen, apartment, apart, unit | `apartment` |
| hotel, penginapan, motel | `hotel` |
| villa, vila | `villa` |
| kos, kost, kosan, indekos, boarding house | `boarding_house` |
| ruko, rukan, shophouse | `shophouse` |
| toko, store, retail, kios | `store` |
| kantor, office, co-working | `office` |
| gudang, warehouse, logistik | `warehouse` |
| mansion, rumah mewah | `mansion` |
| kondotel, condotel, condo hotel | `kondotel` |
| tanah, kavling, lahan, SPBU, pabrik, klinik, dll | `others` |

**Detection-order traps (already handled server-side, but the AI must respect the result):**
- `kondotel` / `condo hotel` → `kondotel`, **never** `hotel` or `apartment`
- `rumah mewah` → `mansion`, **never** `house`
- `toko` → `store`; `ruko` → `shophouse` — these are different (toko = retail unit in mall/standalone; ruko = standalone multi-floor building)
- `warehouse`/`shophouse` contain the substring "house" — they are **not** `house`

### Transaction-type keyword map

| Customer says | `transactionType` | Note |
|---|---|---|
| sewa, kontrak, ngontrak, nyewa, rental, per bulan/tahun | `rent` | — |
| beli, membeli, KPR, cicil, investasi, purchase | `sale` | "beli" = buyer intent = `sale` catalog entry |
| jual, dijual, sell | `sale` | — |

**Booking frame:** for `hotel`, `villa`, `kondotel`, a `rent` transaction means **booking per malam** (check-in/out, room type, breakfast), not a monthly lease. Switch the Q14 flow accordingly (see [10]).

---

## 2. Ambiguity Diagnosis — Clarify Before Assuming

When type or transaction is **unclear or missing**, ask ONE targeted clarifier. Never guess silently.

| Situation | Diagnostic question |
|---|---|
| Type known, transaction missing | "Untuk *[tipe]* ini — rencananya mau *disewa* atau *dibeli*? 🏠" |
| Transaction known, type missing | "Oke, mau *[sewa/beli]*. Tipe propertinya apa? Rumah, apartemen, ruko, kantor, gudang, atau lainnya?" |
| "mau cari tempat usaha" (commercial unclear) | "Tempat usahanya berupa apa? *Toko*, *ruko*, *kantor*, atau *gudang*?" |
| "mau sewa kamar" (kos vs apart) | "Kamarnya dalam bentuk *kos-kosan* atau *unit apartemen*?" |
| "kondotel vs apartemen" confusion | Jelaskan singkat: "Kondotel itu unit seperti apartemen tapi dikelola hotel — bisa disewakan harian lewat operator. Apartemen biasa lebih untuk hunian/sewa bulanan." → lalu tanya mana yang dimaksud |
| "rumah mewah / mansion?" | Jika budget sewa >5 jt/bln atau beli >3 M dan minta pool/smart home → arahkan ke `mansion` flow |
| "tempat nginap di Bali" | "Lebih prefer *hotel*, *villa private*, atau *kondotel*?" |

**Edge rule — landmark ≠ type:** "deket kantor", "dekat toko", "dekat pasar" adalah **patokan lokasi (Q6)**, BUKAN tipe properti. Jangan ganti `buildingType` karena kata-kata ini muncul setelah "dekat/deket/near".

**Edge rule — "kisaran" ≠ kota:** Kata *kisaran* dalam bahasa Indonesia = "sekitar / range / approximately". Ini adalah kata budget, bukan nama kota. Jika customer berkata "harganya kisaran 3-6juta/minggu", "kisaran" adalah ekspresi budget — **BUKAN** lokasi "Kisaran" (kota di Sumatra Utara). Lokasi customer HANYA dari field ✅ Lokasi [Q2] di QUALIFICATION STATE block — jangan override dengan kata "kisaran" dari pesan customer.

**Edge rule — budget period per minggu:** "3-6juta/minggu", "2-4 juta per minggu", "seminggu" = satuan mingguan. Server akan mendeteksi ini sebagai budget `/minggu`. Untuk villa di Bali/Surabaya biasanya disewa harian atau mingguan — ini normal, bukan per bulan.

---

## 3. Topic-Change Diagnosis → Reset to Q1

Three dimensions anchor every search. Changing ANY ONE of them restarts from Q1:

| Dimension changed | Example trigger | Required AI action |
|---|---|---|
| Building type | "eh mau hotel aja, bukan villa" | Acknowledge 1 sentence → ask Q1 (sewa/beli?) for new type |
| Transaction type | "bukan beli, mau sewa aja" | Acknowledge → ask Q1 |
| **City/location** | "tadinya Surabaya, mau Bali aja" | Acknowledge → ask Q1 |

**Rule for ALL three cases:**
1. Acknowledge in ONE sentence: "Siap, saya alihkan ke *[baru]* ya 😊"
2. Ask Q1 (sewa/beli?) for the new context — unless the answer was already in the trigger message
3. Discard ALL old Q2–Q12 answers — they described the old search
4. **Never** show a summary on the change turn

**If new type/tx/city is already in the trigger message**, skip asking for it and ask the next missing field:
```
Customer : eh mau sewa villa di Bali aja (type=villa, tx=rent, city=Bali all in one)
AI       : Siap, saya alihkan ke villa sewa di Bali ya 😊 Budget/minggu kisaran berapa?
           ↑ Q1(tx)=rent ✅, Q1(type)=villa ✅, Q2(city)=Bali ✅ → jump to Q3
```

See [11 — Topic Change Rule] for more examples.

---

## 4. Per-Condition Response Intelligence

Detect the customer's communication/emotional state and adapt. ONE question per message always holds.

### 4.1 Malas ketik / chat singkat (≤5 words, no punctuation)
Cut questions to 2–3 words; extract ALL signals silently before asking.

```
Customer: sewa rmh sby barat 3kt
AI: Budget/bulan?
Customer: 8-10jt
AI: Kapan masuk?
Customer: juli
AI: Siap! Rumah 3KT Surabaya Barat sewa 8–10 jt/bln, masuk Juli. Saya carikan sekarang 🔍
```

**Lazy answer recognition table:**
| Last AI question | Lazy customer answer | What it means |
|---|---|---|
| "Sewa atau beli?" | `sewa` / `beli` / `rent` | Q1 = transactionType |
| "Di kota mana?" | `malang` / `bali` / `sby` | Q2 = location |
| "Budget?" | `5jt` / `8-10jt` / `murah` | Q3 = budget |
| "Sama siapa?" | `sendiri` / `sama istri` / `4 org` | Q4 = household |
| "Ada yang gak cocok?" | `gak ada` / `bebas` / `terserah` | Q5 = no red flags |
| "Furnished?" | `isi` / `semi` / `kosongan` | Q11 = furnishing |
| "Kapan masuk?" | `juli` / `bulan depan` / `asap` | Q8 = moveInDate |
| "Boleh area lain?" | `boleh` / `gak usah` / `ya` | Q7 = alternative areas |

**Rule:** if the answer matches the open question → accept it, don't ask for clarification.

### 4.2 Info terbatas / ambigu ("yang bagus", "yang strategis", "yang nyaman")
Convert the vague word into 2–3 concrete choices. Never reject the vague answer.

```
Customer: yang strategis aja
AI: Strategis untuk Anda lebih ke: dekat kantor/kampus, dekat fasilitas umum, atau akses transportasi mudah? 😊

Customer: yang nyaman
AI: Nyaman yang paling penting: lingkungan tenang, fasilitas lengkap (gym/kolam), atau area sekitar yang ramai tapi aman? 😊

Customer: yang terjangkau aja / yang murah
AI: Oke, untuk [tipe] di [kota] ada pilihan sekitar [LOW] dan yang lebih terjangkau di [LOWER]. Mana yang lebih sesuai?
```

**Vague budget rule:** "yang terjangkau", "yang murah", "sesuai budget" = Q3 answered. Use it as a budget signal, offer 2 anchor prices, don't keep probing for exact numbers.

### 4.3 Marah / frustrasi ("capek", "sudah N bulan", "gak ada yang bantu")
**Validate emotion FIRST (1 sentence), then ask.** Never jump straight to a slot question.
```
Customer: Sudah 4 bulan cari, gak ada yang cocok!
AI: Wah, 4 bulan itu benar-benar melelahkan ya 😔 Dari sini saya bantu lebih serius. Dari yang sudah dilihat, apa yang paling sering bikin belum cocok?
```

### 4.4 Tanya harga duluan
Give an informative range FIRST, then gather needs. Don't dodge the price question.
```
Customer: Apartemen di Jakarta berapa per bulan?
AI: Bervariasi 😊 Studio mulai 3–4 jt, 1 kamar 5–10 jt, 2 kamar 8–18 jt/bln. Biar lebih pas — areanya di Jakarta mana?
```

### 4.5 Ganti-ganti keputusan ("tadinya... tapi", "hmm", "mungkin")
Anchor to the **latest** choice. If it's a same-city area change → offer to compare. If it's a CITY, TYPE, or TX change → acknowledge + full Q1 reset.

```
Customer: Tadinya Surabaya Barat, tapi Timur lebih baik?    ← same city, area change only
AI: Keduanya punya kelebihan. Dari aktivitas sehari-hari Anda lebih sering ke arah mana? Kalau mau, saya carikan di keduanya untuk dibandingkan 😊

Customer: tadinya Surabaya, tapi kayaknya Bali lebih cocok   ← CITY CHANGE → Q1 reset
AI: Siap, saya alihkan ke Bali ya 😊 Untuk properti di Bali — rencananya mau *sewa* atau *beli*?
```

### 4.6 Tidak tahu yang mau / first-timer ("bingung", "saran dong", "pertama kali")
Act as a consultant. Ask vision-refining questions, not form fields.
```
Customer: mau beli properti tapi bingung mulai dari mana
AI: Tenang, wajar kok 😊 Yang paling menentukan dulu: propertinya untuk Anda tinggali sendiri, untuk investasi/disewakan, atau keduanya?
```

### 4.7 Jawaban ambigu yang sebenarnya menjawab pertanyaan AI
When a customer answers something that looks off-topic but IS a valid response to your last question — accept it, don't reject.

```
AI asked: "Fasilitas apa yang penting?"
Customer: "ada restoran sama bar lounge"     ← sounds like food, but it's a FACILITY ANSWER
AI: ✅ Fasilitas: restoran + bar lounge. Ada lagi? (gym, kolam renang, dll.)

AI asked: "Furnished atau tidak?"
Customer: "yang ada dapur sama kasur"        ← "dapur" = kitchen appliance, not cooking topic
AI: ✅ Semi furnished, dengan dapur + kasur. Kapan rencananya masuk?
```

**Golden rule:** if AI ASKED something, the customer's next reply is ALWAYS presumed to be answering that question — even if the words sound off-topic on their own.

### 4.8 Out-of-topic tanpa konteks properti (benar-benar tidak relevan)
Apply ONLY when: (a) you haven't recently asked any property question, AND (b) the message has zero property signal.

```
Customer [mid Q-flow]: btw bisa rekomendasiin restoran bagus di Bali?
AI: Maaf, saya fokus membantu properti ya 😊 Nah untuk villa Bali tadi — kapan rencananya check-in?
```

Redirect in ≤1 sentence, then RESUME from the last unanswered ❓. Never abandon Q-flow progress.

---

## 5. Signal Inference — Deduce, Don't Ask

Infer these from natural phrasing and adjust behaviour (do **not** ask them directly):

| Customer phrasing | Inferred signal | Behaviour change |
|---|---|---|
| "cash, siap transfer" | `is_urgent`, financing=cash | Expedite, prioritize ready units |
| "sudah KPR approval BCA" | financing=KPR, bank known | Skip financing question |
| "untuk disewakan" / "ROI" / "yield" | `is_investor` | Add yield/ROI framing, ask occupancy target |
| "untuk anak kuliah" | target=mahasiswa, budget ekonomis | Suggest near-campus, budget tier |
| "segera / minggu ini / darurat" | `is_urgent` | Prioritize immediate availability |
| "sama istri/suami", "keluarga" | joint decision | Phrase Q9 around koordinasi |
| "saya sendiri" / "sendirian" | solo decision, 1 KT | Skip bedroom + decision-maker questions |
| "bos yang bayar" / "perusahaan" | third-party decision | Expect slower close, may escalate |
| "ada 2 anak" | bedrooms ≈ 3 | Skip "berapa kamar?" |

---

## 6. Slot-Filling Discipline (Skip / Infer / Mandatory)

**SKIP** a question when its answer is already known or implied:

| Condition | Skip |
|---|---|
| "saya sendiri" | bedrooms (→ studio/1KT) |
| "istri + anak" | decision maker (→ joint) |
| hotel/villa/kondotel booking | furnishing (always furnished) |
| commercial (gudang/toko/ruko/kantor) | bedrooms, furnishing |
| customer already said cash/KPR | financing |
| lease < 1 year | payment terms |
| date already given | move-in date |

**INFER** before asking (see §5).

**MANDATORY — never skip:** `transactionType`, `buildingType`, `location`, `budget` (via two-option anchor), `move_in_date`.

**Max 3 empty slots before showing the first listing** (catalog mode); **max 12 AI messages before the summary brief** (summary mode).

---

## 7. Focus Invariant (the core of this doc)

> At any moment the conversation is about **exactly one** `(buildingType, transactionType)` pair. Every question, anchor price, Q14 slot, and summary line must belong to that pair. If the customer switches either dimension → acknowledge once, reset to Q1, and re-anchor everything to the new pair.

This is what keeps responses *accurate, relevant, and focused* across all 12 property types × 2 transactions.

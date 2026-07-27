# 04 — Qualification Flow (Q1–Q14) — MASTER

The authoritative question sequence, state model, and summary rules.
Everything else defers to this doc on *what* to ask and *when*.

**Philosophy:** guide discovery through **options, not interrogation**. Most customers arrive
vague — they don't know their exact budget or bedroom count. Use indirect questions that reveal
real needs from natural reactions.

---

## 1. Server-Side Machinery (what you receive)

### Pre-Qualification Gate

Before any AI token is spent, the backend checks four minimum fields from accumulated history:

```
① buildingType    — house / villa / apartment / …
② transactionType — sewa (rent) | beli → sale
③ location        — city or area
④ budget          — numeric range OR affordability preference
```

| `RESPOND_CATALOG_RUN` | Gate behaviour |
|---|---|
| `OFF` (summary) | Intercepts only when type, transaction **and** location are ALL missing (true cold start). If even one is known → the AI runs the flow naturally. |
| `ON` (summary + catalog) | Same gate, **same interview**. The only difference is what happens *after* the interview completes. |

**Budget is satisfied by** `terjangkau` / `murah` / `affordable` / `yang paling murah` — stop
asking for exact numbers once an affordability preference is stated.

### Qualification State Injector

The backend scans the active session (window = `AI_HISTORY_WINDOW`, default **60** messages) and
injects a checklist into **every** prompt:

```
╔══════════════════════════════════════════╗
║  📋 QUALIFICATION STATE                  ║
║  ✅ = SUDAH DIJAWAB → JANGAN TANYA LAGI  ║
║  ❓ = BELUM DIJAWAB → TANYAKAN BERIKUTNYA║
╚══════════════════════════════════════════╝

✅ Tipe transaksi    [Q1]: rent
✅ Tipe properti         : villa (fallback: apartment)
✅ Lokasi            [Q2]: Surabaya
✅ Riwayat pencarian[Q2b]: Sudah lihat 2, terlalu jauh dari pusat kota
✅ Budget            [Q3]: menengah
✅ Penghuni          [Q4]: 2 orang (bersama pasangan)
❓ Red flags         [Q5]: BELUM DIJAWAB
✅ Patokan lokasi    [Q6]: Deket indomaret, cafe dan ubaya
✅ Tanggal masuk ⚠️WAJIB [Q8]: 25 Agustus 2026
❓ Keputusan         [Q9]: BELUM DIJAWAB
❓ Durasi sewa      [Q10]: BELUM DIJAWAB
✅ Furnitur         [Q11]: semi-furnished
❓ Tower/Lantai     [Q12]: BELUM DIJAWAB
```

**The state block is the ONLY source of truth about what has been answered.** Even if a question
was answered 20 messages ago, the block reflects it. Ask only ❓ fields, lowest number first.

### ⚡ NEXT ACTION directive

At the bottom of every state block the server injects the authoritative next question:

```
╔══════════════════════════════════════════════════════════╗
║  ⚡ PERTANYAAN BERIKUTNYA: Q7                             ║
╠══════════════════════════════════════════════════════════╣
║  Tanyakan: "Selain lokasi *Surabaya*, apakah Anda mau     ║
║  pilihan lokasi lainnya? 🗺️"                              ║
╠══════════════════════════════════════════════════════════╣
║  ⛔ JANGAN tanya pertanyaan lain selain yang di atas.     ║
║  ⛔ JANGAN ulangi field yang sudah ✅ di atas.            ║
║  ⛔ ABAIKAN raw history — STATE BLOCK = satu-satunya      ║
║     sumber kebenaran tentang apa yang sudah dijawab.      ║
╚══════════════════════════════════════════════════════════╝
```

It is computed server-side and **overrides any conclusion you might draw from raw history**.
When everything is answered it becomes `✅ SEMUA Q WAJIB SUDAH DIJAWAB — Tampilkan summary brief sekarang.`

**Priority order:** Q1 → Q2 → Q2c → Q2b → Q3 → Q8 → Q4 → Q5 → Q6 → Q7 → Q9 → Q10 → Q11 →
Q_FAC → Q12 → Q14 → summary.

---

## 2. Session Boundaries (why old answers don't leak)

`activeSessionStart` is the **latest** of three boundaries; only `history.slice(activeStart)` is
scanned for Q-content:

1. **Summary boundary** — the first customer message after the last summary brief. Anything
   before belongs to a completed search.
2. **Type/transaction switch boundary** — the message where the customer switches building type
   (villa→hotel) **or** flips transaction (sewa→beli) **without a summary in between**. This is
   the abandoned-search case.
3. **Greeting-restart boundary** — a message opening with a greeting (`hi`, `halo`, `pagi`,
   `permisi`, …) **and** restating a property intent + type — **even if the type is the same**.
   A greeting + fresh intent means starting over.

> **⛔ Stale budget must never cross a boundary.** A numeric budget from an abandoned search
> (e.g. an old `0-1600000` awaiting unit clarification) is dropped when a new search starts. After
> *"Hi.. mau sewa apartemen di malang"* (no number), **never** ask "harga 0-1600000 maksudnya
> ribu/juta?" — that budget belonged to the old search. Re-ask Q3 by category. (A category budget
> like `menengah` has no digit and is preserved correctly.)

### The four triggers that reset to Q1

| Trigger | Example |
|---|---|
| Building type changes | "tadinya villa, sekarang mau hotel" |
| Transaction type flips | "eh bukan beli, mau sewa aja" |
| **City/location changes** | "tadinya Surabaya, tapi mau Bali aja" |
| Greeting + fresh intent | "Halo, mau cari apartemen" |

When any fires, the server sets `typeChangedFromHistory` and injects:
```
⚠️  TIPE PROPERTI BERUBAH — Customer beralih ke jenis properti baru.
   Q2-Q12 di-RESET. Akui perubahan singkat (1 kalimat), lanjut dari Q terkecil ❓.
```

**Your response:**
1. Acknowledge in **ONE** sentence — *"Oke, saya alihkan ke hotel ya 😊"*
2. Ask the **smallest ❓** (follow ⚡ NEXT ACTION — usually Q1 or Q2)
3. **Never** carry over old location/budget/date/furnishing/decision/duration
4. **Never** show a summary on the turn the change happens

> If the trigger message already contains the new type/tx/city, skip those and jump ahead:
> *"eh mau sewa villa di Bali aja"* → Q1 ✅, type ✅, Q2 ✅ → go straight to Q3.

**Why this matters:** without the switch boundary, a customer half-filling a villa search then
typing "Mau cari penyewaan hotel" would carry Surabaya / 26 Juni / furnishing into the hotel
search, and a stale AI question would mis-pair — storing `leaseDuration = "Mau cari penyewaan
hotel"` and producing a bogus summary.

### Session TTL

`CHATBOT_COOKIE_TTL_MINUTES` bounds the session. On expiry the backend creates a fresh session →
empty history → Q1 from scratch, regardless of prior state. **You'll see an all-❓ state block —
treat it as a brand-new customer.**

### Q1 non-property gate

If a customer's **very first** message has no property content, the backend deflects in one
sentence and never calls the AI. So if you *are* called on a first message, it already carries a
property signal — proceed with Q1 and extract what's there.

---

## 3. The Question Sequence

Fire **in order, ONE per message**. Skip anything already ✅.

### Q1 — Transaction Type

```
ID: Lagi cari untuk *sewa* atau *beli*? 🏠
EN: Are you looking to *rent* or *buy*? 🏠
```
If the property type is also unknown, combine:
```
Halo! 😊 Mau *sewa* atau *beli*? Dan tipe properti apa yang Anda cari?
Saya punya: *rumah, apartemen, villa, hotel, kos-kosan, ruko, kantor, gudang,
toko, mansion, kondotel*, dan banyak lagi 🏡
```

**Per-type framing** when the type is already known — acknowledge it specifically:

| Type | Transaction | Frame |
|---|---|---|
| Hotel / Kondotel | Sewa | **Booking frame**: check-in/out tanggal, tipe kamar, breakfast — never "sewa bulanan" |
| Kondotel | Beli | **Investment frame**: ROI, operator hotel, strata title |
| Villa | Sewa | Clarify the period FIRST: per malam / minggu / bulan |
| Villa | Beli | Personal use or investment? Private pool usually mandatory |
| Kos | Sewa | Practical: dekat kampus/kantor, putra/putri/campur |
| Gudang | Both | Luas m², kawasan industri, loading dock, daya listrik |
| Kantor | Sewa | Headcount first, CBD, grade A/B/C |
| Ruko | Both | Jenis bisnis, jumlah lantai, lebar frontage |
| Toko | Both | Mal vs standalone, foot traffic |
| Mansion | Both | Private pool, smart home, security |
| Rumah | Both | Bedrooms (via Q4), anchor, furnishing |
| Apartemen | Both | Tower/floor (Q12), view, facilities |
| Lainnya | Both | Tujuan penggunaan first |

> For hotel/kondotel sewa **never** ask "masuk bulan apa?" — ask a specific check-in date.

### Q1b — "Which is better?" comparison

When the customer names **two types** and asks which suits them — *"villa atau apartemen, lebih
cocok yang mana?"* — **answer first** with a brief recommendation (1–2 sentences), pick the more
suitable type, then qualify that type. **Do not ignore it and march into Q2b.**

| Signal | Recommend |
|---|---|
| Group ≥6, gathering, keluarga besar, many rooms | **Villa** |
| Short-stay/liburan, 1–4 orang | Hotel / kondotel |
| Solo/pasangan, urban, dekat transit, bulanan | **Apartemen** |
| Privasi + halaman + kolam pribadi | **Villa** |

```
Customer: "villa atau apartemen untuk 15 orang, 4 hari 3 malam di Malang?"
AI: "Untuk 15 orang dengan stay 4 hari 3 malam, *villa* jauh lebih cocok, Kak — kapasitas
     kamarnya besar dan ada ruang berkumpul. Saya fokuskan ke villa ya.
     Untuk villa di Malang, prefer yang terjangkau, menengah, atau eksklusif?"
```
Keep the other type as a fallback. **Do not loop on Q2b.**

### Q2 — Location

```
ID: Oke, mau *[sewa/beli] [Tipe]*. 📍 Di kota atau area mana yang Anda pertimbangkan?
EN: Got it, *[rent/buy] a [Type]*. 📍 Which city or area are you considering?
```

### Q2c — District within a large city

**Fires when** location is a large city (Surabaya, Jakarta, Bandung, Semarang, Makassar, Medan)
and no district was named. **Does not fire for** commercial types or hotel/kondotel booking.
**Fires BEFORE Q2b.**

```
Di area atau kawasan mana di *[kota]* yang Anda pertimbangkan? 📍
[3–4 contoh spesifik kota — lihat doc 13]
```

| Customer answers | Action |
|---|---|
| A specific area ("Pakuwon City") | ✅ store district → Q2b |
| District + anchor ("deket Grand City") | ✅ store both (anchor → Q6) |
| "Di mana saja oke" / "fleksibel" | ✅ answered (no constraint) → proceed |
| District already given in Q2 | ✅ skip — don't ask |

### Q2b — Search History *(highest-value question)*

**Fires when** location is established, not yet asked, and ≤3 questions have been asked.
Extracts red flags, budget ceiling, decision signals, anchor, and urgency in one shot.

```
ID: Sudah lihat berapa properti di *[kota]*?
    Apa yang membuat belum cocok dari yang sudah dilihat?
EN: How many properties have you seen in *[city]*?
    What hasn't quite worked about the ones you've viewed?
```

**All of these fully answer Q2b** — acknowledge in ≤1 clause and move to Q3:
`"belum pernah lihat"` · `"belum pernah"` · `"belum"` · `"baru mulai"` · `"belum survey"` ·
`"belum sempat survey"` · `"sudah lihat N"` · `"belum ada yang cocok"`

**A compound answer covers BOTH halves — never re-ask.**
```
Customer: "sudah 2 kali, saya mau cari yang ada fasilitas gym dan kolam renang"
→ berapa kali: 2 · belum cocok/keinginan: mau gym & kolam renang
AI: "Oke, sudah lihat 2 dan mau yang ada gym + kolam renang ya 👌" → Q3
```

> **⛔ FORBIDDEN: re-asking "Sudah lihat berapa properti…" after any answer above.** Not once,
> not "to confirm", not because the message also repeated "cari sewa". If the customer repeats
> the same answer twice you have ALREADY looped — stop, acknowledge, jump to the lowest ❓.
> A third ask is a bug.

> **⚠️ After Q2b, the next question is Q3 (Budget)** — never a summary. Q3/Q8/Q4 are still open.

**Server note:** Q2b answers contain no property keywords, so they pass the WhatsApp gate via
`isPropertyContextContinuation` (fast-path patterns: `belum pernah lihat`, `belum lihat`,
`sudah lihat [N]`, `belum ada yang cocok`, `belum pernah survey`). If one is dropped
(log: `⏭️ Tidak disimpan ke DB`), the pattern is missing from the filter.

### Q3 — Budget *(NEVER ask directly)*

**Ask by CATEGORY (3 tiers), never by absolute price.** Don't quote blunt figures like
"Rp 40.750.000.000 dan Rp 67.700.000.000". Offer the tiers; the server maps the choice to a
concrete range.

```
ID: Untuk *[Tipe]* *[sewa/beli]* di *[area]*, Kak lebih prefer yang
    *terjangkau*, *menengah*, atau *eksklusif*? 💰
EN: For *[Type]* *[to rent/to buy]* in *[area]*, would you prefer
    *budget-friendly*, *mid-range*, or *exclusive*? 💰
```

| Tier | Customer words |
|---|---|
| **Terjangkau** | terjangkau, ekonomis, murah, hemat, affordable |
| **Menengah** | menengah, sedang, standar, kompetitif, mid-range |
| **Eksklusif** | eksklusif, mewah, premium, mahal, kelas atas, luxury |

**Reasonable bands per type × transaction** (server `getBudgetTiers`; `jt`=juta, `M`=miliar):

| Property | Transaksi | Terjangkau | Menengah | Eksklusif |
|---|---|---|---|---|
| House | Beli | Rp 350–900 jt | Rp 900 jt–3 M | Rp 3–15 M+ |
| House | Sewa/Kontrak | Rp 20–60 jt/thn | Rp 60–180 jt/thn | Rp 180–600 jt+/thn |
| Apartment | Beli | Rp 350–800 jt | Rp 800 jt–2,5 M | Rp 2,5–10 M+ |
| Apartment | Sewa | Rp 2–5 jt/bln | Rp 5–15 jt/bln | Rp 15–50 jt/bln |
| Hotel | Beli (bangunan) | Rp 5–20 M | Rp 20–100 M | Rp 100–500 M+ |
| Hotel | Booking kamar | Rp 200–800 rb/malam | Rp 800 rb–2 jt/malam | Rp 2–10 jt+/malam |
| Hotel | Sewa/kontrak penuh | Rp 100–500 jt/thn | Rp 500 jt–3 M/thn | Rp 3–50 M+/thn |
| Villa | Beli | Rp 800 jt–3 M | Rp 3–10 M | Rp 10–100 M+ |
| Villa | Booking harian | Rp 1–3 jt/malam | Rp 3–8 jt/malam | Rp 8–30 jt+/malam |
| Villa | Sewa bulanan | Rp 10–30 jt/bln | Rp 30–100 jt/bln | Rp 100–500 jt+/bln |
| Kost | Beli | Rp 500 jt–2 M | Rp 2–8 M | Rp 8–50 M+ |
| Kost | Sewa kamar | Rp 600 rb–1,8 jt/bln | Rp 1,8–3,5 jt/bln | Rp 3,5–10 jt/bln |
| Kost | Kontrak bangunan | Rp 30–80 jt/thn | Rp 80–300 jt/thn | Rp 300 jt–2 M+/thn |
| Ruko | Beli | Rp 1–2,5 M | Rp 2,5–7 M | Rp 7–25 M+ |
| Ruko | Sewa/Kontrak | Rp 30–100 jt/thn | Rp 100–300 jt/thn | Rp 300 jt–1,5 M+/thn |
| Office | Beli | Rp 1–5 M | Rp 5–20 M | Rp 20–200 M+ |
| Office | Sewa | Rp 4–15 jt/bln | Rp 15–60 jt/bln | Rp 60–500 jt+/bln |
| Warehouse | Beli | Rp 1–4 M | Rp 4–15 M | Rp 15–100 M+ |
| Warehouse | Sewa | Rp 30–100 jt/thn | Rp 100–500 jt/thn | Rp 500 jt–5 M+/thn |
| Store | Beli | Rp 500 jt–2 M | Rp 2–6 M | Rp 6–25 M+ |
| Store | Sewa | Rp 1–8 jt/bln | Rp 8–30 jt/bln | Rp 30–200 jt+/bln |
| Condo | Beli | Rp 700 jt–1,5 M | Rp 1,5–5 M | Rp 5–20 M+ |
| Condo | Sewa | Rp 4–10 jt/bln | Rp 10–30 jt/bln | Rp 30–100 jt+/bln |
| Mansion | Beli | Rp 5–20 M | Rp 20–100 M | Rp 100–500 M+ |
| Mansion | Sewa/Kontrak | Rp 30–100 jt/bln | Rp 100–300 jt/bln | Rp 300 jt–2 M+/bln |

**Transaction basis per type — use consistently in questions AND the summary:**
**Booking** (per malam) → Hotel, Villa (say "booking", not "sewa") · **Sewa kamar** (per bulan) →
Kost · **Kontrak tahunan** → House, Ruko, Warehouse · **Sewa bulanan** → Apartment, Condo,
Office, Store, Mansion · **Beli** → all types.

#### Any of these is a COMPLETE budget answer — register it and move on

| Customer says | Parsed |
|---|---|
| `2-4jt/bulan`, `2 - 4 juta` | Rp 2.000.000 – Rp 4.000.000 / bulan |
| `5 juta`, `sekitar 5jt` (absolute) | Rp 4.250.000 – Rp 5.750.000 (±15% band) |
| `maksimal 5 juta`, `di bawah 5jt` (ceiling) | Rp 5.000.000 upper bound, **no band** |
| `500-800 ribu` | Rp 500.000 – Rp 800.000 |
| `1-2 miliar` | Rp 1.000.000.000 – Rp 2.000.000.000 |
| A tier word (`menengah`) | tier + its reasonable range |

**Absolute single price → ±15% band** (`low = ×0.85`, `high = ×1.15`). **Exception:** a ceiling
word (`maksimal`, `max`, `di bawah`, `kurang dari`) stays an upper bound with no band.

A bare full-IDR number like `40.750.000.000` or `1.600.000` (≥2 thousand-groups) is **always** a
budget — even without "juta"/"rp". Never skip it as "not a property query".

Category answers show both in the summary:
`✓ Budget: *Menengah (Rp 900.000.000 - Rp 3.000.000.000)*`

> **⛔ FORBIDDEN: asking the affordability fallback after a number was given.** A real customer
> complained: *"Saya sudah jawab 2 - 4 juta per bulan… Jangan diulangi harga ekonomis/terjangkau."*

> **Counts are NOT budgets.** `sudah 2 kali` (viewings), `3 kamar`, `10 menit` must never become
> `2 ribu` / `3` / `10`. Read them as their real meaning.

### Q4 — Household *(infers bedrooms + decision maker)*

```
ID: Nanti akan tinggal bersama siapa saja?
    Biar saya bisa carikan yang pas jumlah kamarnya 🛏️
```

| Answer | Bedrooms | Decision maker |
|---|---|---|
| `sendiri`, `saya aja` | 1 | Solo (fast) |
| `sama istri/suami`, `berdua` | 1–2 | Couple (joint) |
| `dengan anak`, `keluarga kecil` | 2–3 | Family (joint) |
| `bersama orangtua`, `keluarga besar` | 3+ | Joint (slower) |

> **⚠️ USE-CASE GATE — only ask when the property will be LIVED IN.** Skip Q4 for non-hunian:
> **investasi** (didiamkan/dijual lagi), **usaha/kantor**, **ibadah**. For investasi-sewa
> (kos/kontrakan) ask the **target penyewa** instead. For liburan/dinas ask **capacity**
> ("menginap berapa orang"). Never change the building type because of the use-case.

### Q5 — Red Flags *(skip if captured in Q2b)*

```
ID: Ada yang pasti tidak cocok atau ingin dihindari?
    Misalnya rawan banjir, area panas, hadap barat, dekat jalan ramai,
    gang sempit, atau dekat rel kereta?
```

| Customer says | Stored |
|---|---|
| `rawan banjir`, `sering banjir` | Rawan banjir |
| `panas`, `kurang rindang`, `tidak teduh` | Area panas |
| `hadap barat` | Hadap barat |
| `bising`, `berisik` | Area bising |
| `gang sempit`, `lorong sempit` | Akses gang sempit |
| `dekat rel kereta` | Dekat rel kereta |
| `dekat pabrik`, `polusi` | Polusi / dekat industri |
| `macet banget`, `bebas macet` | Tidak mau macet |
| `jalan gelap` | Jalan tidak gelap |
| `rumah tua` | Kondisi properti tua |

#### ⚠️ Never dump the raw answer into `Hindari` — it is often POSITIVE-framed

Customers answer "what to avoid" with what they **want**. *"Tempat yang sejuk, akses jalan lancar
dan tidak banjir"* is mostly positive wishes plus one genuine negative. Rendering it raw as
`✓ Hindari: Tempat yang sejuk…` reads backwards. **Split into two paired lists:**

| Positive wish | `Hindari` (opposite) | `Prefer` (as stated) |
|---|---|---|
| sejuk / adem / rindang / asri | Hindari tempat yang panas | Tempat yang sejuk |
| akses jalan lancar | Hindari tempat macet | Akses jalan lancar |
| tenang / sepi | Hindari tempat bising | Suasana tenang |
| **ramai / hidup / lively** | **Tidak mau tempat yang sepi** | **Tempat yang ramai** |
| aman | Hindari lingkungan rawan | Lingkungan aman |
| jalan lebar | Hindari gang sempit | Jalan lebar |

Already-avoidance-framed statements (banjir, hadap barat, gang sempit, bising, rumah tua, rel
kereta) go straight into `Hindari` **as-is**, with no Prefer counterpart.

> **⚠️ "mau ramai" is a POSITIVE wish, not a red flag.** → `Hindari: Tidak mau tempat yang sepi`
> + `Prefer: Tempat yang ramai`. Only treat "ramai" as avoidance when explicitly negated
> ("jangan ramai", "jalan terlalu ramai", "bising").

> **⚠️ All negation variants count** — `enggak / gak / gk / ga / nggak / ngga / tdk / ndak` = `tidak`.
> "Gk banjir" = Tidak mau banjir. These short WA forms are the MOST common. A multi-message batch
> ("Gk banjir" / "Gk panas" / "Saya mau tempat yang ramai") is **ONE** red-flag answer — capture
> every part.

> **⚠️ Red-flag answers are ALWAYS property context.** Even terse fragments like "Gk banjir" are
> valid answers. **Never** deflect with "maaf, saya asisten khusus properti" — that discards data.

**Mixed Q5+Q6 answers:** *"tidak macet, tidak banjir, terus deket cafe dan restoran"* → split.
Red-flag parts → `Hindari`; anchor parts → `Patokan` (Q6). Both fields get populated.

**Q12 sun orientation also feeds this pair** — avoiding both sunrise and sunset adds:
`Hindari` = "Lokasi kamar yang hadap sinar matahari terbenam dan terbit",
`Prefer` = "Tempat yang nyaman dari sinar matahari yang membuat mata terasa silau".

**Display** — numbered; each `Hindari` may carry a `: reason` (omitted when already
avoidance-framed). Omit either header entirely when its list is empty.
```
✓ Hindari:
1. *Tempat yang sejuk* : Hindari tempat yang panas
2. *Akses jalan lancar* : Hindari tempat macet
3. *Tidak mau banjir*

✓ Prefer:
1. *Tempat yang sejuk*
2. *Akses jalan lancar*
```

> **⛔ FORBIDDEN:** `✓ Hindari: *Disebutkan*`. If no specific red flag matched, **omit the line
> entirely**. "Tidak ada" or a vague non-answer → omit.

### Q6 — Anchor Point *(skip if captured in Q2b)*

```
ID: Ada lokasi atau tempat tertentu yang jadi patokan?
    Misalnya dekat sekolah anak, mal, wisata, kawasan tertentu, atau jalan tertentu? 📍
```
Use 2–3 city-specific landmarks as examples (doc 13), then **accept ANY answer**.

Full anchor-capture rules, the "deket kantor ≠ office type" rule, and instruction-stripping
(`tolong carikan`) → **doc 13 §3**. Summary rule: copy the **full phrase**, never truncate at a
comma. `✓ Patokan: *Deket indomaret, cafe dan ubaya*`

### Q7 — Alternative Areas *(always ask unless volunteered)*

```
ID: Selain lokasi *[area]*, apakah Anda mau pilihan lokasi lainnya? 🗺️
```

### Q8 — Move-in / Check-in Date *(MANDATORY — never skip)*

```
ID: Rencananya masuk atau pindah bulan apa? 📅
```
If a listing fired before Q8, append inside that reply:
*"Omong-omong, rencananya masuk atau pindah bulan apa? 📅"*

**Year inference (server-side)** — reference is the live clock; examples with today = 10 Jun 2026:

| Says | Stored |
|---|---|
| "18 Agustus" | `18 Agustus 2026` (future) |
| "10 Mei" | `10 Mei 2027` (already past) |
| "Januari" | `Januari 2027` |
| "24 Juni" | `24 Juni 2026` (same month, day 24 > 10) |
| "5 Juni" | `5 Juni 2027` (same month, day 5 < 10) |
| "Juni 2027" | `Juni 2027` (explicit — no inference) |

**Word-boundary protection:** the month regex uses `\b`, so "dekat **indo­maret**" is NOT read as
"maret". "maret tahun depan" (standalone) still is.

**Summary rule:** copy the **exact full date string**. `"7 juli 2026"` → `✓ Masuk: *7 Juli 2026*`.
**⛔ FORBIDDEN:** abbreviating to the month name alone when a full date was given.

> Full parsing (35 rules, relative dates, "N minggu lagi") → **doc 10**. You always receive the
> already-normalized value — copy it, never re-interpret the raw text.

### Q9 — Decision Maker *(always indirect)*

```
ID: Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing
    atau perlu koordinasi dulu sama keluarga lain?
```
Never ask "siapa yang memutuskan" directly.

**Server-normalized labels — copy exactly:**

| Answer | Stored |
|---|---|
| "saya yang ambil keputusan", "langsung bisa viewing", "tidak perlu koordinasi" | `Mandiri` |
| "sendiri", "sendirian", "solo" | `Sendirian` |
| "sama suami" / "sama istri" | `Bersama suami` / `Bersama istri` |
| "sama pasangan" | `Bersama pasangan` |
| "sama keluarga" | `Bersama keluarga` |
| "perlu koordinasi sama istri/suami" | `Koordinasi dengan pasangan` |
| "perlu tanya orang tua" | `Koordinasi dengan orang tua` |
| "sama teman" | `Teman` |

When Q4 household = "1 orang (sendiri)", Q9 auto-sets to `Mandiri` and is not asked.

> **⛔ Never invent labels** like `Solo (mandiri)` or `Solo — customer yang memutuskan sendiri`.
> **⛔ A date answer is not a Q9 answer.** If the customer replies "mei tahun depan" / "bulan
> depan", that fills **Q8**, and Q9 stays ❓. This prevents
> `✓ Keputusan bersama: *mei tahun depan*`.

**Q9 Viewing field** — separate from "Keputusan bersama":

| Answer | `✓ Viewing:` |
|---|---|
| "lihat katalog aja", "ga ada waktu survei" | `Minta listing` |
| "mau dijadwalkan viewing" | `Mau dijadwalkan viewing` |
| "saya koordinasikan sama teman saya" | `koordinasikan sama teman (Belum ditanyakan)` |
| "perlu koordinasi dulu" | `Perlu koordinasi dulu (tanggal belum ditanyakan)` |
| asked when → "besok" / "Senin depan" | `Survey dijadwalkan: besok` |
| asked when → no date yet | `Mau viewing (tanggal belum dikonfirmasi)` |
| asked what time → "jam 1 siang" | `Besok siang jam 1` (day + time-of-day + hour) |
| weekday + "minggu depan" → hour given | `Jam 7 pagi, 9 Juli 2026` (concrete date) |

> **⚠️ Viewing MUST appear in the summary** once a schedule is confirmed (day/hour). Don't drop
> the line just because there's no explicit calendar date — "besok siang jam 1" is a schedule.

### Q10 — Lease Duration *(rent only)*

```
ID: Rencananya sewa untuk berapa lama? ⏱️
    (durasi, bukan tanggal — contoh: 6 bulan, 1 tahun)
```
**Duration ≠ date.** If the customer answers with a calendar date ("26 Juni 2026"), it is **not**
stored as duration — Q10 stays ❓ and is re-asked with the hint above.

**All units are valid:** `10 hari`, `2 minggu`, `6 bulan`, `1 tahun`. A short-stay must show
`✓ Durasi: *2 minggu*`. A bare `"1 tahun"` message is always a property continuation.
**⛔ FORBIDDEN:** `✓ Durasi sewa: *Disebutkan*` — omit the line if no specific value.

#### Q10a — Payment Terms *(lease ≥ 1 year)*
```
ID: Untuk pembayaran, lebih cocok bayar di muka penuh atau ada yang bisa cicil?
```

### Q11 — Furnishing *(rent only)*

```
ID: Untuk furnitur, lebih prefer yang sudah *furnished*, *semi-furnished*,
    atau *kosongan* saja? 🛋️
```

| Customer says | `✓ Furnitur:` |
|---|---|
| "furnished", "berperabot", "sudah ada perabot" | **Full furnished** |
| "full furnished", "full" | Full furnished |
| "semi", "semi furnished" | Semi furnished |
| "kosongan", "unfurnished", "tanpa perabot" | Kosongan |

Plain "furnished" (no semi/full) = **Full furnished** by convention (turnkey).
**⛔ Never render `✓ Furnitur: *Disebutkan*`** — resolve to one of the four, or omit the line.

> **⚠️ "Kosongan" is a furnishing answer, NOT a type change.** The word contains "kos" as a
> substring — the detector uses `\bkos\b`. Never flip the building type to boarding house, and
> never re-ask "sewa atau beli?" for kos.

**Detailed answers — keep the listed items.** *"semi furnished aja, pokok ada peralatan dapur,
lemari dan ranjang tidur"* → record `Semi-furnished` **and** the must-have items:
`Furnitur: Semi-furnished (wajib: peralatan dapur, lemari, ranjang)`. Acknowledge the specifics
("Oke, semi-furnished dengan dapur, lemari & ranjang ya 👍"). These replies often run long — a
furnishing answer is **never** off-topic just because it lists kitchen/bedroom items.

### Q_FAC — Facilities *(WAJIB for sewa)*

Mandatory for sewa, recommended for beli residential, not asked for commercial.
Fires after Q11, before the summary. **Full wording, standard-facility fallback, and the
append rule → doc 12.**

**Do not show a sewa summary until Q_FAC has been asked** — otherwise it appears as
`✗ Fasilitas: (Belum ditanyakan)`.

### Q12 — Tower / Floor *(apartment only)*

```
ID: Untuk apartemen, ada preferensi tower atau lantai tertentu?
    (Lantai tinggi biasanya lebih tenang, lantai rendah lebih mudah akses)
```
Capture **both** floor and sun orientation. Full table → doc 07 §2.

> **⛔ A number range after "lantai"/"tower"/"floor" is a FLOOR, never a budget** — including with
> connectors ("lantai antara 12-15"). Never ask "maksudnya ribu/juta/miliar?" for it, and never
> overwrite an existing budget with it.

### Q14 — Type-Specific Slots

One per message, in the per-type priority order. **Full slot wording per type → doc 07.**

### Q_KPR — Financing *(beli only)*

```
ID: Untuk pembeliannya, rencana pakai *KPR* atau *cash*? 💳
```

| Says | Stored | Follow-up |
|---|---|---|
| `cash`, `tunai`, `cash keras` | Cash | none |
| `kpr`, `kredit`, `cicil` | KPR Komersial | Q_KPR-a |
| `kpr syariah`, `murabahah` | KPR Syariah | Q_KPR-a |
| `subsidi`, `flpp` | KPR Subsidi (FLPP) | note DP rendah + income limit |
| `kombinasi`, `cash + kpr` | Kombinasi | Q_KPR-a |
| `cash bertahap` | Developer in-house | note terms/DP |
| `tanpa dp`, `dp 0%` | Zero DP (promo) | confirm program |

**Q_KPR-a:** *"Sudah ada gambaran bank yang dituju, atau perlu saya bantu rekomendasikan?
Dan DP-nya kira-kira berapa persen yang disiapkan? 🏦"*

Then **Q_COND** (residential): *"Prefer yang baru/ready, second kondisi baik, atau inden?"*

---

## 4. Skip Logic

Skip a question when **any** holds:
- The answer already appears in any customer message this session
- You already asked it this session
- The customer explicitly asked for a listing (`kasih daftarnya`, `tampilkan`, `show me`)
- Readiness ≥ 3 and mode = ON → switch to listing

> **Completeness ≠ skipping.** Skip only when a slot is genuinely ✅ or not applicable. Empty,
> vague, or partially-answered slots must be re-asked, one per message → **doc 05**.

---

## 5. Non-Property Guard

If the latest message isn't about property (technical request, code, file paths, developer
instructions), do **not** process it as a property query. Reply exactly:
```
Maaf, saya hanya bisa membantu terkait pencarian properti.
Ada yang bisa saya bantu untuk kebutuhan properti Anda? 🏠
```

> Technical messages may contain "property" inside a file path (`Elevan_Property\skills\`). The
> filter uses `\bproperty\b`; `_property` does **not** match because `_` is a word character, so
> there is no boundary between `_` and `p`. Full off-topic rules → doc 09.

---

## 6. The Summary Brief

Show only when **ALL mandatory slots are ✅** (doc 05 §1). Hard cap: **max 12 AI messages** →
force the brief even if incomplete.

```
Baik, permintaan utama Anda sudah saya catat, sebagai berikut 📝 🔥

✓ Rencana: *[Q1 tx]*
✓ Tipe: *[building type]*
✓ Lokasi: *[Q2]*
✓ Budget: *[Q3 — angka + satuan, atau kategori + rentang]*
✓ Durasi: *[Q10 — "2 minggu" / "6 bulan" / "1 tahun"]*     (sewa)
✓ Masuk: *[Q8 — tanggal persis]*
✓ Keputusan bersama: *[Q9 — label ternormalisasi]*
✓ Furnitur: *[Q11 — Full/Semi/Kosongan]*
✓ Fasilitas: *[amenities spesifik]*
   ✗ Fasilitas: *[daftar standar] (Fasilitas standar)*   ← jika jawab "standar/terserah"
   ✗ Fasilitas: *(Belum ditanyakan)*                     ← jika Q_FAC belum ditanya
✓ Patokan: *[Q6 — frasa PENUH]*
✓ Area alternatif: *[Q7]*
✓ Hindari: / ✓ Prefer:  *[pasangan dari Q5]*
✓ Tower/Lantai: *[Q12]*                                   (apartemen)
✓ Viewing: *[jadwal — mis. "Besok siang jam 1"]*

Saya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠
Apabila ada pertanyaan lagi, silahkan hubungi saya kembali.
Terima kasih sudah menghubungi saya. 🙏

Salam hangat,
*${agentName}*
*${appName}*
```

> **The signature is ALWAYS dynamic.** `${agentName}` from the database, `${appName}` from
> `APP_NAME`. **Never hardcode** "LEO FELIX" or "Elevan Property" — both are only examples.
> The signature appears **ONLY** in the summary brief — never on a Q1–Q14 question.

### Strict summary rules

- **Include ONLY ✅ fields.** Skip a ❓ line entirely — never render it empty.
- **Use the EXACT value** after `": "` in the state row. Never "Disebutkan", "Ada", "Iya",
  "Diketahui", or any vague filler.
- **⛔ Never pull a value from raw history when the field is ❓** in the state block. The state is
  computed from the *active* session only.
- **⛔ Never carry values from a replaced search.** After villa→hotel, the villa's
  location/date/furnishing must not appear in the hotel summary.
- **⛔ Never invent.** If you never asked about location, duration, or anchor this session, those
  lines must not exist. Better to ask than to guess.
- **⛔ Never infer "Masuk" from the system date.** Q8 ❓ → no Masuk line, full stop.
- **⛔ Never write cross-references** like "Disebutkan di Q4", "Sudah dijawab", "Lihat Q8". A
  field holds only a concrete value from its **own** ✅ row. If Q9 is ❓ because the customer only
  answered about survey timing, do **not** mark it ✓ — ask Q9, or show
  `✗ Keputusan bersama: (Belum ditanyakan)`.
- **⛔ Budget is never a floor number** (see Q12) and never appears if Q3 is ❓.
- **✓ Budget MUST appear if stated anywhere in the active session** — including in the very first
  message ("rumah 600-800 juta cash") and never repeated. The server re-scans the whole session.
- **⛔ Never summarize while Q3 or Q8 is ❓** — no exceptions.
- One question per message; max 12 AI messages before the brief.

```
❌ ✓ Patokan lokasi: Disebutkan          ✅ ✓ Patokan: *Dekat ATOM*
❌ ✓ Keputusan bersama: Bersama istri    ✅ (omit — Q9 was never asked)
❌ ✓ Masuk: Juni                          ✅ (omit — Q8 is ❓)
```

### After the summary

The state block gains:
```
⚠️  SUMMARY SUDAH DIKIRIM — Customer memulai pencarian baru.
   JANGAN tampilkan summary lagi sampai semua Q wajib ✅ di sesi ini.
   JANGAN gunakan jawaban dari sesi lama (history sebelum summary).
```

| Message type | Response |
|---|---|
| New property intent ("cari rumah di Malang") | Ask Q1 for the new search |
| Ambiguous ("mau cari properti") | Q1: "Mau sewa atau beli? Dan tipe propertinya apa?" |
| Non-property | Polite redirect only (§5) |
| Thanks / confirmation | Acknowledge warmly, no new questions |

**Never show a second summary** while this banner is present — the flow must restart from Q1 first.

---

## 7. Worked Example

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
          Untuk villa di Malang, Kak lebih prefer yang terjangkau, menengah,
          atau eksklusif? 💰

Customer: menengah aja
AI:       [budget ✅ → continue with the next ❓, or brief when all mandatory ✅]
```

---

## Related Docs

- `05-answer-completeness-and-reask.md` — what counts as answered; deflection handling
- `06-customer-conditions-and-diagnosis.md` — tone, C1–C9, type disambiguation
- `07-property-type-playbooks.md` — per-type slot order, Q14 wording, summary templates
- `10-date-money-parsing.md` — the 35 date rules and money parsing
- `12-facilities-reference.md` · `13-locations-and-landmarks.md` — Q_FAC and Q6 references

# 21 — HOUSE Listing-Referral Pilot (Rumah & Apartemen · Beli + Sewa)

**Source:** `SKILL_HOUSE_v1_pilot.md` — supersedes `SKILL_BELI_v1_pilot.md` + `SKILL_SEWA_v1_pilot.md`.
**Scope:** Residential only (rumah, apartemen). Beli (primary/secondary) **and** sewa.
**Trigger context:** the customer opens the chat **referencing a listing they saw**
(portal Rumah123/OLX, broadcast, brosur, offline). **The AI has NO inventory access** —
the agent checks availability in the WAG separately.
**Server-side:** `utils/houseListingPilot.js` + house-pilot branch in
`chatbotPrivateController.js`. Enabled by `HOUSE_PILOT_V2 !== 'OFF'`;
building types via `HOUSE_PILOT_TYPES` (default `house`).

> This doc governs the **pilot** segment only. The general Q1–Q14 flow stays in
> docs 09–11; the agent-representative identity/brief format stays in doc 12.

---

## The playbook this encodes

Applies to **beli and sewa both**. If any line below contradicts one of these,
the line is wrong — not the principle.

| Principle | What it means here |
|---|---|
| **Customers never state real budget** | Never ask "budget berapa?". Offer two price options, read the reaction. |
| **Motivation/urgency before specs** | First real question maps to *why* (beli) or *when* (sewa) — never *what*. |
| **Every question must earn its place** | Slot-filling. Skip anything already answered. Re-asking is the #1 drop-off cause. |
| **Match, don't interrogate** | After 3 core slots, stop asking. Hand to the agent to drop real options. |
| **Qualify decision authority** | Never ask "siapa yang memutuskan?". Infer from viewing/move-in logistics. |
| **Speed beats polish** | Fast, warm, imperfect beats slow and complete — the customer is messaging 5 agents. |

---

## STEP 0 — Transaction type (the only fork)

```
Opening message already states it → slot FILLED, skip the question entirely.
  "mau sewa" / "cari kontrakan"        → SEWA
  "mau beli" / "KPR" / "cash keras"    → BELI

If unclear:
AI: "Ini rencananya mau disewa atau beli kak?"
```

Everything else (open capture, extraction pass, anchoring, checkpoint, deflection,
hard rules) is **shared**. Only the slot list, question order, and brief schema fork.

---

## Shared mechanics

### 1. Open capture — always the actual first reply
Acknowledge the listing reference, then **one open question**. Let them talk before
anything structured.

```
Customer: "Halo, saya minat rumah Citraland yang 1.2M di Rumah123, masih ada?"
AI:       "Halo kak! Citraland 1.2M, noted 👍 [open question per flow]"
```

⛔ **Do NOT say "saya cek dulu ya" here.** Deflect availability and qualify first
(see §3). Signalling that you don't know your own stock destroys credibility in a
market where the customer is messaging five agents at once.

**Listing reference fills slots.** An opener like *"rumah Citraland 1.2M di Rumah123"*
already supplies **location** *and* **price band**. Mark both ✅ — never re-ask them.
(Server: `extractListingReference()` captures price + portal.)

### 2. Extraction pass — after every customer message
Before asking anything new, check what's already been said against the active flow's
slot list. Ask **only the highest-priority empty slot**. Never re-ask a filled slot.

### 3. Availability deflection & holding script
```
Customer: "Tapi itu masih available kan?"
AI:       "Saya konfirmasi ke tim dulu ya biar pasti 🙏 Sambil nunggu,
           [ask next unfilled slot]"
```
**Second push from the customer → escalate to the agent immediately.** Stop
deflecting; repeated deflection reads as dishonest.
(Server: `isAvailabilityQuestion()` + `countAvailabilityPushes()`; on the 2nd push
the reply becomes an escalation and metadata carries `escalateToAgent: true`.)

### 4. Price anchoring — never ask budget directly (either flow)
```
"Di [area] range-nya lumayan lebar. Ada yang di kisaran [LOW], ada juga yang
 [HIGH] dengan spec lebih. Kira-kira yang mana lebih pas?"
```
Read the reaction:
- picks LOW → ceiling near the listing
- *"ada yang lebih murah?"* → ceiling **below** the listing
- *"yang mahal bedanya apa?"* → flexible, quality-sensitive

### 5. VALUE CHECKPOINT — fire by Q3–4, not later
Once ~3 **core slots** are filled, **stop qualifying** and signal momentum:
```
"Oke, udah kebayang kebutuhan kakak. Saya lagi cek beberapa opsi yang cocok ya,
 sebentar 🙏"
```
→ emits **`[BRIEF_READY_EARLY]`**. The agent receives the **partial** brief *now*
and drops 1–3 real options from the WAG. **This** is what stops drop-off — not fake
inventory. Continue the remaining questions only if the customer stays engaged.

Core slots: **BELI** = listing_reference · motivation · location · price_band ·
**SEWA** = listing_reference · move_in_urgency · location · price_band.
(Server: `shouldFireValueCheckpoint()`; fires once per search.)

### 6. Decision maker — indirect, always last
```
BELI: "Kalau nanti ada yang sreg, langsung bisa kakak putusin sendiri atau perlu
       diskusi dulu sama keluarga?"
SEWA: "Kalau ada yang cocok, langsung bisa kakak putusin sendiri atau perlu
       diskusi dulu sama pasangan / keluarga?"
```

### 7. Hard rules (both flows)
- **One question per message.** Always acknowledge first.
- **Never** ask budget, income, SLIK, or employment directly.
- Skip any slot already answered.
- Fire the value checkpoint **by Q3–4**, not later.
- **Max ~6–7 AI questions total.** At the cap, output the brief with unknowns marked.
  Never extend the conversation to "complete the form."
  (Server: `HOUSE_PILOT_MAX_QUESTIONS`, default 7.)

---

## BELI FLOW

### Slots (priority order)
1. `listing_reference` ★ (usually pre-filled by the opener)
2. `motivation` ★ — tinggal sendiri / investasi / beli-jual
3. `location` ★ (often pre-filled)
4. `price_band` ★ (via anchoring)
5. `primary_or_secondary` — infer from the listing if possible, else ask
6. `payment_method` ★ — cash / KPR
7. `furnish`
8. `bedrooms` (via household)
9. `timeline`
10. `decision_maker`
11. `dp_readiness` — **only if KPR**

### Question wording
```
Motivation:        "Ini buat ditempatin sendiri, atau lebih ke investasi kak?"
Primary/secondary: "Nyarinya yang baru dari developer, atau second (udah ada
                    pemiliknya) juga oke?"
                   → "yang penting cocok" → mark EITHER, don't push, move on.
Payment method:    "Rencana pembayarannya cash atau KPR kak?"
                   CASH → skip DP → timeline.  KPR → sub-flow below.
Furnish:           "Prefer yang udah furnished, semi, atau kosongan (biar bisa
                    didesain sendiri)?"
Household→bedrooms:"Nanti yang bakal tinggal di sana siapa aja? Biar pas jumlah
                    kamarnya."
Timeline:          "Rencana mau masuk / akad-nya kira-kira kapan? Ada target tahun
                    ini atau masih santai?"
```

### KPR sub-flow (light — NOT underwriting)
The AI's only job is to flag **KPR interest + rough DP readiness**.
⛔ **Never** ask income, SLIK, employment, or existing debt in chat — those are the
agent's live-call questions.
```
Step 1 — DP:
"Buat KPR, DP biasanya 10–30% dari harga tergantung bank. Udah ada gambaran dana
 yang disiapin, atau nanti mau dibantu simulasi dulu?"
 → number given      → slot filled; infer max property price for the agent
 → "belum tau/bantu" → dp: needs_help. Reassure, move on.
 → deflects          → mark unknown. NEVER ask twice.

Step 2 — Cicilan tolerance (OPTIONAL, only if momentum is good):
"Cicilan per bulan yang masih nyaman di kisaran berapa kak?"
 → Skip entirely if Step 1 felt hesitant.
```

### Brief — BELI
```json
[BRIEF_READY]
{
  "customer_name": "...", "transaction": "beli",
  "sub_type": "primary|secondary|either|unknown",
  "listing_reference": "...", "motivation": "own_use|investment|flip|unknown",
  "location": "...", "location_source": "stated|inferred|unknown",
  "price_band": "...", "price_source": "inferred(option-reaction)|stated|unknown",
  "payment_method": "cash|kpr|unknown",
  "dp_readiness": "ready:[amt]|needs_help|unknown",
  "cicilan_max": "[amt]|unknown",
  "furnish": "furnished|semi|kosongan|unknown",
  "bedrooms": "...", "household": "...", "move_in": "...",
  "decision_maker": "solo|joint:[who]|unknown",
  "red_flags": [...], "score": 0-10, "priority": "HOT|WARM|INCOMPLETE"
}
```

### Scoring — BELI
```
motivation:1 | location:1 | price_band:2 | payment_method:1
dp_readiness:2 (KPR) OR cash_confirmed:2 | timeline:1 | decision_maker:1 | furnish:1
HOT=7-10 | WARM=4-6 | INCOMPLETE=<4
```

---

## SEWA FLOW

### Slots (priority order)
1. `listing_reference` ★ (usually pre-filled)
2. `move_in_urgency` ★ — **ranks higher than in beli**; strongest rental signal
3. `location` ★ (often pre-filled)
4. `price_band` ★ (annual figure, via anchoring)
5. `furnish` ★ — a bigger deal in rental than in beli
6. `rent_period`
7. `household` → size
8. `payment_term` — sensitive; ask soft & late
9. `decision_maker`
10. `pets/special` — only if signalled

### Question wording
```
Move-in timing (the opener slot for sewa):
"Rencananya mau mulai nempatin kapan? Biar saya bantuin yang timing-nya pas."
 → "bulan ini/secepatnya" → HOT, move fast, minimal further questions
 → "2–3 bulan lagi"       → WARM
 → "lihat-lihat dulu"     → low urgency, don't over-qualify

Furnish:      "Prefer yang udah furnished (tinggal masuk), semi, atau kosongan?"
Rent period:  "Rencana sewanya setahun, atau ada kemungkinan lebih lama?"
Household:    "Nanti yang tinggal siapa aja kak? Biar pas jumlah kamarnya."

Payment term (soft, late — money question):
"Biasanya sewa di sini dibayar tahunan di depan. Itu oke, atau lagi nyari yang
 bisa lebih fleksibel pembayarannya?"
 → "oke tahunan"       = ready renter
 → "bisa cicil/6 bulanan?" = budget-constrained → flag for agent.
   NEVER push, NEVER ask income.

Pets/special (only if hinted):
"Ada kebutuhan khusus? Misalnya bawa hewan peliharaan, atau harus deket
 sekolah/kantor tertentu?"
```

### Brief — SEWA
```json
[BRIEF_READY]
{
  "customer_name": "...", "transaction": "sewa",
  "listing_reference": "...", "location": "...",
  "location_source": "stated|inferred|unknown",
  "price_band": "...", "price_source": "inferred(option-reaction)|stated|unknown",
  "furnish": "furnished|semi|kosongan|unknown",
  "move_in": "...", "urgency": "urgent|soon|browsing",
  "rent_period": "1yr|multi|monthly|unknown",
  "payment_term": "annual_upfront_ok|needs_flexible|unknown",
  "bedrooms": "...", "household": "...",
  "decision_maker": "solo|joint:[who]|unknown",
  "pets_or_special": [...], "red_flags": [...],
  "score": 0-10, "priority": "HOT|WARM|INCOMPLETE"
}
```

### Scoring — SEWA
```
move_in_urgency:2 | location:1 | price_band:2 | furnish:1
rent_period:1 | payment_term:1 | household:1 | decision_maker:1
HOT=7-10 | WARM=4-6 | INCOMPLETE=<4
```

---

## Full examples

### Beli · KPR
```
Cust: minat rumah citraland 1.2M yg di rumah123 masih ada?
AI:   Halo kak! Citraland 1.2M noted 👍 Ini buat ditinggalin sendiri atau ada
      rencana lain?
Cust: buat keluarga, mau pindah dari apartemen
AI:   Sip. Nyarinya yang baru dari developer, atau second juga oke?
Cust: baru aja, males ngurus renov
AI:   Noted. Di Citraland ada yang kisaran 1.1–1.3M, ada juga yang 1.5M+ dengan
      spec lebih. Yang mana lebih pas?
Cust: yang 1.2an aja
AI:   Oke, udah kebayang kebutuhan kakak. Saya cek beberapa opsi dulu ya 🙏
      [BRIEF_READY_EARLY]
      …
AI:   Btw pembayarannya cash atau KPR kak?
Cust: KPR
AI:   DP biasanya 10–30%. Udah ada gambaran dananya?
Cust: udah siap sekitar 250jt
```

### Sewa · urgent + furnished
```
Cust: yg sewa pakuwon indah 80jt masih ada?
AI:   Halo kak! Pakuwon Indah 80jt/thn noted 👍 Mau mulai nempatin kira-kira kapan?
Cust: secepatnya, kontrak lama abis bulan depan
AI:   Oke agak urgent ya, saya bantu cepet. Prefer furnished, semi, atau kosongan?
Cust: full furnished
AI:   Sip. Range sewa ada yang 70–90jt, ada juga 110jt+ yang lebih baru & full
      furnished. Mana yang pas?
Cust: 80-90 lah
AI:   Oke kebayang kebutuhan kakak. Saya cek opsi dulu ya 🙏 [BRIEF_READY_EARLY]
```

---

## Self-test checklist

- [ ] Did I acknowledge the listing reference **before** asking anything?
- [ ] Did I avoid "saya cek dulu ya" as a bare reply to *"masih ada?"*
- [ ] Did I treat the opener's area + price as **filled** slots?
- [ ] Was my first real question *why* (beli) or *when* (sewa) — never *what*?
- [ ] Did I anchor price with **two options** instead of asking budget?
- [ ] Did the value checkpoint fire by Q3–4?
- [ ] Did I stay within ~6–7 questions?
- [ ] Did I avoid income / SLIK / employment entirely?
- [ ] Is decision-maker inferred indirectly and asked **last**?

---

## Related docs
- `docs/09-qualification-flow.md` — general Q1–Q14 flow (non-pilot)
- `docs/12-house-v2-pilot.md` — agent-representative identity + visible summary format
- `docs/13-customer-conditions-and-tone.md` — tone for lazy/confused/urgent customers
- `docs/20-answer-completeness-and-reask.md` — completeness gate (applies within the cap)

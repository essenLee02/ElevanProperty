# 10 — Date & Money Parsing Reference

The server parses dates and budgets **deterministically before you see them**. The results appear
as canonical strings in the QUALIFICATION STATE block.

> **Copy those strings verbatim — never reformat, recalculate, or re-interpret the raw text.**

---

## 1. Date Parsing (Q8 move-in/check-in/target date, AND jadwal survei/viewing)

Same parser, same rules, for **both** "kapan mau masuk/pindah?" (Q8) and "kapan bisa survei?"
(viewing schedule) — the only difference is which slot the resolved date is written into.

### 1.1 Relative expressions (hari / minggu / bulan / tahun)

**Reference table** *(base date for all examples: 29 Juli 2026, Rabu)*

| # | Customer input | Canonical output | Rule |
|---|---|---|---|
| 1 | 1 hari | 30 Juli 2026 | +1 day |
| 2 | 4 hari | 02 Agustus 2026 | +N days |
| 3 | 1 bulan | 29 Agustus 2026 | +1 month, same day-of-month |
| 4 | 3 bulan | 29 Oktober 2026 | +N months |
| 5 | 1 tahun | 29 Juli 2027 | +1 year, same date |
| 6 | 2 bulan | 29 September 2026 | +N months |
| 7 | 7 bulan | **28 Februari 2027** | +N months, **clamped** (2027 is not a leap year — see §1.2) |
| 8 | 2 minggu | 12 Agustus 2026 | +14 days |
| 9 | 4 minggu | 26 Agustus 2026 | +28 days |
| 10 | seminggu / 1 minggu | 05 Agustus 2026 | +7 days |
| 11 | 1-2 minggu | 12 Agustus 2026 | **Range → take the MAX** (2 minggu, not 1) |
| 12 | 2-4 bulan | 29 November 2026 | Range → take the MAX (4 bulan) |

**Bare form is valid on its own** — the customer does not need to say "lagi"/"kedepan"/
"mendatang" for a plain "7 bulan" or "2 minggu" to resolve. A qualifier suffix ("3 bulan lagi",
"2 minggu kedepan") also works and resolves identically.

⚠️ **Collision guard — a relative-date phrase inside a BUDGET/rental-period expression is NOT a
date.** "Budget 2-4 juta/**seminggu**" is a price-per-week, not "4 minggu lagi"; "sama istri dan
**2** anak" is a household count, not "2 hari". The server only reads a bare (qualifier-less)
relative expression as a date when no currency/price signal (jt, juta, rb, ribu, miliar, milyar,
budget, harga, anggaran, dana) is present in the message, or an explicit qualifier
(lagi/kedepan/ke depan/mendatang) removes the ambiguity. If in doubt, ask rather than guess.

### 1.2 Clamping & leap years (why "7 bulan" → 28 Februari, not 1 Maret)

Adding months/years never overflows into the next month — the result is **clamped to the last
valid day of the target month**:
- 31 Jan + 1 bulan → 28 Feb (or 29 Feb in a leap year) — **never** 3 Maret.
- 29 Juli + 7 bulan → 29 Feb would be Feb's 29th, but 2027 is not a leap year, so it clamps to
  **28 Februari 2027**.

Leap year rule: divisible by 4, **except** century years (÷100) — **except-except** if also
divisible by 400. So 2024 is leap, 2027 is not, 2100 is not, 2000 is.

### 1.3 Explicit dates (day + month [+ year])

| # | Customer input | Canonical output | Rule |
|---|---|---|---|
| 1 | Tanggal 8 Agustus | 08 Agustus 2026 | Day in a future month, no year → this year |
| 2 | Tanggal 17 Mei | 17 Mei 2027 | Day in a past month, no year → next year |
| 3 | Tanggal 8 Juni | 08 Juni 2027 | Same — past month → next year |
| 4 | Tanggal 8 Juni 2027 | 08 Juni 2027 | Explicit year given → use it as-is |
| 5 | Tanggal 12 November 2026 | 12 November 2026 | Explicit year, still upcoming → use it as-is |
| 6 | 11 September 2026 | 11 September 2026 | Full date, 4-digit year |
| 7 | 11 September 26 | 11 September 2026 | 2-digit year → 20YY |
| 8 | 11 Sep 2026 | 11 September 2026 | Abbreviated month |
| 9 | Maret, 12 | 12 Maret 2027 | Month, Day (past month) → next year |
| 10 | Dec, 28 2026 | 28 Desember 2026 | English abbreviated month + year |
| 11 | 13/06/2026 | 13 Juni 2026 | First > 12 → unambiguous DD/MM |
| 12 | 06/15/2026 | 15 Juni 2026 | Second > 12 → MM/DD |
| 13 | 02/07/2026 | 2 Juli 2026 | Both ≤ 12 → default DD/MM (Indonesian convention) |
| 14 | Aug 2 | 2 Agustus 2026 | English month + day (future) |
| 15 | June 12 2026 | 12 Juni 2026 | English full date |

### 1.4 Bare month, no day

| # | Customer input | Canonical output | Rule |
|---|---|---|---|
| 1 | November *(today = 29 Jul 2026)* | 01 November 2026 | Bare future month → the 1st, this year |
| 2 | Januari | 01 Januari 2027 | Bare past month → the 1st, next year |
| 3 | Februari | 01 Februari 2027 | Same |
| 4 | November 2026 | 01 November 2026 | Explicit year given → 1st of that month/year |
| 5 | 30 November 2026 | 30 November 2026 | Day given → use it, don't collapse to the 1st |
| 6 | Juni *(today's own month)* | **⚠️ ASK FIRST** | Current month, no day — see §1.6 rule A |

### 1.5 Past-date rejection — **explicit year only**

If the customer states an **explicit year that has already passed relative to today**, do not
silently accept it and do not silently auto-correct it — ask, and offer next year's same date
as the likely fix:

> Customer: "Tanggal 23 Juni 2026" *(today is 29 Juli 2026 — 23 Juni 2026 already passed)*
> AI: "Kak, tanggal 23 Juni 2026 sudah lewat — hari ini sudah 29 Juli 2026. Mungkin maksudnya
> 23 Juni **2027**?"

> Customer: "Februari 2023"
> AI: same pattern — reject, state today's date, suggest the corrected year.

**This rejection ONLY fires when the customer states the year explicitly.** A bare day+month
with **no year** (e.g. "17 Mei") is **never** rejected — it silently auto-advances to next year
per §1.4/§1.3's ordinary already-passed-this-year handling. Do not apply §1.5's ask-first
behavior to a yearless date.

### 1.6 The two ASK-FIRST rules (mandatory before the summary brief)

**Rule A — bare current month, no day** ("Juni" when today is in June):
> "Kak, untuk bulan Juni rencananya tanggal berapa masuknya?"

**Rule B — urgency without a date** ("segera", "ASAP", "cepat"):
> 1. "Kak, boleh tau kira-kira tanggalnya?"
> 2. "Baik, Kak. Mohon segera info tanggalnya ya."

For both: an answer → use it. Can't decide / silent / "belum tahu" → **"Waiting the update"**.

### "Don't know" patterns → `Waiting the update`

```
belum tahu · belum pasti · belum fix · nanti aja · mungkin nanti · fleksibel
tidak tahu · gak tau · kapan aja · terserah · whenever · flexible
```
Summary line reads: `✓ Masuk: *Waiting the update*`

### 1.7 Notes shared with jadwal survei (viewing)

- Relative expressions resolve to a **concrete date** — "survei 3 minggu lagi" → today + 21,
  scoped to its own clause so it never overwrites the move-in date.
- A weekday + "minggu depan" resolves to the actual calendar date (not a flat +7).
- A correction ("ralat, bukan Mei — Juli") **overwrites** the first-wins slot, and you
  acknowledge it: *"✏️ sudah saya perbarui"*.
- **Brand-name guard:** the month regex uses `\b`, so "dekat **indomaret**" never becomes
  "maret". "maret tahun depan" (standalone) still does.

---

## 2. Money Parsing

### Two-Mode Rule (WAJIB)

| Mode | Format | Example |
|---|---|---|
| **Percakapan** (Q&A, confirmations) | Informal — mirror the customer's style | `"2-3.3 juta/malam"`, `"700K–1.2jt"` |
| **Summary brief ONLY** | Canonical `Rp X.XXX.XXX` | `Rp 2.600.000 - Rp 5.000.000/malam` |

```
[Conversation — any format is fine]
Customer : Villa sewanya 2-3.3 juta/malam
AI       : Baik! Ada villa 2–3.3 juta/malam. Mau yang 3.4–4.3 juta/malam juga dipertimbangkan?

[Summary — formal only]
✅ ✓ Budget: *Rp 700.000 - Rp 1.200.000/bulan*
❌ ✓ Budget: *700K–1.2jt/bulan*      ← forbidden in the summary
```

### Unit ladder

| Word | Multiplier | Aliases |
|---|---|---|
| ribu | × 1.000 | rb · K · k |
| juta | × 1.000.000 | jt · million · mil |
| **miliar** | × 1.000.000.000 | **m · M · billion · milyard** |
| triliun | × 1.000.000.000.000 | t · T · trillion |

> **⚠️ `m` / `M` = miliar (billion), never juta** — except in the context-sensitive cases below.
> If "3m/bulan" looks implausibly high for the type (e.g. a kos), confirm:
> *"Maksudnya 3 juta atau 3 miliar per bulan, Kak?"*

### Key rules

**Bare-number inheritance** — a unitless number takes a sensible unit from its partner:
`3.4juta-12` → Rp 3.400.000 – Rp 12.000.000 · `500-2 juta` → Rp 500.000 – Rp 2.000.000 ·
`24 juta - 100` → Rp 24.000.000 – Rp 100.000.000
If **both** sides are bare (`500-700`) → ask the customer to clarify.

**Reversed ranges always sort min→max:** `20juta-15.4juta` → Rp 15.400.000 – Rp 20.000.000

**USD → × Rp 18.000:** `30USD-20` → Rp 360.000 – Rp 540.000 (20 inherits USD)

**Counts and durations are NOT budgets:**
```
"3 kamar"      → bedrooms: 3        (NOT Rp 3.000.000)
"2 tahun"      → lease: 2 years     (NOT Rp 2.000.000)
"sudah 2 kali" → 2 viewings         (NOT Rp 2.000)
"lantai 12-15" → floor range        (NOT a budget — see doc 04 §Q12)
"20-30 Mei"    → a date range       (NOT a budget)
```

### 51 budget cases

| # | Input | Output |
|---|---|---|
| 1 | 2-3 juta | Rp 2.000.000 - Rp 3.000.000 |
| 2 | 4-5jt | Rp 4.000.000 - Rp 5.000.000 |
| 3 | 1.6-2.5juta | Rp 1.600.000 - Rp 2.500.000 |
| 4 | 4juta-5jt | Rp 4.000.000 - Rp 5.000.000 |
| 5 | 3 jt-7 juta | Rp 3.000.000 - Rp 7.000.000 |
| 6 | 3.4juta-12 | Rp 3.400.000 - Rp 12.000.000 |
| 7 | 500-2 juta | Rp 500.000 - Rp 2.000.000 |
| 8 | 812-15jt | Rp 812.000 - Rp 15.000.000 |
| 9 | 808-810 juta | Rp 808.000.000 - Rp 810.000.000 |
| 10 | 712-3 miliar | Rp 712.000.000 - Rp 3.000.000.000 |
| 11 | 24 juta - 100 | Rp 24.000.000 - Rp 100.000.000 |
| 12 | 80-20 juta | Rp 80.000 - Rp 20.000.000 |
| 13 | 80K-20juta | Rp 80.000 - Rp 20.000.000 |
| 14 | 80 K-20 | Rp 80.000 - Rp 20.000.000 |
| 15 | 3-5 m | Rp 3.000.000.000 - Rp 5.000.000.000 |
| 16 | 3 jt-5 m | Rp 3.000.000 - Rp 5.000.000.000 |
| 17 | 3 juta-5 m | Rp 3.000.000 - Rp 5.000.000.000 |
| 18 | 3-5 miliar | Rp 3.000.000.000 - Rp 5.000.000.000 |
| 19 | 312-2 miliar | Rp 312.000.000 - Rp 2.000.000.000 |
| 20 | 312-2m | Rp 312.000.000 - Rp 2.000.000.000 |
| 21 | 312 juta-2 miliar | Rp 312.000.000 - Rp 2.000.000.000 |
| 22 | 560K-900 | Rp 560.000 - Rp 900.000 |
| 23 | 560K-900 K | Rp 560.000 - Rp 900.000 |
| 24 | 560 K-900K | Rp 560.000 - Rp 900.000 |
| 25 | 837.000-900 | Rp 837.000 - Rp 900.000 |
| 26 | 89.000-2juta | Rp 89.000 - Rp 2.000.000 |
| 27 | 400 juta - 30 miliar | Rp 400.000.000 - Rp 30.000.000.000 |
| 28 | 20.000.000-30.000.000 | Rp 20.000.000 - Rp 30.000.000 |
| 29 | 20juta-15.4juta | Rp 15.400.000 - Rp 20.000.000 *(reversed)* |
| 30 | 814 juta-915K | Rp 915.000 - Rp 814.000.000 *(reversed)* |
| 31 | 2m-3.5m | Rp 2.000.000.000 - Rp 3.500.000.000 |
| 32 | 2 miliar-3.5m | Rp 2.000.000.000 - Rp 3.500.000.000 |
| 33 | 2 miliar-3.5 | Rp 2.000.000.000 - Rp 3.500.000.000 |
| 34 | 2-3.5 miliar | Rp 2.000.000.000 - Rp 3.500.000.000 |
| 35 | 2.7-3.5 m | Rp 2.700.000.000 - Rp 3.500.000.000 |
| 36 | 3.8m-2t | Rp 3.800.000.000 - Rp 2.000.000.000.000 |
| 37 | 721.5 miliar - 3t | Rp 721.500.000.000 - Rp 3.000.000.000.000 |
| 38 | 2 triliun-3 | Rp 2.000.000.000.000 - Rp 3.000.000.000.000 |
| 39 | 2 triliun-3 t | Rp 2.000.000.000.000 - Rp 3.000.000.000.000 |
| 40 | 2-3t | Rp 2.000.000.000.000 - Rp 3.000.000.000.000 |
| 41 | 2-3 triliun | Rp 2.000.000.000.000 - Rp 3.000.000.000.000 |
| 42 | 5milliar-900.145 | Rp 900.145.000 - Rp 5.000.000.000 *(reversed)* |
| 43 | 5m-900.145 | Rp 900.145.000 - Rp 5.000.000.000 |
| 44 | 5-900 juta | Rp 900.000.000 - Rp 5.000.000.000 *(reversed)* |
| 45 | 5-900K | Rp 900.000 - Rp 5.000.000 *(reversed)* |
| 46 | 300.000-4.000.000.000 | Rp 300.000 - Rp 4.000.000.000 |
| 47 | 300K-4.000.000.000 | Rp 300.000 - Rp 4.000.000.000 |
| 48 | 300K-4.8M | Rp 300.000 - Rp 4.800.000.000 |
| 49 | 8 triliun-2 | Rp 2.000.000.000.000 - Rp 8.000.000.000.000 *(reversed)* |
| 50 | 2-8triliun | Rp 2.000.000.000.000 - Rp 8.000.000.000.000 |
| 51 | 30USD-20 | Rp 360.000 - Rp 540.000 *(× Rp 18.000)* |

### Rental periods — 13 cases

Keywords: `/malam` · `/mlm` · `/night` · `/minggu` · `/week` · `/bulan` · `/month` · `/tahun` · `/year`

| # | Input | Output |
|---|---|---|
| 1 | 1.4 jt-800/malam | Rp 800.000 - Rp 1.400.000/malam *(reversed)* |
| 2 | 600-900K/mlm | Rp 600.000 - Rp 900.000/malam |
| 3 | 2.2 million-3 million/night | Rp 2.200.000 - Rp 3.000.000/night |
| 4 | 2.1-3 million/night | Rp 2.100.000 - Rp 3.000.000/night |
| 5 | 2.2-3 million/week | Rp 2.200.000 - Rp 3.000.000/week |
| 6 | 2.2-3 jt/minggu | Rp 2.200.000 - Rp 3.000.000/minggu |
| 7 | 9-12juta/minggu | Rp 9.000.000 - Rp 12.000.000/minggu |
| 8 | 9-12juta/tahun | Rp 9.000.000 - Rp 12.000.000/tahun |
| 9 | 12-9 million/year | Rp 9.000.000 - Rp 12.000.000/year *(reversed)* |
| 10 | 20-15 m/year *(m = juta here)* | Rp 15.000.000 - Rp 20.000.000/year |
| 11 | 700-1 m/tahun *(m = miliar here)* | Rp 700.000.000 - Rp 1.000.000.000/tahun |
| 12 | 2.6-3m/month *(m = juta here)* | Rp 2.600.000 - Rp 3.000.000/month |
| 13 | 4-7m/bulan *(m = miliar here)* | Rp 4.000.000.000 - Rp 7.000.000.000/bulan |

> **Cases 10 & 12 are context-sensitive.** When `m` appears with `/year` or `/month` in a
> small-looking range (2–20), the server may infer juta rather than miliar. When genuinely
> ambiguous, ask: *"Maksudnya 2,6 juta–3 juta atau 2,6 miliar–3 miliar per bulan, Kak?"*

**Period detection also accepts a bare count + unit** — "untuk 1 minggu saja", "3 malam"
(no `per`/`se-`/slash needed).

---

## Related Docs

- `04-qualification-flow.md` — Q3 budget tiers, Q8 date rules, summary formatting
- `02-language-and-intent.md` — budget echo formatting (dot notation)

# 10 — Date & Money Parsing Reference

The server parses dates and budgets **deterministically before you see them**. The results appear
as canonical strings in the QUALIFICATION STATE block.

> **Copy those strings verbatim — never reformat, recalculate, or re-interpret the raw text.**

---

## 1. Date Parsing (Q8 — move-in / check-in / target)

### 35 cases *(base date for all examples: 12 Juni 2026)*

| # | Customer input | Canonical output | Rule |
|---|---|---|---|
| 1 | Minggu depan | 24 Juni 2026 | Next week → +12 days |
| 2 | Besok | 13 Juni 2026 | Today + 1 |
| 3 | Bulan depan | 12 Juli 2026 | Next month, same day |
| 4 | 19 Agustus | 19 Agustus 2026 | Day in a future month → this year |
| 5 | 12 Mei | 12 Mei 2027 | Past month + day → next year |
| 6 | Tahun depan | 12 Juni 2027 | Next year, same date |
| 7 | 11 September 2026 | 11 September 2026 | Full date, 4-digit year |
| 8 | 11 September 26 | 11 September 2026 | 2-digit year → 20YY |
| 9 | 11 Sep 2026 | 11 September 2026 | Abbreviated month |
| 10 | 9 Feb 2027 | 9 Februari 2027 | Explicit future year |
| 11 | Maret, 12 | 12 Maret 2027 | Month, Day (past month) → next year |
| 12 | Desember, 28 | 28 Desember 2026 | Month, Day (future month) → this year |
| 13 | Dec, 28 2026 | 28 Desember 2026 | English abbreviated month + year |
| 14 | Dec, 28 2027 | 28 Desember 2027 | English month + explicit future year |
| 15 | 13/06/2026 | 13 Juni 2026 | First > 12 → unambiguous DD/MM |
| 16 | 02/07/2026 | 2 Juli 2026 | Ambiguous → default DD/MM |
| 17 | 06/15/2026 | 15 Juni 2026 | Second > 12 → MM/DD |
| 18 | 09/13/2026 | 13 September 2026 | Second > 12 |
| 19 | 01/15/2027 | 15 Januari 2027 | Second > 12 |
| 20 | 02/13/2027 | 13 Februari 2027 | Second > 12 |
| 21 | 01/05/2027 | 1 Mei 2027 | Both ≤ 12 → default DD/MM |
| 22 | 11/12/2026 | 11 Desember 2026 | Both ≤ 12 → default DD/MM |
| 23 | 2026 Agustus | 1 Agustus 2026 | YYYY Month → 1st |
| 24 | Mei | 1 Mei 2027 | Bare past month → 1st, next year |
| 25 | Juni | **⚠️ ASK FIRST** | Current month — exact date required |
| 26 | Juli | 1 Juli 2026 | Bare future month → 1st, this year |
| 27 | Agustus | 1 Agustus 2026 | Bare future month → 1st |
| 28 | Feb | 1 Februari 2027 | Bare past month (abbrev) → next year |
| 29 | Jan | 1 Januari 2027 | Bare past month → next year |
| 30 | 18 Jan | 18 Januari 2027 | Day + past month → next year |
| 31 | Aug 2 | 2 Agustus 2026 | English month + day (future) |
| 32 | Hari ini / Sekarang | 12 Juni 2026 | Today |
| 33 | June 12 2026 | 12 Juni 2026 | English full date |
| 34 | Lusa | 14 Juni 2026 | Today + 2 |
| 35 | Segera / ASAP / Cepat | **⚠️ ASK FIRST** | Urgency without a date |

### DD/MM vs MM/DD

| Situation | Format | Example |
|---|---|---|
| First number > 12 | DD/MM | `13/06` → 13 Juni |
| Second number > 12 | MM/DD | `06/15` → 15 Juni |
| Both ≤ 12 | **DD/MM (Indonesian default)** | `02/07` → 2 Juli |

### The two ASK-FIRST rules

**Rule 25 — bare current month** ("Juni" when today is June):
> "Kak, untuk bulan Juni rencananya tanggal berapa masuknya?"

**Rule 35 — urgency without a date** ("segera", "ASAP"):
> 1. "Kak, boleh tau kira-kira tanggalnya?"
> 2. "Baik, Kak. Mohon segera info tanggalnya ya."

For both: an answer → use it. Can't decide / silent / "belum tahu" → **"Waiting the update"**.
**Both are MANDATORY before the summary brief.**

### "Don't know" patterns → `Waiting the update`

```
belum tahu · belum pasti · belum fix · nanti aja · mungkin nanti · fleksibel
tidak tahu · gak tau · kapan aja · terserah · whenever · flexible
```
Summary line reads: `✓ Masuk: *Waiting the update*`

### Relative & corrected dates

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

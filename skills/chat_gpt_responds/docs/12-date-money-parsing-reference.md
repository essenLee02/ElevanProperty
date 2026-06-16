# 12 — Date & Money Parsing Reference

The server parses customer date and budget inputs deterministically before the AI sees them.
The results appear as canonical strings inside the **QUALIFICATION STATE** block injected in every prompt.
**Copy those strings verbatim — never reformat, recalculate, or guess.**

---

## Date Parsing (Q8 — Move-in / Check-in / Target Date)

### Reference Table — 35 Cases
*(Base date for all examples: 12 Juni 2026)*

| # | Customer Input | Canonical Output | Rule |
|---|---|---|---|
| 1 | Minggu depan | 24 Juni 2026 | Next week → +12 days |
| 2 | Besok | 13 Juni 2026 | Tomorrow → today + 1 |
| 3 | Bulan depan | 12 Juli 2026 | Next month, same day |
| 4 | 19 Agustus | 19 Agustus 2026 | Specific day in future month → this year |
| 5 | 12 Mei | 12 Mei 2027 | Past month + day → next year |
| 6 | Tahun depan | 12 Juni 2027 | Next year, same date |
| 7 | 11 September 2026 | 11 September 2026 | Full date with 4-digit year |
| 8 | 11 September 26 | 11 September 2026 | 2-digit year → 20YY |
| 9 | 11 Sep 2026 | 11 September 2026 | Abbreviated month name |
| 10 | 9 Feb 2027 | 9 Februari 2027 | Explicit future year |
| 11 | Maret, 12 | 12 Maret 2027 | Month, Day (past month) → next year |
| 12 | Desember, 28 | 28 Desember 2026 | Month, Day (future month) → this year |
| 13 | Dec, 28 2026 | 28 Desember 2026 | English abbreviated month + year |
| 14 | Dec, 28 2027 | 28 Desember 2027 | English month + explicit future year |
| 15 | 13/06/2026 | 13 Juni 2026 | DD/MM/YYYY — first > 12, unambiguous DD |
| 16 | 02/07/2026 | 2 Juli 2026 | DD/MM/YYYY — ambiguous, default DD/MM (Indonesian) |
| 17 | 06/15/2026 | 15 Juni 2026 | MM/DD/YYYY — second > 12 → MM/DD |
| 18 | 09/13/2026 | 13 September 2026 | MM/DD/YYYY — second > 12 |
| 19 | 01/15/2027 | 15 Januari 2027 | MM/DD/YYYY — second > 12 |
| 20 | 02/13/2027 | 13 Februari 2027 | MM/DD/YYYY — second > 12 |
| 21 | 01/05/2027 | 1 Mei 2027 | DD/MM/YYYY — both ≤ 12, default DD/MM |
| 22 | 11/12/2026 | 11 Desember 2026 | DD/MM/YYYY — both ≤ 12, default DD/MM |
| 23 | 2026 Agustus | 1 Agustus 2026 | YYYY Month → 1st of that month |
| 24 | Mei | 1 Mei 2027 | Bare past month → 1st of month, next year |
| 25 | Juni | **⚠️ ASK FIRST** | Current month — exact date required (see Rule 25) |
| 26 | Juli | 1 Juli 2026 | Bare future month → 1st of month, this year |
| 27 | Agustus | 1 Agustus 2026 | Bare future month → 1st of month |
| 28 | Feb | 1 Februari 2027 | Bare past month (abbreviated) → next year |
| 29 | Jan | 1 Januari 2027 | Bare past month → next year |
| 30 | 18 Jan | 18 Januari 2027 | Day + past month → next year |
| 31 | Aug 2 | 2 Agustus 2026 | English month + day (future) |
| 32 | Hari ini / Sekarang | 12 Juni 2026 | Today's date |
| 33 | June 12 2026 | 12 Juni 2026 | English full date |
| 34 | Lusa | 14 Juni 2026 | Day after tomorrow → today + 2 |
| 35 | Segera / ASAP / Cepat | **⚠️ ASK FIRST** | Urgency without date (see Rule 35) |

---

### DD/MM vs MM/DD Disambiguation

| Situation | Format | Example → Result |
|---|---|---|
| First number > 12 | DD/MM | `13/06` → 13 Juni |
| Second number > 12 | MM/DD | `06/15` → 15 Juni |
| Both ≤ 12 | **DD/MM (default — Indonesian standard)** | `02/07` → 2 Juli |

---

### Rule 25 — Current Month (Bare)

Customer says only the current month name (e.g., "Juni" when today is June):

> "Kak, untuk bulan Juni rencananya tanggal berapa masuknya?"

- Customer answers a specific date → use it
- Customer can't decide / stays silent / says "belum tahu" → **"Waiting the update"**
- **MANDATORY before showing summary brief**

---

### Rule 35 — Segera / ASAP

Customer expresses urgency without a specific date:

> 1. "Kak, boleh tau kira-kira tanggalnya?"
> 2. "Baik, Kak. Mohon segera info tanggalnya ya."

- Customer answers → use the date
- Customer can't decide / stays silent → **"Waiting the update"**
- **MANDATORY before showing summary brief**

---

### "Don't Know" Patterns → "Waiting the update"

When customer uses any of these → server sets date to `Waiting the update`:

```
belum tahu · belum pasti · belum fix · nanti aja · mungkin nanti ·
fleksibel · tidak tahu · gak tau · kapan aja · terserah · whenever · flexible
```

Summary line reads: `✓ Masuk: *Waiting the update*`

---

## Budget / Money Parsing

### Two-Mode Rule (WAJIB DIPAHAMI)

| Mode | Format | Contoh |
|---|---|---|
| **Percakapan** (Q&A, tanya balik, konfirmasi) | Informal — ikuti gaya customer | `"2-3.3 juta/malam"`, `"700K–1.2jt"`, `"80–100 juta/tahun"` |
| **Summary brief SAJA** | Kanonik `Rp X.XXX.XXX` | `Rp 2.600.000 - Rp 5.000.000/malam` |

```
[Percakapan — semua format boleh]
Customer : Villa sewanya 2-3.3 juta/malam
AI       : Baik! Ada villa 2–3.3 juta/malam. Mau yang 3.4–4.3 juta/malam juga dipertimbangkan?

Customer : Cari kost yang 700K-1.2jt
AI       : Siap! Budget 700K–1.2jt/bulan, Kak?

[Summary brief — format wajib formal]
✓ Budget: *Rp 700.000 - Rp 1.200.000/bulan*
❌ ✓ Budget: *700K–1.2jt/bulan*   ← DILARANG di summary
```

---

### Unit Ladder

| Word | Multiplier | Aliases |
|---|---|---|
| ribu | × 1.000 | rb · K · k |
| juta | × 1.000.000 | jt · million · mil |
| **miliar** | × 1.000.000.000 | **m · M · billion · milyard** |
| triliun | × 1.000.000.000.000 | t · T · trillion |

> **⚠️ `m` / `M` ALWAYS = miliar (billion), NEVER juta (million).**
> If customer says "3m/month" in a context that seems very low (e.g., kos), ask for confirmation:
> "Maksudnya 3 juta atau 3 miliar per bulan, Kak?"

---

### Key Rules

**Bare number inheritance** — a number without unit inherits a sensible unit from its partner:
- `3.4juta-12` → Rp 3.400.000 - Rp 12.000.000 *(12 inherits juta)*
- `500-2 juta` → Rp 500.000 - Rp 2.000.000 *(500 inherits thousand-scale)*
- `24 juta - 100` → Rp 24.000.000 - Rp 100.000.000 *(100 inherits juta)*

**Reversed ranges → always sort min→max:**
- `20juta-15.4juta` → Rp 15.400.000 - Rp 20.000.000
- `814 juta-915K` → Rp 915.000 - Rp 814.000.000

**USD → × Rp 18.000:**
- `30USD-20` → Rp 360.000 - Rp 540.000 *(20 also in USD)*

**Counts and durations are NOT budget:**
```
"3 kamar"  → bedrooms: 3      (NOT Rp 3.000.000)
"2 tahun"  → lease: 2 years   (NOT Rp 2.000.000)
```

---

### Reference Table — 51 Budget Cases

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
| 29 | 20juta-15.4juta | Rp 15.400.000 - Rp 20.000.000 *(reversed → sorted)* |
| 30 | 814 juta-915K | Rp 915.000 - Rp 814.000.000 *(reversed → sorted)* |
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
| 42 | 5milliar-900.145 | Rp 900.145.000 - Rp 5.000.000.000 *(reversed → sorted)* |
| 43 | 5m-900.145 | Rp 900.145.000 - Rp 5.000.000.000 |
| 44 | 5-900 juta | Rp 900.000.000 - Rp 5.000.000.000 *(reversed → sorted)* |
| 45 | 5-900K | Rp 900.000 - Rp 5.000.000 *(reversed → sorted)* |
| 46 | 300.000-4.000.000.000 | Rp 300.000 - Rp 4.000.000.000 |
| 47 | 300K-4.000.000.000 | Rp 300.000 - Rp 4.000.000.000 |
| 48 | 300K-4.8M | Rp 300.000 - Rp 4.800.000.000 |
| 49 | 8 triliun-2 | Rp 2.000.000.000.000 - Rp 8.000.000.000.000 *(reversed → sorted)* |
| 50 | 2-8triliun | Rp 2.000.000.000.000 - Rp 8.000.000.000.000 |
| 51 | 30USD-20 | Rp 360.000 - Rp 540.000 *(×Rp 18.000, both sides USD)* |

---

### Rental Period Reference — 13 Cases

Period keywords: `/malam` · `/mlm` · `/night` · `/minggu` · `/week` · `/bulan` · `/month` · `/tahun` · `/year`

| # | Input | Output |
|---|---|---|
| 1 | 1.4 jt-800/malam | Rp 800.000 - Rp 1.400.000/malam *(reversed → sorted)* |
| 2 | 600-900K/mlm | Rp 600.000 - Rp 900.000/malam |
| 3 | 2.2 million-3 million/night | Rp 2.200.000 - Rp 3.000.000/night |
| 4 | 2.1-3 million/night | Rp 2.100.000 - Rp 3.000.000/night |
| 5 | 2.2-3 million/week | Rp 2.200.000 - Rp 3.000.000/week |
| 6 | 2.2-3 jt/minggu | Rp 2.200.000 - Rp 3.000.000/minggu |
| 7 | 9-12juta/minggu | Rp 9.000.000 - Rp 12.000.000/minggu |
| 8 | 9-12juta/tahun | Rp 9.000.000 - Rp 12.000.000/tahun |
| 9 | 12-9 million/year | Rp 9.000.000 - Rp 12.000.000/year *(reversed → sorted)* |
| 10 | 20-15 m/year *(note: m=juta here)* | Rp 15.000.000 - Rp 20.000.000/year |
| 11 | 700-1 m/tahun *(note: m=miliar here)* | Rp 700.000.000 - Rp 1.000.000.000/tahun |
| 12 | 2.6-3m/month *(note: m=juta here)* | Rp 2.600.000 - Rp 3.000.000/month |
| 13 | 4-7m/bulan *(note: m=miliar here)* | Rp 4.000.000.000 - Rp 7.000.000.000/bulan |

> **Cases 10 & 12 — context-sensitive:** When `m` appears with `/year` or `/month` in a small-looking
> range (2–20), the server may infer juta rather than miliar. When genuinely ambiguous, ask:
> *"Maksudnya 2,6 juta–3 juta atau 2,6 miliar–3 miliar per bulan, Kak?"*

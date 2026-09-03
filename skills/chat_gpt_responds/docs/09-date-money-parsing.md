# 09 — Date & Money Parsing Reference

Dates and budgets may already appear as canonical strings in a captured-state block. When they
do, they are settled — use them as they stand.

> **Copy those strings verbatim — never reformat, recalculate, or re-interpret the raw text.**
> You are never asked to parse "7 bulan lagi" or "2-3 juta" yourself — the state block already
> holds it. Your job below is the judgment no normalization can make for you: when to ask
> instead of guessing, and how to phrase dates and money back to the customer. Where no
> canonical value is given, work it out yourself using the rules below.

---

## 1. Dates (Q8 move-in/check-in/target date, AND jadwal survei/viewing)

Same rules for both "kapan mau masuk/pindah?" (Q8) and "kapan bisa survei?" (viewing) — only the
destination slot differs.

**Ask first, don't guess, in exactly two cases:**
- **Bare current month, no day** ("Juni" when today is in June) → *"Kak, untuk bulan Juni
  rencananya tanggal berapa masuknya?"*
- **Urgency without a date** ("segera"/"ASAP"/"cepat") → *"Kak, boleh tau kira-kira tanggalnya?"*,
  then a gentle follow-up if it's still not given.

Either way: an answer → use it. Can't decide / silent / "belum tahu·belum pasti·nanti aja·
fleksibel·terserah·whenever" → summary line reads `✓ Masuk: *Waiting the update*`.

**Past-date rejection — explicit year only.** If the customer states a year that has already
passed, don't silently accept or auto-correct it — say today's date and offer the likely fix:
> "Kak, tanggal 23 Juni 2026 sudah lewat — hari ini sudah 29 Juli 2026. Mungkin maksudnya 23 Juni
> **2027**?"

A date with **no year** is never rejected this way — it silently resolves to the nearest future
occurrence.

**Viewing-specific notes:**
- A relative viewing date ("survei 3 minggu lagi") resolves to a concrete date, scoped to its own
  clause — it never overwrites the move-in date.
- A correction ("ralat, bukan Mei — Juli") overwrites the earlier value; acknowledge it:
  *"✏️ sudah saya perbarui"*.

---

## 2. Money

**Two-Mode Rule (WAJIB):**

| Mode | Format |
|---|---|
| Conversation (Q&A, confirmations) | Informal — mirror the customer's own style (`"2-3.3 juta/malam"`) |
| Summary brief ONLY | Canonical `Rp X.XXX.XXX` (`Rp 2.000.000 - Rp 3.000.000/malam`) |

Never write the informal shorthand (`700K–1.2jt`) inside the final summary — always the full
`Rp` format there, and only there.

**The one real judgment call — ambiguous "m".** `m`/`M` defaults to *miliar* (billion), not
*juta*. If a value like "3m/bulan" looks implausibly high for the property type (e.g. a kos),
confirm rather than assume: *"Maksudnya 3 juta atau 3 miliar per bulan, Kak?"*

**Not a budget, even though it's a number + range:** bedroom/unit/floor counts ("3 kamar",
"lantai 12-15"), lease duration ("2 tahun"), viewing counts ("sudah 2 kali"), and date ranges
("20-30 Mei"). If the state block didn't put it in `budget`, don't treat it as one.

---

## Related Docs

- `03-qualification-flow.md` — Q3 budget tiers, Q8 date rules, summary formatting
- `01-language-and-intent.md` — budget echo formatting (dot notation)

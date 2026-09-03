# 11 — Facilities Reference & Recognition

> **Conditional doc.** Loaded only when the conversation mentions facilities/amenities.

---

## 1. Source of Truth — real data first, general knowledge to fill the gaps

Your context may carry a real facility reference listing the agent's actual registered
facilities for this catalog. **When it's there, it always wins** — never contradict it, never
invent a name absent from it, never substitute a guess for what it actually says.

When no such real list is present for the point you're at, you already know common
Indonesian/English real-estate facility vocabulary (AC, kolam renang, kitchen set, CCTV, one
gate system, and their spelling variants) — use that general knowledge to understand and
acknowledge what the customer is asking for. You don't need a lookup table for it, and you don't
need to know how or where the real data comes from — just prefer it over your own guess whenever
it's actually in front of you.

---

## 2. Handling a Facility Mention

1. Match the customer's wording to the live registered list.
2. Acknowledge specifically — name what you matched, so the customer feels heard.
3. Accumulate across the whole session — facilities mentioned back in Q2b still count.
4. Collect into the summary, comma-joined: `✓ Fasilitas: AC, Gym, Kolam renang`.

Normalize internally to the canonical name; reply in the customer's language. A language switch
mid-chat doesn't invalidate facilities already captured.

---

## 3. Q_FAC — The Facilities Question

Mandatory for `sewa`. Recommended for `beli` residential. Skipped for commercial types. Fires
after Q11 (furnishing), before the summary — **never show a `sewa` summary before it's asked**,
and never render a "not asked" placeholder as if it were an answered value.

---

## 4. "Standar / terserah" answers — never leave empty, always expand

"Standar", "terserah", "biasa", "apa aja", "bebas", "ngikut aja", "ga ada preferensi", and similar
deflections **are** a complete answer, not a gap — never re-ask, never leave the field empty and
never write a bare "✓ Fasilitas: Standar" (the word alone is useless to the agent).

If a real standard-facility list for that property type is present in your context, expand
"standar" into it — that's more reliable than composing one from memory. If none is present,
describe the facilities **typically** included for that property type, using your own real-estate
knowledge — clearly as a general/typical set, never asserted as this specific unit's confirmed
inventory.

**Customer's own items always go first, standard items follow — append, never replace:**
```
Customer: "Terserah aja, pokok ada AC dan gym"   (apartemen)
✓ Fasilitas: AC, Gym, [+ the standard apartment facilities]
```
Even when the customer names specific items, the type's full standard list still gets appended
(deduped) — "terserah" only ever *adds* coverage, never narrows it.

---

## 5. Premium Facilities

When the customer signals **mewah / eksklusif / premium / luxury / fully furnished**, or already
picked the "eksklusif" budget tier, you may add a small set of premium/luxury amenities on top of
the standard list — never in place of it. Draw from a real premium list in your context if one is
present, otherwise use your own judgment of what reads as genuinely premium for that property
type. Pick only the handful that plausibly fit the type + location + what the customer described;
don't dump a long generic list into a summary line (a "Private Beach Access" rarely belongs on a
city apartment).

**Ranking, not filtering.** Requested facilities boost catalog ranking (`08 §4`) — they never
exclude a listing. A listing lacking a requested amenity still appears, just lower; the customer
always sees the closest available alternatives rather than zero results.

---

## Related Docs

- `03-qualification-flow.md` — where Q_FAC sits in the sequence, summary field rules
- `07-catalog-and-recommendations.md` — how facilities affect catalog ranking
- `12-locations-and-landmarks.md` — the location-anchor counterpart of this reference

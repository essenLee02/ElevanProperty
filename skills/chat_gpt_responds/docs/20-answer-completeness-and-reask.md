# 20 — Answer Completeness & Re-Ask Protocol

**Purpose:** Guarantee that **every mandatory question is genuinely answered** before a summary/brief
is shown — and when a slot is still empty, vague, or only *partially* answered, re-ask it cleanly
(one slot per message) instead of skipping it or looping.

Pair with:
- `docs/09-qualification-flow.md` — the Q1–Q12 sequence + server-injected `⚡ PERTANYAAN BERIKUTNYA`.
- `docs/13-customer-conditions-and-tone.md` — *how* to phrase re-asks for lazy/confused/terse customers.

**Golden rule:** *Lebih baik bertanya satu kali lagi daripada menebak atau menampilkan summary yang bolong.*
(Better to ask once more than to guess or show an incomplete summary.)

---

## 1. The Completeness Contract

A field counts as **✅ ANSWERED** only when the customer supplied a **concrete, usable value** for it.
The server's QUALIFICATION STATE is the source of truth — but use this table to judge whether a raw
reply actually *fills* the slot or still needs a re-ask.

| Slot | ✅ Counts as answered | ❓ Still needs re-ask |
|---|---|---|
| **Q1 Transaksi** | sewa / beli / kontrak / booking | "cari properti" (tak jelas sewa/beli) |
| **Building type** | rumah, villa, kos, ruko, … | "properti aja", "yang bagus" |
| **Q2 Lokasi** | kota / area konkret | "di mana aja", "terserah" → re-ask ONCE with options |
| **Q3 Budget** | angka+satuan uang, ATAU kategori (`terjangkau/menengah/eksklusif`), ATAU "yang murah" | diam, "belum tau" (1×→offer 2 anchors) |
| **Q8 Tanggal masuk / check-in** | bulan / tanggal / "secepatnya" / "N minggu lagi" | belum disebut sama sekali (MANDATORY) |
| **Q4 Penghuni** *(hunian, own-living)* | "sendiri", "sama istri", "keluarga 4" | (skip untuk investasi/usaha/ibadah) |
| **Q_FAC Fasilitas** *(sewa wajib)* | ≥1 amenity ATAU "standar/terserah" | belum ditanya → tanya sebelum summary |
| Type-specific Q14 | nilai konkret (lihat doc 11) | belum diisi → tanya sesuai prioritas tipe |

**Mandatory-before-summary (never skip):** Q1 transaksi · building type · Q2 lokasi · Q3 budget ·
Q8 tanggal · (sewa) Q_FAC · (beli) Q_KPR financing.
Everything else is **best-effort**: ask within the 12-message budget, but a hard block only on the mandatory set.

---

## 2. Verification Pass (run mentally before EVERY reply)

Before you answer, do this 3-step check:

1. **Read the QUALIFICATION STATE**, not the raw history. Find the smallest-numbered ❓ mandatory slot.
2. **Did the customer's latest message just fill one or more slots?** Acknowledge them in ≤1 short clause.
3. **Is there still a ❓ mandatory slot?**
   - **Yes →** ask exactly that ONE slot (follow `⚡ PERTANYAAN BERIKUTNYA`). Do not summarize.
   - **No →** all mandatory ✅ → show the summary brief.

> ⛔ Never show a summary while any mandatory slot is ❓ — even if the word appears in old history.
> ⛔ Never ask a slot that is already ✅ (that is looping — see §6).

---

## 3. Partial-Answer Detection (compound questions)

Many questions bundle two asks (e.g. Q2b "berapa properti + apa yang belum cocok", or a lazy combined
"budget & kamar?"). A customer often answers **only one half**. Capture the half they gave, then re-ask
**only the missing half** — never re-ask the whole thing.

```
AI       : Budget per bulan & berapa kamar?
Customer : 3 kamar
→ captured: bedrooms=3 ; budget still ❓
AI       : Oke, 3 kamar 👍 Untuk budget-nya, lebih prefer *terjangkau*, *menengah*, atau *eksklusif*?
```

```
AI       : Rencananya masuk kapan, dan sewa berapa lama?
Customer : bulan depan
→ captured: moveIn=bulan depan ; duration still ❓
AI       : Siap, masuk bulan depan 📅 Sewanya rencana berapa lama — 6 bulan, 1 tahun, atau lebih?
```

**Rule:** acknowledge the captured half by name so the customer sees it was heard, then ask the
remaining half only. This prevents the "kok nanya lagi?" frustration.

---

## 4. Non-Answer & Evasive-Answer Handling ("gak tau / terserah / bebas / mana aja")

When the customer **deflects** a mandatory slot, do NOT accept silence and do NOT drop the slot.
Escalate through exactly two levels, then stop:

**Level 1 — first deflection → convert into a 2–3 option choice (anchor).**

| Slot | Deflection | Level-1 re-ask |
|---|---|---|
| Budget | "belum tau", "berapa ya" | "Gak masalah 😊 Untuk [tipe] di [kota] umumnya ada di ~[LOW] dan ada yang [HIGH] — lebih pas yang mana?" |
| Lokasi | "di mana aja", "terserah" | "Biar saya carikan yang pas — lebih prefer area [A], [B], atau dekat [landmark]?" |
| Tanggal | "belum kepikiran" | "Kira-kira *bulan ini*, *bulan depan*, atau *masih 2–3 bulan lagi*?" |
| Fasilitas | "terserah", "standar aja" | Accept as *fasilitas standar* → list the type's standard set, mark ✅, move on. |

**Level 2 — second deflection on the SAME slot → apply a sensible default, state it, and MOVE ON.**

```
AI       : Budget-nya lebih pas yang mana — ~5jt atau ~8jt/bln?
Customer : bebas lah, yang penting bagus
AI       : Oke, saya patok di kisaran menengah (~5–8jt/bln) dulu ya — nanti bisa disesuaikan 👍 [→ next slot]
```

> ⛔ **Never ask the same mandatory slot a 3rd time.** Two tries max: option-ize, then default-and-proceed.
> The only true hard-stops (where you keep the slot ❓ and cannot summarize) are Q1 transaksi, building
> type, and Q2 lokasi — for these, if still empty after Level 1, re-offer options warmly but do not fabricate.

---

## 5. Lazy / Terse Chat — Extract Many, Re-Ask Only the Gaps

(Extends `docs/13` C2.) When the customer types short, **mine every slot from the single line first**,
mark them ✅ silently, then re-ask only the still-❓ mandatory ones — in short questions to match pace.

```
Customer : sewa villa kediri 3 kamar 1 minggu ac kolam renang
→ extract: tx=sewa, type=villa, city=Kediri, bedrooms=3, duration=1 minggu,
           facilities=[AC, kolam renang]  |  still ❓: budget, tanggal masuk
AI       : Mantap, saya catat: 3 kamar, 1 minggu, AC + kolam renang 👍
           Budget/minggu-nya kira-kira berapa?      ← ask ONLY the gap
Customer : 5 jutaan
AI       : Oke 5jt/minggu. Rencana check-in tanggal berapa?   ← last mandatory gap
```

**Anti-pattern (the bug this prevents):** ignoring the extracted 3-kamar/1-minggu/fasilitas and
re-emitting the *identical* budget question with no acknowledgement. Always name what you captured —
it both confirms to the customer and keeps each reply textually distinct.

---

## 6. Anti-Loop Guard

A "loop" = asking a slot that is already ✅, or re-asking the exact same wording twice.

- **Trust the STATE block, not raw history.** If `Budget [Q3]: ✅ 5jt` appears, budget is DONE — never re-ask.
- If you notice you would repeat a question already ✅ → skip it, jump to the next ❓.
- If the customer repeats the *same* answer twice, you already looped once — acknowledge and advance immediately.
- Vary phrasing between re-asks; never resend byte-identical text (some WhatsApp gateways silently drop duplicates).

---

## 7. Confused / First-Timer Completeness ("bingung", "gak ngerti", "saran dong")

Confused customers can't answer a slot they don't understand. Convert the slot into a **guided choice
with a hint of the consequence**, capture whatever they pick, and proceed. (Tone → `docs/13` C7.)

```
AI       : Furnished, semi, atau kosongan?
Customer : bingung, bedanya apa
AI       : Gampangnya: *furnished* = tinggal bawa koper, *semi* = ada perabot inti (kasur+dapur),
           *kosongan* = isi sendiri (biasanya paling murah). Lebih sreg yang mana? 😊
Customer : yang tinggal bawa koper
AI       : Siap, full furnished 👍 [→ next ❓]
```

Never leave a confused customer's slot ❓ just because they asked back — answer the confusion **and**
re-pose the choice in the same message, so the slot still gets filled.

---

## 8. Completeness Checklist by Transaction (quick reference)

**SEWA (rent) — mandatory ✅ before summary:**
`transaksi · tipe · lokasi · budget · tanggal masuk · fasilitas (Q_FAC)`
best-effort: penghuni, durasi, furnishing, patokan, area alternatif, viewing.

**BELI (buy) — mandatory ✅ before summary:**
`transaksi · tipe · lokasi · budget · target waktu · financing (Q_KPR)`
best-effort: penghuni/peruntukan, kondisi (baru/second/inden), patokan, viewing; if KPR → bank+DP.

**BOOKING (hotel/kondotel/villa harian) — mandatory ✅:**
`tipe · lokasi · budget/malam · check-in · check-out (atau jumlah malam) · jumlah tamu`
best-effort: tipe kamar, breakfast, private pool (villa).

If any mandatory slot for the active transaction is ❓ → keep qualifying, one question per message.
Only when the full mandatory set is ✅ → summary brief.

---

## 9. Worked Example — Completeness Recovery

```
Customer : mau sewa kos surabaya                         → tx=rent, type=kos, city=Surabaya ✅
AI       : Kos-nya untuk *putra*, *putri*, atau *campur*?
Customer : putri                                          → kosType ✅  (budget, tanggal ❓)
AI       : Oke kos putri 👍 Budget/bulan lebih prefer *terjangkau*, *menengah*, atau *eksklusif*?
Customer : gak tau sih                                    → deflection L1
AI       : Santai 😊 Kos putri Surabaya umumnya ~800rb–1,5jt (terjangkau) atau ~2–3,5jt (nyaman ber-AC). Yang mana?
Customer : yang ac aja                                    → budget=menengah ✅
AI       : Sip, yang ber-AC ~2–3,5jt/bln. Rencana masuk kapan?   ← last mandatory (Q8)
Customer : secepatnya                                     → moveIn=secepatnya ✅
AI       : Ada fasilitas wajib lain? (kamar mandi dalam, WiFi, dapur bersama, dll)  ← Q_FAC
Customer : km dalam + wifi                                → facilities ✅ → semua mandatory ✅
AI       : [Summary brief]
```

Every mandatory slot ends ✅; no slot was asked twice; each deflection was converted to a choice, not dropped.

---

## Related Docs
- `docs/09-qualification-flow.md` — Q sequence, state injector, ⚡ NEXT ACTION, summary rules.
- `docs/10-property-type-playbooks.md` — per-type slot order & skip rules.
- `docs/11-property-type-conversation-patterns.md` — per-type Q14 slots.
- `docs/13-customer-conditions-and-tone.md` — C1–C9 tone for lazy/confused/terse re-asks.

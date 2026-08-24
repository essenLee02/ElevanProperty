# 05 — Answer Completeness & Re-Ask Protocol

**Purpose:** guarantee that every mandatory question is *genuinely* answered before a summary is
shown — and when a slot is still empty, vague, or only partially answered, re-ask it cleanly
(one slot per message) instead of skipping it or looping.

> **Golden rule:** *Lebih baik bertanya satu kali lagi daripada menebak atau menampilkan summary
> yang bolong.* — Better to ask once more than to guess or show an incomplete summary.

---

## 1. The Completeness Contract

A field counts as **✅ ANSWERED** only when the customer supplied a **concrete, usable value**.
The QUALIFICATION STATE is the source of truth; this table judges whether a raw reply actually
*fills* the slot.

| Slot | ✅ Counts as answered | ❓ Still needs a re-ask |
|---|---|---|
| **Q1 Transaksi** | sewa / beli / kontrak / booking | "cari properti" (unclear) |
| **Building type** | rumah, villa, kos, ruko, … | "properti aja", "yang bagus" |
| **Q2 Lokasi** | a concrete city/area | "di mana aja", "terserah" → re-ask ONCE with options |
| **Q3 Budget** | number + money unit, OR a tier (`terjangkau/menengah/eksklusif`), OR "yang murah" | silence, "belum tau" (1× → offer anchors) |
| **Q8 Tanggal / check-in** | month / date / "secepatnya" / "N minggu lagi" | never mentioned (MANDATORY) |
| **Q4 Penghuni** *(own-living only)* | "sendiri", "sama istri", "keluarga 4" | *(skipped for investasi/usaha/ibadah)* |
| **Q_FAC Fasilitas** *(sewa)* | ≥1 amenity OR "standar/terserah" | never asked → ask before summary |
| **Type-specific Q14** | a concrete value (doc 07) | unfilled → ask per type priority |

**Mandatory before summary (never skip):** Q1 transaksi · building type · Q2 lokasi · Q3 budget ·
Q8 tanggal · *(sewa)* Q_FAC · *(beli)* Q_KPR financing.
Everything else is **best-effort**: ask within the message budget, but hard-block only on the
mandatory set.

---

## 2. Verification Pass (run mentally before EVERY reply)

1. **Read the QUALIFICATION STATE**, not raw history. Find the lowest-numbered ❓ mandatory slot.
2. **Did the latest message just fill any slots?** Acknowledge them in ≤1 short clause.
3. **Is a mandatory slot still ❓?**
   - **Yes →** ask exactly that ONE slot (follow `⚡ PERTANYAAN BERIKUTNYA`). Do not summarize.
   - **No →** all mandatory ✅ → show the summary brief.

> ⛔ Never summarize while a mandatory slot is ❓ — even if the value appears in old history.
> ⛔ Never ask a slot already ✅ — that is looping (§6).

---

## 3. Partial-Answer Detection (compound questions)

Many questions bundle two asks. Customers often answer **one half**. Capture that half, then
re-ask **only the missing half** — never the whole thing again.

```
AI       : Budget per bulan & berapa kamar?
Customer : 3 kamar
→ captured: bedrooms=3 ; budget still ❓
AI       : Oke, 3 kamar 👍 Untuk budget-nya, lebih prefer *terjangkau*, *menengah*, atau *eksklusif*?
```

```
AI       : Rencananya masuk kapan, dan sewa berapa lama?
Customer : bulan depan
→ captured: moveIn ; duration still ❓
AI       : Siap, masuk bulan depan 📅 Sewanya rencana berapa lama — 6 bulan, 1 tahun, atau lebih?
```

**Name the captured half** so the customer sees it was heard. This prevents the "kok nanya lagi?"
frustration.

---

## 4. Non-Answers & Deflection ("gak tau / terserah / bebas / mana aja")

When a customer deflects a mandatory slot, don't accept silence and don't drop the slot.
Escalate through exactly **two levels**, then stop.

**Level 1 — first deflection → convert into a 2–3 option choice.**

| Slot | Deflection | Level-1 re-ask |
|---|---|---|
| Budget | "belum tau", "berapa ya" | "Gak masalah 😊 Untuk [tipe] di [kota] ada yang *terjangkau*, *menengah*, atau *eksklusif* — lebih pas yang mana?" |
| Lokasi | "di mana aja" | "Biar saya carikan yang pas — lebih prefer area [A], [B], atau dekat [landmark]?" |
| Tanggal | "belum kepikiran" | "Kira-kira *bulan ini*, *bulan depan*, atau *masih 2–3 bulan lagi*?" |
| Fasilitas | "terserah", "standar aja" | Accept as *fasilitas standar* → list the type's standard set, mark ✅, move on |

**Level 2 — second deflection on the SAME slot → apply a sensible default, state it, move on.**
```
AI       : Budget-nya lebih pas yang mana — terjangkau atau menengah?
Customer : bebas lah, yang penting bagus
AI       : Oke, saya patok di kisaran menengah dulu ya — nanti bisa disesuaikan 👍 [→ next slot]
```

> ⛔ **Never ask the same mandatory slot a 3rd time.** Two tries max: option-ize, then
> default-and-proceed. The only true hard-stops (keep ❓, cannot summarize) are **Q1 transaksi**,
> **building type**, and **Q2 lokasi** — for those, re-offer options warmly, but never fabricate.

---

## 5. Lazy / Terse Chat — Extract Many, Re-Ask Only the Gaps

Mine **every** slot from the single line first, mark them ✅ silently, then ask only the
still-❓ mandatory ones, in short questions that match their pace.

```
Customer : sewa villa kediri 3 kamar 1 minggu ac kolam renang
→ extract: tx=sewa, type=villa, city=Kediri, bedrooms=3, duration=1 minggu,
           facilities=[AC, kolam renang]   |   still ❓: budget, tanggal
AI       : Mantap, saya catat: 3 kamar, 1 minggu, AC + kolam renang 👍
           Budget/minggu-nya kira-kira berapa?        ← ask ONLY the gap
Customer : 5 jutaan
AI       : Oke 5jt/minggu. Rencana check-in tanggal berapa?   ← last mandatory gap
```

**The anti-pattern this prevents:** ignoring the extracted 3-kamar/1-minggu/fasilitas and
re-emitting the *identical* budget question with no acknowledgement. Always name what you
captured — it confirms to the customer **and** keeps each reply textually distinct.

---

## 6. Anti-Loop Guard

A loop = asking a slot that is already ✅, or repeating the same wording twice.

- **Trust the STATE block, not raw history.** `Budget [Q3]: ✅ 5jt` means budget is DONE.
- If you're about to repeat a ✅ question → skip it, jump to the next ❓.
- If the customer repeats the *same answer* twice, you have already looped — acknowledge and
  advance immediately.
- **Vary phrasing between re-asks.** Never resend byte-identical text — some WhatsApp gateways
  silently drop duplicate messages, so the customer would see nothing at all.

---

## 7. Confused / First-Timer ("bingung", "gak ngerti", "saran dong")

A confused customer can't answer a slot they don't understand. Convert it into a **guided choice
with a hint of the consequence**, capture whatever they pick, and proceed.

```
AI       : Furnished, semi, atau kosongan?
Customer : bingung, bedanya apa
AI       : Gampangnya: *furnished* = tinggal bawa koper, *semi* = ada perabot inti (kasur+dapur),
           *kosongan* = isi sendiri (biasanya paling murah). Lebih sreg yang mana? 😊
Customer : yang tinggal bawa koper
AI       : Siap, full furnished 👍 [→ next ❓]
```

**Answer the confusion AND re-pose the choice in the same message**, so the slot still gets
filled. Never leave it ❓ just because they asked back.

---

## 8. Checklist by Transaction

**SEWA — mandatory before summary:**
`transaksi · tipe · lokasi · budget · tanggal masuk · fasilitas (Q_FAC)`
*best-effort:* penghuni, durasi, furnishing, patokan, area alternatif, viewing

**BELI — mandatory before summary:**
`transaksi · tipe · lokasi · budget · target waktu · financing (Q_KPR)`
*best-effort:* penghuni/peruntukan, kondisi (baru/second/inden), patokan, viewing; if KPR → bank + DP

**BOOKING (hotel/kondotel/villa harian) — mandatory:**
`tipe · lokasi · budget/malam · check-in · check-out (atau jumlah malam) · jumlah tamu`
*best-effort:* tipe kamar, breakfast, private pool (villa)

Any mandatory slot ❓ → keep qualifying, one question per message. Full set ✅ → summary brief.

---

## 9. Worked Example — Completeness Recovery

```
Customer : mau sewa kos surabaya            → tx=rent, type=kos, city=Surabaya ✅
AI       : Kos-nya untuk *putra*, *putri*, atau *campur*?
Customer : putri                             → kosType ✅   (budget, tanggal ❓)
AI       : Oke kos putri 👍 Budget/bulan lebih prefer *terjangkau*, *menengah*, atau *eksklusif*?
Customer : gak tau sih                       → deflection L1
AI       : Santai 😊 Kos putri Surabaya umumnya ~800rb–1,5jt (terjangkau) atau ~2–3,5jt
           (nyaman ber-AC). Yang mana?
Customer : yang ac aja                       → budget=menengah ✅
AI       : Sip, yang ber-AC. Rencana masuk kapan?              ← last mandatory (Q8)
Customer : secepatnya                        → moveIn ✅
AI       : Ada fasilitas wajib lain? (kamar mandi dalam, WiFi, dapur bersama, dll)   ← Q_FAC
Customer : km dalam + wifi                   → facilities ✅ → all mandatory ✅
AI       : [Summary brief]
```

Every mandatory slot ends ✅; nothing was asked twice; each deflection became a choice, not a drop.

---

## Related Docs

- `04-qualification-flow.md` — Q sequence, state injector, ⚡ NEXT ACTION, summary rules
- `06-customer-conditions-and-diagnosis.md` — C2/C7 tone for lazy and confused re-asks
- `07-property-type-playbooks.md` — per-type slot order, skip rules, Q14 slots

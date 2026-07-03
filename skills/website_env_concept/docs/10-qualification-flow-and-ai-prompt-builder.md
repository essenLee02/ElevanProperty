# 10. Q1–Q12 Qualification Flow & AI Prompt Builder

## Purpose

WhatsApp AI **SELALU** menjalankan **discovery conversation mode** (Q1–Q12), apa pun
nilai `RESPOND_CATALOG_RUN`:
- Ask Q1–Q12 in order to build a complete customer profile
- Show structured brief to agent once all required fields are collected
- Never re-ask a question that already has a ✅ answer

> **Arti `RESPOND_CATALOG_RUN` (baru):** flag ini **tidak** lagi mematikan Q1–Q12.
> Ia hanya menentukan isi SETELAH brief: `OFF` → cukup summary/brief saja;
> `ON` → brief + katalog rekomendasi dari property context. (Dulu keliru dipakai
> sebagai toggle seluruh mode.)

This system is 100% server-side. The AI never has to guess from raw history — it receives
an authoritative checklist extracted by `extractQualificationState()`.

---

## The 12 Qualification Questions

| Q | Field | State Key | Notes |
|---|---|---|---|
| Q1 | Transaction type | `transactionType` | sewa / beli |
| Q1b | Building type | `buildingType` | rumah/villa/apartemen/kos/ruko/gudang/kantor |
| Q2 | Location | `location` | city or area |
| Q2b | Search history | *(narrative in brief)* | "sudah lihat berapa properti?" |
| Q3 | Budget | `budget` | shown as price range, never asked directly |
| Q4 | Household | `household` | "tinggal bersama siapa?" — infers bedroom count |
| Q5 | Red flags | `redFlags` | deal-breakers (MANDATORY before summary) |
| Q6 | Anchor point | `anchorPoint` | nearby landmark (MANDATORY before summary) |
| Q7 | Alternative areas | `alternativeAreas` | other acceptable locations |
| Q8 | Move-in date | `moveInDate` | **MANDATORY — never skipped** |
| Q9 | Decision maker | `decisionMaker` | "Mandiri" / "Bersama istri" / etc. |
| Q10 | Lease duration | `leaseDuration` | only if transactionType=sewa |
| Q11 | Furnishing | `furnishing` | furnished / semi-furnished / kosongan |
| Q12 | Apartment pref | `apartmentPref` | only if buildingType=apartment |

**Question priority order** (findNextQuestion):
`Q1 → Q1b → Q2b → Q3 → Q8 → Q4 → Q5 → Q6 → Q7 → Q9 → Q10 → Q11 → Q12`

---

## `extractQualificationState(history, currentMessage)`

**File**: `backend/services/aiPromptBuilderService.js`

### Phase 0 — Active Session Start

Find the last summary message (contains "✅" or "✓" repeated pattern) to mark where
the active conversation starts. Only process messages AFTER the last summary.

### Phase 1 — Content-Detectable Fields (from customer messages)

Scans all customer messages (`role: 'user'|'customer'`) for directly detectable content:

| Field | Detection Pattern |
|---|---|
| Q1 (tx) | "sewa\|kontrak\|ngontrak\|beli\|jual" |
| Q1b (type) | "villa\|rumah\|apartemen\|kos\|kost\|ruko\|gudang\|kantor" |
| Q2 (location) | CITY_RE regex (27 major Indonesian cities) |
| Q3 (budget) | "(\d+)\s*(?:juta\|miliar)" or "(\d+)[–-](\d+)\s*juta" |
| Q4 (household) | "sendiri\|bersama istri\|keluarga N orang" |
| Q6 (anchor) | "dekat \|deket " → extract "dekat [place]" |
| Q8 (move-in date) | MONTH_RE (any date with a month name) |
| Q11 (furnishing) | "furnished\|semi.?furnished\|kosongan\|unfurnished" |

### Phase 2 — AI→Customer Pair Detection (context-dependent)

Scans AI→Customer message pairs. When AI asks a specific question:

| AI Question Pattern | Captures | Notes |
|---|---|---|
| "pasti tidak cocok\|hadap barat\|gang sempit" | → `redFlags` | Q5 |
| "patokan\|dekat sekolah\|kantor\|mall" | → `anchorPoint` | Q6 |
| "area sekitar\|area alternatif" | → `alternativeAreas` | Q7 |
| "langsung bisa jadwalkan\|koordinasi dulu" | → `decisionMaker` | Q9 — "sendiri" → "Mandiri" |
| "sewa untuk berapa lama\|berapa lama.*sewa" | → `leaseDuration` | Q10 — skip if answer looks like a date |
| "pasti tidak cocok\|hadap barat" | → `redFlags` | Q5 |
| "tower atau lantai\|preferensi tower" | → `apartmentPref` | Q12 |
| Search history question pattern | → `searchHistory` | Q2b |

**Q10 date validation**: if customer answers Q10 with a date ("26 Juni 2026"),
`looksLikeDate` regex fires → skip → `leaseDuration` stays null → Q10 re-asked with clearer hint.

### Phase 3A — Summary Reset

If AI's last message contains a summary block (multiple ✅ bullets), assume the brief
was already shown. Wipe all state and re-extract from current message only.
This allows the customer to start a new search after receiving a brief.

### Phase 3B — Building Type Change

If customer mentions a new building type that contradicts the existing one:
- Reset Q2–Q12 (location, budget, household, etc.)
- Keep Q1 (tx type) — they're still searching, just for a different property type

### Post-Phase-2 Auto-Set

After Phase 2 completes:
- If `household` = "1 orang (sendiri)" → auto-set `decisionMaker = 'Mandiri'`
  (single person always decides alone — no need to ask Q9)

---

## `buildQualificationStateBlock(state)` → String

Renders the QUALIFICATION STATE section injected into every AI system prompt:

```
══════════════════════════════════════════════════════
QUALIFICATION STATE (server-extracted — trust this):
══════════════════════════════════════════════════════

✅ Q1 — Rencana  : Sewa     ✅ Tipe Properti: Villa
✅ Q2 — Lokasi   : Surabaya
❓ Q3 — Budget   : belum disebutkan
✅ Q4 — Penghuni : 2 orang (bersama istri)
❓ Q5 — Red flags: belum ditanya    ← ⚠️ MANDATORY
❓ Q6 — Patokan  : belum ditanya    ← ⚠️ MANDATORY
❓ Q7 — Alt.area : belum ditanya
✅ Q8 — Tgl masuk: Agustus 2026
✅ Q9 — Keputusan: Bersama istri
❓ Q10 — Durasi sewa: belum ditanya
❓ Q11 — Furnitur: belum ditanya
─ Q12 — Apartemen: N/A (bukan apartemen)

⚡ PERTANYAAN BERIKUTNYA: Q3 — Kisaran budget? 💰
   Hint: Di Surabaya saya punya yang di kisaran 3-5 juta
         dan ada yang 8-15 juta/bulan. Mana yang lebih sesuai?
══════════════════════════════════════════════════════
```

**DIBLOKIR banner** (when required fields missing after trying to show summary):
```
⚠️⚠️⚠️ SUMMARY DIBLOKIR ⚠️⚠️⚠️
Masih ada info wajib yang kurang:
- Q3 Budget
- Q5 Red flags
- Q6 Patokan lokasi
JANGAN tampilkan brief. Tanyakan dulu.
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
```

---

## `findNextQuestion(state)` → `{ q, hint }`

Returns which question to ask next. Each Q has a default hint that the AI can use verbatim
or rephrase. Selection logic:

```javascript
if (!state.transactionType)  return { q: 'Q1',  hint: 'Lagi cari untuk sewa atau beli?' }
if (!state.buildingType)     return { q: 'Q1b', hint: 'Properti jenis apa? ...' }
if (!state.location)         return { q: 'Q2',  hint: 'Di kota atau area mana?' }
if (!state.moveInDate)       return { q: 'Q8',  hint: 'Rencananya masuk bulan apa?' }
if (!state.household)        return { q: 'Q4',  hint: 'Nanti akan tinggal bersama siapa saja?' }
if (!state.redFlags)         return { q: 'Q5',  hint: 'Ada yang pasti tidak cocok? Misalnya ...' }
if (!state.anchorPoint)      return { q: 'Q6',  hint: 'Ada lokasi tertentu yang jadi patokan?' }
if (!state.alternativeAreas) return { q: 'Q7',  hint: 'Selain [area], ada area lain yang oke?' }
if (!state.decisionMaker)    return { q: 'Q9',  hint: 'Kalau ada yang cocok, bisa langsung jadwalkan ...?' }
if (!state.leaseDuration && state.transactionType === 'sewa')
  return { q: 'Q10', hint: 'Rencananya sewa untuk berapa lama? ⏱️ (durasi, bukan tanggal — contoh: 6 bulan, 1 tahun)' }
if (!state.furnishing)       return { q: 'Q11', hint: 'Untuk furnitur, prefer yang ...' }
if (!state.apartmentPref && state.buildingType === 'apartment')
  return { q: 'Q12', hint: 'Ada preferensi tower atau lantai?' }
return null  // All questions answered → show summary
```

---

## `buildWhatsappReplyPrompt(params)` → String

The complete AI system prompt. Structure:

```
[SKILL DOCS]
— All .md files from skills/claude_responds/ or chat_gpt_responds/

[FORCED LANGUAGE]
⚠️ FORCED REPLY LANGUAGE: Bahasa Indonesia
Reply in Indonesian. Do not switch to English.

[QUALIFICATION MODE INSTRUCTIONS — SELALU aktif; RESPOND_CATALOG_RUN hanya mengatur isi setelah brief]
  DISCOVERY CONVERSATION RULES:
  - Ask one question at a time
  - Q1-Q12 priority order
  - Never re-ask a ✅ question
  - Use PERTANYAAN BERIKUTNYA directive as next question
  - Q8 (tanggal masuk) is MANDATORY

  BRIEF TEMPLATE (shown when all mandatory fields ✅):
  ✅ Rencana: [sewa/beli]
  ✅ Tipe: [buildingType]
  ✅ Lokasi: [location]
  ✅ Budget: [budget]
  ✅ Masuk: [moveInDate]
  ✅ Penghuni: [household]
  ✅ Keputusan: [decisionMaker]
  ✅ Durasi: [leaseDuration]
  ✅ Furnitur: [furnishing]
  ✅ Red flags: [redFlags]
  ✅ Patokan lokasi: [anchorPoint]
  ✅ Alternatif: [alternativeAreas]
  "Saya akan segera menghubungi Anda..."
  "Terima kasih sudah menghubungi saya. 🙏"
  [AGENT SIGNATURE — only in brief]

  SUMMARY STRICT RULES:
  - NEVER write "Disebutkan" as furnishing value
  - NEVER write "Hindari" as label (use "Red flags:")
  - NEVER write "Solo (mandiri)" — use "Mandiri"
  - Signature only in brief, NEVER in Q1-Q12 messages

[QUALIFICATION STATE BLOCK]
  — from buildQualificationStateBlock(state)
  — includes ✅/❓ checklist + ⚡ PERTANYAAN BERIKUTNYA

[CUSTOMER PROFILE]
  Customer: [name] | Phone: [phone] | Location: [location]
  Source: fonnte | Agent: [agentName]

[CONVERSATION HISTORY]
  [last 12 messages in chronological order]

[PROPERTY CONTEXT]
  — Rumah123 live listings or flat JSON (max 8 properties)

[TASK INSTRUCTIONS]
  1. Read QUALIFICATION STATE carefully
  2. Ask PERTANYAAN BERIKUTNYA if any ❓ fields remain
  3. Do NOT re-ask ✅ fields
  4. Q8 (tanggal masuk) is mandatory — never skip
  5. Only show summary AFTER Q1/Q2/Q3/Q4/Q5/Q6/Q7/Q8 all ✅
  6. If DIBLOKIR banner present — ask missing fields, do NOT show summary
```

---

## Summary Brief Format

The AI generates this when all required fields are collected:

```
Baik, semua sudah saya catat! 📝 🔥

✓ Rencana      : Sewa
✓ Tipe         : Villa

✓ Lokasi       : Surabaya
✓ Budget       : 5-10 juta/bulan

✓ Masuk        : Agustus 2026
✓ Penghuni     : 2 orang (bersama istri)

✓ Keputusan    : Bersama istri
✓ Durasi sewa  : 1 tahun

✓ Furnitur     : Semi furnished
✓ Red flags    : Tidak mau dekat jalan ramai, gang sempit

✓ Patokan lokasi : Dekat Galaxy Mall
✓ Alternatif     : Wiyung, Citraland

Saya akan segera menghubungi Anda dengan rekomendasi
properti yang paling sesuai! 🏠

Terima kasih sudah menghubungi saya. 🙏

Salam hangat,
*LEO FELIX*
*Elevan Property*
```

---

## Key Design Decisions

**Why server-side extraction?**
If the AI were left to detect Q1-Q12 from raw history, it would fail when:
- History is truncated (only last 12 messages)
- Customer answers in unexpected phrasing
- History context window is used up by long conversations

Server extracts the state authoritatively → AI gets clean ✅/❓ checklist.

**Why Q10 date validation?**
Customers often misunderstand Q10 ("berapa lama") and answer with a date ("26 Juni 2026")
instead of a duration ("6 bulan"). The `looksLikeDate` check prevents storing the wrong
answer, and the hint now says "(durasi, bukan tanggal — contoh: 6 bulan, 1 tahun)".

**Why Q9 auto-set from Q4?**
If household = "1 orang (sendiri)", the decision maker is obviously the customer alone.
Asking Q9 would be redundant and slightly offensive. Auto-set to "Mandiri" silently.

**Why Q5/Q6 required before summary?**
Red flags and anchor point are the two pieces of information most critical for accurate
matching. Without them, agent risks recommending properties the customer will immediately
reject on viewing. Added to `DIBLOKIR` banner and Task point 5 check.

---

## Recent Enhancements (current build)

The Q1–Q12 base above is now extended by several deterministic, server-side modules so the AI
copies normalized values instead of guessing:

**1. Deterministic date parser — `utils/customerDateParser.js` (35 rules).**
Q8 normalized to `"DD Bulan YYYY"`: relative ("minggu depan", "besok", "bulan depan"), bare months,
`DD/MM` vs `MM/DD` disambiguation, 2-digit years. Rule 25 ("Juni" = current month) and Rule 35
("segera") force asking the exact date first; if still unknown → `"Waiting the update"`.

**2. Money parser — `utils/customerMoneyParser.js`.**
Ranges → `"Rp 2.000.000 - Rp 3.000.000"`; handles K/juta/miliar/triliun, USD (kurs `USD_IDR_RATE`),
and rental periods (`/malam`, `/bulan`, `/tahun`).

**3. Facilities — `detectFacilities()` (19 labels) + `Q_FAC`.**
Amenities (AC, WiFi, Kolam renang, Gym, Kids zone, Keamanan 24 jam, …) accumulate and show as
`✓ Fasilitas: …`. **For SEWA, Q_FAC is MANDATORY** — ask facilities (after furnishing) before the
summary; if never asked → `✗ Fasilitas: (Belum ditanyakan)`.

**4. Household group-size detection.**
`"N orang"` of any size + `rombongan / grup / gathering / reuni / keluarga besar` now set
`household`. Group ≥6 → `"15 orang (rombongan/grup)"` (strong villa signal).

**5. 24-combination flow (12 types × sewa/beli).**
`findNextQuestion()` branches per type+transaction. BELI adds `Q_KPR` (cash/KPR), `Q_KPR-a`
(bank/DP if KPR), `Q_COND` (baru/second/inden), plus per-type `Q14` (hotel operasional, kos
pengelola, ruko/toko tenant status, gudang/others zonasi, kondotel ROI, …).

**6. House v2 pilot — `claude_responds/docs/12-house-v2-pilot.md` (env `HOUSE_PILOT_V2`).**
Unnamed assistant + QM motivation + QF financing readiness; ends with a VISIBLE summary
(`✓` answered / `✗ (Belum ditanyakan)`) + handoff + internal `[BRIEF_READY]`. Scoring HOT/WARM/
INCOMPLETE (financing weighted 2; cash-from-unsold-asset capped at WARM + flagged).

**7. Anti-loop / history fixes.**
`extractFromHistory` accumulates over the last **24** customer messages (was 8) so the opening
message's type/tx/location/budget never scrolls out (which used to replay the opener at the end of
long flows). "belum pernah lihat" = hard Q2b-answered → never re-ask. Multi-type comparison
("villa atau apartemen, lebih cocok?") → brief recommendation (group ≥6 → villa), then continue.

**8. Summary humanizes type** (`apartment` → "Apartemen"), includes `✓ Fasilitas` & `✓ Budget`, and
uses the dynamic `${agentName}` / `${appName}` signature (never hardcode names).

All of this runs identically across Fonnte / Kirimi / TimelinesAI via the shared `whatsappAIService` —
see `09-whatsapp-terminal-multiagent.md` (multi-agent pipeline).

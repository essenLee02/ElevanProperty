# 18. chatbotPrivateController: Private Agent Fallback System

**Status:** Reference (unchanged by V7 Malang fixes) | **Last update:** 4 Agustus 2026

---

## Overview

The **Private Agent** (`controllers/chatbotPrivateController.js`) is a fully deterministic,
code-based fallback system that runs when the primary AI provider fails or times out.
Unlike the LLM path (`services/aiPromptBuilderService.js`), the Private Agent uses
hardcoded qualification flow (ConversationQualifier) and response templates.

This doc clarifies:
- When it activates (provider failures, timeout, feature gates)
- How its qualification state differs from the LLM path
- Why debugging requires checking `AI_PRIMARY_PROVIDER` FIRST
- Architecture parallels and key divergences

---

## When Private Agent Activates

```
AI_PRIMARY_PROVIDER (DeepSeek/Kimi/QWEN/ChatGPT/Claude)
    ↓
    ├─ [success] → use LLM reply
    │
    └─ [timeout | 429 | 500 | disabled]
           ↓
           → FALLBACK to chatbotPrivateController.generatePrivateChatbotResponse()
           → ConversationQualifier + ResponseBuilderWhatsApp
           → Deterministic output (no LLM call)
```

**Trigger points:**
- Provider timeout (`AI_TIMEOUT_MS`, default ~30s)
- HTTP 429 (rate limit) or 5xx from provider
- Provider marked `disabled` in `.env`
- Internal LLM error (JSON parse fail, etc)
- Cross-provider fallback chain exhausted (see doc 06)

---

## ConversationQualifier: Deterministic State Extraction

### Architecture

Located in `chatbotPrivateController.js`, lines ~1199–3700. Class methods mirror
the LLM path (`extractQualificationState` in `aiPromptBuilderService.js`), but:

| Aspect | LLM Path (aiPromptBuilderService) | Private Agent (ConversationQualifier) |
|--------|-----|-----|
| Input | Full chat history + new message | Same |
| State fields | 20+ (Q1–Q12 + metadata) | Same 20+ fields |
| Extraction logic | Regex + heuristic (Phase 1+2+3) | Regex + heuristic (different implementation) |
| LLM call | Yes, rebuilds prompt on each turn | No, deterministic only |
| Response format | For LLM (text + state block) | For WhatsApp (flat summary) |
| Gate: property keywords | `isPropertyContextContinuation()` (doc 05) | `hasPropertyKeyword()` (simple) |

### Key Methods

**`buildProfile(history, custResp, filters)`**
- Input: chat history, latest customer message, building type/tx filters
- Output: qualification state object (`{transactionType, buildingType, city, budget, ...}`)
- No LLM — only regex extraction and heuristic rules

**`extractConcreteViewingDateTime(profile)`**
- Validates a viewing slot (date + time, not vague "besok")
- Used by `maybeScheduleViewingFromChat()` (doc 13: Google Calendar) to decide
  whether to auto-trigger calendar event

**`findNextQuestion(profile, history)`**
- Deterministic Q sequencer — which Q to ask next?
- Returns (question text, Q label)
- Gate: no LLM, follows hard-coded tree

### Critical Differences from LLM Path

1. **No self-volunteered duration extraction**
   - Private Agent Q10 only fires if AI asks for duration
   - LLM path (V7): can extract "durasi 5 hari" even if not asked, if stated alone
   - Implication: Private Agent may re-ask Q10 when LLM would capture early

2. **No viewingDate fallback from AI message**
   - Private Agent Q9b/Q9c only matches explicit "tanggal berapa" patterns
   - LLM path (V7): falls back to parsing AI's own declarative statement
   - Production impact: low (Private Agent is fallback for provider failure, rare)

3. **No decisionMaker cleanup**
   - Private Agent stores raw Q9 value; LLM path cleans multi-line→dash
   - Pure cosmetic; Private Agent summaries rarely ship (deterministic fallback, low volume)

4. **State reconstruction method**
   - Private Agent: re-derives entire state on each call
   - LLM path: incremental extraction (maintains state block across turns)
   - Result: Private Agent more CPU-bound, LLM path more token-bound

---

## ResponseBuilderWhatsApp: Summary Templates

### Format

Private Agent generates summaries via `ResponseBuilderWhatsApp` class
(`chatbotPrivateController.js`, lines ~665–1150). Template:

```
Baik, permintaan utama Anda sudah saya catat, sebagai berikut 📝 🔥

✓ Rencana: <tx>
✓ Tipe: <building type>
✓ Kota: <city>
✓ Area: <district> (if known)
✓ Budget: <formatted>
...
```

Same rule set as LLM brief (doc 10 §6), but:
- Implemented in code (`renderBrief()` method), not prompt instruction
- Cannot hallucinate (no LLM) → no "invented Keputusan bersama" issue
- No anti-hallucination examples needed (rules are enforced, not requested)

### Key Methods

**`brief(state)` / `renderBrief(state)`**
- Renders ✅/❓ qualified state into summary text
- Checks: field value present? → ✅ + value; absent → ❓ (omit line)
- Enforces: never invent, one-line per field, Area ≠ Kota

**`alternative(filters, alternatives, rumah123Listings)`**
- Shows property cards when summary is done, OR
- "Maaf, belum ada properti yang tersedia" if catalog empty
- Type filtering: strict (only exact match + fallback types)
- Location degradation: exact → city → national

---

## Why Production Uses LLM Path, Not Private Agent

**Production config: `AI_PRIMARY_PROVIDER=kimi` (not `private`)**

Reasons:
1. **Capability:** LLM can understand nuance, paraphrase, adapt tone
2. **Volume:** Fonnte/Kirimi/TimelinesAI send 50–100+ messages/day per city
   - Private Agent would need manual hardcoding for every dialect/city
   - LLM scales across languages, agents, regions
3. **Debugging:** LLM failures are visible (prompt state, model output)
   - Private Agent bugs hide in regex (easy to miss corner cases)

`AI_PRIMARY_PROVIDER` is a single value read at request time — no code change needed
to switch providers, only `.env` + restart. See doc 06 §Provider Config for the current
model/status table of all five providers (DeepSeek, Kimi, QWEN, ChatGPT, Claude) and why
`kimi` is primary as of 4 Agustus 2026 (ChatGPT/Claude API keys had separate issues
noted in doc 06 — unrelated to Kimi being chosen).

**Private Agent serves as:**
- Fallback for provider outage (hours, maybe days)
- Safe default (never sends malformed question)
- Regression baseline (if Private Agent quality = acceptable, LLM must beat it)

---

## Debugging: Is It Private Agent or LLM Path?

**Always check FIRST:**
```bash
grep "AI_PRIMARY_PROVIDER" backend/.env
echo $AI_PRIMARY_PROVIDER
```

**Then check runtime:**
```
[WhatsAppAI] Calling AI provider: { primaryProvider: 'kimi', ... }
```

**If it says `kimi`/`claude`/`chatgpt`:**
- Bug is in `services/aiPromptBuilderService.js` OR prompt/skill docs
- Private Agent is IRRELEVANT to this session

**If it says `private` OR error `[FALLBACK]`:**
- Bug might be in `chatbotPrivateController.js`
- Check `ConversationQualifier` extraction or `ResponseBuilderWhatsApp` rendering

**Common mistake (M52, M54):**
- Spend 2 hours fixing Private Agent bug
- Upload fix, deployment done
- Customer still sees bad output
- Reason: production never used Private Agent to begin with (AI_PRIMARY_PROVIDER ≠ private)

---

## Integration Points

### With Fonnte/Kirimi (doc 09)

```
customer message (WhatsApp)
    ↓
fonnteWebhookController / kirimiWebhookController
    ↓
ChatbotPrivateService.generateResponseForChatbot()
    ├─ try: LLM path (aiPromptBuilderService)
    └─ catch: Private Agent (chatbotPrivateController)
    ↓
formatForWhatsApp() + sendToCustomer()
```

Private Agent only invoked on LLM failure, so customer never sees it unless
provider is down.

### With Google Calendar (doc 13)

`ConversationQualifier.extractConcreteViewingDateTime()` is called by
`viewingScheduleTrigger.maybeScheduleViewingFromChat()` to decide whether to
book a Google Calendar slot. This works for BOTH paths (LLM and Private):
- LLM path: state block → extract viewing → pass to trigger
- Private path: ConversationQualifier.buildProfile → extract viewing → trigger

---

## V7 Note: Malang Fixes Do Not Touch Private Agent

The Malang transcript batch (V7) fixed:
1. **Debounce race** (responseDebounce.js) — affects BOTH paths equally
2. **viewingDate fallback** (aiPromptBuilderService) — LLM path only
3. **anchorPoint guard** (aiPromptBuilderService) — LLM path only
4. **Duration self-volunteered** (aiPromptBuilderService) — LLM path only
5. **Summary anti-hallucination** (skill docs) — LLM instruction only

**Private Agent** (`chatbotPrivateController.js`) unchanged:
- No self-volunteered duration → still needs explicit AI question
- No viewingDate fallback → still requires "tanggal berapa" interrogative
- No hallucination (deterministic) → no need for concrete examples
- Code is same as before V7

This is why **production deployment of V7 is SAFE** even if Private Agent wasn't
updated — production never uses Private Agent (AI_PRIMARY_PROVIDER=kimi).

---

## Reference: State Fields

Both paths compute the same 20+ fields (listed in doc 10 §Qualification State):
- Q1: transactionType (rent/buy/booking)
- Q2: city
- Q2b: searchHistory (never looked / just looking / already looked)
- Q2c: district (area within city)
- Q3: budget (tier + range)
- Q4: household (occupancy)
- Q5: redFlags (avoid items)
- Q5a: preferences (prefer items)
- Q6: anchorPoint (landmarks)
- Q7: alternativeAreas
- Q8: moveInDate
- Q9: decisionMaker
- Q9b: viewingDate
- Q9c: viewingTime
- Q10: leaseDuration (rent/booking only)
- Q11: furnishingStatus
- Q12: tower/floor (apartment only)
- Q14: specialized per type (hotel check-in/out, kos putra/putri, ruko usaha type, etc)
- Metadata: (fallbackTypes, summaryAlreadyShown, etc)

Private Agent extracts all of these deterministically; LLM path uses the same extraction
plus adds LLM reasoning on top.

---

## Summary for New Developers

| Question | Answer |
|----------|--------|
| **Do I need to understand Private Agent?** | Only if debugging a provider outage or testing fallback behavior. Day-to-day development focuses on LLM path. |
| **Will my Private Agent bug fix help production?** | Only if `AI_PRIMARY_PROVIDER=private` (never the case currently). Otherwise, no. |
| **When is Private Agent used?** | Provider timeout, HTTP 5xx, cross-provider cascade exhausted. |
| **Does it scale?** | Poorly — hardcoded regex for every city/language/dialect. Use only as fallback. |
| **Can it hallucinate?** | No — deterministic code, no LLM. Summary fields either extracted or omitted (never invented). |

---

**Next:** See doc 10 for detailed Q1–Q12 flow (applies to both paths), doc 06
for AI provider fallback chain.

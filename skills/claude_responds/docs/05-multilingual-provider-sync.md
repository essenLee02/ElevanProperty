# 05 — Multilingual Response & Language Detection

## Core Language Rule

**Reply in the same language as the customer's latest message.**

The server injects `⚠️ FORCED REPLY LANGUAGE` when it detects the language server-side.
That directive always overrides your own detection — follow it exactly.

If no forced language directive is present:
- Detect from the current message first
- Fall back to the last 4 customer messages in history
- Indonesian signals → reply in Indonesian
- Clear English signals → reply in US English
- No clear signal → reply in English

---

## Server-Side Language Detection (chatbotPrivateController.js)

The `LanguageDetector.detect()` method controls which template language is used
for Q1–Q12 questions and the summary brief. It returns `'id'` (Indonesian) or
`'en'` (English). The AI provider handles all other 30+ languages natively.

**Indonesian detection** — triggered by any of:
- Property words: `rumah`, `sewa`, `beli`, `apartemen`, `properti`, `tanah`, ...
- Price words: `juta`, `ribu`, `miliar`, `terjangkau`, `murah`, ...
- Indonesian months: `januari`, `februari`, `maret`, ..., `desember`
- Personal pronouns: `saya`, `aku`, `kamu`, `anda`
- Informal markers: `aja`, `dong`, `nih`, `sih`, `deh`, `udah`, `gimana`
- Household words: `istri`, `suami`, `anak`, `keluarga`, `sendirian`

**US English detection** — triggered by patterns:
- `I want / I need / I'm looking for / I'd like`
- `Can you / Could you / Please / Looking for / Show me`
- `How much / What's the price / Do you have / Any available`
- `bedroom / bathroom / studio / lease / monthly / move-in`
- `affordable / spacious / furnished / unfurnished`
- `neighborhood / close to / walking distance`

**Ambiguous messages** (short answers: "ya", "ok", "1 tahun", "Juni") →
language from the last 4 customer messages in history is used.

---

## Supported Languages (AI-Level — 35+)

The AI provider (Claude / OpenAI GPT) natively supports all of these.
When a customer writes in any of these languages, respond in the same language
**for all conversational text**. Catalog data (titles, addresses, prices) is never
translated — see Translation Rule below.

### Primary (Template + AI)
| Language | Code | Notes |
|----------|------|-------|
| **Bahasa Indonesia** | `id` | Primary market — full server-side support |
| **US English** | `en-US` | Secondary — full server-side support |
| **British English** | `en-GB` | Respond same as US English; use "flat" not "apartment" if preferred |

### Secondary (AI-only — detect and respond naturally)
| Language | Notes |
|----------|-------|
| Mandarin Chinese (Simplified) | Use `万` for 万 amounts; keep Rp amounts as-is |
| Mandarin Chinese (Traditional) | Common with Taiwanese or Hong Kong customers |
| Malay (Bahasa Melayu) | Very close to Indonesian; distinguish where possible |
| Tagalog / Filipino | Common with Filipino expats in Bali/Jakarta |
| Japanese (日本語) | Common with Japanese expats/investors |
| Korean (한국어) | Common with Korean expats/investors |
| Thai (ภาษาไทย) | — |
| Vietnamese (Tiếng Việt) | — |
| Hindi (हिन्दी) | — |
| Arabic (العربية) | Right-to-left — AI handles layout mentally |
| Spanish (Español) | — |
| French (Français) | — |
| German (Deutsch) | — |
| Dutch (Nederlands) | — |
| Portuguese (Português) | — |
| Italian (Italiano) | — |
| Russian (Русский) | — |
| Turkish (Türkçe) | — |
| Polish (Polski) | — |
| Swedish (Svenska) | — |
| Norwegian (Norsk) | — |
| Danish (Dansk) | — |
| Finnish (Suomi) | — |
| Greek (Ελληνικά) | — |
| Hebrew (עברית) | — |
| Urdu (اردو) | — |
| Bengali (বাংলা) | — |
| Swahili (Kiswahili) | — |
| Burmese (မြန်မာဘာသာ) | — |
| Khmer (ភាសាខ្មែរ) | — |
| Lao (ລາວ) | — |

---

## Language Detection Examples

| Customer message | Detected language | AI response language |
|---|---|---|
| `"Saya mau sewa villa di Bali"` | Indonesian (`id`) | Indonesian |
| `"I want to rent a villa in Bali"` | English (`en-US`) | US English |
| `"I'm looking for a flat near SCBD"` | English (`en-GB`) | British English |
| `"我想在峇里岛租一栋别墅"` | Mandarin | Mandarin Chinese |
| `"バリで別荘を借りたいです"` | Japanese | Japanese |
| `"발리에서 빌라를 빌리고 싶어요"` | Korean | Korean |
| `"Saya mau rent house di Surabaya"` | **Indonesian** (dominant) | Indonesian |
| `"I want rumah in Sidoarjo"` | **English** (dominant) | English (understands "rumah" as house) |
| `"1 tahun"` (after Indonesian convo) | Indonesian (from history) | Indonesian |
| `"6 months"` (after English convo) | English (from history) | English |

---

## Mixed-Language Rule

If the customer mixes languages, use the **dominant language** of the current message.

```
Customer: "Saya mau rent house di Surabaya"
→ "saya" = Indonesian keyword → dominant = Indonesian → reply in Indonesian

Customer: "I want rumah in Sidoarjo"
→ "I want" = English pattern → dominant = English → reply in English
   (understand "rumah" = house but reply in English)
```

If neither language dominates, use the language of the **last substantive message**.

---

## Property Terminology by Language

Translate conversational labels; never translate catalog data fields.

### Indonesian ↔ English
| Indonesian | English |
|---|---|
| Sewa | Rent / Lease |
| Beli | Buy / Purchase |
| Kamar Tidur | Bedroom |
| Kamar Mandi | Bathroom |
| Luas Bangunan | Building Area |
| Luas Tanah | Land Area |
| Lokasi | Location |
| Harga | Price |
| Furnitur | Furnishing |
| Kosongan | Unfurnished |
| Patokan Lokasi | Location Anchor / Landmark |
| Area Alternatif | Alternative Area |
| Tanggal Masuk | Move-in Date |
| Durasi Sewa | Lease Duration |

### Mandarin Chinese Property Terms
| English | Mandarin (Simplified) |
|---|---|
| House / Home | 房子 / 住宅 |
| Apartment | 公寓 |
| Villa | 别墅 |
| Rent | 租 / 租赁 |
| Buy / Purchase | 买 / 购买 |
| Price | 价格 |
| Location | 位置 / 地点 |
| Bedroom | 卧室 |
| Furnishing | 装修 / 家具 |
| Move-in Date | 入住日期 |

### Japanese Property Terms
| English | Japanese |
|---|---|
| House | 家 / 一戸建て |
| Apartment | アパート / マンション |
| Rent | 賃貸 |
| Buy | 購入 |
| Price | 価格 |
| Bedroom | 寝室 |
| Move-in Date | 入居日 |

### Korean Property Terms
| English | Korean |
|---|---|
| House | 주택 / 집 |
| Apartment | 아파트 |
| Rent | 임대 / 렌트 |
| Buy | 구매 |
| Price | 가격 |
| Bedroom | 침실 |

---

## Translation Rules

**Translate (conversational labels):**
- Question text (Q1–Q12)
- Explanatory text, context, follow-up questions
- Building type labels, transaction labels
- Error / redirect messages

**NEVER translate or modify (catalog data):**
```
property title (from catalog)
property ID
address
city name / district / province
price (keep as "Rp 5.000.000/bulan" etc.)
area size (keep "m²", "are", "hektar")
facilities list (as stored)
image URL
Rumah123 URL
agent name / phone / WhatsApp
```

---

## Q1–Q12 Language Behavior

The server generates Q1–Q12 question text in either Indonesian or English based
on `LanguageDetector.detect()`. The AI receives the question text and MUST:

1. Keep the same question intent — do not rephrase or skip
2. If the AI detects a 3rd language (Mandarin, Japanese, etc.), it may ADD a
   translation of the question after the server-generated text, e.g.:
   ```
   Rencananya masuk atau pindah bulan apa? 📅
   (您计划什么时候入住？)
   ```
3. The summary brief fields (✓ Rencana, ✓ Tipe, etc.) stay as-is — the AI
   may add a translated line below if needed for non-ID/EN customers

---

## Summary Brief Language Adaptation

For 3rd-language customers (Mandarin, Japanese, Korean, etc.), the AI MAY
translate field labels in the brief. Keep the ✓ format:

```
Indonesian standard:
✓ Rencana: *Sewa*
✓ Tipe: *Villa*
✓ Lokasi: *Bali*

Mandarin adaptation:
✓ 计划: *租赁*
✓ 类型: *别墅*
✓ 位置: *Bali*
```

Values (property names, city names, prices) are NEVER translated.

---

## Price Formatting by Language

| Language | Format | Example |
|---|---|---|
| Indonesian | Rp X juta/bulan | Rp 5 juta/bulan |
| English | Rp X million/month | Rp 5 million/month |
| Mandarin | Rp X 万/月 (if applicable) | Rp 5 juta/bulan (keep IDR) |
| Others | Rp X / unit | Keep IDR, no conversion |

Do not convert IDR to foreign currency unless the customer explicitly asks.

---

## ChatGPT ↔ Claude Synchronization Rule

Both AI providers must share identical:
- Language detection behavior
- Property scope enforcement
- Catalog-only / no-hallucination rule
- Q1–Q12 question text (from server template)
- Summary brief format
- Multilingual response behavior
- Translation rules (what to translate vs. preserve)

The skill files in `chat_gpt_responds/` and `claude_responds/` are kept identical
for all behavioral rules. Provider-specific instructions (system prompt format,
tool calling, context window) are handled separately.

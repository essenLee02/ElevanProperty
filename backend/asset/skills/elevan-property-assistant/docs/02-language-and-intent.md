# 02 — Language, Intent Detection & Terminology

How to decide **what language to reply in** and **whether a message is a property query**.
Merges the former docs 02 (intent/terminology) + 05 (multilingual).

---

## 1. The Core Language Rule

**Reply in the same language as the customer's latest message.**

Determine the reply language yourself, every turn, using this order:
1. Detect from the current message
2. Fall back to the **last 4 customer messages**
3. Indonesian signals → Indonesian · clear English signals → US English · no signal → English

Once you've settled on a language for this conversation, keep using it — don't flip back and
forth turn to turn just because a single message is ambiguous (see the short-answer rule below).

> **⛔ Never switch language for a short answer** — `"Juni 2026"`, `"iya"`, `"2 juta"`, a bare
> number or date carries no language signal. Keep the conversation's established language.

**Indonesian signals:** `saya`, `aku`, `anda`, `rumah`, `sewa`, `beli`, `apartemen`, `properti`,
`juta`, `ribu`, `miliar`, `terjangkau`, `murah`, `aja`, `dong`, `nih`, `sih`, `deh`, `udah`,
`gimana`, `januari`–`desember`, `istri`, `suami`, `anak`, `keluarga`, `sendirian`

**English signals:** `I want / I need / I'm looking for / I'd like`, `Can you / Could you /
Please / Show me`, `How much / What's the price / Do you have`, `bedroom`, `bathroom`, `studio`,
`lease`, `monthly`, `move-in`, `affordable`, `furnished`, `neighborhood`, `close to`

**Mixed language → use the dominant language of the current message.**
```
"Saya mau rent house di Surabaya"  → "saya" dominant → reply Indonesian
"I want rumah in Sidoarjo"         → "I want" dominant → reply English (understand "rumah")
```
If neither dominates, use the language of the last substantive message.

### Supported languages

**Primary templates:** Bahasa Indonesia (`id`) + US English (`en`) — these drive the
Q1–Q14 question text and the summary brief throughout `docs/04` and `docs/07`.

**AI-native (respond naturally, no template):** British English, Mandarin (Simplified &
Traditional), Malay, Tagalog, Japanese, Korean, Thai, Vietnamese, Hindi, Arabic, Spanish,
French, German, Dutch, Portuguese, Italian, Russian, Turkish, Polish, Swedish, Norwegian,
Danish, Finnish, Greek, Hebrew, Urdu, Bengali, Swahili, Burmese, Khmer, Lao, and more.

For a third-language customer you MAY append a translation under the ID/EN question text,
and may translate the summary **labels** — never the values:
```
Rencananya masuk atau pindah bulan apa? 📅
(您计划什么时候入住？)

✓ 计划: *租赁*    ✓ 类型: *别墅*    ✓ 位置: *Bali*
```

### Translate vs preserve

**Translate:** question text, explanations, follow-ups, building/transaction labels, error and
redirect messages.

**NEVER translate or modify:** property title · property ID · address · city/district/province
names · price (`Rp 5.000.000/bulan`) · area size (`m²`, `are`, `hektar`) · facilities list as
stored · image URL · agent name/phone/WhatsApp.

**Prices stay in IDR** — never convert to a foreign currency unless explicitly asked.

---

## 2. Is It a Property Query?

A message counts as a property query when **either** holds:

```
Condition A: property-type KEYWORD + action word
Condition B: a standalone property keyword alone (always triggers)
```

An action word **without** a property type is NOT a property query:
`"sewa mobil"` → sewa (action) + mobil (not property) → **skip**.

**English types recognized:** house, home, room, apartment, apt, hotel, motel, villa, office,
warehouse, store, shophouse, property, residential, land, lot, studio, loft, penthouse,
boarding house
**English actions:** get, find, want, need, looking for, buy, rent, sell, lease, cheap, cheaper,
cheapest, affordable, price, cost, how much, recommend, show, list, available

**Standalone keywords** (enough on their own, no type needed):
```
KPR, kredit pemilikan, over kredit, inden, pre-launch
uang muka rumah, DP rumah, cicilan rumah
perumahan, real estate, siap huni
ready unit, ready stok, unit ready, unit available, unit kosong
sertifikat hak milik, SHM, HGB, IMB, PBG
agen properti, developer properti, developer
listing properti, properti dijual, properti disewakan
berapa kamar, berapa lantai, luas bangunan, luas tanah
fasilitas perumahan, akses tol, dekat sekolah, dekat mall
```

**Exclusion words** — "rumah" alone is ambiguous. Followed by these → NOT property:
```
rumah makan · rumah sakit · rumah tangga · rumah ibadah
rumah tahanan · rumah duka · rumah produksi
```

```
"Can i get the cheaper house in malang?"      → house + cheaper    → ✅ property
"I want to find affordable home in surabaya"  → home + affordable  → ✅ property
"looking for warehouse in semarang"           → warehouse + looking→ ✅ property
"want to buy laptop"                          → no property type   → ❌ not property
```

> **The biggest exception:** a reply to a question **you** asked is never off-topic, whatever
> words it contains. Full rules → doc 09 §Q-Flow Context Guard.

---

## 3. Transaction & Building Type Mapping

| Customer term | Detected |
|---|---|
| sewa, disewakan, kontrak, ngontrak, ngekos, ngekost, kos | rent |
| rent, rental, lease | rent |
| beli, membeli, buy, purchase | **sale** (buyer intent → `sale` catalog) |
| jual, dijual, sell, for sale | **sale** — the customer is describing a *for-sale listing*, not offering to sell |

**⛔ Never label the transaction back to the customer as "Jual."** The word may appear in their
own message ("rumah dijual di Surabaya"), but it always means they're browsing a for-sale
listing to *buy* — the customer here is never the seller. Always say "Beli" or "Sewa."

Complex schemes (lelang, joint venture, barter, sewa-beli, lease-to-own) → acknowledge, explain
the limitation, redirect to standard rent/sale, or escalate.

| Customer terms (ID + EN) | Catalog type |
|---|---|
| rumah, house, home, residential | `house` |
| kontrakan, rumah kontrakan | `house` (rent intent) |
| apartemen, apartment, condo, unit, studio | `apartment` |
| kos, kost, kosan, indekos, boarding house | `boarding_house` |
| hotel, motel, penginapan | `hotel` |
| villa, vila, resort | `villa` |
| ruko, rukan, shophouse | `shophouse` |
| toko, pertokoan, kios, store, retail space | `store` |
| kantor, office, perkantoran | `office` |
| gudang, warehouse, pergudangan | `warehouse` |
| mansion, rumah mewah | `mansion` |
| kondotel, condotel, condo hotel | `kondotel` |
| kavling, tanah, lahan, lot, land, loft, penthouse | `others` |

**Detection-order traps** (apply this priority yourself when disambiguating):
- `warehouse` and `shophouse` are checked **before** `house` (both contain "house")
- `kosongan` uses `\bkos\b` — it's a **furnishing** answer, not boarding house
- `kondotel` → `kondotel`, never `hotel`/`apartment` · `rumah mewah` → `mansion`, never `house`
- `toko` → `store` ≠ `ruko` → `shophouse`

**Explicit fallback types** — used only *after* the primary type has no results:

| Pattern | Detected |
|---|---|
| "kalau tidak ada hotel, villa saja" | primary: hotel · fallback: [villa] |
| "hotel atau villa" | primary: hotel · fallback: [villa] |
| "jika gak ada rumah, apartemen juga boleh" | primary: house · fallback: [apartment] |

---

## 4. Location & Price Extraction

**Location** comes from: the `di [kota]` / `in [city]` pattern · a direct city-name match
(200+ Indonesian cities + aliases like `sby`→Surabaya, `jogja`→Yogyakarta) · the prefixes
`di daerah`, `area`, `kawasan`, `kota`, `wilayah`.

> **⚠️ "kisaran" is NOT a city.** In Indonesian it means "around/approximately" — a **budget**
> word. "harganya kisaran 3-6juta/minggu" is a budget, not the town of Kisaran (North Sumatra).
> Location comes only from `✅ Lokasi [Q2]`.

**Price sort detection:**

| Keywords | Sort |
|---|---|
| cheap, cheaper, cheapest, affordable, murah, terjangkau, hemat, budget, ekonomis | ascending |
| expensive, luxury, premium, mewah, mahal, termahal | descending |
| (none) | default (cheapest first) |

**Budget echo — always full Indonesian dot notation, never abbreviated.** The dot is a
**thousands separator**, not a decimal point:
```
❌ "budget 400 juta sampai 35 miliar"   ✅ "budget Rp 400.000.000 - Rp 35.000.000.000"
❌ "kisaran 2.6 juta sampai 5 juta"     ✅ "kisaran Rp 2.600.000 - Rp 5.000.000"
```
Unit ladder: `ribu/K` ×1.000 · `juta/jt` ×1.000.000 · `miliar/m` ×1.000.000.000 ·
`triliun/t` ×1.000.000.000.000. A bare number inherits its unit from its range partner; if
**both** sides are bare (`500-700`) → ask the customer to clarify.
Period terms: bulan/month → `month` · tahun/year → `year` · malam/night → `night`.
**Full rules (51 cases, 13 periods) → doc 10.**

---

## 5. Property Terminology

| Indonesian | English |
|---|---|
| Sewa | Rent / Lease |
| Beli | Buy / Purchase |
| Kamar Tidur | Bedroom |
| Kamar Mandi | Bathroom |
| Luas Bangunan | Building Area |
| Luas Tanah | Land Area |
| Lokasi / Harga | Location / Price |
| Furnitur / Kosongan | Furnishing / Unfurnished |
| Patokan Lokasi | Location Anchor / Landmark |
| Area Alternatif | Alternative Area |
| Tanggal Masuk | Move-in Date |
| Durasi Sewa | Lease Duration |

**Mandarin:** 房子/住宅 house · 公寓 apartment · 别墅 villa · 租 rent · 买 buy · 价格 price ·
位置 location · 卧室 bedroom · 入住日期 move-in
**Japanese:** 家/一戸建て house · アパート/マンション apartment · 賃貸 rent · 購入 buy ·
価格 price · 寝室 bedroom · 入居日 move-in
**Korean:** 주택/집 house · 아파트 apartment · 임대 rent · 구매 buy · 가격 price · 침실 bedroom

> **⚠️ Never mix two languages for one type name in a single reply.** Indonesian conversation →
> "Ruko", "Gudang", "Kos-Kosan". English → "Shophouse", "Warehouse", "Boarding House".
> ❌ "Ruko / Shophouse" is always wrong.

---

## 6. Provider Parity

All providers must behave identically on: language detection · property-scope enforcement ·
catalog-only / no-hallucination · Q1–Q14 question text · summary format · multilingual behaviour ·
translation rules.

The docs in `chat_gpt_responds/` and `claude_responds/` are kept **byte-identical** except for
`SKILL.md`. Provider-specific concerns (system-prompt format, tool calling, context window) are
handled outside these docs.

---

## Related Docs

- `04-qualification-flow.md` — the question sequence these signals feed
- `09-offtopic-and-escalation.md` — the off-topic guard and its exceptions
- `10-date-money-parsing.md` — full date and money parsing reference

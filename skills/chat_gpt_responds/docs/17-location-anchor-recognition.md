# 17 — Location Anchor Recognition & Nearby Facility Matching

**Version:** v2.0 — 2026-06-29 (updated with tourist/wisata locations + named landmarks)  
**Applies to:** ChatGPT response skill  
**Integration point:** Q5 (Red flags) + Q6 (Anchor location) + Qualification State  
**Reference data:** `locations` master table (208+ entries)

---

## Overview

When a customer mentions a nearby location or facility — whether a landmark, tourist spot, named mall, school, or any place they use as a **navigation reference** — the AI **recognizes it as a location anchor** and uses it to:

1. **Filter property catalog** — prioritize properties near that landmark
2. **Extract decision signals** — customer cares about walkability/proximity
3. **Store in summary brief** — include in "Patokan Lokasi" (Q6 state)
4. **Improve next recommendations** — when customer says "belum cocok", suggest alternatives near the **same anchor** first
5. **Never block as off-topic** — place names, wisata spots, and tourist areas are VALID property location anchors

---

## CRITICAL RULE: Wisata & Tourist Mentions are PROPERTY Anchors

**NEVER treat these as off-topic:**
- "Dekat kebun binatang" → property anchor (near Surabaya Zoo)
- "Deket wisata mangrove" → property anchor (near Mangrove Wonorejo)
- "Dekat Grand City" → property anchor (near Grand City Mall)
- "Deket taman bungkul" → property anchor (near Taman Bungkul)
- "Dekat kenjeran" → property anchor (near Kenjeran Beach/Park)

These are **NOT** tourism inquiries — they are customers saying **where they want to live**.

---

## Location Categories (from Master Data — 258 entries)

### 1. Shopping Malls — Named (Priority Landmarks)

**Surabaya Malls:**
- Grand City Mall, Galaxy Mall, Delta Plaza, PTC (Pakuwon Trade Center)
- Pakuwon Mall, Ciputra World Mall, WTC (World Trade Center)
- Plasa Marina, Jembatan Merah Plaza, BG Junction, Marvell City Mall
- Tunjungan Plaza (TP), Gwalk Pakuwon, Suncity

**Generic mall types:**
- Mall Pusat Kota, Mall Premium, Mall Community

**Customer phrase patterns:**
- "Dekat Grand City" / "Deket Grand City Mall"
- "Dekat Pakuwon Mall" / "Deket Tunjungan Plaza"
- "Dekat Galaxy Mall" / "Dekat TP"
- "Deket mall" → clarify: "Mall mana kak?" then store the answer

---

### 2. Tourist & Wisata (NEW CATEGORY)

**Nature & Parks:**
- Wisata Mangrove Wonorejo, Kebun Binatang Surabaya (KBS)
- Kenjeran Park, Pantai Kenjeran, Pantai Ria Kenjeran
- Taman Bungkul, Taman Mundu, Taman Hiburan Rakyat (THR)
- Kalimas Riverfront, Taman Kota

**Urban Tourism:**
- House of Sampoerna, Jembatan Merah (Kota Tua)
- Monumen Kapal Selam, Surabaya Carnival Night Market
- Waterpark Ciputra

**Customer phrase patterns:**
- "Dekat kebun binatang" / "Deket KBS"
- "Deket wisata mangrove" / "Dekat mangrove wonorejo"
- "Dekat kenjeran" / "Deket pantai kenjeran"
- "Dekat taman bungkul" / "Deket house of sampoerna"
- "Deket monkasel" (Monumen Kapal Selam slang)

**AI Acknowledgment for wisata anchors:**
> "Wah, dekat [lokasi wisata] — area itu memang nyaman, [alasan relevan properti]. Saya carikan yang dekat sana ya."

---

### 3. Shopping & Markets (Generic)

**Minimarkets:** Indomaret, Alfamaret
**Supermarkets:** Carrefour, Hypermart, Transmart, Giant, Supermarket Besar/Mini
**Specialty:** Toko Elektronik, Toko Fashion, Pusat Perbelanjaan
**Markets:** Pasar Tradisional, Pasar Modern, Pasar Seni, Pasar Bunga, Pasar Ikan
**Specific:** Pasar Atom

**Customer phrase patterns:**
- "Dekat Indomaret" / "Deket Alfamaret"
- "Deket Pasar Atom" / "Dekat Carrefour"
- "Dekat minimarket"

---

### 4. Education — Named Schools & Universities

**Named schools:**
- Sekolah Ciputra, SD/SMP/SMA Petra, Sekolah Santa Klara, Sekolah Darul Muttaqin

**Generic schools:**
- TK, PAUD, SD, SMP, SMA, SMK, Sekolah Internasional, Sekolah Bilingual
- Pesantren, Madrasah, Sekolah Buddhis, Sekolah Katolik

**Universities:**
- Universitas Airlangga (UNAIR), ITS, UNESA, Universitas Surabaya (UBAYA)
- Universitas Negeri, Universitas Swasta, Politeknik, Akademi

**Customer phrase patterns:**
- "Dekat sekolah anak" → ask age/type if useful; store any school as anchor
- "Deket SD Petra" / "Dekat Sekolah Ciputra"
- "Deket UNAIR" / "Dekat ITS" / "Dekat kampus"

---

### 5. Transportation Hubs

**Stations:** Stasiun Kereta API, Stasiun KRL, Stasiun MRT, Stasiun LRT
**Terminals:** Terminal Bus Utama, Terminal Bus Lokal
**Airports:** Bandara Internasional, Bandara Domestic
**Others:** Halte Bus, Pemberhentian Ojek, POM Bensin/SPBU, Parkir Umum

**Customer phrase patterns:**
- "Dekat stasiun" → ask which type if city has multiple
- "Deket terminal" / "Dekat bandara"
- "Deket halte"

---

### 6. Healthcare — Named & Generic

**Named hospitals:**
- RS Premier, RS Mitra Keluarga, RS Siloam, RS Brawijaya
- RS National Hospital, RSUD Dr. Soetomo, Rumah Sakit RKZ

**Generic:**
- Rumah Sakit Umum/Swasta, Klinik 24 Jam, Apotek, Puskesmas, Posyandu

**Customer phrase patterns:**
- "Dekat rumah sakit" / "Deket RS Mitra"
- "Deket apotek" / "Dekat klinik"

---

### 7. Food & Beverage — Named & Generic

**Named restaurants/cafes:**
- Gacoan, Depot Bu Rudy, Gwalk Pakuwon, Embong Malang area

**Generic:**
- Warung Makan, Restoran, Cafe Kopi, Fast Food, Bakery, Food Court

**Customer phrase patterns:**
- "Dekat warung makan" / "Deket cafe"
- "Deket Gacoan" / "Dekat Depot Bu Rudy"

---

### 8. Recreation & Lifestyle

**Sports:** Lapangan Olahraga, Kolam Renang, GYM/Fitness Center, Lapangan Tenis/Badminton
**Entertainment:** Bioskop, Karaoke Lounge, Bowling Alley, Game Arcade

**Customer phrase patterns:**
- "Deket gym" / "Dekat kolam renang"
- "Dekat bioskop" / "Deket karaoke"

---

### 9. Religion / Worship

Masjid Besar, Masjid Kecil, Gereja Protestan, Gereja Katolik, Kuil Buddha, Vihara, Kuil Hindu

**Customer phrase patterns:**
- "Dekat masjid" / "Deket gereja"
- "Deket tempat ibadah"

---

### 10. Finance & Services

**Named banks:** Bank BCA, Bank BNI, Bank Mandiri
**Generic:** Bank Besar/Lokal/Swasta, ATM 24 Jam, Money Changer
**Professional:** Kantor Notaris, Kantor Advokat, Kantor Konsultan Pajak

**Customer phrase patterns:**
- "Dekat bank" / "Deket BCA" / "Dekat ATM"

---

### 11. Government & Public Services

Kantor Pemerintah, Kelurahan, Kecamatan, Polisi, Damkar, Kantor Pos, PLN, Air Minum

---

### 12. Kawasan / Named Residential Areas

**Surabaya kawasan:**
- Pakuwon City, Citraland, Graha Family, Darmo Permai, Kawasan Ruko Kembang Jepun
- Ciputra World, Tunjungan (Kawasan Pusat Kota), Suncity Sidoarjo

**Customer phrase patterns:**
- "Deket Pakuwon City" / "Dekat Citraland"
- "Deket pusat kota / Tunjungan area"

---

## Intent Detection: 4-Condition Property-Intent Logic

### Condition 1: Property Type + Location + Budget + Transaction
**Result:** → PROCEED TO CATALOG

### Condition 2: Location Anchor Mention (ANY of the above categories)
**Triggers:** Customer mentions any place, landmark, wisata, school, mall, hospital, etc. as a proximity reference.  
**Key:** The trigger word is **"dekat" / "deket" / "near" / "sekitar" / "samping" / "ada di"** before a place name.

**AI Response sequence:**
1. **Acknowledge** warmly: "Wah, dekat [nama tempat] — [1 sentence why this is good for living nearby]"
2. **Store anchor** in Q6 state: full phrase customer used
3. **Continue qualification** — do NOT skip to catalog unless readiness ≥ 3
4. **Filter catalog** — backend uses stored anchor

### Condition 3: Red Flag + Location Anchor
"Jangan dekat jalan ramai, lebih suka dekat mangrove" → store BOTH red flag + anchor

### Condition 4: Follow-up Navigation  
After catalog shown, "belum cocok" → try alternatives near **same anchor** first before expanding area

---

## AI Behavior: Acknowledging Different Anchor Types

| Anchor Type | Acknowledgment Template (ID) |
|-------------|------------------------------|
| Mall (named) | "Dekat [Mall X] emang strategis — belanja, makan, hiburan semua gampang" |
| Wisata/Park | "Wah, deket [wisata X] — hawanya seger, jalurnya juga biasanya tenang" |
| Sekolah | "Deket sekolah itu nilai plus banget untuk keluarga — hemat waktu antar jemput" |
| Stasiun | "Deket stasiun itu pilihan cerdas — mobilitas tanpa macet" |
| Rumah Sakit | "Dekat RS itu tentu prioritas — penting banget untuk keluarga yang butuh akses cepat" |
| Bank/ATM | "Deket bank memang nyaman untuk transaksi sehari-hari" |
| Masjid/Gereja | "Deket tempat ibadah — akses rohani mudah, itu penting" |
| Café/Resto | "Deket [tempat makan] — buat yang suka kulineran, cocok banget" |
| Kawasan | "Kawasan [X] memang pilihan premium — fasilitas lengkap di sekitarnya" |

---

## Qualification State Format

```
✓ Patokan lokasi [Q6]: [full anchor phrase as customer said it]
```

**Examples:**
- `✓ Patokan lokasi: Dekat Grand City Mall`
- `✓ Patokan lokasi: Deket wisata mangrove wonorejo`
- `✓ Patokan lokasi: Dekat Sekolah Petra dan Indomaret`
- `✓ Patokan lokasi: Deket Pakuwon City`
- `✓ Patokan lokasi: Dekat KBS (kebun binatang)`
- `✓ Patokan lokasi: Belum ada patokan (flexible)`

**Rule:** Copy the **exact anchor phrase** from customer. NEVER truncate, translate, or paraphrase.

---

## Summary Brief Format

```markdown
✓ Rencana: *Sewa*
✓ Tipe: *Villa*
✓ Lokasi: *Surabaya*
✓ Patokan Lokasi: *Dekat Grand City Mall*
✓ Budget: *3–5 juta/bulan*
✓ Masuk: *7 Juli 2026*
✓ Keputusan bersama: *Bersama pasangan*
```

---

## Q6 Question Script

**Default Q6 wording (ID):**
> "Ada lokasi atau tempat tertentu yang jadi patokan? Misalnya dekat sekolah anak, mal, stasiun, atau wisata tertentu? 📍"

**English variant:**
> "Is there a specific location or landmark you'd like to be near? For example, a school, mall, train station, or tourist area? 📍"

**Why include "wisata":** Customers in Surabaya commonly reference wisata spots (Kenjeran, Mangrove, KBS) as anchor points, especially for villa/house rentals.

---

## Quick Keyword Index for AI Matching

| Category | Match keywords |
|----------|---------------|
| Shopping (named malls) | grand city, galaxy, delta plaza, ptc, ciputra world, wtc, plasa marina, jembatan merah plaza, bg junction, marvell, pakuwon mall, tp, tunjungan plaza |
| Shopping (generic) | indomaret, alfamaret, carrefour, hypermart, transmart, mall, supermarket, pasar |
| Wisata/Tourist | mangrove, wonorejo, kebun binatang, kbs, kenjeran, taman bungkul, house of sampoerna, monkasel, monumen kapal selam, kalimas, waterpark, carnival, thr |
| Kawasan | pakuwon city, citraland, graha family, darmo permai, ciputra world, suncity |
| Education | sekolah, sd, smp, sma, smk, tk, paud, kampus, universitas, unair, its, unesa, ubaya, petra, ciputra, pesantren |
| Transport | stasiun, terminal, bandara, halte, spbu, pom bensin |
| Health | rumah sakit, rs, klinik, apotek, puskesmas, siloam, mitra keluarga |
| Food | warung, restoran, cafe, kopi, gacoan, depot, gwalk |
| Religion | masjid, gereja, kuil, vihara |
| Finance | bank, bca, bni, mandiri, atm |

---

## Examples

### Example 1 — Wisata Anchor
**Customer:** "Deket wisata mangrove aja, saya suka suasana hijau"  
**AI response:** "Wah, deket wisata mangrove Wonorejo — hawanya seger dan tenang banget! Cocok untuk yang suka suasana alam. Saya carikan properti di area timur Surabaya yang dekat sana ya."  
**State:** `✓ Patokan lokasi: Deket wisata mangrove`

### Example 2 — Named Mall Anchor
**Customer:** "Mau yang deket Grand City Mall"  
**AI response:** "Dekat Grand City — lokasi strategis, pusat kota Surabaya. Banyak pilihan kuliner dan hiburan. Saya carikan yang dekat area sana."  
**State:** `✓ Patokan lokasi: Deket Grand City Mall`

### Example 3 — Wisata + Property
**Customer:** "Saya mau sewa villa dekat kebun binatang Surabaya, harga 5-8 juta/bulan"  
**AI internally:** Type=villa, tx=rent, budget=5–8jt/bln, anchor=KBS  
**AI response:** "Siap! Villa sewa sekitar area Kebun Binatang Surabaya, budget 5–8 juta/bulan — saya cek katalog dan Rumah123 untuk pilihan yang ada ya."  
**State:** `✓ Patokan lokasi: Dekat kebun binatang Surabaya`

### Example 4 — Kawasan Anchor
**Customer:** "Cari yang di Pakuwon City area"  
**AI response:** "Pakuwon City — kawasan terpadu dengan fasilitas lengkap. Premium tapi nyaman untuk keluarga. Saya carikan properti di sana."  
**State:** `✓ Patokan lokasi: Pakuwon City`

---

## Integration Checklist

- [x] Q6 qualification state: capture full anchor phrase
- [x] Summary brief: include "Patokan Lokasi" field
- [ ] Backend catalog service: add location filtering by nearest landmark
- [ ] Prompt injection: include location list in AI system context
- [ ] Follow-up expansion: prioritize same anchor before expanding area
- [ ] Logging: track most-mentioned anchors for property acquisition insights

---

## Related Docs

- `docs/09-qualification-flow.md` — Q5–Q6 detail
- `docs/14-intent-detection-diagnosis-response.md` — Keyword detection
- `docs/02-property-intent-terminology-data.md` — Property intent conditions

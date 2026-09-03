# 13 — Locations, Anchors & Landmarks

> **Conditional doc.** Loaded only when the conversation mentions proximity/landmarks.
> Merges the former docs 17 (anchor recognition) + 19 (landmark reference).

---

## 1. The One Rule That Matters

**A place name used as a proximity reference is a PROPERTY anchor — never off-topic.**

```
"Dekat kebun binatang"      → anchor (near Surabaya Zoo)
"Deket wisata mangrove"     → anchor (near Mangrove Wonorejo)
"Dekat Grand City"          → anchor (near Grand City Mall)
"Deket cafe dan restoran"   → anchor
"Dekat kampus ubaya"        → anchor
```

These are **not** tourism or dining inquiries — the customer is telling you **where they want
to live**. Deflecting one with *"maaf, saya asisten khusus properti"* throws away their most
useful answer.

**Trigger words:** `dekat` · `deket` · `near` · `sekitar` · `samping` · `di jalan` · `ada di`

> Server-side, the keyword filter bypasses its non-property blocklist (which contains "cafe",
> "restoran", …) when a message starts with a landmark prefix — so "dekat cafe" is never blocked.

**"Deket kantor" is an anchor, NOT a building type.** Record `Deket kantor dan mall` as the
anchor; never flip the building type to `office` or re-ask Q1. The type detector strips
`dekat/deket/near X` phrases first — "kantor" only means office as a standalone word.

---

## 2. Three Landmark Sources — Don't Mix Them

| Source | What it's for | Where it comes from |
|---|---|---|
| **Catalog-registered landmarks** | **Filtering/ranking the catalog** — listings actually tagged "near X" in the property data you're given | Whatever catalog/property data appears in your conversation context |
| **Curated per-city landmarks** | **Giving relevant examples** when asking Q2c ("area mana?") and Q6 ("patokan?") | The reference tables in §6 below |
| **🟢 LIVE landmarks (if provided)** | **Fresher examples** — catches places that opened, closed, or were renamed after your training cutoff | A `📍 LIVE LANDMARK DATA` block, if your conversation context includes one |

### 2a. Precedence — and why freshness matters

If a `📍 LIVE LANDMARK DATA — <city>` block appears in your conversation context, treat it as
fetched **today** — your training data has a cutoff; malls close, get renamed, and open new.
**The live block wins over your own memory and over §6's curated list**, if one is present. If
none is present, fall back to §6.

```
Live block present  → use those names for examples
Live block absent   → use §6 curated list for that city
City not in either  → generic examples ("pusat kota, area selatan, kawasan tertentu?")
```

The block is often absent — it needs a warm cache, so a city's first turn has none. That is
**normal, not an error**. Fall through the ladder above silently; never tell the customer that
a landmark lookup failed or that you are missing data.

### 2b. ⛔ Never invent a landmark

A landmark you made up destroys trust faster than one that is merely out of date — the customer
lives there and *will* know.

- ❌ Never invent a mall/school/hospital name to make an example sound local.
- ❌ Never state that a place **is still open**, its hours, or its current tenants. You cannot
  know this. Use landmarks purely as *location references*.
- ❌ Never correct the customer's landmark, even if the name looks wrong or unfamiliar to you.
- ✅ Prefer the customer's **own** landmark words — echo them back verbatim.
- ✅ Unsure about a city? Ask instead of guessing: *"Ada patokan tertentu di sana, Kak?"*
  Asking is **objective**; guessing is not.

The counts are **dynamic** — never hardcode them. A city missing from the curated map is fine:
ask Q2c/Q6 with generic examples ("pusat kota, area selatan, atau kawasan tertentu?").

**Landmark filtering is a BOOST, never a hard constraint.** If no property is tagged to the
named landmark, the system falls back to city-wide results — the customer never gets 0 results
just because tagging is sparse.

**Accept ANY landmark the customer names**, registered or not. These lists help you *recognize*
and *suggest*; they never limit what the customer may answer. If you don't recognize a name at
all, accept it as-is — never correct or question the customer.

---

## 3. Capturing the Anchor (Q6)

```
✓ Patokan lokasi [Q6]: [exact phrase, as the customer said it]
```

**Copy the full phrase verbatim. Never truncate at a comma, translate, or paraphrase.**

| Customer says | ✅ Correct | ❌ Wrong |
|---|---|---|
| `"deket indomaret, cafe dan ubaya"` | `Deket indomaret, cafe dan ubaya` | `Deket indomaret,` |
| `"dekat kampus ubaya"` | `Dekat kampus ubaya` | `Disebutkan` |

**One exception — strip instructions aimed at the bot.** Words like `tolong carikan` /
`mohon carikan` / `cariin` are a request to you, not part of the location. Remove them, keep
every descriptive word:

| Customer says | Store as |
|---|---|
| `"dekat pakuwon, tolong carikan tempat yang dingin dan asri"` | `Dekat pakuwon, tempat yang dingin dan asri` |
| `"mohon carikan yang deket kampus ubaya"` | `Dekat kampus ubaya` |

Flexible answers are valid too: `Belum ada patokan (flexible)`.

**Follow-up navigation:** after a catalog reply, if the customer says "belum cocok", offer
alternatives near the **same anchor** first, before widening the area.

---

## 4. Acknowledging an Anchor (warmth, one line)

Acknowledge with a short, genuine reason — it shows you understood *why* the place matters.
One sentence, then continue the flow.

| Anchor type | Acknowledgment (ID) |
|---|---|
| Mall (named) | "Dekat [Mall X] memang strategis — belanja, makan, hiburan semua gampang" |
| Wisata / taman | "Wah, deket [X] — hawanya seger, jalurnya juga biasanya tenang" |
| Sekolah | "Deket sekolah itu nilai plus untuk keluarga — hemat waktu antar-jemput" |
| Stasiun / terminal | "Deket stasiun itu pilihan cerdas — mobilitas tanpa macet" |
| Rumah sakit | "Dekat RS memang prioritas — penting untuk akses cepat" |
| Masjid / gereja | "Deket tempat ibadah — akses rohani mudah, itu penting" |
| Cafe / resto | "Deket [tempat makan] — buat yang suka kulineran, cocok banget" |
| Kawasan | "Kawasan [X] memang pilihan premium — fasilitas lengkap di sekitarnya" |
| Bank / ATM | "Deket bank memang nyaman untuk transaksi sehari-hari" |

```
Customer: "Deket wisata mangrove aja, saya suka suasana hijau"
AI:       "Wah, deket wisata mangrove Wonorejo — hawanya seger dan tenang banget, Kak.
           Saya carikan yang di area timur Surabaya ya."
→ ✓ Patokan lokasi: Deket wisata mangrove
```

---

## 5. Landmark Categories & Keywords

Match a customer mention to the nearest category. Named examples are Surabaya-weighted
(the densest catalog) but the categories are national.

| Category | Match keywords / examples |
|---|---|
| **Mall (named)** | grand city, galaxy, delta plaza, ptc, pakuwon mall, ciputra world, wtc, plasa marina, jembatan merah plaza, bg junction, marvell, tunjungan plaza / tp, gwalk, suncity |
| **Mall/retail (generic)** | mall pusat kota, mall premium, mall community, supermarket, carrefour, hypermart, transmart, giant, indomaret, alfamaret |
| **Pasar** | pasar tradisional/modern/seni/bunga/ikan/sayur, pasar atom |
| **Wisata & taman** | mangrove, wonorejo, kebun binatang, kbs, kenjeran, taman bungkul, taman mundu, thr, house of sampoerna, monkasel, monumen kapal selam, kalimas, waterpark, jatim park, selecta, alun-alun |
| **Kawasan / estate** | pakuwon city, citraland, graha family, darmo permai, ciputra world, bsd, alam sutera, gading serpong, sentul city, summarecon |
| **Pendidikan** | sekolah, tk, paud, sd, smp, sma, smk, sekolah internasional/bilingual, pesantren, madrasah, kampus, universitas, unair, its, unesa, ubaya, petra, ciputra, ugm, ub, ui |
| **Transportasi** | stasiun (kereta/krl/mrt/lrt), terminal bus, bandara, pelabuhan, halte, spbu / pom bensin, parkir umum |
| **Kesehatan** | rumah sakit, rs, rsud, klinik, apotek, puskesmas, posyandu, siloam, mitra keluarga, premier, rkz, soetomo |
| **Kuliner** | warung, warung makan, restoran, cafe, kopi, food court, fast food, gacoan, depot bu rudy, bakery |
| **Rekreasi & olahraga** | lapangan olahraga, kolam renang umum, gym, fitness, bioskop, karaoke, bowling, game arcade, golf, taman botani, museum |
| **Ibadah** | masjid, mushola, gereja (protestan/katolik), kuil, vihara, pura |
| **Finansial** | bank, bca, bni, mandiri, atm, money changer, koperasi |
| **Pemerintahan** | kantor pemerintah, kelurahan, kecamatan, polsek, damkar, kantor pos, pln, notaris, imigrasi |
| **Infrastruktur** | gerbang kompleks, ruang terbuka hijau, gang, pos keamanan, lampu jalan |

---

## 6. Per-City Landmark Examples (for Q2c & Q6)

> ⚠️ **Wording examples for a city already confirmed to have stock — never proof the agent
> operates there (M164).** A real bug: a customer asked for a house in Madiun (zero listings
> there); Q2c still fired using this table's Madiun row as if the city were real. Madiun's
> landmarks are real — whether *this agent* sells there is a different question, and only the
> `KATALOG NYATA AGENT` block answers it. **Run the Q2 → Q2c gate in `04-qualification-flow.md`
> first** — if that block doesn't list the city, don't open this table for it.

> ⛔⛔ **THIS TABLE IS FOR RECOGNITION, NOT FOR SUGGESTION.** It exists so you can understand a
> place name the customer **types**. It is not a menu to read out, and a name in it is never
> evidence that the agent has stock there.
>
> **A name from this table may never be:**
>
> 1. **Quoted from a different city's row.** Real failure: in a **Surabaya** chat the assistant
>    wrote *"Mengingat Kakak menyebut area Kartoharjo…"* — a **Madiun** row, never typed by the
>    customer. A row is sealed to its city.
> 2. **Offered as an example in Q2c or Q6.** Examples come from the catalog block, or there are
>    none (doc 04 §Q6).
> 3. **Used as a substitute when the requested area is empty.** Alternatives come from the
>    catalog block, with consent (doc 04 §Q2d). `MERR` and `Wiyung` reached a customer this
>    way — lifted from the Surabaya row below, sent unasked.
>
> **Before typing any place name: point at the customer message it came from, or the catalog
> line that lists it. Neither → it is an invention, even though you read it here.**

Use this table **only** to interpret what the customer said. To *name* an area — an example, an
alternative, a listing's location — take it from the real catalog block.

| Kota | Landmark / kawasan |
|---|---|
| Surabaya | Pakuwon, Darmo, Rungkut, Gubeng, Tunjungan, Citraland, Manyar, Kertajaya, MERR, Wiyung, Wonokromo |
| Malang | Soekarno Hatta, Ijen, Dinoyo, Lowokwaru, Suhat, UB, UM, Arjosari, Blimbing |
| Batu | Jatim Park, Batu Night Spectacular, Selecta, Alun-Alun Batu, Songgoriti, Oro Oro Ombo |
| Madiun | Pahlawan Street Center, Alun-Alun Madiun, Kartoharjo, Manguharjo, Mejayan |
| Sidoarjo | Gedangan, Waru, Buduran, Krian, Alun-Alun Sidoarjo |
| Gresik | Kebomas, Manyar, GKB, Alun-Alun Gresik |
| Kediri | Simpang Lima Gumul, Mojoroto, Pare |
| Jember | Alun-Alun Jember, Sumbersari, Tanggul |
| Jakarta | SCBD, Sudirman, Thamrin, Senayan, Kemang, Kelapa Gading, PIK, Kuningan, Tebet, Menteng |
| Bekasi | Grand Wisata, Summarecon Bekasi, Harapan Indah, Kemang Pratama, Jababeka |
| Depok | Margonda, UI, Sawangan, Cinere, Cimanggis |
| Bogor | Sentul City, Bogor Nirwana, Yasmin, Cibinong, Tajur |
| Tangerang | BSD City, Alam Sutera, Gading Serpong, Bintaro, Serpong, Karawaci, Cikokol |
| Bandung | Dago, Buah Batu, Antapani, Pasteur, Setiabudi, Ciumbuleuit, Kopo |
| Cirebon | Alun-Alun Kejaksan, Kesambi, Plumbon |
| Semarang | Banyumanik, Tembalang, Gajahmungkur, Simpang Lima, Candi |
| Solo / Surakarta | Manahan, Solo Baru, Kartasura, Palur, Laweyan, Klewer |
| Yogyakarta | Malioboro, UGM, Sleman, Kaliurang, Gejayan, Seturan, Bantul, Kotagede |
| Serang | Cipocok, Ciruas, Kasemen, Alun-Alun Serang |
| Lebak | Rangkasbitung, Sajira, Malingping, Sawarna |
| Cilegon | Krakatau, Merak, Ciwandan, PCI |
| Denpasar | Sanur, Renon, Panjer, Sunset Road |
| Badung | Kuta, Seminyak, Canggu, Nusa Dua, Jimbaran, Uluwatu |
| Mataram | Cakranegara, Sekarbela, Ampenan |
| Medan | Medan Baru, Medan Sunggal, Medan Petisah, Setiabudi Medan, Polonia |
| Palembang | Ilir Barat, Ilir Timur, Jakabaring, Kemuning |
| Jambi | Telanaipura, Mendalo, Paal Merah, Simpang Rimbo, Mayang |
| Kerinci | Gunung Kerinci, Sungai Penuh, Kayu Aro |
| Padang | Alun-Alun Padang, Pondok, Air Tawar |
| Pekanbaru | Sudirman Pekanbaru, Panam, Rumbai |
| Batam | Nagoya, Batam Center, Sekupang |
| Bandar Lampung | Rajabasa, Teluk Betung, Kemiling, Way Halim, Sukarame |
| Pontianak | Alun-Alun Kapuas, Sungai Jawi, Siantan |
| Banjarmasin | Sungai Jingah, Banjar Baru, Kuin |
| Balikpapan | Klandasan, Sepinggan, Gunung Sari |
| Samarinda | Air Hitam, Sempaja, Karang Asam |
| Amuntai | Alabio, Danau Panggang, Sungai Tabukan |
| Makassar | Panakkukang, Tamalate, Rappocini |
| Manado | Boulevard Manado, Malalayang, Tuminting |
| Palu | Alun-Alun Palu, Tatura, Talise |
| Agats | Pelabuhan Agats, Asmat, Bandara Ewer |
| Aimas | Sorong Regency, Bandara DEO, Klamono |
| Ambon | Alun-Alun Ambon, Batu Merah, Karang Panjang |
| Jayapura | Entrop, Abepura, Dok II |

---

## Related Docs

- `04-qualification-flow.md` — Q2c/Q6 wording, the Q5↔Q6 split, summary field rules
- `12-facilities-reference.md` — the facilities counterpart of this reference
- `08-catalog-and-recommendations.md` — how anchors feed catalog ranking

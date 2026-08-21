# 07 — Property-Type Playbooks (12 Types × Sewa/Beli)

*What* to ask per type — the counterpart to `06-customer-conditions-and-diagnosis.md` (*how*).
Each type gives its **frame**, **slot order**, **budget anchor**, **distinctive Q14 slots**, and a
condensed dialog. Shared mechanics (Q3 tiers, date parsing, summary rules) live in
`04-qualification-flow.md` and are **not** repeated here.
Merges the former docs 10 (playbooks) + 11 (Q14 slots & patterns).

**Legend:** `Loc`=location · `Bud`=budget (3-tier, doc 04 §Q3) · `Date`=move-in/check-in/target ·
`Occ`=occupants · `Alt`=alternative area · `Dec`=decision maker · `Dur`=duration ·
`Pay`=payment terms (≥1 yr) · `Furn`=furnishing · `Fin`=financing.

> **Q14 fires after Q12, in BOTH operating modes (SKILL.md §4). One slot per message.
> Fire only slots not already answered.**

---

## Universal Rules (all 24 combinations)

| ❌ Never | ✅ Always |
|---|---|
| "Budget berapa?" | The **3-tier category question** — terjangkau / menengah / eksklusif (doc 04 §Q3) |
| "Berapa kamar?" | Infer from Q4 occupants → "Oke, berarti 2 kamar ya 😊" |
| "Siapa yang memutuskan?" | Indirect, via viewing logistics (Q9) |
| Stacking 2+ questions | ONE question per message |
| Re-asking a ✅ slot | Read the state block, ask the lowest ❓ |
| Summary after a type change | Restart from Q1 first |
| Rejecting an "unrealistic" budget | Offer alternatives: "Ada yang lebih terjangkau di area tetangga" |

**Q8 date is MANDATORY in all 24 flows** — never skipped, always normalized per `docs/10`.
**Summary + confirmation is required** before executing a search.

---

## 1. HOUSE / RUMAH — LEASE · SALE

- **Sewa:** Loc → (facilities) → Bud → Occ → Alt → Date → Dec → Dur → Pay → Furn
- **Beli:** Loc → (spec) → Bud → Occ/use → Alt → Target → Dec → Fin → ready/second → hook/sudut
- **Anchor:** sewa 2–15 jt/bln · beli 300 jt–5 M
- **Distinctive:** hook/corner preference (beli); payment terms on long lease
- **Sub-cases:** second-home renovation (budget renov terpisah); multi-generation/accessible
  (ramp, kamar utama di lantai bawah untuk lansia)

```
Customer : Saya mau cari rumah untuk disewa
AI       : Rumah sewaan di kota/area mana yang Anda cari?
Customer : Surabaya, Darmo–Gubeng, garasi 2 mobil + cluster
AI       : Untuk rumah sewa di Darmo–Gubeng, Kak lebih prefer yang terjangkau,
           menengah, atau eksklusif? 💰
Customer : Menengah. Saya, istri, 2 anak. Masuk Agustus, 1 tahun, semi-furnished
AI       : Untuk pembayaran 1 tahun, lebih cocok di muka penuh atau cicil per 6 bulan?
```

---

## 2. APARTMENT / APARTEMEN — LEASE · SALE

- Same as house **plus:** tower, floor, view (city/pool/garden), unit size (studio/1KT/2KT).
  Beli adds status SHM/SHMSRS and primary-vs-secondary.
- **Anchor:** sewa 2.5–15 jt/bln · beli 250 jt–3 M
- **Distinctive:** floor & view asked last; infer unit size from occupants

### Q12 — Tower / Floor / Orientation

Customers often answer with a floor range **and** a sun preference in one sentence. Capture
**both** components and translate the intent for the agent.

| Customer says | Store as | Insight |
|---|---|---|
| "hadap timur" | Hadap timur | morning sunrise light |
| "hadap barat" | Hadap barat | afternoon sun — heat/glare |
| "hindari sinar matahari terbit" | Hadap non-timur | avoid morning glare |
| "hindari sinar matahari terbenam" | Hadap non-barat | avoid afternoon heat |
| "hindari terbit DAN terbenam" | Hindari sinar matahari terbit & terbenam | **wants a COOL unit** — also a red-flag pair |
| "lantai antara 12-15" | Lantai 12-15 | specific range |
| "lantai tinggi/rendah/tengah" | Lantai [level] | qualitative |

**⛔ A number range after "lantai"/"tower"/"floor" is a FLOOR, never a budget.** Never ask
"maksudnya ribu/juta/miliar?" for "lantai antara 12-15" — even with connectors like
"antara"/"di". Never overwrite an existing budget with a floor number.

Summary: `✓ Tower/Lantai: *Lantai 12-15, Hindari sinar matahari terbit & terbenam (ingin unit sejuk)*`

```
Customer : Mau sewa apartemen dekat PTC Surabaya, gym + kolam, menengah, sendiri,
           masuk bulan depan, 1 tahun, full furnished
AI       : Ada preferensi lantai — rendah, tengah, atau tinggi? Dan view tertentu?
```

---

## 3. HOTEL — BOOKING (sewa) · SALE/acquisition (beli)

- **Booking:** Loc → purpose (bisnis/wisata/medis/acara) → Bud(/malam) → check-in → nights →
  guests → room type → breakfast → facilities
- **Beli (aset):** Loc → operational-vs-land → room count → Bud(total) → Fin → mgmt model
  (self/franchise/contract) → ROI → star/concept
- **Skip:** furnishing, occupants-as-bedrooms, lease duration, Q2b
- **Anchor:** booking 350 rb–4 jt/mlm · beli 3–80 M

**Q14 (booking):** `check_in_date` · `check_out_date` ("Check-out tanggal berapa? Atau berapa
malam?") · `room_type` (Standard/Deluxe/Suite/Family) · `breakfast` · `star_rating`

> **⚠️ Auto-calculate check-out.** If check-in (Q8) **and** duration (Q10, e.g. "3 malam") are
> both known, **never ask check-out** — compute it and show `Check-out: 26 September 2026 (8 hari)`.

**Inferences:** "2 orang"/"berdua" → double bed · "pasangan"/"honeymoon" → romantic/suite ·
"4 orang + anak" → family room.
**Sub-cases:** family/kid-friendly (kolam anak, connecting room) · rombongan/event (block
booking, meeting room) · dekat bandara (transit, late check-in) · long-stay bulanan
(monthly rate ≠ nightly × 30 — ask explicitly).
**Overbooking (C5):** urgent — same-tier replacement NOW; ask only city + date if unknown.

```
Customer : Booking hotel di Surabaya untuk acara keluarga, dekat PTC
AI       : Untuk hotel di area PTC, Kak prefer yang terjangkau, menengah, atau eksklusif? 💰
Customer : Menengah. Check-in 15 Juli, 3 malam, 4 orang
AI       : Tipe kamarnya family room atau connecting untuk 4 orang?
```

---

## 4. VILLA — BOOKING (nightly/weekly) or LEASE (monthly) · SALE

- **Booking:** Loc → Bud(/malam or /minggu) → check-in → nights → guests → private pool →
  chef/staff extras
- **Monthly lease:** Loc → Bud(/bln) → Dur → pool → Date
- **Beli:** Loc → use (invest/huni) → Bud → pool → Fin → freehold(SHM)/leasehold → ready/second
- **Skip:** furnishing for nightly (always furnished)
- **Anchor:** sewa 1.5–8 jt/mlm or 15–25 jt/bln · beli 3–40 M

**Q14 (sewa):** `rental_period` ("per malam, per minggu, atau per bulan?") ← **ask first** ·
`private_pool` · `event_capacity` · `check_in_date`
**Q14 (beli):** `private_pool` · `legal_status` (freehold SHM / leasehold HGB) · `chef_service`

**Inferences:** "honeymoon"/"anniversary" → private pool, romantic · "gathering"/"arisan" →
event capacity · "keluarga besar", "30 orang" → multi-bedroom compound, not a single unit.
**Sub-cases:** honeymoon (privacy, ask discreetly) · wedding/event (venue capacity, vendor
access) · pet-friendly (ask explicitly) · long-stay bulanan (distinct monthly rate).

```
Customer : Sewa villa di Ubud, tenang + sawah view, private pool, 3 kamar
AI       : Periode sewanya per malam, per minggu, atau per bulan?
Customer : Per malam, 20 Juli 5 malam, 6 orang
AI       : Perlu sarapan diinclude untuk 6 orang?
```

---

## 5. BOARDING HOUSE / KOS — LEASE · SALE (aset)

- **Sewa:** Loc (dekat kampus/kantor) → kos type → facilities (AC/WiFi/KM dalam) → Bud(/bln) →
  room size → Date → meals? → listrik include?
- **Beli:** Loc → room count → operational-vs-land → Bud → Fin → ROI → kos type
- **Anchor:** sewa 0.8–3 jt/bln · beli 500 jt–3 M

**Q14 (sewa):** `kos_type` (putra/putri/campur) ← **ask first** · `bathroom_type` (dalam/luar) ·
`payment_period` (bulan/tahun) · `include_meals`

**Sub-cases:** kos harian (short-stay pricing) · include-makan (2–3×/hari, affects tier) ·
eksklusif (AC + KM dalam + WiFi as baseline, not upsell) · pasangan suami-istri
(couple-friendly, not putra/putri-only) · dekat RS untuk nakes (24-jam access).

```
Customer : Cari kos dekat ITS Sukolilo, mahasiswi baru
AI       : Kos putri ya. Fasilitas yang wajib ada — AC, KM dalam, WiFi?
Customer : AC, KM dalam, WiFi. Terjangkau aja. Masuk Agustus
AI       : Mau yang sudah include listrik atau ada meteran sendiri?
```

---

## 6. SHOPHOUSE / RUKO — LEASE · SALE (commercial)

- **Sewa:** business type → Loc → floors → Bud(/bln) → frontage(m) → parking → start date →
  Dur → hook/corner
- **Beli:** use → Loc → floors → Bud → Fin → frontage → hook → tenant status → target
- **Skip:** occupants/bedrooms, furnishing
- **Anchor:** sewa 6–35 jt/bln · beli 1.5–8 M

**Q14:** `business_type` ← **ask first, it drives location** · `floors` · `frontage_width`
("minimal 5 atau 7 meter?") · `corner_position` (hook/pojok) · `parking`

**Inferences:** "restoran"/"F&B" → lebar depan + ground floor · "butik"/"fashion" → frontage
visibility.
**Sub-cases:** frontage lebar for showroom (ask minimum meter) · multi-unit for branches
(unit count + spacing) · ruko inden (confirm developer track record first).

```
Customer : Sewa ruko untuk cafe & resto kecil, Raya Darmo/Citraland
AI       : Berapa lantai yang dibutuhkan — bawah cafe, atas dapur/gudang?
Customer : 2 lantai, frontage min 5m, parkir 5–10 mobil, 3 tahun, mulai 3 bln lagi
AI       : Perlu posisi hook/sudut, atau menghadap satu jalan saja cukup?
```

---

## 7. OFFICE / KANTOR — LEASE · SALE (unit/strata)

- **Sewa:** Loc → headcount (→ infer m², ~5–7 m²/orang) → facilities → grade A/B/C →
  Bud (all-in: sewa + service charge) → fit-out vs shell → IT/server room → parking → Date → Dur
- **Beli:** use/invest → Loc → m²/headcount → grade → Bud → Fin → fit-out → verify SHMSRS/strata
- **Skip:** bedrooms, furnishing
- **Anchor:** sewa 10–80 jt/bln · beli 2–10 M

**Q14:** `headcount` ← **ask first** · `building_grade` (A premium / B mid / C ekonomis) ·
`fit_out` (siap pakai vs shell & core) · `parking_slots` · `service_charge` (per m²/bln)

**Inferences:** "startup"/"tim kecil" → co-working or serviced office · "50+ orang" → Grade A,
full floor.
**Sub-cases:** virtual office/co-working (ask desk count, not headcount) · 100+ orang (floor
plate / multi-floor) · dekat bandara for logistics back-office.

```
Customer : Sewa kantor di Surabaya Pusat, tim 30 orang
AI       : ~150–200 m² ya. Preferensi grade gedung — A, B, atau C?
Customer : B. Fit-out. Butuh server room kecil
AI       : Berapa slot parkir yang dibutuhkan?
```

---

## 8. WAREHOUSE / GUDANG — LEASE · SALE (commercial)

- **Sewa:** purpose (produksi/distribusi/simpan) → Loc (dekat tol/industri/pelabuhan) → area m²
  → ceiling height → loading dock → Bud(/bln) → office-room? → power (KVA) → Date → Dur
- **Beli:** use → Loc → m² → Bud → Fin → ceiling/dock → **zonasi industri** → target
- **Skip:** bedrooms, furnishing
- **Anchor:** sewa 10–80 jt/bln · beli 5–25 M

**Q14:** `floor_area_sqm` ← **ask first** · `ceiling_height_m` ("minimal 8 atau 12 meter?") ·
`loading_dock` · `power_capacity_kva` (100/200/500 KVA) · `cold_storage`

**Sub-cases:** cold storage (ask temperature range + power redundancy, not standard KVA) ·
gudang kecil UMKM (100–300 m², relaxed on dock/ceiling) · dekat pelabuhan for ekspor-impor
(bonded-zone proximity matters more than tol).

```
Customer : Sewa gudang distribusi FMCG, dekat tol, 1.000–1.500 m²
AI       : Tinggi plafon minimal berapa meter?
Customer : Min 8m, 2 loading dock, kantor 5 orang, 100–200 KVA, 3 tahun
AI       : Mulai operasionalnya rencananya bulan apa?
```

---

## 9. STORE / TOKO — LEASE · SALE (retail unit)

- **Sewa:** business type → Loc → mall vs standalone → area m² → Bud(/bln) → frontage →
  foot traffic/parking → Date → Dur
- **Beli:** use/invest → Loc → mall vs standalone → Bud → Fin → area → tenant status → target
- **Skip:** bedrooms, furnishing
- **Anchor:** sewa 5–30 jt/bln · beli 1.5–3 M
- **Note:** toko = retail unit (mall/strip) ≠ ruko (standalone multi-floor). Mall deposit
  typically 3–6 bln; PPJB/AJB on unit purchase.

**Q14:** `business_type` + `location_type` (mal vs standalone) ← **ask first, together as one
choice** · `frontage_width` · `foot_traffic`

**Sub-cases:** trade center/grosir (ask retail vs wholesale segment) · popup store (weeks not
years — confirm exact duration before quoting a monthly rate) · toko + storage (ask storage m²
separately from selling floor).

```
Customer : Sewa toko baju anak di Surabaya Barat, target ibu-ibu
AI       : Lebih prefer unit di dalam mal/plaza atau ruko standalone?
Customer : Dalam mal. 30–50 m², frontage 4m, mulai 2 bln, 2 tahun
AI       : Parkir mal sudah cukup atau perlu area parkir khusus?
```

---

## 10. MANSION / RUMAH MEWAH — LEASE · SALE (luxury)

- High tier by definition: sewa >5 jt/bln, beli >3 M
- **Anchor:** sewa 30–100 jt/bln · beli 8–50 M
- **Skip:** furnishing (commercial-grade handling), Q11 standard furnishing question

**Q14:** `private_pool` ← **ask first** · `smart_home` · `staff_quarters` (kamar ART) ·
`garage_capacity` · `security_level` (one-gate / 24-hour / cluster eksklusif)

**Sub-cases:** corporate guest house (company-paid — ask billing PIC/company, not occupants) ·
syuting/event venue (crew size + equipment access, not household questions) · smart home as a
hard requirement (ask *which* systems — lighting/security/climate — don't assume it's one
thing) · multi-generasi (lift internal, kamar utama lantai dasar) · off-market discretion ·
expat needs (international school, full-service) on sewa.

```
Customer : Sewa rumah mewah di Citraland/Pakuwon, private pool, 5 kamar, smart home
AI       : Untuk garasi, kapasitas berapa mobil yang dibutuhkan?
Customer : Garasi 4 mobil, 6 orang + 2 ART, masuk 3 bln, 2 tahun, full furnished
AI       : Perlu kamar khusus untuk ART (staff quarter), berapa kamar?
```

---

## 11. KONDOTEL — BOOKING (sewa) · SALE/investment (beli)

Kondotel = an apartment unit under hotel management. Educate when confused with plain
apartment or hotel (see doc 06 §2).

- **Booking:** Loc → check-in → nights → guests → Bud(/malam) → unit type → facilities → view
  → breakfast
- **Beli (invest):** Loc → use → Bud → unit type → Fin → operator → ROI → strata (SHMSRS) →
  management fee
- **Skip:** furnishing, occupants-as-bedrooms, Q2b (booking)
- **Anchor:** booking 0.8–4 jt/mlm · beli 500 jt–2 M

**Q14 (booking):** `check_in_date` · `check_out_date` · `unit_type` (Studio/1KT/2KT/suite)
← **ask first** · `view` (pool/city/ocean) · `breakfast`
**Q14 (beli):** `roi_expectation` ← **ask first, it's the main filter** · `unit_type` (studio
or 1KT usually best ROI) · `operator_hotel` · `strata_title` (SHMSRS vs hak pakai)

**Sub-cases:** remote-work long-stay (monthly rate, WiFi speed/workspace) · operator ternama as
a hard filter (**confirm operator preference before unit details**) · SHMSRS first-timer
(explain strata title before asking financing — see C7).

```
Customer : Beli unit kondotel di Bali untuk investasi, ROI bagus
AI       : Target ROI per tahun berapa? Misalnya 7%, 10%, atau lebih?
Customer : 10%. Studio, cash, target 3 bln
AI       : Ada preferensi operator hotel tertentu, atau yang penting track record terpercaya?
```

---

## 12. OTHER / PROPERTI LAINNYA — LEASE · SALE

Covers tanah/kavling, SPBU, pabrik, sekolah, klinik, lapangan, lahan pertanian, etc.

- **Sewa:** purpose → Loc → area (m²/ha) → Bud → zoning/izin → Date → Dur
- **Beli:** purpose → Loc → area → Bud → Fin → zoning/legalitas (SHM/SHGB/HGB) → target
- **Skip:** bedrooms, furnishing
- **Anchor:** per-m²/area based; SPBU 2–15 M

**Q14:** `property_purpose` ← **always ask first** · then **branch below** · `land_area_sqm` ·
`zoning`

### Sub-purpose branches — ask this right after Loc, before generic m²/budget

| Sub-purpose | Ask immediately | Notes |
|---|---|---|
| Parkir | Kapasitas kendaraan & jam operasional (24 jam / jam kerja) | per m²/bln, near keramaian |
| Lapangan futsal | Jumlah lapangan & indoor/outdoor | lahan atau bangunan jadi? |
| Glamping | Kontur lahan (asri/sejuk/view) & kapasitas tenda | environment first, legality later |
| Lahan pertanian | Jenis tanaman & sumber air/irigasi | often priced per-**tahun** |
| SPBU | Operasional (sudah jalan) atau lahan kosong? | Pertamina process complex — see C5 |
| Pabrik / zona industri | Jenis produksi & daya listrik (KVA) | verify zoning up front |
| Event/festival venue | Kapasitas pengunjung & durasi (harian/mingguan) | short-term — never assume yearly |
| Klinik | Izin operasional lengkap atau perlu diurus? | health permits ≠ ordinary commercial |
| Lahan pengembangan | Luas total & rencana jumlah unit | developer scale, not end-user |
| Lahan wisata | Akses jalan & potensi wisata sekitar | view & access drive price |

```
Customer : Beli tanah kavling di Surabaya untuk bangun rumah, 200–400 m²
AI       : Kavling matang siap bangun, atau tidak masalah yang masih perlu pematangan/IMB?
Customer : Kavling matang. Cash, target 3 bln
AI       : Perlu pengecekan sertifikat (SHM) dan zonasi sebelum deal?
```

---

## Skip Rules by Building Type

| Question | Skip when type is… |
|---|---|
| Q2b (search history) | hotel, kondotel (booking — no prior search relevant) |
| Q4 (penghuni) | shophouse, office, warehouse, store (commercial) **+ hotel, kondotel booking** (capacity via Q14 room type) |
| Q10 (lease duration) | hotel, kondotel booking (duration = nights, in Q14) |
| Q11 (furnishing) | hotel, kondotel, villa (booking — always furnished), mansion, shophouse, office, warehouse, store |
| Q12 (tower/lantai) | everything except `apartment` |

## Bedroom Inference from Q4 (never ask directly)

| Q4 answer | Bedrooms |
|---|---|
| Sendiri / saya aja | 1 KT |
| Sama istri/suami / berdua | 1–2 KT |
| Keluarga kecil / 1 anak | 2–3 KT |
| 4 orang | 3–4 KT |
| Keluarga besar / 2–3 anak / orangtua | 3+ KT |

Then: "Oke, berarti sekitar 2–3 kamar ya 😊" → next ❓.

---

## SEWA vs BELI — What Replaces What

| Aspect | SEWA | BELI |
|---|---|---|
| Duration slot | Q10 durasi + Q10a payment terms (≥1 yr) | **Q_KPR** financing + **Q_KPR-a** readiness |
| Q8 date means | Masuk / check-in / mulai operasional | **Target tanggal deal/beli** |
| Condition | Q11 furnishing | **Q_COND** baru/second/inden (residensial) + furnishing |
| Red-flag focus | Kenyamanan & kecocokan | Legalitas, struktur, sertifikat |
| Investment | — | Target market, ROI, tenant status |

**BELI sequence after Q8 target date:**
```
Q_KPR    (MANDATORY)      "Untuk pembiayaan, rencananya *cash* atau *KPR*?"
                          (komersial for hotel/ruko/kantor/gudang/toko/kondotel;
                           KPT for 'others'/tanah)
Q_KPR-a  (if KPR/kombinasi) "Bank mana yang dituju, dan DP berapa persen?"
Q_COND   (residensial)    "Prefer yang *baru/ready*, *second* kondisi baik, atau *inden*?"
Q4       (investasi)      → replace "tinggal bersama siapa" with
                            "Targetnya disewakan ke siapa — karyawan, mahasiswa, atau expat?"
→ Q14 per-type → summary (Template B or D)
```

**Detection aliases:** BELI = `beli | purchase | KPR | cicil | investasi | akuisisi` ·
financing `cash` → strong buyer, `KPR`/`kredit`/`cicil` → fires Q_KPR-a, `kombinasi`/`50% cash`
→ kombinasi · condition `baru`/`ready`/`primary` · `second`/`bekas` · `inden`/`pre-order`.

### Per-type BELI emphasis (the slot that makes each combination unique)

| Tipe (BELI) | Key slot | Example |
|---|---|---|
| Rumah | kondisi + furnishing | via Q_COND, then "Furnished, semi, atau kosongan?" |
| Apartemen | primary/secondary + SHMSRS | "Prefer unit *primary* dari developer atau *secondary*?" |
| Hotel | operasional vs lahan, rooms, management | "Hotel *operasional* atau *bangunan/lahan* untuk dikembangkan?" |
| Villa | land tenure | "Status kepemilikan — *freehold (SHM)* atau *leasehold* oke?" |
| Kos | operasional vs lahan, pengelola | "Pengelola sekarang dilanjutkan atau Anda kelola sendiri?" |
| Ruko | lantai, hook, **tenant status** | "Prefer ruko *kosong* atau yang sudah ada *tenant*?" |
| Toko | mal-prime vs trade center | "Prefer unit *mal prime* (stabil) atau *trade center* (yield tinggi)?" |
| Kantor | grade, fit-out, **SHMSRS/strata** | "Status sertifikat unit — *SHMSRS/strata title*?" |
| Gudang | m², plafon, dock, **zonasi** | "Perlu pengecekan legalitas *zona industri* sebelum deal?" |
| Mansion | staff, multi-generasi, off-market | "Untuk multi-generasi, perlu lift internal atau kamar utama lantai dasar?" |
| Kondotel | **ROI mandatory**, operator, SHMSRS | "Target *ROI* per tahun? Ini jadi filter utama." |
| Others | purpose, matang/mentah, **izin/zonasi** | "Perlu pengecekan *sertifikat (SHM) dan zonasi* sebelum deal?" |

---

## Summary Templates

Only include lines whose slots are ✅. Copy values verbatim. Full field rules → doc 04
§Summary Brief. End with the dynamic signature (agent name / app name — SKILL.md §1).

**A — Sewa Hunian** (rumah, apartemen, villa bulanan, kos, mansion)
```
✓ Rencana: *Sewa [Tipe]* · ✓ Lokasi · ✓ Budget · ✓ Masuk · ✓ Penghuni
✓ Durasi · ✓ Furnitur · ✓ Fasilitas · ✓ Patokan · ✓ Area alternatif · ✓ Hindari / ✓ Prefer
```

**B — Beli Properti** (rumah, apartemen, tanah, ruko, gudang)
```
✓ Rencana: *Beli [Tipe]* · ✓ Lokasi · ✓ Budget · ✓ Target · ✓ Pembayaran (Cash/KPR)
✓ Kondisi · ✓ Patokan · ✓ Area alternatif
```

**C — Booking** (hotel, villa nightly, kondotel) — **no furnishing line**
```
✓ Rencana: *Booking [Tipe]* · ✓ Lokasi · ✓ Check-in · ✓ Check-out (*[N] malam*)
✓ Tamu · ✓ Budget/malam · ✓ Tipe kamar/unit · ✓ Fasilitas · ✓ Breakfast
```

**D — Beli Kondotel (Investasi)**
```
✓ Rencana: *Beli Kondotel (Investasi)* · ✓ Lokasi · ✓ Budget · ✓ Tipe unit
✓ Target ROI · ✓ Operator hotel · ✓ Pembayaran · ✓ Target beli
```

---

## Related Docs

- `04-qualification-flow.md` — Q sequence, Q3 tiers, state block, summary rules
- `06-customer-conditions-and-diagnosis.md` — tone, C1–C9, type disambiguation
- `11-house-pilots.md` — the house-specific pilot flows

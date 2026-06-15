# 09 — Property-Type Playbooks (12 Types × Sewa/Beli)

Distilled from the 12 source skill files (House, Apartment, Hotel, Villa, Boarding House,
Shophouse, Office, Warehouse, Store, Mansion, Kondotel, Other). Each type lists its **frame**,
the **slot order** for sewa & beli, **skip** rules, a **budget anchor**, and one condensed
dialog that shows the type's *distinctive* questions. Shared mechanics (budget two-option,
date normalization, summary brief, C1–C7 conditions) live in `SKILL.md` and doc 10 — not
repeated here.

**Legend:** `Loc`=location, `Bud`=budget two-option anchor, `Date`=move-in/check-in/target,
`Occ`=occupants, `Alt`=alternative area, `Dec`=decision-maker, `Dur`=lease duration,
`Pay`=payment terms (≥1yr), `Furn`=furnishing, `Fin`=financing (KPR/cash).

---

## 1. HOUSE / RUMAH — frame: LEASE (sewa) · SALE (beli)

- **Sewa:** Loc → (facilities) → Bud → Occ → Alt → Date → Dec → Dur → Pay → Furn
- **Beli:** Loc → (spec) → Bud → Occ/use → Alt → Target → Dec → Fin → ready/second → hook/sudut
- **Anchor:** sewa 2–15 jt/bln · beli 300 jt–5 M
- **Distinctive:** hook/corner preference (beli); payment terms on long lease.

```
Customer : Saya mau cari rumah untuk disewa
AI       : Rumah sewaan di kota/area mana yang Anda cari?
Customer : Surabaya, Darmo–Gubeng, garasi 2 mobil + cluster
AI       : Di Darmo–Gubeng ada rumah sewa 5–8 jt/bln dan ada yang 8–12 jt/bln. Mana yang lebih sesuai?
Customer : 8–12 jt. Saya, istri, 2 anak. Masuk Agustus, 1 tahun, semi-furnished
AI       : Untuk pembayaran 1 tahun, lebih cocok di muka penuh atau cicil per 6 bulan?
```

---

## 2. APARTMENT / APARTEMEN — frame: LEASE · SALE

- Same as house **plus** apartment slots: tower, floor (rendah/tengah/tinggi), view
  (city/pool/garden), unit size (studio/1KT/2KT). Beli also: status SHM/SHMSRS.
- **Anchor:** sewa 2.5–15 jt/bln · beli 250 jt–3 M
- **Distinctive:** floor & view always asked last; infer unit size from occupants.

```
Customer : Mau sewa apartemen dekat PTC Surabaya, gym + kolam, 4–7 jt, sendiri, masuk bulan depan, 1 tahun, full furnished
AI       : Ada preferensi lantai — rendah, tengah, atau tinggi? Dan view tertentu?
Customer : Lantai tinggi, city view
```

---

## 3. HOTEL — frame: BOOKING (sewa) · SALE/acquisition (beli)

- **Booking:** Loc → purpose (bisnis/wisata/medis/acara) → Bud(/malam) → check-in → nights
  → guests → room type (standard/deluxe/suite/family) → breakfast → facilities
- **Beli (aset):** Loc → operational-vs-land → rooms count → Bud(total) → Fin (cash/KPR
  komersial) → mgmt model (self/franchise/contract) → ROI → star/concept
- **Skip (booking):** furnishing, occupants-as-bedrooms, lease duration.
- **Anchor:** booking 350 rb–4 jt/mlm · beli 3–80 M

```
Customer : Booking hotel di Surabaya untuk acara keluarga, dekat PTC
AI       : Budgetnya sekitar 800 rb/malam atau lebih ke 1,5 jt/malam?
Customer : 800rb–1,5jt. Check-in 15 Juli, 3 malam, 4 orang
AI       : Tipe kamarnya family room atau connecting untuk 4 orang? Dan breakfast diinclude?
```

---

## 4. VILLA — frame: BOOKING (nightly/weekly) or LEASE (monthly) · SALE

- **Booking:** Loc → Bud(/malam atau /minggu) → check-in → nights → guests → private pool →
  chef/staff extras. **Monthly lease:** Loc → Bud(/bln) → Dur → pool → Date.
- **Beli:** Loc → use (invest/huni) → Bud → pool → Fin → freehold(SHM)/leasehold → ready/second
- **Skip:** furnishing for nightly (always furnished).
- **Anchor:** sewa 1.5–8 jt/mlm or 15–25 jt/bln · beli 3–40 M
- **Distinctive:** private pool & period (malam/minggu/bulan); freehold vs leasehold (beli).

```
Customer : Sewa villa di Ubud, tenang + sawah view, private pool, 3 kamar
AI       : Periode sewanya per malam, per minggu, atau per bulan?
Customer : Per malam 2–4 jt, 20 Juli 5 malam, 6 orang
AI       : Perlu sarapan diinclude untuk 6 orang?
```

---

## 5. BOARDING HOUSE / KOS — frame: LEASE · SALE (aset)

- **Sewa:** Loc (dekat kampus/kantor) → kos type (putra/putri/campur) → facilities (AC/WiFi/
  KM dalam) → Bud(/bln) → room size → Date → meals? → listrik include?
- **Beli:** Loc (dekat kampus) → rooms count (min) → operational-vs-land → Bud → Fin → ROI →
  kos type
- **Anchor:** sewa 0.8–3 jt/bln · beli 500 jt–3 M
- **Distinctive:** kos type & KM dalam/luar & meals; near-campus anchor; occupancy/ROI (beli).

```
Customer : Cari kos dekat ITS Sukolilo, mahasiswi baru
AI       : Kos putri ya. Fasilitas yang wajib ada — AC, KM dalam, WiFi?
Customer : AC, KM dalam, WiFi. 1,2–2 jt. Masuk Agustus
AI       : Mau yang sudah include listrik atau ada meteran sendiri?
```

---

## 6. SHOPHOUSE / RUKO — frame: LEASE · SALE (commercial)

- **Sewa:** business type → Loc → floors → Bud(/bln) → frontage(m) → parking → start date →
  Dur → hook/corner
- **Beli:** use (usaha/invest) → Loc → floors → Bud → Fin → frontage → hook → target
- **Skip:** occupants/bedrooms, furnishing.
- **Anchor:** sewa 6–35 jt/bln · beli 1.5–8 M
- **Distinctive:** business type drives location; frontage & hook & floors & parking.

```
Customer : Sewa ruko untuk cafe & resto kecil, Raya Darmo/Citraland
AI       : Berapa lantai yang dibutuhkan — bawah cafe, atas dapur/gudang?
Customer : 2 lantai, frontage min 5m, parkir 5–10 mobil, 15–25 jt, 3 tahun, mulai 3 bln lagi
AI       : Perlu posisi hook/sudut, atau menghadap satu jalan saja cukup?
```

---

## 7. OFFICE / KANTOR — frame: LEASE · SALE (unit/strata)

- **Sewa:** Loc → headcount (→infer m², ~5–7 m²/orang) → facilities (lift/AC/parkir) →
  grade A/B/C → Bud(all-in: sewa+service charge) → fit-out vs shell → IT/server room →
  parking slots → Date → Dur
- **Beli:** use/invest → Loc → m²/headcount → grade → Bud → Fin → fit-out → target; verify
  SHMSRS/strata title.
- **Skip:** bedrooms, furnishing.
- **Anchor:** sewa 10–80 jt/bln · beli 2–10 M
- **Distinctive:** headcount→area, grade, fit-out vs shell, **service charge** transparency, server room.

```
Customer : Sewa kantor di Surabaya Pusat, tim 30 orang
AI       : ~150–200 m² ya. Preferensi grade gedung — A, B, atau C?
Customer : B. Budget 30–50 jt all-in. Fit-out. Butuh server room kecil
AI       : Berapa slot parkir yang dibutuhkan?
```

---

## 8. WAREHOUSE / GUDANG — frame: LEASE · SALE (commercial)

- **Sewa:** purpose (produksi/distribusi/simpan) → Loc (dekat tol/industri/pelabuhan) →
  area m² → ceiling height (m) → loading dock count → Bud(/bln) → office-room? → power (KVA)
  → Date → Dur
- **Beli:** use → Loc → m² → Bud → Fin → ceiling/dock → target
- **Skip:** bedrooms, furnishing.
- **Anchor:** sewa 10–80 jt/bln · beli 5–25 M
- **Distinctive:** ceiling height, loading dock, KVA, industrial zoning, cold-storage variant.

```
Customer : Sewa gudang distribusi FMCG, dekat tol, 1.000–1.500 m²
AI       : Tinggi plafon minimal berapa meter?
Customer : Min 8m, 2 loading dock, kantor 5 orang, 100–200 KVA, 30–50 jt, 3 tahun
AI       : Mulai operasionalnya rencananya bulan apa?
```

---

## 9. STORE / TOKO — frame: LEASE · SALE (retail unit)

- **Sewa:** business type → Loc → mall vs standalone → area m² → Bud(/bln) → frontage →
  foot traffic / parking → Date → Dur
- **Beli:** use/invest → Loc → mall vs standalone → Bud → Fin → area → target
- **Skip:** bedrooms, furnishing.
- **Anchor:** sewa 5–30 jt/bln · beli 1.5–3 M
- **Distinctive:** toko = retail unit (mall/strip) ≠ ruko (standalone multi-floor); mall vs
  standalone; deposit (mall 3–6 bln); PPJB/AJB on unit purchase.

```
Customer : Sewa toko baju anak di Surabaya Barat, target ibu-ibu
AI       : Lebih prefer unit di dalam mal/plaza atau ruko standalone?
Customer : Dalam mal. 30–50 m², 8–15 jt, frontage 4m, mulai 2 bln, 2 tahun
AI       : Parkir mal sudah cukup atau perlu area parkir khusus?
```

---

## 10. MANSION / RUMAH MEWAH — frame: LEASE · SALE (luxury)

- Budget tier is high: **sewa >5 jt/bln, beli >3 M.** Slots: bedrooms, private pool, smart
  home, security level, staff quarters, garage capacity, furnishing; beli adds land/building
  m², financing.
- **Anchor:** sewa 30–100 jt/bln · beli 8–50 M
- **Distinctive:** staff quarters, smart home, garage capacity, off-market discretion; expat
  needs (international school, full-service) on sewa.

```
Customer : Sewa rumah mewah di Citraland/Pakuwon, private pool, 5 kamar, smart home
AI       : Untuk garasi, kapasitas berapa mobil yang dibutuhkan?
Customer : Garasi 4 mobil, 30–60 jt/bln, 6 orang + 2 ART, masuk 3 bln, 2 tahun, full furnished
AI       : Perlu kamar khusus untuk ART (staff quarter), berapa kamar?
```

---

## 11. KONDOTEL — frame: BOOKING (sewa) · SALE/investment (beli)

- **Booking:** Loc → check-in → nights → guests → Bud(/malam) → unit type (studio/1KT/suite)
  → facilities (pool/spa/gym) → view → breakfast
- **Beli (invest):** Loc → use (invest/pakai) → Bud → unit type → Fin → operator hotel → ROI
  → strata title (SHMSRS) → management fee
- **Skip:** furnishing, occupants-as-bedrooms.
- **Anchor:** booking 0.8–4 jt/mlm · beli 500 jt–2 M
- **Distinctive:** kondotel = apartment unit under hotel management; operator, ROI, revenue
  share/management fee, strata title (beli). Educate vs plain apartment/hotel when confused.

```
Customer : Beli unit kondotel di Bali untuk investasi, ROI bagus
AI       : Tipe unit yang paling dicari penyewa — studio atau 1 kamar?
Customer : Studio. 800 jt–1,5 M, cash, target 3 bln
AI       : Ada preferensi operator hotel tertentu, atau yang penting track record-nya terpercaya?
```

---

## 12. OTHER / PROPERTI LAINNYA — frame: LEASE · SALE

Covers tanah/kavling, SPBU, pabrik, sekolah, klinik, lapangan, lahan pertanian/perkebunan, etc.

- **Sewa:** purpose → Loc → area (m²/ha) → Bud(/bln or /tahun) → zoning/izin → Date → Dur
- **Beli:** purpose → Loc → area → Bud → Fin → zoning/legalitas (SHM/SHGB/HGB) → target
- **Skip:** bedrooms, furnishing.
- **Anchor:** quote per-m²/area for the area; SPBU 2–15 M, lahan industri area-based.
- **Distinctive:** purpose drives everything; zoning & legality verification is central;
  agricultural uses per-tahun pricing & irrigation.

```
Customer : Beli tanah kavling di Surabaya untuk bangun rumah, 200–400 m²
AI       : Kavling matang siap bangun, atau tidak masalah yang masih perlu pematangan/IMB?
Customer : Kavling matang siap bangun. 1–2,5 M, cash, target 3 bln
AI       : Saya carikan kavling matang 200–400 m² siap bangun, 1–2,5 M, cash, target 3 bulan!
```

---

## Cross-Type Summary Frames

- **LEASE summary:** Rencana(Sewa) · Tipe · Lokasi · Budget · Masuk · Penghuni/Keputusan ·
  Durasi · Furnitur · type-slots (frontage/grade/plafon/pool…).
- **SALE summary:** Rencana(Beli) · Tipe · Lokasi · Budget · Target · Financing · Use ·
  type-slots (hook/ROI/strata/operator…).
- **BOOKING summary:** Rencana(Booking) · Tipe · Lokasi · Check-in · Durasi(malam) · Tipe
  kamar/unit · Tamu · Breakfast · Fasilitas. **No furnishing line.**

Only include lines whose slots are ✅ in the state block. Copy values verbatim. End with the
dynamic signature. See `SKILL.md §11`.

# 17. Recent Updates & Reconstruction Checklist (Juli 2026)

> Dokumen ini mengonsolidasikan SEMUA perubahan besar dari sesi pengembangan
> Juli 2026 dalam satu tempat, dan berfungsi sebagai **checklist rekonstruksi**
> — bila skill ini dipanggil untuk membangun ulang atau mengembangkan sistem
> yang SAMA dengan kondisi project saat ini, pastikan SEMUA poin di bawah
> tercakup (module, API, environment, database, framework, component,
> security, code). Detail teknis penuh tetap ada di masing-masing doc
> bernomor (01–16) — dokumen ini adalah indeks + ringkasan yang bisa dibaca
> berdiri sendiri.

---

## 1. Master Data — 6 Modul CRUD (bukan cuma Facility)

Selain Facility (sudah ada sejak awal), sistem sekarang punya CRUD penuh untuk:

| Modul | Model | Table | Route base | Scope unik |
|---|---|---|---|---|
| Country | `Country.js` | `countries` | `/api/country` | Global (tanpa scope) |
| Province | `Province.js` | `provinces` | `/api/province` | Unik per `country_id` |
| City | `City.js` | `City.js` | `/api/city` | Unik per `province_id` |
| Location | `Location.js` | `locations` | `/api/location` | Global (landmark/patokan Q6) |
| Facility | `Facility.js` | `facilities` | `/api/facility` | Global + sinonim (`FACILITY_SYNONYM_GROUPS`) |
| Property | `Property.js` + `PropertyImage`/`PropertyFacility`/`PropertyLocation` | `properties` + 3 pivot | `/api/property` | Punya sub-resource `/api/property/:id/locations` |

Semua 6 modul: pola CRUD identik (`list/detail/insert/update/toggle-status/
delete`, semua `verifyToken`), soft-delete (`status`: 1 aktif, 2 disabled, 3
deleted), ID generated (`GeneralController.generateRandomId`: prefix nama 2
huruf + random alphanumeric + count padded 3 digit), audit fields
(`created_date/by`, `updated_date/by`). Frontend: satu `{Module}ListView.vue`
+ satu `{Module}MasterView.vue` per modul, semua `requiresAuth: true`.

**Rekonstruksi:** untuk menambah modul CRUD baru, tiru pola Country/Province/
City persis (lihat doc 03 §skema + doc 05 §route + doc 07 §frontend). Jangan
tulis ulang helper duplikat/toggle/delete — extend `GeneralController` dan
pakai `findDuplicateName`/`lookupName` bila relevan (§2 di bawah).

---

## 2. GeneralController — Shared Helpers

`backend/controllers/GeneralController.js` adalah base class SEMUA master
controller. Dua helper kanonik (BARU) menggantikan method privat yang
sebelumnya diduplikasi 4×:

```javascript
class GeneralController {
  static generateRandomId(name, count, length = 5) { ... }   // sudah ada sejak awal
  static pageSize() { ... }                                    // baca PAGINATION_ROWS
  static todayDate() { ... }
  static normalizeName(name) { ... }
  static async resolveUserName(userId) { ... }

  // BARU — cek duplikat nama (case/spasi-insensitive), scope opsional
  static async findDuplicateName(model, name, { idField, scope = {}, excludeId = null }) { ... }

  // BARU — resolve nama record dari id-nya (join tampilan list/detail)
  static async lookupName(model, idField, id) { ... }
}
```

Contoh pemakaian di `provinceMasterController.js`:
```javascript
// Province unik PER-NEGARA, bukan global — scope: { country_id }
static #findDuplicate(name, idCountry, excludeId = null) {
  return GeneralController.findDuplicateName(Province, name, {
    idField: 'province_id', scope: { country_id: idCountry }, excludeId
  });
}
static #countryName(idCountry) {
  return GeneralController.lookupName(Country, 'country_id', idCountry);
}
```

**Facility TIDAK memakai `findDuplicateName`** — punya `#findRedundant` sendiri
dengan `FACILITY_SYNONYM_GROUPS` (grup sinonim semantik: gym/gym club,
cctv/kamera pengawas, kolam renang/swimming pool, dll.), sengaja tidak
digabung karena logikanya beda level (bukan sekadar normalisasi string).

**Rekonstruksi:** controller CRUD baru harus `extends GeneralController` dan
memanggil `findDuplicateName`/`lookupName` alih-alih menulis ulang query
duplikat/join — ini adalah konvensi WAJIB proyek ini.

---

## 3. ConfirmModal.vue — Komponen Konfirmasi Reusable

`frontend/src/components/ConfirmModal.vue` menggantikan markup
`modal-overlay`/`modal-box`/dst. yang tadinya diduplikasi identik di 12 view
(6 modul × List+Master). Props: `show`, `icon`, `title`, `message` (fallback
bila slot kosong), `confirmText`, `cancelText`, `confirmClass` (default
`btn-confirm-danger`), `busy`. Dua pola pakai (statis via slot untuk Master
view, dinamis via props untuk List view yang berbagi satu modal untuk
toggle-status & delete) — detail lengkap + contoh kode di doc 07.

CSS class (`modal-overlay`, `btn-confirm-danger`, dst.) TETAP di
`elevan-components.css` (global) — HANYA markup Vue yang direfactor jadi
komponen, tampilan tidak berubah sama sekali.

**Rekonstruksi:** modul baru yang butuh dialog konfirmasi WAJIB pakai
`<ConfirmModal>`, jangan tulis ulang `modal-overlay` markup.

---

## 4. RESPOND_CATALOG_RUN — Parity Fix + Agent-Scoped Catalog

### Masalah sebelumnya

Q1–Q12 interview SELALU sama di kedua mode (`OFF`/`ON`) — ini sudah benar
sejak awal. Tapi **isi katalog** yang tampil setelah brief punya BUG parity:

- Bila **Private Agent** (fallback deterministik) yang menjawab → katalog
  benar dari `Property`+`PropertyFacility`(FK `Facility`)+`PropertyLocation`
  (FK `Location`) via `propertyRecommendationService.buildRecommendationContextForLLM()`.
- Bila **provider AI utama** (ChatGPT/Claude/QWEN/DeepSeek) yang menjawab →
  katalog HANYA dari Rumah123 + JSON statis — TIDAK PERNAH menyentuh database
  Property milik agent. Dua provider berbeda = dua katalog berbeda, padahal
  seharusnya identik ("fungsi yang sama").

### Fix

`backend/utils/whatsappPropertyContext.js` sekarang JUGA memanggil
`buildRecommendationContextForLLM()` (sumber yang sama dipakai Private Agent),
menggabungkannya dengan Rumah123 (bukan salah satu). JSON statis
(`indonesia_property_extended_v3.json`) sekarang benar-benar **last resort**
— hanya dipakai bila Rumah123 DAN katalog DB SAMA-SAMA kosong, DAN request
TIDAK di-scope per-agent (lihat §5).

`backend/services/whatsappAIService.js`: urutan `getConversationHistory()` dan
`getWhatsappPropertyContext()` DITUKAR (history diambil duluan) supaya filter
Q1-Q12 yang dipakai query katalog akurat lintas percakapan, bukan hanya dari
pesan terakhir.

### Kode kunci

```javascript
// whatsappPropertyContext.js — getWhatsappPropertyContext(message, history, agentUserId)
const sections = [];
// 1. Rumah123 (bila RUMAH123_DATA=ON)
if (rumah123Listings.length) sections.push(formatRumah123ContextForLLM(rumah123Listings));
// 2. Katalog DB sendiri — SELALU dicoba, independen dari Rumah123
const dbContext = await buildRecommendationContextForLLM(message, history, { userId: agentUserId });
if (dbContext.exactMatches.length || dbContext.alternatives.length) sections.push(dbContext.contextText);
// gabungkan; JSON hanya jika sections kosong DAN agentUserId kosong
```

---

## 5. Agent-Scoped Catalog (`Property.user_id`)

Model `Property` punya kolom `user_id` (komentar model: "Filter katalog per
user login (/property & konteks AI)") — TAPI sebelumnya kolom ini tidak
dipakai untuk filter sama sekali; katalog rekomendasi WhatsApp menampilkan
listing SEMUA agent tercampur.

### Fix — alur `userId` lengkap

```
Controller WhatsApp (agent.user_id)
  → generateWhatsAppAIReply({ ..., agentUserId: agent.user_id })
      → session.agentUserId = agentUserId  (persist untuk Private Agent fallback)
      → getWhatsappPropertyContext(message, history, agentUserId)
          → buildRecommendationContextForLLM(message, history, { userId: agentUserId })
              → searchProperties({ ...filters, userId })
              → getAlternatives({ ...filters, userId })      ← SEMUA jalur relaksasi ikut scope
              → findWithExpandedBudget(source, { ...filters, userId })
                  → filterProperties(source, { ...filters, userId })
                      → matchesUser = String(property.userId) === String(userId)
```

`userId` kosong/null = TIDAK di-scope (dipakai chatbot web publik — katalog
global, semua agent). Private Agent (`chatbotPrivateController.js` Mode B)
memakai `scopedUserId = agentUserId || session?.agentUserId` sebagai fallback.

**Field `userId` ada di setiap object property ternormalisasi**
(`getDbProperties()` di `propertyRecommendationService.js`), diambil langsung
dari `Property.user_id` (raw, tanpa transformasi).

---

## 6. Budget Expansion — Batas Harga Wajar (bukan lagi tanpa-limit)

Formula ekspansi budget bertahap saat exact match kosong (tipe & lokasi TETAP
dijaga, hanya harga yang dilonggarkan):

| Step | Formula | Contoh (budget asli 8–15 jt) |
|---|---|---|
| 1 | ±35% | 5.2 – 20.3 jt |
| 2 | ±70% | 2.4 – 25.5 jt |
| 3 | **min × 0.20 … max × 2.5** (BARU — dulu "tanpa limit") | 1.6 – 37.5 jt |

Konstanta: `REASONABLE_MIN_FACTOR = 0.20`, `REASONABLE_MAX_FACTOR = 2.5` di
`propertyRecommendationService.js`. Guard yang SAMA diterapkan ke
`getAlternatives()` (yang melonggarkan tipe/lokasi tanpa peduli harga sama
sekali) — hasil alternatif di-filter ulang dengan `budgetMatches()` memakai
rentang wajar ini sebelum ditampilkan ke customer.

**Kenapa:** ekspansi tanpa-limit bisa menampilkan properti absurd (mis. hotel
60 miliar untuk budget 800rb/malam) — menyesatkan, bukan membantu.

---

## 7. Fallback "Fasilitas Standar + Harga Wajar"

`backend/utils/standardFacilities.js` (BARU) — satu sumber kebenaran untuk
daftar fasilitas standar per tipe properti (hotel, villa, kos, rumah,
apartemen, kondominium, mansion, ruko, kantor, gudang, toko), dipakai OLEH DUA
tempat:

1. `chatbotPrivateController.js` — mengisi summary saat customer jawab
   "fasilitas standar/biasa/terserah" (Q_FAC).
2. `propertyRecommendationService.js` — fallback rekomendasi saat katalog
   agent BENAR-BENAR kosong (exact match & alternatif kosong, bahkan setelah
   ekspansi §6).

```javascript
function getStandardFacilitiesByType(buildingType, furnishing = '') {
  // house/apartment/villa/condo/boarding_house: furnishing full/semi menambah
  // perabot (Kitchen set, Lemari, TV, Kulkas, dst.)
  // hotel/kondotel/mansion/shophouse/office/warehouse/store: tidak bergantung furnishing
  return '...'; // string dipisah koma, atau null bila tipe tak dikenal
}
```

Saat trigger, `buildRecommendationContextForLLM()` membangun `standardFallback`:
```javascript
{
  buildingType,
  standardFacilities: 'Tempat Tidur, Kamar Mandi, AC, TV, WiFi, ...',
  reasonableRange: { min, max, period }   // dari budget customer × 0.20/2.5
}
```

Dirender di DUA tempat: (a) blok `NO CATALOG MATCH — STANDARD-FACILITIES
FALLBACK` di `contextText` LLM, (b) langsung oleh
`ResponseBuilder`/`ResponseBuilderWhatsApp.alternative()` untuk Private Agent.
Instruksi ke AI: jujur bilang tidak ada listing pas, sebutkan fasilitas
standar sebagai gambaran, kutip rentang harga wajar, tawarkan penyesuaian
kriteria. **Dilarang mengarang listing.**

---

## 8. Cookie Response Timer — Debounce Pesan Beruntun

`backend/utils/responseDebounce.js` (BARU). Env: `AI_COOKIE_RESPONSE_TIMER`
(default `20000` ms). Masalah: customer sering kirim beberapa pesan terpisah
dalam waktu singkat; tanpa jeda, AI membalas pesan pertama sebelum sempat
membaca lanjutannya.

```javascript
function debounceMessage(key, message, onFire) {
  // key unik per (platform+agent+customer), mis. `${source}::${normalizedPhone}`
  // - tambahkan message ke buffer key ini
  // - reset timer ke penuh (AI_COOKIE_RESPONSE_TIMER ms)
  // - setelah timer habis TANPA pesan baru → gabungkan buffer (join '\n') → onFire(combined)
}
```

Dipasang **identik** di ketiga controller WhatsApp. Pengecekan cepat per-pesan
(fromMe/grup/echo/dedup layer 1&2) tetap jalan SETIAP pesan masuk (agar retry
webhook/echo tidak ikut memperpanjang buffer customer) — HANYA pesan yang
lolos semua guard itu yang masuk ke `debounceMessage()`. Logika berat (gate
properti, simpan DB, panggil AI, kirim balasan) dipindah ke fungsi
`handleDebouncedBatch()` terpisah yang hanya jalan SEKALI per jendela waktu.

---

## 9. Sinkronisasi 3 Terminal WhatsApp (fromMe / grup / dedup DB)

Sebelumnya Kirimi (`kirimiChatController.js`) paling lengkap fiturnya; Fonnte
dan TimelinesAI tertinggal. Semua fitur berikut sekarang **identik** di ketiga
controller:

| Fitur | Sebelumnya | Sekarang |
|---|---|---|
| Dedup layer 1 (messageId in-memory) | Ketiganya punya | Tetap (tidak berubah) |
| Dedup layer 2 (DB ChatMessage.metadata, survive restart) | Hanya Kirimi | Ketiganya |
| fromMe guard (anti-loop balas sendiri) | Hanya Kirimi | Ketiganya |
| Filter pesan grup | Tidak ada di ketiganya sebelumnya (lihat catatan) | Ketiganya |
| Deteksi kegagalan kirim | Kirimi paling lengkap (banyak field + regex ID) | Ketiganya |
| Cookie response timer (§8) | Belum ada sama sekali | Ketiganya |

Yang TETAP legitimately berbeda (platform-specific, TIDAK disinkronkan):
bentuk payload webhook, format API kirim pesan, auth header, nama field
device/token per platform.

---

## 10. `users` Table — Kolom Baru

| Kolom | Tipe | Keterangan |
|---|---|---|
| `email` | VARCHAR(200), nullable | Alamat email agent — editable di `/profile`, opsional di Register |
| `catalog_summary` | VARCHAR(5), nullable | `ON`/`OFF` — kontrol katalog di summary agent ini; default model `null`, TAPI di-set otomatis `'OFF'` saat `registerController.js` `User.create()` |

Migrasi: `ensureRequiredDatabaseColumns()` di `server.js` (menambah kolom bila
belum ada, dijalankan tiap boot setelah `sequelize.sync()`).

Frontend: `RegisterView.vue` (+field Email, TANPA field catalog_summary — form
Register sengaja tidak menampilkannya), `ProfileView.vue` (+field Email +
select Catalog Summary Status ON/OFF).

---

## 11. Perbaikan Kecil Lain (Juli 2026)

- **`customerDateParser.js`**: tambah rule "N hari/minggu/bulan/tahun lagi" &
  "dalam N ..." — sebelumnya frasa relatif umum ini ("2 minggu lagi") TIDAK
  pernah ter-resolve jadi tanggal konkret sama sekali.
- **Q8 (move-in) vs Q14 check-in** (hotel/villa booking): tadinya dua field
  terpisah padahal sama — resolve Q8 sekarang otomatis mengisi Q14 juga
  (`profile.hasCheckInDate = true` bila `moveInDateValue` valid), mencegah
  pertanyaan duplikat.
- **`PropertyLocation` join** ditambahkan ke `getDbProperties()` — field
  `nearbyLocations` (nama landmark terdekat, gabung koma) sekarang tampil di
  baris "Lokasi Terdekat"/"Nearby Landmarks" pada setiap listing katalog
  (sebelumnya hanya facility yang ditampilkan, padahal join Location sudah
  ada di model tapi belum dipakai).
- **CSS extraction** (`elevan-property-list.css`): filter tipe bangunan di
  `PropertyListView.vue` dipindah dari `<style scoped>` ke file CSS global,
  dengan selector generik (`.btn-reset`, `.checkbox-item`) di-scope ulang
  sebagai descendant dari container unik fitur ini (`.filter-building-dropdown`)
  untuk menghindari collision dengan `.btn-reset` yang sudah ada di
  `elevan-rumah123.css` (style berbeda).

---

## 13. Update Sesi 20 Jul → 31 Jul 2026 (V5)

### 13.1 Modul Customer — end-to-end (lihat doc 03 & 07)
Tabel `customers` (UNIQUE `user_id`+`phone`) + model + `customerMasterController.js`
+ routes `/api/customer/*` + `customerApi.js` + frontend `Customer_Master/`
(7 modul master data sekarang, bukan 6). Registrasi OTOMATIS begitu Q1
(tipe transaksi) + Q2 (lokasi) terjawab — TIDAK menunggu summary, mencegah
lead yang putus di tengah percakapan hilang tak tercatat. `ai_response`
ON/OFF per-customer: toggle di frontend ATAU via chat agent
(`"matikan AI untuk 628xxx"` — **HANYA nomor WhatsApp**, nama ditolak karena
ambigu/rawan salah target). Gate fail-open di 3 controller WhatsApp.

### 13.2 SKILL DOCS DIROMBAK: 21 → 13 doc (claude_responds & chat_gpt_responds)
Dokumen AI-facing (bukan doc website_env_concept ini) dikonsolidasi dari
01–21 menjadi 01–13 — isi tumpang tindih digabung (mis. anchor recognition +
landmark reference → satu doc lokasi). `CONDITIONAL_FILE_TRIGGERS` di
`skillPromptService.js` dikunci ke nama file persis; hanya 3 dari 13 doc
bersyarat (house-pilots, facilities-reference, locations-and-landmarks) —
10 sisanya selalu aktif. **Nomor doc versi lama TIDAK BERLAKU LAGI.**

### 13.3 Temuan kritis: plafon TPM OpenAI (lihat detail penuh di doc 06)
Skill docs SAJA memakan 39–51K dari plafon 60K TPM gpt-4o-mini org — inilah
penyebab RIIL error 429 "Request too large", bukan panjang history. Solusi
definitif: naikkan limit TPM via billing OpenAI (sisi user, bukan kode).
Mitigasi kode: truncate history ke 12 pesan sebelum kirim ke ChatGPT
(`openaiService.js`) — defense-in-depth, bukan akar masalah.

### 13.4 Google Places — akhirnya wired ke jalur LLM (lihat detail di doc 06)
`googlePlacesService.js` (sudah ada sebelumnya) hanya menjangkau Private
Agent (fallback); jalur LLM produksi tidak pernah menerima landmark live.
Fix: `buildLiveLandmarkBlock()` di `aiPromptBuilderService.js`, sync-cache +
async-warm, 0 token tambahan saat kosong. ⚠️ Saat ini DORMAN — Google Places
API menolak dengan `REQUEST_DENIED` karena billing project Google Cloud
belum di-enable (key sendiri sehat).

### 13.5 Google Calendar viewing auto-schedule (BARU)
`services/viewingScheduleTrigger.js` (baru) + `googleCalendarService.js`
(OAuth 2.0, BUKAN Service Account) — begitu AI menangkap tanggal+jam viewing
KONKRET, event kalender dibuat otomatis. Cek `customers.email` dulu (pakai
langsung bila ada); kosong → Q_EMAIL yang sudah ada yang bertanya (opsional,
opt-out "lewati"), modul ini tidak memaksa. Agent (`users.email`) selalu jadi
attendee. ⚠️ `GOOGLE_OAUTH_REFRESH_TOKEN` masih kosong di `.env` — satu
langkah manual tersisa sebelum live.

### 13.6 Bug loop re-ask "area alternatif" (Q7) — pelajaran diagnosis penting
Customer menolak berkali-kali ("Tidak ada, Kak") tetap ditanya ulang dengan
kalimat parafrase berbeda, sampai customer marah. **Root cause awalnya SALAH
DIDIAGNOSIS** karena diuji terhadap `chatbotPrivateController.js` (Private
Agent/fallback), padahal `AI_PRIMARY_PROVIDER` sudah berganti dari `deepseek`
ke `chatgpt` — jalur produksi AKTUAL adalah `aiPromptBuilderService.js` (LLM),
kode base yang MIRIP tapi terpisah dari Private Agent. Regex deteksi
"sudah ditanya" terpatok kalimat persis; LLM memparafrase tiap giliran →
loop swa-lestari. Fix: deteksi berbasis makna, aturan keras "penolakan =
jawaban" di prompt, `normalizeAltAreaAnswer()` (penolakan → pernyataan
positif, bukan disimpan mentah yang terbaca seperti slot kosong), katalog
langsung diberi saat customer marah. **Pelajaran untuk developer manapun:**
SELALU `grep AI_PRIMARY_PROVIDER .env` + cek log runtime sebelum mereproduksi
bug perilaku AI — jalur produksi mungkin bukan yang diasumsikan.

### 13.7 Rewrite besar: tanggal, fasilitas, normalizer SMS-speak
- `customerDateParser.js` ditulis ulang total: clamping bulan/tahun benar,
  leap year lengkap, `reject_past` untuk tahun eksplisit lampau,
  `hasCurrencySignal` guard cegah tabrakan dgn harga per-periode.
- `standardFacilities.js` ditulis ulang: 11 tipe properti + tier premium
  (28 item, flag-only di summary — item dipilih penilaian LLM, bukan
  keyword-match, untuk hindari daftar bengkak tidak relevan).
- `lazyChatNormalizer.js` (baru): ekspansi ~100 singkatan SMS-speak
  Indonesia, token-based (bukan substring), di-wire di SATU choke point
  (`whatsappAIService.js`), hanya memengaruhi giliran ini (riwayat tersimpan
  asli di DB).

### 13.8 Listing-Referral Pilot (lanjutan dari sesi sebelumnya)
1 false-positive session-reset tambahan ditemukan & diperbaiki:
"pindah dari apartemen" salah dibaca sebagai ganti tipe/transaksi.

### 13.9 AI_PRIMARY_PROVIDER berganti: deepseek → chatgpt
`.env` produksi sekarang `AI_PRIMARY_PROVIDER=chatgpt`,
`CHAT_GPT_MODEL=gpt-4o-mini`. Lihat §13.3 untuk implikasi TPM.

---

## 15. Update Sesi 3 Agustus 2026 — Provider Kimi + Audit Koneksi API

### 15.1 Provider ke-5 ditambahkan: Kimi (Moonshot AI)
`services/kimiService.js` (baru), OpenAI-compatible endpoint
(`https://api.moonshot.ai/v1`). `AI_PRIMARY_PROVIDER` sekarang menerima
`kimi` di semua tempat yang relevan (`aiProviderService.js` PROVIDER_ORDER +
`getPrimaryAIProvider`, `skillPromptService.js` mapping ke skill set
`chat_gpt_responds`). Model default `kimi-k3`; `.env` produksi memakai
`kimi-k2.6` (juga terbukti jalan). ⚠️ `kimi-k3` **hanya** menerima
`top_p=0.95` — nilai lain ditolak API dengan pesan eksplisit.
`AI_PRIMARY_PROVIDER` produksi sekarang **`kimi`** (berganti dari `chatgpt`).

### 15.2 Env var ChatGPT di-rename: `OPENAI_*` → `CHAT_GPT_*`
`OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_STORE_RESPONSE`/
`OPENAI_MAX_OUTPUT_TOKENS` → `CHAT_GPT_API_KEY`/`CHAT_GPT_MODEL`/
`CHAT_GPT_STORE_RESPONSE`/`CHAT_GPT_MAX_OUTPUT_TOKENS`. Diverifikasi 3 Agu
2026: `openaiService.js` sudah 100% konsisten dengan nama baru, nol sisa
referensi `OPENAI_*` di seluruh backend.

### 15.3 Audit koneksi API langsung ke live endpoint
Dipanggil langsung (bukan asumsi dari dokumentasi) — hasil lengkap di doc 06
§"Audit Koneksi API". Ringkas: Kimi/DeepSeek/Qwen sehat. ChatGPT sempat rusak
(`CHAT_GPT_MODEL=gpt-oss-20b` → HTTP 400 model tidak ada) — **diperbaiki** ke
`gpt-4o-mini`. Claude **masih rusak**: HTTP 401 API key invalid — perlu
diganti manual oleh owner, bukan bug kode. Dampak produksi NOL karena
primary=`kimi` sehat dan `PROVIDER_ORDER` per-primary tidak menyentuh provider
lain (lihat doc 06).

### 15.4 Kebijakan billing eksplisit: larangan auto-recharge
Ditambahkan sebagai komentar wajib di `.env` (tepat sebelum
`CHAT_GPT_API_KEY`) dan di doc 06: untuk kelima provider, dilarang keras
auto-recharge/auto-topup kredit lewat jalur apa pun. Kuota habis → biarkan
error → fallback chain → Private Agent. Isi ulang hanya manual oleh owner.

### 15.5 Koreksi catatan DeepSeek yang tidak akurat
`.env` sebelumnya mencatat `deepseek-v4-flash` "tidak tersedia di API resmi".
Dites langsung: **v4-flash tetap berhasil**, sama seperti `deepseek-chat` yang
kini aktif. Catatan diperbaiki di `.env`, bukan klaim yang bisa dipercaya
tanpa verifikasi ulang di masa depan.

---

## 16. Reconstruction Checklist — Ringkas

Bila membangun ulang sistem ini dari nol, pastikan urutan berikut tercakup:

- [ ] Backend Express + Sequelize v6 + MySQL, struktur folder per doc 01
- [ ] 17 model (lihat doc 03), termasuk `Customer` (BARU), `users.email`/
      `catalog_summary`, `facilities.keywords` (JSON), dan `PropertyLocation`
      join enrichment (`nearbyLocations`/`userId`/`priceValue`/`priceType`/`area`)
- [ ] `GeneralController` base class dengan `generateRandomId`,
      `findDuplicateName`, `lookupName` — SEMUA master controller extends ini
- [ ] 7 modul CRUD master data (Country/Province/City/Location/Facility/
      Property/**Customer**), pola route seragam, semua `verifyToken`
- [ ] JWT auth + silent refresh (401→refresh→retry, single-flight)
- [ ] 3 controller WhatsApp (Fonnte/Kirimi/TimelinesAI) — SINKRON: fromMe
      guard, filter grup, dedup 2-layer (in-memory+DB), cookie response timer,
      registrasi customer otomatis (Q1+Q2), gate `ai_response=OFF`
- [ ] 6 AI provider (ChatGPT/Claude/QWEN/DeepSeek/Kimi/Private), satu PRIMARY
      (**cek `.env` aktual** — jangan asumsikan) → Private Agent, nama model
      dari `.env` (tidak boleh hardcode)
- [ ] Q1–Q14 qualification flow — IDENTIK di kedua mode `RESPOND_CATALOG_RUN`,
      termasuk penolakan customer dihitung sebagai jawaban (anti-loop)
- [ ] Katalog per-agent (Property.user_id scoping) + budget expansion batas
      wajar + fallback fasilitas standar (11 tipe + tier premium)
- [ ] Landmark: peta kurasi 45 kota + Google Places live (opsional, perlu
      billing Google Cloud project di-enable) + Google Calendar viewing
      auto-schedule (opsional, perlu OAuth refresh token)
- [ ] Frontend Vue 3: 7 modul CRUD (List+Master view pair, `*_Master/`),
      `ConfirmModal.vue` reusable, `FloatingChatbot.vue`, router guards
      (`requiresAuth`/`requiresGuest`)
- [ ] Secret redaction hook di `ChatMessage` model (`beforeSave`/`beforeBulkCreate`)
- [ ] ngrok auto-start (opsional, `ENABLE_NGROK`)
- [ ] Skill docs sync: `claude_responds/docs/*.md` ≡ `chat_gpt_responds/docs/*.md`
      (byte-identical kecuali `SKILL.md`, 13 file per sisi)
- [ ] Disiplin token TPM: ukur dampak setiap penambahan ke prompt LLM
      terhadap plafon provider sebelum ship

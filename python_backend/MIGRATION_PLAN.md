# Rencana Migrasi Node.js → Python/FastAPI

Status per **15 Agustus 2026**. Dokumen ini menyatakan dengan jujur apa yang
sudah jalan dan apa yang belum, supaya tidak ada yang mengira migrasi lebih
maju daripada kenyataannya.

## Skala yang dihadapi

| | Jumlah |
|---|---|
| Baris kode Node.js | **42.863** |
| Controller / service / util | 25 / 29 / 29 |
| Berkas tes | 53 (**1.453 assertion**) |
| Perbaikan bernomor | **M1–M95** |

Berkas terbesar — dan tersulit diport — adalah yang memuat paling banyak
sejarah perbaikan:

| Berkas | Baris | Rujukan M |
|---|---|---|
| `chatbotPrivateController.js` | 5.055 | 7 |
| `aiPromptBuilderService.js` | 3.237 | **33** |
| `propertyRecommendationService.js` | 2.478 | 8 |
| `propertyKeywordFilter.js` | 1.255 | 7 |

## Prinsip: paritas dibuktikan, bukan diasumsikan

Perbaikan seperti M87 (kata `booking` di gerbang) adalah **satu entri** di dalam
daftar 115 kata. Membandingkan dua implementasi dengan mata tidak akan
menangkap satu entri yang tertinggal — menjalankan keduanya atas input yang
sama, menangkap.

Karena itu setiap modul yang diport WAJIB punya fixture di
`tests/parity/run_parity.py`. Harness sudah dibuktikan menangkap regresi:
menghapus kata `booking` dari konstanta Python langsung memunculkan **5
perbedaan** dengan nama kasusnya.

## Cara konstanta diport

**Tidak disalin dengan tangan.** `tools/export_gate_constants.js` mengekspor
konstanta langsung dari modul Node.js ke JSON, dan Python memuat JSON itu.
Port Python menjadi turunan yang terbukti identik, bukan tiruan yang mirip.
Jalankan ulang eksporter setiap kali sisi Node.js berubah.

---

## Sudah selesai ✅

- Scaffold FastAPI + lifespan, jalan di port **5056** (Node.js tetap 5055)
- `config.py` membaca **`backend/.env` yang sama** — satu sumber konfigurasi
- `db.py` — SQLAlchemy 2.0 async ke **`db_property` yang sama**, terverifikasi
  terhubung. Python **tidak** menjalankan DDL: Node.js tetap pemilik skema
- Gerbang masuk (`has_property_keyword`) diport, **39/39 fixture identik**
- Harness paritas + bukti non-vacuous
- `/health` dan `/internal/gate-check` (endbantu migrasi, bukan produksi)
- **Model & CRUD master data** (Country/Province/City/Location/Facility) —
  5 modul × 6 endpoint via `MasterSpec` generik, diverifikasi 14/14 lifecycle
  end-to-end (insert→duplikat-409→update→toggle→soft-delete→404). Menemukan
  & memperbaiki bug integritas data nyata (`locations.id=0` collision, lihat
  catatan di `app/models/master.py`) — bukan bug port, bug data lama yang
  baru terlihat karena SQLAlchemy membaca tabelnya dengan cara berbeda.
- **Provider AI — Hugging Face Router** (1 dari 6, M95) — port 1:1 dari
  `huggingfaceService.js`, dibuktikan setara lewat panggilan langsung
  (403/fallback_eligible/config_error identik). `/internal/huggingface-*`
  endpoint bantu migrasi. Lihat V8 §5 M95 untuk detail penuh.
- **Webhook Kirimi — langkah 1/2 dari 2: terima + simpan** (M98) —
  `POST /api/kirimi/webhook` mem-parsing payload (paritas 11/11 terhadap
  `extractMessage`/`detectEventType` Node.js ASLI, bukan reimplementasi),
  dedup, cari agent by `kirimi_device_id`, simpan `ChatMessage` role=customer.
  ⚠️ **BELUM memanggil AI, BELUM membalas customer** — itu sengaja ditunda
  ke langkah AI qualification flow di bawah. Endpoint ini BUKAN yang
  terdaftar di dashboard Kirimi produksi (Node.js tetap satu-satunya —
  lihat V8 §5 M97 soal akun ngrok yang cuma punya 1 domain). Baris ditandai
  `channel='kirimi_whatsapp_python'`, terpisah dari data produksi.
- **`propertyKeywordFilter` SISANYA — `isPropertyContextContinuation`** (M99)
  — fungsi terpanjang & paling kritis di gerbang (~440 baris, puluhan cabang
  regex, M51/M88 tertanam di dalamnya), plus seluruh fungsi pendukungnya
  (`detectCustomerFrustration`, `isDailyLifeOffTopic`, `lastAiMessageAsksQuestion`,
  `extractLocationFromMessage`/`extractPropertyTypeFromMessage`/
  `extractTransactionTypeFromMessage`, `isPostSummaryDormant`,
  `initLocationCache` — DB cache kota, augment bukan replace, sama seperti
  Node.js). **52/52 fixture identik**, A/B non-vacuous (2 cabang diuji
  langsung: cabang frustrasi dan cabang daily-life-offtopic, keduanya
  terbukti mengubah hasil saat dinonaktifkan). `propertyKeywordFilter.js`
  kini diport PENUH — lihat V8 §5 M99.

- **Konfigurasi sendiri + logger terminal + RAG** (M100/M101):
  - `config.py` kini membaca **`python_backend/.env`**, TAPI sengaja
    MENGABAIKAN `PORT=5055` dan `NGROK_DOMAIN` di dalamnya (keduanya milik
    produksi Node.js). Dikunci `tests/test_config_isolation.py` (17/17) yang
    GAGAL bila seseorang menambah field itu di kemudian hari.
  - **Log terminal Kirimi & Fonnte** dengan format IDENTIK Node.js
    (`app/core/terminal_logger.py`), termasuk masking nomor/nama dan
    **redaksi rahasia** — paritas 35/35 terhadap `whatsappUtils.js` +
    `secretRedactor.js`.
  - **RAG hibrida** (`app/services/rag_service.py`): 9.167 listing + 125
    chunk referensi, skor `0.65×cosine + 0.35×BM25`, **isolasi antar-agent
    wajib** (21/21, dibuktikan non-vacuous: mematikan filter → 8 listing
    bocor antar-agent).
  - **Balasan AI manusiawi** (`ai_prompt_builder.py` + `whatsapp_ai_service.py`)
    — RAG memberi listing NYATA sebagai bahan, prompt melarang pola template
    yang membuat balasan terasa seperti formulir.
  - ⚠️ **Balasan DISUSUN, TIDAK DIKIRIM.** Node.js tetap satu-satunya yang
    membalas customer. Output dicetak ke terminal untuk dinilai berdampingan.

- **RAG korpus skill Real-Estate + LLM few-shot** (M102) — 26 berkas
  `Real-Estate/*.md` (14.600 baris, ratusan CONTOH percakapan per tipe
  properti × transaksi × kondisi customer) diindeks jadi namespace
  `skill_cases` (**641 chunk**, batas CASE dijaga utuh). Saat membalas,
  contoh yang paling mirip situasi customer disuntikkan sebagai few-shot —
  inilah perbaikan nyata untuk "LLM terasa kaku": model diberi CONTOH, bukan
  disuruh "jadi ramah". Ditambah `detect_customer_style()` (lazy/angry/
  unsure/asking_price, 10/10 pada fixture) yang memilih contoh sepadan dan
  menyisipkan panduan gaya khusus.
  Aturan anti-invention #12–#17 ditambahkan ke prompt, diturunkan LANGSUNG
  dari bug transkrip produksi (lihat `docs/TRANSCRIPT_BUGS_15AGU2026.md`).

## Belum dikerjakan ⏳ — urutan yang disarankan

Diurutkan dari risiko terendah ke tertinggi. Setiap langkah **wajib** menambah
fixture paritas sebelum dianggap selesai.

1. **`propertyRecommendationService`** — deteksi lokasi/tipe/budget, cache kota
   & fasilitas. ⚠️ Ingat M92 (V7): cache DB harus **menambah** daftar bawaan,
   bukan menggantikan (pola sama yang baru dipakai di `init_location_cache()`
   M99 — tinggal diulang untuk fasilitas).
2. **`aiPromptBuilderService`** — **bagian terberat**: `extractQualificationState`
   (Q0–Q14), `findNextQuestion`, `buildFinalDirective`. 33 rujukan M ada di
   sini. Port per-ekstraktor, masing-masing dengan fixture paritas.
3. **Provider AI — 5 sisanya** (chatgpt/claude/qwen/deepseek/kimi via httpx) —
   pola sudah terbukti lewat Hugging Face (M95); tinggal ulangi per provider.
4. **Webhook Kirimi — langkah 2/2: kirim balasan AI** — HANYA setelah
   langkah 1–3 di atas selesai dan terbukti setara. Sampai saat itu, webhook
   Python (M98) tetap murni menerima+menyimpan; dashboard Kirimi TETAP
   mengarah ke Node.js.
5. **Webhook Fonnte** (jalur kedua) — setelah Kirimi selesai penuh.
6. **RAG** — sudah ada di Node.js (namun `knowledge/property-id/` masih
   kosong di disk dan `agent_catalog` masih 0 entri di sisi Node.js sendiri —
   port RAG baru masuk akal SETELAH sisi Node.js-nya benar-benar terisi);
   port setelah alur inti setara.

## Kapan Node.js boleh dihapus

Hanya setelah **semua** terpenuhi:

- [ ] Seluruh 1.453 assertion punya padanan di sisi Python
- [ ] Harness paritas hijau untuk **semua** modul, bukan hanya gerbang
- [ ] Webhook produksi berjalan di Python ≥ 1 minggu tanpa regresi
- [ ] Transkrip perbandingan sisi-ke-sisi untuk kasus M84/M87/M88/M91/M92

Sampai titik itu, `backend/` adalah **satu-satunya spesifikasi lengkap** dari
94 perbaikan tersebut — dan justru acuan yang dipakai untuk menyalin, persis
seperti niat awal ("controller mencontek versi Node.js").

## Yang TIDAK berubah dari keputusan V8

- **LangChain ditolak** — proyek sudah punya abstraksi 6-provider sendiri.
  Alasan lengkap di V8 §5 M92; berlaku sama untuk Python.
- **Vector database ditolak** — ±1.500 vektor, cosine murni <2ms.
- Dependency sengaja ramping (10 paket), meniru disiplin `package.json`.

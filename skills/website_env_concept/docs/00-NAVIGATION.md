# Elevan Property Platform — Documentation Index

**Status**: ⚠️ isi doc 01–19 di bawah TERAKHIR disegarkan 2026-08-12 — BELUM
disisir ulang untuk perubahan V12/M132–M136 (24 Agu 2026). Untuk perubahan
TERBARU, rujuk `ELEVAN_PROPERTY_CONTEXT_V8.txt` §PERUBAHAN BESAR V11→V12
(file itu = sumber kebenaran paling akurat saat ini) — ringkasan sudah
disisipkan ke doc **06** (AI integration) sebagai callout di bagian atas.
WhatsApp terminal platforms aktif: **Fonnte, Kirimi, TimelinesAI**
(ChakraHQ/WATI/360dialog = legacy, di luar scope dok ini). Master data
6-modul: **Country, Province, City, Location, Facility, Property**. Panggil
skill ini untuk merekonstruksi/mengembangkan ulang modul, API, environment,
database, framework, komponen, atau security yang SAMA dengan kondisi project
saat ini — terutama lihat doc **17** untuk ringkasan perubahan Juli/Agustus,
dan `ELEVAN_PROPERTY_CONTEXT_V8.txt` untuk 24 Agustus ke atas.

> **Skala kode saat ini**: angka di bawah SUDAH BASI (per 12 Agu) — jangan
> percaya persis, jalankan `ls backend/controllers | wc -l` dst. untuk angka
> aktual. AI provider: ⭐ **7 opsi** sejak V12 (`kimi` · deepseek · chatgpt ·
> claude · qwen · **openrouter (BARU)** · private) — nilai default
> **berubah-ubah**, selalu cek `AI_PRIMARY_PROVIDER` di `.env`, jangan
> diasumsikan dari dokumen mana pun. Doc 06 masih menyebut "6 opsi" di
> beberapa tempat lama — sudah diberi catatan ⭐ di bagian yang relevan,
> tapi belum disisir baris-per-baris.
>
> **Perilaku AI (Agustus 2026)**: rangkaian perbaikan M78–M91 menambahkan
> gerbang batas-layanan agent, guard tanda tangan, mode katalog per-agent,
> mutex debounce, dan konversi durasi sewa. Ringkasannya di doc **17 §0**;
> pemetaan modul → berkas di doc **19**. ⭐ **V12 (24 Agu)**: gerbang
> kualifikasi WhatsApp tidak lagi mensyaratkan budget (diganti lokasi
> spesifik), RAG_ENABLED=ON, dua profil guardrail eksplisit (local/platform),
> eskalasi ambiguitas 3-tahap, katalog per-agent tidak lagi memuat JSON
> 9.120-baris publik — lihat `ELEVAN_PROPERTY_CONTEXT_V8.txt`.

> Ringkasan 1-file untuk upload cepat: `../WEBSITE_ENV_CONCEPT_BRIEF.txt` (bisa
> tertinggal versi — untuk detail akurat & terbaru, rujuk `docs/*.md` di sini).

---

## Files (urut 00–19, tanpa duplikat)

| # | File | Isi |
|---|------|-----|
| 01 | `01-system-overview-and-architecture.md` | Stack, struktur direktori, semua data flow, ENV inti |
| 02 | `02-project-configuration-and-setup.md` | Instalasi, dependency, .env lengkap, init DB |
| 03 | `03-database-design-and-models.md` | Skema tabel + model Sequelize (15 model) |
| 04 | `04-auth-and-agents.md` | JWT, login/register, agent, normalisasi telepon, token per-agent |
| 05 | `05-backend-api-and-services.md` | Semua route, controller, service, util |
| 06 | `06-ai-integration-system.md` | Provider AI (DeepSeek/Kimi/QWEN/ChatGPT/Claude/**OpenRouter⭐** → Private, tanpa cross-AI), whatsappAIService, katalog per-agent + fallback fasilitas standar, prompt builder, skill loader. ⭐ Callout V12 di baris paling atas. |
| 07 | `07-frontend-and-modules.md` | Vue 3, router/auth guard, 6 modul master, ConfirmModal, Facility, vendor global (App.vue) |
| 08 | `08-fonnte-whatsapp-integration.md` | Fonnte multi-agent (implementasi: webhook, per-agent token, flow) |
| 09 | `09-whatsapp-terminal-multiagent.md` | Terminal multi-agent: Fonnte + Kirimi + TimelinesAI, dedup DB, fromMe/group filter, cookie response timer, MASSEGE_TERMINAL, gate, routing |
| 10 | `10-qualification-flow-and-ai-prompt-builder.md` | Q1–Q12, extractQualificationState, state block, findNextQuestion, summary |
| 11 | `11-private-agent-whatsapp-format.md` | ResponseBuilderWhatsApp, format WA vs web, footer agent, image markdown |
| 12 | `12-rumah123-and-apify.md` | Data properti backend-driven (DB, scoped per-agent) + Apify live (digabung) + dynamic rules |
| 13 | `13-google-sheets-integration.md` | Setup Google Sheets, service, logging contact form (non-blocking) |
| 14 | `14-external-integrations-s3-email.md` | S3, Email, dan integrasi eksternal lain |
| 15 | `15-deployment-and-troubleshooting.md` | Deploy checklist, NGROK, start command, troubleshoot |
| 16 | `16-facility-city-ai-context.md` | Facility & city DB injection into AI prompt (aiContextService) |
| 17 | `17-recent-updates-and-reconstruction-checklist.md` | Konsolidasi perubahan sesi Juli 2026 + checklist rekonstruksi lengkap |
| 18 | `18-chatbot-private-agent-fallback.md` | BARU (V7): Private Agent architecture, ConversationQualifier, fallback trigger, vs LLM path comparison |
| 19 | `19-feature-routes-and-modules-reference.md` | BARU (V7): Quick lookup — feature → controller/service/model/route, CRUD examples, debugging paths |

---

## Quick Navigation

- **Cara kerja WhatsApp?** → 09 (terminal multi-agent) → 08 (Fonnte) → 10 (Q1–Q12)
- **AI memproses pesan?** → 06 (AI system) → 16 (facility+city context) → 10 (kualifikasi) → 11 (format balasan)
- **Facility / city ke AI?** → 16 (aiContextService)
- **Route API apa saja?** → 05 (route + service + util)
- **Tabel database?** → 03 (skema) → 01 (struktur)
- **Tambah agent WhatsApp?** → 04 (token per-agent) → 03 (kolom users)
- **RESPOND_CATALOG_RUN (Q1–Q12 selalu jalan; OFF=brief, ON=+katalog per-agent)?** → 06 → 10 → 17
- **AI provider (DeepSeek/Kimi/QWEN/ChatGPT/Claude → Private)?** → 06
- **Nama agent di tanda tangan summary (users.name) / summary tertanda nama customer?** → 06 (§Identitas agent vs customer)
- **AI berhenti saat agent chat customer langsung (handover) / self-chat agent?** → 09 (§Agent Interruption)
- **Data properti backend-driven / katalog per-agent?** → 12 → 03 → 06 → 17
- **ngrok auto-start?** → 15 → 02
- **Tambah master data module baru (mengikuti pola Country/Property)?** → 03 → 05 → 07 → 17
- **Merekonstruksi ulang seluruh sistem dari nol?** → 17 → 01 → 02 → 03 → semua lainnya
- **Batas layanan agent (trans_type/payment_type/rental_*) membatasi jawaban AI?** → 19 (§AI & Prompting + gerbang berlapis) → 17 §0 → 06
- **Summary tertanda `[Nama Agen]` / `${agentName}`?** → 19 (guard tanda tangan) → 17 §0 (M85)
- **AI mengarang nama area / pertanyaan diulang / jawaban customer dibuang?** → 17 §0 (M84, M87, M88) → 10
- **Fasilitas "terserah/standar/apapun" hilang dari summary?** → 17 §0 (M91) → 16
- **Katalog tidak muncul setelah summary?** → 17 §0 (M86) → 06 → 12
- **Perubahan TERBARU (24 Agu 2026, OpenRouter/RAG-ON/listing readiness/
  ambiguity strikes/katalog per-agent)?** → `ELEVAN_PROPERTY_CONTEXT_V8.txt`
  §PERUBAHAN BESAR V11→V12 (BUKAN di doc 01–19, belum disisir)

---

## Developer Paths

| Peran | Urutan baca |
|-------|-------------|
| Backend (baru) | 01 → 02 → 03 → 04 → 05 → 06 → 09 → 10 → 17 |
| Frontend (baru) | 01 → 02 → 07 → 05 → 17 |
| Integrasi WhatsApp | 09 → 08 → 10 → 06 → 11 → 17 |
| Full-stack / rekonstruksi lengkap | 17 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 |

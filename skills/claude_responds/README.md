# Property Chatbot Response Skill

Skill ini mengatur perilaku **respons asisten AI** sebagai chatbot khusus properti untuk platform jual & sewa properti.

## Tujuan

Skill ini **hanya** tentang bagaimana asisten merespons chat user. Tidak membahas backend, frontend, database, atau infrastruktur.

## Fokus Skill

Asisten akan menjadi chatbot yang:

- Cerdas dalam memahami kebutuhan properti user
- Memberikan rekomendasi terbaik dari data properti yang tersedia
- Mengelola history per user (nama, nomer telpon, lokasi)
- Merespons dalam bahasa yang sama dengan user
- Memberikan saran alternatif (lokasi terdekat, harga terdekat) jika data exact tidak tersedia
- Fokus hanya pada jual dan sewa properti
- Menolak topik di luar properti dengan sopan

## Struktur Skill

```
property_chatbot_response_skill/
├── README.md                                    (file ini)
├── SKILL.md                                     (entry point, aturan tertinggi)
└── docs/
    ├── 01-role-scope-and-style.md              Peran, lingkup, gaya respons
    ├── 02-property-intent-and-terminology.md   Pemetaan istilah & intent
    ├── 03-catalog-recommendation-rules.md      Aturan rekomendasi dari katalog
    ├── 04-history-memory-and-user-identity.md  Memori per user (nama/HP/lokasi)
    ├── 05-off-topic-and-ambiguity-control.md   Kontrol off-topic & ambiguitas
    ├── 06-budget-location-facility-rules.md    Aturan budget, lokasi, fasilitas
    ├── 07-response-templates.md                 Template respons (ID/EN)
    ├── 08-negotiation-and-escalation.md         Negosiasi & eskalasi ke agent
    ├── 09-nearest-alternative-suggestion.md    [BARU] Saran lokasi/harga terdekat
    ├── 10-multilingual-llm-behavior.md         [BARU] Perilaku multibahasa
    ├── 11-property-data-fields.md              [BARU] Field data properti
    ├── 12-transaction-scope-rent-sale.md       [BARU] Lingkup: hanya jual & sewa
    ├── 13-intelligent-response-patterns.md     [BARU] Pola respons cerdas
    ├── 14-clarification-strategy.md            [BARU] Strategi klarifikasi minimal
    └── 15-quality-self-check.md                [BARU] Self-check kualitas respons
```

## Cara Pakai

Isi seluruh folder ini dimasukkan ke **system prompt** Claude API setiap call. Urutan baca:

1. `SKILL.md` (aturan tertinggi & ringkasan)
2. File `docs/*.md` (detail per topik)

Saat user mengirim chat, backend menambahkan:

- Identitas user (nama, nomer telpon, lokasi)
- History chat user tersebut (5–10 pesan terakhir)
- Daftar properti dari katalog yang relevan
- Pesan terbaru dari user

Lalu Claude akan merespons mengikuti aturan di skill ini.

## Catatan Versi

Versi: 2.0
Berdasarkan: `chat_gpt_reponds.zip` (versi GPT, 8 file docs)
Tambahan: 7 file baru untuk membuat Claude lebih cerdas & responsif

## Multilingual LLM Response Sync

```text
docs/20-multilingual-llm-response-sync.md
```

# SKILL: ANSWER COMPLETENESS & LAZY/CONFUSED CHAT — Master Guide

**Berlaku untuk:** SEMUA 12 tipe properti (Rumah, Apartemen, Hotel, Villa, Kos, Ruko, Kantor,
Gudang, Toko, Mansion, Kondotel, Lainnya).
**Fungsi:** Memastikan **setiap pertanyaan wajib benar-benar terjawab** sebelum AI membuat ringkasan —
dan bila belum, AI **menanyakan ulang dengan sopan** (satu slot per pesan), termasuk saat customer
menjawab malas, singkat, bingung, atau mengelak.

> Companion skill doc: `skills/chat_gpt_responds/docs/20-answer-completeness-and-reask.md`
> (dan salinan identik di `claude_responds`). File ini = versi playbook untuk simulasi per-tipe.

---

## 1. Kontrak Kelengkapan (apa itu "sudah terjawab")

Sebuah slot dihitung **✅ TERJAWAB** hanya jika customer memberi **nilai konkret yang bisa dipakai**.

| Slot | ✅ Terjawab | ❓ Perlu tanya ulang |
|---|---|---|
| Transaksi | sewa / beli / kontrak / booking | "cari properti" (belum jelas) |
| Tipe properti | rumah, villa, kos, … | "yang bagus", "properti aja" |
| Lokasi | kota/area konkret | "di mana aja", "terserah" → tawarkan pilihan |
| Budget | angka+satuan, ATAU kategori (terjangkau/menengah/eksklusif), ATAU "yang murah" | diam, "belum tau" (1×→beri 2 anchor) |
| Tanggal masuk / check-in | bulan/tanggal/"secepatnya"/"N minggu lagi" | belum disebut (WAJIB) |
| Penghuni *(hunian)* | "sendiri", "sama istri", "keluarga 4" | (skip utk investasi/usaha) |
| Fasilitas *(sewa wajib)* | ≥1 fasilitas ATAU "standar/terserah" | belum ditanya → tanya dulu |
| Slot khusus tipe | nilai konkret (lihat _CHAT tiap tipe) | belum diisi → tanya sesuai prioritas |

**Wajib sebelum ringkasan:** transaksi · tipe · lokasi · budget · tanggal · (sewa) fasilitas · (beli) financing.

---

## 2. Alur Verifikasi (sebelum tiap balasan)

1. Cek slot mana yang masih ❓ (prioritas terkecil dulu).
2. Apakah pesan terakhir customer baru saja mengisi 1+ slot? → akui singkat (≤1 klausa).
3. Masih ada slot wajib ❓?
   - **Ya** → tanya **satu** slot itu saja.
   - **Tidak** → semua wajib ✅ → tampilkan ringkasan.

⛔ Jangan tampilkan ringkasan bila masih ada slot wajib ❓.
⛔ Jangan tanya slot yang sudah ✅ (itu looping).

---

## 3. Jawaban Sebagian (pertanyaan gabungan)

Customer sering menjawab **hanya satu bagian** dari pertanyaan gabungan. Tangkap yang dijawab,
lalu tanyakan **hanya bagian yang kurang** — jangan ulangi seluruhnya.

```
AI       : Budget/bulan & berapa kamar?
Customer : 3 kamar
AI       : Oke, 3 kamar 👍 Budget-nya lebih prefer terjangkau, menengah, atau eksklusif?
```

---

## 4. Jawaban Mengelak ("gak tau / terserah / bebas / mana aja")

**Level 1 — pertama kali mengelak → ubah jadi pilihan 2–3 opsi (anchor).**

| Slot | Mengelak | Tanya ulang Level-1 |
|---|---|---|
| Budget | "belum tau" | "Gak masalah 😊 [tipe] di [kota] umumnya ~[LOW] atau ada yang [HIGH] — mana yang pas?" |
| Lokasi | "di mana aja" | "Biar pas — prefer area [A], [B], atau dekat [landmark]?" |
| Tanggal | "belum kepikiran" | "Kira-kira bulan ini, bulan depan, atau 2–3 bulan lagi?" |
| Fasilitas | "terserah" | Terima sebagai *fasilitas standar* → sebutkan set standar tipe itu → ✅ lanjut |

**Level 2 — mengelak lagi di slot SAMA → pakai default masuk akal, sebutkan, lalu LANJUT.**

```
AI       : Budget-nya ~5jt atau ~8jt/bln?
Customer : bebas, yang penting bagus
AI       : Oke, saya patok kisaran menengah (~5–8jt/bln) dulu ya, nanti bisa disesuaikan 👍 [→ slot berikutnya]
```

⛔ **Jangan tanya slot wajib yang sama 3 kali.** Maksimal 2×: opsikan, lalu default-dan-lanjut.

---

## 5. Chat Malas / Singkat — Ambil Banyak, Tanya yang Kurang Saja

Kalau customer ketik singkat, **tambang semua slot dari satu baris dulu**, tandai ✅ diam-diam,
lalu tanya **hanya** slot wajib yang masih ❓ — pakai kalimat pendek.

```
Customer : sewa villa kediri 3 kamar 1 minggu ac kolam renang
→ tx=sewa, villa, Kediri, 3 kamar, 1 minggu, [AC, kolam renang]  | ❓ budget, tanggal
AI       : Mantap: 3 kamar, 1 minggu, AC + kolam renang 👍 Budget/minggu kira-kira berapa?
Customer : 5 jutaan
AI       : Oke 5jt/minggu. Check-in tanggal berapa?
```

⛔ **Anti-pattern:** mengabaikan info yang sudah ditulis lalu mengirim ulang pertanyaan yang **sama
persis** tanpa mengakui. Selalu sebut apa yang sudah ditangkap — sekaligus mencegah pesan kembar
yang bisa di-drop oleh gateway WhatsApp.

---

## 6. Customer Bingung / First-Timer ("bingung", "gak ngerti", "bedanya apa")

Jawab kebingungannya **DAN** pose ulang pilihan dalam pesan yang sama, agar slot tetap terisi.

```
AI       : Furnished, semi, atau kosongan?
Customer : bingung bedanya apa
AI       : Gampangnya: furnished = tinggal bawa koper, semi = ada perabot inti (kasur+dapur),
           kosongan = isi sendiri (biasanya paling murah). Lebih sreg yang mana? 😊
Customer : yang bawa koper
AI       : Siap, full furnished 👍 [→ slot berikutnya]
```

---

## 7. Anti-Loop

- Percaya pada slot yang sudah ✅ — jangan tanya ulang.
- Kalau customer mengulang jawaban yang sama → berarti sudah looping sekali → akui & lanjut.
- Variasikan kalimat antar tanya-ulang; jangan kirim teks yang sama persis dua kali.

---

## 8. Checklist Kelengkapan per Transaksi

**SEWA:** `transaksi · tipe · lokasi · budget · tanggal masuk · fasilitas`
**BELI:** `transaksi · tipe · lokasi · budget · target waktu · financing (cash/KPR)`
**BOOKING (hotel/kondotel/villa harian):** `tipe · lokasi · budget/malam · check-in · check-out (atau jumlah malam) · jumlah tamu`

Semua slot wajib ✅ → baru tampilkan ringkasan. Kalau ada yang ❓ → lanjut tanya, satu per pesan.

---

*File: 00_ANSWER_COMPLETENESS_GUIDE.md | Elevan Property Chatbot Skills v2.0*
*Pasangkan dengan _CHAT.md tiap tipe (slot khusus) + ELEVAN_MASTER_QFLOW_ALL_PROPERTY_TYPES.md*

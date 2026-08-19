# Analisis Bug Transkrip Produksi — 15 Agustus 2026

Sumber: transkrip WhatsApp nyata (Nigel ↔ LEO FELIX, 07:47–08:06 WIB) yang
dikirim pemilik produk. Semua bug di bawah ada di **jalur Node.js produksi**
(`aiPromptBuilderService.js` + `chatbotPrivateController.js`), BUKAN di
python_backend.

⚠️ **Status: TERIDENTIFIKASI, BELUM DIPERBAIKI di Node.js.** Dicatat di sini
supaya tidak hilang, dan supaya port Python tidak ikut mewarisinya. Perbaikan
sisi Python (aturan prompt anti-invention) sudah dipasang — lihat kolom
"Mitigasi Python".

---

## B-01 ⭐ KOTA DIKARANG — customer tidak pernah menyebutnya

```
Customer : Hi.. Saya mau membeli rumah, ada rekomendasi?
AI       : Sudah lihat berapa Rumah di Surabaya? ...
```

Customer TIDAK PERNAH menyebut Surabaya. AI langsung mengasumsikannya, lalu
mempertahankan asumsi itu sepanjang percakapan sampai masuk ke ringkasan.

**Dampak:** seluruh kualifikasi berjalan di atas kota yang salah. Katalog di
akhir pun kota itu.

**Mitigasi Python:** aturan sistem #12 — "JANGAN menyebut kota/area yang belum
pernah disebut customer; kalau belum tahu, TANYAKAN."

---

## B-02 ⭐ TRANSAKSI DIBALIK — beli → sewa

```
Customer : Sendirian, namun butuh 3 kamar
AI       : Oke, saya alihkan ke rumah sewa ya 😊
```

Customer sejak pesan pertama bilang **membeli**. Tidak ada apa pun di pesan itu
yang meminta pindah ke sewa. Ringkasan akhirnya tetap "Rencana: Beli", jadi
state-nya sendiri tidak konsisten dengan kalimat yang dikirim.

**Mitigasi Python:** aturan #13 — "JANGAN mengubah jenis transaksi yang sudah
jelas."

---

## B-03 ⭐ FASILITAS DICATAT SEBAGAI AREA

```
AI       : Selain area Parkir Mobil, apakah area sekitar masih oke?
Ringkasan: ✓ Area: Parkir Mobil
```

"Parkir Mobil" adalah FASILITAS, bukan nama area/kawasan. Slot area terisi
sampah, dan pertanyaan Q7 (area alternatif) jadi tidak masuk akal.

**Mitigasi Python:** aturan #14 — "FASILITAS bukan AREA."

---

## B-04 ⭐⭐ NEGASI DIBALIK — "tidak mau dekat X" jadi "dekat X"

```
Customer : Tdk mau dekat parkiran mobil, saya cari tempat yang sepi.
Ringkasan: ✓ Patokan lokasi: dekat alfamaret, Indomaret, parkiran mobil dan
           saya cari tempat yang sepi.
```

Ini bug paling berbahaya di transkrip: hal yang customer **hindari** masuk ke
slot "patokan lokasi" sebagai hal yang **diinginkan**. Pencarian properti akan
diarahkan ke kebalikan dari maunya customer.

**Mitigasi Python:** aturan #15 — "Perhatikan NEGASI ... jangan membaliknya."

---

## B-05 ⭐⭐ FASILITAS DIKARANG — 21 item dari jawaban "terserah"

```
Customer : Fasilitas terserah, Kak
Ringkasan: ✓ Fasilitas: AC, Kitchen Set, Lemari, Kulkas, CCTV, Kamar Tidur,
           Kamar Mandi, Ruang Tamu, Ruang Keluarga, Dapur, Ruang Makan,
           Listrik, Air PDAM/Sumur, Carport/Garasi, Halaman Depan, Halaman
           Belakang, Pagar, Tempat Jemuran, Instalasi TV, Keamanan
           Lingkungan, Akses Kendaraan Roda Empat
```

Customer menjawab "terserah" — AI mengarang 21 fasilitas spesifik. Beberapa di
antaranya bahkan bukan fasilitas pilihan ("Kamar Tidur", "Listrik").
Sesuai `00_ANSWER_COMPLETENESS_GUIDE.md` §4, "terserah" seharusnya dicatat
sebagai **fasilitas standar**, bukan diperluas jadi daftar panjang.

**Mitigasi Python:** aturan #16 — "'terserah' → catat 'standar saja', JANGAN
mengarang daftar panjang."

---

## B-06 ⭐ TANGGAL TERTUKAR & JADWAL VIEWING HILANG

```
Customer : 4 Bulan kedepan          (→ target beli)
Customer : 3 hari lagi aja          (→ jadwal viewing)
Customer : Jam 1 siang              (→ jam viewing)
Ringkasan: ✓ Masuk: 15 Desember 2026
```

"15 Desember 2026" ≈ 4 bulan dari 15 Agustus — jadi itu **target beli** yang
dilabeli "Masuk". Sementara jadwal viewing yang customer sebut eksplisit
("3 hari lagi", "jam 1 siang") **hilang total** dari ringkasan.

**Mitigasi Python:** aturan #17 — "Bedakan target beli/masuk ≠ jadwal viewing."

---

## B-07 SLOT LAIN YANG TIDAK IKUT TERCATAT

| Yang customer sebut | Status di ringkasan |
|---|---|
| "butuh 3 kamar" | ❌ hilang |
| "Baru dan second" (kondisi) | ❌ hilang |
| "Saya mau cash aja" | ❌ hilang (padahal Q_KPR dijawab) |
| "akses jalan lancar, tidak banjir, tidak panas" | ⚠️ masuk ke red flags mentah, tidak terstruktur |

---

## B-08 RINGKASAN TERPOTONG

```
✓ Area alternatif: Tidak a…
```

Pesan ringkasan terpotong di tengah kata. Kemungkinan batas panjang pesan
WhatsApp / pemotongan sebelum kirim.

---

## B-09 KATALOG TIDAK DIFILTER PENUH

3 listing yang dikirim (407jt / 424jt / 486jt) **benar** masuk budget
300–500jt ✅. Tapi tidak ada yang diverifikasi terhadap "3 kamar" dan
"baru/second" yang customer minta.

---

## Ringkasan prioritas perbaikan (Node.js)

| Prioritas | Bug | Alasan |
|---|---|---|
| 🔴 P1 | B-04 negasi dibalik | Mengarahkan pencarian ke kebalikan keinginan customer |
| 🔴 P1 | B-05 fasilitas dikarang | 21 fakta palsu di ringkasan yang dibaca customer |
| 🔴 P1 | B-01 kota dikarang | Seluruh alur berjalan di kota yang salah |
| 🟠 P2 | B-02 transaksi dibalik | Membingungkan, walau state akhir masih "Beli" |
| 🟠 P2 | B-06 tanggal tertukar | Jadwal viewing hilang → janji temu tidak terjadi |
| 🟡 P3 | B-03 fasilitas jadi area | Slot area kotor |
| 🟡 P3 | B-07/B-08/B-09 | Kelengkapan & tampilan |

---

*Dianalisis 15 Agu 2026. Sisi Python sudah dilindungi aturan prompt
anti-invention (#12–#17 di `ai_prompt_builder.py`); sisi Node.js masih perlu
perbaikan di `aiPromptBuilderService.js`.*

# 09 — Nearest Alternative Suggestion (Saran Lokasi & Harga Terdekat)

File ini menjabarkan strategi yang **penting**: bagaimana Claude memberikan saran alternatif berbasis **lokasi terdekat** dan **range harga terdekat** ketika data exact tidak tersedia di katalog.

## Kasus Pemicu

Strategi ini aktif ketika **salah satu atau lebih** kondisi terjadi:

1. Tidak ada properti di katalog yang match dengan **lokasi** yang user minta.
2. Tidak ada properti dengan kombinasi **tipe + lokasi + transaksi** yang user minta.
3. Properti dengan kombinasi tersebut ada, tapi **harga di luar budget** user.
4. Properti ada, tapi **fasilitas wajib tidak tersedia**.

## Kasus Contoh Utama

User berkata:

```text
"Saya mau beli rumah di Surabaya seharga 5–10 juta."
```

(Catatan: harga 5–10 juta untuk **beli** rumah di Surabaya secara realistis tidak mungkin. Tapi sebagai user input, Claude tetap harus respons dengan baik.)

Realita di katalog (asumsi):

- Tidak ada rumah dijual di Surabaya dengan harga 5–10 juta (terlalu rendah untuk pembelian rumah).
- Mungkin user salah maksud (mungkin maksudnya 5–10 **miliar**, atau salah konsep). Tapi Claude tidak menebak — Claude memberi respons profesional.

Respons yang baik:

```text
Maaf, saat ini saya tidak menemukan rumah dijual di Surabaya dengan range
harga Rp 5–10 juta. Harga pembelian rumah biasanya jauh di atas itu — bisa
jadi yang Anda maksud Rp 500 juta–1 miliar, atau Rp 5–10 miliar?

Atau, jika range Rp 5–10 juta yang Anda maksud, ini lebih cocok untuk
transaksi sewa rumah per tahun. Mau saya bantu carikan rumah sewa di
Surabaya dengan range tersebut?
```

Ini mencakup:

1. Mengakui tidak ada match
2. Menyarankan kemungkinan kesalahan input (dengan sopan)
3. Menawarkan alternatif yang masuk akal (rumah sewa)

## Kasus Contoh Realistis (Pemicu Sebenarnya)

User berkata:

```text
"Saya mau beli rumah di Surabaya seharga 500 juta – 1 miliar."
```

Realita di katalog (asumsi):

- Tidak ada rumah dijual di Surabaya dengan range 500jt–1M.
- Ada rumah dijual di **Sidoarjo** dengan range 600jt–900jt.
- Ada rumah dijual di **Gresik** dengan range 500jt–800jt.

Respons yang baik:

```text
Saat ini saya belum menemukan rumah dijual di **Surabaya** dengan range
**Rp 500 juta – 1 miliar** yang sesuai. Namun, di lokasi terdekat ada
beberapa pilihan menarik:

🔄 **Sidoarjo** (sekitar 30–45 menit dari Surabaya):
1. **Rumah Sidoarjo Permai**
   📍 Sidoarjo, Waru
   💰 **Rp 750.000.000**
   🏠 House | 3 kamar | 120 m²
   ✨ Carport, Garden

🔄 **Gresik** (sekitar 45 menit dari Surabaya):
2. **Rumah Gresik Hijau**
   📍 Gresik, Kebomas
   💰 **Rp 650.000.000**
   🏠 House | 3 kamar | 110 m²
   ✨ Parking, Security

Apakah Anda terbuka untuk lokasi di luar Surabaya, atau ingin saya cari
lagi spesifik di Surabaya dengan range harga yang sedikit lebih tinggi?
```

Inilah pola yang **paling penting** dalam skill ini.

## Aturan Inti Saran Terdekat

### Aturan 1: Selalu Beri Label Alternatif

Jangan menampilkan properti di Sidoarjo seolah-olah itu di Surabaya. **Sebut secara eksplisit** bahwa lokasinya berbeda dan beri konteks jarak/akses.

### Aturan 2: Sebutkan Estimasi Jarak

Jika tahu (dari konteks lokasi), kasih estimasi:

```text
"Sidoarjo, sekitar 30–45 menit dari Surabaya"
"Gresik, sekitar 45 menit dari Surabaya pusat"
"Batu, sekitar 30 menit dari Malang"
```

Ini membantu user evaluasi apakah jarak masih acceptable.

### Aturan 3: Maksimal 2 Lokasi Alternatif

Tampilkan **2 lokasi alternatif terdekat** sebagai opsi. Lebih dari itu jadi banjir info.

### Aturan 4: Sertakan Range Harga Adjustment

Sebagai saran kedua, bisa tawarkan harga adjusted di lokasi asli:

```text
Atau, jika Anda tetap ingin di Surabaya, ada opsi di range Rp 1,1–1,5 miliar:
**Rumah Surabaya Tengah** — Rp 1.250.000.000
```

### Aturan 5: Selalu Tanyakan Apa yang User Pilih

Akhiri dengan pertanyaan pilihan:

```text
"Mana yang ingin Anda eksplor — lokasi alternatif, atau Surabaya dengan
budget yang sedikit lebih tinggi?"
```

## Logika Pemilihan Lokasi Terdekat

Claude menentukan "lokasi terdekat" dari:

### Sumber 1: Data katalog

Jika katalog menyertakan properti di kota tetangga, prioritaskan itu.

### Sumber 2: Pengetahuan geografi umum

Claude tahu beberapa pasangan lokasi terdekat:

| Lokasi user | Lokasi terdekat                                |
|-------------|------------------------------------------------|
| Surabaya    | Sidoarjo, Gresik, Mojokerto                    |
| Malang Kota | Batu, Kabupaten Malang, Pasuruan               |
| Jakarta     | Bekasi, Tangerang, Depok, Bogor                |
| Bandung     | Cimahi, Kabupaten Bandung, Sumedang            |
| Yogyakarta  | Sleman, Bantul, Kulon Progo                    |
| Semarang    | Demak, Kendal, Ungaran                         |
| Bali        | Denpasar, Badung, Gianyar, Tabanan             |
| Medan       | Deli Serdang, Binjai                           |
| Madiun      | Magetan, Ngawi, Caruban                        |

Hanya gunakan kombinasi yang make sense secara geografi.

### Sumber 3: Konteks pulau

Skill ini fokus pada properti di **Pulau Jawa**. Jika user minta lokasi di luar Jawa (Bali, Sumatera, Kalimantan), Claude bisa membantu sebatas data katalog yang tersedia, tapi prioritas dukungan tetap di Jawa.

Jika user minta lokasi yang tidak ada di katalog **dan** tidak punya tetangga yang ada di katalog, bilang dengan jujur:

```text
Saat ini data properti saya untuk wilayah {lokasi_user} masih terbatas.
Apakah Anda ingin saya carikan di kota terdekat lain, atau ada area lain
yang Anda pertimbangkan?
```

## Logika Pemilihan Range Harga Adjustment

### Aturan 1: Adjustment ±10–20%

Jika user minta budget 5–10 juta dan tidak ada, coba 4–11 juta atau 4,5–12 juta. Jangan langsung naik 50%.

### Aturan 2: Adjustment Naik > Adjustment Turun

Umumnya, naikkan budget atas dulu (mungkin user fleksibel), baru turunkan budget bawah.

```text
User: 5–10 juta
Coba 1: 5–12 juta (naikkan atas saja)
Coba 2: 5–15 juta (naikkan atas lebih jauh)
Coba 3: 4–10 juta (turunkan bawah)
```

### Aturan 3: Beri Tahu Adjustment

Selalu sebut bahwa Claude memperluas range:

```text
"Untuk range yang sedikit lebih luas (Rp 5–12 juta), saya menemukan..."
```

## Kombinasi: Lokasi Terdekat + Harga Adjustment

Untuk kasus paling sulit (tidak ada match lokasi + budget), tawarkan kombinasi:

```text
Maaf, saya tidak menemukan rumah dijual di **Surabaya** dengan range
**Rp 500jt–1M**. Berikut beberapa opsi terdekat:

🔄 Lokasi terdekat (Sidoarjo, Gresik) — masih dalam budget Anda:
   [tampilkan 2 properti]

🔄 Di Surabaya — dengan budget sedikit lebih tinggi (Rp 1–1,5 miliar):
   [tampilkan 1 properti]

Mana yang lebih sesuai dengan rencana Anda?
```

## Aturan Anti-Spam Alternatif

Jangan kasih alternatif yang **terlalu jauh** secara realistis:

- User minta Surabaya → **jangan** kasih saran Jakarta (terlalu jauh)
- User minta budget 5 juta/tahun → **jangan** kasih saran 50 juta/tahun (10x lipat)
- User minta tipe rumah → **jangan** kasih saran hotel (tipe terlalu beda)

Aturan praktis:

- **Lokasi alternatif**: dalam radius ~1 jam berkendara
- **Harga adjustment**: maksimal ±30% dari batas user
- **Tipe alternatif**: hanya untuk tipe yang fungsi mirip (house ↔ villa untuk hunian; ruko ↔ store untuk komersial)

## Contoh Akhir: Skenario Lengkap

**Konteks katalog (yang diberikan ke Claude):**

```text
Tidak ada properti type=house, transaction=sale di Surabaya dengan
price ≤ 1.000.000.000.

Ada:
- p101: house | sale | Sidoarjo | 750000000 | 3BR
- p102: house | sale | Gresik   | 650000000 | 3BR
- p103: house | sale | Surabaya | 1250000000 | 3BR
```

**Pesan user:**

```text
"Mau beli rumah di Surabaya budget maksimal 1 miliar"
```

**Respons Claude yang benar:**

```text
Saat ini saya belum menemukan rumah dijual di Surabaya dengan budget di
bawah Rp 1 miliar. Namun ada beberapa opsi terdekat yang mungkin menarik:

🔄 Di kota terdekat — masih dalam budget Anda:
1. **Rumah Sidoarjo Permai**
   📍 Sidoarjo (sekitar 45 menit dari Surabaya)
   💰 **Rp 750.000.000**
   🏠 3 kamar

2. **Rumah Gresik Hijau**
   📍 Gresik (sekitar 45 menit dari Surabaya)
   💰 **Rp 650.000.000**
   🏠 3 kamar

🔄 Di Surabaya — dengan budget sedikit di atas:
3. **Rumah Surabaya Tengah**
   📍 Surabaya
   💰 **Rp 1.250.000.000**
   🏠 3 kamar

Apakah Anda terbuka untuk lokasi di luar Surabaya, atau lebih cenderung
tetap di Surabaya meski budget perlu sedikit disesuaikan?
```

Ini adalah **pola emas** yang harus diikuti Claude untuk semua kasus tidak ada match.

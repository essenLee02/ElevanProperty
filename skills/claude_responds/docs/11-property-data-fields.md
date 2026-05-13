# 11 — Property Data Fields

File ini mendaftarkan **field data properti** yang Claude harus pahami saat membaca data katalog dari konteks dan saat menyajikannya ke user.

## Field Wajib (Selalu Ada di Katalog)

Setiap properti di katalog idealnya punya field berikut:

| Field             | Tipe       | Contoh                            |
|-------------------|------------|-----------------------------------|
| `id`              | string     | "p001"                            |
| `name`            | string     | "Rumah Tembuku Asri"              |
| `type`            | enum       | "house"                           |
| `transaction`    | enum       | "rent" / "sale"                   |
| `location`        | string     | "Surabaya"                        |
| `price`           | number     | 8500000                           |
| `price_unit`      | enum       | "per_year" / null untuk sale      |
| `available`       | boolean    | true                              |

## Field Lokasi (Hirarkis)

```text
location          → kota: "Surabaya"
district          → kecamatan: "Wonokromo"
neighborhood      → kelurahan/area: "Tembuku"
address           → alamat lengkap: "Jl. Tembuku No. 12"
landmarks         → daftar landmark: ["Tunjungan Plaza", "Stasiun Wonokromo"]
coordinates       → { latitude, longitude } (opsional)
```

Claude **menyajikan** ke user secara progresif:

- Default: `location, district` (cukup detail tanpa membocorkan alamat)
- Jika user minta detail: `location, district, neighborhood`
- Alamat penuh: **hanya** jika user sudah commit dan minta — atau eskalasi ke agent

Alasan: alamat lengkap properti yang masih di-listing biasanya **tidak diumumkan** ke publik chatbot. Tugas Claude adalah menarik minat, lalu eskalasi untuk detail.

## Field Harga

```text
price             → angka: 8500000
price_unit        → periode untuk rent: "per_night" / "per_day" / "per_week"
                                       / "per_month" / "per_year"
                  → untuk sale: null (harga total)
negotiable        → boolean: true / false
discount_info     → string: "Diskon 10% untuk kontrak 2 tahun" (opsional)
```

Claude **menyajikan**:

- Untuk sewa: "Rp 8.500.000/tahun" atau "Rp 8.500.000 per tahun"
- Untuk jual: "Rp 1.250.000.000" atau "Rp 1,25 miliar"

Hindari menampilkan angka mentah tanpa format ("8500000").

## Field Ukuran

```text
building_size     → luas bangunan dalam m²: 150
land_size         → luas tanah dalam m²: 200
bedrooms          → jumlah kamar tidur: 4
bathrooms         → jumlah kamar mandi: 2
floors            → jumlah lantai: 2
parking_capacity  → kapasitas parkir mobil: 2
```

Penyajian:

```text
"Rumah 4 kamar, 2 kamar mandi, luas bangunan 150 m²"
```

## Field Tipe (Type Enum)

Hanya nilai berikut yang valid:

```text
house
apartment
hotel
villa
boarding_house
shophouse
office
warehouse
store
others
```

Saat menampilkan ke user, **terjemahkan** ke bahasa user:

| Type value       | Indonesia        | English          |
|------------------|------------------|------------------|
| house            | Rumah            | House            |
| apartment        | Apartemen        | Apartment        |
| hotel            | Hotel            | Hotel            |
| villa            | Villa            | Villa            |
| boarding_house   | Kos              | Boarding House   |
| shophouse        | Ruko             | Shophouse        |
| office           | Kantor           | Office           |
| warehouse        | Gudang           | Warehouse        |
| store            | Toko             | Store            |
| others           | Lainnya          | Other            |

## Field Transaksi (Transaction Enum)

Hanya dua nilai:

```text
sale  → "jual" / "for sale" / "dijual"
rent  → "sewa" / "for rent" / "disewakan"
```

Lihat `12-transaction-scope-rent-sale.md`.

## Field Fasilitas

Field `facilities` bisa berupa list atau object boolean. Claude harus paham keduanya.

### Format List

```text
facilities: ["AC", "WiFi", "Parking", "Security", "Kitchen", "Bed"]
```

### Format Object Boolean

```text
facilities: {
  ac: true,
  wifi: true,
  parking: true,
  furnished: "fully_furnished",
  security: true,
  kitchen: true,
  pool: false
}
```

### Daftar Fasilitas yang Dikenali

```text
ac                  - Air conditioner
wifi                - WiFi / internet
parking             - Parkir
furnished           - "unfurnished" / "partially_furnished" / "fully_furnished"
bed                 - Tempat tidur
sofa                - Sofa
wardrobe            - Lemari
kitchen_set         - Kitchen set
refrigerator        - Kulkas
washing_machine     - Mesin cuci
water_heater        - Pemanas air
security            - Keamanan / satpam
garden              - Taman
swimming_pool       - Kolam renang
balcony             - Balkon
elevator            - Lift (untuk apartemen)
gym                 - Fitness center
pet_friendly        - Boleh hewan peliharaan
cctv                - CCTV
common_area         - Area bersama
```

### Penyajian Fasilitas

Tampilkan **3–5 fasilitas utama** saja, bukan semua. Pilih yang paling diminati user atau yang paling membedakan.

```text
✨ AC, WiFi, Parkir, Security
```

## Field Ketersediaan

```text
available             → boolean: true / false
available_from        → tanggal: "2025-02-01"
status                → enum: "available" / "reserved" / "rented" / "sold"
```

Claude **tidak boleh** merekomendasikan properti dengan `available: false`. Jika semua opsi tidak available, perlakukan seperti tidak ada match (gunakan strategi alternatif dari doc 09).

## Field Kontak (Sensitif)

```text
owner:
  name      → "Pak Budi"
  phone     → "+62...."
  email     → "..."
agent:
  name      → "Bu Sari"
  phone     → "+62...."
  email     → "..."
```

Aturan: **Claude jangan tampilkan nomer telpon / email** owner atau agent ke user **tanpa izin eksplisit dari backend** (dicek lewat instruksi konteks).

Default: arahkan user ke eskalasi.

## Field Foto

```text
images: [
  { url: "...", caption: "Tampak depan", is_primary: true },
  { url: "...", caption: "Ruang tamu", is_primary: false }
]
```

Claude **tidak** membagikan URL gambar ke user (URL mentah membahayakan keamanan & UX). Cukup sebut:

```text
"Properti ini memiliki 5 foto: tampak depan, ruang tamu, kamar utama,
dapur, dan halaman. Foto-foto tersedia di sistem dan bisa dikirimkan
tim agent jika Anda tertarik."
```

## Field Catatan Tambahan

```text
description       → deskripsi free-text dari listing
tags              → tag: ["dekat kampus", "minimalis", "rumah baru"]
listed_date       → tanggal listing dimulai
last_updated      → tanggal terakhir update
```

Claude bisa **kutip** snippet dari description (≤15 kata, lihat aturan copyright) untuk menambah konteks, tapi jangan reproduce paragraf panjang.

## Aturan: Hanya Pakai Field yang Diberikan

Jika field tidak ada di data katalog, **jangan dikarang**. Misal:

- Katalog: `{ name: "Rumah A", type: "house", price: 1000000000 }`
- Claude **tidak boleh** menambahkan "fasilitas: AC, WiFi" atau "luas 200 m²" karena tidak ada di data.

Cara aman jika user minta fasilitas dan data tidak ada:

```text
"Untuk **Rumah A**, detail fasilitas lengkap belum tersedia di sistem saya
saat ini. Mau saya bantu hubungkan dengan agent untuk informasi lebih
lengkap?"
```

## Field Konteks Tambahan dari Backend

Backend mungkin menyertakan field tambahan untuk konteks:

```text
distance_from_user_location  → "5 km dari lokasi Anda"
walking_distance_to_landmark → "10 menit jalan ke Tunjungan Plaza"
match_score                  → 0.0 – 1.0 (untuk urutan)
match_reason                 → ["matches location", "matches budget"]
```

Claude bisa pakai field ini untuk membuat respons lebih kaya:

```text
"**Rumah Tembuku Asri** — hanya 10 menit jalan kaki dari Tunjungan Plaza,
sangat cocok dengan kebutuhan Anda."
```

## Ringkasan: Apa yang Boleh & Tidak Boleh

| Boleh                                          | Tidak Boleh                            |
|------------------------------------------------|----------------------------------------|
| Tampilkan nama, harga, tipe, lokasi dari data | Mengarang properti yang tidak ada      |
| Sebut fasilitas yang tercantum di data        | Mengarang fasilitas yang tidak ada     |
| Sebut area/kecamatan                          | Membocorkan alamat lengkap di chat     |
| Sebut keberadaan foto                         | Membagikan URL foto                    |
| Sarankan eskalasi ke agent untuk kontak       | Membagikan no HP owner/agent langsung  |
| Format harga dengan rapi (Rp 1.250.000)       | Tampilkan angka mentah (1250000)       |
| Terjemahkan tipe ke bahasa user               | Pakai value enum apa adanya ("house")  |

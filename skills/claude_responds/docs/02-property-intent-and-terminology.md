# 02 — Property Intent and Terminology

File ini berisi pemetaan istilah yang dipakai user → istilah katalog yang dipahami Claude.

## Intent Transaksi

Mapping kata user ke nilai transaksi:

| Istilah user                | Arti                | Nilai transaksi |
|-----------------------------|---------------------|-----------------|
| sewa, disewakan, kontrak    | rent                | `rent`          |
| kontrakan                   | rumah untuk disewa  | `rent`          |
| ngekos, cari kos            | sewa kos            | `rent`          |
| beli, membeli, mau beli     | buy / purchase      | `sale`          |
| jual, dijual, menjual       | sell / sale         | `sale`          |
| over-kredit                 | beli (anggap sale)  | `sale`          |
| rent, lease, renting        | rent                | `rent`          |
| buy, purchase, purchasing   | buy                 | `sale`          |
| sell, selling, for sale     | sell                | `sale`          |

**Catatan:** Dalam skill ini, intent transaksi disederhanakan menjadi dua nilai saja: `sale` dan `rent`. Lihat `12-transaction-scope-rent-sale.md`.

## Mapping Tipe Properti

| Istilah user                          | Tipe              |
|---------------------------------------|-------------------|
| rumah, house                          | `house`           |
| rumah kontrakan, kontrakan            | `house` (rent)    |
| villa, vila                           | `villa`           |
| hotel                                 | `hotel`           |
| apartemen, apart, apartment, apt      | `apartment`       |
| kondominium, kondo                    | `apartment`       |
| kos, kos-kosan, tempat kos            | `boarding_house`  |
| kamar kos                             | `boarding_house`  |
| boarding house, boarding room         | `boarding_house`  |
| ruko                                  | `shophouse`       |
| shophouse                             | `shophouse`       |
| kantor, office                        | `office`          |
| gudang, warehouse                     | `warehouse`       |
| toko, store, kios                     | `store`           |
| lainnya, lain-lain                    | `others`          |

## Nilai Tipe Bangunan (Building Type)

Gunakan nilai berikut saat menginterpretasi data katalog:

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

## Nilai Tipe Transaksi

```text
sale
rent
```

Hanya dua nilai. Tidak ada `purchase` terpisah — pembelian masuk ke `sale` (dari sisi data: properti yang dijual).

## Aturan Kos-Kosan

- `kos`, `kos-kosan`, `tempat kos`, `boarding house` → tipe `boarding_house`
- `kamar kos` → tetap `boarding_house` (level kamar tetap di bawah tipe boarding house)
- Sewa kos hanya transaksi `rent`, tidak ada `sale` untuk kamar kos

## Aturan Ruko vs Toko

- `ruko` (rumah toko) → `shophouse` (bangunan berlantai 2+ dengan toko di bawah)
- `toko`, `kios` saja → `store` (unit toko, biasanya tanpa hunian di atas)

Jika user tidak jelas, Claude bisa bertanya: "Apakah Anda mencari ruko (rumah-toko) atau toko/unit kios saja?"

## Periode Harga (Price Unit)

Periode harga yang dikenali untuk transaksi sewa:

```text
per malam      / per night    → biasanya hotel, villa harian
per hari       / per day
per minggu     / per week
per bulan      / per month    → standar untuk kos, apartemen
per tahun      / per year     → standar untuk rumah, ruko sewa
```

Untuk transaksi jual, harga selalu total (tanpa periode).

## Contoh Pemetaan Pesan ke Intent

**Pesan 1:**
```
"Cariin kontrakan murah di Surabaya"
```
Hasil deteksi:
- Transaksi: `rent`
- Tipe: `house`
- Lokasi: Surabaya
- Budget: tidak spesifik, "murah" (ajukan klarifikasi range)

**Pesan 2:**
```
"Saya mau beli ruko 2 lantai di area Wonokromo"
```
Hasil deteksi:
- Transaksi: `sale`
- Tipe: `shophouse`
- Lokasi: Wonokromo
- Lantai: 2
- Budget: belum disebut

**Pesan 3:**
```
"Ada kos cewek deket UB Malang?"
```
Hasil deteksi:
- Transaksi: `rent`
- Tipe: `boarding_house`
- Lokasi: Malang (dekat Universitas Brawijaya)
- Penghuni: perempuan (lihat aturan occupancy di doc 06)

**Pesan 4:**
```
"Looking for apartment for rent near Tunjungan Plaza, max 5 million/month"
```
Hasil deteksi:
- Transaksi: `rent`
- Tipe: `apartment`
- Lokasi: Surabaya (dekat Tunjungan Plaza)
- Budget: max 5 juta/bulan
- Bahasa: Inggris → balas bahasa Inggris

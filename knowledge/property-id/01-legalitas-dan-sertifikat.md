# Legalitas & Sertifikat Properti Indonesia

⚠️ **PERINGATAN AKURASI**: istilah dan jenis sertifikat di bawah relatif stabil,
tapi PROSEDUR, BIAYA, dan PERSYARATAN teknis (mis. syarat konversi HGB→SHM,
biaya notaris/PPAT) bisa berubah dan berbeda antar daerah/kantor pertanahan.
AI WAJIB mengarahkan pertanyaan detail/teknis ke agent/tim, TIDAK PERNAH
memberikan kepastian hukum atas satu kasus spesifik customer.

## Jenis Sertifikat Kepemilikan Utama

- **SHM (Sertifikat Hak Milik)** — bukti kepemilikan TERTINGGI dan TERKUAT,
  berlaku SELAMANYA tanpa batas waktu. Hanya WNI perorangan yang boleh
  memegang SHM (badan hukum tidak bisa). Paling umum untuk RUMAH tapak.
- **SHGB (Sertifikat Hak Guna Bangunan)** — hak memakai/mendirikan bangunan
  di atas tanah negara atau tanah milik pihak lain, masa berlaku TERBATAS
  (umumnya 30 tahun, bisa diperpanjang). Umum untuk rumah di kompleks
  developer, ruko, dan properti komersial. Bisa ditingkatkan (dikonversi)
  menjadi SHM dengan syarat tertentu.
- **SHSRS / SHMSRS (Sertifikat Hak Milik atas Satuan Rumah Susun)** — bukti
  kepemilikan sah untuk UNIT hunian vertikal (apartemen/kondominium/rusun
  komersial). Berbeda dari SHM tanah biasa karena obyeknya satuan unit dalam
  bangunan bersama, bukan sebidang tanah utuh.

## Dokumen Pendukung Transaksi

- **AJB (Akta Jual Beli)** — bukti sah pengalihan hak dalam transaksi jual
  beli, dibuat oleh PPAT (Pejabat Pembuat Akta Tanah). Langkah WAJIB sebelum
  balik nama sertifikat ke pembeli baru.
- **PPJB (Perjanjian Pengikatan Jual Beli)** — perjanjian awal/pengikatan
  sebelum AJB resmi bisa dibuat (mis. properti masih dalam proses KPR/lunas
  bertahap, atau sertifikat induk developer belum pecah per unit).
- **Roya** — proses pencoretan catatan hak tanggungan (agunan bank) di
  sertifikat setelah KPR/kredit lunas — WAJIB dilakukan agar sertifikat
  benar-benar "bersih" sebelum dijual lagi.
- **SPPT PBB (Surat Pemberitahuan Pajak Terhutang – Pajak Bumi & Bangunan)**
  — bukti tagihan/pembayaran pajak tahunan atas tanah & bangunan. Riwayat
  pembayaran PBB yang rapi adalah salah satu indikator legalitas properti.
- **PBG (Persetujuan Bangunan Gedung)** — pengganti IMB (Izin Mendirikan
  Bangunan) sejak UU Cipta Kerja — bukti bangunan berdiri sesuai aturan tata
  ruang.
- **SLF (Sertifikat Laik Fungsi)** — bukti bangunan sudah diperiksa dan layak
  dihuni/dipakai sesuai fungsinya, umumnya untuk bangunan bertingkat/komersial.

## Aturan berlaku di `properties.certificate_type` (lihat models/Property.js)

- **Sewa (rent)**: sertifikat kepemilikan TIDAK relevan bagi penyewa — hanya
  `KOSONG` / `LAINNYA` (atau kosong/null) yang masuk akal.
- **Beli (sale)**: `KOSONG` / `LAINNYA` / `SHM` / `SHGB` / `SHSRS`.

## Batasan Peran AI (WAJIB dipatuhi)

- AI BOLEH menjelaskan ARTI istilah (SHM, SHGB, SHSRS, AJB, PBG, dll.) secara
  umum ketika customer bertanya — ini topik EDUKASI, bukan nasihat hukum
  personal, dan TIDAK dianggap off-topic walau muncul di tengah alur
  kualifikasi properti.
- AI TIDAK PERNAH memastikan status legal SATU properti spesifik tanpa
  verifikasi dokumen asli — arahkan ke agent/tim untuk pengecekan resmi.
- AI TIDAK PERNAH menyarankan jalan pintas hukum (jual-beli di bawah tangan
  tanpa AJB, dsb).

**Sumber rujukan umum**: ATR/BPN (atrbpn.go.id) dan panduan properti seperti
99.co — dipakai sebagai referensi umum, BUKAN nasihat hukum untuk kasus
spesifik.

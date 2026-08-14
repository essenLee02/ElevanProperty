# Proses Transaksi, Pajak & Biaya Jual-Beli Properti

> **Korpus RAG — bukan skill doc.**
>
> ⚠️ **PERINGATAN AKURASI (WAJIB DIPATUHI AI):** tarif pajak, NPOPTKP, dan biaya
> notaris **berbeda antar kabupaten/kota dan berubah antar tahun**. Angka di
> bawah adalah acuan umum untuk MENJELASKAN KOMPONEN biaya, bukan kutipan resmi.
> Setiap kali menyebut angka, AI **wajib** menambahkan bahwa besaran final
> dihitung notaris/PPAT sesuai daerah dan aturan yang berlaku saat transaksi.
> JANGAN pernah menyebut total rupiah pasti untuk kasus customer tertentu.

---

## Alur Standar Pembelian Properti Second (Non-Developer)

1. **Survey & penawaran** — pembeli melihat unit, mengajukan harga.
2. **Negosiasi & kesepakatan harga.**
3. **Booking fee / tanda jadi** — mengunci unit. Besarannya kesepakatan; pastikan
   hitam di atas putih apakah **hangus atau dikembalikan** bila batal.
4. **Pengecekan sertifikat ke BPN** — dilakukan PPAT. Tahap ini tidak boleh
   dilewati.
5. **PPJB** (bila pembayaran bertahap atau menunggu KPR cair).
6. **Pengajuan KPR** (bila tidak tunai) — appraisal bank, SLIK, verifikasi.
7. **Pelunasan pajak** — BPHTB oleh pembeli, PPh final oleh penjual.
8. **AJB di hadapan PPAT** — kepemilikan berpindah.
9. **Balik nama di BPN** — sertifikat atas nama pembeli.
10. **Serah terima fisik** unit dan kunci.

## Alur Pembelian dari Developer (Primary)

1. Booking fee / NUP (Nomor Urut Pemesanan).
2. Pembayaran **DP** sesuai skema developer.
3. **PPJB** dengan developer.
4. Akad KPR (bila kredit) — sering difasilitasi developer dengan bank rekanan.
5. Pembangunan / serah terima unit.
6. **AJB + balik nama** — biasanya setelah bangunan selesai dan sertifikat induk
   sudah dipecah.

> ⚠️ Pada pembelian inden, jeda antara PPJB dan AJB bisa bertahun-tahun.
> Rekam jejak developer menjadi faktor risiko utama — ini bahan diskusi dengan
> tim, bukan penilaian yang boleh dibuat AI sendiri.

---

## Pajak & Biaya — Siapa Menanggung Apa

### Ditanggung PENJUAL

**PPh Final atas pengalihan hak atas tanah/bangunan**
- Acuan umum: **2,5%** dari nilai bruto pengalihan (dasar: PP 34/2016).
- Untuk rumah sederhana/rumah susun sederhana yang dialihkan **oleh pengembang**
  yang usaha pokoknya itu, tarifnya lebih rendah (acuan **1%**).
- Dibayar **sebelum AJB** — bukti setornya syarat penandatanganan akta.

### Ditanggung PEMBELI

**BPHTB — Bea Perolehan Hak atas Tanah dan Bangunan**
- Acuan umum: **5%** dari **(NPOP − NPOPTKP)**.
- **NPOP** = nilai transaksi atau NJOP, dipakai yang **lebih tinggi**.
- **NPOPTKP** = nilai tidak kena pajak, **ditetapkan masing-masing daerah**,
  sehingga berbeda antar kota. Untuk perolehan karena **waris/hibah** biasanya
  ditetapkan lebih tinggi.
- Dibayar **sebelum AJB**.

**Biaya balik nama (PNBP pendaftaran peralihan hak)** — dihitung berdasarkan
formula resmi kantor pertanahan, nominalnya relatif kecil dibanding pajak.

**PPN** — berlaku pada pembelian dari **Pengusaha Kena Pajak** (umumnya developer),
bukan pada transaksi antar perorangan. Tarif PPN mengikuti aturan yang berlaku
saat transaksi dan sempat berubah beberapa tahun terakhir — **selalu konfirmasi
tarif terkini**, jangan mengutip dari ingatan.

**PPnBM** — hanya untuk properti yang masuk kategori sangat mewah sesuai ambang
batas yang ditetapkan pemerintah.

### Ditanggung BERSAMA / Kesepakatan

**Jasa notaris/PPAT** — mencakup pengecekan sertifikat, pembuatan akta, dan
pengurusan balik nama. Acuan umum berkisar **0,5%–1%** dari nilai transaksi dan
**bisa dinegosiasikan**. Siapa yang menanggung adalah **kesepakatan para pihak** —
tidak ada aturan baku; ini wajib dibicarakan di awal agar tidak jadi sengketa.

> **Kesalahan yang sering terjadi:** pembeli hanya menyiapkan dana sebesar harga
> properti, lalu kaget karena biaya di luar harga (BPHTB + notaris + provisi bank
> + asuransi) bisa mencapai kisaran **belasan persen** dari harga. Untuk pembeli
> pertama, mengingatkan hal ini di awal jauh lebih berguna daripada menyebut
> angka pasti.

---

## Sewa-Menyewa

- **PPh atas penghasilan sewa tanah/bangunan**: acuan umum **10%** final,
  umumnya dipotong/disetor sesuai ketentuan yang berlaku.
- **Deposit** biasanya 1 bulan sewa, dikembalikan setelah dikurangi kerusakan.
- Pembayaran sewa rumah di Indonesia lazimnya **tahunan di muka**; permintaan
  cicilan 6-bulanan menandakan keterbatasan dana — catat untuk agent, jangan
  dinilai atau dikomentari ke customer.
- Poin yang wajib jelas di perjanjian sewa: siapa menanggung **PBB**, **IPL**,
  perbaikan besar vs kecil, dan boleh/tidaknya menyewakan ulang.

---

## Istilah yang Sering Ditanya Customer

| Istilah | Arti singkat |
|---|---|
| **NJOP** | Nilai Jual Objek Pajak — nilai acuan pemerintah untuk PBB, sering di bawah harga pasar |
| **NPOPTKP** | Batas nilai perolehan yang tidak kena BPHTB, berbeda tiap daerah |
| **PBB** | Pajak Bumi dan Bangunan, tahunan, wajib lunas sebelum AJB |
| **Akad kredit** | Penandatanganan perjanjian kredit dengan bank |
| **Over kredit** | Pengalihan KPR berjalan ke pembeli baru — **wajib lewat bank**, jangan "bawah tangan" |
| **Take over KPR** | Memindahkan KPR ke bank lain, biasanya mengejar bunga lebih rendah |
| **Appraisal** | Penilaian bank atas nilai wajar properti; menentukan plafon kredit |
| **Hook / sudut** | Kavling di sudut, dua sisi menghadap jalan — biasanya lebih mahal |
| **Kavling matang** | Lahan siap bangun (sudah diratakan, ada akses & utilitas) |

> ⛔ **Over kredit "bawah tangan"** (tanpa persetujuan bank) sangat berisiko:
> sertifikat tetap atas nama pemilik lama dan pembeli tidak punya posisi hukum.
> Bila customer menyebut ini, sampaikan bahwa prosesnya harus lewat bank, lalu
> arahkan ke tim — jangan memberi panduan teknis melakukannya.

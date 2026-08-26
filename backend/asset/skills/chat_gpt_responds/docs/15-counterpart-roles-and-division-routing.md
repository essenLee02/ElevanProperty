# 15 — Counterpart Roles & Division Routing

> Dokumen ini memandu Platform AI (OpenRouter, ChatGPT, Claude, Qwen, DeepSeek, Kimi)
> dalam mengenali peran lawan bicara (*counterpart role*) dan menentukan meja/divisi staf
> internal mana (*Sales, Procurement, HRD, IT, Admin*) yang berwenang menangani percakapan.

---

## 1. Dua Keputusan pada Setiap Pesan

Pada setiap pesan masuk yang memerlukan tindak lanjut staf internal, terdapat dua hal yang diidentifikasi:

| Keputusan | Pertanyaan yang Dijawab | Kategori |
|---|---|---|
| **Role (Peran)** | Siapa lawan bicara ini bagi perusahaan? | `Customer`, `Supplier`, `Applican`, `Visitor`, `Insurance Agent`, `Unknown` |
| **Division (Divisi)** | Meja staf mana yang menangani topik ini? | `Sales`, `Procurement`, `HRD`, `IT`, `Admin` |

---

## 2. Definisi 5 Peran Lawan Bicara (Roles)

| Role | Keterangan | Contoh Pesan Pembuka |
|---|---|---|
| `Customer` | Calon pembeli, penyewa, atau pencari properti; atau komplain terkait transaksi properti | *"Mau sewa rumah di Surabaya"*, *"Ada apartemen 2BR dekat Pakuwon?"* |
| `Supplier` | Penjual material bangunan, jasa renovasi, perabot/furnitur, atau perlengkapan | *"Kami supplier semen dan bata ringan siap suplai proyek"*, *"Menawarkan jasa interior"* |
| `Applican` | Penanya lowongan kerja, pelamar agen properti, staf, atau magang | *"Ada lowongan untuk agen properti baru?"*, *"Mau kirim CV untuk admin"* |
| `Visitor` | Pihak yang meminta kunjungan kantor, audiensi, atau temu janji resmi instansi | *"Mau mengajukan jadwal kunjungan studi banding ke kantor"* |
| `Insurance Agent` | Agen yang menawarkan produk asuransi (aset bangunan atau perlindungan karyawan) | *"Menawarkan perlindungan asuransi kebakaran untuk gudang"* |

> ⚠️ **Catatan Penulisan `Applican`:** Format penamaan peran menggunakan istilah konsisten sistem (`Applican`). Jika peran belum teridentifikasi jelas, biarkan sebagai `Unknown`.

---

## 3. Tabel Perutean Divisi Staf (Division Routing Table)

| Topik / Kategori Percakapan | Divisi Tujuan | Alasan Penanganan |
|---|---|---|
| **Pencarian Properti (Sewa / Beli / Booking)** | **Sales** | Tim Sales yang menguasai katalog listing, negosiasi, kualifikasi, dan closing. |
| **Komplain / Pertanyaan Transaksi Properti** | **Sales** | Tim Sales yang bertanggung jawab atas riwayat transaksi dan hubungan klien. |
| **Penawaran Barang, Material & Jasa Vendor** | **Procurement** | Tim Pengadaan yang memutuskan kebutuhan material, perabot, dan kontrak vendor. |
| **Asuransi Aset / Properti / Gedung** | **Procurement** | Keputusan pengadaan perlindungan aset fisik perusahaan/properti. |
| **Asuransi Karyawan / BPJS Ketenagakerjaan** | **HRD** | Urusan benefit dan perlindungan kesehatan/tenaga kerja karyawan. |
| **Lowongan Kerja, Rekrutmen Agen & Staf** | **HRD** | Divisi HRD yang memegang data formasi lowongan kerja dan proses seleksi. |
| **Keluhan Internal Staf / Manajemen SDM** | **HRD** | Urusan hubungan industrial dan kepegawaian internal. |
| **Kendala Teknis Website, Bot & Sistem IT** | **IT** | Tim IT yang menangani perbaikan bug, error aplikasi, dan infrastruktur sistem. |
| **Kunjungan Kantor, Jadwal Ruang, Surat Resmi** | **Admin** | Tim Administrasi yang mengelola perizinan akses tamu dan agenda kantor. |

---

## 4. Aturan Penanganan Respon per Divisi

### A. Topik Sales (Properti)
- **Tindakan AI:** Lanjutkan kualifikasi Q1–Q14 secara penuh, tanyakan detail kebutuhan satu per satu, dan tampilkan summary brief setelah lengkap.

### B. Topik Procurement (Penawaran Supplier / Vendor)
- **Tindakan AI:** Tanggapi dengan sopan, catat nama vendor, jenis produk/jasa yang ditawarkan, dan sampaikan bahwa informasi akan diteruskan ke tim **Procurement**.
- **Contoh Balasan:**
  ```text
  Terima kasih atas penawarannya, Kak. 🙏
  Informasi produk/jasa dari Kakak telah saya catat dan akan saya teruskan ke tim Procurement kami untuk dipelajari lebih lanjut. Jika ada kebutuhan yang sesuai, tim kami akan segera menghubungi Kakak kembali.
  ```

### C. Topik HRD (Lowongan Kerja / Karir)
- **Tindakan AI:** Berikan respon hangat, tanyakan posisi yang diminati dan nama pelamar, lalu arahkan ke tim **HRD**.
- **Contoh Balasan:**
  ```text
  Halo Kak! Terima kasih atas ketertarikannya bergabung bersama Elevan Property. 😊
  Pertanyaan/lamaran Kakak akan saya teruskan ke tim HRD kami. Silakan sebutkan posisi yang diminati dan nama Kakak, atau kirimkan resume/CV agar dapat ditinjau oleh tim rekrutmen kami.
  ```

### D. Topik IT (Kendala Teknis / Dukungan Sistem)
- **Tindakan AI:** Akui kendala teknis secara empatik, minta detail error/kendala, dan informasikan bahwa tim **IT Support** sedang mengeceknya.
- **Contoh Balasan:**
  ```text
  Mohon maaf atas ketidaknyamanannya, Kak. 🙏
  Laporan kendala teknis ini sudah saya teruskan ke tim IT kami untuk segera diperiksa dan diperbaiki.
  ```

### E. Topik Admin (Kunjungan Kantor / Izin Tamu)
- **Tindakan AI:** Catat tanggal rencana kunjungan, instansi/keperluan, dan sampaikan bahwa tim **Admin** akan mengonfirmasi jadwal ketersediaan.
- **Contoh Balasan:**
  ```text
  Terima kasih atas informasinya, Kak. 🙏
  Rencana kunjungan dan agenda Kakak sudah saya catat untuk dikoordinasikan dengan tim Administrasi terkait jadwal dan perizinan ruang. Tim kami akan segera mengonfirmasi kembali.
  ```

---

## 5. Hubungan dengan Guardrails & Token-Saving

1. **Penyaringan Awal Backend (Platform Guardrail):**
   - Backend melakukan pra-seleksi murah untuk membuang spam non-teks dan pesan berulang demi menghemat token API.
2. **Wewenang Penuh Platform AI:**
   - Begitu pesan lolos ke Platform AI (OpenRouter, ChatGPT, Claude, Qwen, DeepSeek, Kimi), platform membaca dokumen ini untuk menentukan apakah pesan merupakan urusan **Sales**, **Procurement**, **HRD**, **IT**, **Admin**, atau pesan yang harus didiamkan dengan `[[OFFTOPIC_SILENT]]`.
3. **Fallback ke Private Agent:**
   - Jika platform AI mengalami error/timeout/kehabisan saldo, backend (`chatbotPrivateController.js`) mengambil alih penanganan percakapan secara otomatis.

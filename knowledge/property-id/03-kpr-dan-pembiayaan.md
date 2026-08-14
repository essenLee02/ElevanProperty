# KPR & Pembiayaan Properti

> **Korpus RAG — bukan skill doc.**
>
> ⚠️ **BATAS PERAN AI (WAJIB):** AI **tidak memberi nasihat keuangan**, tidak
> menjanjikan approval, tidak menghitung kelayakan kredit customer, dan **tidak
> menanyakan penghasilan, SLIK, utang, atau data pekerjaan lewat chat**. Semua
> itu ranah agent pada panggilan langsung dan pihak bank (lihat pilot house —
> "KPR sub-flow bukan underwriting"). Yang boleh dilakukan AI: **menjelaskan
> istilah dan alur**, lalu mencatat minat + kesiapan kasar untuk agent.

---

## Jenis Pembiayaan

### Cash / Tunai Keras
Pembayaran penuh tanpa kredit. Posisi tawar paling kuat, proses paling cepat,
dan tidak ada biaya bank. Pembeli cash adalah lead paling siap — **jangan pernah
ditolak** meski profil agent disetel untuk KPR.

### Cash Bertahap
Cicilan **langsung ke developer/penjual** tanpa bank, umumnya tenor pendek
(12–36 bulan). Tidak ada bunga bank, tetapi syarat dan denda ditentukan penjual —
harus dibaca teliti.

### KPR Konvensional
Kredit bank dengan **bunga**.
- **Fixed rate**: bunga tetap untuk periode awal (mis. 1–5 tahun).
- **Floating rate**: bunga mengikuti pasar setelah masa fixed berakhir — inilah
  yang sering membuat cicilan **naik tajam** setelah tahun-tahun awal.
- Tenor umumnya hingga **15–25 tahun**, dibatasi juga oleh usia pemohon saat
  kredit lunas.

> ⚠️ Penjelasan paling berguna untuk pembeli pertama: **cicilan tahun pertama
> bukan cicilan selamanya.** Tanyakan berapa lama masa fixed dan berapa perkiraan
> setelah floating. Ini pertanyaan yang menyelamatkan banyak orang.

### KPR Syariah
Tanpa bunga; memakai akad sesuai prinsip syariah.
- **Murabahah** — bank membeli lalu menjual ke nasabah dengan margin disepakati;
  angsuran **tetap sampai lunas** (tidak terpengaruh naik-turun bunga pasar).
- **Musyarakah Mutanaqisah** — kepemilikan bersama yang porsinya berpindah
  bertahap ke nasabah.
- **IMBT** — sewa yang diakhiri perpindahan kepemilikan.

Kelebihan utama: **kepastian angsuran**. Perbandingan total biaya dengan
konvensional tergantung tenor dan margin — jangan mengklaim salah satunya pasti
lebih murah.

### KPR Subsidi (FLPP dan skema pemerintah lain)
- Untuk **rumah pertama** bagi masyarakat berpenghasilan rendah.
- Ciri: **suku bunga rendah tetap sepanjang tenor**, DP ringan, dan ada **batas
  maksimal harga rumah** serta **batas penghasilan** pemohon.
- Rumah subsidi memiliki **larangan menjual/menyewakan dalam jangka waktu
  tertentu** — penting disampaikan bila customer bicara investasi.
- Kuota, plafon harga, dan batas penghasilan **berubah tiap tahun** dan berbeda
  per wilayah — arahkan ke tim untuk angka yang berlaku sekarang.

---

## Komponen yang Menentukan Persetujuan

### DP (Uang Muka)
- Besarnya dipengaruhi kebijakan **LTV (Loan to Value)** Bank Indonesia yang
  bisa dilonggarkan/diperketat sewaktu-waktu, serta kebijakan internal bank.
- Acuan umum di pasar: **10%–30%**, dengan kemungkinan lebih ringan untuk rumah
  pertama pada periode pelonggaran LTV.
- **DP lebih besar → plafon lebih aman disetujui, cicilan lebih ringan.**

### SLIK OJK *(dahulu dikenal sebagai "BI Checking")*
Rekam jejak kredit pemohon.
- Menampilkan riwayat pembayaran seluruh fasilitas kredit — termasuk kartu
  kredit dan paylater.
- Tunggakan yang belum selesai adalah **penyebab penolakan KPR paling umum**.
- **AI tidak boleh menanyakan atau menilai SLIK customer.** Bila customer
  menyinggung, cukup akui dan alihkan: itu dibahas bersama agent/bank.

### Appraisal (Penilaian Bank)
- Bank menilai sendiri nilai wajar properti; **plafon dihitung dari nilai
  appraisal, bukan dari harga kesepakatan**.
- Bila appraisal **di bawah** harga beli, selisihnya harus ditambal pembeli
  sebagai DP tambahan. Ini kejutan yang sering muncul di menit terakhir.

### Rasio Angsuran terhadap Penghasilan
Bank umumnya membatasi total cicilan pada kisaran **sepertiga sampai
empat-puluh persen** penghasilan bersih. Angka pastinya kebijakan tiap bank.
Sampaikan sebagai gambaran umum saja — **jangan menghitungkan untuk customer**.

---

## Biaya Bank di Luar Harga Properti

| Komponen | Catatan |
|---|---|
| Provisi | Persentase kecil dari plafon, dipotong di awal |
| Biaya administrasi | Nominal tetap sesuai ketentuan bank |
| Appraisal | Biaya jasa penilai |
| Asuransi jiwa | Wajib, preminya naik seiring usia pemohon |
| Asuransi kebakaran | Wajib selama masa kredit |
| Biaya notaris akad kredit | Terpisah dari notaris AJB |

> Bersama BPHTB dan biaya AJB, komponen ini membuat **dana yang harus disiapkan
> di luar harga rumah** jauh lebih besar daripada perkiraan awal kebanyakan
> pembeli pertama.

---

## Take Over & Over Kredit

- **Take over KPR**: memindahkan kredit ke bank lain (umumnya mengejar bunga
  lebih rendah). Sah, tetapi ada biaya penalti pelunasan dipercepat di bank asal
  dan biaya akad baru di bank tujuan.
- **Over kredit resmi**: pembeli baru mengambil alih KPR **melalui bank**, dengan
  akad baru atas namanya. Aman.
- **Over kredit bawah tangan**: kesepakatan pribadi tanpa bank. **Sangat
  berisiko** — sertifikat dan kredit tetap atas nama pemilik lama, pembeli tidak
  punya perlindungan hukum bila terjadi sengketa atau pemilik lama wanprestasi.

> ⛔ Bila customer menanyakan cara over kredit bawah tangan, jangan berikan
> panduan teknisnya. Jelaskan risikonya secara singkat dan arahkan ke tim.

---

## Cara AI Menangani Topik Pembiayaan (ringkas)

| Situasi | Tindakan AI |
|---|---|
| Customer tanya "KPR itu apa / beda syariah?" | Jelaskan singkat dari korpus ini |
| Customer tanya "cicilan saya berapa?" | **Jangan hitung.** Jelaskan faktor penentunya, arahkan ke tim untuk simulasi |
| Customer tanya "saya bisa approve gak?" | **Jangan menilai.** Sampaikan bahwa itu keputusan bank, agent bisa bantu siapkan berkas |
| Customer sebut bank tertentu | Akui dan catat sebagai preferensi, konfirmasi agent bisa bantu, lanjut ke slot berikutnya |
| Customer minta bantuan proses KPR | **Jawab YA lebih dulu**, baru lanjut pertanyaan berikutnya — jangan lewati pertanyaan langsung customer |
| Customer sebut cash dari hasil jual aset | Catat sebagai kontingensi: tanya asetnya **sudah terjual atau masih proses** |

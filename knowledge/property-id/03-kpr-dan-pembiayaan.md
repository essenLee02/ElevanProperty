# KPR & Pembiayaan Properti Indonesia

⚠️ **PERINGATAN AKURASI**: suku bunga, syarat DP, plafon, dan tenor KPR
BERBEDA antar bank dan BERUBAH sewaktu-waktu mengikuti kebijakan bank/BI/
pemerintah. Angka di bawah adalah GAMBARAN UMUM kategori, BUKAN penawaran
resmi dari bank mana pun. AI WAJIB mengarahkan detail/angka pasti ke
agent/tim atau langsung ke bank — TIDAK PERNAH menyimulasikan cicilan atau
menilai kelayakan kredit customer.

## Jenis KPR di Indonesia

- **KPR Subsidi** — program bantuan pemerintah (mis. skema FLPP/Fasilitas
  Likuiditas Pembiayaan Perumahan) dengan bunga rendah TETAP sepanjang
  tenor, ditujukan untuk masyarakat berpenghasilan rendah (ada batas
  penghasilan maksimal & harga rumah maksimal yang memenuhi syarat).
  Termasuk juga varian KPR SYARIAH subsidi.
- **KPR Nonsubsidi / Konvensional** — layanan komersial bank umum, bunga
  bisa fixed/floating tergantung produk, plafon & tenor lebih fleksibel,
  tanpa batas penghasilan.
- **KPR Syariah** — menggunakan akad (mis. murabahah) alih-alih bunga,
  tersedia baik versi subsidi maupun komersial.
- **Over kredit** — pengalihan KPR berjalan dari debitur lama ke debitur
  baru. WAJIB dilakukan RESMI lewat bank (over kredit "bawah tangan" tanpa
  sepengetahuan bank berisiko hukum & finansial tinggi bagi kedua pihak —
  AI tidak pernah menyarankan opsi ini).

## Syarat Umum Pengajuan KPR

- WNI, umumnya minimal usia 21 tahun atau sudah menikah.
- Punya pekerjaan/penghasilan rutin (karyawan tetap, wiraswasta dengan
  bukti penghasilan, atau profesional).
- Dokumen umum: KTP, NPWP, slip gaji/bukti penghasilan, rekening koran/
  mutasi rekening.
- Uang muka (DP) — persentase minimal ditentukan bank & jenis KPR (subsidi
  vs komersial berbeda).

## `properties.kpr_status` / `kpr_dp_percent` / `kpr_installment_estimate`

Field-field ini di database HANYA berisi angka MARKETING/perkiraan dari
listing developer atau agent (mis. "Cicilan mulai dari 24,7 Jutaan" yang
biasa muncul di listing) — BUKAN simulasi kredit resmi bank, dan BUKAN
jaminan angka yang akan diterima customer setelah pengajuan nyata.

## Batasan Peran AI (WAJIB dipatuhi — paling penting di berkas ini)

- AI BOLEH menjelaskan APA itu KPR subsidi/nonsubsidi/syariah dan syarat
  UMUMNYA — ini edukasi umum, dan TETAP dalam topik properti walau bukan
  langsung soal listing.
- AI TIDAK PERNAH menghitung simulasi cicilan bulanan customer (bergantung
  suku bunga, tenor, kebijakan bank yang berubah-ubah dan berbeda per bank).
- AI TIDAK PERNAH menilai/memastikan kelayakan kredit (approval) customer.
- AI TIDAK PERNAH meminta data finansial sensitif customer (slip gaji, NIK
  lengkap, nomor rekening) lewat chat untuk "dicek kelayakannya" — proses
  KPR sesungguhnya HARUS lewat bank/agent langsung, bukan chatbot.
- Jika customer bertanya "apakah saya bisa KPR" atau minta simulasi angka
  → jawab edukatif singkat (jenis KPR & syarat umum), lalu arahkan ke
  agent/bank untuk simulasi & pengajuan resmi.

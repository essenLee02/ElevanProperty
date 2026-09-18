'use strict';
/**
 * M203 (16 Sep 2026) — 3 sesi BARU untuk menguji jalur Claude + CLAUDE_SKILL_ID
 * (skill dibaca dari Claude Platform, .md lokal tidak dikirim). Ketiganya
 * menyentuh 7 poin pemilik proyek: slot properti, dokumen legal (istilah vs
 * cek unit), survei + pindahan + jarak, guardrail/typo/dedup, identitas &
 * eskalasi, rekomendasi alternatif, dan agenda customer di atas interview.
 *
 *   SIM_FILE=./sim-scenarios-claude-skill.js node scripts/simulate-platform-skill.js private
 *
 * Nama sesi diawali K (Klaude) supaya tidak bentrok dengan P/X/Y/Z.
 */
module.exports = [
  {
    // Orang tua menyewakan apartemen untuk anak kuliah: SHMSRS = istilah (bukan cek unit),
    // furnished, minta 3 unit (2 + 1 kumulatif), jarak dari Malang, pindahan ikut kalender kuliah.
    name: 'K1 — Sewa apartemen Surabaya untuk anak kuliah; istilah SHMSRS; 3 unit kumulatif; jarak dari Malang',
    phone: '6280000061001', customer: 'Bu Ratna',
    turns: [
      'Selamat siang, sy cari apartemen sewa di Surabaya buat anak sy yg mau kuliah di Unair.',
      'Dkt kampus B Unair kalau bisa, area Gubeng atau sekitarnya.',
      'Apa itu SHMSRS? Beda sama SHM?',
      'Yg furnished ya, anaknya nggak bawa apa2.',
      'Ada 3 unit nggak? Biar bisa dibandingkan.',
      'Yg nomor 2 itu ada dapurnya? Sama kamarnya berapa?',
      'Kalau dari Malang ke situ kira2 brp jam?',
      'Anaknya baru masuk Februari tahun depan, sewa 1 tahun.',
      'Budget maksimal 4 jt per bulan, lebih dari itu berat.',
      'Survei sabtu depan bisa? Sy sama suami ke Surabaya.',
      'Jam 10 pagi ya.',
      'Oke cukup, makasih infonya.',
    ],
  },
  {
    // Ruko untuk kafe: izin/zonasi, "surat hijau" (istilah), pilih unit lalu "sudah SHM?" (cek kartu),
    // jarak dari Gresik, TOLAK survei sampai Oktober (di luar kota) → ditunda, bukan dijadwalkan.
    name: 'K2 — Beli ruko Sidoarjo untuk kafe; zonasi; surat hijau; sertifikat unit terpilih; tolak survei sampai Oktober',
    phone: '6280000061002', customer: 'Pak Dimas',
    turns: [
      'Mau beli ruko di Sidoarjo buat buka kafe.',
      'Area Gedangan atau Waru, yg rame.',
      'Budget 2M, cash.',
      'Secara zonasi ruko itu boleh buat kafe kan? Perlu izin apa?',
      'Surat hijau itu apa sih? Aman nggak?',
      'Yg nomor 1 sudah SHM atau masih HGB?',
      'Parkirnya muat brp mobil? Lebar depannya brp meter?',
      'Kalau dari Gresik ke situ jauh nggak?',
      'Sy belum bisa survei, masih di luar kota sampai Oktober.',
      'Nanti sy kabari lagi kalau sudah balik ya.',
      'Boleh minta nomor agentnya langsung?',
      'Sip, terima kasih.',
    ],
  },
  {
    // Ekspatriat berbahasa Inggris: sewa rumah dekat pabrik, pet-friendly, PPJB vs AJB (istilah),
    // GANTI kota Gresik→Surabaya Barat (Citraland) tanpa reset budget/tipe, komplain foto tidak
    // cocok (klarifikasi dari kartu, bukan katalog ulang), tanggal pindah 1 Desember.
    name: 'K3 — Expat rent house near JIIPE Gresik; PPJB vs AJB; switch to Citraland Surabaya; photo complaint; move-in 1 Dec',
    phone: '6280000061003', customer: 'Mr. Tanaka',
    turns: [
      'Hi, I am relocating for work near JIIPE Gresik. Looking to rent a house, 3 bedrooms.',
      'Budget around 60 million per year. Must be pet friendly, I have a dog.',
      'What is the difference between PPJB and AJB? My HR asked.',
      'Actually my wife prefers Surabaya, Citraland area. Can we look there instead?',
      'Is number 1 fully furnished? And does it have a garden for the dog?',
      'The photo you sent looks like a different house than the description. Which one is correct?',
      'Ok. How far is Citraland from JIIPE by car in the morning?',
      'We move in on 1 December. Lease 2 years if possible.',
      'Can we view it next Wednesday? My wife will join.',
      'Afternoon, around 2 pm.',
      'Is there a deposit? How many months?',
      'Great, that is all for now. Thank you.',
    ],
  },
];

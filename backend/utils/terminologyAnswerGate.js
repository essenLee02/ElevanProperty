/**
 * terminologyAnswerGate.js
 *
 * Jawaban DETERMINISTIK (bukan RAG, bukan LLM) untuk pertanyaan istilah
 * legal/pembiayaan properti (SHM/SHGB/KPR/dst.) — diekstrak dari
 * chatbotPrivateController.js#tryTerminologyAnswer() (M129) supaya bisa
 * dipakai ulang oleh whatsappAIService.js juga (M132).
 *
 * ⚠️ KENAPA DIPINDAH KE SINI (M132): #tryTerminologyAnswer() versi lama
 * hanya hidup di dalam chatbotPrivateController.js — tapi controller itu
 * CUMA dipanggil dari whatsappAIService.js SETELAH buildQualifyReply() lolos
 * (lihat _generateWhatsAppAIReplyCore). buildQualifyReply() sendiri me-return
 * lebih dulu SETIAP KALI salah satu dari 4 info minimum (tipe/transaksi/
 * lokasi/harga) belum ada — kondisi yang HAMPIR SELALU benar persis saat
 * customer baru bertanya "SHM itu apa" sebelum sempat menjawab sewa/beli.
 * Private Agent (dan #tryTerminologyAnswer() di dalamnya) tidak pernah
 * tercapai untuk kasus ini di produksi, walau tes unit M129
 * (tests/terminologyAnswerGate.test.js) tetap hijau — tes itu memanggil
 * generatePrivateTerminalMassege() LANGSUNG, melewati gerbang kualifikasi
 * yang sesungguhnya memblokir jalur produksi. Transkrip nyata 23-24 Agu 2026:
 * empat pertanyaan sertifikat berturut-turut dibalas pertanyaan Q1
 * ("sewa atau beli?") yang identik, tanpa pernah menjawab pertanyaannya.
 *
 * Dengan modul ini SATU fungsi dipakai di DUA titik (qual gate di
 * whatsappAIService.js DAN Private Agent di chatbotPrivateController.js) —
 * bukan mendupilkasi daftar istilah, kelas bug yang sama seperti M27/M77.
 *
 * @param {string} userMessage
 * @returns {string|null} Jawaban INTI (tanpa baris penutup "Ada pertanyaan
 *   lain...") — pemanggil menambahkan penutup/lanjutan sesuai konteksnya
 *   sendiri (Private Agent menutup dengan ajakan lanjut; qual gate
 *   menyambung dengan pertanyaan kualifikasi berikutnya).
 */
function tryTerminologyAnswer(userMessage) {
  const text = String(userMessage || '').toLowerCase();

  // ⚠️ GUARD WAJIB: hanya jawab bila pesan benar-benar sebuah PERTANYAAN.
  // Tanpa ini, customer yang menjawab "SHM" atas pertanyaan sertifikat yang
  // sedang berjalan ("mau SHM atau SHGB?") akan salah dianggap bertanya APA
  // ITU SHM, dan jawabannya sendiri sebagai pilihan sertifikat hilang.
  //
  // ⚠️ M132: `\bitu\s+apa\b` ditambahkan setelah verifikasi langsung terhadap
  // transkrip produksi nyata — pesan PERTAMA customer ("Blh tau SHM itu apa",
  // TANPA tanda tanya) memakai urutan kata "X itu apa" (lazim dalam Bahasa
  // Indonesia santai), BUKAN "apa itu X". Regex asli (M129) hanya mengenali
  // urutan "apa itu X" dan `?`/`apakah` eksplisit — pesan pemicu bug ini
  // sendiri TIDAK akan tertangkap tanpa tambahan pola ini (dibuktikan lewat
  // node -e langsung, bukan asumsi).
  const looksLikeQuestion = /\?|^apa\b|\bapa\s+itu\b|\bitu\s+apa\b|\bapakah\b|\bgimana\b|\bbagaimana\b|\bmaksudnya\b|\bartinya\b|\bbedanya\b|\bbeda\b.{0,15}\bsama\b|\bkenapa\b|what\s+is|how\s+does/i.test(text);
  if (!looksLikeQuestion) return null;

  // Pola per istilah, diurutkan agar frasa lebih spesifik (SHSRS/SHMSRS)
  // dicek sebelum yang lebih umum (SHM) supaya tidak salah cocok.
  const TERMS = [
    {
      re: /\bshsrs\b|\bshmsrs\b|sertifikat.{0,15}rumah\s+susun/,
      answer: 'SHSRS/SHMSRS (Sertifikat Hak Milik atas Satuan Rumah Susun) adalah bukti kepemilikan sah untuk UNIT hunian vertikal seperti apartemen/kondominium — obyeknya satu unit dalam bangunan bersama, bukan sebidang tanah utuh seperti SHM.',
    },
    {
      re: /\bshgb\b|hak\s+guna\s+bangunan/,
      answer: 'SHGB (Sertifikat Hak Guna Bangunan) adalah hak memakai/mendirikan bangunan di atas tanah negara atau tanah pihak lain, dengan masa berlaku TERBATAS (umumnya 30 tahun, bisa diperpanjang) — beda dari SHM yang berlaku selamanya. Umum untuk rumah di kompleks developer, ruko, dan properti komersial.',
    },
    {
      re: /\bshm\b|sertifikat\s+hak\s+milik/,
      answer: 'SHM (Sertifikat Hak Milik) adalah bukti kepemilikan properti TERTINGGI dan TERKUAT, berlaku SELAMANYA tanpa batas waktu. Hanya WNI perorangan yang bisa memegang SHM.',
    },
    {
      re: /\bajb\b|akta\s+jual\s+beli/,
      answer: 'AJB (Akta Jual Beli) adalah bukti sah pengalihan hak dalam transaksi jual-beli properti, dibuat oleh PPAT — wajib ada sebelum sertifikat bisa dibalik nama ke pembeli baru.',
    },
    {
      re: /\bppjb\b|perjanjian\s+pengikatan\s+jual\s+beli/,
      answer: 'PPJB (Perjanjian Pengikatan Jual Beli) adalah perjanjian awal sebelum AJB resmi bisa dibuat — biasanya dipakai saat properti masih dalam proses KPR/cicilan atau sertifikat induk developer belum pecah per unit.',
    },
    {
      re: /\broya\b/,
      answer: 'Roya adalah proses pencoretan catatan hak tanggungan (agunan bank) di sertifikat setelah KPR/kredit lunas — wajib dilakukan agar sertifikat benar-benar "bersih" sebelum dijual lagi.',
    },
    {
      re: /\bbphtb\b/,
      answer: 'BPHTB (Bea Perolehan Hak atas Tanah dan Bangunan) adalah pajak yang ditanggung PEMBELI saat perolehan hak atas properti, dihitung dari nilai transaksi/NJOP dikurangi batas bebas pajak (NPOPTKP) yang berbeda tiap daerah.',
    },
    {
      re: /\bpbg\b|persetujuan\s+bangunan\s+gedung/,
      answer: 'PBG (Persetujuan Bangunan Gedung) adalah pengganti IMB (Izin Mendirikan Bangunan) — bukti bangunan berdiri sesuai aturan tata ruang yang berlaku.',
    },
    {
      re: /\bslf\b|sertifikat\s+laik\s+fungsi/,
      answer: 'SLF (Sertifikat Laik Fungsi) adalah bukti bangunan sudah diperiksa dan dinyatakan layak dihuni/dipakai sesuai fungsinya — umumnya untuk bangunan bertingkat/komersial.',
    },
    {
      re: /\bkpr\b/,
      answer: 'KPR (Kredit Pemilikan Rumah) ada dua jenis utama: KPR SUBSIDI (mis. skema FLPP) — bunga rendah tetap, untuk penghasilan rendah, ada batas harga/penghasilan; dan KPR NONSUBSIDI/KONVENSIONAL — dari bank umum, lebih fleksibel, tanpa batas penghasilan. Syarat umum: WNI, penghasilan rutin, dan dokumen seperti KTP/NPWP/slip gaji.',
    },
  ];

  for (const { re, answer } of TERMS) {
    if (re.test(text)) return answer;
  }
  return null;
}

module.exports = { tryTerminologyAnswer };

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
function tryTerminologyAnswer(userMessage, options = {}) {
  const text = String(userMessage || '').toLowerCase();
  // M203 (16 Sep 2026): { lang: 'en' } → jawaban Inggris bila tersedia (answerEn);
  // "beda X sama Y?" / "difference between X and Y" → KEDUA istilah dijawab.
  const lang = String(options.lang || 'id').toLowerCase() === 'en' ? 'en' : 'id';
  const asksDifference = /\bbeda\w*\b|\bdifferen\w*\b|\bvs\.?\b|\bversus\b|\bcompared?\b|\bperbedaan\b/i.test(text);

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
  const looksLikeQuestion = /\?|^apa\b|\bapa\s+itu\b|\bitu\s+apa\b|\bapakah\b|\bgimana\b|\bbagaimana\b|\bmaksudnya\b|\bartinya\b|\bbedanya\b|\bbeda\b.{0,15}\bsama\b|\bkenapa\b|\bberapa\b|\bsiapa\b|what\s+is|what'?s|what\s+does|how\s+does|how\s+much|who\s+pays|difference\s+between|explain/i.test(text);
  if (!looksLikeQuestion) return null;

  /* M201 (16 Sep 2026) — PERTANYAAN PROSES BELI yang lazim, bukan definisi istilah dan
   * bukan data katalog: biaya notaris/PPAT, siapa bayar PBB/BPHTB, KPR DP minimal,
   * harga rata-rata. Simulasi: dibalas pertanyaan area berulang (agenda customer
   * diabaikan). Jawaban umum + serahkan angka pasti ke agent — tidak mengarang. */
  const PROCESS_QA = [
    { re: /\b(?:biaya|fee|tarif)\b[^.?!]{0,20}\b(?:notaris|ppat)\b|\bnotaris\b[^.?!]{0,20}\b(?:berapa|biaya)\b/,
      answer: 'Biaya notaris/PPAT umumnya sekitar 0,5–1% dari nilai transaksi (mencakup AJB, balik nama, dan cek sertifikat), tergantung notaris dan daerah. Angka pastinya dikonfirmasi agent kami bersama notaris rekanan sebelum transaksi.' },
    { re: /\bpbb\b[^.?!]{0,30}\b(?:siapa|bayar|tanggung)\b|\b(?:siapa|bayar|tanggung)\b[^.?!]{0,30}\bpbb\b/,
      answer: 'PBB (Pajak Bumi dan Bangunan) tahun berjalan biasanya ditanggung penjual sampai tanggal serah terima, lalu pembeli untuk tahun berikutnya — tetapi ini bisa disepakati di AJB. Agent kami bantu cek status PBB unit yang Kakak pilih.' },
    { re: /\bkpr\b[^.?!]{0,30}\b(?:dp|uang\s*muka)\b|\b(?:dp|uang\s*muka)\b[^.?!]{0,30}\b(?:minimal|berapa|persen)\b/,
      answer: 'DP KPR umumnya minimal 10–20% dari harga (bank tertentu ada program DP lebih rendah untuk rumah pertama); cicilan idealnya ≤30–35% penghasilan bulanan. Simulasi angka pastinya dibantu agent kami dengan bank rekanan.' },
    { re: /\b(?:rata[-\s]?rata|kisaran|range)\b[^.?!]{0,30}\bharga\b|\bharga\b[^.?!]{0,30}\b(?:rata[-\s]?rata|kisaran|pasaran)\b/,
      answer: null },   // dijawab dari katalog (gerbang area/harga), bukan angka umum
    // M202 — kepercayaan customer: legalitas agent, komisi, biaya tersembunyi, pajak rumah second, "bisa KPR?"
    { re: /\b(?:agent|agen)\w*\b[^.?!]{0,25}\b(?:resmi|legal|terdaftar|kantor\w*|terpercaya|bisa\s+dipercaya)\b|\b(?:resmi|legal|terdaftar)\b[^.?!]{0,15}\b(?:agent|agen)\b/,
      answer: 'Agent kami adalah agen properti terdaftar dengan kantor resmi — detail identitas, alamat kantor, dan nomor telepon kantornya akan dikirimkan agent kami langsung ke Kakak (saya asisten yang membantu mencatat kebutuhan). Semua transaksi dilakukan lewat notaris/PPAT, jadi pembayaran tidak pernah ke perorangan.' },
    { re: /\bkomisi\w*\b|\bfee\s+agen\w*\b/,
      answer: 'Komisi agen umumnya ditanggung PENJUAL (lazimnya 2-3% dari harga transaksi, sesuai kesepakatan penjual-agent); pembeli tidak dikenakan komisi. Untuk sewa, umumnya satu bulan sewa dari pemilik. Agent kami bisa jelaskan detailnya.' },
    { re: /\bbiaya\s+(?:tersembunyi|lain|tambahan|siluman)\b|\bhidden\s+(?:cost|fee)\b/,
      answer: 'Tidak ada biaya tersembunyi, Kak. Biaya resmi di luar harga rumah: BPHTB (pajak pembeli), biaya notaris/PPAT & balik nama, dan bila KPR: provisi/administrasi bank, appraisal, asuransi. Semua dirinci oleh notaris/bank sebelum tanda tangan.' },
    { re: /\b(?:rumah|properti)\s+second\b[^.?!]{0,20}\bpajak|\bpajak\w*\b[^.?!]{0,25}\b(?:rumah|properti)\s+second\b|\bkena\s+pajak\s+apa\b/,
      answer: 'Untuk rumah second: PEMBELI membayar BPHTB (umumnya 5% dari nilai transaksi/NJOP dikurangi NPOPTKP daerah), PENJUAL membayar PPh final (umumnya 2,5%). Ditambah biaya notaris/PPAT dan balik nama sertifikat. Angka pastinya dihitung notaris.' },
    { re: /\bzonasi\b|\bizin\s+usaha\b|\b(?:boleh|bisa)\s+(?:untuk|buat)\s+(?:usaha|kantor|cabang|toko|kafe|cafe|klinik|resto\w*)\b|\bsecara\s+(?:izin|perizinan|zonasi|peruntukan)\b|\b(?:izin|perizinan|peruntukan)(?:nya)?\s+(?:apa|gimana|bagaimana|boleh|bisa)\b/,
      answer: 'Untuk usaha (kafe/toko/kantor), rumah tinggal umumnya perlu cek zonasi tata ruang & izin (PBG/OSS) — beda tiap kelurahan. Ruko/rukan sudah berzona komersial. Agent kami bisa bantu cek zonasi unit yang Kakak minati sebelum transaksi.' },
    { re: /\bbisa\s+(?:pakai\s+|pake\s+)?kpr\b|\bkpr\s+bisa\b/,
      answer: 'Bisa, Kak 😊 Unit ini bisa diproses dengan KPR lewat bank rekanan (DP umumnya 10-20%, tenor sampai 15-20 tahun). Kalau Kakak sudah punya bank pilihan atau perkiraan DP, saya catat untuk agent kami.' },
    // M204 (18 Sep 2026) — sim K4/K3: "pajak jual belinya siapa yg tanggung?", "AJB aja aman
    // nggak? wajib SHM?", "Is there a deposit? How many months?" dibalas skrip/loop area.
    { re: /\bpajak\w*\b[^.?!]{0,40}\b(?:siapa|tanggung|bayar|ditanggung|persen|berapa)\b|\b(?:siapa|tanggung|bayar)\w*\b[^.?!]{0,30}\bpajak\b|\bwho\s+pays\b[^.?!]{0,30}\btax|\btax\w*\b[^.?!]{0,30}\b(?:who|how\s+much)\b/,
      answer: 'Pajak jual beli dibagi dua, Kak: PEMBELI menanggung BPHTB (umumnya 5% dari nilai transaksi/NJOP setelah dikurangi NPOPTKP daerah), PENJUAL menanggung PPh final (umumnya 2,5%). Biaya notaris/PPAT & balik nama biasanya pembeli, kecuali disepakati lain. Angka pastinya dihitung notaris — agent kami bantu rincikan untuk unit yang Kakak pilih.',
      answerEn: 'Sale taxes are split: the BUYER pays BPHTB (usually 5% of the transaction/NJOP value after the regional tax-free threshold), the SELLER pays final income tax (usually 2.5%). Notary/PPAT and title-transfer fees are normally the buyer\'s unless agreed otherwise. The notary computes the exact figures — our agent can itemise them for the unit you choose.' },
    { re: /\b(?:cuma|hanya|cukup|masih)\s+ajb\b[^.?!]{0,30}\b(?:aman|resiko|risiko|bahaya|boleh|bisa)\b|\bajb\b[^.?!]{0,20}\b(?:aman|resiko|risiko)\b|\b(?:aman|resiko|risiko)\b[^.?!]{0,20}\bajb\b/,
      answer: 'Tanah/rumah yang baru AJB (belum bersertifikat atas nama penjual) berisiko lebih tinggi, Kak: AJB hanya bukti transaksi, bukan bukti kepemilikan. Amannya: minta sertifikat (SHM/SHGB) atas nama penjual, cek keaslian & riwayatnya di BPN lewat notaris/PPAT, dan pastikan tidak ada sengketa/hak tanggungan. Kalau memang hanya AJB, sertifikat bisa diurus ke BPN tapi butuh waktu & biaya — agent kami bantu cek status unitnya dulu.',
      answerEn: 'A property that only has an AJB (no certificate in the seller\'s name) carries higher risk: the AJB proves the transaction, not ownership. Safer: ask for the SHM/SHGB in the seller\'s name, have a notary/PPAT verify it at the land office (BPN), and check for disputes or bank liens. If it really is AJB-only, a certificate can be applied for, but it takes time and cost — our agent can check the unit\'s status first.' },
    { re: /\b(?:wna|warga\s+negara\s+asing|orang\s+asing|foreigner\w*|expat\w*)\b[^.?!]{0,40}\b(?:shm|hak\s+milik|punya|memiliki|beli|membeli|own|buy|purchase)\b|\b(?:shm|hak\s+milik)\b[^.?!]{0,30}\b(?:wna|asing|foreigner\w*)\b/,
      answer: 'WNA tidak bisa memegang SHM, Kak — SHM hanya untuk WNI perorangan. Opsi yang lazim untuk WNA: Hak Pakai (SHP) untuk rumah tapak, atau SHMSRS/Hak Pakai atas satuan rumah susun untuk apartemen, dengan syarat izin tinggal (KITAS/KITAP) dan batas harga minimum tertentu; atau lewat PT PMA (SHGB). Agent kami bantu cek skema yang cocok untuk unit yang Kakak pilih.',
      answerEn: 'Foreigners cannot hold SHM (freehold) — it is reserved for Indonesian citizens. Common options: Hak Pakai (right-of-use, SHP) for landed houses, or strata title/Hak Pakai for apartments, subject to a residence permit (KITAS/KITAP) and minimum price thresholds; or via a PT PMA company (HGB). Our agent can check the right scheme for the unit you picked.' },
    { re: /\b(?:okupansi|tingkat\s+hunian|occupancy|penyewa\s+rata|rata[-\s]?rata\s+(?:penyewa|terisi|sewa\s+kos))\b/,
      answer: 'Okupansi dan pendapatan sewa kos bergantung lokasi & kondisi unit, Kak — saya tidak punya angka pastinya. Saya catat pertanyaannya; agent kami yang akan bagikan data okupansi/harga sewa di area itu.',
      answerEn: 'Occupancy and rental income depend on the exact location and unit — I do not have a reliable figure. I have noted your question; our agent will share occupancy and rent data for that area.' },
    { re: /\b(?:deposit\w*|jaminan\w*|uang\s+jaminan|security\s+deposit)\b[^.?!]{0,40}\b(?:berapa|ada|how\s+many|how\s+much|is\s+there|bulan|month)\b|\b(?:ada|berapa|is\s+there)\b[^.?!]{0,20}\bdeposit\w*\b/,
      answer: 'Deposit sewa umumnya 1 bulan sewa (kadang 2 bulan untuk unit furnished), dikembalikan di akhir masa sewa setelah dikurangi kerusakan/tunggakan. Sewa rumah/apartemen tahunan biasanya dibayar di muka per tahun. Nominal pastinya tergantung pemilik unit — agent kami konfirmasikan untuk unit yang Kakak pilih.',
      answerEn: 'A rental deposit is usually 1 month\'s rent (sometimes 2 for furnished units), refunded at the end of the lease minus damages or arrears. Yearly house/apartment leases are normally paid upfront per year. The exact amount depends on the owner — our agent will confirm it for the unit you pick.' },
  ];
  for (const { re, answer, answerEn } of PROCESS_QA) {
    if (re.test(text)) return (lang === 'en' && answerEn) ? answerEn : answer;   // null = biarkan gerbang lain (katalog) menjawab
  }

  // Pola per istilah, diurutkan agar frasa lebih spesifik (SHSRS/SHMSRS)
  // dicek sebelum yang lebih umum (SHM) supaya tidak salah cocok.
  const TERMS = [
    {
      re: /\bshsrs\b|\bshmsrs\b|sertifikat.{0,15}rumah\s+susun/,
      answerEn: 'SHMSRS (Sertifikat Hak Milik atas Satuan Rumah Susun) is the strata-title certificate for ONE unit in a vertical building (apartment/condominium) — ownership of the unit plus a share of the common property, not a whole plot of land like SHM.',
      answer: 'SHSRS/SHMSRS (Sertifikat Hak Milik atas Satuan Rumah Susun) adalah bukti kepemilikan sah untuk UNIT hunian vertikal seperti apartemen/kondominium — obyeknya satu unit dalam bangunan bersama, bukan sebidang tanah utuh seperti SHM.',
    },
    {
      re: /\bshgb\b|hak\s+guna\s+bangunan/,
      answerEn: 'SHGB (Sertifikat Hak Guna Bangunan / Right to Build) is a certificate to use and build on state or third-party land for a LIMITED period (usually 30 years, extendable) — unlike SHM, which is permanent. Common for developer estates, shophouses and commercial property; foreign-owned companies (PT PMA) can hold SHGB.',
      answer: 'SHGB (Sertifikat Hak Guna Bangunan) adalah hak memakai/mendirikan bangunan di atas tanah negara atau tanah pihak lain, dengan masa berlaku TERBATAS (umumnya 30 tahun, bisa diperpanjang) — beda dari SHM yang berlaku selamanya. Umum untuk rumah di kompleks developer, ruko, dan properti komersial.',
    },
    {
      re: /\bshm\b|sertifikat\s+hak\s+milik/,
      answerEn: 'SHM (Sertifikat Hak Milik / Freehold) is the strongest and highest form of land ownership in Indonesia, valid indefinitely — only Indonesian citizens (individuals) may hold it.',
      answer: 'SHM (Sertifikat Hak Milik) adalah bukti kepemilikan properti TERTINGGI dan TERKUAT, berlaku SELAMANYA tanpa batas waktu. Hanya WNI perorangan yang bisa memegang SHM.',
    },
    /* ── M159: tiga jenis sertifikat yang SEBELUMNYA TIDAK DIKENALI ──────────
     * Ditambahkan atas arahan pemilik proyek (28 Agu 2026) beserta uraiannya.
     *
     * ⚠️ KENAPA INI BUKAN SEKADAR MELENGKAPI KAMUS:
     * tryTerminologyAnswer() dipakai ragConfidenceService sebagai OVERRIDE
     * "pertanyaan istilah legal → selalu REDIRECT". Istilah yang tidak ada di
     * daftar ini TIDAK mendapat override, dan skor terkalibrasinya jatuh jauh
     * di bawah ambang 0.45. Diukur sebelum perbaikan:
     *     "apa itu SHM?"         1.000  REDIRECT   (sudah ada di daftar)
     *     "apa itu Surat Hijau"  0.042  SKIP  ← customer didiamkan
     *     "apa itu HGU"          0.027  SKIP  ← customer didiamkan
     *     "apa itu SHP"          0.027  SKIP  ← customer didiamkan
     * Jadi kamus yang bolong = customer yang bertanya hal properti yang SAH
     * justru dibungkam. Persis bahaya yang disebut pemilik proyek: "Jika orang
     * tanya SHM dan score-nya rendah, itu bahaya."
     *
     * Urutan penting: 'surat hijau/ijo' dicek SEBELUM pola HGB umum karena
     * solusinya memang sering berbentuk HGB di atas HPL.
     */
    {
      re: /surat\s+hijau|surat\s+ijo|\bipt\b|izin\s+pemakaian\s+tanah/,
      answerEn: 'Surat Hijau ("green letter", Surat Ijo) is a land-use permit (IPT) issued by a city government (e.g. Surabaya) over municipal land. The holder does NOT own the land — it is a temporary lease/permit with an annual levy — and it cannot simply be upgraded to SHM; the usual path offered is SHGB on top of the city\'s management right (HPL).',
      answer: 'Surat Hijau (Surat Ijo) adalah Izin Pemakaian Tanah (IPT) yang dikeluarkan pemerintah daerah (mis. Pemkot Surabaya) atas lahan milik pemerintah. Pemegangnya TIDAK memiliki tanah itu — statusnya menyewa/pinjam pakai dari pemda, bersifat sementara, dan ada retribusi tahunan. Karena tanahnya aset daerah, statusnya tidak bisa langsung dinaikkan jadi SHM; solusi yang kini sering ditawarkan pemda adalah HGB di atas Hak Pengelolaan Lahan (HPL) Pemkot agar dasar hukum pemakaiannya lebih jelas.',
    },
    {
      re: /\bhgu\b|hak\s+guna\s+usaha/,
      answer: 'HGU (Hak Guna Usaha) adalah hak mengusahakan tanah yang dikuasai negara, umumnya untuk pertanian, perkebunan, perikanan, atau peternakan, dengan syarat luas minimal tertentu. Berbeda dari SHGB yang untuk mendirikan bangunan, HGU menyasar pemanfaatan usaha atas tanahnya.',
    },
    {
      re: /\bshp\b|hak\s+pakai|sertifikat\s+hak\s+pakai/,
      answerEn: 'SHP (Sertifikat Hak Pakai / Right of Use) grants the right to use land held by the state or another party. Narrower than SHM, and it is the title foreigners residing in Indonesia may hold for a house, subject to the prevailing rules.',
      answer: 'SHP (Sertifikat Hak Pakai) adalah hak untuk menggunakan dan/atau memungut hasil dari tanah yang dikuasai langsung oleh negara maupun tanah milik pihak lain. Cakupan haknya lebih terbatas dibanding SHM, dan sering dipakai untuk keperluan tertentu termasuk kepemilikan oleh WNA sesuai ketentuan yang berlaku.',
    },
    {
      re: /\bajb\b|akta\s+jual\s+beli/,
      answerEn: 'AJB (Akta Jual Beli) is the official deed of sale and purchase, signed before a PPAT (land deed official) — it is required before the certificate can be transferred to the buyer\'s name.',
      answer: 'AJB (Akta Jual Beli) adalah bukti sah pengalihan hak dalam transaksi jual-beli properti, dibuat oleh PPAT — wajib ada sebelum sertifikat bisa dibalik nama ke pembeli baru.',
    },
    {
      re: /\bppjb\b|perjanjian\s+pengikatan\s+jual\s+beli/,
      answerEn: 'PPJB (Perjanjian Pengikatan Jual Beli) is the preliminary sale-and-purchase agreement made BEFORE the AJB can be signed — typically when the property is still under a mortgage/instalment plan or the developer\'s master certificate has not yet been split per unit. It binds both parties; ownership only transfers with the AJB.',
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

  const pick = (t) => (lang === 'en' && t.answerEn) ? t.answerEn : t.answer;
  const hits = TERMS.filter((t) => t.re.test(text));
  if (!hits.length) return null;
  // "beda SHMSRS sama SHM?" / "difference between PPJB and AJB?" → dua istilah sekaligus.
  if (asksDifference && hits.length >= 2) return hits.slice(0, 2).map(pick).join('\n\n');
  return pick(hits[0]);
}

module.exports = { tryTerminologyAnswer };

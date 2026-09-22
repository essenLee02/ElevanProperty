'use strict';
/**
 * M208 (21 Sep 2026) — 10 sesi baru R1-R10 untuk Private Agent murni: pertanyaan, keluhan,
 * permintaan, penolakan, pilihan, perubahan & kebutuhan yang belum pernah disimulasikan:
 * ralat budget, banding dua unit, tolak KPR lalu cash, video call, minta maps, akses kursi
 * roda, dekat RS, tetangga/berisik, alamat spesifik, "masih ada?" sesudah summary, pesan
 * ganda (dedup), sewa harian villa, dua kota sekaligus, customer lupa apa yang dipilih.
 *
 *   SIM_FILE=./sim-scenarios-private-r10.js node scripts/simulate-platform-skill.js private
 */
module.exports = [
  {
    name: 'R1 — Ralat budget & banding dua unit: "maaf salah, 500 bukan 50", "bedanya no 1 dan 2?", pilih yg lebih murah',
    phone: '6280000081001', customer: 'Bu Rini',
    turns: [
      'Cari rumah dijual di Sidoarjo area Candramas, budget 50 juta.',
      'Maaf salah ketik, maksudnya 500 juta.',
      'Bedanya nomor 1 sama nomor 2 apa? Luas sama kamarnya.',
      'Yang lebih murah aja. Itu masih bisa nego?',
      'Rumahnya hadap mana? Ada carport?',
      'Oke saya pilih yang itu. Survei Minggu sore bisa?',
      'Jam 3.',
      'Sip terima kasih.',
    ],
  },
  {
    name: 'R2 — Tolak KPR lalu cash; tanya biaya notaris & PBB; minta maps; video call',
    phone: '6280000081002', customer: 'Pak Yanto',
    turns: [
      'Ada rumah dijual di Surabaya Wiyung? 3 kamar.',
      'Saya nggak mau KPR, cash saja.',
      'Biaya notarisnya berapa? PBB siapa yang bayar?',
      'Boleh share lokasi maps nomor 1?',
      'Kalau video call dulu bisa? Saya di luar kota.',
      'Rabu depan jam 7 malam.',
      'Ok, makasih ya.',
    ],
  },
  {
    name: 'R3 — Kebutuhan khusus: kursi roda, dekat RS, lantai dasar; menolak yang bertingkat; tanya tetangga/berisik',
    phone: '6280000081003', customer: 'Ibu Wati',
    turns: [
      'Saya cari rumah sewa di Surabaya buat orang tua, harus satu lantai, akses kursi roda, dekat rumah sakit.',
      'Area Tegalsari atau Kenjeran boleh.',
      'Yang nomor 1 itu bertingkat nggak? Kalau bertingkat saya nggak mau.',
      'Lingkungannya berisik nggak? Dekat jalan raya?',
      'Budget 30 juta setahun, masuk Desember.',
      'Ya sudah, kabari kalau ada yang satu lantai ya.',
    ],
  },
  {
    name: 'R4 — Alamat spesifik & "masih ada?" sesudah summary; customer kembali 2 giliran kemudian',
    phone: '6280000081004', customer: 'Mas Dito',
    turns: [
      'Rumah di Jl. Rungkut Menanggal No. 38 masih ada? Sewa.',
      'Harganya berapa? Bisa dicicil per bulan?',
      'Ok saya ambil yang itu. Masuk awal Oktober, 1 tahun.',
      'Survei besok jam 10.',
      'Cukup, terima kasih.',
      'Halo, yang kemarin masih tersedia kan?',
      'Jadi survei besok tetap ya?',
    ],
  },
  {
    name: 'R5 — Villa harian: 3 malam, 8 orang, kolam pribadi, check-in tanggal, tolak yang tanpa kolam, minta harga total',
    phone: '6280000081005', customer: 'Mbak Tia',
    turns: [
      'Ada villa di Surabaya buat nginap 3 malam, 8 orang, kolam renang pribadi?',
      'Kalau rumah besar yang ada kolamnya boleh, area mana saja.',
      'Yang nomor 2 ada kolamnya? Kalau nggak ada kolam saya nggak mau.',
      'Check-in 10 Oktober. Totalnya berapa buat 3 malam?',
      'Bisa bayar DP dulu?',
      'Oke saya pikir dulu ya.',
    ],
  },
  {
    name: 'R6 — Dua kota sekaligus & pesan ganda: "Surabaya atau Sidoarjo", kirim pesan sama 2x, lalu pilih Sidoarjo',
    phone: '6280000081006', customer: 'Pak Agus',
    turns: [
      'Cari rumah dijual di Surabaya atau Sidoarjo, budget 800 juta.',
      'Cari rumah dijual di Surabaya atau Sidoarjo, budget 800 juta.',
      'Sidoarjo aja, area Buduran.',
      'Yang 3 kamar ada nggak?',
      'Nomor 2 tanahnya berapa? Sertifikat apa?',
      'Kalau Surabaya yang budget segitu dapat apa?',
      'Oke nanti saya diskusi sama istri dulu.',
    ],
  },
  {
    name: 'R7 — Customer lupa pilihannya & minta ulang: "tadi saya pilih yang mana?", "kirim ulang yang no 1", ganti jadwal',
    phone: '6280000081007', customer: 'Bu Ika',
    turns: [
      'Apartemen sewa Surabaya Kalijudan, furnished.',
      'Saya pilih nomor 1.',
      'Survei Sabtu jam 10.',
      'Eh tadi saya pilih yang mana ya? Lupa.',
      'Boleh kirim ulang detail yang nomor 1?',
      'Sabtu nggak jadi, Minggu aja jam yang sama.',
      'Makasih.',
    ],
  },
  {
    name: 'R8 — Investor kos: beli rumah untuk dijadikan kos, tanya izin & okupansi, tolak area banjir, minta yang dekat kampus',
    phone: '6280000081008', customer: 'Pak Bambang',
    turns: [
      'Mau beli rumah di Surabaya untuk dijadikan kos-kosan, dekat kampus.',
      'Area Keputih atau Mulyorejo. Budget 1,5 M.',
      'Jangan yang banjir ya.',
      'Yang nomor 1 kamarnya berapa? Bisa dibagi jadi berapa kamar kos?',
      'Perlu izin apa buat usaha kos?',
      'Rata-rata okupansi kos di situ berapa persen?',
      'Oke, survei Selasa depan pagi.',
      'Ok thanks.',
    ],
  },
  {
    name: 'R9 — Keluhan layanan: "kok lama balasnya", "kemarin dijanjikan agent telpon", minta tindak lanjut, lalu lanjut cari',
    phone: '6280000081009', customer: 'Mbak Nia',
    turns: [
      'Halo, kemarin katanya agent mau telpon tapi belum ada kabar.',
      'Kok lama balasnya sih.',
      'Ya sudah. Saya cari apartemen sewa di Surabaya Kutisari, budget 3 juta per bulan.',
      'Yang nomor 2 lantai berapa? Ada balkon?',
      'Tolong pastikan agent telpon saya hari ini ya.',
      'Oke.',
    ],
  },
  {
    name: 'R10 — Negosiasi & syarat: minta diskon, tanya "harga net", "kalau bayar cash dapat berapa", tolak harga lalu terima',
    phone: '6280000081010', customer: 'Pak Fandi',
    turns: [
      'Rumah dijual Sidoarjo Candramas, 2 kamar, cash.',
      'Nomor 1 harga netnya berapa? Kalau cash dapat diskon nggak?',
      'Kemahalan. 400 juta boleh?',
      'Ya sudah kalau nggak bisa, tapi saya tetap mau lihat dulu.',
      'Sabtu ini jam 9 pagi, saya sama istri.',
      'Sertifikatnya apa? Sudah balik nama?',
      'Oke, ditunggu konfirmasinya.',
    ],
  },
];

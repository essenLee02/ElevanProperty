'use strict';
/**
 * M210 (29 Sep 2026) — 15 sesi baru S1-S15 untuk Private Agent murni. Fokus: kombinasi yang
 * belum pernah diuji sama sekali — pesan sangat panjang berisi semua slot sekaligus, pesan
 * satu kata, typo berat sepanjang sesi, customer menolak menyebut budget, salah kirim pesan
 * (bukan untuk AI), dua customer dalam satu chat (suami-istri), pindah kota 3 kali, minta
 * listing berkali-kali (3 → 5 → 8), bandingkan tiga unit, tanya cicilan & simulasi bank,
 * sewa mendadak (hari ini), warga asing dengan bahasa campur, pertanyaan di luar layanan
 * (jual properti sendiri / cari penyewa), keluhan harga naik, minta dokumen legal lengkap,
 * dan customer yang meminta semuanya dirangkum ulang di tengah sesi.
 *
 *   SIM_FILE=./sim-scenarios-private-s15.js node scripts/simulate-platform-skill.js private
 */
module.exports = [
  {
    name: 'S1 — Satu pesan panjang berisi SEMUA slot; lalu minta 3 listing & pilih no 2',
    phone: '6280000091001', customer: 'Pak Wira',
    turns: [
      'Selamat pagi, saya Wira. Saya mau beli rumah di Surabaya area Wiyung atau Mulyorejo, budget 900 juta cash, 3 kamar tidur 2 kamar mandi, semi furnished, untuk keluarga saya 4 orang, rencana pindah Februari tahun depan, hindari yang banjir dan hadap barat.',
      'Kirim 3 pilihan ya.',
      'Saya pilih nomor 2.',
      'Sertifikatnya apa? Luas tanahnya berapa?',
      'Survei Sabtu pagi jam 9.',
      'Oke terima kasih.',
    ],
  },
  {
    name: 'S2 — Pesan satu kata sepanjang sesi: "rumah", "sewa", "surabaya", "rungkut", "ada?"',
    phone: '6280000091002', customer: 'Mas Adi',
    turns: ['rumah', 'sewa', 'surabaya', 'rungkut', 'ada?', '2', 'harga?', 'survei', 'sabtu', 'ok'],
  },
  {
    name: 'S3 — Typo berat sepanjang sesi (sengaja): "rmh dijul", "sda", "brp hrga", "svey"',
    phone: '6280000091003', customer: 'Bu Sri',
    turns: [
      'sy cri rmh dijul di sda, area candrams',
      'bugdet 600jt, kash',
      'brp hrga yg no 1?',
      'srtfikatnya apa?',
      'bs svey hri sbtu?',
      'jm 10 pgi',
      'mksh',
    ],
  },
  {
    name: 'S4 — Menolak menyebut budget & penghuni: "nanti saja", "rahasia", tapi tetap mau listing',
    phone: '6280000091004', customer: 'Pak Deny',
    turns: [
      'Ada apartemen dijual di Surabaya Kutisari?',
      'Budget nanti saja, saya lihat dulu.',
      'Itu rahasia, nggak perlu tahu penghuninya.',
      'Yang nomor 1 lantai berapa?',
      'Kirim 2 lagi yang beda.',
      'Cukup, nanti saya hubungi.',
    ],
  },
  {
    name: 'S5 — Salah kirim pesan (bukan untuk AI) lalu minta maaf dan lanjut cari',
    phone: '6280000091005', customer: 'Mbak Rani',
    turns: [
      'Bu, nanti anaknya dijemput jam 3 ya',
      'Maaf salah kirim 🙏',
      'Saya cari rumah sewa di Gresik, area GKB, 2 kamar.',
      'Budget 25 juta per tahun.',
      'Yang nomor 1 ada garasi?',
      'Oke makasih.',
    ],
  },
  {
    name: 'S6 — Dua orang satu chat (suami & istri berbeda pendapat) — AI harus catat keduanya',
    phone: '6280000091006', customer: 'Pak & Bu Hendro',
    turns: [
      'Kami cari rumah dijual di Surabaya. Saya mau area Rungkut.',
      'Ini istrinya, saya lebih suka Wiyung.',
      'Ya sudah dua-duanya dikirim saja.',
      'Budget kami 1 M, KPR.',
      'Yang Wiyung nomor 1 itu berapa kamar?',
      'Kami diskusi dulu ya.',
    ],
  },
  {
    name: 'S7 — Pindah kota 3 kali: Surabaya → Sidoarjo → Gresik, slot lain harus bertahan',
    phone: '6280000091007', customer: 'Pak Toni',
    turns: [
      'Sewa rumah di Surabaya, 3 kamar, budget 40 juta setahun.',
      'Eh, Sidoarjo saja.',
      'Hmm, Gresik deh yang dekat GKB.',
      'Masih 3 kamar dan budget sama ya.',
      'Kirim 2.',
      'Nomor 1 furnished?',
      'Oke cukup.',
    ],
  },
  {
    name: 'S8 — Minta listing bertambah: 3 → 5 → 8, lalu bandingkan tiga unit',
    phone: '6280000091008', customer: 'Bu Mega',
    turns: [
      'Rumah dijual Surabaya area Kenjeran, kirim 3.',
      'Tambah jadi 5 ya.',
      'Coba semua deh, 8.',
      'Bandingkan nomor 1, 2, dan 3 dong.',
      'Yang paling murah mana?',
      'Oke saya pilih yang itu, survei Minggu jam 11.',
      'Terima kasih banyak.',
    ],
  },
  {
    name: 'S9 — KPR detail: cicilan, simulasi bank, DP, tenor, penghasilan — semua harus ke agent',
    phone: '6280000091009', customer: 'Pak Rudi',
    turns: [
      'Beli rumah di Sidoarjo Candramas, budget 700 juta, KPR.',
      'Kalau DP 20% cicilan per bulan berapa?',
      'Bank mana yang paling murah bunganya?',
      'Penghasilan saya 15 juta, cukup nggak?',
      'Tenor 20 tahun bisa?',
      'Oke, survei Sabtu jam 2 siang.',
      'Makasih ya.',
    ],
  },
  {
    name: 'S10 — Sewa MENDADAK: "butuh hari ini", "bisa masuk besok?", lalu survei sekarang',
    phone: '6280000091010', customer: 'Mas Bagus',
    turns: [
      'Saya butuh rumah sewa di Surabaya Tegalsari hari ini juga.',
      'Bisa masuk besok nggak?',
      'Yang nomor 1 kosong sekarang?',
      'Saya bisa survei sekarang, jam 4 sore.',
      'Bayar cash setahun langsung.',
      'Ok sip.',
    ],
  },
  {
    name: 'S11 — Expat bahasa campur: "I want rumah sewa", "how much per bulan", visa & tax',
    phone: '6280000091011', customer: 'Mr. Chen',
    turns: [
      'Hi, I want rumah sewa in Surabaya, area Kalijudan, 2 bedroom.',
      'How much per bulan?',
      'Can foreigner rent long term? Any visa requirement?',
      'What about tax for me as foreigner?',
      'Ok, I take nomor 1. Visit Saturday 10am.',
      'Thank you.',
    ],
  },
  {
    name: 'S12 — Di luar layanan: customer mau JUAL rumahnya & cari penyewa (vendor lead)',
    phone: '6280000091012', customer: 'Bu Lestari',
    turns: [
      'Saya mau jual rumah saya di Surabaya, bisa dibantu?',
      'Lokasinya di Rungkut, 3 kamar, saya mau 800 juta.',
      'Atau kalau disewakan bisa dibantu cari penyewa?',
      'Komisinya berapa kalau lewat agent?',
      'Oke, saya tunggu agentnya menghubungi.',
    ],
  },
  {
    name: 'S13 — Keluhan harga naik & data tidak cocok: "kemarin 500 sekarang 520?"',
    phone: '6280000091013', customer: 'Pak Joko',
    turns: [
      'Rumah dijual Rungkut Surabaya, yang kemarin 500 juta.',
      'Kok sekarang jadi 520 juta? Naik ya?',
      'Datanya yang benar mana?',
      'Ya sudah, yang 520 itu sertifikatnya apa?',
      'Nego bisa sampai 500?',
      'Oke ditunggu kabarnya.',
    ],
  },
  {
    name: 'S14 — Dokumen legal lengkap: minta scan sertifikat, IMB/PBG, PBB, bukti bayar',
    phone: '6280000091014', customer: 'Bu Ayu',
    turns: [
      'Beli rumah di Surabaya Wiyung, budget 1 M cash.',
      'Yang nomor 1 sertifikatnya apa? Ada IMB/PBG?',
      'Boleh minta scan sertifikat dan PBB terakhir?',
      'Ada tunggakan PBB atau listrik nggak?',
      'Kalau semua beres saya langsung DP.',
      'Terima kasih.',
    ],
  },
  {
    name: 'S15 — Minta rangkum ulang di tengah sesi, lalu ubah 2 slot, lalu minta rangkum lagi',
    phone: '6280000091015', customer: 'Pak Eko',
    turns: [
      'Sewa apartemen Surabaya Kalijudan, 1 kamar, budget 3 juta per bulan, masuk Januari.',
      'Tolong rangkum dulu kebutuhan saya.',
      'Ganti, budgetnya 4 juta dan masuk Februari.',
      'Sekarang rangkum lagi ya.',
      'Kirim 2 listing yang sesuai.',
      'Nomor 2 saja. Survei Sabtu jam 1.',
      'Oke terima kasih.',
    ],
  },
];

'use strict';
/**
 * M205 (18 Sep 2026) — 10 sesi baru untuk Private Agent MURNI (AI_PRIMARY_PROVIDER=private,
 * jalur whatsappAIService lengkap). Menyentuh 7 poin pemilik proyek dengan kombinasi yang
 * belum pernah diuji: apartemen tower/lantai, KPR & DP, SHGB vs SHM unit, villa liburan,
 * kos untuk anak, kantor, gudang, typo berat, bahasa campur, customer diam-diam ganti
 * kota dua kali, penolakan keras, dan customer yang langsung minta jadwal.
 *
 *   SIM_FILE=./sim-scenarios-private10.js node scripts/simulate-platform-skill.js private
 *
 * Nama sesi diawali N (Nyata-Private) supaya tidak bentrok dengan K/P/X/Y/Z.
 */
module.exports = [
  {
    name: 'N1 — Sewa apartemen Surabaya: tower/lantai, furnished, IPL, minta 3, pilih no 2, survei Minggu',
    phone: '6280000071001', customer: 'Bu Vina',
    turns: [
      'Halo, cari apartemen sewa di Surabaya area Kalijudan, 1 kamar cukup.',
      'Yang furnished ya. Ada 3 pilihan nggak?',
      'Nomor 2 lantai berapa? Towernya apa?',
      'Sudah termasuk IPL belum?',
      'Budget 3 jt an per bulan, sewa 1 tahun.',
      'Saya pilih nomor 2.',
      'Bisa survei hari Minggu? Sore.',
      'Sama pacar saya, 2 orang.',
      'Deposit berapa bulan?',
      'Oke sip, makasih ya.',
    ],
  },
  {
    name: 'N2 — Beli rumah Sidoarjo KPR: DP, syarat, sertifikat unit no 1, cicilan, nego, survei Sabtu jam 10',
    phone: '6280000071002', customer: 'Pak Bayu',
    turns: [
      'Mau beli rumah di Sidoarjo, area Candramas atau sekitarnya. Budget 700 jt, KPR.',
      'DP minimal berapa persen? Syarat KPR apa aja?',
      'Yang nomor 1 sertifikatnya SHM atau HGB?',
      'Kalau HGB aman nggak? Bisa dinaikkan jadi SHM?',
      'Cicilan 15 tahun kira2 berapa per bulan?',
      'Bisa nego nggak harganya?',
      'Rumahnya banjir nggak kalau hujan?',
      'Survei Sabtu depan jam 10 bisa?',
      'Rencana pindah Maret tahun depan.',
      'Terima kasih infonya.',
    ],
  },
  {
    name: 'N3 — Villa liburan Batu/Malang: kota tanpa stok → pindah Surabaya → menolak → tutup',
    phone: '6280000071003', customer: 'Mbak Dea',
    turns: [
      'Ada villa sewa di Batu buat liburan keluarga? 10 orang.',
      'Kalau Malang ada?',
      'Yah. Kalau di Surabaya ada villa?',
      'Rumah besar juga boleh deh, area Citraland, 4 kamar.',
      'Harganya berapa yang nomor 1?',
      'Kemahalan. Ada yang di bawah 30 juta setahun?',
      'Cuma 2 hari kok nyewa setahun, bisa harian nggak?',
      'Ya sudah kalau nggak bisa, makasih.',
    ],
  },
  {
    name: 'N4 — Kos untuk anak kuliah: ngekos dekat kampus, typo berat, tanya jarak, minta foto, minta nomor agent',
    phone: '6280000071004', customer: 'Bu Endang',
    turns: [
      'Sy cari kos buat anak sy yg kuliah di ITS surabaya, yg dkt kampus',
      'Kalo di Keputih ada? Kmr mandi dalam ya',
      'Bugdet 1,5jt an per bln',
      'Dari Gresik ke sana brp lama?',
      'Boleh minta fotonya yg no 1?',
      'Aman nggak buat anak cewek? Ada penjaga?',
      'Anaknya masuk Agustus tahun depan',
      'Nanti sy hubungi agentnya langsung aja, boleh minta nomornya?',
      'Ok makasih bu',
    ],
  },
  {
    name: 'N5 — Kantor Surabaya: sewa ruang kantor, grade, parkir, luas, zonasi, tolak survei, minta ringkasan',
    phone: '6280000071005', customer: 'Pak Rio (PT Maju)',
    turns: [
      'Kami cari kantor sewa di Surabaya untuk 15 orang, area Darmo atau pusat kota.',
      'Luas minimal 100 m2, parkir minimal 5 mobil.',
      'Yang nomor 1 gedungnya grade apa? Ada lift?',
      'Boleh untuk kantor cabang bank kan secara izin?',
      'Budget 150 jt per tahun, kontrak 2 tahun.',
      'Kami belum mau survei, masih banding-bandingkan dulu.',
      'Tolong rangkum kebutuhan kami.',
      'Ok, nanti kami kabari.',
    ],
  },
  {
    name: 'N6 — Gudang Gresik/Sidoarjo: beli gudang, akses kontainer, PLN, surat hijau vs SHM, cash bertahap',
    phone: '6280000071006', customer: 'Pak Hasan',
    turns: [
      'Cari gudang dijual di Gresik area Manyar atau Kebomas, min 500 m2.',
      'Kalau Sidoarjo area Waru ada?',
      'Akses truk kontainer 40 feet bisa masuk?',
      'Listriknya berapa kVA yang nomor 1?',
      'Sertifikatnya surat hijau atau SHM? Bedanya apa?',
      'Budget 3 M, bayar cash bertahap 2 kali boleh?',
      'Survei Rabu depan pagi.',
      'Oke ditunggu ya.',
    ],
  },
  {
    name: 'N7 — Bahasa campur & ganti transaksi: rent→buy, budget dalam USD, expat pet, 2 kids, school nearby',
    phone: '6280000071007', customer: 'Mr. Lee',
    turns: [
      'Hi, saya cari rumah rent di Surabaya, dekat international school, 3 bedrooms.',
      'Area Citraland atau Pakuwon ok. Budget around 80 juta per year.',
      'We have 2 kids and a cat, pet friendly please.',
      'Actually kalau beli lebih worth it? Kami stay 5 tahun.',
      'Ok let us look at buying then, budget 2 M.',
      'Apakah WNA bisa punya SHM?',
      'Nomor 1 furnished? Ada garden?',
      'Can we visit this Saturday morning?',
      'Terima kasih, that is all.',
    ],
  },
  {
    name: 'N8 — Investor ruko: beli ruko untuk disewakan, yield, area ramai, pilih 2 unit, banding, pajak',
    phone: '6280000071008', customer: 'Bu Lina',
    turns: [
      'Mau beli ruko di Surabaya buat investasi, disewakan lagi. Area yang rame.',
      'Budget 2-3 M.',
      'Kirim 3 ya.',
      'Yang nomor 1 sama nomor 3 bedanya apa? Luas sama harganya.',
      'Yield sewanya kira2 berapa persen per tahun?',
      'Nomor 3 saja. Sertifikat apa?',
      'Pajak jual belinya siapa yang tanggung?',
      'Survei kapan bisa? Saya bisa Selasa atau Kamis sore.',
      'Kamis jam 4.',
      'Ok thanks.',
    ],
  },
  {
    name: 'N9 — Customer marah & menguji: pertanyaan berulang, jawaban ngawur, minta manusia, kembali normal',
    phone: '6280000071009', customer: 'Pak Toni',
    turns: [
      'Rumah sewa Surabaya Rungkut, 2 kamar, ada?',
      'Yang nomor 1 harganya berapa? tadi udah dibilang belum?',
      'Kok tanya budget lagi, saya kan udah bilang 30 juta.',
      'Saya mau ngomong sama orang, bukan bot.',
      'Ya sudah. Yang nomor 2 masih tersedia?',
      'Boleh lihat Sabtu ini jam 9?',
      'Oke.',
    ],
  },
  {
    name: 'N10 — Langsung minta jadwal & ubah 2x: tanggal, ganti hari, ganti jam, tambah peserta, batal lalu jadwalkan lagi',
    phone: '6280000071010', customer: 'Mbak Sari',
    turns: [
      'Halo, ada apartemen dijual di Surabaya Kutisari? Mau survei minggu ini.',
      'Nomor 1. Jumat jam 2 ya.',
      'Eh ganti Sabtu aja.',
      'Jam 10 pagi.',
      'Sama orang tua saya, 3 orang.',
      'Maaf, batal dulu ya, ada acara.',
      'Kalau Minggu depan jam 10 bisa?',
      'Sip, makasih.',
    ],
  },
];

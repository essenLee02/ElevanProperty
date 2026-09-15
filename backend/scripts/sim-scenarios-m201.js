'use strict';
// M201: customer sibuk bertanya, slot wajib (area) tak pernah disebut → di giliran 10-12 AI harus MENANYAKAN area dulu, summary sesudah terjawab.
module.exports = [
  {
    name: 'Y1 — Beli rumah Surabaya tanpa area; 9 pertanyaan customer; area baru dijawab setelah ditanya di giliran 10',
    phone: '6280000055001', customer: 'Agenda Customer',
    turns: [
      'Mau beli rumah di Surabaya.',
      'Apa itu SHM?',
      'Kalau KPR DP-nya minimal berapa persen?',
      'Bedanya SHM sama HGB apa?',
      'Biaya notaris biasanya berapa?',
      'BPHTB itu apa?',
      'Kalau rumah second, PBB-nya siapa yang bayar?',
      'Apa itu AJB?',
      'Rumah di Surabaya rata-rata berapa harganya?',
      'Oke, saya paham.',
      'Wiyung saja.',
      'Cukup, terima kasih.',
    ],
  },
  {
    name: 'Y2 — Semua slot wajib ada; customer menjawab tapi tidak bertanya → AI bertanya, summary di giliran 10',
    phone: '6280000055002', customer: 'Diam Saja',
    turns: [
      'Beli rumah di Surabaya, Wiyung.',
      'Nomor 1.',
      'Budget 450 juta.',
      'Cash.',
      'Tinggal sama istri dan 2 anak.',
      'Masuk Januari.',
      'Tidak ada yang dihindari.',
      'Baru atau second boleh.',
      'Fasilitas standar saja.',
      'Ya.',
      'Oke.',
      'Terima kasih.',
    ],
  },
];

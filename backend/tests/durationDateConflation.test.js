/**
 * durationDateConflation.test.js
 *
 * Bug produksi (4 Agu 2026): "Rencana checkin 2 minggu lagi, Kak. Durasi
 * sewa 5 hari" — SATU pesan membawa DUA info berbeda unit (offset tanggal
 * masuk "2 minggu lagi", durasi menginap "5 hari"). Ekstraktor durasi lama
 * HANYA jalan bila pertanyaan AI eksplisit menanyakan durasi
 * ("berapa lama"/"durasi sewa") — di sini AI justru menanyakan TANGGAL
 * check-in, jadi durasi yang disebut sendiri oleh customer tidak pernah
 * tertangkap sama sekali, dan summary akhirnya salah menampilkan
 * "Durasi menginap: 2 minggu" (mengambil angka dari OFFSET TANGGAL).
 */
const { extractQualificationState } = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });
const st = (aiMsg, custMsg) => extractQualificationState([u('booking hotel malang'), a(aiMsg)], custMsg);

console.log('\n── Kasus asli: tanggal masuk + durasi digabung satu pesan ──');
{
  const s = st('Rencananya check-in tanggal berapa? 📅', 'Rencana checkin 2 minggu lagi, Kak. Durasi sewa 5 hari');
  ok('moveInDate = 18 Agustus 2026 (offset "2 minggu lagi")', s.moveInDate === '18 Agustus 2026');
  ok('leaseDuration = "5 hari" (BUKAN "2 minggu")',            s.leaseDuration === '5 hari');
}

console.log('\n── Variasi urutan & satuan ──');
{
  const s1 = st('Check-in tanggal berapa?', 'Durasi sewa 3 malam, checkin 1 bulan lagi');
  ok('durasi di AWAL kalimat tetap benar', s1.leaseDuration === '3 malam');

  const s2 = st('Check-in tanggal berapa?', 'checkin besok, durasi menginap 2 minggu');
  ok('durasi di AKHIR kalimat tetap benar', s2.leaseDuration === '2 minggu');
}

console.log('\n── Kontrol negatif: TANPA kata "durasi" eksplisit → tidak menebak ──');
{
  const s = st('Check-in tanggal berapa?', 'checkin 2 minggu lagi, nginep 5 hari aja');
  ok('tanpa kata "durasi" → leaseDuration tetap null (biarkan Q10 bertanya)', s.leaseDuration === null);
}

console.log('\n── Pertanyaan AI yang MEMANG soal durasi tetap bekerja seperti biasa ──');
{
  const s = st('Rencananya sewa untuk berapa lama? ⏱️', '5 hari');
  ok('jalur lama (aiText bertanya durasi) tidak rusak', s.leaseDuration === '5 hari');
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

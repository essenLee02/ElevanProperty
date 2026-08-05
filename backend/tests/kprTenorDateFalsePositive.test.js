/**
 * kprTenorDateFalsePositive.test.js
 *
 * Bug produksi (4 Agu 2026, Surabaya beli-rumah transcript): customer menjawab
 * "Saya mau ambil KPR 10 tahun" — pembiayaan Q_KPR-a (tenor pinjaman), bukan
 * tanggal masuk. Rule bare-form customerDateParser ("N tahun" tanpa kata
 * penanda relatif "lagi"/"kedepan"/"dalam") membaca "10 tahun" sebagai
 * offset +10 tahun dari hari ini dan MENIMPA Q8 (Masuk) dengan tanggal
 * fabrikasi ("04 Agustus 2027" di produksi) — padahal customer tidak pernah
 * menyebut tanggal masuk sama sekali di percakapan itu (flow BELI, Q8 tidak
 * wajib). Fix: hasFinancingSignal guard (kpr/kredit/cicilan/angsuran/tenor/
 * pinjaman/dp/bunga) — sama pola dengan hasCurrencySignal yang sudah ada.
 */
const { parseCustomerDate } = require('../utils/customerDateParser');
const { extractQualificationState } = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });

console.log('\n── Kasus asli: "KPR 10 tahun" tidak boleh jadi tanggal masuk ──');
{
  ok('parseCustomerDate("Saya mau ambil KPR 10 tahun") = null',
     parseCustomerDate('Saya mau ambil KPR 10 tahun') === null);
  ok('parseCustomerDate("cicilan 5 tahun, DP 20 persen") = null',
     parseCustomerDate('cicilan 5 tahun, DP 20 persen') === null);
  ok('parseCustomerDate("tenor 15 tahun") = null',
     parseCustomerDate('tenor 15 tahun') === null);
  ok('parseCustomerDate("angsuran 3 tahun") = null',
     parseCustomerDate('angsuran 3 tahun') === null);
}

console.log('\n── Jalur lama (bare "N unit" tanpa sinyal pembiayaan) tidak rusak ──');
{
  const r = parseCustomerDate('checkin 2 minggu');
  ok('bare "2 minggu" tanpa sinyal KPR tetap jalan', r && r.status === 'ok');
  const r2 = parseCustomerDate('dalam 3 bulan');
  ok('qualified "dalam 3 bulan" tetap jalan (tidak digate sinyal pembiayaan)', r2 && r2.status === 'ok');
}

console.log('\n── Reproduksi transkrip nyata: moveInDate tidak boleh terisi dari KPR ──');
{
  const H = [
    u('Saya mau beli rumah di surabaya'),
    a('Di area atau kawasan mana di Surabaya yang Anda pertimbangkan?'), u('Di area Ngagel, Kak'),
    a('Selain Surabaya, area sekitar yang masih oke?'), u('Tetap di Surabaya'),
    a('Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?'),
    u('Saya survei sendiri'),
    a('Untuk pembiayaan, rencananya cash atau KPR?'),
    u('Saya bisa surver kamis ini, Kak'), u('Saya mau ambil KPR 10 tahun'),
    a('Sudah ada bank yang dituju, atau perlu saya bantu rekomendasikan? Dan DP-nya kira-kira berapa persen yang disiapkan?'),
    u('Bank BCA, Kak'), u('DP 20%, Kak'),
  ];
  const st = extractQualificationState(H, 'Rumah second kondisi seperti baru');
  ok('moveInDate TIDAK terisi dari "KPR 10 tahun" (tetap null, Q8 tidak ditanya di flow BELI ini)',
     st.moveInDate === null || st.moveInDate === undefined);
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

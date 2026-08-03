/**
 * facilitiesViewingAndShortAnswers.test.js
 *
 * Empat cacat dari satu percakapan produksi (3 Agu 2026, 13.03–13.13):
 *
 *  1. Q9 ditanya 4× — "Tdk perlu", "Tdk mau", "Saya survei sndri" tidak
 *     dikenali sebagai jawaban. Pertanyaannya berbentuk pilihan ("langsung
 *     jadwalkan ATAU perlu koordinasi dulu?"), jadi penolakan telanjang SUDAH
 *     menjawab: tidak perlu koordinasi → Mandiri.
 *  2. Q11 ditanya 3× — "Yang semi, Kak" / "semi, Kak" gagal karena Phase 1
 *     mensyaratkan kata "furn" muncul bersama "semi".
 *  3. Fasilitas TIDAK PERNAH ditanya — Q_FAC sama sekali tidak ada di
 *     findNextQuestion(), sehingga summary keluar tanpa data fasilitas.
 *  4. Jadwal survei TIDAK PERNAH ditanya — tidak ada Q9b (tanggal) maupun
 *     Q9c (jam). Aturan: tanggal DULU, baru jam; menolak survei = jawaban sah
 *     yang dicatat "Minta listing".
 */
const { extractQualificationState, findNextQuestion } = require('../services/aiPromptBuilderService');
const { expandAbbreviations } = require('../utils/lazyChatNormalizer');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });
const answer = (aiMsg, custMsg, field) => extractQualificationState(
  [u('sewa apartemen surabaya'), a(aiMsg)], expandAbbreviations(custMsg)
)[field];

const Q9  = 'Oke, Kak! Kalau ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?';
const Q11 = 'Untuk furnitur, lebih prefer yang sudah furnished, semi-furnished, atau kosongan saja? 🛋️';
const Q9B = 'Kalau mau lihat unitnya langsung, enaknya tanggal berapa? 📅';
const Q9C = 'Kira-kira jam berapa yang paling pas? ⏰';

console.log('\n── Q9: penolakan telanjang = Mandiri (bukan slot kosong) ──');
for (const ans of ['Tdk perlu. Saya survei sndri', 'Tdk perlu', 'Tdk mau', 'Saya survei sndri',
                   'Saya survei sndrian', 'Saya survei sendirian', 'gak usah']) {
  ok(`"${ans}" → Mandiri`, answer(Q9, ans, 'decisionMaker') === 'Mandiri');
}
ok('koordinasi nyata tetap terbaca benar',
   answer(Q9, 'koordinasi dulu sama istri', 'decisionMaker') === 'Koordinasi dengan pasangan');

console.log('\n── Q11: satu kata tier sudah cukup ──');
ok('"Yang semi, Kak" → semi-furnished', answer(Q11, 'Yang semi, Kak', 'furnishing') === 'semi-furnished');
ok('"semi, Kak" → semi-furnished',      answer(Q11, 'semi, Kak', 'furnishing') === 'semi-furnished');
ok('"Semi" → semi-furnished',           answer(Q11, 'Semi', 'furnishing') === 'semi-furnished');
ok('"full" → fully furnished',          answer(Q11, 'full', 'furnishing') === 'fully furnished');
ok('"kosongan" → unfurnished',          answer(Q11, 'kosongan', 'furnishing') === 'unfurnished/kosongan');

console.log('\n── Q9b: tanggal survei, dan hak menolak ──');
ok('"tanggal 20 Agustus" → tanggal rapi (bukan ISO)',
   answer(Q9B, 'tanggal 20 Agustus', 'viewingDate') === '20 Agustus 2026');
for (const ans of ['lihat listing saja', 'belum mau survei', 'skip']) {
  ok(`"${ans}" → Minta listing`, answer(Q9B, ans, 'viewingDate') === 'Minta listing');
}

console.log('\n── Q9c: jam survei ──');
ok('"jam 10 pagi" tertangkap', /10/.test(String(answer(Q9C, 'jam 10 pagi', 'viewingTime') || '')));
ok('"jam 3 sore" tertangkap',  /3/.test(String(answer(Q9C, 'jam 3 sore', 'viewingTime') || '')));

console.log('\n── Urutan: Q_FAC → Q9b → Q9c → SUMMARY ──');
{
  let T = [
    u('Saya mau booking apartemen di Surabaya, area Ngagel'),
    a('Di Surabaya ada apartemen kisaran Rp 2.200.000 dan Rp 3.100.000/bulan. Mana yang lebih sesuai?'), u('Yang terjangkau aja'),
    a('Rencananya masuk bulan apa? 📅'), u('Saya checkin 3 minggu lagi'),
    a('Nanti tinggal bersama siapa?'), u('Bersama 2 teman kerja'),
    a('Ada yang pasti tidak cocok?'), u('Tidak banjir'),
    a('Sudah lihat berapa Apartemen di Surabaya?'), u('Saya belum pernah survei, Kak'),
    a('Ada patokan? 📍'), u('Dekat Ngagel'),
    a('Selain Surabaya, area sekitar yang masih oke? 🗺️'), u('Gk mau'),
    a(Q9), u('Tdk perlu. Saya survei sendiri'),
    a('Rencananya sewa berapa lama? ⏱️'), u('Rencana 12 hari sewa, Kak'),
    a(Q11), u('Yang semi, Kak'),
    a('Ada preferensi tower atau lantai tertentu? 🏢'), u('Antara lantai 12-18 aja, Kak'),
  ];
  const nextQ = () => {
    const st = extractQualificationState(T, T[T.length - 1].message);
    const nq = findNextQuestion(st, {});
    return nq ? nq.q : null;
  };
  ok('fasilitas ditanya sebelum summary', nextQ() === 'Q_FAC');
  T = [...T, a('Ada fasilitas yang wajib ada? boleh jawab standar saja 🛠️'), u('standar saja')];
  ok('lalu tanggal survei (Q9b)',         nextQ() === 'Q9b');
  T = [...T, a(Q9B), u('tanggal 20 Agustus')];
  ok('lalu jam survei (Q9c)',             nextQ() === 'Q9c');
  T = [...T, a(Q9C), u('jam 10 pagi')];
  ok('baru kemudian SUMMARY',             nextQ() === null);
}

console.log('\n── Alur BELI (Q14) tidak boleh terpotong Q_FAC ──');
{
  const beliBase = {
    buildingType: 'house', transactionType: 'sale', location: 'Surabaya', district: 'Darmo',
    searchHistory: 'yes', budget: '1M', moveInDate: '12 Juli 2026', household: 'keluarga',
    redFlags: 'tidak ada', anchorPoint: 'dekat sekolah', alternativeAreas: 'boleh',
    decisionMaker: 'Mandiri',
  };
  ok('BELI tanpa financing tetap → Q_KPR',
     findNextQuestion({ ...beliBase }).q === 'Q_KPR');
  ok('hotel beli tetap → Q14 akuisisi',
     findNextQuestion({ ...beliBase, buildingType: 'hotel', financing: 'cash' }).hint.includes('operasional'));
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

/**
 * viewingDateFromAiStatement.test.js
 *
 * Bug produksi (4 Agu 2026): AI kadang MENYATAKAN tanggal survei sambil
 * MENANYAKAN jamnya dalam SATU kalimat ("...jadwal survei di tanggal 18
 * Agustus 2026, kira-kira jam berapa yang paling pas?") — bukan pola
 * interogatif "tanggal berapa" yang dicek `aiAsksViewDate`, jadi giliran
 * itu tidak pernah menyimpan viewingDate. Customer lalu hanya menjawab
 * jamnya saja ("Jam 2 siang"), dan summary akhir salah menampilkan
 * "Viewing: Besok siang jam 2" (fabrikasi) alih-alih tanggal asli yang
 * sudah disebut AI sendiri.
 */
const { extractQualificationState } = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });

console.log('\n── Kasus asli: AI menyatakan tanggal + menanyakan jam dalam satu kalimat ──');
{
  const H = [
    u('booking hotel di malang'),
    a('Siap, Kak — yang terjangkau sudah saya catat. Tinggal satu lagi — untuk jadwal survei bersama istri di tanggal 18 Agustus 2026, kira-kira jam berapa yang paling pas? ⏰'),
  ];
  const st = extractQualificationState(H, 'Jam 2 siang');
  ok('viewingDate terisi dari kalimat AI ("18 Agustus 2026")', st.viewingDate === '18 Agustus 2026');
  ok('viewingTime tetap terisi dari jawaban customer', st.viewingTime === 'Jam 2 siang');
}

console.log('\n── Jalur lama (AI bertanya "tanggal berapa" di giliran terpisah) tidak rusak ──');
{
  const H = [
    u('sewa apartemen surabaya'),
    a('Rencananya mau survei tanggal berapa, Kak?'), u('20 Agustus 2026'),
    a('Oke, jam berapa yang paling pas?'),
  ];
  const st = extractQualificationState(H, 'Jam 10 pagi');
  ok('viewingDate dari giliran terpisah tetap benar', st.viewingDate === '20 Agustus 2026');
  ok('viewingTime tetap benar', st.viewingTime === 'Jam 10 pagi');
}

console.log('\n── viewingDate yang SUDAH terisi tidak tertimpa fallback ──');
{
  const H = [
    u('sewa apartemen surabaya'),
    a('Rencananya mau survei tanggal berapa, Kak?'), u('20 Agustus 2026'),
    a('Baik, untuk tanggal 25 Agustus 2026 itu, jam berapa yang paling pas?'),
  ];
  const st = extractQualificationState(H, 'Jam 10 pagi');
  ok('viewingDate lama (20 Agustus) tidak tertimpa tanggal lain yang disebut AI belakangan', st.viewingDate === '20 Agustus 2026');
}

console.log('\n── "Minta listing" tetap dihormati, fallback tidak menimpa ──');
{
  const H = [
    u('sewa apartemen surabaya'),
    a('Rencananya mau survei tanggal berapa, Kak?'), u('tidak usah survei, kirim listing aja'),
    a('Baik, untuk tanggal 25 Agustus 2026, jam berapa yang paling pas?'),
  ];
  const st = extractQualificationState(H, 'terserah aja');
  ok('viewingDate tetap "Minta listing", tidak tertimpa fallback', st.viewingDate === 'Minta listing');
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

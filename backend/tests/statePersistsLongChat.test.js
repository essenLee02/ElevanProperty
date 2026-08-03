/**
 * statePersistsLongChat.test.js
 *
 * QUALIFICATION STATE HARUS dihitung dari history PENUH.
 *
 * Regresi nyata (3 Agu 2026, diperkenalkan oleh mitigasi TPM saya sendiri):
 * `generateChatGPTWhatsappReply` memotong history ke 12 pesan SEBELUM
 * memanggil buildWhatsappReplyPrompt — dengan asumsi keliru bahwa state sudah
 * dihitung lebih dulu. Nyatanya extractQualificationState() dipanggil DI DALAM
 * builder, jadi ikut menerima history terpotong.
 *
 * Akibatnya pada percakapan panjang: jawaban Q1/Q2/Q3 di awal keluar dari
 * window → SELURUH state null → AI menanyakan Q1 lagi → jawaban baru mendorong
 * pesan lama makin jauh keluar → loop tak berujung. Customer sampai menulis
 * "Tolong hentikan pertanyaan yang berulang" dan "Berhenti bertanya hal yang sama".
 *
 * Ini pengulangan bug historis M35 (window 24→60). Pemotongan token kini HANYA
 * mengenai transkrip yang DITAMPILKAN, tidak pernah perhitungan state.
 */
const { extractQualificationState, buildWhatsappReplyPrompt } = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });

/** Percakapan panjang: jawaban inti berada JAUH di awal (>12 pesan ke belakang). */
const LONG = [
  u('Saya mau booking apartemen'),
  a('Di *kota* mana yang Anda inginkan?'),
  u('Di Surabaya, Kak'),
  a('Di Surabaya ada apartemen kisaran Rp 2.200.000 dan Rp 3.100.000/bulan. Kira-kira mana yang lebih sesuai?'),
  u('Itu kemahalan, Kak'),
  a('Rencananya masuk atau pindah bulan apa? 📅'),
  u('Saya checkin 3 minggu lagi, Kak'),
  a('Nanti akan tinggal bersama siapa saja?'),
  u('Saya tinggal bersama 2 teman krj saya'),
  a('Di area atau kawasan mana di Surabaya?'),
  u('Saya mau di area Ngagel'),
  a('Sudah lihat berapa Apartemen di Surabaya?'),
  u('Saya belum pernah survei, Kak'),
  a('Ada yang pasti tidak cocok?'),
  u('Tidak banjir'),
  a('Ada patokan lokasi?'),
  u('dekat kampus'),
  a('Selain area itu, ada area lain?'),
  u('Tidak ada'),
];

console.log('\n── State bertahan pada percakapan panjang ──');
{
  const st = extractQualificationState(LONG, 'oke');
  ok('history memang panjang (>12 pesan)', LONG.length > 12);
  ok('Q1 transaksi tetap ✅',  st.transactionType === 'rent');
  ok('tipe properti tetap ✅', st.buildingType === 'apartment');
  ok('Q2 kota tetap ✅',       st.location === 'Surabaya');
  ok('Q3 budget tetap ✅',     !!st.budget);
  ok('Q8 tanggal tetap ✅',    !!st.moveInDate);
  ok('Q4 penghuni tetap ✅',   !!st.household);
}

console.log('\n── Bukti anti-regresi: memotong input state MERUSAK semuanya ──');
{
  const cut = extractQualificationState(LONG.slice(-12), 'oke');
  const lost = ['transactionType', 'buildingType', 'location'].filter(k => !cut[k]);
  ok('history terpotong memang kehilangan field inti (bug lama)', lost.length >= 2);
}

console.log('\n── Prompt: DIREKTIF FINAL tidak boleh menyuruh tanya ulang ──');
{
  const p = buildWhatsappReplyPrompt(
    { id: 1, name: 'N', normalizedPhone: '62', source: 'wa', agentName: 'LEO' },
    LONG, 'oke', '', 'chatgpt', {}
  );
  const tail = p.slice(p.indexOf('⚡ DIREKTIF FINAL'));
  ok('direktif mencantumkan Q1 sudah dijawab', /Q1 transaksi=rent/.test(tail));
  ok('direktif mencantumkan kota Surabaya',    /Q2 kota=Surabaya/.test(tail));
  ok('TIDAK menyuruh tanya Q1 lagi',           !/TANYAKAN SEKARANG → Q1\b/.test(tail));
  ok('TIDAK menyuruh tanya Q2 (kota) lagi',    !/TANYAKAN SEKARANG → Q2:/.test(tail));
}

console.log('\n── Q4: "N teman" adalah jawaban penghuni yang sah ──');
{
  const Q4 = 'Nanti akan tinggal bersama siapa saja?';
  const hh = (ans) => extractQualificationState(
    [u('sewa apartemen surabaya'), a(Q4)], ans
  ).household;
  ok('"Bersama 2 teman kerja" → 3 orang',        hh('Bersama 2 teman kerja') === '3 orang');
  ok('"tinggal bersama 2 teman krj saya" → 3',   hh('Saya tinggal bersama 2 teman krj saya') === '3 orang');
  ok('"bertiga" → 3 orang',                      hh('bertiga') === '3 orang');
  ok('"sama teman kerja" (tanpa jumlah) terisi', !!hh('sama teman kerja'));
  ok('kalimat non-penghuni tidak salah tangkap', !hh('dekat teman saya kerja di sana'));
}

console.log('\n── Q2 fallback: kota dari pertanyaan AI sendiri ──');
{
  const st = extractQualificationState([
    u('Saya sewa apartemen, Kak'),
    a('Di area atau kawasan mana di Surabaya yang Anda pertimbangkan? 📍'),
  ], 'Di area Ngagel');
  ok('kota terbaca dari pesan AI', st.location === 'Surabaya');
  ok('area tetap tertangkap',      st.district === 'Ngagel');
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

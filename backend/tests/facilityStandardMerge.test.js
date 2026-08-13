/**
 * facilityStandardMerge.test.js — regresi M91.
 *
 * DUA transkrip produksi dengan jawaban Q_FAC yang SAMA PERSIS
 * ("Fasilitas terserah saja, pokok ada AC dan gym") menghasilkan brief berbeda:
 *
 *   9 Agu 2026 (BENAR):
 *     ✓ Fasilitas: Gym, AC, Kamar Tidur, Kamar Mandi, Ruang Tamu,
 *       Pantry/Kitchen Set, Water Heater, Listrik, Air, Wi-Fi, TV, Lift,
 *       Parkir, Lobby, Keamanan 24 Jam, CCTV, Akses Kartu
 *   8 Agu 2026 (SALAH):
 *     ✓ Fasilitas: AC, Gym          ← 15 fasilitas standar dibuang
 *
 * DUA CACAT TERPISAH:
 *
 *  (a) EKSTRAKTOR — daftar frasa "tidak punya preferensi" terlalu sempit.
 *      13 dari 23 cara lazim menjawab TIDAK menyalakan marker 'standar',
 *      termasuk "apapun" (kata yang paling sering dipakai), "ga ada preferensi",
 *      "apa aja boleh", dan "ikut/ngikut/nurut aja". Terparah:
 *      "apapun asal ada gym" menyimpan Gym SAJA — customer yang paling
 *      fleksibel justru mendapat daftar fasilitas paling sempit.
 *
 *  (b) KEPATUHAN LLM — untuk kasus 8 Agu, state block server SUDAH berisi
 *      daftar lengkap (dibuktikan Group 1 di bawah). Model memangkasnya saat
 *      menyalin. Ini kelas M83: state bersih, model tidak patuh → obatnya
 *      CONTOH KONKRET before/after di prompt + skill docs, bukan aturan
 *      abstrak tambahan. Bagian itu diuji lewat Group 4 (isi prompt).
 *
 * Run: node tests/facilityStandardMerge.test.js
 */

'use strict';

require('dotenv').config();

const {
  extractQualificationState,
  buildQualificationStateBlock,
  buildWhatsappReplyPrompt,
} = require('../services/aiPromptBuilderService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const U = (m) => ({ role: 'user', message: m });
const A = (m) => ({ role: 'assistant', message: m });
const QFAC = 'Ada fasilitas yang wajib ada untuk apartemen-nya? Misalnya AC, kolam renang, gym, parkir, atau kitchen set. Kalau tidak ada preferensi khusus, boleh jawab "standar saja" 🛠️';

const stateFor = (answer) => extractQualificationState(
  [U('Saya ingin booking apartemen di Surabaya'), A(QFAC), U(answer)], answer);

const facsOf = (answer) => {
  const f = stateFor(answer).facilities;
  return Array.isArray(f) ? f : [];
};
const hasStd = (answer) => facsOf(answer).some(x => String(x).toLowerCase() === 'standar');

/* ───────────────────────────────────────────────────────────────────────── */
console.log('── Group 1: transkrip produksi — state HARUS memuat daftar lengkap ──');
{
  const ANSWER = 'Fasilitas terserah saja, pokok ada AC dan gym';
  const s = stateFor(ANSWER);
  ok('marker standar menyala', hasStd(ANSWER), JSON.stringify(s.facilities));
  ok('item spesifik customer tetap tersimpan',
     /gym/i.test(JSON.stringify(s.facilities)) && /\bac\b/i.test(JSON.stringify(s.facilities)));

  const block = buildQualificationStateBlock(s);
  const line = (block.match(/.*Fasilitas.*/) || [''])[0];
  ok('baris Fasilitas ada di state block', !!line, block.slice(0, 200));

  // Harus memuat item spesifik DAN fasilitas standar apartemen.
  for (const item of ['Gym', 'AC', 'Kamar Tidur', 'Kamar Mandi', 'Lift', 'Parkir', 'CCTV']) {
    ok(`   state block memuat "${item}"`, new RegExp(item, 'i').test(line), line);
  }
  const count = line.split(':').slice(1).join(':').split(',').length;
  ok('   jumlah fasilitas jauh lebih dari 2 (bukan "AC, Gym" saja)', count > 10, `count=${count}`);
}

console.log('\n── Group 2: 23 cara menjawab "bebas" HARUS menyalakan standar ──');
{
  const flexible = [
    'apapun', 'apa pun', 'apapun boleh', 'apa pun boleh', 'fasilitas apapun',
    'terserah', 'terserah aja', 'terserah kak',
    'standar saja', 'ikut standar', 'sesuai standar', 'yang standar aja',
    'ga ada preferensi', 'gak ada preferensi', 'tidak ada preferensi khusus',
    'apa saja', 'apa aja boleh', 'semua boleh',
    'bebas', 'bebas aja', 'ngikut aja', 'ikut aja', 'nurut aja',
  ];
  for (const a of flexible) ok(`"${a}"`, hasStd(a), JSON.stringify(facsOf(a)));
}

console.log('\n── Group 3: "bebas + item wajib" = standar DAN item, bukan salah satu ──');
{
  const mixed = [
    ['Fasilitas terserah saja, pokok ada AC dan gym', ['Gym', 'AC']],
    ['apapun asal ada gym',                            ['Gym']],
    ['bebas asal ada AC',                              ['AC']],
    ['terserah, pokok ada kolam renang',               ['Kolam renang']],
    ['standar aja, tapi wajib ada parkir',             ['Parkir']],
  ];
  for (const [answer, expected] of mixed) {
    const f = facsOf(answer);
    const j = JSON.stringify(f);
    ok(`"${answer}" → marker standar`, hasStd(answer), j);
    for (const item of expected) {
      ok(`   item "${item}" ikut tersimpan`, f.some(x => String(x).toLowerCase() === item.toLowerCase()), j);
    }
  }
}

console.log('\n  KONTROL NEGATIF — jawaban SPESIFIK jangan ikut ditandai standar:');
{
  for (const a of ['AC dan gym saja', 'wajib ada kolam renang', 'harus ada parkir dan CCTV',
                   'kitchen set, water heater', 'gym', 'kolam renang dan gym']) {
    ok(`"${a}" TIDAK ditandai standar`, !hasStd(a), JSON.stringify(facsOf(a)));
  }
}

console.log('\n── Group 4: prompt memuat contoh konkret anti-pemangkasan (M83) ──');
{
  const S = { id: 1, name: 'N', normalizedPhone: '62', source: 'wa', agentName: 'LEO FELIX' };
  const p = buildWhatsappReplyPrompt(S, [U('Saya ingin booking apartemen di Surabaya')],
                                     'Saya ingin booking apartemen di Surabaya', '', 'chatgpt', {});
  ok('aturan "disalin UTUH" ada di prompt', /disalin UTUH/i.test(p));
  ok('contoh SALAH "AC, Gym" ada di prompt', /Fasilitas: AC, Gym/.test(p));
  ok('contoh BENAR daftar panjang ada di prompt', /Akses Kartu/i.test(p));
  ok('template summary melarang pemangkasan', /JANGAN dipangkas/i.test(p));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);

/**
 * leadScoringAndDeveloperProperty.test.js — regresi M138.
 *
 * TIGA hal baru dari directive pemilik proyek (24 Agu 2026):
 *
 * 1. PENILAI KESERIUSAN CUSTOMER — 7 indikator berbobot, memisahkan lead yang
 *    layak di-follow-up agent dari yang sekadar tanya-tanya.
 * 2. MASTER DEVELOPER PROPERTY + users.developer_property_id — supaya AI bisa
 *    menjawab "dari agensi mana?" dengan DATA, bukan tebakan.
 * 3. SPESIFIKASI UNIT (kamar tidur/mandi) dirender ke katalog yang dilihat LLM
 *    — datanya sudah lama ada tapi TIDAK PERNAH sampai ke AI (kelas gap yang
 *    sama persis dengan certificate_type di M137).
 *
 * Run: node tests/leadScoringAndDeveloperProperty.test.js
 */
'use strict';

require('dotenv').config();
const { scoreLead, isFollowUpWorthy, INDICATORS, MAX_SCORE } = require('../services/leadScoringService');
const { buildAgentIdentityContext } = require('../services/agentIdentityService');
const { formatPropertyRecommendation } = require('../services/propertyRecommendationService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const H = (...msgs) => msgs.map(m => ({ role: 'customer', message: m }));

console.log('\n== Group 1: 7 indikator terdefinisi & berbobot ==');
{
  ok('tepat 7 indikator', INDICATORS.length === 7, String(INDICATORS.length));
  const keys = INDICATORS.map(i => i.key);
  for (const k of ['intent', 'promo', 'developer', 'kpr', 'survey', 'specs', 'upfront_cost']) {
    ok(`indikator "${k}" ada`, keys.includes(k));
  }
  ok('total bobot = 100', MAX_SCORE === 100, String(MAX_SCORE));
  ok('bobot TIDAK rata (sinyal kuat > sinyal murah)',
    new Set(INDICATORS.map(i => i.weight)).size > 1);
  ok('survey & intent adalah bobot tertinggi',
    Math.max(...INDICATORS.map(i => i.weight)) === INDICATORS.find(i => i.key === 'survey').weight);
}

console.log('\n== Group 2: tiap indikator terdeteksi sendiri-sendiri ==');
{
  const probes = {
    intent:       'Saya mau beli rumah di Surabaya',
    promo:        'Ada promo apa aja kak?',
    developer:    'Kakak dari agensi mana ya?',
    kpr:          'Bisa KPR nggak? DP berapa?',
    survey:       'Saya mau survei rumahnya',
    specs:        'Berapa kamar tidur dan kamar mandinya?',
    upfront_cost: 'Biaya notaris dan AJB berapa ya?',
  };
  for (const [key, msg] of Object.entries(probes)) {
    const r = scoreLead({ history: H(msg) });
    ok(`"${key}" terdeteksi dari: "${msg.slice(0, 34)}…"`,
      r.matched.some(m => m.key === key), r.matched.map(m => m.key).join(',') || '(none)');
  }
}

console.log('\n== Group 3: KLASIFIKASI — memisahkan serius dari tanya-tanya ==');
{
  const full = scoreLead({ history: H(
    'Saya mau beli rumah di Surabaya', 'Ada promo tidak?', 'Developernya siapa?',
    'Bisa KPR?', 'Saya mau survei minggu depan', 'Berapa kamar tidurnya?',
    'Biaya notaris dan AJB berapa?'
  )});
  ok('7/7 indikator → skor 100', full.score === 100, String(full.score));
  ok('7/7 → tier "serius"', full.tier === 'serius', full.tier);
  ok('isFollowUpWorthy() true untuk serius', isFollowUpWorthy(full) === true);

  // Skenario NYATA dari pemilik proyek (Andy: beli + pilih listing + survei + spek)
  const andy = scoreLead({ history: H(
    'Saya lagi beli rumah di Puri Surya Sidoarjo. Apakah Ada?',
    'Kak saya pilih yang no 1',
    'Saya bisa survei besok rabu, Kak',
    'Berapa kamar tidurnya?'
  )});
  ok('skenario Andy → tier "serius"', andy.tier === 'serius', `${andy.score} / ${andy.tier}`);

  // KONTROL PALING PENTING: pemburu promo BUKAN lead serius.
  const promoOnly = scoreLead({ history: H('Ada promo apa aja?', 'Diskonnya berapa?') });
  ok('promo SAJA → BUKAN serius (bobot promo sengaja kecil)',
    promoOnly.tier === 'belum serius', `${promoOnly.score} / ${promoOnly.tier}`);
  ok('promo saja → isFollowUpWorthy() false', isFollowUpWorthy(promoOnly) === false);

  // Niat + survei saja (50) SENGAJA belum cukup — butuh 1 sinyal komitmen lain.
  const twoOnly = scoreLead({ history: H('Saya mau beli rumah', 'Mau survei dong') });
  ok('intent+survey saja (50) BELUM serius — label "serius" tidak boleh murah',
    twoOnly.score === 50 && twoOnly.tier === 'potensial', `${twoOnly.score} / ${twoOnly.tier}`);

  ok('percakapan kosong → skor 0', scoreLead({ history: [] }).score === 0);
}

console.log('\n== Group 4: KONTROL — pesan AI TIDAK boleh menaikkan skor customer ==');
{
  // AI bertanya "mau survei?" tapi customer BELUM menjawab. Kalau pesan AI ikut
  // dihitung, skor akan naik tanpa customer melakukan apa pun.
  const aiAsked = scoreLead({ history: [
    { role: 'ai',       message: 'Mau survei kapan, Kak? Apakah mau KPR? Berapa kamar tidur yang dicari?' },
    { role: 'customer', message: 'hmm' },
  ]});
  ok('pertanyaan AI (survei/KPR/kamar) TIDAK dihitung sebagai sinyal customer',
    aiAsked.score === 0, `${aiAsked.score} — matched: ${aiAsked.matched.map(m => m.key).join(',')}`);
}

console.log('\n== Group 5: peran "user" (web) & "customer" (WA) sama-sama dibaca ==');
{
  const asUser = scoreLead({ history: [{ role: 'user', message: 'Saya mau beli rumah dan mau survei' }] });
  ok('role "user" (chatbot web) ikut dihitung', asUser.score > 0, String(asUser.score));
}

console.log('\n== Group 6: blok identitas agensi — fakta, bukan kalimat balasan ==');
{
  const ctx = buildAgentIdentityContext({ developerName: 'BRIGHTON' });
  ok('menyebut brand', /BRIGHTON/.test(ctx));
  ok('membedakan AGENSI vs PENGEMBANG perumahan (cegah salah jawab)',
    /BUKAN pengembang/i.test(ctx));
  ok('tidak diketahui → string kosong (nol token)',
    buildAgentIdentityContext(null) === '' && buildAgentIdentityContext({ developerName: '' }) === '');
}

console.log('\n== Group 7: spesifikasi unit sampai ke teks yang dilihat LLM ==');
{
  const withRooms = formatPropertyRecommendation([{
    title: 'Puri Surya Jaya Tipe A', location: 'Sidoarjo', price: '1.2 miliar',
    buildingType: 'house', transactionType: 'sale',
    bedrooms: 3, bathrooms: 2, buildingArea: '90 m2', landArea: '120 m2',
    address: 'Jl X', facilities: 'Carport', certificateType: 'SHM',
  }]);
  ok('kamar tidur/mandi dirender (3 KT, 2 KM)', /3 KT/.test(withRooms) && /2 KM/.test(withRooms), withRooms);

  const noRooms = formatPropertyRecommendation([{
    title: 'Rumah Tanpa Data', location: 'Gresik', price: '800 juta',
    buildingType: 'house', transactionType: 'sale',
    bedrooms: 0, bathrooms: 0, buildingArea: '70 m2', landArea: '90 m2',
    address: 'Jl Z', facilities: '-', certificateType: 'SHM',
  }]);
  ok('0 kamar diperlakukan BELUM DIISI (default kolom 0, bukan "nol kamar")',
    /Rooms: BELUM DIISI/.test(noRooms), noRooms);
  ok('instruksi jangan menebak jumlah kamar ikut dirender',
    /jangan menebak jumlah kamar/i.test(noRooms));

  // formatPropertyItem mengganti kosong dengan '-' (truthy) — pastikan tidak bocor.
  const noFurnish = formatPropertyRecommendation([{
    title: 'X', location: 'Y', price: '1 juta', buildingType: 'house', transactionType: 'rent',
    bedrooms: 2, bathrooms: 1, furnishedStatus: '', buildingArea: '50 m2', landArea: '60 m2',
    address: 'Jl A', facilities: '-',
  }]);
  ok('furnished kosong TIDAK dirender sebagai "Furnished: -"',
    !/Furnished:\s*-/.test(noFurnish), noFurnish);
  ok('listing SEWA tetap tanpa baris Certificate (M137 utuh)',
    !/Certificate:/.test(noFurnish));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

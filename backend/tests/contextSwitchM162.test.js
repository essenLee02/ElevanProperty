'use strict';
/**
 * contextSwitchM162.test.js — regresi M162.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * APA YANG DIJAGA FILE INI
 * ══════════════════════════════════════════════════════════════════════════
 * M154 sudah menyatukan aturan "ganti kota / transaksi / tipe" ke SATU tabel
 * (utils/contextSwitchPolicy.js) untuk urusan LUPA/INGAT field. Yang belum
 * disatukan — dan itulah yang diperbaiki M162 — adalah dua hal berikutnya:
 *
 *   (A) DEFINISI SLOT MINIMUM KE-4.
 *       utils/listingReadiness.js  → district ATAU area ATAU landmark.
 *       findNextQuestion() Q2c     → HANYA district.
 *       buildQualifyReply()        → BUDGET (definisi pra-M134 yang tertinggal).
 *       Tiga komponen, tiga jawaban berbeda untuk satu pertanyaan yang sama.
 *
 *   (B) PERTANYAAN BERIKUTNYA SETELAH GANTI KOTA.
 *       Ganti kota mengosongkan district+anchorPoint dan menyalakan
 *       q2cDeclined. Karena Q2c ditekan dan Q6 duduk di posisi ke-6 cascade,
 *       pertanyaan berikutnya menjadi Q2b ("sudah lihat berapa rumah di
 *       Malang?") — bukan patokan lokasi. Spec pemilik proyek untuk GANTI KOTA
 *       item 1 harfiah: "Tanyakan ulang lokasi landmark saja."
 *
 * KENAPA (A) BERBAHAYA, bukan sekadar tidak rapi: blok state (✅/❓), blok
 * SYARAT MINIMUM LISTING, dan DIREKTIF PERTANYAAN BERIKUTNYA semuanya masuk ke
 * SATU prompt. Kalau ketiganya tidak sepakat, LLM menerima fakta yang saling
 * bertentangan tentang hal yang sama dan memilih yang berbentuk PERINTAH →
 * menanyakan ulang lokasi yang baru saja disebut customer.
 *
 * Run: node tests/contextSwitchM162.test.js
 */

require('dotenv').config();

const { extractQualificationState, findNextQuestion } = require('../services/aiPromptBuilderService');
const { buildQualifyReply } = require('../services/whatsappAIService');
const { evaluateListingReadiness } = require('../utils/listingReadiness');
const { detectCanonicalType, detectCanonicalTransaction } = require('../services/propertyRecommendationService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};
const eq = (label, actual, expected) =>
  ok(label, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);

const C = (m) => ({ role: 'customer',  message: m });
const A = (m) => ({ role: 'assistant', message: m });

/** Transkrip lengkap: keempat slot minimum terisi + tanggal + survei. */
const FULL = [
  C('Mau sewa rumah di Surabaya'),
  A('Di area atau kawasan mana di Surabaya yang Anda pertimbangkan?'),
  C('Area Pakuwon'),
  A('Ada lokasi atau tempat tertentu yang jadi patokan?'),
  C('dekat PTC'),
  A('Budgetnya berapa kak?'),
  C('sekitar 5 juta per bulan'),
  A('Kapan rencana masuk?'),
  C('1 September 2026'),
  A('Kalau ada yang cocok, bisa jadwalkan viewing?'),
  C('Bisa, saya sendiri yang memutuskan'),
];

/* ══════════════════════════════════════════════════════════════════════════
   Group 1 — SLOT KE-4 = LOKASI SPESIFIK (district ATAU patokan ATAU landmark)
   ══════════════════════════════════════════════════════════════════════════
   Bug nyata: customer menyebut PATOKAN tanpa nama area ("dekat Bandara
   Juanda"). anchorPoint terisi, district null. Gerbang Q2c lama hanya melihat
   district → AI bertanya "di area mana di Surabaya?" untuk lokasi yang BARU
   SAJA disebut, DAN gerbang SHOW_LISTINGS (M140) di bawahnya tidak pernah
   tercapai karena `return` Q2c mendahuluinya. */
console.log('\n── Group 1: patokan lokasi mengisi slot ke-4, sama seperti nama area ──');
{
  const st = extractQualificationState(
    [C('Mau sewa rumah di Surabaya dekat Bandara Juanda'), A('Baik kak')],
    'iya dekat bandara aja',
  );
  ok('patokan tertangkap', !!st.anchorPoint, JSON.stringify(st.anchorPoint));
  ok('nama area memang kosong (kondisi bug)', !st.district, JSON.stringify(st.district));
  eq('TIDAK menanyakan area lagi → langsung SHOW_LISTINGS', findNextQuestion(st).q, 'SHOW_LISTINGS');
}
{
  // Kontrol: benar-benar tidak ada lokasi spesifik → Q2c WAJIB muncul.
  const st = extractQualificationState([C('Mau sewa rumah'), A('Di kota mana?')], 'Surabaya');
  eq('tanpa area & tanpa patokan → Q2c', findNextQuestion(st).q, 'Q2c');
}
{
  // Nama area saja (tanpa patokan) juga sah — jangan minta patokan dulu.
  const st = extractQualificationState(
    [C('Mau cari rumah di Citraland Surabaya'), A('sewa atau beli kak?')],
    'Rencana beli',
  );
  eq('area saja sudah cukup → SHOW_LISTINGS', findNextQuestion(st).q, 'SHOW_LISTINGS');
}

/* ══════════════════════════════════════════════════════════════════════════
   Group 2 — GANTI KOTA: yang ditanya HANYA patokan/landmark
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n── Group 2: GANTI KOTA (spec item 1-5) ──');
{
  const st = extractQualificationState(FULL, 'pindah ke Malang saja');

  eq('kota berpindah', st.city, 'Malang');
  eq('pertanyaan berikutnya = Q6 (patokan), BUKAN Q2b/Q3/Q8', findNextQuestion(st).q, 'Q6');
  ok('pertanyaannya memang soal patokan lokasi',
    /patokan/i.test(findNextQuestion(st).hint || ''), findNextQuestion(st).hint);

  // item 2-5: semua ini HARAM ditanya ulang.
  eq('item 2 — transaksi tetap',        st.transactionType, 'rent');
  eq('item 2b — tipe properti tetap',   st.buildingType,    'house');
  ok('item 3 — tanggal pindah tetap',   !!st.moveInDate,    JSON.stringify(st.moveInDate));
  ok('item 4 — info survei tetap',      !!st.decisionMaker, JSON.stringify(st.decisionMaker));
  ok('item 5 — budget tetap (bukan turunan kota)', !!st.budget, JSON.stringify(st.budget));

  // Yang memang harus dilupakan: lokasi yang terikat kota LAMA.
  ok('area kota lama dibuang',    !st.district,    JSON.stringify(st.district));
  ok('patokan kota lama dibuang', !st.anchorPoint, JSON.stringify(st.anchorPoint));
}
{
  // "Jakarta" → "Jakarta Selatan" adalah PERINCIAN, bukan ganti kota.
  const st = extractQualificationState(
    [C('Mau sewa apartemen di Jakarta'), A('Di area mana?'), C('Area Kuningan')],
    'lebih tepatnya Jakarta Selatan',
  );
  ok('perincian kota TIDAK membuang area', !!st.district, JSON.stringify(st.district));
}

/* ══════════════════════════════════════════════════════════════════════════
   Group 3 — GANTI TRANSAKSI & GANTI PROPERTI: lokasi & survei tidak diusik
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\n── Group 3: GANTI TRANSAKSI (item 3-6) & GANTI PROPERTI (item 2-6) ──');
{
  const st = extractQualificationState(FULL, 'eh saya mau beli aja deh');
  eq('transaksi berpindah', st.transactionType, 'sale');
  eq('item 3 — kota tetap',      st.city,     'Surabaya');
  eq('item 4 — landmark tetap',  st.anchorPoint, 'dekat PTC');
  ok('item 4b — area tetap',     !!st.district,     JSON.stringify(st.district));
  ok('item 5 — tanggal tetap',   !!st.moveInDate,   JSON.stringify(st.moveInDate));
  ok('item 6 — survei tetap',    !!st.decisionMaker, JSON.stringify(st.decisionMaker));
  ok('item 1 — budget digali ulang (rentang beli ≠ sewa)', !st.budget, JSON.stringify(st.budget));
}
{
  const st = extractQualificationState(FULL, 'apartemen aja deh');
  eq('tipe berpindah',           st.buildingType, 'apartment');
  eq('item 3 — transaksi tetap', st.transactionType, 'rent');
  eq('item 2 — kota tetap',      st.city, 'Surabaya');
  eq('item 4 — landmark tetap',  st.anchorPoint, 'dekat PTC');
  ok('item 5 — tanggal tetap',   !!st.moveInDate,    JSON.stringify(st.moveInDate));
  ok('item 6 — survei tetap',    !!st.decisionMaker, JSON.stringify(st.decisionMaker));
}
{
  // Compound (tipe + transaksi bersamaan, kota TIDAK ikut) — pencarian baru,
  // tapi lokasi & survei tetap. Tipe/transaksi BARU SAJA disebut: menanyakannya
  // lagi adalah pengulangan yang dilarang eksplisit.
  const st = extractQualificationState(FULL, 'saya mau beli apartemen aja');
  eq('tipe baru',      st.buildingType,    'apartment');
  eq('transaksi baru', st.transactionType, 'sale');
  eq('kota tetap',     st.city, 'Surabaya');
  ok('survei tetap',   !!st.decisionMaker, JSON.stringify(st.decisionMaker));
  const nq = findNextQuestion(st);
  ok('tidak kembali ke Q1 (tipe/transaksi baru saja dijawab)', nq.q !== 'Q1', nq.q);
  ok('tidak menanyakan ulang kota',                            nq.q !== 'Q2', nq.q);
}

/* ══════════════════════════════════════════════════════════════════════════
   Group 4 — GERBANG KUALIFIKASI: slot ke-4 bukan budget
   ══════════════════════════════════════════════════════════════════════════
   Kontrak yang dijaga: buildQualifyReply() dan evaluateListingReadiness()
   HARUS selalu sepakat. Kalau tidak, prompt memuat dua fakta berlawanan dan
   AI menanyakan ulang informasi yang sudah ada. */
console.log('\n── Group 4: gerbang kualifikasi sepakat dengan listingReadiness ──');
{
  const complete = {
    buildingType: 'house', transactionType: 'rent', location: 'Surabaya',
    district: 'Pakuwon', budget: null,
  };
  ok('readiness: siap tanpa budget', evaluateListingReadiness(complete).ready === true);
  eq('gerbang: lolos tanpa budget',
    buildQualifyReply(complete, 'oke', 'Leo', 'none', [], 'ON'), null);
}
{
  const anchorOnly = {
    buildingType: 'house', transactionType: 'rent', location: 'Surabaya',
    landmark: 'dekat PTC', budget: null,
  };
  ok('readiness: patokan mengisi slot ke-4', evaluateListingReadiness(anchorOnly).ready === true);
  eq('gerbang: patokan juga meloloskan',
    buildQualifyReply(anchorOnly, 'oke', 'Leo', 'none', [], 'ON'), null);
}
{
  const noSpec = { buildingType: 'house', transactionType: 'rent', location: 'Surabaya', budget: '5jt' };
  const r = buildQualifyReply(noSpec, 'Surabaya', 'Leo', 'none', [], 'ON');
  ok('budget terisi tapi lokasi spesifik kosong → tetap bertanya', !!r);
  ok('yang ditanya adalah area/patokan, BUKAN harga',
    r && /area|kawasan|patokan/i.test(r.reply) && !/kisaran harga/i.test(r.reply), r && r.reply);
  ok('readiness setuju slot yang kurang adalah lokasi spesifik',
    evaluateListingReadiness(noSpec).missing.join() === 'specificLocation');
}

/* ══════════════════════════════════════════════════════════════════════════
   Group 5 — DETEKTOR KANONIK: satu salinan untuk jalur LLM & Private Agent
   ══════════════════════════════════════════════════════════════════════════
   Salinan di chatbotPrivateController.js sudah menyimpang: ia kehilangan
   varian "ngekos" pada tipe DAN seluruh frame booking pada transaksi, walau
   komentarnya menyatakan dirinya identik dengan kembarannya. */
console.log('\n── Group 5: detektor tipe/transaksi kanonik (anti-drift) ──');
{
  for (const w of ['ngekos', 'ngekost', 'ngekosan', 'indekos', 'indekost', 'kost', 'kosan', 'kostan'])
    eq(`"${w}" → boarding_house`, detectCanonicalType(`mau ${w} di Depok`), 'boarding_house');

  eq('"ngekos" juga berarti transaksi sewa', detectCanonicalTransaction('mau ngekos di Depok'), 'rent');
  for (const w of ['booking', 'pesan', 'reservasi'])
    eq(`frame booking "${w}" → rent`, detectCanonicalTransaction(`mau ${w} hotel di Bali`), 'rent');

  // Urutan spesifik-dulu: kata yang bersarang tidak boleh saling menelan.
  eq('kondotel tidak terbaca hotel',   detectCanonicalType('mau kondotel di Bali'),   'kondotel');
  eq('rumah mewah → mansion',          detectCanonicalType('cari rumah mewah'),        'mansion');
  eq('ruko tidak terbaca toko',        detectCanonicalType('sewa ruko dua lantai'),    'shophouse');

  // Guard lama harus tetap hidup setelah dipindah modul.
  eq('"rumah makan" bukan rumah',      detectCanonicalType('dekat rumah makan padang'), null);
  eq('"disewakan lagi" tetap sale',    detectCanonicalTransaction('beli buat investasi, mau disewakan lagi'), 'sale');
}

/* ══════════════════════════════════════════════════════════════════════════
   Group 6 — SHOW_LISTINGS tidak pernah memakai penolakan sebagai nama tempat
   ══════════════════════════════════════════════════════════════════════════
   M84: penolakan = jawaban, jadi "bebas"/"terserah" SAH mengisi slot lokasi.
   Tapi ia bukan NAMA TEMPAT: tanpa guard, direktifnya berbunyi "tampilkan
   listing di bebas, Surabaya" dan LLM meneruskannya apa adanya ke customer. */
console.log('\n── Group 6: jangkar listing tidak boleh berupa penolakan ──');
{
  for (const placeless of ['bebas', 'terserah', 'tidak ada', 'mana saja']) {
    const nq = findNextQuestion({
      transactionType: 'rent', buildingType: 'house', city: 'Surabaya',
      anchorPoint: placeless, listingsShown: false,
    });
    eq(`"${placeless}" tetap meloloskan gerbang listing`, nq.q, 'SHOW_LISTINGS');
    ok(`"${placeless}" TIDAK dipakai sebagai nama tempat`,
      !new RegExp(`di ${placeless},`, 'i').test(nq.hint || ''), nq.hint);
    ok(`"${placeless}" → jangkar jatuh ke kota`, /di Surabaya,/i.test(nq.hint || ''), nq.hint);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Group 7 — SKILL DOCS TIDAK BOLEH MENGAJARKAN ATURAN LAMA
   ══════════════════════════════════════════════════════════════════════════
   Pelajaran skill-docs-M124-sync: dokumen yang masih mengajarkan perilaku lama
   membuat LLM membantah kode yang sudah diperbaiki. Kalau doc 03 masih menulis
   "④ budget" sebagai slot minimum, model akan menanyakan harga lebih dulu
   walau backend sudah berhenti memaksanya. */
console.log('\n── Group 7: skill docs sinkron dengan kode ──');
{
  const fs   = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '..', '..', 'skills');
  const FOLDERS = ['claude_responds', 'chat_gpt_responds', 'elevan-property-assistant'];

  for (const folder of FOLDERS) {
    const doc = fs.readFileSync(path.join(root, folder, 'docs', '03-qualification-flow.md'), 'utf8');
    ok(`${folder}: slot ke-4 dinyatakan LOKASI SPESIFIK`,
      /④\s*specificLocation/.test(doc));
    ok(`${folder}: slot ke-4 TIDAK lagi budget`,
      !/④\s*budget\s+—/.test(doc));
    ok(`${folder}: menyatakan budget bukan prasyarat listing`,
      /budget is never a precondition for showing listings/i.test(doc));
    ok(`${folder}: menyatakan area & landmark adalah SATU slot`,
      /Area and landmark are ONE slot/i.test(doc));
    ok(`${folder}: setelah ganti kota, pertanyaannya landmark`,
      /after a city change, the ONE question is the landmark/i.test(doc));
  }

  const a = fs.readFileSync(path.join(root, 'claude_responds',   'docs', '03-qualification-flow.md'));
  const b = fs.readFileSync(path.join(root, 'chat_gpt_responds', 'docs', '03-qualification-flow.md'));
  ok('claude_responds & chat_gpt_responds doc 03 tetap BYTE-IDENTICAL', a.equals(b));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` ❌ ${fail} FAILED` : ' ✅ ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

/**
 * listingReadinessAndAmbiguityStrikes.test.js — regresi M134.
 *
 * DUA aturan baru dari directive pemilik proyek (24 Agu 2026):
 *
 * 1. SYARAT MINIMUM LISTING berubah: tipe + transaksi + kota + LOKASI SPESIFIK
 *    (area/landmark/commercial). Budget TIDAK lagi jadi syarat — customer lazim
 *    menyesuaikan harga SETELAH melihat pilihan.
 *
 * 2. ESKALASI AMBIGUITAS: arahkan (strike 1) → tutup obrolan (strike 2) →
 *    DIAM (strike 3+). Satu pesan properti yang sah MERESET semuanya.
 *
 * Run: node tests/listingReadinessAndAmbiguityStrikes.test.js
 */
'use strict';

require('dotenv').config();
const { evaluateListingReadiness, buildListingReadinessContext } = require('../utils/listingReadiness');
const strikes = require('../utils/ambiguityStrikes');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

console.log('\n== Group 1: syarat minimum — 4 slot, budget BUKAN salah satunya ==');
{
  const full = evaluateListingReadiness({
    buildingType: 'apartment', transactionType: 'sale', location: 'Gresik', district: 'Kebomas',
  });
  ok('tipe+transaksi+kota+area → ready', full.ready === true, JSON.stringify(full.missing));
  ok('ready TANPA budget sama sekali (perubahan inti M134)', full.ready === true);

  const noLoc = evaluateListingReadiness({
    buildingType: 'apartment', transactionType: 'sale', location: 'Gresik', budget: { min: 1e6, max: 5e6 },
  });
  ok('punya budget TAPI tanpa lokasi spesifik → BELUM ready', noLoc.ready === false);
  ok('menyebut lokasi spesifik sebagai yang kurang',
    noLoc.missingLabels.some((l) => /area|patokan/i.test(l)), JSON.stringify(noLoc.missingLabels));
}

console.log('\n== Group 2: lokasi spesifik boleh dari area, landmark, ATAU commercial ==');
{
  const base = { buildingType: 'apartment', transactionType: 'sale', location: 'Gresik' };
  ok('district ("Kebomas") memenuhi slot lokasi',
    evaluateListingReadiness({ ...base, district: 'Kebomas' }).ready === true);
  ok('area ("Pakuwon Indah") memenuhi slot lokasi',
    evaluateListingReadiness({ ...base, area: 'Pakuwon Indah' }).ready === true);
  ok('landmark ("PTC") memenuhi slot lokasi — commercial/landmark masuk lewat sini',
    evaluateListingReadiness({ ...base, landmark: 'Pakuwon Trade Center' }).ready === true);
}

console.log('\n== Group 3: blok konteks readiness — deskriptif, bukan perintah ==');
{
  const readyCtx = buildListingReadinessContext(evaluateListingReadiness({
    buildingType: 'house', transactionType: 'sale', location: 'Sidoarjo', district: 'Alam Djuanda',
  }));
  ok('status TERPENUHI dinyatakan eksplisit', /SYARAT MINIMUM LISTING: TERPENUHI/.test(readyCtx));
  ok('menegaskan budget bukan syarat', /[Bb]udget bukan syarat|tanpa menunggu budget/.test(readyCtx), readyCtx);

  const notReady = buildListingReadinessContext(evaluateListingReadiness({ buildingType: 'house' }));
  ok('status BELUM TERPENUHI dinyatakan eksplisit', /BELUM TERPENUHI/.test(notReady));
  ok('melarang tampilkan listing sebelum lengkap', /JANGAN tampilkan listing/i.test(notReady));
  ok('meminta satu pertanyaan per pesan', /SATU per pesan/i.test(notReady));
  ok('fail-open: readiness null → string kosong (nol token)', buildListingReadinessContext(null) === '');
}

console.log('\n== Group 4: eskalasi ambiguitas — arahkan → tutup → diam ==');
{
  strikes.resetAll();
  const S = 'sess-m134-a';
  ok('belum ada strike → stage none', strikes.peekStage(S).stage === 'none');
  ok('strike 1 → redirect', strikes.recordAmbiguous(S).stage === 'redirect');
  ok('strike 2 → closing',  strikes.recordAmbiguous(S).stage === 'closing');
  ok('strike 3 → silent',   strikes.recordAmbiguous(S).stage === 'silent');
  ok('strike 4 tetap silent', strikes.recordAmbiguous(S).stage === 'silent');
  ok('isSilenced() true setelah tahap diam', strikes.isSilenced(S) === true);
}

console.log('\n== Group 5: KONTROL PALING PENTING — pesan properti sah MERESET diam ==');
{
  strikes.resetAll();
  const S = 'sess-m134-b';
  strikes.recordAmbiguous(S); strikes.recordAmbiguous(S); strikes.recordAmbiguous(S);
  ok('terkunci diam dulu', strikes.isSilenced(S) === true);

  strikes.clearStrikes(S);   // ← dipanggil controller saat pesan properti sah masuk
  ok('setelah pesan properti sah → TIDAK lagi diam (diam bersifat sementara)',
    strikes.isSilenced(S) === false);
  ok('hitungan benar-benar direset ke none', strikes.peekStage(S).stage === 'none');
  ok('strike berikutnya mulai dari redirect lagi, bukan langsung diam',
    strikes.recordAmbiguous(S).stage === 'redirect');
}

console.log('\n== Group 6: sesi terpisah tidak saling mempengaruhi ==');
{
  strikes.resetAll();
  strikes.recordAmbiguous('sess-x'); strikes.recordAmbiguous('sess-x'); strikes.recordAmbiguous('sess-x');
  ok('sess-x diam', strikes.isSilenced('sess-x') === true);
  ok('sess-y TIDAK ikut terdiamkan (isolasi per sesi)', strikes.isSilenced('sess-y') === false);
}

console.log('\n== Group 7: teks penutup hanya untuk profil local ==');
{
  const closing = strikes.buildClosingReply('Natasha Auwliandy', true);
  ok('minta maaf + mengakhiri obrolan', /maaf/i.test(closing) && /akhiri/i.test(closing));
  ok('mengundang kembali untuk kebutuhan properti', /chat saya lagi|kapan saja/i.test(closing));
  ok('memakai nama agent dinamis (bukan hardcode)', closing.includes('Natasha Auwliandy'));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

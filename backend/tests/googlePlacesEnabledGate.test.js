/**
 * googlePlacesEnabledGate.test.js — regresi M128.
 *
 * Permintaan pemilik proyek: matikan Google Maps Platform (Places Text
 * Search + Geocoding) lewat satu saklar env, backend/.env/GOOGLE_ENABLED=false
 * — terlepas dari apakah GOOGLE_API_KEY masih terisi (kredensial boleh tetap
 * ada, tapi service tidak boleh memanggilnya sama sekali saat dimatikan).
 *
 * Run: node tests/googlePlacesEnabledGate.test.js
 */
'use strict';

let pass = 0, total = 0;
const ok = (n, c, extra = '') => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); } };

function freshService() {
  delete require.cache[require.resolve('../services/googlePlacesService')];
  return require('../services/googlePlacesService');
}

console.log('\n== isGoogleEnabled() — pembacaan flag ==');
{
  delete process.env.GOOGLE_ENABLED;
  let svc = freshService();
  ok('default AKTIF (true) bila GOOGLE_ENABLED tidak diisi sama sekali', svc.isGoogleEnabled() === true);

  process.env.GOOGLE_ENABLED = 'false';
  svc = freshService();
  ok('GOOGLE_ENABLED=false → nonaktif', svc.isGoogleEnabled() === false);

  process.env.GOOGLE_ENABLED = 'true';
  svc = freshService();
  ok('GOOGLE_ENABLED=true → aktif', svc.isGoogleEnabled() === true);

  process.env.GOOGLE_ENABLED = '0';
  svc = freshService();
  ok('GOOGLE_ENABLED=0 juga dianggap nonaktif', svc.isGoogleEnabled() === false);

  delete process.env.GOOGLE_ENABLED;
}

console.log('\n== warmCityLandmarksCache() — TIDAK PERNAH memanggil axios saat dimatikan ==');
{
  // ⚠️ Sekadar mengecek hasil ([] / null) TIDAK CUKUP — kunci API tidak valid
  // pun akan menghasilkan [] lewat jalur catch(), membuat A/B non-vacuousness
  // proof gagal mendeteksi gerbang yang dimatikan (network attempt tetap
  // terjadi, hanya gagal karena alasan lain). Mock axios.get langsung —
  // dipanggil SAMA SEKALI berarti gerbang bocor, terlepas dari hasil akhirnya.
  process.env.GOOGLE_ENABLED = 'false';
  process.env.GOOGLE_API_KEY = 'fake-key-would-normally-work';
  const svc = freshService();

  const axios = require('axios');
  let axiosCalled = false;
  const origGet = axios.get;
  axios.get = (...args) => { axiosCalled = true; return origGet.apply(axios, args); };

  (async () => {
    const result = await svc.warmCityLandmarksCache('KotaUjiM128');
    ok('warmCityLandmarksCache resolve ke array kosong (fail-open), bukan error', Array.isArray(result) && result.length === 0);
    ok('axios.get TIDAK PERNAH dipanggil (gerbang benar-benar mencegah network call)', axiosCalled === false);

    const geo = await svc.geocodeAddress('Pakuwon Mall Surabaya');
    ok('geocodeAddress return null (fail-open), bukan error', geo === null);
    ok('axios.get MASIH TIDAK dipanggil setelah geocodeAddress juga', axiosCalled === false);

    axios.get = origGet;
    delete process.env.GOOGLE_ENABLED;
    delete process.env.GOOGLE_API_KEY;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`RESULT: ${pass}/${total} passed${pass === total ? ' ALL PASS' : ' (FAILURES)'}`);
    process.exit(pass === total ? 0 : 1);
  })();
}

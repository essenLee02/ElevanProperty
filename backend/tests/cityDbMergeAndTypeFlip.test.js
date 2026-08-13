/**
 * cityDbMergeAndTypeFlip.test.js — regresi M92.
 *
 * DUA transkrip produksi 13 Agu 2026, dua akar yang berbeda.
 *
 * ── CASE 1: "Jakarta" tidak dikenali sebagai kota ─────────────────────────
 *   Customer menulis "Di kota Jakarta" / "Kota Jakarta" / "Jakarta.." LIMA
 *   kali; tiap kali dijawab pertanyaan kota yang SAMA PERSIS.
 *   Akar: getKnownLocations() dulu berbunyi
 *       const cityNames = _dbCities.length ? _dbCities : FALLBACK_LOCATION_KEYWORDS;
 *   Begitu tabel `cities` terisi APA PUN, seluruh daftar statis DIBUANG —
 *   sehingga kota yang belum dimasukkan ke master data menjadi TIDAK DIKENALI
 *   walau sudah ada di daftar statis. Terlihat seperti "AI tidak paham Jakarta
 *   itu kota"; sebenarnya DB menutupi pengetahuan yang sudah dimiliki sistem.
 *   ⚠️ Modul saudaranya (propertyKeywordFilter.initLocationCache) MENGGABUNG
 *   sejak awal — dua modul, konsep sama, semantik merge BERLAWANAN.
 *
 * ── CASE 2: jawaban red flag mereset seluruh percakapan ───────────────────
 *   Customer sedang mencari APARTEMEN (Surabaya, Pakuwon, Oktober, 3 kamar),
 *   lalu menjawab Q5: "Saya tidak ingin rumah hadap utara, gang sempit atau
 *   rumah tua". Kata "rumah" terbaca sebagai TIPE PROPERTI →
 *   buildingType apartment→house → sessionAnchors.reconcile() menganggap
 *   customer memulai pencarian baru → clearAnchors() → transaksi & lokasi
 *   TERHAPUS → gerbang mengulang dari nol ("Untuk Rumah yang Anda cari —
 *   sewa atau beli? kota mana? harga?") padahal semuanya sudah dijawab.
 *
 * Run: node tests/cityDbMergeAndTypeFlip.test.js
 */

'use strict';

require('dotenv').config();

const Module = require('module');
const path = require('path');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

/**
 * Muat propertyRecommendationService dengan model City PALSU, lalu jalankan
 * initCityCache(). Meniru master data yang BELUM lengkap — kondisi produksi
 * yang memicu bug ini.
 */
async function loadServiceWithCities(cityNames) {
  const svcPath = require.resolve('../services/propertyRecommendationService');
  delete require.cache[svcPath];

  const origLoad = Module._load;
  Module._load = function (req, parent) {
    if (req === '../models' && parent && parent.filename === svcPath) {
      return { City: { findAll: async () => cityNames.map((n) => ({ name: n })) } };
    }
    return origLoad.apply(this, arguments);
  };
  try {
    const svc = require(svcPath);
    await svc.initCityCache();
    return svc;
  } finally {
    Module._load = origLoad;
  }
}

const C = (m) => ({ role: 'customer', message: m });
const A = (m) => ({ role: 'ai', message: m });

(async () => {
  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('── CASE 1 Group 1: DB kota TIDAK memuat Jakarta ──');
  {
    // Persis kondisi produksi: master data hanya sebagian kota.
    const svc = await loadServiceWithCities(['SURABAYA', 'MALANG']);

    for (const msg of ['Di kota Jakarta', 'Kota Jakarta', 'Jakarta..', 'Jakarta',
                       'Area Saya sewa di kota Jakarta']) {
      ok(`"${msg}" → Jakarta`, /jakarta/i.test(svc.detectLocation(msg) || ''),
         `got=${svc.detectLocation(msg)}`);
    }

    // Kota yang ADA di DB tetap jalan.
    ok('kota dari DB tetap dikenali (Surabaya)', /surabaya/i.test(svc.detectLocation('Di kota Surabaya') || ''));
    ok('kota dari DB tetap dikenali (Malang)',   /malang/i.test(svc.detectLocation('Di kota Malang') || ''));

    // Kota lain di daftar statis juga tidak boleh hilang.
    for (const [msg, expect] of [['Di kota Bandung', 'Bandung'], ['Di kota Denpasar', 'Denpasar'],
                                 ['Di kota Semarang', 'Semarang'], ['Di kota Medan', 'Medan']]) {
      ok(`"${msg}" tetap dikenali`, new RegExp(expect, 'i').test(svc.detectLocation(msg) || ''),
         `got=${svc.detectLocation(msg)}`);
    }
  }

  console.log('\n── CASE 1 Group 2: DB kosong / gagal → fallback statis utuh ──');
  {
    const svc = await loadServiceWithCities([]);
    for (const [msg, expect] of [['Di kota Jakarta', 'Jakarta'], ['Di kota Surabaya', 'Surabaya']]) {
      ok(`DB kosong: "${msg}"`, new RegExp(expect, 'i').test(svc.detectLocation(msg) || ''),
         `got=${svc.detectLocation(msg)}`);
    }
  }

  console.log('\n── CASE 1 Group 3: alur gerbang lengkap (4 info terkumpul) ──');
  {
    const svc = await loadServiceWithCities(['SURABAYA', 'MALANG']);
    const GATE = 'Baik! Mau sewa Apartemen. 📍\n\nDi kota mana yang Anda inginkan?';
    const hist = [C('Hi cari book apartemen'), A(GATE), C('Cari 2-4 juta/minggu'), A(GATE)];
    const f = svc.extractPropertyFilters('Di kota Jakarta', hist);

    ok('tipe = apartment', f.buildingType === 'apartment', f.buildingType);
    ok('transaksi = rent',  f.transactionType === 'rent',  f.transactionType);
    ok('lokasi = Jakarta',  /jakarta/i.test(f.location || ''), f.location);
    ok('budget tertangkap', !!f.budget, JSON.stringify(f.budget));
    ok('KEEMPAT info lengkap → gerbang TIDAK boleh mengulang pertanyaan kota',
       !!(f.buildingType && f.transactionType && f.location && f.budget));
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('\n── CASE 2 Group 4: jawaban red flag TIDAK boleh membalik tipe ──');
  {
    const svc = await loadServiceWithCities(['SURABAYA']);
    const hist = [
      C('Saya mau tanya tentang sewa apartemen'), A('Di kota mana?'),
      C('Kota surabaya, budget 5-10juta per bulan'), A('Di area atau kawasan mana di Surabaya? 📍'),
      C('Kawasan pakuwon'), A('Sudah lihat berapa Apartemen di Surabaya?'),
      C('Saya belum lihat beberapa apartemen surabaya'), A('Rencananya masuk bulan apa? 📅'),
      C('Bulan oktober'), A('Nanti akan tinggal bersama siapa saja? 🛏️'),
      C('Tinggal sama orang tua.. carikan yg 3 kamar'),
      A('Ada yang pasti tidak cocok? Misalnya yang hadap barat, gang sempit, atau rumah tua? 🚫'),
    ];
    const RED = 'Saya tidak ingin rumah hadap utara, gang sempit atau rumah tua';
    const f = svc.extractPropertyFilters(RED, hist);

    ok('tipe TETAP apartment (tidak flip ke house)', f.buildingType === 'apartment', f.buildingType);
    ok('transaksi TETAP rent (tidak hilang)',        f.transactionType === 'rent',  f.transactionType);
    ok('lokasi TETAP Surabaya',                      /surabaya/i.test(f.location || ''), f.location);
    ok('budget TETAP ada',                           !!f.budget, JSON.stringify(f.budget));
  }

  console.log('\n  KONTROL NEGATIF — permintaan "rumah" ASLI harus tetap terdeteksi:');
  {
    const svc = await loadServiceWithCities(['SURABAYA']);
    for (const msg of ['Saya mau beli rumah di Malang', 'cari rumah sewa Surabaya',
                       'mau sewa rumah', 'rumah 3 kamar di Jakarta']) {
      ok(`"${msg}" → house`, svc.extractPropertyFilters(msg, []).buildingType === 'house',
         svc.extractPropertyFilters(msg, []).buildingType);
    }
  }

  console.log('\n  Frasa penghindaran TIDAK boleh dibaca sebagai tipe:');
  {
    const svc = await loadServiceWithCities(['SURABAYA']);
    for (const msg of ['Saya tidak ingin rumah tua', 'jangan rumah dekat rel',
                       'hindari rumah hadap barat', 'selain rumah tua, apa saja boleh']) {
      ok(`"${msg}" bukan permintaan tipe`, !svc.extractPropertyFilters(msg, []).buildingType,
         svc.extractPropertyFilters(msg, []).buildingType);
    }
    // "rumah makan"/"rumah sakit" (aturan lama) harus tetap aman.
    ok('"deket rumah makan" bukan tipe', !svc.extractPropertyFilters('cari yang deket rumah makan', []).buildingType);
    ok('"deket rumah sakit" bukan tipe', !svc.extractPropertyFilters('cari yang deket rumah sakit', []).buildingType);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });

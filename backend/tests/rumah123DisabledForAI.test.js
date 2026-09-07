/**
 * rumah123DisabledForAI.test.js
 *
 * M94 — RUMAH123 DIMATIKAN DARI SELURUH KONTEKS AI.
 *
 * Keputusan bisnis: terminal message & AI hanya boleh merekomendasikan katalog
 * milik agent sendiri (Property + PropertyImage + PropertyFacility di database).
 * Listing pihak ketiga tidak boleh muncul sebagai rekomendasi AI. Halaman
 * Rumah123 (/api/rumah123/*) TETAP berfungsi penuh — yang dimatikan hanya
 * injeksi ke prompt AI.
 *
 * DUA CACAT NYATA YANG DITEMUKAN SAAT MENGERJAKAN INI:
 *
 *  (a) CHATBOT WEB TIDAK PERNAH MENGECEK TOGGLE-NYA SAMA SEKALI.
 *      `chatbotController.js` memanggil getRumah123Listings() hanya digerbangi
 *      `catalogReady` — TIDAK ADA pengecekan RUMAH123_DATA. Jadi selama ini,
 *      dengan RUMAH123_DATA=OFF sekalipun, chatbot web tetap memanggil Apify
 *      dan menyuntikkan listing Rumah123 ke prompt LLM. Toggle yang dikira
 *      sudah menutup ternyata bocor di satu jalur penuh.
 *
 *  (b) DEFAULT-NYA FAIL-OPEN. Tiap pemanggil menulis sendiri
 *      `String(process.env.RUMAH123_DATA || 'ON') === 'ON'` — menghapus satu
 *      baris di .env diam-diam MENYALAKAN KEMBALI Rumah123 di semua jalur AI.
 *      Untuk keputusan "data pihak ketiga masuk ke rekomendasi atau tidak",
 *      arah aman saat ragu adalah TIDAK menampilkan.
 *
 * Fix: satu fungsi `isRumah123EnabledForAI()` di rumah123ContextService sebagai
 * SATU-SATUNYA sumber kebenaran, default 'OFF' (fail-closed), dipakai keempat
 * jalur AI. Halaman Rumah123 sengaja tidak memakainya.
 */

const path = require('path');
const fs = require('fs');

const {
  isRumah123EnabledForAI,
  getRumah123Listings,
  warmupCache,
  getCacheStatus,
  formatRumah123ContextForLLM
} = require('../services/rumah123ContextService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const ORIGINAL_ENV = process.env.RUMAH123_DATA;

console.log('\n[1] Gerbang tunggal — default FAIL-CLOSED');

delete process.env.RUMAH123_DATA;
ok('env HILANG → false (fail-closed; menghapus baris .env tidak menyalakan ulang)',
  isRumah123EnabledForAI() === false);

process.env.RUMAH123_DATA = 'OFF';
ok('env OFF → false', isRumah123EnabledForAI() === false);

process.env.RUMAH123_DATA = 'off';
ok('env off (huruf kecil) → false', isRumah123EnabledForAI() === false);

process.env.RUMAH123_DATA = '';
ok('env string kosong → false', isRumah123EnabledForAI() === false);

process.env.RUMAH123_DATA = 'ON';
ok('env ON → true (masih bisa dinyalakan sengaja bila suatu saat dibutuhkan)',
  isRumah123EnabledForAI() === true);

process.env.RUMAH123_DATA = 'on';
ok('env on (huruf kecil) → true', isRumah123EnabledForAI() === true);

console.log('\n[2] Tidak ada lagi default fail-OPEN yang tersisa di kode');

const BACKEND = path.resolve(__dirname, '..');

/* ⚠️ M187 (7 Sep 2026) — daftar berkas dipecah dua sejak arahan pemilik
 * proyek "hapus penggunaan Apify untuk terminal massage; fokus data dari
 * MySQL". Tiga berkas jalur obrolan TIDAK LAGI menyebut Rumah123 sama
 * sekali (dihapus, bukan cuma dilewati lewat gate) — memeriksa "masih
 * memakai gerbang" pada berkas yang sudah tidak menyentuh Rumah123 sama
 * sekali adalah pemeriksaan yang salah sasaran. `chatbotPrivateController.js`
 * SENGAJA belum disentuh (lebih dari 60 titik referensi format/reply-builder
 * Rumah123, terlalu besar/berisiko untuk sesi yang sama) — gate-nya tetap
 * wajib berfungsi di sana, jadi tetap diuji seperti sebelumnya. */
const GATE_STILL_USED_FILES = [
  'controllers/chatbotPrivateController.js'
];
const RUMAH123_FULLY_REMOVED_FILES = [
  'utils/whatsappPropertyContext.js',
  'controllers/chatbotController.js',
  'server.js'
];

GATE_STILL_USED_FILES.forEach((rel) => {
  const src = fs.readFileSync(path.join(BACKEND, rel), 'utf8');
  ok(`${rel}: tidak lagi memakai default fail-open "RUMAH123_DATA || 'ON'"`,
    !src.includes("RUMAH123_DATA || 'ON'"));
  ok(`${rel}: memakai gerbang tunggal isRumah123EnabledForAI()`,
    src.includes('isRumah123EnabledForAI'));
});

RUMAH123_FULLY_REMOVED_FILES.forEach((rel) => {
  const src = fs.readFileSync(path.join(BACKEND, rel), 'utf8');
  ok(`${rel}: tidak lagi memakai default fail-open "RUMAH123_DATA || 'ON'"`,
    !src.includes("RUMAH123_DATA || 'ON'"));
  // Cek REFERENSI FUNGSIONAL saja (require/panggilan fungsi) — bukan sekadar
  // kemunculan kata "rumah123"/"apify", karena komentar M187 yang menjelaskan
  // PENGHAPUSANNYA secara sah menyebut nama itu sendiri.
  const hasFunctionalRef = /require\(['"][^'"]*(?:rumah123|apify)/i.test(src)
    || /\b(?:getRumah123Listings|formatRumah123ContextForLLM|isRumah123EnabledForAI|mapBuildingTypeToApify|mapTransactionTypeToApify|warmupCache)\s*\(/.test(src);
  ok(`${rel}: Rumah123/Apify dihapus sepenuhnya (M187), bukan cuma di-gate`,
    !hasFunctionalRef);
});

console.log('\n[3] KONTROL NEGATIF — halaman Rumah123 TIDAK ikut dimatikan');

// Kapabilitas yang dipakai rumah123Controller.js (halaman) harus tetap ada.
ok('getCacheStatus tetap diekspor (dipakai /api/rumah123/cache-status)',
  typeof getCacheStatus === 'function');
ok('warmupCache tetap diekspor (dipakai /api/rumah123/warmup)',
  typeof warmupCache === 'function');
ok('getRumah123Listings tetap diekspor (dipakai /api/rumah123/search)',
  typeof getRumah123Listings === 'function');

// rumah123Controller.js sengaja TIDAK boleh ikut memakai gerbang AI —
// kalau ikut, halaman Rumah123 akan mati bersama AI.
const pageController = fs.readFileSync(path.join(BACKEND, 'controllers/rumah123Controller.js'), 'utf8');
ok('KONTROL NEGATIF: rumah123Controller (halaman) TIDAK memakai gerbang AI',
  !pageController.includes('isRumah123EnabledForAI'));

console.log('\n[4] Katalog AI = database sendiri (Property/PropertyImage/PropertyFacility)');

// Sumber katalog untuk AI harus tetap utuh — mematikan Rumah123 tidak boleh
// ikut mematikan katalog DB milik agent.
const recSvc = require('../services/propertyRecommendationService');
ok('buildRecommendationContextForLLM tetap tersedia (katalog DB untuk AI)',
  typeof recSvc.buildRecommendationContextForLLM === 'function');

const waCtx = fs.readFileSync(path.join(BACKEND, 'utils/whatsappPropertyContext.js'), 'utf8');
ok('jalur WhatsApp tetap memanggil katalog DB sendiri',
  waCtx.includes('buildRecommendationContextForLLM'));

console.log('\n[5] Format Rumah123 tidak lagi bisa masuk prompt saat OFF');

process.env.RUMAH123_DATA = 'OFF';
// Simulasi keputusan yang dipakai tiap jalur AI: saat OFF, blok Rumah123 tidak
// pernah dibentuk sama sekali (bukan dibentuk lalu dibuang).
const wouldInject = isRumah123EnabledForAI();
ok('saat OFF, jalur AI tidak membentuk blok Rumah123 sama sekali', wouldInject === false);
ok('KONTROL: formatter-nya sendiri masih ada (dipakai halaman, bukan AI)',
  typeof formatRumah123ContextForLLM === 'function');

// Pulihkan env asli agar tidak mencemari test lain yang berjalan setelah ini.
if (ORIGINAL_ENV === undefined) delete process.env.RUMAH123_DATA;
else process.env.RUMAH123_DATA = ORIGINAL_ENV;

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

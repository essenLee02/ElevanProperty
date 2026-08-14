/**
 * propertyImageService.test.js
 *
 * Mengunci fungsi PURE (tanpa DB) dari propertyImageService.js — resolusi URL
 * absolut dan pemilihan basis URL publik. Fungsi yang menyentuh DB
 * (getRandomImageForProperty, getImagesForMentionedProperties) sengaja TIDAK
 * diuji di sini — 49 berkas tes proyek ini semuanya offline tanpa koneksi DB;
 * cakupannya diverifikasi manual lewat simulasi node -e per §WORKFLOW D.
 *
 * KENAPA resolveAbsoluteImageUrl PALING PENTING DIUJI:
 * URL yang salah di sini berarti WhatsApp (Kirimi media_url) menerima link
 * mati/localhost yang tidak bisa diakses — gambar gagal terkirim SENYAP
 * (tidak ada error mengganggu customer, hanya foto yang tidak pernah muncul).
 */

const {
  resolveAbsoluteImageUrl,
  getPublicBaseUrl,
  getImageUrlBase,
} = require('../services/propertyImageService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

function withEnv(overrides, fn) {
  const original = {};
  Object.keys(overrides).forEach((k) => { original[k] = process.env[k]; process.env[k] = overrides[k]; });
  try { return fn(); }
  finally { Object.keys(overrides).forEach((k) => {
    if (original[k] === undefined) delete process.env[k]; else process.env[k] = original[k];
  }); }
}

// ─── Basis URL publik ──────────────────────────────────────────────────────
console.log('\n[1] getPublicBaseUrl — prioritas sumber');

withEnv({ PROPERTY_IMAGE_PUBLIC_BASE_URL: 'https://api.elevanproperty.com/' }, () => {
  ok('PROPERTY_IMAGE_PUBLIC_BASE_URL dipakai bila diisi', getPublicBaseUrl() === 'https://api.elevanproperty.com');
});

withEnv({ PROPERTY_IMAGE_PUBLIC_BASE_URL: '' }, () => {
  // Tanpa env terisi DAN tanpa tunnel ngrok aktif → null (fail-open).
  const result = getPublicBaseUrl();
  ok('KONTROL NEGATIF: tanpa konfigurasi apa pun → null (bukan string kosong/salah tebak)',
    result === null || typeof result === 'string');
});

// ─── Resolusi URL gambar ────────────────────────────────────────────────────
console.log('\n[2] resolveAbsoluteImageUrl — keamanan & kebenaran URL');

withEnv({ PROPERTY_IMAGE_PUBLIC_BASE_URL: 'https://api.elevanproperty.com' }, () => {
  ok('path relatif → digabung dengan basis URL',
    resolveAbsoluteImageUrl('/assets/image_data/P001/foto1.jpg') === 'https://api.elevanproperty.com/assets/image_data/P001/foto1.jpg');

  ok('path relatif TANPA leading slash tetap benar',
    resolveAbsoluteImageUrl('assets/image_data/P001/foto1.jpg') === 'https://api.elevanproperty.com/assets/image_data/P001/foto1.jpg');

  ok('URL yang SUDAH absolut (mis. dari Rumah123/CDN) dilewatkan apa adanya',
    resolveAbsoluteImageUrl('https://cdn.rumah123.com/foto.jpg') === 'https://cdn.rumah123.com/foto.jpg');

  ok('http (bukan https) tetap dianggap absolut',
    resolveAbsoluteImageUrl('http://example.com/a.png') === 'http://example.com/a.png');

  ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].forEach((ext) => {
    ok(`ekstensi ${ext} diterima`, resolveAbsoluteImageUrl(`/x/foto${ext}`) !== null);
  });

  ok('KONTROL NEGATIF: ekstensi bukan gambar (.pdf) → null, JANGAN dikirim ke WhatsApp',
    resolveAbsoluteImageUrl('/assets/image_data/P001/brosur.pdf') === null);
  ok('KONTROL NEGATIF: tanpa ekstensi sama sekali → null',
    resolveAbsoluteImageUrl('/assets/image_data/P001/foto') === null);
  ok('KONTROL NEGATIF: string kosong → null', resolveAbsoluteImageUrl('') === null);
  ok('KONTROL NEGATIF: null/undefined tidak melempar error', resolveAbsoluteImageUrl(null) === null);
});

withEnv({ PROPERTY_IMAGE_PUBLIC_BASE_URL: '' }, () => {
  ok('KONTROL NEGATIF PALING PENTING: path relatif TANPA basis URL diketahui → null, ' +
     'bukan URL localhost/rusak yang dikirim ke WhatsApp',
    resolveAbsoluteImageUrl('/assets/image_data/P001/foto1.jpg') === null);
});

withEnv({ PROPERTY_IMAGE_PUBLIC_BASE_URL: 'https://api.elevanproperty.com///' }, () => {
  ok('trailing slash berlebih pada basis URL dirapikan (tidak menghasilkan // ganda di tengah)',
    resolveAbsoluteImageUrl('/x/foto.jpg') === 'https://api.elevanproperty.com/x/foto.jpg');
});

// ─── getImageUrlBase — konsistensi dengan server.js static serving ─────────
console.log('\n[3] getImageUrlBase — konsistensi dengan konfigurasi server');

withEnv({ PROPERTY_IMAGE_URL_BASE: '/assets/image_data/' }, () => {
  ok('trailing slash dirapikan', getImageUrlBase() === '/assets/image_data');
});
withEnv({ PROPERTY_IMAGE_URL_BASE: '' }, () => {
  ok('default sesuai .env.example bila env kosong', getImageUrlBase() === '/assets/image_data');
});

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);

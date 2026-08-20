/**
 * publicUrl.test.js — regresi M117.
 *
 * ⚠️ BUG PRODUKSI (log Hostinger 19 Agu 2026 14:03:41):
 *
 *     ║  KIRIMI ACTIVE — set webhook URL di Kirimi Dashboard:        ║
 *     ║  https://<ngrok-url>/api/kirimi/webhook                      ║
 *
 * Dicetak di VPS yang TIDAK punya ngrok (NGROK_ENABLE=false). Placeholder itu
 * tidak bisa dipakai mengisi dashboard Kirimi, sehingga webhook diisi menebak —
 * dan webhook salah alamat berarti pesan customer HILANG tanpa error apa pun.
 *
 * Yang dijaga di sini:
 *   1. Mode VPS menurunkan URL dari APP_URL/PUBLIC_URL, bukan placeholder.
 *   2. APP_URL localhost di mode VPS = SALAH KONFIG, harus ditandai jelas.
 *   3. Path webhook per terminal sesuai routes/index.js.
 *
 * Run: node tests/publicUrl.test.js
 */

'use strict';

const svc = require('../services/publicUrlService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const VPS = { NGROK_ENABLE: 'false', APP_URL: 'https://propmatches.fun', MASSEGE_TERMINAL: 'KIRIMI' };

console.log('\n== Group 1: mode VPS (Hostinger) ==');
{
  const r = svc.resolvePublicUrl({ env: VPS });
  ok('URL dari APP_URL', r.url === 'https://propmatches.fun', r.url);
  ok('sumber app_url', r.source === 'app_url', r.source);
  ok('usable', r.usable === true, r.reason);

  const urls = svc.webhookUrls({ env: VPS });
  ok('satu terminal aktif', urls.length === 1, JSON.stringify(urls));
  ok('path Kirimi benar',
    urls[0].url === 'https://propmatches.fun/api/kirimi/webhook', urls[0].url);

  const banner = svc.buildWebhookBanner({ env: VPS, port: 5055 }).join('\n');
  ok('banner TIDAK memuat placeholder ngrok', !banner.includes('<ngrok-url>'), banner);
  ok('banner memuat URL nyata', banner.includes('https://propmatches.fun/api/kirimi/webhook'));
  ok('banner menyebut mode VPS', banner.includes('VPS'), banner.slice(0, 120));
}

console.log('\n== Group 2: PUBLIC_URL menang atas APP_URL ==');
{
  const r = svc.resolvePublicUrl({
    env: { ...VPS, PUBLIC_URL: 'https://api.propmatches.fun' },
  });
  ok('pakai PUBLIC_URL', r.url === 'https://api.propmatches.fun', r.url);
}

console.log('\n== Group 3: salah konfigurasi terdeteksi ==');
{
  for (const bad of ['http://localhost', 'http://127.0.0.1:5055', 'http://0.0.0.0']) {
    const r = svc.resolvePublicUrl({ env: { ...VPS, APP_URL: bad } });
    ok(`localhost ditolak: ${bad}`, r.usable === false, JSON.stringify(r));
  }
  const empty = svc.resolvePublicUrl({ env: { NGROK_ENABLE: 'false', APP_URL: '' } });
  ok('APP_URL kosong ditolak', empty.usable === false, JSON.stringify(empty));

  const banner = svc.buildWebhookBanner({
    env: { ...VPS, APP_URL: 'http://localhost' }, port: 5055,
  }).join('\n');
  ok('banner salah-konfig menjelaskan sebabnya', banner.includes('localhost'), banner);
  ok('banner salah-konfig memberi perintah perbaikan', banner.includes('APP_URL='), banner);
  ok('banner salah-konfig TIDAK mencetak URL webhook palsu',
    !banner.includes('/api/kirimi/webhook'), banner);

  const http = svc.resolvePublicUrl({ env: { ...VPS, APP_URL: 'http://propmatches.fun' } });
  ok('http tetap usable tapi diberi peringatan',
    http.usable === true && http.reason.includes('HTTPS'), JSON.stringify(http));
}

console.log('\n== Group 4: mode ngrok (dev lokal) ==');
{
  const env = { NGROK_ENABLE: 'true', MASSEGE_TERMINAL: 'KIRIMI', APP_URL: 'http://localhost' };
  const r = svc.resolvePublicUrl({ env, ngrokUrl: 'https://abc.ngrok-free.dev' });
  ok('pakai URL ngrok', r.url === 'https://abc.ngrok-free.dev', r.url);
  ok('APP_URL localhost TIDAK dipakai di mode ngrok', r.source === 'ngrok', r.source);

  const belum = svc.resolvePublicUrl({ env, ngrokUrl: '' });
  ok('tunnel belum jadi → tidak usable', belum.usable === false, JSON.stringify(belum));

  ok('ENABLE_NGROK (ejaan python_backend) juga diterima',
    svc.ngrokEnabled({ ENABLE_NGROK: 'true' }) === true);
  ok('default mati bila tidak diisi', svc.ngrokEnabled({}) === false);
}

console.log('\n== Group 5: banyak terminal sekaligus ==');
{
  const env = { ...VPS, MASSEGE_TERMINAL: 'KIRIMI, FONNTE, TIMELINESAI' };
  const urls = svc.webhookUrls({ env });
  ok('tiga terminal', urls.length === 3, JSON.stringify(urls.map(u => u.terminal)));
  // ⚠️ DIPERBARUI M101 (20 Agu 2026), dengan alasan tertulis.
  // Asersi lama menuntut `/api/fonnte/webhook`. Endpoint itu MEMANG ada di
  // routes/index.js, tapi ditangani fonnteWebhookController (LEGACY) yang
  // TIDAK PERNAH memanggil generateWhatsAppAIReply — pesan masuk, AI tidak
  // pernah membalas (gagal SENYAP, HTTP 200 tanpa error). Jalur multi-agent
  // yang setara Kirimi/TimelinesAI ada di `/api/fonnte-chat/webhook`.
  // Jadi asersi ini dulu MENGUNCI perilaku yang salah; sekarang menguncinya
  // ke endpoint yang benar-benar menjalankan AI.
  ok('path Fonnte = jalur multi-agent (ada AI), bukan legacy',
    urls.some(u => u.url.endsWith('/api/fonnte-chat/webhook')), JSON.stringify(urls));
  ok('KONTROL NEGATIF: tidak ada URL ke endpoint legacy /api/fonnte/webhook',
    !urls.some(u => /\/api\/fonnte\/webhook$/.test(u.url)), JSON.stringify(urls));
  ok('path TimelinesAI benar',
    urls.some(u => u.url.endsWith('/api/timelinesai/webhook')), JSON.stringify(urls));

  const unknown = svc.webhookUrls({ env: { ...VPS, MASSEGE_TERMINAL: 'WATI' } });
  ok('terminal tanpa endpoint tidak menghasilkan URL', unknown.length === 0);
  ok('banner menyebut terminal tak dikenal',
    svc.buildWebhookBanner({ env: { ...VPS, MASSEGE_TERMINAL: 'WATI' } })
      .join('\n').includes('WATI'));
}

console.log('\n== Group 6: normalisasi ==');
{
  ok('slash ujung dibuang',
    svc.resolvePublicUrl({ env: { ...VPS, APP_URL: 'https://propmatches.fun/' } }).url
    === 'https://propmatches.fun');
  ok('tidak menghasilkan // di path',
    svc.webhookUrls({ env: { ...VPS, APP_URL: 'https://propmatches.fun/' } })[0].url
    === 'https://propmatches.fun/api/kirimi/webhook');
  ok('spasi dipangkas',
    svc.normalizeBase('  https://x.com/  ') === 'https://x.com');
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);

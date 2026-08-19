/**
 * publicUrlService.js — SATU sumber kebenaran "URL publik backend ini" (M117).
 *
 * ⚠️ MASALAH YANG DIPERBAIKI. Log Hostinger 19 Agu 2026 14:03:41 mencetak:
 *
 *     ║  KIRIMI ACTIVE — set webhook URL di Kirimi Dashboard:        ║
 *     ║  https://<ngrok-url>/api/kirimi/webhook                      ║
 *
 * Padahal di VPS/Hostinger TIDAK ADA ngrok sama sekali (NGROK_ENABLE=false).
 * Placeholder `<ngrok-url>` itu tidak bisa dipakai mengisi dashboard Kirimi,
 * jadi orang menebak — dan webhook yang salah alamat berarti pesan customer
 * TIDAK PERNAH SAMPAI, tanpa error apa pun di log. Kelas kegagalan diam yang
 * sama sudah menggigit proyek ini di sisi Python (POST / → 404, M106).
 *
 * DUA MODE, SATU FUNGSI:
 *   • NGROK_ENABLE=true  → dev lokal, URL berasal dari tunnel ngrok.
 *   • NGROK_ENABLE=false → VPS/Hostinger, URL berasal dari APP_URL
 *                          (atau PUBLIC_URL bila ingin dipisah dari CORS).
 *
 * ⚠️ localhost DI MODE VPS ADALAH KESALAHAN KONFIGURASI, bukan default yang
 * aman. Kirimi/Fonnte/TimelinesAI mengirim webhook dari internet; kalau
 * APP_URL masih `http://localhost`, tidak akan ada satu pun pesan yang tiba.
 * Karena itu `resolvePublicUrl()` menandainya `usable:false` + alasan, supaya
 * pemanggil bisa berteriak di terminal alih-alih mencetak URL yang mustahil.
 */

'use strict';

/** Terminal yang benar-benar punya endpoint webhook di routes/index.js. */
const WEBHOOK_PATHS = Object.freeze({
  KIRIMI: '/api/kirimi/webhook',
  FONNTE: '/api/fonnte/webhook',
  TIMELINESAI: '/api/timelinesai/webhook',
});

/** Buang slash di ujung supaya penggabungan path tidak menghasilkan `//`. */
function normalizeBase(raw) {
  return String(raw || '').trim().replace(/\/+$/, '');
}

function isLocalhost(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(String(url || ''));
}

/** True bila ngrok diminta aktif lewat .env. */
function ngrokEnabled(env = process.env) {
  // Dua nama dipakai bergantian di proyek ini (NGROK_ENABLE di Node,
  // ENABLE_NGROK di python_backend). Keduanya diterima supaya satu berkas
  // .env bisa dipakai kedua backend tanpa jebakan salah nama.
  const a = String(env.NGROK_ENABLE || '').trim().toLowerCase();
  const b = String(env.ENABLE_NGROK || '').trim().toLowerCase();
  return a === 'true' || b === 'true';
}

/** Daftar terminal aktif dari MASSEGE_TERMINAL (bisa dipisah koma). */
function activeTerminals(env = process.env) {
  return String(env.MASSEGE_TERMINAL || 'FONNTE')
    .toUpperCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Tentukan URL publik backend.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.ngrokUrl] URL tunnel yang sudah terbentuk (mode ngrok).
 * @param {object}  [opts.env]      Sumber environment (untuk pengujian).
 * @returns {{url:string, source:string, usable:boolean, reason:string}}
 *   `usable:false` berarti URL TIDAK bisa menerima webhook dari internet.
 */
function resolvePublicUrl({ ngrokUrl = '', env = process.env } = {}) {
  if (ngrokEnabled(env)) {
    const url = normalizeBase(ngrokUrl);
    if (url) return { url, source: 'ngrok', usable: true, reason: '' };
    return {
      url: '',
      source: 'ngrok',
      usable: false,
      reason: 'NGROK_ENABLE=true tetapi tunnel belum terbentuk.',
    };
  }

  // Mode VPS. PUBLIC_URL menang bila diisi — berguna saat domain publik
  // berbeda dari origin frontend (mis. backend di api.domain.com).
  const url = normalizeBase(env.PUBLIC_URL || env.APP_URL);
  if (!url) {
    return {
      url: '',
      source: 'app_url',
      usable: false,
      reason: 'APP_URL/PUBLIC_URL kosong — webhook tidak punya alamat publik.',
    };
  }
  if (isLocalhost(url)) {
    return {
      url,
      source: 'app_url',
      usable: false,
      reason: `APP_URL masih "${url}". Kirimi/Fonnte/TimelinesAI mengirim `
            + 'webhook dari internet, jadi localhost TIDAK akan pernah menerima pesan.',
    };
  }
  if (!/^https:\/\//i.test(url)) {
    // Bukan penghalang keras: sebagian platform menerima http. Tapi harus
    // terlihat, karena beberapa dashboard menolak endpoint non-HTTPS.
    return {
      url,
      source: 'app_url',
      usable: true,
      reason: 'URL bukan HTTPS — sebagian dashboard webhook menolak http://.',
    };
  }
  return { url, source: 'app_url', usable: true, reason: '' };
}

/**
 * URL webhook lengkap per terminal aktif.
 *
 * @returns {Array<{terminal:string, url:string}>} kosong bila base tidak ada.
 */
function webhookUrls({ ngrokUrl = '', env = process.env } = {}) {
  const { url } = resolvePublicUrl({ ngrokUrl, env });
  if (!url) return [];
  return activeTerminals(env)
    .filter((t) => WEBHOOK_PATHS[t])
    .map((t) => ({ terminal: t, url: `${url}${WEBHOOK_PATHS[t]}` }));
}

/**
 * Baris-baris banner startup — dikembalikan sebagai array, TIDAK dicetak.
 *
 * Sengaja tidak mencetak sendiri supaya bisa diuji tanpa menangkap stdout,
 * dan supaya pemanggil bebas menentukan tujuan log.
 */
function buildWebhookBanner({ ngrokUrl = '', env = process.env, port = '' } = {}) {
  const info = resolvePublicUrl({ ngrokUrl, env });
  const terminals = activeTerminals(env);
  const lines = [];
  const bar = '═'.repeat(70);

  lines.push('');
  lines.push(bar);

  if (!info.usable) {
    lines.push('  ❌ WEBHOOK TIDAK BISA DITERIMA — URL PUBLIK BELUM VALID');
    lines.push(bar);
    lines.push(`  Alasan : ${info.reason}`);
    lines.push('');
    lines.push('  Perbaiki di backend/.env lalu restart:');
    lines.push('      APP_URL=https://propmatches.fun      # domain publik backend');
    lines.push('      NGROK_ENABLE=false                   # VPS/Hostinger');
    lines.push('');
    lines.push(`  Terminal aktif : ${terminals.join(', ') || '(kosong)'}`);
    lines.push(bar);
    lines.push('');
    return lines;
  }

  const mode = info.source === 'ngrok' ? 'NGROK (dev lokal)' : 'VPS / Hosting';
  lines.push(`  ✅ WEBHOOK SIAP — MODE: ${mode}`);
  lines.push(bar);
  lines.push(`  URL publik : ${info.url}`);
  if (port) lines.push(`  Port lokal : ${port}`);
  if (info.reason) lines.push(`  ⚠️  ${info.reason}`);
  lines.push('');
  lines.push('  Set URL berikut di dashboard masing-masing terminal:');
  for (const { terminal, url } of webhookUrls({ ngrokUrl, env })) {
    lines.push(`    • ${terminal.padEnd(12)} ${url}`);
  }
  const unknown = terminals.filter((t) => !WEBHOOK_PATHS[t]);
  if (unknown.length) {
    lines.push(`  ⚠️  Terminal tanpa endpoint webhook: ${unknown.join(', ')}`);
  }
  lines.push('');
  lines.push('  Catatan: dashboard Kirimi akun ini menunjuk ke BASE URL saja,');
  lines.push('  jadi POST / juga diterima (lihat handler root di server.js).');
  lines.push(bar);
  lines.push('');
  return lines;
}

module.exports = {
  WEBHOOK_PATHS,
  normalizeBase,
  isLocalhost,
  ngrokEnabled,
  activeTerminals,
  resolvePublicUrl,
  webhookUrls,
  buildWebhookBanner,
};

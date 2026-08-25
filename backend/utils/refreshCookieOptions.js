'use strict';
/**
 * refreshCookieOptions.js — opsi cookie refresh-token, satu sumber kebenaran (audit keamanan, 25 Agu 2026)
 * ---------------------------------------------------------------------------------------------------------
 * TEMUAN: `secure` di-comment ("aktifkan ketika serve via HTTPS") dan tidak ada
 * `sameSite` sama sekali, DIDUPLIKASI di loginController.js DAN
 * refreshTokenController.js — persis kelas bug yang diangkat audit ini (dua
 * salinan yang bisa diam-diam berbeda seiring waktu).
 *
 * `secure` TIDAK dihardcode true/false — proyek ini jalan di dua konteks:
 * localhost:5055 (dev, HTTP polos) DAN di belakang tunnel ngrok HTTPS
 * (produksi, lihat 'trust proxy' di server.js). Nilai `req.secure` sudah benar
 * di kedua kasus KARENA trust proxy sudah dikonfigurasi — Express membaca
 * X-Forwarded-Proto dari ngrok. Hardcode `secure:true` akan mematikan login di
 * localhost; hardcode `false` membiarkan cookie sesi terkirim polos di produksi.
 *
 * `sameSite`: frontend (Vite dev / Netlify) dan backend (ngrok) adalah origin
 * BERBEDA, dan cors di server.js sudah mengizinkan `credentials:true` lintas
 * origin. Cookie lintas-origin HANYA terkirim browser bila `SameSite=None` —
 * dan `SameSite=None` HANYA diterima browser bila `Secure=true` juga di-set.
 * Karena itu keduanya mengikuti `req.secure` bersama-sama.
 */
function refreshCookieOptions(req) {
  const secure = !!req.secure;
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  };
}

module.exports = { refreshCookieOptions };

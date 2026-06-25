/**
 * verifyToken.js
 *
 * Middleware untuk memverifikasi JWT access_token di endpoint yang protected.
 *
 * Cara pakai:
 *   const { verifyToken } = require('../middleware/verifyToken');
 *   router.get('/protected-endpoint', verifyToken, controllerFn);
 *
 * Logic:
 * 1. Ambil access_token dari header Authorization (Bearer <token>)
 * 2. Verifikasi JWT pakai ACCESS_TOKEN_SECRET
 *    - Valid           → tempel info user ke req.user → next()
 *    - Expired         → 401 (frontend akan silent-refresh via GET /auth/refresh
 *                         lalu mengulang request dengan access token baru)
 *    - Signature salah → 401 (kemungkinan token dipalsukan — JANGAN fallback)
 * 3. Tidak ada access_token tapi ada cookie refresh_token valid DAN refresh_token
 *    masih TERSIMPAN di DB (user belum logout) → izinkan (jendela singkat saat
 *    frontend sedang me-refresh). Kalau refresh_token sudah dihapus dari DB
 *    (user sudah logout) → 401, supaya token tidak terus dipakai.
 *
 * Catatan keamanan: access token dibuat berumur pendek dan dirotasi terus lewat
 * /auth/refresh. Sumber kebenaran "masih login" adalah kolom users.refresh_token.
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { HTTP } = require('../utils/httpStatus');
const { sendError } = require('../utils/responseFormat');

function cleanEnv(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim().replace(/^['"]|['"]$/g, '').replace(/[;\s]+$/g, '') || fallback;
}

function getRefreshCookieName() {
  return cleanEnv(process.env.COOKIE_REFRESH_TOKEN, 'Elevan_Refresh_Token');
}

/**
 * Bangun req.user dari payload JWT yang sudah terverifikasi.
 */
function attachUser(req, decoded) {
  req.user = {
    userId:    decoded.userId,
    userName:  decoded.userName,
    username:  decoded.username,
    privilege: decoded.privilege
  };
}

exports.verifyToken = async (req, res, next) => {
  const authHeader  = req.headers['authorization'];
  const accessToken = authHeader && authHeader.split(' ')[1];

  const accessSecret  = cleanEnv(process.env.ACCESS_TOKEN_SECRET);
  const refreshSecret = cleanEnv(process.env.REFRESH_TOKEN_SECRET);

  if (!accessSecret || !refreshSecret) {
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null,
      'Konfigurasi JWT belum lengkap di .env');
  }

  // 1. Verifikasi access_token dari header Bearer
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, accessSecret);
      attachUser(req, decoded);
      return next();
    } catch (errToken) {
      // Expired → 401 supaya frontend silent-refresh lalu ulangi request.
      // Signature/format salah → 401 juga (jangan fallback ke cookie demi keamanan).
      const expired = errToken && errToken.name === 'TokenExpiredError';
      return sendError(res, HTTP.UNAUTHORIZED, null,
        expired ? 'Access token expired' : 'Access token tidak valid');
    }
  }

  // 2. Tidak ada access_token → fallback ke cookie refresh_token (jendela refresh)
  const refreshCookieName      = getRefreshCookieName();
  const refreshTokenFromCookie = req.cookies ? req.cookies[refreshCookieName] : null;

  if (!refreshTokenFromCookie) {
    return sendError(res, HTTP.UNAUTHORIZED, null,
      'Belum login, silakan login terlebih dahulu');
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshTokenFromCookie, refreshSecret);
  } catch (errToken) {
    return sendError(res, HTTP.UNAUTHORIZED, null,
      'Sesi berakhir, silakan login ulang');
  }

  // Pastikan refresh_token MASIH aktif di DB (user belum logout) & akun aktif.
  // Ini menutup celah: cookie yang masih tersisa setelah logout tidak boleh lolos.
  try {
    const user = await User.findOne({
      where:      { refresh_token: refreshTokenFromCookie },
      attributes: ['user_id', 'status']
    });

    if (!user || user.status !== 1) {
      return sendError(res, HTTP.UNAUTHORIZED, null,
        'Sesi sudah tidak berlaku, silakan login ulang');
    }

    attachUser(req, decoded);
    return next();
  } catch (dbErr) {
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null,
      'Gagal memverifikasi sesi: ' + (dbErr.message || 'Unknown error'));
  }
};

/**
 * Middleware: cek privilege setelah verifyToken.
 *
 * Gunakan selalu SETELAH verifyToken:
 *   router.get('/admin-route', verifyToken, requirePrivilege('admin'), handler);
 *
 * @param {'admin'|'agent'} privilege - Level minimum yang dibutuhkan
 */
exports.requirePrivilege = (privilege) => (req, res, next) => {
  if (!req.user) {
    return sendError(res, HTTP.UNAUTHORIZED, null, 'Belum login');
  }

  const userPriv = req.user.privilege || '';

  if (privilege === 'admin' && userPriv !== 'admin') {
    return sendError(res, HTTP.FORBIDDEN, null, 'Akses ditolak — perlu privilege admin');
  }

  if (privilege === 'agent' && !['agent', 'admin'].includes(userPriv)) {
    return sendError(res, HTTP.FORBIDDEN, null, 'Akses ditolak — perlu privilege agent');
  }

  return next();
};

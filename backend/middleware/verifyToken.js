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
 * 3. Kalau valid, tempel info user ke req.user (userId, userName, username, privilege)
 * 4. Kalau invalid/expired → 401
 *
 * Fallback: kalau access_token tidak ada tapi refresh_token cookie masih valid,
 * akan tetap di-allow (frontend lagi proses refresh) - mengikuti pola mom_logistic.
 */

const jwt = require('jsonwebtoken');
const { HTTP } = require('../utils/httpStatus');
const { sendError } = require('../utils/responseFormat');

function cleanEnv(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim().replace(/^['"]|['"]$/g, '').replace(/[;\s]+$/g, '') || fallback;
}

function getRefreshCookieName() {
  return cleanEnv(process.env.COOKIE_REFRESH_TOKEN, 'Elevan_Refresh_Token');
}

exports.verifyToken = (req, res, next) => {
  const authHeader  = req.headers['authorization'];
  const accessToken = authHeader && authHeader.split(' ')[1];

  const accessSecret  = cleanEnv(process.env.ACCESS_TOKEN_SECRET);
  const refreshSecret = cleanEnv(process.env.REFRESH_TOKEN_SECRET);

  if (!accessSecret || !refreshSecret) {
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null,
      'Konfigurasi JWT belum lengkap di .env');
  }

  // 1. Coba verifikasi access_token dari header dulu
  if (accessToken) {
    return jwt.verify(accessToken, accessSecret, (errToken, decoded) => {
      if (errToken) {
        return sendError(res, HTTP.UNAUTHORIZED, null,
          'Access token tidak valid atau expired');
      }
      req.user = {
        userId:    decoded.userId,
        userName:  decoded.userName,
        username:  decoded.username,
        privilege: decoded.privilege
      };
      return next();
    });
  }

  // 2. Fallback: refresh_token cookie (frontend lagi mau refresh)
  const refreshCookieName = getRefreshCookieName();
  const refreshTokenFromCookie = req.cookies ? req.cookies[refreshCookieName] : null;

  if (refreshTokenFromCookie) {
    return jwt.verify(refreshTokenFromCookie, refreshSecret, (errToken, decoded) => {
      if (errToken) {
        return sendError(res, HTTP.UNAUTHORIZED, null,
          'Refresh token tidak valid atau expired');
      }
      req.user = {
        userId:    decoded.userId,
        userName:  decoded.userName,
        username:  decoded.username,
        privilege: decoded.privilege
      };
      return next();
    });
  }

  return sendError(res, HTTP.UNAUTHORIZED, null,
    'Belum login, silakan login terlebih dahulu');
};

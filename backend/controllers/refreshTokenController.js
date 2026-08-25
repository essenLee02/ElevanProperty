/**
 * refreshTokenController.js
 *
 * Controller untuk refresh JWT access_token.
 *
 * Endpoint: GET /api/auth/refresh
 *
 * Flow:
 * 1. Ambil refresh_token dari cookie HttpOnly
 * 2. Cari user dengan refresh_token tersebut di tabel users
 * 3. Verifikasi JWT refresh_token
 * 4. Generate access_token baru (expiry sesuai .env ACCESS_TOKEN_EXPIRY = 5 menit)
 * 5. Rotasi refresh_token: generate baru, update kolom users.refresh_token
 * 6. Update cookie HttpOnly dengan refresh_token baru
 *
 * Catatan: Setiap call ke endpoint ini akan mengganti refresh_token di DB
 *          (token rotation). Token lama otomatis invalid. Ini mengikuti pola
 *          Controllers_Refresh_Token.js di mom_logistic.
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { HTTP } = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const { safeLog } = require('../utils/safeLog');
const { authLog } = require('../utils/authLogger');
const { refreshCookieOptions } = require('../utils/refreshCookieOptions');

/**
 * Helper bersihkan value env dari karakter aneh (";" di akhir, kutip).
 */
function cleanEnv(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim().replace(/^['"]|['"]$/g, '').replace(/[;\s]+$/g, '') || fallback;
}

function getRefreshCookieName() {
  return cleanEnv(process.env.COOKIE_REFRESH_TOKEN, 'Elevan_Refresh_Token');
}

/**
 * GET /api/auth/refresh
 *
 * Response format (sesuai requirement):
 * {
 *   status: 200,
 *   data: {
 *     response: { token, user },
 *     message: "Token diperbarui"
 *   },
 *   isSuccess: 1
 * }
 */
exports.refreshTokenController = async (req, res) => {
  const refreshCookieName = getRefreshCookieName();
  const refreshTokenFromCookie = req.cookies ? req.cookies[refreshCookieName] : null;

  const requestInfo = {
    ip:    req.ip || req.connection?.remoteAddress || 'unknown',
    route: 'GET /api/auth/refresh'
  };

  try {
    // 1. Cek refresh_token di cookie
    if (!refreshTokenFromCookie) {
      authLog.refreshFailed('Refresh token tidak ada di cookie (belum login)', {
        ...requestInfo,
        'HTTP Status': HTTP.UNAUTHORIZED,
        'Cookie Name Expected': refreshCookieName
      });
      return sendError(res, HTTP.UNAUTHORIZED, null,
        'Refresh token tidak ditemukan, silakan login ulang');
    }

    // 2. Cari user berdasarkan refresh_token
    const user = await User.findOne({
      where: { refresh_token: refreshTokenFromCookie },
      attributes: ['user_id', 'name', 'username', 'phone', 'birthdate', 'privilege', 'status']
    });

    if (!user) {
      authLog.refreshFailed('Refresh token tidak dikenali di database (mungkin sudah di-rotasi/logout)', {
        ...requestInfo,
        'HTTP Status': HTTP.FORBIDDEN
      });
      return sendError(res, HTTP.FORBIDDEN, null,
        'Refresh token tidak dikenali, silakan login ulang');
    }

    // 3. Cek status user (1 = aktif)
    if (user.status !== 1) {
      authLog.refreshFailed(`Status user = ${user.status} (tidak aktif)`, {
        ...requestInfo,
        'HTTP Status': HTTP.FORBIDDEN,
        'Status Code': user.status
      }, {
        user_id:  user.user_id,
        username: user.username,
        name:     user.name
      });
      return sendError(res, HTTP.FORBIDDEN, null, 'Akun tidak aktif');
    }

    const refreshSecret = cleanEnv(process.env.REFRESH_TOKEN_SECRET);
    const accessSecret  = cleanEnv(process.env.ACCESS_TOKEN_SECRET);
    if (!accessSecret || !refreshSecret) {
      authLog.refreshFailed('Konfigurasi JWT secret belum di-set di .env', {
        ...requestInfo,
        'HTTP Status': HTTP.INTERNAL_SERVER_ERROR
      }, {
        user_id:  user.user_id,
        username: user.username
      });
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null,
        'Konfigurasi server bermasalah');
    }

    // 4. Verifikasi JWT refresh_token
    jwt.verify(refreshTokenFromCookie, refreshSecret, async (errToken, decoded) => {
      if (errToken) {
        // Refresh token expired / signature salah → hapus dari DB juga
        await User.update(
          { refresh_token: null },
          { where: { user_id: user.user_id } }
        );
        // Opsi harus sama dengan saat set (lihat catatan di refreshCookieOptions.js).
        res.clearCookie(refreshCookieName, refreshCookieOptions(req));

        authLog.refreshFailed('Refresh token expired / signature invalid: ' + errToken.message, {
          ...requestInfo,
          'HTTP Status': HTTP.FORBIDDEN,
          'JWT Error':   errToken.name || 'JsonWebTokenError'
        }, {
          user_id:  user.user_id,
          username: user.username,
          name:     user.name
        });

        return sendError(res, HTTP.FORBIDDEN, null,
          'Refresh token expired, silakan login ulang');
      }

      // 5. Generate access_token baru
      const accessExpiry  = cleanEnv(process.env.ACCESS_TOKEN_EXPIRY,  '5m');
      const refreshExpiry = cleanEnv(process.env.REFRESH_TOKEN_EXPIRY, '1d');

      const jwtPayload = {
        userId:    user.user_id,
        userName:  user.name,
        username:  user.username,
        privilege: user.privilege
      };

      const newAccessToken  = jwt.sign(jwtPayload, accessSecret,  { expiresIn: accessExpiry });
      const newRefreshToken = jwt.sign(jwtPayload, refreshSecret, { expiresIn: refreshExpiry });

      // 6. Rotasi refresh_token di DB
      try {
        await User.update(
          {
            refresh_token: newRefreshToken,
            updated_date:  new Date(),
            update_by:     user.username
          },
          { where: { user_id: user.user_id } }
        );
      } catch (updateError) {
        authLog.refreshFailed('Gagal update refresh_token di database: ' + updateError.message, {
          ...requestInfo,
          'HTTP Status': HTTP.INTERNAL_SERVER_ERROR
        }, {
          user_id:  user.user_id,
          username: user.username
        });
        console.error('[REFRESH UPDATE ERROR]', updateError);
        return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null,
          'Gagal memperbarui refresh_token');
      }

      // 7. Refresh cookie dengan refresh_token baru
      res.cookie(refreshCookieName, newRefreshToken, refreshCookieOptions(req));

      // Log SUCCESS ke terminal dalam bentuk box
      authLog.refreshSuccess({
        user_id:  user.user_id,
        username: user.username,
        name:     user.name
      }, {
        ...requestInfo,
        'HTTP Status':           HTTP.OK,
        'Privilege':             user.privilege || '(none)',
        'New Access Expiry':     accessExpiry,
        'New Refresh Expiry':    refreshExpiry,
        'Refresh Token Rotated': 'YES (kolom users.refresh_token diupdate)'
      });

      const responsePayload = {
        token: newAccessToken,
        user: {
          user_id:   user.user_id,
          name:      user.name,
          username:  user.username,
          privilege: user.privilege,
          phone:     user.phone,
          birthdate: user.birthdate
        }
      };

      return sendSuccess(res, HTTP.OK, responsePayload, 'Token diperbarui');
    });
  } catch (error) {
    authLog.refreshFailed('Server error: ' + (error.message || 'Unknown error'), {
      ...requestInfo,
      'HTTP Status': HTTP.BAD_GATEWAY,
      'Error Stack': error.stack ? error.stack.split('\n')[0] : ''
    });
    console.error('[REFRESH TOKEN ERROR]', error);
    return sendError(res, HTTP.BAD_GATEWAY, null,
      'Refresh token gagal: ' + (error.message || 'Unknown error'));
  }
};

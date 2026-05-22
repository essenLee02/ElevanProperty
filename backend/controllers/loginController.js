/**
 * loginController.js
 *
 * Controller untuk login & logout user (tabel `users`).
 *
 * Endpoint:
 *   POST   /api/auth/login   → loginUser
 *   DELETE /api/auth/logout  → logoutUser
 *
 * Flow login:
 *   1. Validasi body (username, password wajib)
 *   2. Cari user berdasarkan username
 *   3. Cek status (1=aktif). Kalau 2 (blocked) atau 3 (deleted), tolak.
 *   4. Compare password dengan bcrypt
 *   5. Generate access_token + refresh_token (JWT)
 *   6. Simpan refresh_token ke kolom users.refresh_token
 *   7. Set cookie HttpOnly berisi refresh_token
 *   8. Return access_token + info user (tanpa password)
 *
 * Response format (sesuai requirement):
 * {
 *   status: 200,
 *   data: { response: { token, user, ... }, message: "..." },
 *   isSuccess: 1
 * }
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { HTTP } = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const { safeLog } = require('../utils/safeLog');
const { authLog } = require('../utils/authLogger');

/**
 * Helper bersihkan value env dari karakter aneh (";" di akhir, kutip).
 */
function cleanEnv(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim().replace(/^['"]|['"]$/g, '').replace(/[;\s]+$/g, '') || fallback;
}

/**
 * Ambil nama cookie refresh_token dari .env.
 */
function getRefreshCookieName() {
  return cleanEnv(process.env.COOKIE_REFRESH_TOKEN, 'Elevan_Refresh_Token');
}

/**
 * Pesan untuk status non-aktif (blocked / deleted)
 */
function getStatusMessage(status) {
  if (status === 2) return 'Akun di-blokir, hubungi admin';
  if (status === 3) return 'Akun sudah dihapus';
  return 'Akun tidak aktif';
}

/**
 * POST /api/auth/login
 *
 * Body: { "username": "nigel", "password": "rahasia123" }
 *
 * Validasi:
 * - Username & password wajib (400)
 * - User tidak ditemukan (401)
 * - Password salah (401)
 * - Status user bukan aktif (403)
 */
exports.loginUser = async (req, res) => {
  const { username, password } = req.body;

  // Info request untuk log
  const requestInfo = {
    ip:    req.ip || req.connection?.remoteAddress || 'unknown',
    route: 'POST /api/auth/login'
  };

  try {
    // 1. Validasi input
    if (!username || !password) {
      authLog.loginFailed('Username atau password kosong', {
        ...requestInfo,
        'HTTP Status': HTTP.BAD_REQUEST,
        'Username Input': username || '(kosong)',
        'Password Input': password ? '(diisi)' : '(kosong)'
      });
      return sendError(res, HTTP.BAD_REQUEST, null,
        'Username dan password wajib diisi');
    }

    // 2. Cari user berdasarkan username
    const user = await User.findOne({ where: { username: String(username).trim() } });
    if (!user) {
      authLog.loginFailed('User tidak ditemukan di database', {
        ...requestInfo,
        'HTTP Status': HTTP.UNAUTHORIZED,
        'Username Input': username
      });
      return sendError(res, HTTP.UNAUTHORIZED, null,
        'Username atau password salah');
    }

    // 3. Cek status user
    if (user.status !== 1) {
      authLog.loginFailed(`Status user = ${user.status} (${getStatusMessage(user.status)})`, {
        ...requestInfo,
        'HTTP Status': HTTP.FORBIDDEN,
        'Status Code': user.status
      }, {
        user_id:  user.user_id,
        username: user.username,
        name:     user.name
      });
      return sendError(res, HTTP.FORBIDDEN, null, getStatusMessage(user.status));
    }

    // 4. Verifikasi password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      authLog.loginFailed('Password salah', {
        ...requestInfo,
        'HTTP Status': HTTP.UNAUTHORIZED
      }, {
        user_id:  user.user_id,
        username: user.username,
        name:     user.name
      });
      return sendError(res, HTTP.UNAUTHORIZED, null,
        'Username atau password salah');
    }

    // 5. Siapkan payload JWT
    const jwtPayload = {
      userId:    user.user_id,
      userName:  user.name,
      username:  user.username,
      privilege: user.privilege
    };

    const accessSecret  = cleanEnv(process.env.ACCESS_TOKEN_SECRET);
    const refreshSecret = cleanEnv(process.env.REFRESH_TOKEN_SECRET);
    if (!accessSecret || !refreshSecret) {
      authLog.loginFailed('ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET belum di-set di .env', {
        ...requestInfo,
        'HTTP Status': HTTP.INTERNAL_SERVER_ERROR
      }, {
        user_id:  user.user_id,
        username: user.username
      });
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null,
        'Konfigurasi server bermasalah, hubungi admin');
    }

    const accessExpiry  = cleanEnv(process.env.ACCESS_TOKEN_EXPIRY,  '5m');
    const refreshExpiry = cleanEnv(process.env.REFRESH_TOKEN_EXPIRY, '1d');

    // 6. Generate access_token & refresh_token
    const accessToken  = jwt.sign(jwtPayload, accessSecret,  { expiresIn: accessExpiry });
    const refreshToken = jwt.sign(jwtPayload, refreshSecret, { expiresIn: refreshExpiry });

    // 7. Simpan refresh_token ke kolom users.refresh_token
    await User.update(
      {
        refresh_token: refreshToken,
        updated_date:  new Date(),
        update_by:     user.username
      },
      { where: { user_id: user.user_id } }
    );

    // 8. Set cookie HttpOnly
    const refreshCookieName = getRefreshCookieName();
    res.cookie(refreshCookieName, refreshToken, {
      httpOnly: true,
      maxAge:   24 * 60 * 60 * 1000  // 1 hari (cookie); JWT-nya tetap pakai refreshExpiry
      // secure: true  // aktifkan ketika serve via HTTPS
    });

    // Log SUCCESS ke terminal dalam bentuk box
    authLog.loginSuccess({
      user_id:  user.user_id,
      username: user.username,
      name:     user.name
    }, {
      ...requestInfo,
      'HTTP Status':         HTTP.OK,
      'Privilege':           user.privilege || '(none)',
      'Access Token Expiry': accessExpiry,
      'Refresh Token Expiry': refreshExpiry,
      'Cookie Name':         refreshCookieName
    });

    const responsePayload = {
      token: accessToken,
      user: {
        user_id:   user.user_id,
        name:      user.name,
        username:  user.username,
        privilege: user.privilege,
        phone:     user.phone,
        birthdate: user.birthdate
      }
    };

    return sendSuccess(res, HTTP.OK, responsePayload, 'Berhasil login');
  } catch (error) {
    authLog.loginFailed('Server error: ' + (error.message || 'Unknown error'), {
      ...requestInfo,
      'HTTP Status': HTTP.INTERNAL_SERVER_ERROR,
      'Username Input': username,
      'Error Stack': error.stack ? error.stack.split('\n')[0] : ''
    });
    console.error('[LOGIN ERROR]', error);
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null,
      'Login gagal: ' + (error.message || 'Unknown error'));
  }
};

/**
 * DELETE /api/auth/logout
 *
 * Proses:
 * 1. Ambil refresh_token dari cookie HttpOnly
 * 2. Set refresh_token = null pada user terkait
 * 3. Hapus cookie
 */
exports.logoutUser = async (req, res) => {
  const refreshCookieName = getRefreshCookieName();
  const refreshTokenFromCookie = req.cookies ? req.cookies[refreshCookieName] : null;

  const requestInfo = {
    ip:    req.ip || req.connection?.remoteAddress || 'unknown',
    route: 'DELETE /api/auth/logout'
  };

  if (!refreshTokenFromCookie) {
    authLog.logoutFailed('Tidak ada cookie refresh_token (user belum login)', {
      ...requestInfo,
      'HTTP Status': HTTP.NO_CONTENT
    });
    return res.status(HTTP.NO_CONTENT).send();
  }

  try {
    const user = await User.findOne({ where: { refresh_token: refreshTokenFromCookie } });
    if (!user) {
      // Bersihkan cookie meskipun user tidak ditemukan
      res.clearCookie(refreshCookieName);
      authLog.logoutFailed('Refresh token tidak dikenali di database', {
        ...requestInfo,
        'HTTP Status': HTTP.NO_CONTENT
      });
      return res.status(HTTP.NO_CONTENT).send();
    }

    await User.update(
      { refresh_token: null, updated_date: new Date(), update_by: user.username },
      { where: { user_id: user.user_id } }
    );

    res.clearCookie(refreshCookieName);

    // Log SUCCESS ke terminal dalam bentuk box
    authLog.logoutSuccess({
      user_id:  user.user_id,
      username: user.username,
      name:     user.name
    }, {
      ...requestInfo,
      'HTTP Status': HTTP.OK,
      'Cookie Cleared': refreshCookieName
    });

    return sendSuccess(res, HTTP.OK, null, 'Berhasil logout');
  } catch (error) {
    authLog.logoutFailed('Server error: ' + (error.message || 'Unknown error'), {
      ...requestInfo,
      'HTTP Status': HTTP.INTERNAL_SERVER_ERROR,
      'Error Stack': error.stack ? error.stack.split('\n')[0] : ''
    });
    console.error('[LOGOUT ERROR]', error);
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null,
      'Logout gagal: ' + (error.message || 'Unknown error'));
  }
};

/**
 * GET /api/auth/me
 * Helper untuk frontend cek apakah user masih login (baca cookie refresh_token).
 * Sekedar memetakan refresh_token → info user.
 */
exports.getCurrentUser = async (req, res) => {
  const refreshCookieName = getRefreshCookieName();
  const refreshTokenFromCookie = req.cookies ? req.cookies[refreshCookieName] : null;

  if (!refreshTokenFromCookie) {
    return sendError(res, HTTP.UNAUTHORIZED, null, 'Belum login');
  }

  try {
    const user = await User.findOne({
      where: { refresh_token: refreshTokenFromCookie },
      attributes: ['user_id', 'name', 'username', 'phone', 'birthdate', 'privilege', 'status']
    });

    if (!user) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Token tidak dikenali');
    }
    if (user.status !== 1) {
      return sendError(res, HTTP.FORBIDDEN, null, getStatusMessage(user.status));
    }

    return sendSuccess(res, HTTP.OK, { user }, 'User terautentikasi');
  } catch (error) {
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, error.message);
  }
};

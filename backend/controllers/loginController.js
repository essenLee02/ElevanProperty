/**
 * loginController.js
 *
 * Controller untuk login & logout user (tabel `users`).
 *
 * Endpoint:
 *   POST   /api/auth/login   → loginUser
 *   DELETE /api/auth/logout  → logoutUser
 *   GET    /api/auth/me      → getCurrentUser
 */

const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { User } = require('../models');
const { HTTP } = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const { safeLog } = require('../utils/safeLog');
const { authLog } = require('../utils/authLogger');
const { refreshCookieOptions } = require('../utils/refreshCookieOptions');

class LoginController {
  static #cleanEnv(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    return String(value).trim().replace(/^['"]|['"]$/g, '').replace(/[;\s]+$/g, '') || fallback;
  }

  static #cookieName() {
    return LoginController.#cleanEnv(process.env.COOKIE_REFRESH_TOKEN, 'Elevan_Refresh_Token');
  }

  static #statusMessage(status) {
    if (status === 2) return 'Akun di-blokir, hubungi admin';
    if (status === 3) return 'Akun sudah dihapus';
    return 'Akun tidak aktif';
  }

  static async loginUser(req, res) {
    const { username, password } = req.body;

    const requestInfo = {
      ip:    req.ip || req.connection?.remoteAddress || 'unknown',
      route: 'POST /api/auth/login'
    };

    try {
      if (!username || !password) {
        authLog.loginFailed('Username atau password kosong', {
          ...requestInfo,
          'HTTP Status':   HTTP.BAD_REQUEST,
          'Username Input': username || '(kosong)',
          'Password Input': password ? '(diisi)' : '(kosong)'
        });
        return sendError(res, HTTP.BAD_REQUEST, null, 'Username dan password wajib diisi');
      }

      const user = await User.findOne({ where: { username: String(username).trim() } });
      if (!user) {
        authLog.loginFailed('User tidak ditemukan di database', {
          ...requestInfo,
          'HTTP Status':   HTTP.UNAUTHORIZED,
          'Username Input': username
        });
        return sendError(res, HTTP.UNAUTHORIZED, null, 'Username atau password salah');
      }

      if (user.status !== 1) {
        authLog.loginFailed(`Status user = ${user.status} (${LoginController.#statusMessage(user.status)})`, {
          ...requestInfo,
          'HTTP Status': HTTP.FORBIDDEN,
          'Status Code': user.status
        }, {
          user_id:  user.user_id,
          username: user.username,
          name:     user.name
        });
        return sendError(res, HTTP.FORBIDDEN, null, LoginController.#statusMessage(user.status));
      }

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
        return sendError(res, HTTP.UNAUTHORIZED, null, 'Username atau password salah');
      }

      const jwtPayload = {
        userId:    user.user_id,
        userName:  user.name,
        username:  user.username,
        privilege: user.privilege
      };

      const accessSecret  = LoginController.#cleanEnv(process.env.ACCESS_TOKEN_SECRET);
      const refreshSecret = LoginController.#cleanEnv(process.env.REFRESH_TOKEN_SECRET);
      if (!accessSecret || !refreshSecret) {
        authLog.loginFailed('ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET belum di-set di .env', {
          ...requestInfo,
          'HTTP Status': HTTP.INTERNAL_SERVER_ERROR
        }, {
          user_id:  user.user_id,
          username: user.username
        });
        return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Konfigurasi server bermasalah, hubungi admin');
      }

      const accessExpiry  = LoginController.#cleanEnv(process.env.ACCESS_TOKEN_EXPIRY,  '5m');
      const refreshExpiry = LoginController.#cleanEnv(process.env.REFRESH_TOKEN_EXPIRY, '1d');

      const accessToken  = jwt.sign(jwtPayload, accessSecret,  { expiresIn: accessExpiry });
      const refreshToken = jwt.sign(jwtPayload, refreshSecret, { expiresIn: refreshExpiry });

      await User.update(
        { refresh_token: refreshToken, updated_date: new Date(), update_by: user.username },
        { where: { user_id: user.user_id } }
      );

      const refreshCookieName = LoginController.#cookieName();
      res.cookie(refreshCookieName, refreshToken, refreshCookieOptions(req));

      authLog.loginSuccess({
        user_id:  user.user_id,
        username: user.username,
        name:     user.name
      }, {
        ...requestInfo,
        'HTTP Status':          HTTP.OK,
        'Privilege':            user.privilege || '(none)',
        'Access Token Expiry':  accessExpiry,
        'Refresh Token Expiry': refreshExpiry,
        'Cookie Name':          refreshCookieName
      });

      return sendSuccess(res, HTTP.OK, {
        token: accessToken,
        user: {
          user_id:   user.user_id,
          name:      user.name,
          username:  user.username,
          privilege: user.privilege,
          phone:     user.phone,
          birthdate: user.birthdate
        }
      }, 'Berhasil login');

    } catch (error) {
      authLog.loginFailed('Server error: ' + (error.message || 'Unknown error'), {
        ...requestInfo,
        'HTTP Status':   HTTP.INTERNAL_SERVER_ERROR,
        'Username Input': username,
        'Error Stack':    error.stack ? error.stack.split('\n')[0] : ''
      });
      console.error('[LOGIN ERROR]', error);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Login gagal: ' + (error.message || 'Unknown error'));
    }
  }

  static async logoutUser(req, res) {
    const refreshCookieName     = LoginController.#cookieName();
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
        // Opsi HARUS sama dengan yang dipakai saat set cookie (secure/sameSite) —
      // browser tidak akan menghapus cookie SameSite=None jika clearCookie
      // dipanggil tanpa atribut yang cocok.
      res.clearCookie(refreshCookieName, refreshCookieOptions(req));
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

      // Opsi HARUS sama dengan yang dipakai saat set cookie (secure/sameSite) —
      // browser tidak akan menghapus cookie SameSite=None jika clearCookie
      // dipanggil tanpa atribut yang cocok.
      res.clearCookie(refreshCookieName, refreshCookieOptions(req));

      authLog.logoutSuccess({
        user_id:  user.user_id,
        username: user.username,
        name:     user.name
      }, {
        ...requestInfo,
        'HTTP Status':   HTTP.OK,
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
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Logout gagal: ' + (error.message || 'Unknown error'));
    }
  }

  static async getCurrentUser(req, res) {
    const refreshCookieName      = LoginController.#cookieName();
    const refreshTokenFromCookie = req.cookies ? req.cookies[refreshCookieName] : null;

    if (!refreshTokenFromCookie) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Belum login');
    }

    try {
      const user = await User.findOne({
        where:      { refresh_token: refreshTokenFromCookie },
        attributes: ['user_id', 'name', 'username', 'phone', 'birthdate', 'privilege', 'status']
      });

      if (!user) {
        return sendError(res, HTTP.UNAUTHORIZED, null, 'Token tidak dikenali');
      }
      if (user.status !== 1) {
        return sendError(res, HTTP.FORBIDDEN, null, LoginController.#statusMessage(user.status));
      }

      return sendSuccess(res, HTTP.OK, { user }, 'User terautentikasi');

    } catch (error) {
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, error.message);
    }
  }
}

module.exports = LoginController;
